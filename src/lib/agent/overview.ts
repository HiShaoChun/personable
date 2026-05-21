// get_overview()：本地计算，非 LLM 调用。spec: persona-agent「标准运行」。
// 除基础直方图外，还派生五组「叙事素材」——节律 / 狂囤日 / 身份相位 / 集中度 /
// 文件夹健康——供 synthesize 阶段挖具体细节，避免合成出"你收藏了很多 GitHub"
// 这种平庸结论。所有新字段均 O(n)、零依赖、无 LLM 调用。
//
// 时区约定：unix 秒本身无时区。本项目面向中文用户，按 Asia/Shanghai（UTC+8）
// 解释 hour / date / weekday。偏移写在 TZ_OFFSET_SEC 一处。
import type { BookmarkEntry } from "@/lib/bookmarks/types";

const TZ_OFFSET_SEC = 8 * 3600;

export interface Overview {
  total: number;
  domainHistogram: { domain: string; count: number }[];
  dateRange: { from: string | null; to: string | null };
  folderTree: { path: string; count: number }[];

  rhythm: {
    topHours: { hour: number; count: number }[]; // top 3
    hourBucket: "深夜" | "凌晨" | "上午" | "下午" | "晚间";
    weekendShare: number; // 0..1
    datedCount: number; // 有 addDate 的条数（参与本组统计的样本）
  };

  bingeDays: { date: string; count: number; topFolder: string }[]; // top 3

  identityPhases: {
    period: string; // 年份串，如 "2024"
    total: number;
    topDomains: string[]; // ≤3
    topFolders: string[]; // ≤3
  }[];

  concentration: {
    gini: number; // 域名分布的 Gini，0..1
    top5Share: number; // 0..1
    label: "广撒网" | "均衡" | "死忠粉";
  };

  folderHealth: {
    totalFolders: number;
    deadFolders: number; // 仅 1 条引用的文件夹个数
    deadFolderRatio: number;
    maxDepth: number; // " / " 分段数；(无文件夹) 不计
    deepestPath: string;
    orphanShare: number; // 无文件夹条目占比
  };
}

function bucketHour(h: number): Overview["rhythm"]["hourBucket"] {
  if (h <= 3) return "深夜";
  if (h <= 7) return "凌晨";
  if (h <= 11) return "上午";
  if (h <= 17) return "下午";
  return "晚间";
}

/** Gini 系数（域名 count 分布）。0 = 完全均匀，趋近 1 = 全堆在一个域名。 */
function gini(counts: number[]): number {
  if (counts.length === 0) return 0;
  const sorted = [...counts].sort((a, b) => a - b);
  const n = sorted.length;
  let sumCum = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += sorted[i];
    sumCum += sorted[i] * (i + 1);
  }
  if (sum === 0) return 0;
  return (2 * sumCum) / (n * sum) - (n + 1) / n;
}

function gridLabel(g: number): Overview["concentration"]["label"] {
  if (g >= 0.7) return "死忠粉";
  if (g < 0.4) return "广撒网";
  return "均衡";
}

export function computeOverview(entries: BookmarkEntry[]): Overview {
  const domainCounts = new Map<string, number>();
  const folderCounts = new Map<string, number>();
  let minTs = Infinity;
  let maxTs = -Infinity;

  // 节律 / 狂囤日 / 身份相位 累加器
  const hourHist = new Array(24).fill(0) as number[];
  let weekendCount = 0;
  let datedCount = 0;
  const perDay = new Map<string, { count: number; folders: Map<string, number> }>();
  const perYear = new Map<
    string,
    { total: number; domains: Map<string, number>; folders: Map<string, number> }
  >();

  // 文件夹健康
  let orphanCount = 0;
  let maxDepth = 0;
  let deepestPath = "";

  for (const e of entries) {
    domainCounts.set(e.domain, (domainCounts.get(e.domain) ?? 0) + 1);

    const folders = e.folderPaths.length ? e.folderPaths : ["(无文件夹)"];
    if (e.folderPaths.length === 0) orphanCount++;
    for (const f of folders) {
      folderCounts.set(f, (folderCounts.get(f) ?? 0) + 1);
      if (f !== "(无文件夹)") {
        const depth = f.split(" / ").filter(Boolean).length;
        if (depth > maxDepth) {
          maxDepth = depth;
          deepestPath = f;
        }
      }
    }

    if (e.addDate != null) {
      if (e.addDate < minTs) minTs = e.addDate;
      if (e.addDate > maxTs) maxTs = e.addDate;

      // 按 UTC+8 解释时间
      const localMs = (e.addDate + TZ_OFFSET_SEC) * 1000;
      const d = new Date(localMs);
      const hour = d.getUTCHours();
      const weekday = d.getUTCDay(); // 0 = Sun
      const dateStr = d.toISOString().slice(0, 10);
      const yearStr = dateStr.slice(0, 4);

      hourHist[hour]++;
      if (weekday === 0 || weekday === 6) weekendCount++;
      datedCount++;

      let day = perDay.get(dateStr);
      if (!day) {
        day = { count: 0, folders: new Map() };
        perDay.set(dateStr, day);
      }
      day.count++;
      const primaryFolder = e.folderPaths[0] ?? "(无文件夹)";
      day.folders.set(primaryFolder, (day.folders.get(primaryFolder) ?? 0) + 1);

      let yr = perYear.get(yearStr);
      if (!yr) {
        yr = { total: 0, domains: new Map(), folders: new Map() };
        perYear.set(yearStr, yr);
      }
      yr.total++;
      yr.domains.set(e.domain, (yr.domains.get(e.domain) ?? 0) + 1);
      yr.folders.set(primaryFolder, (yr.folders.get(primaryFolder) ?? 0) + 1);
    }
  }

  const iso = (ts: number) =>
    Number.isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : null;

  // 节律
  const topHours = hourHist
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const peakHour = topHours[0]?.hour ?? 0;
  const rhythm: Overview["rhythm"] = {
    topHours,
    hourBucket: bucketHour(peakHour),
    weekendShare: datedCount > 0 ? weekendCount / datedCount : 0,
    datedCount,
  };

  // 狂囤日 top 3（单日 ≥ 3 条才算「囤」）
  const bingeDays = [...perDay.entries()]
    .map(([date, v]) => {
      let topFolder = "";
      let topN = 0;
      for (const [f, n] of v.folders) {
        if (n > topN) {
          topN = n;
          topFolder = f;
        }
      }
      return { date, count: v.count, topFolder };
    })
    .filter((d) => d.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 身份相位（按年；只保留 ≥ 3 条的年份；最多 4 个）
  const identityPhases: Overview["identityPhases"] = [...perYear.entries()]
    .filter(([, v]) => v.total >= 3)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
    .map(([period, v]) => ({
      period,
      total: v.total,
      topDomains: [...v.domains.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([d]) => d),
      topFolders: [...v.folders.entries()]
        .filter(([f]) => f !== "(无文件夹)")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([f]) => f),
    }));

  // 集中度（域名 count 分布的 Gini + top5 占比）
  const domainCountsArr = [...domainCounts.values()];
  const g = gini(domainCountsArr);
  const sortedDomainCounts = [...domainCountsArr].sort((a, b) => b - a);
  const top5 = sortedDomainCounts.slice(0, 5).reduce((s, n) => s + n, 0);
  const total = entries.length;
  const concentration: Overview["concentration"] = {
    gini: Number(g.toFixed(3)),
    top5Share: total > 0 ? Number((top5 / total).toFixed(3)) : 0,
    label: gridLabel(g),
  };

  // 文件夹健康
  const realFolders = [...folderCounts.entries()].filter(
    ([p]) => p !== "(无文件夹)"
  );
  const deadFolders = realFolders.filter(([, c]) => c === 1).length;
  const totalFolders = realFolders.length;
  const folderHealth: Overview["folderHealth"] = {
    totalFolders,
    deadFolders,
    deadFolderRatio:
      totalFolders > 0 ? Number((deadFolders / totalFolders).toFixed(3)) : 0,
    maxDepth,
    deepestPath,
    orphanShare: total > 0 ? Number((orphanCount / total).toFixed(3)) : 0,
  };

  return {
    total,
    domainHistogram: [...domainCounts.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
    dateRange: { from: iso(minTs), to: iso(maxTs) },
    folderTree: [...folderCounts.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40),
    rhythm,
    bingeDays,
    identityPhases,
    concentration,
    folderHealth,
  };
}

// get_overview()：本地计算，非 LLM 调用。spec: persona-agent「标准运行」。
import type { BookmarkEntry } from "@/lib/bookmarks/types";

export interface Overview {
  total: number;
  domainHistogram: { domain: string; count: number }[]; // top 域名
  dateRange: { from: string | null; to: string | null };
  folderTree: { path: string; count: number }[]; // 按出现次数排序
}

export function computeOverview(entries: BookmarkEntry[]): Overview {
  const domainCounts = new Map<string, number>();
  const folderCounts = new Map<string, number>();
  let minTs = Infinity;
  let maxTs = -Infinity;

  for (const e of entries) {
    domainCounts.set(e.domain, (domainCounts.get(e.domain) ?? 0) + 1);
    for (const f of e.folderPaths.length ? e.folderPaths : ["(无文件夹)"]) {
      folderCounts.set(f, (folderCounts.get(f) ?? 0) + 1);
    }
    if (e.addDate != null) {
      if (e.addDate < minTs) minTs = e.addDate;
      if (e.addDate > maxTs) maxTs = e.addDate;
    }
  }

  const iso = (ts: number) =>
    Number.isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : null;

  return {
    total: entries.length,
    domainHistogram: [...domainCounts.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
    dateRange: { from: iso(minTs), to: iso(maxTs) },
    folderTree: [...folderCounts.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40),
  };
}

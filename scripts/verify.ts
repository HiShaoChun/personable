// 纯函数级验证：测试夹具 + 逐条核对 spec 场景（不调用 LLM）。
// 运行：npm run test:fixtures
import {
  parseRawEntries,
  normalizeAndDedupe,
  looksLikeBookmarkExport,
} from "../src/lib/bookmarks/parse";
import { stratifiedSample } from "../src/lib/bookmarks/sample";
import { validateProfile, normalizeProfile } from "../src/lib/agent/schema";
import { computeOverview } from "../src/lib/agent/overview";
import type { BookmarkEntry } from "../src/lib/bookmarks/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`);
  }
}

// --- 夹具 ---
const SMALL = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
<DT><H3>技术</H3><DL><p>
  <DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1600000000">Hacker News</A>
  <DT><A HREF="https://github.com/" ADD_DATE="1600000001">GitHub</A>
</DL><p>
<DT><A HREF="https://www.bilibili.com/" ADD_DATE="1650000000">B站</A>
</DL>`;

const DUPE = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
<DT><H3>A</H3><DL><p><DT><A HREF="https://x.com/" ADD_DATE="1">X</A></DL><p>
<DT><H3>B</H3><DL><p><DT><A HREF="https://x.com/" ADD_DATE="2">X again</A></DL><p>
</DL>`;

const MALFORMED = `<html><body>just a normal page, not bookmarks</body></html>`;

const BROKEN_ENTRY = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
<DT><A HREF="ftp://nope">bad scheme</A>
<DT><A HREF="not a url">bad url</A>
<DT><A HREF="https://ok.com/">good</A>
</DL>`;

function bigExport(n: number): string {
  let s = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>`;
  for (let i = 0; i < n; i++) {
    const dom = ["a", "b", "c", "d", "e"][i % 5];
    const yr = 1500000000 + (i % 6) * 31000000;
    s += `<DT><A HREF="https://${dom}${i}.com/" ADD_DATE="${yr}">item ${i}</A>\n`;
  }
  return s + `</DL>`;
}

console.log("\n[bookmark-import] 客户端解析 / 去重 / 上限");
{
  check("有效 Chrome 导出被识别", looksLikeBookmarkExport(SMALL));
  check("非书签文件被拒识别", !looksLikeBookmarkExport(MALFORMED));

  const small = normalizeAndDedupe(parseRawEntries(SMALL));
  check("解析出 3 条", small.length === 3);
  check(
    "文件夹路径被记录",
    small.find((e) => e.domain === "github.com")?.folderPaths[0] === "技术"
  );
  check(
    "添加时间被解析",
    small.find((e) => e.domain === "github.com")?.addDate === 1600000001
  );

  const dup = normalizeAndDedupe(parseRawEntries(DUPE));
  check("跨文件夹重复 URL 合并为 1 条", dup.length === 1);
  check(
    "重复条目记录所有文件夹路径",
    dup[0].folderPaths.includes("A") && dup[0].folderPaths.includes("B")
  );

  const broken = normalizeAndDedupe(parseRawEntries(BROKEN_ENTRY));
  check(
    "非 http(s)/非法 URL 被剔除，不输出损坏条目",
    broken.length === 1 && broken[0].domain === "ok.com"
  );

  const big = normalizeAndDedupe(parseRawEntries(bigExport(2000)));
  const { sample, sampled } = stratifiedSample(big, 800);
  check("超上限触发下采样", sampled === true);
  check("下采样到 <= 上限", sample.length <= 800);
  check(
    "下采样保留多域名分布",
    new Set(sample.map((e) => e.domain.replace(/\d+/, ""))).size >= 5
  );
  const { sampled: s2 } = stratifiedSample(big.slice(0, 100), 800);
  check("未超上限不采样", s2 === false);
}

console.log("\n[persona-agent] overview 叙事素材");
{
  // UTC+8 下：2024-10-15 02:00 = 2024-10-14 18:00 UTC = 1728928800
  // 2024-10-15 03:00 局部 = 1728932400；同日 23:00 = 1728984000
  // 用一组真实化时间戳：同一天 4 条 + 周末 2 条 + 跨年 2 条
  const entries: BookmarkEntry[] = [
    // 2024-10-15（周二）UTC+8 凌晨 2/3 点 与 晚 22 点：触发 binge + 深夜节律
    { title: "PPT 1", url: "https://ppt.com/1", domain: "ppt.com", folderPaths: ["书签栏 / PPT"], addDate: 1728928800 },
    { title: "PPT 2", url: "https://ppt.com/2", domain: "ppt.com", folderPaths: ["书签栏 / PPT"], addDate: 1728932400 },
    { title: "PPT 3", url: "https://ppt.com/3", domain: "ppt.com", folderPaths: ["书签栏 / PPT"], addDate: 1728936000 },
    { title: "深夜杂", url: "https://x.com/1", domain: "x.com", folderPaths: ["书签栏 / PPT"], addDate: 1728981000 },
    // 2024-10-19（周六）：周末
    { title: "周末", url: "https://w.com/1", domain: "w.com", folderPaths: ["书签栏 / 闲"], addDate: 1729310400 },
    { title: "周末2", url: "https://w.com/2", domain: "w.com", folderPaths: ["书签栏 / 闲"], addDate: 1729314000 },
    // 2021 年：身份相位前段
    { title: "求职", url: "https://nowcoder.com/1", domain: "nowcoder.com", folderPaths: ["书签栏 / 求职"], addDate: 1640000000 },
    { title: "求职2", url: "https://nowcoder.com/2", domain: "nowcoder.com", folderPaths: ["书签栏 / 求职"], addDate: 1640100000 },
    { title: "求职3", url: "https://leetcode.com/1", domain: "leetcode.com", folderPaths: ["书签栏 / 求职"], addDate: 1640200000 },
    // 一个 dead folder 与 orphan
    { title: "孤儿", url: "https://orphan.com/1", domain: "orphan.com", folderPaths: [], addDate: 1729400000 },
    { title: "壮志未酬", url: "https://lonely.com/1", domain: "lonely.com", folderPaths: ["书签栏 / 一时兴起"], addDate: 1729500000 },
  ];
  const ov = computeOverview(entries);

  // 节律
  check("rhythm.datedCount 全计入", ov.rhythm.datedCount === 11);
  check("rhythm.hourBucket 深夜（峰值在 0-3 点）", ov.rhythm.hourBucket === "深夜");
  check(
    "rhythm.weekendShare 反映周末占比",
    ov.rhythm.weekendShare > 0 && ov.rhythm.weekendShare < 1
  );

  // 狂囤日
  check("bingeDays 至少识别出 2024-10-15", ov.bingeDays.length >= 1);
  check(
    "bingeDays.topFolder 指向当日主文件夹",
    ov.bingeDays[0].date === "2024-10-15" &&
      ov.bingeDays[0].count >= 3 &&
      ov.bingeDays[0].topFolder.includes("PPT")
  );

  // 身份相位
  check(
    "identityPhases 至少含 2021 与 2024 两个年",
    ov.identityPhases.length >= 2 &&
      ov.identityPhases.some((p) => p.period === "2021") &&
      ov.identityPhases.some((p) => p.period === "2024")
  );
  check(
    "identityPhases 2021 折射求职阶段",
    ov.identityPhases.find((p) => p.period === "2021")?.topFolders[0]?.includes("求职") === true
  );

  // 集中度（同一域名多次出现 → gini > 0）
  check("concentration.gini 数值落在 [0,1)", ov.concentration.gini >= 0 && ov.concentration.gini < 1);
  check("concentration.top5Share 落在 [0,1]", ov.concentration.top5Share >= 0 && ov.concentration.top5Share <= 1);
  check(
    "concentration.label 在三档之一",
    ["广撒网", "均衡", "死忠粉"].includes(ov.concentration.label)
  );

  // 文件夹健康
  check("folderHealth.totalFolders 计入真实文件夹", ov.folderHealth.totalFolders >= 3);
  check("folderHealth.deadFolders 识别出『一时兴起』那个孤本", ov.folderHealth.deadFolders >= 1);
  check("folderHealth.orphanShare 反映 1/11 无文件夹", ov.folderHealth.orphanShare > 0);
  check("folderHealth.maxDepth ≥ 2", ov.folderHealth.maxDepth >= 2);

  // 退化场景：所有 addDate 缺失，时间相关字段需安全降级
  const noDate: BookmarkEntry[] = [
    { title: "a", url: "https://a.com/", domain: "a.com", folderPaths: [], addDate: null },
    { title: "b", url: "https://b.com/", domain: "b.com", folderPaths: [], addDate: null },
  ];
  const ov2 = computeOverview(noDate);
  check("无 addDate 时 rhythm.datedCount 为 0", ov2.rhythm.datedCount === 0);
  check("无 addDate 时 bingeDays 为空", ov2.bingeDays.length === 0);
  check("无 addDate 时 identityPhases 为空", ov2.identityPhases.length === 0);
  check("无 addDate 时 dateRange 全 null", ov2.dateRange.from === null && ov2.dateRange.to === null);
}

console.log("\n[persona-agent] 画像 schema 校验");
{
  const good = normalizeProfile(
    {
      headline: "代码与猫的双修者",
      traits: ["技术控", "深夜冲浪", "效率执念"],
      clusters: [{ name: "技术", size: 40, blurb: "硬核", domains: ["github.com"] }],
      evolution: [{ period: "2020", summary: "前端入坑" }],
    },
    "earnest"
  );
  check("合格画像通过校验", validateProfile(good).ok);

  const badTraits = validateProfile({
    headline: "x",
    traits: ["only-one"],
    clusters: [{ name: "a", size: 1 }],
    evolution: [{ period: "p", summary: "s" }],
  });
  check("traits 数量不足被拒（应重生成）", !badTraits.ok);

  const noClusters = validateProfile({
    headline: "x",
    traits: ["a", "b", "c"],
    clusters: [],
    evolution: [{ period: "p", summary: "s" }],
  });
  check("无簇被拒", !noClusters.ok);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);

// 纯函数级验证：测试夹具 + 逐条核对 spec 场景（不调用 LLM）。
// 运行：npm run test:fixtures
import {
  parseRawEntries,
  normalizeAndDedupe,
  looksLikeBookmarkExport,
} from "../src/lib/bookmarks/parse";
import { stratifiedSample } from "../src/lib/bookmarks/sample";
import { validateProfile, normalizeProfile } from "../src/lib/agent/schema";

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

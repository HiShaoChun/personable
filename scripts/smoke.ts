// 真实端到端冒烟：用极小书签集跑完整 agent（聚类→合成）。
// 验证 DashScope 协议 / 模型 id 是否可用。
import { normalizeAndDedupe, parseRawEntries } from "../src/lib/bookmarks/parse";
import { runAgent } from "../src/lib/agent/loop";

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
<DT><H3>编程</H3><DL><p>
 <DT><A HREF="https://github.com/vercel/next.js" ADD_DATE="1600000000">Next.js</A>
 <DT><A HREF="https://news.ycombinator.com/" ADD_DATE="1600500000">Hacker News</A>
 <DT><A HREF="https://stackoverflow.com/" ADD_DATE="1601000000">Stack Overflow</A>
</DL><p>
<DT><H3>摄影</H3><DL><p>
 <DT><A HREF="https://www.fujifilm-x.com/" ADD_DATE="1650000000">Fujifilm X</A>
 <DT><A HREF="https://500px.com/" ADD_DATE="1655000000">500px</A>
</DL><p>
<DT><H3>做饭</H3><DL><p>
 <DT><A HREF="https://www.xiachufang.com/" ADD_DATE="1670000000">下厨房</A>
</DL><p>
</DL>`;

(async () => {
  const entries = normalizeAndDedupe(parseRawEntries(SAMPLE));
  console.log(`解析到 ${entries.length} 条书签，开始跑 agent…`);
  const t = Date.now();
  const at = () => `${((Date.now() - t) / 1000).toFixed(1)}s`;
  try {
    // 打印渐进式进度：概览/簇应远早于最终完成到达（tasks 5.6/6.4 的验证）
    const { profile } = await runAgent(entries, "earnest", (p) => {
      if (p.phase === "overview")
        console.log(`  [${at()}] 概览到达：${p.overview.total} 条`);
      else if (p.phase === "clusters")
        console.log(
          `  [${at()}] 簇到达：${p.clusters.map((c) => c.name).join(", ")}，开始合成…`
        );
    });
    console.log(`\n✓ 成功（最终 ${at()}）\n`);
    console.log("标题:", profile.headline);
    console.log("特质:", profile.traits.join(" / "));
    console.log(
      "兴趣簇:",
      profile.clusters.map((c) => `${c.name}(${c.size})`).join(", ")
    );
    console.log("演变:", profile.evolution.map((e) => e.period).join(" → "));
    process.exit(0);
  } catch (e) {
    console.error("\n✗ 失败:", (e as Error).message);
    process.exit(1);
  }
})();

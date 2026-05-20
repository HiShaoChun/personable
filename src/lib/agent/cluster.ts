// 一次性 LLM 聚类（triage 模型）。spec: persona-agent「标准运行」。
import type { BookmarkEntry } from "@/lib/bookmarks/types";
import type { Overview } from "./overview";
import { config } from "@/config";
import { client, makeThinkingSplitter, parseJson, TokenBudget } from "./llm";

export interface ClusterResult {
  clusters: {
    name: string;
    memberIndices: number[];
    domains: string[];
    note: string;
  }[];
  personaSketch: string; // 初版人格草图
}

function compactList(entries: BookmarkEntry[]): string {
  return entries
    .map(
      (e, i) =>
        `${i}\t${e.title.slice(0, 80)}\t${e.domain}\t${e.folderPaths[0] ?? ""}`
    )
    .join("\n");
}

export async function clusterBookmarks(
  entries: BookmarkEntry[],
  overview: Overview,
  budget: TokenBudget,
  onThinking?: (delta: string) => void
): Promise<ClusterResult> {
  budget.assert();
  // 让模型先用 1-2 句中文点评观察到的模式，再从新一行开始输出 JSON。
  // 前者实时展示给用户，让"AI 聚类你的兴趣"这一步可见地推进，掩盖时延；
  // 后者是机器解析对象。放弃 response_format=json_object（与自然语言前缀冲突），
  // 由 parseJson 的容错（剥 fence / 截 {...}）兜底。
  const sys =
    "你是兴趣聚类分析器。依据书签的标题、域名、用户自建文件夹，把它们归成 5-12 个有意义的兴趣簇。" +
    "文件夹名是用户自己写的强标签，优先采信。" +
    "先用 1-2 句中文自然语言简短描述你在这批书签中观察到的兴趣模式（这段会实时展示给用户），" +
    "然后从新的一行开始严格输出 JSON，且只输出一个 JSON 对象。";
  const user = `概览：共 ${overview.total} 条，时间 ${overview.dateRange.from ?? "?"} ~ ${
    overview.dateRange.to ?? "?"
  }。
书签列表（索引\\t标题\\t域名\\t文件夹）：
${compactList(entries)}

输出 JSON：{"clusters":[{"name":"簇名","memberIndices":[..],"domains":["代表域名"],"note":"这个簇说明用户什么"}],"personaSketch":"两三句初版人格画像"}`;

  const t0 = Date.now();
  console.error(`[timing] cluster start model=${config.modelTriage}`);
  const stream = await client().chat.completions.create({
    model: config.modelTriage,
    max_tokens: 3000,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  // 流式累积：边界由 makeThinkingSplitter 划定（首个 `{` 或 ``` 之前为 thinking）。
  const splitter = makeThinkingSplitter();
  let ttftMs: number | null = null;
  let usage:
    | { prompt_tokens?: number; completion_tokens?: number }
    | null = null;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      if (ttftMs == null) {
        ttftMs = Date.now() - t0;
        console.error(`[timing] cluster ttft=${ttftMs}ms`);
      }
      const emit = splitter.push(delta);
      if (emit && onThinking) onThinking(emit);
    }
    if (chunk.usage) usage = chunk.usage;
  }
  const buf = splitter.buf;
  budget.add(usage);
  const totalS = ((Date.now() - t0) / 1000).toFixed(1);
  console.error(
    `[timing] cluster done total=${totalS}s in=${usage?.prompt_tokens ?? "?"} out=${usage?.completion_tokens ?? "?"}`
  );

  const parsed = parseJson<ClusterResult>(buf);
  parsed.clusters = (parsed.clusters ?? []).filter(
    (c) => c && c.name && Array.isArray(c.memberIndices)
  );
  return parsed;
}

// 一次性 LLM 聚类（triage 模型）。spec: persona-agent「标准运行」。
import type { BookmarkEntry } from "@/lib/bookmarks/types";
import type { Overview } from "./overview";
import { config } from "@/config";
import { client, parseJson, TokenBudget } from "./llm";

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
  budget: TokenBudget
): Promise<ClusterResult> {
  budget.assert();
  const sys =
    "你是兴趣聚类分析器。依据书签的标题、域名、用户自建文件夹，把它们归成 5-12 个有意义的兴趣簇。" +
    "文件夹名是用户自己写的强标签，优先采信。只输出 JSON。";
  const user = `概览：共 ${overview.total} 条，时间 ${overview.dateRange.from ?? "?"} ~ ${
    overview.dateRange.to ?? "?"
  }。
书签列表（索引\\t标题\\t域名\\t文件夹）：
${compactList(entries)}

输出 JSON：{"clusters":[{"name":"簇名","memberIndices":[..],"domains":["代表域名"],"note":"这个簇说明用户什么"}],"personaSketch":"两三句初版人格画像"}`;

  const res = await client().chat.completions.create({
    model: config.modelTriage,
    max_tokens: 3000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });
  budget.add(res.usage);
  const parsed = parseJson<ClusterResult>(
    res.choices[0]?.message?.content ?? ""
  );
  parsed.clusters = (parsed.clusters ?? []).filter(
    (c) => c && c.name && Array.isArray(c.memberIndices)
  );
  return parsed;
}

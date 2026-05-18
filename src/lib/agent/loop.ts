// 多步 agent 循环：概览(本地) → 一次性聚类 → agent 自主决定深挖哪些簇并按需
// fetch_page → 合成。所有边界硬性兜底；抓取失败优雅降级。
// OpenAI function-calling 协议（DashScope 兼容模式）。
// spec: persona-agent「多步 agent 流水线」「自主且有界的深挖」。
import type OpenAI from "openai";
import { config, type Vibe } from "@/config";
import type { BookmarkEntry } from "@/lib/bookmarks/types";
import { computeOverview } from "./overview";
import { clusterBookmarks } from "./cluster";
import { fetchPage } from "./fetchPage";
import { synthesize, type AgentState } from "./synthesize";
import { client, TokenBudget } from "./llm";
import type { PersonaProfile } from "./schema";

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "fetch_page",
      description:
        "抓取某个代表性书签 URL 的正文，用于厘清含糊的簇。仅在确有必要时调用。",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish_deepdive",
      description: "深挖完成，给出每个被深挖簇的要点，进入最终合成。",
      parameters: {
        type: "object",
        properties: { notes: { type: "array", items: { type: "string" } } },
        required: ["notes"],
      },
    },
  },
];

export interface RunResult {
  profile: PersonaProfile;
  state: AgentState; // 缓存，供按风格重合成复用
}

export async function runAgent(
  entries: BookmarkEntry[],
  vibe: Vibe
): Promise<RunResult> {
  const startedAt = Date.now();
  const budget = new TokenBudget();
  const timeLeft = () => config.maxWallClockMs - (Date.now() - startedAt);

  const T = (label: string, since: number) =>
    console.error(`[timing] ${label}: ${((Date.now() - since) / 1000).toFixed(1)}s`);

  // 步骤 1：本地概览（非 LLM）
  const overview = computeOverview(entries);

  // 步骤 2：一次性 LLM 聚类
  let t = Date.now();
  const clusters = await clusterBookmarks(entries, overview, budget);
  T("cluster", t);

  // 步骤 3：agent 自主深挖（有界）
  const fetchedNotes: string[] = [];
  let fetches = 0;
  const sys =
    "你是人格分析 agent。已有书签概览和初步兴趣簇。请判断哪些簇含糊或对刻画此人最关键，" +
    `最多可对代表性 URL 调用 fetch_page ${config.maxPageFetches} 次（也可以一次都不调）。` +
    "完成后调用 finish_deepdive 给出要点。抓取失败很正常，不要纠缠，可继续或直接收尾。";
  const clusterBrief = clusters.clusters
    .map(
      (c) =>
        `【${c.name}】${c.memberIndices.length}条 域名:${c.domains
          .slice(0, 4)
          .join(",")} — ${c.note}`
    )
    .join("\n");

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: sys },
    {
      role: "user",
      content: `概览:${overview.total}条, ${overview.dateRange.from}~${overview.dateRange.to}\n簇:\n${clusterBrief}\n\n开始你的深挖决策。`,
    },
  ];

  t = Date.now();
  let iters = 0;
  for (let iter = 0; iter < config.maxAgentIterations; iter++) {
    iters++;
    if (budget.exceeded || timeLeft() < 5000) break; // 边界兜底
    const res = await client().chat.completions.create({
      model: config.modelTriage,
      max_tokens: 1200,
      tools: TOOLS,
      messages,
    });
    budget.add(res.usage);
    const choice = res.choices[0]?.message;
    if (!choice) break;
    messages.push(choice);

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) break; // 模型不再用工具

    let finished = false;
    for (const tc of toolCalls) {
      if (tc.type !== "function") continue;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }

      if (tc.function.name === "finish_deepdive") {
        const notes = Array.isArray(args.notes) ? args.notes : [];
        fetchedNotes.push(...notes.map(String));
        finished = true;
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "ok",
        });
      } else if (tc.function.name === "fetch_page") {
        if (fetches >= config.maxPageFetches) {
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: "已达抓取上限，请 finish_deepdive。",
          });
          continue;
        }
        fetches++;
        const url = typeof args.url === "string" ? args.url : "";
        const r = await fetchPage(url); // 失败不抛，优雅降级
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: r.ok
            ? `正文摘要：${r.text?.slice(0, 1500)}`
            : `抓取失败(${r.error})，请基于已有信息继续。`,
        });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: "未知工具",
        });
      }
    }
    if (finished) break;
  }

  T(`deepdive(iters=${iters},fetches=${fetches})`, t);

  // 步骤 4：合成（即便 fetchedNotes 为空也能产出——优雅降级）
  const state: AgentState = { overview, clusters, fetchedNotes };
  t = Date.now();
  const profile = await synthesize(state, vibe, budget);
  T("synthesize", t);
  return { profile, state };
}

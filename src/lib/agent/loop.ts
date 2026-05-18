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

// 渐进式进度事件：让 route 在 agent 推进时就把概览/簇先流式给前端，
// 掩盖深挖+合成的时延（design D3 风险缓解 / tasks 5.6）。
// deepdive_thinking / deepdive_fetch 让"agent 自主深挖"这一步可见地推进——
// 模型推理文本打字机式吐出，抓取过程以 chip 状态机呈现。
export type Progress =
  | { phase: "overview"; overview: AgentState["overview"] }
  | {
      phase: "clusters";
      clusters: { name: string; size: number; domains: string[] }[];
      personaSketch: string;
    }
  | { phase: "deepdive_thinking"; delta: string }
  | { phase: "deepdive_fetch"; url: string; status: "start" | "ok" | "fail" }
  | { phase: "deepdive"; fetches: number };

export async function runAgent(
  entries: BookmarkEntry[],
  vibe: Vibe,
  onProgress?: (p: Progress) => void
): Promise<RunResult> {
  const startedAt = Date.now();
  const budget = new TokenBudget();
  const timeLeft = () => config.maxWallClockMs - (Date.now() - startedAt);

  const T = (label: string, since: number) =>
    console.error(`[timing] ${label}: ${((Date.now() - since) / 1000).toFixed(1)}s`);

  // 步骤 1：本地概览（非 LLM）——立即可发，零时延
  const overview = computeOverview(entries);
  onProgress?.({ phase: "overview", overview });

  // 步骤 2：一次性 LLM 聚类
  let t = Date.now();
  const clusters = await clusterBookmarks(entries, overview, budget);
  T("cluster", t);
  onProgress?.({
    phase: "clusters",
    clusters: clusters.clusters.map((c) => ({
      name: c.name,
      size: c.memberIndices.length,
      domains: c.domains.slice(0, 4),
    })),
    personaSketch: clusters.personaSketch,
  });

  // 步骤 3：agent 自主深挖（有界）
  // 关键优化：(1) LLM 调用走流式，content 增量打字机式回推前端；
  //          (2) 同一轮内多个 fetch_page 工具调用并行执行（Promise.all）；
  //          (3) prompt 明确鼓励"一次性批量列出要抓的 URL"，否则模型默认一次一个，
  //              并行就没机会发挥。
  const fetchedNotes: string[] = [];
  let fetches = 0;
  const sys =
    "你是人格分析 agent。已有书签概览和初步兴趣簇。请判断哪些簇含糊或对刻画此人最关键。" +
    "在调用工具前，先用一两句自然语言说明你打算深挖哪些簇、为什么——这些文字会实时展示给用户。" +
    `如需深挖，请在同一轮一次性返回所有 fetch_page 工具调用（最多 ${config.maxPageFetches} 次），` +
    "它们会并行抓取；不要一次只发一个工具调用再等结果。" +
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

    // 流式调用：累积 content 文本 + 跨 chunk 拼回 tool_calls。
    // DashScope 兼容协议下，tool_calls 分片到达，按 delta.index 累加 arguments。
    const stream = await client().chat.completions.create({
      model: config.modelTriage,
      max_tokens: 1200,
      tools: TOOLS,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    });

    let content = "";
    const toolAcc: Record<
      number,
      { id?: string; name?: string; arguments: string }
    > = {};
    let usage:
      | { prompt_tokens?: number; completion_tokens?: number }
      | null = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onProgress?.({ phase: "deepdive_thinking", delta: delta.content });
      }
      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index ?? 0;
          const slot = (toolAcc[idx] ??= { arguments: "" });
          if (tcDelta.id) slot.id = tcDelta.id;
          if (tcDelta.function?.name) slot.name = tcDelta.function.name;
          if (tcDelta.function?.arguments)
            slot.arguments += tcDelta.function.arguments;
        }
      }
      if (chunk.usage) usage = chunk.usage;
    }
    budget.add(usage);

    const toolCalls = Object.entries(toolAcc)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, v]) => v)
      .filter((v) => v.id && v.name);

    if (toolCalls.length === 0) break; // 模型不再用工具

    // 把这一轮的 assistant 消息塞回去（OpenAI 协议要求 tool 消息前必须有对应的 assistant.tool_calls）
    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map((v) => ({
        id: v.id!,
        type: "function" as const,
        function: { name: v.name!, arguments: v.arguments },
      })),
    });

    // 分流：finish 终止；fetch 批量并行；其它兜底
    let finished = false;
    type FetchTask = {
      tcId: string;
      url: string;
      accepted: boolean;
    };
    const fetchTasks: FetchTask[] = [];

    for (const tc of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.arguments || "{}");
      } catch {
        args = {};
      }
      if (tc.name === "finish_deepdive") {
        const notes = Array.isArray(args.notes) ? args.notes : [];
        fetchedNotes.push(...notes.map(String));
        finished = true;
        messages.push({
          role: "tool",
          tool_call_id: tc.id!,
          content: "ok",
        });
      } else if (tc.name === "fetch_page") {
        // 预扣额度：保证并行启动前不超上限；多余的直接拒绝
        const url = typeof args.url === "string" ? args.url : "";
        const accepted = fetches < config.maxPageFetches;
        if (accepted) fetches++;
        fetchTasks.push({ tcId: tc.id!, url, accepted });
      } else {
        messages.push({
          role: "tool",
          tool_call_id: tc.id!,
          content: "未知工具",
        });
      }
    }

    // 并行执行所有被接受的 fetch；按原 tool_call 顺序追加 tool 消息
    if (fetchTasks.length > 0) {
      const results = await Promise.all(
        fetchTasks.map(async (task) => {
          if (!task.accepted) {
            return { task, content: "已达抓取上限，请 finish_deepdive。" };
          }
          onProgress?.({
            phase: "deepdive_fetch",
            url: task.url,
            status: "start",
          });
          const r = await fetchPage(task.url);
          onProgress?.({
            phase: "deepdive_fetch",
            url: task.url,
            status: r.ok ? "ok" : "fail",
          });
          return {
            task,
            content: r.ok
              ? `正文摘要：${r.text?.slice(0, 1500)}`
              : `抓取失败(${r.error})，请基于已有信息继续。`,
          };
        })
      );
      for (const { task, content: c } of results) {
        messages.push({ role: "tool", tool_call_id: task.tcId, content: c });
      }
    }

    if (finished) break;
  }

  T(`deepdive(iters=${iters},fetches=${fetches})`, t);
  onProgress?.({ phase: "deepdive", fetches });

  // 步骤 4：合成（即便 fetchedNotes 为空也能产出——优雅降级）
  const state: AgentState = { overview, clusters, fetchedNotes };
  t = Date.now();
  const profile = await synthesize(state, vibe, budget);
  T("synthesize", t);
  return { profile, state };
}

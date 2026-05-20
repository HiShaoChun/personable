// agent 流水线：概览(本地) → 一次性聚类 → 合成。所有边界硬性兜底。
// spec: persona-agent「多步 agent 流水线」「标准运行」。
import type { Vibe } from "@/config";
import type { BookmarkEntry } from "@/lib/bookmarks/types";
import { computeOverview } from "./overview";
import { clusterBookmarks } from "./cluster";
import { synthesize, type AgentState } from "./synthesize";
import { TokenBudget } from "./llm";
import type { PersonaProfile } from "./schema";

export interface RunResult {
  profile: PersonaProfile;
  state: AgentState; // 缓存，供按风格重合成复用
}

// 渐进式进度事件：让 route 在 agent 推进时就把概览/簇先流式给前端，
// 掩盖合成时延（design D3 风险缓解 / tasks 5.6）。
export type Progress =
  | { phase: "overview"; overview: AgentState["overview"] }
  | { phase: "cluster_thinking"; delta: string }
  | {
      phase: "clusters";
      clusters: { name: string; size: number; domains: string[] }[];
      personaSketch: string;
    }
  | { phase: "synth_thinking"; delta: string };

export async function runAgent(
  entries: BookmarkEntry[],
  vibe: Vibe,
  onProgress?: (p: Progress) => void
): Promise<RunResult> {
  const budget = new TokenBudget();

  const T = (label: string, since: number) =>
    console.error(`[timing] ${label}: ${((Date.now() - since) / 1000).toFixed(1)}s`);

  // 步骤 1：本地概览（非 LLM）——立即可发，零时延
  const overview = computeOverview(entries);
  onProgress?.({ phase: "overview", overview });

  // 步骤 2：一次性 LLM 聚类（流式：先吐自然语言点评，再吐 JSON）
  let t = Date.now();
  const clusters = await clusterBookmarks(entries, overview, budget, (delta) =>
    onProgress?.({ phase: "cluster_thinking", delta })
  );
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

  // 步骤 3：合成（流式：先吐 vibe 语气下的合成思路，再吐 JSON）
  const state: AgentState = { overview, clusters };
  t = Date.now();
  const profile = await synthesize(state, vibe, budget, (delta) =>
    onProgress?.({ phase: "synth_thinking", delta })
  );
  T("synthesize", t);
  return { profile, state };
}

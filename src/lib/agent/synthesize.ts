// finalize_profile 合成（Sonnet）+ 按风格重合成。
// spec: persona-agent「结构化画像输出」「按风格重合成且不重跑深挖」。
import { config, type Vibe } from "@/config";
import { client, parseJson, TokenBudget } from "./llm";
import type { ClusterResult } from "./cluster";
import type { Overview } from "./overview";
import {
  normalizeProfile,
  validateProfile,
  type PersonaProfile,
} from "./schema";

// 已算好的 agent 状态——重合成时复用，不重跑深挖。
export interface AgentState {
  overview: Overview;
  clusters: ClusterResult;
  fetchedNotes: string[]; // 深挖阶段抓到的代表性网页摘要
}

const VIBE_PROMPT: Record<Vibe, string> = {
  earnest: "语气真诚、温暖、有洞察力，像一个懂你的朋友。",
  roast: "语气毒舌、犀利、好笑，但不人身攻击、不冒犯弱势群体，吐槽点到为止。",
  poetic: "语气诗意、意象化，用比喻把兴趣写成一幅画。",
};

const SAFETY =
  "禁止：泄露或推断敏感隐私（健康、性取向、政治、宗教、财务）、羞辱性内容、对受保护群体的负面刻画。" +
  "若书签暗示敏感话题，仅做中性、克制的概括。";

function buildPrompt(state: AgentState, vibe: Vibe): string {
  const clusterLines = state.clusters.clusters
    .map((c) => `- ${c.name}（${c.memberIndices.length} 条）：${c.note}`)
    .join("\n");
  return `用户互联网人格画像素材：
概览：${state.overview.total} 条书签，时间 ${state.overview.dateRange.from ?? "?"} ~ ${
    state.overview.dateRange.to ?? "?"
  }
兴趣簇：
${clusterLines}
初版草图：${state.clusters.personaSketch}
深挖网页要点：${state.fetchedNotes.join(" | ") || "（无）"}

产出最终人格卡 JSON：
{"headline":"一句话大标题","traits":["3到7条人格特质"],"clusters":[{"name":"簇名","size":数字,"blurb":"一句话","domains":["域名"]}],"evolution":[{"period":"时间段","summary":"那段时间的兴趣"}]}
只输出 JSON。`;
}

/** 合成画像；最多重试 2 次以满足 schema。spec：无效/不安全则重生成而非返回。 */
export async function synthesize(
  state: AgentState,
  vibe: Vibe,
  budget: TokenBudget
): Promise<PersonaProfile> {
  const sys =
    `你在生成一张“互联网人格卡”。${VIBE_PROMPT[vibe]} ${SAFETY} 严格只输出 JSON。`;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = Date.now();
    budget.assert();
    const res = await client().chat.completions.create({
      model: config.modelSynthesis,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content:
            buildPrompt(state, vibe) +
            (lastErr ? `\n上次输出不合格：${lastErr}，请修正。` : ""),
        },
      ],
    });
    budget.add(res.usage);
    try {
      const raw = parseJson(res.choices[0]?.message?.content ?? "");
      const profile = normalizeProfile(raw, vibe);
      const v = validateProfile(profile);
      console.error(
        `[timing] synth attempt#${attempt + 1}: ${((Date.now() - at) / 1000).toFixed(1)}s ok=${v.ok}`
      );
      if (v.ok) return profile;
      lastErr = v.errors.join("；");
    } catch (e) {
      console.error(
        `[timing] synth attempt#${attempt + 1}: ${((Date.now() - at) / 1000).toFixed(1)}s parse-fail`
      );
      lastErr = `JSON 解析失败：${(e as Error).message}`;
    }
  }
  throw new Error(`画像合成多次不合格：${lastErr}`);
}

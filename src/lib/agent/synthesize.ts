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

注意：cluster.name 必须从上述聚类阶段的分类描述重写为带动词暗示 / 反差感的人物剪影式短句，贴合当前语气；size 保持输入数值不变，不许新增或删除 cluster。
好例：「讯飞教育产线研发文档」→「教育产线的隐形调度员」
好例：「韩剧动漫与休闲娱乐」→「韩剧也是节奏训练」
坏例：「AI 灵魂工匠」「梦想筑造师」（空泛、无具体所指、中二造词）

产出最终人格卡 JSON：
{"headline":"一句话大标题","traits":["3-5个标签词（每条≤8字、纯名词短语、禁止冒号与解释）"],"clusters":[{"name":"簇名","size":数字,"domains":["域名"]}],"evolution":[{"period":"时间段","summary":"那段时间的兴趣"}]}
只输出 JSON。`;
}

/** 合成画像；最多重试 2 次以满足 schema。spec：无效/不安全则重生成而非返回。
 *  onThinking 可选：流式回推 JSON 之前的自然语言点评（与 vibe 同语气），
 *  让"合成人格 → 生成可分享卡片"这一步可见地推进。regenerate 走非流式路径，
 *  不传该回调即可保持向后兼容。 */
export async function synthesize(
  state: AgentState,
  vibe: Vibe,
  budget: TokenBudget,
  onThinking?: (delta: string) => void
): Promise<PersonaProfile> {
  // 用 onThinking 时让模型先吐一段实质性的"合成思路"（不止点评，要讲清楚卡片
  // 怎么搭出来的），再吐 JSON；不用时（regenerate 等非流式入口）保持原本
  // "只输出 JSON + response_format=json_object"的更稳形态。
  const streaming = !!onThinking;
  const sys = streaming
    ? `你在生成一张"互联网人格卡"。${VIBE_PROMPT[vibe]} ${SAFETY} ` +
      "在输出 JSON 之前，先用一段连贯的自然语言（4-7 句，约 100-220 字）" +
      "以你将要采用的语气讲清楚你的合成思路——这段会实时展示给用户：" +
      "你怎么读这个人；准备起一个什么样的大标题、为什么；挑哪些特质、又因为什么" +
      "舍掉了哪些；兴趣演变的时间线为什么这么切。点名具体的簇或域名，不要写成" +
      "项目符号或小标题，写成一气呵成的口语化段落，避免空话。" +
      "之后另起一行，严格只输出一个 JSON 对象，不要在 JSON 里再夹任何说明文字。"
    : `你在生成一张"互联网人格卡"。${VIBE_PROMPT[vibe]} ${SAFETY} 严格只输出 JSON。`;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = Date.now();
    budget.assert();
    const messages = [
      { role: "system" as const, content: sys },
      {
        role: "user" as const,
        content:
          buildPrompt(state, vibe) +
          (lastErr ? `\n上次输出不合格：${lastErr}，请修正。` : ""),
      },
    ];

    let raw = "";
    let usage:
      | { prompt_tokens?: number; completion_tokens?: number }
      | null = null;

    console.error(
      `[timing] synth attempt#${attempt + 1} start model=${config.modelSynthesis} streaming=${streaming}`
    );
    if (streaming) {
      const stream = await client().chat.completions.create({
        model: config.modelSynthesis,
        max_tokens: 2000,
        stream: true,
        stream_options: { include_usage: true },
        messages,
      });
      // 与 cluster 相同的"`{` 前为 thinking，之后为 JSON"切分逻辑。
      // 重试时（attempt>0）不再回推 thinking——避免重复刷屏，用户已经看过一遍。
      let buf = "";
      let jsonStarted = false;
      let ttftMs: number | null = null;
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          if (ttftMs == null) {
            ttftMs = Date.now() - at;
            console.error(
              `[timing] synth attempt#${attempt + 1} ttft=${ttftMs}ms`
            );
          }
          const prevLen = buf.length;
          buf += delta;
          if (!jsonStarted && attempt === 0) {
            const idx = buf.indexOf("{");
            if (idx >= 0) {
              const thinkingTail = Math.max(0, idx - prevLen);
              if (thinkingTail > 0) onThinking!(delta.slice(0, thinkingTail));
              jsonStarted = true;
            } else {
              onThinking!(delta);
            }
          } else if (!jsonStarted && buf.indexOf("{") >= 0) {
            jsonStarted = true;
          }
        }
        if (chunk.usage) usage = chunk.usage;
      }
      raw = buf;
    } else {
      const res = await client().chat.completions.create({
        model: config.modelSynthesis,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages,
      });
      usage = res.usage ?? null;
      raw = res.choices[0]?.message?.content ?? "";
    }
    budget.add(usage);

    try {
      const parsed = parseJson(raw);
      const profile = normalizeProfile(parsed, vibe);
      const v = validateProfile(profile);
      console.error(
        `[timing] synth attempt#${attempt + 1} done total=${((Date.now() - at) / 1000).toFixed(1)}s ok=${v.ok} in=${usage?.prompt_tokens ?? "?"} out=${usage?.completion_tokens ?? "?"}`
      );
      if (v.ok) return profile;
      lastErr = v.errors.join("；");
    } catch (e) {
      console.error(
        `[timing] synth attempt#${attempt + 1} done total=${((Date.now() - at) / 1000).toFixed(1)}s parse-fail in=${usage?.prompt_tokens ?? "?"} out=${usage?.completion_tokens ?? "?"}`
      );
      lastErr = `JSON 解析失败：${(e as Error).message}`;
    }
  }
  throw new Error(`画像合成多次不合格：${lastErr}`);
}

// LLM 客户端封装（OpenAI 兼容协议；指向阿里云 DashScope compatible-mode）。
// + 单次运行 token 计量（强制 PER_RUN_MAX_TOKENS）。
import OpenAI from "openai";
import { config } from "@/config";

let _client: OpenAI | null = null;
export function client(): OpenAI {
  if (!config.llmApiKey)
    throw new Error("缺少 LLM_API_KEY（仅服务端）");
  if (!_client)
    _client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl, // .../compatible-mode/v1
    });
  return _client;
}

// 一次 agent 运行内的 token 预算计量器。
export class TokenBudget {
  used = 0;
  constructor(private max = config.perRunMaxTokens) {}
  add(usage?: { prompt_tokens?: number; completion_tokens?: number } | null) {
    if (!usage) return;
    this.used += (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  }
  get exceeded() {
    return this.used >= this.max;
  }
  assert() {
    if (this.exceeded)
      throw new Error(`单次运行 token 超上限（${this.used}/${this.max}）`);
  }
}

/** 流式切分"思考前缀 / JSON 主体"：边界取 `{` 与 ``` 中较早者。
 *  模型常违背"只输出 JSON"指令、用 ```json 围栏包住，此前只看 `{` 会让 ```json
 *  泄进展示给用户的思考流。末尾 1-2 个反引号要暂存，避免在 chunk 边界处先漏出。 */
export function makeThinkingSplitter() {
  let buf = "";
  let emittedLen = 0;
  let started = false;
  return {
    get jsonStarted() {
      return started;
    },
    get buf() {
      return buf;
    },
    push(delta: string): string {
      buf += delta;
      if (started) return "";
      const idxBrace = buf.indexOf("{");
      const idxFence = buf.indexOf("```");
      let boundary = -1;
      if (idxBrace >= 0 && idxFence >= 0)
        boundary = Math.min(idxBrace, idxFence);
      else if (idxBrace >= 0) boundary = idxBrace;
      else if (idxFence >= 0) boundary = idxFence;
      if (boundary >= 0) {
        started = true;
        const out = buf.slice(emittedLen, boundary);
        emittedLen = boundary;
        return out;
      }
      const trail = buf.match(/`{1,2}$/);
      const holdback = trail ? trail[0].length : 0;
      const upTo = buf.length - holdback;
      if (upTo > emittedLen) {
        const out = buf.slice(emittedLen, upTo);
        emittedLen = upTo;
        return out;
      }
      return "";
    },
  };
}

/** 容错解析模型返回的 JSON（剥 ```json 围栏、取首个 {...}、修复中文模型常见瑕疵）。 */
export function parseJson<T = Record<string, unknown>>(s: string): T {
  let t = (s ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    return JSON.parse(t) as T;
  } catch (firstErr) {
    // 常见瑕疵：全角标点 `，:`、智能引号 `“”‘’`、`}`/`]` 前残留逗号。
    // 这些字符即便出现在字符串内部也不影响 JSON 语义，全局替换是安全的。
    const repaired = t
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\uFF0C/g, ",")
      .replace(/\uFF1A/g, ":")
      .replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(repaired) as T;
    } catch {
      throw firstErr;
    }
  }
}

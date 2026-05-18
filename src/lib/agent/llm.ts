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

/** 容错解析模型返回的 JSON（剥 ```json 围栏、取首个 {...}）。 */
export function parseJson<T = Record<string, unknown>>(s: string): T {
  let t = (s ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return JSON.parse(t) as T;
}

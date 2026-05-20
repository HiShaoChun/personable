// 配置单一来源：读取 .env，校验并给安全默认。所有限值集中在此（对应 .env.example）。
// 仅服务端使用——不要在客户端组件里 import。

function num(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function str(name: string, def: string): string {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? def : raw;
}

function bool(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  return raw === "true" || raw === "1";
}

export const config = {
  // LLM（OpenAI 兼容协议）。优先 LLM_API_KEY，回退到既有 ANTHROPIC_API_KEY 那行。
  llmApiKey:
    process.env.LLM_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "",
  // DashScope 兼容模式 base：注意结尾是 /compatible-mode/v1（SDK 自动拼 /chat/completions）
  llmBaseUrl: str(
    "LLM_BASE_URL",
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  ),
  agentEnabled: bool("AGENT_ENABLED", true),

  // 全局每日预算（熔断）
  dailyRunBudget: num("DAILY_RUN_BUDGET", 100),
  perRunMaxTokens: num("PER_RUN_MAX_TOKENS", 120_000),

  // 输入上限
  maxBookmarkEntries: num("MAX_BOOKMARK_ENTRIES", 800),
  maxRequestBytes: num("MAX_REQUEST_BYTES", 2_000_000),

  // agent 循环边界
  maxPageFetches: num("MAX_PAGE_FETCHES", 8),
  maxAgentIterations: num("MAX_AGENT_ITERATIONS", 24),
  maxWallClockMs: num("MAX_WALL_CLOCK_MS", 90_000),
  fetchTimeoutMs: num("FETCH_TIMEOUT_MS", 8_000),
  fetchMaxBytes: num("FETCH_MAX_BYTES", 1_500_000),

  // 模型（DashScope 通义千问）。单提供方，分流/合成默认同一模型，可分别覆盖。
  modelTriage: str("MODEL_TRIAGE", "qwen-turbo"),
  modelSynthesis: str("MODEL_SYNTHESIS", "qwen-plus"),

  // 限流
  rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MS", 600_000),
  rateLimitMax: num("RATE_LIMIT_MAX", 5),
  maxConcurrentRuns: num("MAX_CONCURRENT_RUNS", 3),

  // 分享卡存储
  cardTtlDays: num("CARD_TTL_DAYS", 7),
  storeDriver: str("STORE_DRIVER", "memory") as "memory" | "sqlite",
  storePath: str("STORE_PATH", "./data/cards.db"),
} as const;

export type AppConfig = typeof config;

// 风格定义在 client-safe 的 vibes.ts，这里 re-export 给服务端用。
export { VIBES, DEFAULT_VIBE, isVibe } from "@/lib/vibes";
export type { Vibe } from "@/lib/vibes";

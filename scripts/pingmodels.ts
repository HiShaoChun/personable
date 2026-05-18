// 用 1 token 的最小请求探测候选快模型 id 是否可用 + 单次往返耗时。
import OpenAI from "openai";

const c = new OpenAI({
  apiKey: process.env.LLM_API_KEY!,
  baseURL: process.env.LLM_BASE_URL!,
});

const candidates = [
  "qwen3.5-plus", // 当前合成模型（基线）
  "qwen3.5-flash",
  "qwen-turbo",
  "qwen-plus",
  "qwen-flash",
];

(async () => {
  for (const model of candidates) {
    const t = Date.now();
    try {
      const r = await c.chat.completions.create({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      console.log(
        `✓ ${model.padEnd(16)} ${((Date.now() - t) / 1000).toFixed(2)}s  ` +
          `(tok ${r.usage?.total_tokens ?? "?"})`
      );
    } catch (e) {
      const msg = (e as Error).message.slice(0, 90);
      console.log(`✗ ${model.padEnd(16)} ${msg}`);
    }
  }
  process.exit(0);
})();

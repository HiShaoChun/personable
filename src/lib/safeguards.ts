// 限流 + 并发上限 + 每日运行熔断。进程内实现（单 ECS 实例足够）。
// spec: api-safeguards「限流」「全局成本熔断」。
import { config } from "@/config";

// --- 按 IP 滑动窗口限流 ---
const hits = new Map<string, number[]>();
export function rateLimit(ip: string): { ok: boolean } {
  const now = Date.now();
  const win = config.rateLimitWindowMs;
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < win);
  if (arr.length >= config.rateLimitMax) {
    hits.set(ip, arr);
    return { ok: false };
  }
  arr.push(now);
  hits.set(ip, arr);
  return { ok: true };
}

// --- 全局并发运行上限 ---
let running = 0;
export function acquireRun(): boolean {
  if (running >= config.maxConcurrentRuns) return false;
  running++;
  return true;
}
export function releaseRun() {
  running = Math.max(0, running - 1);
}

// --- 每日运行熔断（按当天完成运行数计数，次日自动恢复）---
let day = new Date().toISOString().slice(0, 10);
let countToday = 0;
function rollDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    countToday = 0;
  }
}
/** 预算未耗尽返回 true；否则 false（调用方返回「临时暂停」）。 */
export function budgetAvailable(): boolean {
  rollDay();
  return countToday < config.dailyRunBudget;
}
export function recordRun() {
  rollDay();
  countToday++;
}
export function budgetStatus() {
  rollDay();
  return { used: countToday, limit: config.dailyRunBudget };
}

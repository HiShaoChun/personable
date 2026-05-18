// agent 端点。spec: persona-agent「凭据仅存服务端」+ api-safeguards 全部。
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { config, isVibe, DEFAULT_VIBE } from "@/config";
import type { BookmarkEntry } from "@/lib/bookmarks/types";
import { stratifiedSample } from "@/lib/bookmarks/sample";
import { runAgent, type Progress } from "@/lib/agent/loop";
import { putCard, putAgentState } from "@/lib/store";
import {
  rateLimit,
  acquireRun,
  releaseRun,
  budgetAvailable,
  recordRun,
} from "@/lib/safeguards";

export const runtime = "nodejs";
// 自托管 ECS（standalone Node）下 maxDuration 仅为提示，Node 不强制低超时。
// agent 整体可能 >120s，但响应是渐进式流：概览即时、簇数秒内到达，连接持续
// 有字节流动，前置代理不会因空闲而断（design D3 风险缓解 / tasks 5.6/6.4）。
export const maxDuration = 300;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // 特性开关 / 回滚
  if (!config.agentEnabled)
    return NextResponse.json(
      { error: "paused", message: "服务已暂停，请稍后再来。" },
      { status: 503 }
    );

  // 每日预算熔断
  if (!budgetAvailable())
    return NextResponse.json(
      { error: "budget", message: "今日体验名额已用完，明天再来吧～" },
      { status: 503 }
    );

  // 限流
  if (!rateLimit(clientIp(req)).ok)
    return NextResponse.json(
      { error: "rate_limited", message: "操作太频繁，请稍后再试。" },
      { status: 429 }
    );

  // 输入体积上限（LLM 调用前）
  const rawBody = await req.text();
  if (rawBody.length > config.maxRequestBytes)
    return NextResponse.json(
      { error: "too_large", message: `请求过大（上限 ${config.maxRequestBytes} 字节）。` },
      { status: 413 }
    );

  let body: { entries?: BookmarkEntry[]; vibe?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0)
    return NextResponse.json({ error: "no_entries" }, { status: 400 });
  const vibe = isVibe(body.vibe) ? body.vibe : DEFAULT_VIBE;

  // 服务端权威性地再强制条目上限（分层下采样）
  const { sample } = stratifiedSample(entries, config.maxBookmarkEntries);

  if (!acquireRun())
    return NextResponse.json(
      { error: "busy", message: "当前排队较多，请稍后再试。" },
      { status: 503 }
    );

  // 所有安全护栏均已在任何模型调用前以 JSON 错误拒绝（限流/熔断/体积/开关）。
  // 此后才进入渐进式 NDJSON 流：边算边发，掩盖深挖+合成时延。
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
      try {
        const onProgress = (p: Progress) => send(p);
        const { profile, state } = await runAgent(sample, vibe, onProgress);
        recordRun();
        const id = nanoid(12);
        const runId = nanoid(16);
        putCard(id, JSON.stringify(profile));
        putAgentState(runId, JSON.stringify(state));
        send({ phase: "done", id, runId, profile });
      } catch (e) {
        // 流已开始（HTTP 200），无法再改状态码——以流内事件报错，前端据此处理。
        send({ phase: "error", message: (e as Error).message });
      } finally {
        releaseRun();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no", // 关掉 nginx 缓冲，确保渐进可见
    },
  });
}

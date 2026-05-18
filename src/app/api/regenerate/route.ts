// 按风格重合成：复用缓存的 agent 状态，仅一次合成调用，不重跑深挖。
// spec: persona-agent「按风格重合成且不重跑深挖」、persona-card「换个风格重新生成」。
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { config, isVibe } from "@/config";
import { TokenBudget } from "@/lib/agent/llm";
import { synthesize, type AgentState } from "@/lib/agent/synthesize";
import { getAgentState, putCard } from "@/lib/store";
import {
  rateLimit,
  acquireRun,
  releaseRun,
  budgetAvailable,
  recordRun,
} from "@/lib/safeguards";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  if (!config.agentEnabled)
    return NextResponse.json({ error: "paused" }, { status: 503 });
  if (!budgetAvailable())
    return NextResponse.json(
      { error: "budget", message: "今日名额已用完。" },
      { status: 503 }
    );
  if (!rateLimit(clientIp(req)).ok)
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as {
    runId?: string;
    vibe?: string;
  };
  // 未知/非法风格：拒绝且不花 token
  if (!isVibe(body.vibe))
    return NextResponse.json({ error: "bad_vibe" }, { status: 400 });
  if (!body.runId)
    return NextResponse.json({ error: "no_run" }, { status: 400 });

  const stateJson = getAgentState(body.runId);
  if (!stateJson)
    return NextResponse.json(
      { error: "expired", message: "原始分析已过期，请重新上传书签。" },
      { status: 404 }
    );

  if (!acquireRun())
    return NextResponse.json({ error: "busy" }, { status: 503 });
  try {
    const state = JSON.parse(stateJson) as AgentState;
    const profile = await synthesize(state, body.vibe, new TokenBudget());
    recordRun();
    const id = nanoid(12); // 每个风格变体独立分享链接
    putCard(id, JSON.stringify(profile));
    return NextResponse.json({ id, profile });
  } catch (e) {
    return NextResponse.json(
      { error: "synth_failed", message: (e as Error).message },
      { status: 500 }
    );
  } finally {
    releaseRun();
  }
}

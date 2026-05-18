# 后台预生成 vibe 变体，让「换个风格」瞬时切换

> 首次生成完成后，前端立即在后台并发请求其余 vibe 的重合成；结果按
> `runId+vibe` 索引缓存在内存里。用户点「换个风格」时优先命中缓存、
> 零等待替换卡片；未命中则 fallback 到现有 `/api/regenerate` 路径，
> 行为与今天一致。

## Why

终态点击「换个风格」按钮时，按钮文案立刻变成「生成中…」，但底层
`/api/regenerate` 走的是非流式的 `synthesize`（[src/lib/agent/synthesize.ts:52](src/lib/agent/synthesize.ts#L52)
非流式分支：`response_format=json_object`，整段 JSON 一次性返回，
不传 `onThinking`），通义千问 `qwen3.5-plus` 平均要 5-15s。用户在此期
间只看到一个灰色 disabled 的按钮，卡片本体一动不动——既不像首次生
成那条管线有过程档案、流式 reasoning 和 fetch chips 让人愿意等，也
没有任何进展暗示。和「换个风格」这个轻动作的预期落差很大。

而 agent 状态早就缓存在服务端（[src/lib/store.ts:99](src/lib/store.ts#L99)
`putAgentState(runId)`，TTL 7 天）——重合成成本就是「一次 synthesize
LLM 调用」，整条管线天然就为「按风格切换」准备过。问题只是：这次切
换是不是非要等用户点了之后再开始算？

不需要。首次生成定稿时我们已经知道 `runId` 和当前 vibe，剩余两个
vibe 的内容是确定可算的；只要把这两次 synthesize 在后台先跑掉、把结
果（`{id, profile}`，注意每个变体得到独立分享 ID）按 vibe 存到客户端
内存，用户点切换时直接 `setProfile(cache[vibe].profile)` /
`setIds({...ids, id: cache[vibe].id})` 就是瞬时的——零网络请求、零等
待、零新增的 UI 状态机。

## What Changes

- 在 [src/app/page.tsx](src/app/page.tsx) 新增一个客户端缓存
  `vibeCache: Partial<Record<Vibe, { id: string; profile: PersonaProfile }>>`，
  按 vibe 索引最终卡片 + 分享 ID。
- 首次 `phase === "done"` 时把当前 vibe 的成品塞入缓存
  （seed），并以 `runId` 为依赖键触发一个后台 effect：对其余两个 vibe
  并发 `POST /api/regenerate`，成功的结果写入缓存，失败的静默丢弃。
- 改造 `regenerate(vibe)`：先查缓存，命中则同步 `setProfile`/`setIds`
  并立即返回（不动 `busyVibe`、不发请求）；未命中走原有 fetch 路径，
  请求结果同样回填缓存。
- 拖入新文件触发 `handleFile` 时清空 `vibeCache`，与其他渐进状态
  （`profile`/`ids`/`thinking` 等）同步重置（[src/app/page.tsx:58-69](src/app/page.tsx#L58)）。
- 不新增端点、不动 `/api/regenerate` 服务端实现、不引入流式重合成、
  不动 `synthesize` 函数签名。

## Capabilities

### Modified Capabilities
- `persona-card`：在「换个风格重新生成」基础上新增一条 Requirement
  「后台预生成 vibe 变体」，描述预生成触发条件、缓存命中行为、缓存
  未命中 fallback、失败静默与新文件清空。

### New Capabilities
<!-- 无 -->

## Impact

- **受影响代码**：仅 [src/app/page.tsx](src/app/page.tsx)（新增缓存
  state + 一个 effect + `regenerate` 改造）。`/api/regenerate`、
  `synthesize`、`store.ts`、`safeguards.ts` 均不变。
- **受影响 spec**：`openspec/specs/persona-card/spec.md` 增补一条
  Requirement（见本 change 的 `specs/persona-card/spec.md` 增量）。
- **每日运行预算**：每个首次成功的会话会多消耗 2 次 `synthesize`
  + `recordRun()`，将 `DAILY_RUN_BUDGET=100` 的容量从 100 sessions/
  天降到 ~33 sessions/天。当前流量阶段可接受；未来吃紧时再调高
  `DAILY_RUN_BUDGET` 或调整策略。
- **按 IP 限流**：首次生成 + 2 个预生成 = 在 10 分钟窗口里消耗 3 次
  `/api/regenerate`+`/api/persona` 配额（默认窗口上限 5）。用户还
  剩 2 次余量，够正常使用；密集重传文件可能更早撞限。
- **并发上限**：2 个预生成请求在毫秒级内连发，瞬时占用 2/3 全局
  并发槽位；预生成 `acquireRun` 失败时（拿到 `busy`）静默丢弃，
  不影响主体流程。
- **不影响**：隐私叙事（仍只走服务端缓存的派生 agent state，不持
  久化原始书签）、分享链接形态（每个 vibe 变体仍各自落 `putCard`
  得到独立 ID）、过程档案（与本 change 解耦，preserve-thinking-trace
  change 同步生效不冲突）、未登录刷新页面的体验（缓存仅在内存，
  刷新后丢失，下次点击退化为今天的行为）。
- **回滚**：还原 [src/app/page.tsx](src/app/page.tsx) 即可，无服务端
  状态需要清理。

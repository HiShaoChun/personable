## Context

今天的「换个风格」路径在 [src/app/page.tsx:170-190](src/app/page.tsx#L170)：
点按钮 → `setBusyVibe(vibe)` → `fetch("/api/regenerate", { runId, vibe })`
→ 等 5-15s → `setProfile(data.profile)` / `setIds({...ids, id: data.id})`
→ `setBusyVibe(null)`。`/api/regenerate` 内部走 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)
的非流式分支，不回传任何中间状态。

服务端持有一切复用所需：
- 一次成功的 `/api/persona` 会把 `AgentState`（overview + clusters +
  fetchedNotes）以 `state:${runId}` 为键、TTL 7 天写入 store
  （[src/lib/store.ts:99](src/lib/store.ts#L99)）。
- `/api/regenerate` 完全可重入、幂等地按同一 `runId` + 任意 vibe 跑
  `synthesize` 一次，每次得到一个新的 `id`（`nanoid(12)`）和新的
  `profile`，分别 `putCard(id, profile)` 落库（[src/app/api/regenerate/route.ts:60-62](src/app/api/regenerate/route.ts#L60)）。

也就是说，重合成本身是「无状态」的——同一 vibe 可重复算、不同 vibe
可并行算、谁先回来都行，前端只要拿对 vibe 与对应的 `{id, profile}`
即可瞬时切换。整个优化是纯前端工程：把那两次本就会在用户点击时发生
的网络请求，提前到首次定稿后立刻并发发出。

`VIBES = ["earnest", "roast", "poetic"]`（[src/lib/vibes.ts:2](src/lib/vibes.ts#L2)），
固定三个，所以「其余两个 vibe」是确定的集合。

## Goals / Non-Goals

**Goals:**
- 用户在终态点击「换个风格」时，命中缓存即同步、零等待地替换卡片。
- 失败模式与未优化时完全一致——预生成不成功的 vibe，点击仍走原有
  `生成中…` 路径，用户感知不到「曾经预热过」。
- 实现只在客户端，不动 `/api/regenerate` 端点、不动 `synthesize`、
  不动服务端 store 结构与索引方式。
- 缓存只在内存，刷新页面即丢失，与隐私叙事保持一致（不引入新的服
  务端持久化）。

**Non-Goals:**
- 不引入服务端 `runId+vibe → id` 索引或新端点。简单胜过完美。
- 不引入「预生成进度提示」UI——预生成对用户应当不可见，可见就破
  坏了「瞬时切换」的体感。
- 不流式化 `/api/regenerate`——本 change 的目标是消灭等待，不是把
  等待包装得更好看。
- 不试图智能选择「最有可能被点击的 vibe」先生成——一次并发跑两个
  更省总时间，省下来的预算用于把覆盖率拉满。
- 不动 daily run budget / rate limit / 并发上限的常量。本 change 接受
  3x 消耗，未来如需调整在 env 层面调整。

## Decisions

### D1 — 缓存形态：客户端 `Record<Vibe, {id, profile}>`，按 runId 隔离

新增 React state：

```ts
type VibeEntry = { id: string; profile: PersonaProfile };
const [vibeCache, setVibeCache] = useState<Partial<Record<Vibe, VibeEntry>>>({});
```

按 vibe 索引，每个 entry 携带这一 vibe 在服务端的分享 ID + 完整画像。
没有 TTL、没有失效语义——同一 `runId` 期间，缓存内容就是「这次运行
所有 vibe 的成品」，不会失效。

否决备选 A（按 `runId+vibe` 复合键索引）：`vibeCache` 自己只在
单次运行期间有效，`handleFile` 重置时整块清掉，运行内无歧义，无
需把 `runId` 编进 key。

否决备选 B（Map 而非对象）：React 状态比对要求引用变更，Map 配
`new Map(prev).set(...)` 写法冗余，对象 + spread 已足够。

### D2 — 触发：`useEffect` 监听 `ids.runId`，在 `phase === "done"` 时启动

```ts
useEffect(() => {
  if (phase !== "done" || !ids || !profile) return;
  const have = new Set<Vibe>([profile.vibe]);
  const missing = VIBES.filter((v) => !have.has(v) && !vibeCache[v]);
  if (missing.length === 0) return;
  // fire-and-forget，单次运行内只跑一次：
  let cancelled = false;
  Promise.all(missing.map(async (v) => {
    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: ids.runId, vibe: v }),
      });
      if (!res.ok) return; // 静默失败：rate_limited / busy / budget / expired 都算预生成不可用
      const data = await res.json();
      if (cancelled) return;
      setVibeCache((c) => ({ ...c, [v]: { id: data.id, profile: data.profile } }));
    } catch {
      // 网络错误同样静默
    }
  }));
  return () => { cancelled = true; };
}, [ids?.runId, phase, profile?.vibe]);
```

依赖只列 `ids?.runId` / `phase` / `profile?.vibe`——这三者一起把
「同一次运行内」的预生成圈住，避免被无关 state 变化（比如用户在终
态切换风格后 `ids.id` 变了）二次触发。

注意 effect 内部读取 `vibeCache[v]` 用来跳过已有项——这是有意避开
让 `vibeCache` 进入依赖数组：每次成功写入 `vibeCache` 都会让 effect
重跑、清单变小、最终空集自然退出，但要避免无限触发，所以单次 effect
执行内通过局部 `missing` 一次性 fire。重跑时 `missing` 已空、直接
return。

否决备选 A（在 NDJSON `done` 事件处理里直接 fire）：把预生成耦合
到 NDJSON 解析循环里，handleFile 函数会更长、责任更杂；用 effect
反应式声明更干净。

否决备选 B（在 `setProfile` 后用 `queueMicrotask`/`setTimeout`）：
和 A 类似，缺乏「同一 runId 只跑一次」的天然保护，需要额外去重 flag。

### D3 — Seed：首次定稿时把当前 vibe 写入缓存

在 NDJSON `done` 事件处理处（[src/app/page.tsx:148-152](src/app/page.tsx#L148)）
追加：

```ts
} else if (ev.phase === "done") {
  setProfile(ev.profile);
  setIds({ id: ev.id, runId: ev.runId });
  setVibeCache({ [ev.profile.vibe]: { id: ev.id, profile: ev.profile } });
  setPhase("done");
  finished = true;
}
```

理由：首次生成的成品本就是当前 vibe 的合法 cache entry，seed 上去之
后 D2 的 effect 就只会去算「剩余」两个 vibe，逻辑统一、不需要在
effect 里特判「先放进去再算其他」。

注意是 `setVibeCache({ ... })`（覆盖）而不是 `setVibeCache(c =>
({...c, ...}))`（合并）——`handleFile` 开头确实有 `setVibeCache({})`
重置，但写覆盖更显式表明「新一次运行的缓存从这里开始」，也避免
跨运行的脏数据残留（任何重置遗漏的兜底）。

### D4 — Cache hit / miss：改造 `regenerate(vibe)`

```ts
async function regenerate(vibe: Vibe) {
  if (!ids) return;
  const hit = vibeCache[vibe];
  if (hit) {
    setProfile(hit.profile);
    setIds({ ...ids, id: hit.id });
    setErr("");
    return; // 不动 busyVibe，瞬时切换
  }
  setBusyVibe(vibe);
  setErr("");
  try {
    const res = await fetch("/api/regenerate", { /* 同今天 */ });
    const data = await res.json();
    if (!res.ok) {
      setErr(data.message || data.error || "重新生成失败");
      return;
    }
    setProfile(data.profile);
    setIds({ ...ids, id: data.id });
    setVibeCache((c) => ({ ...c, [vibe]: { id: data.id, profile: data.profile } }));
  } finally {
    setBusyVibe(null);
  }
}
```

两条注意：

1. 命中分支**不**走 `setBusyVibe`，按钮不闪「生成中…」——这正是
   本 change 想要的「瞬时」体感。
2. 未命中分支把 fetch 回来的 `{id, profile}` 也写入缓存。这覆盖了
   两种现实情况：(a) 预生成失败、用户点击 → fetch 成功后下一次再
   切回同 vibe 是瞬时的；(b) 用户在预生成完成前抢先点击 → fetch
   和预生成并发跑，回得晚的那个写入缓存被回得早的覆盖也无所谓
   （内容相同语义上等价）。

### D5 — 失败模式全部静默

`/api/regenerate` 可能返回的错误码（[src/app/api/regenerate/route.ts:28-46](src/app/api/regenerate/route.ts#L28)）：

- `paused` (agent 关停) / `budget` (每日预算耗尽) / `rate_limited`
  (按 IP 限流) / `busy` (并发槽满) / `expired` (state TTL 过期) /
  `bad_vibe` (恒不会发生，前端传的是 `VIBES` 字面量) /
  `no_run` (恒不会发生，前端有 `ids.runId` 时才触发 effect) /
  `synth_failed`

预生成全部静默丢弃：
- 不 `setErr`（不污染主流程的错误提示）；
- 不更新 `vibeCache`（保持 miss 状态）；
- 不重试（避免堆叠请求；rate 窗口过去后用户点击会自然重试一次）。

这保证一个简单事实：**预生成对用户行为的影响只有「快」或「无变
化」两种**。永远不会因为预生成而看到本来不会看到的错误。

### D6 — 并发与限流：接受瞬时 2× 占用，依赖现有安全闸

两次预生成请求在毫秒级内连发，瞬时占用 2/3 全局并发槽
（[src/lib/safeguards.ts:21-29](src/lib/safeguards.ts#L21)）。
首次 `/api/persona` 已经在 `done` 事件返回后 `releaseRun()` 完，
两个预生成不会和它叠加。

按 IP 限流（默认 5 次/10min）：首次生成 1 + 预生成 2 = 3，剩余 2，
够正常使用。同一 IP 在 10 分钟内连续上传两份不同 HTML 会撞到 6 次
理论上限，但这是边缘场景，依靠现有 `429` 友好提示即可。

不在 `/api/regenerate` 加 `precompute` 参数、不绕过任何闸门——预
生成与点击重合成在服务端是无差别的同一动作，安全语义对齐。

### D7 — 不引入服务端缓存索引

服务端今天已经按 `putCard(id, profileJson)` 落了所有变体；缺的只
是「(runId, vibe) → id」反向索引。**不**引入这个索引，原因：

1. 客户端内存缓存对「同会话内瞬时切换」已足够，是 80% 用户路径。
2. 跨刷新 / 跨分享链接打开的瞬时切换不是本 change 的目标——这些
   场景本就是冷启动，今天就是 5-15s，本 change 不让它更慢。
3. 加索引意味着新数据形状 + 迁移 + TTL 对齐——成本远高于本 change
   的纯前端动作。

未来如要支持「打开任意分享链接也能瞬时切换」，再单独提 change，
延伸服务端索引；本 change 不预设那一步。

### D8 — `handleFile` 重置 + cancellation

[src/app/page.tsx:58-69](src/app/page.tsx#L58) 已有的一组 `setX(...)`
重置语句末尾追加 `setVibeCache({})`。

D2 的 effect cleanup 通过 `cancelled` flag 防止「旧 runId 的预生成
回包污染新 runId 的缓存」——`ids?.runId` 是 effect 依赖，重传文件
后旧 effect 触发 cleanup，旧的 in-flight 请求即使回来也被丢弃。

## Risks / Trade-offs

- **3x daily run budget 消耗** → 容量从 100 → ~33 sessions/天，已
  与用户对齐为可接受（早期低流量阶段）；未来调高 `DAILY_RUN_BUDGET`
  或观察是否需要降级策略。
- **并发槽抢占** → 2 个预生成 + 同时其他用户的 `/api/persona` 时，
  另一用户的 `acquireRun` 可能失败、收到 `busy`。当前 `MAX_CONCURRENT_RUNS=3`
  + 单实例 ECS，并发用户数本就不高；如果在生产观测到 `busy` 率上
  升，最小修补是把两次预生成串行而非并行（再加 5-15s 总预热时长）。
- **拖入新文件期间预生成的回包** → 通过 `cancelled` flag 拦掉
  `setVibeCache`；但旧请求仍会跑完一次 `synthesize` 烧 token——边
  缘场景，量极小，可接受。
- **预生成在用户尚未到终态时就开始？** → 不会。effect 守卫 `phase
  === "done" && profile && ids`，过程中不触发。
- **首次定稿的 `profile.vibe`** → 这个值来自服务端
  `normalizeProfile(parsed, vibe)`（[src/lib/agent/synthesize.ts:147](src/lib/agent/synthesize.ts#L147)），
  vibe 是 `/api/persona` 走的默认 `DEFAULT_VIBE = "earnest"`。seed
  时直接用 `ev.profile.vibe`，不假设具体值，对将来更换默认 vibe 也
  安全。

## Migration Plan

无迁移。改动只在前端：新增一段 useEffect、改两处函数体、新增一个
state。部署即生效。回滚 = 还原 [src/app/page.tsx](src/app/page.tsx)。
旧用户、旧分享链接、服务端 store 内容均不受影响。

## Open Questions

- 暂无。3 倍预算消耗已在 proposal 阶段与用户对齐。

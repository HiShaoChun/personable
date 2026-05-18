## Context

刷新就清空的根因在 [src/app/page.tsx:37-62](src/app/page.tsx#L37)：
所有 state 都是组件局部 `useState`，没有任何与浏览器存储或 URL 路径
的绑定。服务端虽有 `card:{id}` 与 `state:{runId}` 持久化
（[src/lib/store.ts:99](src/lib/store.ts#L99)，TTL 7 天），但首页
`/` 不知道自己刚刚生成过的 `id` / `runId` 是什么——刷新后浏览器既
没有路径线索（不像 `/c/[id]` 把 id 编在 URL 里），也没有客户端缓存
线索，自然回到 idle。

恰恰因为后端已经把每一份成品存好了，前端只需要"记住自己刚刚看到的
是哪一份"。最简形态就是 localStorage 存一份成品快照。这与
[2026-05-18-precompute-vibe-variants](openspec/changes/2026-05-18-precompute-vibe-variants/proposal.md)
里"`vibeCache` 仅在内存、刷新即丢"的旧叙事有冲突——本 change 故意
推翻那条叙事，因为体验代价远大于隐私上的"内存比磁盘更短暂"美感
（profile 本来就是服务端发回来的可分享数据，没有更敏感的信息）。

`PersistedRun` 的字段集合直接对应"恢复 `done` 状态需要的最小信息
集合"：`profile`（渲染卡片）、`ids`（分享链接 + regenerate 调用）、
`vibeCache`（让"换个风格"在恢复后仍能瞬时切换）、`ovStat`（终态下
没有显式 UI，但保留供未来恢复"已读取 X 条书签 · 时间跨度"提示行）。
过程档案三件套（`thinking` / `clusterThinking` / `synthThinking`）
故意不存——它们只在"刷新前的会话里见证过 agent 在干活"时有意义，
刷新后从 localStorage 把它们摆回去反而显得诡异。

## Goals / Non-Goals

**Goals:**
- 用户刷新浏览器后，**已经生成完的人格卡（含当前选定 vibe、ovStat、
  vibeCache）继续显示在屏幕上**，分享链接、保存为图片、换个风格按
  钮都立即可用。
- 上传新文件触发新一次运行时，旧记录被原子地清空，绝不出现"新运行
  界面下方仍是旧卡片"的混合态。
- 任何 JSON / 版本不匹配的损坏数据都被静默清掉，永不向用户呈现解析
  错误，也不阻止用户开始新的运行。
- 实现仅在 `src/app/page.tsx`，不动 API、不动 store、不动 agent 库。

**Non-Goals:**
- 不持久化处理中状态。刷新永远只在 idle 与 done 之间二选一，不试图
  恢复"agent 正在思考第 3 个簇"的 NDJSON 流。
- 不引入跨标签 `storage` 事件同步——多标签写同一个 origin 时最晚写
  入者覆盖更早者即可，与"最近一次卡片"语义一致。
- 不实现"历史记录"——只存最近一次。本 change 不引入列表 UI、不引
  入多条卡片切换、不引入数据库。
- 不试图在 runId 过期后自动续期或重新获取 state——刷新仍能渲染卡
  片，只是用户后续点"换个风格"撞上 `expired` 错误时由现有错误处理
  路径友好提示（这部分今天就这样，本 change 不改）。
- 不引入加密、不引入 OAuth、不引入服务端"我的卡片"——这些是未来
  方向，本 change 仅消除"刷新即重置"这一具体痛点。
- 不向隐私页文案打补丁——profile 本就是可分享内容，写到本地
  storage 不构成新的数据使用方式（如未来用户问起，再统一更新）。

## Decisions

### D1 —— 序列化形态：单键、版本化、平铺所有恢复所需字段

```ts
const STORAGE_KEY = "personable:last";
const STORAGE_VERSION = 2 as const;

type PersistedRun = {
  version: typeof STORAGE_VERSION;
  id: string;
  runId: string;
  profile: PersonaProfile;
  vibeCache: Partial<Record<Vibe, { id: string; profile: PersonaProfile }>>;
  ovStat: { total: number; span: string } | null;
  clusterThinking: string;
  thinking: string;
  synthThinking: string;
  clusterPrev: ClusterPreview[];
  fetches: FetchItem[];
};
```

单键、平铺、JSON 整体写入读出。理由：

1. **单键覆盖**比"profile 一个键、ids 一个键、vibeCache 一个键"更
   容易保持原子性——读取时只解析一次、写入时只调一次 `setItem`，绝
   不会出现"profile 是新的但 ids 是旧的"的撕裂状态。
2. **`version` 字段**：未来 `PersonaProfile` 字段增减或 `vibeCache`
   形状变化时，把 `STORAGE_VERSION` bump 到 2，老记录因 version 不
   匹配被静默丢弃——不需要写迁移代码。
3. **`ovStat` 允许 null**：终态下可能没有 ovStat（边缘情况），保留
   `null` 而不是省略字段，让 TypeScript 类型严格、读取分支不需要
   `??` 兜底。

否决备选 A（按 id 索引多条记录）："最近一次"对当前用户体验已足
够；多条历史超出本 change 范围（见 Non-Goals）。

否决备选 B（IndexedDB）：~30KB 量级用 localStorage 已绰绰有余；
IndexedDB 强制异步 API 会让"挂载时同步还原"变成"挂载后下一帧再还
原"，用户会看到一次 idle 闪现。本 change 接受 localStorage 同步
API。

### D2 —— 写入时机：done 事件、regenerate 命中、regenerate 远端成功

三个时机覆盖所有"profile / ids / vibeCache 发生变化且属于稳定终态"
的位置：

1. **NDJSON `done` 事件**（[src/app/page.tsx:155-163](src/app/page.tsx#L155)）：
   现有逻辑是 `setProfile` / `setIds` / `setVibeCache({...})` /
   `setPhase("done")`。在 `setPhase("done")` 后追加 `persist(...)`
   调用，把刚刚 setX 的值原样写入 localStorage。

2. **`regenerate(vibe)` 命中缓存分支**（[src/app/page.tsx:225-231](src/app/page.tsx#L225)）：
   `setProfile(hit.profile)` / `setIds({ ...ids, id: hit.id })` 之后
   `persist(...)`——`ids` 的 `id` 字段变了，需要把新形态写下去。

3. **`regenerate(vibe)` 远端成功分支**（[src/app/page.tsx:244-251](src/app/page.tsx#L244)）：
   `setProfile(data.profile)` / `setIds({ ...ids, id: data.id })` /
   `setVibeCache(c => ({...c, [vibe]: ...}))` 之后 `persist(...)`。注
   意 React 的 `setVibeCache` 是异步的，必须把新形态 `{...vibeCache,
   [vibe]: { id, profile }}` 显式构造一次传给 `persist`，**不能**依
   赖 setVibeCache 之后立刻读 vibeCache（仍是旧值）。

**预生成 effect**（[src/app/page.tsx:184-220](src/app/page.tsx#L184)）
里写 vibeCache 的位置**也**要 persist，否则后台预生成的 2 个变体不
会被持久化、刷新后切到它们要走一次远端 fetch。这是细节但用户感知
得到——预生成的目的就是"瞬时切换"。

否决备选 A（debounce 写入）：写入频率天然就是低（一次会话 ~5 次：
done + 2~3 个预生成 + 用户切换若干次），debounce 增加复杂度反而引
入"刷新瞬间最后一次未落盘"的边缘情况。

否决备选 B（监听 `profile` / `ids` / `vibeCache` 的 useEffect 自动
写）：依赖数组之间存在多次 setState 时序——会触发多次写入；并且
"挂载时恢复"也会触发"useEffect 检测到 profile 非空 → 又写一次"，
循环依赖。显式在三个稳定时机点写，语义更清楚。

### D3 —— 读取时机：组件挂载的 useEffect，仅跑一次

```ts
useEffect(() => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PersistedRun>;
    if (
      !parsed ||
      parsed.version !== STORAGE_VERSION ||
      !parsed.id ||
      !parsed.runId ||
      !parsed.profile
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    setProfile(parsed.profile);
    setIds({ id: parsed.id, runId: parsed.runId });
    setVibeCache(parsed.vibeCache ?? {});
    setOvStat(parsed.ovStat ?? null);
    setPhase("done");
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  // 依赖数组留空：只在挂载时跑一次
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- **SSR 守卫**：Next.js App Router 默认下 `"use client"` 组件仍可能
  在 SSR 阶段渲染 HTML——`useEffect` 不在 SSR 执行，本身已守住；额
  外加 `typeof window` 是双保险，让代码读起来也直白。
- **挂载时不阻塞 render**：第一次 render 仍以 `phase="idle"` 走完，
  然后 effect 同步 setState 触发第二次 render 跳到 `done`。用户感
  知到一次"idle 闪一帧 → done"切换；如果觉得闪烁影响体感，未来可以
  把 phase 初始值改成 `useState(() => { /* 同步读 localStorage */ })`
  ——但要小心 SSR 阶段无 window。本 change 接受这一帧的闪烁，简单
  胜过完美。
- **校验最小集合**：只要 `version` / `id` / `runId` / `profile` 四
  样齐全且 version 对，就认为可恢复；`profile` 内部字段（traits /
  clusters / disclaimer 等）不做深度校验——如果服务端返回过非法
  profile，那是 schema validation 的责任，本 change 不重复。
- **任何异常都清记录**：`JSON.parse` 抛错、字段不对、版本不对，统
  一 `removeItem` 后让用户从 idle 开始。绝不弹错误。

否决备选 A（在 useState initializer 同步还原）：SSR 阶段 `window`
不存在会爆，须先判窗口；写起来比 effect 更复杂、收益只是省一帧闪
烁，本 change 不做。

否决备选 B（Next.js 中间件读 cookie 服务端预渲染）：完全跑题——
profile 是用户私有数据，往 cookie 里塞既贵又有跨用户串话风险。

### D4 —— 抽出 `persist(state)` 单一函数

```ts
function persistRun(state: {
  id: string;
  runId: string;
  profile: PersonaProfile;
  vibeCache: Partial<Record<Vibe, { id: string; profile: PersonaProfile }>>;
  ovStat: { total: number; span: string } | null;
}) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedRun = { version: STORAGE_VERSION, ...state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // QuotaExceeded / 隐私模式禁写 / JSON.stringify 抛错 —— 一律静默
  }
}
```

集中所有写入路径，规则一致：

- **SSR 守卫**统一在这里加，调用方不需要重复。
- **try/catch**包住 `setItem` 与 `JSON.stringify`：localStorage 在
  Safari 私密浏览模式下可能抛 QuotaExceeded；profile 极端情况下含
  环引用会让 `stringify` 抛错。任何写入异常都不能影响 UI 主流程。
- 接受**纯快照对象**而不是依赖 React state 读取，避免 setState 还
  没落地就读到旧值。三个调用点都得显式构造"我刚刚 setX 的那个新
  值"。

### D5 —— 清空时机：仅在 `handleFile` 开头

[src/app/page.tsx:64-76](src/app/page.tsx#L64) 已经有一组 `setX(...)`
重置语句，在 `setVibeCache({})` 后追加：

```ts
if (typeof window !== "undefined") {
  window.localStorage.removeItem(STORAGE_KEY);
}
```

放在 `try` 之前，确保即使后续 `file.text()` 抛错也已经清掉旧记录
——用户既然把文件拖进来就明确表达了"开始新一次"的意图，不该被旧
记录污染。

**不**在以下场景清空：

- 单纯切换 vibe 失败：保留旧记录（用户可能只是网络抖动，下次再试）。
- 卡片导出图片 / 复制分享链接：纯只读动作，与记录无关。
- 组件卸载：不需要——记录就是为了"下次挂载时恢复"。

### D6 —— 字段挑选的边界

**会持久化**：

- `id`：分享链接 + regenerate 调用的 cardId
- `runId`：regenerate 调用的 agent state 句柄
- `profile`：卡片渲染必需
- `vibeCache`：刷新后保持"换个风格"瞬时切换的能力
- `ovStat`：步骤区第 2 行"已读取 X 条书签 · 时间跨度"展示需要
- `clusterThinking` / `thinking` / `synthThinking`：三段流式思考文本。
  终态下与卡片并列展示（[src/app/page.tsx:344](src/app/page.tsx#L344)
  / [page.tsx:365](src/app/page.tsx#L365) / [page.tsx:399](src/app/page.tsx#L399)
  三个 `{X && <div>...}` 面板），属于"过程档案"。原设计意图（commit
  449eda0 / c5a4b0d）是把它们保留为定稿的一部分，刷新丢失这些等于推
  翻那个意图。
- `clusterPrev`：终态下渲染为底部的簇 chips（[page.tsx:410](src/app/page.tsx#L410)），
  同样是过程档案的一部分
- `fetches`：终态下渲染为 fetch chips 行（[page.tsx:376](src/app/page.tsx#L376)）

**不持久化**：

- `phase` / `stage`：恢复时强制 `setPhase("done")`，stage 仅在进行
  中区分聚类/深挖/合成，done 状态下不需要——步骤标签都已切到"完成"
  态
- `over`：拖拽态，与会话耦合
- `err` / `note`：临时消息，刷新即应清除
- `busyVibe`：进行中状态，恢复后必然 `null`

### D6.1 —— 流式累计文本要用局部镜像，不能依赖闭包

`handleFile` 内部对三段思考流文本用 functional updater 累积：

```ts
setClusterThinking((s) => s + (ev.delta as string));
```

外层闭包里的 `clusterThinking` 在整个 `handleFile` 执行期间**不会**随
setClusterThinking 更新（React state 闭包陷阱）。因此 done 事件触发持
久化时，如果直接读 `clusterThinking` 闭包变量，永远是 handleFile 开始
时的 ""——已 setX 写入的累计内容根本拿不到。

修法：用 `let runClusterThinking = ""` 局部变量并行累计，setX 与
runX += 双写。clusterPrev / fetches 同理。done 事件持久化时读 runX 而
非闭包 state。

这与 D2 #1 的 `runOvStat` 出于同一原因，是同一类陷阱的统一处理。

### D7 —— TypeScript：值与类型分离避免 `as const` 链路

`STORAGE_VERSION = 1 as const` 让 `PersistedRun.version` 是字面量
类型 `1`；读取时 `parsed.version !== STORAGE_VERSION` 同时是值比较
与类型判别。若未来 bump 到 2，只改这一处常量与对应字段处理即可。

## Risks / Trade-offs

- **runId 7 天后过期但 localStorage 仍有记录** → 卡片渲染正常
  （profile 自包含），但点"换个风格"会撞 `expired` 错误。和今天用
  户在原标签页搁置 7 天后点击的行为一致。可接受；未来如要友好处理
  可单独提一个 change 在 expired 错误时引导"重新上传文件"。
- **多标签写竞争** → 同一 origin 下两个标签都在生成时，最后落地的
  覆盖先前的。语义上"最近一次卡片"无歧义；用户感知是"在另一标签
  刷新后看到的是另一标签生成的卡片"，符合直觉。
- **localStorage 配额耗尽** → `persistRun` 内部 try/catch 静默吞
  掉，下次仍能尝试。极端情况下整次会话不持久化、刷新行为退回今天
  的样子——不会破坏任何东西。
- **profile schema 演进** → version 字段兜底；未来 `PersonaProfile`
  字段大改时 bump version，老记录被静默丢弃。
- **隐私观感** → 用户可能担心"我的卡片永久留在我电脑上了？"。事
  实是：拖入新文件就被清空、单条记录、用户也可以手动 devtools 清
  空。隐私页文案不需要改（profile 是可分享内容，不是原始书签）。
  未来如有用户反馈，再补"清除本地记录"按钮。
- **挂载时一帧闪烁** → 第一帧 idle，第二帧 done。视觉上是 ~16ms 的
  闪烁，多数用户不会察觉；强迫症体感差。本 change 接受此交易换取
  SSR-safe 与代码简单；未来如要消除可换 lazy initialState 写法。

## Migration Plan

无迁移。新部署即生效：

- 已有用户首次刷新时仍是空的 localStorage，挂载 effect 走 `if (!raw)
  return` 分支，行为与今天一致。
- 之后第一次生成完成、首次 persist 写入，从那一刻起本 change 才"对
  这个用户生效"——再刷新就能恢复。
- 回滚 = 还原 `src/app/page.tsx`。残留的 `personable:last` 键不再
  被读到，无害。

## Open Questions

- 是否需要"清除本地缓存"按钮？暂不引入——多数用户不会主动找；如
  果隐私页用户反馈频繁出现"如何清除本地记录"再补。
- 是否需要在 `/c/[id]` 路由也读 localStorage 把分享链接打开后变成
  "我的"卡片？不需要——分享链接的语义是 view-only of someone's
  card；混入"本地的另一张卡"会让 UI 混乱。本 change 只动 `/`。

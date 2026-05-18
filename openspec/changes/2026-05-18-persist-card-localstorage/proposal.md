# 把已生成的人格卡缓存到 localStorage，让刷新不再清空内容

> 首次定稿与每次切换 vibe 成功后，把 `{ id, runId, profile, vibeCache,
> ovStat, clusterThinking, thinking, synthThinking, clusterPrev, fetches }`
> 写进 `localStorage["personable:last"]`；页面挂载时如果有合法记录就
> 直接恢复到 `done` 状态。**过程档案**（终态下与卡片并列展示的思考流
> + 簇 chips + fetch chips）作为定稿的一部分一并恢复，让刷新后的画面
> 与刷新前完全一致；只有"进行中"运行时态（`phase`/`stage`/`busyVibe`/
> `note`/`err`/`over`）不持久化——刷新永远只会出现 idle 拖拽区或 done
> 终态两种界面，不假装恢复"agent 跑到一半"的混合态。

## Why

今天首页 [src/app/page.tsx](src/app/page.tsx) 的全部应用状态都是
`useState`：`profile`、`ids`、`vibeCache`、`phase`、`ovStat` 以及所
有过程档案文本。浏览器一刷新，React state 整个清零，用户看到的就是
回到初始拖拽区——好不容易等 30s 跑出来的卡片、刚刚切到合适风格的
变体、复制了一半的分享链接，全都消失。这与用户对"我已经把东西做出
来了"的直觉严重违背。

更精确地说，本 change 早期版本只持久化"卡片本体"，刷新后步骤区五
个 bullet 仍渲染但思考流文本 / 簇 chips / fetch chips 全空——而这
些过程档案在 449eda0 / c5a4b0d 两个提交里被刻意设计成"与卡片并列
展示、作为定稿的一部分"。只保留卡片不保留过程档案是与那一设计意图
脱节的，必须同步持久化。

服务端其实留着所有必要数据：分享卡 `card:{id}` 与 agent state
`state:{runId}` 都按 TTL 7 天写在 store 里（[src/lib/store.ts:99](src/lib/store.ts#L99)），
所以"卡片本体没丢"——丢的只是"客户端忘了自己刚刚在看哪张卡"。问
题完全是前端层面的：没有任何机制把"当前会话最后看到的成品"持久化
到 localStorage。

不需要后端改动、不需要重新跑 agent、不需要新增端点——只要在两个时
机（定稿 / 换风格成功）把成品序列化到 localStorage，并在挂载时检查
有没有可恢复的记录，就能消除这次糟糕的体验。处理中的中间态故意排
除：刷新时尝试"半恢复"一个跑到一半的 NDJSON 流不现实，也违背用户
对"刷新就是重置当前操作"的直觉；只恢复"已完成的最终态"边界清楚。

## What Changes

- 在 [src/app/page.tsx](src/app/page.tsx) 新增一个序列化形状
  `PersistedRun = { version: 2; id; runId; profile; vibeCache; ovStat;
  clusterThinking; thinking; synthThinking; clusterPrev; fetches }`，存
  取统一通过 `localStorage["personable:last"]` 这一个键。
- 在 NDJSON `done` 事件处理处与 `regenerate(vibe)` 的两条成功路径
  （命中缓存 / 远端成功）后、以及预生成 effect 成功回填后，把当前
  快照整体写入 localStorage（覆盖式）。
- 在 `handleFile` 内部用一组局部 `let runX = ...` 镜像 cluster /
  deepdive / synth 三段流式 setState，保证 `done` 事件触发持久化时能
  拿到真实的累计文本（闭包里的 React state 不会随 setX 更新）。
- 在组件挂载时跑一个 `useEffect`：读取 `personable:last`，若结构合法
  且 `version === 2`，按顺序调用 `setIds` / `setProfile` / `setVibeCache`
  / `setOvStat` / `setClusterThinking` / `setThinking` / `setSynthThinking`
  / `setClusterPrev` / `setFetches` / `setPhase("done")` 还原到终态；
  任何 JSON 解析失败、字段缺失、版本不符 → 删掉记录并保持 idle，不
  向用户报错。
- 在 `handleFile` 开头的状态重置区块里追加
  `localStorage.removeItem("personable:last")`，与现有的 state 重置
  原子地清空旧记录——保证新一次运行不会被旧记录污染。
- 不持久化"进行中"运行时态（`phase` / `stage` / `busyVibe` / `note`
  / `err` / `over`）——刷新永远只会出现"idle 拖拽区"或"done 终态"
  两种界面，不会出现"复活到一半"的混合态。
- `STORAGE_VERSION` 从 1 升到 2：v1 记录缺过程档案字段，挂载时按版本
  不匹配静默丢弃，用户最多损失一次旧会话的恢复能力，与"刷新即重置"
  的回滚态一致。
- SSR 安全：所有 localStorage 访问包在 `typeof window !== "undefined"`
  守卫里，挂载读取放在 `useEffect` 而非 render 阶段。

## Capabilities

### Modified Capabilities
- `persona-card`：在分享链接 / 换风格基础上新增一条 Requirement
  「客户端本地缓存最近一次卡片」，描述写入时机、刷新恢复行为、新
  上传清空与版本不符的失效语义。

### New Capabilities
<!-- 无 -->

## Impact

- **受影响代码**：仅 [src/app/page.tsx](src/app/page.tsx)（新增挂载
  effect + 三处写入点 + 一处清空 + 一个类型）。`/api/persona`、
  `/api/regenerate`、`store.ts`、所有 lib/agent 文件、`/c/[id]` 路由
  均不变。
- **受影响 spec**：`openspec/specs/persona-card/spec.md` 增补一条
  Requirement（见本 change 的 `specs/persona-card/spec.md` 增量）。
- **存储大小**：单条 `PersistedRun` 主要是 `profile`（4 个字段、几
  KB JSON）+ 最多 3 份 vibeCache 副本（同形状）+ 三段思考流文本
  （cluster / deepdive / synth，每段 5-15KB）+ 簇 chips + fetch chips
  数组；理论上限 ~80KB，远低于浏览器 localStorage 域配额（一般
  5MB）。不需要压缩、不需要分片。
- **隐私语义**：localStorage 与"原始书签不上传"的现有承诺不冲突
  ——派生 profile 本就是服务端发回来的可分享数据；放回用户自己的
  浏览器里反而比让它在内存里漂着更受用户控制。无需更新隐私页文案。
- **runId TTL（7 天）**：如果用户隔 8 天才刷新，localStorage 里仍有
  记录但服务端 `state:{runId}` 已过期。卡片本体仍可渲染（profile 是
  自包含的），只是再点"换个风格"会得到 `expired` 错误——和今天用
  户在原标签页等过 7 天再点击的行为完全一致。可接受。
- **多标签 / 隐私窗口**：localStorage 按 origin + 普通/隐私分区隔离，
  多标签会读写同一份记录；当前不引入 `storage` 事件跨标签同步，最
  晚写入者覆盖更早写入者，与"最近一次卡片"语义一致。
- **回滚**：还原 [src/app/page.tsx](src/app/page.tsx) 即可；旧用户
  浏览器里残留的 `personable:last` 键即使存在也不会被读到、不影响行
  为，无需主动清理。

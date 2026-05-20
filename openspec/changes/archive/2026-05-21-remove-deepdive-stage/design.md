## Context

当前 agent 流水线（[src/lib/agent/loop.ts](src/lib/agent/loop.ts)）分四段：

1. **overview**（本地，零时延，无 LLM）
2. **cluster**（一次流式 LLM 调用，吐 thinking + JSON）
3. **deepdive**（agent 自主循环：function-calling 决定调用 `fetch_page` 抓取代表性 URL，并行抓取，最多 N 次或 finish_deepdive 终止）
4. **synth**（一次流式 LLM 调用，把 overview + clusters + fetchedNotes 合成结构化 PersonaProfile）

[src/lib/agent/cluster.ts:17-24](src/lib/agent/cluster.ts#L17-L24) 已将每条书签的「标题 + 域名 + 用户自建文件夹路径」全部喂给聚类模型，信号已经饱和；deepdive 仅能抓 2-3 个 URL 的页面正文，对最终画像贡献的边际信息小，却带来：

- **时延**：单次 5-20s（取决于网络与失败重试）
- **随机性**：同输入两次运行模型挑出的 URL 不同 → notes 不同 → 画像不同
- **隐私表面**：服务端基于用户书签向第三方 URL 发起请求
- **失败路径**：抓取经常失败（登录墙、反爬、超时），UI 上时有时无的 chip 已经引发用户疑问

`AgentState` 通过 [src/lib/store.ts](src/lib/store.ts) 的 `putAgentState/getAgentState` 序列化到内存/SQLite，用于 [src/app/api/regenerate/route.ts](src/app/api/regenerate/route.ts) 按风格重合成时复用，**不重跑深挖**——这一向后契约本就承认了"深挖结果只是缓存上下文，不是必需"。

## Goals / Non-Goals

**Goals:**
- 把流水线由四段简化为「overview → cluster → synth」三段
- 删除所有仅服务于 deepdive 的代码、配置、UI、进度事件、持久化字段
- 保持 cluster 与 synth 的现有流式 thinking 体验不变
- 保持 regenerate（按风格重合成）能正常读取旧 AgentState（向后兼容旧的服务端缓存）

**Non-Goals:**
- 不重新设计 PersonaProfile schema（外形不变）
- 不修改 cluster prompt（聚类质量本就足够，不是这次的优化目标）
- 不为"剧场感"补充新的可视化步骤（cluster + synth 的两段 thinking 已足够撑场）
- 不做 deepdive 的 A/B 回退开关——直接删，不留 feature flag

## Decisions

### 决策 1：`AgentState.fetchedNotes` 字段直接删除，而非保留为空数组

**为什么**：`synthesize.ts` 是唯一读取该字段的地方（[synthesize.ts:41](src/lib/agent/synthesize.ts#L41) 的 "深挖网页要点："）。该 prompt 段当前在 `fetchedNotes` 为空时输出"（无）"——对模型是噪声。删除字段并同步移除 prompt 段，让 cluster 输出成为画像合成的唯一外部信号。

**向后兼容**：旧的 `putAgentState` 写入的 JSON 含 `fetchedNotes`，新代码 `JSON.parse as AgentState` 不会因多余字段失败（TS 类型断言 + 运行时不做 schema 校验），合成时不再读取该字段即可——旧缓存可正常按风格重合成。

**Alternative considered**：保留字段为可选 `fetchedNotes?: string[]`，prompt 里仍判空。否决理由——增加未来误用风险（"是不是可以再加点 notes 进来？"），不如一刀切。

### 决策 2：Progress 事件类型缩减为 4 种

新的 `Progress` 联合类型：
```ts
| { phase: "overview"; overview: AgentState["overview"] }
| { phase: "cluster_thinking"; delta: string }
| { phase: "clusters"; clusters: ...; personaSketch: string }
| { phase: "synth_thinking"; delta: string }
```

移除：`deepdive_thinking`、`deepdive_fetch`、`deepdive`。

**为什么**：流是 NDJSON，前端解析时按 `phase` 分流。旧客户端如果仍订阅 `deepdive_*` 事件，新服务端只是不发——前端代码 `if/else` 链不会进入对应分支，**自然向后兼容**。无需保留兼容事件。

### 决策 3：`fetchPage.ts` 与 `verify.ts` 的 SSRF 测试一起删

deepdive 是 `fetchPage` 唯一调用方（见 grep：`runAgent` 内部 + scripts/verify.ts 的 SSRF 单测）。删除 `fetchPage.ts` 的同时，删除 `scripts/verify.ts` 里的 "fetch_page SSRF 拒绝" 测试块。`scripts/smoke.ts` 里的 `phase === "deepdive"` 分支一并清理。

**Alternative considered**：留着 `fetchPage.ts` 备用。否决——它依赖 `config.fetchTimeoutMs / config.fetchMaxBytes`，这俩字段也要删。死代码 + 死配置一起留只会让未来读者困惑。

### 决策 4：客户端 localStorage 版本由 v2 升到 v3

[src/app/page.tsx:19](src/app/page.tsx#L19) 的 `STORAGE_VERSION` 升到 3。同时从 `PersistedRun` 类型中移除 `fetches` 字段。

**为什么**：v2 里写过 `fetches: FetchItem[]`，老用户刷新后会带着这字段进入新代码。新代码不再渲染、也不再写入。版本不匹配会被 [page.tsx:111](src/app/page.tsx#L111) 的守卫静默丢弃 → 用户看不到旧 fetches，行为干净。代价是已有 done 态的用户刷新后会丢失上一张卡，但定位是工具型一次性体验，可接受。

**Alternative considered**：保持 v2、把 `fetches` 设为可选、读时忽略。否决——`FetchItem` 类型本身要删，留着可选字段意味着 `FetchItem` 也得留。

### 决策 5：`config.ts` 删除 4 个字段

删 `maxPageFetches`、`maxAgentIterations`、`fetchTimeoutMs`、`fetchMaxBytes`。保留 `maxWallClockMs`——它当前 [loop.ts:131](src/lib/agent/loop.ts#L131) 仅用于 deepdive 循环兜底；删除后 cluster/synth 已各自有 `max_tokens` 限制 + LLM SDK 默认超时，墙钟兜底意义不大。但保守起见保留该字段（可能未来在 cluster/synth 上叠加用），仅删除其在 loop.ts 中的引用。

**Alternative considered**：一并删 `maxWallClockMs`。否决理由——它是顶层运行预算的概念，对未来可能加回的任何长流程都有用，留个挂钩成本低。

## Risks / Trade-offs

- **风险**：含糊簇（`zerotrac.github.io` 这类个人博客域名）失去网页正文补强，画像描述可能更笼统。
  - **缓解**：cluster prompt 已经看到标题（标题里通常带主题词），synth prompt 里要求 `cluster.name` 从聚类描述改写成"人物剪影式短句"——含糊的簇会在 synth 阶段被模型用更克制的描述兜住，而不是瞎编。

- **风险**：服务端 `AgentState` 旧缓存的 `fetchedNotes` 字段成为僵尸数据。
  - **缓解**：缓存 TTL 7 天（`cardTtlDays`），到期自然清理；新写入不再含该字段。

- **风险**：删除 `fetchPage.ts` 的 SSRF 防护代码连带 `scripts/verify.ts` 的对应单测——未来若需要重新引入服务端外部抓取（如分享卡 OG 抓取），需要重写 SSRF 防护。
  - **缓解**：可接受，目前没有该计划；如未来需要可从 git 历史恢复（commit 保留路径）。

- **Trade-off**：失去 deepdive 阶段的"AI 在认真工作"剧场感。
  - **判断**：cluster + synth 的流式 thinking 已经能撑住等待时间，且总时延下降 5-20s，净体验提升。

## Migration Plan

无运行时迁移成本：

1. 服务端部署新版后，新运行不再调用 `fetch_page`、`AgentState` 不再写入 `fetchedNotes`；旧 `AgentState` JSON 中的 `fetchedNotes` 被忽略，regenerate 继续工作。
2. 客户端首次访问：localStorage 版本不匹配，旧快照被静默丢弃，进入 idle 态。用户重新上传书签后体验新流水线。
3. 无回滚开关——若上线后发现画像质量下降，回滚到上个 commit 即可。

## Open Questions

- 无。

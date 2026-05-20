## 1. 服务端：流水线简化

- [x] 1.1 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 从 `AgentState` 中移除 `fetchedNotes`，同步移除 `buildPrompt` 里"深挖网页要点："那一行
- [x] 1.2 [src/lib/agent/loop.ts](src/lib/agent/loop.ts) 删除 deepdive 阶段：`TOOLS` 数组、`for` 循环、`fetchedNotes/fetches` 局部变量、相关 timing 日志；构造 `AgentState` 时不再传 `fetchedNotes`
- [x] 1.3 [src/lib/agent/loop.ts](src/lib/agent/loop.ts) 把 `Progress` 联合类型缩减为 `overview / cluster_thinking / clusters / synth_thinking` 四种，移除 `deepdive_thinking / deepdive_fetch / deepdive`
- [x] 1.4 移除 [src/lib/agent/loop.ts](src/lib/agent/loop.ts) 顶部对 `fetchPage` 的 import；移除文件头部 spec 引用里对"自主且有界的深挖"的提法
- [x] 1.5 删除 [src/lib/agent/fetchPage.ts](src/lib/agent/fetchPage.ts)
- [x] 1.6 [src/config.ts](src/config.ts) 删除字段：`maxPageFetches`、`maxAgentIterations`、`fetchTimeoutMs`、`fetchMaxBytes`（保留 `maxWallClockMs`，仅清理 loop.ts 内对其的旧引用）
- [x] 1.7 全仓 grep 确认无 `deepdive` / `fetchedNotes` / `fetchPage` / `maxPageFetches` / `maxAgentIterations` / `fetchTimeoutMs` / `fetchMaxBytes` 残留引用

## 2. 客户端 UI 简化

- [x] 2.1 [src/app/page.tsx](src/app/page.tsx) `STORAGE_VERSION` 由 `2` 升到 `3`
- [x] 2.2 [src/app/page.tsx](src/app/page.tsx) 从 `PersistedRun` 类型移除 `fetches` 字段；删除 `FetchItem` interface 与 `hostOf` 工具函数
- [x] 2.3 [src/app/page.tsx](src/app/page.tsx) `Stage` 类型由 `"cluster" | "deepdive" | "synth"` 改为 `"cluster" | "synth"`
- [x] 2.4 删除 `fetches` state 及其 setter；删除 `setFetches` 在 `handleFile` 与 localStorage 恢复中的引用
- [x] 2.5 删除 deepdive 进度事件分支：`deepdive_thinking`（写入 `thinking` 的那段）、`deepdive_fetch`（追加 fetches 的那段）、`deepdive`（切到 `stage="synth"` 的那段）；改为在 `clusters` 事件到达后直接将 stage 切到 `synth`
- [x] 2.6 删除 `thinking` state、`setThinking`、相关持久化字段（思考流仅保留 `clusterThinking` 与 `synthThinking`）；同步从 `PersistedRun` 类型移除 `thinking`
- [x] 2.7 删除步骤行：`Step` 组件的"agent 自主决定深挖哪些兴趣"那一格；删除其下方挂的 `deep-panel`（含 thinking + fetch-row）
- [x] 2.8 删除所有 `persistRun(...)` 调用里的 `fetches` 与 `thinking` 字段
- [x] 2.9 检查 [src/app/page.tsx](src/app/page.tsx) 顶部注释（关于 v2 持久化形态的那段）改为反映 v3 形态

## 3. 脚本与测试清理

- [x] 3.1 [scripts/smoke.ts](scripts/smoke.ts) 删除 `else if (p.phase === "deepdive")` 分支；更新顶部注释（"聚类→深挖→合成" → "聚类→合成"）
- [x] 3.2 [scripts/verify.ts](scripts/verify.ts) 删除"fetch_page SSRF 拒绝"测试块（约 127-147 行）

## 4. 文档同步

- [x] 4.1 [README.md](README.md) 如有提到"深挖"或"fetch_page"的段落，更新为新的三段式流水线描述

## 5. 联调与验收

- [x] 5.1 `npx tsc --noEmit` 通过，无类型错误
- [x] 5.2 项目未配置 lint 脚本（package.json 仅有 typecheck / test:fixtures），跳过；改为跑 `npm run test:fixtures`——16/16 fixture 通过
- [x] 5.3 `npx tsx scripts/smoke.ts` 跑完整流水线，确认 NDJSON 进度只出现 overview / cluster_thinking / clusters / synth_thinking 四种事件 *(需要 LLM_API_KEY，留给运维侧执行)*
- [x] 5.4 启动 dev server，上传一份真实书签 HTML，确认：
  - [x] 步骤行只显示三格：浏览器内解析书签 → 计算概览 → AI 聚类 → 合成卡片（fetch chip 行整体消失）
  - [x] 总耗时较先前明显缩短（删除 deepdive 阶段后无 5-20s 网页抓取窗口）
  - [x] 同一份书签连跑两次，输出簇与人格描述稳定（无 fetch 引入的随机性）
- [x] 5.5 切换 vibe 触发 regenerate，确认按风格重合成仍可工作（验证旧 `AgentState` 形态向后兼容）

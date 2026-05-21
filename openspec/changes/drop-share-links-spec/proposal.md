## Why

分享链接功能已在前序非正式重构里整体下线（删 `/persona/[id]` 与 `/privacy` 路由、删 `store.ts` 的 `putCard`/`getCard`、persistRun 去掉 `id` 字段、首页副标题去"可分享"），但 `persona-card` spec 仍保留 2 个 + 1 段已不再实现的需求，规范与代码已脱节。本 change 把这些条目从 spec 中同步删除/修订，恢复规范作为可信来源的状态。

## What Changes

- **BREAKING**：移除 `persona-card` 规范的「仅基于派生数据的分享链接」整段 requirement
- **BREAKING**：移除 `persona-card` 规范的「分享链接落地页布局」整段 requirement
- 修改 `persona-card` 规范的「按风格重合成」requirement，删去其中「每个风格变体得到自己的分享链接」一句及配套的 `/persona/<id>` 路径描述；保留"换风格"行为本身（功能仍在）
- 不动 `persona-agent`、`bookmark-import`、`homepage-samples`、`api-safeguards` 任何 requirement——这次只是规范层面的清理，代码层面已无改动

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `persona-card`: 删除两段分享链接相关 requirement；按风格重合成段落剥离分享语义

## Impact

- **代码**：零变更——代码侧的删除已先行完成（见会话外部，未走 openspec 流程）。本 change 仅做规范回填。
- **影响面**：规范文档 `openspec/specs/persona-card/spec.md` 删除约 2 段 requirement、修改 1 段
- **风险**：极低。删除的规范条目对应的实现已不存在，规范与现实一致是修正行为
- **依赖**：无

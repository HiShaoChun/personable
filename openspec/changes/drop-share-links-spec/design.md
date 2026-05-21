## Context

代码侧已完成分享链接功能的整体下线（前序非正式重构）：

- 删 `src/app/persona/[id]/page.tsx` 与 `src/app/privacy/page.tsx`
- 删 `src/lib/store.ts` 的 `putCard` / `getCard` / `CardEnvelope`
- `/api/persona`、`/api/regenerate` 不再生成或返回 card id
- `PersistedRun` 砍掉 `id` 字段，`STORAGE_VERSION` bump 至 6
- 首页副标题去掉"可分享"、layout meta description 同改
- `InterestCluster.blurb` 历史字段一并清掉（曾因兼容旧 share JSON 而保留）

但 `openspec/specs/persona-card/spec.md` 仍保留 2 个分享链接相关的 requirement 和 1 处子句，规范脱离现实。

## Goals / Non-Goals

**Goals:**
- 把 `persona-card` 规范修订到与当前实现一致
- 删除已不存在的"分享链接"全部规范条目
- 保留"按风格重合成"的核心行为（仍在用）

**Non-Goals:**
- 不重新实现分享链接（已确认不要）
- 不动其他 spec 文件
- 不改任何代码

## Decisions

### D1：REMOVED 还是 MODIFIED

两个分享相关 requirement（「仅基于派生数据的分享链接」「分享链接落地页布局」）整段都不再实现 → 用 **REMOVED**，并按 openspec 约定填 `Reason` 与 `Migration`。

「按风格重合成」requirement 的核心行为（点不同 vibe 拿到不同合成）仍在，只是不再产出独立分享链接 → 用 **MODIFIED**，重写整段。

### D2：Migration 文本怎么写

REMOVED 的 `Migration` 字段——既然功能整体下线、无替代方案，写"无替代；分享链接功能已下线，前端不再暴露分享入口"即可，避免假装提供迁移路径。

## Risks / Trade-offs

- **Risk**：未来若想恢复分享链接，本 change 删掉的规范需要重新写 → **Mitigation**：删除是诚实表达"当前不做"，重新加回时再走正向 change 流程，更清楚
- **Trade-off**：本 change 只动规范不动代码，看似"空操作"，但保持 spec 作为可信来源 → 值得

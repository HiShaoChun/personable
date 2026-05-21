## Why

`computeOverview` 已经能本地、零延迟地算出 5 组叙事素材（rhythm / bingeDays / identityPhases / concentration / folderHealth），目前却只喂给 LLM 当 prompt evidence。用户在 cluster 阶段要等几秒 LLM 思考，这段空白完全可以用「只属于这位用户的」可视化切片填满——既缓解等待焦虑，又把"数据其实就在你浏览器本地"这件事变得可见，强化隐私观感。

## What Changes

- 在主页 `.steps` 容器内，"已读取 N 条书签"和"已聚出 N 个兴趣簇"两个 Step 之间，插入新的「你的数据切片」可视化区
- 4 张纯 SVG 手写图表，零依赖：
  - **昼夜节律环**（`rhythm`）：24 小时极坐标热力环，中央显示 hourBucket 标签与周末占比
  - **身份相位时间线**（`identityPhases`）：横向时间轴胶囊串，每年节点挂主域名/主文件夹/条数
  - **狂囤日高光**（`bingeDays`）：spotlight 卡片（最多 3 张，1 号位放大）
  - **集中度仪表**（`concentration`）：180° 半圆 gauge + 三档标签
- Reveal 编排：`overview` 事件到达后整区淡入，4 图错峰入场（200/300/300/300ms），与 `cluster_thinking` 流式同时进行
- 降级策略：每张图在缺少必要数据时（如 `rhythm.datedCount=0`、`bingeDays.length=0`、`identityPhases.length<2`）整图省略，不渲染占位也不强行编造
- 在 `done` 阶段保留可见，作为 PersonaCard 的"实证注脚"

## Capabilities

### New Capabilities
- `homepage-data-slices`: 主页 overview 阶段后的本地数据可视化区，含 4 张 SVG 图表及其 reveal/降级规则

### Modified Capabilities
（无 spec 级行为修改：`persona-agent` 的 overview 数据形态没变；`persona-card` 的 PersonaProfile schema 没变；`bookmark-import` 解析逻辑没变。）

## Impact

- **新增组件**：`src/components/DataSlices.tsx`（容器 + 4 个子组件，或拆 5 文件）
- **新增样式**：`src/app/globals.css` 追加 `.data-slices` 系列样式
- **修改 `src/app/page.tsx`**：
  - 把完整 `overview` 对象暂存到 state（当前只取了 total / dateRange 进 `ovStat`），其余字段透传给新组件
  - 在 `.steps` 中"已读取"和"已聚出"两个 `<Step>` 之间渲染 `<DataSlices overview={...} />`
- **不动**：`overview.ts` / `synthesize.ts` / `schema.ts` / `cluster.ts` / `/api/persona` / `/api/regenerate` —— 这次纯前端渲染
- **localStorage 持久化**：新增 `overview` 字段进 `PersistedRun`，version 升到 4，旧版本静默丢弃（与既有降级一致）
- **依赖**：零新增。所有 SVG 手写

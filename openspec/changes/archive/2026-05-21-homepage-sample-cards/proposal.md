## Why

新用户进入首页时只看到「标题 + 一段说明 + 拖拽区」，看不到产品真正产出的样子，
导致「这玩意儿是干嘛的」这一步要靠脑补——而本产品的核心 wow 点正是那张
最终的人格卡。在首页直接展示几张做好的示例卡，可以让访客一眼就理解产出形态、
顺便感知到「换风格」这个差异化能力，且不消耗任何 LLM/抓取预算。

## What Changes

- 在首页 `idle` 阶段，于拖拽上传区下方新增「看看别人的卡片」示例画廊：
  - 静态预制 3 份 `PersonaProfile`，每份对应一个不同 `Vibe`（`earnest` /
    `roast` / `poetic`），完整演示风格差异
  - 默认以缩略形式并排展示（移动端堆叠），点击某张展开为完整 `PersonaCard`
    渲染
  - 纯前端静态数据，不调用 `/api/persona` 或 `/api/regenerate`，不写
    localStorage、不占用 budget
- 示例画廊仅在 `phase === "idle"` 且没有持久化 profile 时显示；用户上传后
  或已有恢复态时不出现，避免与真实产物视觉竞争
- 主入口（拖拽区）位置和样式不变，示例位于其下方作为辅助理解

## Capabilities

### New Capabilities
- `homepage-samples`: 首页 idle 态下的预制示例人格卡画廊：静态数据来源、
  vibe 覆盖、展开交互、与主流程的可见性互斥

### Modified Capabilities
（无）

## Impact

- 新增文件：
  - `src/lib/samples.ts`：导出 3 份预制 `PersonaProfile` 静态数据
  - `src/components/SampleGallery.tsx`：画廊容器组件，复用 `PersonaCard`
- 修改文件：
  - `src/app/page.tsx`：在 `phase === "idle" && !profile` 分支末尾挂载画廊
  - `src/app/globals.css`：画廊缩略 / 展开 / 响应式样式
- 不影响：API 路由、agent 流程、持久化、分享链接、`PersonaCard` 组件本身

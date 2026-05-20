## Why

合成人格卡是整个流程的"高潮时刻"——用户在等待与铺垫之后期望值很高。当前卡片
在 `phase === "done"` 时直接渲染、无入场动效，仪式感不足，浪费了之前累积的注意力。
通过给卡片首次出现加上"翻转 + 轻微弹跳落定 + 元素错峰显示"的入场动效，把这个
节点变成有节奏的揭晓时刻；同时为"换个风格重新生成"的二次/多次出现提供更短的
动效变体，避免重复操作时的等待负担。

## What Changes

- 给 `PersonaCard` 新增入场动效：3D 翻转（卡背 → 卡面）+ 落定时的轻微弹跳；
  随后卡内元素按顺序错峰出现（headline → traits chips → clusters → evolution
  → disclaimer）。
- 区分两种播放模式：
  - **首次播放**（完整版）：翻转 ~600ms + 落定弹跳 ~200ms，之后元素 stagger
    总时长在 800ms 入场之上再加 ~300–500ms。
  - **重生成播放**（缩短版）：跳过翻转，仅做短淡入 + 元素 stagger 大幅压缩
    （或省略），整体不超过 ~300ms。
- 不引入粒子、光晕或背景陪衬效果（保持卡片本身是视觉焦点）。
- 尊重 `prefers-reduced-motion`：开启者直接展示终态，无翻转无弹跳。

## Capabilities

### New Capabilities
<!-- 无新 capability -->

### Modified Capabilities
- `persona-card`: 新增「卡片入场动效」需求，明确首次 vs 重生成的播放策略与
  可访问性回退。

## Impact

- 代码：
  - `src/components/PersonaCard.tsx`：新增 props 控制播放模式（首次/重生成），
    内部按阶段触发 className 切换。
  - `src/app/globals.css`：新增翻转、弹跳、stagger 相关 keyframes 与
    `.card.reveal-*` 样式。
  - `src/app/page.tsx` 与 `src/app/c/[id]/page.tsx`：在传入 `PersonaCard` 时
    指定播放模式（done 后首次 vs 用户点击「换个风格」后的二次）。
- 依赖：纯 CSS 动效，不引入新依赖。
- 风险：动效与图片导出（html-to-image）的时机需要互斥——导出时应当读取
  终态而不是动效中间帧。

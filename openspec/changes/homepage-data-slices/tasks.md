## 1. 数据流改造

- [x] 1.1 在 [src/app/page.tsx](../../../src/app/page.tsx) 新增 React state `overview: Overview | null`
- [x] 1.2 收到 NDJSON `phase: "overview"` 事件时，把完整 `ev.overview` 对象存进新 state（保留现有 `ovStat` 派生行为或改为从 `overview` 现算）
- [x] 1.3 在 `handleFile` 开头 `setOverview(null)` 重置；`localStorage` 恢复路径回填 `overview`
- [x] 1.4 `STORAGE_VERSION` 升至 `4`；`PersistedRun` 加 `overview: Overview | null`；所有 `persistRun(...)` 调用补传 `overview` 字段；闭包 `runOverview` 与既有 `runOvStat` 并列收尾

## 2. 共享样式与容器

- [x] 2.1 [src/app/globals.css](../../../src/app/globals.css) 追加 `.data-slices` 容器样式：暗背景 + 1px 弱青描边、`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`、间距 16px
- [x] 2.2 标题样式 `.data-slices-title`：左侧 ▍青色装饰条 + 主标题 + 副标题「· 本地计算，未上传」灰字
- [x] 2.3 reveal 关键帧：`@keyframes data-slice-in { from { opacity:0; transform:translateY(8px) } to { opacity:1 } }`
- [x] 2.4 容器入场 200ms，子图通过 inline `animation-delay` 控制 200/500/800/1100ms 错峰

## 3. 节律环组件（① RhythmRing）

- [x] 3.1 新建 [src/components/data-slices/RhythmRing.tsx](../../../src/components/data-slices/RhythmRing.tsx)
- [x] 3.2 入参 `{ rhythm: Overview["rhythm"] }`；`datedCount === 0` 时返回 `null`
- [x] 3.3 实现 `hourToAngle(h)` —— hour 0 在顶部、顺时针展开（注意 SVG y 轴向下）
- [x] 3.4 24 段 SVG `<path>` 圆环段，每段亮度=该 hour count / 全局 max；峰值段加亮色 stroke
- [x] 3.5 中央叠加 hourBucket 大字 + 下方小字「周末占比 NN%」（无 `topHours` 时省略）

## 4. 身份相位时间线组件（② IdentityPhasesTimeline）

- [x] 4.1 新建 [src/components/data-slices/IdentityPhasesTimeline.tsx](../../../src/components/data-slices/IdentityPhasesTimeline.tsx)
- [x] 4.2 入参 `{ phases: Overview["identityPhases"] }`；`phases.length < 2` 时返回 `null`
- [x] 4.3 水平基线 `<line>`，节点 `<circle>` 大小与 `total` 成正比（min 8、max 18）
- [x] 4.4 节点下方挂胶囊：年份大字 + 文件夹/域名/条数小字（HTML `<div>` 套在 `<foreignObject>` 或直接绝对定位）
- [x] 4.5 胶囊文字单行 ellipsis + `title` 属性提示完整内容

## 5. 狂囤日高光组件（③ BingeDaysSpotlight）

- [x] 5.1 新建 [src/components/data-slices/BingeDaysSpotlight.tsx](../../../src/components/data-slices/BingeDaysSpotlight.tsx)
- [x] 5.2 入参 `{ bingeDays: Overview["bingeDays"], topHours: Overview["rhythm"]["topHours"] }`；`bingeDays.length === 0` 时返回 `null`
- [x] 5.3 1 号位卡片放大（约 60% 宽），2/3 号位并排或纵列在右侧
- [x] 5.4 每张卡显示 `date`、`count` 条、`topFolder`；1 号位附描述句（结合 hourBucket：「一个深夜囤了 N 个」/「下午囤了 N 个」）
- [x] 5.5 主要用 HTML/CSS 而非 SVG（这张图是卡片不是图形）；放在 `.data-slices` grid 网格里保持视觉一致

## 6. 集中度仪表组件（④ ConcentrationGauge）

- [x] 6.1 新建 [src/components/data-slices/ConcentrationGauge.tsx](../../../src/components/data-slices/ConcentrationGauge.tsx)
- [x] 6.2 入参 `{ concentration: Overview["concentration"] }`；`total <= 0` 时返回 `null`
- [x] 6.3 SVG 180° 半圆轨道（`<path d="M ... A ..." />`），三段不同颜色（青/金/紫）
- [x] 6.4 指针 `<line>` 由 `gini` 线性映射到 [180°, 0°]，原点在半圆圆心
- [x] 6.5 三档标签沿弧线分布，当前 `label` 文字高亮、另两档灰化
- [x] 6.6 下方小字「gini 0.42 · top5 域名占 38%」

## 7. 容器组件 DataSlices

- [x] 7.1 新建 [src/components/data-slices/DataSlices.tsx](../../../src/components/data-slices/DataSlices.tsx) 作为入口
- [x] 7.2 入参 `{ overview: Overview | null, reveal: "first" | "quick" | "none" }`
- [x] 7.3 `overview === null` 时返回 `null`；4 个子图全部因降级返回 `null` 时容器也返回 `null`
- [x] 7.4 `reveal !== "none"` 时为容器与 4 个子节点设置 inline `animation-delay`；`reveal === "none"` 跳过动画
- [x] 7.5 渲染标题 + grid 网格 + 4 子组件

## 8. 集成到 page.tsx

- [x] 8.1 import `DataSlices` 与 `Overview` 类型
- [x] 8.2 在"已读取 N 条"`<Step>` 与"已聚出 N 个兴趣簇"`<Step>` 之间插入 `<DataSlices overview={overview} reveal={reveal} />`
- [x] 8.3 验证 `phase === "thinking"` 与 `phase === "done"` 两种状态下都正常显示

## 9. 验证

- [x] 9.1 `npm run test:fixtures` 仍 33/33 通过（不应受影响）
- [x] 9.2 `npm run lint` 与 `npm run typecheck` 无新增错误（既有 stale `.next/types` 错误可忽略）
- [ ] 9.3 `npm run dev` 后手动验证：用真实书签上传，4 张图按顺序入场，cluster thinking 在下方并行吐字
- [ ] 9.4 退化场景手测：找一份全无 `ADD_DATE` 的书签 HTML，确认节律/时间线/狂囤日三图省略，仅仪表渲染
- [ ] 9.5 刷新页面验证 localStorage 恢复：图表静态显示、不重播动画
- [ ] 9.6 移动端宽度（< 720px）验证单列堆叠正常

## 10. 修订：4 图重写（2026-05-21）

- [x] 10.1 `src/lib/agent/overview.ts` 在 `rhythm` 接口与 `computeOverview` 实现里追加 `bucketShares: Record<HourBucket, number>` 字段；O(n) 单遍扫描内完成
- [x] 10.2 `scripts/verify.ts` 追加断言：`bucketShares` 5 键齐全、`datedCount > 0` 时和 ≈ 1、`datedCount === 0` 时全 0
- [x] 10.3 新增 `src/components/data-slices/SliceFrame.tsx`：统一标题 + 副说明 + body 的容器组件
- [x] 10.4 重写 `RhythmRing.tsx` → 改名 `TimeOfDayBars.tsx`：5 段横向占比条；峰值段视觉高亮；标题「收藏时段」+ 副「这一天里，你什么时候在收藏」
- [x] 10.5 重写 `IdentityPhasesTimeline.tsx` → 改名 `TopicDrift.tsx`：N 列 × 最多 3 行 chips，相邻列同名词以 SVG 折线连接；标题「主题漂移」+ 副「跨年还在的词 vs 新冒出的词」
- [x] 10.6 修 `BingeDaysSpotlight.tsx`：删描述句、补星期、`(无文件夹)`→`未分类`；标题「突击收藏日」+ 副「单日 ≥ 3 条」
- [x] 10.7 重写 `ConcentrationGauge.tsx` → 改名 `ConcentrationBar.tsx`：水平横条 + 滑块；隐藏 gini；标题「注意力分布」+ 副「书签是堆在几个老地方，还是撒得到处都是」
- [x] 10.8 `DataSlices.tsx`：用 `SliceFrame` 替换 inline 包裹，按新组件 import 路径调整
- [x] 10.9 `globals.css`：删除老的 `.rhythm-ring*` `.identity-phase*` `.concentration-gauge*`，追加新 5 类样式（时段柱 / 主题漂移 / 突击收藏日（小改） / 注意力横条 / SliceFrame 标题）
- [x] 10.10 `npm run test:fixtures` + `npm run typecheck` 全绿

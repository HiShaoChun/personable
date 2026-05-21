## Context

`computeOverview` 在 [src/lib/agent/overview.ts](../../../src/lib/agent/overview.ts) 已产出 9 个字段（含 5 组叙事素材），通过 NDJSON `overview` 事件到达前端。当前 [src/app/page.tsx](../../../src/app/page.tsx) 只读取 `total` 与 `dateRange` 拼成一行文字（"已读取 120 条书签 · 2020-08-18 ~ 2026-04-03"），其余 5 组数据透明流过——本提案要把这些数据可视化。

主页流程：`idle → parsing → thinking (cluster → synth) → done`。`overview` 事件在 `thinking` 阶段开头（cluster 思考流之前）到达，cluster 阶段 LLM 耗时通常 3-8 秒，是天然的等待窗口。

## Goals / Non-Goals

**Goals:**
- 把 `overview` 的 4 组叙事素材（rhythm / identityPhases / bingeDays / concentration）做成 4 张纯 SVG 图表
- 放在 `.steps` 内"已读取"和"已聚出"两个 Step 之间
- 与 cluster thinking 并行 reveal，把 LLM 等待时间填满"只属于你的"内容
- `done` 阶段保留可见，作为 PersonaCard 的实证注脚
- 隐私观感：明确标注「本地计算，未上传」

**Non-Goals:**
- 不做 `folderHealth` 的可视化——偏 meta、不够"人味"，仍只喂 LLM
- 不引入 recharts/d3/echarts 等图表库
- 不改 `overview` 的字段形态、不改 `synthesize`、不改 `schema`、不改任何 LLM 调用
- 不做交互式 drill-down（hover tooltip 可有可无；点击下钻不做）
- 不为移动端做"翻页"或"轮播"——单列堆叠即可

## Decisions

### D1：放在 `.steps` 内而非卡片下方
**选择**：放在 `.steps` 容器内，"已读取"和"已聚出"两个 `<Step>` 之间。

**理由**：
1. 用户原意（截图圈了"已读取"这一行）
2. `.steps` 在 `phase !== "idle"` 时常驻显示（`thinking` 与 `done` 都在），自然覆盖"等待中"+"完成后"两个时机
3. `cluster_thinking` 文本流在更下方继续吐字，4 张图与文字流形成"图表填上面 + 文字填下面"的并行视觉

**舍弃方案**：放在 PersonaCard 下方仅在 `done` 后可见——浪费了等待期可填充的几秒，且与"实证注脚"叙事弱化（数据应该是先于结论出现，而不是结论之后再补）。

### D2：纯手写 SVG，零依赖
**选择**：4 张图都用原生 `<svg>` + 计算函数手写。

**理由**：
1. 4 张图形状都简单（极坐标环、横线 + 圆点、矩形卡、半圆 gauge）——recharts 这种库为了通用性反而难调形
2. 项目目前零图表依赖，引入会增加 bundle 体积与维护面
3. 数据点数极小（rhythm 24、identityPhases ≤4、bingeDays ≤3、concentration 1 个值），没有性能问题
4. Tailwind 没用——项目用纯 CSS，与 SVG 内联 style 协同自然

**舍弃方案**：visx / recharts 都因体积与对暗色主题的二次定制成本被否。

### D3：Reveal 编排策略
**选择**：用 CSS `animation-delay` 错峰，不用 React 状态机。

**时序**：
- T0：`overview` 事件到达 → 容器淡入 200ms
- T0+200ms：① 节律环淡入 + 上滑 8px
- T0+500ms：② 时间线
- T0+800ms：③ 狂囤日
- T0+1100ms：④ 仪表

**理由**：纯 CSS 入场比 React setTimeout 状态机简单且不可阻塞主线程。容器挂载时一次性把 `animation-delay` 写在子节点的 inline style 或 CSS 变量上即可。

### D4：降级规则（每张图独立）
**选择**：每张图依据自身字段决定渲不渲染，缺数据时整图省略（不渲染占位灰块）。

| 图 | 渲染条件 |
|---|---|
| ① 节律环 | `rhythm.datedCount > 0` |
| ② 时间线 | `identityPhases.length >= 2` |
| ③ 狂囤日 | `bingeDays.length >= 1` |
| ④ 仪表 | `total > 0`（基本永远满足） |

如果 4 张全省略（极端：< 3 条无日期的书签），整个容器也不渲染。这种情况通常已经在更早的入口拦截（< 3 条直接报错）。

**理由**：spec 已规定「不要逼模型编造」，前端同样应保持克制——缺数据画灰块比省略更刺眼。

### D5：完整 overview 传递路径
**选择**：把整个 `overview` 对象存到 React state（命名 `overview`），不再只存衍生的 `ovStat`。`ovStat` 改为派生计算。

**localStorage**：`PersistedRun` 新增 `overview: Overview | null` 字段，version 升到 `4`。旧版本走既有的"版本不匹配→静默丢弃"路径，无需迁移代码。

**理由**：4 张图各需要 overview 的不同子字段，集中存一份比拆 4 个 state 更干净。`ovStat` 是为了在 Step 标签里显示一行文字而存在的派生值，可以从 `overview` 现算。

### D6：响应式
**选择**：
- 桌面（≥ 720px）：2×2 网格，每格固定高度（节律 240、时间线 200、狂囤 240、仪表 200）
- 移动（< 720px）：单列堆叠，按 reveal 顺序 ①②③④
- 用 CSS Grid 的 `auto-fit` + `minmax(280px, 1fr)`，不写媒体查询也能自适应（除非格高差异要单独控）

### D7：暗色主题色板
继承现有：背景与 `.deep-panel` 同（rgba(0,0,0,0.3) 类的暗灰），描边 1px 弱青；图表强调色用现有 accent（青/cyan）。集中度三档配色：
- 广撒网：青（与 accent 同）
- 均衡：金（warning 调）
- 死忠粉：紫（暗色背景上对比好）

## Risks / Trade-offs

- **Risk**：reveal 编排与 cluster thinking 视觉并行可能让屏幕信息密度过高 → **Mitigation**：4 图都用较暗的背景与较低饱和的颜色，cluster thinking 区维持现有亮度，靠对比把"读"的视觉重心引导到文字
- **Risk**：手写 SVG 极坐标算法出 bug（hour 12 顺序、角度起点） → **Mitigation**：单元测试覆盖关键映射函数（`hourToAngle`、`pointOnRing`），不依赖肉眼
- **Risk**：身份相位胶囊在 4 个节点 + 长文件夹名时容易溢出 → **Mitigation**：胶囊内文字单行 `ellipsis`，hover/tap 显示完整 title 属性
- **Risk**：旧 localStorage `STORAGE_VERSION=3` 用户升级后丢失上次卡片 → **Mitigation**：与现有 v2→v3 升级行为一致，静默丢弃即可，用户重新上传即可恢复
- **Trade-off**：放弃 `folderHealth` 可视化 → 仍在 prompt 中给 LLM 用，前端少一张图换来视觉聚焦
- **Trade-off**：CSS animation-delay 不可被 React 中断（用户提前切走只能等 CSS 跑完） → 4 图总入场 1.4s，远短于 cluster 阶段总时长，体感无问题

## 修订（2026-05-21）：4 图重写

实测发现 4 张图 **视觉先于语义**——画了图才补术语，导致一眼看过去信息错漏。本次修订彻底重做表达层：

### 修订点

- **① 节律环 → 收藏时段柱**：极坐标对普通人不友好；改成 5 段（深夜/凌晨/上午/下午/晚间）横向占比条。此改动需要 `rhythm.bucketShares` 5 段分布字段（详见下方 D8）。
- **② 身份相位时间线 → 主题漂移图**：原柱状图只反映"那年活跃度"，与"身份相位"语义不符。改成 N 列 chips（每列 ≤ 3 主题词），同名词跨年连线，斜率反映排名变化。
- **③ 狂囤日 → 突击收藏日**：术语降噪；删除 **「一个深夜囤了 N 个」描述句**（bug：用了全局 `hourBucket` 套到单日，违反 D9.3 硬规则）；补充星期；`(无文件夹)` → `未分类`。
- **④ 集中度仪表 → 注意力分布横条**：半圆 + 三档标签让人难判断；改成左右两端标签的连续横条 + 滑块；隐藏 `gini` 数值。

### D8（新增）：`rhythm.bucketShares` 字段

`computeOverview` 在原 `rhythm` 内增加：

```ts
bucketShares: Record<"深夜" | "凌晨" | "上午" | "下午" | "晚间", number>;
```

值域 [0, 1]，5 段加和等于 1（前提：`datedCount > 0`；为 0 时 5 段全 0）。计算在原本一次扫描循环里完成，O(n) 不变。原 `hourBucket`、`topHours`、`weekendShare`、`datedCount` 不变。

**为何放弃"不动 overview"**：5 段占比无法从已暴露的 `topHours`（仅 top 3 小时）反推出来，强行近似会失真。本字段是纯前端可视化所需，与 `synthesize` prompt 无关——加进 prompt evidence 也可（一行）但本次不做，避免发散。

### D9（新增）：3 条表达硬规则

适用于所有图表组件：

1. **标题与副说明**：每张图必须有 H4 标题 + 一行 ≤ 18 字白话副说明
2. **去黑话**：`gini`、`身份相位`、`集中度`、`狂囤` 等术语不得出现在用户可见文案
3. **描述句基于自身**：任何针对单数据点的短描述必须只用该点字段，禁止把全局聚合值套到单点

为方便统一应用，新增组件 `<SliceFrame title subtitle>`，4 张图全部用它包裹；标题/副说明集中维护，避免散落到 4 个组件。

### Risk（新增）

- **Risk**：增加 `rhythm.bucketShares` 后旧 fixture 测试可能因接口形态变化而失败 → **Mitigation**：在 `scripts/verify.ts` 追加 1 条对 `bucketShares` 总和 ≈ 1 与 5 键齐全的断言；既有 33 条断言不变
- **Risk**：主题漂移图的 SVG 连线在窄屏（< 360px）可能拥挤 → **Mitigation**：列宽 minmax 70px，超过 4 年时把更早的相位合并到「之前」一列；本次先按 ≤ 4 期保护，超过再加合并逻辑

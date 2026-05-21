## ADDED Requirements

### Requirement: 数据切片区位置与可见性

主页 `.steps` 容器内，在"已读取 N 条书签"`<Step>` 和"已聚出 N 个兴趣簇"`<Step>` 之间，渲染一个标题为「**你的数据切片** · 本地计算，未上传」的可视化区，包含至多 4 张图表。该区在 `overview` 事件到达后渲染，在 `thinking`、`done` 阶段都保留可见。

#### Scenario: overview 事件到达后可见
- **WHEN** 用户上传书签，前端收到 NDJSON `overview` 事件
- **THEN** 数据切片区出现在"已读取"与"已聚出"两个 Step 之间
- **AND** 区域内根据 overview 各字段是否满足条件，依次渲染对应图表

#### Scenario: done 阶段保留可见
- **WHEN** 用户已看到最终 PersonaCard（`phase === "done"`）
- **THEN** 数据切片区仍在 `.steps` 容器内保持可见
- **AND** 不重复入场动画

#### Scenario: 用户刷新页面后恢复
- **WHEN** 用户刷新页面，前端从 localStorage 恢复 `PersistedRun`
- **THEN** 如恢复的快照含完整 `overview`，数据切片区按原状渲染
- **AND** 不重播 reveal 动画

### Requirement: 表达硬规则（适用于全部 4 张图）

为防止"视觉先于语义"，全部 4 张图必须遵守以下 3 条硬规则：

1. **必须有标题与白话副说明**：每张图顶部一行 H4 标题（≤ 6 字）+ 一行 ≤ 18 字的白话副说明，解释这张图要传达的事
2. **禁止统计/产品黑话**：用户可见文案中不得出现 `gini`、`身份相位`、`集中度`、`狂囤` 等术语；统一替换为白话表达
3. **描述句必须基于该数据点自己**：任何"短描述"必须只来自当前数据点的字段，禁止把全局聚合值（如全局 `hourBucket`）套到单个点的描述上

#### Scenario: 每张图都有标题与副说明
- **WHEN** 数据切片区渲染任何一张图
- **THEN** 图的容器顶部含 H4 标题与一行副说明
- **AND** 副说明使用日常口语，不出现统计术语

#### Scenario: 描述句不能引用全局值套单点
- **WHEN** 图表的某个数据点（例如某一天）需要附带一句描述
- **THEN** 该描述必须仅基于该数据点自身的字段
- **AND** 不得引用全局聚合值（如 `rhythm.hourBucket`）来描述单日

### Requirement: 收藏时段柱（rhythm 5 段占比）

第 1 张图，按 5 时段（深夜 / 凌晨 / 上午 / 下午 / 晚间）展示用户收藏书签的时间分布。每段一根横向条，长度 = 该时段占有日期书签数的占比。当前峰值时段视觉高亮。

标题：「**收藏时段**」 · 副说明：「这一天里，你什么时候在收藏」

`overview.rhythm` 新增 `bucketShares: Record<HourBucket, number>` 字段，由 `computeOverview` 一次扫描计算，5 段加和等于 `weekendShare` 的同源（不是同义，只是同源扫描）。

#### Scenario: 有时间数据时渲染
- **WHEN** `rhythm.datedCount > 0`
- **THEN** 渲染 5 行横向条，每行：时段名 + 进度条 + 百分比
- **AND** 占比最大的时段视觉高亮（更亮颜色 / 加粗）
- **AND** 副说明下方一行小字显示周末占比（如「周末占 31%」）

#### Scenario: 无时间数据时省略
- **WHEN** `rhythm.datedCount === 0`
- **THEN** 整图不渲染

### Requirement: 主题词漂移图（identityPhases）

第 2 张图，每年一列，列内自上而下排列该年的 top 3 `topFolders`（末段路径，去掉「书签栏 /」前缀），用细线把同一主题词在相邻年份之间相连；线条的「水平 vs 斜向」直接折射该词在年度排名内的变化。

标题：「**主题漂移**」 · 副说明：「跨年还在的词 vs 新冒出的词」

#### Scenario: 至少 2 个相位时渲染
- **WHEN** `identityPhases.length >= 2`
- **THEN** 渲染 N 列，每列 ≤ 3 个主题词 chip
- **AND** 同一主题词在相邻列中出现时，用细线连接（保留斜率以反映排名变化）
- **AND** 仅在某一年出现的词不连线（视为"那年的新角色"）

#### Scenario: 相位不足时省略
- **WHEN** `identityPhases.length < 2`
- **THEN** 整图不渲染

#### Scenario: 鼠标悬停看完整信息
- **WHEN** 用户 hover 某个主题词 chip
- **THEN** chip 的 `title` 属性显示完整路径 + 该年总条数

### Requirement: 突击收藏日（bingeDays）

第 3 张图，列出单日 ≥ 3 条的 top 3 收藏密集日。1 号位放大显示，2、3 号位（如有）缩小并列。每张卡显示：

- 日期（含星期，从 date 字符串推算）
- 当日条数
- 当日主文件夹（缺失时显示「未分类」而非「(无文件夹)」）

标题：「**突击收藏日**」 · 副说明：「单日 ≥ 3 条」

**禁止描述句使用全局 `hourBucket` 套到单日**——因为 overview 不存"每日小时直方图"，单日时段无法可信地得出。

#### Scenario: 至少 1 个突击日时渲染
- **WHEN** `bingeDays.length >= 1`
- **THEN** 渲染 spotlight 卡片，1 号位最大
- **AND** 每张卡显示日期（含星期）、当日条数、当日主文件夹

#### Scenario: 主文件夹缺失时
- **WHEN** 某突击日的 `topFolder` 是「(无文件夹)」或空字符串
- **THEN** 卡片显示为「未分类」

#### Scenario: 无突击日时省略
- **WHEN** `bingeDays.length === 0`
- **THEN** 整图不渲染

### Requirement: 注意力分布横条（concentration）

第 4 张图，水平横条 + 滑块。滑块 X 位置 = `1 - concentration.gini`，即"越靠右越分散"。横条左端标「几个站霸屏」、右端标「分散到很多站」。**不显示 gini 数值**；副信息只显示「top 5 域名占 NN%」这一可读量。

标题：「**注意力分布**」 · 副说明：「书签是堆在几个老地方，还是撒得到处都是」

#### Scenario: 总有书签时渲染
- **WHEN** `total > 0`
- **THEN** 渲染水平横条 + 滑块
- **AND** 滑块位置基于 `1 - gini`（gini 高 → 滑块靠左）
- **AND** 不在可见文案中出现「gini」字样
- **AND** 副信息显示「top 5 域名占 NN%」

### Requirement: 入场 reveal 编排

`overview` 事件到达后，数据切片容器与 4 张图按以下时序入场：

| 节点 | 延迟 |
|---|---|
| 容器淡入 | 0ms |
| ① 收藏时段柱 | 200ms |
| ② 主题漂移 | 500ms |
| ③ 突击收藏日 | 800ms |
| ④ 注意力分布 | 1100ms |

#### Scenario: 首次出现按时序入场
- **WHEN** 数据切片区首次挂载（非 localStorage 恢复）
- **THEN** 容器先淡入，4 张图按上表错峰入场
- **AND** 与下方 cluster thinking 流式吐字同时进行
- **AND** 总入场时长不超过 1.4s

#### Scenario: 恢复时跳过 reveal
- **WHEN** 数据切片区因 localStorage 恢复而挂载（`reveal === "none"`）
- **THEN** 全部图表直接显示，不播 reveal 动画

### Requirement: 完整 overview 透传

[src/app/page.tsx](../../../src/app/page.tsx) 在收到 NDJSON `overview` 事件后，必须把完整 `Overview` 对象存到 React state，而非只提取 `total` + `dateRange`。Step 行的"已读取 N 条 · 时间跨度"文字从该 state 派生计算。

#### Scenario: overview 事件被完整保存
- **WHEN** 收到 `{ phase: "overview", overview: {...} }`
- **THEN** 前端把完整 `overview` 对象存到 React state（命名 `overview`）
- **AND** 数据切片组件接收该 overview 作为 prop
- **AND** "已读取 N 条书签 · 时间跨度" 文字仍正确显示

### Requirement: 持久化升级

`PersistedRun` 的 `STORAGE_VERSION` 升到 `4`，新增 `overview: Overview | null` 字段。挂载时 `version !== 4` 的旧记录走既有的"静默删除"路径。

#### Scenario: 新版本写入与读取
- **WHEN** `phase === "done"` 触发 `persistRun`
- **THEN** 写入的 JSON 含 `version: 4` 与完整 `overview` 字段

#### Scenario: 旧版本静默丢弃
- **WHEN** localStorage 中存在 `version === 3` 或更早的记录
- **THEN** 挂载时识别版本不匹配，删除记录，进入 idle 态
- **AND** 不向用户报错

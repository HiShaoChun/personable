# 收紧人格卡密度——特质 3-5、兴趣簇硬阈值 + top 5

> 卡片是"海报"不是"报告"。把特质上限从 7 收到 5、对兴趣簇加硬阈值
> 过滤（`size < max(3, ceil(total * 5%))` 必砍）并限 top 5 画进度条、
> 多余的簇名汇总为一行小字「其他散点：A、B、C」。整套过滤在服务端
> `normalizeProfile` 阶段完成，分享链接 JSON 形态自洽。

## Why

实际跑出来的卡有 7 条特质 + 7 个兴趣簇，肉眼能看出两类问题：

1. **特质 7 条稀释了人设**。认知心理学的"工作记忆甜区"是 5±2，特质
   多到 7 条时单条信息密度被摊薄，每个 tag 都"差不多重要"等价于
   "都不重要"。截图分享场景里没人会读完 7 条。
2. **兴趣簇长尾是噪声**。最尾的「英语深度阅读 size=1」——一条书签
   构不成"簇"，是 LLM 聚类阶段的副产物（孤点也会被命名）。这种 size=1
   的"簇"和前面 size=36/18 的核心兴趣同样占一行 + 一个进度条 + 一句
   blurb 的视觉权重，把真正强烈的信号稀释掉了。

卡片当前的产品定位是"截图分享 + 自我对照"（archived 设计「玩具截图
传播」），海报形态需要克制——少而记得住 > 多而完整。今天的密度偏向
"报告"，本 change 把它扳回海报。

收紧规则的选择理由：

- **特质上限 5**：3-5 区间里 3 显单薄、5 是认知甜区下沿，给模型留些
  自由度同时硬封顶。下限保持 3（同今天）。
- **簇硬阈值 `max(3, ceil(total * 5%))`**：常数 3 砍掉孤点（size=1/2
  必定砍），百分比兜底大量级运行（total=800 时阈值=40，避免被中等规
  模噪声淹没）。两者取大值，单一公式覆盖所有规模。
- **簇软上限 top 5**：硬阈值过滤后再按 size 降序保留 5 个，多余的合
  并到"其他散点"。"5" 与特质同步，对仗简洁。
- **"其他散点"只列名字**：避免"+2 项""·3 个"这种数字化呈现勾起
  "为什么 X 被砍了"的间接信息。简单海报感最强。

## What Changes

- 在 [src/lib/agent/schema.ts](src/lib/agent/schema.ts) 的
  `PersonaProfile` 新增可选字段 `otherInterests?: string[]`——承载
  被硬阈值或软上限剔除的簇 name。
- 在 `validateProfile` 把 `traits` 上限从 7 改为 5（下限保持 3）。
- 在 `normalizeProfile` 加一段后处理：按 `total = sum(clusters.size)`
  算阈值 `cut = max(3, ceil(total * 0.05))`；先过滤 `size >= cut`，
  再按 size 降序取 top 5 作为 `clusters`，剩下的 name 写入
  `otherInterests`（同时 dedupe + 去空名）；`traits` 切片上限同步
  从 7 改为 5。
- 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的
  `buildPrompt` 把示例里 `"3到7条人格特质"` 改为 `"3-5条人格特质"`，
  让模型与新约束对齐（normalize 仍兜底，prompt 只是降低重试率）。
- 在 [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx)
  渲染 `otherInterests` 行：在所有 cluster 进度条之后、`evolution`
  之前，呈现为单行小字「其他散点：X、Y、Z」（用顿号分隔）；
  `otherInterests` 缺失或为空数组时整行不渲染，兼容旧分享链接。

## Capabilities

### Modified Capabilities
- `persona-agent`：「结构化画像输出」要求的 traits 上限从 7 改为 5；
  新增「按硬阈值与软上限过滤簇」要求，规定 normalize 阶段过滤口径与
  `otherInterests` 字段语义。
- `persona-card`：「人格卡渲染」要求新增 `otherInterests` 行渲染规则
  与对旧分享链接缺字段的兼容描述。

### New Capabilities
<!-- 无 -->

## Impact

- **受影响代码**：[src/lib/agent/schema.ts](src/lib/agent/schema.ts)（核心
  改动：类型 + validate + normalize）、[src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)（prompt
  文案一处微调）、[src/components/PersonaCard.tsx](src/components/PersonaCard.tsx)（新增
  一行渲染）。
- **受影响 spec**：`persona-agent` 与 `persona-card` 各一个增量。
- **token / 模型行为**：不改模型、不改重试次数；prompt 仅文案微调，
  对 token 用量影响可忽略。
- **重合成路径**：完全无变化——`synthesize` 任意 vibe 都走同一个
  `normalizeProfile`，过滤口径自动一致；precompute-vibe-variants 的
  预生成路径直接受益（拿到的卡也是收紧后的）。
- **旧分享链接（存量 putCard 记录）**：这些 JSON 里没有 `otherInterests`
  字段、`clusters` 仍是过滤前的旧形态。PersonaCard 渲染时
  `profile.otherInterests` 为 undefined→不渲染那一行；`clusters`
  按现有逻辑全画——视觉上和今天完全一致，不破坏既有分享。新生成
  的卡按新规则。
- **`evolution` 不动**：演变时间线和本 change 目标无关，密度问题
  集中在 traits + clusters。
- **回滚**：复原以上三个文件即可；旧/新 share JSON 共存无害。

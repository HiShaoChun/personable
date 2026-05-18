# 兴趣簇 vignette 化——故事感命名 + 主线/副线/番外定性标签

> 簇 = 一个"性格切片"，不是一个文件夹。把簇名从聚类阶段的分类标
> 签（"讯飞教育产线研发文档"）改为合成阶段按 vibe 重写的"动词暗
> 示 + 反差感"短语（"教育产线的隐形调度员"）；把簇侧的原始数字
> （26/17/10）替换成 render-time 派生的定性标签（主线/副线/番外）。

## Why

之前两次 change 把卡片骨架收紧、把 traits 改成短 chips、blurb 端到
端下线——视觉密度问题基本解决。但用户看到新卡仍然觉得"没分享欲"，
症结浮出水面：

**书签数据天然偏向"参考资料"**。人们倾向收藏 docs / wiki / 工作
平台 / 学习 PDF——核心 top-N 簇几乎一定是工作/学习类。卡片今天做
的是"诚实展示"——`size: 26 讯飞教育产线研发文档`、`size: 17 Go
语言工程实践`——但诚实 = 文件夹截图，没人想发朋友圈。

两个具体的"反人格"症状：

1. **簇名是"taxonomy"不是"vignette"**。`讯飞教育产线研发文档` 是
   一个分类，谁看都说不出这个用户的性格。但同样的事实可以换写法：
   `教育产线的隐形调度员`——同一份诚实数据，加了动词暗示就立刻有
   "人"。模型已经在合成阶段拿到了 vibe + cluster 数据，只是被指令
   "原样照搬簇名"绑住了手脚。
2. **size 数字制造清单感**。`26 / 17 / 10` 配进度条 = inventory 双
   重打击。进度条已经传达相对规模，数字是冗余的——但它的存在让卡
   片从"人格剪影"滑回"资产盘点"。把它换成"主线/副线/番外"这种叙
   事词，进度条仍画、视觉比例还在、清单感消失。

两处改动正交：A 是 prompt 层让模型重写名字；B 是 render-time 用规
则替换数字。组合起来把同一份诚实数据从"清单"重剪辑为"剧照"。

## What Changes

### A. 簇名故事化（vibe-aware）
- 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的
  `buildPrompt` 里加入"簇名重写"指令：模型必须保留 `size` 数值与簇
  的语义所指，但把 `name` 从聚类阶段的分类描述改写为带动词暗示 /
  反差感 / 性格切片的短语，语气贴合当前 vibe。
- 在示例里给 1 个好例 + 1 个坏例：好例展示"动词暗示 + 反差"；坏例
  展示"AI 灵魂工匠"这类空泛中二造词。
- 不强制名字长度上限——cluster name 比 trait chip 重，自然 10-14
  字左右；不预先限制以免压死生成空间。
- 不同 vibe 下同一个簇名字可以不同——这是有意的，正符合"换风格
  整张卡都翻新"的产品体验。

### B. 簇 size 数字换定性标签（render-time 派生）
- 在 [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx)
  里把 cluster 行右侧 `<span>{c.size}</span>` 替换为按规则计算的标
  签：
  - rank 1（最大的）→ `主线`
  - size / topSize ≥ 0.5 → `副线`
  - 其他 → `番外`
- 进度条按 `size / max` 仍然画出来——视觉比例不变。
- 不入 schema，不入 JSON——分享链接旧/新一律 render-time 派生。
- 在 [src/app/globals.css](src/app/globals.css) 把
  `.cluster .row` 右侧 span 调一下颜色 / 字号（让标签像 chip 而不
  像数字），不超 2-3 行 CSS。

## Capabilities

### Modified Capabilities
- `persona-agent`：「结构化画像输出」要求中追加「簇名应为带动词暗
  示的故事感短语」与「按 vibe 改写簇名」的语义约束；size 与簇所指
  保持不变。
- `persona-card`：「人格卡渲染」要求中把"簇旁的相对规模"由"原始数
  字"改为"主线/副线/番外定性标签 + 进度条"。

### New Capabilities
<!-- 无 -->

## Impact

- **受影响代码**：
  - [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)：`buildPrompt` 一处
  - [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx)：渲染右侧 span
  - [src/app/globals.css](src/app/globals.css)：可能 2-3 行样式微调
- **受影响 spec**：`persona-agent` 与 `persona-card` 各一个增量。
- **重试率影响**：A 让 prompt 更长、要求更主观，但本身不增加硬 schema
  约束——validate 不变；模型输出"分类式"簇名也能过校验，只是不够
  好。所以 A 不直接推高 `synth_failed` 率。质量靠后续观察迭代。
- **token 影响**：prompt 长 10-30 字（示例 + 指令），可忽略。
- **旧 share 链接**：簇名是已存的 JSON 字符串（旧分类式），定性标
  签是 render-time 派生——旧卡打开会显示「旧分类名 + 新主线/副线/
  番外标签」的混合形态，部分受益（数字消失），但簇名仍是旧的。这
  是预期的：新生成路径走新风格，旧分享链接是"当时生成的那张"，不
  做迁移。
- **vibe 切换 / precompute**：完全自动继承——三个 vibe 各跑各的
  synthesize，每张卡都有自己的簇名版本；定性标签随 render-time 计
  算永远一致。
- **不影响**：schema 形状 / normalize / 密度过滤 / otherInterests
  / traits / evolution / headline / 任何并行 change。
- **回滚**：复原以上 2-3 个文件即可。

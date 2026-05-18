## Context

聚类阶段（[src/lib/agent/cluster.ts](src/lib/agent/cluster.ts)）一次
性 LLM 调用产出 `ClusterResult`：每个簇带 `name` / `memberIndices`
/ `note`。这一阶段不知道 vibe——它对所有 vibe 都跑一次，输出是
"vibe-neutral 的分类描述"。

合成阶段（[src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)）
拿到 `AgentState`（overview + clusters + fetchedNotes）和 vibe，输
出最终 `PersonaProfile`。今天 buildPrompt 把 cluster 信息塞进 user
prompt（[synthesize.ts:30-46](src/lib/agent/synthesize.ts#L30)）：

```
兴趣簇：
- 讯飞教育产线研发文档（26 条）：...
- Go 语言工程实践（17 条）：...
...
```

然后让模型输出 JSON，其中 `clusters` 字段示例：
`[{"name":"簇名","size":数字,"domains":["域名"]}]`。模型几乎总是
把输入的簇名原样复制——这是合理的"指令最简"惯性，但与 vibe-aware
体验冲突。

[src/components/PersonaCard.tsx](src/components/PersonaCard.tsx) 渲
染 cluster 时：

```tsx
<div className="row">
  <span>{c.name}</span>
  <span style={{ color: "var(--muted)" }}>{c.size}</span>
</div>
<div className="bar" style={{ width: `${(c.size / max) * 100}%` }} />
```

数字 `{c.size}` 是直白展示，进度条用 `c.size / max` 算相对宽度。
两者承担"相对规模"的双重传达，定性标签替换数字后视觉比例完全由
进度条承担即可。

## Goals / Non-Goals

**Goals:**
- 簇名读起来像"人物剪影"——动词暗示 + 反差感，按 vibe 调语气。
- 簇 size 数字消失，由 render-time 派生的"主线/副线/番外"承担定性
  规模信号；进度条保留。
- 新分享链接、新 vibe 切换、新 precompute 路径自动继承。
- 旧分享链接得益于 B（数字消失），但簇名仍是旧分类式——这是 acceptable
  的产品语义。

**Non-Goals:**
- 不动 schema 形状（不加新字段、不限制 cluster name 长度）。
- 不让定性标签词随 vibe 变化（roast 用"主菜/配菜/凑数"那种）。本
  change 三个 vibe 共用"主线/副线/番外"。等用户反馈分化需求再做。
- 不动 cluster.ts（聚类阶段仍产出 vibe-neutral 分类描述——它给 agent
  的"过程档案"叙述时仍然有用，不该被改）。
- 不在 PersonaCard 暴露 vibe 类型（PersonaCard 仍只读 PersonaProfile）。
- 不引入 oneLiner / 金句字段（D 仍是后续）。

## Decisions

### D1 — 簇名重写发生在合成阶段，不动聚类阶段

聚类阶段产出的分类式簇名（"讯飞教育产线研发文档"）有两个用途：

1. 作为合成阶段的输入素材。
2. 作为"过程档案"里 cluster_thinking / clusters preview 区块展示给
   用户看（页面上现在能看到聚类阶段产出的 chip 行）——那里需要
   "事实陈述"，重写反而违和。

所以重写必须在合成阶段：合成阶段拿着 vibe 与原始分类名，输出已重
写的 cluster.name 字段写进 profile JSON。

否决备选 A（在 cluster.ts 让聚类阶段一次产出"故事感"名字）：聚类
阶段不知道 vibe；且过程档案要原始分类感。

否决备选 B（PersonaCard render-time 改名）：PersonaCard 不知道 vibe，
也不该知道；render-time 没有 LLM 调用，做不出"动词暗示"的名字。

### D2 — Prompt 改造：在 buildPrompt 加"簇名重写"段落

`buildPrompt` 当前结构是"素材 + 输出 JSON 示例"。在 JSON 示例上方
插入一段明确指令：

```
注意：cluster.name 必须重写为带动词暗示的"人物剪影式"短句，贴合
当前语气，不是聚类阶段原文。size 与簇含义保留——不许新增/删除簇，
也不许改 size。

好例（earnest）：「讯飞教育产线研发文档」→「教育产线的隐形调度员」
好例（earnest）：「韩剧动漫与休闲娱乐」→「韩剧也是节奏训练」
坏例：「AI 灵魂工匠」、「梦想筑造师」（空泛、无具体所指、中二）
```

放在 JSON 示例**前**而不是 system prompt 里，是因为：

- system prompt 里已有 vibe 语气 + 安全约束；继续叠加技术指令会让
  system 越来越长，可读性下降。
- 重写簇名是"输出形态"约束，离输出示例越近越好——模型把示例当模
  板时，紧邻的指令权重最高。

不需要"好例（roast）"或"好例（poetic）"——给一个 vibe 的好例足以
传达精神；模型自己会按 system 里的 vibe 语气泛化。

### D3 — 不加 cluster name 长度上限

簇名比 trait chip 重，需要承载动词 + 名词 + 反差，自然落到 10-14
字。强加 8 字上限会把模型逼回"分类标签"那种短词。

实测后如发现模型偶发跑到 20+ 字（如"我曾经熬夜在教育产线上写过的
那些研发文档"这种回归到 LLM 默认啰嗦），再考虑加 cap。本 change
不预设。

### D4 — 定性标签词：「主线 / 副线 / 番外」

已与用户对齐。词选理由：

- "主线"含游戏/叙事感，与卡片的"剧照"姿态合拍。
- "副线"对仗自然，理解成本零。
- "番外"承载"重要但不在主体之内"的语义——避免"支线"那种"被遗忘
  的次要"贬义。

否决备选「重头戏 / 副线 / 偶尔玩玩」：词性混搭（名词 + 名词 + 动
词短语）不齐整。

否决备选「主菜 / 配菜 / 甜点」：饮食比喻把卡片调性拉到生活化方向，
和 headline 里的"代码 / 讲台 / 云桥"技术叙事不搭。

### D5 — 定性映射规则：rank 1 主线 / ratio ≥ 0.5 副线 / else 番外

```ts
function sizeLabel(c: InterestCluster, allClusters: InterestCluster[]): string {
  const top = allClusters[0]; // clusters 已按 size 降序
  if (c === top) return "主线";
  const ratio = top.size > 0 ? c.size / top.size : 0;
  return ratio >= 0.5 ? "副线" : "番外";
}
```

实现细节：

- `clusters` 在 normalizeProfile 里已 `.sort((a,b) => b.size - a.size)`，
  rank 1 = `clusters[0]`。
- 用引用比较（`c === top`）而不是 index 比较——避免 `.map((c, i) =>`
  传 i 进函数的耦合。
- `top.size > 0` 防御除零（normalize 已用 `Number(cc.size ?? 0)`
  兜底，但理论上 top.size 仍可能为 0；此时所有簇都是 "番外"）。

应用样卡：26/17/10/10/9 → 26→主线、17→副线（17/26=0.65）、10→番外
（10/26=0.38）、10→番外、9→番外。三层分布，海报感顺畅。

否决备选（绝对阈值 `size >= 20 → 主线`）：与用户书签总量耦合，不
适应不同规模用户。

否决备选（rank 1/2/3 → 主线/副线/番外）：忽略 size 分布；如 top1
是 size=30、top2 是 size=29，强行给 top2 标"副线"不准确。

### D6 — PersonaCard 改造：右侧 span 接 sizeLabel

```tsx
const max = Math.max(1, ...profile.clusters.map((c) => c.size));
return (
  // ...
  {profile.clusters.map((c, i) => (
    <div className="cluster" key={i}>
      <div className="row">
        <span>{c.name}</span>
        <span className="rank">{sizeLabel(c, profile.clusters)}</span>
      </div>
      <div className="bar" style={{ width: `${Math.round((c.size / max) * 100)}%` }} />
    </div>
  ))}
);
```

把 `style={{ color: "var(--muted)" }}` inline 样式换成 `.rank` 类，
方便后续在 globals.css 里 一处调字号 / 字重 / 颜色。`.rank` 写到
.cluster .row 下，作用域不会泄漏。

### D7 — CSS：让 `.rank` 像"标签"而不像"数字"

最小改动：

```css
.cluster .row .rank {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
```

不加背景色 / 边框——保持"轻量提示"姿态，不抢"主标签"位（traits
chips 才是主标签集）。如未来要做"主线"高亮（提示阅读重点），再
分别加 `.rank--main` `.rank--sub` `.rank--side` 类。本 change 不
做。

### D8 — 旧 share 链接的混合形态可接受

旧 JSON：cluster.name 是聚类阶段的分类描述（如"讯飞教育产线研发
文档"）。新代码 render 时：

- 簇名仍是旧分类式（不重写——schema 不变、JSON 不动）。
- 数字消失、改显示"主线/副线/番外"（render-time 派生）。

混合形态：旧分类名 + 新定性标签。**部分受益**，但簇名调性不变。

不做 server-side 迁移（不重生成旧 JSON）：

- 分享 ID 不可变，旧卡的产品语义就是"当时生成的那张"。
- 重生成旧卡等于改写过去——违反"派生数据只追加"姿态。
- 旧分享链接被打开次数小，新生成路径才是主流量；不值得迁移成本。

## Risks / Trade-offs

- **模型把簇名写跑偏，变中二造词**（如"梦想筑造师"） → prompt 里
  明示坏例 + 当前 vibe 语气可以约束。如生产观测到大量跑偏，再加
  约束（如"必须包含至少一个原簇名里的关键概念"），本 change 不预
  防御。
- **同一簇在三个 vibe 下三个名字** → 用户在终态切换 vibe 时整张卡
  翻新（包括簇名），这正是 vibe 切换的"质感"——已与用户对齐。
- **样卡里 size=10 和 size=10 同分时** → 两个都标"番外"（10/26=0.38
  < 0.5）。如果用户感觉同分应同标，规则已符合；若用户觉得两个都
  应该"副线"，调阈值到 0.35 就行——本 change 锁 0.5，等观测再调。
- **进度条比例由 c.size/max 决定** → c.size 与 vibe 解耦（normalize
  里 size 不被 vibe 影响），所以 vibe 切换时只有"标签 + 簇名"变
  化，进度条比例稳定。这个稳定性对"换风格不晃眼"的产品姿态重要。

## Migration Plan

无迁移。改动只在合成 prompt 层 + 渲染层；服务端 store 已有的旧
JSON 不动；PersonaCard 对旧 JSON 优雅渲染（簇名按原值显示，定性
标签 render-time 派生）。

部署即生效——新一次 `/api/persona` 或 `/api/regenerate`（含
precompute）产生的卡走新形态。

回滚 = 还原 `synthesize.ts` / `PersonaCard.tsx` / `globals.css` 三
个文件（CSS 改动微小，主要影响在 prompt 与渲染层）。

## Open Questions

- 暂无。定性标签词与是否随 vibe 变化已与用户对齐。

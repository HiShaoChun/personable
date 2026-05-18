## Context

[src/lib/agent/schema.ts](src/lib/agent/schema.ts) 当前对人格画像的两条
约束：

- `traits`：3-7 条（[schema.ts:37](src/lib/agent/schema.ts#L37) 验证
  上下界，[schema.ts:80](src/lib/agent/schema.ts#L80) normalize 用
  `slice(0, 7)` 兜底裁剪）。
- `clusters`：只验非空 + 单项 `name`/`size` 类型；不限数量、不限单项
  大小、不限总大小。normalize 按 size 降序排序后原样返回
  （[schema.ts:65-75](src/lib/agent/schema.ts#L65)）。

实际跑出的样卡（用户截图）：7 条特质 + 7 个簇，其中最尾两个簇 size=5
和 size=1。size=1 的「英语深度阅读」本质是聚类阶段无法归并到任何已
有簇的孤点，不构成"兴趣簇"语义。

[src/components/PersonaCard.tsx](src/components/PersonaCard.tsx) 是
纯渲染层——`profile.clusters.map((c, i) => ...)` 全画进度条 +
`c.blurb` 一行；没有任何过滤或截断逻辑。所以问题的根上既不是模型
也不是渲染层，而是**服务端 normalize 没有"卡片观感"层级的后处理**。

[src/lib/agent/synthesize.ts:43](src/lib/agent/synthesize.ts#L43) 的
prompt 内 JSON 注释写 `"3到7条人格特质"`——这是给模型的软提示，
真正的硬约束在 validateProfile，所以本 change 改 prompt + 改 schema
要同步。

## Goals / Non-Goals

**Goals:**
- 在服务端 normalize 阶段一次性产出"卡片就绪"的画像形态：traits
  上限 5、clusters 经硬阈值 + 软上限过滤、被剔除的簇名集中到
  `otherInterests`。
- PersonaCard 仍保持"纯渲染、不做业务过滤"的姿态——只多一行渲染
  分支。
- 分享链接 JSON 形态自洽：服务端落 store 的就是定稿后的过滤产物，
  其他人打开分享链接看到与生成者本人一致的卡。
- 旧分享链接（缺 `otherInterests` 字段、`clusters` 仍是未过滤旧形
  态）继续以今天的形态显示，不破坏存量。

**Non-Goals:**
- 不动聚类阶段（[src/lib/agent/cluster.ts](src/lib/agent/cluster.ts)）
  阻止孤点簇产生——治理放在终末更稳，且不影响"过程档案"里看到
  聚类思考的完整性。
- 不动 LLM 模型 / 重试策略 / 重合成路径 / token 预算。
- 不引入服务端针对旧分享链接的"回填迁移"——分享 ID 不可变，
  迁移既增加复杂度也违反"派生数据只追加、不改写"的姿态。
- 不为 `otherInterests` 提供详情展开 UI。它就是一行小字，结束。
  想再多看就重新生成卡。
- 不动 `evolution`。演变时间线和密度无关。

## Decisions

### D1 — 过滤公式：硬阈值 `max(3, ceil(total * 5%))` + 软上限 top 5

```ts
const total = clusters.reduce((s, c) => s + c.size, 0);
const cut = Math.max(3, Math.ceil(total * 0.05));
const passed = clusters.filter((c) => c.size >= cut);
const top = passed.slice(0, 5); // 已按 size 降序
const dropped = clusters.filter((c) => !top.includes(c));
```

理由：

- **常数 3 下限**：size=1 和 size=2 都算孤点（一两条书签构不成
  "兴趣"），无论总量多少都该砍。把它写进公式而不是单独 `if`，
  让规则一句话讲清。
- **5% 浮动**：随总量自适应。total=100 时 cut=5，total=400 时 cut=20。
  避免大用户的中等规模噪声簇骗到一条进度条。
- **取大值**：当两条规则有冲突（如 total=10 时 5% = 0.5，ceil → 1，
  常数 3 才是真正下限），自然挑严格的那条。
- **top 5 软上限**：硬阈值通过的也可能很多（少见但可能），多于 5 一
  律切到 5。"5" 与新 traits 上限同步，对仗简洁。

否决备选 A（按比例 5%、不要 3 常数）：total 小时阈值会被算到 0，
size=1 也通过——这正是要拦的场景。

否决备选 B（top 4 / top 6）：在用户截图样卡上 4 显紧、6 显松；5 是
两边都能稍微妥协的中点。已与用户对齐。

否决备选 C（按 `size > total / N` 等动态公式）：N 怎么取又是一个调
参问题，简单线性 5% 已够用。

### D2 — `otherInterests`：可选字符串数组，承载被剔除簇的 name

```ts
export interface PersonaProfile {
  // ... 现有字段 ...
  otherInterests?: string[]; // 被硬阈值/软上限剔除的兴趣簇名，按原 size 降序
}
```

设为可选而不是必选：

- 兼容旧分享链接（存量 putCard JSON 里没有该字段）。
- 当没有被剔除的簇时（如 clusters 本来就 ≤5 且全部 >= cut），干脆
  不带这个 key，让 JSON 更干净。

字段语义：

- 仅 name，**不带 size / blurb / domains**——是定位为"轻量提及"，
  不让人产生"还想看详情"的钩子。
- 顺序保留剔除前的相对 size 降序——即被砍的里也是按曾经的重要性
  排，让"其他散点"读起来仍有节奏。
- normalize 阶段 dedupe + 去空名兜底（`new Set` + `name.trim()`）。

否决备选 A（带 size：`{name, size}[]`）：勾起"为什么 X 被砍"的间接
信息，违反"海报感"。

否决备选 B（仅在客户端展示层 filter）：服务端 profile 仍含 size=1
垃圾簇——分享链接 JSON 形态与"单一事实来源"姿态冲突；且每个 vibe
变体都要在客户端各算一次，重复劳动。

### D3 — `validateProfile` traits 上限 7 → 5；下限保持 3

```ts
if (!Array.isArray(traits) || traits.length < 3 || traits.length > 5)
  errors.push("traits 数量需为 3-5 条");
```

不放宽下限：3 条仍是底线，少于 3 的画像没有人设感。

`synthesize` 默认重试 3 次，模型偶尔出 6-7 条 traits 时会失败重试。
**但这是预期行为**——重试至模型给到 ≤5 才合规，不依赖 normalize 偷
偷裁剪也算合格。

Normalize 同时把 `slice(0, 7)` 改为 `slice(0, 5)` 作 belt-and-suspenders
兜底（模型偶发越界 + validate 检测出后下一轮 retry，这一轮仍能展示
合理形态）。

否决备选（只改 prompt 不改 validate）：模型的"软提示遵守度"实测不
稳，硬 schema 才是真的约束；prompt 与 schema 不一致是技术债。

### D4 — Prompt 同步：`buildPrompt` 内 `"3到7"` → `"3-5"`

[src/lib/agent/synthesize.ts:44](src/lib/agent/synthesize.ts#L44) 的
JSON 注释 `"traits":["3到7条人格特质"]` 改成 `"3-5条人格特质"`。
不改 system prompt 的其他部分（D5b 的合成思路要求与本 change 解耦）。

不指示模型"clusters 只输出最重要的 5 个"或类似——让模型自由聚类，
密度治理交给 normalize。理由：

- prompt 加越多约束越脆。
- 聚类阶段已经把 cluster 数量摆出来了，合成阶段再加约束等于让模型
  自己做过滤，可控性比一段确定性代码差。
- 过程档案里仍展示所有聚类簇（包括会被砍的），用户看得到 agent 的
  完整思考；最终卡上才收紧——和"过程感"产品姿态一致。

### D5 — PersonaCard 渲染：cluster 列表后、evolution 前

```tsx
{profile.otherInterests && profile.otherInterests.length > 0 && (
  <div className="others">其他散点：{profile.otherInterests.join("、")}</div>
)}
```

位置选择：紧贴 cluster 块底部，与"这是兴趣的延伸"语义相邻；放
evolution 之前避免把时间线和"其他散点"读串。

样式：

- 单行（`white-space: normal` 让长串自动换行，但视觉重量仍是一行
  小字而非段落块）。
- 颜色 `var(--muted)`、字号 13-14px——和现有的 `note` 类视觉一致，
  不抢卡片主体。
- 用顿号 `、` 分隔；不带句号；不加"等"字（信息已经明确"散点"）。

类名新建 `others`，不复用 `disc`（免责声明）的样式，避免被读成
另一段免责。CSS 在 globals 加几行即可。

不为它提供折叠/展开/点击查看详情 —— 与 Non-Goals 一致。

### D6 — 旧分享链接的兼容矩阵

旧 JSON 形态：`profile.otherInterests === undefined`，
`profile.clusters` 是未过滤的旧产物（可能含 size=1）。

- PersonaCard `profile.otherInterests &&` 守卫即 falsy，不渲染那行。
- PersonaCard 仍按 `profile.clusters.map(...)` 全画——视觉与今天完
  全一致，不会因为类型扩展而崩。
- 不做服务端"回填迁移"——分享 ID 不可变，旧卡片的产品语义就是
  "当时生成的那张"。新生成的卡走新规则。

副作用：同一个用户重新上传同一份书签 → 新 ID 新卡，密度收紧；旧
ID 旧卡仍打开为老样子。这是可接受的——旧分享链接被打开次数小，
新生成路径才是主流量。

## Risks / Trade-offs

- **模型在 traits=5 上的合规率** → schema 改严会让首次合规率下降
  （样卡里出过 7 条，模型偏好往上写）。`synthesize` 自带 3 次重试
  + 重试时把 lastErr 反馈给模型，预期 1-2 次重试内收敛。最坏情况
  整次合成失败、`/api/persona` 返回 error，用户重传一次——损失可
  接受，本 change 不为此降级 validate 严格度。
- **硬阈值常数 3 在小用户场景偏严** → 比如总书签 30 条、最大簇 size=4，
  cut=max(3, 2)=3 → size>=3 通过；少数簇可能被砍到 2-3 个。再小的
  用户（total < 20）卡片本来就稀薄，密度问题反过来，可接受。
- **多 vibe 同样的过滤导致 3 个 vibe 看到的"其他散点"列表完全一致**
  → 这是对的：不同 vibe 改的是文案不是事实，剔除的簇身份不该因
  vibe 而异。precompute 的 3 张卡 otherInterests 应当完全相同。
- **样卡 size=8 的簇（韩剧/云原生）会不会被砍？** → 截图样本里
  total≈85（36+18+9+8+8+5+1=85），cut=max(3, ceil(85*0.05)=5)=5。
  size=8/8 通过、size=5 通过、size=1 砍。top 5 取 36/18/9/8/8 五
  个，size=5 的「算法求职」被软上限挤进 `otherInterests`。最终
  3 张主簇（top）+ 1 行散点（算法求职、英语深度阅读）。

## Migration Plan

无迁移。改动只在合成路径与渲染层；服务端 store 已有的旧 JSON 保持
不变，PersonaCard 优雅兼容。部署即生效，新一次 `/api/persona` 或
`/api/regenerate` 起跑的卡就是新形态。

回滚 = 还原 `schema.ts` / `synthesize.ts` / `PersonaCard.tsx` 这三
个文件。旧分享链接的 JSON 在回滚后仍能正常渲染。

## Open Questions

- 暂无。软上限取值与"其他散点"展示形态已与用户对齐。

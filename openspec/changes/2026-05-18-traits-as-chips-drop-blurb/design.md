## Context

trim-card-density 已经把"卡片密度"的骨架收紧了（traits 3-5、clusters
top 5 + 其他散点）。但骨架紧不等于内容紧——单条 traits 里仍可以塞
进去整段解释，单个 cluster 下仍可以挂一行 blurb 解说。

[src/lib/agent/schema.ts](src/lib/agent/schema.ts) 当前：

- `traits: string[]` 只校验数量（3-5），不校验单条形态；`normalizeProfile`
  仅 `.map(String).slice(0, 5)`。
- `InterestCluster.blurb: string` 是必填字段；`normalizeProfile` 用
  `String(cc.blurb ?? "")` 兜底。

[src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的
`buildPrompt` 在 JSON 示例里同时鼓励 `"traits":["3-5条人格特质"]`
（自由发挥）和 `"blurb":"一句话"`（明确要求每簇一句话）——这两处
是模型"按指示多说"的合法授权。

[src/components/PersonaCard.tsx](src/components/PersonaCard.tsx) 里
trait 渲染就是简单的 `<span className="tag">{t}</span>`，cluster 渲染
末尾 `{c.blurb && <div className="blurb">{c.blurb}</div>}`——前者
天然支持任意长度（撑大胶囊），后者是有条件显示但今天永远显示。

## Goals / Non-Goals

**Goals:**
- Trait 真正像 chip——胶囊里一个短词，扫一眼就过。
- Cluster 不再有"AI 解释自己"的解说行；簇名 + 数字 + 进度条三件套
  就够了。
- 新生成的卡片整体观感统一海报；旧卡片自动跟着变（blurb 不渲染即
  没有"历史包袱"展示）。
- 改动只在合成定稿与渲染层，重合成 / precompute 不动。

**Non-Goals:**
- 不动 evolution（用户没选 C）。
- 不引入新字段（如金句/oneLiner）——那是后续 D 单独 change。
- 不清理 `.blurb` CSS（无引用即死样式，未来全局清理时再带）。
- 不动 cluster `domains` 字段（虽然 PersonaCard 不渲染，但作为画像
  数据保留，本 change 不扩大爆炸半径）。
- 不重新计算"≤8 字"是否对所有语言（如英文 trait）合理——本产品当前
  全中文场景，`.length` 与"看上去的字符数"近似相等就够了；未来真要
  混合英文再换成 `[...str].length` 或基于 Intl.Segmenter 的字素数。

## Decisions

### D1 — Trait 上限取 8 字（中文字符 = JS `.length`）

样卡里现存最长 trait 是「务实的理想主义」（7 字）、其次「静默的跨
域感」（6 字）。封 8 给 1 字 slack——既能容纳「务实理想主义者」
这种 7-8 字的状语短语，又卡死了「系统性：习惯用架构视角…」这种
20+ 字的解说式输出。

实现层用 `[...t].length`（按 Unicode code point 计数）：

```ts
const traitLen = (t: string) => [...t].length;
if (traitLen(trait) > 8) errors.push(`traits[${i}] 超长（>8 字）`);
```

不用 `t.length`（UTF-16 code units）的原因：emoji 和某些罕用汉字
是代理对，`.length` 会数成 2。这种边缘情况少见但便宜兜得住。

否决备选（≤6 字）：「务实理想主义」恰好 6 字，再砍一字模型必须
重炼"务实派""理想派"这种损失语义的造词；6 字会推高重试率，性价
比不如 8。

### D2 — Normalize 防御式清洗，覆盖模型"擦边"输出

即使 prompt 明确要求 ≤8 字、无冒号，模型仍可能：

- 输出"系统性：擅长系统化思维"——前半段合规、冒号后多写。
- 输出"系统性的架构脑"——多个修饰词撑过 8 字。
- 前后带空格、句末加"。"。

`normalizeProfile` 里把 trait map 步骤换成显式清洗：

```ts
function cleanTrait(s: unknown): string {
  let t = String(s ?? "").trim();
  // 切冒号（中英文）：模型最容易"擦边"的形式
  const ci = t.search(/[：:]/);
  if (ci >= 0) t = t.slice(0, ci).trim();
  // 去末尾标点
  t = t.replace(/[。、，,．.\s]+$/g, "");
  // 限长 8 字（按 code point）
  const chars = [...t];
  if (chars.length > 8) t = chars.slice(0, 8).join("");
  return t;
}
```

清洗后空串过滤；不足 3 条由 `validateProfile` 拦下走重试。

意义：normalize 是"我们对自己的输出负最终责任"的最后一层；prompt +
validate 是引导 + 检测，normalize 是兜底执行。三层合力保证最终
profile 里的 trait 字符串不会出现冒号或长解释。

不在 normalize 里"自动加引号""自动补名词后缀"等改写——超出"清
洗"范畴会让数据产线难以推理。

### D3 — Validate 触发重试，让模型自我修正

`validateProfile` 把 trait 长度校验加进现有的 `errors` 流：

```ts
const traits = o.traits;
if (!Array.isArray(traits) || traits.length < 3 || traits.length > 5)
  errors.push("traits 数量需为 3-5 条");
else
  traits.forEach((t, i) => {
    if (typeof t !== "string" || [...t].length > 8)
      errors.push(`traits[${i}] 需为 ≤8 字的短标签`);
  });
```

`synthesize` 已有 3 次重试机制 + 把 lastErr 反馈给模型
（[synthesize.ts:81](src/lib/agent/synthesize.ts#L81)），模型看到
"traits[1] 需为 ≤8 字的短标签"自然会在下一轮重写。重试预期 1-2 次
内收敛；超过 3 次失败按既有 `synth_failed` 返回。

注意校验是对**清洗后的 trait** 检查，还是对**清洗前**？

设计上必须对**清洗后**检查——否则 normalize 已经把"系统性：解释"
切成"系统性"了，validate 还在抱怨"超长"会陷入 normalize 改了
validate 没看到的偏差。

实现位置：`normalizeProfile` 先跑、`validateProfile` 后跑。
[synthesize.ts:145-148](src/lib/agent/synthesize.ts#L145) 当前就是
"parsed → normalize → validate"顺序，无需改动调用顺序。

### D4 — Prompt：明确告诉模型"标签 chip 形态、禁止冒号与解释"

`buildPrompt` 的 JSON 示例里 `"traits":["3-5条人格特质"]` 改为：

```
"traits":["3-5个标签词（每条≤8字、纯名词短语、禁止冒号与解释）"]
```

同时把 clusters JSON 示例里的 `"blurb":"一句话"` 整段拿掉：

```
"clusters":[{"name":"簇名","size":数字,"domains":["域名"]}]
```

不在 system prompt 加额外约束——`buildPrompt` 的 JSON schema 示例
是模型最权威的 cue，集中改这一处比分散加 system 指令稳。

不写"传播力""海报感"这种主观词——给模型可执行的约束（字数、词性、
禁止符号），不让它去理解隐喻。

### D5 — Cluster.blurb 从必选改可选，向后兼容

```ts
export interface InterestCluster {
  name: string;
  size: number;
  blurb?: string; // 历史字段，新生成不再带，保留以兼容旧 share JSON
  domains: string[];
}
```

`normalizeProfile` 不再读 `cc.blurb`——新 profile 的 cluster 对象
里就不会出现该字段。

`validateProfile` 不校验 blurb（今天也没校验，保持原样）。

`PersonaCard` 删除 `{c.blurb && <div className="blurb">…</div>}`
那一行：

- 新生成的卡：cluster 对象没有 blurb 字段，删不删该行结果一样
  （`undefined && ...` 也是 falsy）。但删掉让"卡片渲染什么"的
  代码语义与 schema 语义对齐。
- 旧 share JSON：cluster 对象**仍带** blurb 字段，但 PersonaCard
  不再渲染——旧卡片的 blurb 被"隐藏"。这是有意为之，已与用户对齐。

否决备选（在 PersonaCard 保留 blurb 渲染、只让新卡不带 blurb）：
"同一产品在不同期生成的卡形态不同"是产品语言上的不一致；用户当时
讲的"一纷拉措隐藏"正是要消灭这种不一致。

### D6 — `.blurb` CSS 保留，不在本 change 里清理

[src/app/globals.css](src/app/globals.css) 里 `.blurb` 类失去引用后
变成死样式。本 change 不删它，理由：

- 删与不删都不影响渲染。
- 全局 CSS 清理建议在专门的"死代码扫荡"change 里做，本 change 不
  扩大爆炸半径。
- 万一未来需要回滚 PersonaCard 的渲染删除，CSS 还在不需要再加回。

### D7 — `cluster.domains` 不动

PersonaCard 今天不渲染 domains，但它是 agent 阶段判断"这个簇里都
是哪些站"的证据数据，画像里的存在感属于"data 而非 display"。本
change 不动这个字段，避免和"删 blurb"绑在一起被理解为"凡 PersonaCard
不渲染的都删"，那是更激进的姿态、需要专门 change 论证。

## Risks / Trade-offs

- **重试率上升** → trait 加 ≤8 字硬约束后，首次合规率会下降。预期
  1-2 次重试内收敛；如生产观测整体 `synth_failed` 率 >5%，可考虑
  在 prompt 加强示例（如"好的标签：架构脑、跨域选手、毒舌产品/坏
  的标签：擅长系统化思维、对教育有真实业务体感"）。本 change 不
  预先加示例——先看实际数据。
- **trait 语义信息密度下降** → 8 字标签必然丢掉冒号后的"解释"。
  这是有意权衡：解释属于"自我对照"价值，标签属于"传播"价值；用户
  目标偏后者。如未来用户反馈"看不懂为什么是这个标签"，可在卡片
  外（如 hover tooltip）补回解释，不改卡片本体。
- **旧 share 链接看不到 blurb** → 已对齐。旧卡的"曾经写过 blurb"
  从产品语义上等于"不再渲染"。访客打开旧链接看到的是与新卡一致的
  海报形态。
- **模型偶发输出"务实的理想主义者"（8 字、合规）vs"务实理想主义"
  （6 字、更紧）** → 都合规，不做强行优化。8 字内的自由空间允许
  模型在"语义完整"和"极致紧凑"之间自行权衡。

## Migration Plan

无迁移。改动只在合成定稿与渲染层；服务端 store 已有的旧 JSON 不
动；PersonaCard 对旧 JSON 优雅渲染（blurb 字段存在但不被读取）。

部署即生效——新一次 `/api/persona` 或 `/api/regenerate`（含
precompute 路径）产生的卡走新形态。

回滚 = 还原 `schema.ts` / `synthesize.ts` / `PersonaCard.tsx` 三个
文件。

## Open Questions

- 暂无。trait 字符上限与旧链接兼容形态已与用户对齐。

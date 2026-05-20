## 1. Schema 与类型

- [x] 1.1 在 `src/lib/agent/schema.ts` 的 `PersonaProfile` 接口加 `signatureQuote?: string` 字段
- [x] 1.2 在同文件加 `cleanSignatureQuote(s: unknown): string` 工具——trim、去首尾引号、按 codepoint 截至 28 字、空串返回空串（参考 `cleanTrait` 写法）
- [x] 1.3 `validateProfile` 在 `signatureQuote` 存在且非字符串时报错；存在且为空字符串视为合法（normalize 后会被丢弃）
- [x] 1.4 `normalizeProfile` 调用 `cleanSignatureQuote(raw.signatureQuote)`，结果非空才赋值到 profile，空则省略字段

## 2. Synthesis prompt

- [x] 2.1 在 `src/lib/agent/synthesize.ts` 的 `buildPrompt` 输出 JSON 结构示例里加入 `"signatureQuote":"..."` 字段
- [x] 2.2 在 prompt 文案里加签名台词生成规则：≤28 字、贴当前 vibe 语气、必须含至少一个具体所指（cluster 名 / 域名 / 具体行为）、不得复述 headline
- [x] 2.3 给签名台词加 2 个好例 + 2 个坏例（沿用现有 cluster 命名好/坏例的格式）
- [x] 2.4 在 streaming 系统提示词里加一句：合成思路段落中可适度铺垫"打算写一句什么样的签名"，但 JSON 外不直接输出该台词

## 3. PersonaCard 视觉

- [x] 3.1 在 `src/components/PersonaCard.tsx` 拆出 `storylineTier(c, all): "main" | "side" | "extra"`，保留 `sizeLabel` 函数名与签名不变、内部委托并把英文 key 映射回中文标签；确认旧调用点输出完全一致 — **偏离记录**：核查发现 `sizeLabel` 全工程仅本组件使用，无外部消费者，故按"未使用即删"原则移除，直接用 `TIER_LABEL[tier]` 内联映射；行为完全等价
- [x] 3.2 cluster 渲染处把 `<div className="bar">` 改为 `<div className={`bar bar--${tier}`}>`，tier 调用 `storylineTier(c, profile.clusters)` 一次后复用（避免每行算两遍）
- [x] 3.3 `.rank` 标签节点改为 `<span className={`rank rank--${tier}`}>`，便于按 tier 染色
- [x] 3.4 在 headline 之下、`.tags` 之上，按 `profile.signatureQuote && <p className="quote card-elem" style={elemStyle(idx++)}>"{profile.signatureQuote}"</p>` 渲染签名台词；引号字符直接写中文「」或英文双引号，二选一统一 — 实际选用「」
- [x] 3.5 确认 `idx` 递增顺序使 quote 在 headline 之后、tags 之前进入 reveal stagger

## 4. 样式（globals.css）

- [x] 4.1 在 `src/app/globals.css` 现有 `.cluster .bar` 行附近加 `.bar--main / .bar--side / .bar--extra` 三个修饰类，按 design.md Decision 5 的规格
- [x] 4.2 加 `.rank--main { color: #f5c97a; } .rank--side { color: #c0c6d8; }`；番外保持继承 `.rank` 默认 muted 色
- [x] 4.3 加 `.quote` 样式：font-size 14-15px、color 介于 `--ink` 与 `--muted` 之间（如 `#c8cee0`）、`font-style: italic`、`margin: 6px 0 4px`、`line-height: 1.5`
- [x] 4.4 在浏览器手动核对：reveal=first 入场动效里 quote 不闪烁、与其它 card-elem 同节奏淡入

## 5. 示例与共享展示

- [x] 5.1 在 `src/lib/samples.ts` 给 `SAMPLE_EARNEST / SAMPLE_ROAST / SAMPLE_POETIC` 三份示例分别补 `signatureQuote`，确保三种语气差异肉眼可辨（earnest 真诚直白、roast 自嘲毒舌、poetic 意象比喻）
- [x] 5.2 手动跑 `npm run dev`，确认首页 idle 态 SampleGallery 三张卡都显示新签名台词且三档进度条视觉区分明显
- [x] 5.3 用一张旧的 share 链接（或临时构造一份不含 `signatureQuote` 的 profile JSON 塞进 localStorage）验证降级：quote 段不渲染、进度条新视觉仍生效

## 6. 验证

- [x] 6.1 `npm run lint` 通过 — **偏离记录**：项目 package.json 无 `lint` script；改跑 `npm run typecheck`（= `tsc --noEmit`）通过
- [x] 6.2 `npm run build` 通过（含类型检查）
- [x] 6.3 用真实书签跑一次端到端，确认 LLM 实际产出的 `signatureQuote` 落进卡面、符合长度与"含具体所指"约束
- [x] 6.4 切换 vibe 重生成一次，确认 quote 随 vibe 切换、风格差异明显（earnest vs roast）
- [x] 6.5 用 `html-to-image` 导出 PNG，确认金色 glow 在导出图里无明显抖动；若有，按 design.md 提示降级为 inset border

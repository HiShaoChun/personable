## Context

人格卡当前由 `src/lib/agent/synthesize.ts` 生成 `PersonaProfile` JSON、`src/components/PersonaCard.tsx` 渲染。卡片在 [PersonaCard.tsx:8-13](../../../src/components/PersonaCard.tsx#L8-L13) 用 `sizeLabel` 把 cluster 分为「主线/副线/番外」三档，但 [PersonaCard.tsx:77-80](../../../src/components/PersonaCard.tsx#L77-L80) 用同一个 `.bar` 元素渲染，CSS 在 [globals.css:157](../../../src/app/globals.css#L157) 用同一根紫青渐变。叙事层级在视觉上不可见。

`PersonaProfile` 还历史性地存在过 `cluster.blurb` 字段后被移除（见 [schema.ts:7](../../../src/lib/agent/schema.ts#L7)），目前所有 vibe 都只靠 headline + 5 个 traits chips 表达人物个性，少一个"人物自述"层级。

profile JSON 同时被三处消费：实时主流程（[page.tsx](../../../src/app/page.tsx)）、localStorage 持久化（STORAGE_VERSION = 3）、分享链接 KV 存储（[persona/[id]/page.tsx:33](../../../src/app/persona/[id]/page.tsx#L33)）。旧记录里没有新字段，必须按缺失降级，不能因此抛错或要求 bump 版本。

## Goals / Non-Goals

**Goals:**
- 让"主线/副线/番外"三档在不读文字标签的情况下也能一眼区分
- 给每张卡多一句契合 vibe 的"签名台词"，承担当前 traits chips 担不动的"人物自述"层
- 现有 share 链接 / localStorage 旧数据继续可渲染，无需迁移

**Non-Goals:**
- 不引入稀有度/编号/徽章/雷达图等更重的角色卡元素（留给后续 change）
- 不改"主线/副线/番外"的归档规则（仍由 [PersonaCard.tsx:8](../../../src/components/PersonaCard.tsx#L8) 现有阈值决定）
- 不改 storyline tier 的中文标签文字
- 不动 `cluster.size` 写入逻辑

## Decisions

### Decision 1: `signatureQuote` 由 synthesis 阶段 LLM 生成，而非客户端模板拼接

签名台词必须随 vibe 切换（earnest 真诚、roast 毒舌、poetic 诗意），且依赖具体 cluster 名才显得不空泛，因此只能让 LLM 在 synthesis 时一次产出。

**Alternative considered:** 客户端用 `headline + traits[0]` 拼一个模板句。否决——三种 vibe 的腔调差异不是模板能覆盖的，会变成"AI 工具上瘾的代码人类"这种刻板句。

**Alternative considered:** 单独再起一次 LLM 调用专门生成 quote。否决——多花一次 token、多一段延迟，没必要；synthesis prompt 已经在让模型理解全局，加一个字段成本极低。

### Decision 2: 字段可选 + 缺失即不渲染，不 bump 任何版本

新字段在 schema 里 `signatureQuote?: string`，`validateProfile` 仅在字段存在且非空时校验长度；`PersonaCard` 用 `{profile.signatureQuote && <p className="quote">…</p>}` 渲染。

**Why:** 这样旧 share 卡（KV 里存的旧 JSON）和旧 localStorage（STORAGE_VERSION = 3，profile 子对象无该字段）都能直接渲染，少一档新视觉而已。Bump STORAGE_VERSION 会让所有老用户刷新即丢卡，得不偿失。

**Trade-off:** 新生成的卡片如果 LLM 在重试 2 次后仍未给出 quote（例如被截断），会以"无台词"状态落地——可接受，因为还有 headline 撑场面。

### Decision 3: storyline tier 派生函数与 label 函数分离

把现有 `sizeLabel(c, all): "主线" | "副线" | "番外"` 拆成两层：
- `storylineTier(c, all): "main" | "side" | "extra"`——只返回稳定的英文 key，给 className 用
- `sizeLabel(c, all): string`——内部调 `storylineTier`，按 key 映射中文标签

**Why:** 中文字符放进 `className` 在 SSR / CSS 选择器里有非零的坑面（Next.js 应能处理，但没必要赌）。英文 key 同时也更稳：以后想加 i18n、想加第四档不会被字符串卡住。

### Decision 4: 视觉差异化用 CSS modifier，不写内联 style

新增 `.bar.bar--main / .bar.bar--side / .bar.bar--extra` 三个修饰类，所有渐变 / 高度 / glow 都在 CSS 里。组件只决定挂哪个 modifier。

**Why:** PersonaCard 已有 reveal 动效与 `card-elem stagger`，再混入内联 `linear-gradient` 字符串会让样式分散两处难维护。把视觉决策完全留在 CSS，react 端只贴 className。

### Decision 5: 三档视觉具体规格

**当前规格（v3，2026-05-20 复盘后定稿）：**

- `bar--main`：高 10px、`border-radius: 5px`、渐变 `linear-gradient(90deg, #f5c97a, #f8e8a0, #f5c97a)`（金色），`box-shadow: 0 0 12px rgba(245, 201, 122, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)`（外柔光 + 顶部 inset 高光，制造体积感）
- `bar--side`：高 8px、`border-radius: 4px`、品牌渐变 `linear-gradient(90deg, var(--accent), var(--accent2))`（紫→青）、`opacity: 0.9`、无阴影
- `bar--extra`：高 6px、`border-radius: 3px`、同品牌渐变、`opacity: 0.35`、无阴影，并叠 `mask-image: linear-gradient(90deg, #000 60%, transparent)` 让右端渐隐，强化"衰减"语义
- 右上角 `.rank` 文字颜色：主线 `#f5c97a`、副线 `var(--accent2)`（青）、番外保持现有 `--muted`
- 所有 bar 的 `border-radius` 严格等于 `height/2`，避免低高度 + 大圆角变成胶囊

**Why this palette (v3):**
1. **主线金色保留为唯一"逸出"品牌色的焦点元素**——读者扫到它立刻知道这是 the one 主线，金色 + 顶部高光给出"奖励 / 罕见"心智
2. **副线 / 番外回到品牌紫青渐变**——卡片整体色调统一，进度条区域不再像"换了一个产品"；金色因此更突出
3. **番外用同一渐变但叠 35% 不透明 + 右端 mask 渐隐**——传达"同源但衰减"，番外档内部依旧可读，但视觉重量明显低于副线

**Decision history（保留以供归档参考）：**

- **v1（初版）**：金 / 银 / 蓝灰虚线。问题：番外的 `border-top: 2px dashed` 读起来像分隔线，不像进度条
- **v2（虚线→实心条）**：金 / 银 / 暗蓝灰实心条。问题：副线银色、番外蓝灰都是脱离品牌色的新色相，进度条区域和卡片主色调断层；冷暖断层（金→蓝灰）；番外档真实数据里出现频率高（多个 cluster 都低于 50% 阈值），5 条同色同高的蓝灰条没有内部差异
- **v3（当前）**：保留金色作为"焦点逸出"，副 / 番外回到品牌紫青色系靠 opacity 拉开层级

### Decision 6: signatureQuote 长度上限 28 字（按 `[...str].length` 计 codepoint）

**Why 28：** 在 22-30 字区间挑——卡面 headline 是 24px、quote 渲染为 14-15px、单行宽度约 480px，按中文字宽 16-17px 估算正好能放 28 字不折行；再长就要折两行，挤掉 traits 之上的呼吸感。

**Validation 行为：** 字段存在但超过 28 字时，`normalizeProfile` 截到 28 字而非 reject——和 `cleanTrait` 对 traits 的处理一致（见 [schema.ts:66-74](../../../src/lib/agent/schema.ts#L66-L74)），让 schema 校验只在结构性问题上失败。

## Risks / Trade-offs

- [Risk] LLM 偶尔会把 signature quote 写成"很文艺的废话"（"这是一个独特的灵魂"）→ Mitigation：synthesis prompt 给 2 个好例 + 2 个坏例（贴合现有"反空泛"prompt 风格，见 [synthesize.ts:42-44](../../../src/lib/agent/synthesize.ts#L42-L44)）；要求台词必须含至少一个具体所指（cluster 名 / 域名 / 行为动词）
- [Risk] 旧 sample（`SAMPLE_EARNEST / ROAST / POETIC`）若不补字段，会在首页 idle 态出现"有的卡有签名、有的没"的不一致 → Mitigation：tasks 里强制要求同时更新三份示例
- [Risk] 金色 glow 在导出 PNG 时可能在某些浏览器渲染轻微抖动（toPng 对 box-shadow 支持一般）→ Mitigation：把 glow 强度控制在 0.35 alpha 以下，先观察导出效果，若不可接受可改为 inset border 替代
- [Risk] storylineTier 是新拆出的函数，签名/调用点改动一处即可——但 `sizeLabel` 仍被组件用，必须确保中文标签结果与旧实现完全一致，否则用户会察觉到回归 → Mitigation：tasks 里要求保留 `sizeLabel` 名称与签名不变，仅内部委托

## Migration Plan

无数据迁移。部署后：
- 新生成的卡片自带 `signatureQuote` 字段、视觉用新三档
- 旧 share 链接打开仍正常渲染（缺 quote 段、bar 仍按 tier 出新视觉，因为 tier 是从 size 实时算的，与是否含 quote 无关）
- localStorage 里的 v3 profile 没有 quote 字段，刷新后看不到那一行，其余照旧

回滚：把 PersonaCard 的 quote 渲染分支和 `.bar--*` 三个 className 改回原 `.bar` 即可；schema 字段保留为可选不会污染数据。

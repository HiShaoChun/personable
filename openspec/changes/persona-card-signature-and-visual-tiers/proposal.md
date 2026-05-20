## Why

人格卡当前已用「主线/副线/番外」的任务系统语言给簇排了叙事层级，但三档在卡面上视觉表现完全一致（同一根紫青渐变进度条 + 右上角文字标签），叙事差异只靠读者识别那两个汉字。卡面也缺少一句能代表此人物的"签名"——所有 vibe 共享同一套 traits chips，少了角色卡里那种 "flavor text" 的钩子。这一档改造把这两个低成本元素先做掉，让卡片更像可被收藏的角色卡。

## What Changes

- 给 `PersonaProfile` 增加可选字段 `signatureQuote: string`——一句不超过 28 字的台词，由 synthesis 阶段按当前 vibe 风格从聚类描述里提炼，渲染在 headline 下方、traits 之上
- synthesis prompt 增加该字段的生成要求与好/坏例；schema 校验在字段存在时强制长度上限、不存在时不报错（向后兼容旧 share JSON 与旧 localStorage）
- `PersonaCard.tsx` 把现在统一的 `<div className="bar">` 拆成三种 modifier：`bar--main`（金色光晕渐变 + 柔和 glow）、`bar--side`（银/灰渐变）、`bar--extra`（细虚线条），由现有 `sizeLabel` 推导
- 现有 `sizeLabel` 函数拆出 `storylineTier(c, all): "main" | "side" | "extra"`，标签文字渲染保持「主线/副线/番外」不变
- 更新 `src/lib/samples.ts` 三份示例（earnest/roast/poetic）补上 `signatureQuote`，让首页 idle 态就能看到新视觉

## Capabilities

### New Capabilities
<!-- 无新 capability，本次改造完全在两个现有 spec 内 -->

### Modified Capabilities
- `persona-agent`: 「结构化画像输出」要求增加可选 `signatureQuote` 字段及其长度/语气约束
- `persona-card`: 「人格卡渲染」要求增加签名台词的渲染位置与缺失时的降级；增加按 storyline tier 的进度条差异化视觉要求

## Impact

- 代码：`src/lib/agent/schema.ts`（类型 + validateProfile + normalizeProfile）、`src/lib/agent/synthesize.ts`（prompt）、`src/components/PersonaCard.tsx`（渲染 + tier helper）、`src/app/globals.css`（新增 `.bar--main/side/extra` 类）、`src/lib/samples.ts`（三份示例补字段）
- 兼容性：旧 share 链接（DB 内存的 PersonaProfile JSON 没有 `signatureQuote`）与旧 localStorage 持久化（STORAGE_VERSION = 3，profile 子对象同样无该字段）均按"缺失则不渲染该段"降级，无需 bump 版本号
- 无新依赖、无 API 变化、无服务端路由变化

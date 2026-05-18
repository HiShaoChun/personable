# Traits 改短标签 chips + Cluster blurb 整体下线

> 把人格特质从「短词：解释」改成纯短标签（每条 ≤8 字、名词短语、
> 无冒号无解释），把兴趣簇的 blurb 解说从生成与渲染里整体拿掉。
> 一张卡的视觉质感从「工作汇报」拉到「海报」。

## Why

trim-card-density 那一次把"卡片不超过 5 条特质 + 5 个簇 + 一行散点"
的骨架确立了。但实际渲染出来的卡（用户最新截图）还是密集：

1. **trait 不再是 chip**。模型把每条特质写成「系统性：习惯用架构视
   角解构问题，从调度器到课堂排课都寻求可扩展的抽象」这种"短词 +
   冒号 + 完整解释"——chip 的圆角胶囊视觉被里面的句子撑成了卡片块，
   一眼扫不完，标签的「被一眼吃掉」的特性彻底丢失。
2. **cluster blurb 是 AI 解释 AI 自己**。每个簇下面那一行小字
   （「高度集中的内部/历史平台入口，反映曾深度参与教育 BG 项目开发
   与运维…」）只是把簇名换个说法再说一遍，加进度条 + size 数字本
   身已是完整信号；blurb 是叠加的冗余层，没人会读完 4 行解说。

两者都是「LLM 默认想多说一点显得勤奋」的产物，对海报感是负贡献。
本 change 直接在 schema + prompt + 渲染三层一起治理，让卡片到下一
个截图人的手机屏幕上时是可以「一眼吃完」的状态。

## What Changes

### A. Traits 改纯短标签 chips
- 在 [src/lib/agent/schema.ts](src/lib/agent/schema.ts) 的
  `validateProfile` 新增 per-trait 字符上限 8（中文字符）。任一 trait
  超长 → validate 失败 → `synthesize` 走既有重试。
- 在 `normalizeProfile` 加 trait 清洗 belt-and-suspenders：trim、
  截断在「：/:」之前（如模型输出"系统性：习惯用…"也只保留"系统性"）、
  限长 8 字、过滤空串。
- 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的
  `buildPrompt` 把示例 `"traits":["3-5条人格特质"]` 改为更强约束
  （每条 ≤8 字、名词短语、不允许冒号或解释性文字）。

### B. Cluster blurb 端到端移除
- 在 [src/lib/agent/schema.ts](src/lib/agent/schema.ts) 把
  `InterestCluster.blurb` 从必选改为可选 `blurb?: string`。
- 在 `normalizeProfile` 不再从 raw cluster 读 blurb，新生成的画像
  JSON 不含该字段。
- 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的
  `buildPrompt` 从 clusters JSON 示例里删掉 `"blurb":"一句话"`。
- 在 [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx)
  删掉 `{c.blurb && <div className="blurb">…}` 整行——同时让旧 share
  链接（存量 JSON 里带 blurb）也按新海报形态展示，blurb 自然隐藏。
- 保留 [src/app/globals.css](src/app/globals.css) 里的 `.blurb` 样式
  （无引用即死代码、清理与否不影响渲染；为减小爆炸半径不动）。

## Capabilities

### Modified Capabilities
- `persona-agent`：「结构化画像输出」要求增补「traits 每条 ≤8 字、
  纯名词短语」约束；clusters 输出要求中删去 blurb（保留 name、size、
  domains）。
- `persona-card`：「人格卡渲染」要求改为渲染纯短标签 chips；不再
  渲染 cluster 解说行；对旧 share 链接的兼容描述同步更新——blurb
  字段存在与否，渲染结果都是新海报形态。

### New Capabilities
<!-- 无 -->

## Impact

- **受影响代码**：
  - [src/lib/agent/schema.ts](src/lib/agent/schema.ts)：类型 + validate + normalize 三处
  - [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)：`buildPrompt` 一处
  - [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx)：删一行
- **受影响 spec**：`persona-agent` 与 `persona-card` 各一个增量。
- **重试率影响**：traits ≤8 字是新硬约束。`synthesize` 自带 3 次
  重试 + 把 lastErr 反馈给模型，预期 1-2 次内收敛；个别次数极端可
  能整次合成失败，按今天的 `synth_failed` 路径返回错误。
- **token 影响**：blurb 不再生成约节省 5-10% 输出 token（按样卡 4
  个簇 ×~30 字 blurb 估算），对单次合成 ~2000 max_tokens 是优化、
  不是瓶颈。
- **旧 share 链接**：JSON 里仍带 blurb 字段，但 PersonaCard 不渲染
  →视觉自动与新卡片一致，无破坏性。新生成的 share JSON 不再带
  blurb。这是有意为之，已与用户对齐（「一纷拉措隐藏」）。
- **不影响**：vibe / 重合成 / precompute 路径 / cluster 数量过滤
  （trim-card-density 已做）/ evolution / headline / domains / 任何
  并行 change（如 persist-card-localstorage）。
- **回滚**：复原以上三个文件即可。旧/新 share JSON 共存无害。

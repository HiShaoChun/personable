## Context

当前 [src/app/page.tsx](src/app/page.tsx) 的渲染结构里，「过程档案」区块
（`<div className="steps">…`，含步骤指示器、聚类/深挖/合成三段思考面板、
fetch chips、簇预览）外层守卫是：

```tsx
{(phase === "parsing" || phase === "thinking") && (
  <div className="steps">…</div>
)}

{phase === "done" && profile && (
  <>
    <PersonaCard … />
    <div className="toolbar">…</div>
  </>
)}
```

`phase` 由 `handleFile` 在 NDJSON 解析到 `done` 事件时切到 `"done"`，过程
区块整块从 DOM 卸载——但所有承载内容的 state 仍在内存：`ovStat`、
`clusterPrev`、`clusterThinking`、`thinking`、`fetches`、`synthThinking`。

修复天然是「让区块在 `done` 阶段也渲染」，但需要选定一些细节：终态下进度
指示器的视觉、与卡片的纵向顺序、regenerate（切换 vibe）时过程档案的处理。

## Goals / Non-Goals

**Goals:**
- 终态页面同时展示过程档案与最终卡片，过程档案上至「浏览器内解析」、
  下至「把碎片合成一张人格卡片」连贯可读。
- `Step` 在终态全部呈现「已完成」静态视觉；流式光标 `▍` 不再闪烁。
- 导出图片与分享链接仅承载卡片本体——这是「玩具截图传播」的物理载体，
  必须保持紧凑。
- regenerate 换风格时：过程档案保持上一轮原貌（事实上深挖也没重跑），
  仅卡片随新 vibe 替换。

**Non-Goals:**
- 不为过程档案再加一个折叠/展开 UI——保留过程是产品姿态，默认就该看到；
  长度问题靠原生滚动消化。
- 不在 regenerate 阶段伪造新的 `synth_thinking` 重播；当前 regenerate 走
  非流式路径（`synthesize` 不传 `onThinking`），这条边保持。
- 不改 `loop.ts` / `synthesize.ts` / `/api/persona` —— Progress 协议已够用。
- 不引入对原始 NDJSON 事件的持久化（页面刷新即清空，与隐私叙事一致）。

## Decisions

### D1 — 渲染守卫从 `phase` 切到「曾运行过」语义

把过程档案的守卫改为「`phase !== "idle"`」，即一旦 `handleFile` 开始处理
就常驻渲染，直到下一次 `handleFile` 调用时被同一处的状态重置清空。这个
表达直白对应「整页过程档案」的产品意图，避免再引入 `traceVisible` 这类
冗余 flag。

否决备选 A（新增 `traceVisible: boolean`）：状态机更复杂、与现有重置点
（`handleFile` 开头）耦合而无收益。

否决备选 B（按 `profile != null` 守卫）：和 idle 重新拖入新文件时的中间
态语义打架，会出现「过程档案残留到新一次运行的 parsing 阶段」。

### D2 — 终态下 `Step` 视觉硬切到「已完成」

`<Step done active label>` 的 `active`/`done` 输入当前由进行中的 stage 推
导（如 `on={stage === "deepdive"}`）。在 `phase === "done"` 下，所有
`on` 强制为 `false`、`done` 强制为 `true`，并隐藏所有 `▍` 闪烁光标。
理由：保留过程数据但不要让页面看起来还在工作；用户应该一眼看到「整条
管线已完成」。

实现上最简洁的做法是在渲染时引入一个 `finished = phase === "done"`，
对每个 `<Step>` 与 caret 处的条件做一次 OR/AND：`done={finished || …}`、
`on={!finished && …}`、`{!finished && <span className="caret">▍</span>}`。
不抽组件、不动 CSS。

### D3 — 卡片渲染在过程档案下方

顺序为：标题/副标题 → 过程档案 → `note`/`err` → `PersonaCard` → 操作栏
→ 隐私链接。理由：

1. 阅读时序与生成时序一致（自顶向下），用户终态打开页面也能像读流水
   账一样看一遍 agent 怎么得出结论。
2. 卡片在视口下方反而强化「先看过程，再看结论」的玩具节奏；操作栏紧贴
   卡片，导出/分享/换风格不远离主体。

否决备选（卡片在上、过程档案折叠在下）：和 D2 一致，需要折叠控件，且
弱化过程感——和本 change 的目的相反。

### D4 — regenerate 不动过程档案

`regenerate(vibe)` 当前只 fetch `/api/regenerate` 并 `setProfile`、
`setIds`，不触碰过程相关 state。本 change 维持该现状不变。理由：底层
agent 状态被服务端复用（archived 设计 D8），过程档案描述的就是这一次
agent 跑出来的真实轨迹，换风格不重跑深挖——所以原过程档案在事实上仍
然成立，不需要清空、也不该重播。

副作用：在终态切换风格时，过程档案的「把碎片合成一张人格卡片」一步
对应的 `synthThinking` 仍是首次 vibe 的预告。这是可接受的：那是 agent
「曾经怎么收尾」的真实记录，不是当前卡片的解说词；卡片自身的 vibe 文
案已经表达了新风格的产物。

### D5b — 合成阶段也产出实质性思考文本

实地试跑后发现：合成阶段流式 prompt 原本只要求模型"先用 1-2 句话简短点评"
再吐 JSON，许多次运行模型会直接吐 `{` 开始 JSON，前端 `synthThinking` 拿
到的是空串，「把碎片合成一张人格卡片」这一步在档案里只剩一个标题，
和深挖那一大段实质性 reasoning 的体感落差很大——这正是用户「不够真」感
受的来源之一。

在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 把流式
system prompt 从「1-2 句点评」改为「4-7 句、约 100-220 字、点名具体簇
或域名的合成思路」，并明确要求段落形式、避免项目符号/小标题。要求覆盖：
怎么读这个人、起什么大标题、留哪些特质舍哪些、时间线如何切段。

不改 `parseJson` —— 它本来就会剥 ```json 围栏并取首个平衡 `{...}`，
preamble 多长都安全。也不改流式切分逻辑（`buf.indexOf("{")` 之前的内容
作为 thinking 流出）—— 既然让模型多写，自然会有 token 落到 thinking
区间。仅改 prompt 即可。

非流式路径（`regenerate` 用的 `response_format=json_object` 分支）保持
"只输出 JSON" 不变——重合成时本身不需要再播放思考，与 D4 一致。

### D5 — 导出与分享只截卡片

`exportImage` 使用 `toPng(cardRef.current)`，`cardRef` 绑定的是
`<PersonaCard>` 内部容器，过程档案不在其范围内——不需要任何额外改动。
分享链接 `/c/:id` 服务端按 ID 渲染派生画像 JSON，本身就不含过程数据。
此处仅作为决策记录，避免后续重构时把过程档案误并进 `cardRef`。

## Risks / Trade-offs

- **页面变长** → 桌面端无问题；移动端需 QA 确认滚动顺畅、`deep-panel`
  里的长文本能换行不溢出。如发现移动端体验差，最小修补是在 ≤480px 媒体
  查询里给 `.deep-panel` 加 `max-height` + `overflow-y: auto`，不退回到
  「折叠掉过程」的反向方案。
- **首次终态视觉跳变** → 进度指示器从「最后一步进行中（带光标）」直接
  跳到「全部已完成（静态）」，跳变明显。可接受——这正是「跑完了」的语
  义；如果体感太硬，后续可加一个 ~200ms 的 step-done 过渡，但属于打磨。
- **regenerate 时过程档案与新卡片 vibe 不一致**（D4 副作用） → 已论证
  可接受；如未来用户反馈混淆，可在过程档案末尾加一行小字「以下卡片已
  按 X 风格重合成」，不动核心结构。

## Migration Plan

无需迁移。改动仅在前端渲染条件层，部署即生效；旧分享链接 `/c/:id` 行
为完全不变。回滚 = 还原 [src/app/page.tsx](src/app/page.tsx) 即可。

## Open Questions

- 暂无。

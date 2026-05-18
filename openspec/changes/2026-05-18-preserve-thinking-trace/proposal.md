# 保留思考过程到最终页面

> 生成结束后，把「浏览器内解析 → 概览 → 聚类点评 → agent 深挖叙述 +
> 抓取状态 → 合成预告」的全过程保留在页面上，最终人格卡渲染在它们之后，
> 让整页成为一份从上到下可回溯的「过程档案」。

## Why

当前在 `phase === "done"` 时，[src/app/page.tsx](src/app/page.tsx) 只渲染
`<PersonaCard>` 加操作栏，之前用于展示 agent 推进的 `steps` / `deep-panel` 区块
（覆盖 `parsing` 与 `thinking` 两个阶段）整体被卸载——尽管对应的状态（
`ovStat` / `clusterPrev` / `clusterThinking` / `thinking` / `fetches` /
`synthThinking`）都还在内存里。

这造成两个问题：

1. **「不够真」的体感**。这个产品的传播钩子之一是「agent 自己决定研究你」
   （archived 设计 D3）。如果用户看完最终卡片想再翻一眼「它当时是怎么想的、
   抓了哪些页面」，过程已经消失，只剩一个结论卡——和「又一个 AI 总结器」
   没有区别，过程感被一次性折叠没了。
2. **过程数据被浪费**。`loop.ts` 已经把每个阶段的流式 reasoning、抓取状态机
   都通过 NDJSON 推到前端并落到 React state；前端只是在终态把它们隐藏了。

## What Changes

- 改动 [src/app/page.tsx](src/app/page.tsx) 的渲染条件：把「过程档案」区块
  （步骤指示器、聚类思考、深挖叙述+抓取 chips、合成预告）的渲染条件从
  「phase 为 parsing 或 thinking」放宽到「曾经开始过一次运行」，使其在
  `done` 阶段继续可见。
- 在 `done` 阶段，过程档案区块的所有「在跑」视觉（active dot、闪烁光标
  `▍`）切换为「已完成」静态形态，避免页面看上去还在工作。
- 最终卡片仍渲染在过程档案下方；导出图片仅截取 `cardRef`（已是现状），
  分享链接形态与 ID 不变。
- 「换个风格」（regenerate）时：保留当次原始过程档案不变（其底层 agent
  状态被复用、深挖确实没重跑），仅替换卡片本体；不伪造新的
  `synth_thinking`。
- 新一次「拖入新文件」运行（已实现于 `handleFile` 开头的状态重置）会清空
  并重建过程档案，行为不变。

## Capabilities

### Modified Capabilities
- `persona-card`：新增「保留 agent 过程档案」要求，明确 finalize 之后过程
  区块继续展示、卡片在其后渲染，且仅卡片被纳入导出图片与分享链接。

### New Capabilities
<!-- 无 -->

## Impact

- 受影响代码：仅 [src/app/page.tsx](src/app/page.tsx)（渲染条件与 `Step` 终
  态视觉）。`loop.ts` / `synthesize.ts` / API 路由不变——所有需要的 Progress
  事件与状态已存在。
- 受影响 spec：`openspec/specs/persona-card/spec.md` 增补一条
  Requirement（见本 change 的 `specs/persona-card/spec.md` 增量）。
- 不影响：隐私叙事（原始数据仍不出浏览器）、成本（不新增模型调用）、
  分享链接形态、按风格重合成路径。
- 视觉风险：过程档案 + 卡片 + 操作栏纵向堆叠后页面变长；保存为图片仅截
  卡片，不受影响；移动端需要确认滚动顺畅、内容不溢出。

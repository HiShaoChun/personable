## 1. 前端渲染条件

- [x] 1.1 在 [src/app/page.tsx](src/app/page.tsx) 引入 `finished = phase === "done"`，并把过程档案外层守卫从 `(phase === "parsing" || phase === "thinking")` 改为 `phase !== "idle"`（D1）
- [x] 1.2 将每个 `<Step …>` 的 `done` 在 `finished` 时强制为 `true`、`on` 强制为 `false`；隐藏所有 `▍` 闪烁光标（D2）
- [x] 1.3 渲染顺序已天然符合 D3（idle drop → 过程档案 → `note`/`err` → `PersonaCard` → 操作栏 → 隐私链接），无需调整
- [x] 1.4 `cardRef` 仍绑定 `<PersonaCard innerRef={cardRef}>`，过程档案在其外层兄弟节点 → `toPng` 仅截卡片（D5）

## 1b. 合成阶段思考内容增厚

- [x] 1b.1 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 把流式分支的 system prompt 由「1-2 句简短点评」改为「4-7 句、约 100-220 字、点名具体簇或域名的合成思路」，要求段落形式（D5b）
- [x] 1b.2 非流式分支（`response_format=json_object`，`regenerate` 用）保持原样，不重播思考（与 D4 一致）
- [x] 1b.3 不改 `parseJson` 与流式切分逻辑——`{` 之前的内容自动落到 thinking 区间

## 2. regenerate 路径不动过程档案

- [x] 2.1 `regenerate(vibe)` 仅 `setProfile` / `setIds`，未触碰 `clusterThinking` / `thinking` / `fetches` / `synthThinking` / `clusterPrev` / `ovStat`（D4）
- [x] 2.2 切换风格走非流式 `/api/regenerate`，不发射 `synth_thinking` 事件——前端没机会重播，行为正确

## 3. 验证

- [ ] 3.1 桌面端走通一遍：上传 → 看到流式过程 → 卡片出现 → 滚动回看过程档案，所有步骤显示「已完成」、无闪烁光标
- [ ] 3.2 终态点「保存为图片」，截图仅含人格卡，不含过程档案
- [ ] 3.3 终态点「换个风格」中任一选项，验证：卡片替换为新风格、过程档案保持不变、无新的合成预告刷出
- [ ] 3.4 在终态再次拖入另一份书签 HTML 文件，验证：旧过程档案与旧卡片被清空，新一次运行正常展示
- [ ] 3.5 移动端窄屏（≤480px）检查：过程档案 + 卡片纵向滚动顺畅，`deep-panel` 长文本换行不溢出；如发现明显问题，按 design「Risks」中的兜底加一段媒体查询

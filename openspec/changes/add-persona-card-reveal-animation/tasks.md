## 1. CSS 动效定义

- [x] 1.1 在 `src/app/globals.css` 新增 `@keyframes card-flip-in`（rotateY -90 → 0）、`card-bounce-in`（scale 0.98 → 1.02 → 1）、`card-fade-in-quick`（opacity + scale 短淡入）
- [x] 1.2 新增 `@keyframes elem-rise`（opacity 0→1 + translateY 6px→0，250ms ease-out）用于卡内元素
- [x] 1.3 新增 `.card.reveal-first` / `.card.reveal-quick` / `.card.reveal-none` 样式，配置 `transform-style: preserve-3d` 与背面占位
- [x] 1.4 为卡内元素增加 `.reveal-first .card-elem`（按 `--delay` 自定义属性触发 stagger）与 `.reveal-quick .card-elem`（更短 stagger）
- [x] 1.5 增加 `@media (prefers-reduced-motion: reduce)` 块：禁用所有上述动效，强制终态
- [x] 1.6 给 `.toolbar.reveal-first` / `.toolbar.reveal-quick` 配置 `animation-delay` 等于入场总时长，并在动效期间 `pointer-events: none`

## 2. PersonaCard 组件改造

- [x] 2.1 给 `PersonaCard` 新增 prop `reveal?: "first" | "quick" | "none"`，默认 `"none"`
- [x] 2.2 在根 `.card` 上根据 `reveal` 拼接对应 className（`reveal-first` / `reveal-quick` / `reveal-none`）
- [x] 2.3 给 headline、traits 容器、每个 cluster、evolution 块、disclaimer 加 `.card-elem` 类与 `style={{ "--delay": ... }}` 顺序索引
- [x] 2.4 在 `reveal === "first"` 时渲染卡背占位元素（`.card-back`），用 `backface-visibility: hidden` 与卡面互补
- [x] 2.5 用 `useEffect` + `animationend` 监听入场结束，触发可选的 `onRevealEnd` 回调（供上层关闭 quick/first 状态）

## 3. 调用方接入

- [x] 3.1 在 `src/app/page.tsx` 增加状态 `hasRevealedFirst`，初值 `false`；首次 `phase === "done"` 渲染时给 `<PersonaCard>` 传 `reveal="first"`，并在 `onRevealEnd` 中置 `hasRevealedFirst = true`
- [x] 3.2 当用户触发"换个风格重新生成"产出新 profile 后，给 `<PersonaCard>` 传 `reveal="quick"`
- [x] 3.3 把 `.toolbar` 的 className 同步带上 `reveal-first` / `reveal-quick`，与卡片节奏一致
- [x] 3.4 在 `src/app/c/[id]/page.tsx`（分享页）传 `reveal="none"`，保持直接展示终态

## 4. 验证

- [ ] 4.1 在开发模式手动验证：上传书签 → 等到 `phase === "done"`，确认卡片翻转 + 弹跳 + 元素错峰出现，整体在 1.3s 内结束
- [ ] 4.2 点击"换个风格重新生成"，确认第二次出现使用缩短动效（无翻转、<300ms）
- [ ] 4.3 在浏览器开启 `prefers-reduced-motion`（系统设置 / DevTools Rendering 面板），确认卡片直接以终态出现
- [ ] 4.4 在入场动效播放期间点击"保存为图片"按钮，确认按钮在动效结束前不可点击；动效结束后点击导出，确认导出图片是终态卡片
- [ ] 4.5 打开 `/c/[id]` 分享链接，确认分享页不播放动效（直接终态）
- [x] 4.6 运行 `npm run typecheck` 与 `npm run build`，确认无类型/构建错误（typecheck 干净；build 编译通过，trace 文件 EPERM 为本地 dev server 占用，与代码无关）

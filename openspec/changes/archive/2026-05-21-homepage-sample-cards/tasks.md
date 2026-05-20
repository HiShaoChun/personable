## 1. 静态示例数据

- [x] 1.1 新建 [src/lib/samples.ts](src/lib/samples.ts)，导出三份 `PersonaProfile` 常量（命名 `SAMPLE_EARNEST` / `SAMPLE_ROAST` / `SAMPLE_POETIC`），共享同一组虚构 `clusters.name`
- [x] 1.2 每份示例的 `headline` / `traits` / `evolution.summary` 文案手写以体现 vibe 差异；`disclaimer` 用 `DISCLAIMER` 常量
- [x] 1.3 再导出聚合数组 `SAMPLE_PROFILES`，按 `[earnest, roast, poetic]` 顺序排列，供画廊组件 map

## 2. 画廊组件

- [x] 2.1 新建 [src/components/SampleGallery.tsx](src/components/SampleGallery.tsx)，client component，内部 `useState<Vibe | null>` 跟踪当前展开的示例
- [x] 2.2 组件渲染：标题行（含「示例，非真实用户数据」副标）+ 三张缩略卡的水平网格 + 展开区
- [x] 2.3 缩略卡用真实 `<PersonaCard profile={...} />` 渲染，外层容器固定尺寸 + `transform: scale(...)` + `transform-origin: top left` 配合，点击事件挂在外层
- [x] 2.4 被选中的缩略卡加高亮 class；展开区在画廊下方渲染原尺寸 `<PersonaCard>`
- [x] 2.5 点击同一张折叠（`selected === v` 时设为 `null`），点击另一张切换 `selected`

## 3. 首页接线

- [x] 3.1 在 [src/app/page.tsx](src/app/page.tsx) 顶部 import `SampleGallery`
- [x] 3.2 在 `phase === "idle"` 分支的 `</div>` 后面（拖拽区之后）追加 `{!profile && <SampleGallery />}`，确保从 localStorage 恢复的情况也不出现
- [x] 3.3 验证：上传开始后画廊立刻消失（条件渲染天然成立，无需额外清理）

## 4. 样式

- [x] 4.1 在 [src/app/globals.css](src/app/globals.css) 追加 `.samples`、`.samples-head`、`.samples-grid`、`.sample-thumb`、`.sample-thumb.selected`、`.sample-expanded` 等类
- [x] 4.2 桌面端 `grid-template-columns: repeat(3, 1fr)`；`@media (max-width: 640px)` 切换为单列
- [x] 4.3 缩略容器固定 `aspect-ratio` 或 `height`，与内部 `scale(...)` 后的 PersonaCard 视觉对齐
- [x] 4.4 高亮态用 `border-color: var(--accent)` 或类似与拖拽区 `.drop.over` 一致的反馈

## 5. 验证

- [x] 5.1 `npm run dev` 起本地，桌面端检查：未上传时画廊出现、点击展开/折叠/切换正常、拖入文件后画廊消失（**待用户本地验证**）
- [x] 5.2 浏览器窄化到 ≤640px 检查移动端单列布局（**待用户本地验证**）
- [x] 5.3 清空 localStorage 后刷新仍正常；执行一次完整上传 → 完成 → 刷新页面，验证恢复态下画廊不出现（**待用户本地验证**）
- [x] 5.4 DevTools Network 面板确认整个示例画廊的交互全程没有任何 fetch 请求（**待用户本地验证**）
- [x] 5.5 `npm run build` 跑过，无 TypeScript 错误（确保示例数据满足 `PersonaProfile` 类型）—— `npx tsc --noEmit` 无错误，`next build` 编译通过（trace 文件 EPERM 不影响产物，是 .next 目录被占用）

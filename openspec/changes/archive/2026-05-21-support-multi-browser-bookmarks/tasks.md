## 1. 首页文案

- [x] 1.1 改写 [src/app/page.tsx:437](src/app/page.tsx#L437) 副标：把"Chrome 书签导出文件"替换为"你浏览器导出的书签 HTML"
- [x] 1.2 改写 [src/app/page.tsx:458](src/app/page.tsx#L458) 拖拽区 hint：第一行保持"或点击选择"；额外增加一个 `<details>` 折叠块，summary 文本「查看各浏览器如何导出书签 ▾」，展开内容列出三组导出路径：
  - Chromium 系（Chrome / Edge / Brave / Arc 等）：书签管理器 → ⋮ → 导出书签
  - Firefox：书签 → 管理书签 → 导入和备份 → 导出书签为 HTML
  - Safari：文件 → 导出 → 书签
- [x] 1.3 改写 [src/app/page.tsx:152](src/app/page.tsx#L152) 错误提示：去掉 "Chrome"，改为"这看起来不是浏览器导出的书签 HTML（Netscape 格式）。请在你常用的浏览器里执行『导出书签 → HTML』后再上传。"

## 2. 样式

- [x] 2.1 在 [src/app/globals.css](src/app/globals.css) 追加 `.export-howto`（`<details>` 容器）与 `.export-howto summary`、`.export-howto ul` / `.export-howto li` 样式：色阶与 `.hint` 一致；展开后行间距适中、字号小一号；不出现默认蓝色聚焦边框
- [x] 2.2 在 `.drop` 内 `<details>` 处理：点击 summary 不应该触发 .drop 的 `onClick`（也不应该触发 `<input>` 选择文件）—— 在 component 层为 `<details>` 元素 / summary 加 `onClick={(e) => e.stopPropagation()}`

## 3. spec 同步

- [x] 3.1 修改 [openspec/specs/bookmark-import/spec.md](openspec/specs/bookmark-import/spec.md) 第 5-6 行 Purpose 段：把"在浏览器端接收并解析 Chrome 书签 HTML 导出文件"改为"在浏览器端接收并解析 Netscape Bookmark File Format 的书签 HTML 导出文件（兼容所有支持该格式导出的主流浏览器）"
- [x] 3.2 验证 archive 时 delta 中的 MODIFIED Requirement 能正确替换原 spec 中的对应需求块（保留 Purpose 修改不被覆盖）—— `openspec validate "support-multi-browser-bookmarks"` 通过

## 4. 验证

- [x] 4.1 `npx tsc --noEmit` 通过
- [x] 4.2 `npm run dev` 起本地：首页副标无 "Chrome" 字样；点开 `<details>` 看到三行浏览器路径；折叠正常（**待用户本地验证**）
- [x] 4.3 点击 `<details>` 的 summary 时，不应触发文件选择对话框（即 `<input type="file">` 的 click 不应被冒泡触发）（**待用户本地验证**）
- [x] 4.4 拖入一个故意损坏的 HTML（如随便一份网页源码），错误提示不出现 "Chrome"，包含"Netscape 格式"字样（**待用户本地验证**）
- [x] 4.5 拖入真实 Firefox / 任意浏览器导出的合法书签 HTML（如果手头有的话），可以正常进入解析流程；若手头只有 Chrome 文件，至少验证 Chrome 文件仍可上传成功（回归）（**待用户本地验证**）

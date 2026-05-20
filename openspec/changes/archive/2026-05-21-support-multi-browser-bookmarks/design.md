## Context

[src/lib/bookmarks/parse.ts:32-38](src/lib/bookmarks/parse.ts#L32-L38) 的
`looksLikeBookmarkExport` 检测的是 `NETSCAPE-BOOKMARK` 标记或 `<DL>` + `<DT>`
标签，这是 1990 年代 Netscape 制定、至今仍是浏览器书签导出事实标准的格式。
现存的所有主流浏览器导出 HTML 书签都用这个格式，包括但不限于：

- Chrome / Chromium / Edge / Brave / Vivaldi / Arc / Opera（Chromium 系）
- Firefox
- Safari

代码层面零工作量。问题完全在用户可见的三段文案与一份 spec：
1. [src/app/page.tsx:437](src/app/page.tsx#L437) 副标
2. [src/app/page.tsx:458](src/app/page.tsx#L458) 拖拽区 hint
3. [src/app/page.tsx:152](src/app/page.tsx#L152) 错误提示
4. [openspec/specs/bookmark-import/spec.md](openspec/specs/bookmark-import/spec.md)
   的 Purpose + "客户端书签文件解析"需求的两个场景

## Goals / Non-Goals

**Goals:**
- 让 Firefox / Safari / Edge / Brave 等浏览器用户进首页时能立刻判断"这事跟
  我有关"，敢往里拖文件
- 在不把首页变成"教程"的前提下，给出各浏览器导出书签的最短路径
- `bookmark-import` spec 的契约从"接收 Chrome 导出"显化为"接收 Netscape
  格式导出"，让"支持范围"成为可验证的对外承诺

**Non-Goals:**
- 不引入浏览器嗅探 / User-Agent 判断 / 按浏览器分支的不同 UI
- 不为"如何导出书签"做独立路由 / 独立页面 / 独立组件
- 不在文案里穷举所有浏览器（罗列疲劳），也不漏掉占大头的几家
- 不动解析器逻辑、不动 API、不动持久化

## Decisions

### 1. 拖拽区 hint：折叠式 `<details>` 内联展开各浏览器路径

**结构：**

```
或点击选择
查看各浏览器如何导出书签 ▾   ← <summary>，点击展开
  Chrome / Edge / Brave  · 书签管理器 → ⋮ → 导出书签
  Firefox                · 书签 → 管理书签 → 导入和备份 → 导出书签为 HTML
  Safari                 · 文件 → 导出 → 书签
```

**为什么用 `<details>`：**
- 原生 HTML 元素，零 JS / 零额外依赖，无障碍开箱即用
- 默认折叠 → 首页保持简洁；想看的人主动展开
- 不需要新路由 / 新页面 / 新组件文件

**替代方案：**
- *独立 `/how-to-export` 页面：* 增加一次跳转、需要路由 + 布局；信息量不足以撑起一页
- *Modal / Popover：* 需要点击关闭、需要遮罩、需要无障碍考量；过度工程
- *把全部浏览器路径平铺在拖拽区：* 首屏拥挤，喧宾夺主

### 2. 浏览器清单：分组而非穷举

合并 Chromium 系（Chrome / Edge / Brave / Arc / Vivaldi / Opera）为一行，
因为这些导出路径几乎一致（都是"书签管理器 → ⋮ → 导出书签"）。然后 Firefox
单独一行（路径不同），Safari 单独一行。三行足够覆盖 ≥95% 的现实用户，又
不至于成清单恐惧。

**不在清单里的浏览器**（如 Yandex / Tor Browser）：它们沿用 Chromium / Firefox
基础，导出路径一致，跟着前面的指引照做即可。文案不点名 → 既不限制也不背书。

### 3. 错误提示：用"Netscape 书签 HTML"作为格式名

新文案：「这看起来不是浏览器导出的书签 HTML（Netscape 格式）。请在你常用的
浏览器里执行『导出书签 → HTML』后再上传。」

- 不点名特定浏览器
- 显式给出格式名，便于用户在搜索引擎自查
- 给出动作指引（"导出书签 → HTML"），不仅说"不对"

### 4. 副标改写

旧：`拖入你的 Chrome 书签导出文件，AI 解读你的互联网人格，生成一张可分享的卡片。`

新：`拖入你浏览器导出的书签 HTML，AI 解读你的互联网人格，生成一张可分享的卡片。`

把"Chrome"改成"你浏览器"——口语化、包容性、信息量不减。

### 5. spec delta：MODIFY 而非 ADD/REMOVE

要修改的是同一个 Requirement（客户端书签文件解析）的措辞与场景描述，没有
新增能力或废止旧能力。按 OpenSpec MODIFIED 流程：copy 整段 Requirement 块到
delta 并改写，archive 时整体替换。

Purpose 段是描述性文字而非 Requirement，但也得改。delta spec 文件不直接表达
Purpose 变化；改用 tasks.md 里增加一步"archive 后手工核对 Purpose"，或者
更稳妥的做法是 archive 时一并 sed 替换。设计上选择：**tasks 里显式列出
Purpose 修改作为 archive 前置项**，由 apply 阶段直接改 `openspec/specs/...`
里的 Purpose 段（虽然不在 delta 形式里，但通过手工编辑落地）。

## Risks / Trade-offs

- [`<details>` 默认箭头样式各浏览器略有差异] → 接受，原生体验更稳妥；
  若需要统一可在 CSS 里用 `summary::-webkit-details-marker` + 自定义 marker，
  但本次不做（过度雕饰）
- [清单只列三组浏览器，可能漏掉冷门用户] → 副标 + 错误提示都用"浏览器"
  无差别口径，冷门用户照旧能上传成功；只是没有专门指引
- [Purpose 段编辑不在 OpenSpec delta 形式里] → tasks 里显式记录这一步，
  apply 时手工同步；archive 时复核
- [Firefox 各版本导出路径可能微调] → 文案给出大致路径而非"点击第 N 项"
  的逐字指令，留容错

## Migration Plan

无数据迁移。纯文案 + spec 措辞改动。回滚 = revert commit。

## Open Questions

- 是否需要把"Netscape Bookmark File Format"这个术语放进文案？  
  倾向：**只在错误提示里出现**，副标和拖拽区保持口语化。原因：错误提示
  的受众更可能是想搜索答案的用户，技术名有用；首屏受众是普通访客，专业
  名词反而劝退。

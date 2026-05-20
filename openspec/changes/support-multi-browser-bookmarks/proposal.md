## Why

解析器 [src/lib/bookmarks/parse.ts](src/lib/bookmarks/parse.ts) 早就基于
Netscape Bookmark File Format 工作，技术上任意主流浏览器（Chrome / Firefox /
Edge / Safari / Brave / Arc / Opera / Vivaldi 等）导出的 HTML 书签都能解析；
但首页副标、拖拽区 hint、错误提示三处文案都点名 "Chrome"，把潜在的 Firefox /
Safari / Edge 用户挡在门外。`bookmark-import` spec 的场景描述也用 Chrome 举
例，使得这种排他暗示有"规范背书"。需要把对外承诺与文案显化为"支持 Netscape
格式的主流浏览器"。

## What Changes

- 改前端文案，把"Chrome 专属"的暗示从首页清除：
  - 首页副标不再点名某个浏览器
  - 拖拽区 hint 改为"通用一句话 + 可展开看各浏览器导出路径"
  - 文件被拒时的错误提示去除"Chrome"字样，改为指向"Netscape 格式书签 HTML"
- 更新 `bookmark-import` spec：
  - 把"Chrome/Netscape 格式"的措辞改为"Netscape Bookmark File Format（Chrome /
    Firefox / Edge / Safari / Brave / Arc / Opera 等主流浏览器导出皆为此格式）"
  - 把"上传有效的 Chrome 导出文件"场景改为浏览器无关的描述
  - 错误提示场景明确"不点名特定浏览器作为唯一支持项"
- 不动解析器（已经是格式驱动）；不动 API / 持久化 / 后端

## Capabilities

### New Capabilities
（无）

### Modified Capabilities
- `bookmark-import`：把"客户端书签文件解析"需求的措辞与场景从 Chrome 专属
  扩展到所有支持 Netscape 格式的浏览器；同时收紧错误提示场景，要求拒绝消息
  不暗示单一浏览器。

## Impact

- 修改文件：
  - [src/app/page.tsx](src/app/page.tsx)：副标、拖拽区 hint、错误提示三处文案
  - [openspec/specs/bookmark-import/spec.md](openspec/specs/bookmark-import/spec.md)：
    Purpose 段措辞与"客户端书签文件解析"需求的两个场景（archive 时由 delta 合入）
- 不影响：解析器代码、API 路由、agent 流程、持久化、分享链接、其他 spec
- 验证面：纯文案改动，无新增依赖；TS 类型不变；既有测试不受影响

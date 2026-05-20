## Why

当前分享链接形如 `https://.../c/2Sirxu7XEGgc`，路径段 `/c/` 无语义、ID 不可读，
对方在聊天里看到只是一串字符，既不知道是什么、也没有视觉上下文，转化成本高。
我们希望让链接被复制粘贴出去的那一刻，对方"一眼就懂"这是一张书签人格卡。

## What Changes

- **BREAKING（路由）**：分享卡路由从 `/c/[id]` 改名为 `/persona/[id]`，让 URL 自带语义。
- **兼容**：保留旧 `/c/[id]` 路径，在服务端 301 重定向到 `/persona/[id]`，避免存量分享链接死亡。
- **复制行为**：首页"复制分享链接"按钮复制到剪贴板的内容，由纯 URL 变为带前缀的可读文本：
  `【书签人格卡】<headline> <url>`。其中 `<headline>` 取自当前画像。
- **失败 fallback 文案同步**：剪贴板写入失败时，提示里展示的也是新的完整文本（而非只有 URL）。
- **不引入 slug**：URL 仍只含 ID，可读性完全由前缀文本承担（用户选定的方案 C）。

## Capabilities

### New Capabilities
<!-- 本次没有新增 capability。 -->

### Modified Capabilities
- `persona-card`: 分享链接的路径形式（`/c/[id]` → `/persona/[id]` + 旧路径重定向）以及复制到剪贴板的内容格式（纯 URL → 带 headline 前缀的文本）发生变化。

## Impact

- 代码：
  - 路由目录 `src/app/c/[id]/` → `src/app/persona/[id]/`
  - 旧路径需新增一个最小的 redirect 路由处理器（或 `next.config` 的 `redirects()`）
  - `src/app/page.tsx` 的 `copyShare()` 调整生成内容
- 文档：`src/app/c/[id]/page.tsx` 顶部 spec 引用注释需要更新到新路径
- 外部影响：在 7 天 TTL 内已经分享出去的旧 `/c/<id>` 链接通过 301 仍可访问
- 依赖：无新增

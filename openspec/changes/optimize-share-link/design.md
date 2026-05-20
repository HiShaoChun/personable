## Context

当前分享流程：用户在首页定稿画像 → 后端把画像 JSON 以 nanoid 为 key 写入 store
（内存或 SQLite，TTL 7 天）→ 前端 `copyShare()` 把 `${origin}/c/${id}` 复制到剪贴板。
路由文件位于 `src/app/c/[id]/page.tsx`。

痛点：路径段 `/c/` 无语义、ID 不可读，链接被粘贴到聊天里完全是"裸 URL"，
对方无法在不点击的情况下判断这是什么。

约束：
- 卡片存储 schema 不能变（要兼容老 JSON，已有线上 share 卡正在 7 天 TTL 内）。
- 不引入新的运行时依赖（不能为了一句 slug 装 pinyin 库——见提案）。
- 路由变更必须保证存量 `/c/<id>` 链接不死。

## Goals / Non-Goals

**Goals:**
- 让分享文本在任何聊天/IM 中粘贴出来都自带语义（无需点开就能识别）。
- 让 URL 路径本身更可读：`/c/` → `/persona/`。
- 旧路径仍然可用（旧链接通过 301 重定向到新路径）。

**Non-Goals:**
- 不做 slug（无论 vibe-based 还是 pinyin-based）。前缀文本已经承担可读性。
- 不做 OpenGraph meta / 动态预览图。那是下一个独立 change 的事，本次只做"复制粘贴可读"。
- 不改 store schema、不改 ID 生成方式、不改 TTL。
- 不改"换风格重新生成"的分享语义（每个变体仍各自一个 ID）。

## Decisions

### 1. 路由从 `/c/[id]` 改名为 `/persona/[id]`

新建 `src/app/persona/[id]/page.tsx`，内容是原 `src/app/c/[id]/page.tsx` 的逻辑搬迁
（getCard / 渲染 / 过期 fallback 都不变）。

**为什么 `persona` 而不是 `card`：** 项目名为 "personable"，spec 名为 `persona-card`，
`/persona/` 与领域语言一致；`/card/` 太泛，可能将来还会有别的卡片类型。

### 2. 旧 `/c/[id]` 通过 `next.config.ts` 的 `redirects()` 永久重定向到 `/persona/[id]`

用 Next.js 的 `redirects()` 配置而不是再写一个 page，原因：
- 零运行时代码、零 db 查询，重定向在路由层完成
- `permanent: true` 自动返回 308（Next 行为，等价 301 语义），搜索引擎和聊天 unfurl 缓存都会更新
- 不需要保留 `src/app/c/` 目录（删干净，避免双入口）

**备选方案：** 在 `src/app/c/[id]/page.tsx` 里调用 `redirect()`。
**否决理由：** 要保留一个空 page 文件，且每次请求都跑一次 Node runtime；
配置层的 redirect 更轻、更明确。

### 3. 复制内容格式：`【书签人格卡】<headline> <url>`

- 前缀 `【书签人格卡】` 是产品名，固定中文方括号，与现有 `<h1>书签人格卡</h1>` 一致。
- `<headline>` 直接取自当前画像（`profile.headline`），首页本来就握有这份数据。
- 三段以单空格分隔。中间不放换行——一些聊天工具会把多行内容拆成多条消息，单行更稳。

**为什么不放 `<headline>` 在最后：** 把链接放最后，聊天工具的 URL 探测最稳，
且对方扫读时是「这是啥 → 谁的 → 链接」，符合阅读顺序。

### 4. headline 的兜底

如果 `profile.headline` 因为某种原因为空（schema 兜底是「你的互联网人格」，
所以理论上不会真空），fallback 到字符串「你的互联网人格」。
不再做更复杂的处理。

### 5. 失败 fallback 文案

`navigator.clipboard.writeText` 失败时，现状是 `setNote("复制失败，请手动复制：" + link)`，
只展示 URL。本次改为展示完整的可分享文本（带前缀），让用户手动复制时也能粘出完整版。

## Risks / Trade-offs

- **[风险] 旧 `/c/[id]` 链接的 7 天 TTL 内被点击 → 301 跳到 `/persona/[id]`，
  但聊天工具的 unfurl 缓存可能记住旧 URL。** → 旧链接仍能正常访问（重定向有效），
  不会 404；unfurl 缓存最多过几天自动失效。可接受。
- **[风险] 「【书签人格卡】」中文方括号在某些粘贴目标里可能被转义。** → 已知主流
  IM（微信、iMessage、Slack、Discord、Telegram）都正常处理；浏览器地址栏不是目标场景。
- **[Trade-off] 不做 slug 意味着 URL 单看仍然不可读。** → 这是设计选择：可读性
  通过前缀文本承担，URL 保持短而干净。若以后改主意，可在 `/persona/<id>` 之上
  叠加可选 slug（兼容好做）。
- **[Trade-off] 不做 OG/预览图 → 链接被对方粘贴到不显示文本只显示链接卡片的
  场景（极少数）时仍然无信息。** → 下一个 change 处理。

## Migration Plan

1. 新建 `src/app/persona/[id]/page.tsx`（搬迁旧逻辑）。
2. 在 `next.config.ts` 添加 `/c/:id → /persona/:id` 的 permanent redirect。
3. 删除 `src/app/c/` 目录。
4. 改 `src/app/page.tsx` 的 `copyShare()`：生成 `【书签人格卡】<headline> <url>`，写剪贴板与 fallback 文案同步。
5. 本地手动 smoke：
   - 生成卡片 → 点复制 → 粘贴到任意编辑器，确认格式 `【书签人格卡】<headline> http://localhost:3000/persona/<id>`。
   - 在浏览器访问旧 `/c/<id>` URL，确认 308 跳转到 `/persona/<id>`。
   - 直接访问 `/persona/<id>`，确认渲染正常。
   - 用一个不存在的 id 访问 `/persona/<id>`，确认"已过期或不存在"页面正常。

回滚：revert 该次 commit 即可，store schema 未动，数据兼容。

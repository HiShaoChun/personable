## MODIFIED Requirements

### Requirement: 仅基于派生数据的分享链接
系统 SHALL 提供分享链接，从以不可猜标识符为键存储的派生画像渲染卡片，
不存任何原始或结构化书签数据。分享链接的对外路径形式 SHALL 为
`/persona/<id>`；用户在首页复制分享时，系统 SHALL 把链接连同人格 headline
一起以可读文本形式写入剪贴板，使对方在聊天中看到时无需点击就能识别这是
一张书签人格卡。系统 SHALL 永久重定向旧的 `/c/<id>` 路径到 `/persona/<id>`，
使存量分享链接不失效。

#### Scenario: 创建并打开分享链接
- **WHEN** 画像定稿
- **THEN** 仅把派生画像 JSON 以随机不可猜 ID 为键存储，TTL 为 7 天
- **AND** 打开 `/persona/<id>` 时从该存储画像渲染卡片

#### Scenario: 过期或未知链接
- **WHEN** 在 TTL 已过后或以未知 ID 打开 `/persona/<id>`
- **THEN** 系统展示友好的「该卡片已过期或不存在」状态，而非报错

#### Scenario: 复制可读分享文本
- **WHEN** 用户在首页点击「复制分享链接」
- **THEN** 系统把形如 `【书签人格卡】<headline> <url>` 的文本写入剪贴板，
  其中 `<headline>` 取自当前画像，`<url>` 为 `<origin>/persona/<id>`
- **AND** 三段之间以单空格分隔，整体为单行

#### Scenario: 剪贴板写入失败时的兜底
- **WHEN** 浏览器拒绝 / 不支持 `navigator.clipboard.writeText`
- **THEN** 系统在界面提示「复制失败，请手动复制」，并展示完整的可分享
  文本（带 `【书签人格卡】` 前缀和 headline），而非只展示纯 URL

#### Scenario: 访问旧 `/c/<id>` 路径
- **WHEN** 用户访问旧版分享路径 `/c/<id>`
- **THEN** 系统以永久重定向（HTTP 308/301 语义）将其指向 `/persona/<id>`
- **AND** 重定向后渲染逻辑与直接访问 `/persona/<id>` 完全一致

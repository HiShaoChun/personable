## 1. 规范同步

- [ ] 1.1 核对当前代码已无分享链接相关实现：`/persona/[id]` 路由、`/privacy` 路由、`store.ts` 的 `putCard`/`getCard`、`/api/persona` 与 `/api/regenerate` 响应里的 `id` 字段、`PersistedRun.id` 字段——全部应已不存在
- [ ] 1.2 `openspec validate drop-share-links-spec` 通过，确认 REMOVED / MODIFIED 格式合规
- [ ] 1.3 归档时 `openspec archive drop-share-links-spec` 把 spec delta 应用到 `openspec/specs/persona-card/spec.md`

## 2. 验证

- [ ] 2.1 归档后人工检查 `openspec/specs/persona-card/spec.md` 不再含「仅基于派生数据的分享链接」「分享链接落地页布局」两段
- [ ] 2.2 「换个风格重新生成」段落不再含"分享链接 / 分享 ID"字样
- [ ] 2.3 仓库内其他 spec 文件不引用已删的 requirement（grep `分享链接落地页布局` `仅基于派生数据的分享链接` 应仅匹配本 change 目录与已 archive 的历史 change）

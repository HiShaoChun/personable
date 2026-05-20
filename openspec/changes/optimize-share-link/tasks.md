## 1. 路由迁移

- [x] 1.1 新建 `src/app/persona/[id]/page.tsx`，把 `src/app/c/[id]/page.tsx` 的逻辑搬过去（getCard、过期 fallback、PersonaCard 渲染、回首页提示文案），更新顶部 spec 注释为新路径
- [x] 1.2 在 `next.config.ts` 添加 `redirects()`：源 `/c/:id`、目标 `/persona/:id`、`permanent: true`
- [x] 1.3 删除 `src/app/c/` 整个目录

## 2. 复制行为升级

- [x] 2.1 修改 `src/app/page.tsx` 的 `copyShare()`：读取当前 `profile.headline`（兜底「你的互联网人格」），构造 `【书签人格卡】<headline> <origin>/persona/<id>`，写入剪贴板
- [x] 2.2 同步更新剪贴板失败时的 `setNote(...)` 文案，让 fallback 提示里展示的也是完整可分享文本
- [x] 2.3 确认按钮文案/提示在文本变长后视觉上仍合理（必要时小调整 toast 宽度/换行）

## 3. 验证

- [ ] 3.1 本地跑 `npm run dev`，生成一张卡 → 点复制 → 粘贴到记事本，确认得到「【书签人格卡】<headline> http://localhost:3000/persona/<id>」单行格式
- [ ] 3.2 浏览器访问旧 `/c/<id>`，确认 308 重定向到 `/persona/<id>` 并正常渲染
- [ ] 3.3 直接访问 `/persona/<id>`，确认渲染正常
- [ ] 3.4 用一个不存在的 id 访问 `/persona/<不存在>`，确认"已过期或不存在"页面正常
- [ ] 3.5 在不支持 clipboard 的环境模拟失败（或临时改代码抛错），确认 fallback note 显示带前缀的完整文本
- [x] 3.6 `npm run typecheck` 通过；`npm run build` 编译阶段通过（写 `.next/trace` 被本地 dev server 锁文件，非代码问题）；项目无 `lint` 脚本，故跳过

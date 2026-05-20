## 1. Store 封套与读端兼容（D4）

- [x] 1.1 在 [src/lib/store.ts](../../src/lib/store.ts) 的 `putCard(id, profileJson)` 内
      把写入值改为 `JSON.stringify({ createdAt: Date.now(), profile: <原 JSON 字符串> })`
- [x] 1.2 修改 `getCard(id)` 返回类型为 `{ profile: string; createdAt: number | null } | null`；
      解析失败 / 无 `profile` 字段时回退把整段当成裸 profile JSON 处理并把 `createdAt`
      置为 `null`（向后兼容存量卡）
- [x] 1.3 全局搜索 `getCard(` 的调用点，确认只有分享路由消费（不应有其他地方读 card）

## 2. 分享落地页 UI（D1 / D2 / D3）

- [x] 2.1 在 [src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx) 把 hero 主标题
      `<h1>一张互联网人格卡</h1>` 替换为 `<h1>{profile.headline}</h1>`
- [x] 2.2 副标题改为产品一句话解释（草案：「AI 根据浏览器书签生成的互联网兴趣切片，
      仅供娱乐」；实现时定稿）
- [x] 2.3 把页面底部 `.note` 行内链接替换为按钮形态主 CTA：
      `<Link href="/" className="btn">生成你自己的人格卡 →</Link>`，位置紧贴卡片下方
- [x] 2.4 失效分支文案补充：加一行「分享链接保留 `{config.cardTtlDays}` 天」说明
- [x] 2.5 失效分支同样配按钮形态主 CTA（与 2.3 同一组件、同一文案）

## 3. 时间标（D4 显示规则）

- [x] 3.1 在 [src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx) 内根据
      `row.createdAt` 计算「今天生成 / N 天前生成」文本（≥30 天显示「30+ 天前生成」）
- [x] 3.2 `createdAt === null` 时不渲染时间标节点（不要保留空 span）
- [x] 3.3 时间标使用现有 `.note` 或 `.muted` 视觉，不引入新样式类

## 4. 验证

- [ ] 4.1 本地起服务，生成一张卡 → 打开分享链接，确认 hero 是 headline、CTA 是
      按钮、时间标显示「今天生成」 *(待用户在浏览器中确认)*
- [ ] 4.2 手动改本地 `Date.now()` 或临时把 createdAt 减去若干天后读取，验证
      「N 天前生成」分支 *(待用户在浏览器中确认)*
- [ ] 4.3 临时清空 store 或访问随机 id，验证失效页 hero / CTA / 保留时长说明
      *(待用户在浏览器中确认)*
- [x] 4.4 拿一张通过旧裸格式写入的 value（手动 `putCard` 后跳过封套，或在
      `globalThis.__personableMemStore` 里手写）验证向后兼容读取——能正常渲染卡，
      不显示时间标，不报错（store.ts getCard 兼容分支覆盖：JSON.parse 后无 `profile`
      字段或解析抛错 → 把 raw 整段当 profile，createdAt 置 null，UI 据此跳过时间标）
- [x] 4.5 检查分享页**没有**「换风格」「保存为图片」「复制链接」按钮（不应出现）
      （[src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx) 整页仅渲染主 CTA Link，
      不含 toolbar 上的 regenerate/export/copy 按钮）

## 5. OpenSpec 收尾

- [x] 5.1 运行 `openspec validate optimize-shared-card-page --strict` 通过
- [ ] 5.2 实现完成后用 `/opsx:archive` 归档

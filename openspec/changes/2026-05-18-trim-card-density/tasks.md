## 1. Schema：traits 上限 + clusters 过滤 + otherInterests 字段

- [x] 1.1 在 [src/lib/agent/schema.ts](src/lib/agent/schema.ts) 的 `PersonaProfile` 接口新增 `otherInterests?: string[]`，注释「被硬阈值/软上限剔除的兴趣簇名，按原 size 降序」（D2）
- [x] 1.2 在 `validateProfile` 把 traits 上限改为 5：`traits.length < 3 || traits.length > 5`，错误消息同步改为 `"traits 数量需为 3-5 条"`（D3）
- [x] 1.3 在 `normalizeProfile` 的 clusters 处理段（约 [schema.ts:65-75](src/lib/agent/schema.ts#L65)）增加过滤：算 `total = sum(size)`、`cut = max(3, ceil(total * 0.05))`，先 sort 后过滤 `size >= cut`，再 `slice(0, 5)` 作 top（D1）
- [x] 1.4 在 `normalizeProfile` 计算 `otherInterests`：剩余簇（sort 后排在 top 5 之外或未通过 cut 的）取 name，dedupe + 去空名 + trim，按原 size 降序留存；只有非空时才写入返回对象，空数组省略字段以保持 JSON 干净（D2）
- [x] 1.5 把 traits 的 `slice(0, 7)` 改为 `slice(0, 5)` 作 belt-and-suspenders 兜底（D3）

## 2. Synthesize prompt 文案对齐

- [x] 2.1 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的 `buildPrompt`（约 [synthesize.ts:30-46](src/lib/agent/synthesize.ts#L30)）把 JSON 注释 `"traits":["3到7条人格特质"]` 改为 `"traits":["3-5条人格特质"]`（D4）
- [x] 2.2 不改 system prompt 的其他部分；不向 prompt 添加 clusters 数量约束 —— 过滤交给 normalize（D4）

## 3. PersonaCard 渲染「其他散点」

- [x] 3.1 在 [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx) 的 cluster 块循环之后、`profile.evolution.length > 0` 守卫之前插入：`{profile.otherInterests && profile.otherInterests.length > 0 && <div className="others">其他散点：{profile.otherInterests.join("、")}</div>}`（D5）
- [x] 3.2 在全局样式（`src/app/globals.css` 或相应文件）添加 `.others` 类：`color: var(--muted)`、`font-size: 13px`、`margin: 8px 0` 量级，让视觉重量靠近 `.note` 而非 `.blurb`（D5）
- [x] 3.3 不为 `.others` 加交互（点击/折叠）；不复用 `.disc` 类（D5）

## 4. 兼容性核查

- [x] 4.1 PersonaCard 用 `profile.otherInterests &&` 守卫确保 undefined 时不渲染，对旧分享链接 JSON 形态无任何影响（D6）
- [x] 4.2 不做服务端旧 JSON 迁移；旧 `/c/:id` 链接按原样展示（D6）

## 5. 验证

- [ ] 5.1 重新生成一张卡：上传用户用过的样卡书签，验证 traits ≤ 5 条、clusters ≤ 5 个、size=1 的「英语深度阅读」不再画进度条而是出现在「其他散点」行
- [ ] 5.2 size 边界：构造一份 total ≈ 85 的书签（接近用户样卡），验证最终 top 5 是 size=36/18/9/8/8（按降序），size=5 的「算法求职」 + size=1 的「英语」一起进 `otherInterests`
- [ ] 5.3 小用户场景：构造 total < 20 的书签，验证 cut = 3 起作用，不会因为 5% 算到 0 而漏过 size=1 的簇
- [ ] 5.4 三 vibe 一致性：换风格切换后，三张卡的 `otherInterests` 内容完全一致（因为过滤口径与 vibe 解耦）；precompute 路径同步受益
- [ ] 5.5 旧分享链接：打开一条本 change 部署前生成的 `/c/:id`，验证仍按旧形态渲染、不报错、`其他散点` 行不出现
- [ ] 5.6 截图导出：「保存为图片」生成的 PNG 中包含 `其他散点` 那行（如有），整体仍然紧凑、无溢出
- [ ] 5.7 schema 严格度：观察服务端日志若干次运行，traits 数量约束触发 validate 重试的频率；如频繁失败（>30%），考虑在 prompt 加更强提示词（保留为后续优化，不在本 change 内做）

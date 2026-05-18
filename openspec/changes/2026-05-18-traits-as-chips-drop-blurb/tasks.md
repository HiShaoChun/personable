## 1. Schema：trait 限长 + cluster.blurb 可选化

- [x] 1.1 在 [src/lib/agent/schema.ts](src/lib/agent/schema.ts) 把 `InterestCluster.blurb` 改为可选：`blurb?: string`，注释「历史字段，新生成不再带，保留以兼容旧 share JSON」（D5）
- [x] 1.2 在 `validateProfile` 的 traits 校验里增加 per-trait 长度检查：每条 `[...t].length > 8` 则 push `"traits[i] 需为 ≤8 字的短标签"` 错误（D3）
- [x] 1.3 在 `normalizeProfile` 引入 `cleanTrait(s)` 辅助函数：trim → 切第一个「：/:」前 → 去末尾标点 → `[...t].slice(0, 8).join("")` 限长 → 空串过滤（D2）
- [x] 1.4 在 `normalizeProfile` 把 traits 处理从 `.map(String).slice(0, 5)` 改为 `.map(cleanTrait).filter(Boolean).slice(0, 5)`（D2）
- [x] 1.5 在 `normalizeProfile` 的 cluster map 步骤里删掉 `blurb: String(cc.blurb ?? "")` 一行——新 profile 的 cluster 对象不再产出 blurb 字段（D5）

## 2. Synthesize prompt 同步

- [x] 2.1 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的 `buildPrompt`（约 [synthesize.ts:30-46](src/lib/agent/synthesize.ts#L30)）把 JSON 示例的 `"traits":["3-5条人格特质"]` 改为 `"traits":["3-5个标签词（每条≤8字、纯名词短语、禁止冒号与解释）"]`（D4）
- [x] 2.2 在同一 JSON 示例的 clusters 部分把 `"blurb":"一句话",` 字段整段删掉，cluster 示例变为 `{"name":"簇名","size":数字,"domains":["域名"]}`（D4、D5）
- [x] 2.3 不动 system prompt 与其他文案（D4）

## 3. PersonaCard 渲染删 blurb

- [x] 3.1 在 [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx) 删除 `{c.blurb && <div className="blurb">{c.blurb}</div>}` 整行；保留 cluster 其余渲染（name + size + bar）（D5）
- [x] 3.2 不修改 [src/app/globals.css](src/app/globals.css) 的 `.blurb` 类（D6）

## 4. 验证

- [ ] 4.1 重新生成一张卡：上传样本书签，确认 traits 全部是 ≤8 字、无冒号、无句末标点、视觉为简短 chip
- [ ] 4.2 边界：构造一次模型偶发输出"系统性：解释…"的场景（可临时调温度或换模型），观察 normalize 清洗后仍是"系统性"、不进入 retry
- [ ] 4.3 重试触发：观察日志，确认模型首次输出超长 trait 时 `validate` 报错 → `synthesize` retry，重试次数 ≤2 时收敛
- [ ] 4.4 cluster 渲染：新生成的卡 cluster 块只有 name + size 数字 + 进度条，**无** blurb 行
- [ ] 4.5 旧 share 链接：随便打开一条本 change 部署前生成的 `/c/:id`，确认 blurb 行也不再显示（旧/新卡视觉一致）
- [ ] 4.6 vibe 切换 / precompute：换风格切换后，新风格的 traits 也是短 chip 形态、cluster 无 blurb
- [ ] 4.7 截图导出：「保存为图片」生成的 PNG 中 traits 是紧凑 chip 串、cluster 块紧凑无 blurb 行
- [ ] 4.8 `synth_failed` 率：跑 5-10 次生成观察服务端 `[timing] synth attempt# done` 日志，整体失败率应保持低位（<5%）；若明显高于以往，记录为 follow-up（design「Risks」中的 prompt 加示例兜底方案）

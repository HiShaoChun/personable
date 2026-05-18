## 1. Synthesize：簇名重写指令

- [x] 1.1 在 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts) 的 `buildPrompt`（约 [synthesize.ts:30-46](src/lib/agent/synthesize.ts#L30)）在 `产出最终人格卡 JSON：` 之上、`兴趣簇：${clusterLines}` 之下插入一段约束：要求模型重写每个 cluster.name 为带动词暗示 / 反差感的人物剪影式短句、贴合 vibe 语气；明确"size 保持输入数值、不许新增/删除 cluster"（D2）
- [x] 1.2 在同处给出 2 个好例（earnest vibe）+ 1 个坏例，示范"动词暗示 + 反差"与"空泛中二造词"的差别（D2）
- [x] 1.3 不动 system prompt；不加 cluster name 长度上限（D3）
- [x] 1.4 不动 [src/lib/agent/cluster.ts](src/lib/agent/cluster.ts) —— 聚类阶段产出仍是 vibe-neutral 分类描述，作为合成阶段输入与"过程档案"展示（D1）

## 2. PersonaCard：定性标签替换数字

- [x] 2.1 在 [src/components/PersonaCard.tsx](src/components/PersonaCard.tsx) 顶部加 `sizeLabel(c, allClusters)` 辅助函数：rank 1 → `"主线"`；`c.size / top.size >= 0.5` → `"副线"`；else → `"番外"`；用引用比较 `c === top` 判断 rank 1；防御 `top.size > 0`（D5）
- [x] 2.2 把 cluster 行右侧 `<span style={{ color: "var(--muted)" }}>{c.size}</span>` 改为 `<span className="rank">{sizeLabel(c, profile.clusters)}</span>`（D6）
- [x] 2.3 进度条 `<div className="bar" style={{ width: ... }}>` 保持不动（D5、D7）
- [x] 2.4 不在 PersonaCard 读取 vibe / 任何 vibe-aware state——`sizeLabel` 纯函数、只依赖 size（D5）

## 3. CSS：让 .rank 像标签

- [x] 3.1 在 [src/app/globals.css](src/app/globals.css) 的 `.cluster .row` 附近添加 `.cluster .row .rank { color: var(--muted); font-size: 12px; letter-spacing: 0.5px; white-space: nowrap; }`（D7）
- [x] 3.2 不加背景 / 边框 / 高亮——保持轻量提示姿态（D7）

## 4. 验证

- [ ] 4.1 重新生成一张卡：用户上传样本书签后，确认 cluster 名是"动词暗示 + 性格切片"形态（不再是"讯飞教育产线研发文档"这种分类标签），数量与 normalize 后输入一致
- [ ] 4.2 size → 标签映射：手工核对 5 个簇的 size 与右侧标签：rank 1 = "主线"；size/top ≥ 0.5 = "副线"；else = "番外"。样卡 26/17/10/10/9 应为 主线/副线/番外/番外/番外
- [ ] 4.3 进度条仍按 c.size / max 画——视觉比例完好
- [ ] 4.4 vibe 切换：换 roast / poetic 验证簇名跟着换（同一个簇在不同 vibe 下名字不同）；定性标签三 vibe 一致
- [ ] 4.5 precompute：终态后台预生成的两个 vibe 也走 vibe-aware 簇名（synthesize 路径相同）
- [ ] 4.6 旧 share 链接：打开本 change 部署前的 `/c/:id`，簇名为旧分类式（如"讯飞教育产线研发文档"），右侧标签为新"主线/副线/番外"——混合形态，不报错
- [ ] 4.7 截图导出：「保存为图片」生成的 PNG 中 cluster 行只有簇名 + "主线/副线/番外"标签 + 进度条；无原始数字
- [ ] 4.8 跑偏率观察：生成 5-10 次卡，记录是否出现"AI 灵魂工匠"这类空泛中二簇名；若 >1 次/10 次，记为 follow-up（design「Risks」中提到的"必须包含原簇名关键概念"加约束方案）

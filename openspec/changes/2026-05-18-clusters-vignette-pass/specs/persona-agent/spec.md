# persona-agent —— 增量

本文件是对 [openspec/specs/persona-agent/spec.md](openspec/specs/persona-agent/spec.md)
的增量，归档时会并入主 spec。

## MODIFIED Requirements

### Requirement: 结构化画像输出
agent SHALL 输出经 schema 校验的画像，含命名兴趣簇、人格特质、
兴趣演变时间线。

#### Scenario: 画像定稿
- **WHEN** agent 定稿
- **THEN** 输出通过画像 schema 校验：3-5 条人格特质（每条 ≤8 字、
  纯名词短语、不含冒号或解释性文字）、按密度治理后的命名簇（**簇
  名是带动词暗示 / 反差感的人物剪影式短句，按当前 vibe 改写自聚类
  阶段的分类描述；size 数值与簇含义相对聚类阶段保持稳定，不允许
  新增或删除簇**）、按时间排序的演变摘要
- **AND** 无效或不安全内容被拒绝并重新生成，而非返回

#### Scenario: 簇名按 vibe 改写
- **WHEN** 合成阶段把聚类阶段产出的兴趣簇带入 prompt
- **THEN** 模型按当前 vibe 把每个簇的 name 重写为"动词暗示 + 性格
  切片"短句（如 `讯飞教育产线研发文档` → `教育产线的隐形调度员`）
- **AND** 不同 vibe 下同一个簇的名字可以不同；size 保持输入数值
  不变；簇的语义所指（与原分类描述指向的同一组书签）不变

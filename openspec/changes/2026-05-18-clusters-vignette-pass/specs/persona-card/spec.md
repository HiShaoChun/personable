# persona-card —— 增量

本文件是对 [openspec/specs/persona-card/spec.md](openspec/specs/persona-card/spec.md)
的增量，归档时会并入主 spec。

## MODIFIED Requirements

### Requirement: 人格卡渲染
系统 SHALL 把定稿的人格画像渲染为精致的视觉卡片。

#### Scenario: 渲染画像
- **WHEN** 已有定稿的人格画像
- **THEN** 系统渲染卡片，展示 3-5 条短标签 chip 形态的人格特质、
  带相对规模的命名兴趣簇（至多 5 个；**每个簇展示簇名 + 定性规模
  标签「主线」/「副线」/「番外」+ 进度条，不再展示原始 size 数字**）、
  兴趣演变时间线
- **AND** 定性规模标签按规则 render-time 派生（不入 schema/JSON）：
  rank 1 的簇为「主线」；其余簇 size ≥ top.size × 0.5 为「副线」；
  否则为「番外」
- **AND** 进度条宽度仍按 `size / max(cluster sizes)` 计算
- **AND** 当画像含 `otherInterests` 且非空时，在兴趣簇列表之后、
  演变时间线之前展示一行小字「其他散点：X、Y、Z」
- **AND** 卡片含固定免责声明

#### Scenario: 兼容旧分享链接
- **WHEN** 通过分享链接打开本能力增强之前生成的人格卡
- **THEN** 卡片按存储 JSON 渲染——簇名为旧分类式（聚类阶段原文），
  右侧仍按新规则派生「主线」/「副线」/「番外」标签
- **AND** 渲染不报错；混合形态（旧簇名 + 新定性标签）是可接受的
  产品状态，不做服务端 JSON 迁移

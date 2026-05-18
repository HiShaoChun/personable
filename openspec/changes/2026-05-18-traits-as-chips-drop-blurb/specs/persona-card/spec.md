# persona-card —— 增量

本文件是对 [openspec/specs/persona-card/spec.md](openspec/specs/persona-card/spec.md)
的增量，归档时会并入主 spec。

## MODIFIED Requirements

### Requirement: 人格卡渲染
系统 SHALL 把定稿的人格画像渲染为精致的视觉卡片。

#### Scenario: 渲染画像
- **WHEN** 已有定稿的人格画像
- **THEN** 系统渲染卡片，展示 **3-5 条短标签 chip 形态的人格特质
  （每条 ≤8 字、无冒号或解释）**、带相对规模的命名兴趣簇（至多
  5 个；**仅 name + size + 进度条，不渲染解说行**）、兴趣演变时间线
- **AND** 当画像含 `otherInterests` 且非空时，在兴趣簇列表之后、
  演变时间线之前展示一行小字「其他散点：X、Y、Z」（顿号分隔，
  无进度条）
- **AND** 卡片含固定免责声明，说明这是 AI 生成、仅供娱乐的解读

#### Scenario: 兼容旧分享链接
- **WHEN** 通过分享链接打开本能力增强之前生成的人格卡
- **THEN** 卡片按存储 JSON 渲染——traits 若超长仍按原字符串显示
  （历史卡的 chip 可能撑得更大），cluster 即便 JSON 里带 blurb 字
  段也**不再渲染该解说行**，让历史卡与新卡片视觉一致
- **AND** 渲染不报错，`otherInterests` 字段缺失时不展示该行

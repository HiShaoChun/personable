# persona-card —— 增量

本文件是对 [openspec/specs/persona-card/spec.md](openspec/specs/persona-card/spec.md)
的增量，归档时会并入主 spec。

## MODIFIED Requirements

### Requirement: 人格卡渲染
系统 SHALL 把定稿的人格画像渲染为精致的视觉卡片。

#### Scenario: 渲染画像
- **WHEN** 已有定稿的人格画像
- **THEN** 系统渲染卡片，展示**至多 5 条**人格特质、带相对规模
  的命名兴趣簇（至多 5 个）、兴趣演变时间线
- **AND** 当画像含 `otherInterests` 且非空时，在兴趣簇列表之后、
  演变时间线之前展示一行小字「其他散点：X、Y、Z」（顿号分隔，
  无进度条、无单项描述）
- **AND** 卡片含固定免责声明，说明这是 AI 生成、仅供娱乐的解读

#### Scenario: 兼容旧分享链接
- **WHEN** 通过分享链接打开本能力增强之前生成的人格卡
- **THEN** 卡片按存储 JSON 原样渲染——不展示「其他散点」行（字段
  缺失），兴趣簇按原列表全数渲染
- **AND** 渲染不报错、视觉与该卡生成当时一致

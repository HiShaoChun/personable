# persona-agent —— 增量

本文件是对 [openspec/specs/persona-agent/spec.md](openspec/specs/persona-agent/spec.md)
的增量，归档时会并入主 spec。

## MODIFIED Requirements

### Requirement: 结构化画像输出
agent SHALL 输出经 schema 校验的画像，含命名兴趣簇、人格特质、
兴趣演变时间线。

#### Scenario: 画像定稿
- **WHEN** agent 定稿
- **THEN** 输出通过画像 schema 校验：3-5 条人格特质（**每条 ≤8 字、
  纯名词短语、不含冒号或解释性文字**）、按密度治理后的命名簇（含
  name / size / 可选 domains，**不再含 blurb 解说字段**）、按时间排
  序的演变摘要
- **AND** 无效或不安全内容被拒绝并重新生成，而非返回

#### Scenario: trait 形态防御式清洗
- **WHEN** 模型输出的某条 trait 形如「短词：解释」或末尾带句末标点
  或超长
- **THEN** 系统在 normalize 阶段切除冒号及之后内容、去末尾标点、限
  长 8 字符（按 Unicode code point 计数）
- **AND** 清洗后仍不合规（如总数不足 3 条）则按既有重试机制让模型
  重新生成

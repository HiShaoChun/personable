## MODIFIED Requirements

### Requirement: 结构化画像输出
agent SHALL 输出经 schema 校验的画像，含命名兴趣簇、人格特质、兴趣演变时间线、可选签名台词。

#### Scenario: 画像定稿
- **WHEN** agent 定稿
- **THEN** 输出通过画像 schema 校验（带规模的命名簇、3-7 条人格特质、按时间排序的演变摘要）
- **AND** 无效或不安全内容被拒绝并重新生成，而非返回

#### Scenario: 含签名台词
- **WHEN** synthesis 阶段产出画像
- **THEN** 画像 MAY 含 `signatureQuote` 字段，值为契合当前 vibe 语气、长度 ≤28 字（按 codepoint 计）、含至少一个具体所指（cluster 名 / 域名 / 具体行为）的短句
- **AND** 该台词不得是空泛断言（如「独特的灵魂」「热爱生活的人」），不得复述 headline

#### Scenario: 签名台词超长
- **WHEN** 模型返回的 `signatureQuote` 超过 28 字
- **THEN** 规范化阶段把它截断到 28 字而非拒绝整张画像（与 traits 的清洗策略一致）

#### Scenario: 缺失签名台词
- **WHEN** 模型未返回 `signatureQuote` 字段或返回空字符串
- **THEN** 画像仍通过 schema 校验，签名台词字段在输出中省略，不算失败重试条件

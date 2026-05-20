# persona-agent

## Purpose

服务端 agent，把结构化书签条目经「概览扫描 → 一次性 LLM 聚类 → 画像合成」
转化为结构化人格画像；并支持在缓存的 agent 结果上按风格重合成。

## Requirements

### Requirement: 多步 agent 流水线
系统 SHALL 通过服务端 agent 产出人格画像：本地概览计算、一次 LLM 聚类，然后画像合成。

#### Scenario: 标准运行
- **WHEN** 结构化书签条目被提交到 agent 端点
- **THEN** agent 在不调用 LLM 的情况下本地计算概览（计数、域名直方图、时间跨度、文件夹树摘要）
- **AND** 执行一次 LLM 聚类，得到带成员引用的命名簇和人格草图
- **AND** 直接产出最终结构化画像，不再做网页深挖

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

### Requirement: 按风格重合成
系统 SHALL 支持以不同人格风格重合成画像，复用已算好的概览与簇。

#### Scenario: 按不同风格重新生成
- **WHEN** 针对已有运行以不同风格参数请求重合成
- **THEN** 系统用缓存的概览与簇及一次合成调用产出新的、通过 schema 校验的画像
- **AND** 不发起任何网页抓取

#### Scenario: 未知或非法风格
- **WHEN** 以不支持的风格值请求重合成
- **THEN** 请求被拒绝且不消耗模型 token

### Requirement: 凭据仅存服务端
Anthropic API Key SHALL 仅存在于服务端，SHALL NOT 出现在任何客户端响应或资源中。

#### Scenario: 检查客户端流量
- **WHEN** 检查下发到客户端的代码与网络响应
- **THEN** 其中不含任何 Anthropic API Key 或等效凭据

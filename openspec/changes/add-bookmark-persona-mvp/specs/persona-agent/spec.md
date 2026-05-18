## ADDED Requirements

### Requirement: 多步 agent 流水线
系统 SHALL 通过服务端多步 agent 产出人格画像：本地概览计算、一次 LLM 聚类、
agent 主导的选择性深挖，然后画像合成。

#### Scenario: 标准运行
- **WHEN** 结构化书签条目被提交到 agent 端点
- **THEN** agent 在不调用 LLM 的情况下本地计算概览（计数、域名直方图、时间跨度、文件夹树摘要）
- **AND** 执行一次 LLM 聚类，得到带成员引用的命名簇和人格草图
- **AND** 自主选择深挖哪些簇并产出最终结构化画像

### Requirement: 自主且有界的深挖
agent SHALL 决定哪些簇值得查看代表性网页，并 MAY 抓取网页，但受硬性边界约束。

#### Scenario: agent 选择深挖某个簇
- **WHEN** agent 判断某个簇含糊或对人格至关重要
- **THEN** 它 MAY 对该簇的代表性 URL 调用网页抓取工具
- **AND** 单次运行绝不超过配置的最大抓取数、工具迭代数、墙钟时间或总 token 预算

#### Scenario: 网页抓取失败或被屏蔽
- **WHEN** 网页抓取超时、被屏蔽或返回不可用文本
- **THEN** agent 继续执行，仍仅凭标题、文件夹、域名产出完整画像（优雅降级，绝不硬失败）

### Requirement: 网页抓取工具安全
网页抓取工具 SHALL 仅抓取公网 http/https 资源，SHALL 屏蔽内网、环回、链路本地目标。

#### Scenario: agent 请求内网或非 http 目标
- **WHEN** agent 以内网/环回/链路本地主机或非 http(s) 协议调用抓取工具
- **THEN** 该抓取被拒绝并按抓取失败处理，不接触目标

### Requirement: 结构化画像输出
agent SHALL 输出经 schema 校验的画像，含命名兴趣簇、人格特质、兴趣演变时间线。

#### Scenario: 画像定稿
- **WHEN** agent 定稿
- **THEN** 输出通过画像 schema 校验（带规模的命名簇、3-7 条人格特质、按时间排序的演变摘要）
- **AND** 无效或不安全内容被拒绝并重新生成，而非返回

### Requirement: 按风格重合成且不重跑深挖
系统 SHALL 支持以不同人格风格重合成画像，复用已算好的概览与簇，不重复有界网页深挖。

#### Scenario: 按不同风格重新生成
- **WHEN** 针对已有运行以不同风格参数请求重合成
- **THEN** 系统用缓存的概览与簇及一次合成调用产出新的、通过 schema 校验的画像
- **AND** 不做额外网页抓取，不重跑 agent 深挖循环

#### Scenario: 未知或非法风格
- **WHEN** 以不支持的风格值请求重合成
- **THEN** 请求被拒绝且不消耗模型 token

### Requirement: 凭据仅存服务端
Anthropic API Key SHALL 仅存在于服务端，SHALL NOT 出现在任何客户端响应或资源中。

#### Scenario: 检查客户端流量
- **WHEN** 检查下发到客户端的代码与网络响应
- **THEN** 其中不含任何 Anthropic API Key 或等效凭据

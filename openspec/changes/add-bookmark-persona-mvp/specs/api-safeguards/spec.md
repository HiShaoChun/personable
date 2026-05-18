## ADDED Requirements

### Requirement: 限流
托管的 agent 端点 SHALL 实施按客户端的滑动窗口限流和并发运行上限。

#### Scenario: 客户端超过限流
- **WHEN** 某客户端超过配置的请求速率或并发运行上限
- **THEN** 请求被以清晰的「稍后再试」响应拒绝，且不消耗任何模型 token

### Requirement: 输入上限
agent 端点 SHALL 在调用任何模型前拒绝超大请求。

#### Scenario: 提交超大载荷
- **WHEN** 请求超过配置的条目数或载荷体积上限
- **THEN** 它在任何 LLM 调用前被拒绝，并提示具体上限

### Requirement: 全局成本熔断
系统 SHALL 实施全局每日 token/成本预算，达到后暂停新的 agent 运行而不下线站点。

#### Scenario: 达到每日预算
- **WHEN** 全局每日 token/成本预算耗尽
- **THEN** 新的 agent 运行返回友好的「临时暂停」状态
- **AND** 上传页与信息页仍可访问

### Requirement: 数据处理透明
系统 SHALL 以通俗语言呈现所处理与留存数据的说明。

#### Scenario: 用户查看数据处理说明
- **WHEN** 用户查看数据处理说明
- **THEN** 它说明：原始书签文件绝不离开浏览器；仅瞬态处理派生的结构化条目；仅以 7 天 TTL 存储派生画像

### Requirement: 特性开关与回滚
agent 能力 SHALL 由 env 门控开关控制，可在保持站点其余部分可用的同时停用运行。

#### Scenario: 停用该能力
- **WHEN** agent 特性开关被关闭
- **THEN** agent 端点返回友好的「已暂停」状态
- **AND** 前端与信息页继续可用

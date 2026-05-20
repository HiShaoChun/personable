## MODIFIED Requirements

### Requirement: 多步 agent 流水线
系统 SHALL 通过服务端 agent 产出人格画像：本地概览计算、一次 LLM 聚类，然后画像合成。

#### Scenario: 标准运行
- **WHEN** 结构化书签条目被提交到 agent 端点
- **THEN** agent 在不调用 LLM 的情况下本地计算概览（计数、域名直方图、时间跨度、文件夹树摘要）
- **AND** 执行一次 LLM 聚类，得到带成员引用的命名簇和人格草图
- **AND** 直接产出最终结构化画像，不再做网页深挖

### Requirement: 按风格重合成
系统 SHALL 支持以不同人格风格重合成画像，复用已算好的概览与簇。

#### Scenario: 按不同风格重新生成
- **WHEN** 针对已有运行以不同风格参数请求重合成
- **THEN** 系统用缓存的概览与簇及一次合成调用产出新的、通过 schema 校验的画像
- **AND** 不发起任何网页抓取

#### Scenario: 未知或非法风格
- **WHEN** 以不支持的风格值请求重合成
- **THEN** 请求被拒绝且不消耗模型 token

## REMOVED Requirements

### Requirement: 自主且有界的深挖
**Reason**: 产品复盘发现聚类阶段已获得全部书签的标题、域名、用户自建文件夹路径，信号已饱和；深挖每次仅抓 2-3 个 URL，对最终画像的边际信息量极低，却引入 5-20 秒延时、同输入不同输出的随机性、对用户书签的服务端隐私抓取、以及大量"抓取失败"的失败路径。
**Migration**: 无运行时迁移；新运行不再调用 `fetch_page`，旧 `AgentState` JSON 中残留的 `fetchedNotes` 字段在合成时被忽略，按风格重合成继续可用。

### Requirement: 网页抓取工具安全
**Reason**: 唯一调用方（自主深挖）被一并移除，工具本身不再存在，对应的 SSRF 防护与单元测试一同删除。
**Migration**: 若未来需要在其它场景重新引入服务端外部抓取，应当从 git 历史恢复 `fetchPage.ts` 的 SSRF 防护实现作为起点，不要绕过该层校验。

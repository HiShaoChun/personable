# persona-agent —— 增量

本文件是对 [openspec/specs/persona-agent/spec.md](openspec/specs/persona-agent/spec.md)
的增量，归档时会并入主 spec。

## MODIFIED Requirements

### Requirement: 结构化画像输出
agent SHALL 输出经 schema 校验的画像，含命名兴趣簇、人格特质、
兴趣演变时间线。

#### Scenario: 画像定稿
- **WHEN** agent 定稿
- **THEN** 输出通过画像 schema 校验（按密度治理后的命名簇、**3-5
  条人格特质**、按时间排序的演变摘要）
- **AND** 无效或不安全内容被拒绝并重新生成，而非返回

## ADDED Requirements

### Requirement: 兴趣簇密度治理
系统 SHALL 在画像 normalize 阶段对 LLM 输出的兴趣簇应用硬阈值过滤
与软上限，并把被剔除的簇名收纳到画像的 `otherInterests` 字段，
使最终画像具备「卡片就绪」的密度。

#### Scenario: 簇按硬阈值过滤
- **WHEN** normalize 阶段处理 LLM 输出的兴趣簇
- **THEN** 系统按 `total = sum(clusters.size)` 计算阈值
  `cut = max(3, ceil(total * 0.05))`
- **AND** 仅保留 `size >= cut` 的簇进入候选；其余簇的 name 进入
  「被剔除」集合

#### Scenario: 簇按软上限保留 top 5
- **WHEN** 通过硬阈值的簇数量超过 5
- **THEN** 系统按 size 降序保留 top 5 进入最终 clusters
- **AND** 多出的簇的 name 同样进入「被剔除」集合

#### Scenario: 被剔除簇收纳为 otherInterests
- **WHEN** normalize 阶段存在被剔除的簇
- **THEN** 系统把这些簇名（dedupe + 去空名 + trim，按原 size 降序）
  写入画像的 `otherInterests` 字段
- **AND** 当没有任何簇被剔除时，画像 JSON 中省略 `otherInterests`
  字段而非写入空数组

#### Scenario: 重合成共享过滤口径
- **WHEN** 以不同风格重合成（regenerate）或后台预生成其他 vibe
- **THEN** 不同 vibe 变体得到的 `otherInterests` 集合内容相同
  （因为过滤基于簇 size，与 vibe 文案无关）

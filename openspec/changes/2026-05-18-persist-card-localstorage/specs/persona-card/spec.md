# persona-card —— 增量

本文件是对 [openspec/specs/persona-card/spec.md](openspec/specs/persona-card/spec.md)
的增量，仅列出本 change 新增的 Requirement。归档时会并入主 spec。

## ADDED Requirements

### Requirement: 客户端本地缓存最近一次卡片
首页 SHALL 把"最近一次成功生成的人格卡终态快照"写入浏览器本地存
储；用户刷新页面时 SHALL 自动恢复到该终态，包括当前显示的 vibe、
分享链接 ID 与已预生成的 vibe 缓存。任何损坏、过版本或缺字段的记
录 SHALL 被静默丢弃且不向用户呈现错误。

#### Scenario: 首次定稿后写入本地缓存
- **WHEN** 一次 agent 运行成功完成且人格卡已渲染（`phase` 进入终态）
- **THEN** 系统把 `{ id, runId, profile, vibeCache, ovStat }` 连同过
  程档案字段（聚类思考流、深挖思考流、合成思考流、簇预览、fetch
  chips 列表）与一个版本号字段一起序列化为 JSON，写入浏览器本地存
  储下的固定键
- **AND** 写入失败（配额超限、隐私模式禁写等）SHALL 被静默处理，不
  阻断用户当前操作

#### Scenario: 换个风格成功后更新本地缓存
- **WHEN** 用户在终态切换 vibe，无论命中预生成缓存还是走重合成请求
  成功
- **THEN** 系统以新的 `{ id, profile, vibeCache }` 覆盖写入本地存储，
  让"最近一次卡片"始终指向用户当前看到的画像
- **AND** 后台预生成成功回填 vibeCache 时同样更新本地存储，让刷新
  后切换其它已预生成 vibe 仍能瞬时

#### Scenario: 刷新页面恢复终态
- **WHEN** 浏览器刷新或重新打开首页且本地存储存在合法记录（版本匹
  配且 id/runId/profile 齐全）
- **THEN** 系统在挂载时直接渲染人格卡终态，分享链接、保存为图片、
  换个风格按钮立即可用，当前显示 vibe 与刷新前一致
- **AND** 终态步骤区与过程档案（聚类/深挖/合成的思考流文本、簇
  chips、fetch chips）按刷新前的内容并列展示，不出现"步骤标签亮起
  但思考流为空"的撕裂态
- **AND** 不显示任何"加载中"或"恢复中"中间态

#### Scenario: 本地记录损坏或过版本时静默丢弃
- **WHEN** 本地存储记录解析失败、版本号与当前不匹配、或必要字段缺失
- **THEN** 系统删除该记录并回到初始拖拽态
- **AND** 不向用户呈现任何解析错误或恢复失败提示

#### Scenario: 上传新文件清空本地缓存
- **WHEN** 用户在任意状态拖入新书签 HTML 触发新一次运行
- **THEN** 系统在重置组件状态的同一处删除本地存储中的旧记录
- **AND** 新一次运行进行中不写入任何本地存储，直到新终态出现才重新
  落盘

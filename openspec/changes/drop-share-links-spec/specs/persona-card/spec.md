## REMOVED Requirements

### Requirement: 仅基于派生数据的分享链接
**Reason**: 分享链接功能整体下线。`/persona/[id]` 路由、`src/lib/store.ts` 的 `putCard`/`getCard`/`CardEnvelope` 已删，前端不再暴露分享入口；`/api/persona` 与 `/api/regenerate` 不再生成 card id。
**Migration**: 无替代方案。如需将卡片传播给他人，请截图分享。

### Requirement: 分享链接落地页布局
**Reason**: `/persona/[id]` 路由已删，无落地页可言。
**Migration**: 无替代方案。

## MODIFIED Requirements

### Requirement: 换个风格重新生成
卡片界面 SHALL 提供以不同人格风格重新生成的控件，复用已算好的 agent 状态、仅重跑合成步骤。

#### Scenario: 用户切换风格重新生成
- **WHEN** 用户在卡片上选择不同风格并请求重新生成
- **THEN** 系统复用已算好的 agent 状态、仅重跑合成，产出新画像并渲染新卡片
- **AND** 当前展示的卡片整体替换为新风格变体（不再产生独立分享链接，也不保留旧变体）

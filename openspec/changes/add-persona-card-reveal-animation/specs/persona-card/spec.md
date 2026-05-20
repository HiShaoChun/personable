## ADDED Requirements

### Requirement: 人格卡入场动效
系统 SHALL 在人格卡出现时播放入场动效，按"首次合成"与"重新生成"两种模式
区别播放强度，并对 `prefers-reduced-motion` 用户回退为静态展示。

#### Scenario: 首次合成完成的完整动效
- **WHEN** `phase === "done"` 在当前会话首次发生、卡片首次渲染
- **THEN** 卡片以 3D 翻转（卡背 → 卡面）入场，翻转时长约 600ms
- **AND** 翻转落定时附带轻微弹跳（scale 在 0.98 → 1.02 → 1 间过渡），约 200ms
- **AND** 卡内元素按 headline → traits → clusters → evolution → disclaimer
  顺序错峰淡入，单元素淡入约 250ms，stagger 总长不超过 ~500ms
- **AND** 翻转阶段卡背展示朴素占位（避免空白）

#### Scenario: 重新生成的缩短动效
- **WHEN** 用户在卡片界面触发"换个风格重新生成"，新卡片渲染
- **THEN** 系统跳过翻转与弹跳，仅以整体淡入 + 轻微 scale（0.98 → 1）入场
- **AND** 整体入场加元素 stagger 总长不超过 ~300ms

#### Scenario: 减少动效偏好
- **WHEN** 用户启用 `prefers-reduced-motion: reduce`
- **THEN** 系统跳过翻转、弹跳与元素 stagger，直接以终态渲染卡片

#### Scenario: 入场期间禁用导出与重生成控件
- **WHEN** 卡片入场动效尚未播放完毕
- **THEN** 卡片旁的导出/分享/换风格控件保持 `pointer-events: none`，
  防止在动效中间帧触发图片导出或重渲染
- **AND** 控件在动效结束时同步淡入并恢复可点击

#### Scenario: 不引入额外视觉陪衬
- **WHEN** 任意模式的入场动效播放时
- **THEN** 系统不渲染粒子、光晕或背景陪衬效果，确保卡片本身是唯一视觉焦点

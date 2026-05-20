## Why

用户点击「保存为图片」时，下载的 PNG 顶部出现透明条带、底部内容被截断（headline 上方留空、最后一条 evolution 文本被切成半行）。这个分享按钮是产品最高频的出口，残缺的卡片直接砸掉了卡片合成阶段建立起来的视觉信任。

## What Changes

- 修复 [src/app/page.tsx](src/app/page.tsx) 中 `exportImage`：等字体与下一帧布局稳定后再调 `toPng`，并把 `width`/`height` 显式传入（取 `getBoundingClientRect` 与 `scrollHeight/Width` 的最大值），同时补 `backgroundColor` 以贴近卡片底色、消除圆角外透明。

## Capabilities

### New Capabilities
<!-- 无新增 capability -->

### Modified Capabilities
- `persona-card`: 收紧「图片导出」的 Scenario，要求导出图片完整覆盖整张卡片（不裁切、不留透明边）。

## Impact

- 代码：[src/app/page.tsx](src/app/page.tsx) `exportImage`
- 行为：导出 PNG 尺寸 = 卡片实际占位；背景统一为 #121420（对应 .card 渐变底色），分享到聊天软件不再出现透明角。
- 依赖：沿用现有 `html-to-image`，不引入新依赖。

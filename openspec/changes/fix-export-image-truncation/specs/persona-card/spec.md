## MODIFIED Requirements

### Requirement: 图片导出
系统 SHALL 让用户一键导出卡片为图片，且在客户端生成。导出的图片 MUST 完整覆盖卡片可视范围，不出现顶部或底部裁切、不留透明边。

#### Scenario: 用户导出卡片
- **WHEN** 用户点击导出/保存动作
- **THEN** 在浏览器内生成卡片图片并下载
- **AND** 不向服务端发送任何额外个人数据来生成该图片

#### Scenario: 导出图片完整覆盖卡片
- **WHEN** 用户在卡片入场动画走完后点击「保存为图片」
- **THEN** 下载的 PNG 像素高度 MUST 不小于卡片实际高度，包含 headline、quote、tags、所有 clusters、其他兴趣散点与 evolution 时间线，不出现半行截断
- **AND** 圆角外的画布像素 MUST 填充接近卡片底色的实色，不留透明

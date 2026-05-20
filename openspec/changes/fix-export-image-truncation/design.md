## Context

[src/app/page.tsx:362-369](src/app/page.tsx#L362-L369) 的 `exportImage` 当前直接调用：

```ts
const url = await toPng(cardRef.current, { pixelRatio: 2 });
```

`cardRef` 指向 [PersonaCard](src/components/PersonaCard.tsx) 渲染出的 `.card` div。该元素有 `padding: 30px`、`border: 1px`、`border-radius: 20px`、`background: linear-gradient(...)`，并包含若干异步入场动画元素（`reveal-first` / `reveal-quick` 走完后才暴露按钮）。

`html-to-image` 默认用 `offsetWidth / offsetHeight` 决定输出尺寸。当下面任一条件成立时，导出图片就会出现「顶部透明 + 底部裁切」：

1. 字体（中文回落到系统字 `PingFang SC` / `Microsoft YaHei`）首次绘制后行高有微调，但库已先量过尺寸。
2. `getBoundingClientRect` 与 `scrollHeight` 在亚像素层面不一致；以 `offsetHeight` 为准会比内容矮 1–2px，乘 pixelRatio=2 后被放大为可见缺口。
3. 没有显式 `backgroundColor`，圆角外是 PNG 透明像素 —— 用户在带浅色背景的图片查看器里就会看到一圈透明（看起来像「顶部透明条带」）。

入场动画在用户点到「保存为图片」时已经走完（按钮的 `pointer-events` 被 `onRevealEnd` 解锁后才可点），所以 transform 不是诱因。

## Goals / Non-Goals

**Goals:**
- 导出 PNG 尺寸完整覆盖 `.card` 内容，顶/底不出现裁切。
- 圆角外的像素填上接近卡片底色的实色（`#121420`，对应渐变结束色），不留透明。
- 维持现有 2x pixelRatio 与文件名约定。

**Non-Goals:**
- 不替换 `html-to-image` 为其他库（如 `html2canvas`/`dom-to-image-more`）—— 当前问题可在库的 options 内解决。
- 不改 `.card` 自身样式 / DOM 结构 —— 风险半径限制在 `exportImage` 函数内。
- 不引入额外用户可见提示（loading / toast），保持点击即下载。

## Decisions

### 决定 1：等 `document.fonts.ready` + 一帧 RAF，再量尺寸

**为什么**：截图前确保浏览器把字体测量到了最终状态，避免「测量时用 fallback、绘制时用真字体」造成的高度漂移。一帧 RAF 进一步确保任何 React 提交后的样式重排已落地。

**替代方案**：
- 只等 fonts.ready：在某些 webkit 上 fonts.ready 触发时布局未完，仍会漏算 1–2px。
- 不等待，加 `+ 8px` buffer：脏 workaround，会让圆角下方多出一条透明 / 实色边。

### 决定 2：显式传 `width` / `height` = `max(rect, scrollSize)`

```ts
const rect = node.getBoundingClientRect();
const width = Math.ceil(Math.max(rect.width, node.scrollWidth));
const height = Math.ceil(Math.max(rect.height, node.scrollHeight));
```

**为什么**：`getBoundingClientRect` 返回亚像素浮点（更精确），但若有子元素溢出（罕见，但 evolution 的 `padding-left` 加边框时可能 +1px），`scrollHeight` 会更大。取 max 并 ceil，可同时覆盖两种情况，且不会比真实尺寸小。

**替代方案**：只用 `offsetHeight` —— 即当前 html-to-image 的默认行为，已被验证不够稳。

### 决定 3：传 `backgroundColor: "#121420"`

**为什么**：`.card` 的背景是 `linear-gradient(160deg, #1a1c2b, #121420)`，渐变末端是 `#121420`。把这个色作为画布底色，圆角外四角变成实色而不是透明 —— 分享到任意背景的聊天/相册都不会出现奇怪的透明角。选末端色而非起点色，是因为大部分卡片高度都在渐变后半段，整体观感更接近卡片内部色。

**替代方案**：
- 不设 backgroundColor，保留透明圆角：当前问题的来源之一。
- 设 `transparent`：跟现状一致，不解。
- 设页面背景 `#0b0d12`：和卡片渐变末端有色差（更暗），圆角外会出现可见「边框」。

## Risks / Trade-offs

- **风险**：`document.fonts.ready` 在极少数老浏览器（Safari < 10）上没有 —— 用 `?.` 可选链兜底即可，不会破坏导出。
- **风险**：圆角外填色非透明，意味着把卡片粘到自定义背景上时会看到一圈方角实色。**缓解**：这是 PNG 分享场景的通用妥协；接受这个 trade-off 换稳定的「整张卡完整」。
- **取舍**：等一帧 RAF + fonts.ready 会让点击到下载延迟 ~50–200ms（视字体加载状态）。**缓解**：分享是用户主动确认的高意图动作，这段延迟低于人对「卡顿」的感知阈值，不加 loading 也没问题。

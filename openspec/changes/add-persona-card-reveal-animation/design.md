## Context

人格卡当前在 `phase === "done"` 时直接渲染（见 `src/app/page.tsx:594`），
组件本身（`src/components/PersonaCard.tsx`）只是把 `PersonaProfile` 数据
铺成 DOM，没有任何入场动效。CSS 中已有 `chipin`、`pulse`、`blink` 等小动效
（`src/app/globals.css`），动效栈选型为纯 CSS keyframes + className 切换。

卡片在两种场景下出现：
1. 首次合成完成（流程末端高潮）——期望值最高。
2. 用户点 "换个风格重新生成" 后再次出现——期望降低、重复性高。

此外卡片还有「保存为图片」（html-to-image）的导出路径，导出时需要的是终态
DOM，而非动效中间帧。

## Goals / Non-Goals

**Goals:**
- 首次卡片出现具备明确的"揭晓"仪式感：3D 翻转（卡背 → 卡面）+ 落定时的
  轻微弹跳 + 卡内元素错峰显示。
- 重生成时使用缩短版动效，避免重复时的等待负担。
- 完全用 CSS 实现，不引入新依赖。
- 尊重 `prefers-reduced-motion`：直接展示终态。
- 不影响图片导出：导出时卡片必须处于终态。

**Non-Goals:**
- 不加粒子、光晕、背景渐变陪衬等附加视觉。
- 不做卡片层级的进入动画（如从合成区"飞入"等位移过渡）。
- 不动现有 `chipin`/`pulse` 等其它动效。
- 不引入动画库（framer-motion 等）。

## Decisions

### D1：动效用纯 CSS keyframes + className 切换，不用 JS 动画库
- **选择**：在 `PersonaCard` 组件挂载时通过 `useEffect`/`useState` 切换
  `reveal-first` / `reveal-quick` / `reveal-done` 类名；CSS 用
  `@keyframes` 驱动 transform/opacity。
- **理由**：项目已有同样模式（`.chip` 的 `chipin` 动画），无新依赖、bundle
  无增重；翻转 + 弹跳本质是 transform 关键帧，CSS 完全胜任。
- **替代**：framer-motion 提供更易组合的 stagger 与弹簧物理，但带来
  >40KB gzip，与本项目"轻"基调不符；放弃。

### D2：通过 prop `reveal` 控制播放模式
- **选择**：`PersonaCard` 新增 prop `reveal?: "first" | "quick" | "none"`，
  默认 `"none"`（用于 `/c/[id]` 分享页直接展示终态）。`page.tsx` 在
  `phase === "done"` 首次进入时传 `"first"`；当用户触发重生成后再次渲染时
  传 `"quick"`。
- **理由**：把"什么时候是首次"的判断留给上层（它知道是否走过重生成路径），
  组件本身只负责按 prop 播放。
- **替代**：用 `key` 强制 unmount/mount 触发首次动画——会丢内部状态，且
  无法区分首次 vs 重生成；放弃。

### D3：首次动效时序
| 阶段 | 时长 | 描述 |
| --- | --- | --- |
| 翻转 | 0–600ms | `rotateY(-90deg) → rotateY(0)`，`backface-visibility: hidden`，配合一个简易卡背 |
| 落定 | 600–800ms | `scale(0.98) → scale(1.02) → scale(1)` 弹跳 |
| 元素 stagger | 800–1250ms | headline (0ms) → traits (80ms) → clusters (160ms+每条 60ms) → evolution (+100ms) → disclaimer (+100ms)，每项 `opacity 0→1 + translateY(6px → 0)` 250ms |

- **理由**：800ms 入场命中"够仪式 + 没拖沓"的甜点区；元素 stagger 再加
  ~400ms，让用户视线有节奏地"读完"这张卡。
- **easing**：翻转/弹跳用 `cubic-bezier(.2,.8,.2,1)`（与现有 vignette
  卡片一致）；元素淡入用 `ease-out`。

### D4：重生成（quick）模式
- **选择**：跳过翻转和弹跳，仅做卡片整体 `opacity 0→1 + scale(0.98→1)`
  共 200ms，元素 stagger 总长压缩到 100ms（间隔 20ms）。
- **理由**：用户在重生成时关注的是"新内容"，不是仪式感；总动效 <300ms 不会
  造成等待感。

### D5：可访问性回退
- **选择**：在 CSS 中用 `@media (prefers-reduced-motion: reduce)` 把所有相关
  keyframes 改为 `animation: none`，并把元素初始状态强制设为终态
  （`opacity: 1; transform: none`）。
- **理由**：符合 W3C WCAG 2.3.3 推荐，避免诱发前庭不适。

### D6：与图片导出互斥
- **选择**：导出按钮所在的 `.toolbar` 在 `phase === "done"` 后与卡片一起渲染，
  但导出按钮的可点击触发本身就发生在动效结束后（用户行为天然异步）；额外
  保险——CSS 给导出按钮加 `animation-delay` ≥ 入场总时长，使其在动效中不可见
  /不可点；或者更简单：在 `PersonaCard` 内部 `reveal === "first"` 时短时间
  内（动效总时长）禁用 `.toolbar` 的 pointer-events。
- **决策**：采用更保险的"按钮淡入"——`.toolbar` 也用 ~250ms 淡入，
  `animation-delay` 设为入场结束（first 模式 1.25s，quick 模式 0.3s），
  期间 `pointer-events: none`。这样即便用户秒点也不会捕到动效中间帧。

## Risks / Trade-offs

- **[卡片初始空帧]** 翻转过程中卡背朝向用户，卡面 `backface-visibility: hidden`
  会有约 600ms 看不到任何内容 → 用一个朴素的卡背（项目主色 + logo/「人格卡
  生成中…」字样占位）补齐视觉，避免空白。
- **[元素 stagger 看起来"拖"]** 如果 traits/clusters 数量多，stagger 总时长
  容易变长 → cap：clusters 的逐条 stagger 总和不超过 240ms，更多的同时进入。
- **[重生成判定不可靠]** 上层若忘记把 `reveal` 切到 `"quick"`，用户每次
  重生成都会看到 800ms 翻转 → 在 `page.tsx` 用一个 ref/state 记录
  "是否已经播过首次"，重生成时强制 `"quick"`。
- **[导出图片捕到动效中间帧]** → 见 D6 决策，按钮整体延迟到动效结束才可点。

## Migration Plan

- 这是纯前端、纯展示性增强，无数据迁移；上线即生效。
- 回滚：若动效有问题，把 `PersonaCard` 的 `reveal` 默认值固定为 `"none"`，
  调用方一律不传，等价于关闭动效。

## Open Questions

- 卡背设计需不需要单独一稿？（暂用占位文字 + 卡片同色背景，后续可换图。）
- 是否需要给"翻转方向"留个开关（左翻 vs 右翻）？默认右翻（`rotateY` 正向）。

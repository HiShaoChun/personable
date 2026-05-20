## Context

首页 `src/app/page.tsx` 的 `idle` 阶段当前只渲染：`h1` 标题、`p.sub` 说明、
`div.drop` 拖拽区。新用户没有任何「成品长什么样」的视觉线索。同时产品的差异
化卖点之一是 `换风格`（earnest / roast / poetic 三种 vibe），但只有跑完一次
才能看到——对从未点过上传按钮的访客来说完全不可见。

`PersonaCard` 组件本身已经是纯函数（`profile: PersonaProfile` in），可以直接
拿任意合法 profile 渲染，无需 API。`PersonaProfile` schema 见
[src/lib/agent/schema.ts](src/lib/agent/schema.ts)。

## Goals / Non-Goals

**Goals:**
- 首页 `idle` 态下，访客无需任何操作即可在第一屏（或滚动一下）看到 1+ 张
  真实样式的人格卡
- 用 3 张分别对应 `earnest` / `roast` / `poetic` 的样例，演示同一份"虚构
  书签库"被三种风格解读出的差异
- 零 API/budget 消耗、零 localStorage 写入；不能影响主上传路径
- 移动端与桌面端都可读

**Non-Goals:**
- 不做卡片轮播、自动播放等动画
- 不做"用户也可以从样例分享"——样例没有 `id` / 没有 `/c/[id]` 路由支持
- 不引入新的图片资源（卡片本身就是富文本渲染，不需要截图）
- 不为示例提供"重新生成"按钮——它们是静态展示物，不是真运行结果

## Decisions

### 1. 缩略展示形式：原尺寸卡片 + 网格，CSS 缩放而非"截图"

样例使用真实的 `<PersonaCard profile={...} />` 渲染（不是 `<img>` 截图），
通过 CSS `transform: scale(.6)` 之类把多张卡缩进一屏。

**为什么不截图：**
- 截图需要预生成 + 维护 + CDN 托管；卡片任何样式变动都要重新出图
- 真实渲染天然随主题/字体/CSS 变化保持一致
- 同一 `PersonaCard` 组件复用，避免分支偏移（与 `SKELETON` 常量同源的思路一致）

**为什么不"原尺寸纵向堆叠 3 张"：**
- 占屏过大，首屏拖拽区会被挤到要滚动才看到
- 失去"画廊"感

### 2. 展开交互：点击切换，单选模式

桌面端 3 张缩略并排，点击任意一张 → 该张恢复原尺寸并显示在画廊正下方
（缩略区保留，被选中的那张高亮）。再点同一张折叠回去，点另一张切换选择。

**替代方案：** Modal / Lightbox 弹层。
**为什么不用：** 弹层会遮挡主路径（拖拽区），且需要额外的 esc/点空白关闭逻辑；
就地展开更轻量、且让访客看完示例后视线能自然回到拖拽区。

**替代方案：** 全部默认展开纵向铺开。
**为什么不用：** 首屏被吃光，且会让人误以为这就是真实产物（用户可能还没看到
拖拽区就走了）。

### 3. 示例数据：手工编写而非脚本生成

`src/lib/samples.ts` 直接导出 3 个 `PersonaProfile` 对象常量，手工编写
headline / traits / clusters / evolution 等字段。

**为什么手工：**
- 只有 3 份，工程化生成的边际成本大于手写
- 手工可以精挑细选展现 vibe 差异最强的措辞（earnest 偏温柔、roast 偏锐利、
  poetic 偏文艺），这是这个 feature 的核心说服力
- 编译期类型检查保证字段对得上 `PersonaProfile` schema

**约束：**
- 同一份"虚构书签库"前提下生成 3 张，避免给人"内容不同所以差异这么大"的
  误解。三份的 `clusters.name` 应大致同构（同一兴趣集合），只是 `headline` /
  `traits` / `evolution.summary` 的风格不同
- `disclaimer` 字段使用 `DISCLAIMER` 常量；额外在画廊容器加一句小字
  「以下为示例，非真实用户数据」防止误读

### 4. 可见性条件：`phase === "idle" && !profile`

只在用户既未开始上传、也没有持久化恢复态时显示。一旦进入 `parsing` /
`thinking` / `done`，或挂载时从 localStorage 恢复出了 `profile`，画廊立即
消失。

**为什么不用单独的 dismiss 按钮：** 既然只有 idle 才显示，用户一旦上传就
自然消失；老用户从持久化恢复进来也不会再看到。零额外状态。

### 5. 文件组织

- 数据与组件分离：
  - [src/lib/samples.ts](src/lib/samples.ts) 仅导出常量数据（纯数据模块）
  - [src/components/SampleGallery.tsx](src/components/SampleGallery.tsx)
    负责布局、缩略缩放、选中态管理
- `page.tsx` 只新增一行挂载，避免该文件继续膨胀

## Risks / Trade-offs

- [CSS `transform: scale` 在缩略卡的点击命中区域可能变小，且事件坐标系仍按
  原尺寸算] → 给缩略卡外面套一层 `width/height` 与缩放后视觉一致的容器
  （用 `transform-origin: top left` + 父容器固定尺寸），点击挂在父容器上
- [样例字段如不随 `PersonaProfile` schema 演进而更新，会编译失败] → 这是
  期望行为，类型错误强制示例数据保持新鲜
- [访客可能把示例的 headline 当真，误以为是其他真实用户] → 用画廊标题
  「看看别人的卡片长啥样（示例）」+ 卡片外的免责小字双重提示，且不附带
  任何"作者/时间戳"伪装元素
- [示例占屏可能让访客忽略拖拽区] → 拖拽区保持原位、原样式；画廊放在其
  下方而非上方；画廊有明显标题分隔
- [移动端 3 张并排会过窄] → 移动端切换为单列纵向缩略（`@media`
  断点），保持可读

## Migration Plan

无数据迁移。纯前端新增组件 + 路由内的条件渲染。回滚 = 删除
`SampleGallery` 引用与文件。

## Open Questions

- 示例画廊里的卡是否也展示 `换风格` 按钮组以演示该交互？
  - 倾向：**不展示**。三张卡分别就是三种风格，已经是"差异演示"；展示
    按钮会让人误以为可以点（点了什么也不会发生 / 还要 mock 逻辑）。
  - 若后续访谈发现用户没意识到这是"三种风格"，再考虑加一个简短文字
    标签（如卡顶角的 vibe 名字）。

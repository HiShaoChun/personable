# homepage-samples

## Purpose

在首页 `idle` 阶段，于拖拽上传区下方提供一个由静态预制 `PersonaProfile`
驱动的示例画廊，让首次访客在不上传任何文件、不消耗任何 LLM / 抓取预算
的前提下就能直观看到产品最终产出形态，并通过多 vibe 风格对比感知到「换
风格」差异化能力。画廊仅在「全新访客」视图（`phase === "idle"` 且无持久
化人格画像）下出现，不与真实产物视觉竞争。

## Requirements

### Requirement: 首页示例画廊
系统 SHALL 在首页 `idle` 状态下展示预制人格卡示例画廊，让访客在不上传任何
文件的前提下就能理解最终产出形态。

#### Scenario: 访客首次进入首页
- **WHEN** 用户首次打开首页，未上传任何书签文件，且本地无持久化的人格画像
- **THEN** 系统在拖拽上传区下方渲染示例画廊
- **AND** 画廊带有标题和「以下为示例，非真实用户数据」的提示文字

#### Scenario: 主上传入口保持不被遮挡
- **WHEN** 示例画廊处于可见状态
- **THEN** 拖拽上传区仍位于其上方且保持原始位置、尺寸与样式
- **AND** 画廊不使用模态弹层或浮层等遮挡上传区的容器

### Requirement: 预制示例的数据来源
系统 SHALL 用纯前端静态数据驱动示例画廊，绝不调用 LLM、抓取或任何后端 API。

#### Scenario: 渲染示例
- **WHEN** 画廊正在挂载
- **THEN** 系统从源码内置的静态常量读取人格画像，直接传给 `PersonaCard` 渲染
- **AND** 不发起对 `/api/persona`、`/api/regenerate` 或任何外部接口的请求
- **AND** 不读写 `personable:last` 等 localStorage 键

#### Scenario: 示例数据符合人格画像 schema
- **WHEN** 任一示例被渲染
- **THEN** 其对象形状满足 `PersonaProfile` 类型契约（`vibe`、`headline`、
  `traits`、`clusters`、`evolution`、`disclaimer` 字段齐全且合法）

### Requirement: 多 vibe 风格覆盖
示例画廊 SHALL 同时展示多种人格风格，让访客直观感知「换风格」差异化能力。

#### Scenario: 画廊包含全部支持的 vibe
- **WHEN** 画廊渲染完成
- **THEN** 画廊包含恰好 3 个示例卡，分别对应 `earnest`、`roast`、`poetic`
  三种 vibe
- **AND** 三张卡的 `headline` 与 `traits` 文案风格明显不同，体现 vibe 差异

#### Scenario: 同构兴趣簇便于横向对比
- **WHEN** 访客比较三张示例
- **THEN** 三张卡的 `clusters.name` 集合大致一致（同一虚构书签库前提下）
- **AND** 差异主要体现在 `headline`、`traits`、`evolution.summary` 的措辞

### Requirement: 缩略展示与展开交互
画廊 SHALL 默认以缩略形态并列展示多张示例卡，并允许用户点击查看任意一张
的完整尺寸渲染。

#### Scenario: 默认缩略并列
- **WHEN** 画廊初次渲染
- **THEN** 三张示例卡均以缩略形态并列出现，访客可一屏扫到全部
- **AND** 没有任何一张处于"展开"选中态

#### Scenario: 点击缩略卡展开
- **WHEN** 访客点击某张缩略卡
- **THEN** 该张以原始 `PersonaCard` 完整尺寸渲染于画廊正下方（或就地展开）
- **AND** 被选中的缩略卡获得视觉高亮以表明当前展开的是它

#### Scenario: 切换展开对象
- **WHEN** 已有一张展开，访客点击另一张缩略卡
- **THEN** 原展开卡折叠，新点击的卡展开
- **AND** 同一时刻最多只有一张处于展开态

#### Scenario: 再次点击折叠
- **WHEN** 访客再次点击当前已展开的那张缩略卡
- **THEN** 该卡折叠，画廊回到全部缩略的初始态

### Requirement: 与主流程可见性互斥
示例画廊 SHALL 只在首页确认是"全新访客"的视图状态下显示，避免与真实产出
视觉竞争。

#### Scenario: 上传开始后立即隐藏
- **WHEN** 用户拖入或选择文件，首页阶段从 `idle` 切到 `parsing` 或 `thinking`
- **THEN** 示例画廊立即从 DOM 中移除
- **AND** 之后的全部阶段（`parsing` / `thinking` / `done`）均不再展示画廊

#### Scenario: 从持久化恢复时不展示
- **WHEN** 页面挂载时从 `localStorage` 成功恢复出已有的人格画像（`phase`
  直接进入 `done`）
- **THEN** 示例画廊不渲染

### Requirement: 响应式与可读性
画廊 SHALL 在桌面端与移动端都保持可读，缩略形态不破坏卡片内的文字层级。

#### Scenario: 桌面端布局
- **WHEN** 视口宽度足以容纳三张缩略卡并排
- **THEN** 画廊以水平网格展示三张缩略卡

#### Scenario: 移动端布局
- **WHEN** 视口宽度过窄，无法容纳三张缩略卡并排
- **THEN** 画廊切换为单列纵向堆叠，每张缩略卡占用合适宽度且文字仍可读

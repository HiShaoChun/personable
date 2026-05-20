## Context

`/persona/[id]` 分享卡路由是从社交分享进入产品的唯一入口，是病毒漏斗最关键的一节。
当前实现（[src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx)）把"产品名"
放在 hero、把"再生成 CTA"做成灰色行内链接、对失效链接只给一句冷淡提示，缺乏
转化设计。同时 store（[src/lib/store.ts](../../src/lib/store.ts)）只持久化了
expiresAt，没有 createdAt，导致无法给访客提供"X 天前生成"的时间锚。

## Goals / Non-Goals

**Goals:**
- 让分享页"以人为主、以产品为辅"——访客一进来看到的是被分享者的人格画像，
  不是产品自我介绍。
- 把"我也想要一张"的转化入口从灰色脚注升级为按钮形态的主 CTA。
- 失效链接也走相同的转化路径，并解释清楚为什么过期。
- 给访客提供时间锚（"X 天前生成"）减少陌生感。

**Non-Goals:**
- 不引入卡片入场动效到分享页（保持 `reveal="none"`）。分享页应当即时呈现终态。
- 不引入作者真实身份/昵称归属——产品本身不收集身份，分享卡也不应假装有作者。
- 不改卡片渲染本身（[src/components/PersonaCard.tsx](../../src/components/PersonaCard.tsx) 不动）。
- 不改 TTL（保持 `CARD_TTL_DAYS` 默认 7 天）。

## Decisions

### D1：hero 主标题取自人格 headline

把 `<h1>一张互联网人格卡</h1>` 替换为 `<h1>{profile.headline}</h1>`，副标题
改成产品一句话解释（如「AI 根据浏览器书签生成的互联网兴趣切片，仅供娱乐」）。
卡片内部的 headline `<h2>` 不动——它在卡内作为"标题元素"仍然成立，只是 hero
现在也用同一句作为页面主标题，强化"这页讲的就是这个人"。

**为什么不删卡内 headline**：卡片是导出图片的对象，导出后看图的人没有 hero
上下文，卡内必须自含 headline。所以 hero 与卡内 headline 是有意重复的——hero
服务于"分享页这张网页"，卡内 headline 服务于"卡片这张图"。

### D2：CTA 升级为按钮 + 复用现有 `.btn` 样式

把脚注链接换成 `<Link href="/" className="btn">生成你自己的人格卡 →</Link>`，
并放置在卡片正下方、显眼位置（不放在页面更下方的脚注区）。复用首页已有的
`.btn` 样式而非新建。

**位置选择**：紧贴卡片下方而非更靠下，是为了在用户读完卡片情绪到顶点时立即
承接转化冲动。CTA 远离卡片就丢失这股惯性。

### D3：失效页同结构对待

失效分支（旧版 [src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx) 的 if (!row) 分支）
保持"友好状态"基调，但补充：
- 解释保留时长：「分享链接保留 {config.cardTtlDays} 天」（直接读 config，与
  [src/app/privacy/page.tsx:21](../../src/app/privacy/page.tsx#L21) 文案一致）。
- 同样的主按钮「生成你自己的人格卡 →」。

文案与正常页统一 CTA，让两条路径汇入同一个转化漏斗。

### D4：时间标——store 封套方案，而非加列

需要"X 天前生成"就必须持久化 createdAt。考虑两种方案：

**方案 A：扩 Driver schema 加列**
- `Row` 增加 `createdAt`，sqlite 表加列。
- 改动面：Driver 接口、MemoryDriver、SqliteDriver、调用方都要改。
- sqlite 需要 `ALTER TABLE` 迁移，且无法对现有 7 天内存量行回填。

**方案 B：把 value 封装为 `{ createdAt, profile }` JSON（采用）**
- store 仍是 opaque kv，Driver 接口不动。
- 只在 `putCard` / `getCard` 这两个 card 专用 helper 内做编解码。
- 读端做向后兼容：如果解析出的 JSON 没有 `createdAt` 字段（说明是封套上线
  之前写入的卡），就当作"无时间标"渲染——不报错、不显示标签。

**为什么选 B**：store 的 Driver 抽象保持纯粹（只懂 kv blob），改动收敛在
card 这一类资源上；不需要 sqlite 迁移；存量 7 天内的卡不会被破坏。

#### 兼容读取的契约

`getCard(id)` 现在返回 `string | null`（裸 profile JSON）。改造后改为返回
`{ profile: string; createdAt: number | null } | null`（profile 仍是 JSON
字符串以最小侵入到 `JSON.parse(profile)` 这一行）。`createdAt` 为 `null`
表示"老封套或无时间信息"，UI 端据此选择不渲染时间标。

调用方：
- [src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx)：`const row = getCard(id)`；`row.profile` 喂 `JSON.parse`；`row.createdAt` 喂时间标组件。

#### 时间标显示规则

- `< 1` 天：「今天生成」
- `1–30` 天：「N 天前生成」
- `≥ 30` 天：理论上不会出现（TTL 7 天兜底）；若出现按"30+ 天前"显示而非
  抛错。
- `createdAt === null`（老封套）：不渲染时间标。

服务端渲染（`force-dynamic`，见 [src/app/persona/[id]/page.tsx:8](../../src/app/persona/[id]/page.tsx#L8)）
直接 `Date.now() - createdAt` 即可；hydration mismatch 不会发生因为页面本身
就是动态渲染的。

### D5：不要在分享页放"换风格""保存图片"

分享页的访客**不是卡片的所有者**——给他「换风格」会让原作者的卡被任意改写、
破坏分享语义；给他「保存为图片」可能被用来冒充作者发图。这两个动作刻意不放，
保持分享页只读。

## Risks / Trade-offs

- **[存量卡无时间标] → 兼容读取**：上线后 7 天内仍有按旧裸格式写入的卡，访客
  打开时不显示时间标。这是有意的降级，不报错；7 天后自然消失。
- **[hero 是 headline，长 headline 折行]**：headline 一般不超过 25 字符（参考
  现有样本），现有 h1 line-height 足够；中文窄屏（如 360px 宽）出现两行也能
  接受——比让"产品名"占主位好。
- **[CTA 按钮颜色与卡片视觉抢焦点]**：复用现有 `.btn` 样式即可保持视觉一致，
  无需新色。如果上线后看到卡片下方按钮"喧宾夺主"，再退化为 `.btn.ghost` 或者
  退一档间距。
- **[失效页主按钮可能让用户"以为卡还在"]**：通过把按钮文案明确写成「生成你
  自己的人格卡 →」而不是「重试」，区分语义。

## Migration Plan

1. 先改 store（D4 的 B 方案）：`putCard` 写封套、`getCard` 兼容读取并返回带
   `createdAt` 的结构体。**这一步独立可上**，老路由仍然能消费 `row.profile`
   字段。
2. 改 [src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx)：hero / CTA /
   失效页 / 时间标。
3. 视觉走查一次（含失效页路径——手动喂一个不存在的 id）。

回滚：本次改动全部在 UI + store helper 两层，无外部依赖、无 DB schema 变更，
直接 revert PR 即可，存量封套数据仍然能被旧代码当成 JSON 解析失败而走"失效
状态"——但这个回滚窗口下"存量封套卡变失效"是可以接受的（与 TTL 自然过期等价）。

## Open Questions

- 时间标的颗粒度："今天生成 / N 天前生成"够不够？要不要做到小时（"3 小时前"）？
  默认按天即可，分享卡的语义本来就不需要分钟级精度。
- 副标题文案的最终措辞需在实现时定稿——「AI 根据浏览器书签生成的互联网兴趣
  切片」是当前草案；交付前一并对齐。

## Why

分享卡路由 `/persona/[id]` 现在的页面让"产品"成了主角、让被分享的"人格"成了配角：
hero 区写的是「一张互联网人格卡 / 由书签人格卡生成」——这是产品自我介绍，
不是访客来这里想看的"是谁的人格"。卡内的 headline（如「在编译与追剧之间反复
链接的运维诗人」）才是真主角，却被压在卡片内部、没有作为页面主标题出现。

同时，"我也想要一张"的转化入口是一个灰色的 `.note` 行内链接（[src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx)）——
访客读完卡片情绪刚到顶点，没有按钮形态的 CTA 接住这股冲动；失效页也是同样的
弱链接，且没有解释卡为什么过期、能保留多久。再加上访客面对的是一张"飘在空中"
的卡，没有任何时间锚（"几月前生成"），陌生感更重。

## What Changes

- 把卡内 headline 提到 hero 区作为页面主标题（h1），并把副标题改成产品一句话
  解释（不再说"由书签人格卡生成"这种同义反复）。
- 卡片下方放一个醒目的主按钮「**生成你自己的人格卡 →**」（`btn` 样式而非
  `note` 行内链接），替代当前的灰色脚注。
- 给卡片加"X 天前生成"的轻量时间标，让访客对这张卡何时被创建有时间感。
  为此 store 需要把 createdAt 一起持久化（现在只存了 expiresAt）。
- 失效页同样配主按钮 +「分享卡保留 N 天」的说明文案，按钮文案统一为
  「生成你自己的人格卡 →」。
- **不改**：保持现有 `reveal="none"` 行为（访客不播首次入场动效）；卡片本身
  渲染逻辑不动。

## Capabilities

### New Capabilities
<!-- 无新 capability —— 本次只调整既有的 persona-card 在分享路由下的渲染与文案 -->

### Modified Capabilities
- `persona-card`: 新增「分享链接落地页布局」需求（hero 主标题取自人格 headline、
  主按钮 CTA、时间标），并把现有「过期或未知链接」场景的友好状态细化为含主按钮
  与保留时长说明。

## Impact

- 代码：
  - [src/app/persona/[id]/page.tsx](../../src/app/persona/[id]/page.tsx)：重排 hero / CTA /
    失效页文案与按钮。
  - [src/lib/store.ts](../../src/lib/store.ts)：把 card 的 value 从"裸 profile
    JSON"改为含 `createdAt` 的封套；读端做向后兼容（无 createdAt 时不显示
    时间标，不报错）。
  - [src/app/api/persona/route.ts](../../src/app/api/persona/route.ts) 与
    [src/app/api/regenerate/route.ts](../../src/app/api/regenerate/route.ts)：
    putCard 时带上 createdAt（也可在 store 层封装，集中处理）。
  - [src/app/globals.css](../../src/app/globals.css)：时间标的轻量样式（沿用
    现有 `.note` / `.muted` 视觉）。
- 依赖：无新增。
- 风险：
  - 既有未过期卡（7 天内）的 value 仍是裸 profile JSON，读端必须兼容；否则
    访客会看到失效页。这条已在改动范围内（向后兼容读取）。
  - hero 主标题改成人格 headline 后，长 headline 在窄屏可能需要折行控制；
    现有 h1 已有 line-height，按住即可。

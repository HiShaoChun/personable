# Personable（标签人间）

> 把你的浏览器书签变成一张「人格卡」。

上传从浏览器导出的书签 HTML，前端本地解析，服务端 agent 流水线先做零 LLM 概览，再一次 LLM 聚类、一次风格化合成；最终渲染一张含人格特质、签名台词、命名兴趣簇与「数据切片」可视化的可分享卡片。

## 特性

- **本地解析、零上传**：原始 HTML 仅在浏览器内解析；送往服务端的是结构化条目（标题、URL、域名、文件夹路径、时间）。兼容 Chrome / Firefox / Edge / Safari / Brave / Arc / Opera / Vivaldi 等所有能导出 Netscape Bookmark File 的浏览器。
- **三段式流水线**：本地概览（零 LLM）→ 一次 LLM 聚类 → 风格化人格合成。所有阶段以 NDJSON 渐进流回前端，掩盖合成时延。
- **数据切片可视化**：概览阶段直接产出「收藏时段 / 主题漂移 / 集中度 / Binge 日」四张图，先于 LLM 结果到达，给用户即时反馈。
- **三种 vibe**：真诚 / 毒舌 / 诗意。换风格只重跑合成；首次定稿后后台预计算其余两种，切换瞬时命中。
- **签名台词 + tier 化故事线**：人格卡含 ≤28 字的 vibe 风格签名台词，故事线进度条按 tier 视觉分级。
- **本地续断**：最近一次生成结果写入 `localStorage`，刷新不丢；schema 升级自动失效旧记录。
- **图片导出 + 分享链接**：客户端 `html-to-image` 导出 PNG；分享链接走 `/persona/[id]`，仅存派生画像 JSON，默认 TTL 7 天。
- **硬性边界**：每日运行预算、单次 token 上限、墙钟超时、滑动窗口限流、并发上限——全在 [.env.example](.env.example) 一处配置；`AGENT_ENABLED=false` 一键回滚。

## 技术栈

- Next.js 15 + React 19 + TypeScript 5
- OpenAI SDK（OpenAI 兼容协议，默认指向 DashScope 通义千问）
- `html-to-image` 客户端导出 PNG
- 可选 `better-sqlite3` 做分享卡持久化（默认 in-memory）

## 快速开始

```bash
cp .env.example .env       # 填入 LLM_API_KEY
npm install
npm run dev                # http://localhost:3000
```

其它脚本：

```bash
npm run build              # 生产构建
npm run start              # 生产模式启动（端口 3000）
npm run typecheck          # tsc --noEmit
npm run test:fixtures      # scripts/verify.ts 跑解析/抽样 fixture 校验
```

辅助脚本：[scripts/pingmodels.ts](scripts/pingmodels.ts) 探测模型连通；[scripts/smoke.ts](scripts/smoke.ts) 端到端冒烟。

## 配置

所有可调参数集中在 [.env.example](.env.example)：

- `LLM_API_KEY` / `LLM_BASE_URL`：服务端凭据与端点（OpenAI 兼容协议）。
- `MODEL_TRIAGE` / `MODEL_SYNTHESIS`：聚类与合成分层（默认 `qwen-turbo` / `qwen-plus`）。
- `DAILY_RUN_BUDGET` / `PER_RUN_MAX_TOKENS`：成本熔断。
- `MAX_BOOKMARK_ENTRIES` / `MAX_REQUEST_BYTES` / `MAX_WALL_CLOCK_MS`：输入上限与墙钟兜底。
- `RATE_LIMIT_*` / `MAX_CONCURRENT_RUNS`：限流与并发。
- `STORE_DRIVER`：`memory`（开发）或 `sqlite`（自托管生产）；`STORE_PATH` 指定 sqlite 文件路径。
- `CARD_TTL_DAYS`：分享卡留存天数。
- `AGENT_ENABLED`：一键回滚开关，关闭后 agent 端点返回「已暂停」，前端与信息页仍可访问。

凭据仅服务端使用——绝不在客户端组件里 `import @/config`。客户端安全的常量（vibe 定义等）请从 [src/lib/vibes.ts](src/lib/vibes.ts) 导入。

## 项目结构

```
src/
  app/
    page.tsx                  首页：上传 → 渐进式生成 → 渲染卡片 + 数据切片 + sample gallery
    api/persona/              NDJSON 流式 agent 端点
    api/regenerate/           换风格重合成（复用聚类）
    persona/[id]/             分享链接页
    privacy/                  隐私说明页
  components/
    PersonaCard.tsx           人格卡（含签名台词、tier 化故事线）
    SampleGallery.tsx         首页样例卡片画廊
    data-slices/              「你的数据切片」四张图与统一外框
      DataSlices.tsx / SliceFrame.tsx
      TimeOfDayBars.tsx / TopicDrift.tsx
      BingeDaysSpotlight.tsx / ConcentrationBar.tsx
  lib/
    bookmarks/                HTML 解析、归一化、分层下采样（parse / sample / types）
    agent/                    overview / cluster / loop / synthesize / schema / llm
    safeguards.ts             预算、限流、并发护栏
    samples.ts                首页样例卡数据
    store.ts                  分享卡存储（memory | sqlite）
    vibes.ts                  风格定义（client-safe）
  config.ts                   单一配置入口（仅服务端）
openspec/
  specs/                      能力规格（bookmark-import / persona-agent / persona-card /
                              api-safeguards / homepage-samples）
  changes/                    进行中与已归档的变更提案
scripts/                      pingmodels / smoke / verify
```

详细行为契约见 [openspec/specs/](openspec/specs/)。

## 隐私

- 上传的书签 HTML 仅在浏览器内解析，不发往服务端、不落盘。
- 送往 LLM 的是结构化条目（标题、URL、域名、文件夹路径、时间），用完即弃。
- 分享链接只存派生画像 JSON，以不可猜 ID 为键，到期自动失效。
- 生成的卡片含固定免责声明：AI 解读，仅供娱乐。

完整说明见 [/privacy](src/app/privacy/page.tsx)。

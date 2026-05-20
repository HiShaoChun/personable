## Why

当前 agent 流水线把「自主深挖（agent 选择性抓取代表性网页）」作为合成前的必经步骤，但产品复盘发现：聚类步骤已经看到全部书签的标题、域名、用户自建文件夹路径，信号已经饱和；深挖每次只抓 2-3 个 URL，对 150+ 书签的画像贡献的边际信息量极低，却带来 5-20 秒延时、同输入不同输出的随机性、对用户书签的隐私抓取风险、以及大量"抓取失败"的失败路径。砍掉这一阶段能同时改善延时、稳定性、隐私与 UI 一致性。

## What Changes

- **BREAKING** 移除 agent 流水线中的「自主且有界的深挖」阶段；流水线由「overview → cluster → deepdive → synth」四段简化为「overview → cluster → synth」三段。
- 移除网页抓取工具及其安全边界（仅适用于深挖，整步骤不再存在）。
- 移除前端深挖步骤 UI（fetch chip 行、deepdive 进度卡）与对应进度事件流。
- 持久化与缓存中与深挖相关的字段（fetches、fetchedNotes）一并清理；按风格重合成依旧复用概览与簇。
- 配置中仅服务于深挖的边界字段（最大抓取数、工具迭代数等）一并删除。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `persona-agent`: 流水线由四段改为三段（移除「自主且有界的深挖」与「网页抓取工具安全」两项需求）；「标准运行」「按风格重合成且不重跑深挖」需求的措辞同步调整。

## Impact

- 代码：[src/lib/agent/loop.ts](src/lib/agent/loop.ts)（移除 deepdive 循环、工具协议、相关进度事件）、[src/lib/agent/fetchPage.ts](src/lib/agent/fetchPage.ts)（整体删除）、[src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)（AgentState 去掉 fetchedNotes）、[src/app/page.tsx](src/app/page.tsx)（删除 deepdive 步骤 UI、fetch chip 行、相关 state 与持久化字段）、[src/config.ts](src/config.ts)（删除 maxPageFetches / maxAgentIterations 等仅深挖使用的字段）。
- API：流式进度事件类型缩减，`deepdive_thinking` / `deepdive_fetch` / `deepdive` 三类事件不再发出（仍订阅旧事件的客户端会静默忽略，不会出错）。
- 持久化：localStorage 中的 run 快照不再写入 `fetches` 字段，旧快照里的该字段读取时忽略，向后兼容。
- 依赖：若仅深挖使用 cheerio / undici 等抓取相关依赖，可一并卸载（待 design 阶段确认）。
- 用户体验：总耗时显著下降（去掉 5-20s 深挖窗口）；同一份书签的两次运行输出更稳定；不再向第三方网站发起服务端抓取请求。

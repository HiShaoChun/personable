## 1. 模块级常量与类型

- [x] 1.1 在 [src/app/page.tsx](src/app/page.tsx) 顶部组件外新增 `const STORAGE_KEY = "personable:last";` 与 `const STORAGE_VERSION = 2 as const;`（D1；从 1 升到 2 以丢弃缺过程档案字段的旧记录）
- [x] 1.2 在 `type Phase` 附近新增 `type PersistedRun`，包含 `version` / `id` / `runId` / `profile` / `vibeCache` / `ovStat` 与过程档案字段 `clusterThinking: string` / `thinking: string` / `synthThinking: string` / `clusterPrev: ClusterPreview[]` / `fetches: FetchItem[]`（D1、D6）

## 2. 写入函数

- [x] 2.1 在 `Home` 组件外新增 `persistRun(state: Omit<PersistedRun, "version">)`：内部 `typeof window !== "undefined"` 守卫，try/catch 包住 `JSON.stringify` 与 `localStorage.setItem`，异常一律静默（D4）

## 3. 挂载时恢复

- [x] 3.1 在 `Home` 组件内、`handleFile` 定义前新增 `useEffect(() => { ... }, [])`（依赖数组留空、加 `eslint-disable-next-line react-hooks/exhaustive-deps`）：
  - 读 `localStorage.getItem(STORAGE_KEY)`
  - 校验 `version === STORAGE_VERSION` 且 `id` / `runId` / `profile` 三字段齐全
  - 通过则按顺序 `setProfile` / `setIds` / `setVibeCache(parsed.vibeCache ?? {})` / `setOvStat(parsed.ovStat ?? null)` / 过程档案恢复 `setClusterThinking(parsed.clusterThinking ?? "")` / `setThinking(parsed.thinking ?? "")` / `setSynthThinking(parsed.synthThinking ?? "")` / `setClusterPrev(parsed.clusterPrev ?? [])` / `setFetches(parsed.fetches ?? [])` / 最后 `setPhase("done")`
  - 校验失败或解析抛错则 `localStorage.removeItem(STORAGE_KEY)` 并保持 idle（D3、D6）

## 4. 写入触发点

- [x] 4.1 在 NDJSON `done` 事件处理处（约 [page.tsx:155-163](src/app/page.tsx#L155)）`setPhase("done")` 之后追加 `persistRun({...})`：用本地 `runOvStat` 与新增的过程档案 runX 镜像（见任务 4a）传入，**不**用闭包变量（D2 #1、D6.1）
- [x] 4.2 在预生成 effect 内（约 [page.tsx:205-208](src/app/page.tsx#L205)）`setVibeCache` 内追加 `persistRun(...)`：用 functional updater 内部合并后的 `next` vibeCache，过程档案字段从闭包 state 取（effect 触发时这些已是 done 状态的稳定值）（D2）
- [x] 4.3 在 `regenerate(vibe)` 命中分支（约 [page.tsx:225-231](src/app/page.tsx#L225)）`setIds({ ...ids, id: hit.id })` 之后追加 `persistRun({...})`：包含 vibeCache 与过程档案字段（regenerate 函数每次 render 重建，闭包 state 反映最新值）（D2 #2）
- [x] 4.4 在 `regenerate(vibe)` 远端成功分支（约 [page.tsx:244-251](src/app/page.tsx#L244)）`setVibeCache` 内 `persistRun(...)`：同 4.2，过程档案从闭包读取（D2 #3）

## 4a. 流式累计的局部镜像（新增）

- [x] 4a.1 在 `handleFile` 内 NDJSON 读取循环外声明：`let runOvStat`、`let runClusterThinking = ""`、`let runThinking = ""`、`let runSynthThinking = ""`、`let runClusterPrev: ClusterPreview[] = []`、`let runFetches: FetchItem[] = []`（D6.1）
- [x] 4a.2 在 `cluster_thinking` / `deepdive_thinking` / `synth_thinking` 三个分支里，在 setX 旁追加 `runClusterThinking += ev.delta as string`（同理另两段），保证 done 时 runX 是真实累计文本（D6.1）
- [x] 4a.3 在 `clusters` 分支同步 `runClusterPrev = ev.clusters as ClusterPreview[]`（D6.1）
- [x] 4a.4 在 `deepdive_fetch` 分支用同样的查找/更新逻辑同步 runFetches（一份与 setFetches updater 等价的纯函数计算），保证 runFetches 与 setX 后的 state 一致（D6.1）

## 5. 清空触发点

- [x] 5.1 在 `handleFile` 开头的状态重置区块末尾（`setVibeCache({});` 之后，约 [page.tsx:75](src/app/page.tsx#L75)）追加 `if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);`（D5）

## 6. 不动的部分

- [x] 6.1 不修改 [src/app/api/persona/route.ts](src/app/api/persona/route.ts)、[src/app/api/regenerate/route.ts](src/app/api/regenerate/route.ts)
- [x] 6.2 不修改 [src/lib/store.ts](src/lib/store.ts) 或任何 `src/lib/agent/**`
- [x] 6.3 不修改 [src/app/c/[id]/page.tsx](src/app/c/[id]/page.tsx)——分享链接路由的语义保持不变
- [x] 6.4 不更新隐私页 `/privacy` 文案——profile 本就是可分享数据，写入本地存储不改变数据使用方式

## 7. 验证

- [ ] 7.1 冷启动恢复：上传一份书签 → 等定稿 → 刷新 → 验证卡片立刻回来、分享链接按钮可用、"换个风格"按钮里当前 vibe 仍 disabled、其它 vibe 可点
- [ ] 7.2 切换后刷新：定稿后点"换个风格"切到另一 vibe → 刷新 → 验证回到刚切到的 vibe（不是 done 时的初始 vibe）；URL 复制粘贴的分享链接 ID 与卡片对应
- [ ] 7.3 预生成持久化：定稿后等几秒让预生成完成（DevTools Network 可见 2 个 `/api/regenerate`）→ 刷新 → 点其它两个 vibe → 验证瞬时切换、不出现"生成中…"
- [ ] 7.4 新上传清空：定稿 → 拖入另一份 HTML → 在 `parsing` 阶段刷新 → 验证回到 idle（旧记录已被清掉，新记录还没写）
- [ ] 7.5 版本兜底：手工在 DevTools Application → Local Storage 把 `personable:last` 的 `version` 改成 `999` → 刷新 → 验证回到 idle 且记录被自动删除
- [ ] 7.6 损坏 JSON 兜底：把 `personable:last` 值改成 `"{not json"` → 刷新 → 验证回到 idle 且记录被自动删除
- [ ] 7.7 隐私模式：在 Safari 私密窗口或 Firefox 隐私窗口测试，验证 `setItem` 抛 QuotaExceeded 时不报错、本次会话仍正常用（只是刷新不恢复）
- [ ] 7.8 SSR：`npm run build && npm run start` 验证服务端渲染不抛 `window is not defined`
- [ ] 7.9 多标签：标签 A 生成卡片 → 标签 B 也生成另一份 → 标签 A 刷新 → 验证看到标签 B 的卡片（最近写入者覆盖，符合 D1 决策）

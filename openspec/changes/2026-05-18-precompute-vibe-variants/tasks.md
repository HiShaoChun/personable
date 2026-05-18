## 1. 前端缓存与触发

- [x] 1.1 在 [src/app/page.tsx](src/app/page.tsx) 顶部 import `VIBES` 与 `useEffect`（如未引入），新增 state：`const [vibeCache, setVibeCache] = useState<Partial<Record<Vibe, { id: string; profile: PersonaProfile }>>>({});`（D1）
- [x] 1.2 在 NDJSON `done` 事件处理处（约 [page.tsx:148](src/app/page.tsx#L148)）追加 `setVibeCache({ [ev.profile.vibe]: { id: ev.id, profile: ev.profile } });`，覆盖式写入而非合并（D3）
- [x] 1.3 在 `handleFile` 开头的状态重置区块（约 [page.tsx:58-69](src/app/page.tsx#L58)）追加 `setVibeCache({});`（D8）
- [x] 1.4 新增预生成 `useEffect`，依赖 `[ids?.runId, phase, profile?.vibe]`：当 `phase === "done"` 且 `ids && profile` 时，计算 `missing = VIBES.filter(v => v !== profile.vibe && !vibeCache[v])`；并发 `Promise.all(missing.map(...))` 发 `POST /api/regenerate`，成功的回写 `vibeCache`，失败/网络错误静默忽略；cleanup 用 `cancelled` flag 拦截过期回包（D2、D5）

## 2. 改造 `regenerate(vibe)`

- [x] 2.1 在 `regenerate(vibe)` 入口先查 `vibeCache[vibe]`：命中则同步 `setProfile(hit.profile)` / `setIds({ ...ids, id: hit.id })` / `setErr("")` 并 `return`，**不**调用 `setBusyVibe`（D4）
- [x] 2.2 未命中时走原有 fetch 路径，但在成功分支追加 `setVibeCache(c => ({ ...c, [vibe]: { id: data.id, profile: data.profile } }));`，让首次未命中后再次切回同 vibe 也瞬时（D4）
- [x] 2.3 不修改按钮 disabled 逻辑——`disabled={busyVibe !== null || v === profile.vibe}` 不变；命中分支不进 `busyVibe` 状态，按钮不会出现「生成中…」字样

## 3. 不动的部分

- [x] 3.1 不修改 [src/app/api/regenerate/route.ts](src/app/api/regenerate/route.ts) —— 服务端语义与今天完全一致
- [x] 3.2 不修改 [src/lib/agent/synthesize.ts](src/lib/agent/synthesize.ts)、[src/lib/store.ts](src/lib/store.ts)、[src/lib/safeguards.ts](src/lib/safeguards.ts)
- [x] 3.3 不在 `/api/regenerate` 加 `precompute` 参数 —— 安全闸门对预生成与点击重合成一视同仁（D6）

## 4. 验证

- [ ] 4.1 桌面端冷启动：上传一份书签 → 等待定稿 → 终态出现后不点任何按钮，等 ~15s 让两个预生成完成 → 点「换个风格」中的另外两个，验证按钮**不**显示「生成中…」、卡片瞬时切换、分享链接 ID 与「保存为图片」对应卡片一致
- [ ] 4.2 抢先点击：上传 → 终态出现后立即（<2s）点「换个风格」中的另一个 vibe，验证按钮显示「生成中…」、5-15s 后切换成功；之后再点回同 vibe，验证瞬时切换（未命中回填缓存生效，D4 第二条注意）
- [ ] 4.3 限流触发：手工短时间多次上传文件，让 IP 限流触发；验证「换个风格」此时 fallback 路径会看到限流错误，但卡片本身仍然在终态，过程档案完好
- [ ] 4.4 新文件清空：终态 → 拖入另一份书签 HTML → 验证旧 `vibeCache` 被清空（点切换不会瞬时跳到旧卡片）；新一次终态后预生成正常进行
- [ ] 4.5 网络面板核查：终态出现后浏览器 DevTools Network 面板有两个 `/api/regenerate` POST 在后台并发发出；点击命中缓存的 vibe 时不应产生新的网络请求
- [ ] 4.6 服务端日志核查：单次会话三次 `synth` timing 日志出现，每次 `synth attempt#1 done total=Xs ok=true`；`recordRun` 计数 + 3

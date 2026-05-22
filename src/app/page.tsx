"use client";
import { useEffect, useState } from "react";
import {
  parseRawEntries,
  normalizeAndDedupe,
  looksLikeBookmarkExport,
} from "@/lib/bookmarks/parse";
import { stratifiedSample, DEFAULT_MAX_ENTRIES } from "@/lib/bookmarks/sample";
import { VIBES, VIBE_LABEL, type Vibe } from "@/lib/vibes";
import PersonaCard from "@/components/PersonaCard";
import SampleGallery from "@/components/SampleGallery";
import DataSlices from "@/components/data-slices/DataSlices";
import { SAMPLE_OVERVIEW } from "@/lib/samples";
import type { PersonaProfile } from "@/lib/agent/schema";
import type { Overview } from "@/lib/agent/overview";

// basePath 前缀（部署到 /personable 子路径时由 next.config 注入）；
// 普通 <Link>/<a> Next 会自动前缀，但 fetch 不会，需要手动拼。
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const STORAGE_KEY = "personable:last";
// v6：移除 `id` 字段（分享链接功能已删，卡片不再有持久 id）；vibeCache value
// 同步去掉 id。旧 v5 记录形态不同，加载时被静默丢弃。
const STORAGE_VERSION = 6 as const;

type PersistedRun = {
  version: typeof STORAGE_VERSION;
  runId: string;
  profile: PersonaProfile;
  vibeCache: Partial<Record<Vibe, PersonaProfile>>;
  ovStat: { total: number; span: string } | null;
  overview: Overview | null;
  clusterThinking: string;
  synthThinking: string;
  clusterPrev: ClusterPreview[];
};

type Phase = "idle" | "parsing" | "thinking" | "done";

// 渐进式流事件（与 /api/persona NDJSON 对应）
type Stage = "cluster" | "synth";
interface ClusterPreview {
  name: string;
  size: number;
  domains: string[];
}

function persistRun(state: Omit<PersistedRun, "version">) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedRun = { version: STORAGE_VERSION, ...state };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // QuotaExceeded / 隐私模式禁写 / stringify 抛错 —— 一律静默
  }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [profile, setProfile] = useState<PersonaProfile | null>(null);
  // runId 是服务端 agent 状态缓存的键，「换个风格」时复用，避免重跑深挖。
  // 分享链接功能已删，前端不再需要 card id（v6）。
  const [runId, setRunId] = useState<string | null>(null);
  const [busyVibe, setBusyVibe] = useState<Vibe | null>(null);
  // 后台预生成其余 vibe 的成品，按 vibe 索引；首次定稿 seed 当前 vibe，
  // 命中即瞬时切换，未命中走原 fetch 路径。详见 openspec change
  // 2026-05-18-precompute-vibe-variants（D1）。
  const [vibeCache, setVibeCache] = useState<
    Partial<Record<Vibe, PersonaProfile>>
  >({});
  // 渐进式预览：概览/簇先到，掩盖深挖+合成时延
  const [stage, setStage] = useState<Stage | null>(null);
  // 入场动效控制：未播首次入场前 → "first"；播完或从 localStorage 恢复 → "none"；
  // 用户「换个风格」重生成后 → "quick"。由 profile.vibe 变化触发 PersonaCard
  // 重挂载来重新播放（见下方 key={profile.vibe}）。
  const [reveal, setReveal] = useState<"first" | "quick" | "none">("first");
  const [ovStat, setOvStat] = useState<{ total: number; span: string } | null>(
    null
  );
  // 完整 overview 对象（含 rhythm / bingeDays / identityPhases / concentration /
  // folderHealth 五组叙事素材）。`.steps` 内的「你的数据切片」图表区据此渲染；
  // ovStat 仍保留为 Step 标签的派生展示，避免改动既有判定逻辑。
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clusterPrev, setClusterPrev] = useState<ClusterPreview[]>([]);
  // 聚类 / 合成两步分别流式吐思考文本，让用户看到 agent 在干活
  const [clusterThinking, setClusterThinking] = useState("");
  const [synthThinking, setSynthThinking] = useState("");
  // "停顿"判定：模型 thinking 文本停止增长超过 HINT_IDLE_MS 后转为 true。
  // 用来在 thinking 流结束、结果未到的那段静默期触发占位 hint 轮播。
  const [clusterIdle, setClusterIdle] = useState(false);
  const [synthIdle, setSynthIdle] = useState(false);
  // 每次 thinking 文本变化都重置定时器：有新 delta 时立刻判定为"不停顿"，
  // 静默到 HINT_IDLE_MS 后再翻为"停顿"。初次渲染（文本仍为空）也会启动定时器，
  // 让首 token 死区在 1.5s 后也能进入 hint 状态。
  useEffect(() => {
    setClusterIdle(false);
    const id = setTimeout(() => setClusterIdle(true), HINT_IDLE_MS);
    return () => clearTimeout(id);
  }, [clusterThinking]);
  useEffect(() => {
    setSynthIdle(false);
    const id = setTimeout(() => setSynthIdle(true), HINT_IDLE_MS);
    return () => clearTimeout(id);
  }, [synthThinking]);

  // 挂载时尝试从 localStorage 恢复上一次的终态：损坏/过版本/字段缺失一律
  // 静默删除记录并保持 idle。详见 openspec change
  // 2026-05-18-persist-card-localstorage（D3）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedRun>;
      if (
        !parsed ||
        parsed.version !== STORAGE_VERSION ||
        !parsed.runId ||
        !parsed.profile
      ) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setProfile(parsed.profile);
      setRunId(parsed.runId);
      setVibeCache(parsed.vibeCache ?? {});
      setOvStat(parsed.ovStat ?? null);
      setOverview(parsed.overview ?? null);
      // 过程档案：与卡片并列展示的思考流 / 簇 chips
      setClusterThinking(parsed.clusterThinking ?? "");
      setSynthThinking(parsed.synthThinking ?? "");
      setClusterPrev(parsed.clusterPrev ?? []);
      setPhase("done");
      // 从 localStorage 恢复：用户其实已经看过这张卡，直接展示终态，
      // 不重播首次入场动效。
      setReveal("none");
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // 仅挂载时跑一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    setErr("");
    setNote("");
    setProfile(null);
    setStage(null);
    setOvStat(null);
    setOverview(null);
    setClusterPrev([]);
    setClusterThinking("");
    setSynthThinking("");
    setVibeCache({});
    setReveal("first");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setPhase("parsing");
    try {
      const html = await file.text();
      if (!looksLikeBookmarkExport(html)) {
        setErr("这看起来不是浏览器导出的书签 HTML（Netscape 格式）。请在你常用的浏览器里执行『导出书签 → HTML』后再上传。");
        setPhase("idle");
        return; // 不发起任何网络请求
      }
      const entries = normalizeAndDedupe(parseRawEntries(html));
      if (entries.length === 0) {
        setErr("没解析到任何有效书签。");
        setPhase("idle");
        return;
      }
      // 与 schema.ts 簇密度硬阈值 max(3, ceil(total*5%)) 对齐：少于 3 条
      // 没有任何簇能过滤，画像必然校验失败。在入口拦截，避免无效 LLM 调用。
      if (entries.length < 3) {
        setErr(
          `至少需要 3 条书签才能生成画像（当前 ${entries.length} 条）。`
        );
        setPhase("idle");
        return;
      }
      const { sample, sampled } = stratifiedSample(entries, DEFAULT_MAX_ENTRIES);
      if (sampled)
        setNote(
          `书签较多（${entries.length} 条），已抽取 ${sample.length} 条代表性样本分析。`
        );
      setPhase("thinking");
      setStage("cluster");
      const res = await fetch(`${BASE_PATH}/api/persona`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: sample }),
      });
      // 护栏拒绝在流开始前以 JSON 返回（非 200）
      if (!res.ok || !res.body) {
        let msg = "生成失败";
        try {
          msg = (await res.json()).message || msg;
        } catch {}
        setErr(msg);
        setPhase("idle");
        return;
      }

      // 渐进式读取 NDJSON：概览 → 簇 → 最终卡片
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      // 本次运行内的局部镜像：闭包里的 React state 不会随 setX 更新，
      // 持久化 done 快照时需要这里的真实累计值（D6.1）。
      let runOvStat: { total: number; span: string } | null = null;
      let runOverview: Overview | null = null;
      let runClusterThinking = "";
      let runSynthThinking = "";
      let runClusterPrev: ClusterPreview[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.phase === "overview") {
            const r = ev.overview.dateRange;
            const nextOv = {
              total: ev.overview.total,
              span: r.from && r.to ? `${r.from} ~ ${r.to}` : "时间未知",
            };
            runOvStat = nextOv;
            runOverview = ev.overview as Overview;
            setOvStat(nextOv);
            setOverview(ev.overview as Overview);
          } else if (ev.phase === "cluster_thinking") {
            const delta = ev.delta as string;
            runClusterThinking += delta;
            setClusterThinking((s) => s + delta);
          } else if (ev.phase === "clusters") {
            const clusters = ev.clusters as ClusterPreview[];
            runClusterPrev = clusters;
            setClusterPrev(clusters);
            setStage("synth");
          } else if (ev.phase === "synth_thinking") {
            const delta = ev.delta as string;
            runSynthThinking += delta;
            setSynthThinking((s) => s + delta);
          } else if (ev.phase === "done") {
            const seededCache: Partial<Record<Vibe, PersonaProfile>> = {
              [ev.profile.vibe as Vibe]: ev.profile,
            };
            setProfile(ev.profile);
            setRunId(ev.runId);
            // seed 当前 vibe 的成品到缓存，预生成 effect 只算「剩余」vibe（D3）
            setVibeCache(seededCache);
            setPhase("done");
            persistRun({
              runId: ev.runId,
              profile: ev.profile,
              vibeCache: seededCache,
              ovStat: runOvStat,
              overview: runOverview,
              clusterThinking: runClusterThinking,
              synthThinking: runSynthThinking,
              clusterPrev: runClusterPrev,
            });
            finished = true;
          } else if (ev.phase === "error") {
            setErr(ev.message || "生成失败");
            setPhase("idle");
            finished = true;
          }
        }
      }
      if (!finished) {
        setErr("连接中断，请重试。");
        setPhase("idle");
      }
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }

  // 终态出现后立即并发预生成其余 vibe；失败一律静默，不进入主流程错误态。
  // 依赖只列 runId / phase / profile?.vibe —— 这三者一起把「同一次运行」圈住，
  // 避免被无关 state 变化二次触发（D2）。
  useEffect(() => {
    if (phase !== "done" || !runId || !profile) return;
    const missing = VIBES.filter(
      (v) => v !== profile.vibe && !vibeCache[v]
    );
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (v) => {
        try {
          const res = await fetch(`${BASE_PATH}/api/regenerate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ runId, vibe: v }),
          });
          if (!res.ok) return; // rate_limited / busy / budget / expired —— 静默
          const data = (await res.json()) as { profile: PersonaProfile };
          if (cancelled) return;
          // 用 functional updater 避免两个并发 setVibeCache 互相覆盖；
          // persist 放在 updater 内能拿到合并后的最新 vibeCache 写入
          // localStorage（Strict Mode 双调用会重复 persist 同一内容，幂等无害）。
          setVibeCache((c) => {
            const next = { ...c, [v]: data.profile };
            persistRun({
              runId,
              profile,
              vibeCache: next,
              ovStat,
              overview,
              clusterThinking,
              synthThinking,
              clusterPrev,
            });
            return next;
          });
        } catch {
          // 网络错误同样静默
        }
      })
    );
    return () => {
      cancelled = true;
    };
    // vibeCache 故意不进依赖：每次写入会触发 effect 重跑，重跑时 missing 缩小
    // 直至空集自然 return，不会重复发请求；进依赖反而需要额外去重 flag。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, phase, profile?.vibe]);

  async function regenerate(vibe: Vibe) {
    if (!runId) return;
    // 命中预生成缓存：同步替换、不进入 busyVibe、不发请求（D4）
    const hit = vibeCache[vibe];
    if (hit) {
      setProfile(hit);
      setReveal("quick");
      setErr("");
      persistRun({
        runId,
        profile: hit,
        vibeCache,
        ovStat,
        overview,
        clusterThinking,
        synthThinking,
        clusterPrev,
      });
      return;
    }
    setBusyVibe(vibe);
    setErr("");
    try {
      const res = await fetch(`${BASE_PATH}/api/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, vibe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || data.error || "重新生成失败");
        return;
      }
      setProfile(data.profile);
      setReveal("quick");
      // 回填缓存：下次再切回同 vibe 即瞬时（D4 注 2）；persist 放在 updater 内
      // 以拿到合并最新 vibeCache（与预生成 effect 同样的考量）
      setVibeCache((c) => {
        const next = { ...c, [vibe]: data.profile };
        persistRun({
          runId,
          profile: data.profile,
          vibeCache: next,
          ovStat,
          overview,
          clusterThinking,
          synthThinking,
          clusterPrev,
        });
        return next;
      });
    } finally {
      setBusyVibe(null);
    }
  }

  const finished = phase === "done";

  return (
    <main className="wrap">
      <h1>书签人格卡</h1>
      <p className="sub">
        拖入你浏览器导出的书签 HTML，AI 解读你的互联网人格。
      </p>

      {phase === "idle" && (
        <div
          className={"drop" + (over ? " over" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => document.getElementById("fi")?.click()}
        >
          <strong>把书签 HTML 文件拖到这里</strong>
          <div className="hint">或点击选择</div>
          <input
            id="fi"
            type="file"
            accept=".html,text/html"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {phase === "idle" && (
        <details className="export-howto">
          <summary>不知道怎么导出？看各浏览器的方法</summary>
          <ul>
            <li>
              <b>Chromium 系</b>（Chrome / Edge / Brave / Arc 等）：书签管理器 → ⋮ → 导出书签
            </li>
            <li>
              <b>Firefox</b>：书签 → 管理书签 → 导入和备份 → 导出书签为 HTML
            </li>
            <li>
              <b>Safari</b>：文件 → 导出 → 书签
            </li>
          </ul>
        </details>
      )}

      {/* 仅在「全新访客」视图（idle 且无持久化恢复态）展示成品预览：
          数据切片（量化）+ 人格卡画廊（解读）。让访客一眼明白网页能给到什么。
          spec: homepage-samples「与主流程可见性互斥」。 */}
      {phase === "idle" && !profile && (
        <section className="idle-preview">
          <div className="idle-preview-head">
            <span className="idle-preview-eyebrow">上传后大概是这样 ↓</span>
            <h2>把书签变成两种解读</h2>
          </div>
          <DataSlices overview={SAMPLE_OVERVIEW} reveal="none" isSample />
          <SampleGallery />
        </section>
      )}

      {phase !== "idle" && (
        <div className="steps">
          <Step on={!finished} done={finished || phase === "thinking"} label="浏览器内解析书签" />
          <Step
            on={!finished && phase === "thinking" && !ovStat}
            done={finished || !!ovStat}
            label={
              ovStat
                ? `已读取 ${ovStat.total} 条书签 · ${ovStat.span}`
                : "上传结构化条目，计算概览"
            }
          />

          {/* 数据切片：本地零延迟可视化，填补 cluster 阶段 LLM 等待时间。
              spec: homepage-data-slices。reveal 编排见 DataSlices 组件。 */}
          <DataSlices overview={overview} reveal={reveal} />

          <Step
            on={!finished && phase === "thinking" && !!ovStat && clusterPrev.length === 0}
            done={finished || clusterPrev.length > 0}
            label={
              clusterPrev.length > 0
                ? `已聚出 ${clusterPrev.length} 个兴趣簇`
                : "AI 聚类你的兴趣"
            }
          />

          {clusterThinking && (
            <div className="deep-panel">
              <div className="thinking">
                {clusterThinking}
                {!finished && clusterPrev.length === 0 && (
                  <span className="caret">▍</span>
                )}
              </div>
            </div>
          )}

          {!finished &&
            phase === "thinking" &&
            !!ovStat &&
            clusterPrev.length === 0 &&
            clusterIdle && <LoadingHint phrases={CLUSTER_HINTS} />}

          <Step
            on={!finished && stage === "synth"}
            done={finished}
            label="把碎片合成一张人格卡片"
          />

          {synthThinking && (
            <div className="deep-panel">
              <div className="thinking">
                {synthThinking}
                {!finished && stage === "synth" && (
                  <span className="caret">▍</span>
                )}
              </div>
            </div>
          )}

          {!finished && stage === "synth" && synthIdle && (
            <LoadingHint phrases={SYNTH_HINTS} />
          )}

          {clusterPrev.length > 0 && <ClusterChips clusters={clusterPrev} />}
        </div>
      )}

      {note && <p className="note">{note}</p>}
      {err && <p className="err">{err}</p>}

      {phase === "done" && profile && (
        <>
          <PersonaCard
            key={profile.vibe}
            profile={profile}
            reveal={reveal}
            onRevealEnd={() => setReveal("none")}
          />
          <div className={"toolbar" + (reveal === "none" ? "" : ` reveal-${reveal}`)}>
            <div className="toolbar-vibes">
              <span className="vibes-label">换个风格</span>
              <div className="vibes-group">
                {VIBES.map((v) => {
                  const isCurrent = v === profile.vibe;
                  return (
                    <button
                      key={v}
                      className={"btn ghost" + (isCurrent ? " current" : "")}
                      disabled={busyVibe !== null || isCurrent}
                      aria-pressed={isCurrent}
                      onClick={() => regenerate(v)}
                    >
                      {busyVibe === v ? "生成中…" : VIBE_LABEL[v]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function Step({
  on,
  done,
  label,
}: {
  on: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div className={"step" + (done ? " done" : on ? " active" : "")}>
      <span className="dot" />
      {label}
    </div>
  );
}

// agent thinking 流结束、JSON 还在后台生成的静默期占位轮播。
// HINT_IDLE_MS 是判定"停顿"的阈值：文本停止增长超过此时长则切到 hint。
const HINT_IDLE_MS = 1500;
const CLUSTER_HINTS = [
  "正在统计反复出现的站点……",
  "看哪些主题总在你的列表里同框……",
  "把相似话题悄悄靠拢……",
];
const SYNTH_HINTS = [
  "正在归纳主线……",
  "找一个能容下你多重身份的词……",
  "试着写一行能当签名的句子……",
];

function LoadingHint({ phrases }: { phrases: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => (i + 1) % phrases.length),
      2200,
    );
    return () => clearInterval(id);
  }, [phrases.length]);
  // key 跟随 idx 变化触发重挂载，让 CSS 入场动画在每次切换时重新跑。
  return (
    <div className="load-hint">
      <span key={idx} className="load-hint-line">
        {phrases[idx]}
      </span>
    </div>
  );
}

// 兴趣簇标签：按数量降序、"其他"永远置底；视觉权重随占比分三档，
// 避免所有 chip 看起来同样重要导致信息层级缺失。
function ClusterChips({ clusters }: { clusters: ClusterPreview[] }) {
  const isOther = (n: string) => n.startsWith("其他") || n.startsWith("其它");
  const sorted = [...clusters].sort((a, b) => {
    const ao = isOther(a.name) ? 1 : 0;
    const bo = isOther(b.name) ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return b.size - a.size;
  });
  const sizes = sorted.filter((c) => !isOther(c.name)).map((c) => c.size);
  const maxSize = sizes.length ? Math.max(...sizes) : 1;
  const tierOf = (c: ClusterPreview) => {
    if (isOther(c.name)) return "other";
    const r = c.size / maxSize;
    if (r >= 0.7) return "primary";
    if (r >= 0.3) return "secondary";
    return "minor";
  };
  return (
    <div className="cluster-prev">
      {sorted.map((c) => (
        <span key={c.name} className={`chip chip-${tierOf(c)}`}>
          {c.name}
          <i>{c.size}</i>
        </span>
      ))}
    </div>
  );
}

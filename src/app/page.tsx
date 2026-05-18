"use client";
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  parseRawEntries,
  normalizeAndDedupe,
  looksLikeBookmarkExport,
} from "@/lib/bookmarks/parse";
import { stratifiedSample, DEFAULT_MAX_ENTRIES } from "@/lib/bookmarks/sample";
import { VIBES, VIBE_LABEL, type Vibe } from "@/lib/vibes";
import PersonaCard from "@/components/PersonaCard";
import type { PersonaProfile } from "@/lib/agent/schema";

const STORAGE_KEY = "personable:last";
// v2：扩展持久化形态，纳入终态展示的过程档案字段（cluster/deepdive/synth
// 三段思考流 + 簇 chips + fetch chips），让刷新后画面与刷新前一致。v1
// 记录缺这些字段，挂载时按版本不匹配被静默丢弃。
const STORAGE_VERSION = 2 as const;

type PersistedRun = {
  version: typeof STORAGE_VERSION;
  id: string;
  runId: string;
  profile: PersonaProfile;
  vibeCache: Partial<Record<Vibe, { id: string; profile: PersonaProfile }>>;
  ovStat: { total: number; span: string } | null;
  clusterThinking: string;
  thinking: string;
  synthThinking: string;
  clusterPrev: ClusterPreview[];
  fetches: FetchItem[];
};

type Phase = "idle" | "parsing" | "thinking" | "done";

// 渐进式流事件（与 /api/persona NDJSON 对应）
type Stage = "cluster" | "deepdive" | "synth";
interface ClusterPreview {
  name: string;
  size: number;
  domains: string[];
}
interface FetchItem {
  url: string;
  host: string;
  status: "start" | "ok" | "fail";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
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
  const [ids, setIds] = useState<{ id: string; runId: string } | null>(null);
  const [busyVibe, setBusyVibe] = useState<Vibe | null>(null);
  const [copied, setCopied] = useState(false);
  // 后台预生成其余 vibe 的成品，按 vibe 索引；首次定稿 seed 当前 vibe，
  // 命中即瞬时切换，未命中走原 fetch 路径。详见 openspec change
  // 2026-05-18-precompute-vibe-variants（D1）。
  const [vibeCache, setVibeCache] = useState<
    Partial<Record<Vibe, { id: string; profile: PersonaProfile }>>
  >({});
  // 渐进式预览：概览/簇先到，掩盖深挖+合成时延
  const [stage, setStage] = useState<Stage | null>(null);
  const [ovStat, setOvStat] = useState<{ total: number; span: string } | null>(
    null
  );
  const [clusterPrev, setClusterPrev] = useState<ClusterPreview[]>([]);
  // 聚类 / 深挖 / 合成三步分别流式吐思考文本，让用户看到 agent 在干活
  const [clusterThinking, setClusterThinking] = useState("");
  const [thinking, setThinking] = useState("");
  const [synthThinking, setSynthThinking] = useState("");
  const [fetches, setFetches] = useState<FetchItem[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

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
        !parsed.id ||
        !parsed.runId ||
        !parsed.profile
      ) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setProfile(parsed.profile);
      setIds({ id: parsed.id, runId: parsed.runId });
      setVibeCache(parsed.vibeCache ?? {});
      setOvStat(parsed.ovStat ?? null);
      // 过程档案：与卡片并列展示的思考流 / 簇 chips / fetch chips
      setClusterThinking(parsed.clusterThinking ?? "");
      setThinking(parsed.thinking ?? "");
      setSynthThinking(parsed.synthThinking ?? "");
      setClusterPrev(parsed.clusterPrev ?? []);
      setFetches(parsed.fetches ?? []);
      setPhase("done");
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
    setClusterPrev([]);
    setClusterThinking("");
    setThinking("");
    setSynthThinking("");
    setFetches([]);
    setVibeCache({});
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setPhase("parsing");
    try {
      const html = await file.text();
      if (!looksLikeBookmarkExport(html)) {
        setErr("这不像 Chrome「导出书签」生成的 HTML 文件。请用浏览器导出书签后再上传。");
        setPhase("idle");
        return; // 不发起任何网络请求
      }
      const entries = normalizeAndDedupe(parseRawEntries(html));
      if (entries.length === 0) {
        setErr("没解析到任何有效书签。");
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
      const res = await fetch("/api/persona", {
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

      // 渐进式读取 NDJSON：概览 → 簇 → 深挖 → 最终卡片
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      // 本次运行内的局部镜像：闭包里的 React state 不会随 setX 更新，
      // 持久化 done 快照时需要这里的真实累计值（D6.1）。
      let runOvStat: { total: number; span: string } | null = null;
      let runClusterThinking = "";
      let runThinking = "";
      let runSynthThinking = "";
      let runClusterPrev: ClusterPreview[] = [];
      let runFetches: FetchItem[] = [];
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
            setOvStat(nextOv);
          } else if (ev.phase === "cluster_thinking") {
            const delta = ev.delta as string;
            runClusterThinking += delta;
            setClusterThinking((s) => s + delta);
          } else if (ev.phase === "clusters") {
            const clusters = ev.clusters as ClusterPreview[];
            runClusterPrev = clusters;
            setClusterPrev(clusters);
            setStage("deepdive");
          } else if (ev.phase === "deepdive_thinking") {
            const delta = ev.delta as string;
            runThinking += delta;
            setThinking((s) => s + delta);
          } else if (ev.phase === "deepdive_fetch") {
            const url = ev.url as string;
            const status = ev.status as FetchItem["status"];
            // 与 setFetches updater 等价的纯函数计算，写入 runFetches 镜像
            const i = runFetches.findIndex((x) => x.url === url);
            if (i < 0) {
              runFetches = [...runFetches, { url, host: hostOf(url), status }];
            } else {
              runFetches = runFetches.slice();
              runFetches[i] = { ...runFetches[i], status };
            }
            setFetches((arr) => {
              const j = arr.findIndex((x) => x.url === url);
              if (j < 0) return [...arr, { url, host: hostOf(url), status }];
              const next = arr.slice();
              next[j] = { ...next[j], status };
              return next;
            });
          } else if (ev.phase === "deepdive") {
            setStage("synth");
          } else if (ev.phase === "synth_thinking") {
            const delta = ev.delta as string;
            runSynthThinking += delta;
            setSynthThinking((s) => s + delta);
          } else if (ev.phase === "done") {
            const seededCache = {
              [ev.profile.vibe]: { id: ev.id, profile: ev.profile },
            };
            setProfile(ev.profile);
            setIds({ id: ev.id, runId: ev.runId });
            // seed 当前 vibe 的成品到缓存，预生成 effect 只算「剩余」vibe（D3）
            setVibeCache(seededCache);
            setPhase("done");
            persistRun({
              id: ev.id,
              runId: ev.runId,
              profile: ev.profile,
              vibeCache: seededCache,
              ovStat: runOvStat,
              clusterThinking: runClusterThinking,
              thinking: runThinking,
              synthThinking: runSynthThinking,
              clusterPrev: runClusterPrev,
              fetches: runFetches,
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
  // 依赖只列 ids?.runId / phase / profile?.vibe —— 这三者一起把「同一次运行」
  // 圈住，避免被无关 state 变化（如切换 vibe 后 ids.id 变了）二次触发（D2）。
  useEffect(() => {
    if (phase !== "done" || !ids || !profile) return;
    const missing = VIBES.filter(
      (v) => v !== profile.vibe && !vibeCache[v]
    );
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (v) => {
        try {
          const res = await fetch("/api/regenerate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ runId: ids.runId, vibe: v }),
          });
          if (!res.ok) return; // rate_limited / busy / budget / expired —— 静默
          const data = (await res.json()) as {
            id: string;
            profile: PersonaProfile;
          };
          if (cancelled) return;
          // 用 functional updater 避免两个并发 setVibeCache 互相覆盖；
          // persist 放在 updater 内能拿到合并后的最新 vibeCache 写入
          // localStorage（Strict Mode 双调用会重复 persist 同一内容，幂等无害）。
          setVibeCache((c) => {
            const next = { ...c, [v]: { id: data.id, profile: data.profile } };
            persistRun({
              id: ids.id,
              runId: ids.runId,
              profile,
              vibeCache: next,
              ovStat,
              clusterThinking,
              thinking,
              synthThinking,
              clusterPrev,
              fetches,
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
  }, [ids?.runId, phase, profile?.vibe]);

  async function regenerate(vibe: Vibe) {
    if (!ids) return;
    // 命中预生成缓存：同步替换、不进入 busyVibe、不发请求（D4）
    const hit = vibeCache[vibe];
    if (hit) {
      setProfile(hit.profile);
      setIds({ ...ids, id: hit.id });
      setErr("");
      persistRun({
        id: hit.id,
        runId: ids.runId,
        profile: hit.profile,
        vibeCache,
        ovStat,
        clusterThinking,
        thinking,
        synthThinking,
        clusterPrev,
        fetches,
      });
      return;
    }
    setBusyVibe(vibe);
    setErr("");
    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId: ids.runId, vibe }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || data.error || "重新生成失败");
        return;
      }
      setProfile(data.profile);
      setIds({ ...ids, id: data.id }); // 每个风格变体独立分享链接
      // 回填缓存：下次再切回同 vibe 即瞬时（D4 注 2）；persist 放在 updater 内
      // 以拿到合并最新 vibeCache（与预生成 effect 同样的考量）
      setVibeCache((c) => {
        const next = { ...c, [vibe]: { id: data.id, profile: data.profile } };
        persistRun({
          id: data.id,
          runId: ids.runId,
          profile: data.profile,
          vibeCache: next,
          ovStat,
          clusterThinking,
          thinking,
          synthThinking,
          clusterPrev,
          fetches,
        });
        return next;
      });
    } finally {
      setBusyVibe(null);
    }
  }

  async function exportImage() {
    if (!cardRef.current) return;
    const url = await toPng(cardRef.current, { pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = "我的互联网人格卡.png";
    a.click();
  }

  async function copyShare() {
    if (!ids) return;
    const link = `${location.origin}/c/${ids.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 非 HTTPS / 文档失焦 / 权限被拒 —— 写剪贴板会失败。
      // 此时把链接塞进 note，让用户能手动复制。
      setNote("复制失败，请手动复制：" + link);
    }
  }

  const finished = phase === "done";

  return (
    <main className="wrap">
      <h1>书签人格卡</h1>
      <p className="sub">
        拖入你的 Chrome 书签导出文件，AI 解读你的互联网人格，生成一张可分享的卡片。
        文件在浏览器内解析，<b>原始文件不会上传</b>。
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
          <div className="hint">
            或点击选择 · Chrome 书签管理器 → 右上角菜单 → 导出书签
          </div>
          <input
            id="fi"
            type="file"
            accept=".html,text/html"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
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

          <Step
            on={!finished && stage === "deepdive"}
            done={finished || stage === "synth"}
            label={
              finished || stage === "synth"
                ? "深挖完成"
                : "agent 自主决定深挖哪些兴趣"
            }
          />

          {(thinking || fetches.length > 0) && (
            <div className="deep-panel">
              {thinking && (
                <div className="thinking">
                  {thinking}
                  {!finished && stage === "deepdive" && (
                    <span className="caret">▍</span>
                  )}
                </div>
              )}
              {fetches.length > 0 && (
                <div className="fetch-row">
                  {fetches.map((f) => (
                    <span
                      key={f.url}
                      className={"fchip " + f.status}
                      title={f.url}
                    >
                      <span className="fdot" />
                      {f.host}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <Step
            on={!finished && stage === "synth"}
            done={finished}
            label="合成人格 → 生成可分享卡片"
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

          {clusterPrev.length > 0 && (
            <div className="cluster-prev">
              {clusterPrev.map((c) => (
                <span key={c.name} className="chip">
                  {c.name}
                  <i>{c.size}</i>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {note && <p className="note">{note}</p>}
      {err && <p className="err">{err}</p>}

      {phase === "done" && profile && (
        <>
          <PersonaCard profile={profile} innerRef={cardRef} />
          <div className="toolbar">
            <button className="btn" onClick={exportImage}>
              保存为图片
            </button>
            <button className="btn ghost" onClick={copyShare}>
              {copied ? "已复制" : "复制分享链接"}
            </button>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>换个风格：</span>
            {VIBES.map((v) => (
              <button
                key={v}
                className="btn ghost"
                disabled={busyVibe !== null || v === profile.vibe}
                onClick={() => regenerate(v)}
              >
                {busyVibe === v ? "生成中…" : VIBE_LABEL[v]}
              </button>
            ))}
          </div>
          <p className="note">
            <a href="/privacy">数据怎么处理？</a>
          </p>
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

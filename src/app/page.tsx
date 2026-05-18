"use client";
import { useRef, useState } from "react";
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

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [profile, setProfile] = useState<PersonaProfile | null>(null);
  const [ids, setIds] = useState<{ id: string; runId: string } | null>(null);
  const [busyVibe, setBusyVibe] = useState<Vibe | null>(null);
  // 渐进式预览：概览/簇先到，掩盖深挖+合成时延
  const [stage, setStage] = useState<Stage | null>(null);
  const [ovStat, setOvStat] = useState<{ total: number; span: string } | null>(
    null
  );
  const [clusterPrev, setClusterPrev] = useState<ClusterPreview[]>([]);
  // 深挖阶段可见性：agent 推理文本（打字机式）+ 抓取 chip 状态机
  const [thinking, setThinking] = useState("");
  const [fetches, setFetches] = useState<FetchItem[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleFile(file: File) {
    setErr("");
    setNote("");
    setProfile(null);
    setStage(null);
    setOvStat(null);
    setClusterPrev([]);
    setThinking("");
    setFetches([]);
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
            setOvStat({
              total: ev.overview.total,
              span: r.from && r.to ? `${r.from} ~ ${r.to}` : "时间未知",
            });
          } else if (ev.phase === "clusters") {
            setClusterPrev(ev.clusters as ClusterPreview[]);
            setStage("deepdive");
          } else if (ev.phase === "deepdive_thinking") {
            setThinking((s) => s + (ev.delta as string));
          } else if (ev.phase === "deepdive_fetch") {
            const url = ev.url as string;
            const status = ev.status as FetchItem["status"];
            setFetches((arr) => {
              const i = arr.findIndex((x) => x.url === url);
              if (i < 0) return [...arr, { url, host: hostOf(url), status }];
              const next = arr.slice();
              next[i] = { ...next[i], status };
              return next;
            });
          } else if (ev.phase === "deepdive") {
            setStage("synth");
          } else if (ev.phase === "done") {
            setProfile(ev.profile);
            setIds({ id: ev.id, runId: ev.runId });
            setPhase("done");
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

  async function regenerate(vibe: Vibe) {
    if (!ids) return;
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

  function copyShare() {
    if (!ids) return;
    const link = `${location.origin}/c/${ids.id}`;
    navigator.clipboard.writeText(link);
    setNote("分享链接已复制：" + link);
  }

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

      {(phase === "parsing" || phase === "thinking") && (
        <div className="steps">
          <Step on={true} done={phase === "thinking"} label="浏览器内解析书签" />
          <Step
            on={phase === "thinking"}
            done={!!ovStat}
            label={
              ovStat
                ? `已读取 ${ovStat.total} 条书签 · ${ovStat.span}`
                : "上传结构化条目，计算概览"
            }
          />
          <Step
            on={phase === "thinking" && !!ovStat}
            done={clusterPrev.length > 0}
            label={
              clusterPrev.length > 0
                ? `已聚出 ${clusterPrev.length} 个兴趣簇`
                : "AI 聚类你的兴趣"
            }
          />
          <Step
            on={stage === "deepdive"}
            done={stage === "synth"}
            label={
              stage === "synth"
                ? "深挖完成"
                : "agent 自主决定深挖哪些兴趣"
            }
          />

          {(thinking || fetches.length > 0) && (
            <div className="deep-panel">
              {thinking && (
                <div className="thinking">
                  {thinking}
                  {stage === "deepdive" && <span className="caret">▍</span>}
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
            on={stage === "synth"}
            done={false}
            label="合成人格 → 生成可分享卡片"
          />

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
              复制分享链接
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

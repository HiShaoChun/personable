"use client";
// 人格卡渲染。spec: persona-card「人格卡渲染」「人格卡入场动效」。
import { useEffect, type CSSProperties } from "react";
import type { InterestCluster, PersonaProfile } from "@/lib/agent/schema";

// rank 1 → 主线；size ≥ top.size × 0.5 → 副线；否则 → 番外。
// 详见 openspec change 2026-05-18-clusters-vignette-pass（D5）。
function sizeLabel(c: InterestCluster, all: InterestCluster[]): string {
  const top = all[0];
  if (!top || top.size <= 0) return "番外";
  if (c === top) return "主线";
  return c.size / top.size >= 0.5 ? "副线" : "番外";
}

type Reveal = "first" | "quick" | "none";

// reveal=first 上限粗估：翻转600 + 弹跳200 + 元素 stagger（≤480）+ 元素淡入250 ≈ 1530ms。
// reveal=quick：淡入200 + stagger（≤100）+ 元素淡入250 ≈ 550ms。多给一点 buffer。
const REVEAL_DURATION_MS: Record<Exclude<Reveal, "none">, number> = {
  first: 1600,
  quick: 650,
};

export default function PersonaCard({
  profile,
  innerRef,
  reveal = "none",
  onRevealEnd,
}: {
  profile: PersonaProfile;
  innerRef?: React.Ref<HTMLDivElement>;
  reveal?: Reveal;
  onRevealEnd?: () => void;
}) {
  const max = Math.max(1, ...profile.clusters.map((c) => c.size));

  // 入场动效结束后通知父组件（用于把 reveal 由 "first" 切回 "none"，
  // 进而移除 .toolbar.reveal-first 恢复 pointer-events）。
  useEffect(() => {
    if (reveal === "none" || !onRevealEnd) return;
    const t = setTimeout(onRevealEnd, REVEAL_DURATION_MS[reveal]);
    return () => clearTimeout(t);
  }, [reveal, onRevealEnd]);

  const cls = reveal === "none" ? "card" : `card reveal-${reveal}`;
  const elemStyle = (i: number): CSSProperties =>
    ({ ["--delay" as string]: i } as CSSProperties);

  let idx = 0;

  return (
    <div className={cls} ref={innerRef}>
      {reveal === "first" && (
        <div className="card-back" aria-hidden="true">
          <span className="card-back-mark">人格卡</span>
        </div>
      )}
      <div className="card-face">
        <h2 className="card-elem" style={elemStyle(idx++)}>
          {profile.headline}
        </h2>

        <div className="tags card-elem" style={elemStyle(idx++)}>
          {profile.traits.map((t, i) => (
            <span className="tag" key={i}>
              {t}
            </span>
          ))}
        </div>

        {profile.clusters.map((c, i) => (
          <div className="cluster card-elem" key={i} style={elemStyle(idx++)}>
            <div className="row">
              <span>{c.name}</span>
              <span className="rank">{sizeLabel(c, profile.clusters)}</span>
            </div>
            <div
              className="bar"
              style={{ width: `${Math.round((c.size / max) * 100)}%` }}
            />
          </div>
        ))}

        {profile.otherInterests && profile.otherInterests.length > 0 && (
          <div className="others card-elem" style={elemStyle(idx++)}>
            其他散点：{profile.otherInterests.join("、")}
          </div>
        )}

        {profile.evolution.length > 0 && (
          <div className="evo card-elem" style={elemStyle(idx++)}>
            {profile.evolution.map((e, i) => (
              <div key={i}>
                <b>{e.period}</b> — {e.summary}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

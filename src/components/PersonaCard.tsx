"use client";
// 人格卡渲染。spec: persona-card「人格卡渲染」「人格卡入场动效」。
import { useEffect, type CSSProperties } from "react";
import type { InterestCluster, PersonaProfile } from "@/lib/agent/schema";

// rank 1 → main；size ≥ top.size × 0.5 → side；否则 → extra。
// 详见 openspec change 2026-05-18-clusters-vignette-pass（D5）。
// 英文 key 供 className 用，TIER_LABEL 映射回中文。openspec change
// persona-card-signature-and-visual-tiers Decision 3。
type StorylineTier = "main" | "side" | "extra";

function storylineTier(c: InterestCluster, all: InterestCluster[]): StorylineTier {
  const top = all[0];
  if (!top || top.size <= 0) return "extra";
  if (c === top) return "main";
  return c.size / top.size >= 0.5 ? "side" : "extra";
}

const TIER_LABEL: Record<StorylineTier, string> = {
  main: "主线",
  side: "副线",
  extra: "番外",
};

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

        {profile.signatureQuote && (
          <p className="quote card-elem" style={elemStyle(idx++)}>
            「{profile.signatureQuote}」
          </p>
        )}

        <div className="tags card-elem" style={elemStyle(idx++)}>
          {profile.traits.map((t, i) => (
            <span className="tag" key={i}>
              {t}
            </span>
          ))}
        </div>

        {profile.clusters.map((c, i) => {
          const tier = storylineTier(c, profile.clusters);
          return (
            <div className="cluster card-elem" key={i} style={elemStyle(idx++)}>
              <div className="row">
                <span>{c.name}</span>
                <span className={`rank rank--${tier}`}>{TIER_LABEL[tier]}</span>
              </div>
              <div
                className={`bar bar--${tier}`}
                style={{ width: `${Math.round((c.size / max) * 100)}%` }}
              />
            </div>
          );
        })}

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

"use client";
// 首页 idle 态预制示例画廊：以扇形展开三张 PersonaCard 缩略，
// 点击任意一张则该卡前移高亮、并在画廊下方原尺寸渲染。
// spec: homepage-samples「首页示例画廊 / 缩略展示与展开交互」。
import { useState } from "react";
import PersonaCard from "@/components/PersonaCard";
import { SAMPLE_PROFILES } from "@/lib/samples";
import { VIBE_LABEL, type Vibe } from "@/lib/vibes";

export default function SampleGallery() {
  // null = 扇形全部缩略；非 null = 该 vibe 对应卡前移并在下方展开。
  const [selected, setSelected] = useState<Vibe | null>(null);

  const expanded = selected
    ? SAMPLE_PROFILES.find((p) => p.vibe === selected)
    : null;

  return (
    <section className="samples">
      <div className="samples-head">
        <h3>同一份书签，三种解读</h3>
      </div>

      <div className="samples-fan">
        {SAMPLE_PROFILES.map((p, i) => {
          const isSelected = selected === p.vibe;
          return (
            <button
              key={p.vibe}
              type="button"
              className={`fan-card fan-card-${i}${isSelected ? " selected" : ""}`}
              onClick={() => setSelected(isSelected ? null : p.vibe)}
              aria-pressed={isSelected}
              aria-label={`${VIBE_LABEL[p.vibe]}风格示例：${p.headline}`}
            >
              <span className="fan-vibe">{VIBE_LABEL[p.vibe]}</span>
              <div className="fan-card-inner">
                <div className="fan-card-scale">
                  <PersonaCard profile={p} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="samples-hint">点一张卡片看完整版</p>

      {expanded && (
        <div className="sample-expanded">
          <PersonaCard profile={expanded} />
        </div>
      )}
    </section>
  );
}

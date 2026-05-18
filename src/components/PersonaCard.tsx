// 人格卡渲染。spec: persona-card「人格卡渲染」（特质 + 带相对规模的簇 + 演变 + 固定免责声明）。
import type { PersonaProfile } from "@/lib/agent/schema";

export default function PersonaCard({
  profile,
  innerRef,
}: {
  profile: PersonaProfile;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const max = Math.max(1, ...profile.clusters.map((c) => c.size));
  return (
    <div className="card" ref={innerRef}>
      <h2>{profile.headline}</h2>

      <div className="tags">
        {profile.traits.map((t, i) => (
          <span className="tag" key={i}>
            {t}
          </span>
        ))}
      </div>

      {profile.clusters.map((c, i) => (
        <div className="cluster" key={i}>
          <div className="row">
            <span>{c.name}</span>
            <span style={{ color: "var(--muted)" }}>{c.size}</span>
          </div>
          <div
            className="bar"
            style={{ width: `${Math.round((c.size / max) * 100)}%` }}
          />
          {c.blurb && <div className="blurb">{c.blurb}</div>}
        </div>
      ))}

      {profile.otherInterests && profile.otherInterests.length > 0 && (
        <div className="others">
          其他散点：{profile.otherInterests.join("、")}
        </div>
      )}

      {profile.evolution.length > 0 && (
        <div className="evo">
          {profile.evolution.map((e, i) => (
            <div key={i}>
              <b>{e.period}</b> — {e.summary}
            </div>
          ))}
        </div>
      )}

      <div className="disc">{profile.disclaimer}</div>
    </div>
  );
}

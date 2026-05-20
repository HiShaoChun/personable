// 人格卡渲染。spec: persona-card「人格卡渲染」（特质 + 带相对规模的簇 + 演变 + 固定免责声明）。
import type { InterestCluster, PersonaProfile } from "@/lib/agent/schema";

// rank 1 → 主线；size ≥ top.size × 0.5 → 副线；否则 → 番外。
// 详见 openspec change 2026-05-18-clusters-vignette-pass（D5）。
function sizeLabel(c: InterestCluster, all: InterestCluster[]): string {
  const top = all[0];
  if (!top || top.size <= 0) return "番外";
  if (c === top) return "主线";
  return c.size / top.size >= 0.5 ? "副线" : "番外";
}

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
            <span className="rank">{sizeLabel(c, profile.clusters)}</span>
          </div>
          <div
            className="bar"
            style={{ width: `${Math.round((c.size / max) * 100)}%` }}
          />
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

      {profile.disclaimer && <div className="disc">{profile.disclaimer}</div>}
    </div>
  );
}

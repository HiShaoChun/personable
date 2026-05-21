// ② 主题漂移图：每年一列 × ≤3 主题词 chip，相邻列同名词以斜线相连。
// 斜率折射该词在年度 top 列表的排名变化；只在某一年出现的词不连线（即"那年
// 的新角色"）。spec: homepage-data-slices「主题词漂移图」。
import type { Overview } from "@/lib/agent/overview";

interface Props {
  phases: Overview["identityPhases"];
}

function shortFolder(path: string): string {
  const segs = path.split(" / ").filter(Boolean);
  return segs[segs.length - 1] ?? "";
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const COL_W = 100;
const HEAD_H = 22;
const ROW_H = 28;
const ROW_GAP = 6;

export default function TopicDrift({ phases }: Props) {
  if (phases.length < 2) return null;

  const cols = phases.length;
  const W = cols * COL_W;
  const H = HEAD_H + 3 * (ROW_H + ROW_GAP);

  // word → [{col, slot, full}]：用末段词作 key，full 保留完整路径供 hover
  const positions: Record<string, Array<{ col: number; slot: number; full: string }>> = {};
  phases.forEach((p, col) => {
    p.topFolders.slice(0, 3).forEach((path, slot) => {
      const word = shortFolder(path);
      if (!word) return;
      if (!positions[word]) positions[word] = [];
      positions[word].push({ col, slot, full: path });
    });
  });

  function chipCenter(col: number, slot: number) {
    return {
      x: col * COL_W + COL_W / 2,
      y: HEAD_H + slot * (ROW_H + ROW_GAP) + ROW_H / 2,
    };
  }

  // 相邻列同名词连线：从左 chip 右边缘到右 chip 左边缘
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; word: string }> = [];
  Object.entries(positions).forEach(([word, pos]) => {
    for (let i = 0; i < pos.length - 1; i++) {
      const a = pos[i];
      const b = pos[i + 1];
      if (b.col !== a.col + 1) continue;
      const ca = chipCenter(a.col, a.slot);
      const cb = chipCenter(b.col, b.slot);
      lines.push({
        x1: ca.x + COL_W * 0.35,
        y1: ca.y,
        x2: cb.x - COL_W * 0.35,
        y2: cb.y,
        word,
      });
    }
  });

  // 哪些词跨过 ≥ 2 年（用于 chip 高亮）
  const carriedWords = new Set(
    Object.entries(positions)
      .filter(([, pos]) => pos.length >= 2)
      .map(([w]) => w)
  );

  return (
    <div className="topic-drift">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`主题漂移：${cols} 年`}
      >
        {/* 年份表头 */}
        {phases.map((p, col) => (
          <text
            key={p.period}
            x={col * COL_W + COL_W / 2}
            y={HEAD_H - 6}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="var(--ink)"
          >
            {p.period}
          </text>
        ))}
        {/* 连线层（先画，落在 chip 下方） */}
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="var(--accent2)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
        ))}
        {/* chips */}
        {phases.map((p, col) =>
          p.topFolders.slice(0, 3).map((path, slot) => {
            const word = shortFolder(path);
            if (!word) return null;
            const carried = carriedWords.has(word);
            const cx = col * COL_W + COL_W / 2;
            const cy = HEAD_H + slot * (ROW_H + ROW_GAP);
            const chipW = COL_W * 0.74;
            const chipH = ROW_H;
            const x = cx - chipW / 2;
            const display = truncate(word, 6);
            return (
              <g key={`${col}-${slot}`}>
                <title>
                  {`${p.period}（${p.total} 条）\n${path}`}
                </title>
                <rect
                  x={x}
                  y={cy}
                  width={chipW}
                  height={chipH}
                  rx="6"
                  ry="6"
                  fill={carried ? "rgba(25, 211, 197, 0.18)" : "rgba(255, 255, 255, 0.04)"}
                  stroke={carried ? "rgba(25, 211, 197, 0.55)" : "#3a3f55"}
                  strokeWidth="1"
                />
                <text
                  x={cx}
                  y={cy + chipH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill={carried ? "var(--ink)" : "var(--muted)"}
                >
                  {display}
                </text>
              </g>
            );
          })
        )}
      </svg>
      <div className="topic-drift-foot">
        <span className="topic-legend topic-legend-carried" />延续
        <span className="topic-legend topic-legend-once" />仅一年
      </div>
    </div>
  );
}

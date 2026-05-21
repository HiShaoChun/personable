// ① 收藏时段柱：5 段横向占比条。spec: homepage-data-slices「收藏时段柱」。
// 数据来源 rhythm.bucketShares（已在 overview 一次扫描内算好）。
// datedCount === 0 时整图省略。
import type { Overview } from "@/lib/agent/overview";

interface Props {
  rhythm: Overview["rhythm"];
}

const ORDER: Array<Overview["rhythm"]["hourBucket"]> = [
  "深夜",
  "凌晨",
  "上午",
  "下午",
  "晚间",
];

// 副标提示：哪段是峰值——直接给可信信号，避免用户费力对比
const HINT: Record<Overview["rhythm"]["hourBucket"], string> = {
  深夜: "0–3 点",
  凌晨: "4–7 点",
  上午: "8–11 点",
  下午: "12–17 点",
  晚间: "18–23 点",
};

export default function TimeOfDayBars({ rhythm }: Props) {
  if (rhythm.datedCount === 0) return null;
  // 防御性：localStorage 历史数据可能没有 bucketShares（v4→v5 之前的快照）。
  // 主路径已通过 STORAGE_VERSION bump 让旧记录被静默丢弃，但若任何路径
  // 残留旧形态对象，直接省略本图而非崩溃。
  if (!rhythm.bucketShares) return null;
  const peak = rhythm.hourBucket;
  const weekendPct = Math.round(rhythm.weekendShare * 100);

  return (
    <div className="time-bars">
      {ORDER.map((b) => {
        const share = rhythm.bucketShares[b];
        const widthPct = Math.max(2, share * 100);
        const pct = Math.round(share * 100);
        const isPeak = b === peak;
        return (
          <div
            key={b}
            className={"time-bar-row" + (isPeak ? " is-peak" : "")}
          >
            <span className="time-bar-label">
              {b}
              <i>{HINT[b]}</i>
            </span>
            <div className="time-bar-track">
              <div
                className={"time-bar-fill" + (isPeak ? " is-peak" : "")}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="time-bar-pct">{pct}%</span>
          </div>
        );
      })}
      <div className="time-bars-foot">
        其中周末占 {weekendPct}%
      </div>
    </div>
  );
}

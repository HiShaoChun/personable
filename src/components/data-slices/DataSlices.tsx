// 「你的数据切片」容器组件。spec: homepage-data-slices。
// 4 张图各自判定降级；4 张全省略时容器也返回 null。
// reveal 编排：容器淡入 + 4 子节点错峰（200/500/800/1100ms）。
// reveal === "none" 时跳过动画（localStorage 恢复路径不重播）。
//
// 修订（2026-05-21）：4 张图全部走 SliceFrame 包裹，标题/副说明集中维护。
import type { Overview } from "@/lib/agent/overview";
import SliceFrame from "./SliceFrame";
import TimeOfDayBars from "./TimeOfDayBars";
import TopicDrift from "./TopicDrift";
import BingeDaysSpotlight from "./BingeDaysSpotlight";
import ConcentrationBar from "./ConcentrationBar";

interface Props {
  overview: Overview | null;
  reveal: "first" | "quick" | "none";
}

const DELAYS_FIRST = [200, 500, 800, 1100];
const DELAYS_QUICK = [80, 160, 240, 320];

export default function DataSlices({ overview, reveal }: Props) {
  if (!overview) return null;

  const showTimeBars = overview.rhythm.datedCount > 0;
  const showDrift = overview.identityPhases.length >= 2;
  const showBinge = overview.bingeDays.length >= 1;
  const showConc = overview.total > 0;

  if (!showTimeBars && !showDrift && !showBinge && !showConc) return null;

  const delays = reveal === "first" ? DELAYS_FIRST : reveal === "quick" ? DELAYS_QUICK : null;
  const tiles: { key: string; title: string; subtitle: string; node: React.ReactNode }[] = [];

  if (showTimeBars) {
    tiles.push({
      key: "time",
      title: "收藏时段",
      subtitle: "这一天里，你什么时候在收藏",
      node: <TimeOfDayBars rhythm={overview.rhythm} />,
    });
  }
  if (showDrift) {
    tiles.push({
      key: "drift",
      title: "主题漂移",
      subtitle: "跨年还在的词 vs 新冒出的词",
      node: <TopicDrift phases={overview.identityPhases} />,
    });
  }
  if (showBinge) {
    tiles.push({
      key: "binge",
      title: "突击收藏日",
      subtitle: "单日 ≥ 3 条",
      node: <BingeDaysSpotlight bingeDays={overview.bingeDays} />,
    });
  }
  if (showConc) {
    tiles.push({
      key: "conc",
      title: "注意力分布",
      subtitle: "书签是堆在几个老地方，还是撒得到处都是",
      node: (
        <ConcentrationBar
          concentration={overview.concentration}
          total={overview.total}
        />
      ),
    });
  }

  return (
    <div
      className={
        "data-slices" + (reveal !== "none" ? ` reveal-${reveal}` : "")
      }
    >
      <div className="data-slices-title">
        <strong>你的数据切片</strong>
      </div>
      <div className="data-slices-grid">
        {tiles.map((t, i) => (
          <div
            key={t.key}
            className="data-slice"
            style={
              delays
                ? { animationDelay: `${delays[i] ?? 0}ms` }
                : undefined
            }
          >
            <SliceFrame title={t.title} subtitle={t.subtitle}>
              {t.node}
            </SliceFrame>
          </div>
        ))}
      </div>
    </div>
  );
}

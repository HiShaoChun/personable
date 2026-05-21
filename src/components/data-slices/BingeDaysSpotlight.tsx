// ③ 突击收藏日：spotlight 卡片，1 号位放大、2/3 号位并排在右。
// spec: homepage-data-slices「突击收藏日」。
// 修订（2026-05-21）：删除原"一个深夜囤了 N 个"——那里用了全局 hourBucket
// 套到单日，违反「描述句基于自身数据点」硬规则；改为日期 + 星期（从 date
// 字符串直推，可信）。`(无文件夹)` → `未分类`。
import type { Overview } from "@/lib/agent/overview";

interface Props {
  bingeDays: Overview["bingeDays"];
}

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function weekdayOf(dateStr: string): string {
  // dateStr 形如 "2024-10-15"，按 UTC 解析，避开本地时区漂移。这是 overview
  // 那边按 UTC+8 算出来的日期字符串，转回 Date 用 UTC 与之自洽。
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  return WEEKDAY_NAMES[dow] ?? "";
}

function displayFolder(f: string): string {
  if (!f || f === "(无文件夹)") return "未分类";
  return f;
}

export default function BingeDaysSpotlight({ bingeDays }: Props) {
  if (bingeDays.length === 0) return null;
  const [first, ...rest] = bingeDays;
  const firstWeekday = weekdayOf(first.date);
  const firstFolder = displayFolder(first.topFolder);

  return (
    <div className="binge-days" data-count={bingeDays.length === 1 ? "1" : "many"}>
      <div className="binge-card binge-card-1" title={`${first.date}（${firstWeekday}）· ${first.count} 条 · ${firstFolder}`}>
        <div className="binge-date">{first.date}</div>
        <div className="binge-weekday">{firstWeekday}</div>
        <div className="binge-meta">
          <span className="binge-count">{first.count} 条</span>
          <span className="binge-folder">{firstFolder}</span>
        </div>
      </div>
      {rest.length > 0 && (
        <div className="binge-card-rest">
          {rest.map((d) => {
            const wd = weekdayOf(d.date);
            const folder = displayFolder(d.topFolder);
            return (
              <div
                key={d.date}
                className="binge-card"
                title={`${d.date}（${wd}）· ${d.count} 条 · ${folder}`}
              >
                <div className="binge-date-row">
                  <span className="binge-date">{d.date}</span>
                  <span className="binge-weekday">{wd}</span>
                </div>
                <div className="binge-meta">
                  <span className="binge-count">{d.count} 条</span>
                  <span className="binge-folder">{folder}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

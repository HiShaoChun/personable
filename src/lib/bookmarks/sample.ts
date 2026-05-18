// 分层下采样：超上限时按 域名 + 时间桶 分层抽样，保持分布有代表性。
// 确定性（同输入同输出），不依赖 process.env，客户端可用。
import type { BookmarkEntry } from "./types";

// 客户端默认上限；服务端会用 config.maxBookmarkEntries 再权威性地强制一次。
export const DEFAULT_MAX_ENTRIES = 800;

function stratumKey(e: BookmarkEntry): string {
  const yearBucket = e.addDate
    ? new Date(e.addDate * 1000).getUTCFullYear()
    : "na";
  return `${e.domain}|${yearBucket}`;
}

/** 返回 <= cap 条的代表性子集。<= cap 时原样返回。 */
export function stratifiedSample(
  entries: BookmarkEntry[],
  cap: number
): { sample: BookmarkEntry[]; sampled: boolean } {
  if (entries.length <= cap) return { sample: entries, sampled: false };

  // 按层分组
  const strata = new Map<string, BookmarkEntry[]>();
  for (const e of entries) {
    const k = stratumKey(e);
    (strata.get(k) ?? strata.set(k, []).get(k)!).push(e);
  }

  // 每层按比例配额（至少 1），round-robin 取，保证分布
  const total = entries.length;
  const picked: BookmarkEntry[] = [];
  const groups = [...strata.values()].sort((a, b) => b.length - a.length);
  const quotas = groups.map((g) =>
    Math.max(1, Math.round((g.length / total) * cap))
  );

  let round = 0;
  while (picked.length < cap) {
    let progressed = false;
    for (let i = 0; i < groups.length && picked.length < cap; i++) {
      if (round < quotas[i] && round < groups[i].length) {
        picked.push(groups[i][round]);
        progressed = true;
      }
    }
    if (!progressed) break;
    round++;
  }
  return { sample: picked.slice(0, cap), sampled: true };
}

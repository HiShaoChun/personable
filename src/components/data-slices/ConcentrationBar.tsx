// ④ 注意力分布横条：水平轨道 + 滑块。滑块 x 位置 = (1 - gini)，越靠右越分散。
// spec: homepage-data-slices「注意力分布横条」。
// 修订（2026-05-21）：原半圆 gauge 含 gini 数值 + 「广撒网/均衡/死忠粉」三档
// 标签——术语 + 价值判断都不友好。本版改为左右两端标签的连续横条，隐藏 gini，
// 只显示 top5 占比。
import type { Overview } from "@/lib/agent/overview";

interface Props {
  concentration: Overview["concentration"];
  total: number;
}

export default function ConcentrationBar({ concentration, total }: Props) {
  if (total <= 0) return null;
  const { gini, top5Share } = concentration;
  // 滑块位置：gini 高 → 集中 → 滑块靠左；用 (1 - gini) 让"越右越分散"。
  // 上下夹到 [0.04, 0.96] 避免触端遮挡两侧标签
  const pos = Math.max(0.04, Math.min(0.96, 1 - gini));

  return (
    <div className="conc-bar">
      <div className="conc-bar-track">
        <div className="conc-bar-fill" />
        <div
          className="conc-bar-thumb"
          style={{ left: `${pos * 100}%` }}
        >
          <div className="conc-bar-thumb-dot" />
        </div>
      </div>
      <div className="conc-bar-ends">
        <span>几个站霸屏</span>
        <span>分散到很多站</span>
      </div>
      <div className="conc-bar-meta">
        前 5 个域名占 {Math.round(top5Share * 100)}%
      </div>
    </div>
  );
}

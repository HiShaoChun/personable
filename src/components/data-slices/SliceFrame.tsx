// 数据切片统一外壳：H4 标题 + 一行白话副说明 + body。
// spec: homepage-data-slices「表达硬规则」。每张图必须用此组件包裹，集中维护
// 文案，避免标题散落到各 chart 组件内。
import type { ReactNode } from "react";

interface Props {
  title: string; // ≤ 6 字
  subtitle: string; // ≤ 18 字白话
  children: ReactNode;
}

export default function SliceFrame({ title, subtitle, children }: Props) {
  return (
    <>
      <div className="slice-head">
        <h4>{title}</h4>
        <p>{subtitle}</p>
      </div>
      <div className="slice-body">{children}</div>
    </>
  );
}

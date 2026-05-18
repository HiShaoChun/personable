import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "书签人格卡 · 你的互联网人格",
  description: "拖入 Chrome 书签，AI 解读你的互联网人格，生成一张可分享的卡片。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

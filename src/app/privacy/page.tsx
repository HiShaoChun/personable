// 数据处理透明声明。spec: api-safeguards「数据处理透明」。
import Link from "next/link";
import { config } from "@/config";

export const dynamic = "force-dynamic";

export default function Privacy() {
  return (
    <main className="wrap">
      <h1>数据怎么处理</h1>
      <ul className="sub" style={{ lineHeight: 2, paddingLeft: 18 }}>
        <li>
          你的<b>原始书签 HTML 文件绝不离开浏览器</b>——解析完全在本地完成。
        </li>
        <li>
          只有派生的结构化条目（标题、域名、文件夹名、添加时间）会<b>瞬态</b>
          发送到服务端用于本次分析，分析结束即丢弃，不落库。
        </li>
        <li>
          只有最终生成的<b>人格画像</b>会被存储，用于分享链接，保留
          <b> {config.cardTtlDays} 天</b>后自动删除。
        </li>
        <li>分享链接为不可猜测的随机 ID，仅知道链接的人可访问，无公开列表。</li>
      </ul>
      <p className="note" style={{ marginTop: 24 }}>
        <Link href="/">← 返回</Link>
      </p>
    </main>
  );
}

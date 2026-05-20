// 分享卡路由。spec: persona-card「分享链接落地页布局」「仅基于派生数据的分享链接」。
import Link from "next/link";
import { getCard } from "@/lib/store";
import { config } from "@/config";
import type { PersonaProfile } from "@/lib/agent/schema";
import PersonaCard from "@/components/PersonaCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 时间标文案：访客面对一张陌生卡需要时间锚，按天粒度足够（分享语义不需要小时级）。
// ≥30 天理论上不会出现（TTL 默认 7 天），兜底为「30+ 天前生成」防御性显示。
function relativeDayLabel(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days <= 0) return "今天生成";
  if (days >= 30) return "30+ 天前生成";
  return `${days} 天前生成`;
}

export default async function SharedCard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = getCard(id);

  if (!row) {
    return (
      <main className="wrap">
        <h1>这张卡片已过期或不存在</h1>
        <p className="sub">分享链接保留 {config.cardTtlDays} 天，过期后会自动清理。</p>
        <div className="toolbar" style={{ marginTop: 24 }}>
          <Link href="/" className="btn">
            生成你自己的人格卡 →
          </Link>
        </div>
      </main>
    );
  }

  const profile = JSON.parse(row.profile) as PersonaProfile;
  return (
    <main className="wrap">
      <h1>{profile.headline}</h1>
      <p className="sub">AI 根据浏览器书签生成的互联网兴趣切片，仅供娱乐。</p>
      {row.createdAt !== null && (
        <p className="note" style={{ marginTop: 4 }}>{relativeDayLabel(row.createdAt)}</p>
      )}
      <PersonaCard profile={profile} reveal="none" />
      <div className="toolbar" style={{ marginTop: 20 }}>
        <Link href="/" className="btn">
          生成你自己的人格卡 →
        </Link>
      </div>
    </main>
  );
}

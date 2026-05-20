// 分享卡路由。spec: persona-card「分享链接落地页布局」「仅基于派生数据的分享链接」。
import Link from "next/link";
import { getCard } from "@/lib/store";
import { config } from "@/config";
import type { PersonaProfile } from "@/lib/agent/schema";
import PersonaCard from "@/components/PersonaCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      <PersonaCard profile={profile} reveal="none" />
      <div className="toolbar" style={{ marginTop: 20 }}>
        <Link href="/" className="btn">
          生成你自己的人格卡 →
        </Link>
      </div>
    </main>
  );
}

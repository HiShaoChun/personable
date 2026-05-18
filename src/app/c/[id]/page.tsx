// 分享卡路由。spec: persona-card「创建并打开分享链接」「过期或未知链接」。
import Link from "next/link";
import { getCard } from "@/lib/store";
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
  const json = getCard(id);

  if (!json) {
    return (
      <main className="wrap">
        <h1>这张卡片已过期或不存在</h1>
        <p className="sub">
          分享卡只保留有限时间。你可以
          <Link href="/"> 生成一张属于自己的</Link>。
        </p>
      </main>
    );
  }

  const profile = JSON.parse(json) as PersonaProfile;
  return (
    <main className="wrap">
      <h1>一张互联网人格卡</h1>
      <p className="sub">由书签人格卡生成。</p>
      <PersonaCard profile={profile} />
      <p className="note" style={{ marginTop: 20 }}>
        <Link href="/">→ 拖入你自己的书签，生成你的人格卡</Link>
      </p>
    </main>
  );
}

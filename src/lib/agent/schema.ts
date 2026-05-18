// 画像输出 schema + 校验器。spec: persona-agent「结构化画像输出」。
import type { Vibe } from "@/config";

export interface InterestCluster {
  name: string; // 命名兴趣簇
  size: number; // 该簇书签条数（相对规模）
  blurb: string; // 一句话刻画
  domains: string[]; // 代表域名
}

export interface PersonaProfile {
  vibe: Vibe;
  headline: string; // 卡片大标题
  traits: string[]; // 3-7 条人格特质
  clusters: InterestCluster[]; // 命名兴趣簇（按 size 降序）
  evolution: { period: string; summary: string }[]; // 按时间排序的兴趣演变
  disclaimer: string; // 固定免责声明
}

export const DISCLAIMER =
  "本卡片由 AI 依据你导出的书签生成，仅供娱乐，不代表对你的真实判断。";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateProfile(p: unknown): ValidationResult {
  const errors: string[] = [];
  const o = p as Record<string, unknown>;
  if (!o || typeof o !== "object") return { ok: false, errors: ["不是对象"] };

  if (typeof o.headline !== "string" || !o.headline.trim())
    errors.push("headline 缺失");

  const traits = o.traits;
  if (!Array.isArray(traits) || traits.length < 3 || traits.length > 7)
    errors.push("traits 数量需为 3-7 条");

  const clusters = o.clusters as unknown[];
  if (!Array.isArray(clusters) || clusters.length === 0) {
    errors.push("clusters 缺失");
  } else {
    clusters.forEach((c, i) => {
      const cc = c as Record<string, unknown>;
      if (typeof cc.name !== "string" || !cc.name.trim())
        errors.push(`clusters[${i}].name 缺失`);
      if (typeof cc.size !== "number" || cc.size < 0)
        errors.push(`clusters[${i}].size 非法`);
    });
  }

  const evo = o.evolution;
  if (!Array.isArray(evo) || evo.length === 0)
    errors.push("evolution 缺失");

  return { ok: errors.length === 0, errors };
}

/** 把模型输出归一为完整 PersonaProfile（补 disclaimer、排序、裁剪 traits）。 */
export function normalizeProfile(
  raw: Record<string, unknown>,
  vibe: Vibe
): PersonaProfile {
  const clusters = (Array.isArray(raw.clusters) ? raw.clusters : [])
    .map((c) => {
      const cc = c as Record<string, unknown>;
      return {
        name: String(cc.name ?? "未命名"),
        size: Number(cc.size ?? 0),
        blurb: String(cc.blurb ?? ""),
        domains: Array.isArray(cc.domains) ? cc.domains.map(String).slice(0, 6) : [],
      };
    })
    .sort((a, b) => b.size - a.size);

  return {
    vibe,
    headline: String(raw.headline ?? "你的互联网人格"),
    traits: (Array.isArray(raw.traits) ? raw.traits : []).map(String).slice(0, 7),
    clusters,
    evolution: (Array.isArray(raw.evolution) ? raw.evolution : []).map((e) => {
      const ee = e as Record<string, unknown>;
      return { period: String(ee.period ?? ""), summary: String(ee.summary ?? "") };
    }),
    disclaimer: DISCLAIMER,
  };
}

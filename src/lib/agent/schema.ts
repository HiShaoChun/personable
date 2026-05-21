// 画像输出 schema + 校验器。spec: persona-agent「结构化画像输出」。
import type { Vibe } from "@/config";

export interface InterestCluster {
  name: string; // 命名兴趣簇
  size: number; // 该簇书签条数（相对规模）
  domains: string[]; // 代表域名
}

export interface PersonaProfile {
  vibe: Vibe;
  headline: string; // 卡片大标题
  signatureQuote?: string; // 可选签名台词（≤28 字），随 vibe 风格生成；缺失即不渲染
  traits: string[]; // 3-5 条人格特质
  clusters: InterestCluster[]; // 命名兴趣簇（按 size 降序，硬阈值 + top 5 过滤后）
  // 被硬阈值或软上限剔除的簇 name，按原 size 降序。无被剔除项时省略字段。
  otherInterests?: string[];
  evolution: { period: string; summary: string }[]; // 按时间排序的兴趣演变
}

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

  // signatureQuote 可选：仅在「存在但类型不对」时报错。空串合法（normalize 阶段丢弃）。
  if ("signatureQuote" in o && o.signatureQuote != null && typeof o.signatureQuote !== "string")
    errors.push("signatureQuote 需为字符串");

  const traits = o.traits;
  if (!Array.isArray(traits) || traits.length < 3 || traits.length > 5) {
    errors.push("traits 数量需为 3-5 条");
  } else {
    traits.forEach((t, i) => {
      if (typeof t !== "string" || [...t].length > 8)
        errors.push(`traits[${i}] 需为 ≤8 字的短标签`);
    });
  }

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

// trait 防御式清洗：切冒号、去末尾标点、限长 8 字。详见 openspec change
// 2026-05-18-traits-as-chips-drop-blurb（D2）。
function cleanTrait(s: unknown): string {
  let t = String(s ?? "").trim();
  const ci = t.search(/[：:]/);
  if (ci >= 0) t = t.slice(0, ci).trim();
  t = t.replace(/[。、，,．.\s]+$/g, "");
  const chars = [...t];
  if (chars.length > 8) t = chars.slice(0, 8).join("");
  return t;
}

// 签名台词清洗：trim、剥首尾引号、按 codepoint 截至 28。空 / 非串输入返回 ""。
function cleanSignatureQuote(s: unknown): string {
  if (s == null) return "";
  let t = String(s).trim();
  if (!t) return "";
  t = t.replace(/^["'“”‘’「『]+/, "").replace(/["'“”‘’」』]+$/, "").trim();
  const chars = [...t];
  if (chars.length > 28) t = chars.slice(0, 28).join("");
  return t;
}

/** 把模型输出归一为完整 PersonaProfile（排序、裁剪 traits、密度治理）。 */
export function normalizeProfile(
  raw: Record<string, unknown>,
  vibe: Vibe
): PersonaProfile {
  const allClusters = (Array.isArray(raw.clusters) ? raw.clusters : [])
    .map((c) => {
      const cc = c as Record<string, unknown>;
      return {
        name: String(cc.name ?? "未命名"),
        size: Number(cc.size ?? 0),
        domains: Array.isArray(cc.domains) ? cc.domains.map(String).slice(0, 6) : [],
      };
    })
    .sort((a, b) => b.size - a.size);

  // 密度治理：硬阈值 max(3, ceil(total * 5%)) + 软上限 top 5。
  // 详见 openspec change 2026-05-18-trim-card-density（D1、D2）。
  const total = allClusters.reduce((s, c) => s + c.size, 0);
  const cut = Math.max(3, Math.ceil(total * 0.05));
  const passed = allClusters.filter((c) => c.size >= cut);
  const clusters = passed.slice(0, 5);
  const kept = new Set(clusters);
  const otherNames = Array.from(
    new Set(
      allClusters
        .filter((c) => !kept.has(c))
        .map((c) => c.name.trim())
        .filter((n) => n.length > 0)
    )
  );

  const profile: PersonaProfile = {
    vibe,
    headline: String(raw.headline ?? "你的互联网人格"),
    traits: (Array.isArray(raw.traits) ? raw.traits : [])
      .map(cleanTrait)
      .filter((t) => t.length > 0)
      .slice(0, 5),
    clusters,
    evolution: (Array.isArray(raw.evolution) ? raw.evolution : []).map((e) => {
      const ee = e as Record<string, unknown>;
      return { period: String(ee.period ?? ""), summary: String(ee.summary ?? "") };
    }),
  };
  const quote = cleanSignatureQuote(raw.signatureQuote);
  if (quote) profile.signatureQuote = quote;
  if (otherNames.length > 0) profile.otherInterests = otherNames;
  return profile;
}

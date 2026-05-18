// 客户端安全（不读 process.env）。风格定义单一来源，config.ts 再 re-export。
export const VIBES = ["earnest", "roast", "poetic"] as const;
export type Vibe = (typeof VIBES)[number];
export const DEFAULT_VIBE: Vibe = "earnest";
export const VIBE_LABEL: Record<Vibe, string> = {
  earnest: "真诚",
  roast: "毒舌",
  poetic: "诗意",
};
export function isVibe(v: unknown): v is Vibe {
  return typeof v === "string" && (VIBES as readonly string[]).includes(v);
}

// fetch_page 工具：仅公网 http/https；屏蔽内网/环回/链路本地；不跟随跳向内网的
// 重定向；超时 + 体积上限 + 正文抽取。spec: persona-agent「网页抓取工具安全」。
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { config } from "@/config";

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const l = ip.toLowerCase();
    return (
      l === "::1" ||
      l.startsWith("fc") ||
      l.startsWith("fd") || // 唯一本地
      l.startsWith("fe80") || // 链路本地
      l.startsWith("::ffff:") // IPv4-mapped：交给下方按 v4 再判
    );
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) || // 链路本地
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // 组播/保留
  );
}

async function assertPublicHttp(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("非法 URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new Error("仅允许 http/https");
  const host = u.hostname;
  const literal = host.replace(/^\[|\]$/g, "");
  if (isIP(literal)) {
    if (isPrivateIp(literal)) throw new Error("目标为内网/环回/链路本地地址");
    return u;
  }
  // 解析 DNS，所有解析结果都必须是公网
  const records = await lookup(host, { all: true });
  if (records.length === 0) throw new Error("DNS 无解析");
  for (const r of records) {
    const ip = r.address.startsWith("::ffff:")
      ? r.address.slice(7)
      : r.address;
    if (isPrivateIp(ip)) throw new Error("DNS 解析到内网地址");
  }
  return u;
}

const TAG_RE = /<(script|style|noscript)[\s\S]*?<\/\1>/gi;

function extractText(html: string, max = 6000): string {
  const text = html
    .replace(TAG_RE, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, max);
}

export interface FetchResult {
  ok: boolean;
  url: string;
  text?: string;
  error?: string;
}

/** 抓取单个 URL；手动跟随重定向并逐跳校验公网。失败返回 ok:false（调用方降级）。 */
export async function fetchPage(rawUrl: string): Promise<FetchResult> {
  let current = rawUrl;
  try {
    for (let hop = 0; hop < 4; hop++) {
      const u = await assertPublicHttp(current);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), config.fetchTimeoutMs);
      let res: Response;
      try {
        res = await fetch(u, {
          redirect: "manual",
          signal: ctrl.signal,
          headers: { "user-agent": "BookmarkPersonaBot/0.1 (+fun toy)" },
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, url: rawUrl, error: "重定向无 Location" };
        current = new URL(loc, u).toString();
        continue; // 下一跳会再次 assertPublicHttp
      }
      if (!res.ok) return { ok: false, url: rawUrl, error: `HTTP ${res.status}` };
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("html") && !ct.includes("text"))
        return { ok: false, url: rawUrl, error: "非文本内容" };

      // 体积上限：流式读取，超限截断
      const reader = res.body?.getReader();
      if (!reader) return { ok: false, url: rawUrl, error: "无响应体" };
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        chunks.push(value);
        if (size > config.fetchMaxBytes) {
          await reader.cancel();
          break;
        }
      }
      const html = Buffer.concat(chunks).toString("utf8");
      return { ok: true, url: u.toString(), text: extractText(html) };
    }
    return { ok: false, url: rawUrl, error: "重定向次数过多" };
  } catch (e) {
    return { ok: false, url: rawUrl, error: (e as Error).message };
  }
}

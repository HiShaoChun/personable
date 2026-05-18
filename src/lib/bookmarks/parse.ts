// Netscape 书签 HTML 解析器。纯字符串处理，无 DOM 依赖——
// 浏览器与 Node（测试）均可运行。spec: bookmark-import。
import type { BookmarkEntry } from "./types";

const ANCHOR_RE =
  /<a\s+([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi;
const ADD_DATE_RE = /add_date="(\d+)"/i;
const H3_RE = /<h3[^>]*>([\s\S]*?)<\/h3>/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** 判断字符串是否像一个 Netscape 书签导出文件。 */
export function looksLikeBookmarkExport(html: string): boolean {
  const head = html.slice(0, 4000).toUpperCase();
  return (
    head.includes("NETSCAPE-BOOKMARK") ||
    (head.includes("<DL") && head.includes("<DT"))
  );
}

interface RawEntry {
  title: string;
  url: string;
  domain: string;
  folderPath: string[];
  addDate: number | null;
}

/**
 * 解析为原始条目（未去重）。用 <DL>/<H3> 维护文件夹栈，
 * 用 </DL> 出栈。容错：损坏 anchor / 非法 URL 直接跳过。
 */
export function parseRawEntries(html: string): RawEntry[] {
  const out: RawEntry[] = [];
  const folderStack: string[] = [];

  // 按 <DL>、</DL>、<H3>、<A> 边界切片顺序扫描
  const tokenRe = /<dl[^>]*>|<\/dl>|<h3[^>]*>[\s\S]*?<\/h3>|<a\s[^>]*>[\s\S]*?<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(html)) !== null) {
    const tok = m[0];
    const lower = tok.toLowerCase();
    if (lower.startsWith("<dl")) {
      // 文件夹层级在最近的 H3 处压栈；此处占位由 H3 分支处理
      continue;
    }
    if (lower.startsWith("</dl")) {
      folderStack.pop();
      continue;
    }
    if (lower.startsWith("<h3")) {
      const h3 = H3_RE.exec(tok);
      folderStack.push(h3 ? decodeEntities(h3[1]) || "未命名" : "未命名");
      continue;
    }
    // anchor
    ANCHOR_RE.lastIndex = 0;
    const a = ANCHOR_RE.exec(tok);
    if (!a) continue;
    const url = a[2].trim();
    const domain = hostOf(url);
    if (!domain) continue; // 非法/非 http(s) URL：剔除，不向下游输出
    const attrs = a[1] + " " + a[3];
    const ad = ADD_DATE_RE.exec(attrs);
    const addDate = ad ? Number(ad[1]) : null;
    out.push({
      title: decodeEntities(a[4]) || domain,
      url,
      domain,
      folderPath: [...folderStack],
      addDate: addDate && Number.isFinite(addDate) && addDate > 0 ? addDate : null,
    });
  }
  return out;
}

/** 归一化 + 去重：相同 URL 合并为一条，记录所有出现过的文件夹路径。 */
export function normalizeAndDedupe(raw: RawEntry[]): BookmarkEntry[] {
  const byUrl = new Map<string, BookmarkEntry>();
  for (const r of raw) {
    const key = r.url;
    const existing = byUrl.get(key);
    const folderLabel = r.folderPath.join(" / ");
    if (existing) {
      if (folderLabel && !existing.folderPaths.includes(folderLabel)) {
        existing.folderPaths.push(folderLabel);
      }
      if (existing.addDate == null && r.addDate != null) existing.addDate = r.addDate;
    } else {
      byUrl.set(key, {
        title: r.title,
        url: r.url,
        domain: r.domain,
        folderPaths: folderLabel ? [folderLabel] : [],
        addDate: r.addDate,
      });
    }
  }
  return [...byUrl.values()];
}

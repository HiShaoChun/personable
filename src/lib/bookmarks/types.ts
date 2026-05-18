// 结构化书签条目——只有这些字段会离开浏览器。
export interface BookmarkEntry {
  title: string;
  url: string;
  domain: string;
  folderPaths: string[]; // 该 URL 出现过的所有文件夹路径（去重合并后）
  addDate: number | null; // unix 秒；无法解析则 null
}

export interface ParseResult {
  entries: BookmarkEntry[];
  totalParsed: number; // 去重前解析出的条目数
  sampled: boolean; // 是否因超上限做了下采样
}

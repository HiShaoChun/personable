// 分享卡 + agent 状态存储。memory（开发）/ sqlite（ECS 生产，同机持久）。
// 只存派生数据：画像 JSON 与缓存的 agent 状态；绝不存原始/结构化书签。
// spec: persona-card「仅基于派生数据的分享链接」。
import { config } from "@/config";

interface Row {
  value: string;
  expiresAt: number; // unix ms
}

interface Driver {
  set(key: string, value: string, ttlMs: number): void;
  get(key: string): string | null;
}

class MemoryDriver implements Driver {
  private m = new Map<string, Row>();
  set(key: string, value: string, ttlMs: number) {
    this.m.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
  get(key: string): string | null {
    const r = this.m.get(key);
    if (!r) return null;
    if (Date.now() > r.expiresAt) {
      this.m.delete(key);
      return null;
    }
    return r.value;
  }
}

class SqliteDriver implements Driver {
  private db: import("better-sqlite3").Database;
  constructor() {
    // 动态 require：未装 better-sqlite3 时给出清晰错误而非崩在 import 期
    const Database = require("better-sqlite3");
    this.db = new Database(config.storePath);
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, exp INTEGER)"
    );
  }
  set(key: string, value: string, ttlMs: number) {
    this.db
      .prepare("INSERT OR REPLACE INTO kv (k,v,exp) VALUES (?,?,?)")
      .run(key, value, Date.now() + ttlMs);
    // 顺手清扫过期
    this.db.prepare("DELETE FROM kv WHERE exp < ?").run(Date.now());
  }
  get(key: string): string | null {
    const row = this.db
      .prepare("SELECT v, exp FROM kv WHERE k = ?")
      .get(key) as { v: string; exp: number } | undefined;
    if (!row) return null;
    if (Date.now() > row.exp) {
      this.db.prepare("DELETE FROM kv WHERE k = ?").run(key);
      return null;
    }
    return row.v;
  }
}

let _driver: Driver | null = null;
function driver(): Driver {
  if (_driver) return _driver;
  if (config.storeDriver === "sqlite") {
    try {
      _driver = new SqliteDriver();
    } catch (e) {
      throw new Error(
        `STORE_DRIVER=sqlite 但 better-sqlite3 不可用：${(e as Error).message}。` +
          `请 npm i better-sqlite3，或开发环境改用 STORE_DRIVER=memory。`
      );
    }
  } else {
    _driver = new MemoryDriver();
  }
  return _driver;
}

const ttlMs = () => config.cardTtlDays * 24 * 60 * 60 * 1000;

export function putCard(id: string, profileJson: string) {
  driver().set(`card:${id}`, profileJson, ttlMs());
}
export function getCard(id: string): string | null {
  return driver().get(`card:${id}`);
}

// 缓存 agent 状态供「换风格重合成」复用（同 TTL）。
export function putAgentState(runId: string, stateJson: string) {
  driver().set(`state:${runId}`, stateJson, ttlMs());
}
export function getAgentState(runId: string): string | null {
  return driver().get(`state:${runId}`);
}

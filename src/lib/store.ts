// agent 状态存储。memory（开发）/ sqlite（ECS 生产，同机持久）。
// 只存派生数据：缓存的 agent 状态（供「换个风格」复用）；绝不存原始/结构化书签。
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
  // 开发模式下 Next.js 的 HMR 会重载本模块，导致模块级的 Map 被重建、
  // 之前缓存的 agent state 全部丢失，前端再点「换个风格」就会 404 expired。
  // 把 Map 挂到 globalThis 上，跨 HMR 重载保留数据。
  private m: Map<string, Row>;
  constructor() {
    const g = globalThis as unknown as { __personableMemStore?: Map<string, Row> };
    this.m = g.__personableMemStore ??= new Map<string, Row>();
  }
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
  private db: any;
  constructor() {
    // 用变量名隐藏字符串：bundler 静态分析看不到 "better-sqlite3"，
    // 因此 STORE_DRIVER=memory 时不会因为该可选依赖未装而编译失败。
    const mod = "better-sqlite3";
    const Database = require(mod);
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

// 缓存 agent 状态供「换风格重合成」复用。
export function putAgentState(runId: string, stateJson: string) {
  driver().set(`state:${runId}`, stateJson, ttlMs());
}
export function getAgentState(runId: string): string | null {
  return driver().get(`state:${runId}`);
}

import fs from "fs";
import pg from "pg";

// Persistent storage for settings, agents, chats and login sessions.
//
// With DATABASE_URL set, everything lives in Postgres (table botapp_store, one row per document,
// with a tenant_id column so each business's data is separate). Without it the app keeps using the
// local JSON files exactly as before. Reads are synchronous (served from memory, loaded at startup)
// so the rest of the server didn't have to become async; writes go to the database in the
// background, in order, and only the documents that changed are written.
//
// Documents: settings (one, global) · agent (one per agent) · chats (one per business) · session
// (one per login token). Run a single Cloud Run instance (--max-instances 1): the memory copy is
// per instance.

export interface StoragePaths {
  settings: string;
  agents: string;
  chats: string;
  sessions: string;
}

type Kind = "settings" | "agent" | "chats" | "session";

const GLOBAL_TENANT = "_global";

let pool: pg.Pool | null = null;
let paths: StoragePaths;

const cache = {
  settings: null as any,
  agents: [] as any[],
  chats: [] as any[],
  sessions: {} as Record<string, any>,
};

// What is currently stored, as JSON text per "kind:docId" — used to write only what changed.
const persisted = new Map<string, string>();
let writeChain: Promise<void> = Promise.resolve();

const key = (kind: Kind, docId: string) => `${kind}:${docId}`;

export const storageMode = () => (pool ? "postgres" : "files");

function readJsonFile<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`[STORAGE] Error reading ${file}:`, e);
  }
  return fallback;
}

function writeJsonFile(file: string, value: unknown) {
  try {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
  } catch (e) {
    console.error(`[STORAGE] Error writing ${file}:`, e);
  }
}

// The tenant a chat belongs to = the tenant of the agent whose bot it talked to.
function tenantOfChat(chat: any): string {
  const agent = cache.agents.find((a) => a.botId && String(a.botId) === String(chat.botId));
  return agent?.tenantId ? String(agent.tenantId) : GLOBAL_TENANT;
}

interface Doc {
  kind: Kind;
  tenant: string;
  docId: string;
  json: string;
}

function collectDocs(): Doc[] {
  const docs: Doc[] = [];
  if (cache.settings) {
    docs.push({ kind: "settings", tenant: GLOBAL_TENANT, docId: "main", json: JSON.stringify(cache.settings) });
  }
  for (const a of cache.agents) {
    if (!a?.id) continue;
    docs.push({ kind: "agent", tenant: a.tenantId ? String(a.tenantId) : GLOBAL_TENANT, docId: String(a.id), json: JSON.stringify(a) });
  }
  const byTenant = new Map<string, any[]>();
  for (const c of cache.chats) {
    const t = tenantOfChat(c);
    const list = byTenant.get(t);
    if (list) list.push(c); else byTenant.set(t, [c]);
  }
  byTenant.forEach((list, t) => docs.push({ kind: "chats", tenant: t, docId: t, json: JSON.stringify(list) }));
  for (const [token, s] of Object.entries(cache.sessions)) {
    docs.push({ kind: "session", tenant: s?.tenantId ? String(s.tenantId) : GLOBAL_TENANT, docId: token, json: JSON.stringify(s) });
  }
  return docs;
}

// When each stored document was last written, as the database reports it. Used to notice what other
// server instances changed (serverless: several instances share one database).
const seen = new Map<string, string>();
let lastSync = 0;

function removeChatsOfTenant(tenant: string) {
  cache.chats = cache.chats.filter((c) => tenantOfChat(c) !== tenant);
}

function applyDoc(kind: string, docId: string, data: any) {
  if (kind === "settings") cache.settings = data;
  else if (kind === "agent") {
    const i = cache.agents.findIndex((a) => String(a.id) === docId);
    if (i >= 0) cache.agents[i] = data; else cache.agents.push(data);
  } else if (kind === "chats") {
    removeChatsOfTenant(docId);
    cache.chats.push(...(data as any[]));
  } else if (kind === "session") cache.sessions[docId] = data;
}

function removeDoc(kind: string, docId: string) {
  if (kind === "agent") cache.agents = cache.agents.filter((a) => String(a.id) !== docId);
  else if (kind === "chats") removeChatsOfTenant(docId);
  else if (kind === "session") delete cache.sessions[docId];
}

// Brings the in-memory copy up to date with the database: fetches only documents that changed since
// last time and drops the ones deleted elsewhere. Cheap enough to run at the start of every request.
export async function syncStorage(force = false) {
  if (!pool) return;
  const now = Date.now();
  if (!force && now - lastSync < 400) return;
  lastSync = now;
  try {
    const { rows } = await pool.query("SELECT kind, doc_id, updated_at FROM botapp_store");
    const present = new Set<string>();
    const changedKeys: string[] = [];
    for (const r of rows) {
      const k = key(r.kind, r.doc_id);
      present.add(k);
      if (seen.get(k) !== new Date(r.updated_at).toISOString()) changedKeys.push(k);
    }
    for (const k of Array.from(seen.keys())) {
      if (present.has(k)) continue;
      const [kind, ...rest] = k.split(":");
      removeDoc(kind, rest.join(":"));
      seen.delete(k);
      persisted.delete(k);
    }
    if (changedKeys.length) {
      const { rows: docs } = await pool.query(
        "SELECT kind, doc_id, data, updated_at FROM botapp_store WHERE (kind || ':' || doc_id) = ANY($1::text[])",
        [changedKeys]
      );
      for (const d of docs) {
        const k = key(d.kind, d.doc_id);
        applyDoc(d.kind, d.doc_id, d.data);
        persisted.set(k, JSON.stringify(d.data));
        seen.set(k, new Date(d.updated_at).toISOString());
      }
    }
  } catch (e) {
    console.error("[STORAGE] Could not refresh from Postgres (using the copy in memory):", e);
  }
}

// Writes what changed since the last write. Never throws: a database hiccup must not crash a
// request, it is logged and the next write retries whatever differs.
function schedulePersist() {
  writeChain = writeChain.then(async () => {
    if (!pool) return;
    try {
      const docs = collectDocs();
      const wanted = new Set<string>();
      for (const d of docs) {
        const k = key(d.kind, d.docId);
        wanted.add(k);
        if (persisted.get(k) === d.json) continue;
        const w = await pool.query(
          `INSERT INTO botapp_store (kind, doc_id, tenant_id, data, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, clock_timestamp())
           ON CONFLICT (kind, doc_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, data = EXCLUDED.data, updated_at = clock_timestamp()
           RETURNING updated_at`,
          [d.kind, d.docId, d.tenant, d.json]
        );
        persisted.set(k, d.json);
        seen.set(k, new Date(w.rows[0].updated_at).toISOString());
      }
      for (const k of Array.from(persisted.keys())) {
        if (wanted.has(k)) continue;
        const [kind, ...rest] = k.split(":");
        await pool.query("DELETE FROM botapp_store WHERE kind = $1 AND doc_id = $2", [kind, rest.join(":")]);
        persisted.delete(k);
        seen.delete(k);
      }
    } catch (e) {
      console.error("[STORAGE] Postgres write failed (will retry on the next change):", e);
    }
  });
}

function persistFile(kind: "settings" | "agents" | "chats" | "sessions") {
  if (pool) return schedulePersist();
  const file = paths[kind];
  writeJsonFile(file, kind === "settings" ? cache.settings : cache[kind]);
}

// defaults: what to start with when nothing has been stored yet.
export async function initStorage(p: StoragePaths, defaults: { settings: any; agents: any[] }) {
  paths = p;
  const url = process.env.DATABASE_URL;

  if (url) {
    try {
      pool = new pg.Pool({ connectionString: url, max: 3, connectionTimeoutMillis: 8000 });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS botapp_store (
          kind TEXT NOT NULL,
          doc_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL DEFAULT '_global',
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (kind, doc_id)
        )`);
      await pool.query("CREATE INDEX IF NOT EXISTS botapp_store_tenant_idx ON botapp_store (tenant_id, kind)");
      const { rows: countRows } = await pool.query("SELECT count(*)::int AS n FROM botapp_store");

      if (countRows[0].n === 0) {
        // First run against an empty database: start from whatever the local files hold.
        cache.settings = readJsonFile(p.settings, defaults.settings);
        cache.agents = readJsonFile<any[]>(p.agents, defaults.agents);
        cache.chats = readJsonFile<any[]>(p.chats, []);
        // Sessions are NOT imported: the old file may hold tokens that were invented, not issued.
        cache.sessions = {};
        schedulePersist();
        await writeChain;
        console.log(`[STORAGE] Postgres was empty — imported ${cache.agents.length} agents, ${cache.chats.length} chat messages from local files.`);
      } else {
        await syncStorage(true);
        if (!cache.settings) cache.settings = defaults.settings;
        console.log(`[STORAGE] Loaded from Postgres: ${cache.agents.length} agents, ${cache.chats.length} chat messages, ${Object.keys(cache.sessions).length} sessions.`);
      }
      return;
    } catch (e) {
      // Falling back silently to files would make data disappear on the next restart, so say so loudly.
      console.error("[STORAGE] !!! Could not use DATABASE_URL, falling back to local files (data will NOT persist):", e);
      pool = null;
    }
  }

  cache.settings = readJsonFile(p.settings, defaults.settings);
  cache.agents = readJsonFile<any[]>(p.agents, defaults.agents);
  cache.chats = readJsonFile<any[]>(p.chats, []);
  cache.sessions = readJsonFile<Record<string, any>>(p.sessions, {});
  if (!fs.existsSync(p.settings)) writeJsonFile(p.settings, cache.settings);
  if (!fs.existsSync(p.agents)) writeJsonFile(p.agents, cache.agents);
  console.log("[STORAGE] Using local JSON files (no DATABASE_URL).");
}

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export const getSettingsDoc = () => clone(cache.settings);
export const setSettingsDoc = (v: any) => {
  cache.settings = clone(v);
  persistFile("settings");
};

export const getAgentsDoc = (): any[] => clone(cache.agents);
export const setAgentsDoc = (v: any[]) => {
  cache.agents = clone(v);
  persistFile("agents");
};

export const getChatsDoc = (): any[] => clone(cache.chats);
export const setChatsDoc = (v: any[]) => {
  cache.chats = clone(v);
  persistFile("chats");
};

export const getSessionsDoc = (): Record<string, any> => clone(cache.sessions);
export const setSessionsDoc = (v: Record<string, any>) => {
  cache.sessions = clone(v);
  persistFile("sessions");
};

// For tests / shutdown.
export async function flushStorage() {
  await writeChain;
}

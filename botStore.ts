import fs from "fs";
import path from "path";
import { storagePool } from "./storage.js";

// The bot engine's own data (botEngine.ts — the bot answering here instead of n8n), kept in its own
// tables and NOT on the agent document: the agent screen saves the whole agent list from the
// browser, and a stale copy would overwrite what the bot learned or noted in the meantime.
//
//   botapp_bot_brain      one row per agent: engine on/off per channel, the Q&A list, booking hours
//   botapp_bot_lessons    corrections the bot learned (from customers, or the owner in the test chat)
//   botapp_bot_notes      notes for the staff: "a person should get back to them" / a reported bot fault
//   botapp_conversations  one row per conversation (bot + session), messages appended in place
//
// Without DATABASE_URL (local dev only) everything is kept in memory and in data/bot-store.json.

export interface BotQa { id: string; q: string; a: string }

export interface BookingHours {
  enabled: boolean;
  // per weekday (0 = Sunday … 6 = Saturday): "HH:mm-HH:mm", empty = closed
  hours: Record<string, string>;
  slotMinutes: number;
  daysAhead: number;
}

export interface BotBrain {
  agentId: string;
  // the website widget is answered here instead of n8n
  nativeWeb: boolean;
  qa: BotQa[];
  booking: BookingHours;
  // free text the owner adds for the voice bot only
  voiceNotes?: string;
  autofilledAt?: string;
  updatedAt?: string;
}

export interface BotLesson {
  id: string;
  agentId: string;
  text: string;
  // who taught it: a customer's correction, or the owner (test chat / the screen)
  source: "customer" | "owner";
  quote?: string; // what was said that taught it
  sessionId?: string;
  active: boolean;
  createdAt: string;
}

export type BotNoteKind = "handoff" | "bug" | "lesson";

export interface BotNote {
  id: string;
  agentId: string;
  botId: string;
  sessionId: string;
  channel: string;
  phone?: string;
  name?: string;
  kind: BotNoteKind;
  text: string;
  createdAt: string;
  doneAt?: string;
  doneBy?: string;
}

export interface ConvMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  at: string;
  options?: string[];
  images?: string[];
  buttonId?: string;
}

export interface BotConversation {
  botId: string;
  sessionId: string;
  agentId: string;
  channel: string;
  phone: string;
  name: string;
  test: boolean;
  messages: ConvMessage[];
  updatedAt: string;
}

export const DEFAULT_BOOKING: BookingHours = { enabled: false, hours: {}, slotMinutes: 30, daysAhead: 14 };

export const emptyBrain = (agentId: string): BotBrain => ({ agentId, nativeWeb: false, qa: [], booking: { ...DEFAULT_BOOKING } });

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ---------- local fallback (no database) ----------

const FILE = process.env.VERCEL ? "/tmp/botapp-data/bot-store.json" : path.join(process.cwd(), "data", "bot-store.json");
let mem: { brains: Record<string, BotBrain>; lessons: BotLesson[]; notes: BotNote[]; convs: Record<string, BotConversation> } | null = null;

function local() {
  if (!mem) {
    try {
      mem = JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {
      mem = { brains: {}, lessons: [], notes: [], convs: {} };
    }
  }
  return mem!;
}

function saveLocal() {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(mem));
  } catch (e) {
    console.warn("[BOT STORE] could not write the local file:", e);
  }
}

// ---------- database ----------

let ready: Promise<void> | null = null;

function db() {
  const pool = storagePool();
  if (!pool) return null;
  if (!ready) {
    ready = pool
      .query(`
        CREATE TABLE IF NOT EXISTS botapp_bot_brain (
          agent_id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS botapp_bot_lessons (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS botapp_bot_lessons_agent_idx ON botapp_bot_lessons (agent_id);
        CREATE TABLE IF NOT EXISTS botapp_bot_notes (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          bot_id TEXT NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS botapp_bot_notes_bot_idx ON botapp_bot_notes (bot_id, created_at);
        CREATE TABLE IF NOT EXISTS botapp_conversations (
          bot_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          agent_id TEXT NOT NULL DEFAULT '',
          channel TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          name TEXT NOT NULL DEFAULT '',
          test BOOLEAN NOT NULL DEFAULT FALSE,
          messages JSONB NOT NULL DEFAULT '[]',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (bot_id, session_id)
        );
        CREATE INDEX IF NOT EXISTS botapp_conversations_phone_idx ON botapp_conversations (bot_id, phone);
      `)
      .then(() => undefined)
      .catch((e) => {
        ready = null;
        throw e;
      });
  }
  return { pool, ready };
}

// ---------- brain ----------

const withDefaults = (agentId: string, data: any): BotBrain => {
  const base = emptyBrain(agentId);
  return {
    ...base,
    ...(data || {}),
    agentId,
    qa: Array.isArray(data?.qa) ? data.qa : [],
    booking: { ...base.booking, ...(data?.booking || {}), hours: { ...(data?.booking?.hours || {}) } },
  };
};

export async function getBrain(agentId: string): Promise<BotBrain> {
  const d = db();
  if (!d) return withDefaults(agentId, local().brains[agentId]);
  await d.ready;
  const { rows } = await d.pool.query("SELECT data FROM botapp_bot_brain WHERE agent_id = $1", [agentId]);
  return withDefaults(agentId, rows[0]?.data);
}

export async function saveBrain(brain: BotBrain): Promise<BotBrain> {
  const next = withDefaults(brain.agentId, { ...brain, updatedAt: new Date().toISOString() });
  const d = db();
  if (!d) {
    local().brains[brain.agentId] = next;
    saveLocal();
    return next;
  }
  await d.ready;
  await d.pool.query(
    `INSERT INTO botapp_bot_brain (agent_id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (agent_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [next.agentId, JSON.stringify(next)]
  );
  return next;
}

// The agents whose website switch is on (for diagnosing "the site still goes to n8n")
export async function switchedOnAgentIds(): Promise<string[]> {
  const d = db();
  if (!d) return Object.values(local().brains).filter((b) => b.nativeWeb).map((b) => b.agentId);
  await d.ready;
  const { rows } = await d.pool.query("SELECT agent_id FROM botapp_bot_brain WHERE (data->>'nativeWeb')::boolean");
  return rows.map((r: any) => r.agent_id);
}

// ---------- lessons ----------

export async function listLessons(agentId: string): Promise<BotLesson[]> {
  const d = db();
  if (!d) return local().lessons.filter((l) => l.agentId === agentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  await d.ready;
  const { rows } = await d.pool.query("SELECT data FROM botapp_bot_lessons WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 300", [agentId]);
  return rows.map((r: any) => r.data);
}

export async function addLesson(l: Omit<BotLesson, "id" | "createdAt">): Promise<BotLesson> {
  const lesson: BotLesson = { ...l, id: newId("lesson"), createdAt: new Date().toISOString() };
  const d = db();
  if (!d) {
    local().lessons.push(lesson);
    saveLocal();
    return lesson;
  }
  await d.ready;
  await d.pool.query("INSERT INTO botapp_bot_lessons (id, agent_id, data) VALUES ($1, $2, $3)", [lesson.id, lesson.agentId, JSON.stringify(lesson)]);
  return lesson;
}

// changes: active / text; null deletes
export async function updateLesson(agentId: string, id: string, changes: Partial<Pick<BotLesson, "active" | "text">> | null): Promise<void> {
  const d = db();
  if (!d) {
    const s = local();
    const i = s.lessons.findIndex((l) => l.id === id && l.agentId === agentId);
    if (i === -1) return;
    if (changes === null) s.lessons.splice(i, 1);
    else s.lessons[i] = { ...s.lessons[i], ...changes };
    saveLocal();
    return;
  }
  await d.ready;
  if (changes === null) {
    await d.pool.query("DELETE FROM botapp_bot_lessons WHERE id = $1 AND agent_id = $2", [id, agentId]);
  } else {
    await d.pool.query("UPDATE botapp_bot_lessons SET data = data || $3::jsonb WHERE id = $1 AND agent_id = $2", [id, agentId, JSON.stringify(changes)]);
  }
}

// ---------- staff notes ----------

export async function addNote(n: Omit<BotNote, "id" | "createdAt">): Promise<BotNote> {
  const note: BotNote = { ...n, id: newId(`staffnote-${n.kind}`), createdAt: new Date().toISOString() };
  const d = db();
  if (!d) {
    local().notes.push(note);
    saveLocal();
    return note;
  }
  await d.ready;
  await d.pool.query("INSERT INTO botapp_bot_notes (id, agent_id, bot_id, data) VALUES ($1, $2, $3, $4)", [note.id, note.agentId, note.botId, JSON.stringify(note)]);
  return note;
}

export async function listNotes(botId: string, limit = 300): Promise<BotNote[]> {
  const d = db();
  if (!d) return local().notes.filter((n) => n.botId === botId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  await d.ready;
  const { rows } = await d.pool.query("SELECT data FROM botapp_bot_notes WHERE bot_id = $1 ORDER BY created_at DESC LIMIT $2", [botId, limit]);
  return rows.map((r: any) => r.data);
}

export async function markNoteDone(botId: string, id: string, by: string, done: boolean): Promise<void> {
  const changes = done ? { doneAt: new Date().toISOString(), doneBy: by } : { doneAt: null, doneBy: null };
  const d = db();
  if (!d) {
    const n = local().notes.find((x) => x.id === id && x.botId === botId);
    if (n) Object.assign(n, { doneAt: changes.doneAt || undefined, doneBy: changes.doneBy || undefined });
    saveLocal();
    return;
  }
  await d.ready;
  await d.pool.query("UPDATE botapp_bot_notes SET data = data || $3::jsonb WHERE id = $1 AND bot_id = $2", [id, botId, JSON.stringify(changes)]);
}

// ---------- conversations ----------

const convKey = (botId: string, sessionId: string) => `${botId}|${sessionId}`;

export async function getConversation(botId: string, sessionId: string): Promise<BotConversation | null> {
  const d = db();
  if (!d) return local().convs[convKey(botId, sessionId)] || null;
  await d.ready;
  const { rows } = await d.pool.query("SELECT * FROM botapp_conversations WHERE bot_id = $1 AND session_id = $2", [botId, sessionId]);
  return rows[0] ? rowToConv(rows[0]) : null;
}

const rowToConv = (r: any): BotConversation => ({
  botId: r.bot_id,
  sessionId: r.session_id,
  agentId: r.agent_id,
  channel: r.channel,
  phone: r.phone,
  name: r.name,
  test: !!r.test,
  messages: Array.isArray(r.messages) ? r.messages : [],
  updatedAt: new Date(r.updated_at).toISOString(),
});

// Appends messages to a conversation (created on first use). A phone / name that is given replaces
// the stored one; an empty one keeps it.
export async function appendToConversation(
  c: Pick<BotConversation, "botId" | "sessionId" | "agentId" | "channel"> & { phone?: string; name?: string; test?: boolean },
  messages: ConvMessage[]
): Promise<void> {
  const d = db();
  if (!d) {
    const s = local();
    const k = convKey(c.botId, c.sessionId);
    const cur = s.convs[k] || { botId: c.botId, sessionId: c.sessionId, agentId: c.agentId, channel: c.channel, phone: "", name: "", test: !!c.test, messages: [], updatedAt: "" };
    s.convs[k] = {
      ...cur,
      phone: c.phone || cur.phone,
      name: c.name || cur.name,
      messages: [...cur.messages, ...messages],
      updatedAt: new Date().toISOString(),
    };
    saveLocal();
    return;
  }
  await d.ready;
  await d.pool.query(
    `INSERT INTO botapp_conversations (bot_id, session_id, agent_id, channel, phone, name, test, messages, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
     ON CONFLICT (bot_id, session_id) DO UPDATE SET
       messages = botapp_conversations.messages || EXCLUDED.messages,
       phone = COALESCE(NULLIF(EXCLUDED.phone, ''), botapp_conversations.phone),
       name = COALESCE(NULLIF(EXCLUDED.name, ''), botapp_conversations.name),
       updated_at = now()`,
    [c.botId, c.sessionId, c.agentId, c.channel, c.phone || "", c.name || "", !!c.test, JSON.stringify(messages)]
  );
}

// The bot's conversations, newest first (tests included only when asked)
export async function listConversations(botId: string, opts: { includeTests?: boolean; limit?: number; phones9?: string[] } = {}): Promise<BotConversation[]> {
  const limit = opts.limit || 500;
  const d = db();
  if (!d) {
    return Object.values(local().convs)
      .filter((c) => c.botId === botId && (opts.includeTests || !c.test))
      .filter((c) => !opts.phones9 || opts.phones9.includes(String(c.phone).replace(/\D/g, "").slice(-9)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }
  await d.ready;
  const params: any[] = [botId, limit];
  let where = "bot_id = $1";
  if (!opts.includeTests) where += " AND NOT test";
  if (opts.phones9) {
    params.push(opts.phones9);
    where += ` AND right(regexp_replace(phone, '\\D', '', 'g'), 9) = ANY($3::text[])`;
  }
  const { rows } = await d.pool.query(`SELECT * FROM botapp_conversations WHERE ${where} ORDER BY updated_at DESC LIMIT $2`, params);
  return rows.map(rowToConv);
}

export async function deleteConversation(botId: string, sessionId: string): Promise<void> {
  const d = db();
  if (!d) {
    delete local().convs[convKey(botId, sessionId)];
    saveLocal();
    return;
  }
  await d.ready;
  await d.pool.query("DELETE FROM botapp_conversations WHERE bot_id = $1 AND session_id = $2", [botId, sessionId]);
}

import type { GoogleGenAI } from "@google/genai";
import { HDate, HebrewCalendar, flags } from "@hebcal/core";
import {
  addLesson,
  addNote,
  appendToConversation,
  getConversation,
  type BookingHours,
  type BotBrain,
  type BotEvent,
  type BotLesson,
  type BotNote,
  type BotNoteKind,
  type ConvMessage,
} from "./botStore.js";

// The bot itself, answering here instead of in n8n (Haim, 2026-10-23: "I want direct communication
// between all the systems so the bot knows everything"). Started with the website widget; WhatsApp
// and Facebook come next and will call runBotTurn the same way with their own channel.
//
// Each turn: the agent's prompt ("השכל") + the owner's Q&A + what the bot learned, + what the CRM
// knows about this customer (card, purchases and when they're ready, upcoming exams, the WhatsApp
// campaigns they got lately with their text), then Gemini with tools — linking the customer by
// phone, free exam slots / booking / moving / cancelling on the branch calendar, notes for the staff
// (a promise that someone will get back, or a reported bot fault) and learning from a correction.
// The answer is { reply, options, images } — the widget shows options as buttons.

export type Channel = "web" | "test" | "whatsapp";

export interface CrmCaller {
  (body: Record<string, unknown>): Promise<any>;
}

export interface TurnInput {
  agent: any;
  brain: BotBrain;
  lessons: BotLesson[];
  brainText: string; // the agent's full prompt, with the portal's frames
  channel: Channel;
  sessionId: string;
  text: string;
  buttonId?: string;
  phone?: string;
  name?: string;
  // WhatsApp only: what the message answers — a quoted message, a campaign's template button, an ad
  waContext?: { replyTo?: string; templateButton?: boolean; ad?: { headline?: string; body?: string; sourceUrl?: string; sourceType?: string } };
}

export interface TurnDeps {
  ai: GoogleGenAI | null;
  crm: CrmCaller | null; // null = the business has no CRM link (no portal business / no shared secret)
  // a note for the staff was written (also shown in the BotApp chat) — e.g. put it on the CRM lead
  onNote?: (note: BotNote) => Promise<void>;
}

export interface TurnResult {
  reply: string;
  options: string[];
  images: string[];
  phone?: string; // the customer's phone, once known (the widget keeps it)
  name?: string;
  notes: BotNote[];
  // where the time went, in ms (shown in the bot's screen): customer = the CRM read, ai = each model
  // call, tools = each tool, total
  timing: { customer: number; ai: number[]; tools: { name: string; ms: number }[]; total: number };
}

const TZ = "Asia/Jerusalem";
const MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
const HISTORY = 30;
const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// ---------- time (Israel wall clock) ----------

function israelNow(): { date: string; time: string; weekday: number } {
  const parts: Record<string, string> = {};
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date())
    .forEach((p) => (parts[p.type] = p.value));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`, weekday: weekdayOf(date) };
}

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const fromMinutes = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

// "2026-10-28T10:30" → "יום רביעי 28/10 בשעה 10:30"
export function showSlot(start: string): string {
  const date = start.slice(0, 10);
  return `יום ${DAY_NAMES[weekdayOf(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)} בשעה ${start.slice(11, 16)}`;
}

export const showDay = (date: string) => `יום ${DAY_NAMES[weekdayOf(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)}`;

// "2026-10-28T12:00" → "רביעי 28/10 · 12:00" (a WhatsApp list row allows 24 characters)
export function slotButton(start: string): string {
  const date = start.slice(0, 10);
  return `${DAY_NAMES[weekdayOf(date)]} ${date.slice(8, 10)}/${date.slice(5, 7)} · ${start.slice(11, 16)}`;
}

// ---------- greeting ----------

const israelDateOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

// Special days the Hebrew calendar doesn't know (Knesset election day is a day off)
const SPECIAL_DAYS: Record<string, string> = {
  "2026-10-27": "יום הבחירות לכנסת (יום שבתון) — אפשר לאחל \"יום בוחר שמח\"",
};

// What today is, for the opening line: the time of day, and a holiday / special day if there is one
function greetingContext(now: { date: string; time: string; weekday: number }): string {
  const hour = Number(now.time.slice(0, 2));
  const timeOfDay = hour >= 5 && hour < 11 ? "בוקר טוב" : hour >= 11 && hour < 16 ? "צהריים טובים" : hour >= 16 && hour < 22 ? "ערב טוב" : "לילה טוב";
  const parts = [`ברכה לפי השעה: "${timeOfDay}"`];
  if (now.weekday === 5 && hour >= 12) parts.push('יום שישי אחרי הצהריים — אפשר לאחל "שבת שלום"');
  if (now.weekday === 6) parts.push('שבת — "שבת שלום" / "שבוע טוב" במוצאי שבת');
  if (SPECIAL_DAYS[now.date]) parts.push(SPECIAL_DAYS[now.date]);
  try {
    const [y, m, d] = now.date.split("-").map(Number);
    const names = (HebrewCalendar.getHolidaysOnDate(new HDate(new Date(y, m - 1, d)), true) || []).map((e: any) => e.render("he"));
    if (names.length) parts.push(`היום בלוח העברי: ${names.join(", ")} — ברכה מתאימה (חג שמח / חג כשר ושמח / חנוכה שמח...), ובימי זיכרון או צום בלי ברכה שמחה`);
  } catch {
    /* no holiday info */
  }
  return parts.join("; ");
}

// Markdown the model sometimes writes → WhatsApp style (also what the website widget shows):
// "* item" / "- item" lines → "• item", **bold** → *bold*, "* bold *" → "*bold*"
export function tidyText(text: string): string {
  return String(text || "")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .split("\n")
    .map((line) => line.replace(/^(\s*)[*\-]\s+(?=\S)/, "$1• "))
    .join("\n")
    .replace(/\*[ \t]+([^*\n]+?)[ \t]+\*/g, "*$1*")
    .replace(/\*[ \t]+([^*\n]+?)\*/g, "*$1*")
    .replace(/\*([^*\n]+?)[ \t]+\*/g, "*$1*")
    .split("\n")
    .map(boldEdges)
    .join("\n");
}

// WhatsApp bolds *x* only when the stars stand at a word's edge: "מקבל*משקפי שמש*" stays plain
// (Haim, 2026-10-23). A Hebrew prefix written outside ("ב*יום שני*") goes inside; any other letter
// right before / after the stars gets a space ("מ" before a number: "מ-*800 ₪*").
const WORD_CHAR = /[\p{L}\p{N}]/u;
function boldEdges(line: string): string {
  let out = "";
  let rest = line;
  for (let m = rest.match(/\*([^*\s][^*]*?)\*/); m && m.index !== undefined; m = rest.match(/\*([^*\s][^*]*?)\*/)) {
    let before = out + rest.slice(0, m.index);
    let inner = m[1];
    const prefix = before.match(/(?:^|[\s(«"'״׳-])([בהוכלמש]{1,3})$/);
    if (prefix && /^\d/.test(inner)) before += "-"; // "מ*800 ₪*" → "מ-*800 ₪*"
    else if (prefix) {
      before = before.slice(0, -prefix[1].length);
      inner = prefix[1] + inner;
    } else if (before && WORD_CHAR.test(before[before.length - 1])) before += " ";
    rest = rest.slice(m.index + m[0].length);
    out = `${before}*${inner}*${rest && WORD_CHAR.test(rest[0]) ? " " : ""}`;
  }
  return out + rest;
}

// ---------- phones ----------

// Any Israeli way of writing a mobile / landline → 972XXXXXXXXX, or "" when it isn't one
export function normalizeIsraeliPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "").replace(/^00/, "");
  if (digits.startsWith("972")) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  if (!/^(?:5\d{8}|[23489]\d{7}|7\d{8})$/.test(digits)) return "";
  return "972" + digits;
}

// ---------- free exam slots ----------

// "09:00-13:00, 16:00-19:00" → [[540, 780], [960, 1140]]
function ranges(spec: string): [number, number][] {
  return String(spec || "")
    .split(/[,;]/)
    .map((r) => r.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [toMinutes(m[1]), toMinutes(m[2])] as [number, number])
    .filter(([a, b]) => b > a);
}

// The official holidays a business is closed on (Haim, 2026-10-23: "only official holidays, not
// election day"): yom tov in Israel (Rosh Hashana, Yom Kippur, Sukkot, Shmini Atzeret, Pesach I/VII,
// Shavuot) and Independence Day. "" when the date isn't one.
export function officialHoliday(date: string): string {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const ev = (HebrewCalendar.getHolidaysOnDate(new HDate(new Date(y, m - 1, d)), true) || []).find(
      (e: any) => e.getFlags() & flags.CHAG || e.getDesc() === "Yom HaAtzma'ut"
    );
    return ev ? ev.render("he").replace(/[\u0591-\u05C7]/g, "") : "";
  } catch {
    return "";
  }
}

const eventOn = (e: BotEvent, date: string) => e.from <= date && date <= (e.to || e.from);

// A date's reception hours: an event closing it / changing its hours, an official holiday (when the
// business closes on them), or the weekday's usual hours. why = what to tell the customer.
export function dayHours(brain: Pick<BotBrain, "booking" | "events" | "closedOnHolidays">, date: string): { hours: string; why?: string } {
  const events = (brain.events || []).filter((e) => e.effect !== "info" && eventOn(e, date));
  const closed = events.find((e) => e.effect === "closed");
  if (closed) return { hours: "", why: closed.title };
  const changed = events.find((e) => e.effect === "hours" && ranges(e.hours || "").length);
  if (changed) return { hours: String(changed.hours), why: changed.title };
  if (brain.closedOnHolidays !== false) {
    const holiday = officialHoliday(date);
    if (holiday) return { hours: "", why: holiday };
  }
  return { hours: brain.booking.hours[String(weekdayOf(date))] || "" };
}

export function freeSlots(
  booking: BookingHours,
  busy: { start: string; end: string }[],
  fromDate: string,
  days: number,
  hoursFor: (date: string) => string = (date) => booking.hours[String(weekdayOf(date))] || ""
): string[] {
  const now = israelNow();
  const earliest = `${now.date}T${fromMinutes(Math.min(toMinutes(now.time) + 60, 24 * 60 - 1))}`; // not within the next hour
  const step = Math.max(10, Number(booking.slotMinutes) || 30);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    for (const [a, b] of ranges(hoursFor(date))) {
      for (let t = a; t + step <= b; t += step) {
        const start = `${date}T${fromMinutes(t)}`;
        const end = `${date}T${fromMinutes(t + step)}`;
        if (start < earliest) continue;
        if (busy.some((x) => x.start < end && x.end > start)) continue;
        out.push(start);
      }
    }
  }
  return out;
}

// ---------- the answer's shape ----------

// The model's final text → { reply, options, images }. Tolerates code fences, a JSON string inside
// "output", n8n-style list_options (sections / options) and plain text (= the reply itself).
// A line break typed inside a JSON string (not allowed in JSON) → \\n, so the answer still parses
function escapeRawNewlines(t: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr && c === "\\") {
      out += c + (t[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === '"') inStr = !inStr;
    out += inStr && c === "\n" ? "\\n" : inStr && c === "\r" ? "" : c;
  }
  return out;
}

export function parseBotAnswer(raw: string): { reply: string; options: string[]; images: string[] } {
  let s = String(raw || "").replace(/[  ᠎ -​  　﻿]/g, " ").trim();
  while (/^```(?:json)?/i.test(s) || /```\s*$/.test(s)) s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let obj: any = null;
  const tryParse = (t: string) => {
    try {
      const v = JSON.parse(t);
      return v && typeof v === "object" ? v : null;
    } catch {
      return null;
    }
  };
  obj = tryParse(s) || tryParse(escapeRawNewlines(s));
  if (!obj) {
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a !== -1 && b > a) obj = tryParse(s.slice(a, b + 1)) || tryParse(escapeRawNewlines(s.slice(a, b + 1)));
  }
  // the model sometimes leaves out the opening {"reply": " and writes the text, then ","options":[…]}
  // (Haim, 2026-10-23: the customer got the JSON's tail in the message)
  if (!obj && /"\s*,\s*"(?:options|images)"\s*:/.test(s) && !/^\s*\{/.test(s)) {
    obj = tryParse(escapeRawNewlines('{"reply":"' + s.replace(/^\s*"?/, "")));
  }
  for (let i = 0; obj && i < 3 && typeof obj.output === "string" && !obj.reply; i++) obj = tryParse(obj.output) || { reply: obj.output };
  if (!obj) {
    // still broken: the text up to where the JSON's other fields start, never the JSON itself
    const cut = s.search(/"\s*,\s*"(?:options|images|buttons)"\s*:/);
    const m = cut === -1 && s.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) return { reply: m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'), options: [], images: [] };
    const text = (cut === -1 ? s : s.slice(0, cut)).replace(/^\s*\{\s*"reply"\s*:\s*"/, "").replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    const arr = s.match(/"options"\s*:\s*(\[[^\]]*\])/);
    const options = ((arr && tryParse(arr[1])) || []).map((o: any) => String(o).trim()).filter(Boolean).slice(0, 10);
    return { reply: text, options, images: [] };
  }
  const title = (o: any) => String(typeof o === "string" ? o : o?.title || o?.text || o?.label || "").trim();
  let opts: any[] = [];
  if (Array.isArray(obj.options)) opts = obj.options;
  else if (Array.isArray(obj.buttons)) opts = obj.buttons;
  else if (Array.isArray(obj.list_options)) opts = obj.list_options;
  else if (obj.list_options) {
    if (Array.isArray(obj.list_options.options)) opts = obj.list_options.options;
    for (const sec of obj.list_options.sections || []) opts = opts.concat(sec.options || sec.rows || []);
  }
  const images = (Array.isArray(obj.images) ? obj.images : [])
    .map((x: any) => (typeof x === "string" ? x : x?.url || x?.link || ""))
    .filter((u: string) => /^https?:\/\//.test(u));
  let reply = String(obj.reply ?? obj.text ?? obj.message ?? "").trim();
  // an image address written into the text goes out as an image
  const inText = reply.match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/gi) || [];
  for (const u of inText) if (!images.includes(u)) images.push(u);
  if (inText.length) reply = reply.replace(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)(?:\?\S*)?/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  return { reply, options: opts.map(title).filter(Boolean).slice(0, 10), images };
}

// ---------- the prompt ----------

// verified = the phone is the channel's own (WhatsApp); on the website it's whatever the visitor
// typed, so the staff's internal notes are left out there
function customerSection(c: any, phone: string, verified: boolean): string {
  if (!phone) return "לא ידוע מי הלקוח (אין מספר טלפון).";
  if (!c) return `טלפון: ${phone}. לא ניתן היה לקרוא את פרטי הלקוח מה-CRM כרגע.`;
  const lines: string[] = [`טלפון: ${phone}`];
  if (!c.found) lines.push("הלקוח עדיין לא רשום ב-CRM (לקוח חדש).");
  else {
    if (c.name) lines.push(`שם: ${c.name}`);
    if (c.stage) lines.push(`שלב ב-CRM: ${c.stage}`);
    if (c.city) lines.push(`עיר: ${c.city}`);
    if (c.firstContact) lines.push(`פנה לראשונה: ${String(c.firstContact).slice(0, 10)}`);
    if (c.campaign) lines.push(`הגיע מקמפיין: ${c.campaign}`);
    if (c.purchases?.length) lines.push("רכישות:\n" + c.purchases.map((p: any) => `- ${p.date} ${p.what} (${p.status})`).join("\n"));
    if (c.orderStatus) lines.push(`מצב ההזמנה האחרונה: ${c.orderStatus}`);
    if (verified && c.recentNotes?.length) lines.push("הערות פנימיות של הצוות (לרקע בלבד, לא לצטט ללקוח):\n" + c.recentNotes.map((n: any) => `- ${String(n.at).slice(0, 10)}: ${n.text}`).join("\n"));
  }
  if (c.upcomingExams?.length) lines.push("תורים קרובים ביומן:\n" + c.upcomingExams.map((x: any) => `- ${showSlot(x.start)} (exam_id: ${x.id})`).join("\n"));
  else lines.push("אין לו תור קרוב ביומן.");
  if (c.campaigns?.length) {
    lines.push(
      "הודעות וואטסאפ (קמפיינים) שהלקוח קיבל לאחרונה — אם הוא שואל על הודעה שקיבל, זו ההודעה:\n" +
        c.campaigns.map((k: any) => `- ${String(k.sentAt).slice(0, 10)} "${k.name}": ${k.text}${k.replied ? ` (הלקוח ענה: ${k.replied})` : ""}`).join("\n")
    );
  }
  return lines.join("\n");
}

// What the customer's message answers (Haim, 2026-10-23): someone who got a campaign just replies
// "כמה זה עולה?" / "מעוניין" / presses its button, without saying what about. The campaign is the
// context when the customer quoted it, pressed its button, or it is the last thing they got from us
// (sent in the last 7 days and after the last message in this chat). A click-to-WhatsApp ad, too.
const CAMPAIGN_DAYS = 7;
export function replyContext(input: TurnInput, customer: any, lastChatAt: string): string {
  const lines: string[] = [];
  const ad = input.waContext?.ad;
  if (ad && (ad.headline || ad.body)) {
    lines.push(
      `הלקוח הגיע עכשיו בלחיצה על מודעה${ad.sourceType ? ` (${ad.sourceType})` : ""}: ${ad.headline ? `«${ad.headline}»` : ""}${ad.body ? ` — ${ad.body}` : ""}. ענה בהקשר המודעה, בלי לשאול על מה הוא פונה.`
    );
  }
  const campaigns = (customer?.campaigns || []).filter((k: any) => k?.sentAt).sort((a: any, b: any) => String(b.sentAt).localeCompare(String(a.sentAt)));
  const replyTo = input.waContext?.replyTo;
  const quoted = replyTo ? campaigns.find((k: any) => [k.messageId, k.wamid, k.waMessageId].some((id) => id && String(id) === replyTo)) : null;
  const latest = campaigns[0];
  const sentMs = latest ? new Date(latest.sentAt).getTime() : NaN;
  const fresh = !isNaN(sentMs) && Date.now() - sentMs < CAMPAIGN_DAYS * 864e5 && (!lastChatAt || sentMs > new Date(lastChatAt).getTime());
  const k = quoted || ((input.waContext?.templateButton || replyTo || fresh) && latest) || null;
  if (k) {
    const sure = quoted || input.waContext?.templateButton;
    lines.push(
      `ההודעה של הלקוח ${sure ? "היא תגובה" : "היא כנראה תגובה"} להודעת הקמפיין "${k.name || ""}" שנשלחה אליו ב-${String(k.sentAt).slice(0, 10)}:\n«${String(k.text || "").slice(0, 1500)}»\n` +
        `הלקוח לא יכתוב על מה הוא עונה (למשל "כמה זה עולה?", "מעוניין", "פרטים", "עד מתי?") — ענה בהקשר ההודעה הזו ואל תשאל אותו על מה מדובר. אם ההודעה שלו ברור שלא קשורה לקמפיין — ענה כרגיל.`
    );
  }
  return lines.join("\n");
}

// Haim, 2026-10-23: the prompt from n8n still says the aid days are "in Harish on 13/02", and the
// bot kept answering that over the calendar. A line that dates an aid day / a visit / a sales day is
// taken out of the prompt and the Q&A before the bot reads them — the calendar is the only source.
const EVENT_WORDS = /סיוע|ביקור|יום מכירות|ימי מכירות|נהיה ב|נגיע ל|מגיעים ל|יוצאים ל|נמצאים ב/;
const DATE_WORDS = /\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b|ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר/;
const EVENT_DATE_LINE = (line: string) => EVENT_WORDS.test(line) && DATE_WORDS.test(line);
export const withoutEventDates = (text: string) =>
  String(text || "")
    .split("\n")
    .filter((line) => !EVENT_DATE_LINE(line))
    .join("\n");

// What's coming up that isn't the usual week: the owner's events (aid days, closures, short hours,
// a branch opening) and, when the business closes on them, the official holidays — so the bot can
// answer "are you open on…?" and mention what's relevant.
const EVENTS_AHEAD = 120;
const HOLIDAYS_AHEAD = 60;
function eventsSection(brain: BotBrain, today: string): string {
  const until = addDays(today, EVENTS_AHEAD);
  const span = (e: BotEvent) => (e.to && e.to !== e.from ? `${showDay(e.from)} עד ${showDay(e.to)}` : showDay(e.from));
  const effect = (e: BotEvent) => (e.effect === "closed" ? " — סגור, לא קובעים תורים" : e.effect === "hours" ? ` — שעות קבלה: ${e.hours}` : "");
  const lines = (brain.events || [])
    .filter((e) => (e.to || e.from) >= today && e.from <= until)
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((e) => `- ${span(e)}: ${e.title}${e.place?.trim() ? ` 📍 ${e.place.trim()}` : ""}${effect(e)}${e.details?.trim() ? `. ${e.details.trim()}` : ""}`);
  if (brain.closedOnHolidays !== false) {
    for (let i = 0; i < HOLIDAYS_AHEAD; i++) {
      const d = addDays(today, i);
      const h = officialHoliday(d);
      if (h) lines.push(`- ${showDay(d)}: ${h} — סגור (חג)`);
    }
  }
  // Haim, 2026-10-23: asked "when are the aid days?" the bot answered with Harish in February —
  // an old date in the prompt — while the calendar had October. The calendar is the only source.
  return (
    "\n# אירועים וימים מיוחדים (מהיומן — המקור היחיד לתאריכים שלהם)\n" +
    (lines.length ? lines.join("\n") : "- כרגע אין ביומן אירועים מתוכננים (ימי סיוע, ביקורים בישובים וכו').") +
    "\n- אם בשיחה הזו אמרת קודם תאריך של אירוע שלא מופיע ברשימה (למשל מהשכל הישן) — הוא שגוי: אל תחזור עליו, ותקן (\"סליחה, טעיתי קודם — ...\").\n- תאריכים של ימי סיוע, ביקורים בישובים / באזורים, ימי פתיחה ואירועים — רק מהרשימה הזו. תאריכים כאלה שכתובים בשכל או בשאלות ותשובות ישנים — לעולם אל תשתמש בהם ואל תזכיר אותם. אם הלקוח שואל על אירוע / מקום שאין ברשימה — אמור שכרגע אין מועד מתוכנן (בלי להמציא ובלי להעביר לנציג)." +
    "\n- כשהלקוח שואל מתי אתם במקום / באזור מסוים (למשל \"מתי אתם במשגב?\") — חפש ברשימה אירוע באותו מקום או קרוב אליו (אותו אזור, עד כחצי שעה נסיעה — למשל משגב ↔ כרמיאל, סכנין, מעלות; פרדס חנה ↔ חדרה, זכרון יעקב) לפי 📍, הכותרת והפרטים, וענה עם התאריכים והמקום המדויק (\"אנחנו לא במשגב עצמה, אבל ב-3/11 נהיה בכרמיאל — 15 דקות ממך\"). אם אין שום אירוע באזור — אמור שכרגע לא מתוכנן והצע את הסניף.\n- כשהלקוח שואל אם פתוחים / מתי אפשר להגיע / על סניף — ענה לפי הרשימה הזו. אם יש כאן משהו שקשור למה שהלקוח מתעניין בו (למשל פתיחת סניף באזור שלו, יום סיוע) — הזכר אותו בקצרה." +
    // Haim, 2026-10-28: a customer whose glasses were ready at the branch said "אגיע היום" and was
    // told that today's pickup is in Harish — an event announced only to the customers who ordered there
    "\n- איסוף משקפיים / יום סיוע / ביקור במקום מסוים — רק ללקוח שקיבל עליו הודעה (מופיע אצלו ב\"הודעות וואטסאפ שהלקוח קיבל לאחרונה\") או ששואל עליו בעצמו. לקוח שההזמנה שלו הגיעה לסניף / מוכנה לאיסוף, או שאומר \"אגיע\" / \"אגיע היום\" בלי להזכיר את האירוע — אוסף בסניף, בכתובת ובשעות הפתיחה של העסק: אל תציע לו את האיסוף באירוע ואל תחבר אותו אליו."
  );
}

function systemPrompt(input: TurnInput, customer: any, phone: string, ctx: { firstToday: boolean; profileName: string; lastChatAt: string }): string {
  const now = israelNow();
  const qa = input.brain.qa.filter((x) => x.q.trim() && x.a.trim() && !EVENT_DATE_LINE(`${x.q} ${x.a}`));
  const lessons = input.lessons.filter((l) => l.active);
  const booking = input.brain.booking;
  const bookingOn = booking.enabled && Object.values(booking.hours).some((h) => ranges(h).length);
  const business = input.agent?.businessName || input.agent?.name || "העסק";
  const web = input.channel === "web" || input.channel === "test";
  return [
    `אתה הנציג הדיגיטלי של "${business}" ומדבר עם לקוח ${web ? "בצ'אט באתר של העסק" : "בוואטסאפ (מספר הטלפון שלו ידוע ומאומת — אל תבקש אותו)"}.`,
    `עכשיו: יום ${DAY_NAMES[now.weekday]} ${now.date.slice(8, 10)}/${now.date.slice(5, 7)}/${now.date.slice(0, 4)}, השעה ${now.time} (שעון ישראל).`,
    "",
    "# השכל של הבוט (ההנחיות של העסק — הבסיס לכל תשובה)",
    withoutEventDates(input.brainText).trim() || "(לא הוגדרו הנחיות)",
    qa.length ? "\n# שאלות ותשובות של העסק (תשובה מכאן גוברת על ניסוח אחר)\n" + qa.map((x) => `ש: ${x.q.trim()}\nת: ${x.a.trim()}`).join("\n\n") : "",
    lessons.length
      ? "\n# דברים שלמדת משיחות קודמות (תקן לפיהם; הם לא משנים מחירים, מבצעים או מדיניות שכתובים בשכל)\n" + lessons.map((l) => `- ${l.text}`).join("\n")
      : "",
    "\n# מה ידוע על הלקוח הזה (מה-CRM)",
    customerSection(customer, phone, !web),
    (() => {
      const c = replyContext(input, customer, ctx.lastChatAt);
      return c ? "\n# על מה הלקוח עונה עכשיו\n" + c : "";
    })(),
    eventsSection(input.brain, now.date),
    "\n# פתיחה ושם",
    ctx.profileName ? `שם הלקוח בפרופיל ${web ? "שמסר" : "הוואטסאפ"}: ${ctx.profileName}` : "",
    customer?.name ? `שם הלקוח ב-CRM: ${customer.name}` : "",
    "- פנה ללקוח בשמו הפרטי. יש שני מקורות (הפרופיל וה-CRM) — בחר את מה שנראה כמו שם אמיתי של אדם (לא כינוי, אימוג'י, שם עסק או מספר). אם אף אחד לא נראה כמו שם — בלי שם.",
    ctx.firstToday
      ? `- זו התשובה הראשונה שלך ללקוח היום: פתח בברכה חמה + שמו. ${greetingContext(israelNow())}.` +
        (customer?.found ? " הלקוח כבר מוכר לנו — הראה שמכירים אותו (למשל \"שמחים לשמוע ממך שוב\"), ואם יש משהו פתוח שלו (הזמנה, תור) — התייחס." : "") +
        (customer?.upcomingExams?.length ? ` יש לו תור קרוב (${showSlot(customer.upcomingExams[0].start)}) — הזכר אותו, והוסף ל-options את \"🔄 לדחות / לשנות את התור\".` : "")
      : "- כבר דיברתם היום — אל תפתח שוב בברכה, המשך את השיחה.",
    "\n# כללי עבודה",
    "- ענה בעברית, קצר, חם ואנושי, בסגנון שבשכל. אל תמציא מידע שלא כתוב כאן; כשלא יודעים — אמור בכנות שאין לך את המידע כרגע. אל תכתוב בתשובה הצעה לפנות לנציג / שנציג יחזור אליו — רק הוסף ל-options את \"🙋 לדבר עם נציג\", והלקוח יבחר אם לבקש.",
    "- השתמש במה שאתה יודע על הלקוח: פנה בשמו, ואם יש לו הזמנה פתוחה / תור קרוב / קמפיין שקיבל — התייחס לזה כשזה רלוונטי, גם לפני שהוא שואל.",
    web && !phone
      ? '- באתר אתה לא יודע מי הלקוח. כשזה עוזר לו (קביעת / שינוי תור, בדיקת הזמנה, שאלה על הודעה שקיבל, או אחרי שעזרת בשאלה הראשונה) בקש בנימוס את מספר הנייד, למשל: "כדי שאוכל לבדוק את זה בשבילך, אפשר את מספר הנייד שלך? 🙂". כשהוא נותן מספר — קרא ל-link_customer_phone.'
      : "",
    bookingOn
      ? "- קביעת תור (ההוראה הזו גוברת על כל הוראה בשכל לשלוח קישור לקביעת תור — יש לך גישה ישירה ליומן): כשהלקוח רוצה לתאם / לקבוע תור (גם בלחיצה על כפתור כמו \"תיאום תור\") — אל תסתפק בשליחת קישור: הצע לתאם איתך כאן בצ'אט עכשיו, ואם בשכל יש קישור לקביעה עצמית — הוסף אותו כאפשרות נוספת למי שמעדיף. כדי לתאם: קרא ל-get_available_slots. בתשובה כתוב קודם באופן כללי באילו ימים ושעות מקבלים לבדיקה (receptionHours), ואם בתוצאה יש specialDays — ציין בקצרה איזה יום סגור / בשעות אחרות ולמה, ואז ב-options בדיוק את המועדים שב-suggested (שתיים מכל יום, כולל שישי — הטקסט שב-button) ובסוף \"📅 שבוע הבא\" ו-\"🕐 מועד אחר\". בחר \"שבוע הבא\" — קרא שוב ל-get_available_slots עם week_after = המועד האחרון מבין הכפתורים שהצגת, בפורמט YYYY-MM-DDTHH:mm והצג באותו אופן; \"מועד אחר\" — שאל איזה יום / שעה מתאימים לו ובחר מ-allFree. כשהלקוח לוחץ על מועד — זה התאריך והשעה שבכפתור (השנה מהתאריך של היום). לעולם אל תקבע / תזיז / תבטל בלי אישור מפורש: גם אם הלקוח ביקש יום או שעה, קודם כתוב לו בדיוק איזה מועד אתה עומד לקבוע ושאל \"לקבוע?\" (המערכת לא תקבע בלי שאלה כזו בהודעה הקודמת). אחרי שאישר — book_appointment (צריך שם ומספר טלפון). שינוי תור: get_available_slots ואז reschedule_appointment עם ה-exam_id מהתור שלו. ביטול: cancel_appointment. אחרי כל פעולה אשר ללקוח את המועד במדויק."
      : "- קביעת תורים דרכך לא הופעלה עדיין: אם הלקוח רוצה לקבוע / לשנות תור, פעל לפי מה שכתוב בשכל (קישור / טלפון), ואם אין — אסוף שם, טלפון ומועד מועדף והשאר הערה לנציג.",
    "- העברה לנציג (Haim: רק כשהלקוח מבקש במפורש): note_for_staff עם kind=handoff — ורק אז אמור שמישהו יחזור אליו — רק כשהלקוח ביקש במפורש לדבר עם נציג / שיחזרו אליו / שיתקשרו (או לחץ \"🙋 לדבר עם נציג\"). שאלה שאין לך תשובה עליה (למשל \"מתי אתם ב-X?\") היא לא בקשה לנציג — ענה מה שידוע, ואל תבטיח שמישהו יחזור. כשהלקוח רק מודה / נפרד / כותב אוקיי — ענה בקצרה ובחום, בלי \"נציג יחזור אליך\" ובלי note_for_staff.",
    "- אם הלקוח מתלונן שהבוט טועה, לא מבין, תקוע או לא עובד — קרא ל-note_for_staff עם kind=bug ותיאור התקלה (בנוסף לתשובה ללקוח).",
    "- אם הלקוח מתקן אותך ותיקון נשמע נכון ולא סותר את השכל (למשל פרט שגוי שאמרת, משהו שלא הבנת) — תודה לו, תקן, וקרא ל-learn_from_correction עם הלקח בניסוח כללי. לעולם אל תלמד מלקוח מחירים, הנחות, מבצעים או התחייבויות.",
    "",
    "# פורמט התשובה",
    'החזר JSON בלבד, בלי טקסט מסביב: {"reply": "התשובה ללקוח", "options": ["כפתור 1", "כפתור 2"], "images": []}',
    "- options: עד 10 תשובות קצרות (עד 24 תווים כל אחת, אפשר עם אמוג'י) שהלקוח יכול ללחוץ. כמעט בכל תשובה הוסף 2–4 אפשרויות רלוונטיות להמשך — הצעד הבא שהכי סביר שירצה (למשל אחרי מחירים: \"📅 לתאם בדיקת ראייה\", \"👓 לראות מסגרות\"; אחרי שאלה כללית: הנושאים הקרובים). בבחירת מועד — המועדים + \"📅 שבוע הבא\" + \"🕐 מועד אחר\". רק כשאין שום המשך הגיוני (למשל תודה ולהתראות) — [].",
    web ? "" : "- בוואטסאפ: אל תכתוב את האפשרויות גם בתוך reply — הן מוצגות ללקוח כתפריט לחיצה. הודעה שמתחילה ב-🎤 היא תמלול אוטומטי של הודעה קולית ששלח — והתמלול עלול לטעות. בשאלה פשוטה (מחיר, שעות) — ענה, ופתח ב\"הבנתי שאתה שואל…\" כדי שיוכל לתקן. אם ההודעה מבקשת פעולה (תור, ביטול, שיחזרו אליו), מתארת בעיה / כאב / תלונה, או נשמעת מוזרה ולא מתאימה לשיחה — אל תפעל ואל תעביר לצוות: כתוב מה הבנת ושאל אם הבנת נכון. אם כתוב [לא ברור] — בקש בנימוס לכתוב או להקליט שוב.",
    "- images: כתובות תמונה מלאות מהשכל, רק כשמתאים להראות.",
    "- עיצוב: הודעה נעימה לקריאה בטלפון — שורה ריקה בין חלקים, אמוג'י מתאימים ליד נושאים ופריטים (בערך 2–5 בהודעה, לא בכל שורה), רשימות עם • בתחילת שורה (לא כוכבית ולא מקף).",
    "- הדגשה: כוכבית אחת צמודה למילים המודגשות מבפנים, ורווח לפניה ואחריה מבחוץ, למשל \"אתה מקבל *משקפי שמש במתנה* החודש\" או *800 ₪* (לא \"מקבל*משקפי*\") — לדברים החשובים (מחירים, מועדים, מה שהלקוח שאל). בלי ** ובלי markdown אחר.",
  ]
    .filter((x) => x !== "")
    .join("\n");
}

// ---------- tools ----------

const TOOLS = [
  {
    name: "link_customer_phone",
    description: "מקשר את השיחה ללקוח לפי מספר הנייד שנתן, ומחזיר מה ה-CRM יודע עליו (שם, רכישות, תורים, קמפיינים).",
    parametersJsonSchema: { type: "object", properties: { phone: { type: "string", description: "מספר הטלפון כפי שהלקוח כתב" } }, required: ["phone"] },
  },
  {
    name: "get_available_slots",
    description: "מועדים פנויים לתור ביומן הסניף.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        from_date: { type: "string", description: "YYYY-MM-DD, ברירת מחדל היום" },
        week_after: { type: "string", description: "ללחיצה על \"שבוע הבא\": המועד האחרון שהצעת ללקוח (YYYY-MM-DDTHH:mm) — מחזיר את השבוע שאחריו (מיום ראשון)" },
        days: { type: "number", description: "כמה ימים לבדוק, ברירת מחדל 7" },
        time_of_day: { type: "string", enum: ["any", "morning", "afternoon", "evening"], description: "העדפת הלקוח" },
      },
    },
  },
  {
    name: "book_appointment",
    description: "קובע תור ביומן הסניף. רק אחרי שהלקוח בחר מועד מתוך get_available_slots ואישר.",
    parametersJsonSchema: {
      type: "object",
      properties: { start: { type: "string", description: "YYYY-MM-DDTHH:mm" }, customer_name: { type: "string" } },
      required: ["start", "customer_name"],
    },
  },
  {
    name: "reschedule_appointment",
    description: "מזיז תור קיים של הלקוח למועד חדש (מועד פנוי מ-get_available_slots).",
    parametersJsonSchema: {
      type: "object",
      properties: { exam_id: { type: "string" }, new_start: { type: "string", description: "YYYY-MM-DDTHH:mm" } },
      required: ["exam_id", "new_start"],
    },
  },
  {
    name: "cancel_appointment",
    description: "מבטל תור קיים של הלקוח, אחרי שאישר שהוא רוצה לבטל.",
    parametersJsonSchema: { type: "object", properties: { exam_id: { type: "string" } }, required: ["exam_id"] },
  },
  {
    name: "note_for_staff",
    description: "הערה לצוות העסק. handoff = הבטחת שמישהו יחזור / יטפל; bug = הלקוח מדווח שהבוט טועה או לא עובד.",
    parametersJsonSchema: {
      type: "object",
      properties: { kind: { type: "string", enum: ["handoff", "bug"] }, text: { type: "string", description: "מה צריך לעשות / מה התקלה, בקצרה" } },
      required: ["kind", "text"],
    },
  },
  {
    name: "learn_from_correction",
    description: "שומר לקח מתיקון נכון של הלקוח, כדי לא לחזור על הטעות בשיחות הבאות.",
    parametersJsonSchema: {
      type: "object",
      properties: { lesson: { type: "string", description: "הלקח בניסוח כללי, למשל: 'החניה היא מאחורי הבניין, לא ברחוב'" }, customer_said: { type: "string" } },
      required: ["lesson"],
    },
  },
];

interface TurnState {
  phone: string;
  name: string;
  customer: any;
  notes: BotNote[];
  slotsOffered: Set<string>;
  confirmed: string; // what the bot asked to confirm in its last message (the customer answers now)
  pending: string; // what this answer asks the customer to confirm
  voice: boolean; // this message is a transcribed voice note
  userText: string; // what the customer wrote this turn
  earlierUserText: string; // the customer's two messages before it (a request for a person may come first)
}

const recentUserText = (st: TurnState) => `${st.earlierUserText}\n${st.userText}`;

// Haim, 2026-10-23: the bot booked a day the customer only mentioned, and acted on a voice note it
// heard wrong ("it hurts" — never said). So booking / moving / cancelling, and acting on a voice note
// (a note for the staff, a lesson), go in two turns: first the bot says what it's about to do / what
// it heard and asks, and only on the customer's next message is the action allowed.
function needsConfirmation(st: TurnState, key: string, ask: string): any | null {
  if (st.confirmed === key) return null;
  st.pending = key;
  return { ok: false, needs_confirmation: true, instruction: ask };
}

// The buttons under a confirmation question, set here and not by the model (Haim, 2026-10-23: it
// wrote "כן, תעדיף להזיז" / "לא, לבטל" — cancel the appointment, or the request to move it?).
// Each says exactly what happens; WhatsApp cuts a button at 24 characters.
const CONFIRM_OPTIONS: Record<string, string[]> = {
  book: ["✅ כן, לקבוע את התור", "🔄 לבחור מועד אחר"],
  move: ["✅ כן, להעביר את התור", "🔄 לבחור מועד אחר", "↩️ להשאיר את התור הקיים"],
  cancel: ["🗑️ כן, לבטל את התור", "↩️ לא, להשאיר את התור"],
  voice: ["✅ כן, הבנת נכון", "✏️ לא, אכתוב שוב"],
};

// Haim, 2026-10-23: the bot passed the chat to the staff when the customer only said "thank you"
// (the model closes with "someone will get back to you" and the prompt makes that a handoff, or it
// finishes a handoff it was told to hold for a voice note). A thank-you / goodbye / ok is never a
// request, and a "yes" to a voice note is the only answer that lets that note through.
const JUST_CLOSING = /^(?:תודה(?: רבה| רבה לך| לך)?|תודה רבה רבה|תנקס|thanks?|thank you|תודה ו?להתראות|להתראות|ביי|bye|יום טוב|ערב טוב|לילה טוב|שבוע טוב|שבת שלום|אוקי(?:י)?|ok(?:ay)?|סבבה|מעולה|יופי|אחלה|מצוין|בסדר|הבנתי|קיבלתי|👍|🙏|❤️|😊|🙂)[\s!.,🙏👍❤️😊🙂🌹]*$/i;
// The customer asking for a person: a representative, someone to call / get back, a human
const ASKS_FOR_PERSON = /נציג|בן[\s-]?אדם|אנושי|לדבר עם (?:מישהו|מישהי|אדם|בעל|המנהל|מנהל|צוות|חיים)|שיחזרו|תחזרו|תחזור אליי|תחזרי|יחזרו אלי|תתקשרו|תתקשר|תתקשרי|שיתקשרו|להתקשר אלי|צלצלו|תצלצלו|מנהל|human|agent|representative|call me/i;

const SAID_YES = /^(?:✅\s*)?(?:כן|נכון|בדיוק|כן,? נכון|נכון מאוד|כן כן|אכן|yes|yep|👍)(?:[\s,!.].*)?$/i;

const VOICE_ASK =
  "זו הודעה קולית, והתמלול עלול לטעות. אל תפעל לפיה עדיין: כתוב ללקוח בקצרה מה הבנת (\"הבנתי שאמרת ש…\") ושאל אם הבנת נכון. הכפתורים נקבעים אוטומטית. רק אחרי שיאשר — תפעל.";

// The events added to the branch calendar in the CRM ("אירוע / חסימה" — aid days, a closure, a
// branch opening), as the bot's own events. A whole closed day closes the day; closed hours are
// already busy on the calendar (so no slots then) and are only told; info is told.
async function readCalendarEvents(deps: TurnDeps): Promise<BotEvent[]> {
  if (!deps.crm) return [];
  const today = israelNow().date;
  try {
    const r = await deps.crm({ action: "events", from: today, to: addDays(today, 120) });
    const now = israelNow();
    // an event that already ended today (a morning aid day asked about in the evening) isn't coming up
    const over = (e: any) => !e.allDay && String(e.to || e.from) === now.date && String(e.endTime || "") !== "" && String(e.endTime) <= now.time;
    return (r?.events || []).filter((e: any) => !over(e)).map((e: any): BotEvent => {
      const hours = e.allDay ? "" : ` (${e.effect === "closed" ? "סגור " : ""}${e.startTime}–${e.endTime})`;
      return {
        id: `crm_${e.id}`,
        from: String(e.from),
        to: e.to && e.to !== e.from ? String(e.to) : "",
        title: `${e.title}${hours}`,
        details: e.details || "",
        place: e.place || "",
        effect: e.allDay && e.effect === "closed" ? "closed" : "info",
      };
    });
  } catch (e: any) {
    console.warn("[BOT] CRM events read failed:", e?.message);
    return [];
  }
}

async function readCustomer(deps: TurnDeps, phone: string): Promise<any> {
  if (!deps.crm || !phone) return null;
  try {
    return await deps.crm({ action: "customer", phone });
  } catch (e: any) {
    console.warn("[BOT] CRM customer read failed:", e?.message);
    return null;
  }
}

async function runTool(name: string, args: any, input: TurnInput, deps: TurnDeps, st: TurnState): Promise<any> {
  const test = input.channel === "test";
  const agentId = String(input.agent.id);
  const botId = String(input.agent.botId || "");
  switch (name) {
    case "link_customer_phone": {
      const phone = normalizeIsraeliPhone(args?.phone);
      if (!phone) return { ok: false, error: "המספר לא נראה כמו מספר טלפון ישראלי תקין — בקש שוב בנימוס" };
      st.phone = phone;
      st.customer = await readCustomer(deps, phone);
      if (st.customer?.name && !st.name) st.name = st.customer.name;
      return { ok: true, customer: customerSection(st.customer, phone, false) };
    }
    case "get_available_slots": {
      const b = input.brain.booking;
      if (!b.enabled) return { ok: false, error: "קביעת תורים דרך הבוט לא מופעלת — פעל לפי השכל או השאר הערה לנציג" };
      if (!deps.crm) return { ok: false, error: "אין חיבור ליומן — השאר הערה לנציג" };
      const today = israelNow().date;
      // "next week" = the week after the last slot already offered (Haim, 2026-10-23), from its Sunday
      const weekAfter = /^\d{4}-\d{2}-\d{2}/.test(String(args?.week_after || "")) ? String(args.week_after).slice(0, 10) : "";
      const nextSunday = weekAfter ? addDays(weekAfter, 7 - weekdayOf(weekAfter)) : "";
      const asked = nextSunday || (/^\d{4}-\d{2}-\d{2}$/.test(String(args?.from_date || "")) ? String(args.from_date) : "");
      const from = asked && asked > today ? asked : today;
      const days = Math.min(Math.max(Number(args?.days) || 7, 1), Math.max(b.daysAhead || 14, 1));
      const to = addDays(from, days - 1);
      const r = await deps.crm({ action: "busy", from, to });
      if (!r?.configured) return { ok: false, error: "יומן הסניף לא מחובר — השאר הערה לנציג" };
      const hoursFor = (d: string) => dayHours(input.brain, d).hours;
      let slots = freeSlots(b, r.busy || [], from, days, hoursFor);
      // days in the range that aren't as usual, so the bot can say why ("closed — aid days")
      const specialDays: { date: string; hours: string; why: string }[] = [];
      for (let i = 0; i < days; i++) {
        const d = addDays(from, i);
        const rule = dayHours(input.brain, d);
        if (rule.why) specialDays.push({ date: showDay(d), hours: rule.hours || "סגור", why: rule.why });
      }
      const tod = String(args?.time_of_day || "any");
      const hour = (s: string) => Number(s.slice(11, 13));
      if (tod === "morning") slots = slots.filter((s) => hour(s) < 12);
      else if (tod === "afternoon") slots = slots.filter((s) => hour(s) >= 12 && hour(s) < 16);
      else if (tod === "evening") slots = slots.filter((s) => hour(s) >= 16);
      slots.forEach((s) => st.slotsOffered.add(s));
      // Haim, 2026-10-23: first the week's reception days and hours in general, then 2 times from
      // each day (Friday too) as the buttons — the earliest and one later in the day
      const byDay = new Map<string, string[]>();
      for (const x of slots) byDay.set(x.slice(0, 10), [...(byDay.get(x.slice(0, 10)) || []), x]);
      const suggested: string[] = [];
      for (const list of byDay.values()) {
        suggested.push(list[0]);
        if (list.length > 1) suggested.push(list[Math.max(1, Math.floor(list.length * 0.6))]);
      }
      const receptionHours = [0, 1, 2, 3, 4, 5, 6]
        .filter((d) => ranges(b.hours[String(d)] || "").length)
        .map((d) => `${DAY_NAMES[d]} ${String(b.hours[String(d)]).replace(/\s+/g, " ").trim()}`)
        .join(", ");
      return {
        ok: true,
        receptionHours,
        // closed / different hours in this range — say so (and why) when it matters to the customer
        ...(specialDays.length ? { specialDays } : {}),
        suggested: suggested.slice(0, 8).map((s) => ({ start: s, button: slotButton(s) })),
        allFree: slots.slice(0, 40).map((s) => ({ start: s, show: showSlot(s) })),
        lastSuggested: suggested.slice(0, 8).slice(-1)[0] || null,
      };
    }
    case "book_appointment":
    case "reschedule_appointment": {
      const start = String(args?.start || args?.new_start || "");
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return { ok: false, error: "מועד לא תקין" };
      if (!st.phone) return { ok: false, error: "צריך קודם את מספר הנייד של הלקוח (link_customer_phone)" };
      if (!deps.crm || !input.brain.booking.enabled) return { ok: false, error: "אין גישה ליומן" };
      // the slot must still be free right now
      const r = await deps.crm({ action: "busy", from: start.slice(0, 10), to: start.slice(0, 10) });
      if (!freeSlots(input.brain.booking, r?.busy || [], start.slice(0, 10), 1, (d) => dayHours(input.brain, d).hours).includes(start)) {
        return { ok: false, error: "המועד הזה כבר לא פנוי — הצע מועדים אחרים" };
      }
      const examId = String(args?.exam_id || "");
      const key = name === "book_appointment" ? `book|${start}` : `move|${examId}|${start}`;
      const was = st.customer?.upcomingExams?.find((x: any) => String(x.id) === examId)?.start;
      const ask = needsConfirmation(
        st,
        key,
        name === "book_appointment"
          ? `עוד לא נקבע כלום. שאל את הלקוח: \"לקבוע לך תור ל*${showSlot(start)}*?\". הכפתורים נקבעים אוטומטית (${CONFIRM_OPTIONS.book.join(" / ")}). אחרי שיאשר — קרא שוב עם אותו מועד בדיוק.`
          : `עוד לא הוזז כלום. שאל את הלקוח: \"להעביר את התור שלך${was ? ` מ*${showSlot(was)}*` : ""} ל*${showSlot(start)}*?\". הכפתורים נקבעים אוטומטית (${CONFIRM_OPTIONS.move.join(" / ")}). אחרי שיאשר — קרא שוב עם אותו מועד בדיוק.`
      );
      if (ask) return ask;
      if (test) return { ok: true, test: true, start, show: showSlot(start), note: "שיחת בדיקה — התור לא נרשם ביומן באמת" };
      if (name === "book_appointment") {
        const res = await deps.crm({ action: "book", phone: st.phone, name: String(args?.customer_name || st.name || "לקוח"), start, minutes: input.brain.booking.slotMinutes });
        if (args?.customer_name) st.name = String(args.customer_name);
        return { ok: true, start, show: showSlot(res.start || start) };
      }
      const res = await deps.crm({ action: "move", phone: st.phone, examId: String(args?.exam_id || ""), start });
      return { ok: true, from: res.previousStart ? showSlot(res.previousStart) : undefined, to: showSlot(start) };
    }
    case "cancel_appointment": {
      if (!st.phone) return { ok: false, error: "צריך קודם את מספר הנייד של הלקוח" };
      if (!deps.crm) return { ok: false, error: "אין גישה ליומן" };
      const ask = needsConfirmation(st, `cancel|${String(args?.exam_id || "")}`, `עוד לא בוטל כלום. שאל את הלקוח: \"לבטל את התור שלך ל*…*?\" (כתוב את המועד). הכפתורים נקבעים אוטומטית (${CONFIRM_OPTIONS.cancel.join(" / ")}). אחרי שיאשר — קרא שוב.`);
      if (ask) return ask;
      if (test) return { ok: true, test: true, note: "שיחת בדיקה — התור לא בוטל באמת" };
      const res = await deps.crm({ action: "cancel", phone: st.phone, examId: String(args?.exam_id || "") });
      return { ok: true, cancelled: res.start ? showSlot(res.start) : undefined };
    }
    case "note_for_staff": {
      if (st.voice) return needsConfirmation(st, "voice", VOICE_ASK);
      const kind: BotNoteKind = args?.kind === "bug" ? "bug" : "handoff";
      const said = st.userText.replace(/^🎤\s*/, "").trim();
      // Haim, 2026-10-23: a person only when the customer asks for one in so many words
      if (kind === "handoff" && !ASKS_FOR_PERSON.test(recentUserText(st))) {
        return { ok: false, error: "הלקוח לא ביקש לדבר עם נציג — אל תעביר לצוות ואל תבטיח שמישהו יחזור אליו. ענה מה שידוע לך; אם אין לך תשובה — אמור זאת בכנות והוסף ל-options את \"🙋 לדבר עם נציג\"." };
      }
      if (kind === "handoff" && JUST_CLOSING.test(said)) {
        return { ok: false, error: "הלקוח רק מודה / נפרד — אין מה להעביר לצוות. ענה בקצרה ובחום (למשל \"בשמחה! 😊 כאן בשבילך\"), בלי להבטיח שמישהו יחזור, options []." };
      }
      // a "yes" to the bot's question about a voice note lets it through — anything else doesn't
      if (st.confirmed === "voice" && st.userText && !SAID_YES.test(said)) {
        return { ok: false, error: "הלקוח לא אישר שהבנת נכון את ההודעה הקולית — אל תעביר לצוות. ענה למה שכתב עכשיו." };
      }
      const text = String(args?.text || "").trim().slice(0, 1000);
      if (!text) return { ok: false };
      const note = await addNote({ agentId, botId, sessionId: input.sessionId, channel: input.channel, phone: st.phone, name: st.name, kind, text });
      st.notes.push(note);
      if (!test && deps.onNote) await deps.onNote(note).catch((e) => console.warn("[BOT] onNote failed:", e?.message));
      return { ok: true };
    }
    case "learn_from_correction": {
      if (st.voice) return needsConfirmation(st, "voice", VOICE_ASK);
      const lesson = String(args?.lesson || "").trim().slice(0, 500);
      if (!lesson) return { ok: false };
      // the owner teaching in the test chat is trusted; a customer's correction is kept too, and the
      // staff see it (a "lesson" note) and can turn it off in the bot's screen
      await addLesson({ agentId, text: lesson, source: test ? "owner" : "customer", quote: String(args?.customer_said || input.text).slice(0, 500), sessionId: input.sessionId, active: true });
      const note = await addNote({ agentId, botId, sessionId: input.sessionId, channel: input.channel, phone: st.phone, name: st.name, kind: "lesson", text: lesson });
      st.notes.push(note);
      return { ok: true };
    }
  }
  return { ok: false, error: "unknown tool" };
}

// ---------- one turn ----------

// "Thinking" off: it made the answer several times slower without better answers (the CRM's help
// assistant measured 8s vs 4s; Haim 2026-10-23: "the answer comes slowly"). A model that refuses a
// zero thinking budget is asked again with its default.
async function generate(ai: GoogleGenAI, params: any): Promise<any> {
  let last: any = null;
  for (const model of MODELS) {
    try {
      return await ai.models.generateContent({ ...params, model, config: { ...params.config, thinkingConfig: { thinkingBudget: 0 } } });
    } catch (e: any) {
      if (/thinking/i.test(String(e?.message || ""))) {
        try {
          return await ai.models.generateContent({ ...params, model });
        } catch (e2: any) {
          e = e2;
        }
      }
      last = e;
      console.warn(`[BOT] ${model} failed:`, e?.message || e);
    }
  }
  throw last || new Error("no model answered");
}

const msg = (role: "user" | "bot", text: string, extra: Partial<ConvMessage> = {}): ConvMessage => ({
  id: `${role === "user" ? "u" : "b"}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
  role,
  text,
  at: new Date().toISOString(),
  ...extra,
});

export async function runBotTurn(input: TurnInput, deps: TurnDeps): Promise<TurnResult> {
  const started = Date.now();
  const timing: TurnResult["timing"] = { customer: 0, ai: [], tools: [], total: 0 };
  const botId = String(input.agent.botId || "");
  // the conversation and the CRM card are read at the same time
  const givenPhone = normalizeIsraeliPhone(input.phone || "");
  const t0 = Date.now();
  const [conv, givenCustomer, calendarEvents] = await Promise.all([
    getConversation(botId, input.sessionId),
    givenPhone ? readCustomer(deps, givenPhone).finally(() => (timing.customer = Date.now() - t0)) : Promise.resolve(null),
    readCalendarEvents(deps),
  ]);
  // the events on the branch calendar count like the ones on the bot's own screen
  if (calendarEvents.length) input = { ...input, brain: { ...input.brain, events: [...(input.brain.events || []), ...calendarEvents] } };
  const st: TurnState = {
    phone: normalizeIsraeliPhone(input.phone || "") || conv?.phone || "",
    name: String(input.name || conv?.name || "").trim(),
    customer: null,
    notes: [],
    slotsOffered: new Set(),
    confirmed: "",
    pending: "",
    voice: false,
    userText: "",
    earlierUserText: (conv?.messages || []).filter((m) => m.role === "user").slice(-2).map((m) => m.text).join("\n"),
  };
  if (st.phone) {
    if (st.phone === givenPhone) st.customer = givenCustomer;
    else {
      const t1 = Date.now();
      st.customer = await readCustomer(deps, st.phone);
      timing.customer = Date.now() - t1;
    }
    if (st.customer?.name && !st.name) st.name = st.customer.name;
  }
  const userText = String(input.text || "").trim();
  const lastBot = [...(conv?.messages || [])].reverse().find((m) => m.role === "bot");
  st.confirmed = lastBot?.pending || "";
  st.userText = userText;
  // a voice note the customer already confirmed we understood (or a "yes" to it) is acted on
  st.voice = userText.startsWith("🎤") && st.confirmed !== "voice";
  const today = israelNow().date;
  const firstToday = !(conv?.messages || []).some((m) => m.role === "bot" && israelDateOf(m.at) === today);
  const userMsg = msg("user", userText, input.buttonId ? { buttonId: input.buttonId } : {});

  let answer = { reply: "", options: [] as string[], images: [] as string[] };
  if (!deps.ai) {
    answer.reply = "מצטערים, הבוט לא זמין כרגע. אפשר להשאיר מספר טלפון ונחזור אליך בהקדם.";
  } else {
    const history = (conv?.messages || []).slice(-HISTORY).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.role === "bot" ? JSON.stringify({ reply: m.text, options: m.options || [] }) : m.text }],
    }));
    const contents: any[] = [...history, { role: "user", parts: [{ text: userText || "(הלקוח לחץ על כפתור)" }] }];
    let finalText = "";
    for (let round = 0; round < 6; round++) {
      const ta = Date.now();
      const res = await generate(deps.ai, {
        contents,
        config: {
          systemInstruction: systemPrompt(input, st.customer, st.phone, { firstToday, profileName: String(input.name || conv?.name || "").trim(), lastChatAt: conv?.messages?.at(-1)?.at || "" }),
          tools: [{ functionDeclarations: TOOLS }],
          temperature: 0.4,
        },
      });
      timing.ai.push(Date.now() - ta);
      const calls = res.functionCalls || [];
      if (!calls.length) {
        finalText = res.text || "";
        break;
      }
      contents.push(res.candidates?.[0]?.content || { role: "model", parts: calls.map((c: any) => ({ functionCall: c })) });
      // several tools asked for at once run together — after linking the customer, which the others need
      const runOne = async (call: any) => {
        const tt = Date.now();
        let out: any;
        try {
          out = await runTool(String(call.name), call.args || {}, input, deps, st);
        } catch (e: any) {
          out = { ok: false, error: e?.message || "failed" };
        }
        timing.tools.push({ name: String(call.name), ms: Date.now() - tt });
        return { functionResponse: { name: call.name, response: out, ...(call.id ? { id: call.id } : {}) } };
      };
      const linking = calls.filter((c: any) => c.name === "link_customer_phone");
      const parts: any[] = [];
      for (const c of linking) parts.push(await runOne(c));
      parts.push(...(await Promise.all(calls.filter((c: any) => c.name !== "link_customer_phone").map(runOne))));
      contents.push({ role: "user", parts });
    }
    answer = parseBotAnswer(finalText);
    if (!answer.reply) answer.reply = "סליחה, לא הצלחתי לענות כרגע. אפשר לנסות שוב, או להשאיר מספר ונחזור אליך.";
  }
  if (st.pending) answer.options = CONFIRM_OPTIONS[st.pending.split("|")[0]] || answer.options;
  answer.reply = tidyText(answer.reply);

  await appendToConversation(
    { botId, sessionId: input.sessionId, agentId: String(input.agent.id), channel: input.channel, phone: st.phone, name: st.name, test: input.channel === "test" },
    [
      userMsg,
      msg("bot", answer.reply, {
        ...(answer.options.length ? { options: answer.options } : {}),
        ...(answer.images.length ? { images: answer.images } : {}),
        ...(st.pending ? { pending: st.pending } : {}),
      }),
    ]
  );
  timing.total = Date.now() - started;
  return { ...answer, phone: st.phone || undefined, name: st.name || undefined, notes: st.notes, timing };
}

// ---------- the voice bot's prompt ----------

// The same knowledge, written for a voice agent (ElevenLabs): no buttons / JSON / images, short
// spoken sentences. The CRM sends it to the agent with every call (POST /api/crm/voice-prompt), or
// the owner copies it in. Each kind of call has its own goal on top (Haim, 2026-10-26):
//  - new_lead: a new lead who hasn't booked — help, answer anything, and only once they got their
//    answer offer the eye exam, gently (at most twice in the call, never pushing);
//  - confirm: a booked exam not confirmed after the WhatsApp reminders — coming? With the CRM's own
//    confirmation agent (its tools free_slots / move_appointment / cancel_appointment, /api/voice-tools)
//    it moves or cancels the exam itself; with any other agent it hands the request to the staff
//    ({{appointment_tools}}, filled per call).
// {{customer_name}}, {{customer_context}}, {{appointment_when}} and {{today}} are filled by the CRM
// for each call (and sent to ElevenLabs as dynamic variables too).
// Written in the infinitive and to the customer without gender (Haim, 2026-10-26: "תודה רבה לך" to a
// woman / a man — "רק תודה רבה").
export type VoicePurpose = "new_lead" | "confirm" | "general";
export const VOICE_PURPOSES: VoicePurpose[] = ["new_lead", "confirm", "general"];

// How to speak to someone whose gender isn't known — also added to the end of the agent's own prompt
// in new-lead calls (with the hours)
export const VOICE_SPEECH_SECTION = [
  "# פנייה ללקוח בלי מגדר (גובר על כל ניסוח אחר)",
  "לא יודעים אם מדברים עם גבר או עם אישה — מנסחים כך שמתאים לשניהם, ולא מנחשים לפי השם או הקול:",
  "- \"תודה רבה\" — לא \"תודה רבה לך\". \"בשמחה\", \"מעולה\", \"נשמח לראות בסניף\".",
  "- שאלות בלי פנייה: \"מתאים?\", \"נוח?\", \"אפשר להגיע ביום רביעי?\", \"מה עוד אפשר לעזור?\" — לא \"מתאים לך?\", \"אתה יכול?\", \"את מגיעה?\".",
  "- בלי \"אתה\" / \"את\" ובלי מילים שמשתנות לפי מגדר (מגיע/מגיעה, בטוח/בטוחה, יכול/יכולה, תגיע/תגיעי). במקומן: \"ההגעה מתאימה?\", \"אפשר לסמן שמגיעים?\", \"יהיה אפשר להגיע?\".",
  "- על עצמנו מדברים ברבים: \"אנחנו\", \"נשמח\", \"רשמנו\", \"נחזור\".",
  "",
  "# דיבור טבעי בעברית בלבד (גובר על כל השאר)",
  "- כל מה שנאמר ללקוח — בעברית שוטפת, כמו נציג אנושי בטלפון. בלי מילים באנגלית.",
  "- לא מספרים ללקוח מה קורה מאחורי הקלעים: בלי שמות של כלים או פונקציות (free_slots, move_appointment, cancel_appointment, escalate_to_human, report_call_result וכו'), בלי \"אני קוראת ל...\", \"מפעילה כלי\", \"הפעולה הצליחה\", \"המערכת החזירה\". כשבודקים משהו אפשר להגיד רק \"רגע, בודקים ביומן\".",
  "- שעות ותאריכים — תמיד במילים בעברית: \"בשתיים וחצי בצהריים\", \"ביום רביעי, עשרים ושמונה באוקטובר\". אף פעם לא ספרות, לא \"14:30\", לא \"28.10\" ולא תאריך בפורמט מחשב. כשהכלי מחזיר say — אומרים אותו כמו שהוא.",
  "- קודים, מזהים ושדות טכניים (slot_code, מזהה תור וכו') לא נאמרים אף פעם.",
  "",
  "# משך השיחה — עד חמש דקות (גובר על כל השאר)",
  "- השיחה מוגבלת לחמש דקות ונקטעת אוטומטית בסופן. לשמור על תשובות קצרות ולהתקדם למטרה.",
  "- כשהשיחה מתארכת — בערך אחרי ארבע דקות, או אחרי שמונה עד עשר החלפות דברים — להתחיל לסגור: לסכם במשפט מה סוכם, ואם משהו לא הסתיים להגיד \"נציג שלנו יחזור בהקדם להשלים\", להודות ולהיפרד.",
  "- לא לפתוח נושא חדש לקראת הסוף. עדיף לסיים בנעימות ולהשאיר לנציג מאשר להיקטע באמצע.",
].join("\n");

const VOICE_GOALS: Record<VoicePurpose, string[]> = {
  new_lead: [
    "# מטרת השיחה",
    "שיחה עם {{customer_name}}, שהשאיר פרטים אצלנו ועדיין לא קבע תור לבדיקת ראייה. המטרה: לתת תשובות לכל מה שמעניין — ואם מתאים, לסיים את השיחה עם תור לבדיקה. לא לדחוף.",
    "",
    "# מהלך השיחה",
    "1. פתיחה: להציג את העסק במשפט אחד, להגיד שחוזרים אחרי שהושארו אצלנו פרטים, ולשאול אם זה זמן נוח לדבר. לא נוח — לשאול מתי נוח שנחזור, להודות ולסיים.",
    "2. הקשבה: לשאול במה אפשר לעזור / מה חיפשו (משקפי ראייה, מולטיפוקל, עדשות מגע, משקפי שמש, מבצע מהפרסום). לתת לדבר.",
    "3. תשובות: לענות על כל שאלה — מחירים, מבצעים, מוצרים, שעות, מיקום, הזמנה קיימת — מהידע של העסק למטה ומהכלים. תשובה קצרה, ואז לבדוק שזה ענה (\"זה עונה על השאלה?\").",
    "4. רק אחרי שהתקבלה תשובה — להציע בעדינות לקבוע בדיקת ראייה (למשל \"לבדוק מתי יש תור פנוי לבדיקה?\"). זו לא מכירה — זו עזרה.",
    "5. מסכימים: לבדוק בכלי את המועדים הפנויים, להציע שתי אפשרויות, ואחרי הבחירה — לחזור על היום והשעה ולשאול \"לקבוע?\". קובעים רק אחרי \"כן\" מפורש, ורק אחרי שהכלי אישר אומרים שנקבע. אחר כך: תגיע הודעת אישור בוואטסאפ.",
    "6. לא עכשיו / לא מעוניינים: מכבדים. אפשר לשאול פעם אחת אם להזכיר בהמשך, ואז להודות ולסיים בנעימות. ביקשו שלא נתקשר — להגיד שרשמנו ולא נתקשר שוב.",
    "",
    "# בלי לחץ",
    "- לכל היותר שתי הצעות לקבוע תור בכל השיחה, ולעולם לא שתיים ברצף — ביניהן הייתה שאלה ותשובה.",
    "- לא לחזור על הצעה שנדחתה, לא להתווכח ולא לשכנע.",
  ],
  confirm: [
    "# מטרת השיחה",
    "שיחה עם {{customer_name}} לגבי התור לבדיקת ראייה {{appointment_when}}. נשלחו תזכורות בוואטסאפ ולא התקבל אישור הגעה. המטרה: לדעת אם מגיעים — ואם המועד לא מתאים, לעזור למצוא מועד אחר. שיחה קצרה ונעימה.",
    "",
    "# מהלך השיחה",
    "1. פתיחה: להציג את העסק, להגיד שמתקשרים לגבי התור {{appointment_when}}, ולשאול: \"רצינו לוודא שהמועד עדיין מתאים?\"",
    "2. מגיעים: להודות. אם שואלים — כתובת, חניה, כמה זמן זה לוקח, מה להביא (משקפיים נוכחיים / עדשות). לסיים.",
    "3. צריך מועד אחר / לא יגיעו: לפי \"# הזזה וביטול\" למטה.",
    "4. לא בטוחים: להגיד שהתור נשאר, ושאם משהו משתנה אפשר לכתוב לנו בוואטסאפ.",
    "- שאלות אחרות — לענות בקצרה מהידע למטה, ולחזור לשאלה אם מגיעים.",
    "",
    "{{appointment_tools}}",
  ],
  general: [],
};

// The confirmation call's "move / cancel" part — with the CRM's confirmation agent's tools, or not
export function voiceAppointmentTools(withTools: boolean): string {
  return withTools
    ? [
        "# הזזה וביטול (יש כלים — עושים את זה בשיחה)",
        "(הכלים פנימיים — ללקוח לא מזכירים אותם, רק \"רגע, בודקים ביומן\".)",
        "- מועד אחר — פשוט וקצר, בלי להתברבר:",
        "  1. לשאול איזה יום נוח, ולבדוק עם free_slots (day = היום שנאמר; בלי יום — הימים הקרובים).",
        "  2. להגיד את הטווח הפנוי (free) כמו שהוא — למשל \"ביום רביעי פנוי בין שתים עשרה לארבע, באיזו שעה נוח?\". לא להציע שעות בודדות ולא להקריא רשימות.",
        "  3. הלקוח אומר שעה — free_slots שוב עם day ועם around = השעה שאמר (HH:MM), ולשאול במשפט אחד את ה-nearest.ask (\"ביום רביעי בשתיים — מתאים?\").",
        "  4. \"כן\" — move_appointment עם start = nearest.slot_code. רק אחרי שהכלי אישר (ok) — להגיד את ה-say שחזר. הכלי לא אישר — לא להגיד שהועבר, ולהציע את הטווח הפנוי שוב.",
        "- לא יגיעו בכלל: לשאול פעם אחת אם להעביר למועד אחר. לא — לשאול \"לבטל את התור?\", ורק אחרי \"כן\" מפורש — cancel_appointment. להודות ולסיים.",
        "- אסור להמציא מועד פנוי, ואסור להגיד שהתור הועבר או בוטל לפני שהכלי אישר. כלי מחזיר say_instead — אומרים את זה במילים טבעיות.",
        "- לא קובעים תור חדש בנוסף לקיים — רק מעבירים את הקיים.",
      ].join("\n")
    : [
        "# הזזה וביטול (אין כלים — עובר לצוות)",
        "- לא מזיזים, לא מבטלים ולא קובעים תור חדש בשיחה הזו (התור הקיים היה נשאר ביומן ויהיו שניים).",
        "- לשאול בקצרה מתי בערך נוח (יום / חלק ביום), או אם לבטל. להגיד: \"רשמנו, הצוות יעדכן את התור ויחזור בהקדם\", ולהפעיל escalate_to_human עם הבקשה (להעביר — ומתי נוח, או לבטל).",
      ].join("\n");
}

// The chat prompt's knowledge as something to say on the phone (Haim, 2026-10-26: the voice prompt
// was full of what only makes sense in WhatsApp — sample pictures, links, buttons): links, picture /
// link lines and sentences about sending pictures / links / buttons go, emojis and *bold* marks go.
const CHAT_ONLY = /תמונ|קישור|לינק|כפתור|JSON|list_options|options|אימוג|הקלק|לחצ\/י|לחץ על|שלח את ה|לשלוח את ה/i;
export function forVoice(text: string): string {
  return String(text || "")
    .split("\n")
    .map((line) => {
      if (/^\s*[-•*]?\s*(?:תמונה|תמונות|קישור|לינק|image|url)\s*:/i.test(line)) return null; // "- תמונה: https://…"
      let l = line.replace(/https?:\/\/\S+/g, "").replace(/\[[^\]]*\]\(\s*\)/g, "");
      // sentence by sentence: keep what can be said, drop what's about pictures / links / buttons
      const parts = l.split(/(?<=[.!?])\s+/);
      const kept = parts.filter((s) => !CHAT_ONLY.test(s));
      if (kept.length !== parts.length && !kept.join("").trim()) return null;
      l = kept.join(" ");
      l = l
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .replace(/(\S)[ \t]{2,}/g, "$1 ")
        .replace(/\s+$/, "");
      if (!/^\s/.test(line)) l = l.trimStart(); // an emoji at the start of the line, not indentation
      if (/https?:\/\//.test(line)) {
        // what pointed at the link that was taken out ("לקביעת תור ביומן -", "לניווט בוויז:")
        l = l.replace(/[\s\-–:]+$/, "");
        if (!l.trim() || /^[\s\-•*]*[^:]{0,40}:?$/.test(l) && /(?:קישור|לניווט|בלחיצה|כאן|ביומן)$/.test(l.trim())) return null;
      }
      return l;
    })
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The kinds of voice call whose prompt the owner may edit (BotApp → "📞 פרומפט לבוט הקולי")
// Placeholders in an edited prompt — the live parts are filled on every call:
//   {{booking_hours}} the hours + each day's last appointment, {{events}} events / holidays,
//   {{appointment_tools}} a confirmation call's move / cancel part (with the agent's tools or not),
//   {{customer_name}} {{customer_context}} {{appointment_when}} {{today}} filled by the CRM.
export const VOICE_LIVE_PARTS = ["{{booking_hours}}", "{{events}}", "{{appointment_tools}}"];

// What a call gets: the owner's own version of this kind of call's prompt (brain.voicePrompts) or the
// one written from the smart bot's knowledge, with the live parts filled in. withTools: the call goes
// to the CRM's confirmation agent, which can move / cancel the exam itself.
export function voicePrompt(agent: any, brain: BotBrain, lessons: BotLesson[], brainText: string, purpose: VoicePurpose = "general", withTools = false): string {
  const template = brain.voicePrompts?.[purpose]?.trim() || voicePromptTemplate(agent, brain, lessons, brainText, purpose);
  return template
    .replace(/\{\{\s*booking_hours\s*\}\}/g, () => (brain.booking?.enabled !== false ? voiceHoursSection(brain) : ""))
    .replace(/\{\{\s*events\s*\}\}/g, () => eventsSection(brain, israelNow().date).trim())
    .replace(/\{\{\s*appointment_tools\s*\}\}/g, () => voiceAppointmentTools(withTools))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The prompt as written from the smart bot's knowledge, with the live parts as placeholders — what
// the edit box starts from
export function voicePromptTemplate(agent: any, brain: BotBrain, lessons: BotLesson[], brainText: string, purpose: VoicePurpose = "general"): string {
  const business = agent?.businessName || agent?.name || "העסק";
  const qa = brain.qa
    .filter((x) => x.q.trim() && x.a.trim() && !EVENT_DATE_LINE(`${x.q} ${x.a}`))
    .map((x) => ({ q: forVoice(x.q), a: forVoice(x.a) }))
    .filter((x) => x.q && x.a);
  const active = lessons.filter((l) => l.active).map((l) => forVoice(l.text)).filter(Boolean);
  const goal = VOICE_GOALS[purpose] || [];
  return [
    `נציג השירות הקולי של "${business}" בשיחת טלפון. מדברים בעברית, במשפטים קצרים וברורים, בטון חם וטבעי — כמו נציג אנושי.`,
    "לא להקריא רשימות ארוכות, קישורים או סימנים; לכל היותר שתי אפשרויות בכל פעם, ולשאול מה מתאים.",
    "מספרים ושעות במילים טבעיות (\"בעשר וחצי\"). כשלא יודעים משהו — להגיד שנציג יחזור בהקדם, ולא להמציא.",
    goal.length ? "היום: {{today}}." : "",
    "",
    VOICE_SPEECH_SECTION,
    ...(goal.length ? ["", ...goal] : []),
    goal.length ? "\n# מה ידוע על הלקוח (מה-CRM)\n{{customer_context}}" : "",
    purpose === "new_lead"
      ? "\n# כלים\nמועדים פנויים וקביעת תור — רק דרך הכלים המוגדרים. לא להמציא מועד פנוי ולא להגיד שתור נקבע לפני שהכלי אישר."
      : "",
    "",
    goal.length ? "# הידע של העסק (נכתב לצ'אט בוואטסאפ — לקחת ממנו רק את המידע: מחירים, מבצעים, מוצרים, שעות, כתובת. איך לנהל את השיחה — לפי מה שלמעלה)" : "# הידע של העסק",
    forVoice(withoutEventDates(brainText)),
    qa.length ? "\n# שאלות ותשובות\n" + qa.map((x) => `ש: ${x.q}\nת: ${x.a}`).join("\n\n") : "",
    active.length ? "\n# דגשים שנלמדו משיחות\n" + active.map((l) => `- ${l}`).join("\n") : "",
    "\n{{events}}",
    goal.length ? "\n{{booking_hours}}" : "",
    "\n- מבקשים לראות תמונות, דגמים או קישור — להגיד שאפשר לראות הכל באתר, או שנשלח בוואטסאפ.",
    brain.voiceNotes?.trim() ? "\n# הנחיות לשיחה הקולית (מבעל העסק — גוברות על כל השאר)\n" + brain.voiceNotes.trim() : "",
  ]
    .filter((x) => x !== "")
    .join("\n")
    // the chat-only parts of a prompt (buttons, JSON, list options) mean nothing on the phone
    .replace(/^.*(?:JSON|list_options).*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The booking hours as the voice agent must use them (Haim, 2026-10-26: the ElevenLabs agent made up
// "the last appointment on Friday is 11:40" on its own): each weekday's hours with its last
// appointment = closing minus one appointment's length, and the next 14 days that differ (events,
// holidays). Added at the end of the agent's own prompt for new-lead calls, and in voicePrompt.
export function voiceHoursSection(brain: Pick<BotBrain, "booking" | "events" | "closedOnHolidays">): string {
  const step = Math.max(10, Number(brain.booking.slotMinutes) || 30);
  const describe = (spec: string) => {
    const rs = ranges(spec).filter(([a, b]) => a + step <= b);
    if (!rs.length) return "";
    const last = rs[rs.length - 1];
    return `${rs.map(([a, b]) => `${fromMinutes(a)}–${fromMinutes(b)}`).join(", ")} — תור ראשון ${fromMinutes(rs[0][0])}, תור אחרון ${fromMinutes(last[1] - step)}`;
  };
  const week = DAY_NAMES.map((name, i) => `- יום ${name}: ${describe(brain.booking.hours[String(i)] || "") || "אין תורים"}`);
  const today = israelNow().date;
  const special: string[] = [];
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const d = dayHours(brain, date);
    const usual = brain.booking.hours[String(weekdayOf(date))] || "";
    if (d.hours === usual && !d.why) continue;
    special.push(`- ${showDay(date)}${d.why ? ` (${d.why})` : ""}: ${describe(d.hours) || "סגור — אין תורים"}`);
  }
  return [
    "# שעות קבלה לבדיקות ותור אחרון (מהמערכת — גובר על כל שעה אחרת שכתובה למעלה)",
    `כל בדיקה נמשכת ${step} דקות, ולכן התור האחרון ביום הוא ${step} דקות לפני סגירה — לא לפני ולא אחרי.`,
    ...week,
    ...(special.length ? ["ימים בשבועיים הקרובים שבהם השעות שונות:", ...special] : []),
    "- אל תציע ואל תקבע תור מחוץ לשעות האלה, ואל תחליט לבד על שעת סיום אחרת. מועדים פנויים — רק מהכלי; אם הכלי מחזיר שעה מחוץ לשעות האלה, אל תציע אותה.",
  ].join("\n");
}

// ---------- the voice agent's tools (ElevenLabs webhook tools → POST /api/voice-tools/:tool) ----------
// The CRM's confirmation agent (Haim, 2026-10-26: "she didn't know how to move an appointment") gets
// the same calendar the smart bot works on: free slots from the booking hours minus the branch
// calendar, and moving / cancelling the customer's own exam through the CRM (/api/bot/tools — a
// move / cancel only touches an exam of that phone; the CRM notes it on the lead and sends the WhatsApp
// confirmation). The phone is ElevenLabs' {{customer_phone}}, never what the model says.
// Times and dates as said in Hebrew (Haim, 2026-10-26: the agent read "13:00" / "28.10" in English
// letters) — "ביום רביעי, עשרים ושמונה באוקטובר, באחת וחצי בצהריים"
const HOURS_F = ["שתים עשרה", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע", "עשר", "אחת עשרה"];
const UNITS_F = ["", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע"];
const TEENS_F = ["עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה", "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה"];
const TENS = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים"];
const UNITS_M = ["", "אחד", "שניים", "שלושה", "ארבעה", "חמישה", "שישה", "שבעה", "שמונה", "תשעה"];
const TEENS_M = ["עשרה", "אחד עשר", "שנים עשר", "שלושה עשר", "ארבעה עשר", "חמישה עשר", "שישה עשר", "שבעה עשר", "שמונה עשר", "תשעה עשר"];
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const numWords = (n: number, units: string[], teens: string[]) =>
  n < 10 ? units[n] : n < 20 ? teens[n - 10] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ו${units[n % 10]}` : ""}`;
export function hebrewTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const part = h < 12 ? "בבוקר" : h < 16 ? "בצהריים" : h < 19 ? "אחר הצהריים" : "בערב";
  if (m === 45) return `רבע ל${HOURS_F[(h + 1) % 12]} ${part}`;
  const hour = HOURS_F[h % 12];
  const min = m === 0 ? "" : m === 15 ? " ורבע" : m === 30 ? " וחצי" : ` ו${numWords(m, UNITS_F, TEENS_F)}`;
  return `${hour}${min} ${part}`;
}
export function hebrewDate(date: string): string {
  const d = Number(date.slice(8, 10));
  return `יום ${DAY_NAMES[weekdayOf(date)]}, ${numWords(d, UNITS_M, TEENS_M)} ב${MONTHS[Number(date.slice(5, 7)) - 1]}`;
}
// "ביום רביעי, עשרים ושמונה באוקטובר, בשתיים וחצי בצהריים"
const spokenSlot = (s: string) => `ב${hebrewDate(s.slice(0, 10))}, ב${hebrewTime(s.slice(11, 16))}`;

export async function voiceTool(name: string, args: any, brain: BotBrain, crm: CrmCaller): Promise<any> {
  const phone = normalizeIsraeliPhone(args?.phone);
  const hoursFor = (d: string) => dayHours(brain, d).hours;
  // the exam the call is about (the CRM's {{exam_id}}), else the customer's next one
  const theExam = async () => {
    const c = phone ? await crm({ action: "customer", phone }) : null;
    const list = (c?.upcomingExams || []) as { id: string; start: string }[];
    const wanted = String(args?.exam_id || "").trim();
    return (wanted && list.find((x) => x.id === wanted)) || list[0];
  };
  switch (name) {
    case "free_slots": {
      const today = israelNow().date;
      const asked = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.day || "")) ? String(args.day) : "";
      const from = asked && asked >= today ? asked : today;
      const days = asked ? 1 : 10;
      const r = await crm({ action: "busy", from, to: addDays(from, days - 1) });
      if (!r?.configured) return { ok: false, say_instead: "הצוות יחזור בהקדם לתאם מועד" };
      let slots = freeSlots(brain.booking, r.busy || [], from, days, hoursFor);
      const hour = (s: string) => Number(s.slice(11, 13));
      const tod = String(args?.time_of_day || "");
      if (tod === "morning") slots = slots.filter((s) => hour(s) < 12);
      else if (tod === "afternoon") slots = slots.filter((s) => hour(s) >= 12);
      // Free time as ranges per day, not single times (Haim, 2026-10-26: "say it's free between 12 and
      // 4, I say 2, and it takes the nearest slot and asks to confirm") — consecutive slots merged
      const len = Math.max(10, Number(brain.booking.slotMinutes) || 30);
      const freeByDay = new Map<string, [number, number][]>();
      for (const s of slots) {
        const day = s.slice(0, 10);
        const m = toMinutes(s.slice(11, 16));
        const list = freeByDay.get(day) || [];
        const last = list[list.length - 1];
        if (last && last[1] === m) last[1] = m + len;
        else list.push([m, m + len]);
        freeByDay.set(day, list);
      }
      const daySay = (day: string, rs: [number, number][]) =>
        `ב${hebrewDate(day)}: ` +
        rs.map(([a, b]) => (b - a <= len ? `רק ב${hebrewTime(fromMinutes(a))}` : `פנוי בין ${hebrewTime(fromMinutes(a))} ל${hebrewTime(fromMinutes(b))}`)).join(", ו");
      const daysWithRoom = [...freeByDay.keys()].slice(0, asked ? 1 : 3);
      // "around": the time the customer said — that exact time when it fits in a free range, else the nearest slot
      let nearest: string | undefined;
      const around = /^\d{1,2}:\d{2}$/.test(String(args?.around || "")) ? String(args.around).padStart(5, "0") : "";
      const aroundDay = asked || daysWithRoom[0];
      if (around && aroundDay) {
        const t = toMinutes(around);
        if ((freeByDay.get(aroundDay) || []).some(([a, b]) => t >= a && t + len <= b)) nearest = `${aroundDay}T${around}`;
        else {
          const sameDay = slots.filter((s) => s.startsWith(aroundDay));
          nearest = sameDay.sort((x, y) => Math.abs(toMinutes(x.slice(11, 16)) - t) - Math.abs(toMinutes(y.slice(11, 16)) - t))[0];
        }
      }
      const closed = asked && !ranges(hoursFor(asked)).length ? dayHours(brain, asked).why || "אין קבלה ביום הזה" : "";
      // what to say is ready in Hebrew words; slot_code is only for move_appointment — never said
      return {
        ok: true,
        how_to_say: "להגיד ללקוח את הטווחים הפנויים (free) במילים, כמו שהם, ולתת לבחור שעה. לא להקריא שעות בודדות, slot_code, ספרות או שמות כלים.",
        ...(closed ? { closed } : {}),
        free: daysWithRoom.map((d) => daySay(d, freeByDay.get(d)!)),
        ...(nearest
          ? { nearest: { say: spokenSlot(nearest), slot_code: nearest, exact: nearest.slice(11, 16) === around, ask: `לשאול: "${spokenSlot(nearest)} — מתאים?"` } }
          : {}),
        ...(daysWithRoom.length ? {} : { say_instead: asked ? "אין מועד פנוי ביום הזה — להציע יום אחר" : "אין מועדים פנויים בימים הקרובים — להגיד שהצוות יחזור לתאם" }),
      };
    }
    case "move_appointment": {
      const start = String(args?.start || "");
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return { ok: false, say_instead: "רגע, נבדוק שוב את המועדים הפנויים", note: "בדיקת מועדים מחדש ואז להעביר עם slot_code בדיוק כפי שחזר" };
      const exam = await theExam();
      if (!exam) return { ok: false, say_instead: "לא מצאנו את התור במערכת — הצוות יחזור לבדוק ולתאם", reason: "no-exam" };
      // Any free time inside the day's reception hours (Haim, 2026-10-26: the customer asked for 14:30,
      // and only the 20-minute grid's 14:20 / 14:40 were accepted) — not in the next hour, and not
      // overlapping anything on the calendar but the exam being moved itself
      const len = Math.max(10, Number(brain.booking.slotMinutes) || 30);
      const [a, b] = [toMinutes(start.slice(11, 16)), toMinutes(start.slice(11, 16)) + len];
      const inHours = ranges(hoursFor(start.slice(0, 10))).some(([o, c]) => a >= o && b <= c);
      const now = israelNow();
      const soon = `${now.date}T${fromMinutes(Math.min(toMinutes(now.time) + 60, 24 * 60 - 1))}`;
      const end = `${start.slice(0, 10)}T${fromMinutes(b)}`;
      const ownEnd = new Date(Date.parse(`${exam.start}:00Z`) + len * 60000).toISOString().slice(0, 16);
      const r = await crm({ action: "busy", from: start.slice(0, 10), to: start.slice(0, 10) });
      const clash = (r?.busy || []).some((x: { start: string; end: string }) => {
        const from = x.start > start ? x.start : start;
        const to = x.end < end ? x.end : end;
        return from < to && !(from >= exam.start && to <= ownEnd); // an overlap only with itself is fine
      });
      if (!inHours || start < soon || clash) {
        return {
          ok: false,
          say_instead: !inHours ? "בשעה הזו אין קבלה — להציע מועדים פנויים בשעות הקבלה" : "המועד הזה תפוס — להציע מועדים פנויים אחרים",
          reason: !inHours ? "outside-hours" : start < soon ? "too-soon" : "busy",
        };
      }
      const res = await crm({ action: "move", phone, examId: exam.id, start });
      return { ok: true, say: `התור הועבר מ${spokenSlot(res?.previousStart || exam.start)} ל${spokenSlot(start)}. תישלח הודעת אישור בוואטסאפ.` };
    }
    case "cancel_appointment": {
      const exam = await theExam();
      if (!exam) return { ok: false, say_instead: "לא מצאנו את התור במערכת — הצוות יחזור לבדוק" };
      await crm({ action: "cancel", phone, examId: exam.id });
      return { ok: true, say: `התור ${spokenSlot(exam.start)} בוטל.` };
    }
    default:
      return { ok: false, say_instead: "הצוות יחזור בהקדם" };
  }
}

// What the agent says when the customer picks up (a call the business starts) — null = the agent's own
export function voiceFirstMessage(agent: any, purpose: VoicePurpose): string | null {
  const business = agent?.businessName || agent?.name || "העסק";
  // without gender: "השארת" / "שלך" / "לך" are said differently to a man and a woman
  if (purpose === "new_lead") return `היי {{customer_name}}, מדברים מ${business}. הושארו אצלנו פרטים, ורצינו לראות במה אפשר לעזור — זה זמן נוח לדבר?`;
  if (purpose === "confirm") return `היי {{customer_name}}, מדברים מ${business}, לגבי התור לבדיקת ראייה {{appointment_when}}. רצינו לוודא שהמועד עדיין מתאים?`;
  return null;
}

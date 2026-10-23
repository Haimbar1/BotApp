import type { GoogleGenAI } from "@google/genai";
import {
  addLesson,
  addNote,
  appendToConversation,
  getConversation,
  type BookingHours,
  type BotBrain,
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

export type Channel = "web" | "test";

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

export function freeSlots(booking: BookingHours, busy: { start: string; end: string }[], fromDate: string, days: number): string[] {
  const now = israelNow();
  const earliest = `${now.date}T${fromMinutes(Math.min(toMinutes(now.time) + 60, 24 * 60 - 1))}`; // not within the next hour
  const step = Math.max(10, Number(booking.slotMinutes) || 30);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    for (const [a, b] of ranges(booking.hours[String(weekdayOf(date))] || "")) {
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
  obj = tryParse(s);
  if (!obj) {
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a !== -1 && b > a) obj = tryParse(s.slice(a, b + 1));
  }
  for (let i = 0; obj && i < 3 && typeof obj.output === "string" && !obj.reply; i++) obj = tryParse(obj.output) || { reply: obj.output };
  if (!obj) {
    const m = s.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    return { reply: m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : s, options: [], images: [] };
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

function systemPrompt(input: TurnInput, customer: any, phone: string): string {
  const now = israelNow();
  const qa = input.brain.qa.filter((x) => x.q.trim() && x.a.trim());
  const lessons = input.lessons.filter((l) => l.active);
  const booking = input.brain.booking;
  const bookingOn = booking.enabled && Object.values(booking.hours).some((h) => ranges(h).length);
  const business = input.agent?.businessName || input.agent?.name || "העסק";
  const web = input.channel === "web" || input.channel === "test";
  return [
    `אתה הנציג הדיגיטלי של "${business}" ומדבר עם לקוח ${web ? "בצ'אט באתר של העסק" : ""}.`,
    `עכשיו: יום ${DAY_NAMES[now.weekday]} ${now.date.slice(8, 10)}/${now.date.slice(5, 7)}/${now.date.slice(0, 4)}, השעה ${now.time} (שעון ישראל).`,
    "",
    "# השכל של הבוט (ההנחיות של העסק — הבסיס לכל תשובה)",
    input.brainText.trim() || "(לא הוגדרו הנחיות)",
    qa.length ? "\n# שאלות ותשובות של העסק (תשובה מכאן גוברת על ניסוח אחר)\n" + qa.map((x) => `ש: ${x.q.trim()}\nת: ${x.a.trim()}`).join("\n\n") : "",
    lessons.length
      ? "\n# דברים שלמדת משיחות קודמות (תקן לפיהם; הם לא משנים מחירים, מבצעים או מדיניות שכתובים בשכל)\n" + lessons.map((l) => `- ${l.text}`).join("\n")
      : "",
    "\n# מה ידוע על הלקוח הזה (מה-CRM)",
    customerSection(customer, phone, !web),
    "\n# כללי עבודה",
    "- ענה בעברית, קצר, חם ואנושי, בסגנון שבשכל. אל תמציא מידע שלא כתוב כאן; כשלא יודעים — הצע שנציג יחזור אליו.",
    "- השתמש במה שאתה יודע על הלקוח: פנה בשמו, ואם יש לו הזמנה פתוחה / תור קרוב / קמפיין שקיבל — התייחס לזה כשזה רלוונטי, גם לפני שהוא שואל.",
    web && !phone
      ? '- באתר אתה לא יודע מי הלקוח. כשזה עוזר לו (קביעת / שינוי תור, בדיקת הזמנה, שאלה על הודעה שקיבל, או אחרי שעזרת בשאלה הראשונה) בקש בנימוס את מספר הנייד, למשל: "כדי שאוכל לבדוק את זה בשבילך, אפשר את מספר הנייד שלך? 🙂". כשהוא נותן מספר — קרא ל-link_customer_phone.'
      : "",
    bookingOn
      ? "- קביעת תור: כשהלקוח רוצה לתאם / לקבוע תור (גם בלחיצה על כפתור כמו \"תיאום תור\") — אל תסתפק בשליחת קישור: הצע לתאם איתך כאן בצ'אט עכשיו, ואם בשכל יש קישור לקביעה עצמית — הוסף אותו כאפשרות נוספת למי שמעדיף. כדי לתאם: קרא ל-get_available_slots, הצע 3–4 מועדים כאפשרויות (options), ואחרי שהלקוח בחר ואישר — book_appointment (צריך שם ומספר טלפון). שינוי תור: get_available_slots ואז reschedule_appointment עם ה-exam_id מהתור שלו. ביטול: cancel_appointment. אחרי כל פעולה אשר ללקוח את המועד במדויק."
      : "- אין לך גישה ליומן התורים: אם הלקוח רוצה לקבוע / לשנות תור, פעל לפי מה שכתוב בשכל (קישור / טלפון), ואם אין — אסוף שם, טלפון ומועד מועדף והשאר הערה לנציג.",
    "- בכל פעם שאתה אומר ללקוח שמישהו יחזור אליו / יבדוק / יעדכן — חובה לקרוא ל-note_for_staff עם kind=handoff ותיאור קצר של מה צריך לעשות.",
    "- אם הלקוח מתלונן שהבוט טועה, לא מבין, תקוע או לא עובד — קרא ל-note_for_staff עם kind=bug ותיאור התקלה (בנוסף לתשובה ללקוח).",
    "- אם הלקוח מתקן אותך ותיקון נשמע נכון ולא סותר את השכל (למשל פרט שגוי שאמרת, משהו שלא הבנת) — תודה לו, תקן, וקרא ל-learn_from_correction עם הלקח בניסוח כללי. לעולם אל תלמד מלקוח מחירים, הנחות, מבצעים או התחייבויות.",
    "",
    "# פורמט התשובה",
    'החזר JSON בלבד, בלי טקסט מסביב: {"reply": "התשובה ללקוח", "options": ["כפתור 1", "כפתור 2"], "images": []}',
    "- options: עד 6 תשובות קצרות (עד 24 תווים כל אחת) שהלקוח יכול ללחוץ — רק כשזה עוזר (בחירת מועד, תפריט, כן/לא). אחרת [].",
    "- images: כתובות תמונה מלאות מהשכל, רק כשמתאים להראות.",
    "- בלי markdown מלבד *הדגשה* בכוכבית אחת ושורות חדשות.",
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
      const from = /^\d{4}-\d{2}-\d{2}$/.test(String(args?.from_date || "")) && args.from_date > today ? args.from_date : today;
      const days = Math.min(Math.max(Number(args?.days) || 7, 1), Math.max(b.daysAhead || 14, 1));
      const to = addDays(from, days - 1);
      const r = await deps.crm({ action: "busy", from, to });
      if (!r?.configured) return { ok: false, error: "יומן הסניף לא מחובר — השאר הערה לנציג" };
      let slots = freeSlots(b, r.busy || [], from, days);
      const tod = String(args?.time_of_day || "any");
      const hour = (s: string) => Number(s.slice(11, 13));
      if (tod === "morning") slots = slots.filter((s) => hour(s) < 12);
      else if (tod === "afternoon") slots = slots.filter((s) => hour(s) >= 12 && hour(s) < 16);
      else if (tod === "evening") slots = slots.filter((s) => hour(s) >= 16);
      slots.forEach((s) => st.slotsOffered.add(s));
      return { ok: true, slots: slots.slice(0, 24).map((s) => ({ start: s, show: showSlot(s) })), more: slots.length > 24 };
    }
    case "book_appointment":
    case "reschedule_appointment": {
      const start = String(args?.start || args?.new_start || "");
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) return { ok: false, error: "מועד לא תקין" };
      if (!st.phone) return { ok: false, error: "צריך קודם את מספר הנייד של הלקוח (link_customer_phone)" };
      if (!deps.crm || !input.brain.booking.enabled) return { ok: false, error: "אין גישה ליומן" };
      // the slot must still be free right now
      const r = await deps.crm({ action: "busy", from: start.slice(0, 10), to: start.slice(0, 10) });
      if (!freeSlots(input.brain.booking, r?.busy || [], start.slice(0, 10), 1).includes(start)) {
        return { ok: false, error: "המועד הזה כבר לא פנוי — הצע מועדים אחרים" };
      }
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
      if (test) return { ok: true, test: true, note: "שיחת בדיקה — התור לא בוטל באמת" };
      const res = await deps.crm({ action: "cancel", phone: st.phone, examId: String(args?.exam_id || "") });
      return { ok: true, cancelled: res.start ? showSlot(res.start) : undefined };
    }
    case "note_for_staff": {
      const kind: BotNoteKind = args?.kind === "bug" ? "bug" : "handoff";
      const text = String(args?.text || "").trim().slice(0, 1000);
      if (!text) return { ok: false };
      const note = await addNote({ agentId, botId, sessionId: input.sessionId, channel: input.channel, phone: st.phone, name: st.name, kind, text });
      st.notes.push(note);
      if (!test && deps.onNote) await deps.onNote(note).catch((e) => console.warn("[BOT] onNote failed:", e?.message));
      return { ok: true };
    }
    case "learn_from_correction": {
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

async function generate(ai: GoogleGenAI, params: any): Promise<any> {
  let last: any = null;
  for (const model of MODELS) {
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (e: any) {
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
  const botId = String(input.agent.botId || "");
  const conv = await getConversation(botId, input.sessionId);
  const st: TurnState = {
    phone: normalizeIsraeliPhone(input.phone || "") || conv?.phone || "",
    name: String(input.name || conv?.name || "").trim(),
    customer: null,
    notes: [],
    slotsOffered: new Set(),
  };
  if (st.phone) {
    st.customer = await readCustomer(deps, st.phone);
    if (st.customer?.name && !st.name) st.name = st.customer.name;
  }
  const userText = String(input.text || "").trim();
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
      const res = await generate(deps.ai, {
        contents,
        config: {
          systemInstruction: systemPrompt(input, st.customer, st.phone),
          tools: [{ functionDeclarations: TOOLS }],
          temperature: 0.4,
        },
      });
      const calls = res.functionCalls || [];
      if (!calls.length) {
        finalText = res.text || "";
        break;
      }
      contents.push(res.candidates?.[0]?.content || { role: "model", parts: calls.map((c: any) => ({ functionCall: c })) });
      const parts: any[] = [];
      for (const call of calls) {
        let out: any;
        try {
          out = await runTool(String(call.name), call.args || {}, input, deps, st);
        } catch (e: any) {
          out = { ok: false, error: e?.message || "failed" };
        }
        parts.push({ functionResponse: { name: call.name, response: out, ...(call.id ? { id: call.id } : {}) } });
      }
      contents.push({ role: "user", parts });
    }
    answer = parseBotAnswer(finalText);
    if (!answer.reply) answer.reply = "סליחה, לא הצלחתי לענות כרגע. אפשר לנסות שוב, או להשאיר מספר ונחזור אליך.";
  }
  answer.reply = answer.reply.replace(/\*\*/g, "*");

  await appendToConversation(
    { botId, sessionId: input.sessionId, agentId: String(input.agent.id), channel: input.channel, phone: st.phone, name: st.name, test: input.channel === "test" },
    [userMsg, msg("bot", answer.reply, { ...(answer.options.length ? { options: answer.options } : {}), ...(answer.images.length ? { images: answer.images } : {}) })]
  );
  return { ...answer, phone: st.phone || undefined, name: st.name || undefined, notes: st.notes };
}

// ---------- the voice bot's prompt ----------

// The same knowledge, written for a voice agent (ElevenLabs): no buttons / JSON / images, short
// spoken sentences. The owner copies it into the voice agent.
export function voicePrompt(agent: any, brain: BotBrain, lessons: BotLesson[], brainText: string): string {
  const business = agent?.businessName || agent?.name || "העסק";
  const qa = brain.qa.filter((x) => x.q.trim() && x.a.trim());
  const active = lessons.filter((l) => l.active);
  return [
    `את/ה הנציג/ה הקולי/ת של "${business}" בשיחת טלפון. מדברים בעברית, במשפטים קצרים וברורים, בטון חם וטבעי — כמו נציג אנושי.`,
    "אל תקריא רשימות ארוכות, קישורים או סימנים; אמור לכל היותר שתי אפשרויות בכל פעם ושאל מה מתאים.",
    "מספרים ושעות אמור במילים טבעיות (\"בעשר וחצי\"). אם לא יודעים משהו — אמור שנציג יחזור אליו, ואל תמציא.",
    "",
    "# הידע של העסק",
    brainText.trim(),
    qa.length ? "\n# שאלות ותשובות\n" + qa.map((x) => `ש: ${x.q.trim()}\nת: ${x.a.trim()}`).join("\n\n") : "",
    active.length ? "\n# דגשים שנלמדו משיחות\n" + active.map((l) => `- ${l.text}`).join("\n") : "",
    brain.voiceNotes?.trim() ? "\n# הנחיות לשיחה הקולית\n" + brain.voiceNotes.trim() : "",
  ]
    .filter((x) => x !== "")
    .join("\n")
    // the chat-only parts of a prompt (buttons, JSON, list options) mean nothing on the phone
    .replace(/^.*(?:JSON|list_options).*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

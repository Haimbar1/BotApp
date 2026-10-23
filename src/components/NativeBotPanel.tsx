import React, { useEffect, useRef, useState } from "react";

// "🤖 הבוט החכם" tab of an agent: the bot answering here instead of n8n (server: botEngine.ts,
// botStore.ts, /api/bot-brain*). Turn it on for the website widget, its Q&A (filled automatically
// from the prompt the first time — the owners won't do it themselves), what it learned, the notes it
// left for the staff, exam booking hours, a test chat and the same knowledge for the voice bot.

type Request = (url: string, init?: RequestInit) => Promise<Response>;

interface Qa { id: string; q: string; a: string }
interface Lesson { id: string; text: string; source: "customer" | "owner"; quote?: string; active: boolean; createdAt: string }
interface Note { id: string; kind: "handoff" | "bug" | "lesson"; text: string; phone?: string; name?: string; sessionId: string; channel: string; createdAt: string; doneAt?: string }
interface Brain {
  agentId: string;
  nativeWeb: boolean;
  nativeWhatsapp?: boolean;
  lastWaMessageAt?: string;
  qa: Qa[];
  booking: { enabled: boolean; hours: Record<string, string>; slotMinutes: number; daysAhead: number };
  voiceNotes?: string;
  autofilledAt?: string;
}
interface ChatLine { role: "user" | "bot"; text: string; options?: string[] }

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const NOTE_STYLE: Record<Note["kind"], { label: string; cls: string }> = {
  handoff: { label: "🙋 לחזור ללקוח", cls: "border-amber-500/40 bg-amber-500/10 text-amber-100" },
  bug: { label: "🐞 תקלה בבוט", cls: "border-red-500/50 bg-red-500/10 text-red-100" },
  lesson: { label: "🧠 הבוט למד", cls: "border-sky-500/40 bg-sky-500/10 text-sky-100" },
};

const card = "bg-[#0C0D12] rounded-xl border border-slate-800 p-4 flex flex-col gap-3";
const input = "w-full bg-[#11131a] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500";
const btn = "px-3 py-1.5 rounded-lg text-[11px] font-black border transition cursor-pointer disabled:opacity-50 disabled:cursor-default";
const showDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const newQaId = () => `qa_${Math.random().toString(36).slice(2, 10)}`;

export default function NativeBotPanel({ agentId, request }: { agentId: string; request: Request }) {
  const [brain, setBrain] = useState<Brain | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [crmLinked, setCrmLinked] = useState(true);
  const [botId, setBotId] = useState("");
  const [sameBotId, setSameBotId] = useState<string[]>([]);
  // what the website itself gets from /api/public/bot-engine for this bot id right now
  const [siteSees, setSiteSees] = useState<{ native: boolean; matches?: { agentId: string; name: string; nativeWeb: any }[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [autofilling, setAutofilling] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [newLesson, setNewLesson] = useState("");
  const [voice, setVoice] = useState("");
  const autofillTried = useRef<string>("");

  const json = (r: Response) => r.json().catch(() => ({}));

  const load = async () => {
    const r = await request(`/api/bot-brain?agentId=${encodeURIComponent(agentId)}`);
    const d: any = await json(r);
    if (!r.ok || !d.success) {
      setMessage(d.message || "טעינת הבוט נכשלה");
      return;
    }
    setBrain(d.brain);
    setLessons(d.lessons || []);
    setNotes(d.notes || []);
    setCrmLinked(d.crmLinked !== false);
    setBotId(d.botId || "");
    setSameBotId(d.sameBotId || []);
    setDirty(false);
    checkSite(d.botId || "");
    return d.brain as Brain;
  };

  const checkSite = async (id: string) => {
    if (!id) return setSiteSees(null);
    try {
      const r = await fetch(`/api/public/bot-engine?bot_id=${encodeURIComponent(id)}&debug=1`, { cache: "no-store" });
      setSiteSees(await r.json());
    } catch {
      setSiteSees(null);
    }
  };

  const save = async (next: Brain, quiet = false) => {
    setSaving(true);
    try {
      const r = await request("/api/bot-brain", { method: "PUT", body: JSON.stringify({ agentId, brain: next }) });
      const d: any = await json(r);
      if (!r.ok || !d.success) throw new Error(d.message || "השמירה נכשלה");
      setBrain(d.brain);
      setDirty(false);
      if (!quiet) setMessage("נשמר ✓");
      checkSite(botId);
    } catch (e: any) {
      setMessage(e?.message || "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  // Q&A written by the AI from the prompt; added after what's there (no duplicate questions)
  const autofill = async (current: Brain, automatic: boolean) => {
    setAutofilling(true);
    setMessage(automatic ? "ממלא שאלות ותשובות מתוך השכל של הבוט…" : "");
    try {
      const r = await request("/api/bot-brain/autofill", { method: "POST", body: JSON.stringify({ agentId }) });
      const d: any = await json(r);
      if (!r.ok || !d.success) throw new Error(d.message || "המילוי האוטומטי נכשל");
      // the AI takes a while — merge into what is stored NOW (the switch may have been flipped meanwhile)
      const fresh: any = await json(await request(`/api/bot-brain?agentId=${encodeURIComponent(agentId)}`));
      if (fresh?.brain) current = fresh.brain;
      const known = new Set(current.qa.map((x) => x.q.trim()));
      const added = (d.qa || []).filter((x: any) => !known.has(String(x.q).trim())).map((x: any) => ({ id: newQaId(), q: x.q, a: x.a }));
      const hours = Object.keys(current.booking.hours || {}).some((k) => current.booking.hours[k]) ? current.booking.hours : { ...current.booking.hours, ...(d.hours || {}) };
      const next: Brain = { ...current, qa: [...current.qa, ...added], booking: { ...current.booking, hours }, autofilledAt: new Date().toISOString() };
      await save(next, true);
      setMessage(added.length ? `נוספו ${added.length} שאלות ותשובות מתוך השכל — עברו עליהן ותקנו מה שצריך ✨` : "לא נמצאו שאלות חדשות להוסיף");
    } catch (e: any) {
      setMessage(e?.message || "המילוי האוטומטי נכשל");
    } finally {
      setAutofilling(false);
    }
  };

  useEffect(() => {
    setBrain(null);
    setMessage("");
    setVoice("");
    load().then((b) => {
      // the first time the tab opens for a bot with no Q&A, the bot writes its own
      if (b && !b.qa.length && !b.autofilledAt && autofillTried.current !== agentId) {
        autofillTried.current = agentId;
        autofill(b, true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  if (!brain) return <div className="p-6 text-xs text-slate-400 text-center">{message || "טוען…"}</div>;

  const edit = (patch: Partial<Brain>) => {
    setBrain({ ...brain, ...patch });
    setDirty(true);
  };
  const setQa = (id: string, patch: Partial<Qa>) => edit({ qa: brain.qa.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const setHours = (day: number, value: string) => edit({ booking: { ...brain.booking, hours: { ...brain.booking.hours, [String(day)]: value } } });

  const lessonAction = async (body: any) => {
    const r = await request("/api/bot-brain/lessons", { method: "POST", body: JSON.stringify({ agentId, ...body }) });
    const d: any = await json(r);
    if (d.success) setLessons(d.lessons || []);
  };

  const markDone = async (n: Note, done: boolean) => {
    await request("/api/bot-notes/done", { method: "POST", body: JSON.stringify({ agentId, id: n.id, done }) });
    setNotes(notes.map((x) => (x.id === n.id ? { ...x, doneAt: done ? new Date().toISOString() : undefined } : x)));
  };

  const loadVoice = async () => {
    const r = await request(`/api/bot-brain/voice-prompt?agentId=${encodeURIComponent(agentId)}`);
    const d: any = await json(r);
    setVoice(d.prompt || "");
  };

  const shownNotes = notes.filter((n) => showDone || !n.doneAt);
  const openCount = notes.filter((n) => !n.doneAt && n.kind !== "lesson").length;

  return (
    <div className="flex flex-col gap-4 pt-4" dir="rtl">
      {/* Engine on/off */}
      <div className={`${card} sm:flex-row sm:items-center sm:justify-between`}>
        <div className="text-right">
          <h3 className="text-sm font-black text-white">🤖 הבוט החכם — עונה ישירות מהמערכת</h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            במקום n8n: הבוט רואה את כרטיס הלקוח ב-CRM, רכישות והזמנות, תורים ביומן והקמפיינים שקיבל בוואטסאפ, קובע ומזיז תורים, משאיר הערות לנציג ולומד מתיקונים.
            {!crmLinked && <span className="text-amber-300"> (הבוט לא משויך לעסק בפורטל — אין חיבור ל-CRM וליומן)</span>}
          </p>
          <p className="text-[10.5px] text-slate-500 mt-1" dir="rtl">
            מזהה הבוט באתר: <span dir="ltr" className="font-mono text-slate-300">{botId || "—"}</span> (זה ה-data-bot-id בקוד ההטמעה)
            {sameBotId.length > 0 && <span className="text-amber-300"> · שים לב: גם {sameBotId.join(", ")} עם אותו מזהה — האתר עונה מהבוט שהמתג שלו דלוק</span>}
          </p>
          {!(brain.booking.enabled && Object.values(brain.booking.hours).some((h) => String(h).trim())) && (
            <p className="text-[11px] mt-1 font-bold text-amber-300">
              📅 הבוט עדיין לא קובע תורים בעצמו (רק שולח קישור / משאיר הערה לנציג) — כדי שיקבע: למטה ב"📅 הבוט קובע, מזיז ומבטל תורים" לסמן, למלא שעות לכל יום, ו"שמור שינויים 💾".
            </p>
          )}
          {siteSees && (
            <p className={`text-[11px] mt-1 font-bold ${siteSees.native ? "text-emerald-300" : "text-amber-300"}`}>
              האתר רואה כרגע: {siteSees.native ? "🟢 הבוט החדש עונה" : "⚪ n8n עונה"}
              {!siteSees.native && brain.nativeWeb && " — למרות שהמתג דלוק. העתק את השורה הזו לקלוד: " + JSON.stringify(siteSees)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-stretch sm:items-end gap-1.5 shrink-0">
          <span className={`text-xs font-black ${brain.nativeWeb ? "text-emerald-300" : "text-slate-300"}`}>
            מי עונה ללקוחות באתר עכשיו: {brain.nativeWeb ? "🟢 הבוט החדש" : "⚪ הבוט הישן (n8n)"}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ ...brain, nativeWeb: !brain.nativeWeb })}
            className={`${btn} px-4 py-2 text-xs ${brain.nativeWeb ? "border-slate-600 text-slate-200 bg-slate-800/60" : "border-emerald-500 text-white bg-emerald-600 hover:bg-emerald-500"}`}
          >
            {saving ? "שומר…" : brain.nativeWeb ? "↩ החזר את האתר לבוט הישן (n8n)" : "🚀 העבר את הבוט באתר לבוט החדש"}
          </button>
        </div>
      </div>

      {message && <div className="text-[11px] text-sky-200 bg-sky-500/10 border border-sky-500/30 rounded-lg px-3 py-2">{message}</div>}

      {brain && botId && <WhatsAppCard botId={botId} brain={brain} saving={saving} request={request} onSwitch={(on) => save({ ...brain, nativeWhatsapp: on })} />}

      {/* Notes for the staff */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-white">📌 הערות לצוות {openCount > 0 && <span className="text-amber-300">({openCount} פתוחות)</span>}</h4>
          <label className="text-[10px] text-slate-400 flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> להציג גם שטופלו
          </label>
        </div>
        {shownNotes.length === 0 ? (
          <p className="text-[11px] text-slate-500">אין הערות פתוחות. כשהבוט מבטיח ללקוח שיחזרו אליו, או כשלקוח מדווח על תקלה בבוט — זה יופיע כאן (וגם בכרטיס הלקוח ב-CRM).</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {shownNotes.map((n) => (
              <div key={n.id} className={`border rounded-lg px-3 py-2 text-[11px] flex items-start justify-between gap-3 ${NOTE_STYLE[n.kind].cls} ${n.doneAt ? "opacity-50" : ""}`}>
                <div>
                  <div className="font-black">
                    {NOTE_STYLE[n.kind].label} · {n.name || "לקוח"} {n.phone ? `· ${n.phone}` : ""} · <span className="font-normal">{showDate(n.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap">{n.text}</div>
                </div>
                {n.kind !== "lesson" && (
                  <button type="button" className={`${btn} border-slate-600 text-slate-200 shrink-0`} onClick={() => markDone(n, !n.doneAt)}>
                    {n.doneAt ? "החזר" : "טופל ✓"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Q&A */}
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black text-white">❓ שאלות ותשובות ({brain.qa.length})</h4>
          <div className="flex gap-2">
            <button type="button" disabled={autofilling} className={`${btn} border-violet-500/40 text-violet-200 bg-violet-500/10`} onClick={() => autofill(brain, false)}>
              {autofilling ? "ממלא…" : "✨ מלא אוטומטית מהשכל"}
            </button>
            <button type="button" className={`${btn} border-slate-700 text-slate-200`} onClick={() => edit({ qa: [{ id: newQaId(), q: "", a: "" }, ...brain.qa] })}>
              + שאלה
            </button>
          </div>
        </div>
        <p className="text-[10.5px] text-slate-500">תשובה מכאן גוברת על ניסוח אחר בשכל. הלקוחות (בעלי העסק) יכולים להוסיף ולתקן כאן.</p>
        <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto">
          {brain.qa.map((x) => (
            <div key={x.id} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
              <input className={input} value={x.q} placeholder="שאלה" onChange={(e) => setQa(x.id, { q: e.target.value })} />
              <textarea className={`${input} min-h-[38px]`} rows={2} value={x.a} placeholder="תשובה" onChange={(e) => setQa(x.id, { a: e.target.value })} />
              <button type="button" className={`${btn} border-red-500/30 text-red-300`} onClick={() => edit({ qa: brain.qa.filter((y) => y.id !== x.id) })}>
                מחק
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lessons */}
      <div className={card}>
        <h4 className="text-xs font-black text-white">🧠 מה הבוט למד ({lessons.filter((l) => l.active).length} פעילים)</h4>
        <p className="text-[10.5px] text-slate-500">כשלקוח מתקן את הבוט בצדק, הבוט שומר לקח ולא חוזר על הטעות. אפשר לכבות לקח שגוי או להוסיף לקח בעצמכם.</p>
        <div className="flex gap-2">
          <input className={input} value={newLesson} placeholder='למשל: "החניה מאחורי הבניין"' onChange={(e) => setNewLesson(e.target.value)} />
          <button
            type="button"
            className={`${btn} border-sky-500/40 text-sky-200 shrink-0`}
            disabled={!newLesson.trim()}
            onClick={async () => {
              await lessonAction({ text: newLesson });
              setNewLesson("");
            }}
          >
            הוסף
          </button>
        </div>
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
          {lessons.map((l) => (
            <div key={l.id} className={`flex items-start justify-between gap-2 text-[11px] border border-slate-800 rounded-lg px-3 py-2 ${l.active ? "text-slate-100" : "text-slate-500 line-through"}`}>
              <div>
                <div>{l.text}</div>
                <div className="text-[10px] text-slate-500 no-underline">
                  {l.source === "customer" ? "מלקוח" : "מכם"} · {showDate(l.createdAt)}
                  {l.quote ? ` · "${l.quote.slice(0, 80)}"` : ""}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" className={`${btn} border-slate-700 text-slate-300`} onClick={() => lessonAction({ id: l.id, active: !l.active })}>
                  {l.active ? "כבה" : "הפעל"}
                </button>
                <button type="button" className={`${btn} border-red-500/30 text-red-300`} onClick={() => lessonAction({ id: l.id, remove: true })}>
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking hours */}
      <div className={card}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={brain.booking.enabled} onChange={(e) => edit({ booking: { ...brain.booking, enabled: e.target.checked } })} />
          <span className="text-xs font-black text-white">📅 הבוט קובע, מזיז ומבטל תורים ביומן הסניף</span>
        </label>
        <p className="text-[10.5px] text-slate-500">
          הבוט מציע רק מועדים פנויים ביומן (לפי השעות כאן, בלי תורים וחסימות קיימים). פורמט: 10:00-13:00, 16:00-19:00 — ריק = סגור.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-2 text-[11px] text-slate-300">
              <span className="w-12 shrink-0">{d}</span>
              <input className={input} dir="ltr" value={brain.booking.hours[String(i)] || ""} placeholder="סגור" onChange={(e) => setHours(i, e.target.value)} />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-[11px] text-slate-300">
          <label className="flex items-center gap-2">
            אורך תור (דקות)
            <input type="number" className={`${input} w-20`} value={brain.booking.slotMinutes} onChange={(e) => edit({ booking: { ...brain.booking, slotMinutes: Number(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-2">
            כמה ימים קדימה
            <input type="number" className={`${input} w-20`} value={brain.booking.daysAhead} onChange={(e) => edit({ booking: { ...brain.booking, daysAhead: Number(e.target.value) } })} />
          </label>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button type="button" disabled={saving || !dirty} className={`${btn} px-5 py-2 text-xs ${dirty ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-700 text-slate-400"}`} onClick={() => save(brain)}>
          {saving ? "שומר…" : dirty ? "שמור שינויים 💾" : "נשמר ✓"}
        </button>
      </div>

      <TestChat agentId={agentId} request={request} onNotes={load} />

      {/* Voice bot */}
      <div className={card}>
        <h4 className="text-xs font-black text-white">📞 פרומפט לבוט הקולי</h4>
        <p className="text-[10.5px] text-slate-500">אותו ידע (שכל + שאלות ותשובות + מה שנלמד), מנוסח לשיחת טלפון. מעתיקים לסוכן הקולי.</p>
        <textarea className={`${input} min-h-[60px]`} rows={2} value={brain.voiceNotes || ""} placeholder="הנחיות נוספות לשיחה הקולית בלבד (לא חובה)" onChange={(e) => edit({ voiceNotes: e.target.value })} />
        <div className="flex gap-2">
          <button type="button" className={`${btn} border-slate-700 text-slate-200`} onClick={loadVoice}>
            הצג פרומפט קולי
          </button>
          {voice && (
            <button type="button" className={`${btn} border-sky-500/40 text-sky-200`} onClick={() => navigator.clipboard?.writeText(voice).then(() => setMessage("הפרומפט הקולי הועתק ✓"))}>
              העתק
            </button>
          )}
        </div>
        {voice && <textarea readOnly className={`${input} min-h-[200px] font-mono text-[10.5px]`} value={voice} />}
      </div>
    </div>
  );
}

// The owner talks to the bot as a customer. Reads the CRM like a real chat (enter a phone to be
// "that customer"), but books nothing and writes nothing to the CRM; a correction here teaches the bot.
function TestChat({ agentId, request, onNotes }: { agentId: string; request: Request; onNotes: () => void }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState(() => Math.random().toString(36).slice(2, 10));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines, busy]);

  const send = async (t: string) => {
    const message = t.trim();
    if (!message || busy) return;
    setLines((l) => [...l, { role: "user", text: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await request("/api/bot-brain/test-chat", { method: "POST", body: JSON.stringify({ agentId, sessionId: session, message, phone: phone || undefined }) });
      const d: any = await r.json().catch(() => ({}));
      setLines((l) => [...l, { role: "bot", text: d.reply || d.message || "שגיאה", options: d.options }]);
      if (d.notes?.length) onNotes();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black text-white">🧪 נסו את הבוט</h4>
        <div className="flex gap-2 items-center">
          <input className={`${input} w-40`} dir="ltr" value={phone} placeholder="טלפון של לקוח (לא חובה)" onChange={(e) => setPhone(e.target.value)} />
          <button
            type="button"
            className={`${btn} border-slate-700 text-slate-300`}
            onClick={() => {
              setLines([]);
              setSession(Math.random().toString(36).slice(2, 10));
            }}
          >
            שיחה חדשה
          </button>
        </div>
      </div>
      <p className="text-[10.5px] text-slate-500">שיחת בדיקה: קוראת מה-CRM כמו שיחה אמיתית, אבל לא קובעת תורים ולא כותבת ל-CRM. תיקון שתכתבו כאן — הבוט ילמד ממנו.</p>
      <div ref={boxRef} className="h-72 overflow-y-auto flex flex-col gap-2 bg-[#07080d] rounded-lg p-3 border border-slate-850">
        {lines.map((l, i) => (
          <div key={i} className={`max-w-[85%] ${l.role === "user" ? "self-start" : "self-end"}`}>
            <div className={`px-3 py-2 rounded-xl text-xs whitespace-pre-wrap ${l.role === "user" ? "bg-[#1d2235] text-slate-100" : "bg-sky-900/40 border border-sky-500/20 text-sky-50"}`}>{l.text}</div>
            {l.options && l.options.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {l.options.map((o) => (
                  <button key={o} type="button" className={`${btn} border-blue-500 text-blue-200 bg-blue-500/10`} onClick={() => send(o)}>
                    {o}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="self-end text-[11px] text-slate-400">הבוט כותב…</div>}
      </div>
      <div className="flex gap-2">
        <input className={input} value={text} placeholder="כתבו הודעה כמו לקוח…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(text)} />
        <button type="button" disabled={busy || !text.trim()} className={`${btn} bg-sky-600 border-sky-500 text-white shrink-0`} onClick={() => send(text)}>
          שלח
        </button>
      </div>
    </div>
  );
}

// WhatsApp: (1) the number's messages come through BotApp — n8n still answers, nothing changes for
// the customers; (2) the switch: the new bot answers instead of n8n (server: /api/webhooks/whatsapp).
const BOTAPP_WEBHOOK = "https://app.smartesek.com/api/webhooks/whatsapp";
const BOTAPP_VERIFY_TOKEN = "smartesek-botapp";

function WhatsAppCard({ botId, brain, saving, request, onSwitch }: { botId: string; brain: Brain; saving: boolean; request: Request; onSwitch: (on: boolean) => void }) {
  const [webhook, setWebhook] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = async () => {
    const r = await request(`/api/whatsapp/config?botId=${encodeURIComponent(botId)}`);
    const d: any = await r.json().catch(() => ({}));
    setWebhook(String(d?.config?.webhookCallbackUrl || ""));
    setConnected(!!(d?.config?.phoneNumberId && d?.config?.systemUserAccessToken));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const throughBotApp = webhook === BOTAPP_WEBHOOK;

  const route = async () => {
    setBusy(true);
    setNote("");
    try {
      const r = await request("/api/whatsapp/subscribe-webhook", { method: "POST", body: JSON.stringify({ botId, callbackUrl: BOTAPP_WEBHOOK, verifyToken: BOTAPP_VERIFY_TOKEN }) });
      const d: any = await r.json().catch(() => ({}));
      if (!d.success) throw new Error(d.message || "החיבור נכשל");
      setNote("✓ ההודעות מהוואטסאפ עוברות עכשיו דרך BotApp (בינתיים n8n ממשיך לענות כרגיל)");
      await load();
    } catch (e: any) {
      setNote(e?.message || "החיבור נכשל");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <h4 className="text-xs font-black text-white">💬 וואטסאפ</h4>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
        <div className="text-slate-300">
          <b>שלב 1 —</b> ההודעות מהמספר עוברות דרך BotApp:{" "}
          {webhook === null ? "בודק…" : throughBotApp ? <span className="text-emerald-300 font-bold">כן ✓</span> : <span className="text-amber-300 font-bold">עדיין ישר ל-n8n</span>}
          <div className="text-[10.5px] text-slate-500">לא משנה כלום ללקוחות — כל עוד שלב 2 כבוי, n8n ממשיך לענות כמו היום.</div>
          <div className={`text-[10.5px] font-bold ${brain.lastWaMessageAt ? "text-emerald-300" : "text-amber-300"}`}>
            {brain.lastWaMessageAt
              ? `הודעת וואטסאפ אחרונה שהגיעה ל-BotApp: ${showDate(brain.lastWaMessageAt)} — המסלול עובד`
              : "עוד לא הגיעה ל-BotApp אף הודעת וואטסאפ — שלחו הודעה למספר ורעננו את הדף"}
          </div>
        </div>
        {!throughBotApp && (
          <button type="button" disabled={busy || webhook === null} className={`${btn} border-sky-500 text-white bg-sky-600 shrink-0`} onClick={route}>
            {busy ? "מחבר…" : "חבר את הוואטסאפ דרך BotApp"}
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] border-t border-slate-800 pt-2">
        <div className="text-slate-300">
          <b>שלב 2 —</b> מי עונה ללקוחות בוואטסאפ: {brain.nativeWhatsapp ? <span className="text-emerald-300 font-bold">🟢 הבוט החדש</span> : <span className="font-bold">⚪ הבוט הישן (n8n)</span>}
          <div className="text-[10.5px] text-slate-500">הבוט החדש גם מתמלל הודעות קוליות — התמלול מופיע כטקסט (🎤) בכל מקום שמציג את השיחה.</div>
        </div>
        <button
          type="button"
          disabled={saving || (!brain.nativeWhatsapp && !throughBotApp)}
          title={!brain.nativeWhatsapp && !throughBotApp ? "קודם שלב 1" : ""}
          onClick={() => onSwitch(!brain.nativeWhatsapp)}
          className={`${btn} px-4 py-2 shrink-0 ${brain.nativeWhatsapp ? "border-slate-600 text-slate-200 bg-slate-800/60" : "border-emerald-500 text-white bg-emerald-600"}`}
        >
          {brain.nativeWhatsapp ? "↩ החזר את הוואטסאפ ל-n8n" : "🚀 העבר את הוואטסאפ לבוט החדש"}
        </button>
      </div>
      {!connected && webhook !== null && <div className="text-[10.5px] text-amber-300">לבוט הזה לא נראה חיבור וואטסאפ (לשונית "וואטסאפ הגדרות").</div>}
      {note && <div className="text-[11px] text-sky-200">{note}</div>}
    </div>
  );
}

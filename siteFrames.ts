// The business's eyeglass frames from the portal (portal.smartesek.com → "אתר" → מסגרות למדידה), kept
// as one topic in the agent's own media section ("תמונות וגלריית מדיה", agent.imagesInfo) — so it is
// visible in the editor and part of the prompt — and added to every n8n sync. The same frames the
// website shows, so nothing is entered twice. When frames change in the portal, it calls
// /api/portal/site-frames-changed: the agents' media sections are updated and their last sync re-sent.

const PORTAL_URL = (process.env.PORTAL_URL || "https://portal.smartesek.com").replace(/\/+$/, "");
const CACHE_MS = 60 * 1000;

// The topic this module owns inside the media section / full prompt. Anything under this header (up
// to the next markdown header) is replaced on every sync; the rest of the text is never touched.
export const FRAMES_TOPIC_HEADER = "### נושא: מסגרות משקפיים (מתעדכן אוטומטית מהפורטל)";

interface SiteFrame {
  id: string;
  name: string;
  style?: string;
  description?: string;
  price: number;
  inStock?: boolean;
}

const cache = new Map<string, { at: number; frames: SiteFrame[]; siteUrl: string }>();

// ok: false = the portal could not be read and there is no earlier list (the topic is then left as is)
async function fetchSiteFrames(tenantId: string): Promise<{ frames: SiteFrame[]; siteUrl: string; ok?: boolean }> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  try {
    const res = await fetch(`${PORTAL_URL}/api/public/site/${encodeURIComponent(tenantId)}/frames`, {
      signal: AbortSignal.timeout(5000),
    });
    // 404 = the business has no website module in the portal: no frames topic
    if (res.status === 404) {
      const empty = { at: Date.now(), frames: [], siteUrl: "" };
      cache.set(tenantId, empty);
      return empty;
    }
    if (!res.ok) throw new Error(`portal ${res.status}`);
    const data: any = await res.json();
    const frames = (Array.isArray(data?.frames) ? data.frames : []).filter((f: any) => /^[a-z0-9]{6,32}$/.test(String(f?.id)));
    const entry = { at: Date.now(), frames, siteUrl: String(data?.siteUrl || "").replace(/\/+$/, "") };
    cache.set(tenantId, entry);
    return entry;
  } catch (err: any) {
    console.warn("[frames] reading the portal's frames failed:", err?.message);
    // keep the last good list rather than dropping the frames from the bot
    return hit || { frames: [], siteUrl: "", ok: false };
  }
}

export function forgetSiteFrames(tenantId: string) {
  cache.delete(tenantId);
}

// The frames as a topic in the media section's own format (see FirebaseMediaUploader's parser).
function framesTopic(frames: SiteFrame[], siteUrl: string): string {
  if (!frames.length) return "";
  const lines = [
    FRAMES_TOPIC_HEADER,
    "- תיאור: המסגרות שאפשר לקנות בחנות ולמדוד על הפנים באתר — שם הדגם, סגנון, מחיר ותיאור.",
    "- הנחיות: כשלקוח שואל על מסגרות, דגמים או מחירים, או מבקש לראות משקפיים — הצג לו עד 3 דגמים מתאימים מהרשימה הזו בלבד: שם, מחיר ותמונה (שלח את קישור התמונה כמו שהוא). בחר לפי התיאור של כל דגם את מה שמתאים למה שהלקוח ביקש, והשתמש בתיאור כדי לספר עליו." +
      (siteUrl ? " הצע לו למדוד את המסגרת על הפנים שלו דרך הקישור של הדגם." : "") +
      " דגם שמסומן \"לא במלאי כרגע\" — אל תציע אותו; אם הלקוח שואל עליו, אמור שהוא אזל כרגע והצע דגם דומה שבמלאי. אל תמציא דגמים, מחירים או תמונות שלא מופיעים כאן.",
    "- דגמים זמינים:",
  ];
  frames.forEach((f, i) => {
    lines.push(`  ${i + 1}. ${f.name}${f.inStock === false ? " (לא במלאי כרגע)" : ""}`);
    // One line: the media section's format reads a single "- תיאור:" line per model
    const about = String(f.description || "").replace(/\s+/g, " ").trim();
    lines.push(`     - תיאור: ${f.style ? `${f.style} · ` : ""}${f.price} ₪${about ? ` — ${about}` : ""}`);
    lines.push(`     - תמונה: ${PORTAL_URL}/api/public/site/frames/${f.id}.png`);
    if (siteUrl) lines.push(`     - קישור: ${siteUrl}/?page=tryon&frame=${f.id}`);
  });
  return lines.join("\n");
}

// Replaces the previous frames topic (its header up to the next markdown header) with the current one,
// in the same place; a first topic goes at the end. An empty topic removes the old one.
export function withFramesTopic(text: string, topic: string): string {
  const lines = String(text || "").split("\n");
  const out: string[] = [];
  let skipping = false;
  let insertAt = -1;
  for (const line of lines) {
    if (line.trim() === FRAMES_TOPIC_HEADER) {
      skipping = true;
      if (insertAt < 0) insertAt = out.length;
      continue;
    }
    if (skipping && /^\s*#{1,6}\s/.test(line)) skipping = false;
    if (!skipping) out.push(line);
  }
  if (topic) {
    if (insertAt < 0) {
      while (out.length && !out[out.length - 1].trim()) out.pop();
      if (out.length) out.push("");
      out.push(topic);
    } else {
      out.splice(insertAt, 0, topic, "");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// The business's current frames topic ("" = no frames), or null when the portal can't be read
export async function siteFramesTopic(tenantId: string): Promise<string | null> {
  const { frames, siteUrl, ok } = await fetchSiteFrames(tenantId);
  return ok === false ? null : framesTopic(frames, siteUrl);
}

// Same text up to blank lines and trailing spaces (the media editor re-formats the section)
const sameText = (a: string, b: string) => {
  const norm = (s: string) => String(s || "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim()).join("\n");
  return norm(a) === norm(b);
};

// The prompt's parts as the agent screen keeps them. An agent without any (only a full prompt, from
// before the parts) shows its prompt split into parts, so its media section is left alone.
const PART_FIELDS = ["welcomeMessage", "botIdentity", "coursesInfo", "kidsCourses", "conversationFlow", "writingStyle",
  "faqAnswers", "whatNotToDo", "syllabusLinks", "humanEscalation", "imagesInfo", "videosInfo"];

// The agent's media section with the given frames topic, or null when nothing changes
export function agentImagesWithFrames(agent: any, topic: string | null): string | null {
  if (topic === null || !agent) return null;
  if (!PART_FIELDS.some((f) => agent[f])) return null;
  const current = String(agent.imagesInfo || "");
  const next = withFramesTopic(current, topic);
  return sameText(current, next) ? null : next;
}

// How many frames the bot gets (for the "מסגרות מהפורטל" line in the agent screen)
export async function siteFramesCount(tenantId: string): Promise<{ count: number; inStock: number }> {
  const { frames } = await fetchSiteFrames(tenantId);
  return { count: frames.length, inStock: frames.filter((f) => f.inStock !== false).length };
}

// The n8n payload fields that carry the media section and the full prompt (see App.tsx's sync)
const MEDIA_FIELDS = ["Pics"];
const PROMPT_FIELDS = ["Prompt", "prompt", "businessPrompt", "Business Prompt", "systemPrompt", "System Prompt", "הנחיות", "שכל"];

// A copy of an n8n sync payload with the business's current frames in the media section and prompt.
export async function withSiteFrames(payload: any, tenantId: string): Promise<any> {
  const topic = await siteFramesTopic(tenantId);
  if (topic === null) return payload; // the portal is unreachable: the payload keeps whatever it carries
  const next = { ...payload };
  for (const field of [...MEDIA_FIELDS, ...PROMPT_FIELDS]) {
    if (typeof next[field] === "string") next[field] = withFramesTopic(next[field], topic);
  }
  return next;
}

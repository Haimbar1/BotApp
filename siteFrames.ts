// The business's eyeglass frames from the portal (portal.smartesek.com → "אתר" → מסגרות למדידה), added
// automatically to the bot's media section ("תמונות וגלריית מדיה") whenever the agent is synced to
// n8n — the same frames the website shows, so nothing is entered twice. When frames change in the
// portal, it calls /api/portal/site-frames-changed and the last sync is re-sent with the new list.

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
}

const cache = new Map<string, { at: number; frames: SiteFrame[]; siteUrl: string }>();

async function fetchSiteFrames(tenantId: string): Promise<{ frames: SiteFrame[]; siteUrl: string }> {
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
    return hit || { frames: [], siteUrl: "" };
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
      " אל תמציא דגמים, מחירים או תמונות שלא מופיעים כאן.",
    "- דגמים זמינים:",
  ];
  frames.forEach((f, i) => {
    lines.push(`  ${i + 1}. ${f.name}`);
    // One line: the media section's format reads a single "- תיאור:" line per model
    const about = String(f.description || "").replace(/\s+/g, " ").trim();
    lines.push(`     - תיאור: ${f.style ? `${f.style} · ` : ""}${f.price} ₪${about ? ` — ${about}` : ""}`);
    lines.push(`     - תמונה: ${PORTAL_URL}/api/public/site/frames/${f.id}.png`);
    if (siteUrl) lines.push(`     - קישור: ${siteUrl}/?page=tryon&frame=${f.id}`);
  });
  return lines.join("\n");
}

// Removes a previous frames topic (header up to the next markdown header) and appends the current one.
export function withFramesTopic(text: string, topic: string): string {
  const lines = String(text || "").split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (line.trim() === FRAMES_TOPIC_HEADER) {
      skipping = true;
      continue;
    }
    if (skipping && /^\s*#{1,6}\s/.test(line)) skipping = false;
    if (!skipping) out.push(line);
  }
  const base = out.join("\n").replace(/\s+$/, "");
  if (!topic) return base;
  return base ? `${base}\n\n${topic}` : topic;
}

// The n8n payload fields that carry the media section and the full prompt (see App.tsx's sync)
const MEDIA_FIELDS = ["Pics"];
const PROMPT_FIELDS = ["Prompt", "prompt", "businessPrompt", "Business Prompt", "systemPrompt", "System Prompt", "הנחיות", "שכל"];

// A copy of an n8n sync payload with the business's current frames in the media section and prompt.
export async function withSiteFrames(payload: any, tenantId: string): Promise<any> {
  const { frames, siteUrl } = await fetchSiteFrames(tenantId);
  const topic = framesTopic(frames, siteUrl);
  const next = { ...payload };
  for (const field of [...MEDIA_FIELDS, ...PROMPT_FIELDS]) {
    if (typeof next[field] === "string") next[field] = withFramesTopic(next[field], topic);
  }
  return next;
}

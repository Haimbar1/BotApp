// Images from the business's website for the bot's media section ("תמונות וגלריית מדיה").
// Used when an agent is created from a site (the wizard's "סרוק את האתר") and by "עדכן מהאתר":
// the site's images are collected, Gemini looks at them and writes a name + one-line description
// for the ones worth showing a customer, and they become one topic in the media section. That topic
// is owned by this module: it is replaced on every refresh, the rest of the section is never touched.
import { Type } from "@google/genai";

// Every website topic starts with this (followed by the business name), so a refresh can find it
export const WEBSITE_IMAGES_TOPIC_PREFIX = "### נושא: תמונות מהאתר";

export interface SiteImage {
  url: string;
  alt?: string;
  context?: string;
}

export interface DescribedImage {
  url: string;
  name: string;
  description: string;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i;
// Icons, tracking pixels and the like are never content
const JUNK = /favicon|sprite|spacer|pixel|tracking|1x1|blank\.|placeholder|loader|spinner|emoji|\/flags?\/|facebook\.com\/tr|google-analytics|doubleclick|apple-touch-icon/i;

const MAX_CANDIDATES = 40;
const MAX_DESCRIBED = 14; // images sent to Gemini in one call
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIN_IMAGE_BYTES = 4 * 1024; // smaller is an icon

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m;
  while ((m = re.exec(tag)) !== null) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

// The largest candidate of a srcset ("a.jpg 480w, b.jpg 1080w" → b.jpg)
function largestFromSrcset(srcset: string): string {
  let best = "";
  let bestSize = -1;
  for (const part of srcset.split(/,\s+(?=\S)/)) {
    const [u, d] = part.trim().split(/\s+/);
    if (!u) continue;
    const size = d ? parseFloat(d) || 0 : 0;
    if (size >= bestSize) {
      best = u;
      bestSize = size;
    }
  }
  return best;
}

function textOf(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function resolve(u: string, base: string): string {
  const raw = u.trim().replace(/\\\//g, "/");
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
  try {
    const abs = new URL(raw.startsWith("//") ? `https:${raw}` : raw, base);
    return /^https?:$/.test(abs.protocol) ? abs.href : "";
  } catch {
    return "";
  }
}

// Same picture at another size or crop counts once (Wix and CDNs put the size in the path/query)
function dedupeKey(u: string): string {
  return u.replace(/\/v1\/(fill|fit|crop)\/.*$/i, "").replace(/[?#].*$/, "").replace(/-\d{2,4}x\d{2,4}(?=\.\w+$)/, "").toLowerCase();
}

// The image's own caption: its <figure>'s <figcaption> when it has one, else the text right after it
// (carousel captions usually follow the slide). Not the text before it — that's the previous slide's.
function textNextTo(page: string, start: number, end: number): string {
  const after = page.slice(end, end + 1500);
  const figEnd = after.search(/<\/figure>/i);
  const nextImg = after.search(/<(img|source)\b/i);
  const cap = after.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
  if (cap && cap.index !== undefined && (figEnd < 0 || cap.index < figEnd) && (nextImg < 0 || cap.index < nextImg)) {
    return textOf(cap[1]).slice(0, 240);
  }
  // A caption placed before the image inside the same <figure>
  const before = page.slice(Math.max(0, start - 1000), start);
  const figStart = before.search(/<figure\b[^>]*>(?![\s\S]*<figure\b)/i);
  if (figStart >= 0) {
    const capBefore = before.slice(figStart).match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
    if (capBefore) return textOf(capBefore[1]).slice(0, 240);
  }
  return textOf(after.slice(0, nextImg >= 0 ? Math.min(nextImg, 600) : 600)).slice(0, 240);
}

class Collector {
  list: SiteImage[] = [];
  private seen = new Set<string>();
  add(url: string, alt?: string, context?: string) {
    if (!url || this.list.length >= MAX_CANDIDATES) return;
    if (/\.(svg|ico)(\?|#|$)/i.test(url) || JUNK.test(url)) return;
    const key = dedupeKey(url);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.list.push({ url, alt: alt?.trim() || undefined, context: context?.trim() || undefined });
  }
}

// Images in a page's HTML, in page order (a carousel at the top comes first): <img> (src, lazy-load
// attributes, srcset), <picture><source>, CSS background-image, og:image and image URLs inside
// inline scripts / JSON (site builders like Wix keep the gallery there).
export function extractImageCandidates(html: string, baseUrl: string): SiteImage[] {
  const c = new Collector();
  const page = html.replace(/<!--[\s\S]*?-->/g, " ");

  const tagRe = /<(img|source)\b[^>]*>|style\s*=\s*("[^"]*"|'[^']*')|<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = tagRe.exec(page)) !== null) {
    if (m[1]) {
      const a = attrs(m[0]);
      const w = parseInt(a.width || "0", 10);
      const h = parseInt(a.height || "0", 10);
      if ((w && w < 60) || (h && h < 60)) continue;
      const src =
        a["data-src"] || a["data-lazy-src"] || a["data-original"] || a["data-lazy"] ||
        (a["data-srcset"] && largestFromSrcset(a["data-srcset"])) ||
        (a.srcset && largestFromSrcset(a.srcset)) ||
        a.src || "";
      const url = resolve(src, baseUrl);
      if (!url) continue;
      c.add(url, a.alt || a.title || a["aria-label"], textNextTo(page, m.index, m.index + m[0].length));
    } else {
      const css = m[2] || m[3] || "";
      const bgRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
      let b;
      while ((b = bgRe.exec(css)) !== null) {
        if (!IMAGE_EXT.test(b[1])) continue;
        const tagEnd = page.indexOf(">", m.index);
        const around = textOf(page.slice(tagEnd < 0 ? m.index : tagEnd + 1, m.index + 700)).slice(0, 240);
        c.add(resolve(b[1], baseUrl), undefined, around);
      }
    }
  }

  const og = page.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
  if (og) c.add(resolve(attrs(og[0]).content || "", baseUrl));

  // Absolute image URLs inside scripts / JSON blobs (escaped slashes included)
  const scripts = page.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const s of scripts) {
    const body = s.replace(/\\\//g, "/").replace(/\\u002F/gi, "/");
    const urlRe = /https?:\/\/[^"'\s\\)<>]+?\.(?:png|jpe?g|webp|gif|avif)(?:\?[^"'\s\\)<>]*)?/gi;
    let u;
    while ((u = urlRe.exec(body)) !== null) c.add(resolve(u[0], baseUrl));
  }
  return c.list;
}

// One list from several pages, in order, without repeats
export function mergeSiteImages(...lists: SiteImage[][]): SiteImage[] {
  const c = new Collector();
  lists.forEach((l) => l.forEach((i) => c.add(i.url, i.alt, i.context)));
  return c.list;
}

// Sites built as a JavaScript app (React/Vite and the like) have no images in their HTML: the
// carousel is in the script bundle. Read the page's own scripts and take the image paths from them.
export async function extractImagesFromScripts(
  html: string,
  baseUrl: string,
  fetchText: (url: string, timeoutMs: number) => Promise<string>,
  existing: SiteImage[] = []
): Promise<SiteImage[]> {
  const c = new Collector();
  existing.forEach((i) => c.add(i.url, i.alt, i.context));
  let origin = "";
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return c.list;
  }
  const scriptUrls = (html.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>/gi) || [])
    .map((t) => resolve(attrs(t).src || "", baseUrl))
    .filter((u) => u && u.startsWith(origin))
    .slice(0, 3);
  const bodies = await Promise.all(scriptUrls.map((u) => fetchText(u, 8000)));
  bodies.forEach((body, i) => {
    if (!body || body.length > 6 * 1024 * 1024) return;
    const re = /["'`]((?:https?:)?\/{0,2}[^"'`\s()<>{}]*?\.(?:png|jpe?g|webp|gif|avif))["'`]/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      const p = m[1];
      // Relative paths in a bundle are relative to the site root (Vite's /assets/…) or to the script
      const url = p.startsWith("/") || /^https?:/i.test(p) ? resolve(p, origin + "/") : resolve(p, scriptUrls[i]);
      c.add(url);
    }
  });
  return c.list;
}

async function downloadImage(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    if (!r.ok) return null;
    const mimeType = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(mimeType)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < MIN_IMAGE_BYTES || buf.length > MAX_IMAGE_BYTES) return null;
    return { mimeType: mimeType === "image/jpg" ? "image/jpeg" : mimeType, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

const oneLine = (s: string) => String(s || "").replace(/\s+/g, " ").replace(/\|/g, "/").trim();

// Gemini looks at the images and keeps those worth showing a customer, with a Hebrew name and
// a one-line description. Without AI, only images that have alt text are kept, described by it.
export async function describeSiteImages(
  ai: any,
  generate: (ai: any, params: any) => Promise<any>,
  candidates: SiteImage[],
  siteText: string,
  businessName: string,
  // Gemini looking at the images is the slow part: past this, only the site's own captions are used
  timeoutMs = 25000
): Promise<DescribedImage[]> {
  const downloaded = await Promise.all(candidates.slice(0, MAX_DESCRIBED * 2).map(async (c) => ({ c, img: await downloadImage(c.url) })));
  const usable = downloaded.filter((d) => d.img).slice(0, MAX_DESCRIBED);
  if (!usable.length) return [];

  // Without AI: images the site itself named (alt text), described by their caption when they have one
  const byAlt = () =>
    usable
      .filter((d) => d.c.alt && !/logo/i.test(d.c.url))
      .map((d) => {
        const name = oneLine(d.c.alt!).slice(0, 60);
        const caption = oneLine(d.c.context || "").replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[—–-]?\\s*`), "");
        return { url: d.c.url, name, description: caption || name };
      });
  if (!ai) return byAlt();

  const parts: any[] = [
    {
      text:
        `אלה תמונות מהאתר של העסק "${businessName || "העסק"}". בוט שירות ומכירות ב-WhatsApp ישלח אותן ללקוחות כשהן רלוונטיות לשאלה.\n` +
        "לכל תמונה: החלט אם להשאיר אותה (keep) — השאר תמונות שמראות את המוצר/המערכת (צילומי מסך, מסכים, דשבורדים), השירותים, העבודות, המקום או הצוות. " +
        "השמט לוגואים, אייקונים, רקעים דקורטיביים, תמונות כלליות בלי תוכן, ותמונות כפולות.\n" +
        "לתמונות שנשארות כתוב בעברית: name — שם קצר (2-4 מילים, למשל \"דשבורד\"), description — שורה אחת שמתארת מה רואים בתמונה ומתי כדאי לשלוח אותה. " +
        "כשלתמונה יש באתר כיתוב או טקסט חלופי — השם והתיאור מבוססים עליהם (זה מה שבעל העסק כתב), ומה שרואים בתמונה רק משלים. אל תמציא פרטים שלא נראים בתמונה או כתובים באתר.\n\n" +
        `טקסט מהאתר (להקשר):\n${siteText.slice(0, 4000)}`,
    },
  ];
  usable.forEach((d, i) => {
    parts.push({ text: `תמונה ${i}${d.c.alt ? ` — טקסט חלופי: ${d.c.alt}` : ""}${d.c.context ? ` — כיתוב/טקסט ליד התמונה: ${d.c.context}` : ""}` });
    parts.push({ inlineData: d.img });
  });

  try {
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs}ms`)), timeoutMs);
    });
    const response = await Promise.race([timeout, generate(ai, {
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            images: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  keep: { type: Type.BOOLEAN },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["index", "keep"],
              },
            },
          },
          required: ["images"],
        },
      },
    })]).finally(() => clearTimeout(timer));
    const parsed = JSON.parse(String(response?.text || "{}").trim());
    const out: DescribedImage[] = [];
    const used = new Set<number>();
    for (const r of Array.isArray(parsed.images) ? parsed.images : []) {
      const i = Number(r?.index);
      if (!r?.keep || !Number.isInteger(i) || !usable[i] || used.has(i)) continue;
      used.add(i);
      const name = oneLine(r.name || usable[i].c.alt || `תמונה ${out.length + 1}`).replace(/^[-\d.\s]+/, "").slice(0, 60);
      out.push({ url: usable[i].c.url, name: name || `תמונה ${out.length + 1}`, description: oneLine(r.description || usable[i].c.alt || "") });
    }
    // keep the site's order (the carousel's order)
    return out.sort((a, b) => usable.findIndex((d) => d.c.url === a.url) - usable.findIndex((d) => d.c.url === b.url));
  } catch (err: any) {
    console.warn("[site-images] describing the images failed, using alt text only:", err?.message || err);
    return byAlt();
  }
}

// The images as one topic in the media section's format (see FirebaseMediaUploader's parser)
export function websiteImagesTopic(images: DescribedImage[], siteUrl: string, businessName: string): string {
  if (!images.length) return "";
  const lines = [
    `${WEBSITE_IMAGES_TOPIC_PREFIX} — ${oneLine(businessName) || new URL(siteUrl).hostname}`,
    `- תיאור: תמונות מהאתר ${siteUrl} (נאספו אוטומטית, מתעדכנות בלחיצה על "עדכן מהאתר").`,
    "- הנחיות: כשלקוח שואל על העסק, על המערכת/המוצר/השירותים או על יכולת מסוימת, או מבקש לראות איך זה נראה — ענה על השאלה ובסוף התשובה צרף עד 3 תמונות רלוונטיות מהרשימה הזו בלבד (שלח את קישור התמונה כמו שהוא, כל קישור בשורה נפרדת). בחר לפי התיאור של כל תמונה את מה שקשור לשאלה. אל תמציא תמונות או קישורים שלא מופיעים כאן.",
    "- דגמים זמינים:",
  ];
  images.forEach((img, i) => {
    lines.push(`  ${i + 1}. ${img.name}`);
    if (img.description) lines.push(`     - תיאור: ${img.description}`);
    lines.push(`     - תמונה: ${img.url}`);
  });
  return lines.join("\n");
}

// Replaces the previous website topic (its header up to the next markdown header) with the new one,
// in the same place; a first topic goes at the end. An empty topic removes the old one.
export function withWebsiteImagesTopic(text: string, topic: string): string {
  const lines = String(text || "").split("\n");
  const out: string[] = [];
  let skipping = false;
  let insertAt = -1;
  for (const line of lines) {
    if (line.trim().startsWith(WEBSITE_IMAGES_TOPIC_PREFIX)) {
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

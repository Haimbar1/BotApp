import type { GoogleGenAI } from "@google/genai";

// WhatsApp (Meta Cloud API) for the bot engine (botEngine.ts) — the bot answering WhatsApp here
// instead of n8n (Haim, 2026-10-23). Reading Meta's webhook payload, downloading and transcribing
// voice notes, and turning the bot's answer into WhatsApp messages — the same shapes n8n's
// formatter sent (text, a list for the options, each image as its own message).

// META_GRAPH_URL: local tests only (a mock instead of Meta)
const GRAPH = (process.env.META_GRAPH_URL || "https://graph.facebook.com/v19.0").replace(/\/$/, "");

export interface IncomingWa {
  phoneNumberId: string;
  displayPhone: string;
  from: string; // the customer's number, as Meta gives it (972…)
  name: string;
  id: string; // Meta's message id
  type: string;
  text: string; // what the customer said (a button / list choice: its title)
  buttonId?: string;
  mediaId?: string; // audio / image
  mimeType?: string;
  // the message object inside the payload, so a transcript can be written back into it
  raw: any;
}

// The Meta payload, raw or inside a relay's { body: … } envelope
export const metaPayload = (body: any) => (body?.object === "whatsapp_business_account" ? body : body?.body?.object ? body.body : body);

// The business number a payload is addressed to (its first change)
export function payloadNumber(payload: any): { phoneNumberId: string; displayPhone: string } {
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const m = change?.value?.metadata;
      if (m?.phone_number_id) return { phoneNumberId: String(m.phone_number_id), displayPhone: String(m.display_phone_number || "") };
    }
  }
  return { phoneNumberId: "", displayPhone: "" };
}

// The customers' messages in a payload (statuses — sent / delivered / read — are not messages)
export function incomingMessages(payload: any): IncomingWa[] {
  const out: IncomingWa[] = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const v = change?.value;
      if (!v?.messages) continue;
      for (const m of v.messages) {
        const contact = (v.contacts || []).find((c: any) => c?.wa_id === m.from) || v.contacts?.[0];
        const base = {
          phoneNumberId: String(v.metadata?.phone_number_id || ""),
          displayPhone: String(v.metadata?.display_phone_number || ""),
          from: String(m.from || ""),
          name: String(contact?.profile?.name || ""),
          id: String(m.id || ""),
          type: String(m.type || ""),
          raw: m,
        };
        let text = "";
        let buttonId: string | undefined;
        let mediaId: string | undefined;
        let mimeType: string | undefined;
        switch (m.type) {
          case "text":
            text = String(m.text?.body || "");
            break;
          case "interactive":
            text = String(m.interactive?.list_reply?.title || m.interactive?.button_reply?.title || "");
            buttonId = m.interactive?.list_reply?.id || m.interactive?.button_reply?.id || undefined;
            break;
          case "button": // a template's quick-reply button
            text = String(m.button?.text || "");
            buttonId = m.button?.payload || undefined;
            break;
          case "audio":
          case "voice":
            mediaId = m.audio?.id || m.voice?.id;
            mimeType = m.audio?.mime_type || m.voice?.mime_type;
            break;
          case "image":
            text = m.image?.caption ? `[שלח/ה תמונה] ${m.image.caption}` : "[שלח/ה תמונה]";
            break;
          case "video":
            text = m.video?.caption ? `[שלח/ה וידאו] ${m.video.caption}` : "[שלח/ה וידאו]";
            break;
          case "document":
            text = `[שלח/ה מסמך${m.document?.filename ? `: ${m.document.filename}` : ""}]`;
            break;
          case "location":
            text = `[שלח/ה מיקום${m.location?.name ? `: ${m.location.name}` : ""}]`;
            break;
          case "contacts":
            text = "[שלח/ה איש קשר]";
            break;
        }
        out.push({ ...base, text, buttonId, mediaId, mimeType });
      }
    }
  }
  return out;
}

// Messages the bot doesn't answer: an emoji reaction, a sticker, or something WhatsApp couldn't deliver
export const needsNoAnswer = (m: IncomingWa) => ["reaction", "sticker", "unsupported", "system", "ephemeral"].includes(m.type);

// ---------- voice notes ----------

async function downloadMedia(mediaId: string, token: string): Promise<{ data: Buffer; mimeType: string }> {
  const meta = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
  const info: any = await meta.json().catch(() => ({}));
  if (!meta.ok || !info?.url) throw new Error(info?.error?.message || `media ${meta.status}`);
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  if (!file.ok) throw new Error(`media download ${file.status}`);
  return { data: Buffer.from(await file.arrayBuffer()), mimeType: String(info.mime_type || "audio/ogg").split(";")[0] };
}

// A voice note → its text (Hebrew, word for word). "" when it can't be heard / transcribed.
export async function transcribeVoice(ai: GoogleGenAI, mediaId: string, token: string): Promise<string> {
  const { data, mimeType } = await downloadMedia(mediaId, token);
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let last: any = null;
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: data.toString("base64") } },
              { text: "תמלל את ההודעה הקולית מילה במילה, בשפה שבה דיברו (בדרך כלל עברית). החזר רק את הטקסט שנאמר, בלי הסברים. אם לא שומעים דיבור — החזר מחרוזת ריקה." },
            ],
          },
        ],
        config: { temperature: 0 },
      });
      return String(res.text || "").trim().replace(/^["“]|["”]$/g, "");
    } catch (e: any) {
      last = e;
      console.warn(`[WA] transcription with ${model} failed:`, e?.message || e);
    }
  }
  throw last || new Error("transcription failed");
}

// ---------- the bot's answer → WhatsApp messages ----------

// WhatsApp's limits: a list row title 24 chars, a list's button 20, an interactive body 1024, 10 rows
export function answerToWhatsApp(to: string, answer: { reply: string; options: string[]; images: string[] }, listTitle = "תפריט אפשרויות"): { payload: any; text: string }[] {
  const out: { payload: any; text: string }[] = [];
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  for (const link of answer.images) out.push({ payload: { ...base, type: "image", image: { link } }, text: "[תמונה]" });
  const reply = answer.reply.replace(/\*\*/g, "*").trim();
  const rows = answer.options
    .map((o, i) => ({ id: `opt_${i + 1}`, title: o.trim().slice(0, 24) }))
    .filter((r) => r.title)
    .slice(0, 10);
  if (!rows.length) {
    if (reply) out.push({ payload: { ...base, type: "text", text: { body: reply.slice(0, 4096) } }, text: reply });
    return out;
  }
  // a long answer goes as its own message, and the list follows with a short line
  let body = reply;
  if (body.length > 1024) {
    out.push({ payload: { ...base, type: "text", text: { body: reply.slice(0, 4096) } }, text: reply });
    body = "אפשר לבחור מהאפשרויות:";
  }
  out.push({
    payload: {
      ...base,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: body || "אפשר לבחור מהאפשרויות:" },
        action: { button: listTitle.slice(0, 20), sections: [{ title: "בחר אפשרות", rows }] },
      },
    },
    text: [body, ...rows.map((r) => `• ${r.title}`)].join("\n"),
  });
  return out;
}

export async function sendWhatsApp(phoneNumberId: string, token: string, payload: any): Promise<string | undefined> {
  const r = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) throw new Error(data?.error?.message || `Meta ${r.status}`);
  return data?.messages?.[0]?.id;
}

// The blue ticks + "typing…" while the bot works on the answer (Meta shows it up to 25s or until
// the answer is sent). Without typing-indicator support, just the blue ticks.
export async function markRead(phoneNumberId: string, token: string, messageId: string): Promise<void> {
  const send = (typing: boolean) =>
    fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId, ...(typing ? { typing_indicator: { type: "text" } } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
  try {
    const r = await send(true);
    if (!r.ok) await send(false);
  } catch {
    /* only cosmetic */
  }
}

// The business's Facebook Page for the bot engine (botEngine.ts) — comments on its posts / ads and
// Messenger chats answered here instead of n8n (Haim, 2026-11-02). Reading Meta's "page" webhook
// payload (the same events n8n's "Normalize all sources" took), and sending the bot's answer: a reply
// in the comment itself (no buttons there), or a Messenger message with the options as quick replies.

// META_GRAPH_URL: local tests only (a mock instead of Meta)
const GRAPH = (process.env.META_GRAPH_URL || "https://graph.facebook.com/v19.0").replace(/\/$/, "");

export interface IncomingFb {
  kind: "comment" | "messenger";
  pageId: string;
  id: string; // the comment id / Messenger message id (each is answered once)
  senderId: string; // the commenter / the Messenger user (PSID)
  name: string;
  text: string;
  postId?: string; // comment: the post / ad it's on
  quickReply?: string; // messenger: the option the customer pressed (its full text)
  ad?: { headline?: string; body?: string; sourceUrl?: string; sourceType?: string }; // messenger: came from an ad
}

// The Meta payload, raw or inside a relay's { body: … } envelope
export const pagePayload = (body: any) => (body?.object ? body : body?.body?.object ? body.body : body);

// What a comment / message carries besides text, as the bot reads it
const attachmentText = (type: string) =>
  ({ image: "[שלח/ה תמונה]", photo: "[שלח/ה תמונה]", sticker: "[סטיקר]", audio: "[הודעה קולית]", video: "[סרטון]", file: "[קובץ]" } as Record<string, string>)[type] || `[${type}]`;

// The customers' comments and Messenger messages in a payload. Left out: the Page's own comments and
// messages (its replies — answering them would loop), edits, deletions, likes, read receipts.
export function incomingFacebook(payload: any): IncomingFb[] {
  const out: IncomingFb[] = [];
  if (payload?.object !== "page") return out;
  for (const entry of payload?.entry || []) {
    const pageId = String(entry?.id || "");
    for (const ch of entry?.changes || []) {
      const v = ch?.value || {};
      if (ch?.field !== "feed" || v.item !== "comment" || v.verb !== "add") continue;
      if (!v.comment_id || String(v.from?.id || "") === pageId) continue;
      const text = String(v.message || "").trim() || (v.photo ? attachmentText("photo") : v.video ? attachmentText("video") : "[תגובה בלי טקסט]");
      out.push({ kind: "comment", pageId, id: String(v.comment_id), senderId: String(v.from?.id || ""), name: String(v.from?.name || ""), text, postId: String(v.post_id || "") });
    }
    for (const ev of entry?.messaging || []) {
      const senderId = String(ev?.sender?.id || "");
      if (!senderId || senderId === pageId) continue;
      const m = ev?.message;
      const referral = ev?.referral || m?.referral;
      const ad = referral?.source === "ADS" || referral?.ads_context_data
        ? { headline: referral?.ads_context_data?.ad_title || "", sourceType: "ad", sourceUrl: referral?.ads_context_data?.photo_url || "" }
        : undefined;
      if (m && !m.is_echo && !m.is_deleted) {
        const quickReply = m.quick_reply?.payload ? String(m.quick_reply.payload) : undefined;
        const text = String(quickReply || m.text || "").trim() || (m.attachments?.length ? attachmentText(String(m.attachments[0]?.type || "file")) : "");
        if (text) out.push({ kind: "messenger", pageId, id: String(m.mid || `${senderId}_${ev.timestamp}`), senderId, name: "", text, quickReply, ad });
      } else if (ev?.postback) {
        // "Get started" / a persistent-menu button: its title is what the customer chose
        const text = String(ev.postback.title || ev.postback.payload || "").trim();
        if (text) out.push({ kind: "messenger", pageId, id: String(ev.postback.mid || `pb_${senderId}_${ev.timestamp}`), senderId, name: "", text, ad });
      }
    }
  }
  return out;
}

async function graph(path: string, token: string, init: { method?: string; body?: any } = {}): Promise<any> {
  const r = await fetch(`${GRAPH}/${path}`, {
    method: init.method || "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data: any = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) throw new Error(data?.error?.message || `Meta ${r.status}`);
  return data;
}

// The text of the post / ad a comment is on (the bot answers "כמה זה עולה?" about it) and its link
// (WhastAppSystem's comments screen links to it). Empty when Meta won't say.
export async function postInfo(postId: string, token: string): Promise<{ text: string; link: string }> {
  if (!postId) return { text: "", link: "" };
  try {
    const d = await graph(`${encodeURIComponent(postId)}?fields=message,permalink_url`, token);
    return { text: String(d?.message || ""), link: String(d?.permalink_url || "") };
  } catch {
    return { text: "", link: "" };
  }
}

// A Messenger user's name (Meta doesn't send it with the message)
export async function messengerName(psid: string, token: string): Promise<string> {
  try {
    const d = await graph(`${encodeURIComponent(psid)}?fields=first_name,last_name`, token);
    return [d?.first_name, d?.last_name].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

// The vault's FB_PAGE_ACCESS_TOKEN may be the system user's token (the same as WhatsApp's) and not the
// Page's own; replying to comments and Messenger needs the Page's. Asked for once a day per token;
// when Meta won't give one, the token itself (already a Page token).
const pageTokens = new Map<string, { at: number; token: string }>();
export async function pageAccessToken(pageId: string, token: string): Promise<string> {
  const key = `${pageId}|${token}`;
  const hit = pageTokens.get(key);
  if (hit && Date.now() - hit.at < 86400000) return hit.token;
  let pageToken = token;
  try {
    const d = await graph(`${encodeURIComponent(pageId)}?fields=access_token`, token);
    if (d?.access_token) pageToken = String(d.access_token);
  } catch {
    /* use the token as it is */
  }
  pageTokens.set(key, { at: Date.now(), token: pageToken });
  return pageToken;
}

// The Page's name for its id — a check that the token works, for the bot's Facebook card
export async function pageName(pageId: string, token: string): Promise<string> {
  const d = await graph(`${encodeURIComponent(pageId)}?fields=name`, token);
  return String(d?.name || "");
}

// The bot's answer as a reply in the comment's thread. Returns the new comment's id.
export async function replyToComment(commentId: string, token: string, text: string): Promise<string | undefined> {
  const d = await graph(`${encodeURIComponent(commentId)}/comments`, token, { method: "POST", body: { message: text.slice(0, 8000) } });
  return d?.id;
}

// "Seen" + "typing…" in Messenger while the bot works (Meta drops it after 20s or on the answer)
export async function messengerTyping(pageId: string, psid: string, token: string): Promise<void> {
  try {
    await graph(`${encodeURIComponent(pageId)}/messages`, token, { method: "POST", body: { recipient: { id: psid }, sender_action: "mark_seen" } });
    await graph(`${encodeURIComponent(pageId)}/messages`, token, { method: "POST", body: { recipient: { id: psid }, sender_action: "typing_on" } });
  } catch {
    /* only cosmetic */
  }
}

// Messenger's limits: a text 2000 chars, 13 quick replies, a quick reply's title 20 chars. The full
// option goes as the payload, so a cut title still reaches the bot whole.
export function answerToMessenger(psid: string, answer: { reply: string; options: string[]; images: string[] }): { body: any; text: string }[] {
  const out: { body: any; text: string }[] = [];
  const recipient = { id: psid };
  for (const url of answer.images) {
    out.push({ body: { recipient, messaging_type: "RESPONSE", message: { attachment: { type: "image", payload: { url, is_reusable: true } } } }, text: "[תמונה]" });
  }
  const options = answer.options.map((o) => o.trim()).filter(Boolean).slice(0, 13);
  // by characters, so an emoji is never cut in half
  const short = (o: string) => (Array.from(o).length > 20 ? `${Array.from(o).slice(0, 19).join("")}…` : o);
  const quick_replies = options.map((o) => ({ content_type: "text", title: short(o), payload: o.slice(0, 1000) }));
  const reply = answer.reply.trim() || (options.length ? "אפשר לבחור:" : "");
  if (!reply) return out;
  // a long answer goes in pieces; the options go with the last one
  const pieces: string[] = [];
  for (let rest = reply; rest; ) {
    if (rest.length <= 2000) {
      pieces.push(rest);
      break;
    }
    const cut = Math.max(rest.lastIndexOf("\n", 2000), 1000);
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  pieces.forEach((text, i) => {
    const last = i === pieces.length - 1;
    out.push({
      body: { recipient, messaging_type: "RESPONSE", message: { text, ...(last && quick_replies.length ? { quick_replies } : {}) } },
      text: last && options.length ? [text, ...options.map((o) => `• ${o}`)].join("\n") : text,
    });
  });
  return out;
}

export async function sendMessenger(pageId: string, token: string, body: any): Promise<string | undefined> {
  const d = await graph(`${encodeURIComponent(pageId)}/messages`, token, { method: "POST", body });
  return d?.message_id;
}

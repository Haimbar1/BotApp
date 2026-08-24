import { MessageSourceType, MessageSourceInfo } from "../types";

/**
 * Detects the origin channel/source of a message or session.
 * Supports WhatsApp, Web, and Facebook Post / Comments with recognizable emojis and styled badges.
 */
export function getMessageSourceInfo(text: string = "", rawObj?: any): MessageSourceInfo {
  let rawSource = "";

  if (rawObj?.source) rawSource = String(rawObj.source);
  else if (rawObj?.channel) rawSource = String(rawObj.channel);
  else if (rawObj?.platform) rawSource = String(rawObj.platform);
  else if (rawObj?.sourceType) rawSource = String(rawObj.sourceType);
  else if (rawObj?.source_type) rawSource = String(rawObj.source_type);

  if (!rawSource && (rawObj?.sessionId || rawObj?.session_id)) {
    const sid = String(rawObj.sessionId || rawObj.session_id).toLowerCase();
    if (sid.startsWith("web_") || sid.startsWith("web-") || sid.includes("widget") || sid.includes("website") || sid.includes("אתר") || sid.includes("ווב")) {
      rawSource = "web";
    } else if (sid.startsWith("fb_") || sid.startsWith("fb-") || sid.includes("facebook") || sid.includes("fb_comment") || sid.includes("תגובות") || sid.includes("פייסבוק")) {
      rawSource = "facebook";
    }
  }

  if (!rawSource && typeof text === "string") {
    const match = text.match(/(?:^|\n)[ \t]*(?:SOURCE|Source|source|מקור|CHANNEL|channel|PLATFORM|platform)[\s:\-=]+([A-Za-z0-9_ \u0590-\u05FF]+)/i);
    if (match) {
      rawSource = match[1].trim();
    }
  }

  const s = rawSource.toLowerCase().trim();

  // Facebook Post / Comments detection
  if (
    s === "fb" ||
    s.startsWith("fb_") ||
    s.startsWith("fb-") ||
    s.includes("facebook") ||
    s.includes("פייסבוק") ||
    s.includes("post") ||
    s.includes("פוסט") ||
    s.includes("comment") ||
    s.includes("תגוב")
  ) {
    return {
      type: "facebook",
      label: "תגובות FB",
      icon: "📘",
      badgeClass: "bg-blue-600/15 text-blue-400 border-blue-500/30"
    };
  }

  // Web detection
  if (
    s === "web" ||
    s.startsWith("web_") ||
    s.startsWith("web-") ||
    s.includes("website") ||
    s.includes("אתר") ||
    s.includes("ווב") ||
    s.includes("site") ||
    s.includes("landing") ||
    s.includes("widget")
  ) {
    return {
      type: "web",
      label: "WEB",
      icon: "🌐",
      badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30"
    };
  }

  // WhatsApp detection (default for WH, whatsapp, phone sessions, wa_id, etc.)
  return {
    type: "whatsapp",
    label: "וואטסאפ",
    icon: "💬",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
  };
}

/**
 * Resolves the channel / source info for an entire session object.
 */
export function getSessionSourceInfo(session: any): MessageSourceInfo {
  if (!session) {
    return getMessageSourceInfo("", null);
  }

  // 1. Direct field on session
  if (session.source || session.channel || session.platform || session.sourceType || session.source_type) {
    return getMessageSourceInfo("", session);
  }

  // 2. Inspect session messages from latest to oldest
  if (Array.isArray(session.messages) && session.messages.length > 0) {
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const msg = session.messages[i];
      const text = msg.message?.content || msg.content || "";
      const info = getMessageSourceInfo(text, msg);
      if (info.type === "facebook" || info.type === "web") {
        return info;
      }
    }
  }

  // 3. Inspect lastHumanMessage or lastMessage
  const lastTarget = session.lastHumanMessage || session.lastMessage;
  if (lastTarget) {
    const text = lastTarget.message?.content || lastTarget.content || "";
    const info = getMessageSourceInfo(text, { ...session, ...lastTarget });
    if (info.type === "facebook" || info.type === "web") {
      return info;
    }
  }

  // 4. Inspect sessionId format
  const sId = String(session.sessionId || session.id || "").toLowerCase();
  if (sId.startsWith("web_") || sId.startsWith("web-") || sId.includes("widget") || sId.includes("אתר") || sId.includes("ווב")) {
    return {
      type: "web",
      label: "WEB",
      icon: "🌐",
      badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30"
    };
  }

  if (sId.startsWith("fb_") || sId.startsWith("fb-") || sId.includes("facebook") || sId.includes("post") || sId.includes("פייסבוק") || sId.includes("תגוב")) {
    return {
      type: "facebook",
      label: "תגובות FB",
      icon: "📘",
      badgeClass: "bg-blue-600/15 text-blue-400 border-blue-500/30"
    };
  }

  // Default to WhatsApp
  return {
    type: "whatsapp",
    label: "וואטסאפ",
    icon: "💬",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
  };
}

/**
 * Strips raw SOURCE:WH / SOURCE:... header or inline tag lines from human messages
 */
export function cleanSourceFromText(text: string): string {
  if (!text) return "";
  return text
    .replace(/(?:^|\n)[ \t]*(?:SOURCE|Source|source|מקור|CHANNEL|channel|PLATFORM|platform)[\s:\-=]+[^\n]+/gi, "")
    .trim();
}

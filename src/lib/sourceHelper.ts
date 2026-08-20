import { MessageSourceType, MessageSourceInfo } from "../types";

/**
 * Detects the origin channel/source of a message or session.
 * Supports WhatsApp, Web, and Facebook Post with recognizable emojis and styled badges.
 */
export function getMessageSourceInfo(text: string = "", rawObj?: any): MessageSourceInfo {
  let rawSource = "";

  if (rawObj?.source) rawSource = String(rawObj.source);
  else if (rawObj?.channel) rawSource = String(rawObj.channel);
  else if (rawObj?.platform) rawSource = String(rawObj.platform);
  else if (rawObj?.sourceType) rawSource = String(rawObj.sourceType);
  else if (rawObj?.source_type) rawSource = String(rawObj.source_type);

  if (!rawSource && typeof text === "string") {
    const match = text.match(/(?:^|\n)[ \t]*(?:SOURCE|Source|source|מקור|CHANNEL|channel|PLATFORM|platform)[\s:\-=]+([A-Za-z0-9_ \u0590-\u05FF]+)/i);
    if (match) {
      rawSource = match[1].trim();
    }
  }

  const s = rawSource.toLowerCase().trim();

  // Facebook Post detection
  if (
    s === "fb" ||
    s.startsWith("fb_") ||
    s.startsWith("fb-") ||
    s.includes("facebook") ||
    s.includes("פייסבוק") ||
    s.includes("post") ||
    s.includes("פוסט")
  ) {
    return {
      type: "facebook",
      label: "Facebook Post",
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
      label: "Web",
      icon: "🌐",
      badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30"
    };
  }

  // WhatsApp detection (default for WH, whatsapp, phone sessions, wa_id, etc.)
  return {
    type: "whatsapp",
    label: "WhatsApp",
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

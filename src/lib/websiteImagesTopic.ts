// The media section's website-images topic (see siteImages.ts): its header, and replacing it in a
// media section. Shared by the server and the agent wizard.

// Every website topic starts with this (followed by the business name), so a refresh can find it
export const WEBSITE_IMAGES_TOPIC_PREFIX = "### נושא: תמונות מהאתר";

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

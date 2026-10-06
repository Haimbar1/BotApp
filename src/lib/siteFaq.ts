// The FAQ of a business's website, so the bot's FAQ block ("שאלות פופולריות") always carries every
// question the site answers. Read from the site's schema.org FAQPage (JSON-LD), which most sites
// with an FAQ publish for Google; used by the server's scan and by the agent wizard.

export interface SiteFaq {
  q: string;
  a: string;
}

const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// Questions and answers from every FAQPage in the page's JSON-LD (also inside @graph / arrays)
export function extractJsonLdFaq(html: string): SiteFaq[] {
  const out: SiteFaq[] = [];
  const seen = new Set<string>();
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const types = ([] as any[]).concat(node["@type"] || []);
    if (types.includes("Question")) {
      const q = clean(node.name);
      const answer = Array.isArray(node.acceptedAnswer) ? node.acceptedAnswer[0] : node.acceptedAnswer;
      const a = clean(answer?.text);
      if (q && a && !seen.has(q)) {
        seen.add(q);
        out.push({ q, a });
      }
      return;
    }
    Object.values(node).forEach(visit);
  };
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {
      // a broken JSON-LD block is skipped
    }
  }
  return out;
}

// Letters and digits only, so punctuation / spacing / "ש:" prefixes don't hide a match
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// The site's questions that the FAQ block doesn't have yet
export function faqMissingFrom(block: string, faqs: SiteFaq[]): SiteFaq[] {
  const have = norm(block || "");
  return faqs.filter((f) => {
    const q = norm(f.q);
    return q && !have.includes(q.slice(0, Math.min(q.length, 40)));
  });
}

export function faqAsText(faqs: SiteFaq[]): string {
  return faqs.map((f) => `ש: ${f.q}\nת: ${f.a}`).join("\n\n");
}

// The block with the site's missing questions added at the end (the rest is kept as is)
export function withSiteFaq(block: string, faqs: SiteFaq[]): string {
  const missing = faqMissingFrom(block, faqs);
  if (!missing.length) return block || "";
  const base = String(block || "").replace(/\s+$/, "");
  const added = `שאלות נפוצות מהאתר:\n${faqAsText(missing)}`;
  return base ? `${base}\n\n${added}` : added;
}

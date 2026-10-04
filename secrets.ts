import jwt from "jsonwebtoken";

// Each business's keys / identifiers / secrets live encrypted in the portal's vault
// (portal.smartesek.com → "מזהים וחיבורים"), entered by the business in onboarding. This reads
// BotApp's share of them for one business (portal tenant id), server-to-server, signed with
// SSO_SHARED_SECRET. A key the business hasn't entered falls back to the environment variable of
// the same name — only for keys SmartEsek provides to everyone (Gemini).

const PORTAL_URL = process.env.PORTAL_URL || "https://portal.smartesek.com";
const SHARED_FALLBACK_KEYS = new Set(["GEMINI_API_KEY"]);
const CACHE_MS = 5 * 60 * 1000;

const cache = new Map<string, { at: number; secrets: Record<string, string> }>();

export async function vaultSecrets(tenant: string | number | undefined | null): Promise<Record<string, string>> {
  const portalId = Number(tenant);
  if (!portalId) return {};
  const key = String(portalId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.secrets;
  const sharedSecret = process.env.SSO_SHARED_SECRET;
  if (!sharedSecret) return {};
  try {
    const token = jwt.sign({ typ: "secrets", tenantId: portalId, module: "botapp" }, sharedSecret, { expiresIn: "30s" });
    const res = await fetch(`${PORTAL_URL}/api/sso/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`portal ${res.status}`);
    const data: any = await res.json();
    const secrets: Record<string, string> = data?.secrets && typeof data.secrets === "object" ? data.secrets : {};
    cache.set(key, { at: Date.now(), secrets });
    return secrets;
  } catch (err: any) {
    console.warn("[secrets] reading the portal vault failed:", err?.message);
    return hit?.secrets || {}; // keep the last good copy
  }
}

// One key for a business: the vault first, then SmartEsek's env key for shared keys. '' = not set.
export async function tenantSecret(key: string, tenant: string | number | undefined | null): Promise<string> {
  const fromVault = (await vaultSecrets(tenant))[key];
  if (fromVault) return fromVault;
  return SHARED_FALLBACK_KEYS.has(key) ? process.env[key] || "" : "";
}

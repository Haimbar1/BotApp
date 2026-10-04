import jwt from "jsonwebtoken";

// Each business's keys / identifiers / secrets live encrypted in the portal's vault
// (portal.smartesek.com → "מזהים וחיבורים"), entered by the business in onboarding. This reads
// BotApp's share of them for one business (portal tenant id), server-to-server, signed with
// SSO_SHARED_SECRET. A key the business hasn't entered falls back to the environment variable of
// the same name — only for keys SmartEsek provides to everyone (Gemini). The WhatsApp (Meta)
// connection fields are shared with the WhatsApp system (same vault keys).

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

// The original business (portal tenant 1, the optics) keeps running on Vercel first.
export const ORIGINAL_TENANT = "1";

// One key for a business: the optics reads Vercel (env) first; then the vault; then SmartEsek's
// env key for shared keys. '' = not set.
export async function tenantSecret(key: string, tenant: string | number | undefined | null): Promise<string> {
  if (String(tenant ?? "") === ORIGINAL_TENANT && process.env[key]) return process.env[key] as string;
  const fromVault = (await vaultSecrets(tenant))[key];
  if (fromVault) return fromVault;
  return SHARED_FALLBACK_KEYS.has(key) ? process.env[key] || "" : "";
}

// What BotApp's own WhatsApp settings save is written to the vault too, so the portal and the
// other apps show the same value. Best effort; empty values are skipped (never deletes).
export async function saveToVault(tenant: string | number | undefined | null, values: Record<string, string | undefined | null>, by?: string): Promise<void> {
  const portalId = Number(tenant);
  const sharedSecret = process.env.SSO_SHARED_SECRET;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  if (!portalId || !sharedSecret || Object.keys(clean).length === 0) return;
  try {
    const token = jwt.sign({ typ: "secrets-write", tenantId: portalId, module: "botapp", values: clean, by }, sharedSecret, { expiresIn: "30s" });
    const res = await fetch(`${PORTAL_URL}/api/sso/secrets/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`portal ${res.status}`);
    cache.delete(String(portalId));
  } catch (err: any) {
    console.warn("[secrets] writing to the portal vault failed:", err?.message);
  }
}

// An agent's WhatsApp (Meta) connection. For another business's agent the vault's values win —
// one value per thing across the apps; the optics' agents keep their own stored settings.
export async function effectiveWhatsappConfig(agent: any): Promise<any> {
  const config = { ...(agent?.whatsappConfig || {}) };
  const tenant = agent?.tenantId != null ? String(agent.tenantId) : "";
  if (!tenant || tenant === ORIGINAL_TENANT) return config;
  const v = await vaultSecrets(tenant);
  if (v.META_PHONE_NUMBER_ID) config.phoneNumberId = v.META_PHONE_NUMBER_ID;
  if (v.META_WA_ACCESS_TOKEN) config.systemUserAccessToken = v.META_WA_ACCESS_TOKEN;
  if (v.META_WABA_ID) config.wabaId = v.META_WABA_ID;
  return config;
}

// The vault fields of an agent's WhatsApp connection.
export const whatsappVaultValues = (config: any) => ({
  META_PHONE_NUMBER_ID: config?.phoneNumberId,
  META_WA_ACCESS_TOKEN: config?.systemUserAccessToken,
  META_WABA_ID: config?.wabaId,
});

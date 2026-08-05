/**
 * Server Token Exchange Helper
 * Sends Meta authorization code to Express server to exchange for access token & fetch WABA/phone numbers.
 */

export interface TokenExchangeParams {
  code: string;
  appId: string;
  configId?: string;
  appSecret?: string;
  botId?: string;
  sessionToken?: string;
  redirectUri?: string;
}

export interface TokenExchangeResult {
  success: boolean;
  token?: string;
  wabaId?: string;
  phoneNumberId?: string;
  businessId?: string;
  message?: string;
  error?: string;
}

export async function exchangeMetaCode(params: TokenExchangeParams): Promise<TokenExchangeResult> {
  const { code, appId, configId, appSecret, botId, sessionToken, redirectUri } = params;

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const res = await fetch("/api/whatsapp/meta-token-exchange", {
    method: "POST",
    headers,
    body: JSON.stringify({
      code,
      appId,
      configId,
      appSecret,
      botId,
      redirectUri: redirectUri || window.location.origin
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || data.error || "שגיאה בהחלפת קוד אימות מול Meta");
  }

  return {
    success: true,
    token: data.token || data.accessToken || data.systemUserAccessToken,
    wabaId: data.wabaId,
    phoneNumberId: data.phoneNumberId,
    businessId: data.businessId,
    message: data.message || "החלפת קוד אימות בוצעה בהצלחה"
  };
}

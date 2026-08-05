/**
 * High level WhatsApp Business Cloud API Connection Library
 */

import { startEmbeddedSignup } from "./embeddedSignup";
import { exchangeMetaCode, TokenExchangeResult } from "./tokenExchange";

export interface ConnectWhatsAppParams {
  appId: string;
  configId: string;
  appSecret?: string;
  botId?: string;
  sessionToken?: string;
  onSessionInfo?: (data: { wabaId?: string; phoneNumberId?: string; currentStep?: string }) => void;
}

export async function connectWhatsAppBusiness(params: ConnectWhatsAppParams): Promise<TokenExchangeResult> {
  const { appId, configId, appSecret, botId, sessionToken, onSessionInfo } = params;

  if (!appId || !configId) {
    throw new Error("יש להזין Meta App ID ו-Configuration ID (config_id) בהגדרות");
  }

  // 1. Run Meta Embedded Signup to get OAuth code & session info
  const signupResult = await startEmbeddedSignup({
    appId,
    configId,
    onSessionInfo
  });

  if (!signupResult.code) {
    throw new Error("לא התקבל code מ-Meta. אנא נסה שוב.");
  }

  // 2. Exchange code for Access Token & retrieve WABA/Phone IDs via Server
  const exchangeResult = await exchangeMetaCode({
    code: signupResult.code,
    appId,
    configId,
    appSecret,
    botId,
    sessionToken
  });

  // Combine results (prefer server returned IDs, fall back to Embedded Signup captured IDs)
  const finalWabaId = exchangeResult.wabaId || signupResult.wabaId || "";
  const finalPhoneId = exchangeResult.phoneNumberId || signupResult.phoneNumberId || "";

  return {
    success: true,
    token: exchangeResult.token,
    wabaId: finalWabaId,
    phoneNumberId: finalPhoneId,
    businessId: exchangeResult.businessId,
    message: "חיבור WhatsApp Business מול Meta הושלם בהצלחה!"
  };
}

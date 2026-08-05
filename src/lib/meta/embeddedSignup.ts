/**
 * Meta Embedded Signup Handler
 * Manages the embedded signup flow popup, auth code reception, and postMessage event listeners.
 */

import { loadFacebookSdk } from "./facebook";

export interface EmbeddedSignupConfig {
  appId: string;
  configId: string;
  onSessionInfo?: (data: { wabaId?: string; phoneNumberId?: string; currentStep?: string }) => void;
}

export interface EmbeddedSignupResponse {
  code?: string;
  wabaId?: string;
  phoneNumberId?: string;
  authResponse?: any;
}

export async function startEmbeddedSignup(config: EmbeddedSignupConfig): Promise<EmbeddedSignupResponse> {
  const { appId, configId, onSessionInfo } = config;

  if (!appId || !configId) {
    throw new Error("חטיבת Meta דורשת מזהה אפליקציה (App ID) וקונפיגורציה (Configuration ID / config_id)");
  }

  // Ensure FB SDK is loaded
  await loadFacebookSdk({ appId });

  return new Promise((resolve, reject) => {
    let capturedWabaId = "";
    let capturedPhoneId = "";

    // Listen to window.postMessage for Meta Embedded Signup sessionInfo events
    const messageHandler = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data && (data.type === "WA_EMBEDDED_SIGNUP" || data.event === "WA_EMBEDDED_SIGNUP")) {
          console.log("[META EMBEDDED SIGNUP EVENT]", data);

          if (data.data) {
            const wabaId = data.data.waba_id || data.data.wabaId;
            const phoneId = data.data.phone_number_id || data.data.phoneNumberId;
            const step = data.data.current_step || data.data.step;

            if (wabaId) capturedWabaId = wabaId;
            if (phoneId) capturedPhoneId = phoneId;

            if (onSessionInfo) {
              onSessionInfo({
                wabaId: capturedWabaId,
                phoneNumberId: capturedPhoneId,
                currentStep: step
              });
            }
          }
        }
      } catch {
        // Ignore non-JSON postMessage events
      }
    };

    window.addEventListener("message", messageHandler);

    const cleanup = () => {
      window.removeEventListener("message", messageHandler);
    };

    const FB = (window as any).FB;
    if (!FB || typeof FB.login !== "function") {
      cleanup();
      return reject(new Error("Facebook SDK not available"));
    }

    FB.login(
      (response: any) => {
        cleanup();

        if (response && response.authResponse) {
          const code = response.authResponse.code || response.authResponse.accessToken;
          resolve({
            code,
            wabaId: capturedWabaId,
            phoneNumberId: capturedPhoneId,
            authResponse: response.authResponse
          });
        } else {
          reject(new Error("התחברות Meta בוטלה או לא החזירה קוד אימות"));
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_embedded_signup",
          sessionInfoVersion: 3
        }
      }
    );
  });
}

import React, { useState, useEffect } from "react";
import { 
  X, 
  Smartphone, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Save, 
  RefreshCw,
  ShieldCheck,
  Building2,
  Hash,
  PencilLine,
  BadgeCheck,
  Webhook
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { connectWhatsAppBusiness } from "../lib/meta/whatsapp";

interface WhatsAppConfig {
  phoneNumberId: string;
  systemUserAccessToken: string;
  wabaId: string;
  phoneNumber?: string;
  code?: string;
  appId?: string;
  configId?: string;
  appSecret?: string;
  status?: string;
  connectionType?: "official_meta";
  updatedAt?: string;
}

interface WhatsAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string;
  botId: string;
  businessName: string;
  initialOwnerPhone?: string;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onConfigSaved?: (updatedConfig: WhatsAppConfig) => void;
}

const META_APP_ID = "1950695432176191";
const META_CONFIG_ID = "4827048247578784";
// Default n8n webhook for incoming WhatsApp messages (editable per bot)
const DEFAULT_WEBHOOK_URL = "https://n8n.srv1239769.hstgr.cloud/webhook/whatsappopt";

export default function WhatsAppSettingsModal({
  isOpen,
  onClose,
  sessionToken,
  botId,
  businessName,
  apiFetch,
  onConfigSaved
}: WhatsAppSettingsModalProps) {
  // Connection details resulting from Embedded Signup
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [systemUserAccessToken, setSystemUserAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Manual entry (alternative to Embedded Signup): user pastes WABA ID, Phone Number ID and Token
  const [manualMode, setManualMode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedInfo, setVerifiedInfo] = useState<{ displayPhoneNumber: string; verifiedName: string; wabaName: string } | null>(null);

  // Incoming-messages webhook (subscribes the saved WABA to the app via /api/whatsapp/subscribe-webhook)
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [webhookSubscribedAt, setWebhookSubscribedAt] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  // What is stored on the server, so the webhook uses saved values rather than unsaved edits
  const [savedCredentials, setSavedCredentials] = useState(false);

  // UI States
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [status, setStatus] = useState<"Connected" | "Partially Configured" | "Not Connected">("Not Connected");

  // Load existing config on modal open
  useEffect(() => {
    if (isOpen) {
      loadWhatsAppConfig();
    }
  }, [isOpen, botId]);

  const loadWhatsAppConfig = async () => {
    setFeedback(null);
    setManualMode(false);
    setVerifiedInfo(null);
    try {
      const res = await apiFetch(`/api/whatsapp/config?botId=${encodeURIComponent(botId)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setPhoneNumberId(data.config.phoneNumberId || "");
        setSystemUserAccessToken(data.config.systemUserAccessToken || "");
        setWabaId(data.config.wabaId || "");
        setWebhookUrl(data.config.webhookCallbackUrl || DEFAULT_WEBHOOK_URL);
        setWebhookVerifyToken(data.config.webhookVerifyToken || "");
        setWebhookSubscribedAt(data.config.webhookSubscribedAt || "");
        setSavedCredentials(!!(data.config.wabaId && data.config.systemUserAccessToken));

        if (data.config.status === "Connected" || (data.config.systemUserAccessToken && data.config.wabaId)) {
          setStatus("Connected");
        } else if (data.config.phoneNumberId || data.config.wabaId) {
          setStatus("Partially Configured");
        } else {
          setStatus("Not Connected");
        }
      }
    } catch (err) {
      console.error("Failed loading WhatsApp config:", err);
    }
  };

  // Launch Facebook Embedded Signup
  const handleLaunchFacebookSignup = async () => {
    setFeedback(null);
    setIsConnecting(true);

    try {
      setFeedback({
        type: "success",
        message: "מתחבר מול Meta Embedded Signup... אנא השלם את השלבים בחלון שנפתח."
      });

      const result = await connectWhatsAppBusiness({
        appId: META_APP_ID,
        configId: META_CONFIG_ID,
        botId,
        sessionToken,
        onSessionInfo: (data) => {
          if (data.wabaId) setWabaId(data.wabaId);
          if (data.phoneNumberId) setPhoneNumberId(data.phoneNumberId);
        }
      });

      if (result.token) setSystemUserAccessToken(result.token);
      if (result.wabaId) setWabaId(result.wabaId);
      if (result.phoneNumberId) setPhoneNumberId(result.phoneNumberId);

      setStatus("Connected");
      setFeedback({
        type: "success",
        message: "חיבור Meta Embedded Signup הושלם בהצלחה! הפרטים והטוקן נשמרו."
      });

      const payload: WhatsAppConfig = {
        phoneNumberId: result.phoneNumberId || phoneNumberId,
        systemUserAccessToken: result.token || systemUserAccessToken,
        wabaId: result.wabaId || wabaId,
        appId: META_APP_ID,
        configId: META_CONFIG_ID,
        status: "Connected",
        connectionType: "official_meta"
      };

      if (onConfigSaved) {
        onConfigSaved(payload);
      }
    } catch (err: any) {
      console.error("[META SIGNUP ERROR]", err);
      setFeedback({
        type: "error",
        message: err.message || "שגיאה בתהליך התחברות Meta Embedded Signup"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVerifyCredentials = async () => {
    setFeedback(null);
    setVerifiedInfo(null);
    if (!wabaId.trim() || !phoneNumberId.trim() || !systemUserAccessToken.trim()) {
      setFeedback({ type: "error", message: "יש למלא WABA ID, Phone Number ID ו-Access Token לפני הבדיקה" });
      return;
    }
    setIsVerifying(true);
    try {
      const res = await apiFetch("/api/whatsapp/verify-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          wabaId: wabaId.trim(),
          phoneNumberId: phoneNumberId.trim(),
          systemUserAccessToken: systemUserAccessToken.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setVerifiedInfo({
          displayPhoneNumber: data.displayPhoneNumber || "",
          verifiedName: data.verifiedName || "",
          wabaName: data.wabaName || ""
        });
        setFeedback({ type: "success", message: "הפרטים אומתו מול Meta בהצלחה! לחץ \"שמור הגדרות\" כדי לחבר." });
      } else {
        setFeedback({ type: "error", message: data.message || "אימות הפרטים נכשל" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "שגיאת תקשורת עם השרת" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveConfig = async () => {
    setFeedback(null);
    if (manualMode && (!wabaId.trim() || !phoneNumberId.trim() || !systemUserAccessToken.trim())) {
      setFeedback({ type: "error", message: "בהזנה ידנית יש למלא את שלושת השדות: WABA ID, Phone Number ID ו-Access Token" });
      return;
    }
    setIsSaving(true);

    const calculatedStatus = (phoneNumberId.trim() && systemUserAccessToken.trim() && wabaId.trim())
      ? "Connected" 
      : (phoneNumberId.trim() || wabaId.trim() || systemUserAccessToken.trim() ? "Partially Configured" : "Not Connected");

    try {
      const payload = {
        botId,
        phoneNumberId: phoneNumberId.trim(),
        systemUserAccessToken: systemUserAccessToken.trim(),
        wabaId: wabaId.trim(),
        appId: META_APP_ID,
        configId: META_CONFIG_ID,
        connectionType: "official_meta",
        status: calculatedStatus,
        ...(verifiedInfo?.displayPhoneNumber ? { phoneNumber: verifiedInfo.displayPhoneNumber.replace(/\D/g, "") } : {})
      };

      const res = await apiFetch("/api/whatsapp/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setStatus(calculatedStatus);
        setManualMode(false);
        setSavedCredentials(!!(payload.wabaId && payload.systemUserAccessToken));
        setFeedback({
          type: "success",
          message: "הגדרות WhatsApp נשמרו בהצלחה!"
        });
        // The server answers with the full stored config
        if (onConfigSaved) onConfigSaved((data.config || payload) as any);
      } else {
        setFeedback({
          type: "error",
          message: data.message || "שגיאה בשמירת ההגדרות"
        });
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "שגיאת תקשורת עם השרת"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubscribeWebhook = async () => {
    setFeedback(null);
    setIsSubscribing(true);
    try {
      const res = await apiFetch("/api/whatsapp/subscribe-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ botId, callbackUrl: webhookUrl.trim(), verifyToken: webhookVerifyToken.trim() })
      });
      const data = await res.json().catch(() => ({ success: false, message: `שגיאת שרת (${res.status})` }));
      if (data.success) {
        setWebhookSubscribedAt(new Date().toISOString());
        setFeedback({ type: "success", message: "ה-Webhook חובר! הודעות למספר הזה יישלחו לכתובת שהוגדרה." });
      } else {
        setFeedback({ type: "error", message: data.message || "חיבור ה-Webhook נכשל" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "שגיאת תקשורת עם השרת" });
    } finally {
      setIsSubscribing(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto" dir="rtl">
      
      {/* MAIN MODAL */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-[#0D0F17] border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto text-slate-100"
      >
        {/* Header */}
        <div className="bg-[#131622] border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 rounded-xl border border-sky-500/20 text-sky-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">חיבור WhatsApp רשמי (Meta)</h2>
                {status === "Connected" && (
                  <span className="bg-emerald-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-400/40">
                    מחובר 🟢
                  </span>
                )}
                {status === "Partially Configured" && (
                  <span className="bg-slate-800 text-sky-300 border border-sky-500/40 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    מוגדר חלקית 🔵
                  </span>
                )}
                {status === "Not Connected" && (
                  <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    טרם מחובר 🔴
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                עסק: <strong className="text-white">{businessName || "הסוכן שלך"}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            title="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar text-right">

          {/* Feedback Message */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs font-bold ${
                  feedback.type === "success" 
                    ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-100" 
                    : "bg-red-950/80 border-red-500/50 text-red-100"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* MAIN ACTION CARD: 1-Click Facebook Signup */}
          <div className="p-5 rounded-2xl bg-[#121929] border border-sky-500/60 ring-1 ring-sky-500/30 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>חיבור בלחיצה אחת - Meta Embedded Signup</span>
                  <ShieldCheck className="w-4 h-4 text-sky-400" />
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  התחבר לחשבון ה-WhatsApp Business הרשמי שלך בלחיצה אחת דרך Facebook. החיבור בטוח, מהיר ואינו דורש הגדרות ידניות.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLaunchFacebookSignup}
              disabled={isConnecting}
              className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>מתחבר מול Facebook Meta...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">🔵</span>
                  <span>התחבר באמצעות Facebook</span>
                </>
              )}
            </button>
          </div>

          {/* ALTERNATIVE: Manual credentials entry */}
          <div className="p-4 rounded-2xl bg-[#131625] border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <PencilLine className="w-4 h-4 text-sky-400" />
                  <span>או: הזנת פרטי חיבור ידנית</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  כבר יש לך WABA ID, Phone Number ID ו-Access Token (למשל מ-Meta Business Manager / System User)? הזן אותם ידנית במקום להתחבר דרך Facebook.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setManualMode(!manualMode);
                  setVerifiedInfo(null);
                  setFeedback(null);
                  if (manualMode) loadWhatsAppConfig();
                }}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-[#141822] hover:bg-[#1E2433] text-slate-300 border border-slate-800"
              >
                {manualMode ? "ביטול" : "הזנה ידנית"}
              </button>
            </div>
          </div>

          {/* CONNECTION RESULTS / OUTPUTS SECTION */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                <span>{manualMode ? "הזנת פרטי החיבור (Credentials)" : "תוצרי החיבור (Credentials)"}</span>
              </h3>
              {status === "Connected" && (
                <span className="text-[11px] text-emerald-400 font-bold">✓ פרטי החיבור פעילים</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WABA ID */}
              <div className="bg-[#131625] border border-slate-800 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Business Account ID (WABA ID)</span>
                  </label>
                  {wabaId && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(wabaId, "wabaId")}
                      className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "wabaId" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === "wabaId" ? "הועתק" : "העתק"}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  readOnly={!manualMode}
                  value={manualMode ? wabaId : (wabaId || "ממתין להתחברות...")}
                  onChange={(e) => { setWabaId(e.target.value); setVerifiedInfo(null); }}
                  placeholder="לדוגמה: 102938475612345"
                  inputMode="numeric"
                  className={`w-full px-3 py-1.5 bg-[#080A12] border rounded-lg font-mono text-xs text-white focus:outline-none ${manualMode ? "border-sky-500/50 focus:border-sky-400" : "border-slate-800"}`}
                  dir="ltr"
                />
              </div>

              {/* Phone Number ID */}
              <div className="bg-[#131625] border border-slate-800 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-sky-400" />
                    <span>Phone Number ID</span>
                  </label>
                  {phoneNumberId && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(phoneNumberId, "phoneNumberId")}
                      className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "phoneNumberId" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === "phoneNumberId" ? "הועתק" : "העתק"}</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  readOnly={!manualMode}
                  value={manualMode ? phoneNumberId : (phoneNumberId || "ממתין להתחברות...")}
                  onChange={(e) => { setPhoneNumberId(e.target.value); setVerifiedInfo(null); }}
                  placeholder="לדוגמה: 109876543210987"
                  inputMode="numeric"
                  className={`w-full px-3 py-1.5 bg-[#080A12] border rounded-lg font-mono text-xs text-white focus:outline-none ${manualMode ? "border-sky-500/50 focus:border-sky-400" : "border-slate-800"}`}
                  dir="ltr"
                />
              </div>
            </div>

            {/* Access Token */}
            <div className="bg-[#131625] border border-slate-800 p-3 rounded-xl space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Access Token (טוקן גישה של המערכת)</span>
                </label>
                <div className="flex items-center gap-2">
                  {systemUserAccessToken && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(systemUserAccessToken, "token")}
                      className="text-slate-400 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === "token" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === "token" ? "הועתק" : "העתק"}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  readOnly={!manualMode}
                  value={manualMode ? systemUserAccessToken : (systemUserAccessToken || "ממתין להתחברות...")}
                  onChange={(e) => { setSystemUserAccessToken(e.target.value); setVerifiedInfo(null); }}
                  placeholder="EAAG..."
                  autoComplete="off"
                  className={`w-full pl-8 pr-3 py-1.5 bg-[#080A12] border rounded-lg font-mono text-xs text-white focus:outline-none ${manualMode ? "border-sky-500/50 focus:border-sky-400" : "border-slate-800"}`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute left-2 top-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {manualMode && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleVerifyCredentials}
                  disabled={isVerifying}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>בודק מול Meta...</span>
                    </>
                  ) : (
                    <>
                      <BadgeCheck className="w-4 h-4" />
                      <span>בדוק את הפרטים מול Meta</span>
                    </>
                  )}
                </button>
                {verifiedInfo && (
                  <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-100 space-y-0.5">
                    {verifiedInfo.displayPhoneNumber && (
                      <div>מספר: <strong dir="ltr">{verifiedInfo.displayPhoneNumber}</strong></div>
                    )}
                    {verifiedInfo.verifiedName && <div>שם מאומת: <strong>{verifiedInfo.verifiedName}</strong></div>}
                    {verifiedInfo.wabaName && <div>חשבון WABA: <strong>{verifiedInfo.wabaName}</strong></div>}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  מומלץ להשתמש בטוקן קבוע של System User (ולא בטוקן זמני של 24 שעות) עם ההרשאות whatsapp_business_messaging ו-whatsapp_business_management.
                </p>
              </div>
            )}
          </div>

          {/* INCOMING MESSAGES WEBHOOK */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Webhook className="w-4 h-4 text-sky-400" />
                <span>Webhook לקבלת הודעות</span>
              </h3>
              {webhookSubscribedAt && (
                <span className="text-[11px] text-emerald-400 font-bold">
                  ✓ חובר {new Date(webhookSubscribedAt).toLocaleDateString("he-IL")}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              לאן Meta תשלח את ההודעות שמגיעות למספר הזה (למשל Webhook ב-n8n). ה-Webhook חייב להחזיר את hub.challenge כשה-Verify Token תואם.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">כתובת ה-Webhook</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://n8n.example.com/webhook/whatsapp"
                  className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-800 focus:border-sky-400 rounded-lg font-mono text-xs text-white focus:outline-none"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">Verify Token</label>
                <input
                  type="text"
                  value={webhookVerifyToken}
                  onChange={(e) => setWebhookVerifyToken(e.target.value)}
                  placeholder="המילה הסודית שה-Webhook בודק"
                  autoComplete="off"
                  className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-800 focus:border-sky-400 rounded-lg font-mono text-xs text-white focus:outline-none"
                  dir="ltr"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSubscribeWebhook}
              disabled={isSubscribing || !savedCredentials || manualMode || !webhookUrl.trim() || !webhookVerifyToken.trim()}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubscribing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>מחבר מול Meta...</span>
                </>
              ) : (
                <>
                  <Webhook className="w-4 h-4" />
                  <span>{webhookSubscribedAt ? "עדכן חיבור Webhook" : "חבר Webhook"}</span>
                </>
              )}
            </button>
            {(!savedCredentials || manualMode) && (
              <p className="text-[11px] text-slate-500">יש לשמור קודם את פרטי החיבור (WABA ID ו-Access Token) ורק אז לחבר Webhook.</p>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-[#131622] border-t border-slate-800 p-4 sm:p-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#141822] hover:bg-[#1E2433] text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            סגור
          </button>

          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>שומר...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>שמור הגדרות</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

    </div>
  );
}

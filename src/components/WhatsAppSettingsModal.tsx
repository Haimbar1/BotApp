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
  Hash
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
    try {
      const res = await apiFetch(`/api/whatsapp/config?botId=${encodeURIComponent(botId)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (data.success && data.config) {
        setPhoneNumberId(data.config.phoneNumberId || "");
        setSystemUserAccessToken(data.config.systemUserAccessToken || "");
        setWabaId(data.config.wabaId || "");

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

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setFeedback(null);

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
        status: calculatedStatus
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
        setFeedback({
          type: "success",
          message: "הגדרות WhatsApp נשמרו בהצלחה!"
        });
        if (onConfigSaved) onConfigSaved(payload as any);
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-blue-400/30"
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

          {/* CONNECTION RESULTS / OUTPUTS SECTION */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Key className="w-4 h-4 text-sky-400" />
                <span>תוצרי החיבור (Credentials)</span>
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
                  readOnly
                  value={wabaId || "ממתין להתחברות..."}
                  className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-800 rounded-lg font-mono text-xs text-white focus:outline-none"
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
                  readOnly
                  value={phoneNumberId || "ממתין להתחברות..."}
                  className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-800 rounded-lg font-mono text-xs text-white focus:outline-none"
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
                  readOnly
                  value={systemUserAccessToken || "ממתין להתחברות..."}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#080A12] border border-slate-800 rounded-lg font-mono text-xs text-white focus:outline-none"
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
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-[#131622] border-t border-slate-800 p-4 sm:p-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
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

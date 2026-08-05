import React, { useState, useEffect, useRef } from "react";
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
  QrCode,
  LogOut,
  Radio,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Bug
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { connectWhatsAppBusiness } from "../lib/meta/whatsapp";

interface WhatsAppConfig {
  phoneNumberId: string;
  systemUserAccessToken: string;
  wabaId: string;
  phoneNumber: string;
  code: string;
  appId?: string;
  configId?: string;
  appSecret?: string;
  status?: string;
  connectionType?: "official_meta" | "unofficial_qr";
  evolutionInstanceName?: string;
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

export default function WhatsAppSettingsModal({
  isOpen,
  onClose,
  sessionToken,
  botId,
  businessName,
  initialOwnerPhone = "",
  apiFetch,
  onConfigSaved
}: WhatsAppSettingsModalProps) {
  // Connection type selected: "official_meta" vs "unofficial_qr"
  const [selectedMethod, setSelectedMethod] = useState<"official_meta" | "unofficial_qr">("official_meta");

  // Official Meta Facebook Credentials
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [systemUserAccessToken, setSystemUserAccessToken] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(initialOwnerPhone);
  const [code, setCode] = useState("");
  const [appId, setAppId] = useState("");
  const [configId, setConfigId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showAdvancedMeta, setShowAdvancedMeta] = useState(false);

  // QR Code Popup Sub-Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [evolutionState, setEvolutionState] = useState<"connecting" | "open" | "close" | "unknown">("unknown");
  const [evolutionInstanceName, setEvolutionInstanceName] = useState<string>("");
  const [evolutionServerMsg, setEvolutionServerMsg] = useState<string>("");
  const [evolutionApiUrl, setEvolutionApiUrl] = useState<string>("http://72.61.185.147:60486");
  const [evolutionGlobalKey, setEvolutionGlobalKey] = useState<string>("l66VrCvMBNoLSUEc1IUoQ7lDPmoCMibV");
  const [showEvolutionAdvanced, setShowEvolutionAdvanced] = useState<boolean>(false);
  const [isDebugging, setIsDebugging] = useState<boolean>(false);
  const [debugResults, setDebugResults] = useState<any | null>(null);
  const pollingTimerRef = useRef<any>(null);

  // Common UI states
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [status, setStatus] = useState<"Connected" | "Partially Configured" | "Not Connected">("Not Connected");

  // Load existing config on modal open
  useEffect(() => {
    if (isOpen) {
      loadWhatsAppConfig();
    } else {
      stopQrPolling();
      setIsQrModalOpen(false);
    }
  }, [isOpen, botId]);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      stopQrPolling();
    };
  }, []);

  // Sync phone if initially empty
  useEffect(() => {
    if (initialOwnerPhone && !phoneNumber) {
      setPhoneNumber(initialOwnerPhone);
    }
  }, [initialOwnerPhone]);

  const stopQrPolling = () => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

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
        setPhoneNumber(data.config.phoneNumber || initialOwnerPhone || "");
        setCode(data.config.code || "");
        if (data.config.appId) setAppId(data.config.appId);
        if (data.config.configId) setConfigId(data.config.configId);
        if (data.config.appSecret) setAppSecret(data.config.appSecret);
        if (data.config.evolutionApiUrl) setEvolutionApiUrl(data.config.evolutionApiUrl);
        if (data.config.evolutionGlobalKey) setEvolutionGlobalKey(data.config.evolutionGlobalKey);

        const type = data.config.connectionType || "official_meta";
        setSelectedMethod(type);

        if (type === "unofficial_qr") {
          checkEvolutionState();
        }

        if (data.config.status === "Connected") {
          setStatus("Connected");
        } else if (data.config.phoneNumberId || data.config.wabaId || data.config.code) {
          setStatus("Partially Configured");
        } else {
          setStatus("Not Connected");
        }
      }
    } catch (err) {
      console.error("Failed loading WhatsApp config:", err);
    }
  };

  // 1. Launch Facebook Embedded Signup
  const handleLaunchFacebookSignup = async () => {
    setFeedback(null);
    setSelectedMethod("official_meta");

    const cleanAppId = appId.trim();
    const cleanConfigId = configId.trim() || "whatsapp_business_signup";

    if (!cleanAppId) {
      setShowAdvancedMeta(true);
      setFeedback({
        type: "error",
        message: "כדי להתחבר בלחיצה דרך Facebook, יש להזין מזהה אפליקציה (Meta App ID) ב'הגדרות מתקדמות'."
      });
      return;
    }

    try {
      setFeedback({
        type: "success",
        message: "מתחבר מול Meta Embedded Signup... אנא השלם את השלבים בחלון שנפתח."
      });

      const result = await connectWhatsAppBusiness({
        appId: cleanAppId,
        configId: cleanConfigId,
        appSecret: appSecret.trim(),
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
        message: "חיבור Meta Embedded Signup הושלם בהצלחה! הפרטים והטוקן עודכנו."
      });

      if (onConfigSaved) {
        onConfigSaved({
          phoneNumberId: result.phoneNumberId || phoneNumberId,
          systemUserAccessToken: result.token || systemUserAccessToken,
          wabaId: result.wabaId || wabaId,
          phoneNumber: phoneNumber,
          code: "",
          appId: cleanAppId,
          configId: cleanConfigId,
          appSecret: appSecret,
          status: "Connected",
          connectionType: "official_meta"
        });
      }
    } catch (err: any) {
      console.error("[META SIGNUP ERROR]", err);
      setFeedback({
        type: "error",
        message: err.message || "שגיאה בתהליך התחברות Meta Embedded Signup"
      });
    }
  };

  // 2. Open QR Code Popup and fetch/generate QR Code
  const handleOpenQrModal = async () => {
    setSelectedMethod("unofficial_qr");
    setIsQrModalOpen(true);
    await fetchQrCode();
  };

  const handleCreateInstance = async () => {
    setIsQrLoading(true);
    setFeedback(null);
    setEvolutionServerMsg("");
    try {
      const res = await apiFetch("/api/evolution/create-instance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          botId,
          apiUrl: evolutionApiUrl,
          globalKey: evolutionGlobalKey
        })
      });
      const data = await res.json();
      if (data.instanceName) {
        setEvolutionInstanceName(data.instanceName);
      }
      const msg = data.message || (data.success ? "אינסטנס נוצר בהצלחה ב-Evolution API" : `תגובת Evolution: ${JSON.stringify(data)}`);
      setEvolutionServerMsg(msg);
      setFeedback({
        type: data.success ? "success" : "error",
        message: data.success ? `אינסטנס נוצר: ${data.instanceName}` : msg
      });
      if (data.base64 || data.qrUrl || data.rawCode) {
        const finalUrl = data.qrUrl || (data.base64 ? (data.base64.startsWith("data:") ? data.base64 : `data:image/png;base64,${data.base64}`) : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.rawCode)}`);
        setQrUrl(finalUrl);
      }
      checkEvolutionState();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "נכשל ביצירת אינסטנס ב-Evolution API"
      });
    } finally {
      setIsQrLoading(false);
    }
  };

  const fetchQrCode = async () => {
    setIsQrLoading(true);
    setFeedback(null);
    setEvolutionServerMsg("");
    try {
      // Whenever scanning again, always delete old instance and recreate a clean fresh instance
      await handleInternalRecreateInstance();
    } catch (err: any) {
      console.error("fetchQrCode error:", err);
      setFeedback({
        type: "error",
        message: `שגיאה בטעינת קוד QR: ${err?.message}`
      });
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleInternalRecreateInstance = async () => {
    setEvolutionServerMsg("מבצע יצירת חיבור נקי למניעת חסימה...");
    try {
      const res = await apiFetch("/api/evolution/recreate-instance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          botId,
          apiUrl: evolutionApiUrl,
          globalKey: evolutionGlobalKey
        })
      });
      const data = await res.json();
      if (data.instanceName) {
        setEvolutionInstanceName(data.instanceName);
      }
      if (data.success && (data.qrUrl || data.base64 || data.rawCode)) {
        const finalUrl = data.qrUrl || (data.base64 ? (data.base64.startsWith("data:") ? data.base64 : `data:image/png;base64,${data.base64}`) : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.rawCode)}`);
        setQrUrl(finalUrl);
        setEvolutionServerMsg(`קוד QR נטען בהצלחה`);
        setEvolutionState("connecting");
        startQrPolling();
      } else {
        setFeedback({
          type: "error",
          message: data.message || "נכשל בטעינת קוד QR. יש להמתין מספר דקות ולנסות שוב."
        });
      }
    } catch (err: any) {
      console.error("handleInternalRecreateInstance error:", err);
      setFeedback({
        type: "error",
        message: `שגיאה בתקשורת עם השרת: ${err?.message}`
      });
    }
  };

  const handleRunDebug = async () => {
    setIsDebugging(true);
    setDebugResults(null);
    try {
      const queryParams = new URLSearchParams({
        botId,
        apiUrl: evolutionApiUrl,
        globalKey: evolutionGlobalKey
      });
      const res = await apiFetch(`/api/evolution/debug?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      setDebugResults(data);
    } catch (err: any) {
      setDebugResults({ error: err?.message || "נכשל בהרצת דיבוג" });
    } finally {
      setIsDebugging(false);
    }
  };

  const checkEvolutionState = async () => {
    try {
      const queryParams = new URLSearchParams({
        botId,
        apiUrl: evolutionApiUrl,
        globalKey: evolutionGlobalKey
      });
      const res = await apiFetch(`/api/evolution/connection-state?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      const data = await res.json();
      if (data.instanceName) {
        setEvolutionInstanceName(data.instanceName);
      }
      if (data.success) {
        setEvolutionState(data.state || "unknown");
        if (data.state === "open") {
          setStatus("Connected");
          stopQrPolling();
          setFeedback({
            type: "success",
            message: "החשבון מחובר בהצלחה בוואטסאפ! 🟢"
          });
        }
      }
    } catch (err) {
      // Ignored
    }
  };

  const startQrPolling = () => {
    stopQrPolling();
    pollingTimerRef.current = setInterval(checkEvolutionState, 4000);
  };

  const handleLogoutEvolution = async () => {
    try {
      await apiFetch("/api/evolution/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ botId })
      });
      setEvolutionState("close");
      setStatus("Not Connected");
      setQrUrl(null);
      stopQrPolling();
      setIsQrModalOpen(false);
      setFeedback({
        type: "success",
        message: "התנתקת בהצלחה מחשבון WhatsApp"
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setFeedback(null);

    const calculatedStatus = selectedMethod === "official_meta"
      ? (phoneNumberId.trim() && systemUserAccessToken.trim() ? "Connected" : phoneNumberId.trim() || code.trim() ? "Partially Configured" : "Not Connected")
      : (evolutionState === "open" ? "Connected" : "Partially Configured");

    try {
      const payload = {
        botId,
        phoneNumberId: phoneNumberId.trim(),
        systemUserAccessToken: systemUserAccessToken.trim(),
        wabaId: wabaId.trim(),
        phoneNumber: phoneNumber.trim(),
        code: code.trim(),
        appId: appId.trim(),
        configId: configId.trim(),
        appSecret: appSecret.trim(),
        connectionType: selectedMethod,
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
        className="bg-[#0D0F17] border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto text-slate-100"
      >
        {/* Header */}
        <div className="bg-[#131622] border-b border-slate-800 p-4 sm:p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">חיבור WhatsApp העסקי</h2>
                {status === "Connected" && (
                  <span className="bg-emerald-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-400/40">
                    מחובר 🟢
                  </span>
                )}
                {status === "Partially Configured" && (
                  <span className="bg-slate-800 text-sky-300 border border-sky-500/40 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    הגדרות חלקיות 🔵
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

          {/* PRIMARY INPUT: Account Phone Number */}
          <div className="bg-[#131625] border border-slate-800 p-4 rounded-xl space-y-2">
            <label className="block text-xs font-bold text-slate-100">
              מספר טלפון של חשבון ה-WhatsApp:
            </label>
            <div className="relative">
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setFeedback(null);
                }}
                placeholder="לדוגמה: 0501234567 או 972501234567"
                className="w-full px-3.5 py-2 bg-[#080A12] border border-slate-700 rounded-xl font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                dir="ltr"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              הזן את מספר הטלפון המחובר לוואטסאפ של העסק (מספר פעיל לקבלת ושליחת הודעות).
            </p>
          </div>

          <p className="text-xs font-bold text-slate-300">בחר את שיטת החיבור המועדפת עליך:</p>

          {/* OPTION A: OFFICIAL META FACEBOOK */}
          <div 
            onClick={() => setSelectedMethod("official_meta")}
            className={`p-5 rounded-2xl border transition cursor-pointer space-y-3 ${
              selectedMethod === "official_meta"
                ? "bg-[#121929] border-sky-500 ring-1 ring-sky-500/50"
                : "bg-[#12141F] border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full border-2 border-sky-400 flex items-center justify-center shrink-0">
                  {selectedMethod === "official_meta" && <div className="w-2 h-2 rounded-full bg-sky-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>אפשרות א' - חיבור רשמי (Facebook / Meta)</span>
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    חיבור רשמי ובטוח דרך Meta Cloud API ללא חשש מחסימות
                  </p>
                </div>
              </div>

              <span className="text-xs bg-slate-800 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-full font-bold shrink-0">
                רשמי ✓
              </span>
            </div>

            {/* Direct Facebook Signup Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLaunchFacebookSignup();
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-blue-400/30"
              >
                <span className="text-base">🔵</span>
                <span>התחבר באמצעות Facebook</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdvancedMeta(!showAdvancedMeta);
                }}
                className="text-xs text-slate-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer self-center"
              >
                <span>הגדרות מתקדמות (Phone ID, Token)</span>
                {showAdvancedMeta ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Collapsible Advanced Credentials */}
            <AnimatePresence>
              {showAdvancedMeta && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-3 border-t border-slate-800 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Meta App ID (אפליקציה):</label>
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId(e.target.value)}
                        placeholder="1950695432176191"
                        className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-700 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-sky-400"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Configuration ID (config_id):</label>
                      <input
                        type="text"
                        value={configId}
                        onChange={(e) => setConfigId(e.target.value)}
                        placeholder="whatsapp_business_signup"
                        className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-700 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-sky-400"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Meta App Secret (סוד אפליקציה):</label>
                      <input
                        type="password"
                        value={appSecret}
                        onChange={(e) => setAppSecret(e.target.value)}
                        placeholder="••••••••••••••••"
                        className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-700 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-sky-400"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">Phone Number ID:</label>
                      <input
                        type="text"
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        placeholder="104829381273645"
                        className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-700 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-sky-400"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">WABA ID (חשבון עסקי):</label>
                      <input
                        type="text"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        placeholder="109283746152435"
                        className="w-full px-3 py-1.5 bg-[#080A12] border border-slate-700 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-sky-400"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">System User Access Token:</label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        value={systemUserAccessToken}
                        onChange={(e) => setSystemUserAccessToken(e.target.value)}
                        placeholder="EAAG..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[#080A12] border border-slate-700 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-sky-400"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute left-2 top-1.5 text-slate-400 hover:text-white"
                      >
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* OPTION B: UNOFFICIAL QR CODE */}
          <div 
            onClick={() => setSelectedMethod("unofficial_qr")}
            className={`p-5 rounded-2xl border transition cursor-pointer space-y-4 ${
              selectedMethod === "unofficial_qr"
                ? "bg-[#1A1226] border-purple-500 ring-1 ring-purple-500/50"
                : "bg-[#12141F] border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full border-2 border-purple-400 flex items-center justify-center shrink-0">
                  {selectedMethod === "unofficial_qr" && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>אפשרות ב' - סריקת קוד QR (חיבור וואטסאפ מהיר)</span>
                    <QrCode className="w-4 h-4 text-purple-400" />
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    חיבור קל ומהיר מתוך אפליקציית WhatsApp בטלפון (מכשירים מקושרים)
                  </p>
                </div>
              </div>

              {evolutionState === "open" ? (
                <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded-full font-bold shrink-0 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  מחובר 🟢
                </span>
              ) : (
                <span className="text-xs bg-slate-800 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full font-bold shrink-0">
                  קוד QR
                </span>
              )}
            </div>

            {/* Anti-Ban Instructions Card - Clean High Contrast Dark Theme */}
            <div className="p-4 bg-[#0A0C16] border border-slate-800 rounded-xl text-xs space-y-2.5 text-right text-slate-200">
              <div className="flex items-center gap-2 text-slate-100 font-bold border-b border-slate-800/80 pb-2">
                <ShieldCheck className="w-4.5 h-4.5 text-sky-400 shrink-0" />
                <span className="text-xs font-black text-white">הוראות קריטיות למניעת חסימת WhatsApp לפני חיבור:</span>
              </div>

              <ul className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span><strong className="text-white">ניתוק מכשירים מקושרים קודמים:</strong> כנס בטלפון ל-וואטסאפ &gt; הגדרות &gt; מכשירים מקושרים, ונתק את כל החיבורים הקיימים.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span><strong className="text-white">ללא התחברות מקבילה ל-WhatsApp Web:</strong> ודא שלא התחברת ל-WhatsApp Web בדפדפן בדקות האחרונות.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span><strong className="text-white">שימוש במספר פעיל ומתוקן:</strong> התחבר אך ורק עם מספר ותיק שפועל באופן סדיר בטלפון (אין לחבר סים חדש שנפתח היום).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span><strong className="text-white">חיבור אינטרנט יציב:</strong> ודא שהטלפון מחובר לרשת Wi-Fi יציבה ואינו נמצא במצב "חיסכון בסוללה".</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400 font-bold shrink-0">•</span>
                  <span><strong className="text-white">סריקה אחת בלבד:</strong> לאחר סריקת ה-QR, המתן 15–20 שניות להשלמת הסנכרון. אם החיבור נכשל, אין לסרוק שוב ושוב – יש להמתין כ-20 דקות לפני ניסיון נוסף.</span>
                </li>
              </ul>
            </div>

            {/* Action Area */}
            <div className="pt-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenQrModal();
                }}
                disabled={isQrLoading}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 cursor-pointer border border-sky-400/30 disabled:opacity-50"
              >
                <QrCode className="w-4 h-4" />
                <span>{evolutionState === "open" ? "הצג קוד QR / חבר מחדש 📱" : "הצג קוד QR להתחברות 📱"}</span>
              </button>

              {evolutionState === "open" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLogoutEvolution();
                  }}
                  className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>התנתק</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions (STRICTLY 2 BUTTONS ONLY) */}
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

      {/* ---------------- DEDICATED QR CODE POPUP MODAL ---------------- */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0F121E] border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl p-6 text-center space-y-4 text-slate-100 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute left-4 top-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1 pt-1">
                <div className="p-3 bg-slate-800 text-slate-200 rounded-2xl w-fit mx-auto border border-slate-700 mb-1">
                  <QrCode className="w-8 h-8 text-sky-400" />
                </div>
                <h3 className="text-lg font-black text-white">חיבור וואטסאפ לסריקה</h3>
                <p className="text-xs text-slate-300">סרוק את הקוד מתוך אפליקציית WhatsApp בטלפון הנייד</p>
                
                {/* Step-by-step Anti-Ban Checklist for end user */}
                <div className="p-4 bg-[#0A0C16] border border-slate-800 rounded-xl text-xs space-y-2 text-right text-slate-200 mt-2">
                  <div className="flex items-center gap-1.5 text-slate-100 font-bold border-b border-slate-800/80 pb-1.5">
                    <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-xs font-bold text-white">הנחיות קריטיות לפני סריקת קוד ה-QR (מניעת חסימה):</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                    <li>1. <strong className="text-white">נתק מכשירים מקושרים:</strong> בטלפון: וואטסאפ &gt; הגדרות &gt; מכשירים מקושרים &gt; נתק הכל.</li>
                    <li>2. <strong className="text-white">ללא WhatsApp Web פעיל:</strong> סגור חלונות WhatsApp Web בדפדפן.</li>
                    <li>3. <strong className="text-white">מספר פעיל ומתוקן בלבד:</strong> חבר רק סים ותיק שפועל כסדרו בטלפון.</li>
                    <li>4. <strong className="text-white">חיבור אינטרנט יציב:</strong> ודא שרשת ה-Wi-Fi יציבה וללא מצב חיסכון בסוללה.</li>
                    <li>5. <strong className="text-white">סריקה אחת בלבד:</strong> המתן 15–20 שניות לאחר הסריקה. אם נכשל, המתן כ-20 דקות.</li>
                  </ul>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {evolutionState === "open" ? (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40 px-4 py-1.5 rounded-full text-xs shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    מחובר בהצלחה! 🟢
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-200 font-bold border border-slate-700 px-4 py-1.5 rounded-full text-xs shadow-md">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                    ממתין לסריקת קוד... 🔵
                  </span>
                )}
              </div>

              {/* QR Code Canvas / Image Display */}
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-300 w-fit mx-auto shadow-xl min-h-[220px] flex items-center justify-center">
                {isQrLoading ? (
                  <div className="p-10 space-y-3 text-slate-900">
                    <RefreshCw className="w-8 h-8 text-sky-600 animate-spin mx-auto" />
                    <p className="text-xs font-bold">מייצר קוד QR נקי...</p>
                  </div>
                ) : qrUrl ? (
                  <img
                    src={qrUrl}
                    alt="WhatsApp QR Code"
                    className="w-52 h-52 object-contain rounded-lg"
                  />
                ) : (
                  <div className="p-8 text-slate-800 text-xs font-bold">
                    טוען קוד...
                  </div>
                )}
              </div>

              {/* Popup Buttons */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  {evolutionState === "open" ? (
                    <button
                      type="button"
                      onClick={handleLogoutEvolution}
                      className="px-3.5 py-2 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>התנתק</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={fetchQrCode}
                      disabled={isQrLoading}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isQrLoading ? "animate-spin" : ""}`} />
                      <span>רענן קוד QR</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  סגור
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  FirebaseStorage
} from "firebase/storage";
import {
  Upload,
  Image as ImageIcon,
  Film,
  X,
  Copy,
  Check,
  Trash2,
  Settings,
  Link,
  Plus,
  AlertCircle,
  FileCheck,
  Play
} from "lucide-react";

export interface MediaItem {
  id: string;
  name: string;
  description: string;
  url: string;
  type: "image" | "video";
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  errorMsg?: string;
}

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface FirebaseMediaUploaderProps {
  mediaType: "image" | "video";
  title: string;
  value: string;
  onChange: (newValue: string) => void;
  isReadonly?: boolean;
}

export const FirebaseConfigModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [fbConfig, setFbConfig] = useState<FirebaseConfig>(getStoredFirebaseConfig());

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveFirebaseConfigToStorage(fbConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg bg-[#0d0f18] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>הגדרת Firebase Storage מערכתית 🌐 (מנהל ראשי)</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed font-medium">
          הזן את פרטי הפרויקט מ-Firebase Console. <strong className="text-emerald-400">הגדרות אלו תקפות באופן גלובלי ברמת המערכת לכל הבוטים</strong> ומאפשרות העלאה ישירה של תמונות וסרטונים ל-Google Cloud Firebase Storage.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">API Key</label>
            <input
              type="text"
              placeholder="AIzaSy..."
              value={fbConfig.apiKey}
              onChange={(e) => setFbConfig({ ...fbConfig, apiKey: e.target.value })}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">Storage Bucket</label>
            <input
              type="text"
              placeholder="my-app.appspot.com"
              value={fbConfig.storageBucket}
              onChange={(e) => setFbConfig({ ...fbConfig, storageBucket: e.target.value })}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">Project ID</label>
            <input
              type="text"
              placeholder="my-firebase-project"
              value={fbConfig.projectId}
              onChange={(e) => setFbConfig({ ...fbConfig, projectId: e.target.value })}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">Auth Domain (אופציונלי)</label>
            <input
              type="text"
              placeholder="my-app.firebaseapp.com"
              value={fbConfig.authDomain}
              onChange={(e) => setFbConfig({ ...fbConfig, authDomain: e.target.value })}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">App ID (אופציונלי)</label>
            <input
              type="text"
              placeholder="1:123456:web:..."
              value={fbConfig.appId}
              onChange={(e) => setFbConfig({ ...fbConfig, appId: e.target.value })}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-300">Messaging Sender ID (אופציונלי)</label>
            <input
              type="text"
              placeholder="1234567890"
              value={fbConfig.messagingSenderId}
              onChange={(e) => setFbConfig({ ...fbConfig, messagingSenderId: e.target.value })}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              dir="ltr"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSaveConfig}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow cursor-pointer"
          >
            שמור מפתחות Firebase מערכתיים
          </button>
        </div>
      </div>
    </div>
  );
};

const STORAGE_KEY_FIREBASE = "whatsapp_firebase_config";
const STORAGE_KEY_GLOBAL_MEDIA_POOL = "whatsapp_global_media_pool";

// Default fallback config helper
export function getStoredFirebaseConfig(): FirebaseConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FIREBASE);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading firebase config from localStorage", e);
  }

  return {
    apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "",
    authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || ""
  };
}

export function saveFirebaseConfigToStorage(config: FirebaseConfig) {
  localStorage.setItem(STORAGE_KEY_FIREBASE, JSON.stringify(config));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("whatsapp_firebase_config_updated", { detail: config }));
  }
}

// Global Media Pool Helpers
export function getGlobalMediaPool(): MediaItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GLOBAL_MEDIA_POOL);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading global media pool", e);
  }
  return [];
}

export function addToGlobalMediaPool(item: MediaItem) {
  if (!item.url || item.status !== "success") return;
  try {
    const existing = getGlobalMediaPool();
    // Avoid duplicate URLs
    if (!existing.some(e => e.url === item.url)) {
      const updated = [item, ...existing].slice(0, 100); // keep last 100 media items globally
      localStorage.setItem(STORAGE_KEY_GLOBAL_MEDIA_POOL, JSON.stringify(updated));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("whatsapp_global_media_updated", { detail: updated }));
      }
    }
  } catch (e) {
    console.error("Error adding to global media pool", e);
  }
}

// Helper to initialize Firebase Storage safely
function getFirebaseStorageInstance(config: FirebaseConfig): FirebaseStorage | null {
  if (!config.apiKey || !config.storageBucket) {
    return null;
  }
  try {
    let app: FirebaseApp;
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = getApp();
    } else {
      app = initializeApp(config);
    }
    return getStorage(app);
  } catch (err) {
    console.error("Failed to initialize Firebase app or storage:", err);
    return null;
  }
}

// Parse existing text representation into media items
function parseValueToMediaItems(val: string, defaultType: "image" | "video"): MediaItem[] {
  if (!val || !val.trim()) return [];
  
  const items: MediaItem[] = [];
  const lines = val.split("\n");
  
  let currentItem: Partial<MediaItem> | null = null;
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Matches formatted pattern: - תיאור: [X] | הסבר: [Y] | קישור: [URL]
    const structuredMatch = trimmed.match(/- תיאור:\s*\[?(.*?)\]?\s*\|\s*הסבר:\s*\[?(.*?)\]?\s*\|\s*קישור:\s*\[?(https?:\/\/[^\s\]]+)\]?/);
    if (structuredMatch) {
      items.push({
        id: `parsed_${idx}_${Date.now()}`,
        name: structuredMatch[1].trim() || "מדיה ללא שם",
        description: structuredMatch[2].trim() || "",
        url: structuredMatch[3].trim(),
        type: structuredMatch[3].match(/\.(mp4|webm|mov)(\?.*)?$/i) ? "video" : defaultType,
        progress: 100,
        status: "success"
      });
      return;
    }

    // Direct URL check
    const urlMatch = trimmed.match(/(https?:\/\/[^\s)]+)/);
    if (urlMatch) {
      const foundUrl = urlMatch[1];
      let name = trimmed.replace(foundUrl, "").replace(/^[-•*]\s*/, "").replace(/[():]/g, "").trim();
      if (!name) name = defaultType === "image" ? "תמונה ללא שם" : "סרטון ללא שם";
      
      items.push({
        id: `parsed_url_${idx}_${Date.now()}`,
        name: name,
        description: "",
        url: foundUrl,
        type: foundUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i) ? "video" : defaultType,
        progress: 100,
        status: "success"
      });
    }
  });

  return items;
}

// Convert media items array back to standard prompt text
function formatMediaItemsToText(items: MediaItem[]): string {
  if (items.length === 0) return "";
  
  return items
    .filter(item => item.url && item.status === "success" && !item.url.startsWith("blob:"))
    .map(item => {
      const cleanName = item.name.trim() || "מדיה";
      const cleanDesc = item.description.trim() || "הצג תמונה/וידאו זה ללקוח לפי הקשר השיחה";
      return `- תיאור: ${cleanName} | הסבר: ${cleanDesc} | קישור: ${item.url}`;
    })
    .join("\n");
}

export const FirebaseMediaUploader: React.FC<FirebaseMediaUploaderProps> = ({
  mediaType,
  title,
  value,
  onChange,
  isReadonly = false
}) => {
  const [items, setItems] = useState<MediaItem[]>(() => parseValueToMediaItems(value, mediaType));
  const [isDragging, setIsDragging] = useState(false);
  const [fbConfig, setFbConfig] = useState<FirebaseConfig>(getStoredFirebaseConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [showGlobalGallery, setShowGlobalGallery] = useState(false);
  const [globalPool, setGlobalPool] = useState<MediaItem[]>([]);
  const [manualUrlInput, setManualUrlInput] = useState("");
  const [manualTitleInput, setManualTitleInput] = useState("");
  const [manualDescInput, setManualDescInput] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);

  const handleOpenGlobalGallery = () => {
    setGlobalPool(getGlobalMediaPool());
    setShowGlobalGallery(true);
  };

  const handleSelectFromGlobalPool = (poolItem: MediaItem) => {
    // Check if already in current list
    if (items.some(i => i.url === poolItem.url)) return;
    const newItem: MediaItem = {
      ...poolItem,
      id: `global_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    const next = [...items, newItem];
    updateItemsAndParent(next);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Listen to global config updates
  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail) {
        setFbConfig(e.detail);
      } else {
        setFbConfig(getStoredFirebaseConfig());
      }
    };

    window.addEventListener("whatsapp_firebase_config_updated", handleConfigUpdate);
    return () => {
      window.removeEventListener("whatsapp_firebase_config_updated", handleConfigUpdate);
    };
  }, []);

  // Sync state whenever items list changes
  const updateItemsAndParent = (newItems: MediaItem[]) => {
    setItems(newItems);
    const formatted = formatMediaItemsToText(newItems);
    onChange(formatted);

    // Register successful items into global pool
    newItems.forEach(item => {
      if (item.status === "success" && item.url) {
        addToGlobalMediaPool(item);
      }
    });
  };

  // Keep items updated if external value changes drastically
  useEffect(() => {
    const currentFormatted = formatMediaItemsToText(items);
    if (value !== currentFormatted && !items.some(i => i.status === "uploading")) {
      const parsed = parseValueToMediaItems(value, mediaType);
      if (parsed.length !== items.length) {
        setItems(parsed);
      }
    }
  }, [value, mediaType]);

  const handleSaveConfig = () => {
    saveFirebaseConfigToStorage(fbConfig);
    setShowConfigModal(false);
  };

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const handleRemoveItem = (id: string) => {
    const filtered = items.filter(i => i.id !== id);
    updateItemsAndParent(filtered);
  };

  const handleItemFieldChange = (id: string, field: "name" | "description", val: string) => {
    const updated = items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: val };
      }
      return item;
    });
    updateItemsAndParent(updated);
  };

  // Upload single file to Firebase Storage with server upload fallback
  const processFileUpload = (file: File) => {
    const itemId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isVideo = file.type.startsWith("video/") || file.name.match(/\.(mp4|webm|mov)$/i);
    const fileType: "image" | "video" = isVideo ? "video" : "image";
    const fileNameClean = file.name.replace(/\.[^/.]+$/, "");

    // Prepare immediate object URL fallback if all uploads fail
    const localObjectUrl = URL.createObjectURL(file);

    const newItem: MediaItem = {
      id: itemId,
      name: fileNameClean,
      description: `קובץ ${fileType === "image" ? "תמונה" : "סרטון וידאו"} שהועלה על ידי המשתמש`,
      url: "",
      type: fileType,
      progress: 5,
      status: "uploading"
    };

    // Add uploading item immediately to UI
    setItems(prev => [...prev, newItem]);

    const finishWithResult = (finalUrl: string, errorText?: string) => {
      const isBlob = finalUrl.startsWith("blob:");
      const status = isBlob ? ("error" as const) : ("success" as const);
      const defaultErr = isBlob
        ? "⚠️ קישור מקומי (blob) אינו ציבורי. להעלאה ציבורית הגדר מפתחות Firebase Storage או העלה שוב."
        : errorText;

      setItems(prev => {
        const next = prev.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              url: finalUrl,
              status,
              progress: 100,
              errorMsg: defaultErr
            };
          }
          return item;
        });
        const formatted = formatMediaItemsToText(next);
        onChange(formatted);
        return next;
      });
    };

    // Helper: Upload file directly to server's public /api/upload endpoint
    const uploadViaServer = (fileObj: File) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Str = reader.result as string;
          const resp = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: fileObj.name,
              base64: base64Str
            })
          });
          const data = await resp.json();
          if (data.success && data.url) {
            console.log("[MEDIA UPLOADER] Server upload succeeded with public URL:", data.url);
            finishWithResult(data.url);
            return;
          }
        } catch (e) {
          console.error("[MEDIA UPLOADER] Server upload fetch error:", e);
        }
        finishWithResult(localObjectUrl, "⚠️ שגיאה בהעלאה לשרת.");
      };
      reader.onerror = () => {
        finishWithResult(localObjectUrl, "⚠️ שגיאה בקריאת הקובץ.");
      };
      reader.readAsDataURL(fileObj);
    };

    const storage = getFirebaseStorageInstance(fbConfig);

    if (storage) {
      // Real Firebase Upload Path with safety fallback to server upload
      let isCompletedOrHandled = false;
      const folderName = fileType === "image" ? "images" : "videos";
      const sanitizedFilename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storageRef = ref(storage, `whatsapp_media/${folderName}/${sanitizedFilename}`);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type
      });

      // Safety timeout: If after 3.5 seconds progress is still unhandled, switch to server upload
      const safetyTimer = setTimeout(() => {
        if (!isCompletedOrHandled) {
          isCompletedOrHandled = true;
          try { uploadTask.cancel(); } catch (_) {}
          console.warn("[MEDIA UPLOADER] Firebase timeout. Uploading via server fallback.");
          uploadViaServer(file);
        }
      }, 3500);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (isCompletedOrHandled) return;
          const progressPct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          setItems(prev => prev.map(item => {
            if (item.id === itemId) {
              return { ...item, progress: Math.max(progressPct, 15) };
            }
            return item;
          }));
        },
        (error) => {
          if (isCompletedOrHandled) return;
          isCompletedOrHandled = true;
          clearTimeout(safetyTimer);
          console.warn("[MEDIA UPLOADER] Firebase upload error, switching to server fallback:", error);
          uploadViaServer(file);
        },
        async () => {
          if (isCompletedOrHandled) return;
          isCompletedOrHandled = true;
          clearTimeout(safetyTimer);
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            finishWithResult(downloadUrl);
          } catch (err: any) {
            uploadViaServer(file);
          }
        }
      );
    } else {
      // Direct server upload when Firebase Storage credentials are not configured
      uploadViaServer(file);
    }
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).forEach(file => {
      processFileUpload(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isReadonly) return;
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleManualAddSubmit = () => {
    if (!manualUrlInput.trim()) return;

    const newItem: MediaItem = {
      id: `manual_${Date.now()}`,
      name: manualTitleInput.trim() || (mediaType === "image" ? "תמונה" : "סרטון וידאו"),
      description: manualDescInput.trim() || "קישור ישיר שהוזן ידנית",
      url: manualUrlInput.trim(),
      type: mediaType,
      progress: 100,
      status: "success"
    };

    const next = [...items, newItem];
    updateItemsAndParent(next);
    setManualUrlInput("");
    setManualTitleInput("");
    setManualDescInput("");
    setShowManualAdd(false);
  };

  const isFirebaseConfigured = Boolean(fbConfig.apiKey && fbConfig.storageBucket);

  return (
    <div className="flex flex-col gap-4 bg-[#0a0c14] border border-slate-800 rounded-2xl p-4 sm:p-5" dir="rtl">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl">
            {mediaType === "image" ? <ImageIcon className="w-5 h-5" /> : <Film className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                Firebase Storage Direct URL
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              העלה קבצי {mediaType === "image" ? "תמונה (JPG, PNG)" : "וידאו (MP4)"} לקבלת Direct Public URL תואם ל-WhatsApp API
            </p>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      {!isReadonly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition duration-200 ${
            isDragging
              ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]"
              : "border-slate-800 hover:border-emerald-500/40 bg-[#080a10] hover:bg-[#0c0f18]"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={mediaType === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm,video/quicktime"}
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <div className="p-3.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded-full shadow-inner">
            <Upload className="w-6 h-6 animate-bounce" />
          </div>

          <div className="flex flex-col gap-1 text-center">
            <span className="text-sm font-black text-white">
              גרור לכאן קבצי {mediaType === "image" ? "תמונה" : "וידאו"} או לחץ לבחירה מהמחשב 📁
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              תומך בקבצי {mediaType === "image" ? "JPG, PNG, WEBP, GIF" : "MP4, WEBM"} (העלאה ישירה ל-Firebase Storage)
            </span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5" />
              <span>חילוץ Direct URL אוטומטי</span>
            </span>
          </div>
        </div>
      )}

      {/* Manual URL Add & Global Library Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-slate-300">
          רשימת קבצים ומדיה לבוט ({items.length})
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenGlobalGallery}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition"
            title="בחר מדיה מספרית המדיה הגלובלית ששותפה מכל הבוטים"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>🌐 גלריית מדיה גלובלית</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManualAdd(!showManualAdd)}
            className="text-xs text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showManualAdd ? "סגור הזנה ידנית" : "הוסף קישור ידנית"}</span>
          </button>
        </div>
      </div>

      {/* Manual Add Drawer */}
      {showManualAdd && (
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col gap-3 animate-fadeIn">
          <span className="text-xs font-black text-white">הוספת קישור ישיר קיים למדיה:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="שם/כותרת המדיה (לדוגמה: תמונת סטודיו)"
              value={manualTitleInput}
              onChange={(e) => setManualTitleInput(e.target.value)}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
            />
            <input
              type="text"
              placeholder="קישור ישיר (URL) לתמונה/וידאו"
              value={manualUrlInput}
              onChange={(e) => setManualUrlInput(e.target.value)}
              className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
              dir="ltr"
            />
          </div>
          <input
            type="text"
            placeholder="הסבר לבוט מתי ואיך להשתמש (למשל: להציע כשהלקוח מבקש הדמיה)"
            value={manualDescInput}
            onChange={(e) => setManualDescInput(e.target.value)}
            className="px-3 py-2 bg-[#050609] border border-slate-800 rounded-lg text-xs font-semibold text-white focus:outline-none focus:border-sky-500"
          />
          <button
            type="button"
            onClick={handleManualAddSubmit}
            disabled={!manualUrlInput.trim()}
            className="self-end px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-50"
          >
            הוסף לרשימת המדיה
          </button>
        </div>
      )}

      {/* Media Items Grid / List */}
      {items.length === 0 ? (
        <div className="p-6 text-center border border-slate-850 rounded-xl bg-[#07080d] text-slate-500 text-xs font-semibold">
          עדיין לא הועלו קבצי {mediaType === "image" ? "תמונה" : "וידאו"}. גרור קבצים למעלה או לחץ לבחירה.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-[#0d0f17] border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col md:flex-row items-start gap-4 transition shadow-md"
            >
              {/* Media Preview Box */}
              <div className="w-full md:w-44 h-32 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative group">
                {item.status === "uploading" ? (
                  <div className="w-full h-full bg-[#060811] border border-slate-700 rounded-xl flex flex-col items-center justify-center gap-2 p-3 text-center">
                    <span className="animate-spin w-7 h-7 border-3 border-emerald-400 border-t-transparent rounded-full shadow-lg" />
                    <span className="text-xs font-black text-white bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow">
                      <span>מעלה...</span>
                      <span className="text-emerald-400 font-extrabold">{item.progress}%</span>
                    </span>
                  </div>
                ) : item.type === "image" ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
                    <video src={item.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-8 h-8 text-white opacity-80" />
                    </div>
                  </div>
                )}
              </div>

              {/* Item Fields & Direct URL */}
              <div className="flex-1 w-full flex flex-col gap-2.5">
                
                {/* Upload Progress Bar */}
                {item.status === "uploading" && (
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-emerald-500 to-sky-500 h-full transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {item.errorMsg && (
                  <div className="text-xs font-bold text-red-200 bg-red-950/90 border border-red-800 p-2.5 rounded-xl shadow-md flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{item.errorMsg}</span>
                  </div>
                )}

                {/* Title Input */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-200 shrink-0 w-20">שם הקובץ:</span>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemFieldChange(item.id, "name", e.target.value)}
                    placeholder="הזן כותרת לתמונה/וידאו"
                    className="flex-1 px-3 py-2 bg-slate-900 text-white border border-slate-700 rounded-xl text-xs font-bold placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
                    disabled={isReadonly}
                  />
                </div>

                {/* Description Input */}
                <div className="flex items-start gap-2">
                  <span className="text-xs font-black text-slate-200 shrink-0 w-20 mt-2">הסבר לבוט:</span>
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => handleItemFieldChange(item.id, "description", e.target.value)}
                    placeholder="רשום מתי ואיך הבוט צריך להשתמש בקובץ זה בצ'אט (למשל: תמונה של כיתת הלימוד, לשלוח כששואלים על הסניף)..."
                    className="flex-1 px-3 py-2 bg-slate-900 text-white border border-slate-700 rounded-xl text-xs font-bold placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none shadow-inner"
                    disabled={isReadonly}
                  />
                </div>

                {/* Direct Firebase URL Field & Copy Button */}
                {item.url && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    {item.url.startsWith("blob:") ? (
                      <div className="p-2.5 bg-red-950/90 border border-red-800 rounded-xl flex items-center justify-between gap-2 text-red-200 text-xs font-bold shadow-md">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="truncate">קישור blob מקומי (אינו ציבורי ואינו נשלח ל-WhatsApp)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowConfigModal(true)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[11px] font-extrabold shrink-0 transition"
                        >
                          הגדר Firebase 🌐
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-mono overflow-hidden shadow-inner">
                          <Link className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
                          <span className="truncate select-all" dir="ltr">{item.url}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyUrl(item.id, item.url)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border border-slate-700"
                          title="העתק Direct URL"
                        >
                          {copySuccessId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">הועתק!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-300" />
                              <span>העתק קישור</span>
                            </>
                          )}
                        </button>

                        {!isReadonly && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl transition shrink-0"
                            title="מחק קובץ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Global Media Gallery Modal */}
      {showGlobalGallery && (
        <div className="fixed inset-0 z-[150] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-2xl bg-[#0d0f18] border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">גלריית מדיה גלובלית 🌐</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    בחירת קבצי מדיה שהועלו מכל הבוטים במערכת
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGlobalGallery(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {globalPool.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-semibold">
                טרם הועלו קבצים לגלריית המדיה הגלובלית. כל קובץ שמועלה בבוט כלשהו יתווסף לכאן אוטומטית!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[50vh] p-1 scrollbar-thin">
                {globalPool.map((gItem) => {
                  const isSelected = items.some(i => i.url === gItem.url);
                  return (
                    <div
                      key={gItem.id}
                      className={`p-3 bg-slate-900 border rounded-xl flex items-center gap-3 transition ${
                        isSelected ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="w-14 h-14 bg-slate-950 rounded-lg overflow-hidden shrink-0 flex items-center justify-center border border-slate-800">
                        {gItem.type === "image" ? (
                          <img src={gItem.url} alt={gItem.name} className="w-full h-full object-cover" />
                        ) : (
                          <Play className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{gItem.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{gItem.description || "ללא הסבר"}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectFromGlobalPool(gItem)}
                        disabled={isSelected}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                          isSelected
                            ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        {isSelected ? "נבחר" : "הוסף לבוט"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setShowGlobalGallery(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useRef } from "react";
import { initializeApp, getApps, deleteApp } from "firebase/app";
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
  Play,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ExternalLink,
  Tag,
  Clipboard
} from "lucide-react";

export interface SubjectItem {
  id: string;
  title: string;
  description: string;
  url: string;
  thumbUrl?: string;
  linkUrl?: string;
  type?: "image" | "video";
  status?: "idle" | "uploading" | "success" | "error";
  progress?: number;
  errorMsg?: string;
}

export interface MediaSubject {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  items: SubjectItem[];
}

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
  
  try {
    const existingApps = getApps();
    const storageApp = existingApps.find(a => a.name === "whatsapp_storage_app");
    if (storageApp) {
      deleteApp(storageApp);
    }
  } catch (e) {
    console.warn("Could not delete previous Firebase app instance", e);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("whatsapp_firebase_config_updated", { detail: config }));
  }
}

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

export function addToGlobalMediaPool(item: { name: string; description: string; url: string; type?: "image" | "video" }) {
  if (!item.url || item.url.startsWith("blob:")) return;
  try {
    const existing = getGlobalMediaPool();
    if (!existing.some(e => e.url === item.url)) {
      const newItem: MediaItem = {
        id: `global_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: item.name || "תמונה/וידאו",
        description: item.description || "",
        url: item.url,
        type: item.type || "image",
        progress: 100,
        status: "success"
      };
      const updated = [newItem, ...existing].slice(0, 100);
      localStorage.setItem(STORAGE_KEY_GLOBAL_MEDIA_POOL, JSON.stringify(updated));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("whatsapp_global_media_updated", { detail: updated }));
      }
    }
  } catch (e) {
    console.error("Error adding to global media pool", e);
  }
}

function getFirebaseStorageInstance(config: FirebaseConfig): FirebaseStorage | null {
  const apiKey = (config.apiKey || "").trim();
  const rawBucket = (config.storageBucket || "").trim();
  if (!apiKey || !rawBucket) {
    return null;
  }

  const cleanBucket = rawBucket
    .replace(/^gs:\/\//i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim();

  try {
    const appName = "whatsapp_storage_app";
    const existingApps = getApps();
    let app = existingApps.find(a => a.name === appName);
    
    if (!app) {
      app = initializeApp({
        apiKey,
        authDomain: (config.authDomain || "").trim() || `${config.projectId || "app"}.firebaseapp.com`,
        projectId: (config.projectId || "").trim(),
        storageBucket: cleanBucket,
        messagingSenderId: (config.messagingSenderId || "").trim(),
        appId: (config.appId || "").trim()
      }, appName);
    }
    
    return getStorage(app, `gs://${cleanBucket}`);
  } catch (err) {
    console.error("[FIREBASE STORAGE] Failed to initialize instance:", err);
    return null;
  }
}

/**
 * Parses markdown prompt text into structured MediaSubject[]
 */
export function parseValueToSubjects(val: string, defaultType: "image" | "video" = "image"): MediaSubject[] {
  if (!val || !val.trim()) return [];

  const subjects: MediaSubject[] = [];
  const lines = val.split("\n");

  let currentSubject: MediaSubject | null = null;
  let currentItem: SubjectItem | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // 1. Subject Header: ### נושא: <title> or ### <title>
    const subjectMatch = trimmed.match(/^###\s*(?:נושא:\s*)?(.*)/);
    if (subjectMatch) {
      if (currentItem && currentSubject) {
        currentSubject.items.push(currentItem);
        currentItem = null;
      }
      if (currentSubject) {
        subjects.push(currentSubject);
      }
      currentSubject = {
        id: `subject_${Date.now()}_${subjects.length}_${Math.random().toString(36).substring(2, 6)}`,
        title: subjectMatch[1].trim() || "נושא חדש",
        description: "",
        instructions: "",
        items: []
      };
      continue;
    }

    if (!currentSubject) {
      currentSubject = {
        id: `subject_default_${Date.now()}`,
        title: defaultType === "image" ? "תמונות ומוצרים" : "סרטוני וידאו",
        description: "",
        instructions: "",
        items: []
      };
    }

    // 2. Subject attributes
    if (!currentItem && trimmed.startsWith("- תיאור:") && !trimmed.includes("|")) {
      currentSubject.description = trimmed.replace(/^- תיאור:\s*/, "").trim();
      continue;
    }

    if (!currentItem && trimmed.startsWith("- הנחיות:")) {
      currentSubject.instructions = trimmed.replace(/^- הנחיות:\s*/, "").trim();
      continue;
    }

    // 3. Single direct image line format:
    // - תמונה להוראות הגעה: https://...
    // - תמונה: https://...
    const directImageMatch = trimmed.match(/^-\s*(תמונה[^:]*|סרטון[^:]*):\s*(https?:\/\/[^\s]+)/);
    if (directImageMatch) {
      const rawTitle = directImageMatch[1].trim();
      const rawUrl = directImageMatch[2].trim();

      if (currentItem && !currentItem.url) {
        currentItem.url = rawUrl;
        currentItem.status = "success";
        if (rawTitle !== "תמונה" && rawTitle !== "סרטון" && (currentItem.title === "תמונה" || currentItem.title.startsWith("פריט") || currentItem.title.startsWith("תמונה/דגם"))) {
          currentItem.title = rawTitle;
        }
      } else {
        if (currentItem) {
          currentSubject.items.push(currentItem);
        }
        currentItem = {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: rawTitle,
          description: "",
          url: rawUrl,
          type: defaultType,
          status: "success",
          progress: 100
        };
      }
      continue;
    }

    // Link under direct image:
    if (currentItem && trimmed.match(/^-\s*קישור:\s*(https?:\/\/[^\s]+)/)) {
      const linkMatch = trimmed.match(/^-\s*קישור:\s*(https?:\/\/[^\s]+)/);
      if (linkMatch) {
        currentItem.linkUrl = linkMatch[1].trim();
        currentSubject.items.push(currentItem);
        currentItem = null;
        continue;
      }
    }

    if (trimmed.match(/^-\s*(דגמים זמינים|פריטים זמינים|תמונות|מוצרים):/)) {
      continue;
    }

  // 4. Item title header: 1. <title> or 2. <title> or - <title>
    const itemHeaderMatch = trimmed.match(/^(?:\d+\.|\-)\s*(.+)/);
    if (
      itemHeaderMatch &&
      !trimmed.startsWith("- תיאור:") &&
      !trimmed.startsWith("- תמונה") &&
      !trimmed.startsWith("- סרטון") &&
      !trimmed.startsWith("- קישור:") &&
      !trimmed.startsWith("- הנחיות:") &&
      !trimmed.startsWith("- דגמים") &&
      !trimmed.startsWith("- פריטים") &&
      !trimmed.startsWith("- מוצרים")
    ) {
      if (currentItem) {
        currentSubject.items.push(currentItem);
      }
      currentItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: itemHeaderMatch[1].trim(),
        description: "",
        url: "",
        linkUrl: "",
        type: defaultType,
        status: "idle",
        progress: 100
      };
      continue;
    }

    // Item fields under currentItem
    if (currentItem) {
      if (trimmed.startsWith("- תיאור:")) {
        currentItem.description = trimmed.replace(/^- תיאור:\s*/, "").trim();
        continue;
      }
      if (trimmed.startsWith("- תמונה:") || trimmed.startsWith("- וידאו:")) {
        const urlMatch = trimmed.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          currentItem.url = urlMatch[0];
          currentItem.status = "success";
        }
        continue;
      }
      if (trimmed.startsWith("- קישור:")) {
        const linkMatch = trimmed.match(/https?:\/\/[^\s]+/);
        if (linkMatch) {
          currentItem.linkUrl = linkMatch[0];
        }
        continue;
      }
    }

    // Legacy format fallback: - תיאור: [X] | הסבר: [Y] | קישור: [URL]
    const legacyMatch = trimmed.match(/- תיאור:\s*\[?(.*?)\]?\s*\|\s*הסבר:\s*\[?(.*?)\]?\s*\|\s*קישור:\s*\[?(https?:\/\/[^\s\]]+)\]?/);
    if (legacyMatch) {
      if (currentItem) {
        currentSubject.items.push(currentItem);
        currentItem = null;
      }
      currentSubject.items.push({
        id: `parsed_legacy_${i}_${Date.now()}`,
        title: legacyMatch[1].trim() || "מדיה",
        description: legacyMatch[2].trim() || "",
        url: legacyMatch[3].trim(),
        type: defaultType,
        status: "success",
        progress: 100
      });
      continue;
    }

    // Raw URL line fallback
    const rawUrlMatch = trimmed.match(/(https?:\/\/[^\s)]+)/);
    if (rawUrlMatch) {
      if (currentItem && !currentItem.url) {
        currentItem.url = rawUrlMatch[1];
        currentItem.status = "success";
      } else {
        if (currentItem) {
          currentSubject.items.push(currentItem);
        }
        let name = trimmed.replace(rawUrlMatch[1], "").replace(/^[-•*]\s*/, "").replace(/[():]/g, "").trim();
        if (!name) name = defaultType === "image" ? "תמונה" : "סרטון";
        currentItem = null;
        currentSubject.items.push({
          id: `parsed_url_${i}_${Date.now()}`,
          title: name,
          description: "",
          url: rawUrlMatch[1],
          type: defaultType,
          status: "success",
          progress: 100
        });
      }
    }
  }

  if (currentItem && currentSubject) {
    currentSubject.items.push(currentItem);
  }
  if (currentSubject && (currentSubject.items.length > 0 || currentSubject.title || currentSubject.description)) {
    subjects.push(currentSubject);
  }

function normalizeSubjectItems(items: SubjectItem[]): SubjectItem[] {
  if (items.length === 0) return items;

  const itemMap = items.map(i => ({ ...i }));
  const result: SubjectItem[] = [];

  for (let i = 0; i < itemMap.length; i++) {
    const item = itemMap[i];
    if (!item) continue;

    // If item has no URL, check if there's a subsequent item with a URL to merge into it
    if (!item.url) {
      const mergeIdx = itemMap.findIndex((other, idx) => idx > i && !!other && !!other.url);
      if (mergeIdx !== -1) {
        const other = itemMap[mergeIdx];
        item.url = other.url;
        if (other.linkUrl && !item.linkUrl) item.linkUrl = other.linkUrl;
        if (other.status) item.status = other.status;
        if (other.errorMsg) item.errorMsg = other.errorMsg;
        if (other.title && other.title !== "תמונה" && other.title !== "סרטון" && (item.title === "תמונה" || item.title.startsWith("פריט") || item.title.startsWith("תמונה/דגם"))) {
          item.title = other.title;
        }
        itemMap[mergeIdx] = null as any;
      }
    }

    result.push(item);
  }

  // Filter out any leftover empty items if populated items exist in the subject
  const hasPopulated = result.some(i => !!i.url);
  if (hasPopulated) {
    return result.filter(i => !!i.url || (!!i.description && i.description.trim() !== ""));
  }

  return result;
}

  // Normalize items in all subjects: merge empty items with populated image items and strip ghost slots
  subjects.forEach(subj => {
    subj.items = normalizeSubjectItems(subj.items);
  });

  return subjects;
}

/**
 * Formats MediaSubject[] into clean Markdown text matching user specification
 */
export function formatSubjectsToText(subjects: MediaSubject[]): string {
  if (!subjects || subjects.length === 0) return "";

  return subjects
    .filter(subj => subj.title.trim() || subj.items.length > 0)
    .map(subj => {
      let result = `### נושא: ${subj.title.trim() || "נושא כללי"}\n`;
      if (subj.description && subj.description.trim()) {
        result += `- תיאור: ${subj.description.trim()}\n`;
      }
      if (subj.instructions && subj.instructions.trim()) {
        result += `- הנחיות: ${subj.instructions.trim()}\n`;
      }

      if (subj.items.length > 0) {
        // If single item formatted with "תמונה להוראות הגעה" style
        if (
          subj.items.length === 1 &&
          (subj.items[0].title.startsWith("תמונה להוראות הגעה") || subj.items[0].title === "תמונה") &&
          !subj.items[0].description
        ) {
          const item = subj.items[0];
          result += `- ${item.title.trim() || "תמונה להוראות הגעה"}: ${item.url}\n`;
          if (item.linkUrl && item.linkUrl.trim()) {
            result += ` - קישור: ${item.linkUrl.trim()}\n`;
          }
        } else {
          result += `- דגמים זמינים:\n`;
          subj.items.forEach((item, idx) => {
            const itemTitle = item.title.trim() || `פריט ${idx + 1}`;
            result += `  ${idx + 1}. ${itemTitle}\n`;
            if (item.description && item.description.trim()) {
              result += `     - תיאור: ${item.description.trim()}\n`;
            }
            if (item.url && item.url.trim()) {
              result += `     - תמונה: ${item.url.trim()}\n`;
            }
            if (item.linkUrl && item.linkUrl.trim()) {
              result += `     - קישור: ${item.linkUrl.trim()}\n`;
            }
          });
        }
      }

      return result;
    })
    .join("\n\n");
}

export const FirebaseMediaUploader: React.FC<FirebaseMediaUploaderProps> = ({
  mediaType,
  title,
  value,
  onChange,
  isReadonly = false
}) => {
  const [subjects, setSubjects] = useState<MediaSubject[]>(() => parseValueToSubjects(value, mediaType));
  const [fbConfig, setFbConfig] = useState<FirebaseConfig>(getStoredFirebaseConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null);
  const [showGlobalGallery, setShowGlobalGallery] = useState(false);
  const [targetSubjectForGlobal, setTargetSubjectForGlobal] = useState<string | null>(null);
  const [globalPool, setGlobalPool] = useState<MediaItem[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [draggingSubjectId, setDraggingSubjectId] = useState<string | null>(null);
  const [pasteModalSubjectId, setPasteModalSubjectId] = useState<string | null>(null);
  const [pasteInputText, setPasteInputText] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const subjectInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const itemInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const lastPasteTimeRef = useRef<number>(0);
  const lastPastedKeyRef = useRef<{ key: string; time: number }>({ key: "", time: 0 });

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Sync external value changes into subjects state safely
  useEffect(() => {
    const formatted = formatSubjectsToText(subjects);
    if (value !== formatted) {
      // Check if any subject has active uploads in progress
      const hasUploading = subjects.some(s => s.items.some(i => i.status === "uploading"));
      if (!hasUploading) {
        const parsed = parseValueToSubjects(value, mediaType);
        if (parsed.length > 0) {
          setSubjects(parsed);
        }
      }
    }
  }, [value, mediaType]);

  // Update subjects and call onChange with formatted markdown text
  const updateSubjectsAndParent = (newSubjects: MediaSubject[]) => {
    setSubjects(newSubjects);
    const formatted = formatSubjectsToText(newSubjects);
    onChange(formatted);
  };

  const handleAddSubject = () => {
    const newSubjId = `subject_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newSubj: MediaSubject = {
      id: newSubjId,
      title: "נושא חדש",
      description: "",
      instructions: "",
      items: []
    };
    const next = [...subjects, newSubj];
    updateSubjectsAndParent(next);
    setActiveSubjectId(newSubjId);

    setTimeout(() => {
      const inputEl = subjectInputRefs.current[newSubjId];
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
        inputEl.focus();
        inputEl.select();
      }
    }, 120);
  };

  const handleRemoveSubject = (subjectId: string) => {
    const targetSubj = subjects.find(s => s.id === subjectId);
    if (!targetSubj) return;

    const next = subjects.filter(s => s.id !== subjectId);
    updateSubjectsAndParent(next);
    setToastMsg("הנושא נמחק בהצלחה");
  };

  const handleSubjectChange = (subjectId: string, field: "title" | "description" | "instructions", val: string) => {
    const next = subjects.map(s => {
      if (s.id === subjectId) {
        return { ...s, [field]: val };
      }
      return s;
    });
    updateSubjectsAndParent(next);
  };

  const handleAddItemToSubject = (subjectId: string) => {
    const newItemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const next = subjects.map(s => {
      if (s.id === subjectId) {
        const newItem: SubjectItem = {
          id: newItemId,
          title: `תמונה ${s.items.length + 1}`,
          description: "",
          url: "",
          linkUrl: "",
          type: mediaType,
          status: "idle",
          progress: 100
        };
        return { ...s, items: [...s.items, newItem] };
      }
      return s;
    });
    updateSubjectsAndParent(next);

    setTimeout(() => {
      const inputEl = itemInputRefs.current[newItemId];
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: "smooth", block: "center" });
        inputEl.focus();
        inputEl.select();
      }
    }, 120);
  };

  const handleRemoveItem = (subjectId: string, itemId: string) => {
    const next = subjects.map(s => {
      if (s.id === subjectId) {
        return { ...s, items: s.items.filter(i => i.id !== itemId) };
      }
      return s;
    });
    updateSubjectsAndParent(next);
  };

  const handleItemFieldChange = (
    subjectId: string,
    itemId: string,
    field: "title" | "description" | "url" | "linkUrl",
    val: string
  ) => {
    const next = subjects.map(s => {
      if (s.id === subjectId) {
        const updatedItems = s.items.map(i => {
          if (i.id === itemId) {
            return {
              ...i,
              [field]: val,
              status: field === "url" && val ? "success" : i.status
            };
          }
          return i;
        });
        return { ...s, items: updatedItems };
      }
      return s;
    });
    updateSubjectsAndParent(next);

    if (field === "url" && val && !val.startsWith("blob:")) {
      const targetItem = next.flatMap(s => s.items).find(i => i.id === itemId);
      if (targetItem) {
        addToGlobalMediaPool({
          name: targetItem.title,
          description: targetItem.description,
          url: targetItem.url,
          type: mediaType
        });
      }
    }
  };

  // Upload file, base64 data, or image URL for a specific item under a subject
  const processFileUploadForItem = (input: File | string, subjectId: string, existingItemId?: string) => {
    let fileType: "image" | "video" = "image";
    let fileNameClean = "תמונה שהודבקה";
    let localObjectUrl = "";

    if (typeof input !== "string") {
      const isVideo = input.type.startsWith("video/") || input.name.match(/\.(mp4|webm|mov)$/i);
      fileType = isVideo ? "video" : "image";
      fileNameClean = input.name.replace(/\.[^/.]+$/, "");
      localObjectUrl = URL.createObjectURL(input);
    } else {
      const trimmed = input.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        fileNameClean = "תמונה מקישור";
      } else if (trimmed.startsWith("data:image/")) {
        fileNameClean = "תמונה מודבקת (Base64)";
      }
    }

    let targetItemId = existingItemId;
    if (!targetItemId) {
      const targetSubj = subjects.find(s => s.id === subjectId);
      const emptyItem = targetSubj?.items.find(i => !i.url && i.status !== "uploading");
      if (emptyItem) {
        targetItemId = emptyItem.id;
        setSubjects(prev => prev.map(s => {
          if (s.id === subjectId) {
            return {
              ...s,
              items: s.items.map(i => i.id === targetItemId ? {
                ...i,
                title: (i.title.startsWith("תמונה/דגם") || i.title === "תמונה" || i.title.startsWith("תמונה מודבקת")) ? fileNameClean : i.title,
                status: "uploading",
                progress: 10
              } : i)
            };
          }
          return s;
        }));
      } else {
        targetItemId = `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newItem: SubjectItem = {
          id: targetItemId,
          title: fileNameClean,
          description: `תמונה מועלית עבור הנושא`,
          url: "",
          linkUrl: "",
          type: fileType,
          progress: 10,
          status: "uploading"
        };
        setSubjects(prev => prev.map(s => {
          if (s.id === subjectId) {
            return { ...s, items: [...s.items, newItem] };
          }
          return s;
        }));
      }
    } else {
      setSubjects(prev => prev.map(s => {
        if (s.id === subjectId) {
          return {
            ...s,
            items: s.items.map(i => i.id === targetItemId ? { ...i, status: "uploading", progress: 10 } : i)
          };
        }
        return s;
      }));
    }

    const finishUpload = (finalUrl: string, thumbUrl?: string, errorText?: string) => {
      const isBlob = finalUrl.startsWith("blob:");
      const status = isBlob ? ("error" as const) : ("success" as const);
      const err = isBlob
        ? "⚠️ שגיאה בהעלאת הקובץ. אנא נסה שנית."
        : errorText;

      setSubjects(prev => {
        const next = prev.map(s => {
          if (s.id === subjectId) {
            const updatedItems = s.items.map(i => {
              if (i.id === targetItemId) {
                return {
                  ...i,
                  url: finalUrl,
                  thumbUrl: thumbUrl || finalUrl,
                  status,
                  progress: 100,
                  errorMsg: err
                };
              }
              return i;
            });
            return { ...s, items: updatedItems };
          }
          return s;
        });
        const formatted = formatSubjectsToText(next);
        onChange(formatted);
        return next;
      });

      if (finalUrl && !isBlob) {
        addToGlobalMediaPool({
          name: fileNameClean,
          description: "תמונה שהועלתה (ImgBB)",
          url: finalUrl,
          type: fileType
        });
      }
    };

    // ImgBB Upload integration (Primary Upload Service)
    const uploadToImgBBDirect = async (inputObj: File | string): Promise<boolean> => {
      try {
        const formData = new FormData();
        if (typeof inputObj === "string") {
          let cleanInput = inputObj.trim();
          if (cleanInput.startsWith("data:image/")) {
            cleanInput = cleanInput.split(",")[1] || cleanInput;
          }
          formData.append("image", cleanInput);
        } else {
          formData.append("image", inputObj);
        }

        const resp = await fetch(
          "https://api.imgbb.com/1/upload?expiration=15552000&key=bb5133b78a888bdda2f9a761b36b6476",
          {
            method: "POST",
            body: formData
          }
        );

        const data = await resp.json();
        if (data && data.success && data.data) {
          const mainUrl = data.data.url;
          const thumbUrl = data.data.thumb?.url || data.data.display_url || data.data.url;
          finishUpload(mainUrl, thumbUrl);
          return true;
        }
      } catch (e) {
        console.warn("Direct ImgBB fetch failed, fallback to server upload proxy:", e);
      }
      return false;
    };

    const uploadViaServer = (inputObj: File | string) => {
      if (typeof inputObj === "string") {
        fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: "pasted_image.png", base64: inputObj })
        })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.url) {
              finishUpload(data.url, data.thumbUrl || data.displayUrl || data.url);
            } else {
              finishUpload(typeof input === "string" && input.startsWith("http") ? input : (localObjectUrl || ""), undefined, "⚠️ שגיאה בהעלאה לשרת.");
            }
          })
          .catch(() => {
            finishUpload(typeof input === "string" && input.startsWith("http") ? input : (localObjectUrl || ""), undefined, "⚠️ שגיאה בהעלאה לשרת.");
          });
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Str = reader.result as string;
          const resp = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: inputObj.name, base64: base64Str })
          });
          const data = await resp.json();
          if (data.success && data.url) {
            finishUpload(data.url, data.thumbUrl || data.displayUrl || data.url);
            return;
          }
        } catch (e) {
          console.error("Server upload fetch error", e);
        }
        finishUpload(localObjectUrl, undefined, "⚠️ שגיאה בהעלאה לשרת.");
      };
      reader.onerror = () => finishUpload(localObjectUrl, undefined, "⚠️ שגיאה בקריאת הקובץ.");
      reader.readAsDataURL(inputObj);
    };

    // Execute ImgBB upload
    (async () => {
      const success = await uploadToImgBBDirect(input);
      if (!success) {
        uploadViaServer(input);
      }
    })();
  };

  // Helper to trigger upload and show toast with deduplication guard
  const triggerPasteForSubject = (subjectId: string, input: File | string) => {
    const now = Date.now();
    const inputKey = typeof input === "string" 
      ? input.slice(0, 150) 
      : `${input.name}_${input.size}_${input.type}`;

    if (
      now - lastPasteTimeRef.current < 1200 || 
      (lastPastedKeyRef.current.key === inputKey && now - lastPastedKeyRef.current.time < 3000)
    ) {
      console.log("Ignored duplicate paste event");
      return;
    }

    lastPasteTimeRef.current = now;
    lastPastedKeyRef.current = { key: inputKey, time: now };

    processFileUploadForItem(input, subjectId);
    setToastMsg("תמונה שהודבקה נקלטה בהצלחה ומועלת לשרת...");
    setPasteModalSubjectId(null);
    setPasteInputText("");
  };

  // Global Window Paste Listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const targetSubjId = activeSubjectId || subjects[0]?.id;
      if (!targetSubjId) return;

      const activeEl = document.activeElement;
      const isEditingField = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // 1. Check Files
      if (clipboardData.files && clipboardData.files.length > 0) {
        const imgFiles = Array.from(clipboardData.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
        if (imgFiles.length > 0) {
          e.preventDefault();
          triggerPasteForSubject(targetSubjId, imgFiles[0]);
          return;
        }
      }

      // 2. Check Blobs/Items
      if (clipboardData.items) {
        for (const item of Array.from(clipboardData.items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              triggerPasteForSubject(targetSubjId, file);
              return;
            }
          }
        }
      }

      // 3. Check Text (Base64 or URL) - skip if user is typing in standard text inputs
      if (!isEditingField) {
        const text = clipboardData.getData("text/plain")?.trim();
        if (text) {
          const isBase64 = text.startsWith("data:image/") || (/^[A-Za-z0-9+/=]{100,}$/.test(text) && !text.includes(" "));
          const isUrl = /^https?:\/\/.+/i.test(text);
          if (isBase64 || isUrl) {
            e.preventDefault();
            triggerPasteForSubject(targetSubjId, text);
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [subjects, activeSubjectId]);

  // Clipboard Paste Handlers for specific dropzone element
  const handlePasteFromClipboard = (e: React.ClipboardEvent | ClipboardEvent, subjectId: string) => {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();

    const clipboardData = (e as React.ClipboardEvent).clipboardData || (e as ClipboardEvent).clipboardData;
    if (!clipboardData) return;

    // 1. Image or video files in clipboard
    if (clipboardData.files && clipboardData.files.length > 0) {
      const imageFiles = Array.from(clipboardData.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
      if (imageFiles.length > 0) {
        triggerPasteForSubject(subjectId, imageFiles[0]);
        return;
      }
    }

    // 2. Clipboard items (blobs)
    if (clipboardData.items) {
      for (const item of Array.from(clipboardData.items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            triggerPasteForSubject(subjectId, file);
            return;
          }
        }
      }
    }

    // 3. Pasted Text (Base64 or Image URL)
    const text = clipboardData.getData("text/plain")?.trim();
    if (text) {
      const isBase64 = text.startsWith("data:image/") || (/^[A-Za-z0-9+/=]{100,}$/.test(text) && !text.includes(" "));
      const isUrl = /^https?:\/\/.+/i.test(text);
      if (isBase64 || isUrl) {
        triggerPasteForSubject(subjectId, text);
      }
    }
  };

  const handlePasteButtonClick = async (subjectId: string) => {
    let handled = false;

    // 1. Direct Clipboard API read (Raw images / files)
    if (navigator.clipboard && typeof navigator.clipboard.read === "function") {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], `pasted_image_${Date.now()}.${imageType.split("/")[1] || 'png'}`, { type: imageType });
            triggerPasteForSubject(subjectId, file);
            handled = true;
            break;
          }
        }
      } catch (err) {
        console.warn("Direct clipboard.read blocked:", err);
      }
    }

    // 2. Clipboard text read (Base64 / URL)
    if (!handled && navigator.clipboard && typeof navigator.clipboard.readText === "function") {
      try {
        const text = await navigator.clipboard.readText();
        const trimmed = text?.trim();
        if (trimmed) {
          const isBase64 = trimmed.startsWith("data:image/") || (/^[A-Za-z0-9+/=]{100,}$/.test(trimmed) && !trimmed.includes(" "));
          const isUrl = /^https?:\/\//i.test(trimmed);
          if (isBase64 || isUrl) {
            triggerPasteForSubject(subjectId, trimmed);
            handled = true;
          }
        }
      } catch (err) {
        console.warn("Direct clipboard.readText blocked:", err);
      }
    }

    // 3. Fallback to dedicated paste window modal if direct reading was blocked
    if (!handled) {
      setPasteModalSubjectId(subjectId);
      setPasteInputText("");
    }
  };

  const handleLoadSampleSubjects = () => {
    const sampleSubjects: MediaSubject[] = [
      {
        id: `sample_subj_1_${Date.now()}`,
        title: "הוראות הגעה ומיקום",
        description: "הקליניקה ממוקמת ברחוב הרצל 1, תל אביב.",
        instructions: "קומה 2, יש מעלית ונגישות מלאה.",
        items: [
          {
            id: `sample_item_1_${Date.now()}`,
            title: "תמונה להוראות הגעה",
            description: "",
            url: "https://smart-sense-core.lovable.app/__l5e/assets-v1/e8ae03f4-9209-4a98-938a-070ac85ab4f4/directions.png",
            linkUrl: "https://smart-sense-core.lovable.app",
            type: "image",
            status: "success",
            progress: 100
          }
        ]
      },
      {
        id: `sample_subj_2_${Date.now()}`,
        title: "מסגרות משקפיים ומוצרים",
        description: "קטלוג מסגרות המשקפיים הזמינות במלאי.",
        instructions: "",
        items: [
          {
            id: `sample_item_2_${Date.now()}`,
            title: "מסגרת קלאסית שחורה",
            description: "טיטניום קלה ועמידה",
            url: "https://smart-sense-core.lovable.app/__l5e/assets-v1/e8ae03f4-9209-4a98-938a-070ac85ab4f4/directions.png",
            linkUrl: "https://smart-sense-core.lovable.app",
            type: "image",
            status: "success",
            progress: 100
          },
          {
            id: `sample_item_3_${Date.now()}`,
            title: "מסגרת שקופה מודרנית",
            description: "אצטט בסגנון עכשווי",
            url: "https://smart-sense-core.lovable.app/__l5e/assets-v1/e8ae03f4-9209-4a98-938a-070ac85ab4f4/directions.png",
            linkUrl: "https://smart-sense-core.lovable.app",
            type: "image",
            status: "success",
            progress: 100
          },
          {
            id: `sample_item_4_${Date.now()}`,
            title: "מסגרת מיוחדת שאין לאף אחד",
            description: "אצטט בסגנון עכשווי",
            url: "https://smart-sense-core.lovable.app/__l5e/assets-v1/e8ae03f4-9209-4a98-938a-070ac85ab4f4/directions.png",
            linkUrl: "https://smart-sense-core.lovable.app",
            type: "image",
            status: "success",
            progress: 100
          }
        ]
      }
    ];

    updateSubjectsAndParent(sampleSubjects);
  };

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopySuccessId(id);
    setTimeout(() => setCopySuccessId(null), 2000);
  };

  const handleSelectFromGlobalPool = (poolItem: MediaItem) => {
    if (!targetSubjectForGlobal) return;
    const targetSubj = subjects.find(s => s.id === targetSubjectForGlobal);
    if (!targetSubj) return;

    const emptyItemIndex = targetSubj.items.findIndex(i => !i.url);

    if (emptyItemIndex !== -1) {
      const next = subjects.map(s => {
        if (s.id === targetSubjectForGlobal) {
          const updatedItems = [...s.items];
          const existing = updatedItems[emptyItemIndex];
          updatedItems[emptyItemIndex] = {
            ...existing,
            url: poolItem.url,
            title: (existing.title.startsWith("תמונה/דגם") || existing.title === "תמונה") ? (poolItem.name || existing.title) : existing.title,
            description: existing.description || poolItem.description || "",
            status: "success",
            progress: 100
          };
          return { ...s, items: updatedItems };
        }
        return s;
      });
      updateSubjectsAndParent(next);
    } else {
      const newItem: SubjectItem = {
        id: `item_global_${Date.now()}`,
        title: poolItem.name || `תמונה ${targetSubj.items.length + 1}`,
        description: poolItem.description || "",
        url: poolItem.url,
        linkUrl: "",
        type: poolItem.type || mediaType,
        status: "success",
        progress: 100
      };

      const next = subjects.map(s => {
        if (s.id === targetSubjectForGlobal) {
          return { ...s, items: [...s.items, newItem] };
        }
        return s;
      });

      updateSubjectsAndParent(next);
    }

    setShowGlobalGallery(false);
    setTargetSubjectForGlobal(null);
  };

  const totalItemsCount = subjects.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="flex flex-col gap-4 bg-[#0a0c14] border border-slate-800 rounded-2xl p-4 sm:p-5" dir="rtl">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-gradient-to-tr from-emerald-500/20 to-sky-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl shadow-sm">
            {mediaType === "image" ? <ImageIcon className="w-5 h-5" /> : <Film className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>{title} — ניהול תמונות ומוצרים לפי נושאים</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                {subjects.length} נושאים | {totalItemsCount} תמונות
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              שיוך תמונות, תיאורים וקישורים לפי נושאים ספציפיים להבנה מדויקת של סוכן ה-AI
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleLoadSampleSubjects}
            className="px-3 py-1.5 bg-[#12182b] hover:bg-[#1a233d] text-sky-300 border border-sky-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
            title="טען מבנה דוגמה עם נושאים ותמונות"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>✨ טען מבנה דוגמה (נושאים + תמונות)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition cursor-pointer"
            title="הגדרות Firebase Storage"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top Action Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#06070c] p-3 rounded-xl border border-slate-850">
        <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
          <FolderPlus className="w-4 h-4 text-emerald-400" />
          <span>נושאים וקטלוגים ({subjects.length})</span>
        </span>

        {!isReadonly && (
          <button
            type="button"
            onClick={handleAddSubject}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>הוסף נושא חדש 📂</span>
          </button>
        )}
      </div>

      {/* Subjects List */}
      {subjects.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-[#07080d] flex flex-col items-center gap-3">
          <div className="p-3 bg-slate-900 rounded-full text-slate-500">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-1 text-center">
            <span className="text-sm font-black text-white">עדיין לא הוגדרו נושאים לתמונות</span>
            <span className="text-xs text-slate-400">
              לחץ על "הוסף נושא חדש" או "טען מבנה דוגמה" כדי לשייך תמונות, דגמים וקישורים לפי נושאים ספציפיים.
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleAddSubject}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              + הוסף נושא ראשון
            </button>
            <button
              type="button"
              onClick={handleLoadSampleSubjects}
              className="px-4 py-2 bg-sky-900/40 hover:bg-sky-800/60 text-sky-200 border border-sky-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              ✨ טען מבנה דוגמה מוכן
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {subjects.map((subj, subjIdx) => (
            <div
              key={subj.id}
              className="bg-[#0c0e18] border border-slate-800 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-lg transition"
            >
              {/* Subject Title Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#111322] p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2.5 flex-1 w-full">
                  <span className="text-xs font-black bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-lg shrink-0 shadow-sm">
                    נושא {subjIdx + 1}
                  </span>
                  
                  <input
                    ref={(el) => { subjectInputRefs.current[subj.id] = el; }}
                    type="text"
                    value={subj.title}
                    onChange={(e) => handleSubjectChange(subj.id, "title", e.target.value)}
                    placeholder="כותרת הנושא (לדוגמה: מסגרות משקפיים ומוצרים / הוראות הגעה)"
                    className="flex-1 px-3 py-2 bg-[#060810] border border-slate-700 rounded-xl text-xs sm:text-sm font-black text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                    disabled={isReadonly}
                  />
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-[11px] font-bold text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                    {subj.items.length} תמונות
                  </span>

                  {!isReadonly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSubject(subj.id);
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-300 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow font-bold text-xs"
                      title="מחק נושא זה"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 stroke-[2.5]" />
                      <span className="font-black text-red-600">מחק</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Subject Drag & Drop Upload Zone */}
              {!isReadonly && (
                <div
                  tabIndex={0}
                  onPaste={(e) => handlePasteFromClipboard(e, subj.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggingSubjectId(subj.id);
                  }}
                  onDragLeave={() => setDraggingSubjectId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingSubjectId(null);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      Array.from(e.dataTransfer.files).forEach(f => {
                        processFileUploadForItem(f, subj.id);
                      });
                    }
                  }}
                  className={`border-2 border-dashed rounded-lg p-2.5 text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500/50 ${
                    draggingSubjectId === subj.id
                      ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]"
                      : "border-slate-800 hover:border-emerald-500/40 bg-[#07080f] hover:bg-[#0b0e1a]"
                  }`}
                  onClick={() => fileInputRefs.current[subj.id]?.click()}
                >
                  <input
                    ref={el => { fileInputRefs.current[subj.id] = el; }}
                    type="file"
                    multiple
                    accept={mediaType === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4,video/webm"}
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) {
                        Array.from(e.target.files).forEach(f => {
                          processFileUploadForItem(f, subj.id);
                        });
                      }
                    }}
                  />
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 flex-wrap justify-center">
                    <Upload className="w-3.5 h-3.5 animate-bounce" />
                    <span>גרור תמונה לכאן, לחץ לבחירת קובץ, או הדבק תמונה מהלוח עבור "{subj.title || 'נושא'}"</span>
                  </div>
                </div>
              )}

              {/* Items / Images under this Subject */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-end border-b border-slate-850 pb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!isReadonly && (
                      <button
                        type="button"
                        onClick={() => handlePasteButtonClick(subj.id)}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md text-[11px] font-black transition flex items-center gap-1 cursor-pointer shadow-sm"
                        title="הדבק תמונה מהלוח"
                      >
                        <Clipboard className="w-3.5 h-3.5 text-slate-950" />
                        <span>הדבק תמונה</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setGlobalPool(getGlobalMediaPool());
                        setTargetSubjectForGlobal(subj.id);
                        setShowGlobalGallery(true);
                      }}
                      className="px-2.5 py-1 bg-teal-700 hover:bg-teal-600 text-white border border-teal-400/50 rounded-md text-[11px] font-black transition flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-white" />
                      <span>גלרייה גלובלית</span>
                    </button>

                    {!isReadonly && (
                      <button
                        type="button"
                        onClick={() => handleAddItemToSubject(subj.id)}
                        className="px-2.5 py-1 bg-sky-950/80 hover:bg-sky-900 text-sky-200 border border-sky-500/30 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>הוסף תמונה</span>
                      </button>
                    )}
                  </div>
                </div>

                {subj.items.length === 0 ? (
                  <div className="p-4 text-center border border-slate-850 rounded-xl bg-[#06070b] text-slate-500 text-xs font-semibold">
                    טרם שוייכו תמונות לנושא זה. העלה קובץ או לחץ על "הוסף תמונה".
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {subj.items.map((item, itemIdx) => (
                      <div
                        key={item.id}
                        className="p-3.5 bg-[#080911] border border-slate-800/80 hover:border-slate-700 rounded-xl flex flex-col md:flex-row items-start gap-4 transition shadow-sm"
                      >
                        {/* Image Preview Thumbnail & Upload Overlay */}
                        <div className="w-full md:w-36 h-28 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative group">
                          {item.status === "uploading" ? (
                            <div className="w-full h-full bg-[#060811] border border-slate-700 rounded-xl flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                              <span className="animate-spin w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full" />
                              <span className="text-[11px] font-black text-white">
                                {item.progress}%
                              </span>
                            </div>
                          ) : item.url ? (
                            item.type === "video" ? (
                              <div className="w-full h-full relative flex items-center justify-center bg-slate-900">
                                <video src={item.url} className="w-full h-full object-cover" />
                                <Play className="w-6 h-6 text-white absolute opacity-80" />
                              </div>
                            ) : (
                              <img
                                src={item.thumbUrl || item.url}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  if (item.thumbUrl && (e.target as HTMLImageElement).src !== item.url) {
                                    (e.target as HTMLImageElement).src = item.url;
                                  } else {
                                    (e.target as HTMLElement).style.display = "none";
                                  }
                                }}
                              />
                            )
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1 p-2 text-center text-slate-600">
                              <ImageIcon className="w-6 h-6" />
                              <span className="text-[10px] font-bold">אין תמונה</span>
                            </div>
                          )}

                          {/* Quick File Replace Button Overlay */}
                          {!isReadonly && (
                            <label
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition cursor-pointer"
                              title="החלף תמונה מקובץ"
                            >
                              <span>📷 החלף קובץ</span>
                              <input
                                type="file"
                                accept={mediaType === "image" ? "image/*" : "video/*"}
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) processFileUploadForItem(f, subj.id, item.id);
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Item Fields: Title, Description, Image URL, Link URL */}
                        <div className="flex-1 w-full flex flex-col gap-2">
                          {/* Item Title & Index */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold bg-slate-900 text-sky-400 border border-slate-800 px-2 py-1 rounded-md shrink-0">
                              #{itemIdx + 1}
                            </span>
                            <input
                              ref={(el) => { itemInputRefs.current[item.id] = el; }}
                              type="text"
                              value={item.title}
                              onChange={(e) => handleItemFieldChange(subj.id, item.id, "title", e.target.value)}
                              placeholder="כותרת תמונה (לדוגמה: מסגרת קלאסית שחורה)"
                              className="flex-1 px-3 py-1.5 bg-slate-950 text-white border border-slate-800 rounded-lg text-xs font-bold placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                              disabled={isReadonly}
                            />
                            {!isReadonly && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(subj.id, item.id)}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg transition cursor-pointer shrink-0"
                                title="מחק פריט זה"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Item Description */}
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemFieldChange(subj.id, item.id, "description", e.target.value)}
                            placeholder="תיאור הפריט (לדוגמה: טיטניום קלה ועמידה)"
                            className="w-full px-3 py-1.5 bg-slate-950 text-slate-200 border border-slate-800 rounded-lg text-xs font-medium placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                            disabled={isReadonly}
                          />

                          {/* Image URL & Action Buttons */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-[#04060c] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-sky-300 font-mono overflow-hidden">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1.5" />
                              <input
                                type="text"
                                value={item.url}
                                onChange={(e) => handleItemFieldChange(subj.id, item.id, "url", e.target.value)}
                                placeholder="קישור תמונה (Firebase URL)"
                                className="w-full bg-transparent border-none text-sky-300 font-mono text-[11px] focus:outline-none"
                                dir="ltr"
                                disabled={isReadonly}
                              />
                            </div>

                            {item.url && (
                              <button
                                type="button"
                                onClick={() => handleCopyUrl(item.id, item.url)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                                title="העתק קישור תמונה"
                              >
                                {copySuccessId === item.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>

                          {/* Link URL (קישור לפרטים נוספים) */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-[#04060c] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-mono overflow-hidden">
                              <Link className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1.5" />
                              <input
                                type="text"
                                value={item.linkUrl || ""}
                                onChange={(e) => handleItemFieldChange(subj.id, item.id, "linkUrl", e.target.value)}
                                placeholder="קישור לפרטים נוספים (לדוגמה: https://smart-sense-core.lovable.app)"
                                className="w-full bg-transparent border-none text-emerald-300 font-mono text-[11px] focus:outline-none"
                                dir="ltr"
                                disabled={isReadonly}
                              />
                            </div>
                            {item.linkUrl && (
                              <a
                                href={item.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition shrink-0"
                                title="פתח קישור בחלון חדש"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!isReadonly && (
            <div className="flex justify-center pt-2 pb-1">
              <button
                type="button"
                onClick={handleAddSubject}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-lg hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>הוסף נושא נוסף 📂</span>
              </button>
            </div>
          )}
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
                onClick={() => {
                  setShowGlobalGallery(false);
                  setTargetSubjectForGlobal(null);
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
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
                {globalPool.map((gItem) => (
                  <div
                    key={gItem.id}
                    className="p-3 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl flex items-center gap-3 transition"
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
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shrink-0 cursor-pointer"
                    >
                      הוסף לנושא
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowGlobalGallery(false);
                  setTargetSubjectForGlobal(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Paste Modal Window */}
      {pasteModalSubjectId && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPasteModalSubjectId(null)}
        >
          <div
            className="bg-[#0b0f19] border border-amber-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 text-right"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Clipboard className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>הדבקת תמונה מהלוח</span>
              </div>
              <button
                type="button"
                onClick={() => setPasteModalSubjectId(null)}
                className="text-slate-400 hover:text-white text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              התמונה תתווסף לנושא:{" "}
              <strong className="text-emerald-400">
                {subjects.find((s) => s.id === pasteModalSubjectId)?.title || "נושא נוכחי"}
              </strong>
            </p>

            {/* Interactive Drop / Paste Zone */}
            <div
              tabIndex={0}
              autoFocus
              onPaste={(e) => {
                handlePasteFromClipboard(e, pasteModalSubjectId);
              }}
              className="border-2 border-dashed border-amber-400/80 bg-amber-950/20 rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2.5 cursor-pointer transition hover:bg-amber-950/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Clipboard className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-amber-200">לחץ כאן והדבק (Ctrl + V)</p>
                <p className="text-[11px] text-slate-400">
                  הדבק תמונה, קורפ/צילום מסך, קישור (URL) או קוד Base64
                </p>
              </div>
            </div>

            {/* Textarea for URL / Base64 Paste */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">
                או הדבק קישור / Base64 בתיבה זו:
              </label>
              <textarea
                value={pasteInputText}
                onChange={(e) => {
                  const val = e.target.value;
                  setPasteInputText(val);
                  if (val.trim()) {
                    triggerPasteForSubject(pasteModalSubjectId, val.trim());
                  }
                }}
                onPaste={(e) => {
                  handlePasteFromClipboard(e, pasteModalSubjectId);
                }}
                placeholder="הדבק כאן קישור תמונה או Base64..."
                className="w-full h-16 bg-slate-900 border border-slate-750 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 resize-none dir-ltr"
              />
            </div>

            <div className="flex items-center justify-end border-t border-slate-800 pt-2.5">
              <button
                type="button"
                onClick={() => setPasteModalSubjectId(null)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfigModal && (
        <FirebaseConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] bg-emerald-600 text-white font-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-xs animate-bounce dir-rtl">
          <Check className="w-4 h-4 text-emerald-200" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};

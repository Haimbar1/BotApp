import { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Send, 
  Check, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Copy, 
  Sparkles, 
  User, 
  Building, 
  Smartphone, 
  Key, 
  Eye, 
  Save, 
  EyeOff, 
  BookOpen, 
  FileText, 
  List, 
  CheckCircle, 
  Search,
  ExternalLink,
  Lock,
  Unlock,
  RefreshCw,
  LogOut,
  Shield,
  X,
  Download,
  Terminal,
  Clock,
  Mail,
  ArrowRight,
  Globe,
  Phone,
  Zap,
  Paperclip,
  Sun,
  Moon,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import { promptTemplates, PromptTemplate } from "./templates";
import SmartBusinessLogo from "./components/SmartBusinessLogo";
import CountryPhoneInput from "./components/CountryPhoneInput";

// Safe API Fetch Wrapper with intelligent CORS Proxy routing for production domains (such as app.smartesek.com or smartesek.co.il)
const apiFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let urlString = "";
  if (typeof input === "string") {
    urlString = input;
  } else if (input instanceof URL) {
    urlString = input.href;
  } else if (input && typeof input === "object" && "url" in input) {
    urlString = input.url;
  }

  if (urlString.startsWith("/api/")) {
    const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
    const isVercel = currentHost.includes("vercel.app");
    const disableRedirect = import.meta.env.VITE_DISABLE_API_REDIRECT === "true";

    // If hosted externally (like a static export on app.smartesek.com), dynamically route relative API paths to the AI Studio backend sandbox
    // For Vercel or when manually disabled, let the relative path handle its own requests.
    const isProductionCustomDomain = currentHost === "app.smartesek.com" || currentHost === "smartesek.co.il";

    if (
      !disableRedirect &&
      !isVercel &&
      (isProductionCustomDomain ||
       (currentHost &&
        !currentHost.includes("localhost") &&
        !currentHost.includes("127.0.0.1") &&
        !currentHost.includes("run.app") &&
        !currentHost.includes("gitpod") &&
        !currentHost.includes("codesandbox") &&
        !currentHost.includes("vercel.app")))
    ) {
      const backendProdUrl = `https://service-1078804201809.us-west1.run.app${urlString}`;
    // const backendProdUrl = `https://ais-pre-yg5kl6qlbygmuujyeftsgb-57299413701.europe-west2.run.app${urlString}`;
      console.log(`[API INTERCEPTOR] Redirecting relative call ${urlString} -> ${backendProdUrl}`);
      
      const updatedInit = {
        ...init,
        credentials: init?.credentials || "include" as const
      };
      return fetch(backendProdUrl, updatedInit);
    }
  }
  return fetch(input, init);
};

interface AgentConfig {
  id: string;
  ownerName: string;
  businessName: string;
  ownerPhone: string;
  botId: string;
  whatsappInstance: string;
  businessPrompt: string;
  key: string;
  leadFollowUpDays?: string;
  lastSyncedAt?: string;
  botIdentity?: string;
  coursesInfo?: string;
  kidsCourses?: string;
  conversationFlow?: string;
  writingStyle?: string;
  faqAnswers?: string;
  whatNotToDo?: string;
  syllabusLinks?: string;
  humanEscalation?: string;
  imagesInfo?: string;
  videosInfo?: string;
  agentEmail?: string; // Associated email address for security and permissions
  status?: string;
  name?: string;
  agentType?: "sales" | "support";
}

const DEFAULT_WEBHOOK_URL = "https://n8n.srv1239769.hstgr.cloud/webhook/fa5a6796-71e0-44c8-9623-d0dd4791a0bb";

const RECOMMENDED_EMOJIS_BY_PART: Record<string, { label: string; emojis: string[] }[]> = {
  botIdentity: [
    { label: "🤖 זהות ונציגות", emojis: ["🤖", "🤵", "👩‍💼", "👤", "✨", "👑", "🛡️", "🌟", "💼", "🏢"] },
    { label: "💼 מטרות ועסקים", emojis: ["🎯", "💡", "🚀", "📢", "🤝", "✅", "🏷️", "🔥"] }
  ],
  coursesInfo: [
    { label: "🎓 לימודים וקורסים", emojis: ["📖", "🎓", "💻", "📚", "🏫", "📝", "🧠", "💡", "🧪", "🎨"] },
    { label: "💰 הצעות ומחירון", emojis: ["🏷️", "💰", "💵", "💳", "📈", "🎁", "🔥", "🥇", "💎"] }
  ],
  kidsCourses: [
    { label: "🧸 קהל יעד צעיר", emojis: ["👥", "👶", "👦", "👧", "🧒", "🧸", "🎮", "👾", "🧩", "🦄"] },
    { label: "👨‍👩‍👧‍👦 הורים ומשפחה", emojis: ["👨‍👩‍👧‍👦", "🎒", "🏫", "🏡", "🥛", "🍎", "🎈"] }
  ],
  conversationFlow: [
    { label: "👋 פתיחה וברכה שכיחה (שאלת פתיחה)", emojis: ["👋", "✨", "🌟", "🆕", "🎁", "💌", "🌸", "🤍", "😇"] },
    { label: "💬 זרימה ושלבי שיחה", emojis: ["💬", "🗺️", "🧭", "📍", "🏁", "🎯", "📥", "📤", "🚀", "📞", "🤝"] }
  ],
  writingStyle: [
    { label: "✍️ עימוד וניסוח", emojis: ["✍️", "📏", "✂️", "📌", "⚡", "🎯", "🔥", "👌", "🤩", "📢", "💬", "📱"] }
  ],
  faqAnswers: [
    { label: "❓ שאלות ותשובות", emojis: ["❓", "❔", "💡", "📑", "🧐", "📌", "🔍", "✅", "❌", "💬", "🤝", "💁"] }
  ],
  whatNotToDo: [
    { label: "⚠️ מגבלות ואיסורים", emojis: ["⚠️", "❌", "🚫", "⛔", "🛑", "🙅", "🚷", "🤐", "🤫", "😤", "📉", "🔕"] }
  ],
  syllabusLinks: [
    { label: "🔗 קישורים וסילבוסים", emojis: ["🔗", "📁", "📄", "🌐", "💻", "📱", "📥", "💾", "🔍", "⚡", "📍", "🗺️"] }
  ],
  humanEscalation: [
    { label: "📞 מעבר לנציג", emojis: ["📞", "📱", "🧑‍💻", "👑", "🛎️", "🤝", "💬", "🚨", "⏳", "🆘", "✉️", "📤"] }
  ],
  imagesInfo: [
    { label: "🖼️ תמונות וגלריה", emojis: ["🖼️", "📸", "🎨", "🌆", "✨", "📐", "💎", "🏡", "👔", "🛒"] }
  ],
  videosInfo: [
    { label: "🎥 סרטונים ווידאו", emojis: ["🎥", "📹", "🎬", "📺", "▶️", "👀", "🍿", "🎵", "🔊", "🌐"] }
  ]
};

let globalSaveTimeoutId: any = null;

export default function App() {
  // Authentication & Permission states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [sessionUser, setSessionUser] = useState<{ email: string; name: string; picture: string } | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [googleClientId, setGoogleClientId] = useState<string>("");
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [authError, setAuthError] = useState<string>("");
  
  // --- PUBLIC DEMO LANDING PAGE STATES ---
  const [isLandingPage, setIsLandingPage] = useState<boolean>(true);
  const [landingUrl, setLandingUrl] = useState<string>("");
  const [landingPhone, setLandingPhone] = useState<string>("");
  const [landingPhoneError, setLandingPhoneError] = useState<string>("");
  const [landingAgentName, setLandingAgentName] = useState<string>("חיים בר");
  const [landingAgentType, setLandingAgentType] = useState<"sales" | "support">("sales");
  const [landingAdditionalContext, setLandingAdditionalContext] = useState<string>("");
  const [fileLoading, setFileLoading] = useState<boolean>(false);
  const [dragOverDemo, setDragOverDemo] = useState<boolean>(false);
  const [isCreatingDemo, setIsCreatingDemo] = useState<boolean>(false);
  const [demoStep, setDemoStep] = useState<number>(0);
  const [demoResult, setDemoResult] = useState<any>(null);
  const [demoSubmitError, setDemoSubmitError] = useState<string>("");
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  
  // Custom helper to parse PDF files client-side using pdf.js loaded dynamically from public CDN
  const extractTextFromPdf = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 1. Ensure pdfjsLib is loaded
      if ((window as any).pdfjsLib) {
        proceedWithParsing((window as any).pdfjsLib);
      } else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
        script.onload = () => {
          const pdfjsLib = (window as any).pdfjsLib;
          if (pdfjsLib) {
            proceedWithParsing(pdfjsLib);
          } else {
            reject(new Error("שגיאה בטעינת ספריית קריאת קבצי PDF"));
          }
        };
        script.onerror = () => {
          reject(new Error("נכשלה טעינת מפענח ה-PDF מהשרת הציבורי. אנא ודא חיבור תקין לרשת."));
        };
        document.head.appendChild(script);
      }

      function proceedWithParsing(pdfjsLib: any) {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              const arrayBuffer = e.target?.result as ArrayBuffer;
              if (!arrayBuffer) {
                reject(new Error("קובץ ה-PDF ריק או פגום"));
                return;
              }

              const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
              const pdf = await loadingTask.promise;
              
              let fullText = "";
              const numPages = pdf.numPages;

              for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str)
                  .join(" ");
                fullText += pageText + "\n";
              }

              if (!fullText.trim()) {
                reject(new Error("לא ניתן היה לחלץ טקסט תקין מקובץ ה-PDF (ייתכן ומדובר במסמך סרוק/תמונה ללא שכבת טקסט דיגיטלית)"));
              } else {
                resolve(fullText);
              }
            } catch (err: any) {
              reject(new Error(`שגיאה בפענוח ה-PDF: ${err.message || err}`));
            }
          };

          reader.onerror = () => {
            reject(new Error("שגיאה בקריאת הקובץ מהזיכרון"));
          };

          reader.readAsArrayBuffer(file);
        } catch (err: any) {
          reject(new Error(`שגיאה באתחול תהליך פענוח ה-PDF: ${err.message || err}`));
        }
      }
    });
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["pdf", "txt", "json", "csv", "md"];

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      alert(`פורמט הקובץ אינו נתמך (${file.name}).\nניתן להעלות קבצים המכילים טקסט בלבד התואמים לאחד מהפורמטים הבאים: (.pdf, .txt, .json, .csv, .md)`);
      return;
    }

    setFileLoading(true);

    try {
      if (fileExtension === "pdf") {
        const text = await extractTextFromPdf(file);
        if (text && text.trim()) {
          setLandingAdditionalContext((prev) => {
            const cleanPrev = prev ? prev.trim() : "";
            return (cleanPrev ? cleanPrev + "\n\n" : "") + `=== תוכן מסמך ${file.name} ===\n` + text;
          });
          alert(`הקובץ ${file.name} נקרא ונתוניו חולצו בהצלחה!`);
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result;
          if (typeof text === "string" && text.trim()) {
            setLandingAdditionalContext((prev) => {
              const cleanPrev = prev ? prev.trim() : "";
              return (cleanPrev ? cleanPrev + "\n\n" : "") + `=== תוכן מסמך ${file.name} ===\n` + text;
            });
            alert(`הקובץ ${file.name} נטען בהצלחה!`);
          } else {
            alert(`לא נמצא תוכן טקסטואלי תקין בקובץ: ${file.name}`);
          }
          setFileLoading(false);
        };
        reader.onerror = () => {
          alert(`שגיאה בקריאת קובץ הטקסט: ${file.name}`);
          setFileLoading(false);
        };
        reader.readAsText(file);
      }
    } catch (error: any) {
      alert(`עיבוד הקובץ נכשל: ${error.message || error}`);
      setFileLoading(false);
    } finally {
      if (fileExtension === "pdf") {
        setFileLoading(false);
      }
    }
  };
  
  // Security Panel Modal Modal State
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);
  const [securityGoogleClientId, setSecurityGoogleClientId] = useState<string>("");
  const [securityAllowedEmails, setSecurityAllowedEmails] = useState<string[]>([]);
  const [newAllowedEmailInput, setNewAllowedEmailInput] = useState<string>("");
  const [isSavingSecuritySettings, setIsSavingSecuritySettings] = useState<boolean>(false);
  const [securityFeedback, setSecurityFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Bypass/passcode users list
  interface BypassUser {
    name: string;
    email: string;
    passcode: string;
  }
  const [bypassUsers, setBypassUsers] = useState<BypassUser[]>([]);
  const [securityBypassUsers, setSecurityBypassUsers] = useState<BypassUser[]>([]);
  const [newBypassName, setNewBypassName] = useState<string>("");
  const [newBypassEmail, setNewBypassEmail] = useState<string>("");
  const [newBypassPasscode, setNewBypassPasscode] = useState<string>("");

  // Fallback passcode state for iframe restrictions
  const [showPasscodeField, setShowPasscodeField] = useState<boolean>(true);
  const [bypassPasscode, setBypassPasscode] = useState<string>("");
  const [showBypassPasscode, setShowBypassPasscode] = useState<boolean>(false);

  // Business configurator states
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [showKey, setShowKey] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>(DEFAULT_WEBHOOK_URL);
  const [isUrlLocked, setIsUrlLocked] = useState<boolean>(true);
  
  // Tab layout in prompt editing: "edit" | "preview" | "split"
  const [editorMode, setEditorMode] = useState<"edit" | "preview" | "split">("split");
  
  // Loading & Sync states
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isPullingAll, setIsPullingAll] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState<string>("");
  const [showPayload, setShowPayload] = useState<boolean>(false);

  // Form Fields State
  const [ownerName, setOwnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerPhoneError, setOwnerPhoneError] = useState("");
  const [botId, setBotId] = useState("");
  const [whatsappInstance, setWhatsappInstance] = useState("");
  const [businessPrompt, setBusinessPrompt] = useState("");
  const [key, setKey] = useState("");
  const [leadFollowUpDays, setLeadFollowUpDays] = useState("3");
  const [agentEmail, setAgentEmail] = useState("");
  const [status, setStatus] = useState<string>("Not Active");
  const [name, setName] = useState("");
  const [agentType, setAgentType] = useState<"sales" | "support">("sales");
  const [partFileLoading, setPartFileLoading] = useState(false);

  // Split prompt states
  const [botIdentity, setBotIdentity] = useState("");
  const [coursesInfo, setCoursesInfo] = useState("");
  const [kidsCourses, setKidsCourses] = useState("");
  const [conversationFlow, setConversationFlow] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [faqAnswers, setFaqAnswers] = useState("");
  const [whatNotToDo, setWhatNotToDo] = useState("");
  const [syllabusLinks, setSyllabusLinks] = useState("");
  const [humanEscalation, setHumanEscalation] = useState("");
  const [imagesInfo, setImagesInfo] = useState("");
  const [videosInfo, setVideosInfo] = useState("");

  // AI Prompt Part Improvement states
  const [aiImproveInstruction, setAiImproveInstruction] = useState("");
  const [isImprovingPart, setIsImprovingPart] = useState(false);

  // Currently expanded block in the multi-part editor
  const [expandedSection, setExpandedSection] = useState<string>("botIdentity");
  const [editType, setEditType] = useState<"sections" | "raw">("sections");

  // Extended Fullscreen Prompt Builder Workspace states
  const [showPromptBuilder, setShowPromptBuilder] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState("botIdentity");
  const [dirtyAgents, setDirtyAgents] = useState<Record<string, boolean>>({});
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [promptBuilderBackup, setPromptBuilderBackup] = useState<AgentConfig | null>(null);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<"blocks" | "editor" | "preview">("blocks");

  // Persistent theme style (Default to "light" model based on user request)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return (saved === "dark" || saved === "light") ? saved : "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("theme-light");
      root.classList.remove("theme-dark");
      root.style.backgroundColor = "#faf9f6";
    } else {
      root.classList.add("theme-dark");
      root.classList.remove("theme-light");
      root.style.backgroundColor = "#07070a";
    }
  }, [theme]);

  // Handle file uploads for individual prompt parts (like brochures / syllabusLinks)
  const handlePartFileSelect = async (file: File, partKey: keyof AgentConfig) => {
    if (!file) return;

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["pdf", "txt", "json", "csv", "md"];

    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      alert(`שגיאה: פורמט הקובץ אינו נתמך (${file.name}).\nניתן להעלות קבצים שעבורם ניתן לחלץ טקסט בפורמטים הבאים בלבד: (.pdf, .txt, .json, .csv, .md)`);
      return;
    }

    setPartFileLoading(true);

    try {
      let text = "";
      if (fileExtension === "pdf") {
        text = await extractTextFromPdf(file);
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (typeof event.target?.result === "string") {
              resolve(event.target.result);
            } else {
              reject(new Error(`לא נמצא תוכן טקסטואלי תקין בקובץ: ${file.name}`));
            }
          };
          reader.onerror = () => reject(new Error(`שגיאה בקריאת קובץ הטקסט: ${file.name}`));
          reader.readAsText(file);
        });
      }

      if (text && text.trim()) {
        let currentValue = "";
        if (partKey === "syllabusLinks") currentValue = syllabusLinks;
        else if (partKey === "coursesInfo") currentValue = coursesInfo;
        else if (partKey === "faqAnswers") currentValue = faqAnswers;
        else if (partKey === "botIdentity") currentValue = botIdentity;
        else if (partKey === "kidsCourses") currentValue = kidsCourses;
        else if (partKey === "conversationFlow") currentValue = conversationFlow;
        else if (partKey === "writingStyle") currentValue = writingStyle;
        else if (partKey === "whatNotToDo") currentValue = whatNotToDo;
        else if (partKey === "humanEscalation") currentValue = humanEscalation;
        else if (partKey === "imagesInfo") currentValue = imagesInfo;
        else if (partKey === "videosInfo") currentValue = videosInfo;

        const cleanPrev = currentValue ? currentValue.trim() : "";
        const formattedTitle = `\n\n=== תוכן מסמך שחולץ: ${file.name} ===\n`;
        const appended = (cleanPrev ? cleanPrev + "\n" : "") + formattedTitle + text.trim() + `\n=== סוף מסמך: ${file.name} ===\n`;

        handlePromptPartChange(partKey as any, appended);
        alert(`הקובץ "${file.name}" נקרא בהצלחה! ${text.trim().length} תווים חולצו והתווספו ישירות אל החלק הנבחר.`);
      } else {
        alert(`לא נמצא תוכן טקסטואלי תקין או שחיץ בקובץ: ${file.name}`);
      }
    } catch (error: any) {
      alert(`עיבוד הקובץ נכשל: ${error.message || error}`);
    } finally {
      setPartFileLoading(false);
    }
  };

  // AI Bot Creator / Wizard State variables
  const [showWizardModal, setShowWizardModal] = useState<boolean>(false);

  // Safe Delete Agent state variables
  const [agentIdToDelete, setAgentIdToDelete] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState<string>("");
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardTemplateId, setWizardTemplateId] = useState<string>("sales");
  const [wizardWebsiteUrl, setWizardWebsiteUrl] = useState<string>("");
  const [wizardPastedText, setWizardPastedText] = useState<string>("");
  const [isExploringUrl, setIsExploringUrl] = useState<boolean>(false);
  const [explorerAnalysis, setExplorerAnalysis] = useState<string>("");
  const [scrapedText, setScrapedText] = useState<string>("");
  
  // Custom answers state
  const [wizardAnswers, setWizardAnswers] = useState({
    goal: "תיאום שיעור ניסיון חינם או פגישת היכרות קלה, לקיחת שם מלא וטלפון תקין של הליד",
    audience: "הורים לילדים או מתעניינים מבוגרים שרוצים ללמוד תכנות ופיתוח",
    tone: "טון שירותי, אדיב, מעורר ביטחון, קצר וקולע עם אימוג'י בטעם",
    restrictions: "לעולם לא להפר את רמת הבטיחות, לא להמציא מחירים שלא במחירון, ולא ללכלך על מתחרים",
    escalationTrigger: "כשהמשתמש כועס, מבקש לדבר עם נציג אנושי או שואל שאלות פיננסיות מורכבות"
  });

  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState<boolean>(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<any>(null);
  const [wizardActivePart, setWizardActivePart] = useState<string>("botIdentity");
  const [isImprovingWizardPart, setIsImprovingWizardPart] = useState<boolean>(false);
  const [wizardAiInstruction, setWizardAiInstruction] = useState<string>("הוסף עוד אימוג'ים מתאימים");

  const improveWizardPartWithAI = async (partKey: string, partTitle: string, currentValue: string) => {
    if (!wizardAiInstruction.trim()) {
      alert("אנא רשום בעיקר מה תרצה לשפר או להוסיף בחלק זה!");
      return;
    }

    try {
      setIsImprovingWizardPart(true);

      const response = await apiFetch("/api/ai/improve-agent-prompt-part", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken || localStorage.getItem("cyber_session_token")}`
        },
        body: JSON.stringify({
          partKey,
          partTitle,
          currentValue,
          instruction: wizardAiInstruction,
          businessName: wizardBusinessName,
          ownerName: wizardOwnerName || ""
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "שגיאה בשיפור הפרומפט");
      }

      setGeneratedPrompts((prev: any) => prev ? ({ ...prev, [partKey]: data.improvedText }) : prev);
      setWizardAiInstruction(""); // Reset on success
      
      alert(`🎉 החלק "${partTitle}" שופר בהצלחה בעזרת ה-AI!`);
    } catch (err: any) {
      console.error(err);
      alert(`נכשלנו בשיפור החלק החכם: ${err?.message || err}`);
    } finally {
      setIsImprovingWizardPart(false);
    }
  };

  const wizardPromptPartChange = (partKey: string, value: string) => {
    setGeneratedPrompts((prev: any) => prev ? ({
      ...prev,
      [partKey]: value
    }) : prev);
  };

  // New agent details inside the wizard
  const [wizardBotId, setWizardBotId] = useState<string>("");
  const [wizardOwnerName, setWizardOwnerName] = useState<string>("");
  const [wizardBusinessName, setWizardBusinessName] = useState<string>("");
  const [wizardOwnerPhone, setWizardOwnerPhone] = useState<string>("");
  const [wizardOwnerPhoneError, setWizardOwnerPhoneError] = useState<string>("");

  // --- Landing page demo action ---
  const handleCreateDemoBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitError("");
    setLandingPhoneError("");
    setDemoResult(null);

    const targetUrl = landingUrl.trim();
    if (!targetUrl) {
      setDemoSubmitError("אנא הזן כתובת אתר אינפורמטיבי!");
      return;
    }

    if (!targetUrl.includes(".") || targetUrl.length < 4) {
      setDemoSubmitError("כתובת האתר שגויה או קצרה מדי. אנא הזן כתובת מלאה ותקינה.");
      return;
    }

    // Phone validation - marked critical & mandatory
    if (!landingPhone || !landingPhone.trim()) {
      setLandingPhoneError("טלפון בעל העסק הוא שדה חובה *");
      setDemoSubmitError("אנא הזן מספר טלפון תקין לקבלת סיכומי שיחה!");
      return;
    }
    if (landingPhoneError) {
      setDemoSubmitError(`מספר הטלפון שהוזן אינו תקין: ${landingPhoneError}`);
      return;
    }

    setIsCreatingDemo(true);
    setDemoStep(0);

    const interval = setInterval(() => {
      setDemoStep((prev) => {
        if (prev < 4) {
          return prev + 1;
        }
        return prev;
      });
    }, 2200);

    try {
      const res = await apiFetch("/api/public/create-demo-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: targetUrl,
          phone: landingPhone,
          agentType: landingAgentType,
          additionalContext: landingAdditionalContext,
          agentName: landingAgentName
        })
      });

      const data = await res.json();
      clearInterval(interval);

      if (res.ok && data.success) {
        setDemoResult(data);
        // Trigger amazing confetti/fireworks celebration animation
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        
        // Launch some delayed side bursts for extra premium feel
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.8 }
          });
        }, 250);
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.8 }
          });
        }, 400);
      } else {
        setDemoSubmitError(data.error || "שגיאה ביצירת הבוט. ודא כי האתר שבחרת נכון ותומך סריקה.");
      }
    } catch (err) {
      clearInterval(interval);
      console.error(err);
      setDemoSubmitError("נכשל בהתחברות לשרת. אנא בדוק את חיבור הרשת שלך.");
    } finally {
      setIsCreatingDemo(false);
    }
  };

  // Function to analyze external enterprise website or product catalog via Server Scraper proxy
  const handleExploreWebsiteURL = async () => {
    if (!wizardWebsiteUrl.trim()) return alert("אנא הזן כתובת אתר אינטרנט תקינה");
    setIsExploringUrl(true);
    setExplorerAnalysis("");
    setScrapedText("");
    
    try {
      const res = await apiFetch("/api/ai/explore-website", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken || localStorage.getItem("cyber_session_token")}`
        },
        body: JSON.stringify({ url: wizardWebsiteUrl })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setScrapedText(data.scrapedText);
        setExplorerAnalysis(data.analysis);
      } else {
        alert(data.error || "נכשל בסריקת הכתובת. ייתכן והאתר חוסם בוטים או דורש הזנה ידנית.");
        setExplorerAnalysis("סריקה נכשלה. אנא העתק והדבק את הטקסט ידנית בתיבת המידע.");
      }
    } catch (err) {
      console.error(err);
      alert("שגיאת תקשורת בעת סריקת האתר.");
    } finally {
      setIsExploringUrl(false);
    }
  };

  // Function to build standard high-quality prompts locally (fallback or no-AI path)
  const handleGenerateDefaultLocalPrompts = () => {
    const biz = wizardBusinessName?.trim() || "העסק שלנו";
    const own = wizardOwnerName?.trim() || "מנהל הסוכנות";
    const phone = wizardOwnerPhone?.trim() || "לא צוין";
    const aud = wizardAnswers.audience || "לקוחות מתעניינים";
    const tone = wizardAnswers.tone || "אדיב ומקצועי";
    const rest = wizardAnswers.restrictions || "אין להבטיח הנחות מחוץ למחירון";
    const esc = wizardAnswers.escalationTrigger || "בקשה של נציג אנושי";

    const defaultPromptsByTemplate: Record<string, any> = {
      sales: {
        botIdentity: `אני עוזר השירות והמכירות הראשי של ${biz}. התפקיד שלי הוא לייצג את החברה בצורה המקצועית, האדיבה והמובילה ביותר בענף, תחת ניהולו של ${own}.`,
        coursesInfo: `אנו מציעים מגוון קורסים מתקדמים ומעשיים ב${biz}. הקורסים שלנו כוללים ליווי שבועי צמוד, תרגול מעשי 1-על-1 ופרויקטים שמזניקים לתפקיד מעשי בתעשייה.\n1. קורס פיתוח Full-Stack Web App ב-TypeScript ו-React.\n2. קורס פיתוח משחקים ותלת מימד ב-Unity.\n3. קורס יסודות התכנות לחסרי רקע.`,
        kidsCourses: `אקדמיית הילדים והנוער של ${biz}:\n1. קורס יצירת עולמות ותכנות ב-Roblox (לגילאי 9-13).\n2. סדנת פיתוח משחקים צעירים ב-Scratch.\nהקורסים מועברים בקבוצות קטנות עם תשומת לב אישית לכל ילד.`,
        conversationFlow: `זרימת השיחה המומלצת ב-WhatsApp:\n1. שלח הודעת פתיחה אדיבה עם הצגה עצמית קצרה ושילוב שם העסק.\n2. שאל בעדינות מהו המקצוע או קורס העניין של המשתתף (שאלות פתוחות).\n3. בהתאם לעניין, הצג את היתרונות הבולטים של המסלול.\n4. חתור להשגת מספר טלפון או לתאם שיחת ייעוץ מול ${own} או צוות הרישום.`,
        writingStyle: `סגנון הוראות הניסוח:\n- הודעות קצרות וקריאות עם רווחים (שבירת שורות) בין רעיונות.\n- שימוש מדוד באימוג'ים מתאימים כדי לא להעמיס.\n- כתיבה בגובה העיניים השומרת על יחס אישי ומזמין.`,
        faqAnswers: `שאלות ותשובות נפוצות:\nש: האם דרוש ניסיון קודם לקורסים?\nת: לא, הקבוצות מחולקות לפי רמות ויש מסלולים ייעודיים החל מאפס.\n\nש: מהו משך הקורס?\nת: רוב הקורסים שלנו אורכים בין 3 ל-6 חודשים, במפגשים חד-שבועיים נוחים לשילוב.`,
        whatNotToDo: `מגבלות חמורות (מה לא לעשות):\n1. אל תמציא מחירים או מבצעים שאינם רשומים.\n2. בשום פנים ואופן אל תדבר רעות משמיצה על חברות מתחרות.\n3. אל תתחייב על 100% מציאת עבודה אלא על מעטפת תמיכה מקצועית.`,
        syllabusLinks: `קישורים להורדות וסילבוסים:\n- סילבוס קורס Full-Stack קריא: https://fastway.example.com/syllabus-fullstack\n- סילבוס קורס Unity והייטק: https://fastway.example.com/syllabus-unity`,
        humanEscalation: `בכל מקרה של בקשה לנציג אנושי, שאלה פתוחה מורכבת שחורגת מהמידע המובנה (כמו API לדוגמה או הצעות מחיר מורכבות) – ענה תחילה בנימוס שישנו פירוט מצוין באתר והרפתקאות מותאמות, והפנה באדיבות רבה אל ${own} בטלפון: ${phone}. זכור: לעולם אל תסיים את השיחה מיוזמתך (רק הלקוח מסיים)! שאל מיד: "בינתיים, האם יש לך שאלות נוספות שתרצה שאשמח לעזור בהן?".`
      },
      support: {
        botIdentity: `אני בוט התמיכה והמענה הראשי של ${biz}. מטרתי היא לעזור ללקוחות למצוא תשובות מדויקות, פשוטות ומהירות, בהנחיית ${own}.`,
        coursesInfo: `שירותי המידע של ${biz} כוללים סיוע טכנולוגי, שאלות רישום ומנהלה, ותיאום מועדי למידה.\nשעות הפעילות שלנו: ימים א'-ה' בין 09:00 ל-18:00.`,
        kidsCourses: `בתחום הילדים, אנו מספקים תמיכה ברישום לקבוצות רובלוקס וסדנאות יצירתיות, החל מגילאי 9 ומעלה, תוך דגש על שירות סבלני ומסביר פנים להורים.`,
        conversationFlow: `שלבי המענה לשאלות ותמיכה:\n1. קבל כל פנייה בחיוך דיגיטלי ואשר שקיבלת את השאלה.\n2. חפש בתשובות ה-FAQ המובנות את הפתרון המתאים.\n3. אם מדובר בנושא שמצריך בדיקת מערכת, הסבר בצורה שקופה על התהליך.\n4. במידת הצורך אמת פרטים (כמו שם מלא ומייל) והבטח שנעדכן.`,
        writingStyle: `סגנון ניסוח מסייע:\n- טון סבלני, מכיל, מתחשב ומסביר פנים.\n- רווח שורות ברור לעין כך שההסברים ייראו נוחים לקריאה.\n- כתיבה ממורכזת, נקייה וברורה.`,
        faqAnswers: `שאלות ותשובות שכיחות:\nש: איך מתחברים לסביבת הלימודים?\nת: דרך האזור האישי עם שם המשתמש שנשלח אליך במייל.\n\nש: מה לעשות אם פיספסתי שיעור?\nת: כל המפגשים מוקלטים וזמינים לצפייה חוזרת בתוך 24 שעות מהמפגש.`,
        whatNotToDo: `מגבלות תמיכה:\n1. אל תיתן הבטחות לגבי שינוי כספי או ביטולי עסקה ללא אישור מנהל.\n2. לעולם אל תאשים את הלקוח בתקלה טכנית.\n3. אל תשתמש בשפה מסובכת או במונחים טכניים כבדים מדי ללא הסבר קצר.`,
        syllabusLinks: `קישורי תמיכה ושירות:\n- מדריך חיבור מהיר לתלמידים: https://fastway.example.com/guide\n- עמוד השאלות והתשובות המלא: https://fastway.example.com/faq`,
        humanEscalation: `בכל מקרה של בקשה לתמיכה אישית, כעס, או שאלה מורכבת שחורגת מהמידע – ענה תחילה בנימוס שישנו פירוט רב באתר ושמחה לסייע, אך יחד עם זאת הפנה באדיבות למספר של ${own}: ${phone}. עם זאת, הבוט לעולם אינו מפסיק את השיחה מצידו! שאל מיד לאחר מכן: "בינתיים, האם יש משהו נוסף שאוכל לעזור לך בו שתרצה לדעת?".`
      },
      kids: {
        botIdentity: `אני בוט החוגים ועוזר ההורים המיוחד של ${biz}. בניהולו של ${own}, תפקידי הוא להמליץ ולעזור להורים למצוא את המסלול החינוכי הטעים ביותר עבור ילדיהם.`,
        coursesInfo: `התכנית הטכנולוגית של ${biz} מעניקה לתלמידים ארגז כלים ייחודי: פתרון בעיות, חשיבה לוגית ויצירתיות גבוהה באמצעות קורסי פיתוח תוכנה ומשחקים מותאמים.`,
        kidsCourses: `רשימת הקורסים המפוארת שלנו לילדים:\n1. קורס Roblox גיימינג ותכנות (גילאי 9-13): לימוד שפת לואה ופיתוח משחקים משלהם.\n2. סדנת פיתוח משחקים בצהרון ב-Scratch (גילאי 7-10).\n3. קורס פיתוח אפליקציות מובייל צעירים.`,
        conversationFlow: `מסלול המענה להורים המודאגים:\n1. קבל את פניית ההורה בחמימות אימהית/אנושית וברך אותו.\n2. שאל לגיל הילד ומה הוא אוהב לעשות במחשב (לשחק, לצייר, ליצור?).\n3. הצג את הקורס המתאים ושתף על תוצרי החוג (משחק שהילד יעצב בעצמו!).\n4. הצע שיעור ניסיון קבוצתי אינטראקטיבי ללא עלות ותאם שיחה טלפונית.`,
        writingStyle: `סגנון המעורר סימפתיה להורים:\n- שילוב פרטים על בטיחות, קבוצות קטנות ויחס חונכים חם.\n- טון חם, קשוב, מעודד ומשרה ביטחון.\n- חלוקה נוחה לפרקי מידע קצרים ונעימים לעין עם גופנים מרווחים.`,
        faqAnswers: `שאלות של הורים:\nש: האם חייבים מחשב חזק בבית?\nת: לא, למסלולי הילדים מספיק מחשב ביתי רגיל וחיבור לאינטרנט.\n\nש: מה עושים בקורס רובלוקס?\nת: הילדים לומדים לעשות פרויקטים תלת-ממדיים משלהם, לתכנן מכשולים וללמוד אלגוריתמים בסיסיים באווירה מהנה.`,
        whatNotToDo: `מגבלות וכללי זהירות:\n1. אל תתחייב למשך השעות של הילד מול המסך ללא ליווי מתודי.\n2. אין להבטיח קבלה או הצטרפות לקבוצה מלאה ללא תיאום.\n3. אל תלחץ מדי על סגירה כספית, הורים אוהבים לקבל קודם הסבר סבלני.`,
        syllabusLinks: `קישורים להורים:\n- סילבוס רובלוקס ועיצוב משחקים לילדים: https://fastway.example.com/syllabus-kids\n- סילבוס קבוצות צעירות: https://fastway.example.com/syllabus-scratch`,
        humanEscalation: `בכל שלב בו ההורה מעוניין לתאם שיעור ניסיון מיוחד, שאלות כספיות מורכבות או לשוחח ישירות – ענה בנימוס שישנו פירוט מצוין באתר, פתח את הדרך והפנה באדיבות למספר של ${own} בטלפון: ${phone}. זכור: הבוט לעולם אינו מסיים את השיחה לבדו! שאל מיד: "בינתיים, האם יש משהו נוסף שאוכל לסייע לך בו?".`
      },
      qualify: {
        botIdentity: `אני עוזר האימות והמיון הראשוני של ${biz}. תפקידי לבצע אפיון צרכים קצר ומקצועי על מנת להתאים לך את המסלול המדויק ביותר, בניהול ${own}.`,
        coursesInfo: `האפיון ב${biz} מיועד למזער זמן בדיקה ולבדוק התאמה למסלולים הממוקדים והמבוקשים שלנו, כדי להבטיח את אחוזי ההצלחה הגבוהים ביותר בקבוצה.`,
        kidsCourses: `במסגרת סינון לחוגי ילדים, אנו מאמתים את הגיל וזמינות ההורה ללוות בשיעור המבוא הראשוני, כדי להבטיח התחלה חלקה ומדרבנת.`,
        conversationFlow: `שלבי המיון האפקטיבי:\n1. בירור קצר של שם מלא ומטרת הלימודים.\n2. שאלה לגבי זמינות קורסי בוקר או ערב, ורמת רקע קודם.\n3. אימות מספר טלפון ליצירת קשר.\n4. קביעת מועד שיחת אפיון טכנית אישית עם ${own} או מנהל הקבלה.`,
        writingStyle: `סגנון תכליתי ומהיר:\n- טון ענייני, מהיר, רשמי, ממוקד ועסקי.\n- שאלות קצרות, אחת בכל פעם, כדי למנוע הצפה של המשתמש בפרטים.\n- שימוש בסמלים ברורים לניווט ושלבים.`,
        faqAnswers: `שאלות סינון שכיחות:\nש: כמה זמן לוקח האפיון?\nת: בסך הכל 2-3 דקות פה בצ'אט ומעבר לשיחה של 5 דקות.\n\nש: האם סינון מונע ממני להירשם?\nת: לא, מטרתו היא רק להבטיח שאתה משובץ לקבוצה המתאימה בדיוק לקצב שלך.`,
        whatNotToDo: `מגבלות סינון:\n1. בשום מצב אל תתווכח או תיצור תחושה של 'בחינת קבלה' מלחיצה.\n2. אל תציע מחירים לפני שהגדרת את סוג השיבוץ.\n3. אל תאריך בהודעות הסבר כלליות שלא קשורות ישירות לשאלת המימדים והזמן.`,
        syllabusLinks: `קישורי אפיון כלליים:\n- שאלון אפיון להורדה מקדימה: https://fastway.example.com/qualify-sheet\n- סיכום פרטי מסלולי הלימוד: https://fastway.example.com/programs`,
        humanEscalation: `לאחר השלמת אימות הפרטים (שם, טלפון, עניין ורקע), או בכל מקרה שנדרשת עזרה מחוץ לאפיון – ענה בנימוס שיש פירוט נדרש באתר והפנה את השיחה ישירות ל${own} בטלפון: ${phone}. זכור שהבוט לעולם אינו מפסיק את השיחה מיוזמתו או אומר שלום לבד! שאל מיד בסבלנות: "בינתיים, האם יש עוד פרטים שתרצה שאענה עליהם בשמחה?".`
      }
    };

    const targetTemplate = defaultPromptsByTemplate[wizardTemplateId] || defaultPromptsByTemplate.sales;
    setGeneratedPrompts(targetTemplate);
    setWizardStep(3);
  };

  // Function to call Gemini multi-part prompt compiler
  const handleGenerateAIPrompts = async () => {
    setIsGeneratingPrompts(true);
    try {
      const res = await apiFetch("/api/ai/generate-agent-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken || localStorage.getItem("cyber_session_token")}`
        },
        body: JSON.stringify({
          templateId: wizardTemplateId,
          businessName: wizardBusinessName,
          ownerName: wizardOwnerName,
          pastedText: wizardPastedText,
          scrapedText,
          answers: wizardAnswers
        })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedPrompts(data.prompts);
        setWizardStep(3); // Advance to preview
      } else {
        alert(data.error || "נכשל ביצירת הפרומפטים. ודא כי הגדרת מפתח Gemini API תקין.");
      }
    } catch (err) {
      console.error(err);
      alert("שגיאת תקשורת ביצירת הפרומפטים באמצעות ה-AI.");
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Deploy newly constructed agent, append to list, refresh form and synchronize to Webhook
  const handleDeployWizardAgent = async () => {
    try {
      if (!wizardOwnerPhone || !wizardOwnerPhone.trim()) {
        alert("שגיאה בהקמת הסוכן: מספר טלפון ליצירת קשר הוא שדה חובה!");
        return;
      }
      if (wizardOwnerPhoneError) {
        alert(`שגיאה בהקמת הסוכן: מספר הטלפון אינו תקין. ${wizardOwnerPhoneError}`);
        return;
      }

      const finalBotId = wizardBotId.trim() || ("bot_" + Date.now());
      const finalBusinessName = wizardBusinessName.trim() || "סוכן חדש";
      const finalOwnerPhone = wizardOwnerPhone.trim();
      const finalOwnerName = wizardOwnerName.trim() || ownerName || "נציג מכירות";

      const newBotIdentity = generatedPrompts?.botIdentity || "";
      const newCoursesInfo = generatedPrompts?.coursesInfo || "";
      const newKidsCourses = generatedPrompts?.kidsCourses || "";
      const newConversationFlow = generatedPrompts?.conversationFlow || "";
      const newWritingStyle = generatedPrompts?.writingStyle || "";
      const newFaqAnswers = generatedPrompts?.faqAnswers || "";
      const newWhatNotToDo = generatedPrompts?.whatNotToDo || "";
      const newSyllabusLinks = generatedPrompts?.syllabusLinks || "";
      const newHumanEscalation = generatedPrompts?.humanEscalation || "";
      const newImagesInfo = generatedPrompts?.imagesInfo || "";
      const newVideosInfo = generatedPrompts?.videosInfo || "";

      // Compile dynamic unified businessPrompt based on the generated parts!
      const compiledBusinessPrompt = compilePromptFromParts(
        newBotIdentity,
        newCoursesInfo,
        newKidsCourses,
        newConversationFlow,
        newWritingStyle,
        newFaqAnswers,
        newWhatNotToDo,
        newSyllabusLinks,
        newHumanEscalation,
        newImagesInfo,
        newVideosInfo
      );

      const newId = "agent_" + Date.now();
      const newAgent: AgentConfig = {
        id: newId,
        ownerName: finalOwnerName,
        businessName: finalBusinessName,
        ownerPhone: finalOwnerPhone,
        botId: finalBotId,
        whatsappInstance: "Smarti",
        businessPrompt: compiledBusinessPrompt,
        key: "demo-key",
        leadFollowUpDays: leadFollowUpDays || "3",
        agentEmail: sessionUser?.email || "haim.bar@gmail.com",
        status: "Not Active",
        
        // 11 parts generated
        botIdentity: newBotIdentity,
        coursesInfo: newCoursesInfo,
        kidsCourses: newKidsCourses,
        conversationFlow: newConversationFlow,
        writingStyle: newWritingStyle,
        faqAnswers: newFaqAnswers,
        whatNotToDo: newWhatNotToDo,
        syllabusLinks: newSyllabusLinks,
        humanEscalation: newHumanEscalation,
        imagesInfo: newImagesInfo,
        videosInfo: newVideosInfo,
      };

      const updated = [...agents, newAgent];
      setAgents(updated);
      setActiveId(newId);
      
      // Explicitly update fields state for immediate visualization
      setOwnerName(newAgent.ownerName);
      setBusinessName(newAgent.businessName);
      setOwnerPhone(newAgent.ownerPhone);
      setBotId(newAgent.botId);
      setWhatsappInstance(newAgent.whatsappInstance);
      setBusinessPrompt(newAgent.businessPrompt);
      setKey(newAgent.key);
      setAgentEmail(newAgent.agentEmail || "");
      
      setBotIdentity(newAgent.botIdentity || "");
      setCoursesInfo(newAgent.coursesInfo || "");
      setKidsCourses(newAgent.kidsCourses || "");
      setConversationFlow(newAgent.conversationFlow || "");
      setWritingStyle(newAgent.writingStyle || "");
      setFaqAnswers(newAgent.faqAnswers || "");
      setWhatNotToDo(newAgent.whatNotToDo || "");
      setSyllabusLinks(newAgent.syllabusLinks || "");
      setHumanEscalation(newAgent.humanEscalation || "");
      setImagesInfo(newAgent.imagesInfo || "");
      setVideosInfo(newAgent.videosInfo || "");

      saveAgentsToServer(updated);
      setShowWizardModal(false);

      // Trigger automatic synchronization to the webhook with the isNewBot parameter set to true
      handleSyncToWebhook(newAgent, true);

      // Reset dirty status so it doesn't request webhook immediately upon creation
      setDirtyAgents(prev => ({ ...prev, [newId]: false }));

      // Prompt user on successful deployment and sync
      alert(`סוכן ${finalBusinessName} הוקם בהצלחה! 🚀`);
    } catch (err: any) {
      console.error(err);
      alert("שגיאה בהקמת הסוכן: " + (err.message || err));
    }
  };

  // Keyboard shortcut: close studio with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPromptBuilder(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // On mount: Fetch Google client ID & check active session
  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Fetch public Google Client ID configuration
        console.log("[CLIENT initApp] Fetching /api/settings relative endpoint...");
        const settingsRes = await apiFetch("/api/settings");
        console.log("[CLIENT initApp] settingsRes status:", settingsRes.status, "ok:", settingsRes.ok);
        let client_id = "";
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          console.log("[CLIENT initApp] settingsData response payload:", settingsData);
          if (settingsData.success && settingsData.googleClientId) {
            console.log("[CLIENT initApp] Setting googleClientId to:", settingsData.googleClientId);
            setGoogleClientId(settingsData.googleClientId);
            setSecurityGoogleClientId(settingsData.googleClientId);
            client_id = settingsData.googleClientId;
          } else {
            console.warn("[CLIENT initApp] settingsData didn't have googleClientId or success was false:", settingsData);
          }
        } else {
          console.error("[CLIENT initApp] failed to fetch settings with status code:", settingsRes.status);
        }

        // 2. Resolve token dynamically
        const existingToken = localStorage.getItem("cyber_session_token");
        const hasLoggedOut = localStorage.getItem("has_logged_out") === "true";

        if (existingToken) {
          // Verify saved session on server
          const sessRes = await apiFetch("/api/auth/session", {
            headers: {
              "Authorization": `Bearer ${existingToken}`
            }
          });
          if (sessRes.ok) {
            const sessData = await sessRes.json();
            if (sessData.success && sessData.user) {
              setSessionToken(existingToken);
              setSessionUser(sessData.user);
              setIsAuthenticated(true);
              fetchAgentsFromServer(existingToken, sessData.user.email);
              fetchFullSettingsFromServer(existingToken);
              setIsAuthChecking(false);
              return;
            }
          }
        }

        // If no token or token is stale, check if we should auto-authenticate as the system administrator
        if (!hasLoggedOut) {
          const defaultToken = "session_dev_bypass_haim_auto_2026";
          localStorage.setItem("cyber_session_token", defaultToken);
          setSessionToken(defaultToken);
          setSessionUser({
            email: "haim.bar@gmail.com",
            name: "חיים בר (מנהל)",
            picture: "https://lh3.googleusercontent.com/a/default-user=s96-c"
          });
          setIsAuthenticated(true);
          fetchAgentsFromServer(defaultToken, "haim.bar@gmail.com");
          fetchFullSettingsFromServer(defaultToken);
        }
      } catch (err) {
        console.error("App initialization failure:", err);
      } finally {
        setIsAuthChecking(false);
      }
    };

    initApp();
  }, []);

  // Secure popup-based Google OAuth login initiator using GSI Client-Side Flow
  const handleGooglePopupLogin = (isSignUp: boolean = false) => {
    if (!googleClientId) {
      setAuthError("מזהה הלקוח של גוגל טרם נטען מהשרת. אנא המתן מספר שניות ונסה שוב.");
      return;
    }
    
    setAuthError("");
    try {
      const googleObj = (window as any).google;
      if (googleObj?.accounts?.oauth2) {
        const client = googleObj.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "openid profile email",
          callback: async (response: any) => {
            if (response.error) {
              console.error("[CLIENT] Google popup login error:", response.error);
              setAuthError(`שגיאת התחברות: ${response.error}`);
              return;
            }
            if (response.access_token) {
              console.log("[CLIENT] Google popup login success! Access token obtained.");
              try {
                const res = await apiFetch("/api/auth/google", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    accessToken: response.access_token,
                    access_token: response.access_token,
                    isSignUp
                  }),
                });
                const data = await res.json();
                if (data.success && data.token) {
                  localStorage.removeItem("has_logged_out");
                  localStorage.setItem("cyber_session_token", data.token);
                  setSessionToken(data.token);
                  setSessionUser(data.user);
                  setIsAuthenticated(true);
                  
                  // Fetch user context and agents
                  fetchAgentsFromServer(data.token, data.user?.email);
                  fetchFullSettingsFromServer(data.token);
                } else {
                  setAuthError(data.message || "האימות נכשל");
                }
              } catch (err) {
                console.error("[CLIENT] Failed to send token to server:", err);
                setAuthError("שגיאת תקשורת עם השרת");
              }
            } else {
              console.warn("[CLIENT] Google response missing access_token", response);
              setAuthError("לא התקבל מפתח גישה של גוגל. אנא ודא שחלונות קופצים מאושרים בדפדפן ונסה שוב.");
            }
          },
        });
        client.requestAccessToken();
      } else {
        setAuthError("שירותי גוגל לא נטענו עדיין. אנא נסה שוב בעוד מספר שניות.");
      }
    } catch (e: any) {
      console.error("[CLIENT] GSI Popup init error:", e);
      setAuthError(`שגיאה בהפעלת חלון גוגל: ${e.message || String(e)}`);
    }
  };

  // Set up Google Sign-In SDK button
  useEffect(() => {
    if (isAuthChecking || isAuthenticated || !googleClientId) return;

    const initGsi = () => {
      const googleObj = (window as any).google;
      if (googleObj?.accounts?.id) {
        googleObj.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleSigninCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const container = document.getElementById("google-signin-btn-container");
        if (container) {
          googleObj.accounts.id.renderButton(container, {
            theme: "filled_blue",
            size: "large",
            shape: "pill",
            text: "signin_with",
            locale: "he",
          });
        }
      } else {
        // GSI script not parsed yet, retry shortly
        setTimeout(initGsi, 200);
      }
    };

    initGsi();
  }, [googleClientId, isAuthenticated, isAuthChecking]);

  // Handle JWT token returned from Google popup API
  const handleGoogleSigninCredential = async (response: any) => {
    try {
      setAuthError("");
      const res = await apiFetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem("has_logged_out");
        localStorage.setItem("cyber_session_token", data.token);
        setSessionToken(data.token);
        setSessionUser(data.user);
        setIsAuthenticated(true);

        // Fetch user context and agents
        fetchAgentsFromServer(data.token, data.user?.email);
        fetchFullSettingsFromServer(data.token);
      } else {
        setAuthError(data.message || "גישת האימות נדחתה על ידי השרת");
      }
    } catch (err) {
      console.error("Google Auth response backend exchange error:", err);
      setAuthError("שגיאת תקשורת מול שרת האימות. אנא נסה שנית.");
    }
  };

  // Safe developer passcode log-in (for strict sandbox environments or custom passcodes)
  const handlePasscodeLoginBypass = async () => {
    if (!bypassPasscode.trim()) return;
    setAuthError("");
    
    try {
      const res = await apiFetch("/api/auth/bypass-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ passcode: bypassPasscode.trim() })
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.removeItem("has_logged_out");
        localStorage.setItem("cyber_session_token", data.token);
        setSessionToken(data.token);
        setSessionUser(data.user);
        setIsAuthenticated(true);
        
        // Load data
        fetchAgentsFromServer(data.token, data.user?.email);
        fetchFullSettingsFromServer(data.token);
      } else {
        setAuthError(data.message || "מפתח מעקף שגוי. אנא נסה שוב.");
      }
    } catch (err: any) {
      console.error("Passcode login error:", err);
      setAuthError("שגיאת תקשורת מול שרת האימות.");
    }
  };

  // Fetch agents array saved on the server
  const fetchAgentsFromServer = async (token: string, emailUserOverride?: string) => {
    try {
      const res = await apiFetch("/api/agents", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const activeEmail = (emailUserOverride || sessionUser?.email || "").toLowerCase().trim();
        
        if (data.success && data.data && data.data.length > 0) {
          setAgents(data.data);
          const currentId = activeId;
          const matchingAgent = data.data.find((a: any) => a.id === currentId);
          const targetAgent = matchingAgent || data.data[0];
          setActiveId(targetAgent.id);
          loadAgentToForm(targetAgent);
          
          // For administrator login, we always fetch & restore all live projects/agents directly from the n8n webhook
          if (activeEmail === "haim.bar@gmail.com") {
            console.log("[CLIENT] Admin logged in/initialized, automatically fetching all live projects from n8n webhook...");
            setTimeout(() => {
              handlePullAllAgentsFromN8n(token);
            }, 800);
          } else if (
            data.data.length === 1 && 
            (data.data[0].businessName.includes("סוכן חדש") || data.data[0].businessName === "SBS Games")
          ) {
            // Placeholder fallback
          }
        } else {
          // No cloud records stored yet, load local storage or create new preset
          loadFromLocalOldPresetOrCreate(token);
          
          if (activeEmail === "haim.bar@gmail.com") {
            console.log("[CLIENT] Admin empty cloud list detected, pulling all configs from webhook...");
            setTimeout(() => {
              handlePullAllAgentsFromN8n(token);
            }, 800);
          }
        }
      } else {
        loadFromLocalOldPresetOrCreate(token);
      }
    } catch (e) {
      console.error("Error loading server-saved agents, falling back to local:", e);
      loadFromLocalOldPresetOrCreate(token);
    }
  };

  const loadFromLocalOldPresetOrCreate = (token: string) => {
    const savedAgents = localStorage.getItem("n8n_agents_configs");
    if (savedAgents) {
      try {
        const parsed = JSON.parse(savedAgents) as AgentConfig[];
        if (parsed.length > 0) {
          setAgents(parsed);
          setActiveId(parsed[0].id);
          loadAgentToForm(parsed[0]);
          saveAgentsToServer(parsed, token);
          return;
        }
      } catch (e) {
        console.error("Local storage parse error:", e);
      }
    }
    createNewAgentStateOnlyAndSave(token);
  };

  const createNewAgentStateOnlyAndSave = (token: string) => {
    const newId = "agent_" + Date.now();
    const newAgent: AgentConfig = {
      id: newId,
      ownerName: "",
      businessName: "סוכן חדש 1",
      ownerPhone: "",
      botId: "bot_" + Math.floor(Math.random() * 90000 + 10000),
      whatsappInstance: "Smarti",
      businessPrompt: promptTemplates[0].content
        .replace(/{BusinessName}/g, "העסק שלי")
        .replace(/{OwnerName}/g, "בעל העסק")
        .replace(/{OwnerPhone}/g, "050-1234567")
        .replace(/{BotId}/g, "bot_demo"),
      key: "",
      leadFollowUpDays: "3",
      status: "Not Active",
    };
    const list = [newAgent];
    setAgents(list);
    setActiveId(newId);
    loadAgentToForm(newAgent);
    saveAgentsToServer(list, token);
  };

  // Fetch settings from the backend (client ID & allowed emails & bypass users)
  const fetchFullSettingsFromServer = async (token: string) => {
    try {
      const res = await apiFetch("/api/settings", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.googleClientId) {
            setGoogleClientId(data.googleClientId);
            setSecurityGoogleClientId(data.googleClientId);
          }
          if (data.allowedEmails) {
            setAllowedEmails(data.allowedEmails);
            setSecurityAllowedEmails(data.allowedEmails);
          }
          if (data.bypassUsers) {
            setBypassUsers(data.bypassUsers);
            setSecurityBypassUsers(data.bypassUsers);
          }
        }
      }
    } catch (e) {
      console.error("Error loaded permissions settings from backend:", e);
    }
  };

  // Synchronously save agent arrays to server-side JSON file
  const saveAgentsToServer = async (updatedAgents: AgentConfig[], token = sessionToken, isDebounced = false) => {
    try {
      localStorage.setItem("n8n_agents_configs", JSON.stringify(updatedAgents));
      if (!token) return;

      if (globalSaveTimeoutId) {
        clearTimeout(globalSaveTimeoutId);
      }

      if (isDebounced) {
        globalSaveTimeoutId = setTimeout(async () => {
          try {
            await apiFetch("/api/agents", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ agents: updatedAgents })
            });
          } catch (e) {
            console.error("Failed persisting agents to server database in debounced call:", e);
          }
        }, 1500);
      } else {
        await apiFetch("/api/agents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ agents: updatedAgents })
        });
      }
    } catch (e) {
      console.error("Failed persisting agents to server database:", e);
    }
  };

  // Helper to compile unified prompt from individual sections
  const compilePromptFromParts = (
    identity: string,
    courses: string,
    kids: string,
    flow: string,
    tone: string,
    faqs: string,
    notTo: string,
    syllabus: string,
    escalation: string,
    images: string = "",
    videos: string = ""
  ): string => {
    return `### זהות הבוט
${identity || "(לא הוגדר)"}

### מה אני מוכר — קורסים
${courses || "(לא הוגדר)"}

### קורסי ילדים
${kids || "(לא הוגדר)"}

### זרימת שיחה
${flow || "(לא הוגדר)"}

### טון ואופן כתיבה
${tone || "(לא הוגדר)"}

### תשובות לשאלות נפוצות
${faqs || "(לא הוגדר)"}

### מה לא לעשות
${notTo || "(לא הוגדר)"}

### לינקים לסילבוסים
${syllabus || "(לא הוגדר)"}

### אסקלציה לאנוש
${escalation || "(לא הוגדר)"}

### תמונות וגלריה
${images || "(לא הוגדר)"}
הנחיית שימוש חיונית: השתמש בקישורי התמונות המופיעים כאן כדי לענות על שאלות הלקוח או להציע אותן באופן יזום ופרואקטיבי כאשר יש ערך ויזואלי התומך בתשובתך. המשתמש לא תמיד מודע לקיומן של תמונות/גלריה, ולכן עליך להציע אותן כשזה רלוונטי!

### סרטוני וידאו
${videos || "(לא הוגדר)"}
הנחיית שימוש חיונית: השתמש בקישורי הוידאו המופיעים כאן כדי להעשיר את תגובותיך ולהציע אותם ביוזמתך באופן פרואקטיבי לשאלות משתמשים. המשתמש אינו יודע שיש סרטוני וידאו זמינים, לכן שלב והצע אותם כשזה יכול לעזור להבהיר נושא או להדגים שירות/מוצר!`;
  };

  // Extract separate parts from businessPrompt if possible
  const getOrExtractBypassParts = (agent: AgentConfig) => {
    const defaultIdentity = `אתה סוכן מכירות דיגיטלי חכם וידידותי של שחר בר מ-SBS Games בתחום פיתוח המשחקים ב-Unity.`;
    const defaultCourses = `אנו מציעים מגוון קורסים מקצועיים לפיתוח משחקים ביוניטי. קורס הדגל שלנו הוא Unity Pro המקיף.`;
    const defaultKids = `קורסי פיתוח משחקים ייחודיים לילדים ונוער, המשלבים למידה מעשית מבוססת פרויקטים וחשיבה מתמטית.`;
    const defaultFlow = `1. פתיחה אדיבה ומזמינה
2. בירור העניין (ילדים, נוער או מבוגרים)
3. שליחת קישור לסילבוס המתאים ביותר
4. תיאום שיחת ייעוץ קצרה בטלפון במידת הצורך`;
    const defaultWritingStyle = `- שפה קולחת, מקצועית ואנרגטית
- שימוש קל באימוג'ים
- הודעות קצרות ותכליתיות`;
    const defaultFaqs = `ש: מאיזה גיל הקורסים?
ת: אנו מציעים מסלולים לילדים החל מגיל 10, ומסלולים נפרדים למבוגרים.`;
    const defaultWhatNotToDo = `- אל תשקר לגבי מחירים
- אל תתחייב על הנחות ללא אישור ידני
- אל תעבור את ה-3 משפטים להודעה בודדת בווטסאפ`;
    const defaultSyllabus = `- סילבוס קורס יסודות: https://sbsgames.dev/syllabus-basics
- סילבוס קורס מתקדמים: https://sbsgames.dev/syllabus-pro`;
    const defaultHumanEscalation = `הנחיות הפניה לנציג אנושי (שחר בר) בטלפון {OwnerPhone}:\n1. הבוט לעולם אינו מפסיק או מסיים את השיחה מיוזמתו, רק הלקוח מסיים.\n2. בכל פעם שהלקוח מבקש נציג אנושי, שואל שאלה מורכבת שחורגת מהמידע המובנה (כמו קוד או API לדוגמה או הצעות מחיר מורכבות ומיוחדות) – עליו לענות קודם בחום ובנימוס שישנו פירוט רב באתר והוא שמח לנסות לעזור כאן, אך יחד עם זאת עליו להפנות באדיבות למספר של שחר בר {OwnerPhone}, ולשאול באופן מיידי: "בינתיים, האם יש לך שאלות נוספות שתרצה שאשמח לעזור לך בהן?" על מנת להמשיך ברצף השיחה.`;
    const defaultImages = `- תמונת קורס יסודות: https://sbsgames.dev/img/basics.jpg\n- סביבת הלימודים: https://sbsgames.dev/img/workspace.jpg`;
    const defaultVideos = `- סרטון פרויקטים של תלמידים: https://sbsgames.dev/video/showcase.mp4\n- סיור קצר בכיתה: https://sbsgames.dev/video/workspace-tour.mp4`;

    if (
      agent.botIdentity ||
      agent.coursesInfo ||
      agent.kidsCourses ||
      agent.conversationFlow ||
      agent.writingStyle ||
      agent.faqAnswers ||
      agent.whatNotToDo ||
      agent.syllabusLinks ||
      agent.humanEscalation ||
      agent.imagesInfo ||
      agent.videosInfo
    ) {
      return {
        botIdentity: agent.botIdentity || "",
        coursesInfo: agent.coursesInfo || "",
        kidsCourses: agent.kidsCourses || "",
        conversationFlow: agent.conversationFlow || "",
        writingStyle: agent.writingStyle || "",
        faqAnswers: agent.faqAnswers || "",
        whatNotToDo: agent.whatNotToDo || "",
        syllabusLinks: agent.syllabusLinks || "",
        humanEscalation: agent.humanEscalation || "",
        imagesInfo: agent.imagesInfo || "",
        videosInfo: agent.videosInfo || "",
      };
    }

    const prompt = agent.businessPrompt || "";
    if (!prompt) {
      return {
        botIdentity: defaultIdentity,
        coursesInfo: defaultCourses,
        kidsCourses: defaultKids,
        conversationFlow: defaultFlow,
        writingStyle: defaultWritingStyle,
        faqAnswers: defaultFaqs,
        whatNotToDo: defaultWhatNotToDo,
        syllabusLinks: defaultSyllabus,
        humanEscalation: defaultHumanEscalation,
        imagesInfo: defaultImages,
        videosInfo: defaultVideos,
      };
    }

    // Attempt to parse existing businessPrompt. Try to search for sections with regex or indices
    const parseSection = (keywords: string[], fallback: string): string => {
      const lines = prompt.split("\n");
      let foundStart = -1;
      let foundEnd = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#") || line.startsWith("##") || line.startsWith("###")) {
          const text = line.replace(/^#+\s*/, "").toLowerCase().trim();
          const match = keywords.some(kw => text.includes(kw.toLowerCase()));
          if (match) {
            foundStart = i;
            // find next header
            for (let j = i + 1; j < lines.length; j++) {
              const l2 = lines[j].trim();
              if (l2.startsWith("#") || l2.startsWith("##") || l2.startsWith("###")) {
                foundEnd = j;
                break;
              }
            }
            break;
          }
        }
      }

      if (foundStart !== -1) {
        const endIdx = foundEnd !== -1 ? foundEnd : lines.length;
        // Slice and strip header
        const sliced = lines.slice(foundStart + 1, endIdx).join("\n").trim();
        return sliced || fallback;
      }
      return fallback;
    };

    return {
      botIdentity: parseSection(["זהות", "תפקיד", "מי הבוט", "identity"], defaultIdentity),
      coursesInfo: parseSection(["קורסים - מבוגרים", "קורסים מבוגרים", "מה אני מוכר", "קורסים", "sell", "courses"], defaultCourses),
      kidsCourses: parseSection(["ילדים", "קורסי ילדים", "קורסים לילדים", "kids"], defaultKids),
      conversationFlow: parseSection(["זרימת שיחה", "תסריט", "זרימה", "flow"], defaultFlow),
      writingStyle: parseSection(["טון", "שפה", "כתיבה", "סגנון", "style", "tone"], defaultWritingStyle),
      faqAnswers: parseSection(["נפוצות", "שאלות ותשובות", "faq", "faqs"], defaultFaqs),
      whatNotToDo: parseSection(["מה לא לעשות", "איסורים", "מגבלות", "חוקי ברזל", "not to do"], defaultWhatNotToDo),
      syllabusLinks: parseSection(["לינקים לסילבוסים", "קישורים לסילבוסים", "סילבוס", "סילבוסים", "links", "syllabus"], defaultSyllabus),
      humanEscalation: parseSection(["אסקלציה", "אנוש", "העברה לאנוש", "escalation"], defaultHumanEscalation),
      imagesInfo: parseSection(["תמונות", "גלריה", "גלריית תמונות", "images", "gallery", "image"], defaultImages),
      videosInfo: parseSection(["וידאו", "סרטונים", "סרטוני וידאו", "videos", "video", "youtube"], defaultVideos),
    };
  };

  // Helper to load an agent configuration to the active form fields
  const loadAgentToForm = (agent: AgentConfig) => {
    setOwnerName(agent.ownerName || "");
    setBusinessName(agent.businessName || "");
    setOwnerPhone(agent.ownerPhone || "");
    setBotId(agent.botId || "");
    setWhatsappInstance(agent.whatsappInstance || "");
    setKey(agent.key || "");
    setLeadFollowUpDays(agent.leadFollowUpDays || "3");
    setAgentEmail(agent.agentEmail || "");
    setStatus(agent.status || "Not Active");
    setName(agent.name || (agent.businessName ? `${agent.businessName} _ ${agent.agentType === "support" ? "תמיכה טכנית" : "מכירות"}` : ""));
    setAgentType(agent.agentType || "sales");
    
    // Load individual sections with extraction support or defaults
    const parts = getOrExtractBypassParts(agent);
    setBotIdentity(parts.botIdentity);
    setCoursesInfo(parts.coursesInfo);
    setKidsCourses(parts.kidsCourses);
    setConversationFlow(parts.conversationFlow);
    setWritingStyle(parts.writingStyle);
    setFaqAnswers(parts.faqAnswers);
    setWhatNotToDo(parts.whatNotToDo);
    setSyllabusLinks(parts.syllabusLinks);
    setHumanEscalation(parts.humanEscalation);
    setImagesInfo(parts.imagesInfo);
    setVideosInfo(parts.videosInfo);

    // Dynamic prompt compiled result
    const compiled = compilePromptFromParts(
      parts.botIdentity,
      parts.coursesInfo,
      parts.kidsCourses,
      parts.conversationFlow,
      parts.writingStyle,
      parts.faqAnswers,
      parts.whatNotToDo,
      parts.syllabusLinks,
      parts.humanEscalation,
      parts.imagesInfo,
      parts.videosInfo
    );
    setBusinessPrompt(compiled);

    setSyncStatus("idle");
    setSyncMessage("");
  };

  // Update individual prompt section of active configurations
  const handlePromptPartChange = (partKey: keyof AgentConfig, value: string) => {
    let freshIdentity = partKey === "botIdentity" ? value : botIdentity;
    let freshCourses = partKey === "coursesInfo" ? value : coursesInfo;
    let freshKids = partKey === "kidsCourses" ? value : kidsCourses;
    let freshFlow = partKey === "conversationFlow" ? value : conversationFlow;
    let freshStyle = partKey === "writingStyle" ? value : writingStyle;
    let freshFaqs = partKey === "faqAnswers" ? value : faqAnswers;
    let freshWhatNot = partKey === "whatNotToDo" ? value : whatNotToDo;
    let freshSyllabus = partKey === "syllabusLinks" ? value : syllabusLinks;
    let freshHuman = partKey === "humanEscalation" ? value : humanEscalation;
    let freshImages = partKey === "imagesInfo" ? value : imagesInfo;
    let freshVideos = partKey === "videosInfo" ? value : videosInfo;

    if (partKey === "botIdentity") setBotIdentity(value);
    else if (partKey === "coursesInfo") setCoursesInfo(value);
    else if (partKey === "kidsCourses") setKidsCourses(value);
    else if (partKey === "conversationFlow") setConversationFlow(value);
    else if (partKey === "writingStyle") setWritingStyle(value);
    else if (partKey === "faqAnswers") setFaqAnswers(value);
    else if (partKey === "whatNotToDo") setWhatNotToDo(value);
    else if (partKey === "syllabusLinks") setSyllabusLinks(value);
    else if (partKey === "humanEscalation") setHumanEscalation(value);
    else if (partKey === "imagesInfo") setImagesInfo(value);
    else if (partKey === "videosInfo") setVideosInfo(value);

    // Re-compile businessPrompt dynamically using updated components
    const compiled = compilePromptFromParts(
      freshIdentity,
      freshCourses,
      freshKids,
      freshFlow,
      freshStyle,
      freshFaqs,
      freshWhatNot,
      freshSyllabus,
      freshHuman,
      freshImages,
      freshVideos
    );
    setBusinessPrompt(compiled);

    const updated = agents.map(agent => {
      if (agent.id === activeId) {
        return {
          ...agent,
          [partKey]: value,
          businessPrompt: compiled
        };
      }
      return agent;
    });
    setAgents(updated);
    setDirtyAgents(prev => ({ ...prev, [activeId]: true }));
  };

  // Improve a single prompt part using AI with specific user instructions
  const improvePromptPartWithAI = async (partKey: string, partTitle: string, currentValue: string) => {
    if (!aiImproveInstruction.trim()) {
      alert("אנא רשום בעיקר מה תרצה לשפר או להוסיף בחלק זה!");
      return;
    }

    try {
      setIsImprovingPart(true);

      const response = await apiFetch("/api/ai/improve-agent-prompt-part", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken || localStorage.getItem("cyber_session_token")}`
        },
        body: JSON.stringify({
          partKey,
          partTitle,
          currentValue,
          instruction: aiImproveInstruction,
          businessName,
          ownerName
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "שגיאה בשיפור הפרומפט");
      }

      // Update the state of this prompt part
      handlePromptPartChange(partKey as any, data.improvedText);
      setAiImproveInstruction(""); // Reset instruction on success
      
      alert(`🎉 החלק "${partTitle}" שופר בהצלחה בעזרת ה-AI!`);
    } catch (err: any) {
      console.error(err);
      alert(`נכשלנו בשיפור החלק החכם: ${err?.message || err}`);
    } finally {
      setIsImprovingPart(false);
    }
  };

  // Update current active agent configuration in state & server
  const handleFieldChange = (field: keyof AgentConfig, value: string) => {
    if (field === "ownerName") setOwnerName(value);
    else if (field === "businessName") {
      setBusinessName(value);
      const prevDefault = `${businessName} _ ${agentType === "support" ? "תמיכה טכנית" : "מכירות"}`;
      if (!name || name === prevDefault || name === "[שם העסק] _ מכירות" || name === "[שם העסק] _ תמיכה טכנית" || name.trim() === "_ מכירות" || name.trim() === "_ תמיכה טכנית" || name === "סוכן חדש 1 _ מכירות" || name.startsWith("סוכן חדש ")) {
        const newDefault = `${value} _ ${agentType === "support" ? "תמיכה טכנית" : "מכירות"}`;
        setName(newDefault);
        setTimeout(() => {
          setAgents(prev => prev.map(a => a.id === activeId ? { ...a, name: newDefault } : a));
        }, 0);
      }
    }
    else if (field === "ownerPhone") setOwnerPhone(value);
    else if (field === "botId") setBotId(value);
    else if (field === "whatsappInstance") setWhatsappInstance(value);
    else if (field === "businessPrompt") setBusinessPrompt(value);
    else if (field === "key") setKey(value);
    else if (field === "leadFollowUpDays") setLeadFollowUpDays(value);
    else if (field === "agentEmail") setAgentEmail(value);
    else if (field === "status") setStatus(value);
    else if (field === "name") setName(value);
    else if (field === "agentType") {
      const typedVal = value as "sales" | "support";
      setAgentType(typedVal);
      const prevDefault = `${businessName} _ ${agentType === "support" ? "תמיכה טכנית" : "מכירות"}`;
      if (!name || name === prevDefault || name === "[שם העסק] _ מכירות" || name === "[שם העסק] _ תמיכה טכנית" || name.trim() === "_ מכירות" || name.trim() === "_ תמיכה טכנית" || name === "סוכן חדש 1 _ מכירות" || name.startsWith("סוכן חדש ")) {
        const newDefault = `${businessName} _ ${typedVal === "support" ? "תמיכה טכנית" : "מכירות"}`;
        setName(newDefault);
        setTimeout(() => {
          setAgents(prev => prev.map(a => a.id === activeId ? { ...a, name: newDefault, agentType: typedVal } : a));
        }, 0);
      }
    }

    let updatedAgentToSync: AgentConfig | undefined;
    let otherDeactivatedAgents: AgentConfig[] = [];

    const updated = agents.map(agent => {
      if (agent.id === activeId) {
        let u = { ...agent, [field]: value };
        if (field === "businessName") {
          const prevDefault = `${agent.businessName} _ ${agent.agentType === "support" ? "תמיכה טכנית" : "מכירות"}`;
          if (!agent.name || agent.name === prevDefault || agent.name === "[שם העסק] _ מכירות" || agent.name === "[שם העסק] _ תמיכה טכנית" || agent.name.trim() === "_ מכירות" || agent.name.trim() === "_ תמיכה טכנית" || agent.name === "סוכן חדש 1 _ מכירות" || agent.name.startsWith("סוכן חדש ")) {
            u.name = `${value} _ ${agent.agentType === "support" ? "תמיכה טכנית" : "מכירות"}`;
          }
        } else if (field === "agentType") {
          const prevDefault = `${agent.businessName} _ ${agent.agentType === "support" ? "תמיכה טכנית" : "מכירות"}`;
          if (!agent.name || agent.name === prevDefault || agent.name === "[שם העסק] _ מכירות" || agent.name === "[שם העסק] _ תמיכה טכנית" || agent.name.trim() === "_ מכירות" || agent.name.trim() === "_ תמיכה טכנית" || agent.name === "סוכן חדש 1 _ מכירות" || agent.name.startsWith("סוכן חדש ")) {
            u.name = `${agent.businessName} _ ${value === "support" ? "תמיכה טכנית" : "מכירות"}`;
          }
        }
        updatedAgentToSync = u;
        return u;
      }
      return agent;
    });

    const { updatedList } = (() => {
      const targetAgent = updated.find(a => a.id === activeId);
      if (!targetAgent || targetAgent.status !== "Active" || !targetAgent.whatsappInstance) {
        return { updatedList: updated };
      }
      const currentInstance = targetAgent.whatsappInstance;
      const otherDeact: AgentConfig[] = [];
      const resList = updated.map(agent => {
        if (agent.id !== activeId && agent.whatsappInstance === currentInstance && agent.status === "Active") {
          const deact = { ...agent, status: "Not Active" };
          otherDeact.push(deact);
          return deact;
        }
        return agent;
      });
      otherDeactivatedAgents = otherDeact;
      return { updatedList: resList };
    })();

    setAgents(updatedList);
    setDirtyAgents(prev => ({ ...prev, [activeId]: true }));

    const finalTarget = updatedList.find(a => a.id === activeId);

    // If change is status or whatsappInstance, sync immediately so webhook responds to toggle
    if ((field === "status" || field === "whatsappInstance") && finalTarget) {
      handleSyncToWebhook(finalTarget, false);
    }

    // Sync any other deactivated agents immediately so the backend database reflects the change
    for (const deact of otherDeactivatedAgents) {
      handleSyncToWebhook(deact, false);
    }
  };

  // Add a new agent profile
  const createNewAgent = () => {
    if (sessionUser?.email !== "haim.bar@gmail.com") {
      alert("פעולה זו מורשית למנהל המערכת הראשי בלבד (super user).");
      return;
    }
    const newId = "agent_" + Date.now();
    const newAgent: AgentConfig = {
      id: newId,
      ownerName: "",
      businessName: "סוכן חדש " + (agents.length + 1),
      ownerPhone: "",
      botId: "bot_" + Math.floor(Math.random() * 90000 + 10000),
      whatsappInstance: "Smarti",
      businessPrompt: promptTemplates[0].content
        .replace(/{BusinessName}/g, "העסק שלי")
        .replace(/{OwnerName}/g, "בעל העסק")
        .replace(/{OwnerPhone}/g, "050-1234567")
        .replace(/{BotId}/g, "bot_demo"),
      key: "",
      leadFollowUpDays: "3",
      agentEmail: sessionUser?.email || "haim.bar@gmail.com",
      status: "Not Active",
    };

    const updated = [...agents, newAgent];
    setAgents(updated);
    setActiveId(newId);
    loadAgentToForm(newAgent);
    saveAgentsToServer(updated);
  };

  // Trigger deleting an agent profile - validates access and opens confirmation modal
  const triggerDeleteAgent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const agentToDel = agents.find(a => a.id === id);
    if (!agentToDel) return;

    const isSuperUser = sessionUser?.email === "haim.bar@gmail.com";
    const isInactive = !agentToDel.lastSyncedAt;

    if (!isSuperUser && !isInactive) {
      alert("מחיקה של סוכן פעיל מורשית למנהל המערכת הראשי בלבד (super user).");
      return;
    }

    if (agents.length <= 1) {
      alert("חייב להישאר לפחות סוכן אחד במערכת.");
      return;
    }

    setAgentIdToDelete(id);
    setDeleteConfirmInput("");
  };

  // Perform actual deletion after typing verification
  const executeDeleteAgent = () => {
    if (!agentIdToDelete) return;
    const agentToDel = agents.find(a => a.id === agentIdToDelete);
    if (!agentToDel) {
      setAgentIdToDelete(null);
      return;
    }

    const expectedText = "מחק " + (agentToDel.businessName || "סוכן");
    if (deleteConfirmInput.trim() !== expectedText) {
      alert(`על מנת למחוק, אנא הקלד את צמד המילים המדויק: "${expectedText}"`);
      return;
    }

    const updated = agents.filter(agent => agent.id !== agentIdToDelete);
    setAgents(updated);
    saveAgentsToServer(updated);
    
    if (activeId === agentIdToDelete) {
      const nextActive = updated[0];
      setActiveId(nextActive.id);
      loadAgentToForm(nextActive);
    }

    setAgentIdToDelete(null);
    setDeleteConfirmInput("");
  };

  // Switch between agents
  const selectAgent = (id: string) => {
    const selected = agents.find(agent => agent.id === id);
    if (selected) {
      setActiveId(id);
      loadAgentToForm(selected);
    }
  };

  // Apply a template to the workspace prompt
  const applyTemplate = (template: PromptTemplate) => {
    const resolvedContent = template.content
      .replace(/{BusinessName}/g, businessName || "[שם העסק]")
      .replace(/{OwnerName}/g, ownerName || "[שם בעל העסק]")
      .replace(/{OwnerPhone}/g, ownerPhone || "[טלפון בעל העסק]")
      .replace(/{BotId}/g, botId || "[Bot ID]");

    const pseudoAgent: AgentConfig = {
      id: activeId,
      ownerName,
      businessName,
      ownerPhone,
      botId,
      whatsappInstance,
      businessPrompt: resolvedContent,
      key
    };

    const parts = getOrExtractBypassParts(pseudoAgent);
    setBotIdentity(parts.botIdentity);
    setCoursesInfo(parts.coursesInfo);
    setKidsCourses(parts.kidsCourses);
    setConversationFlow(parts.conversationFlow);
    setWritingStyle(parts.writingStyle);
    setFaqAnswers(parts.faqAnswers);
    setWhatNotToDo(parts.whatNotToDo);
    setSyllabusLinks(parts.syllabusLinks);
    setHumanEscalation(parts.humanEscalation);

    setBusinessPrompt(resolvedContent);

    const updated = agents.map(agent => {
      if (agent.id === activeId) {
        return {
          ...agent,
          businessPrompt: resolvedContent,
          botIdentity: parts.botIdentity,
          coursesInfo: parts.coursesInfo,
          kidsCourses: parts.kidsCourses,
          conversationFlow: parts.conversationFlow,
          writingStyle: parts.writingStyle,
          faqAnswers: parts.faqAnswers,
          whatNotToDo: parts.whatNotToDo,
          syllabusLinks: parts.syllabusLinks,
          humanEscalation: parts.humanEscalation
        };
      }
      return agent;
    });
    setAgents(updated);
    saveAgentsToServer(updated);
    setDirtyAgents(prev => ({ ...prev, [activeId]: true }));
  };

  // Helper to insert markdown syntax at cursor position
  const insertMarkdown = (syntaxStart: string, syntaxEnd = "") => {
    const textarea = promptTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = businessPrompt;
    
    const selectedText = text.substring(start, end);
    const replacement = syntaxStart + selectedText + syntaxEnd;
    
    const newText = text.substring(0, start) + replacement + text.substring(end);
    
    handleFieldChange("businessPrompt", newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntaxStart.length, start + syntaxStart.length + selectedText.length);
    }, 50);
  };

  // Helper to insert markdown syntax at cursor position for full-screen prompt builder sections
  const insertMarkdownIntoElement = (textarea: HTMLTextAreaElement, syntaxStart: string, syntaxEnd = "", partKey: string, currentValue: string) => {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const selectedText = currentValue.substring(start, end);
    const replacement = syntaxStart + selectedText + syntaxEnd;
    
    const newText = currentValue.substring(0, start) + replacement + currentValue.substring(end);
    
    handlePromptPartChange(partKey as any, newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntaxStart.length, start + syntaxStart.length + selectedText.length);
    }, 50);
  };

  // Save the custom webhook url
  const handleSaveWebhookUrl = (value: string) => {
    setWebhookUrl(value);
    localStorage.setItem("n8n_webhook_url", value);
  };

  // Reset to default webhook
  const resetWebhookUrl = () => {
    handleSaveWebhookUrl(DEFAULT_WEBHOOK_URL);
  };

  // Duplicate current agent
  const duplicateAgent = () => {
    if (sessionUser?.email !== "haim.bar@gmail.com") {
      alert("פעולה זו מורשית למנהל המערכת הראשי בלבד (super user).");
      return;
    }
    const current = agents.find(agent => agent.id === activeId);
    if (!current) return;

    const newId = "agent_" + Date.now();
    const duplicated: AgentConfig = {
      ...current,
      id: newId,
      businessName: `${current.businessName} (העתק)`,
      botId: `${current.botId}_copy`
    };

    const updated = [...agents, duplicated];
    setAgents(updated);
    setActiveId(newId);
    loadAgentToForm(duplicated);
    saveAgentsToServer(updated);

    // Trigger automatic synchronization to the webhook with the isNewBot parameter set to true
    handleSyncToWebhook(duplicated, true);
  };

  // Toggle active / not active status for an agent with WhatsApp Instance mutual exclusivity rule
  const toggleAgentStatus = (targetId: string) => {
    let updatedAgentToSync: AgentConfig | undefined;
    let otherDeactivatedAgents: AgentConfig[] = [];

    const currentAgent = agents.find(a => a.id === targetId);
    if (!currentAgent) return;

    const oldStatus = currentAgent.status || "Not Active";
    const newStatus = oldStatus === "Active" ? "Not Active" : "Active";
    const currentInstance = currentAgent.whatsappInstance;

    const updated = agents.map(agent => {
      if (agent.id === targetId) {
        const u = { ...agent, status: newStatus };
        updatedAgentToSync = u;
        return u;
      } else {
        // Enforce same WhatsApp Instance unique Active limit
        if (newStatus === "Active" && currentInstance && agent.whatsappInstance === currentInstance && agent.status === "Active") {
          const deact = { ...agent, status: "Not Active" };
          otherDeactivatedAgents.push(deact);
          return deact;
        }
        return agent;
      }
    });

    setAgents(updated);
    saveAgentsToServer(updated, sessionToken, false);

    if (targetId === activeId) {
      setStatus(newStatus);
    }

    if (updatedAgentToSync) {
      handleSyncToWebhook(updatedAgentToSync, false);
    }

    for (const deact of otherDeactivatedAgents) {
      handleSyncToWebhook(deact, false);
    }
  };

  // Log out of session
  const logout = async () => {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionToken || localStorage.getItem("cyber_session_token")}`
        }
      });
    } catch (e) {
      console.error("Logout request failed:", e);
    }
    localStorage.setItem("has_logged_out", "true");
    localStorage.removeItem("cyber_session_token");
    setSessionToken("");
    setSessionUser(null);
    setIsAuthenticated(false);
  };

  // Synchronize to n8n Webhook (POST Proxy)
  const handleSyncToWebhook = async (agentOverride?: AgentConfig, isNewBot?: boolean) => {
    setIsSyncing(true);
    setSyncStatus("idle");
    setSyncMessage("");
    
    // Resolve states or overrides
    const targetId = agentOverride ? agentOverride.id : activeId;
    const activeAgent = agents.find(a => a.id === targetId);
    
    // Explicitly check if we are dealing with a new bot.
    // If isNewBot is defined, use it. Otherwise, look at whether the agent has a lastSyncedAt timestamp yet.
    // If there is no lastSyncedAt timestamp, it's a first-time sync for a new bot.
    const resolvedIsNewBot = isNewBot !== undefined 
      ? isNewBot 
      : (activeAgent ? !activeAgent.lastSyncedAt : true);

    const currentOwnerName = agentOverride ? agentOverride.ownerName : ownerName;
    const currentBusinessName = agentOverride ? agentOverride.businessName : businessName;
    const currentOwnerPhone = agentOverride ? agentOverride.ownerPhone : ownerPhone;
    const currentBotId = agentOverride ? agentOverride.botId : botId;
    const currentWhatsappInstance = agentOverride ? agentOverride.whatsappInstance : whatsappInstance;
    
    // Compile dynamic unified businessPrompt if override is active, else use current state
    const currentBusinessPrompt = agentOverride 
      ? compilePromptFromParts(
          agentOverride.botIdentity || "",
          agentOverride.coursesInfo || "",
          agentOverride.kidsCourses || "",
          agentOverride.conversationFlow || "",
          agentOverride.writingStyle || "",
          agentOverride.faqAnswers || "",
          agentOverride.whatNotToDo || "",
          agentOverride.syllabusLinks || "",
          agentOverride.humanEscalation || "",
          agentOverride.imagesInfo || "",
          agentOverride.videosInfo || ""
        )
      : businessPrompt;
      
    const currentKey = agentOverride ? agentOverride.key : key;
    const currentLeadFollowUpDays = agentOverride ? agentOverride.leadFollowUpDays : leadFollowUpDays;
    const currentAgentEmail = agentOverride ? agentOverride.agentEmail : agentEmail;
    const currentStatus = agentOverride ? (agentOverride.status || "Not Active") : (status || "Not Active");
    
    const currentBotIdentity = agentOverride ? agentOverride.botIdentity : botIdentity;
    const currentCoursesInfo = agentOverride ? agentOverride.coursesInfo : coursesInfo;
    const currentKidsCourses = agentOverride ? agentOverride.kidsCourses : kidsCourses;
    const currentConversationFlow = agentOverride ? agentOverride.conversationFlow : conversationFlow;
    const currentWritingStyle = agentOverride ? agentOverride.writingStyle : writingStyle;
    const currentFaqAnswers = agentOverride ? agentOverride.faqAnswers : faqAnswers;
    const currentWhatNotToDo = agentOverride ? agentOverride.whatNotToDo : whatNotToDo;
    const currentSyllabusLinks = agentOverride ? agentOverride.syllabusLinks : syllabusLinks;
    const currentHumanEscalation = agentOverride ? agentOverride.humanEscalation : humanEscalation;
    const currentImagesInfo = agentOverride ? agentOverride.imagesInfo : imagesInfo;
    const currentVideosInfo = agentOverride ? agentOverride.videosInfo : videosInfo;
    
    const currentName = agentOverride 
      ? (agentOverride.name || `${currentBusinessName} _ ${agentOverride.agentType === "support" ? "תמיכה טכנית" : "מכירות"}`) 
      : (name || `${currentBusinessName} _ ${agentType === "support" ? "תמיכה טכנית" : "מכירות"}`);
    const currentAgentType = agentOverride 
      ? (agentOverride.agentType || "sales") 
      : agentType;
    
    const payload = {
      // Direct core fields requested
      ownerName: currentOwnerName,
      businessName: currentBusinessName,
      ownerPhone: currentOwnerPhone,
      botId: currentBotId,
      name: currentName,
      agentType: currentAgentType,
      "שם": currentName,
      "סוג": currentAgentType === "support" ? "תמיכה טכנית" : "מכירות",
      "שם הבוט": currentName,
      "סוג הבוט": currentAgentType === "support" ? "תמיכה טכנית" : "מכירות",
      whatsappInstance: currentWhatsappInstance,
      businessPrompt: currentBusinessPrompt,
      key: currentKey,
      leadFollowUpDays: currentLeadFollowUpDays,
      agentEmail: currentAgentEmail,
      "קהל יעד": currentKidsCourses,
      "קבל יעד": currentKidsCourses,
      Status: currentStatus,
      status: currentStatus,
      "סטטוס": currentStatus === "Active" ? "פעיל" : "לא פעיל",
      "מצב": currentStatus,
      "מצב בוט": currentStatus,
      
      // Separate prompt parts
      botIdentity: currentBotIdentity,
      coursesInfo: currentCoursesInfo,
      kidsCourses: currentKidsCourses,
      conversationFlow: currentConversationFlow,
      writingStyle: currentWritingStyle,
      faqAnswers: currentFaqAnswers,
      whatNotToDo: currentWhatNotToDo,
      syllabusLinks: currentSyllabusLinks,
      humanEscalation: currentHumanEscalation,
      imagesInfo: currentImagesInfo,
      videosInfo: currentVideosInfo,
      
      // Hebrew mapping for database filter compatibility
      "שם בעל העסק": currentOwnerName,
      "שם העסק": currentBusinessName,
      "טלפון בעל העסק": currentOwnerPhone,
      "Bot ID": currentBotId,
      "שם ואטסאפ instance": currentWhatsappInstance,
      "פרומפט עיסקי": currentBusinessPrompt,
      "Key": currentKey,
      "זמן למעקב אחרי ליד בימים": currentLeadFollowUpDays,
      "אימייל משויך לסוכן": currentAgentEmail,

      // Hebrew mapping for separate prompt parts
      "זהות הבוט": currentBotIdentity,
      "מה אני מוכר — קורסים": currentCoursesInfo,
      "קורסי ילדים": currentKidsCourses,
      "קהל יעד וסיגמנטים מיוחדים": currentKidsCourses,
      "זרימת שיחה": currentConversationFlow,
      "טון ואופן כתיבה": currentWritingStyle,
      "תשובות לשאלות נפוצות": currentFaqAnswers,
      "מה לא לעשות": currentWhatNotToDo,
      "לינקים לסילבוסים": currentSyllabusLinks,
      "אסקלציה לאנוש": currentHumanEscalation,
      "תמונות וגלריה": currentImagesInfo,
      "סרטוני וידאו": currentVideosInfo,

      // Metadata properties
      timestamp: new Date().toISOString(),
      source: "עסק חכם - סוכנים דיגיטליים",
      systemId: "ais-agent-configurator",
      isNewBot: resolvedIsNewBot,
      IsNewBot: resolvedIsNewBot,
      "בוט חדש": resolvedIsNewBot,
      
      // Webhook URL option to bypass hardcoding
      webhookUrl: webhookUrl || undefined
    };

    try {
      const response = await apiFetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncStatus("success");
        setSyncMessage("השמירה והסנכרון בוצעו בהצלחה! 🚀");
        
        // Update last synced timestamps using a functional state updater to avoid stale state closures
        const nowStr = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + " - " + new Date().toLocaleDateString('he-IL');
        const targetId = agentOverride ? agentOverride.id : activeId;
        
        setAgents(prevAgents => {
          const freshUpdated = prevAgents.map(agent => {
            if (agent.id === targetId) {
              return { ...agent, lastSyncedAt: nowStr };
            }
            return agent;
          });
          saveAgentsToServer(freshUpdated, sessionToken, false);
          return freshUpdated;
        });
        setDirtyAgents(prev => ({ ...prev, [targetId]: false }));
      } else {
        setSyncStatus("error");
        setSyncMessage(data.error || "נכשל בסנכרון הנתונים");
      }
    } catch (err: any) {
      console.error("Webhook network error:", err);
      setSyncStatus("error");
      setSyncMessage("שגיאת תקשורת: ודא שחיבור האינטרנט פעיל ושרת ה-Proxy פועל כנדרש.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual save click handler for prompt editor
  const handleManualSavePrompt = async (closeAfter = false) => {
    // 1. Force immediate server save of current agents array to /api/agents (no debounce)
    if (globalSaveTimeoutId) {
      clearTimeout(globalSaveTimeoutId);
    }
    await saveAgentsToServer(agents, sessionToken, false);

    // 2. Trigger the webhook synchronization
    await handleSyncToWebhook();

    // 3. Show toast and optionally close
    setShowSaveToast(true);
    setTimeout(() => {
      setShowSaveToast(false);
      if (closeAfter) {
        setShowPromptBuilder(false);
      }
    }, closeAfter ? 650 : 2500);
  };

  // Cancel edits and close the prompt builder
  const handleCancelPromptChanges = async () => {
    if (globalSaveTimeoutId) {
      clearTimeout(globalSaveTimeoutId);
    }
    if (promptBuilderBackup) {
      // Revert back to the backup's agents array values
      const restored = agents.map(agent => {
        if (agent.id === promptBuilderBackup.id) {
          return promptBuilderBackup;
        }
        return agent;
      });
      setAgents(restored);

      // Load the restored values back to form states
      loadAgentToForm(promptBuilderBackup);

      // Persist restored array back to the server immediately
      await saveAgentsToServer(restored, sessionToken, false);

      // Reset dirty state to false
      setDirtyAgents(prev => ({ ...prev, [promptBuilderBackup.id]: false }));
    }
    setShowPromptBuilder(false);
  };

  // Pull configurations FROM n8n Webhook GET URL and update local fields
  const handlePullConfigFromN8n = async () => {
    setIsSyncing(true);
    setSyncStatus("idle");
    setSyncMessage("");
    
    try {
      console.log("[CLIENT] Pulling live settings from n8n GET endpoint proxy with URL:", webhookUrl, "for Bot ID:", botId);
      const res = await apiFetch(`/api/fetch-config?url=${encodeURIComponent(webhookUrl)}&botId=${encodeURIComponent(botId)}`, {
        headers: {
          "Authorization": `Bearer ${sessionToken}`
        }
      });
      
      if (!res.ok) {
        let errMsg = `שגיאת קריאה: קוד ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) {
            errMsg = `${errData.error}${errData.details ? `: ${errData.details}` : ""}`;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errMsg);
      }
      
      const result = await res.json();
      if (result.success && result.data) {
        let raw = result.data;
        
        // If n8n returns an array, unpack the first element
        if (Array.isArray(raw)) {
          raw = raw[0] || {};
        }
        
        // Smart keys parser (supports English, Hebrew, space variations, and safely handles numbers)
        const getVal = (keys: string[]): string => {
          for (const k of keys) {
            if (raw[k] !== undefined && raw[k] !== null) {
              return String(raw[k]).trim();
            }
          }
          return "";
        };

        const pulledOwnerName = getVal(["ownerName", "שם בעל העסק"]);
        const pulledBusinessName = getVal(["businessName", "שם העסק"]);
        const pulledOwnerPhone = getVal(["ownerPhone", "טלפון בעל העסק"]);
        const pulledBotId = getVal(["botId", "Bot ID"]);
        const pulledAgentTypeRaw = getVal(["agentType", "סוג", "סוג הבוט"]);
        const pulledAgentType: "sales" | "support" = (pulledAgentTypeRaw.includes("תמיכה") || pulledAgentTypeRaw.toLowerCase().includes("support")) ? "support" : "sales";
        const pulledNameRaw = getVal(["name", "שם", "שם הבוט"]);
        const pulledName = pulledNameRaw || (pulledBusinessName ? `${pulledBusinessName} _ ${pulledAgentType === "support" ? "תמיכה טכנית" : "מכירות"}` : "");
        const pulledWhatsappInstance = getVal([
          "whatsappInstance", 
          "שם ואטסאפ instance", 
          "שם ואטסאפ instance ", 
          "שם וואטסאפ instance", 
          "שם וואטסאפ instance "
        ]);
        const pulledBusinessPrompt = getVal(["businessPrompt", "פרומפט עיסקי", "פרומפט עסקי"]);
        const pulledKey = getVal(["key", "Key", "מפתח"]);
        const pulledLeadFollowUpDays = getVal(["leadFollowUpDays", "זמן למעקב אחרי ליד בימים"]) || "3";
        const pulledAgentEmail = getVal(["agentEmail", "mail", "email", "אימייל משויך לסוכן", "אימייל משויך", "אימייל"]);
        const pulledStatusRaw = getVal(["status", "Status", "מצב", "סטטוס", "מצב בוט"]);
        const pulledStatus = (pulledStatusRaw.toLowerCase().includes("not") || pulledStatusRaw.includes("לא פעיל")) ? "Not Active" : "Active";

        const pulledBotIdentity = getVal(["botIdentity", "זהות הבוט"]);
        const pulledCoursesInfo = getVal(["coursesInfo", "מה אני מוכר — קורסים", "מה אני מוכר - קורסים", "מה אני מוכר"]);
        const pulledKidsCourses = getVal(["kidsCourses", "קהל יעד", "קורסי ילדים", "קורסים לילדים"]);
        const pulledConversationFlow = getVal(["conversationFlow", "זרימת שיחה", "תסריט שיחה"]);
        const pulledWritingStyle = getVal(["writingStyle", "טון ואופן כתיבה", "סגנון כתיבה"]);
        const pulledFaqAnswers = getVal(["faqAnswers", "תשובות לשאלות נפוצות", "שאלות נפוצות"]);
        const pulledWhatNotToDo = getVal(["whatNotToDo", "מה לא לעשות", "איסורים"]);
        const pulledSyllabusLinks = getVal(["syllabusLinks", "לינקים לסילבוסים", "קישורים לסילבוסים"]);
        const pulledHumanEscalation = getVal(["humanEscalation", "אסקלציה לאנוש", "העברה לאנוש"]);
        const pulledImagesInfo = getVal(["imagesInfo", "תמונות וגלריה", "image", "images", "gallery", "תמונות", "גלריה"]);
        const pulledVideosInfo = getVal(["videosInfo", "סרטוני וידאו", "video", "videos", "סרטונים", "וידאו"]);

        // If pulled data has no separate fields, extract from unified businessPrompt
        let finalBotIdentity = pulledBotIdentity;
        let finalCoursesInfo = pulledCoursesInfo;
        let finalKidsCourses = pulledKidsCourses;
        let finalConversationFlow = pulledConversationFlow;
        let finalWritingStyle = pulledWritingStyle;
        let finalFaqAnswers = pulledFaqAnswers;
        let finalWhatNotToDo = pulledWhatNotToDo;
        let finalSyllabusLinks = pulledSyllabusLinks;
        let finalHumanEscalation = pulledHumanEscalation;
        let finalImagesInfo = pulledImagesInfo;
        let finalVideosInfo = pulledVideosInfo;

        if (
          !finalBotIdentity &&
          !finalCoursesInfo &&
          !finalKidsCourses &&
          !finalConversationFlow &&
          !finalWritingStyle &&
          !finalFaqAnswers &&
          !finalWhatNotToDo &&
          !finalSyllabusLinks &&
          !finalHumanEscalation &&
          !finalImagesInfo &&
          !finalVideosInfo
        ) {
          const parts = getOrExtractBypassParts({
            id: activeId,
            ownerName: pulledOwnerName,
            businessName: pulledBusinessName,
            ownerPhone: pulledOwnerPhone,
            botId: pulledBotId,
            whatsappInstance: pulledWhatsappInstance,
            businessPrompt: pulledBusinessPrompt,
            key: pulledKey
          });
          finalBotIdentity = parts.botIdentity;
          finalCoursesInfo = parts.coursesInfo;
          finalKidsCourses = parts.kidsCourses;
          finalConversationFlow = parts.conversationFlow;
          finalWritingStyle = parts.writingStyle;
          finalFaqAnswers = parts.faqAnswers;
          finalWhatNotToDo = parts.whatNotToDo;
          finalSyllabusLinks = parts.syllabusLinks;
          finalHumanEscalation = parts.humanEscalation;
          finalImagesInfo = parts.imagesInfo || "";
          finalVideosInfo = parts.videosInfo || "";
        }

        const compiled = compilePromptFromParts(
          finalBotIdentity,
          finalCoursesInfo,
          finalKidsCourses,
          finalConversationFlow,
          finalWritingStyle,
          finalFaqAnswers,
          finalWhatNotToDo,
          finalSyllabusLinks,
          finalHumanEscalation,
          finalImagesInfo,
          finalVideosInfo
        );

        if (!pulledBusinessName && !pulledBotId) {
          setSyncStatus("error");
          setSyncMessage("התקבלו נתונים מעורפלים או ריקים מהשרת. ודא שהסוכן קיים שם ושהמפתחות תקינים.");
          return;
        }
        
        // Update form states
        setOwnerName(pulledOwnerName);
        setBusinessName(pulledBusinessName);
        setOwnerPhone(pulledOwnerPhone);
        setBotId(pulledBotId);
        setWhatsappInstance(pulledWhatsappInstance);
        setBusinessPrompt(compiled);
        setKey(pulledKey);
        setLeadFollowUpDays(pulledLeadFollowUpDays);
        setStatus(pulledStatus);
        setName(pulledName);
        setAgentType(pulledAgentType);
        if (pulledAgentEmail) {
          setAgentEmail(pulledAgentEmail);
        }

        setBotIdentity(finalBotIdentity);
        setCoursesInfo(finalCoursesInfo);
        setKidsCourses(finalKidsCourses);
        setConversationFlow(finalConversationFlow);
        setWritingStyle(finalWritingStyle);
        setFaqAnswers(finalFaqAnswers);
        setWhatNotToDo(finalWhatNotToDo);
        setSyllabusLinks(finalSyllabusLinks);
        setHumanEscalation(finalHumanEscalation);
        setImagesInfo(finalImagesInfo);
        setVideosInfo(finalVideosInfo);
        
        // Sync active agent listing records
        const updated = agents.map(agent => {
          if (agent.id === activeId) {
            return {
              ...agent,
              ownerName: pulledOwnerName,
              businessName: pulledBusinessName,
              ownerPhone: pulledOwnerPhone,
              botId: pulledBotId,
              whatsappInstance: pulledWhatsappInstance,
              businessPrompt: compiled,
              key: pulledKey,
              leadFollowUpDays: pulledLeadFollowUpDays,
              agentEmail: pulledAgentEmail || agent.agentEmail || (sessionUser?.email || ""),
              status: pulledStatus,
              name: pulledName,
              agentType: pulledAgentType,
              botIdentity: finalBotIdentity,
              coursesInfo: finalCoursesInfo,
              kidsCourses: finalKidsCourses,
              conversationFlow: finalConversationFlow,
              writingStyle: finalWritingStyle,
              faqAnswers: finalFaqAnswers,
              whatNotToDo: finalWhatNotToDo,
              syllabusLinks: finalSyllabusLinks,
              humanEscalation: finalHumanEscalation,
              imagesInfo: finalImagesInfo,
              videosInfo: finalVideosInfo,
              lastSyncedAt: `עודכן ונשמר ב-${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
            };
          }
          return agent;
        });

        setAgents(updated);
        saveAgentsToServer(updated);
        
        setSyncStatus("success");
        setSyncMessage("נתוני הסוכן נמשכו בהצלחה מקראית הנתונים מהשרת והוזנו למסך! 🔄");
      } else {
        setSyncStatus("error");
        setSyncMessage(result.error || "נכשל בפענוח הנתונים מהשרת");
      }
    } catch (err: any) {
      console.error("Pull config error:", err);
      setSyncStatus("error");
      setSyncMessage(`שגיאה במשיכת הנתונים מהשרת: ${err.message || String(err)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Pull ALL configurations from n8n GET Webhook for the system administrator
  const handlePullAllAgentsFromN8n = async (customToken?: string, customWebhookUrl?: string) => {
    const tokenToUse = customToken || sessionToken;
    const urlToUse = customWebhookUrl || webhookUrl || DEFAULT_WEBHOOK_URL;
    if (!tokenToUse) return;

    setIsPullingAll(true);
    setSyncStatus("idle");
    setSyncMessage("");

    try {
      console.log("[CLIENT] Pulling ALL configuration presets from n8n GET Webhook (botId=*):", urlToUse);
      const res = await apiFetch(`/api/fetch-config?url=${encodeURIComponent(urlToUse)}&botId=*`, {
        headers: {
          "Authorization": `Bearer ${tokenToUse}`
        }
      });
      
      if (!res.ok) {
        let errMsg = `שגיאת קריאה: קוד ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) {
            errMsg = `${errData.error}${errData.details ? `: ${errData.details}` : ""}`;
          }
        } catch (e) {
          // ignore
        }
        throw new Error(errMsg);
      }
      
      const result = await res.json();
      if (result.success && result.data) {
        let rawList = result.data;
        if (!Array.isArray(rawList)) {
          rawList = rawList ? [rawList] : [];
        }
        
        if (rawList.length === 0) {
          console.warn("[CLIENT] Empty agent list returned from server");
          setSyncStatus("error");
          setSyncMessage("לא נמצאו פרויקטים תקינים בשרת.");
          return;
        }

        const getVal = (item: any, keys: string[]): string => {
          for (const k of keys) {
            if (item[k] !== undefined && item[k] !== null) {
              return String(item[k]).trim();
            }
          }
          return "";
        };

        const parsedAgents: AgentConfig[] = rawList.map((item: any, idx: number) => {
          const pulledOwnerName = getVal(item, ["ownerName", "שם בעל העסק"]);
          const pulledBusinessName = getVal(item, ["businessName", "שם העסק"]) || `פרויקט מה-Webhook ${idx + 1}`;
          const pulledOwnerPhone = getVal(item, ["ownerPhone", "טלפון בעל העסק"]);
          const pulledBotId = getVal(item, ["botId", "Bot ID"]);
          const pulledAgentTypeRaw = getVal(item, ["agentType", "סוג", "סוג הבוט"]);
          const pulledAgentType: "sales" | "support" = (pulledAgentTypeRaw.includes("תמיכה") || pulledAgentTypeRaw.toLowerCase().includes("support")) ? "support" : "sales";
          const pulledNameRaw = getVal(item, ["name", "שם", "שם הבוט"]);
          const pulledName = pulledNameRaw || (pulledBusinessName ? `${pulledBusinessName} _ ${pulledAgentType === "support" ? "תמיכה טכנית" : "מכירות"}` : "");
          const pulledWhatsappInstance = getVal(item, [
            "whatsappInstance", 
            "שם ואטסאפ instance", 
            "שם ואטסאפ instance ", 
            "שם וואטסאפ instance", 
            "שם וואטסאפ instance "
          ]);
          const pulledBusinessPrompt = getVal(item, ["businessPrompt", "פרומפט עיסקי", "פרומפט עסקי"]);
          const pulledKey = getVal(item, ["key", "Key", "מפתח"]);
          const pulledLeadFollowUpDays = getVal(item, ["leadFollowUpDays", "זמן למעקב אחרי ליד בימים"]) || "3";
          const pulledAgentEmail = getVal(item, ["agentEmail", "mail", "email", "אימייל משויך לסוכן", "אימייל משויך", "אימייל"]) || "haim.bar@gmail.com";
          const pulledStatusRaw = getVal(item, ["status", "Status", "מצב", "סטטוס", "מצב בוט"]);
          const pulledStatus = (pulledStatusRaw.toLowerCase().includes("not") || pulledStatusRaw.includes("לא פעיל")) ? "Not Active" : "Active";

          const pulledBotIdentity = getVal(item, ["botIdentity", "זהות הבוט"]);
          const pulledCoursesInfo = getVal(item, ["coursesInfo", "מה אני מוכר — קורסים", "מה אני מוכר - קורסים", "מה אני מוכר"]);
          const pulledKidsCourses = getVal(item, ["kidsCourses", "קהל יעד", "קורסי ילדים", "קורסים לילדים"]);
          const pulledConversationFlow = getVal(item, ["conversationFlow", "זרימת שיחה", "תסריט שיחה"]);
          const pulledWritingStyle = getVal(item, ["writingStyle", "טון ואופן כתיבה", "סגנון כתיבה"]);
          const pulledFaqAnswers = getVal(item, ["faqAnswers", "תשובות לשאלות נפוצות", "שאלות נפוצות"]);
          const pulledWhatNotToDo = getVal(item, ["whatNotToDo", "מה לא לעשות", "איסורים"]);
          const pulledSyllabusLinks = getVal(item, ["syllabusLinks", "לינקים לסילבוסים", "קישורים לסילבוסים"]);
          const pulledHumanEscalation = getVal(item, ["humanEscalation", "אסקלציה לאנוש", "העברה לאנוש"]);
          const pulledImagesInfo = getVal(item, ["imagesInfo", "תמונות וגלריה", "image", "images", "gallery", "תמונות", "גלריה"]);
          const pulledVideosInfo = getVal(item, ["videosInfo", "סרטוני וידאו", "video", "videos", "סרטונים", "וידאו"]);

          let finalBotIdentity = pulledBotIdentity;
          let finalCoursesInfo = pulledCoursesInfo;
          let finalKidsCourses = pulledKidsCourses;
          let finalConversationFlow = pulledConversationFlow;
          let finalWritingStyle = pulledWritingStyle;
          let finalFaqAnswers = pulledFaqAnswers;
          let finalWhatNotToDo = pulledWhatNotToDo;
          let finalSyllabusLinks = pulledSyllabusLinks;
          let finalHumanEscalation = pulledHumanEscalation;
          let finalImagesInfo = pulledImagesInfo;
          let finalVideosInfo = pulledVideosInfo;

          const agentId = pulledBotId ? `agent_${pulledBotId}` : `agent_cloud_${Date.now()}_${idx}`;

          if (
            !finalBotIdentity &&
            !finalCoursesInfo &&
            !finalKidsCourses &&
            !finalConversationFlow &&
            !finalWritingStyle &&
            !finalFaqAnswers &&
            !finalWhatNotToDo &&
            !finalSyllabusLinks &&
            !finalHumanEscalation &&
            !finalImagesInfo &&
            !finalVideosInfo
          ) {
            const parts = getOrExtractBypassParts({
              id: agentId,
              ownerName: pulledOwnerName,
              businessName: pulledBusinessName,
              ownerPhone: pulledOwnerPhone,
              botId: pulledBotId,
              whatsappInstance: pulledWhatsappInstance,
              businessPrompt: pulledBusinessPrompt,
              key: pulledKey
            });
            finalBotIdentity = parts.botIdentity;
            finalCoursesInfo = parts.coursesInfo;
            finalKidsCourses = parts.kidsCourses;
            finalConversationFlow = parts.conversationFlow;
            finalWritingStyle = parts.writingStyle;
            finalFaqAnswers = parts.faqAnswers;
            finalWhatNotToDo = parts.whatNotToDo;
            finalSyllabusLinks = parts.syllabusLinks;
            finalHumanEscalation = parts.humanEscalation;
            finalImagesInfo = parts.imagesInfo || "";
            finalVideosInfo = parts.videosInfo || "";
          }

          const compiled = compilePromptFromParts(
            finalBotIdentity,
            finalCoursesInfo,
            finalKidsCourses,
            finalConversationFlow,
            finalWritingStyle,
            finalFaqAnswers,
            finalWhatNotToDo,
            finalSyllabusLinks,
            finalHumanEscalation,
            finalImagesInfo,
            finalVideosInfo
          );

          return {
            id: agentId,
            ownerName: pulledOwnerName,
            businessName: pulledBusinessName,
            ownerPhone: pulledOwnerPhone,
            botId: pulledBotId,
            whatsappInstance: pulledWhatsappInstance,
            businessPrompt: compiled,
            key: pulledKey,
            leadFollowUpDays: pulledLeadFollowUpDays,
            agentEmail: pulledAgentEmail,
            status: pulledStatus,
            name: pulledName,
            agentType: pulledAgentType,
            botIdentity: finalBotIdentity,
            coursesInfo: finalCoursesInfo,
            kidsCourses: finalKidsCourses,
            conversationFlow: finalConversationFlow,
            writingStyle: finalWritingStyle,
            faqAnswers: finalFaqAnswers,
            whatNotToDo: finalWhatNotToDo,
            syllabusLinks: finalSyllabusLinks,
            humanEscalation: finalHumanEscalation,
            imagesInfo: finalImagesInfo,
            videosInfo: finalVideosInfo,
            lastSyncedAt: `עודכן ונשמר ב-${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
          };
        });

        if (parsedAgents.length > 0) {
          setAgents(parsedAgents);
          const currentId = activeId;
          const matchingAgent = parsedAgents.find((a: any) => a.id === currentId);
          const targetAgent = matchingAgent || parsedAgents[0];
          setActiveId(targetAgent.id);
          loadAgentToForm(targetAgent);
          saveAgentsToServer(parsedAgents, tokenToUse);
          
          setSyncStatus("success");
          setSyncMessage(`יובאו וסונכרנו בהצלחה ${parsedAgents.length} פרויקטים/סוכנים! 🚀`);
        }
      }
    } catch (e: any) {
      console.error("[CLIENT] Failed to pull all agents:", e);
      setSyncStatus("error");
      setSyncMessage(`שגיאה במשיכת כל הפרויקטים מהשרת: ${e.message || String(e)}`);
    } finally {
      setIsPullingAll(false);
    }
  };

  // Security Panel - Save server configuration changes
  const handleSaveSecuritySettings = async () => {
    setIsSavingSecuritySettings(true);
    setSecurityFeedback(null);

    try {
      const res = await apiFetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          googleClientId: securityGoogleClientId,
          allowedEmails: securityAllowedEmails,
          bypassUsers: securityBypassUsers
        })
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setGoogleClientId(securityGoogleClientId);
        setAllowedEmails(securityAllowedEmails);
        setBypassUsers(securityBypassUsers);
        setSecurityFeedback({ type: "success", message: "הגדרות האבטחה וההרשאות נשמרו בשרת בהצלחה!" });
        
        setTimeout(() => {
          setSecurityFeedback(null);
        }, 3000);
      } else {
        setSecurityFeedback({ type: "error", message: result.message || "נכשל בשמירת ההגדרות בשרת" });
      }
    } catch (err: any) {
      setSecurityFeedback({ type: "error", message: "שגיאת תקשורת עם שרת האבטחה" });
    } finally {
      setIsSavingSecuritySettings(false);
    }
  };

  // Add an email to local changes in modal
  const handleAddEmailToSecurity = () => {
    const email = newAllowedEmailInput.trim().toLowerCase();
    if (!email) return;
    if (securityAllowedEmails.includes(email)) {
      setNewAllowedEmailInput("");
      return;
    }
    setSecurityAllowedEmails([...securityAllowedEmails, email]);
    setNewAllowedEmailInput("");
  };

  // Remove email from security settings array
  const handleRemoveEmailFromSecurity = (emailToRemove: string) => {
    if (emailToRemove === "haim.bar@gmail.com") {
      alert("לא ניתן למחוק את האימייל הראשי המנהל של חיים בר.");
      return;
    }
    setSecurityAllowedEmails(securityAllowedEmails.filter(email => email !== emailToRemove));
  };

  // Add bypass user credentials in modal
  const handleAddBypassUser = () => {
    const name = newBypassName.trim();
    const email = newBypassEmail.trim().toLowerCase();
    const passcode = newBypassPasscode.trim();

    if (!name || !email || !passcode) {
      setSecurityFeedback({ type: "error", message: "נא למלא את כל השדות להוספת מפתח מעקף (שם, אימייל וססמה/טלפון)" });
      return;
    }

    if (securityBypassUsers.some(u => String(u.passcode).trim() === passcode)) {
      setSecurityFeedback({ type: "error", message: "ססמה/מפתח מעקף זה כבר קיים במערכת." });
      return;
    }

    setSecurityBypassUsers([...securityBypassUsers, { name, email, passcode }]);
    setNewBypassName("");
    setNewBypassEmail("");
    setNewBypassPasscode("");
    setSecurityFeedback(null);
  };

  // Remove bypass user credentials in modal
  const handleRemoveBypassUser = (passcodeToRemove: string) => {
    setSecurityBypassUsers(securityBypassUsers.filter(u => String(u.passcode).trim() !== passcodeToRemove));
  };

  // Filter list of agents in memory
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = 
      (agent.businessName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.ownerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (agent.botId || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === "active") {
      return agent.status === "Active";
    } else if (statusFilter === "inactive") {
      return agent.status !== "Active";
    }
    return true;
  });

  // Loading indicator for active checking
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#070709] text-slate-350 flex flex-col items-center justify-center gap-4 font-sans select-none" dir="rtl">
        <div className="relative flex items-center justify-center mb-2">
          <div className="absolute w-16 h-16 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
          <Bot className="w-8 h-8 text-indigo-400" />
        </div>
        <p className="text-sm font-bold tracking-wide animate-pulse">בודק הרשאות וחיבור למערכת...</p>
      </div>
    );
  }

  // Render Google Login Gateway screen when not authenticated
  if (!isAuthenticated) {
    if (isLandingPage) {
      const isLt = theme === "light";
      return (
        <div 
          style={{ zoom: 1.1 }} 
          className={`min-h-screen p-3 md:p-4 font-sans flex flex-col justify-between transition-all duration-300 ${
            isLt 
              ? "bg-slate-50 text-slate-700 bg-[radial-gradient(ellipse_at_top,_rgba(224,231,255,0.4))] from-indigo-50/50 via-slate-50 to-slate-100" 
              : "bg-[#070709] text-slate-300 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#07070a] to-[#040406]"
          }`} 
          dir="rtl"
        >
          {/* Header with brand and login trigger */}
          <div className={`max-w-6xl mx-auto w-full flex items-center justify-between pb-3 border-b mb-3 select-none ${isLt ? "border-slate-205 border-slate-200" : "border-slate-800/40"}`}>
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-xl border ${isLt ? "bg-indigo-50 border-indigo-150" : "bg-indigo-500/10 border-indigo-500/15"}`}>
                <Bot className={`w-5 h-5 ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
              </div>
              <div>
                <h2 className={`text-xs font-extrabold tracking-tight ${isLt ? "text-slate-900" : "text-white"}`}>עסק חכם • הדמיית בוטים</h2>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${isLt ? "text-indigo-600" : "text-indigo-450"}`}>Smart Sales Agents</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
                className={`p-1.5 px-2 rounded-lg border transition flex items-center gap-1.5 cursor-pointer text-[10px] font-bold ${
                  isLt 
                    ? "bg-white hover:bg-slate-50 text-slate-700 border-slate-200" 
                    : "bg-slate-900 text-slate-300 hover:text-sky-400 border-slate-800"
                }`}
                title={isLt ? "עבור למצב כהה" : "עבור למצב בהיר"}
              >
                {isLt ? <Moon className="w-3.5 h-3.5 text-slate-600" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                <span className="hidden sm:inline">{isLt ? "מצב כהה" : "מצב בהיר"}</span>
              </button>

              <button
                onClick={() => {
                  setAuthError("");
                  setIsLandingPage(false);
                }}
                className={`px-3 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                  isLt 
                    ? "bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border-slate-200 hover:border-slate-300" 
                    : "bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700"
                }`}
              >
                <Lock className={`w-3 h-3 ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                כניסת צוות ומנהלים
              </button>
            </div>
          </div>

          <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center py-1">
            <AnimatePresence mode="wait">
              {!demoResult && !isCreatingDemo && (
                <motion.div
                  key="form-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col gap-4 w-full"
                >
                  {/* Premium Brand Header (Centered) */}
                  <div className="flex flex-col items-center text-center gap-2 max-w-3xl mx-auto w-full select-none">
                    <div className="flex gap-2">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full w-fit border ${isLt ? "bg-indigo-50 border-indigo-150 text-indigo-700" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-300"}`}>
                        <Sparkles className={`w-3 h-3 animate-pulse ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                        <span className="text-[9px] font-bold">הדגמה ציבורית ללא עלות</span>
                      </div>
                      <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full w-fit text-[9px] font-bold border ${isLt ? "bg-sky-50 border-sky-150 text-sky-700" : "bg-sky-500/10 border-sky-500/20 text-sky-300"}`}>
                        <span>v2.4.5</span>
                      </div>
                    </div>

                    <h1 className={`text-2xl md:text-3xl font-black leading-tight tracking-tight ${isLt ? "text-slate-900" : "text-white"}`}>
                      ניצור לך בוט מכירות חכם{" "}
                      <span className="bg-gradient-to-r from-indigo-505 from-indigo-500 to-sky-500 bg-clip-text text-transparent">
                        בתוך דקה אחת בלבד! 🤖
                      </span>
                    </h1>

                    <p className={`text-[11px] md:text-xs leading-normal max-w-md md:max-w-xl ${isLt ? "text-slate-600" : "text-slate-400"}`}>
                      הקלט היחיד שנדרש הוא כתובת האתר שמכילה את המידע על העסק.
                      ה-AI שלנו יסרוק את האתר, יחלץ את השירותים וייצור סוכן דיגיטלי מתוחכם ב-WhatsApp לעמידה ביעדי המכירות שלך – וברירת המחדל שלו תוגדר כבוט קיים!
                    </p>

                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${isLt ? "bg-emerald-50 border-emerald-150 text-emerald-700" : "bg-green-500/5 border-green-500/25 text-green-400"}`}>
                      <span className={`${isLt ? "text-emerald-600" : "text-emerald-400"} leading-none`}>✓</span>
                      <span>תיעדוף מוצרים ושירותים שבאמת מופיעים באתר שלך למכירה ישירה</span>
                    </div>
                  </div>

                  {/* Clean Interactive Side-by-Side Widescreen Form Container */}
                  <div className={`border rounded-2xl p-4 md:p-5.5 shadow-2xl relative overflow-hidden backdrop-blur-md w-full ${isLt ? "bg-white border-slate-205 border-slate-200/80 shadow-slate-200/40 text-slate-800" : "bg-[#0E0F14]/90 border-slate-800/95"}`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
                    
                    <form onSubmit={handleCreateDemoBot} className="flex flex-col gap-4">
                      {demoSubmitError && (
                        <div className={`p-2.5 rounded-xl border text-xs text-center font-medium leading-relaxed ${isLt ? "bg-red-50 border-red-150 text-red-700" : "bg-red-500/10 border-red-500/25 text-red-300"}`}>
                          {demoSubmitError}
                        </div>
                      )}

                      {/* Main Form Fields Layout: Side-by-Side */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-7 items-start">
                        
                        {/* Right Form Column: Primary Credentials & Inputs */}
                        <div className="flex flex-col gap-4 w-full">
                          <div className={`border-b pb-1.5 mb-0.5 ${isLt ? "border-slate-100" : "border-indigo-550/10"}`}>
                            <h2 className={`text-xs font-bold flex items-center gap-2 ${isLt ? "text-slate-800" : "text-white"}`}>
                              <Zap className={`w-3.5 h-3.5 ${isLt ? "text-indigo-650 text-indigo-600 animate-pulse" : "text-indigo-400 fill-indigo-400/20"}`} />
                              הזנת פרטים ליצירה מהירה
                            </h2>
                            <p className={`text-[10px] leading-relaxed mt-0.5 ${isLt ? "text-slate-500 relative" : "text-slate-450"}`}>
                              רושמים פרטים בסיסיים, ושלב הסריקה מתחיל מיידית.
                            </p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className={`text-[11px] font-bold flex items-center gap-1.5 ${isLt ? "text-slate-700" : "text-slate-300"}`}>
                              <Globe className={`w-3 h-3 ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                              כתובת אתר העסק (URL) <span className="text-red-400 font-bold">*</span>:
                            </label>
                            <input
                              type="text"
                              placeholder="לדוגמה: www.mybusiness.co.il"
                              value={landingUrl}
                              onChange={(e) => setLandingUrl(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 transition duration-150 pl-8 font-mono text-left ${
                                isLt 
                                  ? "bg-slate-50 hover:bg-slate-100/30 focus:bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20" 
                                  : "bg-[#151720] border-slate-805 border-slate-800 text-white focus:border-indigo-500/85 focus:ring-indigo-500/30"
                              }`}
                              dir="ltr"
                              disabled={isCreatingDemo}
                            />
                            <span className={`text-[9px] leading-none ${isLt ? "text-slate-400" : "text-slate-500"}`}>האתר שממנו ה-AI יסרוק וישאב את מוצרי המכירות שלך</span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className={`text-[11px] font-bold flex items-center justify-between ${isLt ? "text-slate-700" : "text-slate-300"}`}>
                              <span className="flex items-center gap-1.5">
                                <Phone className={`w-3 h-3 ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                                טלפון בעל העסק לקבלת סיכומים <span className="text-red-500 font-bold">*</span>:
                              </span>
                              <span className="text-[9px] text-red-500 font-bold">חובה</span>
                            </label>
                            <CountryPhoneInput
                              id="landingPhone"
                              value={landingPhone}
                              onChange={(val, isValid, error) => {
                                setLandingPhone(val);
                                setLandingPhoneError(error);
                              }}
                              disabled={isCreatingDemo}
                              placeholder="רשום טלפון ללא קידומת"
                            />
                            {!landingPhoneError && (
                              <span className={`text-[9px] leading-none ${isLt ? "text-slate-400" : "text-slate-500"}`}>הכנס טלפון נייד לקבלת עדכונים וסיכומים של הבוט</span>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className={`text-[11px] font-bold flex items-center justify-between ${isLt ? "text-slate-700" : "text-slate-300"}`}>
                              <span className="flex items-center gap-1.5">
                                <User className={`w-3 h-3 ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                                שם נציג המכירות / התמיכה:
                              </span>
                              <span className="text-[9px] text-slate-500 font-normal">חובה</span>
                            </label>
                            <input
                              type="text"
                              placeholder="לדוגמה: חיים בר"
                              value={landingAgentName}
                              onChange={(e) => setLandingAgentName(e.target.value)}
                              className={`w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-1 transition duration-150 pl-8 font-medium text-right ${
                                isLt 
                                  ? "bg-slate-50 hover:bg-slate-100/30 focus:bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500/20" 
                                  : "bg-[#151720] border-slate-800 text-white focus:border-indigo-500/80 focus:ring-indigo-500"
                              }`}
                              disabled={isCreatingDemo}
                            />
                            <span className={`text-[9px] leading-none ${isLt ? "text-slate-400" : "text-slate-500"}`}>שם הנציג שהבוט יציג ויפנה אליו לקוחות</span>
                          </div>
                        </div>

                        {/* Left Form Column: Configuration & Rich Materials */}
                        <div className="flex flex-col gap-4 w-full">
                          <div className={`border-b pb-1.5 mb-0.5 ${isLt ? "border-slate-100" : "border-indigo-550/10"}`}>
                            <h2 className={`text-xs font-bold flex items-center gap-2 ${isLt ? "text-slate-800" : "text-white"}`}>
                              <Bot className={`w-3.5 h-3.5 ${isLt ? "text-indigo-600 animate-pulse" : "text-indigo-400 fill-indigo-400/20"}`} />
                              סוג הסוכן ותוספי ידע
                            </h2>
                            <p className={`text-[10px] leading-relaxed mt-0.5 ${isLt ? "text-slate-500" : "text-slate-455 text-slate-400"}`}>
                              קבע את המיומנות של הסוכן והוסף חומרי מידע מורחבים.
                            </p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className={`text-[11px] font-bold ${isLt ? "text-slate-700" : "text-slate-300"}`}>
                              סוג הסוכן הדיגיטלי (סוכן ברירת מחדל):
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setLandingAgentType("sales")}
                                disabled={isCreatingDemo}
                                className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl border text-center cursor-pointer transition-all duration-150 ${
                                  landingAgentType === "sales"
                                    ? isLt
                                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm shadow-indigo-100 font-bold"
                                      : "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/5 font-bold"
                                    : isLt
                                      ? "bg-slate-50 hover:bg-slate-100/30 border-slate-200 text-slate-500 font-normal"
                                      : "bg-[#151720] border-slate-800 text-slate-400 hover:border-slate-700 font-normal"
                                }`}
                              >
                                <span className="text-[10px]">סוכן מכירות</span>
                                <span className="text-[8px] opacity-70">חשיפה ומיומנות מכירה</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setLandingAgentType("support")}
                                disabled={isCreatingDemo}
                                className={`flex flex-col items-center gap-0.5 py-2 px-2 rounded-xl border text-center cursor-pointer transition-all duration-150 ${
                                  landingAgentType === "support"
                                    ? isLt
                                      ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm shadow-indigo-100 font-bold"
                                      : "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/5 font-bold"
                                    : isLt
                                      ? "bg-slate-50 hover:bg-slate-100/30 border-slate-200 text-slate-500 font-normal"
                                      : "bg-[#151720] border-slate-800 text-slate-400 hover:border-slate-700 font-normal"
                                }`}
                              >
                                <span className="text-[10px]">סוכן תמיכה טכנית</span>
                                <span className="text-[8px] opacity-70">פתרון תקלות ומדריכים</span>
                              </button>
                            </div>
                          </div>

                          <div 
                            className={`flex flex-col gap-1 p-2 rounded-2xl transition-all duration-150 ${
                              dragOverDemo 
                                ? isLt
                                  ? "bg-indigo-50 border-2 border-dashed border-indigo-400 scale-[1.01]"
                                  : "bg-indigo-950/20 border-2 border-dashed border-indigo-500 scale-[1.01]" 
                                : "bg-transparent border border-transparent"
                            }`}
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverDemo(true);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverDemo(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverDemo(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDragOverDemo(false);
                              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleFileSelect(e.dataTransfer.files[0]);
                              }
                            }}
                          >
                            <label className={`text-[11px] font-bold flex items-center justify-between ${isLt ? "text-slate-700" : "text-slate-300"}`}>
                              <span className="flex items-center gap-1.5">
                                <FileText className={`w-3 h-3 ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                                שדה טקסט חופשי / דפי מידע מורחבים וקבצי ידע:
                              </span>
                              <span className={`text-[8px] font-mono select-none ${isLt ? "text-indigo-700" : "text-indigo-300"}`}>גרור קבצים לכאן או הדבק</span>
                            </label>
                            <textarea
                              placeholder="הדבק כאן חומר נוסף על החברה, ברושורים, מחירונים... (או גרור קובץ ידע לכאן)"
                              value={landingAdditionalContext}
                              onChange={(e) => setLandingAdditionalContext(e.target.value)}
                              rows={2}
                              className={`w-full px-3 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-1 transition duration-150 resize-y ${
                                isLt
                                  ? "bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-550 focus:border-indigo-505/20 focus:border-indigo-500 focus:ring-indigo-500/20"
                                  : "bg-[#151720] border-slate-800 focus:border-indigo-500 text-slate-800 dark:text-white focus:ring-1 focus:ring-indigo-500/50"
                              }`}
                              disabled={isCreatingDemo}
                            />
                            <div className="border border-dashed border-indigo-300 dark:border-indigo-800/80 rounded-xl px-2.5 py-1.5 bg-indigo-50/30 dark:bg-indigo-950/10 flex items-center justify-between gap-2 overflow-hidden transition duration-150 mt-1">
                              <div className="flex flex-col text-right">
                                <span className="text-[9px] font-bold text-indigo-950 dark:text-indigo-250">
                                  {fileLoading ? "מעבד ומחלץ טקסט..." : "רוצה לטעון קובץ ידע? גרור לכאן או לחץ:"}
                                </span>
                                <span className="text-[8px] text-slate-500 dark:text-slate-450">
                                  מחלץ טקסט אוטומטית ממסמכים וקבצי ברושור (.pdf, .txt, .json, .csv, .md)
                                </span>
                              </div>
                              <label className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-indigo-300 focus:border-indigo-500 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 rounded-lg text-[9px] font-bold cursor-pointer transition shadow-sm select-none">
                                <Paperclip className="w-3 h-3 text-indigo-500" />
                                הוסף מסמך 📎
                                <input
                                  type="file"
                                  accept=".txt,.json,.csv,.md,.pdf"
                                  className="hidden"
                                  disabled={isCreatingDemo || fileLoading}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleFileSelect(file);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Wide Layout Form Action Button */}
                      <div className="pt-2 border-t border-slate-800/60">
                        <button
                          type="submit"
                          disabled={isCreatingDemo}
                          className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-indigo-600/10 cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                          {landingAgentType === "support" ? "ייצר בוט תמיכה טכנית חכם ב-60 שניות! 🚀" : "ייצר בוט מכירות חכם ב-60 שניות! 🚀"}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* Loader screen with custom Israeli Hebrew progress steps */}
              {isCreatingDemo && (
                <motion.div
                  key="loader-view"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`max-w-md mx-auto w-full border rounded-2xl p-8 shadow-2xl flex flex-col items-center justify-center text-center gap-6 ${
                    isLt ? "bg-white border-slate-200 text-slate-800 shadow-slate-100" : "bg-[#0E0F14]/90 border-slate-800 text-white"
                  }`}
                >
                  <div className="relative flex items-center justify-center mb-2">
                    <div className="absolute w-20 h-20 border-4 border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin"></div>
                    <Bot className={`w-10 h-10 animate-pulse ${isLt ? "text-indigo-600" : "text-indigo-400"}`} />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className={`text-base font-bold ${isLt ? "text-slate-950" : "text-white"}`}>ה-AI שלנו סורק ומייצר את הבוט...</h3>
                    <p className={`text-xs font-bold tracking-wide ${isLt ? "text-indigo-600" : "text-[#38BDF8]"}`}>זמן משוער: פחות מדקה לשלמות</p>
                  </div>

                  {/* Staggered progress logs from Haim Bar's request specifications */}
                  <div className={`w-full border rounded-xl p-4 flex flex-col gap-3 text-right ${
                    isLt ? "bg-slate-50 border-slate-200 text-slate-800" : "bg-[#151720] border-slate-800/80 text-white"
                  }`}>
                    {[
                      "🔍 סורק ומחלץ את המידע האמיתי מאתר האינטרנט של העסק...",
                      "🧠 מנתח את מוצרי העסק, יתרונותיו האמיתיים וקהל היעד באמצעות AI...",
                      "✍️ כותב ומלטש פרוมפט מכירות מושלם ומנוסח בעברית (חוסם הפניות לקורסים לא קשורים)...",
                      "🛡️ מגדיר את הערכים הגנריים: bot_generic_XYZ, סוכן Smarti ומקצה מפתח VIP...",
                      "🚀 מפיץ את הבוט החדש לעולם החופשי"
                    ].map((stepText, idx) => {
                      const isPast = idx < demoStep;
                      const isCurrent = idx === demoStep;
                      return (
                        <div key={idx} className="flex items-start gap-2.5 transition-all text-xs">
                          <span className={`shrink-0 ${
                            isPast 
                              ? "text-green-500" 
                              : isCurrent 
                                ? isLt ? "text-indigo-600 animate-pulse" : "text-indigo-400 animate-pulse" 
                                : isLt ? "text-slate-300" : "text-slate-600"
                          }`}>
                            {isPast ? "✓" : isCurrent ? "●" : "○"}
                          </span>
                          <span className={`${
                            isPast 
                              ? isLt ? "text-slate-400" : "text-slate-400" 
                              : isCurrent 
                                ? isLt ? "text-slate-800 font-extrabold" : "text-white font-bold" 
                                : isLt ? "text-slate-400" : "text-slate-600"
                          }`}>
                            {stepText}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Beautiful custom tailored success state and prompt visual preview */}
              {demoResult && (
                <motion.div
                  key="success-view"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`max-w-2xl mx-auto w-full border rounded-2xl p-4 md:p-5.5 shadow-2xl flex flex-col gap-4 ${
                    isLt ? "bg-white border-green-200 text-slate-800 shadow-slate-200/50" : "bg-[#0E0F14]/95 border border-green-500/20 text-white"
                  }`}
                >
                  {/* WhatsApp Bot Connection Box */}
                  <div className={`border rounded-2xl p-4 text-right flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg pb-4 border-b ${
                    isLt 
                      ? "bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50 border-emerald-200 text-slate-800" 
                      : "bg-gradient-to-r from-emerald-500/10 via-teal-500/15 to-emerald-500/10 border-emerald-500/20 text-white"
                  }`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 justify-start">
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-550 bg-green-500"></span>
                        </span>
                        <h4 className={`text-xs font-black ${isLt ? "text-slate-900" : "text-white"}`}>הבוט שלך נוצר ומוכן לשיחה! 🚀</h4>
                      </div>
                      <p className={`text-[11px] leading-normal max-w-md ${isLt ? "text-slate-600" : "text-slate-300"}`}>
                        מערכת ה-AI חיברה את הסוכן למספר WhatsApp הדינמי. לחץ על הכפתור כדי להתחיל בשיחה איתו כעת!
                      </p>
                    </div>
                    <a
                      href="https://wa.me/972503054731?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%91%D7%97%D7%95%D7%9F%20%D7%90%D7%AA%20%D7%94%D7%91%D7%95%D7%98%20%D7%A9%D7%99%D7%A6%D7%A8%D7%AA%D7%99"
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebd59] text-white font-black text-[11px] rounded-xl shadow-xl transition-all hover:scale-[1.02] active:scale-95 duration-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      💬 כנס לשיחה עם הבוט ב-WhatsApp
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                    <div className={`border rounded-xl p-3 flex flex-col gap-0.5 ${isLt ? "bg-slate-50 border-slate-200" : "bg-[#141620] border-slate-800"}`}>
                      <span className="text-[9px] text-slate-500 font-bold">שם בעל העסק</span>
                      <span className={`text-xs font-bold ${isLt ? "text-slate-905 text-slate-800" : "text-white"}`}>חיים בר</span>
                    </div>

                    <div className={`border rounded-xl p-3 flex flex-col gap-0.5 ${isLt ? "bg-slate-50 border-slate-200" : "bg-[#141620] border-slate-800"}`}>
                      <span className="text-[9px] text-slate-500 font-bold">שם העסק שזוהה</span>
                      <span className={`text-xs font-bold ${isLt ? "text-indigo-650 text-indigo-600" : "text-indigo-400"}`}>{demoResult.businessName}</span>
                    </div>

                    <div className={`border rounded-xl p-3 flex flex-col gap-0.5 ${isLt ? "bg-slate-50 border-slate-200" : "bg-[#141620] border-slate-800"}`}>
                      <span className="text-[9px] text-slate-500 font-bold">מספר טלפון לקבלת סיכומים</span>
                      <span className={`text-xs font-bold font-mono ${isLt ? "text-slate-805 text-slate-800" : "text-white"}`}>{demoResult.ownerPhone}</span>
                    </div>
                  </div>

                  {/* Scrollable preview of generated Sales System Prompts */}
                  <div className="flex flex-col gap-1.5 text-right">
                    <span className={`text-[11px] font-bold ${isLt ? "text-slate-700" : "text-slate-300"}`}>תצוגה מקדימה של פרומפט המכירות שהורכב ב-AI:</span>
                    <div className={`border rounded-xl p-3.5 max-h-52 overflow-y-auto text-xs leading-relaxed font-mono whitespace-pre-line scrollbar-thin ${
                      isLt 
                        ? "bg-slate-50 border-slate-200 text-slate-700" 
                        : "bg-[#0b0c10] border-slate-850 text-slate-300"
                    }`}>
                      <div className="font-sans md-preview-container">
                        <div className={`font-bold mb-1.5 ${isLt ? "text-indigo-600" : "text-indigo-400"}`}># פרומפט מכירות סלקטיבי מעולה ({demoResult.businessName})</div>
                        
                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>🤖 זהות הבוט</strong>
                          {demoResult.prompts.botIdentity}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>🛍️ שירותים ומוצרים מהאתר</strong>
                          {demoResult.prompts.coursesInfo}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>💎 חבילות והצעות מותאמות</strong>
                          {demoResult.prompts.kidsCourses}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>💬 זרימת שיחת וווטסאפ ממוקדת</strong>
                          {demoResult.prompts.conversationFlow}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>✍️ סגנון כתיבה ואימוג'י</strong>
                          {demoResult.prompts.writingStyle}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>❓ שאלות ותשובות (FAQ)</strong>
                          {demoResult.prompts.faqAnswers}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>🛑 חוקי ברזל ("מה לא לעשות")</strong>
                          {demoResult.prompts.whatNotToDo}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>🔗 קישורים מהסורק</strong>
                          {demoResult.prompts.syllabusLinks}
                        </div>

                        <div className="mb-2.5">
                          <strong className={`block mt-1.5 ${isLt ? "text-slate-900" : "text-white"}`}>🚨 {landingAgentType === "support" ? "אסקלציה לתמיכה טכנית" : "אסקלציה לסוכן מכירות"}</strong>
                          {demoResult.prompts.humanEscalation}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Premium Action trigger */}
                  <div className="mt-0.5 flex flex-col gap-2">
                    <button
                      onClick={() => setShowPremiumModal(true)}
                      className="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs transition-all duration-150 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950/10 animate-pulse" />
                      ערוך את הפרומפט וצפה בשיחות הבוט בזמן אמת 🌟
                    </button>
                  </div>

                  {/* Premium Feature Gate Overlay Modal */}
                  <AnimatePresence>
                    {showPremiumModal && (
                      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-[#0E0F14] border border-amber-500/30 rounded-2xl p-6 md:p-8 max-w-md w-full text-right shadow-2xl relative"
                        >
                          <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl"></div>
                          
                          <div className="flex flex-col items-center text-center gap-4 mb-6">
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full animate-bounce">
                              <Sparkles className="w-8 h-8 fill-amber-500/25" />
                            </div>
                            <div>
                              <h4 className="text-lg font-black text-white">פיצ'ר פרימיום ללקוחות משלמים בלבד 👑</h4>
                              <p className="text-xs text-slate-400 mt-1">
                                עריכת פרומפטים מותאמת באופן אישי וצפייה בשיחות חיות היא תכונה הזמינה לחברי עסק חכם Premium.
                              </p>
                            </div>
                          </div>

                          <div className="bg-[#151722] border border-slate-800 rounded-xl p-4 flex flex-col gap-3 text-xs text-slate-350 mb-6 leading-relaxed">
                            <div className="flex items-start gap-2">
                              <span className="text-amber-450 font-bold shrink-0">✨</span>
                              <span>חיבור לטלפון WhatsApp אישי של בית העסק שלך ללא הגבלת מכשירים.</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-amber-450 font-bold shrink-0">✨</span>
                              <span>לוח בקרה אינטראקטיבי לשינוי סגנון הדיבור, המבצעים והגדרות מענה אוטומטי בדקה.</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-amber-450 font-bold shrink-0">✨</span>
                              <span>קבלת סיכומי שיחה מפורטים והעברת שיחות לנציגים אנושיים בצורה שקופה.</span>
                            </div>
                          </div>

                           <div className="flex flex-col gap-2.5">
                            <button
                              onClick={() => {
                                setShowPremiumModal(false);
                                handleGooglePopupLogin(true);
                              }}
                              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-extrabold text-xs text-center rounded-xl shadow-lg shadow-green-600/10 cursor-pointer transition flex items-center justify-center gap-2 shrink-0 hover:scale-[1.01]"
                            >
                              🚀 פתח חשבון התנסות חינם לחודש
                            </button>
                            <button
                              onClick={() => setShowPremiumModal(false)}
                              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                              סגור חלון
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800/50">
                    <button
                      onClick={() => {
                        setDemoResult(null);
                        setLandingUrl("");
                        setLandingPhone("");
                      }}
                      className="px-5 py-2.5 bg-[#171A24] hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition text-xs font-bold cursor-pointer"
                    >
                      צור בוט הדגמה נוסף
                    </button>
                    <button
                      onClick={() => setIsLandingPage(false)}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition"
                    >
                      הרשמה / כניסת מנהלים ללוח הבקרה
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-center py-6 text-[11px] text-slate-600 tracking-wide select-none border-t border-slate-900 mt-8">
            נבנה עבור <strong>חיים בר - עסק חכם</strong> © {new Date().getFullYear()} • כל הזכויות שמורות
          </div>
        </div>
      );
    } else {
      // Secure login view
      return (
        <div className="min-h-screen bg-[#070709] text-slate-300 flex items-center justify-center p-4 md:p-8 font-sans select-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#07070a] to-[#040406]" dir="rtl">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md flex flex-col items-center"
          >
            {/* Logo Card representing "עסק חכם" */}
            <SmartBusinessLogo size="lg" showContact={true} />

            {/* Login Control Form panel */}
            <div className="w-full mt-6 bg-[#0E0F14]/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl flex flex-col gap-5 backdrop-blur">
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-150">כניסה למערכת מאובטחת</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  מערכת זו חסומה לעריכה פומבית. רק משתמשים המוגדרים ברשימת המורשים רשאים להתחבר.
                </p>
              </div>

              {authError && (
                <div id="auth-error-banner" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs text-center font-medium leading-relaxed">
                  {authError}
                </div>
              )}

              {/* Google Login Options */}
              <div className="flex flex-col items-center justify-center gap-4 py-2 border-b border-slate-800/50 pb-6">
                
                {/* Option 1: Green Trial Sign-Up Button */}
                <div className="w-full flex flex-col gap-1.5">
                  <span className="text-[10.5px] text-green-500 font-extrabold uppercase tracking-wider text-right pr-1">אפשרות א': פתיחת חשבון חדש</span>
                  <button
                    type="button"
                    onClick={() => handleGooglePopupLogin(true)}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-extrabold text-xs text-center rounded-xl shadow-lg shadow-green-600/10 cursor-pointer transition flex items-center justify-center gap-2 shrink-0 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    🚀 פתח חשבון התנסות חינם לחודש
                  </button>
                </div>

                {/* Option 2: White Google Sign-In Button */}
                <div className="w-full flex flex-col gap-1.5 mt-2">
                  <span className="text-[10.5px] text-slate-500 font-extrabold uppercase tracking-wider text-right pr-1">אפשרות ב': כניסה למשתמש רשום</span>
                  <button
                    type="button"
                    onClick={() => handleGooglePopupLogin(false)}
                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-950 font-bold py-2.5 px-4 rounded-xl border border-slate-700/30 transition-all shadow-md text-xs cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.62 14.99 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.85 2.99c.92-2.76 3.5-4.51 6.76-4.51z"/>
                      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.48c-.29 1.48-1.12 2.73-2.37 3.58l3.77 2.92c2.2-2.03 3.61-5.09 3.61-8.66z"/>
                      <path fill="#FBBC05" d="M5.24 14.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3L1.39 7.56C.5 9.36 0 11.45 0 13.63s.5 4.27 1.39 6.07l3.85-2.99c-.24-.72-.38-1.5-.38-2.3z"/>
                      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.77-2.92c-1.1.74-2.52 1.18-4.19 1.18-3.26 0-5.84-1.75-6.76-4.51L1.39 16.82C3.37 20.71 7.35 23 12 23z"/>
                    </svg>
                    <span>התחברות מהירה עם גוגל (Google Popup)</span>
                  </button>
                </div>

                {/* Google GSI Sign In Button Mounting Point */}
                <div id="google-signin-btn-container" className="flex items-center justify-center min-h-[44px] hidden"></div>
                
                <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400 text-[10.5px] text-right leading-relaxed mt-2 w-full">
                  💡 <strong>התחברות מאובטחת:</strong> ההרשמה והכניסה מתבצעות באופן מאובטח מול שרתי Google. לתוצאות מיטביות, ודא כי חלונות קופצים (Popups) מאושרים בדפדפן שלך.
                </div>
              </div>

              {/* Secondary bypass passcode login (useful for strict iframes or offline checks) */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeField(!showPasscodeField)}
                  className="text-xs text-[#38BDF8] hover:text-sky-350 font-bold flex items-center justify-center gap-1 hover:underline cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  מעקף מורשה מהיר (ללא Google Login)
                </button>

                <AnimatePresence>
                  {showPasscodeField && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex flex-col gap-2 pt-2"
                    >
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showBypassPasscode ? "text" : "password"}
                            placeholder="הזן מפתח מעקף מורשה או מספר טלפון מאושר..."
                            value={bypassPasscode}
                            onChange={(e) => setBypassPasscode(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 bg-[#161821] border border-sky-500/30 rounded-lg text-xs font-mono text-center text-white focus:outline-none focus:ring-1 focus:ring-sky-500 transition"
                          />
                          <button
                            type="button"
                            onClick={() => setShowBypassPasscode(!showBypassPasscode)}
                            className="absolute left-2.5 top-2.5 p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-sky-400 transition"
                            title={showBypassPasscode ? "הסתר סיסמה" : "הצג סיסמה"}
                          >
                            {showBypassPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handlePasscodeLoginBypass}
                          className="px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md transition shrink-0"
                        >
                          כניסה
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Toggle Back to Landing Page button */}
              <button
                type="button"
                onClick={() => setIsLandingPage(true)}
                className="mt-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 font-bold transition hover:underline cursor-pointer select-none"
              >
                ← חזרה לעמוד הבית וההדגמה המהירה
              </button>

              <button
                type="button"
                onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
                className="mt-4 px-3 py-1.5 bg-[#171A24] text-slate-300 hover:text-sky-400 rounded-xl border border-slate-800 transition flex items-center gap-1.5 cursor-pointer text-[10px] font-bold mx-auto select-none shadow-sm"
                title={theme === "light" ? "עבור למצב כהה" : "עבור למצב בהיר"}
              >
                {theme === "light" ? <Moon className="w-3.5 h-3.5 text-indigo-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                <span>{theme === "light" ? "עבור למצב כהה 🌙" : "עבור למצב בהיר ☀️"}</span>
              </button>

            </div>

            {/* Secure disclaimer brand message */}
            <p className="text-[10px] text-slate-500 text-center mt-6 tracking-wide">
              הרשאות וניהול מפתחות מנוהלים על ידי <strong>עסק חכם</strong>
            </p>
          </motion.div>
        </div>
      );
    }
  }

  // MAIN SYSTEM PANEL (Rendered when authenticated)
  return (
    <div dir="rtl" className="min-h-screen bg-[#07070A] font-sans text-slate-300 flex flex-col">
      
      {/* Top Banner / Header */}
      <header className="bg-[#0D0E13] text-white shadow-xl border-b border-[#141C2C] shrink-0 select-none">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <SmartBusinessLogo size="sm" />
            <div className="h-6 w-px bg-slate-800 self-center hidden md:block mx-1"></div>
            <div>
              <h1 id="app-title" className="text-lg md:text-xl font-extrabold tracking-tight flex items-center gap-2">
                מערכת הגדרת סוכנים
                <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full flex items-center gap-1">
                  ענן עסק חכם <span className="opacity-70 text-[9px] font-mono border-l border-sky-500/30 pl-1.5 ml-0.5">v2.4.5</span>
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">עריכת פלטפורמות מכירה דיגיטליות וסנכרון דו-כיווני בענן</p>
            </div>
          </div>

          {/* Connected User Profile Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Security controls */}
            {sessionUser?.email === "haim.bar@gmail.com" && (
              <button
                onClick={() => {
                  setSecurityGoogleClientId(googleClientId);
                  setSecurityAllowedEmails(allowedEmails);
                  setSecurityBypassUsers(bypassUsers);
                  setSecurityFeedback(null);
                  setShowSecurityModal(true);
                }}
                className="p-2 bg-[#171A24] text-slate-300 hover:text-sky-400 hover:shadow-[0_0_12px_rgba(56,189,248,0.2)] rounded-xl border border-slate-800 transition flex items-center gap-1.5 cursor-pointer text-xs font-bold"
                title="נהל הרשאות ואימיילים מורשים"
              >
                <Shield className="w-4 h-4 text-sky-400" />
                אישור והרשאות כניסה
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
              className="p-2 bg-[#171A24] text-slate-300 hover:text-sky-400 rounded-xl border border-slate-800 transition flex items-center gap-1.5 cursor-pointer text-xs font-bold"
              title={theme === "light" ? "עבור למצב כהה" : "עבור למצב בהיר"}
            >
              {theme === "light" ? (
                <>
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">מצב כהה 🌙</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="hidden sm:inline">מצב בהיר ☀️</span>
                </>
              )}
            </button>

            {/* User credentials banner */}
            <div className="bg-[#141722] px-3 py-1.5 rounded-xl border border-slate-850 flex items-center gap-2 text-xs">
              {sessionUser?.picture ? (
                <img src={sessionUser.picture} alt="" className="w-5.5 h-5.5 rounded-full border border-sky-500/20" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-5 h-5 text-indigo-400" />
              )}
              <div className="text-right hidden sm:block">
                <span className="font-bold text-slate-100 block text-[11px]">{sessionUser?.name}</span>
                <span className="text-[9px] text-slate-400 font-mono block">{sessionUser?.email}</span>
              </div>
            </div>

            {/* Log out */}
            <button
              onClick={logout}
              className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-red-400 hover:text-red-300 transition cursor-pointer"
              title="התנתק"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-6">

        {/* Right Sidebar - List of agents */}
        <section className="w-full lg:w-80 shrink-0 flex flex-col gap-4 lg:sticky lg:top-6 lg:h-[calc(100vh-100px)]">
          <div className="bg-[#0C0D12] rounded-xl shadow-lg border border-slate-800 p-4 flex flex-col gap-3 h-full min-h-[480px] lg:min-h-0 overflow-hidden">
            
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-slate-300 flex items-center gap-2">
                <List className="w-4.5 h-4.5 text-sky-400" />
                רשימת סוכנים שמורים ({agents.length})
              </h2>
              
              {sessionUser?.email === "haim.bar@gmail.com" && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setWizardStep(1);
                      setWizardBusinessName(businessName || "");
                      setWizardOwnerName(ownerName || "");
                      setWizardBotId(botId || "bot_" + Math.floor(1000 + Math.random() * 9000));
                      setWizardOwnerPhone(ownerPhone || "");
                      setWizardWebsiteUrl("");
                      setWizardPastedText("");
                      setScrapedText("");
                      setExplorerAnalysis("");
                      setGeneratedPrompts(null);
                      setShowWizardModal(true);
                    }}
                    className="p-1 px-2.5 text-[10px] bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold rounded-lg border border-amber-700/50 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="מחולל סוכנים (AI Magic)"
                  >
                    <Sparkles className="w-3 h-3 text-amber-250 animate-pulse" />
                    <span>מחולל 🪄</span>
                  </button>
                  <button
                    type="button"
                    onClick={createNewAgent}
                    className="p-1 px-2.5 text-[10px] bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg border border-sky-700/50 shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                    title="הוסף סוכן חדש"
                  >
                    <Plus className="w-3 h-3" />
                    <span>חדש</span>
                  </button>
                </div>
              )}
            </div>

            {/* Live Search & Filters */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="חפש לפי שם/מפתח..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-100 transition placeholder-slate-650"
                />
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
              </div>

              {/* Status Filter Segmented Button Group */}
              <div className="flex bg-[#12141C] p-0.5 rounded-lg border border-slate-850 gap-0.5 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer text-center ${
                    statusFilter === "all"
                      ? "bg-slate-800 text-slate-100 shadow-sm border border-slate-700/50"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  הכל ({agents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    statusFilter === "active"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm"
                      : "text-slate-500 hover:text-emerald-400"
                  }`}
                >
                  <span className={`w-1 h-1 rounded-full bg-emerald-500 ${statusFilter === "active" ? "animate-pulse" : ""}`} />
                  פעילים ({agents.filter(a => a.status === "Active").length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("inactive")}
                  className={`flex-1 py-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    statusFilter === "inactive"
                      ? "bg-slate-800/80 text-slate-300 border border-slate-700/50 shadow-sm"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="w-1 h-1 rounded-full bg-slate-500" />
                  לא פעילים ({agents.filter(a => a.status !== "Active").length})
                </button>
              </div>
            </div>

            <hr className="border-slate-850" />

            {/* List scroll container */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 space-y-1">
              {filteredAgents.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 text-xs text-slate-500 font-medium">
                  {searchTerm ? "לא נמצאו סוכנים המתאימים לחיפוש" : "טרם נוספו סוכנים למערכת"}
                </div>
              ) : (
                filteredAgents.map((agent, index) => {
                  const isActive = agent.id === activeId;
                  return (
                    <div
                      key={agent.id ? `agent-${agent.id}-${index}` : `agent-fallback-${index}`}
                      onClick={() => selectAgent(agent.id)}
                      className={`group relative p-3 rounded-xl border text-right transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-[#181D29] border-sky-500/40 shadow-lg shadow-sky-950/20 ring-1 ring-sky-500/20"
                          : "bg-slate-950/10 hover:bg-[#131722]/30 border-slate-850 text-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-xs font-black truncate ${isActive ? "text-sky-400" : "text-slate-200"}`}>
                            {agent.businessName || "ללא שם עסק"}
                          </h3>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5 truncate">
                            {agent.ownerName ? `בעלים: ${agent.ownerName}` : "טיוטת סוכן"}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0 relative z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAgentStatus(agent.id);
                            }}
                            className={`text-[9.5px] font-black px-2 py-0.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                              agent.status === "Active"
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/25"
                                : "bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border-slate-800"
                            }`}
                            title="לחץ כדי לשנות מצב פעיל/לא פעיל (Active / Not Active)"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              agent.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
                            }`} />
                            {agent.status === "Active" ? "פעיל" : "לא פעיל"}
                          </button>
                          {(sessionUser?.email === "haim.bar@gmail.com" || !agent.lastSyncedAt) && (
                            <button
                              type="button"
                              onClick={(e) => triggerDeleteAgent(agent.id, e)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                              title={!agent.lastSyncedAt ? "מחק סוכן לא פעיל" : "מחק סוכן"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center gap-3 text-[9px] text-slate-550 font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <Bot className="w-3 h-3 text-slate-500" />
                          {agent.botId || "N/A"}
                        </span>
                        {agent.ownerPhone && (
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3 text-slate-500" />
                            {agent.ownerPhone}
                          </span>
                        )}
                        {agent.agentEmail && (
                          <span className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px] text-[8.5px] text-indigo-400" title={agent.agentEmail}>
                            <Mail className="w-2.5 h-2.5 text-indigo-500 flex-shrink-0" />
                            {agent.agentEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Actions */}
            {sessionUser?.email === "haim.bar@gmail.com" && (
              <div className="pt-2 border-t border-slate-850 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={duplicateAgent}
                    className="flex-1 py-1.5 text-[10px] bg-[#141822] text-slate-300 hover:bg-[#1E2433] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 border border-slate-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    שכפל פעיל
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={() => handlePullAllAgentsFromN8n()}
                  disabled={isPullingAll}
                  className="w-full py-2 text-[10px] bg-slate-900 border border-slate-850 hover:bg-slate-850 disabled:bg-slate-950 disabled:text-slate-600 text-sky-450 font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(56,189,248,0.15)]"
                  title="טען וסנכרן את כל רשימת הפרויקטים מהשרת"
                >
                  {isPullingAll ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      טוען פרויקטים...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      סנכרן ומשוך את כל הפרויקטים 🔄
                    </>
                  )}
                </button>
              </div>
            )}

          </div>
        </section>

        {/* Middle Main Working Workspace */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* Main Configuration Card Form */}
          <div className="bg-[#0C0D12] rounded-xl shadow-lg border border-slate-800 p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-sky-400" />
                <div>
                  <h2 className="text-sm font-black text-white flex items-center gap-1.5 flex-wrap">
                    <span>פרטי סוכן:</span>
                    <span className="text-sky-450 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/15">
                      {name || `${businessName || "[שם העסק]"} _ ${agentType === "support" ? "תמיכה טכנית" : "מכירות"}`}
                    </span>
                    <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/15 text-[10px]">
                      {agentType === "support" ? "🛠️ תמיכה טכנית ושירות" : "💼 שיווק ומכירות 🚀"}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium font-sans mt-0.5">מלא את הפרטים ליצירת התאמה דינמית בפרומפטים ובחיבור הנתונים</p>
                </div>
              </div>
            </div>

            {/* Sync Feedback messages panel */}
            <AnimatePresence>
              {syncStatus !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`p-3.5 rounded-xl border flex items-start gap-3.5 text-xs ${
                    syncStatus === "success" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                      : "bg-red-500/10 border-red-500/20 text-red-300"
                  }`}
                  dir="rtl"
                >
                  {syncStatus === "success" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-right">
                    <h4 className="font-extrabold">{syncStatus === "success" ? "הסנכרון בוצע בהצלחה!" : "הפעולה נכשלה"}</h4>
                    <p className="text-[11px] text-slate-350 mt-1 font-medium leading-relaxed">{syncMessage}</p>
                    
                    {syncStatus === "success" && (
                      <span className="text-[9px] text-slate-500 font-mono block mt-1">
                        עודכן לאחרונה בשעה: {new Date().toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Responsive grid for input elements */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-850/50 pb-5">
              
              {/* Bot Name */}
              <div className="flex flex-col gap-1.5 col-span-1 md:col-span-2">
                <label className="text-xs font-black text-sky-400 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-sky-450" />
                  שם הבוט (שדה חובה בקובץ/ענן/webhook) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="הזן שם עבור הבוט (לדוגמה: אופטיקה רונן _ מכירות)"
                    value={name}
                    onChange={(e) => {
                      handleFieldChange("name", e.target.value);
                      setDirtyAgents(prev => ({ ...prev, [activeId]: true }));
                    }}
                    className="w-full px-3.5 py-2 bg-[#161821] border border-sky-900/30 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white transition placeholder-slate-600 pl-24"
                    required
                  />
                  {!name && (
                    <span className="absolute left-3.5 top-2.5 text-[9px] text-slate-500 pointer-events-none font-bold" dir="rtl">
                      ברירת מחדל: {businessName || "[שם העסק]"} _ {agentType === "support" ? "תמיכה טכנית" : "מכירות"}
                    </span>
                  )}
                </div>
              </div>

              {/* Bot Agent Type Selection */}
              <div className="flex flex-col gap-2 col-span-1 md:col-span-3 mt-1" dir="rtl">
                <label className="text-xs font-black text-sky-400 flex items-center gap-1.5 select-none">
                  <Sliders className="w-3.5 h-3.5 text-sky-450" />
                  <span>סוג הסוכן הדיגיטלי (סוכן ברירת מחדל):</span>
                  <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sales Agent Button/Card */}
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange("agentType", "sales");
                      setDirtyAgents(prev => ({ ...prev, [activeId]: true }));
                    }}
                    className={`p-4 rounded-2xl border text-right transition-all duration-200 cursor-pointer flex flex-col gap-1.5 select-none active:scale-[0.98] outline-none ${
                      agentType === "sales"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-bold shadow-lg shadow-indigo-600/5 ring-1 ring-indigo-500/10"
                        : "bg-[#13141f]/40 border-slate-800 text-slate-400 hover:bg-[#181a29]/60 hover:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">💼</span>
                      <span className="text-xs font-black select-none">סוכן שיווק ומכירות 🚀</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-relaxed font-semibold pr-8 select-none">
                      סוכן דינמי החותר להשארת פרטים, תיאום שיעורי התנסות או פגישות, חיוג ושירות לקוחות יזום.
                    </span>
                  </button>

                  {/* Support Agent Button/Card */}
                  <button
                    type="button"
                    onClick={() => {
                      handleFieldChange("agentType", "support");
                      setDirtyAgents(prev => ({ ...prev, [activeId]: true }));
                    }}
                    className={`p-4 rounded-2xl border text-right transition-all duration-200 cursor-pointer flex flex-col gap-1.5 select-none active:scale-[0.98] outline-none ${
                      agentType === "support"
                        ? "bg-indigo-600/10 border-indigo-500 text-indigo-300 font-bold shadow-lg shadow-indigo-600/5 ring-1 ring-indigo-500/10"
                        : "bg-[#13141f]/40 border-slate-800 text-slate-400 hover:bg-[#181a29]/60 hover:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🛠️</span>
                      <span className="text-xs font-black select-none">סוכן תמיכה טכנית ושירות 🛠️</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-relaxed font-semibold pr-8 select-none">
                      עוזר אישי המעניק מענה לשאלות נפוצות, פתרון בעיות, הסבר על השירותים והכוונת לקוחות.
                    </span>
                  </button>
                </div>
              </div>

            </div>

            {/* Responsive grid for original business elements */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Business Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  שם העסק <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="לדוגמה: אופטיקה רונן"
                  value={businessName}
                  onChange={(e) => handleFieldChange("businessName", e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white transition placeholder-slate-600"
                  required
                />
              </div>

              {/* Owner Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  שם בעל העסק <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="לדוגמה: ישראל ישראלי"
                  value={ownerName}
                  onChange={(e) => handleFieldChange("ownerName", e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white transition placeholder-slate-600"
                  required
                />
              </div>

              {/* Associated Email (permissions) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  אימייל משויך לסוכן <span className="text-[10px] text-slate-400 font-normal">(להרשאות וגישה)</span>
                </label>
                <input
                  type="email"
                  placeholder="לדוגמה: agent@gmail.com"
                  value={agentEmail}
                  onChange={(e) => handleFieldChange("agentEmail", e.target.value)}
                  disabled={sessionUser?.email !== "haim.bar@gmail.com"}
                  className={`w-full px-3.5 py-2 border rounded-lg text-xs font-bold focus:outline-none transition placeholder-slate-600 ${
                    sessionUser?.email === "haim.bar@gmail.com"
                      ? "bg-[#161821] border-slate-800 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white font-mono"
                      : "bg-[#1C1D29] border-slate-900 text-slate-400 cursor-not-allowed font-mono"
                  }`}
                  required
                />
                <span className="text-[10px] text-slate-400 leading-normal">
                  {sessionUser?.email === "haim.bar@gmail.com"
                    ? "מאפשר לקבוע איזה משתמש יוכל לגשת ולערוך את סוכן ה-AI הזה. מנהל המערכת מורשה לשנות שיוך זה."
                    : "כתובת האימייל המורשית לערוך ולצפות בסוכן זה (ניתן לשינוי על ידי מנהל המערכת בלבד)."}
                </span>
              </div>

              {/* Owner Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                  טלפון בעל העסק <span className="text-red-500 font-bold">*</span>:
                </label>
                <CountryPhoneInput
                  id="ownerPhone"
                  value={ownerPhone}
                  onChange={(val, isValid, error) => {
                    handleFieldChange("ownerPhone", val);
                    setOwnerPhoneError(error);
                  }}
                  placeholder="רשום טלפון ללא קידומת (למשל: 054-7866119)"
                />
              </div>

              {/* Bot ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Bot className="w-3.5 h-3.5 text-slate-500" />
                  Bot ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="לדוגמה: bot_98432"
                    value={botId}
                    onChange={(e) => handleFieldChange("botId", e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-mono text-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(botId);
                    }}
                    className="absolute left-2.5 top-2 p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-sky-400 transition"
                    title="העתק מזהה בוט"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* WhatsApp Instance */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  WhatsApp Instance <span className="text-xs text-slate-550">(שם מופע)</span>
                </label>
                <input
                  type="text"
                  placeholder="לדוגמה: marketing_whatsapp"
                  value={whatsappInstance}
                  onChange={(e) => handleFieldChange("whatsappInstance", e.target.value)}
                  className="w-full px-3.5 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white transition placeholder-slate-650"
                />
              </div>

              {/* Key */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  Key <span className="text-xs text-sky-500">(מפתח אבטחה)</span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder="הקש קוד או מפתח..."
                    value={key}
                    onChange={(e) => handleFieldChange("key", e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute left-2.5 top-2 p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-sky-400 transition"
                    title={showKey ? "הסתר מזהה" : "הצג מזהה"}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Lead Follow Up Days */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>זמן למעקב אחרי ליד בימים</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    placeholder="מחדל: 3 ימים"
                    value={leadFollowUpDays}
                    onChange={(e) => handleFieldChange("leadFollowUpDays", e.target.value)}
                    className="w-full pl-12 pr-3.5 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-white transition placeholder-[#3e4256]"
                  />
                  <div className="absolute left-3 top-2 text-[10px] text-slate-500 font-bold select-none pointer-events-none">
                    ימים
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  הכנס את מספר הימים שהמערכת תמתין לפני שתשלח הודעת מעקב (Follow-up) אוטומטית לליד שלא הגיב.
                </p>
              </div>

              {/* Bot Active/Inactive Status Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-slate-500"}`} />
                  <span>סטטוס פעילות הבוט (Status)</span>
                </label>
                <div className="flex bg-[#161821] p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleFieldChange("status", "Active")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all cursor-pointer ${
                      status === "Active"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    פעיל (Active)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFieldChange("status", "Not Active")}
                    className={`flex-1 py-1.5 text-xs font-black rounded-md transition-all cursor-pointer ${
                      status === "Not Active"
                        ? "bg-slate-800 text-slate-300 border border-slate-700 shadow"
                        : "text-slate-500 hover:text-slate-350"
                    }`}
                  >
                    לא פעיל (Not Active)
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  בוט במצב <strong>פעיל</strong> יגיב ללקוחות. שים לב שלא ניתן להפעיל שני בוטים על אותו WhatsApp Instance בו זמנית.
                </p>
              </div>

            </div>

            {/* The brain of the agent (Prompt) callout */}
            <div className="pt-4 mt-2 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 rounded-xl border border-sky-500/20 shadow-inner overflow-hidden flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-black text-white flex items-center gap-2">
                    <span>השכל של הסוכן (פרומפט) 🧠</span>
                    <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-bold">הצג הכל</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium font-sans">ערוך ואפיין את 9 חלקי הפרומפט המקצועיים ליצירת ההתנהגות המדויקת של הסוכן</p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => {
                  setActiveModalTab("botIdentity");
                  const currentAgent = agents.find(a => a.id === activeId);
                  if (currentAgent) {
                    setPromptBuilderBackup(JSON.parse(JSON.stringify(currentAgent)));
                  }
                  setShowPromptBuilder(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition duration-200 cursor-pointer shadow-md shadow-sky-500/10 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                <span>השכל של הסוכן (פרומפט) 🪄</span>
              </button>
            </div>

          </div>

        </section>

          {/* Sync & Webhook Administration Control Center (Hidden) */}
          <div className="hidden">
            
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Send className="w-5 h-5 text-sky-400" />
                <div>
                  <h2 className="text-sm font-black text-slate-100">2. חיבור וסנכרון לענן</h2>
                  <p className="text-xs text-slate-400 font-medium font-sans">שיגור ועדכון נתונים מרוכז או משיכת הגדרות קודמות</p>
                </div>
              </div>

              {/* Duplicate or test options */}
              <button
                type="button"
                onClick={() => setShowPayload(!showPayload)}
                className="text-xs bg-slate-900 hover:bg-[#1E2433] text-sky-400 font-bold px-3 py-1.5 rounded-lg border border-slate-800 transition cursor-pointer"
              >
                {showPayload ? "הסתר מבנה שליחה (JSON)" : "הצג מבנה שליחה (JSON)"}
              </button>
            </div>

            {/* Custom Webhook Endpoint URL Edit */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  כתובת ה-Webhook לשילוח וקריאת נתונים
                </span>
                
                {/* Reset button if edited */}
                {webhookUrl !== DEFAULT_WEBHOOK_URL && (
                  <button
                    onClick={resetWebhookUrl}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline cursor-pointer font-bold"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    שחזר כתובת מקורית
                  </button>
                )}
              </label>

              <div className="flex gap-2">
                
                {/* Toggle lock */}
                <button
                  type="button"
                  onClick={() => setIsUrlLocked(!isUrlLocked)}
                  className={`p-2 rounded-lg border flex items-center justify-center transition cursor-pointer ${isUrlLocked ? "bg-[#161821] border-slate-800 text-slate-400" : "bg-orange-500/10 border-orange-500/20 text-orange-400"}`}
                  title={isUrlLocked ? "פתח נעילת כתובת" : "נעל כתובת למניעת שינוי"}
                >
                  {isUrlLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>

                <input
                  type="url"
                  placeholder="הקלד כתובת Webhook אליה ייחשף המידע ב-POST..."
                  value={webhookUrl}
                  onChange={(e) => handleSaveWebhookUrl(e.target.value)}
                  disabled={isUrlLocked}
                  className="flex-1 bg-black border border-slate-800 rounded-lg py-2 px-3.5 text-xs font-mono text-sky-400 focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-left select-all"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Collapsible raw json payload viewer */}
            <AnimatePresence>
              {showPayload && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-black/60 border border-slate-900 rounded-lg p-4 text-[11px] font-mono text-slate-350 overflow-x-auto leading-relaxed"
                  dir="ltr"
                >
                  <p className="text-slate-500 mb-2 font-mono">// System schema mapping details to webhook:</p>
                  <pre className="text-cyan-400">
{JSON.stringify({
  ownerName,
  businessName,
  ownerPhone,
  botId,
  whatsappInstance,
  businessPrompt: businessPrompt.substring(0, 80) + "...",
  key,
  _branding: {
    system: "עסק חכם",
    developer: "חיים בר",
  }
}, null, 2)}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Webhook Submit / Pull Actions Block */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2 bg-slate-950/30 p-4 rounded-xl border border-slate-850">
              
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold block">תקשורת ועדכון מול השרת:</span>
                <span className="text-[11px] text-slate-500 font-medium font-sans">באפשרותך לדחוף את השדות העדכניים לשרת או למשוך את הנתונים השמורים ישירות.</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto self-stretch sm:self-auto">
                
                {/* Pull Configuration Button (GET content) */}
                <button
                  type="button"
                  onClick={handlePullConfigFromN8n}
                  disabled={isSyncing}
                  className="w-full sm:w-auto p-3 px-6 bg-slate-900 hover:bg-[#1E2433] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-xs font-black rounded-xl border border-slate-800 text-sky-400 flex items-center justify-center gap-1.5 transition duration-200 cursor-pointer"
                  title="משוך את תוכן השדות הנוכחיים מהשרת"
                >
                  <Download className="w-4 h-4" />
                  משוך נתונים מהשרת 🔄
                </button>

                {/* Push Configuration Button (POST webhook content) */}
                <button
                  type="button"
                  onClick={() => handleSyncToWebhook()}
                  disabled={isSyncing || !businessName}
                  className="w-full sm:w-auto p-3 px-8 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed font-extrabold rounded-xl shadow-lg shadow-sky-500/10 text-xs text-white flex items-center justify-center gap-2 transition duration-200 cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      מעבד נתונים...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 text-white" />
                      עדכן וסנכרן ל-Webhook 🚀
                    </>
                  )}
                </button>
              </div>

            </div>

            {/* Sync Feedback messages panel */}
            <AnimatePresence>
              {syncStatus !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    syncStatus === "success" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" 
                      : "bg-red-500/10 border-red-500/20 text-red-300"
                  }`}
                >
                  {syncStatus === "success" ? (
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-black">{syncStatus === "success" ? "הסנכרון בוצע בהצלחה!" : "הפעולה נכשלה"}</h4>
                    <p className="text-[11px] text-slate-300 mt-1 font-medium leading-relaxed">{syncMessage}</p>
                    
                    {syncStatus === "success" && (
                      <span className="text-[9px] text-slate-500 font-mono block mt-1.5">
                        עודכן לאחרונה בשעה: {new Date().toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

      </main>

      {/* Elegant minimalist Footer */}
      <footer className="bg-[#050609] border-t border-slate-850 py-5 text-center mt-auto text-xs text-slate-500 font-bold select-none">
        <div className="flex flex-col items-center gap-1">
          <p className="flex items-center gap-1 text-slate-400">
            <span>מערכת הגדרת סוכנים עסקיים</span>
            <span className="text-sky-500">•</span>
            <span className="font-extrabold text-sky-400">עסק חכם</span>
            <span className="text-sky-500">•</span>
            <span>חיים בר 054-7866119</span>
          </p>
          <p className="text-[10px] text-slate-600 font-medium mt-1">
            הנתונים שמורים ומאובטחים בענן עסק חכם ומסונכרנים בהרמוניה מלאה.
          </p>
        </div>
      </footer>

      {/* SECURITY MODAL (Permit user dynamically add emails or modify client ID) */}
      <AnimatePresence>
        {showSecurityModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" dir="rtl">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0C0D12] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="bg-[#0D0F16] border-b border-slate-850 p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sky-400">
                  <Shield className="w-5 h-5" />
                  <h3 className="font-sans font-black text-white text-sm">הגדרות אבטחה והרשאות כניסה</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="p-1 text-slate-500 hover:text-white hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex flex-col gap-5 text-xs text-right">
                
                {/* Section A: Google Client ID */}
                <div className="flex flex-col gap-1.5 border-b border-slate-850 pb-4">
                  <label className="font-bold text-slate-300 block">
                    Google OAuth Client ID (זיהוי לקוח גוגל)
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
                    מזהה זה משמש את המערכת לחיבור כפתור ה-Google Login. תוכל להשאיר את המזהה הקיים או להזין מזהה של פרויקט ה-Google Cloud שלך.
                  </p>
                  <input
                    type="text"
                    value={securityGoogleClientId}
                    onChange={(e) => setSecurityGoogleClientId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs font-mono text-sky-400 select-all"
                    dir="ltr"
                  />
                </div>

                {/* Section B: Allowed Emails (Dynamic list of who can log in) */}
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-slate-300 block">
                    רשימת אימיילים מורשים (Allowed Emails)
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    רק משתמשים עם כניסת גוגל תואמת לאימיילים ברשימה זו יורשו להיכנס לממשק ולערוך.
                  </p>

                  {/* Add email */}
                  <div className="flex gap-2 mt-1">
                    <input
                      type="email"
                      placeholder="הקלד אימייל (לדוגמה: someone@gmail.com)..."
                      value={newAllowedEmailInput}
                      onChange={(e) => setNewAllowedEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddEmailToSecurity();
                        }
                      }}
                      className="flex-1 px-3 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs text-white"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={handleAddEmailToSecurity}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-505 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      הוסף
                    </button>
                  </div>

                  {/* List of currently added emails */}
                  <div className="mt-3 bg-[#13151F] border border-slate-850 rounded-lg p-2.5 max-h-[160px] overflow-y-auto flex flex-col gap-1.5">
                    {securityAllowedEmails.length === 0 ? (
                      <span className="text-[11px] text-slate-600 text-center py-2">אין אימיילים מורשים. חובה להגדיר לפחות אחד!</span>
                    ) : (
                      securityAllowedEmails.map((email, idx) => (
                        <div key={email ? `email-${email}-${idx}` : `email-fallback-${idx}`} className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-slate-850">
                          <span className="font-mono text-[11px] text-slate-300 select-all">{email}</span>
                          {email === "haim.bar@gmail.com" ? (
                            <span className="text-[9px] text-sky-400 font-bold bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">מנהל ראשי</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveEmailFromSecurity(email)}
                              className="text-slate-500 hover:text-red-400 p-0.5"
                              title="ערוך והסר משתמש מורשה"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section C: Bypass Passcodes (Assign passwords to users) */}
                <div className="flex flex-col gap-2 border-t border-slate-850 pt-4">
                  <label className="font-bold text-slate-300 block">
                    מפתחות מעקף וססמאות מורשים (Bypass Keys & Passwords)
                  </label>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    צור והגדר כינויים, כתובות דוא"ל וססמאות ייעודיות ללקוחות או משתמשים נוספים כדי שיוכלו להתחבר ללא צורך בחשבון גוגל (כניסה מאובטחת עם מפתחות).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="שם המשתמש (למשל: דני כהן)..."
                      value={newBypassName}
                      onChange={(e) => setNewBypassName(e.target.value)}
                      className="px-3 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="email"
                      placeholder="דואר אלקטרוני..."
                      value={newBypassEmail}
                      onChange={(e) => setNewBypassEmail(e.target.value)}
                      className="px-3 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs text-white"
                      dir="ltr"
                    />
                    <div className="flex gap-1">
                      <input
                        type="text"
                        placeholder="ססמה / טלפון..."
                        value={newBypassPasscode}
                        onChange={(e) => setNewBypassPasscode(e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#161821] border border-slate-800 rounded-lg text-xs text-white text-center font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAddBypassUser}
                        className="px-3 bg-sky-600 hover:bg-sky-505 text-white font-bold rounded-lg text-xs cursor-pointer"
                      >
                        הוסף
                      </button>
                    </div>
                  </div>

                  {/* List of currently created bypass keys */}
                  <div className="mt-2 bg-[#13151F] border border-slate-850 rounded-lg p-2.5 max-h-[160px] overflow-y-auto flex flex-col gap-1.5">
                    {securityBypassUsers.length === 0 ? (
                      <span className="text-[11px] text-slate-600 text-center py-2">אין מפתחות מעקף מוגדרים במערכת.</span>
                    ) : (
                      securityBypassUsers.map((user, idx) => (
                        <div key={user.passcode ? `bypass-${user.passcode}-${idx}` : `bypass-fallback-${idx}`} className="flex flex-wrap items-center justify-between gap-2 bg-black/40 px-2.5 py-1.5 rounded border border-slate-850">
                          <div className="flex flex-col text-right">
                            <span className="font-bold text-slate-200 text-[11px]">{user.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] bg-[#161821] border border-slate-800 px-2 py-0.5 rounded text-sky-450 font-black">ססמה: {user.passcode}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBypassUser(user.passcode)}
                              className="text-slate-500 hover:text-red-400 p-0.5"
                              title="מחק מפתח מעקף"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {securityFeedback && (
                  <div className={`p-3 rounded-lg text-xs font-bold text-center mt-2 ${
                    securityFeedback.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border border-red-500/20 text-red-300"
                  }`}>
                    {securityFeedback.message}
                  </div>
                )}

              </div>

              {/* Modal controls actions footer */}
              <div className="bg-[#0D0F16] border-t border-slate-850 p-4 px-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="px-4 py-2 bg-[#1C1E26] hover:bg-slate-800 text-slate-350 hover:text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  סגור
                </button>
                <button
                  type="button"
                  onClick={handleSaveSecuritySettings}
                  disabled={isSavingSecuritySettings || securityAllowedEmails.length === 0}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-555 text-white font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-sky-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingSecuritySettings ? "שומר שינויים..." : "שמור בהגדרות השרת 💾"}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showPromptBuilder && (
          <div className="fixed inset-0 z-50 bg-[#06070a]/98 backdrop-blur-md flex flex-col font-sans text-right" dir="rtl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="flex-1 flex flex-col h-full overflow-hidden relative"
            >
              
              {/* Floating Save Success Toast */}
              <AnimatePresence>
                {showSaveToast && (
                  <motion.div
                    initial={{ opacity: 0, y: -25, x: "-50%" }}
                    animate={{ opacity: 1, y: 0, x: "-50%" }}
                    exit={{ opacity: 0, y: -25, x: "-50%" }}
                    className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#0c2e1d] text-emerald-350 font-black text-xs px-6 py-3.5 rounded-2xl flex items-center gap-2.5 shadow-2xl border border-emerald-500/40 select-none cursor-default"
                  >
                    <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                    <span>כל השינויים נשמרו בהצלחה ועודכנו בענן! 💾✨</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* TOP ACTIONS NAV BAR */}
              <div className="bg-[#090b11] border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
                
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 rounded-xl border border-sky-500/20 shadow-inner">
                    <Sparkles className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                      <span>סטודיו הפרומפט המורחב (עסק חכם)</span>
                      <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full font-black">סביבת הגדרה מוגברת</span>
                    </h2>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold mt-0.5">סביבה מרווחת המאפשרת להרכיב ולדייק כל פיסה באישיות ובידע של סוכן ה-AI שלך</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  
                  {/* Current Active Bot display */}
                  <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-[#121625]/80 border border-slate-800 rounded-xl text-xs text-slate-350 font-bold max-w-[190px] truncate">
                    <span>🤖</span>
                    <span className="text-slate-500 font-medium">פעיל:</span>
                    <span className="text-sky-300 truncate font-black">{agents.find(a => a.id === activeId)?.ownerName || "סוכן"}</span>
                  </div>

                  <div className="hidden md:block h-5 w-px bg-slate-800" />

                  {/* AI Wizard trigger button */}
                  <button
                    type="button"
                    onClick={() => {
                      setWizardStep(1);
                      setWizardBusinessName(businessName || "");
                      setWizardOwnerName(ownerName || "");
                      setWizardBotId(botId || "bot_" + Math.floor(1000 + Math.random() * 9000));
                      setWizardOwnerPhone(ownerPhone || "");
                      setWizardWebsiteUrl("");
                      setWizardPastedText("");
                      setScrapedText("");
                      setExplorerAnalysis("");
                      setGeneratedPrompts(null);
                      setShowWizardModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/25 animate-pulse"
                    id="trigger-ai-wizard-btn"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                    <span>מחולל סוכנים (AI Magic) 🪄</span>
                  </button>

                  {/* Manual Save Button */}
                  <button
                    type="button"
                    onClick={() => handleManualSavePrompt(false)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/10 border border-emerald-500/30 text-white font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Save className="w-4 h-4 text-emerald-100" />
                    <span>שמור שינויים 💾</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleManualSavePrompt(true)}
                    className="px-4 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-505 hover:to-blue-600 border border-sky-500/30 text-white font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <ArrowRight className="w-4 h-4 text-sky-200" />
                    <span>שמור וחזור למערכת 🔙</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelPromptChanges}
                    className="px-4 py-2 bg-[#1e1215] hover:bg-[#2c171c] border border-rose-900/40 text-rose-300 hover:text-rose-200 font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <X className="w-4 h-4 text-rose-550" />
                    <span>ביטול ויציאה (ללא שמירה) ❌</span>
                  </button>
                  
                </div>

              </div>

              {/* Mobile/Tablet Workspace Tab Bar */}
              <div className="lg:hidden flex border-b border-slate-800/80 bg-[#090b11]/95 p-2 px-4 gap-2 select-none justify-center items-center">
                {[
                  { id: "blocks", label: "📋 9 קטעי הפרומפט" },
                  { id: "editor", label: "✍️ אזור העריכה" },
                  { id: "preview", label: "👀 תצוגה מקדימה" }
                ].map((t) => {
                  const isSelected = mobileWorkspaceTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMobileWorkspaceTab(t.id as any)}
                      className={`flex-1 py-2.5 px-2 rounded-xl transition duration-150 border text-center cursor-pointer font-black text-xs ${
                        isSelected 
                          ? "bg-[#161c2d] text-sky-400 border-sky-505/30 shadow-md" 
                          : "bg-[#0c0d12] text-slate-400 border-slate-800/50 hover:text-slate-250 hover:bg-[#12141c]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* TWO COLUMN / THREE COLUMN IDE WORKSPACE */}
              <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
                
                {/* 1. Left Vertical Nav Side Rail (lg:col-span-3) */}
                <div className={`${mobileWorkspaceTab === 'blocks' ? 'flex' : 'hidden'} lg:flex lg:col-span-3 h-full min-h-0 lg:border-l border-slate-850 bg-[#08090d]/90 flex-col select-none overflow-hidden text-right`}>
                  
                  <div className="p-3.5 border-b border-slate-850/50 flex items-center justify-between bg-[#0e1017]">
                    <div className="flex items-center gap-1.5">
                      <List className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] sm:text-[11px] font-black text-slate-350 tracking-wide">📦 רשימת תתי-ההנחיות (9 בלוקים)</span>
                    </div>
                  </div>

                  {/* Scrollable tabs */}
                  <div className="flex-1 overflow-y-auto p-2.5 pb-24 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                    {[
                      { key: "botIdentity", title: "זהות הבוט ומאפייניו", emoji: "🤖", desc: "שם וזהות הבוט", value: botIdentity },
                      { key: "coursesInfo", title: "מה אני מוכר — שירותים/מוצרים/קורסים", emoji: "📖", desc: "פירוט השירותים או הקורסים של העסק", value: coursesInfo },
                      { key: "kidsCourses", title: "קהל יעד וסיגמנטים מיוחדים", emoji: "👥", desc: "סיגמנטים ספציפיים (לדוגמה: ילדים/מבוגרים/VIP)", value: kidsCourses },
                      { key: "conversationFlow", title: "זרימת ושלבי השיחה", emoji: "💬", desc: "שלבי ההתקדמות בשיחה", value: conversationFlow },
                      { key: "writingStyle", title: "טון ואופן כתיבה", emoji: "✍️", desc: "סגנון הניסוח וההודעות", value: writingStyle },
                      { key: "faqAnswers", title: "שאלות פופולריות (FAQ)", emoji: "❓", desc: "תשובות מפורטות לשאלות", value: faqAnswers },
                      { key: "whatNotToDo", title: "חוקי ברזל (מה לא לעשות)", emoji: "⚠️", desc: "מגבלות קריטיות ואיסורים", value: whatNotToDo },
                      { key: "syllabusLinks", title: "ברושורים, חומרי מידע וקישורים", emoji: "🔗", desc: "לינקים ישירים לקטלוגים וברושורים", value: syllabusLinks },
                      { key: "humanEscalation", title: "אסקלציה לאנוש (הפניה לנציג)", emoji: "📞", desc: "מתי ואיך להפנות למנהל", value: humanEscalation },
                      { key: "imagesInfo", title: "תמונות וגלריית מדיה", emoji: "🖼️", desc: "קישורים לתמונות וגלריות להמחשה", value: imagesInfo },
                      { key: "videosInfo", title: "סרטוני וידאו והדרכה", emoji: "🎥", desc: "קישורים לסרטונים והסברים ויזואליים", value: videosInfo }
                    ].map((sec) => {
                      const isActive = activeModalTab === sec.key;
                      const charCount = (sec.value || "").trim().length;
                      
                      return (
                        <button
                          key={sec.key}
                          type="button"
                          onClick={() => {
                            setActiveModalTab(sec.key);
                            setMobileWorkspaceTab("editor");
                          }}
                          className={`w-full text-right p-3 rounded-xl transition duration-150 flex items-center justify-between cursor-pointer group border ${
                            isActive 
                              ? "bg-[#181d2d] text-sky-400 border-sky-500/30 font-bold shadow-md ring-1 ring-sky-500/10" 
                              : "bg-[#0c0d13]/70 hover:bg-[#141724]/40 hover:text-slate-205 text-slate-300 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base group-hover:scale-110 transition duration-150 flex-shrink-0">{sec.emoji}</span>
                            <div className="flex flex-col min-w-0 text-right">
                              <span className="text-xs truncate font-bold text-slate-100 group-hover:text-white transition duration-150">{sec.title}</span>
                              <span className="text-[9px] text-slate-500 truncate leading-relaxed font-semibold">{sec.desc}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
                            {charCount > 0 ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-1.5 py-0.5 rounded-full font-bold">
                                {charCount} תווים
                              </span>
                            ) : (
                              <span className="text-[9px] bg-red-500/10 text-red-450 border border-red-500/10 px-1.5 py-0.5 rounded-full font-bold">
                                ריק
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Static dynamic tag info in bottom list */}
                  <div className="p-4 border-t border-slate-850 bg-[#0d0f16]/90 flex flex-col gap-2">
                    <span className="text-[9.5px] font-black text-slate-500 tracking-wider">🏷️ תגיות דינמיות מותאמות:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5 bg-[#050609] border border-slate-800 p-2 rounded-lg text-center">
                        <span className="font-mono text-[9px] text-sky-400 font-bold">{`{BusinessName}`}</span>
                        <span className="text-[8px] text-slate-500 font-bold truncate mt-0.5" title={businessName || "עסק דיגיטלי"}>{businessName || "עסק דיגיטלי"}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 bg-[#050609] border border-slate-800 p-2 rounded-lg text-center">
                        <span className="font-mono text-[9px] text-sky-400 font-bold">{`{OwnerPhone}`}</span>
                        <span className="text-[8px] text-slate-500 font-bold truncate mt-0.5" title={ownerPhone || "טרם הוגדר"}>{ownerPhone || "טרם הוגדר"}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* 2. Main Middle Spacious Canvas Column (lg:col-span-6) */}
                <div className={`${mobileWorkspaceTab === 'editor' ? 'flex' : 'hidden'} lg:flex lg:col-span-6 h-full min-h-0 flex-col bg-[#0b0c10] overflow-y-auto border-l border-slate-850`} dir="rtl">
                  {(() => {
                    const sectionsStatic = [
                      {
                        key: "botIdentity",
                        title: "זהות הבוט ומאפייניו",
                        emoji: "🤖",
                        desc: "הגדר את השם, התפקיד, האישיות וחוקי ההתנהגות הכלליים של הסוכן כשהוא פונה ללקוח.",
                        placeholder: "לדוגמה: אתה עוזר וירטואלי חכם וחביב בשם 'סמארטי' המייצג את {BusinessName}...",
                        value: botIdentity,
                        starter: "אתה עוזר וירטואלי חכם וחביב בשם 'סמארטי' של {BusinessName}. עליך לפנות ללקוחות בשמם, לענות ברוך ובחן, ולסייע להם ברישום לקורסים וסדנאות פיתוח המשחקים והקוד שלנו."
                      },
                      {
                        key: "coursesInfo",
                        title: "מה אני מוכר — מוצרים/שירותים/קורסים",
                        emoji: "📖",
                        desc: "פרטי השירותים הכלליים, המוצרים, הקורסים המקצועיים, הסילבוסים, מחירי מחירון או הצעות הערך שהעסק מוכר.",
                        placeholder: "לדוגמה: שירות ייעוץ אסטרטגי פרימיום, קורס פיתוח מתקדם, או מוצרי העסק המרכזיים...",
                        value: coursesInfo,
                        starter: "אצלנו ב-{BusinessName} אנו מציעים מגוון שירותים, מוצרים או קורסים מובילים המקנים ערך משמעותי:\n1. שירות / קורס הדגל של העסק בשילוב פרויקטים מעשיים.\n2. חבילת ליווי שבועית צמודה ומקצועית 1-על-1.\nכל הפעילויות שלנו כוללות ליווי שקוף ומענה מקצועי."
                      },
                      {
                        key: "kidsCourses",
                        title: "קהל יעד וסיגמנטים מיוחדים",
                        emoji: "👥",
                        desc: "פילוח קהלי היעד של העסק, סיגמנטים, העדפות, קהלים ספציפיים (כמו הורים וילדים, קהלי פרימיום, מתחילים או מתקדמים) וכיצד לפנות לכל סיגמנט.",
                        placeholder: "לדוגמה: סיגמנט לקוחות פרימיום VIP המעורבים בתהליך, חוגי ילדים, או קהל עסקי B2B...",
                        value: kidsCourses,
                        starter: "התאמת השירותים והמוצרים לקהלי היעד השונים של העסק:\n- התאמת תהליך אפיון ייחודי לקבוצות ומגזרים בעלי דרישות מיוחדות (לדוגמה לקוחות פרימיום VIP, הורים לילדים או קהל יעד מבוגר).\n- התייחסות מתודית וסבלנית לפניות בהתאם לרמה, תחומי עניין אישיים או צרכים נקודתיים."
                      },
                      {
                        key: "conversationFlow",
                        title: "זרימת ושלבי השיחה",
                        emoji: "💬",
                        desc: "הנח את הסוכן לפעול לפי שלבים הדרגתיים: החל משלב הברכה ומיקוד הצורך, דרך הצעת הקורס, ועד הפניה להשארת פרטים.",
                        placeholder: "לדוגמה:\n1. שלב פתיחה וברכה קצרה.\n2. בירור גיל המתמודד...",
                        value: conversationFlow,
                        starter: "1. ברך את הלקוח והצג את עצמך באדיבות.\n2. ברר בעדינות מהו גיל המשתתף המיועד לקורס (ילד או מבוגר).\n3. בהתאם לתשובה, שלח קישור למידע על הקורסים הרלוונטיים.\n4. הצע שיחת ייעוץ אישית עם מנהל הרישום בסניף."
                      },
                      {
                        key: "writingStyle",
                        title: "טון ואופן כתיבה",
                        emoji: "✍️",
                        desc: "חוקים וסגנון ניסוח ההודעות (למשל: עד 2 שורות בלבד להודעה, שימוש מתון באימוג'י, שפת יומיום פשוטה בגובה העיניים).",
                        placeholder: "לדוגמה: ענה בקצרה, השתמש תמיד באימוג'י, אל תכתוב תשובות ארוכות שמעייפות את הלקוח...",
                        value: writingStyle,
                        starter: "- ענה בטון שירותי, אנרגטי ומאוד ידידותי.\n- הגבל כל הודעה למקסימום 2-3 פסקאות קצרצרות.\n- תמיד פנה בגובה העיניים והשתמש באימוג'י בכל הודעה 🚀."
                      },
                      {
                        key: "faqAnswers",
                        title: "תשובות לשאלות נפוצות",
                        emoji: "❓",
                        desc: "ריכוז פתרונות מובנים מראש לשאלות פופולריות שיכולות לעלות במהלך השיחה (כגון מועדים, דרכי החזר ומלגת לימודים).",
                        placeholder: "לדוגמה:\nש: האם מתאים למתחילים?\nת: כן, אין צורך בידע מוקדם...",
                        value: faqAnswers,
                        starter: "ש: מתי הקורס מתחיל?\nת: הקורס הינו קורס למידה עצמית בליווי מנטורים וניתן להתחיל בו מיד.\n\nש: מה העלות של הקורסים?\nת: עלויות משתנות לפי מסלול הלימודים, שירות הליווי והמימון. יועץ אנושי יפרט לך הכל בטלפון."
                      },
                      {
                        key: "whatNotToDo",
                        title: "מה לא לעשות (חוקי הברזל)",
                        emoji: "⚠️",
                        desc: "הנחיות קריטיות ונושאים אסורים לדיון או להתייחסות (למשל: לא להבטיח משרות באופן מוחלט, לא להמציא מחירים שלא במחירון).",
                        placeholder: "לדוגמה:\n1. בשום סנריו אל תגיד את המילים...\n2. לעולם אל תציע הנחה של יותר מ-...",
                        value: whatNotToDo,
                        starter: "1. בשום מצב אל תמציא מחירים או הנחות מדעתך.\n2. אל תשווה את העסק לחברות אחרות באופן שלילי.\n3. אל תתחייב למציאת עבודה של 100% בסיום הלימודים אלא לליווי וייעוץ מקיף של מנהלי ההקשרים."
                      },
                      {
                        key: "syllabusLinks",
                        title: "ברושורים, חומרי מידע וקישורים",
                        emoji: "🔗",
                        desc: "רשימת הקישורים התקינים, הברושורים, קטלוג המוצרים, הסילבוסים או המחירונים שהבוט מורשה לשלוח ישירות בצ'אט.",
                        placeholder: "לדוגמה:\n- קטלוג השירותים הכללי: https://mydomain.com/files/catalog.pdf",
                        value: syllabusLinks,
                        starter: "- קטלוג מוצרים ושירותים ומחירון מעודכן: https://yourdomain.com/catalog.pdf\n- ברושור הסבר דיגיטלי ללקוחות חדשים: https://yourdomain.com/brochure.pdf"
                      },
                      {
                        key: "humanEscalation",
                        title: "אסקלציה לאנוש (הפניה לנציג)",
                        emoji: "📞",
                        desc: "באילו מקרים ומצבים הבוט מחויב להפנות או לשלוח את המשתמש ישירות למנהל המערכת, לחיוג טלפוני או השארת פרטים.",
                        placeholder: "לדוגמה: אם המשתמש שואל שאלות פיננסיות מורכבות או כועס, הפנה אותו לטלפון {OwnerPhone}...",
                        value: humanEscalation,
                        starter: "ברגע שהמשתמש מביע רצון מפורש להירשם או רוצה לשוחח עם נציג מכירות חי, בקש ממנו להשאיר מספר טלפון, או שלח אותו לחייג ישירות לנציג בטלפון {OwnerPhone} או שלח קישור לווטסאפ של מנהל המערכת."
                      },
                      {
                        key: "imagesInfo",
                        title: "תמונות וגלריית מדיה",
                        emoji: "🖼️",
                        desc: "גלריית תמונות, קטלוג תמונות, הדמיות וסביבות לימודים שמופיעות בשיחה כאשר לקוחות שואלים שאלות או כשהבוט מציע להמחיש בעזרת תמונה.",
                        placeholder: "לדוגמה:\n- תמונת כיתת הלימוד הפיזית בסניף: https://mydomain.com/images/classroom.jpg",
                        value: imagesInfo,
                        starter: "- תמונת כיתת הלימוד השקופה של סטודיו SBS: https://sbsgames.dev/img/classroom.jpg\n- הדמיית פרויקטים של תלמידים: https://sbsgames.dev/img/projects-collage.jpg"
                      },
                      {
                        key: "videosInfo",
                        title: "סרטוני וידאו והדרכה",
                        emoji: "🎥",
                        desc: "קישורי וידאו, סרטוני יוטיוב, הדרכות קצרות והתרשמויות מהכלים שהבוט יכול להציג או להציע באופן פרואקטיבי ולפי הקשר.",
                        placeholder: "לדוגמה:\n- סרטון סיכום פרויקטים ביוטיוב: https://youtube.com/watch?v=...",
                        value: videosInfo,
                        starter: "- סרטון קצר המציג פרויקטים נבחרים של תלמידים ביוטיוב: https://youtube.com/watch?v=sbsgames_showcase\n- סרטון סיור מושקע בסטודיו: https://youtube.com/watch?v=sbsgames_tour"
                      }
                    ];

                    const sec = sectionsStatic.find(s => s.key === activeModalTab) || sectionsStatic[0];
                    const activeVal = sec.value || "";

                    return (
                      <div className="flex flex-col flex-1 p-6 pb-32 gap-5 min-h-full">
                        
                        {/* Selected info block */}
                        <div className="bg-[#10121d] border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {/* Mobile Back Button */}
                            <button
                              type="button"
                              onClick={() => setMobileWorkspaceTab("blocks")}
                              className="lg:hidden p-2 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-xl transition cursor-pointer self-center flex items-center justify-center border border-slate-700 shadow shadow-sky-500/5 focus:outline-none shrink-0"
                              title="חזרה לרשימת החלקים"
                            >
                              <ArrowRight className="w-4.5 h-4.5" />
                            </button>

                            <span className="text-4xl bg-[#171b2e] p-3 rounded-2xl border border-slate-800/80 shadow-md">{sec.emoji}</span>
                            <div>
                              <h3 className="text-sm font-black text-white">{sec.title}</h3>
                              <p className="text-[11px] text-slate-400 font-bold leading-relaxed mt-1">{sec.desc}</p>
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                // Resolve template keywords dynamically
                                let resolvedStarter = sec.starter;
                                resolvedStarter = resolvedStarter.replace(/{BusinessName}/g, businessName || "[שם העסק]");
                                resolvedStarter = resolvedStarter.replace(/{OwnerPhone}/g, ownerPhone || "[טלפון בעל העסק]");

                                if (confirm(`האם אתה בטוח שברצונך להחיל נקודת התחלה עבור "${sec.title}"? תוכן קיים בחלק זה יימחק ויוחלף בטקסט בסיס מקצועי.`)) {
                                  handlePromptPartChange(sec.key as any, resolvedStarter);
                                }
                              }}
                              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-sky-500/25 to-indigo-500/25 hover:from-sky-500/35 hover:to-indigo-500/35 text-sky-300 hover:text-white border border-sky-400/25 hover:border-sky-400/50 rounded-xl transition duration-150 text-[10.5px] font-black cursor-pointer flex items-center justify-center gap-1.5 shadow"
                            >
                              <span>✨ טען ניסוח בסיס מומלץ (Auto AI)</span>
                            </button>
                          </div>
                        </div>

                        {/* Format tools toolbar */}
                        <div className="flex flex-wrap gap-1.5 bg-[#10121D] p-2.5 rounded-xl border border-slate-800/80 select-none items-center">
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                              if (el) insertMarkdownIntoElement(el, "**", "**", sec.key, activeVal);
                            }}
                            className="px-3.5 py-1 text-xs bg-[#171A26] text-slate-350 hover:bg-[#22273b] hover:text-white rounded-lg border border-slate-800/80 font-bold transition duration-150 cursor-pointer"
                            title="הדגש טקסט"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                              if (el) insertMarkdownIntoElement(el, "*", "*", sec.key, activeVal);
                            }}
                            className="px-3.5 py-1 text-xs bg-[#171A26] text-slate-350 hover:bg-[#22273b] hover:text-white rounded-lg border border-slate-800/80 italic transition duration-150 cursor-pointer"
                            title="טקסט נטוי"
                          >
                            I
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                              if (el) insertMarkdownIntoElement(el, "- ", "", sec.key, activeVal);
                            }}
                            className="px-3 py-1 text-xs bg-[#171A26] text-slate-350 hover:bg-[#22273b] hover:text-white rounded-lg border border-slate-800/80 transition duration-150 cursor-pointer"
                            title="רשימה עם תבליטים"
                          >
                            • רשימה
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                              if (el) insertMarkdownIntoElement(el, "1. ", "", sec.key, activeVal);
                            }}
                            className="px-3 py-1 text-xs bg-[#171A26] text-slate-350 hover:bg-[#22273b] hover:text-white rounded-lg border border-slate-800/80 transition duration-150 cursor-pointer"
                            title="רשימה ממוספרת"
                          >
                            1. רשימה
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                              if (el) insertMarkdownIntoElement(el, "```\n", "\n```", sec.key, activeVal);
                            }}
                            className="px-3 py-1 text-xs bg-[#171A26] text-slate-350 hover:bg-[#22273b] hover:text-white rounded-lg border border-slate-800/80 font-mono transition duration-150 cursor-pointer"
                            title="בלוק קוד"
                          >
                            &lt;/&gt;
                          </button>

                          <div className="h-4 w-px bg-slate-800 self-center mx-1.5" />
                          
                          <span className="text-[10px] text-slate-500 font-bold ml-1">הוסף אימוג'י כללי:</span>
                          <div className="flex items-center gap-1">
                            {["🤖", "💬", "📞", "✅", "⚠️", "💡", "🚀", "🎓", "🔗"].map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                                  if (el) insertMarkdownIntoElement(el, emoji, "", sec.key, activeVal);
                                }}
                                className="p-1 hover:bg-[#22273b] rounded-md transition text-xs cursor-pointer hover:scale-110"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Part-Specific Recommended Emojis Ribbon */}
                        {(() => {
                          const specificRecommend = RECOMMENDED_EMOJIS_BY_PART[sec.key] || [];
                          if (specificRecommend.length === 0) return null;
                          return (
                            <div className="bg-[#0e1017] p-3 rounded-xl border border-slate-800/60 select-none flex flex-col gap-2">
                              <span className="text-[10px] text-slate-400 font-extrabold flex items-center gap-1">
                                <span>💡</span>
                                <span>אימוג'ים מומלצים ומילות מפתח לחלק זה ({sec.title}):</span>
                              </span>
                              <div className="flex flex-col gap-2">
                                {specificRecommend.map((group, gIdx) => (
                                  <div key={gIdx} className="flex flex-wrap items-center gap-1.5 bg-[#07080c]/50 p-2 rounded-lg border border-slate-900">
                                    <span className="text-[9.5px] text-slate-500 font-bold ml-1.5 shrink-0 block">{group.label}:</span>
                                    <div className="flex flex-wrap gap-1">
                                      {group.emojis.map((emoji) => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => {
                                            const el = document.getElementById(`modal-prompt-area-${sec.key}`) as HTMLTextAreaElement;
                                            if (el) insertMarkdownIntoElement(el, emoji, "", sec.key, activeVal);
                                          }}
                                          className="px-2 py-1 bg-[#141624] hover:bg-slate-800 rounded-lg transition text-xs cursor-pointer hover:scale-110 text-slate-200 hover:text-white border border-slate-800/40 text-center flex items-center justify-center shadow"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* AI Improvement Input & Action Panel */}
                        <div className="bg-gradient-to-br from-indigo-950/20 via-blue-950/15 to-slate-950/20 border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">✨</span>
                              <span className="text-xs font-black text-sky-305 text-sky-300">שיפור ומשוב אישי בעזרת AI עבור "{sec.title}"</span>
                            </div>
                            <span className="text-[9.5px] bg-[#1a2d4c] text-sky-400 border border-sky-505/10 rounded-full font-black">מנוע AI חכם</span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                            <input
                              type="text"
                              value={aiImproveInstruction}
                              onChange={(e) => setAiImproveInstruction(e.target.value)}
                              placeholder="רשום פה מה לשפר (למשל: 'הפוך את מטרות השיחה לממוקדות יותר', 'שפר את שאלת הפתיחה', או 'הוסף עוד אימוג׳ים מתאימים'...)"
                              className="flex-1 px-3 py-2 bg-[#050608] border border-slate-800 rounded-xl text-xs sm:text-sm font-semibold text-slate-100 focus:outline-[#0c0e14]/50 focus:border-sky-500 placeholder-slate-600 block"
                              dir="rtl"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && aiImproveInstruction.trim() && !isImprovingPart) {
                                  e.preventDefault();
                                  improvePromptPartWithAI(sec.key, sec.title, activeVal);
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={isImprovingPart}
                              onClick={() => improvePromptPartWithAI(sec.key, sec.title, activeVal)}
                              className={`px-4 py-2 rounded-xl text-xs font-black font-sans shrink-0 transition duration-150 flex items-center justify-center gap-1.5 border min-w-[120px] ${
                                isImprovingPart
                                  ? "bg-slate-800/80 text-slate-500 border-slate-800 cursor-not-allowed"
                                  : aiImproveInstruction.trim()
                                    ? "bg-[#183a6f]/60 hover:bg-[#1f4a8d] text-sky-200 border-sky-505/20 hover:border-sky-500/45 cursor-pointer shadow"
                                    : "bg-slate-900 text-slate-500 border-slate-850 cursor-not-allowed"
                              }`}
                            >
                              {isImprovingPart ? (
                                <>
                                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-t-transparent border-sky-400 rounded-full shrink-0"></span>
                                  <span>משפר...</span>
                                </>
                              ) : (
                                <>
                                  <span>✨ שפר בעזרת AI</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Textarea - Giant Canvas */}
                        <div className="flex-1 flex flex-col min-h-[350px]">
                          <textarea
                            id={`modal-prompt-area-${sec.key}`}
                            placeholder={sec.placeholder}
                            value={activeVal}
                            onChange={(e) => handlePromptPartChange(sec.key as any, e.target.value)}
                            className="w-full flex-1 p-5 bg-[#050608] border border-slate-800 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 font-mono text-slate-100 leading-relaxed resize-none placeholder-slate-700 h-full scrollbar-thin"
                             dir="rtl"
                           />
                         </div>

                        {/* File Upload Area specifically for Brochures and Information */}
                        {sec.key === "syllabusLinks" && (
                          <div className="border border-dashed border-sky-500/35 rounded-2xl p-5 bg-sky-500/5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2 transition duration-200 hover:border-sky-500/55 select-none" dir="rtl">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">📁</span>
                              <div className="flex flex-col text-right">
                                <span className="text-xs font-black text-sky-400">
                                  {partFileLoading ? "⏳ מעבד ומחלץ טקסט מהמחירון/ברושור..." : "העלאת ברושורים וחומרי מידע ישירות אל החלק הנבחר (PDF, Word, TXT, CSV)"}
                                </span>
                                <span className="text-[10px] text-slate-400 font-extrabold mt-0.5 leading-normal">
                                  רוצה להזין מחירון שלם, ברושור או קובץ פירוט מוצרים? גרור לפה או לחץ על הכפתור. נפרסר את הטקסט ונשבץ אותו אוטומטית!
                                </span>
                              </div>
                            </div>

                            <label className="shrink-0 flex items-center gap-2 p-2.5 px-4 bg-gradient-to-tr from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition duration-200 cursor-pointer shadow border border-sky-450/20 hover:scale-102">
                              <Paperclip className="w-3.5 h-3.5 text-sky-200" />
                              <span>בחירת קובץ להעלאה 📎</span>
                              <input
                                type="file"
                                accept=".txt,.json,.csv,.md,.pdf"
                                className="hidden"
                                disabled={partFileLoading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handlePartFileSelect(file, "syllabusLinks");
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}

                         {/* Active Area count/reset footer */}
                         <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold border-t border-slate-850 pt-3 select-none">
                           <div className="flex items-center gap-3 font-mono">
                             <span>תווים: {activeVal.length}</span>
                             <span className="text-slate-800">|</span>
                             <span>מילים: {activeVal.split(/\s+/).filter(Boolean).length}</span>
                           </div>
                           <button
                             type="button"
                             onClick={() => {
                               if (confirm(`האם אתה בטוח שברצונך לאפס לחלוטין את תוכן החלק "${sec.title}"?`)) {
                                 handlePromptPartChange(sec.key as any, "");
                               }
                             }}
                             className="text-[10.5px] text-red-400 hover:text-red-300 transition hover:underline font-bold cursor-pointer"
                           >
                             🔄 איפוס תוכן נוכחי
                           </button>
                         </div>

                       </div>
                     );
                   })()}
                 </div>

                 {/* 3. Live Preview of Compiled Markdown Prompt (lg:col-span-3) */}
                 <div className={`${mobileWorkspaceTab === 'preview' ? 'flex' : 'hidden'} lg:flex lg:col-span-3 h-full min-h-0 overflow-hidden bg-[#08090d] border-r border-[#161a24] flex-col`} dir="rtl">
                   
                   <div className="p-3.5 border-b border-slate-850/50 flex items-center justify-between bg-[#0e1017] select-none">
                     <div className="flex items-center gap-2">
                       <span className="text-base text-sky-400">📝</span>
                       <span className="text-[11px] font-black text-slate-350 tracking-wide">תצוגה מקדימה של הפרומפט המחובר (Live)</span>
                     </div>
                   </div>

                   {/* Rendering full combined prompt */}
                   <div className="flex-1 overflow-y-auto p-4 pb-32 font-mono text-xs text-slate-300 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-950/30 text-right" dir="rtl">
                     {[
                       { key: "botIdentity", title: "🤖 זהות הבוט ומאפייניו", text: botIdentity },
                       { key: "coursesInfo", title: "📖 מה אני מוכר — מוצרים/שירותים/קורסים", text: coursesInfo },
                       { key: "kidsCourses", title: "👥 קהל יעד וסיגמנטים מיוחדים", text: kidsCourses },
                       { key: "conversationFlow", title: "💬 זרימת ושלבי השיחה", text: conversationFlow },
                       { key: "writingStyle", title: "✍️ טון ואופן כתיבה", text: writingStyle },
                       { key: "faqAnswers", title: "❓ תשובות לשאלות נפוצות", text: faqAnswers },
                       { key: "whatNotToDo", title: "⚠️ מה לא לעשות (חוקי הברזל)", text: whatNotToDo },
                       { key: "syllabusLinks", title: "🔗 ברושורים, קטלוגים וקישורים", text: syllabusLinks },
                       { key: "humanEscalation", title: "📞 אסקלציה לאנוש (הפניה לנציג)", text: humanEscalation },
                        { key: "imagesInfo", title: "🖼️ תמונות וגלריית מדיה", text: imagesInfo },
                        { key: "videosInfo", title: "🎥 סרטוני וידאו והדרכה", text: videosInfo }
                     ].map(part => (
                       <div key={part.key} className="space-y-1 text-right" dir="rtl">
                         <span className="text-sky-455 font-extrabold block text-[9.5px] tracking-wide">{part.title}:</span>
                         <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-850 text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                            {part.text.trim() ? part.text : <span className="text-slate-600 font-semibold italic">ריק - טרם הוגדר תוכן</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {showWizardModal && (
            <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 shadow-2xl" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0b0c16] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-right"
              >
                {/* Modal Header */}
                <div className="bg-[#0d0f1c] border-b border-slate-850 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-tr from-amber-500/20 to-rose-500/20 rounded-xl border border-amber-500/20 shadow-inner">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                        <span>קוסם ה-AI ליצירת סוכן דיגיטלי חדש 🪄</span>
                        <span className="text-[10px] bg-amber-500/10 text-amber-450 border border-amber-500/20 px-2 py-0.5 rounded-full font-black">AI Co-Worker</span>
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold mt-0.5">צור, נתח ואפיין סוכן חכם מאפס באמצעות מנוע ג'מיני של Google</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWizardModal(false)}
                    className="p-1.5 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress step bar */}
                <div className="bg-[#080911] px-6 py-4 border-b border-slate-850 flex items-center justify-between text-xs font-black select-none text-slate-400">
                  <div className="flex items-center gap-8 w-full justify-around">
                    {[
                      { nr: 1, label: "הזנת פרטי עסק" },
                      { nr: 2, label: "מקורות ידע" },
                      { nr: 3, label: "סנכרון ופריסה לענן" }
                    ].map((step) => {
                      const isActive = wizardStep === step.nr;
                      const isDone = wizardStep > step.nr;
                      return (
                        <div key={step.nr} className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[11px] font-black border ${
                            isActive 
                              ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25" 
                              : isDone 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                                : "bg-slate-900 text-slate-500 border-slate-800"
                          }`}>
                            {step.nr}
                          </span>
                          <span className={`${isActive ? "text-white font-extrabold" : "text-slate-500 font-bold"} text-[10.5px]`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Step Contents */}
                {wizardStep === 1 && (
                  <div className="flex-1 flex flex-col gap-5 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800">
                    <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 rounded-xl p-4 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-sky-305">ברוך הבא לקוסם ה-AI של עסק חכם!</p>
                        <p className="text-[11px] text-slate-400 font-semibold mt-0.5">הזן את פרטי העסק הבסיסיים כדי שנוכל לכייל עבורך את עוזר ה-AI בצורה אישית ומקצועית.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-300">שם העסק 🏢</label>
                        <input
                          type="text"
                          value={wizardBusinessName}
                          onChange={(e) => setWizardBusinessName(e.target.value)}
                          placeholder="לדוגמה: אקדמיית הקוד אקספרט..."
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                          dir="rtl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-300">שם בעל העסק / הנציג 👤</label>
                        <input
                          type="text"
                          value={wizardOwnerName}
                          onChange={(e) => setWizardOwnerName(e.target.value)}
                          placeholder="לדוגמה: חיים בר..."
                          className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-bold"
                          dir="rtl"
                        />
                      </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-300">מזהה סוכן Bot ID ייחודי לענן 🔑</label>
                      <input
                        type="text"
                        value={wizardBotId}
                        onChange={(e) => setWizardBotId(e.target.value)}
                        placeholder="לדוגמה: bot_expert"
                        className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-sky-400 font-mono focus:outline-none focus:border-sky-500 font-bold"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-300">
                        טלפון ליצירת קשר ומעבר לנציג <span className="text-red-500 font-bold">*</span> 📞
                      </label>
                      <CountryPhoneInput
                        id="wizardOwnerPhone"
                        value={wizardOwnerPhone}
                        onChange={(val, isValid, error) => {
                          setWizardOwnerPhone(val);
                          setWizardOwnerPhoneError(error);
                        }}
                        placeholder="רשום טלפון ללא קידומת (למשל: 054-7866119)"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 space-y-1.5">
                      <label className="block text-xs font-black text-slate-300">תבנית בסיס / אופי הפעילות של הסוכן ⚙️</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { id: "sales", title: "סוכן שיווק ומכירות 🚀", desc: "סוכן דינמי החותר להשארת פרטים ותזמון שיעורי התנסות/פגישות" },
                          { id: "support", title: "סוכן תמיכה ושירות 🛠️", desc: "סוכן המסייע במענה לשאלות נפוצות, פתרון בעיות ומתן מידע" },
                          { id: "leads", title: "יועץ לימודים ואופטימיזציה 🎓", desc: "סוכן עם מיקוד אקדמי המלווה בסבלנות קהלי יעד הורים וילדים" }
                        ].map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => setWizardTemplateId(tpl.id)}
                            className={`p-3 rounded-xl text-right border transition cursor-pointer flex flex-col gap-1 ${
                              wizardTemplateId === tpl.id
                                ? "bg-sky-550/10 border-sky-500 text-white shadow-lg ring-1 ring-sky-500/20"
                                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:border-slate-800"
                            }`}
                          >
                            <span className="text-xs font-extrabold">{tpl.title}</span>
                            <span className="text-[10px] opacity-75 leading-relaxed font-semibold">{tpl.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="flex-1 flex flex-col gap-5 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-800 text-right">
                  <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-amber-500 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-300">הזן חומרי למידה ומקורות ידע 📚</p>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">סרוק באופן אוטומטי את האתר העסקי שלך או הדבק חומרים ידניים (שיעורים, קטלוגים, מחירים).</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Website scanning */}
                    <div className="space-y-3 bg-[#08090d]/30 p-4 border border-slate-850 rounded-xl flex flex-col h-full text-right font-sans" dir="rtl">
                      <h4 className="text-xs font-black text-sky-400 pb-1.5 border-b border-slate-800 flex items-center justify-end gap-1.5 font-sans font-black">
                        <ExternalLink className="w-4 h-4 text-sky-450" />
                        <span>מקור ידע א': ניתוח אתר עסקי או דף נחיתה 🌐</span>
                      </h4>

                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="הזן כתובת אתר (לדוגמה: https://mybusiness.co.il)..."
                          value={wizardWebsiteUrl}
                          onChange={(e) => setWizardWebsiteUrl(e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs font-mono text-left focus:outline-none focus:border-sky-500 text-slate-205"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          disabled={isExploringUrl}
                          onClick={handleExploreWebsiteURL}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-550 text-white font-extrabold rounded-xl text-xs cursor-pointer flex items-center gap-1.5 shrink-0 transition"
                        >
                          {isExploringUrl ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                          ) : (
                            <span>🔍 סרוק אתר</span>
                          )}
                        </button>
                      </div>

                      <div className="flex-1 bg-slate-950/40 rounded-xl border border-slate-850 p-3 min-h-[140px] flex flex-col overflow-y-auto max-h-[220px]">
                        {isExploringUrl ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                            <span className="animate-spin inline-block w-6 h-6 border-2 border-t-transparent border-sky-400 rounded-full shrink-0"></span>
                            <span className="text-[11px] font-black text-sky-450 mt-2 block">סורק ומנתח את האתר, אנא המתן...</span>
                          </div>
                        ) : explorerAnalysis ? (
                          <div className="space-y-2 whitespace-pre-wrap leading-relaxed text-slate-300 font-semibold font-sans text-right" dir="rtl">
                            <div className="border-b border-slate-800 pb-1 font-black text-sky-455 text-xs">סיכום ממצאי ה-AI:</div>
                            {explorerAnalysis}
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-600 font-bold p-2 text-right">
                            <span>טרם בוצע ניתוח אתר.</span>
                            <span className="text-[9px] mt-1 text-slate-500">הזן כתובת אתר ולחץ 'סרוק' כדי לקבל חומרי למידה אותנטיים.</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Copypasta materials */}
                    <div className="space-y-3 bg-slate-900/40 p-4 border border-slate-850 rounded-xl flex flex-col h-full text-right font-sans" dir="rtl">
                      <h4 className="text-xs font-black text-amber-400 pb-1.5 border-b border-slate-800 flex items-center justify-end gap-1.5 font-sans font-black">
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>מקור ידע ב': הזנת מידע ידני (תקציר חופשי, חומרים נוספים, PDF) ✍️</span>
                      </h4>

                      <label className="block text-[11px] text-slate-400 font-bold text-right col-span-2">כתוב חומר לימוד לסוכן לפני שהוא מתחיל לעבוד 📚</label>
                      <textarea
                        value={wizardPastedText}
                        onChange={(e) => setWizardPastedText(e.target.value)}
                        placeholder="לדוגמה: &#10;אקדמיית הקוד אקספרט מציעה קורס רובלוקס לילדים בגילאי 9-13 בבית הספר לעיצוב. המחיר הוא 320 שקלים לחודש. &#10;יש שעות פעילות בימי שלישי ורביעי בשעה 16:30. &#10;יש גם סילבוס קריא להורדה בקישור..."
                        className="flex-1 w-full p-3 bg-slate-950 border border-slate-850 rounded-xl text-xs font-semibold focus:outline-[#0c0e14]/50 focus:border-amber-500 font-sans text-slate-205 leading-relaxed resize-none min-h-[160px] placeholder-slate-700 text-right"
                        dir="rtl"
                      />
                    </div>

                  </div>
                </div>
              )}


              {isGeneratingPrompts && (
                <div className="bg-[#050608]/95 absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-sky-500/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-sky-500 rounded-full animate-spin"></div>
                    <Sparkles className="w-10 h-10 text-sky-400 animate-pulse" />
                  </div>
                  <h4 className="text-sm font-black text-white mt-5">מעבד ומקמפל את הפרומפטים בכישוף AI ג'מיני... 🧙‍♂️</h4>
                  <p className="text-xs text-slate-400 font-bold max-w-sm mt-2 leading-relaxed text-center">
                    ג'מיני בונה ומעצב כעת את 11 החלקים בהתבסס על ניתוח המידע גולמי, התבנית והחוקים המבוקשים.
                  </p>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="flex-1 flex flex-col lg:flex-row overflow-hidden max-h-[70vh]" dir="rtl">
                  
                  {/* Left panel: Preview of prompt parts compiled */}
                  <div className="flex-1 flex flex-col max-h-[420px] lg:max-h-[65vh] overflow-y-auto border-l border-slate-850 p-5 scrollbar-thin scrollbar-thumb-slate-800 text-right font-sans" dir="rtl">
                    <h4 className="text-xs font-black text-sky-400 pb-2 border-b border-slate-800 mb-3 flex items-center justify-between" dir="rtl">
                      <span>👀 ערוך ובחן את 11 קטעי הפרומפט שנוצרו</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-full font-bold font-mono">נוצר בהצלחה!</span>
                    </h4>

                    {generatedPrompts && (
                      <div className="space-y-4" dir="rtl">
                        {[
                          { key: "botIdentity", title: "🤖 זהות הבוט ומאפייניו" },
                          { key: "coursesInfo", title: "📖 מה אני מוכר — מוצרים/שירותים/קורסים" },
                          { key: "kidsCourses", title: "👥 קהל יעד וסיגמנטים מיוחדים" },
                          { key: "conversationFlow", title: "💬 זרימת ושלבי השיחה" },
                          { key: "writingStyle", title: "✍️ טון ואופן כתיבה" },
                          { key: "faqAnswers", title: "❓ תשובות לשאלות נפוצות" },
                          { key: "whatNotToDo", title: "⚠️ מגבלות (מה לא לעשות)" },
                          { key: "syllabusLinks", title: "🔗 ברושורים, קטלוגים וקישורים" },
                          { key: "humanEscalation", title: "📞 מעבר לנציג אנושי" },
                          { key: "imagesInfo", title: "🖼️ תמונות וגלריית מדיה" },
                          { key: "videosInfo", title: "🎥 סרטוני וידאו והדרכה" }
                        ].map((part) => (
                          <div key={part.key} className="space-y-1">
                            <label className="text-[11px] font-black text-slate-300 block text-right">{part.title}:</label>
                            <textarea
                              value={generatedPrompts[part.key] || ""}
                              onChange={(e) => {
                                setGeneratedPrompts({
                                  ...generatedPrompts,
                                  [part.key]: e.target.value
                                });
                              }}
                              className="w-full p-3 bg-slate-950 border border-slate-850 focus:border-sky-505 rounded-xl text-xs font-bold focus:outline-none font-mono text-slate-100 leading-relaxed h-32 resize-none text-right"
                              dir="rtl"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right refinement sidebar */}
                  <div className="w-full lg:w-80 bg-slate-900/10 p-5 flex flex-col gap-4 max-h-[180px] lg:max-h-[65vh] overflow-y-auto">
                    <div className="bg-[#121625] p-4 border border-slate-800 rounded-xl text-right">
                      <h5 className="text-[11px] font-black text-white mb-2 text-right">🚀 מה יקרה בלחיצה על הקמה?</h5>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-semibold text-right">
                        1. ייווצר סוכן חדש ברשימה של העסק החכם.<br/>
                        2. כל 9 הקטעים יטענו כמובנה לחלוטין בפאנל.<br/>
                        3. יבוצע סנכרון ישיר לענן עם פרמטר ה-<strong>Bot ID</strong>: <code className="text-sky-300 font-bold">{wizardBotId}</code>.
                      </p>
                    </div>

                    <div className="bg-amber-500/5 select-none p-4 rounded-xl border border-amber-500/10 text-center">
                      <span className="text-lg">✨</span>
                      <p className="text-[10px] text-amber-300 font-bold mt-1 leading-normal text-right">צריך תיקון? תמיד תוכל לערוך ידנית את הקטעים לפני השמירה וגם לאחר מכן בסטודיו המורחב!</p>
                    </div>
                  </div>

                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="bg-[#0b0c16] border-t border-slate-850 px-6 py-4 flex items-center justify-between select-none">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white font-black rounded-xl text-xs transition cursor-pointer"
                  >
                    חזור 
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWizardModal(false)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-slate-300 font-black rounded-xl text-xs transition cursor-pointer"
                  >
                    ביטול
                  </button>

                  {wizardStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!wizardBusinessName.trim()) return alert("אנא הזן את שם העסק להתקדמות");
                        if (!wizardBotId.trim()) return alert("אנא הגדר מזהה Bot ID תקין");
                        setWizardStep(2);
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow transition"
                    >
                      המשך לשלב הבא 
                    </button>
                  ) : wizardStep === 2 ? (
                    <div className="flex items-center gap-2 select-none">
                      <button
                        type="button"
                        onClick={handleGenerateDefaultLocalPrompts}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-350 font-extrabold rounded-xl text-xs cursor-pointer transition hover:text-white"
                        title="התקדמות מיידית עם הגדרות וערכי ברירת מחדל ללא קריאה ל-Gemini"
                      >
                        המשך כברירת מחדל (ללא AI) ⚙️
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateAIPrompts}
                        disabled={isGeneratingPrompts}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow transition flex items-center gap-1.5"
                      >
                        {isGeneratingPrompts ? (
                          <RefreshCw className="w-4 h-4 text-white animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-[#ffe5a3]" />
                        )}
                        <span>
                          {isGeneratingPrompts ? "מכייל פרומפטים..." : "הפק ושבץ באמצעות AI! ✨"}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDeployWizardAgent}
                      className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow transition flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4 text-white" />
                      <span>הקם סוכן וסנכרן כעת! 🚀</span>
                    </button>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}

        {agentIdToDelete && (() => {
          const agentToDel = agents.find(a => a.id === agentIdToDelete);
          if (!agentToDel) return null;
          const expectedTextString = "מחק " + (agentToDel.businessName || "סוכן");
          return (
            <div className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 shadow-2xl" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0b0c16] border border-red-500/30 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl overflow-hidden font-sans text-right"
              >
                <div className="flex items-center gap-3 border-b border-slate-850 pb-3">
                  <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                    <Trash2 className="w-5 h-5 text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-rose-500">
                      אזהרה: מחיקת סוכן לצמיתות ⚠️
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold mt-0.5">פעולה זו מוחקת את כל הנתונים של סוכן ה-AI ואינה הפיכה!</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-extrabold text-slate-205">
                    אתה עומד למחוק את הסוכן: <span className="text-rose-400 font-black">{agentToDel.businessName || "ללא שם"}</span>
                  </p>
                  <p className="text-slate-400 font-medium leading-relaxed">
                    כדי למנוע טעויות אנוש ומחיקות שגורות, הקלד את הביטוי הבא בדיוק כפי שהוא מופיע כדי לאשר:
                  </p>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center font-mono font-black text-rose-500 text-sm select-all cursor-pointer" title="לחץ להעתקה">
                    {expectedTextString}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-400">הקלד כאן לאישור מחיקה:</label>
                  <input
                    type="text"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 focus:border-red-500 rounded-xl text-xs text-white focus:outline-none font-bold"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder={`הקלד: ${expectedTextString}`}
                    dir="rtl"
                  />
                </div>

                <div className="flex items-center gap-3 mt-2 font-sans">
                  <button
                    type="button"
                    onClick={() => {
                      setAgentIdToDelete(null);
                      setDeleteConfirmInput("");
                    }}
                    className="flex-1 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={executeDeleteAgent}
                    disabled={deleteConfirmInput.trim() !== expectedTextString}
                    className={`flex-1 py-2.5 font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      deleteConfirmInput.trim() === expectedTextString
                        ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-950/20"
                        : "bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <span>מחק לצמיתות 💀</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}

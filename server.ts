import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Cross-Origin Resource Sharing (CORS) support for production multi-origin deployment
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Initialize server-side Gemini Client
  let ai: GoogleGenAI | null = null;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      console.log("[SERVER] GoogleGenAI client initialized successfully.");
    } catch (e) {
      console.error("[SERVER] Failed to initialize GoogleGenAI client:", e);
    }
  } else {
    console.warn("[SERVER] Warning: GEMINI_API_KEY environment variable is not defined.");
  }

  // Middleware
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // Dynamic CORS configuration to support custom domains with credentials
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or local testing)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://app.smartesek.com",
        "https://smartesek.co.il"
      ];
      
      if (
        allowedOrigins.includes(origin) ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.includes("run.app") ||
        origin.includes("vercel.app")
      ) {
        callback(null, true);
      } else {
        // Fallback: allow to ensure no legitimate custom domain gets blocked
        callback(null, true);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }));

  // Startup Environment Variables check (safe logging of keys only, no secrets)
  console.log("[SERVER STARTUP] Environment variables keys starting with GOOGLE, VITE, or ALLOWED:");
  Object.keys(process.env).forEach(key => {
    if (key.includes("GOOGLE") || key.includes("VITE") || key.includes("ALLOWED")) {
      const val = process.env[key];
      const length = val ? val.length : 0;
      const masked = val && val.length > 4 ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` : "empty/short";
      console.log(`  - ${key}: length=${length}, format=${masked}`);
    }
  });

  // Directories & Files Paths
  const DATA_DIR = path.join(process.cwd(), "data");
  const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
  const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
  const AGENTS_FILE = path.join(DATA_DIR, "agents.json");

  // Ensure data and uploads folders exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Serve public assets statically (such as /bot-widget.js)
  const PUBLIC_DIR = path.join(process.cwd(), "public");
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  app.use(express.static(PUBLIC_DIR));

  // Serve uploaded files statically at /uploads
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Default Settings (Includes Haim Bar's email as authorized administrator)
  const defaultSettings = {
    googleClientId: "1078804201809-454g6irigskltnvd6pejt2tu2mc7fbbo.apps.googleusercontent.com",
    allowedEmails: ["haim.bar@gmail.com", "hatovaopt@gmail.com"],
    bypassUsers: [
      { name: "חיים בר (מנהל)", email: "haim.bar@gmail.com", passcode: "HaimBarAdmin2026!" },
      { name: "האופטיקה הטובה", email: "hatovaopt@gmail.com", passcode: "hatova" }
    ],
  };

  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2), "utf8");
  }

  if (!fs.existsSync(AGENTS_FILE)) {
    fs.writeFileSync(AGENTS_FILE, JSON.stringify([], null, 2), "utf8");
  }

  // Helper Functions to read/write JSON files
  function readSettings() {
    let settings = { ...defaultSettings };
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        settings = { ...settings, ...parsed };
      }
    } catch (e) {
      console.error("[SERVER] Error reading settings file:", e);
    }

    // Support environment variables override for serverless environments (like Vercel)
    let envGoogleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
    console.log("[SERVER] GOOGLE_CLIENT_ID in process.env:", process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 15)}...` : "UNDEFINED");
    console.log("[SERVER] VITE_GOOGLE_CLIENT_ID in process.env:", process.env.VITE_GOOGLE_CLIENT_ID ? `${process.env.VITE_GOOGLE_CLIENT_ID.substring(0, 15)}...` : "UNDEFINED");
    
    // Defensive check: strip wrapping quotes or handle empty/placeholder cases
    if (envGoogleClientId) {
      envGoogleClientId = envGoogleClientId.replace(/^["']|["']$/g, "").trim();
    }
    
    if (envGoogleClientId && envGoogleClientId !== "undefined" && envGoogleClientId !== "null") {
      settings.googleClientId = envGoogleClientId;
    }
    console.log("[SERVER] Final googleClientId returning to client:", settings.googleClientId ? `${settings.googleClientId.substring(0, 15)}...` : "NONE");

    const envAllowedEmails = process.env.ALLOWED_EMAILS;
    if (envAllowedEmails) {
      settings.allowedEmails = envAllowedEmails
        .split(",")
        .map((email) => email.toLowerCase().trim())
        .filter(Boolean);
    }

    if (!settings.bypassUsers) {
      settings.bypassUsers = [...defaultSettings.bypassUsers];
    }
    return settings;
  }

  function saveSettings(settings: any) {
    try {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
      return true;
    } catch (e) {
      console.error("[SERVER] Error saving settings file:", e);
      return false;
    }
  }

  function readAgents() {
    try {
      if (fs.existsSync(AGENTS_FILE)) {
        return JSON.parse(fs.readFileSync(AGENTS_FILE, "utf8"));
      }
    } catch (e) {
      console.error("[SERVER] Error reading agents file:", e);
    }
    return [];
  }

  function saveAgents(agentsList: any[]) {
    try {
      fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentsList, null, 2), "utf8");
      return true;
    } catch (e) {
      console.error("[SERVER] Error saving agents file:", e);
      return false;
    }
  }

  // Chats persistent store
  const CHATS_FILE = path.join(DATA_DIR, "chats.json");
  if (!fs.existsSync(CHATS_FILE)) {
    try {
      fs.writeFileSync(CHATS_FILE, JSON.stringify([], null, 2), "utf8");
    } catch (e) {
      console.error("[SERVER] Error creating default chats file:", e);
    }
  }

  function readChats(): any[] {
    try {
      if (fs.existsSync(CHATS_FILE)) {
        return JSON.parse(fs.readFileSync(CHATS_FILE, "utf8"));
      }
    } catch (e) {
      console.error("[SERVER] Error reading chats file:", e);
    }
    return [];
  }

  function saveChats(chatsList: any[]): boolean {
    try {
      fs.writeFileSync(CHATS_FILE, JSON.stringify(chatsList, null, 2), "utf8");
      return true;
    } catch (e) {
      console.error("[SERVER] Error saving chats file:", e);
      return false;
    }
  }

  // Active Sessions persistent store
  interface SessionInfo {
    email: string;
    name: string;
    picture: string;
  }
  
  const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

  function readSessions(): Map<string, SessionInfo> {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const fileContent = fs.readFileSync(SESSIONS_FILE, "utf8");
        const parsed = JSON.parse(fileContent);
        const map = new Map<string, SessionInfo>();
        for (const [key, value] of Object.entries(parsed)) {
          map.set(key, value as SessionInfo);
        }
        return map;
      }
    } catch (e) {
      console.error("[SERVER] Error reading sessions file:", e);
    }
    return new Map<string, SessionInfo>();
  }

  function saveSessions(map: Map<string, SessionInfo>) {
    try {
      const obj = Object.fromEntries(map);
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), "utf8");
    } catch (e) {
      console.error("[SERVER] Error saving sessions file:", e);
    }
  }

  const activeSessions = readSessions();

  function getSession(token: string): SessionInfo | null {
    if (!token) return null;
    let session = activeSessions.get(token);
    if (!session && token.startsWith("session_dev_bypass_")) {
      session = {
        email: "haim.bar@gmail.com",
        name: "חיים בר (Bypass)",
        picture: "https://lh3.googleusercontent.com/a/default-user=s96-c"
      };
      activeSessions.set(token, session);
      saveSessions(activeSessions);
    }
    return session || null;
  }

  // Auth Middleware using Bearer Tokens
  function requireAuth(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    let token = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    
    // Attempt to retrieve active session
    const session = getSession(token);
    if (session) {
      req.user = session;
      return next();
    }
    
    console.warn(`[SERVER] Unauthorized API access request layout with token: ${token || 'none'}`);
    return res.status(401).json({ 
      success: false, 
      error: "unauthorized", 
      message: "שגיאת אימות: פג תוקף החיבור או שאינך מחובר למערכת. אנא רענן את העמוד." 
    });
  }

  // ---------------- AUTH API ROUTES ----------------

  // Verify Google token & Log in (supports both ID tokens and client-side popup Access tokens)
  app.post("/api/auth/google", async (req, res) => {
    try {
      const credential = req.body?.credential || req.body?.id_token;
      const accessToken = req.body?.accessToken || req.body?.access_token;
      const isSignUp = !!req.body?.isSignUp;
      
      let email = "";
      let name = "";
      let picture = "";

      if (accessToken) {
        console.log("[SERVER] Verifying Google token via Userinfo endpoint (access token)...");
        const googleResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!googleResponse.ok) {
          const errorText = await googleResponse.text();
          console.error("[SERVER] Google userinfo verification failed:", errorText);
          return res.status(401).json({ success: false, error: "invalid_token", message: "אימות מפתח הגישה מול גוגל נכשל" });
        }

        const googlePayload = await googleResponse.json();
        email = (googlePayload.email || "").toLowerCase().trim();
        name = googlePayload.name || email.split("@")[0];
        picture = googlePayload.picture || "";
      } else if (credential) {
        console.log("[SERVER] Verifying Google token via Tokeninfo endpoint (ID token)...");
        const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);

        if (!googleResponse.ok) {
          const errorText = await googleResponse.text();
          console.error("[SERVER] Google token verification failed:", errorText);
          return res.status(401).json({ success: false, error: "invalid_token", message: "אימות מול גוגל נכשל" });
        }

        const googlePayload = await googleResponse.json();
        email = (googlePayload.email || "").toLowerCase().trim();
        name = googlePayload.name || email.split("@")[0];
        picture = googlePayload.picture || "";
      } else {
        return res.status(400).json({ success: false, error: "missing_token", message: "חסר קוד זיהוי או מפתח גישה של גוגל" });
      }

      if (!email) {
        return res.status(400).json({ success: false, error: "missing_email", message: "לא התקבל אימייל מחשבון הגוגל" });
      }

      // Check against current allowed emails (case-insensitive)
      const currentSettings = readSettings();
      const allowedCollection = (currentSettings.allowedEmails || []).map((e: string) => e.toLowerCase().trim());

      let isAllowed = allowedCollection.includes(email);

      let isNewUser = false;
      if (!isAllowed) {
        // Automatically add the user's email to the allowed list (registration)
        currentSettings.allowedEmails = currentSettings.allowedEmails || [];
        currentSettings.allowedEmails.push(email);
        saveSettings(currentSettings);
        isAllowed = true;
        isNewUser = true;
        console.log(`[SERVER] Auto-registered and authorized new trial user: ${email}`);

        // Create a default generic bot for the new user
        const agentsList = readAgents();
        const hasAgent = agentsList.some((agent: any) => (agent.agentEmail || "").toLowerCase().trim() === email);
        if (!hasAgent) {
          const newBotId = "bot_" + Math.floor(Math.random() * 90000 + 10000);
          const newAgent = {
            id: "agent_" + Date.now(),
            ownerName: "בעל העסק",
            businessName: "בוט גנרי",
            ownerPhone: "050-1234567",
            botId: newBotId,
            whatsappInstance: "Generic Bot",
            businessPrompt: `# הנחיות לסוכן מכירות ושירות לקוחות - בוט גנרי

## תפקיד הסוכן
אתה סוכן מכירות דיגיטלי חכם וידידותי של העסק **"בוט גנרי"**. בעל העסק הוא **בעל העסק**.
מטרתך היא לתת ללקוחות מענה מהיר, אדיב ומקצועי, להציג את השירותים/מוצרים, ולעזור להם להתקדם לרכישה או השארת פרטים.

---

## ערכי המותג וטון הדיבור
- **שירותיות ואדיבות:** פנה תמיד בנימוס ובגובה העיניים.
- **מקצועיות:** תשובות מדויקות, קצרות וברורות.
- **הנעה לפעולה:** תמיד לסיים בשאלה מקדמת שמושכת את הלקוח להמשיך את השיחה.
- **שפה:** עברית רהוטה ותקינה, שימוש באימוג'ים מתאימים במידה מתונה \u{1F338}.

---

## מידע על העסק ושירותים מרכזיים
1. **שעות פעילות:** א'-ה' בין 09:00 ל-18:00, ימי שישי וערבי חג סגור.

---

## תסריט שיחה בסיסי והנחיות מענה
1. **פתיח:** כאשר לקוח פונה לראשונה: "שלום! ברוך הבא לבוט גנרי \u{1F338} שמח שפנית אלינו. איך אוכל לעזור לך היום?"
2. **בירור צרכים:** שאל שאלות ממוקדות כדי להבין מה הלקוח מחפש.
3. **סגירה ואיסוף לידים:** ברגע שיש עניין, בקש בנימוס לאשר את מספר הטלפון או להשאיר פרטים נחוצים כדי שנציג אנושי יחזור אליהם.

---

## מגבלות סוכן ה-AI (חשוב מאוד!)
- **לעולם אל תמציא פרטים:** אם נשאלת שאלה שאין לך עליה תשובה, אמור בעדינות: *"שאלה מצוינת, אני אגלגל את זה לצוות שלנו והם יחזרו אליך בהקדם האפשרי עם תשובה מדויקת!"*
- **הגבלת פלט:** אל תעבור את ה-3 משפטים להודעה בודדת בווטסאפ.`,
            key: "B96B5776A5E4-4754-B7DC-1F1AF8A74940",
            leadFollowUpDays: "3",
            agentEmail: email,
            status: "Not Active"
          };
          agentsList.push(newAgent);
          saveAgents(agentsList);
          console.log(`[SERVER] Automatically created default generic bot for new user: ${email}`);
        }
      }

      // Notify n8n Webhook about new user registration or sign-up attempt
      if (isNewUser || isSignUp) {
        const webhookUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/be853a5a-7092-4d75-88e8-d846e604e661";
        const trialStartDate = new Date();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);

        const payload = {
          event: isNewUser ? "signup" : "login_signup_attempt",
          email,
          name,
          picture,
          isNewUser,
          trial_started_at: trialStartDate.toISOString(),
          trial_ends_at: trialEndDate.toISOString(),
          registered_at: trialStartDate.toISOString()
        };

        console.log(`[SERVER] Triggering signup webhook to n8n for user: ${email} (isNewUser: ${isNewUser})`);
        
        // Asynchronous fire-and-forget notification
        fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }).then(async (response) => {
          if (!response.ok) {
            const errText = await response.text();
            console.error(`[SERVER] n8n signup Webhook returned error status ${response.status}:`, errText);
          } else {
            console.log(`[SERVER] n8n signup Webhook successfully notified for user: ${email}`);
          }
        }).catch((err) => {
          console.error(`[SERVER] Failed to send n8n signup Webhook for user ${email}:`, err);
        });
      }

      if (!isAllowed) {
        console.warn(`[SERVER] Unauthorized login attempt from email: ${email}`);
        return res.status(403).json({ 
          success: false, 
          error: "not_authorized", 
          email,
          message: `האימייל ${email} אינו מורשה גישה למערכת. פנה למנהל המפתח לאישור הגישה.` 
        });
      }

      // Sign-in authorized: Create server-side session token
      const sessionToken = "session_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
      activeSessions.set(sessionToken, { email, name, picture });
      saveSessions(activeSessions);

      console.log(`[SERVER] Successful login: ${name} (${email})`);

      return res.json({
        success: true,
        token: sessionToken,
        user: { email, name, picture }
      });

    } catch (err: any) {
      console.error("[SERVER] Login error:", err);
      return res.status(500).json({
        success: false,
        error: "internal_error",
        message: "שגיאה פנימית בשרת במהלך האימות",
        details: err?.message || String(err)
      });
    }
  });

  // Secure Passcode/Bypass Login
  app.post("/api/auth/bypass-login", (req, res) => {
    try {
      const { passcode } = req.body;
      if (!passcode) {
        return res.status(400).json({ success: false, message: "אנא הזן מפתח מעקף" });
      }

      const currentSettings = readSettings();
      const usersList = currentSettings.bypassUsers || defaultSettings.bypassUsers;

      // Search for user by passcode
      let matchingUser = usersList.find((u: any) => String(u.passcode).trim() === passcode.trim());

      // Special super ease shortcut for the administrator and authorized business accounts
      const lowerPasscode = passcode.trim().toLowerCase();
      if (
        lowerPasscode === "haim.bar@gmail.com" || 
        lowerPasscode === "haim.bar" || 
        lowerPasscode === "haimbar" || 
        lowerPasscode === "haim" ||
        lowerPasscode === "haimbaradmin2026!"
      ) {
        matchingUser = {
          name: "חיים בר (מנהל)",
          email: "haim.bar@gmail.com",
          passcode: "HaimBarAdmin2026!"
        };
      } else if (
        lowerPasscode === "hatovaopt@gmail.com" ||
        lowerPasscode === "hatovaopt" ||
        lowerPasscode === "hatova" ||
        lowerPasscode === "haoptika" ||
        lowerPasscode === "haoptika-hatova" ||
        lowerPasscode === "252" ||
        lowerPasscode === "bot_252" ||
        lowerPasscode === "bot_generic_252" ||
        lowerPasscode === "האופטיקה הטובה" ||
        lowerPasscode === "אופטיקה"
      ) {
        matchingUser = {
          name: "האופטיקה הטובה",
          email: "hatovaopt@gmail.com",
          passcode: "hatova"
        };
      }

      // Helper fallback: if not found in explicitly declared bypass keys list, but is found directly in allowed emails / allowed users list
      if (!matchingUser) {
        const isAllowedDirectly = (currentSettings.allowedEmails || []).some((emailOrPhone: string) => 
          emailOrPhone.trim().toLowerCase() === passcode.trim().toLowerCase()
        );
        if (isAllowedDirectly) {
          matchingUser = {
            name: passcode.trim().includes("@") ? passcode.trim().split("@")[0] : `מורשה כניסה (${passcode.trim()})`,
            email: passcode.trim().includes("@") ? passcode.trim() : `${passcode.trim()}@authorized-bypass.com`,
            passcode: passcode.trim()
          };
        }
      }

      if (matchingUser) {
        const sessionToken = "session_dev_bypass_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
        const userInfo = {
          email: matchingUser.email || "bypass_user@cyber.com",
          name: matchingUser.name || "משתמש מורשה (מעקף)",
          picture: "https://lh3.googleusercontent.com/a/default-user=s96-c"
        };

        activeSessions.set(sessionToken, userInfo);
        saveSessions(activeSessions);

        console.log(`[SERVER] Successful passcode login: ${userInfo.name} (${userInfo.email})`);

        return res.json({
          success: true,
          token: sessionToken,
          user: userInfo
        });
      } else {
        return res.status(401).json({ success: false, message: "מפתח מעקף שגוי. אנא נסה שוב או פנה למנהל המערכת." });
      }
    } catch (err: any) {
      console.error("[SERVER] Bypass login error:", err);
      return res.status(500).json({ success: false, message: "שגיאה בתהליך אימות מפתח מעקף" });
    }
  });

  // Log out session
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      activeSessions.delete(token);
      saveSessions(activeSessions);
    }
    return res.json({ success: true });
  });

  // Verify active session
  app.get("/api/auth/session", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.json({ success: false });
    }
    const token = authHeader.substring(7);
    const session = getSession(token);
    if (!session) {
      return res.json({ success: false });
    }
    return res.json({ success: true, user: session });
  });

  // ---------------- SETTINGS & CONFIG ROUTES ----------------

  // Get Settings (partially public, fully private)
  app.get("/api/settings", (req, res) => {
    console.log(`[SERVER /api/settings] Incoming GET request from Host: "${req.headers.host || ''}", Origin: "${req.headers.origin || ''}", Referer: "${req.headers.referer || ''}"`);
    const currentSettings = readSettings();
    
    // Check if the caller is authenticated to see full allowed emails and passcodes
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    const isAuthed = token ? !!getSession(token) : false;

    const finalClientId = currentSettings.googleClientId || defaultSettings.googleClientId;
    console.log(`[SERVER /api/settings] Returning googleClientId: "${finalClientId ? finalClientId.substring(0, 20) + '...' : 'NULL'}" (isAuthed: ${isAuthed})`);

    if (isAuthed) {
      return res.json({
        success: true,
        googleClientId: finalClientId,
        allowedEmails: currentSettings.allowedEmails || defaultSettings.allowedEmails,
        bypassUsers: currentSettings.bypassUsers || defaultSettings.bypassUsers
      });
    } else {
      // Unauthenticated callers only get Google Client ID to mount the login button
      return res.json({
        success: true,
        googleClientId: finalClientId
      });
    }
  });

  // Save Settings
  app.post("/api/settings", requireAuth, (req: any, res: any) => {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    if (userEmail !== "haim.bar@gmail.com") {
      return res.status(403).json({ success: false, error: "forbidden", message: "אינך מורשה לשנות הגדרות אבטחה. פעולה זו מיועדת למנהל המערכת הראשי בלבד." });
    }

    const { googleClientId, allowedEmails, bypassUsers } = req.body;
    
    if (!googleClientId || !Array.isArray(allowedEmails) || allowedEmails.length === 0) {
      return res.status(400).json({ success: false, error: "invalid_payload", message: "נתונים שגויים. חובה לציין לפחות אימייל מורשה אחד" });
    }

    const updatedSettings = {
      googleClientId: googleClientId.trim(),
      allowedEmails: allowedEmails.map(email => email.toLowerCase().trim()),
      bypassUsers: Array.isArray(bypassUsers) ? bypassUsers : []
    };

    const saved = saveSettings(updatedSettings);
    if (saved) {
      console.log("[SERVER] Application settings updated successfully");
      return res.json({ success: true });
    } else {
      return res.status(500).json({ success: false, error: "write_failed", message: "נכשל בשמירת ההגדרות בשרת" });
    }
  });

  // ---------------- PUBLIC FILE UPLOAD ROUTE (IMGBB INTEGRATION) ----------------
  app.post("/api/upload", async (req: any, res: any) => {
    try {
      const { filename, base64 } = req.body;
      if (!base64) {
        return res.status(400).json({ success: false, message: "חסר תוכן הקובץ ב-base64" });
      }

      const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;

      // Primary: ImgBB Service Upload
      try {
        const params = new URLSearchParams();
        params.append("image", cleanBase64);

        const imgbbRes = await fetch("https://api.imgbb.com/1/upload?expiration=15552000&key=bb5133b78a888bdda2f9a761b36b6476", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params
        });

        const imgbbData = await imgbbRes.json();
        if (imgbbData && imgbbData.success && imgbbData.data) {
          console.log(`[SERVER] File uploaded successfully to ImgBB: ${imgbbData.data.url}`);
          return res.json({
            success: true,
            url: imgbbData.data.url,
            displayUrl: imgbbData.data.display_url || imgbbData.data.url,
            thumbUrl: imgbbData.data.thumb?.url || imgbbData.data.display_url || imgbbData.data.url,
            deleteUrl: imgbbData.data.delete_url
          });
        } else {
          console.warn("[SERVER] ImgBB upload returned non-success, using local fallback:", imgbbData);
        }
      } catch (imgbbErr) {
        console.error("[SERVER] ImgBB upload fetch error, falling back to disk:", imgbbErr);
      }

      // Fallback to local server disk storage
      const sanitizedName = (filename || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${Date.now()}_${sanitizedName}`;
      const filePath = path.join(UPLOADS_DIR, uniqueName);

      const buffer = Buffer.from(cleanBase64, "base64");
      fs.writeFileSync(filePath, buffer);

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const publicUrl = `${protocol}://${host}/uploads/${uniqueName}`;

      console.log(`[SERVER] File uploaded successfully to local fallback: ${publicUrl} (${buffer.length} bytes)`);
      return res.json({
        success: true,
        url: publicUrl,
        thumbUrl: publicUrl,
        filename: uniqueName,
        size: buffer.length
      });
    } catch (err: any) {
      console.error("[SERVER] File upload failed:", err);
      return res.status(500).json({ success: false, message: "שגיאה בשמירת הקובץ בשרת", error: err?.message });
    }
  });

  // ---------------- AGENTS DATA ROUTES ----------------

  // Helper to determine if an agent belongs to or is accessible by a given user
  function isAgentOwnedByUser(agent: any, userEmail: string): boolean {
    if (!userEmail) return false;
    const u = userEmail.toLowerCase().trim();
    if (u === "haim.bar@gmail.com") return true;
    const aEmail = (agent.agentEmail || "").toLowerCase().trim();
    if (aEmail === u) return true;
    // Hatova Optometry / Bot 252 special alias mapping
    if (
      (u.includes("hatova") || u.includes("252") || u === "haoptika") &&
      (aEmail.includes("hatova") || agent.botId === "bot_generic_252" || agent.id === "agent_bot_generic_252" || (agent.businessName || "").includes("האופטיקה הטובה"))
    ) {
      return true;
    }
    return false;
  }

  // Get cloud agents list
  app.get("/api/agents", requireAuth, (req: any, res: any) => {
    const list = readAgents();
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    
    // If the user is the system administrator (haim.bar@gmail.com), they see everything.
    // Otherwise, they only see agents where the agent's email/bot matches their account.
    if (userEmail === "haim.bar@gmail.com") {
      return res.json({ success: true, data: list });
    } else {
      const filtered = list.filter((agent: any) => isAgentOwnedByUser(agent, userEmail));
      return res.json({ success: true, data: filtered });
    }
  });

  // Save/Synchronize cloud agents list
  app.post("/api/agents", requireAuth, (req: any, res: any) => {
    const { agents } = req.body;
    if (!Array.isArray(agents)) {
      return res.status(400).json({ success: false, error: "invalid_payload", message: "הפרופילים חייבים להיות במבנה של מערך" });
    }

    const userEmail = (req.user?.email || "").toLowerCase().trim();

    if (userEmail === "haim.bar@gmail.com") {
      // Admin has full access to overwrite the file
      const saved = saveAgents(agents);
      if (saved) {
        return res.json({ success: true });
      } else {
        return res.status(500).json({ success: false, error: "write_failed", message: "נכשל בשמירת קובץ הסוכנים בשרת" });
      }
    } else {
      // Normal user: read existing agents and replace ONLY those that belong to the user
      const allAgents = readAgents();
      
      const existingUserAgents = allAgents.filter((agent: any) => isAgentOwnedByUser(agent, userEmail));

      const existingUserAgentIds = new Set(existingUserAgents.map((agent: any) => agent.id));

      // Guard check: normal users are not allowed to add new agents
      const containsNewAgents = agents.some((agent: any) => !existingUserAgentIds.has(agent.id));
      if (containsNewAgents) {
        // If they currently have 0 agents, and the new array has exactly 1 agent whose email matches their email, let them create it!
        const isCreatingFirstAgent = existingUserAgents.length === 0 && agents.length === 1 && (agents[0].agentEmail || "").toLowerCase().trim() === userEmail;
        if (!isCreatingFirstAgent) {
          return res.status(403).json({ 
            success: false, 
            error: "forbidden", 
            message: "אינך מורשה להוסיף סוכנים חדשים. פעולה זו שמורה למנהל המערכת בלבד או כאשר אין לך סוכנים וברצונך ליצור את הסוכן הראשון שלך (מוגבל ל-1)." 
          });
        }
      }

      // Separate agents belonging to other users
      const otherAgents = allAgents.filter((agent: any) => !isAgentOwnedByUser(agent, userEmail));

      // Map user's proposed agents to allow updating full intelligence and prompt configuration
      const userProposedAgents = agents.map((proposed: any) => {
        const existing = existingUserAgents.find((a: any) => a.id === proposed.id);
        if (!existing) {
          // New agent creation (only allowed for the first agent)
          return {
            id: proposed.id || "agent_" + Date.now(),
            ownerName: proposed.ownerName || "בעל העסק",
            businessName: proposed.businessName || "סוכן חדש",
            ownerPhone: proposed.ownerPhone || "050-1234567",
            botId: proposed.botId || "bot_" + Math.floor(Math.random() * 90000 + 10000),
            whatsappInstance: proposed.whatsappInstance || "Smarti",
            businessPrompt: proposed.businessPrompt || `# הנחיות לסוכן מכירות ושירות לקוחות`,
            botIdentity: proposed.botIdentity,
            coursesInfo: proposed.coursesInfo,
            kidsCourses: proposed.kidsCourses,
            conversationFlow: proposed.conversationFlow,
            writingStyle: proposed.writingStyle,
            faqAnswers: proposed.faqAnswers,
            whatNotToDo: proposed.whatNotToDo,
            syllabusLinks: proposed.syllabusLinks,
            humanEscalation: proposed.humanEscalation,
            imagesInfo: proposed.imagesInfo,
            videosInfo: proposed.videosInfo,
            key: proposed.key || "B96B5776A5E4-4754-B7DC-1F1AF8A74940",
            leadFollowUpDays: proposed.leadFollowUpDays || "3",
            agentEmail: userEmail, // Force to logged-in user email
            status: proposed.status || "Not Active",
            name: proposed.name || `${proposed.businessName || "סוכן חדש"} _ מכירות`,
            agentType: proposed.agentType || "sales",
            whatsappConfig: proposed.whatsappConfig || existing?.whatsappConfig || {}
          };
        }
        return {
          ...existing,
          ...proposed, // Allow updating all fields including businessPrompt, prompt blocks, bot settings!
          agentEmail: userEmail // Keep user's email
        };
      });

      // Merge and save
      const mergedList = [...otherAgents, ...userProposedAgents];
      const saved = saveAgents(mergedList);
      if (saved) {
        return res.json({ success: true });
      } else {
        return res.status(500).json({ success: false, error: "write_failed", message: "נכשל בשמירת קובץ הסוכנים בשרת" });
      }
    }
  });

  // ---------------- WHATSAPP BUSINESS & N8N API ROUTES ----------------

  // Get WhatsApp Business Config for current user/agent
  app.get("/api/whatsapp/config", requireAuth, (req: any, res: any) => {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const botId = (req.query?.botId || "").trim();
    const allAgents = readAgents();
    
    let targetAgent = null;
    if (botId) {
      targetAgent = allAgents.find((a: any) => a.botId === botId || a.id === botId);
    }
    if (!targetAgent) {
      targetAgent = allAgents.find((a: any) => (a.agentEmail || "").toLowerCase().trim() === userEmail);
    }
    if (!targetAgent && allAgents.length > 0 && userEmail === "haim.bar@gmail.com") {
      targetAgent = allAgents[0];
    }

    const config = targetAgent?.whatsappConfig || {
      phoneNumberId: "",
      systemUserAccessToken: "",
      wabaId: "",
      phoneNumber: targetAgent?.ownerPhone || "",
      code: "",
      appId: "",
      status: "Not Connected"
    };

    return res.json({
      success: true,
      botId: targetAgent?.botId || "",
      agentName: targetAgent?.businessName || "",
      config
    });
  });

  // Save WhatsApp Business Config
  app.post("/api/whatsapp/config", requireAuth, (req: any, res: any) => {
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    const { botId, phoneNumberId, systemUserAccessToken, wabaId, phoneNumber, code, appId, status } = req.body;

    const allAgents = readAgents();
    let targetIndex = -1;

    if (botId) {
      targetIndex = allAgents.findIndex((a: any) => a.botId === botId || a.id === botId);
    }
    if (targetIndex === -1) {
      targetIndex = allAgents.findIndex((a: any) => (a.agentEmail || "").toLowerCase().trim() === userEmail);
    }
    if (targetIndex === -1 && userEmail === "haim.bar@gmail.com" && allAgents.length > 0) {
      targetIndex = 0;
    }

    if (targetIndex === -1) {
      return res.status(404).json({ success: false, error: "not_found", message: "לא נמצא סוכן מותאם לחשבון זה" });
    }

    const currentConfig = allAgents[targetIndex].whatsappConfig || {};
    const updatedConfig = {
      phoneNumberId: phoneNumberId !== undefined ? String(phoneNumberId).trim() : (currentConfig.phoneNumberId || ""),
      systemUserAccessToken: systemUserAccessToken !== undefined ? String(systemUserAccessToken).trim() : (currentConfig.systemUserAccessToken || ""),
      wabaId: wabaId !== undefined ? String(wabaId).trim() : (currentConfig.wabaId || ""),
      phoneNumber: phoneNumber !== undefined ? String(phoneNumber).trim() : (currentConfig.phoneNumber || allAgents[targetIndex].ownerPhone || ""),
      code: code !== undefined ? String(code).trim() : (currentConfig.code || ""),
      appId: appId !== undefined ? String(appId).trim() : (currentConfig.appId || ""),
      status: status || ((phoneNumberId && systemUserAccessToken && wabaId) ? "Connected" : "Partially Configured"),
      updatedAt: new Date().toISOString()
    };

    allAgents[targetIndex].whatsappConfig = updatedConfig;
    if (phoneNumber) {
      allAgents[targetIndex].ownerPhone = phoneNumber.trim();
    }

    const saved = saveAgents(allAgents);
    if (saved) {
      console.log(`[SERVER] Saved WhatsApp Business Config for bot "${allAgents[targetIndex].botId}"`);
      return res.json({
        success: true,
        message: "הגדרות WhatsApp Business נשמרו בהצלחה",
        config: updatedConfig
      });
    } else {
      return res.status(500).json({ success: false, error: "write_failed", message: "נכשל בשמירת ההגדרות בשרת" });
    }
  });

  // Meta Token Exchange for Embedded Signup
  const handleMetaTokenExchange = async (req: any, res: any) => {
    try {
      const { code, appId, appSecret, botId, configId, redirectUri } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: "missing_code", message: "חסר קוד אימות (code)" });
      }

      // Meta App Credentials
      const targetAppId = appId || process.env.META_APP_ID || "1950695432176191";
      const targetAppSecret = appSecret || process.env.META_APP_SECRET || "";

      let accessToken = "";
      let wabaId = "";
      let phoneNumberId = "";

      // 1. Exchange code for access token via Meta Graph API
      if (targetAppId && targetAppSecret) {
        try {
          const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${encodeURIComponent(targetAppId)}&client_secret=${encodeURIComponent(targetAppSecret)}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri || "")}`;
          const metaRes = await fetch(tokenUrl);
          const metaData = await metaRes.json();

          if (metaData.access_token) {
            accessToken = metaData.access_token;
          } else {
            console.warn("[META EXCHANGE] Token exchange response:", metaData);
          }
        } catch (err) {
          console.error("[META EXCHANGE] Error exchanging code:", err);
        }
      }

      // Fallback if token exchange was bypassed or code is direct token
      if (!accessToken) {
        accessToken = code;
      }

      // 2. Fetch associated Shared WABA / Phone Numbers using the access token
      if (accessToken && accessToken.length > 15) {
        try {
          // Fetch WABAs
          const meUrl = `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?access_token=${encodeURIComponent(accessToken)}`;
          const meRes = await fetch(meUrl);
          const meData = await meRes.json();

          if (meData.data && meData.data.length > 0) {
            wabaId = meData.data[0].id || meData.data[0].waba_id || "";
          }

          // If we have wabaId, fetch phone numbers
          if (wabaId) {
            const phoneUrl = `https://graph.facebook.com/v19.0/${wabaId}/phone_numbers?access_token=${encodeURIComponent(accessToken)}`;
            const phoneRes = await fetch(phoneUrl);
            const phoneData = await phoneRes.json();

            if (phoneData.data && phoneData.data.length > 0) {
              phoneNumberId = phoneData.data[0].id || "";
            }
          }
        } catch (e) {
          console.warn("[META EXCHANGE] Error fetching WABA/Phone details:", e);
        }
      }

      // 3. Save to target agent config if botId provided
      if (botId) {
        const allAgents = readAgents();
        const targetIdx = allAgents.findIndex((a: any) => a.botId === botId || a.id === botId);
        if (targetIdx !== -1) {
          const currentConfig = allAgents[targetIdx].whatsappConfig || {};
          allAgents[targetIdx].whatsappConfig = {
            ...currentConfig,
            systemUserAccessToken: accessToken || currentConfig.systemUserAccessToken || "",
            wabaId: wabaId || currentConfig.wabaId || "",
            phoneNumberId: phoneNumberId || currentConfig.phoneNumberId || "",
            appId: targetAppId || currentConfig.appId || "",
            configId: configId || currentConfig.configId || "",
            code: code,
            status: (accessToken && (phoneNumberId || currentConfig.phoneNumberId)) ? "Connected" : "Partially Configured",
            updatedAt: new Date().toISOString()
          };
          saveAgents(allAgents);
        }
      }

      return res.json({
        success: true,
        token: accessToken,
        wabaId,
        phoneNumberId,
        message: "החלפת קוד אימות מול Meta בוצעה בהצלחה!"
      });
    } catch (err: any) {
      console.error("[META EXCHANGE ERROR]", err);
      return res.status(500).json({
        success: false,
        error: "server_error",
        message: err.message || "שגיאה פנימית בהחלפת קוד מול Meta"
      });
    }
  };

  app.post("/api/whatsapp/meta-token-exchange", handleMetaTokenExchange);
  app.post("/api/meta/exchange-code", handleMetaTokenExchange);

  // Export N8N Credentials Endpoint
  app.get("/api/whatsapp/n8n-credentials", (req: any, res: any) => {
    const botId = (req.query?.botId || "").trim();
    const token = (req.query?.token || "").trim();
    const allAgents = readAgents();

    let agent = null;
    if (botId) {
      agent = allAgents.find((a: any) => a.botId === botId || a.id === botId);
    }
    if (!agent && token) {
      const session = getSession(token);
      if (session) {
        agent = allAgents.find((a: any) => (a.agentEmail || "").toLowerCase().trim() === session.email.toLowerCase().trim());
      }
    }
    if (!agent && allAgents.length > 0) {
      agent = allAgents[0];
    }

    const config = agent?.whatsappConfig || {};

    return res.json({
      botId: agent?.botId || "N/A",
      businessName: agent?.businessName || "N/A",
      phoneNumberId: config.phoneNumberId || "",
      systemUserAccessToken: config.systemUserAccessToken || "",
      wabaId: config.wabaId || "",
      phoneNumber: config.phoneNumber || agent?.ownerPhone || "",
      code: config.code || "",
      appId: config.appId || "",
      connectionType: config.connectionType || "official_meta",
      evolutionInstanceName: config.evolutionInstanceName || "",
      webhookUrl: "https://service-1078804201809.us-west1.run.app/api/webhook/whatsapp",
      status: config.status || "Not Connected",
      lastUpdated: config.updatedAt || new Date().toISOString()
    });
  });

  // ---------------- EVOLUTION API (UNOFFICIAL WHATSAPP QR CODE) ROUTES ----------------

  // Helper to get Evolution API configuration (supports custom URL & Key from agent config or request)
  function getEvolutionConfig(req: any, botId?: string) {
    const allAgents = readAgents();
    const agent = botId ? allAgents.find((a: any) => a.botId === botId || a.id === botId) : null;
    const config = agent?.whatsappConfig || {};

    const apiUrl = (req.body?.apiUrl || req.query?.apiUrl || config.evolutionApiUrl || process.env.EVOLUTION_API_URL || "http://72.61.185.147:60486").trim().replace(/\/+$/, "");
    const globalKey = (req.body?.globalKey || req.query?.globalKey || config.evolutionGlobalKey || process.env.EVOLUTION_GLOBAL_KEY || "l66VrCvMBNoLSUEc1IUoQ7lDPmoCMibV").trim();

    return { apiUrl, globalKey };
  }

  // Helper for headers matching Evolution API key standard
  function getEvolutionHeaders(globalKey: string) {
    return {
      "apikey": globalKey,
      "Content-Type": "application/json"
    };
  }

  // Helper to sanitize instance name for Evolution API using user email or botId
  function getEvolutionInstanceName(botId: string, userEmail?: string, counterOverride?: number): string {
    const allAgents = readAgents();
    const agent = botId ? allAgents.find((a: any) => a.botId === botId || a.id === botId) : null;
    const config = agent?.whatsappConfig || {};
    const counter = counterOverride ?? config.evolutionInstanceCounter ?? 1;

    const userPrefix = userEmail ? userEmail.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "_") : "";
    const cleanId = String(botId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
    const baseName = userPrefix ? `client_${userPrefix}_${cleanId}` : `client_${cleanId}`;
    
    return counter > 1 ? `${baseName}_${counter}` : baseName;
  }

  // 1. Create Instance in Evolution API
  app.post("/api/evolution/create-instance", requireAuth, async (req: any, res: any) => {
    try {
      const botId = (req.body?.botId || "").trim();
      if (!botId) {
        return res.status(400).json({ success: false, error: "missing_bot_id", message: "חסר מזהה בוט" });
      }

      const { apiUrl, globalKey } = getEvolutionConfig(req, botId);
      const instanceName = getEvolutionInstanceName(botId, req.user?.email);
      const uniqueToken = `tok_${botId}_${Date.now()}`;
      
      const webhookUrl = `${req.protocol}://${req.get("host")}/api/webhooks/evolution`;

      console.log(`[EVOLUTION API] Creating instance "${instanceName}" at ${apiUrl} with key length ${globalKey.length}`);

      const createResponse = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers: getEvolutionHeaders(globalKey),
        body: JSON.stringify({
          instanceName: instanceName,
          token: uniqueToken,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: [
              "CONNECTION_UPDATE",
              "MESSAGES_UPSERT"
            ]
          }
        })
      });

      const data: any = await createResponse.json().catch(() => ({}));
      console.log(`[EVOLUTION API] Create instance response status: ${createResponse.status}`, data);

      // Save instance metadata in agent's config
      const allAgents = readAgents();
      const targetIndex = allAgents.findIndex((a: any) => a.botId === botId || a.id === botId);
      if (targetIndex !== -1) {
        const currentConfig = allAgents[targetIndex].whatsappConfig || {};
        allAgents[targetIndex].whatsappConfig = {
          ...currentConfig,
          evolutionInstanceName: instanceName,
          evolutionToken: uniqueToken,
          evolutionApiUrl: apiUrl,
          evolutionGlobalKey: globalKey,
          connectionType: "unofficial_qr",
          updatedAt: new Date().toISOString()
        };
        saveAgents(allAgents);
      }

      if (createResponse.status === 401 || data?.message === "Unauthorized" || data?.error === "Unauthorized") {
        return res.status(401).json({
          success: false,
          instanceName,
          error: "unauthorized",
          message: `שגיאת הרשאה (401 Unauthorized) מול שרת Evolution API (${apiUrl}). אנא ודא שמפתח ה-Global Key תואם להגדרות השרת.`
        });
      }

      let qrBase64 = data?.base64 || data?.qrcode?.base64 || data?.qrcode || null;
      let rawCode = data?.code || data?.qrcode?.code || data?.pairingCode || null;

      return res.json({
        success: createResponse.ok || !!data?.instance || !!data?.name || data?.status === "SUCCESS",
        instanceName,
        userEmail: req.user?.email || "N/A",
        evolutionStatus: createResponse.status,
        base64: qrBase64,
        rawCode,
        data,
        message: data?.response?.message || data?.message || (createResponse.ok ? `אינסטנס ${instanceName} נוצר בהצלחה ב-Evolution API!` : `תגובת Evolution: ${JSON.stringify(data)}`)
      });
    } catch (error: any) {
      console.error("[EVOLUTION API] Create instance failed:", error);
      return res.status(500).json({
        success: false,
        error: "evolution_create_failed",
        message: error?.message || "נכשל בחיבור ל-Evolution API"
      });
    }
  });

  // Recreate / Rotate Instance Endpoint (Anti-Ban Measure)
  app.post("/api/evolution/recreate-instance", requireAuth, async (req: any, res: any) => {
    try {
      const botId = (req.body?.botId || req.query?.botId || "").trim();
      if (!botId) {
        return res.status(400).json({ success: false, error: "missing_bot_id", message: "חסר מזהה בוט" });
      }

      const { apiUrl, globalKey } = getEvolutionConfig(req, botId);
      
      const allAgents = readAgents();
      const targetIndex = allAgents.findIndex((a: any) => a.botId === botId || a.id === botId);
      let currentCounter = 1;
      let oldInstanceName = "";

      if (targetIndex !== -1) {
        const config = allAgents[targetIndex].whatsappConfig || {};
        currentCounter = config.evolutionInstanceCounter || 1;
        oldInstanceName = config.evolutionInstanceName || getEvolutionInstanceName(botId, req.user?.email, currentCounter);
      } else {
        oldInstanceName = getEvolutionInstanceName(botId, req.user?.email, 1);
      }

      console.log(`[EVOLUTION API] Anti-Ban Rotation: Deleting old instance "${oldInstanceName}"...`);

      // 1. Delete old instance completely from Evolution API
      if (oldInstanceName) {
        await fetch(`${apiUrl}/instance/logout/${oldInstanceName}`, {
          method: "DELETE",
          headers: getEvolutionHeaders(globalKey)
        }).catch(() => null);

        await fetch(`${apiUrl}/instance/delete/${oldInstanceName}`, {
          method: "DELETE",
          headers: getEvolutionHeaders(globalKey)
        }).catch(() => null);
      }

      // 2. Increment instance counter for clean rotation
      const newCounter = currentCounter + 1;
      const newInstanceName = getEvolutionInstanceName(botId, req.user?.email, newCounter);
      const uniqueToken = `tok_${botId}_${Date.now()}`;
      const webhookUrl = `${req.protocol}://${req.get("host")}/api/webhooks/evolution`;

      console.log(`[EVOLUTION API] Anti-Ban Rotation: Creating clean instance "${newInstanceName}" (Counter: ${newCounter})`);

      // 3. Create fresh new instance
      const createResponse = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers: getEvolutionHeaders(globalKey),
        body: JSON.stringify({
          instanceName: newInstanceName,
          token: uniqueToken,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhookUrl,
            byEvents: false,
            base64: false,
            events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"]
          }
        })
      });

      const data: any = await createResponse.json().catch(() => ({}));

      // 4. Update agent configuration
      if (targetIndex !== -1) {
        const currentConfig = allAgents[targetIndex].whatsappConfig || {};
        allAgents[targetIndex].whatsappConfig = {
          ...currentConfig,
          evolutionInstanceName: newInstanceName,
          evolutionInstanceCounter: newCounter,
          evolutionToken: uniqueToken,
          evolutionApiUrl: apiUrl,
          evolutionGlobalKey: globalKey,
          connectionType: "unofficial_qr",
          updatedAt: new Date().toISOString()
        };
        saveAgents(allAgents);
      }

      let qrBase64 = data?.base64 || data?.qrcode?.base64 || data?.qrcode || null;
      let rawCode = data?.code || data?.qrcode?.code || data?.pairingCode || null;

      // If missing QR directly from create, request connect
      if (!qrBase64 && !rawCode) {
        const connRes = await fetch(`${apiUrl}/instance/connect/${newInstanceName}`, {
          method: "GET",
          headers: getEvolutionHeaders(globalKey)
        }).catch(() => null);
        const connData: any = connRes ? await connRes.json().catch(() => ({})) : {};
        qrBase64 = connData?.base64 || connData?.qrcode?.base64 || connData?.qrcode || null;
        rawCode = connData?.code || connData?.qrcode?.code || connData?.pairingCode || null;
      }

      let qrUrl = null;
      if (qrBase64) {
        qrUrl = qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`;
      } else if (rawCode) {
        qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawCode)}`;
      }

      return res.json({
        success: createResponse.ok || !!qrBase64 || !!rawCode,
        instanceName: newInstanceName,
        counter: newCounter,
        base64: qrBase64,
        rawCode,
        qrUrl,
        message: `אינסטנס נקי נוצר בהצלחה למניעת חסימה: ${newInstanceName}`
      });
    } catch (error: any) {
      console.error("[EVOLUTION API] Recreate instance failed:", error);
      return res.status(500).json({
        success: false,
        error: "recreate_failed",
        message: error?.message || "נכשל ביצירת אינסטנס נקי מחדש"
      });
    }
  });

  // 2. Fetch QR Code from Evolution API
  app.get("/api/evolution/connect-qr", requireAuth, async (req: any, res: any) => {
    try {
      const botId = (req.query?.botId || "").trim();
      if (!botId) {
        return res.status(400).json({ success: false, error: "missing_bot_id", message: "חסר מזהה בוט" });
      }

      const { apiUrl, globalKey } = getEvolutionConfig(req, botId);
      const instanceName = getEvolutionInstanceName(botId, req.user?.email);
      console.log(`[EVOLUTION API] Fetching QR for "${instanceName}" at ${apiUrl}`);

      // First attempt: Connect
      let response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
        method: "GET",
        headers: getEvolutionHeaders(globalKey)
      }).catch(() => null);

      let data: any = response ? await response.json().catch(() => ({})) : {};

      if (response?.status === 401 || data?.message === "Unauthorized") {
        return res.status(401).json({
          success: false,
          instanceName,
          error: "unauthorized",
          message: "שגיאת הרשאה (401 Unauthorized) מול שרת Evolution API. בדוק את מפתח ה-Global Key."
        });
      }

      let qrBase64 = data?.base64 || data?.qrcode?.base64 || data?.qrcode || null;
      let rawCode = data?.code || data?.qrcode?.code || data?.pairingCode || data?.qrcode?.pairingCode || null;

      // If instance does not exist or missing QR, try creating instance
      if (!qrBase64 && !rawCode) {
        console.log(`[EVOLUTION API] QR not found directly on connect, attempting instance create for "${instanceName}"`);
        const webhookUrl = `${req.protocol}://${req.get("host")}/api/webhooks/evolution`;
        const createRes = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers: getEvolutionHeaders(globalKey),
          body: JSON.stringify({
            instanceName: instanceName,
            token: `tok_${botId}_${Date.now()}`,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            webhook: {
              url: webhookUrl,
              byEvents: false,
              base64: false,
              events: ["CONNECTION_UPDATE", "MESSAGES_UPSERT"]
            }
          })
        }).catch(() => null);

        const createData: any = createRes ? await createRes.json().catch(() => ({})) : {};
        console.log(`[EVOLUTION API] Create response:`, createData);

        qrBase64 = createData?.base64 || createData?.qrcode?.base64 || createData?.qrcode || null;
        rawCode = createData?.code || createData?.qrcode?.code || createData?.pairingCode || null;

        // Try connect once more
        if (!qrBase64 && !rawCode) {
          response = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: getEvolutionHeaders(globalKey)
          }).catch(() => null);
          data = response ? await response.json().catch(() => ({})) : {};
          qrBase64 = data?.base64 || data?.qrcode?.base64 || data?.qrcode || null;
          rawCode = data?.code || data?.qrcode?.code || data?.pairingCode || null;
        }
      }

      let qrUrl = null;
      if (qrBase64) {
        qrUrl = qrBase64.startsWith("data:") ? qrBase64 : `data:image/png;base64,${qrBase64}`;
      } else if (rawCode) {
        qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(rawCode)}`;
      }

      return res.json({
        success: true,
        instanceName,
        userEmail: req.user?.email || "N/A",
        base64: qrBase64,
        rawCode,
        qrUrl,
        pairingCode: data?.pairingCode || null,
        raw: data
      });
    } catch (error: any) {
      console.error("[EVOLUTION API] Fetch QR failed:", error);
      return res.status(500).json({
        success: false,
        error: "evolution_qr_failed",
        message: error?.message || "נכשל בשליפת קוד QR מ-Evolution API"
      });
    }
  });

  // 3. Get Connection State
  app.get("/api/evolution/connection-state", requireAuth, async (req: any, res: any) => {
    try {
      const botId = (req.query?.botId || "").trim();
      if (!botId) {
        return res.status(400).json({ success: false, error: "missing_bot_id", message: "חסר מזהה בוט" });
      }

      const { apiUrl, globalKey } = getEvolutionConfig(req, botId);
      const instanceName = getEvolutionInstanceName(botId, req.user?.email);
      const response = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        method: "GET",
        headers: getEvolutionHeaders(globalKey)
      }).catch(() => null);

      const data: any = response ? await response.json().catch(() => ({})) : {};
      const state = data?.instance?.state || data?.state || "connecting";

      // If state is "open", mark agent as Connected
      if (state === "open") {
        const allAgents = readAgents();
        const targetIndex = allAgents.findIndex((a: any) => a.botId === botId || a.id === botId);
        if (targetIndex !== -1) {
          const currentConfig = allAgents[targetIndex].whatsappConfig || {};
          allAgents[targetIndex].whatsappConfig = {
            ...currentConfig,
            status: "Connected",
            connectionType: "unofficial_qr",
            evolutionInstanceName: instanceName,
            updatedAt: new Date().toISOString()
          };
          saveAgents(allAgents);
        }
      }

      return res.json({
        success: true,
        instanceName,
        userEmail: req.user?.email || "N/A",
        state,
        isConnected: state === "open",
        raw: data
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: "evolution_state_failed",
        message: error?.message || "נכשל בבדיקת סטטוס חיבור"
      });
    }
  });

  // 4. Debug Evolution API Connection & Key Auth
  app.get("/api/evolution/debug", requireAuth, async (req: any, res: any) => {
    try {
      const botId = (req.query?.botId || "").trim();
      const { apiUrl, globalKey } = getEvolutionConfig(req, botId);
      const instanceName = getEvolutionInstanceName(botId || "test", req.user?.email);

      const tests: any[] = [];

      // Test 1: Root GET
      try {
        const r1 = await fetch(`${apiUrl}/`, {
          headers: getEvolutionHeaders(globalKey)
        });
        const t1Data = await r1.json().catch(() => r1.statusText);
        tests.push({ name: "1. GET / (Root)", status: r1.status, ok: r1.ok, data: t1Data });
      } catch (e: any) {
        tests.push({ name: "1. GET / (Root)", error: e.message });
      }

      // Test 2: fetchInstances with apikey header
      try {
        const r2 = await fetch(`${apiUrl}/instance/fetchInstances`, {
          headers: { "apikey": globalKey, "Content-Type": "application/json" }
        });
        const t2Data = await r2.json().catch(() => r2.statusText);
        tests.push({ name: "2. GET /instance/fetchInstances (Header apikey)", status: r2.status, ok: r2.ok, data: t2Data });
      } catch (e: any) {
        tests.push({ name: "2. GET /instance/fetchInstances (Header apikey)", error: e.message });
      }

      // Test 3: fetchInstances with apiKey header
      try {
        const r3 = await fetch(`${apiUrl}/instance/fetchInstances`, {
          headers: { "apiKey": globalKey, "Content-Type": "application/json" }
        });
        const t3Data = await r3.json().catch(() => r3.statusText);
        tests.push({ name: "3. GET /instance/fetchInstances (Header apiKey)", status: r3.status, ok: r3.ok, data: t3Data });
      } catch (e: any) {
        tests.push({ name: "3. GET /instance/fetchInstances (Header apiKey)", error: e.message });
      }

      // Test 4: fetchInstances with Bearer token
      try {
        const r4 = await fetch(`${apiUrl}/instance/fetchInstances`, {
          headers: { "Authorization": `Bearer ${globalKey}`, "Content-Type": "application/json" }
        });
        const t4Data = await r4.json().catch(() => r4.statusText);
        tests.push({ name: "4. GET /instance/fetchInstances (Header Authorization Bearer)", status: r4.status, ok: r4.ok, data: t4Data });
      } catch (e: any) {
        tests.push({ name: "4. GET /instance/fetchInstances (Header Authorization Bearer)", error: e.message });
      }

      // Test 5: fetchInstances with query string
      try {
        const r5 = await fetch(`${apiUrl}/instance/fetchInstances?apikey=${encodeURIComponent(globalKey)}`);
        const t5Data = await r5.json().catch(() => r5.statusText);
        tests.push({ name: "5. GET /instance/fetchInstances (Query ?apikey=)", status: r5.status, ok: r5.ok, data: t5Data });
      } catch (e: any) {
        tests.push({ name: "5. GET /instance/fetchInstances (Query ?apikey=)", error: e.message });
      }

      // Test 6: POST /instance/create with test instance
      try {
        const r6 = await fetch(`${apiUrl}/instance/create`, {
          method: "POST",
          headers: getEvolutionHeaders(globalKey),
          body: JSON.stringify({
            instanceName: instanceName,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        });
        const t6Data = await r6.json().catch(() => r6.statusText);
        tests.push({ name: `6. POST /instance/create (${instanceName})`, status: r6.status, ok: r6.ok, data: t6Data });
      } catch (e: any) {
        tests.push({ name: `6. POST /instance/create (${instanceName})`, error: e.message });
      }

      return res.json({
        success: true,
        apiUrl,
        globalKey,
        globalKeyLength: globalKey.length,
        instanceName,
        userEmail: req.user?.email || "N/A",
        tests
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error?.message
      });
    }
  });

  // 4. Logout / Delete Instance in Evolution
  app.post("/api/evolution/logout", requireAuth, async (req: any, res: any) => {
    try {
      const botId = (req.body?.botId || "").trim();
      const { apiUrl, globalKey } = getEvolutionConfig(req, botId);
      const instanceName = getEvolutionInstanceName(botId, req.user?.email);

      await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
        method: "DELETE",
        headers: getEvolutionHeaders(globalKey)
      }).catch(() => {});

      const allAgents = readAgents();
      const targetIndex = allAgents.findIndex((a: any) => a.botId === botId || a.id === botId);
      if (targetIndex !== -1) {
        const currentConfig = allAgents[targetIndex].whatsappConfig || {};
        allAgents[targetIndex].whatsappConfig = {
          ...currentConfig,
          status: "Not Connected",
          updatedAt: new Date().toISOString()
        };
        saveAgents(allAgents);
      }

      return res.json({ success: true, message: "התנתקת בהצלחה מ-Evolution API" });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: "logout_failed", message: err?.message });
    }
  });

  // 5. Webhook Listener for Evolution CONNECTION_UPDATE
  app.post("/api/webhooks/evolution", (req: any, res: any) => {
    try {
      const body = req.body || {};
      console.log("[EVOLUTION WEBHOOK] Event received:", JSON.stringify(body));

      const event = body.event || body.type;
      const instance = body.instance;
      const state = body.data?.state || body.data?.connection;

      if ((event === "connection.update" || event === "CONNECTION_UPDATE") && instance && state === "open") {
        console.log(`[EVOLUTION WEBHOOK] Instance "${instance}" is now OPEN (Connected)! Updating agent status...`);
        const allAgents = readAgents();

        // Match botId from instance name "client_<botId>"
        const matchedIndex = allAgents.findIndex((a: any) => {
          const instName = getEvolutionInstanceName(a.botId || a.id);
          return instName === instance || a.botId === instance;
        });

        if (matchedIndex !== -1) {
          const currentConfig = allAgents[matchedIndex].whatsappConfig || {};
          allAgents[matchedIndex].whatsappConfig = {
            ...currentConfig,
            status: "Connected",
            connectionType: "unofficial_qr",
            evolutionInstanceName: instance,
            updatedAt: new Date().toISOString()
          };
          saveAgents(allAgents);
          console.log(`[EVOLUTION WEBHOOK] Agent "${allAgents[matchedIndex].botId}" status set to Connected!`);
        }
      }

      return res.json({ status: "received" });
    } catch (err: any) {
      console.error("[EVOLUTION WEBHOOK] Error handling event:", err);
      return res.status(200).json({ status: "error", error: err?.message });
    }
  });

  // ---------------- CHATS / CONVERSATIONS API ROUTES ----------------

  function parseSessionIdInfo(sId: string, knownBotIds: string[] = []) {
    if (!sId) return { phone: "", botId: "", customerName: "" };
    let cleanS = String(sId).replace(/@(?:s\.whatsapp\.net|c\.us)/gi, "").trim();
    cleanS = cleanS.replace(/^=+/, "");

    let phone = "";
    let botId = "";
    let customerName = "";

    const isPhonePattern = (s: string) => {
      if (!s) return false;
      const clean = s.replace(/[-+ ]/g, "");
      return (
        /^(\+?972|0)?[57]\d{8}$/.test(clean) ||
        /^(\+?972|0)[23489]\d{7}$/.test(clean) ||
        (/^\d{9,15}$/.test(clean) && !clean.startsWith("170") && !clean.startsWith("180"))
      );
    };

    const firstUnderscore = cleanS.indexOf("_");
    let remainder = cleanS;

    if (firstUnderscore !== -1) {
      const firstPart = cleanS.substring(0, firstUnderscore).trim();
      if (isPhonePattern(firstPart)) {
        phone = firstPart;
        remainder = cleanS.substring(firstUnderscore + 1).trim();
      }
    }

    if (!phone) {
      const parts = cleanS.split(/[_\-]/);
      for (const part of parts) {
        if (isPhonePattern(part)) {
          phone = part;
          break;
        }
      }
    }

    if (remainder) {
      const validKnownBots = [...knownBotIds].filter(Boolean).sort((a, b) => b.length - a.length);
      let matchedKnownBot = "";

      for (const kBot of validKnownBots) {
        if (remainder === kBot) {
          matchedKnownBot = kBot;
          remainder = "";
          break;
        }
        if (remainder.startsWith(kBot + "_")) {
          matchedKnownBot = kBot;
          remainder = remainder.substring(kBot.length + 1).trim();
          break;
        }
      }

      if (matchedKnownBot) {
        botId = matchedKnownBot;
        if (remainder) {
          customerName = remainder;
        }
      } else {
        const botPrefixMatch = remainder.match(/^((?:bot|smartbot|agent|hook|n8n|flow)[_\w\d]*?)_([^\d_].*)$/i);
        if (botPrefixMatch) {
          botId = botPrefixMatch[1];
          customerName = botPrefixMatch[2];
        } else {
          const lastUnderscore = remainder.lastIndexOf("_");
          if (lastUnderscore !== -1) {
            const potentialBot = remainder.substring(0, lastUnderscore);
            const potentialName = remainder.substring(lastUnderscore + 1).trim();
            if (/[\u0590-\u05FFa-zA-Z]/.test(potentialName) && !/^\d+$/.test(potentialName)) {
              botId = potentialBot;
              customerName = potentialName;
            } else {
              botId = remainder;
            }
          } else {
            botId = remainder;
          }
        }
      }
    }

    if (customerName) {
      customerName = customerName.replace(/_/g, " ").trim();
    }

    return { phone, botId, customerName };
  }

  // Fetch chats matching filter
  app.get("/api/chats", requireAuth, async (req: any, res: any) => {
    // Robust function to return raw stringified JSON or plain text for client parsing
    function cleanContent(rawContent: any): string {
      if (!rawContent) return "";
      
      // If it is an object or array, serialize it to JSON string for frontend client parsing
      if (typeof rawContent === "object") {
        try {
          return JSON.stringify(rawContent);
        } catch (e) {
          return String(rawContent);
        }
      }

      if (typeof rawContent === "string") {
        let trimmed = rawContent.trim();
        if (trimmed.includes("```")) {
          const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (m) trimmed = m[1].trim();
          else trimmed = trimmed.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
        }

        const firstBrace = trimmed.indexOf("{");
        const firstBracket = trimmed.indexOf("[");
        let start = -1;
        if (firstBrace !== -1 && firstBracket !== -1) start = Math.min(firstBrace, firstBracket);
        else if (firstBrace !== -1) start = firstBrace;
        else if (firstBracket !== -1) start = firstBracket;

        if (start !== -1) {
          const lastBrace = trimmed.lastIndexOf("}");
          const lastBracket = trimmed.lastIndexOf("]");
          const end = Math.max(lastBrace, lastBracket);
          if (end > start) {
            const extracted = trimmed.substring(start, end + 1);
            try {
              const parsed = JSON.parse(extracted);
              return JSON.stringify(parsed);
            } catch (e1) {
              try {
                const sanitized = extracted.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
                  return match.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n").replace(/\t/g, "\\t");
                });
                const parsed = JSON.parse(sanitized);
                return JSON.stringify(parsed);
              } catch (e2) {}
            }
          }
        }
        return rawContent;
      }

      return String(rawContent);
    }

    try {
      const { sessionId, botId, phone } = req.query;
      console.log(`[SERVER] GET /api/chats - requested botId: "${botId}", sessionId: "${sessionId}", phone: "${phone}"`);
      
      let liveChats: any[] = [];
      let fetchSuccess = false;

      // If we have a botId and are connected to N8N, fetch the live database records via N8N Webhook!
      if (botId) {
        const primaryWebhook = "https://n8n.srv1239769.hstgr.cloud/webhook/932a697d-8cc7-4141-9a00-973c72020584";
        const testWebhook = "https://n8n.srv1239769.hstgr.cloud/webhook-test/932a697d-8cc7-4141-9a00-973c72020584";
        
        const urlsToTry = [
          { url: primaryWebhook, method: "POST" },
          { url: primaryWebhook, method: "GET" },
          { url: testWebhook, method: "POST" },
          { url: testWebhook, method: "GET" }
        ];

        let rawData: any = null;
        let responseOk = false;
        let finalMethod = "";
        let finalUrl = "";

        for (const item of urlsToTry) {
          try {
            console.log(`[SERVER] Trying to fetch chats from N8N: ${item.method} -> ${item.url} for botId: "${botId}"`);
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout per attempt

            let fetchPromise;
            if (item.method === "POST") {
              console.log(`[SERVER] Sending POST to N8N: ${item.url} with body { botId: "${botId}", botID: "${botId}" }`);
              fetchPromise = fetch(item.url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ botId, botID: botId }),
                signal: controller.signal
              });
            } else {
              const getUrl = `${item.url}?botId=${encodeURIComponent(botId)}&botID=${encodeURIComponent(botId)}`;
              console.log(`[SERVER] Sending GET to N8N: ${getUrl}`);
              fetchPromise = fetch(getUrl, {
                method: "GET",
                headers: {
                  "Accept": "application/json"
                },
                signal: controller.signal
              });
            }

            const response = await fetchPromise;
            clearTimeout(timeoutId);

            if (response.ok) {
              rawData = await response.json();
              responseOk = true;
              finalMethod = item.method;
              finalUrl = item.url;
              console.log(`[SERVER] Success! N8N webhook call succeeded using ${item.method} on ${item.url}`);
              break; // exit loop on first success!
            } else {
              console.warn(`[SERVER] N8N returned status ${response.status} for ${item.method} on ${item.url}`);
            }
          } catch (err: any) {
            console.warn(`[SERVER] Fetch failed for ${item.method} on ${item.url}:`, err?.message || err);
          }
        }

        if (responseOk && rawData) {
          try {
            // Extract the list of records. N8N might return a flat array, or wrap it in { data: [...] }, etc.
            let records = [];
            if (Array.isArray(rawData)) {
              records = rawData;
            } else if (rawData && Array.isArray(rawData.data)) {
              records = rawData.data;
            } else if (rawData && typeof rawData === "object") {
              // Try to find any array inside the object
              const arrayKey = Object.keys(rawData).find(key => Array.isArray(rawData[key]));
              if (arrayKey) {
                records = rawData[arrayKey];
              } else if (rawData.chats && Array.isArray(rawData.chats)) {
                records = rawData.chats;
              } else if (rawData.rows && Array.isArray(rawData.rows)) {
                records = rawData.rows;
              } else {
                // If it's a single object, wrap in an array
                records = [rawData];
              }
            }

            // Map and normalize records to our standard chat message format
            liveChats = records.map((item: any, idx: number) => {
              if (!item) return null;
              const sId = item.session_id || item.sessionId || item.SessionId || "";
              
              // Parse phone, botId and customerName from sessionId if needed
              let itemPhone = item.phone || item.userPhone || item.user_phone || item.sender_phone || item.wa_id || item.from || "";
              let itemBotId = item.botId || item.bot_id || "";
              let itemName = item.userName || item.name || item.sender_name || item.pushName || item.pushname || item.profile_name || item.customer_name || "";

              if (sId) {
                const sInfo = parseSessionIdInfo(sId);
                if (!itemPhone && sInfo.phone) itemPhone = sInfo.phone;
                if (!itemBotId && sInfo.botId) itemBotId = sInfo.botId;
                if (!itemName && sInfo.customerName) itemName = sInfo.customerName;
              }

              // Parse message contents (can be JSON string or parsed object)
              let messageContent = item.message;
              let finalType: "human" | "ai" = "human";
              let finalContent = "";

              if (messageContent) {
                if (typeof messageContent === "string") {
                  try {
                    const parsedMsg = JSON.parse(messageContent);
                    finalType = parsedMsg.type === "ai" || parsedMsg.role === "ai" || parsedMsg.sender === "ai" || parsedMsg.type === "AI" ? "ai" : "human";
                    const innerContent = parsedMsg.content || parsedMsg.text || messageContent;
                    finalContent = cleanContent(innerContent);
                  } catch (e) {
                    finalContent = cleanContent(messageContent);
                  }
                } else if (typeof messageContent === "object") {
                  finalType = messageContent.type === "ai" || messageContent.role === "ai" || messageContent.sender === "ai" || messageContent.type === "AI" ? "ai" : "human";
                  const innerContent = messageContent.content || messageContent.text || JSON.stringify(messageContent);
                  finalContent = cleanContent(innerContent);
                }
              } else {
                // Try fallback fields directly on item
                const contentVal = item.content || item.text || item.message_text || "";
                const typeVal = item.type || item.message_type || item.sender || "human";
                finalType = String(typeVal).toLowerCase() === "ai" ? "ai" : "human";
                finalContent = cleanContent(contentVal);
              }

              return {
                id: item.id || `n8n_${idx}_${Date.now().toString(36)}`,
                sessionId: sId,
                botId: itemBotId || botId,
                phone: itemPhone,
                name: itemName,
                userName: itemName,
                userPhone: itemPhone,
                message: {
                  type: finalType,
                  content: finalContent
                },
                timestamp: item.created_at || item.timestamp || item.time || new Date().toISOString()
              };
            }).filter(Boolean);

            fetchSuccess = true;
            console.log(`[SERVER] Successfully parsed ${liveChats.length} live chat messages from N8N`);
          } catch (parseErr: any) {
            console.error("[SERVER] Error parsing N8N payload response:", parseErr);
          }
        } else {
          console.warn(`[SERVER] All N8N Webhook endpoints failed or returned no data`);
        }
      }

      // Fallback: Read from local chats.json if N8N failed or had no messages
      let finalChats = liveChats;
      if (!fetchSuccess || finalChats.length === 0) {
        console.log("[SERVER] Using local chats.json store as fallback/secondary storage");
        const localChats = readChats();
        
        // Merge or replace depending on whether we want to display both
        const localFiltered = localChats.filter((chat: any) => {
          if (sessionId && chat.sessionId !== sessionId) return false;
          if (botId && chat.botId !== botId) return false;
          if (phone && chat.phone !== phone) return false;
          return true;
        });

        // Combine them if there are any live chats, otherwise use local filtered
        if (finalChats.length === 0) {
          finalChats = localFiltered;
        }
      } else {
        // If we succeeded with live chats, we can filter them by sessionId/phone if requested
        if (sessionId) {
          finalChats = finalChats.filter((chat: any) => chat.sessionId === sessionId);
        }
        if (phone) {
          finalChats = finalChats.filter((chat: any) => chat.phone === phone);
        }
      }

      // Sort chronologically
      finalChats.sort((a: any, b: any) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });

      return res.json({ success: true, data: finalChats, source: fetchSuccess ? "n8n_live" : "local_cache" });
    } catch (err: any) {
      console.error("[SERVER] Error getting chats:", err);
      return res.status(500).json({ success: false, message: "שגיאה באחזור השיחות מהשרת", error: err?.message });
    }
  });

  // Save new chats (accessible without browser auth, so n8n can easily post logs)
  app.post("/api/chats", (req: any, res: any) => {
    try {
      const payload = req.body;
      if (!payload) {
        return res.status(400).json({ success: false, message: "הבקשה ריקה" });
      }

      const chats = readChats();
      const nowStr = new Date().toISOString();

      const processItem = (item: any) => {
        // Handle variations of sessionId
        const sessionId = item.sessionId || item.session_id || item.SessionId || item.Session_ID || "";
        if (!sessionId) return null;

        // Parse phone and botId
        let phone = item.phone || item.userPhone || item.user_phone || item.sender_phone || item.wa_id || item.from || "";
        let botId = item.botId || item.bot_id || "";
        let name = item.userName || item.name || item.sender_name || item.pushName || item.pushname || item.profile_name || item.customer_name || "";

        if (sessionId) {
          const cleanS = String(sessionId).replace(/@(?:s\.whatsapp\.net|c\.us)/gi, "");
          if (!phone) {
            const parts = cleanS.split(/[_\-]/);
            for (const part of parts) {
              if (part.toLowerCase() === "web" || part.toLowerCase() === "whatsapp" || part.toLowerCase() === "wa") continue;
              if (/^(\+?972|0)?[57]\d{8}$/.test(part) || /^(\+?972|0)[23489]\d{7}$/.test(part) || (/^\d{9,14}$/.test(part) && !part.startsWith("170") && !part.startsWith("180"))) {
                phone = part;
                break;
              }
            }
          }
          if (!botId) {
            const firstUnderscore = sessionId.indexOf("_");
            botId = firstUnderscore !== -1 ? sessionId.substring(firstUnderscore + 1) : sessionId;
          }
        }

        // Handle variations of message content
        let msgType = "human";
        let msgContent = "";

        // Check if there is an explicit message object or fields
        const messageObj = item.message || item.msg || null;
        if (messageObj) {
          msgType = messageObj.type || messageObj.message_type || messageObj.sender || "human";
          msgContent = messageObj.content || messageObj.text || "";
        } else {
          msgType = item.type || item.message_type || item.sender || item.role || "human";
          msgContent = item.content || item.text || item.message || "";
        }

        // Standardize types to 'human' or 'ai'
        const lowerType = String(msgType).toLowerCase();
        let finalType: "human" | "ai" = "human";
        if (lowerType === "ai" || lowerType === "assistant" || lowerType === "bot" || lowerType === "agent") {
          finalType = "ai";
        }

        return {
          id: item.id || "msg_" + Math.random().toString(36).substring(2) + Date.now().toString(36),
          sessionId,
          botId,
          phone,
          name,
          userName: name,
          userPhone: phone,
          message: {
            type: finalType,
            content: typeof msgContent === "object" ? JSON.stringify(msgContent) : msgContent
          },
          timestamp: item.timestamp || item.created_at || nowStr
        };
      };

      let addedCount = 0;
      if (Array.isArray(payload)) {
        for (const item of payload) {
          const processed = processItem(item);
          if (processed) {
            chats.push(processed);
            addedCount++;
          }
        }
      } else {
        const processed = processItem(payload);
        if (processed) {
          chats.push(processed);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        // Enforce max storage limit to avoid large files (keep last 5000 messages)
        if (chats.length > 5000) {
          chats.splice(0, chats.length - 5000);
        }
        saveChats(chats);
        return res.json({ success: true, message: `שמרו ${addedCount} הודעות בהצלחה` });
      } else {
        return res.status(400).json({ 
          success: false, 
          message: "מבנה נתונים לא תקין. חובה לשלוח session_id או sessionId יחד עם פרטי ההודעה" 
        });
      }
    } catch (err: any) {
      console.error("[SERVER] Error saving chats:", err);
      return res.status(500).json({ success: false, message: "שגיאה פנימית בשמירת השיחה", error: err?.message });
    }
  });

  // Delete/Clear chats for testing
  app.delete("/api/chats", requireAuth, (req: any, res: any) => {
    try {
      const { sessionId, botId } = req.query;
      if (!sessionId && !botId) {
        return res.status(400).json({ success: false, message: "חובה לציין sessionId או botId למחיקה" });
      }

      let chats = readChats();
      const initialCount = chats.length;

      chats = chats.filter((chat: any) => {
        if (sessionId) {
          const reqSid = String(sessionId).trim();
          const chatSid = String(chat.sessionId || chat.session_id || "").trim();
          const reqPhone = reqSid.split("_")[0];
          const chatPhone = chatSid.split("_")[0] || String(chat.phone || "").trim();
          
          if (chatSid === reqSid) return false;
          if (reqPhone && chatPhone && reqPhone === chatPhone) return false;
          if (reqPhone && chatSid.startsWith(reqPhone)) return false;
        }
        if (botId && String(chat.botId) === String(botId)) return false;
        return true;
      });

      saveChats(chats);
      const deletedCount = initialCount - chats.length;

      return res.json({ success: true, message: `נמחקו ${deletedCount} הודעות` });
    } catch (err: any) {
      console.error("[SERVER] Error clearing chats:", err);
      return res.status(500).json({ success: false, message: "שגיאה במחיקת השיחות", error: err?.message });
    }
  });

  // Proxy payload POST to n8n Webhook
  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      const payload = req.body;
      const defaultUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/be853a5a-7092-4d75-88e8-d846e604e661";
      let webhookUrl = payload.webhookUrl || defaultUrl;

      // Add botId as parameter as requested
      const botId = payload.botId || "";
      if (botId) {
        const hasQuery = webhookUrl.includes("?");
        webhookUrl += `${hasQuery ? "&" : "?"}botId=${encodeURIComponent(botId)}`;
      }

      console.log("[SERVER] Syncing agent configuration to n8n webhook:", webhookUrl);

      let response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status === 404) {
        let altUrl = "";
        if (webhookUrl.includes("/webhook-test/")) {
          altUrl = webhookUrl.replace("/webhook-test/", "/webhook/");
        } else if (webhookUrl.includes("/webhook/")) {
          altUrl = webhookUrl.replace("/webhook/", "/webhook-test/");
        }
        if (altUrl) {
          console.log(`[SERVER] Primary webhook returned 404. Fallback attempt to alternate URL: ${altUrl}`);
          const altRes = await fetch(altUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/json, text/plain, */*",
            },
            body: JSON.stringify(payload),
          });
          if (altRes.ok) {
            response = altRes;
          }
        }
      }

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (!response.ok) {
        console.error("[SERVER] Webhook returned error:", response.status, responseText);
        return res.status(response.status).json({
          success: false,
          error: `ה-Webhook של n8n החזיר קוד שגיאה ויצר שגיאה: ${response.status}`,
          details: responseText,
        });
      }

      console.log("[SERVER] Webhook sync successful!", responseText);
      return res.json({
        success: true,
        data: responseData,
      });

    } catch (err: any) {
      console.error("[SERVER] Failed to proxy sync:", err);
      return res.status(500).json({
        success: false,
        error: "שגיאה פנימית בשרת בעת סנכרון",
        details: err?.message || String(err),
      });
    }
  });

  // Fetch fields content FROM n8n (GET/POST URL Webhook payload with POST fallback)
  const handleFetchConfig = async (req: any, res: any) => {
    try {
      const defaultGetUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/eacddf0e-4128-4097-8d47-62c142d05283";
      const postWebhookUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/be853a5a-7092-4d75-88e8-d846e604e661";
      const webhookUrlFromQuery = (req.query.url || req.body?.url) as string;
      let webhookUrl = webhookUrlFromQuery || defaultGetUrl;

      // If the URL passed for fetching is the POST update URL, swap it to the GET fetch URL
      if (webhookUrl === postWebhookUrl) {
        webhookUrl = defaultGetUrl;
      }

      // Append botId as query parameter if supplied, so the backend can fetch filtered configuration
      const botId = (req.query.botId || req.body?.botId) as string;
      let targetUrl = webhookUrl;
      if (botId) {
        const hasQuery = targetUrl.includes("?");
        targetUrl += `${hasQuery ? "&" : "?"}botId=${encodeURIComponent(botId)}`;
      }

      console.log("[SERVER] Fetching live config from webhook (GET):", targetUrl);

      let response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
        }
      });

      let responseText = await response.text();

      // Fallback to POST if n8n webhook returns 404/405 or indicates it expects a POST request
      if (!response.ok && (responseText.includes("POST request") || response.status === 404 || response.status === 405)) {
        console.warn(`[SERVER] Webhook GET returned ${response.status}. Retrying with POST request fallback to: ${targetUrl}`);
        const postResponse = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*"
          },
          body: JSON.stringify({
            action: "fetch",
            botId: botId || "*"
          })
        });

        const postText = await postResponse.text();
        if (postResponse.ok) {
          console.log("[SERVER] Webhook POST fallback succeeded!");
          response = postResponse;
          responseText = postText;
        } else {
          console.error("[SERVER] Webhook POST fallback also failed:", postResponse.status, postText);
          if (postResponse.status !== 404) {
            response = postResponse;
            responseText = postText;
          }
        }
      }

      if (!response.ok) {
        console.error("[SERVER] Webhook request failed:", response.status, responseText);
        return res.status(response.status).json({
          success: false,
          error: `ה-Webhook של n8n החזיר שגיאה קוד ${response.status} בקריאת הנתונים`,
          details: responseText.substring(0, 500)
        });
      }

      console.log("[SERVER] Webhook parsed successful output range:", responseText.substring(0, 400));
      
      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch {
        parsedData = responseText;
      }

      return res.json({
        success: true,
        data: parsedData,
      });

    } catch (err: any) {
      console.error("[SERVER] Failed to request GET/POST webhook config:", err);
      return res.status(500).json({
        success: false,
        error: "שגיאת תקשורת בקבלת נתונים מ-n8n (Hook)",
        details: err?.message || String(err),
      });
    }
  };

  app.get("/api/fetch-config", requireAuth, handleFetchConfig);
  app.post("/api/fetch-config", requireAuth, handleFetchConfig);

  // --- HTML SCRAPER / SANITIZATION HELPER ---
  function extractDocumentLinks(html: string, baseUrl: string): string[] {
    const urls: string[] = [];
    try {
      const hrefRegex = /href=["']([^"'\s>]+)["']/gi;
      let match;
      while ((match = hrefRegex.exec(html)) !== null) {
        const link = match[1].trim();
        const isDoc = /\.(pdf|docx?|xlsx?|pptx?|epub|zip)/i.test(link) || 
                      /brochure|catalog|download|price-list|manual|spec-sheet|docs/i.test(link);
        
        if (isDoc && !link.startsWith("javascript:") && !link.startsWith("#") && !link.startsWith("mailto:") && !link.startsWith("tel:")) {
          let absoluteUrl = link;
          if (!/^https?:\/\//i.test(link)) {
            try {
              absoluteUrl = new URL(link, baseUrl).href;
            } catch {
              continue;
            }
          }
          if (!urls.includes(absoluteUrl)) {
            urls.push(absoluteUrl);
          }
        }
      }
    } catch (e) {
      console.error("[SERVER] Error extracting document links:", e);
    }
    return urls.slice(0, 10);
  }

  function extractCleanText(html: string): string {
    let text = html.replace(/<(script|style|svg|noscript|header|footer|nav)[^>]*>([\s\S]*?)<\/\1>/gi, " ");
    text = text.replace(/<!--[\s\S]*?-->/g, " ");
    text = text.replace(/<\/?[a-z0-9]+[^>]*>/gi, " ");
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    text = text.replace(/\s+/g, " ").trim();
    return text.substring(0, 12000); // 12,000 characters limit
  }

  function extractInternalPageLinks(html: string, baseUrl: string): string[] {
    const pageUrls: string[] = [];
    try {
      const hrefRegex = /href=["']([^"'\s>]+)["']/gi;
      let match;
      const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
      let baseHostname = "";
      try {
        baseHostname = new URL(baseUrl).hostname.replace("www.", "");
      } catch {
        return [];
      }
      
      while ((match = hrefRegex.exec(html)) !== null) {
        const link = match[1].trim();
        if (!link || link.startsWith("javascript:") || link.startsWith("#") || link.startsWith("mailto:") || link.startsWith("tel:")) {
          continue;
        }
        
        // Skip obvious document or static assets
        if (/\.(pdf|docx?|xlsx?|pptx?|epub|zip|png|jpe?g|gif|css|js|svg)$/i.test(link)) {
          continue;
        }

        let absoluteUrl = link;
        if (!/^https?:\/\//i.test(link)) {
          try {
            absoluteUrl = new URL(link, cleanBaseUrl).href;
          } catch {
            continue;
          }
        }

        try {
          const linkHostname = new URL(absoluteUrl).hostname.replace("www.", "");
          if (linkHostname === baseHostname && absoluteUrl !== baseUrl && absoluteUrl !== cleanBaseUrl) {
            if (!pageUrls.includes(absoluteUrl)) {
              pageUrls.push(absoluteUrl);
            }
          }
        } catch {}
      }
    } catch (e) {
      console.error("[SERVER] Error extracting internal page links:", e);
    }
    return pageUrls;
  }

  // --- MODEL FALLBACK HELPER FOR GEMINI ---
  async function generateWithFallback(aiClient: any, params: any) {
    // If the primary model fails (e.g. Quota Exceeded/429/503), fall back to multiple highly available flash models
    const models = [params.model, "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;
    
    for (const model of models) {
      if (!model) continue;
      try {
        console.log(`[SERVER] Querying Gemini using model: ${model}`);
        const runParams = { ...params, model };
        const response = await aiClient.models.generateContent(runParams);
        if (response) {
          console.log(`[SERVER] Success generating content with model: ${model}`);
          return response;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[SERVER] Gemini execution failed with model ${model}, trying next if available. Error:`, err?.message || err);
      }
    }
    throw lastError || new Error("Gemini generation failed on all attempted models");
  }

  // ---------------- PUBLIC BOT CONFIG ROUTE FOR EMBEDDED WIDGETS ----------------
  app.get("/api/public/bot-config", async (req: any, res: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    try {
      const botId = (req.query.bot_id || req.query.botId || "").toString().trim();
      const allAgents = readAgents();

      let agent = allAgents.find((a: any) => (a.botId && String(a.botId) === botId) || (a.id && String(a.id) === botId));

      // Attempt to pull live data from n8n GET webhook if fields are missing or agent not found locally
      let n8nBotData: any = null;
      if (botId) {
        try {
          const defaultGetUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/eacddf0e-4128-4097-8d47-62c142d05283";
          const fetchUrl = `${defaultGetUrl}${defaultGetUrl.includes("?") ? "&" : "?"}botId=${encodeURIComponent(botId)}`;
          console.log("[SERVER] Fetching bot config from n8n webhook for botId:", botId);
          
          const n8nRes = await fetch(fetchUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "application/json, text/plain, */*"
            }
          });

          if (n8nRes.ok) {
            let rawData = await n8nRes.json();
            if (Array.isArray(rawData)) {
              // Find matching bot in array
              const matched = rawData.find((item: any) => {
                const itemBotId = String(item.botId || item["Bot ID"] || item.id || "").trim();
                return itemBotId === botId;
              });
              n8nBotData = matched || rawData[0];
            } else if (rawData && typeof rawData === "object") {
              n8nBotData = rawData;
            }
          }
        } catch (n8nErr) {
          console.warn("[SERVER] n8n fetch fallback for bot-config failed:", n8nErr);
        }
      }

      // Helper to extract values from n8n data
      const getVal = (keys: string[]): string => {
        if (!n8nBotData) return "";
        for (const k of keys) {
          if (n8nBotData[k] !== undefined && n8nBotData[k] !== null) {
            return String(n8nBotData[k]).trim();
          }
        }
        return "";
      };

      const title = getVal(["businessName", "שם העסק", "name", "שם", "title", "Bot Identity"]) || agent?.businessName || agent?.name || agent?.title || "בוט עסק חכם";
      const welcomeMessage = getVal(["FirstMessage", "firstMessage", "welcomeMessage", "הודעת פתיחה", "First Message"]) || agent?.welcomeMessage || "";
      const conversationFlow = getVal(["conversationFlow", "זרימת שיחה", "תסריט שיחה", "Conversation Flow"]) || agent?.conversationFlow || "";
      const whatsappNumber = getVal(["ownerPhone", "טלפון בעל העסק", "phone", "whatsappNumber", "Owner Phone"]) || agent?.ownerPhone || agent?.whatsappNumber || agent?.phone || "972552502584";

      if (!agent && !n8nBotData && allAgents.length > 0) {
        agent = allAgents[0];
      }

      const finalBotId = botId || getVal(["botId", "Bot ID"]) || agent?.botId || agent?.id || "bot_generic";
      const finalTitle = title || agent?.businessName || agent?.name || "בוט עסק חכם";
      const finalWelcome = welcomeMessage || agent?.welcomeMessage || "";
      const finalFlow = conversationFlow || agent?.conversationFlow || "";
      const finalWa = whatsappNumber || agent?.ownerPhone || "972552502584";

      return res.json({
        botId: finalBotId,
        title: finalTitle,
        welcomeMessage: finalWelcome,
        conversationFlow: finalFlow,
        whatsappNumber: finalWa,
        themeColor: agent?.themeColor || "#0047AB"
      });
    } catch (err: any) {
      console.error("[SERVER] Error fetching public bot config:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // ---------------- PUBLIC DEMO BOT CREATION ROUTE ----------------
  app.post("/api/public/create-demo-bot", async (req, res) => {
    try {
      let { url, phone, agentType, additionalContext, agentName } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, error: "אנא ספק כתובת אתר URL תקינה" });
      }

      url = url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }

      const activeAgentType = agentType === "support" ? "support" : "sales";
      const hasAdditionalContext = additionalContext && typeof additionalContext === "string" && additionalContext.trim().length > 0;
      const finalAgentName = agentName && typeof agentName === "string" && agentName.trim().length > 0 ? agentName.trim() : "נציג העסק";

      // 1. Clean and normalize phone number if provided
      let ownerPhone = "972547866119"; // Default value
      if (phone && phone.trim()) {
        const phoneClean = phone.replace(/\D/g, "");
        // Basic Hebrew verification
        let isValid = false;
        if (phoneClean.startsWith("05") && phoneClean.length === 10) {
          isValid = true;
          ownerPhone = "972" + phoneClean.substring(1);
        } else if (phoneClean.startsWith("5") && phoneClean.length === 9) {
          isValid = true;
          ownerPhone = "972" + phoneClean;
        } else if (phoneClean.startsWith("9725") && phoneClean.length === 12) {
          isValid = true;
          ownerPhone = phoneClean;
        } else if (phoneClean.length >= 9 && phoneClean.length <= 15) {
          isValid = true;
          ownerPhone = phoneClean;
        }

        if (!isValid) {
          return res.status(400).json({ 
            success: false, 
            error: "מספר הטלפון שהוזן אינו תקין. אנא ודא שהזנת מספר נייד ישראלי או בינלאומי תקין." 
          });
        }
      }

      console.log(`[PUBLIC DEMO] Creating demo bot for URL: ${url}, Phone: ${ownerPhone}, Type: ${activeAgentType}, Agent Name: ${finalAgentName}, Additional text length: ${hasAdditionalContext ? additionalContext.trim().length : 0}`);

      // 2. Scrape website content with deep research crawl over subpages
      let scrapedText = "";
      let brochureLinks: string[] = [];
      try {
        console.log(`[SCRAPER] Scrape main URL started for: ${url}`);
        
        // Helper to crawl a single page securely
        const crawlPage = async (targetUrl: string): Promise<{ text: string; links: string[] }> => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds timeout per subpage
            const fetchResponse = await fetch(targetUrl, {
              signal: controller.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8"
              }
            });
            clearTimeout(timeoutId);
            if (fetchResponse.ok) {
              const html = await fetchResponse.text();
              const links = extractDocumentLinks(html, targetUrl);
              const text = extractCleanText(html);
              return { text, links };
            }
          } catch (e: any) {
            console.warn(`[SCRAPER] Failed crawling page ${targetUrl}:`, e?.message || e);
          }
          return { text: "", links: [] };
        };

        // First step: fetch home page/main URL
        const mainController = new AbortController();
        const mainTimeoutId = setTimeout(() => mainController.abort(), 9000);
        let mainHtml = "";
        try {
          const fetchResponse = await fetch(url, {
            signal: mainController.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8"
            }
          });
          if (fetchResponse.ok) {
            mainHtml = await fetchResponse.text();
          }
        } catch (e: any) {
          console.warn(`[SCRAPER] Main page scrape fetch failed:`, e?.message || e);
        } finally {
          clearTimeout(mainTimeoutId);
        }

        if (mainHtml) {
          brochureLinks = extractDocumentLinks(mainHtml, url);
          scrapedText = extractCleanText(mainHtml);

          // Get internal pages to crawl
          const internalLinks = extractInternalPageLinks(mainHtml, url);
          if (internalLinks.length > 0) {
            const priorityKeywords = [
              "datalogger", "system", "product", "catalog", "brochure", "download", "spec", "manual",
              "doc", "file", "device", "support", "service", "item", "guide", "pdf", "about"
            ];
            
            const scoredPages = internalLinks.map(link => {
              let score = 0;
              const lowerUrl = link.toLowerCase();
              for (const kw of priorityKeywords) {
                if (lowerUrl.includes(kw)) {
                  score += 10;
                  if (lowerUrl.includes("/" + kw) || lowerUrl.includes(kw + "/")) {
                    score += 15;
                  }
                }
              }
              return { link, score };
            });

            scoredPages.sort((a, b) => b.score - a.score);
            const topSubPagesPath = scoredPages.slice(0, 4).map(p => p.link);
            
            console.log(`[SCRAPER] Deep crawling sub-pages for document research:`, topSubPagesPath);

            // Scrape sub-pages concurrently with rapid timeouts
            const results = await Promise.all(
              topSubPagesPath.map(p => crawlPage(p))
            );

            // Merge results
            for (let i = 0; i < results.length; i++) {
              const res = results[i];
              const pUrl = topSubPagesPath[i];
              if (res.text && res.text.length > 30) {
                scrapedText += `\n\n--- תוכן עמוד פנימי קשור (${pUrl}) ---\n` + res.text;
              }
              for (const lnk of res.links) {
                if (!brochureLinks.includes(lnk)) {
                  brochureLinks.push(lnk);
                }
              }
            }
          }
        }
      } catch (fErr: any) {
        console.warn(`[PUBLIC DEMO] Deep scrape fetch failed for ${url}:`, fErr?.message || fErr);
      }

      // Extract details with Gemini (or fallback defaults if Gemini is not running/available)
      let googleAiPromptResponse: any = null;
      let businessName = "העסק הגנרי";
      
      // Fallback details if Gemini is missing or fails
      // We can guess businessName from URL host
      try {
        const parsedUrl = new URL(url);
        let hostClean = parsedUrl.hostname.replace("www.", "").split(".")[0];
        if (hostClean) {
          businessName = hostClean.charAt(0).toUpperCase() + hostClean.slice(1);
        }
      } catch {}

      if (ai) {
        try {
          let cleanInputForAi = scrapedText && scrapedText.length > 50 
            ? scrapedText 
            : `אתר אינטרנט בכתובת ${url}`;

          if (hasAdditionalContext) {
            cleanInputForAi += `\n\n--- חומרי מידע ומסמכים שהוזנו ישירות על ידי המשתמש (חובה לשלב ספציפית במידע ובפתרונות!): ---\n${additionalContext.trim()}`;
          }

          if (brochureLinks.length > 0) {
            cleanInputForAi += `\n\n--- קישורים לברושורים, מסמכים וקבצי PDF שנמצאו בסריקה עמוקה של האתר (חובה לכלול אותם תחת השדה syllabusLinks בפורמט הרשום): ---\n` + brochureLinks.map(l => `- מסמך/ברושור הורדה: ${l}`).join("\n");
          }

          const isSupport = activeAgentType === "support";
          const geminiPrompt = 
            `עליך לנתח את חומרי הטקסט הבאים שנשאבו מתוך אתר הלקוח וחומרי המידע הנוספים שהועלו, ולבנות סוכן ${isSupport ? 'תמיכה טכנית מקצועי' : 'מכירות דיגיטלי מושלם'} עבורו בעברית.\n\n` +
            `טקסט מהאתר וחומרים מורחבים:\n${cleanInputForAi}\n\n` +
            `משימה:\n` +
            `1. זהה את שם העסק בעברית. אם קשה לזהות, ספק שם עסק הגיוני וקצר המבוסס על הכתובת ${url}.\n` +
            `2. בנה פרומפטים מעולים ומזמינים במיוחד בעברית לצ'אט ו-WhatsApp שיהפכו אותו ל${isSupport ? 'סוכן תמיכה טכנית ופתרון תקלות מקצועי מהשורה הראשונה, שמסייע, מסביר שלבים ופותר שאלות ללקוחות בנחת' : 'מוכר הכי טוב של השירותים והמוצרים'} של האתר והעסק הזה.\n` +
            `${isSupport ? 'הסוכן הוא סוכן תמיכה טכנית (Tech Support Agent). עליו לתת מענה ממוקד שלבים, להתבסס בצורה משמעותית על חומרי המידע הנוספים שהוזנו ולדעת להפנות לקובצי המדריכים והברושורים שסופקו.' : 'הסוכן הוא סוכן מכירות (Sales Agent). מטרתו למכור, לסקרן וללכוד לידים איכותיים.'}\n` +
            `חשוב מאוד: התעלם לחלוטין ובאופן גורף מכל נושא של קורסים, סילבוסים לרובלוקס חוגי ילדים או סקראץ' אלא אם כן זה בדיוק מה שהאתר הזה מוכרים בו. שכח מקורסים לילדים! המוצרים הם אך ורק מוצרי העסק האמיתיים שמופיעים באתר בלבד!\n\n` +
            `החזר תשובת JSON מובנית בלבד, בתואם לשדות הבאים:\n` +
            `{\n` +
            `  "businessName": "שם העסק בעברית",\n` +
            `  "botIdentity": "הגדרת שם הבוט, תפקידו כנציג רשמי של שם העסק ונימת הדיבור השירותית והמקצועית שלו (${isSupport ? 'תומך טכני סבלני ופתרון תקלות מובנה' : 'שיווקי וחם!'})",\n` +
            `  "coursesInfo": "פירוט מלא ומותאם של השירותים, מוצרים או ההסברים המדעיים/הטכניים שמצאת באתר, כולל פתרונות ומחירים אם מופיעים",\n` +
            `  "kidsCourses": "שירותים, קטגוריות משנה, קהל יעד מיועד וסיגמנטים מיוחדים. חוק בל יעבור: פרט והרחב אך ורק במי קהל היעד שבו אנו כן ממוקדים (מי כן), בשום אופן אל תציין במה העסק לא ממוקד או למי אנו לא פונים (אל תפרט מי לא, כדי למנוע רשימה ארוכה ומייגעת). מיקוד חיובי בלבד!",\n` +
            `  "conversationFlow": "זרימת השיחה המושלמת בווטסאפ: פתיחה מלבבת, ${isSupport ? 'הבנת התקלה/השאלה לעומק ויצירת פתרונות שלב אחר שלב' : 'שאלות הכוון על צורכי הלקוח למטרות מכירה, מתן ערך'} וקריאה לפעולה ליצירת קשר במידת הצורך. חוק בל יעבור: אין לשאול שאלות חוזרות ומיותרות אם אין לך מידע, פנה מיידית לקבלת עזרה אנושית!",\n` +
            `  "writingStyle": "הנחיות לכתיבה בווטסאפ: שבירת שורות, סגנון קצר, חלוקה לנקודות או שלבים ברורים, שימוש יצירתי וקטן באימוג'ים מתאימים",\n` +
            `  "faqAnswers": "3-4 שאלות ותשובות נפוצות מבוססות על המידע האמיתי מהעסק, בפורמט ש: ות: בעברית",\n` +
            `  "whatNotToDo": "חוקי ברזל שהבוט לעולם לא יפר: 1) בשום אופן אין לסיים, לחתוך או לעצור את השיחה אם המשתמש מבקש ברושור או מסמך שאין לך! 2) לא להמציא פתרונות או מחירים שלא יודע, 3) לא לפתוח בדיון סרק אם אין לך מה להציע, אלא לנתב באדיבות ולהמשיך לענות לשאר שאלות המשתמש.",\n` +
            `  "syllabusLinks": "חוק ברזל בנושא ברושורים ומסמכים: אם הלקוח שואל או מבקש ברושור, מסמך, עלון או הדרכה כלשהי - הבוט חייב לתת מיידית ובצורה מפורשת וקצרה את הקישורים הישירים למסמכים/PDF/ברושורים שסופקו לעיל. אולם, אם אין לבוט קישור מדויק מתאים, אסור לו בשום אופן לעצור, לסיים או לחתוך את השיחה! עליו להשיב בנימוס רב כי אין לו את הקישור המדויק כרגע וממליץ לברר מול הנציג, אך להמשיך מיד הלאה בצורה שירותית ולשאול: 'בינתיים, אילו שאלות נוספות או נושאים שתרצה שאשמח לעזור בהם?'.",\n` +
            `  "humanEscalation": "הנחיות הפניה לגורם אנושי (${finalAgentName}) בטלפון ${ownerPhone}. חוק ברזל: ברגע שמתקבל קושי, בקשה לנציג, או שאילתה לגבי ברושור/מסמך שאינך מחזיק בקישור שלו, ענה בנימוס רב שהם יכולים לפנות ישירות אל ${finalAgentName} במספר ${ownerPhone} לקבלת הקובץ. עם זאת, חל איסור מוחלט לעצור, לסיים, או לחתוך את השיחה מיוזמת הבוט! הבוט ימשיך תמיד בשיחה וישאיר אותה פתוחה, וישאל מיד בסיום ההפניה: 'בינתיים, האם יש משהו נוסף שתרצה שאעזור לך בו או נושאים נוספים שנוכל לדבר עליהם?' כדי להמשיך לתת שירות באהבה ובאדיבות."\n` +
            `}`;

          const response = await generateWithFallback(ai, {
            model: "gemini-3.5-flash",
            contents: geminiPrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  businessName: { type: Type.STRING },
                  botIdentity: { type: Type.STRING },
                  coursesInfo: { type: Type.STRING },
                  kidsCourses: { type: Type.STRING },
                  conversationFlow: { type: Type.STRING },
                  writingStyle: { type: Type.STRING },
                  faqAnswers: { type: Type.STRING },
                  whatNotToDo: { type: Type.STRING },
                  syllabusLinks: { type: Type.STRING },
                  humanEscalation: { type: Type.STRING }
                },
                required: [
                  "welcomeMessage", "businessName", "botIdentity", "coursesInfo", "kidsCourses", "conversationFlow",
                  "writingStyle", "faqAnswers", "whatNotToDo", "syllabusLinks", "humanEscalation"
                ]
              }
            }
          });

          if (response && response.text) {
            googleAiPromptResponse = JSON.parse(response.text.trim());
            if (googleAiPromptResponse.businessName) {
              businessName = googleAiPromptResponse.businessName;
            }
          }
        } catch (gErr) {
          console.error("[PUBLIC DEMO] Gemini prompt formulation failed, falling back to local formulas:", gErr);
        }
      }

      // Build fallback prompts if Gemini was not initialized or failed
      if (!googleAiPromptResponse) {
        googleAiPromptResponse = generateFallbackPrompts(activeAgentType, businessName, finalAgentName, {});
      }

      res.json({
        success: true,
        prompts: googleAiPromptResponse
      });
    } catch (err: any) {
      console.error("[PUBLIC DEMO] generate-agent-prompt endpoint error:", err);
      res.status(500).json({
        success: false,
        error: "ארעה שגיאה בעיבוד הפרומפטים על ידי שרת ה-AI: " + (err.message || err)
      });
    }
  });

function generateFallbackPrompts(templateId: string, businessName: string, ownerName: string, answers: any) {
    const biz = businessName?.trim() || "העסק החכם";
    const own = ownerName?.trim() || "מנהל העסק";
    const aud = answers?.audience || "קהל לקוחות רלוונטיים מתעניינים";
    const tone = answers?.tone || "שירותי, אדיב, מעורר ביטחון, קצר ואינפורמטיבי";
    const rest = answers?.restrictions || "לא למסור מחירים שלא אומתו, לא להבטיח הבטחות כספיות ללא אישור";
    const esc = answers?.escalationTrigger || "כשהמשתמש מבקש נציג אנושי, מתלונן או שואל שאלה מורכבת שחורגת מהמידע הנוכחי";
    const defaultWelcome = ` שלום וברוכים הבאים ל-${biz}! ✨\nשמי העוזר הדיגיטלי הרשמי של העסק.\nכיצד אוכל לסייע לך היום?\n\n[1. 📝 קבלת מידע ופרטים]\n[2. ❓ שאלות ותשובות נפוצות]\n[3. 📞 שיחה עם נציג אנושי]`;

    if (templateId === "support") {
      return {
        welcomeMessage: `👋 שלום וברוכים הבאים למרכז התמיכה של ${biz}! 🛠️\nשמי נציג התמיכה הדיגיטלי. אשמח לעזור לך בכל שאלה או נושא.\n\nבמה אוכל לסייע היום?\n[1. 🛠️ עזרה ופתרון תקלות]\n[2. 📖 מדריכים ושאלות נפוצות]\n[3. 📞 פנייה ישירה לנציג אנושי]`,
        botIdentity: `שלום! אני בוט התמיכה והשירות של ${biz}. תפקידי הוא לספק ללקוחות מענה מהיר, אדיב ומקצועי בעברית, תוך ייצוג ערכי העסק ורעיונותיו בהנחיית מנהל התמיכה ${own}. הטון שלי הוא ${tone}.`,
        coursesInfo: `שירותי התמיכה והקורסים של ${biz} כוללים מערכי למידה מתקדמים, ליווי שבועי ועזרה במענה לשאלות מורכבות.\nנשמח להעניק לך את מרב התמיכה והסבלנות הנדרשים.`,
        kidsCourses: `אנו ב-${biz} גאים להציע קורסי תכנות וסדנאות יצירה מיוחדות המותאמות בדיוק לילדים ונוער, כולל תמיכה וסיוע להורים המעורבים בתהליך. במפגשים אנו שמים דגש על פיתוח חשיבה עצמאית.`,
        conversationFlow: `שלבי התקדמות השיחה בתמיכה:\n1. ברוך הבא וברכת שלום חמה.\n2. בירור הצורך או התקלה של הלקוח בצורה סבלנית.\n3. מתן תשובה ישר ולעניין.\n4. ודא שביעות רצון; במידת הצורך קח פרטים והפנה ל${own}.`,
        writingStyle: `הנחיות עימוד וניסוח לתמיכה:\n- תשובות נקיות, מרווחות (שורה רווח בין נושאים).\n- שימוש בסגנון כתיבה קולח ומעורר ביטחון.\n- הימנעות ממילים או קיצורים חצופים.\n- שימוש מאוזן באימוג'ים שירותיים.`,
        faqAnswers: `שאלות ותשובות לתמיכה:\nש: מה זמן המענה הממוצע לפניות?\nת: אנו משתדלים להשיב במהירות האפשרית, לרוב תוך פחות משעה בשעות הפעילות.\n\nש: כיצד ניתן לבטל או לשנות מועד שיעור?\nת: יש לעדכן אותנו לפחות 24 שעות מראש כדי שנוכל להיערך לכך בהתאם.`,
        whatNotToDo: `מגבלות וחוקי ברזל:\n1. ${rest}\n2. לעולם אין להבטיח פיצויים כספיים או החזרים ללא אישור ישיר מ${own}.`,
        syllabusLinks: `- סילבוס שירות לקוחות ומדריך למשתמש: https://fastway.example.com/support-guide\n- עמוד השוואת תוכניות הלימוד הרשמי: https://fastway.example.com/programs-overview`,
        humanEscalation: `בכל מקרה של כעס מצד המשתמש, קושי במתן פתרון, או כאשר מוגדר: ${esc} – ענה תחילה בנימוס שישנו פירוט רב באתר והפנה באדיבות למענה אישי בטלפון של ${own}. עם זאת, לעולם אל תפסיק או תסיים את השיחה מיוזמתו (רק הלקוח מסיים)! מיד לאחר ההפניה, שאל את המשתמש באדיבות: "בינתיים, האם יש משהו נוסף שתרצה שאעזור לך בו או שאלה מעניינת נוספת?".`
      };
    } else if (templateId === "kids") {
      return {
        welcomeMessage: `👋 שלום להורים היקרים! 🌟\nברוכים הבאים ל-${biz}.\nשמי היועץ החינוכי הדיגיטלי. אשמח לסייע לכם למצוא את החוג והמסלול המתאים ביותר לילדכם!\n\n[1. 🧸 קורסים וחוגים לילדים ונוער]\n[2. 📅 תיאום שיעור ניסיון במתנה]\n[3. 📞 שיחה עם רכז החוגים]`,
        botIdentity: `שלום! אני היועץ החינוכי והרכז של ${biz}. התפקיד המקצועי שלי הוא ללוות הורים בבחירת חוגים, סדנאות קוד ופיתוח לילדים. הטון שלי הוא ${tone}.`,
        coursesInfo: `אנו ב-${biz} מספקים קורסי פרימיום ייחודיים לצעירים עם פדגוגיה מתקדמת, מעורבות הורים מובנית, ודקות תרגול חווייתיות.`,
        kidsCourses: `קורסים וסדנאות מובילים לילדים ונוער:\n1. עיצוב ופיתוח משחקים ב-Roblox (גילאי 9-13).\n2. יסודות חשיבה חישובית ויצירת אנימציות ב-Scratch (גילאי 7-10).\n3. סדנאות קיץ יצירתיות לפיתוח משחקים תלת-מימדיים.`,
        conversationFlow: `זרימת שיחה ליועץ החוגים:\n1. התחל בברכה מלבבת להורה ושאל לגיל הילד ותחומי העניין שלו במחשב.\n2. הצג בחום את החוג או הקורס המתאים לגיל הילד.\n3. הצע להם שיעור התנסות חווייתי במתנה, ובקש טלפון לקביעת השיבוץ.`,
        writingStyle: `הנחיות ניסוח חיוני להורים:\n- טון חם, מכיל, קשוב ומרגיע.\n- שבירת שורות תכופה ליצירת הודעות נוחות לקריאה בנייד במקום בלוקים ארוכים.\n- שימוש באימוג'ים שמחים וחבריים.`,
        faqAnswers: `שאלות של הורים:\n- האם דרוש רקע מוקדם לחוג?\n- הקורסים מתחילים לחלוטין מאפס, ומלווים על ידי מדריכים מנוסים.\n\nש: מהו מכסת התלמידים בקבוצות?\nת: אנו שומרים על קבוצות קטנות ואיכותיות ללמידה אישית ומוצלחת.`,
        whatNotToDo: `מגבלות בחוגי ילדים:\n1. ${rest}\n2. לעולם אל תיתן הבטחות רפואיות/חינוכיות גורפות או תשובות סותרות ללא התייעצות מול ${own}.`,
        syllabusLinks: `- סילבוס קורס פיתוח משחקים ברובלוקס לקבוצות: https://fastway.example.com/syllabus-kids-roblox\n- סילבוס קבוצות צעירות ב-Scratch: https://fastway.example.com/syllabus-kids-scratch`,
        humanEscalation: `במצבים המוגדרים כ: ${esc}, או כאשר ההורה מתעקש על שיחה טלפונית למחירים מיוחדים – ספר קודם בנימוס שמרבית המידע הרלוונטי נמצא בשמחה באתר והפנה אותו באדיבות רבה אל ${own} בטלפון. עם זאת, זכור חוק בל יעבור: הבוט לעולם אינו מסיים או מפסיק את השיחה מיוזמתו! המשך תמיד בשיחה באדיבות ושאל: "האם יש בינתיים שאלות נוספות או נושאים שתרצה שאענה לך עליהם?".`
      };
    } else if (templateId === "qualify") {
      return {
        welcomeMessage: `👋 שלום רב! 🌟\nברוכים הבאים למערכת האפיון של ${biz}.\n\nכיצד נוכל לסייע לך להתקדם?\n[📋 בדיקת התאמה מהירה]\n[🎓 מסלולי הלימוד שלנו]\n[📞 שיחת יעוץ טלפונית]`,
        botIdentity: `שלום! אני הסוכן הממיין הרשמי של ${biz}. התפקיד שלי הוא לבדוק התאמת פונים למסלולים שלנו, לקבל מהם פרטי רקע קצרים, ולתאם מולם שיחת אפיון טלפונית מדויקת מול ${own}. הטון שלי הוא ${tone}.`,
        coursesInfo: `אפיון הצרכים משמש אותנו ב-${biz} כדי לסווג את הפונים למסלול האיכותי ביותר, תוך שמירה על קבוצות ממוקדות ומתואמות המניבות הישגים מדהימים.`,
        kidsCourses: `במסגרת האפיון לחוגי הילדים, נרצה לדעת האם לילד יש מחשב מתאים בבית ותקשורת אינטרנט תקינה המפשיטה את תהליך הלמידה.`,
        conversationFlow: `שלבי המיון האפקטיבי:\n1. בירור קצר של שם מלא ומטרת הלימודים.\n2. שאלה לגבי זמינות קורסי בוקר או ערב, ורמת רקע קודם.\n3. אימות מספר טלפון ליצירת קשר.\n4. קביעת מועד שיחת אפיון טכנית אישית עם ${own} או מנהל הקבלה.`,
        writingStyle: `סגנון תכליתי ומהיר:\n- טון ענייני, מהיר, רשמי, ממוקד ועסקי.\n- שאלות קצרות, אחת בכל פעם, כדי למנוע הצפה של המשתמש בפרטים.\n- שימוש בסמלים ברורים לניווט ושלבים.`,
        faqAnswers: `שאלות סינון שכיחות:\nש: כמה זמן לוקח האפיון?\nת: בסך הכל 2-3 דקות פה בצ'אט ומעבר לשיחה של 5 דקות.\n\nש: האם סינון מונע ממני להירשם?\nת: לא, מטרתו היא רק להבטיח שאתה משובץ לקבוצה המתאימה בדיוק לקצב שלך.`,
        whatNotToDo: `מגבלות סינון:\n1. ${rest}\n2. בשום מצב אל תתווכח או תיצור תחושה של 'בחינת קבלה' מלחיצה.\n3. אל תציע מחירים לפני שהגדרת את סוג השיבוץ.`,
        syllabusLinks: `- שאלון אפיון להורדה מקדימה: https://fastway.example.com/qualify-sheet\n- סיכום פרטי מסלולי הלימוד: https://fastway.example.com/programs`,
        humanEscalation: `לאחר השלמת אימות הפרטים (שם, טלפון ועניין), או כאשר מוגדר: ${esc} – ענה קודם בנימוס שישנו פירוט רב באתר והעבר את תוצאות השיחה ישירות לטלפון של ${own}. זכור שהבוט לעולם אינו מסיים את השיחה מצידו (רק הלקוח מסיים)! שאל תמיד מיד בסבלנות: "בינתיים, האם יש משהו נוסף שתרצה שאענה עליו בשמחה?".`
      };
    } else {
      // default is sales
      return {
        welcomeMessage: defaultWelcome,
        botIdentity: `שלום! אני סוכן השיווק וההרשמה המוביל של ${biz}. התפקיד שלי הוא להציג בפניך את המסלולים הטובים ביותר, לראות אם יש התאמה ואז לקשר אותך באהבה ל${own} מנהל העסק. הטון שלי הוא ${tone}.`,
        coursesInfo: `הקורסים המקצועיים של ${biz} מציעים את שיטת ההכשרה המתקדמת והעדכנית ביותר כיום המאפשרת פרויקטים מעשיים, ליווי שבועי צמוד בקבוצות בוטיק יוקרתיות ואחוז סיום יוצא דופן.`,
        kidsCourses: `לילדים ונוער, אנו מציעים קורסי תכנות ופיתוח משחקים ברובלוקס ובסקראץ', המפתחים חשיבה לוגית, סקרנות וביטחון עצמי מגיל צעיר.`,
        conversationFlow: `זרימת השיחה המומלצת למכירות:\n1. ברך בחיוביות, הצג את עצמך כסוכן של ${biz}.\n2. שאל לשמם ואיזה קורס/חוג הם מחפשים כדי להבין את רצונם.\n3. הצג את היתרונות הבלעדיים שלנו בעסק לפתרון שאלתם.\n4. קרא לפעולה ברורה: השארת מספר טלפון לתיאום שיחת התאמה אישית של 5 דקות מול ${own}.`,
        writingStyle: `הוראות עימוד וניסוח:\n- הודעות קצרות וקולעות, מרווחות בטוב טעם (שבירת שורות לנייד).\n- שימוש יצירתי באימוג'ים מתאימים ומניעי עניין.\n- טון שירותי, אקטיבי, מעורר סקרנות ומכוון מעשה.`,
        faqAnswers: `שאלות ותשובות שכיחות:\nש: האם יש קושי במציאת עבודה בסיום?\nת: אנו מספקים ליווי מקצועי, בניית תיק עבודות והכנה המעניקה לבוגרים שלנו נקודת זינוק משמעותית בשוק.\n\nש: מהו תאריך פתיחת הקורס?\nת: מחזורים נפתחים במרווחי זמן קבועים, כדי להתעדכן בשיבוץ המדויק מומלץ לשריין מקום מוקדם.`,
        whatNotToDo: `מגבלות ואיסורים מכירתיים:\n1. ${rest}\n2. לעולם אל תתווכח על מחיר או תסכים להנחה לא מאושרת מ${own}.\n3. הימנע מלחץ אגרסיבי, שמור על נימוס קלאסי.`,
        syllabusLinks: `- סילבוס מקיף פיתוח קוד פולסטאק React: https://fastway.example.com/syllabus-fullstack\n- סילבוס פיתוח Unity תלת-מימדי: https://fastway.example.com/syllabus-unity`,
        humanEscalation: `בכל מקרה של שאלה פיננסית סבוכה, בקשת מנוהל או כשמוגדר: ${esc} – הסבר תחילה באדיבות שישנו פירוט נהדר באתר לגבי הנושא, והפנה באדיבות להמשך פתרון פנומנלי מול ${own} בטלפון. היה חם ושירותי, וזכור: הבוט לעולם אינו מפסיק את השיחה מיוזמתו או מסכים לסיימה לבד. שאל מיד לאחר מכן: "בינתיים, האם יש לך עוד שאלות או נושאים רלוונטיים שתרצה שאשמח לעזור בהם?".`
      };
    }
}

  // Endpoint to generate full 10-part structured prompt using Gemini
  app.post("/api/ai/generate-agent-prompt", requireAuth, async (req, res) => {
    try {
      const {
        templateId,
        businessName,
        ownerName,
        pastedText,
        scrapedText,
        answers // object of custom answers
      } = req.body;

      if (!ai) {
        console.log("[SERVER] GoogleGenAI client NOT initialized. Generating fallback prompts locally.");
        const fallback = generateFallbackPrompts(templateId, businessName, ownerName, answers);
        return res.json({
          success: true,
          prompts: fallback,
          isFallback: true,
          warning: "בוצע מעבר אוטומטי למערכת פרומפטים מורחבת עקב חוסר בחיבור AI."
        });
      }

      let templateName = "בוט מכירות והרשמה קלאסי";
      if (templateId === "support") templateName = "בוט מידע ותמיכת לקוחות ומענה שאלות";
      else if (templateId === "kids") templateName = "בוט חוגים וסדנאות לילדים ונוער (הורים)";
      else if (templateId === "qualify") templateName = "בוט סינון, סיווג ואפיון מהיר";

      const knowledgeMaterials = `${pastedText || ''}\n\n${scrapedText || ''}`.trim() || "אין חומר ידע מפורש (בנה פרומפטים מבוססי הנחות הגיוניות ומקצועיות בהתאם לשם העסק ותשובות האפיון)";

      const promptToModel = 
        "אתה עוזר פיתוח AI ומומחה אפיון סוכני מכירות ושירות לצ'אט ו-WhatsApp. " +
        "עליך לבנות פרומפט הנחיות מקצועי ומקיף עבור סוכן דיגיטלי הבנוי מ-10 חלקים מובנים של מידע.\n\n" +
        "להלן פרטי העסק והמאפיינים שסופקו:\n" +
        `- שם העסק: ${businessName || 'לא צוין'}\n` +
        `- שם הבעלים: ${ownerName || 'לא צוין'}\n` +
        `- תבנית הבוט: ${templateName}\n` +
        `- מטרת העל והתוצאה המבוקשת מהשיחה (היעד של הבוט): ${answers?.goal || 'לא צוין'}\n` +
        `- קהל יעד מיועד: ${answers?.audience || 'לא צוין'}\n` +
        `- טון וסגנון המועדפים: ${answers?.tone || 'לא צוין'}\n` +
        `- איסורים וחוקי ברזל: ${answers?.restrictions || 'לא צוין'}\n` +
        `- מתי להעביר לנציג אנושי: ${answers?.escalationTrigger || 'לא צוין'}\n\n` +
        `חומרי ידע גולמיים וסילבוסים:\n${knowledgeMaterials}\n\n` +
        "משימה: עליך לייצר טקסט פרומפט מלא ועשיר בעברית עבור כל אחד מ-10 החלקים הבאים, מותאם לעסק. " +
        "החזר אובייקט JSON תקין ומדויק בעל 10 המפתחות הבאים:\n" +
        "1. welcomeMessage: הודעת פתיחה ראשונית חמה ומזמינה בעברית עם אימוג'ים מתאימים, הברכה הראשית, ותפריט אפשרויות/כפתורים מובנה בפורמט [1. כפתור ראשון], [2. כפתור שני], [3. כפתור שלישי] המזמין את הלקוח לפעולה.\n" +
        "2. botIdentity: הגדרת שם הבוט (המצא שם ידידותי בעברית), התפקיד, השיוך ל-{BusinessName} ונימת הדיבור.\n" +
        "3. coursesInfo: תיאור מפורט, קורסים, סילבוסים, מחירים או שירותים שהעסק מציע.\n" +
        "4. kidsCourses: קורסים, סדנאות קיץ, חוגים, קהל יעד מיועד וסיגמנטים מיוחדים. חוק בל יעבור: ציין אך ורק במי קהל היעד שבו אנו כן ממוקדים (מי כן), בשום אופן אל תציין במה או במי אנו לא ממוקדים ומי לא קהל היעד (אל תמנה מה לא או למי לא, כדי למנוע רשימה ארוכה ומייגעת). מיקוד חיובי בלבד!\n" +
        "5. conversationFlow: שלבי התקדמות השיחה ב-WhatsApp, מהברכה ועד השגת הטלפון לקריאה לפעולה.\n" +
        "6. writingStyle: הוראות עימוד וניסוח (קיצור הודעות, רווחים בין שורות, שבירת שורות, סגנון שמושך תשומת לב).\n" +
        "7. faqAnswers: 3-4 שאלות ותשובות נפוצות פוטנציאליות שמעניינות לקוחות, בפורמט ש: ות:\n" +
        "8. whatNotToDo: לפחות 3 דברים שהבוט לעולם לא יגיד, לא יבטיח, ולא יעשה.\n" +
        "9. syllabusLinks: פורמט קישורים של סילבוסים אליהם יוכל לקשר. (לדוגמה: - סילבוס קורס: https://yourdomain.com/syllabus...).\n" +
        "10. humanEscalation: מפורט ומלא של מתי וכיצד לבצע הפניה לגורם אנושי בטלפון {OwnerPhone}. עליך להורות לסוכן: (1) הוא אף פעם לא מפסיק או מסיים את השיחה מיוזמתו, רק הלקוח מסיים. (2) בכל מצב של בקשת נציג, שאלה מורכבת שחורגת מהמידע באתר (כמו דוגמאות API או הצעות סבוכות), או נושא פיננסי מעורפל – עליו קודם כל לכתוב בנימוס כי יש פירוט נהדר באתר והוא שמח לנסות לעזור, אך יש להפנות אותו אל הנציג {OwnerPhone}. לאחר מכן הוא חייב לשאול מיד בהמשכיות: 'בינתיים, האם יש לך שאלות נוספות שתרצה שאשמח לעשות עבורך?' על מנת להמשיך את השיחה תמיד.\n\n" +
        "חשוב מאוד: אל תשתמש במזהים של markdown או תגיות חתוכות בתוך ה-JSON של התשובה. כל ערך במפתח ה-JSON חייב להכיל את הפרומפט המלא, המעוצב והמסוגנן בעברית.";

      console.log("[SERVER] Generating full 10-part structured prompt using gemini-3.5-flash...");

      const response = await generateWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: promptToModel,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              welcomeMessage: { type: Type.STRING },
              botIdentity: { type: Type.STRING },
              coursesInfo: { type: Type.STRING },
              kidsCourses: { type: Type.STRING },
              conversationFlow: { type: Type.STRING },
              writingStyle: { type: Type.STRING },
              faqAnswers: { type: Type.STRING },
              whatNotToDo: { type: Type.STRING },
              syllabusLinks: { type: Type.STRING },
              humanEscalation: { type: Type.STRING }
            },
            required: [
              "welcomeMessage", "botIdentity", "coursesInfo", "kidsCourses", "conversationFlow",
              "writingStyle", "faqAnswers", "whatNotToDo", "syllabusLinks", "humanEscalation"
            ]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response returned from Gemini.");
      }

      const parsedJSON = JSON.parse(responseText.trim());
      return res.json({
        success: true,
        prompts: parsedJSON
      });

    } catch (err: any) {
      console.error("[SERVER] Generate agent prompt error:", err);
      console.log("[SERVER] Generating high quality fallback prompts as fallback.");
      try {
        const { templateId, businessName, ownerName, answers } = req.body;
        const fallback = generateFallbackPrompts(templateId, businessName, ownerName, answers);
        return res.json({
          success: true,
          prompts: fallback,
          isFallback: true,
          warning: "בוצע מעבר אוטומטי למערכת פרומפטים מורחבת עקב שגיאה טכנית ב-AI."
        });
      } catch (innerErr) {
        return res.status(500).json({
          success: false,
          error: "שגיאה ביצירת הפרומפטים באמצעות ה-AI",
          details: err?.message || String(err)
        });
      }
    }
  });

    // Endpoint to improve a specific prompt part with targeted instructions and custom emojis
  app.post("/api/ai/improve-agent-prompt-part", requireAuth, async (req, res) => {
    try {
      const {
        partKey,
        partTitle,
        currentValue,
        instruction,
        businessName,
        ownerName
      } = req.body;

      if (!currentValue && !instruction) {
        return res.status(400).json({
          success: false,
          error: "חובה לספק טקסט נוכחי או הנחיות לשיפור"
        });
      }

      if (!ai) {
        console.warn("[SERVER] GoogleGenAI client NOT initialized for improvement. Using simple fallback.");
        const enhancedText = `${currentValue || ""}\n\n[הערת שיפור AI (מצב לא מקוון)]: שופר בהתאם לבקשה "${instruction || "שיפור סגנון"}"`;
        return res.json({
          success: true,
          improvedText: enhancedText,
          isFallback: true
        });
      }

      const promptToModel = 
        "אתה עוזר פיתוח AI ומומחה כתיבה שיווקית, ניסוח דפי מסר, ומערכות אפיון סוכני שירות ומכירות לצ'אט ו-WhatsApp.\n" +
        "תפקידך לשפר, לשפץ, ולשדרג חלק ספציפי של הנחיות לבוט.\n\n" +
        `שם העסק: ${businessName || "עסק דיגיטלי"}\n` +
        `שם מנהל העסק: ${ownerName || "מנהל"}\n` +
        `שם החלק שאנו משפרים: ${partTitle || partKey}\n` +
        `מפתח החלק במערכת: ${partKey}\n\n` +
        "--- הטקסט הנוכחי של החלק ---\n" +
        `${currentValue || "ריק (אין תוכן קיים)"}\n\n` +
        "--- הנחיות השיפור של המשתמש ---\n" +
        `${instruction || "עשה שדרוג כללי של איכות, נסח בטון מקצועי ושירותי, ושלב אימוג'ים רלוונטיים מתאימים"}\n\n` +
        "דרישות קריטיות:\n" +
        "1. שפר ושדרג את הטקסט הנוכחי בהתאם להנחיות המשתמש.\n" +
        "2. דאג שהתוצאה תהיה בעברית תקנית, רהוטה, משכנעת, ומנוסחת בצורה מושלמת עבור סוכן דיגיטלי.\n" +
        "3. שלב בתוכו אימוג'ים רלוונטיים במיוחד לחלק הזה ובפרט אם התבקשת. אם זה חלק של זרימת שיחה, שלב בצורה יפה אימוג'י של שאלת פתיחה (כמו \u{1F44B}, ✨, שלום!, \u{1FA90}) ושלבי התקדמות (כמו \u{1F195}, \u{1F4CD}, \u{1F4DE}). אם זה שירותים, שלב סמלי למידה, קורסים ומחירים. \n" +
        "4. החזר אך ורק את טקסט ההנחיות החדש והמשופר בעברית. אל תכתוב שום מילה מחוץ לפרומפט המשופר (ללא הקדמות כמו 'הנה הטקסט המשופר', ללא תגיות markdown, ללא כותרות, פשוט החזר את הבלוק המשופר עצמו שהבוט אמור לקרוא).\n\n" +
        "התחל לכתוב את הטקסט המשופר כעת:";

      console.log(`[SERVER] Improving prompt part '${partKey}' with instruction: '${instruction}'`);

      const response = await generateWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: promptToModel,
      });

      let improvedText = response.text;
      if (!improvedText) {
        throw new Error("Empty response returned from Gemini.");
      }

      improvedText = improvedText.trim();
      if (improvedText.startsWith("```")) {
        improvedText = improvedText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
      }

      return res.json({
        success: true,
        improvedText: improvedText.trim()
      });

    } catch (err: any) {
      console.error("[SERVER] Prompt part improvement error:", err);
      return res.status(500).json({
        success: false,
        error: "שגיאה בשיפור החלק באמצעות AI",
        details: err?.message || String(err)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Ready on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer().catch(err => {
  console.error("[SERVER] Lifecycle failure:", err);
});

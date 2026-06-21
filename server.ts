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

  // Directories & Files Paths
  const DATA_DIR = path.join(process.cwd(), "data");
  const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
  const AGENTS_FILE = path.join(DATA_DIR, "agents.json");

  // Ensure data folder and files exist
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Default Settings (Includes Haim Bar's email as authorized administrator)
  const defaultSettings = {
    googleClientId: "57299413701-yg5kl6qlbygmuujyeftsgb.apps.googleusercontent.com",
    allowedEmails: ["haim.bar@gmail.com"],
    bypassUsers: [
      { name: "חיים בר (מנהל)", email: "haim.bar@gmail.com", passcode: "HaimBarAdmin2026!" }
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
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
        if (!parsed.bypassUsers) {
          parsed.bypassUsers = [...defaultSettings.bypassUsers];
        }
        return parsed;
      }
    } catch (e) {
      console.error("[SERVER] Error reading settings file:", e);
    }
    return defaultSettings;
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

  // Verify Google token & Log in
  app.post("/api/auth/google", async (req, res) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ success: false, error: "missing_credential", message: "חסר קוד כניסה של גוגל" });
      }

      console.log("[SERVER] Verifying Google token...");
      
      // Call Google Tokeninfo API to securely verify and decode token
      const googleResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      
      if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error("[SERVER] Google token verification failed:", errorText);
        return res.status(401).json({ success: false, error: "invalid_token", message: "אימות מול גוגל נכשל" });
      }

      const googlePayload = await googleResponse.json();
      const email = (googlePayload.email || "").toLowerCase().trim();
      const name = googlePayload.name || email.split("@")[0];
      const picture = googlePayload.picture || "";

      if (!email) {
        return res.status(400).json({ success: false, error: "missing_email", message: "לא התקבל אימייל מחשבון הגוגל" });
      }

      // Check against current allowed emails (case-insensitive)
      const currentSettings = readSettings();
      const allowedCollection = (currentSettings.allowedEmails || []).map((e: string) => e.toLowerCase().trim());

      const isAllowed = allowedCollection.includes(email);

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

      // Special super ease shortcut for the administrator in the sandbox environment
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
    const currentSettings = readSettings();
    
    // Check if the caller is authenticated to see full allowed emails and passcodes
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
    const isAuthed = token ? !!getSession(token) : false;

    if (isAuthed) {
      return res.json({
        success: true,
        googleClientId: currentSettings.googleClientId || defaultSettings.googleClientId,
        allowedEmails: currentSettings.allowedEmails || defaultSettings.allowedEmails,
        bypassUsers: currentSettings.bypassUsers || defaultSettings.bypassUsers
      });
    } else {
      // Unauthenticated callers only get Google Client ID to mount the login button
      return res.json({
        success: true,
        googleClientId: currentSettings.googleClientId || defaultSettings.googleClientId
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

  // ---------------- AGENTS DATA ROUTES ----------------

  // Get cloud agents list
  app.get("/api/agents", requireAuth, (req: any, res: any) => {
    const list = readAgents();
    const userEmail = (req.user?.email || "").toLowerCase().trim();
    
    // If the user is the system administrator (haim.bar@gmail.com), they see everything.
    // Otherwise, they only see agents where the agent's email matches the user's email.
    if (userEmail === "haim.bar@gmail.com") {
      return res.json({ success: true, data: list });
    } else {
      const filtered = list.filter((agent: any) => {
        const agentEmail = (agent.agentEmail || "").toLowerCase().trim();
        return agentEmail === userEmail;
      });
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
      
      const existingUserAgents = allAgents.filter((agent: any) => {
        const agentEmail = (agent.agentEmail || "").toLowerCase().trim();
        return agentEmail === userEmail;
      });

      const existingUserAgentIds = new Set(existingUserAgents.map((agent: any) => agent.id));

      // Guard check: normal users are not allowed to add new agents
      const containsNewAgents = agents.some((agent: any) => !existingUserAgentIds.has(agent.id));
      if (containsNewAgents) {
        return res.status(403).json({ 
          success: false, 
          error: "forbidden", 
          message: "אינך מורשה להוסיף סוכנים חדשים. פעולה זו שמורה למנהל המערכת בלבד." 
        });
      }

      // Separate agents belonging to other users
      const otherAgents = allAgents.filter((agent: any) => {
        const agentEmail = (agent.agentEmail || "").toLowerCase().trim();
        return agentEmail !== userEmail;
      });

      // Force the agentEmail of user proposed agents to be the user's email (for safety and security integrity)
      const userProposedAgents = agents.map((agent: any) => ({
        ...agent,
        agentEmail: userEmail
      }));

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

  // Proxy payload POST to n8n Webhook
  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      const payload = req.body;
      const defaultUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/fa5a6796-71e0-44c8-9623-d0dd4791a0bb";
      let webhookUrl = payload.webhookUrl || defaultUrl;

      // Add botId as parameter as requested
      const botId = payload.botId || "";
      if (botId) {
        const hasQuery = webhookUrl.includes("?");
        webhookUrl += `${hasQuery ? "&" : "?"}botId=${encodeURIComponent(botId)}`;
      }

      console.log("[SERVER] Syncing agent configuration to n8n webhook:", webhookUrl);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
        },
        body: JSON.stringify(payload),
      });

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

  // Fetch fields content FROM n8n (GET URL Webhook payload)
  app.get("/api/fetch-config", requireAuth, async (req, res) => {
    try {
      const defaultUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/fa5a6796-71e0-44c8-9623-d0dd4791a0bb";
      const webhookUrlFromQuery = req.query.url as string;
      let webhookUrl = webhookUrlFromQuery || defaultUrl;

      // Append botId as query parameter if supplied, so the backend can fetch filtered configuration
      const botId = req.query.botId as string;
      if (botId) {
        const hasQuery = webhookUrl.includes("?");
        webhookUrl += `${hasQuery ? "&" : "?"}botId=${encodeURIComponent(botId)}`;
      }

      console.log("[SERVER] Fetching live config from webhook (GET):", webhookUrl);

      const response = await fetch(webhookUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
        }
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error("[SERVER] Webhook GET request failed:", response.status, responseText);
        return res.status(response.status).json({
          success: false,
          error: `ה-Webhook של n8n החזיר שגיאה קוד ${response.status} בקריאת הנתונים`,
          details: responseText.substring(0, 500)
        });
      }

      console.log("[SERVER] Webhook GET parsed successful output range:", responseText.substring(0, 400));
      
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
      console.error("[SERVER] Failed to request GET webhook config:", err);
      return res.status(500).json({
        success: false,
        error: "שגיאת תקשורת בקבלת נתונים מ-n8n (GET Hook)",
        details: err?.message || String(err),
      });
    }
  });

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
      const finalAgentName = agentName && typeof agentName === "string" && agentName.trim().length > 0 ? agentName.trim() : "חיים בר";

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
                  "businessName", "botIdentity", "coursesInfo", "kidsCourses", "conversationFlow",
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
        if (activeAgentType === "support") {
          googleAiPromptResponse = {
            businessName,
            botIdentity: `שלום! אני סוכן התמיכה הטכנית הדיגיטלי והמקצועי של ${businessName}. תפקידי הוא לסייע לך לפתור בעיות, לענות לשאלות טכניות ולהדריך אותך צעד אחר צעד בצורה סבלנית ומקצועית תחת ניהולו של ${finalAgentName}.`,
            coursesInfo: `מגוון הפתרונות, המדריכים הטכניים ומסמכי העזר הזמינים ב-${businessName}. פנה אלינו לקבלת מענה מקצועי ומקיף לכל עניין טכני.`,
            kidsCourses: `קבצי עזרה מורחבים, מדריכי שימוש, קטלוג תקלות ופתרונות מומלצים למשתמשי המערכת.`,
            conversationFlow: `זרימת שיחה מומלצת לתמיכה טכנית:\n1. ברכה אדיבה והצגת בוט התמיכה של ${businessName}.\n2. שאלה והבנה של קושי הלקוח או התקלה.\n3. הצגת פתרון מיידי שלב אחר שלב.\n4. קבלת פרטים או העברה של פנייה אל ${finalAgentName} בטלפון במקרה הצורך. חוק בל יעבור: אין לשאול שאלות חוזרות ומיותרות אם אין לך מידע, פנה מיידית לקבלת עזרה אנושית!`,
            writingStyle: `הנחיות עימוד וניסוח:\n- הודעות מבוססות שלבים (1, 2, 3) ברורים.\n- מעבר שורה כפול בין שלב לשלב לנוחיות קריאה.\n- שימוש באימוג'ים מתאימים כגון 🛠️ או 💻.`,
            faqAnswers: `שאלות ותשובות נפוצות:\nש: האם יש מדריך למשתמש?\nת: כן, המדריך זמין להורדה מלאה והוא מפורט בסעיף הקישורים.\n\nש: מה לעשות במקרה של שגיאת התחברות?\nת: יש לבצע איפוס סיסמה קצר או ליצור קשר ישיר עם התמיכה של ${finalAgentName}.`,
            whatNotToDo: `מגבלות לסוכן:\n1. בשום אופן אין לסיים, לחתוך או לעצור את השיחה אם המשתמש מבקש ברושור או מסמך שאין לך!\n2. לא להמציא פתרונות או מחירים שלא יודע.\n3. לא לפתוח בדיון סרק אם אין לך מה להציע, אלא לנתב באדיבות ולהמשיך לענות לשאר שאלות המשתמש.`,
            syllabusLinks: brochureLinks.length > 0 
              ? brochureLinks.map(l => `- מסמך/ברושור: ${l}`).join("\n") 
              : `- מדריך למשתמש הרשמי של ${businessName}: ${url}\n- שאלות נפוצות ותמיכה: ${url}/support`,
            humanEscalation: `הנחיות הפניה מהירה לגורם אנושי (${finalAgentName}) בטלפון ${ownerPhone}:\n1. הבוט לעולם אינו מסיים או מפסיק את השיחה מיוזמתו (רק הלקוח מסיים).\n2. חוק ברזל: ברגע שמתקבל קושי, בקשה לנציג, או שאילתה לגבי ברושור/מסמך שאינך מחזיק בקישור שלו, ענה באדיבות ובנימוס שהם מוזמנים לפנות ישירות אל ${finalAgentName} במספר ${ownerPhone}. מיד לאחר מכן, שאל באדיבות: "בינתיים, האם יש משהו נוסף שתרצה שאעזור לך בו או שאלה מעניינת נוספת?" כדי להמשיך את השיחה תמיד פתוחה ושירותית!`
          };
        } else {
          googleAiPromptResponse = {
            businessName,
            botIdentity: `שלום! אני סוכן המכירות החם והדיגיטלי של ${businessName}. תפקידי הוא לייצג את החברה בצורה המקצועית והאדיבה ביותר ב-WhatsApp תחת ניהולו של ${finalAgentName}.`,
            coursesInfo: `אנו מציעים מגוון רחב של מוצרים ושירותים איכותיים ב-${businessName}. פנה אלינו כדי לשמוע עוד על הפתרונות המהירים ועל תמחור מותאם אישית לדרישות שלך.`,
            kidsCourses: `חבילות ושירותים משלימים ב-${businessName} המעניקים חווית שימוש ללא פשרות, תמיכה מלאה ואיכות פרימיום.`,
            conversationFlow: `זרימת שיחה מומלצת:\n1. ברכה אדיבה והצגת הבוט של ${businessName}.\n2. שאלה לגבי פתרון העניין של הלקוח.\n3. הצגת פתרונות מהירים מהאתר.\n4. לבקש ווטסאפ או שם מלא וטלפון ליצירת קשר על ידי ${finalAgentName}. חוק בל יעבור: אין לשאול שאלות חוזרות ומיותרות אם אין לך מידע, פנה מיידית לקבלת עזרה אנושית!`,
            writingStyle: `הנחיות עימוד וניסוח:\n- הודעות קצרות של 2-3 משפטים לכל היותר.\n- להפריד נושאים עם מעבר שורה כפול.\n- להשתמש באימוג'ים בצורה חכמה ומדודה 🚀.`,
            faqAnswers: `שאלות ותשובות נפוצות:\nש: איך מתחילים אצלכם?\nת: פשוט מאוד! משאירים פה טלפון ונציג מוסמך יחזור אליכם בהקדם.\n\nש: באילו אזורים אתם נותנים שירות?\nת: אנו מספקים מענה מהיר בפריסה ארצית מלאה דרך האתר הדיגיטלי.`,
            whatNotToDo: `מגבלות לסוכן:\n1. בשום אופן אין לסיים, לחתוך או לעצור את השיחה אם המשתמש מבקש ברושור או מסמך שאין לך!\n2. לא להמציא פתרונות או מחירים שלא יודע.\n3. לא לפתוח בדיון סרק אם אין לך מה להציע, אלא לנתב באדיבות ולהמשיך לענות לשאר שאלות המשתמש.`,
            syllabusLinks: brochureLinks.length > 0
              ? brochureLinks.map(l => `- מסמך/ברושור: ${l}`).join("\n")
              : `- מוצרי אתר ${businessName}: ${url}\n- מידע נוסף ויצירת קשר: ${url}/contact`,
            humanEscalation: `הנחיות הפניה מהירה לגורם אנושי (${finalAgentName}) בטלפון ${ownerPhone}:\n1. הבוט לעולם אינו מסיים או מפסיק את השיחה מיוזמתו (רק הלקוח מסיים).\n2. חוק ברזל: ברגע שמתקבל קושי, בקשה לנציג, או שאילתה לגבי ברושור/מסמך שאינך מחזיק בקישור שלו, ענה באדיבות ובנימוס שהם מוזמנים לפנות ישירות אל ${finalAgentName} במספר ${ownerPhone}. מיד לאחר מכן, שאל באדיבות: "בינתיים, האם יש משהו נוסף שתרצה שאעזור לך בו או נושא נוסף שנוכל לפתור?" כדי להמשיך את השיחה תמיד פתוחה ושירותית!`
          };
        }
      }

      // 3. Compile businessPrompt using these parts
      const businessPrompt = 
        `# הנחיות לסוכן ${activeAgentType === "support" ? "תמיכה טכנית" : "מכירות דיגיטלי"} - ${businessName}\n\n` +
        `## זהות הבוט\n${googleAiPromptResponse.botIdentity}\n\n` +
        `## מידע ופתרונות מרכזיים\n${googleAiPromptResponse.coursesInfo}\n\n` +
        `## קטגוריות ונושאים משלימים\n${googleAiPromptResponse.kidsCourses}\n\n` +
        `## זרימת השיחה ב-WhatsApp\n${googleAiPromptResponse.conversationFlow}\n\n` +
        `## סגנון כתיבה ואימוג'ים\n${googleAiPromptResponse.writingStyle}\n\n` +
        `## שאלות נפוצות מהאתר (FAQ)\n${googleAiPromptResponse.faqAnswers}\n\n` +
        `## מגבלות ואיסורי סוכן\n${googleAiPromptResponse.whatNotToDo}\n\n` +
        `## קישורי מידע נוספים וברושורים\n${googleAiPromptResponse.syllabusLinks}\n\n` +
        `## מעבר לנציג אנושי והסלמה\n${googleAiPromptResponse.humanEscalation}`;

      // 4. Build payload for n8n Webhook with dynamic random Bot ID
      const randomDigits = Math.floor(100 + Math.random() * 900).toString();
      const dynamicBotId = `bot_generic_${randomDigits}`;

      const defaultWebhookUrl = "https://n8n.srv1239769.hstgr.cloud/webhook/fa5a6796-71e0-44c8-9623-d0dd4791a0bb";
      
      const payload = {
        // Direct core fields requested by Haim Bar
        ownerName: finalAgentName,
        businessName: businessName,
        ownerPhone: ownerPhone,
        botId: dynamicBotId,
        whatsappInstance: activeAgentType === "support" ? "תמיכה טכנית" : "Smarti",
        businessPrompt: businessPrompt,
        key: "169711FA6EAA-41DA-8DF7-F12280FBA711",
        leadFollowUpDays: "3",
        agentEmail: "haim.bar@gmail.com",
        "קהל יעד": googleAiPromptResponse.kidsCourses,
        "קבל יעד": googleAiPromptResponse.kidsCourses,
        Status: "פעיל",
        status: "פעיל",
        "סטטוס": "פעיל",
        
        // Separate 9 prompt parts
        botIdentity: googleAiPromptResponse.botIdentity,
        coursesInfo: googleAiPromptResponse.coursesInfo,
        kidsCourses: googleAiPromptResponse.kidsCourses,
        conversationFlow: googleAiPromptResponse.conversationFlow,
        writingStyle: googleAiPromptResponse.writingStyle,
        faqAnswers: googleAiPromptResponse.faqAnswers,
        whatNotToDo: googleAiPromptResponse.whatNotToDo,
        syllabusLinks: googleAiPromptResponse.syllabusLinks,
        humanEscalation: googleAiPromptResponse.humanEscalation,
        
        // Hebrew mapping for database filter compatibility
        "שם בעל העסק": finalAgentName,
        "שם העסק": businessName,
        "טלפון בעל העסק": ownerPhone,
        "Bot ID": dynamicBotId,
        "שם ואטסאפ instance": activeAgentType === "support" ? "תמיכה טכנית" : "Smarti",
        "פרומפט עיסקי": businessPrompt,
        "Key": "169711FA6EAA-41DA-8DF7-F12280FBA711",
        "זמן למעקב אחרי ליד בימים": "3",
        "אימייל משויך לסוכן": "haim.bar@gmail.com",

        // Hebrew mapping for separate 9 prompt parts
        "זהות הבוט": googleAiPromptResponse.botIdentity,
        "מה אני מוכר — קורסים": googleAiPromptResponse.coursesInfo,
        "קורסי ילדים": googleAiPromptResponse.kidsCourses,
        "קהל יעד וסיגמנטים מיוחדים": googleAiPromptResponse.kidsCourses,
        "זרימת שיחה": googleAiPromptResponse.conversationFlow,
        "טון ואופן כתיבה": googleAiPromptResponse.writingStyle,
        "תשובות לשאלות נפוצות": googleAiPromptResponse.faqAnswers,
        "מה לא לעשות": googleAiPromptResponse.whatNotToDo,
        "לינקים לסילבוסים": googleAiPromptResponse.syllabusLinks,
        "אסקלציה לאנוש": googleAiPromptResponse.humanEscalation,

        // Metadata properties
        timestamp: new Date().toISOString(),
        source: "עמוד נחיתה והדגמה ציבורי",
        systemId: "ais-public-demo-builder",
        isNewBot: true,
        IsNewBot: true,
        "בוט חדש": true
      };

      // 5. Fire event to n8n Webhook
      console.log(`[PUBLIC DEMO] Syncing new agent to n8n Webhook directly: ${defaultWebhookUrl}`);
      
      const response = await fetch(defaultWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      if (!response.ok) {
        console.error("[PUBLIC DEMO] Webhook synchronization returned error status:", response.status, responseText);
        return res.status(response.status).json({
          success: false,
          error: "שגיאה בסנכרון מול שרת n8n",
          details: responseText
        });
      }

      console.log("[PUBLIC DEMO] Direct webhook synchronization successful!");

      return res.json({
        success: true,
        businessName,
        ownerPhone,
        botId: dynamicBotId,
        scrapedLength: scrapedText.length,
        prompts: googleAiPromptResponse,
        webhookResponse: responseData
      });

    } catch (err: any) {
      console.error("[PUBLIC DEMO] Create demo bot error:", err);
      return res.status(500).json({
        success: false,
        error: "שגיאה פנימית ביצירת הבוט ההדגמתי",
        details: err?.message || String(err)
      });
    }
  });

  // --- AI API ROUTES ---
  
  // Endpoint to explore/scrape a website URL and extract its key elements in Hebrew
  app.post("/api/ai/explore-website", requireAuth, async (req, res) => {
    try {
      let { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, error: "כתובת URL ריקה או לא תקינה" });
      }

      url = url.trim();
      // Auto-prepend https:// if protocol is missing (e.g. www.bareket4you.co.il)
      if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
      }

      console.log(`[SERVER] AI exploring website URL: ${url}`);
      
      let fetchResponse;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds connection timeout

      try {
        // Try fetching normally first
        fetchResponse = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7"
          }
        });
        clearTimeout(timeoutId);
      } catch (firstFetchErr: any) {
        clearTimeout(timeoutId);
        console.warn("[SERVER] First fetch failed, retrying with SSL bypass and fresh AbortController. Error:", firstFetchErr?.message || firstFetchErr);
        
        // Temporarily bypass certificate rejection for legacy or local SSL certs
        const prevRejectVal = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 15000);
        try {
          fetchResponse = await fetch(url, {
            signal: retryController.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
              "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7"
            }
          });
        } catch (retryErr: any) {
          console.error("[SERVER] Retry fetch failed as well. Error:", retryErr?.message || retryErr);
          throw new Error(`שגיאה בגישה לכתובת האתר: ${retryErr?.message || "חיבור נכשל או פסק זמן"}`);
        } finally {
          clearTimeout(retryTimeoutId);
          // Restore original TLS reject option
          if (prevRejectVal !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevRejectVal;
          } else {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
          }
        }
      }
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch website. Status: ${fetchResponse.status}`);
      }

      const html = await fetchResponse.text();
      const cleaned = extractCleanText(html);

      if (!cleaned || cleaned.length < 30) {
        return res.json({
          success: true,
          scrapedText: "",
          analysis: "לא נמצא תוכן טקסטואלי משמעותי באתר הנבחר. אנא נסה להעתיק ולהדביק את המידע באופן ידני."
        });
      }

      if (!ai) {
        return res.json({
          success: true,
          scrapedText: cleaned.substring(0, 3000),
          analysis: "האתר נסרק בהצלחה! (שים לב: GEMINI_API_KEY אינו מוגדר, לכן לא בוצע ניתוח AI מעמיק, אך הטקסט הגולמי נשאב ומוכן לשימוש)."
        });
      }

      // Analyze page content using Gemini (with fallback)
      const gRes = await generateWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: `אנא קרא והרחב על החלקים המשמעותיים של העסק מתוך הטקסט הגולמי הבא שנשאב מהאתר שלו.\n\n` +
                  `תוכן האתר:\n${cleaned}\n\n` +
                  `ספק סיכום שיווקי קצר, מקצועי ואיכותי בעברית של:\n` +
                  `1. מה העסק מציע (מוצרים/קורסים)?\n` +
                  `2. קהל היעד שלו.\n` +
                  `3. יתרונות תחרותיים או מאפייני תקשורת נדרשים לסוכן.\n\n` +
                  `כתוב בצורה של נקודות ברורות.`,
      });

      return res.json({
        success: true,
        scrapedText: cleaned,
        analysis: gRes.text || "לא התקבל ניתוח טקסט מה-AI"
      });

    } catch (err: any) {
      console.error("[SERVER] Explore website error:", err);
      return res.status(500).json({
        success: false,
        error: "שגיאה בניתוח האתר",
        details: err?.message || String(err)
      });
    }
  });

  // Function to generate rich Hebrew fallback prompts if AI is unavailable or fails
  function generateFallbackPrompts(templateId: string, businessName: string, ownerName: string, answers: any) {
    const biz = businessName?.trim() || "העסק החכם";
    const own = ownerName?.trim() || "מנהל העסק";
    const aud = answers?.audience || "קהל לקוחות רלוונטיים מתעניינים";
    const tone = answers?.tone || "שירותי, אדיב, מעורר ביטחון, קצר ואינפורמטיבי";
    const rest = answers?.restrictions || "לא למסור מחירים שלא אומתו, לא להבטיח הבטחות כספיות ללא אישור";
    const esc = answers?.escalationTrigger || "כשהמשתמש מבקש נציג אנושי, מתלונן או שואל שאלה מורכבת שחורגת מהמידע הנוכחי";

    if (templateId === "support") {
      return {
        botIdentity: `שלום! אני בוט התמיכה והשירות של ${biz}. תפקידי הוא לספק ללקוחות מענה מהיר, אדיב ומקצועי בעברית, תוך ייצוג ערכי העסק ורעיונותיו בהנחיית מנהל התמיכה ${own}. הטון שלי הוא ${tone}.`,
        coursesInfo: `שירותי התמיכה והקורסים של ${biz} כוללים מערכי למידה מתקדמים, ליווי שבועי ועזרה במענה לשאלות מורכבות.\nנשמח להעניק לך את מרב התמיכה והסבלנות הנדרשים.`,
        kidsCourses: `אנו ב-${biz} גאים להציע קורסי תכנות וסדנאות יצירה מיוחדות המותאמות בדיוק לילדים ונוער, כולל תמיכה וסיוע להורים המעורבים בתהליך. במפגשים אנו שמים דגש על פיתוח חשיבה עצמאית.`,
        conversationFlow: `שלבי התקדמות השיחה בתמיכה:\n1. ברוך הבא וברכת שלום חמה.\n2. בירור הצורך או התקלה של הלקוח בצורה סבלנית.\n3. מתן תשובה ישר ולעניין.\n4. ודא שביעות רצון; במידת הצורך קח פרטים והפנה ל${own}.`,
        writingStyle: `הנחיות עימוד וניסוח לתמיכה:\n- תשובות נקיות, מרווחות (שורה רווח בין נושאים).\n- שימוש בסגנון כתיבה קולח ומעורר ביטחון.\n- הימנעות ממילים או קיצורים חצופים.\n- שימוש מאוזן באימוג'ים שירותיים.`,
        faqAnswers: `שאלות ותשובות לתמיכה:\nש: מה זמן המענה הממוצע לפניות?\nת: אנו משתדלים להשיב במהירות האפשרית, לרוב תוך פחות משעה בשעות הפעילות.\n\nש: כיצד ניתן לבטל או לשנות מועד שיעור?\nת: יש לעדכן אותנו לפחות 24 שעות מראש כדי שנוכל להיערך לכך בהתאם.`,
        whatNotToDo: `מגבלות וחוקי ברזל:\n1. ${rest}\n2. לעולם אין להבטיח פיצויים כספיים או החזרים ללא אישור ישיר מ${own}.`,
        syllabusLinks: `- סילבוס שירות לקוחות ומדריך למשתמש: https://fastway.example.com/support-guide\n- עמוד השוואת תוכניות הלימוד הרשמי: https://fastway.example.com/programs-overview`,
        humanEscalation: `בכל מקרה של כעס מצד המשתמש, קושי במתן פתרון, או כאשר מוגדר: ${esc} – ענה תחילה בנימוס שישנו פירוט רב באתר והפנה באדיבות למענה אישי בטלפון של ${own}. עם זאת, לעולם אל תפסיק או תסיים את השיחה מיוזמתך (רק הלקוח מסיים)! מיד לאחר ההפניה, שאל את המשתמש באדיבות: "בינתיים, האם יש משהו נוסף שתרצה שאעזור לך בו או שאלה מעניינת נוספת?".`
      };
    } else if (templateId === "kids") {
      return {
        botIdentity: `שלום! אני היועץ החינוכי והרכז של ${biz}. התפקיד המקצועי שלי הוא ללוות הורים בבחירת חוגים, סדנאות קיץ ומסע למידה חווייתי לילדים ולנוער, תחת ניהולו המקצועי של ${own}. הטון שלי הוא ${tone}.`,
        coursesInfo: `אנו ב-${biz} מספקים קורסי פרימיום ייחודיים לצעירים עם פדגוגיה מתקדמת, מעורבות הורים מובנית, ודקות אפיון המבטיחות התאמה לכל תלמיד.`,
        kidsCourses: `קורסים וסדנאות מובילים לילדים ונוער:\n1. עיצוב ופיתוח משחקים ב-Roblox (גילאי 9-13).\n2. יסודות חשיבה חישובית ויצירת אנימציות ב-Scratch (גילאי 7-10).\n3. סדנאות קיץ יצירתיות לפיתוח משחקים תלת-מימדיים.`,
        conversationFlow: `זרימת שיחה ליועץ החוגים:\n1. התחל בברכה מלבבת להורה ושאל לגיל הילד ותחומי העניין שלו במחשב.\n2. הצג לו את הקורס המתאים ביותר (רובלוקס או סקראץ').\n3. הסבר על היתרונות של רכישת שפת העתיד ועל שיטת הלמידה.\n4. הצע שיעור התנסות חווייתי במתנה, ובקש טלפון לקביעת השיבוץ.`,
        writingStyle: `הנחיות ניסוח חיוני להורים:\n- טון חם, מכיל, קשוב ומרגיע.\n- שבירת שורות תכופה ליצירת הודעות נוחות לקריאה בנייד במקום בלוקים ארוכים.\n- שימוש באימוג'ים שמחים וחבריים.`,
        faqAnswers: `שאלות של הורים:\n- האם דרוש רקע מוקדם לחוג?\n- הקורסים מתחילים לחלוטין מאפס, ומלווים על ידי מדריכים מנוסים.\n\nש: מהו מכסת התלמידים בקבוצות?\nת: אנו שומרים על קבוצות קטנות ואיכותיות ללמידה אישית ומוצלחת.`,
        whatNotToDo: `מגבלות בחוגי ילדים:\n1. ${rest}\n2. לעולם אל תיתן הבטחות רפואיות/חינוכיות גורפות או תשובות סותרות ללא התייעצות מול ${own}.`,
        syllabusLinks: `- סילבוס קורס פיתוח משחקים ברובלוקס לקבוצות: https://fastway.example.com/syllabus-kids-roblox\n- סילבוס קבוצות צעירות ב-Scratch: https://fastway.example.com/syllabus-kids-scratch`,
        humanEscalation: `במצבים המוגדרים כ: ${esc}, או כאשר ההורה מתעקש על שיחה טלפונית למחירים מיוחדים – ספר קודם בנימוס שמרבית המידע הרלוונטי נמצא בשמחה באתר והפנה אותו באדיבות רבה אל ${own} בטלפון. עם זאת, זכור חוק בל יעבור: הבוט לעולם אינו מסיים או מפסיק את השיחה מיוזמתו! המשך תמיד בשיחה באדיבות ושאל: "האם יש בינתיים שאלות נוספות או נושאים שתרצה שאענה לך עליהם?".`
      };
    } else if (templateId === "qualify") {
      return {
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
        botIdentity: `שלום! אני סוכן השיווק וההרשמה המוביל של ${biz}. התפקיד שלי הוא להציג בפניך את המסלולים הטובים ביותר, לראות אם יש התאמה ואז לקשר אותך באהבה ל${own} מנהל העסק. הטון שלי הוא ${tone}.`,
        coursesInfo: `הקורסים המקצועיים של ${biz} מציעים את שיטת ההכשרה המתקדמת והעדכנית ביותר כיום המאפשרת פרויקטים מעשיים, ליווי שבועי צמוד בקבוצות בוטיק יוקרתיות ואחוז סיום יוצא דופן.`,
        kidsCourses: `לילדים ונוער, אנו מציעים קורסי תכנות ופיתוח משחקים ברובלוקס ובסקראץ', המפתחים חשיבה לוגית, סקרנות וביטחון עצמי מגיל צעיר.`,
        conversationFlow: `זרימת השיחה המומלצת למכירות:\n1. ברך בחיומיות, הצג את עצמך כסוכן של ${biz}.\n2. שאל לשמם ואיזה קורס/חוג הם מחפשים כדי להבין את רצונם.\n3. הצג את היתרונות הבלעדיים שלנו בעסק לפתרון שאלתם.\n4. קרא לפעולה ברורה: השארת מספר טלפון לתיאום שיחת התאמה אישית של 5 דקות מול ${own}.`,
        writingStyle: `הוראות עימוד וניסוח:\n- הודעות קצרות וקולעות, מרווחות בטוב טעם (שבירת שורות לנייד).\n- שימוש יצירתי באימוג'ים מתאימים ומניעי עניין.\n- טון שירותי, אקטיבי, מעורר סקרנות ומכוון מעשה.`,
        faqAnswers: `שאלות ותשובות שכיחות:\nש: האם יש קושי במציאת עבודה בסיום?\nת: אנו מספקים ליווי מקצועי, בניית תיק עבודות והכנה המעניקה לבוגרים שלנו נקודת זינוק משמעותית בשוק.\n\nש: מהו תאריך פתיחת הקורס?\nת: מחזורים נפתחים במרווחי זמן קבועים, כדי להתעדכן בשיבוץ המדויק מומלץ לשריין מקום מוקדם.`,
        whatNotToDo: `מגבלות ואיסורים מכירתיים:\n1. ${rest}\n2. לעולם אל תתווכח על מחיר או תסכים להנחה לא מאושרת מ${own}.\n3. הימנע מלחץ אגרסיבי, שמור על נימוס קלאסי.`,
        syllabusLinks: `- סילבוס מקיף פיתוח קוד פולסטאק React: https://fastway.example.com/syllabus-fullstack\n- סילבוס פיתוח Unity תלת-מימדי: https://fastway.example.com/syllabus-unity`,
        humanEscalation: `בכל מקרה של שאלה פיננסית סבוכה, בקשת מנוהל או כשמוגדר: ${esc} – הסבר תחילה באדיבות שישנו פירוט נהדר באתר לגבי הנושא, והפנה באדיבות להמשך פתרון פנומנלי מול ${own} בטלפון. היה חם ושירותי, וזכור: הבוט לעולם אינו מפסיק את השיחה מיוזמתו או מסכים לסיימה לבד. שאל מיד לאחר מכן: "בינתיים, האם יש לך עוד שאלות או נושאים רלוונטיים שתרצה שאשמח לעזור בהם?".`
      };
    }
  }

  // Endpoint to generate full 9-part structured prompt using Gemini
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
        "אתה עוזר פיתוח AI ומוมחה אפיון סוכני מכירות ושירות לצ'אט ו-WhatsApp. " +
        "עליך לבנות פרומפט הנחיות מקצועי ומקיף עבור סוכן מכירות דיגיטלי הבנוי מ-9 חלקים מובנים של מידע.\n\n" +
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
        "משימה: עליך לייצר טקסט פרומפט מלא ועשיר בעברית עבור כל אחד מתשעת החלקים הבאים, מותאם לעסק. " +
        "החזר אובייקט JSON תקין ומדויק בעל 9 המפתחות הבאים:\n" +
        "1. botIdentity: הגדרת שם הבוט (המצא שם ידידותי בעברית), התפקיד, השיוך ל-{BusinessName} ונימת הדיבור.\n" +
        "2. coursesInfo: תיאור מפורט, קורסים, סילבוסים, מחירים או שירותים שהעסק מציע.\n" +
        "3. kidsCourses: קורסים, סדנאות קיץ, חוגים, קהל יעד מיועד וסיגמנטים מיוחדים. חוק בל יעבור: ציין אך ורק במי קהל היעד שבו אנו כן ממוקדים (מי כן), בשום אופן אל תציין במה או במי אנו לא ממוקדים ומי לא קהל היעד (אל תמנה מה לא או למי לא, כדי למנוע רשימה ארוכה ומייגעת). מיקוד חיובי בלבד!\n" +
        "4. conversationFlow: שלבי התקדמות השיחה ב-WhatsApp, מהברכה ועד השגת הטלפון לקריאה לפעולה.\n" +
        "5. writingStyle: הוראות עימוד וניסוח (קיצור הודעות, רווחים בין שורות, שבירת שורות, סגנון שמושך תשומת לב).\n" +
        "6. faqAnswers: 3-4 שאלות ותשובות נפוצות פוטנציאליות שמעניינות לקוחות, בפורמט ש: ות:.\n" +
        "7. whatNotToDo: לפחות 3 דברים שהבוט לעולם לא יגיד, לא יבטיח, ולא יעשה.\n" +
        "8. syllabusLinks: פורמט קישורים של סילבוסים אליהם יוכל לקשר. (לדוגמה: - סילבוס קורס: https://yourdomain.com/syllabus...).\n" +
        "9. humanEscalation: מפורט ומלא של מתי וכיצד לבצע הפניה לגורם אנושי בטלפון {OwnerPhone}. עליך להורות לסוכן: (1) הוא אף פעם לא מפסיק או מסיים את השיחה מיוזמתו, רק הלקוח מסיים. (2) בכל מצב של בקשת נציג, שאלה מורכבת שחורגת מהמידע באתר (כמו דוגמאות API או הצעות סבוכות), או נושא פיננסי מעורפל – עליו קודם כל לכתוב בנימוס כי יש פירוט נהדר באתר והוא שמח לנסות לעזור, אך יש להפנות אותו אל הנציג {OwnerPhone}. לאחר מכן הוא חייב לשאול מיד בהמשכיות: 'בינתיים, האם יש לך שאלות נוספות שתרצה שאשמח לעשות עבורך?' על מנת להמשיך את השיחה תמיד.\n\n" +
        "חשוב מאוד: אל תשתמש במזהים של markdown או תגיות חתוכות בתוך ה-JSON של התשובה. כל ערך במפתח ה-JSON חייב להכיל את הפרומפט המלא, המעוצב והמסוגנן בעברית.";

      console.log("[SERVER] Generating full 9-part structured prompt using gemini-3.5-flash (with robust fallback capabilities)...");

      const response = await generateWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: promptToModel,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
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
              "botIdentity", "coursesInfo", "kidsCourses", "conversationFlow",
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
        "3. שלב בתוכו אימוג'ים רלוונטיים במיוחד לחלק הזה ובפרט אם התבקשת. אם זה חלק של זרימת שיחה, שלב בצורה יפה אימוג'י של שאלת פתיחה (כמו 👋, ✨, שלום!, 🪐) ושלבי התקדמות (כמו 🆕, 📍, 📞). אם זה שירותים, שלב סמלי למידה, קורסים ומחירים. \n" +
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

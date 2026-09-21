# CLAUDE.md — BotApp (app.smartesek.com)

This file is read automatically by Claude Code at the start of a session in this repo. See also `ARCHITECTURE.md`, `TASKS.md`, and `SETUP.md`. **This exploration was shallower than the sibling WhastAppSystem-/CRM docs** — treat anything not explicitly stated here as unverified, and re-check the actual code rather than assuming.

## What this system is

The chatbot management piece of the "עסק חכם" (SmartEsek) product family — lets a business define one or more AI chat **agents** (bot personas with a system prompt, likely per-business or per-purpose), have them handle conversations coming in over WhatsApp/web/Facebook, and view/manage that chat history. Branded "SmartEsek" / "עסק חכם" at `app.smartesek.com`.

Part of a 3-piece ecosystem Haim is building toward treating as one product:
- **WhastAppSystem-** (`whatsapp.smartesek.com`) — bulk WhatsApp campaign sending + unified inbox.
- **CRM** (`crm.smartesek.com`) — lead management.
- **BotApp** (this repo, `app.smartesek.com`) — bot/agent configuration and chat handling.

Existing integration points between this and the other two:
- WhastAppSystem-'s `/api/bot-prompt` proxies into this app's `/api/agents` (get/set an agent's `businessPrompt`) so the bot's prompt can be edited from within WhastAppSystem- without a second login.
- CRM's `/api/bot/sync` receives conversation history — likely originating from this app or from WhastAppSystem-, not yet confirmed which; check `/api/sync` in this repo's `server.ts` (line ~2276) for what it actually pushes and where.

## Deployment: Vercel, like the other projects (used to be Cloud Run)

`server.ts` exports `createApp()` (all /api routes); `api/index.ts` wraps it as one Vercel serverless function and `vercel.json` rewrites `/api/*` to it, exactly like the CRM. Pushing to `main` deploys frontend and backend together. The old Google Cloud Run service is no longer used. Locally (`npm run dev`) or in a container, `startServer()` runs the same app plus Vite/static files. Environment variables (set in Vercel): DATABASE_URL, SSO_SHARED_SECRET, GOOGLE_CLIENT_ID, GEMINI_API_KEY, BOTAPP_SERVICE_KEY, META_APP_ID, META_APP_SECRET, EVOLUTION_API_URL, EVOLUTION_GLOBAL_KEY, optionally ALLOWED_EMAILS / PORTAL_URL.

## Storage: Postgres (database `botapp`), see storage.ts

Settings, agents, chats and login sessions are documents in table `botapp_store` (one row each, with a `tenant_id` column). Reads are synchronous from memory; every request first syncs changed documents from the database (`syncStorage`) and, on Vercel, its response is held until the request's writes are stored (`flushStorage`), so several serverless instances stay consistent. Without DATABASE_URL it falls back to the JSON files in `data/` (local dev only; data is then not durable). Login: Google or the portal's SSO only; sessions are real tokens stored in the database. The old passcode ("bypass") login was removed; the WhatsApp system's prompt proxy signs in through `/api/auth/service-login` with BOTAPP_SERVICE_KEY.

## Auth

Google OAuth (`/api/auth/google`) and the portal's SSO (`/api/auth/sso`); only session tokens issued by the server at login are accepted (`requireAuth`). There is no passcode login any more (`/api/auth/bypass-login` answers 410). `ALLOWED_EMAILS` (comma-separated) and `GOOGLE_CLIENT_ID` env vars can override the stored settings.

## WhatsApp connection: Evolution API, not Meta's official Cloud API

This repo talks to WhatsApp through a **self-hosted Evolution API instance** (`/api/evolution/*` routes — create/recreate instance, QR-code connect, connection state, logout, incoming-webhook receiver at `/api/webhooks/evolution`), an open-source, unofficial WhatsApp bridge — **not** the same Meta Cloud API integration WhastAppSystem- uses. Default API URL in code: `http://72.61.185.147:60486` (same host IP, different port, as the Postgres server configured for the CRM project — Haim appears to run multiple self-hosted services on one VPS at that IP). Don't assume WhastAppSystem-'s Meta-API patterns (template messages, webhook payload shapes, etc.) carry over here — this is a genuinely different WhatsApp integration mechanism with its own quirks.

## n8n integration

`/api/whatsapp/n8n-credentials` exists — n8n (workflow automation) is mentioned as part of this product's toolset in earlier project notes, but the exact data flow through this endpoint wasn't traced during this exploration. Investigate `server.ts` directly before making changes here.

## Known cross-project issue (from earlier WhastAppSystem- work)

While building WhastAppSystem-'s bot-prompt-editing proxy, `/api/auth/bypass-login` returned a 404 in production (via the `app.smartesek.com` custom domain) even though `/api/agents` worked fine — suspected to be an incomplete Vercel-domain-to-Cloud-Run routing/rewrite configuration (a path missing from whatever proxy config sits in front of the actual Cloud Run service), not a bug in this repo's own code. A workaround (`BOTAPP_SESSION_TOKEN`, copying a live session token manually) was used instead of a real fix. If revisiting this, the fix likely belongs in whatever's proxying the custom domain to Cloud Run, not in `server.ts` itself — but this wasn't independently re-verified in this session.

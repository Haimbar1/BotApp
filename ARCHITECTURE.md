# ARCHITECTURE.md — BotApp

**Based on an initial exploration, not the same depth of hands-on work as the sibling WhastAppSystem-/CRM docs.** Treat this as a map to start from, not a fully verified reference — confirm specifics in the actual code before relying on them for anything sensitive (auth, data persistence, the Evolution API integration).

## Stack

- **Frontend**: React 19 + Vite + Tailwind CSS 4, `react-markdown` (bot replies likely render Markdown formatting).
- **Backend**: Express (`server.ts`), one process — no serverless-function split like the sibling projects (no `api/` folder here at all; this deploys as a single Cloud Run container running the whole Express app via `npm start` → `dist/server.cjs`).
- **Storage**: local JSON files under `data/` (`settings.json`, `agents.json`, a chats file, a sessions file), read/written directly with Node's `fs`. No SQL/Redis at all currently — see CLAUDE.md's storage-risk note.
- **Deployment**: Google Cloud Run, provisioned via Google AI Studio (not Vercel — no `vercel.json`). Fronted by a custom domain (`app.smartesek.com`) whose exact proxy configuration in front of Cloud Run wasn't inspected in this session.

## Data model (`src/types.ts`)

- **`AgentConfig`** — a bot persona/configuration: (based on the type's presence, not a full field-by-field read) likely includes a system prompt (referenced elsewhere as `businessPrompt`), a name, and per-agent settings. Re-read this type directly before making agent-related changes — it wasn't fully inventoried in this session.
- **`MessageSourceType`** (`"whatsapp" | "web" | "facebook" | "unknown"`) and **`MessageSourceInfo`** — a conversation/message can originate from any of these channels; this is presumably how a single agent's chat history spans multiple incoming channels (mirroring the multi-channel unification WhastAppSystem-'s `MessagesView.tsx` does, though this repo's own version wasn't compared in detail).

## Backend routes (`server.ts`) — grouped by area

- **Auth**: `/api/auth/google`, `/api/auth/bypass-login`, `/api/auth/logout`, `/api/auth/session`.
- **Settings**: `/api/settings` (GET/POST) — includes `bypassUsers`, `allowedEmails`, `googleClientId` (see CLAUDE.md's Auth section).
- **Agents**: `/api/agents` (GET/POST, `requireAuth`) — the bot persona configs; this is what WhastAppSystem-'s `/api/bot-prompt` proxies into.
- **Uploads**: `/api/upload`.
- **WhatsApp config**: `/api/whatsapp/config` (GET/POST), `/api/whatsapp/meta-token-exchange`, `/api/meta/exchange-code`, `/api/whatsapp/n8n-credentials` — note the naming overlap with Meta's API despite the actual connection being Evolution API-based (see CLAUDE.md) — worth clarifying which of these paths are legacy/unused vs. actually wired to something, before assuming either.
- **Evolution API integration**: `/api/evolution/create-instance`, `/api/evolution/recreate-instance`, `/api/evolution/connect-qr`, `/api/evolution/connection-state`, `/api/evolution/debug`, `/api/evolution/logout`, `/api/webhooks/evolution` (incoming webhook receiver) — all `requireAuth` except the webhook receiver itself (which Evolution API calls directly, not an authenticated user).
- **Chats**: `/api/chats` (GET/POST/DELETE, `requireAuth` on GET/DELETE, POST appears open — likely the endpoint Evolution API's webhook handler or another internal path writes conversation turns to; not fully confirmed).
- **Sync**: `/api/sync` (`requireAuth`) — pushes something (likely agent/business-prompt config) out to another system; this is very likely what WhastAppSystem-'s bot-prompt proxy also calls after writing a new prompt, to make a live bot pick up the change immediately. Confirm by cross-referencing WhastAppSystem-'s `/api/bot-prompt` implementation.
- **Fetch config**: `/api/fetch-config` (GET/POST, `requireAuth`).
- **Public**: `/api/public/bot-config` (no auth — likely what a public-facing embedded chat widget reads), `/api/public/create-demo-bot` (no auth).
- **AI-assisted agent authoring**: `/api/ai/generate-agent-prompt`, `/api/ai/improve-agent-prompt-part` (both `requireAuth`, both presumably calling Gemini, matching the `@google/genai` dependency).
- **Static/SPA fallback**: `app.get("*", ...)` at the end, serving the built frontend for any unmatched route (standard SPA catch-all — this repo doesn't need the sibling projects' Vercel-specific routing workarounds since there's no Vercel here).

## `public/bot-widget.js`

A standalone embeddable script — likely a drop-in chat widget a business can add to their own website, talking to `/api/public/bot-config` and probably a public chat-message endpoint. Not traced in detail in this session.

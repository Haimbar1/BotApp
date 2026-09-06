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

## Deployment is fundamentally different from the sibling projects — no Vercel here

There's no `vercel.json` and no `api/` folder in this repo. `.env.example`'s comments ("AI Studio automatically injects this... with the Cloud Run service URL") confirm this deploys via **Google Cloud Run**, provisioned through Google AI Studio — not Vercel. Don't apply the sibling projects' "add a vercel.json rewrite" instinct here; there's no equivalent routing layer to worry about, but there IS a known history of a Vercel-fronted custom domain (`app.smartesek.com`) not correctly proxying every path through to the actual Cloud Run service (see "Known cross-project issue" below) — if a route works when hit directly against the Cloud Run URL but 404s via the custom domain, that's the likely cause, and it needs fixing on the Vercel-domain/DNS side, not in this repo's code.

## Storage: local JSON files — no database, real production risk

`data/settings.json`, `data/agents.json`, plus a chats file and a sessions file, read/written directly via Node's `fs` module (see `server.ts` around lines 100–350). **This is a genuine, unaddressed production risk**: Cloud Run instances have an ephemeral filesystem — any local file write can be lost on a restart, redeploy, or scale event, exactly the same class of problem already found and partially fixed for the CRM project's database (which moved from "connect via UI button" — ephemeral — to a real `DATABASE_URL` env var). This repo has no equivalent real-database option at all yet; every agent config, chat message, and session currently lives only in these local files. If asked to make data here reliably persistent, this is the root issue to solve (e.g. moving to Postgres/Redis, matching the pattern already established in the sibling projects) — don't assume the existing file-based storage is durable.

`firebase` is a listed dependency but no actual usage was found in `server.ts` or the frontend during this exploration — likely vestigial from the original AI-Studio scaffold. Worth confirming (grep for `firebase`/`Firestore` again) before assuming it's genuinely unused, but don't be surprised if it is.

## Auth

Google OAuth (`/api/auth/google`) plus a bypass-passcode login (`/api/auth/bypass-login`) for accounts in a `bypassUsers` list stored in `settings.json` — the default/seed entry is `haim.bar@gmail.com` with passcode `HaimBarAdmin2026!`. **This exact passcode is shared across all three sibling projects** (WhastAppSystem- and CRM both also have a bypass user with this same passcode) — if it's ever rotated, it likely needs rotating in all three places, not just here. `ALLOWED_EMAILS` (comma-separated) and `GOOGLE_CLIENT_ID` env vars can override `settings.json`'s own config.

## WhatsApp connection: Evolution API, not Meta's official Cloud API

This repo talks to WhatsApp through a **self-hosted Evolution API instance** (`/api/evolution/*` routes — create/recreate instance, QR-code connect, connection state, logout, incoming-webhook receiver at `/api/webhooks/evolution`), an open-source, unofficial WhatsApp bridge — **not** the same Meta Cloud API integration WhastAppSystem- uses. Default API URL in code: `http://72.61.185.147:60486` (same host IP, different port, as the Postgres server configured for the CRM project — Haim appears to run multiple self-hosted services on one VPS at that IP). Don't assume WhastAppSystem-'s Meta-API patterns (template messages, webhook payload shapes, etc.) carry over here — this is a genuinely different WhatsApp integration mechanism with its own quirks.

## n8n integration

`/api/whatsapp/n8n-credentials` exists — n8n (workflow automation) is mentioned as part of this product's toolset in earlier project notes, but the exact data flow through this endpoint wasn't traced during this exploration. Investigate `server.ts` directly before making changes here.

## Known cross-project issue (from earlier WhastAppSystem- work)

While building WhastAppSystem-'s bot-prompt-editing proxy, `/api/auth/bypass-login` returned a 404 in production (via the `app.smartesek.com` custom domain) even though `/api/agents` worked fine — suspected to be an incomplete Vercel-domain-to-Cloud-Run routing/rewrite configuration (a path missing from whatever proxy config sits in front of the actual Cloud Run service), not a bug in this repo's own code. A workaround (`BOTAPP_SESSION_TOKEN`, copying a live session token manually) was used instead of a real fix. If revisiting this, the fix likely belongs in whatever's proxying the custom domain to Cloud Run, not in `server.ts` itself — but this wasn't independently re-verified in this session.

# SETUP.md — BotApp

**Based on an initial exploration** — verify against the actual AI Studio/Cloud Run deployment console before relying on this for a real deploy, since this session didn't have direct access to that dashboard.

## Running locally

```bash
npm install
npm run dev
```

`npm run dev` runs `tsx server.ts` directly (same pattern as the sibling projects — Vite in middleware mode inside the same Express process). Needs a `.env` file — see `.env.example` for the expected variables.

Other scripts:
- `npm run build` — `vite build`, bundles `server.ts` with esbuild into `dist/server.cjs`, **and copies `data/` into `dist/`** (`cp -r data dist/`) — this is the local-JSON-file storage being carried into the build output; on Cloud Run this only seeds the *initial* container image, it does not make the data persist across restarts (see CLAUDE.md/TASKS.md's storage-risk note).
- `npm run start` — runs `dist/server.cjs`.
- `npm run clean` — removes `dist/`.
- `npm run lint` — `tsc --noEmit`. No `preview` script in this repo (unlike the sibling projects).

## Environment variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Powers the AI-assisted agent-prompt features (`/api/ai/generate-agent-prompt`, `/api/ai/improve-agent-prompt-part`). Per `.env.example`'s own comment, AI Studio auto-injects this from its Secrets panel at runtime — may not need manual configuration if deploying through AI Studio's normal flow. |
| `APP_URL` | Self-referential URL (OAuth callbacks, API endpoints) — per `.env.example`, AI Studio auto-injects this with the actual Cloud Run service URL. Don't hardcode a different value unless deploying outside AI Studio's normal flow. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. Overrides whatever's in `settings.json` if set. |
| `ALLOWED_EMAILS` | Comma-separated list of emails allowed to log in via Google — an env-var-level override/addition to `settings.json`'s own `bypassUsers`/allowed-emails config. |
| `EVOLUTION_API_URL` | The self-hosted Evolution API instance's base URL. Falls back to a hardcoded default (`http://72.61.185.147:60486`) if unset — see CLAUDE.md for context on this being a different host/port than, but same IP as, the CRM project's Postgres server. |

## Testing

No automated test suite (same as the sibling projects — this whole 3-project ecosystem is verified manually). `test_func.ts` exists at the repo root but wasn't inspected in this session — check whether it's an actual test file or a scratch/debug script before assuming it's part of a real test flow.

## Deploying

**This deploys via Google Cloud Run, provisioned through Google AI Studio — not Vercel, and not a plain `git push`-triggers-deploy flow like the sibling projects.** The exact deploy mechanism (AI Studio's own deploy button, a GitHub Action, or something else) wasn't confirmed in this session — check the AI Studio project dashboard directly, or ask Haim how he currently triggers a deploy here, before assuming pushing to `main` alone is sufficient (unlike WhastAppSystem- and CRM, where it is).

Before any deploy:
- Run `npm run lint`.
- Given the local-JSON-file storage risk (see TASKS.md), be especially cautious about any change that could trigger a container restart/redeploy mid-session — that's exactly when in-flight data (an agent config edited but not yet reflected in the seed `data/` files that ship with the next build) could be lost.

# TASKS.md — BotApp

Based on an initial exploration (see CLAUDE.md/ARCHITECTURE.md's caveats) plus known history from earlier work in the sibling WhastAppSystem- project. Expect gaps here that a deeper session would fill in.

## Real, unaddressed risk

- **No real database — everything lives in local JSON files on Cloud Run's ephemeral filesystem.** Unlike the sibling CRM project (which had the same class of problem and moved to a real Postgres `DATABASE_URL`), this repo has no equivalent fallback yet. Agent configs, chat history, and sessions can all be lost on a container restart/redeploy/scale event. If Haim reports "my agent settings disappeared" or "chat history keeps vanishing," this is the first thing to check — not assume it's a new bug, this is a standing structural gap.
- **Hardcoded admin passcode** (`HaimBarAdmin2026!`) in the settings/seed data, same value shared across all three sibling projects (WhastAppSystem-, CRM, and this one) — flagged as worth moving to an env var eventually (noted in WhastAppSystem-'s own history too), not yet done anywhere.

## Known cross-project issue, not yet resolved

- `/api/auth/bypass-login` returned 404 via the `app.smartesek.com` custom domain (while `/api/agents` worked fine) during earlier WhastAppSystem- integration work — suspected incomplete routing/proxy config in front of Cloud Run, not this repo's own code. A workaround (`BOTAPP_SESSION_TOKEN` env var in WhastAppSystem-, copying a live session token manually) was used instead of fixing the root cause. Revisit if this integration needs to be made more robust — likely needs access to whatever's proxying the custom domain, which may be outside this repo entirely.

## Areas that need a deeper look before relying on them

- Whether `/api/sync` is genuinely what pushes an updated agent prompt out to a live bot (WhastAppSystem-'s `/api/bot-prompt` proxy calls something after writing a prompt update — confirm it's this endpoint).
- Whether the `/api/whatsapp/*` and `/api/meta/*`-named routes are legacy/unused holdovers from an earlier design that used Meta's API directly, given the actual current WhatsApp connection is via Evolution API — or whether some of them are still live and meaningful.
- The `firebase` dependency's actual usage (or lack thereof) — see CLAUDE.md.
- The full `AgentConfig` shape and how multiple agents map to multiple businesses/tenants (if at all — this repo's multi-tenancy model, if any, wasn't compared against CRM's explicit tenant system).

# Dosk Bot

## Run & Operate

- `PORT=8080 pnpm --filter @workspace/api-server run dev` — run the API and panel locally
- `pnpm run typecheck` — typecheck the workspace
- `pnpm run railway:build` — build the Railway service
- `pnpm run railway:start` — start the combined bot and panel service
- The panel is served at `/api/panel/`; `/` redirects there.
- The bot and panel use one Railway service. The panel is static and served by Express; no separate frontend or database service is required.
- Railway configuration is in `.railway/railway.ts`. Review `railway config plan` before applying changes.
- Set `PANEL_PASSWORD`, `SESSION_SECRET`, and `FB_COOKIES` as Railway service variables. Never put their values in this file or commit them.
- For session updates to survive redeploys, attach a Railway volume at `/data` and set `BOT_DATA_DIR=/data`. Without a volume, Railway's filesystem is ephemeral and `FB_COOKIES` must remain set to bootstrap the bot after restarts.
- Keep one replica. Multiple replicas could create multiple bot sessions.
- Production reads the Messenger session from the volume or the `FB_COOKIES` secret; it does not fall back to the repository's local `cookies.json`.
- `artifacts/api-server/cookies.json` is tracked in the imported repository. If it contains a live session, rotate that session and remove the credential from Git history.

## Stack

- pnpm workspaces, Node.js 20+, TypeScript 5.9
- API: Express 5
- Bot: ws3-fca
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/lib/bot.ts` — bot connection and commands
- `artifacts/api-server/src/routes/` — health, authentication, and bot endpoints
- `artifacts/api-server/public/` — static private control panel

## Architecture decisions

- One Railway service hosts Express, the bot process, and the static panel to avoid separate web and worker services.
- Railway IaC replaces `railway.toml` because Railway has deprecated Config as Code and stops reading existing TOML/JSON files on December 1, 2026.
- The panel's bot endpoints require a signed, HTTP-only session cookie and rate-limited password login.
- Automatic repeating-message commands are disabled; the panel exposes status and a deliberate reconnect action.

## User preferences

- The user wants the bot and panel on Railway without starting many Railway services.

## Gotchas

- Railway's project/environment must be linked before applying `.railway/railway.ts`. Review the plan and confirm it updates the intended service rather than creating a duplicate.
- Railway secrets are configured in Railway, not copied automatically from Replit Secrets.
- The Replit Canvas artifact is a component-preview sandbox, not the bot control panel.

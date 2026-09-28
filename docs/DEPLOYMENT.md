# Deployment

Recommended: **Vercel** (Next.js) + **Neon** (PostgreSQL) + **Resend** (email) + your Walrus Memory account + a Telegram bot.

## 1. Database (Neon)

Why a database as well as Walrus: Walrus Memory holds what Nia remembers about customers (semantic, append-only). Accounts, sessions, catalog, stock, carts, orders, bookings, chat messages and the memory index need exact, updatable, transactional storage — PostgreSQL. Locally that runs on your machine; the live site needs a hosted one.

1. Create a Neon project (neon.tech, or Vercel → **Storage → Create Database → Neon**) → copy the **pooled** connection string (`…-pooler…/neondb?sslmode=require`). Keep it in the repo-root `.env` as `PRODUCTION_DATABASE_URL=` (the local app keeps using `DATABASE_URL`).
2. From your machine, run migrations and (optionally) the demo stores:
   ```bash
   DATABASE_URL="postgres://…" pnpm db:migrate
   DATABASE_URL="postgres://…" SEED_OWNER_EMAIL=you@example.com pnpm db:seed   # optional
   ```
   (PowerShell: `$env:DATABASE_URL="…"; pnpm db:migrate`.) Supabase works the same way (use the transaction pooler URL; prepared statements are already disabled).

## 2. Vercel

1. Import the GitHub repo. **Root Directory:** `apps/web`. Framework: Next.js. Vercel detects pnpm workspaces; install and build run from the repo root automatically.
2. Environment variables (Production + Preview) — see `.env.example`:
   `APP_URL` (your https URL), `DATABASE_URL`, `AUTH_SECRET` (32+ chars), `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL`, `MEMWAL_NAMESPACE_PREFIX=nia`, `RESEND_API_KEY`, `EMAIL_FROM`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_USERNAME`, `NIA_DEMO_MODE=true` (for Judge Mode).
3. Deploy. Check `https://<your-app>/api/health` — database ok, AI configured, Walrus `ok: true` with `network: "mainnet"`.

Chat and webhook routes set `maxDuration = 60` (durable-wait for memory receipts); keep your plan’s function limit ≥ 60 s.

## 3. Email (Resend) — optional

Sign-in works with **Continue with Telegram** alone. Without Resend the email option is hidden on the live site (codes are only printed to the console in development). To offer email sign-in too:

Verify your sending domain in Resend and set `EMAIL_FROM="Nia <login@yourdomain.com>"`. Without it, production sign-in is disabled (codes are only console-logged in development).

## 4. Telegram

A bot delivers updates to **one** place. Once the webhook points at the live site, don't run `pnpm bot:poll` against the same bot — it deletes the webhook and pulls updates to your machine. Use a second bot (@BotFather) with a local `.env` for development.

```bash
APP_URL=https://<your-app> pnpm telegram:webhook -- set
pnpm telegram:webhook -- info
```

Share each shop’s link from **Settings → Telegram** (`https://t.me/<bot>?start=s_<slug>`).

## 5. Go live

Sign in at `/signin?next=/onboarding`, create your business (or use the seeded demo store), add products/services, set delivery/pickup, publish from **Settings → Store status**, and try the flagship flow from **Judge mode**.

## Self-hosting

`pnpm build && pnpm start` (port 3210) behind HTTPS, with the same environment variables. Any PostgreSQL 15+ works.

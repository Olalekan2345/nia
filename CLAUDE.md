# CLAUDE.md — Nia project state

Read this first in a new session. Keep it updated after significant work.

## What this is
Nia: multi-merchant AI shopping & service assistant (web chat + Telegram) with durable per-customer memory on **Walrus Memory (Mainnet)**. Built for Walrus Session 8 “Chatbots That Remember” (deadline 2026-10-09 14:00 UTC). Requirements & judging: `docs/HACKATHON.md`.

**Hard rule from the user:** no mock/offline AI or memory backends in the running app. Real Walrus + real LLM only; test doubles (MemWalMock, MockLanguageModelV4) exist only inside vitest via explicit overrides (`@nia/memory/testing`, `setModelOverrides`). Missing credentials → honest “not configured” UI.

## Layout
- `apps/web` Next.js 16.3 (App Router, Turbopack, React 19.3, Tailwind 4). Dev port **3210** (3000 is taken on the user’s machine). Root `.env` is loaded by `instrumentation-node.ts` (Next doesn’t read the repo-root .env itself).
- `apps/bot` Telegram CLI (`pnpm telegram:webhook -- set|info|delete|profile`, `pnpm bot:poll`).
- `packages/{shared,config,database,memory,commerce,ai,telegram,ui}` — TS source consumed directly (transpilePackages).
- Docs: `README.md`, `docs/*.md`, `brand.md`.

## Commands
`pnpm dev:db` (embedded real Postgres 18, UTF-8, `.data/postgres`, port 54329, db `nia`) · `pnpm db:setup` · `pnpm db:reset` (local only) · `pnpm dev` · `pnpm test` (93 pass, 2 opt-in skipped) · `pnpm test:walrus` · `pnpm test:ai` · `pnpm test:e2e` (own server on port 3310 with NIA_E2E=1, own build dir `.next-e2e`, own database `<dev db>_e2e` prepared by `pnpm db:e2e` — runs beside `pnpm dev` and never touches dev data) · `pnpm lint` · `pnpm typecheck` · `pnpm build`.

## Key decisions
- AI SDK **v7** (`ai@7`, `@ai-sdk/react@4`): `streamText` + `createUIMessageStream` data parts (`data-recall`, `data-memory`, `data-notice`); `stepCountIs`; tools close over a server-built scope. Tool input schemas avoid `format`/`pattern` (Gemini compatibility) and validate ids inside.
- MemWal SDK **0.1.8** pinned; needs `@mysten/seal` + `@mysten/sui` peers. Async `remember` + status polling (durable wait) → receipts flip to stored only when job `done`. Idempotency key per record. Logical forgetting (no per-memory delete). Recall joins hits to `memory_records` by blob id (drops forgotten, flags superseded).
- PostgreSQL holds operational truth + memory *metadata* (label is UI-only, never sent to the model). Model sees only Walrus-recalled text.
- Chat conversation id is minted by the server page and used as the useChat `id`; `/api/chat` creates the conversation with that id on first message.
- Auth: **Continue with Telegram** (primary; bot-confirmed with number matching — `packages/commerce/src/telegram-login.ts`, `/api/auth/telegram`) or email OTP (hashed; Resend in prod, console codes in dev; `/api/dev/last-code` only with `NIA_E2E=1`). Users: `email` and/or `telegram_user_id` (check constraint). A Telegram-connected account is one customer on web + bot at every shop (`resolveWebCustomer` adopts/merges the Telegram customer; `resolveTelegramCustomer` resolves the account's customer). Bot continues the customer's latest conversation (12 h, any channel); web chat has "Continue in Telegram" (`/start c_<id>`). `/logout` revokes all sessions. Local bot: `pnpm bot:poll` alongside `pnpm dev` (bot is @nia_walbot).
- Order placement/booking confirmation are explicit customer actions (server actions / Telegram callbacks), never model tools.
- LLM: **Groq + `qwen/qwen3.8-27b`** (Alibaba → “Beyond the Big Two”). `llama-3.3-70b-versatile` is NOT available on the user's Groq key (list models via `GET https://api.groq.com/openai/v1/models`). `callSettings()` in `packages/ai/src/provider.ts` sets Groq retries and JSON-schema structured output for qwen3/gpt-oss. Free tier = 8K tokens/min; a turn is ~4.5–5.5K (chat + extraction), so back-to-back messages wait on 429 retries. Dev server logs `[ai] chat/extraction … tokens`.
- Per-turn tool selection (`selectTools`): memory-search tools only when pre-turn recall found nothing; forget tool only on an explicit forget request (`isForgetRequest`); booking/cart-edit tools only with booking/order context. Corrections must never use forget (supersession keeps history).
- **Walrus relayer limit: 60 weighted requests/min per delegate key, 60 s lockout on 429.** Status checks are batched (`getRememberBulkStatus`) and claimed via `walrus_jobs.last_checked_at` (`MEMWAL_STATUS_MIN_INTERVAL_MS`, default 5 s); 429 → process-wide cooldown, never retried. Web chat closes the stream once receipts are pending; durable confirmation runs in `after()`; `refreshPending` settles leftover pending jobs at the start of each turn. The Walrus store is cached on `globalThis` → restart `pnpm dev` after changing `store.ts`.
- Extraction: `normalizeCandidateType` re-types preference subjects mislabeled PAST_ORDER; `isRecallOnlyQuestion` skips extraction for “What do I normally like?”-style questions.

## Status (2026-09-28)
Verified with real credentials (2026-09-28): `pnpm walrus:health` (mainnet), `pnpm test:walrus`, `pnpm test:ai` (Qwen extraction), and the flagship browser flow on Mainnet + Groq: preferences → 3 stored receipts → new chat recall → Yaba correction (supersedes, keeps Lekki as history) → new chat answers “Lekki before, Yaba now” → Memory Passport.
Finished & verified locally: landing; storefront (home, shop, product, chat, orders/cart, profile + Memory Passport + Telegram connect, sign-in); chat streaming with cards/receipts/recall chips; dashboard (overview, conversations, customers + detail + owner restore, catalog editors, orders + detail + transitions, bookings, memory explorer with relayer counts, settings incl. knowledge/Telegram/team, judge mode with before/after); onboarding; Telegram webhook + bot CLI; Paystack webhook; health endpoint; docs.
Verified: 93 unit/integration tests, lint, typecheck (10 packages), `next build`, Playwright critical path (merchant onboarding → product → publish → customer order → cross-tenant 404 → merchant confirm).

**Not yet verified with real credentials:** Telegram bot live (no token yet), Resend emails, deployment, `pnpm test:e2e` memory spec (Playwright doesn't load `.env`; export the keys first).

## Next steps
1. User: Telegram bot token (@BotFather) + Resend key when ready; consider Groq Developer tier before real users.
2. Deploy (docs/DEPLOYMENT.md): Vercel root `apps/web`, Neon, env vars (incl. `AUTH_SECRET`), `pnpm telegram:webhook -- set`.
3. Real users (≥3 × ≥10 memories), screenshots, article (docs/ARTICLE_DRAFT.md), X post, feedback form.

## Known issues / notes
- Local dev: earlier local test data was reset with `pnpm db:reset`; e2e runs create test shops (“E2E Linen …”) in the local DB.
- Rate limits are Postgres fixed windows (fine for one region).
- Chat image upload not implemented.
- Observed order patterns (colour/size chosen in 2+ orders) are stored as "Observed from orders" memories after each confirmed order.
- Recall is skipped for namespaces with no stored records (memoryPresence in orchestrator) to save relayer calls.

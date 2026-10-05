# Nia — the shop assistant who remembers your customers

Nia is an AI shopping and service assistant for independent businesses. It sells products, books services, handles custom orders and repeat purchases — and it **remembers each customer** across conversations, devices and channels (web chat + Telegram) using **[Walrus Memory](https://memory.walrus.xyz)** on Mainnet.

> Customer: “I need the same 6 yards I bought last time, but blue.”
> Nia: “Your last fabric order was 6 yards of emerald Ankara. I can keep the same quantity, but switch to blue. Delivery to Lekki again?”

<p align="center"><img src="apps/web/public/brand/nia-art-640.webp" width="320" alt="Nia, the walrus shop assistant, winking and waving"></p>

- **For merchants** — fashion & fabric sellers, salons, bakeries, repair shops, electronics, homeware… anyone who sells products *or* services and has returning customers.
- **For their customers** — a warm assistant that knows your size, your usual delivery area and what you bought last time, and lets you see, correct or forget any of it.

## What makes it different

| Plain catalog bot | Nia |
|---|---|
| Forgets you when the tab closes | Durable, per-customer memory on Walrus, recalled semantically every turn |
| “Same as last time?” → “What did you order?” | Resolves repeat intent from real order history + memory, asks when ambiguous |
| Treats one purchase as a preference | Scores every candidate memory; inferred preferences need the customer’s consent |
| Overwrites facts | Corrections supersede but keep history (“Yaba now — you previously used Lekki”) |
| One channel | Sign in with Telegram: web and the bot are one customer — same memory, cart and conversation |
| Memory is invisible | Receipts with real blob IDs, a Memory Passport, “why Nia said this”, and “what do you remember about me?” in chat (Confirmed / Observed / Likely) |
| “Here are laptops” | Understands the goal (budget, use case, who it’s for, must-haves vs nice-to-haves), explains picks from real specs, builds baskets within a budget with exact totals, offers real alternatives when something is out of stock |

## Features

- **Walrus Market (`/market`):** every live shop in one place — search and filter across shops, “Picked for you” from the shopper’s market memory, side-by-side **compare**, and **Nia as a shopping guide** who asks one quick decision question at a time (tap-to-answer buttons). Each answer is stored on Walrus in the shopper’s own market namespace, separate from every shop’s memory. Buying happens in the shop the shopper picks.
- **Commerce agent ([docs/COMMERCE_AGENT.md](docs/COMMERCE_AGENT.md)):** goal-aware search with hard vs soft constraints and factual “why” reasons; **baskets** for parties, outfits, set-ups, meal plans and shopping lists (deterministic planner, budget-fitting, per-shop totals, stable “make the shoes cheaper” edits, **Add all to cart**); real **substitutions**; spec-level **comparison** that says “Not listed” instead of guessing; shortlist and list in a per-conversation **shopping session** (separate from long-term memory); **unfinished shopping** resumed on request; “book the same as last time” for services; recorded **price history**; the market guide on **Telegram** with baskets and per-shop checkout.
- **One cart across every shop (`/market/cart`):** add from any shop (market cards, product pages, Nia's baskets); a cart icon with the count in every header; each shop's items, delivery or pickup and total in one place, a grand total, and **Confirm all** (one order per shop, each with that shop's real payment instructions). `/cart` on Telegram.
- **Demo checkout (demo shops only):** no waiting for an owner. "Pay ₦… (demo)" confirms a clearly labelled simulated payment in a few seconds (no real money moves), Nia pops up dancing to say the order is ready for pickup or on its way (with the shop's delivery estimate), and the order — with the decisions behind it — is saved to Walrus Memory right then. "My delivery hasn't arrived" gets the real status and, once overdue, the shop's written replacement policy. Real shops keep their own confirmation and payment. Details: [docs/COMMERCE_AGENT.md](docs/COMMERCE_AGENT.md#demo-checkout).
- **Customer storefront (mobile-first):** home with personal quick actions, shop + search, product pages, **chat** (streaming, product/service/booking/cart cards, memory chips), cart & orders, profile with **Memory Passport** and **Connect Telegram**. Sign-in: **Continue with Telegram** (bot-confirmed, number matching) or an email code.
- **Memory:** typed memory model (19 types), schema-validated extraction, application-owned policy (ignore / ephemeral / ask first / durable), dedup, corrections with temporal history, provenance, logical forgetting, durable-wait receipts, order & booking history memories, merchant knowledge + operations memory.
- **Commerce:** products, variants, services, appointments, custom orders, packages; cart; order state machine; bookings with slot computation in the shop’s time zone; stock reservation; payment provider abstraction (merchant-confirmed, payment link, Paystack with signed webhook).
- **Telegram bot:** webhook with secret-token verification and update dedup, native inline keyboards, typing indicator, product/service cards, web sign-in approval with number matching, continue-the-web-conversation, `/logout` (sign out everywhere), `/last`, `/memory`, repeat-order buttons.
- **Merchant dashboard:** overview (only real metrics), conversations, customers (with memory), catalog editors with **photo upload** (resized and stripped of metadata on the server), orders & bookings workflows, **Walrus memory explorer** (health, blob IDs, per-customer counts cross-checked with the relayer), settings, team roles (OWNER/ADMIN/STAFF), onboarding wizard.
- **Judge Mode:** proof panel (agent ID, blob count, customers with 10+ memories) and a genuine side-by-side **memory OFF vs ON** comparison.

## Architecture

```
Customer web chat ─┐                     ┌─ Walrus Memory relayer (Mainnet) ── Walrus
                   ├─ Nia orchestrator ──┤     remember / recall / restore (SEAL-encrypted)
Telegram bot ──────┘   (Next.js server)  ├─ PostgreSQL: catalog, prices, stock, orders,
                                         │   bookings, identities, memory *metadata*
                                         └─ LLM (Qwen on Groq / Gemini / Mistral / DeepSeek)
```

**Rule:** operational truth (prices, stock, orders, bookings) lives in PostgreSQL; long-term conversational memory lives on Walrus. The model only ever sees memory text that came back from a Walrus recall in that request. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
apps/web        Next.js 16 app — storefront, chat API, dashboard, Telegram + Paystack webhooks
apps/bot        Telegram CLI: webhook set/info/delete, local long-polling forwarder
packages/memory Walrus Memory integration: namespaces, store adapter, extraction schema, policy, recall, receipts
packages/ai     Provider abstraction, prompts, typed tools, extraction, orchestrator, confirm services
packages/commerce  Catalog search, cart/orders, bookings/slots, customers & identity linking, payments, metrics
packages/telegram  Bot API client, webhook processing, native cards
packages/database  Drizzle schema, migrations, local Postgres, seed/demo catalogs
packages/shared, config, ui   Domain types, env config, design primitives + mascot
```

## Quick start (local)

Requirements: Node 20.9+, pnpm 9.

```bash
pnpm install
cp .env.example .env          # then fill in the keys below
pnpm dev:db                   # terminal 1 — zero-install local PostgreSQL (real Postgres via embedded-postgres)
pnpm db:setup                 # migrations + fictional demo stores
pnpm dev                      # terminal 2 — http://localhost:3210
```

Keys you need in `.env` (full list in [.env.example](.env.example)):

| Variable | Where to get it |
|---|---|
| `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID` | [memory.walrus.xyz](https://memory.walrus.xyz) → create account → add a **delegate** key |
| `AI_PROVIDER=groq`, `AI_MODEL=qwen/qwen3.8-27b`, `AI_API_KEY` | [Groq console](https://console.groq.com/keys) (or Google AI Studio / Mistral / DeepSeek / any OpenAI-compatible endpoint) |
| Optional backup: `AI_FALLBACK_PROVIDER=google`, `AI_FALLBACK_MODEL=gemini-3.5-flash-lite`, `AI_FALLBACK_API_KEY` | A free [Google AI Studio](https://aistudio.google.com) key. Any request the main model refuses (daily limit, overload, outage, a broken tool call) goes to the backup, so customers get an answer instead of "try again later". Empty key = no backup. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | @BotFather — enables **Continue with Telegram** sign-in and the bot (without it, sign-in is email-only) |
| `RESEND_API_KEY`, `EMAIL_FROM` | [resend.com](https://resend.com) — required in production for sign-in codes. Locally, codes print in the dev server console. |
| `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` | Local defaults in `.env.example`; production: Neon/Supabase + 32-char secret |

Verify the Walrus connection (prints no secrets):

```bash
pnpm walrus:health
pnpm test:walrus   # opt-in: writes one memory to Mainnet, recalls it semantically, prints the blob ID
pnpm test:ai       # opt-in: runs real memory extraction with your model
```

Or open `http://localhost:3210/market`, tap **Help me choose** and answer Nia’s questions — then open **Your market profile** to see each answer stored on Walrus.

Then open `http://localhost:3210`, tap **Sign in & shop with Nia** (you land in Walrus Market), open a demo shop (fabric, salon or bakery), and tell Nia “I normally buy Medium, I like darker colours, and I usually want delivery around Lekki.”

Set `SEED_OWNER_EMAIL` before `pnpm db:seed` to own the demo stores (their dashboards and Judge Mode).

### Telegram locally

```bash
pnpm bot:poll      # long-polls Telegram and forwards updates to http://localhost:3210/api/telegram/webhook
```

In production use a real HTTPS webhook: `pnpm telegram:webhook -- set`. See [docs/TELEGRAM.md](docs/TELEGRAM.md).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Web app (port 3210) |
| `pnpm dev:db` | Local PostgreSQL 18 (data in `.data/postgres`) |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:setup` / `db:reset` | Drizzle migrations, demo seed, local reset |
| `pnpm test` | Unit + integration tests (in-memory Postgres, SDK test doubles only inside tests) |
| `pnpm test:walrus` / `pnpm test:ai` | Opt-in real Walrus Mainnet / real model tests |
| `pnpm test:e2e` | Playwright (critical path; live-memory test runs when keys are set) |
| `pnpm typecheck` / `pnpm lint` | TypeScript strict + ESLint |
| `pnpm walrus:health` / `pnpm walrus:restore -- <namespace>` | Relayer health; admin re-index utility |
| `pnpm telegram:webhook -- set|info|delete|profile` / `pnpm bot:poll` | Telegram helpers |
| `pnpm brand:icons` | Build the mascot, icons, favicon, Telegram avatar and social card from `brand/nia-mascot.*` |
| `pnpm brand:landing` | Build the landing page scene artwork from `brand/landing/` (mapping in `scripts/landing-assets.ts`) |

## Tests

`pnpm test` — 159 tests: commerce agent (basket totals, budget fitting and stable edits, honest gaps, substitutions, spec comparison with “not listed”, hard vs soft constraints, shopping session and shortlist isolation, unfinished shopping, memory card per customer, repeat bookings, price history, the market guide on Telegram with per-shop carts), the expanded catalog and Nia’s search tool for everyday queries, Walrus Market search/compare across shops, decision answers → memories, Telegram sign-in (number matching, expiry, single use, browser binding), one customer across web and Telegram (adopt/merge), cross-channel conversation continuity, sign-out everywhere, namespace derivation, tenant/customer isolation, dedup, corrections & temporal history, forgetting & IDOR, consent flow, write budget, failure/retry, structured extraction validation, policy decisions, Walrus rate-limit budget (batched/shared status checks, 429 cooldown), tool selection, recall query building, repeat-order resolution (none/single/ambiguous), catalog filtering & non-hallucination, unknown-stock labelling, cart/orders/stock reservation, bookings & capacity & time zones, Paystack signatures, Telegram secret verification & update dedup & linking & token expiry/reuse, prompt-injection neutralisation, sensitive-data redaction, and the full flagship scenario (web → correction → Telegram) at the service level.

`pnpm test:e2e` (own `<db>_e2e` database, so test shops never appear in your dev data) — landing, demo shop picker across business types, demo store search, Walrus Market (browse, search, compare), health endpoint secrecy, CSRF rejection, webhook secret rejection, and merchant onboarding → product → publish → customer order → cross-tenant 404 → merchant confirmation.

## Security & privacy

Delegate key, bot token and API keys are server-only. Namespaces are derived on the server from opaque UUIDs (never emails/phones). Every dashboard route checks membership (404 for non-members); every customer action is scoped to the signed-in customer. Sign-in codes and session tokens are stored hashed. Passwords, card numbers, CVVs, codes, keys and seed phrases are redacted before the model and never stored as memory. Details: [docs/SECURITY.md](docs/SECURITY.md).

## Limitations (honest)

- Walrus Memory has no per-memory delete in SDK 0.1.8; “forget” is logical exclusion (see [docs/WALRUS.md](docs/WALRUS.md)).
- The Walrus relayer allows **60 weighted requests/min per delegate key**, shared by all customers of a deployment. Nia batches and shares job-status checks, skips recall for empty namespaces, and backs off for the relayer’s `retry_after` on a 429 (recall then shows an honest “recall failed” chip). Heavier traffic needs a higher relayer quota.
- On Groq’s free tier (7,000 input tokens/min), one Nia turn uses ~4,000–5,500 tokens, so a second message within a minute waits for the limit to reset (Nia shows a friendly “try again in N seconds”). Use the paid Developer tier for real users.
- App rate limits are Postgres fixed windows — good enough for one region; use Redis for high scale.
- Image upload in chat and photo search are not implemented (the configured model is text-only; `visionCapability()` keeps it honestly off). Merchants upload product photos in the dashboard (or paste an https link).
- There are no customer reviews or ratings in the data model, so Nia never shows or summarises any. Price history is recorded from the first product save onward; price-drop alerts are not implemented.
- Demo products use free stock photos (Burst and CC0 photos via Openverse, credits in `apps/web/public/stock/credits.json`), marked “Illustrative photo” on product pages. Products without a good match show generated category artwork.
- Paystack is the only built-in card provider; others plug into the payment abstraction.

## Docs

[Architecture](docs/ARCHITECTURE.md) · [Commerce agent](docs/COMMERCE_AGENT.md) · [Walrus Memory](docs/WALRUS.md) · [Memory model](docs/MEMORY_MODEL.md) · [Telegram](docs/TELEGRAM.md) · [Security](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md)

Demo stores (Adire Lane, Glow Theory Studio, Crumb & Co.) are fictional businesses for trying Nia.

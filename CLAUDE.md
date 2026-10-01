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
`pnpm dev:db` (embedded real Postgres 18, UTF-8, `.data/postgres`, port 54329, db `nia`) · `pnpm db:setup` · `pnpm db:reset` (local only) · `pnpm dev` · `pnpm test` (170 pass, 2 opt-in skipped) · `pnpm market:images` (catalog photo import, see catalog section) · `pnpm test:walrus` · `pnpm test:ai` · `pnpm test:e2e` (own server on port 3310 with NIA_E2E=1, own build dir `.next-e2e`, own database `<dev db>_e2e` prepared by `pnpm db:e2e` — runs beside `pnpm dev` and never touches dev data) · `pnpm lint` · `pnpm typecheck` · `pnpm build`.

## Key decisions
- AI SDK **v7** (`ai@7`, `@ai-sdk/react@4`): `streamText` + `createUIMessageStream` data parts (`data-recall`, `data-memory`, `data-notice`); `stepCountIs`; tools close over a server-built scope. Tool input schemas avoid `format`/`pattern` (Gemini compatibility) and validate ids inside.
- MemWal SDK **0.1.8** pinned; needs `@mysten/seal` + `@mysten/sui` peers. Async `remember` + status polling (durable wait) → receipts flip to stored only when job `done`. Idempotency key per record. Logical forgetting (no per-memory delete). Recall joins hits to `memory_records` by blob id (drops forgotten, flags superseded).
- PostgreSQL holds operational truth + memory *metadata* (label is UI-only, never sent to the model). Model sees only Walrus-recalled text.
- Chat conversation id is minted by the server page and used as the useChat `id`; `/api/chat` creates the conversation with that id on first message.
- Auth: **Continue with Telegram** (primary; bot-confirmed with number matching — `packages/commerce/src/telegram-login.ts`, `/api/auth/telegram`) or email OTP (hashed; Resend in prod, console codes in dev; `/api/dev/last-code` only with `NIA_E2E=1`). Users: `email` and/or `telegram_user_id` (check constraint). A Telegram-connected account is one customer on web + bot at every shop (`resolveWebCustomer` adopts/merges the Telegram customer; `resolveTelegramCustomer` resolves the account's customer). Bot continues the customer's latest conversation (12 h, any channel); web chat has "Continue in Telegram" (`/start c_<id>`). `/logout` revokes all sessions. Local bot: `pnpm bot:poll` alongside `pnpm dev` (bot is @nia_walbot).
- Order placement/booking confirmation are explicit customer actions (server actions / Telegram callbacks), never model tools.
- LLM: **Groq + `qwen/qwen3.8-27b`** (Alibaba → “Beyond the Big Two”). `llama-3.3-70b-versatile` is NOT available on the user's Groq key (list models via `GET https://api.groq.com/openai/v1/models`). `callSettings()` in `packages/ai/src/provider.ts` sets Groq retries and JSON-schema structured output for qwen3/gpt-oss. Free tier = 8K tokens/min; a turn is ~4.5–5.5K (chat + extraction), so back-to-back messages wait on 429 retries. Dev server logs `[ai] chat/extraction … tokens`.
- Token budget (2026-10-01): tools get a compact model view via `withCompactOutputs` (`packages/ai/src/model-output.ts`, AI SDK `toModelOutput`) — UI cards and Telegram still get the full result; prompts and tool descriptions were condensed. A market search reply ≈ 5.2K input tokens over 2 steps (was ~8–9K). `planBasket` (largest schema) is offered only on `PLAN_TALK`, or `BASKET_EDIT_TALK` when a basket exists. `aiBusyMessage` reads Groq's "try again in …" and says "today's usage limit" for TPD/RPD. Groq TPD is user-capped at 170K. Seen once live: Qwen wrote a tool call as plain text (`<function=…>`) — no guard yet.
- Per-turn tool selection (`selectTools`): memory-search tools only when pre-turn recall found nothing; forget tool only on an explicit forget request (`isForgetRequest`); booking/cart-edit tools only with booking/order context. Corrections must never use forget (supersession keeps history).
- **Walrus relayer limit: 60 weighted requests/min per delegate key, 60 s lockout on 429.** Status checks are batched (`getRememberBulkStatus`) and claimed via `walrus_jobs.last_checked_at` (`MEMWAL_STATUS_MIN_INTERVAL_MS`, default 5 s); 429 → process-wide cooldown, never retried. Web chat closes the stream once receipts are pending; durable confirmation runs in `after()`; `refreshPending` settles leftover pending jobs at the start of each turn. The Walrus store is cached on `globalThis` → restart `pnpm dev` after changing `store.ts`.
- Extraction: `normalizeCandidateType` re-types preference subjects mislabeled PAST_ORDER; `isRecallOnlyQuestion` skips extraction for “What do I normally like?”-style questions.

## Walrus Market (2026-09-28)
- `/market` (+ `/market/nia`, `/market/compare`, `/market/profile`, `/market/signin`): cross-shop discovery. One merchant row with `kind = "market"` (slug `market`, created by the seed) owns the guide's per-shopper memory namespace; shops are `kind = "shop"`. `/s/market` redirects to `/market`.
- Guide tools (`packages/ai/src/market-tools.ts`): searchMarket / searchMarketServices (≤3 searches per reply, duplicates refused), compareProducts, askDecision (chips). Tool output is trimmed to keep turns under Groq's free-tier 7K input tokens/min. Every reply's last step is forced to text (`answerOnLastStep`, `MAX_STEPS`).
- Decision memory (`packages/ai/src/decisions.ts`): asked questions are appended to the stored assistant text ("Nia asked: …"); a tapped option becomes a memory directly (no model call); typed answers go to extraction with the question as context. Policy keeps OCCASION/RELATIONSHIP_CONTEXT even when tagged this_order_only.
- Photos: dashboard upload → `/api/media` (sharp, ≤1600px JPEG, bytea in `media` table, migration 0003). Demo stock photos (Burst) in `apps/web/public/stock` with credits.json; the seed backfills empty image lists.
- Live-verified locally (real Groq + Walrus Mainnet): 3 decision answers stored and shown on the market profile + "For you".
- **Deployed 2026-09-28** (commit b24f38a): migration 0003 + seed applied to Neon (market row, stock photos on 12/14 demo products); https://nia-pearl.vercel.app/market live.

## Landing page (2026-09-28)
- `apps/web/app/page.tsx` composes `components/landing/*` (one file per scene). Forced light tokens via `.nia-light`; the hero entrance/float are CSS (`.nia-in`, `.nia-float`) so they run before hydration; everything else uses `motion` (LazyMotion + `m`, MotionConfig reducedMotion="user"). No GSAP.
- Sticky scroll scenes (problem, memory, web→Telegram) are desktop-only; mobile gets stacked versions; reduced motion gets the finished composition (`still`). **Map scroll progress with `useRange`** (a function transform): motion's accelerated scroll timelines mis-map opacity inside sticky scenes. Use `usePrefersReducedMotion` (hydration-safe), not motion's `useReducedMotion`.
- Artwork: `brand/landing/` → `pnpm brand:landing` → `public/landing/nia-<scene>.webp`, rendered with `<SceneArt>`. Only the hero is `priority`.
- Telegram section: `telegram-orbit-experience.tsx` — real CSS 3D (perspective + preserve-3d, so cards genuinely pass behind the phone). Data-driven `ORBIT` list (10 desktop / 8 tablet / 4 mobile by stage width), one clock that ticks only near the viewport, desktop-only pointer lean (±3°), slow turntable of the whole scene, still composition for reduced motion. Keep large tilted planes (e.g. orbit guide rings) OUT of the preserve-3d scene and keep cards opaque — browsers mis-sort/blend them against the phone. Product objects are feathered crops from the mascot art (`OBJECTS` in `scripts/landing-assets.ts` → `public/landing/orbit-*.webp`).
- Examples are labelled "Example" / "Sample data"; the only live values are real links (the t.me bot via `botLink()`, GitHub docs).

## Walrus Market catalog expansion (2026-09-30)
**Baseline before:** 3 demo shops (Adire Lane 8 products + 2 services, Glow Theory Studio 3 + 4, Crumb & Co. 3), 14 market products, 18 Burst photos; 108 unit tests, 17/17 Playwright.

**Deployed 2026-09-30** (commits 10a14c0 + 692b05e; Neon seeded: +194 products, 8 shops). Live checks at 1440/390: 200s, 0 overflow, 0 broken images, no page errors.

**Now: 208 products (634 variants) + 6 services in 8 demo shops, 7 departments.** No schema change: products still belong to a merchant; departments group shops by `merchants.businessType` (`drinks` added to `BUSINESS_TYPES`, plain text column). Carts/orders stay per shop.
- Departments (`packages/shared/src/market-departments.ts`): Walrus Gadgets 37 (`walrus-gadgets`, electronics) · Walrus Clothes & Designers 50 (`walrus-designers` 42 + Adire Lane 8) · Food 35 (`walrus-kitchen`) · Drinks & Beverages 24 (`walrus-drinks`, non-alcoholic, test-enforced) · Cakes & Bakery 19 (Crumb & Co.) · Beauty 20 (Glow Theory Studio) · Home & Lifestyle 23 (`walrus-home`). Collection **Phones & Laptops** (`?col=phones-laptops`: 8 phones, 6 laptops, 2 tablets). All brands fictional (Arc, Tusk, Floe, Slate…), NGN demo prices, stable slugs + SKUs (`withSkus`, e.g. `WG-PHO-001`).
- Catalog data: `packages/database/src/catalog/{kit,gadgets,designers,kitchen,drinks,home,more}.ts` (`more.ts` = extra bakery + beauty items appended to the original templates). New templates aren't offered in onboarding (fixed enum).
- `/market`: home = hero, tabs, **Shop by department** cards + Phones & Laptops card, **Popular Mart** (editorial rails: Popular picks = `pick` tag, New arrivals, Under ₦10,000, Weekend essentials = `weekend` tag; labelled "Curated", no sales/popularity claims; each rail skips products an earlier rail shows), one rail per department (shops interleaved). Browsing (`?dept`, `?col`, `?cat`, `?q`, `?max`, `?shop`, `?stock`) pages 24 at a time (`?page`). Commerce: `searchMarket` gained `department`/`collection`/`offset`; `searchProducts` gained `categories`/`tags` (bound `jsonb_exists`)/`offset`; `marketCatalog`, `railProducts`, `departmentSummaries`.
- Back-to-top Nia (the landing's `BackToTop`) runs on every market page via `components/market/market-back-to-top.tsx` in the market layout: same pop-up, greeting, progress ring and hop; focuses the page's `main h1` (no `targetId`); `lift` raises her above the compare tray while it's open.
- Search (`searchProducts`, used by the market, shops and Nia's tools): plurals read as singular (dresses → dress, watches → watch, never dress → dres); a word naming the product's category ranks it above accessories that mention it ("laptop" → Laptops before "Laptop Stand"); with colour + other words, colour alone never qualifies a product (no black phones for "black dresses").
- **Images:** `pnpm market:images` (`scripts/populate-market-images.ts`, dev-time only) searches **Openverse** (keyless; CC0/PDM from StockSnap + rawpixel; anonymous quota ≈200 requests/day → stops cleanly on 401/403/429, rerun later) or **Pexels** (`--provider pexels`, needs `PEXELS_API_KEY` in `.env`; key never committed). Filters brand names, graphics, vintage/museum scans; sharp → square ≤800 px WebP in `apps/web/public/stock/<slug>.webp`; credits (source, author, licence) in `stock/credits.json`; writes the seed manifest `packages/database/src/catalog/photos.ts`. Products may list several `photoQuery` phrases (tried in order). **Every photo was reviewed by eye**; rejected sources live in `scripts/market-images-rejected.json` and are never reused. Result: 137 imported + 18 Burst = 155 of 214 items photographed; the rest show generated category artwork (`ProductVisual` motifs incl. device/audio/cup/bowl/shoe/bag/chair/linen/box/desk/candle/vase/knife/pot/frame/lamp). A photo that fails to load (even before hydration) falls back to that artwork (`data-fallback-art`). Product pages credit "Illustrative photo: <author> on StockSnap (CC0 1.0)".
- Seed now keeps demo photos current: rows whose images are empty or exactly their own `/stock/<slug>.*` demo photo get the manifest's photo (or `[]` if withdrawn); merchant-uploaded images are never touched. After a new import: `pnpm db:seed` (local) / with `DATABASE_URL=$PRODUCTION_DATABASE_URL` for Neon.
- Tests: `packages/commerce/test/market-departments.test.ts` (data integrity, counts, non-alcoholic, departments, collection, search words, budget/colour/stock filters, paging, rails, summaries, variants, per-shop carts, photo refresh, plurals); `packages/ai/test/market-catalog.test.ts` (Nia's `searchMarket` tool for the brief's queries: laptops under ₦700k, a phone, black dresses, birthday cake, drinks, orange juice, wireless earbuds, men's sneakers, home office); `e2e/market-catalog.spec.ts` (departments, Popular Mart, department paging, collection + budget filter, search, product page variants + carts in two shops, image fallback).
- **Verified 2026-09-30:** 132 unit tests (2 opt-in skipped), lint, typecheck, `next build`; Playwright smoke + dashboard + market-catalog 22/22 (mobile + desktop) and market-catalog 6/6 on desktop (the desktop project now includes `market-catalog`); the memory chat spec passed in the earlier full run (skipped on the re-run to save Groq quota). Screens checked at 1440/1280/1024/768/430/390 for `/market`, `?dept=gadgets`, `?col=phones-laptops`, `?q=orange juice`, a product page: 0 horizontal overflow, 0 broken images, no page errors.
- Live Nia check (guest chat → no memory writes, real Groq, 2026-09-30): "Show me laptops under ₦700,000" → the 4 Tusk laptops ≤ ₦700k; "black dresses" → 2 black dresses; "wireless earbuds" → Floe Buds Lite + Pro; "I need a phone" / "birthday cake" → a budget / party-size question first (by design). "drinks", "orange juice", "men's sneakers", "home office" hit Groq's daily cap before a live answer — covered by the tool tests.
- Photo coverage is lowest in Home (9/23) and Fashion (24/42 in Walrus Designers): Openverse has few usable CC0 photos for Nigerian dishes and fashion items. A Pexels key + `pnpm market:images -- --provider pexels`, then an eye review, would fill most gaps.

## Commerce agent (2026-09-30) — full detail in `docs/COMMERCE_AGENT.md`
Audit first, then extend (nothing rebuilt). Capability matrix before → after:
| Capability | Before | Now | Where |
|---|---|---|---|
| Goal-aware discovery, hard vs soft constraints, "why" | partial (budget/colour/size) | `exclude` (hard), `prefer` (soft, reorders relevant results), `minBudget`, `forWhom`/`occasion` (session only), real `specs` + factual `why` | `catalog.ts` `searchProducts`, `agent-tools.ts` `whyReasons` |
| Clarification | market askDecision | + prompt: confirm from memory instead of asking | `prompts.ts` |
| "What do you remember about me?" | Passport page, Telegram `/memory` | `showMyMemory` card (Confirmed/Observed/Likely, "was Lekki", blob ids; model gets Walrus-recalled text), Telegram `/memory` grouped | `memory/src/profile.ts`, `agent-parts.tsx` |
| Same as last time / reorder | orders | + bookings (`repeatBooking`), unavailable lines → alternatives | `repeat.ts`, `tools.ts` |
| Substitutions | missing | `findAlternatives` (same item other option first; similar by shared tags/attributes, 0.6–1.4× price) on reorder, failed add, unavailable getProduct | `commerce/src/alternatives.ts` |
| Comparison | market, price/options | real spec rows, "Not listed", `focus`, `notListed`; shop compare tool; compare page shows specs | `comparison.ts`, `compare-table.tsx` |
| Baskets (event cart, guides, meal plan, occasion, list → cart, budget) | missing | `planBasket`: deterministic, budget-fitting, stable edits (`cheaper`, `previous`), per-shop totals, Add all to cart(s) | `commerce/src/basket.ts`, `BasketCard` |
| Shopping session vs long-term memory | missing | `conversations.session` (migration 0004): intent, lastResults (R1…), shortlist (S1…), list, basket → `<nia_session>` | `ai/src/session.ts` |
| Unfinished shopping | missing | previous conversation's session (≤14 days) only on CONTINUE_TALK | `session.ts` `previousSession` |
| Web → Telegram | per shop | + Walrus Market guide on Telegram (chooser, shop links, decision buttons `ad:i`, basket `pb` → per-shop carts, `cs:<slug>` review & confirm) | `telegram/src/handler.ts`, `format.ts` |
| Price history / watch | none | `product_price_history` recorded on product save; `getProduct.priceHistory`; price watch NOT implemented (no monitor) | `price-history.ts`, dashboard `saveProductAction` |
| Reviews | none | none (not in data model) — prompt forbids inventing | — |
| Visual search | none | honest boundary `visionCapability()` (off; Telegram photos get the reason) | `ai/src/capabilities.ts` |
| Observability | tools list in dashboard | `[nia trace]` dev log (or `NIA_TRACE=1`), dashboard "Nia trace" per assistant message | `apps/web/lib/trace.ts` |
- Token budget: new tools are gated per turn (`PLAN_TALK`, `SAVE_TALK`, `LIST_TALK`, `COMPARE_TALK`, `isMemoryQuestion`) — keep new tools gated; Groq free tier is 7K ITPM + 200K TPD.
- DB: migration `0004_charming_radioactive_man.sql` (additive: `conversations.session jsonb default '{}'`, `product_price_history`). Applied locally and on Neon.
- **Deployed 2026-09-30** (commits b18a800 + 795d56d). Production migrations: `pnpm db:migrate:prod` (reads `PRODUCTION_DATABASE_URL` from `.env`, prints only the host; the user allowed exactly this command in `.claude/settings.local.json`). Always migrate before pushing code that reads new columns. Live-checked: pages at 1440/390 (0 overflow/broken/errors), compare page shows spec rows, a guest event-cart chat on production built a 3-shop basket (Groq output cap works). Found live: the model left basket quantities at 1 for "eight friends" and called planBasket twice in one reply (two cards) → fixed: `defaultQuantity` (per-serving units = headcount, cartons ÷4, whole items 1; explicit quantity wins), max 2 planBasket calls per reply, web shows only the last basket card.
- **One cart across every shop (2026-09-30):** `/market/cart` (commerce `all-carts.ts`: `accountCustomerIds` = customers by user id + WEB_AUTH identity + TELEGRAM identity, never by name; `cartsForAccount`, `placedOrdersForAccount` (owner-only), `cartLineCountForAccount` for the header badge). Per-shop CartEditor (qty/remove/delivery-or-pickup) + grand total + **Confirm all N orders** (one tap, one order per shop, each with its own payment instructions / Pay link — no cross-shop payment exists). Cart icon with count in the market header and every shop header; `QuickAdd` on market cards (no options → add; options → product page); chat basket → "Review & confirm your cart"; Telegram `/cart` (+ "See my whole cart" after Add all). Payment stays per shop (no split-payment provider).
- **Telegram navigation (2026-09-30):** customers were stuck in one shop. `navigation.ts` detects “back to the market / leave this shop / switch to X / take me to the bakery / other shops” (needs a navigation phrase + known place; tested against false positives), `/market` + `/shops`, shop welcome buttons (🛍 Walrus Market · 🔁 Other shops), “💬 Chat with shop” on market results, “🛍 Search Walrus Market” (`mk`) when a shop search is empty. After deploying, run `pnpm telegram:webhook -- profile` so the bot menu lists /market and /shops.
- Tests: 159 unit/integration (was 132) incl. `commerce/test/agent.test.ts`, `memory/test/profile.test.ts`, `ai/test/agent.test.ts`, Telegram market tests; e2e compare-page spec check.
- **Groq output cap:** Groq rejects a request whose *expected* output exceeds its output-tokens-per-minute (free: 1,000 for qwen3.8-27b) — without `max_tokens` it estimates 1,200+, so every turn failed with "Request too large … OTPM". `callSettings()` now sets `maxOutputTokens` (chat 600/step, extraction 500; real outputs are ≤ ~340 / ~140), passed to web `streamText`, Telegram `generateText` and extraction. `aiBusyMessage` maps OTPM to "busy", not "conversation too long".
- Live-verified 2026-09-30 evening (guest market chat, real Groq, local): **event cart** ("eight friends… ₦50,000") → planBasket across 3 shops, ₦42,000, ₦8,000 left; **personal shopper** (embedded-dev laptop ≤ ₦800k) → 4 real laptops explained from specs/options; **comparison** of the first three → spec table, "none lists a weight — I won't guess"; **gift for mum under ₦50k** → one decision question with chips. Known model slip: once called an unlisted-weight laptop "heavier". Signed-in flows (memory card, corrections, same-as-last-time, Telegram continuity) are covered by integration tests (mock Walrus store), not re-run live here.

## Entry flow (2026-09-30)
- Landing CTAs say **Sign in & shop with Nia** (header: **Shop with Nia**) → `/market/signin`; signed-in visitors go straight to `/market`.
- Default post-sign-in destination is `/market` for email (`app/actions/auth.ts`), Telegram (`/api/auth/telegram`) and `/signin`. Explicit `next` still wins (onboarding, dashboard deep links); signing in inside a shop returns to that shop.
- `/try` is retired (permanent redirect to `/market`). The market header shows **Your shops** (→ `/dashboard`) only to members of a shop.
- Bot: the sign-in "Confirmed" message and the welcome keyboard carry an **Open Walrus Market** button (`marketUrl()`; stripped on localhost).

## Visual consistency (2026-09-29)
The landing page is the source of truth. Its language now lives in shared tokens and primitives, so app pages inherit it:
- Tokens (`globals.css` :root): paper background `#fbfbfe`, white surfaces, hairline `--border #e8e7f2` / `border-ink-900/[0.06]`, primary = landing CTA navy `#1b1a4b`, `--shadow-float` = the landing's soft navy shadow; app is light-only (`data-theme="light"`), like the landing. Contrast re-checked (`scripts/check-contrast.ts`, 0 failures).
- `@nia/ui` primitives: pill buttons (navy primary with a soft lift, white secondary with hairline), `Card` = rounded-3xl + hairline + `shadow-soft`, fields = rounded-2xl, h-12, hairline, accent focus ring; `Skeleton` = aqua shimmer (`.nia-skeleton`).
- `components/dashboard/ui.tsx`: display-style `PageHeader`, `Stat`, `EmptyPanel` (mascot on an aqua glow), soft `Table` (paper header, row hover). Inside a card pass `className="rounded-2xl shadow-none"`.
- Shells: dashboard sidebar (soft surface, active item = white pill + aqua edge glow), mobile tabs and store nav = navy pills; market/store headers white/90 with hairline.
- Only classNames / presentational markup changed — no handlers, queries, actions, routes or props.

Route checklist (inspected at 1440 and 390, restyled, functionally tested):
| Route | Status | Notes |
|---|---|---|
| `/` landing | ✅ source of truth | unchanged |
| `/signin` | ✅ | display title, mascot aura, card + fields from primitives; e2e sign-in |
| `/try` | ↪ retired | permanent redirect to `/market` (2026-09-30) |
| `/onboarding` (all 6 steps) | ✅ | step pills, hero title, mascot aura; e2e onboarding → publish |
| `/dashboard` workspace picker | ✅ | |
| `/dashboard/[id]` overview | ✅ | stats, chart card, health, recent orders |
| `…/conversations`, `…/conversations/[id]` | ✅ | table; transcript |
| `…/customers`, `…/customers/[id]` | ✅ | table; memory rows with orb markers; fixed pre-existing 100px mobile overflow |
| `…/catalog`, products new/edit, services new/edit | ✅ | tables, forms, photo field; e2e create product |
| `…/orders` | ✅ | table + empty state; e2e merchant sees/confirms order |
| `…/orders/[id]` | ⚠️ code-checked | uses shared Card/Badge/title; no orders in local dev DB to view with data |
| `…/bookings` | ✅ | table / empty state |
| `…/memory` (Walrus) | ✅ | health panel, stats, nested tables flattened, blob IDs + copy |
| `…/settings` (incl. Telegram, team, knowledge, hours, delivery) | ✅ | fixed pre-existing 121px mobile overflow (hours), delivery areas stack on phones |
| `…/judge` | ✅ | stats, walkthrough, before/after chats |
| `/s/[slug]` home, shop, product | ✅ | hero title, product cards |
| `/s/[slug]/chat` | ✅ | navy user bubbles, lavender assistant bubbles, pill composer, round send; e2e live memory chat |
| `/s/[slug]/orders` (cart) | ✅ | e2e cart → confirm |
| `/s/[slug]/profile` Memory Passport + Telegram connect | ✅ | orb section markers, memory-card rows, mascot empty state |
| `/s/[slug]/signin` | ✅ | |
| `/market`, `/market/nia`, `/market/compare`, `/market/profile`, `/market/signin` | ✅ | e2e browse/search/compare |
There is no separate Telegram page: connection lives in the store profile and dashboard settings (both covered).

## Status (2026-09-28)
Verified with real credentials (2026-09-28): `pnpm walrus:health` (mainnet), `pnpm test:walrus`, `pnpm test:ai` (Qwen extraction), and the flagship browser flow on Mainnet + Groq: preferences → 3 stored receipts → new chat recall → Yaba correction (supersedes, keeps Lekki as history) → new chat answers “Lekki before, Yaba now” → Memory Passport.
Finished & verified locally: landing; storefront (home, shop, product, chat, orders/cart, profile + Memory Passport + Telegram connect, sign-in); chat streaming with cards/receipts/recall chips; dashboard (overview, conversations, customers + detail + owner restore, catalog editors, orders + detail + transitions, bookings, memory explorer with relayer counts, settings incl. knowledge/Telegram/team, judge mode with before/after); onboarding; Telegram webhook + bot CLI; Paystack webhook; health endpoint; docs.
Verified: 108 unit/integration tests, lint, typecheck (10 packages), `next build`, Playwright critical path (merchant onboarding → product → publish → customer order → cross-tenant 404 → merchant confirm).

**Not yet verified:** a real person completing Telegram sign-in on the live site (needs a tap in Telegram), Resend emails (not configured).

## Deployment (live since 2026-09-28)
- **Live:** https://nia-pearl.vercel.app — Vercel project `olalekan2345s-projects/nia`, root `apps/web`, region `cle1`. **Auto-deploys on every push to `main`** of https://github.com/Olalekan2345/nia (public).
- DB: Neon (us-east-2). Its connection string is in local `.env` as `PRODUCTION_DATABASE_URL`; to migrate/seed it, pass it as `DATABASE_URL` to `pnpm db:migrate` / `pnpm db:seed`. Demo shops seeded; owner = the user's email + Telegram @Olalekan2345 (id 946176405) via `SEED_OWNER_TELEGRAM_ID`.
- Vercel env vars were set through the API from `.env` values (own `AUTH_SECRET`, `MEMWAL_NAMESPACE_PREFIX=nia`, no `RESEND_API_KEY` → Telegram-only sign-in live). Production builds come from GitHub; `.vercelignore` keeps `.env` out of local `vercel deploy` uploads.
- @nia_walbot's webhook points at the live site. **Don't run `pnpm bot:poll` with this bot** (it deletes the webhook); use a second bot for local development.
- Groq free tier (7K input tokens/min **and 200K tokens/day** for qwen3.8-27b, shared by local dev and the live site — same key) makes a product question take ~45 s or return the "busy" message; the daily cap was hit on 2026-09-30 after ~40 test turns. Needs Groq Developer tier (or another provider) before real users. The dev log shows the exact limit (`Rate limit reached … tokens per day (TPD)`).

## Next steps
0. Optional: `PEXELS_API_KEY` → `pnpm market:images -- --provider pexels` + eye review to photograph the remaining ~59 catalog items, then `pnpm db:seed` locally and on Neon.
1. User: upgrade Groq (or switch provider); optionally Resend for email sign-in.
2. Real users (≥3 × ≥10 memories), screenshots, article (docs/ARTICLE_DRAFT.md), X post, feedback form.

## Known issues / notes
- `/market/nia?q=…&send=1` (the "Ask Nia" buttons) auto-sends in the production build but not under `next dev` (React dev-mode double effects); type the question when testing locally.
- A long-running `next dev` can get stuck retrying Google Fonts downloads (log grows by millions of lines, client stops responding). Stop the process on port 3210 (the task's shell alone isn't enough) and restart `pnpm dev`.
- `ProductVisual` is a client component: keep shared helpers (e.g. `colourHex` in `components/commerce/colour.ts`) out of it, or server components calling them get "Attempted to call … from the server".
- **e2e flake source:** an interrupted Playwright run (or stopping a background `next dev` task, which only kills its shell) can leave `apps/web/.next-e2e` corrupted. Symptoms: `Timed out waiting 180000ms from config.webServer`, or a fresh merchant's dashboard route returning 404. Fix: stop anything on port 3310, `rm -rf apps/web/.next-e2e`, re-run.
- Customers list shows 0 memories for customers whose Memory page counts are 3–4 (pre-existing count/query mismatch, not yet investigated).
- Local dev: earlier local test data was reset with `pnpm db:reset`; e2e runs create test shops (“E2E Linen …”) in the local DB.
- Rate limits are Postgres fixed windows (fine for one region).
- Chat image upload not implemented (merchant product photo upload is).
- Observed order patterns (colour/size chosen in 2+ orders) are stored as "Observed from orders" memories after each confirmed order.
- Recall is skipped for namespaces with no stored records (memoryPresence in orchestrator) to save relayer calls.

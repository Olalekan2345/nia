# Architecture

One Next.js application (`apps/web`) hosts the storefront, dashboard, streaming chat API, and the Telegram and Paystack webhooks. Domain logic lives in workspace packages so web and Telegram share exactly the same code paths.

```
                  ┌──────────────── apps/web (Next.js 16, App Router) ────────────────┐
Browser  ───────▶ │ /s/[slug]/*  storefront + chat UI   /dashboard/*  merchant app     │
                  │ /api/chat (stream)  /api/memory/status  /api/health                │
Telegram ───────▶ │ /api/telegram/webhook  (secret check → claim update_id → after())  │
                  └───────────┬──────────────────────────────────────┬───────────────┘
                              │                                      │
                  packages/ai (orchestrator, tools, prompts)   packages/telegram (native UX)
                     │            │              │
          packages/commerce   packages/memory   LLM provider (Qwen on Groq/Gemini/Mistral/DeepSeek)
                     │            │
                PostgreSQL     Walrus Memory relayer ──▶ Walrus (Mainnet)
```

## A chat turn

1. `POST /api/chat` — same-origin check, rate limit, resolve storefront by slug, customer from the session cookie (or a session-only guest id), conversation owned by that customer.
2. Save the user message (sensitive values redacted).
3. `prepareTurn()` (`packages/ai/src/orchestrator.ts`): load recent history **from the database**, build targeted recall queries, recall customer + shop memories from Walrus, load relevant policies and the cart, assemble the system prompt with data blocks.
4. `streamText` with typed tools bound to the server-resolved scope; tool results render as cards.
5. After the reply: extraction → policy → Walrus writes → durable wait; receipts stream as `data-memory` parts and update in place.
6. The assistant message is stored with its UI parts and the list of memories used (for “Why Nia said this” and the dashboard).

Telegram uses the same `prepareTurn` + tools with `generateText`, then renders cards and inline keyboards natively.

## Data ownership

| PostgreSQL | Walrus Memory |
|---|---|
| merchants, members, invites, knowledge (canonical), settings | customer memories (preferences, sizes, delivery, occasions, complaints, corrections, order/booking history) |
| products, variants, services, availability | shop knowledge the owner chose to remember; operations notes |
| customers, identities (web/Telegram), link tokens | |
| carts/orders/items/events, bookings | |
| conversations & messages | |
| memory **metadata**: type, label, hashes, lifecycle, blob IDs, jobs, provenance | |
| sessions, sign-in codes (hashed), rate limits, audit log | |

Prices, stock, order status and availability are never taken from memory.

## Typed tools (the model’s only way to act)

`searchProducts, getProduct, searchServices, getService, getCustomerRecentOrders, getOrder, createDraftOrder, addItemToDraft, updateDraftItem, removeDraftItem, setFulfillment, showOrderSummary, getAvailableBookingSlots, createBookingDraft, getMerchantPolicy, recallCustomerMemory, recallMerchantMemory, forgetCustomerMemory` — each validates input, is bound to the current merchant/customer, and returns structured data. Placing an order or confirming a booking is **not** a tool: it happens only when the customer presses Confirm (web server action or Telegram callback).

## Identity

`customers` are per merchant. `customer_identities` link a customer to `WEB_AUTH` (user id after email-code sign-in) and/or `TELEGRAM` (Telegram user id). Linking uses a single-use, 10-minute, hashed token in a `t.me/<bot>?start=<token>` deep link. A Telegram-only customer that links to a web account is merged (operational rows move; Walrus namespaces are joined via `merged_into_id`).

## Multi-tenancy

- Dashboard: `requireMerchant(merchantId, minRole)` on every page and server action; non-members get 404.
- Storefront: all customer actions resolve the customer from the session for that merchant; ids from the client are only used after scoping queries by merchant + customer.
- Memory: namespaces derived server-side; recall joins metadata by merchant.

## Local development

`pnpm dev:db` runs a real PostgreSQL 18 via `embedded-postgres` (UTF-8, data in `.data/postgres`). Tests use in-process PGlite with the same migrations. See the README for commands.

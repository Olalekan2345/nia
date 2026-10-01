# Nia as a commerce agent

Nia is a personal shopping and service assistant that **knows how to shop with the customer**: it understands the goal, remembers the customer across sessions and channels (Walrus Memory), searches and compares real catalogs, plans baskets within a budget, and hands every purchasing decision back to the customer.

This document describes the agent layer added on top of the existing chat, memory, commerce and Telegram code. Nothing was rebuilt: the orchestrator, MemWal integration, order state machine, auth and UI are the same; the agent adds deterministic tools, session state and cards.

## Design principles

1. **The model plans; the server decides.** The model picks which tool to call and with which constraints. Searching, filtering, ranking, choosing basket items, substitutions, comparisons and every total are deterministic server code over real data. The model never adds up prices — it quotes `totalLabel` / `remainingLabel`.
2. **Never invent.** Products, prices, stock, specs, alternatives, price history and reviews only come from the database. A spec that isn't listed is shown as "Not listed". There are no reviews or ratings in the data model, so Nia never mentions any. Price changes are only claimed from recorded history.
3. **Three kinds of state, kept apart.**
   | State | Where | Examples |
   |---|---|---|
   | Operational truth | PostgreSQL | catalog, prices, stock, carts, orders, bookings, recorded price changes |
   | Current shopping session | `conversations.session` (PostgreSQL) | this conversation's goal and constraints, results shown, shortlist, list, proposed basket |
   | Long-term customer memory | **Walrus Memory** | sizes, colour likes/dislikes, usual delivery area, people they shop for, budgets, corrections |
   "I'm shopping for my brother today" is session state; it never becomes a permanent preference. Durable facts reach Walrus only through the existing extraction + memory policy (explicit, confident, long-lived; inferred facts need the customer's consent; one-off details stay ephemeral).
4. **The customer confirms.** Nia can search, recommend, compare, propose baskets, fill carts and prepare bookings. Placing an order, confirming a booking, cancelling and paying are explicit customer actions (buttons / server actions). "Payment successful" is only shown when the payment provider confirms it — or, in a demo shop, for the clearly labelled simulated payment (see Demo checkout).
5. **Small prompts.** Tool schemas cost input tokens on every model step, and rate-limited providers (Groq's free tier: 7K tokens/min, 200K/day) cap them. New tools are offered only on turns that need them (`selectTools` / `selectMarketTools` gates).

## Demo checkout

Demo shops (`merchants.is_demo`, the eight fictional Walrus Market shops) can't wait for an owner who may be offline, so their checkout is simulated and says so everywhere ("Demo shop: payment is simulated — no real money moves"). Real shops never take this path: they confirm and take payment themselves (merchant-confirmed, payment link or Paystack).

- **One tap pays.** The order card's button reads "Pay ₦… (demo)" (web chat, shop cart, market cart "Pay for all N orders (demo)", Telegram). `confirmCustomerOrder` submits the cart, then `settleDemoOrder` moves it awaiting confirmation → confirmed → paid (`payment_mode = "demo"`) → processing → **ready** (pickup) or **dispatched** (delivery), one `order_events` row per step (actor `system`). Orders that still need a quote (unpriced items) stay with the shop.
- **Nia celebrates.** Web: a pop-up (`components/commerce/checkout-celebration.tsx`) shows "Confirming your payment…" for about 2 s, then Nia dances with confetti and says "ready for pickup at …" or "on its way to Yaba — expected today"; it stays still for reduced motion. Telegram: "⏳ Confirming your payment…" is edited into the paid order, then Nia's photo (`/brand/nia-celebrate.jpg`) is sent with Telegram's 🎉 message effect.
- **Saved at checkout.** The order memory goes to Walrus in the same request — not when the order is collected or delivered. It says how it was paid and what happens next, plus the shopping decisions behind it (goal, who it's for, occasion, budget, exclusions) from the order's conversation or a Walrus Market basket from the last 24 hours (`shoppingContext`). Demo bookings are confirmed at once (`settleDemoBooking`) and remembered the same way.
- **Delivery follow-ups.** Each delivery gets the shop's own estimate (`deliveryEstimate`: same-day areas within 6 hours, otherwise the area's days), and `overdue` once it is 24 hours past that. Demo shops carry two written policies (`DEMO_SHOP_POLICIES`, applied by the seed): the demo payment, and "If your delivery hasn't arrived within 24 hours of the estimated time, … we send a replacement at no extra cost." When a customer says it hasn't arrived, Nia looks the order up (`getCustomerRecentOrders` / `getOrder` in a shop, `getMyOrders` in Walrus Market, offered only on order-status talk) and quotes the policy only once the order is overdue. The complaint is remembered by the normal extraction (COMPLAINT / MERCHANT_COMMITMENT).
- **Backfill.** `pnpm orders:settle-demo` (local) / `pnpm orders:settle-demo:prod` settles demo orders placed before this existed and saves each to Walrus once (`-- --dry-run` lists them first).

## Shopping pipeline

```
customer message
  → recall relevant Walrus memories (customer + business)       prepareTurn
  → load the conversation's shopping session (<nia_session>)    session.ts
  → offer only the tools this turn can use                      selectTools gates
  → model: intent → constraints (hard vs soft)
  → tool: search the real catalog                                searchProducts / searchMarket
      hard: maxBudget, minBudget, size, colour, inStockOnly, exclude
      soft: prefer (reorders relevant results, never filters)
  → rank, attach real specs + factual "why" reasons
  → model explains, citing reasons and memories
  → customer acts: Add / Add all / Compare / Confirm
  → after the reply: extraction → policy → Walrus (durable facts only)
```

## Tools

Shop Nia (`packages/ai/src/tools.ts`) and the Walrus Market guide (`packages/ai/src/market-tools.ts`) share the agent tools in `packages/ai/src/agent-tools.ts`. Every tool validates input with Zod, is bound to the server-built scope (merchant, customer, conversation — the model never passes those ids), validates ids it receives, and returns typed results (errors become `{ ok: false, code }`).

| Tool | Where | Offered when | What it does |
|---|---|---|---|
| `searchProducts` / `searchMarket` | shop / market | always | Real catalog search with hard (`maxBudget`, `minBudget`, `size`, `colour`, `exclude`) and soft (`prefer`) constraints; returns specs + `why`; records results and goal in the session |
| `getProduct` | shop | always | Product with variants, recorded `priceHistory`, and `alternatives` when unavailable |
| `compareProducts` | shop (on compare talk), market (always) | | Side-by-side from real attributes and options; optional `focus`; `notListed` for specs nobody lists |
| `planBasket` | shop (that shop) / market (all shops) | multi-part goals, baskets in the session | Deterministic basket planner (below) |
| `showMyMemory` | both | "what do you remember about me?" (signed in, memory on) | Grouped memory card with certainty; the model gets Walrus-recalled text |
| `saveForLater` | both | "save / keep these" | Shortlist in the session (only ids Nia showed in this conversation) |
| `updateShoppingList` | both | list talk | Structured list in the session; buy it with `planBasket` |
| `getCustomerRecentOrders` | shop | signed in, memory on | Orders **and bookings** with `repeat` / `repeatBooking` resolution |
| `createDraftOrder(fromOrderId)` | shop | signed in | Reorder at today's prices; unavailable lines come with `alternatives` |
| `addItemToDraft` … `showOrderSummary` | shop | signed in | Existing cart tools; an out-of-stock add returns `alternatives` |
| `askDecision` | market | always | One multiple-choice question (chips on web, buttons on Telegram) |
| booking, policy and memory tools | shop | as before | Unchanged |

### Basket planner (`packages/commerce/src/basket.ts`)

"Eight friends tonight — drinks, snacks and a cake, ₦50,000." The model supplies slots (`Drinks: juice ×4`, `Snacks: puff puff ×2`, `Cake: cake ×1`), a budget, and optional `prefer` / `exclude` / `colour` / `cheaper`. The server:

1. searches each slot (in stock, priced, excluded words removed);
2. keeps the previous proposal's pick for unchanged slots (stable multi-item edits: "make the shoes cheaper" changes only the shoes; "everything in black" re-picks items that come in black and says which don't);
3. over budget → steps the priciest line down to its next cheaper real option until it fits; if even the cheapest choices don't fit, says so (`overBudgetBy`);
4. computes exact totals in minor units, per shop (each shop keeps its own cart, delivery fee and checkout).

Slots with nothing suitable are reported as missing, never filled with a guess. The card's **Add all to cart(s)** adds each line to its shop's cart through the existing `addToCartAction` (the server re-checks every product); nothing is ordered until the customer confirms each cart.

### Substitutions (`packages/commerce/src/alternatives.ts`)

For an unavailable item: first the same product in another available option, keeping size/storage when possible ("Same item in Ocean Blue"); then products in the same category within 0.6–1.4× the price, ranked by the tags/attributes they actually share ("Similar dress (crepe), ₦2,000 less"). With nothing shared it says "Another dress" rather than claiming similarity. Only the shops in scope are searched.

### Search ranking (`packages/commerce/src/catalog.ts`)

Plurals read as singular (dresses → dress); a word naming the category ranks real category items above accessories that mention it; with colour + product words, colour alone never qualifies a product; excluded words remove products or just the excluded variants; preferred words reorder the clearly relevant results (≥ half the top score) without filtering.

## Memory in the agent

- **Before recommending**, recall runs on the message (plus an order-history query for "same as last time"). Recalled memories carry provenance (`customer stated`, `observed from orders`, `inferred`) and HISTORICAL flags for superseded values.
- **Ask less.** If memory answers a question, Nia confirms instead of asking ("You usually take Medium — same again?").
- **"What do you remember about me?"** → `showMyMemory`: sections (Sizes & options, Colours & style, Delivery, People & occasions, …) with **Confirmed / Observed / Likely**, corrections showing what they replaced ("updated · was Lekki"), and each item's Walrus blob id. Corrections go through the existing extraction (supersession keeps history); "forget that" uses the existing logical forget.
- **Unfinished shopping.** A conversation's session (goal, shortlist, basket, list) follows it across web and Telegram. When the customer asks to continue ("those laptops again", "did you find anything?"), the previous conversation's session from the last 14 days is offered; otherwise it is never brought up.
- **Memory unavailable** → the prompt says so and Nia says so; browsing continues.

## Services

"Book the same haircut as last time": `getCustomerRecentOrders` returns bookings with `repeatBooking` (clear or ambiguous, like orders) → `getAvailableBookingSlots` for that service → `createBookingDraft` with the same options → the customer confirms the booking card.

## Cross-channel

- Web and Telegram share one customer once the account is linked (Continue with Telegram / Connect Telegram) — never matched by display name.
- A conversation continues across channels for 12 hours; its shopping session goes with it. The **Walrus Market guide is now available in Telegram** (shop chooser → "Walrus Market — every shop"), with results linking to each shop, decision questions as buttons (a tapped option becomes a memory exactly as on the web), baskets with **Add all to cart**, and per-shop **Review & confirm** that switches to that shop's own order summary.

## Capability boundaries (honestly off)

| Capability | Status | Why / how to enable |
|---|---|---|
| Visual search | Off (`visionCapability()`) | The configured model is text-only and chat has no upload. Telegram photos get an honest reply. Needs a vision model + image parts. |
| Reviews / ratings | Not in the data model | Never shown or summarised. |
| Price history | Recorded from now on (`product_price_history`) | Written when a merchant saves a product with a changed price; Nia quotes only recorded changes. |
| Price watch alerts | Not implemented | No background monitor; would use the Telegram bot as delivery when added. |

## Observability

- Dev (`NODE_ENV=development`) or `NIA_TRACE=1`: one `[nia trace]` log line per web turn — tools offered, memories recalled, each tool's inputs (the structured intent) and outcome.
- Dashboard → Conversations → a conversation: **Nia trace** under each assistant message (staff only), derived from the stored tool parts: inputs, real result counts, cart changes, failures; memory writes are shown as "Remembered".

## Tests

- `packages/commerce/test/agent.test.ts` — basket totals/budget/stability/honest gaps/exclusions/shop scope, alternatives (same item first, shared-trait similarity, price band, shop isolation), comparison facts (`Not listed`, focus), hard vs soft constraints, repeat bookings, price history.
- `packages/memory/test/profile.test.ts` — certainty mapping, corrections, hidden forgotten/superseded/pending/tombstoned records, topic filter.
- `packages/ai/test/agent.test.ts` — session records results + goal and resolves "the second one", shortlist only accepts shown ids and never leaks to another shopper, unfinished shopping only on request, cross-shop basket + stable "make the cake cheaper", memory card (sign-in, per-customer, Walrus text), out-of-stock alternatives, reorder alternatives, repeat bookings.
- `packages/ai/test/market-catalog.test.ts` — Nia's search tool for everyday queries.
- `packages/telegram/test/telegram.test.ts` — market guide on Telegram: chooser, shop links, decision buttons, basket → per-shop carts → review & confirm.
- `e2e/market-catalog.spec.ts` — market UI incl. comparison with real specs.

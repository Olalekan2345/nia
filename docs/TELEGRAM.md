# Telegram

One platform bot serves every shop. A chat talks to one shop at a time (chosen by a shop deep link, `/start s_<slug>`, a button, or `TELEGRAM_DEFAULT_SHOP`).

## Setup

1. Create a bot with **@BotFather** → copy the token. Set its photo to `apps/web/public/brand/nia-telegram-avatar.png` (`/setuserpic`).
2. `.env`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC…
   TELEGRAM_BOT_USERNAME=YourNiaBot
   TELEGRAM_WEBHOOK_SECRET=<16–256 chars of A-Z a-z 0-9 _ ->
   ```
3. **Production (HTTPS):** `pnpm telegram:webhook -- set` registers `${APP_URL}/api/telegram/webhook` with the secret, and sets commands + descriptions. Check with `pnpm telegram:webhook -- info`.
4. **Local:** `pnpm bot:poll` deletes any webhook, long-polls Telegram and forwards every update to your local webhook route with the secret header — the same code path as production.

## Webhook handling

`apps/web/app/api/telegram/webhook/route.ts`

- Rejects requests without the exact `X-Telegram-Bot-Api-Secret-Token` (constant-time compare) → 401.
- Parses the update, **claims `update_id`** in `telegram_updates` (insert-or-ignore). Telegram retries deliveries; a second delivery returns 200 without processing.
- Acknowledges immediately and processes with `after()` (keeps Telegram from timing out and re-sending).
- Per-user rate limits (messages, callbacks, link and sign-in attempts).

## Experience

- `/start` — welcome explaining shopping, reordering, booking and memory, with buttons: Browse products · Book a service · My last order · Link account · Open the shop.
- Free text — typing indicator, the same Nia orchestrator as web, then native cards: product cards (photo when an HTTPS image exists), service cards with **Book this**, slot buttons, booking/cart summaries with **✅ Confirm**, repeat buttons **Same quantity / Change quantity / View similar options**.
- After a reply, new memories get an honest receipt: *🧠 Saving to memory… • Size: Medium* is sent at once, then **edited in place** to *🧠 Got it — I’ll remember that … saved with Walrus Memory* when the relayer confirms (Mainnet saves take ~30–60 s; the bot waits up to 35 s inside the webhook's 60 s). If Walrus is still confirming, the note says so and `/memory` shows the memory once stored. Placed orders and bookings get the same treatment.
- `/last`, `/memory`, `/shop`, `/book`, `/link`, `/new`, `/logout`, `/help`.

## Continue with Telegram (sign-in)

Telegram is the primary sign-in on the web (email codes remain as the alternative). The bot proves who you are; the browser gets the session. Code: `packages/commerce/src/telegram-login.ts`, `apps/web/app/api/auth/telegram/route.ts`, `handleLoginStart`/`handleLoginDecision` in the bot.

1. The browser taps **Continue with Telegram** → `POST /api/auth/telegram` creates a request: a `g_…` deep-link token and a browser secret (httpOnly cookie, scoped to that endpoint), a two-digit **number** shown on the page, 5-minute expiry. Only SHA-256 hashes of the token and secret are stored.
2. **Open Telegram** → `https://t.me/<bot>?start=g_…`. The bot shows who is asking (shop, browser) and three number buttons plus **Not me**.
3. Tapping the number shown on the website approves; a wrong number or **Not me** cancels. *Number matching* is what stops a forwarded sign-in link: the victim can't see the attacker's screen, so they can't pick the right number.
4. The page polls `GET /api/auth/telegram?id=…`; with its secret it consumes the approval exactly once and receives a normal session.

The account is keyed by Telegram user id (`users.telegram_user_id`, email optional). An email account can **Connect Telegram** from the profile page (same flow, purpose `connect`); a Telegram account that belongs to another Nia account is refused. `/logout` in the bot (or the **Sign out everywhere** button on the alert sent when the account signs in with email) revokes every web session.

## One customer on web and Telegram

A Telegram-connected account is the **same customer** in the bot and on the website at every shop: `resolveTelegramCustomer` resolves the account's customer, and on the web the person's earlier Telegram-only customer is adopted (first visit) or merged in (orders, bookings, conversations and memory metadata move; Walrus namespaces are joined through the merge pointer). A Telegram account attached to a *different* web customer is never taken over. Identities are never matched by display name.

Conversations continue across channels:
- The bot carries on the customer's most recent conversation at that shop from the last 12 hours — including one started on the website.
- The web chat header has **Continue in Telegram** (`/start c_<conversationId>`, only honoured for the conversation's own customer).
- A fresh web chat offers **Continue your Telegram chat** when the latest message came from Telegram.

The older per-shop link token (`/start l_…`) still works for links already issued.

Locally, Telegram rejects URL buttons that point at `localhost`; the client drops those buttons (`publicKeyboard`) so messages still send.

## Security

The bot token never reaches a browser; API errors never include the request URL (which contains the token). Callback data carries only ids; every action re-resolves the customer from the Telegram user and scopes by merchant, so another user cannot confirm someone else’s order.

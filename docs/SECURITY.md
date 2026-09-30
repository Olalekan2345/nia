# Security & privacy

## Secrets

- `MEMWAL_PRIVATE_KEY` (delegate key), `AI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, `PAYSTACK_SECRET_KEY`, `AUTH_SECRET` are read only in server code (`packages/config`). No `NEXT_PUBLIC_` variable carries a secret.
- `/api/health`, `pnpm walrus:health` and the dashboard show configuration state only (e.g. “Configured (hidden)”). An e2e test asserts the health payload contains no key material.
- Memory write errors are sanitised before storage (long hex strings / `suiprivkey…` are redacted).
- Use a Walrus **delegate** key, never the owner key; revoke delegates on the dashboard if exposed.

## Authentication

- **Continue with Telegram** (primary): bot-confirmed sign-in with number matching — the Telegram user must tap the two-digit number shown in the requesting browser, so a forwarded sign-in link can't be approved blindly. The request is bound to that browser by a secret in an `httpOnly` cookie, expires in 5 minutes and is consumed once; only hashes of the deep-link token and secret are stored. Wrong number or **Not me** cancels. Details: [TELEGRAM.md](TELEGRAM.md).
- Passwordless email codes (alternative): 6 digits from a CSPRNG, stored as HMAC(AUTH_SECRET, email|code), 10-minute expiry, 5 attempts per code, single use; rate limited per email and per IP. When the account has Telegram connected, each email sign-in sends a Telegram alert with **Sign out everywhere**.
- Sessions: 32-byte random token in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie; only its SHA-256 is stored, with the sign-in method and browser. `/logout` in the bot revokes all of an account's sessions.
- Anonymous visitors get a session-only guest id (no durable memory). Identity continuity is only claimed after sign-in or verified Telegram linking.
- Team invites are accepted only by signing in with the invited email.

## Authorization & tenant isolation

- Every dashboard page and server action calls `requireMerchant(merchantId, role)`; non-members receive 404 (no existence leak). Roles: OWNER > ADMIN > STAFF.
- Every storefront action resolves the customer from the session for that merchant, and every query is scoped by `merchant_id` (+ `customer_id`).
- Tests cover IDOR attempts: editing another customer’s cart, forgetting another customer’s memory, confirming another customer’s booking/order (web and Telegram), cross-merchant order transitions, cross-customer and cross-merchant recall, and a customer opening a merchant dashboard (e2e 404).

## CSRF & webhooks

- `/api/chat` requires a same-origin `Origin` header (e2e-tested); server actions use Next.js’ built-in origin checks.
- Telegram webhook: secret-token header verified in constant time; update ids deduplicated.
- Paystack webhook: HMAC-SHA512 signature over the raw body; amount and currency must match the order.

## Rate limits

Postgres-backed fixed windows (work across serverless instances): chat (per customer/guest/IP, per minute and per day), sign-in code requests and verifications, memory writes (per namespace per hour + Passport edits), Telegram link tokens and link attempts, Telegram sign-in requests (per IP and per Telegram user) and polls, Telegram messages/callbacks, cart and order actions.

## AI safety

- Sensitive-pattern filter (`packages/shared/src/sensitive.ts`: Luhn-valid card numbers, CVV, OTP/verification codes, PINs, passwords, API keys, bot tokens, JWTs, private keys, seed phrases) runs before text reaches the model, before messages are stored, and before anything becomes memory.
- Context is assembled deliberately; merchant text, catalog data, tool results and recalled memories are wrapped as data with explicit “no authority” instructions, and tag-like strings are stripped to prevent delimiter spoofing (tested).
- The model can only act through typed, scoped tools; it cannot place orders, mark payments or touch another tenant.
- Commerce-agent tools follow the same rules: the shopping session is per conversation (conversation ownership is checked before every turn); `saveForLater` only accepts products Nia showed in *this* conversation; `showMyMemory` requires a signed-in customer with memory on and reads only that customer's namespaces; alternatives and baskets search only the shops in scope (a shop's Nia: that shop). “Add all to cart” (web server action / Telegram callback) re-validates every product against the live catalog and adds it for the signed-in customer at that shop — never trusting session or client data for prices or ownership. Tests cover shortlist isolation, per-customer memory cards and shop-scoped alternatives.
- Nothing the agent shows is fabricated: no reviews or ratings (none exist), price changes only from recorded history, specs marked “Not listed” when absent, and photo search stays off until a vision model is configured.

## Privacy

- Memory Passport: customers see every memory, its source, and can correct or forget it; they can turn memory off per shop.
- Forgetting is logical (Walrus has no per-memory delete in the SDK) and the UI says so plainly.
- Namespaces use opaque UUIDs — no emails or phone numbers.
- Nothing is stored for guests beyond the session’s conversation.

## Headers

`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, HSTS.

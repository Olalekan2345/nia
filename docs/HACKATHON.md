# Walrus Session 8 — “Chatbots That Remember” submission pack

Deadline: **9 October 2026, 14:00 UTC** · Form: https://airtable.com/appoDAKpC74UOqoDa/shro5iVzzjoWfZlPK

## Form answers (fill the `⟨…⟩` placeholders with real values)

| Field | Answer |
|---|---|
| Project name | Nia — the shop assistant who remembers your customers |
| Short description | A multi-merchant shopping & service assistant (web chat + Telegram) that remembers each customer’s preferences, sizes, delivery area, occasions and past orders with Walrus Memory — and understands “same as last time”. |
| Who it’s for | Independent shops (fabric, fashion, salons, bakeries, repair…) and their returning customers |
| Problem | Shop chatbots forget customers between sessions and across channels, so regulars repeat themselves and “same as last time” is impossible |
| Solution | Every durable customer fact is extracted, policy-checked and stored on Walrus Mainnet per customer namespace; each turn recalls the few relevant memories semantically; receipts, a Memory Passport and corrections keep it honest |
| LLM / runtime | Qwen 3.8 27B (`qwen/qwen3.8-27b`, Alibaba) served by Groq, via Vercel AI SDK 7 (`@ai-sdk/groq`) — eligible for “Beyond the Big Two” |
| Walrus Memory agent ID | ⟨`MEMWAL_ACCOUNT_ID` — copy from Dashboard → Memory⟩ |
| Blob count | ⟨Dashboard → Memory → “Walrus blobs” (≥ 10 required)⟩ |
| Live URL | ⟨https://…⟩ |
| Telegram | ⟨https://t.me/…⟩ |
| GitHub | ⟨https://github.com/…/nia⟩ |
| Article | ⟨Medium/Inkray URL⟩ |
| X post | ⟨URL — tag @WalrusProtocol, #WalrusMemory, under the session announcement⟩ |
| Promo post (optional) | ⟨subreddit / dev forum outside Walrus & Sui⟩ |
| Wallet (dedicated for Sessions) | ⟨0x…⟩ |
| Bug / friction + improvement | See “Feedback” below; file issues at https://github.com/MystenLabs/MemWal/issues |

## How to collect the proof

1. **Agent ID:** Dashboard → Memory → “Memory account ID (agent)” (copy button). Also in Judge Mode.
2. **Blob count:** Dashboard → Memory → “Walrus blobs” = distinct blob IDs the relayer confirmed. Judge Mode shows the same account-wide, plus the relayer-side total from `listNamespaces()` for your prefix. Recent writes list real blob IDs you can paste into the article.
3. **3 users × 10 memories:** Memory page → “Memory per customer” — the “Stored by Nia” and “On relayer” columns for each customer, and the “Customers with 10+” tile.
4. **Mainnet:** `/api/health` → `walrus.network: "mainnet"` (read live from the relayer’s `/config`).

## Real-user plan (≥ 3 users, ≥ 10 memories each)

Ask at least three people to use the live store for a few days (web and/or Telegram). Natural ways each reaches 10+ memories: a size, 2–3 colour/material preferences, usual delivery area, a delivery-time preference, a budget, an occasion + who it’s for, 1–2 orders (each order is a memory), a booking, a correction (“I’ve moved…”), a reaction to a recommendation.

Evidence checklist:
- [ ] Screenshot: first conversation with “Got it — 3 things remembered” receipts showing blob IDs
- [ ] Screenshot: a *new* session where “memories used” recalls them (open the chip)
- [ ] Screenshot: correction (“Yaba now — you previously used Lekki”)
- [ ] Screenshot/video: Telegram after linking, recalling web-created memory
- [ ] Screenshot: Judge Mode before/after (memory OFF vs ON, same question)
- [ ] Screenshot: Memory page with ≥ 3 customers at 10+ and the blob count
- [ ] Short screen recording of the whole flow (2–3 minutes)
- [ ] Permission from testers to show their (non-sensitive) conversations

## Before / after demo script

In Dashboard → Judge mode, type the question once and press **Ask both**:

1. “Same as last time” — OFF: asks you to remind it; ON: names your last order and your current delivery area.
2. “What do I normally like?” — OFF: no history; ON: size, colours, delivery, with “memories used”.
3. “Where do you usually deliver my orders?” after a correction — ON: latest value plus the earlier one.

Both panes are live model calls; the only difference is Walrus recall (and history tools) being disabled on the left.

### Commerce-agent flows where memory changes the outcome

1. **What do you remember?** — chat card grouped by topic with Confirmed / Observed / Likely and Walrus blob ids; say “I moved to Yaba” → next time “Yaba now, Lekki before”.
2. **Same as last time** — real order resolved (or a clarifying question if ambiguous), draft at today's prices, unavailable items with real alternatives; for services, “book the same haircut” resolves the last booking.
3. **Event cart** — “Eight friends tonight, drinks, snacks and a cake, ₦50,000” → basket across shops with exact totals; “make the cake cheaper” changes only the cake; Add all to carts; confirm per shop.
4. **Recipient & occasion** — “a gift for my sister's graduation under ₦70k” → with memory ON, Nia uses what it knows about her (and asks first if it might be out of date).
5. **Web → Telegram** — shortlist two laptops on the web, then on Telegram: “show me those laptops again”.
See [COMMERCE_AGENT.md](COMMERCE_AGENT.md).

## Submission checklist

- [ ] Deployed on Mainnet (health shows `mainnet`), public URL works on mobile
- [ ] Telegram bot live and linked to the web account for at least one tester
- [ ] ≥ 10 blobs; ≥ 3 customers with ≥ 10 memories
- [ ] Public GitHub repo with README setup (fresh-clone tested)
- [ ] Article published (Medium/Inkray) — ~500–800 words, model + runtime + friction stated
- [ ] X post under the session announcement with @WalrusProtocol #WalrusMemory
- [ ] Feedback form: ≥ 1 bug/friction + ≥ 1 improvement idea; GitHub issues filed
- [ ] Joined the Walrus Discord; registered on DeepSurge
- [ ] Dedicated wallet address

## Feedback (friction found while building — verify each before filing)

1. **Peer dependencies:** the default SDK entry says it doesn’t need `@mysten/sui`, but relayer-mode calls import `@mysten/seal` and `@mysten/sui/keypairs/ed25519` for SEAL sessions — missing peers fail at the first `remember/recall`.
2. **No per-memory delete** in SDK 0.1.8 (relayer advertises `securityDeleteEnabled`). Apps must implement logical forgetting; namespace-wide `/api/forget` is too coarse for “forget that one thing”.
3. **No list/scan of a namespace’s memories** — only counts (`listNamespaces`) or similarity search. Improvement idea: paginated `listMemories(namespace)` returning blob IDs + created_at for audit/passport UIs.
4. **`MemWalMock` distance semantics** differ from real embeddings (token overlap), so production `maxDistance` values drop most mock hits.
5. **Read-after-write lag** after `done` (documented) — a `waitForIndexed` option would help UIs that confirm “remembered”.

6. **Delegate-key rate limit is easy to hit and hard to budget:** 60 weighted requests/min with a 60 s lockout, but the per-endpoint weights aren’t documented. Polling `getRememberStatus` per job (the SDK’s own `waitForRememberJob` pattern) for three memories locked the key within one conversation. `getRememberBulkStatus` also accepts jobs from plain `remember()` — worth documenting as the way to poll.

Improvement ideas: per-memory metadata tags on write (type/subject) returned on recall; document request weights and return rate-limit headers (remaining/reset) so apps can budget; a cost estimate per write.

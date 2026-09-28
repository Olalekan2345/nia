# Walrus Memory in Nia

Walrus Memory is Nia’s long-term memory. Every durable fact about a customer — preferences, sizes, usual delivery area, occasions, complaints, corrections, orders placed — is written to Walrus and recalled from Walrus. PostgreSQL only keeps metadata about those memories.

## Versions & endpoints

| | |
|---|---|
| SDK | `@mysten-incubation/memwal@0.1.8` (pinned) |
| Peers (required for relayer mode) | `@mysten/sui@^2.33`, `@mysten/seal@^1.4` — the SDK builds a short-lived SEAL session key client-side for every relayer call |
| Relayer | `https://relayer.memory.walrus.xyz` (`MEMWAL_SERVER_URL`) |
| Network | **Mainnet** — Nia reads it from the relayer’s public `GET /config` (`"network":"mainnet"`) and shows it in the dashboard and `/api/health` |

## Credentials

| Variable | What it is |
|---|---|
| `MEMWAL_ACCOUNT_ID` | Your MemWalAccount object ID on Sui (`0x…`) — the “agent ID” for the hackathon form |
| `MEMWAL_PRIVATE_KEY` | An Ed25519 **delegate** key registered on that account. Never the owner wallet key. If leaked, revoke it on the dashboard without touching the owner. |

Create both at [memory.walrus.xyz](https://memory.walrus.xyz). They are read only by the Next.js server (`packages/memory/src/store.ts`); the MemWal client is never constructed in browser or Telegram code, and no route returns key material. `pnpm walrus:health` prints the account ID truncated and the key as “set (hidden)”.

## Namespaces

```
<prefix>:merchant:<merchant-uuid>:customer:<customer-uuid>   one per customer per shop
<prefix>:merchant:<merchant-uuid>:knowledge                  shop policies the owner chose to remember
<prefix>:merchant:<merchant-uuid>:operations                 “we’re out of the navy chair until Friday”
```

- Built only on the server, only from database UUIDs resolved through an authenticated session or a verified Telegram update (`packages/memory/src/namespaces.ts` rejects anything that isn’t a UUID — emails/phones can’t end up in a namespace).
- `MEMWAL_NAMESPACE_PREFIX` separates environments (`nia` in production, `nia-dev` locally, `nia-it` for the integration test).
- **Owner separation.** One operator account owns every namespace. As the Walrus docs stress, a namespace is a data-organisation boundary, not a security boundary — the delegate key can read all of them. Isolation is enforced by Nia mapping each authenticated identity to exactly one namespace; tests cover cross-customer and cross-merchant recall.
- When a Telegram-only customer later links to a web account, the old namespace can’t be merged on Walrus, so the customer record keeps a `merged_into_id` pointer and recall searches both namespaces.

## Storage & encryption (what actually happens)

Per the SDK and relayer docs: the relayer (running in a TEE) embeds the text, SEAL-encrypts it, uploads the encrypted blob to Walrus and indexes the vector by `owner + namespace`. Recall embeds the query, searches the index, downloads and decrypts matching blobs, and returns plaintext to the server. Nia never stores the embedding or the ciphertext itself.

## Remember flow

`packages/memory/src/service.ts → persistMemory()`

1. **Policy** (`policy.ts`) decides the candidate is durable (see [MEMORY_MODEL.md](MEMORY_MODEL.md)); sensitive values are refused.
2. **Dedup**: an active record with the same `namespace + subject + sha256(normalised value)` already exists → “Already remembered” (also enforced by a partial unique index).
3. **Budget**: at most `MEMWAL_MAX_WRITES_PER_HOUR` writes per namespace per hour (cost ceiling).
4. **Supersede**: for single-valued facts and corrections, older active records for the same subject become `superseded` (kept as history, `valid_to` set).
5. **Outbox**: the memory text is kept in `memory_records.pending_text` only until Walrus confirms it (so failed writes can be retried), then cleared.
6. **Submit**: `memwal.remember(text, namespace, { idempotencyKey })` → `job_id` (the relayer does not deduplicate; the key is stable per record so retries collapse onto the same job).
7. **Durable wait**: job status is polled until `done` (blob ID) or `failed` — Mainnet jobs take ~30–60 s. The web chat closes the reply stream as soon as the receipt is `pending` (the customer can keep typing), the browser polls `/api/memory/status`, and the server keeps confirming in `after()`. Telegram only posts “🧠 Got it — I’ll remember that” after confirmation. Writes whose confirmation outlived their request (closed tab, Telegram’s time budget) are settled at the start of that customer’s next turn (`refreshPending`), so they stay recallable. **Nia never says “saved with Walrus” before the job is `done`.**

Every attempt is a row in `walrus_jobs`; failed writes can be retried from the Memory page.

## Relayer rate-limit budget

The relayer allows **60 weighted requests per minute per delegate key** and answers `429 {"layer":"delegate_key","retry_after_seconds":60}` when exceeded. The key is shared by every customer of a deployment, so Nia budgets for it:

- **Batched, shared status checks.** `refreshRecords` claims due jobs atomically in `walrus_jobs.last_checked_at` and asks about all of them in one `getRememberBulkStatus` request, at most every `MEMWAL_STATUS_MIN_INTERVAL_MS` (5 s) per job — however many pollers (browser, `after()`, Telegram, next turn) are waiting. Per-record polling every 2 s exhausted the budget in a single conversation during testing.
- **No retries into a lockout.** A 429 is never retried; it opens a process-wide cooldown for `retry_after_seconds` during which Walrus calls fail fast. Recall shows a “recall failed” chip; writes stay `pending`/`failed` with their outbox text for a later retry.
- **Fewer recalls.** Recall is skipped for namespaces with no stored records (customer, shop knowledge and shop operations are checked separately), and the model’s memory-search tools are only offered when this turn’s recall found nothing.

## Recall flow

`recallCustomerMemory()` / `recallMerchantMemory()`

1. Build targeted queries from the latest message (`recall-query.ts`); short follow-ups borrow the previous turn; repeat intents (“same as last time”) and memory questions add an order-history query.
2. `memwal.recall({ query, namespace, limit, maxDistance })` for each of the customer’s namespaces (+ the shop’s knowledge/operations namespaces).
3. Join hits to metadata by `blob_id`: drop **forgotten** memories, label **superseded** ones as `HISTORICAL`, attach type/label/provenance.
4. Only 6 customer + 3 shop memories go into the prompt, wrapped as data (`<nia_customer_memory>`), never as instructions.

Memory OFF mode (Judge Mode comparison) skips step 2 entirely.

## Forgetting

SDK 0.1.8 has no per-memory delete, and the relayer’s `POST /api/forget` drops the vector index for a *whole namespace* (blobs remain and `restore` can re-index them). Nia therefore implements **logical forgetting**: the record is marked `forgotten`, excluded from every recall and from the Passport, and any outbox text is cleared. The UI says exactly this: the encrypted copy remains on Walrus until its storage period ends.

## Restore (admin only)

`pnpm walrus:restore -- <namespace> [limit]` and the owner-only “Restore index from Walrus” button on a customer page call `memwal.restore(namespace, limit)`. Limits from the relayer docs: single-shot, no cursor, `limit` caps missing blobs processed per call, `truncated=true` means call again, and `truncated=false` is not proof every blob was seen. Restored blobs that Nia had forgotten stay excluded because exclusion is by blob ID at recall time.

## Application metadata vs Walrus data

| PostgreSQL (`memory_records`, `walrus_jobs`) | Walrus |
|---|---|
| type, normalised subject key, value **hash**, short UI label, confidence/importance/score, lifecycle (active/superseded/forgotten), persist status, blob ID, job IDs, provenance (conversation/message/order/booking), timestamps | The memory statement itself (encrypted), its embedding index (relayer) |

The short label (“Size: XL”) exists for receipts and the Passport UI; it is never sent to the model.

## Why Walrus is essential

Without Walrus, Nia has no memory across sessions or channels — Memory OFF mode shows exactly that behaviour (“Could you remind me what you ordered?”). With it, the memory is durable, encrypted, portable across devices and channels, verifiable by blob ID, and outside any single app database.

## Proof for the hackathon

- **Agent ID** = `MEMWAL_ACCOUNT_ID` (Memory page / Judge Mode, copy button).
- **Blob count** = distinct confirmed blob IDs (Memory page “Walrus blobs”, Judge Mode). Cross-check with the relayer: Judge Mode sums `memory_count` from `memwal.listNamespaces()` for your prefix; the Memory page shows the relayer count per customer namespace.
- **Customers with 10+ memories** is shown on both pages.

## Friction found while integrating (for the feedback form)

1. The default entry’s docstring says it “does NOT import account.js (which requires @mysten/sui)”, but relayer-mode calls dynamically import `@mysten/seal` and `@mysten/sui/keypairs/ed25519` to build the SEAL session — the peers are effectively required for `remember/recall`.
2. No per-memory delete in the SDK; the relayer config advertises `securityDeleteEnabled` but there is no SDK surface for it. Apps must implement logical forgetting.
3. No way to list the memories in a namespace (only `listNamespaces` counts and similarity-ranked `recall`). A “Memory Passport” UI needs an app-side index.
4. `MemWalMock` ranks by token overlap, so `maxDistance` thresholds tuned for real embeddings (≈0.8) filter out most mock hits — tests need a looser threshold.
5. The index can lag the `done` job status (documented); read-after-write needs a retry.

# Building Nia: a shop assistant that actually remembers returning customers

> **Draft.** Everything in ⟨angle brackets⟩ must be replaced with real results from your own deployment before publishing. Don’t publish numbers, screenshots or quotes you haven’t observed. Target: 500–800 words.

**How do you add memory to a customer-support or shopping chatbot so it remembers users between sessions?** This is how I built Nia, a shop assistant for independent businesses, with Walrus Memory — and what changed when it could remember.

## The problem

⟨One or two sentences from real life: e.g. a fabric seller answering “same as last time?” on WhatsApp every week.⟩ Shop chatbots can search a catalog, but they forget you the moment the tab closes. Regulars repeat their size, their delivery area and what they bought — on every visit, on every channel.

## What Nia does

Nia is a web chat and Telegram bot for merchants (fabric, salons, bakeries…). It finds real products, builds a cart, books services, and **remembers each customer**: sizes, colours, usual delivery area, occasions, complaints, corrections, and every order they place. It’s built with Next.js, the Vercel AI SDK and **Qwen 3.8 27B served by Groq**; memory lives on **Walrus Memory (Mainnet)** via `@mysten-incubation/memwal`.

## How Walrus Memory is wired in

- **One namespace per customer per shop** (`nia:merchant:<id>:customer:<id>`), derived on the server from database UUIDs — never from anything the browser sends.
- **What gets stored:** after each customer turn, a second model call proposes typed memory candidates (Zod-validated). The app — not the model — decides: explicit facts are stored, one-off instructions (“send this one to Yaba”) aren’t, and guesses (“maybe likes red”) require the customer to tap *Yes*. Placed orders are stored too, so “same as last time” works anywhere.
- **When it’s recalled:** every message triggers a targeted semantic recall; the 6 most relevant memories go into the prompt as data. Superseded values come back flagged as history.
- **Truthful receipts:** `remember()` returns a job; Nia polls the status and only shows “Saved securely with Walrus Memory” with the blob ID once the job is `done`.

## Before and after

⟨Screenshot: Judge Mode, same question in both panes.⟩

Without memory: *“⟨actual reply from the OFF pane⟩”*
With memory: *“⟨actual reply from the ON pane⟩”*

⟨Describe the moment it mattered for a real user — e.g. a tester switched from web to Telegram and Nia already knew their size and new delivery area.⟩

## Evidence of real use

- ⟨N⟩ people used the live store over ⟨N⟩ days (⟨web / Telegram⟩).
- ⟨N⟩ memories stored across ⟨N⟩ Walrus blobs; ⟨N⟩ customers have 10+ memories. Agent ID ⟨0x…⟩.
- ⟨Screenshots: receipts with blob IDs; a new session recalling; the Memory Passport.⟩
- Live link: ⟨URL⟩ · Telegram: ⟨t.me/…⟩ · Code: ⟨GitHub⟩

## What broke and what was hard

- ⟨Keep the ones you actually hit, add your own:⟩
- The SDK needs `@mysten/seal` and `@mysten/sui` installed even for relayer mode (it builds a SEAL session key client-side).
- There’s no per-memory delete, so “forget that” is implemented as exclusion at recall time — and the UI says so honestly.
- A namespace is not a security boundary: the delegate key can read them all, so identity → namespace mapping has to be airtight on the server.
- Memories are indexed a moment after the write job reports `done`, so read-after-write needs a retry.
- The relayer rate-limits each delegate key (60 weighted requests/min, shared by every customer). Polling each memory’s job status separately locked the key within one conversation; batching status checks into one request and backing off on 429 fixed it.
- Deciding *what not to remember* took more work than storing.

## What I’d improve

⟨Your list — e.g. per-memory metadata on recall, a namespace listing API, WhatsApp channel.⟩

## Try it / reproduce it

Clone the repo, set `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID` and an AI key, then `pnpm install && pnpm dev:db && pnpm db:setup && pnpm dev`. `pnpm test:walrus` writes one memory to Mainnet and recalls it with a differently-worded question.

#WalrusMemory @WalrusProtocol

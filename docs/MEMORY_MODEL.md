# Memory model

Nia should make returning customers feel known without making them feel watched: remember what helps, forget what doesn’t, never claim more than the customer said, and let them correct it.

## Memory types

`CUSTOMER_PREFERENCE, PAST_ORDER, PAST_SERVICE, PRODUCT_INTEREST, SIZE_OR_VARIANT, DELIVERY_PREFERENCE, LOCATION_PREFERENCE, BUDGET, OCCASION, RELATIONSHIP_CONTEXT, COMPLAINT, CORRECTION, MERCHANT_COMMITMENT, CUSTOMER_COMMITMENT, UNRESOLVED_REQUEST, OUTCOME, NOTE, RETURN_OR_REFUND_CONTEXT, RECOMMENDATION_RESPONSE` — `packages/shared/src/memory-types.ts`.

Each type declares its Passport section and whether it is **single-valued** (a new value supersedes the old one, e.g. size, usual delivery area) or accumulative (occasions, past orders).

## Where memories come from

| Source | How | Confirmation label |
|---|---|---|
| Conversation | Separate extraction call after each substantive customer turn → Zod-validated candidates → policy | “Confirmed by you” (explicit) |
| Consent | Inferred preference → “Should I remember this?” chip → customer taps Yes | “Confirmed by you” |
| Orders & bookings | Written by the app when the customer confirms (never from chat claims) | “Observed from orders” |
| Cancellations/refunds | Written when the shop cancels/refunds | “Added by the business” |
| Passport edits | Customer corrects a value | “Corrected by you” |
| Shop | Knowledge entries marked “remember”, operations notes | (merchant namespaces) |

## Extraction schema

```json
{
  "type": "SIZE_OR_VARIANT",
  "subject": "clothing_size",
  "value": "XL",
  "statement": "Customer's clothing size is XL.",
  "label": "Size: XL",
  "evidence": "My size is XL now, not L",
  "explicit": true,
  "confidence": 0.95,
  "importance": 0.8,
  "futureUsefulness": 0.9,
  "durability": "long_term",
  "temporalScope": "current",
  "isCorrection": true,
  "previousValue": "L"
}
```

Subjects are normalised to canonical keys (`delivery_location` → `usual_delivery_area`, `color` → `colour_preference`) so a new statement can supersede an old one even when the model words the subject differently.

## Scoring and decisions (`packages/memory/src/policy.ts`)

`score = 0.28·importance + 0.24·confidence + 0.14·durability + 0.16·futureUsefulness + 0.12·explicitness + 0.06·recency (+0.05 explicit correction)`

| Decision | When |
|---|---|
| **ignore** | sensitive data; chat claims about orders; confidence < 0.5; low importance and low usefulness; weak inferences |
| **ephemeral** | `this_order_only` (“send this one to Yaba”) or a one-time detail that isn’t a story/event |
| **confirmation_required** | inferred (not stated) with score ≥ 0.5, or explicit but uncertain |
| **durable** | explicit, confidence ≥ 0.75 and score ≥ 0.55 — also story memories (occasions, complaints, promises) even if the event was one-off |

The model proposes; the application decides.

## Temporal & corrections

- “My size is XL now, not L” → new active record (XL), the L record becomes `superseded` with `valid_to` set; the Walrus text of the new memory also says `This replaces the earlier value "L"`. Recall labels L as HISTORICAL so Nia still reads old orders correctly.
- “Send this one to Yaba” → only the order’s delivery area changes; no memory.
- “I’ve moved — use Yaba from now on” → correction; Lekki kept as history: *“Your latest delivery preference is Yaba. You previously used Lekki.”*

## Dedup & idempotency

Same namespace + canonical subject + hash of the normalised value while active → no new write (DB partial unique index). Each record has a stable idempotency key used for relayer retries.

## Provenance

Every record stores `source_kind`, channel, conversation/message/order/booking IDs and a short evidence quote — powering “Why?” in the Passport and “Why Nia said this” in chat.

## Recall discipline

Up to 6 customer memories + 3 shop memories per turn, chosen by semantic similarity to a targeted query; historical items flagged; forgotten items excluded; memory text is framed as data. The system prompt forbids overstating (“you’ve chosen blue twice”, not “you love blue”) and requires a short clarification when history is ambiguous.

## Forget & correct

Customers can say “don’t remember that” (the model calls `forgetCustomerMemory` with the recalled reference) or use the Passport. Forgetting is logical — see [WALRUS.md](WALRUS.md#forgetting). Customers can also switch memory off entirely for a shop; merchants can switch it off for their store.

## Session state vs long-term memory

A conversation also has a **shopping session** (`conversations.session`): the current goal and constraints, the results Nia showed, the shortlist, a list and a proposed basket. It is operational context for *this* conversation, kept in PostgreSQL and never written to Walrus. “I'm shopping for my brother today”, “not red today” and a basket for tonight's party live there. Durable facts (“I don't like red”, “I wear Large now”, “my sister loves minimalist jewellery”) reach Walrus only through extraction and the policy above. When a customer asks to continue earlier shopping, the previous conversation's session (last 14 days) is offered to the model; it is never resurrected unprompted.

## “What do you remember about me?”

`showMyMemory` groups the customer's **current, Walrus-stored** memories (Sizes & options, Colours & style, Brands, Delivery, Budget, People & occasions, Looking for, Service history, Likes & dislikes) with how sure Nia is:

| Shown as | From confirmation |
|---|---|
| Confirmed | `customer_stated`, `customer_confirmed`, `customer_corrected` |
| Observed | `observed_from_orders` |
| Likely | `inferred` (only stored after the customer agreed) |

Corrections show what they replaced (“updated · was Lekki”); forgotten, superseded, pending and tombstoned records are never listed as current. The card's labels are UI text; the model answers from the same memories recalled from Walrus in that turn (`packages/memory/src/profile.ts`).

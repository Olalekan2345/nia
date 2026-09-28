/**
 * Nia memory service — the only code path that reads or writes Walrus Memory.
 *
 *   remember:  policy → dedup/supersede (SQL metadata) → relayer job → receipt
 *   confirm:   poll relayer job status until `done` → blob id → "Remembered"
 *   recall:    Walrus semantic recall per namespace → join metadata by blob id
 *              → drop forgotten → mark superseded as historical
 *
 * The model only ever sees memory text that came back from a Walrus recall.
 */
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import {
  customers,
  memoryCandidates,
  memoryRecords,
  walrusJobs,
  audit,
  type Db,
  type MemoryRecord,
} from "@nia/database";
import { walrusConfig } from "@nia/config";
import {
  MEMORY_TYPE_META,
  normalizeValue,
  type Channel,
  type MemoryConfirmation,
  type MemoryDurability,
  type MemoryScope,
  type MemoryType,
  containsSensitive,
} from "@nia/shared";
import { newId, sha256Hex } from "@nia/shared/server";
import { customerNamespace, merchantKnowledgeNamespace, merchantOperationsNamespace, namespaceFor } from "./namespaces";
import { canonicalSubject, type MemoryCandidate } from "./schema";
import { classifyCandidate, type PolicyDecision } from "./policy";
import { composeMemoryText } from "./statement";
import type { MemoryBackend, MemoryStore } from "./store";
import type { RememberJobStatus } from "@mysten-incubation/memwal";

/* ─────────────────────────────── Types ─────────────────────────────── */

export type ReceiptStatus = "pending" | "stored" | "failed" | "duplicate" | "skipped";

export interface MemoryReceipt {
  recordId: string | null;
  type: MemoryType;
  label: string;
  scope: MemoryScope;
  status: ReceiptStatus;
  confirmation: MemoryConfirmation;
  blobId: string | null;
  jobId: string | null;
  namespace: string | null;
  storedAt: string | null;
  backend: MemoryBackend | null;
  network: string | null;
  supersededCount: number;
  reason?: string;
}

export interface CandidateOutcome {
  candidate: MemoryCandidate;
  decision: PolicyDecision;
  receipt?: MemoryReceipt;
  /** Set when the customer must confirm before Nia remembers it. */
  pendingCandidateId?: string;
}

export interface Provenance {
  sourceKind: MemoryRecord["sourceKind"];
  channel?: Channel | null;
  conversationId?: string | null;
  messageId?: string | null;
  orderId?: string | null;
  bookingId?: string | null;
}

export interface PersistInput extends Provenance {
  merchantId: string;
  customerId: string | null;
  scope: MemoryScope;
  type: MemoryType;
  subject: string;
  value: string;
  statement: string;
  label: string;
  confirmation: MemoryConfirmation;
  explicit: boolean;
  confidence: number;
  importance: number;
  durability: MemoryDurability;
  score: number;
  significant: boolean;
  previousValue?: string | null;
  evidence?: string | null;
  /** Supersede other active values for this subject (single-valued facts and corrections). */
  supersede?: boolean;
}

export interface RecalledMemory {
  /** Reference shown to the model ("M1") so it can cite or forget a memory without seeing ids. */
  ref: string;
  blobId: string;
  text: string;
  distance: number;
  scope: MemoryScope;
  namespace: string;
  createdAt: string | null;
  record: Pick<
    MemoryRecord,
    "id" | "type" | "label" | "lifecycle" | "confirmation" | "validFrom" | "validTo" | "sourceKind" | "subjectKey"
  > | null;
  /** Superseded by a newer memory: still useful for interpreting history, not current. */
  historical: boolean;
}

/* ─────────────────────────────── Helpers ─────────────────────────────── */

function prefix(): string {
  return walrusConfig().namespacePrefix;
}

export function receiptFromRecord(r: MemoryRecord, store: MemoryStore | null, extra?: Partial<MemoryReceipt>): MemoryReceipt {
  return {
    recordId: r.id,
    type: r.type,
    label: r.label,
    scope: r.scope,
    status: r.persistStatus,
    confirmation: r.confirmation,
    blobId: r.blobId,
    jobId: r.walrusJobId,
    namespace: r.namespace,
    storedAt: r.storedAt ? r.storedAt.toISOString() : null,
    backend: store?.backend ?? null,
    network: store?.network ?? null,
    supersededCount: 0,
    ...extra,
  };
}

function skippedReceipt(input: Pick<PersistInput, "type" | "label" | "scope" | "confirmation">, reason: string): MemoryReceipt {
  return {
    recordId: null,
    type: input.type,
    label: input.label,
    scope: input.scope,
    status: "skipped",
    confirmation: input.confirmation,
    blobId: null,
    jobId: null,
    namespace: null,
    storedAt: null,
    backend: null,
    network: null,
    supersededCount: 0,
    reason,
  };
}

/** All Walrus namespaces that hold this customer's memory (own + any merged-in duplicates). */
export async function customerNamespaces(db: Db, merchantId: string, customerId: string): Promise<string[]> {
  const merged = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.merchantId, merchantId), eq(customers.mergedIntoId, customerId)));
  return [customerId, ...merged.map((m) => m.id)].map((id) => customerNamespace(prefix(), merchantId, id));
}

/* ─────────────────────────────── Write path ─────────────────────────────── */

/**
 * Persist one approved memory: dedup, supersede, budget, submit to the relayer.
 * Returns immediately after the relayer accepts the job (status "pending");
 * call `awaitDurable` / `refreshRecords` to confirm storage.
 */
export async function persistMemory(db: Db, store: MemoryStore | null, input: PersistInput): Promise<MemoryReceipt> {
  if (!store) return skippedReceipt(input, "Walrus Memory is not configured");
  if ([input.statement, input.value, input.label].some((t) => containsSensitive(t))) {
    return skippedReceipt(input, "Sensitive data is never stored");
  }
  if (input.scope === "customer" && !input.customerId) {
    return skippedReceipt(input, "Customer memory requires an identified customer");
  }

  const namespace = namespaceFor(prefix(), input.scope, input.merchantId, input.customerId);
  const subjectKey = canonicalSubject(input.subject);
  const valueHash = sha256Hex(normalizeValue(input.value));

  // 1. Dedup — the same current fact is already remembered.
  const [existing] = await db
    .select()
    .from(memoryRecords)
    .where(
      and(
        eq(memoryRecords.namespace, namespace),
        eq(memoryRecords.subjectKey, subjectKey),
        eq(memoryRecords.valueHash, valueHash),
        eq(memoryRecords.lifecycle, "active"),
      ),
    )
    .limit(1);
  if (existing && existing.persistStatus !== "failed") {
    return receiptFromRecord(existing, store, { status: "duplicate", reason: "Already remembered" });
  }
  if (existing && existing.persistStatus === "failed") {
    // A previous attempt failed — retry it instead of creating a second copy.
    return submitRecord(db, store, existing);
  }

  // 2. Cost ceiling — durable writes per namespace per hour.
  const cfg = walrusConfig();
  const [{ recent } = { recent: 0 }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(memoryRecords)
    .where(and(eq(memoryRecords.namespace, namespace), gte(memoryRecords.createdAt, new Date(Date.now() - 3600_000))));
  if (recent >= cfg.maxWritesPerHour) {
    return skippedReceipt(input, "Memory write budget reached for this hour");
  }

  const recordId = newId();
  const now = new Date();
  const text = composeMemoryText({
    type: input.type,
    statement: input.statement,
    confirmation: input.confirmation,
    recordedAt: now,
    previousValue: input.previousValue,
    channel: input.channel,
  });

  const singleValued = MEMORY_TYPE_META[input.type].singleValued;
  const shouldSupersede = input.supersede ?? (singleValued || input.confirmation === "customer_corrected");

  let supersededCount = 0;
  let record: MemoryRecord | undefined;
  try {
    record = await db.transaction(async (tx) => {
      let supersedesId: string | null = null;
      if (shouldSupersede) {
        const replaced = await tx
          .update(memoryRecords)
          .set({ lifecycle: "superseded", validTo: now, supersededById: recordId })
          .where(
            and(
              eq(memoryRecords.namespace, namespace),
              eq(memoryRecords.subjectKey, subjectKey),
              eq(memoryRecords.lifecycle, "active"),
            ),
          )
          .returning({ id: memoryRecords.id });
        supersededCount = replaced.length;
        supersedesId = replaced[0]?.id ?? null;
      }
      const [row] = await tx
        .insert(memoryRecords)
        .values({
          id: recordId,
          merchantId: input.merchantId,
          customerId: input.customerId,
          scope: input.scope,
          namespace,
          type: input.type,
          subjectKey,
          valueHash,
          label: input.label.slice(0, 140),
          confirmation: input.confirmation,
          explicit: input.explicit,
          confidence: input.confidence,
          importance: input.importance,
          durability: input.durability,
          score: input.score,
          significant: input.significant,
          lifecycle: "active",
          persistStatus: "pending",
          validFrom: now,
          supersedesId,
          sourceKind: input.sourceKind,
          channel: input.channel ?? null,
          conversationId: input.conversationId ?? null,
          messageId: input.messageId ?? null,
          orderId: input.orderId ?? null,
          bookingId: input.bookingId ?? null,
          evidence: input.evidence?.slice(0, 300) ?? null,
          idempotencyKey: sha256Hex(`${namespace}|${recordId}`),
          pendingText: text,
        })
        .returning();
      return row;
    });
  } catch (err) {
    // Unique partial index: a concurrent request stored the same fact first.
    if (String((err as Error).message).includes("memory_records_active_fact_unique")) {
      const [dup] = await db
        .select()
        .from(memoryRecords)
        .where(
          and(
            eq(memoryRecords.namespace, namespace),
            eq(memoryRecords.subjectKey, subjectKey),
            eq(memoryRecords.valueHash, valueHash),
            eq(memoryRecords.lifecycle, "active"),
          ),
        )
        .limit(1);
      if (dup) return receiptFromRecord(dup, store, { status: "duplicate", reason: "Already remembered" });
    }
    throw err;
  }

  const receipt = await submitRecord(db, store, record!);
  return { ...receipt, supersededCount };
}

/** Submit (or resubmit) a record's outbox text to the relayer. */
async function submitRecord(db: Db, store: MemoryStore, record: MemoryRecord): Promise<MemoryReceipt> {
  if (!record.pendingText) {
    return receiptFromRecord(record, store, { status: "failed", reason: "Nothing to resubmit" });
  }
  const [job] = await db
    .insert(walrusJobs)
    .values({ memoryRecordId: record.id, merchantId: record.merchantId, namespace: record.namespace, status: "submitting" })
    .returning();
  try {
    const accepted = await store.remember(record.pendingText, record.namespace, record.idempotencyKey);
    await db.update(walrusJobs).set({ jobId: accepted.job_id, status: "pending" }).where(eq(walrusJobs.id, job!.id));
    const [updated] = await db
      .update(memoryRecords)
      .set({ walrusJobId: accepted.job_id, persistStatus: "pending", attempts: sql`${memoryRecords.attempts} + 1`, lastError: null })
      .where(eq(memoryRecords.id, record.id))
      .returning();
    return receiptFromRecord(updated!, store);
  } catch (err) {
    const message = sanitizeError(err);
    await db.update(walrusJobs).set({ status: "failed", error: message, completedAt: new Date() }).where(eq(walrusJobs.id, job!.id));
    const [updated] = await db
      .update(memoryRecords)
      .set({ persistStatus: "failed", attempts: sql`${memoryRecords.attempts} + 1`, lastError: message })
      .where(eq(memoryRecords.id, record.id))
      .returning();
    return receiptFromRecord(updated!, store, { reason: message });
  }
}

function sanitizeError(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const msg = (err as Error)?.message ?? String(err);
  // Never persist anything that could echo a key or header.
  const clean = msg.replace(/[0-9a-f]{40,}/gi, "[redacted]").replace(/suiprivkey1\w+/gi, "[redacted]").slice(0, 300);
  return status ? `${status}: ${clean}` : clean;
}

/**
 * Poll relayer job status for the given records and update metadata.
 * This is what flips a receipt from "pending" to a real "stored" with blob id.
 *
 * Every poller (chat client, post-response wait, Telegram, the next turn)
 * goes through here, so each job is claimed in the database and asked about
 * at most once per MEMWAL_STATUS_MIN_INTERVAL_MS, in one batched relayer request.
 */
export async function refreshRecords(db: Db, store: MemoryStore | null, recordIds: string[], scope?: { merchantId: string }): Promise<MemoryReceipt[]> {
  if (recordIds.length === 0) return [];
  const conditions = [inArray(memoryRecords.id, recordIds)];
  if (scope) conditions.push(eq(memoryRecords.merchantId, scope.merchantId));
  const rows = await db.select().from(memoryRecords).where(and(...conditions));
  if (!store) return rows.map((r) => receiptFromRecord(r, store));

  const pending = rows.filter((r) => r.persistStatus === "pending" && r.walrusJobId);
  if (pending.length === 0) return rows.map((r) => receiptFromRecord(r, store));

  const cutoff = new Date(Date.now() - walrusConfig().statusMinIntervalMs);
  const claimed = await db
    .update(walrusJobs)
    .set({ lastCheckedAt: new Date() })
    .where(
      and(
        inArray(walrusJobs.memoryRecordId, pending.map((r) => r.id)),
        or(isNull(walrusJobs.lastCheckedAt), lte(walrusJobs.lastCheckedAt, cutoff)),
      ),
    )
    .returning({ memoryRecordId: walrusJobs.memoryRecordId, jobId: walrusJobs.jobId });
  const due = pending.filter((r) => claimed.some((c) => c.memoryRecordId === r.id && c.jobId === r.walrusJobId));

  const updated = new Map<string, MemoryReceipt>();
  if (due.length) {
    try {
      const statuses = await store.getRememberStatuses(due.map((r) => r.walrusJobId!));
      for (const r of due) {
        const status = statuses.find((st) => st.job_id === r.walrusJobId);
        if (status) updated.set(r.id, await applyJobStatus(db, store, r, status));
      }
    } catch (err) {
      const reason = sanitizeError(err);
      for (const r of due) updated.set(r.id, receiptFromRecord(r, store, { reason }));
    }
  }
  return rows.map((r) => updated.get(r.id) ?? receiptFromRecord(r, store));
}

async function applyJobStatus(db: Db, store: MemoryStore, r: MemoryRecord, status: RememberJobStatus): Promise<MemoryReceipt> {
  const now = new Date();
  await db
    .update(walrusJobs)
    .set({
      status: status.status,
      blobId: status.blob_id ?? null,
      error: status.error ?? null,
      lastCheckedAt: now,
      ...(status.status === "done" || status.status === "failed" || status.status === "not_found" ? { completedAt: now } : {}),
    })
    .where(and(eq(walrusJobs.memoryRecordId, r.id), eq(walrusJobs.jobId, r.walrusJobId!)));
  if (status.status === "done" && status.blob_id) {
    const [u] = await db
      .update(memoryRecords)
      .set({ persistStatus: "stored", blobId: status.blob_id, ...(status.owner ? { walrusOwner: status.owner } : {}), storedAt: now, pendingText: null, lastError: null })
      .where(eq(memoryRecords.id, r.id))
      .returning();
    return receiptFromRecord(u!, store);
  }
  if (status.status === "failed" || status.status === "not_found") {
    const [u] = await db
      .update(memoryRecords)
      .set({ persistStatus: "failed", lastError: status.error ?? status.status })
      .where(eq(memoryRecords.id, r.id))
      .returning();
    return receiptFromRecord(u!, store);
  }
  return receiptFromRecord(r, store);
}

/**
 * Settle writes still pending for this customer (incl. merged records) and this
 * shop. Walrus jobs can outlast the request that submitted them (closed tab,
 * Telegram time budget); settling before recall keeps them recallable.
 */
export async function refreshPending(db: Db, store: MemoryStore | null, { merchantId, customerId, limit = 10 }: { merchantId: string; customerId: string | null; limit?: number }): Promise<MemoryReceipt[]> {
  if (!store) return [];
  const whose = customerId
    ? or(ne(memoryRecords.scope, "customer"), eq(memoryRecords.customerId, customerId), sql`${memoryRecords.customerId} in (select ${customers.id} from ${customers} where ${customers.mergedIntoId} = ${customerId})`)
    : ne(memoryRecords.scope, "customer");
  const pending = await db
    .select({ id: memoryRecords.id })
    .from(memoryRecords)
    .where(and(eq(memoryRecords.merchantId, merchantId), eq(memoryRecords.persistStatus, "pending"), isNotNull(memoryRecords.walrusJobId), whose))
    .limit(limit);
  return pending.length ? refreshRecords(db, store, pending.map((p) => p.id), { merchantId }) : [];
}

/** Durable wait: poll until every record is stored/failed or the budget runs out. */
export async function awaitDurable(
  db: Db,
  store: MemoryStore | null,
  recordIds: string[],
  { timeoutMs = 25_000, intervalMs = 2500 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<MemoryReceipt[]> {
  const deadline = Date.now() + timeoutMs;
  let receipts = await refreshRecords(db, store, recordIds);
  let delay = Math.min(800, intervalMs);
  while (receipts.some((r) => r.status === "pending") && Date.now() < deadline) {
    await new Promise((res) => setTimeout(res, delay));
    delay = Math.min(delay * 1.4, intervalMs * 2);
    receipts = await refreshRecords(
      db,
      store,
      receipts.filter((r) => r.status === "pending").map((r) => r.recordId!),
    ).then((updated) => receipts.map((r) => updated.find((u) => u.recordId === r.recordId) ?? r));
  }
  return receipts;
}

/** Retry failed writes that still have outbox text (e.g. from a cron or the admin explorer). */
export async function retryFailed(db: Db, store: MemoryStore | null, { merchantId, limit = 20 }: { merchantId?: string; limit?: number } = {}): Promise<MemoryReceipt[]> {
  if (!store) return [];
  const conditions = [eq(memoryRecords.persistStatus, "failed"), eq(memoryRecords.lifecycle, "active"), isNotNull(memoryRecords.pendingText)];
  if (merchantId) conditions.push(eq(memoryRecords.merchantId, merchantId));
  const rows = await db.select().from(memoryRecords).where(and(...conditions)).orderBy(desc(memoryRecords.createdAt)).limit(limit);
  const out: MemoryReceipt[] = [];
  for (const r of rows) out.push(await submitRecord(db, store, r));
  return out;
}

/* ─────────────────────────────── Candidates (from extraction) ─────────────────────────────── */

export interface CandidateContext extends Provenance {
  merchantId: string;
  customerId: string;
}

/** Apply the policy to extracted candidates and persist the durable ones. */
export async function processCandidates(
  db: Db,
  store: MemoryStore | null,
  ctx: CandidateContext,
  candidates: MemoryCandidate[],
): Promise<CandidateOutcome[]> {
  const outcomes: CandidateOutcome[] = [];
  for (const candidate of candidates) {
    const decision = classifyCandidate(candidate);
    if (decision.decision === "durable") {
      const receipt = await persistMemory(db, store, {
        ...ctx,
        scope: "customer",
        type: candidate.type,
        subject: candidate.subject,
        value: candidate.value,
        statement: candidate.statement,
        label: candidate.label,
        confirmation: decision.confirmation,
        explicit: candidate.explicit,
        confidence: candidate.confidence,
        importance: candidate.importance,
        durability: candidate.durability,
        score: decision.score,
        significant: decision.significant,
        previousValue: candidate.previousValue,
        evidence: candidate.evidence,
        supersede: candidate.isCorrection || MEMORY_TYPE_META[candidate.type].singleValued,
      });
      outcomes.push({ candidate, decision, receipt });
    } else if (decision.decision === "confirmation_required") {
      const [row] = await db
        .insert(memoryCandidates)
        .values({
          merchantId: ctx.merchantId,
          customerId: ctx.customerId,
          conversationId: ctx.conversationId ?? null,
          messageId: ctx.messageId ?? null,
          payload: { candidate, score: decision.score, channel: ctx.channel ?? null },
          expiresAt: new Date(Date.now() + 7 * 86400_000),
        })
        .returning({ id: memoryCandidates.id });
      outcomes.push({ candidate, decision, pendingCandidateId: row!.id });
    } else {
      outcomes.push({ candidate, decision });
    }
  }
  return outcomes;
}

/** Customer answered "Should I remember that?" */
export async function resolveCandidate(
  db: Db,
  store: MemoryStore | null,
  { merchantId, customerId, candidateId, accept }: { merchantId: string; customerId: string; candidateId: string; accept: boolean },
): Promise<MemoryReceipt | null> {
  const [row] = await db
    .select()
    .from(memoryCandidates)
    .where(
      and(
        eq(memoryCandidates.id, candidateId),
        eq(memoryCandidates.merchantId, merchantId),
        eq(memoryCandidates.customerId, customerId),
        eq(memoryCandidates.status, "awaiting"),
      ),
    );
  if (!row || !row.payload) return null;
  if (!accept || row.expiresAt < new Date()) {
    await db.update(memoryCandidates).set({ status: accept ? "expired" : "declined", payload: null }).where(eq(memoryCandidates.id, row.id));
    return null;
  }
  const payload = row.payload as { candidate: MemoryCandidate; score: number; channel: Channel | null };
  const c = payload.candidate;
  const receipt = await persistMemory(db, store, {
    merchantId,
    customerId,
    scope: "customer",
    type: c.type,
    subject: c.subject,
    value: c.value,
    statement: c.statement,
    label: c.label,
    confirmation: "customer_confirmed",
    explicit: true,
    confidence: 1,
    importance: c.importance,
    durability: c.durability,
    score: Math.max(payload.score, 0.7),
    significant: true,
    previousValue: c.previousValue,
    evidence: c.evidence,
    sourceKind: "confirmation",
    channel: payload.channel,
    conversationId: row.conversationId,
    messageId: row.messageId,
    supersede: c.isCorrection || MEMORY_TYPE_META[c.type].singleValued,
  });
  await db.update(memoryCandidates).set({ status: "accepted", payload: null }).where(eq(memoryCandidates.id, row.id));
  return receipt;
}

/* ─────────────────────────────── Read path ─────────────────────────────── */

async function joinRecalled(
  db: Db,
  merchantId: string,
  hits: { blobId: string; text: string; distance: number; createdAt: string | null; namespace: string; scope: MemoryScope }[],
  refPrefix: string,
  limit: number,
): Promise<RecalledMemory[]> {
  if (hits.length === 0) return [];
  const blobIds = [...new Set(hits.map((h) => h.blobId))];
  const records = await db
    .select()
    .from(memoryRecords)
    .where(and(eq(memoryRecords.merchantId, merchantId), inArray(memoryRecords.blobId, blobIds)));
  const byBlob = new Map(records.map((r) => [r.blobId!, r]));

  const seen = new Set<string>();
  const out: RecalledMemory[] = [];
  for (const h of hits.sort((a, b) => a.distance - b.distance)) {
    if (seen.has(h.blobId)) continue;
    seen.add(h.blobId);
    const r = byBlob.get(h.blobId) ?? null;
    if (r?.lifecycle === "forgotten") continue; // logically forgotten — never shown to the model
    out.push({
      ref: "",
      blobId: h.blobId,
      text: h.text,
      distance: Math.round(h.distance * 1000) / 1000,
      scope: h.scope,
      namespace: h.namespace,
      createdAt: h.createdAt,
      record: r
        ? {
            id: r.id,
            type: r.type,
            label: r.label,
            lifecycle: r.lifecycle,
            confirmation: r.confirmation,
            validFrom: r.validFrom,
            validTo: r.validTo,
            sourceKind: r.sourceKind,
            subjectKey: r.subjectKey,
          }
        : null,
      historical: r?.lifecycle === "superseded",
    });
    if (out.length >= limit) break;
  }
  return out.map((m, i) => ({ ...m, ref: `${refPrefix}${i + 1}` }));
}

/**
 * Semantic recall of one customer's memory from Walrus. Several focused
 * queries can be passed (e.g. the message itself + an order-history query for
 * "same as last time"); hits are merged by blob id keeping the best distance.
 */
export async function recallCustomerMemory(
  db: Db,
  store: MemoryStore | null,
  {
    merchantId,
    customerId,
    query,
    limit = 6,
    maxDistance = walrusConfig().recallMaxDistance,
  }: { merchantId: string; customerId: string; query: string | string[]; limit?: number; maxDistance?: number },
): Promise<RecalledMemory[]> {
  const queries = (Array.isArray(query) ? query : [query]).map((q) => q.trim()).filter(Boolean).slice(0, 3);
  if (!store || queries.length === 0) return [];
  const namespaces = await customerNamespaces(db, merchantId, customerId);
  const results = await Promise.all(
    namespaces.flatMap((namespace) =>
      queries.map(async (q) => {
        const res = await store.recall({ query: q, namespace, limit: limit + 4, maxDistance });
        return res.results.map((r) => ({
          blobId: r.blob_id,
          text: r.text,
          distance: r.distance,
          createdAt: r.created_at ?? null,
          namespace,
          scope: "customer" as const,
        }));
      }),
    ),
  );
  return joinRecalled(db, merchantId, results.flat(), "M", limit);
}

/** Semantic recall of the merchant's own knowledge / operations memory. */
export async function recallMerchantMemory(
  db: Db,
  store: MemoryStore | null,
  {
    merchantId,
    query,
    limit = 4,
    maxDistance = walrusConfig().recallMaxDistance,
    scopes = ["merchant_knowledge", "merchant_operations"],
  }: { merchantId: string; query: string; limit?: number; maxDistance?: number; scopes?: MemoryScope[] },
): Promise<RecalledMemory[]> {
  if (!store || !query.trim()) return [];
  const targets = (
    [
      { namespace: merchantKnowledgeNamespace(prefix(), merchantId), scope: "merchant_knowledge" },
      { namespace: merchantOperationsNamespace(prefix(), merchantId), scope: "merchant_operations" },
    ] satisfies { namespace: string; scope: MemoryScope }[]
  ).filter((t) => scopes.includes(t.scope));
  const results = await Promise.all(
    targets.map(async ({ namespace, scope }) => {
      const res = await store.recall({ query, namespace, limit, maxDistance });
      return res.results.map((r) => ({ blobId: r.blob_id, text: r.text, distance: r.distance, createdAt: r.created_at ?? null, namespace, scope }));
    }),
  );
  return joinRecalled(db, merchantId, results.flat(), "B", limit);
}

/* ─────────────────────────────── Forget & correct ─────────────────────────────── */

/**
 * Logical forgetting. Walrus Memory has no per-memory delete: blobs are
 * encrypted and remain on Walrus until their storage period ends. Nia excludes
 * a forgotten memory from every future recall and from the Passport, and
 * clears any outbox text we still held.
 */
export async function forgetMemory(
  db: Db,
  { merchantId, customerId, recordId, actor }: { merchantId: string; customerId: string; recordId: string; actor: { type: "customer" | "user"; id: string } },
): Promise<boolean> {
  const updated = await db
    .update(memoryRecords)
    .set({ lifecycle: "forgotten", forgottenAt: new Date(), pendingText: null })
    .where(and(eq(memoryRecords.id, recordId), eq(memoryRecords.merchantId, merchantId), eq(memoryRecords.customerId, customerId)))
    .returning({ id: memoryRecords.id });
  if (updated.length === 0) return false;
  await audit(db, { merchantId, actorType: actor.type, actorId: actor.id, action: "memory.forget", targetType: "memory_record", targetId: recordId });
  return true;
}

/** Forget a recalled memory by blob id (also covers memories without a metadata row, e.g. restored ones). */
export async function forgetRecalledBlob(
  db: Db,
  { merchantId, customerId, blobId, namespace, actor }: { merchantId: string; customerId: string; blobId: string; namespace: string; actor: { type: "customer" | "user"; id: string } },
): Promise<boolean> {
  const allowed = await customerNamespaces(db, merchantId, customerId);
  if (!allowed.includes(namespace)) return false;
  const [row] = await db
    .select({ id: memoryRecords.id })
    .from(memoryRecords)
    .where(and(eq(memoryRecords.blobId, blobId), eq(memoryRecords.merchantId, merchantId), eq(memoryRecords.customerId, customerId)));
  if (row) return forgetMemory(db, { merchantId, customerId, recordId: row.id, actor });
  // Tombstone so future recalls exclude it.
  const id = newId();
  await db.insert(memoryRecords).values({
    id,
    merchantId,
    customerId,
    scope: "customer",
    namespace,
    type: "NOTE",
    subjectKey: `tombstone_${blobId.slice(0, 24)}`,
    valueHash: sha256Hex(blobId),
    label: "Forgotten memory",
    confirmation: "customer_stated",
    lifecycle: "forgotten",
    persistStatus: "stored",
    blobId,
    forgottenAt: new Date(),
    sourceKind: "passport",
    idempotencyKey: sha256Hex(`tombstone|${namespace}|${blobId}`),
  }).onConflictDoNothing();
  await audit(db, { merchantId, actorType: actor.type, actorId: actor.id, action: "memory.forget_blob", targetType: "blob", targetId: blobId });
  return true;
}

/* ─────────────────────────────── Passport ─────────────────────────────── */

export interface PassportEntry {
  id: string;
  type: MemoryType;
  label: string;
  confirmation: MemoryConfirmation;
  lifecycle: MemoryRecord["lifecycle"];
  persistStatus: MemoryRecord["persistStatus"];
  blobId: string | null;
  storedAt: string | null;
  validFrom: string;
  validTo: string | null;
  sourceKind: MemoryRecord["sourceKind"];
  channel: Channel | null;
  evidence: string | null;
  subjectKey: string;
  supersedesId: string | null;
  namespace: string;
}

export async function customerPassport(db: Db, { merchantId, customerId }: { merchantId: string; customerId: string }): Promise<PassportEntry[]> {
  const namespaces = await customerNamespaces(db, merchantId, customerId);
  const rows = await db
    .select()
    .from(memoryRecords)
    .where(and(eq(memoryRecords.merchantId, merchantId), inArray(memoryRecords.namespace, namespaces), sql`${memoryRecords.lifecycle} <> 'forgotten'`))
    .orderBy(desc(memoryRecords.validFrom))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    label: r.label,
    confirmation: r.confirmation,
    lifecycle: r.lifecycle,
    persistStatus: r.persistStatus,
    blobId: r.blobId,
    storedAt: r.storedAt?.toISOString() ?? null,
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo?.toISOString() ?? null,
    sourceKind: r.sourceKind,
    channel: r.channel,
    evidence: r.evidence,
    subjectKey: r.subjectKey,
    supersedesId: r.supersedesId,
    namespace: r.namespace,
  }));
}

/* ─────────────────────────────── Merchant memory ─────────────────────────────── */

export async function rememberMerchantFact(
  db: Db,
  store: MemoryStore | null,
  input: { merchantId: string; kind: "knowledge" | "operations"; text: string; label: string; subject?: string; actorUserId?: string },
): Promise<MemoryReceipt> {
  const scope: MemoryScope = input.kind === "knowledge" ? "merchant_knowledge" : "merchant_operations";
  const statement = input.text.trim();
  const receipt = await persistMemory(db, store, {
    merchantId: input.merchantId,
    customerId: null,
    scope,
    type: "NOTE",
    subject: input.subject ?? `note_${sha256Hex(normalizeValue(statement)).slice(0, 12)}`,
    value: statement,
    statement: `Business ${input.kind === "knowledge" ? "knowledge" : "operations note"}: ${statement}`,
    label: input.label,
    confirmation: "merchant_entered",
    explicit: true,
    confidence: 1,
    importance: 0.8,
    durability: "long_term",
    score: 0.9,
    significant: true,
    sourceKind: "merchant_entry",
    supersede: Boolean(input.subject),
  });
  if (input.actorUserId) {
    await audit(db, {
      merchantId: input.merchantId,
      actorType: "user",
      actorId: input.actorUserId,
      action: "memory.merchant_fact",
      targetType: "memory_record",
      targetId: receipt.recordId ?? undefined,
    });
  }
  return receipt;
}

/** Archive a merchant memory (logical — excluded from recall). */
export async function archiveMerchantMemory(db: Db, { merchantId, recordId }: { merchantId: string; recordId: string }): Promise<boolean> {
  const updated = await db
    .update(memoryRecords)
    .set({ lifecycle: "forgotten", forgottenAt: new Date(), pendingText: null })
    .where(and(eq(memoryRecords.id, recordId), eq(memoryRecords.merchantId, merchantId), sql`${memoryRecords.customerId} is null`))
    .returning({ id: memoryRecords.id });
  return updated.length > 0;
}

export { customerNamespace };

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { memoryRecords, walrusJobs, customers, type Database } from "@nia/database";
import { setupTestDb, createMerchant, createCustomer, createUser } from "@nia/database/testing";
import { resetEnvCache } from "@nia/config";
import {
  awaitDurable,
  customerNamespace,
  customerPassport,
  forgetMemory,
  persistMemory,
  processCandidates,
  recallCustomerMemory,
  recallMerchantMemory,
  refreshPending,
  refreshRecords,
  rememberMerchantFact,
  rememberPastOrder,
  resolveCandidate,
  retryFailed,
  walrusCooldownMs,
  wrapClient,
  type MemoryStore,
  type PersistInput,
} from "../src";
import type { MemoryCandidate } from "../src/schema";
import { createMockStore } from "../src/testing";

let db: Database;
let close: () => Promise<void>;
let store: MemoryStore;

beforeAll(async () => {
  resetEnvCache();
  ({ db, close } = await setupTestDb());
});
afterAll(async () => close());
beforeEach(() => {
  store = createMockStore();
});

function pref(merchantId: string, customerId: string, overrides: Partial<PersistInput> = {}): PersistInput {
  return {
    merchantId,
    customerId,
    scope: "customer",
    type: "SIZE_OR_VARIANT",
    subject: "clothing_size",
    value: "Medium",
    statement: "Customer normally buys size Medium.",
    label: "Size: Medium",
    confirmation: "customer_stated",
    explicit: true,
    confidence: 1,
    importance: 0.8,
    durability: "long_term",
    score: 0.9,
    significant: true,
    sourceKind: "conversation",
    channel: "web",
    ...overrides,
  };
}

async function setup() {
  const merchant = await createMerchant(db);
  const user = await createUser(db);
  const customer = await createCustomer(db, merchant.id, { userId: user.id });
  return { merchant, customer };
}

describe("persist → durable confirmation", () => {
  it("only reports stored after the relayer job is done, with a real blob id", async () => {
    const { merchant, customer } = await setup();
    const receipt = await persistMemory(db, store, pref(merchant.id, customer.id));
    expect(receipt.status).toBe("pending");
    expect(receipt.jobId).toBeTruthy();
    expect(receipt.blobId).toBeNull();

    const [confirmed] = await awaitDurable(db, store, [receipt.recordId!], { timeoutMs: 5000 });
    expect(confirmed!.status).toBe("stored");
    expect(confirmed!.blobId).toBeTruthy();
    expect(confirmed!.namespace).toBe(customerNamespace("nia-test", merchant.id, customer.id));

    const [row] = await db.select().from(memoryRecords).where(eq(memoryRecords.id, receipt.recordId!));
    expect(row!.pendingText).toBeNull(); // outbox cleared once Walrus confirmed
    const jobs = await db.select().from(walrusJobs).where(eq(walrusJobs.memoryRecordId, receipt.recordId!));
    expect(jobs[0]!.status).toBe("done");
  });

  it("deduplicates the same current fact", async () => {
    const { merchant, customer } = await setup();
    const first = await persistMemory(db, store, pref(merchant.id, customer.id));
    await awaitDurable(db, store, [first.recordId!], { timeoutMs: 5000 });
    const second = await persistMemory(db, store, pref(merchant.id, customer.id, { value: "  medium " }));
    expect(second.status).toBe("duplicate");
    expect(second.recordId).toBe(first.recordId);
    const rows = await db.select().from(memoryRecords).where(eq(memoryRecords.customerId, customer.id));
    expect(rows).toHaveLength(1);
  });
});

describe("writes that outlast their request", () => {
  it("settles them on the customer's next turn so they stay recallable", async () => {
    const { merchant, customer } = await setup();
    const other = await createCustomer(db, merchant.id, { userId: (await createUser(db)).id });
    // Neither request waited for Walrus (closed tab, Telegram time budget).
    const mine = await persistMemory(db, store, pref(merchant.id, customer.id));
    const theirs = await persistMemory(db, store, pref(merchant.id, other.id, { value: "Large", statement: "Customer normally buys size Large.", label: "Size: Large" }));

    const status = async (id: string) => (await db.select().from(memoryRecords).where(eq(memoryRecords.id, id)))[0]!;
    for (let i = 0; i < 20 && (await status(mine.recordId!)).persistStatus === "pending"; i++) {
      await refreshPending(db, store, { merchantId: merchant.id, customerId: customer.id });
      if ((await status(mine.recordId!)).persistStatus === "pending") await new Promise((r) => setTimeout(r, 250));
    }
    const row = await status(mine.recordId!);
    expect(row.persistStatus).toBe("stored");
    expect(row.blobId).toBeTruthy();
    expect((await status(theirs.recordId!)).persistStatus).toBe("pending"); // another customer's turn doesn't touch it

    const hits = await recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: customer.id, query: "What size do I wear?" });
    expect(hits.map((h) => h.text).join(" ")).toMatch(/Medium/);
  });
});

describe("corrections and temporal memory", () => {
  it("supersedes the old value but keeps it recallable as history", async () => {
    const { merchant, customer } = await setup();
    const lekki = await persistMemory(
      db,
      store,
      pref(merchant.id, customer.id, {
        type: "DELIVERY_PREFERENCE",
        subject: "delivery_location",
        value: "Lekki",
        statement: "Customer usually wants delivery around Lekki.",
        label: "Usual delivery: Lekki",
      }),
    );
    await awaitDurable(db, store, [lekki.recordId!], { timeoutMs: 5000 });

    const yaba = await persistMemory(
      db,
      store,
      pref(merchant.id, customer.id, {
        type: "DELIVERY_PREFERENCE",
        subject: "usual_delivery_area",
        value: "Yaba",
        statement: "Customer has moved; usual delivery area is now Yaba.",
        label: "Usual delivery: Yaba",
        confirmation: "customer_corrected",
        previousValue: "Lekki",
      }),
    );
    expect(yaba.supersededCount).toBe(1);
    await awaitDurable(db, store, [yaba.recordId!], { timeoutMs: 5000 });

    const [oldRow] = await db.select().from(memoryRecords).where(eq(memoryRecords.id, lekki.recordId!));
    expect(oldRow!.lifecycle).toBe("superseded");
    expect(oldRow!.validTo).toBeInstanceOf(Date);
    expect(oldRow!.supersededById).toBe(yaba.recordId);

    const recalled = await recallCustomerMemory(db, store, {
      merchantId: merchant.id,
      customerId: customer.id,
      query: "usual delivery area",
      maxDistance: 0.999,
    });
    const current = recalled.find((m) => m.text.includes("Yaba"));
    const history = recalled.find((m) => m.text.includes("Lekki") && !m.text.includes("Yaba"));
    expect(current?.historical).toBe(false);
    expect(history?.historical).toBe(true);
    expect(current?.text).toContain('earlier value "Lekki"');
  });
});

describe("isolation", () => {
  it("never recalls another customer's memory", async () => {
    const merchant = await createMerchant(db);
    const a = await createCustomer(db, merchant.id, { userId: (await createUser(db)).id });
    const b = await createCustomer(db, merchant.id, { userId: (await createUser(db)).id });
    const r = await persistMemory(db, store, pref(merchant.id, a.id, { value: "XL", statement: "Customer wears size XL.", label: "Size: XL" }));
    await awaitDurable(db, store, [r.recordId!]);

    const forA = await recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: a.id, query: "size", maxDistance: 0.999 });
    const forB = await recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: b.id, query: "size", maxDistance: 0.999 });
    expect(forA.some((m) => m.text.includes("XL"))).toBe(true);
    expect(forB).toHaveLength(0);
  });

  it("never recalls another merchant's knowledge", async () => {
    const m1 = await createMerchant(db);
    const m2 = await createMerchant(db);
    const r = await rememberMerchantFact(db, store, { merchantId: m1.id, kind: "operations", text: "We're out of the navy chair until Friday.", label: "Navy chair out until Friday" });
    await awaitDurable(db, store, [r.recordId!]);
    const own = await recallMerchantMemory(db, store, { merchantId: m1.id, query: "navy chair", maxDistance: 0.999 });
    const other = await recallMerchantMemory(db, store, { merchantId: m2.id, query: "navy chair", maxDistance: 0.999 });
    expect(own.some((m) => m.text.includes("navy chair"))).toBe(true);
    expect(other).toHaveLength(0);
  });

  it("includes memories from a merged duplicate customer", async () => {
    const merchant = await createMerchant(db);
    const primary = await createCustomer(db, merchant.id, { userId: (await createUser(db)).id });
    const telegramOnly = await createCustomer(db, merchant.id);
    const r = await persistMemory(db, store, pref(merchant.id, telegramOnly.id, { value: "L", statement: "Customer wears size L.", label: "Size: L" }));
    await awaitDurable(db, store, [r.recordId!]);
    await db.update(customers).set({ mergedIntoId: primary.id }).where(eq(customers.id, telegramOnly.id));
    const recalled = await recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: primary.id, query: "size", maxDistance: 0.999 });
    expect(recalled.some((m) => m.text.includes("size L"))).toBe(true);
  });
});

describe("forget", () => {
  it("excludes forgotten memories from recall and the passport", async () => {
    const { merchant, customer } = await setup();
    const r = await persistMemory(db, store, pref(merchant.id, customer.id));
    await awaitDurable(db, store, [r.recordId!]);
    expect(await forgetMemory(db, { merchantId: merchant.id, customerId: customer.id, recordId: r.recordId!, actor: { type: "customer", id: customer.id } })).toBe(true);
    const recalled = await recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: customer.id, query: "size Medium", maxDistance: 0.999 });
    expect(recalled).toHaveLength(0);
    expect(await customerPassport(db, { merchantId: merchant.id, customerId: customer.id })).toHaveLength(0);
  });

  it("refuses to forget another customer's memory (IDOR)", async () => {
    const { merchant, customer } = await setup();
    const intruder = await createCustomer(db, merchant.id);
    const r = await persistMemory(db, store, pref(merchant.id, customer.id));
    const ok = await forgetMemory(db, { merchantId: merchant.id, customerId: intruder.id, recordId: r.recordId!, actor: { type: "customer", id: intruder.id } });
    expect(ok).toBe(false);
  });
});

describe("candidates from extraction", () => {
  const base: MemoryCandidate = {
    type: "CUSTOMER_PREFERENCE",
    subject: "colour_preference",
    value: "darker colours",
    statement: "Customer likes darker colours.",
    label: "Likes darker colours",
    evidence: "I like darker colours",
    explicit: true,
    confidence: 0.95,
    importance: 0.8,
    futureUsefulness: 0.9,
    durability: "long_term",
    temporalScope: "current",
    isCorrection: false,
    previousValue: null,
  };

  it("persists durable, holds inferred for consent, drops one-order details", async () => {
    const { merchant, customer } = await setup();
    const outcomes = await processCandidates(db, store, { merchantId: merchant.id, customerId: customer.id, sourceKind: "conversation", channel: "web" }, [
      base,
      { ...base, subject: "colour_preference_red", value: "red", statement: "Customer might like red.", label: "Maybe likes red", explicit: false, confidence: 0.7 },
      { ...base, type: "DELIVERY_PREFERENCE", subject: "delivery_area", value: "Yaba", statement: "Send this order to Yaba.", label: "This order: Yaba", durability: "one_time", temporalScope: "this_order_only" },
    ]);
    expect(outcomes.map((o) => o.decision.decision)).toEqual(["durable", "confirmation_required", "ephemeral"]);
    expect(outcomes[0]!.receipt?.status).toBe("pending");
    expect(outcomes[1]!.pendingCandidateId).toBeTruthy();

    const accepted = await resolveCandidate(db, store, { merchantId: merchant.id, customerId: customer.id, candidateId: outcomes[1]!.pendingCandidateId!, accept: true });
    expect(accepted?.confirmation).toBe("customer_confirmed");

    const intruder = await createCustomer(db, merchant.id);
    const again = await resolveCandidate(db, store, { merchantId: merchant.id, customerId: intruder.id, candidateId: outcomes[1]!.pendingCandidateId!, accept: true });
    expect(again).toBeNull();
  });
});

describe("order history memory", () => {
  it("records a placed order so 'same as last time' is recallable", async () => {
    const { merchant, customer } = await setup();
    const receipt = await rememberPastOrder(db, store, {
      merchantId: merchant.id,
      customerId: customer.id,
      orderId: "00000000-0000-4000-8000-000000000001",
      orderNumber: 1042,
      placedAt: new Date("2026-09-20T12:00:00Z"),
      channel: "web",
      currency: "NGN",
      items: [{ name: "Classic Ankara Wax Print", variantLabel: "Emerald", quantity: 6, unit: "yard", unitPrice: 750000 }],
      fulfillmentMethod: "delivery",
      deliveryArea: "Lekki",
      total: 4850000,
      hasUnpricedItems: false,
    });
    await awaitDurable(db, store, [receipt.recordId!]);
    const recalled = await recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: customer.id, query: "previous order yards Ankara", maxDistance: 0.999 });
    expect(recalled[0]?.text).toMatch(/6 yards of Classic Ankara Wax Print \(Emerald\)/);
    expect(recalled[0]?.text).toContain("Delivery to Lekki");
    expect(recalled[0]?.record?.type).toBe("PAST_ORDER");
  });
});

describe("relayer rate-limit budget", () => {
  it("asks the relayer about pending jobs at most once per interval, in one batched request", async () => {
    process.env.MEMWAL_STATUS_MIN_INTERVAL_MS = "60000";
    resetEnvCache();
    try {
      const { merchant, customer } = await setup();
      let bulkCalls = 0;
      const counting: MemoryStore = {
        ...store,
        getRememberStatuses: (ids) => {
          bulkCalls++;
          return store.getRememberStatuses(ids);
        },
      };
      const a = await persistMemory(db, counting, pref(merchant.id, customer.id));
      const b = await persistMemory(db, counting, pref(merchant.id, customer.id, { subject: "colour_preference", value: "dark", statement: "Customer prefers dark colours.", label: "Colour: dark" }));
      await refreshRecords(db, counting, [a.recordId!, b.recordId!]); // client poll
      await refreshRecords(db, counting, [a.recordId!, b.recordId!]); // server wait, same moment
      await refreshPending(db, counting, { merchantId: merchant.id, customerId: customer.id }); // next turn
      expect(bulkCalls).toBe(1);
    } finally {
      delete process.env.MEMWAL_STATUS_MIN_INTERVAL_MS;
      resetEnvCache();
    }
  });

  it("stops calling the relayer after a rate-limit response until the cooldown ends", async () => {
    let calls = 0;
    const limited = wrapClient(
      {
        recall: async () => {
          calls++;
          throw Object.assign(new Error('Walrus Memory server error (429): {"error":"Rate limit exceeded","layer":"delegate_key","limit":"60 weighted-requests/min","retry_after_seconds":60}'), { status: 429 });
        },
      } as never,
      "mock",
      "Test store",
    );
    const cooldown = globalThis as unknown as { __niaWalrusCooldownUntil?: number };
    try {
      await expect(limited.recall({ query: "size", namespace: "nia-test:x", limit: 3 })).rejects.toMatchObject({ status: 429 });
      expect(calls).toBe(1); // not retried into the lockout
      expect(walrusCooldownMs()).toBeGreaterThan(55_000);
      await expect(limited.recall({ query: "size", namespace: "nia-test:x", limit: 3 })).rejects.toThrow(/rate-limited/);
      expect(calls).toBe(1); // failed fast, relayer not called
    } finally {
      cooldown.__niaWalrusCooldownUntil = 0;
    }
  });
});

describe("failure handling", () => {
  it("marks failed writes, keeps the outbox, and retries", async () => {
    const { merchant, customer } = await setup();
    let fail = true;
    const flaky: MemoryStore = {
      ...store,
      remember: async (text, ns, key) => {
        if (fail) throw Object.assign(new Error("relayer unavailable"), { status: 401 });
        return store.remember(text, ns, key);
      },
    };
    const receipt = await persistMemory(db, flaky, pref(merchant.id, customer.id));
    expect(receipt.status).toBe("failed");
    const [row] = await db.select().from(memoryRecords).where(eq(memoryRecords.id, receipt.recordId!));
    expect(row!.pendingText).toBeTruthy();
    expect(row!.lastError).toMatch(/401/);

    fail = false;
    const retried = await retryFailed(db, flaky, { merchantId: merchant.id });
    expect(retried[0]!.status).toBe("pending");
    const [final] = await refreshRecords(db, flaky, [receipt.recordId!]);
    expect(final!.status).toBe("stored");
  });

  it("skips (and says so) when Walrus is not configured", async () => {
    const { merchant, customer } = await setup();
    const receipt = await persistMemory(db, null, pref(merchant.id, customer.id));
    expect(receipt.status).toBe("skipped");
    expect(receipt.reason).toMatch(/not configured/);
  });

  it("enforces the hourly write budget", async () => {
    process.env.MEMWAL_MAX_WRITES_PER_HOUR = "2";
    resetEnvCache();
    try {
      const { merchant, customer } = await setup();
      const results = [];
      for (const v of ["S", "M", "L"]) {
        results.push(await persistMemory(db, store, pref(merchant.id, customer.id, { subject: `size_${v}`, value: v, statement: `Size ${v}`, label: `Size ${v}` })));
      }
      expect(results.map((r) => r.status)).toEqual(["pending", "pending", "skipped"]);
    } finally {
      delete process.env.MEMWAL_MAX_WRITES_PER_HOUR;
      resetEnvCache();
    }
  });
});

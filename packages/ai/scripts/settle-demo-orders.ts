/**
 * Settle demo-shop orders that were placed before demo checkout existed and
 * are still waiting for an owner — then save each one to that customer's
 * Walrus memory (once). Only demo shops (merchants.is_demo) are touched; real
 * shops' orders are never changed.
 *
 *   pnpm orders:settle-demo          local database (.env DATABASE_URL)
 *   pnpm orders:settle-demo:prod     the live site (PRODUCTION_DATABASE_URL, Walrus namespace prefix "nia")
 *   add -- --dry-run to list what would change without changing anything
 *
 * Waiting orders → paid (demo) → ready for pickup / on its way, with one
 * order event per step. Orders the owner already moved on but never marked
 * paid → payment recorded as demo. Memory: the order itself if Walrus doesn't
 * have it yet, otherwise one "paid" outcome. Also adds the demo-shop policies
 * (demo payment, late delivery) that the seed adds. Safe to run twice.
 */
import { loadEnv } from "../../database/scripts/env";

loadEnv();
const production = process.argv.includes("--production");
if (production) {
  if (!process.env.PRODUCTION_DATABASE_URL) {
    console.error("PRODUCTION_DATABASE_URL is not set in .env.");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
  // The live site's Walrus namespaces (its MEMWAL_NAMESPACE_PREFIX).
  process.env.MEMWAL_NAMESPACE_PREFIX = process.env.PRODUCTION_MEMWAL_NAMESPACE_PREFIX ?? "nia";
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

// Imported after the environment is set, so config reads the right database and namespace.
const { and, eq, inArray, ne, sql } = await import("drizzle-orm");
const { applyDemoShopPolicies, createPostgresDb, customers, memoryRecords, merchants, orders } = await import("@nia/database");
const { orderSummary, settleDemoOrder } = await import("@nia/commerce");
const { awaitDurable, getMemoryStore, persistMemory, rememberPastOrder } = await import("@nia/memory");
const { checkoutOutcome } = await import("../src/services");

console.log(`Database: ${new URL(url).hostname}${production ? " (production)" : ""} · Walrus namespace prefix: ${process.env.MEMWAL_NAMESPACE_PREFIX ?? "nia"}`);
const { db, close } = createPostgresDb(url, { max: 1 });

try {
  const store = getMemoryStore();
  if (!store) console.warn("! Walrus Memory is not configured — orders will settle, memories are skipped.");
  const shops = await db.select().from(merchants).where(eq(merchants.isDemo, true));
  const shopIds = shops.map((s) => s.id);
  if (!shopIds.length) {
    console.log("No demo shops.");
    process.exit(0);
  }

  const waiting = await db.select().from(orders).where(and(inArray(orders.merchantId, shopIds), eq(orders.status, "awaiting_confirmation")));
  const unpaid = await db
    .select()
    .from(orders)
    .where(and(inArray(orders.merchantId, shopIds), inArray(orders.status, ["confirmed", "processing", "ready", "dispatched", "delivered"]), ne(orders.paymentStatus, "paid")));

  if (process.argv.includes("--dry-run")) {
    const name = (id: string) => shops.find((s) => s.id === id)?.name ?? id;
    for (const o of waiting) console.log(`  would settle #${o.number} · ${name(o.merchantId)} · ${o.fulfillmentMethod ?? "?"}${o.deliveryArea ? ` (${o.deliveryArea})` : ""}`);
    for (const o of unpaid) console.log(`  would record demo payment on #${o.number} · ${name(o.merchantId)} · ${o.status}`);
    console.log(`Dry run: ${waiting.length} waiting, ${unpaid.length} unpaid, ${new Set([...waiting, ...unpaid].map((o) => o.customerId)).size} customer(s). Nothing changed.`);
    process.exit(0);
  }

  // The written policies Nia quotes (demo payment, late delivery) — the seed adds them too.
  let policies = 0;
  for (const s of shops) policies += await applyDemoShopPolicies(db, s.id);
  console.log(`✓ Demo-shop policies: ${policies} added.`);

  const touched: { orderId: string; merchantId: string; customerId: string }[] = [];
  for (const o of waiting) {
    const s = await settleDemoOrder(db, { merchantId: o.merchantId, orderId: o.id });
    if (s.paymentStatus === "paid") touched.push({ orderId: o.id, merchantId: o.merchantId, customerId: o.customerId });
    else console.log(`  · #${o.number} left for the shop (needs a quote)`);
  }
  for (const o of unpaid) {
    await db.update(orders).set({ paymentStatus: "paid", paymentMode: "demo", paidAt: new Date(), paymentReference: `DEMO-${o.number}` }).where(eq(orders.id, o.id));
    touched.push({ orderId: o.id, merchantId: o.merchantId, customerId: o.customerId });
  }
  console.log(`✓ Settled ${waiting.length} waiting order(s); recorded demo payment on ${unpaid.length} order(s) the shop had already moved on.`);

  // Memory: once per order, as soon as it's paid.
  const recordIds: string[] = [];
  if (store) {
    for (const t of touched) {
      const shop = shops.find((s) => s.id === t.merchantId)!;
      const [customer] = await db.select().from(customers).where(eq(customers.id, t.customerId));
      if (!customer?.memoryEnabled || !shop.niaSettings.memoryEnabled) continue;
      const s = await orderSummary(db, shop.id, t.orderId);
      const [known] = await db
        .select({ id: memoryRecords.id })
        .from(memoryRecords)
        .where(and(eq(memoryRecords.orderId, t.orderId), eq(memoryRecords.type, "PAST_ORDER"), sql`${memoryRecords.lifecycle} <> 'forgotten'`));
      const outcome = checkoutOutcome(s);
      const receipt = known
        ? await persistMemory(db, store, {
            merchantId: shop.id,
            customerId: customer.id,
            scope: "customer",
            type: "OUTCOME",
            subject: `order_${s.number}_paid`,
            value: "paid",
            statement: `Order #${s.number} at ${shop.name} was paid on ${new Date().toISOString().slice(0, 10)}. ${outcome ?? ""}`.trim(),
            label: `Order #${s.number} paid (demo)`,
            confirmation: "observed_from_orders",
            explicit: true,
            confidence: 1,
            importance: 0.7,
            durability: "long_term",
            score: 0.8,
            significant: true,
            sourceKind: "order",
            channel: s.channel,
            orderId: s.id,
            supersede: false,
          })
        : await rememberPastOrder(db, store, {
            merchantId: shop.id,
            customerId: customer.id,
            orderId: s.id,
            orderNumber: s.number!,
            placedAt: new Date(s.submittedAt ?? s.createdAt),
            channel: s.channel,
            currency: s.currency,
            locale: shop.locale,
            items: s.items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice })),
            fulfillmentMethod: s.fulfillmentMethod,
            deliveryArea: s.deliveryArea,
            total: s.total,
            hasUnpricedItems: s.hasUnpricedItems,
            outcome,
          });
      console.log(`  · #${s.number} ${shop.name} → ${known ? "paid outcome" : "order"} memory: ${receipt.status}`);
      if (receipt.recordId && receipt.status === "pending") recordIds.push(receipt.recordId);
    }
  }
  if (recordIds.length && store) {
    console.log(`… waiting for Walrus to store ${recordIds.length} memor${recordIds.length === 1 ? "y" : "ies"}`);
    const done = await awaitDurable(db, store, recordIds, { timeoutMs: 180_000, intervalMs: 6000 });
    const stored = done.filter((r) => r.status === "stored").length;
    console.log(`✓ Walrus: ${stored} stored, ${done.length - stored} still pending (they settle on the next chat turn).`);
  }
} catch (err) {
  console.error("✗ Failed:", err);
  process.exitCode = 1;
} finally {
  await close();
}

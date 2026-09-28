/**
 * Paystack webhook — the only way a card payment is marked paid. The raw
 * body's HMAC-SHA512 must match `x-paystack-signature`, and the amount and
 * currency must match the order.
 */
import { and, eq } from "drizzle-orm";
import { env } from "@nia/config";
import { audit, orders } from "@nia/database";
import { transitionOrder, verifyPaystackSignature } from "@nia/commerce";
import { db } from "@/lib/server";

export async function POST(req: Request) {
  const secret = env().PAYSTACK_SECRET_KEY;
  if (!secret) return Response.json({ error: "Paystack not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  const event = JSON.parse(raw) as { event: string; data?: { reference?: string; amount?: number; currency?: string; metadata?: { orderId?: string; merchantId?: string } } };
  if (event.event !== "charge.success" || !event.data?.reference) return Response.json({ ok: true });
  const { reference, amount, currency, metadata } = event.data;
  const [order] = await db()
    .select()
    .from(orders)
    .where(and(eq(orders.paymentReference, reference), ...(metadata?.orderId ? [eq(orders.id, metadata.orderId)] : [])));
  if (!order) return Response.json({ ok: true, ignored: "unknown reference" });
  if (order.paymentStatus === "paid") return Response.json({ ok: true, duplicate: true });
  if (amount !== order.total || currency !== order.currency) {
    await audit(db(), { merchantId: order.merchantId, actorType: "system", action: "payment.mismatch", targetType: "order", targetId: order.id, metadata: { amount, currency } });
    return Response.json({ ok: true, ignored: "amount mismatch" });
  }
  if (order.status === "confirmed") {
    await transitionOrder(db(), { merchantId: order.merchantId, orderId: order.id, to: "paid", actor: { type: "system" }, note: `Paystack ${reference}` });
  } else {
    await db().update(orders).set({ paymentStatus: "paid", paidAt: new Date() }).where(eq(orders.id, order.id));
  }
  await audit(db(), { merchantId: order.merchantId, actorType: "system", action: "payment.paystack_success", targetType: "order", targetId: order.id });
  return Response.json({ ok: true });
}

/**
 * Payment provider abstraction.
 *
 * Nia never processes card details and never marks an order paid on its own:
 *   • merchant_confirmed — the merchant confirms payment from the dashboard
 *   • payment_link       — the merchant's own hosted payment link; merchant confirms
 *   • paystack           — Paystack Standard (hosted checkout); "paid" only after a
 *                          signature-verified webhook or a server-side verify call
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { orders, type Db, type Merchant, type Order } from "@nia/database";
import { env } from "@nia/config";
import { AppError, formatMoney, type OrderPaymentMode, type PaymentMode } from "@nia/shared";

export interface PaymentStart {
  mode: OrderPaymentMode;
  instructions: string;
  url: string | null;
  reference: string | null;
}

export interface PaymentProvider {
  readonly mode: PaymentMode;
  start(order: Order, merchant: Merchant, customerEmail: string | null): Promise<PaymentStart>;
}

class MerchantConfirmedProvider implements PaymentProvider {
  readonly mode = "merchant_confirmed" as const;
  async start(order: Order, merchant: Merchant): Promise<PaymentStart> {
    const amount = order.hasUnpricedItems ? "the confirmed total" : formatMoney(order.total, order.currency, { locale: merchant.locale });
    return {
      mode: this.mode,
      instructions:
        merchant.paymentInstructions ??
        `${merchant.name} will confirm availability and share how to pay ${amount}. Your order is processed once they confirm payment.`,
      url: null,
      reference: null,
    };
  }
}

class PaymentLinkProvider implements PaymentProvider {
  readonly mode = "payment_link" as const;
  async start(order: Order, merchant: Merchant): Promise<PaymentStart> {
    return {
      mode: this.mode,
      instructions: `Pay ${formatMoney(order.total, order.currency, { locale: merchant.locale })} with ${merchant.name}'s payment link. Use order #${order.number} as the reference. The shop confirms receipt.`,
      url: merchant.paymentLinkUrl,
      reference: order.number ? `NIA-${order.number}` : null,
    };
  }
}

const PAYSTACK_CURRENCIES = new Set(["NGN", "GHS", "ZAR", "KES", "USD"]);

class PaystackProvider implements PaymentProvider {
  readonly mode = "paystack" as const;
  constructor(private readonly secretKey: string) {}

  async start(order: Order, merchant: Merchant, customerEmail: string | null): Promise<PaymentStart> {
    if (!customerEmail) throw new AppError("VALIDATION", "An email address is required for card payments");
    if (!PAYSTACK_CURRENCIES.has(order.currency)) throw new AppError("VALIDATION", `Paystack does not support ${order.currency}`);
    if (order.hasUnpricedItems) throw new AppError("VALIDATION", "This order needs a quote before it can be paid");
    const reference = `nia_${order.id.replace(/-/g, "").slice(0, 20)}_${Date.now().toString(36)}`;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: customerEmail,
        amount: order.total, // Paystack expects the lowest denomination — our minor units
        currency: order.currency,
        reference,
        metadata: { orderId: order.id, merchantId: merchant.id, orderNumber: order.number },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { status: boolean; message: string; data?: { authorization_url: string; reference: string } };
    if (!res.ok || !body.status || !body.data) throw new AppError("UPSTREAM", `Paystack: ${body.message}`);
    return {
      mode: this.mode,
      instructions: `Pay securely with Paystack. ${merchant.name} will see the payment once Paystack confirms it.`,
      url: body.data.authorization_url,
      reference: body.data.reference,
    };
  }
}

export function paymentProviderFor(merchant: Merchant): PaymentProvider {
  if (merchant.paymentMode === "paystack") {
    const key = env().PAYSTACK_SECRET_KEY;
    if (key) return new PaystackProvider(key);
    // Configured mode unavailable — fall back honestly to manual confirmation.
    return new MerchantConfirmedProvider();
  }
  if (merchant.paymentMode === "payment_link" && merchant.paymentLinkUrl) return new PaymentLinkProvider();
  return new MerchantConfirmedProvider();
}

export async function startPayment(db: Db, order: Order, merchant: Merchant, customerEmail: string | null): Promise<PaymentStart> {
  const provider = paymentProviderFor(merchant);
  const started = await provider.start(order, merchant, customerEmail);
  await db
    .update(orders)
    .set({ paymentMode: started.mode, paymentUrl: started.url, paymentReference: started.reference, paymentStatus: started.url ? "pending" : order.paymentStatus })
    .where(eq(orders.id, order.id));
  return started;
}

/** Verify a Paystack webhook (HMAC-SHA512 of the raw body with the secret key). */
export function verifyPaystackSignature(rawBody: string, signature: string | null, secretKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

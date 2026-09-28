import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { customerIdentities, customers, merchantMembers, merchants, type Customer, type Merchant, type User } from "@nia/database";
import { canonicalCustomer, resolveWebCustomer } from "@nia/commerce";
import { db } from "./server";
import { getSessionUser } from "./auth";

export interface Storefront {
  merchant: Merchant;
  user: User | null;
  /** Existing customer record for this user at this merchant (not created on view). */
  customer: Customer | null;
  isMember: boolean;
}

/** Resolve a storefront by slug, or null. Unpublished shops are visible only to their team. */
export const loadStorefront = cache(async (slug: string): Promise<Storefront | null> => {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  const [merchant] = await db().select().from(merchants).where(eq(merchants.slug, slug));
  if (!merchant) return null;
  const user = await getSessionUser();
  let isMember = false;
  if (user) {
    const [m] = await db()
      .select({ id: merchantMembers.id })
      .from(merchantMembers)
      .where(and(eq(merchantMembers.merchantId, merchant.id), eq(merchantMembers.userId, user.id)));
    isMember = Boolean(m);
  }
  if (merchant.status !== "live" && !isMember) return null;

  let customer: Customer | null = null;
  if (user) {
    const [row] = await db()
      .select({ customer: customers })
      .from(customerIdentities)
      .innerJoin(customers, eq(customers.id, customerIdentities.customerId))
      .where(and(eq(customerIdentities.merchantId, merchant.id), eq(customerIdentities.provider, "WEB_AUTH"), eq(customerIdentities.subject, user.id)));
    customer = row ? await canonicalCustomer(db(), row.customer) : null;
    // Signed in with Telegram and already chatting with this shop's bot: that's the same customer.
    if (!customer && user.telegramUserId) {
      const [tg] = await db()
        .select({ id: customerIdentities.id })
        .from(customerIdentities)
        .where(and(eq(customerIdentities.merchantId, merchant.id), eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, String(user.telegramUserId))));
      if (tg) customer = await resolveWebCustomer(db(), webUserRef(merchant.id, user));
    }
  }
  return { merchant, user, customer, isMember };
});

/** Page variant: 404 when the storefront is missing or unpublished. */
export async function getStorefront(slug: string): Promise<Storefront> {
  const sf = await loadStorefront(slug);
  if (!sf) notFound();
  return sf;
}

/** Create the customer record on first meaningful action (chat, cart, profile). */
export async function ensureCustomer(sf: Storefront): Promise<Customer | null> {
  if (!sf.user) return null;
  if (sf.customer) return sf.customer;
  return resolveWebCustomer(db(), webUserRef(sf.merchant.id, sf.user));
}

function webUserRef(merchantId: string, user: User) {
  return { merchantId, userId: user.id, email: user.email, name: user.name, telegramUserId: user.telegramUserId, telegramUsername: user.telegramUsername };
}

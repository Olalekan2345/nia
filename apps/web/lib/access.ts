import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { merchantMembers, merchants, type Merchant, type User } from "@nia/database";
import { roleAtLeast, type MemberRole } from "@nia/shared";
import { db } from "./server";
import { getSessionUser } from "./auth";

export async function requireUser(next = "/dashboard"): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(next)}`);
  return user;
}

export const listUserMerchants = cache(async (userId: string) => {
  return db()
    .select({ merchant: merchants, role: merchantMembers.role })
    .from(merchantMembers)
    .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
    .where(eq(merchantMembers.userId, userId))
    .orderBy(asc(merchants.name));
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MerchantAccess {
  user: User;
  merchant: Merchant;
  role: MemberRole;
}

/** Membership lookup without redirects (for route handlers). */
export async function merchantAccessFor(user: User, merchantId: string, min: MemberRole = "STAFF"): Promise<MerchantAccess | null> {
  if (!UUID.test(merchantId)) return null;
  const [row] = await db()
    .select({ merchant: merchants, role: merchantMembers.role })
    .from(merchantMembers)
    .innerJoin(merchants, eq(merchants.id, merchantMembers.merchantId))
    .where(and(eq(merchantMembers.merchantId, merchantId), eq(merchantMembers.userId, user.id)));
  if (!row || !roleAtLeast(row.role, min)) return null;
  return { user, merchant: row.merchant, role: row.role };
}

/**
 * Every dashboard page and action goes through this. Non-members get a 404 —
 * we never reveal whether another tenant's workspace exists.
 */
export async function requireMerchant(merchantId: string, min: MemberRole = "STAFF"): Promise<MerchantAccess> {
  const user = await requireUser(`/dashboard/${merchantId}`);
  const access = await merchantAccessFor(user, merchantId, min);
  if (!access) notFound();
  return access;
}

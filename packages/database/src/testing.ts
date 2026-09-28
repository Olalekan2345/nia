/**
 * Test fixtures: an isolated, fully migrated in-memory Postgres per suite.
 */
import { createTestDb } from "./pglite";
import { setDbOverride, type Database } from "./client";
import { customerIdentities, customers, merchantMembers, merchants, users } from "./schema";
import type { MemberRole } from "@nia/shared";

export { createTestDb };

export async function setupTestDb(): Promise<{ db: Database; close: () => Promise<void> }> {
  const handle = await createTestDb();
  setDbOverride(handle.db);
  return {
    db: handle.db,
    close: async () => {
      setDbOverride(undefined);
      await handle.close();
    },
  };
}

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function createUser(db: Database, email = `user-${unique()}@example.test`) {
  const [u] = await db.insert(users).values({ email }).returning();
  return u!;
}

export async function createMerchant(
  db: Database,
  overrides: Partial<typeof merchants.$inferInsert> = {},
  owner?: { userId: string; role?: MemberRole },
) {
  const [m] = await db
    .insert(merchants)
    .values({ slug: `shop-${unique()}`, name: "Test Shop", currency: "NGN", status: "live", ...overrides })
    .returning();
  if (owner) {
    await db.insert(merchantMembers).values({ merchantId: m!.id, userId: owner.userId, role: owner.role ?? "OWNER" });
  }
  return m!;
}

export async function createCustomer(db: Database, merchantId: string, overrides: Partial<typeof customers.$inferInsert> = {}) {
  const [c] = await db.insert(customers).values({ merchantId, displayName: "Amara", ...overrides }).returning();
  if (c!.userId) {
    await db.insert(customerIdentities).values({
      merchantId,
      customerId: c!.id,
      provider: "WEB_AUTH",
      subject: c!.userId,
      verifiedAt: new Date(),
    });
  }
  return c!;
}

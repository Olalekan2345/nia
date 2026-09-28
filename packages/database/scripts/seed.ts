/**
 * Seed the clearly fictional public demo stores.
 *   pnpm db:seed
 *
 * Set SEED_OWNER_EMAIL=you@example.com to make that account the OWNER of the
 * demo stores, so you can sign in and open their dashboards (and Judge Mode).
 * No customers, orders, conversations or memories are seeded — those only
 * come from real use, so every metric and memory you see is genuine.
 */
import { eq } from "drizzle-orm";
import { loadEnv } from "./env";
import { createPostgresDb } from "../src/client";
import { merchants, merchantMembers, users } from "../src/schema";
import { applyDemoTemplate, DEMO_TEMPLATES, type DemoTemplateKey } from "../src/demo-templates";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const { db, close } = createPostgresDb(url, { max: 1 });

try {
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  let ownerId: string | null = null;
  if (ownerEmail) {
    const [existing] = await db.select().from(users).where(eq(users.email, ownerEmail));
    ownerId = existing?.id ?? (await db.insert(users).values({ email: ownerEmail }).returning())[0]!.id;
  }

  for (const key of Object.keys(DEMO_TEMPLATES) as DemoTemplateKey[]) {
    const t = DEMO_TEMPLATES[key];
    let [merchant] = await db.select().from(merchants).where(eq(merchants.slug, t.slug));
    if (!merchant) {
      [merchant] = await db
        .insert(merchants)
        .values({
          slug: t.slug,
          name: t.name,
          businessType: t.businessType,
          tagline: t.tagline,
          description: t.description,
          accentColor: t.accentColor,
          welcomeMessage: t.welcomeMessage,
          city: t.city,
          country: t.country,
          currency: "NGN",
          locale: "en-NG",
          timezone: "Africa/Lagos",
          status: "live",
          onboardingStep: 99,
          isDemo: true,
        })
        .returning();
    }
    const result = await applyDemoTemplate(db, merchant!.id, key);
    if (ownerId) {
      await db
        .insert(merchantMembers)
        .values({ merchantId: merchant!.id, userId: ownerId, role: "OWNER" })
        .onConflictDoNothing();
    }
    console.log(`✓ ${t.name} (/s/${t.slug}) — +${result.products} products, +${result.services} services`);
  }
  if (ownerEmail) console.log(`✓ ${ownerEmail} is OWNER of the demo stores`);
} catch (err) {
  console.error("✗ Seed failed:", err);
  process.exitCode = 1;
} finally {
  await close();
}

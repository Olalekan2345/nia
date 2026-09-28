"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { applyDemoTemplate, audit, merchantMembers, merchants } from "@nia/database";
import { AppError, BUSINESS_TYPES, isAppError, slugify } from "@nia/shared";
import { randomToken } from "@nia/shared/server";
import { requireUser } from "@/lib/access";
import { limit } from "@/lib/security";
import { db } from "@/lib/server";

const Input = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(80),
  businessType: z.enum(BUSINESS_TYPES.map((b) => b.value) as [string, ...string[]]),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(2).optional(),
  currency: z.string().length(3),
  timezone: z.string().min(3).max(64),
  locale: z.string().min(2).max(20),
  template: z.enum(["none", "fabric", "beauty", "bakery"]),
});

export type CreateBusinessState = { error?: string };

export async function createBusinessAction(_prev: CreateBusinessState, form: FormData): Promise<CreateBusinessState> {
  const user = await requireUser("/onboarding");
  let merchantId: string;
  try {
    await limit(`create-merchant:${user.id}`, 5, 3600);
    const d = Input.parse(Object.fromEntries(form.entries()));
    try {
      new Intl.DateTimeFormat("en", { timeZone: d.timezone });
      new Intl.NumberFormat(d.locale, { style: "currency", currency: d.currency });
    } catch {
      throw new AppError("VALIDATION", "Unknown time zone, locale or currency");
    }
    let slug = slugify(d.name) || "shop";
    const [taken] = await db().select({ id: merchants.id }).from(merchants).where(eq(merchants.slug, slug));
    if (taken) slug = `${slug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "x"}`;
    const [m] = await db()
      .insert(merchants)
      .values({
        name: d.name,
        slug,
        businessType: d.businessType,
        city: d.city || null,
        country: d.country?.toUpperCase() || null,
        currency: d.currency.toUpperCase(),
        timezone: d.timezone,
        locale: d.locale,
        status: "onboarding",
        onboardingStep: 1,
        welcomeMessage: "I can help you find what you need, reorder your favourites, or book with us.",
      })
      .returning();
    await db().insert(merchantMembers).values({ merchantId: m!.id, userId: user.id, role: "OWNER" });
    if (d.template !== "none") await applyDemoTemplate(db(), m!.id, d.template, { currency: m!.currency });
    await audit(db(), { merchantId: m!.id, actorType: "user", actorId: user.id, action: "merchant.created", metadata: { template: d.template } });
    merchantId = m!.id;
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Check the form" };
    if (isAppError(err)) return { error: err.message };
    if ((err as { digest?: string })?.digest) throw err;
    console.error("[onboarding]", err);
    return { error: "Couldn’t create the business. Please try again." };
  }
  redirect(`/onboarding?m=${merchantId}&step=2`);
}

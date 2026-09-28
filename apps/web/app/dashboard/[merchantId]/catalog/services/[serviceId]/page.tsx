import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { services } from "@nia/database";
import { WEEKDAYS, fromMinorUnits, type WeekdayKey } from "@nia/shared";
import { ServiceForm } from "@/components/dashboard/service-form";
import { PageHeader } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditService({ params }: { params: Promise<{ merchantId: string; serviceId: string }> }) {
  const { merchantId, serviceId } = await params;
  const { merchant } = await requireMerchant(merchantId, "STAFF");
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) notFound();
  const [s] = await db().select().from(services).where(and(eq(services.id, serviceId), eq(services.merchantId, merchant.id)));
  if (!s) notFound();
  const major = (v: number | null | undefined) => (v == null ? "" : String(fromMinorUnits(v, s.currency)));
  const a = s.availability;
  const days: WeekdayKey[] = a ? WEEKDAYS.filter((d) => (a.weekly[d] ?? []).length > 0) : ["mon", "tue", "wed", "thu", "fri"];
  const firstWindow = a ? Object.values(a.weekly).find((w) => w && w.length)?.[0] : undefined;
  return (
    <>
      <PageHeader title={s.name} description={`/${s.slug}`} />
      <ServiceForm
        merchantId={merchant.id}
        currency={merchant.currency}
        initial={{
          id: s.id,
          kind: s.kind,
          name: s.name,
          description: s.description ?? "",
          category: s.category ?? "",
          priceMin: major(s.priceMin),
          priceMax: major(s.priceMax),
          durationMinutes: s.durationMinutes == null ? "" : String(s.durationMinutes),
          locationType: s.locationType,
          depositAmount: major(s.depositAmount),
          bookingRequirements: s.bookingRequirements ?? "",
          options: s.options.map((o) => ({ name: o.name, priceDelta: major(o.priceDelta), durationDelta: o.durationDelta == null ? "" : String(o.durationDelta) })),
          bookable: Boolean(a),
          days,
          open: firstWindow?.[0] ?? "09:00",
          close: firstWindow?.[1] ?? "17:00",
          slotIntervalMinutes: String(a?.slotIntervalMinutes ?? 60),
          capacityPerSlot: String(a?.capacityPerSlot ?? 1),
          leadTimeHours: String(a?.leadTimeHours ?? 12),
          advanceDays: String(a?.advanceDays ?? 30),
          active: s.active,
        }}
      />
    </>
  );
}

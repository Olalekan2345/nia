import type { Metadata } from "next";
import { ServiceForm } from "@/components/dashboard/service-form";
import { PageHeader } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";

export const metadata: Metadata = { title: "New service" };

export default async function NewService({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId, "STAFF");
  return (
    <>
      <PageHeader title="New service" />
      <ServiceForm
        merchantId={merchant.id}
        currency={merchant.currency}
        initial={{
          kind: "APPOINTMENT",
          name: "",
          description: "",
          category: "",
          priceMin: "",
          priceMax: "",
          durationMinutes: "60",
          locationType: "in_store",
          depositAmount: "",
          bookingRequirements: "",
          options: [],
          bookable: true,
          days: ["mon", "tue", "wed", "thu", "fri"],
          open: "09:00",
          close: "17:00",
          slotIntervalMinutes: "60",
          capacityPerSlot: "1",
          leadTimeHours: "12",
          advanceDays: "30",
          active: true,
        }}
      />
    </>
  );
}

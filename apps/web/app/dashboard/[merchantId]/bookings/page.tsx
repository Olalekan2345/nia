import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { Badge } from "@nia/ui";
import { customers } from "@nia/database";
import { bookingsForMerchant } from "@nia/commerce";
import { BOOKING_STATUS_LABELS, formatDateTime, formatMoney } from "@nia/shared";
import { EmptyPanel, PageHeader, Table, Td } from "@/components/dashboard/ui";
import { BookingActions } from "@/components/dashboard/status-actions";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Bookings" };

function splitByNow<T extends { startAt: Date }>(rows: T[]) {
  const now = Date.now();
  return {
    upcoming: rows.filter((b) => b.startAt.getTime() >= now).sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
    past: rows.filter((b) => b.startAt.getTime() < now),
  };
}

export default async function BookingsPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const rows = await bookingsForMerchant(db(), merchant.id);
  const names = new Map(
    (await db().select({ id: customers.id, name: customers.displayName }).from(customers).where(eq(customers.merchantId, merchant.id))).map((c) => [c.id, c.name]),
  );
  const { upcoming, past } = splitByNow(rows);

  const table = (list: typeof rows) => (
    <Table head={["When", "Service", "Customer", "Status", "Price", ""]}>
      {list.map((b) => (
        <tr key={b.id}>
          <Td className="whitespace-nowrap">{formatDateTime(b.startAt, { timeZone: merchant.timezone })}</Td>
          <Td>
            <p className="font-medium">{b.serviceName}</p>
            {b.selectedOptions.length ? <p className="text-xs text-muted-foreground">{b.selectedOptions.join(", ")}</p> : null}
            {b.notes ? <p className="text-xs text-muted-foreground">“{b.notes}”</p> : null}
          </Td>
          <Td>{names.get(b.customerId) ?? "Customer"}</Td>
          <Td>
            <Badge tone={b.status === "pending" ? "warning" : b.status === "confirmed" ? "success" : "neutral"}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
          </Td>
          <Td className="tabular">
            {b.price != null ? formatMoney(b.price, b.currency, { locale: merchant.locale }) : "—"}
            {b.depositAmount ? <p className="text-xs text-muted-foreground">Deposit {formatMoney(b.depositAmount, b.currency, { locale: merchant.locale })}</p> : null}
          </Td>
          <Td>
            <BookingActions merchantId={merchant.id} bookingId={b.id} status={b.status} />
          </Td>
        </tr>
      ))}
    </Table>
  );

  return (
    <>
      <PageHeader title="Bookings" description={`Appointments requested through Nia. Times are shown in ${merchant.timezone}.`} />
      {rows.length === 0 ? (
        <EmptyPanel title="No bookings yet" body="Add services with availability in Catalog — customers can then book them with Nia." />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 font-bold">Upcoming</h2>
            {upcoming.length ? table(upcoming) : <p className="text-sm text-muted-foreground">Nothing upcoming.</p>}
          </section>
          {past.length ? (
            <section>
              <h2 className="mb-3 font-bold">Past</h2>
              {table(past)}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}

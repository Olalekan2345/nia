/**
 * Poll real persistence state for memory receipts. A customer can only see
 * receipts for their own memory records at this shop.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { memoryRecords } from "@nia/database";
import { customerNamespaces, refreshRecords } from "@nia/memory";
import { loadStorefront } from "@/lib/storefront";
import { limit } from "@/lib/security";
import { db, memoryStore } from "@/lib/server";

const Query = z.object({ slug: z.string().min(1).max(64), ids: z.string().max(40 * 20) });

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({ slug: url.searchParams.get("slug"), ids: url.searchParams.get("ids") ?? "" });
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const ids = parsed.data.ids.split(",").filter((id) => z.string().uuid().safeParse(id).success).slice(0, 20);
  const sf = await loadStorefront(parsed.data.slug);
  if (!sf?.customer) return Response.json({ receipts: [] });
  try {
    await limit(`memstatus:${sf.customer.id}`, 60, 60);
  } catch {
    return Response.json({ error: "Slow down" }, { status: 429 });
  }
  const namespaces = await customerNamespaces(db(), sf.merchant.id, sf.customer.id);
  const owned = ids.length
    ? await db()
        .select({ id: memoryRecords.id })
        .from(memoryRecords)
        .where(and(eq(memoryRecords.merchantId, sf.merchant.id), inArray(memoryRecords.id, ids), inArray(memoryRecords.namespace, namespaces)))
    : [];
  const receipts = await refreshRecords(db(), memoryStore(), owned.map((o) => o.id), { merchantId: sf.merchant.id });
  return Response.json({ receipts }, { headers: { "Cache-Control": "no-store" } });
}

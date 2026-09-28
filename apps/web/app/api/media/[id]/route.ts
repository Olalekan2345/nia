/** Serve an uploaded photo. Ids are random UUIDs and content never changes, so it caches forever. */
import { eq } from "drizzle-orm";
import { media } from "@nia/database";
import { db } from "@/lib/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await db().select({ bytes: media.bytes, contentType: media.contentType }).from(media).where(eq(media.id, id));
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/**
 * Photo upload for shop teams (product and service photos).
 *
 * The browser shrinks photos before sending (Vercel caps request bodies at
 * 4.5 MB); here they are checked, EXIF-rotated, stripped of metadata (GPS,
 * camera) and stored as a JPEG ≤ 1600 px, served by /api/media/[id].
 */
import sharp, { type OutputInfo } from "sharp";
import { media } from "@nia/database";
import { isAppError } from "@nia/shared";
import { getSessionUser } from "@/lib/auth";
import { merchantAccessFor } from "@/lib/access";
import { assertSameOrigin, limit } from "@/lib/security";
import { db } from "@/lib/server";

export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
    const form = await req.formData();
    const merchantId = String(form.get("merchantId") ?? "");
    const access = await merchantAccessFor(user, merchantId, "STAFF");
    if (!access) return Response.json({ error: "Not found." }, { status: 404 });
    await limit(`media:${user.id}`, 60, 3600);

    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a photo to upload." }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "That photo is too large (max 4 MB)." }, { status: 413 });
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return Response.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });

    let out: { data: Buffer; info: OutputInfo };
    try {
      out = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error", limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
    } catch {
      return Response.json({ error: "That file isn’t a photo we can read." }, { status: 415 });
    }

    const [row] = await db()
      .insert(media)
      .values({ merchantId: access.merchant.id, contentType: "image/jpeg", bytes: out.data, width: out.info.width, height: out.info.height, sizeBytes: out.data.length, uploadedByUserId: user.id })
      .returning({ id: media.id });
    return Response.json({ url: `/api/media/${row!.id}`, width: out.info.width, height: out.info.height });
  } catch (err) {
    if (isAppError(err)) return Response.json({ error: err.message }, { status: err.code === "FORBIDDEN" ? 403 : err.code === "RATE_LIMITED" ? 429 : 400 });
    console.error("[media] upload failed", err);
    return Response.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}

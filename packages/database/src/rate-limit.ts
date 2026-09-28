import { sql } from "drizzle-orm";
import type { Db } from "./client";
import { rateLimits } from "./schema";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  resetAt: Date;
}

/**
 * Fixed-window counter stored in PostgreSQL so limits hold across serverless
 * instances. One atomic upsert per check.
 */
export async function checkRateLimit(
  db: Db,
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStart} = ${windowStart.toISOString()}::timestamptz then ${rateLimits.count} + 1 else 1 end`,
        windowStart: sql`${windowStart.toISOString()}::timestamptz`,
      },
    })
    .returning({ count: rateLimits.count });
  const count = rows[0]?.count ?? 1;
  return {
    allowed: count <= limit,
    count,
    limit,
    resetAt: new Date(windowStart.getTime() + windowSeconds * 1000),
  };
}

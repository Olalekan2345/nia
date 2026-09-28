import type { Db } from "./client";
import { auditLogs } from "./schema";

export async function audit(
  db: Db,
  entry: {
    merchantId?: string | null;
    actorType: "user" | "customer" | "system" | "telegram";
    actorId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      merchantId: entry.merchantId ?? null,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    // Audit logging must never break the user-facing action.
    console.error("[audit] failed to write audit log", (err as Error).message);
  }
}

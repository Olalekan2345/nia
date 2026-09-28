/**
 * Memory policy: the application — not the model — decides what becomes
 * durable memory.
 *
 * Buying red once is not the same as liking red. One-time instructions
 * ("send this one to Yaba") stay with the order, not the customer profile.
 * Inferred preferences are only kept after the customer confirms them.
 */
import { containsSensitive, type MemoryConfirmation, type MemoryDecision, type MemoryType } from "@nia/shared";
import type { MemoryCandidate } from "./schema";

/** Story/event memories: the fact that it happened stays useful even if it was a one-off. */
const EVENT_TYPES: ReadonlySet<MemoryType> = new Set([
  "OCCASION",
  "RELATIONSHIP_CONTEXT",
  "COMPLAINT",
  "MERCHANT_COMMITMENT",
  "CUSTOMER_COMMITMENT",
  "UNRESOLVED_REQUEST",
  "RETURN_OR_REFUND_CONTEXT",
  "OUTCOME",
  "RECOMMENDATION_RESPONSE",
]);

/** Types recorded by the order/booking systems — never from a chat claim. */
const SYSTEM_RECORDED_TYPES: ReadonlySet<MemoryType> = new Set(["PAST_ORDER", "PAST_SERVICE"]);

/** Memories worth a durable-wait so the UI can truthfully say "Remembered". */
const SIGNIFICANT_TYPES: ReadonlySet<MemoryType> = new Set([
  "CUSTOMER_PREFERENCE",
  "SIZE_OR_VARIANT",
  "DELIVERY_PREFERENCE",
  "LOCATION_PREFERENCE",
  "BUDGET",
  "CORRECTION",
  "COMPLAINT",
  "PAST_ORDER",
  "PAST_SERVICE",
  "MERCHANT_COMMITMENT",
]);

export interface PolicyDecision {
  decision: MemoryDecision;
  score: number;
  confirmation: MemoryConfirmation;
  significant: boolean;
  reasons: string[];
}

const DURABILITY_WEIGHT = { one_time: 0.2, short_term: 0.5, long_term: 1 } as const;

export function scoreCandidate(c: MemoryCandidate): number {
  const explicitness = c.explicit ? 1 : 0.3;
  const recency = c.temporalScope === "historical" ? 0.6 : 1;
  const confirmationBoost = c.isCorrection && c.explicit ? 0.05 : 0;
  const raw =
    0.28 * c.importance +
    0.24 * c.confidence +
    0.14 * DURABILITY_WEIGHT[c.durability] +
    0.16 * c.futureUsefulness +
    0.12 * explicitness +
    0.06 * recency +
    confirmationBoost;
  return Math.round(Math.min(1, Math.max(0, raw)) * 1000) / 1000;
}

export function classifyCandidate(c: MemoryCandidate): PolicyDecision {
  const reasons: string[] = [];
  const score = scoreCandidate(c);
  const significant = SIGNIFICANT_TYPES.has(c.type) || (c.isCorrection && c.explicit);
  const baseConfirmation: MemoryConfirmation = c.isCorrection && c.explicit ? "customer_corrected" : c.explicit ? "customer_stated" : "inferred";

  const result = (decision: MemoryDecision, confirmation = baseConfirmation): PolicyDecision => ({
    decision,
    score,
    confirmation,
    significant,
    reasons,
  });

  if ([c.statement, c.value, c.evidence, c.label].some((t) => containsSensitive(t))) {
    reasons.push("contains sensitive data (credentials, card, code or key) — never stored");
    return result("ignore");
  }
  if (SYSTEM_RECORDED_TYPES.has(c.type)) {
    reasons.push("orders and services are recorded from the order system, not from chat");
    return result("ignore");
  }
  if (c.confidence < 0.5) {
    reasons.push(`confidence ${c.confidence} below 0.5`);
    return result("ignore");
  }
  if (c.importance < 0.3 && c.futureUsefulness < 0.4) {
    reasons.push("low importance and low future usefulness");
    return result("ignore");
  }

  const isEvent = EVENT_TYPES.has(c.type);
  if (c.temporalScope === "this_order_only") {
    reasons.push("applies only to the current order — kept with the order, not the profile");
    return result("ephemeral");
  }
  if (c.durability === "one_time" && !isEvent) {
    reasons.push("one-time detail, not a lasting preference");
    return result("ephemeral");
  }

  if (!c.explicit) {
    if (score >= 0.5) {
      reasons.push("inferred, not stated — ask the customer before remembering");
      return result("confirmation_required", "inferred");
    }
    reasons.push(`inferred with weak evidence (score ${score})`);
    return result("ignore");
  }

  if (c.confidence >= 0.75 && score >= 0.55) {
    reasons.push(c.isCorrection ? "explicit correction by the customer" : "explicitly stated by the customer");
    return result("durable");
  }
  if (score >= 0.45) {
    reasons.push(`explicit but uncertain (confidence ${c.confidence}) — confirm first`);
    return result("confirmation_required");
  }
  reasons.push(`score ${score} below threshold`);
  return result("ignore");
}

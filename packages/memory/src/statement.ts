/**
 * The text actually written to Walrus. It is self-describing (type, date,
 * provenance) so a recalled memory is meaningful even without the SQL row —
 * e.g. after a Walrus restore.
 */
import type { MemoryConfirmation, MemoryType } from "@nia/shared";

const TYPE_PHRASE: Record<MemoryType, string> = {
  CUSTOMER_PREFERENCE: "preference",
  PAST_ORDER: "past order",
  PAST_SERVICE: "past service",
  PRODUCT_INTEREST: "product interest",
  SIZE_OR_VARIANT: "size or variant",
  DELIVERY_PREFERENCE: "delivery preference",
  LOCATION_PREFERENCE: "location",
  BUDGET: "budget",
  OCCASION: "occasion",
  RELATIONSHIP_CONTEXT: "who they shop for",
  COMPLAINT: "complaint",
  CORRECTION: "correction",
  MERCHANT_COMMITMENT: "merchant promise",
  CUSTOMER_COMMITMENT: "customer commitment",
  UNRESOLVED_REQUEST: "open request",
  OUTCOME: "outcome",
  NOTE: "note",
  RETURN_OR_REFUND_CONTEXT: "return or refund",
  RECOMMENDATION_RESPONSE: "reaction to a recommendation",
};

const SOURCE_PHRASE: Record<MemoryConfirmation, string> = {
  customer_stated: "stated by the customer",
  customer_confirmed: "confirmed by the customer",
  customer_corrected: "corrected by the customer",
  observed_from_orders: "observed from order history",
  inferred: "inferred",
  merchant_entered: "entered by the business",
};

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function composeMemoryText(input: {
  type: MemoryType;
  statement: string;
  confirmation: MemoryConfirmation;
  recordedAt: Date;
  previousValue?: string | null;
  channel?: string | null;
}): string {
  const statement = input.statement.trim().replace(/\s+/g, " ");
  const correction = input.previousValue ? ` This replaces the earlier value "${input.previousValue.trim()}".` : "";
  const via = input.channel ? ` via ${input.channel}` : "";
  return `${statement}${correction} (${TYPE_PHRASE[input.type]}; ${SOURCE_PHRASE[input.confirmation]}${via}; recorded ${isoDay(input.recordedAt)})`;
}

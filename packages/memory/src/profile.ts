/**
 * "What do you remember about me?" — the customer's current memories, grouped
 * for display with how sure Nia is:
 *
 *   Confirmed — the customer said, confirmed or corrected it
 *   Observed  — seen in their real orders
 *   Likely    — inferred (only kept after the customer agreed)
 *
 * Built from memory metadata for memories actually stored on Walrus. Labels
 * are UI text; the model is given Walrus-recalled text, never these labels.
 */
import type { MemoryConfirmation, MemoryType } from "@nia/shared";
import type { PassportEntry } from "./service";

export type MemoryCertainty = "Confirmed" | "Observed" | "Likely" | "From the shop";

export function certaintyOf(c: MemoryConfirmation): MemoryCertainty {
  if (c === "observed_from_orders") return "Observed";
  if (c === "inferred") return "Likely";
  if (c === "merchant_entered") return "From the shop";
  return "Confirmed";
}

export interface ProfileItem {
  id: string;
  label: string;
  certainty: MemoryCertainty;
  corrected: boolean;
  /** The value this one replaced, when it was a correction ("Lekki"). */
  previousLabel: string | null;
  blobId: string | null;
  storedAt: string | null;
  channel: string | null;
}

export interface ProfileSection {
  key: string;
  title: string;
  items: ProfileItem[];
}

const SECTIONS: { key: string; title: string; match: (type: MemoryType, subject: string) => boolean }[] = [
  { key: "size", title: "Sizes & options", match: (t) => t === "SIZE_OR_VARIANT" },
  { key: "colour", title: "Colours & style", match: (t, s) => t === "CUSTOMER_PREFERENCE" && /colou?r|style|fit|material|fabric/.test(s) },
  { key: "brand", title: "Brands", match: (_t, s) => /brand/.test(s) },
  { key: "delivery", title: "Delivery", match: (t) => t === "LOCATION_PREFERENCE" || t === "DELIVERY_PREFERENCE" },
  { key: "budget", title: "Budget", match: (t) => t === "BUDGET" },
  { key: "people", title: "People & occasions", match: (t) => t === "RELATIONSHIP_CONTEXT" || t === "OCCASION" },
  { key: "looking", title: "Looking for", match: (t) => t === "PRODUCT_INTEREST" || t === "UNRESOLVED_REQUEST" },
  { key: "history", title: "Service history", match: (t) => ["COMPLAINT", "RETURN_OR_REFUND_CONTEXT", "MERCHANT_COMMITMENT", "CUSTOMER_COMMITMENT", "OUTCOME", "RECOMMENDATION_RESPONSE", "PAST_ORDER", "PAST_SERVICE"].includes(t) },
  { key: "likes", title: "Likes & dislikes", match: (t) => t === "CUSTOMER_PREFERENCE" },
  { key: "other", title: "Other", match: () => true },
];

/**
 * @param entries the customer's passport entries (any lifecycle; superseded ones explain corrections)
 * @param topic optional words to narrow the list ("size", "delivery")
 */
export function groupMemoryProfile(entries: PassportEntry[], topic?: string): ProfileSection[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const current = entries.filter((e) => e.lifecycle === "active" && e.persistStatus === "stored" && !e.subjectKey.startsWith("tombstone_"));
  const words = (topic ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const sections = new Map<string, ProfileSection>();
  for (const e of current) {
    if (words.length && !words.some((w) => `${e.label} ${e.subjectKey} ${e.type}`.toLowerCase().includes(w))) continue;
    const s = SECTIONS.find((x) => x.match(e.type, e.subjectKey.toLowerCase()))!;
    const section = sections.get(s.key) ?? { key: s.key, title: s.title, items: [] };
    const previous = e.supersedesId ? byId.get(e.supersedesId) : undefined;
    section.items.push({
      id: e.id,
      label: e.label,
      certainty: certaintyOf(e.confirmation),
      corrected: e.confirmation === "customer_corrected",
      previousLabel: previous?.label ?? null,
      blobId: e.blobId,
      storedAt: e.storedAt,
      channel: e.channel,
    });
    sections.set(s.key, section);
  }
  return SECTIONS.map((s) => sections.get(s.key)).filter((s): s is ProfileSection => Boolean(s));
}

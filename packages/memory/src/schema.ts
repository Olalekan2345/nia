/**
 * Structured memory extraction schema.
 *
 * The extraction model proposes candidates in this shape; Zod validates them;
 * then the application policy (policy.ts) — not the model — decides whether a
 * candidate is ignored, ephemeral, needs the customer's confirmation, or is
 * durable.
 */
import { z } from "zod";
import { MEMORY_DURABILITIES, MEMORY_TYPES, normalizeSubject, type MemoryType } from "@nia/shared";

export const TEMPORAL_SCOPES = ["current", "historical", "this_order_only"] as const;

export const MemoryCandidateSchema = z.object({
  type: z.enum(MEMORY_TYPES).describe("Memory type"),
  subject: z
    .string()
    .min(1)
    .max(64)
    .describe("Snake_case subject key. Prefer the canonical keys listed in the instructions."),
  value: z.string().min(1).max(300).describe("The remembered value, short and normalised (e.g. 'XL', 'Lekki', 'earth tones')."),
  statement: z
    .string()
    .min(8)
    .max(500)
    .describe("Self-contained third-person sentence about the customer, e.g. 'Customer's usual delivery area is Lekki.'"),
  label: z.string().min(2).max(80).describe("Short UI label, e.g. 'Usual delivery: Lekki'"),
  evidence: z.string().min(1).max(300).describe("What in the conversation supports this (quote or close paraphrase)."),
  explicit: z.boolean().describe("true only if the customer directly stated it"),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  futureUsefulness: z.number().min(0).max(1),
  durability: z.enum(MEMORY_DURABILITIES),
  temporalScope: z.enum(TEMPORAL_SCOPES),
  isCorrection: z.boolean().describe("true if the customer is correcting or replacing something previously known"),
  previousValue: z.string().max(200).nullable().describe("The value being replaced, if this is a correction and it is known"),
});
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;

export const ExtractionResultSchema = z.object({
  candidates: z.array(MemoryCandidateSchema).max(8),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Canonical subject keys. Mapping synonyms onto one key is what lets a new
 * statement ("I've moved, use Yaba") supersede the old one ("deliver around Lekki").
 */
export const CANONICAL_SUBJECTS: Record<string, string> = {
  clothing_size: "Everyday clothing size (S, M, L, XL, 12, 14 …)",
  shoe_size: "Shoe size",
  colour_preference: "Colours the customer prefers",
  colour_avoidance: "Colours the customer avoids",
  material_avoidance: "Materials or fabrics the customer avoids (e.g. no lace)",
  usual_delivery_area: "Area/neighbourhood orders are usually delivered to",
  fulfilment_preference: "Delivery vs pickup preference",
  delivery_time_preference: "Preferred delivery time or day",
  usual_quantity: "Typical quantity bought (e.g. 6 yards)",
  budget_range: "Typical budget or spending limit",
  preferred_brand: "Brand preference",
  material_preference: "Preferred materials or fabrics",
  style_preference: "Style / fit preference",
  preferred_variant: "Preferred product variant (e.g. 500 ml size)",
  preferred_service: "Service they usually book",
  preferred_appointment_time: "Preferred appointment day/time",
  preferred_staff: "Preferred stylist / staff member",
  allergy_or_sensitivity: "Allergies or product sensitivities relevant to the shop",
  dietary_preference: "Dietary preferences (food merchants)",
  communication_preference: "How they like to be contacted or updated",
};

const SUBJECT_SYNONYMS: Record<string, string> = {
  size: "clothing_size",
  dress_size: "clothing_size",
  shirt_size: "clothing_size",
  clothes_size: "clothing_size",
  usual_size: "clothing_size",
  preferred_size: "clothing_size",
  colour: "colour_preference",
  colours: "colour_preference",
  colour_style: "colour_preference",
  favourite_colour: "colour_preference",
  preferred_colour: "colour_preference",
  preferred_colours: "colour_preference",
  delivery_area: "usual_delivery_area",
  delivery_location: "usual_delivery_area",
  usual_delivery_location: "usual_delivery_area",
  delivery_address_area: "usual_delivery_area",
  location: "usual_delivery_area",
  home_area: "usual_delivery_area",
  delivery_preference: "fulfilment_preference",
  delivery_method: "fulfilment_preference",
  pickup_preference: "fulfilment_preference",
  quantity: "usual_quantity",
  typical_quantity: "usual_quantity",
  budget: "budget_range",
  brand: "preferred_brand",
  material: "material_preference",
  fabric_preference: "material_preference",
  style: "style_preference",
  fit_preference: "style_preference",
  appointment_time: "preferred_appointment_time",
  preferred_time: "preferred_appointment_time",
  stylist: "preferred_staff",
  allergy: "allergy_or_sensitivity",
  allergies: "allergy_or_sensitivity",
};

/** The memory type each canonical subject belongs to. */
const CANONICAL_SUBJECT_TYPES: Record<string, MemoryType> = {
  clothing_size: "SIZE_OR_VARIANT",
  shoe_size: "SIZE_OR_VARIANT",
  preferred_variant: "SIZE_OR_VARIANT",
  usual_delivery_area: "LOCATION_PREFERENCE",
  fulfilment_preference: "DELIVERY_PREFERENCE",
  delivery_time_preference: "DELIVERY_PREFERENCE",
  budget_range: "BUDGET",
};

/**
 * Models sometimes label a stated preference ("I normally buy Medium") as a
 * PAST_ORDER. A current fact about a canonical preference subject is never an
 * order record, so re-type it; genuinely historical claims are left alone
 * (the policy ignores them — the order system records orders).
 */
export function normalizeCandidateType(c: MemoryCandidate): MemoryCandidate {
  if (c.type !== "PAST_ORDER" && c.type !== "PAST_SERVICE") return c;
  if (c.temporalScope === "historical") return c;
  const subject = canonicalSubject(c.subject);
  if (!(subject in CANONICAL_SUBJECTS)) return c;
  return { ...c, type: CANONICAL_SUBJECT_TYPES[subject] ?? "CUSTOMER_PREFERENCE" };
}

/** Keys that describe the customer themselves — a fact about someone else must never take them. */
const PERSONAL_SUBJECTS = new Set([
  "clothing_size",
  "shoe_size",
  "colour_preference",
  "colour_avoidance",
  "material_preference",
  "material_avoidance",
  "style_preference",
  "preferred_brand",
  "preferred_variant",
  "allergy_or_sensitivity",
  "dietary_preference",
]);
const OTHER_PEOPLE: Record<string, string> = {
  wife: "wife", husband: "husband", partner: "partner", fiance: "fiance", fiancee: "fiancee", boyfriend: "boyfriend", girlfriend: "girlfriend",
  mum: "mum", mom: "mum", mother: "mum", dad: "dad", father: "dad", sister: "sister", brother: "brother", son: "son", daughter: "daughter",
  baby: "baby", child: "child", kids: "kids", aunt: "aunt", uncle: "uncle", niece: "niece", nephew: "nephew", cousin: "cousin",
  grandma: "grandma", grandmother: "grandma", grandpa: "grandpa", grandfather: "grandpa", friend: "friend", boss: "boss", colleague: "colleague",
};
const PERSON = Object.keys(OTHER_PEOPLE).join("|");
/** "Wife's size: 12" / "Mum’s favourite colour" — the label names someone else's attribute. */
const LABEL_OTHER = new RegExp(`^(?:my |her |his |their )?(${PERSON})(?:'s|’s)\\b`, "i");
/** "Customer's wife wears size 12." — the statement is about someone else. */
const STATEMENT_OTHER = new RegExp(`^(?:the )?(?:customer(?:'s|’s)|their|his|her) (${PERSON})(?:'s|’s)? `, "i");

/**
 * Facts about the people a customer shops for ("my wife is a size 12") get their
 * own subject ("wife_clothing_size"), so they never supersede the customer's own
 * size or colours. Models often reuse the customer's canonical key for them.
 */
export function scopeSubjectToPerson(c: MemoryCandidate): MemoryCandidate {
  const subject = canonicalSubject(c.subject);
  if (!PERSONAL_SUBJECTS.has(subject)) return c;
  const who = (LABEL_OTHER.exec(c.label.trim()) ?? STATEMENT_OTHER.exec(c.statement.trim()))?.[1]?.toLowerCase();
  const person = who ? OTHER_PEOPLE[who] : undefined;
  return person ? { ...c, subject: `${person}_${subject}` } : c;
}

/** Everything extraction output goes through before the policy sees it. */
export function normalizeCandidate(c: MemoryCandidate): MemoryCandidate {
  return normalizeCandidateType(scopeSubjectToPerson(c));
}

export function canonicalSubject(subject: string): string {
  const key = normalizeSubject(subject);
  return SUBJECT_SYNONYMS[key] ?? key;
}

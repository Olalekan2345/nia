import { describe, expect, it } from "vitest";
import { classifyCandidate } from "../src/policy";
import { canonicalSubject, ExtractionResultSchema, normalizeCandidate, type MemoryCandidate } from "../src/schema";
import { buildRecallQuery, isForgetOrCorrectIntent, isForgetRequest, isRepeatIntent, shouldExtract } from "../src/recall-query";
import { composeMemoryText } from "../src/statement";

function candidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    type: "CUSTOMER_PREFERENCE",
    subject: "colour_preference",
    value: "darker colours",
    statement: "Customer prefers darker colours.",
    label: "Prefers: darker colours",
    evidence: "I like darker colours",
    explicit: true,
    confidence: 0.95,
    importance: 0.8,
    futureUsefulness: 0.85,
    durability: "long_term",
    temporalScope: "current",
    isCorrection: false,
    previousValue: null,
    ...overrides,
  };
}

describe("memory policy", () => {
  it("makes explicit, durable preferences durable", () => {
    const d = classifyCandidate(candidate());
    expect(d.decision).toBe("durable");
    expect(d.confirmation).toBe("customer_stated");
    expect(d.significant).toBe(true);
  });

  it("keeps a one-order instruction out of the long-term profile", () => {
    const d = classifyCandidate(
      candidate({
        type: "DELIVERY_PREFERENCE",
        subject: "usual_delivery_area",
        value: "Yaba",
        statement: "Customer wants this order sent to Yaba.",
        durability: "one_time",
        temporalScope: "this_order_only",
      }),
    );
    expect(d.decision).toBe("ephemeral");
  });

  it("keeps who they shop for even when it is about this purchase", () => {
    const d = classifyCandidate(
      candidate({
        type: "RELATIONSHIP_CONTEXT",
        subject: "gift_recipient",
        value: "sister",
        statement: "Customer is buying a gift for their sister's birthday.",
        durability: "short_term",
        temporalScope: "this_order_only",
      }),
    );
    expect(d.decision).toBe("durable");
  });

  it("treats an explicit move as a correction that supersedes", () => {
    const d = classifyCandidate(
      candidate({
        type: "DELIVERY_PREFERENCE",
        subject: "usual_delivery_area",
        value: "Yaba",
        isCorrection: true,
        previousValue: "Lekki",
      }),
    );
    expect(d.decision).toBe("durable");
    expect(d.confirmation).toBe("customer_corrected");
  });

  it("asks before remembering an inferred preference (buying red once ≠ loving red)", () => {
    const d = classifyCandidate(candidate({ explicit: false, confidence: 0.7, value: "red", statement: "Customer may like red." }));
    expect(d.decision).toBe("confirmation_required");
    expect(d.confirmation).toBe("inferred");
  });

  it("ignores weak inferences", () => {
    const d = classifyCandidate(candidate({ explicit: false, confidence: 0.55, importance: 0.3, futureUsefulness: 0.3, durability: "short_term" }));
    expect(d.decision).toBe("ignore");
  });

  it("never stores sensitive values", () => {
    const d = classifyCandidate(candidate({ statement: "Customer's card is 4111 1111 1111 1111", value: "4111 1111 1111 1111" }));
    expect(d.decision).toBe("ignore");
    expect(d.reasons.join(" ")).toMatch(/sensitive/);
  });

  it("does not trust chat claims about past orders", () => {
    expect(classifyCandidate(candidate({ type: "PAST_ORDER" })).decision).toBe("ignore");
  });

  it("keeps story context (occasions) even when the event is one-off", () => {
    const d = classifyCandidate(
      candidate({
        type: "OCCASION",
        subject: "mothers_60th_birthday",
        value: "mother's 60th birthday",
        statement: "Customer bought fabric for their mother's 60th birthday.",
        durability: "one_time",
        importance: 0.7,
      }),
    );
    expect(d.decision).toBe("durable");
  });
});

describe("extraction schema", () => {
  it("validates model output and rejects unknown types", () => {
    expect(ExtractionResultSchema.safeParse({ candidates: [candidate()] }).success).toBe(true);
    expect(ExtractionResultSchema.safeParse({ candidates: [{ ...candidate(), type: "FAVOURITE_FOOD" }] }).success).toBe(false);
    expect(ExtractionResultSchema.safeParse({ candidates: [{ ...candidate(), confidence: 3 }] }).success).toBe(false);
  });

  it("maps subject synonyms to canonical keys", () => {
    expect(canonicalSubject("Delivery Location")).toBe("usual_delivery_area");
    expect(canonicalSubject("colour_style")).toBe("colour_preference");
    expect(canonicalSubject("color")).toBe("colour_preference");
    expect(canonicalSubject("size")).toBe("clothing_size");
    expect(canonicalSubject("wedding_date")).toBe("wedding_date");
  });

  it("keeps facts about other people off the customer's own keys", () => {
    const wife = candidate({ type: "SIZE_OR_VARIANT", subject: "clothing_size", value: "12", label: "Wife's size: 12", statement: "Customer's wife is a size 12." });
    expect(normalizeCandidate(wife).subject).toBe("wife_clothing_size");
    const mum = candidate({ subject: "favourite_colour", value: "lilac", label: "Mum’s colour: lilac", statement: "Customer's mother loves lilac." });
    expect(normalizeCandidate(mum).subject).toBe("mum_colour_preference");
    const sister = candidate({ subject: "colour_preference", value: "lilac", label: "Sister's colour: lilac", statement: "Customer's sister's favourite colour is lilac." });
    expect(normalizeCandidate(sister).subject).toBe("sister_colour_preference");
    const byStatement = candidate({ subject: "shoe_size", value: "42", label: "Shoe size: 42", statement: "Customer's husband wears shoe size 42." });
    expect(normalizeCandidate(byStatement).subject).toBe("husband_shoe_size");
    // The customer's own facts — even when the sentence mentions someone else — keep their keys.
    expect(normalizeCandidate(candidate()).subject).toBe("colour_preference");
    expect(normalizeCandidate(candidate({ statement: "Customer prefers darker colours, also when shopping for her mum." })).subject).toBe("colour_preference");
    expect(normalizeCandidate(candidate({ type: "RELATIONSHIP_CONTEXT", subject: "gift_recipient", label: "Shopping for wife", statement: "Customer's wife is who they shop for." })).subject).toBe("gift_recipient");
  });
});

describe("intent helpers", () => {
  it("detects repeat intent phrasings", () => {
    for (const t of ["Same as last time", "the usual please", "repeat my last order", "book my usual service", "send it where you sent the last one", "same colour but larger"]) {
      expect(isRepeatIntent(t), t).toBe(true);
    }
    expect(isRepeatIntent("Do you have blue lace?")).toBe(false);
  });

  it("detects forget/correct requests", () => {
    expect(isForgetOrCorrectIntent("Don't remember that")).toBe(true);
    expect(isForgetOrCorrectIntent("That isn't correct")).toBe(true);
    expect(isForgetOrCorrectIntent("please forget that")).toBe(true);
  });

  it("tells forget requests apart from updates", () => {
    for (const t of ["Please forget my size", "Don't remember that", "That isn't correct", "delete that memory"]) expect(isForgetRequest(t), t).toBe(true);
    for (const t of ["I've moved. Use Yaba from now on.", "My size is XL now", "remove the blue one from my cart"]) expect(isForgetRequest(t), t).toBe(false);
  });

  it("skips extraction for pure recall questions but not for updates", () => {
    expect(shouldExtract("What do I normally like?")).toBe(false);
    expect(shouldExtract("Do you remember my size?")).toBe(false);
    expect(shouldExtract("My size is XL now")).toBe(true);
    expect(shouldExtract("What do I normally like? I prefer navy now.")).toBe(true);
  });

  it("skips extraction on acknowledgements", () => {
    expect(shouldExtract("ok")).toBe(false);
    expect(shouldExtract("thanks!")).toBe(false);
    expect(shouldExtract("I normally buy Medium")).toBe(true);
  });

  it("builds focused recall queries", () => {
    expect(buildRecallQuery(["Same as last time"])).toMatch(/previous orders/);
    expect(buildRecallQuery(["I want lace for a wedding", "yes"])).toContain("I want lace for a wedding");
  });
});

describe("memory text", () => {
  it("is self-describing and records corrections", () => {
    const text = composeMemoryText({
      type: "DELIVERY_PREFERENCE",
      statement: "Customer's usual delivery area is Yaba.",
      confirmation: "customer_corrected",
      recordedAt: new Date("2026-09-27T10:00:00Z"),
      previousValue: "Lekki",
      channel: "web",
    });
    expect(text).toContain("Yaba");
    expect(text).toContain('earlier value "Lekki"');
    expect(text).toContain("corrected by the customer");
    expect(text).toContain("2026-09-27");
  });
});

describe("observed order patterns", () => {
  it("counts orders (not lines), ignores cancelled, needs 2+", async () => {
    const { observedPatterns } = await import("../src/history");
    const o = (status: string, ...opts: Record<string, string>[]) => ({ status, items: opts.map((options) => ({ options })) });
    const patterns = observedPatterns([
      o("delivered", { colour: "Black", size: "M" }, { colour: "Black", size: "L" }),
      o("awaiting_confirmation", { colour: "black", size: "M" }),
      o("cancelled", { colour: "Navy", size: "M" }),
      o("confirmed", { colour: "Navy" }),
    ]);
    expect(patterns).toEqual([
      { key: "colour", value: "Black", count: 2 },
      { key: "size", value: "M", count: 2 },
    ]);
  });
});

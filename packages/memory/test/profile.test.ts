import { describe, expect, it } from "vitest";
import { certaintyOf, groupMemoryProfile, type PassportEntry } from "../src";

let n = 0;
const entry = (over: Partial<PassportEntry>): PassportEntry => ({
  id: `e${++n}`,
  type: "CUSTOMER_PREFERENCE",
  label: "Likes darker colours",
  confirmation: "customer_stated",
  lifecycle: "active",
  persistStatus: "stored",
  blobId: `blob${n}`,
  storedAt: "2026-09-28T10:00:00.000Z",
  validFrom: "2026-09-28T10:00:00.000Z",
  validTo: null,
  sourceKind: "conversation",
  channel: "web",
  evidence: null,
  subjectKey: "colour_preference",
  supersedesId: null,
  namespace: "nia:m:c",
  ...over,
});

describe("what Nia remembers", () => {
  it("maps provenance to how sure Nia is", () => {
    expect(certaintyOf("customer_stated")).toBe("Confirmed");
    expect(certaintyOf("customer_confirmed")).toBe("Confirmed");
    expect(certaintyOf("customer_corrected")).toBe("Confirmed");
    expect(certaintyOf("observed_from_orders")).toBe("Observed");
    expect(certaintyOf("inferred")).toBe("Likely");
  });

  it("groups current memories, shows what a correction replaced, and hides the rest", () => {
    const lekki = entry({ type: "LOCATION_PREFERENCE", subjectKey: "usual_delivery_area", label: "Usual delivery: Lekki", lifecycle: "superseded" });
    const entries = [
      entry({ type: "SIZE_OR_VARIANT", subjectKey: "clothing_size", label: "Size: Medium" }),
      entry({ label: "Likes darker colours" }),
      lekki,
      entry({ type: "LOCATION_PREFERENCE", subjectKey: "usual_delivery_area", label: "Usual delivery: Yaba", confirmation: "customer_corrected", supersedesId: lekki.id }),
      entry({ type: "SIZE_OR_VARIANT", subjectKey: "preferred_variant", label: "Usually picks black", confirmation: "observed_from_orders" }),
      entry({ type: "RELATIONSHIP_CONTEXT", subjectKey: "gift_recipient", label: "Buying for sister's birthday", confirmation: "inferred" }),
      entry({ label: "Forgotten thing", lifecycle: "forgotten" }),
      entry({ label: "Still saving", persistStatus: "pending" }),
      entry({ label: "Forgotten memory", subjectKey: "tombstone_abc" }),
    ];
    const sections = groupMemoryProfile(entries);
    const flat = sections.flatMap((s) => s.items.map((i) => ({ section: s.title, ...i })));
    expect(flat.map((i) => i.label)).toEqual(["Size: Medium", "Usually picks black", "Likes darker colours", "Usual delivery: Yaba", "Buying for sister's birthday"]);
    expect(flat.find((i) => i.label === "Usual delivery: Yaba")).toMatchObject({ section: "Delivery", certainty: "Confirmed", corrected: true, previousLabel: "Usual delivery: Lekki" });
    expect(flat.find((i) => i.label === "Usually picks black")!.certainty).toBe("Observed");
    expect(flat.find((i) => i.label === "Buying for sister's birthday")).toMatchObject({ section: "People & occasions", certainty: "Likely" });
    expect(flat.every((i) => i.blobId)).toBe(true); // every one is on Walrus
  });

  it("narrows to a topic", () => {
    const sections = groupMemoryProfile([entry({ type: "SIZE_OR_VARIANT", subjectKey: "clothing_size", label: "Size: Large" }), entry({ label: "Likes darker colours" })], "size");
    expect(sections.flatMap((s) => s.items.map((i) => i.label))).toEqual(["Size: Large"]);
  });
});

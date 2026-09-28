import { describe, expect, it } from "vitest";
import { classifyCandidate } from "@nia/memory";
import { decisionAnswer, splitAskedQuestion, withAskedQuestions } from "../src/decisions";

describe("decision questions in stored text", () => {
  it("round-trips the question Nia asked", () => {
    const stored = withAskedQuestions("Lovely! A few ideas coming up.", [{ question: "Which colour would she love?", options: ["Emerald", "Cobalt"] }]);
    expect(stored).toBe("Lovely! A few ideas coming up.\n\nNia asked: Which colour would she love? (Emerald / Cobalt)");
    expect(splitAskedQuestion(stored)).toEqual({ body: "Lovely! A few ideas coming up.", asked: "Which colour would she love? (Emerald / Cobalt)" });
  });

  it("works when the reply was only a question", () => {
    const stored = withAskedQuestions("", [{ question: "Who is it for?", options: ["Me", "A gift"] }]);
    expect(splitAskedQuestion(stored)).toEqual({ body: "", asked: "Who is it for? (Me / A gift)" });
  });

  it("leaves ordinary replies alone", () => {
    expect(withAskedQuestions("Here you go.", [])).toBe("Here you go.");
    expect(splitAskedQuestion("Here you go.")).toEqual({ body: "Here you go.", asked: null });
  });
});

describe("tapped decision answers", () => {
  const gift = { question: "What kind of gift are you thinking?", options: ["Clothing / fabric", "Cake / dessert", "Not sure yet"], topic: "Gift type" };

  it("turns a tapped option into an explicit memory worded from the question", () => {
    const { tapped, candidate } = decisionAnswer(gift, "Clothing / fabric");
    expect(tapped).toBe(true);
    expect(candidate).toMatchObject({
      type: "PRODUCT_INTEREST",
      subject: "gift_type",
      value: "Clothing / fabric",
      label: "Gift type: Clothing / fabric",
      statement: 'When Nia asked "What kind of gift are you thinking?", the shopper chose "Clothing / fabric".',
      explicit: true,
    });
    expect(classifyCandidate(candidate!).decision).toBe("durable");
  });

  it("maps budget and personal preferences to their memory types", () => {
    expect(decisionAnswer({ question: "What's your budget?", options: ["Under ₦20,000", "₦20,000+"] }, "Under ₦20,000").candidate).toMatchObject({ type: "BUDGET", subject: "budget_range" });
    expect(decisionAnswer({ question: "Which colours do you usually wear?", options: ["Earth tones", "Bright"], topic: "Colours" }, "earth tones").candidate).toMatchObject({ type: "CUSTOMER_PREFERENCE", durability: "long_term" });
  });

  it("saves nothing for a non-answer, and leaves typed replies to the extraction model", () => {
    expect(decisionAnswer(gift, "Not sure yet")).toEqual({ tapped: true, candidate: null });
    expect(decisionAnswer(gift, "Maybe a nice scarf in green")).toEqual({ tapped: false, candidate: null });
  });
});

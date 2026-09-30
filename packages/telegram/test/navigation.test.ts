import { describe, expect, it } from "vitest";
import { navigationIntent, type NavPlace } from "../src/navigation";

const places: NavPlace[] = [
  { slug: "market", name: "Walrus Market", businessType: "other", kind: "market" },
  { slug: "walrus-drinks", name: "Walrus Drinks", businessType: "drinks", kind: "shop" },
  { slug: "crumb-and-co", name: "Crumb & Co.", businessType: "bakery", kind: "shop" },
  { slug: "adire-lane", name: "Adire Lane", businessType: "fabric", kind: "shop" },
  { slug: "walrus-designers", name: "Walrus Clothes & Designers", businessType: "fashion", kind: "shop" },
  { slug: "glow-theory", name: "Glow Theory Studio", businessType: "salon", kind: "shop" },
];
const nav = (t: string) => navigationIntent(t, places);

describe("moving around on Telegram", () => {
  it("goes back to the market in everyday words", () => {
    for (const t of ["take me back to the market", "Back to the main market please", "go back to walrus market", "switch to the market", "market", "Leave this shop", "exit this department", "open the market"]) {
      expect(nav(t), t).toEqual({ target: { kind: "market" }, request: null });
    }
  });

  it("keeps the rest of the message to answer after switching", () => {
    expect(nav("go back to the market and find me a phone under 200k")).toEqual({ target: { kind: "market" }, request: "find me a phone under 200k" });
    expect(nav("switch to Walrus Drinks and show me juices")).toEqual({ target: { kind: "shop", slug: "walrus-drinks" }, request: "show me juices" });
  });

  it("switches to a shop by name or by department", () => {
    expect(nav("switch to Crumb & Co")).toMatchObject({ target: { kind: "shop", slug: "crumb-and-co" } });
    expect(nav("take me to the bakery")).toMatchObject({ target: { kind: "shop", slug: "crumb-and-co" } });
    expect(nav("open adire lane")).toMatchObject({ target: { kind: "shop", slug: "adire-lane" } });
    expect(nav("go to the drinks section")).toMatchObject({ target: { kind: "shop", slug: "walrus-drinks" } });
    expect(nav("take me to clothes")).toMatchObject({ target: { kind: "shop", slug: "walrus-designers" } }); // by name
    // A department with two shops (fabric + fashion) → let them choose.
    expect(nav("take me to fashion")).toEqual({ target: { kind: "chooser" }, request: null });
    expect(nav("show me other shops")).toEqual({ target: { kind: "chooser" }, request: null });
  });

  it("never mistakes a shopping request for navigation", () => {
    for (const t of ["get me drinks for tonight", "I'm going to a wedding, I need a dress", "take the red one", "I need a cake to go to a party", "what's on the market today?", "back to school bag", "Show me drinks", "open to suggestions for a gift"]) {
      expect(nav(t), t).toBeNull();
    }
  });
});

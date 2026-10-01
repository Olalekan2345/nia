import { describe, expect, it } from "vitest";
import { namedProduct } from "../src";

const cakes = [
  { id: "1", name: "Celebration Cake" },
  { id: "2", name: "Vanilla Celebration Cake" },
  { id: "3", name: "Red Velvet Cake" },
];

describe("namedProduct", () => {
  it("finds the product a question names, preferring the most specific name", () => {
    expect(namedProduct(cakes, ["Tell me more about the Vanilla Celebration Cake"])?.id).toBe("2");
    expect(namedProduct(cakes, ["Tell me more about the Celebration Cake"])?.id).toBe("1");
    expect(namedProduct(cakes, [null, "red velvet cake"])?.id).toBe("3");
  });

  it("ignores case and punctuation, and the shop's name after it", () => {
    expect(namedProduct([{ id: "j", name: "100% Orange Juice" }], ["tell me more about the 100% orange-juice from Walrus Drinks!"])?.id).toBe("j");
  });

  it("names nothing for a general search or a partial word", () => {
    expect(namedProduct(cakes, ["Do you have cakes for a birthday?", "cake"])).toBeNull();
    expect(namedProduct(cakes, ["Celebration Cakes please"])).toBeNull();
    expect(namedProduct(cakes, [undefined, ""])).toBeNull();
  });
});

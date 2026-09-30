import { EVERY_DAY, item, lagosAreas, variantsOf, weekdayHours, withSkus, type DemoTemplateBase } from "./kit";

/** Walrus Drinks — a fictional non-alcoholic drinks shop. Brands are invented house labels. */
export const DRINKS: DemoTemplateBase = {
  label: "Drinks",
  businessType: "drinks",
  name: "Walrus Drinks",
  slug: "walrus-drinks",
  tagline: "Juices, water, soft drinks, coffee and party packs",
  description: "A fictional drinks shop in Walrus Market. Everything here is non-alcoholic.",
  accentColor: "#0B7F9C",
  welcomeMessage: "Stocking up or planning a party? Tell me how many people and what they like to drink.",
  city: "Lagos",
  country: "NG",
  fulfillment: { delivery: true, pickup: true, pickupAddress: "Warehouse gate — 15 Cooler Street, Yaba (fictional)" },
  deliveryAreas: lagosAreas({ core: 2500, mainland: 1500, far: 3000 }),
  openingHours: weekdayHours("08:00", "21:00", EVERY_DAY),
  paymentInstructions: "Pay by transfer or on delivery. Bulk orders of 5 packs or more get free delivery on the mainland.",
  products: withSkus("WD", [
    // Water
    item("still-bottled-water", "Still Bottled Water", "Water", 2_800, "pack", "Clean, purified still water in easy-carry bottles.", {
      variants: variantsOf({ pack: [["75 cl × 12", 2_800], ["1.5 L × 6", 3_000], ["50 cl × 24", 4_200]] }),
      tags: ["water", "bottled water", "drink", "essential", "pick"],
      q: "bottled water",
    }),
    item("sparkling-water", "Sparkling Water", "Water", 1_200, "bottle", "Crisp sparkling water with fine bubbles.", {
      variants: variantsOf({ flavour: ["Natural", "Lemon", "Lime"], size: [["50 cl", 1_200], ["6 × 50 cl", 6_500]] }),
      tags: ["sparkling water", "water", "drink"],
      q: "sparkling water glass",
    }),
    // Soft drinks
    item("classic-cola", "Classic Cola", "Soft Drinks", 500, "bottle", "An ice-cold classic cola.", {
      variants: variantsOf({ size: [["35 cl", 500], ["1 L", 1_200], ["35 cl × 12", 5_600]] }),
      tags: ["cola", "soda", "soft drink", "drink", "party"],
      q: ["cola", "soda glass ice", "soft drink glass"],
    }),
    item("lemon-lime-soda", "Lemon-Lime Soda", "Soft Drinks", 500, "bottle", "Clear, zesty lemon-lime soda.", {
      variants: variantsOf({ size: [["35 cl", 500], ["1 L", 1_200], ["35 cl × 12", 5_600]] }),
      tags: ["soda", "lemon", "soft drink", "drink"],
      q: "lemon soda drink",
    }),
    item("orange-soda", "Orange Soda", "Soft Drinks", 500, "bottle", "Bright, fizzy orange soda.", {
      variants: variantsOf({ size: [["35 cl", 500], ["35 cl × 12", 5_600]] }),
      tags: ["soda", "orange", "soft drink", "drink"],
      q: ["orange soda", "orange drink", "fizzy drink"],
    }),
    item("sparkling-ginger-drink", "Sparkling Ginger Drink", "Soft Drinks", 700, "can", "A sparkling drink with real ginger heat.", {
      variants: variantsOf({ pack: [["Single can", 700], ["6-pack", 3_900]] }),
      tags: ["ginger", "soft drink", "drink"],
      q: "ginger drink",
    }),
    // Juices
    item("orange-juice", "100% Orange Juice", "Juices", 2_500, "carton", "Not-from-concentrate orange juice, no added sugar.", {
      variants: variantsOf({ size: [["1 L", 2_500], ["1 L × 6", 14_000]] }),
      tags: ["orange juice", "juice", "drink", "breakfast", "pick"],
      q: "orange juice glass",
    }),
    item("apple-juice", "Pure Apple Juice", "Juices", 2_500, "carton", "Pressed apple juice, lightly filtered.", {
      variants: variantsOf({ size: [["1 L", 2_500], ["1 L × 6", 14_000]] }),
      tags: ["apple juice", "juice", "drink"],
      q: "apple juice",
    }),
    item("pineapple-juice", "Pineapple Juice", "Juices", 2_300, "carton", "Sweet, tangy pineapple juice.", {
      variants: variantsOf({ size: [["1 L", 2_300]] }),
      tags: ["pineapple juice", "juice", "drink"],
      q: "pineapple juice",
    }),
    item("mango-fruit-drink", "Mango Fruit Drink", "Juices", 1_800, "carton", "A smooth mango drink made with mango pulp.", {
      variants: variantsOf({ size: [["1 L", 1_800], ["1 L × 6", 10_000]] }),
      tags: ["mango", "juice", "fruit drink", "drink"],
      q: "mango juice",
    }),
    // Malt & energy
    item("malt-drink", "Classic Malt Drink", "Malt Drinks", 600, "can", "A rich, non-alcoholic malt drink. Best chilled.", {
      variants: variantsOf({ pack: [["Single can", 600], ["6-pack", 3_400], ["24-pack", 13_000]] }),
      tags: ["malt", "malt drink", "drink", "party"],
      q: ["dark soda glass", "brown drink glass", "soft drink bottle"],
    }),
    item("energy-drink", "Walrus Charge Energy Drink", "Energy Drinks", 900, "can", "A citrus energy drink for long days. Not for children or pregnant women.", {
      variants: variantsOf({ flavour: ["Original", "Sugar-free"], pack: [["Single can", 900], ["6-pack", 5_000]] }),
      tags: ["energy drink", "drink"],
      q: ["energy drink", "drink can", "soda can"],
    }),
    // Dairy
    item("chocolate-milk", "Chocolate Milk", "Milk & Dairy Drinks", 1_200, "bottle", "Creamy chocolate milk, ready to drink.", {
      variants: variantsOf({ size: [["50 cl", 1_200], ["50 cl × 6", 6_600]] }),
      tags: ["chocolate milk", "milk", "dairy", "drink", "kids"],
      q: "chocolate milk",
    }),
    item("vanilla-milk-drink", "Vanilla Milk Drink", "Milk & Dairy Drinks", 1_100, "bottle", "Smooth vanilla-flavoured milk.", {
      tags: ["milk", "vanilla", "dairy", "drink"],
      q: "glass of milk",
    }),
    item("strawberry-yoghurt-drink", "Strawberry Yoghurt Drink", "Milk & Dairy Drinks", 1_400, "bottle", "A drinkable yoghurt with strawberry.", {
      tags: ["yoghurt", "yogurt", "strawberry", "dairy", "drink"],
      q: "strawberry milkshake",
    }),
    // Tea & coffee
    item("lemon-iced-tea", "Lemon Iced Tea", "Tea & Coffee", 1_000, "bottle", "Brewed black tea with lemon, lightly sweetened.", {
      variants: variantsOf({ pack: [["Single bottle", 1_000], ["6-pack", 5_500]] }),
      tags: ["iced tea", "tea", "drink", "weekend"],
      q: "iced tea lemon",
    }),
    item("cold-brew-iced-coffee", "Cold Brew Iced Coffee", "Tea & Coffee", 2_500, "bottle", "Smooth cold brew coffee, ready to pour over ice.", {
      variants: variantsOf({ style: ["Black", "With milk"] }),
      tags: ["iced coffee", "coffee", "cold brew", "drink", "home office"],
      q: "iced coffee",
    }),
    item("ground-coffee", "Medium Roast Ground Coffee", "Tea & Coffee", 6_500, "bag", "250 g of medium-roast ground coffee for filter or cafetière.", {
      tags: ["coffee", "ground coffee", "drink", "home office", "essential"],
      q: "coffee beans ground",
    }),
    item("green-tea-bags", "Green Tea Bags", "Tea & Coffee", 3_500, "box", "A box of 40 green tea bags.", {
      tags: ["green tea", "tea", "drink"],
      q: "green tea cup",
    }),
    // Smoothies & mocktails
    item("mango-banana-smoothie", "Mango Banana Smoothie", "Smoothies", 3_500, "bottle", "Blended mango, banana and yoghurt, made fresh daily.", {
      inventoryStatus: "made_to_order",
      stockQuantity: null,
      tags: ["smoothie", "mango", "banana", "drink", "healthy"],
      q: ["mango smoothie", "smoothie glass", "yellow smoothie"],
    }),
    item("berry-blast-smoothie", "Berry Blast Smoothie", "Smoothies", 3_800, "bottle", "Strawberry, blueberry and banana blended with yoghurt.", {
      inventoryStatus: "made_to_order",
      stockQuantity: null,
      tags: ["smoothie", "berry", "drink", "healthy"],
      q: "berry smoothie",
    }),
    item("zobo-hibiscus-drink", "Zobo Hibiscus Drink", "Mocktails", 1_500, "bottle", "Chilled hibiscus drink with ginger, pineapple and cloves.", {
      variants: variantsOf({ size: [["50 cl", 1_500], ["1 L", 2_800]] }),
      tags: ["zobo", "hibiscus", "mocktail", "drink", "weekend", "pick"],
      q: ["hibiscus tea", "red drink glass", "iced tea red"],
    }),
    item("sunset-fruit-mocktail", "Sunset Fruit Mocktail", "Mocktails", 2_000, "bottle", "A sparkling, non-alcoholic fruit punch with citrus and cucumber.", {
      tags: ["mocktail", "fruit punch", "drink", "party", "weekend"],
      q: ["mocktail", "fruit punch", "fruit drink glass"],
    }),
    // Packs
    item("party-drinks-pack", "Party Drinks Pack", "Drink Packs", 18_000, "pack", "24 assorted drinks — cola, lemon-lime, orange, malt and water — for gatherings.", {
      variants: variantsOf({ size: [["24 drinks", 18_000], ["48 drinks", 34_000]] }),
      tags: ["party pack", "drinks pack", "multipack", "drink", "party", "weekend"],
      q: ["soft drinks", "soda bottles", "drink bottles"],
    }),
  ]),
  services: [],
  knowledge: [
    { category: "shipping", title: "Bulk delivery", body: "Orders of 5 packs or more are delivered free on the Lagos mainland." },
    { category: "product_guidance", title: "Non-alcoholic only", body: "Walrus Drinks sells non-alcoholic drinks only." },
  ],
};

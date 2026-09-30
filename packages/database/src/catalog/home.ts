import { MON_SAT, item, lagosAreas, variantsOf, weekdayHours, withSkus, type DemoTemplateBase } from "./kit";

/** Walrus Home — a fictional homeware shop. */
export const HOME: DemoTemplateBase = {
  label: "Homeware",
  businessType: "homeware",
  name: "Walrus Home",
  slug: "walrus-home",
  tagline: "Bedding, kitchen, lighting and the home office",
  description: "A fictional homeware shop in Walrus Market: everyday essentials and a few nice things for your space.",
  accentColor: "#177A53",
  welcomeMessage: "Setting up a room or replacing the basics? Tell me the space and your budget.",
  city: "Lagos",
  country: "NG",
  fulfillment: { delivery: true, pickup: true, pickupAddress: "Store — 30 Hearth Avenue, Ikeja GRA (fictional)" },
  deliveryAreas: lagosAreas({ core: 3500, mainland: 2500, far: 4500 }),
  openingHours: weekdayHours("09:00", "19:00", MON_SAT),
  paymentInstructions: "We confirm stock and delivery date, then send payment details. Large items are delivered within 3 days.",
  products: withSkus("WH", [
    // Bedding
    item("cotton-bedsheet-set", "Cotton Bedsheet Set", "Bedding", 28_000, "set", "A 400-thread-count cotton set: fitted sheet, flat sheet and two pillowcases.", {
      variants: variantsOf({ size: [["Double", 28_000], ["King", 34_000]], colour: ["White", "Grey", "Sage"] }),
      tags: ["bedsheets", "bedding", "bedroom", "home", "essential", "pick"],
      q: "white bed sheets bedroom",
    }),
    item("throw-pillow-pair", "Throw Pillow Pair", "Bedding", 14_000, "pair", "Two textured cushions with removable covers.", {
      variants: variantsOf({ colour: ["Terracotta", "Mustard", "Cream"] }),
      tags: ["pillows", "cushions", "throw pillow", "living room", "home", "weekend"],
      q: "throw pillows sofa",
    }),
    item("waffle-knit-throw", "Waffle-Knit Throw Blanket", "Bedding", 18_000, "piece", "A soft waffle-knit throw for the sofa or foot of the bed.", {
      variants: variantsOf({ colour: ["Oat", "Charcoal"] }),
      tags: ["throw", "blanket", "living room", "home", "weekend"],
      q: ["knit blanket", "throw blanket", "blanket sofa"],
    }),
    // Kitchen
    item("stoneware-mug-set", "Stoneware Mug Set", "Kitchen", 12_000, "set", "Four 350 ml stoneware mugs with a reactive glaze.", {
      variants: variantsOf({ colour: ["Ocean", "Sand"] }),
      tags: ["mugs", "kitchen", "coffee", "home", "gift"],
      q: "ceramic mugs",
    }),
    item("insulated-water-bottle", "Insulated Water Bottle", "Kitchen", 9_500, "piece", "Keeps drinks cold for 24 hours or hot for 12. 750 ml.", {
      variants: variantsOf({ colour: ["Black", "Teal", "White"] }),
      tags: ["water bottle", "bottle", "kitchen", "home", "essential", "home office"],
      q: ["water bottle", "reusable bottle", "flask bottle"],
    }),
    item("kitchen-knife-set", "Five-Piece Knife Set", "Kitchen", 25_000, "set", "Chef's, bread, utility and paring knives with a wooden block.", {
      tags: ["knives", "knife set", "kitchen", "home"],
      q: ["kitchen knife", "chef knife", "knives cutting board"],
    }),
    item("glass-food-containers", "Glass Food Container Set", "Kitchen", 16_000, "set", "Five oven-safe glass containers with snap-lock lids.", {
      tags: ["food containers", "storage", "kitchen", "home", "essential"],
      q: ["food containers", "meal prep containers", "glass jars kitchen"],
    }),
    item("wooden-utensil-set", "Wooden Utensil Set", "Kitchen", 8_500, "set", "Six acacia-wood spoons and spatulas that won't scratch pans.", {
      tags: ["utensils", "kitchen", "cooking", "home"],
      q: "wooden kitchen utensils",
    }),
    // Cookware
    item("non-stick-frying-pan", "Non-Stick Frying Pan", "Cookware", 19_000, "piece", "A heavy-base non-stick pan that works on gas and induction.", {
      variants: variantsOf({ size: [["24 cm", 19_000], ["28 cm", 23_000]] }),
      tags: ["frying pan", "cookware", "kitchen", "home", "essential"],
      q: "frying pan",
    }),
    item("stainless-pot-set", "Stainless Steel Pot Set", "Cookware", 48_000, "set", "Three pots with glass lids — 2 L, 4 L and 6 L.", {
      tags: ["pots", "cookware", "kitchen", "home"],
      q: "cooking pots stainless",
    }),
    // Lighting
    item("led-desk-lamp", "LED Desk Lamp", "Lighting", 17_000, "piece", "Adjustable desk lamp with three colour temperatures and a USB port.", {
      variants: variantsOf({ colour: ["Black", "White"] }),
      tags: ["desk lamp", "lamp", "lighting", "home", "home office", "pick"],
      q: ["desk lamp", "lamp on desk", "table lamp"],
    }),
    item("bedside-table-lamp", "Bedside Table Lamp", "Lighting", 21_000, "piece", "A ceramic lamp with a linen shade for a warm glow.", {
      variants: variantsOf({ colour: ["Sand", "Sage"] }),
      tags: ["table lamp", "lamp", "lighting", "bedroom", "home"],
      q: "table lamp bedroom",
    }),
    item("rattan-pendant-light", "Rattan Pendant Light", "Lighting", 32_000, "piece", "A hand-woven rattan pendant shade (bulb not included).", {
      tags: ["pendant light", "lighting", "rattan", "home", "decor"],
      q: ["rattan lamp", "pendant lamp", "hanging lamp"],
    }),
    // Décor
    item("reed-diffuser", "Reed Diffuser", "Décor", 11_000, "piece", "A 100 ml reed diffuser that scents a room for about eight weeks.", {
      variants: variantsOf({ scent: ["Cedar & Vetiver", "Fig & Lime", "Lavender"] }),
      tags: ["diffuser", "fragrance", "decor", "home", "gift", "weekend"],
      q: ["reed diffuser", "diffuser sticks", "aroma diffuser"],
    }),
    item("soy-scented-candle", "Soy Scented Candle", "Décor", 7_500, "piece", "A hand-poured soy candle in a glass jar, about 40 hours of burn time.", {
      variants: variantsOf({ scent: ["Vanilla", "Sandalwood", "Citrus"] }),
      tags: ["candle", "scented candle", "decor", "home", "gift", "weekend"],
      q: ["scented candle", "candle jar", "candle"],
    }),
    item("abstract-wall-art-print", "Abstract Wall Art Print", "Décor", 24_000, "piece", "A framed abstract print in earthy tones.", {
      variants: variantsOf({ size: [["30 × 40 cm", 24_000], ["50 × 70 cm", 38_000]] }),
      tags: ["wall art", "print", "decor", "home"],
      q: ["wall art", "framed art", "picture frame wall"],
    }),
    item("ceramic-bud-vase", "Ceramic Bud Vase", "Décor", 13_000, "piece", "A small matte ceramic vase for single stems or dried flowers.", {
      variants: variantsOf({ colour: ["White", "Terracotta"] }),
      tags: ["vase", "decor", "home", "gift"],
      q: ["ceramic vase", "vase flowers", "small vase"],
    }),
    // Storage & bath
    item("woven-laundry-basket", "Woven Laundry Basket", "Storage", 15_000, "piece", "A lidded seagrass basket with a removable cotton liner.", {
      tags: ["laundry basket", "storage", "home", "essential"],
      q: ["woven basket", "wicker basket", "laundry basket"],
    }),
    item("drawer-organiser-set", "Drawer Organiser Set", "Storage", 9_000, "set", "Eight stackable organisers for drawers, desks and vanities.", {
      tags: ["organiser", "storage", "home", "home office"],
      q: ["drawer organizer", "organized drawer", "storage boxes"],
    }),
    item("cotton-bath-towel-set", "Cotton Bath Towel Set", "Bath", 19_000, "set", "Two bath towels and two hand towels in thick cotton.", {
      variants: variantsOf({ colour: ["White", "Navy", "Blush"] }),
      tags: ["towels", "bath", "bathroom", "home", "essential"],
      q: ["towels", "bath towels", "folded towels"],
    }),
    // Home office
    item("ergonomic-office-chair", "Ergonomic Office Chair", "Home Office", 145_000, "piece", "A mesh office chair with lumbar support, adjustable arms and headrest.", {
      inventoryStatus: "low_stock",
      stockQuantity: 3,
      variants: variantsOf({ colour: ["Black", "Grey"] }),
      tags: ["office chair", "chair", "home office", "home", "work"],
      q: ["office chair", "desk chair", "home office chair"],
    }),
    item("bamboo-monitor-riser", "Bamboo Monitor Riser", "Home Office", 16_000, "piece", "Raises your monitor and keeps the keyboard space below tidy.", {
      tags: ["monitor riser", "desk", "home office", "home"],
      q: ["monitor desk", "computer desk setup", "home office desk"],
    }),
    item("desk-organiser", "Desk Organiser", "Home Office", 8_000, "piece", "A walnut-look organiser for pens, notes and a phone.", {
      tags: ["desk organiser", "desk", "home office", "home", "essential"],
      q: ["desk organizer", "pen holder desk", "stationery desk"],
    }),
  ]),
  services: [],
  knowledge: [
    { category: "shipping", title: "Large items", body: "Chairs, pot sets and wall art are delivered within 3 days by our own team." },
    { category: "returns", title: "Returns", body: "Unused items in original packaging can be returned within 14 days." },
  ],
};

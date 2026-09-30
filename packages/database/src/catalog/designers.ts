import { MEN_SIZES, MON_SAT, SHOE_SIZES, UNISEX_SIZES, WOMEN_SIZES, item, lagosAreas, variantsOf, weekdayHours, withSkus, type DemoTemplateBase } from "./kit";

/** Walrus Clothes & Designers — a fictional fashion house. Labels are invented. */
export const DESIGNERS: DemoTemplateBase = {
  label: "Fashion",
  businessType: "fashion",
  name: "Walrus Clothes & Designers",
  slug: "walrus-designers",
  tagline: "Ready-to-wear, designer pieces, shoes and bags",
  description: "A fictional fashion house in Walrus Market: everyday wear, African fashion, designer pieces and accessories.",
  accentColor: "#6E1F7A",
  welcomeMessage: "Tell me the occasion, your size and the colours you like — I'll pull together options.",
  city: "Lagos",
  country: "NG",
  fulfillment: { delivery: true, pickup: true, pickupAddress: "Showroom — 4 Runway Close, Lekki Phase 1 (fictional)" },
  deliveryAreas: lagosAreas({ core: 3000, mainland: 2500, far: 3500 }),
  openingHours: weekdayHours("10:00", "19:00", MON_SAT),
  paymentInstructions: "We confirm size availability, then send payment details. Free exchanges on unworn items within 7 days.",
  products: withSkus("WF", [
    // Women
    item("wrap-midi-dress", "Wrap Midi Dress", "Women", 32_000, "piece", "A flattering wrap dress in soft crepe that goes from office to dinner.", {
      attributes: { gender: "women", style: "formal, casual", material: "crepe" },
      variants: variantsOf({ colour: ["Black", "Emerald"], size: WOMEN_SIZES }, { low: ["Black / M"] }),
      tags: ["dress", "midi dress", "women", "fashion", "pick"],
      q: ["black dress woman", "woman in black dress", "midi dress"],
    }),
    item("satin-slip-dress", "Satin Slip Dress", "Women", 38_000, "piece", "A bias-cut satin dress with adjustable straps for evenings out.", {
      attributes: { gender: "women", style: "evening", material: "satin" },
      variants: variantsOf({ colour: ["Champagne", "Black"], size: WOMEN_SIZES }),
      tags: ["dress", "satin", "women", "fashion", "party"],
      q: ["silk dress woman", "slip dress", "woman evening dress"],
    }),
    item("ribbed-knit-two-piece-set", "Ribbed Knit Two-Piece Set", "Women", 35_000, "set", "A soft ribbed top and wide-leg trousers, easy to wear together or apart.", {
      attributes: { gender: "women", style: "casual", material: "ribbed knit" },
      variants: variantsOf({ colour: ["Oat", "Black"], size: WOMEN_SIZES }),
      tags: ["two-piece set", "co-ord", "women", "fashion", "weekend"],
      q: ["knitwear woman", "woman sweater", "knit outfit"],
    }),
    item("pleated-midi-skirt", "Pleated Midi Skirt", "Women", 21_000, "piece", "A swishy pleated skirt with an elastic waist.", {
      attributes: { gender: "women", style: "casual, office", material: "chiffon" },
      variants: variantsOf({ colour: ["Navy", "Blush"], size: WOMEN_SIZES }),
      tags: ["skirt", "women", "fashion"],
      q: "pleated skirt",
    }),
    item("silk-blouse", "Silk-Touch Blouse", "Women", 24_000, "piece", "A relaxed blouse with a silky feel and covered buttons.", {
      attributes: { gender: "women", style: "office", material: "silk-touch polyester" },
      variants: variantsOf({ colour: ["Ivory", "Black"], size: WOMEN_SIZES }),
      tags: ["blouse", "top", "women", "fashion", "office"],
      q: ["woman blouse", "blouse fashion", "woman white shirt"],
    }),
    item("wide-leg-trousers", "High-Waist Wide-Leg Trousers", "Women", 26_000, "piece", "Tailored wide-leg trousers with pockets and a clean front.", {
      attributes: { gender: "women", style: "office, formal", material: "twill" },
      variants: variantsOf({ colour: ["Black", "Camel"], size: WOMEN_SIZES }),
      tags: ["trousers", "pants", "women", "fashion", "office"],
      q: ["wide leg pants", "woman pants fashion", "woman trousers"],
    }),
    // Men
    item("oxford-shirt", "Classic Oxford Shirt", "Men", 18_500, "piece", "A crisp cotton Oxford shirt with a button-down collar.", {
      attributes: { gender: "men", style: "office, casual", material: "cotton" },
      variants: variantsOf({ colour: ["White", "Light Blue"], size: MEN_SIZES }),
      tags: ["shirt", "men", "fashion", "office"],
      q: "men dress shirt",
    }),
    item("slim-chinos", "Slim Stretch Chinos", "Men", 22_000, "piece", "Slim-fit chinos with a little stretch for all-day comfort.", {
      attributes: { gender: "men", style: "casual, office", material: "cotton stretch" },
      variants: variantsOf({ colour: ["Khaki", "Navy", "Olive"], size: MEN_SIZES }),
      tags: ["chinos", "trousers", "men", "fashion"],
      q: ["chinos", "men trousers", "man casual outfit"],
    }),
    item("straight-leg-jeans", "Straight-Leg Dark Jeans", "Men", 25_000, "piece", "Dark indigo denim in a straight leg that works with everything.", {
      attributes: { gender: "men", style: "casual", material: "denim" },
      variants: variantsOf({ colour: ["Dark Indigo"], size: MEN_SIZES }),
      tags: ["jeans", "denim", "men", "fashion"],
      q: "jeans denim",
    }),
    item("linen-short-sleeve-shirt", "Linen Short-Sleeve Shirt", "Men", 16_500, "piece", "A breathable linen shirt for hot days and holidays.", {
      attributes: { gender: "men", style: "casual", material: "linen" },
      variants: variantsOf({ colour: ["Sand", "White", "Sage"], size: MEN_SIZES }),
      tags: ["shirt", "linen", "men", "fashion", "weekend"],
      q: ["man linen shirt", "men short sleeve shirt", "man summer shirt"],
    }),
    item("tailored-blazer", "Tailored Navy Blazer", "Men", 65_000, "piece", "A half-lined blazer with a sharp shoulder, for weddings and interviews.", {
      attributes: { gender: "men", style: "formal", material: "wool blend" },
      variants: variantsOf({ colour: ["Navy"], size: MEN_SIZES }, { low: ["Navy / XXL"] }),
      tags: ["blazer", "jacket", "suit", "men", "fashion", "formal"],
      q: "men blazer suit",
    }),
    item("pique-polo-shirt", "Piqué Polo Shirt", "Men", 14_000, "piece", "A classic cotton piqué polo that keeps its shape.", {
      attributes: { gender: "men", style: "casual", material: "cotton piqué" },
      variants: variantsOf({ colour: ["Black", "White", "Wine"], size: MEN_SIZES }),
      tags: ["polo", "shirt", "men", "fashion"],
      q: ["polo shirt man", "man polo", "men casual shirt"],
    }),
    // Unisex / streetwear
    item("classic-black-hoodie", "Classic Heavyweight Hoodie", "Unisex", 24_000, "piece", "A heavyweight cotton hoodie with a kangaroo pocket and a relaxed fit.", {
      attributes: { gender: "unisex", style: "streetwear, casual", material: "cotton fleece" },
      variants: variantsOf({ colour: ["Black", "Heather Grey"], size: UNISEX_SIZES }, { low: ["Black / L"] }),
      tags: ["hoodie", "sweatshirt", "streetwear", "unisex", "fashion", "pick"],
      q: ["hoodie", "man in hoodie", "black sweatshirt"],
    }),
    item("heavyweight-cotton-t-shirt", "Heavyweight Cotton T-Shirt", "Unisex", 9_500, "piece", "A thick, boxy tee that holds its shape wash after wash.", {
      attributes: { gender: "unisex", style: "casual, streetwear", material: "cotton" },
      variants: variantsOf({ colour: ["Black", "White", "Olive"], size: UNISEX_SIZES }),
      tags: ["t-shirt", "tee", "unisex", "fashion", "essential"],
      q: "plain t-shirt",
    }),
    item("cargo-joggers", "Cargo Joggers", "Unisex", 19_000, "piece", "Relaxed joggers with cargo pockets and cuffed ankles.", {
      attributes: { gender: "unisex", style: "streetwear", material: "cotton twill" },
      variants: variantsOf({ colour: ["Black", "Stone"], size: UNISEX_SIZES }),
      tags: ["joggers", "cargo", "streetwear", "unisex", "fashion"],
      q: ["cargo pants", "joggers", "streetwear man"],
    }),
    item("denim-jacket", "Washed Denim Jacket", "Unisex", 34_000, "piece", "A washed denim jacket with a slightly oversized fit.", {
      attributes: { gender: "unisex", style: "casual", material: "denim" },
      variants: variantsOf({ colour: ["Mid Blue"], size: UNISEX_SIZES }),
      tags: ["jacket", "denim jacket", "unisex", "fashion"],
      q: "denim jacket",
    }),
    item("lagos-waves-graphic-tee", "Lagos Waves Graphic Tee", "Unisex", 12_000, "piece", "A soft tee printed with our Lagos-waves design.", {
      attributes: { gender: "unisex", style: "streetwear", material: "cotton" },
      variants: variantsOf({ colour: ["White", "Black"], size: UNISEX_SIZES }),
      tags: ["t-shirt", "graphic tee", "streetwear", "unisex", "fashion"],
      q: ["printed t-shirt", "t-shirt man", "t shirt"],
    }),
    // African fashion
    item("ankara-flare-dress", "Ankara Flare Dress", "African Fashion", 36_000, "piece", "A fitted bodice and full skirt in a bold ankara print, fully lined.", {
      attributes: { gender: "women", style: "traditional, party", material: "wax-print cotton" },
      variants: variantsOf({ print: ["Sunset Blocks", "Blue Circles"], size: WOMEN_SIZES }),
      tags: ["ankara", "dress", "african fashion", "women", "fashion", "party", "pick"],
      q: ["african print dress woman", "ankara dress", "colorful print dress"],
    }),
    item("ankara-two-piece-set", "Ankara Two-Piece Set", "African Fashion", 42_000, "set", "A cropped top and wrap skirt in matching ankara, for owambe and celebrations.", {
      attributes: { gender: "women", style: "traditional, party", material: "wax-print cotton" },
      variants: variantsOf({ print: ["Gold Leaf", "Teal Waves"], size: WOMEN_SIZES }),
      tags: ["ankara", "two-piece set", "african fashion", "women", "fashion", "party"],
      q: ["african print", "ankara fabric", "wax print fabric"],
    }),
    item("adire-mens-shirt", "Adire Men's Shirt", "African Fashion", 22_000, "piece", "A hand-dyed adire shirt with a mandarin collar. Each piece varies slightly.", {
      attributes: { gender: "men", style: "traditional, casual", material: "hand-dyed cotton" },
      variants: variantsOf({ colour: ["Indigo"], size: MEN_SIZES }),
      tags: ["adire", "shirt", "african fashion", "men", "fashion"],
      q: ["tie dye shirt", "indigo shirt", "blue patterned shirt"],
    }),
    item("classic-mens-kaftan", "Classic Men's Kaftan", "African Fashion", 38_000, "piece", "A long, clean-lined kaftan with embroidered neck detail.", {
      attributes: { gender: "men", style: "traditional", material: "cotton blend" },
      variants: variantsOf({ colour: ["White", "Navy", "Olive"], size: MEN_SIZES }),
      tags: ["kaftan", "african fashion", "men", "fashion", "traditional"],
      q: ["kaftan", "african man fashion", "man traditional clothes"],
    }),
    item("senator-two-piece", "Senator Two-Piece", "African Fashion", 55_000, "set", "A tailored senator top and trousers, cut for weddings and Sunday service.", {
      attributes: { gender: "men", style: "traditional, formal", material: "cashmere-feel blend" },
      variants: variantsOf({ colour: ["Black", "Wine", "Grey"], size: MEN_SIZES }),
      tags: ["senator", "two-piece set", "african fashion", "men", "fashion", "formal"],
      q: ["african men clothing", "nigerian men fashion", "man in traditional attire"],
    }),
    item("agbada-inspired-three-piece", "Agbada-Inspired Three-Piece", "African Fashion", 120_000, "set", "A flowing agbada-style robe with matching top and trousers, hand-finished embroidery.", {
      attributes: { gender: "men", style: "traditional, ceremonial", material: "brocade" },
      inventoryStatus: "made_to_order",
      stockQuantity: null,
      variants: variantsOf({ colour: ["Ivory & Gold", "Royal Blue"], size: MEN_SIZES }),
      tags: ["agbada", "african fashion", "men", "fashion", "wedding", "traditional"],
      q: ["agbada", "african traditional wear man", "nigerian traditional attire"],
    }),
    // Designer pieces
    item("beaded-evening-gown", "Hand-Beaded Evening Gown", "Designer Pieces", 185_000, "piece", "A floor-length gown with hand-beaded bodice, made in our studio in small numbers.", {
      attributes: { gender: "women", style: "evening, designer", material: "tulle and crepe" },
      inventoryStatus: "low_stock",
      stockQuantity: 2,
      variants: variantsOf({ colour: ["Midnight"], size: WOMEN_SIZES }, { out: ["Midnight / XS"] }),
      tags: ["gown", "evening dress", "designer", "women", "fashion"],
      q: ["evening gown woman", "woman long dress", "ball gown"],
    }),
    item("draped-asymmetric-dress", "Draped Asymmetric Dress", "Designer Pieces", 98_000, "piece", "A one-shoulder dress with sculpted draping — a statement for special occasions.", {
      attributes: { gender: "women", style: "designer, party", material: "jersey crepe" },
      variants: variantsOf({ colour: ["Emerald", "Black"], size: WOMEN_SIZES }),
      tags: ["dress", "designer", "women", "fashion", "party"],
      q: "fashion model dress",
    }),
    item("structured-tuxedo-jacket", "Structured Tuxedo Jacket", "Designer Pieces", 140_000, "piece", "A satin-lapel tuxedo jacket with a precise, modern cut.", {
      attributes: { gender: "men", style: "designer, formal", material: "wool and satin" },
      variants: variantsOf({ colour: ["Black"], size: MEN_SIZES }),
      tags: ["tuxedo", "jacket", "designer", "men", "fashion", "formal"],
      q: "men tuxedo",
    }),
    // Shoes
    item("white-leather-sneakers", "White Leather Sneakers", "Shoes", 35_000, "pair", "Minimal white leather sneakers with a cushioned sole.", {
      attributes: { gender: "unisex", material: "leather", sizing: "EU sizes" },
      variants: variantsOf({ colour: ["White"], size: SHOE_SIZES }, { low: ["White / 42"] }),
      tags: ["sneakers", "trainers", "shoes", "men", "women", "fashion", "pick"],
      q: ["white sneakers", "sneakers", "white shoes"],
    }),
    item("canvas-high-top-sneakers", "Canvas High-Top Sneakers", "Shoes", 22_000, "pair", "Classic canvas high-tops with a grippy rubber sole.", {
      attributes: { gender: "unisex", material: "canvas", sizing: "EU sizes" },
      variants: variantsOf({ colour: ["Black", "Off-White"], size: SHOE_SIZES }),
      tags: ["sneakers", "high-tops", "shoes", "streetwear", "fashion"],
      q: "canvas sneakers",
    }),
    item("suede-penny-loafers", "Suede Penny Loafers", "Shoes", 42_000, "pair", "Soft suede loafers with a leather sole, smart enough for the office.", {
      attributes: { gender: "men", material: "suede", sizing: "EU sizes" },
      variants: variantsOf({ colour: ["Tan", "Navy"], size: ["40", "41", "42", "43", "44", "45"] }),
      tags: ["loafers", "shoes", "men", "fashion", "office"],
      q: ["loafers", "men shoes leather", "brown shoes"],
    }),
    item("block-heel-sandals", "Block-Heel Sandals", "Shoes", 27_000, "pair", "Strappy sandals on a comfortable 6 cm block heel.", {
      attributes: { gender: "women", material: "faux leather", heel: "6 cm", sizing: "EU sizes" },
      variants: variantsOf({ colour: ["Nude", "Black"], size: ["37", "38", "39", "40", "41", "42"] }),
      tags: ["sandals", "heels", "shoes", "women", "fashion"],
      q: ["women sandals", "heels shoes", "high heels"],
    }),
    item("leather-slides", "Leather Slides", "Shoes", 15_000, "pair", "Easy leather slides with a moulded footbed.", {
      attributes: { gender: "unisex", material: "leather", sizing: "EU sizes" },
      variants: variantsOf({ colour: ["Black", "Brown"], size: SHOE_SIZES }),
      tags: ["slides", "sandals", "shoes", "fashion", "weekend"],
      q: "leather sandals",
    }),
    // Bags
    item("structured-leather-handbag", "Structured Leather Handbag", "Bags", 48_000, "piece", "A top-handle bag in smooth leather with a detachable strap.", {
      attributes: { material: "leather", size: "fits a small tablet" },
      variants: variantsOf({ colour: ["Black", "Tan", "Pearl"] }),
      tags: ["handbag", "bag", "women", "fashion", "pick"],
      q: ["handbag", "leather bag woman", "purse"],
    }),
    item("everyday-canvas-tote", "Everyday Canvas Tote", "Bags", 12_000, "piece", "A roomy canvas tote with an inside zip pocket.", {
      attributes: { material: "canvas" },
      variants: variantsOf({ colour: ["Natural", "Black"] }),
      tags: ["tote", "bag", "fashion", "essential"],
      q: ["tote bag", "canvas bag", "shopping bag woman"],
    }),
    item("minimal-city-backpack", "Minimal City Backpack", "Bags", 28_000, "piece", "A clean, water-resistant backpack with a laptop sleeve.", {
      attributes: { material: "water-resistant nylon", fits: "up to 15-inch laptop" },
      variants: variantsOf({ colour: ["Black", "Olive"] }),
      tags: ["backpack", "bag", "fashion"],
      q: ["backpack", "black backpack", "man with backpack"],
    }),
    item("crossbody-mini-bag", "Crossbody Mini Bag", "Bags", 19_000, "piece", "A small crossbody for phone, cards and keys.", {
      attributes: { material: "faux leather" },
      variants: variantsOf({ colour: ["Black", "Lilac"] }),
      tags: ["crossbody bag", "bag", "women", "fashion", "weekend"],
      q: ["crossbody bag", "small bag woman", "shoulder bag"],
    }),
    // Accessories & jewellery
    item("classic-leather-belt", "Classic Leather Belt", "Accessories", 9_000, "piece", "A full-grain leather belt with a brushed buckle.", {
      attributes: { material: "leather" },
      variants: variantsOf({ colour: ["Black", "Brown"], size: ["S", "M", "L", "XL"] }),
      tags: ["belt", "accessories", "men", "fashion"],
      q: ["leather belt", "belt buckle", "men accessories"],
    }),
    item("cotton-baseball-cap", "Cotton Baseball Cap", "Accessories", 7_500, "piece", "An adjustable cotton cap with a curved brim.", {
      attributes: { material: "cotton twill", fit: "adjustable" },
      variants: variantsOf({ colour: ["Black", "Beige", "Navy"] }),
      tags: ["cap", "hat", "accessories", "streetwear", "fashion"],
      q: "baseball cap",
    }),
    item("silk-print-scarf", "Silk-Print Square Scarf", "Accessories", 11_000, "piece", "A square scarf to wear on the neck, hair or bag handle.", {
      attributes: { material: "satin" },
      variants: variantsOf({ print: ["Coral Geo", "Navy Paisley"] }),
      tags: ["scarf", "accessories", "women", "fashion"],
      q: "silk scarf",
    }),
    item("classic-sunglasses", "Classic Sunglasses", "Accessories", 13_000, "piece", "UV400 sunglasses in a timeless frame, with a case.", {
      attributes: { protection: "UV400" },
      variants: variantsOf({ frame: ["Black", "Tortoiseshell"] }),
      tags: ["sunglasses", "accessories", "fashion", "weekend"],
      q: "sunglasses",
    }),
    item("gold-tone-pendant-necklace", "Gold-Tone Pendant Necklace", "Jewelry", 16_000, "piece", "A fine chain with a small disc pendant, plated for everyday wear.", {
      attributes: { finish: "gold-tone plated", length: "45 cm" },
      tags: ["necklace", "jewelry", "jewellery", "women", "fashion", "gift"],
      q: "gold necklace",
    }),
    item("beaded-bracelet-set", "Beaded Bracelet Set", "Jewelry", 8_500, "set", "Three stretch bracelets in glass and wooden beads.", {
      attributes: { pieces: "3" },
      variants: variantsOf({ colour: ["Earth Tones", "Ocean"] }),
      tags: ["bracelet", "jewelry", "jewellery", "fashion", "gift"],
      q: "beaded bracelets",
    }),
    item("everyday-hoop-earrings", "Everyday Hoop Earrings", "Jewelry", 9_500, "pair", "Light, medium hoops that are comfortable all day.", {
      attributes: { finish: "gold-tone or silver-tone" },
      variants: variantsOf({ finish: ["Gold-tone", "Silver-tone"] }),
      tags: ["earrings", "hoops", "jewelry", "jewellery", "women", "fashion"],
      q: ["gold earrings", "earrings woman", "jewelry earrings"],
    }),
  ]),
  services: [],
  knowledge: [
    { category: "returns", title: "Exchanges", body: "Unworn items with tags can be exchanged within 7 days. Made-to-order pieces can't be returned." },
    { category: "product_guidance", title: "Sizing", body: "Clothes use XS–XXL; shoes use EU sizes. If you're between sizes, most customers size up in fitted pieces." },
  ],
};

import { item, variantsOf, withSkus, type ProductSeed } from "./kit";

const CAKE_SIZES = (six: number, eight: number, ten: number) => ({ size: [["6-inch (8 servings)", six], ["8-inch (14 servings)", eight], ["10-inch (22 servings)", ten]] }) as const;
const MESSAGE_NOTE = "Tell Nia the message you'd like on top and she adds it to your order.";

/** More for Crumb & Co. (the existing bakery). Added after its original three items. */
export const BAKERY_MORE: ProductSeed[] = withSkus("CB", [
  item("chocolate-fudge-cake", "Chocolate Fudge Cake", "Cakes", 22_000, "cake", `Moist chocolate sponge with fudge frosting. ${MESSAGE_NOTE}`, {
    variants: variantsOf(CAKE_SIZES(22_000, 34_000, 52_000)),
    tags: ["chocolate cake", "cake", "birthday", "celebration", "bakery", "pick"],
    q: "chocolate cake",
  }),
  item("vanilla-celebration-cake", "Vanilla Celebration Cake", "Cakes", 20_000, "cake", `Vanilla bean sponge with buttercream and sprinkles. ${MESSAGE_NOTE}`, {
    variants: variantsOf({ ...CAKE_SIZES(20_000, 31_000, 48_000), icing: ["White", "Pink", "Blue"] }),
    tags: ["vanilla cake", "birthday cake", "cake", "birthday", "celebration", "bakery"],
    q: "birthday cake",
  }),
  item("red-velvet-cake", "Red Velvet Cake", "Cakes", 24_000, "cake", `Red velvet layers with cream cheese frosting. ${MESSAGE_NOTE}`, {
    variants: variantsOf(CAKE_SIZES(24_000, 36_000, 55_000)),
    tags: ["red velvet", "cake", "birthday", "celebration", "bakery"],
    q: "red velvet cake",
  }),
  item("carrot-walnut-cake", "Carrot & Walnut Cake", "Cakes", 21_000, "cake", "Spiced carrot cake with walnuts and cream cheese icing.", {
    variants: variantsOf({ size: [["6-inch (8 servings)", 21_000], ["8-inch (14 servings)", 32_000]] }),
    tags: ["carrot cake", "cake", "bakery"],
    q: "carrot cake",
  }),
  item("baked-vanilla-cheesecake", "Baked Vanilla Cheesecake", "Cakes", 26_000, "cake", "A creamy baked cheesecake on a buttery biscuit base.", {
    variants: variantsOf({ topping: ["Plain", "Strawberry", "Salted caramel"] }),
    tags: ["cheesecake", "cake", "dessert", "bakery"],
    q: "cheesecake slice",
  }),
  item("rich-fruit-cake", "Rich Fruit Cake", "Cakes", 18_000, "cake", "A dense fruit cake with soaked raisins and spice — a wedding and Christmas classic.", {
    tags: ["fruit cake", "cake", "wedding", "bakery"],
    q: ["fruitcake", "fruit cake slice", "christmas cake"],
  }),
  item("cupcake-box", "Cupcake Box", "Cupcakes", 9_000, "box of 6", "Six cupcakes with swirled buttercream.", {
    variants: variantsOf({ flavour: ["Vanilla", "Chocolate", "Red velvet", "Assorted"], box: [["Box of 6", 9_000], ["Box of 12", 16_500]] }),
    tags: ["cupcakes", "birthday", "party", "bakery", "weekend"],
    q: "cupcakes",
  }),
  item("fudge-brownies", "Fudge Brownies", "Cookies & Brownies", 7_500, "box of 6", "Dense, fudgy chocolate brownies with a crackly top.", {
    tags: ["brownies", "chocolate", "dessert", "bakery", "weekend", "pick"],
    q: "chocolate brownies",
  }),
  item("chocolate-chip-cookies", "Chocolate Chip Cookies", "Cookies & Brownies", 5_000, "box of 8", "Chewy cookies with milk and dark chocolate chunks.", {
    tags: ["cookies", "chocolate", "snack", "bakery"],
    q: "chocolate chip cookies",
  }),
  item("butter-croissants", "Butter Croissants", "Pastry", 6_000, "box of 4", "Flaky, all-butter croissants, baked each morning.", {
    tags: ["croissant", "pastry", "breakfast", "bakery", "weekend"],
    q: "croissants",
  }),
  item("glazed-doughnuts", "Glazed Doughnuts", "Doughnuts", 5_500, "box of 6", "Soft, ring doughnuts with a sweet glaze.", {
    variants: variantsOf({ glaze: ["Classic", "Chocolate", "Strawberry"] }),
    tags: ["doughnuts", "donuts", "sweet", "bakery"],
    q: "glazed donuts",
  }),
  item("banana-bread-loaf", "Banana Bread Loaf", "Bread", 5_500, "loaf", "Moist banana bread made with very ripe bananas.", {
    tags: ["banana bread", "bread", "bakery", "breakfast"],
    q: "banana bread",
  }),
  item("wholewheat-sandwich-loaf", "Wholewheat Sandwich Loaf", "Bread", 3_500, "loaf", "Soft wholewheat bread, sliced for sandwiches.", {
    tags: ["bread", "wholewheat", "sandwich", "bakery", "essential"],
    q: "sliced bread loaf",
  }),
  item("meat-pies", "Beef Meat Pies", "Pies", 6_000, "pack of 4", "Golden, flaky pastry filled with minced beef, potato and carrot.", {
    tags: ["meat pie", "pies", "snack", "bakery", "pick"],
    q: "meat pie pastry",
  }),
  item("chicken-pies", "Chicken Pies", "Pies", 6_500, "pack of 4", "Buttery pastry filled with creamy chicken and vegetables.", {
    tags: ["chicken pie", "pies", "snack", "bakery"],
    q: ["meat pie", "pastry pie", "savory pastries"],
  }),
  item("sausage-rolls", "Sausage Rolls", "Pies", 5_500, "pack of 6", "Flaky puff pastry wrapped around seasoned sausage.", {
    tags: ["sausage rolls", "pastry", "snack", "bakery", "party"],
    q: "sausage rolls",
  }),
]);

/** More for Glow Theory Studio (the existing salon). Shades and scents are house ranges. */
export const BEAUTY_MORE: ProductSeed[] = withSkus("GT", [
  item("velvet-matte-lipstick", "Velvet Matte Lipstick", "Makeup", 7_500, "stick", "A comfortable matte lipstick with rich colour that lasts.", {
    variants: variantsOf({ shade: ["Brick Red", "Mocha", "Berry", "Nude Rose"] }),
    tags: ["lipstick", "makeup", "lips", "beauty", "pick"],
    q: "lipstick",
  }),
  item("glass-shine-lip-gloss", "Glass-Shine Lip Gloss", "Makeup", 5_500, "tube", "A non-sticky, high-shine gloss.", {
    variants: variantsOf({ shade: ["Clear", "Honey", "Pink Glow"] }),
    tags: ["lip gloss", "makeup", "lips", "beauty"],
    q: "lip gloss",
  }),
  item("skin-tint-foundation", "Skin-Tint Foundation", "Makeup", 14_000, "bottle", "Medium-coverage liquid foundation with a natural finish. 30 ml.", {
    variants: variantsOf({ shade: ["Almond", "Caramel", "Chestnut", "Espresso", "Ebony"] }),
    tags: ["foundation", "makeup", "face", "beauty"],
    q: ["liquid foundation", "foundation makeup bottle", "makeup foundation"],
  }),
  item("setting-pressed-powder", "Setting Pressed Powder", "Makeup", 9_000, "compact", "A finely milled powder that sets make-up and softens shine.", {
    variants: variantsOf({ shade: ["Light", "Medium", "Deep"] }),
    tags: ["powder", "makeup", "face", "beauty"],
    q: "makeup powder compact",
  }),
  item("volumising-mascara", "Volumising Mascara", "Makeup", 6_500, "tube", "Builds full, separated lashes without clumping.", {
    tags: ["mascara", "makeup", "eyes", "beauty"],
    q: ["mascara wand", "mascara makeup", "eye makeup products"],
  }),
  item("gentle-foam-cleanser", "Gentle Foam Cleanser", "Skincare", 8_000, "bottle", "A low-foam face cleanser that won't strip the skin. 150 ml.", {
    tags: ["cleanser", "face wash", "skincare", "beauty", "essential"],
    q: ["facial cleanser", "skincare bottle", "cosmetic pump bottle"],
  }),
  item("daily-moisturiser-spf30", "Daily Moisturiser SPF 30", "Skincare", 11_500, "tube", "A lightweight moisturiser with SPF 30 and no white cast. 50 ml.", {
    tags: ["moisturiser", "moisturizer", "sunscreen", "spf", "skincare", "beauty", "pick"],
    q: ["face cream jar", "moisturizer", "skincare cream"],
  }),
  item("vitamin-c-glow-serum", "Vitamin C Glow Serum", "Skincare", 13_500, "bottle", "A brightening serum for dull skin and dark spots. 30 ml.", {
    tags: ["serum", "vitamin c", "skincare", "beauty"],
    q: "serum dropper bottle",
  }),
  item("skincare-starter-set", "Skincare Starter Set", "Skincare", 26_000, "set", "Cleanser, serum and SPF moisturiser in travel sizes — a simple routine to start.", {
    tags: ["skincare set", "gift set", "skincare", "beauty", "gift"],
    q: ["skincare products", "cosmetic bottles", "beauty products flat lay"],
  }),
  item("amber-oud-eau-de-parfum", "Amber Oud Eau de Parfum", "Fragrance", 24_000, "bottle", "A warm, woody fragrance with amber and oud. 50 ml.", {
    variants: variantsOf({ size: [["50 ml", 24_000], ["100 ml", 38_000]] }),
    tags: ["perfume", "fragrance", "beauty", "gift"],
    q: "perfume bottle",
  }),
  item("fresh-citrus-body-mist", "Fresh Citrus Body Mist", "Fragrance", 7_000, "bottle", "A light, fresh body mist to spritz through the day. 150 ml.", {
    tags: ["body mist", "body spray", "fragrance", "beauty"],
    q: ["perfume bottle", "fragrance bottle", "spray bottle cosmetic"],
  }),
  item("cocoa-butter-body-lotion", "Cocoa Butter Body Lotion", "Body", 6_500, "bottle", "Rich cocoa butter lotion for dry skin. 400 ml.", {
    tags: ["body lotion", "lotion", "body", "beauty", "essential"],
    q: ["lotion bottle", "body lotion", "cosmetic cream bottle"],
  }),
  item("curl-defining-cream", "Curl-Defining Cream", "Hair", 8_500, "jar", "Defines curls and coils with soft hold and no crunch. 250 ml.", {
    tags: ["curl cream", "hair", "natural hair", "beauty"],
    q: ["hair product jar", "cream jar cosmetic", "natural hair care"],
  }),
  item("gel-nail-polish-set", "Gel-Effect Nail Polish Set", "Nails", 9_500, "set", "Four long-wear polishes with a glossy top coat — no lamp needed.", {
    variants: variantsOf({ set: ["Nudes", "Brights"] }),
    tags: ["nail polish", "nails", "beauty", "weekend"],
    q: ["nail polish", "manicure nail polish", "nail varnish bottles"],
  }),
  item("nourishing-cuticle-oil", "Nourishing Cuticle Oil", "Nails", 4_000, "bottle", "A vitamin E cuticle oil pen for healthy nails.", {
    tags: ["cuticle oil", "nails", "beauty"],
    q: "oil dropper bottle",
  }),
  item("makeup-brush-set", "Makeup Brush Set", "Tools", 12_000, "set", "Eight soft synthetic brushes with a zip pouch.", {
    tags: ["makeup brushes", "brushes", "tools", "makeup", "beauty"],
    q: "makeup brushes",
  }),
  item("detangling-hair-brush", "Detangling Hair Brush", "Tools", 5_000, "piece", "Flexible bristles that glide through wet or dry hair.", {
    tags: ["hair brush", "detangler", "tools", "hair", "beauty"],
    q: "hair brush",
  }),
]);

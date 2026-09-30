import { EVERY_DAY, item, lagosAreas, variantsOf, weekdayHours, withSkus, type DemoTemplateBase, type ProductSeed } from "./kit";

/** Meals are cooked when ordered. */
const meal = (...args: Parameters<typeof item>): ProductSeed => ({ ...item(...args), inventoryStatus: "made_to_order", stockQuantity: null });

/** Regular / Large with their prices (naira). */
const portions = (regular: number, large: number) => variantsOf({ portion: [["Regular", regular], ["Large", large]] });

/** Walrus Kitchen — a fictional Lagos kitchen. Dishes are generic listings, not any restaurant's menu. */
export const KITCHEN: DemoTemplateBase = {
  label: "Restaurant",
  businessType: "restaurant",
  name: "Walrus Kitchen",
  slug: "walrus-kitchen",
  tagline: "Rice bowls, soups, grills and small chops, cooked to order",
  description: "A fictional Lagos kitchen in Walrus Market. Meals are cooked when you order and delivered hot.",
  accentColor: "#B45309",
  welcomeMessage: "Hungry? Tell me what you're craving, how many people, and your area — I'll suggest a meal.",
  city: "Lagos",
  country: "NG",
  fulfillment: { delivery: true, pickup: true, pickupAddress: "Kitchen window — 9 Pepper Lane, Surulere (fictional)" },
  deliveryAreas: lagosAreas({ core: 2500, mainland: 1500, far: 3000 }),
  openingHours: weekdayHours("08:00", "22:00", EVERY_DAY),
  paymentInstructions: "Pay by transfer once we confirm your order. Meals leave the kitchen within 40 minutes.",
  products: withSkus("WK", [
    // Rice meals
    meal("party-jollof-rice-with-chicken", "Party Jollof Rice with Chicken", "Rice Meals", 6_500, "plate", "Smoky party-style jollof with fried plantain and a quarter of grilled chicken.", {
      variants: variantsOf({ protein: [["Chicken", 6_500], ["Turkey", 8_000], ["Fish", 7_500]] }),
      tags: ["jollof", "rice", "chicken", "food", "meal", "pick"],
      q: ["jollof rice", "rice and chicken", "chicken rice plate"],
    }),
    meal("fried-rice-with-chicken", "Fried Rice with Chicken", "Rice Meals", 6_500, "plate", "Vegetable fried rice with liver, coleslaw and grilled chicken.", {
      variants: variantsOf({ protein: [["Chicken", 6_500], ["Turkey", 8_000]] }),
      tags: ["fried rice", "rice", "chicken", "food", "meal"],
      q: "fried rice plate",
    }),
    meal("white-rice-and-stew", "White Rice and Stew", "Rice Meals", 5_000, "plate", "Fluffy white rice with rich tomato-pepper stew and your choice of protein.", {
      variants: variantsOf({ protein: [["Beef", 5_000], ["Chicken", 5_500], ["Fish", 6_000]] }),
      tags: ["rice", "stew", "food", "meal"],
      q: "rice stew plate",
    }),
    meal("ofada-rice-and-ayamase", "Ofada Rice and Ayamase", "Rice Meals", 7_000, "plate", "Local ofada rice with spicy green-pepper ayamase sauce and boiled egg.", {
      tags: ["ofada", "rice", "spicy", "food", "meal"],
      q: ["rice with stew", "rice and sauce", "rice dish"],
    }),
    meal("chicken-rice-bowl", "Chicken Rice Bowl", "Rice Meals", 5_500, "bowl", "Grilled chicken, rice, sweetcorn and pepper sauce in one bowl.", {
      tags: ["rice bowl", "chicken", "rice", "food", "meal", "lunch"],
      q: ["chicken rice", "rice bowl", "chicken bowl"],
    }),
    meal("coconut-rice", "Coconut Rice with Fish", "Rice Meals", 6_500, "plate", "Rice cooked in coconut milk, served with peppered fish.", {
      tags: ["coconut rice", "rice", "fish", "food", "meal"],
      q: ["rice bowl", "cooked rice", "rice plate"],
    }),
    // African meals
    meal("pounded-yam-and-egusi", "Pounded Yam and Egusi", "African Meals", 8_000, "plate", "Smooth pounded yam with egusi soup, assorted meat and stockfish.", {
      tags: ["pounded yam", "egusi", "swallow", "food", "meal", "african"],
      q: ["african food", "fufu", "soup bowl"],
    }),
    meal("amala-and-ewedu", "Amala and Ewedu", "African Meals", 6_500, "plate", "Amala with ewedu, gbegiri and beef stew.", {
      tags: ["amala", "ewedu", "swallow", "food", "meal", "african"],
      q: ["african meal", "fufu soup", "traditional food"],
    }),
    meal("beans-and-plantain", "Beans and Plantain", "African Meals", 4_500, "plate", "Slow-cooked honey beans with fried plantain.", {
      tags: ["beans", "plantain", "food", "meal", "vegetarian"],
      q: ["beans stew", "plantain", "cooked beans"],
    }),
    meal("jollof-spaghetti", "Jollof Spaghetti", "Pasta", 4_500, "plate", "Spaghetti cooked in jollof sauce with sausage and vegetables.", {
      tags: ["spaghetti", "pasta", "jollof", "food", "meal"],
      q: ["spaghetti", "pasta tomato", "pasta dish"],
    }),
    // Soups (by the litre)
    item("egusi-soup-bowl", "Egusi Soup", "Soups", 12_000, "litre", "Egusi with assorted meat, ready to heat. Pairs with any swallow.", {
      inventoryStatus: "made_to_order",
      stockQuantity: null,
      variants: variantsOf({ size: [["1 litre", 12_000], ["2 litres", 22_000]] }),
      tags: ["egusi", "soup", "food", "african"],
      q: ["soup bowl", "stew bowl", "african soup"],
    }),
    item("efo-riro-vegetable-soup", "Efo Riro Vegetable Soup", "Soups", 11_000, "litre", "Spinach in a rich pepper base with beef and ponmo.", {
      inventoryStatus: "made_to_order",
      stockQuantity: null,
      variants: variantsOf({ size: [["1 litre", 11_000], ["2 litres", 20_000]] }),
      tags: ["vegetable soup", "efo riro", "soup", "food", "african"],
      q: ["spinach stew", "vegetable stew", "greens soup"],
    }),
    meal("goat-meat-pepper-soup", "Goat Meat Pepper Soup", "Soups", 6_000, "bowl", "A light, spicy pepper soup with tender goat meat.", {
      tags: ["pepper soup", "soup", "goat", "spicy", "food"],
      q: ["meat soup", "pepper soup", "spicy soup"],
    }),
    // Grills
    meal("beef-suya-skewers", "Beef Suya Skewers", "Grills", 4_500, "pack", "Spicy yaji-rubbed beef skewers with onions and tomatoes.", {
      variants: portions(4_500, 8_500),
      tags: ["suya", "grill", "beef", "spicy", "food", "weekend", "pick"],
      q: "grilled meat skewers",
    }),
    meal("grilled-chicken-quarter", "Grilled Chicken", "Grills", 5_500, "portion", "Marinated chicken grilled over charcoal, with pepper sauce.", {
      variants: variantsOf({ portion: [["Quarter", 5_500], ["Half", 9_500], ["Whole", 17_000]] }),
      tags: ["grilled chicken", "chicken", "grill", "food"],
      q: "grilled chicken",
    }),
    meal("grilled-croaker-fish", "Grilled Croaker Fish", "Seafood", 9_500, "fish", "Whole croaker grilled with pepper sauce and a side of chips or plantain.", {
      variants: variantsOf({ side: ["Chips", "Plantain"] }),
      tags: ["grilled fish", "fish", "seafood", "grill", "food", "weekend"],
      q: "grilled fish",
    }),
    meal("peppered-prawns", "Peppered Prawns", "Seafood", 11_000, "portion", "King prawns tossed in a garlic-pepper sauce.", {
      tags: ["prawns", "seafood", "spicy", "food"],
      q: "prawns dish",
    }),
    // Pasta
    meal("spaghetti-bolognese", "Spaghetti Bolognese", "Pasta", 5_500, "plate", "Spaghetti in a slow-cooked beef and tomato sauce.", {
      tags: ["spaghetti", "pasta", "beef", "food", "meal"],
      q: "spaghetti bolognese",
    }),
    meal("creamy-chicken-pasta", "Creamy Chicken Pasta", "Pasta", 6_500, "plate", "Penne with chicken, mushrooms and a light cream sauce.", {
      tags: ["pasta", "chicken", "creamy", "food", "meal"],
      q: "creamy pasta",
    }),
    meal("stir-fry-noodles", "Stir-Fry Noodles", "Pasta", 4_000, "bowl", "Wok-tossed noodles with egg, vegetables and chicken.", {
      tags: ["noodles", "stir fry", "food", "meal"],
      q: "stir fry noodles",
    }),
    // Fast food
    meal("beef-burger-and-fries", "Beef Burger and Fries", "Fast Food", 7_000, "meal", "A double beef patty burger with cheese, lettuce and seasoned fries.", {
      variants: variantsOf({ size: [["Single patty", 6_000], ["Double patty", 7_000]] }),
      tags: ["burger", "fries", "fast food", "food", "weekend"],
      q: "burger and fries",
    }),
    meal("chicken-shawarma", "Chicken Shawarma", "Fast Food", 4_500, "wrap", "Grilled chicken, cabbage, sausage and creamy sauce in toasted flatbread.", {
      variants: portions(4_500, 6_000),
      tags: ["shawarma", "wrap", "chicken", "fast food", "food", "pick"],
      q: ["shawarma", "wrap sandwich", "chicken wrap"],
    }),
    meal("crispy-chicken-wrap", "Crispy Chicken Wrap", "Fast Food", 4_000, "wrap", "Crispy chicken strips, lettuce and garlic mayo in a soft tortilla.", {
      tags: ["wrap", "chicken", "fast food", "food", "lunch"],
      q: "chicken wrap",
    }),
    meal("pepperoni-pizza", "Pepperoni Pizza", "Fast Food", 9_500, "pizza", "Stone-baked pizza with beef pepperoni and mozzarella.", {
      variants: variantsOf({ size: [["Medium", 9_500], ["Large", 13_500]] }),
      tags: ["pizza", "fast food", "food", "weekend", "party"],
      q: "pepperoni pizza",
    }),
    // Breakfast
    meal("pancake-stack", "Pancake Stack", "Breakfast", 4_500, "plate", "Three fluffy pancakes with syrup, fruit and a dusting of sugar.", {
      tags: ["pancakes", "breakfast", "sweet", "food", "weekend"],
      q: "pancakes breakfast",
    }),
    meal("breakfast-platter", "Full Breakfast Platter", "Breakfast", 7_500, "plate", "Eggs, sausages, baked beans, toast and fried plantain.", {
      tags: ["breakfast", "eggs", "platter", "food", "weekend"],
      q: "english breakfast",
    }),
    meal("akara-and-pap", "Akara and Pap", "Breakfast", 3_000, "plate", "Crispy bean fritters with smooth, warm pap.", {
      tags: ["akara", "pap", "breakfast", "food", "african"],
      q: ["fritters", "fried snacks", "breakfast plate"],
    }),
    meal("yam-and-egg-sauce", "Yam and Egg Sauce", "Breakfast", 4_500, "plate", "Boiled yam with a tomato and pepper egg sauce.", {
      tags: ["yam", "egg", "breakfast", "food"],
      q: "yam egg",
    }),
    // Healthy
    meal("grilled-chicken-salad-bowl", "Grilled Chicken Salad Bowl", "Healthy Meals", 5_500, "bowl", "Leafy greens, grilled chicken, avocado, sweetcorn and a light dressing.", {
      tags: ["salad", "healthy", "chicken", "food", "lunch"],
      q: "chicken salad bowl",
    }),
    item("fresh-fruit-bowl", "Fresh Fruit Bowl", "Healthy Meals", 3_500, "bowl", "Seasonal fruit — pineapple, watermelon, pawpaw and grapes — cut fresh.", {
      tags: ["fruit", "fruit bowl", "healthy", "food", "vegetarian"],
      q: "fruit bowl",
    }),
    // Snacks
    item("small-chops-platter", "Small Chops Platter", "Snacks", 12_000, "platter", "Samosas, spring rolls, puff-puff, peppered gizzard and chicken wings.", {
      inventoryStatus: "made_to_order",
      stockQuantity: null,
      variants: variantsOf({ size: [["20 pieces", 12_000], ["40 pieces", 22_000], ["80 pieces", 42_000]] }),
      tags: ["small chops", "party", "snacks", "food", "weekend", "pick"],
      q: ["finger food", "party food platter", "appetizers platter"],
    }),
    item("puff-puff-box", "Puff-Puff Box", "Snacks", 2_500, "box", "Soft, golden puff-puff, dusted with sugar. Box of 12.", {
      tags: ["puff puff", "snacks", "sweet", "food"],
      q: ["doughnut holes", "fried dough", "donuts"],
    }),
    item("fried-plantain-dodo", "Fried Plantain (Dodo)", "Snacks", 2_000, "portion", "Sweet ripe plantain, fried golden.", {
      tags: ["plantain", "dodo", "snacks", "food", "vegetarian"],
      q: ["fried plantain", "plantain", "fried bananas"],
    }),
    item("spring-rolls-pack", "Vegetable Spring Rolls", "Snacks", 3_000, "pack", "Crispy vegetable spring rolls with sweet chilli dip. Pack of 6.", {
      tags: ["spring rolls", "snacks", "food", "vegetarian"],
      q: "spring rolls",
    }),
    item("fruit-yoghurt-parfait", "Fruit Yoghurt Parfait", "Desserts", 3_500, "cup", "Layers of yoghurt, granola and fresh fruit.", {
      tags: ["parfait", "dessert", "healthy", "food"],
      q: "yogurt parfait",
    }),
  ]),
  services: [],
  knowledge: [
    { category: "shipping", title: "Delivery times", body: "Hot meals leave the kitchen within 40 minutes and are delivered by our riders within Lagos." },
    { category: "product_guidance", title: "Allergens", body: "Tell us about allergies when you order. Suya contains groundnut; several soups contain crayfish." },
  ],
};


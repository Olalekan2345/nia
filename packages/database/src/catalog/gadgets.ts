import { EVERY_DAY, item, lagosAreas, variantsOf, weekdayHours, withSkus, type DemoTemplateBase } from "./kit";

/** Walrus Gadgets — a fictional electronics shop. Model names and specs are invented. */
export const GADGETS: DemoTemplateBase = {
  label: "Electronics",
  businessType: "electronics",
  name: "Walrus Gadgets",
  slug: "walrus-gadgets",
  tagline: "Phones, laptops, audio and everyday tech",
  description: "A fictional Lagos electronics shop in Walrus Market. Every model here is a demo listing with generic specifications.",
  accentColor: "#2A2670",
  welcomeMessage: "Looking for a phone, a laptop or the right charger? Tell me your budget and what you'll use it for.",
  city: "Lagos",
  country: "NG",
  fulfillment: { delivery: true, pickup: true, pickupAddress: "Pickup counter — 21 Circuit Road, Ikeja (fictional)" },
  deliveryAreas: lagosAreas({ core: 3500, mainland: 2500, far: 4000 }),
  openingHours: weekdayHours("09:00", "19:00", EVERY_DAY),
  paymentInstructions: "We confirm stock first, then send payment details. Devices are sealed and come with a 12-month shop warranty.",
  products: withSkus("WG", [
    // Phones
    item("arc-lite-2-smartphone", "Arc Lite 2 Smartphone", "Phones", 99_000, "phone", "An entry-level Android phone for calls, chats and social media, with a long-lasting battery.", {
      attributes: { screen: "6.1-inch", battery: "4,500 mAh", os: "Android", tier: "budget" },
      variants: variantsOf({ storage: [["64 GB", 99_000], ["128 GB", 114_000]], colour: ["Black", "Mint"] }),
      tags: ["phone", "smartphone", "android", "budget phone", "gadget"],
      q: "smartphone on white table",
    }),
    item("arc-a15-smartphone", "Arc A15 Smartphone", "Phones", 149_000, "phone", "A big-screen budget Android with a dual camera and all-day battery.", {
      attributes: { screen: "6.5-inch", battery: "5,000 mAh", camera: "dual camera", os: "Android", tier: "budget" },
      variants: variantsOf({ storage: [["64 GB", 149_000], ["128 GB", 169_000]], colour: ["Black", "Ocean Blue"] }),
      tags: ["phone", "smartphone", "android", "budget phone", "gadget", "pick"],
      q: "black smartphone hand",
    }),
    item("arc-a25-5g-smartphone", "Arc A25 5G Smartphone", "Phones", 229_000, "phone", "A mid-range 5G Android with a smooth 120 Hz screen and fast charging.", {
      attributes: { screen: "6.6-inch 120 Hz", battery: "5,000 mAh", network: "5G", os: "Android", tier: "mid-range" },
      variants: variantsOf({ storage: [["128 GB", 229_000], ["256 GB", 259_000]], colour: ["Graphite", "Lavender"] }, { low: ["256 GB / Lavender"] }),
      tags: ["phone", "smartphone", "android", "5g", "gadget"],
      q: ["smartphone", "mobile phone hand", "phone on desk"],
    }),
    item("arc-mini-smartphone", "Arc Mini Smartphone", "Phones", 189_000, "phone", "A compact phone that fits one hand, with a bright OLED screen.", {
      attributes: { screen: "5.8-inch OLED", battery: "4,000 mAh", os: "Android", tier: "mid-range" },
      variants: variantsOf({ storage: [["128 GB", 189_000]], colour: ["Black", "Rose"] }),
      tags: ["phone", "smartphone", "compact", "gadget"],
      q: "mobile phone table",
    }),
    item("arc-business-dual-sim", "Arc Business Dual-SIM Phone", "Phones", 279_000, "phone", "Two SIMs, a work profile and a battery that outlasts long days of calls.", {
      attributes: { screen: "6.4-inch", battery: "5,500 mAh", sim: "dual SIM", os: "Android", tier: "mid-range" },
      variants: variantsOf({ storage: [["256 GB", 279_000]], colour: ["Black"] }),
      tags: ["phone", "smartphone", "business", "dual sim", "gadget"],
      q: "businessman smartphone",
    }),
    item("arc-x-gaming-phone", "Arc X Gaming Phone", "Phones", 649_000, "phone", "A gaming phone with a 144 Hz screen, shoulder triggers and active cooling.", {
      attributes: { screen: "6.8-inch 144 Hz", ram: "12 GB", battery: "6,000 mAh", os: "Android", tier: "gaming" },
      variants: variantsOf({ storage: [["256 GB", 649_000], ["512 GB", 729_000]], colour: ["Stealth Black"] }),
      tags: ["phone", "smartphone", "gaming phone", "gaming", "gadget"],
      q: ["mobile gaming", "playing games on phone", "smartphone hand"],
    }),
    item("arc-pro-smartphone", "Arc Pro Smartphone", "Phones", 899_000, "phone", "The flagship: triple camera with night mode, a titanium-look frame and wireless charging.", {
      attributes: { screen: "6.7-inch OLED 120 Hz", camera: "triple camera", battery: "5,000 mAh", charging: "wireless", os: "Android", tier: "premium" },
      variants: variantsOf({ storage: [["256 GB", 899_000], ["512 GB", 1_049_000]], colour: ["Graphite", "Silver"] }, { low: ["512 GB / Silver"] }),
      tags: ["phone", "smartphone", "premium phone", "flagship", "gadget", "pick"],
      q: ["smartphone camera", "black smartphone", "mobile phone table"],
    }),
    item("arc-flip-foldable-phone", "Arc Flip Foldable Phone", "Phones", 1_190_000, "phone", "A flip phone that folds to pocket size, with a cover screen for quick replies.", {
      attributes: { screen: "6.7-inch foldable", cover: "3.4-inch", os: "Android", tier: "premium" },
      inventoryStatus: "low_stock",
      stockQuantity: 3,
      variants: variantsOf({ storage: [["256 GB", 1_190_000]], colour: ["Cream", "Black"] }, { low: ["256 GB / Cream"] }),
      tags: ["phone", "foldable", "premium phone", "gadget"],
      q: "phone on desk minimal",
    }),
    // Laptops
    item("tusk-cloudbook-11", "Tusk Cloudbook 11", "Laptops", 239_000, "laptop", "A light, affordable laptop for schoolwork, browsing and video lessons.", {
      attributes: { screen: "11.6-inch", ram: "4 GB", storage: "64 GB", processor: "entry-level", use: "school" },
      tags: ["laptop", "student laptop", "budget laptop", "gadget", "school"],
      q: ["laptop", "laptop on table", "notebook computer"],
    }),
    item("tusk-14-student-laptop", "Tusk 14 Student Laptop", "Laptops", 449_000, "laptop", "A dependable 14-inch laptop for assignments, research and streaming.", {
      attributes: { screen: "14-inch Full HD", processor: "mid-range", use: "student" },
      variants: variantsOf({ config: [["8 GB / 256 GB SSD", 449_000], ["16 GB / 512 GB SSD", 559_000]] }),
      tags: ["laptop", "student laptop", "gadget", "school", "pick"],
      q: "laptop on wooden desk",
    }),
    item("tusk-15-business-laptop", "Tusk 15 Business Laptop", "Laptops", 689_000, "laptop", "A business laptop with a fingerprint reader, backlit keyboard and a full day of battery.", {
      attributes: { screen: "15.6-inch Full HD", processor: "performance", security: "fingerprint reader", use: "work" },
      variants: variantsOf({ config: [["16 GB / 512 GB SSD", 689_000], ["16 GB / 1 TB SSD", 779_000]] }),
      tags: ["laptop", "business laptop", "work", "gadget", "home office"],
      q: "laptop office work",
    }),
    item("tusk-air-13-ultrabook", "Tusk Air 13 Ultrabook", "Laptops", 849_000, "laptop", "Thin, quiet and under 1.2 kg — for people who work on the move.", {
      attributes: { screen: "13.3-inch 2.5K", weight: "1.15 kg", processor: "performance", use: "travel" },
      variants: variantsOf({ config: [["16 GB / 512 GB SSD", 849_000]], colour: ["Silver", "Midnight"] }),
      tags: ["laptop", "ultrabook", "thin", "gadget"],
      q: ["laptop desk minimal", "open laptop", "laptop workspace"],
    }),
    item("tusk-flip-14-2-in-1", "Tusk Flip 14 2-in-1 Laptop", "Laptops", 619_000, "laptop", "A touchscreen laptop that folds into a tablet, with pen support for notes and sketches.", {
      attributes: { screen: "14-inch touch", processor: "mid-range", pen: "supported", use: "study, creative" },
      variants: variantsOf({ config: [["8 GB / 512 GB SSD", 619_000], ["16 GB / 512 GB SSD", 679_000]] }),
      tags: ["laptop", "2-in-1", "touchscreen", "gadget"],
      q: "laptop computer keyboard",
    }),
    item("tusk-g16-gaming-laptop", "Tusk G16 Gaming Laptop", "Laptops", 1_390_000, "laptop", "A 16-inch gaming laptop with dedicated graphics, a 165 Hz screen and RGB keyboard.", {
      attributes: { screen: "16-inch 165 Hz", graphics: "dedicated", processor: "high-performance", use: "gaming" },
      inventoryStatus: "low_stock",
      stockQuantity: 2,
      variants: variantsOf({ config: [["16 GB / 1 TB SSD", 1_390_000], ["32 GB / 1 TB SSD", 1_590_000]] }, { low: ["32 GB / 1 TB SSD"] }),
      tags: ["laptop", "gaming laptop", "gaming", "gadget"],
      q: ["gaming laptop", "laptop keyboard backlit", "laptop night"],
    }),
    // Tablets
    item("slate-10-tablet", "Slate 10 Tablet", "Tablets", 219_000, "tablet", "A 10-inch tablet for reading, video calls and kids' learning apps.", {
      attributes: { screen: "10.1-inch", battery: "7,000 mAh", os: "Android" },
      variants: variantsOf({ storage: [["64 GB", 219_000], ["128 GB", 249_000]], colour: ["Grey"] }),
      tags: ["tablet", "gadget", "kids", "reading"],
      q: ["tablet computer", "digital tablet", "tablet in hands"],
    }),
    item("slate-12-pro-tablet", "Slate 12 Pro Tablet", "Tablets", 529_000, "tablet", "A large, sharp tablet with stylus support for notes, drawing and presentations.", {
      attributes: { screen: "12.4-inch 120 Hz", pen: "supported", os: "Android" },
      variants: variantsOf({ storage: [["256 GB", 529_000]], colour: ["Graphite"] }),
      tags: ["tablet", "gadget", "stylus", "drawing"],
      q: ["tablet stylus", "drawing tablet", "tablet device"],
    }),
    // Wearables
    item("pulse-smart-watch", "Pulse Smart Watch", "Smart Watches", 79_000, "watch", "Heart-rate, sleep and step tracking with message alerts and a week of battery.", {
      attributes: { battery: "7 days", water: "5 ATM" },
      variants: variantsOf({ colour: ["Black", "Rose Gold", "Silver"] }),
      tags: ["smart watch", "watch", "fitness", "gadget", "pick"],
      q: "smart watch wrist",
    }),
    item("stride-fitness-band", "Stride Fitness Band", "Smart Watches", 32_000, "band", "A slim fitness tracker for steps, workouts and sleep.", {
      attributes: { battery: "10 days", water: "swim-proof" },
      variants: variantsOf({ colour: ["Black", "Teal"] }),
      tags: ["fitness tracker", "fitness", "band", "gadget"],
      q: ["fitness tracker", "smart band wrist", "smartwatch wrist"],
    }),
    // Audio
    item("floe-anc-headphones", "Floe ANC Over-Ear Headphones", "Headphones", 89_000, "pair", "Wireless over-ear headphones with active noise cancelling and 40-hour battery.", {
      attributes: { connection: "wireless (Bluetooth)", battery: "40 hours", anc: "yes" },
      variants: variantsOf({ colour: ["Black", "Silver", "Navy"] }, { low: ["Navy"] }),
      tags: ["headphones", "wireless", "noise cancelling", "audio", "gadget", "pick", "home office"],
      q: "wireless headphones",
    }),
    item("floe-studio-wired-headphones", "Floe Studio Wired Headphones", "Headphones", 29_500, "pair", "Comfortable wired headphones with a detachable cable and inline mic.", {
      attributes: { connection: "wired (3.5 mm)", mic: "inline" },
      variants: variantsOf({ colour: ["Black", "White"] }),
      tags: ["headphones", "wired", "audio", "gadget"],
      q: ["headphones", "over ear headphones", "headphones on desk"],
    }),
    item("floe-buds-pro", "Floe Buds Pro Wireless Earbuds", "Earbuds", 54_000, "pair", "True wireless earbuds with noise cancelling, a wireless charging case and clear calls.", {
      attributes: { connection: "wireless (Bluetooth)", battery: "8 h + 24 h case", anc: "yes" },
      variants: variantsOf({ colour: ["Black", "White"] }),
      tags: ["earbuds", "wireless earbuds", "audio", "gadget", "pick"],
      q: ["wireless earbuds", "earbuds", "earphones"],
    }),
    item("floe-buds-lite", "Floe Buds Lite Wireless Earbuds", "Earbuds", 22_000, "pair", "Everyday wireless earbuds with a pocket-size case and touch controls.", {
      attributes: { connection: "wireless (Bluetooth)", battery: "6 h + 18 h case" },
      variants: variantsOf({ colour: ["White", "Black"] }),
      tags: ["earbuds", "wireless earbuds", "audio", "gadget"],
      q: ["earbuds white", "in ear earphones", "earphones music"],
    }),
    item("wave-bluetooth-speaker", "Wave Bluetooth Speaker", "Bluetooth Speakers", 46_000, "speaker", "A splash-proof speaker with deep bass and 16 hours of play.", {
      attributes: { battery: "16 hours", water: "IPX6" },
      variants: variantsOf({ colour: ["Black", "Teal", "Coral"] }),
      tags: ["speaker", "bluetooth speaker", "audio", "gadget", "weekend"],
      q: "bluetooth speaker",
    }),
    // Power
    item("volt-20000-power-bank", "Volt 20,000 mAh Power Bank", "Chargers & Power Banks", 24_500, "piece", "Charges a phone about four times, with USB-C fast charging and two USB-A ports.", {
      attributes: { capacity: "20,000 mAh", ports: "1 × USB-C, 2 × USB-A" },
      variants: variantsOf({ colour: ["Black", "White"] }),
      tags: ["power bank", "charger", "battery", "gadget", "essential", "pick"],
      q: "power bank charging phone",
    }),
    item("volt-65w-usb-c-charger", "Volt 65 W USB-C Charger", "Chargers & Power Banks", 19_000, "piece", "One compact charger for your laptop, tablet and phone.", {
      attributes: { power: "65 W", ports: "2 × USB-C, 1 × USB-A" },
      tags: ["charger", "usb-c", "laptop charger", "gadget"],
      q: "usb charger cable",
    }),
    item("volt-wireless-charging-pad", "Volt Wireless Charging Pad", "Chargers & Power Banks", 15_500, "piece", "A slim wireless charger for phones and earbuds that support wireless charging.", {
      attributes: { power: "15 W" },
      tags: ["wireless charger", "charger", "gadget"],
      q: ["wireless charging", "phone charging", "phone charger"],
    }),
    // Computer accessories
    item("keys-mechanical-keyboard", "Keys Mechanical Keyboard", "Keyboards & Mice", 48_000, "piece", "A full-size mechanical keyboard with hot-swappable switches and white backlight.", {
      attributes: { layout: "full size", backlight: "white" },
      variants: variantsOf({ switches: ["Linear (red)", "Tactile (brown)"] }),
      tags: ["keyboard", "mechanical keyboard", "gadget", "home office"],
      q: "mechanical keyboard",
    }),
    item("glide-wireless-mouse", "Glide Wireless Mouse", "Keyboards & Mice", 12_500, "piece", "A quiet wireless mouse that pairs with two devices.", {
      attributes: { connection: "Bluetooth + USB receiver" },
      variants: variantsOf({ colour: ["Black", "Grey"] }),
      tags: ["mouse", "wireless mouse", "gadget", "home office"],
      q: "computer mouse desk",
    }),
    item("hub-7-in-1-usb-c", "Hub 7-in-1 USB-C Adapter", "Computer Accessories", 21_000, "piece", "HDMI, card reader, USB-A and USB-C charging from one laptop port.", {
      attributes: { ports: "HDMI 4K, 2 × USB-A, SD, microSD, USB-C PD, USB-C data" },
      tags: ["usb hub", "adapter", "laptop accessories", "gadget", "home office"],
      q: ["usb adapter", "usb cable laptop", "laptop ports"],
    }),
    item("lens-1080p-webcam", "Lens 1080p Webcam", "Computer Accessories", 27_500, "piece", "A Full HD webcam with a privacy shutter and dual microphones for clear video calls.", {
      attributes: { resolution: "1080p", mic: "dual" },
      tags: ["webcam", "camera", "video calls", "gadget", "home office"],
      q: ["webcam", "video call laptop", "computer camera"],
    }),
    item("carry-laptop-backpack", "Carry Laptop Backpack", "Computer Accessories", 26_000, "piece", "A water-resistant backpack with a padded sleeve for laptops up to 16 inches.", {
      attributes: { fits: "up to 16-inch", material: "water-resistant polyester" },
      variants: variantsOf({ colour: ["Black", "Grey"] }),
      tags: ["backpack", "laptop bag", "gadget", "school"],
      q: "backpack laptop travel",
    }),
    item("rise-laptop-stand", "Rise Aluminium Laptop Stand", "Computer Accessories", 17_500, "piece", "Lifts your screen to eye level and folds flat for travel.", {
      attributes: { material: "aluminium", fits: "10–17-inch" },
      tags: ["laptop stand", "desk", "gadget", "home office"],
      q: ["laptop stand", "laptop on stand desk", "home office desk laptop"],
    }),
    item("guard-phone-case", "Guard Shockproof Phone Case", "Phone Accessories", 6_500, "piece", "A slim shockproof case with raised edges for the camera and screen. Fits Arc phones.", {
      attributes: { fits: "Arc A15, A25, Pro" },
      variants: variantsOf({ colour: ["Black", "Clear", "Navy"] }),
      tags: ["phone case", "phone accessories", "gadget"],
      q: "phone case",
    }),
    // Gaming
    item("play-wireless-controller", "Play Wireless Controller", "Gaming Accessories", 34_000, "piece", "A wireless controller for PC and Android gaming, with a rechargeable battery.", {
      attributes: { connection: "Bluetooth + USB-C", battery: "20 hours" },
      variants: variantsOf({ colour: ["Black", "White"] }),
      tags: ["controller", "gaming", "gamepad", "gadget", "weekend"],
      q: ["gamepad", "video game controller", "gaming controller hands"],
    }),
    item("play-gaming-headset", "Play Gaming Headset", "Gaming Accessories", 39_000, "piece", "A cushioned gaming headset with surround sound and a flip-to-mute mic.", {
      attributes: { connection: "USB + 3.5 mm", mic: "flip-to-mute" },
      tags: ["gaming headset", "gaming", "headset", "gadget"],
      q: ["gaming headset", "headset microphone", "gamer headphones"],
    }),
    // Smart home
    item("home-smart-plug", "Walrus Smart Plug", "Smart Home Devices", 11_000, "piece", "Schedule or switch off appliances from your phone, and see how much power they use.", {
      attributes: { app: "yes", energy: "usage tracking" },
      tags: ["smart plug", "smart home", "gadget"],
      q: "smart plug",
    }),
    item("home-wifi-camera", "Walrus Wi-Fi Home Camera", "Smart Home Devices", 42_000, "piece", "A 2K indoor camera with night vision, motion alerts and two-way talk.", {
      attributes: { resolution: "2K", storage: "microSD or cloud" },
      tags: ["security camera", "smart home", "camera", "gadget"],
      q: "security camera",
    }),
  ]),
  services: [],
  knowledge: [
    { category: "returns", title: "Warranty and returns", body: "Devices carry a 12-month shop warranty. Unopened items can be returned within 7 days; faulty items are repaired or replaced." },
    { category: "product_guidance", title: "Demo specifications", body: "These are demo listings: model names and specifications are generic examples, not real branded products." },
  ],
};

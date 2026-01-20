// ============================================================================

// --- V2 ASSETS ---
const STYLE_WEIGHTS = {
    GLAMOUR: 0.35, ELEGANT: 0.25, CASUAL: 0.20, GOLF: 0.10, PROFESSIONAL: 0.10
};

const WARDROBE_V2 = {
    GLAMOUR: {
        tops: ["Satin Camisole", "Tight Crop Top", "Off-shoulder Knit", "Lace Corset Top", "Deep V-neck Blouse"],
        bottoms: ["Leather Mini Skirt", "Tight Mini Skirt", "Hot Pants", "Micro Shorts"],
        onePieces: ["Bodycon Mini Dress", "Satin Slip Dress", "Tight Wrap Dress", "Sequin Party Dress"]
    },
    ELEGANT: {
        tops: ["Silk Blouse", "Chiffon Shirt", "Cashmere Turtleneck", "Pearl-button Cardigan"],
        bottoms: ["Long Satin Skirt", "Wide-leg Trousers", "Mermaid Skirt", "Pleated Midi Skirt"],
        onePieces: ["Maxi Silk Dress", "Elegant Tweed Dress", "Flowing Chiffon Dress", "Velvet Evening Gown"]
    },
    CASUAL: {
        tops: ["Oversized Knit Sweater", "Cotton T-shirt", "Denim Shirt", "Hoodie", "Striped Long-sleeve"],
        bottoms: ["Skinny Jeans", "Wide Denim Pants", "Cargo Pants", "Cotton Shorts", "Leggings"],
        onePieces: ["Denim Overall Dress", "Knitted Midi Dress", "Cotton Shirt Dress"]
    },
    GOLF: {
        tops: ["Polo Shirt", "Sun-protection Inner + Vest", "Half-zip Mock Neck", "Sleeveless Golf Top"],
        bottoms: ["Pleated Golf Skirt", "Short Golf Pants", "White Culottes"],
        onePieces: ["Golf One-piece Dress", "Sporty Zip-up Dress"]
    },
    PROFESSIONAL: {
        tops: ["Crisp White Shirt", "Tailored Blazer", "Structured Vest"],
        bottoms: ["Pencil Skirt", "Tailored Slacks", "Suit Pants"],
        onePieces: ["Belted Trench Dress", "Formal Sheath Dress"]
    }
};

const COLORS_V2 = ["Red", "Black", "White", "Royal Blue", "Emerald Green", "Pastel Pink", "Beige", "Burgundy", "Navy", "Gold", "Silver", "Lavender"];
const MATERIALS_V2 = ["Satin", "Leather", "Silk", "Knitted", "Cotton", "Velvet", "Tweed", "Spandex", "Denim", "Lace"];
const HAIRSTYLES = ["Long straight black hair", "Wavy brown hair", "Short bob cut", "Ponytail", "Messy bun", "Shoulder-length layered hair", "Elegant updo"];
const FACE_FEATURES = ["Sharp feline eyes", "Soft puppy eyes", "High cheekbones", "Small mole under left eye", "Defined jawline", "Full red lips", "Natural innocent look"];
const BODY_TYPES = ["Curvy hourglass figure", "Slim slender figure", "Athletic toned body", "Voluptuous figure"];

// --- V3 ASSETS ---
const CLASSY_PALETTE = ["Pure White", "Navy Blue", "Royal Green", "Burgundy", "Beige", "Soft Gray", "Black", "Champagne Gold"];
const V3_MATERIALS = ["High-gloss Satin", "Matte Leather", "Textured Tweed", "Sheer Chiffon", "Fine Cashmere", "Stretch Spandex", "Metallic Knit", "Velvet"];
const V3_DETAILS = ["Gold zipper detail", "Pearl buttons", "Asymmetric cut", "Ruffled hem", "Lace trimming", "Side slit", "Backless design", "Crystal embellishments"];

const WARDROBE_V3_TOPS = [
    "Halter-neck Tight Crop Top (Exposed shoulders)", "Off-shoulder Tube Top (Chest emphasized)", "Deep V-neck Ribbed Knit Top",
    "See-through Fitted Blouse", "Button-down Tight Shirt (Gaping style)", "High-leg Bodysuit (Used as Top)",
    "Ultra-tight Long-sleeve Crop Tee", "Square-neck Clavicle Top", "Wrap-style Blouse", "Neckline Zipper Crop Top", "Glossy Spandex Top"
];
const WARDROBE_V3_BOTTOMS = ["Micro Mini Skirt", "Tennis Skirt (Ultra-mini)", "Side-slit Mini Skirt", "H-line Office Mini Skirt"];
const WARDROBE_V3_ONEPIECES = [
    "Bodycon Mini Dress", "Halter-neck Backless Dress", "Shirred Tight Dress (Hip emphasized)", "Deep V-neck Wrap Dress",
    "Crop Top + Mini Skirt Set (Navel exposed)", "Zipper Detail Tight Dress", "Side Cut-out Dress"
];
const WARDROBE_V3_GOLF = [
    "Deep V-neck Tight Polo Shirt + Micro Mini Skirt", "Sleeveless Knit + Pleated Cho-mini Skirt", "Deep U-neck Tee + H-line Mini Skirt",
    "Tight Golf One-piece (Belted)", "Off-shoulder Knit + Ultra-tight Biker Shorts", "Sports Bra Top + Low-rise Mini Skirt"
];

// --- HELPERS ---
function pickRandom(array) { return array[Math.floor(Math.random() * array.length)]; }
function pickWeightedStyle() {
    const rand = Math.random();
    let sum = 0;
    for (const [style, weight] of Object.entries(STYLE_WEIGHTS)) {
        sum += weight;
        if (rand < sum) return style;
    }
    return 'GLAMOUR';
}

// --- V2 LOGIC ---
function generateCostumeV2(forceStyle) {
    const style = forceStyle || pickWeightedStyle();
    const items = WARDROBE_V2[style];
    const useOnePiece = Math.random() < 0.3;
    let outfit = "";
    const color = pickRandom(COLORS_V2);
    const material = pickRandom(MATERIALS_V2);

    if (useOnePiece && items.onePieces.length > 0) {
        outfit = `${color} ${material} ${pickRandom(items.onePieces)}`;
    } else {
        const top = pickRandom(items.tops);
        const bottom = pickRandom(items.bottoms);
        if (Math.random() > 0.5) {
            outfit = `${color} ${material} ${top} and matching ${bottom}`;
        } else {
            const bottomColor = pickRandom(COLORS_V2.filter(c => c !== color));
            outfit = `${color} ${top} paired with ${bottomColor} ${bottom}`;
        }
    }
    return { description: outfit, style };
}

function generateCharacterTraits() {
    return `${pickRandom(HAIRSTYLES)}, ${pickRandom(FACE_FEATURES)}, ${pickRandom(BODY_TYPES)}`;
}

// --- V3 LOGIC ---
function pickV3Item(category) {
    const isGolf = category.includes("골프");
    const allItems = [
        ...WARDROBE_V3_TOPS.map(t => `${t} + ${pickRandom(WARDROBE_V3_BOTTOMS)}`),
        ...WARDROBE_V3_ONEPIECES
    ];
    const golfItems = WARDROBE_V3_GOLF;

    let itemBase = "";
    if (isGolf && Math.random() < 0.8) {
        itemBase = pickRandom(golfItems);
    } else {
        itemBase = pickRandom(allItems);
    }

    const color = pickRandom(CLASSY_PALETTE);
    const material = pickRandom(V3_MATERIALS);
    const detail = pickRandom(V3_DETAILS);

    return `${color} ${material} ${itemBase} with ${detail}`;
}

function generateV3Variables(category) {
    const itemA = pickV3Item(category);
    let itemB = pickV3Item(category);
    while (itemB === itemA) itemB = pickV3Item(category);
    let itemC = pickV3Item(category);
    while (itemC === itemA || itemC === itemB) itemC = pickV3Item(category);

    const hairs = {
        A: pickRandom(HAIRSTYLES),
        B: pickRandom(HAIRSTYLES),
        C: pickRandom(HAIRSTYLES)
    };

    return { items: { A: itemA, B: itemB, C: itemC }, hairs };
}

// --- DEMO RUNNER ---
console.log("==========================================================");
console.log("               V2 ENGINE (STANDARD) DEMO                  ");
console.log("==========================================================");
const v2Style = pickWeightedStyle();
const v2Costume = generateCostumeV2(v2Style);
const v2Traits = generateCharacterTraits();
console.log(`[Style]: ${v2Style}`);
console.log(`[Traits]: ${v2Traits}`);
console.log(`[Outfit]: ${v2Costume.description}`);
console.log("\n>>> V2 PROMPT EXAMPLE (Part of System Prompt):");
console.log(`"Identity: Korean Woman, Physical: ${v2Traits}, COSTUME: ${v2Costume.description} (${v2Style} Style)"`);

console.log("\n\n==========================================================");
console.log("               V3 ENGINE (LUXURY) DEMO                    ");
console.log("==========================================================");
const v3Vars = generateV3Variables("부부/연애"); // Default category
console.log("[Woman A (Center)]");
console.log(`- Outfit: ${v3Vars.items.A}`);
console.log(`- Hair: ${v3Vars.hairs.A}`);
console.log("\n[Woman B (Left)]");
console.log(`- Outfit: ${v3Vars.items.B}`);
console.log(`- Hair: ${v3Vars.hairs.B}`);
console.log("\n[Woman C (Right)]");
console.log(`- Outfit: ${v3Vars.items.C}`);
console.log(`- Hair: ${v3Vars.hairs.C}`);

console.log("\n>>> V3 PROMPT EXAMPLE (Part of System Prompt):");
console.log(`"Woman A (Center): Outfit: ${v3Vars.items.A}, Hair: ${v3Vars.hairs.A}"`);

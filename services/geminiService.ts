// Imports removed for browser compatibility
import { SYSTEM_PROMPT_V3_COSTAR, SYSTEM_PROMPT_V3, SYSTEM_PROMPT_CHATGPT, SYSTEM_PROMPT_CLAUDE, SYSTEM_PROMPT_VIRAL, CHARACTER_PRESETS, UNIFIED_OUTFIT_LIST } from "../constants";
import { resolveEnginePrompt, ensureEngineConfigLoaded } from "./enginePromptStore";
import { UserInput, StoryResponse, ScenarioMode, StyleTemplate } from '../types';
import {
  applyPromptEnhancementSlots,
  DEFAULT_PROMPT_ENHANCEMENT_SETTINGS,
  normalizePromptEnhancementSettings,
  NormalizedPromptEnhancementSettings,
} from './promptEnhancementUtils';
import { isTopicDirectlyCopied, buildTopicViolationNotice, normalizeTopicText } from '../utils/topicGuard';
import { buildOutfitPool } from './outfitService';
import type { OutfitPoolItem } from './outfitService';
import { getCachedCharacters } from './characterService';
import {
  buildCharacterExtractionPrompt,
  parseCharacterExtractionResponse,
  buildManualSceneDecompositionPrompt,
  parseManualSceneDecompositionResponse,
  ManualSceneSummary
} from './manualSceneBuilder';

// Schema definition removed as we are using web automation and raw JSON parsing.

// ============================================================================
// V2 ENGINE ASSETS (STANDARD)
// ============================================================================

type StyleCategory = 'GLAMOUR' | 'ELEGANT' | 'CASUAL' | 'GOLF' | 'PROFESSIONAL';

const STYLE_WEIGHTS: Record<StyleCategory, number> = {
  GLAMOUR: 0.35,      // Tight, Sexy, Mini (Original Default)
  ELEGANT: 0.25,      // Luxury, Long dresses, Silk
  CASUAL: 0.20,       // Jeans, Knits, Daily
  GOLF: 0.10,         // Sporty
  PROFESSIONAL: 0.10  // Suits, Shirts
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
    onePieces: ["Silk Wrap Mini Dress", "Elegant Tweed Mini Dress", "Chiffon Mini Dress", "Velvet Mini Dress"]
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

const COLORS_V2 = [
  "Red", "Black", "White", "Royal Blue", "Emerald Green",
  "Pastel Pink", "Beige", "Burgundy", "Navy", "Gold", "Silver", "Lavender"
];

const MATERIALS_V2 = [
  "Satin", "Leather", "Silk", "Knitted", "Cotton", "Velvet", "Tweed", "Spandex", "Denim", "Lace"
];

const HAIRSTYLES = [
  "Long straight black hair", "Wavy brown hair", "Short bob cut",
  "Ponytail", "Messy bun", "Shoulder-length layered hair", "Elegant updo"
];

// [REMOVED] FEMALE_CHARACTER_PRESETS is now imported as CHARACTER_PRESETS from constants.ts

const MALE_DEFAULT_HAIR = "Neatly styled short black hair (dandy, clean cut)";

const SHERBET_ENGINE_IDS = new Set([
  "CUSTOM_1766894774435", // 샤베트 설렘 반전 v2.x
  "CUSTOM_1766911468128", // 샤베트 대박 반전 v1.x
]);

const stripSherbetOutfitCatalog = (prompt: string): string => {
  if (!prompt) return "";
  const withoutCatalog = prompt.replace(/\[Style 1:[\s\S]*?(?=##\s*6\.\s*출력 포맷)/, "");
  return withoutCatalog.trim();
};

const injectSherbetOutfitLock = (prompt: string, mainOutfit?: string): string => {
  const outfitLine = mainOutfit && mainOutfit.trim()
    ? `- Main female outfit (lock this across all scenes): ${mainOutfit.trim()}`
    : "- Main female outfit: choose exactly one outfit and lock it across all scenes.";
  const subGuidance = "- Sub female outfits: auto-select one per sub character that never overlaps with the main outfit; keep it fixed. Do NOT enumerate catalogs.";
  const maleGuidance = "- Male outfit: use a simple golf-look default if a male appears; otherwise keep male absent.";
  const suppression = "- 절대 금지: 의상 리스트/카탈로그를 본문에 열거하거나 붙여넣지 말 것.";
  return `${prompt.trim()}\n\n[OUTFIT LOCK (TOKEN SAVE)]\n${outfitLine}\n${subGuidance}\n${maleGuidance}\n${suppression}`;
};

const getEngineConfig = (id: string) => {
  const prompt = resolveEnginePrompt(id);
  return prompt ? { prompt } : null;
};

const SAFE_BODY_TYPES = [
  "Voluptuous S-line figure with glamorous curves",
  "Curvy and toned body with wide hips",
  "Glamorous hourglass figure with full bust",
  "Fit and voluptuous body with healthy curves",
  "Tall and curvy model physique"
];

const FACE_FEATURES = [
  "Sharp feline eyes", "Soft puppy eyes", "High cheekbones",
  "Small mole under left eye", "Defined jawline", "Full red lips", "Natural innocent look"
];

const BODY_TYPES = [
  "Voluptuous S-line figure", "Glamorous hourglass figure", "Curvy and toned body", "Full bust and wide hips"
];

// === Senior-targeted Scenario Ingredient Pools ===
const SENIOR_BACKGROUND_OPTIONS = [
  "도심 재래시장 한복판",
  "고급 실내 골프연습장",
  "지방 공항 대기 라운지",
  "경로당 겸 카페로 바뀐 복합 문화 공간",
  "시골 장터 옆 임시 행사장",
  "럭셔리 세차장 VIP 라운지",
  "고급 병원 건강검진 대기실",
  "대기업 사내 카페나 휴게실",
  "고급 리조트 수영장 주변",
  "중소기업 공장 사장실"
];

const SENIOR_PROP_OPTIONS = [
  "프리미엄 회원권 케이스",
  "생맥주 전용 동결잔",
  "커피믹스 3종 세트",
  "한정판 골프공 세트",
  "회장님 도장 찍힌 서류철",
  "럭셔리 스카프 박스",
  "효도폰 최신 기종",
  "VIP 택배 상자",
  "과일 바구니",
  "건강검진 결과 봉투",
  "골드바 모형 종이무게",
  "부부 금슬 팔찌"
];

const SENIOR_CONFLICT_TOPICS = [
  "갑질 고객 응대",
  "부부 사이 이중 의미 장난",
  "세대차에서 오는 언어 오해",
  "재산·상속 자랑 후 굴욕",
  "건강검진 결과를 둘러싼 긴장",
  "사내 정치와 은근한 폭탄 발언",
  "골프 실력·장비 과시",
  "항공/여행 중 방송 사고",
  "맞선에서 벌어지는 언어유희",
  "시골 어르신과 도시인 갈등",
  "부모님 몰래 한 투자 이야기",
  "친척 모임에서의 체면싸움"
];

const SCENARIO_TONE_MAP: Record<string, string> = {
  [ScenarioMode.DOUBLE_ENTENDRE]: "Ambiguous adult humor that ends with an innocent reveal.",
  [ScenarioMode.TWIST_REVERSE]: "Sharp power-reversal comedy with a cathartic punch.",
  [ScenarioMode.BLACK_COMEDY]: "Dry, cynical narration that exposes awkward realities.",
  [ScenarioMode.ADULT_HUMOR]: "Cheeky couple banter that stays YouTube-safe.",
  [ScenarioMode.GAG_SSUL]: "Fast-paced gag storytelling with a witty last line.",
  default: "Playful senior-targeted storytelling with a clever twist."
};

interface TemplateEntry {
  id: string;
  label: string;
  description?: string;
  prompt: string;
}

// Template config loading moved to async fetch within generateStory
// const TEMPLATE_CONFIG_PATH = ... (Removed)
// function loadTemplateConfig ... (Removed)

function findTemplatePrompt(list: TemplateEntry[], key?: string): string {
  if (!key || !key.trim()) return "";
  const normalized = key.trim();
  const exact = list.find(entry => entry.label === normalized || entry.id === normalized);
  if (exact) return exact.prompt || "";
  const fuzzy = list.find(entry =>
    normalized.includes(entry.label) ||
    entry.label.includes(normalized) ||
    normalized.includes(entry.id) ||
    entry.id.includes(normalized)
  );
  return fuzzy?.prompt || "";
}

const enforcePunchlineFormat = (text?: string | null): string => {
  if (!text) return '';
  let normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const sentenceMatch = normalized.match(/^[^?!~\\.]+[?!~\\.]?/);
  let sentence = sentenceMatch ? sentenceMatch[0].trim() : normalized;
  if (sentence.length > 15) {
    sentence = sentence.slice(0, 15).trim();
  }
  if (!/[?!~\\.]/.test(sentence.slice(-1))) {
    sentence += '!';
  }
  return sentence;
};

// ============================================================================
// V3 ENGINE ASSETS (LUXURY EDITION) - RESTORED FULL LIST
// ============================================================================

const CLASSY_PALETTE = [
  "Pure White", "Navy Blue", "Royal Green", "Burgundy", "Beige", "Soft Gray", "Black", "Champagne Gold"
];

const V3_MATERIALS = [
  "High-gloss Satin", "Matte Leather", "Textured Tweed", "Sheer Chiffon",
  "Fine Cashmere", "Stretch Spandex", "Metallic Knit", "Velvet"
];

const V3_DETAILS = [
  "Gold zipper detail", "Pearl buttons", "Asymmetric cut", "Ruffled hem",
  "Lace trimming", "Side slit", "Backless design", "Crystal embellishments"
];

// 🔥 TOPS (15종 - 상체 볼륨 강조, 세련된 디자인)
// Code: T01, T02, T05, T06, T12, T16, T17, T20, T21, T22, T25
// 🔥 TOPS (Existing Best + New Basics)
// Code: T01-T11
// ============================================================================
// V3 WARDROBE COLLECTIONS (BY STYLE)
// ============================================================================

// ============================================================================
// V3 WARDROBE COLLECTIONS (REFACTORED: TOPS / BOTTOMS / DRESSES)
// ============================================================================

// LUXURY_WARDROBE는 UNIFIED_OUTFIT_LIST로 통합됨 (아래에서 정의)

// LUXURY_WARDROBE_KR은 UNIFIED_OUTFIT_LIST로 통합됨

// ============================================================================
// SAFE V3 ASSETS (FOR CHATGPT - HIGH FASHION & ELEGANCE)
// ============================================================================

const SAFE_WARDROBE_V3_TOPS = [
  "Off-shoulder Knit Top (Clavicle exposed)",
  "Sheer-layered Silk Blouse",
  "Backless Halter Top",
  "Form-fitting Ribbed Crop Top",
  "V-neck Satin Cami",
  "Structured Corset Top",
  "High-neck Sleeveless Silk Top",
  "Modern Cut-out Top",
  "V-neck Tight Top", // [NEW]
  "Micro Crop Top", // [NEW]
  "Off-shoulder Knit" // [NEW]
];

const SAFE_WARDROBE_V3_BOTTOMS = [
  "High-slit Mini Skirt",
  "Ultra-mini Leather Skirt",
  "Body-con Pencil Skirt",
  "Shorts with Long Boots",
  "Skinny Leather Pants",
  "Asymmetric Wrap Mini Skirt",
  "Micro Mini Skirt", // [NEW]
  "Ultra-short Hot Pants" // [NEW]
];

const SAFE_WARDROBE_V3_ONEPIECES = [
  "Body-con Mini Dress",
  "Backless Evening Mini Dress", // [RESTORED LUXURY KEYWORD]
  "High-slit Satin Mini Dress",
  "Off-shoulder Tight Mini Dress",
  "Sheer Panel Cocktail Mini Dress", // [RESTORED LUXURY KEYWORD]
  "Modern Silhouette Mini Dress",
  "Bodycon Mini Dress",
  "Backless Mini Dress"
];

const SAFE_WARDROBE_V3_GOLF = [
  "Sleeveless Mock-neck + Ultra-mini Skirt",
  "Tight Knit One-piece (Body-con fit)",
  "Off-shoulder Golf Top + Pleated Skirt",
  "Zip-up Crop Top + High-waisted Shorts",
  "Modern Sporty Body-suit Set"
];

// 🔥 MEN'S LUXURY WEAR (Dandy & Fit)
const WARDROBE_V3_MEN_GOLF = [
  "Navy Slim-fit Polo Shirt + White Tailored Golf Pants",
  "White Performance Polo + Beige Chino Golf Pants",
  "Black Mock-neck Long Sleeve + Grey Checkered Slacks",
  "Sky Blue Pique Polo + Navy Slim Trousers",
  "Charcoal Grey Knit Vest + White Shirt + Black Pants",
  "Burgundy Half-zip Pullover + Beige Pants",
  "All Black Chic Golf Look (Black Polo + Black Slacks)",
  "White Windbreaker + Navy Shorts + White Leggings"
];

const WARDROBE_V3_MEN_BUSINESS = [
  "White Shirt + Navy Blazer + Grey Slacks",
  "Midnight Navy Slim Suit + Silk Tie",
  "Charcoal Double-breasted Suit + Black Tie",
  "Beige Cashmere Turtleneck + Camel Coat + Black Slacks",
  "Pinstripe Suit + White Shirt + Pocket Square",
  "Black Turtleneck + Grey Wool Suit",
  "White Oxford Shirt + Camel Coat + Navy Slacks"
];

const WARDROBE_V3_MEN_CASUAL = [
  "Black Knit Polo + Dark Indigo Denim",
  "Light Grey Linen Shirt + White Pants",
  "Dark Green Bomber Jacket + Black Slacks",
  "Navy Cardigan + White Tee + Khaki Pants",
  "Cream Cable Knit Sweater + Light Denim",
  "Monochrome Casual (Black Tee + Black Slim Slacks)",
  "Ivory Hoodie + Beige Jogger Pants"
];

const WARDROBE_V3_MEN_LOUNGE = [
  "White Silk Shirt + Black Dress Pants",
  "Velvet Blazer + Black Turtleneck + Slim Slacks",
  "Black Satin Shirt + White Pleated Trousers",
  "Dark Burgundy Suit + Black Shirt",
  "Smoked Grey Shirt + Black Skinny Pants"
];

const ALL_MALE_WARDROBE = [
  ...WARDROBE_V3_MEN_GOLF,
  ...WARDROBE_V3_MEN_BUSINESS,
  ...WARDROBE_V3_MEN_CASUAL,
  ...WARDROBE_V3_MEN_LOUNGE
];

function pickMaleOutfitForContext(topic: string = ""): string {
  const normalized = topic.toLowerCase();
  if (normalized.includes("골프") || normalized.includes("golf") || normalized.includes("라운딩") || normalized.includes("티박스")) {
    // Pick a casual golf look but keep it deterministic-ish to avoid all-identical outfits
    const pool = WARDROBE_V3_MEN_GOLF.length ? WARDROBE_V3_MEN_GOLF : ["White Performance Polo + Beige Chino Golf Pants"];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (
    normalized.includes("사무") ||
    normalized.includes("office") ||
    normalized.includes("회사") ||
    normalized.includes("대표") ||
    normalized.includes("사장") ||
    normalized.includes("미팅") ||
    normalized.includes("거래")
  ) {
    return WARDROBE_V3_MEN_BUSINESS[0] || "White Shirt + Navy Blazer + Grey Slacks";
  }
  if (
    normalized.includes("라운지") ||
    normalized.includes("파티") ||
    normalized.includes("호텔") ||
    normalized.includes("행사") ||
    normalized.includes("바") ||
    normalized.includes("살롱")
  ) {
    return WARDROBE_V3_MEN_LOUNGE[0] || "White Silk Shirt + Black Dress Pants";
  }
  return WARDROBE_V3_MEN_CASUAL[0] || "Black Knit Polo + Dark Indigo Denim";
}

// --- HELPER FUNCTIONS ---

function pickRandom<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function pickUniqueItems<T>(array: T[], count: number): T[] {
  const pool = [...array];
  const result: T[] = [];
  while (result.length < Math.min(count, pool.length) && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function pickWeightedStyle(): StyleCategory {
  const rand = Math.random();
  let sum = 0;
  for (const [style, weight] of Object.entries(STYLE_WEIGHTS)) {
    sum += weight;
    if (rand < sum) return style as StyleCategory;
  }
  return 'GLAMOUR';
}

// --- V2 LOGIC ---

function generateCostumeV2(forceStyle?: StyleCategory): { description: string, style: StyleCategory } {
  // V2는 이제 UNIFIED_OUTFIT_LIST 사용
  const style = forceStyle || pickWeightedStyle();
  const outfit = pickRandomOutfit(style.toLowerCase());
  return { description: outfit, style };
}

function generateCharacterTraits(): string {
  const cachedCharacters = getCachedCharacters()
    .filter((character) => character.gender === 'female')
    .filter((character) => character.hair && character.body);

  if (cachedCharacters.length > 0) {
    const selectedChar = pickRandom(cachedCharacters);
    return `${selectedChar.hair}, ${selectedChar.body}`;
  }

  const femaleChars = [CHARACTER_PRESETS.WOMAN_A, CHARACTER_PRESETS.WOMAN_B, CHARACTER_PRESETS.WOMAN_C];
  const selectedChar = pickRandom(femaleChars);
  return `${selectedChar.hair}, ${selectedChar.body}`;
}

function buildScenarioIngredientBlock(mode: ScenarioMode | string, topic: string): string {
  // [REFACTORED] Removed random prop injection.
  // Now instructs AI to find props RELEVANT to the user's topic.
  const tone = SCENARIO_TONE_MAP[mode as string] || SCENARIO_TONE_MAP.default;

  return `
  [SCENARIO INGREDIENTS]
  - Topic: ${topic || '자유 주제'}
  - Tone Style: ${tone}
  - **CRITICAL INSTRUCTION**: Do NOT use random objects like "Frozen Beer Glass" or "Airplane Buttons" unless they fit the Topic.
  - **Prop Selection**: Select 2-3 objects that NATURALLY exist in the context of the Topic (${topic}).
  - **Conflict**: Create a conflict that fits the Topic and the selected Scenario Mode.
  `;
}

// [REMOVED] VIRAL_TWIST_TOPICS and getViralTopic to prevent random content injection.
// We now rely on the "Structural Benchmarking" approach in the main prompt logic.

function getDynamicHookLogic(topic: string, viralTheme: string): string {
  return `
  [DYNAMIC HOOK FORMULA]
  1. **Scene 1 (0-3s)**: Start with a **TITLE / HOOK LINE**.
     - Formula: "Title: [Provocative Statement or Question about ${topic}]"
     - Example: "Title: I almost got kicked out of the golf course for this..."
     - **CRITICAL**: The very first line of the scriptBody MUST be this Title/Hook.
  2. **Scene 1 (3-6s)**: Immediately describe the LOCATION and TENSION.
     - Formula: "Narration: Here in the [Location], everyone was looking at..."

  [OBJECT SELECTION RULE (CRITICAL)]
  - **STEP 1: SCAN THE LOCATION**. Visualize the [Location] in detail.
  - **STEP 2: DISCOVER PROPS**. Find an object that NATURALLY exists there but can be misunderstood.
  - **STEP 3: BE CREATIVE**. Do NOT use generic items like "Coffee Mix" or "Banana" unless essential.
  - **CONSTRAINT**: The object MUST require physical effort (pulling, pushing, shaking, squeezing) to operate.
  `;
}


// --- V3 LOGIC ---

// pickV3Item 함수는 더 이상 사용하지 않음 - pickRandomOutfit으로 대체

// pickSafeV3Item 함수는 더 이상 사용하지 않음 - pickRandomOutfit으로 대체

function generateV3Variables(category: string) {
  // Select 3 distinct items from UNIFIED_OUTFIT_LIST
  const femaleOutfits = UNIFIED_OUTFIT_LIST.filter(item => !item.categories.includes('MALE'));
  const itemA = pickRandomOutfit(category);
  let itemB = pickRandomOutfit(category);
  while (itemB === itemA) itemB = pickRandomOutfit(category);
  let itemC = pickRandomOutfit(category);
  while (itemC === itemA || itemC === itemB) itemC = pickRandomOutfit(category);

  // Select Hair
  const hairs = {
    A: CHARACTER_PRESETS.WOMAN_A.hair,
    B: CHARACTER_PRESETS.WOMAN_B.hair,
    C: CHARACTER_PRESETS.WOMAN_C.hair
  };

  return { items: { A: itemA, B: itemB, C: itemC }, hairs };
}

function generateSafeV3Variables(category: string) {
  // Use UNIFIED_OUTFIT_LIST instead of pickSafeV3Item
  const itemA = pickRandomOutfit(category);
  let itemB = pickRandomOutfit(category);
  while (itemB === itemA) itemB = pickRandomOutfit(category);
  let itemC = pickRandomOutfit(category);
  while (itemC === itemA || itemC === itemB) itemC = pickRandomOutfit(category);

  const hairs = {
    A: CHARACTER_PRESETS.WOMAN_A.hair,
    B: CHARACTER_PRESETS.WOMAN_B.hair,
    C: CHARACTER_PRESETS.WOMAN_C.hair
  };

  return { items: { A: itemA, B: itemB, C: itemC }, hairs };
}

export const enhancePromptWithSafeGlamour = (
  prompt: string,
  context: string = "",
  settings?: NormalizedPromptEnhancementSettings
): string => {
  if (!prompt) return '';
  const normalized = settings ?? DEFAULT_PROMPT_ENHANCEMENT_SETTINGS;

  // [FIX] Respect the Auto-Enhance setting. If OFF, do not modify the prompt.
  if (!normalized.autoEnhanceOnGeneration) {
    return prompt;
  }

  const hasFemale = /\b(Woman|Girl|Lady|Female|여성|여자)\b/i.test(prompt);
  return applyPromptEnhancementSlots(prompt, normalized, { hasFemaleCharacter: hasFemale });
};

const SHORT_PROMPT_CONFIDENCE_PREFIX = (agePhrase: string) =>
  `Confident Korean women ${agePhrase}, impeccably maintained elegance, short and tight luxury outfits, graceful healthy beauty`;

const deriveShortPromptFromScene = (
  longPrompt?: string,
  existingShort?: string,
  targetAge?: string
): string => {
  const source =
    (typeof longPrompt === 'string' && longPrompt.trim().length > 0
      ? longPrompt
      : existingShort || ''
    ).trim();

  if (!source) return '';

  const mentionsNoMale = /no male characters appear/i.test(source);
  let normalized = source
    .replace(/This scene visually represents the moment:[^\.]+\./gi, '')
    .replace(/No male characters appear[^\.]*\./gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    normalized = "dynamic candid choreography across the snow-dusted golf course";
  }

  // Inject age mention if missing
  if (!/in (her|his) \d{2}s/i.test(normalized) && !/50대|40대|30대|20대|60대/i.test(normalized)) {
    normalized = `in her 50s, ${normalized}`;
  }

  if (!/short (and|&)|short yet tight|mini dress|micro skirt/i.test(normalized)) {
    normalized += ", short yet tight couture silhouettes";
  }

  if (!/well[-\\s]?maintained|timeless glamour/i.test(normalized)) {
    normalized += ", well-maintained timeless glamour";
  }

  const agePhrase = getAgePhrase(targetAge);
  let rebuilt = `${SHORT_PROMPT_CONFIDENCE_PREFIX(agePhrase)}, ${normalized}`;
  rebuilt = rebuilt.replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').trim();

  if (mentionsNoMale) {
    rebuilt = `${rebuilt}, No male characters appear in this scene.`;
  }

  return rebuilt;
};

const getAgePhrase = (targetAge?: string): string => {
  const ageText = (targetAge || '').trim();
  const digitMatch = ageText.match(/(\d{2})/);
  if (digitMatch) {
    return `in her ${digitMatch[1]}s`;
  }
  if (/60대/.test(ageText)) return "in her 60s";
  if (/50대/.test(ageText)) return "in her 50s";
  if (/40대/.test(ageText)) return "in her 40s";
  if (/30대/.test(ageText)) return "in her 30s";
  return "in her 50s";
};

const ensureAgeMention = (text: string, targetAge?: string): string => {
  if (!text) return text;
  const agePhrase = getAgePhrase(targetAge);
  if (/in (her|his) \d{2}s/i.test(text) || /50대|40대|30대|20대|60대/i.test(text)) {
    return text;
  }
  return `${agePhrase}, ${text}`.replace(/,\s*,/g, ', ').trim();
};

/**
 * 씬마다 다양한 표정을 강제로 추가하는 함수
 * AI가 표정을 누락한 경우 자동으로 추가
 */
const ensureDynamicExpression = (prompt: string, sceneNumber: number): string => {
  if (!prompt) return prompt;

  // 8가지 다양한 표정 풀
  const expressions = [
    "biting lips nervously",
    "furrowed brows with concern",
    "wide eyes in shock",
    "sweating with tension",
    "flustered and blushing",
    "intense focused gaze",
    "smirking confidently",
    "pouting playfully"
  ];

  // 이미 표정이 있는지 확인
  const hasExpression = /biting|furrowed|wide eyes|sweating|flustered|smirking|pouting|nervous|shocked|confident|surprised|worried|happy|sad|angry|excited|curious|skeptical|amused/i.test(prompt);

  if (hasExpression) {
    return prompt;
  }

  // 씬 번호에 따라 다른 표정 선택 (순환)
  const selectedExpression = expressions[sceneNumber % expressions.length];

  // "Korean woman in her 40s," 또는 "Korean man in his 40s," 뒤에 표정 삽입
  let result = prompt.replace(
    /(Korean (?:woman|man) in (?:her|his) \d+s),/i,
    `$1, ${selectedExpression},`
  );

  // 만약 위 패턴이 없으면 맨 앞에 추가
  if (result === prompt) {
    result = `${selectedExpression}, ${prompt}`;
  }

  return result.replace(/,\s*,/g, ', ').trim();
};

/**
 * 씬마다 다양한 동작을 강제로 추가하는 함수 (약한 동작 교체 로직)
 * AI가 동작을 누락하거나 약한 동작을 사용한 경우 강한 동작으로 교체
 */
const ensureDynamicAction = (prompt: string, sceneNumber: number): string => {
  if (!prompt) return prompt;

  // 8가지 다양한 동작 풀
  const actions = [
    "leaning forward with curiosity",
    "crossing arms defensively",
    "gesturing expressively with hands",
    "tilting head in confusion",
    "stepping back in surprise",
    "reaching out tentatively",
    "turning away in frustration",
    "laughing while covering mouth"
  ];

  // 약한 동작 목록 (교체 대상)
  const weakActions = /\b(standing still|standing|walking gracefully|walking|sitting quietly|sitting|looking at|looking)\b/gi;

  // 강한 동작이 있는지 확인
  const hasStrongAction = /leaning|crossing|gesturing|tilting|stepping|reaching|turning|laughing|running|jumping|dancing|pointing|waving|nodding|shaking|bending|stretching/i.test(prompt);

  if (hasStrongAction) {
    return prompt; // 이미 강한 동작이 있으면 그대로
  }

  const selectedAction = actions[sceneNumber % actions.length];

  // 약한 동작을 강한 동작으로 교체
  if (weakActions.test(prompt)) {
    return prompt.replace(weakActions, selectedAction).replace(/,\s*,/g, ', ').trim();
  }

  // 약한 동작도 없으면 추가
  // 표정 관련 키워드 뒤에 동작 삽입
  let result = prompt.replace(
    /(nervous|shocked|confident|blushing|focused|smirking|pouting|concerned|surprised|worried|happy|sad|angry|excited|curious|skeptical|amused),/i,
    `$1, ${selectedAction},`
  );

  // 만약 표정이 없으면 "Korean woman/man" 뒤에 추가
  if (result === prompt) {
    result = prompt.replace(
      /(Korean (?:woman|man) in (?:her|his) \d+s),/i,
      `$1, ${selectedAction},`
    );
  }

  // 그래도 없으면 맨 앞에 추가
  if (result === prompt) {
    result = `${selectedAction}, ${prompt}`;
  }

  return result.replace(/,\s*,/g, ', ').trim();
};

/**
 * 여성 캐릭터에게 악세서리를 강제로 추가하는 함수 (4단계 폴백 로직)
 * AI가 악세서리를 누락한 경우 자동으로 추가
 */
const ensureAccessory = (prompt: string, characterId: string): string => {
  if (!prompt) return prompt;

  // Slot별 고정 악세서리
  const accessories: Record<string, string> = {
    A: "diamond stud earrings + gold luxury watch",
    B: "pearl drop earrings + silver pendant necklace",
    C: "simple platinum hoops + black leather strap watch"
  };

  // 이미 악세서리가 있는지 확인
  const hasAccessory = /earrings|necklace|bracelet|watch|ring|accessory|jewelry|pendant|brooch|hairpin|scarf/i.test(prompt);

  if (hasAccessory) {
    return prompt;
  }

  // 캐릭터 ID에서 Slot 추출 (A, B, C)
  const slotMatch = characterId.match(/Slot ([ABC])/i) || characterId.match(/^([ABC])$/);
  const slot = slotMatch ? slotMatch[1].toUpperCase() : 'A';

  // Slot에 맞는 악세서리 가져오기
  const accessory = accessories[slot] || accessories.A;

  // 1순위: "outfit:" 뒤에 추가 (대소문자 무시)
  let result = prompt.replace(
    /(outfit:[^,]+),/i,
    `$1, wearing ${accessory},`
  );

  // 2순위: "], " 패턴 뒤에 추가 (Slot 정의 끝)
  if (result === prompt) {
    result = prompt.replace(
      /(\[[^\]]*(?:hair|figure|glamorous)[^\]]*\]),/i,
      `$1, wearing ${accessory},`
    );
  }

  // 3순위: "Korean woman in her 40s" 뒤에 추가
  if (result === prompt) {
    result = prompt.replace(
      /(Korean (?:woman|man) in (?:her|his) \d+s),/i,
      `$1, wearing ${accessory},`
    );
  }

  // 4순위: 첫 번째 쉼표 뒤에 강제 삽입
  if (result === prompt && prompt.includes(',')) {
    const firstCommaIndex = prompt.indexOf(',');
    result = prompt.slice(0, firstCommaIndex + 1) + ` wearing ${accessory},` + prompt.slice(firstCommaIndex + 1);
  }

  return result.replace(/,\s*,/g, ', ').trim();
};

/**
 * 씬마다 다양한 카메라 샷을 강제로 추가하는 함수
 * 단독샷보다 두샷(Two-shot), 쓰리샷(Three-shot)을 적극 활용
 */
const ensureCameraShot = (prompt: string, sceneNumber: number, characterCount: number): string => {
  if (!prompt) return prompt;

  // 이미 카메라 샷이 명시되어 있는지 확인
  const hasCameraShot = /\b(two-shot|three-shot|over-the-shoulder|close-up|wide shot|medium shot|establishing shot|dutch angle|extreme close-up)\b/i.test(prompt);

  if (hasCameraShot) {
    return prompt; // 이미 카메라 샷이 있으면 그대로
  }

  // 캐릭터 수에 따른 카메라 샷 선택
  let cameraShots: string[] = [];

  if (characterCount >= 3) {
    // 3명 이상: Three-shot 우선
    cameraShots = [
      "Wide three-shot establishing the environment",
      "Over-the-shoulder three-shot with layered depth",
      "Medium-wide three-shot capturing full upper bodies",
      "Tracking three-shot following movement",
      "Dutch angle three-shot for tension",
      "Low-angle three-shot for dramatic emphasis"
    ];
  } else if (characterCount === 2) {
    // 2명: Two-shot 우선
    cameraShots = [
      "Wide two-shot showing full bodies",
      "Over-the-shoulder two-shot with depth",
      "Medium-wide two-shot capturing interaction",
      "Tracking two-shot following movement",
      "Low-angle two-shot for dramatic tension",
      "Dutch angle two-shot for emotional spike"
    ];
  } else {
    // 1명: 다양한 단독 샷 (하지만 비율을 낮춤)
    cameraShots = [
      "Wide establishing shot with full body",
      "Medium-wide shot with environment context",
      "Over-the-shoulder perspective",
      "Low angle shot for emphasis",
      "High angle shot for vulnerability",
      "Dutch angle close-up for tension"
    ];
  }

  // 씬 번호에 따라 순환하며 선택
  const selectedShot = cameraShots[sceneNumber % cameraShots.length];

  // 프롬프트 맨 앞에 카메라 샷 추가
  return `${selectedShot}, ${prompt}`.replace(/,\s*,/g, ', ').trim();
};

/**
 * 여러 명의 여성 캐릭터가 함께 등장하도록 보장하는 함수 (하이브리드 방식)
 * AI가 혼자만 등장시키는 경우 자동으로 여러 명 추가
 */
const enforceMultipleCharacters = (scenes: any[]): any[] => {
  if (!scenes || scenes.length === 0) return scenes;

  // 1. 현재 여러 명 등장 비율 계산
  const multiCount = scenes.filter(s =>
    s.characterIds && Array.isArray(s.characterIds) && s.characterIds.length >= 2
  ).length;

  const ratio = multiCount / scenes.length;

  // 2. 비율이 30% 미만이면 강제 수정
  if (ratio < 0.3) {
    console.log(`[Multiple Characters] 현재 비율: ${(ratio * 100).toFixed(1)}% → 30% 이상으로 강제 조정`);

    // 짝수 씬에 WomanB 추가 (인덱스 1, 3, 5, 7번 씬)
    const targetIndices = [1, 3, 5, 7].filter(idx => idx < scenes.length);

    targetIndices.forEach(idx => {
      const scene = scenes[idx];
      if (!scene || !scene.characterIds) return;

      const currentIds = scene.characterIds;

      // WomanA만 있으면 WomanB 추가
      if (currentIds.length === 1 && (currentIds[0] === 'WomanA' || /Slot Woman A/i.test(currentIds[0]) || currentIds[0] === 'A')) {
        scenes[idx].characterIds.push('WomanB');

        // Slot Woman B 설명
        const slotBDesc = `Slot Woman B — stunning Korean woman in her 40s [${CHARACTER_PRESETS.WOMAN_B.hair}, ${CHARACTER_PRESETS.WOMAN_B.body}], wearing a simple silver necklace, standing beside her with a curious expression`;

        // longPrompt에 Slot Woman B 추가
        if (scene.longPrompt) {
          // 마침표 앞에 추가
          scenes[idx].longPrompt = scene.longPrompt.replace(
            /(\. |\.(?=[A-Z]))/,
            `. ${slotBDesc}. `
          );

          // 마침표가 없으면 끝에 추가
          if (!scenes[idx].longPrompt.includes('Slot Woman B')) {
            scenes[idx].longPrompt += `. ${slotBDesc}`;
          }
        }

        // shortPrompt에도 추가
        if (scene.shortPrompt) {
          scenes[idx].shortPrompt = scene.shortPrompt.replace(
            /(Slot Woman A[^,]*),/i,
            '$1, and Slot Woman B,'
          );

          // 패턴이 없으면 끝에 추가
          if (!scenes[idx].shortPrompt.includes('Slot Woman B')) {
            scenes[idx].shortPrompt += ', with Slot Woman B';
          }
        }

        console.log(`[Multiple Characters] Scene ${idx + 1}에 WomanB 추가됨`);
      }
    });
  }

  return scenes;
};

type AgeTokens = {
  digits: string;
  korean: string;
  englishShort: string;
  englishLongHer: string;
  englishLongHis: string;
  englishLongTheir: string;
};

const extractAgeDigits = (age?: string): string => {
  if (!age) return "40";
  const match = age.match(/(\d{2})/);
  return match ? match[1] : "40";
};

const buildAgeTokens = (age?: string): AgeTokens => {
  const digits = extractAgeDigits(age);
  return {
    digits,
    korean: `${digits}대`,
    englishShort: `${digits}s`,
    englishLongHer: `in her ${digits}s`,
    englishLongHis: `in his ${digits}s`,
    englishLongTheir: `in their ${digits}s`,
  };
};

// 의상 랜덤 선택 함수
// 의상 랜덤 선택 함수 (UNIFIED_OUTFIT_LIST 사용)
// 의상 슬롯별 기본값 (랜덤 선택 실패 시 사용)
const DEFAULT_OUTFITS = {
  SLOT_A_MAIN: "Grey Checkered Jacket Mini Dress",
  SLOT_A_SUB: "Rose Pink Long-sleeve Crop Top + Black Sculpt Leggings",
  SLOT_B_MAIN: "Rose Pink Long-sleeve Crop Top + Black Sculpt Leggings",
  SLOT_B_SUB: "Grey Checkered Jacket Mini Dress",
  MALE: "White Oxford Shirt + Camel Coat + Navy Slacks"
};

const getOutfitPool = (): OutfitPoolItem[] =>
  buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]);

const isMaleOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.includes('MALE');

const isUnisexOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.includes('UNISEX');

const isCategoryMatch = (item: OutfitPoolItem, category: string): boolean =>
  item.categories.some(cat => cat.toLowerCase().includes(category.toLowerCase()));

// 의상 랜덤 선택 함수 (UNIFIED_OUTFIT_LIST + 저장 의상)
const pickRandomOutfit = (category?: string): string => {
  let candidates = getOutfitPool().filter(item => !isMaleOutfit(item));

  if (category) {
    const categoryMatches = candidates.filter(item => isCategoryMatch(item, category));
    if (categoryMatches.length > 0) {
      candidates = categoryMatches;
    }
  }

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  return selected ? selected.name : DEFAULT_OUTFITS.SLOT_A_MAIN;
};

const pickRandomMaleOutfit = (category?: string, exclude?: string): string => {
  let candidates = getOutfitPool().filter(item => isMaleOutfit(item) || isUnisexOutfit(item));

  if (category) {
    const categoryMatches = candidates.filter(item => isCategoryMatch(item, category));
    if (categoryMatches.length > 0) {
      candidates = categoryMatches;
    }
  }

  if (exclude) {
    const filtered = candidates.filter(item => item.name !== exclude);
    candidates = filtered.length > 0 ? filtered : candidates;
  }

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  return selected ? selected.name : (exclude || DEFAULT_OUTFITS.MALE);
};

// 프롬프트에서 의상 자리 표시자를 실제 의상으로 교체
const replaceOutfitPlaceholders = (prompt: string, outfits: { female?: string; male?: string; male2?: string }): string => {
  if (!prompt) return prompt;
  let updated = prompt;

  // {{LOCKED_FEMALE_OUTFIT}} 등을 실제 선택된 의상으로 교체
  if (outfits.female) {
    updated = updated.replace(/\{\{LOCKED_FEMALE_OUTFIT\}\}/g, outfits.female);
  }
  if (outfits.male) {
    updated = updated.replace(/\{\{LOCKED_MALE_OUTFIT\}\}/g, outfits.male);
  }
  if (outfits.male2) {
    updated = updated.replace(/\{\{LOCKED_MALE_OUTFIT2\}\}/g, outfits.male2);
  }

  return updated;
};

const personalizeEnginePrompt = (prompt: string, targetAge?: string, outfits?: { female?: string; male?: string; male2?: string }): string => {
  if (!prompt) return prompt;
  const tokens = buildAgeTokens(targetAge);
  let updated = prompt;

  // 의상 자리 표시자 교체
  if (outfits) {
    updated = replaceOutfitPlaceholders(updated, outfits);
  }

  // Replace hardcoded ages
  updated = updated.replace(/50대/g, tokens.korean);
  updated = updated.replace(/40대/g, tokens.korean);
  updated = updated.replace(/30대/g, tokens.korean);
  updated = updated.replace(/60대/g, tokens.korean);
  updated = updated.replace(/20대/g, tokens.korean);
  updated = updated.replace(/in\s+(her|his|their)\s+40s/gi, (_match, pronoun: string) => {
    const lower = pronoun.toLowerCase();
    if (lower === "his") return tokens.englishLongHis;
    if (lower === "their") return tokens.englishLongTheir;
    return tokens.englishLongHer;
  });
  updated = updated.replace(/\b40s\b/gi, tokens.englishShort);
  updated = updated.replace(/타[깃겟]\s*연령대/g, tokens.korean);
  updated = updated.replace(/in\s+their\s+target\s+age/gi, `in their ${tokens.englishShort}`);
  updated = updated.replace(/their\s+target\s+age/gi, `their ${tokens.englishShort}`);
  updated = updated.replace(/target\s+age\s*range/gi, `${tokens.englishShort} range`);
  updated = updated.replace(/\btarget\s+age\b/gi, tokens.englishShort);
  return updated;
};

// --- MAIN FUNCTION ---

// --- MAIN FUNCTION (WEB AUTOMATION VERSION) ---
export const generateStory = async (input: UserInput, signal?: AbortSignal, template?: StyleTemplate): Promise<StoryResponse> => {
  console.log("DEBUG: generateStory called");
  console.log("DEBUG: input.engineVersion:", input.engineVersion);
  console.log("DEBUG: input.customScript:", input.customScript ? "YES" : "NO");

  const forceScriptToImage = Boolean(input.customScript && input.customScript.trim().length > 0);
  const isEngineOff = !forceScriptToImage && input.engineVersion === 'NONE';
  const isV3Family = input.engineVersion === 'V3' || input.engineVersion === 'V3_COSTAR';
  const isCustomEngine = !isEngineOff && !isV3Family;
  const topicContext = (input.customContext || "").trim();
  let resolvedTopic = topicContext || "자유 주제";
  const ageTokens = buildAgeTokens(input.targetAge);
  const normalizedTargetAge = (input.targetAge && input.targetAge.trim()) ? input.targetAge.trim() : ageTokens.korean;
  let selectedEnginePrompt = "";

  // [NEW] Fetch prompt enhancement settings from server
  let enhancementSettings: NormalizedPromptEnhancementSettings = DEFAULT_PROMPT_ENHANCEMENT_SETTINGS;
  try {
    const settingsRes = await fetch('http://localhost:3002/api/prompt-enhancement-settings');
    if (settingsRes.ok) {
      const loaded = await settingsRes.json();
      enhancementSettings = normalizePromptEnhancementSettings(loaded);
      console.log("DEBUG: Loaded enhancement settings", enhancementSettings);
    }
  } catch (e) {
    console.warn("Failed to load enhancement settings, using defaults", e);
  }
  // Fetch template config from API instead of fs
  let templateConfig = { genres: [], tones: [] };
  try {
    const res = await fetch('http://localhost:3002/api/templates/config');
    if (res.ok) {
      templateConfig = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch template config:", e);
  }

  const genreInstruction = findTemplatePrompt(templateConfig.genres as any[], input.scenarioMode);

  // 랜덤 의상 선택
  const outfitContextText = normalizeTopicText(
    [resolvedTopic, input.customContext, input.customScript].filter(Boolean).join(' ')
  );
  const isGolfContext = outfitContextText.includes('골프') || outfitContextText.includes('golf');
  const selectedFemaleOutfit = pickRandomOutfit(isGolfContext ? 'golf' : undefined);
  const selectedMaleOutfit = pickRandomMaleOutfit(isGolfContext ? 'golf' : undefined);
  const selectedMaleOutfit2 = pickRandomMaleOutfit(isGolfContext ? 'golf' : undefined, selectedMaleOutfit);

  // [MODIFIED] Select system prompt based on engineVersion (OFF → empty)
  let systemPrompt = "";
  let selectedSherbetPrompt = "";
  if (!isEngineOff) {
    selectedEnginePrompt = resolveEnginePrompt(input.engineVersion);
    selectedEnginePrompt = personalizeEnginePrompt(selectedEnginePrompt, input.targetAge, {
      female: selectedFemaleOutfit,
      male: selectedMaleOutfit,
      male2: selectedMaleOutfit2
    });
    systemPrompt = selectedEnginePrompt;
    const preview = selectedEnginePrompt.slice(0, 200).replace(/\s+/g, ' ');
    console.log(`[Engine] Loaded system prompt for "${input.engineVersion}" (length=${selectedEnginePrompt.length}, preview="${preview}")`);
  }
  let userPrompt = "";
  const shouldApplyTemplate = Boolean(template);

  const templateGuidanceBlock = shouldApplyTemplate ? `
  [STYLE TEMPLATE GUIDANCE]
  Template Name: ${template.name}
  Structure: ${template.structure.join(' -> ')}
  Tone: ${template.tone}
  Hook Strategy: ${template.hookStrategy}
  Twist Style: ${template.twistStyle}
  ${template.hookTiming ? `Hook Timing: ${template.hookTiming}` : ''}
  ${template.lengthGuidance ? `Length: ${template.lengthGuidance}` : ''}
  ${template.dialogueRatio ? `Dialogue Ratio: ${template.dialogueRatio}` : ''}
  ${template.gagPattern ? `Gag / Twist Pattern: ${template.gagPattern}` : ''}
  ${template.ctaStyle ? `CTA / Ending: ${template.ctaStyle}` : ''}
  ${template.visualBeats && template.visualBeats.length ? `Visual Beats (use as rhythm, not literal props): ${template.visualBeats.join(' | ')}` : ''}
  ${template.mustHaveObjects && template.mustHaveObjects.length ? `Must-Have Objects (examples only—swap to fit the new topic): ${template.mustHaveObjects.join(', ')}` : ''}
  ${template.characterNotes ? `Character Notes: ${template.characterNotes}` : ''}
  ${template.imageNotes ? `Image Notes: ${template.imageNotes}` : ''}

  [VIRAL FORMULA APPLICATION (CRITICAL)]
  1. **Analyze the Formula**: Look at the 'Hook Strategy' and 'Gag Pattern' above. This is the "Viral DNA".
  2. **Apply to New Topic**: You must apply this *exact abstract logic* to the current Topic: ${resolvedTopic}.
  3. **NO COPYING**: Do NOT use the specific nouns from the template (e.g., if template says "Pepper", do NOT use Pepper unless it fits the new topic).
  4. **REPLICATE THE FEELING**: If the template creates "Sexual Tension -> Relief", your new script MUST create "Sexual Tension -> Relief" using the new topic's elements.

  ${input.useRegenerationGuidance ? `
  [재생성 규칙 - 대박 쇼츠 완전 분석 반영]
  1. 구조만 학습: [나레이션] 상황 설정 → [대화] 이중의미 대화 → [대화] 오해 증폭 → [반전] 진실 공개
  2. 오브젝트 100% 새로 창작: 원본 소재 절대 복사 금지. 골프 소재 반복 금지(골프채/퍼터/아이언/홀 등)
  3. 다양한 일상 소재 사용: 음식(커피믹스/맥주/과일), 의류(넥타이/벨트), 동물(소/말), 의료(편도선/딸꾹질), 일상(우산/열쇠/리모컨)
  4. 장소 다양화: 골프장만 고집 금지. 맞선집/회사 휴게실/비행기/과수원/학교/병원/카페/마트 등
  5. 이중의미 키워드 변형: 크기(크다/굵다/길다), 동작(넣다/빼다/따먹다/쓰다듬다), 상태(힘없다/익다/벌어지다)
  6. 나레이션: 과거형 스토리텔링("~했다", "~였지"). 대사: 10~16자, 8~12문장
  7. 반전: 마지막 1~2문장으로 진실 공개 (예: "그건 넥타이야", "맥주부터 마시고 한다잖아")
  8. 표현: ${normalizedTargetAge} 타겟, 언어유희·이중의미·성적 암시 OK / 직접적·노골적 표현 NO
  ` : ''}
  Follow this guidance carefully while keeping all mandatory rules above.
  ` : '';

  // [NEW] CLAUDE MINIMAL MODE (Token Saving)
  // [MODIFIED] CLAUDE now uses V3 Logic (Unified)

  // Apply age and outfit personalization to user prompt as well
  userPrompt = personalizeEnginePrompt(userPrompt, input.targetAge, {
    female: selectedFemaleOutfit,
    male: selectedMaleOutfit,
    male2: selectedMaleOutfit2
  });

  // === SCRIPT-TO-IMAGE MODE ===
  if (isEngineOff) {
    const offPromptLines = [
      `Topic: ${resolvedTopic}`,
      `Outfit Style: ${input.category || "0. 선택안함"}`,
      `Target Age: ${input.targetAge || "40s"}`,
      `Context: ${topicContext || "None"}`
    ];
    if (input.customScript && input.customScript.trim().length > 0) {
      offPromptLines.push("[CUSTOM SCRIPT]\\n" + input.customScript.trim());
    }
    if (genreInstruction) {
      offPromptLines.push("Genre Instructions:");
      offPromptLines.push(genreInstruction);
    }
    if (topicContext) {
      offPromptLines.push("Additional Context:");
      offPromptLines.push(topicContext);
    }
    userPrompt = offPromptLines.join("\\n");
  } else if (input.customScript && input.customScript.trim().length > 0) {
    console.log("DEBUG: Entered Custom Script Block (NEW 2-STEP LOGIC)");

    // ===== 새로운 2단계 생성 로직 =====
    // 1단계: 대본에서 캐릭터 추출
    // 2단계: 캐릭터 슬롯 매핑 + 씬 분해 + 이미지 프롬프트 생성

    try {
      const customScript = input.customScript.trim();

      // 스크립트에서 대사 라인 추출 (빈 줄 제거)
      const scriptLines = customScript
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (scriptLines.length === 0) {
        throw new Error("스크립트에서 대사 라인을 추출할 수 없습니다.");
      }

      console.log(`📝 대본 라인 수: ${scriptLines.length}`);

      // 기본 성별 결정 (input에서 가져오거나 기본값 사용)
      const defaultGender: 'female' | 'male' = 'female';

      // ===== 1단계: AI 캐릭터 추출 =====
      console.log("🔍 1단계: AI 캐릭터 추출 중...");
      const characterExtractPrompt = buildCharacterExtractionPrompt({
        scriptLines,
        defaultGender
      });

      const characterResponse = await fetch('http://localhost:3002/api/generate/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: input.targetService || 'GEMINI',
          prompt: characterExtractPrompt,
          maxTokens: 1200,
          temperature: 0.2,
          skipFolderCreation: true  // 캐릭터 추출 시에는 폴더 생성 건너뛰기
        }),
        signal
      });

      if (!characterResponse.ok) {
        throw new Error("캐릭터 추출 API 호출 실패");
      }

      const characterData = await characterResponse.json();
      const characterRaw = characterData.rawResponse || characterData.text || characterData.result || '';
      const characterResult = parseCharacterExtractionResponse(characterRaw);
      console.log(`✅ 추출된 캐릭터 수: ${characterResult.characters.length}`);

      // 첫 번째 API에서 생성된 폴더명 저장 (있으면)
      let scriptFolderName = characterData._folderName || '';

      // ===== 캐릭터 → 슬롯 매핑 =====
      const femaleSlots = ['WomanA', 'WomanB', 'WomanC'];
      const maleSlots = ['ManA', 'ManB', 'ManC'];
      let femaleIdx = 0;
      let maleIdx = 0;

      const characterSlotMap: Record<string, string> = {};
      const mappedCharacters: Array<{ id: string; name?: string; slotLabel?: string }> = [];

      for (const char of characterResult.characters) {
        let slotId = '';
        if (char.gender === 'female' || (char.gender === 'unknown' && defaultGender === 'female')) {
          if (femaleIdx < femaleSlots.length) {
            slotId = femaleSlots[femaleIdx++];
          }
        } else if (char.gender === 'male' || (char.gender === 'unknown' && defaultGender === 'male')) {
          if (maleIdx < maleSlots.length) {
            slotId = maleSlots[maleIdx++];
          }
        }

        if (slotId) {
          characterSlotMap[char.name] = slotId;
          mappedCharacters.push({
            id: slotId,
            name: char.name,
            slotLabel: slotId
          });
        }
      }

      console.log("📌 캐릭터 슬롯 매핑:", characterSlotMap);

      // ===== 2단계: 씬 분해 + 이미지 프롬프트 생성 =====
      console.log("🎬 2단계: 씬 분해 및 이미지 프롬프트 생성 중...");
      const sceneDecompPrompt = buildManualSceneDecompositionPrompt({
        scriptLines,
        characters: mappedCharacters
      });

      const sceneResponse = await fetch('http://localhost:3002/api/generate/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: input.targetService || 'GEMINI',
          prompt: sceneDecompPrompt,
          maxTokens: 4000,
          temperature: 0.3,
          folderName: scriptFolderName || undefined,  // 첫 번째 폴더 재사용
          skipFolderCreation: true  // 씬 분해 시에도 폴더 생성 건너뛰기 (마지막에 생성)
        }),
        signal
      });

      if (!sceneResponse.ok) {
        throw new Error("씬 분해 API 호출 실패");
      }

      const sceneData = await sceneResponse.json();
      const sceneRaw = sceneData.rawResponse || sceneData.text || sceneData.result || '';
      const sceneResult = parseManualSceneDecompositionResponse(sceneRaw);
      console.log(`✅ 분해된 씬 수: ${sceneResult.scenes.length}`);

      // 폴더명 업데이트 (있으면)
      if (sceneData._folderName) {
        scriptFolderName = sceneData._folderName;
      }

      // ===== 결과를 StoryResponse 형식으로 변환 =====
      const qualitySuffix = ", Volumetric lighting, Rim light, Detailed skin texture, 8k uhd, High fashion photography, masterpiece, depth of field --ar 9:16 --style raw --stylize 250";
      const userContext = topicContext || "";

      // 의상 생성
      const isChatGPT = input.targetService === 'CHATGPT';
      const v3Vars = isChatGPT ? generateSafeV3Variables(input.category) : generateV3Variables(input.category);
      if (input.lockedFemaleOutfit?.trim()) {
        v3Vars.items.A = input.lockedFemaleOutfit.trim();
      }

      // characters 배열 생성
      const outputCharacters = mappedCharacters.map(char => {
        const slotKey = char.id.replace('Woman', '').replace('Man', '') as 'A' | 'B' | 'C';
        const isWoman = char.id.startsWith('Woman');
        const preset = isWoman
          ? CHARACTER_PRESETS[`WOMAN_${slotKey}` as keyof typeof CHARACTER_PRESETS]
          : CHARACTER_PRESETS[`MAN_${slotKey}` as keyof typeof CHARACTER_PRESETS];

        return {
          id: char.id,
          name: char.name || preset?.name || char.id,
          role: preset?.role || 'supporting',
          outfit: isWoman ? v3Vars.items[slotKey] || v3Vars.items.A : pickMaleOutfitForContext(userContext),
          hair: preset?.hair || 'natural hair',
          gender: isWoman ? 'FEMALE' : 'MALE'
        };
      });

      // scenes 배열 생성 및 후처리
      const outputScenes = sceneResult.scenes.map((scene, index) => {
        let longPrompt = scene.longPrompt || scene.summary || '';
        let shortPrompt = scene.shortPrompt || scene.summary || '';

        // 씬 번호 추가
        const scenePrefix = `Scene ${scene.sceneNumber}. `;
        if (!longPrompt.startsWith(`Scene ${scene.sceneNumber}`)) {
          longPrompt = scenePrefix + longPrompt.replace(/^Scene \d+\.\s*/i, '');
        }
        if (!shortPrompt.startsWith(`Scene ${scene.sceneNumber}`)) {
          shortPrompt = scenePrefix + shortPrompt.replace(/^Scene \d+\.\s*/i, '');
        }

        // Safe Glamour 적용
        longPrompt = enhancePromptWithSafeGlamour(longPrompt, userContext, enhancementSettings);
        shortPrompt = enhancePromptWithSafeGlamour(shortPrompt, userContext, enhancementSettings);

        // 표정/동작/악세서리 추가
        longPrompt = ensureDynamicExpression(longPrompt, index);
        shortPrompt = ensureDynamicExpression(shortPrompt, index);
        longPrompt = ensureDynamicAction(longPrompt, index);
        shortPrompt = ensureDynamicAction(shortPrompt, index);

        const characterIds = scene.characterIds || [];
        const hasFemaleCharacter = characterIds.some((id: string) =>
          id.startsWith('Woman') || id === 'A' || id === 'B' || id === 'C'
        );

        if (hasFemaleCharacter) {
          const mainCharacterId = characterIds.find((id: string) =>
            id.startsWith('Woman') || id === 'A' || id === 'B' || id === 'C'
          ) || 'A';
          longPrompt = ensureAccessory(longPrompt, mainCharacterId);
          shortPrompt = ensureAccessory(shortPrompt, mainCharacterId);
        }

        // 카메라 샷 추가
        longPrompt = ensureCameraShot(longPrompt, index, characterIds.length);
        shortPrompt = ensureCameraShot(shortPrompt, index, characterIds.length);

        // 중복 태그 제거
        const tagsToRemove = [
          "photorealistic", "8k resolution", "cinematic lighting", "masterpiece",
          "professional photography", "depth of field", "--ar 9:16", "--style raw",
          "detailed texture", "magazine cover quality", "hyper-realistic"
        ];

        const cleanPrompt = (text: string) => {
          let cleaned = text;
          tagsToRemove.forEach(tag => {
            const regex = new RegExp(tag.replace(/[-\/^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            cleaned = cleaned.replace(regex, "");
          });
          return cleaned.replace(/,\s*,/g, ",").trim().replace(/,$/, "");
        };

        longPrompt = ensureAgeMention(cleanPrompt(longPrompt), input.targetAge) + qualitySuffix;
        shortPrompt = ensureAgeMention(cleanPrompt(shortPrompt), input.targetAge) + qualitySuffix;

        return {
          sceneNumber: scene.sceneNumber,
          characterIds: scene.characterIds || [],
          shortPrompt,
          longPrompt,
          shortPromptKo: scene.scriptLine || '',
          longPromptKo: scene.scriptLine || '',
          soraPrompt: longPrompt,
          soraPromptKo: scene.scriptLine || ''
        };
      });

      // 제목 추출 (첫 번째 라인 또는 AI가 생성한 제목 사용)
      const title = sceneResult.title || scriptLines[0].substring(0, 30) + '...';

      // 마지막 라인을 punchline으로 사용
      const punchline = enforcePunchlineFormat(scriptLines[scriptLines.length - 1] || '');

      // 폴더 생성
      let folderName: string | undefined = undefined;
      try {
        const folderResponse = await fetch('http://localhost:3002/api/create-story-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        });
        const folderResult = await folderResponse.json();
        if (folderResult.success && folderResult.folderName) {
          folderName = folderResult.folderName;
          console.log(`✅ Story folder created: ${folderName}`);
        }
      } catch (error) {
        console.warn('Failed to create story folder, will use fallback:', error);
      }

      console.log("✅ 2단계 생성 완료!");

      return {
        title,
        titleOptions: [title],
        scriptBody: customScript,
        punchline,
        characters: outputCharacters,
        scenes: outputScenes,
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString().slice(2),
        createdAt: Date.now(),
        service: input.targetService || 'GEMINI',
        _folderName: folderName,
      };
    } catch (error) {
      console.error("Script-to-Image Generation Error (2-Step):", error);
      throw error;
    }
  } else if (isV3Family || isCustomEngine) {
    // Check for ChatGPT (Safety Bypass) - declare early for scope
    const isChatGPT = input.targetService === 'CHATGPT';

    if (isEngineOff) {
      systemPrompt = "";
    } else if (isCustomEngine) {
      // [NEW] Generate age tokens for custom engines (e.g., Sherbet engines)
      const customAgeTokens = buildAgeTokens(input.targetAge);

      // [NEW] Replace placeholders in custom engine prompt with actual age values
      systemPrompt = selectedEnginePrompt
        .replace(/\{\{TARGET_AGE\}\}/g, customAgeTokens.korean)
        .replace(/\{\{TARGET_AGE_EN\}\}/g, customAgeTokens.englishShort);

      console.log(`[Engine] Custom engine "${input.engineVersion}" selected with age: ${customAgeTokens.korean}`);
    } else if (input.useViralMode && input.scenarioMode === ScenarioMode.DOUBLE_ENTENDRE) {
      systemPrompt = SYSTEM_PROMPT_VIRAL;
      console.log("🔥 VIRAL MODE ACTIVATED - Using SYSTEM_PROMPT_VIRAL");
    } else if (isChatGPT) {
      systemPrompt = SYSTEM_PROMPT_CHATGPT;
    } else if (input.targetService === 'CLAUDE') {
      systemPrompt = SYSTEM_PROMPT_CLAUDE; // Uses the new 6-scene token-saving prompt
    } else {
      systemPrompt = selectedEnginePrompt;
    }

    const v3Vars = isChatGPT ? generateSafeV3Variables(input.category) : generateV3Variables(input.category);

    if (input.lockedFemaleOutfit?.trim()) {
      v3Vars.items.A = input.lockedFemaleOutfit.trim();
    }
    // [REMOVED] Sherbet outfit lock logic

    // Customize Prompt for ChatGPT
    let safeTopic: string = resolvedTopic;
    if (isChatGPT && (safeTopic.includes("헌팅") || safeTopic.includes("꼬시기"))) {
      // Force "Option A" strategy to bypass negotiation
      safeTopic = "Topic: Social Popularity Satire (Option A). Situation: Funny rivalry where the next team keeps showing interest. Mood: High-fashion. Ending: Twist.";
    }

    // --- Dynamic Character Logic ---
    let lockedOutfitReminder = "";
    let promptInstructions = "";

    const imageTemplate = `
  [IMAGE PROMPT RULES]
  - Create High - End Luxury Visuals.
    - Use "8k resolution, photorealistic, cinematic lighting".
    - Focus on the emotions and the twist.
    - Absolutely NO visible text, captions, signage, subtitles, or written overlays inside the scene.
    `;

    const context = topicContext;
    // Force male outfit to context-based default; do not randomize
    let maleOutfit = pickMaleOutfitForContext(context);
    if (input.targetService === 'CLAUDE' && input.lockedMaleOutfit?.trim()) {
      // Claude 경로에서만 명시 입력값을 허용하고, 없으면 기본값 사용
      maleOutfit = input.lockedMaleOutfit.trim();
    }

    console.log("DEBUG: Engine Version:", input.engineVersion);
    console.log("DEBUG: Male Outfit Selected:", maleOutfit);

    const backgroundInstruction = `
    [BACKGROUND & CAMERA CONSISTENCY]
    - Location Anchor: ${context ? context : 'High-end private golf course on a weekday afternoon'}.
    - Keep scenes 1~5 in the SAME location and lighting. Change only the camera distance and character actions.
    - Scene Camera Plan:
      Scene 1: Push-in close-up (breath + hook)
      Scene 2: Shoulder-level tracking shot (distance closing)
      Scene 3: Dutch-angle half body (tension spike)
      Scene 4: Extreme close-up on hands/faces (misdirection)
      Scene 5: Wide shot hinting the reveal
      Scene 6: Zoom-out master shot revealing the innocent truth.
    - Do NOT teleport the background each scene. Only Scene 6 may expand/zoom out for the punchline reveal.
    `;

    const storyFocusBlock = `
    [GENRE TEMPLATE MODE]
    - Topic: ${resolvedTopic}
    - Ignore Scenario presets. Follow ONLY the Style Template guidance above plus the outfit/visual rules here.
    - Build a viral short-form script with original props, dialogue, and a strong comedic twist.
    - Keep narration heavy (80%) and insert dialogue only at emotional spikes.
    `;

    // [DYNAMIC LOCKED OUTFIT REMINDER - FIXED]
    // We must explicitly define which outfit belongs to which character role for consistency across the story.
    // This ensures ChatGPT gets the "LOCKED VARIABLES" it demands.

    let outfitA = v3Vars.items.A; // Female default
    let outfitB = maleOutfit;     // Male default (context-based, not randomized)
    const isSherbet = false; // [REMOVED] Sherbet engine support

    const sherbetSubGuide = "Auto-select a non-overlapping classy/golf-inspired outfit; keep it fixed across scenes. Do NOT list catalogs.";
    const sherbetMaleGuide = "If a male appears, use a simple navy/white golf look different from the main outfit; if no male appears, explicitly include 'No male characters appear in this scene.'";

    lockedOutfitReminder = `
  [CHARACTER STYLE GUIDE]
  Select outfits for each character that are distinct and consistent across all scenes.

  [${CHARACTER_PRESETS.WOMAN_A.name} (Slot WomanA)]
  Outfit: Select from available female outfit list (consistent across all scenes)
  Hair: ${CHARACTER_PRESETS.WOMAN_A.hair}
  Body: ${CHARACTER_PRESETS.WOMAN_A.body}

  [${CHARACTER_PRESETS.MAN_A.name} (Slot ManA)]
  Outfit: Select from available male outfit list (consistent across all scenes)
  Hair: ${CHARACTER_PRESETS.MAN_A.hair}
  Body: ${CHARACTER_PRESETS.MAN_A.body}

  [${CHARACTER_PRESETS.WOMAN_C.name} (Character C)]
  Outfit: Select from available female outfit list, different from WomanA (consistent across all scenes)
  Hair: ${CHARACTER_PRESETS.WOMAN_C.hair} (사용 시 고정)
  `;


    promptInstructions = `
    ${storyFocusBlock}
    ${imageTemplate}
    [MULTI-CHARACTER VISUAL DIVERSITY]
    - When two or more Korean women appear, assign each one a unique Korean name, distinct hairstyle, and distinct outfit silhouette.
    - Never describe two different women with identical clothes, hair, or accessories. 혜진(A)는 긴 웨이브 헤어, 수아(B)는 짧은 보브컷, 민지(C)는 로우 포니테일을 유지하며 서로 다른 색/실루엣의 의상을 입혀라.
    - Reference the locked outfits (Character A / Character B / Character C) and map them consistently to the same person in all scenes.
    - Make sure the narration/image prompts clearly identify which woman is performing which action so viewers can track them.
    ${backgroundInstruction}
    [DYNAMIC POSE & EXPRESSION INJECTION]
    - **AVOID STATIC POSES**. No "Standing still" or "Looking at camera".
    - **Scene 1-5 (Tension)**:
      - **Expressions**: Biting lips, Furrowed brows, Wide eyes, Sweating, Flustered, Intense focus.
      - **Actions**: Pulling hard, Pushing with body weight, Wiping sweat, Hands shaking, Grasping tightly.
      - **Angles**: Dutch Angle, Extreme Close-up on hands/face, Over-the-shoulder.
    - **Scene 6 (Relief)**:
      - **Expressions**: Sighing in relief, Laughing, Wiping forehead.
      - **Actions**: Slumping in chair, Holding the object loosely.

    [VISUAL MISDIRECTION RULE (CRITICAL)]
    - **Scene 1-5 (The Lie)**: VISUALIZE THE MISUNDERSTANDING. Do NOT show the actual object. Show the characters' expressions (flustered, sweating, shocked) and obscured actions. Make it look like a "Drama" or "Tension" scene.
    - **Scene 6 (The Truth)**: ZOOM OUT and REVEAL the actual object clearly. This is the visual punchline.
  `;

    userPrompt = `
  Topic: ${resolvedTopic}
      Outfit Style: ${input.category || "0. 선택안함"}
      Target Age: ${input.targetAge || "40s"}

  ${promptInstructions}

  ${templateGuidanceBlock}

  ${lockedOutfitReminder}

  [FEMALE OUTFIT RULES - CRITICAL]
  - All FEMALE visuals must use ULTRA-TIGHT + MINI / MICRO length silhouettes (crop tops, micro/mini skirts, micro shorts, bodycon mini dresses, or tight-fitting leggings/yoga pants).
  - Absolutely NO slacks, trousers, loose pants, or baggy bottoms for women. Tight-fitting leggings are allowed as an exception.
  - Keep outfits glamorous, high-fashion, and form-fitting to emphasize curves.

  [CHARACTER ID MAP - MUST OUTPUT]
  - Characters array with stable IDs and outfits:
    - {"id":"${CHARACTER_PRESETS.WOMAN_A.id}","name":"${CHARACTER_PRESETS.WOMAN_A.name}","role":"${CHARACTER_PRESETS.WOMAN_A.role}","outfit":"${outfitA}","hair":"${CHARACTER_PRESETS.WOMAN_A.hair}","gender":"FEMALE"}
    - {"id":"B","name":"Male Lead","role":"Male Lead","outfit":"${outfitB}","hair":"${MALE_DEFAULT_HAIR}","gender":"MALE"}
    - {"id":"${CHARACTER_PRESETS.WOMAN_C.id}","name":"${CHARACTER_PRESETS.WOMAN_C.name}","role":"${CHARACTER_PRESETS.WOMAN_C.role}","outfit":"${v3Vars.items.C}","hair":"${CHARACTER_PRESETS.WOMAN_C.hair}","gender":"FEMALE"}
  - Every scene MUST include "characterIds": ["A"] or ["A","B"] referencing this map. Do NOT swap outfits between characters.

  [SCRIPT TASK (CRITICAL)]
  - Produce "scriptBody" as pure Korean narration/dialogue lines separated by "\\n".
  - Provide exactly 3 impactful alternative titles in "titleOptions" and select the strongest one for "title".
  - Language: 100% Korean, natural spoken tone for ${normalizedTargetAge}.
  - Structure: Follow the Style Template beats (Hook → Build → Twist) but DO NOT label them.
  - Length: 12~15 sentences total, narration-heavy (약 80%) with only 2~3 dialogue punches.
  - Content Inputs: Use ONLY the Topic (${resolvedTopic}), Outfit Style (${input.category || '0. 선택안함'}), and any user-provided context. Ignore Scenario Modes entirely.
  - Never mention outfit names/colors in the scriptBody. Focus on emotions, conflict, and twist resolution.
  - scriptBody, punchline, scriptLine에는 쌍따옴표(")를 사용하지 마세요. 대사는 작은따옴표(') 또는 괄호로 표기하고 순수 텍스트로 구어체 톤을 유지하세요.

  [OUTPUT JSON RULES]
  - Must return valid JSON (no markdown).
  - Required keys:
    - "title": Single best Hook line in Korean.
    - "titleOptions": 3 alternative Korean hook lines.
    - "scriptBody": Korean script text separated by "\\n" containing the narration/dialogue above.
    - "punchline": Final killer line in Korean.
    - "characters": [ ...as listed in the Character ID Map ... ].
    - "scenes": exactly 8 objects, each with: sceneNumber, characterIds, shortPrompt, shortPromptKo, longPrompt, longPromptKo, soraPrompt, soraPromptKo.
  - If you cannot provide characters + characterIds for all scenes, DO NOT answer with a story; instead return { "error": "missing characterIds" }.
  - Keep scene prompts concise but include the locked outfits verbatim and the character IDs.
  - Enforce the FEMALE OUTFIT RULES above in every scene (no slacks for women; use ultra-tight mini/micro silhouettes).

  [IMPORTANT]
      For EVERY image prompt(short and long), you MUST append these quality tags at the end:
  ", photorealistic, 8k resolution, cinematic lighting, detailed texture, masterpiece, professional fashion photography, depth of field"

      For the script, do not include[Hook], [Flow] tags, just the text lines.
      ** Script Direction(CRITICAL - MUST FOLLOW) **:
      - ** Narration 80 %, Dialogue 20 % (Critical Moments Only)**
      - ** NARRATION STYLE: "Storytelling Mode"(NOT Summary) **
    - Describe actions, expressions, and atmosphere like a novel.
        - Example: "김여사는 선글라스를 끼고 거만하게 앉아 있었다."(O)
    - AVOID: "김여사가 골프를 쳤다."(X - Too dry)
      - ** DIALOGUE STYLE: "Punchline Only" **
        - Use dialogue ONLY for conflict peaks and punchlines.
        - Max 2 - 3 dialogue lines per script.
        - Example: "내가 누군지 알아?" / "지게차로 옮겨야겠네."
    - Follow the Style Template guidance above as the ONLY structural reference.
      - Keep it short, punchy, and entertaining(Shorts style).
    `;

  } else {
    // === V2 LOGIC ===
    const isGolfCategory = input.category.includes("골프");
    const mainStyle = isGolfCategory ? (Math.random() < 0.7 ? 'GOLF' : pickWeightedStyle()) : pickWeightedStyle();
    const mainCostume = generateCostumeV2(mainStyle);
    const mainTraits = generateCharacterTraits();

    let subStyle: StyleCategory;
    do {
      subStyle = pickWeightedStyle();
    } while (subStyle === mainStyle && Math.random() > 0.2);

    const subCostume = generateCostumeV2(subStyle);
    const subTraits = generateCharacterTraits();

    userPrompt = `
  Topic: ${input.category}
      Spice Level: ${input.scenarioMode}
  Dialect: ${input.dialect}
      Additional Context: ${input.customContext || "None"}
      
      ==========================================================
  [LOCKED CHARACTER TRAITS](DO NOT CHANGE)
    ==========================================================
      ** MAIN CHARACTER(Protagonist) **:
  - Identity: Korean Woman
    - Physical: ${mainTraits}
  - COSTUME: ${mainCostume.description} (${mainCostume.style} Style)

      ** SUB CHARACTER(Friend / Rival / Caddy) **:
  - Identity: Korean Woman
    - Physical: ${subTraits}
  - COSTUME: ${subCostume.description} (${subCostume.style} Style)

  IMPORTANT: You MUST use these EXACT costume and physical descriptions in every single image prompt(Scene 1 to 6).
    `;
  }

  // Combine System + User Prompt for the Chat Interface
  const fullPrompt = `
    ${systemPrompt}

  ---

    ${userPrompt}

  IMPORTANT: Respond ONLY with the valid JSON. No markdown, no explanations.
  
  [CRITICAL JSON FORMATTING RULES]
  1. You MUST use double quotes (") for ALL JSON keys and string values.
  2. DO NOT use single quotes (') for JSON keys or values.
  3. For emphasis or quotes INSIDE string values, use escaped double quotes (\") or Korean quotes (「」).
  
  Examples:
  ✅ CORRECT: {"title": "내 \"홀인원\"은..."}
  ✅ CORRECT: {"title": "내 '홀인원'은..."} (single quotes inside string are OK)
  ❌ WRONG: {'title': '크리스마스'} (single quotes for keys/values)
  ❌ WRONG: {"title": "내 "홀인원"은..."} (unescaped double quotes inside)
  `;

  console.log("DEBUG: Full Prompt Generated:\n", fullPrompt);

  try {
    // Call Local Backend (Puppeteer)
    const response = await fetch('http://localhost:3002/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: input.targetService || 'GEMINI',
        prompt: fullPrompt
      }),
      signal
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate story via automation.");
    }

    const parsed = await response.json();
    if (parsed && typeof parsed.punchline === 'string') {
      parsed.punchline = enforcePunchlineFormat(parsed.punchline);
    }

    // [FIX] Universal Quality Tag Enforcement for Main Story Generation
    // Matches the logic used in Script-to-Image mode
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      // [ENHANCED] Richer Quality Tags for "Bold Glamour"
      const qualitySuffix = ", Volumetric lighting, Rim light, Detailed skin texture, 8k uhd, High fashion photography, masterpiece, depth of field --ar 9:16 --style raw --stylize 250";
      const userContext = topicContext || "";

      // [NEW] 0. 여러 명 등장 보장 (씬 처리 전에 먼저 실행)
      parsed.scenes = enforceMultipleCharacters(parsed.scenes);

      parsed.scenes.forEach((scene: any, index: number) => {
        // 1. Apply Unified Safe Glamour Logic with Settings
        if (scene.shortPrompt) scene.shortPrompt = enhancePromptWithSafeGlamour(scene.shortPrompt, userContext, enhancementSettings);
        if (scene.longPrompt) scene.longPrompt = enhancePromptWithSafeGlamour(scene.longPrompt, userContext, enhancementSettings);

        // [NEW] 2. 표정 강제 추가 (씬마다 다른 표정)
        if (scene.longPrompt) {
          scene.longPrompt = ensureDynamicExpression(scene.longPrompt, index);
        }
        if (scene.shortPrompt) {
          scene.shortPrompt = ensureDynamicExpression(scene.shortPrompt, index);
        }

        // [NEW] 3. 동작 강제 추가 (씬마다 다른 동작)
        if (scene.longPrompt) {
          scene.longPrompt = ensureDynamicAction(scene.longPrompt, index);
        }
        if (scene.shortPrompt) {
          scene.shortPrompt = ensureDynamicAction(scene.shortPrompt, index);
        }

        // [NEW] 4. 악세서리 강제 추가 (여성 캐릭터만)
        const characterIds = scene.characterIds || [];
        const hasFemaleCharacter = characterIds.some((id: string) =>
          id === 'A' || id === 'B' || id === 'C' || /Slot [ABC]/i.test(id)
        );

        if (hasFemaleCharacter) {
          const mainCharacterId = characterIds.find((id: string) =>
            id === 'A' || id === 'B' || id === 'C' || /Slot [ABC]/i.test(id)
          ) || 'A';

          if (scene.longPrompt) {
            scene.longPrompt = ensureAccessory(scene.longPrompt, mainCharacterId);
          }
          if (scene.shortPrompt) {
            scene.shortPrompt = ensureAccessory(scene.shortPrompt, mainCharacterId);
          }
        }

        // [NEW] 5. 카메라 샷 강제 추가 (Two-shot, Three-shot 우선)
        const characterCount = characterIds.length;
        if (scene.longPrompt) {
          scene.longPrompt = ensureCameraShot(scene.longPrompt, index, characterCount);
        }
        if (scene.shortPrompt) {
          scene.shortPrompt = ensureCameraShot(scene.shortPrompt, index, characterCount);
        }

        // 6. Enforce Aspect Ratio and Quality Tags (DEDUPLICATED)
        const tagsToRemove = [
          "photorealistic", "8k resolution", "cinematic lighting", "masterpiece",
          "professional photography", "depth of field", "--ar 9:16", "--style raw",
          "detailed texture", "magazine cover quality", "hyper-realistic"
        ];

        const cleanPrompt = (text: string) => {
          let cleaned = text;
          tagsToRemove.forEach(tag => {
            const regex = new RegExp(tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            cleaned = cleaned.replace(regex, "");
          });
          return cleaned.split(',').map(s => s.trim()).filter(s => s.length > 0).join(', ');
        };

        if (scene.longPrompt) {
          scene.longPrompt = ensureAgeMention(cleanPrompt(scene.longPrompt), input.targetAge) + qualitySuffix;
        }
        if (scene.shortPrompt) {
          scene.shortPrompt = ensureAgeMention(cleanPrompt(scene.shortPrompt), input.targetAge) + qualitySuffix;
        }
      });
    }

    // ✅ FIX: 대본 생성 시 폴더 생성 API 호출하여 _folderName 설정
    let folderName: string | undefined = undefined;
    if (parsed.title) {
      try {
        const folderResponse = await fetch('http://localhost:3002/api/create-story-folder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: parsed.title })
        });
        const folderResult = await folderResponse.json();
        if (folderResult.success && folderResult.folderName) {
          folderName = folderResult.folderName;
          console.log(`✅ Story folder created: ${folderName}`);
        }
      } catch (error) {
        console.warn('Failed to create story folder, will use fallback:', error);
      }
    }

    return {
      ...parsed,
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString().slice(2),
      createdAt: Date.now(),
      service: input.targetService || 'GEMINI',
      _folderName: folderName,
    };
  } catch (error) {
    console.error("Automation Generation Error:", error);
    throw error;
  }
};

/**
 * 현재 설정으로 생성될 프롬프트를 미리보기 위한 함수
 * API 호출 없이 프롬프트 문자열만 반환합니다.
 */
export const previewPrompt = async (input: UserInput): Promise<string> => {
  await ensureEngineConfigLoaded();

  const isV3Family = input.engineVersion === 'V3' || input.engineVersion === 'V3_COSTAR';
  const isCustomEngine = !['V3', 'V3_COSTAR', 'NONE'].includes(input.engineVersion);
  const isEngineOff = input.engineVersion === 'NONE';

  // 1. Script-to-Image Mode
  if (input.customScript) {
    const resolvedTopic = input.category || "General";
    const normalizedTargetAge = input.targetAge || "40s";

    const isChatGPT = input.targetService === 'CHATGPT';
    const v3Vars = isChatGPT ? generateSafeV3Variables(input.category) : generateV3Variables(input.category);

    if (input.lockedFemaleOutfit?.trim()) {
      v3Vars.items.A = input.lockedFemaleOutfit.trim();
    }

    let systemPrompt = SYSTEM_PROMPT_V3; // Default fallback
    if (isCustomEngine) {

      const engine = getEngineConfig(input.engineVersion);
      if (engine) {
        systemPrompt = engine.prompt;
        const customAgeTokens = buildAgeTokens(input.targetAge);
        systemPrompt = systemPrompt
          .replace(/\{\{TARGET_AGE\}\}/g, customAgeTokens.korean)
          .replace(/\{\{TARGET_AGE_EN\}\}/g, customAgeTokens.englishShort);
      }
    } else if (input.engineVersion === 'V3_COSTAR') {
      systemPrompt = SYSTEM_PROMPT_V3_COSTAR;
    } else if (input.targetService === 'CHATGPT') {
      systemPrompt = SYSTEM_PROMPT_CHATGPT;
    } else if (input.targetService === 'CLAUDE') {
      systemPrompt = SYSTEM_PROMPT_CLAUDE;
    }

    if (SHERBET_ENGINE_IDS.has(input.engineVersion)) {
      systemPrompt = injectSherbetOutfitLock(
        stripSherbetOutfitCatalog(systemPrompt),
        v3Vars.items.A
      );
    }

    const outfitA = v3Vars.items.A;

    const userPrompt = `
  [TASK]
  Generate a YouTube Shorts script and image prompts.

  **Context**:
  - Topic: ${resolvedTopic}
  - Target Age: ${normalizedTargetAge}
  - Main Character Outfit (Slot A): ${outfitA}

  **Instructions**:
  Follow ALL rules defined in the system prompt above.

  **Output Format**:
  {
    "title": "Extract or create a catchy title from the script",
    "titleOptions": ["Impact title option 1", "Impact title option 2", "Impact title option 3"],
    "scriptBody": "${input.customScript.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
    "punchline": "Extract the punchline or key twist from the script",
    "characters": [
      {"id": "${CHARACTER_PRESETS.WOMAN_A.id}", "name": "${CHARACTER_PRESETS.WOMAN_A.name}", "role": "${CHARACTER_PRESETS.WOMAN_A.role}", "outfit": "${outfitA}", "hair": "${CHARACTER_PRESETS.WOMAN_A.hair}", "gender": "FEMALE"}
    ],
    "scenes": [
      {
        "sceneNumber": 1,
        "characterIds": ["A"],
        "shortPrompt": "...",
        "longPrompt": "...",
        "soraPrompt": "...",
        "soraPromptKo": "...",
        "shortPromptKo": "...",
        "longPromptKo": "..."
      }
    ]
  }
`;
    return systemPrompt + "\n\n" + userPrompt;
  }

  // 2. Story Mode
  else if (isV3Family || isCustomEngine) {
    const resolvedTopic = input.category || "General";
    const normalizedTargetAge = input.targetAge || "40s";
    const topicContext = input.customContext || "";

    let selectedEnginePrompt = SYSTEM_PROMPT_V3;
    let selectedSherbetPrompt = "";

    if (input.engineVersion === 'V3_COSTAR') {
      selectedEnginePrompt = SYSTEM_PROMPT_V3_COSTAR;
    } else if (isCustomEngine) {
      const engine = getEngineConfig(input.engineVersion);
      if (engine) {
        selectedEnginePrompt = engine.prompt;
        if (SHERBET_ENGINE_IDS.has(input.engineVersion)) {
          selectedSherbetPrompt = engine.prompt;
        }
      }
    }

    let systemPrompt = "";
    const isChatGPT = input.targetService === 'CHATGPT';

    if (isEngineOff) {
      systemPrompt = "";
    } else if (isCustomEngine) {
      const customAgeTokens = buildAgeTokens(input.targetAge);
      systemPrompt = selectedEnginePrompt
        .replace(/\{\{TARGET_AGE\}\}/g, customAgeTokens.korean)
        .replace(/\{\{TARGET_AGE_EN\}\}/g, customAgeTokens.englishShort);
    } else if (input.useViralMode && input.scenarioMode === ScenarioMode.DOUBLE_ENTENDRE) {
      systemPrompt = SYSTEM_PROMPT_VIRAL;
    } else if (isChatGPT) {
      systemPrompt = SYSTEM_PROMPT_CHATGPT;
    } else if (input.targetService === 'CLAUDE') {
      systemPrompt = SYSTEM_PROMPT_CLAUDE;
    } else {
      systemPrompt = selectedEnginePrompt;
    }

    const v3Vars = isChatGPT ? generateSafeV3Variables(input.category) : generateV3Variables(input.category);

    if (input.lockedFemaleOutfit?.trim()) {
      v3Vars.items.A = input.lockedFemaleOutfit.trim();
    }
    if (SHERBET_ENGINE_IDS.has(input.engineVersion)) {
      systemPrompt = injectSherbetOutfitLock(
        stripSherbetOutfitCatalog(selectedSherbetPrompt || systemPrompt),
        v3Vars.items.A
      );
    }

    let maleOutfit = pickMaleOutfitForContext(topicContext);
    if (input.targetService === 'CLAUDE' && input.lockedMaleOutfit?.trim()) {
      maleOutfit = input.lockedMaleOutfit.trim();
    }

    const backgroundInstruction = `
    [BACKGROUND & CAMERA CONSISTENCY]
    - Location Anchor: ${topicContext ? topicContext : 'High-end private golf course on a weekday afternoon'}.
    - Keep scenes 1~5 in the SAME location and lighting. Change only the camera distance and character actions.
    `;

    const storyFocusBlock = `
    [GENRE TEMPLATE MODE]
    - Topic: ${resolvedTopic}
    - Ignore Scenario presets. Follow ONLY the Style Template guidance above plus the outfit/visual rules here.
    - Build a viral short-form script with original props, dialogue, and a strong comedic twist.
    `;

    let outfitA = v3Vars.items.A;
    let outfitB = maleOutfit;
    const isSherbet = SHERBET_ENGINE_IDS.has(input.engineVersion);
    const sherbetSubGuide = "Auto-select a non-overlapping classy/golf-inspired outfit; keep it fixed across scenes. Do NOT list catalogs.";
    const sherbetMaleGuide = "If a male appears, use a simple navy/white golf look different from the main outfit; if no male appears, explicitly include 'No male characters appear in this scene.'";

    const lockedOutfitReminder = `
  [CHARACTER STYLE GUIDE]
  Select outfits for each character that are distinct and consistent across all scenes.

  [${CHARACTER_PRESETS.WOMAN_A.name} (Character A)]
  Outfit: Select from available female outfit list (consistent across all scenes)
  Hair: ${CHARACTER_PRESETS.WOMAN_A.hair}

  [Character B]
  Outfit: Select from available male outfit list (consistent across all scenes)
  Hair: ${MALE_DEFAULT_HAIR}

  [${CHARACTER_PRESETS.WOMAN_C.name} (Character C)]
  Outfit: Select from available female outfit list, different from Character A (consistent across all scenes)
  Hair: ${CHARACTER_PRESETS.WOMAN_C.hair} (사용 시 고정)
  `;

    const promptInstructions = `
    ${storyFocusBlock}
    [IMAGE PROMPT RULES]
    - Create High - End Luxury Visuals.
      - Use "8k resolution, photorealistic, cinematic lighting".
    
    [MULTI-CHARACTER VISUAL DIVERSITY]
    - When two or more Korean women appear, assign each one a unique Korean name, distinct hairstyle, and distinct outfit silhouette.
    - Reference the locked outfits (Character A / Character B / Character C) and map them consistently to the same person in all scenes.
    ${backgroundInstruction}
    [DYNAMIC POSE & EXPRESSION INJECTION]
    - **AVOID STATIC POSES**. No "Standing still" or "Looking at camera".
  `;

    const templateGuidanceBlock = `
    [STYLE TEMPLATE: ${input.scenarioMode}]
    - Follow the tone and structure of the selected scenario mode.
    `;

    const userPrompt = `
  Topic: ${resolvedTopic}
      Outfit Style: ${input.category || "0. 선택안함"}
      Target Age: ${input.targetAge || "40s"}

  ${promptInstructions}

  ${templateGuidanceBlock}

  ${lockedOutfitReminder}

  [FEMALE OUTFIT RULES - CRITICAL]
  - All FEMALE visuals must use ULTRA-TIGHT + MINI / MICRO length silhouettes.
  - Absolutely NO slacks, trousers, loose pants, or baggy bottoms for women.

  [CHARACTER ID MAP - MUST OUTPUT]
  - Characters array with stable IDs and outfits:
    - {"id":"${CHARACTER_PRESETS.WOMAN_A.id}","name":"${CHARACTER_PRESETS.WOMAN_A.name}","role":"${CHARACTER_PRESETS.WOMAN_A.role}","outfit":"${outfitA}","hair":"${CHARACTER_PRESETS.WOMAN_A.hair}","gender":"FEMALE"}
    - {"id":"B","name":"Male Lead","role":"Male Lead","outfit":"${outfitB}","hair":"${MALE_DEFAULT_HAIR}","gender":"MALE"}
    - {"id":"${CHARACTER_PRESETS.WOMAN_C.id}","name":"${CHARACTER_PRESETS.WOMAN_C.name}","role":"${CHARACTER_PRESETS.WOMAN_C.role}","outfit":"${v3Vars.items.C}","hair":"${CHARACTER_PRESETS.WOMAN_C.hair}","gender":"FEMALE"}
  - Every scene MUST include "characterIds": ["A"] or ["A","B"] referencing this map.

  [SCRIPT TASK (CRITICAL)]
  - Produce "scriptBody" as pure Korean narration/dialogue lines separated by "\\n".
  - Provide exactly 3 impactful alternative titles in "titleOptions".
  - Language: 100% Korean, natural spoken tone for ${normalizedTargetAge}.
  - Structure: Follow the Style Template beats (Hook → Build → Twist).
  - Length: 12~15 sentences total, narration-heavy (약 80%) with only 2~3 dialogue punches.
  - Content Inputs: Use ONLY the Topic (${resolvedTopic}), Outfit Style (${input.category || '0. 선택안함'}), and any user-provided context.
  - Never mention outfit names/colors in the scriptBody.
  - scriptBody, punchline, scriptLine에는 쌍따옴표(")를 사용하지 마세요. 대사는 작은따옴표(') 또는 괄호로 표기하세요.

  [OUTPUT JSON RULES]
  - Must return valid JSON (no markdown).
  - Required keys: "title", "titleOptions", "scriptBody", "punchline", "characters", "scenes".
  - "scenes": exactly 6 objects, each with: sceneNumber, characterIds, shortPrompt, shortPromptKo, longPrompt, longPromptKo, soraPrompt, soraPromptKo.
  - Enforce the FEMALE OUTFIT RULES above in every scene.

  [IMPORTANT]
      For EVERY image prompt(short and long), you MUST append these quality tags at the end:
  ", photorealistic, 8k resolution, cinematic lighting, detailed texture, masterpiece, professional fashion photography, depth of field"
    `;

    return systemPrompt + "\n\n" + userPrompt;
  }

  return "No prompt generated. Please check engine settings.";
};

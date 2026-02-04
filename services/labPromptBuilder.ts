/**
 * labPromptBuilder.ts
 * 쇼츠랩 전용 경량화 프롬프트 빌더
 *
 * v3.9.3 통합 업데이트 (2026-02-04):
 * - ShortsLabPanel의 후처리 로직 통합 (postProcessAiScenes)
 * - 캐릭터 및 슬롯 관리 유틸리티 이관
 * - 중복 코드 제거 및 서비스 레이어 일원화
 */

import { UNIFIED_OUTFIT_LIST } from '../constants';
import { buildOutfitPool } from './outfitService';
import type { OutfitPoolItem } from './outfitService';
import { DEFAULT_PROMPT_RULES } from './shortsLabPromptRulesDefaults';
import { getShortsLabPromptRules } from './shortsLabPromptRulesManager';
import {
  fillStep2PromptTemplate,
  getShortsLabStep2PromptRules
} from './shortsLabStep2PromptRulesManager';
import { getCharacterRules } from './shortsLabCharacterRulesManager';
import type { ShortsLabCharacterRules } from './shortsLabCharacterRulesDefaults';
import { enhancePromptWithSafeGlamour } from './geminiService';

// ============================================
// 1. 상수 및 메타 데이터
// ============================================

export const DEFAULT_CHARACTER_META: Record<string, { gender: 'female' | 'male'; hair: string; body: string }> = {
    WomanA: { gender: 'female', hair: 'long soft-wave hairstyle', body: 'slim hourglass figure' },
    WomanB: { gender: 'female', hair: 'short chic bob cut', body: 'petite and slim frame' },
    WomanC: { gender: 'female', hair: 'low ponytail hairstyle', body: 'gracefully toned athletic body' },
    WomanD: { gender: 'female', hair: 'high-bun hairstyle', body: 'bright cheerful professional presence' },
    ManA: { gender: 'male', hair: 'short neat hairstyle', body: 'fit athletic build' },
    ManB: { gender: 'male', hair: 'clean short cut', body: 'fit athletic build' },
    ManC: { gender: 'male', hair: 'classic side-part hairstyle', body: 'well-built physique' }
};

export const MANUAL_SLOT_META: Record<string, { id: string; slotLabel: string; gender: 'female' | 'male'; hair: string; body: string }> = {
    'Woman A': { id: 'WomanA', slotLabel: 'Woman A', gender: 'female', hair: 'long soft-wave hairstyle', body: 'slim hourglass figure' },
    'Woman B': { id: 'WomanB', slotLabel: 'Woman B', gender: 'female', hair: 'short chic bob cut', body: 'petite and slim frame' },
    'Woman C': { id: 'WomanC', slotLabel: 'Woman C', gender: 'female', hair: 'low ponytail hairstyle', body: 'gracefully toned athletic body' },
    'Woman D': { id: 'WomanD', slotLabel: 'Woman D', gender: 'female', hair: 'high-bun hairstyle', body: 'bright cheerful professional presence' },
    'Man A': { id: 'ManA', slotLabel: 'Man A', gender: 'male', hair: 'short neat hairstyle', body: 'fit athletic build' },
    'Man B': { id: 'ManB', slotLabel: 'Man B', gender: 'male', hair: 'clean short cut', body: 'fit athletic build' },
    'Man C': { id: 'ManC', slotLabel: 'Man C', gender: 'male', hair: 'classic side-part hairstyle', body: 'well-built physique' },
    'WomanA': { id: 'WomanA', slotLabel: 'Woman A', gender: 'female', hair: 'long soft-wave hairstyle', body: 'slim hourglass figure' },
    'WomanB': { id: 'WomanB', slotLabel: 'Woman B', gender: 'female', hair: 'short chic bob cut', body: 'petite and slim frame' },
    'WomanC': { id: 'WomanC', slotLabel: 'Woman C', gender: 'female', hair: 'low ponytail hairstyle', body: 'gracefully toned athletic body' },
    'WomanD': { id: 'WomanD', slotLabel: 'Woman D', gender: 'female', hair: 'high-bun hairstyle', body: 'bright cheerful professional presence' },
    'ManA': { id: 'ManA', slotLabel: 'Man A', gender: 'male', hair: 'short neat hairstyle', body: 'fit athletic build' },
    'ManB': { id: 'ManB', slotLabel: 'Man B', gender: 'male', hair: 'clean short cut', body: 'fit athletic build' },
    'ManC': { id: 'ManC', slotLabel: 'Man C', gender: 'male', hair: 'classic side-part hairstyle', body: 'well-built physique' }
};

export const SLOT_ORDER = ['WomanA', 'WomanB', 'WomanC', 'WomanD', 'ManA', 'ManB', 'ManC'];

export const WINTER_KEYWORDS = ['눈', '겨울', 'snow', 'winter', '스키', 'ski', '썰매', 'sled', 'ice', '빙판', '얼음', 'snowy'];

export const WINTER_COLLECTION = {
  HEADWEAR: [
    'luxurious mink fur beanie with crystal embellishments',
    'elegant velvet headband with pearl and diamond embroidery',
    'soft cashmere beanie with an oversized real fur pom-pom',
    'quilted designer-style winter bucket hat with gold logo',
    'sleek leather trapper hat with premium white sheepskin lining',
    'angora beret with a dainty vintage jewel brooch',
    'cat-ear knit beanie with silver glitter threads',
    'premium faux fur headband in a rich winter luxury hue',
    'mink-style fuzzy earmuff-hat hybrid',
    'sporty white knit headband with luxury designer logo'
  ],
  EARMUFFS: [
    'premium mink-style oversized fluffy earmuffs',
    'velvet headband earmuffs with gold thread and crystal embroidery',
    'heart-shaped fluffy faux fur earmuffs with silk ribbon bows',
    'pearl-decorated elegant white earmuffs',
    'bear-ear fleece headband with satin ribbon bows',
    'satin-finished luxury earmuffs with lush fur lining',
    'jeweled earmuffs with shimmering rhinestones',
    'chic black faux fur earmuffs with a quilted leather band'
  ],
  SCARVES: [
    'extravagant long faux fur stole with crystal clasp',
    'refined cashmere wrap scarf with velvet trim and fringe',
    'thick mohair scarf with soft pastel color gradients',
    'sleek silk-lined fur neck collar with a velvet ribbon',
    'designer-patterned chunky knit infinity scarf',
    'oversized cable knit scarf wrapped multiple times',
    'cross-over faux fur neck warmer with a crystal button',
    'thin cashmere muffler with metallic luxury logo plate',
    'hooded scarf (scoodie) with fur pom-poms and crystal accents'
  ],
  GLOVES: [
    'luxurious oversized faux fur hand muff with a gold chain',
    'elegant leather gloves with thick fluffy mink fur cuffs',
    'long opera-length velvet gloves reaching the elbows',
    'touch-screen silk gloves with dainty crystal ribbon bows',
    'cute fuzzy mittens with a connecting string',
    'suede gloves with shearling lining and crystal stitching',
    'fingerless knit arm warmers with thumb holes and fur trim',
    'fur-trimmed driving gloves for a sophisticated look'
  ],
  LEGS: [
    'stylish faux fur leg warmers with crystal accents worn over the boots',
    'ribbed knit thigh-high leg warmers (over-the-knee)',
    'diamond-patterned wool leg warmers with fur pompoms',
    'chunky faux fur moon boots for a bold statement',
    'classic shearling-lined boots with velvet ribbon details',
    'elegant knee-high suede boots with mink fur lining',
    'luxury quilted snow boots with platform soles',
    'white faux fur boot covers for a glamorous look',
    'cable knit calf-length leg warmers',
    'pom-pom decorated winter socks with glitter threads'
  ]
};

export const ACCESSORY_CATEGORIES = {
  Head: [...WINTER_COLLECTION.HEADWEAR, ...WINTER_COLLECTION.EARMUFFS],
  Neck: WINTER_COLLECTION.SCARVES,
  Arms: WINTER_COLLECTION.GLOVES,
  Legs: WINTER_COLLECTION.LEGS
} as const;

export type AccessoryCategory = keyof typeof ACCESSORY_CATEGORIES;

export const ACTION_KEYWORD_MAPPING: Record<string, string> = {
  '골프채를 휘두르다': 'swinging golf club',
  '골프채를 휘두르는': 'swinging golf club',
  '골프 스윙': 'golf swing motion',
  '퍼팅하다': 'putting golf ball',
  '손을 흔들다': 'waving hand',
  '손을 흔드는': 'waving hand',
  '손가락질하다': 'pointing finger',
  '손바닥으로 가리다': 'covering with palm',
  '박수치다': 'clapping hands',
  '주먹 쥐다': 'clenching fist',
  '가방을 꽉 쥐다': 'clutching bag tightly',
  '가방을 꽉 쥐는': 'clutching bag tightly',
  '리모컨을 들다': 'holding remote control',
  '리모컨을 들고': 'holding remote control',
  '핸드폰을 보다': 'looking at phone',
  '서류를 펼치다': 'spreading documents',
  '잔을 들다': 'holding glass',
  '컵을 들다': 'holding cup',
  '고개를 갸우뚱': 'tilting head',
  '고개를 끄덕이다': 'nodding head',
  '고개를 저으며': 'shaking head',
  '입을 가리다': 'covering mouth',
  '입을 가리며': 'covering mouth',
  '눈을 감다': 'closing eyes',
  '눈을 크게 뜨다': 'wide eyes open',
  '이마를 짚다': 'touching forehead',
  '턱을 괴다': 'resting chin on hand',
  '걷다': 'walking',
  '뛰다': 'running',
  '앉다': 'sitting down',
  '일어서다': 'standing up',
  '돌아서다': 'turning around',
  '몸을 숙이다': 'bending forward',
  '팔짱을 끼다': 'crossing arms',
  '허리에 손을 올리다': 'hands on hips',
  '한숨을 쉬다': 'sighing deeply',
  '웃으며': 'while smiling',
  '미소짓다': 'smiling',
  '찡그리다': 'frowning',
  '놀라며': 'looking surprised',
  '당황하며': 'looking flustered',
  '속삭이다': 'whispering',
  '소리지르다': 'shouting',
  '대화하다': 'having conversation',
  '대화하는': 'having conversation',
  '말하다': 'talking',
  '말하며': 'while talking',
  '뒤돌아보다': 'looking back',
  '쳐다보다': 'staring at',
  '응시하다': 'gazing at',
  '피하다': 'avoiding',
  '다가가다': 'approaching',
  '멀어지다': 'moving away'
};

export const CANDID_ACTION_FLAVORS = [
    'candid action shot, mid-motion, natural movement',
    'dynamic pose, hair in motion, spontaneous gesture',
    'playful movement, caught mid-step, lively energy',
    'energetic action, subtle motion blur, candid vibe',
    'cinematic candid shot, authentic body language'
];

export const GROUP_ACTION_FLAVORS = [
    'natural interaction, candid moment, each person reacting differently',
    'captured mid-action, lively group dynamic, varied gestures',
    'spontaneous group moment, mixed reactions, authentic movement',
    'candid interaction, playful exchanges, unscripted energy'
];

export const SHOT_TEMPLATES = {
  SINGLE: {
    description: '1명 캐릭터 단독 등장',
    format: '[Character] identity, hair, body, wearing outfit, [Action], [Background]',
  },
  TWO_SHOT: {
    description: '2명 캐릭터 상호작용',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Interaction], [Background]',
  },
  THREE_SHOT: {
    description: '3명 캐릭터 함께 등장',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Person 3: identity, hair, body, wearing outfit] [Group Action], [Background]',
  },
  CAMERA_ANGLES: {
    CLOSE_UP: { name: '클로즈업', promptKeyword: 'close-up portrait shot, face in focus, shallow depth of field', usage: 'Hook/Twist 감정 강조' },
    MEDIUM_SHOT: { name: '미디엄샷', promptKeyword: 'medium shot, waist-up framing, natural pose', usage: '대화 상호작용' },
    WIDE_SHOT: { name: '와이드샷', promptKeyword: 'wide establishing shot, full body visible, environment context', usage: '장소 전환 상황 설정' },
    OVER_SHOULDER: { name: '오버숄더', promptKeyword: 'over-the-shoulder shot, perspective view', usage: '대면 상황 긴장감' },
    POV: { name: 'POV', promptKeyword: 'first-person POV shot, subjective camera angle', usage: '몰입감 강화' }
  }
};

// ============================================
// 2. 기본 유틸리티 및 정규화 로직
// ============================================

export const isWinterTopic = (topic: string): boolean =>
  WINTER_KEYWORDS.some((keyword) => topic.toLowerCase().includes(keyword.toLowerCase()));

export const getCharacterGender = (id: string): 'female' | 'male' => {
    const meta = DEFAULT_CHARACTER_META[id];
    if (meta) return meta.gender;
    return id.toLowerCase().includes('man') ? 'male' : 'female';
};

export const normalizeSlotToken = (value: string) => value.replace(/[\s_]+/g, '').trim();

export const normalizeSlotId = (value: string): string => {
    const normalized = normalizeSlotToken(value);
    if (!normalized) return '';
    const key = normalized.toLowerCase();
    const canonical: Record<string, string> = {
        womana: 'WomanA', womanb: 'WomanB', womanc: 'WomanC', womand: 'WomanD',
        mana: 'ManA', manb: 'ManB', manc: 'ManC'
    };
    return canonical[key] || '';
};

export const mapAliasToSlot = (value: string, defaultGender: 'female' | 'male'): string => {
    const lower = value.toLowerCase();
    if (/(주인공|나|내가|narrator|protagonist|character1|character_1)/i.test(lower)) {
        return defaultGender === 'male' ? 'ManA' : 'WomanA';
    }
    if (/캐디|caddy/i.test(lower)) return 'WomanD';
    return '';
};

export const inferGenderFromText = (text: string, fallback: 'female' | 'male') => {
    const lower = (text || '').toLowerCase();
    const femaleHints = /(여성|여자|여신|언니|언니들|여성들|미녀|걸|girl|woman|ladies|her)/i;
    const maleHints = /(남성|남자|오빠|형|bro|boy|man|men|his)/i;
    if (femaleHints.test(lower) && !maleHints.test(lower)) return 'female';
    if (maleHints.test(lower) && !femaleHints.test(lower)) return 'male';
    return fallback;
};

export const pickUniqueItems = (pool: string[], used: Set<string>, count: number) => {
    const available = pool.filter((item) => !used.has(item));
    const picks: string[] = [];
    while (picks.length < count && available.length > 0) {
        const index = Math.floor(Math.random() * available.length);
        const [picked] = available.splice(index, 1);
        if (picked) picks.push(picked);
    }
    if (picks.length < count) {
        const fallbackPool = pool.filter((item) => !picks.includes(item));
        while (picks.length < count && fallbackPool.length > 0) {
            const index = Math.floor(Math.random() * fallbackPool.length);
            const [picked] = fallbackPool.splice(index, 1);
            if (picked) picks.push(picked);
        }
    }
    picks.forEach((item) => used.add(item));
    return picks;
};

export const normalizeSlotList = (slotIds: string[], defaultGender: 'female' | 'male', hasCaddy: boolean) => {
    const normalized = slotIds.map((id) => normalizeSlotId(id)).filter(Boolean);
    if (hasCaddy) normalized.push('WomanD');
    const unique = new Set(normalized);
    const ordered = SLOT_ORDER.filter((id) => unique.has(id));
    return ordered.length === 0 ? [defaultGender === 'male' ? 'ManA' : 'WomanA'] : ordered;
};

export const normalizeSceneCharacterIds = (
    rawIds: string[],
    slotMap: Map<string, string>,
    defaultGender: 'female' | 'male',
    hasCaddy: boolean
) => {
    const resolved: string[] = [];
    const seen = new Set<string>();
    rawIds.forEach((raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return;
        const direct = normalizeSlotId(trimmed);
        const mapped = slotMap.get(trimmed) || slotMap.get(normalizeSlotToken(trimmed));
        const alias = mapAliasToSlot(trimmed, defaultGender);
        const slot = direct || mapped || alias;
        if (slot && !seen.has(slot)) {
            seen.add(slot);
            resolved.push(slot);
        }
    });
    if (hasCaddy && !seen.has('WomanD')) resolved.push('WomanD');
    if (resolved.length === 0) resolved.push(defaultGender === 'male' ? 'ManA' : 'WomanA');
    return normalizeSlotList(resolved, defaultGender, hasCaddy);
};

export const stripLongPromptMarkers = (prompt: string) => {
    let cleaned = (prompt || '').trim();
    if (!cleaned) return '';
    cleaned = cleaned.replace(/^Scene\s+\d+[.,]?\s*/i, '');
    const constants = getPromptConstants();
    if (cleaned.includes(constants.START)) cleaned = cleaned.replace(constants.START, '').trim();
    if (cleaned.includes(constants.END)) cleaned = cleaned.replace(constants.END, '').trim();
    cleaned = cleaned.replace(/Slot\s+[^:]+:/gi, '').replace(/^,\s*/g, '').replace(/,\s*$/g, '').trim();
    return cleaned;
};

export const stripCameraPrefix = (prompt: string) => {
    const keywords = ['close-up', 'close up', 'medium', 'wide', 'canted', 'over-the-shoulder', 'ots', 'pov', 'low-angle', 'high-angle', 'bird\'s-eye', 'overhead', 'tracking', 'handheld'];
    const keywordPattern = keywords.map((item) => item.replace('-', '\\-')).join('|');
    const regex = new RegExp(`^\\s*(?:${keywordPattern})[^,]*,?\\s*`, 'i');
    return prompt.replace(regex, '').trim();
};

export const mergeNarrativeParts = (parts: string[]) => {
    const seen = new Set<string>();
    const merged: string[] = [];
    parts.forEach((part) => {
        const trimmed = (part || '').trim();
        if (trimmed && !seen.has(trimmed.toLowerCase())) {
            seen.add(trimmed.toLowerCase());
            merged.push(trimmed);
        }
    });
    return merged.join(', ');
};

export const detectCameraKeyword = (prompt: string) => {
    const keywords = ['close-up', 'close up', 'medium', 'wide', 'canted', 'over-the-shoulder', 'ots', 'pov', 'low-angle', 'high-angle', 'bird\'s-eye', 'overhead', 'tracking', 'handheld'];
    const lower = (prompt || '').toLowerCase();
    return keywords.find((keyword) => lower.includes(keyword)) || '';
};

export const pickRotatingCandidate = (candidates: string[], index: number, lastValue?: string) => {
    const filtered = candidates.map((item) => (item || '').trim()).filter(Boolean);
    if (filtered.length === 0) return '';
    let pick = filtered[index % filtered.length];
    if (lastValue && pick.toLowerCase() === lastValue.toLowerCase() && filtered.length > 1) {
        pick = filtered[(index + 1) % filtered.length];
    }
    return pick;
};

export const pickCameraPrompt = (basePrompt: string, sceneIndex: number, lastKeyword?: string) => {
    const keywords = ['close-up', 'close up', 'medium', 'wide', 'canted', 'over-the-shoulder', 'ots', 'pov', 'low-angle', 'high-angle', 'bird\'s-eye', 'overhead', 'tracking', 'handheld'];
    const fallbacks: Record<string, string> = {
        'close-up': 'close-up portrait shot, face in focus, shallow depth of field',
        medium: 'medium shot, waist-up framing, natural pose',
        wide: 'wide establishing shot, full body visible, environment context',
        pov: 'first-person POV shot, subjective camera angle'
    };
    const baseKeyword = detectCameraKeyword(basePrompt);
    const shouldRotate = !baseKeyword || baseKeyword === 'medium' || baseKeyword === 'close-up';
    let keyword = shouldRotate ? keywords[(sceneIndex + 1) % keywords.length] : baseKeyword;
    if (lastKeyword && keyword.toLowerCase() === lastKeyword.toLowerCase()) keyword = keywords[(keywords.indexOf(keyword.toLowerCase()) + 1) % keywords.length];
    return shouldRotate ? (fallbacks[keyword] || fallbacks['medium']) : basePrompt;
};

export const escapeCleanupPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ============================================
// 3. 캐릭터, 의상 및 악세서리 로직
// ============================================

export const selectWinterItems = (gender: 'female' | 'male' = 'female'): { outerwear: string; accessories: string[] } => {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  if (gender === 'male') return { outerwear: '', accessories: [pick(WINTER_COLLECTION.HEADWEAR)] };
  const categories = Object.keys(WINTER_COLLECTION) as Array<keyof typeof WINTER_COLLECTION>;
  const picks = [...categories].sort(() => 0.5 - Math.random()).slice(0, 2).map(cat => pick(WINTER_COLLECTION[cat]));
  return { outerwear: '', accessories: picks };
};

export const getWinterAccessoryPool = (): string[] => Object.values(WINTER_COLLECTION).flat();

export const distributeUniqueWinterItems = (characterIds: string[]) => {
  const result: Record<string, { categories: string[]; items: string[] }> = {};
  const cats = ['Head', 'Neck', 'Arms', 'Legs'];
  characterIds.forEach(id => {
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    const myCats = [...cats].sort(() => 0.5 - Math.random()).slice(0, 2);
    const items = myCats.map(c => pick((ACCESSORY_CATEGORIES as any)[c]));
    result[id] = { categories: myCats, items };
  });
  return result;
};

export const convertToTightLongSleeveWithShoulderLine = (outfit: string): string => {
  if (!outfit) return outfit;
  let top = outfit;
  let tail = '', joiner = '';
  [' + ', ' with ', ' and '].forEach(s => {
      const idx = outfit.toLowerCase().indexOf(s);
      if (idx > 0 && !joiner) { top = outfit.slice(0, idx); tail = outfit.slice(idx + s.length); joiner = s; }
  });
  let newTop = top.replace(/deep\s*v[-\s]?neck|plunging\s*neckline|\bcleavage\b/gi, 'Elegant boat-neck fitted');
  newTop = newTop.replace(/Off-shoulder|One-shoulder|Sleeveless|Short-sleeve/gi, 'Tight-fitting long-sleeve');
  if (!newTop.toLowerCase().includes('long-sleeve')) newTop += ' (long-sleeve version)';
  return tail ? `${newTop}${joiner}${tail}` : newTop;
};

export const applyWinterLookToExistingPrompt = (longPrompt: string, longPromptKo: string, gender: 'female' | 'male' = 'female', options: any = {}) => {
  if (!longPrompt) return { longPrompt, longPromptKo };
  let content = longPrompt;
  const outfitMatch = content.match(/([^,]+(?:Mini Skirt|Shorts|Pants|Dress|Skirt|Leggings)[^,]*)/i);
  if (outfitMatch) content = content.replace(outfitMatch[1], convertToTightLongSleeveWithShoulderLine(outfitMatch[1]));
  const { accessories } = selectWinterItems(gender);
  if (options.applyAccessories !== false) content = content.trim().replace(/,\s*$/, '') + `, accessorized with ${accessories.join(', ')}`;
  if (!content.toLowerCase().includes('snow')) content = content.replace(/(standing|walking|sitting|background)/i, '$1 in a heavy snow falling snowy background');
  return { longPrompt: content, longPromptKo: `${longPromptKo} (겨울 룩 적용됨)` };
};

export const GENERAL_ACCESSORIES = [
    { id: 'necklaces', label: '목걸이', items: ['delicate gold necklace', 'pearl pendant necklace', 'minimalist diamond choker', 'fine platinum chain necklace'] },
    { id: 'rings', label: '반지', items: ['sleek platinum ring', 'thin diamond band ring', 'minimalist gold ring', 'luxury sapphire ring'] },
    { id: 'watches', label: '시계', items: ['luxury stainless steel watch', 'elegant leather-strap watch', 'rose-gold designer watch', 'minimalist ceramic watch'] }
];

export const WINTER_ACCESSORIES = [
    'luxurious mink fur beanie with crystal embellishments',
    'elegant velvet headband with pearl embroidery',
    'premium mink-style oversized earmuffs',
    'refined cashmere wrap scarf with velvet trim',
    'long opera-length velvet gloves',
    'touch-screen silk gloves with crystal ribbon bows',
    'ribbed knit thigh-high leg warmers',
    'elegant knee-high suede boots with fur lining'
];

export const pickFemaleOutfit = (genre?: string, topic?: string, excludeList?: string[], allowedCategories?: string[]): string => {
    const pool = buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]).filter(i => !i.categories.includes('MALE'));
    let candidates = pool;
    if (allowedCategories && allowedCategories.length > 0) {
        candidates = pool.filter(i => i.categories.some(c => allowedCategories.includes(c)));
    }
    if (excludeList && excludeList.length > 0) {
        candidates = candidates.filter(i => !excludeList.includes(i.name));
    }
    if (candidates.length === 0) candidates = pool;
    return candidates[Math.floor(Math.random() * candidates.length)]?.name || 'Elegant premium outfit';
};

export const pickMaleOutfit = (topic?: string, excludeList?: string[], allowedCategories?: string[]): string => {
    const pool = buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]).filter(i => i.categories.includes('MALE'));
    let candidates = pool;
    if (allowedCategories && allowedCategories.length > 0) {
        candidates = pool.filter(i => i.categories.some(c => allowedCategories.includes(c)));
    }
    if (excludeList && excludeList.length > 0) {
        candidates = candidates.filter(i => !excludeList.includes(i.name));
    }
    if (candidates.length === 0) candidates = pool;
    return candidates[Math.floor(Math.random() * candidates.length)]?.name || 'Sharp tailored business suit';
};

export const buildRandomOutfitsByCharacter = (characterIds: string[]) => {
    const map = new Map<string, string>();
    const used = new Set<string>();
    characterIds.forEach(id => {
        let picked = getCharacterGender(id) === 'male' ? pickMaleOutfit() : pickFemaleOutfit();
        map.set(id, picked);
        used.add(picked);
    });
    return map;
};

export type ManualCharacterPrompt = {
    id: string;
    slotLabel: string;
    gender: 'female' | 'male';
    name: string;
    identity: string;
    hair: string;
    body: string;
    outfit: string;
    accessories: string[];
};

export const buildAutoCharacterMap = (characterIds: string[], targetAgeLabel: string, enableWinter?: boolean) => {
    const outfitMap = buildRandomOutfitsByCharacter(characterIds);
    const map = new Map<string, ManualCharacterPrompt>();
    characterIds.forEach(id => {
        const meta = MANUAL_SLOT_META[id] || { id, slotLabel: id, gender: getCharacterGender(id), hair: '', body: '' };
        let age = targetAgeLabel.match(/\d+/) ? `${targetAgeLabel.match(/\d+/)![0]}s` : '';
        if (id === 'WomanD') age = 'early 20s';
        let outfit = outfitMap.get(id) || '';
        if (enableWinter && meta.gender === 'female') outfit = convertToTightLongSleeveWithShoulderLine(outfit);
        map.set(id, { ...meta, identity: `${meta.gender === 'female' ? 'Korean woman' : 'Korean man'} in ${age}`, outfit, accessories: [], name: '', hair: meta.hair || '', body: meta.body || '' });
    });
    return map;
};

export const buildCharacterSlotMapping = (characters: any[]) => {
    const mapping = new Map<string, string>();
    const fSlots = ['WomanA', 'WomanB', 'WomanC', 'WomanD'], mSlots = ['ManA', 'ManB', 'ManC'];
    let fIdx = 0, mIdx = 0;
    characters.forEach(c => {
        const name = c.name.trim();
        const slot = c.gender === 'male' ? mSlots[mIdx++] : fSlots[fIdx++];
        if (name && slot) mapping.set(name, slot);
    });
    return mapping;
};

export const mapLineCharactersToSlots = (lineChars: any[], slotMap: Map<string, string>) => {
    const map = new Map<number, string[]>();
    lineChars.forEach(item => {
        const slots = item.characters.map((n: string) => slotMap.get(n.trim())).filter(Boolean);
        if (slots.length > 0) map.set(item.line, Array.from(new Set(slots)));
    });
    return map;
};

// ============================================
// 4. 프롬프트 빌딩 및 후처리 핵심 (Integrated Stage)
// ============================================

export const LAB_GENRE_GUIDELINES: Record<string, LabGenreGuideline> = {
  'comedy-humor': {
    name: '코미디 / 유머',
    description: '생생한 표정과 역동적 포즈가 핵심인 유머 장르',
    emotionCurve: '😊 평화 → 😳 당황 → 😂 웃음',
    structure: '[HOOK] 상황 중간 시작...',
    killerPhrases: ['드디어 올 게 왔구나', '심장이 철렁'],
    bodyReactions: ['얼굴이 화끈거려', '헛기침'],
    forbiddenPatterns: ['지나치게 진지'],
    goodTwistExamples: ['알고보니 처제'],
    badTwistExamples: ['알고보니 꿈'],
    postProcessConfig: { enabled: true, skipIdentityInjection: false, cleanupPatterns: [], customPrefix: '', customSuffix: '', useSafeGlamour: true }
  },
  'romance-flutter': {
    name: '로맨스 / 설렘',
    description: '중년의 설렘과 두근거림',
    emotionCurve: '😐 무덤덤 → 💓 두근 → 😳 당황',
    structure: '[HOOK] 사건 충격 첫 문장...',
    killerPhrases: ['오늘따라 왜 이러지', '원래 이랬나'],
    bodyReactions: ['심장이 빨라져', '귀가 빨개져'],
    forbiddenPatterns: ['유치한 표현'],
    goodTwistExamples: ['우연한 재회'],
    badTwistExamples: ['뻔한 전개'],
    postProcessConfig: { enabled: true, skipIdentityInjection: false, cleanupPatterns: [], customPrefix: '', customSuffix: '', useSafeGlamour: true }
  }
};

export const getPromptConstants = () => {
  const rules = getShortsLabPromptRules() || DEFAULT_PROMPT_RULES;
  const charRules = getCharacterRules();
  return {
    ...rules.promptConstants,
    FEMALE_BODY_A: charRules.females[0]?.body || 'slim hourglass figure',
    FEMALE_BODY_B: charRules.females[1]?.body || 'petite frame',
    MALE_BODY: charRules.males[0]?.body || 'fit athletic build',
    START: rules.promptConstants?.START || '',
    END: rules.promptConstants?.END || '',
    NEGATIVE: rules.promptConstants?.NEGATIVE || ''
  };
};

export const getStoryStageBySceneNumber = (num: number, total: number = 12) => {
  const r = num / total;
  return num === 1 ? 'hook' : r <= 0.25 ? 'setup' : r <= 0.5 ? 'buildup' : r <= 0.7 ? 'climax' : r <= 0.85 ? 'twist' : 'outro';
};

export const getExpressionKeywordMap = () => (getShortsLabPromptRules() || DEFAULT_PROMPT_RULES).expressionKeywords || DEFAULT_PROMPT_RULES.expressionKeywords;

export const getExpressionForScene = (genre: string, stage: string) => {
  const map = getExpressionKeywordMap();
  const expressions = map[genre.toLowerCase().replace(/\s+/g, '-')] || map['default'];
  return expressions[stage] || expressions['hook'];
};

export const getCameraPromptForScene = (stage: string) => {
  const map = (getShortsLabPromptRules() || DEFAULT_PROMPT_RULES).cameraMapping || DEFAULT_PROMPT_RULES.cameraMapping;
  return map[stage]?.prompt || map['buildup'].prompt;
};

let angleHistory: string[] = [];
export const resetAngleHistory = () => { angleHistory = []; };

export const getSmartCameraPrompt = (sceneNumber: number, totalScenes: number = 12): { angle: string; prompt: string } => {
  const recommendedAngles: Record<number, { angle: string; prompt: string }> = {
    1: { angle: 'close-up', prompt: 'close-up portrait shot, face in focus, shallow depth of field, dramatic lighting' },
    2: { angle: 'drone', prompt: 'drone shot, bird\'s-eye view, wide establishing shot, full body visible, environment context' },
    3: { angle: 'medium', prompt: 'medium shot, waist-up framing, natural pose' },
    4: { angle: 'wide', prompt: 'wide landscape shot, full body visible, background emphasis' },
    12: { angle: 'wide', prompt: 'wide establishing shot, final scene, background visible' }
  };
  const rec = recommendedAngles[sceneNumber] || recommendedAngles[3];
  angleHistory.push(rec.angle);
  return rec;
};

export const PROMPT_CONSTANTS_PROXY = {
  get START() { return getPromptConstants().START; },
  get END() { return getPromptConstants().END; },
  get NEGATIVE() { return getPromptConstants().NEGATIVE; },
  get FEMALE_BODY_A() { return getPromptConstants().FEMALE_BODY_A; },
  get FEMALE_BODY_B() { return getPromptConstants().FEMALE_BODY_B; },
  get FEMALE_BODY_C() { return getPromptConstants().FEMALE_BODY_C; },
  get FEMALE_BODY_D() { return getPromptConstants().FEMALE_BODY_D; },
  get MALE_BODY() { return getPromptConstants().MALE_BODY; }
};
export const PROMPT_CONSTANTS = PROMPT_CONSTANTS_PROXY;

export const translateActionToEnglish = (action: string) => {
  let t = action || '';
  Object.keys(ACTION_KEYWORD_MAPPING).forEach(k => t = t.replace(k, ACTION_KEYWORD_MAPPING[k]));
  return t;
};

export const enforceKoreanIdentity = (text: string, ageLabel: string, num: number, gender: string) => {
  const age = ageLabel.match(/\d+/) ? `${ageLabel.match(/\d+/)![0]}s` : '';
  const desc = gender === 'female' ? `stunning Korean woman in her ${age}` : `handsome Korean man in his ${age}`;
  return `Scene ${num}, A ${desc}, ${text.replace(/^Scene \d+[\.,]\s*/i, '').trim()}`;
};

export const enhanceScenePrompt = (text: string, options: any) => {
  const stage = getStoryStageBySceneNumber(options.sceneNumber || 1, options.totalScenes || 12);
  const expr = getExpressionForScene(options.genre || 'default', stage);
  const cam = getSmartCameraPrompt(options.sceneNumber || 1, options.totalScenes).prompt;
  const action = options.action ? translateActionToEnglish(options.action) : '';
  let updated = enforceKoreanIdentity(text, options.targetAgeLabel || '', options.sceneNumber || 1, options.gender || 'female');
  return `${updated.split(',')[0]}, [${expr}], ${cam}, ${action ? action + ', ' : ''}${updated.split(',').slice(1).join(',')}`;
};

export const extractNegativePrompt = (text: string) => {
  const neg = getPromptConstants().NEGATIVE;
  return (neg && text.includes(neg)) ? { cleaned: text.replace(neg, '').trim(), negative: neg } : { cleaned: text, negative: '' };
};

export const DEFAULT_POST_PROCESS_CONFIG = {
    enabled: true,
    skipIdentityInjection: false,
    cleanupPatterns: [] as string[],
    customPrefix: '',
    customSuffix: '',
    useSafeGlamour: true
};

export const validateAndFixPrompt = (prompt: string, shotType: string, characters: any[], options: any = {}) => ({ fixedPrompt: prompt });

export const buildAccessoryMap = (chars: any[], winter?: boolean) => {
    const map = new Map<string, string[]>();
    if (Array.isArray(chars)) chars.forEach(c => map.set(String(c.id || c.slot || ''), (c.accessories || '').split(',').filter(Boolean)));
    if (winter) map.forEach((a, id) => getCharacterGender(id) === 'female' && map.set(id, Array.from(new Set([...a, ...selectWinterItems('female').accessories]))));
    return map;
};

export const buildWinterAccessoryMap = (characterIds: string[]) => {
    const pool = getWinterAccessoryPool();
    const used = new Set<string>();
    const map = new Map<string, string[]>();
    characterIds.forEach((id) => {
        if (getCharacterGender(id) !== 'female') { map.set(id, []); return; }
        const picks = pickUniqueItems(pool, used, 2);
        map.set(id, picks);
    });
    return map;
};

export const applyAccessoriesToPrompt = (prompt: string, ids: string[], map: Map<string, string[]>) => {
    let updated = prompt;
    ids.forEach((id, i) => {
        const accs = map.get(id) || [];
        if (accs.length > 0) updated += `, accessorized with ${accs.join(', ')}`;
    });
    return updated;
};

export const normalizeShotType = (shotType?: string, characterIds?: string[]): '원샷' | '투샷' | '쓰리샷' => {
    const count = characterIds?.length || 0;
    if (count >= 3) return '쓰리샷';
    if (count === 2) return '투샷';
    return '원샷';
};

export const buildFallbackIdentity = (gender: 'female' | 'male', targetAgeLabel?: string) => {
    const age = targetAgeLabel?.match(/\d+/) ? `${targetAgeLabel.match(/\d+/)![0]}s` : '';
    return gender === 'female' ? `A stunning Korean woman${age ? ' in her ' + age : ''}` : `A handsome Korean man${age ? ' in his ' + age : ''}`;
};

export const buildCharacterInfoMap = (chars: any[], ageLabel: string) => {
    const map = new Map<string, CharacterInfo>();
    if (Array.isArray(chars)) chars.forEach(c => {
        const id = String(c.id || c.slot || '');
        const meta = DEFAULT_CHARACTER_META[id] || { gender: 'female', hair: '', body: '' };
        map.set(id, { identity: c.identity || `Korean ${meta.gender} in ${ageLabel}`, hair: c.hair || meta.hair, body: c.body || meta.body, outfit: c.outfit || '' });
    });
    return map;
};

export const postProcessAiScenes = (scenes: any[], options: any) => {
    const infoMap = buildCharacterInfoMap(options.characters || [], options.targetAgeLabel || '');
    const accMap = buildAccessoryMap(options.characters || [], options.enableWinterAccessories);
    return scenes.map((s, i) => {
        let p = enhanceScenePrompt(s.prompt || '', { ...options, sceneNumber: i + 1 });
        p = applyAccessoriesToPrompt(p, s.characterIds || [], accMap);
        const { cleaned, negative } = extractNegativePrompt(p);
        if (options.postProcessConfig?.useSafeGlamour) p = enhancePromptWithSafeGlamour(cleaned);
        return { ...s, longPrompt: cleaned, negativePrompt: negative, shortPrompt: cleaned };
    });
};

export const applyCleanupPatterns = (prompt: string, patterns: string[]) => {
    let c = prompt;
    patterns.forEach(p => c = c.replace(new RegExp(escapeCleanupPattern(p), 'gi'), ''));
    return c.replace(/,\s*,/g, ',').trim();
};

export const applyPostProcessAffixes = (prompt: string, config: any) => {
    let u = prompt.trim();
    if (config?.customPrefix) u = `${config.customPrefix}, ${u}`;
    if (config?.customSuffix) u = `${u}, ${config.customSuffix}`;
    return u.replace(/,\s*,/g, ', ').trim();
};

export const convertAgeToEnglish = (label: string) => label.match(/\d+/) ? `${label.match(/\d+/)![0]}s` : '';

export const enforceShotTypeMix = (
    shotType: '원샷' | '투샷' | '쓰리샷',
    characterIds: string[],
    sceneIndex: number,
    totalScenes: number
): '원샷' | '투샷' | '쓰리샷' => {
    const hasTwo = characterIds.length >= 2;
    const hasThree = characterIds.length >= 3;
    if (hasThree && (sceneIndex === totalScenes - 1 || sceneIndex % 7 === 0)) return '쓰리샷';
    if (hasTwo && (sceneIndex % 2 === 1)) return '투샷';
    return shotType;
};

export const getExpressionCandidates = (genre: string, storyStage: string) => {
    const genreKey = genre.toLowerCase().replace(/\s+/g, '-').replace(/[\/\\]/g, '-');
    const expressionMap = getExpressionKeywordMap();
    const expressions = expressionMap[genreKey] || expressionMap['default'] || {};
    const candidate = (expressions as Record<string, unknown>)[storyStage];
    if (Array.isArray(candidate)) return candidate.filter((item) => typeof item === 'string') as string[];
    const base: string[] = typeof candidate === 'string' ? [candidate] : [];
    const fallback = (expressionMap['default'] || {})[storyStage];
    if (typeof fallback === 'string' && fallback && !base.includes(fallback)) base.push(fallback);
    return base;
};

// ============================================
// 5. 인터페이스 정의
// ============================================

export interface LabGenreGuideline {
  name: string;
  description: string;
  emotionCurve: string;
  structure: string;
  killerPhrases: string[];
  supportingCharacterPhrasePatterns?: string[];
  bodyReactions: string[];
  forbiddenPatterns: string[];
  goodTwistExamples: string[];
  supportingCharacterTwistPatterns?: string[];
  badTwistExamples: string[];
  allowedOutfitCategories?: string[];
  postProcessConfig?: {
    enabled: boolean;
    skipIdentityInjection: boolean;
    cleanupPatterns: string[];
    customPrefix: string;
    customSuffix: string;
    useSafeGlamour: boolean;
  };
}

export interface LabGenreGuidelineEntry extends LabGenreGuideline { id: string; }

export interface CharacterInfo { identity: string; hair: string; body: string; outfit: string; }

export interface LabScriptOptions {
  topic: string; genre: string; targetAge: string; gender: 'female' | 'male';
  additionalContext?: string; genreGuideOverride?: LabGenreGuideline;
  enableWinterAccessories?: boolean; useRandomOutfits?: boolean;
  allowedOutfitCategories?: string[]; characterSlotMode?: 'slot-only' | 'slot+name';
}

export interface LabImagePromptOptions {
  sceneText: string; characterGender: 'female' | 'male'; characterAge: string;
  bodyType: string; outfit: string; style: string;
  includeQualityTags: boolean; includeAspectRatio: boolean;
}

export const buildLabScriptPrompt = (options: LabScriptOptions): string => buildLabScriptOnlyPrompt(options);

export const buildLabScriptOnlyPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender } = options;
  const genreGuide = LAB_GENRE_GUIDELINES[genre] || LAB_GENRE_GUIDELINES['comedy-humor'];
  const seed = Math.floor(Math.random() * 1000000);
  const narratorName = gender === 'female' ? '지영' : '준호';
  const narratorSlot = gender === 'female' ? 'WomanA' : 'ManA';
  const emotionFlow = genreGuide?.emotionCurve || '';

  const step2Rules = getShortsLabStep2PromptRules();
  const customPrompt = fillStep2PromptTemplate(step2Rules.scriptPrompt, {
    TOPIC: topic,
    GENRE: genreGuide?.name || genre,
    TARGET_AGE: targetAge,
    NARRATOR_SLOT: narratorSlot,
    NARRATOR_NAME: narratorName,
    EMOTION_FLOW: emotionFlow,
    REQUEST_ID: JSON.stringify(seed)
  });
  
  if (customPrompt.trim()) return customPrompt;
  return `[SYSTEM: STRICT JSON OUTPUT ONLY] 주제: ${topic}, 장르: ${genreGuide?.name || genre}, 타겟: ${targetAge}`;
};

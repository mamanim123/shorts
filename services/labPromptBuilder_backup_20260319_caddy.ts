/**
 * labPromptBuilder.ts
 * 쇼츠랩 전용 경량화 프롬프트 빌더
 *
 * v3.5 업데이트 (2026-01-23):
 * - 가슴라인 강조 강화 (voluptuous chest line)
 * - 겨울 방한용품 시스템 도입 (귀도리, 비니, 크롭 패딩 등)
 * - 코미디 장르 최적화 (생생한 표정 및 역동적 포즈 강조)
 * - 의상 일관성 강제 규칙 강화 (lockedOutfits 100% 복사)
 *
 * v3.6 업데이트 (2026-01-23):
 * - 표정(facial expression)을 프롬프트 맨 앞에 배치
 * - 카메라 앵글을 스토리 단계별로 자동 배치
 * - 장르별 표정 키워드 세트 추가
 *
 * v3.7 업데이트 (2026-01-23):
 * - 동작 묘사 강화: action 필드의 한국어 동작을 영어로 자동 변환하여 longPrompt에 반영
 * - 한국어 동작 키워드 매핑 테이블 추가 (60+ 동작 패턴)
 * - 의상 검증 로지 추가: validateOutfit 함수로 의상 명칭 및 길이 검증
 * - 프롬프트에 의상 선택 규칙 강조 섹션 추가
 *
 * v3.7.1 업데이트 (2026-01-23):
 * - pickMaleOutfit 함수에서 골프 주제 특별 처리 제거 (모든 남성/유니섹스 의상 평등 선택)
 * - 겨울 악세서리 정리: 모자, 귀마개, 장갑, 목도리, 신발 카테고리만 유지 (19종 → 16종)
 * - 겨울 아웃웨어 정리: luxurious fur vest 제거 (3종 → 2종)
 *
 * v3.7.2 업데이트 (2026-01-23):
 * - 겨울 아웃웨어 완전 제거 (패딩/재킷 없음, 악세서리만 사용)
 * - applyWinterItems 제거 (겨울 악세서리 자동 적용 삭제)
 *
 * v3.7.3 업데이트 (2026-01-23):
 * - 겨울 키워드 감지 시 상의를 타이트한 긴팔 + 어깨/쇄골 노출 스타일로 변환
 * - Off-shoulder tight-fitting long-sleeve 스타일 강제 적용
 * - 쇄골과 어깨라인 강조로 여성스러움 극대화
 *
 * v3.7.4 업데이트 (2026-01-23):
 * - POV 샷 규칙 명확화: 화면에 보이는 캐릭터만 프롬프트에 포함
 * - POV 샷에서 시점 주인공(카메라 역할) 제외 규칙 강조
 * - 반반 이미지 생성 문제 해결 (캐릭터 중복 방지)
 * - 체크리스트에 POV 검증 항목 2개 추가
 *
 * v3.7.5 업데이트 (2026-01-24):
 * - 캐디(WomanD) 캐릭터 설정 추가: 밝고 세련되고 아름다운 프로페셔널 골프 캐디
 * - 헤어스타일 섹션에 캐디 추가 (high-bun hairstyle)
 * - 캐릭터 설정 섹션 신규 추가 (모든 캐릭터의 성격/특징 명시)
 * - 겨울 악세서리 자동 적용 제거 (수동 악세서리만 사용)
 *
 * v3.7.6 업데이트 (2026-01-24):
 * - scriptBody와 scenes 개수를 8~12개 가변으로 변경 (완전한 1:1 매칭)
 * - 대본 문장 수에 따라 씬 개수가 자동 조절되어 문장 누락 방지
 * - 스토리 복잡도에 따라 유연한 씬 구성 가능 (짧은 스토리 8개, 복잡한 스토리 12개)
 * - 체크리스트 및 프롬프트에 1:1 매칭 규칙 명시
 */

import { UNIFIED_OUTFIT_LIST } from '../constants';
import { buildOutfitPool } from './outfitService';
import type { OutfitPoolItem } from './outfitService';
import { DEFAULT_PROMPT_RULES } from './shortsLabPromptRulesDefaults';
import { getShortsLabPromptRules } from './shortsLabPromptRulesManager';
import { getShortsLabScriptRules } from './shortsLabScriptRulesManager';
import {
  fillStep2PromptTemplate,
  getShortsLabStep2PromptRules
} from './shortsLabStep2PromptRulesManager';
import { getCharacterRules } from './shortsLabCharacterRulesManager';
import type { ShortsLabCharacterRules } from './shortsLabCharacterRulesDefaults';

const DEFAULT_SLOT_NAME_MAP: Record<string, string> = {
  WomanA: '지영',
  WomanB: '혜경',
  WomanC: '미숙',
  WomanD: '캐디',
  ManA: '준호',
  ManB: '민수',
  ManC: '남성 조연'
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getSlotNameMap = (rules: ShortsLabCharacterRules = getCharacterRules()) => {
  const map: Record<string, string> = { ...DEFAULT_SLOT_NAME_MAP };
  const apply = (slots?: Array<{ id?: string; name?: string }>) => {
    if (!Array.isArray(slots)) return;
    slots.forEach((slot) => {
      const id = typeof slot?.id === 'string' ? slot.id : '';
      const name = typeof slot?.name === 'string' ? slot.name.trim() : '';
      if (id && name) {
        map[id] = name;
      }
    });
  };
  apply(rules.females);
  apply(rules.males);
  return map;
};

const applySlotNameOverrides = (text: string, nameMap: Record<string, string>) => {
  if (!text) return text;
  const replacements = Object.entries(DEFAULT_SLOT_NAME_MAP)
    .map(([slot, from], index) => ({
      slot,
      from,
      to: nameMap[slot] || from,
      token: `__SLOT_NAME_${index}__`
    }))
    .filter((item) => item.to && item.from && item.to !== item.from);
  if (replacements.length === 0) return text;

  let updated = text;
  replacements.forEach((item) => {
    const re = new RegExp(escapeRegExp(item.from), 'g');
    updated = updated.replace(re, item.token);
  });
  replacements.forEach((item) => {
    const re = new RegExp(escapeRegExp(item.token), 'g');
    updated = updated.replace(re, item.to);
  });
  return updated;
};

const formatSlotDisplay = (slotId: string, nameMap: Record<string, string>) => {
  const base = slotId.replace('Woman', 'Woman ').replace('Man', 'Man ');
  const name = nameMap[slotId] || '';
  return name ? `${base} (${name})` : base;
};

// ============================================
// 겨울 테마 및 럭셔리 컬렉션 (v3.8.0)
// ============================================

const WINTER_KEYWORDS = ['눈', '겨울', 'snow', 'winter', '스키', 'ski', '썰매', 'sled', 'ice', '빙판', '얼음', 'snowy'];

export const isWinterTopic = (topic: string): boolean =>
  WINTER_KEYWORDS.some((keyword) => topic.toLowerCase().includes(keyword.toLowerCase()));

export const splitOutfitTop = (outfit: string) => {
  const separators = [' + ', ' with ', ' and '];
  for (const separator of separators) {
    const index = outfit.toLowerCase().indexOf(separator.toLowerCase());
    if (index > 0) {
      return {
        top: outfit.slice(0, index),
        tail: outfit.slice(index + separator.length),
        joiner: separator
      };
    }
  }
  return { top: outfit, tail: '', joiner: '' };
};

// 럭셔리 윈터 컬렉션 v3.9.0 (럭셔리 키워드 보강)
const WINTER_COLLECTION = {
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

/**
 * 겨울 아우터 + 악세서리 선택 (v3.8.0)
 */
export const selectWinterItems = (gender: 'female' | 'male' = 'female'): { outerwear: string; accessories: string[] } => {
  const outerwear = '';
  let accessories: string[] = [];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (gender === 'male') {
    const pool = WINTER_COLLECTION.SCARVES;
    accessories = [pick(pool)];
  } else {
    const categories = Object.keys(WINTER_COLLECTION) as Array<keyof typeof WINTER_COLLECTION>;
    const shuffledCats = [...categories].sort(() => 0.5 - Math.random());
    const count = 2;
    accessories = shuffledCats.slice(0, count).map(cat => pick(WINTER_COLLECTION[cat]));
  }
  return { outerwear, accessories };
};

export const getWinterAccessoryPool = (): string[] => {
  return Object.values(WINTER_COLLECTION).flat();
};

// ============================================
// 고유 악세서리 분배 시스템 (v3.9.1 - 마마님 요청)
// ============================================

/**
 * 4개 카테고리로 통합된 겨울 악세서리 풀
 * - Head: 모자 + 귀마개
 * - Neck: 목도리/스카프
 * - Arms: 장갑
 * - Legs: 레그워머/부츠
 */
const ACCESSORY_CATEGORIES = {
  Head: [...WINTER_COLLECTION.HEADWEAR, ...WINTER_COLLECTION.EARMUFFS],
  Neck: WINTER_COLLECTION.SCARVES,
  Arms: WINTER_COLLECTION.GLOVES,
  Legs: WINTER_COLLECTION.LEGS
} as const;

type AccessoryCategory = keyof typeof ACCESSORY_CATEGORIES;

/**
 * 캐릭터별 고유 악세서리 조합 분배
 * 
 * 규칙:
 * 1. 인당 최대 2개 카테고리에서만 선택
 * 2. 캐릭터 간 조합이 절대 중복되지 않음
 * 3. 세션 내 일관성 유지 (한번 할당된 조합은 변하지 않음)
 * 
 * @param characterIds - 캐릭터 ID 목록 (예: ['WomanA', 'WomanB', 'ManA'])
 * @returns 캐릭터별 악세서리 맵
 */
export const distributeUniqueWinterItems = (
  characterIds: string[]
): Record<string, { categories: AccessoryCategory[]; items: string[] }> => {
  const result: Record<string, { categories: AccessoryCategory[]; items: string[] }> = {};
  const usedCombinations = new Set<string>();
  const allCategories: AccessoryCategory[] = ['Head', 'Neck', 'Arms', 'Legs'];

  // 2개 카테고리 조합 생성 (6가지: Head+Neck, Head+Arms, Head+Legs, Neck+Arms, Neck+Legs, Arms+Legs)
  const generateCombinations = (): AccessoryCategory[][] => {
    const combos: AccessoryCategory[][] = [];
    for (let i = 0; i < allCategories.length; i++) {
      for (let j = i + 1; j < allCategories.length; j++) {
        combos.push([allCategories[i], allCategories[j]]);
      }
    }
    return combos.sort(() => 0.5 - Math.random()); // 랜덤 셔플
  };

  const pick = (arr: readonly string[]) => arr[Math.floor(Math.random() * arr.length)];

  const availableCombos = generateCombinations();
  let comboIndex = 0;

  for (const charId of characterIds) {
    let combo: AccessoryCategory[];
    let comboKey: string;

    // 고유한 조합 찾기
    let attempts = 0;
    do {
      if (comboIndex >= availableCombos.length) {
        // 조합이 부족하면 1개 카테고리로 폴백
        const singleCat = allCategories[attempts % allCategories.length];
        combo = [singleCat];
      } else {
        combo = availableCombos[comboIndex];
        comboIndex++;
      }
      comboKey = combo.sort().join('+');
      attempts++;
    } while (usedCombinations.has(comboKey) && attempts < 20);

    usedCombinations.add(comboKey);

    // 각 카테고리에서 아이템 선택
    const items = combo.map(cat => pick(ACCESSORY_CATEGORIES[cat]));

    result[charId] = {
      categories: combo,
      items
    };
  }

  return result;
};

/**
 * 캐릭터의 악세서리를 프롬프트 문자열로 변환
 */
export const formatAccessoriesForPrompt = (
  accessories: { categories: AccessoryCategory[]; items: string[] }
): string => {
  if (!accessories || accessories.items.length === 0) return '';
  return `, accessorized with ${accessories.items.join(', ')}`;
};


// ============================================
// 타입 정의
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

export interface LabGenreGuidelineEntry extends LabGenreGuideline {
  id: string;
}

/**
 * 겨울용 타이트 긴팔 변환 (v3.8.0)
 * 선택된 상의의 디자인(색상, 소재)은 유지하면서 소매만 'Tight-fitting long-sleeve'로 지능적 치환
 * 하의(Mini Skirt, Shorts 등)는 절대 건드리지 않고 원본 그대로 유지함
 */
export const convertToTightLongSleeveWithShoulderLine = (outfit: string): string => {
  if (!outfit) return outfit;

  // 이미 변환된 의상인지 체크 (중복 변환 방지)
  const lowerOutfit = outfit.toLowerCase();
  if (lowerOutfit.includes('fold-over off-shoulder tight-fitting long-sleeve') ||
      lowerOutfit.includes('one-shoulder tight-fitting long-sleeve') ||
      lowerOutfit.includes('cold-shoulder tight-fitting long-sleeve') ||
      (lowerOutfit.includes('tight-fitting long-sleeve') && lowerOutfit.includes('long-sleeve'))) {
    return outfit; // 이미 변환됨, 그대로 반환
  }

  // 상의와 하의 분리 (+, with, and 등의 구분자 사용)
  const separators = [' + ', ' with ', ' and '];
  let top = outfit;
  let tail = '';
  let joiner = '';

  for (const separator of separators) {
    const index = outfit.toLowerCase().indexOf(separator.toLowerCase());
    if (index > 0) {
      top = outfit.slice(0, index);
      tail = outfit.slice(index + separator.length);
      joiner = separator;
      break;
    }
  }

  let newTop = top;

  // 1. 가슴골 노출(Cleavage) 정밀 타겟팅 및 치환
  // 마마님 요청: 쇄골/어깨는 허용, 가슴골만 치환함
  const cleavageKeywords = [
    /deep\s*v[-\s]?neck(?:line)?/gi,
    /deep\s*neck(?:line)?/gi,
    /plunging\s*neckline/gi,
    /\bcleavage\b/gi,
    /\blow-cut\b/gi,
    /\bopen-chest\b/gi
  ];

  let isCleavageBlocked = false;
  cleavageKeywords.forEach((regex) => {
    if (regex.test(newTop)) {
      // 가슴골 노출 키워드가 발견되면 우아한 보트넥이나 모크넥으로 치환 (상의 전체 스타일 고려)
      if (newTop.toLowerCase().includes('knit')) {
        newTop = newTop.replace(regex, 'Elegant boat-neck fitted');
      } else {
        newTop = newTop.replace(regex, 'Elegant mock-neck fitted');
      }
      isCleavageBlocked = true;
    }
  });

  // 2. 어깨/쇄골 노출 스타일 (Off-shoulder 등)은 유지하되 긴팔로 변환
  const shoulderExposureKeywords = [
    { key: 'Off-shoulder', replacement: 'Fold-over off-shoulder tight-fitting long-sleeve' },
    { key: 'One-shoulder', replacement: 'One-shoulder tight-fitting long-sleeve' },
    { key: 'Cold-shoulder', replacement: 'Cold-shoulder tight-fitting long-sleeve' },
    { key: 'Cowl-neck', replacement: 'Elegant cowl-neck tight-fitting long-sleeve' },
    { key: 'Halter-neck', replacement: 'Elegant high-cut off-shoulder long-sleeve' }
  ];

  let isSleeveUpdated = false;
  shoulderExposureKeywords.forEach(({ key, replacement }) => {
    const regex = new RegExp(key, 'gi');
    if (regex.test(newTop)) {
      // 중복 방지: 이미 replacement가 포함되어 있으면 치환하지 않음
      if (!newTop.toLowerCase().includes(replacement.toLowerCase())) {
        newTop = newTop.replace(regex, replacement);
        isSleeveUpdated = true;
      } else {
        isSleeveUpdated = true; // 이미 올바른 형태로 존재
      }
    }
  });

  // 3. 기타 짧은 소매나 슬리브리스 긴팔화
  const generalShortSleeveKeywords = [
    'Sleeveless',
    'Short-sleeve',
    'Tube Top',
    'Cap-sleeve',
    'Twist Front',
    'Camisole'
  ];

  generalShortSleeveKeywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi');
    if (regex.test(newTop)) {
      // 중복 방지: 이미 'tight-fitting long-sleeve'가 포함되어 있으면 치환하지 않음
      if (!newTop.toLowerCase().includes('tight-fitting long-sleeve')) {
        newTop = newTop.replace(regex, 'Tight-fitting long-sleeve');
        isSleeveUpdated = true;
      } else {
        isSleeveUpdated = true; // 이미 올바른 형태로 존재
      }
    }
  });

  // 시스루(See-through)는 안감이 있는 스타일로 안전하게 변환
  if (/\bsee[-\s]?through\b/gi.test(newTop)) {
    newTop = newTop.replace(/\bsee[-\s]?through\b/gi, 'Elegant fitted top with inner panel');
    isSleeveUpdated = true;
  }

  // 4. 최종 보정: 긴팔 키워드가 없는 경우 추가 (중복 방지 강화)
  if (!isSleeveUpdated &&
      !newTop.toLowerCase().includes('long-sleeve') &&
      !newTop.toLowerCase().includes('tight-fitting') &&
      !newTop.toLowerCase().includes('padding') &&
      !newTop.toLowerCase().includes('jacket')) {
    newTop = `Tight-fitting long-sleeve ${newTop}`.replace(/\s+/g, ' ');
  }

  // 5. 체형 강조 유지 보장 (심미성 확보)
  if (!newTop.toLowerCase().includes('hourglass') && !newTop.toLowerCase().includes('slim') && !newTop.toLowerCase().includes('tight')) {
    // 이미 원본 하의나 상의에 체형 키워드가 있을 수 있지만, 상의 변환 시 누락되었다면 보완
    if (top.toLowerCase().includes('hourglass')) newTop += ', slim hourglass figure';
  }

  // 상의와 하의 재결합
  return tail ? `${newTop}${joiner}${tail}` : newTop;
};

/**
 * 기존 프롬프트에 지능적으로 겨울 룩을 입힘 (v3.8.1)
 * 마마님의 고정 문구(START/END/NEGATIVE)를 절대 훼손하지 않고 정밀하게 수술함
 */
export const applyWinterLookToExistingPrompt = (
  longPrompt: string,
  longPromptKo: string,
  gender: 'female' | 'male' = 'female',
  options?: { applyAccessories?: boolean; accessories?: string[] }
): { longPrompt: string; longPromptKo: string } => {
  if (!longPrompt) return { longPrompt, longPromptKo };

  const constants = getPromptConstants();
  let newPrompt = longPrompt;
  let newPromptKo = longPromptKo;

  // 1. 고정 구간 분리 시도 (기술 태그 및 부정 프롬프트 보호)
  // 하이패션 에디토리얼 이후는 기술 태그 구간임
  const technicalTagMarker = 'high-fashion editorial refined';
  const negativeMarker = 'NOT cartoon';

  let contentPart = newPrompt;
  let technicalPart = '';
  let negativePart = '';

  if (newPrompt.includes(negativeMarker)) {
    const parts = newPrompt.split(negativeMarker);
    contentPart = parts[0];
    negativePart = negativeMarker + parts.slice(1).join(negativeMarker);
  }

  if (contentPart.includes(technicalTagMarker)) {
    const parts = contentPart.split(technicalTagMarker);
    contentPart = parts[0];
    technicalPart = technicalTagMarker + parts.slice(1).join(technicalTagMarker);
  }

  // 2. 의상 치환 로직 (contentPart 내에서만 수행, 여성만!)
  // '+', 'wearing', 'outfit:' 등 다양한 패턴 대응
  if (gender === 'female') {
    // 여성 의상 패턴 (Pants는 제외 - 남성 골프팬츠와 혼동 방지)
    const outfitPattern = /([^,]+[\s\+]+[^,]+(?:Mini Skirt|Shorts|Dress|Skirt|Leggings)[^,]*)/i;
    const match = contentPart.match(outfitPattern);

    if (match && match[1]) {
      const originalOutfit = match[1].trim();
      const winterOutfit = convertToTightLongSleeveWithShoulderLine(originalOutfit);
      contentPart = contentPart.replace(originalOutfit, winterOutfit);
    } else if (contentPart.includes('wearing')) {
      const wearingRegex = /wearing\s+([^,.]+)/i;
      const wMatch = contentPart.match(wearingRegex);
      if (wMatch && wMatch[1]) {
        const originalOutfit = wMatch[1];
        // 남성 의상이 아닌지 재확인 (Polo, Golf Pants 등)
        if (!originalOutfit.toLowerCase().includes('polo') &&
            !originalOutfit.toLowerCase().includes('golf pants') &&
            !originalOutfit.toLowerCase().includes('chino pants')) {
          const winterOutfit = convertToTightLongSleeveWithShoulderLine(originalOutfit);
          contentPart = contentPart.replace(originalOutfit, winterOutfit);
        }
      }
    }
  }

  // 3. 겨울 악세서리 추가 (기존 accessorized with가 있어도 병합)
  const applyAccessories = options?.applyAccessories !== false;
  const providedAccessories = options?.accessories || [];
  const { accessories } = providedAccessories.length > 0
    ? { accessories: providedAccessories }
    : selectWinterItems(gender);
  const accsStr = accessories.join(', ');
  if (applyAccessories && accsStr) {
    const lowerContent = contentPart.toLowerCase();
    if (lowerContent.includes('accessorized with')) {
      // 기존 accessorized with 뒤에 겨울 악세서리 추가
      contentPart = contentPart.replace(/accessorized with\s*([^,]*)(,?)/i, (match, existing, tail) => {
        const existingItems = existing
          .split(',')
          .map(item => item.trim())
          .filter(Boolean);
        const merged = Array.from(new Set([...existingItems, ...accessories]));
        return `accessorized with ${merged.join(', ')}${tail || ','}`;
      });
    } else {
      const winterAccsMsg = `, accessorized with ${accsStr}`;
      // 내용 구간 끝에 삽입 (기술 태그 시작 전)
      contentPart = contentPart.trim().replace(/,\s*$/, '') + winterAccsMsg + ', ';
    }
    newPromptKo = `${newPromptKo.replace(' (겨울 룩 적용됨)', '')} (겨울 룩 적용됨: ${accsStr})`;
  }

  // 4. 배경 보정 (눈 내리는 효과 - snow 키워드 없을 때만)
  if (!contentPart.toLowerCase().includes('snow')) {
    contentPart = contentPart.replace(/(standing|walking|looking|sitting|background|setting)/i, `$1 in a heavy snow falling snowy background`);
  }

  // 5. 최종 재조립 (마마님의 고정 문구 순서 그대로 복구)
  newPrompt = contentPart + technicalPart + negativePart;

  return { longPrompt: newPrompt, longPromptKo: newPromptKo };
};

export interface LabScriptOptions {
  topic: string;
  genre: string;
  targetAge: string;
  gender: 'female' | 'male';
  additionalContext?: string;
  genreGuideOverride?: LabGenreGuideline;
  legacyGenrePrompt?: string;
  enableWinterAccessories?: boolean;
  useRandomOutfits?: boolean;
  allowedOutfitCategories?: string[];
  characterSlotMode?: 'slot-only' | 'slot+name';
}

export interface LabImagePromptOptions {
  sceneText: string;
  characterGender: 'female' | 'male';
  characterAge: string;
  bodyType: string;
  outfit: string;
  style: string;
  includeQualityTags: boolean;
  includeAspectRatio: boolean;
}

const buildCharacterSlotInstruction = (mode?: 'slot-only' | 'slot+name'): string => {
  if (!mode) return '';
  if (mode === 'slot+name') {
    const nameMap = getSlotNameMap();
    const womanAName = nameMap.WomanA || '지영';
    const womanBName = nameMap.WomanB || '혜경';
    const womanCName = nameMap.WomanC || '미숙';
    const womanDName = nameMap.WomanD || '캐디';
    const manAName = nameMap.ManA || '준호';
    const manBName = nameMap.ManB || '민수';
    const manCName = nameMap.ManC || '남성 조연';
    return `## 👥 캐릭터 슬롯 안내
대본에는 아래 이름/호칭을 **서로 구분되게** 사용하세요. (복수 표현 금지)
- WomanA = ${womanAName} (주인공)
- WomanB = ${womanBName} (상대/친구)
- WomanC = ${womanCName} (관찰자/조연)
- WomanD = ${womanDName} (캐디, 고정)
- ManA = ${manAName} (남성 주연)
- ManB = ${manBName} (남성 조연)
- ManC = ${manCName}
규칙: 캐디는 항상 WomanD로 고정합니다.`;
  }
  return `## 👥 캐릭터 슬롯 안내
대본에는 인물을 **개별로 구분**해서 표현하세요. (복수 표현 금지)
- 슬롯 ID: WomanA, WomanB, WomanC, WomanD, ManA, ManB, ManC
- 이름은 고정하지 말고 "주인공/친구/상대/조연"처럼 역할로 표기
- 캐디는 항상 WomanD로 고정합니다.`;
};

const sanitizeLegacyGenrePrompt = (prompt?: string): string => {
  if (!prompt) return '';
  return String(prompt).replace(/```/g, '').trim();
};

const buildLegacyGenreBlock = (prompt?: string): string => {
  const cleaned = sanitizeLegacyGenrePrompt(prompt);
  if (!cleaned) return '';
  return `## 🧩 레거시 장르 지침 (참고)
⚠️ 아래 지침 중 "출력 형식/JSON/표/포맷" 관련 지시는 모두 무시하고, 톤/구조/금지사항만 참고할 것.
${cleaned}
`;
};

export const buildLabScriptOnlyPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender } = options;
  const genreGuide = options.genreGuideOverride || LAB_GENRE_GUIDELINES[genre];
  const seed = generateRandomSeed();
  const narratorSlot = gender === 'female' ? 'WomanA' : 'ManA';
  const slotNames = getSlotNameMap();
  const narratorName = slotNames[narratorSlot] || (gender === 'female' ? '지영' : '준호');
  const emotionFlow = genreGuide?.emotionCurve || '';
  const slotInstruction = buildCharacterSlotInstruction(options.characterSlotMode);

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
  if (customPrompt.trim()) {
    return slotInstruction ? `${customPrompt}\n\n${slotInstruction}` : customPrompt;
  }

  const slotBlock = slotInstruction ? `${slotInstruction}\n\n` : '';
  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 유튜브 쇼츠 대본 전문 작가입니다.
아래 주제/장르/연령에 맞는 대본만 생성하세요.
이미지 프롬프트나 scenes는 절대 생성하지 않습니다.

주제: ${topic}
장르: ${genreGuide?.name || genre}
타겟 연령: ${targetAge}

${slotBlock}출력은 반드시 아래 JSON 형식 하나만:
{
  "title": "제목",
  "titleOptions": ["옵션1", "옵션2", "옵션3"],
  "scriptBody": "문장1\\n문장2... (8~12개 문장)",
  "punchline": "펀치라인",
  "hook": "HOOK 문장",
  "twist": "TWIST 문장",
  "foreshadowing": "복선 문장",
  "narrator": { "slot": "${narratorSlot}", "name": "${narratorName}" },
  "emotionFlow": "${emotionFlow}"
}

규칙:
1) scriptBody는 8~12문장 (문장마다 반드시 줄바꿈, 1줄=1문장)
2) 1문장 = 훅(강한 시작)
3) 2~3문장 = 배경/상황 설명 (각 문장은 독립된 한 줄)
4) 4~7문장 = 전개/행동
5) 8~10문장 = 반전/결말 (각 문장은 독립된 한 줄)
6) 대사는 자연스러운 구어체 한국어
7) scenes/longPrompt/shortPrompt 절대 포함 금지
8) 마크다운 금지, JSON만 출력

[Request ID: ${seed}]`;
};

// ============================================
// v3.6 - 장르별 표정 키워드 & 카메라 앵글 (규칙 파일 연동)
// ============================================

const getActivePromptRules = () => getShortsLabPromptRules() || DEFAULT_PROMPT_RULES;
export const getPromptConstants = () => {
  const baseConstants = getActivePromptRules().promptConstants || DEFAULT_PROMPT_RULES.promptConstants;
  const rules = getCharacterRules();

  return {
    ...baseConstants,
    FEMALE_BODY_A: rules.females[0]?.body || 'slim hourglass figure',
    FEMALE_BODY_B: rules.females[1]?.body || 'petite and slim frame',
    FEMALE_BODY_C: rules.females[2]?.body || 'gracefully toned athletic body',
    FEMALE_BODY_D: rules.females[3]?.body || 'bright cheerful professional presence, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    MALE_BODY: rules.males[0]?.body || 'fit athletic build',

    MALE_BODY_A: rules.males[0]?.body || 'fit athletic build',
    MALE_BODY_B: rules.males[1]?.body || 'fit athletic build',
    MALE_BODY_C: rules.males[2]?.body || 'well-built physique'
  };
};
const getNoTextTag = () => getActivePromptRules().noTextTag || DEFAULT_PROMPT_RULES.noTextTag;
const shouldEnforceKoreanIdentity = () => getActivePromptRules().enforceKoreanIdentity !== false;
export const getExpressionKeywordMap = () =>
  getActivePromptRules().expressionKeywords || DEFAULT_PROMPT_RULES.expressionKeywords;
export const getCameraMapping = () =>
  getActivePromptRules().cameraMapping || DEFAULT_PROMPT_RULES.cameraMapping;
const getOutfitSelectionRules = () =>
  getActivePromptRules().outfitSelection || DEFAULT_PROMPT_RULES.outfitSelection;

// 장면 번호 → 스토리 단계 매핑 (12장면 기준)
export const getStoryStageBySceneNumber = (sceneNumber: number, totalScenes: number = 12): string => {
  const ratio = sceneNumber / totalScenes;

  if (sceneNumber === 1) return 'hook';
  if (ratio <= 0.25) return 'setup';
  if (ratio <= 0.5) return 'buildup';
  if (ratio <= 0.7) return 'climax';
  if (ratio <= 0.85) return 'twist';
  return 'outro';
};

// 장르 ID에서 표정 키워드 가져오기
export const getExpressionForScene = (genre: string, storyStage: string): string => {
  const genreKey = genre.toLowerCase().replace(/\s+/g, '-').replace(/[\/\\]/g, '-');
  const expressionMap = getExpressionKeywordMap();
  const expressions = expressionMap[genreKey] || expressionMap['default'];
  return expressions[storyStage] || expressions['hook'];
};

// 카메라 앵글 프롬프트 가져오기
export const getCameraPromptForScene = (storyStage: string): string => {
  const cameraMap = getCameraMapping();
  const mapping = cameraMap[storyStage] || cameraMap['buildup'];
  return mapping.prompt;
};

// ============================================
// 카메라 앵글 다양화 시스템 (v3.9.1 - 마마님 요청)
// ============================================

/**
 * 씬별 권장 카메라 앵글 (쇼츠 영상 최적화)
 * 12씬 기준: close-up 2개, medium 2개, wide/full-body 4개 + 다양한 dynamic 앵글
 * 시원시원하고 역동적인 구성
 */
const SCENE_ANGLE_MAP: Record<number, { angle: string; prompt: string }> = {
  1: { angle: 'close-up', prompt: 'close-up portrait shot, face in focus, shallow depth of field, dramatic lighting, eye contact with camera' },
  2: { angle: 'wide/full-body', prompt: 'wide full body shot, entire body visible head to toe, background visible, natural environment context, deep focus' },
  3: { angle: 'over-the-shoulder', prompt: 'over-the-shoulder shot, perspective view, showing interaction between two people, natural conversation angle' },
  4: { angle: 'wide/full-body', prompt: 'wide landscape shot, full body visible, background emphasis, deep focus, environment storytelling' },
  5: { angle: 'close-up', prompt: 'close-up emotional shot, dramatic expression, face in focus, shallow depth of field, capturing peak emotion' },
  6: { angle: 'over-the-shoulder', prompt: 'over-the-shoulder dialogue shot, intimate conversation angle, showing facial reactions' },
  7: { angle: 'wide/full-body', prompt: 'wide shot, full body visible, action and movement emphasized, natural environment context' },
  8: { angle: 'medium', prompt: 'medium shot, waist-up framing, natural interaction, balanced composition' },
  9: { angle: 'low-angle/wide', prompt: 'low-angle wide shot, dynamic perspective, full body visible, powerful composition, environment storytelling' },
  10: { angle: 'wide/full-body', prompt: 'wide establishing shot, full body, context visible, background details, deep focus' },
  11: { angle: 'medium', prompt: 'medium shot, upper body focus, natural conversation pose, emotional connection' },
  12: { angle: 'aerial', prompt: 'aerial drone view, bird\'s-eye perspective, final scene, sweeping wide shot, cinematic ending' }
};

/**
 * 연속 중복 방지를 위한 앵글 히스토리 추적
 */
let angleHistory: string[] = [];

/**
 * 앵글 히스토리 리셋 (새 생성 세션 시작 시 호출)
 */
export const resetAngleHistory = (): void => {
  angleHistory = [];
};

const CAMERA_SEGMENT_REGEX = /\b(close[-\s]?up|over-the-shoulder|over the shoulder|drone|aerial|bird['’]s-eye|pov|point of view|low-angle|high-angle|establishing)\b/i;

const isCameraSegment = (segment: string): boolean => {
  const normalized = segment.toLowerCase();
  if (CAMERA_SEGMENT_REGEX.test(normalized)) return true;
  if (/(medium|wide|full|long)/.test(normalized) && /(shot|view|angle|framing)/.test(normalized)) return true;
  if (normalized.includes('full body')) return true;
  return false;
};

const extractCameraPhraseFromText = (text: string): string => {
  if (!text) return '';
  const segments = text.split(',').map(part => part.trim()).filter(Boolean);
  for (const segment of segments) {
    if (isCameraSegment(segment)) return segment;
  }
  return '';
};

const normalizeCameraAngleLabel = (segment: string): string => {
  const normalized = segment.toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('pov') || normalized.includes('point of view')) return 'pov';
  if (normalized.includes('drone') || normalized.includes('aerial') || normalized.includes('bird')) return 'aerial';
  if (normalized.includes('over-the-shoulder') || normalized.includes('over the shoulder')) return 'over-shoulder';
  if (normalized.includes('close-up') || normalized.includes('close up')) return 'close-up';
  if (normalized.includes('low-angle')) return 'low-angle';
  if (normalized.includes('high-angle')) return 'high-angle';
  if (normalized.includes('wide') || normalized.includes('establishing')) return 'wide';
  if (normalized.includes('full') && (normalized.includes('shot') || normalized.includes('body'))) return 'full';
  if (normalized.includes('long shot')) return 'full';
  if (normalized.includes('medium')) return 'medium';
  return 'custom';
};

const stripExactCameraPhrase = (text: string, phrase: string): string => {
  if (!text || !phrase) return text;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\s*,?\\s*${escaped}\\s*,?`, 'i'), ', ');
};

/**
 * 스마트 카메라 앵글 선택
 * - 연속 2회 이상 동일 앵글 사용 방지
 * - 3회 연속 동일 앵글 절대 금지
 * - 와이드 샷 비중 확보
 * 
 * @param sceneNumber - 씬 번호 (1-12)
 * @param totalScenes - 전체 씬 수
 * @returns 카메라 앵글 프롬프트
 */
export const getSmartCameraPrompt = (sceneNumber: number, totalScenes: number = 12): { angle: string; prompt: string } => {
  // 기본 권장 앵글 가져오기
  const recommended = SCENE_ANGLE_MAP[sceneNumber] || SCENE_ANGLE_MAP[Math.min(sceneNumber, 12)];

  // 연속 중복 체크
  const lastTwo = angleHistory.slice(-2);

  // 같은 앵글이 2번 연속이면 대체 앵글 선택
  if (lastTwo.length >= 2 && lastTwo.every(a => a === recommended.angle)) {
    const alternates: { angle: string; prompt: string }[] = [
      { angle: 'wide', prompt: 'wide shot, full body visible, environment context, deep focus' },
      { angle: 'medium', prompt: 'medium shot, waist-up framing, natural pose' },
      { angle: 'over-the-shoulder', prompt: 'over-the-shoulder shot, perspective view' }
    ].filter(alt => alt.angle !== recommended.angle);

    const chosen = alternates[0];
    angleHistory.push(chosen.angle);
    return chosen;
  }

  angleHistory.push(recommended.angle);
  return recommended;
};

/**
 * 현재 씬까지의 와이드 샷 개수 확인
 */
export const getWideAngleCount = (): number => {
  return angleHistory.filter(a => a === 'wide').length;
};


// ============================================
// 한국어 동작 → 영어 변환 매핑 테이블
// ============================================

export const ACTION_KEYWORD_MAPPING: Record<string, string> = {
  // 골프 관련
  '골프채를 휘두르다': 'swinging golf club',
  '골프채를 휘두르는': 'swinging golf club',
  '골프 스윙': 'golf swing motion',
  '퍼팅하다': 'putting golf ball',

  // 손 동작
  '손을 흔들다': 'waving hand',
  '손을 흔드는': 'waving hand',
  '손가락질하다': 'pointing finger',
  '손바닥으로 가리다': 'covering with palm',
  '박수치다': 'clapping hands',
  '주먹 쥐다': 'clenching fist',

  // 물건 관련
  '가방을 꽉 쥐다': 'clutching bag tightly',
  '가방을 꽉 쥐는': 'clutching bag tightly',
  '리모컨을 들다': 'holding remote control',
  '리모컨을 들고': 'holding remote control',
  '핸드폰을 보다': 'looking at phone',
  '서류를 펼치다': 'spreading documents',
  '잔을 들다': 'holding glass',
  '컵을 들다': 'holding cup',

  // 머리/얼굴 동작
  '고개를 갸우뚱': 'tilting head',
  '고개를 끄덕이다': 'nodding head',
  '고개를 저으며': 'shaking head',
  '입을 가리다': 'covering mouth',
  '입을 가리며': 'covering mouth',
  '눈을 감다': 'closing eyes',
  '눈을 크게 뜨다': 'wide eyes open',
  '이마를 짚다': 'touching forehead',
  '턱을 괴다': 'resting chin on hand',

  // 이동/자세
  '걷다': 'walking',
  '뛰다': 'running',
  '앉다': 'sitting down',
  '일어서다': 'standing up',
  '돌아서다': 'turning around',
  '몸을 숙이다': 'bending forward',
  '팔짱을 끼다': 'crossing arms',
  '허리에 손을 올리다': 'hands on hips',

  // 감정 표현 동작
  '한숨을 쉬다': 'sighing deeply',
  '웃으며': 'while smiling',
  '미소짓다': 'smiling',
  '찡그리다': 'frowning',
  '놀라며': 'looking surprised',
  '당황하며': 'looking flustered',

  // 대화 관련
  '속삭이다': 'whispering',
  '소리지르다': 'shouting',
  '대화하다': 'having conversation',
  '대화하는': 'having conversation',
  '말하다': 'talking',
  '말하며': 'while talking',

  // 기타
  '뒤돌아보다': 'looking back',
  '쳐다보다': 'staring at',
  '응시하다': 'gazing at',
  '피하다': 'avoiding',
  '다가가다': 'approaching',
  '멀어지다': 'moving away'
};

/**
 * 한국어 동작 텍스트를 영어로 변환
 * 매핑 테이블의 키워드를 찾아 영어로 변환하고, 없으면 원문 반환
 */
export const translateActionToEnglish = (action: string): string => {
  if (!action) return '';

  let translated = action;
  let foundMatch = false;

  // 매핑 테이블에서 가장 긴 매치부터 찾기 (부분 문자열 문제 방지)
  const sortedKeys = Object.keys(ACTION_KEYWORD_MAPPING).sort((a, b) => b.length - a.length);

  for (const koreanKey of sortedKeys) {
    if (translated.includes(koreanKey)) {
      translated = translated.replace(koreanKey, ACTION_KEYWORD_MAPPING[koreanKey]);
      foundMatch = true;
    }
  }

  // 매핑을 찾지 못한 경우 원문 반환 (영어일 수도 있음)
  return foundMatch ? translated : action;
};

// ============================================
// 마마님 취향 반영 캐릭터 프리셋
// ============================================

// 의상 규칙을 동적으로 가져오는 함수
export const getMAMACharacterPresets = () => {
  const rules = getCharacterRules();

  return {
    FEMALE_A: {
      identity: rules.females[0]?.identity || 'A stunning Korean woman',
      bodyType: rules.females[0]?.body || 'slim hourglass figure',
      style: rules.females[0]?.style || 'sophisticated look',
      outfitFit: rules.females[0]?.outfitFit || 'tight-fitting, form-hugging'
    },
    FEMALE_B: {
      identity: rules.females[1]?.identity || 'A stunning Korean woman',
      bodyType: rules.females[1]?.body || 'petite and slim frame',
      style: rules.females[1]?.style || 'charming presence',
      outfitFit: rules.females[1]?.outfitFit || 'tight-fitting, form-hugging'
    },
    FEMALE_C: {
      identity: rules.females[2]?.identity || 'A stunning Korean woman',
      bodyType: rules.females[2]?.body || 'gracefully toned athletic body',
      style: rules.females[2]?.style || 'elegant presence',
      outfitFit: rules.females[2]?.outfitFit || 'tight-fitting, form-hugging'
    },
    FEMALE_D: {
      identity: rules.females[3]?.identity || 'A stunning Korean woman',
      bodyType: rules.females[3]?.body || 'bright cheerful professional presence',
      style: rules.females[3]?.style || 'sophisticated caddy look',
      outfitFit: rules.females[3]?.outfitFit || 'tight-fitting, form-hugging'
    },
    // 하위 호환성을 위한 기본 FEMALE (Woman A와 동일)
    FEMALE: {
      identity: rules.females[0]?.identity || 'A stunning Korean woman',
      bodyType: rules.females[0]?.body || 'slim hourglass figure',
      style: rules.females[0]?.style || 'sophisticated look',
      outfitFit: rules.females[0]?.outfitFit || 'tight-fitting, form-hugging'
    },
    MALE: {
      identity: rules.males[0]?.identity || 'A handsome Korean man',
      bodyType: rules.males[0]?.body || 'fit athletic build',
      style: rules.males[0]?.style || 'refined presence',
      outfitFit: rules.males[0]?.outfitFit || 'tailored slim-fit'
    }
  };
};

// 하위 호환성을 위한 getter
export const MAMA_CHARACTER_PRESETS = getMAMACharacterPresets();

// ============================================
// 이미지 프롬프트 고정 문구 (v3.5.5 - 마마님 요청: 상수 동적화)
// ============================================

/**
 * [CRITICAL] 고정 상수를 함수로 변경하여 실시간 규칙 수정을 즉시 반영함.
 * 이제 새로고침 없이도 프롬프트 규칙 수정이 생성 결과에 즉시 적용됨.
 */
export const PROMPT_CONSTANTS_PROXY = {
  get START() { return getPromptConstants().START; },
  get FEMALE_BODY() { return getPromptConstants().FEMALE_BODY; },
  get FEMALE_BODY_A() { return getPromptConstants().FEMALE_BODY_A; },
  get FEMALE_BODY_B() { return getPromptConstants().FEMALE_BODY_B; },
  get FEMALE_BODY_C() { return getPromptConstants().FEMALE_BODY_C; },
  get FEMALE_BODY_D() { return getPromptConstants().FEMALE_BODY_D; },
  get MALE_BODY() { return getPromptConstants().MALE_BODY; },
  get MALE_BODY_A() { return getPromptConstants().MALE_BODY_A; },
  get MALE_BODY_B() { return getPromptConstants().MALE_BODY_B; },
  get MALE_BODY_C() { return getPromptConstants().MALE_BODY_C; },
  get END() { return getPromptConstants().END; },
  get NEGATIVE() { return getPromptConstants().NEGATIVE; }
};

// 하위 호환성을 위해 PROMPT_CONSTANTS는 그대로 유지하되 내부는 동적 게터로 연결
export const PROMPT_CONSTANTS = PROMPT_CONSTANTS_PROXY;

export const enforceKoreanIdentity = (text: string, targetAgeLabel?: string, sceneNumber?: number, gender: 'female' | 'male' = 'female'): string => {
  if (!text) return text;
  if (!shouldEnforceKoreanIdentity()) return text;
  let updated = text;

  const replacements: Array<[RegExp, string]> = [
    [/\b(Vietnamese|Vietnam|Thai|Thailand|Japanese|Japan|Chinese|China|American|Europe(?:an)?|Western)\b/gi, 'Korean'],
    [/(베트남|베트남인|태국|일본|중국|미국|서양|서구)/g, '한국인']
  ];
  replacements.forEach(([regex, value]) => {
    updated = updated.replace(regex, value);
  });

  const formatEnglishAgeLabel = (label?: string): string => {
    if (!label) return '';
    const match = label.match(/\d+/);
    return match ? `${match[0]}s` : '';
  };

  const englishAge = formatEnglishAgeLabel(targetAgeLabel);
  const ageString = englishAge ? `in ${gender === 'female' ? 'her' : 'his'} ${englishAge}` : '';
  const identityDescriptor = gender === 'female'
    ? `A stunning Korean woman ${ageString}`.trim()
    : `Korean man ${ageString}`.trim();

  const scenePrefix = sceneNumber ? `Scene ${sceneNumber}, ` : '';
  const mandatoryPrefix = `${scenePrefix}${identityDescriptor}, `;

  const cleanText = updated
    .replace(/^Scene \d+[\.,]\s*/i, '')
    .replace(/^A stunning Korean woman in her [\d\w\s]+[\.,]\s*/i, '')
    .replace(/^A handsome Korean man in his [\d\w\s]+[\.,]\s*/i, '')
    .replace(/^A stunning Korean woman[\.,]\s*/i, '')
    .replace(/^A handsome Korean man[\.,]\s*/i, '')
    .replace(/^in (her|his) [\d\w\s]+[\.,]\s*/i, '')
    .trim();

  const cameraAnglePattern = /^(Candid|Two-shot|Three-shot|Dutch|Extreme|Close-up|Wide|Medium|Over-the-shoulder|Zoom|Pan|Tracking|Bird|Aerial|Low|High|Point of view|POV)/i;
  if (cameraAnglePattern.test(cleanText)) {
    return `${scenePrefix}${identityDescriptor}, ${cleanText}`;
  }

  return `${mandatoryPrefix}${cleanText}`;
};

export const enhanceScenePrompt = (
  text: string = "",
  options: {
    sceneNumber?: number;
    femaleOutfit?: string;
    maleOutfit?: string;
    targetAgeLabel?: string;
    gender?: 'female' | 'male';
    genre?: string;           // v3.6: 장르 추가
    totalScenes?: number;     // v3.6: 전체 장면 수 추가
    action?: string;          // v3.7: 동작 묘사 추가
    cameraAngle?: string;     // v3.9.3: LLM 카메라 앵글 우선 존중
    forceCameraAngle?: boolean; // v3.10: LLM 카메라 앵글 무시하고 강제 적용
  } = {}
): string => {
  if (!text) return text;
  let updated = text.trim();

  // v3.6: 스토리 단계 결정 및 표정/카메라 앵글 추출
  const sceneNum = options.sceneNumber || 1;
  const totalScenes = options.totalScenes || 12;
  const storyStage = getStoryStageBySceneNumber(sceneNum, totalScenes);
  const genre = options.genre || 'default';

  // 표정 키워드 (맨 앞에 배치할 것)
  const expressionKeywords = getExpressionForScene(genre, storyStage);

  const rawCameraAngle = options.cameraAngle ? options.cameraAngle.trim() : '';
  const hasHangul = /[가-힣]/.test(rawCameraAngle);
  const cameraFromOption = !hasHangul && /shot|view|pov|angle|framing/i.test(rawCameraAngle) ? rawCameraAngle : '';
  const cameraFromText = cameraFromOption ? '' : extractCameraPhraseFromText(updated);
  const inferredCameraPrompt = cameraFromOption || cameraFromText;
  const forceCameraAngle = options.forceCameraAngle === true;
  const llmCameraPrompt = forceCameraAngle ? '' : inferredCameraPrompt;

  const llmAngleLabel = normalizeCameraAngleLabel(llmCameraPrompt);
  const lastTwo = angleHistory.slice(-2);
  const shouldOverrideLlmCamera = llmCameraPrompt
    ? (llmAngleLabel !== 'custom' && lastTwo.length >= 2 && lastTwo.every(a => a === llmAngleLabel))
    : false;

  let cameraPrompt = '';
  if (llmCameraPrompt && !shouldOverrideLlmCamera) {
    cameraPrompt = llmCameraPrompt;
    angleHistory.push(llmAngleLabel || 'custom');
  } else {
    const fallback = getSmartCameraPrompt(sceneNum, totalScenes);
    cameraPrompt = fallback.prompt;
  }

  // v3.7: 동작 묘사 영어 변환
  let actionPrompt = '';
  if (options.action) {
    actionPrompt = translateActionToEnglish(options.action);
  }

  const llmProvidedOutfit = updated.includes("Outfit:");
  
  // 멀티 캐릭터 장면 체크: [Person 1] 등의 구분자가 있으면 단일 의상 태그 추가하지 않음
  const isMultiCharacterScene = /\[Person\s+\d+\]|\[\s*Person/i.test(updated);

  if (!isMultiCharacterScene && !llmProvidedOutfit && options.gender === 'male' && options.maleOutfit) {
    const maleTag = `Outfit: ${options.maleOutfit}`;
    if (!updated.includes(maleTag) && !updated.includes(options.maleOutfit)) {
      updated += `, ${maleTag}`;
    }
  } else if (!isMultiCharacterScene && !llmProvidedOutfit && options.femaleOutfit) {
    const femaleTag = `Outfit: ${options.femaleOutfit}`;
    if (!updated.includes(femaleTag) && !updated.includes(options.femaleOutfit)) {
      updated += `, ${femaleTag}`;
    }
  }

  // v3.6: 표정과 카메라 앵글을 맨 앞에 삽입
  // LLM 카메라가 있으면 동일 문구 중복 제거
  if (forceCameraAngle) {
    if (inferredCameraPrompt) {
      updated = stripExactCameraPhrase(updated, inferredCameraPrompt);
      updated = updated.replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').replace(/^,\s*/, '').trim();
    } else {
      const existingCameraPattern = /^(close-up|medium shot|wide shot|extreme close-up|over-the-shoulder)[^,]*,?\s*/i;
      updated = updated.replace(existingCameraPattern, '');
    }
  } else if (llmCameraPrompt) {
    updated = stripExactCameraPhrase(updated, llmCameraPrompt);
    updated = updated.replace(/,\s*,/g, ', ').replace(/\s{2,}/g, ' ').replace(/^,\s*/, '').trim();
  } else {
    const existingCameraPattern = /^(close-up|medium shot|wide shot|extreme close-up|over-the-shoulder)[^,]*,?\s*/i;
    updated = updated.replace(existingCameraPattern, '');
  }

  // Scene 번호 처리
  if (options.sceneNumber !== undefined) {
    updated = updated.replace(/^Scene \d+\.?\s*/i, '');
  }

  const noTextTag = getNoTextTag();
  if (noTextTag && !updated.toLowerCase().includes("no text")) {
    updated += `, ${noTextTag}`;
  }

  updated = enforceKoreanIdentity(updated, options.targetAgeLabel, options.sceneNumber, options.gender);

  // v3.7: 최종 프롬프트 조립 - [표정] + [카메라] + [동작] + [기존 내용]
  // Scene 번호 제거 후 재조립
  const sceneMatch = updated.match(/^Scene \d+[.,]?\s*/i);
  const scenePrefix = sceneMatch ? sceneMatch[0] : (options.sceneNumber ? `Scene ${options.sceneNumber}. ` : '');
  const contentWithoutScene = updated.replace(/^Scene \d+[.,]?\s*/i, '').trim();

  // 최종 조립: Scene N. [표정], [카메라], [동작], [내용]
  // 동작이 있으면 카메라 앵글과 배경 사이에 삽입
  let finalPrompt: string;
  if (actionPrompt) {
    finalPrompt = `${scenePrefix}[${expressionKeywords}], ${cameraPrompt}, ${actionPrompt}, ${contentWithoutScene}`;
  } else {
    finalPrompt = `${scenePrefix}[${expressionKeywords}], ${cameraPrompt}, ${contentWithoutScene}`;
  }

  return finalPrompt;
};

export const extractNegativePrompt = (text: string): { cleaned: string; negative: string } => {
  if (!text) return { cleaned: text, negative: '' };
  const negative = getPromptConstants().NEGATIVE;
  if (!negative || !text.includes(negative)) return { cleaned: text, negative: '' };
  const cleaned = text
    .replace(negative, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/g, '')
    .trim();
  return { cleaned, negative };
};

// ============================================
// 샷 타입별 프롬프트 템플릿 (v3.2 - 캐릭터 구분자 시스템)
// ============================================

export const SHOT_TEMPLATES = {
  // 원샷: 1명 캐릭터만 등장
  SINGLE: {
    description: '1명 캐릭터 단독 등장',
    format: '[Character] identity, hair, body, wearing outfit, [Action], [Background]',
  },

  // 투샷: 2명 캐릭터 등장 - 반드시 [Person 1], [Person 2]로 구분
  TWO_SHOT: {
    description: '2명 캐릭터 상호작용',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Interaction], [Background], two distinct individuals, not twins, different faces',
  },

  // 쓰리샷: 3명 캐릭터 등장 - 반드시 [Person 1], [Person 2], [Person 3]로 구분
  THREE_SHOT: {
    description: '3명 캐릭터 함께 등장',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Person 3: identity, hair, body, wearing outfit] [Group Action], [Background], three distinct individuals, not twins, different faces',
  },

  // v3.3 - 카메라 앵글 (영상 다양성을 위한 샷 타입)
  CAMERA_ANGLES: {
    CLOSE_UP: {
      name: '클로즈업',
      promptKeyword: 'close-up portrait shot, face in focus, shallow depth of field',
      usage: 'Hook/Twist 감정 강조, 충격/당황/긴장 순간',
    },
    MEDIUM_SHOT: {
      name: '미디엄샷',
      promptKeyword: 'medium shot, waist-up framing, natural pose',
      usage: '대화, 일반적인 상호작용',
    },
    WIDE_SHOT: {
      name: '와이드샷',
      promptKeyword: 'wide establishing shot, full body visible, environment context',
      usage: '장소 전환, 상황 설정, 첫 등장',
    },
    OVER_SHOULDER: {
      name: '오버숄더',
      promptKeyword: 'over-the-shoulder shot, perspective view',
      usage: '한쪽 시점 강조, 긴장감 고조, 대면 상황',
    },
    POV: {
      name: 'POV',
      promptKeyword: 'first-person POV shot, subjective camera angle',
      usage: '몰입감 강화, 소품/명함 클로즈업',
    }
  }
};

// ============================================
// 40~60대 타겟 장르 지침 (v3.5)
// ============================================

export const LAB_GENRE_GUIDELINES: Record<string, LabGenreGuideline> = {

  'comedy-humor': {
    name: '코미디 / 유머',
    description: '중년의 일상에서 벌어지는 황당하고 웃긴 상황. 화보 같은 느낌보다는 **생생하고 익살스러운 표정**과 **역동적인 굴욕 포즈**가 핵심.',
    emotionCurve: '😊 평화 → 😳 당황 → 😱 충격 → 🤦 민망 → 😂 자폭 웃음',
    structure: `
[HOOK] 🎯 황당한 결과를 첫 문장에 즉시 제시 (일상적 시작 금지!)
✅ 추천 패턴:
1. 충격적 결과 먼저: "오늘 헬스장에서 딸 레깅스 입고 운동했지 뭐야"
2. 황당한 상황 즉시: "계단 3층 올라가는데 숨이 턱까지 차더라고"
3. 민망한 순간 직접: "근데 그 사람이 돌아보는 순간 눈이 마주쳤어"
4. 결과 스포일러: "결국 그날 헬스장 다시 못 가게 됐어"

❌ 금지 패턴:
- "오늘 헬스장에 갔어" (일상 브이로그처럼 느껴짐)
- "최근에 이상한 일이 생겼어" (추상적)

[SETUP] 😊 평화로운 일상 + 복선(Foreshadowing)
→ 아무것도 모른 채 잘난 척하거나 자신만만한 모습
→ 나중에 반전이 될 힌트를 슬쩍 흘림
→ 예: "새로 산 옷이 잘 맞는다고 생각했어"

[BUILD-UP] 😳 오해의 심화
→ 주변의 이상한 시선, 수군거림
→ "뭔가 이상한데..." 느끼지만 계속 진행
→ 어깨에 힘 들어가는 상황

[CLIMAX] 😱 진실의 목격/폭로
→ 가장 민망한 순간에 정체가 탄로남
→ "집에 와 보니...", "거울을 보는 순간..."
→ 알고보니: 착각, 실수, 잘못된 선택

[TWIST] 🤦 민망함의 극치 + 황당한 진실
→ 원인 공개: 착각했던 이유, 실수한 진짜 원인
→ 예: "내가 입고 간 건 딸 압박복이었어", "내 바지가 아니라 남편 거였어"

[OUTRO] 😂 자폭하며 마무리
→ "이게 뭐야 진짜", "XX 다시 못 가겠어"
→ 자학 + 다짐 또는 체념

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 코미디 상황 카테고리 (5가지 - 주제에 맞게 선택)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ 실수형 - 물건/옷 착각
   예시 주제: 딸 레깅스 입고 헬스장, 남편 바지 입고 출근
   패턴: 다른 사람 물건을 내 것으로 착각 → 입고 나감 → 나중에 발각

2️⃣ 착각형 - 상황 오해
   예시 주제: 손님을 지인으로 착각하고 반말, 잘못된 사람한테 인사
   패턴: 뒷모습/소리로 착각 → 친근하게 대함 → 다른 사람임을 깨달음

3️⃣ 세대차형 - 디지털/신기술 실패
   예시 주제: 스마트폰 오작동, AI 스피커와 싸움, 앱 사용 실패
   패턴: 새 기능 사용 시도 → 잘못 조작 → 황당한 결과

4️⃣ 몸치형 - 운동/춤 실패
   예시 주제: 요가 자세 실패, 댄스 따라하다 넘어짐
   패턴: 자신만만하게 시작 → 몸이 안 따라줌 → 민망한 순간

5️⃣ 과시형 - 잘난 척하다 망신
   예시 주제: 골프 실력 자랑하다 헛스윙, 영어 자랑하다 틀림
   패턴: 자신 있게 과시 → 주변의 기대 → 실패 → 체면 구겨짐

⚠️ 중요: 위 카테고리 중 하나를 선택하고, 주제에 맞게 창작할 것!
`,
    killerPhrases: [
      // ⚠️ 아래는 참고용 패턴! 그대로 복사하지 말고 주제에 맞게 새롭게 창작할 것
      '드디어 올 게 왔구나 싶었지',
      '심장이 철렁 내려앉더라고',
      '어깨에 힘이 빡 들어가더라고',
      '멋진 척 한 번 해봤지',
      '아무것도 모르고 신나있었어',
      '그때까지만 해도 좋았어',
    ],
    supportingCharacterPhrasePatterns: [
      '조연이 화자의 가족/지인을 알아보는 대사 ("어머, OO씨 남편분이시네요!")',
      '조연이 민망한 실수를 지적하는 대사 ("저기... 이거 왜 이래요?")',
      '조연이 뜻밖의 연결고리를 드러내는 대사 ("혹시 OO씨 아세요?")',
    ],
    bodyReactions: [
      '얼굴이 화끈거렸어',
      '헛기침을 계속했어',
      '입술을 바짝 깨물었어',
      '동공이 지진 난 것처럼 떨렸어',
      '뒷머리를 긁적였어',
      '어색하게 미소 지었어',
      '두 손으로 얼굴을 가렸어',
    ],
    forbiddenPatterns: [
      '지나치게 진지한 분위기',
      '화보 같은 포즈 (Sexy/Elegant 위주 금지)',
      '감동적인 마무리 (웃음으로 끝낼 것)',
      '복선 없는 갑작스러운 반전',
    ],
    goodTwistExamples: [
      '알고보니 아름다운 캐디가 막내 처제였음',
      '알고보니 헌팅하려던 미녀가 변장한 와이프였음',
      '알고보니 나를 유혹하는 줄 알았던 여자가 내 바지 지퍼 열렸다고 알려주려던 것이었음',
    ],
    supportingCharacterTwistPatterns: [
      '조연(캐디, 스태프, 점원 등)이 화자의 가족/지인과 뜻밖의 연결고리가 있어서 들킴',
      '조연이 나중에 진실을 밝혀줌 ("아까 그분, 사모님 동생이세요")',
    ],
    badTwistExamples: [
      '알고보니 서프라이즈 파티 (뻔함)',
      '알고보니 몰래카메라 (불쾌함)',
      '알고보니 꿈이었음 (허무함)',
    ],
  },

  'romance-flutter': {
    name: '로맨스/설렘',
    description: '중년의 설렘. 첫사랑 감성, 권태기 부부의 재발견, 예상치 못한 두근거림 + 오해 반전',
    emotionCurve: '😐 무덤덤 → 👀 의식됨 → 💓 두근 → 😳 당황 → 😅 "아, 착각이었네" 또는 🤔 "나만 이런가?"',
    structure: `
[HOOK] ⚡ 설렘의 결과를 첫 문장에 즉시 제시 (배경 설명 금지!)
→ "그가 내 손을 잡는 순간, 시간이 멈췄어" (✅ 즉시 상황)
→ "오늘 그 사람한테서 향수 냄새가 달랐어" (✅ 감각적 디테일)
→ "그의 눈빛이 내게 머무는 순간 심장이 쿵했어" (✅ 직접적 충격)
❌ 금지: "오늘 그 사람을 만났는데 심장이 뛰었어" (배경 설명처럼 느껴짐)
❌ 금지: "최근에 이상한 일이 생겼어" (추상적)

[SETUP] 👀 일상 속 만남 + 복선
→ 늘 보던 사람인데 오늘 뭔가 다름
→ "평소처럼 (행동)하는데... 뭔가 이상해"
→ 미묘한 변화 포착 (시선, 목소리, 향기, 미소)

[BUILD-UP] 💓 물리적/심리적 거리 좁혀짐
→ 우연한 접촉, 눈 마주침, 목소리 톤 변화
→ 시간이 느려지는 느낌 묘사
→ 신체반응 필수 (귀 빨개짐, 손 떨림, 숨 참기)
→ 내적 갈등 ("다가가야 하나 말아야 하나")

[CLIMAX] 😳 결정적 순간 (설렘의 정점)
→ 의미심장한 한마디 or 행동
→ "그때 그 사람이 내 귀에 속삭였어..."
→ "손이 스치는 순간 전기가 흐르는 것 같았어"

[TWIST] 💡 반전 (3가지 패턴 중 선택)
1️⃣ 오해 반전 (추천!) - 바이럴력 높음
   → "설레는 줄 알았는데 알고 보니 다른 의미였다"
   → 예: "우리 와이프도 그 향수 쓰거든요", "동생 선물 고르는 거였어"
   → 결말: 😅 "이게 뭐야 진짜, 완전 착각했잖아"

2️⃣ 여운 반전 - 재시청 유도
   → "나만 이런 건가?", "설마... 아니겠지?"
   → 확신 없는 결말로 시청자에게 상상 여지

3️⃣ 확신 반전 - 감동
   → "그 순간 확신했어, 이 사람 나한테 관심 있구나"
   → 조연의 눈치로 확인 ("두 분 뭔가 있어 보여요")

⚠️ 중요: 오해 반전을 우선적으로 사용하면 댓글/공유 폭발!
`,
    killerPhrases: [
      '오늘따라 왜 이러지',
      '원래 이랬나?',
      '목소리가 왜 이렇게 낮아졌지',
      '눈을 어디다 둘지 모르겠더라',
      '괜히 신경 쓰였어',
      '그 말이 자꾸 맴돌아',
      '나만 이런 건가',
      '무슨 의미였을까',
      '설마... 아니겠지?',
      '왜 자꾸 생각나지',
      '내가 왜 이래 갑자기',
    ],
    bodyReactions: [
      '심장이 갑자기 빨라졌어',
      '귀가 빨개지는 게 느껴졌어',
      '목소리가 작아졌어',
      '눈을 못 마주치겠더라',
      '손끝이 미세하게 떨렸어',
      '숨을 참고 있었어',
      '입이 바짝 말랐어',
      '시간이 멈춘 것 같았어',
    ],
    forbiddenPatterns: [
      '"20년 만에", "10년 만에" 등 진부한 재회 설정',
      '심장이 쿵쾅쿵쾅 (유치한 표현)',
      '나비가 날아다니는 것 같았다',
      '운명 같은 만남',
      '첫눈에 반했다',
      '바로 고백',
      '키스/신체접촉',
      '바로 사귀기 시작',
      '골프장 그립 잡아주기',
      '우연히 같은 호텔',
      '비 오는 날 우산 씌워주기',
      '떨어진 물건 같이 줍다 손 닿기',
    ],
    goodTwistExamples: [
      '평소엔 무뚝뚝한 남편이 오늘따라 내 머리 냄새를 맡더니 "향 바꿨어?" 한마디',
      '항상 무심한 줄 알았던 그 사람이 내 커피 취향을 정확히 기억하고 있었음',
      '악수하는데 손을 평소보다 1초 더 잡고 있더라',
      '옆에 앉았는데 향수 냄새가... 집에 와서도 코끝에 남아있었어',
      '헤어질 때 "조심히 가"가 아니라 "연락해"라고 하더라',
    ],
    supportingCharacterTwistPatterns: [
      '조연이 둘 사이의 미묘한 분위기를 눈치채고 언급함 ("두 분 뭔가 있어 보여요")',
      '조연이 우연히 둘만의 시간/공간을 만들어줌',
      '조연을 통해 상대방의 관심을 간접적으로 알게 됨',
      '조연이 과거 상대방이 나에 대해 말한 것을 전해줌',
    ],
    supportingCharacterPhrasePatterns: [
      '조연이 분위기를 눈치채는 대사 ("어머, 두 분 좀 이상한데?")',
      '조연이 둘을 엮어주는 대사 ("저는 먼저 갈게요~")',
      '조연이 상대방의 마음을 떠보는 대사 ("걔가 너 얘기 많이 하던데?")',
    ],
    badTwistExamples: [
      '알고보니 나를 좋아했다 (너무 직접적)',
      '바로 고백받음 (전개 급함)',
      '꿈이었음 (허무)',
      '알고보니 유부남/유부녀 (불쾌)',
    ],
  },

  'affair-suspicion': {
    name: '불륜/외도 의심',
    description: '배우자의 수상한 행동 → 의심 폭발 → 건전한 반전. 시청자가 같이 의심하다가 안도하는 장르',
    emotionCurve: '🤨 수상함 → 😠 의심 → 😤 분노 폭발 직전 → 😮 반전 → 😅 안도+민망',
    structure: `
[HOOK] 🤨 충격적 발견/목격
→ "오늘 (물건)에서 이상한 거 발견했어"
→ "남편/와이프가 (수상한 행동)하는 거 봤어"

[SETUP] 🧐 최근 정황 나열 + 복선!
→ "생각해보니 요즘 좀 이상하긴 했어..."
→ 여기서 반전의 힌트를 슬쩍 깔기

[BUILD-UP] 😠 증거 수집 + 의심 폭주
→ 추가 증거들이 쌓임
→ "그래서 몰래 (조사 행동)했더니..."
→ 신체반응 필수

[CLIMAX] 😤 대면/추궁 순간
→ "결국 참다참다 물어봤어"
→ "이게 뭐야? 솔직히 말해"

[TWIST] 😮 건전한 반전
→ "알고보니 (감동적/웃긴 진실)이었어"
→ SETUP의 복선과 연결!

[OUTRO] 😅 안도 + 민망함
→ "내가 너무했나... 근데 누가 봐도 의심하잖아!"
`,
    killerPhrases: [
      '이거 뭐야?',
      '요즘 왜 이래?',
      '솔직히 말해봐',
      '나한테 숨기는 거 있지?',
      '다 알아, 딴 소리 하지 마',
      '눈 똑바로 보고 말해',
      '알고보니...',
      '아 진짜... 나 진짜 미안해',
      '누가 봐도 오해하잖아!',
      '생각해보니 요즘 좀 이상하긴 했어',
      '설마 했는데',
      '아니 근데 왜 숨겨',
    ],
    bodyReactions: [
      '손이 벌벌 떨렸어',
      '목소리가 갈라졌어',
      '눈물이 핑 돌았어',
      '심장이 쿵쿵 거렸어',
      '다리에 힘이 풀렸어',
      '숨이 턱 막히더라',
      '머리가 하얘졌어',
      '손에 쥔 핸드폰을 떨어뜨릴 뻔했어',
    ],
    forbiddenPatterns: [
      '실제 불륜 확정',
      '이혼 결심',
      '폭력적 대응',
      '자녀에게 피해',
      '립스틱 묻음',
      '향수 냄새',
      '머리카락 발견',
      '속옷 발견',
      '영수증 발견',
      '카톡 하트 이모지',
      '깜짝 파티 준비 (뻔함)',
      '서프라이즈 여행 준비 (뻔함)',
      '결혼기념일 선물 (뻔함)',
      '생일 선물 (뻔함)',
    ],
    goodTwistExamples: [
      '알고보니 남편이 내 갱년기 증상 때문에 몰래 한의원 상담받고 있었음',
      '알고보니 와이프가 내 퇴직 후 우울해할까봐 몰래 부부동반 여행 알아보는 중이었음',
      '알고보니 남편이 유튜브 보면서 몰래 요리 연습 중이었음 (맨날 라면만 끓이던 사람이)',
      '알고보니 딸이랑 짜고 내 환갑 축하 영상 만들고 있었음',
    ],
    supportingCharacterTwistPatterns: [
      '조연(친구, 이웃, 스태프)이 오해를 부추기는 정보를 줌 ("어제 남편분 젊은 여자랑 봤어요")',
      '조연이 나중에 진실을 밝혀줌 ("아 그거 서프라이즈 준비하는 거예요")',
      '조연이 배우자의 숨은 노력을 알려줌 ("사모님 위해 열심히 준비하시던데요")',
      '조연을 통해 배우자의 진심을 알게 됨',
    ],
    supportingCharacterPhrasePatterns: [
      '조연이 오해를 부추기는 대사 ("어제 카페에서 봤는데...")',
      '조연이 진실을 밝히는 대사 ("아 그거요? 사실은...")',
      '조연이 감동을 전하는 대사 ("사모님 몰래 얼마나 고민하셨는지...")',
    ],
    badTwistExamples: [
      '알고보니 회사 일 (너무 평범함)',
      '알고보니 친구 만남 (긴장감 대비 허무)',
      '실제 불륜이었음 (정책 위반)',
      '그냥 오해였음으로 끝남 (감동 없음)',
    ],
  },

  'hit-twist-spicy': {
    name: '대박 반전 (매운맛)',
    description: '성적 뉘앙스로 오해받는 상황 → 알고보니 완전 건전. 야한 것 같은데 야한 게 아닌 장르',
    emotionCurve: '😏 뭔가 야해...? → 😳 어머 저게 뭐야 → 😱 헐 설마 → 🤣 뭐야 아니잖아',
    structure: `
[HOOK] 😏 이중 의미 대사로 시작
→ 들으면 야하게 들리는 대사
→ "조금만 더요", "너무 빡빡해요", "살살 해요"

[SETUP] 😳 아슬아슬한 상황 설정 + 복선
→ 좁은 공간, 가까운 거리, 닫힌 문
→ 시각적으로 오해할 만한 구도

[BUILD-UP] 😱 오해 극대화
→ 밖에서 들으면 오해할 대사들 연속
→ "조심해요", "거기 말고요", "누가 오면 어떡해"
→ 제3자 등장 임박 암시

[CLIMAX] 😲 목격 순간
→ 누군가 문을 열거나 등장
→ "뭐... 뭐 하는 거야 너희?!"

[TWIST] 🤣 민망한 진실 공개
→ "아니 이게 아니라..."
→ 완전히 건전한 상황이었음

[OUTRO] 😂 웃음 + 해명
→ "오해예요 진짜!", "아 진짜 타이밍 왜..."
`,
    killerPhrases: [
      '조금만 더요',
      '너무 꽉 조여요',
      '힘 좀 빼요',
      '거기 말고요',
      '아 살살요',
      '누가 오면 어떡해',
      '빨리요 빨리',
      '뭐... 뭐 하는 거야?!',
      '아니 이거 오해예요!',
      '진짜 아무것도 아니에요!',
      '아니 타이밍이 왜...',
      '들어보면 알아요!',
    ],
    bodyReactions: [
      '얼굴이 새빨개졌어',
      '말문이 막혔어',
      '손사레를 미친듯이 쳤어',
      '버벅거리면서 해명했어',
      '식은땀이 줄줄 났어',
      '입이 벌어진 채로 굳었어',
      '눈이 왔다갔다 했어',
    ],
    forbiddenPatterns: [
      '실제 성적 상황',
      '노출 묘사',
      '신체 접촉 직접 묘사',
      '키스/포옹 장면',
      '속옷 언급',
      '장갑 끼워주기 (식상)',
      '파스 붙여주기 (식상)',
      '지퍼 올려주기 (식상)',
      '넥타이 매주기 (식상)',
      '머리에 뭐 붙은 거 떼주기 (식상)',
      '마사지 (여전히 애매함)',
    ],
    goodTwistExamples: [
      '알고보니 옷 매장 피팅룸에서 찢어진 바지 꿰매주고 있었음',
      '알고보니 콘택트렌즈 빠져서 찾아주고 있었음 (얼굴 가까이 대고)',
      '알고보니 목에 뭐가 걸려서 하임리히법 하고 있었음',
      '알고보니 새 구두 너무 꽉 껴서 억지로 벗기고 있었음',
      '알고보니 목걸이가 머리카락에 엉켜서 풀어주고 있었음',
    ],
    supportingCharacterTwistPatterns: [
      '목격자(조연)가 상황을 완전히 오해하고 당황함',
      '목격자의 리액션이 웃음 포인트가 됨 ("뭐... 뭐 하는 거야?!")',
      '목격자가 오해한 채로 소문을 퍼뜨릴 뻔함',
      '목격자에게 해명하는 과정이 더 민망해짐',
      '목격자가 나중에 진실을 알고 더 창피해함',
    ],
    supportingCharacterPhrasePatterns: [
      '목격자가 오해하며 당황하는 대사 ("뭐... 뭐 하는 거야 너희?!")',
      '목격자가 믿지 않는 대사 ("아니 무슨 그런 말도 안 되는...")',
      '목격자가 나중에 진실 알고 민망해하는 대사 ("아... 그거였구나...")',
    ],
    badTwistExamples: [
      '마사지해주고 있었음 (여전히 애매함)',
      '운동 동작 가르쳐주고 있었음 (식상함)',
      '춤 연습 (뻔함)',
      '요가 동작 (애매함)',
    ],
  },
};

// ============================================
// 40~60대 현실 반영 랜덤 시드 풀 (v3.1)
// ============================================

export const RANDOM_SEED_POOLS = {
  locations: [
    '골프장 라커룸', '클럽하우스 카페', '골프 연습장', '골프장 주차장',
    '백화점', '대형마트', '아파트 엘리베이터', '동네 카페',
    '미용실', '피부과 대기실', '헬스장', '필라테스 학원',
    '한의원', '정형외과', '안과',
    '동창회 식당', '계모임 장소', '와인바', '호텔 뷔페',
    '고급 레스토랑', '골프 클럽 식당',
    '자녀 집', '공항', '예식장', '돌잔치장',
  ],

  objects: [
    '카카오톡 알림', '문자 메시지', '새 옷 쇼핑백',
    '꽃다발', '고급 레스토랑 영수증', '호텔 주차권',
    '다이어트 보조제', '영양제 쇼핑백', '건강식품',
    '성형외과 명함', '새 운동복', '향수',
    '몰래 산 골프채', '고가의 선물 포장',
    '낯선 전화번호', '늦은 밤 문자',
  ],

  reactions: [
    '손이 벌벌 떨림',
    '목소리가 갈라짐',
    '귀까지 빨개짐',
    '한숨이 절로 나옴',
    '입이 바짝 마름',
    '다리에 힘이 풀림',
    '눈물이 핑 돎',
    '숨이 턱 막힘',
    '식은땀이 남',
    '심장이 철렁 내려앉음',
    '머리가 하얘짐',
  ],

  misunderstandings: [
    '바람피는 줄',
    '이혼 준비하는 줄',
    '건강검진 결과 안 좋은 줄',
    '자녀한테 목돈 빌려주는 줄',
    '주식/코인으로 돈 날린 줄',
    '성형 몰래 한 줄',
    '퇴직 통보받은 줄',
    '숨기는 병 있는 줄',
    '빚 있는 줄',
  ],

  truths: [
    '알고보니 블라우스 단추를 하나씩 밀려 끼운 채로 하루 종일 다님',
    '알고보니 명찰을 거꾸로 달고 다니고 있었음',
    '알고보니 셀카모드 켜진 줄 모르고 혼자 표정 연습 중이었는데 뒤에서 다 보고 있었음',
    '알고보니 마스크 안쪽에 립스틱이 번져있었는데 본인만 몰랐음',
    '알고보니 바지 주머니에서 영수증이 길게 삐져나와 있었음',
    '알고보니 휴대폰 플래시가 계속 켜져 있었음',
    '알고보니 한쪽 소매만 접힌 채로 중요한 자리 참석함',
    '알고보니 스카프가 가방 손잡이에 걸려 끌고 다녔음'
  ],

  twistTypes: [
    '배우자/가족 위한 서프라이즈 준비',
    '건강 관련 좋은 소식 또는 배려',
    '자녀/손주 관련 이벤트 준비',
    '본인 외모/건강 관리 비밀 시작',
    '가족 위한 재테크/저축',
    '말하기 쑥스러운 취미/자기계발',
    '과거 추억 정리/복원 프로젝트',
  ],
};

/**
 * 랜덤 시드 생성
 */
export const generateRandomSeed = (): {
  location: string;
  object: string;
  reaction: string;
  misunderstanding: string;
  truth: string;
  twistType: string;
} => {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  return {
    location: pick(RANDOM_SEED_POOLS.locations),
    object: pick(RANDOM_SEED_POOLS.objects),
    reaction: pick(RANDOM_SEED_POOLS.reactions),
    misunderstanding: pick(RANDOM_SEED_POOLS.misunderstandings),
    truth: pick(RANDOM_SEED_POOLS.truths),
    twistType: pick(RANDOM_SEED_POOLS.twistTypes),
  };
};

export const pickMaleOutfit = (
  topic: string = '',
  excludeOutfits: string[] = [],
  allowedOutfitCategories?: string[]
): string => {
  const selectionRules = getOutfitSelectionRules();
  const isGolf = topic.toLowerCase().includes('골프') || topic.toLowerCase().includes('golf');

  const normalizeList = (items?: string[]) =>
    Array.isArray(items) ? items.map(item => item.trim()).filter(Boolean) : [];
  const allowedCategories = normalizeList(allowedOutfitCategories);
  const allowList = normalizeList(selectionRules.maleAllowList);
  const excludeList = normalizeList(selectionRules.maleExcludeList);
  const excludeSet = new Set([...excludeList, ...excludeOutfits]);

  // 1차: 주제에 맞는 의상 필터링 (골프면 골프 의상만, MALE 카테고리만 - UNISEX 제외)
  let candidates = getOutfitPool().filter(item => {
    if (!isMaleOutfit(item)) return false; // MALE 카테고리만 (UNISEX 제외)
    if (allowList.length > 0 && !allowList.includes(item.name)) return false;
    if (excludeSet.has(item.name)) return false;
    if (allowedCategories.length > 0 && !allowedCategories.some((cat) => item.categories.includes(cat))) return false;

    // 골프 주제인 경우 GOLF 카테고리 필수
    if (isGolf && !item.categories.includes('GOLF')) return false;

    return true;
  });

  // 2차: 1차에서 없으면 전체 남성 의상에서 선택 (MALE 카테고리만)
  if (candidates.length === 0) {
    candidates = getOutfitPool().filter(item => {
      if (!isMaleOutfit(item)) return false; // MALE 카테고리만 (UNISEX 제외)
      if (allowList.length > 0 && !allowList.includes(item.name)) return false;
      if (excludeSet.has(item.name)) return false;
      if (allowedCategories.length > 0 && !allowedCategories.some((cat) => item.categories.includes(cat))) return false;
      return true;
    });
  }

  const selectedName = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].name
    : 'Navy Slim-fit Polo + White Tailored Golf Pants';

  // 남성은 겨울 변환(convertToTightLongSleeveWithShoulderLine) 적용 안 함
  return selectedName;
};

export const adjustOutfitForSeason = (outfit: string, _topic: string): string => {
  // v3.7.7: 겨울 키워드 자동 감지 제거 — 긴팔 변환은 오직 enableWinterAccessories 체크박스로만 제어
  return outfit;
};

const getOutfitPool = (): OutfitPoolItem[] =>
  buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]);

const isMaleOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.includes('MALE');

const isUnisexOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.includes('UNISEX');

const isGolfOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.some((category) => category.toLowerCase().includes('golf'));

export const validateOutfit = (outfit: string): boolean => {
  if (!outfit) return false;
  const pool = getOutfitPool();
  return pool.some(item => item.name === outfit);
};

export const pickFemaleOutfit = (
  genre: string,
  topic: string = '',
  excludeOutfits: string[] = [],
  allowedOutfitCategories?: string[]
): string => {
  const selectionRules = getOutfitSelectionRules();
  const allowDuplicates = selectionRules.allowDuplicateFemale;
  const normalizeList = (items?: string[]) =>
    Array.isArray(items) ? items.map(item => item.trim()).filter(Boolean) : [];
  const allowedCategories = normalizeList(allowedOutfitCategories);
  
  // 1. Genre Detection (마마님 요청: affair, suspicion, 불륜, 외도, 섹시 키워드 감지)
  const sexyKeywords = ['affair', 'suspicion', '불륜', '외도', '섹시'];
  const isSexyGenre = sexyKeywords.some(keyword => genre.toLowerCase().includes(keyword.toLowerCase()));

  const allowList = normalizeList(selectionRules.femaleAllowList);
  const excludeList = normalizeList(selectionRules.femaleExcludeList);
  const excludeSet = new Set([
    ...excludeList,
    ...(allowDuplicates ? [] : excludeOutfits)
  ]);

  const pool = getOutfitPool();

  const candidates = pool.filter(item => {
    if (isMaleOutfit(item)) return false;
    if (allowList.length > 0 && !allowList.includes(item.name)) return false;
    if (excludeSet.has(item.name)) return false;

    // 카테고리 명시적 허용 시 최우선 처리 (Cross-picking 허용 구간)
    if (allowedCategories.length > 0) {
      return allowedCategories.some(cat => item.categories.includes(cat));
    }

    // 장르별 카테고리 엄격 매핑 (마마님 요청)
    if (isSexyGenre) {
      // Sexy/Affair 장르: ONLY 'SEXY' 카테고리
      return item.categories.includes('SEXY');
    } else {
      // 그 외 (Comedy, Romance, Viral 등): ONLY 'ROYAL', 'YOGA', 'GOLF LUXURY'
      return item.categories.includes('ROYAL') || 
             item.categories.includes('YOGA') || 
             item.categories.includes('GOLF LUXURY');
    }
  });

  // 폴백 로직 (조건에 맞는 의상이 없을 경우의 최소 안전장치)
  let poolToUse = candidates;
  if (poolToUse.length === 0) {
    poolToUse = pool.filter(item => {
      if (isMaleOutfit(item)) return false;
      if (excludeSet.has(item.name)) return false;
      
      if (allowedCategories.length > 0) {
        return allowedCategories.some(cat => item.categories.includes(cat));
      }

      if (isSexyGenre) {
        return item.categories.includes('SEXY');
      } else {
        // 폴백에서도 SEXY 카테고리는 철저히 배제
        return !item.categories.includes('SEXY') && 
               (item.categories.includes('ROYAL') || 
                item.categories.includes('YOGA') || 
                item.categories.includes('GOLF LUXURY'));
      }
    });
  }

  // 최종 안전장치: 아예 풀이 비어버린 경우 (SEXY 제외)
  if (poolToUse.length === 0 && !isSexyGenre) {
    poolToUse = pool.filter(item => !isMaleOutfit(item) && !item.categories.includes('SEXY'));
  }

  const selectedName = poolToUse.length > 0
    ? poolToUse[Math.floor(Math.random() * poolToUse.length)].name
    : 'White Halter-neck Knit + Red Micro Mini Skirt';

  return adjustOutfitForSeason(selectedName, topic);
};

// 겨울 악세서리 자동 삽입 로직은 제거됨 (수동 악세서리만 사용)

// ============================================
// 대본 생성용 프롬프트 (v3.5 - 완전판)
// ============================================

export const buildLabScriptPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender, additionalContext } = options;
  const genreGuide = options.genreGuideOverride || LAB_GENRE_GUIDELINES[genre];
  const seed = generateRandomSeed();
  const useRandomOutfits = options.useRandomOutfits ?? true;
  const allowedOutfitCategories = options.allowedOutfitCategories;

  // 기본 의상 선택
  const outfitPlaceholder = 'CHOOSE_FROM_UNIFIED_OUTFIT_LIST';
  let womanAOutfit = useRandomOutfits ? pickFemaleOutfit(genre, topic, [], allowedOutfitCategories) : outfitPlaceholder;
  let womanBOutfit = useRandomOutfits ? pickFemaleOutfit(genre, topic, [womanAOutfit], allowedOutfitCategories) : outfitPlaceholder;
  let womanDOutfit = useRandomOutfits ? pickFemaleOutfit(genre, topic, [womanAOutfit, womanBOutfit], allowedOutfitCategories) : outfitPlaceholder;
  const manAOutfit = useRandomOutfits ? pickMaleOutfit(topic, [], allowedOutfitCategories) : outfitPlaceholder;
  const manBOutfit = useRandomOutfits ? pickMaleOutfit(topic, [manAOutfit], allowedOutfitCategories) : outfitPlaceholder;

  // 의상 검증 (너무 긴 설명문 방지)
  if (useRandomOutfits) {
    [
      { outfit: womanAOutfit, label: 'Woman A' },
      { outfit: womanBOutfit, label: 'Woman B' },
      { outfit: womanDOutfit, label: 'Woman D' },
      { outfit: manAOutfit, label: 'Man A' },
      { outfit: manBOutfit, label: 'Man B' }
    ].forEach(({ outfit, label }) => {
      if (!validateOutfit(outfit)) {
        console.warn(`Invalid outfit detected (${label}): ${outfit.substring(0, 50)}...`);
      }
    });
  }

  // 겨울 악세서리 자동 적용 제거 (의상은 겨울 키워드에서만 긴팔 변환)

  const ageValue = targetAge.replace('s', '');
  const ageLabel = `${ageValue}대`;

  const slotNames = getSlotNameMap();
  const womanAName = slotNames.WomanA || '지영';
  const womanBName = slotNames.WomanB || '혜경';
  const womanDName = slotNames.WomanD || '캐디';
  const manAName = slotNames.ManA || '준호';
  const manBName = slotNames.ManB || '민수';
  const narratorSlotId = gender === 'female' ? 'WomanA' : 'ManA';
  const narratorName = slotNames[narratorSlotId] || (gender === 'female' ? '지영' : '준호');
  const narratorSlotLabel = formatSlotDisplay(narratorSlotId, slotNames);

  const defaultHairSection = `## 💇 헤어스타일
- **${formatSlotDisplay('WomanA', slotNames)}**: long soft-wave hairstyle
- **${formatSlotDisplay('WomanB', slotNames)}**: short chic bob cut
- **${formatSlotDisplay('WomanD', slotNames)}**: high-bun hairstyle (Professional golf caddy look)
- **${formatSlotDisplay('ManA', slotNames)}**: short neat hairstyle
- **${formatSlotDisplay('ManB', slotNames)}**: clean short cut`;

  const defaultCharacterSection = `## 👥 캐릭터 설정 (각 인물별 고유 외모 특징 필수)
- **${formatSlotDisplay('WomanA', slotNames)}**: ${ageLabel} 주인공, 우아하고 자신감 있는 여성, **세련된 지적인 인상의 얼굴, 날렵한 턱선, 우아한 이목구비**
- **${formatSlotDisplay('WomanB', slotNames)}**: ${ageLabel} 친구, 활발하고 장난기 있는 성격, **밝고 생기있는 인상의 얼굴, 귀여운 미소, 에너지 넘치는 표정**
- **${formatSlotDisplay('WomanD', slotNames)}**: 20대 초반 골프 캐디, 밝고 세련되고 아름다운 프로페셔널 여성 (bright, cheerful, sophisticated, and beautiful professional 20-something golf caddy), **청순하고 프로페셔널한 인상**
  - **말투 규칙**: 캐디는 항상 정중하고 상냥한 **존댓말**(~해요, ~하세요)을 사용하며, 사회초년생의 밝은 에너지가 느껴져야 함.
- **${formatSlotDisplay('ManA', slotNames)}**: ${ageLabel} 남성, 댄디하고 세련된 신사, **지적인 인상의 얼굴, 부드러운 이목구비, 세련된 분위기의 외모**
- **${formatSlotDisplay('ManB', slotNames)}**: ${ageLabel} 남성 친구, 솔직하고 유머러스함, **남성적인 인상의 얼굴, 강인한 턱선, 활기찬 표정의 외모**
- **쌍둥이 방지 규칙**: 두 인물이 함께 등장할 때는 반드시 **서로 다른 얼굴 특징(not twins, distinct faces, different individuals)**을 명시할 것`;

  const maleNarratorInstruction = gender === 'male' ? `
13. **남성 주인공(${narratorName}) 시점 최적화**: 당신은 매너 있는 ${ageLabel} 남성 '${narratorName}'입니다. 
    - 주변의 아름다운 여성들이나 캐디를 대할 때 '중년 남성의 시선'에서 느끼는 관찰과 감상을 1인칭 수다체로 서술하세요.
    - **장르별 상호작용**: 
      - 코미디: 그녀들 앞에서 멋져 보이려다 허당끼 있게 망가지는 상황 유도.
      - 로맨스: 정중한 매너 속에 느껴지는 중년의 은은한 설렘 표현.
      - 불륜/의심: 그녀들의 수상한 행동에 전전긍긍하며 오해하는 상황.` : '';

  const promptRules = getActivePromptRules();
  const promptConstants = getPromptConstants();
  const promptSections = promptRules.promptSections || {};
  const defaultOutfitRulesSection = useRandomOutfits
    ? `## 🚨 의상 선택 절대 규칙 (매우 중요!)
⚠️ **의상은 반드시 위에 지정된 명칭을 100% 그대로 사용해야 합니다!**

✅ **올바른 사용**:
- lockedOutfits 필드의 의상 명칭을 정확히 그대로 복사
- 예: "White Halter-neck Knit + Red Micro Mini Skirt" → 전체 명칭 그대로 사용

❌ **절대 금지**:
- 의상 설명문 직접 생성 (예: "흰색 상의와 빨간 치마" ❌)
- 의상 명칭 요약/생략 (예: "White Halter-neck Knit" → "White Knit" ❌)
- 의상 명칭 변형 (예: "Pink Dress" → "Pink Summer Dress" ❌)

📋 **UNIFIED_OUTFIT_LIST에서만 선택**
- 모든 의상은 사전 정의된 리스트에서 정확한 명칭으로 선택
 - 리스트에 없는 의상 생성 절대 금지`
    : `## 🚨 의상 선택 절대 규칙 (LLM 선택 모드)
1) lockedOutfits 값은 반드시 **UNIFIED_OUTFIT_LIST**에서 골라 직접 채워야 합니다.
2) "CHOOSE_FROM_UNIFIED_OUTFIT_LIST"라는 문구는 절대 그대로 출력하지 말고 실제 의상 명칭으로 치환하세요.
3) **WomanA/WomanB/WomanD/ManA/ManB는 서로 다른 의상**을 선택해야 합니다. (중복 금지)
4) 장면이 바뀌어도 lockedOutfits 값은 동일하게 유지되어야 합니다.
5) 의상 명칭은 한 글자도 바꾸지 말고 리스트의 원문 그대로 사용하세요.
6) 대본에 의상 설명을 넣지 말고, 이미지 프롬프트에만 적용합니다.`;

  const outfitRulesSection = promptSections.outfitRulesSection?.trim() || defaultOutfitRulesSection;
  const rawHairSection = promptSections.hairstyleSection?.trim() || defaultHairSection;
  const rawCharacterSection = promptSections.characterSection?.trim() || defaultCharacterSection;
  const rawImagePromptRulesExtra = promptSections.imagePromptRulesExtra?.trim();
  const hairSection = applySlotNameOverrides(rawHairSection, slotNames);
  const characterSection = applySlotNameOverrides(rawCharacterSection, slotNames);
  const imagePromptRulesExtra = rawImagePromptRulesExtra
    ? applySlotNameOverrides(rawImagePromptRulesExtra, slotNames)
    : undefined;
  const winterAccessoriesRule = options.enableWinterAccessories
    ? `## ❄️ 겨울 악세서리 규칙
1. 모든 씬의 이미지 프롬프트에는 겨울 악세서리를 반드시 포함한다.
2. 예시: beanie, earmuffs, scarf, gloves, winter boots 중 1~2개를 자연스럽게 배치한다.
3. 악세서리는 shortPrompt/longPrompt 모두에 반영한다.
4. 의상 명칭은 절대 변형하지 말고 악세서리만 추가한다.`
    : '';
  const slotInstruction = buildCharacterSlotInstruction(options.characterSlotMode);
  const legacyGenreBlock = buildLegacyGenreBlock(options.legacyGenrePrompt);
  const scriptRules = getShortsLabScriptRules();
  const buildNumberedRules = (rules: string[]) =>
    rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
  const coreRulesText = buildNumberedRules(scriptRules.coreRules);
  const formatRulesLines = [...scriptRules.formatRules];
  if (additionalContext?.trim()) {
    formatRulesLines.push(`추가 요청: ${additionalContext.trim()}`);
  }
  const formatRulesText = buildNumberedRules(formatRulesLines);

  const isGolfTopic = topic.toLowerCase().includes('골프') || topic.toLowerCase().includes('golf');
  const golfCaddyRule = isGolfTopic ? `\n11. **캐디(WomanD) 상시 노출 (골프 씬 필수)**: 배경이 골프장인 경우, 캐디(WomanD)는 대본에 직접적인 대사가 없더라도 **거의 모든 장면에 배경 인물로 자연스럽게 포함**되어야 합니다. 주인공의 시선이 닿지 않는 곳에서 카트를 정리하거나 지켜보는 모습으로 배치하세요.` : '';

  const rawPrompt = `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 **대한민국 최고의 유튜브 쇼츠 바이럴 마스터이자 전문 작가**입니다. 
단 1초 만에 시청자의 시선을 강탈하고, 60초 내내 심장을 쫄깃하게 만들어 "이건 무조건 공유해야 돼!"라는 감탄이 터져 나오는 대박 쇼츠 대본을 집필하세요.

시청자가 영상을 보자마자 "헐, 이거 내 얘기 아냐?" 혹은 "대박, 진짜 이래?"라며 몰입할 수밖에 없는 하이퍼 리얼리티와 극강의 재미를 추구합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 주제: "${topic}"
📌 장르: ${genreGuide?.name || '일반'}
📌 타겟: 대한민국 모든 **중년** 시청자 (${ageLabel})
📌 화자: ${narratorSlotLabel} (${narratorName})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${slotInstruction ? `${slotInstruction}\n\n` : ''}## 🚀 대박 나는 쇼츠의 공식
1. **초강력 훅(Hook)**: 첫 1~3초 안에 모든 것이 결정됩니다. 호기심을 폭발시키거나 공감을 저격하는 대사로 시작하세요.
2. **리듬감 있는 전개**: 짧은 문장 위주로, 마치 숏폼 영상을 보듯 빠른 템포의 수다체로 작성하세요.
3. **확실한 도파민/공감**: 중년들의 현실 고증, 황당한 반전, 혹은 가슴 뻥 뚫리는 사이다 결말을 제공하세요.
4. **시각적 묘사**: AI 이미지 생성을 위해 각 장면의 상황과 인물의 표정, 행동을 아주 생생하게 묘사하세요.

## 🎯 이 장르의 핵심
**${applySlotNameOverrides(genreGuide?.description || '', slotNames)}**

## 📈 감정 곡선
${applySlotNameOverrides(genreGuide?.emotionCurve || '', slotNames)}

## 🎲 창작 힌트
- 장소 힌트: ${seed.location}
- 소품 힌트: ${seed.object}  
- 신체반응 참고: ${seed.reaction}
- 오해 방향: ${seed.misunderstanding}
- 반전 유형: ${seed.twistType}
- 구체 반전(황당) 힌트: ${seed.truth} (예시, 복사 금지)

## 🎭 스토리 구조
${applySlotNameOverrides(genreGuide?.structure || '', slotNames)}

## 💬 킬러 대사
${genreGuide?.killerPhrases.map(p => `"${applySlotNameOverrides(p, slotNames)}"`).join(', ') || ''}

## ⭐ 조연 대사 패턴
${genreGuide?.supportingCharacterPhrasePatterns?.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || '조연이 반전을 드러내는 대사를 자연스럽게 활용!'}

## 🫀 신체 반응 표현
${genreGuide?.bodyReactions.map(p => `"${applySlotNameOverrides(p, slotNames)}"`).join(', ') || ''}

## ✅ 좋은 반전 예시
${genreGuide?.goodTwistExamples?.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || ''}

## ⭐ 조연 활용 반전 패턴
${genreGuide?.supportingCharacterTwistPatterns?.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || '조연이 반전의 핵심 역할을 하면 스토리가 더 재밌어짐!'}

## ❌ 절대 금지
${genreGuide?.forbiddenPatterns.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || ''}

${legacyGenreBlock ? `\n${legacyGenreBlock}` : ''}

## 🚨🚨🚨 예시 복사 절대 금지 🚨🚨🚨
**이 프롬프트에 나오는 모든 예시는 "형식/패턴 설명용"일 뿐입니다!**
❌ 예시 문장을 그대로 복사하면 즉시 실패!
✅ 예시는 패턴만 참고하고, 주제(topic)에 맞는 완전히 새로운 스토리를 창작!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ✅ 핵심 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${coreRulesText}
${maleNarratorInstruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📝 대본 형식 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatRulesText}

## 👗 의상 설정 (이미지 프롬프트용)
- **${formatSlotDisplay('WomanA', slotNames)}**: ${womanAOutfit}
- **${formatSlotDisplay('WomanB', slotNames)}**: ${womanBOutfit}
- **${formatSlotDisplay('WomanD', slotNames)}**: ${womanDOutfit}
- **${formatSlotDisplay('ManA', slotNames)}**: ${manAOutfit}
- **${formatSlotDisplay('ManB', slotNames)}**: ${manBOutfit}

${winterAccessoriesRule}

${outfitRulesSection}

${hairSection}

${characterSection}

## 🚨 이미지 프롬프트 절대 규칙 (위반 시 즉시 실패)
1. **longPrompt와 negativePrompt 분리**: 모든 씬의 longPrompt에는 PROMPT_CONSTANTS.START/END를 포함하고, negativePrompt 필드에는 PROMPT_CONSTANTS.NEGATIVE를 별도로 입력해야 함. (누락/변형 금지)
2. **캐릭터 정체성은 반드시 characters[].identity 필드 값을 그대로 사용**
3. **의상 앞에 반드시 "wearing" 키워드 추가** (characters[].outfitPrefix 참조)
4. **8개 모든 씬에서 identity/hair/body/outfit 문구 100% 동일** (문자열 한 글자도 바꾸지 말 것)
5. **캔디드 에스테틱 (Candid Aesthetic) & 카메라 시선**:
   - **Scene 1 (Hook)**: 시청자와의 연결을 위해 카메라를 정면 응시하며 미소 지을 것 (Eye contact, smiling at camera).
    - **Scene 2~8**: 자연스러운 일상의 찰나를 포착한 **Candid Shot**이어야 함. 캐릭터는 **카메라를 절대 응시하지 말고(Looking away from camera)** 자신의 행동이나 상대방에게 집중할 것. 인위적인 포즈(Posed) 금지.${golfCaddyRule}
   - **투샷/쓰리샷 캔디샷 필수**: 여러 인물이 함께 있는 장면은 반드시 **캔디샷 느낌(즉흥·자연스러운 포착)**이어야 하며, 각 인물의 **손동작/입모양/표정/시선/자세를 서로 다르게** 구체적으로 작성할 것. **동일한 행동/표정 반복 금지**.
  6. **텍스트 금지**: 이미지 내에 어떠한 글자, 로고, 워터마크도 포함되지 않도록 "no text, no letters, no typography"를 강조할 것.
7. **투샷/쓰리샷에서는 각 인물마다 identity+hair+body+wearing+outfit 전체를 개별로 명시**
8. **배경은 1번 씬의 문구를 그대로 복붙** (장소 전환이 scriptLine에 명시된 경우만 변경 허용)
9. **의상 명칭 보존 (중요)**: \`shortPrompt\`와 \`longPrompt\` 모두에서 캐릭터에게 지정된 의상 명칭(예: "Pink & White Striped Knit + White Micro Short Pants")을 절대 요약하거나 일부를 생략하지 말고 **명칭 전체를 100% 동일하게 입력**할 것.
10. **[대괄호 템플릿] 형태 그대로 출력 금지** (실제 문장으로 채우기)

### 🔴 투샷/쓰리샷 필드 복사 절대 규칙 (매우 중요!)
⚠️ **투샷/쓰리샷에서 각 캐릭터의 모든 필드를 characters 배열에서 100% 그대로 복사해야 합니다!**

**❌ 절대 금지 (자동 실패):**
- identity 필드 축약 (예: "with a sharp jawline and elegant features" 같은 세부 특징 생략)
- body 필드 누락 (예: "high-seated chest line, extraordinarily voluminous..." 전체 생략)
- outfit 필드 축약 (예: 긴 의상 설명의 일부만 사용)
- 프롬프트 길이를 줄이기 위한 임의 생략

**✅ 올바른 방법:**
1. characters 배열에서 해당 캐릭터의 identity 전체 문자열 복사 (한 글자도 빼지 말 것)
2. hair 필드 전체 복사
3. body 필드 전체 복사 (절대 생략 금지!)
4. outfit 필드 전체 복사 (긴 설명이어도 전부 포함)
5. outfitPrefix (보통 "wearing") 추가

**예시 (WomanA의 경우):**
\`\`\`
[Person 1: A stunning Korean woman in her 40s, sophisticated intellectual face with a sharp jawline and elegant features, long soft-wave hairstyle, perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves, wearing ultra-short matte black long-sleeved bodycon micro mini dress, vertical ribbed knit pattern, lightweight stretch ribbed fabric, skin-tight fitted silhouette, classic round crew neckline, snug full-length sleeves extending to wrists, seamless minimalist construction, opaque matte texture, non-reflective finish, micro mini length hemline, high-density knit material, streamlined profile, no closures or hardware, form-fitting architectural seams.]
\`\`\`

**⚠️ 다중 인물 씬에서도 예외 없음:**
- 4명이 나오는 씬이어도 각 캐릭터의 모든 필드를 100% 포함할 것
- "프롬프트가 너무 길어진다"는 이유로 축약 절대 금지
- 캐릭터 일관성이 최우선 순위
${imagePromptRulesExtra ? `\n${imagePromptRulesExtra}\n` : ''}

## 📸 샷 타입 규칙
| 상황 | 샷 타입 |
|-----|--------|
| 1명 행동/감정 | 원샷 |
| 2명 상호작용 | 투샷 |
| 3명 함께 | 쓰리샷 |

### 🚨 투샷/쓰리샷 longPrompt 작성 필수 규칙 (매우 중요!)
**여러 캐릭터가 등장할 때는 반드시 [Person 1], [Person 2], [Person 3]로 구분해야 합니다!**
**각 Person의 행동/손동작/입모양/표정/시선은 서로 다르게 명시하고, 동일 문구/동작 반복 금지.**

✅ **원샷 예시** (1명):
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 30s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress], smiling at camera, snowy golf course, ...
\`\`\`

✅ **투샷 예시** (2명) - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 20s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress] [Person 2: A handsome Korean man in his 30s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit] walking together, snowy golf course, ...
\`\`\`

✅ **쓰리샷 예시** (3명) - [Person 1], [Person 2], [Person 3] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 20s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress] [Person 2: A stunning Korean woman in her 50s, short chic bob cut, slim hourglass figure..., wearing Teal Dress] [Person 3: A handsome Korean man in his 30s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit] standing together laughing, snowy golf course, ...
\`\`\`

✅ **남성 2명 투샷 예시** - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A handsome Korean man in his 30s, short neat hairstyle, fit athletic build..., wearing Navy Polo] [Person 2: A handsome Korean man in his 50s, clean short cut hair, well-built physique..., wearing White Polo] walking together on a golf course...
\`\`\`

❌ **금지 (캐릭터 혼동 발생)**:
\`\`\`
A stunning Korean woman..., A stunning Korean woman..., A handsome Korean man..., walking together
\`\`\`
→ 구분자 없이 쉼표로만 연결하면 AI가 캐릭터를 혼동합니다!
## 📷 카메라 앵글 필수 규칙 - 쇼츠 영상 최적화 (CRITICAL!)

⚠️ **미디엄샷 사용 제한**: 전체 씬의 **20% 이하**만 사용! (12씬이면 최대 2개, 8씬이면 최대 1개)
✅ **전신/와이드샷 우선**: 전체 씬의 **40% 이상**을 full body visible, wide shot으로 구성!

**이유**: 쇼츠 영상은 9:16 세로 화면이므로 전신샷이 역동적이고 의상/동작이 잘 보임. 미디엄샷만 많으면 답답하고 단조로워짐.

| 씬 | 권장 앵글 | 프롬프트 키워드 |
|---|----------|---------------|
| Scene 1 (Hook) | **클로즈업** | close-up portrait shot, face in focus, eye contact |
| Scene 2 (Setup) | **와이드/전신** | wide establishing shot, full body visible from head to toe, entire outfit visible |
| Scene 3 | **와이드/전신** | wide shot, full body visible, natural environment, showing complete outfit |
| Scene 4 | **와이드/전신** | wide landscape shot, full body visible, background emphasis, deep focus |
| Scene 5 (Climax) | **클로즈업** | close-up shot, dramatic expression, face focus |
| Scene 6 | **와이드/전신** | wide shot, full body visible, dynamic action, showing movement |
| Scene 7 (Twist) | **로우앵글/전신** | low-angle wide shot, full body visible head to toe, revealing context |
| Scene 8 (Outro) | **항공/와이드** | aerial view, drone shot, wide shot, full body visible, final scene |
| Scene 9 | **전신/액션** | full body shot, entire body visible, dynamic pose, complete outfit visible |
| Scene 10 | **와이드/전신** | wide shot, full body visible, environment context |
| Scene 11 | **미디엄샷** | medium shot, waist-up framing (⚠️ 이 씬만 예외적으로 미디엄 허용) |
| Scene 12 | **항공/와이드** | aerial drone view, bird's-eye perspective, wide shot, final scene |

⚠️ **절대 금지**:
- ❌ 미디엄샷을 3개 이상 사용 (최대 2개!)
- ❌ 같은 앵글 2연속 사용
- ❌ close-up을 3개 이상 사용
- ❌ "waist-up"만 계속 반복

✅ **필수 준수**:
- ✅ longPrompt 맨 앞에 카메라 앵글 키워드 반드시 배치
- ✅ "full body visible" 키워드를 6개 이상 씬에 사용
- ✅ "entire outfit visible" 또는 "head to toe" 등 전신 강조 표현 추가

## 🎥 POV (1인칭 시점) 샷 절대 규칙 ⚠️ 매우 중요!

POV 샷은 **특정 캐릭터의 눈으로 보는 시점**입니다.

**필수 규칙:**
1. ✅ **화면에 보이는 캐릭터만 longPrompt에 포함**
   - "지영의 시선에서 캐디가 웃으며" → 프롬프트에는 **캐디만** 포함
   - "준호가 보는 앞에서 혜경이 걷는" → 프롬프트에는 **혜경만** 포함

2. ❌ **시점의 주인공(카메라 역할)은 절대 프롬프트에 포함 금지**
   - "지영의 시선" → 지영은 카메라이므로 프롬프트에서 완전히 제외
   - 지영의 identity, hair, body, outfit 모두 제외

3. ✅ **POV 대상 캐릭터는 카메라를 바라봄**
   - "looking at camera (POV target)" 필수
   - "looking away from camera" 사용 금지

**올바른 예시:**
\`\`\`
한글: "지영의 시선에서 캐디가 손을 흔들며 인사하는 POV 샷"
영문 longPrompt: "unfiltered raw photograph..., first-person POV shot, A stunning Korean woman in her early 20s (캐디만!), high-bun hairstyle, ..., waving hand, looking at camera (POV target), ..."
\`\`\`

**잘못된 예시 (절대 금지):**
\`\`\`
❌ "[Person 1: A stunning Korean woman in her 30s (상대방 시점 주인공), POV shot], [Person 2: A stunning Korean woman in her early 20s (대상 캐릭터)]..."
→ 지영이 POV 시점 주인공이므로 프롬프트에서 완전히 제외해야 함!
→ 이렇게 하면 반반 이미지 생성됨!
\`\`\`

**투샷/쓰리샷과의 차이:**
- 투샷/쓰리샷: 여러 캐릭터가 화면에 함께 보임 → 모두 프롬프트에 포함
- POV 샷: 한 캐릭터의 시점 → 화면에 보이는 캐릭터만 포함

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**중요: 전체 대본에 대한 유연한 장면 구성 (8~12개 씬)**
- scriptBody: 8~12개 문장 (스토리 복잡도에 따라 유연하게 조절)
- scenes: 대본의 흐름과 내용에 따라 **총 8~12개 씬**을 생성
- 각 씬은 1개 이상의 scriptBody 문장으로 구성될 수 있으며, 여러 문장을 하나의 씬으로 그룹화할 수 있습니다.
- 예: scriptBody 12문장 → scenes 8~12개 (스토리 흐름에 따라 융통성 있게 구성)
- 각 scene의 scriptLine은 scriptBody의 해당 문장 또는 문장들을 조합하여 일치해야 함

{
  "title": "제목",
  "titleOptions": ["옵션1", "옵션2", "옵션3"],
  "scriptBody": "문장1\\n문장2... (8~12개 문장, scenes 개수와 동일)",
  "punchline": "펀치라인",
  "hook": "HOOK",
  "twist": "TWIST",
  "foreshadowing": "복선",
  "narrator": { "slot": "${narratorSlotId}", "name": "${narratorName}" },
  "emotionFlow": "${genreGuide?.emotionCurve || ''}",
  "lockedOutfits": {
    "womanA": "${womanAOutfit}",
    "womanB": "${womanBOutfit}",
    "womanD": "${womanDOutfit}",
    "manA": "${manAOutfit}",
    "manB": "${manBOutfit}"
  },
  "characters": [
    { "id": "WomanA", "name": "${womanAName}", "identity": "A stunning Korean woman in her ${targetAge}", "hair": "long soft-wave hairstyle", "body": "${promptConstants.FEMALE_BODY_A}", "outfit": "${womanAOutfit}", "outfitPrefix": "wearing" },
    { "id": "WomanB", "name": "${womanBName}", "identity": "A stunning Korean woman in her ${targetAge}", "hair": "short chic bob cut", "body": "${promptConstants.FEMALE_BODY_B}", "outfit": "${womanBOutfit}", "outfitPrefix": "wearing" },
    { "id": "ManA", "name": "${manAName}", "identity": "A handsome Korean man in his ${targetAge}", "hair": "short neat hairstyle", "body": "${promptConstants.MALE_BODY_A}", "outfit": "${manAOutfit}", "outfitPrefix": "wearing" },
    { "id": "ManB", "name": "${manBName}", "identity": "A handsome Korean man in his ${targetAge}", "hair": "clean short cut", "body": "${promptConstants.MALE_BODY_B}", "outfit": "${manBOutfit}", "outfitPrefix": "wearing" },
    { "id": "WomanD", "name": "${womanDName}", "identity": "A stunning Korean woman in her early 20s", "hair": "high-bun hairstyle", "body": "${promptConstants.FEMALE_BODY_D}", "outfit": "${womanDOutfit}", "outfitPrefix": "wearing" }
  ],
  "scenes": [  // 8~12개 (scriptBody 문장 수와 정확히 동일)
    {
      "sceneNumber": 1,
      "cameraAngle": "close-up | medium | wide | over-shoulder | POV (위 카메라 앵글 표 참조)",
      "characterSlot": "캐릭터 슬롯",
      "shotType": "원샷 | 투샷 | 쓰리샷",
      "emotionBeat": "이 장면 감정",
      "summary": "장면 한줄 요약",
      "scriptLine": "이 장면 대사",
      "action": "캐릭터의 구체적 행동",
      "emotion": "시작감정 → 끝감정",

      "voiceType": "narration | lipSync | both | none",
      "narration": {
        "text": "TTS용 텍스트 (자연스러운 문장)",
        "emotion": "감정 (한글)",
        "speed": "slow | normal | slightly-fast | fast"
      },
      "lipSync": {
        "speaker": "WomanA | WomanB | ManA | ManB",
        "speakerName": "캐릭터 이름",
        "line": "대사 (한글)",
        "emotion": "감정 (영어)",
        "timing": "start | mid | end"
      },

      "shortPrompt": "[카메라 앵글], [인물 설명 with outfit color], [행동/표정], [배경]. 투샷/쓰리샷 시: [Person 1: Name in White] [Person 2: Name in Navy] 형식으로 색상 구분 필수",
      "shortPromptKo": "[카메라 앵글], [인물 설명 및 의상 색상], [행동/표정], [배경]. 2명 이상 시 각 인물별 의상 색상 명시 필수",
      "longPrompt": "${promptConstants.START}, [⚠️ 카메라앵글: close-up portrait shot 등], [characters[해당캐릭터].identity - 전체 문자열 100% 복사], [characters[해당캐릭터].hair - 전체 복사], [characters[해당캐릭터].body - 전체 복사, 절대 생략 금지!], wearing [characters[해당캐릭터].outfit - 전체 복사, 축약 금지], [행동/표정], [배경], ${promptConstants.END}. ⚠️ 투샷/쓰리샷: 각 Person마다 [Person X: identity, hair, body, wearing outfit] 형식으로 모든 필드 100% 포함. body 필드 누락 절대 금지!",
      "negativePrompt": "${promptConstants.NEGATIVE}",
      "longPromptKo": "상세 한글 프롬프트",
      "videoPrompt": "[한국어] 40대 한국인 여성이 [동작], [카메라 무빙], [조명/분위기]"
    }
  ]
}


## ✅ 최종 체크리스트 (전부 통과해야 함!)

**기본:**
1. ✅ scriptBody 8~12문장 (스토리 복잡도에 따라 유연하게)
2. ✅ scenes 개수 = scriptBody 문장 수 (8~12개, 1:1 매칭)
3. ✅ 의상 일관성 (lockedOutfits)
4. ✅ JSON만 출력

**품질 (핵심):**
5. ✅ 화자(${narratorName})가 자기 이름 3인칭으로 안 씀?
6. ✅ 캐릭터 첫 등장 시 관계가 자연스럽게 드러남?
7. ✅ 반전 복선이 SETUP(2~3문장)에 있음?
8. ✅ 제목이 구체적? (충격/반전 같은 추상어 금지)
9. ✅ Show, Don't Tell 적용? (감정 직접 서술 금지)
10. ✅ 신체 반응 최소 2개?

**이미지 프롬프트 (필수!):**
11. ✅ 모든 longPrompt가 카메라 앵글로 시작? (close-up/wide/full-body/aerial/drone/POV)
12. ✅ **미디엄샷 제한**: medium shot/waist-up이 전체의 20% 이하? (12씬이면 최대 2개, 8씬이면 최대 1개)
13. ✅ **전신샷 우선**: "full body visible" 또는 "entire outfit visible"이 40% 이상 (12씬이면 5개 이상, 8씬이면 3개 이상)?
14. ✅ 같은 앵글 2연속 사용 없음? (미디움샷→미디움샷 연속 금지)
15. ✅ identity/hair/body/outfit 문구가 모든 씬에서 완전 동일?
16. ✅ 배경 문구가 장면 전환 없을 때 동일?
17. ✅ 투샷/쓰리샷에서 각 캐릭터 identity+hair+body+wearing+outfit 개별 명시?
18. ✅ **투샷/쓰리샷 body 필드 검증**: 모든 캐릭터의 body 필드가 누락 없이 100% 포함?
19. ✅ **투샷/쓰리샷 identity 검증**: 세부 특징(얼굴 설명, 성격 등) 축약 없이 전체 포함?
20. ✅ **투샷/쓰리샷 outfit 검증**: 긴 의상 설명도 전체 포함? (일부 축약 금지)
21. ✅ **다중 인물 씬 일관성**: 4명 등장 씬에서도 각 캐릭터의 모든 필드 100% 포함?
22. ✅ POV 샷에서 화면에 보이는 캐릭터만 포함? (시점 주인공 제외!)
23. ✅ POV 대상이 "looking at camera (POV target)" 사용? ("looking away" 금지)

**음성:**
24. ✅ 모든 씬에 voiceType 지정?
25. ✅ 작은따옴표 대사 있으면 lipSync 생성?
`;

  return applySlotNameOverrides(rawPrompt, slotNames);
};

export const buildLabImagePrompt = (options: LabImagePromptOptions): string => {
  const { sceneText, characterGender, characterAge, bodyType, outfit, style, includeQualityTags, includeAspectRatio } = options;
  const promptConstants = getPromptConstants();
  const parts: string[] = [promptConstants.START];
  if (characterGender === 'female') {
    parts.push(`A stunning Korean woman in her ${characterAge}`, bodyType || promptConstants.FEMALE_BODY);
  } else {
    parts.push(`A handsome Korean man in his ${characterAge}`, bodyType || promptConstants.MALE_BODY);
  }
  if (outfit) parts.push(`wearing ${outfit}`);
  parts.push(sceneText);
  if (style) parts.push(style);
  if (includeQualityTags) parts.push(promptConstants.END);
  if (includeAspectRatio && !parts.some(p => p.includes('--ar'))) parts.push('--ar 9:16');
  return parts.filter(Boolean).join(', ');
};

export interface PromptValidationResult { isValid: boolean; issues: string[]; fixedPrompt: string; }
export interface CharacterInfo { 
  id?: string;
  name?: string;
  gender?: string;
  identity: string; 
  hair: string; 
  body: string; 
  outfit: string; 
}


const MULTI_PERSON_POSITIONS = ['on the left', 'on the right', 'in the center'];
const MULTI_PERSON_COLORS = ['pastel purple', 'beige', 'navy'];

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const enhanceMultiPersonBlocks = (
  prompt: string,
  characters: CharacterInfo[],
  options?: { useGenderGuard?: boolean; forceCharacterOrder?: boolean }
) => {
  const hasPersonBlocks = /\[Person\s+\d+:/i.test(prompt);
  if (!hasPersonBlocks) return prompt;
  const useGenderGuard = options?.useGenderGuard !== false;
  const forceCharacterOrder = options?.forceCharacterOrder === true;

  // 성별별 캐릭터 분리 및 사용 카운터
  const maleCharacters = characters.filter(c => /\bman\b/i.test(String(c.identity || '')));
  const femaleCharacters = characters.filter(c => /\bwoman\b/i.test(String(c.identity || '')));
  let maleIndex = 0;
  let femaleIndex = 0;

  return prompt.replace(/\[Person\s+(\d+):([^\]]+)\]/gi, (match, indexRaw, contentRaw) => {
    const index = Math.max(0, Number(indexRaw) - 1);
    let content = contentRaw.trim();
    
    let character: CharacterInfo | undefined;
    if (forceCharacterOrder) {
      character = characters[index] || characters[characters.length - 1];
    } else {
      // 블록 내용에서 성별 감지하여 올바른 캐릭터 매칭
      const isMale = /\bman\b/i.test(content);
      const isFemale = /\bwoman\b/i.test(content);

      if (isMale && maleCharacters.length > 0) {
        character = maleCharacters[maleIndex % maleCharacters.length];
        maleIndex++;
      } else if (isFemale && femaleCharacters.length > 0) {
        character = femaleCharacters[femaleIndex % femaleCharacters.length];
        femaleIndex++;
      } else {
        // 성별 불명확시 인덱스 기반 폴백
        character = characters[index];
      }

      // [V3.5.3] Smart Matching: Handle AI swapping person indices
      for (const ch of characters) {
        if (!ch) continue;
        const idPattern = new RegExp(`\\b${ch.id}\\b`, 'i');
        const namePattern = ch.name ? new RegExp(`\\b${ch.name}\\b`, 'i') : null;

        if (idPattern.test(content) || (namePattern && namePattern.test(content))) {
          character = ch;
          break;
        }
      }
    }

    if (character) {
      // [Hard-Pinning] Strict reconstruction using MASTER data
      const parts = content.split(',').map(p => p.trim());
      
      // 1. Extract Position and Color Palette to preserve them
      const positionKeywords = /on the left|on the right|in the center|left side|right side|center/i;
      const colorKeywords = /color palette/i;
      const posPart = parts.find(p => positionKeywords.test(p)) || 
                      MULTI_PERSON_POSITIONS[index] || 
                      MULTI_PERSON_POSITIONS[MULTI_PERSON_POSITIONS.length - 1];
      const colorPart = parts.find(p => colorKeywords.test(p)) || 
                        `${MULTI_PERSON_COLORS[index] || MULTI_PERSON_COLORS[MULTI_PERSON_COLORS.length - 1]} color palette`;

      // 2. Extract LLM Action/Expression (Only preserve what's NOT master data or position/color)
      const traitKeywords = [
        character.identity, character.hair, character.body, 
        'stunning', 'handsome', 'korean', 'woman', 'man', 'hairstyle', 'figure', 'build', 'frame', 'physique'
      ].map(t => t.toLowerCase());

      const cameraKeywords = /\b(scene\s*\d+|shot|framing|view|pov|camera|angle|portrait|wide|medium|close-?up|aerial|over-the-shoulder|drone|full body|waist-up|bird's-eye|low-angle|high-angle)\b/i;
      const actionParts = parts.filter(p => {
        const lp = p.toLowerCase();
        if (lp.includes('wearing')) return false;
        if (positionKeywords.test(lp)) return false;
        if (colorKeywords.test(lp)) return false;
        if (cameraKeywords.test(lp)) return false;
        // If it's too similar to known master traits or generic descriptors, skip it
        if (traitKeywords.some(t => lp.includes(t) || t.includes(lp))) return false;
        return p.length > 0;
      });
      const llmAction = actionParts.join(', ').trim();

      // 3. Assemble with Master Data
      const masterOutfit = character.outfit.replace(/^wearing\s+/i, '').trim();
      const reconstructed = [
        character.identity,
        character.hair,
        character.body,
        `wearing ${masterOutfit}`,
        llmAction,
        posPart,
        colorPart
      ].filter(Boolean).join(', ');

      return `[Person ${indexRaw}: ${reconstructed}]`;
    }

    // Fallback if no character found
    if (!/on the left|on the right|in the center|left side|right side|center/i.test(content)) {
      const position = MULTI_PERSON_POSITIONS[index] || MULTI_PERSON_POSITIONS[MULTI_PERSON_POSITIONS.length - 1];
      content = `${content}, ${position}`;
    }

    if (!/color palette/i.test(content)) {
      const color = MULTI_PERSON_COLORS[index] || MULTI_PERSON_COLORS[MULTI_PERSON_COLORS.length - 1];
      content = `${content}, ${color} color palette`;
    }

    return `[Person ${indexRaw}: ${content}]`;
  });
};


export const validateAndFixPrompt = (
  longPrompt: string, 
  shotType: '원샷' | '투샷' | '쓰리샷', 
  characters: CharacterInfo[],
  options?: { useGenderGuard?: boolean; forceCharacterOrder?: boolean }
): PromptValidationResult => {
  const issues: string[] = [];
  let fixedPrompt = longPrompt;
  const promptConstants = getPromptConstants();
  const hasPersonMarkers = /\[Person\s+\d+:/i.test(longPrompt);
  const useGenderGuard = options?.useGenderGuard !== false; // Default to true
  const forceCharacterOrder = options?.forceCharacterOrder === true;

  // 1. 필수 시작 문구 확인
  if (!longPrompt.includes('unfiltered raw photograph')) {
  } else if (!hasPersonMarkers) {
    // [V3.5.3] One-shot strict reconstruction and hard-pinning
    const character = characters[0];
    if (character) {
      const prefix = promptConstants.START;
      const masterOutfit = character.outfit.replace(/^wearing\s+/i, '').trim();

      // Extract LLM Action from the original prompt
      const contentWithoutPrefix = fixedPrompt.replace(prefix, '').trim();
      const parts = contentWithoutPrefix.split(',').map(p => p.trim());
      
      const traitKeywords = [
        character.identity, character.hair, character.body,
        'stunning', 'handsome', 'korean', 'woman', 'man', 'hairstyle', 'figure', 'build', 'frame', 'physique'
      ].map(t => t.toLowerCase());

      const actionParts = parts.filter(p => {
        const lp = p.toLowerCase();
        if (lp.includes('wearing')) return false;
        if (lp.includes('photorealistic') || lp.includes('high-fashion')) return false;
        if (traitKeywords.some(t => lp.includes(t) || t.includes(lp))) return false;
        return p.length > 0;
      });
      const llmAction = actionParts.join(', ').trim();

      // Reconstruct using MASTER data in strict [Person 1] format
      const reconstructedBlock = [
        character.identity,
        character.hair,
        character.body,
        `wearing ${masterOutfit}`,
        llmAction,
        MULTI_PERSON_POSITIONS[0],
        `${MULTI_PERSON_COLORS[0]} color palette`
      ].filter(Boolean).join(', ');

      fixedPrompt = `${prefix}, [Person 1: ${reconstructedBlock}], ${promptConstants.END}`;
    }
  }

  if (hasPersonMarkers) {
    fixedPrompt = enhanceMultiPersonBlocks(fixedPrompt, characters, { useGenderGuard, forceCharacterOrder });
  }

  // Final cleanup

  fixedPrompt = fixedPrompt.replace(/,\s*,/g, ',').replace(/,(?!\s)/g, ', ').replace(/\s+/g, ' ').trim();
  const womanPattern = /A stunning Korean woman,\s*A stunning Korean woman/gi;
  fixedPrompt = fixedPrompt.replace(womanPattern, 'A stunning Korean woman');
  
  // [v3.5.3] Final Character Block Spacing Fix
  fixedPrompt = fixedPrompt.replace(/\]\s*\[Person/gi, '], [Person');
  fixedPrompt = fixedPrompt.replace(/\[Person\s+(\d+)\s*\(([^)]+)\):/gi, '[Person $1 ($2):');

  return { isValid: issues.length === 0, issues, fixedPrompt };
};

// ... (Restoring lost outfit functions)
export const pickRandomOutfit = (gender: 'female' | 'male', category: string): string => {
  if (gender === 'male') return pickMaleOutfit('', []);
  return pickFemaleOutfit('comedy-humor', '', []);
};

export const convertAgeToEnglish = (koreanAge: string): string => {
  const match = koreanAge.match(/(\d+)/);
  if (!match) return '';
  const age = parseInt(match[1]);
  return `${age}s`;
};

// =============================================
// 2-Pass Master Generation Types & Functions
// =============================================

export interface MasterPass1Options {
  topic: string;
  genre: string;
  targetAge: string;
  gender: 'female' | 'male';
  additionalContext?: string;
  genreGuideOverride?: LabGenreGuideline;
  legacyGenrePrompt?: string;
  enableWinterAccessories?: boolean;
  useRandomOutfits?: boolean;
  allowedOutfitCategories?: string[];
  characterSlotMode?: 'slot-only' | 'slot+name';
}

export interface MasterLockedCharacter {
  slotId: string;
  identity: string;
  hair: string;
  body: string;
  outfit: string;
  role?: string;
}

export interface MasterLockedLocation {
  id: string;
  name: string;
  englishDescription: string;
}

export interface MasterVisualStyleDNA {
  lighting: string;
  colorPalette: string;
  atmosphere: string;
  timeOfDay: string;
}

export interface MasterPass1Result {
  scriptBody: string;
  lockedCharacters: MasterLockedCharacter[];
  lockedLocations: MasterLockedLocation[];
  visualStyleDNA: MasterVisualStyleDNA;
  title?: string;
  titleOptions?: string[];
  punchline?: string;
  hook?: string;
  twist?: string;
  foreshadowing?: string;
  narrator?: { slot: string; name: string };
  emotionFlow?: string;
}

export interface MasterPass2Options {
  scriptBody: string;
  lockedCharacters: MasterLockedCharacter[];
  lockedLocations: MasterLockedLocation[];
  visualStyleDNA: MasterVisualStyleDNA;
  genre: string;
  topic: string;
  gender: 'female' | 'male';
  targetAge: string;
  genreGuideOverride?: LabGenreGuideline;
  characterSlotMode?: 'slot-only' | 'slot+name';
}

export interface ProfileConsistencyResult {
  isConsistent: boolean;
  issues: string[];
  fixes: Array<{ sceneIndex: number; field: string; original: string; fixed: string }>;
}

/**
 * Pass 1: 대본 + 캐릭터 프로필 + 배경 + 스타일 DNA 생성 프롬프트
 * 기존 buildLabScriptPrompt의 장르/캐릭터/의상 규칙을 재사용하되,
 * scenes[] 없이 프로필 확정에 집중
 */
export const buildMasterPass1Prompt = (options: MasterPass1Options): string => {
  const { topic, genre, targetAge, gender, additionalContext } = options;
  const genreGuide = options.genreGuideOverride || LAB_GENRE_GUIDELINES[genre];
  const seed = generateRandomSeed();
  const useRandomOutfits = options.useRandomOutfits ?? true;
  const allowedOutfitCategories = options.allowedOutfitCategories;

  let womanAOutfit = useRandomOutfits ? pickFemaleOutfit(genre, topic, [], allowedOutfitCategories) : 'CHOOSE_FROM_UNIFIED_OUTFIT_LIST';
  let womanBOutfit = useRandomOutfits ? pickFemaleOutfit(genre, topic, [womanAOutfit], allowedOutfitCategories) : 'CHOOSE_FROM_UNIFIED_OUTFIT_LIST';
  let womanDOutfit = useRandomOutfits ? pickFemaleOutfit(genre, topic, [womanAOutfit, womanBOutfit], allowedOutfitCategories) : 'CHOOSE_FROM_UNIFIED_OUTFIT_LIST';
  const manAOutfit = useRandomOutfits ? pickMaleOutfit(topic, [], allowedOutfitCategories) : 'CHOOSE_FROM_UNIFIED_OUTFIT_LIST';
  const manBOutfit = useRandomOutfits ? pickMaleOutfit(topic, [manAOutfit], allowedOutfitCategories) : 'CHOOSE_FROM_UNIFIED_OUTFIT_LIST';

  if (useRandomOutfits) {
    [womanAOutfit, womanBOutfit, womanDOutfit, manAOutfit, manBOutfit].forEach((outfit, i) => {
      if (!validateOutfit(outfit)) {
        console.warn(`Invalid outfit detected (${['WomanA','WomanB','WomanD','ManA','ManB'][i]}): ${outfit.substring(0, 50)}...`);
      }
    });
  }

  const ageValue = targetAge.replace('s', '');
  const ageLabel = `${ageValue}대`;
  const slotNames = getSlotNameMap();
  const narratorSlotId = gender === 'female' ? 'WomanA' : 'ManA';
  const narratorName = slotNames[narratorSlotId] || (gender === 'female' ? '지영' : '준호');
  const narratorSlotLabel = formatSlotDisplay(narratorSlotId, slotNames);
  const promptConstants = getPromptConstants();
  const slotInstruction = buildCharacterSlotInstruction(options.characterSlotMode);
  const legacyGenreBlock = buildLegacyGenreBlock(options.legacyGenrePrompt);

  const defaultCharacterSection = `## 👥 캐릭터 설정
- **${formatSlotDisplay('WomanA', slotNames)}**: ${ageLabel} 주인공, 우아하고 자신감 있는 여성
- **${formatSlotDisplay('WomanB', slotNames)}**: ${ageLabel} 친구, 활발하고 장난기 있는 성격
- **${formatSlotDisplay('WomanD', slotNames)}**: 20대 초반 골프 캐디, 밝고 프로페셔널한 여성
- **${formatSlotDisplay('ManA', slotNames)}**: ${ageLabel} 남성, 댄디하고 세련된 신사
- **${formatSlotDisplay('ManB', slotNames)}**: ${ageLabel} 남성 친구, 솔직하고 유머러스함`;

  const promptRules = getActivePromptRules();
  const promptSections = promptRules.promptSections || {};
  const rawCharacterSection = promptSections.characterSection?.trim() || defaultCharacterSection;
  const characterSection = applySlotNameOverrides(rawCharacterSection, slotNames);

  const isGolfTopic = topic.toLowerCase().includes('골프') || topic.toLowerCase().includes('golf');
  const golfCaddyNote = isGolfTopic ? '\n- WomanD(캐디)는 골프 관련 장면에 자연스럽게 포함시킬 것.' : '';

  const rawPrompt = `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 **쇼츠 바이럴 마스터**입니다. 아래 주제로 **대본 + 캐릭터 프로필 + 배경 + 비주얼 스타일**을 확정하세요.
⚠️ 이 단계에서는 씬별 이미지 프롬프트를 생성하지 마세요. 대본과 캐릭터 프로필 확정에만 집중하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 주제: "${topic}"
📌 장르: ${genreGuide?.name || '일반'}
📌 타겟: ${ageLabel}
📌 화자: ${narratorSlotLabel} (${narratorName})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${slotInstruction ? `${slotInstruction}\n\n` : ''}## 🎯 장르 핵심
**${applySlotNameOverrides(genreGuide?.description || '', slotNames)}**

## 📈 감정 곡선
${applySlotNameOverrides(genreGuide?.emotionCurve || '', slotNames)}

## 🎲 창작 힌트
- 장소: ${seed.location}, 소품: ${seed.object}, 반전: ${seed.twistType}

## 🎭 스토리 구조
${applySlotNameOverrides(genreGuide?.structure || '', slotNames)}

## 💬 킬러 대사
${genreGuide?.killerPhrases.map(p => `"${applySlotNameOverrides(p, slotNames)}"`).join(', ') || ''}

## ⭐ 조연 대사 패턴
${genreGuide?.supportingCharacterPhrasePatterns?.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || '조연이 반전을 드러내는 대사를 자연스럽게 활용!'}

## 🫀 신체 반응 표현
${genreGuide?.bodyReactions.map(p => `"${applySlotNameOverrides(p, slotNames)}"`).join(', ') || ''}

## ✅ 좋은 반전 예시
${genreGuide?.goodTwistExamples?.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || ''}

## ⭐ 조연 활용 반전 패턴
${genreGuide?.supportingCharacterTwistPatterns?.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || '조연이 반전의 핵심 역할을 하면 스토리가 더 재밌어짐!'}

## ❌ 절대 금지
${genreGuide?.forbiddenPatterns.map(p => `• ${applySlotNameOverrides(p, slotNames)}`).join('\n') || ''}

${legacyGenreBlock ? `\n${legacyGenreBlock}` : ''}

${characterSection}

## 👗 사전 선택 의상 (반드시 이 명칭 그대로 사용)
- WomanA: ${womanAOutfit}
- WomanB: ${womanBOutfit}
- WomanD: ${womanDOutfit}
- ManA: ${manAOutfit}
- ManB: ${manBOutfit}

## 💇 헤어스타일 (고정값 - 변경 금지)
- WomanA: long soft-wave hairstyle
- WomanB: short chic bob cut
- WomanD: high-bun hairstyle
- ManA: short neat hairstyle
- ManB: clean short cut

## 🧍 체형 (고정값 - 변경 금지)
- WomanA body: ${promptConstants.FEMALE_BODY_A}
- WomanB body: ${promptConstants.FEMALE_BODY_B}
- WomanD body: ${promptConstants.FEMALE_BODY_D}
- ManA body: ${promptConstants.MALE_BODY_A}
- ManB body: ${promptConstants.MALE_BODY_B}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 핵심 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 화자 1인칭, 본인 이름 3인칭 금지
2. 인물 첫 등장 시 관계 자연스럽게 드러내기
3. 반전이 있으면 SETUP에 힌트 1개
4. 감정 직접 서술 금지 → 행동/신체반응으로 표현
5. 문체: ~했어, ~했지, ~더라고, ~잖아 (반말 구어체 고정)
6. 존댓말(~요/~습니다) 금지
7. 분량: 8~12문장
${additionalContext ? `8. 추가 요청: ${additionalContext}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "title": "제목",
  "titleOptions": ["옵션1", "옵션2", "옵션3"],
  "scriptBody": "8~12문장 대본 (줄바꿈으로 구분)",
  "punchline": "펀치라인",
  "hook": "HOOK",
  "twist": "TWIST",
  "foreshadowing": "복선",
  "narrator": { "slot": "${narratorSlotId}", "name": "${narratorName}" },
  "emotionFlow": "${genreGuide?.emotionCurve || ''}",
  "lockedCharacters": [
    {
      "slotId": "WomanA",
      "identity": "A stunning Korean woman in her ${targetAge}, sophisticated intellectual face with a sharp jawline and elegant features",
      "hair": "long soft-wave hairstyle",
      "body": "${promptConstants.FEMALE_BODY_A}",
      "outfit": "${womanAOutfit}",
      "role": "주인공 (화자)"
    },
    {
      "slotId": "WomanB",
      "identity": "A stunning Korean woman in her ${targetAge}, bright cheerful face with cute smile and energetic expression",
      "hair": "short chic bob cut",
      "body": "${promptConstants.FEMALE_BODY_B}",
      "outfit": "${womanBOutfit}",
      "role": "친구"
    },
    {
      "slotId": "WomanD",
      "identity": "A stunning Korean woman in her early 20s, innocent and professional appearance",
      "hair": "high-bun hairstyle",
      "body": "${promptConstants.FEMALE_BODY_D}",
      "outfit": "${womanDOutfit}",
      "role": "캐디"
    },
    {
      "slotId": "ManA",
      "identity": "A handsome Korean man in his ${targetAge}, intellectual face with gentle features and refined demeanor",
      "hair": "short neat hairstyle",
      "body": "${promptConstants.MALE_BODY_A}",
      "outfit": "${manAOutfit}",
      "role": "남성 주인공"
    },
    {
      "slotId": "ManB",
      "identity": "A handsome Korean man in his ${targetAge}, masculine face with strong jawline and vibrant expression",
      "hair": "clean short cut",
      "body": "${promptConstants.MALE_BODY_B}",
      "outfit": "${manBOutfit}",
      "role": "남성 친구"
    }
  ],
  "lockedLocations": [
    {
      "id": "LOC_1",
      "name": "메인 배경",
      "englishDescription": "주제에 맞는 구체적인 영문 배경 묘사 (예: luxurious golf course clubhouse with panoramic mountain views)"
    }
  ],
  "visualStyleDNA": {
    "lighting": "natural daylight / soft warm lighting / dramatic side lighting 등",
    "colorPalette": "warm earth tones / cool blue-grey / vibrant pastels 등",
    "atmosphere": "upscale elegant / casual relaxed / mysterious tension 등",
    "timeOfDay": "morning / afternoon / evening / golden hour 등"
  }
}

## ✅ 체크리스트
1. scriptBody 8~12문장?
2. lockedCharacters에서 hair/body는 위의 고정값 100% 복사?
3. outfit은 사전 선택 의상 명칭 100% 그대로?
4. lockedLocations 2~4개 (주제에 맞는 다양한 배경)?
5. visualStyleDNA 모든 필드 채움?
6. identity에 얼굴 특징(face, jawline, features 등) 포함?${golfCaddyNote}
`;

  return applySlotNameOverrides(rawPrompt, slotNames);
};

/**
 * Pass 2: 잠긴 프로필을 참조하여 씬 분해 프롬프트 생성
 * LLM은 캐릭터 묘사를 직접 작성하지 않음 → 참조 시트의 값만 사용
 * shortPrompt/longPrompt는 생성하지 않음 (로컬에서 composeManualPrompt로 조립)
 */
export const buildMasterPass2Prompt = (options: MasterPass2Options): string => {
  const {
    scriptBody, lockedCharacters, lockedLocations, visualStyleDNA,
    genre, topic, gender, targetAge, genreGuideOverride, characterSlotMode
  } = options;
  const genreGuide = genreGuideOverride || LAB_GENRE_GUIDELINES[genre];
  const slotNames = getSlotNameMap();
  const slotInstruction = buildCharacterSlotInstruction(characterSlotMode);
  const narratorSlotId = gender === 'female' ? 'WomanA' : 'ManA';

  const characterRefSheet = lockedCharacters.map(ch => {
    return `  - ${ch.slotId}: identity="${ch.identity}", hair="${ch.hair}", body="${ch.body}", outfit="${ch.outfit}", role="${ch.role || ''}"`;
  }).join('\n');

  const locationRefSheet = lockedLocations.map(loc => {
    return `  - ${loc.id} (${loc.name}): ${loc.englishDescription}`;
  }).join('\n');

  const scriptLines = scriptBody.split('\n').filter(line => line.trim());
  const lineCount = scriptLines.length;

  const rawPrompt = `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 **쇼츠 씬 분해 전문가**입니다. 아래 대본을 장면별로 분해하세요.

⚠️ **핵심 규칙**: 캐릭터 묘사를 직접 작성하지 마세요! 참조 시트의 값만 사용합니다.
이미지 프롬프트(shortPrompt/longPrompt)는 생성하지 마세요. 행동/표정/카메라/배경만 지정합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 주제: "${topic}"
📌 장르: ${genreGuide?.name || '일반'}
📌 화자: ${narratorSlotId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${slotInstruction ? `${slotInstruction}\n\n` : ''}## 📋 대본 (${lineCount}문장)
${scriptLines.map((line, i) => `${i + 1}. ${line.trim()}`).join('\n')}

## 🔒 캐릭터 참조 시트 (절대 변경 금지)
${characterRefSheet}

## 🏞️ 배경 참조 시트
${locationRefSheet}

## 🎨 비주얼 스타일 DNA
- 조명: ${visualStyleDNA.lighting}
- 색감: ${visualStyleDNA.colorPalette}
- 분위기: ${visualStyleDNA.atmosphere}
- 시간대: ${visualStyleDNA.timeOfDay}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 씬 분해 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 대본 문장 수와 씬 수는 1:1 매칭 (${lineCount}개 씬)
2. 각 씬에 등장하는 캐릭터는 참조 시트의 slotId로만 지정
3. shotType: 1명=원샷, 2명=투샷, 3명+=쓰리샷
4. cameraAngle: 위 카메라 앵글 표 참조 (미디엄샷 20% 이하, 전신샷 40% 이상)
5. action: 캐릭터의 구체적 행동을 영어로 (카메라를 보지 않는 캔디드 스타일)
6. expression: 캐릭터 표정을 영어로
7. locationId: 참조 시트의 배경 ID 사용
8. Scene 1(Hook)만 카메라 응시, Scene 2~끝은 looking away from camera

## 📷 카메라 앵글 가이드
| 씬 | 권장 앵글 |
|---|----------|
| Scene 1 (Hook) | close-up portrait shot |
| Scene 2~3 (Setup) | wide shot, full body visible |
| Scene 4~5 | wide/low-angle shot |
| Scene 6 (Climax) | close-up dramatic shot |
| Scene 7~8 (Twist) | low-angle/wide shot |
| Scene 9+ (Resolution) | wide/aerial shot |

## 🎥 POV 샷 규칙
- POV 샷: 시점 주인공은 characterIds에서 제외
- POV 대상만 characterIds에 포함

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptLine": "대본 1번째 문장 그대로",
      "characterIds": ["WomanA"],
      "locationId": "LOC_1",
      "shotType": "원샷",
      "cameraAngle": "close-up portrait shot, face in focus, eye contact with camera",
      "action": "looking directly at camera with a knowing smile",
      "actionKo": "카메라를 바라보며 의미심장하게 미소 짓는",
      "expression": "confident smirk, raised eyebrow, eye contact with camera",
      "background": "참조 시트의 LOC_1 배경 영문 묘사 그대로 복사",
      "voiceType": "narration",
      "narration": {
        "text": "TTS용 텍스트",
        "emotion": "감정",
        "speed": "normal"
      },
      "lipSync": null
    }
  ]
}

## ✅ 체크리스트
1. scenes 개수 = 대본 문장 수 (${lineCount}개)?
2. characterIds는 참조 시트의 slotId만 사용?
3. locationId는 참조 시트의 ID만 사용?
4. 미디엄샷 20% 이하?
5. 전신/와이드샷 40% 이상?
6. 같은 앵글 2연속 없음?
7. Scene 1만 eye contact, 나머지는 looking away?
8. action/expression이 영어로 구체적?
9. POV 샷에서 시점 주인공 characterIds에서 제외?
`;

  return applySlotNameOverrides(rawPrompt, slotNames);
};

/**
 * 생성된 씬 프롬프트의 캐릭터 프로필 일관성 검증 및 자동 수정
 */
export const validateProfileConsistency = (
  scenePrompts: string[],
  lockedCharacters: MasterLockedCharacter[]
): ProfileConsistencyResult => {
  const issues: string[] = [];
  const fixes: ProfileConsistencyResult['fixes'] = [];

  const charMap = new Map<string, MasterLockedCharacter>();
  lockedCharacters.forEach(ch => charMap.set(ch.slotId, ch));

  scenePrompts.forEach((prompt, sceneIndex) => {
    // [Person N (SlotId): ...] 블록 추출
    const personBlocks: string[] = prompt.match(/\[Person\s+\d+\s*\([^)]+\):[^\]]+\]/gi) || [];

    personBlocks.forEach(block => {
      // slotId 추출
      const slotMatch = block.match(/\((\w+)\)/);
      if (!slotMatch) return;
      const slotId = slotMatch[1];
      const locked = charMap.get(slotId);
      if (!locked) return;

      // identity 검증: 잠긴 identity가 블록에 포함되어 있는지
      if (!block.includes(locked.identity)) {
        issues.push(`Scene ${sceneIndex + 1}: ${slotId} identity mismatch`);
      }

      // outfit 축약 감지: outfit의 전체 문자열이 블록에 있는지
      const outfitNormalized = locked.outfit.replace(/^wearing\s+/i, '').trim();
      if (outfitNormalized && !block.includes(outfitNormalized)) {
        // outfit의 첫 단어라도 있으면 축약 가능성
        const firstWord = outfitNormalized.split(/\s+/)[0];
        if (firstWord && block.toLowerCase().includes(firstWord.toLowerCase())) {
          issues.push(`Scene ${sceneIndex + 1}: ${slotId} outfit possibly abbreviated`);
          fixes.push({
            sceneIndex,
            field: 'outfit',
            original: block,
            fixed: block // composeManualPrompt가 이미 강제 삽입하므로 여기서는 경고만
          });
        }
      }

      // body 필드 누락 감지
      if (locked.body && !block.includes(locked.body.substring(0, 30))) {
        issues.push(`Scene ${sceneIndex + 1}: ${slotId} body field may be missing`);
      }
    });
  });

  return {
    isConsistent: issues.length === 0,
    issues,
    fixes
  };
};

// ============================================
// [신규] 단순화된 AI 마스터 생성 프롬프트 (캐릭터 일관성 보장)
// ============================================

/**
 * buildSimplifiedMasterPrompt
 *
 * AI 마스터 생성 버튼 전용 - 단일 Pass LLM 프롬프트
 * - LLM은 대본 + 씬 구조만 생성 (캐릭터 슬롯 ID만 할당)
 * - 캐릭터 특징, 의상, 헤어 등은 LLM이 생성하지 않음 (코드가 자동 처리)
 * - 100% 일관성 보장
 */
export const buildSimplifiedMasterPrompt = (params: {
  topic: string;
  genre: string;
  targetAge: string;
  gender?: string;
  genreGuideOverride?: LabGenreGuideline;
  legacyGenrePrompt?: string;
}): string => {
  const { topic, genre, targetAge, gender = '여성' } = params;
  const genreGuide = params.genreGuideOverride || LAB_GENRE_GUIDELINES[genre];
  const legacyGenreBlock = buildLegacyGenreBlock(params.legacyGenrePrompt);
  const scriptRules = getShortsLabScriptRules();
  const buildNumberedRules = (rules: string[]) =>
    rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
  const coreRulesText = buildNumberedRules(scriptRules.coreRules);
  const formatRulesText = buildNumberedRules(scriptRules.formatRules);
  const sentenceRange = scriptRules.formatRules
    .map((line) => {
      const match = String(line || '').match(/(\d+)\s*~\s*(\d+)\s*문장/);
      if (!match) return null;
      return { min: Number(match[1]), max: Number(match[2]) };
    })
    .find(Boolean) || { min: 8, max: 12 };

  const characterSlots = gender === '남성'
    ? 'ManA (준호), ManB (민수), ManC (남성 조연)'
    : 'WomanA (지영), WomanB (혜경), WomanC (미숙), WomanD (캐디), ManA (준호), ManB (민수)';

  return `당신은 YouTube 쇼츠용 ${genreGuide?.name || genre} 장르의 ${targetAge} 타겟 대본 작가입니다.

**주제**: ${topic}

## 🎯 장르 핵심
${genreGuide?.description || ''}

## 📈 감정 곡선
${genreGuide?.emotionCurve || ''}

## 🎭 스토리 구조
${genreGuide?.structure || ''}

## 💬 킬러 대사
${genreGuide?.killerPhrases?.map(p => `"${p}"`).join(', ') || ''}

## ❌ 절대 금지
${genreGuide?.forbiddenPatterns?.map(p => `• ${p}`).join('\n') || ''}

${legacyGenreBlock ? `\n${legacyGenreBlock}\n` : ''}

다음 JSON 형식으로 응답하세요:

\`\`\`json
{
  "title": "제목",
  "scriptBody": "전체 대본 (${sentenceRange.min}~${sentenceRange.max}문장, 각 문장은 한 씬에 대응)",
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptLine": "첫 번째 대사 (scriptBody의 첫 번째 문장과 정확히 일치)",
      "characterIds": ["WomanA", "WomanB"],
      "cameraAngle": "drone shot",
      "background": "vast snow-covered golf course stretching to horizon under golden morning light",
      "action": "walking side by side leaving footprints in pristine snow, laughing joyfully",
      "emotion": "설렘",
      "summary": "two women enjoying a beautiful winter day at the golf course"
    },
    {
      "sceneNumber": 2,
      "scriptLine": "두 번째 대사",
      "characterIds": ["WomanA"],
      "cameraAngle": "full body wide shot",
      "background": "elegant clubhouse entrance with modern glass architecture reflecting winter sky",
      "action": "twirling gracefully with golf club in hand, snow gently falling around her",
      "emotion": "행복",
      "summary": "woman playfully twirling in the snow outside the clubhouse"
    },
    {
      "sceneNumber": 3,
      "scriptLine": "세 번째 대사",
      "characterIds": ["ManA", "ManB"],
      "cameraAngle": "low angle wide",
      "background": "dramatic golf course fairway with towering pine trees covered in snow",
      "action": "striding confidently forward toward camera, snow crunching beneath their feet",
      "emotion": "비장",
      "summary": "two men walking confidently on the snowy fairway"
    }
    // ... ${sentenceRange.min}~${sentenceRange.max}개 씬 (scriptBody의 문장 수와 정확히 일치)
    // 반드시 drone shot, full body wide, low angle wide, establishing wide 위주로!
  ]
}
\`\`\`

## ✅ 핵심 규칙
${coreRulesText}

## 📝 대본 형식 규칙
${formatRulesText}

**중요 규칙:**

1. **title 필수**: 대본 전체를 대표하는 간결한 제목을 반드시 포함하세요.
2. **문체 고정**: 반드시 반말 구어체(~했어, ~더라고). **~요/~습니다 금지**
2. **캐릭터 슬롯 ID만 사용** (절대 캐릭터 특징 언급 금지):
   - 사용 가능한 슬롯: ${characterSlots}
   - 각 씬의 \`characterIds\`에 슬롯 ID만 배열로 기입
   - **절대 금지**: 캐릭터 외모, 헤어스타일, 의상, 체형 등 특징 언급 (코드가 자동 처리)

3. **씬 구조 필수 항목**:
   - \`sceneNumber\`: 씬 번호 (1부터 시작)
   - \`scriptLine\`: 대사 (scriptBody의 문장과 1:1 대응)
   - \`characterIds\`: 슬롯 ID 배열 (예: ["WomanA"], ["WomanA", "ManA"])
   - \`cameraAngle\`: 카메라 앵글 (아래 규칙 참고)
   - \`background\`: 배경 (영어로 창의적이고 구체적으로)
   - \`action\`: 동작 (영어로 생생하고 역동적으로)
   - \`emotion\`: 인물의 현재 감정을 짧은 한국어 키워드로 (예: 당황, 충격, 설렘, 오해, 황당, 분노, 슬픔, 웃음)
   - \`summary\`: 해당 씬디의 핵심 상황을 영문으로 짧게 요약 (이미지 프롬프트 구성에 사용됨)

4. **배경 일관성 규칙**:
   - Scene 1에서 설정한 배경 톤/계절/날씨를 전 씬에 일관되게 유지
   - 장소 전환이 명시된 경우에만 배경 변경 허용

5. **POV 금지**:
   - POV/first-person 시점 카메라 앵글은 사용하지 말 것
   - 대신 drone shot / full body wide / low angle wide / establishing wide 위주로 구성

3. **씬 개수**:
   - 반드시 ${sentenceRange.min}~${sentenceRange.max}개 씬 생성
   - scriptBody의 각 문장마다 1개 씬 할당 (1:1 매칭)
   - 씬마다 characterIds를 반드시 채울 것 (빈 배열 금지)

3-1. **인물 구성 비율 규칙 (매우 중요)**:
   - 원샷(1명) 비율: 최대 60%
   - 투샷(2명) 비율: 최소 30%
   - 쓰리샷(3명 이상) 비율: 최소 10% (등장 가능한 인물이 3명 이상일 때)
   - 같은 인물 1명만 나오는 장면이 2씬 이상 연속되지 않도록 구성
   - 대사 흐름상 상호작용 장면은 가능한 한 투샷/쓰리샷으로 배치

4. **카메라 앵글 규칙 (매우 중요!)**:
   - **대박나는 쇼츠는 역동적이고 시네마틱한 와이드샷이 핵심입니다!**
   - **필수 비율**:
     - drone shot / aerial wide (드론/항공 와이드): 25%
     - full body wide shot (전신 와이드샷): 25%
     - low angle wide (로우앵글 와이드): 20%
     - establishing wide shot (배경 위주 와이드): 15%
     - close-up (클로즈업): 최대 10% (감정 중요한 순간만)
     - POV (시점샷): 5%
   - **medium shot과 extreme close-up은 절대 사용 금지!**
   - **앵글 작성 예시** (정확히 이렇게 작성하세요):
     - "drone shot" 또는 "aerial wide shot"
     - "full body wide shot" 또는 "wide shot showing full body"
     - "low angle wide shot" 또는 "low angle wide"
     - "establishing wide shot" 또는 "wide establishing shot"
     - "close-up" (10개 씬 중 최대 1개만!)
     - "POV shot" 또는 "POV"
   - **앵글 설명**:
     - drone shot / aerial wide: 하늘에서 내려다본 광활한 구도, 공간의 스케일 극대화
     - full body wide shot: 전신이 모두 보이는 구도, 배경과 캐릭터 조화
     - low angle wide: 아래에서 위로 올려다보는 구도, 역동적이고 웅장함
     - establishing wide shot: 배경이 주인공, 캐릭터는 풍경의 일부
     - close-up: 얼굴 중심, 감정 표현이 매우 중요한 순간에만 사용
     - POV: 캐릭터 시점, 몰입감 극대화
   - **절대 금지**: "medium shot", "medium close-up", "extreme close-up", "mid shot"
   - POV 샷 사용 시 카메라 역할 캐릭터는 characterIds에서 제외

5. **배경(background) 작성 규칙**:
   - **창의적이고 구체적으로** 작성
   - 나쁜 예: "golf course" (너무 간단함)
   - 좋은 예: "sunlit golf course green with morning dew sparkling on grass"
   - 좋은 예: "elegant clubhouse lounge with floor-to-ceiling windows overlooking snow-covered fairway"
   - 좋은 예: "pristine white sand bunker with dramatic shadows"
   - **시각적 요소 포함**: 조명, 분위기, 시간대, 날씨, 특징적 오브젝트
   - **감정 전달**: 배경으로 감정과 분위기를 강화

6. **동작(action) 작성 규칙**:
   - **역동적이고 생생하게** 작성
   - 나쁜 예: "sitting and smiling" (너무 평범함)
   - 좋은 예: "laughing joyfully while tossing her hair back in the golden sunlight"
   - 좋은 예: "confidently walking toward camera with a mysterious smile"
   - 좋은 예: "dramatically spinning around with arms wide open, snow falling around her"
   - **감정과 뉘앙스 포함**: 단순 동작이 아닌 감정이 담긴 행동
   - **세부 묘사**: 손동작, 시선, 표정 변화 등 구체적으로

**체크리스트**:
- [ ] scriptBody는 ${sentenceRange.min}~${sentenceRange.max}개 문장인가?
- [ ] scenes 배열은 scriptBody 문장 수와 정확히 일치하는가?
- [ ] 모든 씬의 characterIds는 슬롯 ID만 포함하는가?
- [ ] characterIds가 빈 배열인 씬이 없는가?
- [ ] 원샷 60% 이하, 투샷 30% 이상, 쓰리샷 10% 이상(가능 시)인가?
- [ ] 동일 인물 원샷이 2씬 이상 연속되지 않는가?
- [ ] 캐릭터 특징(헤어, 의상, 체형 등)을 언급하지 않았는가?
- [ ] 카메라 앵글 비율을 준수했는가? (drone shot 25%, full body wide 25%, low angle wide 20%, establishing wide 15%, close-up 최대 10%, POV 5%)
- [ ] **medium shot과 extreme close-up을 사용하지 않았는가?** (절대 금지!)
- [ ] 와이드샷이 전체의 85% 이상인가? (drone + full body + low angle + establishing)
- [ ] background는 창의적이고 구체적인가? (시각적 요소 포함)
- [ ] action은 역동적이고 생생한가? (감정과 세부 묘사 포함)
- [ ] emotion, summary 필드를 모두 작성했는가?

**⚠️ 필수 확인사항 (매우 중요!):**
1. **카메라 앵글**: 10개 씬 기준 - drone shot 2~3개, full body wide 2~3개, low angle wide 2개, establishing wide 1~2개, close-up 최대 1개, POV 0~1개
2. **절대 사용 금지**: medium shot, medium close-up, extreme close-up
3. **와이드샷 위주**: 전체의 85% 이상이 와이드샷이어야 합니다!
4. **배경과 동작**: 구체적이고 시각적으로 생생하게!

이제 주제 "${topic}"에 대한 ${genre} 장르 대본과 씬 구조를 생성하세요.

**기억하세요**: 대박나는 쇼츠는 **시네마틱한 와이드샷**이 핵심입니다! 드론샷, 전신샷, 로우앵글 와이드를 충분히 활용하세요!`;
};

/**
 * assignOutfitsToCharacters
 *
 * 캐릭터 슬롯별로 의상을 중복 없이 랜덤 선택
 * - outfits.json에서 장르에 맞는 카테고리 필터링
 * - 중복 방지 로직
 */
export const assignOutfitsToCharacters = (params: {
  characterIds: string[];
  genre: string;
  outfitsData: any[];
  topic?: string;
}): Map<string, { name: string; prompt: string }> => {
  const { characterIds, genre, outfitsData, topic = '' } = params;

  console.log('[assignOutfits] Input genre:', genre);
  console.log('[assignOutfits] Character IDs:', characterIds);
  console.log('[assignOutfits] Total outfits:', outfitsData.length);

  // 1. 장르 → 의상 카테고리 매핑
  const categoryMap: Record<string, string> = {
    'romance-dating': 'ROYAL',
    'comedy-humor': 'ROYAL',
    'daily-life': 'ROYAL',
    'golf-luxury': 'GOLF LUXURY',
    'sports-fitness': 'YOGA',
    'sexy-glamour': 'SEXY'
  };

  const category = categoryMap[genre] || 'ROYAL';
  console.log('[assignOutfits] Mapped category:', category);

  // 2. 카테고리별 필터링
  const availableOutfits = outfitsData.filter(o => o.category === category);
  console.log('[assignOutfits] Available outfits for category:', availableOutfits.length);

  if (availableOutfits.length === 0) {
    console.warn(`[assignOutfits] No outfits found for category: ${category}`);
    console.warn('[assignOutfits] Available categories:', [...new Set(outfitsData.map(o => o.category))]);
    return new Map();
  }

  // 3. 중복 없이 랜덤 선택
  const selectedOutfits = new Map<string, { name: string; prompt: string }>();
  const usedIndices = new Set<number>();
  const usedMaleNames = new Set<string>();
  const isGolfTopic = /골프|golf/i.test(String(topic || '')) || String(genre || '').toLowerCase().includes('golf');
  const malePool = getOutfitPool().filter((item) => {
    if (!isMaleOutfit(item)) return false;
    if (isGolfTopic) return item.categories.includes('GOLF');
    return true;
  });
  const fallbackMalePool = getOutfitPool().filter((item) => isMaleOutfit(item));

  characterIds.forEach(slotId => {
    if (slotId.startsWith('Woman')) {
      let randomIndex: number;
      let attempts = 0;
      const maxAttempts = availableOutfits.length * 2;

      do {
        randomIndex = Math.floor(Math.random() * availableOutfits.length);
        attempts++;
      } while (usedIndices.has(randomIndex) && attempts < maxAttempts);

      if (attempts < maxAttempts) {
        usedIndices.add(randomIndex);
        const outfit = availableOutfits[randomIndex];
        selectedOutfits.set(slotId, {
          name: outfit.name,
          prompt: outfit.prompt
        });
        console.log(`[assignOutfits] Assigned to ${slotId}:`, outfit.name);
      } else {
        console.warn(`[assignOutfits] Could not assign outfit to ${slotId} (max attempts reached)`);
      }
    } else if (slotId.startsWith('Man')) {
      const source = malePool.length > 0 ? malePool : fallbackMalePool;
      const available = source.filter((item) => !usedMaleNames.has(item.name));
      const pickSource = available.length > 0 ? available : source;
      const picked = pickSource[Math.floor(Math.random() * pickSource.length)];
      if (picked) {
        selectedOutfits.set(slotId, {
          name: picked.name,
          prompt: picked.name
        });
        usedMaleNames.add(picked.name);
        console.log(`[assignOutfits] Assigned to ${slotId}:`, picked.name);
      }
    }
  });

  console.log('[assignOutfits] Final outfit map:', selectedOutfits);
  return selectedOutfits;
};

const EMOTION_TO_EXPRESSION: Record<string, string> = {
  // 코미디/유머
  '당황': 'flustered and embarrassed expression',
  '충격': 'shocked wide-eyed expression, jaw dropped',
  '민망': 'cringing embarrassed look, covering face',
  '자폭': 'self-deprecating laugh, facepalm',
  '황당': 'bewildered dumbfounded expression',
  // 로맨스/설렘
  '두근': 'shy blushing look, eyes darting away',
  '설렘': 'gentle smile with soft gaze, shy anticipation',
  '의식': 'self-conscious nervous smile',
  // 대박/반전
  '오해': 'suspicious narrowed eyes, leaning forward',
  '폭로': 'mouth agape, hands raised in shock',
  '해명': 'frantically explaining with animated hand gestures',
  // 공통
  '웃음': 'genuine hearty laugh with crinkled eyes',
  '분노': 'angry clenched jaw, fierce glare',
  '슬픔': 'teary-eyed, looking down with sadness',
  '놀람': 'gasping with wide eyes and raised eyebrows',
  '평화': 'calm serene expression, relaxed posture',
  '의심': 'suspicious side-eye, arms crossed',
  '안도': 'relieved deep exhale, hand on chest',
  '감동': 'touched emotional tears, hand over heart',
};

const resolveExpressionFromEmotion = (emotionText: string): string => {
  if (!emotionText) return '';
  for (const [key, value] of Object.entries(EMOTION_TO_EXPRESSION)) {
    if (emotionText.includes(key)) return value;
  }
  return '';
};

const extractActionFromScriptLine = (scriptLine: string): string => {
  if (!scriptLine) return '';
  const ACTION_PATTERNS: Array<{ pattern: RegExp; english: string }> = [
    { pattern: /달려|뛰어|달리/g, english: 'running urgently' },
    { pattern: /울|눈물/g, english: 'crying with tears' },
    { pattern: /웃|웃음/g, english: 'laughing heartily' },
    { pattern: /소리.*지르|외치/g, english: 'shouting loudly' },
    { pattern: /굳어|멈|멈춰/g, english: 'frozen in place, motionless' },
    { pattern: /돌아보|돌아서/g, english: 'turning around suddenly' },
    { pattern: /앉|자리|주저앉/g, english: 'sitting down' },
    { pattern: /잡|붙잡/g, english: 'grabbing tightly' },
    { pattern: /밀|밀어/g, english: 'pushing away' },
    { pattern: /속삭|귓속/g, english: 'whispering closely' },
    { pattern: /뒤돌아|돌아보/g, english: 'looking back over shoulder' },
    { pattern: /손.*흔|인사/g, english: 'waving hand greeting' },
    { pattern: /고개.*숙|숙이/g, english: 'bowing head down' },
    { pattern: /눈.*마주|시선/g, english: 'making eye contact' },
    { pattern: /한숨|긴.*숨/g, english: 'sighing deeply' },
  ];
  const matched: string[] = [];
  for (const { pattern, english } of ACTION_PATTERNS) {
    if (pattern.test(scriptLine)) {
      matched.push(english);
      if (matched.length >= 2) break;
    }
  }
  return matched.join(', ');
};

/**
 * applyCharacterInfoToScenes
 *
 * 씬별 캐릭터 슬롯 ID를 실제 캐릭터 정보로 치환하여 최종 프롬프트 생성
 * - 캐릭터 정보: shortsLabCharacterRulesDefaults.ts에서 조회
 * - 의상 정보: assignOutfitsToCharacters에서 받은 Map 사용
 * - 100% 일관성 보장
 */
export const applyCharacterInfoToScenes = (params: {
  scenes: any[];
  characterRules: any;
  outfitMap: Map<string, { name: string; prompt: string }>;
  accessoryMap?: Map<string, string[]>;
  forceWinterBackground?: boolean;
  targetAge: string;
}): any[] => {
  const { scenes, characterRules, outfitMap, accessoryMap, forceWinterBackground, targetAge } = params;
  const CANDID_PERSON_ACTIONS = [
    'half-turning with a spontaneous laugh',
    'adjusting grip while glancing sideways',
    'stepping forward with relaxed shoulders',
    'raising one hand mid-conversation',
    'briefly pausing with a surprised expression',
    'looking off-frame as if reacting to someone',
    'leaning slightly while speaking naturally',
    'catching breath with a subtle smile'
  ];
  const CANDID_GROUP_CONNECTORS = [
    'in a candid, documentary-style moment',
    'captured like an off-guard candid frame',
    'with natural, unscripted interaction energy'
  ];
  const buildCandidGroupAction = (baseAction: string, count: number, seed: number) => {
    const cleanedBase = String(baseAction || '').trim();
    const personClauses: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const action = CANDID_PERSON_ACTIONS[(seed + i * 2) % CANDID_PERSON_ACTIONS.length];
      personClauses.push(`Person ${i + 1} ${action}`);
    }
    const connector = CANDID_GROUP_CONNECTORS[seed % CANDID_GROUP_CONNECTORS.length];
    const uniquePoseRule = 'each person with different pose, different hand gesture, different gaze direction, no mirrored or synchronized pose';
    const merged = [cleanedBase, personClauses.join(', '), connector, uniquePoseRule]
      .filter(Boolean)
      .join(', ');
    return merged;
  };
  const getShotTypeByCount = (count: number): '원샷' | '투샷' | '쓰리샷' => {
    if (count >= 3) return '쓰리샷';
    if (count === 2) return '투샷';
    return '원샷';
  };
  const normalizeCameraByCount = (cameraValue: string, count: number, isPOV: boolean) => {
    const raw = String(cameraValue || '').trim();
    if (isPOV) return 'full body wide shot';
    if (!raw) {
      if (count >= 3) return 'group wide shot';
      if (count === 2) return 'two-shot wide';
      return 'full body wide shot';
    }
    if (count >= 3 && !/group|three|wide/i.test(raw)) return 'group wide shot';
    if (count === 2 && !/two|pair|wide/i.test(raw)) return 'two-shot wide';
    return raw;
  };
  const normalizedAge = convertAgeToEnglish(targetAge || '');
  const getFallbackAge = (identity: string, gender: 'female' | 'male') => {
    if (!identity) return '';
    const regex = gender === 'female' ? /in her [^,]+/i : /in his [^,]+/i;
    const match = identity.match(regex);
    return match ? match[0] : '';
  };
  const hasWinterKeyword = (value: string) => /snow|winter|ice|frost|icy|blizzard|snowy/i.test(value || '');
  const winterHint = 'snowy winter landscape, visible snow on ground, cold atmosphere';
  const colorLockPerCharacter = 'exact outfit colors, no hue shift, no color variation';
  const scene1Background = scenes[0]?.background || '';

  return scenes.map((scene, sceneIndex) => {
    const { 
        characterIds = [], action = '', cameraAngle = '', background = '', camera = '',
        emotion = '', emotionBeat = '', summary = '', scriptLine = ''
    } = scene;

    // ========================================
    // 1. 캐릭터 블록 생성
    // ========================================
    const characterBlocks: string[] = [];

    characterIds.forEach((slotId: string) => {
      if (slotId.startsWith('Woman')) {
        const femaleChar = characterRules.females.find((f: any) => f.id === slotId);
        if (!femaleChar) return;

        const ageText = femaleChar.isFixedAge
          ? femaleChar.fixedAge
          : normalizedAge
            ? `in her ${normalizedAge}`
            : getFallbackAge(femaleChar.identity, 'female');

        const identity = `A stunning Korean woman ${ageText}`;
        const hair = femaleChar.hair;
        const body = femaleChar.body;
        const outfit = outfitMap.get(slotId);
        const outfitText = outfit ? outfit.prompt : 'elegant casual outfit';
        const accessories = accessoryMap?.get(slotId) || [];
        const accessoryText = accessories.length > 0
          ? `, with ${accessories.join(', ')}`
          : '';

        characterBlocks.push(
          `${identity}, ${hair}, ${body}, wearing ${outfitText}${accessoryText}, ${colorLockPerCharacter}`
        );
      }
      else if (slotId.startsWith('Man')) {
        const maleChar = characterRules.males.find((m: any) => m.id === slotId);
        if (!maleChar) return;

        const ageText = normalizedAge
          ? `in his ${normalizedAge}`
          : getFallbackAge(maleChar.identity, 'male');
        const identity = `A handsome Korean man ${ageText}`;
        const hair = maleChar.hair;
        const body = maleChar.body;
        const outfit = outfitMap.get(slotId);
        const outfitText = outfit ? outfit.prompt : 'tailored casual outfit';

        characterBlocks.push(
          `${identity}, ${hair}, ${body}, wearing ${outfitText}, ${colorLockPerCharacter}`
        );
      }
    });

    // ========================================
    // 2. POV 처리: 화자 캐릭터 제거
    // ========================================
    const effectiveCamera = cameraAngle || camera || 'full body wide shot';
    const isPOV = /pov/i.test(effectiveCamera);
    
    let filteredCharacterBlocks = [...characterBlocks];
    let filteredCharacterIds = [...characterIds];

    if (isPOV && characterIds.length >= 2) {
      const narratorSlot = scene.narrator?.slot || characterIds[0];
      const narratorIndex = characterIds.indexOf(narratorSlot);
      
      if (narratorIndex !== -1) {
        filteredCharacterIds = characterIds.filter((_: string, i: number) => i !== narratorIndex);
        filteredCharacterBlocks = characterBlocks.filter((_: string, i: number) => i !== narratorIndex);
      }
    }

    // ========================================
    // 3. [Person N] 구분자 적용
    // ========================================
    let identityBlock: string;
    if (filteredCharacterBlocks.length === 1) {
      identityBlock = filteredCharacterBlocks[0];
    } else if (filteredCharacterBlocks.length > 1) {
      identityBlock = filteredCharacterBlocks
        .map((block, i) => `[Person ${i + 1}: ${block}]`)
        .join(' ');
    } else {
      identityBlock = characterBlocks[0] || '';
    }

    // ========================================
    // 4. Action 슬롯명 → Person N 치환
    // ========================================
    let processedAction = action || 'standing naturally';
    
    // POV일 때 "looking at camera" 추가
    if (isPOV) {
      processedAction = `${processedAction}, looking at camera (POV target)`;
    }
    
    // 투샷/쓰리샷일 때 슬롯명을 Person N으로 치환
    if (characterIds.length >= 2) {
      characterIds.forEach((slotId: string, index: number) => {
        const personLabel = `Person ${index + 1}`;
        const charRule = slotId.startsWith('Woman')
          ? characterRules.females?.find((f: any) => f.id === slotId)
          : characterRules.males?.find((m: any) => m.id === slotId);
        
        const charName = charRule?.name || '';
        
        processedAction = processedAction.replace(
          new RegExp(slotId, 'g'),
          personLabel
        );
        if (charName) {
          processedAction = processedAction.replace(
            new RegExp(charName, 'g'),
            personLabel
          );
        }
      });
    }
    if (filteredCharacterIds.length >= 2) {
      processedAction = buildCandidGroupAction(processedAction, filteredCharacterIds.length, sceneIndex);
    }

    // ========================================
    // 5. 배경 처리 (장소 전환 지원)
    // ========================================
    const effectiveBackground = background || scene1Background;
    const backgroundWithWinter = forceWinterBackground && !hasWinterKeyword(effectiveBackground)
      ? (effectiveBackground ? `${effectiveBackground}, ${winterHint}` : winterHint)
      : effectiveBackground;
    const backgroundBlock = backgroundWithWinter ? `in a ${backgroundWithWinter}` : '';

    // ========================================
    // 6. 카메라 & 전신 힌트
    // ========================================
    const resolvedCamera = normalizeCameraByCount(effectiveCamera, filteredCharacterIds.length, isPOV);
    const resolvedShotType = getShotTypeByCount(filteredCharacterIds.length);
    const cameraBlock = `${resolvedCamera} camera angle`;
    const isWideShot = /wide|full body|aerial|drone|establishing/i.test(resolvedCamera);
    const fullBodyHint = isWideShot ? 'full body visible, head-to-toe' : '';
    const colorLockHint = 'color-accurate, preserve original outfit colors, no color changes';
    const candidGroupHint = filteredCharacterIds.length >= 2
      ? 'candid multi-person shot, natural asymmetry, no identical pose, no synchronized gesture'
      : '';

    // ========================================
    // 7. 최종 프롬프트 조립
    // ========================================
    const emotionText = emotion || emotionBeat || '';
    const expressionHint = resolveExpressionFromEmotion(emotionText);

    const fallbackAction = (!processedAction || processedAction === 'standing naturally')
      ? extractActionFromScriptLine(scriptLine)
      : '';

    const sceneContext = summary ? `scene context: ${summary}` : '';

    const promptParts = [
      expressionHint,
      identityBlock,
      fallbackAction || processedAction,
      sceneContext,
      cameraBlock,
      fullBodyHint,
      backgroundBlock,
      colorLockHint,
      candidGroupHint,
      'no text, no letters, no typography',
      'photorealistic, 8k resolution, cinematic lighting, masterpiece --ar 9:16'
    ].filter(Boolean);

    const finalPrompt = promptParts.join(', ');

    return {
      ...scene,
      cameraAngle: resolvedCamera,
      camera: resolvedCamera,
      shotType: resolvedShotType,
      characterIds: filteredCharacterIds,
      prompt: finalPrompt,
      characterProfilesApplied: true
    };
  });
};

export default {
  buildLabScriptPrompt,
  buildLabImagePrompt,
  buildMasterPass1Prompt,
  buildMasterPass2Prompt,
  validateProfileConsistency,
  pickRandomOutfit,
  pickFemaleOutfit,
  pickMaleOutfit,
  generateRandomSeed,
  convertAgeToEnglish,
  LAB_GENRE_GUIDELINES,
  MAMA_CHARACTER_PRESETS,
  getMAMACharacterPresets,
  PROMPT_CONSTANTS,
  getPromptConstants,
  RANDOM_SEED_POOLS,
  buildSimplifiedMasterPrompt,
  assignOutfitsToCharacters,
  applyCharacterInfoToScenes
};

/**
 * labPromptBuilder.ts
 * 쇼츠랩 전용 경량화 프롬프트 빌더
 *
 * v3.9.0 업데이트 (2026-01-24):
 * - Global Quality Footer 도입: 기술 태그(START/END)를 하단으로 통합하여 토큰 효율화
 * - 겨울 악세서리 로직 정교화: Mink, Velvet, Crystal, Diamond 등 럭셔리 키워드 보강
 * - MAMA_CHARACTER_PRESETS 업데이트: 상세한 바디/헤어 묘사 및 성별 기반 로직 강화
 * - 성별 기반 나레이션 및 의상 스위칭 최적화 (WomanA ↔ ManA)
 */

import { UNIFIED_OUTFIT_LIST } from '../constants';
import { buildOutfitPool } from './outfitService';
import type { OutfitPoolItem } from './outfitService';
import { DEFAULT_PROMPT_RULES } from './shortsLabPromptRulesDefaults';
import { getShortsLabPromptRules } from './shortsLabPromptRulesManager';

// ============================================
// 겨울 테마 및 럭셔리 컬렉션 (v3.9.0)
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
 * 겨울 아우터 + 악세서리 선택 (v3.9.1)
 * 남성은 악세서리를 사용하지 않음 (마마님 특명)
 */
export const selectWinterItems = (gender: 'female' | 'male' = 'female'): { outerwear: string; accessories: string[] } => {
  const outerwear = '';
  if (gender === 'male') {
    return { outerwear: '', accessories: [] }; // 남성은 깔끔하게 아무것도 안 함
  }

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const categories = Object.keys(WINTER_COLLECTION) as Array<keyof typeof WINTER_COLLECTION>;
  const shuffledCats = [...categories].sort(() => 0.5 - Math.random());
  const count = 2;
  const accessories = shuffledCats.slice(0, count).map(cat => pick(WINTER_COLLECTION[cat]));

  return { outerwear, accessories };
};

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
}

export interface LabGenreGuidelineEntry extends LabGenreGuideline {
  id: string;
}

// ============================================
// 장르별 가이드라인 정의
// ============================================

export const LAB_GENRE_GUIDELINES: Record<string, LabGenreGuideline> = {
  'comedy-humor': {
    name: '코미디/유머',
    description: '웃긴 상황과 반전',
    emotionCurve: '평온 → 당황 → 폭소',
    structure: `[HOOK] 황당한 일 예고
[SETUP] 평범한 시작
[BUILD-UP] 상황 꼬임
[CLIMAX] 터지는 순간
[TWIST] 황당한 반전`,
    killerPhrases: [
      '이게 뭐야 진짜',
      '아 진짜 미치겠네',
      '헐, 뭐라고?',
      '알고보니...',
      '근데 문제는',
      '하필이면'
    ],
    supportingCharacterPhrasePatterns: [],
    bodyReactions: [
      '눈이 커지며',
      '입을 벌리고',
      '손으로 입을 막으며'
    ],
    forbiddenPatterns: [
      '얼굴이 빨개졌다',
      '심장이 터질 것 같았다',
      '나이스샷 오해',
      '깜짝 파티 결말'
    ],
    goodTwistExamples: [],
    supportingCharacterTwistPatterns: [],
    badTwistExamples: []
  },

  'romance-flutter': {
    name: '로맨스/설렘',
    description: '설레는 감정과 순간',
    emotionCurve: '평온 → 설렘 → 두근거림',
    structure: `[HOOK] 평소와 다른 느낌
[SETUP] 일상적 만남
[BUILD-UP] 거리 좁혀짐
[CLIMAX] 의미심장한 순간
[TWIST] 혼란/여운`,
    killerPhrases: [
      '오늘따라 왜 이러지',
      '시선을 어디 둘지 몰랐어',
      '손끝이 미세하게 떨렸지',
      '나만 이런 건가',
      '괜히 의식됐어'
    ],
    supportingCharacterPhrasePatterns: [],
    bodyReactions: [
      '눈을 피하며',
      '손끝이 떨리며',
      '목소리가 작아지며'
    ],
    forbiddenPatterns: [
      '심장이 쿵쾅쿵쾅',
      '얼굴이 달아올랐다',
      '첫눈에 반했다',
      '운명 같은 만남'
    ],
    goodTwistExamples: [],
    supportingCharacterTwistPatterns: [],
    badTwistExamples: []
  },

  'affair-suspicion': {
    name: '불륜/외도 의심',
    description: '의심과 오해, 건전한 반전',
    emotionCurve: '의심 → 증폭 → 해소',
    structure: `[HOOK] 충격적 발견
[SETUP] 최근 정황
[BUILD-UP] 의심 증폭
[CLIMAX] 대면/추궁
[TWIST] 건전한 반전`,
    killerPhrases: [
      '이거 뭐야?',
      '요즘 좀 이상하지 않아?',
      '솔직히 말해봐',
      '내가 다 알아',
      '알고보니...',
      '뭔가 숨기는 거 있지'
    ],
    supportingCharacterPhrasePatterns: [],
    bodyReactions: [
      '눈을 피하며',
      '말을 더듬으며',
      '땀을 흘리며'
    ],
    forbiddenPatterns: [
      '실제 불륜 확정',
      '이혼 결심',
      '폭력적 대응',
      '영수증 발견 패턴'
    ],
    goodTwistExamples: [],
    supportingCharacterTwistPatterns: [],
    badTwistExamples: []
  },

  'hit-twist-spicy': {
    name: '대박 반전 (매운맛)',
    description: '오해 유발 후 건전한 반전',
    emotionCurve: '긴장 → 오해 극대화 → 해소',
    structure: `[HOOK] 오해 유발 대사
[SETUP] 아슬아슬한 상황
[BUILD-UP] 오해 극대화
[CLIMAX] 목격/등장
[TWIST] 건전한 진실`,
    killerPhrases: [
      '조금만 더...',
      '너무 꽉 조여요',
      '금방 끝나요',
      '누가 보면 어떡해',
      '알고보니...',
      '오해예요!'
    ],
    supportingCharacterPhrasePatterns: [],
    bodyReactions: [
      '얼굴이 붉어지며',
      '당황하며',
      '소리를 지르며'
    ],
    forbiddenPatterns: [
      '실제 성적 상황',
      '노출 묘사',
      '신체 접촉 직접 묘사',
      '장갑 끼워주기 패턴'
    ],
    goodTwistExamples: [],
    supportingCharacterTwistPatterns: [],
    badTwistExamples: []
  }
};

/**
 * 겨울용 타이트 긴팔 변환 (v3.9.0)
 */
export const convertToTightLongSleeveWithShoulderLine = (outfit: string): string => {
  if (!outfit) return outfit;

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
  const shortSleeveKeywords = ['Sleeveless', 'Halter-neck', 'Short-sleeve', 'Tube Top', 'Cap-sleeve', 'Off-shoulder'];

  let isChanged = false;
  shortSleeveKeywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi');
    if (regex.test(newTop)) {
      const shoulderStyle = Math.random() < 0.5 ? 'Off-shoulder' : 'Cold-shoulder';
      newTop = newTop.replace(regex, `${shoulderStyle} tight-fitting long-sleeve`);
      isChanged = true;
    }
  });

  if (!isChanged && !newTop.toLowerCase().includes('long-sleeve')) {
    const shoulderStyle = Math.random() < 0.5 ? 'Off-shoulder' : 'Cold-shoulder';
    newTop = `${newTop} (${shoulderStyle} tight-fitting long-sleeve version)`;
  }

  return tail ? `${newTop}${joiner}${tail}` : newTop;
};

export const applyWinterLookToExistingPrompt = (
  longPrompt: string,
  longPromptKo: string,
  gender: 'female' | 'male' = 'female'
): { longPrompt: string; longPromptKo: string } => {
  if (!longPrompt) return { longPrompt, longPromptKo };

  let newPrompt = longPrompt;
  let newPromptKo = longPromptKo;

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

  const outfitPattern = /([^,]+[\s\+]+[^,]+(?:Mini Skirt|Shorts|Pants|Dress|Skirt|Leggings)[^,]*)/i;
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
      const winterOutfit = convertToTightLongSleeveWithShoulderLine(originalOutfit);
      contentPart = contentPart.replace(originalOutfit, winterOutfit);
    }
  }

  if (!contentPart.toLowerCase().includes('accessorized with')) {
    const { accessories } = selectWinterItems(gender);
    const accsStr = accessories.join(', ');
    contentPart = contentPart.trim().replace(/,\s*$/, '') + `, accessorized with ${accsStr}, `;
    newPromptKo = `${newPromptKo} (겨울 룩 적용됨: ${accsStr})`;
  }

  if (!contentPart.toLowerCase().includes('snow')) {
    contentPart = contentPart.replace(/(standing|walking|looking|sitting|background|setting)/i, `$1 in a heavy snow falling snowy background`);
  }

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
  enableWinterAccessories?: boolean;
}

// ============================================
// 마마님 취향 반영 캐릭터 프리셋 (v3.9.0)
// ============================================

export const MAMA_CHARACTER_PRESETS = {
  FEMALE_A: {
    identity: 'A stunning Korean woman',
    bodyType: 'Extraordinarily high-projection perky bust with high-seated chest line, voluptuous hourglass figure',
    style: 'perfectly managed sophisticated look, confident presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE_B: {
    identity: 'A stunning Korean woman',
    bodyType: 'Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves',
    style: 'charming presence, expressive and lively reactions',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE_C: {
    identity: 'A stunning Korean woman',
    bodyType: 'Gracefully toned and slim athletic body, expertly managed sleek silhouette with perky high-seated bust',
    style: 'composed and calm observer demeanor, elegant presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE_D: {
    identity: 'A stunning Korean woman',
    bodyType: 'Extraordinarily high-projection perky bust with high-seated chest line, voluptuous hourglass figure',
    style: 'bright cheerful professional presence, sophisticated and beautiful caddy look',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE: {
    identity: 'A stunning Korean woman',
    bodyType: 'Extraordinarily high-projection perky bust with high-seated chest line, voluptuous hourglass figure',
    style: 'perfectly managed sophisticated look, confident presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  MALE: {
    identity: 'A handsome Korean man',
    bodyType: 'fit athletic build with broad shoulders',
    style: 'dandy and refined presence, well-groomed and polished appearance',
    outfitFit: 'tailored slim-fit, clean and sharp lines'
  }
};

const getActivePromptRules = () => getShortsLabPromptRules() || DEFAULT_PROMPT_RULES;
const getPromptConstants = () => getActivePromptRules().promptConstants || DEFAULT_PROMPT_RULES.promptConstants;
const getNoTextTag = () => getActivePromptRules().noTextTag || DEFAULT_PROMPT_RULES.noTextTag;
const shouldEnforceKoreanIdentity = () => getActivePromptRules().enforceKoreanIdentity !== false;
const getExpressionKeywordMap = () => getActivePromptRules().expressionKeywords || DEFAULT_PROMPT_RULES.expressionKeywords;
const getCameraMapping = () => getActivePromptRules().cameraMapping || DEFAULT_PROMPT_RULES.cameraMapping;
const getOutfitSelectionRules = () => getActivePromptRules().outfitSelection || DEFAULT_PROMPT_RULES.outfitSelection;

export const getStoryStageBySceneNumber = (sceneNumber: number, totalScenes: number = 12): string => {
  const ratio = sceneNumber / totalScenes;
  if (sceneNumber === 1) return 'hook';
  if (ratio <= 0.25) return 'setup';
  if (ratio <= 0.5) return 'buildup';
  if (ratio <= 0.7) return 'climax';
  if (ratio <= 0.85) return 'twist';
  return 'outro';
};

export const getExpressionForScene = (genre: string, storyStage: string): string => {
  const genreKey = genre.toLowerCase().replace(/\s+/g, '-').replace(/[\/\\]/g, '-');
  const expressionMap = getExpressionKeywordMap();
  const expressions = expressionMap[genreKey] || expressionMap['default'];
  return expressions[storyStage] || expressions['hook'];
};

export const getCameraPromptForScene = (storyStage: string): string => {
  const cameraMap = getCameraMapping();
  const mapping = cameraMap[storyStage] || cameraMap['buildup'];
  return mapping.prompt;
};

export const ACTION_KEYWORD_MAPPING: Record<string, string> = {
  '골프채를 휘두르다': 'swinging golf club',
  '골프 스윙': 'golf swing motion',
  '퍼팅하다': 'putting golf ball',
  '손을 흔들다': 'waving hand',
  '손가락질하다': 'pointing finger',
  '박수치다': 'clapping hands',
  '걷다': 'walking',
  '뛰다': 'running',
  '앉다': 'sitting down',
  '속삭이다': 'whispering',
  '웃으며': 'while smiling',
  '놀라며': 'looking surprised'
};

export const translateActionToEnglish = (action: string): string => {
  if (!action) return '';
  let translated = action;
  const sortedKeys = Object.keys(ACTION_KEYWORD_MAPPING).sort((a, b) => b.length - a.length);
  for (const koreanKey of sortedKeys) {
    if (translated.includes(koreanKey)) {
      translated = translated.replace(koreanKey, ACTION_KEYWORD_MAPPING[koreanKey]);
    }
  }
  return translated;
};

export const enforceKoreanIdentity = (text: string, targetAgeLabel?: string, sceneNumber?: number, gender: 'female' | 'male' = 'female'): string => {
  if (!text) return text;
  let updated = text.replace(/\b(Japanese|Chinese|Thai|American|Western)\b/gi, 'Korean');
  const age = targetAgeLabel ? targetAgeLabel.match(/\d+/) : null;
  const ageStr = age ? `${age[0]}s` : '';
  const identity = `A stunning Korean ${gender === 'female' ? 'woman' : 'man'} ${ageStr ? 'in ' + (gender === 'female' ? 'her' : 'his') + ' ' + ageStr : ''}`.trim();
  const prefix = sceneNumber ? `Scene ${sceneNumber}, ${identity}, ` : `${identity}, `;
  return prefix + updated.replace(/^Scene \d+[.,]?\s*/i, '').replace(/^(A stunning|Korean|man|woman|in his|in her)[\d\w\s,]+/gi, '').trim();
};

export const enhanceScenePrompt = (text: string = "", options: any = {}): string => {
  if (!text) return text;
  const sceneNum = options.sceneNumber || 1;
  const totalScenes = options.totalScenes || 12;
  const storyStage = getStoryStageBySceneNumber(sceneNum, totalScenes);
  const expression = getExpressionForScene(options.genre || 'default', storyStage);
  const camera = getCameraPromptForScene(storyStage);
  const action = options.action ? translateActionToEnglish(options.action) : '';
  
  let updated = enforceKoreanIdentity(text, options.targetAgeLabel, sceneNum, options.gender);
  const noText = getNoTextTag();
  if (noText && !updated.toLowerCase().includes("no text")) updated += `, ${noText}`;
  
  return `Scene ${sceneNum}. [${expression}], ${camera}, ${action ? action + ', ' : ''}${updated.replace(/^Scene \d+[.,]?\s*/i, '')}`;
};

/**
 * 남성 전용 의상 선택 (v3.9.1)
 * 마마님 특명: 평범한 디폴트 룩 위주로 선택하며, 인물 간 중복 방지
 */
export const pickMaleOutfit = (topic: string = '', exclude: string[] = []): string => {
  const isGolf = topic.toLowerCase().includes('골프') || topic.toLowerCase().includes('golf');
  const isOffice = topic.toLowerCase().includes('오피스') || topic.toLowerCase().includes('회사') || topic.toLowerCase().includes('office');

  // 1. 테마별 디폴트 의상 풀 정의
  const golfOutfits = [
    'Navy Slim-fit Polo + White Tailored Golf Pants',
    'White Performance Polo + Charcoal Gray Golf Trousers',
    'Grey Technical Half-zip + Beige Chino Golf Pants',
    'Black Breathable Polo + Navy Slim Golf Slacks'
  ];

  const officeOutfits = [
    'Charcoal Modern Suit (No Tie)',
    'Navy Blue Business Suit (No Tie)',
    'White Dress Shirt + Black Tailored Slacks',
    'Light Blue Shirt + Grey Formal Pants'
  ];

  const dandyOutfits = [
    'White Dress Shirt with Rolled-up Sleeves + Black Slacks',
    'Navy Cashmere V-neck Sweater + Gray Tailored Pants',
    'Premium White T-shirt + Khaki Chino Pants',
    'Beige Knit Top + Dark Navy Jeans'
  ];

  // 2. 주제에 맞는 풀 선택
  let selectedPool = dandyOutfits;
  if (isGolf) selectedPool = golfOutfits;
  else if (isOffice) selectedPool = officeOutfits;

  // 3. 중복 제외 필터링 (이미 선택된 옷은 뺌)
  const availableCandidates = selectedPool.filter(outfit => !exclude.includes(outfit));
  
  // 4. 최종 선택 (가용 후보가 없으면 전체 풀에서 선택)
  const finalPool = availableCandidates.length > 0 ? availableCandidates : selectedPool;
  return finalPool[Math.floor(Math.random() * finalPool.length)];
};

export const pickFemaleOutfit = (genre: string, topic: string = '', exclude: string[] = []): string => {
  const isSexy = genre === 'affair-suspicion' || genre === 'hit-twist-spicy';
  const pool = buildOutfitPool(UNIFIED_OUTFIT_LIST as any).filter(i => !i.categories.includes('MALE') && !exclude.includes(i.name));
  const candidates = isSexy ? pool.filter(i => i.categories.includes('SEXY')) : pool.filter(i => !i.categories.includes('SEXY'));
  const finalPool = candidates.length > 0 ? candidates : pool;
  return (finalPool.length > 0 ? finalPool[Math.floor(Math.random() * finalPool.length)] : {name: 'White Dress'}).name;
};

export const applyWinterItems = (outfit: string, outerwear: string, accessories: string[]): string => {
  const styled = convertToTightLongSleeveWithShoulderLine(outfit);
  return `${styled}, accessorized with ${accessories.join(', ')}`;
};

/**
 * 프롬프트에서 네거티브 프롬프트 부분을 추출하고 분리
 * @param prompt 전체 프롬프트 문자열
 * @returns { cleaned: 네거티브가 제거된 클린 프롬프트, negative: 추출된 네거티브 프롬프트 }
 */
export const extractNegativePrompt = (prompt: string): { cleaned: string; negative: string } => {
  if (!prompt) return { cleaned: '', negative: '' };

  const trimmed = prompt.trim();

  // "NOT"으로 시작하는 부분을 찾아서 분리
  const notIndex = trimmed.search(/\bNOT\s+/i);

  if (notIndex === -1) {
    return { cleaned: trimmed, negative: '' };
  }

  const cleaned = trimmed.slice(0, notIndex).trim().replace(/,\s*$/, '');
  const negative = trimmed.slice(notIndex).trim();

  return { cleaned, negative };
};

export const validateAndFixPrompt = (prompt: string): string => {
  if (!prompt) return prompt;
  let fixed = prompt.trim();
  // 마마님의 품질 기준 (no text, Korean identity 등) 강제 적용 여부 확인 및 보정
  if (!fixed.toLowerCase().includes('korean')) {
    fixed = 'A stunning Korean woman, ' + fixed;
  }
  const noText = 'no text, no letters, no typography';
  if (!fixed.toLowerCase().includes('no text')) {
    fixed += `, ${noText}`;
  }
  return fixed;
};

export const buildLabScriptPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender, enableWinterAccessories } = options;
  let wA = pickFemaleOutfit(genre, topic);
  let wB = pickFemaleOutfit(genre, topic, [wA]);
  let wD = pickFemaleOutfit(genre, topic, [wA, wB]);
  let mA = pickMaleOutfit(topic);
  let mB = pickMaleOutfit(topic, [mA]);

  if (enableWinterAccessories) {
    wA = applyWinterItems(wA, '', selectWinterItems().accessories);
    wB = applyWinterItems(wB, '', selectWinterItems().accessories);
    wD = applyWinterItems(wD, '', selectWinterItems().accessories);
  }

  const narrator = gender === 'female' ? 'Woman A (지영)' : 'Man A (준호)';
  return `
🚨🚨🚨 [MASTER REGULATIONS v3.9] 🚨🚨🚨
[1. CHARACTER SLOT SYSTEM]
- WomanA (지영): ${MAMA_CHARACTER_PRESETS.FEMALE_A.bodyType}, ${MAMA_CHARACTER_PRESETS.FEMALE_A.style}, long soft-wave hair.
- WomanB (혜경): ${MAMA_CHARACTER_PRESETS.FEMALE_B.bodyType}, ${MAMA_CHARACTER_PRESETS.FEMALE_B.style}, short chic bob.
- WomanD (캐디): ${MAMA_CHARACTER_PRESETS.FEMALE_D.bodyType}, ${MAMA_CHARACTER_PRESETS.FEMALE_D.style}, high-bun hairstyle.
- ManA (준호): ${MAMA_CHARACTER_PRESETS.MALE.bodyType}, dandy style.

[2. OUTFITS]
- WomanA: ${wA}
- WomanB: ${wB}
- WomanD: ${wD}
- ManA: ${mA}
- ManB: ${mB}

[3. NARRATOR]
- Narrator: ${narrator}

[4. GLOBAL QUALITY FOOTER]
- START: "unfiltered raw photograph, 8k ultra photorealism, ultra detailed skin texture, professional lighting, RAW photo, A stunning Korean woman in her ${targetAge}, [Slot ID], ..."
- END: "high-fashion editorial refined, depth of field, 85mm lens, f/1.8, realistic skin, 8k, no text, --ar 9:16"

[5. INSTRUCTIONS]
- Create a viral shorts script about "${topic}" in ${genre} genre.
- Ensure character consistency and winter accessories (if enabled).
- Follow the 1:1 matching rule between scriptBody and scenes.
`;
};

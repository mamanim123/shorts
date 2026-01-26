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
    const pool = Math.random() < 0.5 ? WINTER_COLLECTION.HEADWEAR : WINTER_COLLECTION.SCARVES;
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

  // 치환할 소매 관련 키워드들 (상의에서만 치환)
  const shortSleeveKeywords = [
    'Sleeveless',
    'Halter-neck',
    'Short-sleeve',
    'Tube Top',
    'Cap-sleeve',
    'Off-shoulder',
    'Cowl-neck',
    'Twist Front',
    'One-shoulder'
  ];

  let isChanged = false;
  const deepVNeckRegex = /deep\s*v[-\s]?neck(?:line)?/gi;
  const deepNeckRegex = /deep\s*neck(?:line)?/gi;
  if (deepVNeckRegex.test(newTop) || deepNeckRegex.test(newTop)) {
    newTop = newTop
      .replace(deepVNeckRegex, 'Elegant Mock-neck tight-fitting long-sleeve')
      .replace(deepNeckRegex, 'Elegant Mock-neck tight-fitting long-sleeve');
    isChanged = true;
  }
  shortSleeveKeywords.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi');
    if (regex.test(newTop)) {
      // 기존 스타일(예: White, Mock-neck 등)은 보존하면서 키워드만 'Tight-fitting long-sleeve'로 치환
      newTop = newTop.replace(regex, 'Off-shoulder tight-fitting long-sleeve');
      isChanged = true;
    }
  });

  // 키워드 매칭이 안 되었더라도 겨울이면 상의 끝에 Long-sleeve 명시 (이미 있으면 제외)
  if (!isChanged && !newTop.toLowerCase().includes('long-sleeve')) {
    newTop = `${newTop} (Tight-fitting long-sleeve version)`;
  }

  // 상의와 하의 재결합 (하의인 tail은 원본 그대로)
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

  // 2. 의상 치환 로직 (contentPart 내에서만 수행)
  // '+', 'wearing', 'outfit:' 등 다양한 패턴 대응
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
  enableWinterAccessories?: boolean;
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

export const buildLabScriptOnlyPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender } = options;
  const genreGuide = options.genreGuideOverride || LAB_GENRE_GUIDELINES[genre];
  const seed = generateRandomSeed();
  const narratorName = gender === 'female' ? '지영' : '준호';
  const narratorSlot = gender === 'female' ? 'WomanA' : 'ManA';
  const emotionFlow = genreGuide?.emotionCurve || '';

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 유튜브 쇼츠 대본 전문 작가입니다.
아래 주제/장르/연령에 맞는 대본만 생성하세요.
이미지 프롬프트나 scenes는 절대 생성하지 않습니다.

주제: ${topic}
장르: ${genreGuide?.name || genre}
타겟 연령: ${targetAge}

출력은 반드시 아래 JSON 형식 하나만:
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
1) scriptBody는 8~12문장 (줄바꿈으로 구분)
2) 1문장 = 훅(강한 시작)
3) 2~3문장 = 배경/상황 설명
4) 4~7문장 = 전개/행동
5) 8~10문장 = 반전/결말
6) 대사는 자연스러운 구어체 한국어
7) scenes/longPrompt/shortPrompt 절대 포함 금지
8) 마크다운 금지, JSON만 출력

[Request ID: ${seed}]`;
};

// ============================================
// v3.6 - 장르별 표정 키워드 & 카메라 앵글 (규칙 파일 연동)
// ============================================

const getActivePromptRules = () => getShortsLabPromptRules() || DEFAULT_PROMPT_RULES;
const getPromptConstants = () =>
  getActivePromptRules().promptConstants || DEFAULT_PROMPT_RULES.promptConstants;
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

export const MAMA_CHARACTER_PRESETS = {
  FEMALE_A: {
    identity: 'A stunning Korean woman',
    bodyType: 'perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    style: 'perfectly managed sophisticated look, confident presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE_B: {
    identity: 'A stunning Korean woman',
    bodyType: 'Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, high-seated chest line',
    style: 'charming presence, expressive and lively reactions',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE_C: {
    identity: 'A stunning Korean woman',
    bodyType: 'Gracefully toned and slim athletic body, expertly managed sleek silhouette, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    style: 'composed and calm observer demeanor, elegant presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  FEMALE_D: {
    identity: 'A stunning Korean woman',
    bodyType: 'bright cheerful professional presence, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    style: 'bright cheerful professional presence, sophisticated and beautiful caddy look',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  // 하위 호환성을 위한 기본 FEMALE (Woman A와 동일)
  FEMALE: {
    identity: 'A stunning Korean woman',
    bodyType: 'perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
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

// ============================================
// 이미지 프롬프트 고정 문구 (절대 생략 금지)
// ============================================

export const PROMPT_CONSTANTS = DEFAULT_PROMPT_RULES.promptConstants;

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

  // 카메라 앵글 프롬프트
  const cameraPrompt = getCameraPromptForScene(storyStage);

  // v3.7: 동작 묘사 영어 변환
  let actionPrompt = '';
  if (options.action) {
    actionPrompt = translateActionToEnglish(options.action);
  }

  const llmProvidedOutfit = updated.includes("Outfit:");

  if (!llmProvidedOutfit && options.gender === 'male' && options.maleOutfit) {
    const maleTag = `Outfit: ${options.maleOutfit}`;
    if (!updated.includes(maleTag) && !updated.includes(options.maleOutfit)) {
      updated += `, ${maleTag}`;
    }
  } else if (!llmProvidedOutfit && options.femaleOutfit) {
    const femaleTag = `Outfit: ${options.femaleOutfit}`;
    if (!updated.includes(femaleTag) && !updated.includes(options.femaleOutfit)) {
      updated += `, ${femaleTag}`;
    }
  }

  // v3.6: 표정과 카메라 앵글을 맨 앞에 삽입
  // 기존 카메라 앵글이 이미 있으면 제거 후 새로 추가
  const existingCameraPattern = /^(close-up|medium shot|wide shot|extreme close-up|over-the-shoulder)[^,]*,?\s*/i;
  updated = updated.replace(existingCameraPattern, '');

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
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Interaction], [Background]',
  },

  // 쓰리샷: 3명 캐릭터 등장 - 반드시 [Person 1], [Person 2], [Person 3]로 구분
  THREE_SHOT: {
    description: '3명 캐릭터 함께 등장',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Person 3: identity, hair, body, wearing outfit] [Group Action], [Background]',
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
    description: '일상의 사소한 오해나 실수로 망가지는 상황. 화보 같은 느낌보다는 **생생하고 익살스러운 표정(expressive facial expressions)**과 **역동적인 굴욕 포즈(dynamic clumsy poses)**가 핵심.',
    emotionCurve: '😊 평화 → 😳 당황 → 😱 충격 → 🤦 민망 → 😂 자폭 웃음',
    structure: `
[HOOK] 🎯 시청자를 1초 안에 멈추게 하는 오프닝 (⚠️ 예시 그대로 복사 금지! 주제에 맞게 새롭게 창작할 것)
→ 패턴1: 상황 중간 시작 - "근데 그 사람이 돌아보는 거야", "손님이 갑자기 나를 보더니..."
→ 패턴2: 질문형 공감 - "혹시 이런 실수 해본 적 있어요?", "이거 나만 그래?"
→ 패턴3: 결과 스포일러 - "결국 그날... 가족회의 열렸어", "그래서 지금도 그 카페 못 가"
→ 패턴4: 미스터리/긴장 - "근데 뒤에 있던 사람이...", "웃으면서 다가오는데 뭔가 이상해"
→ 핵심: "망가지기 직전" 또는 "반전 1초 전"에서 시작해서 궁금증 유발

[SETUP] 😊 평화로운 일상 + 복선(Foreshadowing)
→ 아무것도 모른 채 잘난 척하거나 행복한 모습
→ 나중에 반전이 될 힌트를 슬쩍 흘림

[BUILD-UP] 😳 오해의 심화
→ 주변의 시선, 착각, 어깨에 힘 들어가는 상황

[CLIMAX] 😱 진실의 목격/폭로
→ 가장 민망한 순간에 정체가 탄로남
→ 예시 패턴: 알고보니 가족, 직장동료, 완전히 다른 상황 (⚠️ 주제에 맞게 새롭게 창작)

[TWIST] 🤦 민망함의 극치 + 반전 공개
→ 알고보니 가족, 친척, 혹은 완전히 다른 상황

[OUTRO] 😂 자폭하며 마무리
→ 웃음과 함께 교훈 또는 후일담 (⚠️ 주제에 맞게 새롭게 창작)
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
    description: '중년의 설렘. 첫사랑 감성, 권태기 부부의 재발견, 예상치 못한 두근거림',
    emotionCurve: '😐 무덤덤 → 👀 의식됨 → 💓 두근 → 😳 당황 → 🤔 "나만 이런가?"',
    structure: `
[HOOK] ⚡ 사건/충격을 첫 문장에 바로 던지기
→ "캐디가 내 손목을 붙잡는 순간 숨이 멎었어"
→ "문 열자마자 들린 한마디에 다리가 풀렸어"

[SETUP] 👀 일상 속 만남 + 복선
→ 늘 보던 사람인데 오늘 뭔가 다름
→ "평소처럼 (행동)하는데..."

[BUILD-UP] 💓 물리적/심리적 거리 좁혀짐
→ 우연한 접촉, 눈 마주침, 목소리 톤 변화
→ 시간이 느려지는 느낌 묘사
→ 신체반응 필수

[CLIMAX] 😳 결정적 순간
→ 의미심장한 한마디 or 행동
→ "그때 그 사람이 (말/행동)하더니..."

[TWIST] 🤔 혼란 + 여운
→ 확신 없는 결말
→ "나만 이런 건가?", "뭔가 있는 건가?"
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

export const pickMaleOutfit = (topic: string = '', excludeOutfits: string[] = []): string => {
  const selectionRules = getOutfitSelectionRules();
  const isGolf = topic.toLowerCase().includes('골프') || topic.toLowerCase().includes('golf');

  const normalizeList = (items?: string[]) =>
    Array.isArray(items) ? items.map(item => item.trim()).filter(Boolean) : [];
  const allowList = normalizeList(selectionRules.maleAllowList);
  const excludeList = normalizeList(selectionRules.maleExcludeList);
  const excludeSet = new Set([...excludeList, ...excludeOutfits]);

  // 1차: 주제에 맞는 의상 필터링 (골프면 골프 의상만)
  let candidates = getOutfitPool().filter(item => {
    if (!isMaleOutfit(item) && !isUnisexOutfit(item)) return false;
    if (allowList.length > 0 && !allowList.includes(item.name)) return false;
    if (excludeSet.has(item.name)) return false;
    
    // 골프 주제인 경우 GOLF 카테고리 필수
    if (isGolf && !item.categories.includes('GOLF')) return false;
    
    return true;
  });

  // 2차: 1차에서 없으면 전체 남성 의상에서 선택
  if (candidates.length === 0) {
    candidates = getOutfitPool().filter(item => {
      if (!isMaleOutfit(item) && !isUnisexOutfit(item)) return false;
      if (allowList.length > 0 && !allowList.includes(item.name)) return false;
      if (excludeSet.has(item.name)) return false;
      return true;
    });
  }

  const selectedName = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].name
    : 'Navy Slim-fit Polo + White Tailored Golf Pants';

  return adjustOutfitForSeason(selectedName, topic);
};

export const adjustOutfitForSeason = (outfit: string, topic: string): string => {
  if (topic && isWinterTopic(topic)) {
    return convertToTightLongSleeveWithShoulderLine(outfit);
  }
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
  excludeOutfits: string[] = []
): string => {
  // SEXY 의상은 '불륜/외도' 장르만 사용
  // '대박 반전'은 일반 의상 입고 상황이 야하게 보이는 것이므로 SEXY 의상 사용 안 함
  const isSexyGenre = genre === 'affair-suspicion';
  const selectionRules = getOutfitSelectionRules();
  const allowDuplicates = selectionRules.allowDuplicateFemale;
  const normalizeList = (items?: string[]) =>
    Array.isArray(items) ? items.map(item => item.trim()).filter(Boolean) : [];
  const allowList = normalizeList(selectionRules.femaleAllowList);
  const excludeList = normalizeList(selectionRules.femaleExcludeList);
  const excludeSet = new Set([
    ...excludeList,
    ...(allowDuplicates ? [] : excludeOutfits)
  ]);

  const candidates = getOutfitPool().filter(item => {
    if (isMaleOutfit(item)) return false;
    if (allowList.length > 0 && !allowList.includes(item.name)) return false;
    if (excludeSet.has(item.name)) return false;
    if (isSexyGenre) return item.categories.includes('SEXY');
    return !item.categories.includes('SEXY');
  });

  const fallbackCandidates = getOutfitPool().filter(item => {
    if (isMaleOutfit(item)) return false;
    if (allowList.length > 0 && !allowList.includes(item.name)) return false;
    if (excludeSet.has(item.name)) return false;
    return true;
  });

  const poolToUse = candidates.length > 0 ? candidates : fallbackCandidates;
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

  // 기본 의상 선택
  let womanAOutfit = pickFemaleOutfit(genre, topic, []);
  let womanBOutfit = pickFemaleOutfit(genre, topic, [womanAOutfit]);
  let womanDOutfit = pickFemaleOutfit(genre, topic, [womanAOutfit, womanBOutfit]);
  const manAOutfit = pickMaleOutfit(topic, []);
  const manBOutfit = pickMaleOutfit(topic, [manAOutfit]);

  // 의상 검증 (너무 긴 설명문 방지)
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

  // 겨울 악세서리 자동 적용 제거 (의상은 겨울 키워드에서만 긴팔 변환)

  const narratorSlot = gender === 'female' ? 'Woman A (지영)' : 'Man A (준호)';
  const narratorName = gender === 'female' ? '지영' : '준호';
  const promptRules = getActivePromptRules();
  const promptConstants = getPromptConstants();
  const promptSections = promptRules.promptSections || {};
  const defaultOutfitRulesSection = `## 🚨 의상 선택 절대 규칙 (매우 중요!)
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
- 리스트에 없는 의상 생성 절대 금지`;
  const defaultHairSection = `## 💇 헤어스타일
- **Woman A (지영)**: long soft-wave hairstyle
- **Woman B (혜경)**: short chic bob cut
- **Woman D (캐디)**: high-bun hairstyle (Professional golf caddy look)
- **Man A (준호)**: short neat hairstyle
- **Man B (민수)**: clean short cut`;
  const defaultCharacterSection = `## 👥 캐릭터 설정
- **Woman A (지영)**: 40대 주인공, 우아하고 자신감 있는 여성
- **Woman B (혜경)**: 40대 친구, 활발하고 장난기 있는 성격
- **Woman D (캐디)**: 20대 초반 골프 캐디, 밝고 세련되고 아름다운 프로페셔널 여성 (bright, cheerful, sophisticated, and beautiful professional golf caddy)
- **Man A (준호)**: 40대 남성, 댄디하고 세련된 신사
- **Man B (민수)**: 40대 남성 친구, 솔직하고 유머러스함`;
  const outfitRulesSection = promptSections.outfitRulesSection?.trim() || defaultOutfitRulesSection;
  const hairSection = promptSections.hairstyleSection?.trim() || defaultHairSection;
  const characterSection = promptSections.characterSection?.trim() || defaultCharacterSection;
  const imagePromptRulesExtra = promptSections.imagePromptRulesExtra?.trim();

  const isGolfTopic = topic.toLowerCase().includes('골프') || topic.toLowerCase().includes('golf');
  const golfCaddyRule = isGolfTopic ? `\n11. **캐디(WomanD) 상시 노출 (골프 씬 필수)**: 배경이 골프장인 경우, 캐디(WomanD)는 대본에 직접적인 대사가 없더라도 **거의 모든 장면에 배경 인물로 자연스럽게 포함**되어야 합니다. 주인공의 시선이 닿지 않는 곳에서 카트를 정리하거나 지켜보는 모습으로 배치하세요.` : '';

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 **대한민국 최고의 유튜브 쇼츠 바이럴 마스터이자 전문 작가**입니다. 
단 1초 만에 시청자의 시선을 강탈하고, 60초 내내 심장을 쫄깃하게 만들어 "이건 무조건 공유해야 돼!"라는 감탄이 터져 나오는 대박 쇼츠 대본을 집필하세요.

시청자가 영상을 보자마자 "헐, 이거 내 얘기 아냐?" 혹은 "대박, 진짜 이래?"라며 몰입할 수밖에 없는 하이퍼 리얼리티와 극강의 재미를 추구합니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 주제: "${topic}"
📌 장르: ${genreGuide?.name || '일반'}
📌 타겟: 대한민국 모든 **중년** 시청자 (40~60대)
📌 화자: ${narratorSlot} (${narratorName})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🚀 대박 나는 쇼츠의 공식
1. **초강력 훅(Hook)**: 첫 1~3초 안에 모든 것이 결정됩니다. 호기심을 폭발시키거나 공감을 저격하는 대사로 시작하세요.
2. **리듬감 있는 전개**: 짧은 문장 위주로, 마치 숏폼 영상을 보듯 빠른 템포의 수다체로 작성하세요.
3. **확실한 도파민/공감**: 중년들의 현실 고증, 황당한 반전, 혹은 가슴 뻥 뚫리는 사이다 결말을 제공하세요.
4. **시각적 묘사**: AI 이미지 생성을 위해 각 장면의 상황과 인물의 표정, 행동을 아주 생생하게 묘사하세요.

## 🎯 이 장르의 핵심
**${genreGuide?.description || ''}**

## 📈 감정 곡선
${genreGuide?.emotionCurve || ''}

## 🎲 창작 힌트
- 장소 힌트: ${seed.location}
- 소품 힌트: ${seed.object}  
- 신체반응 참고: ${seed.reaction}
- 오해 방향: ${seed.misunderstanding}
- 반전 유형: ${seed.twistType}
- 구체 반전(황당) 힌트: ${seed.truth} (예시, 복사 금지)

## 🎭 스토리 구조
${genreGuide?.structure || ''}

## 💬 킬러 대사
${genreGuide?.killerPhrases.map(p => `"${p}"`).join(', ') || ''}

## ⭐ 조연 대사 패턴
${genreGuide?.supportingCharacterPhrasePatterns?.map(p => `• ${p}`).join('\n') || '조연이 반전을 드러내는 대사를 자연스럽게 활용!'}

## 🫀 신체 반응 표현
${genreGuide?.bodyReactions.map(p => `"${p}"`).join(', ') || ''}

## ✅ 좋은 반전 예시
${genreGuide?.goodTwistExamples?.map(p => `• ${p}`).join('\n') || ''}

## ⭐ 조연 활용 반전 패턴
${genreGuide?.supportingCharacterTwistPatterns?.map(p => `• ${p}`).join('\n') || '조연이 반전의 핵심 역할을 하면 스토리가 더 재밌어짐!'}

## ❌ 절대 금지
${genreGuide?.forbiddenPatterns.map(p => `• ${p}`).join('\n') || ''}

## 🚨🚨🚨 예시 복사 절대 금지 🚨🚨🚨
**이 프롬프트에 나오는 모든 예시는 "형식/패턴 설명용"일 뿐입니다!**
❌ 예시 문장을 그대로 복사하면 즉시 실패!
✅ 예시는 패턴만 참고하고, 주제(topic)에 맞는 완전히 새로운 스토리를 창작!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ✅ 핵심 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 화자는 1인칭. **본인 이름 3인칭 금지**.
2. 인물 첫 등장 시 관계가 **자연스럽게 드러나게**.
3. 반전이 있으면 SETUP(2~3문장)에 **힌트 1개**.
4. 감정 직접 서술 금지. **행동/신체반응으로 표현**.
5. 제목은 구체적 상황으로 ("충격/반전" 같은 추상어 금지).
6. **항상 새로운 소재/상황/소품 조합**으로 창작 (기존 예시·전개 복제 금지).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📝 대본 형식 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 분량: 10~12문장
2. 문체: ~했어, ~했지, ~더라고, ~잖아 (친구한테 수다)
3. 대사: 작은따옴표 사용 ('이렇게 말했어')
${additionalContext ? `4. 추가 요청: ${additionalContext}` : ''}

## 👗 의상 설정 (이미지 프롬프트용)
- **Woman A (지영)**: ${womanAOutfit}
- **Woman B (혜경)**: ${womanBOutfit}
- **Woman D (캐디)**: ${womanDOutfit}
- **Man A (준호)**: ${manAOutfit}
- **Man B (민수)**: ${manBOutfit}

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
  6. **텍스트 금지**: 이미지 내에 어떠한 글자, 로고, 워터마크도 포함되지 않도록 "no text, no letters, no typography"를 강조할 것.
7. **투샷/쓰리샷에서는 각 인물마다 identity+hair+body+wearing+outfit 전체를 개별로 명시**
8. **배경은 1번 씬의 문구를 그대로 복붙** (장소 전환이 scriptLine에 명시된 경우만 변경 허용)
9. **의상 명칭 보존 (중요)**: \`shortPrompt\`와 \`longPrompt\` 모두에서 캐릭터에게 지정된 의상 명칭(예: "Pink & White Striped Knit + White Micro Short Pants")을 절대 요약하거나 일부를 생략하지 말고 **명칭 전체를 100% 동일하게 입력**할 것.
10. **[대괄호 템플릿] 형태 그대로 출력 금지** (실제 문장으로 채우기)
${imagePromptRulesExtra ? `\n${imagePromptRulesExtra}\n` : ''}

## 📸 샷 타입 규칙
| 상황 | 샷 타입 |
|-----|--------|
| 1명 행동/감정 | 원샷 |
| 2명 상호작용 | 투샷 |
| 3명 함께 | 쓰리샷 |

### 🚨 투샷/쓰리샷 longPrompt 작성 필수 규칙 (매우 중요!)
**여러 캐릭터가 등장할 때는 반드시 [Person 1], [Person 2], [Person 3]로 구분해야 합니다!**

✅ **원샷 예시** (1명):
\`\`\`
unfiltered raw photograph..., A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress, smiling at camera, snowy golf course, ...
\`\`\`

✅ **투샷 예시** (2명) - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress] [Person 2: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit] walking together, snowy golf course, ...
\`\`\`

✅ **쓰리샷 예시** (3명) - [Person 1], [Person 2], [Person 3] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress] [Person 2: A stunning Korean woman in her 40s, short chic bob cut, slim hourglass figure..., wearing Teal Dress] [Person 3: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit] standing together laughing, snowy golf course, ...
\`\`\`

✅ **남성 2명 투샷 예시** - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Navy Polo] [Person 2: A handsome Korean man in his 40s, clean short cut hair, well-built physique..., wearing White Polo] walking together on a golf course...
\`\`\`

❌ **금지 (캐릭터 혼동 발생)**:
\`\`\`
A stunning Korean woman..., A stunning Korean woman..., A handsome Korean man..., walking together
\`\`\`
→ 구분자 없이 쉼표로만 연결하면 AI가 캐릭터를 혼동합니다!
## 📷 카메라 앵글 필수 규칙 (미디움샷만 쓰면 안됨!)
| 씬 | 권장 앵글 | 프롬프트 키워드 |
|---|----------|---------------|
| Scene 1 (Hook) | **클로즈업** | close-up portrait shot, face in focus |
| Scene 2 (Setup) | **와이드샷** | wide establishing shot, full body visible |
| Scene 3 | **미디엄샷** | medium shot, waist-up framing |
| Scene 4 | **오버숄더** | over-the-shoulder shot |
| Scene 5 (Climax) | **클로즈업** | close-up shot, dramatic expression |
| Scene 6 | **POV** | first-person POV shot |
| Scene 7 (Twist) | **와이드샷** | wide shot, revealing context |
| Scene 8 (Outro) | **미디엄샷** | medium shot, natural pose |

⚠️ **필수**: longPrompt 맨 앞에 카메라 앵글 키워드를 반드시 넣을 것!
⚠️ **금지**: 같은 앵글 2연속 사용, 미디움샷만 8개 사용

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
❌ "A stunning Korean woman in her 40s (지영), POV shot, A stunning Korean woman in her early 20s (캐디)..."
→ 지영이 POV 시점 주인공이므로 프롬프트에서 완전히 제외해야 함!
→ 이렇게 하면 반반 이미지 생성됨!
\`\`\`

**투샷/쓰리샷과의 차이:**
- 투샷/쓰리샷: 여러 캐릭터가 화면에 함께 보임 → 모두 프롬프트에 포함
- POV 샷: 한 캐릭터의 시점 → 화면에 보이는 캐릭터만 포함

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**중요: scriptBody와 scenes의 1:1 매칭 규칙**
- scriptBody: 8~12개 문장 (스토리 복잡도에 따라 유연하게 조절)
- scenes: scriptBody 문장 수와 **정확히 동일**하게 생성 (8~12개)
- 예: scriptBody 10문장 → scenes 10개 (1:1 매칭)
- 각 scene의 scriptLine은 scriptBody의 해당 문장과 일치해야 함

{
  "title": "제목",
  "titleOptions": ["옵션1", "옵션2", "옵션3"],
  "scriptBody": "문장1\\n문장2... (8~12개 문장, scenes 개수와 동일)",
  "punchline": "펀치라인",
  "hook": "HOOK",
  "twist": "TWIST",
  "foreshadowing": "복선",
  "narrator": { "slot": "${gender === 'female' ? 'WomanA' : 'ManA'}", "name": "${narratorName}" },
  "emotionFlow": "${genreGuide?.emotionCurve || ''}",
  "lockedOutfits": {
    "womanA": "${womanAOutfit}",
    "womanB": "${womanBOutfit}",
    "womanD": "${womanDOutfit}",
    "manA": "${manAOutfit}",
    "manB": "${manBOutfit}"
  },
  "characters": [
    { "id": "WomanA", "name": "지영", "identity": "A stunning Korean woman in her ${targetAge}", "hair": "long soft-wave hairstyle", "body": "${promptConstants.FEMALE_BODY_A}", "outfit": "${womanAOutfit}", "outfitPrefix": "wearing" },
    { "id": "WomanB", "name": "혜경", "identity": "A stunning Korean woman in her ${targetAge}", "hair": "short chic bob cut", "body": "${promptConstants.FEMALE_BODY_B}", "outfit": "${womanBOutfit}", "outfitPrefix": "wearing" },
    { "id": "ManA", "name": "준호", "identity": "A handsome Korean man in his ${targetAge}", "hair": "short neat hairstyle", "body": "${promptConstants.MALE_BODY}", "outfit": "${manAOutfit}", "outfitPrefix": "wearing" },
    { "id": "ManB", "name": "민수", "identity": "A handsome Korean man in his ${targetAge}", "hair": "clean short cut", "body": "${promptConstants.MALE_BODY}", "outfit": "${manBOutfit}", "outfitPrefix": "wearing" },
    { "id": "WomanD", "name": "캐디", "identity": "A stunning Korean woman in her early 20s", "hair": "high-bun hairstyle", "body": "${promptConstants.FEMALE_BODY_D}", "outfit": "${womanDOutfit}", "outfitPrefix": "wearing" }
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

      "shortPrompt": "간단한 영문 프롬프트",
      "shortPromptKo": "간단한 한글 프롬프트",
      "longPrompt": "${promptConstants.START}, [⚠️ 카메라앵글: close-up portrait shot 등], [characters[해당캐릭터].identity], [hair], [body], wearing [outfit], [행동/표정], [배경], ${promptConstants.END}",
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
11. ✅ 모든 longPrompt가 카메라 앵글로 시작? (close-up/wide/medium/over-shoulder/POV)
12. ✅ 모든 씬에서 같은 앵글 2연속 없음? (미디움샷만 계속 ❌)
13. ✅ 클로즈업, 와이드샷, 오버숄더/POV 각각 최소 1개 이상?
14. ✅ identity/hair/body/outfit 문구가 모든 씬에서 완전 동일?
15. ✅ 배경 문구가 장면 전환 없을 때 동일?
16. ✅ 투샷/쓰리샷에서 각 캐릭터 identity+hair+body+wearing+outfit 개별 명시?
17. ✅ POV 샷에서 화면에 보이는 캐릭터만 포함? (시점 주인공 제외!)
18. ✅ POV 대상이 "looking at camera (POV target)" 사용? ("looking away" 금지)

**음성:**
19. ✅ 모든 씬에 voiceType 지정?
20. ✅ 작은따옴표 대사 있으면 lipSync 생성?
`;
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
export interface CharacterInfo { identity: string; hair: string; body: string; outfit: string; }

export const validateAndFixPrompt = (longPrompt: string, shotType: '원샷' | '투샷' | '쓰리샷', characters: CharacterInfo[]): PromptValidationResult => {
  const issues: string[] = [];
  let fixedPrompt = longPrompt;
  const promptConstants = getPromptConstants();

  // 1. 필수 시작 문구 확인
  if (!longPrompt.includes('unfiltered raw photograph')) {
  } else {
    // One-shot synchronization and de-duplication
    const character = characters[0];
    if (character) {
      const traitPrefix = promptConstants.START;
      const traits = [character.identity, character.hair, character.body].filter(Boolean);
      
      // Remove existing traits to avoid duplicates
      traits.forEach(trait => {
          const regex = new RegExp(`,?\\s*${trait.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
          fixedPrompt = fixedPrompt.replace(regex, '');
      });
      
      // Re-insert standard traits at the beginning after prefix
      const goldenTraits = traits.join(', ');
      if (fixedPrompt.includes(traitPrefix)) {
          fixedPrompt = fixedPrompt.replace(traitPrefix, `${traitPrefix}, ${goldenTraits}`);
      } else {
          fixedPrompt = `${traitPrefix}, ${goldenTraits}, ${fixedPrompt}`;
      }

      // Outfit sync
      if (character.outfit) {
          const outfitClean = character.outfit.replace(/^wearing\s+/i, '');
          const wearingRegex = /wearing\s+[^,]+/i;
          if (wearingRegex.test(fixedPrompt)) {
              fixedPrompt = fixedPrompt.replace(wearingRegex, `wearing ${outfitClean}`);
          } else {
              const qualityIdx = fixedPrompt.indexOf(', photorealistic');
              if (qualityIdx !== -1) {
                  fixedPrompt = fixedPrompt.slice(0, qualityIdx) + `, wearing ${outfitClean}` + fixedPrompt.slice(qualityIdx);
              } else {
                  fixedPrompt += `, wearing ${outfitClean}`;
              }
          }
      }
    }
  }

  // Final cleanup
  fixedPrompt = fixedPrompt.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  const womanPattern = /A stunning Korean woman,\s*A stunning Korean woman/gi;
  fixedPrompt = fixedPrompt.replace(womanPattern, 'A stunning Korean woman');

  return { isValid: issues.length === 0, issues, fixedPrompt };
};

// ... (Restoring lost outfit functions)
export const pickRandomOutfit = (gender: 'female' | 'male', category: string): string => {
  if (gender === 'male') return pickMaleOutfit('', []);
  return pickFemaleOutfit('comedy-humor', '', []);
};

export const convertAgeToEnglish = (koreanAge: string): string => {
  const match = koreanAge.match(/(\d+)/);
  return match ? `${match[1]}s` : '40s';
};

export default {
  buildLabScriptPrompt,
  buildLabImagePrompt,
  pickRandomOutfit,
  pickFemaleOutfit,
  pickMaleOutfit,
  generateRandomSeed,
  convertAgeToEnglish,
  LAB_GENRE_GUIDELINES,
  MAMA_CHARACTER_PRESETS,
  PROMPT_CONSTANTS,
  RANDOM_SEED_POOLS
};

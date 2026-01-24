import { ModeTemplates } from '../types';
import { getGenreGuideline } from './genreGuidelines';
import { FEMALE_OUTFIT_PRESETS, MALE_OUTFIT_PRESETS, UNIFIED_OUTFIT_LIST } from '../constants';
import { buildOutfitPool } from './outfitService';
import type { OutfitPoolItem } from './outfitService';
import { normalizeTopicText } from '../utils/topicGuard';

// Helper to pick random item
const pickRandom = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

// Helper to fill template variables
const fillTemplate = (template: string, variables: Record<string, string>) => {
  if (!template) return '';
  return template.replace(/{{(\w+)}}/g, (_, key) => variables[key] || `{{${key}}}`);
};

export interface PromptBuilderOptions {
  generationMode: 'none' | 'script-only' | 'script-image';
  modeTemplates: ModeTemplates;
  genre: string;
  topic: string;
  target: string;
  scriptCount: number;
  outfits: {
    lockedFemaleOutfit?: string;
    lockedFemaleOutfit2?: string;
    lockedFemaleOutfit3?: string;
    lockedMaleOutfit?: string;
    lockedMaleOutfit2?: string;
  };
  backgroundContext?: string;
}

const WINTER_KEYWORDS = [
  '눈',
  '겨울',
  'snow',
  'winter',
  '스키',
  'ski',
  '썰매',
  'sled',
  'ice',
  '빙판',
  '얼음',
  'snowy'
];

const isWinterContext = (context: string): boolean =>
  WINTER_KEYWORDS.some((keyword) => context.toLowerCase().includes(keyword.toLowerCase()));

const splitOutfitTop = (outfit: string) => {
  const separators = [' + ', ' with ', ' and '];
  for (const separator of separators) {
    const index = outfit.toLowerCase().indexOf(separator);
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

const applyWinterGlamTop = (top: string): string => {
  const lower = top.toLowerCase();
  if (lower.includes('long-sleeve') || lower.includes('long sleeve')) return top;
  if (/(tube top|strapless|bandeau)/i.test(top)) {
    return 'Premium cold-shoulder cashmere knit top';
  }
  if (/(halter|off-shoulder|sleeveless|spaghetti|camisole|bustier|bralette|crop|cropped)/i.test(top)) {
    return 'Tight-fitting mock-neck silk knit top with keyhole detail';
  }
  if (/(dress|one-piece)/i.test(top)) {
    return 'Long-sleeve velvet dress';
  }
  if (/(blouse|shirt|top|tee|knit|polo)/i.test(top)) {
    return `Long-sleeve ${top}`;
  }
  return `Long-sleeve ${top}`;
};

const applyWinterGlamOutfit = (outfit: string): string => {
  if (!outfit) return outfit;
  const { top, tail, joiner } = splitOutfitTop(outfit);
  const glamTop = applyWinterGlamTop(top.trim());
  let result = tail ? `${glamTop}${joiner}${tail.trim()}` : glamTop;
  if (!/tight/i.test(result)) {
    result = `Tight-fitting ${result}`;
  }
  return result;
};

export const buildFinalPrompt = (options: PromptBuilderOptions): string => {
  const {
    generationMode,
    modeTemplates,
    genre,
    topic,
    target,
    scriptCount,
    outfits,
    backgroundContext
  } = options;
  const normalizedContext = normalizeTopicText(
    [topic, backgroundContext, genre].filter(Boolean).join(' ')
  );

  // 1. [Common] Unified Mandatory Rules (Master Regulations)
  const mandatoryRules = `
🚨🚨🚨 [IMAGE & SCRIPT MASTER REGULATIONS - CRITICAL OVERRIDE] 🚨🚨🚨
아래 규칙은 이전의 그 어떤 지침보다 우선하며, 이를 어길 시 대본의 품질이 저하됩니다. 반드시 준수하세요.

[1. 🚀 바이럴 쇼츠 성공 공식 (최우선 순위)]

**RULE 1. IMMEDIATE IMPACT (강한 훅 강제)**
- 첫 문장은 반드시 **사건/충격/갈등/금기**를 바로 던지는 문장이어야 합니다.
- 날씨/배경 설명으로 시작하면 무조건 실패입니다. ("눈이 와서", "어느 날", "그날 골프장에서" 금지)
- 첫 문장에 **동사/행동/대사/직설적 상황**이 포함되어야 합니다.
- ✅ "캐디가 내 손목을 잡는 순간, 나도 모르게 숨이 멎었어."
- ✅ "문 열자마자 들린 한마디에 다리 힘이 풀렸다."
- ❌ "눈이 펑펑 오길래 그늘집으로 피신했지."

**RULE 2. DIALOGUE RATIO 70% (대사 중심 전개)**
- 나레이션으로 설명하지 말고, 캐릭터 간의 대화로 상황을 보여주세요.
- 전체 문장의 70% 이상이 대사여야 합니다.

**RULE 3. TRIPLE TWIST (3단 반전/이중 의미)**
- 야한 상황처럼 오해 유도 -> 오해 강화 -> 황당하고 건전한 반전으로 마무리.
- 시청자가 "아 뭐야 ㅋㅋㅋ" 하게 만드세요.

**RULE 4. ACTION OVER EMOTION**
- "슬펐다", "기뻤다" 같은 감정 서술은 절대 금지입니다.
- "손이 떨렸다", "침을 삼켰다" 등 행동과 신체 반응으로 묘사하세요.

**RULE 5. FLEXIBLE LENGTH**
- 문장 수에 집착하지 말고 8~15문장 사이에서 최고의 몰입감을 만드세요.

[2. CHARACTER SLOT SYSTEM - 외형 및 성격 고정]
- **WomanA (지영, Main)**: Stunning Korean woman in her {{TARGET_LABEL}}, extraordinarily high-projection perky bust with high-seated chest line, voluptuous hourglass figure, perfectly managed sophisticated look, long soft-wave hairstyle.
- **WomanB (혜경, Sub)**: Stunning Korean woman, petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, short chic bob cut, sensual and alluring aura.
- **WomanC (미숙, Observer)**: Stunning Korean woman, gracefully toned and slim athletic body, expertly managed sleek silhouette with perky high-seated bust, low ponytail, calm yet provocative demeanor.
- **WomanD (Caddy)**: Stunning young Korean woman (early 20s), high-bun hairstyle (updo), extraordinarily high-projection perky bust with high-seated chest line, voluptuous hourglass figure, youthful radiant beauty.
- **ManA (준호, Lead)**: Dandy Korean man, short neat hairstyle, fit athletic build.
- **ManB (민수, Sub)**: Dandy Korean man, clean short cut, well-built physique.

[3. IMAGE PROMPT RULES - 국적 및 품질 고정]
- **MANDATORY START**: 모든 이미지 프롬프트는 반드시 **"unfiltered raw photograph, 8k ultra photorealism, ultra detailed skin texture with visible pores, professional cinematic lighting, RAW photo, A stunning Korean woman in her {{TARGET_LABEL}}, [Slot ID], ..."**로 시작해야 합니다.
- **KOREAN IDENTITY**: 반드시 **"Korean identity"**를 명시하여 이질적인 외형을 방지하세요.
- **NO SUMMARIZATION (CRITICAL)**: 카메라 앵글에 상관없이, **반드시 해당 캐릭터의 헤어 스타일, 상세한 체형 묘사(voluptuous hourglass/perky bust), 의상 풀 네임을 생략 없이 모든 장면에 똑같이 반복하세요.**
- **FIXED PHRASES (GLOBAL QUALITY FOOTER)**: 모든 프롬프트 끝에 다음을 반드시 포함하여 실사감을 극대화하세요:
  "high-fashion editorial refined, depth of field, shot on 85mm lens, f/1.8, realistic soft skin, 8k ultra-hd, no text, no captions, no typography, --ar 9:16"
- **NO DEVIATION**: 애니메이션, 3D 렌더링, 마네킹 느낌을 엄격히 금지합니다. 실제 사람의 살결과 무게감이 느껴지도록 묘사하세요.
`;

  // 2. [Common] Output Format Instruction - 확장된 구조
  const outputFormatInstruction = `
==========================================================
■ 출력 형식 (JSON) - 확장된 구조
==========================================================
**⚠️ 다른 설명 없이 오직 다음 JSON 객체 하나만 출력하세요. 마크다운 태그( \`\`\`json )도 포함하지 마세요.**

{
  "title": "임팩트 있는 제목 (25자 이내)",
  "titleOptions": ["제목옵션1", "제목옵션2", "제목옵션3"],
  "scriptBody": "대본 내용 (\\n으로 구분)",
  "punchline": "핵심 대사 (반전 포인트)",
  "characters": [
    { "id": "WomanA", "outfit": "고정 의상 설명", "accessories": "악세서리" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "summary": "장면 요약 (한글)",
      "scriptLine": "해당 장면의 대본 한 줄 (나레이션 또는 대사)",
      "action": "주요 동작 키워드 (예: 고개를 돌림, 눈을 크게 뜸)",
      "emotion": "감정 변화 (예: 평온 → 놀람)",
      "shortPrompt": "unfiltered raw photo, A stunning Korean woman in her {{TARGET_LABEL}}, slim hourglass figure, full bust slim waist, long soft-wave hair, elegant V-neck dress, [동작/표정], 8k --ar 9:16",
      "shortPromptKo": "40대 한국 여성 김여사, 날씬하지만 풍만한 몸매, 깊이 파인 드레스, [동작/표정]",
      "longPrompt": "unfiltered raw photograph, highly detailed skin texture with visible pores, natural skin sheen, A stunning Korean woman in her {{TARGET_LABEL}}, long soft-wave hairstyle, slim hourglass figure with toned body, full bust with slim waist, elegant feminine curves, wearing Premium Silk Deep V-neck Blouse, [동작: scriptLine에 맞는 동작], [표정: emotion에 맞는 표정], luxury watch, snowy golf course, shot on 85mm lens, f/1.8, realistic soft skin, high-fashion glamour photography, 8k ultra-hd, --ar 9:16",
      "longPromptKo": "40대 한국 여성 김여사, 생생한 피부 질감, 날씬한 모래시계 체형, 우아한 곡선미, 프리미엄 실크 브이넥 블라우스, [동작/표정], 8K 초고화질 실사 사진",
      "videoPrompt": "A Korean woman [scriptLine의 동작을 영어로 묘사]. Her expression shifts from [emotion 시작] to [emotion 끝]. Camera: [적절한 카메라 워크]."
    }
  ]
}

**🚨 중요 규칙:**
1. 반드시 정확히 8개의 scenes를 생성하세요. 8개 미만 절대 금지.
2. 각 scene의 scriptLine은 scriptBody의 해당 부분과 일치해야 합니다.
3. action과 emotion 필드는 해당 장면의 동작과 감정을 명확히 기재하세요.
4. videoPrompt는 scriptLine의 동작을 정확히 반영한 8초 영상 묘사입니다.
5. titleOptions는 서로 다른 스타일의 제목 3개를 제공하세요.
`;

  // 3. Resolve Outfits
  const {
    lockedFemaleOutfit,
    lockedFemaleOutfit2,
    lockedFemaleOutfit3,
    lockedMaleOutfit,
    lockedMaleOutfit2
  } = outfits;
  const isGolfContext = normalizedContext.includes('골프') || normalizedContext.includes('golf');
  const outfitPool = buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]);
  const isMaleOutfit = (item: OutfitPoolItem) => item.categories.includes('MALE');
  const isUnisexOutfit = (item: OutfitPoolItem) => item.categories.includes('UNISEX');
  const isGolfOutfit = (item: OutfitPoolItem) =>
    item.categories.some(category => category.toUpperCase().includes('GOLF'));

  const maleCandidates = outfitPool.filter(item => isMaleOutfit(item) || isUnisexOutfit(item));
  const maleGolfCandidates = maleCandidates.filter(item => isGolfOutfit(item));
  const maleOutfitPool = (isGolfContext && maleGolfCandidates.length > 0)
    ? maleGolfCandidates
    : maleCandidates;
  const maleOutfitNames = (maleOutfitPool.length > 0)
    ? maleOutfitPool.map(item => item.name)
    : MALE_OUTFIT_PRESETS;
  const fallbackMaleOutfit = lockedMaleOutfit || pickRandom(maleOutfitNames);
  const secondaryMaleOutfit = lockedMaleOutfit2
    || lockedMaleOutfit
    || pickRandom(maleOutfitNames.filter(item => item !== fallbackMaleOutfit))
    || fallbackMaleOutfit;
  const femaleCandidates = outfitPool.filter(item => !isMaleOutfit(item));
  const femaleOutfitNames = Array.from(new Set([
    ...FEMALE_OUTFIT_PRESETS,
    ...femaleCandidates.map(item => item.name)
  ]));

  const winterContextEnabled = isWinterContext(normalizedContext);
  const selectedMainOutfit = lockedFemaleOutfit || pickRandom(femaleOutfitNames);
  const selectedSubOutfit = lockedFemaleOutfit2 || pickRandom(femaleOutfitNames.filter(o => o !== selectedMainOutfit));
  const mainOutfit = winterContextEnabled
    ? applyWinterGlamOutfit(selectedMainOutfit)
    : selectedMainOutfit;
  const subOutfit = winterContextEnabled
    ? applyWinterGlamOutfit(selectedSubOutfit)
    : selectedSubOutfit;
  const selectedCaddyOutfit = lockedFemaleOutfit3
    || pickRandom(femaleOutfitNames.filter(o => o !== selectedMainOutfit && o !== selectedSubOutfit));
  const caddyOutfit = winterContextEnabled
    ? applyWinterGlamOutfit(selectedCaddyOutfit)
    : selectedCaddyOutfit;

  const outfitGuidance = `
[SELECTED OUTFITS - MUST USE THESE EXACTLY FOR EVERY SCENE]
- WomanA (Main): ${mainOutfit}
- WomanB (Sub): ${subOutfit}
- WomanD (Caddy): ${caddyOutfit}
- ManA (Lead): ${fallbackMaleOutfit}
- ManB (Sub): ${secondaryMaleOutfit}
`;

  // 4. Prepare Variables
  const variables: Record<string, string> = {
    GENRE: genre || '일상',
    TOPIC: topic || '(소재 입력 필요)',
    TARGET_LABEL: target || '40대',
    SCRIPT_COUNT: String(scriptCount),
    LOCKED_FEMALE_OUTFIT: mainOutfit,
    LOCKED_FEMALE_OUTFIT2: subOutfit,
    LOCKED_FEMALE_OUTFIT3: caddyOutfit,
    LOCKED_MALE_OUTFIT: fallbackMaleOutfit,
    LOCKED_MALE_OUTFIT2: secondaryMaleOutfit,
    LOCKED_BACKGROUND: backgroundContext || topic || genre || '일상적인 공간',
    CREATIVITY_BOOSTER: `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
  };

  // 5. Get Genre Guideline
  const effectiveGenre = genre && genre !== 'none' ? genre : 'none';
  const genreGuideline = getGenreGuideline(effectiveGenre);
  const genrePrompt = genreGuideline && genreGuideline.prompt
    ? fillTemplate(`[장르: ${genreGuideline.name}]\n${genreGuideline.prompt}`, variables)
    : '';

  // 6. Select Mode Template (if not 'none')
  let modeTemplatePrompt = '';
  if (generationMode !== 'none') {
    const baseTemplate = generationMode === 'script-only' ? modeTemplates.scriptOnly : modeTemplates.scriptImage;
    modeTemplatePrompt = `[생성 모드 템플릿]\n${fillTemplate(baseTemplate, variables)}`;
  }

  // 7. Combine All Parts - 장르 지침을 1순위로!
  const parts = [
    genrePrompt,                                    // 1순위: 장르별 가이드 (가장 중요!)
    modeTemplatePrompt,                             // 2순위: 생성 모드 템플릿 (구조 및 형식 가이드)
    fillTemplate(mandatoryRules, variables),        // 3순위: 마스터 규칙
    outfitGuidance,                                 // 4순위: 의상
    outputFormatInstruction                         // 5순위: 출력 형식
  ].filter(Boolean);

  const uniqueFooter = `\n\n[Request ID: ${variables.CREATIVITY_BOOSTER}]\n[Timestamp: ${new Date().toISOString()}]`;
  return parts.join('\n\n' + '='.repeat(80) + '\n\n') + uniqueFooter;
};

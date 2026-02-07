/**
 * shortsLabCharacterRulesDefaults.ts
 * 캐릭터 의상 규칙 기본값 정의
 *
 * v2.0 업데이트:
 * - ageLabel 제거 (대본 생성 시 타겟 연령이 자동 적용)
 * - 동적 캐릭터 배열 지원 (추가/삭제 가능)
 * - Female D는 20대 고정
 */

export interface CharacterSlotRule {
  id: string;            // "WomanA", "ManB" 등
  name?: string;         // "지영", "준호" 등 (한글 이름)
  identity: string;      // "A stunning Korean woman"
  hair: string;          // "long soft-wave hairstyle"
  body: string;          // "slim hourglass figure..."
  style: string;         // "perfectly managed sophisticated look"
  outfitFit: string;     // "tight-fitting, form-hugging..."
  isFixedAge?: boolean;  // true면 fixedAge 사용 (Female D 전용)
  fixedAge?: string;     // "in her early 20s" (Female D 전용)
}

export interface ShortsLabCharacterRules {
  // 동적 배열로 변경
  females: CharacterSlotRule[];
  males: CharacterSlotRule[];

  // 공통 설정
  common: {
    negativePrompt: string;
    qualityTags: string;
  };
}

export const DEFAULT_CHARACTER_RULES: ShortsLabCharacterRules = {
  // 여성 캐릭터 (동적 배열)
  females: [
    {
      id: 'WomanA',
      name: '지영',
      identity: 'A stunning Korean woman in her 40s',
      hair: 'long soft-wave hairstyle',
      body: 'perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
      style: 'perfectly managed sophisticated look, confident presence',
      outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
    },
    {
      id: 'WomanB',
      name: '혜경',
      identity: 'A stunning Korean woman in her 40s',
      hair: 'short chic bob cut',
      body: 'Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, high-seated chest line',
      style: 'charming presence, expressive and lively reactions',
      outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
    },
    {
      id: 'WomanC',
      name: '미숙',
      identity: 'A stunning Korean woman in her 40s',
      hair: 'elegant high ponytail',
      body: 'Gracefully toned and slim athletic body, expertly managed sleek silhouette, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
      style: 'composed and calm observer demeanor, elegant presence',
      outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
    },
    {
      id: 'WomanD',
      name: '캐디',
      identity: 'A stunning Korean woman in her early 20s',
      hair: 'high-bun hairstyle',
      body: 'bright cheerful professional presence, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
      style: 'bright cheerful professional presence, sophisticated and beautiful caddy look',
      outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally',
      isFixedAge: true,
      fixedAge: 'in her early 20s'
    }
  ],

  // 남성 캐릭터 (동적 배열)
  males: [
    {
      id: 'ManA',
      name: '준호',
      identity: 'A handsome Korean man in his 40s',
      hair: 'short neat hairstyle',
      body: 'fit athletic build with broad shoulders',
      style: 'dandy and refined presence, well-groomed and polished appearance',
      outfitFit: 'tailored slim-fit, clean and sharp lines'
    },
    {
      id: 'ManB',
      name: '민수',
      identity: 'A handsome Korean man in his 40s',
      hair: 'clean short cut hair',
      body: 'fit athletic build with broad shoulders',
      style: 'casual and approachable demeanor, friendly presence',
      outfitFit: 'tailored slim-fit, clean and sharp lines'
    },
    {
      id: 'ManC',
      name: '남성 조연',
      identity: 'A handsome Korean man in his 40s',
      hair: 'stylish side-part hair',
      body: 'well-built physique with strong shoulders',
      style: 'professional and confident presence, business casual elegance',
      outfitFit: 'tailored slim-fit, clean and sharp lines'
    }
  ],

  // 공통 설정
  common: {
    negativePrompt: 'NOT cartoon, NOT anime, NOT illustration, NOT painting, NOT drawing, NOT CG, NOT 3D render, deformed, ugly, low quality, blurry, watermark, text, logo',
    qualityTags: 'photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field, volumetric lighting, rim light, detailed skin texture, high fashion photography'
  }
};

/**
 * ID 생성 헬퍼
 */
export const generateCharacterId = (gender: 'female' | 'male', index: number): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const prefix = gender === 'female' ? 'Woman' : 'Man';
  return `${prefix}${letters[index] || index}`;
};

/**
 * 슬롯 ID 변환 (WomanA → femaleA)
 */
export const slotIdToRuleKey = (slotId: string): string => {
  return slotId
    .replace(/^Woman/, 'female')
    .replace(/^Man/, 'male')
    .replace(/^(female|male)([A-Z])/, (_, g, letter) => g + letter.toLowerCase());
};

/**
 * 규칙 키 변환 (femaleA → WomanA)
 */
export const ruleKeyToSlotId = (ruleKey: string): string => {
  return ruleKey
    .replace(/^female/, 'Woman')
    .replace(/^male/, 'Man')
    .replace(/^(Woman|Man)([a-z])/, (_, prefix, letter) => prefix + letter.toUpperCase());
};

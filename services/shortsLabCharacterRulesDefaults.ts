/**
 * shortsLabCharacterRulesDefaults.ts
 * 캐릭터 의상 규칙 기본값 정의
 *
 * 모든 캐릭터의 identity, hair, body, style, outfitFit 등을 중앙에서 관리
 */

export interface CharacterSlotRule {
  identity: string;      // "A stunning Korean woman"
  hair: string;          // "long soft-wave hairstyle"
  body: string;          // "slim hourglass figure..."
  ageLabel: string;      // "in her 40s"
  style: string;         // "perfectly managed sophisticated look"
  outfitFit: string;     // "tight-fitting, form-hugging..."
}

export interface ShortsLabCharacterRules {
  // 여성 캐릭터 (4명)
  femaleA: CharacterSlotRule;
  femaleB: CharacterSlotRule;
  femaleC: CharacterSlotRule;
  femaleD: CharacterSlotRule;

  // 남성 캐릭터 (3명)
  maleA: CharacterSlotRule;
  maleB: CharacterSlotRule;
  maleC: CharacterSlotRule;

  // 공통 설정
  common: {
    negativePrompt: string;
    qualityTags: string;
    defaultFemaleAge: string;
    defaultMaleAge: string;
  };
}

export const DEFAULT_CHARACTER_RULES: ShortsLabCharacterRules = {
  // 여성 캐릭터
  femaleA: {
    identity: 'A stunning Korean woman',
    hair: 'long soft-wave hairstyle',
    body: 'perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    ageLabel: 'in her 40s',
    style: 'perfectly managed sophisticated look, confident presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  femaleB: {
    identity: 'A stunning Korean woman',
    hair: 'short chic bob cut',
    body: 'Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, high-seated chest line',
    ageLabel: 'in her 40s',
    style: 'charming presence, expressive and lively reactions',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  femaleC: {
    identity: 'A stunning Korean woman',
    hair: 'elegant high ponytail',
    body: 'Gracefully toned and slim athletic body, expertly managed sleek silhouette, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    ageLabel: 'in her 40s',
    style: 'composed and calm observer demeanor, elegant presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  femaleD: {
    identity: 'A stunning Korean woman',
    hair: 'high-bun hairstyle',
    body: 'bright cheerful professional presence, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    ageLabel: 'in her early 20s',
    style: 'bright cheerful professional presence, sophisticated and beautiful caddy look',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },

  // 남성 캐릭터
  maleA: {
    identity: 'A handsome Korean man',
    hair: 'short neat hairstyle',
    body: 'fit athletic build with broad shoulders',
    ageLabel: 'in his 40s',
    style: 'dandy and refined presence, well-groomed and polished appearance',
    outfitFit: 'tailored slim-fit, clean and sharp lines'
  },
  maleB: {
    identity: 'A handsome Korean man',
    hair: 'clean short cut hair',
    body: 'fit athletic build with broad shoulders',
    ageLabel: 'in his 40s',
    style: 'casual and approachable demeanor, friendly presence',
    outfitFit: 'tailored slim-fit, clean and sharp lines'
  },
  maleC: {
    identity: 'A handsome Korean man',
    hair: 'stylish side-part hair',
    body: 'well-built physique with strong shoulders',
    ageLabel: 'in his 40s',
    style: 'professional and confident presence, business casual elegance',
    outfitFit: 'tailored slim-fit, clean and sharp lines'
  },

  // 공통 설정
  common: {
    negativePrompt: 'NOT cartoon, NOT anime, NOT illustration, NOT painting, NOT drawing, NOT CG, NOT 3D render, deformed, ugly, low quality, blurry, watermark, text, logo',
    qualityTags: 'photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field, volumetric lighting, rim light, detailed skin texture, high fashion photography',
    defaultFemaleAge: 'in her 40s',
    defaultMaleAge: 'in his 40s'
  }
};

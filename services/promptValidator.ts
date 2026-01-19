import { Scene } from '../types';

interface ValidationContext {
  expectedSceneCount?: number;
  outfits?: {
    femaleOutfit?: string;
    femaleOutfit2?: string;
    femaleOutfit3?: string;
    maleOutfit?: string;
  };
  targetLabel?: string;
}

const REQUIRED_REALISM_TAGS = [
  'Raw photo style',
  'Highly detailed skin texture with visible pores',
  'Candid facial expression',
  'Subsurface scattering'
];

const REQUIRED_FIT_TAGS = [
  'tight-fitting premium tailored design',
  'bodycon silhouette accentuating feminine curves',
  'form-fitting elegant attire with body-conscious refinement'
];

const REQUIRED_QUALITY_TAGS = [
  'photorealistic',
  '8k resolution',
  'cinematic lighting',
  'masterpiece',
  'professional photography',
  'depth of field',
  'no text',
  'no letters',
  'no typography',
  'no watermarks',
  'no words',
  '--ar 9:16'
];

const ACCESSORY_REQUIREMENTS: Record<string, string> = {
  'Slot Woman A': 'luxury diamond watch',
  'Slot Woman B': 'simple silver necklace',
  'Slot Woman C': 'gold hoop earrings'
};

const hasScenePrefix = (prompt?: string, sceneNumber?: number) => {
  if (!prompt) return false;
  if (typeof sceneNumber !== 'number') return /^Scene\s+\d+\./i.test(prompt.trim());
  return prompt.trim().startsWith(`Scene ${sceneNumber}.`);
};

const requiresGroupShot = (characterIds?: string[]) => {
  if (!Array.isArray(characterIds)) return false;
  return characterIds.length >= 2;
};

const includesGroupShotTag = (prompt?: string, characterIds?: string[]) => {
  if (!prompt) return false;
  if (!requiresGroupShot(characterIds)) return true;
  const normalized = prompt.toLowerCase();
  return normalized.includes('two-shot') || normalized.includes('three-shot');
};

const includesAspectRatio = (prompt?: string) => {
  if (!prompt) return false;
  return /--ar\s+9:16/i.test(prompt);
};

const findMissingPhrases = (prompt: string | undefined, phrases: string[]) => {
  if (!prompt) return phrases;
  const normalized = prompt.toLowerCase();
  return phrases.filter((phrase) => !normalized.includes(phrase.toLowerCase()));
};

const includesOutfit = (prompt: string | undefined, outfit?: string) => {
  if (!prompt || !outfit) return true;
  return prompt.includes(outfit);
};

const hasKoreanIdentity = (prompt?: string) => {
  if (!prompt) return false;
  return /korean|한국인|한국\s*여성|한국\s*남성/i.test(prompt);
};

const requiresMalePresence = (scene: Scene & { characterIds?: string[] }) => {
  if (Array.isArray(scene.characterIds)) {
    return scene.characterIds.some((id) => id.toUpperCase().includes('MALE'));
  }
  if (!scene.longPrompt) return false;
  // Remove explicit "No male characters appear" before checking
  const normalized = scene.longPrompt
    .replace(/no male characters appear[^.]*\.?/gi, '')
    .toLowerCase();
  return /\bkorean\s+man\b|\bman\b|\bmale\b|\bhusband\b|\bboyfriend\b|남성|남자|남편|오빠/.test(normalized);
};

const requiresNoMaleTag = (scene: Scene & { characterIds?: string[] }) => {
  if (requiresMalePresence(scene)) return false;
  if (!scene.longPrompt) return false;
  return !/no male characters appear/i.test(scene.longPrompt);
};

const ensureAccessory = (
  prompt: string | undefined,
  slotLabel: string,
  keyword: string
) => {
  if (!prompt) return true;
  if (!prompt.includes(slotLabel)) return true;
  return prompt.toLowerCase().includes(keyword.toLowerCase());
};

const validateScene = (
  scene: Scene & { characterIds?: string[] },
  ctx: ValidationContext,
  scriptIndex: number
) => {
  const violations: string[] = [];
  if (!hasScenePrefix(scene.longPrompt, scene.sceneNumber)) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: longPrompt 앞에 "Scene ${scene.sceneNumber}." 형식을 포함하세요.`
    );
  }

  if (!includesGroupShotTag(scene.longPrompt, scene.characterIds)) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: 다중 등장 인물에 Two-shot/Three-shot 태그가 없습니다.`
    );
  }

  if (!includesAspectRatio(scene.longPrompt)) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: --ar 9:16 비율 태그가 누락되었습니다.`
    );
  }

  if (!hasKoreanIdentity(scene.longPrompt)) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: longPrompt에 한국인 표기가 없습니다. ("Korean woman/man" 또는 "한국인" 포함)`
    );
  }

  const missingRealismTags = findMissingPhrases(scene.longPrompt, REQUIRED_REALISM_TAGS);
  if (missingRealismTags.length > 0) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: 실사화 태그(${missingRealismTags.join(', ')})를 추가하세요.`
    );
  }


  // [MODIFIED] 핏 태그 3개 모두 필수로 변경 (일관성 보장)
  const missingFitTags = findMissingPhrases(scene.longPrompt, REQUIRED_FIT_TAGS);
  if (missingFitTags.length > 0) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: 핏 태그 3개 모두 필수입니다. 누락: ${missingFitTags.join(', ')}`
    );
  }

  const missingQualityTags = findMissingPhrases(scene.longPrompt, REQUIRED_QUALITY_TAGS);
  if (missingQualityTags.length > 0) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: 품질 태그(${missingQualityTags.join(', ')})를 추가하세요.`
    );
  }

  Object.entries(ACCESSORY_REQUIREMENTS).forEach(([slot, keyword]) => {
    if (!ensureAccessory(scene.longPrompt, slot, keyword)) {
      violations.push(
        `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: ${slot}에 "${keyword}" 액세서리를 명시하세요.`
      );
    }
  });

  if (requiresNoMaleTag(scene)) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: 남성이 등장하지 않는 씬에는 "No male characters appear in this scene." 문구를 추가하세요.`
    );
  }

  const outfits = ctx.outfits;
  if (Array.isArray(scene.characterIds)) {
    if ((scene.characterIds.includes('WomanA') || scene.characterIds.includes('A')) && !includesOutfit(scene.longPrompt, outfits?.femaleOutfit)) {
      violations.push(
        `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: Slot Woman A 의상 "${outfits?.femaleOutfit}"가 longPrompt에 없습니다.`
      );
    }
    if ((scene.characterIds.includes('WomanB') || scene.characterIds.includes('B')) && !includesOutfit(scene.longPrompt, outfits?.femaleOutfit2)) {
      violations.push(
        `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: Slot Woman B 의상 "${outfits?.femaleOutfit2}"가 longPrompt에 없습니다.`
      );
    }
    if ((scene.characterIds.includes('WomanC') || scene.characterIds.includes('C')) && !includesOutfit(scene.longPrompt, outfits?.femaleOutfit3)) {
      violations.push(
        `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: Slot Woman C 의상 "${outfits?.femaleOutfit3}"가 longPrompt에 없습니다.`
      );
    }
    const containsMale = scene.characterIds.some((id) => id.toUpperCase().includes('MAN') || id.toUpperCase().includes('MALE'));
    if (containsMale && !includesOutfit(scene.longPrompt, outfits?.maleOutfit)) {
      violations.push(
        `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: 남성 의상 "${outfits?.maleOutfit}"가 longPrompt에 없습니다.`
      );
    }
  }

  // characterIds 필수 체크
  if (!scene.characterIds || !Array.isArray(scene.characterIds) || scene.characterIds.length === 0) {
    violations.push(
      `스크립트 ${scriptIndex + 1} Scene ${scene.sceneNumber}: characterIds가 누락되었거나 비어있습니다.`
    );
  }

  return violations;
};

// 캐릭터 이름 검증 함수
const validateCharacterNames = (scriptBody: string, scriptIndex: number): string[] => {
  const violations: string[] = [];
  const allowedNames = ['김여사', '이여사', '박여사', '김프로', '박사장', '최프로', '캐디'];

  // 허용되지 않은 이름 패턴 찾기
  const forbiddenPatterns = [
    /\b(철수|영희|민수|지현|수진|현우)\b/g,  // 일반 이름
    /\b(아줌마|아저씨)\b/g,  // 비호칭
    /\b(그녀|그|그 사람)\b/g  // 대명사
  ];

  forbiddenPatterns.forEach(pattern => {
    const matches = scriptBody.match(pattern);
    if (matches) {
      violations.push(
        `스크립트 ${scriptIndex + 1}: 허용되지 않은 이름/호칭 사용: ${matches.join(', ')}. 반드시 김여사/김프로 등 지정된 이름만 사용하세요.`
      );
    }
  });

  // 최소 1명의 여성 캐릭터 포함 검증
  const femaleCount = allowedNames.filter(name => name.includes('여사') && scriptBody.includes(name)).length;
  if (femaleCount === 0) {
    violations.push(
      `스크립트 ${scriptIndex + 1}: 최소 1명의 여성 캐릭터(김여사/이여사/박여사)가 포함되어야 합니다.`
    );
  }

  return violations;
};

// 문장 수 검증 함수
const validateSentenceCount = (scriptBody: string, scriptIndex: number): string[] => {
  const violations: string[] = [];
  const sentences = scriptBody.split(/[.!?]/).filter(s => s.trim().length > 0);

  if (sentences.length < 10) {
    violations.push(
      `스크립트 ${scriptIndex + 1}: 문장 수가 ${sentences.length}개입니다. 최소 10문장 이상으로 작성하세요.`
    );
  }

  if (sentences.length > 12) {
    violations.push(
      `스크립트 ${scriptIndex + 1}: 문장 수가 ${sentences.length}개입니다. 최대 12문장으로 제한하세요.`
    );
  }

  return violations;
};

export const validateScriptScenes = (scripts: any[], ctx: ValidationContext) => {
  const violations: string[] = [];
  if (!Array.isArray(scripts)) {
    return ['AI 응답이 scripts 배열 형태가 아닙니다.'];
  }

  scripts.forEach((script, scriptIndex) => {
    // 대본 내용 검증 추가
    const scriptBody = script?.scriptBody || script?.script || '';
    if (scriptBody) {
      violations.push(...validateCharacterNames(scriptBody, scriptIndex));
      violations.push(...validateSentenceCount(scriptBody, scriptIndex));
    }

    const scenes: Scene[] = Array.isArray(script?.scenes) ? script.scenes : [];
    if (ctx.expectedSceneCount && scenes.length !== ctx.expectedSceneCount) {
      violations.push(
        `스크립트 ${scriptIndex + 1}: 씬 개수가 ${scenes.length}개입니다. ${ctx.expectedSceneCount}개로 맞춰주세요.`
      );
    }
    scenes.forEach((scene) => {
      violations.push(...validateScene(scene, ctx, scriptIndex));
    });
  });

  return violations;
};

/**
 * v4CharacterText.ts
 * 캐릭터 외형 텍스트 조립 - 단일 진실 + 중복제거 + 메타텍스트 필터
 * WomanA~D / ManA~C 슬롯, savedCharacters(내 캐릭터) 연동 지원
 */

// 프롬프트에 절대 들어가면 안 되는 한국어 메타텍스트/UI 라벨
const META_PATTERNS: RegExp[] = [
  /턴어라운드/,
  /AI\s*Studio/i,
  /얼굴\s*클로즈업/,
  /클로즈업\s*세트/,
  /생성한\s*캐릭터/,
  /참조\s*이미지/,
  /레퍼런스/,
];

const hasHangul = (s: string) => /[가-힣]/.test(s);

/** 콤마 단위로 쪼개 중복·메타텍스트·한글잔재 제거 후 다시 합침 */
export function dedupeAndClean(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .flatMap((p) => p.split(',').map((s) => s.trim()))
    .filter((s) => s.length > 0)
    .filter((s) => !META_PATTERNS.some((re) => re.test(s)))
    .filter((s) => !hasHangul(s)) // 영문 프롬프트에 한글 조각 제거
    .filter((s) => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
}

export interface AppearanceInput {
  slotId: string;
  characterRules: any;                 // getCharacterRules() 결과
  savedCharacters?: any[];             // 내가 만든 캐릭터 목록
  outfitText?: string;                 // outfitMap에서 온 의상 (단일 진실)
  accessoryText?: string;
  targetAgeEnglish?: string;           // "in her 40s" 등
}

/** 슬롯 1개의 외형 + 의상을 깨끗하게 조립 */
export function buildCharacterAppearance(input: AppearanceInput): string {
  const { slotId, characterRules, savedCharacters = [], outfitText, accessoryText, targetAgeEnglish } = input;
  const isWoman = slotId.startsWith('Woman');

  const rule = (isWoman ? characterRules?.females : characterRules?.males)?.find(
    (c: any) => c.id === slotId
  ) || {};

  // 내가 만든 캐릭터 연동 (characterId 우선)
  const linked = rule.characterId
    ? savedCharacters.find((c) => c.id === rule.characterId)
    : null;
  const spec = linked?.identitySpec || {};

  // 우선순위: 내 캐릭터 > 슬롯 기본값
  const face = linked?.face || spec.faceShape || rule.face || '';
  const hair = linked?.hair || spec.hairDescription || rule.hair || '';
  const body = linked?.body || spec.bodyType || rule.body || '';
  const skinTone = spec.skinTone || rule.skinTone || '';
  const signature = spec.signatureFeatures || rule.signatureFeatures || '';
  const style = linked?.style || spec.styleCore || rule.style || '';
  const bust = rule.bustDescription || '';
  const height = rule.heightDescription || '';

  // 나이 (성인 고정)
  const ageText = rule.isFixedAge
    ? rule.fixedAge
    : (targetAgeEnglish || (isWoman ? 'in her 40s' : 'in his 40s'));

  const genderNoun = isWoman ? 'A stunning Korean woman' : 'A handsome Korean man';
  const identity = `${genderNoun} ${ageText}`;

  const appearance = dedupeAndClean([
    face, hair, body, bust, height, skinTone, signature, style,
  ]);

  const outfitPart = outfitText
    ? `wearing ${outfitText}`
    : (isWoman ? 'wearing elegant casual outfit' : 'wearing tailored casual outfit');

  const colorLock = 'exact outfit colors, no hue shift, no color variation';

  return [identity, appearance, outfitPart, accessoryText, colorLock]
    .filter(Boolean)
    .join(', ');
}

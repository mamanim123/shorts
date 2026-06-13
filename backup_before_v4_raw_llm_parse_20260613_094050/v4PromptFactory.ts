import { convertAgeToEnglish } from '../labPromptBuilder';
import { getCharacterRules } from '../shortsLabCharacterRulesManager';
import type { V4OutfitEntry, V4PanelScene, V4ScenePlan } from './v4Types';

const TECH_TAIL = 'photorealistic, cinematic lighting, 8k resolution, professional photography, vertical 9:16 composition, no watermark';

const META_PATTERNS: RegExp[] = [
  /AI\s*Studio/i,
  /turnaround/i,
  /reference image/i,
  /3면도/,
  /참조/,
  /레퍼런스/,
  /생성한\s*캐릭터/
];

const cleanPart = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (META_PATTERNS.some((pattern) => pattern.test(text))) return '';
  return text;
};

const dedupeCommaParts = (parts: string[]): string => {
  const seen = new Set<string>();
  return parts
    .flatMap((part) => part.split(',').map((item) => item.trim()))
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
};

const getRuleBySlotId = (characterRules: any, slotId: string): any => {
  const source = slotId.startsWith('Woman') ? characterRules.females : characterRules.males;
  return Array.isArray(source) ? source.find((rule: any) => rule.id === slotId) : null;
};

const buildCharacterAppearance = (params: {
  slotId: string;
  characterRules: any;
  outfit?: V4OutfitEntry;
  targetAge: string;
}): string => {
  const { slotId, characterRules, outfit, targetAge } = params;
  const rule = getRuleBySlotId(characterRules, slotId) || {};
  const isWoman = slotId.startsWith('Woman');
  const normalizedAge = convertAgeToEnglish(targetAge || '');
  const ageText = rule.isFixedAge
    ? rule.fixedAge
    : normalizedAge
      ? `${isWoman ? 'in her' : 'in his'} ${normalizedAge}`
      : '';
  const identity = `${isWoman ? 'A stunning Korean woman' : 'A handsome Korean man'} ${ageText}`.trim();

  const appearance = dedupeCommaParts([
    cleanPart(rule.face),
    cleanPart(rule.hair),
    cleanPart(rule.body),
    cleanPart(rule.bustDescription),
    cleanPart(rule.heightDescription),
    cleanPart(rule.skinTone),
    cleanPart(rule.signatureFeatures),
    cleanPart(rule.style)
  ].filter(Boolean));

  const outfitText = outfit?.prompt || outfit?.name || (isWoman ? 'elegant premium outfit' : 'tailored premium casual outfit');
  return [
    identity,
    appearance,
    `wearing ${outfitText}`,
    'exact outfit colors, no hue shift, no color variation'
  ].filter(Boolean).join(', ');
};

const normalizeCamera = (cameraAngle: string, count: number): string => {
  const raw = String(cameraAngle || '').trim();
  if (/pov/i.test(raw)) return 'full body wide shot';
  if (!raw) {
    if (count >= 3) return 'group wide shot';
    if (count === 2) return 'two-shot wide';
    return 'full body wide shot';
  }
  if (count >= 3 && !/group|three|wide/i.test(raw)) return 'group wide shot';
  if (count === 2 && !/two|pair|wide/i.test(raw)) return 'two-shot wide';
  return raw;
};

const getShotType = (count: number): string => {
  if (count >= 3) return '쓰리샷';
  if (count === 2) return '투샷';
  return '원샷';
};

export const buildV4Scenes = (params: {
  scenePlans: V4ScenePlan[];
  outfitMap: Map<string, V4OutfitEntry>;
  targetAge: string;
  lockBackgroundToFirst?: boolean;
}): V4PanelScene[] => {
  const characterRules = getCharacterRules();
  const baseBackground = params.lockBackgroundToFirst
    ? params.scenePlans.find((scene) => scene.background.trim())?.background || ''
    : '';

  return params.scenePlans.map((scene, index): V4PanelScene => {
    const characterIds = Array.from(new Set(scene.characterIds || []));
    const cameraAngle = normalizeCamera(scene.cameraAngle, characterIds.length);
    const background = baseBackground || scene.background;
    const action = scene.action || 'standing naturally';

    const blocks = characterIds.map((slotId, slotIndex) => {
      const label = characterIds.length === 1 ? 'Reference Character' : `Person ${slotIndex + 1}`;
      const appearance = buildCharacterAppearance({
        slotId,
        characterRules,
        outfit: params.outfitMap.get(slotId),
        targetAge: params.targetAge
      });
      return `[${label}: ${appearance}]`;
    });

    const prompt = [
      'unfiltered raw photograph',
      cameraAngle,
      blocks.join(' '),
      action,
      background ? `in ${background}` : '',
      TECH_TAIL
    ].filter(Boolean).join(', ');

    return {
      number: scene.sceneNumber || index + 1,
      text: scene.scriptLine,
      prompt,
      characterIds,
      cameraAngle,
      background,
      action,
      summary: scene.summary || scene.scriptLine,
      camera: cameraAngle,
      shotType: getShotType(characterIds.length),
      age: params.targetAge,
      outfit: '',
      isSelected: true,
      imageUrl: undefined,
      videoPrompt: '',
      dialogue: scene.scriptLine,
      voiceType: 'narration',
      narrationText: scene.scriptLine,
      narrationEmotion: '',
      narrationSpeed: 'normal',
      lipSyncSpeaker: '',
      lipSyncSpeakerName: '',
      lipSyncLine: '',
      lipSyncEmotion: '',
      lipSyncTiming: undefined,
      shortPromptKo: '',
      longPromptKo: ''
    };
  });
};

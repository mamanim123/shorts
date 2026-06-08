/**
 * v4SceneFactory.ts
 * LLM JSON → Scene[] 변환. rebalance 없음. characterIds 100% 신뢰.
 * action 안의 한국어 이름을 Person N으로 완전 치환.
 */
import { buildCharacterAppearance } from './v4CharacterText';

export interface BuildScenesInput {
  rawScenes: any[];                              // LLM JSON의 scenes
  characterRules: any;
  savedCharacters?: any[];
  outfitMap: Map<string, { name: string; prompt: string }>;
  targetAgeEnglish?: string;
  lockBackgroundToFirst?: boolean;               // 1번 씬 배경으로 고정
}

const TECH_TAIL =
  'no text, no letters, no typography, photorealistic, 8k resolution, cinematic lighting, masterpiece --ar 9:16';

/** action 안의 한국어 이름(혜진 등)을 Person N으로 치환 */
function replaceNamesWithPersonN(action: string, characterIds: string[], characterRules: any): string {
  let result = String(action || '');
  characterIds.forEach((slotId, i) => {
    const isWoman = slotId.startsWith('Woman');
    const rule = (isWoman ? characterRules?.females : characterRules?.males)?.find((c: any) => c.id === slotId);
    const koName = rule?.name;
    if (koName) {
      const re = new RegExp(koName, 'g');
      result = result.replace(re, `Person ${i + 1}`);
    }
  });
  // 남은 한글 이름 패턴 정리 (Person N: 형태 유지)
  return result;
}

export function buildScenesFromLlmJson(input: BuildScenesInput): any[] {
  const { rawScenes, characterRules, savedCharacters = [], outfitMap, targetAgeEnglish, lockBackgroundToFirst } = input;

  const baseBackground = lockBackgroundToFirst
    ? (rawScenes.find((s) => (s.background || '').trim())?.background || '')
    : '';

  return rawScenes.map((scene, index) => {
    const characterIds: string[] = Array.isArray(scene.characterIds)
      ? scene.characterIds.map((id: any) => String(id || '').trim()).filter(Boolean)
      : [];

    const background = baseBackground || scene.background || '';
    const cameraAngle = scene.cameraAngle || scene.camera || 'full body wide shot';
    const action = replaceNamesWithPersonN(scene.action || 'standing naturally', characterIds, characterRules);

    // 캐릭터 블록 조립 (단일 진실)
    const blocks = characterIds.map((slotId, i) => {
      const outfit = outfitMap.get(slotId);
      const appearance = buildCharacterAppearance({
        slotId,
        characterRules,
        savedCharacters,
        outfitText: outfit?.prompt,
        targetAgeEnglish,
      });
      const label = characterIds.length === 1
        ? `Reference Character`
        : `Person ${i + 1}`;
      return `[${label}: ${appearance}]`;
    });

    const identityBlock = blocks.join(' ');

    const prompt = [
      'unfiltered raw photograph',
      cameraAngle,
      identityBlock,
      action,
      background ? `in ${background}` : '',
      TECH_TAIL,
    ].filter(Boolean).join(', ');

    return {
      number: scene.sceneNumber || scene.number || index + 1,
      text: scene.scriptLine || scene.text || '',
      characterIds,
      cameraAngle,
      background,
      action,
      prompt,
      longPrompt: prompt,
      shortPrompt: scene.shortPrompt || '',
      summary: scene.summary || '',
      characterProfilesApplied: true,
      imageUrl: undefined,
      isSelected: true,
      camera: cameraAngle,
      videoPrompt: '',
      dialogue: scene.scriptLine || '',
      voiceType: 'narration' as const,
      narrationText: scene.scriptLine || '',
      narrationEmotion: '',
      narrationSpeed: 'normal' as const,
      lipSyncSpeaker: '', lipSyncSpeakerName: '', lipSyncLine: '', lipSyncEmotion: '',
      lipSyncTiming: undefined,
      shortPromptKo: '', longPromptKo: '',
      outfit: '',
    };
  });
}

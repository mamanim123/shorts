/**
 * v4DirectParser.ts
 * 수동 JSON 붙여넣기 → 바로 미리보기. 또는 LLM longPrompt 원본 그대로 사용.
 */
import { buildScenesFromLlmJson, BuildScenesInput } from './v4SceneFactory';

function cleanJsonText(text: string): string {
  let t = String(text || '').trim();
  t = t.replace(/^(JSON|json)\s+/, '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(json|txt)?/i, '').replace(/```$/, '').trim();
  }
  // 여러 JSON이 붙어있으면 첫 번째 { ... } 균형 추출
  const start = t.indexOf('{');
  if (start > 0) t = t.slice(start);
  return t;
}

export interface DirectParseResult {
  scenes: any[];
  scriptBody: string;
  errors: string[];
}

/**
 * mode 'rebuild' : characterRules/outfitMap으로 프롬프트 재조립 (권장, 일관성 최고)
 * mode 'raw'     : LLM longPrompt를 글자 그대로 사용 (가공 0%)
 */
export function parseJsonToScenesDirect(
  rawText: string,
  opts: {
    mode?: 'rebuild' | 'raw';
    characterRules?: any;
    savedCharacters?: any[];
    outfitMap?: Map<string, { name: string; prompt: string }>;
    targetAgeEnglish?: string;
    lockBackgroundToFirst?: boolean;
  } = {}
): DirectParseResult {
  const errors: string[] = [];
  let parsed: any = null;

  try {
    parsed = JSON.parse(cleanJsonText(rawText));
  } catch (e) {
    errors.push('JSON 파싱 실패: ' + (e instanceof Error ? e.message : '형식 오류'));
    return { scenes: [], scriptBody: '', errors };
  }

  const rawScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  if (rawScenes.length === 0) errors.push('scenes 배열이 비어있습니다.');

  const scriptBody =
    typeof parsed?.scriptBody === 'string'
      ? parsed.scriptBody
      : rawScenes.map((s: any) => s.scriptLine || s.text || '').filter(Boolean).join('\n');

  const mode = opts.mode || 'rebuild';

  if (mode === 'raw') {
    // LLM이 만든 longPrompt를 그대로 사용
    const scenes = rawScenes.map((scene: any, i: number) => ({
      number: scene.sceneNumber || scene.number || i + 1,
      text: scene.scriptLine || scene.text || '',
      characterIds: Array.isArray(scene.characterIds) ? scene.characterIds : [],
      cameraAngle: scene.cameraAngle || '',
      background: scene.background || '',
      action: scene.action || '',
      prompt: scene.longPrompt || scene.prompt || scene.shortPrompt || '',
      longPrompt: scene.longPrompt || scene.prompt || '',
      shortPrompt: scene.shortPrompt || '',
      summary: scene.summary || '',
      characterProfilesApplied: true,
      imageUrl: undefined,
      isSelected: true,
      camera: scene.cameraAngle || '',
      videoPrompt: '',
      dialogue: scene.scriptLine || '',
      voiceType: 'narration' as const,
      narrationText: scene.scriptLine || '',
      narrationEmotion: '', narrationSpeed: 'normal' as const,
      lipSyncSpeaker: '', lipSyncSpeakerName: '', lipSyncLine: '', lipSyncEmotion: '',
      lipSyncTiming: undefined, shortPromptKo: '', longPromptKo: '', outfit: '',
    }));
    return { scenes, scriptBody, errors };
  }

  // rebuild 모드: 단일 진실로 재조립
  const scenes = buildScenesFromLlmJson({
    rawScenes,
    characterRules: opts.characterRules || { females: [], males: [] },
    savedCharacters: opts.savedCharacters || [],
    outfitMap: opts.outfitMap || new Map(),
    targetAgeEnglish: opts.targetAgeEnglish,
    lockBackgroundToFirst: opts.lockBackgroundToFirst ?? true,
  } as BuildScenesInput);

  return { scenes, scriptBody, errors };
}

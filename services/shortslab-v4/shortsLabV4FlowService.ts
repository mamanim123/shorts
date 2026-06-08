import { parseJsonFromText } from '../jsonParse';

export interface V4Scene {
  number: number;
  text: string;
  prompt: string;
  longPrompt?: string;
  shortPrompt?: string;
  longPromptKo?: string;
  shortPromptKo?: string;
  characterIds: string[];
  cameraAngle: string;
  background: string;
  action: string;
  summary: string;
  camera: string;
  videoPrompt: string;
  dialogue: string;
  voiceType: 'narration' | 'dialogue' | 'both' | 'none';
  narrationText: string;
  narrationEmotion: string;
  narrationSpeed: 'slow' | 'normal' | 'fast';
  lipSyncSpeaker: string;
  lipSyncSpeakerName: string;
  lipSyncLine: string;
  lipSyncEmotion: string;
  lipSyncTiming?: any;
  imageUrl?: string;
  isSelected: boolean;
  characterProfilesApplied: boolean;
  age?: string;
  outfit?: string;
}

export function cleanAndParseV4Json(text: string): any {
  let jsonClean = String(text || '').trim();
  jsonClean = jsonClean.replace(/^(JSON|json)\s+/, '').trim();

  if (jsonClean.startsWith('```')) {
    jsonClean = jsonClean
      .replace(/^```(json|txt)?/i, '')
      .replace(/```$/, '')
      .trim();
  }

  return parseJsonFromText<any>(jsonClean, [
    'title',
    'scriptBody',
    'scriptLines',
    'openingLine',
    'closingPunch',
    'lockedOutfits',
    'characters',
    'scenes'
  ]);
}

function normalizeLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function normalizeCharacterIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value.map(v => String(v || '').trim()).filter(Boolean)
  ));
}

export function convertV4JsonToScenes(parsed: any, targetAge = ''): {
  scriptBody: string;
  scenes: V4Scene[];
  rawParsed: any;
} {
  const scriptLines = normalizeLines(parsed?.scriptLines);
  const bodyLines = normalizeLines(parsed?.scriptBody);
  const normalizedLines = scriptLines.length > 0 ? scriptLines : bodyLines;
  const scriptBody = normalizedLines.join('\n');

  const sourceScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];

  const scenes = sourceScenes.map((scene: any, index: number): V4Scene => {
    const text =
      scene.scriptLine ||
      scene.text ||
      scene.dialogue ||
      scene.summary ||
      normalizedLines[index] ||
      `장면 ${index + 1}`;

    const prompt =
      scene.longPrompt ||
      scene.prompt ||
      scene.imagePrompt ||
      scene.shortPrompt ||
      '';

    return {
      number: scene.sceneNumber || scene.number || index + 1,
      text,
      prompt,
      longPrompt: scene.longPrompt || prompt,
      shortPrompt: scene.shortPrompt || '',
      longPromptKo: scene.longPromptKo || '',
      shortPromptKo: scene.shortPromptKo || '',
      characterIds: normalizeCharacterIds(scene.characterIds),
      cameraAngle: scene.cameraAngle || scene.camera || 'full body wide shot',
      background: scene.background || scene.location || scene.setting || '',
      action: scene.action || scene.behavior || scene.motion || 'standing naturally',
      summary: scene.summary || text,
      camera: scene.camera || scene.cameraAngle || '',
      videoPrompt: scene.videoPrompt || '',
      dialogue: scene.dialogue || text,
      voiceType: scene.voiceType || 'narration',
      narrationText: scene.narrationText || text,
      narrationEmotion: scene.narrationEmotion || '',
      narrationSpeed: scene.narrationSpeed || 'normal',
      lipSyncSpeaker: scene.lipSyncSpeaker || '',
      lipSyncSpeakerName: scene.lipSyncSpeakerName || '',
      lipSyncLine: scene.lipSyncLine || '',
      lipSyncEmotion: scene.lipSyncEmotion || '',
      lipSyncTiming: scene.lipSyncTiming,
      imageUrl: undefined,
      isSelected: true,
      characterProfilesApplied: false,
      age: targetAge,
      outfit: scene.outfit || ''
    };
  });

  return {
    scriptBody,
    scenes,
    rawParsed: parsed
  };
}

export async function runShortsLabV4Master(input: {
  service: string;
  prompt: string;
  targetAge: string;
}) {
  const response = await fetch('http://localhost:3002/api/generate/raw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: input.service,
      prompt: input.prompt,
      temperature: 0.7
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'V4 LLM 호출 실패');
  }

  const rawText = data.text || data.content || data.response || '';
  const parsed = cleanAndParseV4Json(rawText);

  if (!parsed || !Array.isArray(parsed.scenes)) {
    throw new Error('V4 JSON 파싱 실패: scenes 배열이 없습니다.');
  }

  const converted = convertV4JsonToScenes(parsed, input.targetAge);

  return {
    rawText,
    parsed,
    scriptBody: converted.scriptBody,
    scenes: converted.scenes
  };
}

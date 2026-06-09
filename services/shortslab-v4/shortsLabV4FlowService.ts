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

// ============================================
// [V4] 전체 파이프라인 오케스트레이션
// 대본 → 슬롯 자동확정(잠금) → 씬배정(고정목록) → 의상조립(토글) → 프롬프트조립
// 의상/배경/외모는 코드가 결정. LLM은 characterIds+action만.
// ============================================
import { getCharacterRules } from '../shortsLabCharacterRulesManager';
import {
  assignOutfitsToCharacters,
  applyCharacterInfoToScenes
} from '../labPromptBuilder';
import {
  buildV4SceneAssignmentPrompt,
  parseV4SceneAssignment,
  type V4SceneAssignSlot
} from './shortsLabV4SceneService';

export interface V4PipelineInput {
  service: string;
  scriptBody: string;          // 이미 생성된 대본(줄단위)
  genre: string;
  topic: string;
  targetAge: string;
  gender: 'female' | 'male';
  useRandomOutfits: boolean;
  outfitsData: any[];          // /api/outfits 결과
  enableWinterAccessories?: boolean;
}

export interface V4PipelineResult {
  scenes: any[];
  slotIds: string[];
  outfitMap: Map<string, { name: string; prompt: string }>;
  background: string;
  rawAssignment: string;
}

const callRaw = async (service: string, prompt: string, temperature = 0.4): Promise<string> => {
  const res = await fetch('http://localhost:3002/api/generate/raw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, prompt, temperature, maxTokens: 2000 })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'V4 LLM 호출 실패');
  return data.rawResponse || data.text || data.result || '';
};

// 대본에 등장할 슬롯을 "고정 확정"한다. (자동배정 후 잠금)
// 규칙(getCharacterRules)에 정의된 슬롯을 성별/내레이터 기준으로 선택.
const confirmFixedSlots = (gender: 'female' | 'male'): V4SceneAssignSlot[] => {
  const rules = getCharacterRules();
  const females = (rules.females || []).map((c: any) => ({ slotId: c.id, name: c.name || c.id, role: '' }));
  const males = (rules.males || []).map((c: any) => ({ slotId: c.id, name: c.name || c.id, role: '' }));
  // 여성 주제면 여성+남성 모두 후보, 남성 주제면 남성 우선
  const ordered = gender === 'male' ? [...males, ...females] : [...females, ...males];
  // 내레이터 표시
  const narratorId = gender === 'male' ? 'ManA' : 'WomanA';
  return ordered.map(s => s.slotId === narratorId ? { ...s, role: '내레이터/주인공' } : s);
};

export async function runV4Pipeline(input: V4PipelineInput): Promise<V4PipelineResult> {
  const { service, scriptBody, genre, topic, targetAge, gender,
          useRandomOutfits, outfitsData } = input;

  // 1) 고정 슬롯 확정 (잠금)
  const fixedSlots = confirmFixedSlots(gender);
  const allowedSlotIds = fixedSlots.map(s => s.slotId);

  // 2) 씬 배정 LLM (고정목록 중에서만 characterIds 선택)
  const assignPrompt = buildV4SceneAssignmentPrompt({
    scriptBody,
    slots: fixedSlots,
    background: ''   // 배경은 아래에서 코드가 정함
  });
  const rawAssignment = await callRaw(service, assignPrompt, 0.3);
  let assigned = parseV4SceneAssignment(rawAssignment, allowedSlotIds);

  // 폴백: 파싱 실패 시 대본 줄단위로 1인(내레이터) 배정
  if (assigned.length === 0) {
    const lines = scriptBody.split('\n').map(s => s.trim()).filter(Boolean);
    const narratorId = gender === 'male' ? 'ManA' : 'WomanA';
    assigned = lines.map((l, i) => ({
      sceneNumber: i + 1, scriptLine: l, characterIds: [narratorId], action: ''
    }));
  }

  // 3) 실제 등장하는 슬롯만 추림
  const usedSlotIds = Array.from(new Set(assigned.flatMap(s => s.characterIds)));
  const finalSlotIds = usedSlotIds.length > 0 ? usedSlotIds : [gender === 'male' ? 'ManA' : 'WomanA'];

  // 4) 의상 배정 (토글: ON=리스트랜덤, OFF=LLM디자인은 패널단계에서 별도, 여기선 리스트 기준)
  let outfitMap = new Map<string, { name: string; prompt: string }>();
  if (useRandomOutfits) {
    outfitMap = assignOutfitsToCharacters({
      characterIds: finalSlotIds, genre, outfitsData, topic
    });
  }

  // 5) 배경: 코드가 1개로 통일 (장르/주제 기반 기본 배경. 추후 패널에서 덮어쓸 수 있음)
  const background = ''; // applyCharacterInfoToScenes가 scene[0].background로 통일 처리

  // 6) scenes 골격 구성
  const baseScenes = assigned.map((s, i) => ({
    number: i + 1,
    sceneNumber: s.sceneNumber,
    text: s.scriptLine,
    scriptLine: s.scriptLine,
    characterIds: s.characterIds,
    action: s.action || 'standing naturally',
    background,
    cameraAngle: '',
    prompt: ''
  }));

  // 7) 캐릭터 정보 + 의상 + 일관성 조립 (검증된 함수 재사용)
  const characterRules = getCharacterRules();
  const scenes = applyCharacterInfoToScenes({
    scenes: baseScenes,
    characterRules,
    outfitMap,
    targetAge
  });

  return { scenes, slotIds: finalSlotIds, outfitMap, background, rawAssignment };
}

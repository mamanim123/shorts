import { parseJsonFromText } from '../jsonParse';
import { callV4GenerateRaw } from './v4ApiClient';
import type { V4ScenePlan, V4SceneSlot } from './v4Types';

const normalizeScriptLines = (scriptBody: string): string[] => (
  scriptBody.split('\n').map((line) => line.trim()).filter(Boolean)
);

export const buildV4SceneAssignmentPrompt = (params: {
  scriptBody: string;
  slots: V4SceneSlot[];
  topic: string;
  targetAge: string;
}): string => {
  const scriptLines = normalizeScriptLines(params.scriptBody);
  const slotBlock = params.slots
    .map((slot) => `- ${slot.slotId}: ${slot.name}${slot.role ? ` (${slot.role})` : ''}, ${slot.gender}`)
    .join('\n');

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 쇼츠 영상의 씬 배정 전문가입니다.
이미지 프롬프트 완성문을 쓰지 말고, 대본 라인별 시각 정보만 JSON으로 배정하세요.

주제: ${params.topic}
타겟 연령: ${params.targetAge}

고정 캐릭터 슬롯 목록:
${slotBlock}

규칙:
1. characterIds는 반드시 위 고정 슬롯 목록 중에서만 고르세요.
2. 대본 라인에 없는 인물을 억지로 추가하지 마세요.
3. 멀티샷 비율을 맞추기 위해 인물을 추가하지 마세요.
4. scriptLine은 원문 대본 라인을 그대로 복사하세요.
5. action/background/cameraAngle은 영어로 짧고 구체적으로 쓰세요.
6. longPrompt/shortPrompt/imagePrompt는 출력하지 마세요.
7. 씬 수는 대본 라인 수와 동일하게 유지하세요.

대본 라인:
${scriptLines.map((line, index) => `${index + 1}. ${line}`).join('\n')}

출력 JSON:
{
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptLine": "원문 그대로",
      "characterIds": ["WomanA"],
      "action": "short english action",
      "background": "short english background",
      "cameraAngle": "full body wide shot",
      "summary": "short english summary"
    }
  ]
}`;
};

export const parseV4SceneAssignment = (rawText: string, allowedSlotIds: string[]): V4ScenePlan[] => {
  const parsed = parseJsonFromText<any>(rawText, [
    'scenes',
    'sceneNumber',
    'scriptLine',
    'characterIds',
    'action',
    'background',
    'cameraAngle',
    'summary'
  ]);

  const source = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  const allowed = new Set(allowedSlotIds);

  return source.map((scene: any, index: number): V4ScenePlan => {
    const ids = Array.isArray(scene.characterIds)
      ? Array.from(new Set(scene.characterIds.map((id: any) => String(id || '').trim()).filter((id: string) => allowed.has(id))))
      : [];

    return {
      sceneNumber: Number(scene.sceneNumber || index + 1),
      scriptLine: String(scene.scriptLine || '').trim(),
      characterIds: ids,
      action: String(scene.action || '').trim(),
      background: String(scene.background || '').trim(),
      cameraAngle: String(scene.cameraAngle || '').trim(),
      summary: String(scene.summary || '').trim()
    };
  }).filter((scene) => scene.scriptLine);
};

export const generateV4SceneAssignment = async (params: {
  service: string;
  scriptBody: string;
  slots: V4SceneSlot[];
  topic: string;
  targetAge: string;
}): Promise<{ rawText: string; scenes: V4ScenePlan[] }> => {
  const prompt = buildV4SceneAssignmentPrompt(params);
  const rawText = await callV4GenerateRaw({
    service: params.service,
    prompt,
    maxTokens: 2200,
    temperature: 0.35,
    skipFolderCreation: true
  });
  const scenes = parseV4SceneAssignment(rawText, params.slots.map((slot) => slot.slotId));
  return { rawText, scenes };
};

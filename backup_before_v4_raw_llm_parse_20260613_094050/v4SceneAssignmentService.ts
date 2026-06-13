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
8. 원샷(characterIds 1명)은 전체의 약 30~40%(12씬 기준 4~5개)만 사용하세요. 나머지 씬은 대본 라인에 실제로 여러 명이 함께 있을 때 2~3명을 함께 배정해 투샷/쓰리샷을 만드세요. 단, 대본 라인에 1명만 있으면 억지로 추가하지 마세요.
9. cameraAngle은 매 씬마다 다르게, 다양하게 사용하세요: close-up, full body wide shot, medium close up, over-the-shoulder, low angle, high angle, back view, two-shot wide, group wide shot, dutch angle.
10. 같은 cameraAngle을 3회 이상 반복하지 마세요. 특히 medium shot 계열은 최대 3회까지만.
11. POV(1인칭 시점)는 사용하지 마세요. 대신 over-the-shoulder나 wide를 쓰세요.

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

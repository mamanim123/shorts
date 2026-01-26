import { parseJsonFromText } from './jsonParse';

export type ManualSceneCharacter = {
  id: string;
  name?: string;
  slotLabel?: string;
};

export type ManualSceneSummary = {
  sceneNumber: number;
  scriptLine: string;
  summary?: string;
  action?: string;
  background?: string;
  shotType?: string;
  characterIds?: string[];
};

export type ManualSceneParseResult = {
  title?: string;
  scenes: ManualSceneSummary[];
};

export const buildManualSceneDecompositionPrompt = (options: {
  scriptLines: string[];
  characters: ManualSceneCharacter[];
}) => {
  const { scriptLines, characters } = options;
  const lines = scriptLines.filter(Boolean);
  const characterLines = characters.length > 0
    ? characters
        .map((char) => {
          const nameLabel = char.name ? ` (${char.name})` : '';
          const slotLabel = char.slotLabel ? ` / ${char.slotLabel}` : '';
          return `- ${char.id}${nameLabel}${slotLabel}`;
        })
        .join('\n')
    : '- (none)';

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 장면 분해 전문가입니다. 아래 "대본 라인"을 그대로 유지하면서 씬 정보를 구조화하세요.
대본을 새로 쓰거나 요약해서 scriptLine을 바꾸지 마세요.

## 필수 규칙
1) JSON만 출력 (설명/마크다운 금지)
2) scenes 개수 = 대본 라인 수 (1:1 매칭)
3) scriptLine은 대본 라인을 **그대로 복사**
4) characterIds는 아래 목록의 ID만 사용 (없으면 빈 배열 [])
5) summary/action/background는 짧고 명확한 영어 묘사로 작성

## 대본 라인
${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}

## 캐릭터 ID 목록
${characterLines}

## 출력 JSON 스키마
{
  "title": "string",
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptLine": "원문 그대로",
      "summary": "short english summary",
      "action": "short english action",
      "background": "short english background",
      "shotType": "원샷/투샷/쓰리샷",
      "characterIds": ["WomanA"]
    }
  ]
}`;
};

export const parseManualSceneDecompositionResponse = (rawText: string): ManualSceneParseResult => {
  if (!rawText) return { scenes: [] };
  let jsonClean = rawText.trim();
  jsonClean = jsonClean.replace(/^(JSON|json)\s+/, '').trim();
  if (jsonClean.startsWith('```')) {
    jsonClean = jsonClean.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }

  const parsed = parseJsonFromText<any>(jsonClean, [
    'title',
    'scenes',
    'sceneNumber',
    'scriptLine',
    'summary',
    'action',
    'background',
    'shotType',
    'characterIds'
  ]);

  if (!parsed) return { scenes: [] };

  const scenesSource = parsed.scenes || parsed.scripts?.[0]?.scenes || [];
  if (!Array.isArray(scenesSource)) return { scenes: [] };

  const scenes = scenesSource.map((scene: any, index: number) => ({
    sceneNumber: scene.sceneNumber || index + 1,
    scriptLine: scene.scriptLine || scene.summary || scene.text || '',
    summary: scene.summary || '',
    action: scene.action || '',
    background: scene.background || '',
    shotType: scene.shotType || '',
    characterIds: Array.isArray(scene.characterIds) ? scene.characterIds : []
  }));

  return {
    title: parsed.title || parsed.scripts?.[0]?.title || undefined,
    scenes
  };
};

import { parseJsonFromText } from './jsonParse';
import {
  fillStep2PromptTemplate,
  getShortsLabStep2PromptRules
} from './shortsLabStep2PromptRulesManager';

export type ManualSceneCharacter = {
  id: string;
  name?: string;
  slotLabel?: string;
  identity?: string;
  hair?: string;
  body?: string;
  outfit?: string;
  winterAccessories?: string[];
};

export type ManualSceneSummary = {
  sceneNumber: number;
  scriptLine: string;
  summary?: string;
  action?: string;
  background?: string;
  shotType?: string;
  cameraAngle?: string;
  longPrompt?: string;
  shortPrompt?: string;
  negativePrompt?: string;
  characterIds?: string[];
};

export type ManualSceneParseResult = {
  title?: string;
  scenes: ManualSceneSummary[];
};

export type CharacterExtractionResult = {
  characters: Array<{
    name: string;
    gender: 'female' | 'male' | 'unknown';
    role?: string;
  }>;
  lineCharacterNames: Array<{
    line: number;
    characters: string[];
  }>;
};

export const buildCharacterExtractionPrompt = (options: {
  scriptLines: string[];
  defaultGender: 'female' | 'male';
}) => {
  const { scriptLines, defaultGender } = options;
  const lines = scriptLines.filter(Boolean);
  const step2Rules = getShortsLabStep2PromptRules();
  const lineBlock = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
  const customPrompt = fillStep2PromptTemplate(step2Rules.characterPrompt, {
    DEFAULT_GENDER: defaultGender,
    SCRIPT_LINES: lineBlock
  });
  if (customPrompt.trim()) {
    return customPrompt;
  }

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 등장인물 추출 전문가입니다. 아래 대본 라인에서 등장인물과 각 라인에 등장하는 인물 목록을 추출하세요.
대본을 변경하지 말고, 등장인물 이름만 추출하세요. 주인공이 이름 없이 "나/내가"로 표현되면 이름은 "주인공"으로 표기하세요.
성별이 불명확한 경우 gender는 "unknown"으로 두고, 주인공의 경우 기본 성별을 따르세요.
복수 지칭(예: "얘들아", "언니들", "친구들")이 있으면 최소 2명 이상의 인물로 분리하세요.
이름이 없는 조연은 "지인1", "지인2"처럼 구분해 작성하세요.

기본 성별: ${defaultGender}

## 대본 라인
${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}

## 출력 JSON 스키마
{
  "characters": [
    { "name": "주인공", "gender": "${defaultGender}", "role": "narrator" }
  ],
  "lineCharacterNames": [
    { "line": 1, "characters": ["주인공"] }
  ]
}`;
};

export const parseCharacterExtractionResponse = (rawText: string): CharacterExtractionResult => {
  if (!rawText) return { characters: [], lineCharacterNames: [] };
  let jsonClean = rawText.trim();
  jsonClean = jsonClean.replace(/^(JSON|json)\s+/, '').trim();
  if (jsonClean.startsWith('```')) {
    jsonClean = jsonClean.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }

  const parsed = parseJsonFromText<any>(jsonClean, ['characters', 'lineCharacterNames']);
  if (!parsed) return { characters: [], lineCharacterNames: [] };

  const characters = Array.isArray(parsed.characters)
    ? parsed.characters
        .map((item: any) => ({
          name: String(item?.name || '').trim(),
          gender: item?.gender === 'female' || item?.gender === 'male' ? item.gender : 'unknown',
          role: item?.role ? String(item.role) : undefined
        }))
        .filter((item: any) => item.name)
    : [];

  const rawLineEntries = Array.isArray(parsed.lineCharacterNames)
    ? parsed.lineCharacterNames
    : (Array.isArray(parsed.lines) ? parsed.lines : []);

  const lineCharacterNames = rawLineEntries
    .map((item: any) => ({
      line: Number(item?.line ?? item?.line_number ?? 0),
      characters: Array.isArray(item?.characters)
        ? item.characters.map((name: any) => String(name || '').trim()).filter(Boolean)
        : []
    }))
    .filter((item: any) => item.line > 0);

  return { characters, lineCharacterNames };
};

export const buildManualSceneDecompositionPrompt = (options: {
  scriptLines: string[];
  characters: ManualSceneCharacter[];
  enableWinterAccessories?: boolean;
}) => {
  const { scriptLines, characters, enableWinterAccessories = false } = options;
  const lines = scriptLines.filter(Boolean);

  // 캐릭터 정보를 상세하게 포맷 (의상, identity, hair, body 포함)
  const characterLines = characters.length > 0
    ? characters
        .map((char) => {
          const nameLabel = char.name ? ` (${char.name})` : '';
          const slotLabel = char.slotLabel ? ` / ${char.slotLabel}` : '';
          let detailStr = `- ${char.id}${nameLabel}${slotLabel}`;

          if (char.identity || char.hair || char.body || char.outfit) {
            const details: string[] = [];
            if (char.identity) details.push(`Identity: ${char.identity}`);
            if (char.hair) details.push(`Hair: ${char.hair}`);
            if (char.body) details.push(`Body: ${char.body}`);
            if (char.outfit) details.push(`Outfit: wearing ${char.outfit}`);
            if (char.winterAccessories && char.winterAccessories.length > 0) {
              details.push(`Winter Accessories: accessorized with ${char.winterAccessories.join(', ')}`);
            }
            detailStr += `\n  ${details.join(' | ')}`;
          }

          return detailStr;
        })
        .join('\n')
    : '- (none)';

  const step2Rules = getShortsLabStep2PromptRules();
  const lineBlock = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');

  // 겨울 악세서리 규칙 추가
  const winterAccessoriesRule = enableWinterAccessories
    ? `## ❄️ 겨울 악세서리 규칙 (필수!)
1. **모든 씬의 이미지 프롬프트에는 각 캐릭터의 겨울 악세서리를 반드시 포함**한다.
2. 위 "캐릭터 ID 목록"에 명시된 각 캐릭터의 Winter Accessories를 그대로 사용한다.
3. 악세서리는 shortPrompt/longPrompt 모두에 반영한다.
4. **의상 명칭은 절대 변형하지 말고 악세서리만 추가**한다.
5. **각 캐릭터마다 지정된 악세서리가 다르므로 혼동하지 말 것** (캐릭터별로 중복 없이 다른 악세서리 착용)`
    : '';

  // 의상 일관성 규칙
  const outfitConsistencyRule = `## 👗 의상 일관성 규칙 (절대 엄수!)
1. **모든 씬에서 각 캐릭터의 identity/hair/body/outfit 문구를 100% 동일하게 사용**
2. 위 "캐릭터 ID 목록"에 명시된 정보를 **한 글자도 바꾸지 말고** 그대로 복사
3. **의상 명칭 보존**: "Pink & White Striped Knit + White Micro Short Pants" 같은 의상 명칭을 요약하거나 일부 생략 절대 금지
4. **투샷/쓰리샷에서도 각 캐릭터별로 전체 정보(identity+hair+body+outfit${enableWinterAccessories ? '+accessories' : ''}) 개별 명시**
5. Scene 1부터 마지막 Scene까지 **동일한 캐릭터는 동일한 의상**을 입어야 함 (랜덤 생성 금지)`;

  // 겨울 악세서리 예시
  const winterAccessoriesExample = enableWinterAccessories
    ? ', accessorized with luxurious mink fur beanie, premium cashmere scarf'
    : '';

  const customPrompt = fillStep2PromptTemplate(step2Rules.finalPrompt, {
    SCRIPT_LINES: lineBlock,
    CHARACTER_LINES: characterLines,
    WINTER_ACCESSORIES_RULE: winterAccessoriesRule,
    CHARACTER_OUTFIT_CONSISTENCY_RULE: outfitConsistencyRule,
    WINTER_ACCESSORIES_EXAMPLE: winterAccessoriesExample
  });
  if (customPrompt.trim()) {
    return customPrompt;
  }

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 장면 분해 전문가입니다. 아래 "대본 라인"을 그대로 유지하면서 씬 정보를 구조화하세요.
대본을 새로 쓰거나 요약해서 scriptLine을 바꾸지 마세요.

## 필수 규칙
1) JSON만 출력 (설명/마크다운 금지)
2) scenes 개수 = 대본 라인 수 (1:1 매칭)
3) scriptLine은 대본 라인을 **그대로 복사**
4) characterIds는 아래 목록의 ID만 사용 (없으면 빈 배열 [])
5) summary/action/background는 짧고 명확한 영어 묘사로 작성
6) longPrompt/shortPrompt는 이미지 생성용 영어 프롬프트로 작성 (자연스러운 묘사, 고정문구 누락 금지)
7) shotType과 cameraAngle을 다양하게 섞어 사용 (원샷/투샷/쓰리샷 및 close-up, wide, medium, canted(dutch), OTS, POV, low-angle, high-angle)

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
      "cameraAngle": "close-up | wide | medium | canted (dutch) | over-the-shoulder | POV | low-angle | high-angle",
      "characterIds": ["WomanA"],
      "shortPrompt": "short image prompt",
      "longPrompt": "detailed image prompt",
      "negativePrompt": "NOT cartoon, NOT anime, ..."
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
    'characterIds',
    'cameraAngle',
    'shortPrompt',
    'longPrompt',
    'negativePrompt'
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
    cameraAngle: scene.cameraAngle || '',
    shortPrompt: scene.shortPrompt || scene.short_prompt || '',
    longPrompt: scene.longPrompt || scene.long_prompt || '',
    negativePrompt: scene.negativePrompt || scene.negative_prompt || '',
    characterIds: Array.isArray(scene.characterIds) ? scene.characterIds : []
  }));

  return {
    title: parsed.title || parsed.scripts?.[0]?.title || undefined,
    scenes
  };
};

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
  lockedOutfits?: Record<string, string>; // AI가 자율적으로 선택한 캐릭터별 의상
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

  // [v3.5.3] 의상 전적 자율 선택 지시어 설계
  const outfitSelectionInstruction = !options.characters.some(c => c.outfit)
    ? `\n2. **의상 자율 선택 (LLM Selection)**: 
   - 현재 캐릭터들의 의상이 지정되지 않았습니다. 
   - 대본의 주제, 분위기, 장르를 종합적으로 분석하여 **각 캐릭터에게 가장 잘 어울리는 최상급 명품 의상 명칭**을 직접 선택하세요.
   - **⚠️ 의상 정책 (Must Follow)**: 쇄골(Collarbone)과 어깨(Shoulder) 라인이 드러나는 스타일(Off-shoulder 등)은 허용되지만, **가슴골(Cleavage)이 깊게 파인 디자인(Deep V-neck, Plunging, Low-cut)은 절대 피하세요.**
   - 선택한 의상은 아래 JSON의 "lockedOutfits" 객체에 담아야 합니다.`
    : `\n2. **의상 일관성 준수**: 캐릭터 ID 목록에 명시된 의상을 한 글자도 바꾸지 말고 그대로 사용하세요.`;

  const step2Rules = getShortsLabStep2PromptRules();
  const lineBlock = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');

  const shotQualityRule = `## 🎥 샷 품질 고도화 규칙 (매우 중요!)
1) **배경 일관성 (Environment Continuity)**:
   - 첫 씬에서 설정된 장소/배경은 대본에 명시된 이동이 없으면 끝까지 유지한다.
   - 골프장/설산 배경을 실내/스튜디오로 바꾸지 말 것.
2) **다인원 동작 다양성 (Action Diversity)**:
   - 2명 이상 등장 시 각 인물의 동작을 서로 다르게 설정한다.
   - 예: Person1=스윙 준비, Person2=박수/웃음, Person3=고개 돌림.
3) **카메라 앵글 다양성**:
   - 미디엄샷을 연속으로 사용하지 말 것.
   - close-up, wide, POV, over-the-shoulder 등을 섞어라.
4) **Candid Shot 스타일**:
   - 자연스럽고 우연히 찍힌 느낌을 강조한다.
   - 키워드 예: candid moment, natural interaction, captured mid-action.
5) **배경 가시성 강화**:
   - wide/establishing shot에서는 배경이 선명하게 보이도록 deep focus, sharp background를 포함한다.
   - 인물이 배경을 가리지 않도록 환경이 화면에 넓게 드러나야 한다.`;

  // 겨울 악세서리 규칙 (자율성 강화)
  const winterAccessoriesRule = enableWinterAccessories
    ? `## ❄️ 겨울 악세서리 규칙 (자율 코디 필수!)
1. **모든 씬의 이미지 프롬프트에는 각 캐릭터의 겨울 방한용품을 조화롭게 포함**한다.
2. 대본 상황(예: 눈오는 필드)에 맞춰 beanie(비니), earmuffs(귀도리), scarf(목도리), gloves(장갑) 등을 AI가 스스로 판단하여 자연스럽게 추가 코디한다.
3. 악세서리는 shortPrompt/longPrompt 모두에 반영한다.
4. 선택한 의상과 악세서리를 조화롭게 매칭하여 최상급 겨울 룩을 완성할 것.`
    : '';

  // 의상 일관성 규칙
  const outfitConsistencyRule = `## 👗 의상 일관성 규칙 (절대 엄수! 위반 시 즉시 실패!)

### 🚨 핵심 규칙 (반드시 준수)
1. **의상 명칭 100% 동일 복사**: lockedOutfits/characters의 outfit 문자열을 **단어 하나도 변경/생략/요약하지 말고** 그대로 복사
   - ❌ 금지: "Coral Ruched Off-shoulder tight-fitting long-sleeve Mini Dress" → "coral dress"
   - ❌ 금지: "denim hot pants" → "denim shorts" (동의어 사용 금지!)
   - ✅ 올바름: 전체 명칭 그대로 복사붙여넣기

2. **characterSlot 순서 = Person 번호 순서**: characterSlot이 "WomanA, WomanB"면 반드시 Person 1=WomanA, Person 2=WomanB
   - ❌ 금지: characterSlot은 WomanA,WomanB인데 longPrompt에서 Person 1이 WomanB인 경우
   - ✅ 올바름: characterSlot 순서와 Person 번호가 정확히 일치

3. **투샷/쓰리샷에서 identity+hair+body+outfit 전부 필수**: 여러 캐릭터 등장 시 **절대 생략 금지**
   - ❌ 금지: "[Person 1: stunning Korean woman in 40s, coral dress]" (identity 축약, hair/body 누락)
   - ✅ 올바름: "[Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, perfectly managed sophisticated look..., wearing Coral Ruched Off-shoulder tight-fitting long-sleeve Mini Dress]"

4. **모든 씬에서 동일한 캐릭터는 동일한 문구 사용**: Scene 1부터 마지막 Scene까지 identity/hair/body/outfit 문구가 100% 동일해야 함

### ✅ 최종 검증 체크리스트 (출력 전 반드시 확인!)
- [ ] 모든 outfit이 lockedOutfits의 원본과 글자 하나 틀림없이 동일한가?
- [ ] characterSlot의 순서와 Person 번호 순서가 일치하는가?
- [ ] 투샷/쓰리샷의 모든 Person에 identity, hair, body, wearing, outfit이 포함되어 있는가?
- [ ] 같은 캐릭터의 문구가 모든 씬에서 100% 동일한가?
- [ ] "shorts"를 "hot pants" 대신 쓰거나, 의상 단어를 동의어로 바꾸지 않았는가?`;

  // 겨울 악세서리 예시
  const winterAccessoriesExample = enableWinterAccessories
    ? ', accessorized with luxurious mink fur beanie, premium cashmere scarf'
    : '';

  const customPrompt = fillStep2PromptTemplate(step2Rules.finalPrompt, {
    SCRIPT_LINES: lineBlock,
    CHARACTER_LINES: characterLines,
    WINTER_ACCESSORIES_RULE: winterAccessoriesRule,
    CHARACTER_OUTFIT_CONSISTENCY_RULE: `${outfitSelectionInstruction}\n${outfitConsistencyRule}`,
    WINTER_ACCESSORIES_EXAMPLE: ''
  });
  if (customPrompt.trim()) {
    return `${customPrompt}\n\n${shotQualityRule}`;
  }

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 장면 분해 전문가입니다. 아래 "대본 라인"의 흐름을 바탕으로 최적의 시각적 씬(Scenes)을 구성하세요.

## 필수 규칙
1) JSON만 출력 (설명/마크다운 금지)
2) 씬 재구성: 씬 개수는 대본 라인 수와 상관없이 **8~12개 사이로 가장 임팩트 있게 재구성**하세요. (관련 있는 문장은 하나의 씬으로 묶거나, 중요한 순간은 2개 이상의 씬으로 나누어 시각적 흐름을 극대화할 것)
3) scriptLine은 해당 장면에 해당하는 대본 문장을 **그대로 복사** (여러 문장이 합쳐진 경우 줄바꿈으로 합칠 것)
4) characterIds는 아래 목록의 ID만 사용 (없으면 빈 배열 [])
5) summary/action/background는 짧고 명확한 영어 묘사로 작성
6) longPrompt/shortPrompt는 이미지 생성용 영어 프롬프트로 작성 (자연스러운 묘사, 고정문구 누락 금지)
7) **역동적 앵글 사용**: 미디움샷(medium shot) 연속 사용을 피하고, wide(전신), aerial(항공), POV, extreme close-up 등을 적극 활용하여 TV 광고 같은 연출을 할 것.


${shotQualityRule}

## 대본 라인
${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}

## 캐릭터 ID 목록
${characterLines}

## 출력 JSON 스키마
{
  "title": "string",
  "lockedOutfits": {
    "WomanA": "의상 명칭",
    "ManA": "의상 명칭"
  },
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
    lockedOutfits: parsed.lockedOutfits || {},
    scenes
  };
};

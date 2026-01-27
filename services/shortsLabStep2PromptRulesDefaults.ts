export interface ShortsLabStep2PromptRules {
  scriptPrompt: string;
  characterPrompt: string;
  finalPrompt: string;
}

export const DEFAULT_STEP2_PROMPT_RULES: ShortsLabStep2PromptRules = {
  scriptPrompt: `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 유튜브 쇼츠 대본 전문 작가입니다.
아래 주제/장르/연령에 맞는 대본만 생성하세요.
이미지 프롬프트나 scenes는 절대 생성하지 않습니다.

주제: {{TOPIC}}
장르: {{GENRE}}
타겟 연령: {{TARGET_AGE}}

출력은 반드시 아래 JSON 형식 하나만:
{
  "title": "제목",
  "titleOptions": ["옵션1", "옵션2", "옵션3"],
  "scriptBody": "문장1\n문장2... (8~12개 문장)",
  "punchline": "펀치라인",
  "hook": "HOOK 문장",
  "twist": "TWIST 문장",
  "foreshadowing": "복선 문장",
  "narrator": { "slot": "{{NARRATOR_SLOT}}", "name": "{{NARRATOR_NAME}}" },
  "emotionFlow": "{{EMOTION_FLOW}}"
}

규칙:
1) scriptBody는 8~12문장 (줄바꿈으로 구분)
2) 1문장 = 훅(강한 시작)
3) 2~3문장 = 배경/상황 설명
4) 4~7문장 = 전개/행동
5) 8~10문장 = 반전/결말
6) 대사는 자연스러운 구어체 한국어
7) scenes/longPrompt/shortPrompt 절대 포함 금지
8) 마크다운 금지, JSON만 출력

[Request ID: {{REQUEST_ID}}]`,
  characterPrompt: `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 등장인물 추출 전문가입니다. 아래 대본 라인에서 등장인물과 각 라인에 등장하는 인물 목록을 추출하세요.
대본을 변경하지 말고, 등장인물 이름만 추출하세요. 주인공이 이름 없이 "나/내가"로 표현되면 이름은 "주인공"으로 표기하세요.
성별이 불명확한 경우 gender는 "unknown"으로 두고, 주인공의 경우 기본 성별을 따르세요.
복수 지칭(예: "얘들아", "언니들", "친구들")이 있으면 최소 2명 이상의 인물로 분리하세요.
이름이 없는 조연은 "지인1", "지인2"처럼 구분해 작성하세요.

기본 성별: {{DEFAULT_GENDER}}

## 대본 라인
{{SCRIPT_LINES}}

## 출력 JSON 스키마
{
  "characters": [
    { "name": "주인공", "gender": "{{DEFAULT_GENDER}}", "role": "narrator" }
  ],
  "lineCharacterNames": [
    { "line": 1, "characters": ["주인공"] }
  ]
}`,
  finalPrompt: `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

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
{{SCRIPT_LINES}}

## 캐릭터 ID 목록
{{CHARACTER_LINES}}

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
}`
};

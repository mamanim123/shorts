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

규칙:
1) scriptBody는 8~12문장 (줄바꿈으로 구분)
2) 1문장 = 훅(강한 시작)
3) 2~3문장 = 배경/상황 설명
4) 4~7문장 = 전개/행동
5) 8~10문장 = 반전/결말
6) 대사는 자연스러운 구어체 한국어
7) scenes/longPrompt/shortPrompt 절대 포함 금지
8) 마크다운 금지, JSON만 출력`,
  characterPrompt: `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 등장인물 추출 전문가입니다. 아래 대본 라인에서 등장인물과 각 라인에 등장하는 인물 목록을 추출하세요.
대본을 변경하지 말고, 등장인물 이름만 추출하세요. 주인공이 이름 없이 "나/내가"로 표현되면 이름은 "주인공"으로 표기하세요.
성별이 불명확한 경우 gender는 "unknown"으로 두고, 주인공의 경우 기본 성별을 따르세요.
복수 지칭(예: "얘들아", "언니들", "친구들")이 있으면 최소 2명 이상의 인물로 분리하세요.
이름이 없는 조연은 "지인1", "지인2"처럼 구분해 작성하세요.

기본 성별: {{DEFAULT_GENDER}}

## 대본 라인
{{SCRIPT_LINES}}

`,
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

## 📸 샷 타입 규칙 (매우 중요!)
### 등장 인물 수에 따른 샷 타입
- **1명 등장**: shotType = "원샷"
- **2명 등장**: shotType = "투샷"
- **3명 등장**: shotType = "쓰리샷"

### 투샷/쓰리샷 longPrompt 작성 필수 규칙
**여러 캐릭터가 등장할 때는 반드시 [Person 1], [Person 2], [Person 3]로 구분!**

✅ **원샷 예시** (1명):
\`\`\`
unfiltered raw photograph..., A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress{{WINTER_ACCESSORIES_EXAMPLE}}, smiling at camera, snowy golf course, ...
\`\`\`

✅ **투샷 예시** (2명) - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress{{WINTER_ACCESSORIES_EXAMPLE}}] [Person 2: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit{{WINTER_ACCESSORIES_EXAMPLE}}] walking together, snowy golf course, ...
\`\`\`

❌ **금지**: 캐릭터 구분 없이 쉼표로만 연결 (AI가 캐릭터를 혼동함!)

## 📷 카메라 앵글 필수 규칙 (미디움샷만 쓰면 안됨!)
각 씬마다 다른 앵글을 사용하여 영상 다양성 확보!

| 씬 번호 | 권장 앵글 | 프롬프트 키워드 |
|--------|----------|---------------|
| Scene 1 (Hook) | **close-up** | close-up portrait shot, face in focus, shallow depth of field |
| Scene 2 (Setup) | **wide** | wide establishing shot, full body visible, environment context |
| Scene 3 | **medium** | medium shot, waist-up framing, natural pose |
| Scene 4 | **over-the-shoulder** | over-the-shoulder shot, perspective view |
| Scene 5 (Climax) | **close-up** | close-up shot, dramatic expression, face in focus |
| Scene 6 | **POV** | first-person POV shot, subjective camera angle |
| Scene 7 (Twist) | **wide** | wide shot, revealing context, full body visible |
| Scene 8 (Outro) | **medium** | medium shot, natural pose, waist-up framing |

**⚠️ 필수**: longPrompt 맨 앞에 카메라 앵글 키워드를 반드시 넣을 것!
**⚠️ 금지**: 같은 앵글 2연속 사용, 미디움샷만 8개 사용

### 앵글 다양성 체크리스트
- ✅ close-up 최소 2개 이상 (Hook, Climax 필수)
- ✅ wide 최소 2개 이상 (Setup, Twist 권장)
- ✅ medium 2-3개
- ✅ over-the-shoulder 또는 POV 중 최소 1개
- ❌ 같은 앵글 3연속 사용 금지

## 🎥 POV (1인칭 시점) 샷 절대 규칙 ⚠️
POV 샷은 **특정 캐릭터의 눈으로 보는 시점**입니다.

**필수 규칙:**
1. ✅ **화면에 보이는 캐릭터만 longPrompt에 포함**
   - "지영의 시선에서 캐디가 웃으며" → 프롬프트에는 **캐디만** 포함
2. ❌ **시점의 주인공(카메라 역할)은 절대 프롬프트에 포함 금지**
   - "지영의 시선" → 지영은 카메라이므로 프롬프트에서 완전히 제외
3. ✅ **POV 대상 캐릭터는 카메라를 바라봄**
   - "looking at camera (POV target)" 필수

**올바른 예시:**
\`\`\`
한글: "지영의 시선에서 캐디가 손을 흔들며 인사하는 POV 샷"
영문 longPrompt: "unfiltered raw photograph..., first-person POV shot, A stunning Korean woman in her early 20s (캐디만!), high-bun hairstyle, ..., waving hand, looking at camera (POV target), ..."
\`\`\`

{{WINTER_ACCESSORIES_RULE}}

{{CHARACTER_OUTFIT_CONSISTENCY_RULE}}

## 대본 라인
{{SCRIPT_LINES}}

## 캐릭터 ID 목록 (의상 정보 포함)
{{CHARACTER_LINES}}

`
};

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

## 역할(role) 분류
- narrator: 이야기 화자 (주인공)
- caddy: 골프장 캐디 (직업이 캐디인 인물은 무조건 caddy로 분류)
- visual_focus: 외모/매력 강조 캐릭터 (대본에서 "아름다운", "예쁜", "멋진" 등으로 묘사된 캐릭터)
- supporting: 일반 조연

## 🎯 맥락 기반 인물 추출 (매우 중요!)
단순히 이름이 언급된 인물만 추출하지 마세요. **맥락상 그 장면에 함께 있어야 할 인물**을 모두 추출하세요.

### 필수 추출 패턴:
1. **관찰/반응 패턴**: "A가 B를 쳐다봤다", "A가 B를 보고 놀랐다" → A와 B 모두 추출
2. **상호작용 패턴**: "A가 B에게 건네다", "A가 B를 도왔다" → A와 B 모두 추출  
3. **암시적 존재 패턴**: "다들 넋 놓고 쳐다봤다" → 쳐다본 대상과 관찰자들 모두 추출
4. **대화 패턴**: 대사가 있으면 말하는 사람 + 듣는 사람 모두 추출

### 추출 검증:
- 각 라인에서 **동작의 주체**와 **동작의 대상**을 모두 확인했는가?
- **리액션을 보이는 사람**이 누락되지 않았는가?
- 이전 라인에서 등장한 인물이 갑자기 사라지지 않았는가?

기본 성별: {{DEFAULT_GENDER}}

## 대본 라인
{{SCRIPT_LINES}}

`,
  finalPrompt: `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 장면 분해 전문가입니다. 아래 "대본 라인"의 흐름을 바탕으로 최적의 시각적 씬(Scenes)을 구성하세요.

## 필수 규칙
1) JSON만 출력 (설명/마크다운 금지)
2) 씬 재구성: 씬 개수는 대본 라인 수와 상관없이 **8~12개 사이로 가장 임팩트 있게 재구성**하세요. (관련 있는 문장은 하나의 씬으로 묶거나, 중요한 순간은 2개 이상의 씬으로 나누어 시각적 흐름을 극대화할 것)
3) scriptLine은 해당 장면에 해당하는 대본 문장을 **그대로 복사** (여러 문장이 합쳐진 경우 줄바꿈으로 합칠 것)
4) characterIds는 아래 목록의 ID만 사용 (없으면 빈 배열 [])
5) summary/action/background는 짧고 명확한 영어 묘사로 작성
6) longPrompt/shortPrompt는 이미지 생성용 영어 프롬프트로 작성 (자연스러운 묘사, 고정문구 누락 금지)
7) **캐릭터 일관성**: 매 씬마다 캐릭터의 [Identity + Outfit + Accessories] 정보를 생략 없이 전체 명시할 것.

## 📸 샷 타입 규칙 (매우 중요!)
### 등장 인물 수에 따른 샷 타입
- **1명 등장**: shotType = "원샷"
- **2명 등장**: shotType = "투샷"
- **3명 등장**: shotType = "쓰리샷"

### 투샷/쓰리샷 longPrompt 작성 필수 규칙
**여러 캐릭터가 등장할 때는 반드시 [Person 1], [Person 2], [Person 3]로 구분!**

🚨 **characterSlot 순서 = Person 번호 순서 (매우 중요!)**
- characterSlot: "WomanA, WomanB" → Person 1 = WomanA, Person 2 = WomanB
- characterSlot: "WomanB, WomanA" → Person 1 = WomanB, Person 2 = WomanA
- **순서가 뒤바뀌면 캐릭터 혼동 발생!**

✅ **원샷 예시** (1명) - identity+hair+body+wearing+outfit 전부 포함:
\`\`\`
unfiltered raw photograph..., A stunning Korean woman in her 40s, long soft-wave hairstyle, perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves, wearing Navy Dress{{WINTER_ACCESSORIES_EXAMPLE}}, smiling at camera, snowy golf course, ...
\`\`\`

✅ **투샷 예시** (2명) - [Person 1], [Person 2] + 각각 identity+hair+body+wearing+outfit+액세서리+개별동작 전부 포함:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves, wearing Coral Ruched Off-shoulder tight-fitting long-sleeve Mini Dress{{WINTER_ACCESSORIES_EXAMPLE}}, gesturing enthusiastically while speaking] [Person 2: A stunning Korean woman in her 40s, short chic bob cut, Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, high-seated chest line, wearing Grey Ribbed Knit Tight Mini Dress (Modern Chic) (Tight-fitting long-sleeve version){{WINTER_ACCESSORIES_EXAMPLE}}, listening with amused smile and crossed arms], snowy golf course, ...
\`\`\`

✅ **쓰리샷 예시** (3명) - [Person 1], [Person 2], [Person 3] + 각각 전체 정보 + 개별동작:
\`\`\`
unfiltered raw photograph..., [Person 1: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build, wearing Navy Polo Shirt and Beige Chinos{{WINTER_ACCESSORIES_EXAMPLE}}, standing with hands in pockets] [Person 2: A handsome Korean man in his 40s, clean short cut, well-built physique, wearing White Oxford Shirt and Grey Slacks{{WINTER_ACCESSORIES_EXAMPLE}}, pointing at something in distance] [Person 3: A stunning Korean woman in her 40s, long soft-wave hairstyle, high-seated chest line, extraordinarily voluminous high-projection bust, wearing Coral Mini Dress{{WINTER_ACCESSORIES_EXAMPLE}}, looking surprised with hand on chest], snowy golf course, ...
\`\`\`

## 🚶 개별 동작 필수 규칙 (쌍둥이 방지!)
**투샷/쓰리샷에서 모든 캐릭터가 같은 동작을 하면 쌍둥이처럼 어색합니다!**

### 필수 규칙:
1. ✅ **각 Person 블록 안에 개별 동작을 명시**
2. ❌ **"walking together", "standing together" 같은 공통 동작만 쓰기 금지**
3. ✅ **action 필드의 내용을 각 캐릭터에게 분배**

### 개별 동작 예시:
- Person 1: "gesturing while speaking" + Person 2: "listening with crossed arms"
- Person 1: "pointing at distance" + Person 2: "looking surprised" + Person 3: "nodding in agreement"
- Person 1: "laughing with hand on mouth" + Person 2: "rolling eyes playfully"

❌ **금지 사항**:
1. 캐릭터 구분 없이 쉼표로만 연결 (AI가 캐릭터를 혼동함!)
2. body 정보 생략 (예: "[Person 1: stunning Korean woman in 40s, coral dress]" ← body 없음!)
3. 의상 명칭 축약 (예: "Coral Ruched Off-shoulder tight-fitting long-sleeve Mini Dress" → "coral dress" ❌)
4. characterSlot 순서와 Person 번호 불일치
5. **모든 캐릭터에 동일한 동작 적용** (예: "both smiling" ❌, 각자 다른 표정/동작 ✅)
6. **여러 캐릭터에게 동일한 의상 할당** (예: WomanA와 WomanB가 같은 "White Off-shoulder dress" ❌, 각자 고유한 의상 ✅)

## 📷 카메라 앵글 필수 규칙 (역동적 화면 구성 필수!)
단조로운 미디움샷 위주 구성을 탈출하여 TV 광고 같은 연출을 하세요.

| 장면 성격 | 권장 앵글 | 프롬프트 키워드 |
|--------|----------|---------------|
| 오프닝 (Hook) | **close-up** | close-up portrait shot, face in focus, shallow depth of field |
| 배경 설명 | **wide/aerial** | wide establishing shot, bird's eye view, environment context, deep focus |
| 인물 동작 | **wide/full-body** | full body shot, dynamic pose, revealing background details |
| 대화/상호작용 | **two-shot/OTS** | two-shot, over-the-shoulder shot, natural interaction |
| 반전/충격 | **extreme close-up** | extreme close-up shot, dramatic facial expression, eyes in focus |
| 몰입 (POV) | **POV** | first-person POV shot, looking at camera (POV target) |
| 결말 (Outro) | **wide** | wide shot, final scene, background visible, cinematic atmosphere |

**⚠️ 앵글 다양성 강제 규칙:**
1) **미디움샷(medium shot) 3회 연속 사용 절대 금지**
2) **전신샷(Full-body/Wide) 최소 3회 포함** (쇼츠 세로 화면에서 배경이 잘 보이도록)
3) **항공샷(Aerial/Bird's eye) 또는 POV 중 최소 1회 포함**
4) **익스트림 클로즈업(Extreme close-up) 1회 이상 권장** (강한 감정 표현)

**⚠️ 필수**: longPrompt 맨 앞에 카메라 앵글 키워드를 반드시 넣을 것!

## 🌄 배경 가시성 강화 규칙 (쇼츠는 세로 화면!)
쇼츠는 9:16 세로 화면이므로 미디움샷만 쓰면 배경이 전혀 보이지 않습니다.

### 와이드 샷 필수 요소:
1. **deep focus** - 배경까지 선명하게
2. **environment context** - 장소가 무엇인지 명확히
3. **full body visible** - 인물 전신이 보여야 배경도 보임
4. **background details** - 눈, 나무, 건물 등 구체적 배경 묘사

## 🎥 POV (1인칭 시점) 샷 절대 규칙 ⚠️
POV 샷은 **특정 캐릭터의 눈으로 보는 시점**입니다.

**필수 규칙:**
1. ✅ **화면에 보이는 캐릭터만 longPrompt에 포함**
2. ❌ **시점의 주인공(카메라 역할)은 절대 프롬프트에 포함 금지**
3. ✅ **POV 대상 캐릭터는 카메라를 바라봄**
   - "looking at camera (POV target)" 필수

{{WINTER_ACCESSORIES_RULE}}

{{CHARACTER_OUTFIT_CONSISTENCY_RULE}}

## 🔍 JSON 출력 전 최종 검증 체크리스트 (필수!)
**아래 항목을 모두 통과해야만 유효한 출력입니다:**

### 의상 일관성 및 고유성 검증
- [ ] 모든 씬의 outfit이 lockedOutfits/characters의 원본과 **글자 하나 틀림없이 동일**한가?
- [ ] "denim hot pants"를 "denim shorts"로 바꾸는 등 **동의어 치환을 하지 않았는가?**
- [ ] 의상 명칭을 축약하지 않았는가? (예: "Coral Ruched Off-shoulder tight-fitting long-sleeve Mini Dress" → "coral dress" ❌)
- [ ] **각 캐릭터가 서로 다른 고유한 의상을 입고 있는가?** (WomanA ≠ WomanB ≠ WomanD, ManA ≠ ManB ≠ ManC)
- [ ] lockedOutfits 객체에 **중복된 의상 값이 없는가?** (womanA와 womanB가 동일한 outfit 값 ❌)

### 캐릭터 순서 검증
- [ ] **characterSlot 순서와 Person 번호 순서가 정확히 일치**하는가?
  - characterSlot: "WomanA, WomanB" → Person 1 = WomanA, Person 2 = WomanB ✅
  - characterSlot: "WomanA, WomanB" → Person 1 = WomanB, Person 2 = WomanA ❌

### 투샷/쓰리샷 완전성 검증
- [ ] 모든 Person에 **identity + hair + body + wearing + outfit**이 전부 포함되어 있는가?
- [ ] body 정보를 생략하지 않았는가?
- [ ] 쓰리샷에서 3명 모두 개별적으로 상세 정보를 명시했는가?

### 씬 간 일관성 검증
- [ ] 같은 캐릭터가 모든 씬에서 **100% 동일한 identity/hair/body/outfit 문구**를 사용하는가?

### 개별 동작 검증 (투샷/쓰리샷)
- [ ] 각 Person 블록 안에 **개별 동작**이 명시되어 있는가?
- [ ] "walking together", "standing together" 같은 **공통 동작만 있지 않은가?**
- [ ] action 필드의 내용이 각 캐릭터에게 **다르게 분배**되어 있는가?

### 악세서리 위치 검증
- [ ] 모든 악세서리(scarf, gloves, earmuffs 등)가 **Person 블록 안**에 있는가?
- [ ] Person 블록 **밖**에 악세서리가 있으면 새 캐릭터로 오인됨!

## 대본 라인
{{SCRIPT_LINES}}

## 캐릭터 ID 목록 (의상 정보 포함)
{{CHARACTER_LINES}}
`

};


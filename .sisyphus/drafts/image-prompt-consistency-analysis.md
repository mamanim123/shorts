# Draft: ShortsLab AI Script Generation Image Prompt Consistency Analysis

## 📌 마마님 요청 사항 (Confirmed)
- 쇼츠랩 'AI 대본 생성' 버튼 사용 시, 대본과 함께 생성되는 이미지 프롬프트의 일관성이 뒤로 갈수록 떨어짐.
- 처음 씬부터 끝 씬까지 캐릭터와 이미지 스타일의 일관성을 완벽하게 유지하기 위한 로직 분석 및 개선 방안 요청.

## 🔍 분석 결과 (Research Findings)

### 1. `ai대본생성.txt` 분석 (현황)
- **프롬프트 템플릿**: 시스템 프롬프트에 캐릭터 설정(Identity, Hair, Body, Outfit)이 명시되어 있으며, "8개 모든 씬에서 identity/hair/body/outfit 문구 100% 동일"해야 한다는 **Strict Rule**이 포함되어 있음.
- **이미지 프롬프트 구성**: 씬 1(Hook)은 카메라 응시, 씬 2-8은 Candid Shot을 지향.
- **겨울 악세서리**: 씬마다 1-2개 배치하도록 되어 있으나, 수동 배치 방식이라 씬마다 종류가 달라질 수 있음.
- **문제 지점**: AI가 12씬에 달하는 방대한 JSON을 한 번에 생성하면서 컨텍스트 윈도우 뒤쪽으로 갈수록 앞서 정의한 '절대 규칙'을 망각하거나, 미묘하게 묘사 문구를 변형(의상 설명 요약, 바디 키워드 누락 등)하는 경향이 있음.

### 2. 코드 로직 분석 (`ShortsLabPanel.tsx` & `labPromptBuilder.ts`)
- **생성 방식**: `handleAiGenerate` 핸들러가 `buildLabScriptPrompt`를 통해 전체 시스템 프롬프트를 구성하고 AI에게 한 번에 요청함.
- **후처리 로직**: `postProcessAiScenes` 함수에서 `enforceKoreanIdentity`, `enhanceScenePrompt` 등을 호출하여 보정하지만, 현재는 AI가 생성한 `longPrompt`를 기반으로 "일부 치환"하는 방식에 가까움.
- **일관성 위협 요소**:
    - **겨울 모드 변환**: `applyWinterLookToExistingPrompt`가 씬마다 텍스트 치환 방식으로 작동하여, 원본 의상 명칭이 씬마다 다르게 변형될 위험이 있음.
    - **다인물 씬 (Two-shot/Three-shot)**: `[Person 1]`, `[Person 2]` 구분자가 누락되거나 캐릭터 정보가 섞일 수 있음.
    - **액세서리**: 캐릭터별 고정된 액세서리 세트가 아닌, 씬마다 랜덤하게 또는 AI 판단에 따라 배치되는 구조임.

## 🛠️ 기술적 개선 방안 (Technical Decisions)

### 1. **Canonical Character Master Map (캐릭터 마스터 맵) 도입**
- AI에게 대본 생성을 맡기기 전 또는 직후에, 각 캐릭터(WomanA, WomanB 등)에 대한 **고정된 프롬프트 조각(identity + hair + body + lockedOutfit + fixedAccessories)**을 'Master Data'로 확정.
- AI가 생성한 `longPrompt`의 내용을 그대로 쓰지 않고, 씬에 등장하는 캐릭터 ID를 감지하여 마스터 데이터에서 해당 조각을 **강제로 재조립(Injection)**하도록 로직 변경.

### 2. **POV(1인칭 시점) 및 샷 타입별 엄격한 템플릿 적용**
- AI가 생성한 결과물에서 샷 타입(One-shot, Two-shot, POV 등)을 감지.
- **POV 샷**: 시점 주인공을 프롬프트에서 완전히 제외하고 대상 캐릭터만 마스터 데이터로 삽입.
- **다인물 샷**: `[Person 1]`, `[Person 2]` 태그를 후처리 단계에서 강제로 삽입하여 캐릭터 혼동 방지.

### 3. **겨울 모드 및 액세서리 고정**
- 겨울 악세서리를 씬별로 결정하지 않고, **캐릭터별로 세션 시작 시 1회 고정(distributeUniqueWinterItems)**.
- 모든 씬에서 해당 캐릭터는 항상 동일한 악세서리를 착용하도록 마스터 프롬프트에 포함.

### 4. **시스템 프롬프트 강화 (One-Shot Example 최적화)**
- 시스템 프롬프트 내의 예시(JSON)를 더 명확하게 제공하여 AI가 형식을 벗어나지 않도록 유도.
- 특히 씬 번호와 대사가 길어질 때도 일관성을 유지해야 함을 강조하는 `STRICT_CONSISTENCY_CHECK` 지침 추가.

## 📝 향후 계획 (Next Steps)
- 위 개선안을 바탕으로 구체적인 `ShortsLabPanel.tsx` 및 `labPromptBuilder.ts` 수정 계획(Work Plan) 수립.
- 마마님의 승인 후 구현 진행.

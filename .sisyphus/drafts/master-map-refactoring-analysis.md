# Draft: ShortsLab Image Prompt Consistency - Master Map Refactoring Plan

## 📌 현재 로직 분석 (Current Logic Analysis)

### 1. 데이터 흐름 (Data Flow)
- **AI 생성 단계**: LLM이 `scriptBody`, `lockedOutfits`, `scenes`가 포함된 JSON 생성.
- **파싱 단계**: `ShortsLabPanel.tsx`에서 JSON 파싱 후 `scenes` 배열 추출.
- **후처리 단계 (`postProcessAiScenes`)**:
    - AI가 만든 `longPrompt`를 기반으로 `enhanceScenePrompt` 호출.
    - `enhanceScenePrompt`는 AI의 원문 텍스트에 표정/카메라 앵글/동작을 **문자열 앞에 덧붙이는(Prefixing)** 방식.
    - 이후 `validateAndFixPrompt`와 `applyAccessoriesToPrompt`를 통해 **일부 문자열 치환** 수행.

### 2. 일관성 붕괴 원인 (Root Cause of Inconsistency)
- **AI 원문 의존성**: AI가 생성한 `longPrompt` 후반부에서 캐릭터 묘사(예: 의상 명칭)가 변형되면, 후처리 로직이 이를 완벽하게 감지하고 고정된 명칭으로 되돌리지 못함.
- **파편화된 변환**: 겨울 모드 변환(`applyWinterLookToExistingPrompt`) 등이 씬마다 독립적으로 문자열 치환을 시도하여, 결과값이 미세하게 달라질 수 있음.
- **불완전한 캐릭터 맵**: `characterInfoMap`이 LLM의 `characters` 필드에 너무 의존적임.

---

## 🛠️ 개선 계획 (Refactoring Plan)

### 1. **Canonical Master Character Map (고정 캐릭터 마스터 맵) 구축**
- 모든 씬을 처리하기 전, **세션 전체에서 사용할 캐릭터 마스터 데이터**를 생성.
- `id` (WomanA, WomanB 등)를 키로 하며, 다음 정보를 포함:
    - `identity`, `hair`, `body`, `lockedOutfit`, `fixedAccessories`.
- **겨울 모드 변환을 마스터 데이터 생성 시 1회만 수행**: 모든 씬에서 동일한 "긴팔/오프숄더" 의상 문자열을 사용하도록 확정.

### 2. **"Patch" 방식에서 "Reconstruct" 방식으로 전환**
- `postProcessAiScenes` 로직을 다음과 같이 전면 개편:
    1. AI가 생성한 `longPrompt`에서 **캐릭터 묘사 부분은 과감히 버리고**, **배경(Background)**과 **동작(Action)** 정보만 추출.
    2. 씬의 `characterIds`를 기반으로 마스터 맵에서 해당 캐릭터의 **고정 프롬프트 블록**을 가져옴.
    3. **정해진 템플릿에 따라 프롬프트를 재조립**: `[Camera] + [Expression] + [Action] + [Master Character Block] + [Background]`.

### 3. **다인물 및 POV 샷 템플릿 강제 적용**
- **다인물 샷**: `[Person 1: {MasterA}] [Person 2: {MasterB}]` 구조를 강제하여 AI가 캐릭터를 혼동하지 않게 함.
- **POV 샷**: 마스터 맵에서 시점 주인공 정보를 제외하고 대상 캐릭터 정보만 주입하는 로직을 엔진 수준에서 처리.

### 4. **슬롯 매핑 안정화**
- AI가 `characterIds`를 누락한 경우, 내레이터 정보나 대본 텍스트 분석을 통해 슬롯을 강제로 할당하여 마스터 데이터가 반드시 주입되도록 보장.

---

## 📝 향후 계획 (Next Steps)
- `ShortsLabPanel.tsx` 내 `postProcessAiScenes` 함수 리팩토링.
- `labPromptBuilder.ts` 내 `enhanceScenePrompt`를 대체할 `reconstructScenePrompt` 함수 개발.
- 마마님께 최종 작업 계획(Work Plan) 보고 및 승인 후 구현.

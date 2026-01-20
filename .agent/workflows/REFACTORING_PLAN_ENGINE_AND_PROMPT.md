# 엔진 시스템 및 프롬프트 미리보기 구조 개선 계획

## 1. 문제 정의 (Current Problems)

### 1.1. 엔진 정체성의 혼란 (Identity Crisis)
- **현상**: UI에 표시되는 엔진 이름("럭셔리 엔진 V3"), 내부 ID(`V3`), 프롬프트 내 페르소나("Sherbet Comedy Maker"), 커스텀 엔진 제목("샤베트 설렘 반전 v2.1")이 모두 제각각임.
- **결과**: 사용자는 자신이 선택한 엔진이 정확히 어떤 프롬프트를 사용하는지 알 수 없으며, 디버깅 시 혼란을 초래함.

### 1.2. 프롬프트 미리보기의 불일치 (The "Lying" Preview)
- **현상**: `getFullPromptPreview` 함수와 `generateScript` 함수가 서로 다른 로직으로 프롬프트를 조립함.
- **결과**: 미리보기에서는 깔끔해 보였던 프롬프트가, 실제 생성 시에는 `specificInstructions` 등의 숨겨진 로직에 의해 오염되어 엉뚱한 결과물을 내놓음.

### 1.3. 커스텀 엔진의 불투명성 (Hidden Custom Engines)
- **현상**: 커스텀 엔진 데이터가 `engine_config.json`에 숨겨져 있고, 코드 상에서는 `CUSTOM_ID`로만 참조됨.
- **결과**: 어떤 커스텀 엔진이 로드되었는지, 그 내용은 무엇인지 코드 레벨에서 파악하기 어려움.

---

## 2. 개선 목표 (Objectives)

1.  **Single Source of Truth (SSOT)**: 프롬프트 생성 로직을 단 하나로 통일하여, 미리보기와 실제 생성이 100% 일치하게 함.
2.  **Explicit Engine Management**: 엔진 ID, 표시 이름, 내부 프롬프트 제목을 명확하게 매핑하고 일관성 있게 관리함.
3.  **Transparent Customization**: 커스텀 엔진의 내용을 투명하게 관리하고 UI에 반영함.

---

## 3. 실행 계획 (Action Plan)

### 3.1. 프롬프트 생성 로직 통합 (Refactoring Prompt Generation)
- **현재**: `generateScript`와 `getFullPromptPreview`가 각자 프롬프트를 조립.
- **개선**: `buildFinalPrompt(options)`라는 순수 함수(Pure Function)를 신설.
  - 이 함수는 `engineVersion`, `genre`, `topic`, `outfits` 등의 입력을 받아 **최종 프롬프트 문자열**을 반환.
  - `generateScript`는 이 함수를 호출하여 AI에게 전송.
  - `getFullPromptPreview`도 이 함수를 호출하여 화면에 표시.
  - **효과**: 미리보기와 실제 생성의 불일치 원천 차단.

### 3.2. 엔진 데이터 구조 정규화 (Normalizing Engine Data)
- **현재**: `constants.ts` (하드코딩), `enginePromptStore.ts` (설정), `engine_config.json` (커스텀)으로 분산.
- **개선**: `EngineDefinition` 인터페이스 정의 및 통합 관리.
  ```typescript
  interface EngineDefinition {
    id: string;          // 고유 ID (예: "V3", "CUSTOM_123")
    displayName: string; // UI 표시 이름 (예: "럭셔리 엔진 V3")
    systemPrompt: string; // 실제 프롬프트 내용
    isCustom: boolean;
  }
  ```
- `enginePromptStore.ts`에서 모든 엔진(기본+커스텀)을 이 형태로 로드하여 애플리케이션 전역에 공급.

### 3.3. 불필요한 "숨겨진 지침" 제거 (Removing Hidden Instructions)
- `generateScript` 내부에 하드코딩된 `specificInstructions` (장르별 지침, 시크릿 로맨스 지침 등)을 모두 제거.
- 모든 지침은 **엔진 프롬프트 자체** 또는 **사용자가 명시적으로 선택한 옵션**에 의해서만 추가되도록 변경.
- `buildFinalPrompt` 함수 내에서 이 로직을 투명하게 드러냄.

---

## 4. 단계별 작업 순서 (Step-by-Step)

1.  **Step 1**: `buildFinalPrompt` 함수 구현 (`services/promptBuilder.ts` 생성).
    - 기존 `generateScript`와 `getFullPromptPreview`의 로직을 분석하여 통합.
    - 의상 고정 로직(`outfitGuidanceBlock`)도 이 함수 내부로 이동.

2.  **Step 2**: `youtube-shorts-script-generator.tsx` 리팩토링.
    - `generateScript`에서 `buildFinalPrompt` 호출로 변경.
    - `getFullPromptPreview`에서 `buildFinalPrompt` 호출로 변경.

3.  **Step 3**: 엔진 이름 및 ID 매핑 점검.
    - `enginePromptStore.ts`를 수정하여 `engine_config.json`의 커스텀 엔진들이 올바른 메타데이터(이름 등)를 갖도록 보완.

4.  **Step 4**: 테스트 및 검증.
    - 미리보기 화면의 텍스트를 복사하여 실제 AI에게 보냈을 때 동일한 결과가 나오는지 확인.

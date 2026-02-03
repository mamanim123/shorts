# AI 대본 생성 로직 개선 및 캐릭터/앵글 일관성 확보 계획

## TL;DR

> **Quick Summary**: 캐릭터 의상 불일치 및 카메라 앵글 중복 문제를 해결하기 위해, 후처리 로직(`postProcessAiScenes`)에서 의상을 원본(`lockedOutfits`)으로 강제 고정하고, 카메라 앵글 결정 로직의 중복 호출을 제거하여 씬별 다양성을 확보합니다.
> 
> **Deliverables**:
> - `services/labPromptBuilder.ts` 로직 수정 (의상 보존, 앵글 결정 단일화)
> - `components/ShortsLabPanel.tsx` 캐릭터 데이터 전달 보강
> - `validateAndFixPrompt` 멀티샷 캐릭터 주입 강화
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - 순차적 로직 수정 필요
> **Critical Path**: 의상 보존 로직 수정 → 카메라 앵글 결정 단일화 → 프롬프트 템플릿 최적화

---

## Context

### Original Request
마마님께서 AI 대본 생성 시 다음과 같은 고질적인 문제를 보고하셨습니다:
1. 캐릭터 의상이 씬마다 바뀜 (일관성 부족).
2. 카메라 앵글이 거의 미들샷/클로즈업만 나옴 (다양성 부족).
3. 캐릭터 정립(Identity)이 약함.

### Interview Summary
**Key Discussions**:
- `ai대본생성.txt`(프롬프트)와 `받은대본.txt`(응답) 분석 결과, 프롬프트의 지시는 매우 상세하나 코드의 후처리 과정에서 규칙이 충돌하거나 데이터가 변형되는 지점 발견.
- 특히 겨울 룩 변환 과정에서 의상 명칭이 원본과 달라지는 문제와, 한 씬에서 카메라 앵글을 두 번 계산하여 히스토리가 빠르게 소모되는 문제 확인.

**Research Findings**:
- `convertToTightLongSleeveWithShoulderLine`이 의상 문자열을 직접 수정하여 `lockedOutfits`와의 100% 일치 규칙을 스스로 깨고 있음.
- `enhanceScenePrompt`가 `longPrompt`와 `shortPrompt` 생성 시 각각 `getSmartCameraPrompt`를 호출하여 앵글 히스토리를 2배로 소모함.
- "카메라 앵글 맨 앞" 규칙과 "장르별 표정 맨 앞" 규칙이 프롬프트 구성 시 충돌하여 앵글 키워드가 뒤로 밀리는 현상 발생.

---

## Work Objectives

### Core Objective
코드 레벨에서 의상 원본을 절대 보존하고, 카메라 앵글 결정을 씬당 1회로 고정하여 시각적 일관성과 다양성을 100% 확보합니다.

### Concrete Deliverables
- `services/labPromptBuilder.ts`: `enhanceScenePrompt`, `getSmartCameraPrompt`, `applyWinterLookToExistingPrompt` 수정.
- `components/ShortsLabPanel.tsx`: `postProcessAiScenes` 호출 시 캐릭터/의상 데이터 전달 로직 강화.

### Definition of Done
- [ ] 생성된 모든 씬의 `longPrompt`에서 각 캐릭터의 의상이 `lockedOutfits`와 토씨 하나 틀리지 않고 동일함.
- [ ] 8~12개 씬 생성 시 미들샷이 3회 이상 연속되지 않으며, 와이드/클로즈업/POV/드론샷이 골고루 섞임.
- [ ] 투샷/쓰리샷에서 모든 캐릭터의 `identity`, `hair`, `body`, `wearing outfit` 정보가 개별적으로 완벽히 주입됨.

### Must Have
- 의상 원본 문자열 보존 (겨울 악세서리는 뒤에 추가하는 방식).
- 카메라 앵글 결정 단일화 (한 씬 = 한 앵글).
- 카메라 앵글 키워드 최우선 배치 (프롬프트 맨 앞).

### Must NOT Have (Guardrails)
- `lockedOutfits`에 정의된 의상 명칭을 AI가 마음대로 요약하거나 변형하게 두지 않음.
- 미들샷(Medium Shot)만 연속적으로 배치되는 "앵글 쏠림" 현상 금지.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: None (수동 검증 및 로그 확인 위주)

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: 의상 일관성 및 카메라 앵글 다양성 검증
  Tool: Bash (node)
  Preconditions: 서버 가동 중, `ai대본생성.txt` 템플릿 존재
  Steps:
    1. AI 대본 생성 버튼 실행 (Gemini/Claude 서비스 이용)
    2. 생성된 JSON 결과에서 `lockedOutfits`와 각 씬의 `longPrompt` 내 의상 명칭 비교
    3. `longPrompt` 맨 앞의 카메라 앵글 키워드 추출하여 8~12씬 간 중복 및 분포 확인
    4. 투샷/쓰리샷 장면에서 `[Person 1]`, `[Person 2]` 구분 및 캐릭터 정보 주입 여부 확인
  Expected Result: 의상 명칭 100% 일치, 앵글 3회 이상 연속 중복 없음, 멀티샷 캐릭터 정보 완벽 주입
  Evidence: `.sisyphus/evidence/script_gen_verification.txt`

---

## TODOs

- [ ] 1. `services/labPromptBuilder.ts` 카메라 앵글 로직 수정

  **What to do**:
  - `getSmartCameraPrompt`가 호출될 때마다 히스토리를 소모하지 않고, 결정된 앵글을 반환하는 순수 함수 또는 씬 번호 기반 결정 방식으로 변경.
  - `enhanceScenePrompt` 내에서 앵글 키워드가 **반드시** 프롬프트의 가장 앞에 위치하도록 순서 조정. (표정 키워드는 앵글 뒤로 이동)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: 프롬프트 구성 순서와 앵글 히스토리 관리 로직의 정밀한 수정이 필요함.

  **Acceptance Criteria**:
  - [ ] `longPrompt`와 `shortPrompt`의 카메라 앵글이 동일함.
  - [ ] 프롬프트 문자열이 카메라 앵글 키워드(예: close-up portrait shot)로 시작함.

- [ ] 2. 의상 보존 및 겨울 룩 적용 방식 변경

  **What to do**:
  - `convertToTightLongSleeveWithShoulderLine`이 의상 본문을 수정하지 않고, `lockedOutfits`는 그대로 두되 프롬프트 결합 시에만 부가 정보를 붙이도록 변경.
  - `applyWinterLookToExistingPrompt`에서 의상 치환 로직을 제거하고, `lockedOutfits`의 원본 명칭 뒤에 `, accessorized with [winter items]`를 붙이는 방식으로 통일.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: 의상 일관성 규칙을 보존하면서 겨울 테마를 적용하는 정교한 문자열 처리가 필요함.

  **Acceptance Criteria**:
  - [ ] `lockedOutfits`의 문자열이 씬 프롬프트 내에서 변형 없이(예: (Tight-fitting...) 추가 없이) 그대로 포함됨.

- [ ] 3. `components/ShortsLabPanel.tsx` 및 `postProcessAiScenes` 데이터 연동 강화

  **What to do**:
  - `postProcessAiScenes` 호출 시 `characters` 맵과 `lockedOutfits`를 명시적으로 전달하여, LLM 응답이 부실하더라도 코드가 강제로 캐릭터 정보를 주입하도록 보강.
  - `validateAndFixPrompt`에서 캐릭터 정보가 누락된 멀티샷을 발견하면 `CharacterInfoMap`을 참조하여 자동으로 복구하는 로직 추가.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: React 컴포넌트와 서비스 간의 데이터 흐름 및 후처리 파이프라인 강화.

  **Acceptance Criteria**:
  - [ ] LLM이 캐릭터 정보를 일부 누락하더라도 최종 프롬프트에는 `identity/hair/body/outfit`이 모두 포함됨.

- [ ] 4. 프롬프트 템플릿 (`ai대본생성.txt` 기반 소스) 최적화

  **What to do**:
  - `labPromptBuilder.ts` 내의 프롬프트 생성 텍스트에서 중복되거나 혼선을 주는 지시문 정리.
  - "의상은 절대 변형 금지"와 "카메라 앵글 우선순위"를 JSON 스키마 예시 바로 앞에 배치하여 LLM의 순응도 극대화.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: LLM이 이해하기 쉬운 명확하고 일관된 지시문 작성.

  **Acceptance Criteria**:
  - [ ] `ai대본생성.txt` 내용과 실제 생성 프롬프트의 일관성 확인.

---

## Success Criteria

### Verification Commands
```bash
# 로직 수정 후 테스트 스크립트 실행 (있을 경우)
npm run test:lab  # (가정)
```

### Final Checklist
- [ ] 마마님께서 보신 `ai대본생성.txt`와 실제 생성되는 프롬프트가 일치하는가?
- [ ] 의상 명칭이 모든 씬에서 원본(`lockedOutfits`)과 100% 동일한가?
- [ ] 카메라 앵글이 씬마다 다양하게 결정되고 프롬프트 맨 앞에 위치하는가?
- [ ] 캐릭터 정체성 정보가 모든 씬(특히 멀티샷)에 누락 없이 주입되는가?

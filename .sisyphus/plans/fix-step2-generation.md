# 2단계 생성 로직 종합 수정 (V3)

## TL;DR

> **Quick Summary**: 2단계 생성(handleTwoStepGenerate)의 의상/악세서리 일관성 문제, POV 샷 검증 부재, 카메라 앵글 로직 오류를 수정하여 이미지 프롬프트 품질을 대폭 개선한다.
> 
> **Deliverables**:
> - 의상 정보가 LLM 씬 분해 전에 할당되어 일관성 100% 보장 (기존 패턴 재사용)
> - 악세서리 중복 삽입 방지 (LLM 단계 데이터 제외 + 후처리 단일 관리)
> - POV 샷 규칙 위반 자동 검증 및 교정 (기존 함수 handleTwoStepGenerate에 통합)
> - 카메라 앵글 로직 수정 (LLM 응답 신뢰 및 회전 로직 버그 수정)
> 
> **Estimated Effort**: Medium (2-3시간)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 3 → Task 4

---

## Context

### Original Request
마마님께서 `2단계생성.txt` 분석을 통해 발견된 문제점들을 모두 해결해달라고 요청하셨습니다:
1. 캐릭터 의상 정보가 LLM에게 전달되지 않음
2. 의상 일관성 미보장 (LLM 생성 vs 후처리 할당 불일치)
3. POV 샷 규칙 검증 없음 (시점 주인공이 프롬프트에 포함됨)
4. 카메라 앵글 로직 중복 및 오류 (미디엄샷 편향)
5. 겨울 악세서리 중복 적용

### Momus Feedback (V2)
- **악세서리 논리**: `enableWinterAccessories: false`와 별개로 `winterAccessories` 데이터가 있으면 LLM 프롬프트에 포함되어 중복을 유도함. LLM 단계에서는 데이터를 비워야 함.
- **카메라 판정**: "유효한 앵글"에 대한 코드 레벨 기준(medium 제외 등) 명시 필요.
- **POV 트리거**: `scene.cameraAngle`뿐만 아니라 시스템이 만든 `cameraPrompt`도 트리거로 고려해야 함.
- **패턴 참조**: `handleManualSceneRegeneration` (L2116-2128)의 선할당 패턴을 참조하여 리스크 최소화.

---

## Work Objectives

### Core Objective
2단계 생성 파이프라인에서 캐릭터 정보(의상, 헤어, 체형, 악세서리)가 일관되게 유지되도록 로직을 수정하고, 카메라 연출의 다양성을 보장한다.

### Concrete Deliverables
- `ShortsLabPanel.tsx`: `handleTwoStepGenerate` 내 캐릭터 정보 선할당 로직 구현 (L2116 패턴 적용)
- `ShortsLabPanel.tsx`: `newScenes` 루프 내 `validateAndFixPOVShot` 호출 통합 (트리거: `scene.cameraAngle || cameraPrompt`)
- `ShortsLabPanel.tsx`: `pickCameraPrompt` 버그 수정 (회전 시 결과값 반환 강제)
- `ShortsLabPanel.tsx`: 카메라 앵글 후처리 로직을 "LLM 응답이 무효(medium 등)할 때만" 실행하도록 변경

### Definition of Done
- [ ] `npm run dev` 실행 시 에러 없이 빌드됨
- [ ] 2단계 생성 시 모든 씬에서 동일한 캐릭터 의상 유지 확인
- [ ] POV 샷에서 시점 주인공(WomanA 등)이 프롬프트에서 자동 제거됨 확인
- [ ] 악세서리가 `accessorized with` 문구 중복 없이 한 번만 적용됨 확인
- [ ] 카메라 앵글이 LLM 응답을 우선하되, 'medium' 일변도일 경우 시스템이 교정함 확인

### Must Have
- 의상 정보가 `buildManualSceneDecompositionPrompt`에 전달됨
- POV 샷 시점 캐릭터 제거 로직 작동
- 악세서리 중복 방지 (LLM에게는 악세서리 데이터를 주지 않음)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual-only

### Manual QA Procedures
1. `npm run dev` 실행하여 빌드 확인.
2. 쇼츠랩 "2단계 생성" 실행.
3. DevTools 콘솔 로그(`[POV Validation]`, `[Camera Angle]`) 확인.

---

## TODOs

- [ ] 1. 캐릭터 정보 선할당 로직 구현 (handleTwoStepGenerate)

  **What to do**:
  - `handleTwoStepGenerate` (L3044) 내에서 캐릭터 추출 응답 파싱 직후(L3155 부근) `buildAutoCharacterMap`을 호출하여 `preCharacterMap`을 생성한다.
  - `characterList` 생성 시 `components/ShortsLabPanel.tsx:2116-2128`의 패턴을 그대로 따라 `identity`, `hair`, `body`, `outfit` 정보를 채운다.
  - **주의**: 이 단계의 `characterList`에는 `winterAccessories` 필드를 명시적으로 **포함하지 않거나 빈 배열**로 전달하여 LLM이 악세서리 문구를 생성하지 못하게 차단한다.
  - `buildManualSceneDecompositionPrompt` (L3171) 호출 시 이 `characterList`를 전달한다.

  **References**:
  - `components/ShortsLabPanel.tsx:2116-2128` - (패턴 참조) 씬 재생성 시의 선할당 로직
  - `services/manualSceneBuilder.ts:134-152` - 캐릭터 정보를 프롬프트에 포맷팅하는 로직

  **Acceptance Criteria**:
  - [ ] 콘솔 로그 `[ShortsLab] Pre-assigned character list with outfits` 출력 확인.
  - [ ] LLM 전달 프롬프트에 의상 정보는 포함되고 악세서리 정보는 제외됨 확인.

- [ ] 2. 악세서리 중복 방지 (후처리 단일 관리)

  **What to do**:
  - `handleTwoStepGenerate`의 후처리 루프(`newScenes.map`) 이전에, Task 1에서 생성한 `preCharacterMap`을 기반으로 `autoCharacterMap`을 구성한다.
  - `enableWinterAccessories`가 true인 경우에만 `buildWinterAccessoryMap`을 통해 악세서리를 `autoCharacterMap`에 주입한다 (기존 L3249-3265 로직 이동 및 정렬).
  - 결과적으로 LLM은 악세서리를 모르고, `composeManualPrompt`가 후처리 시점에만 악세서리를 주입하여 중복을 원천 봉쇄한다.

  **Acceptance Criteria**:
  - [ ] 생성된 프롬프트에 `accessorized with` 문구가 캐릭터당 최대 1회만 존재함 확인.

- [ ] 3. POV 검증 함수 통합 (트리거 보강)

  **What to do**:
  - `newScenes = scenesSource.map` 루프(L3271) 내에서 `composeManualPrompt` 호출 직후 `validateAndFixPOVShot`을 호출한다.
  - **트리거 고정**: `scene.cameraAngle || cameraPrompt`를 검사하여 POV 키워드가 포함된 경우에만 실행한다.
  - 인자로 `normalizedPrompt`, `effectiveAngle`, `sceneCharacterIds`, `autoCharacterMap`을 전달한다.

  **Acceptance Criteria**:
  - [ ] POV 샷 씬에서 시점 주인공 블록 제거 및 콘솔 로그 `[POV Validation]` 확인.

- [ ] 4. 카메라 앵글 로직 버그 수정 및 판정 기준 적용

  **What to do**:
  - `pickCameraPrompt` (L357) 수정: `shouldRotate`가 `true`일 때 `CAMERA_PROMPT_FALLBACKS[keyword] || basePrompt`를 반환하도록 수정 (기존 버그: rotation 후에도 basePrompt 반환).
  - `handleTwoStepGenerate` 루프 내 판정 로직:
    - `const effectiveAngle = detectCameraKeyword(scene.cameraAngle || '')`
    - `effectiveAngle`이 존재하고 `medium`이 아닐 경우 `pickCameraPrompt`를 건너뛰고 `scene.cameraAngle`을 그대로 사용한다.
    - 그 외의 경우(무효하거나 medium인 경우)에만 시스템 교정(rotate)을 실행한다.
    - 로그 출력: `[Camera Angle] Using LLM: ${angle}` 또는 `[Camera Angle] Rotating: ${newAngle}`.

  **Acceptance Criteria**:
  - [ ] LLM이 준 특수 앵글(wide, low-angle 등)은 유지되고, boring한 씬만 교정됨 확인.

---

## Success Criteria

### Final Checklist
- [ ] 의상 일관성 보장 (L2116 패턴)
- [ ] 악세서리 중복 제거 (LLM 비노출)
- [ ] POV 시점 주인공 제거 (트리거 보강)
- [ ] 카메라 앵글 버그 수정 및 판정 기준 명확화

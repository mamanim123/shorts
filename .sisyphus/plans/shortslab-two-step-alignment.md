# ShortsLab Two-Step Alignment

## Context

### Original Request
쇼츠랩 입력 탭의 AI 대본 생성과 2단계 생성 버튼 로직을 비교 분석해, 2단계에서도 여성 고정문구/의상/헤어/악세서리/한국 국적을 모든 씬에 고정하고 대본과 맞는 이미지 프롬프트, 자연스러운 표정/동작(캔디드 느낌), 다양한 카메라 앵글이 나오도록 정렬한다.

### Interview Summary
**Key Discussions**:
- 2단계 생성은 대본 생성 → 캐릭터 추출 → 씬 분해로 이어지며 LLM `longPrompt` 우선 사용으로 고정문구 누락 가능성이 높다.
- AI 대본 생성은 `composeManualPrompt` 기반으로 고정문구/캐릭터 설정을 강제 주입한다.
- 마마님이 원하는 방향은 2단계도 AI 대본 생성과 동일하게 고정문구/캐릭터 설정을 강제 적용하는 것.

**Research Findings**:
- AI 대본 생성 경로는 `handleManualSceneGeneration`에서 `buildManualAiPrompt` → `parseManualSceneDecompositionResponse` → `composeManualPrompt`를 사용한다. (`components/ShortsLabPanel.tsx:1704`)
- 2단계 생성 경로는 `handleTwoStepGenerate`에서 `buildLabScriptOnlyPrompt` → `buildCharacterExtractionPrompt` → `buildManualSceneDecompositionPrompt`를 사용한다. (`components/ShortsLabPanel.tsx:2492`, `services/labPromptBuilder.ts:351`, `services/manualSceneBuilder.ts:40`, `services/manualSceneBuilder.ts:106`)
- 2단계는 `scene.longPrompt`를 우선 사용하며 캐릭터 ID 정규화 실패 시 캐릭터 맵이 비어서 고정문구 주입이 불가능해질 수 있다. (`components/ShortsLabPanel.tsx:2695`)

### Metis Review
**Identified Gaps (addressed)**:
- 2단계의 의도된 차별점이 무엇인지 확인 필요 → 계획에 결정 항목으로 반영.
- fixed phrase와 LLM longPrompt 충돌 시 우선순위 필요 → 결정 항목으로 반영.
- 캐릭터 ID 정규화 규칙 정의 필요 → 결정 항목으로 반영.
- 다양성(표정/포즈/카메라) 기준 수치화 필요 → 결정 항목으로 반영.

---

## Work Objectives

### Core Objective
2단계 생성의 프롬프트 생성/후처리 파이프라인을 AI 대본 생성과 동일한 고정문구/캐릭터 설정 강제 규칙으로 정렬해, 모든 씬에 일관된 캐릭터 디스크립터와 대본 연동 프롬프트, 다양성 있는 표정/카메라 앵글을 보장한다.

### Concrete Deliverables
- 2단계 생성 로직에서 고정문구/캐릭터 설정 강제 적용 규칙 정렬
- 캐릭터 ID 정규화 및 fallback 로직 정의
- 표정/포즈/카메라 다양성 규칙의 로컬 강제 적용 설계
- AI 대본 생성 경로와의 동작 비교/회귀 체크 절차

### Definition of Done
- [ ] 2단계 생성 결과의 모든 씬에 고정문구/캐릭터 디스크립터가 포함됨
- [ ] 동일 입력에서 2단계와 AI 대본 생성의 고정문구 적용 방식이 일치함
- [ ] 대본 라인 핵심 키워드(명사/동사 1~2개)의 영어 대응어가 프롬프트에 포함되는 비율이 70% 이상(동일 입력 3회 기준)
- [ ] 표정/카메라 앵글 다양성이 최소 기준을 충족함(정의된 규칙)

### Must Have
- 고정문구(여성 디스크립터/의상/헤어/악세서리/한국 국적) 모든 여성 캐릭터에 강제 적용
- 겨울 악세서리 활성화 시에도 동일하게 적용
- 남성 캐릭터는 최대 2명 슬롯으로 제한
- AI 대본 생성 경로 동작 불변

### Must NOT Have (Guardrails)
- UI 레이아웃 변경 또는 새 기능 추가
- API 계약 변경(`/api/generate/raw` 등)
- 외부 의존성 추가

### Decisions Resolved
- fixed phrases가 항상 우선(LLM longPrompt는 참고 재료로만 사용)
- 캐릭터 ID는 공통 라벨을 슬롯으로 매핑(예: 주인공/나/character_1 → WomanA/ManA)
- 다양성 기준은 연속 씬 동일 표정/카메라 금지
- 한국 여성 디스크립터는 여성 슬롯에만 적용, 모든 여성 캐릭터에 강제

### Normalization & Enforcement Specs
- **정규화 위치**: 2단계 전용 후처리(`handleTwoStepGenerate`의 `sceneCharacterIds` 계산 직후). `parseManualSceneDecompositionResponse`는 수정하지 않는다(1단계 경로 영향 방지).
- **ID 정규화 규칙**:
  - 공백/언더스코어 제거 후 대소문자 무시 비교(`Woman A` → `WomanA`, `woman_a` → `WomanA`).
  - 키워드 매핑: `주인공|나|내가|narrator|protagonist|character1|character_1` → 기본 성별 기준 슬롯(`settings.koreanGender`가 female이면 `WomanA`, male이면 `ManA`).
  - 여성 캐릭터는 등장 순서대로 `WomanA → WomanB → WomanC → WomanD` 배정.
  - 캐디(`caddy`)가 감지되면 `WomanD`를 우선 배정하고, `WomanD`가 이미 사용 중이면 추가 여성은 `WomanC`로 병합한다.
  - 남성 캐릭터는 등장 순서대로 `ManA → ManB` 배정하고, 3명 이상은 `ManB`로 병합.
  - 정규화 실패/빈 배열은 `['WomanA']`로 폴백(여성 고정문구 누락 방지).
- **longPrompt 사용 규칙**:
  - longPrompt에서 아래 패턴을 제거한다:
    - `^Scene\s+\d+[.,]?\s*` (Scene 프리픽스)
    - `PROMPT_CONSTANTS.START` 및 `PROMPT_CONSTANTS.END`의 리터럴 문자열
    - `Slot\s+[^:]+:` 블록(슬롯 식별 텍스트)
  - cameraAngle이 이미 포함된 경우 중복 카메라 문구는 제거한다(대소문자 무시 substring 비교).
  - narrativeParts 구성: `summary/action/background`를 우선, longPrompt는 마지막에 “추가 묘사”로 결합하며 중복 키워드를 제거한다.
  - 최종 프롬프트는 항상 `composeManualPrompt`로 감싸 고정문구를 강제 주입.
- **겨울 악세서리 적용 순서**:
  - `validateAndFixPrompt` 이후 `applyWinterLookToExistingPrompt` 적용 → 그 다음 `applyAccessoriesToPrompt` 적용.
  - 성별 결정: 씬에 여성 슬롯이 포함되면 female, 아니면 male.
- **다양성 강제 규칙**:
  - 연속 씬(바로 이전 씬)과 동일한 표현/카메라는 금지.
  - 카메라 중복 판정은 앵글 키워드( close-up, medium, wide, canted, OTS, POV, low-angle, high-angle ) 기준으로 한다.
  - 표정 중복 판정은 `[expression]` 블록의 핵심 키워드(대소문자 무시) 기준으로 한다.
  - 카메라 중복 시 공통 앵글 목록에서 다음 항목으로 순환.
  - 표정 중복 시 후보 목록에서 다음 항목으로 순환, 후보가 없으면 `candid, off-guard` 키워드를 추가.

### Implementation Integration Notes
- **슬롯 리스트/캐릭터맵 결합 지점**:
  - `buildCharacterSlotMapping`에서 여성 슬롯을 `WomanA~WomanD`까지 확장하고, 4번째 여성부터 `WomanD`를 배정한다. 캐디가 있을 경우 `WomanD` 우선 배정 후 추가 여성은 `WomanC`로 병합한다. (`components/ShortsLabPanel.tsx:351`)
  - 2단계에서 `slotMap`/`lineCharacterMap` 생성 후 `allSlotIds`를 확정하는 구간(`components/ShortsLabPanel.tsx:2599` 이후)에 정규화된 성별별 슬롯 리스트를 반영한다.
  - 남성은 `ManA/ManB`까지만 포함하고, 초과 남성은 `ManB`로 병합한다.
  - `characterList`와 `autoCharacterMap`은 확정된 `allSlotIds`를 기준으로 생성한다.
- **longPrompt 병합 알고리즘(구체화)**:
  - longPrompt에서 `^Scene\s+\d+[.,]?\s*`, `PROMPT_CONSTANTS.START/END`, `Slot\s+[^:]+:` 패턴을 제거한다.
  - cameraAngle 중복은 앵글 키워드 기준(대소문자 무시 substring 비교)으로 제거한다.
  - narrativeParts 구성: `summary/action/background`를 우선, longPrompt는 마지막에 “추가 묘사”로 결합하며 중복 키워드를 제거한다.
  - 최종 프롬프트는 항상 `composeManualPrompt`로 감싸 고정문구를 강제한다.
- **표정/카메라 데이터 소스**:
  - 표정 후보: `getExpressionKeywordMap()` 결과가 배열이면 그대로 사용, 문자열이면 배열로 래핑 후 기본 후보를 뒤에 합친다.
  - 카메라 후보: 로컬 기본 앵글 리스트( close-up, medium, wide, canted, OTS, POV, low-angle, high-angle )를 선언해 순환한다.
  - 순환 인덱스는 `sceneIndex` 기반으로 결정해 재현성을 보장한다.
- **겨울 악세서리 중복 방지**:
  - `applyWinterLookToExistingPrompt`로 겨울 룩을 적용할 경우, `autoCharacterMap`의 악세서리 목록에서 겨울 아이템을 제거한 뒤 `applyAccessoriesToPrompt`를 적용해 중복을 방지한다.
- **AI 대본 생성 불변 검증 기준**:
  - 베이스라인 프롬프트(씬 1~3)와 동일 입력의 결과를 비교해, 고정문구 블록과 캐릭터 디스크립터 포함 여부가 유지되는지 확인한다.
  - 비교 기준은 전체 텍스트 diff가 아니라, 필수 토큰 존재 여부(고정문구 블록, 여성 슬롯별 디스크립터, camera/expression)로 판정한다.

---

## Verification Strategy (Manual QA Only)

### Test Decision
- **Infrastructure exists**: NO (package.json에 테스트 스크립트 없음)
- **User wants tests**: NO (수동 검증)
- **Framework**: none

### Manual QA Coverage
- **Frontend/UI**: Playwright 또는 브라우저 수동 검증
- **Evidence**: 네트워크 payload, 생성된 프롬프트 샘플, 프리뷰 탭 스크린샷

---

## Task Flow

```
Baseline capture → Prompt composition alignment → Character normalization → Diversity enforcement → Regression verification
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 2, 3 | 공유 유틸 로직 설계와 정규화 로직 설계는 병행 가능 |

| Task | Depends On | Reason |
|------|------------|--------|
| 4 | 2, 3 | 정규화 및 고정문구 정렬 이후 다양성 규칙 적용 |

---

## TODOs

- [ ] 1. 현행 2단계/AI 대본 생성 결과 비교 기준 정의 및 베이스라인 캡처

  **What to do**:
  - 동일 입력(주제/겨울 악세서리 활성화)으로 AI 대본 생성과 2단계 생성 수행
  - 네트워크 payload(`POST /api/generate/raw`)에서 `prompt/service/temperature/maxTokens`를 캡처
  - 고정문구/국적/표정/카메라 앵글 포함 여부 체크리스트 작성
  - 베이스라인은 씬 1~3 프롬프트 원문을 저장해 비교 기준으로 사용
  - 증거 포맷: 씬 번호, final prompt, 고정문구 포함 여부, 여성 슬롯별 디스크립터 포함 여부, cameraAngle/expression, longPrompt 존재 여부, expected keywords(EN)
  - expected keywords(EN)는 각 스크립트 라인에서 핵심 명사/동사 1~2개를 영어로 번역해 기록

  **Must NOT do**:
  - 기존 결과 파일 삭제

  **Parallelizable**: YES (with 2)

  **References**:
  - `components/ShortsLabPanel.tsx:1704` - AI 대본 생성 흐름 진입점
  - `components/ShortsLabPanel.tsx:2492` - 2단계 생성 흐름 진입점

  **Acceptance Criteria**:
  - [ ] 동일 입력으로 두 버튼 실행 후 프롬프트 차이 비교 자료 확보
  - [ ] 프롬프트에 고정문구 포함 여부 체크리스트 작성
  - [ ] 씬 1~3 프롬프트 원문이 비교용으로 저장됨
  - [ ] 증거 포맷 기준으로 `.sisyphus/evidence/shortslab-two-step-baseline.md` 저장

  **Manual Execution Verification**:
  - [ ] `npm run dev` 실행
  - [ ] 브라우저에서 쇼츠랩 입력 탭 열기
  - [ ] 겨울 악세서리 활성화 후 AI 대본 생성/2단계 생성 각각 실행
  - [ ] DevTools Network에서 `/api/generate/raw` 요청을 열어 Request Payload 저장
  - [ ] 프리뷰 탭의 프롬프트 텍스트 샘플 캡처

- [ ] 2. 2단계 생성의 프롬프트 합성 경로를 AI 대본 생성 방식으로 정렬

  **What to do**:
  - 2단계에서도 `composeManualPrompt` 기반으로 고정문구/캐릭터 설정을 강제 주입하도록 로직 정렬
  - `scene.longPrompt`는 `summary/action/background` 보강 재료로만 사용하고 최종 프롬프트는 로컬에서 합성
  - 겨울 악세서리 적용 순서를 `validateAndFixPrompt` 이후로 고정하고 `applyAccessoriesToPrompt`는 마지막에 적용
  - longPrompt 정리(프리픽스/Slot 블록/중복 카메라 제거) 후 narrativeParts에 합치기

  **Must NOT do**:
  - AI 대본 생성 로직의 동작 변경

  **Parallelizable**: YES (with 3)

  **References**:
  - `components/ShortsLabPanel.tsx:1636` - `composeManualPrompt` 적용 방식
  - `components/ShortsLabPanel.tsx:1762` - AI 대본 생성의 프롬프트 합성 흐름
  - `components/ShortsLabPanel.tsx:2695` - 2단계의 `scene.longPrompt` 우선 경로

  **Acceptance Criteria**:
  - [ ] 2단계 생성 결과 프롬프트에 고정문구/캐릭터 설정 블록이 항상 포함됨
  - [ ] `scene.longPrompt` 유무와 무관하게 동일한 고정문구 블록이 적용됨

  **Manual Execution Verification**:
  - [ ] 2단계 실행 결과 프롬프트에 고정문구 블록 포함 여부 확인

- [ ] 3. 캐릭터 ID 정규화 및 fallback 규칙 정의

  **What to do**:
  - LLM이 반환하는 `characterIds` 형식에 대한 정규화 규칙을 정의(공통 라벨 → 슬롯 매핑)
  - 정규화 실패/빈 배열 시 `['WomanA']` 폴백 고정
  - 여성 캐릭터가 여러 명일 때도 모든 여성 슬롯에 고정문구가 적용되도록 캐릭터 맵 보장
  - 남성 캐릭터는 최대 2 슬롯으로 제한하고 초과 시 `ManB`로 병합
  - `allSlotIds` 확정 시점에 정규화 결과를 반영해 `characterList/autoCharacterMap`을 재구성
  - 정규화 대상은 `lineSlots`와 `scene.characterIds` 모두이며, 최종 `sceneCharacterIds` 결정 전에 일괄 적용

  **Must NOT do**:
  - 캐릭터 슬롯 enum 변경(기존 슬롯 유지)

  **Parallelizable**: YES (with 2)

  **References**:
  - `components/ShortsLabPanel.tsx:351` - `buildCharacterSlotMapping` 슬롯 배정 규칙
  - `components/ShortsLabPanel.tsx:2599` - `slotMap`/`lineCharacterMap` 생성 지점
  - `components/ShortsLabPanel.tsx:2651` - 2단계 캐릭터 맵 생성

  **Acceptance Criteria**:
  - [ ] 모든 씬에서 캐릭터 맵이 비어있지 않음
  - [ ] 모든 여성 슬롯에 고정문구가 적용됨
  - [ ] 남성 슬롯이 2명 이내로 제한됨
  - [ ] 정규화 규칙 문서화 및 적용

  **Manual Execution Verification**:
  - [ ] 2단계 실행 결과에서 캐릭터 ID/슬롯 매핑 확인

- [ ] 4. 표정/포즈/카메라 앵글 다양성 강제 규칙 적용

  **What to do**:
  - `getExpressionForScene`, `getCameraPromptForScene`, `enforceShotTypeMix`와 함께 로컬 강제 규칙 정리
  - 연속 씬 중복 시 카메라/표정을 순환 목록으로 교체하는 알고리즘 정의
  - 후보가 없을 때 `candid, off-guard` 키워드를 추가해 자연스러운 연출 보장
  - 표현/카메라 후보 목록 데이터 소스를 명확히 지정(규칙 파일 또는 기본 목록)

  **Must NOT do**:
  - LLM 프롬프트 템플릿 구조 변경(현재 프롬프트 스키마 유지)

  **Parallelizable**: NO (depends on 2, 3)

  **References**:
  - `services/labPromptBuilder.ts:412` - 스토리 단계 매핑/표정 키워드
  - `components/ShortsLabPanel.tsx:2666` - 2단계의 표정/카메라 선택 흐름
  - `components/ShortsLabPanel.tsx:2665` - `enforceShotTypeMix` 사용

  **Acceptance Criteria**:
  - [ ] 동일 표정/카메라가 연속되지 않도록 최소 기준 충족(연속 씬 반복 금지)
  - [ ] 캔디드 연출 키워드가 규칙에 따라 주입됨

  **Manual Execution Verification**:
  - [ ] 프리뷰 탭에서 연속 씬의 표정/카메라 앵글 다양성 확인

- [ ] 5. 회귀 검증 및 결과 확인

  **What to do**:
  - AI 대본 생성 경로 동작 불변 확인
  - 2단계 생성 결과가 고정문구/캐릭터 설정/대본 연동을 충족하는지 확인

  **Must NOT do**:
  - 기존 저장 파일/히스토리 삭제

  **Parallelizable**: NO (depends on 2, 3, 4)

  **References**:
  - `components/ShortsLabPanel.tsx:1704` - AI 대본 생성 경로
  - `components/ShortsLabPanel.tsx:2492` - 2단계 생성 경로

  **Acceptance Criteria**:
  - [ ] AI 대본 생성 씬 1~3 프롬프트에 `PROMPT_CONSTANTS.START/END` 블록과 `Slot Woman` 디스크립터가 모두 포함됨
  - [ ] 2단계 생성 씬 1~3 프롬프트에 `PROMPT_CONSTANTS.START/END` 블록과 모든 여성 슬롯 디스크립터가 포함됨
  - [ ] 2단계 생성에서 연속 씬의 cameraAngle 키워드가 동일하지 않음(앵글 키워드 기준)
  - [ ] 2단계 생성에서 연속 씬의 expression 키워드가 동일하지 않음(`[expression]` 키워드 기준)
  - [ ] 베이스라인 증거 파일의 expected keywords(EN) 기준으로, 씬별 최소 1개 키워드가 프롬프트에 포함됨(전체 씬의 70% 이상)

  **Manual Execution Verification**:
  - [ ] 동일 입력으로 AI 대본 생성/2단계 생성 결과 비교

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2-4 | `fix: align two-step prompt pipeline` | components/services touched | manual QA checklist |

---

## Success Criteria

### Verification Commands
```bash
npm run dev
```

### Final Checklist
- [ ] 2단계 생성에서 고정문구/캐릭터 설정이 모든 씬에 적용됨
- [ ] 겨울 악세서리 활성화 시에도 동일 규칙 적용
- [ ] 대본과 무관한 이미지 프롬프트 비중이 감소함(수동 검증)
- [ ] 표정/카메라 앵글 다양성 기준 충족
- [ ] AI 대본 생성 경로 불변 확인

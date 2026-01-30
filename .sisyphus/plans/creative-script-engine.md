# 쇼츠대본 생성 엔진 창의성 강화 및 로직 고도화

## TL;DR

> **Quick Summary**: AI의 정형화된 패턴(예시 복제 등)을 타파하고, 주제와 힌트의 개연성을 확보하며, 배경 변화에 따른 의상 자동 동기화 기능을 구현하여 4060 타겟 쇼츠의 품질을 극대화합니다.
> 
> **Deliverables**:
> - `services/labPromptBuilder.ts` 로직 고도화
> - `Smart Hint Contextualizer` 모듈 추가
> - `Dynamic Outfit Swapper` 구현
> - `Hyper-Reality` 신규 패턴 10종 주입
> - `tests/creative_engine_verify.ts` 검증 스크립트
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Hint Logic → Pattern Injection → Outfit Swap → Final Verification

---

## Context

### Original Request
현재 AI 대본 생성이 뻔한 반전(시누이 등)만 반복하고, 주제와 상관없는 힌트가 나오거나 장소 변화에도 의상이 그대로인 문제를 해결하여 대박 나는 쇼츠 대본을 만들 수 있게 업그레이드 요청.

### Interview Summary
**Key Discussions**:
- **패턴 고착화**: AI가 프롬프트 내 예시를 그대로 베끼는 게으름 발생.
- **힌트 불일치**: 골프장 주제에 와인바 힌트가 나오는 등 랜덤 로직의 개연성 부족.
- **의상 모순**: 대본상 집으로 이동해도 골프복을 입고 있는 이미지 프롬프트 생성 오류.

**Research Findings**:
- `labPromptBuilder.ts` 내 `RANDOM_SEED_POOLS`가 주제와 독립적으로 동작 중.
- `LAB_GENRE_GUIDELINES`의 예시가 AI에게 과도한 가이드라인이 되어 창의성을 저해함.
- 테스트 자동화 인프라 미비(수동 검증 스크립트 위주).

### Metis Review
**Identified Gaps** (addressed):
- **의상 전환 임계치**: 어떤 키워드에서 의상을 바꿀지 명확한 매핑 필요 (Auto-Resolved).
- **반전 신선도**: '관계' 중심 반전을 명시적으로 금지하는 가드레일 필요 (Auto-Resolved).
- **테스트 환경**: 고도화된 로직을 검증할 단위 테스트 부재 (Fixed via test task).

---

## Work Objectives

### Core Objective
AI가 예시를 베끼지 않고 주제에 최적화된 신선한 하이퍼 리얼리티 대본과 논리적 오류가 없는 이미지 프롬프트를 생성하도록 엔진 업그레이드.

### Concrete Deliverables
- `services/labPromptBuilder.ts`: 핵심 생성 로직 수정
- `SmartHintManager`: 주제 기반 힌트 필터링 로직
- `OutfitSyncEngine`: 텍스트 내 장소 감지 및 의상 스왑 로직
- `test_creative_engine.ts`: 통합 테스트 코드

### Definition of Done
- [ ] 주제와 힌트의 연관성 90% 이상 (검증 스크립트 통과)
- [ ] 이미지 프롬프트에서 장소-의상 불일치 0건
- [ ] '시누이/처제/남편친구' 등 예시 관계 복제율 5% 미만

### Must Have
- 주제 분석 기반 힌트 필터링 로직
- 장소 키워드 감지 기반 의상 자동 교체 기능
- 예시 복제 금지 강력 가드레일

### Must NOT Have (Guardrails)
- `bun.lsp` 사용 절대 금지 (런타임 불안정)
- 기존 캐릭터 identity(외모 설정) 훼손 금지
- JSON 출력 규격 변경 금지

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual-only (with dedicated verification script)
- **Framework**: tsx (standalone)

### Manual QA Procedure

| Type | Verification Tool | Procedure |
|------|------------------|-----------|
| **Logic** | `tsx tests/creative_engine_verify.ts` | 5가지 테마(골프, 마트, 병원 등)로 대본 생성 후 힌트 연관성 및 의상 일치 여부 로그 확인 |
| **Prompt** | Console Log Analysis | 생성된 최종 프롬프트 문자열에서 `Black Zip-front...`가 실내 씬에서 사라졌는지 확인 |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation & Logic):
├── Task 1: Smart Hint Contextualizer 구현
└── Task 2: 반전 패턴 리모델링 (Anti-Relational Logic)

Wave 2 (Dynamics & Verification):
├── Task 3: Dynamic Outfit-Location Sync 구현
└── Task 4: 통합 검증 스크립트 작성 및 테스트
```

---

## TODOs

- [ ] 1. Smart Hint Contextualizer 구현

  **What to do**:
  - `RANDOM_SEED_POOLS`를 카테고리화(Sports, Lifestyle, Health 등)
  - `topic`에서 키워드를 추출하여 해당 카테고리의 힌트만 우선 선택하는 로직 구현
  - 매칭되는 카테고리 없을 시에만 General 풀 사용

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: 주제 분석 및 힌트 매핑 로직의 논리적 설계 필요
  - **Skills**: [`explore`]

  **References**:
  - `services/labPromptBuilder.ts:1202` - 현재 랜덤 씨드 풀 구조
  - `services/labPromptBuilder.ts:1273` - `generateRandomSeed` 로직

  **Acceptance Criteria**:
  - [ ] 주제가 '골프'일 때 '와인바' 힌트 당첨 확률 0%
  - [ ] `generateRandomSeed(topic)` 함수가 정상적으로 필터링된 씨드 반환

- [ ] 2. 반전 패턴 리모델링 및 가드레일 강화

  **What to do**:
  - `LAB_GENRE_GUIDELINES`의 코미디/유머 섹션 예시를 '황당 상황' 중심으로 전면 수정
  - 프롬프트 최상단에 "관계를 이용한 반전(시누이 등)보다 상황적 오해를 우선하라"는 지침 추가
  - 예시 문장 끝에 `(이 예시를 베끼면 즉시 실패)` 문구 강화

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: AI가 창의적으로 반응하도록 프롬프트 엔지니어링 및 텍스트 수정
  - **Skills**: [`explore`]

  **References**:
  - `services/labPromptBuilder.ts:849` - 코미디 장르 지침 위치

  **Acceptance Criteria**:
  - [ ] 생성된 대본에서 '시누이/처제' 관계 반전이 나타나지 않음 확인

- [ ] 3. Dynamic Outfit-Location Sync 구현

  **What to do**:
  - 대본의 각 씬(`scriptLine`)에서 장소 변화 키워드(`집`, `내부`, `며칠 뒤`, `카페`) 감지 로직 추가
  - 장소 변화 감지 시 `lockedOutfits` 대신 상황에 맞는 의상(`Home Wear`, `Casual`)으로 임시 교체하는 프롬프트 조립 로직 구현

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: 텍스트 분석 기반 동적 상태 변경 로직 필요
  - **Skills**: [`explore`]

  **References**:
  - `services/labPromptBuilder.ts:1733` - 최종 `longPrompt` 조립부

  **Acceptance Criteria**:
  - [ ] 대본 텍스트에 '집'이 포함된 씬의 이미지 프롬프트에서 'Golf Mini Dress'가 제거됨 확인

- [ ] 4. 통합 검증 스크립트 작성 및 테스트 실행

  **What to do**:
  - `tests/creative_engine_verify.ts` 작성
  - 다양한 주제 입력 시 결과물(힌트 연관성, 의상 일관성)을 평가하여 콘솔에 리포트 출력

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 기구축된 로직에 대한 검증 코드 작성

  **Acceptance Criteria**:
  - [ ] `npx tsx tests/creative_engine_verify.ts` 실행 시 모든 체크포인트 PASS

---

## Success Criteria

### Verification Commands
```bash
npx tsx tests/creative_engine_verify.ts
```

### Final Checklist
- [ ] 힌트-주제 간 개연성 확보
- [ ] 장소별 의상 자동 스왑 동작
- [ ] 뻔한 가족 반전 패턴 소멸
- [ ] 기존 JSON 스키마 유지 확인

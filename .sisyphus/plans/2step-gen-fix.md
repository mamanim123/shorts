# 워크플랜: 2단계 생성(대본-이미지) 일치성 및 퀄리티 개선

## TL;DR

> **Quick Summary**: 마마님의 피드백을 반영하여 쇼츠 대본과 이미지 프롬프트 간의 괴리를 해결하고, 캐릭터 코디(겨울 악세서리) 규칙 엄수 및 카메라 앵글 다양성을 확보합니다.
> 
> **Deliverables**:
> - `labPromptBuilder.ts`: 고유 악세서리 분배 로직 및 카메라 앵글 최적화
> - `shortsLabStep2PromptRulesDefaults.ts`: 맥락 기반 인물 추출 지침 강화
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - 순차적 로직 수정 및 테스트 필요
> **Critical Path**: 인물 추출 프롬프트 수정 → 악세서리 분배 로직 구현 → 최종 검증

---

## Context

### Original Request
2단계 대본 생성 시 이미지 프롬프트가 대본과 따로 노는 문제를 해결하고, 겨울 악세서리(최대 2개, 중복 금지), 인물 추출 정확도, 카메라 앵글 다양성(배경 강조)을 개선해달라는 요청.

### Interview Summary
**Key Discussions**:
- **겨울 악세서리**: 머리, 목, 팔, 발 4개 카테고리 중 인당 최대 2개만 착용. 캐릭터 간 조합이 겹치지 않아야 함.
- **인물 추출**: 단순히 단어 매칭이 아닌, 맥락상 해당 장면에 있어야 할 인물(관찰자, 리액션 담당 등)을 정확히 추출해야 함.
- **카메라 앵글**: 미들샷 위주에서 벗어나 와이드 샷 비중을 높여 배경(눈오는 골프장 등)을 확실히 보여줘야 함. 중복 앵글 사용 지양.

---

## Work Objectives

### Core Objective
대본의 상황과 이미지의 시각적 묘사를 완벽하게 일치시키고, 마마님의 세부 코디 규칙을 시스템적으로 강제함.

### Concrete Deliverables
- `services/labPromptBuilder.ts` 내 악세서리 및 카메라 제어 로직 수정
- `services/shortsLabStep2PromptRulesDefaults.ts` 내 Step 2 시스템 프롬프트 업데이트

### Definition of Done
- [x] 주제 '겨울 골프장' 생성 시 모든 캐릭터의 악세서리 조합이 고유하고 2개 이하임.
- [x] 대본에 '캐디가 쳐다봤다'는 내용이 있을 때 프롬프트에 '캐디'와 '관찰 대상'이 모두 포함됨.
- [x] 12개 씬 중 와이드 샷이 최소 3개 이상 포함되며 배경 묘사가 구체적임.

### Must Have
- 겨울 악세서리 인당 최대 2개 제한 (카테고리: Head, Neck, Arms, Legs)
- 캐릭터 간 악세서리 조합 중복 절대 금지
- 와이드 샷 비중 확대 및 배경 강조 키워드(`deep focus`, `detailed background`) 필수 포함

### Must NOT Have (Guardrails)
- 3개 이상의 악세서리 착용 금지
- 동일한 카메라 앵글 3회 연속 사용 금지
- 대본에 없는 인물을 임의로 추가하거나, 있어야 할 인물을 누락하지 말 것

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Manual-only (시각적 확인이 중요하므로 2단계 생성 테스트 수행)
- **QA approach**: 실제 '눈오는 골프장' 주제로 대본 생성 후 결과물(`2단계생성.txt` 형태) 분석

### Automated Verification (Agent-Executable)

**For Logic changes (using Bash node/bun):**
```bash
# 악세서리 분배 로직 유닛 테스트 (임시 테스트 파일 작성 후 실행)
bun -e "import { distributeUniqueWinterItems } from './services/labPromptBuilder'; console.log(distributeUniqueWinterItems(['WomanA', 'WomanB', 'WomanC']))"
# Assert: 각 캐릭터의 조합이 고유하고 2개 이하인지 확인
```

---

## Execution Strategy

### Parallel Execution Waves
이 작업은 로직 간 의존성이 높으므로 순차적으로 진행합니다.

Wave 1: 시스템 프롬프트(인물 추출/장면 분해) 고도화
Wave 2: 악세서리 분배 및 카메라 앵글 제어 로직 구현
Wave 3: 전체 프로세스 통합 테스트 및 결과물 검증

---

## TODOs

- [x] 1. Step 2 시스템 프롬프트 고도화 (`shortsLabStep2PromptRulesDefaults.ts`)

  **What to do**:
  - `characterPrompt` 수정: "맥락 기반 추출" 지침 추가 (누가 누구를 보거나 언급하는 경우 둘 다 추출).
  - `finalPrompt` 수정: "배경 가시성" 및 "와이드 샷 우선" 규칙 명시.
  - "POV 샷" 및 "샷 타입 규칙" 섹션 강화.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`] (프롬프트 구조 분석 및 테스트)

  **Acceptance Criteria**:
  - [x] `DEFAULT_STEP2_PROMPT_RULES` 내에 인물 추출 강화 문구가 포함됨.
  - [x] 와이드 샷 시 배경 묘사를 강조하는 가이드가 추가됨.

- [x] 2. 고유 악세서리 분배 로직 구현 (`labPromptBuilder.ts`)

  **What to do**:
  - `distributeUniqueWinterItems` 함수 신규 작성.
  - 4개 카테고리(Head, Neck, Arms, Legs) 정의.
  - 캐릭터 목록을 받아 인당 최대 2개의 고유한 조합을 생성하여 세션 동안 유지.
  - `convertToTightLongSleeveWithShoulderLine` 로직과 충돌하지 않도록 통합.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`playwright`] (로직 구현 및 유닛 테스트)

  **Acceptance Criteria**:
  - [x] 한 캐릭터에게 3개 이상의 악세서리가 할당되지 않음.
  - [x] 캐릭터 간 아이템 조합이 100% 다름을 검증.

- [x] 3. 카메라 앵글 다양화 로직 개선 (`labPromptBuilder.ts`)

  **What to do**:
  - `getCameraPromptForScene` 및 `enhanceScenePrompt` 수정.
  - 미들샷 빈도를 낮추고 와이드 샷(Wide Shot) 강제 삽입 로직 추가.
  - 이전 앵글을 기억하여 연속 중복을 방지하는 알고리즘 적용.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Acceptance Criteria**:
  - [x] 동일한 앵글이 3번 연속 나오지 않음.
  - [x] 12개 씬 기준 와이드 샷이 3개 이상 배정됨.

- [x] 4. 통합 테스트 및 결과 분석

  **What to do**:
  - 실제 대본 생성을 돌려보고 생성된 `json` 데이터 분석.
  - 마마님이 지적하신 `2단계생성.txt`와 비교하여 개선 여부 확인.

  **Acceptance Criteria**:
  - [x] 인물 추출 결과가 대본의 맥락과 일치함.
  - [x] 이미지 프롬프트의 배경 묘사가 더 풍부해짐.

---

## Success Criteria

### Verification Commands
```bash
# 로직 적용 후 테스트 스크립트 실행 시
# 기대 결과: "Accessory uniqueness check: PASSED", "Wide shot count: 3+"
```

### Final Checklist
- [x] 악세서리 인당 2개 이하 유지되는가?
- [x] 캐릭터 간 악세서리 조합이 다른가?
- [x] 와이드 샷 비중이 늘어났는가?
- [x] 인물 추출 시 관찰자/대상자가 모두 포함되는가?

# 쇼츠랩 AI 대본 생성 고도화 및 동적 캐릭터 ID 체계 개편 계획 (V4)

## TL;DR

> **Quick Summary**: '2단계 생성' 버튼을 폐기하고, 장르매니저의 캐릭터 리스트를 실시간으로 읽어 AI에게 전달하는 **'동적 슬롯 주입 시스템'** 기반의 V4 실험용 생성 기능을 구현합니다. 캐릭터 ID 체계를 `Woman_01` 등 숫자 기반으로 개편하여 무한한 확장성과 안정적인 AI 인식을 보장합니다.
> 
> **Deliverables**: 
> - `ShortsLabPanel.tsx`: 'V4 실험용 생성' 버튼 추가 및 동적 캐릭터 주입 핸들러 구현.
> - `labPromptBuilder.ts`: 장르매니저 상태를 기반으로 AI 지침을 실시간 생성하는 `buildDynamicSlotInstruction` 추가.
> - `shortsLabCharacterRulesDefaults.ts`: ID 생성 및 정규화 로직을 숫자 기반(`_01`)으로 전면 개편.
> - `ShortsLabPanel.tsx`: `normalizeSlotId` 정규식 고도화로 다양한 AI 응답 포맷 대응.
> 
> **Estimated Effort**: Short-Medium (3 waves)
> **Parallel Execution**: YES
> **Critical Path**: Dynamic Instruction Builder → Numeric ID Refactor → V4 Integration

---

## Context

### Original Request
'2단계 생성'을 폐기하고 새로운 로직을 테스트할 버튼(V4)을 생성합니다. 또한, 캐릭터가 늘어날 때마다 코드를 수정해야 하는 불편을 해소하기 위해, 장르매니저의 캐릭터 리스트를 실시간으로 참조하여 AI에게 전달하는 "이식이 쉬운" 동적 체계를 구축합니다.

### Refined Strategy (마마님 승인)
- **동적 슬롯 주입**: AI에게 줄 캐릭터 목록을 하드코딩하지 않고, 실행 시점에 장르매니저 데이터를 기반으로 생성합니다.
- **숫자 기반 ID (`Woman_01`)**: AI의 순번 인식률을 높이고 100명 이상의 대규모 캐릭터도 코드 수정 없이 지원합니다.
- **범용 파싱**: AI가 `Woman 1`, `Woman_01`, `Woman1` 등 어떤 형식을 써도 정확히 인식하는 정규식 기반 분석기를 도입합니다.

---

## Work Objectives

### Core Objective
시스템의 확장성(Scalability)과 이식성(Portability)을 극대화한 캐릭터 식별 및 생성 파이프라인을 구축하여, 향후 어떤 생성 모델이나 로직 업그레이드에도 유연하게 대응합니다.

### Concrete Deliverables
- `shortsLabCharacterRulesDefaults.ts`: `generateCharacterId` 수정 (`gender + "_" + paddedNumber`).
- `labPromptBuilder.ts`: `buildCharacterSlotInstruction`을 인자 기반의 동적 함수로 전환.
- `ShortsLabPanel.tsx`: 'V4 실험용 생성' 핸들러에서 `characterRules`를 prompt builder에 주입.
- `ShortsLabPanel.tsx`: `normalizeSlotId`를 `/(Woman|Man)_?(\d+)/i` 기반으로 수정.

### Definition of Done
- [ ] 장르매니저에서 캐릭터를 추가(예: 5명)하면 AI 지침에 자동으로 `Woman_01`~`Woman_05`가 나타남.
- [ ] AI가 생성한 대본의 캐릭터 ID가 장르매니저의 의상규칙 슬롯과 100% 매칭됨.
- [ ] V4 버튼 실행 시 기존 로직(AI 대본 생성)의 설정과 무관하게 독자적인 동적 로직이 작동함.
- [ ] 새로 추가되는 모든 캐릭터가 `_01`, `_02` 순번으로 고유 ID를 부여받음.

### Must NOT Have (Guardrails)
- 기존 `femaleA` 형식을 사용하는 코드와의 하위 호환성을 위해 `slotIdToRuleKey`에서 과도기적 변환 로직 유지.
- `Female D` (캐디)의 고정 속성을 훼손하지 않음.

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Playwright / Node.js

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: 동적 캐릭터 지침 생성 검증
  Tool: Bash (Node script)
  Preconditions: 장르매니저에 여성 캐릭터 5명이 등록되어 있음.
  Steps:
    1. `buildCharacterSlotInstruction(characterRules)` 호출.
    2. 출력된 텍스트에 "Woman_01"부터 "Woman_05"까지 포함되었는지 확인.
  Expected Result: 등록된 개수만큼 동적 목록이 생성됨.
  Evidence: Terminal output captured.

Scenario: 범용 파서(Parser) 포맷 대응 검증
  Tool: Bash (Node script)
  Preconditions: `normalizeSlotId` 수정 완료.
  Steps:
    1. "Woman 1", "Woman_02", "Woman3" 입력에 대한 결과값 확인.
    2. 각각 "Woman_01", "Woman_02", "Woman_03"으로 정규화되는지 확인.
  Expected Result: 다양한 포맷을 하나의 표준 ID로 통합 인식함.
  Evidence: Terminal output captured.

Scenario: V4 생성 결과 일관성 검증
  Tool: Playwright
  Preconditions: 'V4 실험용 생성' 실행.
  Steps:
    1. 생성된 대본의 각 씬별 캐릭터 ID가 장르매니저의 슬롯과 일치하는지 대조.
  Expected Result: AI가 배정한 ID와 시스템의 슬롯 데이터가 완벽히 동기화됨.
  Evidence: .sisyphus/evidence/task-v4-sync-check.png

---

## Execution Strategy

### Parallel Execution Waves

Wave 1: 기초 ID 체계 및 동적 빌더 개편
├── Task 1: shortsLabCharacterRulesDefaults.ts 숫자 기반 ID 및 헬퍼 개편
└── Task 2: labPromptBuilder.ts 동적 지침 생성 함수 구현

Wave 2: UI 핸들러 및 파서 고도화
├── Task 3: ShortsLabPanel.tsx 범용 정규식 파서(Parser) 구현
└── Task 4: ShortsLabPanel.tsx V4 버튼 및 동적 주입 핸들러 구현

Wave 3: CharacterPanel 통합 및 최종 검증
└── Task 5: CharacterPanel.tsx 슬롯 옵션 숫자 체계 전환

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | delegate_task(category="quick", load_skills=["git-master"]) |
| 2 | 3, 4 | delegate_task(category="ultrabrain", load_skills=["git-master"]) |
| 3 | 5 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"]) |

---

## TODOs

- [ ] 1. 캐릭터 ID 체계 숫자 기반 개편

  **What to do**:
  - `services/shortsLabCharacterRulesDefaults.ts`: `generateCharacterId`가 `Woman_01` 형식을 반환하도록 수정.
  - `DEFAULT_CHARACTER_RULES`의 기존 ID들을 새 형식으로 일괄 업데이트.
  - `slotIdToRuleKey` 등 변환 유틸리티를 숫자 체계에 맞게 단순화.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]
  - **Reason**: 기본 상수 및 유틸리티 함수 수정.

- [ ] 2. 동적 지침 생성(Instruction Builder) 구현

  **What to do**:
  - `services/labPromptBuilder.ts`: `characterRules`를 입력받아 AI용 캐릭터 설명 텍스트를 생성하는 `buildDynamicSlotInstruction` 함수 추가.
  - 기존 하드코딩된 `buildCharacterSlotInstruction` 로직을 이 함수로 대체 가능하게 인터페이스 설계.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]
  - **Reason**: 로직 캡슐화 및 신규 서비스 함수 작성.

- [ ] 3. 범용 정규식 기반 슬롯 파서 고도화

  **What to do**:
  - `ShortsLabPanel.tsx` (또는 utils): `normalizeSlotId` 함수 수정.
  - `/(Woman|Man)_?\s?(\d+)/i` 정규식을 사용하여 숫자만 추출 후 `Woman_01` 형태로 정규화하도록 구현.
  - `female`, `male` 키워드도 `Woman`, `Man`으로 통합 처리.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`git-master`]
  - **Reason**: 다양한 예외 상황을 고려한 정밀한 문자열 처리 로직 필요.

- [ ] 4. V4 실험용 생성 버튼 및 동적 주입 연동

  **What to do**:
  - `ShortsLabPanel.tsx`: '2단계 생성' 버튼 제거 후 'V4 실험용 생성' 추가.
  - `handleExperimentalGenerate` 구현:
    - 실행 시 `characterRules`를 읽어 `buildLabScriptPrompt`에 전달.
    - 프롬프트 빌더가 이 데이터를 사용하여 AI에게 "현재 등록된 캐릭터" 목록을 설명하게 함.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  - **Reason**: 버튼 UI 변경 및 복잡한 데이터 흐름(Hook -> Service) 연결.

- [ ] 5. CharacterPanel 슬롯 UI 동기화

  **What to do**:
  - `CharacterPanel.tsx`: `SLOT_OPTIONS`를 `Woman_01`, `Man_01` 등 새 규격으로 전환.
  - 캐릭터 저장/수정 시 이 ID가 장르매니저와 정확히 매칭되는지 확인.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  - **Reason**: 사용자 입력과 시스템 데이터 간의 최종 접점 수정.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1, 2 | `refactor(core): implement dynamic numeric character ID system` | defaults.ts, labPromptBuilder.ts | Node test |
| 3, 4 | `feat(lab): add V4 experimental gen with dynamic slot injection` | ShortsLabPanel.tsx | UI Check |
| 5 | `feat(ui): update CharacterPanel to support numeric slots` | CharacterPanel.tsx | Final E2E |

---

## Success Criteria

### Verification Commands
```bash
# 정규식 파서 테스트 (예시)
node -e "const parser = (s) => s.replace(/(Woman|Man)_?\s?(\d+)/i, (_, g, n) => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase() + '_' + n.padStart(2, '0')); console.log(parser('woman 1'))"
```

### Final Checklist
- [ ] 장르매니저 캐릭터 개수만큼 AI 지침이 동적으로 생성되는가?
- [ ] AI가 작성한 `Woman_1` 등의 표기가 `Woman_01`로 정확히 파싱되는가?
- [ ] V4 버튼을 통해 생성된 이미지 프롬프트에 장르매니저의 설정이 반영되었는가?
- [ ] 기존 기능들이 이 개편의 영향을 받지 않고 정상 작동하는가?

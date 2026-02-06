# 쇼츠랩 캐릭터 생성-의상규칙(Genre Manager) 통합 및 Recall & Edit 고도화 계획

## TL;DR

> **Quick Summary**: 캐릭터 선택 탭에서 캐릭터를 클릭하면 관리 창에서 수정할 수 있도록 리콜 기능을 구현하고, 캐릭터 저장 시 장르매니저의 '의상규칙'에 즉시 동기화하여 대본 및 이미지 프롬프트 생성에 마스터 데이터로 적용되도록 통합합니다.
> 
> **Deliverables**: 
> - `CharacterPanel.tsx`: 리콜 및 수정 모드, 의상규칙 자동 동기화 로직 구현.
> - `ShortsLabPanel.tsx`: 장르매니저 캐릭터 규칙(의상규칙)을 생성 파이프라인의 최우선 순위로 적용.
> - `shortsLabCharacterRulesManager.ts`: 안전한 캐릭터 규칙 업데이트 유틸리티 강화.
> 
> **Estimated Effort**: Short (2-3 waves)
> **Parallel Execution**: YES (UI 로직과 데이터 처리 로직 분리 가능)
> **Critical Path**: CharacterPanel Recall UI → Sync Logic → ShortsLabPanel Prompt Integration

---

## Context

### Original Request
쇼츠랩 입력탭의 캐릭터 선택에서 캐릭터를 만들고 클릭하면 관리 창에서 수정/삭제/저장할 수 있게 하고 싶습니다. 또한 장르매니저의 의상규칙에 캐릭터들이 바로 저장되어 대본과 이미지 프롬프트 생성 시 적용되도록 분석 및 통합이 필요합니다.

### Interview Summary
**Key Discussions**:
- **의상규칙 정의**: "장르매니저의 의상규칙"은 코드상의 `ShortsLabCharacterRules` (슬롯별 물리적 특징 정의)를 의미함을 확인.
- **동기화 로직**: 캐릭터 카탈로그(`CharacterItem`) 저장 시, 현재 선택된 슬롯(WomanA 등)에 해당하는 의상규칙(`CharacterSlotRule`)의 `hair`, `body`, `style` 필드를 자동 갱신.
- **Recall & Edit**: 캐릭터 리스트 클릭 시 관리 탭으로 전환되며 기존 정보를 불러오도록 상호작용 설계. "할당"과 "수정"의 의도를 분리하여 UX 개선.
- **프롬프트 우선순위**: AI 생성 프롬프트보다 의상규칙에 정의된 마스터 데이터를 최우선으로 주입하여 일관성 확보.

**Research Findings**:
- `CharacterPanel.tsx`에서 캐릭터 관리(추출/저장)가 이루어지나, `ShortsLabCharacterRules`와는 별개로 운영되고 있음.
- `labPromptBuilder.ts`는 이미 `ShortsLabCharacterRules`를 참조하지만, `ShortsLabPanel`에서 마스터 데이터를 구성할 때 하드코딩된 기본값(`DEFAULT_CHARACTER_META`)이 우선되는 지점이 발견됨.

---

## Work Objectives

### Core Objective
캐릭터 라이브러리(`CharacterItem`)와 프롬프트 마스터 규칙(`CharacterSlotRule`)을 이원화하여 관리하되, 저장 및 선택 시점에 실시간 동기화하여 사용자가 "한 곳에서 관리하고 모든 곳에 적용"되는 경험을 제공합니다.

### Concrete Deliverables
- `CharacterPanel.tsx`: `editingCharacterId` 상태 추가 및 `PUT` 방식의 업데이트 지원.
- `CharacterPanel.tsx`: 캐릭터 카드 클릭 시 관리 탭 전환 및 데이터 로드.
- `CharacterPanel.tsx`: 저장 시 `shortsLabCharacterRulesManager.updateCharacter` 호출.
- `ShortsLabPanel.tsx`: `buildCharacterInfoMap`에서 `characterRules` 상태를 최우선 참조하도록 수정.

### Definition of Done
- [ ] 캐릭터 선택 리스트에서 캐릭터 클릭 시 '캐릭터관리' 탭으로 전환되며 얼굴/헤어/체형 정보가 복원됨.
- [ ] 수정 후 '저장' 시 새 캐릭터가 생성되지 않고 기존 캐릭터가 업데이트됨.
- [ ] 캐릭터 저장 시 '의상규칙(Genre Manager)'의 해당 슬롯 데이터가 즉시 변경됨.
- [ ] 대본 생성 시 AI 프롬프트가 아닌, 사용자가 수정한 의상규칙 데이터가 최종 프롬프트에 강제 적용됨.

### Must NOT Have (Guardrails)
- `CharacterSlotRule`에 없는 필드(`face`, `age` 등)를 강제로 동기화하여 스키마를 깨뜨리지 않음 (필요 시 `style`에 포함).
- 캐릭터 삭제 시 현재 선택된 슬롯 할당 정보가 깨지지 않도록 방어 로직 적용.
- `femaleD`(캐디)의 특수 설정(고정 연령 등)이 동기화 과정에서 덮어씌워지지 않도록 보호.

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (Playwright E2E)
- **Framework**: Playwright

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: 캐릭터 리콜 및 수정 검증
  Tool: Playwright
  Preconditions: 최소 1개의 기존 캐릭터가 저장되어 있음.
  Steps:
    1. '캐릭터선택' 탭에서 기존 캐릭터 카드 클릭.
    2. '캐릭터관리' 탭으로 자동 전환 확인.
    3. 입력 필드에 기존 캐릭터의 정보(이름, 헤어 등)가 로드되었는지 확인.
    4. 정보를 수정한 후 '저장' 버튼 클릭.
    5. 캐릭터 리스트에서 이름이 변경되었는지, 신규 생성이 아닌 업데이트인지 확인.
  Expected Result: 기존 캐릭터 정보가 정확히 복원되고 업데이트됨.
  Evidence: .sisyphus/evidence/task-1-recall-edit.png

Scenario: 의상규칙(Genre Manager) 자동 동기화 검증
  Tool: Playwright
  Preconditions: WomanA 슬롯이 선택되어 있음.
  Steps:
    1. '캐릭터관리'에서 새 캐릭터 생성 혹은 기존 캐릭터 수정.
    2. 저장 버튼 클릭.
    3. '장르매니저' -> '의상규칙' 탭으로 이동.
    4. WomanA 슬롯의 hair/body/style이 방금 저장한 캐릭터 정보와 일치하는지 확인.
  Expected Result: 캐릭터 저장 즉시 의상규칙 데이터가 동기화됨.
  Evidence: .sisyphus/evidence/task-2-sync-rules.png

Scenario: 최종 프롬프트 적용 검증
  Tool: Playwright
  Preconditions: 의상규칙에서 WomanA의 체형을 "Very muscular build"로 수정함.
  Steps:
    1. '입력' 탭에서 아무 대본이나 생성.
    2. 생성된 씬의 영어 프롬프트를 확인.
    3. 프롬프트 내에 "Very muscular build"가 포함되어 있는지 확인 (AI가 생성한 기본값이 아닌 규칙이 이겼는지 확인).
  Expected Result: 의상규칙의 마스터 데이터가 최종 프롬프트에 강제 반영됨.
  Evidence: .sisyphus/evidence/task-3-prompt-priority.png

---

## Execution Strategy

### Parallel Execution Waves

Wave 1: 데이터 모델 및 매니저 강화
├── Task 1: 슬롯 ID 매핑 유틸리티 및 매니저 업데이트 기능 강화
└── Task 2: CharacterPanel Recall UI 구조 설계

Wave 2: UI 로직 통합 및 동기화
├── Task 3: CharacterPanel Recall & Edit (Update) 로직 구현
└── Task 4: 저장 시 의상규칙 자동 동기화 로직 구현

Wave 3: 프롬프트 생성 파이프라인 통합
└── Task 5: ShortsLabPanel의 마스터 데이터 참조 우선순위 고정

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | delegate_task(category="quick", load_skills=["git-master"]) |
| 2 | 3, 4 | delegate_task(category="visual-engineering", load_skills=["frontend-ui-ux"]) |
| 3 | 5 | delegate_task(category="ultrabrain", load_skills=["git-master"]) |

---

## TODOs

- [ ] 1. 슬롯 ID 매핑 유틸리티 생성 및 매니저 강화

  **What to do**:
  - `utils/slotMapper.ts` (신규): `woman-a` ↔ `femaleA` 등 UI 슬롯 ID와 규칙 슬롯 ID 간의 변환 함수 작성.
  - `shortsLabCharacterRulesManager.ts`: 특정 필드만 부분 업데이트하는 `updateCharacterTraits` (hair, body, style 중심) 함수 보강.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]
  - **Reason**: 유틸리티 함수 작성 및 기존 서비스 로직의 가벼운 수정.

  **Parallelization**: Wave 1. Blocks Task 4.

- [ ] 2. CharacterPanel Recall & Edit UI 구현

  **What to do**:
  - `CharacterPanel.tsx`: `editingCharacterId` 상태 추가.
  - 캐릭터 카드 클릭 시 `setNewCharacter`에 데이터 주입 및 `activeTab='manage'` 전환 로직 추가.
  - 저장 버튼의 라벨을 `editingCharacterId` 유무에 따라 "수정 저장" vs "새 캐릭터 저장"으로 동기화.
  - 선택 리스트에 "할당" 버튼을 별도로 두어 클릭(수정)과 할당(슬롯 적용)의 의도를 분리.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  - **Reason**: 탭 전환 및 복잡한 폼 상태 관리가 포함된 UI 작업.

  **Parallelization**: Wave 2. Blocked by Task 1.

- [ ] 3. 캐릭터 저장 시 의상규칙(의상규칙) 자동 동기화

  **What to do**:
  - `CharacterPanel.tsx` -> `handleSaveCharacter`: 저장 성공 후 `slotMapper`를 사용하여 현재 `selectedSlot`의 규칙 ID를 확인.
  - `shortsLabCharacterRulesManager.updateCharacter`를 호출하여 `hair`, `body`, `style`을 즉시 동기화.
  - 동기화 완료 알림(Toast) 추가: "의상규칙(슬롯 X)에 반영되었습니다."

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]
  - **Reason**: UI 이벤트 핸들러와 외부 매니저 호출 로직 통합.

  **Parallelization**: Wave 2. Blocked by Task 1.

- [ ] 4. ShortsLabPanel 프롬프트 생성 우선순위 통합

  **What to do**:
  - `ShortsLabPanel.tsx` -> `buildCharacterInfoMap`: `DEFAULT_CHARACTER_META` 대신 `characterRules` 상태(매니저에서 로드된 값)를 최우선으로 사용하도록 맵 구성 로직 수정.
  - `postProcessAiScenes`: 후처리 시 사용하는 `characterInfoMap`이 항상 최신 의상규칙을 반영하는지 확인.
  - `validateAndFixPrompt`: 마스터 데이터 주입 시 의상규칙의 `outfitFit`, `isFixedAge` 등의 속성도 함께 고려하도록 보강.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`git-master`]
  - **Reason**: 생성 파이프라인의 핵심 로직 수정 및 일관성 보장 작업.

  **Parallelization**: Wave 3. Blocked by Wave 2.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(utils): add character slot mapping utility` | slotMapper.ts, shortsLabCharacterRulesManager.ts | Unit Test |
| 2, 3 | `feat(ui): implement character recall & edit with auto-sync to rules` | CharacterPanel.tsx | E2E Scenario 1, 2 |
| 4 | `feat(lab): prioritize costume rules in prompt generation` | ShortsLabPanel.tsx | E2E Scenario 3 |

---

## Success Criteria

### Verification Commands
```bash
# E2E 테스트 실행 (구현 후)
npx playwright test tests/character-integration.spec.ts
```

### Final Checklist
- [ ] 캐릭터 클릭 시 관리 창에서 모든 정보(얼굴/헤어/체형)가 정확히 불러와지는가?
- [ ] 저장 시 기존 캐릭터가 ID를 유지하며 업데이트되는가?
- [ ] 캐릭터 저장 시 '장르매니저-의상규칙' 슬롯에 데이터가 즉시 반영되는가?
- [ ] 새로 생성된 대본 프롬프트가 '의상규칙'의 물리적 특징을 100% 따르는가?

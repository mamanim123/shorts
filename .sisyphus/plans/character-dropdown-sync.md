# Plan: 캐릭터 정보 드롭다운 및 동기화 기능 추가

## TL;DR

> **Quick Summary**: 미리보기 화면의 캐릭터 프로필 섹션에 의상, 헤어, 체형을 즉시 변경할 수 있는 드롭다운 메뉴를 추가하고, 이를 전역 캐릭터 규칙과 동기화하여 프롬프트 생성에 반영합니다.
> 
> **Deliverables**:
> - `constants.ts`: 헤어 및 체형 프리셋 공용화
> - `ShortsLabPanel.tsx`: 캐릭터 프로필 드롭다운 UI 및 상태 업데이트 로직 추가
> - `labPromptBuilder.ts`: 최신 캐릭터 정보를 반영한 프롬프트 생성 로직 검증
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential implementation recommended for UI-State sync
> **Critical Path**: 상수 분리 → UI 구현 → 상태 연동 → 프롬프트 생성 검증

---

## Context

### Original Request
쇼츠랩 미리보기 화면 상단 캐릭터 정보 섹션에서 드롭다운 메뉴를 통해 의상, 헤어, 체형을 바로 수정할 수 있게 하고, 수정 시 캐릭터 정보 적용 버튼을 통해 즉시 프롬프트에 반영되며 장르매니저 의상규칙과도 동기화되도록 요청. 의상은 로얄, 요가, 골프럭셔리, 섹시 카테고리를 지원해야 함.

### Interview Summary
**Key Discussions**:
- 의상 카테고리는 의상추출 탭의 라이브러리와 연동.
- 헤어 및 체형은 기존 프리셋 데이터를 드롭다운 옵션으로 사용.
- "캐릭터 정보 적용" 버튼은 현재 화면의 수정된 정보를 바탕으로 모든 씬의 프롬프트를 일관되게 재구성함.

**Research Findings**:
- `ShortsLabPanel.tsx`에서 캐릭터 프로필은 `masterCharacterProfiles` 배열로 관리 중.
- 의상은 `masterOutfitMap` (Map)으로 관리 중.
- 장르매니저 규칙 동기화는 `useShortsLabCharacterRulesManager`의 `updateCharacter`를 통해 가능.

### Metis Review
**Identified Gaps** (addressed):
- **남성 캐릭터 대응**: 남성 캐릭터는 `MALE` 카테고리 의상만 필터링하여 드롭다운에 표시.
- **커스텀 의상**: 사용자가 의상추출 탭에서 직접 추가한 의상도 드롭다운 목록에 포함되도록 `fetchOutfitCatalog` 연동.
- **성능**: 6000라인 이상의 `ShortsLabPanel.tsx` 수정 시 불필요한 리렌더링 방지.

---

## Work Objectives

### Core Objective
미리보기 탭의 캐릭터 프로필을 편집 가능한 드롭다운 UI로 교체하고, 변경 사항이 전역 규칙 및 최종 프롬프트 생성에 완벽하게 동기화되도록 구현.

### Concrete Deliverables
- `constants.ts`: `HAIR_PRESETS`, `BODY_PRESETS` 추가
- `ShortsLabPanel.tsx`: 편집 가능한 캐릭터 프로필 카드 UI
- `ShortsLabPanel.tsx`: 드롭다운 변경 핸들러 및 규칙 동기화 로직

### Definition of Done
- [ ] 미리보기 탭에서 캐릭터의 의상, 헤어, 체형을 드롭다운으로 선택할 수 있음.
- [ ] 드롭다운 변경 시 장르매니저의 "의상 규칙"이 자동으로 업데이트됨.
- [ ] "캐릭터 정보 적용" 버튼 클릭 시 변경된 내용이 하단 모든 씬의 영어 프롬프트에 반영됨.
- [ ] 남성 캐릭터는 남성용 의상만, 여성 캐릭터는 여성용 의상만 드롭다운에 표시됨.

### Must Have
- 의상 카테고리 필터링 (로얄, 요가, 골프럭셔리, 섹시)
- 장르매니저 규칙(`shorts-lab-character-rules`)과 실시간 동기화
- "캐릭터 정보 적용" 클릭 시 일관성 있는 프롬프트 재생성

### Must NOT Have (Guardrails)
- 기존 대본(scriptBody)을 수정하지 않음 (비주얼 정보만 수정).
- 씬 개별 수정 로직을 건드리지 않고 상단 일괄 적용 방식을 유지.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Playwright)
- **Automated tests**: None (Manual verification via Agent QA Scenarios preferred)
- **Framework**: none

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: 캐릭터 프로필 드롭다운 UI 및 의상 필터링 확인
  Tool: Playwright
  Preconditions: AI 마스터 생성이 완료되어 미리보기 화면에 캐릭터 프로필이 표시된 상태
  Steps:
    1. 미리보기 탭 상단의 캐릭터 프로필 섹션 확인
    2. 특정 캐릭터(WomanA)의 의상 드롭다운 클릭
    3. 'ROYAL', 'YOGA', 'GOLF LUXURY', 'SEXY' 카테고리가 구분되어 표시되는지 확인
    4. 남성 캐릭터(ManA)의 의상 드롭다운 클릭 시 'MALE' 관련 의상만 표시되는지 확인
  Expected Result: 성별 및 카테고리에 맞는 의상 리스트가 정상적으로 노출됨
  Evidence: .sisyphus/evidence/task-1-outfit-dropdown.png

Scenario: 드롭다운 변경 및 전역 규칙 동기화 검증
  Tool: Playwright
  Preconditions: 캐릭터 프로필 표시 상태
  Steps:
    1. WomanA의 헤어를 '단발 보브'로 변경
    2. 설정 탭의 '의상 규칙' 섹션으로 이동
    3. WomanA의 헤어 설정이 'short stylish bob hair...'로 자동 변경되었는지 확인
  Expected Result: 미리보기에서 변경한 정보가 장르매니저 전역 설정에 즉시 반영됨
  Evidence: .sisyphus/evidence/task-2-sync-check.png

Scenario: 캐릭터 정보 적용 및 프롬프트 반영 검증
  Tool: Playwright
  Preconditions: 캐릭터 정보 드롭다운에서 의상 및 헤어 수정 완료
  Steps:
    1. "캐릭터 정보 적용" 버튼 클릭
    2. 하단 씬 카드 중 하나의 '영어 프롬프트' 확인
    3. 수정한 의상과 헤어 키워드가 프롬프트 내에 정확히 포함되었는지 확인
  Expected Result: 변경된 캐릭터 정보가 모든 씬의 프롬프트에 일관되게 반영됨
  Evidence: .sisyphus/evidence/task-3-prompt-reflect.png

---

## Execution Strategy

### Parallel Execution Waves
- Wave 1: 상수 분리 및 UI 구현 (독립적)
- Wave 2: 상태 연동 및 규칙 동기화 (UI 의존)
- Wave 3: 프롬프트 생성 로직 검증 및 최종 테스트

---

## TODOs

- [ ] 1. 상수 분리 및 공용화
  **What to do**:
  - `CharacterPanel.tsx`의 `HAIR_PRESETS`, `BODY_PRESETS`를 `constants.ts`로 이동 및 export.
  - `CharacterPanel.tsx`에서 이동된 상수를 import하도록 수정.
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
  **References**:
  - `components/CharacterPanel.tsx:58-71` - 원본 프리셋 데이터
  - `constants.ts` - 대상 파일
  **Acceptance Criteria**:
  - [ ] `constants.ts`에 프리셋 데이터가 정상적으로 정의됨.
  - [ ] `CharacterPanel.tsx`가 에러 없이 기존 기능을 유지함.

- [ ] 2. 캐릭터 프로필 드롭다운 UI 구현
  **What to do**:
  - `ShortsLabPanel.tsx`의 캐릭터 프로필 렌더링 부분을 `select` 태그를 사용한 편집 가능한 형태로 교체.
  - 의상 드롭다운은 `optgroup`을 사용하여 카테고리별로 그룹화.
  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  **References**:
  - `components/ShortsLabPanel.tsx:5845-5859` - 현재 프로필 카드 UI
  - `services/outfitService.ts` - 의상 로드 로직 참고
  **Acceptance Criteria**:
  - [ ] 각 캐릭터 카드 내 의상, 헤어, 체형 필드가 드롭다운으로 변경됨.
  - [ ] 카테고리별 의상 분류가 적용됨.

- [ ] 3. 상태 업데이트 및 규칙 동기화 로직 연동
  **What to do**:
  - 드롭다운 `onChange` 이벤트 시 `masterCharacterProfiles`와 `masterOutfitMap` 업데이트.
  - `useShortsLabCharacterRulesManager`의 `updateCharacter`를 호출하여 장르매니저 설정 업데이트.
  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`frontend-ui-ux`]
  **References**:
  - `components/ShortsLabPanel.tsx:1575-1584` - 관련 상태 정의
  - `components/ShortsLabPanel.tsx:1516-1532` - `characterRules` 매니저 훅
  **Acceptance Criteria**:
  - [ ] 드롭다운 선택 시 UI가 즉시 반영됨.
  - [ ] 브라우저 새로고침 후에도 장르매니저 설정이 유지됨 (동기화 확인).

- [ ] 4. 캐릭터 정보 적용 버튼 로직 검증 및 테스트
  **What to do**:
  - `handleApplyCharacterInfo` 함수가 현재의 `masterOutfitMap`을 정확히 참조하는지 확인.
  - 전체 시나리오 테스트 수행.
  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
  **Acceptance Criteria**:
  - [ ] 수정된 캐릭터 정보로 프롬프트가 재생성됨.
  - [ ] 모든 QA 시나리오 통과.

---

## Success Criteria

### Verification Commands
```bash
npm run dev  # 실행 후 브라우저에서 드롭다운 조작 및 프롬프트 반영 확인
```

### Final Checklist
- [ ] 의상 카테고리(로얄, 요가, 골프럭셔리, 섹시) 드롭다운 노출
- [ ] 드롭다운 변경 시 장르매니저 설정 동기화
- [ ] 프롬프트 재생성 시 수정된 정보 반영
- [ ] 남성 캐릭터 전용 의상 필터링 적용

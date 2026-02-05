# Plan: Master Map 기반 AI 마스터 생성 로직 도입

## TL;DR

> **Quick Summary**: '2단계 생성' 버튼을 버리고, 캐릭터 일관성을 100% 보장하는 **'AI 마스터 생성'** 버튼과 로직을 도입합니다.
> 
> **Deliverables**:
> - 신규 버튼: `AI 마스터 생성` (UI 교체)
> - 신규 로직: `handleMasterGenerate` (Master Map 기반 재조립)
> - 고정 데이터: 세션 시작 시 1회 확정되는 캐릭터 정보 (겨울 변환 포함)
> 
> **Estimated Effort**: Short
> **Critical Path**: Master Map 데이터 확정 → 프롬프트 재조립(Reconstruction) 로직 구현 → UI 교체

---

## Context

### Original Request
- 마마님(USER)께서 쇼츠랩 생성 결과의 일관성 문제를 지적하심.
- 뒤로 갈수록 의상 명칭이나 캐릭터 묘사가 변하는 현상을 해결해야 함.
- '2단계 생성' 버튼은 품질이 낮아 제거하고, 새로운 'AI 마스터 생성' 버튼으로 대체 요청.
- '겨울 변환'은 토글 ON 시 마스터 맵 생성 단계에서 단 1회만 수행하도록 함.
- 기존 'AI 대본 생성'은 백업용으로 유지.

### Interview Summary
**Key Discussions**:
- **문제 원인**: AI가 생성한 원문을 일부 수정하는 'Patch' 방식의 한계.
- **해결 방안**: AI 원문을 무시하고, 고정된 마스터 데이터로 프롬프트를 처음부터 다시 짜는 'Reconstruction' 방식 도입.

---

## Work Objectives

### Core Objective
캐릭터의 Identity, Hair, Body, Outfit, Accessories를 모든 씬에서 100% 일치시키는 'AI 마스터 생성' 파이프라인 구축.

### Concrete Deliverables
- `ShortsLabPanel.tsx`: `handleMasterGenerate` 함수 추가 및 UI 버튼 교체.
- `labPromptBuilder.ts`: 마스터 데이터를 기반으로 프롬프트를 재조립하는 유틸리티 강화.

### Must Have
- `enableWinterAccessories` 토글 상태에 따른 겨울 변환 1회 적용.
- 씬 1번부터 끝번까지 캐릭터 묘사 문자열의 완전한 일치.
- **Master Map 생명주기**: 현재 작업 세션(folderName) 동안 `appStorage`에 유지.

### Must NOT Have (Guardrails)
- 기존 'AI 대본 생성' 로직 파괴 금지 (별도 경로 유지).
- AI가 임의로 생성한 캐릭터 묘사(의상 요약 등)가 최종 프롬프트에 섞여 들어가는 것 금지.
- **겨울 변환 중복 적용**: 이미 변환된 의상 문자열에 재차 변환 함수를 호출하지 않도록 체크.

---

## Verification Strategy

### Agent-Executed QA Scenarios

Scenario: AI 마스터 생성 실행 및 일관성 검증
  Tool: Playwright
  Preconditions: 쇼츠랩 입력 탭 접속, 겨울 악세서리 토글 ON
  Steps:
    1. 주제 입력 ("눈 오는 골프장")
    2. 'AI 마스터 생성' 버튼 클릭
    3. 생성 완료 후 '미리보기' 탭 이동
    4. 각 씬의 프롬프트 텍스트를 비교하여 캐릭터 묘사(Identity, Hair, Body, Outfit)가 모든 씬에서 동일한지 확인
    5. 의상에 'long-sleeve' 등 겨울 변환이 1회 적용되어 일관되게 나타나는지 확인
  Expected Result: 모든 씬에서 캐릭터 묘사 문자열이 100% 일치함.

Scenario: 마스터 맵에 없는 캐릭터 등장 대응
  Tool: Bash (Log check)
  Preconditions: 대본에 마스터 맵에 없는 새로운 이름 등장
  Steps:
    1. 'AI 마스터 생성' 실행
    2. 후처리 로그 확인
  Expected Result: 시스템이 해당 인물을 감지하여 기본 설정을 마스터 맵에 자동 추가하고 사용자에게 고지함.

---

## TODOs

- [ ] 1. UI 개편: '2단계 생성' 제거 및 'AI 마스터 생성' 추가
  - `ShortsLabPanel.tsx`에서 `2단계 생성` 버튼 렌더링 코드를 찾아서 `AI 마스터 생성`으로 변경.
  - 아이콘 및 로딩 상태(`isMasterGenerating`) 처리 추가.

- [ ] 2. `handleMasterGenerate` 핸들러 구현
  - 기존 `handleTwoStepGenerate`를 기반으로 하되, 로직을 '재조립' 위주로 전면 개편.
  - 세션 시작 시 `buildAutoCharacterMap`을 통해 **Master Map** 확정.
  - `enableWinterAccessories`가 true인 경우, Master Map 생성 시점에 `convertToTightLongSleeveWithShoulderLine` 1회 적용.

- [ ] 3. 엄격한 프롬프트 재조립(Reconstruction) 엔진 구현
  - AI가 생성한 `longPrompt`에서 캐릭터 묘사 부분을 정규식으로 완전히 제거하는 `stripAICharacterDescriptions` 함수 도입.
  - 마스터 맵의 고정 블록(`[Person 1: ...]`)을 강제로 주입.
  - 결과 구조: `PROMPT_CONSTANTS.START + Camera + Expression + Action + [Person Master Blocks] + Background + PROMPT_CONSTANTS.END`.

- [ ] 4. 겨울 액세서리 고정 주입
  - 캐릭터별로 할당된 액세서리를 모든 씬의 마스터 블록에 고정 포함.

- [ ] 5. 예외 처리 로직 추가
  - 마스터 맵에 없는 인물이 씬 분석에서 나올 경우 자동 추가 정책 적용.
  - 겨울 토글 변경 시 마스터 맵 갱신 여부 팝업/자동 처리.

---

## Success Criteria

- [ ] 'AI 마스터 생성' 버튼으로 생성된 모든 씬의 캐릭터 프롬프트가 100% 일치함.
- [ ] 겨울 변환이 토글 상태에 따라 정확히 1회만 적용됨.
- [ ] 기존 'AI 대본 생성' 버튼이 여전히 정상 작동함.

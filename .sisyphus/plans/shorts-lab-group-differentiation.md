# [Plan] 쇼츠랩 2단계 생성 단체샷 차별화 및 의상 정합성 고도화

## TL;DR

> **Quick Summary**: 단체샷에서 인물들이 동일한 동작을 반복하는 문제를 해결하기 위해 [Person N] 블록 내부로 개별 액션을 주입하고, 남성 캐릭터의 겨울 의상 지원을 통해 전체적인 씬의 정합성을 완성합니다.
> 
> **Deliverables**: 
> - 인물별 개별 동작/표정이 포함된 고정밀 [Person N] 마커 시스템
> - 남성/조연 캐릭터 전용 겨울 의상 변환 로직
> - 체형 묘사 누락 방지를 위한 고유 슬롯 라벨링 시스템
> 
> **Estimated Effort**: Short
> **Parallel Execution**: YES
> **Critical Path**: 프롬프트 조립 로직 변경 → 남성 겨울 의상 지원 → 통합 테스트

---

## Context

### Original Request
단체샷에서 인물들의 동작/표정이 똑같고, 체형 묘사가 한 명에게만 쏠리는 문제, 그리고 8번 씬의 의상이 맥락 없이 바뀌는 문제를 해결해달라는 마마님의 요청.

### Interview Summary
**Key Discussions**:
- **인물별 차별화**: 공통 액션 대신 [Person 1: Action A], [Person 2: Action B] 식으로 개별 행동 부여.
- **체형 고정**: 모든 여성 캐릭터의 체형이 명확히 구분되어 출력되도록 마커 강화.
- **남성 겨울 의상**: 8번 씬 등에서 남성 캐릭터도 설산 맥락에 맞는 겨울 옷을 입도록 로직 보강.

---

## Work Objectives

### Core Objective
단체샷의 인물들이 각자 개성 있는 동작을 취하며, 모든 캐릭터가 첫 씬부터 마지막 씬까지 맥락에 맞는 일관된 의상을 유지함.

### Concrete Deliverables
- `components/ShortsLabPanel.tsx`: `composeManualPrompt` 및 `buildAutoCharacterMap` 고도화.
- `services/labPromptBuilder.ts`: 성별 공용 `convertToWinterOutfit` 유틸리티 구현.
- `services/manualSceneBuilder.ts`: 인물별 개별 동작 유도를 위한 AI 지시문 보강.

### Definition of Done
- [ ] 쓰리샷 장면에서 [Person 1, 2, 3] 마커 내부에 각각 다른 액션 키워드가 포함됨.
- [ ] 단체샷 내 모든 캐릭터의 프롬프트 블록에 체형(body) 정보가 개별적으로 명시됨.
- [ ] 8번 씬의 남성 캐릭터가 'Winter Puffer' 등 맥락에 맞는 겨울 의상을 착용함.
- [ ] 모든 씬에서 동일 캐릭터의 의상 명칭이 100% 일치함.

---

## TODOs

### Wave 1: 프롬프트 엔진 및 의상 로직 고도화

- [ ] 1. 성별 공용 겨울 의상 변환기 구현 (`labPromptBuilder.ts`)
  - **What to do**: 
    - `convertToWinterOutfit(outfit, gender)` 함수 구현.
    - 남성일 경우: Puffer Jacket, Wool Coat, Heavy Parka 등 겨울 키워드 강제 주입.
    - 여성일 경우: 기존의 타이트한 긴팔 변환 로직 유지.

- [ ] 2. 단체샷 개별 액션 주입 로직 구현 (`ShortsLabPanel.tsx`)
  - **What to do**: 
    - `composeManualPrompt`에서 글로벌 액션/표정을 배열로 분리.
    - `[Person N (SlotLabel): ...]` 형식으로 마커를 강화하여 AI의 인물 구분 능력 향상.
    - 각 마커 내부에 `[Action: ...]`과 `[Expression: ...]`을 직접 삽입.

- [ ] 3. 남성 겨울 의상 지원 및 자동 매핑 (`ShortsLabPanel.tsx`)
  - **What to do**: 
    - `buildAutoCharacterMap`에서 신규 `convertToWinterOutfit`을 호출하여 모든 성별에 대해 겨울 테마 적용.

### Wave 2: AI 지시문 강화 및 테스트

- [ ] 4. 장면 분해 AI 지시문 수정 (`manualSceneBuilder.ts`)
  - **What to do**: 
    - "Individual Person Action Rule" 추가: 단체샷일 때 각 Person 번호별로 구체적인 개별 동작을 묘사하도록 지시.

- [ ] 5. 통합 테스트 실행
  - **What to do**: 
    - 2단계 생성을 재실행하여 단체샷의 인물별 차별화와 8번 씬 의상의 정합성을 최종 검증.

---

## Success Criteria
- [ ] 쓰리샷 이미지에서 한 명은 웃고 한 명은 손을 흔드는 등 동작이 분리됨.
- [ ] 모든 등장인물 블록에 체형 묘사가 누락 없이 포함됨.
- [ ] 남성 캐릭터가 눈오는 배경에 어울리는 두툼한 겨울 옷을 입음.

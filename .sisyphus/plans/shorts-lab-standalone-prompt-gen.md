# 쇼츠랩: 대본 기반 이미지 프롬프트 독립 생성 시스템 구축

## TL;DR

> **Quick Summary**: 기존에 작성된 대본을 입력하면, 쇼츠랩의 강력한 이미지 프롬프트 생성 로직(캐릭터 슬롯, 의상 고정, 후처리 파이프라인)을 그대로 적용하여 일관성 있는 프롬프트 셋을 생성하는 독립 시스템을 구축합니다. 또한, 기존의 복잡한 '씬분해&프롬프트생성' 버튼을 이 신규 시스템으로 대체합니다.
> 
> **Deliverables**:
> - 대본 분해 및 시각 묘사 추출용 신규 시스템 프롬프트
> - `/api/generate/prompts-only` 전용 백엔드 엔드포인트
> - '씬분해&프롬프트생성' 버튼을 '씬분해'로 개편 및 로직 교체
> - 수동 대본-캐릭터 자동 매핑 및 통합 후처리 시스템
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 Waves
> **Critical Path**: 프롬프트 리팩토링 → 백엔드 로직 연동 → UI 개편

---

## Context

### Original Request
"지금 쇼츠랩에 씬분해&프롬프트생성 이란 버튼이 있어 이 버튼의 이름을 씬분해로 바꾸고 이 버튼의 로직을 지우고 이버튼으로 사용할 수 있게 해봐"

### Interview Summary
- 마마님은 기존의 복잡한 씬 분해 로직 대신, 우리가 계획한 '독립형 프롬프트 생성 시스템'을 기존 버튼에 이식하길 원하심.
- 버튼 이름은 간결하게 '씬분해'로 변경.

---

## Work Objectives

### Core Objective
대본 작성 과정을 건너뛰고, 입력된 대본 텍스트로부터 쇼츠랩 표준 규격의 `scenes` 데이터를 생성하는 로직을 기존 '씬분해' 버튼에 통합한다.

### Concrete Deliverables
- `server/prompts/decomposition_system.txt`: 대본 분해 전용 프롬프트 파일
- `server/index.js`: `/api/generate/prompts-only` 핸들러 추가
- `ShortsLabPanel.tsx`: 
    - 버튼 텍스트 변경: '씬 분해 & 프롬프트 생성' → '씬분해'
    - `handleManualSceneGeneration` 로직을 신규 API 호출로 교체 (기존의 복잡한 다단계 호출 제거)

---

## Verification Strategy

### Universal Rule: Zero Human Intervention
에이전트가 직접 대본을 입력하고, 단 한 번의 버튼 클릭으로 일관성 있는 프롬프트 셋이 생성되는지 확인한다.

### Agent-Executed QA Scenarios

Scenario: '씬분해' 버튼 클릭 시 신규 시스템 작동 확인
  Tool: Playwright (playwright skill)
  Preconditions: 서버 실행 중, 쇼츠랩 '수동대본만들기' 탭 오픈
  Steps:
    1. '씬분해'로 이름이 바뀐 버튼 확인
    2. 테스트 대본 입력
    3. 버튼 클릭
    4. 단일 API 호출(`/api/generate/prompts-only`)로 모든 씬의 프롬프트가 한 번에 생성되는지 확인
  Expected Result: 버튼 이름 변경 완료, 신규 로직으로 프롬프트 생성 성공
  Evidence: .sisyphus/evidence/task-button-update.png

---

## Execution Strategy

### Parallel Execution Waves
Wave 1 (Start Immediately):
├── Task 1: 프롬프트 리팩토링 및 분해 로직 설계
└── Task 2: 백엔드 전용 엔드포인트 신설

Wave 2 (After Wave 1):
└── Task 3: `ShortsLabPanel.tsx` 버튼 개편 및 로직 교체

---

## TODOs

- [ ] 1. 대본 분해 전용 프롬프트 개발
  - `ai대본생성.txt`의 프롬프트 규칙을 추출하여 독립형 시스템 프롬프트 작성.

- [ ] 2. 백엔드 `/api/generate/prompts-only` 구현
  - 기존 `postProcessAiScenes`를 활용하여 일관성이 보장된 JSON 결과 반환.

- [ ] 3. 쇼츠랩 UI 버튼 개편 및 통합
  - `ShortsLabPanel.tsx`에서 버튼 이름 수정.
  - `handleManualSceneGeneration`의 기존 코드를 삭제하고 신규 API를 호출하도록 전면 수정.

---

## Success Criteria
- [ ] 버튼 이름이 '씬분해'로 정확히 표시됨.
- [ ] 기존의 복잡한 2단계(인물추출->분해) 과정이 단일 과정으로 통합되어 속도가 개선됨.
- [ ] 생성된 프롬프트가 쇼츠랩의 Identity Lock 및 의상 규칙을 완벽히 준수함.

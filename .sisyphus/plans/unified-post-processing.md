# 통합 후처리 매니저 (글로벌 규칙 시스템) 구축 계획

## TL;DR

> **Quick Summary**: 쇼츠랩의 흩어져 있는 하드코딩된 후처리 규칙들을 하나의 글로벌 관리 시스템으로 통합하여, 마마님께서 직접 수정, 저장, 백업할 수 있게 합니다.
> 
> **Deliverables**: 
> - 글로벌 후처리 규칙 데이터 구조 및 서비스 (`shortsLabPostProcessingManager.ts`)
> - 쇼츠랩 설정 패널 내 '후처리 규칙' 관리 UI (탭 추가)
> - 후처리 규칙 연동을 위한 로직 리팩토링 (`ShortsLabPanel.tsx`, `labPromptBuilder.ts`)
> - 규칙 백업 및 복원 기능
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - 순차적 리팩토링 필요
> **Critical Path**: 데이터 구조 정의 → Manager 구현 → 로직 리팩토링 → UI 통합

---

## Context

### Original Request
쇼츠랩에서 후처리기능을 장르매니저에 넣어서 관리 할수 있게 방법을 찾아봐 내가 후처리 문구도 수정하면서 저장,백업도 할 수있게 지금 있는 장르관리,프롬프트규칙,2단계규칙... 이공세 후처리 를 만들어서 후처리 기능을 모두 여기에서 관리 할수 있는 방법을 찾아서 어떻게 만들지 자세히 설명해줘. (장르별 분리 불필요, 모든 대본 공통 적용)

### Interview Summary
**Key Discussions**:
- 후처리를 장르별이 아닌 **글로벌(모든 대본 공통)**로 관리하기로 결정.
- 기존 설정 탭(장르관리, 프롬프트규칙 등) 옆에 **'후처리 규칙'** 탭을 추가하여 통합 관리.
- 백업 및 복원 기능을 포함하여 데이터 안전성 확보.

**Research Findings**:
- 현재 후처리 규칙은 `ShortsLabPanel.tsx`와 `labPromptBuilder.ts`에 상수로 하드코딩되어 있음.
- 서버의 `app-storage` API를 통해 JSON 데이터를 영구 저장 가능.

---

## Work Objectives

### Core Objective
하드코딩된 후처리 로직을 외부화하고, 마마님이 직접 제어할 수 있는 통합 관리 UI를 제공하여 프롬프트 품질 관리의 자율성을 극대화함.

### Concrete Deliverables
- `services/shortsLabPostProcessingDefaults.ts`: 규칙 기본값 정의
- `services/shortsLabPostProcessingManager.ts`: 규칙 CRUD 서비스
- `hooks/useShortsLabPostProcessingManager.ts`: UI 연동 훅
- `components/ShortsLabPanel.tsx` 내 신규 탭 UI
- 리팩토링된 `postProcessAiScenes` 함수

### Definition of Done
- [ ] '후처리 규칙' 탭에서 수정한 내용이 저장 후 유지됨.
- [ ] 'AI 대본생성' 및 '2단계 생성' 시 마마님이 설정한 규칙(품질 태그, 카메라 앵글 등)이 실제 프롬프트에 반영됨.
- [ ] 백업 파일을 통해 규칙을 내보내고 다시 불러오기가 정상 작동함.

### Must Have
- 모든 후처리 상수(카메라, 액세서리, 품질 태그 등)의 외부 설정화.
- 서버 저장 연동 (`app-storage`).
- JSON 편집기 또는 상세 설정 폼 UI.

### Must NOT Have (Guardrails)
- 장르별 개별 설정 (구현 복잡도 증가 및 마마님 요청 제외 사항).
- 기존 하드코딩된 로직의 완전 삭제 전 백업 미확보.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (React, Express)
- **User wants tests**: Manual-only (UI 및 결과물 검증 중심)

### Automated Verification (Agent-Executable):
```bash
# 서버 스토리지 저장 기능 확인
curl -X POST http://localhost:3002/api/app-storage -H "Content-Type: application/json" -d '{"key":"test-rules","value":{"enabled":true}}'
# 결과 확인
curl "http://localhost:3002/api/app-storage?key=test-rules"
```

---

## TODOs

- [ ] 1. 후처리 규칙 데이터 구조 및 기본값 파일 생성
  - **What to do**: `PostProcessingRules` 인터페이스 정의 및 `DEFAULT_POST_PROCESSING_RULES` 생성.
  - **File**: `services/shortsLabPostProcessingDefaults.ts`

- [ ] 2. 글로벌 후처리 규칙 매니저 및 훅 구현
  - **What to do**: `shortsLabPostProcessingManager` 클래스 생성 (JSON 저장/로드/백업 로직 포함).
  - **File**: `services/shortsLabPostProcessingManager.ts`, `hooks/useShortsLabPostProcessingManager.ts`

- [ ] 3. 쇼츠랩 설정 패널 UI 통합
  - **What to do**: `ShortsLabPanel.tsx`에 '후처리 규칙' 탭 추가 및 편집 UI 구현.
  - **File**: `components/ShortsLabPanel.tsx`

- [ ] 4. 후처리 로직 리팩토링 (로직 연동)
  - **What to do**: `postProcessAiScenes`, `enhanceScenePrompt` 등에서 하드코딩된 상수를 매니저에서 로드한 규칙으로 교체.
  - **File**: `components/ShortsLabPanel.tsx`, `services/labPromptBuilder.ts`

- [ ] 5. 백업/복원 및 리셋 기능 추가
  - **What to do**: 내보내기/가져오기 및 기본값으로 초기화 버튼 구현.
  - **File**: `components/ShortsLabPanel.tsx`

---

## Success Criteria

### Final Checklist
- [ ] 후처리 탭에서 "8k, masterpiece"를 "ultra realistic"으로 바꾸면 실제 프롬프트에 반영되는가?
- [ ] 창을 새로고침해도 후처리 설정값이 유지되는가?
- [ ] 백업 JSON 파일이 정상적으로 생성되고 다시 로드되는가?

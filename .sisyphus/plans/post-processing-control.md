# [Work Plan] 후처리 통제 시스템 및 장르 매니저 통합

## TL;DR

> **Quick Summary**: 장르 매니저에 '후처리' 탭을 신설하여, 시스템의 무분별한 프롬프트 간섭을 차단하고 마마님이 로직을 100% 통제할 수 있도록 함.
> 
> **Deliverables**: 
> - GenreManager UI (후처리 탭 및 설정 패널)
> - 후처리 On/Off 및 커스텀 클린업 로직
> - 장르별 설정 자동 백업 시스템
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES (Wave 1, 2)
> **Critical Path**: 데이터 스키마 확장 → UI 구현 → 후처리 엔진 연동

---

## Context

### Original Request
AI는 대본과 씬을 잘 만드는데, 시스템 후처리 과정에서 의상이 섞이거나 원본이 훼손되는 문제가 발생함. 이를 해결하기 위해 후처리 온/오프 기능과 장르 매니저에서의 직접 관리 기능을 요청함.

### Interview Summary
- **겨울 모드**: 이미 쇼츠랩에 토글이 있으므로 이를 연동함.
- **Safe Glamour**: 시스템이 강제로 넣던 화보용 태그이며, 이제 마마님이 장르별로 선택 가능함.
- **UI 구조**: 장르 매니저에 [후처리] 탭을 신설하여 관리함.
- **백업**: 설정 내용을 날짜별로 JSON 저장하여 안전하게 관리함.

---

## Work Objectives

### Core Objective
시스템의 일방적인 후처리를 중단하고, 장르별로 정의된 마마님의 규칙에 따라 프롬프트가 정제되도록 제어권을 이양함.

### Concrete Deliverables
- `types.ts`: 후처리 설정을 포함한 신규 장르 인터페이스
- `GenreManager.tsx`: [후처리] 탭 및 설정 편집 UI
- `ShortsLabPanel.tsx`: 장르 설정에 따른 조건부 후처리 로직
- `server/index.js`: 후처리 설정 저장 및 백업 API

### Definition of Done
- [ ] 장르 매니저에서 후처리를 끄면 생성된 프롬프트에 시스템 강제 문구(Red Tee 등)가 삽입되지 않음.
- [ ] 마마님이 설정한 '청소 패턴'이 AI 결과물에 정확히 적용됨.
- [ ] 장르 설정 변경 시 자동으로 백업 파일이 생성됨.

### Must Have
- 후처리 On/Off 스위치
- 커스텀 클린업(지우개) 패턴 설정 기능
- 장르별 백업/복원 기능

### Must NOT Have (Guardrails)
- **CRITICAL**: `bun` 명령어 사용 금지 (npm 사용)
- **CRITICAL**: `lsp_diagnostics` 사용 금지 (수동 점검 및 npm 테스트 사용)
- 마마님 승인 없는 기존 후처리 로직의 완전 삭제 (옵션화로 진행)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Playwright)
- **User wants tests**: YES (Manual + Playwright)
- **Framework**: Playwright / npm test

### Automated Verification
```bash
# UI 및 로직 검증 (Agent 실행)
npm run dev
# Playwright를 사용하여 장르 매니저 설정 변경 및 저장 확인
# 2단계 생성을 실행하여 프롬프트의 최종 변환 결과 검증
```

---

## TODOs

### Wave 1 (Start Immediately)

- [ ] 1. 장르 데이터 타입 정의 확장

  **What to do**:
  - `src/types.ts` (또는 해당 프로젝트의 타입 정의 파일)에서 `Genre` 인터페이스 수정.
  - `postProcessConfig`: `{ enabled: boolean, skipIdentity: boolean, cleanupPatterns: string[], customSuffix: string, useSafeGlamour: boolean }` 추가.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
  - **Reason**: 간단한 타입 수정 및 구조 정의.

  **Parallelization**: Wave 1 (with Task 2)

- [ ] 2. 장르 저장/로드 API 업데이트

  **What to do**:
  - `server/index.js` (또는 관련 API 파일)에서 장르 데이터를 저장할 때 신규 필드를 포함하도록 수정.
  - 데이터 유효성 검사 로직 추가.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`bash`]
  - **Reason**: 서버 측 엔드포인트 및 파일 시스템 핸들링.

  **Parallelization**: Wave 1 (with Task 1)

---

### Wave 2 (UI & Backup)

- [ ] 3. 장르 매니저 [후처리] 탭 및 패널 제작

  **What to do**:
  - `components/GenreManager.tsx`에 신규 탭 UI 추가.
  - On/Off 토글, 텍스트 편집기(클린업 패턴용) 배치.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**: Wave 2 (with Task 4)
  **Depends on**: 1, 2

- [ ] 4. 로직 백업/복구 기능 구현

  **What to do**:
  - 장르 설정 저장 시 `server/user_data_backups/` 폴더에 날짜별 JSON 백업 파일 생성 로직 구현.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`bash`]

  **Parallelization**: Wave 2 (with Task 3)

---

### Wave 3 (Engine Integration)

- [ ] 5. 후처리 엔진 로직 오버라이드 구현

  **What to do**:
  - `components/ShortsLabPanel.tsx`의 `composeManualPrompt` 및 `postProcessAiScenes` 함수 수정.
  - 현재 선택된 장르의 `postProcessConfig`를 읽어와서 간섭 여부 결정.
  - `enabled: false`일 경우 AI 원본 보존.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`oracle`]
  - **Reason**: 핵심 로직의 안정적인 분기 처리 필요.

  **Depends on**: 3

- [ ] 6. 최종 통합 테스트 및 씬 3번 오류 해결 확인

  **What to do**:
  - 실제 2단계 생성을 실행하여 "Red Tee" 등의 강제 삽입이 중단되고 마마님의 규칙이 적용되는지 확인.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

---

## Success Criteria
- [ ] 장르 매니저에서 후처리를 끄면 시스템 간섭이 0이 됨.
- [ ] 마마님이 설정한 '지우개 패턴'이 정확히 동작함.
- [ ] 설정 변경 시 자동 백업 파일이 생성됨.
- [ ] **BUN/LSP 사용 없이 안전하게 작업 완료.**

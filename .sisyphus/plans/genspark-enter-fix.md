# 워크플랜: 젠스파크(GenSpark) 전송 자동화(엔터 키) 수정

## TL;DR

> **Quick Summary**: 젠스파크 사용 시 프롬프트 전송이 되지 않아 수동으로 엔터를 쳐야 하는 문제를 해결하기 위해, 전송 로직을 버튼 클릭 방식에서 '엔터 키 입력' 방식으로 전환합니다.
> 
> **Deliverables**:
> - `server/puppeteerHandler.js`: 젠스파크 전송 로직 수정
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: NO
> **Critical Path**: `server/puppeteerHandler.js` 수정 → 동작 확인

---

## Context

### Original Request
젠스파크 선택 시 프롬프트는 입력되지만 엔터가 쳐지지 않아 매번 수동으로 입력해야 하는 불편함 해결 요청.

### Interview Summary
**Key Discussions**:
- 젠스파크는 현재 버튼 클릭 기반 전송 그룹에 속해 있음.
- 버튼 클릭 실패 시 엔터 폴백으로 넘어가지 못하고 멈추는 현상 발생.
- 제미나이/클로드와 같이 '엔터 키 전송' 그룹으로 이동시키기로 결정.

---

## Work Objectives

### Core Objective
젠스파크 프롬프트 입력 후 시스템이 자동으로 엔터 키를 눌러 전송을 완료하도록 보장.

### Concrete Deliverables
- `server/puppeteerHandler.js`: `sendPromptToPage` 함수 내 서비스 체크 로직 업데이트.

### Definition of Done
- [ ] 젠스파크 선택 후 대본 생성 시, 프롬프트 입력 직후 수동 개입 없이 생성 과정이 시작됨.

### Must Have
- `GENSPARK` 서비스를 `Enter` 전송 그룹에 포함.

### Must NOT Have (Guardrails)
- 타 서비스(Gemini, Claude 등)의 전송 로직에 영향을 주지 말 것.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Manual-only (브라우저 제어 특성상 실제 서비스 동작 확인이 가장 확실함)
- **QA approach**: 젠스파크 모드에서 테스트 프롬프트 전송 후 자동 전송 여부 확인.

---

## TODOs

- [ ] 1. 젠스파크 전송 로직 수정 (`server/puppeteerHandler.js`)

  **What to do**:
  - `sendPromptToPage` 함수(946라인 근처)의 `if` 조건문에 `'GENSPARK'` 추가.
  - 수정 전: `if (serviceName === 'CLAUDE' || serviceName === 'GEMINI' || serviceName === 'DEEPSEEK')`
  - 수정 후: `if (serviceName === 'CLAUDE' || serviceName === 'GEMINI' || serviceName === 'DEEPSEEK' || serviceName === 'GENSPARK')`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`] (브라우저 핸들러 수정 전문)

  **Acceptance Criteria**:
  - [ ] 코드 수정 후 젠스파크에서 엔터 키가 자동으로 입력됨.

- [ ] 2. 최종 동작 확인

  **What to do**:
  - 젠스파크 서비스로 전환하여 대본 생성 시도.
  - 엔터 키 수동 입력 없이 응답 대기 상태로 넘어가는지 확인.

  **Acceptance Criteria**:
  - [ ] 전송 성공 및 응답 텍스트 수집 시작 확인.

---

## Success Criteria

### Final Checklist
- [ ] 젠스파크 자동 전송 성공 여부
- [ ] 타 서비스 정상 작동 유지 여부

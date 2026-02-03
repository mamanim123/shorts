# 이미지 생성 엔진 ReferenceError 및 동시성 락(Lock) 오류 수정 계획

## TL;DR

> **Quick Summary**: 최근 리팩토링 과정에서 삭제된 글로벌 변수(`scriptCdpClient`)를 참조하여 발생하는 500 에러를 해결하고, 이미지 생성 중 세션 충돌을 방지하기 위한 비동기 락 시스템을 완벽하게 구현합니다.
> 
> **Deliverables**: 
> - `server/puppeteerHandler.js` 수정 (ReferenceError 해결 및 락 적용)
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: NO
> **Critical Path**: `submitPromptAndCaptureImage` 내의 미정의 변수 참조 제거 및 로컬 세션 관리 도입

---

## Context

### Original Request
쇼츠랩 미리보기에서 이미지 생성 시 `ReferenceError: scriptCdpClient is not defined` 에러가 발생함. 서버 로그 확인 결과 `puppeteerHandler.js` 1455행에서 에러 발생.

### Interview Summary
- 원인: 동시성 해결을 위해 글로벌 `scriptCdpClient`를 제거했으나, 함수 내부에서 여전히 이를 참조하고 있음.
- 해결: 함수 내부에서 로컬 `cdpClient`를 생성하고, `acquireLock`을 통해 한 번에 하나의 캡처만 진행되도록 보장함.

---

## Work Objectives

### Core Objective
이미지 생성 엔진의 치명적 오류를 해결하고, 여러 이미지를 동시에 생성할 때 발생하는 브라우저 세션 충돌 문제를 안정적으로 차단함.

### Concrete Deliverables
- `server/puppeteerHandler.js`: `submitPromptAndCaptureImage` 함수 내의 `scriptCdpClient` 참조를 로컬 변수로 교체 및 `acquireLock/releaseLock` 적용.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Manual (AI 이미지 생성 테스트)

### Automated Verification (Agent-Executable):
- 없음 (브라우저 자동화 특성상 실제 UI 동작 확인 권장)

---

## TODOs

- [ ] 1. puppeteerHandler.js 수정
  - **What to do**: 
    - `submitPromptAndCaptureImage` 함수 시작 시 `const releaseLock = await acquireLock();` 호출.
    - 기존의 글로벌 `scriptCdpClient` 체크 및 분리(`detach`) 로직 삭제.
    - 함수 내부에서 `const cdpClient = await scriptPage.createCDPSession();`으로 로컬 세션 생성.
    - `finally` 블록에서 `cdpClient.detach()` 및 `releaseLock()` 호출 보장.
  - **File**: `server/puppeteerHandler.js`

---

## Success Criteria

### Final Checklist
- [ ] 이미지 생성 버튼 클릭 시 `scriptCdpClient is not defined` 에러가 더 이상 발생하지 않는가?
- [ ] 여러 장면을 동시에 [AI 생성] 했을 때, 에러 없이 순차적으로 이미지가 생성되는가?
- [ ] 생성된 이미지가 지정된 폴더에 정상적으로 저장되고 화면에 표시되는가?

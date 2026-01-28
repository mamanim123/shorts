# 2단계 생성 로직 통합 및 폴더 관리 개선 계획

## TL;DR

> **Quick Summary**: 쇼츠랩의 '2단계 생성' 과정을 백엔드로 통합하여 폴더 난립을 방지하고, 대본 데이터 노출 문제를 해결하며, 빈 폴더를 자동으로 정리하는 안정적인 시스템을 구축합니다.
> 
> **Deliverables**:
> - 백엔드 통합 엔드포인트 `/api/generate/lab-two-step`
> - 빈 폴더 자동 정리 유틸리티 및 API
> - 프론트엔드 호출 로직 및 데이터 파싱 개선
> - Playwright 기반 E2E 테스트 스크립트
> 
> **Estimated Effort**: Short (약 3-4시간)
> **Parallel Execution**: NO - 순차적 구현 권장 (백엔드 -> 프론트엔드 -> 테스트)
> **Critical Path**: 백엔드 엔드포인트 구현 → 프론트엔드 연동 → 테스트 검증

---

## Context

### Original Request
- 2단계 생성 시 폴더가 여러 개 생기고 관리가 불편함.
- 대본 입력 탭에 이미지 프롬프트 등 모든 내용이 보여서 지저분함.
- 폴더 선택 시 내용이 없다고 나오는 "빈 폴더" 문제 해결 필요.

### Interview Summary
**Key Discussions**:
- **통합 방식**: 프론트엔드 체이닝 대신 백엔드에서 모든 단계를 처리하는 오케스트레이션 방식 채택.
- **빈 폴더 정리**: 파일과 이미지가 모두 없는 폴더를 대상으로 일괄 삭제 로직 포함.
- **자동화 테스트**: Playwright를 사용하여 생성 및 로드 과정을 검증하기로 함.

**Research Findings**:
- 현재 `ShortsLabPanel.tsx`에서 3번의 API 호출을 수동으로 수행 중.
- 백엔드 `/api/generate/raw`는 호출마다 새로운 파일을 생성하는 구조임.
- 폴더 로드 시 JSON과 일반 텍스트가 섞인 결과물에서 대본 본문만 추출하는 로직이 미흡함.

### Metis/Oracle Review
**Identified Gaps (addressed)**:
- **중간 실패 처리**: 중간 단계 실패 시 부분 산출물을 남기지 않도록 예외 처리 강화.
- **빈 폴더 정의**: `.txt` 파일 0개 AND 이미지 파일 0개인 경우로 정의하여 안전하게 삭제.
- **테스트 격리**: Playwright 테스트 시 실제 데이터와 분리된 환경(또는 모킹) 고려.

---

## Work Objectives

### Core Objective
쇼츠랩 2단계 생성의 안정성을 높이고 사용자 경험을 개선하기 위해 백엔드 중심의 처리 구조로 전환한다.

### Concrete Deliverables
- `server/index.js`: `/api/generate/lab-two-step` 신규 엔드포인트
- `server/index.js`: `/api/scripts/cleanup-empty-folders` (POST) 신규 엔드포인트
- `components/ShortsLabPanel.tsx`: `handleTwoStepGenerate` 및 `handleSelectFolder` 로직 수정
- `tests/e2e/shorts-lab-consolidation.spec.ts`: Playwright 테스트 파일

### Definition of Done
- [ ] 2단계 생성 버튼 클릭 시 폴더가 단 **하나**만 생성됨.
- [ ] 생성 완료 후 '대본 입력' 창에 이미지 프롬프트가 섞이지 않고 **대본 텍스트**만 표시됨.
- [ ] 빈 폴더 정리 API 호출 시 유효한 데이터가 없는 폴더가 삭제됨.
- [ ] Playwright 테스트가 모두 통과함.

### Must Have
- 백엔드 단계별 예외 처리 (Try-Catch 및 중간 데이터 휘발화).
- 최종 결과물에 대한 명확한 JSON 구조 보장 (`scriptText` 필드 포함).
- 기존 폴더 로드 로직 하위 호환성 유지.

### Must NOT Have (Guardrails)
- 생성 중인 폴더를 삭제하지 않도록 최소 5분 이상의 생성 시간 유예를 둠.
- LSP(`bun`, `lsp_diagnostics`) 사용 금지.
- API 키를 코드나 로그에 노출하지 않음.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Playwright)
- **User wants tests**: YES (Playwright)
- **Framework**: Playwright

### QA approach: Automated E2E
- 2단계 생성 프로세스 전체를 시뮬레이션하여 폴더 생성 개수와 데이터 표시 상태를 검증합니다.

---

## Execution Strategy

### Parallel Execution Waves
1. **Wave 1 (Backend Core)**: 백엔드 통합 엔드포인트 및 정리 로직 구현.
2. **Wave 2 (Frontend Integration)**: 프론트엔드 호출 로직 변경 및 UI 파싱 개선.
3. **Wave 3 (Validation)**: Playwright 테스트 작성 및 실행, 최종 검증.

---

## TODOs

- [ ] 1. 백엔드: 2단계 통합 엔드포인트 구현

  **What to do**:
  - `server/index.js`에 `app.post('/api/generate/lab-two-step', ...)` 추가.
  - 내부에서 `characterExtractPrompt`, `sceneDecompPrompt`를 순차적으로 생성/처리.
  - 중간 과정에서는 `skipFolderCreation: true`를 사용하여 파일을 저장하지 않음.
  - 최종 씬 분해 결과만 하나의 폴더에 저장.
  - 응답 시 `scriptText` 필드를 명시적으로 포함하여 반환.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`writing`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 2, Task 3

  **References**:
  - `server/index.js:671` - 기존 `/api/generate/raw` 구현 참고
  - `components/ShortsLabPanel.tsx:2930` - 기존 프론트엔드 2단계 로직 참고

  **Acceptance Criteria**:
  - [ ] `/api/generate/lab-two-step` 호출 시 최종 결과 JSON이 성공적으로 반환됨.
  - [ ] 서버 로그에서 중간 과정 파일 저장이 생략됨을 확인.

- [ ] 2. 백엔드: 빈 폴더 정리 로직 구현

  **What to do**:
  - `server/index.js`에 `SCRIPTS_BASE_DIR` 내의 폴더들을 순회하며 `.txt` 파일이 없고 `images/` 폴더 내에 이미지가 없는 폴더를 식별하는 함수 작성.
  - 생성된 지 5분이 지난 폴더만 삭제하도록 안전장치 추가.
  - `/api/scripts/cleanup-empty-folders` 엔드포인트로 노출.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`

  **Acceptance Criteria**:
  - [ ] 빈 폴더가 실제로 삭제되는지 `fs.existsSync` 등으로 확인.

- [ ] 3. 프론트엔드: 호출 로직 및 UI 파싱 개선

  **What to do**:
  - `ShortsLabPanel.tsx`의 `handleTwoStepGenerate`를 수정하여 새로 만든 백엔드 엔드포인트를 단 한 번만 호출하도록 변경.
  - `handleSelectFolder`에서 서버로부터 받은 `scriptText` 또는 파싱된 결과를 UI에 반영할 때, 이미지 프롬프트를 제외한 순수 대본만 `setScriptInput`에 전달하도록 정규식 개선.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Acceptance Criteria**:
  - [ ] 2단계 생성 후 대본 탭에 대본만 보임.
  - [ ] 폴더 로드 시 동일하게 대본만 보임.

- [ ] 4. Playwright E2E 테스트 작성

  **What to do**:
  - `tests/e2e/shorts-lab-consolidation.spec.ts` 작성.
  - 대본 생성 버튼 클릭 -> 완료 대기 -> 생성된 폴더 개수 확인 -> UI 텍스트 내용 확인.
  - 빈 폴더 생성 후 정리 API 호출 테스트 포함.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`playwright`]

  **Acceptance Criteria**:
  - [ ] `npx playwright test tests/e2e/shorts-lab-consolidation.spec.ts` -> PASS

---

## Success Criteria

### Verification Commands
```bash
# 서버 실행
npm run server

# 테스트 실행
npx playwright test tests/e2e/shorts-lab-consolidation.spec.ts
```

### Final Checklist
- [ ] 2단계 생성 시 단일 폴더 생성 확인.
- [ ] 대본 입력창 클린업 확인.
- [ ] 빈 폴더 자동 삭제 확인.
- [ ] 모든 E2E 테스트 통과.

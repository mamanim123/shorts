# AI Studio 썸네일 무한 로딩 및 창 닫힘 이슈 해결 계획서

## TL;DR

> **Quick Summary**: `ThumbnailStudio`의 무한 리렌더링 루프를 제거하고, 이벤트 전파 차단 및 누락된 상태 정의를 통해 시스템 안정성을 복구합니다.
> 
> **Deliverables**:
> - `ThumbnailStudio.tsx` 무한 루프 수정 및 알림 상태 추가
> - `ShortsImageHistorySidebar.tsx` 및 `ImageHistorySidebar.tsx` 편집 기능 연결 및 이벤트 전파 차단
> - Playwright 기반 통합 테스트 시나리오
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - 순차적 수정 권장 (컴포넌트 간 의존성 때문)
> **Critical Path**: ThumbnailStudio 무한 루프 수정 → Sidebar 이벤트 차단 → 통합 검증

---

## Context

### Original Request
- 썸네일 스튜디오 우측 사이드바 무한 로딩 현상.
- 메뉴 클릭 시 AI Studio 창 전체가 닫히는 현상.

### Interview Summary
**Key Discussions**:
- 마마님께서 분석 내용에 동의하심.
- 무한 루프와 이벤트 전파 문제가 복합적으로 작용하고 있음을 확인.

**Research Findings**:
- `ThumbnailStudio.tsx`의 `useEffect` 의존성 배열에 `historyImages`가 포함되어 있어, 상태 업데이트 시마다 이펙트가 재실행되는 무한 루프 발견.
- `setNotification` 함수가 정의되지 않은 채 사용되어 런타임 에러 발생 중.
- 사이드바 메뉴 클릭 시 `onClose`가 트리거되는 현상은 이벤트 버블링 또는 비정상적인 상태 업데이트로 인한 것으로 추정.

---

## Work Objectives

### Core Objective
- AI Studio 내 썸네일 스튜디오의 성능 저하 및 비정상 종료 이슈를 해결하여 사용자 경험을 정상화함.

### Concrete Deliverables
- `F:\test\쇼츠대본생성기-v3.5.3\components\master-studio\studios\ThumbnailStudio.tsx` 수정
- `F:\test\쇼츠대본생성기-v3.5.3\components\master-studio\ImageHistorySidebar.tsx` 수정
- `F:\test\쇼츠대본생성기-v3.5.3\components\ShortsImageHistorySidebar.tsx` 수정
- `F:\test\쇼츠대본생성기-v3.5.3\tests\ai-studio-fix.spec.ts` (신규 테스트 파일)

### Definition of Done
- [ ] `ThumbnailStudio` 진입 시 더 이상 무한 리렌더링이 발생하지 않음 (콘솔 확인).
- [ ] 우측 히스토리 사이드바에 이미지가 정상적으로 로드됨.
- [ ] 사이드바 메뉴(즐겨찾기, 복사, 삭제, 편집) 클릭 시 AI Studio 창이 유지됨.
- [ ] `setNotification` 관련 에러가 사라지고 알림 메시지가 화면에 표시됨.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> ALL verification is executed by the agent using tools (Playwright, interactive_bash, curl, etc.). No exceptions.

### Agent-Executed QA Scenarios

Scenario: 썸네일 스튜디오 무한 로딩 및 창 유지 검증
  Tool: Playwright (playwright skill)
  Preconditions: 개발 서버 실행 중 (localhost:3000)
  Steps:
    1. Navigate to: http://localhost:3000
    2. AI Studio 열기 (관련 버튼 클릭)
    3. 썸네일 스튜디오 메뉴 클릭
    4. 브라우저 콘솔 로그 모니터링 → 동일한 URL 요청이 반복되는지 확인
    5. 우측 사이드바의 특정 버튼(즐겨찾기 등) 클릭
    6. Assert: `MasterStudioContainer`가 여전히 DOM에 존재하는지 확인
    7. Screenshot: .sisyphus/evidence/thumbnail-studio-stability.png
  Expected Result: 무한 루프 없음, 창 닫힘 없음.
  Evidence: .sisyphus/evidence/thumbnail-studio-stability.png

Scenario: 알림 메시지 노출 검증
  Tool: Playwright
  Preconditions: 썸네일 스튜디오 진입 상태
  Steps:
    1. 히스토리 아이템의 '편집' 버튼 클릭 (수정 예정인 기능)
    2. Assert: "이미지 스튜디오에서 편집을 계속하세요." 메시지가 화면에 노출되는지 확인
    3. Screenshot: .sisyphus/evidence/notification-check.png
  Expected Result: 알림 토스트가 정상적으로 나타남.

---

## TODOs

- [ ] 1. `ThumbnailStudio.tsx` 무한 루프 수정 및 알림 상태 추가

  **What to do**:
  - `useEffect` (URL 로딩 로직)의 의존성 배열에서 `historyImages` 제거.
  - `setHistoryImages` 호출 시 함수형 업데이트(`prev => ...`)를 사용하고, `resolveImageHistoryUrls` 호출 시 `historyImages` 대신 `prev`를 참조하도록 로직 변경하거나 이펙트 실행 조건을 `historyItems` 변경으로만 한정.
  - `const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);` 추가.
  - JSX 하단에 `notification`이 있을 때 토스트를 보여주는 UI 코드 추가 (ImageStudio 참고).

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  - **Reason**: 컴포넌트의 상태 로직과 UI 렌더링 수정이 필요함.

  **Parallelization**: NO (Sequential)

  **References**:
  - `components/master-studio/studios/ImageStudio.tsx:249, 1870` - Notification 상태 정의 및 UI 구현 사례

  **Acceptance Criteria**:
  - 콘솔에 무한 루프성 로그가 기록되지 않음.
  - 알림 상태가 정상적으로 정의되어 LSP 에러 해결.

- [ ] 2. `ShortsImageHistorySidebar.tsx` 및 `ImageHistorySidebar.tsx` 편집 기능 연결

  **What to do**:
  - `ShortsImageHistorySidebar.tsx`의 Props 인터페이스에 `onEdit` 추가.
  - 각 아이템 렌더링 부분에 `onEdit`이 있을 경우 '편집' 버튼(Pencil 아이콘 등) 추가.
  - `ImageHistorySidebar.tsx`에서 프롭으로 받은 `onEdit`을 `ShortsImageHistorySidebar`에 전달.
  - 클릭 이벤트에 `e.stopPropagation()`을 확실히 적용하여 버블링 방지.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]
  - **Reason**: 공용 사이드바 컴포넌트의 Props 확장 및 UI 요소 추가.

  **Acceptance Criteria**:
  - 사이드바 내 모든 아이콘 버튼 클릭 시 이벤트가 상위로 전파되지 않음.
  - 편집 버튼이 정상적으로 나타나고 클릭 가능함.

- [ ] 3. 통합 검증 및 테스트

  **What to do**:
  - Playwright 테스트 스크립트 작성 및 실행.
  - 썸네일 스튜디오 진입 및 사이드바 상호작용 시 비정상 종료 여부 확인.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`playwright`]
  - **Reason**: 자동화 테스트를 통한 최종 검증.

---

## Success Criteria

### Verification Commands
```bash
# Playwright 테스트 실행
npx playwright test tests/ai-studio-fix.spec.ts
```

### Final Checklist
- [ ] 무한 루프 해결 완료
- [ ] 창 닫힘 이슈 해결 완료
- [ ] 알림 시스템 복구 완료
- [ ] 에디트 기능 정상 연결 완료

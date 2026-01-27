# ShortsLab 2단계 규칙 관리 플랜

## Context

### Original Request
쇼츠랩 입력탭의 2단계생성 버튼에서 사용되는 프롬프트를 쉽게 관리하고, 장르 관리 모달에 "2단계규칙" 탭을 추가하여 3종 프롬프트(대본/인물설정/최종 이미지 프롬프트)를 편집·백업·복구하고 싶음.

### Interview Summary
**Key Discussions**:
- 2단계 규칙은 전체 공통 규칙(글로벌)로 관리.
- 규칙 수정 후 백업/복구 가능해야 하며 백업 보관은 2개 고정.
- 테스트 러너는 없으므로 수동 검증만 진행.
- bun/lsp 도구 사용 금지.

**Research Findings**:
- `components/ShortsLabPanel.tsx`에 장르 관리/프롬프트 규칙 탭 UI와 `handleTwoStepGenerate`가 있음.
- `hooks/useShortsLabPromptRulesManager.ts`가 프롬프트 규칙 저장/백업 패턴을 제공.
- `services/labPromptBuilder.ts`와 `services/manualSceneBuilder.ts`가 2단계 생성 프롬프트 템플릿을 담당.

### Metis Review
**Identified Gaps (addressed)**:
- (No feedback returned)

---

## Work Objectives

### Core Objective
쇼츠랩 2단계 생성에서 사용하는 3종 프롬프트를 UI에서 편집/백업/복구할 수 있게 하고, 실제 2단계 생성 흐름에 적용되도록 한다.

### Concrete Deliverables
- 장르 관리 모달에 "2단계규칙" 탭 UI 및 편집/백업/복구 기능 추가.
- 2단계 규칙 저장/백업 로직(백업 2개 제한) 구현.
- 2단계 생성 로직이 새 규칙을 사용하도록 연결.

### Definition of Done
- [ ] 2단계규칙 탭에서 3종 프롬프트를 저장/복구할 수 있다.
- [ ] 백업은 2개까지만 유지되고, 복구 시 UI가 즉시 반영된다.
- [ ] 2단계 생성 요청에 새 프롬프트가 반영된다(네트워크 payload 확인).

### Must Have
- 3개의 편집 영역(대본/인물설정/최종 이미지 프롬프트) 제공.
- 백업 2개 고정 정책.

### Must NOT Have (Guardrails)
- 다른 모드(시네보드/AI Studio 등) UI나 프롬프트 로직 변경 금지.
- bun/lsp 사용 금지.

---

## Verification Strategy (Manual Only)

### Test Decision
- **Infrastructure exists**: NO (표준 테스트 러너 없음)
- **User wants tests**: Manual-only

### Manual QA Checklist
- 2단계규칙 탭에서 3개 프롬프트 입력 후 저장 → 모달 재오픈 시 값 유지.
- 백업 2개 생성 후 3번째 백업 시 가장 오래된 백업이 자동 교체되는지 확인.
- 백업 복구 버튼으로 값이 즉시 복원되는지 확인.
- 2단계 생성 실행 후 브라우저 네트워크 탭에서 `/api/generate/raw` 요청 payload에 수정된 프롬프트 문자열이 포함되는지 확인.

---

## Task Flow

```
Task 1 → Task 2 → Task 3
```

---

## UI Mockup (Placement)

### 장르 관리 모달 탭 구조

```
┌───────────────────────────────────────────────┐
│ 쇼츠랩 장르 매니저                              │
├───────────────┬───────────────────────────────┤
│ 탭 버튼        │  [장르 관리] [프롬프트 규칙]   │
│               │  [2단계규칙]                  │
├───────────────┴───────────────────────────────┤
│ 2단계규칙 탭 본문                                │
│ ┌───────────────────────────────────────────┐ │
│ │ 1) 대본 생성 프롬프트                        │ │
│ │ [textarea: script_prompt]                  │ │
│ └───────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────┐ │
│ │ 2) 인물설정 프롬프트                         │ │
│ │ [textarea: character_prompt]               │ │
│ └───────────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────┐ │
│ │ 3) 최종 이미지 프롬프트(대본+인물 결합)       │ │
│ │ [textarea: final_image_prompt]             │ │
│ └───────────────────────────────────────────┘ │
│  [기본값 초기화] [저장] [백업 생성]              │
│  백업 리스트 (최대 2개): 보기/편집 | 복구 | 삭제 │
└───────────────────────────────────────────────┘
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1, 2 | 독립적이며 UI/저장 로직 분리 가능 |

| Task | Depends On | Reason |
|------|------------|--------|
| 3 | 1, 2 | 저장 규칙과 UI가 준비되어야 연결 가능 |

---

## TODOs

- [ ] 1. 2단계 규칙 저장/백업 구조 정의

  **What to do**:
  - 2단계 규칙의 데이터 구조(3개 프롬프트 필드) 정의.
  - 저장/로드/백업/복구 흐름 설계 (백업 2개 제한).
  - 기존 프롬프트 규칙 관리 패턴을 참고해 새 매니저/훅 구성.

  **Must NOT do**:
  - 기존 프롬프트 규칙 백업 정책(최대 5개 등)을 변경하지 않기.

  **Parallelizable**: YES (with 2)

  **References**:
  - `hooks/useShortsLabPromptRulesManager.ts` - 규칙 로드/저장/백업 훅 패턴 참고.
  - `SHORTS_LAB_PROMPT_RULES_CHANGES_20260123.md` - 프롬프트 규칙 탭/백업 UX 의도 참고.

  **Acceptance Criteria**:
  - [ ] 규칙 데이터 구조가 3개 텍스트 필드로 정의됨.
  - [ ] 백업이 2개까지만 유지되도록 정책이 명시됨.
  - [ ] 저장/복구 실패 시 에러 메시지 경로가 정의됨.

- [ ] 2. 장르 관리 모달에 "2단계규칙" 탭 UI 추가

  **What to do**:
  - `ShortsLabPanel` 장르 관리 모달 탭에 2단계규칙 추가.
  - 3개 프롬프트 편집 영역 + 저장/초기화/백업/복구 UI 구성.
  - 백업 리스트 최대 2개 유지 및 교체 시 안내 문구 제공.

  **Must NOT do**:
  - 기존 "프롬프트 규칙" 탭 기능/레이아웃 훼손 금지.

  **Parallelizable**: YES (with 1)

  **References**:
  - `components/ShortsLabPanel.tsx` - 장르 관리 모달 구조와 기존 프롬프트 규칙 탭 UI.
  - `hooks/useShortsLabPromptRulesManager.ts` - 저장/백업 호출 패턴.

  **Acceptance Criteria**:
  - [ ] 2단계규칙 탭이 보이고 3개 텍스트 영역이 표시됨.
  - [ ] 저장/백업/복구 버튼이 동작하고 토스트/에러 처리 확인됨.
  - [ ] 백업 리스트가 2개를 넘지 않음.

- [ ] 3. 2단계 생성 로직에 새 규칙 적용

  **What to do**:
  - 2단계 생성 프롬프트 빌더에 새 규칙을 주입.
  - `buildLabScriptOnlyPrompt`, `buildCharacterExtractionPrompt`, `buildManualSceneDecompositionPrompt` 또는 최종 합성 단계에 새 템플릿 반영.
  - `handleTwoStepGenerate`가 저장된 규칙을 읽어 LLM 요청에 포함하도록 연결.

  **Must NOT do**:
  - 기존 2단계 생성 흐름(대본 → 인물 추출 → 씬 분해) 변경 금지.

  **Parallelizable**: NO (depends on 1, 2)

  **References**:
  - `components/ShortsLabPanel.tsx` - `handleTwoStepGenerate` 흐름.
  - `services/labPromptBuilder.ts` - 1단계 대본 프롬프트 생성.
  - `services/manualSceneBuilder.ts` - 인물/씬 프롬프트 생성.

  **Acceptance Criteria**:
  - [ ] 저장된 규칙이 2단계 생성 요청 payload에 포함됨.
  - [ ] 수정 전/후 프롬프트가 네트워크 payload에서 확인됨.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1-3 | `feat: add step2 prompt rules editor` | UI, hooks, services | Manual QA checklist |

---

## Success Criteria

### Verification Commands
```bash
npm run dev
```

### Final Checklist
- [ ] 2단계규칙 탭에서 3종 프롬프트 저장/복구 가능
- [ ] 백업 2개 제한 동작 확인
- [ ] 2단계 생성 요청에 수정된 프롬프트 반영 확인

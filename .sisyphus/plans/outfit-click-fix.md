# 의상 리스트 클릭 시 편집 창 자동 열기 기능 구현

## TL;DR

> **Quick Summary**: 쇼츠랩 의상추출 탭에서 의상 리스트를 클릭했을 때, 단순히 선택만 되는 것이 아니라 편집 및 이미지 생성 창(모달)이 즉시 열리도록 개선합니다.
> 
> **Deliverables**: 
> - `components/CharacterPanel.tsx` 수정
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: NO
> **Critical Path**: `handleSelectOutfit` 및 `handleSelectBaseOutfit` 함수 수정

---

## Context

### Original Request
쇼츠랩에 입력탭에 의상추출 탭이 있는데 여기서 의상리스트를 누르면 프롬프트와 의상이미지를 만들수 있는 창이 나왔는데 그창이 안나오내? 왜 안나오는지 확인해줘.

### Interview Summary
**Key Discussions**:
- 리스트 클릭 시 선택 로직만 작동하고 모달 열기 로직이 누락됨을 확인.
- 연필 아이콘 클릭 시와 동일하게 리스트 항목 클릭 시에도 모달이 열리도록 통일하기로 결정.

---

## Work Objectives

### Core Objective
의상 리스트 클릭 시 사용자 경험을 직관적으로 개선하여, 추가적인 아이콘 클릭 없이도 편집 창에 진입할 수 있게 함.

### Concrete Deliverables
- `components/CharacterPanel.tsx`: `handleSelectOutfit` 및 `handleSelectBaseOutfit`에 `openOutfitEditModal()` 호출 추가.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Manual-only (UI 동작 확인)

### Automated Verification (Agent-Executable):
- 없음 (UI 인터랙션은 수동 확인 권장)

---

## TODOs

- [ ] 1. CharacterPanel.tsx 수정
  - **What to do**: 
    - `handleSelectOutfit` 함수 끝에 `openOutfitEditModal(outfit)` 추가.
    - `handleSelectBaseOutfit` 함수 끝에 기본 의상 정보를 `UserOutfit` 형식으로 변환하여 `openOutfitEditModal` 호출.
  - **File**: `components/CharacterPanel.tsx`

---

## Success Criteria

### Final Checklist
- [ ] 의상 리스트의 항목을 클릭했을 때 편집 모달이 정상적으로 열리는가?
- [ ] 기본 의상 리스트 항목을 클릭했을 때도 편집 모달이 열리는가?
- [ ] 모달 내부에서 프롬프트 수정 및 이미지 생성이 정상적으로 작동하는가?

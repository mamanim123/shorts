# 쇼츠랩 이미지 프롬프트 '쌍둥이 현상' 및 의상 중복 문제 해결 계획

## TL;DR

> **Quick Summary**: 쇼츠랩 대본 생성 시 여러 인물(특히 남성 캐릭터)이 동일한 외모와 의상으로 렌더링되는 '쌍둥이 현상'을 해결하고, 로맨스 장르의 표정 키워드가 정상 작동하도록 프롬프트 생성 로직을 전면 수정합니다.
> 
> **Deliverables**: 
> - `romance-flutter` 장르 ID 동기화 및 전용 표정 키워드 수정
> - 인물별(ManA vs ManB, WomanA vs WomanB) 차별화된 외모 토큰(Identity Token) 주입 로직
> - 멀티 캐릭터 장면에서 단일 의상 태그(`Outfit: ...`)가 색상을 덮어씌우는 버그 수정
> - `shortPrompt` 내에 인물별 핵심 의상 색상 정보 포함 로직 추가
> 
> **Estimated Effort**: Short (~2h)
> **Parallel Execution**: NO - sequential (Logic change -> Verification)
> **Critical Path**: 장르 ID 수정 → 외모 차별화 로직 → 의상 태그 버그 수정

---

## Context

### Original Request
마마님께서 제공하신 이미지에서 두 남성이 동일한 외모와 흰색 의상을 입고 쌍둥이처럼 나오는 문제를 제기하셨습니다. 프롬프트에는 다른 의상이 지정되어 있음에도 결과물이 중복되는 현상과 로맨스 장르의 분위기가 제대로 살지 않는 문제를 해결해야 합니다.

### Interview Summary
**Key Discussions**:
- **장르 ID 불일치**: UI/코드 상의 `romance-flutter`와 규칙 설정의 `romance-thrill`이 달라 기본 표정만 사용됨.
- **아이덴티티 중복**: ManA, ManB 모두 "잘생긴 40대 한국 남성"이라는 동일 문구를 사용하여 AI가 한 인물로 인식.
- **의상 태그 오버라이딩**: 프롬프트 마지막에 ManA의 의상만 붙는 로직 때문에 ManB의 색상 정보가 무시됨(색상 전이 현상).
- **폭설 배경의 영향**: 하얀 배경에서 색상 대비가 약화되므로 더 강렬한 색상 묘사가 필요함.

---

## Work Objectives

### Core Objective
멀티 캐릭터 장면에서 인물들이 각자의 정체성(외모, 의상 색상)을 유지하며 생성되도록 프롬프트 생성 엔진을 고도화합니다.

### Concrete Deliverables
- `services/shortsLabPromptRulesDefaults.ts`: `expressionKeywords`에 `romance-flutter` 추가.
- `services/labPromptBuilder.ts`: `enhanceScenePrompt` 함수 내 의상 태그 삽입 조건 수정.
- `services/labPromptBuilder.ts`: 캐릭터별 `identity` 문자열을 동적으로 차별화하는 로직 추가.
- `services/labPromptBuilder.ts`: `shortPrompt` 생성 시 인물별 색상 키워드 주입.

### Definition of Done
- [ ] 로맨스 장르 생성 시 `romance-thrill`의 설레는 표정 키워드가 프롬프트에 포함됨.
- [ ] 투샷/쓰리샷 장면에서 각 인물의 외모 묘사(Identity)가 서로 다르게 생성됨.
- [ ] 프롬프트 맨 뒤에 붙는 단일 `Outfit: ...` 태그가 멀티샷 장면에서는 제거됨.
- [ ] 생성된 프롬프트에 `not twins`, `distinct individuals`와 같은 분리 키워드가 포함됨.

---

## Verification Strategy

### Agent-Executed QA Scenarios

```
Scenario: 로맨스 장르 표정 키워드 작동 확인
  Tool: Bash
  Steps:
    1. services/labPromptBuilder.ts를 읽어 enhanceScenePrompt에 'romance-flutter' 장르를 전달하는 테스트 코드 실행
    2. 생성된 프롬프트 맨 앞에 'shy blushing smile' 또는 'heart-fluttering gaze'가 포함되어 있는지 확인
  Expected Result: 로맨스 전용 표정 키워드가 정상 주입됨.

Scenario: 멀티 캐릭터 외모 차별화 확인
  Tool: Bash
  Steps:
    1. ManA와 ManB가 포함된 투샷 시나리오로 프롬프트 빌더 실행
    2. [Person 1]과 [Person 2]의 identity 묘사(예: facial features)가 서로 다른 단어로 구성되었는지 확인
  Expected Result: "not twins", "distinct faces" 등의 키워드와 함께 서로 다른 외모 묘사가 포함됨.

Scenario: 의상 색상 덮어쓰기 방지 확인
  Tool: Bash
  Steps:
    1. 투샷 시나리오 프롬프트 결과의 맨 마지막 부분 확인
    2. ", Outfit: [의상명]" 태그가 존재하지 않거나, 각 인물 블록 내에만 존재함을 확인
  Expected Result: 맨 뒤에 단일 의상을 강제하는 태그가 붙지 않음.
```

---

## TODOs

- [ ] 1. 장르 ID 동기화 및 표정 키워드 수정

  **What to do**:
  - `services/shortsLabPromptRulesDefaults.ts`의 `expressionKeywords`에 `romance-flutter` 키를 추가하고 `romance-thrill`의 값을 복사/이전합니다.
  - (선택 사항) `romance-thrill` 키를 유지하여 하위 호환성을 확보합니다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

- [ ] 2. 캐릭터별 차별화된 외모 토큰(Identity) 주입

  **What to do**:
  - `services/labPromptBuilder.ts`에서 캐릭터 identity를 생성할 때 슬롯별로 다른 얼굴 특징을 부여합니다.
  - ManA: `refined and intellectual features`, ManB: `strong and masculine jawline` 등.
  - WomanA: `elegant and sophisticated appearance`, WomanB: `youthful and vibrant charm` 등.
  - 멀티샷 템플릿에 `two distinct individuals, not twins, different faces` 키워드를 필수로 추가합니다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

- [ ] 3. 의상 태그 삽입 로직 수정 (`enhanceScenePrompt`)

  **What to do**:
  - `enhanceScenePrompt` 함수에서 `updated += , ${maleTag}` 또는 `femaleTag`를 붙이는 로직을 수정합니다.
  - 프롬프트 텍스트 내에 `[Person 1]`이나 `[` 문자가 포함되어 있다면(멀티 캐릭터 모드), 단일 의상 태그 삽입을 스킵합니다.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

- [ ] 4. shortPrompt 정보량 강화

  **What to do**:
  - `shortPrompt` 생성 로직에서 단순히 이름만 넣는 것이 아니라, `[Person 1: Name in White] [Person 2: Name in Navy]` 식으로 핵심 색상을 주입하도록 수정합니다.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`

---

## Success Criteria

### Verification Commands
```bash
# 로직 수정 후 프롬프트 생성 결과 검증을 위한 테스트 스크립트 실행 (가상)
node services/test_prompt_logic.js
```

### Final Checklist
- [ ] 로맨스 표정 정상 주입
- [ ] ManA/ManB 외모 묘사 다름
- [ ] ManA/ManB 의상 색상 대비 강조
- [ ] 프롬프트 마지막 오버라이딩 태그 제거
- [ ] '쌍둥이 금지' 키워드 포함

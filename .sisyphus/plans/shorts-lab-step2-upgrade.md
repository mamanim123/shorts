# [Plan] 쇼츠랩 2단계 생성 로직 지능화 및 정밀도 고도화

## TL;DR

> **Quick Summary**: 쇼츠랩 '2단계 생성' 과정에서 발생하는 대본 분할 누락, 캐릭터 매핑 오류, 프롬프트 중복 문제를 해결하여 고품질의 일관된 씬 생성을 보장합니다.
> 
> **Deliverables**: 
> - 지능형 대본 분할(8~12씬)이 보장된 새로운 스크립트 프롬프트
> - '캐디(WomanD)' 등 주요 역할 자동 매핑 로직
> - 동작(Action) 변환 및 중복 형용사 제거가 적용된 정밀 프롬프트 조립기
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: NO - 순차적 파이프라인 수정 필요
> **Critical Path**: 대본 프롬프트 수정 → 캐릭터 매핑 최적화 → 프롬프트 조립기 고도화

---

## Context

### Original Request
2단계 생성 버튼을 통해 쇼츠 대본과 이미지 프롬프트를 만들 때, 각 구성 요소(체형, 헤어, 앵글 등)가 어떻게 합쳐지는지 분석하고 로직을 개선해달라는 마마님의 요청.

### Interview Summary
**Key Discussions**:
- **장면 분할**: AI가 한 문단으로 출력하는 현상을 방지하고 8~12개의 명확한 문장으로 생성되도록 개선.
- **인물 매핑**: '캐디' 키워드 발견 시 WomanD 슬롯에 우선 배정하여 캐릭터 특색 강화.
- **프롬프트 정밀도**: 불필요한 중복 형용사를 제거하고 한국어 동작을 영문 포즈 키워드로 변환하여 주입.
- **제외 사항**: 럭셔리 미학(소재/질감)은 이번 작업에서 제외함.

---

## Work Objectives

### Core Objective
2단계 생성 파이프라인의 각 단계(생성-추출-분해-조립)를 고도화하여 사용자 개입 없이도 완벽한 씬 구성을 도출함.

### Concrete Deliverables
- `services/labPromptBuilder.ts`: 개선된 `buildLabScriptOnlyPrompt`
- `services/manualSceneBuilder.ts`: 정밀한 `buildCharacterExtractionPrompt` 및 `buildManualSceneDecompositionPrompt`
- `components/ShortsLabPanel.tsx`: 최적화된 `handleTwoStepGenerate` 및 프롬프트 클리닝 로직

### Definition of Done
- [ ] 주제 입력 후 2단계 생성 시 항상 8개 이상의 개별 씬이 생성됨.
- [ ] 대본에 '캐디' 등장 시 WomanD 슬롯이 자동으로 배정됨.
- [ ] 최종 프롬프트에서 'A stunning woman' 등의 중복 표현이 제거됨.
- [ ] 한국어 동작(예: '손을 흔들며')이 영문 프롬프트(`waving hand`)로 정상 변환되어 포함됨.

### Must Have
- 대본 생성 시 문장별 줄바꿈(`\n`) 강제 규칙 적용.
- '캐디' 전용 슬롯(WomanD) 매핑 로직.
- 동작 변환 매핑 테이블(`ACTION_KEYWORD_MAPPING`)의 2단계 생성 로직 통합.

### Must NOT Have (Guardrails)
- 의상 소재(벨벳, 니트 등)나 럭셔리 질감 관련 키워드 추가 금지 (마마님 제외 요청).
- 기존의 캐릭터 고정성(Identity Lock) 로직을 훼손하지 말 것.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO (기존 수동 테스트 파일 위주)
- **User wants tests**: Manual-only (에이전트를 통한 실행 결과 검증)
- **Framework**: none

### Automated Verification (Agent-Executable)

**1. 대본 분할 검증 (Bash):**
```bash
# 2단계 생성 후 저장된 JSON에서 scenes 배열의 길이를 체크
node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('generated_scripts/latest/story.json')); console.log(data.scenes.length >= 8 ? 'PASS' : 'FAIL')"
```

**2. 캐릭터 매핑 검증 (Bash):**
```bash
# '캐디' 포함 대본 생성 시 WomanD ID 포함 여부 체크
grep -q "WomanD" generated_scripts/latest/story.json && echo "PASS" || echo "FAIL"
```

**3. 프롬프트 중복 제거 검증 (Bash):**
```bash
# 최종 프롬프트에서 중복 패턴(A stunning woman... A stunning woman) 검색
grep -iE "(stunning.*stunning|beautiful.*beautiful)" generated_scripts/latest/story.json || echo "PASS"
```

---

## TODOs

### Wave 1: 대본 및 인물 추출 로직 고도화

- [ ] 1. 대본 생성 프롬프트(`buildLabScriptOnlyPrompt`) 수정
  - **What to do**: 
    - `scriptBody` 생성 시 "문장마다 반드시 줄바꿈을 하라"는 지시를 JSON 스키마 설명에 명시적으로 추가.
    - 8~12개의 문장을 생성하도록 수치적 강제성 부여.
  - **Recommended Agent**: `unspecified-low` + `git-master`
  - **Parallelization**: Sequential
  - **References**: `services/labPromptBuilder.ts`

- [ ] 2. 캐릭터 매핑 로직(`buildCharacterSlotMapping`) 개선
  - **What to do**: 
    - 추출된 이름/역할에 '캐디', 'caddy' 포함 시 `WomanD`로 매핑하는 우선순위 로직 추가.
    - '마누라', '와이프' 등의 키워드 발견 시 특정 슬롯(예: WomanA) 우선 배정 검토.
  - **Recommended Agent**: `unspecified-high` + `git-master`
  - **Parallelization**: Sequential
  - **References**: `components/ShortsLabPanel.tsx`, `services/manualSceneBuilder.ts`

### Wave 2: 프롬프트 조립 및 후처리 로직 고도화

- [ ] 3. 프롬프트 조립기(`composeManualPrompt`) 정밀화
  - **What to do**: 
    - AI가 생성한 영문 묘사에서 시스템 주입 키워드와 겹치는 형용사(stunning, beautiful 등)를 제거하는 정규식 필터 적용.
    - `ACTION_KEYWORD_MAPPING`을 사용하여 대본의 `action` 필드를 영문 포즈 키워드로 변환하여 주입.
  - **Recommended Agent**: `unspecified-high` + `git-master`
  - **Parallelization**: Sequential
  - **References**: `components/ShortsLabPanel.tsx`, `services/labPromptBuilder.ts`

- [ ] 4. 통합 테스트 및 결과 확인
  - **What to do**: 
    - "눈오는 골프장에 캐디" 주제로 2단계 생성을 실행하여 씬 개수, 캐디 슬롯, 프롬프트 품질을 최종 확인.
  - **Recommended Agent**: `unspecified-low` + `git-master`
  - **Parallelization**: Sequential

---

## Commit Strategy
- `feat(shorts-lab): enhance script generation prompt for better scene splitting`
- `feat(shorts-lab): implement intelligent character slot mapping for caddy and roles`
- `feat(shorts-lab): refine prompt assembly with duplicate cleaning and action mapping`

---

## Success Criteria
### Verification Commands
```bash
# 씬 분할 및 캐릭터 매핑이 적용된 최종 JSON 결과 확인
ls -t generated_scripts/ | head -n 1
```

### Final Checklist
- [ ] 8~12개의 씬이 정상적으로 분할되는가?
- [ ] 캐디가 WomanD 슬롯에 정상 배정되는가?
- [ ] 프롬프트에 중복 표현이 사라지고 동작 묘사가 강화되었는가?
- [ ] 럭셔리 미학(질감 표현)이 추가되지 않았는가?

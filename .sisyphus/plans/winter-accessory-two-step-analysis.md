# 겨울 악세서리 & 2단계생성 로직 대조 계획

## TL;DR
> **Quick Summary**: 쇼츠랩 2단계생성 버튼 → 세 번의 `/api/generate/raw` 호출 → 겨울 악세서리/의상 적용 로직이 실제 프롬프트(`2단계생성.txt`)와 일치하는지 전 구간을 대조한다.
> 
> **Deliverables**:
> - 버튼→API 호출→백엔드 핸들러→프롬프트 빌더 체인 매핑 리포트
> - 각 호출별 요청/응답 캡처와 겨울 아이템 포함 여부 증거
> - 최종 저장본(`save-story`)과 제공 로그 일치 여부 확인 결과
> 
> **Estimated Effort**: Short–Medium
> **Parallel Execution**: YES – 프런트/백엔드 코드 추적과 로그 검증 병렬 가능
> **Critical Path**: 요청 캡처 → 프롬프트/장면 스키마 대조 → 겨울 적용 여부 검증 → 최종 저장본 확인

---

## Context

### Original Request
- 쇼츠랩의 2단계생성 버튼 로직과 이번에 생성된 프롬프트(`2단계생성.txt`)가 제대로 연결/동작했는지, 겨울 악세서리 활성화와 LLM 의상 자동 설정 여부를 전반 비교·검증.

### Interview Summary
- 제공 로그에 longPrompt "White Luxury Padded Jacket and Mink Earmuffs" 및 scriptBody의 겨울 아이템 언급 존재.
- 프런트 `handleTwoStepGenerate`가 `/api/generate/raw` 3회 호출 후 `/api/save-story` 수행.
- 백엔드 `/api/generate/raw`가 프롬프트를 실행하고 폴더 생성/스킵 옵션을 처리.
- 겨울 적용 로직: `labPromptBuilder`(selectWinterItems, applyWinterLookToExistingPrompt), `manualSceneBuilder`(enableWinterAccessories 시 규칙 삽입), `geminiService`(커스텀 스크립트 2단계 흐름 재사용).

### Research Findings
- 프런트: `components/ShortsLabPanel.tsx` — 버튼 JSX와 `handleTwoStepGenerate`; 3회 `/api/generate/raw` + `/api/save-story` + cleanup 호출.
- 백엔드: `server/index.js` — `/api/generate/raw`, `/api/save-story`, `/api/scripts/cleanup-empty-folders` 라우트.
- 프롬프트 빌더: `services/manualSceneBuilder.ts`(캐릭터 추출/씬 분해 스키마, 겨울 규칙), `services/labPromptBuilder.ts`(winter detection, accessory pool, outfit 변환), `services/geminiService.ts`(2단계 재사용 흐름, 겨울 액세서리 보강).

### Metis Review
- Guardrails: 코드 수정 금지, bun/lsp_diagnostics 금지. 프런트 `handleTwoStepGenerate` ↔ 백엔드 `/api/generate/raw` 체인 매칭 필수. 겨울 액세서리/의상 적용을 호출별 payload로 확인.
- Risks: 로그만으로는 버튼 상태 불일치 가능; 3회 호출 중 어느 단계 누락인지 식별 필요. 요청/응답 캡처를 분리 수집 권장.

---

## Work Objectives

### Core Objective
- 2단계생성 버튼에서 생성된 실제 프롬프트/결과(`2단계생성.txt`)가 프런트·백엔드 로직과 일치하며 겨울 악세서리/의상 적용이 기대대로 동작했는지 검증한다.

### Concrete Deliverables
- 호출 체인 매핑 문서(버튼 → 핸들러 → API 엔드포인트 → 프롬프트 빌더 → 결과 저장).
- 3회 `/api/generate/raw` 요청/응답 JSON 캡처와 겨울 아이템 포함 여부 체크 로그.
- 최종 `save-story` 저장본과 제공된 `2단계생성.txt` 간 비교 결과.

### Definition of Done
- [ ] 3회 요청/응답에서 longPrompt 및 scriptBody 내 겨울 아이템 키워드 확인 근거 확보.
- [ ] 로직 상 사용한 빌더/규칙(services/*.ts)와 실제 출력 간 일치 여부가 문서화됨.
- [ ] 최종 저장본(`save-story`)이 제공 로그와 핵심 필드(title, scriptBody, scenes)에서 정합성 확인.

### Must Have
- 각 호출별 payload/response에 겨울 의상/악세서리 키워드 포함 여부를 명시적 증거로 제시.
- 프런트 `handleTwoStepGenerate` 흐름과 백엔드 `/api/generate/raw` 처리 경로를 연결한 다이어그램급 서술.

### Must NOT Have (Guardrails)
- 코드 수정 없음, bun/lsp_diagnostics 사용 금지.
- 수동 육안 확인만으로 합격 처리 금지 — 키워드/구조를 명령어로 검증.

---

## Verification Strategy (MANDATORY)

### Test Decision
- Infrastructure: N/A (분석 작업). Verification은 명령어 기반 로그/JSON 검사로 자동화.
- Approach: Automated checks via `jq`/`grep` on captured JSON; no manual UI steps.

### Automated Verification Patterns
- 요청/응답 캡처 파일(`step1.json`, `step2.json`, `step3.json`, `save-story.json`)에 대해:
  ```bash
  jq -r '.prompt // .longPrompt // ""' step1.json | grep -i "padded\|earmuff"
  jq -r '.prompt // .longPrompt // ""' step2.json | grep -i "padded\|earmuff"
  jq -r '.prompt // .longPrompt // ""' step3.json | grep -i "padded\|earmuff"
  jq -r '.scriptBody // ""' step3.json | grep -i "padded\|earmuff\|패딩\|귀도리"
  jq -r '.scriptBody // ""' save-story.json | grep -i "padded\|earmuff\|패딩\|귀도리"
  ```
  - Accept: grep exit code 0 for all checks; JSON parse succeeds.
- 서버 로그(있다면):
  ```bash
  grep -n "generate/raw" server.log | head -n 50
  ```
  - Accept: 3회 호출, HTTP 200, 에러 로그 없음.

---

## Execution Strategy

### Parallel Execution Waves
- Wave 1: 소스 경로 확인(프런트/백엔드/서비스) + 제공 로그 구조 파싱.
- Wave 2: 네트워크 캡처/응답 JSON 수집(3회 generate + save-story) → 겨울 키워드 검사.
- Wave 3: 정합성 리포트 작성 및 차이 분석.

### Dependency Matrix
- Wave 1 → Wave 2 (캡처 시 어떤 필드를 봐야 할지 기준 확보).
- Wave 2 → Wave 3 (검증 결과를 근거로 리포트 작성).

### Agent Dispatch Summary
- Wave 1: category `quick`, skills `explore` (코드 경로 재확인)
- Wave 2: category `quick`, skills `explore` (로그/응답 파일 읽기)
- Wave 3: category `writing`, skills 없음 (보고서 작성)

---

## TODOs

- [ ] 1. 프런트 호출 체인 재확인
  **What to do**: `components/ShortsLabPanel.tsx`에서 `handleTwoStepGenerate` 흐름(3회 `/api/generate/raw`, `/api/save-story`, cleanup) 라인 범위와 파라미터를 표로 정리.
  **References**:
  - components/ShortsLabPanel.tsx:3071-3435 — 2단계 생성 핸들러, fetch 호출 체인
  **Acceptance Criteria**: 표에 각 호출 목적, URL, body 필드(service, prompt, maxTokens, temperature, folderName/skipFolderCreation) 기입.

- [ ] 2. 백엔드 엔드포인트 매핑
  **What to do**: `server/index.js`의 `/api/generate/raw`, `/api/save-story`, `/api/scripts/cleanup-empty-folders` 동작을 정리(입력/출력, 폴더 처리, 오류 처리).
  **References**:
  - server/index.js:671+ — generate/raw 라우트
  - server/index.js:~860 — save-story 라우트
  **Acceptance Criteria**: 요청 스키마와 응답 필드(_folderName, text, data, error)를 표로 기록.

- [ ] 3. 겨울 적용 로직 추출
  **What to do**: 겨울 감지/변환/액세서리 풀 로직과 씬 프롬프트 규칙을 문서화.
  **References**:
  - services/labPromptBuilder.ts:70-168,196-219,317-360 — isWinterTopic, selectWinterItems, convertToTightLongSleeveWithShoulderLine, applyWinterLookToExistingPrompt
  - services/manualSceneBuilder.ts:141-210,216-255 — winter accessories 규칙 삽입, 씬 분해 스키마
  - services/geminiService.ts:1167-1470 — 커스텀 스크립트 2단계 재사용, winterAccessories 주입
  **Acceptance Criteria**: 각 함수의 입력/출력, 적용 위치, winter 관련 키워드 목록을 표로 정리.

- [ ] 4. 제공 로그(2단계생성.txt) 구조 파싱
  **What to do**: `2단계생성.txt`에서 scriptBody, character extraction JSON, scene JSON을 분리 파싱해 핵심 키워드(패딩, 귀도리, earmuffs, padded)를 리스트업.
  **References**:
  - 2단계생성.txt — 전체 프롬프트/응답 원본
  **Acceptance Criteria**: 키워드 리스트와 등장 위치(sceneNumber/field) 표로 기록.

- [ ] 5. 요청/응답 캡처 검증 (3회 generate + save-story)
  **What to do**: 동일 세션의 요청/응답 JSON(`step1.json`, `step2.json`, `step3.json`, `save-story.json`)을 캡처/정리하고 겨울 키워드 grep.
  **References**:
  - components/ShortsLabPanel.tsx (요청 형식), server/index.js (응답 형식)
  **Acceptance Criteria**:
  - grep 명령 모두 exit code 0 (padded|earmuff|패딩|귀도리) in prompts/scriptBody.
  - 3회 호출 각각 prompt/longPrompt 존재 확인.

- [ ] 6. 일치성 리포트 작성
  **What to do**: 호출 체인 vs 캡처 vs `2단계생성.txt`의 겨울 키워드/의상 일치 여부를 표/서술로 정리. 누락/불일치 발생 시 위치와 원인 후보 기록.
  **Acceptance Criteria**: 리포트에 1) 일치, 2) 불일치 항목, 3) 원인 추정, 4) 추가 데이터 필요 여부가 포함.

---

## Success Criteria
- 3회 `/api/generate/raw`와 `save-story`의 winter 키워드 검증 명령이 모두 통과.
- 프런트/백엔드/서비스 로직과 `2단계생성.txt` 간 핵심 필드(title, scriptBody, longPrompt winter accessories)가 불일치 없음 또는 차이 발생 시 명확한 원인 후보 제시.
- 보고서에 근거(파일 경로, grep/jq 결과, 키워드 리스트)가 포함되어 재현/확인이 가능함.

---

## Notes
- 수집된 캡처(JSON, 로그)는 결과 리포트에 경로와 함께 명시할 것.
- 고정된 겨울 키워드: padded, earmuffs, 패딩, 귀도리(추가 필요 시 확장 가능).

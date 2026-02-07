# Grok 비디오 생성 자동화 및 품질 개선 계획

## TL;DR

> **Quick Summary**: 쇼츠랩의 Grok 비디오 생성 기능을 '테스트.txt' 시나리오에 맞춰 완전 자동화하고, 이미지 프롬프트를 복사하던 기존의 저품질 프롬프트 생성 로직을 비디오 전용으로 정교화합니다.
> 
> **Deliverables**:
> - `/api/video/generate-grok` 엔드포인트 연결 (서버-자동화 로직 결합)
> - 비디오 전용 Gemini 프롬프트 정교화 로직 (움직임, 카메라 워킹 강화)
> - Grok 자동 제출 로직 개선 (Ctrl+Enter 및 다중 제출 폴백)
> - 생성 영상 자동 가져오기 및 오디오 제거 로직 (FFmpeg)
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 Waves
> **Critical Path**: 엔드포인트 연결 → 프롬프트 정교화 → 제출 로직 수정

---

## Context

### Original Request
쇼츠랩 비디오 생성 시 Grok 연동 실패(엔드포인트 부재, 엔터 미작동), 다운로드 수동 처리, 프롬프트 품질 저하 문제를 해결하고 '테스트.txt'의 시나리오대로 완전 자동화를 구현해달라는 요청.

### Interview Summary
**Key Discussions**:
- **문제점**: 서버에 `/api/video/generate-grok` 라우트가 누락되어 프론트엔드 요청이 404로 실패함.
- **품질**: 비디오 프롬프트가 이미지용 프롬프트를 그대로 사용하거나 폴백으로 사용되어 품질이 낮음.
- **자동화**: Grok 제출 시 단순 Enter가 작동하지 않으며, 생성 완료 후 자동 다운로드 기능이 필요함.

**Research Findings**:
- `puppeteerHandler.js`에 `generateGrokVideo` 핵심 로직은 있으나 호출부가 없음.
- `server/index.js`의 프롬프트 정교화 로직에 비디오 전용 가이드라인이 부족함.
- `테스트.txt` 분석 결과: 자동 인식, 자동 다운로드, 영상 오디오 제거 기능이 필수적임.

---

## Work Objectives

### Core Objective
Grok을 통한 비디오 생성의 모든 과정을 자동화하고, '영상다운' 느낌이 나는 고품질 프롬프트를 생성하여 제작 시간을 단축합니다.

### Concrete Deliverables
- `server/index.js`: `/api/video/generate-grok` API 구현 및 `generateGrokVideo` 연결.
- `server/index.js`: 비디오 전용 Gemini 프롬프트 강화 (모션/카메라 지시어 강제).
- `server/puppeteerHandler.js`: `Ctrl+Enter` 제출 폴백 및 제출 성공 여부 감지 로직.
- `server/index.js`: `import-from-downloads` 시 FFmpeg를 활용한 영상 오디오 제거 옵션 추가.

### Definition of Done
- [x] Grok 생성 버튼 클릭 시 브라우저가 자동으로 열리고 프롬프트가 입력된 후 제출됨.
- [x] 생성된 영상의 프롬프트에 '움직임(motion)', '카메라(camera)', '시간에 따른 변화' 단어가 포함됨.
- [x] 다운로드 폴더에 저장된 최신 영상이 자동으로 프로젝트 폴더로 이동되고 오디오가 제거됨.

### Must Have
- 비디오 프롬프트 생성 시 이미지 프롬프트 단순 복사 금지.
- Grok 제출 실패 시 최소 3가지 방식(버튼 클릭, Enter, Ctrl+Enter) 시도.
- 가져오기(Import) 시 영상 오디오 제거 기능(선택 또는 기본 적용).

### Must NOT Have (Guardrails)
- API 키를 코드나 로그에 노출하지 말 것.
- Grok의 무료 사용량 제한을 넘어서는 무한 루프 생성 금지.

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> 모든 검증은 에이전트가 도구를 사용하여 직접 수행하며, 사용자에게 확인을 요청하지 않습니다.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: None (Agent-Executed QA 위주)

### Agent-Executed QA Scenarios

Scenario: 비디오 프롬프트 정교화 품질 검증
  Tool: Bash (curl)
  Steps:
    1. `POST /api/video/refine-prompt` 호출 (샘플 대본 및 이미지 프롬프트 포함)
    2. 응답 JSON의 `refinedPrompt` 분석
    3. Assert: 결과에 "camera", "movement", "cinematic" 등 영상 전용 키워드가 포함되었는지 확인
  Expected Result: 이미지 프롬프트와 확연히 다른 '영상용 전용 지시어'가 생성됨.

Scenario: Grok 자동 제출 로직 검증
  Tool: interactive_bash (tmux)
  Steps:
    1. `POST /api/video/generate-grok` 호출
    2. Puppeteer 브라우저 실행 로그 감시
    3. Assert: "Submit 클릭 성공" 또는 "Enter 시도 성공" 로그 확인
  Expected Result: 브라우저가 멈춰있지 않고 제출이 완료되어 'submitted' 상태를 반환함.

---

## TODOs

- [x] 1. 서버 엔드포인트 연결 및 라우팅 구현
  **What to do**:
  - `server/index.js` 상단에 `generateGrokVideo` import 추가.
  - `app.post('/api/video/generate-grok', ...)` 엔드포인트 구현.
  - 프론트엔드에서 전달받은 `prompt`, `imageUrl` 등을 `generateGrokVideo`로 전달.
  **Agent Profile**: `quick` (Node.js/Express)
  **Parallel**: Wave 1

- [x] 2. 비디오 전용 프롬프트 정교화 로직 강화
  **What to do**:
  - `server/index.js`의 `/api/video/refine-prompt` 내 Gemini 지시문 수정.
  - "이미지 프롬프트를 그대로 복사하지 말 것", "피사체의 움직임과 카메라 동작을 묘사할 것" 지침 추가.
  - 실패(폴백) 시 `visualPrompt` 대신 `scriptLine`에 기본 모션 지시어를 붙여 반환하도록 수정.
  **Agent Profile**: `ultrabrain` (Prompt Engineering)
  **Parallel**: Wave 1

- [x] 3. Grok 제출(Submit) 및 자동화 로직 개선
  **What to do**:
  - `server/puppeteerHandler.js`의 `generateGrokVideo` 함수 수정.
  - 프롬프트 입력 후 `Ctrl+Enter` 전송 로직 추가.
  - 제출 버튼이 존재할 경우 `evaluate`를 통한 직접 클릭 시도 추가.
  - 제출 후 "영상이 생성 중입니다" 등의 메시지나 UI 변화를 감지할 때까지 대기.
  **Agent Profile**: `visual-engineering` (Puppeteer/Automation)
  **Parallel**: Wave 2

- [x] 4. 자동 가져오기 및 오디오 제거 기능 구현
  **What to do**:
  - `server/index.js`의 `/api/video/import-from-downloads` 로직 보강.
  - 영상 이동 후 FFmpeg(`fluent-ffmpeg` 등)를 사용하여 오디오 스트림 제거 (`-an` 옵션).
  - '테스트.txt' 시나리오에 따라 가져온 영상을 리스트에 즉시 반영할 수 있는 메타데이터 생성.
  **Agent Profile**: `unspecified-high` (Backend/FFmpeg)
  **Parallel**: Wave 2

---

## Success Criteria

### Verification Commands
```bash
# 엔드포인트 테스트
curl -X POST http://localhost:3002/api/video/generate-grok -d '{"prompt":"test", "imageUrl": "..."}'
```

### Final Checklist
- [x] Grok 제출 시 멈춤 현상 해결됨.
- [x] 비디오 프롬프트가 "움직임"을 포함하도록 개선됨.
- [x] 다운로드 폴더의 영상이 오디오 없이 자동 임포트됨.

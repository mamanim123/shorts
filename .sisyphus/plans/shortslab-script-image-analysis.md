# 쇼츠랩 대본 및 이미지 프롬프트 분석 플랜

요청자: 마마님
범위: 쇼츠랩 대본 생성 + 이미지 프롬프트 생성 로직 전반
모드: 분석 전용 (구현/수정 없음)
제한: lsp, bun 사용 금지 요청 준수

## 1. 요약
- 쇼츠랩 파이프라인의 중심은 `components/ShortsLabPanel.tsx`이며, 프롬프트 구성은 `services/labPromptBuilder.ts`에 집중되어 있습니다.
- JSON 파싱 유틸은 다양하게 복구를 시도하지만, 비표준 따옴표/깨진 출력에 취약합니다.
- 이미지 프롬프트 강화가 클라이언트/서버에 중복 존재하여 키워드 중복과 불일치 위험이 있습니다.
- 프롬프트 템플릿 내부에 Git merge conflict 마커가 남아있어 출력 품질에 심각한 영향을 줄 수 있습니다.
- 투샷/쓰리샷 규칙이 명세되어 있으나 실제 검증 로직이 동작하지 않습니다.

## 2. 시스템 맵 (핵심 구성)
- UI 엔트리: `components/ShortsLabPanel.tsx`
- 프롬프트 구성: `services/labPromptBuilder.ts`
- JSON 파싱/복구: `services/jsonParse.ts`
- 백엔드 API: `server/index.js`
- 프롬프트 강화: `server/promptEnhancer.js`
- 자동화 실행: `server/puppeteerHandler.js`

## 3. 대본 생성 흐름
1) 사용자 입력 (주제/장르/연령)
2) `handleAiGenerate` → `buildLabScriptPrompt`로 프롬프트 생성
3) `/api/generate/raw` 호출
4) `parseJsonFromText`로 JSON 추출/복구
5) `postProcessAiScenes`로 장면 후처리
6) scenes 상태 업데이트 및 미리보기 표시

## 4. 이미지 프롬프트 생성 흐름
### 경로 A (AI 응답 기반)
- AI 응답의 `scenes[].longPrompt` → 클라이언트 후처리

### 경로 B (수동 대본 입력)
- `handleParseScenes` → `generatePrompt` → 로컬 장면 프롬프트 생성

### 서버 강화 경로
- `server/promptEnhancer.js`가 캐릭터/퀄리티/의상 강화
- `/api/image/ai-generate`에서 자동화 생성 및 캡처

## 4-1. 이미지 프롬프트 고정 문구 목록

### 클라이언트 (services/labPromptBuilder.ts)
- START
  - `unfiltered raw photograph, 8k ultra photorealism, ultra detailed skin texture with visible pores and natural skin imperfections, professional cinematic lighting, RAW photo, real human skin texture, candid photography style`
- FEMALE_BODY
  - `slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves, voluptuous chest line, emphasizing chest line, deep cleavage, defined chest silhouette, well-managed sophisticated look despite age, tight-fitting clothes accentuating curves naturally`
- MALE_BODY
  - `fit athletic build with broad shoulders, dandy and refined presence, tailored slim-fit clothes`
- END
  - `high-fashion editorial refined, depth of field, shot on 85mm lens, f/1.8, realistic soft skin, 8k ultra-hd, no text, no captions, no typography, --ar 9:16`
- NEGATIVE
  - `NOT cartoon, NOT anime, NOT 3D render, NOT CGI, NOT plastic skin, NOT mannequin, NOT doll-like, NOT airbrushed, NOT overly smooth skin, NOT uncanny valley, NOT artificial looking, NOT illustration, NOT painting, NOT drawing`

### 클라이언트 후처리 (components/ShortsLabPanel.tsx)
- 씬 번호 강제: `Scene {n}.`
- no text 고정 태그: `no text, no letters, no typography, no watermarks, no words`
- 한국인 정체성 강제: `A stunning Korean woman ...` / `A handsome Korean man ...`

### 서버 강화 (server/promptEnhancer.js)
- 품질 태그 기본값
  - `, photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field --ar 9:16`
- 슬롯 기반 문장 삽입 (국적/체형/의상)
- 의상 강제 치환 (예: `mini dress` → `ultra-tight bodycon mini dress`)

## 4-2. 중복 출력 여부 및 원인

### 중복 발생 가능 문구
- negative prompt 문구
  - `buildLabImagePrompt`에서 추가 + `validateAndFixPrompt`에서 재삽입 가능
- no text 계열
  - `PROMPT_CONSTANTS.END` + `enhanceScenePrompt`의 no text 태그
- Korean identity
  - LLM 지시문 + `enhanceScenePrompt` 강제 삽입
- 품질/해상도/비율
  - `PROMPT_CONSTANTS.END` + `server/promptEnhancer`의 qualityTags

### 중복이 발생하는 구조적 이유
1) LLM 지시문에서 이미 강제 삽입
2) 클라이언트 후처리에서 재삽입
3) 서버 후처리에서 다시 추가
→ 동일 문구가 2~3회 중첩될 수 있음

## 4-3. 제안 (1번안)
**단일 책임 지점으로 통합 (서버 중심)**
- LLM 지시문에서는 구조/형식만 강제하고, 고정 문구는 서버에서만 일괄 삽입
- 클라이언트 후처리에서는 씬 번호/기본 무결성만 유지하고 문구 삽입 제거
- 결과: 중복 제거, 출력 일관성 확보, 디버깅 단순화

## 5. 발견된 문제점 (우선순위 포함)

### Critical
1) Git merge conflict 마커 잔존
- 파일: `services/labPromptBuilder.ts`
- 증상: `<<<<<<< Updated upstream` 텍스트가 프롬프트에 포함
- 영향: LLM 지시문 오염 및 응답 불안정

2) Negative 프롬프트 혼합
- 파일: `services/labPromptBuilder.ts`
- 내용: `PROMPT_CONSTANTS.NEGATIVE`가 positive prompt에 직접 합쳐짐
- 영향: 모델 해석 오류 및 품질 저하

3) 투샷/쓰리샷 검증 미작동
- 파일: `services/labPromptBuilder.ts` (`validateAndFixPrompt`)
- 문제: `[Person 1]` 등 필수 규칙 확인 안 함

### Medium
4) 프롬프트 강화 로직 중복
- 클라이언트: `postProcessAiScenes`
- 서버: `applyFullEnhancement`
- 영향: 키워드 중복, 결과 불일치

5) localStorage 동기화 불완전
- scenes 저장이 분산/부분 적용
- 영향: 세션 복원 불안정

6) 이미지 생성 에러 처리 단순
- API key 외 오류 유형 구분 부족
- 영향: 재시도/대응 어려움

7) 이미지 폴더 경로 혼재
- 신규/레거시 경로 병행
- 영향: 이미지 로딩 불일치 가능

8) 이미지 캡처 재시도 낮음
- `IMAGE_CAPTURE_MAX_ATTEMPTS` 기본 2회
- 영향: 느린 생성에서 실패 빈발

### Low
9) 씬 번호 비연속 가능
- 사용자 입력/삭제 시 번호 불일치
- 영향: 씬-이미지 매칭 오류 가능

10) 의상 폴백 하드코딩
- 특정 문자열로 고정
- 영향: 스타일 확장/관리 어려움

11) JSON 파싱 진단 부족
- 실패 단계 로그 부재
- 영향: 디버깅 어려움

12) 이미지 매칭 정규식 의존
- 파일명 패턴 변경 시 실패

13) 비디오 프롬프트 API 의존
- `/api/video/refine-prompt` 존재 가정
- 영향: 엔드포인트 미존재 시 오류

## 6. 개선 권장 (분석 기준 제안)
1) merge conflict 마커 제거
2) negative prompt 분리 저장
3) 투샷/쓰리샷 규칙 검증 추가
4) 프롬프트 강화 로직 단일화
5) scenes 저장 일원화 (useEffect)
6) 에러 분기/메시지 구체화
7) 이미지 경로 정규화
8) 재시도/백오프 강화
9) 씬 번호 재정렬 로직 추가
10) 의상 기본값 상수화
11) JSON 파싱 실패 단계 로깅
12) sceneNumber 메타데이터 기반 매칭
13) 비디오 API 존재 확인/가드 추가

## 6-1. 목표 (작업 지향)
- 고정 문구 중복 제거 및 단일 삽입 지점 확정
- negative prompt를 전용 필드로 분리 유지
- 투샷/쓰리샷 규칙 검증 로직 실제 적용
- 클라이언트/서버 프롬프트 강화 로직 일원화

## 6-2. 체크리스트 (작업 시 매 업데이트 대상)
- [ ] 중복 고정 문구 목록 최신화
- [ ] 삽입 책임 위치(클라/서버/LLM) 명확화
- [x] negative prompt 분리 유지 여부 확인
- [ ] no text 문구 중복 여부 확인
- [ ] Korean identity 중복 여부 확인
- [x] 품질 태그(8k, photorealistic, --ar) 중복 여부 확인
- [x] 투샷/쓰리샷 규칙 검증 반영 여부 확인

## 6-3. 진행 현황 (작업마다 갱신)
- 2026-01-23: `services/labPromptBuilder.ts` 내 merge conflict 마커 제거 완료
- 2026-01-23: negative prompt 자동 삽입 제거 및 분리 로직 추가
- 2026-01-23: 투샷/쓰리샷 [Person N] 구분자 자동 보정 추가
- 2026-01-23: 서버 프롬프트 강화에서 중복 품질 태그/슬롯 삽입 가드 추가

## 7. 주요 참조 위치
- `components/ShortsLabPanel.tsx`
- `services/labPromptBuilder.ts`
- `services/jsonParse.ts`
- `server/index.js`
- `server/promptEnhancer.js`
- `server/puppeteerHandler.js`

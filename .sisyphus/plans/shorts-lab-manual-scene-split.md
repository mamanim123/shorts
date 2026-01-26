# [PLAN] 쇼츠랩 수동대본 씬분해 전용 로직 분리

## 목표
- 수동대본 씬분해는 **간단한 LLM 요청 + 클라에서 프롬프트 재조립** 방식으로 전환.
- AI 대본 생성 로직은 기존대로 유지하여 기능 간 영향 분리.
- LLM 요청/응답 토큰을 줄여 비용 절감.

## 방향
- LLM은 `sceneNumber / scriptLine / summary / action / background / characterIds` 등 최소 필드만 생성.
- 클라이언트에서 `PROMPT_CONSTANTS + 캐릭터 고정 + 카메라/표정 규칙 + action/background`로 longPrompt 재조립.
- 수동대본 전용 모듈 파일로 분리해 유지보수 영향 최소화.

## 체크리스트
- [x] 수동대본 씬분해 전용 프롬프트 템플릿 작성(최소 필드 출력)
- [x] 수동대본 전용 결과 파서 구현(간단 JSON)
- [x] 클라이언트에서 longPrompt 재조립 로직 구현
- [x] 기존 AI 대본 생성 로직은 유지(분리)
- [x] 수동대본 버튼은 새 로직으로 연결

## 작업 파일
- components/ShortsLabPanel.tsx
- services/manualSceneBuilder.ts (신규)

# Draft: ShortsLab Two-Step Alignment

## Requirements (confirmed)
- 2단계 생성도 AI 대본 생성과 동일하게 고정문구/캐릭터 설정을 강제 적용
- 여성 디스크립터(헤어/의상/악세서리)와 한국 국적 고정문구가 모든 씬에 적용되어야 함
- 대본과 무관한 이미지 프롬프트가 나오지 않도록 대본 기반 연동 강화 필요
- 표정/동작을 자연스럽고 다양하게(캔디드 느낌) 연출
- 카메라 앵글 다양성을 최대한 활용
- 쇼츠랩 입력 탭의 AI 대본 생성/2단계 생성 버튼 기준
- 겨울 악세서리 활성화 상태에서도 고정문구 누락 없이 일관 적용

## Technical Decisions
- 2단계에서 longPrompt 우선 사용 대신 로컬 후처리로 고정문구/캐릭터 설정을 강제 적용하는 방향
- 2단계 플로우의 캐릭터 정규화/매핑 문제 가능성 우선 확인

## Research Findings
- AI 대본 생성: `handleManualSceneGeneration` → `buildManualAiPrompt` → `composeManualPrompt` 기반 후처리
- 2단계 생성: `handleTwoStepGenerate` → `buildLabScriptOnlyPrompt` → `buildCharacterExtractionPrompt` → `buildManualSceneDecompositionPrompt`
- 2단계는 `scene.longPrompt`를 우선 사용하여 고정문구/캐릭터 설정이 누락될 가능성
- `characterIds` 정규화 실패 시 캐릭터 매핑이 비어 고정문구 삽입이 불가

## Open Questions
- 없음 (요구사항 확정)

## Scope Boundaries
- INCLUDE: ShortsLab 입력 탭 내 AI 대본 생성/2단계 생성 버튼 로직 비교 및 일관화 계획
- EXCLUDE: 전역 UI 리디자인, 신규 모델 도입

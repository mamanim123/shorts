# Draft: 통합 후처리 매니저 (글로벌 규칙 시스템)

## Requirements (confirmed)
- 마마님 요청: 후처리 기능을 한곳에서 관리할 수 있는 시스템 구축.
- 범위: 모든 대본에 공통 적용 (장르별 분리 불필요).
- 기능: 규칙 수정, 저장, 백업, 복원 가능.
- 통합 위치: 기존 장르관리/프롬프트규칙이 있는 쇼츠랩 설정 패널.

## Technical Decisions
- **글로벌 저장소**: 서버의 `app-storage`를 사용하여 `shorts-lab-post-processing-rules` 키로 통합 관리.
- **데이터 구조 (Schema)**: 카메라 앵글, 표현식, 액션, 인물 템플릿, 의상/액세서리 규칙, 품질 태그 등을 포함하는 JSON 구조.
- **UI 통합**: `ShortsLabPanel.tsx`의 설정 섹션에 '후처리 규칙' 탭 추가.
- **로직 리팩토링**: `ShortsLabPanel.tsx`와 `labPromptBuilder.ts`에 하드코딩된 상수들을 신규 매니저를 통해 주입받도록 수정.

## Research Findings
- `postProcessAiScenes` 로직이 `ShortsLabPanel.tsx` 내부에 위치함 (약 969행).
- `services/labPromptBuilder.ts`에 헬퍼 함수들이 정의되어 있음.
- 기존에 `PromptRulesManager`와 같은 관리 패턴이 이미 존재하여 이를 벤치마킹 가능.

## Open Questions
- 없음 (마마님께서 모든 대본 적용을 명확히 지시함).

## Scope Boundaries
- INCLUDE: 후처리 규칙 매니저(Manager), 훅(Hook), UI(Tab), 로직 연동.
- EXCLUDE: 장르별 개별 후처리 (마마님 요청에 따라 제외).

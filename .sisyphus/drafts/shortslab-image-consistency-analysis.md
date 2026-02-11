# Draft: ShortsLab AI Script + Image Prompt Consistency

## Requirements (confirmed)
- ShortsLab "ai대본생성" 버튼의 대본/이미지프롬프트 생성 로직을 대대적으로 개선하는 방향 검토.
- 대본에 맞는 이미지프롬프트 생성 품질 문제 해결.
- 1씬~끝씬까지 캐릭터/의상/악세/배경 일관성 확보.
- "[김부장월드]"로 시작하는 파일 4개를 꼼꼼히 검토해, 현 시스템에 적용할 기능/아이디어 도출.
- 결과물은 구현이 아닌 분석/개선 방향 제안.
- 제약: bun, LSP 사용 금지.

## Technical Decisions
- (대기)

## Research Findings
- (대기) 탐색 에이전트 결과 수집 중.

## Open Questions
- 일관성 기준: 어떤 요소를 반드시 고정하고, 어느 정도 변형을 허용할지.
- 이미지 생성 파이프라인/모델 변경 가능 범위.
- 현 UI/백엔드/서비스 중 변경 허용 범위(어디까지 손대도 되는지).

## Scope Boundaries
- INCLUDE: 현 ai대본생성 로직 분석, [김부장월드]* 파일 분석, 개선안 도출.
- EXCLUDE: 코드 수정/구현.

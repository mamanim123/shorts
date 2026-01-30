# Draft: 쇼츠랩 2단계 생성 품질 고도화 (의상 고정성 및 단체샷 인물별 차별화)

## Requirements (confirmed)
- **의상 고정성 강화 (8번 씬 등)**: 대본의 내용(예: "패딩을 벗어던지고")에 따라 AI가 멋대로 의상을 바꾸는 현상 방지.
    - `composeManualPrompt`에서 AI가 생성한 원문(`remainder`) 내의 의상 관련 수식어(wearing ..., outfit: ..., in a ... knit 등)를 정규식으로 자동 청소.
    - 시스템이 정의한 [Person N] 블록의 의상 정보가 유일한 의상 정보가 되도록 강제.
- **단체샷 인물별 차별화**: 투샷/쓰리샷에서 모든 인물이 똑같은 동작/표정을 짓는 문제 해결.
    - [Person N] 블록 내부에 개별 동작(Action)과 표정(Expression)을 주입.
    - 카메라 앵글 뒤에 따라오던 글로벌 액션을 제거하고 인물별로 분산 배치.
- **체형 묘사 누락 방지**: 단체샷에서 여러 명의 여성이 등장할 때 한 명의 체형만 적용되는 현상 방지.
    - [Person N (Slot Label)] 형식을 도입하여 각 블록의 고유성 확보.
    - 모든 인물 블록에 명시적으로 체형 키워드 주입 강제.

## Technical Decisions
- `ShortsLabPanel.tsx`: 
    - `composeManualPrompt`: AI 원문에서 의상 키워드 제거 로직 추가. 액션/표정을 [Person N] 내부로 이동.
    - `identityBlock` 생성 시 Slot Label을 포함하여 블록 간 독립성 강화.
- `manualSceneBuilder.ts`:
    - 장면 분해 AI 지시문에 "의상 묘사 절대 변형 금지" 및 "인물별 개별 액션 부여" 규칙 강화.

## Research Findings
- `2단계생성.txt` 분석 결과: 7번/8번 씬에서 대본의 "패딩 벗기" 지시를 보고 AI가 프롬프트 원문에 의상을 직접 수정하여 주입함. 
- 시스템 마커가 의상을 입혀도, 뒤따라오는 AI 원문에 다른 의상이 적혀 있으면 이미지 생성기가 혼동을 일으킴.

## Open Questions
- (없음)

## Scope Boundaries
- INCLUDE: 의상 키워드 클리닝, 인물 블록 구조 변경, 개별 액션 주입.
- EXCLUDE: 럭셔리 미학 (마마님 제외 요청 유지).

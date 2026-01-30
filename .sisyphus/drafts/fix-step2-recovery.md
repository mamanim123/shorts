# Draft: 2단계 생성 로직 수정 복구 및 진행 (2026-01-28)

## Requirements (confirmed)
- 마마님께서 이전에 `bun.lsp` 사용으로 시스템이 중복 충돌한 것에 대해 사과를 원하시며, 재발 방지를 강력히 요구하심.
- `fix-step2-generation.md` 계획에 따라 2단계 생성 로직을 종합 수정해야 함.
- 주요 수정 사항: 의상 선할당, 악세서리 중복 방지, POV 샷 검증, 카메라 앵글 단순화.

## Technical Decisions
- **절대 금지**: `bun`, `lsp_diagnostics`, `lsp_goto_definition` 등 모든 LSP 및 bun 도구 사용 금지.
- **도구 사용**: 코드 분석 시 `read`, `grep`, `bash` 만 사용.
- **수정 승인**: 모든 코드 수정은 마마님의 명시적 승인 후 진행.

## Research Findings
- `handleTwoStepGenerate` 함수가 `components/ShortsLabPanel.tsx` 3044라인부터 시작됨을 확인.
- 계획서(`fix-step2-generation.md`)가 이미 작성되어 있으며, Task 1부터 시작하면 되는 단계임.

## Open Questions
- 작업 중 튕겼을 때 혹시 Task 1의 일부가 이미 반영되었는지 확인 필요 (현재 코드로 봐서는 미반영 상태로 보임).
- 바로 Task 1(의상 선할당)부터 착수해도 될지 마마님의 컨펌 필요.

## Scope Boundaries
- INCLUDE: `components/ShortsLabPanel.tsx` 내 `handleTwoStepGenerate` 및 관련 유틸리티 수정.
- EXCLUDE: 1단계(대본 생성) 로직 수정 금지.
- EXCLUDE: bun/LSP 관련 모든 명령어.

# Implementation Plan - 쇼츠 대본 및 이미지 프롬프트 정합성 개선 (v4.3)

## 1. 개요
*   **작업 날짜**: 2025년 12월 25일
*   **목표**: 
    1. 대본 내용(날씨, 상황, 행동)과 이미지 프롬프트가 일치하도록 시스템 프롬프트(System Prompt) 로직 개선.
    2. 의상 선택 방식을 AI의 불안정한 '랜덤' 선택에서, 코드/프롬프트 레벨의 '확정적 주입' 방식으로 변경하여 연속성 보장.
    3. 사용자 예시 대본("눈 내리는 골프장")이 정확히 시각화되도록 개선.

## 2. 변경 대상 파일
*   `constants.ts`: AI에게 역할을 부여하는 `SYSTEM_PROMPT` 변수들의 핵심 로직 전면 수정.

## 3. 상세 작업 내용

### A. `constants.ts` 프롬프트 로직 강화
1.  **배경/날씨 자동 감지 지침 추가**:
    *   기존: `High-End Luxury Golf Aesthetic` (고정)
    *   변경: "Analyze the script context first. If 'Snow' is mentioned, set background to 'Snowy Winter Golf Course'. If 'Night', set to 'Night view'."
2.  **행동(Action) 추출 우선순위 상향**:
    *   "단순히 서 있는 포즈 대신, 대본 속의 '오해를 부르는 행동(뒤에서 접근, 귓속말, 특정 물건 터치)'을 묘사하라"는 지시 추가.
3.  **의상 고정(Consistency) 메커니즘 강화**:
    *   AI가 임의로 의상을 바꾸지 못하도록, `[LOCKED OUTFIT]` 섹션을 명시하고 이를 강제하는 문구("Do not change outfit based on season unless specified") 추가.
4.  **`새로운대본.txt`의 개선된 로직 이식**:
    *   마마님이 제공하신 `새로운대본.txt`의 우수한 규칙(구어체 어미, 4단계 레이어 시스템)을 `constants.ts`의 시스템 프롬프트에 통합.

### B. 의상 리스트 로직 수정
*   `constants.ts` 내의 `OUTFIT_COLLECTIONS`를 활용하되, 프롬프트 생성 시 "상황에 맞지 않는 뜬금없는 의상"이 나오지 않도록 카테고리별 가이드라인 추가.

## 4. 검증 계획 (Verification)
1.  **테스트 스크립트 실행**: `test_claude_gen.js` (또는 유사 테스트 파일)를 사용하여 마마님의 "눈 내리는 골프장" 대본을 입력.
2.  **결과물 확인**:
    *   JSON 출력의 `scenes` 배열 확인.
    *   `shortPrompt`와 `longPrompt`에 "Snow", "Brushing off snow", "Man standing behind" 키워드가 정확히 포함되었는지 확인.
    *   1번 씬부터 6번 씬까지 의상 텍스트가 동일하게 유지되는지 확인.

## 5. 예상 결과
*   대본: "함박눈이 쏟아지는..."
*   이미지 프롬프트: `Scene 1: ... snowy winter golf course ...`, `Scene 6: ... man brushing snow off golf bag ...`
*   결과적으로 영상 제작 시 대본과 화면이 완벽하게 매칭됨.

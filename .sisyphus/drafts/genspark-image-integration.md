# Draft: GenSpark 이미지 생성 통합 분석

## Requirements (confirmed)
- 마마님 요청: 젠스파크(GenSpark)에서도 이미지 생성이 가능하도록 시스템에 적용하고 싶어함.
- 현재 시스템: 제미나이(Gemini) 중심의 이미지 생성 구조.

## Technical Decisions
- **이중 경로 구조 (Dual-Path)**: 
    - Frontend Direct API (Master Studio): Google GenAI SDK 사용.
    - Backend Automation (Puppeteer): `/api/image/ai-generate` 엔드포인트를 통해 브라우저 자동화 방식으로 이미지 생성.
- **젠스파크 통합 방식**: 젠스파크는 공식 이미지 API가 부족하므로, 기존 Puppeteer 기반 자동화 시스템(`puppeteerHandler.js`)을 확장하여 통합하는 것이 현실적임.

## Research Findings
- **젠스파크 특성**: 단순한 이미지 생성 API보다는 검색 및 에이전트(Spark) 중심 플랫폼임. 웹 UI에서는 이미지 생성이 가능함.
- **기존 코드 분석**:
    - `server/puppeteerHandler.js`에 `SERVICES.GENSPARK` 설정(URL, 셀렉터)은 이미 존재함.
    - 하지만 `submitPromptAndCaptureImage` 함수가 `GEMINI`에 고정되어 있고, 제미나이 전용 DOM 구조와 파일 패턴을 사용하고 있음.

## Open Questions
- 젠스파크 이미지 생성 후 결과물(이미지)을 감지하고 다운로드하는 구체적인 DOM 패턴은 무엇인가?
- 젠스파크에서 이미지 다운로드 시 파일명 패턴이나 저장 방식은 어떠한가?
- 프론트엔드 UI에서 사용자가 젠스파크를 이미지 서비스로 선택할 수 있는 옵션 추가 필요.

## Scope Boundaries
- INCLUDE: `puppeteerHandler.js` 리팩토링 및 젠스파크 지원 추가.
- INCLUDE: 프론트엔드(`ShortsLabPanel.tsx` 등) 서비스 선택 옵션 추가.
- EXCLUDE: 젠스파크 공식 API 연동 (현재로서는 비현실적).

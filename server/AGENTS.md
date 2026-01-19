# Module Context
- Express 서버(포트 3002)로 스크립트/이미지/영상 저장, 히스토리 관리, 엔진 설정 관리, Puppeteer 제어를 담당.
- 파일 출력 루트: `generated_scripts/`, `generated_scripts/images`, `generated_scripts/videos`, `longform_sessions/`, `style_templates/`, `engine_config.json`, `history.json`.

# Tech Stack & Constraints
- Node ES Module(`type: module`), Express 5, body-parser, cors, dotenv, jsonrepair, Puppeteer(+stealth).
- 파일 시스템 접근은 `path.join(__dirname, ...)` 패턴 유지, 존재 확인 후 생성.
- API 키는 `.env`에서만 로드(`GEMINI_API_KEY`/`API_KEY`), 서버 로그에 키 출력 금지.
- 브라우저 제어는 `puppeteerHandler.js` API 사용; 새 서비스 스위치는 `switchService` 경유.

# Implementation Patterns
- 서버 기동 시 필수 디렉터리/파일 생성 로직을 유지하고 확장 시 동일 패턴 사용.
- 핸들러 추가 시: 입력 검증 → 파일/브라우저 작업 → 예외 캐치 후 500 반환, 오류 로그 명확히.
- 파일명 생성 시 `safeTitle`/`timestamp` 유사 패턴으로 sanitize, base64 데이터는 prefix 제거 후 저장.
- 엔진 설정은 `readEngineConfig`/`writeEngineConfig` 유틸을 재사용하여 일관성 유지.

# Testing Strategy
- 수동 확인: `npm run server` 또는 `npm run dev` 후 API 호출로 검증(`/api/history`, `/api/save-story`, `/api/save-image`, `/api/save-video`, `/api/launch` 등).
- 브라우저 자동화 영향 변경 시 Puppeteer/Playwright 실행 환경에서 실제 시나리오 재현 필수.
- 파일 생성 로직 변경 시 생성 경로와 권한을 로컬에서 직접 확인.

# Local Golden Rules (Do/Don'ts)
- Do: 새 API는 CORS/JSON 본문 처리 설정을 준수, 응답 스키마를 클라이언트 기대치와 맞춤.
- Do: 브라우저 세션 수명 관리(launchBrowser/switchService) 일관성 유지, 종료 훅 제공 시 기존 패턴 재사용.
- Don't: 하드코딩된 절대경로, 동기 I/O 과도 사용으로 서버 블로킹 유발 금지(필요 시 async/await 고려).
- Don't: 클라이언트 스토리지와 불일치하는 히스토리 포맷 변경 금지(스키마 변경 시 클라이언트 업데이트 동반).

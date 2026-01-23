# Project Context & Operations
- 비즈 목표: 유튜브 쇼츠/롱폼 대본 생성, 템플릿 관리, 결과 저장·이미지/영상 생성 지원.
- Tech Stack: Vite + React(TypeScript) 프런트, Express(Node 20+ 가정) 백엔드, Puppeteer 스텔스, Playwright(E2E), dotenv/jsonrepair/uuid.
- Operational Commands: `npm install`, `npm run dev`(프런트+서버 동시), `npm run server`(백엔드만), `npm run build`, `npm run preview`.

# Golden Rules
- Immutable: API 키는 .env에만 두고 커밋 금지. Puppeteer/Playwright는 스텔스 옵션 유지, 무분별한 브라우저 세션 남기지 말 것. 파일 출력은 `generated_scripts/`, `longform_sessions/`, `style_templates/`, `server/user_data_*` 하위에만.
- Do: 로컬/서버 간 히스토리 동기화를 깨지 않도록 `/api/history` 계약 유지. 파일·폴더 생성 시 존재 확인 후 생성. 타입 안정성 유지(typescript / 명시적 타입).
- Don't: 하드코딩된 경로로 OS 의존 코드 추가 금지. 백엔드에서 프런트 전용 API 호출 금지. jsonrepair 없이 외부 JSON 신뢰 금지.
- CRITICAL: OpenCode 사용 시 bun 실행 금지. 모든 실행은 npm/node 기준으로 진행.
- Process: 모든 커뮤니케이션에서 사용자를 반드시 "마마님"으로 호칭한다.
- CRITICAL: 모든 코드 수정(edit, write 등)은 반드시 "마마님"의 명시적 승인(예: "수정해", "ㅇㅇ", "해라")이 있은 후에만 진행한다. 승인 없는 임의 수정은 절대 금지한다.
- 신규 `.md` 파일은 항상 작업 폴더 내에만 생성.

# Standards & References
- 코드 스타일: React 함수형 컴포넌트, 훅 우선. 모듈은 TypeScript 타입/enum 재사용(`types.ts`). fetch/axios 대신 기존 서비스 유틸을 활용. Node 측는 ES Module(`type: module`) 준수, `import.meta.url` 기반 경로 사용.
- Git 전략: 작은 단위 커밋, 메시지는 `feat: ...` / `fix: ...` / `chore: ...` 등 일관 포맷. 릴리스 버전은 순차 상승(예: v2.5.1 → v2.5.2) 후 태그/문서 반영.
- Maintenance Policy: 규칙과 코드가 어긋나면 해당 AGENTS.md에 우선 업데이트 제안 후 구현. 새로운 하위 컨텍스트가 생기면 AGENTS.md 추가/갱신.

# Context Map (Action-Based Routing)
- **[백엔드 API·자동화](./server/AGENTS.md)** — Express 핸들러, Puppeteer 제어, 파일 저장 로직 수정 시.
- **[프런트 서비스 계층](./services/AGENTS.md)** — 클라이언트 API 어댑터, 프롬프트/템플릿 처리, 엔진 설정 저장 작업 시.
- **[UI 컴포넌트](./components/AGENTS.md)** — 화면 요소, 패널, 마스터 스튜디오 등 React 컴포넌트 수정 시.
- **[커스텀 훅](./hooks/AGENTS.md)** — 상태 관리·이펙트 로직 분리 또는 신규 훅 작성 시.

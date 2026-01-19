# Module Context
- 클라이언트 서비스 계층으로 엔진 프롬프트 관리, 스토리 생성, 롱폼 요약/챕터 호출, 템플릿 분석/저장, 프롬프트 강화 유틸을 제공.
- 주요 모듈: `geminiService.ts`, `longformService.ts`, `templateService.ts`, `enginePromptStore.ts`, `promptEnhancementUtils.ts`, `koreanUtils.ts`.

# Tech Stack & Constraints
- 런타임: 브라우저/프런트 전용 TypeScript. Node 전용 모듈(fs, path 등) 사용 금지.
- HTTP 호출은 `fetch` 기반, 서버 엔드포인트(포트 3002) 계약 유지. 외부 LLM 키는 클라이언트에서 직접 노출하지 말 것.
- 타입 정의는 `types.ts`의 enum/interface 재사용, 상수는 `constants.ts` 활용.

# Implementation Patterns
- 서비스 함수는 순수 함수 형태로 유지하고, UI 상태 변경은 호출자에서 처리.
- 프롬프트/엔진 설정은 `enginePromptStore`를 통해 로드/저장/리셋; 기본값은 `getDefaultEnginePrompt` 활용.
- 템플릿 분석·변환 시 `analyzeScriptTemplate`, `parseFromText` 등 기존 파이프라인을 재사용해 스키마 일관성 유지.
- 프롬프트 강화 설정은 `normalizePromptEnhancementSettings`와 `applyPromptEnhancementSlots`로 표준화 후 적용.

# Testing Strategy
- 기본 확인: `npm run dev` 실행 후 UI 경로에서 기능 검증(생성/롱폼/템플릿 분석).
- API 계약 변경 시 서버와 동시 점검(`/api/history`, `/api/save-story` 등)으로 포맷 불일치 여부 확인.
- 파싱/정규화 로직 변경 시 경계 입력에 대한 수동 테스트(빈 문자열, 잘린 JSON, 이스케이프 문자).

# Local Golden Rules (Do/Don'ts)
- Do: 네트워크 오류/타임아웃 예외를 호출자에 표준화된 에러 메시지로 전달, 로깅은 최소화.
- Do: JSON 처리 시 `jsonrepair` 또는 방어적 파싱을 적용하여 UI 크래시를 방지.
- Don't: API 키/비밀 값을 로컬 스토리지나 코드에 하드코딩하지 말 것.
- Don't: 서비스 모듈에서 DOM 접근, 전역 상태 변조 금지(훅/컴포넌트에서 처리).

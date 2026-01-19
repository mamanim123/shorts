# 작업 개요
- 목표: 중앙 통제 및 위임 구조를 위한 AGENTS.md 시스템 신설 및 적용
- 산출물: 루트 AGENTS.md 및 하위(components, hooks, services, server) AGENTS.md

# 범위 및 비범위
- 포함: FE/BE 주요 컨텍스트 정의, Golden Rules, 테스트/실행 명령 정리, 폴더별 로컬 규칙
- 제외: 애플리케이션 기능 변경, 코드 리팩토링, 의존성 추가/삭제

# 작업 단계
1) 현재 스택/모듈 구조 확인 (package.json, server, components, hooks, services)
2) 루트 AGENTS.md 설계: 프로젝트 요약, 운영 명령, Golden Rules, Standards, Context Map
3) 폴더별 AGENTS.md 작성: Module Context, Tech Stack & Constraints, Implementation Patterns, Testing Strategy, Local Do/Don'ts

# 대상 파일
- ./AGENTS.md (신규)
- ./server/AGENTS.md (신규)
- ./services/AGENTS.md (신규)
- ./components/AGENTS.md (신규)
- ./hooks/AGENTS.md (신규)

# 리스크 및 대응
- 규칙 누락: 각 섹션에 Do/Don'ts와 테스트 명령 명시하여 커버
- 중복/충돌: 루트 Golden Rules와 로컬 룰을 분리 기재, 상위 우선 원칙 명시

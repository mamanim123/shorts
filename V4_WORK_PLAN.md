# v3.5 안정화 + v4.0 전환 작업 계획

## 목표
1) 보안/안정성 핫픽스: 영상 가져오기/다운로드 관련 취약점 제거
2) 파서/프롬프트 로직 통합: 중복/불일치 제거
3) 비주얼 일관성 강화: 의상/캐릭터/프롬프트 고정 규칙을 코드 레벨로 보장

## 체크리스트

### A. 보안/안정성
- [ ] /api/video/import-specific 경로 traversal 방어 (path.basename 적용)
- [ ] ESM 환경에서 require('os') 제거 및 DOWNLOAD_WATCH_DIR 재사용
- [ ] 누락된 /api/video/refine-prompt, /api/video/generate-smart 정합성 점검/정리

### B. 파서/프롬프트 통합
- [ ] 공용 JSON 파서 유틸 생성 (extract/escape/preprocess/jsonrepair 통합)
- [ ] ShortsLabPanel JSON 파싱 로직을 공용 유틸로 교체
- [ ] Shorts 생성기 JSON 파서도 공용 유틸로 통합
- [ ] 프롬프트 후처리(정체성/의상/금지어) 중복 최소화

### C. 비주얼 일관성
- [ ] ShortsLab에서 lockedOutfits 우선 적용 (LLM 출력 흔들림 방지)
- [ ] 씬별 prompt에 고정 의상/정체성/금지어 재주입 규칙 점검
- [ ] 이미지/영상 프롬프트에서 캐릭터/의상 문자열 변형 방지

### D. 검증
- [ ] npm run build
- [ ] 주요 플로우: 쇼츠랩 불러오기 → 영상 자동 매칭 → 수동 선택 경고

---
마마님 승인 하에 위 항목 순차 진행

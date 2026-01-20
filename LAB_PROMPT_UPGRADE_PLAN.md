# 🚀 쇼츠랩 프롬프트 빌더(labPromptBuilder.ts) 고도화 계획 (v3.2)

## 1. 개요
현재 `services/labPromptBuilder.ts`는 v3.1로 업데이트되어 높은 품질의 대본을 생성하고 있으나, 인물 이름의 고정성, 의상 매칭의 단순함, 그리고 LLM의 규칙 준수 불안정성을 해결하기 위해 v3.2로의 업그레이드를 제안함.

## 2. 주요 개선 목표
1. **인물 다양성(Character Diversity) 확보**
   - 화자 이름(지영, 준호) 고정 해제 -> 랜덤 이름 풀 도입.
2. **의상 매칭 로직(Smart Outfit Matching) 고도화**
   - 주제(Topic) 분석을 통한 카테고리 가중치 시스템 적용.
   - 미사용 레거시 코드 정리 및 `UNIFIED_OUTFIT_LIST` 완전 통합.
3. **지침 준수(Instruction Adherence) 강화**
   - 복선(Foreshadowing) 및 Show, Don't Tell 규칙의 프롬프트 배치 최적화.
   - 위반 사례(Anti-patterns) 명시를 통한 품질 강제.
4. **이미지 일관성(Visual Consistency) 엄격 통제**
   - 배경(Background) 문구의 씬별 복제 로직 안정화.

## 3. 상세 작업 체크리스트

### Phase 1: 데이터 보강 및 클린업
- [ ] `RANDOM_SEED_POOLS`에 `femaleNames`, `maleNames` 추가 (각 20개 이상).
- [ ] 파일 하단 미사용 레거시 프리셋(`LAB_OUTFIT_PRESETS`, `LAB_STYLE_PRESETS`) 제거.
- [ ] `UNIFIED_OUTFIT_LIST`의 카테고리 매칭 로직을 `pickFemaleOutfit`에 더 정교하게 반영.

### Phase 2: 로직 개선
- [ ] `buildLabScriptPrompt`에 `randomName` 파라미터 또는 내부 랜덤화 로직 추가.
- [ ] 주제(Topic)에서 장소와 의상을 유추하는 `inferContextFromTopic` 유틸리티 함수(필요 시) 검토.
- [ ] 1인칭 POV 규칙 위반 사례를 프롬프트 내에 더 강력하게 명시.

### Phase 3: 프롬프트 구조화 (v3.2)
- [ ] `SYSTEM_RULES`와 `SCENE_RULES`를 분리하여 LLM의 인지 부하 감소.
- [ ] "Show, Don't Tell" 규칙에 대한 예시를 장르별로 구체화.
- [ ] 이미지 프롬프트 생성 시 `lockedOutfits` 문자열이 변형되지 않도록 `STRICT` 지침 보강.

## 4. 기대 효과
- **재사용성 증가**: 매번 새로운 인물과 상황으로 대본이 생성되어 채널의 중복성 회피.
- **영상 품질 향상**: 의상과 장소의 완벽한 조화로 시각적 몰입도 증가.
- **편집 효율성**: 씬-캐릭터 매칭 오류 감소로 후속 작업(이미지/영상 생성) 자동화 성공률 향상.

---
**마마님의 승인 후 즉시 구현을 시작합니다.** (2026-01-20, Antigravity)

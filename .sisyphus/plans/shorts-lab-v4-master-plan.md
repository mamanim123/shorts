# ShortsLab V4 마스터 생성 — 종합 작업 계획서
경로: F:\projact\쇼츠대본생성기-v3.5.3
작성: 코드 직접 분석 기반 (추측 아님)

========================================================
## 0. 최종 목표 (한 문장)
"주제 입력 → 버튼 한 번"으로, 캐릭터/의상/배경/얼굴이 모든 장면에서
100% 일관된 고품질 대본 + 이미지프롬프트를 생성한다.
일관성은 LLM의 선의가 아니라 코드 구조로 강제 보장한다.

========================================================
## 1. 코드로 확정된 핵심 문제 (5대 근본 원인)

### [P1] 캐릭터가 두 시스템에서 따로 논다 (최우선/근본원인)
- 시스템 A (규칙): shortsLabCharacterRulesManager
    → appStorage['shorts-lab-character-rules']
    → getCharacterRules()가 읽음. 실제 이미지프롬프트 텍스트는 100% 이걸로 생성.
- 시스템 B (카탈로그): characterService
    → appStorage['characterCollection'] + 서버 /api/characters
    + 디스크 generated_scripts/characters/*/character.json (이미지만, 외모텍스트 없음)
    → 3면도(turnaroundImageIds: front/angle45/back) 보유.
- 연결: importCharacter(1회성 수동 복사)뿐. 양방향 자동 동기화 전무.
- characterId 필드는 저장만 하고 역참조 로직 없음 → 사실상 미사용.
- 이름 폴백 매칭("혜진" vs "혜진이")이 자주 끊김.

### [P2] rebalanceMasterSceneCharacterMix가 캐릭터를 강제로 섞음
- 위치: components/ShortsLabPanel.tsx
- "멀티샷 40%, 쓰리샷 15%" 비율을 맞추려고 LLM이 정한 characterIds를 덮어씀.
- 1인 대사 장면에 억지로 다른 캐릭터를 끼워넣음 → 매 실행마다 등장인물 바뀜.

### [P3] 씬 분해가 고정 캐릭터 대신 LLM 인물추출에 의존
- handleMasterStyleSceneGeneration: buildCharacterExtractionPrompt로 매번 인물 새로 추출.
- LLM이 조연을 누락/추가하면 slotMapping의 femaleIndex/maleIndex가 밀려 전체 재배치.

### [P4] 3면도 참조이미지가 텍스트와 따로 논다
- 참조이미지 시스템은 이미 구현됨 (ShortsLabPanel 2821~2954):
    pickReferenceViewFromCamera, referenceImages, positionGuide, 이미지생성 첨부.
- 그러나 텍스트(buildIdentityTraitBlock)와 이미지(casting.referenceImageUrls)가
    서로 다른 출처 → 같은 캐릭터 보장 없음.
- "AI Studio에서 생성한 캐릭터 3면도 세트"는 실제 이미지가 아니라 placeholder 텍스트.
    → 과거 결과물은 참조이미지 없이 텍스트만으로 생성되어 얼굴이 흔들림.

### [P5] 코드 위생 문제
- ID 정규화 .replace() 로직이 패널에 5~6곳 복붙 (defaults.ts에 정식 함수 있는데도).
- characterService age 기본값이 '30?' (인코딩 깨진 '30대') → 실제 데이터 오염.
- localhost:3002 하드코딩 수십 곳.
- 백업 .tsx 파일이 components/에 본체와 혼재(빌드 오염 위험).
- 파일 인코딩 EUC-KR/UTF-8 혼재(주석·character.json name 깨짐).

========================================================
## 2. 통찰: 세 문제가 사실 하나다
"캐릭터 동기화"(P1) = "3면도 제대로 적용"(P4) = "V4 일관성"의 토대.
모두 'characterId 연결 복구' 하나로 동시에 해결된다.
→ 따라서 characterId 단일화가 1순위 토대 작업.

========================================================
## 3. V4 파이프라인 설계 (단계 분리 = 줄거리 버튼 철학 계승)
각 LLM 호출은 한 가지 일만 한다. (줄거리 버튼이 안정적인 이유)

- 단계 A. 줄거리 : generateBenchmarkStorylinePackage (재사용)
- 단계 B. 대본   : buildLabScriptOnlyPrompt (재사용, 의상/배경 안 만듦)
- 단계 C. 캐릭터 확정 : 고정 슬롯 + characterId 잠금 (불변)
- 단계 D. 씬 배정 : LLM은 "각 문장 = 고정목록 중 누구" characterIds만 결정
                    (rebalance 호출 안 함)
- 단계 E. 조립   : 코드가 조립
    · 외모 텍스트 : characterId로 조회 (고정)
    · 3면도 이미지: 같은 characterId로 조회 → 카메라각도별 뷰 자동첨부
    · 의상       : useRandomOutfits 토글 (ON=리스트랜덤 / OFF=LLM디자인), 슬롯당 1벌 고정
    · 배경       : 1번 씬 배경으로 전 씬 강제 통일
    · 카메라     : sanitizeCameraAngle 유지

========================================================
## 4. 일관성 불변식 (검증 기준)
1. lockedOutfits[slotId]는 영상 전체에서 단 1개 값.
2. 같은 slotId의 identity/hair/body/face는 모든 장면 동일.
3. background는 모든 장면 동일(1씬 기준).
4. scenes[].characterIds는 확정된 고정 슬롯 목록의 부분집합.
5. 텍스트 외모와 참조이미지가 동일 characterId.
6. 같은 주제+줄거리 재생성 시 캐릭터 구성 무작위 변동 없음.

========================================================
## 5. 작업 순서 (Phase)

### Phase 1 — 캐릭터 단일화 (토대, 최우선)
- T1. SSOT 결정: 시스템 B(characterService, characterId 보유)를 원천으로.
- T2. syncSlotFromCatalog(slotId): rule.characterId로 B 조회 →
      identity/hair/body/face/skinTone 갱신. 앱 시작+카탈로그 변경 시 자동.
- T3. 정규화 통일: ruleKeyToSlotId/slotIdToRuleKey만 사용,
      패널 인라인 .replace() 전부 제거.
- T4. 버그 수정: age '30?'→'30대', 누락필드 보강.

### Phase 2 — 3면도 참조이미지 연결
- T5. 슬롯ID → characterId → turnaroundImageIds → casting.referenceImageUrls 복구.
- T6. 텍스트(buildIdentityTraitBlock)와 이미지를 동일 characterId 기준 정렬.
- T7. placeholder "3면도 세트" 텍스트 제거 → 실제 이미지 첨부.
- T8. 참조이미지 없는 슬롯 텍스트 폴백 + UI "이미지 없음" 경고.

### Phase 3 — 씬 배정 안정화
- T9. V4에서 rebalanceMasterSceneCharacterMix 미사용.
- T10. 씬 배정 LLM에 "고정 슬롯 목록 중에서만 선택" 제약 (신규추출 금지).

### Phase 4 — V4 조립/연결
- T11. shortsLabV4FlowService: A~E 오케스트레이션.
- T12. handleMasterGenerateV4를 runShortsLabV4Master 호출로 교체
       (현재는 토스트만 띄우는 빈 함수).
- T13. masterGenerateLockRef 정상화, useRandomOutfits 토글 연동, setScenes/preview.

### Phase 5 — 품질/위생 (선택)
- T14. validateProfileConsistency 활성화(이미 존재, 미사용) → 생성후 diff 표시.
- T15. localhost:3002 상수화, 백업 .tsx를 _backup/로 격리.

========================================================
## 6. 파일별 역할
- services/characterService.ts                : 캐릭터 SSOT (characterId 원천)
- services/shortsLabCharacterRulesManager.ts  : 슬롯 배정 + 동기화 뷰
- services/shortsLabCharacterRulesDefaults.ts : 정규화 함수 정식 위치
- services/labPromptBuilder.ts                : applyCharacterInfoToScenes 등(재사용)
- services/shortslab-v4/shortsLabV4FlowService.ts    : V4 오케스트레이션(메인)
- services/shortslab-v4/shortsLabV4CharacterService.ts: 슬롯 확정/고정
- services/shortslab-v4/shortsLabV4SceneService.ts   : 씬 배정 프롬프트
- components/ShortsLabPanel.tsx               : handleMasterGenerateV4 연결, rebalance 제거
- 재사용(수정금지): geminiService.generateBenchmarkStorylinePackage

========================================================
## 7. 미결정 사항 (작업 전 확인 필요)
[Q1] 슬롯 캐릭터 배정 방식:
   (A) 사용자가 생성 전 직접 지정 (WomanA=혜진...) → 일관성 100%
   (B) V4 자동 배정 후 잠금
[Q2] SSOT를 시스템 B(characterService)로 잡는 데 동의?

========================================================
## 8. 안전장치
- 수정 전 백업: ShortsLabPanel.tsx.bak_before_v4 (날짜 포함).
- 기존 handleMasterGenerate / AI 줄거리 생성 버튼은 절대 수정 안 함(독립 운영).
- 각 Phase 완료 후 빌드 확인 → 다음 Phase 진행.

========================================================
## 9. 검증 시나리오 (완료 판정)
- 동일 주제 2회 생성 → lockedOutfits/identity/background diff = 0.
- 1인 대사 장면이 1인 유지(강제 멀티샷 없음).
- 미리 만든 캐릭터(혜진 등) 슬롯이 전 장면 동일 얼굴.
- 텍스트 외모 = 참조이미지 characterId 일치(로그 확인).
---
## [진행메모] Phase 1~2 완료
- Phase1: syncSlotFromCatalog / syncAllSlotsFromCatalog 추가 (characterId 기반 동기화). tsc OK.
- Phase2: 3면도 casting 로직은 구조상 정상(slotId key 통일됨). 수정 불필요.
  핵심결함 = V4 자동배정 시 characterCastings Map이 비어 3면도 미첨부.
  → Phase4 V4플로우에 "casting 자동구성" 단계로 해결 예정.
  (참고: handleUploadCharacterReference의 param명 characterId는 실제 slotId, 버그 아님)

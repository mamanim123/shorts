# 이미지 프롬프트 개선 작업 체크리스트

## 목표
AI 대본 생성 시 이미지 프롬프트의 캐릭터 일관성, 개별 동작, 의상 정확성 문제 해결

---

## 완료된 작업 ✅

### 1. 남성 body 개별화 (labPromptBuilder.ts)
- [x] `PROMPT_CONSTANTS_PROXY`에 `MALE_BODY_A`, `MALE_BODY_B`, `MALE_BODY_C` 추가
- [x] ManA → `MALE_BODY_A`, ManB → `MALE_BODY_B`로 변경
- **이전**: 두 남성 모두 동일한 `MALE_BODY` 사용
- **이후**: 각 남성 캐릭터가 개별 body 정보 보유

### 2. 투샷/쓰리샷 개별 동작 규칙 강화 (shortsLabStep2PromptRulesDefaults.ts)
- [x] 투샷 예시에 개별 동작 추가 (gesturing, listening 등)
- [x] 쓰리샷 예시 신규 추가
- [x] "개별 동작 필수 규칙" 섹션 신규 추가
- [x] 금지사항에 "동일 동작 적용" 추가 (5번)
- [x] 최종 검증 체크리스트에 개별 동작/악세서리 위치 검증 항목 추가

### 3. manualSceneBuilder.ts 규칙 강화
- [x] 핵심 규칙 5번: 개별 동작 필수 (쌍둥이 방지)
- [x] 핵심 규칙 6번: 악세서리 Person 블록 안에 포함
- [x] 체크리스트에 검증 항목 추가

### 4. 이전 세션에서 완료
- [x] FEMALE_BODY_D 버그 수정 (identity/hair 중복 제거)
- [x] characterSlot 순서 = Person 번호 순서 규칙 추가
- [x] 의상 일관성 규칙 강화
- [x] 모달테스트 버튼 삭제

### 5. Body 후처리 기능 추가 (2026-02-02 완료) 🎉
**위치**: `youtube-shorts-script-generator.tsx:419-569`

- [x] **Phase 1**: 코드 분석 및 설계 (3개 병렬 에이전트 활용)
- [x] **Phase 2**: body 추가 기능 구현 - AI가 누락한 body 자동 추가
- [x] **Phase 3**: body 수정 기능 구현 - 축약된 body를 전체 body로 교체
- [x] **Phase 4**: 투샷/쓰리샷 대응 - Person 블록 내부에 정확히 삽입
- [x] **Phase 5**: autoEnhance 플래그 연동 - 후처리 ON/OFF 지원
- [x] **Phase 6**: TypeScript 컴파일 검증 완료
- [x] **Phase 7**: 완료 보고서 작성

**해결된 문제**:
- ✅ 원샷 씬에서 body 축약 문제 (예: "perfectly managed sophisticated look"만 표시 → 전체 디테일 추가)
- ✅ 투샷/쓰리샷 씬에서 body 누락 문제 (~50% 누락률 → 0% 누락)
- ✅ 의상규칙 탭 body 수정이 실제 이미지 프롬프트에 반영 안 되던 문제

**상세 문서**: `plans/body_후처리_기능_완료보고.md`

---

## 미완료 작업 (검토 필요) 📋

### 1. 동작(Action) 후처리 강화 (composeManualPrompt)
**위치**: `components/ShortsLabPanel.tsx:2278~2404`

현재 상태:
- 이미 개별 동작 분배 시도 중 (actionChunks[index])
- 하지만 AI가 "walking together" 같은 공통 동작만 주면 분배 안 됨

옵션:
- [ ] **옵션 A**: 자동 동작 생성 - AI가 공통 동작만 줘도 후처리에서 캐릭터별 동작 자동 분배
- [ ] **옵션 B**: AI 규칙만 강화 - 방금 수정한 프롬프트 규칙으로 AI가 개별 동작 생성하도록 유도
- [ ] **옵션 C**: 둘 다 - AI 규칙 강화 + 후처리 안전장치 추가

### 2. 대본-이미지 동기화 문제
- [ ] action 필드 내용이 longPrompt에 제대로 반영되는지 확인
- [ ] AI가 생성한 action과 실제 이미지 프롬프트 불일치 문제 분석

### 3. 악세서리 위치 문제
- [ ] Person 블록 밖에 악세서리가 있으면 새 캐릭터로 오인되는 문제
- [ ] 후처리에서 악세서리 위치 검증/수정 로직 추가 검토

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `services/labPromptBuilder.ts` | 프롬프트 상수, 캐릭터 body 정의 |
| `services/shortsLabStep2PromptRulesDefaults.ts` | AI 프롬프트 규칙 (2단계) |
| `services/manualSceneBuilder.ts` | 수동 씬 빌더, 의상 일관성 규칙 |
| `components/ShortsLabPanel.tsx` | UI + `composeManualPrompt` 후처리 |

---

## 핵심 함수

### composeManualPrompt (후처리)
```
위치: ShortsLabPanel.tsx:2278~2404
역할: AI 원문 → [Person X] 블록 조립 → 중복 제거 → 최종 프롬프트
```

현재 로직:
1. AI 원문에서 START, END, Scene 번호 제거
2. identityBlock 조립: `[Person X: identity, hair, body, wearing outfit, accessories, action, expression]`
3. AI 중복 설명 제거 ("A stunning Korean woman" 등)
4. 의상 표현 제거 (`wearing...`, `outfit:...`)
5. 최종 프롬프트 조립

개선 포인트:
- 라인 2303~2324: actionChunks 분배 로직 → 공통 동작 시 자동 분배 필요

---

## 테스트 방법

1. AI 대본 생성 실행
2. `ai대본생성.txt` 파일에서 결과 확인
3. 확인 항목:
   - [ ] 남성 캐릭터들이 서로 다른 body 정보를 가지는가?
   - [ ] 투샷/쓰리샷에서 각 캐릭터가 개별 동작을 하는가?
   - [ ] 악세서리가 Person 블록 안에 있는가?
   - [ ] 의상이 모든 씬에서 일관되게 유지되는가?
   - [ ] characterSlot 순서와 Person 번호가 일치하는가?

---

## 참고: 발견된 문제 원인 분석

### 문제 1: 캐릭터 의상 불일치
- 원인: AI가 의상을 축약/변형 (예: "Coral Ruched Off-shoulder..." → "coral dress")
- 해결: 의상 일관성 규칙 강화, 체크리스트 추가

### 문제 2: 쌍둥이 동작
- 원인: AI가 "walking together" 같은 공통 동작만 생성
- 해결: 개별 동작 규칙 추가, 후처리 강화 검토

### 문제 3: Scene 5 이미지에서 여성 갑자기 등장
- 원인: scarf 키워드가 Person 블록 밖에 있어 새 캐릭터로 오인
- 해결: 악세서리 위치 규칙 추가

### 문제 4: 남성 의상 동일
- 원인: ManA, ManB 모두 동일한 MALE_BODY 사용
- 해결: ✅ MALE_BODY_A, MALE_BODY_B로 개별화 완료

---

*마지막 업데이트: 2026-02-02*

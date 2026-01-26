# Shorts Lab 2단계 생성 로직 고도화 계획

본 계획은 2단계 생성(대본 → 이미지 프롬프트) 과정에서 발생하는 프롬프트 중복, 의상 불일치, 그리고 논리적 구도 오류를 해결하여 생성 품질을 극대화하는 것을 목표로 합니다.

## 주요 목표
1.  **프롬프트 중복 제거**: AI가 생성한 상세 프롬프트와 앱의 고정 정보를 지능적으로 병합하여 중복 묘사 제거.
2.  **의상 유니크성 및 일관성 강제**: 모든 캐릭터가 서로 다른 의상을 입되, 씬 전체에서 동일한 의상을 유지하도록 보장.
3.  **논리적 구도 보정**: POV(1인칭 시점)와 인물 수(원샷/투샷/쓰리샷) 간의 논리적 모순 해결.

## 분석 페이즈 결과 및 문제점
-   **중복**: AI의 `longPrompt`와 앱의 `identityBlock`이 겹쳐서 프롬프트가 과도하게 길어짐.
-   **의상**: AI가 대본 상황에 맞춰 임의의 의상을 써버리면 앱의 고정 슬롯 의상과 충돌함.
-   **POV**: 3명이 한꺼번에 보이는 POV 샷 등 카메라 연출의 명확성 부족.

## 변경 계획

### 1. 프롬프트 조립 엔진 개선 (`ShortsLabPanel.tsx` & `manualSceneBuilder.ts`)
-   `composeManualPrompt` 로직 수정: AI `longPrompt`가 있으면 이를 골격으로 사용하되, 캐릭터 묘사 부분만 `[Person X: ...]` 스타일로 정밀 치환.
-   `summary`, `action` 등을 무조건 이어 붙이지 않고, `longPrompt`에 내용이 충분하지 않을 때만 보완적으로 사용.

### 2. 의상 선택 및 고정 강화 (`ShortsLabPanel.tsx`)
-   `buildRandomOutfitsByCharacter`에서 추출된 모든 캐릭터가 절대 중복되지 않는 의상을 할당받도록 보장.
-   `validateAndFixPrompt`에서 각 캐릭터별 `wearing [outfit]` 문구를 정규식으로 정밀 감지하여 앱이 지정한 고유 의상으로 강제 교체.

### 3. 카메라 & 샷 타입 검증 로직 추가 (`labPromptBuilder.ts`)
-   `POV` 샷일 경우 자동으로 인물 수를 조정하거나 시점 대상이 명확하도록 보정 로직 추가.
-   동일한 앵글의 과도한 반복 방지 로직 고도화.

## 체크리스트
- [ ] `ShortsLabPanel.tsx` 내 `composeManualPrompt` 중복 제거 로직 구현
- [ ] 캐릭터별 의상 유니크성 보장 로직 (Slot-specific uniqueness) 점검
- [ ] `validateAndFixPrompt`의 다중 캐릭터 의상 치환 성능 개선
- [ ] POV 샷 논리 오류 자동 보정 기능 추가
- [ ] 종합 테스트 및 로그 확인

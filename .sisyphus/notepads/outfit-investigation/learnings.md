## 2026-01-27 의상 반복 발생 원인 분석

### 1. 하드코딩된 의상 리스트 (Constants)
- `constants.ts` 내 `UNIFIED_OUTFIT_LIST`에 약 80여 개의 의상이 정의되어 있음.
- ROYAL, YOGA, GOLF LUXURY, SEXY, MALE 카테고리로 구분됨.

### 2. 의상 선택 로직의 결함 (ShortsLabPanel.tsx)
- `buildRandomOutfitsByCharacter` 함수 내에서 `candidates.find(...) || candidates[0]` 방식을 사용 중.
- 이 방식은 리스트의 **앞부분부터** 사용되지 않은 의상을 순차적으로 선택함.
- `UNIFIED_OUTFIT_LIST`는 항상 동일한 순서(ROYAL-001부터 시작)이므로, 사용자가 매번 같은 의상(흰색 터틀넥 등)을 보게 되는 원인이 됨.
- `Math.random()`을 사용하지 않아 "랜덤"이 아닌 "순차" 선택이 이루어지고 있음.

### 3. 사용자 정의 의상 반영
- 서버의 `outfits.json`에 저장된 13개의 사용자 의상은 `buildOutfitPool`을 통해 리스트 뒤쪽에 붙음.
- 순차 선택 로직 때문에 앞부분의 기본 의상들이 먼저 소진되지 않으면 사용자 의상까지 도달하기 어려움.

### 4. 해결 방안
- `ShortsLabPanel.tsx`의 `buildRandomOutfitsByCharacter` 로직을 `Math.random()` 기반의 진짜 랜덤 선택으로 변경.
- 필요 시 카테고리별 가중치나 우선순위를 고려할 수 있도록 개선.

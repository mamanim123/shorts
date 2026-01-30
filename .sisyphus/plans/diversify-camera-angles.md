# 카메라 앵글 다양화 및 시네마틱 연출 강화 계획

## TL;DR

> **Quick Summary**: '미디엄샷' 편향 문제를 해결하기 위해 카메라 앵글 선택 로직의 버그를 수정하고, 화려한 시네마틱 앵글(항공샷, 더치앵글 등)을 데이터셋에 추가하여 영상의 시각적 다양성을 확보한다.
> 
> **Deliverables**:
> - `ShortsLabPanel.tsx`: `pickCameraPrompt` 버그 수정 및 앵글 풀 확장
> - `shortsLabPromptRulesDefaults.ts`: 스토리 단계별 시네마틱 앵글 매핑 업데이트
> - `ShortsLabPanel.tsx`: `detectCameraKeyword` 정밀도 향상
> 
> **Estimated Effort**: Small (1시간 내외)
> **Parallel Execution**: NO (순차적 데이터/로직 수정 권장)
> **Critical Path**: `pickCameraPrompt` 버그 수정 → 앵글 데이터 확장

---

## Context

### Original Request
마마님께서 이미지 프롬프트 생성 시 '원샷'이더라도 앵글이 '미디엄샷' 위주로만 나오는 문제가 성의 없다고 지적하셨습니다. 클로즈업, 항공샷 등 다양한 앵글이 적극적으로 활용되길 원하십니다.

### Interview Summary
**Key Discussions**:
- 분석 결과 `pickCameraPrompt` 함수에서 앵글 회전 값이 무시되는 버그 발견.
- `medium-wide`가 `medium`으로 오인식되는 문제 확인.
- `bird's-eye`, `canted` 등 화려한 앵글의 활용 빈도가 낮음.

---

## Work Objectives

### Core Objective
카메라 앵글 선택 시스템을 개선하여 매 세션마다 다양하고 역동적인 시각적 연출을 제공한다.

### Concrete Deliverables
- [ ] `ShortsLabPanel.tsx`: `pickCameraPrompt`가 계산된 회전 앵글을 항상 반환하도록 수정
- [ ] `ShortsLabPanel.tsx`: `CAMERA_ANGLE_KEYWORDS` 및 `CAMERA_PROMPT_FALLBACKS` 확장 (Bird's eye, Dutch angle 등)
- [ ] `shortsLabPromptRulesDefaults.ts`: `cameraMapping`에 시네마틱 앵글(low-angle, canted) 추가

### Definition of Done
- [ ] 2단계 생성 시 '미디엄샷'의 비율이 이전보다 현저히 줄어듦 확인.
- [ ] 8개 씬 중 최소 3개 이상의 서로 다른 앵글(예: close-up, wide, bird's-eye)이 포함됨 확인.
- [ ] POV 샷 설정 시 앵글 회전 로직이 간섭하지 않음 확인.

---

## Verification Strategy

### Manual QA Procedures
1. `npm run dev` 실행 후 쇼츠랩 패널 접속.
2. 대본 생성 후 '2단계 생성' 클릭.
3. 생성된 각 씬의 `longPrompt`를 확인하여 앵글 키워드가 다양하게 분포하는지 검증.
4. 특히 Climax(6-7번 씬) 단계에서 역동적인 앵글(low-angle 등)이 나오는지 확인.

---

## TODOs

- [ ] 1. `ShortsLabPanel.tsx` 카메라 앵글 선택 로직 수정 및 확장

  **What to do**:
  - `pickCameraPrompt` 함수 수정: `shouldRotate`가 true일 때 계산된 `keyword`에 해당하는 `CAMERA_PROMPT_FALLBACKS`를 즉시 반환하도록 변경 (현재는 겹칠 때만 반환함).
  - `detectCameraKeyword` 수정: 정규표현식 등을 사용하여 단어 경계를 확인하거나 긴 키워드(medium-wide)를 먼저 체크하도록 개선.
  - `CAMERA_ANGLE_KEYWORDS` 확장: `bird's-eye`, `canted`, `overhead`, `low-angle`, `high-angle` 등 추가.
  - `CAMERA_PROMPT_FALLBACKS` 확장: 추가된 키워드에 대한 상세 영어 프롬프트 정의.

  **Must NOT do**:
  - POV 샷(`pov` 키워드 포함 시)은 앵글 회전 로직에서 제외(보존)할 것.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 명확한 버그 수정 및 상수 추가 작업임.

- [ ] 2. `shortsLabPromptRulesDefaults.ts` 스토리 단계별 앵글 매핑 업데이트

  **What to do**:
  - `DEFAULT_PROMPT_RULES.cameraMapping` 내 각 단계별 앵글 다양화:
    - `climax`: `low-angle` 또는 `close-up`
    - `twist`: `canted` (Dutch angle) 또는 `wide`
    - `setup`: `bird's-eye` 또는 `wide`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 설정값 업데이트 작업임.

---

## Success Criteria

### Verification Commands
```bash
# 빌드 및 실행 확인
npm run dev
```

### Final Checklist
- [ ] 앵글 회전 로직 정상 작동 (콘솔 로그로 확인 가능하게 추가 권장)
- [ ] 앵글 키워드 중복 제거
- [ ] 10개 이상의 다양한 앵글 풀 확보

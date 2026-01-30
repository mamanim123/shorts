# [V2] 카메라 앵글 다양화 및 시네마틱 연출 고정밀 강화 계획

## TL;DR

> **Quick Summary**: 앵글 선택 로직의 핵심 버그를 수정하고, '미디엄샷' 편향을 원천 차단하는 '시네마틱 전용 풀'을 도입한다. 항공샷, 더치앵글 등 10종 이상의 고급 앵글을 데이터셋에 추가하여 영상의 시각적 완성도를 극대화한다.
> 
> **Deliverables**:
> - `ShortsLabPanel.tsx`: `pickCameraPrompt` 로직 수정 (회전 값 항상 반환)
> - `ShortsLabPanel.tsx`: `CINEMATIC_VARIETY_POOL` 신설 및 앵글 상수 10+종 확장
> - `shortsLabPromptRulesDefaults.ts`: `climax`, `twist` 단계에 역동적 앵글 매핑
> - `ShortsLabPanel.tsx`: `medium-wide` 우선순위 감지 로직 적용
> 
> **Estimated Effort**: Small (1.5시간)
> **Parallel Execution**: NO
> **Critical Path**: `pickCameraPrompt` 버그 수정 → 시네마틱 풀 적용 → 매핑 업데이트

---

## Context

### Original Request
마마님께서 성의 없는 '미디엄샷' 위주의 앵글 구성을 지적하시고, 항공샷, 클로즈업 등 다양한 시각적 연출을 명령하셨습니다.

### Momus Feedback (V1)
- `cameraMapping`의 실제 적용 경로(함수)를 명시할 것.
- `pickCameraPrompt`의 목표 동작을 규칙으로 고정할 것.
- `medium-wide` 오인식 해결을 위한 키워드 우선순위 명시.
- 주관적인 기준 대신 수치화된 측정 기준을 제시할 것.

---

## Work Objectives

### Core Objective
'미디엄샷'의 점유율을 25% 이하로 낮추고, 10종 이상의 다양한 시네마틱 앵글이 자동으로 교차 편집되는 환경을 구축한다.

### Concrete Deliverables
- `ShortsLabPanel.tsx`: 
    - `CAMERA_ANGLE_KEYWORDS`에 `medium-wide`를 `medium`보다 앞에 배치.
    - `CINEMATIC_VARIETY_POOL` 상수 추가 (8종 이상: bird's-eye, canted, low-angle 등).
    - `pickCameraPrompt` 수정: `shouldRotate` 시 `CINEMATIC_VARIETY_POOL`에서 순환 선택 후 즉시 반환.
- `shortsLabPromptRulesDefaults.ts`:
    - `cameraMapping` 내 `climax`를 `low-angle`로, `twist`를 `canted`로 업데이트.

### Definition of Done
- medium + medium-wide 합계가 모든 씬에서 최대 2개 이하
- 한 세션에서 최소 4개 이상의 서로 다른 앵글 포함
- POV 샷은 회전 로직 제외로 시점 유지

---

## Verification Strategy

### Manual QA Procedures
1. `npm run dev` 실행.
2. 대본 생성 후 '2단계 생성' 클릭.
3. 콘솔 로그에서 `[Camera Rotation] New angle assigned: ...` 메시지 확인.
4. Preview 탭에서 모든 씬의 프롬프트 맨 앞 키워드를 전수 조사하여 위 기준(Max 2 Medium) 충족 여부 확인.

---

## TODOs

- CAMERA_ANGLE_KEYWORDS 최상단에 medium-wide 추가
- CAMERA_PROMPT_FALLBACKS에 신규 앵글 프롬프트 추가
- ShortsLabPanel.tsx pickCameraPrompt 고정밀 수정
  - shouldRotate일 때 풀에서 선택한 앵글의 FALLBACK 값을 무조건 반환
  - 동일 앵글 연속 선택 시 한 칸 이동 로직 유지
  - 로그 추가: "[Camera Rotation] Changed from ..."
- shortsLabPromptRulesDefaults.ts 시네마틱 매핑 강화
  - climax: low-angle + hero shot 프롬프트
  - twist: canted + dutch angle 프롬프트

---

## Success Criteria

### Verification Commands
```bash
npm run dev
```

### Final Checklist
- [ ] `medium-wide`가 정상적으로 스트립됨 (`stripCameraPrefix` 작동 확인).
- [ ] 모든 씬 중 미디엄샷은 2개 이하.
- [ ] POV 샷은 `pickCameraPrompt`에서 `basePrompt`를 그대로 반환하여 시점 유지.

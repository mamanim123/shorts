# 자동 후처리 옵션 적용 수정 계획

## 1. 현상 분석
- **증상**: 사용자가 설정 화면에서 "자동 후처리(Auto Enhance)" 옵션을 꺼도(`Off`), 대본 생성 시 자동으로 후처리가 적용되고 있음.
- **원인**: `geminiService.ts`의 `enhancePromptWithSafeGlamour` 함수에서 설정값(`settings`)이 없거나 일부만 넘어올 경우, 무조건 `DEFAULT_PROMPT_ENHANCEMENT_SETTINGS`를 적용함. 이 기본값은 `autoEnhanceOnGeneration: false`로 되어 있으나, 호출부에서 이를 체크하지 않고 바로 `applyPromptEnhancementSlots`를 실행해버림.

## 2. 수정 목표
- 설정 화면의 "자동 후처리" 옵션(`autoEnhanceOnGeneration`)이 `Off`이면, 대본 생성 시 후처리를 건너뛰도록 수정.
- 단, UI에서 수동으로 "후처리" 버튼을 눌렀을 때는 강제로 실행되도록 유지.

## 3. 수정 대상 파일
- `f:/test/쇼츠대본생성기-v4.1/services/geminiService.ts`

## 4. 상세 구현 계획
1. `enhancePromptWithSafeGlamour` 함수 내에서 `settings.autoEnhanceOnGeneration` 값을 확인.
2. 이 값이 `false`이면, 원본 프롬프트를 그대로 반환하고 함수 종료.
3. `DEFAULT_PROMPT_ENHANCEMENT_SETTINGS`가 적용되더라도, 이 기본값의 `autoEnhanceOnGeneration`은 `false`이므로, 설정이 안 넘어왔을 때도 자동 후처리는 안 되는 것이 기본 동작이 됨.

## 5. 예상 코드 변경
```typescript
// services/geminiService.ts

export const enhancePromptWithSafeGlamour = (
  prompt: string,
  context: string = "",
  settings?: NormalizedPromptEnhancementSettings
): string => {
  if (!prompt) return '';
  const normalized = settings ?? DEFAULT_PROMPT_ENHANCEMENT_SETTINGS;

  // [NEW] 자동 후처리 옵션 확인
  // 설정에서 끄면(Off) 여기서 바로 리턴되어 후처리가 안 됨.
  if (!normalized.autoEnhanceOnGeneration) {
    return prompt;
  }

  const hasFemale = /\b(Woman|Girl|Lady|Female|여성|여자)\b/i.test(prompt);
  return applyPromptEnhancementSlots(prompt, normalized, { hasFemaleCharacter: hasFemale });
};
```

## 6. 검증 계획
- 설정 화면에서 "자동 후처리"를 끄고 대본 생성 -> 원본 프롬프트 유지 확인.
- 설정 화면에서 "자동 후처리"를 켜고 대본 생성 -> 후처리 적용 확인.

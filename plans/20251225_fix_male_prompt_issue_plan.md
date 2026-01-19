# 남성 캐릭터 프롬프트 오류 수정 계획

## 1. 현상 분석
- **증상**: 쇼츠 대본에 남성 캐릭터가 등장하고 프롬프트에도 남성 묘사가 있으나, 생성된 이미지에는 여성만 등장함.
- **원인**: `promptEnhancementUtils.ts`의 `applyPromptEnhancementSlots` 함수가 프롬프트 내 남성 키워드 유무와 관계없이 여성 전용 묘사("Her silhouette...", "Her outfit...")를 강제로 주입하고 있음. 이로 인해 AI가 남성 묘사를 무시하고 여성을 생성함.

## 2. 수정 목표
- 남성 캐릭터가 등장하는 씬(프롬프트에 남성 키워드 포함)에서는 여성 전용 슬롯(체형, 의상 등)이 주입되지 않도록 예외 처리 추가.

## 3. 수정 대상 파일
- `f:/test/쇼츠대본생성기-v4.1/services/promptEnhancementUtils.ts`

## 4. 상세 구현 계획
1. `applyPromptEnhancementSlots` 함수 내 반복문에서 현재 슬롯이 여성 전용 슬롯인지 확인.
2. 프롬프트 텍스트(`inputPrompt`)에 남성 관련 키워드(Man, Male, Husband, He, His, Him, 남성, 남자, 남편 등)가 포함되어 있는지 정규식으로 검사.
3. **남성 키워드가 존재하고** AND **현재 슬롯이 여성 전용 슬롯**인 경우, 해당 슬롯 적용을 건너뛰도록(`continue`) 로직 추가.

## 5. 예상 코드 변경
```typescript
// promptEnhancementUtils.ts 내부

// [변경 전]
if (FEMALE_SLOT_REGEX.test(slot.label || '') && !hasFemale) continue;

const sentence = buildSlotSentence(slot);

// [변경 후]
if (FEMALE_SLOT_REGEX.test(slot.label || '') && !hasFemale) continue;

// [NEW] 남성 캐릭터 보호 로직
const isMaleScene = /\b(Man|Male|Boy|Guy|Husband|He|His|Him|남성|남자|남편)\b/i.test(prompt);
if (isMaleScene && FEMALE_SLOT_REGEX.test(slot.label || '')) {
  continue;
}

const sentence = buildSlotSentence(slot);
```

## 6. 검증 계획
- 수정 후 남성 캐릭터가 등장하는 대본을 생성하여 로그 확인.
- 프롬프트에 "Her silhouette..." 등의 여성 묘사가 빠져있는지 확인.

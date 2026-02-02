# 의상 중복 방지 로직 올바른 수정 완료 보고서

**작업 완료일**: 2026-02-03
**수정 파일**:
- `youtube-shorts-script-generator.tsx`
- `components/ShortsLabPanel.tsx`

---

## 📋 문제 개요

### 이전 잘못된 접근 (2026-02-03 오전)
❌ **색상 변경 방식** - 의상리스트에 없는 가짜 의상 생성
```typescript
// 잘못된 방식
"White Off-shoulder dress" → "Cream Off-shoulder dress" (가짜!)
```

### 올바른 요구사항
✅ **의상리스트에서 랜덤 재선택** - 실제 의상 풀에서 다시 뽑기
```typescript
// 올바른 방식
pickFemaleOutfit(genre, topic, [이미사용된의상들])
```

---

## 🔧 구현 내용

### 1. Import 추가 (youtube-shorts-script-generator.tsx:33)

```typescript
import { pickFemaleOutfit, pickMaleOutfit } from './services/labPromptBuilder';
```

### 2. validateAndFixOutfitUniqueness 함수 완전 재작성 (670-730)

#### 기존 (잘못된 방식)
```typescript
// 색상만 변경 (가짜 의상 생성)
newOutfit = outfit.replace(/White/g, 'Cream');
```

#### 수정 (올바른 방식)
```typescript
const validateAndFixOutfitUniqueness = (
  characters: any[],
  genre: string,
  topic: string,
  allowedOutfitCategories?: string[]
): any[] => {
  // Step 1: 중복 탐지
  const outfitMap = new Map<string, string[]>();

  // Step 2: 중복 발견 시 의상리스트에서 다시 뽑기
  outfitMap.forEach((charIds, outfit) => {
    const usedOutfits = modifiedCharacters.map((c) => c.outfit).filter((o) => o && o !== outfit);

    for (let i = 1; i < charIds.length; i++) {
      const charId = charIds[i];
      const isMale = charId.toLowerCase().startsWith('man');

      if (isMale) {
        // 남성: 의상리스트에서 랜덤으로 다시 뽑기
        newOutfit = pickMaleOutfit(topic, [...usedOutfits, outfit], allowedOutfitCategories);
      } else {
        // 여성: 의상리스트에서 랜덤으로 다시 뽑기
        newOutfit = pickFemaleOutfit(genre, topic, [...usedOutfits, outfit], allowedOutfitCategories);
      }

      modifiedCharacters[charIndex].outfit = newOutfit;
      usedOutfits.push(newOutfit);
    }
  });
};
```

**핵심 변경점**:
- ❌ 색상 변경 로직 삭제
- ✅ `pickFemaleOutfit` / `pickMaleOutfit` 호출로 실제 의상리스트에서 재선택
- ✅ `excludeOutfits` 파라미터에 이미 사용된 의상들 전달
- ✅ 겨울 변환도 자동 적용 (pickFemaleOutfit 내부에서 처리)

### 3. postProcessScripts 파라미터 확장 (732-745)

```typescript
const postProcessScripts = (
  scripts: any[],
  outfits: {
    femaleOutfit?: string;
    femaleOutfit2?: string;
    maleOutfit?: string;
    autoEnhance?: boolean;
    enhancementSettings?: NormalizedPromptEnhancementSettings;
    targetAgeLabel?: string;
    identities?: CharacterIdentity[];
    genre?: string;           // 🆕 추가
    topic?: string;           // 🆕 추가
    allowedOutfitCategories?: string[]; // 🆕 추가
  }
) => {
  const validatedCharacters = validateAndFixOutfitUniqueness(
    script?.characters || [],
    outfits.genre || '',
    outfits.topic || '',
    outfits.allowedOutfitCategories
  );
};
```

### 4. 호출 지점 수정

#### generateScript 함수 (1978-1988)
```typescript
const processedScripts = postProcessScripts(rawScripts, {
  femaleOutfit: lockedFemaleOutfit,
  femaleOutfit2: lockedFemaleOutfit2,
  maleOutfit: lockedMaleOutfit,
  autoEnhance: activeEnhancementSettings.autoEnhanceOnGeneration ?? false,
  enhancementSettings: activeEnhancementSettings,
  targetAgeLabel: target,
  identities,
  genre,  // 🆕 전달
  topic   // 🆕 전달
});
```

#### handleManualImport 함수 (2662-2672)
```typescript
const processed = postProcessScripts(rawScripts, {
  femaleOutfit: lockedFemaleOutfit || undefined,
  femaleOutfit2: lockedFemaleOutfit2 || undefined,
  maleOutfit: lockedMaleOutfit || undefined,
  autoEnhance: activeEnhancementSettings.autoEnhanceOnGeneration ?? false,
  enhancementSettings: activeEnhancementSettings,
  targetAgeLabel: target,
  identities,
  genre,  // 🆕 전달
  topic   // 🆕 전달
});
```

### 5. ShortsLabPanel.tsx 정리 (3374-3378, 3647)

**잘못 추가했던 코드 제거**:
- `validateAndFixOutfitUniquenessMap` 함수 삭제
- `autoCharacterMap = validateAndFixOutfitUniquenessMap(autoCharacterMap)` 호출 제거

**이유**: 2단계 생성은 이미 `buildAutoCharacterMap` → `pickFemaleOutfit` / `pickMaleOutfit` → `excludeOutfits`로 중복 방지가 구현되어 있음

---

## 📊 작동 흐름

### AI 대본 생성 버튼

```
[AI 대본 생성 버튼 클릭]
    ↓
[buildLabScriptPrompt]
  ├─ pickFemaleOutfit(genre, topic, [], allowedCategories) → WomanA 의상
  ├─ pickFemaleOutfit(genre, topic, [WomanA], allowedCategories) → WomanB 의상
  ├─ pickFemaleOutfit(genre, topic, [WomanA, WomanB], allowedCategories) → WomanD 의상
  ├─ pickMaleOutfit(topic, [], allowedCategories) → ManA 의상
  └─ pickMaleOutfit(topic, [ManA], allowedCategories) → ManB 의상
    ↓
[AI 서비스 호출]
  → AI가 lockedOutfits를 그대로 사용해 characters 생성
    ↓
[postProcessScripts]
    ↓
[validateAndFixOutfitUniqueness]
  → 만약 AI가 중복 의상을 만들었다면:
    ├─ pickFemaleOutfit(genre, topic, [사용된의상들]) 재호출
    └─ pickMaleOutfit(topic, [사용된의상들]) 재호출
    ↓
[최종 대본 완성]
  → 모든 캐릭터가 의상리스트의 실제 의상 착용
  → 겨울 주제면 자동으로 긴팔 변환됨
```

### 2단계 생성 버튼

```
[2단계 생성 버튼 클릭]
    ↓
[buildAutoCharacterMap]
  → 이미 pickFemaleOutfit/pickMaleOutfit + excludeOutfits로 중복 방지
    ↓
[최종 대본 완성]
  → 후처리 불필요 (이미 완벽)
```

---

## 🎯 해결된 문제

### 이전 (잘못된 방식)
```json
{
  "characters": [
    { "id": "WomanA", "outfit": "White Off-shoulder dress" },
    { "id": "WomanB", "outfit": "Cream Off-shoulder dress" }  // ❌ 가짜 의상!
  ]
}
```
→ "Cream Off-shoulder dress"는 **의상리스트에 없는 가짜 의상**

### 현재 (올바른 방식)
```json
{
  "characters": [
    { "id": "WomanA", "outfit": "White Off-shoulder dress" },
    { "id": "WomanB", "outfit": "Pink Ruched Mini Dress" }  // ✅ 실제 의상!
  ]
}
```
→ "Pink Ruched Mini Dress"는 **UNIFIED_OUTFIT_LIST에 있는 실제 의상**

---

## 🔍 의상 선택 프로세스

### pickFemaleOutfit / pickMaleOutfit 내부 로직

1. **1차 필터링**: 장르/주제에 맞는 의상만
2. **excludeOutfits 적용**: 이미 사용된 의상 제외
3. **랜덤 선택**: `Math.floor(Math.random() * candidates.length)`
4. **겨울 변환**: `adjustOutfitForSeason()` - 겨울 주제면 긴팔로 자동 변환
5. **반환**: 실제 의상 명칭

### 중복 방지 메커니즘

- **1차 방지** (buildLabScriptPrompt): 의상 선택 시 excludeOutfits 사용
- **2차 방지** (validateAndFixOutfitUniqueness): AI가 무시했을 경우 후처리에서 재선택

---

## ✅ 검증 방법

1. **AI 대본 생성** 버튼 클릭
2. **콘솔 확인** - 중복 발견 시:
   ```
   ⚠️ [Outfit Duplicate Detected] 2 characters wearing: "White Off-shoulder dress"
      Characters: WomanA, WomanB
      ✅ Re-picked (Female): WomanB → "Pink Ruched Mini Dress"
   ```
3. **ai대본생성.txt 확인** - characters 배열:
   ```json
   [
     { "id": "WomanA", "outfit": "White Off-shoulder dress" },
     { "id": "WomanB", "outfit": "Pink Ruched Mini Dress" }
   ]
   ```
4. **UNIFIED_OUTFIT_LIST 확인** - "Pink Ruched Mini Dress"가 실제로 리스트에 존재하는지 확인

---

## 📝 코드 변경 요약

### youtube-shorts-script-generator.tsx
- Line 33: `import { pickFemaleOutfit, pickMaleOutfit }` 추가
- Line 670-730: `validateAndFixOutfitUniqueness` 완전 재작성 (색상 변경 → 의상리스트 재선택)
- Line 732-745: `postProcessScripts` 파라미터에 genre, topic, allowedOutfitCategories 추가
- Line 1978-1988: `generateScript`에서 genre, topic 전달
- Line 2662-2672: `handleManualImport`에서 genre, topic 전달

### components/ShortsLabPanel.tsx
- Line 3374-3378: `validateAndFixOutfitUniquenessMap` 함수 삭제 (주석으로 대체)
- Line 3647: `autoCharacterMap = validateAndFixOutfitUniquenessMap(...)` 호출 제거

---

## 🎉 완료 상태

- ✅ Phase 1: 문제 분석 및 올바른 접근법 정의
- ✅ Phase 2: `pickFemaleOutfit` / `pickMaleOutfit` import
- ✅ Phase 3: `validateAndFixOutfitUniqueness` 완전 재작성
- ✅ Phase 4: `postProcessScripts` 파라미터 확장
- ✅ Phase 5: 호출 지점 수정 (2곳)
- ✅ Phase 6: ShortsLabPanel.tsx 잘못된 코드 제거
- ✅ Phase 7: TypeScript 컴파일 검증
- ✅ Phase 8: 문서화

**제대로 된 구현 완료!** 🎊

---

## 🚨 주의사항

1. **의상리스트 관리**
   - 중복 방지는 `UNIFIED_OUTFIT_LIST`에 충분한 의상이 있을 때만 작동
   - 의상이 부족하면 `pickFemaleOutfit` / `pickMaleOutfit`이 폴백 로직 사용

2. **겨울 변환**
   - `pickFemaleOutfit` 내부에서 자동으로 `adjustOutfitForSeason()` 호출
   - 겨울 주제 감지 시 자동으로 긴팔로 변환

3. **장르별 의상**
   - 'affair-suspicion' 장르: SEXY 카테고리 의상만
   - 골프 주제: GOLF 카테고리 의상만
   - 나머지: SEXY 제외한 모든 의상

---

## 📚 관련 문서

- **잘못된 구현**: `plans/outfit_uniqueness_fix_완료보고.md` (삭제 권장)
- **TODO**: `TODO_이미지프롬프트_개선.md` (섹션 6 업데이트 예정)
- **의상 리스트**: `constants.ts` - `UNIFIED_OUTFIT_LIST`
- **의상 선택 로직**: `services/labPromptBuilder.ts` - `pickFemaleOutfit`, `pickMaleOutfit`

---

**작성자**: Claude Sonnet 4.5
**완료일**: 2026-02-03 (올바른 수정)

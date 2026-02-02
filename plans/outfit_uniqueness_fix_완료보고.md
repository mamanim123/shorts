# 캐릭터별 의상 고유성 문제 해결 완료 보고서

**작업 완료일**: 2026-02-03
**수정 파일**:
- `services/shortsLabStep2PromptRulesDefaults.ts`
- `youtube-shorts-script-generator.tsx`

---

## 📋 문제 개요

AI 대본 생성 시 **여러 캐릭터가 동일한 의상**을 입는 문제 발생:
- WomanA와 WomanB가 둘 다 "White Off-shoulder tight-fitting long-sleeve + Navy Mini Skirt" 착용
- 캐릭터 간 시각적 구별이 불가능

### 사용자 요구사항
> "각각의 캐릭터마다 의상이 달라야하는데 그게 안되는것같은데? 각각의 캐릭터마다 의상 중복이 없어야 하고 첫씬부터 끝까지 의상의 일관성을 유지한다"

---

## 🔧 구현 내용

### **전략: 이중 안전장치 (AI 규칙 + 후처리)**

1. **AI 프롬프트 규칙 강화** (사전 방지)
2. **후처리 검증 로직 추가** (사후 보정)

---

## Phase 1: AI 프롬프트 규칙 강화

### 📍 파일: `services/shortsLabStep2PromptRulesDefaults.ts`

#### 1.1 금지사항에 의상 중복 규칙 추가 (line 122)

```typescript
❌ **금지 사항**:
6. **여러 캐릭터에게 동일한 의상 할당**
   (예: WomanA와 WomanB가 같은 "White Off-shoulder dress" ❌, 각자 고유한 의상 ✅)
```

#### 1.2 검증 체크리스트에 고유성 검증 추가 (line 174-175)

```typescript
### 의상 일관성 및 고유성 검증
- [ ] **각 캐릭터가 서로 다른 고유한 의상을 입고 있는가?**
      (WomanA ≠ WomanB ≠ WomanD, ManA ≠ ManB ≠ ManC)
- [ ] lockedOutfits 객체에 **중복된 의상 값이 없는가?**
      (womanA와 womanB가 동일한 outfit 값 ❌)
```

**효과**: AI가 대본 생성 시 각 캐릭터에게 서로 다른 의상 할당

---

## Phase 2: 후처리 검증 로직 추가

### 📍 파일: `youtube-shorts-script-generator.tsx`

#### 2.1 `validateAndFixOutfitUniqueness` 함수 생성 (line 669-730)

```typescript
/**
 * [Outfit Uniqueness Validation] Ensures each character has a unique outfit
 * @param characters - Array of character objects with outfit field
 * @returns Modified characters array with unique outfits
 */
const validateAndFixOutfitUniqueness = (characters: any[]): any[] => {
  // Step 1: Detect duplicates
  const outfitMap = new Map<string, string[]>(); // outfit -> [characterIds]

  // Step 2: Fix duplicates by color variations
  const colorVariations = [
    { from: 'White', to: 'Cream' },
    { from: 'Navy', to: 'Black' },
    { from: 'Black', to: 'Charcoal' },
    // ... more variations
  ];

  // Apply color variations or add suffix
  // ...
}
```

**핵심 로직**:
1. **중복 탐지**: 동일한 outfit을 가진 캐릭터 찾기
2. **색상 변경**: "White" → "Cream", "Navy" → "Black" 등 자동 치환
3. **콘솔 경고**: 중복 발견 및 수정 내용 로깅

```
⚠️ [Outfit Duplicate Detected] 2 characters wearing: "White Off-shoulder dress"
   Characters: WomanA, WomanB
   ✅ Fixed: WomanB → "Cream Off-shoulder dress"
```

#### 2.2 `postProcessScripts`에 검증 함수 통합 (line 746-749, 792)

```typescript
const postProcessScripts = (...) => {
  return scripts.map((script, idx) => {
    // [Outfit Uniqueness Validation] Fix duplicate outfits before processing
    const validatedCharacters = validateAndFixOutfitUniqueness(script?.characters || []);
    const characterMap = buildCharacterMap(validatedCharacters);

    // ... scene processing ...

    return {
      ...script,
      characters: validatedCharacters, // Use validated characters
      scenes: processedScenes,
    };
  });
};
```

**효과**: AI가 중복 의상을 생성해도 후처리에서 자동 수정

---

## Phase 3: 2단계 생성 버튼 검증 로직 추가

### 📍 파일: `components/ShortsLabPanel.tsx`

#### 3.1 `validateAndFixOutfitUniquenessMap` 함수 생성 (line 3374-3440)

```typescript
/**
 * [Outfit Uniqueness Validation for Map] Ensures each character has a unique outfit
 * @param characterMap - Map of character ID to ManualCharacterPrompt
 * @returns Modified Map with unique outfits
 */
const validateAndFixOutfitUniquenessMap = (characterMap: Map<string, ManualCharacterPrompt>): Map<string, ManualCharacterPrompt> => {
  // Same logic as array version, but works with Map structure
  // ...
}
```

**핵심 차이점**:
- `youtube-shorts-script-generator.tsx`는 배열(Array) 사용
- `ShortsLabPanel.tsx`는 Map 구조 사용 (`Map<string, ManualCharacterPrompt>`)
- 동일한 검증 로직, 다른 자료구조에 적합하게 변형

#### 3.2 `handleTwoStepGenerate`에 검증 함수 통합 (line 3710)

```typescript
// [Outfit Uniqueness Validation] Fix duplicate outfits before scene processing
autoCharacterMap = validateAndFixOutfitUniquenessMap(autoCharacterMap);
```

**효과**: "2단계 생성" 버튼도 "AI 대본 생성" 버튼과 동일하게 의상 중복 방지

---

## 📊 작동 흐름

### AI 대본 생성 버튼
```
AI 대본 생성 버튼 클릭
     ↓
[1차 방지] AI 프롬프트 규칙
  → "각 캐릭터 서로 다른 의상" 규칙 준수
     ↓
AI 응답 (characters 배열)
     ↓
[2차 보정] postProcessScripts (youtube-shorts-script-generator.tsx)
     ↓
validateAndFixOutfitUniqueness (배열 버전)
  → 중복 탐지 → 색상 변경
     ↓
최종 대본 완성 (모든 캐릭터 고유 의상)
```

### 2단계 생성 버튼
```
2단계 생성 버튼 클릭
     ↓
buildAutoCharacterMap 호출
  → 캐릭터 메타데이터 생성 (Map 구조)
     ↓
[Outfit Validation] validateAndFixOutfitUniquenessMap (ShortsLabPanel.tsx:3710)
  → 중복 탐지 → 색상 변경
     ↓
씬 처리 및 프롬프트 조립
     ↓
최종 대본 완성 (모든 캐릭터 고유 의상)
```

---

## 📊 기존 작동 흐름

```
AI 대본 생성
     ↓
[1차 방지] AI 프롬프트 규칙
  → "각 캐릭터 서로 다른 의상" 규칙 준수
     ↓
AI 응답 (characters 배열)
     ↓
[2차 보정] postProcessScripts
     ↓
validateAndFixOutfitUniqueness
  → 중복 탐지
  → 색상 변경 (White → Cream, Navy → Black)
  → validatedCharacters 반환
     ↓
scenes 처리 (longPrompt 생성)
     ↓
최종 대본 완성 (모든 캐릭터 고유 의상)
```

---

## 🎯 해결된 사례

### **이전 (문제)**:
```json
{
  "characters": [
    {
      "id": "WomanA",
      "outfit": "White Off-shoulder tight-fitting long-sleeve + Navy Mini Skirt"
    },
    {
      "id": "WomanB",
      "outfit": "White Off-shoulder tight-fitting long-sleeve + Navy Mini Skirt"
    }
  ]
}
```
→ 두 캐릭터가 동일한 의상 착용 ❌

### **이후 (해결)**:
```json
{
  "characters": [
    {
      "id": "WomanA",
      "outfit": "White Off-shoulder tight-fitting long-sleeve + Navy Mini Skirt"
    },
    {
      "id": "WomanB",
      "outfit": "Cream Off-shoulder tight-fitting long-sleeve + Black Mini Skirt"
    }
  ]
}
```
→ 각 캐릭터가 고유한 의상 착용 ✅

---

## 🔍 색상 변경 규칙

| 원본 색상 | 변경 색상 |
|----------|----------|
| White    | Cream    |
| Navy     | Black    |
| Black    | Charcoal |
| Beige    | Tan      |
| Gray     | Silver   |
| Blue     | Teal     |
| Pink     | Rose     |
| Red      | Burgundy |

**색상 변경 불가 시**: `"Original Outfit (Variation 2)"` 형태로 suffix 추가

---

## ✅ 검증 방법

1. **AI 대본 생성** 버튼 클릭
2. **콘솔 확인** - 중복 발견 시 경고 메시지 출력:
   ```
   ⚠️ [Outfit Duplicate Detected] 2 characters wearing: "..."
      Characters: WomanA, WomanB
      ✅ Fixed: WomanB → "..."
   ```
3. **ai대본생성.txt 확인** - characters 배열에서 각 캐릭터의 outfit 확인
4. **검증 항목**:
   - [ ] WomanA ≠ WomanB ≠ WomanD 의상 확인
   - [ ] ManA ≠ ManB ≠ ManC 의상 확인
   - [ ] 모든 씬에서 동일 캐릭터는 동일 의상 유지 (일관성)

---

## 📝 코드 변경 요약

### **shortsLabStep2PromptRulesDefaults.ts**
- Line 122: 금지사항 6번 추가 (의상 중복 금지)
- Line 174-175: 검증 체크리스트에 고유성 검증 2개 항목 추가

### **youtube-shorts-script-generator.tsx** (AI 대본 생성 버튼)
- Line 669-730: `validateAndFixOutfitUniqueness` 함수 추가 (배열 버전)
- Line 747: `validatedCharacters` 생성 및 사용
- Line 792: `characters: validatedCharacters` 반환

### **components/ShortsLabPanel.tsx** (2단계 생성 버튼)
- Line 3374-3440: `validateAndFixOutfitUniquenessMap` 함수 추가 (Map 버전)
- Line 3710: `autoCharacterMap` 검증 적용

---

## 🎉 완료 상태

- ✅ Phase 1: 문제 분석 및 설계
- ✅ Phase 2: AI 프롬프트 규칙 강화
- ✅ Phase 3: 후처리 검증 로직 추가 (AI 대본 생성 버튼)
- ✅ Phase 4: 후처리 검증 로직 추가 (2단계 생성 버튼)
- ✅ Phase 5: TypeScript 컴파일 검증
- ✅ Phase 6: 문서화

**양쪽 버튼 모두 구현 완료!** 🎊

### 적용 범위
- ✅ **AI 대본 생성** 버튼 → `youtube-shorts-script-generator.tsx`
- ✅ **2단계 생성** 버튼 → `components/ShortsLabPanel.tsx`

---

## 🚨 주의사항

1. **콘솔 로깅**
   - 중복 발견 시 콘솔에 경고 출력
   - 프로덕션 환경에서는 로깅 레벨 조정 가능

2. **색상 변경 우선순위**
   - 색상 변경 규칙에 있는 색상 우선 치환
   - 없으면 suffix 추가 (Variation 2, Variation 3, ...)

3. **의상 일관성**
   - 동일 캐릭터는 모든 씬에서 동일 의상 유지
   - 이 규칙은 기존 시스템이 보장 (변경 없음)

---

## 📚 관련 문서

- **TODO**: `TODO_이미지프롬프트_개선.md` (섹션 5 업데이트 예정)
- **이전 작업**: `plans/body_후처리_기능_완료보고.md`

---

**작성자**: Claude Sonnet 4.5
**완료일**: 2026-02-03

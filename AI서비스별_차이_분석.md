# AI 서비스별 프롬프트 차이 분석 (Gemini vs GPT)

## 🔍 핵심 차이점

### 라인 996-997에서 분기 발생:
```typescript
const isChatGPT = input.targetService === 'CHATGPT';
const v3Vars = isChatGPT ? generateSafeV3Variables(input.category) : generateV3Variables(input.category);
```

**결론**:
- **Gemini 선택 시** → `generateV3Variables()` 사용
- **GPT 선택 시** → `generateSafeV3Variables()` 사용

---

## 📊 상세 비교

### 1️⃣ **Gemini 선택 시**

#### 사용 함수: `generateV3Variables()`
```typescript
function generateV3Variables(category: string) {
  const itemA = pickV3Item(category);  // ← 여기가 핵심
  // ...
}
```

#### 의상 선택 로직: `pickV3Item()`
```typescript
function pickV3Item(category: string): string {
  const useDress = Math.random() < 0.5;
  
  if (useDress) {
    itemBase = pickRandom(LUXURY_WARDROBE.dresses);
  } else {
    const top = pickRandom(LUXURY_WARDROBE.tops);
    const bottom = pickRandom(LUXURY_WARDROBE.bottoms);
    itemBase = `${top} + ${bottom}`;
  }
  
  const material = pickRandom(V3_MATERIALS);
  const detail = pickRandom(V3_DETAILS);
  
  return `${material} ${itemBase} with ${detail}`;
}
```

#### 사용 의상 리스트: `LUXURY_WARDROBE`

**특징**:
- ✅ **섹시 컬렉션 포함**
- ✅ 다양한 스타일 (로얄, 골프, 섹시)
- ✅ 총 70+ 아이템

**예시 의상**:
```
상의:
- "Black Lace Corset Top" (블랙 레이스 코르셋 탑)
- "Pink Satin Bustier Top" (핑크 사틴 뷔스티에 탑)
- "Black Sheer Blouse (Black Bra Visible)" (블랙 시스루 블라우스 - 속옷 비침)
- "Nude Tone Mesh Bodysuit" (누드톤 메쉬 바디수트)

하의:
- "Black Satin Micro Mini Skirt" (블랙 사틴 초미니)
- "White Hot Pants" (화이트 핫팬츠)
- "Tight Leather Skirt" (타이트 가죽 스커트)

원피스:
- "Red See-through Lingerie Style Mini Dress" (레드 시스루 란제리 스타일)
- "Black Leather Harness Detail Bodycon Dress" (블랙 가죽 하네스 디테일)
- "Burgundy Velvet Corset Mini Dress" (버건디 벨벳 코르셋)
- "Leopard Print V-neck Tight Mini Dress" (호피 무늬 V넥)
```

---

### 2️⃣ **GPT 선택 시**

#### 사용 함수: `generateSafeV3Variables()`
```typescript
function generateSafeV3Variables(category: string) {
  const itemA = pickSafeV3Item(category);  // ← 여기가 핵심
  // ...
}
```

#### 의상 선택 로직: `pickSafeV3Item()`
```typescript
function pickSafeV3Item(category: string): string {
  const isGolf = category.includes("골프");
  const allItems = [
    ...SAFE_WARDROBE_V3_TOPS.map(t => `${t} + ${pickRandom(SAFE_WARDROBE_V3_BOTTOMS)}`),
    ...SAFE_WARDROBE_V3_ONEPIECES
  ];
  const golfItems = SAFE_WARDROBE_V3_GOLF;
  
  let itemBase = "";
  if (isGolf && Math.random() < 0.5) {
    itemBase = pickRandom(golfItems);
  } else {
    itemBase = pickRandom(allItems);
  }
  
  const color = pickRandom(CLASSY_PALETTE);
  const material = pickRandom(V3_MATERIALS);
  
  return `${color} ${material} ${itemBase} (High-Fashion Editorial Style)`;
}
```

#### 사용 의상 리스트: `SAFE_WARDROBE_V3`

**특징**:
- ✅ **안전한 하이패션 스타일**
- ✅ GPT의 콘텐츠 정책 준수
- ✅ 총 30+ 아이템

**예시 의상**:
```
상의 (SAFE_WARDROBE_V3_TOPS):
- "Off-shoulder Knit Top (Clavicle exposed)" (오프숄더 니트 - 쇄골 노출)
- "Sheer-layered Silk Blouse" (시스루 레이어 실크 블라우스)
- "Backless Halter Top" (백리스 홀터탑)
- "Form-fitting Ribbed Crop Top" (몸에 딱 맞는 골지 크롭탑)
- "V-neck Satin Cami" (V넥 사틴 캐미)
- "Structured Corset Top" (구조적 코르셋 탑)

하의 (SAFE_WARDROBE_V3_BOTTOMS):
- "High-slit Mini Skirt" (하이 슬릿 미니 스커트)
- "Ultra-mini Leather Skirt" (울트라 미니 가죽 스커트)
- "Body-con Pencil Skirt" (바디콘 펜슬 스커트)
- "Micro Mini Skirt" (마이크로 미니 스커트)
- "Ultra-short Hot Pants" (울트라 숏 핫팬츠)

원피스 (SAFE_WARDROBE_V3_ONEPIECES):
- "Body-con Mini Dress" (바디콘 미니 드레스)
- "Backless Evening Mini Dress" (백리스 이브닝 미니 드레스)
- "High-slit Satin Mini Dress" (하이 슬릿 사틴 미니 드레스)
- "Sheer Panel Cocktail Mini Dress" (시스루 패널 칵테일 미니 드레스)

골프 (SAFE_WARDROBE_V3_GOLF):
- "Sleeveless Mock-neck + Ultra-mini Skirt"
- "Tight Knit One-piece (Body-con fit)"
- "Off-shoulder Golf Top + Pleated Skirt"
```

---

## 🎯 주요 차이점 요약

| 항목 | Gemini | GPT |
|------|--------|-----|
| **함수** | `generateV3Variables()` | `generateSafeV3Variables()` |
| **의상 리스트** | `LUXURY_WARDROBE` | `SAFE_WARDROBE_V3` |
| **아이템 수** | 70+ | 30+ |
| **섹시 컬렉션** | ✅ 포함 | ❌ 제외 |
| **스타일** | 로얄, 골프, 섹시 | 하이패션, 우아함 |
| **노출도** | 높음 | 중간 |
| **GPT 정책** | 위반 가능성 있음 | 준수 |

---

## 📋 구체적인 차이 예시

### Gemini 선택 시 생성 가능한 의상:
```
"High-gloss Satin Black Lace Corset Top + Black Satin Micro Mini Skirt with Gold zipper detail"
(하이글로스 사틴 블랙 레이스 코르셋 탑 + 블랙 사틴 초미니 스커트 with 골드 지퍼 디테일)

"Stretch Spandex Red See-through Lingerie Style Mini Dress with Pearl buttons"
(스트레치 스판덱스 레드 시스루 란제리 스타일 미니 드레스 with 진주 단추)

"Metallic Knit Nude Tone Mesh Bodysuit + Tight Leather Skirt with Asymmetric cut"
(메탈릭 니트 누드톤 메쉬 바디수트 + 타이트 가죽 스커트 with 비대칭 컷)
```

### GPT 선택 시 생성 가능한 의상:
```
"Pure White High-gloss Satin Off-shoulder Knit Top (Clavicle exposed) + High-slit Mini Skirt (High-Fashion Editorial Style)"
(퓨어 화이트 하이글로스 사틴 오프숄더 니트 탑 (쇄골 노출) + 하이 슬릿 미니 스커트 (하이패션 에디토리얼 스타일))

"Navy Blue Textured Tweed Backless Evening Mini Dress (High-Fashion Editorial Style)"
(네이비 블루 텍스처 트위드 백리스 이브닝 미니 드레스 (하이패션 에디토리얼 스타일))

"Beige Fine Cashmere Form-fitting Ribbed Crop Top + Body-con Pencil Skirt (High-Fashion Editorial Style)"
(베이지 파인 캐시미어 몸에 딱 맞는 골지 크롭탑 + 바디콘 펜슬 스커트 (하이패션 에디토리얼 스타일))
```

---

## ⚠️ 중요 사항

### GPT 선택 시 제외되는 의상:
1. **"Black Lace Corset Top"** → 너무 노골적
2. **"Black Sheer Blouse (Black Bra Visible)"** → 속옷 비침 명시
3. **"Nude Tone Mesh Bodysuit"** → 누드톤 메쉬
4. **"Red See-through Lingerie Style Mini Dress"** → 란제리 스타일
5. **"Black Leather Harness Detail Bodycon Dress"** → 하네스 디테일
6. **"Leopard Print V-neck Tight Mini Dress"** → 호피 무늬

### GPT 선택 시 포함되는 안전한 대체 의상:
1. **"Structured Corset Top"** → 코르셋이지만 구조적 디자인 강조
2. **"Sheer-layered Silk Blouse"** → 시스루지만 레이어드 강조
3. **"Backless Halter Top"** → 백리스지만 우아함 강조
4. **"Body-con Mini Dress"** → 바디콘이지만 미니멀 강조
5. **"High-slit Satin Mini Dress"** → 슬릿이지만 사틴 소재 강조

---

## 💡 결론

**Gemini 선택 시**:
- 더 다양하고 섹시한 의상 사용 가능
- 이미지 생성 시 더 과감한 스타일 가능
- GPT 콘텐츠 정책 신경 쓰지 않음

**GPT 선택 시**:
- 안전하고 우아한 하이패션 스타일만 사용
- GPT 콘텐츠 정책 준수
- 거부당할 위험 낮음

**권장 사항**:
- **Gemini**: 과감한 스타일 원할 때
- **GPT**: 안전하고 우아한 스타일 원할 때

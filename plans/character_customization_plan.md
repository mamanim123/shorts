# 인물 커스터마이징 기능 구현 계획

## 목표
이미지 생성 전에 인물의 **연령**, **의상**, **외형 특징**을 선택/수정할 수 있는 기능 추가

## 참조 문서
- 김씨네프롬프트.txt의 "identity lock" 시스템
- 현재 CineboardPanel.tsx의 인물 카드 기능

---

## 구현할 기능

### 1. 연령 선택
- 드롭다운 또는 슬라이더로 연령대 선택
- 옵션: 20대, 30대, 40대, 50대, 60대+
- 프롬프트에 "in their 40s", "middle-aged" 등으로 반영

### 2. 의상 선택
- 프리셋 의상 목록
- 카테고리: 정장, 캐주얼, 한복, 전문복 등
- 커스텀 의상 설명 입력 가능

### 3. 외형 특징 수정 (Identity Lock)
- 현재: characterNotes 상태로 텍스트 메모만 가능
- 개선: 구조화된 입력 폼 (헤어스타일, 악세서리, 특징 등)

---

## 구현 단계

### 1단계: 타입 정의 확장
**파일**: `components/CineboardPanel.tsx`

```typescript
type CharacterCustomization = {
  age: '20s' | '30s' | '40s' | '50s' | '60s+';
  costume: string;
  hairStyle: string;
  accessories: string[];
  distinctiveFeatures: string; // 점, 흉터, 안경 등
};

// 기존 Character 타입 확장
type Character = {
  id: string;
  name: string;
  description: string;
  customization?: CharacterCustomization;
};
```

### 2단계: 의상 프리셋 정의
**파일**: `components/CineboardPanel.tsx`

```typescript
const COSTUME_PRESETS = [
  { id: 'formal', label: '정장', prompt: 'wearing a formal business suit' },
  { id: 'casual', label: '캐주얼', prompt: 'wearing casual clothes' },
  { id: 'hanbok', label: '한복', prompt: 'wearing traditional Korean hanbok' },
  { id: 'uniform', label: '유니폼', prompt: 'wearing a work uniform' },
  { id: 'luxury', label: '명품', prompt: 'wearing luxury designer clothes' },
  { id: 'custom', label: '직접 입력', prompt: '' }
];

const AGE_PRESETS = [
  { id: '20s', label: '20대', prompt: 'in their early twenties, youthful' },
  { id: '30s', label: '30대', prompt: 'in their thirties, mature' },
  { id: '40s', label: '40대', prompt: 'in their forties, middle-aged' },
  { id: '50s', label: '50대', prompt: 'in their fifties, distinguished' },
  { id: '60s+', label: '60대+', prompt: 'elderly, in their sixties or older' }
];
```

### 3단계: 상태 변수 추가
**위치**: 기존 상태 변수 아래

```typescript
const [characterCustomizations, setCharacterCustomizations] = useState<
  Record<string, CharacterCustomization>
>({});
```

### 4단계: 커스터마이징 UI 추가
**위치**: 인물 카드 섹션 내부

```typescript
{/* Character Customization Panel */}
<div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
  <h4 className="text-sm font-semibold text-purple-300 mb-2">인물 설정</h4>
  
  {/* Age Selection */}
  <div className="mb-2">
    <label className="text-xs text-slate-400">연령대</label>
    <select className="w-full mt-1 p-2 rounded bg-slate-900 border border-slate-700 text-white text-sm">
      {AGE_PRESETS.map(age => (
        <option key={age.id} value={age.id}>{age.label}</option>
      ))}
    </select>
  </div>
  
  {/* Costume Selection */}
  <div className="mb-2">
    <label className="text-xs text-slate-400">의상</label>
    <select className="w-full mt-1 p-2 rounded bg-slate-900 border border-slate-700 text-white text-sm">
      {COSTUME_PRESETS.map(costume => (
        <option key={costume.id} value={costume.id}>{costume.label}</option>
      ))}
    </select>
  </div>
  
  {/* Custom Costume Input (if "직접 입력" selected) */}
  <input placeholder="의상 설명 입력..." className="..." />
  
  {/* Distinctive Features */}
  <div className="mb-2">
    <label className="text-xs text-slate-400">특징 (점, 흉터, 안경 등)</label>
    <input placeholder="예: 오른쪽 눈 밑에 점, 금테 안경" className="..." />
  </div>
</div>
```

### 5단계: 프롬프트에 커스터마이징 반영
**위치**: handleGenerateCineboard 또는 이미지 생성 함수

```typescript
const buildCharacterPrompt = (character: Character) => {
  const custom = characterCustomizations[character.id];
  if (!custom) return character.description;
  
  const agePrompt = AGE_PRESETS.find(a => a.id === custom.age)?.prompt || '';
  const costumePrompt = custom.costume === 'custom' 
    ? custom.customCostume 
    : COSTUME_PRESETS.find(c => c.id === custom.costume)?.prompt || '';
  const features = custom.distinctiveFeatures || '';
  
  return `${character.description}, ${agePrompt}, ${costumePrompt}, ${features}`.trim();
};
```

---

## UI 디자인

### 인물 카드 확장
```
┌─────────────────────────────────────┐
│ 👤 김여사                           │
├─────────────────────────────────────┤
│ 대본 설명: 중년 여성, 골프장 사장    │
├─────────────────────────────────────┤
│ 인물 설정                           │
│ ┌─────────────────────────────────┐ │
│ │ 연령대:  [40대        ▼]       │ │
│ │ 의상:    [정장        ▼]       │ │
│ │ 특징:    [금테 안경, 진주 목걸이]│ │
│ └─────────────────────────────────┘ │
│                                     │
│ [이미지 업로드] [특징 고정]          │
└─────────────────────────────────────┘
```

---

## 테스트 체크리스트
- [ ] 연령대 선택 시 프롬프트에 반영되는지 확인
- [ ] 의상 선택 시 프롬프트에 반영되는지 확인
- [ ] 커스텀 의상 입력 시 정상 동작 확인
- [ ] 특징 입력 시 Identity Lock으로 작동 확인
- [ ] 저장된 설정이 이미지 생성에 반영되는지 확인

---

## 우선순위
1. **높음**: 연령 선택 (간단, 효과 큼)
2. **높음**: 의상 프리셋 선택
3. **중간**: 커스텀 의상 입력
4. **중간**: 특징 입력 (Identity Lock)
5. **낮음**: 이미지 업로드 캐스팅 기능

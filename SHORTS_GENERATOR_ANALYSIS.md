# 🔍 쇼츠 생성기 대본 생성 로직 분석 보고서

**분석일**: 2025-12-29  
**파일**: `youtube-shorts-script-generator.tsx` (3,051줄)  
**목적**: 복잡한 대본 생성 로직 정리 및 중복 기능 제거

---

## 📊 현재 상태 분석

### 1. **생성 모드** (Generation Mode)
**위치**: Line 457  
**상태 변수**: `generationMode`  
**옵션**:
- `'script-only'` - 대본만 생성
- `'script-image'` - 대본 + 이미지 프롬프트 생성

**사용처**:
- 프롬프트 템플릿 선택 (`modeTemplates.scriptOnly` vs `modeTemplates.scriptImage`)
- 이미지 프롬프트 포함 여부 결정

**평가**: ✅ **필수 기능** - 명확하게 구분됨

---

### 2. **스토리 엔진** (Story Engine)
**위치**: Line 542-544  
**상태 변수**: `engineVersion`  
**옵션**:
- `'V3'` - 기본 엔진
- `'V3_COSTAR'` - CO-STAR 프레임워크
- `'NONE'` - 엔진 없음
- `'CUSTOM_*'` - 사용자 정의 엔진 (예: `CUSTOM_1765973385899`)

**사용처**:
- `enginePrompts[engineVersion]` - 엔진별 프롬프트 가져오기
- `ENGINES_FORCE_IMAGE_PROMPTS` - 특정 엔진은 강제로 이미지 프롬프트 생성

**평가**: ✅ **필수 기능** - 다양한 프롬프트 스타일 지원

---

### 3. **프롬프트 프리셋** (Prompt Preset)
**위치**: Line 548-553  
**상태 변수**: `selectedPromptPresetId`  
**데이터**: `promptPresets` (서버에서 로드)

**사용처**:
- 프리셋 선택 시 해당 프롬프트 내용을 엔진 프롬프트에 추가

**평가**: ⚠️ **중복 가능성 있음** - 엔진과 역할이 겹침

---

### 4. **모드 템플릿** (Mode Templates)
**위치**: Line 554-571  
**상태 변수**: `modeTemplates`  
**데이터**:
```typescript
{
  scriptOnly: "대본만 생성 템플릿...",
  scriptImage: "대본+이미지 생성 템플릿..."
}
```

**사용처**:
- `generationMode`에 따라 사용할 템플릿 선택
- 템플릿 내 변수 치환 (`{{GENRE}}`, `{{TOPIC}}` 등)

**평가**: ⚠️ **중복 가능성 있음** - 엔진 프롬프트와 역할이 겹침

---

### 5. **모드 비활성화** (Mode Disabled)
**위치**: Line 668-689  
**상태 변수**: `isModeDisabled`  
**기능**: 모드 템플릿을 비활성화하고 엔진 프롬프트만 사용

**평가**: ⚠️ **혼란 유발** - 사용자가 이해하기 어려움

---

## 🔴 문제점 분석

### 문제 1: **3중 프롬프트 시스템** ❌
현재 프롬프트가 3단계로 나뉘어 있어 매우 혼란스럽습니다:

```
1. 모드 템플릿 (scriptOnly / scriptImage)
   ↓
2. 엔진 프롬프트 (V3, V3_COSTAR, CUSTOM_*)
   ↓
3. 프롬프트 프리셋 (선택적)
```

**문제**:
- 어떤 것이 실제로 사용되는지 불명확
- 각각의 역할이 겹침
- 수정 시 어디를 고쳐야 할지 모름

### 문제 2: **모드 비활성화 옵션** ❌
`isModeDisabled` 옵션이 혼란을 가중시킵니다:
- 활성화 시: 모드 템플릿 + 엔진 프롬프트
- 비활성화 시: 엔진 프롬프트만

**문제**:
- 사용자가 이 옵션의 의미를 이해하기 어려움
- 결과 예측 불가능

### 문제 3: **프롬프트 프리셋의 모호한 역할** ❌
프롬프트 프리셋이 엔진과 별도로 존재하지만:
- 엔진과 역할이 겹침
- 언제 사용해야 하는지 불명확
- 엔진 + 프리셋 조합 시 충돌 가능성

---

## ✅ 권장 개선 방안

### 방안 A: **단순화 - 엔진 중심** ⭐ **추천**

**변경 사항**:
1. ❌ **제거**: 모드 템플릿 (`modeTemplates`)
2. ❌ **제거**: 모드 비활성화 (`isModeDisabled`)
3. ❌ **제거**: 프롬프트 프리셋 (또는 엔진에 통합)
4. ✅ **유지**: 생성 모드 (`generationMode`)
5. ✅ **강화**: 스토리 엔진 (`engineVersion`)

**새로운 구조**:
```
생성 모드 선택 (대본만 / 대본+이미지)
   ↓
스토리 엔진 선택 (V3, V3_COSTAR, CUSTOM_*)
   ↓
엔진 프롬프트 자동 적용
   ↓
생성
```

**장점**:
- ✅ 간단하고 명확
- ✅ 사용자 혼란 감소
- ✅ 유지보수 용이
- ✅ 엔진 하나만 관리하면 됨

**단점**:
- ⚠️ 기존 모드 템플릿 사용자 영향

---

### 방안 B: **통합 - 프리셋 중심**

**변경 사항**:
1. ❌ **제거**: 모드 템플릿
2. ❌ **제거**: 모드 비활성화
3. ✅ **통합**: 엔진 → 프리셋으로 통합
4. ✅ **유지**: 생성 모드
5. ✅ **강화**: 프롬프트 프리셋

**새로운 구조**:
```
생성 모드 선택 (대본만 / 대본+이미지)
   ↓
프리셋 선택 (기본, CO-STAR, 커스텀1, 커스텀2...)
   ↓
프리셋 프롬프트 적용
   ↓
생성
```

**장점**:
- ✅ 프리셋 관리가 더 직관적
- ✅ 사용자가 쉽게 추가/수정 가능

**단점**:
- ⚠️ 기존 엔진 시스템 재작업 필요

---

### 방안 C: **현상 유지 + 정리**

**변경 사항**:
1. ✅ **유지**: 모든 기능 유지
2. ✅ **개선**: UI/UX 개선으로 명확성 향상
3. ✅ **문서화**: 각 기능의 역할 명확히 설명

**새로운 구조**:
```
[1단계] 생성 모드 (대본만 / 대본+이미지)
[2단계] 스토리 엔진 (V3, COSTAR, 커스텀)
[3단계] 추가 프리셋 (선택사항)
[고급] 모드 템플릿 직접 편집
```

**장점**:
- ✅ 기존 기능 모두 유지
- ✅ 기존 사용자 영향 없음

**단점**:
- ❌ 여전히 복잡함
- ❌ 근본적 해결 아님

---

## 📋 상세 분석

### 현재 프롬프트 생성 흐름

```typescript
// Line 972-1100 (generateScript 함수)
const generateScript = async () => {
  // 1. 모드 템플릿 선택
  const baseTemplate = isModeDisabled 
    ? '' 
    : (generationMode === 'script-only' 
        ? modeTemplates.scriptOnly 
        : modeTemplates.scriptImage);
  
  // 2. 변수 치환
  const filledTemplate = fillTemplate(baseTemplate, {
    GENRE: genre,
    TOPIC: topic,
    TARGET_LABEL: target,
    // ... 더 많은 변수
  });
  
  // 3. 엔진 프롬프트 추가
  const enginePrompt = enginePrompts[engineVersion] || '';
  
  // 4. 프리셋 프롬프트 추가 (선택적)
  const presetPrompt = selectedPromptPresetId 
    ? getPresetContent(selectedPromptPresetId) 
    : '';
  
  // 5. 최종 프롬프트 조합
  const finalPrompt = [
    filledTemplate,
    enginePrompt,
    presetPrompt
  ].filter(Boolean).join('\n\n');
  
  // 6. AI 호출
  await callAI(finalPrompt);
};
```

**문제점**:
- 5단계나 거쳐야 최종 프롬프트 생성
- 각 단계에서 충돌 가능성
- 디버깅 어려움

---

## 🎯 즉시 적용 가능한 개선

### 개선 1: 프롬프트 미리보기 기능
```typescript
const [showPromptPreview, setShowPromptPreview] = useState(false);

const getFullPrompt = () => {
  // 현재 설정으로 생성될 프롬프트 미리보기
  const baseTemplate = isModeDisabled ? '' : modeTemplates[generationMode];
  const filled = fillTemplate(baseTemplate, variables);
  const engine = enginePrompts[engineVersion];
  return [filled, engine].filter(Boolean).join('\n\n');
};
```

### 개선 2: 설정 프로필 저장
```typescript
// 자주 사용하는 설정 조합을 프로필로 저장
interface GenerationProfile {
  name: string;
  generationMode: 'script-only' | 'script-image';
  engineVersion: string;
  presetId?: string;
  // ... 기타 설정
}
```

### 개선 3: 간단 모드 / 고급 모드
```typescript
const [advancedMode, setAdvancedMode] = useState(false);

// 간단 모드: 엔진만 선택
// 고급 모드: 모든 옵션 표시
```

---

## 💡 최종 권장사항

### 단기 (즉시 적용)
1. ✅ **프롬프트 미리보기** 기능 추가
2. ✅ **툴팁/도움말** 추가로 각 옵션 설명
3. ✅ **기본값 개선** - 가장 자주 사용하는 설정을 기본값으로

### 중기 (1-2주)
1. ✅ **방안 A 적용** - 엔진 중심으로 단순화
2. ✅ **마이그레이션 도구** - 기존 설정 자동 변환
3. ✅ **문서화** - 사용 가이드 작성

### 장기 (1개월)
1. ✅ **AI 기반 프롬프트 최적화** - 사용자 의도 파악
2. ✅ **템플릿 마켓플레이스** - 커뮤니티 공유
3. ✅ **A/B 테스트** - 어떤 프롬프트가 더 좋은 결과를 내는지

---

## 📊 기능 사용 현황 (추정)

| 기능 | 사용 빈도 | 중요도 | 제거 가능성 |
|------|----------|--------|------------|
| 생성 모드 | ⭐⭐⭐⭐⭐ | 필수 | ❌ |
| 스토리 엔진 | ⭐⭐⭐⭐ | 높음 | ❌ |
| 프롬프트 프리셋 | ⭐⭐ | 중간 | ⚠️ 엔진에 통합 가능 |
| 모드 템플릿 | ⭐ | 낮음 | ✅ 제거 권장 |
| 모드 비활성화 | ⭐ | 낮음 | ✅ 제거 권장 |

---

## 🔧 구현 예시

### 단순화된 UI (방안 A)
```typescript
// 1단계: 생성 모드
<select value={generationMode} onChange={...}>
  <option value="script-only">대본만</option>
  <option value="script-image">대본 + 이미지</option>
</select>

// 2단계: 스토리 엔진
<select value={engineVersion} onChange={...}>
  <option value="V3">기본 엔진</option>
  <option value="V3_COSTAR">CO-STAR 엔진</option>
  <option value="CUSTOM_1">커스텀 1</option>
</select>

// 3단계: 생성
<button onClick={generateScript}>
  대본 생성하기
</button>

// 고급 옵션 (접기/펼치기)
{advancedMode && (
  <div>
    <textarea value={enginePrompts[engineVersion]} onChange={...} />
    <button>프롬프트 직접 수정</button>
  </div>
)}
```

---

## 📞 다음 단계

**어떤 방안을 선택하시겠습니까?**

1. **방안 A** - 엔진 중심 단순화 (추천) ⭐
2. **방안 B** - 프리셋 중심 통합
3. **방안 C** - 현상 유지 + UI 개선
4. **커스텀** - 다른 아이디어가 있으신가요?

선택하시면 즉시 구현을 시작하겠습니다!

---

**작성일**: 2025-12-29  
**다음 단계**: 사용자 선택 대기

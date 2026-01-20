# 🔍 대본 생성 로직 분석 보고서

**분석일**: 2025-12-29  
**문제**: 대본 구조가 이상하게 생성됨 (문단 구조 → 한 줄씩 끊어지는 구조)

---

## 📊 현재 로직 흐름

### 1. **프롬프트 조합 순서**
```
1. 엔진 시스템 프롬프트 (engineSystemPrompt)
   ↓
2. 프리셋 변수 블록 (presetVariableBlock)
   ↓
3. 모드 템플릿 (scriptOnlyPrompt / scriptImagePrompt)
```

### 2. **실제 코드 (Line 1323-1329)**
```typescript
const templatePromptBody = useImagePromptMode ? scriptImagePrompt : scriptOnlyPrompt;
const promptBody = usePromptPreset
  ? presetVariableBlock
  : [presetVariableBlock, templatePromptBody].filter(Boolean).join('\n\n');
const prompt = usePromptPreset
  ? promptBody
  : [engineSystemPrompt, promptBody].filter(Boolean).join('\n\n');
```

---

## 🔴 발견된 문제점

### 문제 1: **프리셋 사용 시 모드 템플릿 무시**
```typescript
const promptBody = usePromptPreset
  ? presetVariableBlock  // ❌ 프리셋만 사용 (모드 템플릿 제외!)
  : [presetVariableBlock, templatePromptBody].filter(Boolean).join('\n\n');
```

**결과**:
- 프리셋을 사용하면 → 모드 템플릿이 완전히 무시됨
- 모드 템플릿에 있는 **구조 지침**이 AI에게 전달되지 않음

### 문제 2: **모드 비활성화 옵션**
```typescript
// Line 1316-1321
if (isModeDisabled && !engineSystemPrompt && !usePromptPreset) {
  showToast('모드 비활성화 상태에서는 엔진을 선택해야 합니다.', 'error');
  return;
}
```

**결과**:
- `isModeDisabled = true`일 때 → 모드 템플릿 사용 안 함
- 엔진 프롬프트만 사용 → 구조 지침 부족

### 문제 3: **모드 템플릿의 역할 혼란**
현재 시스템:
```
엔진 프롬프트 (스타일/톤)
  +
모드 템플릿 (구조/형식)
  +
프리셋 (추가 지침)
```

**문제**:
- 3개가 겹치면서 충돌
- 어떤 것이 우선인지 불명확
- 프리셋 사용 시 모드 템플릿이 사라짐

---

## 🎯 예상 원인

### 시나리오 1: 프리셋 사용 중
```
사용자가 프리셋 선택
  ↓
promptBody = presetVariableBlock만 사용
  ↓
모드 템플릿의 구조 지침 누락
  ↓
AI가 자유 형식으로 생성
  ↓
문단 구조가 아닌 한 줄씩 끊어지는 형태
```

### 시나리오 2: 모드 비활성화
```
"모드 비활성화" 버튼 클릭
  ↓
isModeDisabled = true
  ↓
모드 템플릿 사용 안 함
  ↓
엔진 프롬프트만 사용
  ↓
구조 지침 부족
```

---

## 💡 해결 방안

### 방안 A: 모드 템플릿 항상 포함 (추천) ⭐
```typescript
// 프리셋 여부와 관계없이 모드 템플릿 항상 포함
const promptBody = [
  presetVariableBlock,
  templatePromptBody  // 항상 포함!
].filter(Boolean).join('\n\n');

const prompt = [
  engineSystemPrompt,
  promptBody
].filter(Boolean).join('\n\n');
```

**장점**:
- ✅ 구조 지침 항상 유지
- ✅ 일관된 출력 형식
- ✅ 프리셋과 모드 템플릿 병행 사용 가능

### 방안 B: 모드 비활성화 옵션 제거
```typescript
// isModeDisabled 로직 완전 제거
// 항상 모드 템플릿 사용
```

**장점**:
- ✅ 사용자 혼란 감소
- ✅ 코드 단순화
- ✅ 예측 가능한 결과

### 방안 C: 프리셋에 모드 정보 포함
```typescript
// 프리셋에 "대본 구조" 지침 추가
// 서버의 prompt_presets.json 수정
```

**단점**:
- ❌ 모든 프리셋 수정 필요
- ❌ 유지보수 어려움

---

## 🔧 즉시 적용 가능한 수정

### 수정 1: 모드 템플릿 항상 포함
```typescript
// Line 1324-1326 수정
const promptBody = [
  presetVariableBlock,
  templatePromptBody
].filter(Boolean).join('\n\n');
```

### 수정 2: 모드 비활성화 로직 제거
```typescript
// Line 1316-1321 삭제 또는 주석 처리
```

---

## 📝 권장 조치

1. **즉시**: 모드 템플릿을 항상 포함하도록 수정
2. **단기**: 모드 비활성화 옵션 제거 (UI에서 이미 제거됨)
3. **장기**: 프롬프트 시스템 단순화 (엔진 중심)

---

## 🎬 다음 단계

**어떻게 진행하시겠습니까?**

1. **방안 A 적용** - 모드 템플릿 항상 포함 (즉시 수정)
2. **전체 점검** - 프롬프트 미리보기로 확인 후 수정
3. **프리셋 확인** - 어떤 프리셋을 사용 중인지 먼저 확인

선택하시면 즉시 수정하겠습니다!

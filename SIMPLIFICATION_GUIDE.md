# 🎯 쇼츠 생성기 단순화 - 실행 가이드

**목표**: 복잡한 3중 프롬프트 시스템을 엔진 중심으로 단순화

---

## ⚠️ 중요 공지

이 작업은 **3,051줄의 대규모 리팩토링**이 필요합니다.  
한 번에 모든 것을 바꾸면 위험하므로, **단계별 접근**을 권장합니다.

---

## 🎯 최종 목표

### Before (현재 - 복잡)
```
사용자 입력
  ↓
1. 생성 모드 선택 (대본만 / 대본+이미지)
  ↓
2. 모드 템플릿 선택 (scriptOnly / scriptImage)
  ↓
3. 스토리 엔진 선택 (V3, COSTAR, CUSTOM)
  ↓
4. 프롬프트 프리셋 선택 (선택적)
  ↓
5. 모드 비활성화 옵션 (혼란)
  ↓
프롬프트 조합 (5단계 거침)
  ↓
AI 호출
```

### After (목표 - 단순)
```
사용자 입력
  ↓
1. 생성 모드 선택 (대본만 / 대본+이미지)
  ↓
2. 스토리 엔진 선택 (V3, COSTAR, CUSTOM)
  ↓
엔진 프롬프트 자동 적용
  ↓
AI 호출
```

---

## 📋 단계별 실행 계획

### ✅ Phase 0: 준비 (완료)
- [x] 현재 로직 분석
- [x] 개선 방안 수립
- [x] Git 커밋

### 🔄 Phase 1: 엔진 프롬프트 강화 (우선)

#### 1.1 엔진 프롬프트에 모드 지원 추가

**파일**: `engine_config.json`

**변경 전**:
```json
{
  "prompts": {
    "V3": "기존 프롬프트..."
  }
}
```

**변경 후**:
```json
{
  "prompts": {
    "V3": "당신은 쇼츠 대본 작가입니다.\n\n{{MODE_INSTRUCTION}}\n\n기존 프롬프트..."
  }
}
```

#### 1.2 프롬프트 생성 로직 수정

**파일**: `youtube-shorts-script-generator.tsx`  
**함수**: `generateScript` (Line ~972)

**변경 전**:
```typescript
const generateScript = async () => {
  // 복잡한 5단계 프롬프트 조합
  const baseTemplate = isModeDisabled ? '' : modeTemplates[generationMode];
  const filled = fillTemplate(baseTemplate, variables);
  const enginePrompt = enginePrompts[engineVersion];
  const presetPrompt = getPreset(selectedPromptPresetId);
  const final = [filled, enginePrompt, presetPrompt].join('\n\n');
};
```

**변경 후**:
```typescript
const generateScript = async () => {
  // 간단한 2단계 프롬프트 생성
  let enginePrompt = enginePrompts[engineVersion] || '';
  
  // 생성 모드에 따른 지시사항 추가
  const modeInstruction = generationMode === 'script-image'
    ? `출력 형식: 대본 + 이미지 프롬프트 (scenes 배열 포함)`
    : `출력 형식: 대본만 (scenes 배열 제외)`;
  
  // 변수 치환
  const finalPrompt = fillTemplate(enginePrompt, {
    MODE_INSTRUCTION: modeInstruction,
    GENRE: genre,
    TOPIC: topic,
    TARGET_LABEL: target,
    SCRIPT_COUNT: scriptCount,
    // ... 기타 변수
  });
  
  // AI 호출
  await callAI(finalPrompt);
};
```

---

### 🔄 Phase 2: 불필요한 코드 제거

#### 2.1 제거할 상태 변수

**파일**: `youtube-shorts-script-generator.tsx`

```typescript
// ❌ 제거
const [modeTemplates, setModeTemplates] = useState<ModeTemplates>(...);
const [isModeDisabled, setIsModeDisabled] = useState(false);
const [promptPresets, setPromptPresets] = useState<PromptPresetSummary[]>([]);
const [selectedPromptPresetId, setSelectedPromptPresetId] = useState<string>('');
const [isPresetManagerOpen, setPresetManagerOpen] = useState(false);
const [isModeTemplateModalOpen, setIsModeTemplateModalOpen] = useState(false);
```

#### 2.2 제거할 함수

```typescript
// ❌ 제거
const persistModeTemplates = ...;
const handleSaveModeTemplateSettings = ...;
const handleResetModeTemplateSettings = ...;
const toggleModeDisabled = ...;
const refreshPromptPresets = ...;
```

#### 2.3 제거할 상수

```typescript
// ❌ 제거
const MODE_TEMPLATE_STORAGE_KEY = 'shorts-generator-mode-templates-v1';
const MODE_DISABLED_STORAGE_KEY = 'shorts-generator-mode-disabled';
const DEFAULT_MODE_TEMPLATES: ModeTemplates = { ... };
```

#### 2.4 제거할 컴포넌트 import

```typescript
// ❌ 제거
import ModeTemplateSettingsModal from './components/ModeTemplateSettingsModal';
import PromptPresetManagerModal from './components/PromptPresetManagerModal';
```

---

### 🔄 Phase 3: UI 단순화

#### 3.1 간단한 2단계 UI

**변경 전** (복잡한 UI):
```tsx
<div>
  {/* 생성 모드 */}
  <select value={generationMode} onChange={...}>...</select>
  
  {/* 모드 템플릿 설정 버튼 */}
  <button onClick={() => setIsModeTemplateModalOpen(true)}>템플릿 설정</button>
  
  {/* 모드 비활성화 토글 */}
  <button onClick={toggleModeDisabled}>
    {isModeDisabled ? '모드 활성화' : '모드 비활성화'}
  </button>
  
  {/* 스토리 엔진 */}
  <select value={engineVersion} onChange={...}>...</select>
  
  {/* 프롬프트 프리셋 */}
  <select value={selectedPromptPresetId} onChange={...}>...</select>
  
  {/* 프리셋 관리 버튼 */}
  <button onClick={() => setPresetManagerOpen(true)}>프리셋 관리</button>
</div>
```

**변경 후** (단순한 UI):
```tsx
<div className="generation-settings">
  {/* 1단계: 생성 모드 */}
  <div className="setting-group">
    <label>생성 모드</label>
    <select value={generationMode} onChange={e => setGenerationMode(e.target.value)}>
      <option value="script-only">대본만</option>
      <option value="script-image">대본 + 이미지</option>
    </select>
    <span className="help-text">
      이미지 모드는 각 장면의 이미지 프롬프트를 함께 생성합니다
    </span>
  </div>
  
  {/* 2단계: 스토리 엔진 */}
  <div className="setting-group">
    <label>스토리 엔진</label>
    <select value={engineVersion} onChange={e => setEngineVersion(e.target.value)}>
      <option value="V3">기본 엔진</option>
      <option value="V3_COSTAR">CO-STAR 엔진</option>
      {engineOptions.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <button onClick={() => setIsEngineModalOpen(true)}>
      엔진 설정
    </button>
  </div>
  
  {/* 고급 옵션 (접기/펼치기) */}
  <details>
    <summary>고급 옵션</summary>
    <div className="advanced-options">
      <label>프롬프트 미리보기</label>
      <textarea 
        value={getFullPrompt()} 
        readOnly 
        rows={10}
      />
      <button onClick={() => setIsEngineModalOpen(true)}>
        프롬프트 직접 편집
      </button>
    </div>
  </details>
</div>
```

---

### 🔄 Phase 4: 마이그레이션

#### 4.1 기존 설정 자동 변환

**파일**: `youtube-shorts-script-generator.tsx`  
**위치**: `useEffect` 초기화 부분

```typescript
useEffect(() => {
  // 기존 모드 템플릿을 엔진 프롬프트로 마이그레이션
  const migrateOldSettings = () => {
    const oldTemplates = localStorage.getItem(MODE_TEMPLATE_STORAGE_KEY);
    if (oldTemplates) {
      try {
        const parsed = JSON.parse(oldTemplates);
        
        // V3 엔진에 통합
        const currentV3 = enginePrompts['V3'] || '';
        if (!currentV3.includes('{{MODE_INSTRUCTION}}')) {
          const newV3Prompt = `
${parsed.scriptOnly}

{{MODE_INSTRUCTION}}

${parsed.scriptImage}
          `.trim();
          
          saveEnginePrompt('V3', newV3Prompt);
          showToast('기존 모드 템플릿을 엔진 프롬프트로 변환했습니다.', 'info');
        }
        
        // 기존 설정 제거
        localStorage.removeItem(MODE_TEMPLATE_STORAGE_KEY);
        localStorage.removeItem(MODE_DISABLED_STORAGE_KEY);
        localStorage.removeItem('shorts-generator-prompt-preset');
      } catch (e) {
        console.error('Migration failed:', e);
      }
    }
  };
  
  migrateOldSettings();
}, []);
```

---

## 🚀 빠른 시작 (최소 변경)

시간이 부족하다면, **최소한의 변경**만으로도 개선할 수 있습니다:

### 옵션 1: UI만 단순화 (30분)
- 모드 템플릿 설정 버튼 숨기기
- 모드 비활성화 토글 제거
- 프롬프트 프리셋 선택 숨기기
- 도움말 텍스트 추가

### 옵션 2: 프롬프트 미리보기 추가 (1시간)
- 현재 설정으로 생성될 프롬프트 미리보기
- 사용자가 결과를 예측할 수 있게 함

### 옵션 3: 전체 리팩토링 (4-6시간)
- 위의 모든 Phase 실행
- 완전한 단순화

---

## 📊 예상 효과

### Before
- 설정 옵션: **5개** (생성모드, 모드템플릿, 엔진, 프리셋, 모드비활성화)
- 프롬프트 생성: **5단계**
- 사용자 혼란도: **높음** 🔴

### After
- 설정 옵션: **2개** (생성모드, 엔진)
- 프롬프트 생성: **2단계**
- 사용자 혼란도: **낮음** 🟢

---

## ⚠️ 주의사항

1. **백업 필수**
   - Git 커밋 완료 ✅
   - 추가 백업 권장

2. **테스트 필수**
   - 각 Phase 완료 후 테스트
   - 기존 엔진 호환성 확인

3. **사용자 공지**
   - UI 변경 사항 안내
   - 마이그레이션 안내

---

## 💬 다음 단계

**어떻게 진행하시겠습니까?**

1. **옵션 1** - UI만 단순화 (빠름, 안전)
2. **옵션 2** - 프롬프트 미리보기 추가 (중간)
3. **옵션 3** - 전체 리팩토링 (느림, 완벽)
4. **커스텀** - 특정 부분만 수정

선택하시면 즉시 구현을 시작하겠습니다!

---

**작성일**: 2025-12-29  
**예상 소요 시간**: 
- 옵션 1: 30분
- 옵션 2: 1시간
- 옵션 3: 4-6시간

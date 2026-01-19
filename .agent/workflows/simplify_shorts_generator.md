# 쇼츠 생성기 단순화 구현 계획

**목표**: 3중 프롬프트 시스템을 엔진 중심으로 단순화

---

## 📋 작업 목록

### Phase 1: 준비 작업 ✅
- [x] 현재 로직 분석
- [x] 개선 방안 수립
- [x] Git 커밋

### Phase 2: 코드 정리 (진행 중)
- [ ] 1. 모드 템플릿 관련 코드 제거
  - [ ] `modeTemplates` 상태 제거
  - [ ] `MODE_TEMPLATE_STORAGE_KEY` 제거
  - [ ] `DEFAULT_MODE_TEMPLATES` 제거
  - [ ] `ModeTemplateSettingsModal` 관련 코드 제거
  - [ ] `isModeDisabled` 관련 코드 제거
  
- [ ] 2. 프롬프트 프리셋 관련 코드 제거 (또는 엔진에 통합)
  - [ ] `promptPresets` 상태 제거
  - [ ] `selectedPromptPresetId` 제거
  - [ ] `PromptPresetManagerModal` 관련 코드 제거
  
- [ ] 3. 엔진 프롬프트 강화
  - [ ] 엔진별로 `script-only` / `script-image` 모드 지원
  - [ ] 엔진 프롬프트에 모든 변수 치환 로직 통합

### Phase 3: UI 개선
- [ ] 1. 간단한 2단계 UI 구현
  - [ ] 생성 모드 선택 (대본만 / 대본+이미지)
  - [ ] 스토리 엔진 선택
  
- [ ] 2. 고급 옵션 (접기/펼치기)
  - [ ] 엔진 프롬프트 직접 편집
  - [ ] 프롬프트 미리보기

### Phase 4: 마이그레이션
- [ ] 기존 설정 자동 변환
- [ ] 로컬스토리지 정리

### Phase 5: 테스트
- [ ] 대본 생성 테스트
- [ ] 이미지 프롬프트 생성 테스트
- [ ] 기존 엔진 호환성 테스트

---

## 🎯 핵심 변경 사항

### Before (복잡)
```typescript
const generateScript = async () => {
  // 1. 모드 템플릿 선택
  const baseTemplate = isModeDisabled 
    ? '' 
    : modeTemplates[generationMode];
  
  // 2. 변수 치환
  const filled = fillTemplate(baseTemplate, variables);
  
  // 3. 엔진 프롬프트 추가
  const enginePrompt = enginePrompts[engineVersion];
  
  // 4. 프리셋 추가
  const presetPrompt = getPreset(selectedPromptPresetId);
  
  // 5. 조합
  const final = [filled, enginePrompt, presetPrompt].join('\n\n');
};
```

### After (단순)
```typescript
const generateScript = async () => {
  // 1. 엔진 프롬프트 가져오기
  let enginePrompt = enginePrompts[engineVersion];
  
  // 2. 생성 모드에 따라 프롬프트 조정
  if (generationMode === 'script-image') {
    enginePrompt = enginePrompt.replace(
      '{{MODE}}', 
      'Include image prompts for each scene'
    );
  }
  
  // 3. 변수 치환
  const finalPrompt = fillTemplate(enginePrompt, variables);
  
  // 4. AI 호출
  await callAI(finalPrompt);
};
```

---

## 📊 제거할 코드 목록

### 상태 변수
- `modeTemplates` (Line 554)
- `isModeDisabled` (Line 668)
- `promptPresets` (Line 548)
- `selectedPromptPresetId` (Line 549)
- `isPresetManagerOpen` (Line 553)
- `isModeTemplateModalOpen` (Line 572)

### 함수
- `persistModeTemplates` (Line 573)
- `handleSaveModeTemplateSettings` (Line 657)
- `handleResetModeTemplateSettings` (Line 663)
- `toggleModeDisabled` (Line 673)
- `refreshPromptPresets` (Line 641)

### 컴포넌트
- `ModeTemplateSettingsModal`
- `PromptPresetManagerModal`

### 상수
- `DEFAULT_MODE_TEMPLATES` (Line 37)
- `MODE_TEMPLATE_STORAGE_KEY` (Line 34)
- `MODE_DISABLED_STORAGE_KEY` (Line 35)

---

## 🔄 마이그레이션 전략

### 기존 모드 템플릿 → 엔진 프롬프트
```typescript
// 기존 사용자의 커스텀 모드 템플릿을 엔진 프롬프트로 변환
const migrateOldSettings = () => {
  const oldTemplates = localStorage.getItem(MODE_TEMPLATE_STORAGE_KEY);
  if (oldTemplates) {
    const parsed = JSON.parse(oldTemplates);
    
    // V3 엔진에 통합
    const newV3Prompt = `
${parsed.scriptOnly}

[이미지 모드 활성화 시]
${parsed.scriptImage}
    `;
    
    saveEnginePrompt('V3', newV3Prompt);
    
    // 기존 설정 제거
    localStorage.removeItem(MODE_TEMPLATE_STORAGE_KEY);
    localStorage.removeItem(MODE_DISABLED_STORAGE_KEY);
  }
};
```

---

## ⚠️ 주의사항

1. **기존 사용자 영향**
   - 커스텀 모드 템플릿을 사용 중인 사용자
   - 자동 마이그레이션 필요

2. **엔진 프롬프트 업데이트**
   - 모든 엔진이 `{{MODE}}` 변수 지원 필요
   - 기존 엔진 프롬프트 수정 필요

3. **UI 변경**
   - 사용자 재교육 필요
   - 도움말/가이드 업데이트

---

**시작일**: 2025-12-29  
**예상 완료**: 2025-12-29 (오늘 중)

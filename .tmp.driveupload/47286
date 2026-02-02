# 생성 모드 템플릿 설정 기능 구현 계획

1. **템플릿 사용 지점 정리 및 변수 정의**  
   - `youtube-shorts-script-generator.tsx`의 `generateScript` 단계에서 기존 하드코딩된 `scriptOnlyPrompt`/`scriptImagePrompt` 블록과 새로 추가된 `modeTemplates` 상태를 비교한다.  
   - 필요한 템플릿 토큰 목록(`SCRIPT_COUNT`, `GENRE`, `TOPIC`, `TARGET_LABEL`, `SPECIFIC_INSTRUCTIONS`, `STYLE_GUIDE`, `LOCKED_*`, `OUTFIT_BLOCK`, `CREATIVITY_BOOSTER`)을 확정하고, 런타임 값으로 변환하는 헬퍼(`outfitGuidanceBlock`, `templateVariables`, `fillTemplate`) 흐름을 설계한다.  
   - 엔진 강제 이미지 모드(예: `CUSTOM_1765973385899`) 및 로케이션/프리셋 변수 영역(`presetVariableBlock`)과의 호환성을 검증한다.

2. **프롬프트 생성 로직 교체**  
   - `generateScript` 내부에서 기존 문자열 상수를 제거하고, 잠금 의상/배경/크리에이티비티 토큰을 계산한 뒤 `fillTemplate`로 실제 프롬프트를 생성하도록 교체한다.  
   - `presetVariableBlock`과 엔진 프롬프트 prepend 로직은 유지하되, 선택된 생성 모드(대본 only vs 대본+이미지) 및 프리셋 사용 여부와 연동되는지 확인한다.  
   - 관련 콘솔 로그/토스트 메시지 등 기존 진단 로직이 유지되는지 확인하고, 런타임 에러(빈 템플릿, undefined 토큰 등)를 방지하는 기본값을 마련한다.

3. **생성 모드 템플릿 편집 UI 구현 및 연결**  
   - `components/ModeTemplateSettingsModal.tsx`(신규)로 모달 컴포넌트를 작성하여 모드별 텍스트에디터, 토큰 안내, 저장/초기화/취소 버튼을 제공한다.  
   - `youtube-shorts-script-generator.tsx` 하단 렌더링에 모달을 추가하고, 기존 `설정` 버튼과 핸들러(`handleSaveModeTemplateSettings`, `handleResetModeTemplateSettings`)를 연결한다.  
   - `localStorage` 지속화, 토스트 피드백, 입력 검증(빈 값 방지) 및 닫기 UX를 확인하고, 저장/초기화 시 상태가 즉시 반영되는지 수동 테스트한다.

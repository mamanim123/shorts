---
description: 프로젝트 전체 리팩토링 계획
---

# 프로젝트 전체 리팩토링 계획

## Phase 1: 기존 코드에 새 유틸리티 적용 ⏳

### 1.1 Server 코드 개선
- [ ] `server/index.js`에 ErrorHandler 적용
- [ ] `server/index.js`에 JsonParser 적용
- [ ] `server/index.js`에 Logger 적용
- [ ] `server/puppeteerHandler.js`에 Logger 적용

### 1.2 Frontend 코드 개선
- [ ] `App.tsx`에 JsonParser 적용
- [ ] `App.tsx`에 Logger 적용
- [ ] `App.tsx`에 apiClient 적용
- [ ] `youtube-shorts-script-generator.tsx`에 Logger 적용
- [ ] `youtube-shorts-script-generator.tsx`에 JsonParser 적용

### 1.3 Services 코드 개선
- [ ] `services/geminiService.ts`에 Logger 적용
- [ ] `services/geminiService.ts`에 JsonParser 적용

---

## Phase 2: 대형 파일 분할 ⏳

### 2.1 youtube-shorts-script-generator.tsx 분할
**목표**: 3,051줄 → 5-7개 파일 (각 300-500줄)

분할 계획:
- [ ] `components/shorts/ShortsGenerator.tsx` (메인 컴포넌트, 300줄)
- [ ] `components/shorts/ShortsConfigPanel.tsx` (설정 패널, 400줄)
- [ ] `services/shorts/promptBuilder.ts` (프롬프트 생성, 500줄)
- [ ] `services/shorts/outfitManager.ts` (의상 관리, 400줄)
- [ ] `services/shorts/characterManager.ts` (캐릭터 관리, 300줄)
- [ ] `services/shorts/engineConfig.ts` (엔진 설정, 400줄)
- [ ] `constants/shorts.ts` (상수, 700줄)

### 2.2 geminiService.ts 분할
**목표**: 1,495줄 → 3-4개 파일 (각 300-500줄)

분할 계획:
- [ ] `services/gemini/geminiApi.ts` (API 호출, 300줄)
- [ ] `services/gemini/promptBuilder.ts` (프롬프트 빌더, 500줄)
- [ ] `services/gemini/responseParser.ts` (응답 파싱, 400줄)
- [ ] `services/gemini/wardrobeManager.ts` (의상 관리, 300줄)

### 2.3 App.tsx 리팩토링
**목표**: 1,537줄 → 3-4개 파일 (각 300-500줄)

분할 계획:
- [ ] `App.tsx` (메인 컴포넌트, 400줄)
- [ ] `hooks/useHistory.ts` (히스토리 관리, 200줄)
- [ ] `hooks/useTemplates.ts` (템플릿 관리, 200줄)
- [ ] `services/storyService.ts` (스토리 처리, 400줄)
- [ ] `services/enhancementService.ts` (프롬프트 강화, 300줄)

---

## Phase 3: 상태 관리 개선 ⏳

### 3.1 Zustand 설치 및 설정
- [ ] Zustand 패키지 설치
- [ ] Store 구조 설계

### 3.2 Store 생성
- [ ] `stores/appStore.ts` (전역 상태)
- [ ] `stores/historyStore.ts` (히스토리)
- [ ] `stores/templateStore.ts` (템플릿)
- [ ] `stores/generationStore.ts` (생성 상태)

### 3.3 기존 코드에 Store 적용
- [ ] App.tsx에서 useState → useStore
- [ ] ShortsGenerator에서 useState → useStore
- [ ] Props drilling 제거

---

## Phase 4: 테스트 코드 작성 ⏳

### 4.1 테스트 환경 설정
- [ ] Vitest 설치 및 설정
- [ ] Testing Library 설정
- [ ] 테스트 디렉토리 구조 생성

### 4.2 유틸리티 테스트
- [ ] `utils/logger.test.ts`
- [ ] `utils/jsonParser.test.ts`
- [ ] `utils/errorHandler.test.ts`
- [ ] `utils/apiClient.test.ts`

### 4.3 서비스 테스트
- [ ] `services/gemini/geminiApi.test.ts`
- [ ] `services/shorts/promptBuilder.test.ts`

### 4.4 컴포넌트 테스트
- [ ] `components/shorts/ShortsGenerator.test.tsx`
- [ ] `components/ConfigPanel.test.tsx`

---

## 진행 상황

- **Phase 1**: 0% (0/11)
- **Phase 2**: 0% (0/17)
- **Phase 3**: 0% (0/8)
- **Phase 4**: 0% (0/10)

**전체 진행률**: 0% (0/46)

---

## 예상 소요 시간

- **Phase 1**: 2-3시간
- **Phase 2**: 4-6시간
- **Phase 3**: 2-3시간
- **Phase 4**: 3-4시간

**총 예상 시간**: 11-16시간

---

**시작일**: 2025-12-29
**목표 완료일**: 2025-12-30

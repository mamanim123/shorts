# AI 서비스 선택 기능 수정 작업

## 📋 작업 개요

**목표:** ConfigPanel에서 선택한 AI 서비스(GEMINI/CHATGPT/CLAUDE/GENSPARK)가 실제로 대본 생성에 적용되도록 수정

**현재 문제:**
- UI에서 AI 서비스 선택 가능
- 백엔드는 모든 AI 지원
- ❌ 프론트엔드가 선택한 서비스를 백엔드로 전달하지 않음
- 결과: 항상 GEMINI만 사용됨

**작업 일시:** 2026-01-25

---

## 🎯 목표

### 1차 목표: 대본 생성 AI 선택 기능 구현
- [ ] ConfigPanel의 `targetService` 값을 ShortsLabPanel로 전달
- [ ] API 호출 시 `service` 파라미터 추가
- [ ] 선택한 AI로 대본 생성 확인

### 2차 목표: 사용자 피드백
- [ ] 어떤 AI를 사용했는지 화면에 표시
- [ ] 생성된 대본 파일명에 AI 서비스 표시 (이미 구현됨)

---

## ✅ 체크리스트

### Phase 1: 코드 분석
- [x] ConfigPanel에서 targetService 상태 관리 확인
- [x] ShortsLabPanel의 API 호출 부분 확인
- [x] 백엔드 /api/generate/raw 엔드포인트 확인
- [x] service 파라미터 처리 로직 확인

### Phase 2: Props 연결
- [ ] AiStudioHost.tsx에서 targetService 상태 관리 확인
- [ ] ShortsLabPanel에 targetService props 추가
- [ ] Props 타입 정의 추가

### Phase 3: API 수정
- [ ] handleAiGenerate 함수에서 service 파라미터 추가
- [ ] API 호출 body에 service 포함
- [ ] 기본값 'GEMINI' 설정

### Phase 4: UI 피드백
- [ ] 사용된 AI 서비스 표시 UI 추가
- [ ] Toast 메시지에 AI 이름 포함
- [ ] 생성 중 메시지에 AI 이름 표시

### Phase 5: 테스트
- [ ] GEMINI 선택 시 정상 작동 확인
- [ ] CHATGPT 선택 시 정상 작동 확인
- [ ] CLAUDE 선택 시 정상 작동 확인
- [ ] GENSPARK 선택 시 정상 작동 확인
- [ ] 서비스 미선택 시 GEMINI 기본값 확인

---

## 🔧 수정 파일 목록

### 1. AiStudioHost.tsx
- `targetService` 상태를 ShortsLabPanel로 전달

### 2. components/ShortsLabPanel.tsx
- Props 인터페이스에 `targetService` 추가
- handleAiGenerate 함수 수정
- API 호출 시 service 파라미터 추가
- UI 피드백 메시지 수정

### 3. server/index.js (수정 불필요)
- 이미 service 파라미터 처리 구현됨

---

## 📝 코드 변경 계획

### 변경 1: ShortsLabPanel Props 추가

```typescript
interface ShortsLabPanelProps {
  targetService?: 'GEMINI' | 'CHATGPT' | 'CLAUDE' | 'GENSPARK';
}
```

### 변경 2: API 호출 수정

```typescript
// 기존
const response = await fetch('http://localhost:3002/api/generate/raw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        prompt,
        maxTokens: 2000,
        temperature: 0.9
    })
});

// 수정 후
const selectedService = targetService || 'GEMINI';
const response = await fetch('http://localhost:3002/api/generate/raw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        service: selectedService,  // ← 추가
        prompt,
        maxTokens: 2000,
        temperature: 0.9
    })
});
```

### 변경 3: 사용자 피드백

```typescript
// 생성 시작 메시지
showToast(`${selectedService} AI로 대본을 생성하고 있습니다...`, 'info');

// 생성 완료 메시지
showToast(`${selectedService} AI로 대본이 생성되었습니다.`, 'success');
```

---

## 🧪 테스트 시나리오

### 시나리오 1: GEMINI 선택
1. ConfigPanel에서 GEMINI 선택
2. 주제 입력: "골프장에서 눈 오는 상황"
3. AI 대본 생성 클릭
4. 확인:
   - Toast에 "GEMINI AI로 대본을 생성하고 있습니다..." 표시
   - 서버 로그에 `Generating content via GEMINI...` 표시
   - 대본 생성 성공
   - 파일명에 `[GEMINI]` 포함

### 시나리오 2: CHATGPT 선택
1. ConfigPanel에서 CHATGPT 선택
2. 주제 입력: "카페에서 우연히 만난 상황"
3. AI 대본 생성 클릭
4. 확인:
   - Toast에 "CHATGPT AI로 대본을 생성하고 있습니다..." 표시
   - 서버 로그에 `Generating content via CHATGPT...` 표시
   - 대본 생성 성공
   - 파일명에 `[CHATGPT]` 포함

### 시나리오 3: CLAUDE 선택
1. ConfigPanel에서 CLAUDE 선택
2. 주제 입력: "엘리베이터에서 갇힌 상황"
3. AI 대본 생성 클릭
4. 확인:
   - Toast에 "CLAUDE AI로 대본을 생성하고 있습니다..." 표시
   - 서버 로그에 `Generating content via CLAUDE...` 표시
   - 대본 생성 성공
   - 파일명에 `[CLAUDE]` 포함

### 시나리오 4: GENSPARK 선택
1. ConfigPanel에서 GENSPARK 선택
2. 주제 입력: "회의실에서 오해받는 상황"
3. AI 대본 생성 클릭
4. 확인:
   - Toast에 "GENSPARK AI로 대본을 생성하고 있습니다..." 표시
   - 서버 로그에 `Generating content via GENSPARK...` 표시
   - 대본 생성 성공
   - 파일명에 `[GENSPARK]` 포함

### 시나리오 5: 기본값 테스트
1. ConfigPanel에서 아무것도 선택하지 않음 (또는 첫 실행)
2. AI 대본 생성 클릭
3. 확인:
   - 기본값 GEMINI로 작동
   - 정상 생성 확인

---

## ⚠️ 주의사항

### 백엔드 브라우저 준비 상태
- 각 AI 서비스는 Puppeteer로 웹 브라우저를 제어
- 브라우저가 열려있지 않으면 자동으로 실행
- 첫 실행 시 로그인 필요할 수 있음

### AI별 특성
- **GEMINI**: Google 계정 필요, 가장 안정적
- **CHATGPT**: OpenAI 계정 필요, 대화 형식 우수
- **CLAUDE**: Anthropic 계정 필요, 긴 문맥 처리 우수
- **GENSPARK**: Genspark 계정 필요

### 오류 처리
- 브라우저 실행 실패 시 사용자에게 안내
- AI 응답 지연 시 타임아웃 처리
- JSON 파싱 실패 시 재시도 로직

---

## 📊 성공 기준

- [x] UI에서 AI 선택 가능
- [ ] 선택한 AI로 실제 대본 생성
- [ ] 서버 로그에 선택한 AI 표시
- [ ] 파일명에 AI 이름 포함
- [ ] Toast 메시지에 AI 이름 표시
- [ ] 모든 AI에서 동일하게 작동

---

## 📚 참고 자료

### 관련 파일
- `components/ConfigPanel.tsx:100-111` - AI 선택 UI
- `components/ShortsLabPanel.tsx:1168-1176` - API 호출
- `server/index.js:597-696` - 백엔드 처리
- `server/puppeteerHandler.js` - Puppeteer 제어

### 타입 정의
- `types.ts` - TargetService 타입 정의 확인 필요

---

## 🔄 롤백 계획

만약 문제 발생 시:
1. Git에서 이전 커밋으로 복구
2. service 파라미터를 옵셔널로 변경
3. 기본값 GEMINI로 폴백

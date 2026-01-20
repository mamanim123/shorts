# 🚀 실용적 리팩토링 가이드

프로젝트가 매우 방대하여 (15,000줄 이상), 전체를 한 번에 리팩토링하는 것은 현실적이지 않습니다.
대신 **점진적 개선 전략**을 제안합니다.

---

## ✅ 완료된 작업

### 1. 유틸리티 모듈 생성 (Phase 1 - 부분 완료)
- [x] `utils/logger.ts` - 통합 로깅 시스템
- [x] `utils/jsonParser.ts` - JSON 파싱 유틸리티
- [x] `utils/errorHandler.ts` - 에러 처리
- [x] `utils/apiClient.ts` - API 클라이언트
- [x] `utils/constants.ts` - 공통 상수
- [x] `server/logger.js` - 서버용 Logger
- [x] `server/errorHandler.js` - 서버용 ErrorHandler
- [x] `server/index.js`에 유틸리티 import 추가

---

## 📋 점진적 개선 전략

### 전략 1: 새 코드부터 적용 ⭐ **추천**
**가장 안전하고 실용적인 방법**

```typescript
// 새로운 기능을 추가할 때
import { Logger, JsonParser, apiClient } from './utils';

const handleNewFeature = async () => {
  Logger.info('New feature started');
  try {
    const result = await apiClient.post('/api/new-endpoint', data);
    Logger.info('Success', result);
  } catch (error) {
    Logger.error('Failed', error);
  }
};
```

**장점**:
- 기존 코드를 건드리지 않아 안전
- 새 코드의 품질이 즉시 향상
- 점진적으로 코드베이스 개선

### 전략 2: 수정이 필요한 파일만 개선
**버그 수정이나 기능 추가 시 함께 리팩토링**

```typescript
// 기존 파일을 수정할 때
// Before
console.log("DEBUG: Something");
const data = JSON.parse(text);

// After
import { Logger, JsonParser } from './utils';
Logger.debug("Something");
const data = JsonParser.parse(text);
```

### 전략 3: 주말/여유 시간에 점진적 개선
**한 번에 하나의 파일만 리팩토링**

---

## 🎯 우선순위별 개선 대상

### 높음 (즉시 적용 권장)
1. **새로운 기능 개발 시** → 무조건 새 유틸리티 사용
2. **버그 수정 시** → 해당 파일에 유틸리티 적용
3. **자주 수정되는 파일** → 우선적으로 리팩토링

### 중간 (점진적 적용)
1. **server/index.js** → 에러 처리 개선
2. **App.tsx** → JSON 파싱 통합
3. **youtube-shorts-script-generator.tsx** → Logger 적용

### 낮음 (선택적)
1. 안정적으로 작동하는 레거시 코드
2. 거의 수정하지 않는 파일

---

## 📖 실전 적용 예시

### 예시 1: 새 API 엔드포인트 추가

```javascript
// server/index.js에 새 엔드포인트 추가
app.post('/api/new-feature', async (req, res, next) => {
  try {
    logger.info('New feature requested', { body: req.body });
    
    const result = await someService.process(req.body);
    
    res.json(createSuccessResponse(result));
  } catch (error) {
    ErrorHandler.logError(error, { endpoint: '/api/new-feature' });
    next(new ApiError('Feature failed', 500, { originalError: error.message }));
  }
});

// 에러 핸들러 미들웨어 추가 (파일 끝부분)
app.use(ErrorHandler.expressErrorHandler());
```

### 예시 2: 기존 JSON 파싱 개선

```typescript
// App.tsx에서 기존 코드 개선
import { JsonParser, Logger } from './utils';

// Before
const handleImport = (jsonText: string) => {
  try {
    const data = JSON.parse(jsonText);
    // ... 복잡한 파싱 로직
  } catch (e) {
    console.error("Parse failed", e);
    alert("JSON 파싱 실패");
  }
};

// After
const handleImport = (jsonText: string) => {
  Logger.time('json-import');
  const data = JsonParser.parseStory(jsonText);
  Logger.timeEnd('json-import');
  
  if (!data) {
    Logger.error("Parse failed");
    showToast("JSON 파싱 실패", "error");
    return;
  }
  
  // ... 나머지 로직
};
```

### 예시 3: API 호출 개선

```typescript
// 기존 fetch 호출을 apiClient로 교체
import { apiClient, API_ENDPOINTS, Logger } from './utils';

// Before
const fetchHistory = async () => {
  try {
    const response = await fetch('/api/history');
    const data = await response.json();
    setHistory(data);
  } catch (e) {
    console.error("Failed to fetch history", e);
  }
};

// After
const fetchHistory = async () => {
  try {
    const data = await apiClient.get(API_ENDPOINTS.HISTORY);
    setHistory(data);
    Logger.info('History loaded', { count: data.length });
  } catch (error) {
    Logger.error('Failed to fetch history', error);
    showToast(ErrorHandler.getSafeErrorMessage(error), 'error');
  }
};
```

---

## 🔧 빠른 참조 가이드

### Logger 사용법
```typescript
import Logger from './utils/logger';

Logger.debug('디버그 메시지', { data });  // 개발 환경에서만
Logger.info('정보 메시지');              // 일반 로그
Logger.warn('경고 메시지');              // 경고
Logger.error('에러 발생', error);        // 에러

// 성능 측정
Logger.time('operation');
// ... 작업
Logger.timeEnd('operation');
```

### JsonParser 사용법
```typescript
import { JsonParser } from './utils';

// 기본 파싱
const data = JsonParser.parse(jsonString);

// 스토리 파싱 (검증 포함)
const story = JsonParser.parseStory(jsonString);

// 스크립트 배열 파싱
const scripts = JsonParser.parseScripts(jsonString);
```

### ApiClient 사용법
```typescript
import { apiClient, API_ENDPOINTS } from './utils';

// GET
const data = await apiClient.get(API_ENDPOINTS.HISTORY);

// POST
const result = await apiClient.post(API_ENDPOINTS.GENERATE, {
  prompt: 'test'
});

// PUT
await apiClient.put(API_ENDPOINTS.PROMPT_PRESET_BY_ID('123'), {
  name: 'Updated'
});

// DELETE
await apiClient.delete(API_ENDPOINTS.STYLE_TEMPLATE_BY_ID('456'));
```

### ErrorHandler 사용법
```typescript
import { ApiError, ErrorHandler } from './utils';

// 에러 던지기
throw new ApiError('Generation failed', 500, { reason: 'timeout' });

// 에러 로깅
ErrorHandler.logError(error, { context: 'generation' });

// 안전한 에러 메시지
const message = ErrorHandler.getSafeErrorMessage(error);
```

---

## 📊 진행 상황 추적

### 체크리스트

#### 서버 (server/)
- [x] logger.js 생성
- [x] errorHandler.js 생성
- [x] index.js에 import 추가
- [ ] console.log → logger 교체 (선택적)
- [ ] 에러 처리 개선 (선택적)

#### 프론트엔드 (/)
- [x] utils/ 모듈 생성
- [ ] App.tsx에 적용 (선택적)
- [ ] youtube-shorts-script-generator.tsx에 적용 (선택적)
- [ ] 새 기능 개발 시 사용 (필수)

---

## 💡 핵심 원칙

1. **완벽보다 진보** - 한 번에 모든 것을 바꾸려 하지 말 것
2. **새 코드 우선** - 새로운 코드부터 좋은 패턴 적용
3. **점진적 개선** - 수정할 때마다 조금씩 개선
4. **안전 제일** - 작동하는 코드를 함부로 건드리지 말 것
5. **테스트 필수** - 변경 후 반드시 테스트

---

## 🚀 다음 단계

### 즉시 실행 (오늘부터)
1. ✅ 새 기능 개발 시 utils 사용
2. ✅ 버그 수정 시 해당 파일 개선
3. ✅ API 호출 시 apiClient 사용

### 이번 주
1. server/index.js의 주요 엔드포인트에 에러 핸들러 적용
2. App.tsx의 JSON 파싱을 JsonParser로 교체
3. 새 기능 추가 시 Logger 사용

### 이번 달
1. 자주 수정하는 파일 3-5개 선택하여 리팩토링
2. 테스트 코드 작성 시작
3. 상태 관리 개선 검토

---

## 📞 도움이 필요하면

특정 파일이나 기능을 개선하고 싶으시면 언제든 요청하세요:
- "App.tsx의 handleGenerate 함수를 개선해줘"
- "server/index.js의 /api/generate 엔드포인트를 리팩토링해줘"
- "JsonParser를 사용해서 이 코드를 개선해줘"

---

**작성일**: 2025-12-29  
**다음 리뷰**: 2026-01-05 (1주일 후)

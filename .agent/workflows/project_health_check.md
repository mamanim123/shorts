# 🔍 프로젝트 전체 점검 보고서
**생성일**: 2025-12-29
**프로젝트**: 쇼츠대본생성기 v4.7

---

## 📊 프로젝트 개요

### 기술 스택
- **프론트엔드**: React 19.2.0, TypeScript 5.8.3, Vite 6.4.1
- **백엔드**: Express 5.2.1, Node.js
- **AI 통합**: Google Gemini API, Puppeteer (ChatGPT, Claude 자동화)
- **주요 라이브러리**: 
  - Puppeteer 24.31.0 (브라우저 자동화)
  - jsonrepair 3.13.1 (JSON 파싱 복구)
  - react-markdown 10.1.0 (마크다운 렌더링)

### 프로젝트 구조
```
쇼츠대본생성기-v4.7/
├── components/          # React 컴포넌트 (18개 파일)
│   ├── master-studio/  # 마스터 스튜디오 (24개 파일)
│   └── *.tsx           # 메인 컴포넌트들
├── services/           # 비즈니스 로직 (9개 파일)
├── server/             # Express 서버 (9개 파일)
├── hooks/              # React Hooks (3개)
├── generated_scripts/  # 생성된 대본 저장소 (158개)
├── style_templates/    # 스타일 템플릿 (26개)
└── 설정 파일들
```

---

## ⚠️ 발견된 주요 문제점

### 1. **코드 복잡도 및 중복**

#### 🔴 심각도: 높음
**문제점:**
- `youtube-shorts-script-generator.tsx`: **3,051줄** (71개 함수)
- `App.tsx`: **1,537줄** (47개 함수)
- `services/geminiService.ts`: **1,495줄** (58개 함수)
- `server/index.js`: **1,293줄**

**영향:**
- 하나의 수정이 다른 부분에 예상치 못한 영향을 미침
- 디버깅 및 유지보수 어려움
- 코드 가독성 저하

**권장 사항:**
```
1. 파일 분할 (Single Responsibility Principle)
   - youtube-shorts-script-generator.tsx → 5-7개 파일로 분리
     * ShortsGenerator.tsx (메인 컴포넌트)
     * ShortsPromptBuilder.ts (프롬프트 생성 로직)
     * ShortsOutfitManager.ts (의상 관리)
     * ShortsEngineConfig.ts (엔진 설정)
     * ShortsCharacterManager.ts (캐릭터 관리)
   
   - geminiService.ts → 3-4개 파일로 분리
     * geminiApi.ts (API 호출)
     * promptBuilder.ts (프롬프트 빌더)
     * responseParser.ts (응답 파싱)
     * wardrobeManager.ts (의상 관리)

2. 공통 로직 추출
   - 중복된 JSON 파싱 로직 → utils/jsonParser.ts
   - 의상 선택 로직 → utils/outfitSelector.ts
   - 프롬프트 빌더 → utils/promptBuilder.ts
```

---

### 2. **타입 안정성 문제**

#### 🟡 심각도: 중간
**문제점:**
```typescript
// types.ts에서 정의된 타입들이 일관성 없게 사용됨
export type EngineVersion = 'V3' | 'V3_COSTAR' | 'NONE' | string;  // ❌ string 허용으로 타입 안정성 저하

// 여러 곳에서 any 타입 사용
slots?: any[]  // ❌ 구체적인 타입 필요
```

**권장 사항:**
```typescript
// 1. 엄격한 타입 정의
export type EngineVersion = 
  | 'V3' 
  | 'V3_COSTAR' 
  | 'NONE' 
  | `CUSTOM_${number}`;  // ✅ 커스텀 엔진 패턴 명시

// 2. any 제거
interface PromptSlot {
  id: string;
  type: 'character' | 'outfit' | 'background';
  value: string;
}

interface PromptEnhancementSettings {
  autoEnhanceOnGeneration?: boolean;
  slots?: PromptSlot[];  // ✅ 구체적 타입
  useQualityTags?: boolean;
  qualityTags?: string;
}
```

---

### 3. **상태 관리 복잡성**

#### 🟡 심각도: 중간
**문제점:**
- 여러 컴포넌트에서 중복된 상태 관리
- Props drilling (깊은 컴포넌트 계층)
- 상태 동기화 이슈

**현재 상태:**
```typescript
// App.tsx
const [history, setHistory] = useState<StoryResponse[]>([]);
const [selectedStory, setSelectedStory] = useState<StoryResponse | null>(null);
const [templates, setTemplates] = useState<StyleTemplate[]>([]);
// ... 30개 이상의 상태 변수

// youtube-shorts-script-generator.tsx
const [topic, setTopic] = useState('');
const [genre, setGenre] = useState('');
// ... 또 다른 20개 이상의 상태 변수
```

**권장 사항:**
```typescript
// 1. Context API 또는 Zustand 도입
// stores/appStore.ts
import create from 'zustand';

interface AppState {
  history: StoryResponse[];
  selectedStory: StoryResponse | null;
  templates: StyleTemplate[];
  // actions
  addToHistory: (story: StoryResponse) => void;
  selectStory: (story: StoryResponse) => void;
  // ...
}

export const useAppStore = create<AppState>((set) => ({
  history: [],
  selectedStory: null,
  templates: [],
  addToHistory: (story) => set((state) => ({ 
    history: [story, ...state.history] 
  })),
  // ...
}));

// 2. 관련 상태 그룹화
interface ShortsGeneratorState {
  input: UserInput;
  output: StoryResponse | null;
  loading: boolean;
  error: string | null;
}
```

---

### 4. **API 에러 처리 불일치**

#### 🟡 심각도: 중간
**문제점:**
```javascript
// server/index.js - 일관성 없는 에러 처리
app.post('/api/generate', async (req, res) => {
  try {
    // ...
  } catch (e) {
    console.error("Failed to launch browser:", e);
    res.status(500).json({ error: "Failed to launch browser" });  // ❌ 에러 메시지만
  }
});

app.post('/api/save-story', (req, res) => {
  try {
    // ...
  } catch (e) {
    console.error("Failed to save file:", e);
    res.status(500).json({ error: "Failed to save file" });  // ❌ 상세 정보 없음
  }
});
```

**권장 사항:**
```javascript
// utils/errorHandler.js
class ApiError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
  console.error('[API Error]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
      timestamp: new Date().toISOString()
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// 사용 예시
app.post('/api/generate', async (req, res, next) => {
  try {
    // ...
  } catch (e) {
    next(new ApiError('Failed to generate content', 500, {
      service: req.body.service,
      originalError: e.message
    }));
  }
});
```

---

### 5. **JSON 파싱 복잡성**

#### 🟡 심각도: 중간
**문제점:**
- 여러 곳에서 중복된 JSON 파싱 로직
- `tryParse`, `preprocessJsonLikeString`, `stripCodeWrappers` 등 분산된 함수들

**현재 상황:**
```javascript
// server/index.js
const tryParse = (str) => {
  // 100줄 이상의 복잡한 파싱 로직
};

// App.tsx
const parseScriptsJsonLoose = (text: string) => {
  // 또 다른 파싱 로직
};

// youtube-shorts-script-generator.tsx
// 또 다른 JSON 파싱 로직
```

**권장 사항:**
```typescript
// utils/jsonParser.ts
export class JsonParser {
  private static stripCodeWrappers(text: string): string {
    // 코드 블록 제거
  }

  private static escapeUnescapedNewlines(text: string): string {
    // 이스케이프 처리
  }

  private static repairJson(text: string): string {
    // jsonrepair 사용
  }

  public static parse<T = any>(text: string): T | null {
    try {
      // 1단계: 기본 파싱
      return JSON.parse(text);
    } catch {
      // 2단계: 전처리 후 파싱
      const cleaned = this.stripCodeWrappers(text);
      try {
        return JSON.parse(cleaned);
      } catch {
        // 3단계: jsonrepair 사용
        return JSON.parse(this.repairJson(cleaned));
      }
    }
  }

  public static parseStory(text: string): StoryResponse | null {
    const data = this.parse(text);
    if (!data) return null;
    
    // 스토리 형식 검증 및 변환
    return this.validateAndTransformStory(data);
  }
}
```

---

### 6. **디버그 코드 및 콘솔 로그**

#### 🟢 심각도: 낮음
**문제점:**
- 프로덕션 코드에 DEBUG 로그 다수 존재
- 성능에 영향을 줄 수 있는 불필요한 로깅

**발견된 위치:**
```typescript
// services/geminiService.ts
console.log("DEBUG: generateStory called");
console.log("DEBUG: input.engineVersion:", input.engineVersion);
console.log("DEBUG: Full Prompt Generated:\n", fullPrompt);

// components/YoutubeSearchPanel.tsx
const [debugLogs, setDebugLogs] = useState<string[]>([]);
const [debugOpen, setDebugOpen] = useState(false);
```

**권장 사항:**
```typescript
// utils/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private static level: LogLevel = 
    process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG;

  static debug(...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log('[DEBUG]', ...args);
    }
  }

  static info(...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log('[INFO]', ...args);
    }
  }

  static warn(...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn('[WARN]', ...args);
    }
  }

  static error(...args: any[]) {
    console.error('[ERROR]', ...args);
  }
}

export default Logger;

// 사용
Logger.debug("generateStory called");  // 프로덕션에서 자동 제거됨
```

---

## 🎯 우선순위별 개선 계획

### Phase 1: 긴급 (1-2주)
1. **공통 유틸리티 추출**
   - `utils/jsonParser.ts` 생성
   - `utils/logger.ts` 생성
   - `utils/errorHandler.ts` 생성

2. **타입 안정성 강화**
   - `types.ts` 개선
   - `any` 타입 제거
   - 엄격한 타입 가드 추가

### Phase 2: 중요 (2-4주)
1. **대형 파일 분할**
   - `youtube-shorts-script-generator.tsx` 분리
   - `geminiService.ts` 분리
   - `App.tsx` 리팩토링

2. **상태 관리 개선**
   - Context API 또는 Zustand 도입
   - Props drilling 제거

### Phase 3: 개선 (1-2개월)
1. **아키텍처 개선**
   - 레이어 분리 (Presentation, Business Logic, Data)
   - 의존성 주입 패턴 도입

2. **테스트 코드 작성**
   - 단위 테스트 (Jest)
   - 통합 테스트 (Playwright)

---

## 📝 즉시 적용 가능한 개선 사항

### 1. 공통 상수 관리
```typescript
// constants/api.ts
export const API_ENDPOINTS = {
  GENERATE: '/api/generate',
  SAVE_STORY: '/api/save-story',
  HISTORY: '/api/history',
  // ...
} as const;

// constants/errors.ts
export const ERROR_MESSAGES = {
  BROWSER_LAUNCH_FAILED: 'Failed to launch browser',
  JSON_PARSE_FAILED: 'Failed to parse JSON response',
  // ...
} as const;
```

### 2. 환경 변수 타입 정의
```typescript
// env.d.ts
interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_API_BASE_URL: string;
  // ...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

### 3. API 클라이언트 추상화
```typescript
// api/client.ts
class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3002') {
    this.baseURL = baseURL;
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.statusText}`,
        response.status
      );
    }

    return response.json();
  }

  // get, put, delete 메서드...
}

export const apiClient = new ApiClient();
```

---

## 🔧 권장 도구 및 라이브러리

### 개발 도구
- **ESLint**: 코드 품질 관리
- **Prettier**: 코드 포맷팅
- **Husky**: Git hooks (pre-commit 검사)
- **lint-staged**: 변경된 파일만 린트

### 상태 관리
- **Zustand**: 간단하고 가벼운 상태 관리 (추천)
- **React Query**: 서버 상태 관리

### 테스팅
- **Vitest**: Vite 기반 테스트 프레임워크
- **Testing Library**: React 컴포넌트 테스트
- **Playwright**: E2E 테스트 (이미 설치됨)

---

## 📊 메트릭스

### 현재 상태
- **총 코드 라인**: ~15,000줄
- **평균 파일 크기**: 큰 파일 3개 (1,000줄 이상)
- **타입 커버리지**: ~70% (추정)
- **테스트 커버리지**: 0%

### 목표 (3개월 후)
- **평균 파일 크기**: 300줄 이하
- **타입 커버리지**: 95%+
- **테스트 커버리지**: 60%+
- **빌드 시간**: 현재 대비 30% 단축

---

## 🚀 다음 단계

1. **즉시 실행**
   - [ ] `utils/` 폴더 생성 및 공통 유틸리티 추출
   - [ ] ESLint + Prettier 설정
   - [ ] 타입 정의 개선

2. **1주일 내**
   - [ ] JSON 파싱 로직 통합
   - [ ] 에러 처리 표준화
   - [ ] Logger 시스템 구축

3. **2주일 내**
   - [ ] 대형 파일 분할 시작
   - [ ] 상태 관리 라이브러리 도입
   - [ ] API 클라이언트 추상화

---

## 💡 결론

현재 프로젝트는 **기능적으로는 잘 작동**하지만, **유지보수성과 확장성**에 문제가 있습니다. 
주요 원인은:
1. 과도하게 큰 파일들
2. 중복된 로직
3. 불충분한 타입 안정성
4. 복잡한 상태 관리

**점진적 리팩토링**을 통해 이러한 문제들을 해결할 수 있으며, 
위의 Phase별 계획을 따라 진행하면 3개월 내에 훨씬 건강한 코드베이스를 만들 수 있습니다.

---

**작성자**: Claude Code Agent  
**검토 필요**: 프로젝트 리드, 개발팀

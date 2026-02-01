# 프롬프트 요소별 하이라이트 시스템 - 구현 예제

## 시스템 구성도

```
┌─────────────────────────────────────────────────────────┐
│         ShortsLabPanel.tsx (메인 컴포넌트)              │
├─────────────────────────────────────────────────────────┤
│  - 상태 관리 (showPromptEditModal, promptElementAnalysis)│
│  - 모달 열기/닫기 함수                                    │
│  - usePromptEditModal hook 사용                         │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────┐
        │                     │              │
        ▼                     ▼              ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│ PromptEditModal  │ │usePromptEdit │ │promptHighlight   │
│   (UI 컴포넌트)  │ │  Modal.ts    │ │  System.tsx      │
├──────────────────┤ ├──────────────┤ ├──────────────────┤
│ - 모달 UI 렌더링  │ │- AI 분석 로직 │ │- 렌더링 함수     │
│ - 입력 필드       │ │- API 호출    │ │- 범례            │
│ - 하이라이트 표시  │ │- JSON 파싱   │ │- 색상 정의       │
│ - 범례            │ │              │ │                  │
└──────────────────┘ └──────────────┘ └──────────────────┘
```

---

## 단계별 구현

### 1단계: 상태 추가 (ShortsLabPanel.tsx)

```typescript
// 프롬프트 수정 모달 상태
const [showPromptEditModal, setShowPromptEditModal] = useState(false);
const [promptEditSceneNumber, setPromptEditSceneNumber] = useState<number | null>(null);
const [promptEditOriginal, setPromptEditOriginal] = useState('');
const [promptEditText, setPromptEditText] = useState('');
const [promptEditLoading, setPromptEditLoading] = useState(false);
const [promptEditError, setPromptEditError] = useState<string | null>(null);
const [promptElementAnalysis, setPromptElementAnalysis] = useState<ElementAnalysis>({});
```

### 2단계: Hook 사용

```typescript
const { handleAnalyzePromptByElement } = usePromptEditModal({
    promptEditOriginal,
    promptEditLoading,
    targetService,
    setPromptEditLoading,
    setPromptEditError,
    setPromptElementAnalysis
});
```

### 3단계: 모달 열기/닫기 함수

```typescript
const openPromptEditModal = useCallback((sceneNumber: number, currentPrompt: string) => {
    setPromptEditSceneNumber(sceneNumber);
    setPromptEditOriginal(currentPrompt || '');
    setPromptEditText(currentPrompt || '');
    setPromptEditError(null);
    setPromptElementAnalysis({});
    setShowPromptEditModal(true);
}, []);

const closePromptEditModal = useCallback(() => {
    setShowPromptEditModal(false);
    setPromptEditSceneNumber(null);
    setPromptEditOriginal('');
    setPromptEditText('');
    setPromptEditError(null);
    setPromptElementAnalysis({});
}, []);
```

### 4단계: 모달 렌더링

```tsx
<PromptEditModal
    isOpen={showPromptEditModal}
    sceneNumber={promptEditSceneNumber}
    originalPrompt={promptEditOriginal}
    editingPrompt={promptEditText}
    isLoading={promptEditLoading}
    error={promptEditError}
    elementAnalysis={promptElementAnalysis}
    onClose={closePromptEditModal}
    onEditingChange={setPromptEditText}
    onAnalyze={handleAnalyzePromptByElement}
/>
```

---

## 사용 예제

### 예제 1: 프롬프트 분석

```typescript
// 원본 프롬프트
const originalPrompt = `
A stunning Korean woman in her 20s, dressed in a sleek black evening gown,
standing in a modern luxury penthouse with floor-to-ceiling windows overlooking
the city at night. Cinematic photography, dramatic lighting, shallow depth of field.
Professional photography, 8k resolution, masterpiece.
`;

// AI 분석 결과 (자동 생성)
const analysis: ElementAnalysis = {
    style: ['Cinematic photography', 'Professional photography', '8k resolution', 'masterpiece'],
    lighting: ['dramatic lighting'],
    camera: ['shallow depth of field'],
    composition: [],
    character: ['A stunning Korean woman in her 20s', 'dressed in a sleek black evening gown'],
    background: ['modern luxury penthouse with floor-to-ceiling windows', 'city at night'],
    problems: ['중복: "photography" (2회)']
};

// 렌더링
const highlightedContent = renderHighlightedByElement(originalPrompt, analysis);
```

### 예제 2: 모달에서 분석 실행

```typescript
// 사용자가 "요소 분석" 버튼 클릭
onClick={handleAnalyzePromptByElement}

// 내부 동작:
// 1. promptEditOriginal을 AI에 전송
// 2. buildElementAnalysisPrompt로 프롬프트 생성
// 3. API 호출 (http://localhost:3002/api/generate/raw)
// 4. JSON 파싱
// 5. setPromptElementAnalysis로 상태 업데이트
```

### 예제 3: 색상 범례 표시

```tsx
// PromptLegend 컴포넌트 사용
<div>
    <PromptLegend />
    {/* 출력:
        스타일 조명 카메라 구도 인물 배경 ! 문제
        (각 항목이 해당 색상으로 표시됨)
    */}
</div>
```

---

## 동작 흐름

### 요소별 분석 프로세스

```
사용자 입력 (프롬프트)
         ↓
  "요소 분석" 버튼 클릭
         ↓
handleAnalyzePromptByElement 실행
         ↓
buildElementAnalysisPrompt 생성
         ↓
API 호출 (Gemini/OpenAI)
         ↓
JSON 응답
         ↓
parseJsonFromText로 파싱
         ↓
ElementAnalysis 객체로 변환
         ↓
setPromptElementAnalysis 업데이트
         ↓
renderHighlightedByElement로 렌더링
         ↓
UI 표시 (색상 범례 + 하이라이트)
```

---

## API 응답 형식

### 입력
```json
{
    "service": "GEMINI",
    "prompt": "[빌드된 분석 프롬프트]",
    "maxTokens": 800,
    "temperature": 0.2,
    "freshChat": true
}
```

### 출력
```json
{
    "style": [
        "Cinematic photography",
        "Professional photography",
        "8k resolution",
        "masterpiece"
    ],
    "lighting": [
        "dramatic lighting"
    ],
    "camera": [
        "shallow depth of field"
    ],
    "composition": [],
    "character": [
        "A stunning Korean woman in her 20s",
        "dressed in a sleek black evening gown"
    ],
    "background": [
        "modern luxury penthouse with floor-to-ceiling windows",
        "city at night"
    ],
    "problems": [
        "중복: \"photography\" appears twice"
    ]
}
```

---

## 실제 사용 시나리오

### 시나리오 1: 프롬프트 최적화

```
단계 1: 프롬프트 입력
"A woman in red dress, red lips, red hair, wearing red jewelry,
red shoes, in a red room, red curtains, cinematic, cinematic,
professional, professional"

단계 2: "요소 분석" 실행
→ style: ["cinematic", "professional"]
→ problems: ["중복: cinematic (2회)", "중복: professional (2회)"]

단계 3: 문제 확인
→ "cinematic cinematic" → 빨간색 강조
→ 사용자가 하나 제거

단계 4: 수정 후 재분석
"A woman in red dress, red lips, red hair, wearing red jewelry,
red shoes, in a red room, red curtains, cinematic, professional"

단계 5: 최적화된 프롬프트로 이미지 생성
```

### 시나리오 2: 모순 탐지

```
프롬프트:
"bright sunlit beach, dark night scene, high noon, moonlight"

분석 결과:
→ lighting: ["bright sunlit", "high noon", "dark night", "moonlight"]
→ problems: ["모순: bright vs dark", "모순: sunlit vs moonlight"]

사용자는 문제를 보고 명확한 조명 선택
```

### 시나리오 3: 요소 분포 확인

```
프롬프트:
"woman, man, standing, sitting, looking, thinking, smiling,
happy, sad, angry, gorgeous, beautiful, stunning, amazing"

분석 결과:
→ character: ["woman", "man", ...]
→ problems: ["과도: 형용사 7개 사용", "중복: beautiful / gorgeous / stunning"]

사용자는 형용사를 1-2개로 축약하여 명확성 향상
```

---

## 커스터마이징 예제

### 새로운 요소 타입 추가

```typescript
// 1. ElementAnalysis에 추가
interface ElementAnalysis {
    // ... 기존 요소들
    emotion?: string[];  // 새로운 요소
}

// 2. colorMap에 색상 추가
export const colorMap = {
    // ... 기존 색상들
    emotion: 'bg-orange-500/30 text-orange-100'
};

// 3. buildElementAnalysisPrompt 수정
const prompt = [
    // ... 기존 내용
    '- emotion: 감정 관련 표현 (예: happy, sad, confident, vulnerable)',
    // ...
];

// 4. renderHighlightedByElement는 자동으로 처리됨
```

### 색상 체계 변경

```typescript
// 다크 모드 색상 설정
export const colorMap = {
    style: 'bg-indigo-700/50 text-indigo-100',
    lighting: 'bg-amber-700/50 text-amber-100',
    // ... 나머지 색상 조정
};
```

---

## 성능 최적화

### 1. 큰 프롬프트 처리

```typescript
// 프롬프트를 문장단위로 분할
const sentences = prompt.split(/[.!?。！？]+/);
const renderedSentences = sentences.map(sentence =>
    renderHighlightedByElement(sentence, analysis)
);
```

### 2. 재렌더링 최소화

```typescript
// useCallback 사용
const memoizedAnalysis = useCallback(() => {
    // ... 분석 로직
}, [promptEditOriginal, targetService]);

// useMemo로 렌더링 결과 캐싱
const memoizedHighlight = useMemo(() =>
    renderHighlightedByElement(text, analysis),
    [text, analysis]
);
```

### 3. 느린 네트워크 대응

```typescript
// 타임아웃 설정
const timeoutId = window.setTimeout(() => controller.abort(), 45000);

// 재시도 로직
const retryAnalysis = useCallback(async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await handleAnalyzePromptByElement();
            return;
        } catch (error) {
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }
    }
}, [handleAnalyzePromptByElement]);
```

---

## 에러 처리

### 예상 가능한 에러

| 에러 | 원인 | 해결책 |
|------|------|-------|
| `응답 시간이 길어 중단됨` | 타임아웃 | 네트워크 확인, API 재시도 |
| `JSON 파싱 실패` | 응답 형식 오류 | 프롬프트 재구성, 온도 조정 |
| `원본 프롬프트가 비어있습니다` | 입력값 없음 | 프롬프트 입력 확인 |
| `API 오류: 400` | 잘못된 요청 | 프롬프트 길이 확인 (maxTokens) |
| `API 오류: 401` | 인증 실패 | API 키 확인 |

---

## 테스트 케이스

### 테스트 1: 기본 분석

```typescript
const testPrompt = "A beautiful woman in a red dress";
const result = await handleAnalyzePromptByElement();
expect(result.character).toContain("woman");
expect(result.style).toContain("beautiful");
```

### 테스트 2: 문제 탐지

```typescript
const testPrompt = "cinematic cinematic cinematic";
const result = await handleAnalyzePromptByElement();
expect(result.problems).toContain("중복");
```

### 테스트 3: 하이라이트 렌더링

```typescript
const analysis = {
    style: ["cinematic"],
    character: ["woman"]
};
const output = renderHighlightedByElement(
    "A woman in cinematic style",
    analysis
);
expect(output).toContain("bg-purple"); // cinematic (style)
expect(output).toContain("bg-pink");   // woman (character)
```

---

## 통합 체크리스트

- [ ] `utils/promptHighlightSystem.tsx` 생성
- [ ] `hooks/usePromptEditModal.ts` 생성
- [ ] `components/PromptEditModal.tsx` 생성
- [ ] ShortsLabPanel.tsx에 import 추가
- [ ] 상태 변수 추가 (5개)
- [ ] Hook 사용 추가
- [ ] 열기/닫기 함수 추가
- [ ] 모달 렌더링 추가
- [ ] 빌드 테스트 (npm run build)
- [ ] 런타임 테스트 (npm run dev)
- [ ] UI/UX 검증
- [ ] API 통신 테스트

---

## 다음 단계

1. **고급 분석 기능**
   - 점수 계산 (0-100점)
   - 개선 제안 자동 생성
   - 프롬프트 자동 최적화

2. **추가 UI 기능**
   - 병렬 비교 뷰
   - 버전 히스토리
   - 즐겨찾기 프롬프트

3. **AI 기능 확장**
   - 다중 언어 지원
   - 스타일별 분석
   - 사전 정의된 템플릿

---

이제 실제 프로젝트에 통합하여 사용할 수 있습니다!

# 프롬프트 요소별 하이라이트 시스템 가이드

## 개요

프롬프트의 각 요소를 다른 색상으로 하이라이트하여 프롬프트 구조를 시각적으로 분석할 수 있는 시스템입니다. 이를 통해 프롬프트의 품질을 개선하고 중복이나 모순된 표현을 쉽게 발견할 수 있습니다.

---

## 파일 구조

### 1. **utis/promptHighlightSystem.tsx** - 핵심 로직
- 요소별 하이라이트 렌더링 함수
- 범례(Legend) 컴포넌트
- 요소별 분석 프롬프트 생성
- 색상 맵 정의

### 2. **hooks/usePromptEditModal.ts** - 훅
- AI를 통한 요소별 분석 로직
- API 통신 및 JSON 파싱

### 3. **components/PromptEditModal.tsx** - UI 컴포넌트
- 프롬프트 수정 모달 인터페이스
- 원본 및 수정 프롬프트 표시
- 요소별 분석 결과 시각화

### 4. **components/ShortsLabPanel.tsx** - 통합
- 상태 관리
- 모달 열기/닫기 함수
- 분석 결과 관리

---

## 색상 정의

각 요소는 구분하기 쉬운 색상으로 표시됩니다:

| 요소 | 색상 | CSS 클래스 |
|------|------|----------|
| 스타일 | 보라색 | `bg-purple-500/30 text-purple-100` |
| 조명 | 노란색 | `bg-yellow-500/30 text-yellow-100` |
| 카메라 | 파란색 | `bg-blue-500/30 text-blue-100` |
| 구도 | 녹색 | `bg-green-500/30 text-green-100` |
| 인물 | 핑크 | `bg-pink-500/30 text-pink-100` |
| 배경 | 시안 | `bg-cyan-500/30 text-cyan-100` |
| 문제 | 빨간색 | `bg-red-500/40 text-red-100 font-bold` |

---

## 사용 방법

### 프롬프트 수정 모달 열기

```typescript
// ShortsLabPanel에서
openPromptEditModal(sceneNumber, currentPrompt);
```

### 요소별 분석 실행

1. 모달의 "요소 분석" 버튼 클릭
2. AI가 프롬프트를 다음 요소로 분석:
   - **style**: 화풍, 렌더링 스타일, 아트 스타일
   - **lighting**: 조명 관련 표현
   - **camera**: 카메라 앵글, 렌즈, 프레이밍
   - **composition**: 구도, 배치, 레이아웃
   - **character**: 인물 관련 표현
   - **background**: 배경 관련 표현
   - **problems**: 중복되거나 모순되는 표현

### 분석 결과 확인

- **범례**: 상단의 색상 범례로 각 요소를 확인
- **하이라이트**: 프롬프트 텍스트에서 각 요소가 색상으로 표시됨
- **문제 표시**: 빨간색으로 표시된 문제 항목 확인
- **호버 정보**: 각 문제에 호버하면 설명 표시

---

## API 명세

### renderHighlightedByElement

프롬프트 텍스트를 요소별로 하이라이트하여 렌더링합니다.

```typescript
renderHighlightedByElement(text: string, analysis: ElementAnalysis): React.ReactNode
```

**인자:**
- `text`: 프롬프트 텍스트
- `analysis`: 요소별 분석 결과 객체

**반환:**
- React 컴포넌트

**예제:**
```tsx
const analysis: ElementAnalysis = {
    style: ['cinematic', 'photorealistic'],
    lighting: ['dramatic lighting'],
    camera: ['close-up', '50mm lens'],
    composition: ['rule of thirds'],
    character: ['woman', 'Korean'],
    background: ['urban background'],
    problems: ['중복: cinematic', 'cinematic']
};

render(renderHighlightedByElement(prompt, analysis));
```

### buildElementAnalysisPrompt

AI에 보낼 요소별 분석 프롬프트를 생성합니다.

```typescript
buildElementAnalysisPrompt(originalPrompt: string): string
```

**인자:**
- `originalPrompt`: 분석할 프롬프트

**반환:**
- AI에 전송할 프롬프트 문자열

### PromptLegend 컴포넌트

색상 범례를 표시하는 컴포넌트입니다.

```tsx
<PromptLegend />
```

---

## 통합 가이드

### 기존 컴포넌트에 추가하기

```typescript
import { renderHighlightedByElement, PromptLegend, ElementAnalysis } from '../utils/promptHighlightSystem';
import { usePromptEditModal } from '../hooks/usePromptEditModal';

// 상태 추가
const [showModal, setShowModal] = useState(false);
const [analysis, setAnalysis] = useState<ElementAnalysis>({});

// Hook 사용
const { handleAnalyzePromptByElement } = usePromptEditModal({
    promptEditOriginal: originalPrompt,
    promptEditLoading: isLoading,
    targetService,
    setPromptEditLoading: setIsLoading,
    setPromptEditError: setError,
    setPromptElementAnalysis: setAnalysis
});

// 렌더링
return (
    <div>
        <PromptLegend />
        {renderHighlightedByElement(prompt, analysis)}
    </div>
);
```

---

## 분석 프롬프트 예제

AI에 전송되는 프롬프트 구조:

```
당신은 이미지 프롬프트 분석가입니다.
주어진 프롬프트를 다음 요소별로 분석하여 각 요소에 해당하는 텍스트를 추출하세요.

요소 정의:
- style: 화풍, 렌더링 스타일, 아트 스타일 (예: cinematic, photorealistic, oil painting)
- lighting: 조명 관련 표현 (예: dramatic lighting, soft lighting, neon lights)
- camera: 카메라 앵글, 렌즈, 프레이밍 (예: close-up, wide shot, 50mm lens)
- composition: 구도, 배치, 레이아웃 (예: rule of thirds, centered composition)
- character: 인물 관련 표현 (예: woman, Korean, dressed in red)
- background: 배경 관련 표현 (예: urban background, forest, night sky)
- problems: 중복된 표현이나 모순되는 표현 (예: "cinematic cinematic")

출력 형식: 다음 JSON만 출력하세요:
{
  "style": ["항목1", "항목2", ...],
  "lighting": ["항목1", ...],
  "camera": ["항목1", ...],
  "composition": ["항목1", ...],
  "character": ["항목1", ...],
  "background": ["항목1", ...],
  "problems": ["문제1", "문제2", ...]
}

프롬프트:
[사용자의 프롬프트]
```

---

## 문제 식별

시스템이 자동으로 다음과 같은 문제를 식별합니다:

### 1. **중복 (Duplication)**
같은 표현이 여러 번 반복된 경우
- 예: "cinematic cinematic photorealistic"

### 2. **모순 (Contradiction)**
서로 다르거나 충돌하는 표현이 있는 경우
- 예: "bright daylight, dark night"

### 3. **불명확 (Ambiguity)**
표현이 불명확하거나 애매한 경우
- 예: "something nice"

### 4. **과도함 (Excess)**
같은 스타일의 표현이 너무 많은 경우
- 예: "cinematic, dramatic, epic, high impact, powerful, intense"

### 5. **문법 오류 (Grammar)**
문법이 잘못된 경우
- 예: "woman in red dress standing in"

---

## 개발자 가이드

### TypeScript 타입

```typescript
interface ElementAnalysis {
    style?: string[];
    lighting?: string[];
    camera?: string[];
    composition?: string[];
    character?: string[];
    background?: string[];
    problems?: string[];
}
```

### 커스터마이징 색상

`utils/promptHighlightSystem.tsx`의 `colorMap`을 수정하세요:

```typescript
export const colorMap = {
    style: 'bg-[원하는색] text-[텍스트색]',
    // ...
};
```

### 새로운 요소 추가

1. `ElementAnalysis` 인터페이스에 새 속성 추가
2. `colorMap`에 새 색상 정의
3. `buildElementAnalysisPrompt`에 설명 추가
4. `renderHighlightedByElement`에 매핑 추가

---

## 트러블슈팅

### 분석이 실패하는 경우

1. 프롬프트가 비어있지 않은지 확인
2. API 연결 확인 (http://localhost:3002/api/generate/raw)
3. 토큰 제한 확인 (maxTokens: 800)
4. 서비스 선택 확인 (GEMINI, OpenAI 등)

### 하이라이트가 표시되지 않는 경우

1. 분석 결과가 유효한 JSON인지 확인
2. 프롬프트 텍스트가 분석 결과의 용어를 포함하는지 확인
3. 정규표현식 이스케이핑 확인

### 렌더링 성능 문제

- 프롬프트 길이가 매우 긴 경우, 텍스트를 분할하여 표시
- 요소 개수가 많은 경우, details 요소로 접기/펼치기 구현

---

## 버전 정보

- **생성일**: 2025-02-01
- **최신 버전**: 1.0.0
- **호환성**: React 18+, TypeScript 4.5+

---

## 참고

- 색상은 접근성을 고려하여 선택됨
- 하이라이트는 대소문자를 구분하지 않음
- 정규표현식 특수문자는 자동으로 이스케이프됨
- 분석 프롬프트는 한국어로 작성되어 한국형 AI 모델 최적화

# 프롬프트 분석 및 스타일 변환 API 사용법

## 개요
server/index.js에 추가된 2개의 새로운 API 엔드포인트입니다.

---

## 1. 프롬프트 상세 분석 API

### 엔드포인트
```
POST /api/prompt-analyze-detailed
```

### 요청 본문 (Request Body)
```json
{
  "prompt": "분석할 프롬프트 텍스트",
  "service": "GEMINI"  // 선택사항: GEMINI, CLAUDE, CHATGPT, GENSPARK (기본값: GEMINI)
}
```

### 응답 (Response)
```json
{
  "success": true,
  "analysis": {
    "style": "스타일 분석 내용 (예: photorealistic, anime, cartoon 등)",
    "lighting": "조명 분석 (예: natural light, studio lighting 등)",
    "camera": "카메라 앵글 분석 (예: close-up, wide shot 등)",
    "composition": "구도 분석 (예: rule of thirds, centered 등)",
    "character": "인물 묘사 분석 (외모, 옷차림, 포즈, 표정 등)",
    "background": "배경 설정 분석 (장소, 환경, 분위기 등)",
    "problems": [
      "문제점1: 중복된 표현",
      "문제점2: 불명확한 표현",
      "문제점3: 정책 위반 가능성"
    ],
    "score": 8,
    "scoreReason": "평가 이유 설명",
    "suggestions": [
      "개선 제안1",
      "개선 제안2",
      "개선 제안3"
    ]
  },
  "service": "GEMINI"
}
```

### 사용 예시 (JavaScript)
```javascript
const response = await fetch('http://localhost:3002/api/prompt-analyze-detailed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A beautiful woman in a red dress, standing in a garden, sunset lighting',
    service: 'GEMINI'
  })
});

const data = await response.json();
console.log('분석 결과:', data.analysis);
console.log('점수:', data.analysis.score);
console.log('문제점:', data.analysis.problems);
console.log('개선 제안:', data.analysis.suggestions);
```

---

## 2. 스타일 변환 API

### 엔드포인트
```
POST /api/prompt-style-convert
```

### 요청 본문 (Request Body)
```json
{
  "prompt": "변환할 원본 프롬프트",
  "targetStyle": "pixar",  // 목표 스타일: pixar, photo, anime, cartoon, 3d-render, oil-painting 등
  "service": "GEMINI"      // 선택사항: GEMINI, CLAUDE, CHATGPT, GENSPARK (기본값: GEMINI)
}
```

### 응답 (Response)
```json
{
  "success": true,
  "original": "원본 프롬프트",
  "targetStyle": "pixar",
  "result": {
    "prompt": "변환된 전체 프롬프트",
    "changes": [
      "변경사항1: photorealistic → Pixar 3D animation style",
      "변경사항2: natural lighting → warm, soft studio lighting",
      "변경사항3: detailed textures → smooth, stylized textures"
    ],
    "highlights": {
      "style": "Pixar 3D animation style, CGI rendering, character design",
      "lighting": "warm studio lighting, soft shadows, ambient occlusion",
      "texture": "smooth surfaces, stylized details, vibrant colors",
      "colorPalette": "saturated colors, warm tones, Pixar color grading",
      "camera": "cinematic framing, slight depth of field"
    }
  },
  "service": "GEMINI"
}
```

### 사용 예시 (JavaScript)
```javascript
const response = await fetch('http://localhost:3002/api/prompt-style-convert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A beautiful woman in a red dress, standing in a garden, sunset lighting',
    targetStyle: 'pixar',
    service: 'CLAUDE'
  })
});

const data = await response.json();
console.log('변환된 프롬프트:', data.result.prompt);
console.log('변경 사항:', data.result.changes);
console.log('스타일 하이라이트:', data.result.highlights);
```

---

## 지원 스타일 예시

### 일반적인 스타일
- `photorealistic` - 사진 사실주의
- `anime` - 애니메이션 스타일
- `cartoon` - 카툰 스타일
- `pixar` - 픽사 3D 애니메이션
- `3d-render` - 3D 렌더링
- `oil-painting` - 유화 스타일
- `watercolor` - 수채화 스타일
- `sketch` - 스케치/드로잉
- `cyberpunk` - 사이버펑크
- `fantasy` - 판타지 아트
- `retro` - 레트로/빈티지

---

## 에러 처리

### 에러 응답 형식
```json
{
  "error": "오류 메시지",
  "details": "상세 스택 트레이스 (디버깅용)",
  "rawResponse": "AI 응답 원본 (파싱 실패시)"
}
```

### 일반적인 에러 코드
- `400` - 잘못된 요청 (prompt 누락 등)
- `500` - 서버 오류 (AI 응답 실패, 파싱 오류 등)

---

## 구현 특징

### 1. AI 서비스 선택
- GEMINI (기본값)
- CLAUDE
- CHATGPT
- GENSPARK
- 서비스를 지정하지 않으면 자동으로 GEMINI 사용

### 2. 타임아웃
- 60초 (60000ms)
- AI 응답이 60초 이내에 도착하지 않으면 타임아웃

### 3. JSON 파싱
- 코드 블록 자동 제거 (```json ... ```)
- 파싱 실패시 jsonrepair 라이브러리로 복구 시도
- 복구 실패시 에러 응답 및 원본 텍스트 일부 반환

### 4. 로깅
- 각 단계마다 콘솔 로그 출력
- `[PromptAnalyzer]`, `[StyleConverter]` 접두사로 구분

### 5. 신선한 대화 (Fresh Chat)
- 각 요청마다 `freshChat: true` 옵션 사용
- 이전 대화 컨텍스트 영향 없이 독립적으로 실행

---

## 통합 예시

### React Component에서 사용
```javascript
import { useState } from 'react';

function PromptAnalyzer() {
  const [prompt, setPrompt] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [converted, setConverted] = useState(null);

  const analyzePrompt = async () => {
    const res = await fetch('http://localhost:3002/api/prompt-analyze-detailed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, service: 'GEMINI' })
    });
    const data = await res.json();
    setAnalysis(data.analysis);
  };

  const convertStyle = async (targetStyle) => {
    const res = await fetch('http://localhost:3002/api/prompt-style-convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, targetStyle, service: 'CLAUDE' })
    });
    const data = await res.json();
    setConverted(data.result);
  };

  return (
    <div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} />
      <button onClick={analyzePrompt}>분석</button>
      <button onClick={() => convertStyle('pixar')}>Pixar 스타일로 변환</button>

      {analysis && (
        <div>
          <h3>분석 결과</h3>
          <p>점수: {analysis.score}/10</p>
          <p>문제점: {analysis.problems.join(', ')}</p>
          <p>개선 제안: {analysis.suggestions.join(', ')}</p>
        </div>
      )}

      {converted && (
        <div>
          <h3>변환된 프롬프트</h3>
          <p>{converted.prompt}</p>
          <p>변경사항: {converted.changes.join(', ')}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 참고사항

1. **브라우저 준비**: API 호출 전에 브라우저가 준비되어 있어야 합니다. `ensureBrowserReady()` 함수가 자동으로 처리합니다.

2. **응답 시간**: AI 서비스에 따라 응답 시간이 다를 수 있습니다. 일반적으로 10-30초 소요됩니다.

3. **병렬 처리**: 동시에 여러 요청을 보내면 브라우저 세션이 충돌할 수 있으므로 순차적으로 처리하는 것을 권장합니다.

4. **캐싱**: 같은 프롬프트에 대해 반복 요청시 `freshChat: true` 옵션으로 인해 매번 새로운 응답을 받습니다.

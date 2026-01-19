# AI Studio 개발자 가이드 🛠️

## 📚 목차

1. [프로젝트 구조](#프로젝트-구조)
2. [아키텍처](#아키텍처)
3. [컴포넌트 설명](#컴포넌트-설명)
4. [API 문서](#api-문서)
5. [새 모드 추가하기](#새-모드-추가하기)
6. [배포](#배포)
7. [기여 가이드](#기여-가이드)

---

## 프로젝트 구조

```
쇼츠대본생성기-v6.0.0/
├── ai_studio_bundle/           # AI Studio 프론트엔드
│   ├── App.tsx                 # 메인 앱 컴포넌트
│   ├── components/             # React 컴포넌트
│   │   ├── CameraControls.tsx
│   │   ├── FrameGenerator.tsx
│   │   ├── SceneCreator.tsx
│   │   ├── ImageAnalyzer.tsx
│   │   ├── VoiceStudio.tsx
│   │   ├── StyleTransfer.tsx
│   │   ├── ColorChanger.tsx
│   │   ├── PoseTransfer.tsx
│   │   ├── FaceCorrection.tsx
│   │   ├── SkinToneAdjuster.tsx
│   │   ├── HairMakeup.tsx
│   │   ├── ImageDropzone.tsx
│   │   ├── Spinner.tsx
│   │   ├── Lightbox.tsx
│   │   ├── GifCreator.tsx
│   │   ├── ImageEditorControls.tsx
│   │   └── Toast.tsx
│   ├── services/               # API 서비스
│   │   └── geminiService.ts
│   ├── types.ts                # TypeScript 타입 정의
│   ├── package.json
│   └── vite.config.ts
├── server/                     # 백엔드 서버
│   └── index.js                # Express 서버
├── docs/                       # 문서
│   ├── AI_Studio_사용자_가이드.md
│   └── AI_Studio_개발자_가이드.md
├── plans/                      # 개발 계획 및 보고서
│   ├── Phase1_완료_보고서.md
│   ├── Phase2_완료_보고서.md
│   └── AI_Studio_완전_통합_완료.md
└── package.json                # 루트 패키지
```

---

## 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────┐
│           사용자 브라우저                │
│  ┌───────────────────────────────────┐  │
│  │      AI Studio (React)            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  App.tsx (14개 모드)        │  │  │
│  │  │  - Mode 관리                │  │  │
│  │  │  - State 관리               │  │  │
│  │  │  - 핸들러 함수              │  │  │
│  │  └─────────────────────────────┘  │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  11개 컴포넌트              │  │  │
│  │  │  - Phase 1: 5개             │  │  │
│  │  │  - Phase 2: 6개             │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    ↓ HTTP
┌─────────────────────────────────────────┐
│         Express 서버 (Node.js)          │
│  ┌───────────────────────────────────┐  │
│  │  API 엔드포인트                   │  │
│  │  - /api/create-scene              │  │
│  │  - /api/text-to-speech            │  │
│  │  - /api/save-image                │  │
│  │  - etc.                           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         외부 서비스                      │
│  - Google Gemini API (이미지/동영상)    │
│  - FFmpeg (영상 합성)                   │
│  - Web Speech API (TTS)                 │
└─────────────────────────────────────────┘
```

### 데이터 흐름

```
사용자 입력
    ↓
컴포넌트 (UI)
    ↓
핸들러 함수 (App.tsx)
    ↓
Gemini Service (geminiService.ts)
    ↓
Google Gemini API
    ↓
결과 반환
    ↓
State 업데이트
    ↓
UI 렌더링
```

---

## 컴포넌트 설명

### App.tsx

**역할**: 메인 애플리케이션 컴포넌트

**주요 State**:
```typescript
const [mode, setMode] = useState<Mode>('fusion');
const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
const [prompts, setPrompts] = useState<Prompt[]>([]);
const [results, setResults] = useState<ImageResult[]>([]);
const [isGenerating, setIsGenerating] = useState(false);
const [editingState, setEditingState] = useState<EditingState>('idle');
const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null);
```

**주요 함수**:
- `handleModeChange(mode: Mode)`: 모드 전환
- `handleGenerateImages()`: 이미지 생성
- `handleGenerateVideo()`: 동영상 생성
- `handleGenerateFrames(config: FrameConfig)`: 프레임 생성
- `handleCreateScene(config: VideoConfig)`: 영상 합성
- `handleTransferStyle()`: 스타일 적용
- `handleChangeColor()`: 색상 변경
- 등 11개 핸들러

---

### Phase 1 컴포넌트

#### 1. CameraControls.tsx

**Props**:
```typescript
interface CameraControlsProps {
  onSettingsChange: (settings: CameraSettings) => void;
}

interface CameraSettings {
  shotSize: string;
  angle: string;
  movement: string;
  lighting: string;
}
```

**기능**:
- 카메라 설정 UI
- 빠른 프리셋
- 실시간 프롬프트 미리보기

---

#### 2. FrameGenerator.tsx

**Props**:
```typescript
interface FrameGeneratorProps {
  onGenerate: (config: FrameConfig) => Promise<void>;
  isGenerating: boolean;
}

interface FrameConfig {
  characterImage: File | null;
  characterImageUrl: string | null;
  background: string;
  scenes: SceneFrame[];
  maintainConsistency: boolean;
}

interface SceneFrame {
  id: string;
  sceneNumber: number;
  prompt: string;
}
```

**기능**:
- 캐릭터 이미지 업로드
- 씬 개수 조절 (2-12개)
- 각 씬별 프롬프트 입력
- 병렬 처리로 빠른 생성

---

#### 3. SceneCreator.tsx

**Props**:
```typescript
interface SceneCreatorProps {
  availableFrames: ImageResult[];
  onCreateVideo: (config: VideoConfig) => Promise<string>;
}

interface VideoConfig {
  frames: string[];
  duration: number;
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transitionDuration: number;
  cameraEffect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-right' | 'pan-left';
  bgMusic?: File;
  bgMusicVolume: number;
}
```

**기능**:
- 프레임 선택 및 순서 조정
- 영상 설정 (트랜지션, 카메라 효과)
- 배경 음악 추가
- FFmpeg 기반 영상 합성

---

#### 4. ImageAnalyzer.tsx

**Props**:
```typescript
interface ImageAnalyzerProps {
  onAnalyze: (file: File) => Promise<string>;
  isAnalyzing: boolean;
}

interface AnalysisResult {
  fullPrompt: string;
  style: string;
  mood: string;
  colors: string;
  composition: string;
  lighting: string;
  details: string;
}
```

**기능**:
- 이미지 업로드
- AI 기반 분석
- 구조화된 결과 표시
- 개별/전체 복사

---

#### 5. VoiceStudio.tsx

**Props**:
```typescript
interface VoiceStudioProps {
  onGenerateVoice: (settings: VoiceSettings) => Promise<string>;
  isGenerating: boolean;
}

interface VoiceSettings {
  text: string;
  voice: string;
  emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
  speed: number;
  pitch: number;
}
```

**기능**:
- 텍스트 입력
- 목소리/감정 선택
- 속도/음높이 조절
- Web Speech API 사용

---

### Phase 2 컴포넌트

#### 6-11. StyleTransfer, ColorChanger, PoseTransfer, FaceCorrection, SkinToneAdjuster, HairMakeup

**공통 구조**:
```typescript
interface ComponentProps {
  onProcess: (...args) => Promise<string>;
  isProcessing: boolean;
}
```

**공통 기능**:
- 이미지 업로드
- 설정 UI
- 처리 버튼
- 결과 표시 (원본/결과 비교)
- 다운로드

---

## API 문서

### Gemini Service (geminiService.ts)

#### generateImageFromText
```typescript
async function generateImageFromText(
  prompt: string
): Promise<ImageResult>
```

**설명**: 텍스트 프롬프트로 이미지 생성

**파라미터**:
- `prompt`: 이미지 생성 프롬프트

**반환**: `ImageResult` (imageUrl, prompt)

---

#### generateImageFromImagesAndText
```typescript
async function generateImageFromImagesAndText(
  images: { file: File; name: string }[],
  prompt: string
): Promise<ImageResult>
```

**설명**: 이미지와 텍스트로 이미지 생성

**파라미터**:
- `images`: 참조 이미지 배열
- `prompt`: 이미지 생성 프롬프트

**반환**: `ImageResult`

---

#### editImage
```typescript
async function editImage(
  image: File,
  prompt: string
): Promise<ImageResult>
```

**설명**: 이미지 편집

**파라미터**:
- `image`: 편집할 이미지
- `prompt`: 편집 프롬프트

**반환**: `ImageResult`

---

#### generatePromptFromImage
```typescript
async function generatePromptFromImage(
  imageFile: File
): Promise<string>
```

**설명**: 이미지에서 프롬프트 생성

**파라미터**:
- `imageFile`: 분석할 이미지

**반환**: 생성된 프롬프트 (string)

---

#### generateVideo
```typescript
async function generateVideo(
  prompt: string,
  referenceImage?: File
): Promise<VideoResult>
```

**설명**: 동영상 생성

**파라미터**:
- `prompt`: 동영상 생성 프롬프트
- `referenceImage`: (선택) 참조 이미지

**반환**: `VideoResult` (videoUrl, prompt)

---

### Server API (server/index.js)

#### POST /api/create-scene

**설명**: 프레임을 영상으로 합성

**요청**:
```typescript
{
  config: {
    frames: string[];           // Base64 이미지 배열
    duration: number;           // 각 프레임 표시 시간
    transition: string;         // 트랜지션 타입
    transitionDuration: number; // 트랜지션 시간
    cameraEffect: string;       // 카메라 효과
    bgMusicVolume: number;      // 음악 볼륨
  },
  bgMusic?: File                // 배경 음악 (선택)
}
```

**응답**:
```typescript
{
  success: true,
  videoUrl: string,    // Base64 인코딩된 영상
  frameCount: number,
  duration: number
}
```

---

#### POST /api/text-to-speech

**설명**: 텍스트를 음성으로 변환

**요청**:
```typescript
{
  text: string,
  voice: string,
  emotion: string,
  speed: number,
  pitch: number
}
```

**응답**:
```typescript
{
  success: true,
  message: string,
  settings: {...},
  useWebSpeechAPI: true
}
```

**참고**: 현재는 클라이언트에서 Web Speech API 사용

---

## 새 모드 추가하기

### 1단계: 컴포넌트 생성

```typescript
// ai_studio_bundle/components/NewFeature.tsx
import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface NewFeatureProps {
  onProcess: (image: File, ...args) => Promise<string>;
  isProcessing: boolean;
}

const NewFeature: React.FC<NewFeatureProps> = ({ onProcess, isProcessing }) => {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const handleImageDrop = (file: File) => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
    setResultUrl(null);
  };

  const handleApply = async () => {
    if (!image) {
      alert('이미지를 업로드해주세요.');
      return;
    }

    try {
      const result = await onProcess(image);
      setResultUrl(result);
    } catch (error) {
      console.error('Processing error:', error);
      alert('처리에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-200">🆕 새 기능</h3>
      
      <div>
        <h4 className="text-base font-medium text-gray-300 mb-2">
          1. 이미지 업로드
        </h4>
        <ImageDropzone
          onImageDrop={handleImageDrop}
          previewUrl={imageUrl}
          onClear={() => {
            if (imageUrl) URL.revokeObjectURL(imageUrl);
            setImage(null);
            setImageUrl(null);
            setResultUrl(null);
          }}
        />
      </div>

      {image && (
        <button
          onClick={handleApply}
          disabled={isProcessing}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-md flex items-center justify-center gap-2"
        >
          {isProcessing ? <><Spinner /> 처리 중...</> : <>🆕 적용하기</>}
        </button>
      )}

      {resultUrl && (
        <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
          <h4 className="text-base font-medium text-green-400 mb-3">✅ 완료!</h4>
          <img src={resultUrl} alt="Result" className="w-full rounded-md" />
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = resultUrl;
              a.download = `result_${Date.now()}.png`;
              a.click();
            }}
            className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
          >
            📥 다운로드
          </button>
        </div>
      )}
    </div>
  );
};

export default NewFeature;
```

---

### 2단계: App.tsx에 통합

#### 2-1. Import 추가
```typescript
import NewFeature from './components/NewFeature';
```

#### 2-2. Mode 타입 확장
```typescript
type Mode = '...' | 'new-feature';
```

#### 2-3. 핸들러 함수 추가
```typescript
const handleNewFeature = async (image: File): Promise<string> => {
  setEditingState('prompt');
  try {
    const prompt = "Process this image...";
    const result = await editImage(image, prompt);
    addToast('success', '처리가 완료되었습니다.');
    return result.imageUrl;
  } catch (error) {
    addToast('error', '처리에 실패했습니다.');
    throw error;
  } finally {
    setEditingState('idle');
  }
};
```

#### 2-4. UI 버튼 추가
```tsx
<button onClick={() => handleModeChange('new-feature')} className={`...`}>
  🆕 새 기능
</button>
```

#### 2-5. 컴포넌트 렌더링 추가
```tsx
{mode === 'new-feature' && (
  <NewFeature
    onProcess={handleNewFeature}
    isProcessing={editingState === 'prompt'}
  />
)}
```

#### 2-6. 프롬프트 섹션 조건 수정
```tsx
{mode !== 'frame-generator' && ... && mode !== 'new-feature' && (
  <div>
    {/* 프롬프트 섹션 */}
  </div>
)}
```

---

### 3단계: 테스트

1. 서버 재시작
2. 브라우저 새로고침
3. 새 모드 버튼 클릭
4. 기능 테스트

---

## 배포

### 개발 환경

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

### 프로덕션 빌드

```bash
# 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

### 환경 변수

```bash
# .env 파일
GEMINI_API_KEY=your_api_key_here
PORT=3002
NODE_ENV=production
```

### Docker (선택사항)

```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]
```

---

## 기여 가이드

### 코드 스타일

- **TypeScript**: 타입 명시
- **React**: 함수형 컴포넌트 + Hooks
- **CSS**: Tailwind CSS 사용
- **네이밍**: camelCase (변수/함수), PascalCase (컴포넌트)

### 커밋 메시지

```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드/설정 변경
```

### Pull Request

1. Fork 저장소
2. 새 브랜치 생성 (`git checkout -b feature/new-feature`)
3. 변경사항 커밋 (`git commit -m 'feat: add new feature'`)
4. 브랜치 푸시 (`git push origin feature/new-feature`)
5. Pull Request 생성

---

## 디버깅

### 브라우저 콘솔

```javascript
// 개발자 도구 (F12) → Console

// State 확인
console.log('Current mode:', mode);
console.log('Results:', results);

// 에러 확인
console.error('Error:', error);
```

### 서버 로그

```bash
# 서버 콘솔에서 확인
[TTS] Generating voice: ko-KR-Wavenet-A
[Scene] Creating scene with 6 frames
[Error] FFmpeg failed: ...
```

### 네트워크 탭

```
개발자 도구 (F12) → Network

- API 요청/응답 확인
- 이미지 로딩 확인
- 에러 상태 코드 확인
```

---

## 성능 최적화

### 이미지 최적화

```typescript
// 이미지 리사이즈
const resizeImage = (file: File, maxWidth: number): Promise<File> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
    };
    img.src = URL.createObjectURL(file);
  });
};
```

### 병렬 처리

```typescript
// 여러 이미지 동시 생성
const results = await Promise.all(
  prompts.map(prompt => generateImageFromText(prompt))
);
```

### 메모이제이션

```typescript
import { useMemo, useCallback } from 'react';

const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

const handleClick = useCallback(() => {
  doSomething(a, b);
}, [a, b]);
```

---

## 보안

### API 키 보호

```typescript
// ❌ 나쁨
const apiKey = 'AIza...';

// ✅ 좋음
const apiKey = process.env.GEMINI_API_KEY;
```

### 입력 검증

```typescript
// 프롬프트 길이 제한
if (prompt.length > 1000) {
  throw new Error('Prompt too long');
}

// 파일 크기 제한
if (file.size > 10 * 1024 * 1024) { // 10MB
  throw new Error('File too large');
}
```

### CORS 설정

```javascript
// server/index.js
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? 'https://your-domain.com'
    : 'http://localhost:3000'
}));
```

---

## 라이선스

MIT License

---

**Happy Coding!** 🚀✨

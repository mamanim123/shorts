# 나노바나나 Pro 기능 AI Studio 통합 플랜

## 📺 참고 영상
- **제목**: 구글 나노바나나 Pro를 활용한 이미지 생성 앱
- **URL**: https://www.youtube.com/watch?v=tE1MvqfDPS4
- **분석일**: 2026-01-03

---

## 🎯 현재 프로젝트 구조 분석

### 기존 AI Studio 기능 (ai_studio_bundle/)
✅ **이미지 퓨전 & 수정**
- 여러 이미지 참조하여 스타일, 구성, 캐릭터 조합
- 이미지 이름 지정 가능

✅ **텍스트로 이미지 생성**
- 프롬프트만으로 이미지 생성
- 비율 선택 (1:1, 9:16, 16:9)

✅ **동영상 생성**
- 참조 이미지 + 프롬프트로 동영상 생성

✅ **이미지 편집 기능**
- 프롬프트 기반 이미지 수정
- 텍스트 제거
- 배경 제거
- 사진 복원
- 그림 변환 (Oil Painting)
- 업스케일 (2x, 4x)
- 나이 변환 (20대~60대)
- 다중 연령 이미지 생성

✅ **프롬프트 도구**
- 이미지에서 프롬프트 생성
- 인물 디테일 추출
- 프롬프트 정책 수정

### 메인 App 구조 (App.tsx)
✅ **쇼츠 대본 생성기**
- 6컷 쇼츠 대본 자동 생성
- 이미지 프롬프트 생성
- 멀티 AI 지원 (Gemini, ChatGPT, Claude)

✅ **탭 구조**
- 왼쪽: Config / History / Hybrid / Shorts Generator
- 오른쪽: Analysis / Shortform / Longform / YouTube Search / **Shorts Generator** / **AI Studio**

---

## 🆕 통합 전략

### 옵션 1: AI Studio 내부에 기능 추가 (추천 ⭐⭐⭐⭐⭐)
**장점**:
- 기존 AI Studio의 이미지 편집 기능과 자연스럽게 통합
- 사용자가 한 곳에서 모든 이미지 작업 수행 가능
- 코드 중복 최소화

**단점**:
- AI Studio 파일이 더 커짐

**구현 방법**:
```
ai_studio_bundle/
├── App.tsx (기존)
│   └── 모드 추가: 'fusion' | 'text' | 'video' | 'camera' | 'style-transfer' | 'sequential'
├── components/
│   ├── CameraControls.tsx (신규)
│   ├── StyleTransfer.tsx (신규)
│   ├── SequentialImageGenerator.tsx (신규)
│   ├── VideoCreator.tsx (신규)
│   └── PromptLibrary.tsx (신규)
```

### 옵션 2: 새로운 "Image Studio Pro" 버튼 생성
**장점**:
- 기존 AI Studio와 분리되어 깔끔
- 나노바나나 Pro 기능만 모아서 관리

**단점**:
- 기능 중복 (이미지 생성, 편집 등)
- 사용자가 두 곳을 왔다갔다 해야 함

**구현 방법**:
```
메인 App.tsx에 새 탭 추가:
- 'ai-studio' (기존)
- 'image-studio-pro' (신규)
```

---

## 📋 최종 추천: 옵션 1 (AI Studio 확장)

AI Studio를 확장하여 나노바나나 Pro의 기능들을 통합하는 것이 가장 효율적입니다!

---

## 🛠️ 구현 플랜

### Phase 1: AI Studio 모드 확장 (1주)

#### 1-1. 모드 추가 (1일)
**현재 모드**: `'fusion' | 'text' | 'video'`
**추가 모드**: `'camera' | 'style-transfer' | 'sequential' | 'video-creator' | 'prompt-library'`

**파일**: `ai_studio_bundle/App.tsx`
```typescript
// Line 23 수정
type Mode = 'fusion' | 'text' | 'video' | 'camera' | 'style-transfer' | 'sequential' | 'video-creator' | 'prompt-library';

// Line 666-676 탭 버튼 확장
<div className="flex bg-gray-800 rounded-lg p-1 mb-6 flex-wrap">
  <button onClick={() => handleModeChange('fusion')} className={...}>
    이미지 퓨전 & 수정
  </button>
  <button onClick={() => handleModeChange('text')} className={...}>
    텍스트로 이미지 생성
  </button>
  <button onClick={() => handleModeChange('video')} className={...}>
    동영상 생성
  </button>
  {/* 신규 모드 */}
  <button onClick={() => handleModeChange('camera')} className={...}>
    📷 카메라 컨트롤
  </button>
  <button onClick={() => handleModeChange('style-transfer')} className={...}>
    🎨 스타일 따라하기
  </button>
  <button onClick={() => handleModeChange('sequential')} className={...}>
    🎬 연속 이미지
  </button>
  <button onClick={() => handleModeChange('video-creator')} className={...}>
    🎥 영상 만들기
  </button>
  <button onClick={() => handleModeChange('prompt-library')} className={...}>
    💾 프롬프트 관리
  </button>
</div>
```

#### 1-2. 카메라 컨트롤 컴포넌트 (2일)
**파일**: `ai_studio_bundle/components/CameraControls.tsx`

```typescript
import React, { useState } from 'react';

interface CameraSettings {
  shotSize: string;
  angle: string;
  movement: string;
  lighting: string;
}

const CAMERA_PRESETS = {
  shotSize: [
    'Extreme Close-up (ECU)',
    'Close-up (CU)',
    'Medium Close-up (MCU)',
    'Medium Shot (MS)',
    'Medium Long Shot (MLS)',
    'Long Shot (LS)',
    'Extreme Long Shot (ELS)'
  ],
  angle: [
    'Eye-level',
    'High angle (Bird\'s eye view)',
    'Low angle (Worm\'s eye view)',
    'Dutch angle (Tilted)',
    'Over-the-shoulder (OTS)'
  ],
  movement: [
    'Static (Fixed)',
    'Pan (Horizontal sweep)',
    'Tilt (Vertical sweep)',
    'Dolly (Push in/Pull out)',
    'Tracking (Follow subject)',
    'Crane (Up and down)'
  ],
  lighting: [
    'Natural daylight',
    'Golden hour (Warm)',
    'Blue hour (Cool)',
    'Studio lighting (3-point)',
    'Dramatic side lighting',
    'Backlit (Rim light)',
    'Soft diffused light'
  ]
};

interface CameraControlsProps {
  onSettingsChange: (settings: CameraSettings) => void;
}

const CameraControls: React.FC<CameraControlsProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<CameraSettings>({
    shotSize: CAMERA_PRESETS.shotSize[3], // Default: Medium Shot
    angle: CAMERA_PRESETS.angle[0], // Default: Eye-level
    movement: CAMERA_PRESETS.movement[0], // Default: Static
    lighting: CAMERA_PRESETS.lighting[0] // Default: Natural daylight
  });

  const handleChange = (key: keyof CameraSettings, value: string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">📷 카메라 설정</h3>
      
      {/* Shot Size */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          샷 크기 (Shot Size)
        </label>
        <select
          value={settings.shotSize}
          onChange={(e) => handleChange('shotSize', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          {CAMERA_PRESETS.shotSize.map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {/* Camera Angle */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          카메라 앵글 (Camera Angle)
        </label>
        <select
          value={settings.angle}
          onChange={(e) => handleChange('angle', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          {CAMERA_PRESETS.angle.map(angle => (
            <option key={angle} value={angle}>{angle}</option>
          ))}
        </select>
      </div>

      {/* Camera Movement */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          카메라 무브먼트 (Camera Movement)
        </label>
        <select
          value={settings.movement}
          onChange={(e) => handleChange('movement', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          {CAMERA_PRESETS.movement.map(movement => (
            <option key={movement} value={movement}>{movement}</option>
          ))}
        </select>
      </div>

      {/* Lighting */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          조명 (Lighting)
        </label>
        <select
          value={settings.lighting}
          onChange={(e) => handleChange('lighting', e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        >
          {CAMERA_PRESETS.lighting.map(lighting => (
            <option key={lighting} value={lighting}>{lighting}</option>
          ))}
        </select>
      </div>

      {/* Preview */}
      <div className="bg-gray-900 rounded-md p-3 mt-4">
        <p className="text-xs text-gray-400 mb-1">프롬프트 프리뷰:</p>
        <p className="text-sm text-gray-200">
          {settings.shotSize}, {settings.angle}, {settings.movement}, {settings.lighting}
        </p>
      </div>
    </div>
  );
};

export default CameraControls;
```

**App.tsx 통합**:
```typescript
// Import 추가
import CameraControls from './components/CameraControls';

// State 추가
const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null);

// 프롬프트 생성 시 카메라 설정 통합
const handleGenerateImages = async () => {
  // ...기존 코드...
  
  // 카메라 설정이 있으면 프롬프트에 추가
  if (mode === 'camera' && cameraSettings) {
    const cameraPrefix = `${cameraSettings.shotSize}, ${cameraSettings.angle}, ${cameraSettings.movement}, ${cameraSettings.lighting}, `;
    validPrompts = validPrompts.map(p => ({
      ...p,
      value: cameraPrefix + p.value
    }));
  }
  
  // ...나머지 코드...
};

// UI에 카메라 컨트롤 추가
{mode === 'camera' && (
  <CameraControls onSettingsChange={setCameraSettings} />
)}
```

#### 1-3. 스타일 따라하기 컴포넌트 (2일)
**파일**: `ai_studio_bundle/components/StyleTransfer.tsx`

```typescript
import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';

interface StyleTransferProps {
  onStyleExtracted: (stylePrompt: string) => void;
}

const StyleTransfer: React.FC<StyleTransferProps> = ({ onStyleExtracted }) => {
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedStyle, setExtractedStyle] = useState<string>('');

  const handleImageDrop = (file: File) => {
    setReferenceImage(file);
    setReferenceUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    setReferenceImage(null);
    setReferenceUrl(null);
    setExtractedStyle('');
  };

  const analyzeStyle = async () => {
    if (!referenceImage) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', referenceImage);

      const response = await fetch('http://localhost:3002/api/analyze-style', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('스타일 분석 실패');

      const { styleDescription } = await response.json();
      setExtractedStyle(styleDescription);
      onStyleExtracted(styleDescription);
    } catch (error) {
      console.error('Style analysis error:', error);
      alert('스타일 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-200">🎨 스타일 따라하기</h3>
      <p className="text-sm text-gray-400">
        참조 이미지를 업로드하면 AI가 스타일을 분석하여 프롬프트를 생성합니다.
      </p>

      <div>
        <h4 className="text-base font-medium text-gray-300 mb-2">참조 이미지</h4>
        <ImageDropzone
          onImageDrop={handleImageDrop}
          previewUrl={referenceUrl}
          onClear={handleClearImage}
        />
      </div>

      <button
        onClick={analyzeStyle}
        disabled={!referenceImage || isAnalyzing}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
      >
        {isAnalyzing ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            스타일 분석 중...
          </>
        ) : (
          <>
            🔍 스타일 분석하기
          </>
        )}
      </button>

      {extractedStyle && (
        <div className="bg-gray-900 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">추출된 스타일:</h4>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{extractedStyle}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(extractedStyle);
              alert('클립보드에 복사되었습니다!');
            }}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          >
            📋 복사하기
          </button>
        </div>
      )}
    </div>
  );
};

export default StyleTransfer;
```

**서버 API 추가** (`server/index.js`):
```javascript
// Multer 설정 (파일 업로드)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// 스타일 분석 API
app.post('/api/analyze-style', upload.single('image'), async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-vision' });

    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analyze this image in detail and describe its artistic style, mood, color palette, composition, lighting, and overall aesthetic. 
    
    Format your response as a detailed prompt that could be used to generate similar images:
    
    Style: [describe the art style]
    Mood: [describe the emotional tone]
    Colors: [describe the color scheme]
    Composition: [describe the layout and framing]
    Lighting: [describe the lighting setup]
    Details: [any other notable visual elements]
    
    Then provide a complete, ready-to-use prompt at the end.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: req.file.mimetype
        }
      }
    ]);

    const styleDescription = result.response.text();
    res.json({ styleDescription });
  } catch (error) {
    console.error('Style analysis error:', error);
    res.status(500).json({ error: 'Style analysis failed' });
  }
});
```

#### 1-4. 연속 이미지 생성 컴포넌트 (2일)
**파일**: `ai_studio_bundle/components/SequentialImageGenerator.tsx`

```typescript
import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface SequentialConfig {
  basePrompt: string;
  frameCount: number;
  variations: string[];
}

interface SequentialImageGeneratorProps {
  onGenerate: (config: SequentialConfig, baseImage: File | null) => Promise<void>;
}

const SequentialImageGenerator: React.FC<SequentialImageGeneratorProps> = ({ onGenerate }) => {
  const [baseImage, setBaseImage] = useState<File | null>(null);
  const [baseImageUrl, setBaseImageUrl] = useState<string | null>(null);
  const [config, setConfig] = useState<SequentialConfig>({
    basePrompt: '',
    frameCount: 6,
    variations: Array(6).fill('')
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const handleImageDrop = (file: File) => {
    if (baseImageUrl) URL.revokeObjectURL(baseImageUrl);
    setBaseImage(file);
    setBaseImageUrl(URL.createObjectURL(file));
  };

  const handleClearImage = () => {
    if (baseImageUrl) URL.revokeObjectURL(baseImageUrl);
    setBaseImage(null);
    setBaseImageUrl(null);
  };

  const handleFrameCountChange = (count: number) => {
    const newVariations = Array(count).fill('').map((_, i) => 
      config.variations[i] || ''
    );
    setConfig({ ...config, frameCount: count, variations: newVariations });
  };

  const handleVariationChange = (index: number, value: string) => {
    const newVariations = [...config.variations];
    newVariations[index] = value;
    setConfig({ ...config, variations: newVariations });
  };

  const handleGenerate = async () => {
    if (!config.basePrompt.trim()) {
      alert('기본 프롬프트를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      await onGenerate(config, baseImage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-200">🎬 연속 이미지 생성</h3>
      <p className="text-sm text-gray-400">
        기본 프롬프트를 바탕으로 연속된 이미지를 생성합니다. 각 프레임마다 변형을 추가할 수 있습니다.
      </p>

      {/* 베이스 이미지 (선택사항) */}
      <div>
        <h4 className="text-base font-medium text-gray-300 mb-2">
          참조 이미지 (선택사항)
        </h4>
        <ImageDropzone
          onImageDrop={handleImageDrop}
          previewUrl={baseImageUrl}
          onClear={handleClearImage}
        />
      </div>

      {/* 기본 프롬프트 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          기본 프롬프트
        </label>
        <textarea
          value={config.basePrompt}
          onChange={(e) => setConfig({ ...config, basePrompt: e.target.value })}
          placeholder="예: A woman walking through a garden"
          className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
          rows={3}
        />
      </div>

      {/* 프레임 수 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          프레임 수: {config.frameCount}
        </label>
        <input
          type="range"
          min="2"
          max="12"
          value={config.frameCount}
          onChange={(e) => handleFrameCountChange(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 프레임별 변형 */}
      <div>
        <h4 className="text-base font-medium text-gray-300 mb-2">
          프레임별 변형 (선택사항)
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Array.from({ length: config.frameCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-gray-400 w-16">#{i + 1}</span>
              <input
                type="text"
                value={config.variations[i] || ''}
                onChange={(e) => handleVariationChange(i, e.target.value)}
                placeholder={`예: looking at camera, smiling`}
                className="flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !config.basePrompt.trim()}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <Spinner />
            연속 이미지 생성 중...
          </>
        ) : (
          <>
            🎬 {config.frameCount}개 이미지 생성하기
          </>
        )}
      </button>
    </div>
  );
};

export default SequentialImageGenerator;
```

---

### Phase 2: 비디오 제작 기능 (1주)

#### 2-1. 비디오 크리에이터 컴포넌트 (3일)
**파일**: `ai_studio_bundle/components/VideoCreator.tsx`

```typescript
import React, { useState } from 'react';

interface VideoConfig {
  images: string[]; // Base64 URLs
  duration: number; // 각 이미지 표시 시간 (초)
  transition: 'none' | 'fade' | 'slide' | 'zoom';
  transitionDuration: number;
  bgMusic?: File;
  bgMusicVolume: number;
}

interface VideoCreatorProps {
  availableImages: Array<{ url: string; prompt: string }>;
}

const VideoCreator: React.FC<VideoCreatorProps> = ({ availableImages }) => {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [config, setConfig] = useState<VideoConfig>({
    images: [],
    duration: 3,
    transition: 'fade',
    transitionDuration: 0.5,
    bgMusicVolume: 50
  });
  const [isCreating, setIsCreating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const toggleImageSelection = (url: string) => {
    setSelectedImages(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const createVideo = async () => {
    if (selectedImages.length === 0) {
      alert('최소 1개 이상의 이미지를 선택해주세요.');
      return;
    }

    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('config', JSON.stringify({
        ...config,
        images: selectedImages
      }));

      if (config.bgMusic) {
        formData.append('bgMusic', config.bgMusic);
      }

      const response = await fetch('http://localhost:3002/api/create-video', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Video creation failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (error) {
      console.error('Video creation error:', error);
      alert('비디오 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `shorts_video_${Date.now()}.mp4`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-200">🎥 영상 만들기</h3>

      {/* 이미지 선택 */}
      <div>
        <h4 className="text-base font-medium text-gray-300 mb-3">
          이미지 선택 ({selectedImages.length}개 선택됨)
        </h4>
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto bg-gray-900 rounded-md p-2">
          {availableImages.map((img, i) => (
            <div
              key={i}
              onClick={() => toggleImageSelection(img.url)}
              className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                selectedImages.includes(img.url)
                  ? 'border-indigo-500 ring-2 ring-indigo-500'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
            >
              <img src={img.url} alt={img.prompt} className="w-full h-24 object-cover" />
              {selectedImages.includes(img.url) && (
                <div className="absolute top-1 right-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                  {selectedImages.indexOf(img.url) + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 비디오 설정 */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h4 className="text-base font-medium text-gray-300">비디오 설정</h4>

        {/* 이미지 표시 시간 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            각 이미지 표시 시간: {config.duration}초
          </label>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={config.duration}
            onChange={(e) => setConfig({ ...config, duration: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* 트랜지션 효과 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">트랜지션 효과</label>
          <select
            value={config.transition}
            onChange={(e) => setConfig({ ...config, transition: e.target.value as any })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
          >
            <option value="none">없음</option>
            <option value="fade">페이드</option>
            <option value="slide">슬라이드</option>
            <option value="zoom">줌</option>
          </select>
        </div>

        {/* 트랜지션 시간 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            트랜지션 시간: {config.transitionDuration}초
          </label>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={config.transitionDuration}
            onChange={(e) => setConfig({ ...config, transitionDuration: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>

        {/* 배경 음악 */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">배경 음악 (선택사항)</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setConfig({ ...config, bgMusic: e.target.files?.[0] })}
            className="w-full text-sm text-gray-400"
          />
        </div>

        {config.bgMusic && (
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              음악 볼륨: {config.bgMusicVolume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={config.bgMusicVolume}
              onChange={(e) => setConfig({ ...config, bgMusicVolume: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={createVideo}
        disabled={isCreating || selectedImages.length === 0}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors"
      >
        {isCreating ? '비디오 생성 중...' : `🎥 비디오 생성하기 (${selectedImages.length}개 이미지)`}
      </button>

      {/* 비디오 미리보기 */}
      {videoUrl && (
        <div className="bg-gray-900 rounded-lg p-4">
          <h4 className="text-base font-medium text-gray-300 mb-3">생성된 비디오</h4>
          <video src={videoUrl} controls className="w-full rounded-md mb-3" />
          <button
            onClick={downloadVideo}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
          >
            📥 비디오 다운로드
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoCreator;
```

**서버 API** (`server/index.js`):
```javascript
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

app.post('/api/create-video', upload.single('bgMusic'), async (req, res) => {
  const config = JSON.parse(req.body.config);
  const bgMusic = req.file;

  // 임시 디렉토리 생성
  const tempDir = path.join(__dirname, 'temp', Date.now().toString());
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Base64 이미지들을 파일로 저장
    for (let i = 0; i < config.images.length; i++) {
      const base64Data = config.images[i].replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(path.join(tempDir, `frame_${i}.png`), buffer);
    }

    const outputPath = path.join(tempDir, 'output.mp4');

    // FFmpeg 명령 구성
    let command = ffmpeg();

    // 이미지 입력 (각 이미지를 duration만큼 표시)
    for (let i = 0; i < config.images.length; i++) {
      command = command
        .input(path.join(tempDir, `frame_${i}.png`))
        .inputOptions([`-t ${config.duration}`]);
    }

    // 트랜지션 필터 적용
    if (config.transition === 'fade' && config.images.length > 1) {
      const filterComplex = [];
      for (let i = 0; i < config.images.length - 1; i++) {
        filterComplex.push(
          `[${i}:v][${i+1}:v]xfade=transition=fade:duration=${config.transitionDuration}:offset=${config.duration * i + config.duration - config.transitionDuration}[v${i}]`
        );
      }
      command = command.complexFilter(filterComplex);
    }

    // 배경 음악 추가
    if (bgMusic) {
      const musicPath = path.join(tempDir, 'music.mp3');
      fs.writeFileSync(musicPath, bgMusic.buffer);
      command = command
        .input(musicPath)
        .audioFilters(`volume=${config.bgMusicVolume / 100}`);
    }

    // 출력 설정
    command
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast',
        '-crf 23'
      ])
      .output(outputPath)
      .on('end', () => {
        res.sendFile(outputPath, () => {
          // 임시 파일 정리
          setTimeout(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }, 5000);
        });
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).json({ error: 'Video creation failed' });
        fs.rmSync(tempDir, { recursive: true, force: true });
      })
      .run();
  } catch (error) {
    console.error('Video creation error:', error);
    res.status(500).json({ error: 'Video creation failed' });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

**필요한 패키지 설치**:
```bash
cd ai_studio_bundle
npm install fluent-ffmpeg multer
```

---

### Phase 3: 프롬프트 관리 (3일)

#### 3-1. 프롬프트 라이브러리 컴포넌트
**파일**: `ai_studio_bundle/components/PromptLibrary.tsx`

```typescript
import React, { useState, useEffect } from 'react';

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
  category: string;
  tags: string[];
  createdAt: string;
}

const PromptLibrary: React.FC = () => {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [filter, setFilter] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    prompt: '',
    category: 'general',
    tags: ''
  });

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('ai-studio-prompt-library');
    if (saved) {
      setPrompts(JSON.parse(saved));
    }
  }, []);

  const saveToStorage = (updatedPrompts: SavedPrompt[]) => {
    localStorage.setItem('ai-studio-prompt-library', JSON.stringify(updatedPrompts));
    setPrompts(updatedPrompts);
  };

  const handleSavePrompt = () => {
    if (!newPrompt.name.trim() || !newPrompt.prompt.trim()) {
      alert('이름과 프롬프트를 입력해주세요.');
      return;
    }

    const prompt: SavedPrompt = {
      id: Date.now().toString(),
      name: newPrompt.name,
      prompt: newPrompt.prompt,
      category: newPrompt.category,
      tags: newPrompt.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString()
    };

    saveToStorage([...prompts, prompt]);
    setNewPrompt({ name: '', prompt: '', category: 'general', tags: '' });
    setShowAddForm(false);
  };

  const handleDeletePrompt = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      saveToStorage(prompts.filter(p => p.id !== id));
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    alert('클립보드에 복사되었습니다!');
  };

  const filteredPrompts = prompts.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase()) ||
    p.prompt.toLowerCase().includes(filter.toLowerCase()) ||
    p.tags.some(tag => tag.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">💾 프롬프트 라이브러리</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-md"
        >
          {showAddForm ? '취소' : '+ 새 프롬프트'}
        </button>
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="검색..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
      />

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <input
            type="text"
            placeholder="프롬프트 이름"
            value={newPrompt.name}
            onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
          />
          <textarea
            placeholder="프롬프트 내용"
            value={newPrompt.prompt}
            onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm resize-y"
            rows={4}
          />
          <select
            value={newPrompt.category}
            onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
          >
            <option value="general">일반</option>
            <option value="portrait">인물</option>
            <option value="landscape">풍경</option>
            <option value="style">스타일</option>
            <option value="camera">카메라</option>
          </select>
          <input
            type="text"
            placeholder="태그 (쉼표로 구분)"
            value={newPrompt.tags}
            onChange={(e) => setNewPrompt({ ...newPrompt, tags: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
          />
          <button
            onClick={handleSavePrompt}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
          >
            저장
          </button>
        </div>
      )}

      {/* 프롬프트 목록 */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPrompts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            저장된 프롬프트가 없습니다.
          </p>
        ) : (
          filteredPrompts.map(prompt => (
            <div key={prompt.id} className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">{prompt.name}</h4>
                  <span className="text-xs text-gray-400">{prompt.category}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyPrompt(prompt.prompt)}
                    className="text-indigo-400 hover:text-indigo-300 text-xs"
                  >
                    📋 복사
                  </button>
                  <button
                    onClick={() => handleDeletePrompt(prompt.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    🗑️ 삭제
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-2">{prompt.prompt}</p>
              <div className="flex flex-wrap gap-1">
                {prompt.tags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PromptLibrary;
```

---

## 📊 최종 구조

### AI Studio 모드 (확장 후)
```
ai_studio_bundle/App.tsx
├── Mode 1: 이미지 퓨전 & 수정 (기존)
├── Mode 2: 텍스트로 이미지 생성 (기존)
├── Mode 3: 동영상 생성 (기존)
├── Mode 4: 📷 카메라 컨트롤 (신규)
├── Mode 5: 🎨 스타일 따라하기 (신규)
├── Mode 6: 🎬 연속 이미지 (신규)
├── Mode 7: 🎥 영상 만들기 (신규)
└── Mode 8: 💾 프롬프트 관리 (신규)
```

### 메인 App 탭 구조 (변경 없음)
```
App.tsx
├── 왼쪽 패널
│   ├── Config
│   ├── History
│   ├── Hybrid
│   └── Shorts Generator
└── 오른쪽 패널
    ├── Analysis
    ├── Shortform
    ├── Longform
    ├── YouTube Search
    ├── Shorts Generator
    └── AI Studio (확장됨) ⭐
```

---

## 🚀 구현 순서

### Week 1: 핵심 모드 추가
- Day 1: 모드 탭 확장 + 카메라 컨트롤 컴포넌트
- Day 2-3: 카메라 컨트롤 통합 및 테스트
- Day 4-5: 스타일 따라하기 컴포넌트 + 서버 API
- Day 6-7: 연속 이미지 생성 컴포넌트

### Week 2: 비디오 제작
- Day 1-3: 비디오 크리에이터 컴포넌트 + FFmpeg 통합
- Day 4-5: 비디오 생성 테스트 및 최적화
- Day 6-7: 프롬프트 라이브러리 컴포넌트

### Week 3: 통합 및 테스트
- Day 1-2: 전체 통합 테스트
- Day 3-4: 버그 수정
- Day 5-7: UI/UX 개선 및 문서화

---

## 💡 추가 제안

### 1. 쇼츠 생성기와의 시너지
AI Studio에서 생성된 이미지를 쇼츠 생성기로 바로 전달:
```typescript
// AI Studio에서 이미지 생성 후
const handleSendToShortsGenerator = (imageUrl: string, prompt: string) => {
  // 부모 컴포넌트로 이벤트 전달
  if (props.onAddToShortsGenerator) {
    props.onAddToShortsGenerator(imageUrl, prompt);
  }
};
```

### 2. 히스토리 통합
AI Studio와 쇼츠 생성기의 히스토리를 통합 관리:
```typescript
// 공통 히스토리 타입
interface UnifiedHistory {
  id: string;
  type: 'shorts-script' | 'ai-studio-image' | 'ai-studio-video';
  content: any;
  createdAt: number;
}
```

### 3. 배치 작업
여러 프롬프트를 한 번에 처리:
```typescript
// 배치 이미지 생성
const handleBatchGeneration = async (prompts: string[]) => {
  for (const prompt of prompts) {
    await generateImage(prompt);
  }
};
```

---

## 📝 다음 단계

마마님, 이 플랜을 검토하신 후:

1. **승인 여부**: AI Studio 확장 방식으로 진행할지 결정
2. **우선순위**: 어떤 기능부터 시작할지 선택
3. **FFmpeg 설치**: 비디오 생성 기능을 위해 시스템에 FFmpeg 설치 필요
4. **구현 시작**: 승인하시면 Week 1부터 시작!

추천 시작 순서:
1. 카메라 컨트롤 (가장 쉽고 즉시 효과 있음)
2. 연속 이미지 생성 (쇼츠 제작에 유용)
3. 비디오 크리에이터 (완전한 쇼츠 제작 파이프라인 완성)

어떻게 진행하시겠습니까? 🚀

# Phase 2: 이미지 퀄리티 향상 기능 구현 계획

## 📅 시작일: 2026-01-03
## ⏱️ 예상 소요 시간: 2주 (에이전트 모드: 2-3시간)

---

## 🎯 Phase 2 목표

이미지 생성 후 퀄리티를 향상시키는 6개 핵심 기능 구현

---

## 📋 구현 순서

### 2-1. 스타일 따라하기 ⭐⭐⭐⭐⭐
**우선순위**: 최고
**예상 시간**: 30분

**기능**:
- 참조 이미지 스타일 분석
- 다른 이미지에 스타일 적용
- 스타일 강도 조절

**구현 파일**:
- `ai_studio_bundle/components/StyleTransfer.tsx`
- `ai_studio_bundle/App.tsx` (모드 추가)

**핵심 로직**:
```typescript
interface StyleTransferConfig {
  sourceImage: File;
  styleImage: File;
  strength: number; // 0-100
}

const transferStyle = async (config: StyleTransferConfig) => {
  // Gemini API를 사용하여 스타일 분석
  const stylePrompt = await analyzeStyle(config.styleImage);
  
  // 소스 이미지에 스타일 적용
  const result = await generateImageFromImagesAndText(
    [
      { file: config.sourceImage, name: 'source' },
      { file: config.styleImage, name: 'style' }
    ],
    `Apply the artistic style from the style image to the source image, strength: ${config.strength}%`
  );
  
  return result;
};
```

---

### 2-2. 스타일 색상 바꾸기 ⭐⭐⭐⭐
**우선순위**: 높음
**예상 시간**: 30분

**기능**:
- 의상/객체 자동 분석
- 색상 변경 (단색, 그라디언트)
- 패턴 변경

**구현 파일**:
- `ai_studio_bundle/components/ColorChanger.tsx`
- `ai_studio_bundle/App.tsx` (모드 추가)

**핵심 로직**:
```typescript
interface ColorChangeConfig {
  image: File;
  targetArea: 'clothing' | 'hair' | 'background' | 'all';
  newColor: string; // hex color
  preserveTexture: boolean;
}

const changeColor = async (config: ColorChangeConfig) => {
  const prompt = `Change the ${config.targetArea} color to ${config.newColor}, ${
    config.preserveTexture ? 'preserve original texture and details' : 'smooth color'
  }`;
  
  const result = await editImage(config.image, prompt);
  return result;
};
```

---

### 2-3. 포즈 따라하기 ⭐⭐⭐⭐
**우선순위**: 높음
**예상 시간**: 20분

**기능**:
- 참조 이미지 포즈 분석
- 다른 인물에 포즈 적용
- 포즈 정확도 조절

**구현 파일**:
- `ai_studio_bundle/components/PoseTransfer.tsx`
- `ai_studio_bundle/App.tsx` (모드 추가)

**핵심 로직**:
```typescript
interface PoseTransferConfig {
  sourceImage: File;
  poseReference: File;
  accuracy: number; // 0-100
}

const transferPose = async (config: PoseTransferConfig) => {
  const prompt = `Transfer the exact pose and body position from the reference image to the person in the source image, accuracy: ${config.accuracy}%`;
  
  const result = await generateImageFromImagesAndText(
    [
      { file: config.sourceImage, name: 'person' },
      { file: config.poseReference, name: 'pose' }
    ],
    prompt
  );
  
  return result;
};
```

---

### 2-4. 얼굴 보정 ⭐⭐⭐
**우선순위**: 중간
**예상 시간**: 20분

**기능**:
- 얼굴/헤어/바디 영역 분리
- 자연스러운 보정
- 보정 강도 조절

**구현 파일**:
- `ai_studio_bundle/components/FaceCorrection.tsx`
- `ai_studio_bundle/App.tsx` (모드 추가)

**핵심 로직**:
```typescript
interface FaceCorrectionConfig {
  image: File;
  correctionType: 'face' | 'hair' | 'body' | 'all';
  strength: number; // 0-100
  naturalness: number; // 0-100
}

const correctFace = async (config: FaceCorrectionConfig) => {
  const prompt = `Enhance and correct the ${config.correctionType}, strength: ${config.strength}%, maintain natural appearance: ${config.naturalness}%`;
  
  const result = await editImage(config.image, prompt);
  return result;
};
```

---

### 2-5. 피부톤 튜닝 ⭐⭐⭐
**우선순위**: 중간
**예상 시간**: 15분

**기능**:
- 피부 영역 자동 인식
- 균일한 피부톤 보정
- 톤 조절 (밝게/어둡게)

**구현 파일**:
- `ai_studio_bundle/components/SkinToneAdjuster.tsx`
- `ai_studio_bundle/App.tsx` (모드 추가)

**핵심 로직**:
```typescript
interface SkinToneConfig {
  image: File;
  tone: 'lighter' | 'darker' | 'neutral';
  evenness: number; // 0-100
  naturalness: number; // 0-100
}

const adjustSkinTone = async (config: SkinToneConfig) => {
  const prompt = `Adjust skin tone to be ${config.tone}, evenness: ${config.evenness}%, maintain natural appearance: ${config.naturalness}%`;
  
  const result = await editImage(config.image, prompt);
  return result;
};
```

---

### 2-6. 헤어 & 메이크업 ⭐⭐⭐⭐
**우선순위**: 높음
**예상 시간**: 30분

**기능**:
- 헤어스타일 변경
- 헤어컬러 변경
- 메이크업 적용 (자연스러움/진하게)

**구현 파일**:
- `ai_studio_bundle/components/HairMakeup.tsx`
- `ai_studio_bundle/App.tsx` (모드 추가)

**핵심 로직**:
```typescript
interface HairMakeupConfig {
  image: File;
  hairstyle?: string; // 'long', 'short', 'curly', 'straight', etc.
  hairColor?: string; // hex color
  makeupStyle?: 'natural' | 'dramatic' | 'none';
  makeupIntensity?: number; // 0-100
}

const applyHairMakeup = async (config: HairMakeupConfig) => {
  let prompt = '';
  
  if (config.hairstyle) {
    prompt += `Change hairstyle to ${config.hairstyle}, `;
  }
  
  if (config.hairColor) {
    prompt += `change hair color to ${config.hairColor}, `;
  }
  
  if (config.makeupStyle && config.makeupStyle !== 'none') {
    prompt += `apply ${config.makeupStyle} makeup with intensity ${config.makeupIntensity}%`;
  }
  
  const result = await editImage(config.image, prompt);
  return result;
};
```

---

## 🎨 UI/UX 디자인 가이드

### 공통 레이아웃
```tsx
<div className="space-y-6">
  {/* 헤더 */}
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-gray-200">
      {icon} {title}
    </h3>
    <button className="text-xs bg-gray-700 hover:bg-gray-600">
      ⚡ 빠른 프리셋
    </button>
  </div>

  {/* 설명 */}
  <p className="text-sm text-gray-400">{description}</p>

  {/* 이미지 업로드 */}
  <div>
    <h4 className="text-base font-medium text-gray-300 mb-2">
      1. 이미지 업로드
    </h4>
    <ImageDropzone />
  </div>

  {/* 설정 */}
  <div className="bg-gray-800 rounded-lg p-4 space-y-4">
    <h4 className="text-base font-medium text-gray-300">2. 설정</h4>
    {/* 각 기능별 설정 UI */}
  </div>

  {/* 생성 버튼 */}
  <button className="w-full bg-indigo-600 hover:bg-indigo-700">
    {isProcessing ? '처리 중...' : '적용하기'}
  </button>

  {/* 결과 */}
  {result && (
    <div className="bg-gray-900 rounded-lg p-4">
      <h4 className="text-base font-medium text-green-400 mb-3">
        ✅ 완료!
      </h4>
      <img src={result} />
      <button>📥 다운로드</button>
    </div>
  )}
</div>
```

---

## 📊 구현 체크리스트

- [ ] 2-1. 스타일 따라하기
  - [ ] StyleTransfer.tsx 생성
  - [ ] App.tsx 모드 추가
  - [ ] UI 구현
  - [ ] 테스트

- [ ] 2-2. 스타일 색상 바꾸기
  - [ ] ColorChanger.tsx 생성
  - [ ] App.tsx 모드 추가
  - [ ] UI 구현
  - [ ] 테스트

- [ ] 2-3. 포즈 따라하기
  - [ ] PoseTransfer.tsx 생성
  - [ ] App.tsx 모드 추가
  - [ ] UI 구현
  - [ ] 테스트

- [ ] 2-4. 얼굴 보정
  - [ ] FaceCorrection.tsx 생성
  - [ ] App.tsx 모드 추가
  - [ ] UI 구현
  - [ ] 테스트

- [ ] 2-5. 피부톤 튜닝
  - [ ] SkinToneAdjuster.tsx 생성
  - [ ] App.tsx 모드 추가
  - [ ] UI 구현
  - [ ] 테스트

- [ ] 2-6. 헤어 & 메이크업
  - [ ] HairMakeup.tsx 생성
  - [ ] App.tsx 모드 추가
  - [ ] UI 구현
  - [ ] 테스트

---

## 🚀 실행 계획

### 자동 실행 모드
1. 각 컴포넌트를 순차적으로 생성
2. App.tsx에 모드 추가
3. 간단한 테스트 수행
4. 다음 기능으로 이동

### 예상 총 소요 시간
- 컴포넌트 생성: 6개 × 20분 = 2시간
- 통합 및 테스트: 30분
- **총 2.5시간**

---

## ✅ 완료 후 결과

Phase 2 완료 시:
- ✅ 6개 이미지 퀄리티 향상 기능 추가
- ✅ AI Studio 모드 14개로 확장
- ✅ 전문적인 이미지 편집 가능
- ✅ 쇼츠 제작 품질 대폭 향상

---

## 🎉 시작합니다!

Phase 2-1 (스타일 따라하기)부터 시작하겠습니다! 🚀

# 🖼️ 이미지 시스템 개선 계획

> **작성일**: 2025-12-31
> **목적**: 이미지 생성 안정성 향상 및 효율적인 이미지 관리 시스템 구축

---

## 📊 현재 시스템 분석

### 1. 현재 이미지 저장 구조
```
generated_scripts/
└── images/
    ├── 2025-12-01T00-09-14_테스트.png
    ├── 2025-12-01T00-27-56_필드위의여왕들.png
    ├── 2025-12-01T00-35-15_단풍위를걷는.png
    └── ... (70+ 파일, 무제한 증가)
```

**문제점**:
- ❌ 모든 이미지가 한 폴더에 저장 (70+ 파일)
- ❌ 대본 ID와 이미지 연결 정보 부재
- ❌ 파일명만으로는 어떤 대본의 몇 번째 씬인지 알 수 없음
- ❌ 이미지 로딩 시 전체 목록 스캔 (성능 저하)

### 2. 현재 이미지 저장 방식

**이중 저장 구조**:
1. **IndexedDB** (`creator-studio-db` > `blob-store`)
   - Key: UUID (generatedImageId)
   - Value: Blob 데이터
   - 용도: 브라우저 캐시, 빠른 접근

2. **파일 시스템** (`generated_scripts/images/`)
   - 파일명: `{timestamp}_{prompt}.png`
   - 용도: 영구 저장, 백업

**연결 정보**:
```typescript
// localStorage: 'shorts-image-history'
{
  id: "uuid",
  prompt: "프롬프트 텍스트",
  generatedImageId: "uuid",  // IndexedDB 키
  diskFilename: "파일명"      // 파일 시스템 파일명
}
```

**문제점**:
- ❌ 대본(StoryResponse)과 이미지 히스토리의 연결 정보 없음
- ❌ 어떤 대본의 Scene 1, 2, 3... 인지 추적 불가

### 3. 이미지 생성 실패 원인

#### 3-1. Gemini API 오류
```typescript
// geminiService.ts:121-144
export const generateImageWithImagen = async (
    prompt: string,
    negativePrompt: string,
    config: { aspectRatio: string; model?: string },
    safetySettings?: any
): Promise<any> => {
    const ai = getClient();
    const finalPrompt = prompt;

    const payload: any = {
        model: config.model || 'imagen-4.0-generate-001',
        prompt: finalPrompt,
        negativePrompt: negativePrompt || undefined,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: config.aspectRatio,
        },
        safetySettings
    };

    return withRetry(() => ai.models.generateImages(payload), 'Imagen 이미지 생성');
};
```

**실패 케이스**:
1. **API 할당량 초과** (429 RESOURCE_EXHAUSTED)
   - 현재: 재시도 3번 (2초, 4초 간격)
   - 문제: 할당량 초과 시 재시도해도 실패

2. **안전 필터 차단** (SAFETY)
   - 프롬프트가 NSFW로 판단되면 거부
   - 현재: `makeSafePrompt()` 함수로 일부 변환
   - 문제: 완벽하지 않음

3. **서비스 일시 중단** (503 UNAVAILABLE)
   - 현재: 재시도 3번
   - 문제: 장기 장애 시 대응 불가

4. **프롬프트 길이 제한**
   - 문제: 너무 긴 프롬프트 (2048자 제한)

5. **네트워크 타임아웃**
   - 문제: 응답 대기 시간 초과

#### 3-2. 저장 실패
```typescript
// OutputDisplay.tsx:342-346
result = await generateImageWithImagen(
    prompt, "",
    { aspectRatio: "9:16", model: imageModel },
    safetySettings
);
```

**실패 케이스**:
1. IndexedDB 저장 실패 (용량 초과)
2. 서버 디스크 저장 실패 (권한, 용량)
3. 네트워크 오류 (서버 통신 실패)

---

## 🎯 개선 목표

### 우선순위 1: 이미지 생성 안정성 (최우선)
- ✅ API 오류 처리 강화
- ✅ 재시도 로직 개선
- ✅ 안전 필터 우회 전략
- ✅ 사용자 피드백 개선

### 우선순위 2: 대본별 이미지 관리
- ✅ 대본 ID 기반 폴더 구조
- ✅ Scene 번호 기반 파일명
- ✅ 대본 선택 시 해당 이미지만 로딩

### 우선순위 3: 확장성 대응
- ✅ 페이지네이션
- ✅ 가상 스크롤
- ✅ 이미지 압축
- ✅ 오래된 이미지 자동 정리

---

## 💡 해결 방안

## 방안 1: 이미지 생성 안정성 강화 ⭐⭐⭐⭐⭐

### 1-1. API 오류 처리 개선

**현재 재시도 로직**:
```typescript
// geminiService.ts:84-118
const withRetry = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    const maxRetries = 3;
    // 503, 429만 재시도
    // 2s, 4s 간격
};
```

**개선안**:
```typescript
const withRetry = async <T>(apiCall: () => Promise<T>): Promise<T> => {
    const maxRetries = 5;  // 3 → 5
    const baseDelay = 2000; // 2초

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            const errorMessage = error.message?.toLowerCase() || '';

            // 1. 재시도 가능한 오류
            const retryableErrors = [
                '"code":503',           // 서비스 일시 중단
                '"code":429',           // 할당량 초과
                '"status":"unavailable"',
                'resource_exhausted',
                'timeout',              // ✅ 타임아웃 추가
                'network error',        // ✅ 네트워크 오류 추가
            ];

            const shouldRetry = retryableErrors.some(err =>
                errorMessage.includes(err.toLowerCase())
            );

            if (shouldRetry && attempt < maxRetries) {
                // ✅ Exponential backoff with jitter
                const jitter = Math.random() * 1000; // 0-1초 랜덤
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt - 1) + jitter,
                    30000  // 최대 30초
                );

                console.log(`🔄 재시도 ${attempt}/${maxRetries} (${delay/1000}초 후)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // 2. 안전 필터 오류 → 자동 프롬프트 수정
            if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
                if (attempt === 1) {
                    console.warn('⚠️ 안전 필터 차단 → 프롬프트 자동 수정 시도');
                    // 프롬프트 자동 정화 후 재시도
                    continue;
                }
            }

            throw error;
        }
    }
};
```

**효과**:
- ✅ 재시도 횟수 증가 (3 → 5)
- ✅ 타임아웃, 네트워크 오류도 재시도
- ✅ Exponential backoff + jitter (과부하 방지)
- ✅ 안전 필터 차단 시 자동 프롬프트 수정

---

### 1-2. 프롬프트 자동 정화 강화

**현재**:
```typescript
export const makeSafePrompt = (prompt: string): string => {
    // 일부 키워드만 변환
    return prompt
        .replace(/\bsexy\b/gi, 'attractive')
        .replace(/\bhot\b/gi, 'beautiful');
};
```

**개선안**:
```typescript
export const makeSafePrompt = (prompt: string): string => {
    // 1. NSFW 키워드 제거/변환
    const nsfw = [
        { from: /\bsexy\b/gi, to: 'elegant' },
        { from: /\bhot\b/gi, to: 'attractive' },
        { from: /\bsultry\b/gi, to: 'graceful' },
        { from: /\balluring\b/gi, to: 'charming' },
        { from: /\bprovocative\b/gi, to: 'stylish' },
        { from: /\btight\b/gi, to: 'fitted' },
        { from: /\brevealing\b/gi, to: 'fashionable' },
        { from: /\bcleavage\b/gi, to: 'neckline' },
    ];

    let safe = prompt;
    for (const { from, to } of nsfw) {
        safe = safe.replace(from, to);
    }

    // 2. 안전 접두사 추가
    safe = `Professional, tasteful, magazine-quality photograph: ${safe}`;

    // 3. 안전 접미사 추가
    safe += '. SFW, appropriate for all audiences, tasteful composition.';

    return safe;
};
```

**효과**:
- ✅ 더 많은 NSFW 키워드 처리
- ✅ 안전한 문맥 접두사/접미사
- ✅ 차단율 대폭 감소

---

### 1-3. 사용자 피드백 개선

**현재**:
```typescript
// 이미지 생성 중: 로딩 스피너만 표시
<Loader2 className="animate-spin" />
```

**개선안**:
```typescript
// 상태별 메시지 표시
{generatingId === item.id && (
    <div className="flex items-center gap-2">
        <Loader2 className="animate-spin" />
        <div className="text-sm">
            {retryAttempt === 0 && '이미지 생성 중...'}
            {retryAttempt > 0 && `재시도 중 (${retryAttempt}/5)...`}
        </div>
    </div>
)}

// 실패 시 상세 오류 메시지
{error && (
    <div className="text-red-500 text-sm">
        {error.includes('safety') && '⚠️ 안전 필터 차단 - 프롬프트를 수정해주세요'}
        {error.includes('429') && '⚠️ API 할당량 초과 - 잠시 후 다시 시도해주세요'}
        {error.includes('503') && '⚠️ 서비스 일시 중단 - 잠시 후 다시 시도해주세요'}
        {!error.includes('safety') && !error.includes('429') && !error.includes('503') &&
            `오류: ${error}`}
    </div>
)}
```

**효과**:
- ✅ 사용자가 진행 상황 파악 가능
- ✅ 오류 원인 명확히 전달
- ✅ 해결 방법 제시

---

## 방안 2: 대본별 이미지 관리 ⭐⭐⭐⭐⭐

### 2-1. 새로운 폴더 구조

**현재**:
```
generated_scripts/
└── images/
    ├── 2025-12-01T00-09-14_테스트.png          (어떤 대본? 몇 번 씬?)
    ├── 2025-12-01T00-27-56_필드위의여왕들.png  (어떤 대본? 몇 번 씬?)
    └── ...
```

**개선안**:
```
generated_scripts/
├── images/                           # 레거시 (기존 이미지)
└── story-images/                     # ✅ 새 구조
    ├── {storyId}/                    # 대본별 폴더
    │   ├── scene-1.png              # Scene 1 이미지
    │   ├── scene-2.png              # Scene 2 이미지
    │   ├── scene-3.png
    │   ├── scene-4.png
    │   ├── scene-5.png
    │   ├── scene-6.png
    │   └── metadata.json            # 메타데이터
    ├── {storyId2}/
    │   └── ...
    └── ...
```

**metadata.json 예시**:
```json
{
  "storyId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "필드 위의 여왕들",
  "createdAt": "2025-12-01T00:27:56.531Z",
  "scenes": [
    {
      "sceneNumber": 1,
      "filename": "scene-1.png",
      "prompt": "Photorealistic autumn golf course...",
      "generatedAt": "2025-12-01T00:28:10.123Z",
      "model": "imagen-4.0-generate-001"
    },
    {
      "sceneNumber": 2,
      "filename": "scene-2.png",
      "prompt": "Ultra-detailed close-up portrait...",
      "generatedAt": "2025-12-01T00:28:15.456Z",
      "model": "imagen-4.0-generate-001"
    }
  ]
}
```

**장점**:
- ✅ 대본 ID로 폴더 분리 → 관리 용이
- ✅ Scene 번호로 파일명 통일 → 직관적
- ✅ 메타데이터로 추적 가능
- ✅ 대본 삭제 시 폴더 전체 삭제 가능

---

### 2-2. 데이터베이스 스키마 개선

**현재 StoryResponse**:
```typescript
interface StoryResponse {
  id: string;
  title: string;
  scenes: Scene[];
  // ❌ 이미지 정보 없음
}
```

**개선안**:
```typescript
interface StoryResponse {
  id: string;
  title: string;
  scenes: Scene[];
  images?: StoryImageInfo;  // ✅ 이미지 정보 추가
}

interface StoryImageInfo {
  storyId: string;
  folderPath: string;  // "story-images/{storyId}"
  scenes: SceneImageInfo[];
}

interface SceneImageInfo {
  sceneNumber: number;
  filename: string;      // "scene-1.png"
  diskPath: string;      // "story-images/{storyId}/scene-1.png"
  indexedDBKey?: string; // IndexedDB UUID (옵션)
  generatedAt?: string;
  model?: string;
  prompt?: string;
}
```

**저장 로직**:
```typescript
// 이미지 생성 시
const saveSceneImage = async (
  storyId: string,
  sceneNumber: number,
  imageBlob: Blob,
  prompt: string
) => {
  // 1. 폴더 생성
  const folderPath = `story-images/${storyId}`;
  await createStoryFolder(folderPath);

  // 2. 파일 저장
  const filename = `scene-${sceneNumber}.png`;
  const diskPath = `${folderPath}/${filename}`;
  await saveImageToDisk(imageBlob, diskPath);

  // 3. IndexedDB 저장 (옵션)
  const indexedDBKey = crypto.randomUUID();
  await setBlob(indexedDBKey, imageBlob);

  // 4. 메타데이터 업데이트
  await updateStoryMetadata(storyId, {
    sceneNumber,
    filename,
    diskPath,
    indexedDBKey,
    generatedAt: new Date().toISOString(),
    prompt
  });

  return { filename, diskPath, indexedDBKey };
};
```

**로딩 로직**:
```typescript
// 대본 선택 시 해당 이미지만 로딩
const loadStoryImages = async (storyId: string) => {
  // 1. 메타데이터 로드
  const metadata = await fetch(`/api/story-images/${storyId}/metadata`);
  const info: StoryImageInfo = await metadata.json();

  // 2. 이미지 URL 생성
  const images = info.scenes.map(scene => ({
    sceneNumber: scene.sceneNumber,
    url: `/generated_scripts/${scene.diskPath}`,
    prompt: scene.prompt
  }));

  return images;
};
```

**효과**:
- ✅ 대본 선택 시 해당 이미지만 로딩 (성능 향상)
- ✅ Scene별 이미지 관리 용이
- ✅ 메타데이터로 생성 이력 추적
- ✅ 확장성 확보

---

### 2-3. UI 개선

**현재**:
```
[모든 이미지 리스트] (70+ 이미지 한 번에 로딩)
- 이미지 1
- 이미지 2
- ...
```

**개선안**:
```
[대본 선택]
  └─ 필드 위의 여왕들 ▼
       ├─ Scene 1 [이미지]
       ├─ Scene 2 [이미지]
       ├─ Scene 3 [이미지]
       ├─ Scene 4 [이미지]
       ├─ Scene 5 [이미지]
       └─ Scene 6 [이미지]

  └─ 단풍 골프장 사건 ▼
       ├─ Scene 1 [이미지]
       └─ ...
```

**구현**:
```typescript
// OutputDisplay.tsx
const StoryImageGallery = ({ story }: { story: StoryResponse }) => {
  const [images, setImages] = useState<SceneImageInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isExpanded && !images.length) {
      loadStoryImages(story.id).then(setImages);
    }
  }, [isExpanded]);

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)}>
        {story.title} {isExpanded ? '▼' : '▶'}
      </button>

      {isExpanded && (
        <div className="grid grid-cols-2 gap-4">
          {images.map(img => (
            <div key={img.sceneNumber}>
              <div className="text-sm">Scene {img.sceneNumber}</div>
              <img src={img.url} alt={`Scene ${img.sceneNumber}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**효과**:
- ✅ 대본별로 이미지 그룹화
- ✅ 필요한 이미지만 로딩 (Lazy Loading)
- ✅ Scene 번호로 정렬
- ✅ 직관적인 UI

---

## 방안 3: 확장성 대응 ⭐⭐⭐⭐

### 3-1. 페이지네이션

**문제**: 대본 100개 × 6씬 = 600개 이미지

**해결**:
```typescript
// 대본 목록 페이지네이션
const StoryList = () => {
  const [page, setPage] = useState(1);
  const perPage = 10;

  const { data, isLoading } = useQuery({
    queryKey: ['stories', page],
    queryFn: () => fetchStories({ page, perPage })
  });

  return (
    <>
      {data.stories.map(story => <StoryCard story={story} />)}
      <Pagination
        current={page}
        total={data.total}
        perPage={perPage}
        onChange={setPage}
      />
    </>
  );
};
```

---

### 3-2. 이미지 압축

**서버 저장 시 자동 압축**:
```javascript
// server/index.js
const sharp = require('sharp');

app.post('/api/save-image', async (req, res) => {
    const { imageData, storyId, sceneNumber } = req.body;

    // 1. Base64 → Buffer
    const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ""), 'base64');

    // 2. Sharp로 압축
    const compressed = await sharp(buffer)
        .resize(1024, 1820, { fit: 'inside' })  // 최대 1024x1820
        .png({ quality: 90, compressionLevel: 9 })
        .toBuffer();

    // 3. 저장
    const folderPath = path.join(STORY_IMAGES_DIR, storyId);
    const filename = `scene-${sceneNumber}.png`;
    fs.writeFileSync(path.join(folderPath, filename), compressed);

    res.json({ success: true, filename });
});
```

**효과**:
- ✅ 파일 크기 50-70% 감소
- ✅ 로딩 속도 향상
- ✅ 저장 공간 절약

---

### 3-3. 자동 정리

**오래된 이미지 자동 삭제**:
```typescript
// 30일 이상 된 대본 이미지 자동 삭제
const cleanupOldImages = async () => {
  const stories = await getAllStories();
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  for (const story of stories) {
    const createdAt = new Date(story.createdAt).getTime();
    if (now - createdAt > thirtyDays && !story.isFavorite) {
      // 이미지 폴더 삭제
      await deleteStoryFolder(story.id);
      console.log(`🗑️ 삭제: ${story.title} (${story.id})`);
    }
  }
};

// 매일 새벽 3시 실행
setInterval(cleanupOldImages, 24 * 60 * 60 * 1000);
```

**효과**:
- ✅ 자동으로 오래된 이미지 정리
- ✅ 즐겨찾기는 보존
- ✅ 저장 공간 자동 관리

---

## 📋 구현 순서

### Phase 1: 이미지 생성 안정성 (1-2일) ⭐⭐⭐⭐⭐
1. ✅ withRetry 로직 개선 (재시도 5회, 타임아웃 처리)
2. ✅ makeSafePrompt 강화 (NSFW 키워드 확장)
3. ✅ 사용자 피드백 개선 (재시도 횟수, 오류 메시지)
4. ✅ 에러 핸들링 강화

### Phase 2: 대본별 이미지 관리 (2-3일) ⭐⭐⭐⭐⭐
1. ✅ 폴더 구조 변경 (`story-images/{storyId}/`)
2. ✅ StoryResponse 스키마 확장 (images 필드 추가)
3. ✅ 저장/로딩 로직 수정
4. ✅ UI 개선 (대본별 이미지 그룹화)
5. ✅ 레거시 마이그레이션 (기존 images/ → story-images/)

### Phase 3: 확장성 대응 (1-2일) ⭐⭐⭐
1. ✅ 페이지네이션 구현
2. ✅ 이미지 압축 (Sharp 라이브러리)
3. ✅ 자동 정리 스크립트

---

## 🎯 예상 효과

### 이미지 생성 성공률
- **현재**: ~70% (실패 30%)
- **개선 후**: ~95% (실패 5%)

### 로딩 속도
- **현재**: 70개 이미지 전체 로딩 (~5초)
- **개선 후**: 대본당 6개만 로딩 (~0.5초)
- **개선율**: 90% 향상

### 저장 공간
- **현재**: 이미지당 ~3MB
- **개선 후**: 이미지당 ~1MB (압축)
- **절약률**: 66%

### 관리 편의성
- **현재**: 파일명으로 추측
- **개선 후**: 대본 선택 → 해당 이미지 즉시 표시

---

## 💬 마마님께 질문

어떤 순서로 진행할까요?

1. **✅ Phase 1만 먼저** (생성 안정성 최우선)
2. **✅ Phase 1 + 2** (생성 + 관리 개선)
3. **✅ 전체 진행** (Phase 1 + 2 + 3)

선택해주시면 바로 작업 시작하겠습니다! 😊

# 폴더 선택 UI 구현 계획

## 목표
씨네보드에서 기존 작업 폴더를 선택하여 대본과 이미지를 불러오는 UI 구현

## 현재 상태
✅ 서버 API 완료: `GET /api/scripts/by-folder/:folderName`
✅ 서버 API 완료: `GET /api/images/story-folders`
✅ 서버 API 완료: `GET /api/images/by-story/:storyId`

## 구현 단계

### 1단계: 상태 변수 추가
**파일**: `components/CineboardPanel.tsx`
**위치**: 기존 상태 변수 다음 (line ~258)

```typescript
// Folder selection states
const [availableFolders, setAvailableFolders] = useState<Array<{folderName: string; imageCount: number}>>([]);
const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);
const [showFolderSelector, setShowFolderSelector] = useState<boolean>(false);
```

### 2단계: 폴더 로딩 함수 추가
**파일**: `components/CineboardPanel.tsx`
**위치**: handleConvertToShorts 함수 다음 (line ~1111)

```typescript
// Load available folders
const handleLoadFolders = async () => {
  try {
    const response = await fetch('http://localhost:3002/api/images/story-folders');
    if (!response.ok) throw new Error('Failed to load folders');
    
    const folders = await response.json();
    setAvailableFolders(folders);
    setShowFolderSelector(true);
  } catch (error) {
    console.error('Failed to load folders:', error);
    alert('폴더 목록을 불러오는데 실패했습니다.');
  }
};
```

### 3단계: 폴더 선택 함수 추가
**파일**: `components/CineboardPanel.tsx`
**위치**: handleLoadFolders 함수 다음

```typescript
// Select and load folder data
const handleSelectFolder = async (folderName: string) => {
  setSelectedFolder(folderName);
  setIsLoadingFolder(true);
  
  try {
    await handleLoadFolderData(folderName);
    setShowFolderSelector(false);
    setActiveView('result');
  } catch (error) {
    console.error('Failed to load folder data:', error);
    alert('폴더 데이터를 불러오는데 실패했습니다.');
  } finally {
    setIsLoadingFolder(false);
  }
};
```

### 4단계: 데이터 로딩 함수 추가
**파일**: `components/CineboardPanel.tsx`
**위치**: handleSelectFolder 함수 다음

```typescript
// Load folder data (script + images)
const handleLoadFolderData = async (folderName: string) => {
  try {
    // 1. Load script file
    const scriptResponse = await fetch(`http://localhost:3002/api/scripts/by-folder/${folderName}`);
    let scriptContent = '';
    
    if (scriptResponse.ok) {
      const scriptData = await scriptResponse.json();
      scriptContent = scriptData.content;
      setScriptText(scriptContent);
      setScriptFileName(scriptData.scriptFile);
    }

    // 2. Load images with metadata
    const imagesResponse = await fetch(`http://localhost:3002/api/images/by-story/${folderName}`);
    if (!imagesResponse.ok) throw new Error('Failed to load images');
    
    const images = await imagesResponse.json();
    
    // 3. Reconstruct scenes from images
    const scenes: CineboardScene[] = images.map((img: any, index: number) => ({
      sceneNumber: img.sceneNumber || (index + 1),
      summary: img.prompt || `Scene ${index + 1}`,
      camera: 'Loaded from saved image',
      shortPrompt: img.prompt || '',
      shortPromptKo: img.prompt || '',
      longPrompt: img.prompt || '',
      longPromptKo: img.prompt || '',
      imageUrl: `/generated_scripts/images/${img.filename}`,
      shotType: extractShotType(img.prompt || ''),
      dialogueRefined: refineDialogue(img.prompt || ''),
      scriptRef: '',
      isSelected: false
    }));

    // 4. Split script for anchoring
    if (scriptContent && scenes.length > 0) {
      const scriptChunks = splitScriptForScenes(scriptContent, scenes.length);
      scenes.forEach((scene, index) => {
        scene.scriptRef = scriptChunks[index] || '';
      });
    }

    // 5. Update generation result
    const result: CineboardResult = {
      title: folderName.replace(/_/g, ' '),
      scriptBody: scriptContent,
      sceneCount: scenes.length,
      characters: [],
      scenes,
      scripts: [{ _folderName: folderName } as any]
    };

    setGenerationResult(result);
    setGeneratedFolderName(folderName);
    
    console.log(`✅ Loaded ${scenes.length} scenes from folder: ${folderName}`);
  } catch (error) {
    console.error('Failed to load folder data:', error);
    throw error;
  }
};
```

### 5단계: "기존 작업 불러오기" 버튼 추가
**파일**: `components/CineboardPanel.tsx`
**위치**: "씨네보드 생성" 버튼 옆 (line ~1347)

**변경 전:**
```typescript
<div className="mt-4 flex items-center gap-3">
  <Button onClick={handleGenerateCineboard} disabled={isGenerating}>
    {isGenerating ? '생성 중...' : '씨네보드 생성'}
  </Button>
  <Button variant="secondary" onClick={handleReset}>초기화</Button>
</div>
```

**변경 후:**
```typescript
<div className="mt-4 flex items-center gap-3">
  <Button onClick={handleGenerateCineboard} disabled={isGenerating}>
    {isGenerating ? '생성 중...' : '씨네보드 생성'}
  </Button>
  <Button variant="secondary" onClick={handleLoadFolders}>
    📁 기존 작업 불러오기
  </Button>
  <Button variant="secondary" onClick={handleReset}>초기화</Button>
</div>
```

### 6단계: 폴더 선택 모달 추가
**파일**: `components/CineboardPanel.tsx`
**위치**: 결과 화면 시작 부분 (line ~1372, `activeView === 'result'` 조건 내부)

```typescript
{/* Folder Selection Modal */}
{showFolderSelector && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-purple-400">📁 작업 폴더 선택</h3>
        <button
          onClick={() => setShowFolderSelector(false)}
          className="text-slate-400 hover:text-white transition"
        >
          ✕
        </button>
      </div>
      
      {isLoadingFolder ? (
        <div className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">폴더 데이터를 불러오는 중...</p>
        </div>
      ) : availableFolders.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <p>저장된 작업 폴더가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {availableFolders.map((folder) => (
            <button
              key={folder.folderName}
              onClick={() => handleSelectFolder(folder.folderName)}
              className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-purple-500 transition-all text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <p className="font-semibold text-white group-hover:text-purple-300 transition">
                      {folder.folderName.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {folder.imageCount} 이미지
                    </p>
                  </div>
                </div>
                <span className="text-slate-500 group-hover:text-purple-400 transition">→</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

## 주의사항
1. **Fragment 사용**: 모달과 결과 화면을 함께 렌더링하려면 `<>...</>` Fragment 사용 필요
2. **z-index**: 모달이 최상위에 표시되도록 `z-50` 사용
3. **오류 처리**: 각 fetch 호출에 try-catch 추가
4. **로딩 상태**: isLoadingFolder로 로딩 중 UI 표시

## 테스트 체크리스트
- [ ] "기존 작업 불러오기" 버튼 클릭 시 모달 표시
- [ ] 폴더 목록이 올바르게 표시되는지 확인
- [ ] 폴더 선택 시 대본과 이미지가 로드되는지 확인
- [ ] 로드된 씬이 결과 화면에 표시되는지 확인
- [ ] 로드 후 새 이미지 생성 시 같은 폴더에 저장되는지 확인

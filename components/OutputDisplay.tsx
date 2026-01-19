
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { StoryResponse } from '../types';
import { ImageHistoryItem } from './master-studio/types';
import { Copy, Check, FileText, Image as ImageIcon, Layers, Video, Edit, Save, X, Loader2, Download, Maximize, History as HistoryIcon, Shield, ShieldOff, ChevronDown, ChevronUp, Sparkles, Star, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { generateImageWithImagen, generateImage, initGeminiService, enhancePrompt, fetchAvailableModels, makeSafePrompt } from './master-studio/services/geminiService';
import { getBlob, setBlob, deleteBlob } from './master-studio/services/dbService';
import { fetchDiskImageList, fetchImageStoryFolders, StoryFolderInfo } from './master-studio/services/diskImageList';
import { saveImageToDisk, deleteFileFromDisk } from './master-studio/services/serverService';
import Lightbox from './master-studio/Lightbox';
import { showToast } from './Toast';

const STORY_FILTER_ALL = 'all';
const STORY_FILTER_ORPHANED = '__legacy__';

interface OutputDisplayProps {
  data: StoryResponse;
  onUpdate?: (updated: StoryResponse) => void;
}

const toDisplayString = (val: any) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'script' | 'short' | 'long' | 'sora'>('script');
  const [showImagePrompts, setShowImagePrompts] = useState(true); // Changed from false to true
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>(toDisplayString(data.title));
  const safeScenes = Array.isArray(data.scenes) ? data.scenes : [];
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [noGuard, setNoGuard] = useState(false); // [NEW] Safety Filter Toggle
  // ✅ FIX: useMemo로 data._folderName 변경 시 재계산되도록 수정
  const folderNameFromData = useMemo(() =>
    ((data as any)?._folderName as string | undefined) || undefined,
    [(data as any)?._folderName]
  );
  const [storyFolderName, setStoryFolderName] = useState<string | undefined>(folderNameFromData);
  const [storyFilter, setStoryFilter] = useState<string>(STORY_FILTER_ALL);
  const [storyFolders, setStoryFolders] = useState<StoryFolderInfo[]>([]);
  const [isStoryFolderLoading, setIsStoryFolderLoading] = useState(false);
  const [remoteFolderImages, setRemoteFolderImages] = useState<ImageHistoryItem[]>([]);
  const [isRemoteFolderLoading, setIsRemoteFolderLoading] = useState(false);

  // --- Image Generation State ---
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [historyImages, setHistoryImages] = useState<Record<string, string>>({}); // Map of resolved URLs
  const historyImagesRef = useRef<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null); // Track which prompt is generating
  const [aiForwardingId, setAiForwardingId] = useState<string | null>(null); // Track which prompt is being sent to Puppeteer AI
  const aiForwardAbortRef = useRef<AbortController | null>(null);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ImageHistoryItem | null>(null);
  const [isEnhancingAll, setIsEnhancingAll] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Model Selection State
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [imageModel, setImageModel] = useState<string>('imagen-4.0-generate-001');
  const [isModelLoading, setIsModelLoading] = useState(false);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setStoryFolderName(folderNameFromData || undefined);
  }, [data.id, folderNameFromData]);

  useEffect(() => {
    handleRefreshModels();
  }, []);

  const refreshStoryFolderList = useCallback(async () => {
    setIsStoryFolderLoading(true);
    try {
      if (generatingId === data.id) {
        setGeneratingId(null);
        return;
      }
      const folders = await fetchImageStoryFolders();
      if (Array.isArray(folders)) {
        setStoryFolders(folders);
      }
    } catch (err) {
      console.error("Failed to fetch story folders", err);
    } finally {
      setIsStoryFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStoryFolderList();
  }, [refreshStoryFolderList]);

  useEffect(() => {
    if (storyFolderName) {
      refreshStoryFolderList();
    }
  }, [storyFolderName, refreshStoryFolderList]);

  const fetchRemoteImagesForStory = useCallback(async (targetStoryId: string) => {
    if (!targetStoryId || targetStoryId === STORY_FILTER_ALL || targetStoryId === STORY_FILTER_ORPHANED) {
      setRemoteFolderImages([]);
      return;
    }
    setIsRemoteFolderLoading(true);
    try {
      const endpoints = [
        `http://localhost:3002/api/images/by-story/${encodeURIComponent(targetStoryId)}`,
        `http://127.0.0.1:3002/api/images/by-story/${encodeURIComponent(targetStoryId)}`
      ];
      for (const url of endpoints) {
        try {
          const resp = await fetch(`${url}?t=${Date.now()}`);
          if (!resp.ok) continue;
          const files = await resp.json();
          console.log(`[OutputDisplay] Received ${files?.length || 0} files from server:`, files);
          if (Array.isArray(files)) {
            const syntheticItems: ImageHistoryItem[] = files.map((item: any, idx: number) => {
              // Support both old format (string) and new format (object with metadata)
              const filename = typeof item === 'string' ? item : item.filename;
              const prompt = typeof item === 'string' ? item : (item.prompt || filename);

              console.log(`[OutputDisplay] Processing item ${idx}: filename=${filename}, prompt=${prompt?.substring(0, 50)}...`);

              return {
                id: `remote-${targetStoryId}-${filename}-${idx}`,
                prompt: prompt,
                generatedImageId: '',
                storyId: targetStoryId,
                favorite: false,
                createdAt: typeof item === 'object' && item.createdAt
                  ? new Date(item.createdAt).getTime()
                  : Date.now() - idx,
                localFilename: filename,
                settings: {
                  mode: 'Generate',
                  aspectRatio: '9:16',
                  activeCheatKeys: [],
                  noGuard: false,
                  enhanceBackground: false,
                  removeBackground: false,
                  creativity: 0.8
                }
              };
            });
            console.log(`[OutputDisplay] Created ${syntheticItems.length} synthetic items`);
            setRemoteFolderImages(syntheticItems);
            return;
          }
        } catch (err) {
          console.error("Failed to fetch remote folder images", err);
        }
      }
      setRemoteFolderImages([]);
    } finally {
      setIsRemoteFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRemoteImagesForStory(storyFilter);
  }, [storyFilter, fetchRemoteImagesForStory]);

  const updateStoryFolderBinding = useCallback((nextFolderName: string) => {
    if (!nextFolderName) return;
    setStoryFolderName(prev => (prev === nextFolderName ? prev : nextFolderName));
    if (onUpdate) {
      onUpdate({ ...data, ...({ _folderName: nextFolderName } as any) });
    }
    setStoryFilter(prev => {
      if (prev === data.id) return nextFolderName;
      return prev;
    });
    setImageHistory(prev => {
      let changed = false;
      const updated = prev.map(item => {
        if (!item) return item;
        if (item.storyId === data.id || (storyFolderName && item.storyId === storyFolderName)) {
          changed = true;
          return { ...item, storyId: nextFolderName };
        }
        return item;
      });
      return changed ? updated : prev;
    });
    refreshStoryFolderList();
  }, [data, onUpdate, storyFolderName, refreshStoryFolderList]);

  const ensureStoryFolderReady = useCallback(async (): Promise<string> => {
    // 1. If storyFolderName already exists, use it immediately
    if (storyFolderName) {
      console.log(`[ensureStoryFolderReady] Using existing folder: ${storyFolderName}`);
      return storyFolderName;
    }

    // 2. Check if data._folderName exists (from geminiService)
    const existingFolderName = (data as any)?._folderName;
    if (existingFolderName && typeof existingFolderName === 'string') {
      console.log(`[ensureStoryFolderReady] Using data._folderName: ${existingFolderName}`);
      updateStoryFolderBinding(existingFolderName);
      return existingFolderName;
    }

    // 3. Create new folder if none exists
    const normalizedTitle = (selectedTitle || data.title || '').trim() || `Story_${data.id}`;
    console.log(`[ensureStoryFolderReady] Creating new folder for: ${normalizedTitle}`);

    try {
      const response = await fetch('http://localhost:3002/api/create-story-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: normalizedTitle })
      });

      if (!response.ok) {
        console.error(`[ensureStoryFolderReady] HTTP error: ${response.status}`);
        throw new Error('스토리 폴더를 준비하지 못했습니다.');
      }

      const payload = await response.json();
      if (!payload?.success || !payload?.folderName) {
        console.error('[ensureStoryFolderReady] Invalid response:', payload);
        throw new Error(payload?.error || '스토리 폴더 생성에 실패했습니다.');
      }

      console.log(`[ensureStoryFolderReady] Folder created: ${payload.folderName}`);
      updateStoryFolderBinding(payload.folderName);
      return payload.folderName;
    } catch (error) {
      console.error('[ensureStoryFolderReady] Error:', error);
      throw error;
    }
  }, [storyFolderName, selectedTitle, data.id, data.title, data, updateStoryFolderBinding]);

  const handleRefreshModels = async () => {
    setIsModelLoading(true);
    try {
      const models = await fetchAvailableModels();
      if (models.length > 0) {
        setAvailableModels(models);
      }
    } catch (e) {
      console.error("Failed to load models", e);
    } finally {
      setIsModelLoading(false);
    }
  };

  // Load history from shared local storage (sync with Master Studio)
  useEffect(() => {
    initGeminiService();

    // 1. Migration: Move old base64 images to IndexedDB if they exist and haven't been migrated
    const migrateOldHistory = async () => {
      try {
        const oldHistoryRaw = localStorage.getItem('shorts-image-history');
        if (oldHistoryRaw) {
          const oldHistory = JSON.parse(oldHistoryRaw);
          if (Array.isArray(oldHistory) && oldHistory.length > 0) {
            console.log("Migrating image history to IndexedDB...");
            const newItems: ImageHistoryItem[] = [];

            for (const item of oldHistory) {
              if (item.url && item.url.startsWith('data:image')) {
                // Extract Blob
                const response = await fetch(item.url);
                const blob = await response.blob();
                const imageId = crypto.randomUUID();
                await setBlob(imageId, blob);

                newItems.push({
                  id: item.id || crypto.randomUUID(),
                  prompt: item.prompt || '',
                  generatedImageId: imageId,
                  settings: {
                    mode: 'Generate',
                    aspectRatio: '9:16',
                    activeCheatKeys: [],
                    noGuard: false,
                    enhanceBackground: false,
                    removeBackground: false,
                    creativity: 0.8
                  }
                });
              }
            }

            // Merge with existing shared history
            const sharedHistoryRaw = localStorage.getItem('imageHistory');
            const sharedHistory = sharedHistoryRaw ? JSON.parse(sharedHistoryRaw) : [];
            const merged = [...newItems, ...sharedHistory];

            localStorage.setItem('imageHistory', JSON.stringify(merged));
            localStorage.removeItem('shorts-image-history'); // Clear old storage to fix quota error/crash
            console.log("Migration complete. Old history cleared.");
            setImageHistory(merged);
            return;
          }
        }
      } catch (e) {
        console.error("Migration failed:", e);
        // If migration fails (e.g., corrupted data), just clear it to unblock user
        localStorage.removeItem('shorts-image-history');
      }
    };

    migrateOldHistory().then(() => {
      // 2. Load Shared History
      try {
        const saved = localStorage.getItem('imageHistory');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Deduplicate by ID
            const uniqueCallback = (item: any, index: number, self: any[]) =>
              index === self.findIndex((t) => (t.id === item.id));
            const uniqueHistory = parsed.filter(uniqueCallback);

            setImageHistory(uniqueHistory);

            // Clean up storage if duplicates found
            if (uniqueHistory.length !== parsed.length) {
              console.log(`Removed ${parsed.length - uniqueHistory.length} duplicate items.`);
              localStorage.setItem('imageHistory', JSON.stringify(uniqueHistory));
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load image history", e);
      } finally {
        setIsInitialized(true);
      }
    });

    // Listen for storage events to sync across tabs (Master Studio <-> OutputDisplay)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'imageHistory' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            // Deduplicate sync data too
            const uniqueHistory = parsed.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            setImageHistory(uniqueHistory);
          }
        } catch (e) { console.error("Sync parse error", e); }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Resolve Blob URLs for history items (align with AiStudioHost)
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadingIdsRef = useRef<Set<string>>(new Set());
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const loadUrlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadHistoryImages = async () => {
    const combinedHistory = [...imageHistory, ...remoteFolderImages];
    if (combinedHistory.length === 0) return;

    const needsLoad = combinedHistory.filter(item =>
      (item.generatedImageId || item.localFilename || (item as any).url) &&
      !historyImages[item.id] &&
      !loadingIdsRef.current.has(item.id) &&
      !loadedIdsRef.current.has(item.id)
    );

    if (needsLoad.length === 0) return;

    console.log(`[Performance] OutputDisplay loading ${needsLoad.length} thumbnails (${loadedIdsRef.current.size} already loaded)`);

    needsLoad.forEach(item => loadingIdsRef.current.add(item.id));

    const fetchFromLocalFile = async (filename: string): Promise<string | null> => {
      const candidates = [
        `/generated_scripts/images/${filename}`,
        `http://localhost:3002/generated_scripts/images/${filename}`,
        `http://127.0.0.1:3002/generated_scripts/images/${filename}`
      ];
      for (const url of candidates) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            return URL.createObjectURL(blob);
          }
        } catch {
          // ignore and try next candidate
        }
      }
      return null;
    };

    const newUrls: Record<string, string> = {};
    await Promise.all(needsLoad.map(async (item) => {
      try {
        let url: string | null = null;
        if (item.generatedImageId) {
          const blob = await getBlob(item.generatedImageId);
          if (blob) {
            url = URL.createObjectURL(blob);
          }
        }

        if (!url && item.localFilename) {
          url = await fetchFromLocalFile(item.localFilename);
        }

        if (!url && (item as any).url) {
          url = (item as any).url;
        }

        if (url && isMountedRef.current) {
          newUrls[item.id] = url;
          loadedIdsRef.current.add(item.id);
        }
      } catch (e) {
        console.error(`Failed to load image for ${item.id}`, e);
      } finally {
        loadingIdsRef.current.delete(item.id);
      }
    }));

    if (isMountedRef.current && Object.keys(newUrls).length > 0) {
      setHistoryImages(prev => ({ ...prev, ...newUrls }));
      console.log(`[Performance] OutputDisplay loaded ${Object.keys(newUrls).length} thumbnails`);
    }
  };

  useEffect(() => {
    if (loadUrlsTimeoutRef.current) {
      clearTimeout(loadUrlsTimeoutRef.current);
    }
    loadUrlsTimeoutRef.current = setTimeout(() => {
      loadHistoryImages();
    }, 300);

    return () => {
      if (loadUrlsTimeoutRef.current) {
        clearTimeout(loadUrlsTimeoutRef.current);
      }
    };
  }, [imageHistory, remoteFolderImages]); // intentionally exclude historyImages to avoid loops

  useEffect(() => {
    historyImagesRef.current = historyImages;
  }, [historyImages]);

  useEffect(() => {
    return () => {
      Object.values(historyImagesRef.current).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore revoke errors
        }
      });
      historyImagesRef.current = {};
    };
  }, []);

  // Fallback: if no history items, pull disk images list to display legacy files (limited)
  useEffect(() => {
    const bootstrapFromDisk = async () => {
      if (!isInitialized) return; // Wait for localStorage load
      if (imageHistory.length > 0) return;
      const files = await fetchDiskImageList();
      if (files.length === 0) return;
      const synthetic = files.slice(0, 50).map((filename, idx) => ({
        id: `disk-${idx}-${filename}`,
        prompt: filename,
        generatedImageId: '',
        favorite: false,
        createdAt: Date.now(),
        localFilename: filename,
        settings: {
          mode: 'Generate',
          aspectRatio: '9:16',
          activeCheatKeys: [],
          noGuard: false,
          enhanceBackground: false,
          removeBackground: false,
          creativity: 0.8
        }
      } as ImageHistoryItem));
      setImageHistory(synthetic);
    };
    bootstrapFromDisk();
  }, [imageHistory.length, isInitialized]);

  // Save history to shared local storage whenever it changes
  useEffect(() => {
    if (imageHistory.length > 0) {
      localStorage.setItem('imageHistory', JSON.stringify(imageHistory));
    }
  }, [imageHistory]);

  const handleGenerateImage = async (prompt: string, id: string, sceneNumber?: number) => {
    if (generatingId) return;
    setGeneratingId(id);

    try {
      const safetySettings = noGuard ? [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
      ] : undefined;

      let result: any;
      if (imageModel.toLowerCase().includes('imagen')) {
        // Imagen Model
        result = await generateImageWithImagen(prompt, "", { aspectRatio: "9:16", model: imageModel }, safetySettings);
      } else {
        // Gemini Model (e.g., gemini-2.5-flash-image)
        result = await generateImage(prompt, { aspectRatio: "9:16", model: imageModel }, safetySettings);
      }

      let base64Image: string | null = null;

      if (result && 'generatedImages' in result && result.generatedImages?.length > 0) {
        const generatedImage = result.generatedImages[0];
        if (generatedImage?.image?.imageBytes) {
          base64Image = generatedImage.image.imageBytes;
        } else if (generatedImage?.imageBytes) {
          // Fallback: sometimes imageBytes is direct
          base64Image = generatedImage.imageBytes;
        }
      }
      else if (result && result.images && result.images.length > 0) {
        base64Image = result.images[0];
      }
      else if (result && result.candidates) {
        const inlineData = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
        if (inlineData?.data) {
          base64Image = inlineData.data;
        }
      }

      if (base64Image) {
        const folderName = await ensureStoryFolderReady();
        const saveResult = await saveImageToDisk(
          base64Image,
          prompt,
          folderName,
          sceneNumber,
          selectedTitle || data.title
        );
        const resolvedFolderName = saveResult?.storyId || folderName;
        if (resolvedFolderName) {
          updateStoryFolderBinding(resolvedFolderName);
        }

        // Save to IndexedDB (as Blob)
        // Normalize data URL to avoid fetch failures in some browsers
        const blob = await fetch(`data:image/png;base64,${base64Image}`).then(res => res.blob());
        const imageId = crypto.randomUUID();
        await setBlob(imageId, blob);

        const savedLocalFilename = saveResult?.filename || '';

        const newItem: ImageHistoryItem = {
          id: crypto.randomUUID(),
          prompt: prompt,
          generatedImageId: imageId,
          storyId: resolvedFolderName || folderName,
          sceneNumber: sceneNumber,   // ✅ Add sceneNumber
          favorite: false,
          createdAt: Date.now(),
          localFilename: savedLocalFilename || undefined,
          settings: {
            mode: 'Generate',
            aspectRatio: '9:16',
            activeCheatKeys: [],
            noGuard: false,
            enhanceBackground: false,
            removeBackground: false,
            creativity: 0.8
          }
        };

        const newHistory = [newItem, ...imageHistory];
        setImageHistory(newHistory);
        localStorage.setItem('imageHistory', JSON.stringify(newHistory));
      } else if (result && 'generatedImages' in result && result.generatedImages?.length === 0) {
        throw new Error("이미지가 생성되지 않았습니다. (생성된 이미지 0개). 안전 정책(Safety Filter)에 의해 차단되었거나, 모델이 요청을 거부했을 수 있습니다. 프롬프트를 수정하여 다시 시도해주세요.");
      } else {
        console.warn("Unexpected image response format:", result);
        throw new Error("이미지 데이터 형식을 인식할 수 없습니다. (응답 형식이 예상과 다릅니다)");
      }
    } catch (error: any) {
      console.error("Image Generation Failed:", error);
      if (error.message?.includes("API key")) {
        const key = window.prompt("API Key가 필요합니다. Google Gemini API Key를 입력해주세요:");
        if (key) {
          localStorage.setItem('master_studio_api_key', key);
          showToast("API Key가 저장되었습니다. 다시 시도해주세요.", 'success');
        }
      } else {
        showToast(`이미지 생성 실패: ${error.message || "알 수 없는 오류"}`, 'error');
      }
    } finally {
      setGeneratingId(null);
      if (!isHistoryOpen) setIsHistoryOpen(true);
    }
  };

  const cancelAiForwarding = () => {
    if (aiForwardAbortRef.current) {
      try {
        aiForwardAbortRef.current.abort();
      } catch (err) {
        console.warn('AI forwarding abort error:', err);
      }
      aiForwardAbortRef.current = null;
    }
    setAiForwardingId(null);
  };

  const handleForwardPromptToImageAI = async (prompt: string, id: string, sceneNumber?: number, storyId?: string, title?: string) => {
    if (aiForwardingId && aiForwardingId === id) {
      cancelAiForwarding();
      showToast('AI 생성 요청을 취소했습니다.', 'info');
      return;
    }
    if (!prompt || !prompt.trim()) {
      showToast('전송할 롱 프롬프트가 없습니다.', 'warning');
      return;
    }
    setAiForwardingId(id);
    try {
      // 🔍 디버깅: ensureStoryFolderReady 호출 전 상태 확인
      console.log('[DEBUG] Before ensureStoryFolderReady:', {
        storyFolderName,
        selectedTitle,
        dataTitle: data.title,
        dataId: data.id,
        data_folderName: (data as any)?._folderName,
        paramStoryId: storyId,
        paramTitle: title
      });

      let folderName = '';
      try {
        folderName = await ensureStoryFolderReady();
      } catch (error) {
        console.warn('[DEBUG] ensureStoryFolderReady failed, checking fallbacks:', error);
        // 폴더 생성 실패해도 파라미터로 받은 storyId가 있으면 사용
        if (storyId) folderName = storyId;
      }

      // 🔍 디버깅: ensureStoryFolderReady 호출 후 상태 확인
      console.log('[DEBUG] After ensureStoryFolderReady:', {
        folderName,
        storyFolderName
      });

      // 제목 결정 우선순위: 파라미터 > 선택된 제목 > 데이터 제목 > Untitled
      const normalizedTitle = (title || selectedTitle || data.title || '').trim() || 'Untitled';

      // 폴더명 결정 우선순위: ensure 결과 > 파라미터 > 데이터 폴더명 > 데이터 ID
      const finalStoryId = folderName || storyId || (data as any)?._folderName || data.id;

      // 🔍 디버깅: API 요청 payload 확인
      console.log('[DEBUG] Request payload:', {
        storyId: finalStoryId,
        title: normalizedTitle,
        sceneNumber,
        service: data.service || 'GEMINI'
      });

      if (aiForwardAbortRef.current) {
        aiForwardAbortRef.current.abort();
      }
      const controller = new AbortController();
      aiForwardAbortRef.current = controller;

      const response = await fetch('http://localhost:3002/api/image/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          storyId: finalStoryId,  // 명시적으로 결정된 ID 전달
          sceneNumber,
          service: data.service || 'GEMINI',
          autoCapture: true,
          title: normalizedTitle
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let message = 'AI 서비스 전송에 실패했습니다.';
        try {
          const errorData = await response.json();
          if (errorData?.error) message = errorData.error;
        } catch (err) {
          console.warn("Failed to parse AI forward error", err);
        }
        throw new Error(message);
      }

      const payload = await response.json();
      const infoDetails: string[] = [];
      if (payload?.imagePath) infoDetails.push(`경로 ${payload.imagePath}`);
      if (typeof payload?.bytes === 'number') {
        const kb = (payload.bytes / 1024).toFixed(1);
        infoDetails.push(`용량 ${kb}KB`);
      }
      if (payload?.hash) {
        const shortHash = String(payload.hash).slice(0, 8);
        infoDetails.push(`해시 ${shortHash}…`);
      }
      const infoMessage = infoDetails.length > 0
        ? ` - ${infoDetails.join(' / ')}`
        : (payload?.message ? ` - ${payload.message}` : '');
      showToast(`AI 서비스(${payload?.service || 'GEMINI'})로 프롬프트를 전송했습니다.${infoMessage}`, 'success');
      if (payload?.storyId) {
        updateStoryFolderBinding(payload.storyId);
        // ⭐ AI 생성 후 이미지 리스트 새로고침 (메타데이터 포함)
        fetchRemoteImagesForStory(payload.storyId);
      }

      if (payload?.tokenMatched === false) {
        showToast('자동 검증 토큰을 확인하지 못했습니다. 최신 응답인지 직접 확인해주세요.', 'warning');
      }
    } catch (error) {
      console.error("Failed to forward prompt to AI image service", error);
      if (error instanceof Error && error.message.includes('Waiting failed')) {
        showToast('이미지를 찾지 못했습니다. 프롬프트 전송 후 새 이미지가 생성되는지 확인해주세요.', 'warning');
      } else {
        showToast(error instanceof Error ? error.message : 'AI 서비스 전송 오류가 발생했습니다.', 'error');
      }
    } finally {
      setAiForwardingId(null);
      if (aiForwardAbortRef.current) {
        aiForwardAbortRef.current = null;
      }
    }
  };

  const handleDeleteImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("정말 이 이미지를 삭제하시겠습니까?")) return;

    const localItem = imageHistory.find(item => item.id === id);
    const remoteItem = remoteFolderImages.find(item => item.id === id);
    const targetItem = localItem || remoteItem;
    if (!targetItem) {
      return;
    }

    if (localItem?.generatedImageId) {
      await deleteBlob(localItem.generatedImageId);
    }

    // Delete local file
    if (targetItem.localFilename) {
      try {
        await deleteFileFromDisk(targetItem.localFilename, 'image');
      } catch (err) {
        console.error("Failed to delete local file", err);
      }
    }

    if (localItem) {
      const newHistory = imageHistory.filter(item => item.id !== id);
      setImageHistory(newHistory);
      localStorage.setItem('imageHistory', JSON.stringify(newHistory));
    }

    if (remoteItem) {
      setRemoteFolderImages(prev => prev.filter(item => item.id !== id));
    }

    // Cleanup URL
    if (historyImages[id]) {
      URL.revokeObjectURL(historyImages[id]);
      setHistoryImages(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }

    refreshStoryFolderList();
    if (storyFilter && storyFilter !== STORY_FILTER_ALL && storyFilter !== STORY_FILTER_ORPHANED) {
      setRemoteFolderImages(prev => prev.filter(item => item.id !== id));
      fetchRemoteImagesForStory(storyFilter);
    }

    showToast('이미지를 삭제했습니다.', 'success');
  };

  const handleSaveToDisk = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const imageUrl = historyImages[id];
    const item = imageHistory.find(i => i.id === id);
    if (!imageUrl || !item) return;

    try {
      const blob = await fetch(imageUrl).then(r => r.blob());
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        const response = await fetch('http://localhost:3002/api/save-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64data,
            prompt: item.prompt
          })
        });

        const resData = await response.json();
        if (resData.success) {
          showToast(`이미지가 저장되었습니다: ${resData.filename}`, 'success');
        } else {
          throw new Error(resData.error);
        }
      };
    } catch (err: any) {
      console.error("Save failed:", err);
      showToast("저장 실패: " + err.message, 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, item: ImageHistoryItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'image-history',
      id: item.id,
      generatedImageId: item.generatedImageId,
      prompt: item.prompt
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleStartEdit = () => {
    setEditContent(data.scriptBody);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate({
        ...data,
        scriptBody: editContent
      });
    }
    setIsEditing(false);
  };

  const handleToggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setImageHistory(prev => prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item));
    const target = imageHistory.find(i => i.id === id);
    const toggledOn = target ? !target.favorite : true;
    showToast(toggledOn ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기가 해제되었습니다.', 'success');
  };

  const createSyntheticEvent = () => ({ stopPropagation() { } }) as any;

  const lightboxActions = useMemo(() => {
    if (!lightboxItem) return [];
    return [
      {
        label: lightboxItem.favorite ? '즐겨찾기 해제' : '즐겨찾기',
        icon: <Star size={14} className={lightboxItem.favorite ? 'fill-yellow-300 text-yellow-200' : 'text-yellow-200'} />,
        onClick: () => handleToggleFavorite(lightboxItem.id)
      },
      {
        label: '저장',
        icon: <Download size={14} />,
        onClick: () => handleSaveToDisk(lightboxItem.id, createSyntheticEvent())
      },
      {
        label: '편집',
        icon: <Layers size={14} />,
        onClick: () => {
          localStorage.setItem('imageStudio_load_from_history', JSON.stringify(lightboxItem));
          setIsHistoryOpen(false);
          setLightboxImageUrl(null);
          setLightboxItem(null);
          showToast('이미지 스튜디오에서 편집을 계속하세요. (히스토리에서 선택됨)', 'info');
        }
      },
      {
        label: '삭제',
        icon: <X size={14} />,
        tone: 'danger' as const,
        onClick: () => handleDeleteImage(lightboxItem.id, createSyntheticEvent())
      }
    ];
  }, [lightboxItem, handleSaveToDisk, handleDeleteImage]);

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('복사했습니다.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllLongPrompts = () => {
    const allLongPrompts = safeScenes
      .map((scene, idx) => {
        const sceneNum = scene.sceneNumber || idx + 1;
        return `[Scene ${sceneNum}]\n${scene.longPrompt}`;
      })
      .join('\n\n' + '='.repeat(80) + '\n\n');

    navigator.clipboard.writeText(allLongPrompts);
    setCopiedId('copy-all-long');
    showToast('모든 롱 프롬프트를 복사했습니다.', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCleanScriptLines = (text?: string | object | null) => {
    if (!text) return [];
    const normalized =
      typeof text === 'string'
        ? text
        : typeof text === 'object'
          ? JSON.stringify(text, null, 2)
          : String(text);
    return normalized
      .split('\n')
      .map(line => {
        return line.replace(/\[.*?\]/g, '').trim();
      })
      .filter(line => line.length > 0);
  };

  const cleanScriptLines = getCleanScriptLines(data.scriptBody);
  const cleanScriptText = cleanScriptLines.join('\n');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedTitle(e.target.value);
    onUpdate && onUpdate({ ...data, title: e.target.value });
  };

  const storyFilterOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: STORY_FILTER_ALL, label: '전체보기' }
    ];
    const seen = new Set<string>();
    const readableCurrentTitle = (selectedTitle || data.title || '').trim();
    const folderCountMap = new Map<string, number>();
    storyFolders.forEach(info => {
      if (info?.folderName) {
        folderCountMap.set(info.folderName, info.imageCount || 0);
      }
    });
    const humanize = (folderId: string) => folderId?.replace(/_/g, ' ');
    const formatLabel = (folderId: string) => {
      if (!folderId) return '';
      let base = folderId;
      if (storyFolderName && folderId === storyFolderName) {
        base = readableCurrentTitle || humanize(folderId);
      } else {
        base = humanize(folderId);
      }
      const count = folderCountMap.get(folderId);
      if (typeof count === 'number' && count > 0) {
        return `${base} (${count}장)`;
      }
      return base;
    };
    const appendFolder = (folderId?: string) => {
      if (!folderId || seen.has(folderId)) return;
      seen.add(folderId);
      options.push({ value: folderId, label: formatLabel(folderId) });
    };
    storyFolders.forEach(info => appendFolder(info.folderName));
    imageHistory.forEach(item => {
      if (item?.storyId) appendFolder(item.storyId);
    });
    appendFolder(storyFolderName || data.id);
    const hasLegacy = imageHistory.some(item => !item?.storyId);
    if (hasLegacy) {
      options.push({ value: STORY_FILTER_ORPHANED, label: '폴더 없음 (기존)' });
    }
    return options;
  }, [imageHistory, storyFolderName, storyFolders, selectedTitle, data.title, data.id]);

  useEffect(() => {
    const validValues = new Set(storyFilterOptions.map(opt => opt.value));
    if (!validValues.has(storyFilter)) {
      setStoryFilter(STORY_FILTER_ALL);
    }
  }, [storyFilterOptions, storyFilter]);

  const storyFilterMessage = useMemo(() => {
    if (storyFilter === STORY_FILTER_ALL) {
      return '모든 이미지를 생성 순으로 표시합니다.';
    }
    if (storyFilter === STORY_FILTER_ORPHANED) {
      return '폴더가 없는 기존 이미지만 표시합니다.';
    }
    const label = storyFilterOptions.find(opt => opt.value === storyFilter)?.label || storyFilter;
    return `${label} 이미지만 표시합니다.`;
  }, [storyFilter, storyFilterOptions]);

  // ✅ Filter images by selected story / favorites and sort by favorite > newest
  const orderedHistory = useMemo(() => {
    if (!Array.isArray(imageHistory) || imageHistory.length === 0) return [];

    const baseItems = storyFilter === STORY_FILTER_ALL
      ? imageHistory
      : [...imageHistory, ...remoteFolderImages];

    const seenIds = new Set<string>();
    const deduped = baseItems.filter(item => {
      if (!item) return false;
      const key = item.localFilename || item.generatedImageId || item.id;
      if (key && seenIds.has(key)) return false;
      if (key) seenIds.add(key);
      return true;
    });

    const filteredByStory = deduped.filter(item => {
      if (!item) return false;
      if (storyFilter === STORY_FILTER_ALL) return true;
      if (storyFilter === STORY_FILTER_ORPHANED) return !item.storyId;
      return item.storyId === storyFilter;
    });

    const sorted = [...filteredByStory].sort((a, b) => {
      const favDiff = Number(Boolean(b.favorite)) - Number(Boolean(a.favorite));
      if (favDiff !== 0) return favDiff;
      const timeDiff = (b.createdAt ?? 0) - (a.createdAt ?? 0);
      if (timeDiff !== 0) return timeDiff;
      return 0;
    });

    return showFavoritesOnly ? sorted.filter(item => item.favorite) : sorted;
  }, [imageHistory, remoteFolderImages, showFavoritesOnly, storyFilter]);

  const handleEnhanceAll = async () => {
    if (!data.scenes || data.scenes.length === 0) return;
    if (!confirm("모든 프롬프트(Short/Long)에 대해 후처리를 적용하시겠습니까? (기존 내용은 변경됩니다)")) return;

    setIsEnhancingAll(true);
    try {
      const newScenes = [...safeScenes];
      const promises = newScenes.map(async (scene) => {
        const [enhancedShort, enhancedLong] = await Promise.all([
          enhancePrompt(scene.shortPrompt).then(makeSafePrompt), // Apply safety filter to short prompt
          enhancePrompt(scene.longPrompt)
        ]);
        return {
          ...scene,
          shortPrompt: enhancedShort,
          longPrompt: enhancedLong
        };
      });

      const updatedScenes = await Promise.all(promises);
      onUpdate && onUpdate({ ...data, scenes: updatedScenes });
      window.alert("모든 프롬프트가 후처리되었습니다.");
    } catch (e) {
      console.error("Bulk enhancement failed", e);
      window.alert("일부 프롬프트 후처리에 실패했습니다.");
    } finally {
      setIsEnhancingAll(false);
    }
  };

  const handleEnhanceSingle = async (index: number, type: 'short' | 'long') => {
    const scene = safeScenes[index];
    const prompt = type === 'short' ? scene.shortPrompt : scene.longPrompt;
    if (!prompt) return;

    const id = `enhance-${type}-${index}`;
    setGeneratingId(id);

    try {
      const enhanced = await enhancePrompt(prompt);
      // Apply safety filter only to short prompts
      const finalPrompt = type === 'short' ? makeSafePrompt(enhanced) : enhanced;
      const newScenes = [...safeScenes];
      if (type === 'short') {
        newScenes[index] = { ...newScenes[index], shortPrompt: finalPrompt };
      } else {
        newScenes[index] = { ...newScenes[index], longPrompt: finalPrompt };
      }
      onUpdate && onUpdate({ ...data, scenes: newScenes });
    } catch (e) {
      console.error("Enhancement failed", e);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="flex bg-slate-900/50 backdrop-blur-sm h-full overflow-hidden relative">
      {/* Lightbox */}
      <Lightbox
        imageUrl={lightboxImageUrl}
        actions={lightboxActions}
        onClose={() => {
          setLightboxImageUrl(null);
          setLightboxItem(null);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full"> {/* Main Content Wrapper */}

        {/* Header & Title */}
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-none">
          <div className="flex-1 w-full">
            <input
              value={toDisplayString(selectedTitle)}
              onChange={handleTitleChange}
              className="bg-transparent text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 focus:outline-none focus:border-b border-purple-500 w-full placeholder-slate-600"
              placeholder="제목을 입력하세요"
            />
            <p className="text-slate-500 text-sm mt-1">생성된 스토리 자산</p>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-800/50 p-1 rounded-xl overflow-x-auto items-center gap-2">
            <button
              onClick={handleEnhanceAll}
              disabled={isEnhancingAll}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:scale-105 transition-all flex items-center gap-1 whitespace-nowrap"
            >
              {isEnhancingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              전체 프롬프트 후처리
            </button>
            <div className="w-px h-6 bg-slate-700 mx-1"></div>
            <button
              onClick={() => setActiveTab('script')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'script' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <FileText className="w-4 h-4" /> 대본
            </button>
            <button
              onClick={() => setActiveTab('short')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'short' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <ImageIcon className="w-4 h-4" /> 숏 프롬프트
            </button>
            <button
              onClick={() => setActiveTab('long')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'long' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Layers className="w-4 h-4" /> 롱 프롬프트
            </button>
            <button
              onClick={() => setActiveTab('sora')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'sora' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Video className="w-4 h-4" /> 소라 비디오
            </button>
          </div>

          {/* Model Selector */}
          <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-xl ml-2 border border-slate-700/50">
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-300 focus:outline-none px-2 py-1 [&>option]:bg-slate-800"
              title="이미지 생성 모델 선택"
            >
              {availableModels.length > 0 ? (
                availableModels.map(m => <option key={m} value={m}>{m}</option>)
              ) : (
                <>
                  <option value="imagen-4.0-generate-001">Imagen 4.0 (Default)</option>
                  <option value="imagen-3.0-generate-001">Imagen 3.0</option>
                  <option value="imagen-4.0-fast-generate-001">Imagen 4.0 Fast</option>
                </>
              )}
            </select>
            <button
              onClick={handleRefreshModels}
              disabled={isModelLoading}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-purple-400 transition-colors"
              title="모델 목록 새로고침"
            >
              <RefreshCw className={`w-3 h-3 ${isModelLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">

          {/* Script View */}
          {activeTab === 'script' && (
            <div className="max-w-3xl mx-auto space-y-8 pr-4">
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6 relative group">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    onClick={() => handleCopy(cleanScriptText, 'script')}
                    className="text-xs py-1 px-3"
                  >
                    {copiedId === 'script' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === 'script' ? '복사됨' : '복사'}
                  </Button>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">메인 대본 (정제됨)</h3>
                  {!isEditing && onUpdate && (
                    <button onClick={handleStartEdit} className="text-slate-400 hover:text-purple-400 transition-colors" title="대본 수정">
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                  {isEditing && (
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300 transition-colors" title="저장">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={handleCancelEdit} className="text-red-400 hover:text-red-300 transition-colors" title="취소">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-[500px] bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 text-lg leading-relaxed text-slate-200 font-light focus:outline-none focus:ring-2 focus:ring-purple-500 font-sans"
                  />
                ) : (
                  <div className="text-lg leading-relaxed text-slate-200 font-light space-y-4">
                    {cleanScriptLines.map((line, idx) => (
                      <p key={idx} className="pl-4 border-l-2 border-slate-700/50 whitespace-pre-wrap">
                        {toDisplayString(line)}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 rounded-2xl p-6 relative">
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    onClick={() => handleCopy(toDisplayString(data.punchline), 'punchline')}
                    className="text-xs py-1 px-3"
                  >
                    {copiedId === 'punchline' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
                <h3 className="text-pink-400 text-xs font-bold uppercase tracking-wider mb-2">핵심 펀치라인</h3>
                <p className="text-xl font-bold text-white">"{toDisplayString(data.punchline)}"</p>
              </div>

              {/* Title Options */}
              {data.titleOptions && data.titleOptions.length > 0 && (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                  <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">제목 옵션 선택</h3>
                  <div className="flex flex-col gap-3">
                    {data.titleOptions.map((title, idx) => (
                      <label
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg cursor-pointer hover:border-purple-500/50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="title-option"
                          value={toDisplayString(title)}
                          checked={toDisplayString(selectedTitle) === toDisplayString(title)}
                          onChange={() => setSelectedTitle(toDisplayString(title))}
                          className="w-4 h-4 text-purple-500 bg-slate-700 border-slate-600 focus:ring-purple-500 focus:ring-2"
                        />
                        <span className="text-slate-200 text-sm flex-1">{toDisplayString(title)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible Image Prompts (압축 뷰) */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left text-slate-200 font-semibold hover:bg-slate-800/60 transition-colors"
                  onClick={() => setShowImagePrompts(!showImagePrompts)}
                >
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-400" />
                    <span>이미지 프롬프트</span>
                    <span className="text-xs text-slate-500">(클릭하여 펼치기/접기)</span>
                  </div>
                  {showImagePrompts ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>

                {showImagePrompts && data.scenes && data.scenes.length > 0 && (
                  <div className="px-6 pb-6 space-y-6">
                    {/* Short Prompts Compact */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-200">숏 프롬프트</span>
                        <span className="text-xs text-slate-500">짧은 이미지 프롬프트</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Model Selection */}
                        <div className="flex items-center gap-1 bg-slate-700/50 rounded px-2 py-1 border border-slate-600/50">
                          <select
                            value={imageModel}
                            onChange={(e) => setImageModel(e.target.value)}
                            className="bg-transparent text-xs text-slate-300 focus:outline-none max-w-[150px]"
                          >
                            {availableModels.length > 0 ? (
                              availableModels.map(model => (
                                <option key={model} value={model} className="bg-slate-800">{model}</option>
                              ))
                            ) : (
                              <>
                                <option value="imagen-4.0-generate-001" className="bg-slate-800">Imagen 4.0 (Default)</option>
                                <option value="imagen-3.0-generate-001" className="bg-slate-800">Imagen 3.0</option>
                                <option value="imagen-4.0-fast-generate-001" className="bg-slate-800">Imagen 4.0 Fast</option>
                                <option value="imagen-4.0-ultra-generate-001" className="bg-slate-800">Imagen 4.0 Ultra</option>
                              </>
                            )}
                          </select>
                          <button
                            onClick={handleRefreshModels}
                            disabled={isModelLoading}
                            className="text-slate-400 hover:text-purple-400"
                            title="모델 목록 새로고침"
                          >
                            <Loader2 className={`w-3 h-3 ${isModelLoading ? 'animate-spin' : ''}`} />
                          </button>
                        </div>

                        <Button
                          variant="ghost"
                          onClick={() => setNoGuard(!noGuard)}
                          className={`text-xs py-1 px-2 border ${noGuard ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}
                          title={noGuard ? "검열해제 됨 (Safety Off)" : "안전필터 켜짐 (Safety On)"}
                        >
                          {noGuard ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {safeScenes.map((scene, idx) => (
                        <div key={`mini-short-${idx}`} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400">장면 #{scene.sceneNumber}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                onClick={() => handleGenerateImage(scene.shortPrompt, `short-gen-mini-${idx}`, scene.sceneNumber)}
                                disabled={!!generatingId}
                                className={`text-xs py-1 px-2 ${generatingId === `short-gen-mini-${idx}` ? 'opacity-75 cursor-not-allowed' : ''}`}
                              >
                                {generatingId === `short-gen-mini-${idx}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                                생성
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleCopy(scene.shortPrompt, `short-mini-${idx}`)}
                                className="text-xs py-1 px-2"
                              >
                                {copiedId === `short-mini-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleEnhanceSingle(idx, 'short')}
                                disabled={!!generatingId}
                                className="text-xs py-1 px-2 text-purple-300 hover:text-purple-200"
                                title="프롬프트 후처리"
                              >
                                {generatingId === `enhance-short-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <textarea
                            value={toDisplayString(scene.shortPrompt)}
                            onChange={(e) => {
                              const newScenes = [...safeScenes];
                              newScenes[idx] = { ...newScenes[idx], shortPrompt: e.target.value };
                              onUpdate && onUpdate({ ...data, scenes: newScenes });
                            }}
                            className="w-full h-24 bg-black/20 text-slate-200 text-xs leading-relaxed p-2 rounded-lg border border-slate-800 focus:outline-none focus:border-purple-500 resize-none"
                            spellCheck={false}
                          />
                          <p className="text-slate-500 text-xs italic">{toDisplayString(scene.shortPromptKo)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Long Prompts Compact */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-200">롱 프롬프트</span>
                        <span className="text-xs text-slate-500">세부 묘사용</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          onClick={handleCopyAllLongPrompts}
                          className="text-xs py-1 px-3 bg-purple-600 hover:bg-purple-700 text-white border border-purple-500"
                        >
                          {copiedId === 'copy-all-long' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          전체 복사
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setNoGuard(!noGuard)}
                          className={`text-xs py-1 px-2 border ${noGuard ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}
                          title={noGuard ? "검열해제 됨 (Safety Off)" : "안전필터 켜짐 (Safety On)"}
                        >
                          {noGuard ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {safeScenes.map((scene, idx) => (
                        <div key={`mini-long-${idx}`} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-slate-400">장면 #{scene.sceneNumber}</span>
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                onClick={() => handleGenerateImage(scene.longPrompt, `long-gen-mini-${idx}`, scene.sceneNumber)}
                                disabled={!!generatingId}
                                className={`text-xs py-1 px-2 ${generatingId === `long-gen-mini-${idx}` ? 'opacity-75 cursor-not-allowed' : ''}`}
                              >
                                {generatingId === `long-gen-mini-${idx}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                                생성
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleForwardPromptToImageAI(scene.longPrompt, `long-ai-mini-${idx}`, scene.sceneNumber, (data as any)?._folderName || data.id, selectedTitle || data.title)}
                                disabled={!!aiForwardingId}
                                className={`text-xs py-1 px-2 ${aiForwardingId === `long-ai-mini-${idx}` ? 'opacity-75 cursor-not-allowed' : ''}`}
                              >
                                {aiForwardingId === `long-ai-mini-${idx}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                                AI 생성
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleCopy(scene.longPrompt, `long-mini-${idx}`)}
                                className="text-xs py-1 px-2"
                              >
                                {copiedId === `long-mini-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() => handleEnhanceSingle(idx, 'long')}
                                disabled={!!generatingId}
                                className="text-xs py-1 px-2 text-purple-300 hover:text-purple-200"
                                title="프롬프트 후처리"
                              >
                                {generatingId === `enhance-long-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              </Button>
                            </div>
                          </div>
                          <textarea
                            value={toDisplayString(scene.longPrompt)}
                            onChange={(e) => {
                              const newScenes = [...safeScenes];
                              newScenes[idx] = { ...newScenes[idx], longPrompt: e.target.value };
                              onUpdate && onUpdate({ ...data, scenes: newScenes });
                            }}
                            className="w-full h-28 bg-black/20 text-slate-200 text-xs leading-relaxed p-2 rounded-lg border border-slate-800 focus:outline-none focus:border-purple-500 resize-none"
                            spellCheck={false}
                          />
                          <p className="text-slate-500 text-xs">{toDisplayString(scene.longPromptKo)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {showImagePrompts && (!data.scenes || data.scenes.length === 0) && (
                  <div className="px-6 pb-6 text-slate-500 text-sm">이미지 프롬프트가 없습니다.</div>
                )}
              </div>
            </div>
          )}

          {/* Short Prompts View */}
          {activeTab === 'short' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-4">
              {safeScenes.map((scene, idx) => (
                <div key={idx} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 flex flex-col h-full relative group hover:border-purple-500/30 transition-colors">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700/50">
                    <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded text-xs font-mono">장면 #{scene.sceneNumber}</span>
                    <div className="flex gap-2">
                      {/* Safety Toggle */}
                      <Button
                        variant="ghost"
                        onClick={() => setNoGuard(!noGuard)}
                        className={`text-xs py-1.5 px-2 border ${noGuard ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}
                        title={noGuard ? "검열해제 됨 (Safety Off)" : "안전필터 켜짐 (Safety On)"}
                      >
                        {noGuard ? <ShieldOff className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      </Button>

                      {/* Generate Button */}
                      <Button
                        variant="primary"
                        onClick={() => handleGenerateImage(scene.shortPrompt, `short-gen-${idx}`, scene.sceneNumber)}
                        disabled={!!generatingId}
                        className={`text-xs py-1.5 px-3 ${generatingId === `short-gen-${idx}` ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        {generatingId === `short-gen-${idx}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                        {generatingId === `short-gen-${idx}` ? '생성 중' : '생성'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleCopy(scene.shortPrompt, `short-${idx}`)}
                        className="text-xs py-1.5 px-3 hover:bg-purple-600 hover:text-white hover:border-purple-500"
                      >
                        {copiedId === `short-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleEnhanceSingle(idx, 'short')}
                        disabled={!!generatingId}
                        className="text-xs py-1.5 px-3 hover:bg-purple-600 hover:text-white hover:border-purple-500"
                        title="프롬프트 후처리"
                      >
                        {generatingId === `enhance-short-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="bg-black/30 p-1 rounded-lg border border-slate-800 focus-within:border-purple-500 transition-colors">
                      <textarea
                        value={scene.shortPrompt}
                        onChange={(e) => {
                          const newScenes = [...safeScenes];
                          newScenes[idx] = { ...newScenes[idx], shortPrompt: e.target.value };
                          onUpdate && onUpdate({ ...data, scenes: newScenes });
                        }}
                        className="w-full h-32 bg-transparent text-slate-300 text-sm leading-relaxed p-2 focus:outline-none resize-none"
                        spellCheck={false}
                      />
                    </div>
                    <div className="pt-2">
                      <p className="text-slate-500 text-xs italic">
                        {scene.shortPromptKo}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Long Prompts View */}
          {activeTab === 'long' && (
            <div className="space-y-6 max-w-4xl mx-auto pr-4">
              {/* Copy All Long Prompts Button */}
              <div className="flex justify-end mb-4">
                <Button
                  variant="primary"
                  onClick={handleCopyAllLongPrompts}
                  className="text-sm py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white border border-purple-500 shadow-lg"
                >
                  {copiedId === 'copy-all-long' ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  전체 복사 (1-8씬)
                </Button>
              </div>
              {safeScenes.map((scene, idx) => (
                <div key={idx} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 relative group hover:border-purple-500/30 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded text-xs font-mono">장면 #{scene.sceneNumber}</span>
                      <span className="text-xs text-slate-500 uppercase tracking-widest">고해상도 디테일</span>
                    </div>
                    <div className="flex gap-2">
                      {/* Safety Toggle */}
                      <Button
                        variant="ghost"
                        onClick={() => setNoGuard(!noGuard)}
                        className={`text-xs py-1 px-2 border ${noGuard ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}
                        title={noGuard ? "검열해제 됨 (Safety Off)" : "안전필터 켜짐 (Safety On)"}
                      >
                        {noGuard ? <ShieldOff className="w-3 h-3 scale-90" /> : <Shield className="w-3 h-3 scale-90" />}
                      </Button>

                      <Button
                        variant="primary"
                        onClick={() => handleGenerateImage(scene.longPrompt, `long-gen-${idx}`, scene.sceneNumber)}
                        disabled={!!generatingId}
                        className={`text-xs py-1 px-3 ${generatingId === `long-gen-${idx}` ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        {generatingId === `long-gen-${idx}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ImageIcon className="w-3 h-3 mr-1" />}
                        이미지 생성
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleForwardPromptToImageAI(scene.longPrompt, `long-ai-${idx}`, scene.sceneNumber, (data as any)?._folderName || data.id, selectedTitle || data.title)}
                        disabled={!!aiForwardingId}
                        className={`text-xs py-1 px-3 ${aiForwardingId === `long-ai-${idx}` ? 'opacity-75 cursor-not-allowed' : ''}`}
                      >
                        {aiForwardingId === `long-ai-${idx}` ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        AI 생성
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleCopy(scene.longPrompt, `long-${idx}`)}
                        className="text-xs py-1 px-3 hover:bg-purple-600 hover:text-white hover:border-purple-500"
                      >
                        {copiedId === `long-${idx}` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        복사
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-black/30 p-1 rounded-lg border border-slate-800 focus-within:border-purple-500 transition-colors">
                      <textarea
                        value={scene.longPrompt}
                        onChange={(e) => {
                          const newScenes = [...safeScenes];
                          newScenes[idx] = { ...newScenes[idx], longPrompt: e.target.value };
                          onUpdate && onUpdate({ ...data, scenes: newScenes });
                        }}
                        className="w-full h-40 bg-transparent text-slate-300 text-sm leading-relaxed p-3 focus:outline-none font-mono text-xs resize-none"
                        spellCheck={false}
                      />
                    </div>
                    <p className="text-slate-500 text-sm pl-2 border-l-2 border-slate-700">
                      {scene.longPromptKo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sora Video Prompts View */}
          {activeTab === 'sora' && (
            <div className="space-y-6 max-w-4xl mx-auto pr-4">
              {safeScenes.map((scene, idx) => (
                <div key={idx} className="bg-slate-800/30 border border-purple-500/20 rounded-xl p-6 relative group hover:border-purple-500/50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-purple-900/50 text-purple-300 px-2 py-1 rounded text-xs font-mono border border-purple-500/30">Scene #{scene.sceneNumber}</span>
                      <span className="text-xs text-purple-400 uppercase tracking-widest flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        Sora Video Prompt
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => handleCopy(scene.soraPrompt || scene.longPrompt, `sora - ${idx} `)}
                      className="text-xs py-1 px-3"
                    >
                      {copiedId === `sora - ${idx} ` ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Sora 프롬프트 복사
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-black/50 p-4 rounded-lg border border-purple-900/30">
                      <p className="text-purple-100 text-sm leading-relaxed font-mono">
                        {scene.soraPrompt || "Sora prompt not generated for this scene."}
                      </p>
                    </div>
                    <p className="text-slate-400 text-sm pl-2 border-l-2 border-purple-500/30">
                      {scene.soraPromptKo || "영상 프롬프트 설명이 없습니다."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - History Sidebar */}
      <div className={`flex-none h-full bg-gray-950 border-l border-gray-800 transition-all duration-300 ease-in-out flex flex-col z-20 ${isHistoryOpen ? 'w-24 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <button onClick={() => setShowFavoritesOnly(prev => !prev)} className="text-yellow-400 hover:text-yellow-300 p-1 rounded-full hover:bg-gray-800 transition-colors" title={showFavoritesOnly ? "즐겨찾기만 보기 해제" : "즐겨찾기만 보기"}>
            <Star size={16} className={showFavoritesOnly ? 'fill-yellow-400' : ''} />
          </button>
          <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors" title="히스토리 닫기">
            <X size={16} />
          </button>
        </div>
        <div className="p-2 border-b border-gray-900/50 bg-gray-950/60 space-y-1">
          <div className="flex items-center justify-between w-full text-[9px] text-gray-500 uppercase tracking-wide">
            <span>스토리 필터</span>
            <button
              onClick={() => setStoryFilter(STORY_FILTER_ALL)}
              className="text-[9px] text-gray-400 hover:text-white transition-colors"
              title="전체 이미지 보기"
            >
              전체
            </button>
          </div>
          <div className="flex items-center gap-1">
            <select
              value={storyFilter}
              onChange={(e) => setStoryFilter(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-800 rounded-md text-[10px] text-gray-100 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {storyFilterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              onClick={refreshStoryFolderList}
              className="p-1 rounded-md border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="폴더 목록 새로고침"
            >
              {isStoryFolderLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            </button>
          </div>
          <p className="text-[9px] text-gray-500 text-center leading-relaxed">
            {storyFilterMessage}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-800">
          {isRemoteFolderLoading && storyFilter !== STORY_FILTER_ALL && storyFilter !== STORY_FILTER_ORPHANED && (
            <div className="flex items-center justify-center text-[11px] text-gray-400 gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              폴더 이미지를 불러오는 중...
            </div>
          )}
          {orderedHistory.length === 0 ? (
            <div className="text-center text-xs text-gray-600 mt-10 px-1">
              No images yet
            </div>
          ) : (
            orderedHistory.map((item) => (
              <div
                key={item.id}
                className="relative group w-full h-32 rounded-lg overflow-hidden cursor-pointer border border-gray-800 hover:border-purple-500 transition-all flex-shrink-0 bg-gray-900 shadow-md"
                onClick={() => {
                  if (historyImages[item.id]) {
                    setLightboxImageUrl(historyImages[item.id]);
                    setLightboxItem(item);
                  }
                }}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, item)}
                title={item.prompt}
              >
                {historyImages[item.id] ? (
                  <img
                    src={historyImages[item.id]}
                    alt="History"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-800 animate-pulse">
                    <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] flex justify-around items-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => handleToggleFavorite(item.id, e)} title={item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'} className="flex items-center gap-1">
                    <Star size={10} className={item.favorite ? 'fill-yellow-300 text-yellow-300' : 'text-yellow-200'} />
                  </button>
                  <button onClick={(e) => handleCopy(item.prompt || '', `prompt-${item.id}`)} title="프롬프트 복사" className="flex items-center gap-1">
                    {copiedId === `prompt-${item.id}` ? <Check size={10} /> : <Copy size={10} />}
                  </button>
                  <button onClick={(e) => handleDeleteImage(item.id, e)} title="삭제" className="flex items-center gap-1 text-red-300">
                    <X size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Toggle Button (When closed) */}
      {!isHistoryOpen && (
        <button
          onClick={() => setIsHistoryOpen(true)}
          className="absolute right-4 top-20 p-2 bg-gray-800/80 text-white rounded-full hover:bg-gray-700 z-30 shadow-lg border border-gray-700/50"
          title="Show Image History"
        >
          <HistoryIcon size={20} />
        </button>
      )}

    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, History as HistoryIcon, Loader2, RefreshCw, Star, X } from 'lucide-react';
import type { HistoryItem } from '../types';
import AiStudioHistoryLightbox from './AiStudioHistoryLightbox';
import { deleteBlob, getBlob, setBlob } from '../services/dbService';
import { fetchDiskImageList, fetchImageStoryFolders, StoryFolderInfo } from '../services/diskImageList';
import { deleteFileFromDisk, saveImageToDisk } from '../services/serverService';
import { fetchImageHistory, saveImageHistory } from '../services/imageHistoryService';
import { buildApiUrl, buildAssetUrl } from '../../../lib/api';

const MAX_HISTORY = 100;
const STORY_FILTER_ALL = 'all';
const STORY_FILTER_ORPHANED = '__legacy__';
const IMAGE_SERVER_ORIGINS = ['http://localhost:3002', 'http://127.0.0.1:3002'];

interface AiStudioHostProps {
  slimMode?: boolean;
  appComponent: React.ComponentType<{ onAddHistory?: (dataUrl: string, prompt: string) => void; slimMode?: boolean }>;
}

const getImageServerOrigins = (): string[] => {
  if (typeof window === 'undefined') return IMAGE_SERVER_ORIGINS;
  const currentHost = `${window.location.protocol}//${window.location.hostname}:3002`;
  return Array.from(new Set([currentHost, ...IMAGE_SERVER_ORIGINS]));
};

const toServerImageUrls = (url?: string): string[] => {
  if (!url) return [];
  if (/^(blob:|data:)/i.test(url)) return [url];
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname.startsWith('/generated_scripts/')) {
        return Array.from(new Set([url, ...getImageServerOrigins().map((origin) => new URL(`${parsed.pathname}${parsed.search}`, origin).toString())]));
      }
    } catch {
      return [url];
    }
    return [url];
  }
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return getImageServerOrigins().map((origin) => new URL(normalized, origin).toString());
};

const buildHistoryImageUrlCandidates = (item: HistoryItem): string[] => {
  const candidates: string[] = [];
  if (item.url) candidates.push(...toServerImageUrls(item.url));

  if (item.localFilename) {
    const trimmed = item.localFilename.replace(/^\/+/, '');
    if (trimmed.startsWith('generated_scripts/')) {
      candidates.push(...toServerImageUrls(`/${trimmed}`));
    } else if (trimmed.startsWith('대본폴더/')) {
      candidates.push(...toServerImageUrls(`/generated_scripts/${trimmed}`));
    } else if (trimmed.includes('/')) {
      const [folderName, ...fileParts] = trimmed.split('/');
      const fileName = fileParts.join('/');
      if (item.storyId || item.source === 'ai-studio') {
        candidates.push(...toServerImageUrls(`/generated_scripts/대본폴더/${folderName}/images/${fileName}`));
      }
      candidates.push(...toServerImageUrls(`/generated_scripts/images/${trimmed}`));
    } else {
      if (item.storyId) candidates.push(...toServerImageUrls(`/generated_scripts/대본폴더/${item.storyId}/images/${trimmed}`));
      candidates.push(...toServerImageUrls(`/generated_scripts/images/${trimmed}`));
    }
  }

  return Array.from(new Set(candidates));
};

const resolveHistoryImageUrl = (item: HistoryItem): string | undefined => buildHistoryImageUrlCandidates(item)[0];

const getNextHistoryImageUrl = (item: HistoryItem, currentUrl?: string): string | undefined => {
  const candidates = buildHistoryImageUrlCandidates(item);
  if (!currentUrl) return candidates[0];
  return candidates.find((candidate) => candidate !== currentUrl);
};

const AiStudioHost: React.FC<AiStudioHostProps> = ({ slimMode, appComponent: AppComponent }) => {
  const [imageHistory, setImageHistory] = useState<HistoryItem[]>([]);
  const [historyUrls, setHistoryUrls] = useState<Record<string, string>>({});
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showImageHistory, setShowImageHistory] = useState(true);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<HistoryItem | null>(null);
  const [storyFilter, setStoryFilter] = useState(STORY_FILTER_ALL);
  const [storyFolders, setStoryFolders] = useState<StoryFolderInfo[]>([]);
  const [remoteFolderImages, setRemoteFolderImages] = useState<HistoryItem[]>([]);
  const [isRemoteFolderLoading, setIsRemoteFolderLoading] = useState(false);
  const historyUrlsRef = useRef<Record<string, string>>({});
  const loadedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchImageHistory().then(setImageHistory);
  }, []);

  const refreshStoryFolderList = useCallback(async () => {
    setStoryFolders(await fetchImageStoryFolders());
  }, []);

  useEffect(() => {
    refreshStoryFolderList();
  }, [refreshStoryFolderList]);

  const fetchRemoteImagesForStory = useCallback(async (targetStoryId: string) => {
    if (!targetStoryId || targetStoryId === STORY_FILTER_ALL || targetStoryId === STORY_FILTER_ORPHANED) {
      setRemoteFolderImages([]);
      return;
    }

    setIsRemoteFolderLoading(true);
    try {
      try {
        const endpoint = buildApiUrl(`/api/images/by-story/${encodeURIComponent(targetStoryId)}`);
        const response = await fetch(`${endpoint}?t=${Date.now()}`);
        if (response.ok) {
          const files = await response.json();
          if (Array.isArray(files)) {
            const nextItems: HistoryItem[] = files.map((item, index) => {
              const filename = typeof item === 'string' ? item : typeof item?.filename === 'string' ? item.filename : `remote-${index}`;
              const prompt = typeof item === 'string' ? item : typeof item?.prompt === 'string' ? item.prompt : filename;
              const isUnifiedPath = typeof item === 'object' && item !== null && Boolean(item?.isUnifiedPath);
              const url = isUnifiedPath
                ? buildAssetUrl(`/generated_scripts/${filename}`)
                : buildAssetUrl(`/generated_scripts/images/${filename}`);
              return {
                id: `remote-${targetStoryId}-${filename}-${index}`,
                prompt,
                favorite: false,
                createdAt: Date.now() - index,
                localFilename: filename,
                url,
                storyId: targetStoryId,
                settings: { mode: 'Generate', aspectRatio: '9:16', activeCheatKeys: [], noGuard: false, enhanceBackground: false, removeBackground: false, creativity: 0.8 },
              };
            });

            setRemoteFolderImages(nextItems);
            return;
          }
        }
      } catch {
        // ignore and fall through
      }
      setRemoteFolderImages([]);
    } finally {
      setIsRemoteFolderLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRemoteImagesForStory(storyFilter);
  }, [fetchRemoteImagesForStory, storyFilter]);

  useEffect(() => {
    let mounted = true;

    const loadUrls = async () => {
      const combined = [...imageHistory, ...remoteFolderImages];
      const pending = combined.filter((item) => !historyUrls[item.id] && !loadedIdsRef.current.has(item.id));
      if (pending.length === 0) return;

      const resolvedEntries: Record<string, string> = {};
      await Promise.all(
        pending.map(async (item) => {
          if (item.generatedImageId) {
            try {
              const blob = await getBlob(item.generatedImageId);
              if (blob) {
                resolvedEntries[item.id] = URL.createObjectURL(blob);
                loadedIdsRef.current.add(item.id);
                return;
              }
            } catch {
              // fall through
            }
          }

          const fallbackUrl = resolveHistoryImageUrl(item);
          if (fallbackUrl) {
            resolvedEntries[item.id] = fallbackUrl;
            loadedIdsRef.current.add(item.id);
          }
        }),
      );

      if (mounted && Object.keys(resolvedEntries).length > 0) {
        setHistoryUrls((current) => ({ ...current, ...resolvedEntries }));
      }
    };

    loadUrls();
    return () => {
      mounted = false;
    };
  }, [imageHistory, remoteFolderImages, historyUrls]);

  useEffect(() => {
    historyUrlsRef.current = historyUrls;
  }, [historyUrls]);

  useEffect(() => () => {
    Object.values(historyUrlsRef.current).forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
  }, []);

  useEffect(() => {
    if (imageHistory.length > 0) return;
    fetchDiskImageList().then((files) => {
      if (files.length === 0) return;
      setImageHistory(
        files.slice(0, 50).map((filename, index) => ({
          id: `disk-${index}-${filename}`,
          prompt: filename,
          favorite: false,
          localFilename: filename,
          createdAt: Date.now(),
          source: 'disk',
          settings: { mode: 'Generate', aspectRatio: '9:16', activeCheatKeys: [], noGuard: false, enhanceBackground: false, removeBackground: false, creativity: 0.8 },
        })),
      );
    });
  }, [imageHistory.length]);

  const handleAddHistoryFromDataUrl = useCallback(async (dataUrl: string, prompt: string) => {
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const generatedImageId = crypto.randomUUID();
      await setBlob(generatedImageId, blob);

      const activeStoryId = storyFilter !== STORY_FILTER_ALL && storyFilter !== STORY_FILTER_ORPHANED ? storyFilter : undefined;
      const saved = await saveImageToDisk(dataUrl, prompt, activeStoryId).catch(() => undefined);
      const previewUrl = URL.createObjectURL(blob);

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        prompt,
        generatedImageId,
        favorite: false,
        localFilename: saved?.filename,
        url: saved?.url,
        createdAt: Date.now(),
        source: 'ai-studio',
        storyId: saved?.storyId || activeStoryId,
        settings: { mode: 'Generate', aspectRatio: '1:1', activeCheatKeys: [], noGuard: false, enhanceBackground: false, removeBackground: false, creativity: 0.8 },
      };

      const nextHistory = [newItem, ...imageHistory].slice(0, MAX_HISTORY);
      setImageHistory(nextHistory);
      setHistoryUrls((current) => ({ ...current, [newItem.id]: previewUrl }));
      await saveImageHistory(nextHistory);
    } catch {
      // ignore
    }
  }, [imageHistory, storyFilter]);

  const combinedHistory = useMemo(() => [...imageHistory, ...remoteFolderImages], [imageHistory, remoteFolderImages]);

  const displayHistory = useMemo(() => {
    const filtered = combinedHistory.filter((item) => {
      if (storyFilter === STORY_FILTER_ALL) return true;
      if (storyFilter === STORY_FILTER_ORPHANED) return !item.storyId;
      return item.storyId === storyFilter;
    });

    const sorted = [...filtered].sort((left, right) => {
      const favoriteDiff = Number(right.favorite) - Number(left.favorite);
      if (favoriteDiff !== 0) return favoriteDiff;
      return right.createdAt - left.createdAt;
    });

    const favoriteFiltered = favoritesOnly ? sorted.filter((item) => item.favorite) : sorted;
    return storyFilter === STORY_FILTER_ALL ? favoriteFiltered.slice(0, 50) : favoriteFiltered;
  }, [combinedHistory, favoritesOnly, storyFilter]);

  const storyFilterOptions = useMemo(() => {
    const options = [{ value: STORY_FILTER_ALL, label: '전체보기' }];
    const seen = new Set<string>();
    const append = (storyId?: string) => {
      if (!storyId || seen.has(storyId)) return;
      seen.add(storyId);
      const count = storyFolders.find((entry) => entry.folderName === storyId)?.imageCount;
      options.push({ value: storyId, label: count ? `${storyId.replace(/_/g, ' ')} (${count}장)` : storyId.replace(/_/g, ' ') });
    };
    storyFolders.forEach((entry) => append(entry.folderName));
    combinedHistory.forEach((item) => append(item.storyId));
    if (combinedHistory.some((item) => !item.storyId)) {
      options.push({ value: STORY_FILTER_ORPHANED, label: '폴더 없음 (기존)' });
    }
    return options;
  }, [combinedHistory, storyFolders]);

  const toggleFavorite = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setImageHistory((current) => current.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));
    setRemoteFolderImages((current) => current.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item));
  };

  const handleDeleteHistoryItem = async (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const localItem = imageHistory.find((item) => item.id === id);
    const remoteItem = remoteFolderImages.find((item) => item.id === id);
    const target = localItem || remoteItem;
    if (!target || !window.confirm('이 이미지를 삭제하시겠습니까?')) return;

    if (localItem?.generatedImageId) {
      await deleteBlob(localItem.generatedImageId).catch(() => undefined);
    }
    if (target.localFilename) {
      await deleteFileFromDisk(target.localFilename, 'image');
    }
    if (localItem) {
      const nextHistory = imageHistory.filter((item) => item.id !== id);
      setImageHistory(nextHistory);
      await saveImageHistory(nextHistory);
    }
    if (remoteItem) {
      setRemoteFolderImages((current) => current.filter((item) => item.id !== id));
      fetchRemoteImagesForStory(storyFilter);
    }
  };

  const lightboxActions = useMemo(() => {
    if (!lightboxItem) return [];
    return [
      {
        label: lightboxItem.favorite ? '즐겨찾기 해제' : '즐겨찾기',
        icon: <Star className={lightboxItem.favorite ? 'fill-yellow-300 text-yellow-300' : 'text-yellow-200'} />,
        onClick: () => toggleFavorite(lightboxItem.id),
      },
      {
        label: '삭제',
        icon: <X />,
        tone: 'danger' as const,
        onClick: () => handleDeleteHistoryItem(lightboxItem.id),
      },
    ];
  }, [lightboxItem, storyFilter]);

  return (
    <div className="flex w-full h-full bg-slate-950 text-white relative">
      <AiStudioHistoryLightbox imageUrl={lightboxImageUrl} actions={lightboxActions} onClose={() => { setLightboxImageUrl(null); setLightboxItem(null); }} />
      <div className="flex-1 overflow-y-auto">
        <AppComponent onAddHistory={handleAddHistoryFromDataUrl} slimMode={slimMode} />
      </div>
      <div className={`relative shrink-0 transition-all duration-300 ${showImageHistory ? 'w-28' : 'w-0'}`}>
        <div className={`sticky top-16 h-[calc(100vh-64px)] bg-gray-950 border-l border-gray-800 shadow-xl flex flex-col z-30 transition-opacity duration-300 ${showImageHistory ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="p-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
            <button onClick={() => setFavoritesOnly((current) => !current)} className="text-yellow-400 hover:text-yellow-300 p-1 rounded-full hover:bg-gray-800 transition-colors" title="즐겨찾기만 보기">
              <Star size={16} className={favoritesOnly ? 'fill-yellow-400' : ''} />
            </button>
            <button onClick={() => { refreshStoryFolderList(); fetchRemoteImagesForStory(storyFilter); }} className="text-cyan-400 hover:text-cyan-300 p-1 rounded-full hover:bg-gray-800 transition-colors" title="폴더/이미지 새로고침">
              {isRemoteFolderLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button onClick={() => setShowImageHistory(false)} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors" title="히스토리 닫기">
              <X size={16} />
            </button>
          </div>
          <div className="p-2 border-b border-gray-900/50 bg-gray-950/60 space-y-1">
            <select value={storyFilter} onChange={(event) => setStoryFilter(event.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-md text-[10px] text-gray-100 px-2 py-1">
              {storyFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {displayHistory.length === 0 ? (
              <div className="text-center text-xs text-gray-600 mt-10 px-1">No images yet</div>
            ) : (
              displayHistory.map((item) => (
                <div
                  key={item.id}
                  className="relative group w-full h-32 rounded-lg overflow-hidden cursor-pointer border border-gray-800 hover:border-purple-500 transition-all bg-gray-900 shadow-md"
                  draggable={Boolean(historyUrls[item.id] || item.url || item.localFilename)}
                  onDragStart={(event) => {
                    const dragUrl = historyUrls[item.id] || resolveHistoryImageUrl(item);
                    if (dragUrl) {
                      event.dataTransfer.setData('text/uri-list', dragUrl);
                      event.dataTransfer.setData('text/plain', dragUrl);
                    }
                    event.dataTransfer.setData('application/json', JSON.stringify({ type: 'image-history', generatedImageId: item.generatedImageId, localFilename: item.localFilename, storyId: item.storyId, prompt: item.prompt, id: item.id, url: dragUrl }));
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    const url = historyUrls[item.id];
                    if (!url) return;
                    setLightboxImageUrl(url);
                    setLightboxItem(item);
                  }}
                >
                  {historyUrls[item.id] ? (
                    <img
                      src={historyUrls[item.id]}
                      alt="History"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      onError={() => {
                        const nextUrl = getNextHistoryImageUrl(item, historyUrls[item.id]);
                        if (nextUrl) {
                          setHistoryUrls((current) => ({ ...current, [item.id]: nextUrl }));
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 animate-pulse">
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[11px] mb-2 line-clamp-2 leading-tight break-words">{item.prompt || 'No prompt'}</p>
                    <div className="flex justify-around items-center">
                      <button onClick={(event) => toggleFavorite(item.id, event)} title="즐겨찾기 추가"><Star size={10} className={item.favorite ? 'fill-yellow-300 text-yellow-300' : 'text-yellow-200'} /></button>
                      <button onClick={(event) => { event.stopPropagation(); navigator.clipboard.writeText(item.prompt || ''); }} title="프롬프트 복사"><Copy size={10} /></button>
                      <button onClick={(event) => handleDeleteHistoryItem(item.id, event)} title="삭제" className="text-red-300"><X size={10} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {!showImageHistory && (
        <button onClick={() => setShowImageHistory(true)} className="fixed right-0 top-16 p-2 bg-gray-900 text-white rounded-l-lg border border-gray-800 shadow-lg hover:bg-gray-800 transition-colors" title="이미지 히스토리 열기">
          <HistoryIcon size={16} />
        </button>
      )}
    </div>
  );
};

export default AiStudioHost;

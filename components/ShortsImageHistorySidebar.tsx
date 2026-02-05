import React, { useMemo } from 'react';
import { Copy, History as HistoryIcon, Loader2, Star, X, RefreshCw, Pencil } from 'lucide-react';

type HistoryItem = {
  id: string;
  prompt?: string;
  favorite?: boolean;
  generatedImageId?: string;
  localFilename?: string;
  createdAt?: number;
  source?: string;
  settings?: any;
};

interface Props {
  show: boolean;
  favoritesOnly: boolean;
  setFavoritesOnly: (v: boolean) => void;
  onClose: () => void;
  imageHistory: HistoryItem[];
  historyUrls: Record<string, string>;
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
  onCopyPrompt: (prompt: string, e: React.MouseEvent) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  onSelectImage?: (url: string, item: HistoryItem) => void;
  onEdit?: (item: HistoryItem, e: React.MouseEvent) => void;
  enableDrag?: boolean;
  onRefresh?: () => void;
}

const ShortsImageHistorySidebar: React.FC<Props> = ({
  show,
  favoritesOnly,
  setFavoritesOnly,
  onClose,
  imageHistory,
  historyUrls,
  onToggleFavorite,
  onCopyPrompt,
  onDelete,
  onSelectImage,
  onEdit,
  enableDrag = true,
  onRefresh
}) => {
  const orderedHistory = useMemo(() => {
    const sorted = [...imageHistory].sort((a, b) => {
      const favDiff = Number(Boolean(b?.favorite)) - Number(Boolean(a?.favorite));
      if (favDiff !== 0) return favDiff;
      const timeDiff = (b?.createdAt ?? 0) - (a?.createdAt ?? 0);
      if (timeDiff !== 0) return timeDiff;
      return 0;
    });
    return favoritesOnly ? sorted.filter(item => item.favorite) : sorted;
  }, [imageHistory, favoritesOnly]);

  return (
    <div className={`fixed right-0 top-16 h-[calc(100%-64px)] w-24 bg-gray-950 border-l border-gray-800 transition-transform duration-300 flex flex-col z-40 ${show ? 'translate-x-0' : 'translate-x-full pointer-events-none'}`}>
      <div className="p-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className="text-yellow-400 hover:text-yellow-300 p-1 rounded-full hover:bg-gray-800 transition-colors"
          title={favoritesOnly ? '즐겨찾기만 보기 해제' : '즐겨찾기만 보기'}
        >
          <Star size={16} className={favoritesOnly ? 'fill-yellow-400' : ''} />
        </button>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-cyan-400 hover:text-cyan-300 p-1 rounded-full hover:bg-gray-800 transition-colors"
            title="디스크 이미지 새로고침"
          >
            <RefreshCw size={16} />
          </button>
        )}
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors" title="히스토리 닫기">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin scrollbar-thumb-gray-800">
        {orderedHistory.length === 0 ? (
          <div className="text-center text-xs text-gray-600 dark:text-gray-400 mt-10 px-1">No images yet</div>
        ) : (
          orderedHistory.map((item) => (
            <div
              key={item.id}
              className="relative group w-20 h-32 rounded-lg overflow-hidden cursor-pointer border border-gray-800 hover:border-purple-500 transition-all flex-shrink-0 bg-gray-900 shadow-md mx-auto mb-3"
              draggable={enableDrag}
              onDragStart={(e) => {
                if (!enableDrag) return;
                e.dataTransfer.setData('application/json', JSON.stringify({
                  type: 'image-history',
                  generatedImageId: item.generatedImageId,
                  localFilename: item.localFilename,
                  prompt: item.prompt,
                  id: item.id
                }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => {
                const itemUrl = historyUrls ? historyUrls[item.id] : undefined;
                if (itemUrl && onSelectImage) onSelectImage(itemUrl, item);
              }}
              title={item.prompt}
            >
              {historyUrls && historyUrls[item.id] ? (
                <img
                  src={historyUrls[item.id]}
                  alt="History"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800 animate-pulse">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] flex justify-around items-center py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id, e);
                  }}
                  title={item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  className="flex items-center gap-1"
                >
                  <Star size={10} className={item.favorite ? 'fill-yellow-300 text-yellow-300' : 'text-yellow-200'} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyPrompt(item.prompt || '', e);
                  }}
                  title="프롬프트 복사"
                  className="flex items-center gap-1"
                >
                  <Copy size={10} />
                </button>
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item, e);
                    }}
                    title="편집"
                    className="flex items-center gap-1 text-sky-200"
                  >
                    <Pencil size={10} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id, e);
                  }}
                  title="삭제"
                  className="flex items-center gap-1 text-red-300"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!show && (
        <button
          onClick={onClose}
          className="absolute -left-9 top-4 p-2 bg-gray-900 text-white rounded-l-lg border border-gray-800 shadow-lg hover:bg-gray-800 transition-colors"
          title="이미지 히스토리 열기"
        >
          <HistoryIcon size={16} />
        </button>
      )}
    </div>
  );
};

ShortsImageHistorySidebar.displayName = 'ShortsImageHistorySidebar';

export default ShortsImageHistorySidebar;

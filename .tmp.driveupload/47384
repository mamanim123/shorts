import React from 'react';
import { StoryResponse } from '../types';
import { Trash2, FileText, Clock, ChevronRight, Star } from 'lucide-react';
import { Button } from './Button';

// Don't need props for interface, just using 'any' for now to avoid extensive refactor of type imports if they are in same file
import { StyleTemplate } from '../types';

interface HistoryPanelProps {
  stories: StoryResponse[];
  templates?: StyleTemplate[];
  selectedId: string | null;
  onSelect: (story: StoryResponse) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onSelectTemplate?: (template: StyleTemplate) => void;
  onDeleteTemplate?: (template: StyleTemplate) => void;
  onToggleTemplateFavorite?: (template: StyleTemplate, e: React.MouseEvent) => void;
  activeTab: 'stories' | 'templates' | 'video' | 'test';
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  stories,
  templates,
  selectedId,
  onSelect,
  onDelete,
  onToggleFavorite,
  onSelectTemplate,
  onDeleteTemplate,
  onToggleTemplateFavorite,
  activeTab
}) => {

  // Sort by newest first
  const sortedStories = [...stories].sort((a, b) => b.createdAt - a.createdAt);
  const sortedTemplates = templates ? [...templates].sort((a, b) => b.createdAt - a.createdAt) : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header removed - handled in App.tsx */}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* VIEW: CREATED (Standard AI) */}
        {activeTab === 'stories' && (
          sortedStories.filter(s => !['HYBRID', 'TEST', 'VIDEO_SCRIPT'].includes(s.service || '')).length === 0 ? (
            <EmptyState message="생성된 대본이 없습니다." />
          ) : (
            sortedStories.filter(s => !['HYBRID', 'TEST', 'VIDEO_SCRIPT'].includes(s.service || '')).map(story => (
              <StoryItem
                key={story.id}
                story={story}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          )
        )}

        {/* VIEW: VIDEO_SCRIPT (YouTube Search Analysis) */}
        {activeTab === 'video' && (
          sortedStories.filter(s => s.service === 'VIDEO_SCRIPT').length === 0 ? (
            <EmptyState message="저장된 영상 분석 대본이 없습니다." />
          ) : (
            sortedStories.filter(s => s.service === 'VIDEO_SCRIPT').map(story => (
              <StoryItem
                key={story.id}
                story={story}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          )
        )}

        {/* VIEW: TEMPLATE (Analyzed Templates) */}
        {activeTab === 'templates' && (
          sortedTemplates.length === 0 ? (
            <EmptyState message="분석된 템플릿이 없습니다." />
          ) : (
            sortedTemplates.map(tpl => {
              const isSelected = selectedId === tpl.id;
              const borderClass = isSelected
                ? 'border-blue-500/50 ring-1 ring-blue-500/50'
                : 'border-slate-200 dark:border-slate-800 hover:border-yellow-500/50';
              const bgClass = isSelected
                ? 'bg-blue-500/10'
                : 'bg-slate-100 dark:bg-slate-800/40 hover:bg-yellow-900/10';

              return (
                <div
                  key={tpl.id}
                  onClick={() => onSelectTemplate && onSelectTemplate(tpl)}
                  className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${borderClass} ${bgClass}`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate mb-1 text-yellow-500/90 text-sm">
                        <span className="mr-2 text-xs px-1.5 py-0.5 rounded bg-black/30 text-yellow-600">
                          Template
                        </span>
                        {tpl.name}
                      </h3>
                      <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 gap-2">
                        <Clock className="w-3 h-3" />
                        {new Date(tpl.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
                      )}
                      <button
                        onClick={(e) => onToggleTemplateFavorite && onToggleTemplateFavorite(tpl, e)}
                        className={`p-2 rounded-lg transition-colors ${tpl.isFavorite
                          ? 'text-yellow-400 hover:bg-yellow-400/10'
                          : 'text-slate-400 dark:text-slate-600 hover:text-yellow-400 hover:bg-yellow-400/10'
                          }`}
                        title="즐겨찾기"
                      >
                        <Star className={`w-4 h-4 ${tpl.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteTemplate && onDeleteTemplate(tpl); }}
                        className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}

        {/* VIEW: TEST (Test Scripts from Generator) */}
        {activeTab === 'test' && (
          sortedStories.filter(s => s.service === 'TEST').length === 0 ? (
            <EmptyState message="저장된 테스트 대본이 없습니다." />
          ) : (
            sortedStories.filter(s => s.service === 'TEST').map(story => (
              <StoryItem
                key={story.id}
                story={story}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          )
        )}
      </div>
    </div >
  );
};

// Sub-components for cleaner code
const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 dark:text-slate-500 space-y-4">
    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center">
      <FileText className="w-8 h-8 opacity-50" />
    </div>
    <p>{message}</p>
  </div>
);

const StoryItem = ({ story, selectedId, onSelect, onDelete, onToggleFavorite }: any) => {
  const service = story.service || 'GEMINI';
  const isSelected = selectedId === story.id;

  // Service Colors
  let borderClass = 'border-slate-200 dark:border-slate-800';
  let bgClass = 'bg-slate-100 dark:bg-slate-800/40';
  let textClass = 'text-slate-700 dark:text-slate-300';
  let badgeClass = 'text-slate-400';
  let badgeLabel = 'Gemini';

  if (service === 'HYBRID') {
    badgeLabel = 'Hybrid';
    if (!isSelected) {
      borderClass = 'border-purple-900/30 hover:border-purple-500/50';
      bgClass = 'bg-purple-900/10 hover:bg-purple-900/20';
      badgeClass = 'text-purple-400';
    }
  } else if (service === 'CHATGPT') {
    badgeLabel = 'GPT-4';
    if (!isSelected) {
      borderClass = 'border-emerald-900/30 hover:border-emerald-500/50';
      bgClass = 'bg-emerald-900/10 hover:bg-emerald-900/20';
      badgeClass = 'text-emerald-400';
    }
  } else if (service === 'CLAUDE') {
    badgeLabel = 'Claude';
    if (!isSelected) {
      borderClass = 'border-orange-900/30 hover:border-orange-500/50';
      bgClass = 'bg-orange-900/10 hover:bg-orange-900/20';
      badgeClass = 'text-orange-400';
    }
  } else if (service === 'VIDEO_SCRIPT') {
    badgeLabel = 'YouTube';
    if (!isSelected) {
      borderClass = 'border-red-900/30 hover:border-red-500/50';
      bgClass = 'bg-red-900/10 hover:bg-red-900/20';
      badgeClass = 'text-red-400';
    }
  } else {
    // Gemini
    if (!isSelected) {
      borderClass = 'border-blue-900/30 hover:border-blue-500/50';
      bgClass = 'bg-blue-900/10 hover:bg-blue-900/20';
      badgeClass = 'text-blue-400';
    }
  }

  if (isSelected) {
    borderClass = 'border-blue-500/50 ring-1 ring-blue-500/50';
    bgClass = 'bg-blue-500/10';
    textClass = 'text-blue-200';
  }

  return (
    <div
      onClick={() => onSelect(story)}
      className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${borderClass} ${bgClass}`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold truncate mb-1 ${textClass}`}>
            <span className={`mr-2 text-xs px-1.5 py-0.5 rounded bg-black/30 ${badgeClass}`}>
              {badgeLabel}
            </span>
            {story.title || "제목 없음"}
          </h3>
          <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 gap-2">
            <Clock className="w-3 h-3" />
            {new Date(story.createdAt).toLocaleString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isSelected && (
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
          )}
          <button
            onClick={(e) => onToggleFavorite(story.id, e)}
            className={`p-2 rounded-lg transition-colors ${story.isFavorite
              ? 'text-yellow-400 hover:bg-yellow-400/10'
              : 'text-slate-400 dark:text-slate-600 hover:text-yellow-400 hover:bg-yellow-400/10'
              }`}
            title="즐겨찾기"
          >
            <Star className={`w-4 h-4 ${story.isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => onDelete(story.id, e)}
            className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="삭제"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
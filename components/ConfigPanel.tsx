import React, { useState, useEffect } from 'react';
import { UserInput, EngineVersion, Dialect, TargetService } from '../types';
import { OUTFIT_STYLES, DIALECTS, AGE_GROUPS, FEMALE_OUTFIT_PRESETS, MALE_OUTFIT_PRESETS } from '../constants';
import { Globe, Bot, Settings2, Sliders } from 'lucide-react';
import { genreManager } from '../services/genreGuidelines';
import { PromptEnhancementSettings } from './PromptEnhancementSettings';
import { ensureEngineConfigLoaded, loadEngineOptions, EngineOption } from '../services/enginePromptStore';

interface ConfigPanelProps {
  input: UserInput & { onOpenYoutubeSearch?: () => void };
  onChange: (input: UserInput) => void;
  onOpenAnalysis: () => void;
  onOpenShortform: () => void;
  analysisActive?: boolean;
}

const getEngineDescription = (engineVersion: EngineVersion, options: EngineOption[]) => {
  const selectedOption = options.find(opt => opt.id === engineVersion);
  if (selectedOption) {
    return selectedOption.desc;
  }

  switch (engineVersion) {
    case 'V3':
      return '럭셔리 엔진 V3 규칙을 적용합니다.';
    case 'V3_COSTAR':
      return 'CO-STAR 구조와 룰을 적용합니다.';
    case 'NONE':
      return '템플릿/프리셋만 사용하며 엔진 규칙은 비활성화됩니다.';
    default:
      return '사용자 지정 엔진이 선택되었습니다.';
  }
};

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ input, onChange, onOpenAnalysis, onOpenShortform, analysisActive }) => {
  const [isEnhancementSettingsOpen, setIsEnhancementSettingsOpen] = React.useState(false);
  const [genreOptions, setGenreOptions] = useState(() => genreManager.getGenres());

  useEffect(() => {
    let isActive = true;

    const unsubscribe = genreManager.subscribe((updated) => {
      if (!isActive) return;
      setGenreOptions(updated);
    });

    genreManager.loadGenres()
      .then((loaded) => {
        if (!isActive) return;
        setGenreOptions(loaded);
      })
      .catch(() => {
        if (!isActive) return;
        setGenreOptions(genreManager.getGenres());
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 text-slate-800 dark:text-slate-200">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-purple-400" />
          쇼츠 생성 설정 <span className="text-sm font-semibold text-purple-400">-v3.5.1</span>
        </h2>
      </div>

      {/* 0. AI Service Selection */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
            <Bot className="w-3 h-3 text-purple-400" />
            AI 서비스 선택 (자동화)
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  await fetch('http://localhost:3002/api/launch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service: input.targetService || 'GEMINI' })
                  });
                } catch (e) {
                  alert("서버 연결 실패");
                }
              }}
              className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white px-2 py-0.5 rounded flex items-center gap-1"
            >
              <Globe className="w-3 h-3" />
              브라우저 열기
            </button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(['GEMINI', 'CHATGPT', 'CLAUDE', 'GENSPARK', 'DEEPSEEK'] as TargetService[]).map((service) => (
            <button
              key={service}
              onClick={() => onChange({ ...input, targetService: service })}
              className={`flex-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all border whitespace-nowrap ${(input.targetService || 'GEMINI') === service
                ? 'bg-purple-600 border-purple-500 text-slate-900 dark:text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-800 dark:text-slate-200'
                }`}
            >
              {service}
            </button>
          ))}
        </div>
      </div>

      {/* Regeneration Guidance Toggle */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg flex gap-1">
        {/* YouTube Search Button */}
        <button
          onClick={input.onOpenYoutubeSearch}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-bold transition-all bg-gradient-to-r from-red-600 to-pink-600 text-slate-900 dark:text-white shadow-lg hover:shadow-xl"
        >
          <Globe className="w-3 h-3" />
          유튜브 쇼츠 검색
        </button>

        {/* Prompt Enhancement Settings Button */}
        <button
          onClick={() => setIsEnhancementSettingsOpen(true)}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs font-bold transition-all bg-slate-700 text-purple-300 hover:bg-slate-600 hover:text-purple-200"
        >
          <Sliders className="w-3 h-3" />
          프롬프트 후처리 설정
        </button>
      </div>

      {/* 1. 대본 생성 옵션 (쇼츠 생성기 전용) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">대본 생성 옵션 (쇼츠 생성기용)</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onChange({ ...input, shortsGenerationMode: 'none' })}
            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all border ${input.shortsGenerationMode === 'none'
              ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-500/30'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            선택안함
          </button>
          <button
            onClick={() => onChange({ ...input, shortsGenerationMode: 'script-only' })}
            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all border ${input.shortsGenerationMode === 'script-only'
              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            대본만
          </button>
          <button
            onClick={() => onChange({ ...input, shortsGenerationMode: 'script-image' })}
            className={`py-2 px-3 rounded-lg text-sm font-bold transition-all border ${input.shortsGenerationMode === 'script-image'
              ? 'bg-purple-600 border-purple-500 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            대본+이미지
          </button>
        </div>
      </div>

      {/* 2. 장르 선택 + 타겟 연령 (가로 배치) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          {/* 장르 선택 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">장르 선택 (쇼츠용)</p>
            <select
              value={input.shortsGenre || 'none'}
              onChange={(e) => {
                const newGenre = e.target.value;
                onChange({ ...input, shortsGenre: newGenre });
                // ⭐ localStorage 동기화 - ShortsScriptGenerator와 연동
                localStorage.setItem('shorts-generator-genre', newGenre);
              }}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {genreOptions.map((genre) => (
                <option key={genre.id} value={genre.id}>{genre.name}</option>
              ))}
            </select>
          </div>

          {/* 타겟 연령 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">타겟 연령</p>
            <select
              value={input.targetAge || "40대"}
              onChange={(e) => onChange({ ...input, targetAge: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {AGE_GROUPS.map((age) => (
                <option key={age} value={age}>{age}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">생성 모드 (Generation Mode)</label>
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => { onChange({ ...input, customScript: undefined, customJson: undefined }); onOpenShortform(); }}
            className={`flex-1 py-2 px-1 rounded-md font-bold tracking-tight transition-colors flex flex-col items-center justify-center gap-0 h-10 text-[10px] text-center ${input.customScript === undefined && input.customJson === undefined
              ? 'bg-blue-600 text-slate-900 dark:text-white shadow-lg shadow-blue-500/30 border border-blue-500'
              : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
              }`}
          >
            <span>스토리</span>
            <span>생성</span>
          </button>
          <button
            onClick={() => { onChange({ ...input, customScript: "", customJson: undefined }); onOpenShortform(); }}
            className={`flex-1 py-2 px-1 rounded-md font-bold tracking-tight transition-colors flex flex-col items-center justify-center gap-0 h-10 text-[10px] text-center ${input.customScript !== undefined && input.customJson === undefined
              ? 'bg-purple-600 text-slate-900 dark:text-white shadow-lg shadow-purple-500/30 border border-purple-500'
              : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
              }`}
          >
            <span>대본→</span>
            <span>이미지</span>
          </button>
          <button
            onClick={() => { onChange({ ...input, customJson: "", customScript: undefined }); onOpenShortform(); }}
            className={`flex-1 py-2 px-1 rounded-md font-bold tracking-tight transition-colors flex flex-col items-center justify-center gap-0 h-10 text-[10px] text-center ${input.customJson !== undefined
              ? 'bg-green-600 text-slate-900 dark:text-white shadow-lg shadow-green-500/30 border border-green-500'
              : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
              }`}
          >
            <span>JSON</span>
            <span>입력</span>
          </button>
          <button
            onClick={onOpenAnalysis}
            className={`flex-1 py-2 px-1 rounded-md font-bold tracking-tight transition-colors flex flex-col items-center justify-center gap-0 h-10 text-[10px] text-center ${analysisActive
              ? 'bg-purple-600 text-slate-900 dark:text-white shadow-lg shadow-purple-500/30 border border-purple-500'
              : 'bg-gray-700 text-gray-100 hover:bg-gray-600 border border-gray-600'
              }`}
          >
            <span>대본</span>
            <span>분석</span>
          </button>
        </div>
      </div>

      {/* JSON Input Mode */}
      {input.customJson !== undefined && (
        <div className="mb-6 animate-fade-in">
          <label className="block text-sm font-medium text-green-400 mb-2">
            JSON 데이터 입력 (JSON Import)
          </label>
          <textarea
            value={input.customJson}
            onChange={(e) => onChange({ ...input, customJson: e.target.value })}
            placeholder="로그에서 복사한 JSON 데이터를 여기에 붙여넣으세요."
            className="w-full h-48 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-green-500/50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-slate-900 dark:text-white placeholder-gray-500 resize-none font-mono text-xs"
          />
        </div>
      )}

      {/* Script Input (Only in Script-to-Image Mode) */}
      {input.customScript !== undefined && input.customJson === undefined && (
        <div className="mb-6 animate-fade-in">
          <label className="block text-sm font-medium text-purple-400 mb-2">
            대본 입력 (Script Input)
          </label>
          <textarea
            value={input.customScript}
            onChange={(e) => onChange({ ...input, customScript: e.target.value })}
            placeholder="여기에 대본 전문을 붙여넣으세요. AI가 내용을 분석하여 최적의 이미지를 생성합니다."
            className="w-full h-48 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-purple-500/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 dark:text-white placeholder-gray-500 resize-none"
          />
        </div>
      )}

      {/* Story Settings (Only in Story Mode) */}
      {input.customScript === undefined && input.customJson === undefined && (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">추가 요청사항 (선택)</label>
            <textarea
              value={input.customContext || ''}
              onChange={(e) => onChange({ ...input, customContext: e.target.value })}
              placeholder="예: 골프 카트 씬을 강조해줘, 마지막 반전을 더 감동적으로 해줘..."
              className="w-full h-24 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 dark:text-white placeholder-gray-500 resize-none"
            />
          </div>
        </>

      )}

      <PromptEnhancementSettings
        isOpen={isEnhancementSettingsOpen}
        onClose={() => setIsEnhancementSettingsOpen(false)}
      />
    </div>
  );
};

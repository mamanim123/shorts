import React, { useState } from 'react';
import { Loader2, Wand2, CheckCircle2, Play, RotateCcw, Sparkles, ChevronRight, FileText, Download } from 'lucide-react';
import type { TargetService } from '../types';
import type { UserInput, StoryResponse, ScenarioMode } from '../types';
import {
  generateBenchmarkStorylinePackage,
  type BenchmarkStorylineItem,
  type BenchmarkStorylinePackage,
} from '../services/geminiService';
import { generateStory } from '../services/geminiService';
import { showToast } from './Toast';

// ============================================================================
// TYPES
// ============================================================================

interface NewChapterPanelProps {
  targetService?: TargetService;
}

type Step = 1 | 2 | 3 | 4;

const GENRE_OPTIONS = [
  { id: 'info', label: '📊 정보형', desc: '지식/정보 전달' },
  { id: 'emotional', label: '💖 감성형', desc: '감동/공감 유도' },
  { id: 'humor', label: '😂 유머형', desc: '웃음/재미' },
  { id: 'twist', label: '🔄 반전형', desc: '추리/반전' },
];

const DURATION_OPTIONS = [
  { id: '15s', label: '15초' },
  { id: '30s', label: '30초' },
  { id: '60s', label: '60초' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const NewChapterPanel: React.FC<NewChapterPanelProps> = ({ targetService }) => {
  // Step control
  const [step, setStep] = useState<Step>(1);

  // Step 1: Topic input
  const [topic, setTopic] = useState('');
  const [targetAge, setTargetAge] = useState('40대');
  const [selectedGenre, setSelectedGenre] = useState('humor');
  const [selectedDuration, setSelectedDuration] = useState('30s');
  const [benchmarkSource, setBenchmarkSource] = useState('');
  const [isGeneratingStorylines, setIsGeneratingStorylines] = useState(false);

  // Step 2: Storyline selection
  const [storylinePackage, setStorylinePackage] = useState<BenchmarkStorylinePackage | null>(null);
  const [selectedStorylineIndex, setSelectedStorylineIndex] = useState<number | null>(null);

  // Step 3: Script generation
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [generatedStory, setGeneratedStory] = useState<StoryResponse | null>(null);

  // Step 4: Result view
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleGenerateStorylines = async () => {
    if (!topic.trim()) {
      showToast('주제를 입력해주세요.', 'warning');
      return;
    }

    setIsGeneratingStorylines(true);
    setError(null);
    setSelectedStorylineIndex(null);

    try {
      const result = await generateBenchmarkStorylinePackage(
        topic.trim(),
        benchmarkSource.trim() || undefined,
        {
          style: '실사풍',
          language: 'ko',
          outputFormat: 'shorts',
          targetDuration: selectedDuration,
          scriptStructure: 'narration',
        }
      );

      setStorylinePackage(result);
      setStep(2);
      showToast(`${result.storylines.length}개 줄거리 생성 완료!`, 'success');
    } catch (err: any) {
      console.error('[NewVersion] storyline generation failed:', err);
      setError(err.message || '줄거리 생성 실패');
      showToast(err.message || '줄거리 생성 실패', 'error');
    } finally {
      setIsGeneratingStorylines(false);
    }
  };

  const handleSelectStoryline = (index: number) => {
    setSelectedStorylineIndex(index);
  };

  const handleGenerateScript = async () => {
    if (selectedStorylineIndex === null || !storylinePackage) {
      showToast('줄거리를 먼저 선택해주세요.', 'warning');
      return;
    }

    setIsGeneratingScript(true);
    setError(null);

    try {
      const selectedStoryline = storylinePackage.storylines[selectedStorylineIndex];

      const userInput: UserInput = {
        topic: topic.trim(),
        category: selectedGenre,
        scenarioMode: 'GAG_SSUL' as ScenarioMode,
        dialect: '서울' as any,
        customContext: selectedStoryline.content,
        targetAge: targetAge,
        engineVersion: 'V3',
        targetService: targetService || 'GEMINI',
        useViralMode: false,
        useRegenerationGuidance: false,
        enableWinterAccessories: false,
      };

      const story = await generateStory(userInput);
      setGeneratedStory(story);
      setStep(4);
      showToast('대본 생성 완료!', 'success');
    } catch (err: any) {
      console.error('[NewVersion] script generation failed:', err);
      setError(err.message || '대본 생성 실패');
      showToast(err.message || '대본 생성 실패', 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setStorylinePackage(null);
    setSelectedStorylineIndex(null);
    setGeneratedStory(null);
    setError(null);
  };

  const handleDownloadScript = () => {
    if (!generatedStory) return;
    const content = JSON.stringify(generatedStory, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `new-version-script-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
    showToast('대본 JSON 다운로드 완료', 'success');
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const getGenreLabel = (id: string) => GENRE_OPTIONS.find(g => g.id === id)?.label || id;

  const renderStepIndicator = () => (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-400">현재 단계</div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" /> 처음으로
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { n: 1, label: '주제 입력' },
          { n: 2, label: '줄거리 선택' },
          { n: 3, label: '대본 생성' },
          { n: 4, label: '결과 확인' },
        ].map(({ n, label }) => (
          <button
            key={n}
            type="button"
            onClick={() => { if (n < step) setStep(n as Step); }}
            className={`px-3 py-2 rounded border text-xs font-medium transition-all ${
              step === n
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : n < step
                ? 'bg-emerald-900/40 border-emerald-600 text-emerald-300 cursor-pointer'
                : 'bg-slate-800 border-slate-700 text-slate-500 cursor-default'
            }`}
          >
            {n}. {label}
          </button>
        ))}
      </div>
    </div>
  );

  // ============================================================================
  // STEP 1: Topic Input
  // ============================================================================

  const renderStep1 = () => (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-indigo-400" /> 1단계: 주제 입력
      </h3>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">주제 *</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="예: 골프장에서 벌어진 해프닝, 사내 비밀 등"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-400 mb-1 block">타겟 연령</label>
            <select
              value={targetAge}
              onChange={(e) => setTargetAge(e.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            >
              <option value="20대">20대</option>
              <option value="30대">30대</option>
              <option value="40대">40대</option>
              <option value="50대">50대</option>
              <option value="60대">60대</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-400 mb-1 block">목표 길이</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedDuration(opt.id)}
                  className={`flex-1 px-2 py-2 rounded border text-xs font-medium ${
                    selectedDuration === opt.id
                      ? 'bg-indigo-600 border-indigo-400 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">장르 선호</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {GENRE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedGenre(opt.id)}
                className={`px-3 py-2 rounded border text-xs font-medium transition-all ${
                  selectedGenre === opt.id
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] opacity-70">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1 block">벤치마크 참고 (선택)</label>
          <textarea
            value={benchmarkSource}
            onChange={(e) => setBenchmarkSource(e.target.value)}
            className="w-full min-h-[80px] rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="참고할 영상/콘텐츠의 URL이나 설명을 입력하세요"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleGenerateStorylines}
        disabled={isGeneratingStorylines || !topic.trim()}
        className="w-full rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all"
      >
        {isGeneratingStorylines ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> 10개 줄거리 생성 중...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> 줄거리 10개 생성하기
          </>
        )}
      </button>
    </section>
  );

  // ============================================================================
  // STEP 2: Storyline Selection
  // ============================================================================

  const renderStep2 = () => {
    if (!storylinePackage) return null;

    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 2단계: 줄거리 선택
        </h3>

        {storylinePackage.analysis.sourceSummary && (
          <div className="rounded border border-slate-700 bg-slate-800 p-3 text-xs text-slate-300">
            <div className="font-semibold text-slate-200 mb-1">📊 벤치마크 분석</div>
            <div>{storylinePackage.analysis.sourceSummary}</div>
            {storylinePackage.analysis.hookPattern && (
              <div className="mt-1">훅 패턴: {storylinePackage.analysis.hookPattern}</div>
            )}
          </div>
        )}

        <div className="text-sm text-slate-400">
          생성된 {storylinePackage.storylines.length}개 줄거리 중 하나를 선택하세요
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {storylinePackage.storylines.map((storyline, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectStoryline(index)}
              className={`w-full text-left rounded-lg border p-3 transition-all ${
                selectedStorylineIndex === index
                  ? 'border-indigo-400 bg-indigo-900/30 ring-1 ring-indigo-400'
                  : 'border-slate-700 bg-slate-800 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedStorylineIndex === index
                    ? 'bg-indigo-500 text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{storyline.title}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-2">{storyline.content}</div>
                  <div className="flex gap-2 mt-2">
                    {storyline.hook && (
                      <span className="inline-block text-[10px] bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded">
                        🎣 {storyline.hook.slice(0, 30)}...
                      </span>
                    )}
                    {storyline.twist && (
                      <span className="inline-block text-[10px] bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded">
                        🔄 {storyline.twist.slice(0, 30)}...
                      </span>
                    )}
                  </div>
                </div>
                {selectedStorylineIndex === index && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium"
          >
            ← 이전
          </button>
          <button
            type="button"
            onClick={handleGenerateScript}
            disabled={selectedStorylineIndex === null || isGeneratingScript}
            className="flex-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-bold flex items-center justify-center gap-2"
          >
            {isGeneratingScript ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> 대본 생성 중...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> 선택한 줄거리로 대본 생성
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </section>
    );
  };

  // ============================================================================
  // STEP 3: Script Generation (loading state)
  // ============================================================================

  const renderStep3 = () => (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-8 space-y-4 text-center">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mx-auto" />
      <h3 className="font-semibold text-lg">대본 생성 중...</h3>
      <p className="text-sm text-slate-400">
        선택한 줄거리를 바탕으로 AI가 대본과 이미지 프롬프트를 생성하고 있습니다.
      </p>
      <p className="text-xs text-slate-500">약 30~60초 소요될 수 있습니다.</p>
    </section>
  );

  // ============================================================================
  // STEP 4: Result
  // ============================================================================

  const renderStep4 = () => {
    if (!generatedStory) return null;

    return (
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" /> 4단계: 생성 결과
        </h3>

        {/* Title */}
        <div className="rounded border border-slate-700 bg-slate-800 p-3">
          <div className="text-xs text-slate-400 mb-1">제목</div>
          <div className="font-bold text-lg">{generatedStory.title}</div>
          {generatedStory.titleOptions && generatedStory.titleOptions.length > 0 && (
            <div className="text-xs text-slate-400 mt-1">
              대안: {generatedStory.titleOptions.join(' | ')}
            </div>
          )}
        </div>

        {/* Script Body */}
        <div className="rounded border border-slate-700 bg-slate-800 p-3">
          <div className="text-xs text-slate-400 mb-1">대본</div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
            {generatedStory.scriptBody}
          </div>
        </div>

        {/* Punchline */}
        {generatedStory.punchline && (
          <div className="rounded border border-amber-700/50 bg-amber-900/20 p-3">
            <div className="text-xs text-amber-400 mb-1">🔥 펀치라인</div>
            <div className="font-bold text-amber-200">{generatedStory.punchline}</div>
          </div>
        )}

        {/* Characters */}
        {generatedStory.characters && generatedStory.characters.length > 0 && (
          <div className="rounded border border-slate-700 bg-slate-800 p-3">
            <div className="text-xs text-slate-400 mb-2">캐릭터</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {generatedStory.characters.map((char: any, idx: number) => (
                <div key={idx} className="rounded bg-slate-900 p-2 text-xs">
                  <div className="font-semibold">{char.name || char.id}</div>
                  <div className="text-slate-400">{char.outfit || '의상 없음'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scenes */}
        {generatedStory.scenes && generatedStory.scenes.length > 0 && (
          <div className="rounded border border-slate-700 bg-slate-800 p-3">
            <div className="text-xs text-slate-400 mb-2">씬 ({generatedStory.scenes.length}개)</div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {generatedStory.scenes.map((scene: any, idx: number) => (
                <div key={idx} className="rounded bg-slate-900 p-2 text-xs">
                  <div className="font-semibold text-slate-200 mb-1">Scene {scene.sceneNumber || idx + 1}</div>
                  {scene.shortPrompt && (
                    <div className="text-slate-400 mb-1">
                      <span className="text-indigo-300">Short:</span> {scene.shortPrompt.slice(0, 120)}...
                    </div>
                  )}
                  {scene.longPrompt && (
                    <details className="text-slate-400">
                      <summary className="cursor-pointer text-indigo-300">Long Prompt 보기</summary>
                      <pre className="mt-1 whitespace-pre-wrap break-words text-[10px]">{scene.longPrompt}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> 새로 시작
          </button>
          <button
            type="button"
            onClick={handleDownloadScript}
            className="rounded bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> JSON 다운로드
          </button>
        </div>
      </section>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="h-full overflow-y-auto p-4 text-slate-100 bg-slate-950">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-xl border border-indigo-700/50 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 p-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" /> 뉴버전 - AI 줄거리 기반 대본 생성
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            주제 입력 → 10개 줄거리 자동 생성 → 선택한 줄거리로 대본+이미지프롬프트 완성
          </p>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Error */}
        {error && (
          <div className="rounded border border-rose-700 bg-rose-900/30 p-3 text-sm text-rose-300">
            ⚠️ {error}
          </div>
        )}

        {/* Steps */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
};

export default NewChapterPanel;
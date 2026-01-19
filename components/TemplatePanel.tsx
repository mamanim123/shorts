import React from 'react';
import { StyleTemplate, UserInput } from '../types';
import { Button } from './Button';

interface TemplatePanelProps {
  input: UserInput;
  scriptText: string;
  onScriptChange: (value: string) => void;
  templateType: 'shortform' | 'longform';
  onTypeChange: (value: 'shortform' | 'longform') => void;
  onAnalyze: () => void;
  onApplyTemplate: (template: StyleTemplate) => void;
  onClearTemplate: () => void;
  onOpenResult: () => void;
  onViewTemplate: (template: StyleTemplate) => void;
  onManualApply: (jsonText: string) => void; // [NEW] Manual template apply
  templates: StyleTemplate[];
  loading: boolean;
  analysisResult?: StyleTemplate | null;
  error?: string | null;
  activeTemplate?: StyleTemplate | null;
}

export const TemplatePanel: React.FC<TemplatePanelProps> = ({
  scriptText,
  onScriptChange,
  templateType,
  onTypeChange,
  onAnalyze,
  templates,
  onApplyTemplate,
  onClearTemplate,
  onOpenResult,
  onViewTemplate,
  onManualApply,
  loading,
  analysisResult,
  error,
  activeTemplate
}) => {
  const [manualJson, setManualJson] = React.useState('');
  const [showManualInput, setShowManualInput] = React.useState(false);
  const [ytDlpStatus, setYtDlpStatus] = React.useState('');
  const [ytDlpLoading, setYtDlpLoading] = React.useState(false);

  const handleManualApply = () => {
    if (!manualJson.trim()) {
      alert('JSON을 입력해주세요');
      return;
    }
    onManualApply(manualJson);
    setManualJson('');
    setShowManualInput(false);
  };

  const handleUpgradeYtDlp = async () => {
    setYtDlpLoading(true);
    setYtDlpStatus('');
    try {
      const res = await fetch('http://localhost:3002/api/yt-dlp-upgrade', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '업그레이드 실패');
      }
      setYtDlpStatus((data.stdout || '업그레이드 완료').trim());
    } catch (e: any) {
      setYtDlpStatus(e?.message || '업그레이드 실패');
    } finally {
      setYtDlpLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-slate-900/60 rounded-xl border border-slate-800">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">대본 분석 & 템플릿 추출 (실험적)</h3>
        <p className="text-sm text-slate-400">성공한 대본 또는 유튜브 URL을 입력해 스타일을 분석하고 템플릿으로 저장합니다.</p>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 flex items-center gap-2">
          <span>대본 또는 유튜브 URL 입력 (최대 몇천자 권장)</span>
        </label>
        <textarea
          value={scriptText}
          onChange={(e) => onScriptChange(e.target.value)}
          className="w-full h-48 bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="대박난 대본을 붙여넣거나, 유튜브 쇼츠 URL을 입력하세요 (예: https://youtube.com/shorts/...)"
        />
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="radio"
            checked={templateType === 'shortform'}
            onChange={() => onTypeChange('shortform')}
          />
          숏폼 템플릿
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="radio"
            checked={templateType === 'longform'}
            onChange={() => onTypeChange('longform')}
          />
          롱폼 템플릿
        </label>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          onClick={() => {
            if (scriptText.trim().startsWith('{') && scriptText.includes('"templateName"')) {
              if (confirm('입력하신 내용은 "대본"이 아니라 "템플릿 설정값(JSON)" 같습니다.\n\nAI 분석을 돌리는 대신 "수동 적용"을 하시겠습니까?')) {
                setManualJson(scriptText);
                setShowManualInput(true);
                return;
              }
            }
            onAnalyze();
          }}
          disabled={!scriptText || loading}
        >
          {loading ? '분석 중...' : '스타일 분석'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowManualInput(!showManualInput)}
        >
          {showManualInput ? '수동 입력 닫기' : '수동 적용'}
        </Button>
        {(analysisResult || activeTemplate) && (
          <Button variant="secondary" onClick={onOpenResult}>
            분석결과 크게 보기
          </Button>
        )}
        <Button variant="secondary" onClick={handleUpgradeYtDlp} disabled={ytDlpLoading}>
          {ytDlpLoading ? 'yt-dlp 업그레이드 중...' : 'yt-dlp 자동 업그레이드'}
        </Button>
      </div>

      {ytDlpStatus && (
        <p className="text-xs text-slate-400 whitespace-pre-wrap bg-slate-950/70 border border-slate-800 rounded-lg p-2">
          {ytDlpStatus}
        </p>
      )}

      {/* Manual JSON Input */}
      {showManualInput && (
        <div className="bg-slate-950/70 border border-yellow-600/40 rounded-lg p-4 space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-yellow-400 mb-2">수동 템플릿 적용</h4>
            <p className="text-xs text-slate-400 mb-3">
              AI가 응답을 완료했지만 자동 파싱에 실패한 경우, AI의 JSON 응답을 직접 붙여넣으세요.
            </p>
          </div>
          <textarea
            value={manualJson}
            onChange={(e) => setManualJson(e.target.value)}
            className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
            placeholder='{"templateName": "...", "structure": [...], "tone": "...", ...}'
          />
          <Button onClick={handleManualApply} disabled={!manualJson.trim()}>
            JSON 적용하기
          </Button>
        </div>
      )}

      {analysisResult && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-sm text-slate-200">
          <h4 className="font-semibold text-white mb-2">새 템플릿 저장됨: {analysisResult.name}</h4>
          <p>구조: {analysisResult.structure.join(' → ')}</p>
          <p>톤: {analysisResult.tone}</p>
          <p>Hook 전략: {analysisResult.hookStrategy}</p>
          <p>Twist 스타일: {analysisResult.twistStyle}</p>
        </div>
      )}

      {activeTemplate && (
        <div className="bg-slate-950/70 border border-emerald-600/40 rounded-lg p-3 text-sm text-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-white">현재 적용 템플릿: {activeTemplate.name}</h4>
            <Button variant="secondary" onClick={onClearTemplate}>해제</Button>
          </div>
          <p>구조: {activeTemplate.structure.join(' → ')}</p>
          <p>톤: {activeTemplate.tone}</p>
          <p>Hook 전략: {activeTemplate.hookStrategy}</p>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold text-slate-200 mb-2">저장된 템플릿</h4>
        {templates.length === 0 && <p className="text-sm text-slate-500">아직 저장된 템플릿이 없습니다.</p>}
        <div className="space-y-2 max-h-56 overflow-y-auto text-xs text-slate-400">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 rounded px-3 py-2">
              <button
                className="text-left text-slate-200 flex-1 truncate hover:text-white"
                onClick={() => onViewTemplate(tpl)}
              >
                {tpl.name} · {tpl.type}
              </button>
              <div className="flex items-center gap-2 ml-2">
                <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => onViewTemplate(tpl)}>
                  보기
                </Button>
                <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => onApplyTemplate(tpl)}>
                  적용
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

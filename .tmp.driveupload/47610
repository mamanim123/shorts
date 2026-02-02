import React from 'react';
import { ChapterSummary, UserInput } from '../types';
import { Button } from './Button';

interface LongformPanelProps {
  input: UserInput;
  topic: string;
  onTopicChange: (value: string) => void;
  onGenerateSummary: () => void;
  onApproveChapter: (order: number) => void;
  onRegenerateChapter: (chapter: ChapterSummary) => void;
  onSaveSession: () => void;
  onGenerateChapterContent: (chapter: ChapterSummary) => void;
  onGenerateAllChapters: () => void;
  onLoadSession: (sessionId: string) => void;
  sessions: Array<{ sessionId: string; topic: string; updatedAt: number }>;
  chapters: ChapterSummary[] | null;
  loading: boolean;
  sessionId: string | null;
  error?: string | null;
  finalScript: string;
  onCopyFinalScript: () => void;
}

export const LongformPanel: React.FC<LongformPanelProps> = ({
  topic,
  onTopicChange,
  onGenerateSummary,
  chapters,
  loading,
  onApproveChapter,
  onRegenerateChapter,
  onSaveSession,
  onGenerateChapterContent,
  onGenerateAllChapters,
  onLoadSession,
  sessions,
  sessionId,
  error,
  finalScript,
  onCopyFinalScript
}) => {
  return (
    <div className="h-full flex flex-col p-8 text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">롱폼 스토리 빌더</h2>
          <p className="text-slate-400 text-sm">Hook → 갈등 → 전환 → 클라이맥스 → 에필로그 구조로 먼저 챕터 요약을 생성합니다.</p>
        </div>
        <div className="space-x-2">
          <Button onClick={onGenerateSummary} disabled={loading}>
            {loading ? '생성 중...' : '챕터 요약 생성'}
          </Button>
          <Button onClick={onGenerateAllChapters} variant="secondary" disabled={!chapters || loading}>
            전체 본문 생성
          </Button>
          <Button onClick={onSaveSession} variant="secondary" disabled={!chapters || chapters.length === 0 || loading}>
            세션 저장
          </Button>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">저장된 세션</label>
          <select
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            onChange={(e) => e.target.value && onLoadSession(e.target.value)}
            value=""
          >
            <option value="" disabled>세션을 선택하세요</option>
            {sessions.map(session => (
              <option key={session.sessionId} value={session.sessionId}>
                {session.topic} · {new Date(session.updatedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-500">현재 세션: {sessionId || '없음'}</div>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-slate-400 mb-2">주제 / 상황</label>
        <input
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder="예: 골프장에서 벌어진 소동"
          className="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400">{error}</div>
      )}

      {sessionId && (
        <div className="mb-4 text-xs text-slate-500">세션 ID: {sessionId}</div>
      )}

      {!chapters && !loading && (
        <div className="flex-1 flex items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
          <p>챕터 요약을 생성해 주세요.</p>
        </div>
      )}

      {chapters && (
        <div className="space-y-4">
          {chapters.map((chapter) => (
            <div key={chapter.order} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-white">{chapter.order}. {chapter.title}</h3>
                  <p className="text-xs text-slate-400">감정: {chapter.emotions}</p>
                </div>
                <div className="space-x-2">
                  <Button
                    variant={chapter.status === 'approved' ? 'primary' : 'secondary'}
                    onClick={() => onApproveChapter(chapter.order)}
                    disabled={loading}
                  >
                    {chapter.status === 'approved' ? '승인됨' : '승인'}
                  </Button>
                  <Button variant="secondary" onClick={() => onRegenerateChapter(chapter)} disabled={loading}>
                    다시 생성
                  </Button>
                </div>
              </div>
              <p className="text-slate-200 whitespace-pre-line text-sm leading-relaxed">{chapter.summary}</p>
              {chapter.twistHint && (
                <p className="text-xs text-slate-400 mt-2">Twist Hint: {chapter.twistHint}</p>
              )}
              <div className="mt-4 bg-slate-950/50 border border-slate-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">
                    {chapter.content ? '본문이 생성되었습니다.' : '본문이 아직 생성되지 않았습니다.'}
                  </span>
                  <Button variant="secondary" onClick={() => onGenerateChapterContent(chapter)} disabled={loading}>
                    {chapter.content ? '본문 다시 생성' : '본문 생성'}
                  </Button>
                </div>
                {chapter.content && (
                  <div className="text-sm text-slate-100 whitespace-pre-line max-h-64 overflow-y-auto leading-relaxed">
                    {chapter.content}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {chapters && finalScript && (
        <div className="mt-8 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-lg font-semibold text-white">최종 본문 미리보기</h4>
            <Button variant="secondary" onClick={onCopyFinalScript}>
              전체 복사
            </Button>
          </div>
          <div className="text-sm text-slate-200 whitespace-pre-line max-h-96 overflow-y-auto leading-relaxed">
            {finalScript}
          </div>
        </div>
      )}
    </div>
  );
};

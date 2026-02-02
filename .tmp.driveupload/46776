import React from 'react';
import { StyleTemplate } from '../types';
import { Button } from './Button';

interface TemplateResultDisplayProps {
  template: StyleTemplate;
  onClose: () => void;
}

export const TemplateResultDisplay: React.FC<TemplateResultDisplayProps> = ({ template, onClose }) => {
  return (
    <div className="h-full w-full flex flex-col p-10 text-slate-100 overflow-y-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs text-slate-500">템플릿 분석 결과</p>
          <h2 className="text-3xl font-bold text-white">{template.name}</h2>
          <p className="text-sm text-slate-400 mt-1">{new Date(template.createdAt).toLocaleString()} · {template.type}</p>
        </div>
        <Button variant="secondary" onClick={onClose}>닫기</Button>
      </div>

      <div className="space-y-6 text-slate-200">
        <section>
          <h3 className="text-xl font-semibold text-white mb-2">Hook 전략</h3>
          <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.hookStrategy}</p>
          {template.hookTiming && (
            <p className="text-xs text-slate-400 mt-1">훅 타이밍: {template.hookTiming}</p>
          )}
        </section>

        <section>
          <h3 className="text-xl font-semibold text-white mb-2">구조</h3>
          <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
            {(template.structure ?? []).map((step, idx) => (
              <li key={`${template.id}-structure-${idx}`}>{step}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-xl font-semibold text-white mb-2">톤</h3>
          <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.tone}</p>
          {(template.lengthGuidance || template.dialogueRatio) && (
            <div className="text-xs text-slate-400 mt-1 space-y-0.5">
              {template.lengthGuidance && <p>길이: {template.lengthGuidance}</p>}
              {template.dialogueRatio && <p>대사비율: {template.dialogueRatio}</p>}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xl font-semibold text-white mb-2">Twist 스타일</h3>
          <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.twistStyle}</p>
        </section>

        {template.characterNotes && (
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">캐릭터 노트</h3>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.characterNotes}</p>
          </section>
        )}

        {template.visualBeats && template.visualBeats.length > 0 && (
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">비주얼 비트 / 컷</h3>
            <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
              {template.visualBeats.map((beat, idx) => (
                <li key={`${template.id}-vb-${idx}`}>{beat}</li>
              ))}
            </ul>
          </section>
        )}

        {template.gagPattern && (
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">개그/반전 패턴</h3>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.gagPattern}</p>
          </section>
        )}

        {template.ctaStyle && (
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">CTA / 엔딩</h3>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.ctaStyle}</p>
          </section>
        )}

        {template.mustHaveObjects && template.mustHaveObjects.length > 0 && (
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">필수 오브젝트</h3>
            <ul className="list-disc list-inside text-sm text-slate-200 space-y-1">
              {template.mustHaveObjects.map((obj, idx) => (
                <li key={`${template.id}-obj-${idx}`}>{obj}</li>
              ))}
            </ul>
          </section>
        )}

        {template.imageNotes && (
          <section>
            <h3 className="text-xl font-semibold text-white mb-2">비주얼/이미지 노트</h3>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">{template.imageNotes}</p>
          </section>
        )}
      </div>
    </div>
  );
};

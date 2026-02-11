import React, { useMemo, useState } from 'react';
import { Loader2, Download, FileText, Wand2, Scissors, ShieldCheck } from 'lucide-react';
import type { TargetService } from '../types';
import { parseJsonFromText } from '../services/jsonParse';
import { buildLabScriptPrompt } from '../services/labPromptBuilder';
import { showToast } from './Toast';

type SplitMode = 'context' | 'precision';

type CharacterLock = {
  id: string;
  name: string;
  lockedTraits: string;
  tokenString: string;
  aliases: string;
};

type ScenePromptRow = {
  sceneNo: number;
  sourceText: string;
  action: string;
  location: string;
  camera: string;
  mood: string;
  characterRefs: string[];
  overrides: string;
  promptBase: string;
  promptFinal: string;
};

type ProductionReport = {
  project: {
    ratio: '9:16';
    engine: string;
    styleDNA: string;
    splitMode: SplitMode;
  };
  characters: Array<{
    id: string;
    name: string;
    lockedTraits: string;
    tokenString: string;
    aliases: string[];
  }>;
  scenes: Array<{
    sceneNo: number;
    sourceText: string;
    promptBase: string;
    promptFinal: string;
    overrides: string;
    characterRefs: string[];
  }>;
  checks: {
    consistencyScore: number;
    missingLocks: string[];
    warnings: string[];
  };
};

const STYLE_PRESETS = [
  { id: 'cinematic', label: '시네마틱 실사', prompt: 'cinematic photography, dramatic lighting, realistic skin texture, filmic contrast' },
  { id: 'kdrama', label: 'K-드라마', prompt: 'k-drama aesthetic, clean beauty lighting, soft highlight rolloff, premium production look' },
  { id: 'noir', label: '누아르', prompt: 'film noir mood, high contrast shadows, moody backlight, cinematic grain' },
  { id: 'illustration', label: '동화 일러스트', prompt: 'storybook illustration style, soft color palette, painterly texture, whimsical mood' }
];

const DEFAULT_CHARACTERS: CharacterLock[] = [
  {
    id: 'C1',
    name: '주인공',
    lockedTraits: '40대 한국인, 또렷한 눈매, 자연스러운 헤어, 안정된 표정',
    tokenString: 'Korean protagonist, 40s, consistent facial features, consistent hairstyle, same identity across all scenes',
    aliases: '나,본인,주인공'
  },
  {
    id: 'C2',
    name: '조연',
    lockedTraits: '40대 한국인, 단정한 스타일, 보조 리액션 담당',
    tokenString: 'Korean supporting character, 40s, consistent face and outfit, same identity across all scenes',
    aliases: '친구,동료,상대'
  }
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const splitSentences = (text: string): string[] => {
  const normalized = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  const chunks = normalized
    .split(/(?<=[.!?。！？]|다\.|요\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return chunks.length > 0 ? chunks : [normalized];
};

const contextSplit = (script: string, desiredCount: number): string[] => {
  const sentences = splitSentences(script);
  if (sentences.length === 0) return [];
  if (sentences.length <= desiredCount) return sentences;

  const result: string[] = [];
  const step = sentences.length / desiredCount;
  for (let i = 0; i < desiredCount; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const segment = sentences.slice(start, end > start ? end : start + 1).join(' ').trim();
    if (segment) result.push(segment);
  }
  return result.length > 0 ? result : sentences;
};

const precisionSplit = (script: string, desiredCount: number): string[] => {
  const normalized = script.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (desiredCount <= 1) return [normalized];

  const roughChunkSize = Math.max(1, Math.floor(normalized.length / desiredCount));
  const pieces: string[] = [];
  let cursor = 0;

  for (let i = 0; i < desiredCount - 1; i += 1) {
    let cut = cursor + roughChunkSize;
    if (cut >= normalized.length) break;
    const nextBoundary = normalized.slice(cut, cut + 40).search(/[.!?。！？,]/);
    if (nextBoundary >= 0) {
      cut += nextBoundary + 1;
    }
    const piece = normalized.slice(cursor, cut).trim();
    if (piece) pieces.push(piece);
    cursor = cut;
  }

  const tail = normalized.slice(cursor).trim();
  if (tail) pieces.push(tail);

  return pieces.filter(Boolean);
};

const parseScriptFromRawResponse = (rawText: string): { scriptBody: string; scenes: any[] } => {
  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/^(JSON|json)\s+/, '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/, '').replace(/```$/, '').trim();
  }

  const parsed = parseJsonFromText<any>(cleaned, [
    'scripts',
    'script',
    'scriptBody',
    'scenes',
    'sceneNumber',
    'scriptLine',
    'summary',
    'longPrompt',
    'shortPrompt'
  ]);

  if (!parsed) {
    return { scriptBody: rawText, scenes: [] };
  }

  const scriptData = parsed.scripts?.[0] || parsed;
  const rawScript = scriptData.scriptBody || scriptData.script || parsed.scriptBody || parsed.script || '';
  const scriptMatch = typeof rawScript === 'string' ? rawScript.match(/---\s*([\s\S]*?)\s*---/) : null;
  const scriptBody = scriptMatch ? scriptMatch[1].trim() : String(rawScript || '').trim();
  const scenes = Array.isArray(scriptData.scenes) ? scriptData.scenes : Array.isArray(parsed.scenes) ? parsed.scenes : [];

  return { scriptBody, scenes };
};

const downloadBlob = (fileName: string, content: BlobPart, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

interface NewChapterPanelProps {
  targetService?: TargetService;
}

export const NewChapterPanel: React.FC<NewChapterPanelProps> = ({ targetService }) => {
  const [step, setStep] = useState<number>(1);
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('comedy-humor');
  const [targetAge, setTargetAge] = useState('40대');
  const [scriptText, setScriptText] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  const [splitMode, setSplitMode] = useState<SplitMode>('context');
  const [sceneCount, setSceneCount] = useState(12);
  const [sceneRows, setSceneRows] = useState<ScenePromptRow[]>([]);

  const [stylePreset, setStylePreset] = useState(STYLE_PRESETS[0].id);
  const [styleDna, setStyleDna] = useState('consistent visual style, coherent tone across all scenes');
  const [lighting, setLighting] = useState('cinematic soft key light');
  const [lens, setLens] = useState('35mm cinematic lens');
  const [texture, setTexture] = useState('high detail, realistic texture');

  const [characters, setCharacters] = useState<CharacterLock[]>(DEFAULT_CHARACTERS);
  const [engine] = useState('PRO');

  const selectedStylePrompt = useMemo(
    () => STYLE_PRESETS.find((item) => item.id === stylePreset)?.prompt || STYLE_PRESETS[0].prompt,
    [stylePreset]
  );

  const buildGlobalStyleBlock = useMemo(() => {
    return [
      selectedStylePrompt,
      styleDna,
      lighting,
      lens,
      texture,
      'aspect ratio 9:16'
    ]
      .map((item) => item.trim())
      .filter(Boolean)
      .join(', ');
  }, [selectedStylePrompt, styleDna, lighting, lens, texture]);

  const handleGenerateScript = async () => {
    if (!topic.trim()) {
      showToast('주제를 입력해주세요.', 'warning');
      return;
    }

    setIsGeneratingScript(true);
    try {
      const prompt = buildLabScriptPrompt({
        topic: topic.trim(),
        genre,
        targetAge,
        gender: 'female'
      });

      const selectedService = targetService || 'GEMINI';
      const response = await fetch('http://localhost:3002/api/generate/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService,
          prompt,
          maxTokens: 2000,
          temperature: 0.9
        })
      });

      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const payload = await response.json();
      const generatedText = payload.rawResponse || payload.text || payload.result || '';
      const parsed = parseScriptFromRawResponse(String(generatedText || ''));

      const finalScript = parsed.scriptBody || String(generatedText || '').trim();
      setScriptText(finalScript);

      if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
        const rows: ScenePromptRow[] = parsed.scenes.map((scene: any, index: number) => ({
          sceneNo: scene.sceneNumber || index + 1,
          sourceText: scene.scriptLine || scene.summary || scene.text || `장면 ${index + 1}`,
          action: scene.action || '',
          location: scene.location || '',
          camera: scene.cameraAngle || scene.camera || 'medium shot',
          mood: scene.mood || 'cinematic',
          characterRefs: [],
          overrides: '',
          promptBase: '',
          promptFinal: ''
        }));
        setSceneRows(rows);
      }

      setStep(2);
      showToast(`${selectedService} AI로 대본 생성 완료`, 'success');
    } catch (error) {
      console.error('[NewChapter] script generation failed:', error);
      showToast(error instanceof Error ? error.message : '대본 생성 실패', 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSplitScenes = () => {
    const count = Math.max(5, Math.min(100, Number(sceneCount) || 12));
    const chunks = splitMode === 'precision' ? precisionSplit(scriptText, count) : contextSplit(scriptText, count);
    const rows: ScenePromptRow[] = chunks.map((text, index) => ({
      sceneNo: index + 1,
      sourceText: text,
      action: '',
      location: '',
      camera: 'medium shot',
      mood: 'cinematic',
      characterRefs: [],
      overrides: '',
      promptBase: '',
      promptFinal: ''
    }));
    setSceneRows(rows);
    setStep(3);
    showToast(`${rows.length}개 신으로 분할 완료`, 'success');
  };

  const updateCharacter = (id: string, patch: Partial<CharacterLock>) => {
    setCharacters((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const detectCharacterRefs = (text: string, items: CharacterLock[]): string[] => {
    const lower = text.toLowerCase();
    const refs: string[] = [];

    items.forEach((item) => {
      const aliases = item.aliases
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const keywords = [item.name, ...aliases].map((value) => value.toLowerCase());
      if (keywords.some((word) => word && lower.includes(word))) {
        refs.push(item.id);
      }
    });

    if (refs.length === 0 && items.length > 0) {
      refs.push(items[0].id);
    }
    return Array.from(new Set(refs));
  };

  const buildPromptByRow = (row: ScenePromptRow): ScenePromptRow => {
    const refs = row.characterRefs.length > 0 ? row.characterRefs : detectCharacterRefs(row.sourceText, characters);

    const identityTokens = refs
      .map((id) => characters.find((character) => character.id === id))
      .filter((character): character is CharacterLock => Boolean(character))
      .map((character) => `${character.name}: ${character.tokenString}; traits: ${character.lockedTraits}`)
      .join(' | ');

    const globalBlock = `GlobalStyleBlock: ${buildGlobalStyleBlock}`;
    const identityBlock = `IdentityLockBlock: ${identityTokens || 'NO_CHARACTER_TOKEN'}`;
    const sceneBlock = `SceneAnchorBlock: scene=${row.sceneNo}, text=${row.sourceText}, action=${row.action || 'none'}, location=${row.location || 'unspecified'}`;
    const cineBlock = `CineBlock: camera=${row.camera || 'medium shot'}, mood=${row.mood || 'cinematic'}, ratio=9:16`;
    const overrideBlock = row.overrides.trim() ? `OverrideBlock: ${row.overrides.trim()}` : '';

    const promptBase = [globalBlock, identityBlock, sceneBlock, cineBlock].join('\n');
    const promptFinal = [promptBase, overrideBlock].filter(Boolean).join('\n');

    return {
      ...row,
      characterRefs: refs,
      promptBase,
      promptFinal
    };
  };

  const handleGeneratePrompts = () => {
    const next = sceneRows.map((row) => buildPromptByRow(row));
    setSceneRows(next);
    setStep(6);
    showToast('신별 프롬프트 생성 완료', 'success');
  };

  const checks = useMemo(() => {
    const missingLocks: string[] = [];
    const warnings: string[] = [];

    const styleOkCount = sceneRows.filter((row) => row.promptFinal.includes('GlobalStyleBlock:')).length;
    const identityOkCount = sceneRows.filter((row) => row.promptFinal.includes('IdentityLockBlock:') && !row.promptFinal.includes('NO_CHARACTER_TOKEN')).length;

    sceneRows.forEach((row) => {
      if (!row.promptFinal.includes('GlobalStyleBlock:')) {
        missingLocks.push(`Scene ${row.sceneNo}: GlobalStyleBlock 누락`);
      }
      if (!row.promptFinal.includes('IdentityLockBlock:') || row.promptFinal.includes('NO_CHARACTER_TOKEN')) {
        missingLocks.push(`Scene ${row.sceneNo}: IdentityLockBlock 누락`);
      }
      if (!row.promptFinal.includes('ratio=9:16')) {
        missingLocks.push(`Scene ${row.sceneNo}: 9:16 누락`);
      }
      if (row.promptFinal.length > 3200) {
        warnings.push(`Scene ${row.sceneNo}: 프롬프트 길이 과다`);
      }
    });

    const total = sceneRows.length || 1;
    const score = Math.round(((styleOkCount + identityOkCount) / (total * 2)) * 100);

    return {
      consistencyScore: score,
      missingLocks,
      warnings
    };
  }, [sceneRows]);

  const reportData: ProductionReport = useMemo(() => {
    return {
      project: {
        ratio: '9:16',
        engine,
        styleDNA: buildGlobalStyleBlock,
        splitMode
      },
      characters: characters.map((character) => ({
        id: character.id,
        name: character.name,
        lockedTraits: character.lockedTraits,
        tokenString: character.tokenString,
        aliases: character.aliases
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      })),
      scenes: sceneRows.map((row) => ({
        sceneNo: row.sceneNo,
        sourceText: row.sourceText,
        promptBase: row.promptBase,
        promptFinal: row.promptFinal,
        overrides: row.overrides,
        characterRefs: row.characterRefs
      })),
      checks
    };
  }, [engine, buildGlobalStyleBlock, splitMode, characters, sceneRows, checks]);

  const handleDownloadJsonReport = () => {
    const fileName = `new-chapter-report-${Date.now()}.json`;
    downloadBlob(fileName, JSON.stringify(reportData, null, 2), 'application/json;charset=utf-8');
    showToast('JSON 작업 지침서 다운로드 완료', 'success');
  };

  const handleDownloadHtmlReport = () => {
    const rowsHtml = reportData.scenes
      .map((scene) => {
        return `<tr>
  <td>${scene.sceneNo}</td>
  <td>${escapeHtml(scene.sourceText)}</td>
  <td><pre>${escapeHtml(scene.promptFinal)}</pre></td>
  <td>${escapeHtml(scene.characterRefs.join(', '))}</td>
</tr>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>뉴챕터 작업 지침서</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f7f7fb; color: #111; }
    h1, h2 { margin: 0 0 12px; }
    .card { background: #fff; border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; font-size: 12px; }
    th { background: #f0f0f5; }
    pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
  </style>
</head>
<body>
  <h1>뉴챕터 작업 지침서</h1>
  <div class="card">
    <h2>Project</h2>
    <pre>${escapeHtml(JSON.stringify(reportData.project, null, 2))}</pre>
  </div>
  <div class="card">
    <h2>Checks</h2>
    <pre>${escapeHtml(JSON.stringify(reportData.checks, null, 2))}</pre>
  </div>
  <div class="card">
    <h2>Characters</h2>
    <pre>${escapeHtml(JSON.stringify(reportData.characters, null, 2))}</pre>
  </div>
  <div class="card">
    <h2>Scenes</h2>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>Source</th>
          <th>Prompt Final</th>
          <th>Refs</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    const fileName = `new-chapter-report-${Date.now()}.html`;
    downloadBlob(fileName, html, 'text/html;charset=utf-8');
    showToast('HTML 작업 지침서 다운로드 완료', 'success');
  };

  return (
    <div className="h-full overflow-y-auto p-4 text-slate-100 bg-slate-950">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="text-xl font-bold">뉴챕터 - 쇼츠 대본 to 일관 이미지 프롬프트</h2>
          <p className="text-sm text-slate-400 mt-1">쇼츠랩 초기 AI 대본 생성 로직 재사용 + 엄격 일관성 잠금 + HTML/JSON 지침서 출력</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="text-sm text-slate-400 mb-3">현재 단계: {step} / 6</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => setStep(index)}
                className={`px-2 py-2 rounded border ${step === index ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}`}
              >
                {index}단계
              </button>
            ))}
          </div>
        </div>

        {step === 1 && (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Wand2 className="w-4 h-4" /> 1단계 대본 생성/불러오기</h3>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
              placeholder="주제를 입력하세요"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={genre} onChange={(event) => setGenre(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm" placeholder="장르 ID (예: comedy-humor)" />
              <input value={targetAge} onChange={(event) => setTargetAge(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm" placeholder="타깃 연령 (예: 40대)" />
              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={isGeneratingScript}
                className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3 py-2 text-sm font-semibold"
              >
                {isGeneratingScript ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</span> : 'AI 대본 생성'}
              </button>
            </div>
            <textarea
              value={scriptText}
              onChange={(event) => setScriptText(event.target.value)}
              className="w-full min-h-[180px] rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
              placeholder="생성된 대본 또는 직접 붙여넣기"
            />
          </section>
        )}

        {step === 2 && (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Scissors className="w-4 h-4" /> 2단계 신 분할</h3>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={splitMode === 'context'} onChange={() => setSplitMode('context')} /> 일반 분할(맥락)
              </label>
              <label className="text-sm flex items-center gap-2">
                <input type="radio" checked={splitMode === 'precision'} onChange={() => setSplitMode('precision')} /> 정밀 분할
              </label>
              <input
                type="number"
                min={5}
                max={100}
                value={sceneCount}
                onChange={(event) => setSceneCount(Number(event.target.value))}
                className="w-28 rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
              />
              <button type="button" onClick={handleSplitScenes} className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-semibold">
                분할 적용
              </button>
            </div>
            <div className="text-sm text-slate-400">분할 결과: {sceneRows.length}개 신</div>
          </section>
        )}

        {step === 3 && (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h3 className="font-semibold">3단계 스타일 DNA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select value={stylePreset} onChange={(event) => setStylePreset(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
                {STYLE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
              <input value={styleDna} onChange={(event) => setStyleDna(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm" placeholder="Style DNA" />
              <input value={lighting} onChange={(event) => setLighting(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm" placeholder="조명" />
              <input value={lens} onChange={(event) => setLens(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm" placeholder="렌즈" />
              <input value={texture} onChange={(event) => setTexture(event.target.value)} className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm md:col-span-2" placeholder="질감" />
            </div>
            <div className="text-xs text-emerald-300">GlobalStyleBlock는 모든 신에 강제 삽입됩니다.</div>
          </section>
        )}

        {step === 4 && (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h3 className="font-semibold">4단계 인물 락</h3>
            <div className="space-y-3">
              {characters.map((character) => (
                <div key={character.id} className="rounded border border-slate-700 bg-slate-800 p-3 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={character.name} onChange={(event) => updateCharacter(character.id, { name: event.target.value })} className="rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="인물명" />
                    <input value={character.aliases} onChange={(event) => updateCharacter(character.id, { aliases: event.target.value })} className="rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="별칭(쉼표 구분)" />
                  </div>
                  <input value={character.lockedTraits} onChange={(event) => updateCharacter(character.id, { lockedTraits: event.target.value })} className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="고정 특징" />
                  <textarea value={character.tokenString} onChange={(event) => updateCharacter(character.id, { tokenString: event.target.value })} className="w-full min-h-[72px] rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="강제 토큰" />
                </div>
              ))}
            </div>
            <div className="text-xs text-emerald-300">IdentityLockBlock는 모든 신에 강제 삽입됩니다.</div>
          </section>
        )}

        {step === 5 && (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h3 className="font-semibold">5단계 신별 프롬프트 생성</h3>
            <button type="button" onClick={handleGeneratePrompts} className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-semibold">
              일괄 생성
            </button>
            <div className="space-y-3">
              {sceneRows.map((row) => (
                <div key={row.sceneNo} className="rounded border border-slate-700 bg-slate-800 p-3 space-y-2">
                  <div className="text-sm font-semibold">Scene {row.sceneNo}</div>
                  <textarea value={row.sourceText} onChange={(event) => setSceneRows((prev) => prev.map((item) => (item.sceneNo === row.sceneNo ? { ...item, sourceText: event.target.value } : item)))} className="w-full min-h-[80px] rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" />
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input value={row.action} onChange={(event) => setSceneRows((prev) => prev.map((item) => (item.sceneNo === row.sceneNo ? { ...item, action: event.target.value } : item)))} className="rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="행동" />
                    <input value={row.location} onChange={(event) => setSceneRows((prev) => prev.map((item) => (item.sceneNo === row.sceneNo ? { ...item, location: event.target.value } : item)))} className="rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="장소" />
                    <input value={row.camera} onChange={(event) => setSceneRows((prev) => prev.map((item) => (item.sceneNo === row.sceneNo ? { ...item, camera: event.target.value } : item)))} className="rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="카메라" />
                    <input value={row.mood} onChange={(event) => setSceneRows((prev) => prev.map((item) => (item.sceneNo === row.sceneNo ? { ...item, mood: event.target.value } : item)))} className="rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="무드" />
                  </div>
                  <textarea value={row.overrides} onChange={(event) => setSceneRows((prev) => prev.map((item) => (item.sceneNo === row.sceneNo ? { ...item, overrides: event.target.value } : item)))} className="w-full min-h-[64px] rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" placeholder="OverrideBlock (선택)" />
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 6 && (
          <section className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-4">
            <h3 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> 6단계 리포트 출력</h3>

            <div className="rounded border border-slate-700 bg-slate-800 p-3">
              <div className="text-sm">Consistency Score: <span className="font-bold text-emerald-300">{checks.consistencyScore}</span></div>
              <div className="text-xs text-slate-400 mt-1">Missing Locks: {checks.missingLocks.length} / Warnings: {checks.warnings.length}</div>
              {checks.missingLocks.length > 0 && (
                <ul className="mt-2 text-xs text-rose-300 list-disc pl-5">
                  {checks.missingLocks.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleDownloadHtmlReport} className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-semibold inline-flex items-center gap-2">
                <FileText className="w-4 h-4" /> HTML 다운로드
              </button>
              <button type="button" onClick={handleDownloadJsonReport} className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-semibold inline-flex items-center gap-2">
                <Download className="w-4 h-4" /> JSON 다운로드
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {sceneRows.map((row) => (
                <div key={row.sceneNo} className="rounded border border-slate-700 bg-slate-800 p-3">
                  <div className="text-sm font-semibold mb-1">Scene {row.sceneNo}</div>
                  <pre className="text-xs whitespace-pre-wrap break-words text-slate-300">{row.promptFinal}</pre>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default NewChapterPanel;

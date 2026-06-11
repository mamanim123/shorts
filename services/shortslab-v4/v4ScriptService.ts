import { buildLabScriptOnlyPrompt } from '../labPromptBuilder';
import { parseJsonFromText } from '../jsonParse';
import { callV4GenerateRaw } from './v4ApiClient';
import type { V4FlowInput } from './v4Types';

const normalizeScriptLines = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((line) => String(line || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
};

const extractScriptBody = (rawText: string): string => {
  let jsonClean = rawText.trim();
  jsonClean = jsonClean.replace(/^(JSON|json)\s+/, '').trim();
  if (jsonClean.startsWith('```')) {
    jsonClean = jsonClean.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  }

  const parsed = parseJsonFromText<any>(jsonClean, [
    'script',
    'scriptBody',
    'scriptLines',
    'openingLine',
    'hook',
    'punchline',
    'twist',
    'title'
  ]);

  if (parsed) {
    const scriptData = parsed.scripts?.[0] || parsed;
    const lines = normalizeScriptLines(scriptData.scriptLines || parsed.scriptLines);
    if (lines.length > 0) return lines.join('\n');

    const rawScript = scriptData.scriptBody || scriptData.script || parsed.scriptBody || parsed.script || '';
    if (rawScript) {
      const scriptMatch = String(rawScript).match(/---\s*([\s\S]*?)\s*---/);
      return (scriptMatch ? scriptMatch[1] : rawScript).trim();
    }
  }

  const scriptMatch = rawText.match(/---\s*([\s\S]*?)\s*---/);
  if (scriptMatch) return scriptMatch[1].trim();

  const bodyMatch = rawText.match(/"scriptBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (bodyMatch?.[1]) {
    try {
      return JSON.parse(`"${bodyMatch[1]}"`).trim();
    } catch {
      return bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
    }
  }

  return '';
};

export const generateV4ScriptOnly = async (input: V4FlowInput, storyContext: string): Promise<{
  scriptBody: string;
  rawText: string;
}> => {
  const prompt = buildLabScriptOnlyPrompt({
    topic: input.topic,
    genre: input.genre,
    targetAge: input.targetAge,
    gender: input.gender === 'female' ? '여성' : '남성',
    additionalContext: storyContext,
    characterSlotMode: 'slot+name'
  } as any);

  const rawText = await callV4GenerateRaw({
    service: input.service,
    prompt,
    maxTokens: 2400,
    temperature: 0.85,
    skipFolderCreation: true
  });

  const scriptBody = extractScriptBody(rawText);
  if (!scriptBody) {
    throw new Error('V4 대본 추출 실패: scriptBody가 비어 있습니다.');
  }

  return { scriptBody, rawText };
};

import { SYSTEM_PROMPT_V3_COSTAR, SYSTEM_PROMPT_V3 } from "../constants";
import { UserInput } from "../types";
import { buildApiUrl } from '../../../lib/api';

type EngineKey = UserInput['engineVersion'];

export type EngineOption = {
  id: EngineKey;
  title: string;
  desc: string;
  iconType?: 'crown' | 'sparkles' | 'power' | 'custom';
  badge?: string;
};

const API_ENDPOINT = buildApiUrl('/api/engine-config');

const defaultPrompts: Record<EngineKey, string> = {
  V3: SYSTEM_PROMPT_V3,
  V3_COSTAR: SYSTEM_PROMPT_V3_COSTAR,
  NONE: '',
};

const defaultEngineOptions: EngineOption[] = [
  { id: 'V3', title: '럭셔리 엔진 V3', desc: '고급스러운 표현과 디테일 강화', iconType: 'crown', badge: 'Premium' },
  { id: 'V3_COSTAR', title: 'CO-STAR 최적화', desc: 'CO-STAR 구조/규칙 적용', iconType: 'sparkles', badge: 'Structured' },
  { id: 'NONE', title: '비활성화', desc: '템플릿 기반 모드', iconType: 'power', badge: 'Off' },
];

const defaultOptionIds = new Set(defaultEngineOptions.map((opt) => opt.id));

let promptsCache: Record<EngineKey, string> = { ...defaultPrompts };
let optionsCache: EngineOption[] = [...defaultEngineOptions];

const mergeEngineOptions = (customOptions: EngineOption[] = []) => {
  const merged = [...defaultEngineOptions];
  customOptions.forEach((opt) => {
    if (!merged.find((item) => item.id === opt.id)) {
      merged.push(opt);
    }
  });
  return merged;
};

const fetchEngineConfig = async () => {
  try {
    const res = await fetch(`${API_ENDPOINT}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) throw new Error('Failed to fetch engine config');
    const data = await res.json();
    promptsCache = { ...defaultPrompts, ...(data.prompts || {}) };
    optionsCache = mergeEngineOptions(Array.isArray(data.options) ? data.options : []);
  } catch (error) {
    console.error('[enginePromptStore] Failed to load engine config:', error);
    promptsCache = { ...defaultPrompts };
    optionsCache = [...defaultEngineOptions];
  }
  return { prompts: promptsCache, options: optionsCache };
};

export const ensureEngineConfigLoaded = async () => fetchEngineConfig();

export const loadEnginePrompts = (): Record<EngineKey, string> => promptsCache;

export const getEnginePrompt = (engine: EngineKey): string => promptsCache[engine] ?? '';

export const resolveEnginePrompt = (engine: EngineKey): string => {
  if (engine === 'NONE') return '';
  const prompt = getEnginePrompt(engine);
  if (!prompt || !prompt.trim()) {
    console.warn(`[enginePromptStore] Missing prompt for engine "${engine}". Falling back to V3.`);
    return promptsCache['V3'] || SYSTEM_PROMPT_V3 || '';
  }
  return prompt;
};

export const saveEnginePrompt = async (engine: EngineKey, prompt: string) => {
  promptsCache = { ...promptsCache, [engine]: prompt };
  try {
    await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: { [engine]: prompt } }),
    });
  } catch (error) {
    console.error('[enginePromptStore] Failed to save engine prompt:', error);
  }
};

export const resetEnginePrompt = (engine: EngineKey) => {
  const defaultPrompt = defaultPrompts[engine];
  promptsCache = { ...promptsCache, [engine]: defaultPrompt };
  void saveEnginePrompt(engine, defaultPrompt);
};

export const getDefaultEnginePrompt = (engine: EngineKey): string => defaultPrompts[engine];

export const loadEngineOptions = (): EngineOption[] => optionsCache;

export const saveEngineOptions = async (options: EngineOption[]) => {
  optionsCache = options;
  const customOptions = options.filter((opt) => !defaultOptionIds.has(opt.id));
  try {
    await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ options: customOptions }),
    });
  } catch (error) {
    console.error('[enginePromptStore] Failed to save engine options:', error);
  }
};

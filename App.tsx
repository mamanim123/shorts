
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './hooks/usePerformance';
import { ConfigPanel } from './components/ConfigPanel';
import { OutputDisplay } from './components/OutputDisplay';
import { HistoryPanel } from './components/HistoryPanel';
import { Button } from './components/Button';
import { LongformPanel } from './components/LongformPanel';
import { TemplatePanel } from './components/TemplatePanel';
import { TemplateResultDisplay } from './components/TemplateResultDisplay';
import { UserInput, StoryResponse, OutfitStyle, ScenarioMode, Dialect, ChapterSummary, StyleTemplate, Scene, TargetService } from './types';
import { generateStory } from './services/geminiService';
import { requestLongformSummary, requestLongformChapterContent, saveLongformSession, listLongformSessions, loadLongformSession } from './services/longformService';
import { analyzeScriptTemplate, fetchTemplates, deleteTemplate, saveTemplate, parseFromText } from './services/templateService';
import { Wand2, LayoutList, Settings2, AlertCircle, Sparkles, Star, Trash2, Sun, Moon, Zap } from 'lucide-react';
import { jsonrepair } from 'jsonrepair';
import MasterStudioContainer from './components/master-studio/MasterStudioContainer';
import ShortsScriptGenerator from './youtube-shorts-script-generator';
import AiStudioHost from './components/AiStudioHost';
import { CineboardPanel } from './components/CineboardPanel';
import { ShortsLabPanel } from './components/ShortsLabPanel';
import { YoutubeSearchPanel } from './components/YoutubeSearchPanel';
import { ToastContainer } from './components/Toast';

// 새로운 유틸리티 import
import Logger from './utils/logger';
import { JsonParser } from './utils/jsonParser';
import { apiClient, API_ENDPOINTS } from './utils/apiClient';
import { ErrorHandler } from './utils/errorHandler';

const LOCAL_STORAGE_KEY = 'shorts-story-engine-history';

const FEMALE_ENHANCEMENTS = [
  "Slender Silhouette",
  "Skinny Fit",
  "Small Waist",
  "Full natural bust",
  "Shapely hips strongly emphasized",
  "Healthy beauty",
  "Elegant refined posture"
];

const PROMPT_INSERTION_MARKERS = [
  "Dynamic Motion:",
  "Camera Angle:",
  "Expression:",
  "Lighting:",
  "Background:",
  "photorealistic"
];

const FEMALE_PROMPT_REGEX = /Korean woman|woman in her|female character/i;

// [REFACTORED] Simplified enhanceScenePrompt to avoid duplication.
// Most logic is now handled in geminiService.ts to ensure quality tags are added at source.
const enhanceScenePrompt = (prompt?: string | null): string => {
  if (!prompt) return '';
  return prompt;
};

type PromptEnhancementSettings = {
  autoEnhanceOnGeneration?: boolean;
  slots?: any[];
  useQualityTags?: boolean;
  qualityTags?: string;
};

type ShortsGenerationTrigger = {
  topic: string;
  generationMode: 'none' | 'script-only' | 'script-image';
  genre: string;
  targetAge?: string;
};

const enhanceScenesForImport = (scenes: Scene[]): Scene[] => {
  return scenes;
};

const fetchPromptEnhancementSettings = async (): Promise<PromptEnhancementSettings | null> => {
  try {
    const res = await fetch('http://localhost:3002/api/prompt-enhancement-settings');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    Logger.error('[Import] Failed to load prompt enhancement settings:', e);
    return null;
  }
};

const enhancePromptViaApi = async (prompt?: string, characterIds?: string[]): Promise<string> => {
  if (!prompt || !prompt.trim()) return prompt || '';
  try {
    const res = await fetch('http://localhost:3002/api/enhance-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, characterIds })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.enhancedPrompt || prompt;
  } catch (e) {
    Logger.error('[Import] Prompt enhancement failed:', e);
    return prompt;
  }
};

const enhanceScenesWithServerRules = async (scenes: Scene[], settings: PromptEnhancementSettings | null): Promise<Scene[]> => {
  if (!settings?.autoEnhanceOnGeneration) return scenes;
  const normalized = scenes.map(scene => {
    if (!scene) return scene;
    const characterIds = Array.isArray(scene.characterIds) ? scene.characterIds.map(id => String(id)) : undefined;
    return { ...scene, characterIds };
  });

  return Promise.all(
    normalized.map(async (scene) => {
      if (!scene) return scene;
      const characterIds = Array.isArray(scene.characterIds) ? scene.characterIds : undefined;
      const [shortPrompt, longPrompt, soraPrompt] = await Promise.all([
        enhancePromptViaApi(scene.shortPrompt, characterIds),
        enhancePromptViaApi(scene.longPrompt, characterIds),
        enhancePromptViaApi(scene.soraPrompt, characterIds)
      ]);
      return {
        ...scene,
        shortPrompt,
        longPrompt,
        soraPrompt
      };
    })
  );
};


const App: React.FC = () => {
  // --- State Management ---

  // 1. Config Input State
  const [input, setInput] = useState<UserInput>({
    engineVersion: 'CUSTOM_1766894774435', // Default to Sherbet 설렘 엔진
    category: OutfitStyle.NONE,
    scenarioMode: ScenarioMode.DOUBLE_ENTENDRE,
    dialect: Dialect.STANDARD,
    customContext: '',
    targetAge: '40대',
    useRegenerationGuidance: false,
    targetService: 'GEMINI',
    shortsGenerationMode: 'script-image', // Default to script+image
    shortsGenre: 'none', // Default genre: 선택 안 함
  });

  // 2. Stories History State (Loaded from LocalStorage)
  const [stories, setStories] = useState<StoryResponse[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load history", e);
      return [];
    }
  });

  // 3. UI State
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'config' | 'history' | 'hybrid' | 'shorts-generator'>('config');
  // Add 'test-scripts' to historySubTab
  const [historySubTab, setHistorySubTab] = useState<'stories' | 'templates' | 'video' | 'test'>('stories');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const storageErrorRef = useRef(false); // Avoid repeated quota errors
  const [longformMode, setLongformMode] = useState(false);
  const [longformTopic, setLongformTopic] = useState('');
  const [longformChapters, setLongformChapters] = useState<ChapterSummary[] | null>(null);
  const [longformLoading, setLongformLoading] = useState(false);
  const [longformSessionId, setLongformSessionId] = useState<string | null>(null);
  const [longformError, setLongformError] = useState<string | null>(null);
  const [longformSessions, setLongformSessions] = useState<Array<{ sessionId: string; topic: string; updatedAt: number }>>([]);
  const [templates, setTemplates] = useState<StyleTemplate[]>([]);
  const [templateScript, setTemplateScript] = useState('');
  const [templateType, setTemplateType] = useState<'shortform' | 'longform'>('shortform');
  const [templateAnalyzing, setTemplateAnalyzing] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [lastTemplateResult, setLastTemplateResult] = useState<StyleTemplate | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<StyleTemplate | null>(null);
  const [templateToShow, setTemplateToShow] = useState<StyleTemplate | null>(null);
  const [showTemplateResult, setShowTemplateResult] = useState(false);

  // Right panel tab state
  const [rightTab, setRightTab] = useState<'analysis' | 'shortform' | 'longform' | 'youtube-search' | 'shorts-generator' | 'ai-studio' | 'cineboard' | 'shorts-lab'>('shorts-generator');
  const analysisTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Duplicate historySubTab removed
  const [templateSearch, setTemplateSearch] = useState('');
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [shortsAutoTrigger, setShortsAutoTrigger] = useState<ShortsGenerationTrigger | null>(null);


  // --- Effects ---

  // [PERFORMANCE] Debounced history save - 500ms delay to prevent excessive saves
  const debouncedSaveToLocalStorage = useDebounce((storiesToSave: StoryResponse[]) => {
    if (storageErrorRef.current) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(storiesToSave));
      console.log('[Performance] Saved', storiesToSave.length, 'stories to localStorage');
    } catch (e) {
      storageErrorRef.current = true;
      console.error("Failed to persist history to localStorage:", e);
      setError("히스토리 저장 공간이 부족합니다. 보관함을 정리한 뒤 다시 시도해주세요.");
    }
  }, 500);

  const debouncedSaveToServer = useDebounce(async (storiesToSave: StoryResponse[]) => {
    try {
      await fetch('http://localhost:3002/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storiesToSave),
      });
      console.log('[Performance] Saved', storiesToSave.length, 'stories to server');
    } catch (error) {
      console.error('Failed to save history to server:', error);
    }
  }, 1000);

  // Trigger debounced saves when stories change
  useEffect(() => {
    debouncedSaveToLocalStorage(stories);
    debouncedSaveToServer(stories);
  }, [stories]);

  // [DEPRECATED] Direct saveHistory removed - using debounced save in useEffect above
  // Keep function for backward compatibility but make it a no-op
  const saveHistory = useCallback(async (newStories: StoryResponse[]) => {
    // No-op: saving is handled by debounced useEffect
    console.log('[Performance] saveHistory called - debounced save will handle this');
  }, []);

  // [PERFORMANCE] Load history once on mount - localStorage first, server sync in background
  useEffect(() => {
    let isMounted = true;

    const syncHistory = async () => {
      try {
        const res = await fetch('http://localhost:3002/api/history');
        if (res.ok && isMounted) {
          const serverHistory: StoryResponse[] = await res.json();
          console.log('[Performance] Server sync:', serverHistory.length, 'items');

          // Only update if server has more recent data (compare timestamps)
          const localTimestamp = stories.length > 0 ? Math.max(...stories.map(s => s.createdAt)) : 0;
          const serverTimestamp = serverHistory.length > 0 ? Math.max(...serverHistory.map(s => s.createdAt)) : 0;

          if (serverTimestamp > localTimestamp) {
            console.log('[Performance] Server has newer data, updating...');
            setStories(serverHistory);
          } else {
            console.log('[Performance] Local data is up-to-date');
          }
        }
      } catch (e) {
        console.error('[Performance] Server sync failed (using local data):', e);
      }
    };

    // Auto-select most recent story
    if (stories.length > 0 && !selectedStoryId) {
      const mostRecent = stories.reduce((prev, current) => (prev.createdAt > current.createdAt) ? prev : current);
      setSelectedStoryId(mostRecent.id);
    }

    // Sync with server in background (non-blocking)
    syncHistory();

    return () => { isMounted = false; };
  }, []); // Only run once on mount

  // --- Handlers ---

  // [FIX] Ctrl+C 종료 버그 방지 - 복사 단축키가 터미널로 유출되는 것을 차단
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C 또는 Meta+C (Mac) 감지
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        // 현재 선택된 텍스트가 있는지 확인
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) {
          // 이벤트가 브라우저 밖(터미널)으로 나가지 않도록 전파 중단
          // preventDefault는 호출하지 않아야 브라우저 기본 복사 기능이 작동함
          e.stopPropagation();
          console.log('[Fix] Ctrl+C detected with selection, stopping propagation to prevent terminal exit.');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // 캡처링 단계에서 우선 가로챔
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Auto-shutdown when tab is closed
  useEffect(() => {
    const handleUnload = () => {
      const data = JSON.stringify({ action: 'shutdown' });
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon('http://localhost:3002/api/shutdown', blob);
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  const refreshSessionList = async () => {
    try {
      const list = await listLongformSessions();
      setLongformSessions(list);
    } catch (err) {
      console.error('Failed to list sessions', err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchTemplates();
        setTemplates(list);
      } catch (err) {
        console.error('Failed to load templates', err);
      }
    })();
    refreshSessionList();
  }, []);

  const handleCancelGeneration = () => {
    if (!loading) return;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLoading(false);
    setError("생성을 중지했습니다. 다시 시작하려면 '스토리 생성하기'를 눌러주세요.");
  };

  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const escapeInlineQuotesForKeys = (text: string, keys: string[]) => {
    if (!text || keys.length === 0) return text;

    const keyPattern = keys.map(escapeRegex).join('|');
    const regex = new RegExp(`"(${keyPattern})"\\s*:\\s*"`, 'g');
    let result = '';
    let lastIndex = 0;

    while (true) {
      const match = regex.exec(text);
      if (!match) break;

      const valueStart = regex.lastIndex;
      result += text.slice(lastIndex, valueStart);

      let j = valueStart;
      let escaped = false;
      let chunk = '';

      while (j < text.length) {
        const ch = text[j];

        if (ch === '\\' && !escaped) {
          escaped = true;
          chunk += ch;
          j += 1;
          continue;
        }

        if (ch === '"' && !escaped) {
          let k = j + 1;
          while (k < text.length && /\s/.test(text[k])) k += 1;
          if (k >= text.length || /[,\]}]/.test(text[k])) {
            break;
          }
          chunk += '\\"';
          j += 1;
          continue;
        }

        escaped = false;
        chunk += ch;
        j += 1;
      }

      result += chunk;
      if (j < text.length && text[j] === '"') {
        result += '"';
        j += 1;
      }

      lastIndex = j;
      regex.lastIndex = j;
    }

    result += text.slice(lastIndex);
    return result;
  };

  const extractValidJson = (text: string) => {
    if (!text) return null;
    let startIndex = -1;
    let endIndex = -1;
    let startChar = '';
    let endChar = '';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];

      if (ch === '\\' && !escaped) {
        escaped = true;
        continue;
      }

      if (ch === '"' && !escaped) {
        inString = !inString;
      }
      escaped = false;

      if (inString) continue;

      if (startIndex === -1 && (ch === '{' || ch === '[')) {
        startIndex = i;
        startChar = ch;
        endChar = ch === '{' ? '}' : ']';
        depth = 1;
        continue;
      }

      if (startIndex !== -1) {
        if (ch === startChar) depth += 1;
        if (ch === endChar) depth -= 1;
        if (depth === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    if (startIndex !== -1 && endIndex !== -1) {
      return text.substring(startIndex, endIndex);
    }
    return null;
  };

  const preprocessJson = (str: string): string => {
    // Helper to fix common JSON issues in Korean context
    return str
      // Fix 1: Unescaped double quotes inside Korean text
      // e.g. "말했어. "눈 온다고..." -> "말했어. \"눈 온다고..."
      .replace(/([가-힣]\s*)"([가-힣])/g, '$1\\"$2')
      // Fix 2: Unescaped closing double quote before the actual closing quote
      // e.g. "...멈추나."", -> "...멈추나.\"",
      .replace(/([가-힣])"(\s*")/g, '$1\\"$2')
      // Fix 3: Unescaped quotes around Korean words inside a string
      // e.g. "key": "some "word" here"
      .replace(/([가-힣])"([가-힣])/g, '$1\\"$2');
  };

  const importStoryFromJson = async (rawJson: string) => {
    try {
      // Normalize input (코드블록/여분 텍스트 제거)
      let jsonText = rawJson.replace(/```json/g, '').replace(/```/g, '');
      const extracted = extractValidJson(jsonText);
      if (extracted) {
        jsonText = extracted;
      }
      jsonText = escapeInlineQuotesForKeys(jsonText, [
        'script',
        'scriptBody',
        'scriptLine',
        'shortPrompt',
        'shortPromptKo',
        'longPrompt',
        'longPromptKo',
        'hook',
        'punchline',
        'context',
        'twist',
        'title'
      ]);

      let parsedStory: StoryResponse;
      try {
        // Attempt 1: Standard Parse
        parsedStory = JSON.parse(jsonText);
      } catch (e) {
        try {
          // Attempt 2: Preprocess (fix quotes) then Parse
          const preprocessed = preprocessJson(jsonText);
          parsedStory = JSON.parse(preprocessed);
        } catch (e2) {
          try {
            // Attempt 3: jsonrepair
            console.log("Standard parse failed, trying jsonrepair...");
            const repaired = jsonrepair(jsonText);
            parsedStory = JSON.parse(repaired);
          } catch (e3) {
            // Attempt 4: Preprocess then jsonrepair
            const preprocessed = preprocessJson(jsonText);
            const repaired = jsonrepair(preprocessed);
            parsedStory = JSON.parse(repaired);
          }
        }
      }

      // [NEW] Support shorts-generator style payload { scripts: [...] }
      if ((parsedStory as any).scripts && Array.isArray((parsedStory as any).scripts)) {
        const scriptsArr = (parsedStory as any).scripts;
        const enhancementSettings = await fetchPromptEnhancementSettings();
        const importedStories: StoryResponse[] = await Promise.all(scriptsArr.map(async (s: any, idx: number) => {
          const scenes = Array.isArray(s.scenes) ? s.scenes.map((scene: any, sceneIdx: number) => ({
            sceneNumber: scene.sceneNumber || sceneIdx + 1,
            shortPrompt: scene.shortPrompt || '',
            shortPromptKo: scene.shortPromptKo || scene.scriptLineAnchor || '',
            longPrompt: scene.longPrompt || '',
            longPromptKo: scene.longPromptKo || '',
            soraPrompt: scene.soraPrompt || '',
            soraPromptKo: scene.soraPromptKo || '',
            narration: typeof scene.narration === 'string' ? scene.narration : scene.narration?.text || '',
            dialogue: scene.dialogue || scene.lipSync?.line || '',
            voiceType: scene.voiceType,
            narrationMeta: scene.narration && typeof scene.narration === 'object'
              ? {
                text: scene.narration.text || '',
                emotion: scene.narration.emotion || '',
                speed: scene.narration.speed || 'normal'
              }
              : undefined,
            lipSync: scene.lipSync
              ? {
                speaker: scene.lipSync.speaker || '',
                speakerName: scene.lipSync.speakerName || '',
                line: scene.lipSync.line || '',
                emotion: scene.lipSync.emotion || '',
                timing: scene.lipSync.timing || undefined
              }
              : undefined,
            characterIds: Array.isArray(scene.characterIds) ? scene.characterIds.map((id: any) => String(id)) : scene.characterIds,
            characterNames: scene.characterNames
          })) : [];

          const normalizedScenes = scenes.map((scene: any) => {
            const voiceType = scene.voiceType || (scene.lipSync?.line ? 'both' : 'narration');
            return {
              ...scene,
              voiceType,
              narrationMeta: scene.narrationMeta || (scene.narration ? { text: scene.narration, speed: 'normal' } : undefined)
            };
          });

          const enhancedScenes = await enhanceScenesWithServerRules(enhanceScenesForImport(normalizedScenes), enhancementSettings);

          const scriptBody = (s.script || s.scriptBody)
            ? String(s.script || s.scriptBody)
            : enhancedScenes.map((sc: any) => sc.shortPromptKo || sc.shortPrompt || sc.longPromptKo || sc.longPrompt || '').filter(Boolean).join('\n');

          // Create story folder with fallback
          const title = s.title || `Imported Script ${idx + 1}`;
          let folderName = '';
          try {
            const folderResponse = await fetch('http://localhost:3002/api/create-story-folder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title })
            });
            const folderResult = await folderResponse.json();
            if (folderResult.success) {
              folderName = folderResult.folderName;
              console.log(`✅ Folder created for imported story: ${folderName}`);
            } else {
              // Fallback: create timestamp-based folder name
              folderName = `Story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              console.warn(`⚠️ Using fallback folder name: ${folderName}`);
            }
          } catch (error) {
            console.error('Failed to create folder for imported story:', error);
            // Fallback: create timestamp-based folder name
            folderName = `Story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.warn(`⚠️ Using fallback folder name after error: ${folderName}`);
          }

          return {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            title,
            titleOptions: s.titleOptions,
            scriptBody,
            punchline: s.punchline || s.twist || s.hook || '',
            scenes: enhancedScenes,
            service: 'IMPORTED_JSON',
            _folderName: folderName
          };
        }));

        const newStories = [...importedStories, ...stories];
        setStories(newStories);
        if (importedStories[0]) setSelectedStoryId(importedStories[0].id);
        saveHistory(newStories);
        setLoading(false);
        alert(`JSON 대본 ${importedStories.length}개를 불러왔습니다.`);
        return;
      }

      if (!parsedStory.id) parsedStory.id = crypto.randomUUID();
      if (!parsedStory.createdAt) parsedStory.createdAt = Date.now();
      if (!parsedStory.service) parsedStory.service = "IMPORTED";

      if (parsedStory.scenes && Array.isArray(parsedStory.scenes)) {
        parsedStory.scenes = parsedStory.scenes.map((s: any) => {
          const narrationText = typeof s.narration === 'string' ? s.narration : s.narration?.text || '';
          const lipSyncLine = s.dialogue || s.lipSync?.line || '';
          const voiceType = s.voiceType || (lipSyncLine ? 'both' : 'narration');

          return {
            sceneNumber: s.sceneNumber || s.scene_number,
            shortPrompt: s.shortPrompt || s.scene_visual_short_prompt || '',
            shortPromptKo: s.shortPromptKo || s.scene_visual_short_prompt_ko || '',
            longPrompt: s.longPrompt || s.scene_visual_long_prompt || '',
            longPromptKo: s.longPromptKo || '',
            soraPrompt: s.soraPrompt || s.sora_prompt || '',
            soraPromptKo: s.soraPromptKo || '',
            narration: narrationText,
            dialogue: lipSyncLine,
            voiceType,
            narrationMeta: s.narration && typeof s.narration === 'object'
              ? {
                text: s.narration.text || '',
                emotion: s.narration.emotion || '',
                speed: s.narration.speed || 'normal'
              }
              : narrationText
                ? { text: narrationText, speed: 'normal' }
                : undefined,
            lipSync: s.lipSync
              ? {
                speaker: s.lipSync.speaker || '',
                speakerName: s.lipSync.speakerName || '',
                line: s.lipSync.line || '',
                emotion: s.lipSync.emotion || '',
                timing: s.lipSync.timing || undefined
              }
              : lipSyncLine
                ? { line: lipSyncLine }
                : undefined,
            characterIds: Array.isArray(s.characterIds) ? s.characterIds.map((id: any) => String(id)) : s.characterIds
          };
        });

        parsedStory.scenes = enhanceScenesForImport(parsedStory.scenes);

        const enhancementSettings = await fetchPromptEnhancementSettings();
        parsedStory.scenes = await enhanceScenesWithServerRules(parsedStory.scenes, enhancementSettings);
      }

      const rawScriptBody = parsedStory.scriptBody || (parsedStory as any).script;
      if (rawScriptBody && Array.isArray(rawScriptBody)) {
        parsedStory.scriptBody = rawScriptBody.filter(Boolean).join('\n\n');
      } else if (rawScriptBody) {
        parsedStory.scriptBody = String(rawScriptBody);
      }

      if (!parsedStory.scriptBody && parsedStory.scenes) {
        console.log("Auto-generating scriptBody from scenes...");
        parsedStory.scriptBody = parsedStory.scenes.map(s => {
          const narration = (s as any).narration ? `(나레이션) ${(s as any).narration}` : '';
          const dialogue = (s as any).dialogue ? `(대사) ${(s as any).dialogue}` : '';
          return `[Scene ${s.sceneNumber}]\n${narration}\n${dialogue}`;
        }).join('\n\n');
      }

      if (!parsedStory.punchline) {
        parsedStory.punchline = (parsedStory as any).twist || "자동 생성된 펀치라인 (데이터 없음)";
      }

      // Create story folder with fallback
      if (parsedStory.title) {
        try {
          const folderResponse = await fetch('http://localhost:3002/api/create-story-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: parsedStory.title })
          });
          const folderResult = await folderResponse.json();
          if (folderResult.success) {
            (parsedStory as any)._folderName = folderResult.folderName;
            console.log(`✅ Folder created for imported story: ${folderResult.folderName}`);
          } else {
            // Fallback: create timestamp-based folder name
            (parsedStory as any)._folderName = `Story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.warn(`⚠️ Using fallback folder name: ${(parsedStory as any)._folderName}`);
          }
        } catch (error) {
          console.error('Failed to create folder for imported story:', error);
          // Fallback: create timestamp-based folder name
          (parsedStory as any)._folderName = `Story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.warn(`⚠️ Using fallback folder name after error: ${(parsedStory as any)._folderName}`);
        }
      }

      const newStories = [parsedStory, ...stories];
      setStories(newStories);
      setSelectedStoryId(parsedStory.id);
      saveHistory(newStories); // [FIX] Sync to server
      setLoading(false);
      setLoading(false);
      alert("JSON 데이터가 성공적으로 불러와졌습니다.");
    } catch (e) {
      console.error("JSON Import Error:", e);

      // Build user-friendly error message
      const errorMsg = e instanceof Error ? e.message : String(e);
      let userFriendlyMsg = "❌ 유효하지 않은 JSON 형식입니다.";

      // Check for common issues and provide hints
      if (rawJson.includes("'")) {
        userFriendlyMsg += "\n\n💡 힌트: 작은따옴표(')가 발견되었습니다.\n올바른 JSON은 큰따옴표(\")를 사용해야 합니다.";
        userFriendlyMsg += "\n\n예시:\n❌ {'title': '제목'}\n✅ {\"title\": \"제목\"}";
      } else if (!rawJson.trim().startsWith('{') && !rawJson.trim().startsWith('[')) {
        userFriendlyMsg += "\n\n💡 힌트: JSON은 { 또는 [로 시작해야 합니다.";
      }

      userFriendlyMsg += "\n\n🔍 오류 내용: " + errorMsg;
      userFriendlyMsg += "\n\n📝 따옴표나 괄호를 확인해주세요.";

      alert(userFriendlyMsg);
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setRightTab('shortform');
    setError(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = null;
    try {
      // [NEW] JSON Import Mode
      // Assuming 'input.customJson' is the field for JSON import,
      // or 'input.customContext' is being used for this purpose.
      // For strict adherence to the instruction, I'll use 'input.customJson'
      // and assume it's either a new field or 'customContext' is meant.
      // If 'customJson' is not part of UserInput, this will cause a type error.
      // Given the context, it's likely 'input.customContext' is intended to hold the JSON.
      // However, the instruction explicitly uses `userInput.customJson`.
      // I will use `input.customJson` as `input` is the state variable for `UserInput`.
      // If `customJson` is not a property of `UserInput`, this will be a type error.
      // To make it syntactically correct and runnable, I'll cast `input` to `any` for this specific check.
      // [FIX] Use customContext for JSON import as well
      // Check if customContext looks like a JSON object (starts with { and ends with })
      if (input.customJson !== undefined) {
        const rawJson = input.customJson.trim();
        if (rawJson.length === 0) {
          alert("JSON 입력 모드입니다. JSON 내용을 붙여넣어주세요.");
          setLoading(false);
          return;
        }
        await importStoryFromJson(rawJson);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const newStory = await generateStory(input, controller.signal, activeTemplate || undefined);

      setStories(prev => {
        const updated = [...prev, newStory];
        saveHistory(updated); // [FIX] Sync to server
        return updated;
      });
      setSelectedStoryId(newStory.id);

      // [NEW] Script-to-Image Mode (V3 Only)e ---
      const formattedContent = `TITLE: ${newStory.title}
DATE: ${new Date(newStory.createdAt).toLocaleString()}

=== SCRIPT ===
${newStory.scriptBody}

=== PUNCHLINE ===
${newStory.punchline}

=== SCENES (IMAGE PROMPTS) ===
${(newStory.scenes || []).map(s => `
[Scene ${s.sceneNumber}]
KR: ${s.shortPromptKo}
EN: ${s.shortPrompt}
Long: ${s.longPrompt}
`).join('\n')}
`;

      fetch('http://localhost:3002/api/save-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newStory.title,
          content: formattedContent,
          folderName: newStory._folderName, // ✅ [수정] 생성된 폴더명을 전달하여 중복 생성 방지
          service: input.targetService || 'GEMINI' // [NEW] Send service name for filename prefix
        })
      }).then(res => res.json())
        .then(data => {
          console.log("Saved to file:", data.filename);
          // ✅ [수정] 서버에서 생성된 폴더명을 상태에 반영하여 AI 이미지 생성 시 활용
          if (data.folderName) {
            setStories(prev => prev.map(s => s.id === newStory.id ? { ...s, _folderName: data.folderName } : s));
          }
        })
        .catch(err => console.error("Auto-save failed:", err));

      // Optional: Automatically switch to history or keep config?
      // We'll keep config open but show result on right.

    } catch (err) {
      console.error("Generation Error:", err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError("생성이 취소되었습니다.");
      } else if (err instanceof Error) {
        // [FIX] Show detailed error message for JSON parsing failures
        setError(`오류 발생: ${err.message}`);
      } else {
        setError("예기치 않은 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleShortsDirectGenerate = () => {
    const topic = input.customContext?.trim();
    if (!topic) {
      alert("추가 요청사항에 주제를 입력해주세요.");
      return;
    }

    // 생성모드 확인
    if (!input.shortsGenerationMode || input.shortsGenerationMode === 'none') {
      alert("⚠️ 생성 옵션을 먼저 선택해주세요!\n\n'대본만' 또는 '대본+이미지' 중 하나를 선택하세요.");
      return;
    }

    const trigger: ShortsGenerationTrigger = {
      topic,
      generationMode: input.shortsGenerationMode,
      genre: input.shortsGenre || 'none',
      targetAge: input.targetAge
    };
    setShortsAutoTrigger(trigger);
    setRightTab('shorts-generator');
  };

  const handleTestGenerate = () => {
    // 장르 확인 (필수)
    if (!input.shortsGenre || input.shortsGenre === 'none') {
      alert("⚠️ 장르를 먼저 선택해주세요!\n\n테스트 버튼은 선택한 장르의 지침으로만 대본을 생성합니다.");
      return;
    }

    const topic = input.customContext?.trim() || "테스트 생성";

    // 테스트 버튼은 항상 'none' 모드 (장르 지침만 사용)
    const trigger: ShortsGenerationTrigger = {
      topic,
      generationMode: 'none',  // 강제로 'none' 설정!
      genre: input.shortsGenre,
      targetAge: input.targetAge
    };

    setShortsAutoTrigger(trigger);
    setRightTab('shorts-generator');
  };

  const handleDeleteStory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering selection
    if (window.confirm("정말로 이 대본을 삭제하시겠습니까?")) {
      const newStories = stories.filter(s => s.id !== id);
      setStories(newStories);
      saveHistory(newStories); // [FIX] Sync to server
      // If the deleted story was selected, clear selection
      if (selectedStoryId === id) {
        setSelectedStoryId(null);
      }
    } // Added missing closing brace for the if block
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStories = stories.map(story =>
      story.id === id ? { ...story, isFavorite: !story.isFavorite } : story
    );
    setStories(newStories);
    saveHistory(newStories); // [FIX] Sync to server
  };

  const handleToggleTemplateFavorite = async (template: StyleTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...template, isFavorite: !template.isFavorite };
    try {
      await saveTemplate(updated);
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (e) {
      alert('즐겨찾기 상태 변경 실패');
    }
  };

  const handleSelectStory = (story: StoryResponse) => {
    setSelectedStoryId(story.id);
    if (story.service === 'TEST') {
      setRightTab('shorts-generator');
    } else {
      setRightTab('shortform');
    }


  };

  const handleUpdateStory = (updatedStory: StoryResponse) => {
    setStories(prev => {
      const updated = prev.map(s => s.id === updatedStory.id ? updatedStory : s);
      saveHistory(updated); // Sync to server
      return updated;
    });
  };

  const activeStory = stories.find(s => s.id === selectedStoryId) || null;

  const buildTemplateGuidance = (template: StyleTemplate) => `
[STYLE TEMPLATE GUIDANCE]
Template Name: ${template.name}
Structure: ${template.structure.join(' -> ')}
Tone: ${template.tone}
Hook Strategy: ${template.hookStrategy}
Twist Style: ${template.twistStyle}
${template.characterNotes ? `Character Notes: ${template.characterNotes}` : ''}
${template.imageNotes ? `Image Notes: ${template.imageNotes}` : ''}
Follow this guidance carefully while keeping mandatory rules above.
`;

  const handleGenerateLongformSummary = async () => {
    setLongformLoading(true);
    setLongformError(null);
    try {
      const chapters = await requestLongformSummary(input, longformTopic, undefined, activeTemplate ? buildTemplateGuidance(activeTemplate) : '');
      setLongformChapters(chapters);
      setLongformSessionId(crypto.randomUUID());
    } catch (err) {
      setLongformError(err instanceof Error ? err.message : '요약 생성에 실패했습니다.');
    } finally {
      setLongformLoading(false);
    }


  };

  const handleApproveChapter = (order: number) => {
    setLongformChapters(prev => prev ? prev.map(ch => ch.order === order ? { ...ch, status: ch.status === 'approved' ? 'pending' : 'approved' } : ch) : prev);


  };

  const handleRegenerateChapter = async (chapter: ChapterSummary) => {
    setLongformLoading(true);
    setLongformError(null);
    try {
      const regenerated = await requestLongformSummary(input, longformTopic, chapter.title);
      if (!regenerated || regenerated.length === 0) throw new Error('재생성된 챕터가 없습니다.');
      const newChapter = regenerated[0];
      setLongformChapters(prev => prev ? prev.map(ch => ch.order === chapter.order ? { ...newChapter, order: ch.order, status: 'pending' } : ch) : prev);
    } catch (err) {
      setLongformError(err instanceof Error ? err.message : '챕터 재생성 실패');
    } finally {
      setLongformLoading(false);
    }


  };

  const handleSaveLongformSession = async () => {
    if (!longformChapters || !longformSessionId) return;
    try {
      await saveLongformSession(longformSessionId, {
        topic: longformTopic || input.customContext,
        input,
        chapters: longformChapters,
        updatedAt: Date.now()
      });
      alert('롱폼 세션이 저장되었습니다.');
      refreshSessionList();
    } catch (err) {
      setLongformError(err instanceof Error ? err.message : '세션 저장 실패');
    }
  };


  const handleLoadLongformSession = async (sessionId: string) => {
    try {
      const data = await loadLongformSession(sessionId);
      if (data.topic) setLongformTopic(data.topic);
      if (data.input) setInput(data.input);
      if (data.chapters) {
        setLongformChapters(data.chapters);
      }
      setLongformSessionId(sessionId);
      alert('세션을 불러왔습니다.');
    } catch (err) {
      setLongformError(err instanceof Error ? err.message : '세션 불러오기 실패');
    }


  };

  const handleGenerateChapterContent = async (chapter: ChapterSummary) => {
    setLongformLoading(true);
    setLongformError(null);
    try {
      const content = await requestLongformChapterContent(input, longformTopic, chapter, activeTemplate ? buildTemplateGuidance(activeTemplate) : '');
      setLongformChapters(prev => prev ? prev.map(ch => ch.order === chapter.order ? { ...ch, content } : ch) : prev);
    } catch (err) {
      setLongformError(err instanceof Error ? err.message : '본문 생성 실패');
    } finally {
      setLongformLoading(false);
    }


  };

  const handleGenerateAllChapterContent = async () => {
    if (!longformChapters) return;
    setLongformLoading(true);
    setLongformError(null);
    try {
      for (const chapter of longformChapters) {
        const content = await requestLongformChapterContent(input, longformTopic, chapter, activeTemplate ? buildTemplateGuidance(activeTemplate) : '');
        setLongformChapters(prev => prev ? prev.map(ch => ch.order === chapter.order ? { ...ch, content } : ch) : prev);
      }
    } catch (err) {
      setLongformError(err instanceof Error ? err.message : '전체 본문 생성 실패');
    } finally {
      setLongformLoading(false);
    }
  };


  const longformFinalScript = longformChapters && longformChapters.length > 0 && longformChapters.every(ch => !!ch.content)
    ? longformChapters
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(ch => `### ${ch.order}. ${ch.title}\n${ch.content}`)
      .join('\n\n')
    : '';

  const handleCopyLongformScript = () => {
    if (!longformFinalScript) return;
    navigator.clipboard?.writeText(longformFinalScript)
      .then(() => alert('최종 본문이 복사되었습니다.'))
      .catch(() => alert('복사에 실패했습니다. 수동으로 선택해 주세요.'));
  };




  const handleAnalyzeTemplate = async () => {
    if (!templateScript) return;
    setTemplateAnalyzing(true);
    setTemplateError(null);
    try {
      const template = await analyzeScriptTemplate(input, templateScript, templateType);
      setLastTemplateResult(template);
      setTemplates(prev => [template, ...prev]);
      setActiveTemplate(template);
      setTemplateToShow(template);
      alert('템플릿이 저장되었습니다.');
      setAnalysisCollapsed(true);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : '템플릿 분석 실패');
    } finally {
      setTemplateAnalyzing(false);
    }
  };

  // JSON 붙여넣기 지원 확대: shorts 생성기와 동일하게 scripts 포맷도 허용
  const parseScriptsJsonLoose = (text: string) => {
    try {
      let jsonText = text.replace(/```json/g, '').replace(/```/g, '');
      const extracted = extractValidJson(jsonText);
      if (extracted) {
        jsonText = extracted;
      }
      jsonText = escapeInlineQuotesForKeys(jsonText, [
        'script',
        'scriptBody',
        'scriptLine',
        'shortPrompt',
        'shortPromptKo',
        'longPrompt',
        'longPromptKo',
        'hook',
        'punchline',
        'context',
        'twist',
        'title'
      ]);
      try {
        return JSON.parse(jsonText);
      } catch {
        return JSON.parse(jsonrepair(jsonText));
      }
    } catch {
      return null;
    }
  };

  const handleManualTemplateApply = async (jsonText: string) => {
    setTemplateAnalyzing(true);
    setTemplateError(null);
    try {
      // Use robust parsing from templateService
      let templateData = parseFromText(jsonText);

      if (!templateData) {
        // Fallback: shorts generator style scripts JSON도 허용
        const parsed = parseScriptsJsonLoose(jsonText);
        if (parsed?.scripts && Array.isArray(parsed.scripts) && parsed.scripts.length > 0) {
          const s = parsed.scripts[0];
          templateData = {
            templateName: s.title || 'Imported Script',
            // 씬별 anchor/프롬프트 → structure 배열
            structure: Array.isArray(s.scenes) && s.scenes.length > 0
              ? s.scenes
                .map((scene: any) =>
                  scene?.scriptLineAnchor ||
                  scene?.shortPromptKo ||
                  scene?.shortPrompt ||
                  scene?.longPromptKo ||
                  scene?.longPrompt
                )
                .filter(Boolean)
              : (s.script ? String(s.script).split('\n').filter(Boolean) : []),
            tone: '',
            hookStrategy: '',
            twistStyle: '',
            rawSource: 'scripts-json'
          };
        } else {
          throw new Error('유효한 JSON 템플릿을 찾을 수 없습니다. (코드 블록이 있어도 괜찮습니다)');
        }
      }

      // Validate required fields
      if (!templateData.templateName || !templateData.structure) {
        throw new Error('Missing required fields: templateName or structure');
      }

      // Create template object
      const template: StyleTemplate = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: templateData.templateName,
        createdAt: Date.now(),
        service: input.targetService || 'GEMINI',
        type: templateType,
        structure: templateData.structure,
        tone: templateData.tone || '',
        hookStrategy: templateData.hookStrategy || '',
        twistStyle: templateData.twistStyle || '',
        characterNotes: templateData.characterNotes,
        imageNotes: templateData.imageNotes,
        rawAnalysis: templateScript,
        hookTiming: templateData.hookTiming,
        lengthGuidance: templateData.lengthGuidance,
        dialogueRatio: templateData.dialogueRatio,
        visualBeats: templateData.visualBeats,
        gagPattern: templateData.gagPattern,
        ctaStyle: templateData.ctaStyle,
        mustHaveObjects: templateData.mustHaveObjects
      };


      // Save template
      await saveTemplate(template);

      // Update state
      setLastTemplateResult(template);
      setTemplates(prev => [template, ...prev]);
      setActiveTemplate(template);
      setTemplateToShow(template);
      setShowTemplateResult(true);
      setAnalysisCollapsed(true);

      alert('템플릿이 수동으로 적용되었습니다!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '수동 적용 실패';
      setTemplateError(`수동 적용 실패: ${errorMessage}`);
      alert(`수동 적용 실패: ${errorMessage}`);
    } finally {
      setTemplateAnalyzing(false);
    }
  };

  const handleApplyTemplate = (template: StyleTemplate) => {
    setActiveTemplate(template);
    setTemplateToShow(template);
    setShowTemplateResult(true);
    alert(`템플릿 "${template.name}"이 적용되었습니다.`);
  };

  const handleClearTemplate = () => {
    setActiveTemplate(null);
    setTemplateToShow(lastTemplateResult);
    if (!lastTemplateResult) {
      setShowTemplateResult(false);
    }
    alert('적용된 템플릿을 해제했습니다.');
  };

  const handleViewTemplate = (template: StyleTemplate) => {
    setTemplateToShow(template);
    setShowTemplateResult(true);
    setRightTab('analysis');


    const sortedFilteredTemplates = templates
      .filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  };

  const handleDeleteTemplate = async (template: StyleTemplate) => {
    if (!template) return;
    const ok = window.confirm(`템플릿 "${template.name}"을 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteTemplate(template.id);
      try {
        const list = await fetchTemplates();
        setTemplates(list);
      } catch {
        setTemplates(prev => prev.filter(t => t.id !== template.id));
      }
      if (activeTemplate?.id === template.id) setActiveTemplate(null);
      if (lastTemplateResult?.id === template.id) setLastTemplateResult(null);
      if (templateToShow?.id === template.id) setTemplateToShow(null);
      alert('삭제되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 실패');
    }
  };


  const openAnalysisTab = () => {
    setRightTab('analysis');
    setTimeout(() => analysisTextareaRef.current?.focus(), 0);
  };


  const handleSaveTestScript = async (scriptData: any) => {
    const scenes: Scene[] = scriptData.scenes && Array.isArray(scriptData.scenes)
      ? scriptData.scenes
      : [];

    const createStory = (): StoryResponse => ({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      title: scriptData.title,
      titleOptions: [scriptData.title],
      scriptBody: scriptData.scriptBody || scriptData.script || '',
      punchline: scriptData.punchline || scriptData.twist || scriptData.hook || '',
      scenes,
      service: 'TEST',
      isFavorite: false,
      _folderName: scriptData._folderName  // ✅ 서버에서 생성한 폴더명 포함
    });

    try {
      const newStory = createStory();

      // ✅ [수정] 서버 연동: 테스트 대본도 물리적 폴더 및 파일로 저장되도록 개선
      const formattedContent = `
=== TITLE ===
${newStory.title}

=== SCRIPT BODY ===
${newStory.scriptBody}

=== PUNCHLINE ===
${newStory.punchline}

=== SCENES (IMAGE PROMPTS) ===
${(newStory.scenes || []).map(s => `
[Scene ${s.sceneNumber}]
KR: ${s.shortPromptKo || ''}
EN: ${s.shortPrompt || ''}
Long: ${s.longPrompt || ''}
`).join('\n')}
`;

      fetch('http://localhost:3002/api/save-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newStory.title,
          content: formattedContent,
          folderName: newStory._folderName,
          service: 'TEST'
        })
      }).then(res => res.json())
        .then(data => {
          if (data.folderName) {
            newStory._folderName = data.folderName;
            setStories(prev => {
              const updated = [newStory, ...prev];
              saveHistory(updated);
              setSelectedStoryId(newStory.id);
              return updated;
            });
          }
        })
        .catch(err => console.error("Test script save failed:", err));

    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    }


  };

  const handleGeneratePlanning = async (title: string, channel: string, duration: string, viralScore: number, tags: string) => {
    const confirmMsg = `'${title}' 영상에 대한 AI 기획안을 생성하시겠습니까?\n(선택된 AI 서비스: ${input.targetService || 'GEMINI'})`;
    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    setRightTab('shortform'); // Switch to result tab to show loading/result
    setError(null);

    try {
      const systemPrompt = "당신은 유튜브 쇼츠 기획 전문가입니다. 주어진 영상을 분석하여 떡상 포인트를 벤치마킹하고, 내 채널에 적용할 기획안을 작성해주세요.";
      const userPrompt = `
[분석 대상 영상]
- 제목: ${title}
- 채널: ${channel}
- 길이: ${duration}
- 성과: 구독자 대비 ${(viralScore / 100).toFixed(1)}배 조회수 (초대박 성과)
- 태그: ${tags}

[요청 사항]
위 영상을 분석하여 다음 항목을 포함한 기획안을 작성해줘.
1. [Hook 분석]: 초반 3초에 시청자를 사로잡은 심리적 트리거는 무엇인가?
2. [벤치마킹 포인트]: 내 영상에 적용할 수 있는 연출, 대사, 편집 스타일 제안.
3. [제목/썸네일 전략]: 클릭률을 높일 수 있는 제목 3가지와 썸네일 컨셉 제안.

**반드시 아래 JSON 포맷으로만 응답해줘 (코드블록/마크다운 금지. 순수 텍스트 JSON만 출력):**
{
  "title": "[AI 분석] ${title}",
  "scriptBody": "분석 내용 전체 (한 줄로 작성, 줄바꿈은 \\n 사용)",
  "punchline": "이 영상의 핵심 성공 비결 한 줄 요약"
}`;

      // Use generate endpoint (with folder creation)
      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: input.targetService || 'GEMINI',
          prompt: systemPrompt + "\n\n" + userPrompt
        })
      });

      const parsedResult = await response.json();

      if (!parsedResult) throw new Error('응답이 비어있습니다.');

      // Check for parsing errors
      if (parsedResult.error) {
        console.error("Generation Error", parsedResult.error);
        throw new Error(parsedResult.error);
      }

      const newStory: StoryResponse = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        title: parsedResult.title || `[AI 분석] ${title}`,
        titleOptions: [parsedResult.title],
        scriptBody: parsedResult.scriptBody || "분석 내용 없음",
        punchline: parsedResult.punchline || "핵심 분석 실패",
        scenes: [],
        service: 'VIDEO_SCRIPT',
        isFavorite: false
      };

      setStories(prev => {
        const updated = [newStory, ...prev];
        saveHistory(updated);
        return updated;
      });
      setSelectedStoryId(newStory.id);

    } catch (err: any) {
      console.error("Planning Generation Error:", err);
      setError(`기획안 생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative flex h-screen w-screen overflow-hidden font-sans transition-colors duration-300 ${darkMode ? 'dark bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200' : 'bg-slate-50 text-slate-900'}`}>

      {/* Left Sidebar */}
      <div className="w-full md:w-[400px] border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col shrink-0 z-20 shadow-2xl">

        {/* Sidebar Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSidebarTab('config')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${sidebarTab === 'config'
              ? 'text-purple-400 bg-slate-100 dark:bg-slate-800/50'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800/30'
              }`}
          >
            <Settings2 className="w-4 h-4" />
            설정
            {sidebarTab === 'config' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
          <button
            onClick={() => setSidebarTab('history')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${sidebarTab === 'history'
              ? 'text-purple-400 bg-slate-100 dark:bg-slate-800/50'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800/30'
              }`}
          >
            <LayoutList className="w-4 h-4" />
            보관함

            {sidebarTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
          <button
            onClick={() => setSidebarTab('hybrid')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${sidebarTab === 'hybrid'
              ? 'text-purple-400 bg-slate-100 dark:bg-slate-800/50'
              : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-800/30'
              }`}
          >
            <Sparkles className="w-4 h-4" />
            Master Studio
            {sidebarTab === 'hybrid' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />}
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-hidden relative">

          {/* Config Tab Content */}
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${sidebarTab === 'config' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}>
            <div className="flex-1 overflow-y-auto">
              <ConfigPanel
                input={{ ...input, onOpenYoutubeSearch: () => setRightTab('youtube-search') }}
                onChange={setInput}
                onOpenAnalysis={() => setRightTab('analysis')}
                onOpenShortform={() => setRightTab('shortform')}
                analysisActive={rightTab === 'analysis'}
              />
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              {input.customJson !== undefined ? (
                <Button
                  onClick={handleGenerate}
                  isLoading={loading}
                  className="w-full py-4 text-lg shadow-green-500/25 bg-green-500/90 hover:bg-green-500 text-white"
                >
                  <LayoutList className="w-5 h-5" />
                  JSON 불러오기
                </Button>
              ) : input.customScript !== undefined ? (
                <Button
                  onClick={handleGenerate}
                  isLoading={loading}
                  className="w-full py-4 text-lg shadow-blue-500/25 bg-blue-500/90 hover:bg-blue-500 text-white"
                >
                  <Sparkles className="w-5 h-5" />
                  대본→이미지 생성
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    isLoading={loading}
                    className="flex-1 py-4 text-sm shadow-purple-500/25 bg-purple-600 hover:bg-purple-500 text-white"
                    title="대본 없이 텍스트 스토리만 생성 (이미지 없음)"
                  >
                    <Wand2 className="w-4 h-4" />
                    스토리생성
                  </Button>
                  <Button
                    onClick={handleShortsDirectGenerate}
                    isLoading={loading}
                    className="flex-1 py-4 text-sm shadow-pink-500/25 bg-pink-600 hover:bg-pink-500 text-white"
                    title="장르/모드 설정만으로 쇼츠 대본+이미지를 생성합니다"
                  >
                    <Sparkles className="w-4 h-4" />
                    장르생성
                  </Button>
                  <Button
                    onClick={handleTestGenerate}
                    isLoading={loading}
                    className="flex-1 py-4 text-sm shadow-green-500/25 bg-green-600 hover:bg-green-500 text-white"
                    title="순수 장르 지침만으로 테스트 생성"
                  >
                    <Zap className="w-4 h-4" />
                    테스트
                  </Button>
                </div>
              )}
            </div>
            {/* DEV: Shorts Generator Trigger - REMOVED */}
          </div>

          {/* History Tab Content */}
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${sidebarTab === 'history' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}>
            <div className="grid grid-cols-4 gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <button
                className={`py-1.5 rounded-md text-xs font-semibold ${historySubTab === 'stories' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-100'}`}
                onClick={() => setHistorySubTab('stories')}
              >
                생성 대본
              </button>
              <button
                className={`py-1.5 rounded-md text-xs font-semibold ${historySubTab === 'templates' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-100'}`}
                onClick={() => setHistorySubTab('templates')}
              >
                분석 대본
              </button>
              <button
                className={`py-1.5 rounded-md text-xs font-semibold ${historySubTab === 'video' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-100'}`}
                onClick={() => setHistorySubTab('video')}
              >
                영상 대본
              </button>
              <button
                className={`py-1.5 rounded-md text-xs font-semibold ${historySubTab === 'test' ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-100'}`}
                onClick={() => setHistorySubTab('test')}
              >
                테스트 대본
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <HistoryPanel
                stories={stories}
                templates={templates}
                selectedId={historySubTab === 'templates' ? (templateToShow?.id || null) : selectedStoryId}
                onSelect={handleSelectStory}
                onDelete={handleDeleteStory}
                onToggleFavorite={handleToggleFavorite}
                onSelectTemplate={handleViewTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onToggleTemplateFavorite={handleToggleTemplateFavorite}
                activeTab={historySubTab}
              />
            </div>
          </div>
        </div>
      </div>


      {/* Right Main Content Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 relative overflow-hidden">
        {/* Right Tabs */}
        <div className="px-4 pt-4 pr-28 z-30 flex items-center gap-2 justify-between">
          <div className="inline-flex bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <button className={`px-4 py-2 text-sm ${rightTab === 'analysis' ? 'bg-slate-100 dark:bg-slate-800 text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => setRightTab('analysis')}>분석</button>
            <button className={`px-4 py-2 text-sm ${rightTab === 'shortform' ? 'bg-slate-100 dark:bg-slate-800 text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => setRightTab('shortform')}>숏폼 결과</button>
            <button className={`px-4 py-2 text-sm ${rightTab === 'longform' ? 'bg-slate-100 dark:bg-slate-800 text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => setRightTab('longform')}>롱폼</button>
            <button className={`px-4 py-2 text-sm ${rightTab === 'shorts-generator' ? 'bg-slate-100 dark:bg-slate-800 text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => {
              setRightTab('shorts-generator');
              setSidebarTab('history');
              setHistorySubTab('stories');
            }}>쇼츠 생성기</button>
            <button className={`px-4 py-2 text-sm ${rightTab === 'ai-studio' ? 'bg-slate-100 dark:bg-slate-800 text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => setRightTab('ai-studio')}>AI Studio</button>
            <button className={`px-4 py-2 text-sm ${rightTab === 'cineboard' ? 'bg-slate-100 dark:bg-slate-800 text-purple-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => setRightTab('cineboard')}>씨네보드</button>
            <button className={`px-4 py-2 text-sm ${rightTab === 'shorts-lab' ? 'bg-slate-100 dark:bg-slate-800 text-emerald-300' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`} onClick={() => setRightTab('shorts-lab')}>쇼츠랩</button>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              title={darkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Background Effects */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[120px]" />
          <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] rounded-full bg-pink-900/20 blur-[100px]" />
        </div>

        {/* Main Content */}
        <div className="flex-1 relative z-30 overflow-hidden p-4">
          {rightTab === 'analysis' && (
            <div className="h-full flex flex-col gap-4 min-h-0">
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">대본 분석</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAnalysisCollapsed(v => !v)} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {analysisCollapsed ? '입력 열기' : '입력 접기'}
                    </button>
                    <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <input type="radio" checked={templateType === 'shortform'} onChange={() => setTemplateType('shortform')} /> 숏폼
                    </label>
                    <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <input type="radio" checked={templateType === 'longform'} onChange={() => setTemplateType('longform')} /> 롱폼
                    </label>
                  </div>
                </div>
                {!analysisCollapsed && (
                  <>
                    <textarea ref={analysisTextareaRef} value={templateScript} onChange={(e) => setTemplateScript(e.target.value)} placeholder="여기에 대박난 대본을 붙여넣고 분석을 눌러주세요" className="w-full h-40 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 mt-2" />
                    <div className="mt-3 flex items-center gap-3">
                      <Button onClick={handleAnalyzeTemplate} isLoading={templateAnalyzing}>
                        스타일 분석
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowManualInput(!showManualInput)}
                      >
                        {showManualInput ? '수동 입력 닫기' : '수동 적용'}
                      </Button>
                      {activeTemplate && (
                        <Button variant="secondary" onClick={handleClearTemplate}>적용 해제</Button>
                      )}
                    </div>
                    {templateError && <p className="text-sm text-red-400 mt-2">{templateError}</p>}

                    {/* Manual JSON Input */}
                    {showManualInput && (
                      <div className="mt-4 bg-white dark:bg-slate-950/70 border border-yellow-600/40 rounded-lg p-4 space-y-3">
                        <div>
                          <h4 className="text-sm font-semibold text-yellow-400 mb-2">수동 템플릿 적용</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            AI가 응답을 완료했지만 자동 파싱에 실패한 경우, AI의 JSON 응답을 직접 붙여넣으세요.
                          </p>
                        </div>
                        <textarea
                          value={manualJson}
                          onChange={(e) => setManualJson(e.target.value)}
                          className="w-full h-32 bg-slate-50 dark:bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          placeholder='{"templateName": "...", "structure": [...], "tone": "...", ...}'
                        />
                        <Button
                          onClick={() => {
                            handleManualTemplateApply(manualJson);
                            setManualJson('');
                            setShowManualInput(false);
                          }}
                          disabled={!manualJson.trim()}
                        >
                          JSON 적용하기
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {(templateToShow || lastTemplateResult || activeTemplate) && (
                <div className="flex-1 min-h-0">
                  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col min-h-0 relative">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-semibold">분석 결과</h4>
                      <div className="flex items-center gap-2">
                        {(templateToShow || lastTemplateResult || activeTemplate) && (
                          <>
                            <Button onClick={() => handleApplyTemplate((templateToShow || lastTemplateResult || activeTemplate)!)}>이 템플릿 적용</Button>
                            <Button variant="secondary" onClick={() => handleDeleteTemplate((templateToShow || lastTemplateResult || activeTemplate)!)}>삭제</Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto pr-2 pb-8 relative">
                      <TemplateResultDisplay template={(templateToShow || lastTemplateResult || activeTemplate)!} onClose={() => { setTemplateToShow(null); setShowTemplateResult(false); }} />
                      {/* Bottom fade */}
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-950/90 to-transparent" />
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}


          {rightTab === 'shortform' && (
            <div className="h-full">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 animate-pulse">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 animate-spin blur-sm opacity-75"></div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-white mb-2">AI가 스토리를 집필 중입니다...</h3>
                    <p className="text-slate-500 dark:text-slate-400">최적의 이미지 프롬프트와 대본을 생성하고 있습니다.</p>
                  </div>
                  <button onClick={handleCancelGeneration} className="px-5 py-2 rounded-full bg-red-600 text-white font-semibold shadow-lg hover:bg-red-500 transition-colors">강제 중지</button>
                </div>
              ) : error ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6"></div>
                  <h3 className="text-xl font-bold text-white mb-2">오류가 발생했습니다</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-6">{error}</p>
                  <div className="flex gap-3">
                    <Button onClick={handleGenerate} variant="secondary">다시 시도하기</Button>
                    <Button onClick={() => setError(null)} variant="secondary" className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-700">중지 (메인으로)</Button>
                  </div>
                </div>
              ) : activeStory ? (
                <OutputDisplay data={activeStory} onUpdate={handleUpdateStory} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-6 shadow-xl rotate-3">
                    <Wand2 className="w-10 h-10 opacity-50" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-3">시작할 준비가 되셨나요?</h2>
                  <p className="max-w-md mx-auto leading-relaxed">좌측 패널에서 주제와 설정을 선택하고<br /><span className="text-purple-400 font-semibold">'스토리 생성하기'</span> 버튼을 눌러주세요.</p>
                </div>
              )}
            </div>
          )}


          {rightTab === 'longform' && (
            <LongformPanel
              input={input}
              topic={longformTopic}
              onTopicChange={setLongformTopic}
              onGenerateSummary={handleGenerateLongformSummary}
              chapters={longformChapters}
              loading={longformLoading}
              onApproveChapter={handleApproveChapter}
              onRegenerateChapter={handleRegenerateChapter}
              onSaveSession={handleSaveLongformSession}
              onGenerateChapterContent={handleGenerateChapterContent}
              onGenerateAllChapters={handleGenerateAllChapterContent}
              onLoadSession={handleLoadLongformSession}
              sessions={longformSessions}
              sessionId={longformSessionId}
              error={longformError}
              finalScript={longformFinalScript}
              onCopyFinalScript={handleCopyLongformScript}
            />
          )}
          {rightTab === 'youtube-search' && (
            <YoutubeSearchPanel onGeneratePlanning={handleGeneratePlanning} />
          )}
          {rightTab === 'shorts-generator' && (
            <div className="h-full flex bg-white dark:bg-slate-950">
              {/* Generator Content (Right Panel) */}
              <div className="flex-1 bg-white dark:bg-slate-900 overflow-y-auto">
                <ShortsScriptGenerator
                  onSave={handleSaveTestScript}
                  selectedStory={activeStory}
                  onClearSelection={() => setSelectedStoryId(null)}
                  defaultSettings={{ ...input, onChange: setInput }}
                  darkMode={darkMode}
                  externalTrigger={shortsAutoTrigger}
                  onExternalGenerateComplete={() => setShortsAutoTrigger(null)}
                />
              </div>
            </div>
          )}
          {rightTab === 'ai-studio' && (
            <div className="h-full flex bg-white dark:bg-slate-950">
              <div className="flex-1 bg-slate-950 text-white overflow-hidden flex">
                <AiStudioHost />
              </div>
            </div>
          )}
          {rightTab === 'cineboard' && (
            <div className="h-full flex bg-white dark:bg-slate-950">
              <div className="flex-1 bg-slate-950 text-white overflow-hidden flex">
                <CineboardPanel targetService={input.targetService} />
              </div>
            </div>
          )}
          {rightTab === 'shorts-lab' && (
            <div className="h-full flex bg-white dark:bg-slate-950">
              <div className="flex-1 bg-slate-950 text-white overflow-hidden flex">
                <ShortsLabPanel />
              </div>
            </div>
          )}

        </div>
      </div>
      {/* Master Studio Overlay */}
      {
        sidebarTab === 'hybrid' && (
          <div className="fixed inset-0 z-50 bg-black animate-in fade-in duration-300">
            <MasterStudioContainer onClose={() => setSidebarTab('config')} />
          </div>
        )
      }

      {/* Shorts Generator Overlay */}
      <ToastContainer />

    </div >
  );
};


export default App;
// End of App component

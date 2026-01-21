import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Button } from './Button';
import { TargetService } from '../types';
import JSZip from 'jszip';
import { ImageIcon, Sparkles, Loader2, Shield, ShieldOff, RefreshCw, X, Maximize2 } from 'lucide-react';
import { generateImageWithImagen, generateImage, fetchAvailableModels } from './master-studio/services/geminiService';
import { saveImageToDisk } from './master-studio/services/serverService';
import { setBlob } from './master-studio/services/dbService';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import Lightbox from './master-studio/Lightbox';
import { showToast } from './Toast';

type StylePreset = {
  id: 'classic' | 'kdrama' | 'noir' | 'fairytale' | 'cinematic_real' | 'oriental_myth' | 'hyper_ad';
  label: string;
  description: string;
  technicalKeywords: string;
};

type EnginePreset = {
  id: 'nano' | 'pro';
  label: string;
  description: string;
};

type AspectPreset = {
  id: '16:9' | '9:16';
  label: string;
  description: string;
};

type CharacterConcept = {
  id: string;
  imageUrl: string;
  description: string;
};

type CharacterCard = {
  id: string;
  name: string;
  originalName: string;
  role: string;
  image?: string; // Base64 or URL
  imageDescription?: string;
  // ✅ [NEW] Detailed visual attributes
  hair?: string;
  eyes?: string;
  bodyType?: string;
  distinctFeatures?: string;
  personality?: string;
  concepts?: CharacterConcept[];
  selectedConceptId?: string;
};

type CineboardScene = {
  sceneNumber: number;
  summary: string;
  camera: string;
  shortPrompt: string;
  shortPromptKo: string;
  longPrompt: string;
  longPromptKo: string;
  imageUrl?: string;
  videoUrl?: string;
  videoPrompt?: string; // [NEW] 비디오 전용 프롬프트
  isVideoPromptGenerating?: boolean; // [NEW] 프롬프트 생성 중 상태
  isImageGenerating?: boolean;
  isVideoGenerating?: boolean;
  scriptLine?: string; // [NEW] 대본 한 줄
  action?: string; // [NEW] 동작
  emotion?: string; // [NEW] 감정
  scriptRef?: string; // 원본 대본 텍스트 (스크립트 앵커링)
  dialogueRefined?: string; // 정제된 대사 (감정지문 제거)
  screenText?: string; // 화면 표시 텍스트 (쇼츠용)
  shotType?: string; // 샷 타입 (FULL SHOT, MEDIUM CLOSE-UP 등)
  isSelected?: boolean; // 쇼츠 변환용 선택 상태
  age?: string; // 나이대 (20대~70대)
  outfit?: string; // 의상 스타일
};

type CineboardResult = {
  title: string;
  scriptBody: string;
  sceneCount: number;
  characters: any[];
  scenes: CineboardScene[];
  bgm?: {
    trackTitle: string;
    koreanDescription: string;
    sunoPrompt: {
      title: string;
      prompt: string;
    };
  };
  scripts?: any[];
};

type CineboardPanelProps = {
  targetService?: TargetService;
};

const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'classic',
    label: '감성사극',
    description: '조선 시대 고증 질감과 은은한 조명',
    technicalKeywords: 'Joseon Dynasty period authentic textures, soft traditional Korean lantern lighting, cinematic hanbok colors, 35mm lens, high depth of field, atmospheric haze'
  },
  {
    id: 'kdrama',
    label: 'K-드라마 실사',
    description: '화사한 스튜디오 조명과 리얼 톤',
    technicalKeywords: 'Modern K-Drama aesthetic, high-key studio lighting, vibrant and clean colors, sharp 4K resolution, shallow depth of field, 85mm portrait lens, commercial film look'
  },
  {
    id: 'noir',
    label: '누아르',
    description: '묵직한 대비와 시네마틱 무드',
    technicalKeywords: 'Cinematic Noir, high contrast, low-key lighting, deep shadows, moody atmosphere, anamorphic lens, grainy film texture, dramatic chiaroscuro'
  },
  {
    id: 'fairytale',
    label: '동화 일러스트',
    description: '따뜻한 색감과 부드러운 라인',
    technicalKeywords: 'Soft fairytale illustration, watercolor textures, warm pastel colors, ethereal glow, magical atmosphere, whimsical art style, soft edges'
  },
  {
    id: 'cinematic_real',
    label: '시네마틱 실사',
    description: '영화 같은 웅장한 구도와 색감',
    technicalKeywords: 'Cinematic photo, epic wide angle, dramatic movie lighting, teal and orange color grading, 35mm anamorphic lens, depth of field, highly detailed cinematic atmosphere'
  },
  {
    id: 'oriental_myth',
    label: '동양 설화 일러스트',
    description: '전통적인 수묵채색풍과 신비로운 무드',
    technicalKeywords: 'Traditional oriental myth illustration, Asian folklore style, ink and wash painting textures, ethereal mist, mystical spirits, golden line accents, vibrant silk colors'
  },
  {
    id: 'hyper_ad',
    label: '하이퍼 리얼 광고',
    description: '깨끗하고 세련된 명품 광고 비주얼',
    technicalKeywords: 'Hyper-realistic 8k, high-end commercial photography, professional soft beauty lighting, clean minimalist background, vibrant product colors, sharp textures, high fashion aesthetic'
  }
];

const ENGINE_PRESETS: EnginePreset[] = [
  { id: 'nano', label: '나노 엔진', description: '빠른 스케치와 구성 확인용' },
  { id: 'pro', label: '프로 엔진', description: '정교한 묘사와 최종 결과물용' }
];

const ASPECT_PRESETS: AspectPreset[] = [
  { id: '16:9', label: '16:9', description: '롱폼 영상' },
  { id: '9:16', label: '9:16', description: '쇼츠 영상' }
];

const systemPrompt = `당신은 세계 최고의 영상 연출가이자 스토리보드 작가입니다. 
주어지는 대본을 분석하여 시각적으로 일관성 있고 압도적인 퀄리티의 장면들을 설계해야 합니다.
특히 인물의 시각적 정체성(Identity Lock)을 유지하는 것이 가장 중요합니다.`;

const INITIAL_CHARACTERS: CharacterCard[] = [
  { id: 'A', name: '주인공', originalName: '주인공', role: '핵심 인물' },
  { id: 'B', name: '조력자', originalName: '조력자', role: '보조 인물' },
  { id: 'C', name: '라이벌', originalName: '라이벌', role: '갈등 인물' }
];

const STOP_WORDS = new Set([
  '그리고', '하지만', '그래서', '그러나', '오늘', '여러분', '영상', '대본', '시네보드', '씨네보드',
  '김부장', '앱', '설명', '방법', '정말', '저희', '사람', '인물', '이것', '그것', '이런', '저런',
  '여기', '저기', '지금', '다시', '때문', '사연', '미스터리', '동화', '내용', '소개', '작업',
  '기능', '사용', '선택', '기본', '설정', '방식', '장면', '이미지', '영상물'
]);

const AGE_OPTIONS = [
  { value: '', label: '나이 미선택' },
  { value: 'in their 20s', label: '20대' },
  { value: 'in their 30s', label: '30대' },
  { value: 'in their 40s', label: '40대' },
  { value: 'in their 50s', label: '50대' },
  { value: 'in their 60s', label: '60대' },
  { value: 'in their 70s', label: '70대' },
];

const HAIR_OPTIONS = [
  { value: '', label: '헤어 미선택' },
  { value: 'Long straight black hair', label: '긴 생머리 (흑발)' },
  { value: 'Wavy long black hair', label: '물결 펌 (흑발)' },
  { value: 'Short brown bob cut', label: '갈색 단발' },
  { value: 'Elegant silver short hair', label: '우아한 은발 숏컷' },
  { value: 'High blonde ponytail', label: '금발 포니테일' },
  { value: 'Traditional Korean bun hair with binyeo', label: '비녀를 꽂은 쪽머리' },
  { value: 'Messy wild dark hair', label: '헝클어진 거친 머리' },
  { value: 'Bald head', label: '민머리' },
  { value: 'Mid-length permed hair', label: '중단발 파마머리' },
];

const EYES_OPTIONS = [
  { value: '', label: '눈매 미선택' },
  { value: 'Sharp and cold eyes', label: '날카롭고 차가운 눈매' },
  { value: 'Round and gentle eyes', label: '둥글고 선한 눈매' },
  { value: 'Seductive cat-like eyes', label: '유혹적인 고양이 눈매' },
  { value: 'Deep melancholic eyes', label: '깊고 우울한 눈매' },
  { value: 'Big shiny sparkling eyes', label: '크고 초롱초롱한 눈매' },
  { value: 'Small squinty eyes', label: '가늘고 찢어진 눈매' },
  { value: 'Monolid oriental eyes', label: '무쌍 동양적 눈매' },
  { value: 'Arched eyebrows with fierce eyes', label: '치켜 올라간 강렬한 눈매' },
];

const BODY_OPTIONS = [
  { value: '', label: '체형 미선택' },
  { value: 'Slim and fit body', label: '슬림하고 탄탄한 체형' },
  { value: 'Athletic and muscular build', label: '근육질의 건장한 체형' },
  { value: 'Voluptuous and curvy silhouette', label: '글래머러스한 체형' },
  { value: 'Petite and skinny frame', label: '작고 왜소한 체형' },
  { value: 'Tall and slender model-like body', label: '키 크고 늘씬한 모델 체형' },
  { value: 'Chubby and round friendly body', label: '통통하고 푸근한 체형' },
  { value: 'Broad shoulders and sturdy frame', label: '어깨가 넓은 상남자 체형' },
  { value: 'Elegant and graceful posture', label: '우아하고 기품 있는 자태' },
];

const OUTFIT_OPTIONS = [
  { value: '', label: '의상 미선택' },
  { value: 'wearing traditional Korean hanbok', label: '조선 시대 한복' },
  { value: 'wearing an ultra-short jeogori that barely covers the chest and an ultra-short tight-fitting low-waisted mini chima skirt revealing the navel, provocative tavern hostess style, strictly no high-waist', label: '섹시한 주막 한복(타이트/초미니)' },
  { value: 'wearing a sheer see-through silk jeogori and a matching low-waisted mini chima skirt revealing the navel', label: '시스루 한복(비치는 소재)' },
  { value: 'wearing an ultra-short see-through jeogori and a tight-fitting low-waisted mini chima with elegant color gradation, revealing the navel', label: '그라데이션 시스루(타이트/초미니)' },
  { value: 'wearing an ultra-short see-through jeogori and a tight-fitting low-waisted mini chima with intricate floral embroidery, revealing the navel', label: '화려한 자수 시스루(타이트/초미니)' },
  { value: 'wearing an ultra-short see-through jeogori and a tight-fitting low-waisted mini chima in soft pastel tones, revealing the navel', label: '파스텔 시스루(타이트/초미니)' },
  { value: 'wearing modern K-drama style outfit', label: 'K-드라마 리얼톤' },
  { value: 'wearing cinematic noir style dark outfit', label: '누아르 스타일' },
  { value: 'wearing soft fairytale-like outfit', label: '동화풍 의상' },
  { value: 'wearing epic cinematic costume', label: '시네마틱 의상' },
  { value: 'wearing mystical Asian folklore costume', label: '동양 설화 복식' },
  { value: 'wearing luxury high-fashion outfit', label: '하이퍼 리얼(명품)' },
  { value: 'wearing professional golf attire', label: '골프웨어' },
  { value: 'wearing a sharp business suit', label: '비즈니스 정장' },
  { value: 'wearing casual everyday clothes', label: '캐주얼' },
];

const PARTICLE_REGEX = /(은|는|이|가|을|를|와|과|도|에|에서|으로|로|에게|께|한테|까지|부터|만|의)$/;

// Utility: Extract only the script body from formatted content
const extractPureScript = (content: string) => {
  if (!content) return '';

  // 1. Try to find === SCRIPT === or === ORIGINAL SCRIPT ===
  const match = content.match(/===\s*(?:ORIGINAL\s+)?SCRIPT\s*===\s*([\s\S]*?)(?:\s*===|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  // 2. JSON format: Extract scriptBody field for pure script content
  const trimmedContent = content.trim();

  // Check if content looks like JSON (starts with { or [)
  if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
    // Helper to extract script from parsed JSON
    const extractFromParsed = (parsed: Record<string, unknown>): string | null => {
      // scriptBody field (most common)
      if (parsed.scriptBody && typeof parsed.scriptBody === 'string') {
        return parsed.scriptBody.trim();
      }

      // scripts array with scriptBody
      if (Array.isArray(parsed.scripts) && parsed.scripts[0]?.scriptBody) {
        return String(parsed.scripts[0].scriptBody).trim();
      }

      // Other possible fields (fallback)
      if (parsed.content && typeof parsed.content === 'string') return parsed.content.trim();
      if (parsed.script && typeof parsed.script === 'string') return parsed.script.trim();
      if (parsed.text && typeof parsed.text === 'string') return parsed.text.trim();
      if (parsed.narration && typeof parsed.narration === 'string') return parsed.narration.trim();
      if (parsed.dialogue && typeof parsed.dialogue === 'string') return parsed.dialogue.trim();
      if (parsed.body && typeof parsed.body === 'string') return parsed.body.trim();

      return null;
    };

    // Try standard JSON.parse first
    try {
      const parsed = JSON.parse(trimmedContent);
      const extracted = extractFromParsed(parsed);
      if (extracted) return extracted;
    } catch (e) {
      // Standard parsing failed, try regex extraction as fallback
    }

    // Regex fallback: Extract scriptBody value directly from malformed JSON
    const scriptBodyMatch = trimmedContent.match(/"scriptBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (scriptBodyMatch && scriptBodyMatch[1]) {
      // Unescape JSON string
      try {
        return JSON.parse(`"${scriptBodyMatch[1]}"`);
      } catch {
        return scriptBodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
    }

    // Try other field names with regex
    const fieldPatterns = ['script', 'content', 'text', 'narration', 'dialogue', 'body'];
    for (const field of fieldPatterns) {
      const fieldMatch = trimmedContent.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (fieldMatch && fieldMatch[1]) {
        try {
          return JSON.parse(`"${fieldMatch[1]}"`);
        } catch {
          return fieldMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
    }

    // JSON detected but no script field found - don't return raw JSON
    console.warn('[extractPureScript] JSON detected but no script field found');
    return '';
  }

  // 3. Plain text: return entire content
  return trimmedContent;
};

const parseSceneFromFilename = (filename: string): number | null => {
  const match = filename.match(/scene-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
};

const normalizeToken = (token: string): string => {
  return token.replace(PARTICLE_REGEX, '');
};

const extractCharacters = (script: string, candidates: string[]): CharacterCard[] => {
  const tokens = script.match(/[가-힣]{2,5}/g) ?? [];
  const frequency = new Map<string, number>();
  const normalizedCandidates = candidates
    .map((candidate) => normalizeToken(candidate.trim()))
    .filter((candidate) => candidate.length >= 2 && !STOP_WORDS.has(candidate));

  normalizedCandidates.forEach((candidate) => {
    if (script.includes(candidate)) {
      frequency.set(candidate, (frequency.get(candidate) ?? 0) + 5);
    }
  });

  tokens.forEach((token) => {
    const normalized = normalizeToken(token);
    if (!normalized || normalized.length < 2) return;
    if (STOP_WORDS.has(normalized)) return;
    const count = frequency.get(normalized) ?? 0;
    frequency.set(normalized, count + 1);
  });

  const sorted = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name], index) => ({
      id: String.fromCharCode(65 + index),
      name,
      originalName: name,
      role: '추출됨'
    }));

  return sorted;
};

// Utility: Remove emotion markers from dialogue
const refineDialogue = (text: string): string => {
  // Remove patterns like (괴로워하며), (분노하며), (미소지으며) etc.
  return text.replace(/\([^)]*하며\)/g, '')
    .replace(/\([^)]*지으며\)/g, '')
    .replace(/\([^)]*거리며\)/g, '')
    .replace(/\([^)]*대며\)/g, '')
    .trim();
};

// Utility: Extract shot type from camera description
const extractShotType = (camera: string): string => {
  const lowerCamera = camera.toLowerCase();
  if (lowerCamera.includes('extreme close')) return 'EXTREME CLOSE-UP';
  if (lowerCamera.includes('close-up') || lowerCamera.includes('close up')) return 'CLOSE-UP';
  if (lowerCamera.includes('medium close')) return 'MEDIUM CLOSE-UP';
  if (lowerCamera.includes('medium') || lowerCamera.includes('two-shot')) return 'MEDIUM SHOT';
  if (lowerCamera.includes('full shot') || lowerCamera.includes('full body')) return 'FULL SHOT';
  if (lowerCamera.includes('wide') || lowerCamera.includes('establishing')) return 'WIDE SHOT';
  if (lowerCamera.includes('extreme wide')) return 'EXTREME WIDE SHOT';
  return 'MEDIUM SHOT'; // Default
};

// Utility: Split script into chunks for scene anchoring
const splitScriptForScenes = (script: string, sceneCount: number): string[] => {
  const lines = script.split('\n').filter(line => line.trim().length > 0);
  const linesPerScene = Math.ceil(lines.length / sceneCount);
  const chunks: string[] = [];

  for (let i = 0; i < sceneCount; i++) {
    const start = i * linesPerScene;
    const end = Math.min(start + linesPerScene, lines.length);
    const chunk = lines.slice(start, end).join('\n');
    chunks.push(chunk);
  }

  return chunks;
};

export const CineboardPanel: React.FC<CineboardPanelProps> = ({ targetService }) => {
  const [selectedStyle, setSelectedStyle] = useState<StylePreset['id']>('classic');
  const [selectedEngine, setSelectedEngine] = useState<EnginePreset['id']>('nano');
  const [selectedAspect, setSelectedAspect] = useState<AspectPreset['id']>('9:16');
  const [sceneCount, setSceneCount] = useState<number>(10);
  const [scriptText, setScriptText] = useState<string>('');
  const [scriptFileName, setScriptFileName] = useState<string>('');
  const [scriptLength, setScriptLength] = useState<number>(0);
  const [characters, setCharacters] = useState<CharacterCard[]>(INITIAL_CHARACTERS);
  const [approvedCharacterIds, setApprovedCharacterIds] = useState<Set<string>>(
    () => new Set(INITIAL_CHARACTERS.map((character) => character.id))
  );
  const [nameDictionary, setNameDictionary] = useState<Record<string, string>>({});
  const [dictionaryText, setDictionaryText] = useState<string>('');
  const [dictionaryNotice, setDictionaryNotice] = useState<string>('');
  const [candidateText, setCandidateText] = useState<string>('');
  const [candidateList, setCandidateList] = useState<string[]>([]);
  const [candidateNotice, setCandidateNotice] = useState<string>('');
  const [characterNotes, setCharacterNotes] = useState<Record<string, string>>({});
  const [missingNotice, setMissingNotice] = useState<string>('');
  const [extractionNotice, setExtractionNotice] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [generationResult, setGenerationResult] = useState<CineboardResult | null>(null);
  const [generatedFolderName, setGeneratedFolderName] = useState<string>('');
  const [generationError, setGenerationError] = useState<string>('');
  const [activeView, setActiveView] = useState<'config' | 'result'>('config');
  const [sceneTabs, setSceneTabs] = useState<Record<number, 'img' | 'video' | 'json'>>({});
  const [editingScene, setEditingScene] = useState<{ number: number; field: 'ko' | 'en' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [isCastingId, setIsCastingId] = useState<string | null>(null); // ✅ [NEW] Track which character is being cast
  const castingAbortControllerRef = useRef<AbortController | null>(null); // ✅ [NEW] For cancellation

  // ✅ [NEW] Generate 3 concepts for virtual casting
  const handleGenerateCharacterConcepts = async (character: CharacterCard) => {
    // 🛑 [취소 로직] 이미 해당 캐릭터가 로딩 중일 때 버튼을 다시 누르면 취소
    if (isCastingId === character.id) {
      if (castingAbortControllerRef.current) {
        castingAbortControllerRef.current.abort();
        castingAbortControllerRef.current = null;
      }
      setIsCastingId(null);
      setExtractionNotice('가상 캐스팅이 취소되었습니다.');
      return;
    }

    if (isAnalyzing || isCastingId) return;

    // 새로운 요청을 위한 컨트롤러 생성
    const controller = new AbortController();
    castingAbortControllerRef.current = controller;

    setIsCastingId(character.id);
    setExtractionNotice(`${character.name} 가상 캐스팅 중...`);

    try {
      const prompt = `
[TASK: VIRTUAL CASTING CONCEPTS]
Based on the character profile, generate 3 distinct visual concepts for AI image generation.
Each concept should have a short English prompt focused on facial features and hairstyle to ensure consistency.
Character: ${character.name} (${character.role})
Personality: ${character.personality}
Hair: ${character.hair}
Eyes: ${character.eyes}
Body: ${character.bodyType}
Distinct Features: ${character.distinctFeatures}

Output ONLY a JSON array of 3 objects:
[
  {"id": "1", "description": "Concept description 1", "prompt": "Visual prompt 1 (English)"},
  {"id": "2", "description": "Concept description 2", "prompt": "Visual prompt 2 (English)"},
  {"id": "3", "description": "Concept description 3", "prompt": "Visual prompt 3 (English)"}
]
`;
      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: targetService ?? 'GEMINI', prompt }),
        signal: controller.signal // 신호 전달
      });

      if (!response.ok) throw new Error('컨셉 생성 실패');
      const concepts = await response.json();

      if (Array.isArray(concepts)) {
        const conceptImages = await Promise.all(concepts.map(async (c: any) => {
          let base64 = '';
          try {
            // 이미지 생성 시에도 취소 여부 확인
            if (controller.signal.aborted) return null;

            if (imageModel.toLowerCase().includes('imagen')) {
              const res = await generateImageWithImagen(c.prompt, "", { aspectRatio: "1:1", model: imageModel });
              base64 = res?.generatedImages?.[0]?.image?.imageBytes;
            } else {
              const res = await generateImage(c.prompt, { aspectRatio: "1:1", model: imageModel });
              // @ts-ignore
              base64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            }
          } catch (err) {
            console.error(`Failed to generate concept image for ${character.name}:`, err);
          }

          return {
            id: c.id,
            imageUrl: base64 ? `data:image/png;base64,${base64}` : '',
            description: c.description,
            prompt: c.prompt
          };
        }));

        // 취소된 경우 결과 반영하지 않음
        if (controller.signal.aborted) return;

        const filteredConcepts = conceptImages.filter(c => c !== null);

        setCharacters(prev => prev.map(char =>
          char.id === character.id ? { ...char, concepts: filteredConcepts as any } : char
        ));
        setExtractionNotice(`${character.name} 캐스팅 옵션 생성 완료`);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Casting aborted by user');
      } else {
        console.error(e);
        alert('가상 캐스팅 생성에 실패했습니다.');
      }
    } finally {
      // 로딩 상태 해제 (자신의 요청이었을 때만)
      if (castingAbortControllerRef.current === controller) {
        setIsCastingId(null);
        castingAbortControllerRef.current = null;
      }
    }
  };

  const handleSelectConcept = (characterId: string, concept: any) => {
    setCharacters(prev => prev.map(char => {
      if (char.id === characterId) {
        return {
          ...char,
          image: concept.imageUrl,
          selectedConceptId: concept.id,
          imageDescription: concept.prompt
        };
      }
      return char;
    }));
    showToast('인물 컨셉이 선택되었습니다.', 'success');
  };

  // ✅ [NEW] Image Generation & Lightbox States
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [imageModel, setImageModel] = useState<string>('imagen-4.0-generate-001');
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [noGuard, setNoGuard] = useState<boolean>(false);
  const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null); // For Native Image Generation
  const [aiForwardingId, setAiForwardingId] = useState<string | null>(null); // For AI (Puppeteer) Generation

  // New states for improvements
  const [progressStage, setProgressStage] = useState<'idle' | 'analyzing' | 'generating' | 'prompting' | 'complete'>('idle');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [selectedScenes, setSelectedScenes] = useState<Set<number>>(new Set());

  // Folder selection states
  const [availableFolders, setAvailableFolders] = useState<Array<{ folderName: string; imageCount?: number; scriptCount?: number; mtimeMs?: number }>>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isLoadingFolder, setIsLoadingFolder] = useState<boolean>(false);
  const [showFolderSelector, setShowFolderSelector] = useState<boolean>(false);

  // ✅ [NEW] Filtered and sorted folders for display
  const displayFolders = useMemo(() => {
    let filtered = showFavoritesOnly
      ? availableFolders.filter(folder => favorites.includes(folder.folderName))
      : availableFolders;

    // Ensure sorting by mtimeMs (descending) - Server now provides this
    return [...filtered].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
  }, [availableFolders, showFavoritesOnly, favorites]);

  const selectedStyleInfo = useMemo(() => STYLE_PRESETS.find((p) => p.id === selectedStyle), [selectedStyle]);
  const selectedEngineInfo = useMemo(() => ENGINE_PRESETS.find((p) => p.id === selectedEngine), [selectedEngine]);
  const selectedAspectInfo = useMemo(() => ASPECT_PRESETS.find((p) => p.id === selectedAspect), [selectedAspect]);

  // ✅ [NEW] Load available models
  useEffect(() => {
    const loadModels = async () => {
      setIsModelLoading(true);
      try {
        const models = await fetchAvailableModels();
        if (models.length > 0) setAvailableModels(models);
      } catch (e) {
        console.error("Failed to load models", e);
      } finally {
        setIsModelLoading(false);
      }
    };
    loadModels();
  }, []);

  const handleRefreshModels = async () => {
    setIsModelLoading(true);
    try {
      const models = await fetchAvailableModels();
      if (models.length > 0) setAvailableModels(models);
    } catch (e) {
      console.error("Failed to refresh models", e);
    } finally {
      setIsModelLoading(false);
    }
  };

  // [Persistence] Save/Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('cineboard-working-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.activeStoryId) setActiveStoryId(state.activeStoryId);
        if (state.selectedStyle) setSelectedStyle(state.selectedStyle);
        if (state.selectedEngine) setSelectedEngine(state.selectedEngine);
        if (state.selectedAspect) setSelectedAspect(state.selectedAspect);
        if (state.sceneCount) setSceneCount(state.sceneCount);
        if (state.scriptText) setScriptText(state.scriptText);
        if (state.characterNotes) setCharacterNotes(state.characterNotes);
        if (state.activeView) setActiveView(state.activeView);
      } catch (e) { console.error('Failed to restore working state', e); }
    }
  }, []);

  useEffect(() => {
    try {
      const savedDict = localStorage.getItem('cineboard-name-dictionary');
      if (savedDict) setNameDictionary(JSON.parse(savedDict));
      const savedCand = localStorage.getItem('cineboard-character-candidates');
      if (savedCand) setCandidateText(savedCand);
    } catch (e) {
      console.error('Failed to load cineboard data', e);
    }
  }, []);

  // ✅ [NEW] Load favorites from server
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/cineboard/favorites');
        if (response.ok) {
          const data = await response.json();
          setFavorites(data.favorites || []);
          console.log(`[Cineboard] ✅ Loaded ${data.favorites?.length || 0} favorites`);
        }
      } catch (e) {
        console.error('Failed to load favorites:', e);
      }
    };
    loadFavorites();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('cineboard-name-dictionary', JSON.stringify(nameDictionary));
      setDictionaryText(JSON.stringify(nameDictionary, null, 2));
    } catch (e) {
      console.error('Failed to save cineboard name dictionary', e);
    }
  }, [nameDictionary]);

  useEffect(() => {
    const parsed = candidateText.split(/[\n,]/).map((v) => v.trim()).filter((v) => v.length >= 2);
    setCandidateList(parsed);
    try {
      localStorage.setItem('cineboard-character-candidates', candidateText);
    } catch (e) {
      console.error('Failed to save candidates', e);
    }
  }, [candidateText]);

  useEffect(() => {
    const state = {
      selectedStyle, selectedEngine, selectedAspect, sceneCount,
      scriptText, characters, characterNotes, generationResult, activeView
    };
    localStorage.setItem('cineboard-working-state', JSON.stringify(state));
  }, [activeStoryId, selectedStyle, selectedEngine, selectedAspect, sceneCount, scriptText, characterNotes, activeView]);

  const handleStartEdit = (sceneNumber: number, field: 'ko' | 'en', currentVal: string) => {
    setEditingScene({ number: sceneNumber, field });
    setEditValue(currentVal);
  };

  const handleSaveEdit = () => {
    if (!editingScene || !generationResult) return;
    const updatedScenes = generationResult.scenes.map(s => {
      if (s.sceneNumber === editingScene.number) {
        return {
          ...s,
          [editingScene.field === 'ko' ? 'longPromptKo' : 'longPrompt']: editValue
        };
      }
      return s;
    });
    setGenerationResult({ ...generationResult, scenes: updatedScenes });
    setEditingScene(null);
  };

  const handleRegenerateBgm = async () => {
    if (!generationResult || isGenerating) return;
    setIsGenerating(true);
    setExtractionNotice('배경음악 프롬프트 재생성 중...');

    try {
      const prompt = `
[TASK: BGM PROMPT GENERATION]
Based on the following story title and script, create a perfect background music concept.
Output ONLY a JSON object for the "bgm" field.

TITLE: ${generationResult.title}
SCRIPT: ${generationResult.scriptBody.substring(0, 1000)}

[OUTPUT FORMAT]
{
  "trackTitle": "...",
  "koreanDescription": "...",
  "sunoPrompt": {
    "title": "...",
    "prompt": "..."
  }
}
`;
      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: targetService ?? 'GEMINI', prompt })
      });

      if (!response.ok) throw new Error('BGM 생성 실패');
      const data = await response.json();
      setGenerationResult({ ...generationResult, bgm: data });
      setExtractionNotice('BGM 프롬프트 재생성 완료');
    } catch (e) {
      console.error(e);
      alert('BGM 프롬프트 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const buildCineboardUserPrompt = () => {
    const styleInfo = selectedStyleInfo ? `${selectedStyleInfo.label} - ${selectedStyleInfo.description}. Technical: ${selectedStyleInfo.technicalKeywords}` : '스타일 미선택';
    const engineInfo = selectedEngineInfo ? `${selectedEngineInfo.label} - ${selectedEngineInfo.description}` : '엔진 미선택';
    const aspectInfo = selectedAspectInfo ? selectedAspectInfo.label : selectedAspect;
    const aspectRule = selectedAspect === '9:16' ? 'Every image prompt must include "--ar 9:16".' : 'Every image prompt must include "--ar 16:9".';

    const approvedCharacters = characters.filter((c) => approvedCharacterIds.has(c.id));
    const characterGuide = approvedCharacters.length > 0
      ? approvedCharacters.map((c) => {
        const note = characterNotes[c.id]?.trim();
        const profileParts = [
          c.hair ? `Hair: ${c.hair}` : '',
          c.eyes ? `Eyes: ${c.eyes}` : '',
          c.bodyType ? `Body: ${c.bodyType}` : '',
          c.distinctFeatures ? `Features: ${c.distinctFeatures}` : '',
          c.personality ? `Personality: ${c.personality}` : '',
          c.imageDescription ? `Concept: ${c.imageDescription}` : ''
        ].filter(Boolean);

        const detailedProfile = profileParts.join(', ');
        const imageNote = c.image ? '[Casting Image Attached]' : '';
        return `- CHARACTER_LOCK ${c.id}: Name(${c.name}), Role(${c.role}). Visual Profile: ${detailedProfile}. Additional Visual Lock: ${note || 'None'}. ${imageNote}`;
      }).join('\n')
      : 'None';

    return `
[TASK: CINEBOARD STORYBOARDING]
You are a professional storyboard director. Based on the script, create ${sceneCount} highly consistent scenes.

IDENTITY LOCK RULES:
- ETHNICITY LOCK: ALL characters must be depicted as KOREAN. This is a mandatory visual requirement for every prompt.
- Use the provided CHARACTER_LOCK IDs (A, B, C...) in your prompts.
- Strictly adhere to the Visual Lock descriptions for each character.
- Ensure characters look identical across all scenes they appear in.
- Character images are attached for reference; extract their facial features and clothing style.
- Aspect ratio: ${aspectInfo}. ${aspectRule}
- Output JSON ONLY (no markdown, no commentary).
- Do not use double quotes (") inside any JSON string values. Use single quotes or parentheses instead.

[STYLE]
${styleInfo}

[ENGINE]
${engineInfo}

[CHARACTERS]
${characterGuide}

[SCRIPT]
${scriptText}

[OUTPUT FORMAT]
{
  "title": "Extracted title",
  "scriptBody": "${scriptText.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
  "sceneCount": ${sceneCount},
  "characters": [
    {"id": "A", "name": "...", "role": "...", "notes": "..."}
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "summary": "Korean summary for this scene",
      "camera": "Shot type and camera movement",
      "shortPrompt": "English visual prompt",
      "shortPromptKo": "Korean visual prompt",
      "longPrompt": "Detailed English visual prompt",
      "longPromptKo": "Detailed Korean visual prompt"
    }
  ],
  "bgm": {
    "trackTitle": "영상 분위기에 어울리는 배경음악 제목",
    "koreanDescription": "곡의 분위기와 사용된 악기, 구성에 대한 상세한 한국어 설명",
    "sunoPrompt": {
      "title": "English track title",
      "prompt": "Detailed English musical prompt for Suno AI (style, mood, instruments, tempo)"
    }
  }
}
`;
  };

  const formatCineboardOutput = (result: CineboardResult, userPrompt: string, fullPrompt: string) => {
    const title = result.title?.trim() || '씨네보드 결과';
    const settingsSummary = [
      `STYLE: ${selectedStyleInfo?.label ?? '미선택'}`,
      `ENGINE: ${selectedEngineInfo?.label ?? '미선택'}`,
      `ASPECT: ${selectedAspectInfo?.label ?? selectedAspect}`,
      `SCENE COUNT: ${sceneCount}`,
      `SERVICE: ${targetService ?? 'GEMINI'}`
    ].join('\n');

    return [
      `CINEBOARD RESULT`,
      `TITLE: ${title}`,
      `DATE: ${new Date().toLocaleString()}`,
      settingsSummary,
      '',
      '=== SYSTEM PROMPT ===',
      systemPrompt,
      '',
      '=== USER PROMPT ===',
      userPrompt,
      '',
      '=== FULL PROMPT ===',
      fullPrompt,
      '',
      '=== ORIGINAL SCRIPT ===',
      scriptText,
      '',
      '=== RESULT JSON ===',
      JSON.stringify(result, null, 2)
    ].join('\n');
  };

  const applyCharacterExtraction = (source: string, reason: string) => {
    if (!source.trim()) {
      setCharacters(INITIAL_CHARACTERS);
      setApprovedCharacterIds(new Set(INITIAL_CHARACTERS.map((c) => c.id)));
      setExtractionNotice('');
      return;
    }
    const extracted = extractCharacters(source, candidateList);
    if (extracted.length > 0) {
      const corrected = extracted.map((c) => ({
        ...c,
        name: nameDictionary[c.name] ?? c.name,
      }));
      setCharacters(corrected);
      setApprovedCharacterIds(new Set(corrected.map((c) => c.id)));
      setCharacterNotes({});
      setExtractionNotice(`${reason} · ${corrected.length}명 추출됨`);
    } else {
      setCharacters(INITIAL_CHARACTERS);
      setApprovedCharacterIds(new Set(INITIAL_CHARACTERS.map((c) => c.id)));
      setExtractionNotice(`${reason} · 후보 없음`);
    }
  };

  useEffect(() => {
    setScriptLength(scriptText.length);
    if (scriptText.trim()) applyCharacterExtraction(scriptText, '자동 추출');
  }, [scriptText]);

  const handleSceneCount = (val: number) => setSceneCount(Math.min(100, Math.max(5, val)));
  const handleCharacterNoteChange = (id: string, val: string) => setCharacterNotes((prev) => ({ ...prev, [id]: val }));
  const handleCharacterNameChange = (id: string, val: string) => setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, name: val } : c)));
  const toggleCharacterApproval = (id: string) => setApprovedCharacterIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleCharacterImageUpload = (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? []);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = typeof reader.result === 'string' ? reader.result : '';
      setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, image: base64 } : c)));
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCharacterImage = (id: string) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, image: undefined } : c)));
  };

  const handleCopyJson = () => {
    if (!generationResult) return;
    const json = JSON.stringify(generationResult, null, 2);
    navigator.clipboard.writeText(json).then(() => alert('JSON이 클립보드에 복사되었습니다.')).catch(err => console.error('Copy failed', err));
  };

  const handleCopyPrompts = () => {
    if (!generationResult) return;
    const prompts = generationResult.scenes.map(s => `Scene ${s.sceneNumber}:\n${s.longPrompt}`).join('\n\n');
    navigator.clipboard.writeText(prompts).then(() => alert('모든 프롬프트가 클립보드에 복사되었습니다.')).catch(err => console.error('Copy failed', err));
  };

  const handleFindMissing = () => {
    if (!scriptText.trim()) {
      setMissingNotice('대본이 비어 있습니다.');
      return;
    }
    const currentNames = new Set(characters.map((c) => c.name));
    const missing = candidateList.filter((name) => scriptText.includes(name) && !currentNames.has(name));
    if (missing.length > 0) {
      const newChars: CharacterCard[] = missing.map((name, index) => ({
        id: String.fromCharCode(65 + characters.length + index),
        name: nameDictionary[name] ?? name,
        originalName: name,
        role: '누락 추출됨'
      }));
      setCharacters((prev) => [...prev, ...newChars]);
      setApprovedCharacterIds((prev) => {
        const next = new Set(prev);
        newChars.forEach((c) => next.add(c.id));
        return next;
      });
      setMissingNotice(`새로운 인물 ${missing.length}명을 찾았습니다: ${missing.join(', ')}`);
    } else {
      setMissingNotice('누락된 인물을 찾지 못했습니다.');
    }
  };

  const handleAICharacterAnalysis = async () => {
    if (!scriptText.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setExtractionNotice('AI 인물 분석 중...');

    try {
      const prompt = `
[TASK: CHARACTER ANALYSIS]
Analyze the following script and extract key characters with their detailed visual profiles and personalities.
Output ONLY a JSON array of character objects.

[SCRIPT]
${scriptText}

[OUTPUT FORMAT]
[
  {
    "name": "Character Name",
    "role": "Role in the story",
    "personality": "Psychological traits, vibes, tone of voice",
    "visualProfile": {
      "hair": "Detailed hairstyle and color (English)",
      "eyes": "Eye shape and mood (English)",
      "bodyType": "Body shape, height, posture (English)",
      "distinctFeatures": "Scars, beauty marks, tattoos, unique accessories (English)",
      "visualVibe": "Overall visual atmosphere (English)"
    }
  }
]
`;
      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: targetService ?? 'GEMINI',
          prompt
        })
      });

      if (!response.ok) throw new Error('AI 분석 실패');
      const data = await response.json();

      const analyzedChars = Array.isArray(data) ? data : (data.characters || []);
      if (analyzedChars.length > 0) {
        const newCharacters: CharacterCard[] = analyzedChars.map((c: any, index: number) => ({
          id: String.fromCharCode(65 + index),
          name: c.name,
          originalName: c.name,
          role: c.role || '추출됨',
          personality: c.personality || '',
          hair: c.visualProfile?.hair || '',
          eyes: c.visualProfile?.eyes || '',
          bodyType: c.visualProfile?.bodyType || '',
          distinctFeatures: c.visualProfile?.distinctFeatures || '',
          imageDescription: c.visualProfile?.visualVibe || ''
        }));

        const newNotes: Record<string, string> = {};
        analyzedChars.forEach((c: any, index: number) => {
          const profile = c.visualProfile;
          const combinedNote = [
            profile?.hair,
            profile?.eyes,
            profile?.bodyType,
            profile?.distinctFeatures,
            profile?.visualVibe
          ].filter(Boolean).join(', ');
          newNotes[String.fromCharCode(65 + index)] = combinedNote;
        });

        setCharacters(newCharacters);
        setApprovedCharacterIds(new Set(newCharacters.map(c => c.id)));
        setCharacterNotes(newNotes);
        setExtractionNotice(`AI 분석 완료 · ${newCharacters.length}명 추출됨`);
      }
    } catch (error) {
      console.error('AI Character Analysis failed:', error);
      setExtractionNotice('AI 분석 실패. 로컬 추출로 대체합니다.');
      applyCharacterExtraction(scriptText, '로컬 추출');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEnhanceCharacterNotes = async () => {
    const approvedChars = characters.filter(c => approvedCharacterIds.has(c.id));
    if (approvedChars.length === 0 || isAnalyzing) return;

    setIsAnalyzing(true);
    setExtractionNotice('특징 영문 변환 중...');

    try {
      const charData = approvedChars.map(c => ({
        id: c.id,
        name: c.name,
        note: characterNotes[c.id] || ''
      }));

      const prompt = `
[TASK: VISUAL DESCRIPTOR ENHANCEMENT]
Convert the following character notes (mostly Korean) into detailed English visual descriptors for AI image generation (Stable Diffusion/Midjourney style).
Ensure each character has a unique, consistent look.
Output ONLY a JSON object mapping character IDs to their new English descriptors.

[CHARACTERS]
${JSON.stringify(charData, null, 2)}

[OUTPUT FORMAT]
{
  "A": "detailed English descriptor...",
  "B": "..."
}
`;
      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: targetService ?? 'GEMINI',
          prompt
        })
      });

      if (!response.ok) throw new Error('변환 실패');
      const data = await response.json();

      if (data && typeof data === 'object') {
        setCharacterNotes(prev => ({
          ...prev,
          ...data
        }));
        setExtractionNotice('특징 영문 변환 완료');
      }
    } catch (error) {
      console.error('Enhance character notes failed:', error);
      setExtractionNotice('변환 실패');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateSceneImage = async (sceneNumber: number) => {
    if (!generationResult) return;
    const sceneIndex = generationResult.scenes.findIndex(s => s.sceneNumber === sceneNumber);
    if (sceneIndex === -1) return;

    const scene = generationResult.scenes[sceneIndex];
    if (aiForwardingId === `ai-${sceneNumber}`) return;

    setAiForwardingId(`ai-${sceneNumber}`);

    try {
      const service = 'GEMINI'; // Only Gemini supports capture currently

      // ✅ 나이 및 의상 정보 조합
      let enrichedPrompt = scene.longPrompt;
      const ageInfo = scene.age ? scene.age : '';
      const outfitInfo = scene.outfit ? scene.outfit : '';

      if (ageInfo || outfitInfo) {
        const additions = [ageInfo, outfitInfo].filter(Boolean).join(' ');
        enrichedPrompt = `(${additions}) ${scene.longPrompt}`;
        console.log(`[Cineboard] Enriched prompt for AI Generate: ${enrichedPrompt}`);
      }

      const response = await fetch('http://localhost:3002/api/image/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          service,
          storyId: activeStoryId || generatedFolderName || generationResult.title || 'cineboard',
          sceneNumber: scene.sceneNumber,
          autoCapture: true,
          title: generationResult.title
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI 생성 실패');
      }

      const data = await response.json();
      if (data.success && data.filename) {
        const resolvedStoryId = data.storyId || activeStoryId || generatedFolderName || generationResult.title || 'cineboard';
        // 서버에서 전달해준 URL을 우선 사용 (하이브리드 경로 지원)
        const imageUrl = data.url
          ? `http://localhost:3002${data.url}`
          : `http://localhost:3002/generated_scripts/대본폴더/${resolvedStoryId}/images/${data.filename}`;

        const finalScenes = [...generationResult.scenes];
        finalScenes[sceneIndex] = { ...scene, imageUrl };
        setGenerationResult({ ...generationResult, scenes: finalScenes });
        showToast(`장면 ${sceneNumber} AI 생성이 완료되었습니다.`, 'success');
      } else {
        throw new Error('이미지 파일 경로를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('AI image generation failed:', error);
      const msg = error instanceof Error ? error.message : '알 수 없는 오류';
      alert(`장면 ${sceneNumber} AI 생성 실패: ${msg}`);
    } finally {
      setAiForwardingId(null);
    }
  };

  // ✅ [NEW] Native Image Generation (Direct API)
  const handleGenerateImageNative = async (sceneNumber: number) => {
    if (!generationResult || generatingId) return;
    const sceneIndex = generationResult.scenes.findIndex(s => s.sceneNumber === sceneNumber);
    if (sceneIndex === -1) return;

    const scene = generationResult.scenes[sceneIndex];
    const promptId = `native-${sceneNumber}`;
    setGeneratingId(promptId);

    try {
      // ✅ 나이 및 의상 정보 조합
      let enrichedPrompt = scene.longPrompt;
      const ageInfo = scene.age ? scene.age : '';
      const outfitInfo = scene.outfit ? scene.outfit : '';

      if (ageInfo || outfitInfo) {
        const additions = [ageInfo, outfitInfo].filter(Boolean).join(' ');
        enrichedPrompt = `(${additions}) ${scene.longPrompt}`;
      }

      const safetySettings = noGuard ? [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
      ] : undefined;

      let result: any;
      if (imageModel.toLowerCase().includes('imagen')) {
        result = await generateImageWithImagen(enrichedPrompt, "", { aspectRatio: selectedAspect === '9:16' ? "9:16" : "16:9", model: imageModel }, safetySettings);
      } else {
        result = await generateImage(enrichedPrompt, { aspectRatio: selectedAspect === '9:16' ? "9:16" : "16:9", model: imageModel }, safetySettings);
      }

      let base64Image: string | null = null;
      if (result?.generatedImages?.[0]?.image?.imageBytes) {
        base64Image = result.generatedImages[0].image.imageBytes;
      } else if (result?.images?.[0]) {
        base64Image = result.images[0];
      }

      if (base64Image) {
        const folderName = activeStoryId || generatedFolderName || generationResult.title || 'cineboard';
        const saveResult = await saveImageToDisk(
          base64Image,
          enrichedPrompt,
          folderName,
          sceneNumber,
          generationResult.title
        );

        // Save to IndexedDB (as Blob) for history sync
        const blob = await fetch(`data:image/png;base64,${base64Image}`).then(res => res.blob());
        await setBlob(crypto.randomUUID(), blob);

        // ✅ 서버에서 전달해준 URL을 우선 사용 (하이브리드 경로 지원)
        const imageUrl = saveResult.url
          ? `http://localhost:3002${saveResult.url}`
          : `http://localhost:3002/generated_scripts/대본폴더/${folderName}/images/${saveResult.filename.split('/').pop()}`;

        const finalScenes = [...generationResult.scenes];
        finalScenes[sceneIndex] = { ...scene, imageUrl };
        setGenerationResult({ ...generationResult, scenes: finalScenes });
        showToast(`장면 ${sceneNumber} 이미지 생성이 완료되었습니다.`, 'success');
      } else {
        throw new Error("이미지 데이터를 받지 못했습니다. 안전 정책 차단 여부를 확인하세요.");
      }
    } catch (error: any) {
      console.error("Native Generation Failed:", error);
      alert(`이미지 생성 실패: ${error.message || "알 수 없는 오류"}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateAllImages = async () => {
    if (!generationResult || isBatchGenerating) return;
    if (!confirm(`${generationResult.scenes.length}개 장면의 이미지를 순차적으로 생성하시겠습니까?`)) return;

    setIsBatchGenerating(true);
    try {
      for (const scene of generationResult.scenes) {
        if (scene.imageUrl) continue; // Skip already generated
        await handleGenerateSceneImage(scene.sceneNumber);
      }
      alert('모든 이미지 생성이 완료되었습니다.');
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const handleRefineVideoPrompt = async (sceneNumber: number) => {
    if (!generationResult) return;
    const sceneIndex = generationResult.scenes.findIndex(s => s.sceneNumber === sceneNumber);
    if (sceneIndex === -1) return;

    const scene = generationResult.scenes[sceneIndex];
    if (scene.isVideoPromptGenerating) return;

    // Set loading state for prompt only
    const updatedScenes = [...generationResult.scenes];
    updatedScenes[sceneIndex] = { ...scene, isVideoPromptGenerating: true };
    setGenerationResult({ ...generationResult, scenes: updatedScenes });

    try {
      const response = await fetch('http://localhost:3002/api/video/refine-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: scene.scriptRef,
          scriptLine: scene.scriptLine,
          action: scene.action,
          emotion: scene.emotion,
          visualPrompt: scene.longPrompt
        })
      });

      if (!response.ok) throw new Error('프롬프트 분석 실패');
      const data = await response.json();

      const finalScenes = [...generationResult.scenes];
      finalScenes[sceneIndex] = {
        ...scene,
        videoPrompt: data.refinedPrompt,
        isVideoPromptGenerating: false
      };
      setGenerationResult({ ...generationResult, scenes: finalScenes });
      showToast(`${sceneNumber}번 장면의 비디오 지시어가 생성되었습니다.`, 'success');
    } catch (error) {
      console.error('Video prompt refinement failed:', error);
      const resetScenes = [...generationResult.scenes];
      resetScenes[sceneIndex] = { ...scene, isVideoPromptGenerating: false };
      setGenerationResult({ ...generationResult, scenes: resetScenes });
      alert('비디오 지시어 생성에 실패했습니다.');
    }
  };

  const handleGenerateSceneVideo = async (sceneNumber: number) => {
    if (!generationResult) return;
    const sceneIndex = generationResult.scenes.findIndex(s => s.sceneNumber === sceneNumber);
    if (sceneIndex === -1) return;

    const scene = generationResult.scenes[sceneIndex];
    if (scene.isVideoGenerating || !scene.videoPrompt) return;

    const updatedScenes = [...generationResult.scenes];
    updatedScenes[sceneIndex] = { ...scene, isVideoGenerating: true };
    setGenerationResult({ ...generationResult, scenes: updatedScenes });

    try {
      const response = await fetch('http://localhost:3002/api/video/generate-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refinedPrompt: scene.videoPrompt, // 수정된 프롬프트 전송
          storyId: activeStoryId || generatedFolderName || 'cineboard',
          storyTitle: generationResult.title,
          sceneNumber: scene.sceneNumber
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '비디오 생성 실패');
      }

      const data = await response.json();

      const finalScenes = [...generationResult.scenes];
      const resolvedUrl = data.url ? data.url : undefined;
      finalScenes[sceneIndex] = { ...scene, videoUrl: resolvedUrl, isVideoGenerating: false };
      setGenerationResult({ ...generationResult, scenes: finalScenes });

      if (data.url) {
        showToast(`${sceneNumber}번 장면의 비디오 생성이 완료되었습니다.`, 'success');
      } else if (data.message) {
        showToast(data.message, 'info');
      }
    } catch (error) {
      console.error('Scene video generation failed:', error);
      alert(`비디오 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      const resetScenes = [...generationResult.scenes];
      resetScenes[sceneIndex] = { ...scene, isVideoGenerating: false };
      setGenerationResult({ ...generationResult, scenes: resetScenes });
    }
  };

  const handleGenerateCineboard = async () => {
    if (isGenerating) return;
    if (!scriptText.trim()) { alert('대본이 비어 있습니다.'); return; }

    const approvedCharacters = characters.filter((c) => approvedCharacterIds.has(c.id));
    if (approvedCharacters.length === 0) {
      alert('승인된 인물이 최소 한 명 이상 있어야 합니다.');
      return;
    }

    setIsGenerating(true);
    setGenerationError('');
    setProgressStage('analyzing');
    setProgressMessage('인물 분석 중...');

    try {
      // Split script for anchoring
      const scriptChunks = splitScriptForScenes(scriptText, sceneCount);

      setProgressStage('generating');
      setProgressMessage('씬 생성 중...');

      const userPrompt = buildCineboardUserPrompt();
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
      const service = targetService ?? 'GEMINI';

      // Prepare casting images for upload
      const castingFiles = characters
        .filter(c => approvedCharacterIds.has(c.id) && c.image)
        .map(c => ({ base64: c.image }));

      setProgressStage('prompting');
      setProgressMessage('프롬프트 작성 중...');

      const response = await fetch('http://localhost:3002/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service,
          prompt: fullPrompt,
          files: castingFiles
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '씨네보드 생성에 실패했습니다.');
      }
      const result = (await response.json()) as CineboardResult;

      // Extract unique folder name from server response
      if (result.scripts && result.scripts[0]?._folderName) {
        setGeneratedFolderName(result.scripts[0]._folderName);
        setActiveStoryId(result.scripts[0]._folderName);
      }

      // Enrich scenes with additional data
      const enrichedScenes = result.scenes.map((scene, index) => ({
        ...scene,
        scriptRef: scriptChunks[index] || '',
        shotType: extractShotType(scene.camera),
        dialogueRefined: refineDialogue(scene.summary),
        isSelected: false
      }));

      const enrichedResult = { ...result, scenes: enrichedScenes };

      setGenerationResult(enrichedResult);
      setActiveView('result');
      setProgressStage('complete');
      setProgressMessage('완료!');

      const formattedContent = formatCineboardOutput(enrichedResult, userPrompt, fullPrompt);
      const baseTitle = result.title?.trim() || (scriptFileName ? scriptFileName.replace(/\.[^/.]+$/, '') : '씨네보드_결과');
      await fetch('http://localhost:3002/api/save-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: baseTitle,
          content: formattedContent,
          service,
          folderName: result.scripts?.[0]?._folderName || (result as any)._folderName // ✅ [수정] 생성된 고유 폴더명 전달
        })
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '알 수 없는 오류';
      setGenerationError(msg);
      setProgressStage('idle');
      setProgressMessage('');
      alert(`씨네보드 생성 실패: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setSelectedStyle('classic'); setSelectedEngine('nano'); setSelectedAspect('16:9'); setSceneCount(30);
    setScriptText(''); setScriptFileName(''); setScriptLength(0);
    setCharacters(INITIAL_CHARACTERS); setApprovedCharacterIds(new Set(INITIAL_CHARACTERS.map(c => c.id)));
    setCharacterNotes({}); setMissingNotice(''); setExtractionNotice('');
    setDictionaryNotice(''); setCandidateNotice(''); setIsDragging(false);
    setGenerationResult(null); setGeneratedFolderName(''); setActiveStoryId(null); setGenerationError(''); setActiveView('config');
    setProgressStage('idle'); setProgressMessage(''); setSelectedScenes(new Set());
  };

  // Batch download all images as ZIP
  const handleBatchDownloadImages = async () => {
    if (!generationResult) return;

    const scenesWithImages = generationResult.scenes.filter(s => s.imageUrl);
    if (scenesWithImages.length === 0) {
      alert('다운로드할 이미지가 없습니다.');
      return;
    }

    try {
      const zip = new JSZip();
      const folder = zip.folder(generationResult.title || 'cineboard_images');

      // Fetch and add each image to ZIP
      for (const scene of scenesWithImages) {
        if (!scene.imageUrl) continue;

        try {
          const response = await fetch(scene.imageUrl);
          const blob = await response.blob();
          const filename = `S${String(scene.sceneNumber).padStart(2, '0')}_${scene.shotType || 'scene'}.jpg`;
          folder?.file(filename, blob);
        } catch (err) {
          console.error(`Failed to download scene ${scene.sceneNumber}:`, err);
        }
      }

      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generationResult.title || 'cineboard'}_images.zip`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`${scenesWithImages.length}개 이미지가 다운로드되었습니다.`);
    } catch (error) {
      console.error('Batch download failed:', error);
      alert('일괄 다운로드 실패');
    }
  };

  // Download single scene image
  const handleDownloadSceneImage = async (scene: CineboardScene) => {
    if (!scene.imageUrl) return;

    try {
      const response = await fetch(scene.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `S${String(scene.sceneNumber).padStart(2, '0')}_${scene.shotType || 'scene'}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('이미지 다운로드 실패');
    }
  };

  // Generate production report
  const handleGenerateProductionReport = () => {
    if (!generationResult) return;

    const approvedChars = characters.filter(c => approvedCharacterIds.has(c.id));
    const date = new Date().toLocaleDateString('ko-KR');

    let report = `# 🎬 프로덕션 리포트\n\n`;
    report += `## 프로젝트 정보\n`;
    report += `- **제목**: ${generationResult.title}\n`;
    report += `- **생성일**: ${date}\n`;
    report += `- **스타일**: ${selectedStyleInfo?.label} (${selectedStyleInfo?.description})\n`;
    report += `- **엔진**: ${selectedEngineInfo?.label}\n`;
    report += `- **비율**: ${selectedAspectInfo?.label}\n`;
    report += `- **총 씬 수**: ${generationResult.scenes.length}\n\n`;

    report += `## 등장 인물\n\n`;
    approvedChars.forEach(char => {
      report += `### ${char.id}. ${char.name}\n`;
      report += `- **역할**: ${char.role}\n`;
      if (characterNotes[char.id]) {
        report += `- **특징**: ${characterNotes[char.id]}\n`;
      }
      report += `\n`;
    });

    if (generationResult.bgm) {
      report += `## 배경음악\n\n`;
      report += `- **트랙 제목**: ${generationResult.bgm.trackTitle}\n`;
      report += `- **설명**: ${generationResult.bgm.koreanDescription}\n`;
      report += `- **Suno AI 프롬프트**:\n\`\`\`json\n${JSON.stringify(generationResult.bgm.sunoPrompt, null, 2)}\n\`\`\`\n\n`;
    }

    report += `## 씬별 상세 정보\n\n`;
    generationResult.scenes.forEach(scene => {
      report += `### Scene ${scene.sceneNumber} - ${scene.shotType || scene.camera}\n\n`;
      report += `**요약**: ${scene.summary}\n\n`;
      report += `**카메라**: ${scene.camera}\n\n`;

      if (scene.scriptRef) {
        report += `**원본 대본**:\n\`\`\`\n${scene.scriptRef}\n\`\`\`\n\n`;
      }

      report += `**한글 프롬프트**:\n${scene.shortPromptKo}\n\n`;
      report += `**영문 프롬프트 (AI)**:\n${scene.longPrompt}\n\n`;

      if (scene.dialogueRefined) {
        report += `**정제된 대사**: ${scene.dialogueRefined}\n\n`;
      }

      report += `---\n\n`;
    });

    // Download as TXT file
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generationResult.title || 'cineboard'}_production_report.md`;
    a.click();
    URL.revokeObjectURL(url);

    alert('프로덕션 리포트가 다운로드되었습니다.');
  };

  // Toggle scene selection for shorts conversion
  const handleToggleSceneSelection = (sceneNumber: number) => {
    if (!generationResult) return;
    const updatedScenes = generationResult.scenes.map(s =>
      s.sceneNumber === sceneNumber ? { ...s, isSelected: !s.isSelected } : s
    );
    setGenerationResult({ ...generationResult, scenes: updatedScenes });
  };

  const handleUpdateSceneSettings = (sceneNumber: number, field: 'age' | 'outfit', value: string) => {
    if (!generationResult) return;
    const updatedScenes = generationResult.scenes.map(s =>
      s.sceneNumber === sceneNumber ? { ...s, [field]: value } : s
    );
    setGenerationResult({ ...generationResult, scenes: updatedScenes });
  };

  // Convert selected scenes to shorts (9:16)
  const handleConvertToShorts = async () => {
    if (!generationResult || selectedScenes.size === 0) {
      alert('변환할 씬을 선택해주세요.');
      return;
    }

    if (!confirm(`선택한 ${selectedScenes.size}개 씬을 9:16 쇼츠로 변환하시겠습니까?`)) {
      return;
    }

    try {
      // Change aspect ratio to 9:16
      setSelectedAspect('9:16');

      // Filter selected scenes
      const selectedSceneObjects = generationResult.scenes.filter(s =>
        selectedScenes.has(s.sceneNumber)
      );

      // Re-generate images for selected scenes with 9:16 aspect
      for (const scene of selectedSceneObjects) {
        await handleGenerateSceneImage(scene.sceneNumber);
      }

      alert(`${selectedScenes.size}개 씬이 쇼츠로 변환되었습니다.`);
    } catch (error) {
      console.error('Shorts conversion failed:', error);
      alert('쇼츠 변환 실패');
    }
  };

  // Load available folders (Step 2)
  // ✅ [NEW] Toggle favorites filter
  const toggleFavoritesFilter = () => {
    setShowFavoritesOnly(!showFavoritesOnly);
  };

  // ✅ [NEW] Add to favorites
  const addToFavorites = async (folderName: string) => {
    try {
      const response = await fetch('http://localhost:3002/api/cineboard/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderName })
      });

      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
        console.log(`[Cineboard] ⭐ Added to favorites: ${folderName}`);
      }
    } catch (e) {
      console.error('Failed to add favorite:', e);
    }
  };

  // ✅ [NEW] Remove from favorites
  const removeFromFavorites = async (folderName: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/cineboard/favorites/${encodeURIComponent(folderName)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        setFavorites(data.favorites || []);
        console.log(`[Cineboard] 🗑️ Removed from favorites: ${folderName}`);
      }
    } catch (e) {
      console.error('Failed to remove favorite:', e);
    }
  };

  // ✅ [NEW] Check if folder is favorite
  const isFavorite = (folderName: string) => favorites.includes(folderName);

  const handleLoadFolders = async () => {
    try {
      const [imageFolders, scriptFolders] = await Promise.all([
        fetch('http://localhost:3002/api/images/story-folders').then(r => r.ok ? r.json() : []),
        fetch('http://localhost:3002/api/scripts/story-folders').then(r => r.ok ? r.json() : [])
      ]);
      const combinedFolders = [...imageFolders, ...scriptFolders]
        .reduce((acc: Array<{ folderName: string; imageCount?: number; scriptCount?: number; mtimeMs?: number }>, folder) => {
          const existing = acc.find(f => f.folderName === folder.folderName);
          if (existing) {
            existing.imageCount = (existing.imageCount || 0) + (folder.imageCount || 0);
            existing.scriptCount = (existing.scriptCount || 0) + (folder.scriptCount || 0);
            existing.mtimeMs = Math.max(existing.mtimeMs || 0, folder.mtimeMs || 0);
          } else {
            acc.push({
              ...folder,
              imageCount: folder.imageCount || 0,
              scriptCount: folder.scriptCount || 0,
              mtimeMs: folder.mtimeMs || 0
            });
          }
          return acc;
        }, []);

      setAvailableFolders(combinedFolders);
      setShowFolderSelector(true);
    } catch (error) {
      console.error('Failed to load folders:', error);
      alert('폴더 목록을 불러오는데 실패했습니다.');
    }
  };

  // Select and load folder data (Step 3)
  const handleSelectFolder = async (folderName: string) => {
    setSelectedFolder(folderName);
    setActiveStoryId(folderName);
    setIsLoadingFolder(true);
    try {
      await handleLoadFolderData(folderName);
      setShowFolderSelector(false);
      setActiveView('result');
    } catch (error) {
      console.error('Failed to load folder data:', error);
      alert('폴더 데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingFolder(false);
    }
  };

  // Load folder data - script + images (Step 4)
  const handleLoadFolderData = async (folderName: string) => {
    // 1. Load script file (required)
    const scriptResponse = await fetch(`http://localhost:3002/api/scripts/by-folder/${folderName}`);
    let scriptContent = '';
    let scriptScenes: any[] = []; // 대본 파일에서 추출한 scenes 배열

    if (!scriptResponse.ok) {
      console.warn(`⚠️ Failed to load script for folder ${folderName}:`, scriptResponse.status);
      setScriptText('');
      setScriptFileName('');
      alert(`대본 파일을 찾을 수 없습니다 (${folderName}).`);
      return;
    }

    const scriptData = await scriptResponse.json();
    scriptContent = scriptData.content;
    setScriptText(extractPureScript(scriptContent));
    setScriptFileName(scriptData.scriptFile);

    if (Array.isArray(scriptData.parsedScenes) && scriptData.parsedScenes.length > 0) {
      scriptScenes = scriptData.parsedScenes;
    } else {
      // ✅ [Fallback] 대본 파일에서 JSON 부분 추출하여 scenes 파싱
      try {
        // 1. "=== RESULT JSON ===" 이후의 JSON 블록 찾기
        const jsonMatch = scriptContent.match(/=== RESULT JSON ===\s*([\s\S]*)/);
        let parsed: any = null;

        if (jsonMatch && jsonMatch[1]) {
          const jsonStr = jsonMatch[1].trim();
          parsed = JSON.parse(jsonStr);
        } else {
          // 2. 전체 내용을 JSON으로 파싱 시도
          try {
            parsed = JSON.parse(scriptContent.trim());
          } catch (e) {
            // JSON이 아님
          }
        }

        if (parsed) {
          // scripts 배열 안의 scenes 또는 최상위 scenes 확인
          if (parsed.scripts && parsed.scripts[0]?.scenes) {
            scriptScenes = parsed.scripts[0].scenes;
          } else if (parsed.scenes) {
            scriptScenes = parsed.scenes;
          } else if (Array.isArray(parsed)) {
            scriptScenes = parsed;
          }
          console.log(`✅ Parsed ${scriptScenes.length} scenes from script content`);
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse scenes from script file:', parseError);
      }
    }

    const normalizedScenes = scriptScenes.map((scriptScene: any) => ({
      ...scriptScene,
      longPrompt: scriptScene.longPrompt || scriptScene.imagePrompt || scriptScene.shortPrompt || '프롬프트 정보가 없습니다.',
      longPromptKo: scriptScene.longPromptKo || scriptScene.shortPromptKo || ''
    }));

    if (normalizedScenes.length === 0) {
      alert('대본에서 장면 정보를 찾을 수 없습니다.');
      return;
    }

    // 2. Load images (optional - 이미지가 없어도 괜찮음)
    let imagesBySceneNumber: Map<number, any> = new Map();
    try {
      const imagesResponse = await fetch(`http://localhost:3002/api/images/by-story/${folderName}`);
      if (imagesResponse.ok) {
        const images = await imagesResponse.json();
        console.log(`✅ Found ${images.length} images for folder ${folderName}`);

        // 이미지를 sceneNumber로 매핑
        images.forEach((img: any) => {
          const sceneNum = img.sceneNumber || parseSceneFromFilename(img.filename);
          if (sceneNum) imagesBySceneNumber.set(sceneNum, img);
        });
      } else {
        console.log(`⚠️ No images found for folder ${folderName} (this is OK)`);
      }
    } catch (error) {
      console.warn('Failed to load images, but continuing with script data:', error);
    }

    // 3. 대본 scenes 기반으로 CineboardScene 생성 (이미지는 매칭 시에만 표시)
    const scenes: CineboardScene[] = normalizedScenes.map((scriptScene: any) => {
      const sceneNum = scriptScene.sceneNumber;

      // 해당 sceneNumber의 이미지가 있는지 확인
      const matchedImage = imagesBySceneNumber.get(sceneNum);

      if (matchedImage) {
        console.log(`✅ Matched image for scene ${sceneNum}: ${matchedImage.filename}`);
      } else {
        console.log(`ℹ️ No image for scene ${sceneNum} (will show prompt only)`);
      }

      return {
        sceneNumber: sceneNum,
        summary: scriptScene.summary || `Scene ${sceneNum}`,
        camera: scriptScene.camera || 'Unknown',
        shortPrompt: scriptScene.shortPrompt || '',
        shortPromptKo: scriptScene.shortPromptKo || '',
        longPrompt: scriptScene.longPrompt || '프롬프트 정보가 없습니다.',
        longPromptKo: scriptScene.longPromptKo || '',
        imageUrl: matchedImage ? (matchedImage.isUnifiedPath
          ? `/generated_scripts/${matchedImage.filename}`  // 통일 경로: 대본폴더/{storyId}/images/{filename}
          : `/generated_scripts/images/${matchedImage.filename}`) : '', // 기존 경로: images/{storyId}/{filename}
        shotType: extractShotType(scriptScene.camera || ''),
        dialogueRefined: refineDialogue(scriptScene.summary || ''),
        scriptRef: '',
        isSelected: false
      };
    });

    if (scenes.length === 0) {
      alert('대본으로 장면을 구성할 수 없습니다.');
      return;
    }

    // ✅ [NEW] 이미지 유무에 따른 안내 메시지
    const hasImages = scenes.some(scene => scene.imageUrl && scene.imageUrl.trim() !== '');
    if (!hasImages) {
      console.log(`ℹ️ No images found for folder ${folderName} - showing prompts only`);
      // 자동 알림이 너무 많으므로 콘솔에만 로그 남김
    } else {
      const imageCount = scenes.filter(scene => scene.imageUrl && scene.imageUrl.trim() !== '').length;
      console.log(`✅ Found ${imageCount} images for ${scenes.length} scenes in folder ${folderName}`);
    }

    // 4. Split script for anchoring
    if (scriptContent && scenes.length > 0) {
      const scriptChunks = splitScriptForScenes(scriptContent, scenes.length);
      scenes.forEach((scene, index) => {
        scene.scriptRef = scriptChunks[index] || '';
      });
    }

    // 5. Update generation result
    const result: CineboardResult = {
      title: folderName.replace(/_/g, ' '),
      scriptBody: scriptContent,
      sceneCount: scenes.length,
      characters: [],
      scenes,
      scripts: [{ _folderName: folderName } as any]
    };
    setGenerationResult(result);
    setGeneratedFolderName(folderName);
    setActiveStoryId(folderName);
    setActiveView('result'); // ✅ 결과 화면으로 전환
    console.log(`✅ Loaded ${scenes.length} scenes from folder: ${folderName}`);
  };

  const systemPrompt = useMemo(() => {
    const styleInfo = selectedStyleInfo ? `${selectedStyleInfo.label} - ${selectedStyleInfo.description}` : '스타일 미선택';
    const engineInfo = selectedEngineInfo ? selectedEngineInfo.label : '엔진 미선택';
    const aspectInfo = selectedAspectInfo ? selectedAspectInfo.label : '비율 미선택';
    const approvedChars = characters.filter((c) => approvedCharacterIds.has(c.id));
    const characterLines = Object.entries(characterNotes)
      .filter(([id, note]) => approvedCharacterIds.has(id) && note.trim().length > 0)
      .map(([id, note]) => `- ${id}(${characters.find(c => c.id === id)?.name}): ${note.trim()}`).join('\n');

    return [
      `시네보드 시스템 프롬프트`,
      `스타일: ${styleInfo}`, `엔진: ${engineInfo}`, `비율: ${aspectInfo}`, `씬 개수: ${sceneCount}`,
      approvedChars.length > 0 ? `승인된 인물: ${approvedChars.map((c) => `${c.id}(${c.name})`).join(', ')}` : '승인된 인물: 없음',
      characterLines ? `인물 특징 고정:\n${characterLines}` : '인물 특징 고정: 없음'
    ].join('\n');
  }, [selectedStyleInfo, selectedEngineInfo, selectedAspectInfo, sceneCount, characterNotes, characters, approvedCharacterIds]);

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-1">
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-slate-800 pb-2 bg-slate-950/80 backdrop-blur">
        <button onClick={() => setActiveView('config')} className={`px-4 py-2 text-sm font-semibold transition ${activeView === 'config' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-slate-300'}`}>설정 및 대본</button>
        <button onClick={() => setActiveView('result')} disabled={!generationResult} className={`px-4 py-2 text-sm font-semibold transition ${activeView === 'result' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-slate-300 disabled:opacity-30'}`}>생성 결과</button>

        {/* ✅ [이동/확대] 불러오기 버튼 */}
        <button
          onClick={handleLoadFolders}
          className="ml-2 px-6 py-2 text-base font-bold text-white bg-purple-600/80 hover:bg-purple-500 rounded-xl border border-purple-400/50 shadow-lg shadow-purple-500/20 transition-all flex items-center gap-2 active:scale-95"
        >
          <span className="text-xl">📁</span>
          <span>불러오기</span>
        </button>
      </div>

      {/* Folder Selection Modal - 어떤 뷰에서든 접근 가능 */}
      {showFolderSelector && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-purple-400">📁 작업 폴더 선택</h3>
              <div className="flex items-center gap-3">
                {/* ✅ [NEW] Favorites Toggle */}
                <button
                  onClick={toggleFavoritesFilter}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition flex items-center gap-1 ${showFavoritesOnly
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                    : 'bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-300'
                    }`}
                >
                  <span>{showFavoritesOnly ? '⭐' : '☆'}</span>
                  <span>{showFavoritesOnly ? '즐겨찾기만' : '전체 보기'}</span>
                </button>
                <button onClick={() => setShowFolderSelector(false)} className="text-slate-400 hover:text-white transition">✕</button>
              </div>
            </div>
            {isLoadingFolder ? (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-slate-400">폴더 데이터를 불러오는 중...</p>
              </div>
            ) : displayFolders.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <p>
                  {showFavoritesOnly
                    ? '즐겨찾기한 폴더가 없습니다.'
                    : '저장된 작업 폴더가 없습니다.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {displayFolders.map((folder) => (
                  <div key={folder.folderName}
                    onClick={() => handleSelectFolder(folder.folderName)}
                    className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-purple-500 transition-all text-left group cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleSelectFolder(folder.folderName);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📁</span>
                        <div>
                          <p className="font-semibold text-white group-hover:text-purple-300 transition">{folder.folderName.replace(/_/g, ' ')}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span>{folder.imageCount} 이미지</span>
                            {folder.scriptCount > 0 ? (
                              <span className="text-emerald-400">✅ 대본 있음</span>
                            ) : (
                              <span className="text-amber-400">⚠️ 대본 없음</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* ✅ [NEW] Favorite Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // 폴더 선택 이벤트 방지
                            isFavorite(folder.folderName)
                              ? removeFromFavorites(folder.folderName)
                              : addToFavorites(folder.folderName);
                          }}
                          className={`p-1.5 rounded-lg transition ${isFavorite(folder.folderName)
                            ? 'text-yellow-400 hover:text-yellow-300'
                            : 'text-slate-500 hover:text-yellow-400'
                            }`}
                          title={isFavorite(folder.folderName) ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                        >
                          {isFavorite(folder.folderName) ? '⭐' : '☆'}
                        </button>
                        <span className="text-slate-500 group-hover:text-purple-400 transition">→</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'config' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 items-stretch">
          <div className="xl:col-span-7 space-y-4 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white">씨네보드 설정</h3>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">비주얼 스타일</p>
                  <div className="grid grid-cols-2 gap-2">
                    {STYLE_PRESETS.map((p) => (
                      <button key={p.id} type="button" onClick={() => setSelectedStyle(p.id)} className={`rounded-lg border px-3 py-2 text-left text-xs transition ${selectedStyle === p.id ? 'border-purple-500 bg-purple-500/10 text-purple-200' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:border-purple-400'}`}>
                        <p className="font-semibold">{p.label}</p>
                        <p className="text-[10px] text-slate-400">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400">엔진 선택</p>
                    <div className="flex gap-2">
                      {ENGINE_PRESETS.map((p) => (
                        <button key={p.id} type="button" onClick={() => setSelectedEngine(p.id)} className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition ${selectedEngine === p.id ? 'border-purple-500 bg-purple-500/10 text-purple-200' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:border-purple-400'}`}>
                          <p className="font-semibold">{p.label}</p>
                          <p className="text-[10px] text-slate-400">{p.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400">비율 선택</p>
                      <div className="flex gap-2">
                        {ASPECT_PRESETS.map((p) => (
                          <button key={p.id} type="button" onClick={() => setSelectedAspect(p.id)} className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs transition ${selectedAspect === p.id ? 'border-purple-500 bg-purple-500/10 text-purple-200' : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-300 hover:border-purple-400'}`}>
                            <p className="font-semibold">{p.label}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-400">씬 개수</p>
                      <input type="number" min={5} max={100} value={sceneCount} onChange={(e) => handleSceneCount(Number(e.target.value))} className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-sm text-slate-700 dark:text-slate-200 h-[38px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>



            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Identity Lock</h3>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handleAICharacterAnalysis} isLoading={isAnalyzing}>AI 인물 분석</Button>
                  <Button variant="secondary" onClick={handleEnhanceCharacterNotes} isLoading={isAnalyzing} disabled={characters.filter(c => approvedCharacterIds.has(c.id)).length === 0}>특징 영문 변환</Button>
                  <Button variant="secondary" onClick={() => applyCharacterExtraction(scriptText, '로컬 추출')}>로컬 추출</Button>
                  <Button variant="secondary" onClick={handleFindMissing}>누락 인물 찾기</Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {characters.map((c) => (
                  <div key={c.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-3 bg-white dark:bg-slate-900/40">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-slate-400 font-bold">
                        <input type="checkbox" checked={approvedCharacterIds.has(c.id)} onChange={() => toggleCharacterApproval(c.id)} className="rounded border-slate-700 bg-slate-800 text-purple-500" /> 승인
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={isCastingId === c.id ? "danger" : "secondary"}
                          size="sm"
                          className="h-6 text-[10px] px-2 py-0"
                          onClick={() => handleGenerateCharacterConcepts(c)}
                          disabled={!!isCastingId && isCastingId !== c.id}
                        >
                          {isCastingId === c.id ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="w-2 h-2 animate-spin" />
                              <span>취소</span>
                            </div>
                          ) : (
                            '🎭 가상 캐스팅'
                          )}
                        </Button>
                        <span className="text-xs text-slate-500 font-mono">ID {c.id}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input type="text" value={c.name} onChange={(e) => handleCharacterNameChange(c.id, e.target.value)} placeholder="이름" className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white font-bold" />
                      </div>
                      <input type="text" value={c.role} onChange={(e) => setCharacters(prev => prev.map(char => char.id === c.id ? { ...char, role: e.target.value } : char))} placeholder="역할" className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-400" />
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="relative group shrink-0">
                        {c.image ? (
                          <div className="relative">
                            <img src={c.image} alt={c.name} className="h-16 w-16 rounded-xl object-cover border-2 border-purple-500 shadow-lg shadow-purple-500/20" />
                            <button
                              onClick={() => handleDeleteCharacterImage(c.id)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer h-16 w-16 rounded-xl border-2 border-dashed border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center gap-1 text-slate-500">
                            <span className="text-lg">👤</span>
                            <span className="text-[8px]">업로드</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCharacterImageUpload(c.id, e)} />
                          </label>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={c.hair || ''}
                            onChange={(e) => setCharacters(prev => prev.map(char => char.id === c.id ? { ...char, hair: e.target.value } : char))}
                            className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500"
                          >
                            {HAIR_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          <select
                            value={c.eyes || ''}
                            onChange={(e) => setCharacters(prev => prev.map(char => char.id === c.id ? { ...char, eyes: e.target.value } : char))}
                            className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500"
                          >
                            {EYES_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <select
                            value={c.bodyType || ''}
                            onChange={(e) => setCharacters(prev => prev.map(char => char.id === c.id ? { ...char, bodyType: e.target.value } : char))}
                            className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500"
                          >
                            {BODY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          <input type="text" value={c.distinctFeatures || ''} onChange={(e) => setCharacters(prev => prev.map(char => char.id === c.id ? { ...char, distinctFeatures: e.target.value } : char))} placeholder="고유 특징" className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-white outline-none focus:border-purple-500" />
                        </div>
                      </div>
                    </div>

                    {/* ✅ [NEW] Virtual Casting Concepts UI */}
                    {c.concepts && c.concepts.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <p className="text-[9px] font-bold text-purple-400 mb-2 flex items-center gap-1">
                          ✨ 가상 캐스팅 제안 (마음에 드는 컨셉을 선택하세요)
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {c.concepts.map((concept) => (
                            <button
                              key={concept.id}
                              onClick={() => handleSelectConcept(c.id, concept)}
                              className={`relative rounded-lg overflow-hidden border-2 transition-all hover:scale-105 active:scale-95 ${c.selectedConceptId === concept.id ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                            >
                              <img src={concept.imageUrl} alt={concept.description} className="w-full aspect-square object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                                <span className="text-[8px] text-center leading-tight">{concept.description}</span>
                              </div>
                              {c.selectedConceptId === concept.id && (
                                <div className="absolute top-0 right-0 bg-purple-500 text-white p-0.5 rounded-bl-lg">
                                  <Sparkles size={8} />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <textarea
                      value={characterNotes[c.id] ?? ''}
                      onChange={(e) => handleCharacterNoteChange(c.id, e.target.value)}
                      placeholder="최종 비주얼 프롬프트 (자동 업데이트됨)"
                      rows={2}
                      className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-[10px] text-slate-300 resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white">생성 준비</h3>

              {/* Progress Indicator */}
              {progressStage !== 'idle' && progressStage !== 'complete' && (
                <div className="mt-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent"></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-purple-300">{progressMessage}</p>
                      <div className="mt-2 flex gap-2">
                        <div className={`h-1.5 flex-1 rounded ${progressStage === 'analyzing' ? 'bg-purple-500' : 'bg-slate-700'}`}></div>
                        <div className={`h-1.5 flex-1 rounded ${progressStage === 'generating' ? 'bg-purple-500' : 'bg-slate-700'}`}></div>
                        <div className={`h-1.5 flex-1 rounded ${progressStage === 'prompting' ? 'bg-purple-500' : 'bg-slate-700'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={handleGenerateCineboard} disabled={isGenerating}>{isGenerating ? '생성 중...' : '씨네보드 생성'}</Button>
                <Button variant="secondary" onClick={handleReset}>초기화</Button>
              </div>
            </div>
          </div>
          <div className="xl:col-span-5 flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex-1 flex flex-col">
              <h3 className="text-lg font-semibold text-white">대본 입력</h3>
              <div onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={(e) => {
                e.preventDefault(); e.stopPropagation(); setIsDragging(false);

                const files = Array.from(e.dataTransfer?.files || []);
                const file = files.find(f => f.type.startsWith('text/') || f.name.endsWith('.txt') || f.name.endsWith('.json'));

                if (file) {
                  setScriptFileName(file.name);
                  const reader = new FileReader();
                  reader.onload = () => setScriptText(extractPureScript(reader.result as string));
                  reader.onerror = () => {
                    console.error('Failed to read file:', file.name);
                    alert('파일을 읽는 데 실패했습니다. 텍스트 파일(.txt)을 선택해주세요.');
                  };
                  reader.readAsText(file);
                } else if (files.length > 0) {
                  console.warn('Non-text file dropped:', files[0]?.type, files[0]?.name);
                  alert('텍스트 파일(.txt, .json)만 드롭할 수 있습니다.');
                }
              }} className={`mt-3 rounded-lg border-2 border-dashed p-3 transition flex-1 flex flex-col ${isDragging ? 'border-purple-400 bg-purple-500/10' : 'border-slate-300 dark:border-slate-700'}`}>
                <textarea value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="대본을 입력하세요" className="w-full flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-purple-400">생성 결과</h3>
                {/* ✅ [NEW] Current Project Favorite Button */}
                {activeStoryId && (
                  <button
                    onClick={() => isFavorite(activeStoryId)
                      ? removeFromFavorites(activeStoryId)
                      : addToFavorites(activeStoryId)
                    }
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition flex items-center gap-1 ${isFavorite(activeStoryId)
                      ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/30'
                      : 'bg-slate-700 border border-slate-600 text-slate-400 hover:text-yellow-400 hover:bg-slate-600'
                      }`}
                    title={isFavorite(activeStoryId) ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                  >
                    {isFavorite(activeStoryId) ? '⭐' : '☆'}
                    <span className="text-xs">
                      {isFavorite(activeStoryId) ? '즐겨찾기됨' : '즐겨찾기'}
                    </span>
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap justify-end items-center">
                <Button variant="secondary" onClick={() => setActiveView('config')}>뒤로 가기</Button>
                <Button
                  variant="primary"
                  onClick={handleGenerateAllImages}
                  disabled={isBatchGenerating || !generationResult}
                  isLoading={isBatchGenerating}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-none shadow-lg shadow-purple-500/20"
                >
                  전체 그림 생성
                </Button>
                <Button variant="secondary" onClick={handleBatchDownloadImages} disabled={!generationResult}>
                  📦 전체 이미지 다운로드
                </Button>
                <Button variant="secondary" onClick={handleGenerateProductionReport} disabled={!generationResult}>
                  📄 프로덕션 리포트
                </Button>
                {selectedScenes.size > 0 && (
                  <Button variant="secondary" onClick={handleConvertToShorts}>
                    🎬 쇼츠로 변환 ({selectedScenes.size})
                  </Button>
                )}
                <Button variant="secondary" onClick={handleCopyJson} disabled={!generationResult}>JSON 복사</Button>
                <Button variant="secondary" onClick={handleCopyPrompts} disabled={!generationResult}>프롬프트 복사</Button>
                <Button onClick={() => {
                  const blob = new Blob([JSON.stringify(generationResult, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `cineboard_${Date.now()}.json`; a.click();
                  URL.revokeObjectURL(url);
                }}>다운로드</Button>
              </div>
            </div>

            {generationError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">
                <p className="font-bold mb-1">오류 발생</p>
                <p>{generationError}</p>
              </div>
            )}

            {generationResult && (
              <div className="space-y-6">
                {/* ✅ [NEW] 이미지 유무 안내 메시지 */}
                {(() => {
                  const imageCount = generationResult.scenes.filter(s => s.imageUrl && s.imageUrl.trim() !== '').length;
                  if (imageCount === 0) {
                    return (
                      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚠️</span>
                          <div>
                            <p className="font-semibold">이미지가 아직 생성되지 않았습니다</p>
                            <p className="text-sm mt-1">[전체 그림 생성] 버튼을 눌러 이미지를 생성해주세요.</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (imageCount < generationResult.scenes.length) {
                    return (
                      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">ℹ️</span>
                          <div>
                            <p className="font-semibold">일부 장면만 이미지가 있습니다</p>
                            <p className="text-sm mt-1">({imageCount}/{generationResult.scenes.length}장면) 나머지 장면의 [그림 생성] 버튼을 눌러주세요.</p>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">✅</span>
                          <div>
                            <p className="font-semibold">모든 장면의 이미지가 준비되었습니다</p>
                            <p className="text-sm mt-1">({imageCount}개 이미지) 프로덕션 리포트나 다운로드를 활용해주세요.</p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })()}

                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                  <p className="text-sm font-semibold text-slate-300">제목: {generationResult.title}</p>
                  <p className="text-xs text-slate-500 mt-1">총 {generationResult.scenes.length}개 장면</p>

                  {/* 제목 옵션 선택 UI */}
                  {(generationResult as any).titleOptions && (generationResult as any).titleOptions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">다른 제목 선택</p>
                      <div className="flex flex-wrap gap-2">
                        {(generationResult as any).titleOptions.map((title: string, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setGenerationResult({ ...generationResult, title })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${generationResult.title === title
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                              }`}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* BGM Section */}
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="text-purple-500 text-xl">♫</span> 배경음악 (GLOBAL BGM)
                    </h3>
                    <Button variant="secondary" size="sm" onClick={handleRegenerateBgm} isLoading={isGenerating}>
                      ♫ BGM 프롬프트 재생성
                    </Button>
                  </div>

                  {generationResult.bgm ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800 shadow-xl">
                      <div className="lg:col-span-5 flex flex-col gap-4">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">TRACK TITLE</p>
                          <h4 className="text-xl font-bold text-white">{generationResult.bgm.trackTitle}</h4>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">KOREAN DESCRIPTION</p>
                          <p className="text-sm text-slate-400 leading-relaxed">{generationResult.bgm.koreanDescription}</p>
                        </div>
                      </div>
                      <div className="lg:col-span-7 flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">SUNO AI PROMPT (JSON)</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(generationResult.bgm?.sunoPrompt, null, 2));
                              alert('BGM JSON이 복사되었습니다.');
                            }}
                            className="text-[9px] text-slate-500 hover:text-white flex items-center gap-1"
                          >
                            📋 COPY JSON
                          </button>
                        </div>
                        <div className="flex-1 bg-black/40 rounded-xl p-4 border border-slate-800 font-mono text-[11px] text-pink-400/90 overflow-auto max-h-[150px]">
                          <pre>{JSON.stringify(generationResult.bgm.sunoPrompt, null, 2)}</pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-slate-600 italic text-sm">
                      BGM 정보가 없습니다. [BGM 프롬프트 재생성]을 눌러보세요.
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {generationResult.scenes.map((s) => (
                    <div key={s.sceneNumber} className="group rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-all overflow-hidden">
                      {/* Image at the top */}
                      {s.imageUrl ? (
                        <div className="relative cursor-zoom-in group/img" onClick={() => setSelectedImageForView(s.imageUrl || null)}>
                          {/* Shot Number Overlay */}
                          <div className="absolute top-4 left-4 z-10">
                            <div className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-sm border border-white/20">
                              <span className="text-white font-bold text-sm">S{String(s.sceneNumber).padStart(2, '0')}</span>
                            </div>
                          </div>
                          {/* Zoom Hint */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
                            <Maximize2 className="text-white w-8 h-8" />
                          </div>
                          {/* Shot Type Badge - Top Right */}
                          {s.shotType && (
                            <div className="absolute top-4 right-4 z-10">
                              <div className="px-3 py-1 rounded-lg bg-cyan-500/90 backdrop-blur-sm border border-cyan-300/30">
                                <span className="text-white font-bold text-xs">{s.shotType}</span>
                              </div>
                            </div>
                          )}
                          <img src={s.imageUrl} alt={`Scene ${s.sceneNumber}`} className="w-full h-auto object-cover" style={{ maxHeight: '300px' }} />
                        </div>
                      ) : (
                        // ✅ [NEW] 이미지가 없는 경우의 플레이스홀더
                        <div className="relative bg-slate-800/40 rounded-lg border-2 border-dashed border-slate-600">
                          <div className="absolute top-4 left-4 z-10">
                            <div className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-sm border border-white/20">
                              <span className="text-white font-bold text-sm">S{String(s.sceneNumber).padStart(2, '0')}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-center h-48">
                            <div className="text-center space-y-2">
                              <span className="text-4xl text-slate-500">🎨</span>
                              <p className="text-slate-400 text-sm font-medium">이미지가 없습니다</p>
                              <p className="text-xs text-slate-500">[그림 생성] 버튼을 눌러주세요</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Content Section */}
                      <div className="p-4 space-y-3">
                        {/* Header with controls */}
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            {/* Selection Checkbox */}
                            <input
                              type="checkbox"
                              checked={s.isSelected || false}
                              onChange={() => handleToggleSceneSelection(s.sceneNumber)}
                              className="w-4 h-4 rounded border-slate-600 text-purple-500 focus:ring-purple-500"
                            />
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/20">Scene {s.sceneNumber}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{s.camera}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleGenerateImageNative(s.sceneNumber)}
                              isLoading={generatingId === `native-${s.sceneNumber}`}
                              className="bg-purple-600 hover:bg-purple-500 text-[10px] px-2 h-7"
                            >
                              이미지 생성
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleGenerateSceneImage(s.sceneNumber)}
                              isLoading={aiForwardingId === `ai-${s.sceneNumber}`}
                              className="bg-slate-800 hover:bg-slate-700 text-[10px] px-2 h-7"
                            >
                              AI 생성
                            </Button>
                            {s.imageUrl && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDownloadSceneImage(s)}
                                className="h-7 px-2"
                              >
                                💾
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSceneTabs(prev => ({ ...prev, [s.sceneNumber]: 'video' }));
                                if (!s.videoPrompt) {
                                  handleRefineVideoPrompt(s.sceneNumber);
                                }
                              }}
                              isLoading={s.isVideoGenerating}
                              className="h-7 px-2"
                              title="스마트 비디오 프롬프트 생성"
                            >
                              🎬
                            </Button>
                          </div>
                        </div>

                        {s.videoUrl && (
                          <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                            <video src={s.videoUrl} controls className="w-full h-auto max-h-[300px]" />
                          </div>
                        )}

                        {/* ✅ [NEW] Age & Outfit Selectors (빨간 박스 영역) */}
                        <div className="flex flex-col gap-2 p-3 rounded-lg bg-slate-950/30 border border-slate-800/50">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 flex flex-col gap-1">
                              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Age</label>
                              <select
                                value={s.age || ''}
                                onChange={(e) => handleUpdateSceneSettings(s.sceneNumber, 'age', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                              >
                                {AGE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-[2] flex flex-col gap-1">
                              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Outfit Style</label>
                              <select
                                value={s.outfit || ''}
                                onChange={(e) => handleUpdateSceneSettings(s.sceneNumber, 'outfit', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                              >
                                {OUTFIT_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>


                        {/* Scene Tabs */}
                        <div className="mt-2 flex flex-col border border-slate-800 rounded-lg bg-slate-950/50 overflow-hidden">
                          <div className="flex border-b border-slate-800 bg-slate-900/50">
                            {['IMG', '영상', 'JSON'].map((tab) => {
                              const tabKey = tab === 'IMG' ? 'img' : tab === '영상' ? 'video' : 'json';
                              const active = (sceneTabs[s.sceneNumber] || 'img') === tabKey;
                              return (
                                <button
                                  key={tab}
                                  onClick={() => setSceneTabs(prev => ({ ...prev, [s.sceneNumber]: tabKey as any }))}
                                  className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${active ? 'text-white border-b-2 border-red-500 bg-red-500/10' : 'text-slate-500 hover:bg-slate-800'}`}
                                >
                                  {tab}
                                </button>
                              );
                            })}
                          </div>

                          <div className="p-3 min-h-[80px]">
                            {(sceneTabs[s.sceneNumber] || 'img') === 'img' && (
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                  <p className="text-xs text-slate-200 leading-relaxed font-medium">{s.summary}</p>
                                </div>
                                {/* Korean Prompt Section */}
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-cyan-400 text-[9px] font-bold">KOREAN PROMPT</span>
                                    {editingScene?.number === s.sceneNumber && editingScene?.field === 'ko' ? (
                                      <div className="flex gap-2">
                                        <button onClick={handleSaveEdit} className="text-emerald-400 text-[9px] font-bold hover:underline">저장</button>
                                        <button onClick={() => setEditingScene(null)} className="text-slate-500 text-[9px] font-bold hover:underline">취소</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => handleStartEdit(s.sceneNumber, 'ko', s.longPromptKo)} className="text-blue-400 text-[9px] font-bold hover:underline">수정</button>
                                    )}
                                  </div>
                                  {editingScene?.number === s.sceneNumber && editingScene?.field === 'ko' ? (
                                    <textarea
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-[10px] text-slate-200 focus:outline-none focus:border-purple-500 min-h-[60px]"
                                    />
                                  ) : (
                                    <p className="text-[10px] text-slate-400 leading-relaxed">{s.longPromptKo}</p>
                                  )}
                                </div>

                                {/* English Prompt Section */}
                                <div className="flex flex-col gap-1.5 border-t border-slate-800/50 pt-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-pink-400 text-[9px] font-bold">ENGLISH PROMPT (AI)</span>
                                    {editingScene?.number === s.sceneNumber && editingScene?.field === 'en' ? (
                                      <div className="flex gap-2">
                                        <button onClick={handleSaveEdit} className="text-emerald-400 text-[9px] font-bold hover:underline">저장</button>
                                        <button onClick={() => setEditingScene(null)} className="text-slate-500 text-[9px] font-bold hover:underline">취소</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => handleStartEdit(s.sceneNumber, 'en', s.longPrompt)} className="text-blue-400 text-[9px] font-bold hover:underline">수정</button>
                                    )}
                                  </div>
                                  {editingScene?.number === s.sceneNumber && editingScene?.field === 'en' ? (
                                    <textarea
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-[10px] text-slate-200 focus:outline-none focus:border-purple-500 min-h-[60px]"
                                    />
                                  ) : (
                                    <p className="text-[10px] text-slate-500 leading-relaxed italic">{s.longPrompt}</p>
                                  )}
                                </div>


                              </div>
                            )}
                            {(sceneTabs[s.sceneNumber] || 'img') === 'video' && (
                              <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-purple-400 text-[9px] font-bold uppercase tracking-wider">AI Video Studio</span>
                                  {s.videoUrl && (
                                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded">GEN COMPLETE</span>
                                  )}
                                </div>

                                {/* 1. Video Prompt Section */}
                                <div className="bg-black/30 rounded-lg p-2.5 border border-slate-800/50 space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[8px] font-bold">SMART VIDEO PROMPT</span>
                                    {!s.videoPrompt && !s.isVideoPromptGenerating && (
                                      <button
                                        onClick={() => handleRefineVideoPrompt(s.sceneNumber)}
                                        className="text-[9px] text-purple-400 hover:text-purple-300 font-bold transition-colors"
                                      >
                                        [ 동영상용 지시어 정제 ]
                                      </button>
                                    )}
                                  </div>

                                  {s.isVideoPromptGenerating ? (
                                    <div className="py-4 text-center">
                                      <div className="animate-spin h-4 w-4 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                      <p className="text-[9px] text-slate-500 animate-pulse">대본 맥락 분석 중...</p>
                                    </div>
                                  ) : s.videoPrompt ? (
                                    <textarea
                                      value={s.videoPrompt}
                                      onChange={(e) => {
                                        if (!generationResult) return;
                                        setGenerationResult({
                                          ...generationResult,
                                          scenes: generationResult.scenes.map(scene =>
                                            scene.sceneNumber === s.sceneNumber
                                              ? { ...scene, videoPrompt: e.target.value }
                                              : scene
                                          )
                                        });
                                      }}
                                      className="w-full bg-slate-900/50 border border-slate-700/50 rounded p-2 text-[10px] text-slate-300 focus:outline-none focus:border-purple-500/50 min-h-[80px] leading-relaxed"
                                      placeholder="영상 생성 지시어를 입력하세요..."
                                    />
                                  ) : (
                                    <div className="py-4 text-center bg-slate-900/30 rounded border border-dashed border-slate-800">
                                      <p className="text-[9px] text-slate-600 italic">프롬프트를 먼저 생성하거나 입력해주세요.</p>
                                    </div>
                                  )}
                                </div>

                                {/* 2. Video Action Section */}
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleGenerateSceneVideo(s.sceneNumber)}
                                    disabled={s.isVideoGenerating || !s.videoPrompt}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${s.isVideoGenerating
                                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                      : !s.videoPrompt
                                        ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/20 hover:scale-[1.02] active:scale-[0.98]'
                                      }`}
                                  >
                                    {s.isVideoGenerating ? (
                                      <>
                                        <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                                        <span>생성 중...</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>🎞️</span>
                                        <span>{s.videoUrl ? '비디오 다시 생성' : '비디오 생성'}</span>
                                      </>
                                    )}
                                  </button>
                                </div>

                                {/* 3. Video Display Section */}
                                {s.videoUrl && (
                                  <div className="relative group rounded-lg overflow-hidden border border-slate-700 shadow-xl bg-black">
                                    <video src={s.videoUrl} controls className="w-full h-auto aspect-video" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => window.open(s.videoUrl, '_blank')}
                                        className="bg-black/60 hover:bg-black/80 p-1.5 rounded-full text-white backdrop-blur-sm"
                                        title="새 창에서 보기"
                                      >
                                        ↗️
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            {(sceneTabs[s.sceneNumber] || 'img') === 'json' && (
                              <pre className="text-[8px] text-slate-500 overflow-x-auto bg-black/30 p-2 rounded">
                                {JSON.stringify({ camera: s.camera, prompt: s.shortPrompt }, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">🎬</span> AI 씨네보드 사용 설명서
              </h3>
              <button onClick={() => setShowGuide(false)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-slate-300 space-y-6 leading-relaxed">
              <section className="space-y-3">
                <h4 className="text-purple-400 font-bold flex items-center gap-2">🚀 주요 기능</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-white font-semibold mb-1">1. 설정 및 대본 입력</p>
                    <p className="text-[11px] text-slate-400">비주얼 스타일, 엔진, 비율을 선택하고 대본을 입력하거나 드래그 앤 드롭하세요.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-white font-semibold mb-1">2. Identity Lock (인물 고정)</p>
                    <p className="text-[11px] text-slate-400">인물을 자동 추출하고 캐스팅 이미지를 업로드하여 장면 간 일관성을 유지합니다.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-white font-semibold mb-1">3. 스토리보드 생성</p>
                    <p className="text-[11px] text-slate-400">대본을 분석해 씬별 요약, 카메라 워킹, 프롬프트를 자동으로 설계합니다.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <p className="text-white font-semibold mb-1">4. 이미지/영상 제작</p>
                    <p className="text-[11px] text-slate-400">설계된 프롬프트로 실제 AI 이미지와 비디오를 즉시 생성할 수 있습니다.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-800 pt-6">
                <h4 className="text-emerald-400 font-bold flex items-center gap-2">🛠 작업 흐름 가이드</h4>
                <ol className="list-decimal list-inside space-y-2 text-[12px] text-slate-400 ml-2">
                  <li><strong className="text-slate-200">대본 준비</strong>: 제작할 시나리오를 입력창에 넣습니다.</li>
                  <li><strong className="text-slate-200">인물 세팅</strong>: [AI 인물 분석] 후 특징을 입력하거나 캐스팅 이미지를 올립니다.</li>
                  <li><strong className="text-slate-200">씨네보드 생성</strong>: 하단의 [씨네보드 생성] 버튼을 클릭합니다.</li>
                  <li><strong className="text-slate-200">이미지 제작</strong>: 결과 탭에서 [전체 그림 생성] 또는 개별 생성을 진행합니다.</li>
                  <li><strong className="text-slate-200">결과 활용</strong>: 생성된 프롬프트와 이미지를 영상 제작 소스로 활용하세요.</li>
                </ol>
              </section>
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/50">
              <Button onClick={() => setShowGuide(false)} size="sm">확인했습니다</Button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ [NEW] Full Image Lightbox View */}
      <Lightbox
        imageUrl={selectedImageForView}
        onClose={() => setSelectedImageForView(null)}
      />
    </div>
  );
};

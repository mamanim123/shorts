import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { 
  LayoutGrid, FileText, Mic2, Users, Image as ImageIcon, Sparkles, 
  Settings, Download, Search, Video, Music, Scissors, Type, 
  ChevronRight, Play, Plus, Trash2, Check, ExternalLink, Info, Bell, Sun, User,
  ChevronLeft, MessageSquare, Volume2, FastForward, Sliders, Edit2, Loader2, X, Camera, Wand2, Star,
  Zap, RefreshCw, Bot, Clock, Maximize2, ShieldAlert, Monitor
} from 'lucide-react';

// 기존 로직 서비스
import { initGeminiService, generateImageWithImagen, generateImage, generateSingleSpeakerAudio, getApiKey, fetchAvailableModels } from './master-studio/services/geminiService';
import { generateBenchmarkStorylinePackage, generateStory, optimizeCharacterPrompt, describeCharacterFromImage } from '../services/geminiService';
import { buildLabScriptPrompt } from '../services/labPromptBuilder';
import { parseJsonFromText } from '../services/jsonParse';
import { showToast } from './Toast';
import { generateSRT, generateCapCutXML, downloadFile } from '../services/exportService';
import { pcmToWavBlob } from './master-studio/services/audioUtils';
import { v4 as uuidv4 } from 'uuid';
import SlimAiStudioFusionApp from '../../ai-studio/components/SlimAiStudioFusionApp';

const DELIVERY_OPTIONS = [
  { id: 'natural', label: '자연스럽게', prompt: 'Say naturally:' },
  { id: 'cheerful', label: '밝고 경쾌하게', prompt: 'Say cheerfully:' },
  { id: 'calm', label: '차분하게', prompt: 'Say calmly:' },
  { id: 'excited', label: '신나게', prompt: 'Say excitedly:' },
  { id: 'sad', label: '슬프게', prompt: 'Say sadly:' },
  { id: 'angry', label: '강하게', prompt: 'Say angrily:' },
  { id: 'whisper', label: '속삭이듯', prompt: 'Whispering:' },
  { id: 'dramatic', label: '드라마틱하게', prompt: 'Announce dramatically:' },
] as const;
const TTS_ENGINES = [
  { id: 'multilingual-v2', label: 'Multilingual v2', description: 'ElevenLabs 고품질 모델, 29개 언어 지원', available: true, credit: '500자당 1P', model: 'eleven_multilingual_v2' },
  { id: 'elevenlabs', label: 'ElevenLabs Flash v2.5', description: '빠르고 자연스러운 최신 초고속 엔진', available: true, credit: '1000자당 1P', model: 'eleven_flash_v2_5' },
  { id: 'typecast', label: 'Typecast', description: '한국어 특화 캐릭터형 보이스, API 키 필요', available: true, credit: '유료 플랜', model: 'typecast' },
  { id: 'gemini', label: 'Gemini TTS', description: 'Google AI Studio API 키 등록 후 무료 사용', available: true, credit: 'API 키 (0P)', model: 'gemini-2.5-flash-preview-tts' },
];
type MediaModelOption = {
  id: string;
  label: string;
  credit: string;
  note: string;
};
const GLOBAL_IMAGE_MODEL_STORAGE_KEY = 'shorts-lab-global-image-model';
const CHARACTER_LIBRARY_STORAGE_KEY = 'tubefactory-character-library-v1';
const CHARACTER_REFERENCE_SLOTS = ['front', 'angle45', 'side', 'faceCloseup'] as const;
type CharacterReferenceSlot = (typeof CHARACTER_REFERENCE_SLOTS)[number];
const CHARACTER_REFERENCE_SLOT_LABEL: Record<CharacterReferenceSlot, string> = {
  front: '정면',
  angle45: '45도',
  side: '측면/뒤',
  faceCloseup: '얼굴 클로즈업',
};

const DEFAULT_MEDIA_IMAGE_MODELS: MediaModelOption[] = [
  { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image', credit: 'API', note: 'ShortsLab 미리보기 기본' },
  { id: 'imagen-4.0-generate-001', label: 'Imagen 4.0', credit: 'API', note: '품질 우선' },
  { id: 'imagen-4.0-fast-generate-001', label: 'Imagen 4.0 Fast', credit: 'API', note: '속도 우선' },
  { id: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4.0 Ultra', credit: 'API', note: '고품질' },
  { id: 'imagen-3.0-generate-001', label: 'Imagen 3.0', credit: 'API', note: '안정형' },
];
const DEFAULT_MEDIA_VIDEO_MODELS: MediaModelOption[] = [
  { id: 'veo-3-fast', label: 'Veo 3.1 Fast', credit: '1.5P', note: 'Google' },
  { id: 'seedance-15', label: 'Seedance 1.5', credit: '3P', note: 'ByteDance' },
  { id: 'seedance-15-audio', label: 'Seedance 1.5 + Audio', credit: '5P', note: 'ByteDance' },
];

const parseVideoModelConfig = (raw: string | undefined): MediaModelOption[] => {
  if (!raw?.trim()) return DEFAULT_MEDIA_VIDEO_MODELS;
  const customModels = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, label, credit, note] = entry.split('|').map((part) => part.trim());
      if (!id || !label) return null;
      return {
        id,
        label,
        credit: credit || 'CUSTOM',
        note: note || '사용자 추가',
      };
    })
    .filter((item): item is MediaModelOption => item !== null);

  if (customModels.length === 0) return DEFAULT_MEDIA_VIDEO_MODELS;
  const merged = [...DEFAULT_MEDIA_VIDEO_MODELS, ...customModels];
  const deduped = new Map<string, MediaModelOption>();
  merged.forEach((model) => deduped.set(model.id, model));
  return Array.from(deduped.values());
};

const extractGeneratedImageBase64 = (result: any): string | null => {
  if (result && 'generatedImages' in result && result.generatedImages?.length > 0) {
    const generatedImage = result.generatedImages[0];
    if (generatedImage?.image?.imageBytes) return generatedImage.image.imageBytes;
    if (generatedImage?.imageBytes) return generatedImage.imageBytes;
  }
  if (result?.images?.length > 0) return result.images[0];
  if (result?.candidates) {
    const inlineData = result.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData)?.inlineData;
    if (inlineData?.data) return inlineData.data;
  }
  return null;
};

type VoiceLibraryItem = {
  id: string;
  name: string;
  subtitle: string;
  language: 'ko' | 'en' | 'ja';
  gender: string;
  ageGroup?: string;
  popular: boolean;
  rank?: number | null;
  score?: number;
  useCase?: string;
  recommendation?: string;
  providerBadge?: string;
};

type VoiceRecommendationMeta = {
  rank: number;
  score: number;
  useCase: string;
  recommendation: string;
};

// ─── ElevenLabs 보이스 라이브러리 (tubefactory.kr 벤치마킹 기준) ───
// 출처: ElevenLabs API /v1/voices 또는 https://elevenlabs.io/voice-lab
// API 키 연동 후 실제 voice_id 매핑 필요 (현재는 UI 미리보기용)
const ELEVENLABS_VOICE_LIBRARY: VoiceLibraryItem[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',   subtitle: '여성, 성숙하고 자신감 있는 톤',      language: 'ko', gender: '여성', ageGroup: '중년',   popular: true  },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',   subtitle: '여성, 열정적이고 개성 있는 톤',      language: 'ko', gender: '여성', ageGroup: '청년',   popular: true  },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',   subtitle: '여성, 명확하고 교육적인 나레이션',    language: 'ko', gender: '여성', ageGroup: '청년',   popular: true  },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', subtitle: '여성, 전문적이고 신뢰감 있는 톤',    language: 'ko', gender: '여성', ageGroup: '중년',   popular: false },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', subtitle: '여성, 발랄하고 따뜻한 쇼츠 톤',     language: 'ko', gender: '여성', ageGroup: '청년',   popular: true  },
  { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella',   subtitle: '여성, 밝고 전문적인 내레이션',       language: 'ko', gender: '여성', ageGroup: '청년',   popular: true  },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',    subtitle: '여성, 부드럽고 감성적인 배우 톤',    language: 'ko', gender: '여성', ageGroup: '청년',   popular: false },
  { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River',   subtitle: '중성, 차분하고 정보전달에 강한 톤',  language: 'ko', gender: '여성', ageGroup: '청년',   popular: false },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',    subtitle: '남성, 강하고 단호한 대표 나레이션',  language: 'ko', gender: '남성', ageGroup: '청년',   popular: true  },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   subtitle: '남성, 깊고 편안한 중후한 톤',        language: 'ko', gender: '남성', ageGroup: '중년',   popular: true  },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',   subtitle: '남성, 친근하고 매력적인 쇼츠 톤',   language: 'ko', gender: '남성', ageGroup: '청년',   popular: true  },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric',    subtitle: '남성, 부드럽고 신뢰감 있는 톤',     language: 'ko', gender: '남성', ageGroup: '청년',   popular: true  },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger',   subtitle: '남성, 여유롭고 캐주얼한 톤',        language: 'ko', gender: '남성', ageGroup: '청년',   popular: false },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', subtitle: '남성, 깊고 에너지 넘치는 톤',       language: 'ko', gender: '남성', ageGroup: '청년',   popular: true  },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',  subtitle: '남성, 따뜻한 스토리텔러 톤',        language: 'ko', gender: '남성', ageGroup: '중년',   popular: false },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',  subtitle: '남성, 허스키하고 독특한 캐릭터 톤', language: 'ko', gender: '남성', ageGroup: '청년',   popular: false },
  { id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry',   subtitle: '남성, 강렬하고 파워풀한 전사 톤',   language: 'ko', gender: '남성', ageGroup: '청년',   popular: false },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',    subtitle: '남성, 에너지 넘치는 SNS 크리에이터', language: 'ko', gender: '남성', ageGroup: '청년',   popular: true  },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',    subtitle: '남성, 여유롭고 긍정적인 톤',        language: 'ko', gender: '남성', ageGroup: '청년',   popular: false },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  subtitle: '남성, 안정적인 방송 아나운서 톤',   language: 'ko', gender: '남성', ageGroup: '중년',   popular: false },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',    subtitle: '남성, 지혜롭고 균형 잡힌 시니어 톤', language: 'ko', gender: '남성', ageGroup: '시니어', popular: false },
] as const;
const LANGUAGE_OPTIONS = [
  { id: 'all', label: '전체', badge: 'ALL' },
  { id: 'ko', label: '한국어', badge: 'KR' },
  { id: 'en', label: '영어', badge: 'US' },
  { id: 'ja', label: '일본어', badge: 'JP' },
] as const;
const AUTO_SOURCE_MODES = [
  { id: 'trend', label: '트렌드수집', description: '지금 주제에서 바이럴 훅만 다시 뽑습니다.' },
  { id: 'benchmark', label: '영상참고 10주제', description: '설명서/자막 원문을 분석해 파생 줄거리를 만듭니다.' },
  { id: 'srt', label: '외부 음성+SRT', description: '자막/SRT 원문을 넣어 재구성 기획에 활용합니다.' },
  { id: 'prompt', label: '대본+이미지 프롬프트', description: '대본과 장면 프롬프트를 한 번에 생성합니다.' },
] as const;
const OUTPUT_FORMATS = [
  { id: 'shorts', label: '쇼츠 (9:16)' },
  { id: 'longform', label: '롱폼 (16:9)' },
] as const;
const DURATION_OPTIONS = ['30초', '1분', '2분', '3분'] as const;
const SCRIPT_STRUCTURE_OPTIONS = [
  { id: 'narration', label: '내레이션만' },
  { id: 'dialogue', label: '내레이션 + 대화' },
] as const;
const TTS_SPEED_PRESETS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;
const FAVORITE_FILTERS = [
  { id: 'popular', label: '추천' },
  { id: 'all', label: '전체' },
  { id: 'favorites', label: '즐겨찾기' },
] as const;
const GEMINI_VOICE_LIBRARY: VoiceLibraryItem[] = [
  { id: 'Leda', name: 'Leda', subtitle: '여성, 젊음, 부드러움', language: 'en', gender: '여성', ageGroup: '젊음', popular: true },
  { id: 'Zephyr', name: 'Zephyr', subtitle: '여성, 젊음, 밝음', language: 'ja', gender: '여성', ageGroup: '젊음', popular: false },
  { id: 'Aoede', name: 'Aoede', subtitle: '여성, 젊음, 산뜻함', language: 'ko', gender: '여성', ageGroup: '젊음', popular: true },
  { id: 'Kore', name: 'Kore', subtitle: '여성, 중년, 단호함', language: 'ko', gender: '여성', ageGroup: '중년', popular: true },
  { id: 'Callirrhoe', name: 'Callirrhoe', subtitle: '여성, 중년, 편안함', language: 'en', gender: '여성', ageGroup: '중년', popular: false },
  { id: 'Autonoe', name: 'Autonoe', subtitle: '여성, 중년, 밝음', language: 'en', gender: '여성', ageGroup: '중년', popular: false },
  { id: 'Laomedeia', name: 'Laomedeia', subtitle: '여성, 중년, 경쾌함', language: 'en', gender: '여성', ageGroup: '중년', popular: false },
  { id: 'Erinome', name: 'Erinome', subtitle: '여성, 중년, 맑음', language: 'en', gender: '여성', ageGroup: '중년', popular: false },
  { id: 'Gacrux', name: 'Gacrux', subtitle: '여성, 시니어, 성숙함', language: 'ko', gender: '여성', ageGroup: '시니어', popular: false },
  { id: 'Sulafat', name: 'Sulafat', subtitle: '여성, 시니어, 따뜻함', language: 'en', gender: '여성', ageGroup: '시니어', popular: false },
  { id: 'Pulcherrima', name: 'Pulcherrima', subtitle: '여성, 시니어, 당당함', language: 'en', gender: '여성', ageGroup: '시니어', popular: false },
  { id: 'Despina', name: 'Despina', subtitle: '여성, 시니어, 부드러움', language: 'en', gender: '여성', ageGroup: '시니어', popular: false },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', subtitle: '여성, 시니어, 부드러움', language: 'en', gender: '여성', ageGroup: '시니어', popular: false },
  { id: 'Puck', name: 'Puck', subtitle: '남성, 젊음, 경쾌함', language: 'ko', gender: '남성', ageGroup: '젊음', popular: true },
  { id: 'Fenrir', name: 'Fenrir', subtitle: '남성, 젊음, 활기참', language: 'ko', gender: '남성', ageGroup: '젊음', popular: false },
  { id: 'Sadachbia', name: 'Sadachbia', subtitle: '남성, 젊음, 활발함', language: 'en', gender: '남성', ageGroup: '젊음', popular: false },
  { id: 'Orus', name: 'Orus', subtitle: '남성, 중년, 단호함', language: 'en', gender: '남성', ageGroup: '중년', popular: false },
  { id: 'Iapetus', name: 'Iapetus', subtitle: '남성, 중년, 맑음', language: 'en', gender: '남성', ageGroup: '중년', popular: false },
  { id: 'Achird', name: 'Achird', subtitle: '남성, 중년, 친근함', language: 'en', gender: '남성', ageGroup: '중년', popular: false },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi', subtitle: '남성, 중년, 캐주얼', language: 'en', gender: '남성', ageGroup: '중년', popular: false },
  { id: 'Charon', name: 'Charon', subtitle: '남성, 시니어, 정보적', language: 'ko', gender: '남성', ageGroup: '시니어', popular: true },
  { id: 'Umbriel', name: 'Umbriel', subtitle: '남성, 시니어, 편안함', language: 'en', gender: '남성', ageGroup: '시니어', popular: false },
  { id: 'Algieba', name: 'Algieba', subtitle: '남성, 시니어, 부드러움', language: 'en', gender: '남성', ageGroup: '시니어', popular: false },
  { id: 'Schedar', name: 'Schedar', subtitle: '남성, 시니어, 차분함', language: 'en', gender: '남성', ageGroup: '시니어', popular: false },
  { id: 'Rasalgethi', name: 'Rasalgethi', subtitle: '남성, 시니어, 정보적', language: 'en', gender: '남성', ageGroup: '시니어', popular: false },
  { id: 'Sadaltager', name: 'Sadaltager', subtitle: '남성, 시니어, 지적임', language: 'en', gender: '남성', ageGroup: '시니어', popular: false },
  { id: 'Enceladus', name: 'Enceladus', subtitle: '남성, 중년, 숨결', language: 'en', gender: '남성', ageGroup: '중년', popular: false },
  { id: 'Algenib', name: 'Algenib', subtitle: '남성, 중년, 허스키함', language: 'en', gender: '남성', ageGroup: '중년', popular: false },
  { id: 'Achernar', name: 'Achernar', subtitle: '여성, 중년, 조용함', language: 'en', gender: '여성', ageGroup: '중년', popular: false },
  { id: 'Alnilam', name: 'Alnilam', subtitle: '남성, 시니어, 앵커톤', language: 'en', gender: '남성', ageGroup: '시니어', popular: false },
] as const;

const VOICE_RECOMMENDATION_META: Record<string, VoiceRecommendationMeta> = {
  'elevenlabs:EXAVITQu4vr4xnSDxMaL': { rank: 1, score: 98, useCase: '정보형 쇼츠, 여성 대표',       recommendation: '안정적이고 신뢰감 있는 표준 여성 나레이션' },
  'elevenlabs:cgSgspJ2msm6clMCkdW9': { rank: 2, score: 97, useCase: '트렌디한 쇼츠, 발랄한 톤',     recommendation: '요즘 유튜브에서 가장 유행하는 밝고 친근한 여성톤' },
  'elevenlabs:hpp4J3VqNfWAUOO0d1Us': { rank: 3, score: 96, useCase: '밝고 전문적인 나레이션',       recommendation: '깔끔하고 전문적인 여성 내레이션' },
  'elevenlabs:FGY2WhTYpPnrIDTdsKH5': { rank: 4, score: 95, useCase: '개성 있는 여성 콘텐츠',       recommendation: '독특한 개성으로 채널 아이덴티티를 강화' },
  'elevenlabs:Xb7hH8MSUJpSbSDYk0k2': { rank: 5, score: 94, useCase: '교육형 콘텐츠, 명확한 전달',  recommendation: '또렷하고 교육적인 톤으로 정보 전달에 최적' },
  'elevenlabs:pNInz6obpgDQGcFmaJgB': { rank: 6, score: 93, useCase: '남성 나레이션, 강한 임팩트',   recommendation: '깊고 단호한 목소리로 강렬한 인상을 남김' },
  'elevenlabs:nPczCjzI2devNBz1zQrb': { rank: 7, score: 92, useCase: '감성 스토리텔링, 중후한 톤',  recommendation: '깊고 편안한 목소리로 감동적인 장면에 적합' },
  'elevenlabs:iP95p4xoKVk53GoZ742B': { rank: 8, score: 91, useCase: '친근한 대화형 쇼츠',          recommendation: '자연스럽고 편안한 톤으로 시청자와 거리를 좁혀줌' },
  'elevenlabs:cjVigY5qzO86Huf0OWal': { rank: 9, score: 90, useCase: '정보 전달, 신뢰감 있는 톤',   recommendation: '부드럽고 믿음직한 남성톤으로 설득력이 높음' },
  'elevenlabs:IKne3meq5aSn9XLyUdCD': { rank: 10, score: 89, useCase: '에너지 넘치는 남성 예능형',  recommendation: '활기차고 힘 있는 목소리로 집중도를 높임' },
  'elevenlabs:TX3LPaxmHKxFdv7VOQHJ': { rank: 11, score: 88, useCase: 'SNS 크리에이터, 젊은 층',    recommendation: '에너지 넘치고 트렌디한 SNS 스타일' },
  'elevenlabs:cgSgspJ2msm6clMCkdW9': { rank: 2, score: 97, useCase: '트렌디한 쇼츠, 발랄한 톤', recommendation: '요즘 유튜브에서 가장 유행하는 밝고 친근한 여성톤' },
  'elevenlabs:pNInz6obpgDQGcFmaJgB': { rank: 3, score: 96, useCase: '남성 나레이션, 강한 임팩트', recommendation: '깊고 단호한 목소리로 강렬한 인상을 남김' },
  'elevenlabs:iP95p4xoKVk53GoZ742B': { rank: 4, score: 95, useCase: '친근한 대화형 쇼츠', recommendation: '자연스럽고 편안한 톤으로 시청자와 거리를 좁혀줌' },
  'elevenlabs:IKne3meq5aSn9XLyUdCD': { rank: 5, score: 94, useCase: '에너지 넘치는 남성 예능형', recommendation: '활기차고 힘 있는 목소리로 집중도를 높임' },
  'elevenlabs:FGY2WhTYpPnrIDTdsKH5': { rank: 6, score: 93, useCase: '개성 있는 여성 콘텐츠', recommendation: '독특한 개성으로 채널 아이덴티티를 강화' },
  'elevenlabs:cjVigY5qzO86Huf0OWal': { rank: 7, score: 92, useCase: '정보 전달, 신뢰감 있는 톤', recommendation: '부드럽고 믿음직한 남성톤으로 설득력이 높음' },
  'elevenlabs:nPczCjzI2devNBz1zQrb': { rank: 8, score: 91, useCase: '감성 스토리텔링, 시니어 톤', recommendation: '깊고 편안한 목소리로 감동적인 장면에 적합' },
  'elevenlabs:TX3LPaxmHKxFdv7VOQHJ': { rank: 9, score: 90, useCase: 'SNS 크리에이터, 젊은 층', recommendation: '에너지 넘치고 트렌디한 SNS 스타일' },
  'elevenlabs:Xb7hH8MSUJpSbSDYk0k2': { rank: 10, score: 89, useCase: '교육형 콘텐츠, 명확한 전달', recommendation: '또렷하고 교육적인 톤으로 정보 전달에 최적' },
  'gemini:Kore':   { rank: 1, score: 95, useCase: '한국어 여성 기본 내레이션', recommendation: '현재 시스템에서 가장 무난한 기본값' },
  'gemini:Charon': { rank: 2, score: 92, useCase: '정보형 남성 설명', recommendation: '정보 전달용으로 발음과 톤 밸런스가 좋음' },
  'gemini:Puck':   { rank: 3, score: 90, useCase: '예능형, 텐션 높은 쇼츠', recommendation: '짧은 훅과 텐션 위주 콘텐츠에 유리' },
  'gemini:Aoede':  { rank: 4, score: 88, useCase: '차분한 여성 스토리텔링', recommendation: '과하지 않은 감정선에 잘 맞음' },
  'gemini:Leda':   { rank: 5, score: 86, useCase: '영문 여성 소프트톤', recommendation: '부드럽고 범용적인 영문 보이스' },
};


const buildRankedVoiceLibrary = (library: VoiceLibraryItem[], engineId: string): VoiceLibraryItem[] => {
  const recommendationEngine = engineId === 'multilingual-v2' ? 'elevenlabs' : engineId;
  return library.map((voice) => {
    const meta = VOICE_RECOMMENDATION_META[`${recommendationEngine}:${voice.id}`];
    return {
      ...voice,
      rank: meta?.rank ?? null,
      score: meta?.score ?? (voice.popular ? 80 : 60),
      useCase: meta?.useCase ?? '일반 용도',
      recommendation: meta?.recommendation ?? '직접 테스트 후 선택 추천',
      providerBadge: recommendationEngine === 'gemini' ? 'GEMINI' : recommendationEngine === 'typecast' ? 'TYPECAST' : 'EL',
    };
  });
};

type Step = 'status-board' | 'project-list' | 'style' | 'script' | 'tts' | 'character' | 'media' | 'thumbnail' | 'image-effect' | 'fusion' | 'edit' | 'subtitle' | 'seo' | 'export' | 'tubeflow';
type ScriptPhase = 'input' | 'storylines' | 'editor';
type AppLanguage = typeof LANGUAGE_OPTIONS[number]['id'];
type AutoSourceMode = typeof AUTO_SOURCE_MODES[number]['id'];
type OutputFormat = typeof OUTPUT_FORMATS[number]['id'];
type ScriptStructure = typeof SCRIPT_STRUCTURE_OPTIONS[number]['id'];
type DeliveryOptionId = typeof DELIVERY_OPTIONS[number]['id'];
type FavoriteFilterId = typeof FAVORITE_FILTERS[number]['id'];
type BenchmarkAnalysis = {
  sourceSummary: string;
  hookPattern: string;
  narrativeStructure: string;
  toneStyle: string;
  narrationHabit: string;
  rebuildProtocol: string;
};

const API_BASE_URL = 'http://localhost:3002';

const TubeFactoryPanel: React.FC = () => {
  const getTextClient = async () => {
    await initGeminiService();
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Gemini API key is not available.');
    return new GoogleGenAI({ apiKey });
  };

  // 1. 상태 관리 (Step & UI)
  const [activeStep, setActiveStep] = useState<Step>('status-board');
  const [scriptPhase, setScriptPhase] = useState<ScriptPhase>('input');
  const [activeSubStep, setActiveSubStep] = useState<'manual' | 'auto'>('auto');
  
  // 2. 대본 관련 데이터
  const [topic, setTopic] = useState('');
  const [benchmarkSource, setBenchmarkSource] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('실사풍');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [selectedStoryDraft, setSelectedStoryDraft] = useState('');
  const [storylines, setStorylines] = useState<{title: string, content: string}[]>([]);
  const [benchmarkAnalysis, setBenchmarkAnalysis] = useState<BenchmarkAnalysis | null>(null);
  const [scenes, setScenes] = useState<any[]>([]);
  const [sceneComposition, setSceneComposition] = useState<'auto'|'1-sentence'|'2-sentence'|'custom'>('auto');
  const [customSentenceCount, setCustomSentenceCount] = useState<number>(4);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(false);
  const [isDescribingChar, setIsDescribingChar] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [currentProjectFolder, setCurrentProjectFolder] = useState<string | null>(null);
  const [scriptLanguage, setScriptLanguage] = useState<AppLanguage>('ko');
  const [targetAge, setTargetAge] = useState<string>('20대');
  const [ttsLanguage, setTtsLanguage] = useState<AppLanguage>('all');
  const [autoSourceMode, setAutoSourceMode] = useState<AutoSourceMode>('benchmark');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('shorts');
  const [targetDuration, setTargetDuration] = useState<typeof DURATION_OPTIONS[number]>('30초');
  const [scriptStructure, setScriptStructure] = useState<ScriptStructure>('narration');
  const [customSceneDensity, setCustomSceneDensity] = useState('0.5');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<string | null>(null);
  const [voiceFilter, setVoiceFilter] = useState<FavoriteFilterId>('all');
  const [mediaImageModels, setMediaImageModels] = useState<MediaModelOption[]>(DEFAULT_MEDIA_IMAGE_MODELS);
  const [mediaVideoModels] = useState<MediaModelOption[]>(() => parseVideoModelConfig((import.meta as any)?.env?.VITE_TUBEFACTORY_VIDEO_MODELS));
  const [selectedImageModel, setSelectedImageModel] = useState<string>(() => {
    const saved = localStorage.getItem(GLOBAL_IMAGE_MODEL_STORAGE_KEY);
    return saved || DEFAULT_MEDIA_IMAGE_MODELS[0].id;
  });
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>(DEFAULT_MEDIA_VIDEO_MODELS[0].id);
  const [useBackgroundReference, setUseBackgroundReference] = useState(false);
  const batchImageInputRef = useRef<HTMLInputElement | null>(null);
  const promptUploadInputRef = useRef<HTMLInputElement | null>(null);
  const sceneImageInputRefMap = useRef<Record<number, HTMLInputElement | null>>({});
  const characterImageInputRefMap = useRef<Record<string, HTMLInputElement | null>>({});
  const characterLibraryInputRef = useRef<HTMLInputElement | null>(null);

  // SEO 및 내보내기 상태
  const [seoData, setSeoData] = useState<{title: string, tags: string, description: string} | null>(null);

  // 프로젝트 히스토리 데이터
  const [projects, setProjects] = useState<{folderName: string, imageCount: number}[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch('http://localhost:3002/api/scripts/story-folders');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
         const altRes = await fetch('http://localhost:3002/api/scripts/story-folders');
         if (altRes.ok) {
            const data = await altRes.json();
            setProjects(data);
         }
      }
    } catch (err) {
      console.error('프로젝트 목록 로드 실패:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (activeStep === 'project-list') {
      fetchProjects();
    }
  }, [activeStep, fetchProjects]);

  const handleDeleteProject = async (folderName: string) => {
    if (!confirm(`"${folderName}" 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며 모든 이미지와 대본이 삭제됩니다.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/story/${encodeURIComponent(folderName)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast("✅ 프로젝트가 삭제되었습니다.", "success");
        // 목록 새로고침
        fetchProjects();
      } else {
        const errorText = await response.text();
        let errorMessage = "알 수 없는 오류";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        showToast(`삭제 실패 (${response.status}): ${errorMessage}`, "error");
      }
    } catch (err: any) {
      showToast("삭제 요청 실패: " + err.message, "error");
    }
  };

  const loadProject = async (folderName: string) => {
    setIsGenerating(true);
    showToast(`'${folderName}' 프로젝트를 불러오는 중...`, 'info');
    try {
      const storyRes = await fetch(`http://localhost:3002/api/story/${encodeURIComponent(folderName)}`);
      const storyData = storyRes.ok ? await storyRes.json() : null;
      let imgRes = await fetch(`http://localhost:3002/api/images/by-story/${encodeURIComponent(folderName)}`);
      if (!imgRes.ok) {
         imgRes = await fetch(`http://localhost:3002/api/images/by-story/${encodeURIComponent(folderName)}`);
      }
      const images = imgRes.ok ? await imgRes.json() : [];

      const loadedScenes = Array.isArray(storyData?.scenes) && storyData.scenes.length > 0
        ? storyData.scenes.map((scene: any, i: number) => ({
            ...scene,
            id: scene?.id || i + 1,
            scriptLine: scene?.scriptLine || scene?.text || '',
            imageUrl: scene?.imageUrl || '',
            isImageGenerating: false,
            assignedCharacters: scene?.assignedCharacters || (scene?.assignedCharacter ? [scene.assignedCharacter] : []),
          }))
        : images.map((img: any, i: number) => ({
            id: i + 1,
            scriptLine: img.prompt || '불러온 장면',
            imageUrl: `http://localhost:3002/generated_scripts/${img.filename}`,
            isImageGenerating: false,
            longPrompt: img.prompt,
            assignedCharacters: []
          }));

      if (loadedScenes.length > 0) {
        setScenes(loadedScenes);
        setTopic(storyData?.title || folderName);
        setCurrentProjectFolder(folderName);
        setScriptPhase('editor');
        setActiveStep(images.length > 0 ? 'media' : 'script');
        showToast('프로젝트 로드 완료!', 'success');
      } else {
        showToast('프로젝트에 생성된 데이터가 없습니다.', 'info');
      }
    } catch (err) {
      showToast('프로젝트 로드 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCurrentProject = useCallback(async (nextScenes: any[], overrides?: { title?: string; content?: string }) => {
    if (!Array.isArray(nextScenes) || nextScenes.length === 0) return null;
    const projectTitle = overrides?.title || storylines[selectedStoryIndex ?? 0]?.title || topic || 'untitled';
    const payload = {
      title: projectTitle,
      content: overrides?.content || nextScenes.map((scene) => scene.scriptLine || scene.text || '').join('\n'),
      scriptBody: nextScenes.map((scene) => scene.scriptLine || scene.text || '').join('\n'),
      scenes: nextScenes,
      folderName: currentProjectFolder || undefined,
      metadata: {
        style: selectedStyle,
        language: scriptLanguage,
        outputFormat,
        targetDuration,
        scriptStructure,
      }
    };
    const response = await fetch('http://localhost:3002/api/save-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`save-story failed: ${response.status}`);
    }
    const data = await response.json();
    if (data?.folderName) {
      setCurrentProjectFolder(data.folderName);
    }
    return data?.folderName || null;
  }, [currentProjectFolder, outputFormat, scriptLanguage, scriptStructure, selectedStoryIndex, selectedStyle, storylines, targetDuration, topic]);

  const handleGenerateSeo = async () => {
    if (scenes.length === 0) {
      showToast('대본이 없습니다.', 'error');
      return;
    }
    setIsGenerating(true);
    showToast('SEO 데이터를 분석 중입니다...', 'info');
    try {
      const fullText = scenes.map(s => s.scriptLine).join('\n');
      const prompt = `Analyze the following script and generate a viral YouTube Title, Tags, and Description.
      Script:
      ${fullText}
      
      Format (JSON):
      {
        "title": "Viral Title",
        "tags": "#tag1 #tag2 #tag3",
        "description": "SEO optimized description..."
      }`;
      
      const client = await getTextClient();
      const response = await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = parseJsonFromText(text);
      setSeoData(parsed);
      showToast('SEO 최적화 완료!', 'success');
    } catch (err) {
      console.error(err);
      showToast('SEO 생성 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const [subtitleStyle, setSubtitleStyle] = useState({ fontSize: 40, color: '#ffffff', outlineColor: '#000000', bold: true, fontFamily: 'Noto Sans KR' });
  const [subtitlePresets, setSubtitlePresets] = useState<any[]>(() => {
    const saved = localStorage.getItem('shorts-lab-subtitle-presets');
    return saved ? JSON.parse(saved) : [];
  });
  useEffect(() => {
    localStorage.setItem('shorts-lab-subtitle-presets', JSON.stringify(subtitlePresets));
  }, [subtitlePresets]);

  const handleAnalyzeScript = async () => {
    if (!topic.trim()) {
      showToast('분석할 대본 주제나 내용을 입력하세요.', 'error');
      return;
    }
    setIsGenerating(true);
    showToast('대본의 구조와 흐름을 분석 중입니다...', 'info');
    try {
      const prompt = `Analyze this script/topic for a short-form video (60s).
      Topic: ${topic}
      Provide:
      1. Hook effectiveness
      2. Pacing suggestions
      3. Key visual suggestions
      Format (JSON):
      { "hook": "...", "pacing": "...", "visual": "..." }`;
      
      const client = await getTextClient();
      const response = await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const analysis = parseJsonFromText(text);
      showToast('분석 완료: ' + analysis.hook.substring(0, 30) + '...', 'success');
    } catch (err) {
      showToast('대본 분석 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImageBySelectedModel = async (
    prompt: string,
    negativePrompt?: string,
    referenceImages?: { inlineData: { data: string, mimeType: string } }[],
    aspectRatio: string = "9:16",
    overrideModel?: string
  ) => {
    const targetModel = overrideModel || selectedImageModel;
    const isGeminiImageModel = targetModel.startsWith("gemini-");
    if (isGeminiImageModel) {
      const result = await generateImage(prompt, { aspectRatio, model: targetModel }, undefined, referenceImages);
      return extractGeneratedImageBase64(result);
    }
    const result = await generateImageWithImagen(prompt, negativePrompt || "", { aspectRatio, model: targetModel });
    return extractGeneratedImageBase64(result);
  };

  const handleGenerateCharacterImage = async (charId: string) => {
    const char = characters.find((item) => item.id === charId);
    if (!char || !char.isActive) return;
    setIsGeneratingCharImage(charId);
    const promptParts = [
      `${char.gender || ''} ${char.age || ''}`,
      char.style || '',
      char.aiOptimizedPrompt || '',
      selectedStyle && selectedStyle !== '전체' ? `${selectedStyle} style` : '',
      'portrait, full body, consistent character sheet, clean background, 9:16',
    ]
      .map((part) => `${part}`.trim())
      .filter(Boolean);
    if (promptParts.length === 0) {
      showToast(`${char.name}의 스타일 묘사를 먼저 입력해주세요.`, 'error');
      return;
    }

    // 멀티 슬롯 이미지가 있다면 조합 (주로 자체 스타일 업그레이드 시 사용 가능)
    const referenceImages: { inlineData: { data: string, mimeType: string } }[] = [];
    if (char.referenceSlots) {
      for (const slotKey of CHARACTER_REFERENCE_SLOTS) {
        const slot = char.referenceSlots[slotKey as keyof typeof char.referenceSlots];
        if (slot?.url) {
           try {
             const blobRes = await fetch(slot.url);
             const blob = await blobRes.blob();
             const reader = new FileReader();
             const base64Data = await new Promise<string>((resolve) => {
               reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
               reader.readAsDataURL(blob);
             });
             if (base64Data) {
                referenceImages.push({ inlineData: { data: base64Data, mimeType: blob.type || 'image/png' } });
             }
           } catch(e) {}
        }
      }
    }

    try {
      const base64 = await generateImageBySelectedModel(promptParts.join(', '), char.negativePrompt, referenceImages.length > 0 ? referenceImages : undefined);
      if (!base64) throw new Error('캐릭터 이미지 생성 실패');
      handleUpdateCharacter(charId, 'referenceImageUrl', `data:image/png;base64,${base64}`);
      handleUpdateCharacter(charId, 'referenceImage', null as any);
      showToast(`${char.name} 이미지 생성 완료`, 'success');
    } catch (error) {
      console.error(error);
      showToast(`${char.name} 이미지 생성 실패`, 'error');
    } finally {
      setIsGeneratingCharImage(null);
    }
  };


  // 1장 업로드 -> 4장 생성 -> 슬롯 자동 배치
  const handleGenerateCharacterSheet = async (charId: string, file: File) => {
    setIsGeneratingCharImage(charId);
    const char = characters.find((c) => c.id === charId);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;
      const mimeType = file.type || "image/png";
      const base64Only = base64Data.split(",")[1];
      const refImage = [{ inlineData: { data: base64Only, mimeType } }];
      const charStyle = char?.style || "";
      const charGender = char?.gender || "female";
      const charAge = char?.age || "20대";
      const baseDesc = [charGender, charAge, charStyle].filter(Boolean).join(", ");

      // 한 장에 4가지 앵글을 모두 담는 캐릭터 시트 프롬프트
      const sheetPrompt = `professional character reference sheet, white background, studio lighting,
        TOP ROW left to right: full body front view, full body side view, full body back view,
        BOTTOM ROW center: large face and upper body close-up portrait,
        all views of EXACTLY the same person from reference image,
        same face same hair same skin same body shape,
        character wearing basic tight neutral clothing to clearly show body type,
        photorealistic, 4K, do NOT change anything about the person's physical features,
        ${baseDesc}`;

      // Imagen 모델은 이미지 참조(Image-to-Image)를 지원하지 않으므로 
      // 캐릭터 시트 생성 시에는 반드시 Gemini 이미지 모델을 사용합니다.
      let generationModel = selectedImageModel;
      if (!generationModel.startsWith("gemini-")) {
        generationModel = "gemini-2.5-flash-image";
      }

      const base64 = await generateImageBySelectedModel(sheetPrompt, "", refImage, "16:9", generationModel);


      if (base64) {
        const url = `data:image/png;base64,${base64}`;
        setCharacters(prev => prev.map(c => c.id === charId
          ? { ...c, referenceImageUrl: url }
          : c
        ));
        showToast("캐릭터 시트 생성 완료! (앞/옆/뒤/클로즈업 1장)", "success");
      } else {
        showToast("이미지 생성 결과가 없습니다.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("캐릭터 시트 생성 실패", "error");
    } finally {
      setIsGeneratingCharImage(null);
    }
  };
  const handleGenerateAllCharacterImages = async () => {
    const activeCharacters = characters.filter((char) => char.isActive);
    if (activeCharacters.length === 0) {
      showToast('활성 캐릭터가 없습니다.', 'error');
      return;
    }
    for (const char of activeCharacters) {
      await handleGenerateCharacterImage(char.id);
    }
  };

  const handleGenerateVariation = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isImageGenerating: true } : s));
    showToast(`${sceneId}번 장면의 다른 버전을 생성합니다...`, 'info');
    try {
      let finalPrompt = (scene.longPrompt || scene.shortPrompt || scene.text) + ', different perspective, alternative composition';
      const base64Image = await generateImageBySelectedModel(finalPrompt);
      if (!base64Image) throw new Error('변주 이미지 생성 실패');
      const imageUrl = `data:image/png;base64,${base64Image}`;
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageUrl, isImageGenerating: false, imageError: false } : s));
      showToast('새로운 버전 생성 완료', 'success');
    } catch (e) {
      showToast('변주 생성 실패', 'error');
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isImageGenerating: false, imageError: true } : s));
    }
  };

  const handleExport = (type: 'srt' | 'capcut') => {
    if (scenes.length === 0) {
      showToast('내보낼 데이터가 없습니다.', 'error');
      return;
    }
    const fileName = topic || 'shorts_project';
    try {
      const exportData = {
        title: fileName,
        scenes: scenes.map((scene, index) => ({
          number: index + 1,
          text: scene.scriptLine || scene.text || '',
          imageUrl: scene.imageUrl,
          audioUrl: sceneAudioUrls[index],
          duration: 5,
        })),
      };
      if (type === 'srt') {
        const srt = generateSRT(exportData);
        downloadFile(srt, `${fileName}.srt`, 'application/x-subrip');
        showToast('SRT 자막 파일이 다운로드되었습니다.', 'success');
      } else {
        const xml = generateCapCutXML(exportData);
        downloadFile(xml, `${fileName}.xml`, 'application/xml');
        showToast('CapCut XML 파일이 다운로드되었습니다.', 'success');
      }
    } catch (err) {
      showToast('내보내기 실패', 'error');
    }
  };

  const handleUpdateCharacter = (id: string, field: string, value: string | File) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const handleDropImage = (charId: string, file: File) => {
    const url = URL.createObjectURL(file);
    handleUpdateCharacter(charId, 'referenceImageUrl', url);
    handleUpdateCharacter(charId, 'referenceImage', file);
  };

  // ── IndexedDB 폴더 핸들 저장/복원 헬퍼 ──
  const saveDirHandleToIDB = async (handle: FileSystemDirectoryHandle): Promise<void> => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("tubefactory-idb", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("handles");
      req.onsuccess = () => {
        const tx = req.result.transaction("handles", "readwrite");
        tx.objectStore("handles").put(handle, "libraryDir");
        tx.oncomplete = () => { req.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  };

  const loadDirHandleFromIDB = async (): Promise<FileSystemDirectoryHandle | null> => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("tubefactory-idb", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("handles");
      req.onsuccess = () => {
        const tx = req.result.transaction("handles", "readonly");
        const getReq = tx.objectStore("handles").get("libraryDir");
        getReq.onsuccess = () => { req.result.close(); resolve(getReq.result ?? null); };
        getReq.onerror = () => reject(getReq.error);
      };
      req.onerror = () => reject(req.error);
    });
  };

  const getOrPickDirHandle = async (): Promise<FileSystemDirectoryHandle> => {
    // 1순위: 메모리에 있고 권한 있으면 바로 사용
    if (libraryDirHandle) {
      const perm = await libraryDirHandle.queryPermission({ mode: "readwrite" });
      if (perm === "granted") return libraryDirHandle;
      const req = await libraryDirHandle.requestPermission({ mode: "readwrite" });
      if (req === "granted") return libraryDirHandle;
    }
    // 2순위: IndexedDB에서 복원
    try {
      const saved = await loadDirHandleFromIDB();
      if (saved) {
        const perm = await saved.queryPermission({ mode: "readwrite" });
        if (perm === "granted") { setLibraryDirHandle(saved); return saved; }
        const req = await saved.requestPermission({ mode: "readwrite" });
        if (req === "granted") { setLibraryDirHandle(saved); return saved; }
      }
    } catch { /* IDB 실패시 폴더 선택으로 fallback */ }
    // 3순위: 새로 폴더 선택
    const picked = await (window as any).showDirectoryPicker({ mode: "readwrite" });
    setLibraryDirHandle(picked);
    setLibraryDirName(picked.name);
    localStorage.setItem("tubefactory-library-dir", picked.name);
    await saveDirHandleToIDB(picked);
    return picked;
  };



  const handleSaveCharacterLibrary = async () => {
    try {
      // 1. 캐릭터 데이터 준비
      const serializable = characters.map((char) => ({
        id: char.id,
        name: char.name,
        gender: char.gender,
        age: char.age,
        hairStyle: char.hairStyle,
        hairColor: char.hairColor,
        faceType: char.faceType,
        eyeColor: char.eyeColor,
        bodyType: char.bodyType,
        uniqueFeatures: char.uniqueFeatures,
        outfitStyle: char.outfitStyle,
        style: char.style,
        aiOptimizedPrompt: char.aiOptimizedPrompt,
        negativePrompt: char.negativePrompt || "",
        isActive: char.isActive,
        referenceImageUrl: char.referenceImageUrl || null,
      }));

      const payload = {
        version: 3,
        savedAt: new Date().toISOString(),
        characters: serializable
      };

      // 2. 윈도우 기본 다른 이름으로 저장 (Save As) 창 열기
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: `캐릭터_${new Date().toISOString().slice(0, 10)}.json`,
        types: [{
          description: 'JSON 파일',
          accept: { 'application/json': ['.json'] },
        }],
      });

      // 3. 파일 쓰기 (사용자가 선택한 위치에 파일 저장)
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();

      showToast(`✅ 캐릭터 저장 완료!`, "success");

      // 4. localStorage 백업 (이미지 제외)
      try {
        const lightPayload = {
          ...payload,
          characters: serializable.map((c) => ({ ...c, referenceImageUrl: null }))
        };
        localStorage.setItem(CHARACTER_LIBRARY_STORAGE_KEY, JSON.stringify(lightPayload));
      } catch (e) {
        console.warn("localStorage 백업 실패:", e);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast("저장 실패: " + err.message, "error");
      }
    }
  };

  const handleLoadCharacterLibrary = async () => {
    try {
      // 1. 윈도우 기본 파일 열기 창 (Open File)
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'JSON 파일',
          accept: { 'application/json': ['.json'] },
        }],
        multiple: false
      });

      // 2. 파일에서 데이터 읽기
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.characters || !Array.isArray(parsed.characters)) {
        showToast("올바르지 않은 캐릭터 파일입니다.", "error");
        return;
      }
      
      setCharacters(parsed.characters);
      showToast("✅ 불러오기 완료!", "success");
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast("불러오기 실패: " + err.message, "error");
      }
    }
  };

  const handleSaveSingleCharacter = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    try {
      const payload = {
        version: 3,
        type: "single-character",
        savedAt: new Date().toISOString(),
        character: {
          ...char,
          // 저장 시 현재 입력된 이름을 확실히 반영
          name: char.name || "이름 없는 캐릭터"
        }
      };

      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: `${char.name || '캐릭터'}.json`,
        types: [{
          description: 'JSON 파일',
          accept: { 'application/json': ['.json'] },
        }],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();

      showToast(`✅ "${char.name}" 저장 완료!`, "success");
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast("저장 실패: " + err.message, "error");
      }
    }
  };

  const handleLoadSingleCharacter = async (charId: string) => {
    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'JSON 파일',
          accept: { 'application/json': ['.json'] },
        }],
        multiple: false
      });

      const file = await fileHandle.getFile();
      const fileName = file.name.replace(/\.[^/.]+$/, ""); // 확장자 제거
      const text = await file.text();
      const parsed = JSON.parse(text);

      // 개별 캐릭터 파일이거나 기존 라이브러리의 첫 번째 캐릭터를 가져옴
      let loadedChar = parsed.character || (parsed.characters && parsed.characters[0]);

      if (!loadedChar) {
        showToast("올바르지 않은 캐릭터 파일입니다.", "error");
        return;
      }

      // 만약 저장된 이름이 기본 형식이면 파일 이름으로 교체
      if (!loadedChar.name || loadedChar.name.startsWith("캐릭터 ")) {
        loadedChar = { ...loadedChar, name: fileName };
      }

      setCharacters(prev => prev.map(c => {
        if (c.id === charId) {
          return {
            ...loadedChar,
            id: charId, // 현재 슬롯 ID 유지
            isActive: true
          };
        }
        return c;
      }));

      showToast(`✅ "${loadedChar.name}" 불러오기 완료!`, "success");
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast("불러오기 실패: " + err.message, "error");
      }
    }
  };

const handleDuplicateCharacter = (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    const newChar = {
      ...char,
      id: `char_dup_${Date.now()}`,
      name: `${char.name} (복사)`,
    };
    setCharacters(prev => [...prev, newChar]);
    showToast(`"${char.name}" 캐릭터가 복사됐습니다.`, "success");
  };

  const [imageEffect, setImageEffect] = useState('none');
  const IMAGE_EFFECTS = [
    { id: 'none', label: '기본 (None)', prompt: '' },
    { id: 'vintage', label: '빈티지 (Vintage)', prompt: ', vintage film look, low saturation, grainy' },
    { id: 'noir', label: '누아르 (Noir)', prompt: ', dramatic noir, black and white, high contrast' },
    { id: 'cyberpunk', label: '사이버펑크 (Cyber)', prompt: ', cyberpunk neon lighting, futuristic colors' },
    { id: 'watercolor', label: '수채화 (Watercolor)', prompt: ', watercolor illustration, soft brush strokes' }
  ];


  
  const [isOptimizingChar, setIsOptimizingChar] = useState<string | null>(null);
  const [isGeneratingCharImage, setIsGeneratingCharImage] = useState<string | null>(null);
  const [isDraggingSheet, setIsDraggingSheet] = useState<string | null>(null);
  const [libraryDirHandle, setLibraryDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [libraryDirName, setLibraryDirName] = useState<string>(() => localStorage.getItem("tubefactory-library-dir") || "");
  const [sheetUploadFile, setSheetUploadFile] = useState<Record<string, File | null>>({});
  const [sheetUploadPreview, setSheetUploadPreview] = useState<Record<string, string | null>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isOptimizingNegativeChar, setIsOptimizingNegativeChar] = useState<string | null>(null);

  const handleOptimizeNegativePrompt = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    let baseStyle = char.style || char.aiOptimizedPrompt;
    if (!baseStyle.trim()) {
      showToast('스타일 묘사나 최적화 프롬프트를 먼저 입력해주세요.', 'error');
      return;
    }

    setIsOptimizingNegativeChar(charId);
    showToast('AI가 적절한 네거티브 프롬프트를 생성합니다...', 'info');
    try {
      const prompt = `Generate a comprehensive negative prompt for an AI image generation model (like Stable Diffusion or Midjourney) based on the following character description. 
Focus on preventing character distortion, bad anatomy, blurriness, and style mismatch.
Return ONLY the english comma-separated keywords.

Character Description: ${baseStyle}`;
      
      const client = await getTextClient();
      const response = await client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      });
      const generatedNegPrompt = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      
      if (generatedNegPrompt) {
        handleUpdateCharacter(charId, 'negativePrompt', generatedNegPrompt);
        showToast('네거티브 프롬프트가 자동 생성되었습니다.', 'success');
      } else {
        throw new Error('생성 결과가 비어 있습니다.');
      }
    } catch (err) {
      console.error(err);
      showToast('네거티브 프롬프트 생성 실패', 'error');
    } finally {
      setIsOptimizingNegativeChar(null);
    }
  };

  const handleOptimizeCharacter = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    setIsOptimizingChar(charId);

    // 연령/성별 영문 변환 (이미지 생성 최적화용)
    const ageMap: Record<string, string> = { '10대': 'teenage', '20대': '20s', '30대': '30s', '40대': '40s', '50대 이상': 'mature 50s' };
    const genderMap: Record<string, string> = { '여성': 'woman', '남성': 'man' };
    const engAge = ageMap[char.age] || char.age || '20s';
    let engGender = genderMap[char.gender] || char.gender || 'woman';
    if (char.age === '10대') engGender = char.gender === '남성' ? 'boy' : 'girl';
    
    let engBase = `${engAge} ${engGender}`;
    // 여성이 선택된 경우, 나이에 상관없이 관리가 잘 된 아름다운 한국 여성 베이스 프롬프트 강제 주입
    if (char.gender === '여성') {
      engBase += `, extremely beautiful korean ${engGender}, highly detailed beautiful face, well-maintained fit body, flawless smooth skin, elegant, k-beauty`;
    }

    try {
      // 1. 참조 이미지(캐릭터 시트 또는 원본 업로드 이미지)가 있으면 이미지 분석으로 프롬프트 생성
      const previewUrl = char.referenceImageUrl || sheetUploadPreview[charId];
      if (previewUrl) {
        try {
          const res = await fetch(previewUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const base64Only = base64Data.split(",")[1];
          const mimeType = blob.type || "image/png";
          
          const ai = new GoogleGenAI({ apiKey: getApiKey() });
          const analyzeResult = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{
              parts: [
                { inlineData: { data: base64Only, mimeType } },
                { text: `Analyze this person in the image and create a detailed English prompt for image generation. The character MUST be described as: ${engBase}. Focus strictly on PHYSICAL characteristics ONLY: face features (eye color, face shape, skin tone, lips), hair (style, color, length), and detailed body type (figure, curves, breast size, muscle tone). Format: concise comma-separated descriptors suitable for image generation. DO NOT include any description of clothing, outfits, or accessories whatsoever. Example format: "${engBase}, oval face, bright brown eyes, full lips, long wavy dark brown hair, slim curvy build, large breasts, fair skin"` }
              ]
            }]
          });
          const optimized = analyzeResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (!optimized) throw new Error("분석 결과 없음");
          
          handleUpdateCharacter(charId, "aiOptimizedPrompt", optimized.trim());
          showToast("이미지 분석으로 프롬프트가 자동 생성되었습니다.", "success");
          return;
        } catch(e) {
          console.warn("이미지 분석 실패:", e);
          showToast("이미지 분석 실패, 텍스트 방식으로 시도합니다.", "warning");
        }
      }
      
      // 2. 참조 이미지가 없거나 분석 실패 시 텍스트 기반으로 프롬프트 생성
      const traits = [
        engBase, char.bodyType,
        char.faceType ? `${char.faceType} face` : "",
        char.eyeColor ? `${char.eyeColor} eyes` : "",
        char.hairStyle ? `${char.hairStyle} hair` : "",
        char.hairColor ? `${char.hairColor} color` : "",
        char.outfitStyle, char.uniqueFeatures
      ].filter(Boolean).join(", ");
      
      // 성별, 나이, 스타일(사용자 입력값), 세부 속성을 모두 결합하여 전달
      const baseStyle = [traits, char.style].filter(Boolean).join(". ");
      
      if (!baseStyle.trim()) {
        showToast("스타일 묘사나 상세 속성(성별/연령 등)을 먼저 입력해주세요.", "error");
        return;
      }
      
      const optimized = await optimizeCharacterPrompt(baseStyle);
      handleUpdateCharacter(charId, "aiOptimizedPrompt", optimized);
      showToast("입력된 텍스트 기반으로 AI 프롬프트가 최적화되었습니다.", "success");
    } catch (err) {
      console.error(err);
      showToast("프롬프트 최적화에 실패했습니다.", "error");
    } finally {
      setIsOptimizingChar(null);
    }
  };

  const handleDescribeFromImage = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !char.referenceImageUrl) {
      showToast('참조 이미지를 먼저 업로드해주세요.', 'error');
      return;
    }

    setIsDescribingChar(charId);
    showToast('이미지를 분석하여 캐릭터 DNA를 추출 중입니다...', 'info');

    try {
      // Base64 데이터 추출
      let base64Data = '';
      
      // standalone-lite에서는 referenceImage File 객체가 있으므로 이를 우선 사용
      const file = char.referenceImage as File;
      if (!file) {
        if (char.referenceImageUrl && char.referenceImageUrl.startsWith('blob:')) {
          const res = await fetch(char.referenceImageUrl);
          const blob = await res.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]);
            };
          });
          reader.readAsDataURL(blob);
          base64Data = await base64Promise;
        } else {
          throw new Error('이미지 데이터가 없습니다.');
        }
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
        });
        reader.readAsDataURL(file);
        base64Data = await base64Promise;
      }

      const result = await describeCharacterFromImage(base64Data);
      
      if (result) {
        // 추출된 데이터를 캐릭터 상태에 매핑
        const updates = {
          gender: result.gender || char.gender,
          age: result.age || char.age,
          hairStyle: result.hairStyle || '',
          hairColor: result.hairColor || '',
          faceType: result.faceType || '',
          eyeColor: result.eyeColor || '',
          bodyType: result.bodyType || '',
          uniqueFeatures: result.uniqueFeatures || '',
          outfitStyle: result.outfitStyle || '',
          style: result.style || char.style // 원문 묘사도 업데이트
        };

        setCharacters(prev => prev.map(c => c.id === charId ? { ...c, ...updates } : c));
        showToast('이미지 분석 및 DNA 추출 완료!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('이미지 분석 실패', 'error');
    } finally {
      setIsDescribingChar(null);
    }
  };

  // 3. 캐릭터 일관성 데이터
  const createCharacter = (index: number) => ({
    id: `char_slot_${index + 1}_${Date.now()}`,
    name: `캐릭터 ${index + 1}`,
    referenceImage: null,
    referenceImageUrl: null,
    // 멀티 참조 이미지 슬롯 (정면/45도/측면/클로즈업)
    referenceSlots: {} as Partial<Record<CharacterReferenceSlot, { file: File | null; url: string | null }>>,
    gender: '여성',
    age: '20대',
    hairStyle: '',
    hairColor: '',
    faceType: '',
    eyeColor: '',
    bodyType: '',
    uniqueFeatures: '',
    outfitStyle: '',
    style: '',
    aiOptimizedPrompt: '',
    negativePrompt: '',
    isActive: index === 0
  });
  const [characters, setCharacters] = useState<any[]>(() => {
    try {
      const autoSaved = localStorage.getItem("tubefactory-autosave");
      if (autoSaved) {
        const parsed = JSON.parse(autoSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...createCharacter(0),
            ...c,
            referenceImageUrl: null,
            referenceSlots: {},
          }));
        }
      }
    } catch(e) { console.warn("자동 저장 복원 실패:", e); }
    return [createCharacter(0), createCharacter(1)];
  });

  // 자동 저장 (characters 변경 시 localStorage에 텍스트 정보만 저장)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const autoSave = characters.map(c => ({
          ...c,
          referenceImageUrl: null,
          referenceSlots: {},
        }));
        localStorage.setItem("tubefactory-autosave", JSON.stringify(autoSave));
      } catch(e) { /* 저장 실패 무시 */ }
    }, 2000);
    return () => clearTimeout(timer);
  }, [characters]);



  // 4. TTS 및 이미지 생성 상태
  const [selectedTtsEngine, setSelectedTtsEngine] = useState('elevenlabs');
  const [selectedVoice, setSelectedVoice] = useState('gigi');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [sceneAudioUrls, setSceneAudioUrls] = useState<Record<number, string>>({});
  const [ttsLoadingMap, setTtsLoadingMap] = useState<Record<number, boolean>>({});
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOptionId>('natural');
  const [toneValue, setToneValue] = useState(50);
  const [previewText, setPreviewText] = useState('안녕하세요. 이 설정으로 생성되는 음성 샘플입니다. 속도와 톤을 먼저 확인해보세요.');
  const [audioHistory, setAudioHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('shorts-lab-audio-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [favoriteVoices, setFavoriteVoices] = useState<any[]>(() => {
    const saved = localStorage.getItem('shorts-lab-favorite-voices');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('shorts-lab-audio-history', JSON.stringify(audioHistory));
  }, [audioHistory]);

  useEffect(() => {
    localStorage.setItem('shorts-lab-favorite-voices', JSON.stringify(favoriteVoices));
  }, [favoriteVoices]);

  useEffect(() => {
    let isMounted = true;
    const loadImageModels = async () => {
      try {
        const models = await fetchAvailableModels();
        if (!isMounted) return;
        const mapped = (Array.isArray(models) ? models : []).map((modelId) => ({
          id: modelId,
          label: modelId.replace(/^imagen-/, 'Imagen-').replace(/-generate-001$/, ''),
          credit: modelId.startsWith('gemini-') ? 'API' : 'API',
          note: modelId.includes('fast') ? '속도 우선' : modelId.includes('ultra') ? '고품질' : '기본',
        }));
        const merged = [...DEFAULT_MEDIA_IMAGE_MODELS, ...mapped];
        const deduped = new Map<string, MediaModelOption>();
        merged.forEach((model) => deduped.set(model.id, model));
        const nextModels = Array.from(deduped.values());
        setMediaImageModels(nextModels);

        const savedModel = localStorage.getItem(GLOBAL_IMAGE_MODEL_STORAGE_KEY);
        const firstModel = nextModels[0]?.id || DEFAULT_MEDIA_IMAGE_MODELS[0].id;
        const preferred = savedModel && nextModels.some((model) => model.id === savedModel) ? savedModel : firstModel;
        setSelectedImageModel(preferred);
      } catch (error) {
        console.warn('[TubeFactory] 이미지 모델 로드 실패, 기본값 사용:', error);
      }
    };
    loadImageModels();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(GLOBAL_IMAGE_MODEL_STORAGE_KEY, selectedImageModel);
  }, [selectedImageModel]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GLOBAL_IMAGE_MODEL_STORAGE_KEY || !event.newValue) return;
      setSelectedImageModel(event.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 엔진 변경 시 해당 엔진의 기본 보이스로 자동 전환
  useEffect(() => {
    const isElevenLabs = selectedTtsEngine === 'elevenlabs' || selectedTtsEngine === 'multilingual-v2';
    if (isElevenLabs) {
      setSelectedVoice('seulgi'); // ElevenLabs 기본: 슬기 (한국어 추천)
    } else if (selectedTtsEngine === 'gemini') {
      setSelectedVoice('Kore');   // Gemini 기본: Kore (한국어 추천)
    }
    setVoiceSearch('');
    setVoiceFilter('all');
  }, [selectedTtsEngine]);

  // 사이드바 메뉴 아이템 정의
    const menuItems: { id: Step; label: string; icon: React.ReactNode; group: string }[] = [
      { id: 'status-board', label: '작업 현황판', icon: <Bot size={18} />,     group: '시스템' },
      { id: 'project-list', label: '프로젝트 목록', icon: <LayoutGrid size={18} />, group: '관리' },
      { id: 'style',        label: '영상 스타일',   icon: <Sparkles size={18} />,   group: '기획' },
      { id: 'script',       label: '대본 생성',     icon: <FileText size={18} />,   group: '기획' },
      { id: 'tts',          label: 'TTS 음성',     icon: <Mic2 size={18} />,       group: '음성' },
      { id: 'character',    label: '캐릭터 디자인',   icon: <Users size={18} />,      group: '제작' },
      { id: 'media',        label: '이미지/영상 생성', icon: <ImageIcon size={18} />, group: '제작' },
      { id: 'thumbnail',    label: '썸네일 제작',   icon: <Camera size={18} />,     group: '제작' },
      { id: 'image-effect',  label: '이미지 효과',    icon: <Wand2 size={18} />,      group: '제작' },
      { id: 'fusion',       label: '퓨전 스튜디오', icon: <Maximize2 size={18} />,  group: '제작' },
      { id: 'edit',         label: '타임라인 편집', icon: <Scissors size={18} />,   group: '편집' },
      { id: 'subtitle',      label: '자막 스타일',    icon: <Type size={18} />,       group: '편집' },
      { id: 'seo',          label: 'SEO/메타데이터', icon: <Search size={18} />,     group: '완성' },
      { id: 'export',       label: '내보내기',     icon: <Download size={18} />,   group: '완성' },
      { id: 'tubeflow',     label: '튜브플로우',     icon: <Zap size={18} />,       group: '도구' },
    ];


  // ============================================
  // [로직] 1. AI 줄거리 및 대본 생성
  // ============================================
  const handleGenerateStorylines = async () => {
    const seedTopic = topic.trim() || benchmarkSource.trim();
    if (!seedTopic) {
      showToast('주제나 벤치마킹 설명을 입력해주세요.', 'error');
      return;
    }
    setIsGenerating(true);
    
    try {
      const result = await generateBenchmarkStorylinePackage(seedTopic, 10, benchmarkSource.trim());
      setBenchmarkAnalysis(result.analysis);
      setStorylines(result.storylines);
      setSelectedStoryIndex(result.storylines.length > 0 ? 0 : null);
      setSelectedStoryDraft(result.storylines[0]?.content || '');
      setScriptPhase('storylines');
      setIsGenerating(false);
      showToast(benchmarkSource.trim() ? '벤치마킹 분석과 파생 줄거리 생성을 완료했습니다.' : 'AI가 바이럴 줄거리를 생성했습니다.', 'success');
    } catch (err) {
      showToast('AI 연결에 실패했습니다.', 'error');
      setIsGenerating(false);
    }
  };

  const handleSelectStoryline = (index: number) => {
    const selectedStory = storylines[index];
    if (!selectedStory) return;
    setSelectedStoryIndex(index);
    setSelectedStoryDraft(selectedStory.content);
  };

  const handleConfirmStoryline = async () => {
    if (selectedStoryIndex === null) {
      showToast('줄거리를 먼저 선택해주세요.', 'error');
      return;
    }

    setIsGenerating(true);
    showToast('AI가 대본을 작성하고 장면을 추출합니다...', 'info');
    
    try {
      const selectedStory = storylines[selectedStoryIndex] || { title: topic, content: topic };
      let compositionPrompt = '';
      if (sceneComposition === '1-sentence') compositionPrompt = '반드시 1개의 문장마다 1개의 씬(Scene)을 분리하여 구성할 것.';
      else if (sceneComposition === '2-sentence') compositionPrompt = '반드시 2개의 문장을 묶어서 1개의 씬(Scene)으로 분리할 것.';
      else if (sceneComposition === 'custom') compositionPrompt = `반드시 ${customSentenceCount}개의 문장을 묶어서 1개의 씬(Scene)으로 분리할 것.`;
      
      const languageLabel = LANGUAGE_OPTIONS.find((option) => option.id === scriptLanguage)?.label || '한국어';
      const formatLabel = OUTPUT_FORMATS.find((option) => option.id === outputFormat)?.label || '쇼츠 (9:16)';
      const structureLabel = SCRIPT_STRUCTURE_OPTIONS.find((option) => option.id === scriptStructure)?.label || '내레이션만';
      const benchmarkContext = benchmarkAnalysis
        ? `\n[벤치마킹 분석]\n- 핵심 요약: ${benchmarkAnalysis.sourceSummary}\n- 후킹 방식: ${benchmarkAnalysis.hookPattern}\n- 전개 구조: ${benchmarkAnalysis.narrativeStructure}\n- 톤/말투: ${benchmarkAnalysis.toneStyle}\n- 나레이션 습관: ${benchmarkAnalysis.narrationHabit}\n- 재구성 규칙: ${benchmarkAnalysis.rebuildProtocol}\n- 주의사항: 원문 문장/고유 장면/고유 표현을 복사하지 말고 구조만 참고할 것.`
        : '';
      const customContext = `[제작 요구사항]
- ⚠️ CRITICAL: scriptBody는 반드시 최소 8문장 이상 생성할 것 (8문장 미만 절대 금지)
- ⚠️ CRITICAL: scenes는 scriptBody 문장 수와 동일하게 최소 8개 이상 생성할 것

- 출력 언어: ${languageLabel}
- 포맷: ${formatLabel}
- 목표 러닝타임: ${targetDuration}
- 대본 구성: ${structureLabel}
- 소스 모드: ${AUTO_SOURCE_MODES.find((mode) => mode.id === autoSourceMode)?.label || '영상참고 10주제'}
- 장면 밀도 기준: ${customSceneDensity} 씬
${compositionPrompt}
[선택 줄거리]
${selectedStory.title}
${selectedStoryDraft || selectedStory.content}${benchmarkContext}`;
      
      // 활성 캐릭터를 WomanA/WomanB/ManA 슬롯에 매핑
      const activeChars = characters.filter(c => c.isActive);
      const femaleChars = activeChars.filter(c => c.gender === '여성');
      const maleChars = activeChars.filter(c => c.gender === '남성');

      const characterContext = activeChars.length > 0 ? `
[캐릭터 설정]
${femaleChars[0] ? `WomanA: 이름=${femaleChars[0].name}, 헤어=${femaleChars[0].hairStyle || '긴 웨이브'}, 나이=${femaleChars[0].age || targetAge}, 체형=${femaleChars[0].bodyType || '슬림'}, 특징=${femaleChars[0].uniqueFeatures || ''}` : ''}
${femaleChars[1] ? `WomanB: 이름=${femaleChars[1].name}, 헤어=${femaleChars[1].hairStyle || '단발'}, 나이=${femaleChars[1].age || targetAge}, 체형=${femaleChars[1].bodyType || '슬림'}, 특징=${femaleChars[1].uniqueFeatures || ''}` : ''}
${maleChars[0] ? `ManA: 이름=${maleChars[0].name}, 헤어=${maleChars[0].hairStyle || '단정한 단발'}, 나이=${maleChars[0].age || targetAge}, 체형=${maleChars[0].bodyType || '탄탄한 체형'}, 특징=${maleChars[0].uniqueFeatures || ''}` : ''}
- 의상은 주제와 대본에 맞게 LLM이 고급스럽고 세련된 의상을 자유롭게 선택 (고정 의상 없음)
- 나이가 들어도 관리를 잘 한 아름다운 여성, 짧고 타이트한 의상이 어울리는 글래머러스한 실루엣
- 씬마다 동일 캐릭터는 동일 의상 유지 (일관성 필수)
` : '';

      const response = await generateStory({
        engineVersion: 'V3_COSTAR' as any,
        category: 'short',
        scenarioMode: 'default' as any,
        dialect: 'standard' as any,
        targetService: 'GEMINI',
        customContext: customContext + characterContext,
        targetAge: targetAge
      });

      
      let parsedLines: string[] = [];
      if (response && response.scriptBody) {
        parsedLines = response.scriptBody.split('\n').map((l: string) => l.trim()).filter((l: string) => l !== '');
      }

      if (response && response.scenes && response.scenes.length > 0) {
        const generatedScenes = response.scenes.map((s: any, i: number) => {
          let fallbackText = s.scriptLine || s.text || '';
          if (!fallbackText && parsedLines.length > 0) {
            const chunkCount = Math.max(1, Math.round(parsedLines.length / response.scenes.length));
            const startIdx = i * chunkCount;
            const endIdx = Math.min(startIdx + chunkCount, parsedLines.length);
            fallbackText = parsedLines.slice(startIdx, endIdx).join(' ');
          }
          return {
            ...s,
            id: i + 1,
            scriptLine: fallbackText,
            shortPrompt: s.shortPrompt || s.text || '',
            longPrompt: s.longPrompt || s.shortPrompt || s.text || '',
            // LLM 자동배정 필드 보존
            shotType: s.shotType || 'single-shot',
            characterIds: s.characterIds || [],
            cameraAngle: s.cameraAngle || '',
            background: s.background || '',
            action: s.action || '',
            emotionBeat: s.emotionBeat || '',
            lockedOutfits: s.lockedOutfits || response.lockedOutfits || {},
            assignedCharacters: []
          };
        });
        setScenes(generatedScenes);
        await saveCurrentProject(generatedScenes, {
          title: selectedStory.title,
          content: selectedStoryDraft || selectedStory.content,
        });
        setScriptPhase('editor');
        showToast('대본 생성이 완료되었습니다.', 'success');
      } else if (parsedLines.length > 0) {
        const generatedScenes = parsedLines.map((line: string, i: number) => ({
          id: i + 1,
          scriptLine: line,
          text: line,
          shortPrompt: '',
          longPrompt: '',
          shortPromptKo: line,
          longPromptKo: line,
          shotType: 'single-shot' as const,
          characterIds: ['WomanA'],
          cameraAngle: i === 0 ? 'close-up portrait shot' : 'full body wide shot',
          background: '',
          action: '',
          lockedOutfits: {},
          imageUrl: '',
          isImageGenerating: false,
          assignedCharacters: []
        }));
        setScenes(generatedScenes);
        await saveCurrentProject(generatedScenes, {
          title: selectedStory.title,
          content: selectedStoryDraft || selectedStory.content,
        });
        setScriptPhase('editor');
        showToast('대본 생성이 완료되었습니다. (자동 씬 분리)', 'success');
      } else {
        throw new Error("No scenes generated");
      }
    } catch (err) {
      console.error(err);
      showToast('대본 생성에 실패했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================================
  // [로직] 2. 실제 이미지 생성 연동 (Imagen 3)
  // TubeFactory 오리지널 스타일: 참조 이미지(캐릭터) + 스타일 + 대본 프롬프트
  // ============================================
  const handleGenerateImage = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s =>
      s.id === sceneId ? { ...s, isImageGenerating: true } : s
    ));

    try {
      // ① 캐릭터 ID: LLM 자동배정 우선, UI 수동배정 폴백
      const rawCharacterIds: string[] =
        (scene.characterIds && scene.characterIds.length > 0)
          ? scene.characterIds
          : (scene.assignedCharacters && scene.assignedCharacters.length > 0)
            ? scene.assignedCharacters
            : [];

      // ② 샷타입 결정
      const resolvedShotType: 'single-shot' | 'two-shot' | 'group-shot' =
        scene.shotType ||
        (rawCharacterIds.length >= 3 ? 'group-shot' :
         rawCharacterIds.length === 2 ? 'two-shot' : 'single-shot');

      // ③ 캐릭터 정보 조회
    const getCharInfo = (slotId: string) => {
      // 1순위: ID 직접 매칭
      const panelChar = characters.find((c: any) => c.id === slotId);
      if (panelChar) return panelChar;

      // 2순위: WomanA/WomanB/ManA 슬롯을 패널 캐릭터 순서로 매핑
      const activeChars = characters.filter(c => c.isActive);
      const femaleChars = activeChars.filter(c => c.gender === '여성');
      const maleChars = activeChars.filter(c => c.gender === '남성');

      const slotMap: Record<string, any> = {
        'WomanA': femaleChars[0],
        'WomanB': femaleChars[1],
        'WomanC': femaleChars[2],
        'WomanD': femaleChars[3],
        'ManA': maleChars[0],
        'ManB': maleChars[1],
      };

      const mappedChar = slotMap[slotId];
      if (mappedChar) return mappedChar;

      
      // CHARACTER_PRESETS가 정의되지 않았을 때를 대비한 폴백 맵
      const fallbackPresets: Record<string, any> = {
        'WomanA': { id: 'WomanA', name: 'Woman A', hair: 'long soft-wave hairstyle', body: 'slim', gender: 'FEMALE' },
        'WomanB': { id: 'WomanB', name: 'Woman B', hair: 'short chic bob cut', body: 'slim', gender: 'FEMALE' },
        'WomanC': { id: 'WomanC', name: 'Woman C', hair: 'low ponytail hairstyle', body: 'slim', gender: 'FEMALE' },
        'WomanD': { id: 'WomanD', name: 'Woman D', hair: 'high-bun hairstyle', body: 'slim', gender: 'FEMALE' },
        'ManA': { id: 'ManA', name: 'Man A', hair: 'short neat hairstyle', body: 'athletic', gender: 'MALE' },
        'ManB': { id: 'ManB', name: 'Man B', hair: 'clean short cut', body: 'athletic', gender: 'MALE' },
        'ManC': { id: 'ManC', name: 'Man C', hair: 'classic side-part hairstyle', body: 'athletic', gender: 'MALE' },
      };

      const preset = fallbackPresets[slotId] || Object.values(fallbackPresets).find(p => p.id === slotId);
      if (preset) return {
        id: preset.id,
        name: preset.name,
        hair: preset.hair,
        body: preset.body,
        identity: preset.gender === 'FEMALE'
          ? 'A stunning Korean woman in her 40s'
          : 'A handsome Korean man in his 40s',
        aiOptimizedPrompt: '',
        negativePrompt: '',
        referenceSlots: null,
        referenceImageUrl: null,
      };
      return null;
    };

      const selectedChars = rawCharacterIds
        .map((id: string) => getCharInfo(id))
        .filter(Boolean) as any[];

      // ④ 의상: scene.lockedOutfits 우선, 캐릭터 패널 폴백
      const getOutfit = (slotId: string): string =>
        scene.lockedOutfits?.[slotId]
        || characters.find((c: any) => c.id === slotId)?.outfitStyle
        || '';

      // ⑤ 프롬프트 조립
      const START = 'unfiltered raw photograph, highly detailed skin texture, natural skin glow';
      const END = 'photorealistic, 8k resolution, cinematic lighting, masterpiece --ar 9:16';
      const NO_TEXT = 'no text, no letters, no watermark';

      let finalPrompt = '';

      if (scene.longPrompt && !/[가-힣]/.test(scene.longPrompt)) {
        finalPrompt = scene.longPrompt;
      } else if (selectedChars.length === 0) {
        finalPrompt = [
          START,
          scene.cameraAngle || 'wide shot',
          scene.action || '',
          scene.background ? `in a ${scene.background}` : '',
          NO_TEXT, END
        ].filter(Boolean).join(', ');
      } else {
        const charBlocks = selectedChars.map((char: any, i: number) => {
          const outfit = getOutfit(char.id);
          const identity = char.identity || 'A stunning Korean woman in her 40s';
          const hair = char.hair || '';
          const body = char.body || '';
          const outfitText = outfit ? `wearing ${outfit}` : '';
          const block = [identity, hair, body, outfitText].filter(Boolean).join(', ');
          return selectedChars.length >= 2 ? `[Person ${i + 1}: ${block}]` : block;
        }).join(' ');

        const shotPrefix =
          resolvedShotType === 'group-shot' ? 'group wide shot, three people in frame,' :
          resolvedShotType === 'two-shot'   ? 'two-shot wide, two people in frame,' : '';

        finalPrompt = [
          START, shotPrefix,
          scene.cameraAngle || 'full body wide shot',
          charBlocks,
          scene.action || '',
          scene.background ? `in a ${scene.background}` : '',
          NO_TEXT, END
        ].filter(Boolean).join(', ');
      }

      if (selectedStyle && selectedStyle !== '실사풍' && selectedStyle !== '전체') {
        finalPrompt += ', in ' + selectedStyle + ' style';
      }
      const targetEffect = IMAGE_EFFECTS.find(e => e.id === imageEffect);
      if (targetEffect && targetEffect.prompt) finalPrompt += targetEffect.prompt;

      // ⑥ 네거티브
      const baseNeg = 'nsfw, nude, naked, deformed, ugly, bad anatomy, blurry, text, watermark';
      const charNegs = selectedChars.map((c: any) => c.negativePrompt).filter(Boolean).join(', ');
      const charNegativePrompt = charNegs ? `${baseNeg}, ${charNegs}` : baseNeg;

      // ⑦ 레퍼런스 이미지
      const collectedImages: { inlineData: { data: string, mimeType: string } }[] = [];
      for (const char of selectedChars) {
        if (char.referenceSlots) {
          for (const slotKey of CHARACTER_REFERENCE_SLOTS) {
            const slot = char.referenceSlots[slotKey as keyof typeof char.referenceSlots];
            if (slot?.url) {
              try {
                const blobRes = await fetch(slot.url);
                const blob = await blobRes.blob();
                const reader = new FileReader();
                const base64Data = await new Promise<string>((resolve) => {
                  reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                  reader.readAsDataURL(blob);
                });
                if (base64Data) collectedImages.push({ inlineData: { data: base64Data, mimeType: blob.type || 'image/png' } });
              } catch(e) {}
            }
          }
        } else if (char.referenceImageUrl) {
          try {
            const blobRes = await fetch(char.referenceImageUrl);
            const blob = await blobRes.blob();
            const reader = new FileReader();
            const base64Data = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
            });
            if (base64Data) collectedImages.push({ inlineData: { data: base64Data, mimeType: blob.type || 'image/png' } });
          } catch(e) {}
        }
      }
      const referenceImages = collectedImages.length > 0 ? collectedImages : undefined;

      console.log(`[Scene ${sceneId}] shotType: ${resolvedShotType}, chars: [${rawCharacterIds.join(', ')}]`);

      // ⑧ 이미지 생성
      const finalBase64Image = await generateImageBySelectedModel(finalPrompt, charNegativePrompt, referenceImages);
      if (!finalBase64Image) throw new Error('생성된 이미지 데이터를 찾지 못했습니다.');

      // ⑨ 저장
      const storyId = currentProjectFolder || await saveCurrentProject(scenes, { title: topic || 'untitled' });
      const saveResponse = await fetch('http://localhost:3002/api/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: `data:image/png;base64,${finalBase64Image}`,
          prompt: finalPrompt,
          storyId: storyId || currentProjectFolder || undefined,
          sceneNumber: sceneId,
          storyTitle: topic || 'untitled',
        })
      });

      const saveResult = await saveResponse.json();
      if (!saveResult?.success) throw new Error(saveResult?.error || '이미지 저장 실패');
      if (saveResult.storyId) setCurrentProjectFolder(saveResult.storyId);

      const savedImageUrl = saveResult.url?.startsWith('http')
        ? saveResult.url
        : `http://localhost:3002${saveResult.url}`;

      const updatedScenes = scenes.map((item) => item.id === sceneId
        ? { ...item, imageUrl: savedImageUrl, isImageGenerating: false, longPrompt: finalPrompt, imageError: false }
        : item
      );
      setScenes(updatedScenes);
      await saveCurrentProject(updatedScenes, { title: topic || 'untitled' });
      showToast(`${sceneId}번 장면 이미지 생성 완료`, 'success');

    } catch (error) {
      console.error(error);
      showToast('이미지 생성에 실패했습니다.', 'error');
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, isImageGenerating: false, imageError: true } : s
      ));
    }
  };

  const handleBatchImageGenerate = async () => {
    if (scenes.length === 0) return;
    showToast('모든 장면의 이미지 생성을 시작합니다.', 'info');
    
    for (const scene of scenes) {
      if (!scene.imageUrl) {
        await handleGenerateImage(scene.id);
      }
    }
    showToast('모든 이미지가 생성되었습니다.', 'success');
  };

  const composeScenePrompt = (scene: any) => {
    const base = (scene?.scriptLine || scene?.text || '').trim();
    const char = scene?.assignedCharacter ? characters.find((c) => c.id === scene.assignedCharacter) : null;
    const styleSuffix = selectedStyle && selectedStyle !== '실사풍' && selectedStyle !== '전체' ? `, ${selectedStyle} style` : '';
    const effectSuffix = IMAGE_EFFECTS.find((effect) => effect.id === imageEffect)?.prompt || '';
    const charPrefix = char ? `${char.gender || ''} ${char.age || ''} 캐릭터, ${char.style || ''}. ` : '';
    return `${charPrefix}${base}${styleSuffix}${effectSuffix}`.replace(/\s+/g, ' ').trim();
  };

  const handleRegenerateScenePrompt = (sceneId: number) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const nextPrompt = composeScenePrompt(scene);
        return { ...scene, longPrompt: nextPrompt, shortPrompt: nextPrompt };
      })
    );
    showToast(`${sceneId}번 씬 프롬프트를 재생성했습니다.`, 'success');
  };

  const handleRegenerateAllPrompts = () => {
    setScenes((prev) =>
      prev.map((scene) => {
        const nextPrompt = composeScenePrompt(scene);
        return { ...scene, longPrompt: nextPrompt, shortPrompt: nextPrompt };
      })
    );
    showToast('전체 프롬프트를 재생성했습니다.', 'success');
  };

  const handleGenerateSceneVideoPrompt = (sceneId: number) => {
    setScenes((prev) =>
      prev.map((scene) => {
        if (scene.id !== sceneId) return scene;
        const imagePrompt = (scene.longPrompt || scene.shortPrompt || composeScenePrompt(scene)).trim();
        const videoPrompt = `${imagePrompt}. cinematic motion, subtle camera move, smooth transition, 9:16 vertical`;
        return { ...scene, videoPrompt };
      })
    );
    showToast(`${sceneId}번 씬 영상 프롬프트를 생성했습니다.`, 'success');
  };

  const handleGenerateAllVideoPrompts = () => {
    setScenes((prev) =>
      prev.map((scene) => {
        const imagePrompt = (scene.longPrompt || scene.shortPrompt || composeScenePrompt(scene)).trim();
        const videoPrompt = `${imagePrompt}. cinematic motion, subtle camera move, smooth transition, 9:16 vertical`;
        return { ...scene, videoPrompt };
      })
    );
    showToast('전체 영상 프롬프트 생성을 완료했습니다.', 'success');
  };

  const handleGenerateRemainingCuts = async () => {
    const remainingScenes = scenes.filter((scene) => !scene.imageUrl);
    if (remainingScenes.length === 0) {
      showToast('남은 컷이 없습니다.', 'info');
      return;
    }
    showToast(`남은 컷 ${remainingScenes.length}개 생성을 시작합니다.`, 'info');
    for (const scene of remainingScenes) {
      await handleGenerateImage(scene.id);
    }
    showToast('남은 컷 생성을 완료했습니다.', 'success');
  };

  const handleGenerateAllVideos = async () => {
    const targetScenes = scenes.filter((scene) => !!(scene.videoPrompt || scene.longPrompt || scene.shortPrompt));
    if (targetScenes.length === 0) {
      showToast('생성할 영상 프롬프트가 없습니다.', 'error');
      return;
    }
    setScenes((prev) => prev.map((scene) => ({ ...scene, isVideoGenerating: !!targetScenes.find((target) => target.id === scene.id) })));
    showToast(`전체 영상 생성 요청(${targetScenes.length}개)을 처리합니다.`, 'info');
    setTimeout(() => {
      setScenes((prev) =>
        prev.map((scene) =>
          targetScenes.find((target) => target.id === scene.id)
            ? { ...scene, isVideoGenerating: false, videoUrl: scene.videoUrl || '', videoRequested: true }
            : scene
        )
      );
      showToast('영상 생성 큐를 등록했습니다. (현재 빌드에서는 외부 영상 엔진 연동 전)', 'info');
    }, 1200);
  };

  const handleScenePromptChange = (sceneId: number, prompt: string) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === sceneId ? { ...scene, longPrompt: prompt, shortPrompt: prompt } : scene))
    );
  };

  const handleSceneVideoPromptChange = (sceneId: number, videoPrompt: string) => {
    setScenes((prev) => prev.map((scene) => (scene.id === sceneId ? { ...scene, videoPrompt } : scene)));
  };

  const handleSceneImageUpload = (sceneId: number, file: File | null) => {
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setScenes((prev) =>
      prev.map((scene) => (scene.id === sceneId ? { ...scene, imageUrl, isImageGenerating: false, imageUploaded: true } : scene))
    );
    showToast(`${sceneId}번 씬 이미지 업로드 완료`, 'success');
  };

  const handleBatchImageUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    
    // 파일명에서 숫자를 추출하여 정렬 & 매핑 (예: 1.png, scene_02.jpg -> 1, 2)
    const fileMap = new Map<number, File>();
    const unmappedFiles: File[] = [];

    fileArray.forEach(file => {
       const match = file.name.match(/(\d+)[^\d]*\.(png|jpe?g|webp)$/i);
       if (match) {
          const num = parseInt(match[1], 10);
          if (!fileMap.has(num)) {
             fileMap.set(num, file);
          } else {
             unmappedFiles.push(file);
          }
       } else {
          const rawMatch = file.name.match(/\d+/);
          if (rawMatch && !fileMap.has(parseInt(rawMatch[0], 10))) {
             fileMap.set(parseInt(rawMatch[0], 10), file);
          } else {
             unmappedFiles.push(file);
          }
       }
    });

    let unmappedIndex = 0;
    setScenes((prev) =>
      prev.map((scene, index) => {
        const sceneNum = index + 1;
        let targetFile = fileMap.get(sceneNum);
        
        if (!targetFile && unmappedIndex < unmappedFiles.length) {
          targetFile = unmappedFiles[unmappedIndex++];
        }
        
        if (!targetFile) return scene;
        return {
          ...scene,
          imageUrl: URL.createObjectURL(targetFile),
          isImageGenerating: false,
          imageUploaded: true,
        };
      })
    );
    showToast(`이미지 ${fileArray.length}개를 씬 번호 규칙에 맞춰 일괄 업로드했습니다.`, 'success');
  };

  const handlePromptFileUpload = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    let lines: string[] = [];
    
    if (isCsv) {
      // 단순 CSV 파싱: 두 번째 열을 프롬프트로 취급 (첫 줄은 헤더 제외)
      lines = text.split(/\r?\n/).slice(1).map(line => {
        const cols = line.split(',');
        // 따옴표 제거
        const promptText = cols[1] ? cols[1].replace(/^"|"$/g, '').trim() : cols[0].replace(/^"|"$/g, '').trim();
        return promptText;
      }).filter(Boolean);
    } else {
      lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    }

    if (lines.length === 0) {
      showToast('프롬프트 파일이 비어 있거나 형식이 맞지 않습니다.', 'error');
      return;
    }
    setScenes((prev) =>
      prev.map((scene, index) => {
        const prompt = lines[index];
        if (!prompt) return scene;
        return { ...scene, longPrompt: prompt, shortPrompt: prompt };
      })
    );
    showToast(`프롬프트 ${Math.min(lines.length, scenes.length)}개를 성공적으로 매핑했습니다.`, 'success');
  };

  // 씬에 특정 캐릭터를 지정/해제하는 함수
  const handleAssignCharacterToScene = (sceneId: number, characterId: string | null) => {
     setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, assignedCharacter: characterId } : s));
  };


  // ============================================
  // [로직] 3. TTS 음성 생성
  // ============================================
  const getSelectedDeliveryPrompt = () => {
    const delivery = DELIVERY_OPTIONS.find((option) => option.id === selectedDelivery);
    // 0..100 tone slider; 50 is neutral baseline
    const toneOffset = toneValue - 50;
    const tonePrompt = toneOffset === 0 ? '' : ` with tone intensity ${toneOffset > 0 ? '+' : ''}${toneOffset},`;
    return `${delivery?.prompt || 'Say naturally:'}${tonePrompt} at ${ttsSpeed}x speed:`;
  };

  const buildPreviewSampleText = (fallback: string) => {
    const base = previewText.trim() || fallback;
    return base.replace(/\s+/g, ' ').slice(0, 40);
  };

  const generateGeminiTtsAudioUrl = async (voiceId: string, text: string) => {
    const requestText = `${getSelectedDeliveryPrompt()} ${text}`.trim();
    const tryVoiceIds = voiceId === 'Kore' ? ['Kore'] : [voiceId, 'Kore'];

    let lastError: unknown = null;
    for (const tryVoiceId of tryVoiceIds) {
      try {
        const response = await generateSingleSpeakerAudio(tryVoiceId, requestText);
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          throw new Error('음성 데이터가 없습니다.');
        }
        const wavBlob = pcmToWavBlob(base64Audio);
        return URL.createObjectURL(wavBlob);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('TTS 생성 실패');
  };

  const handleGenerateSingleSceneTts = async (index: number) => {
    const scene = scenes[index];
    if (!scene || !scene.scriptLine) {
      showToast('대본 내용이 없습니다.', 'error');
      return;
    }

    setTtsLoadingMap(prev => ({ ...prev, [index]: true }));

    try {
      let audioUrl = '';

      if (selectedTtsEngine === 'gemini') {
        audioUrl = await generateGeminiTtsAudioUrl(selectedVoice, scene.scriptLine);

      } else if (
        selectedTtsEngine === 'elevenlabs' ||
        selectedTtsEngine === 'multilingual-v2'
      ) {
        const engine = TTS_ENGINES.find(e => e.id === selectedTtsEngine);
        const response = await fetch(`${API_BASE_URL}/api/tts/preview/elevenlabs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId: selectedVoice,
            text: scene.scriptLine,
            modelId: engine?.model || 'eleven_flash_v2_5',
            toneValue,
            speed: ttsSpeed,
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'ElevenLabs TTS 실패');
        audioUrl = `${API_BASE_URL}${data.audioUrl}`;
      } else if (selectedTtsEngine === 'typecast') {
        const response = await fetch(`${API_BASE_URL}/api/tts/preview/typecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: selectedVoice,
            text: scene.scriptLine,
            speed: ttsSpeed,
            pitch: Math.round((toneValue - 50) / 10),
          }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Typecast TTS 실패');
        audioUrl = `${API_BASE_URL}${data.audioUrl}`;
      } else {
        showToast('지원하지 않는 TTS 엔진입니다.', 'error');
        return;
      }


      setSceneAudioUrls(prev => ({ ...prev, [index]: audioUrl }));

      
      const newHistoryItem = {
        id: uuidv4(),
        sceneId: index + 1,
        voice: selectedVoice,
        delivery: selectedDelivery,
        text: scene.scriptLine,
        timestamp: new Date().toISOString(),
        audioUrl
      };
      setAudioHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
      
      showToast(`Scene ${index + 1} 음성 생성 완료!`, 'success');
    } catch (err) {
      console.error(err);
      showToast(`Scene ${index + 1} 음성 생성 실패`, 'error');
    } finally {
      setTtsLoadingMap(prev => ({ ...prev, [index]: false }));
    }
  };

  const handlePreviewSpecificVoice = async (voiceId: string) => {
    setIsPreviewingVoice(voiceId);
    try {
      const sampleText = buildPreviewSampleText('안녕하세요. 선택한 보이스 미리듣기입니다.');
      let audioUrl = '';

      if (selectedTtsEngine === 'gemini') {
        audioUrl = await generateGeminiTtsAudioUrl(voiceId, sampleText);
      } else if (selectedTtsEngine === 'elevenlabs' || selectedTtsEngine === 'multilingual-v2') {
        const engine = TTS_ENGINES.find(e => e.id === selectedTtsEngine);
        const response = await fetch(`${API_BASE_URL}/api/tts/preview/elevenlabs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceId,
            text: sampleText,
            modelId: engine?.model || 'eleven_flash_v2_5',
            toneValue,
            speed: ttsSpeed,
          }),

        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        audioUrl = `${API_BASE_URL}${result.audioUrl}`;
      } else if (selectedTtsEngine === 'typecast') {
        const response = await fetch(`${API_BASE_URL}/api/tts/preview/typecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actorId: voiceId,
            text: sampleText,
            speed: ttsSpeed,
            pitch: Math.round((toneValue - 50) / 10), // -5 ~ +5
          }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        audioUrl = `${API_BASE_URL}${result.audioUrl}`;
      } else {
        showToast('이 엔진은 아직 미리듣기를 지원하지 않습니다.', 'info');
        return;
      }


      if (audioUrl) {
        setSelectedVoice(voiceId);
        const audio = new Audio(audioUrl);
        audio.play().catch((e) => console.error('Audio play failed:', e));
        showToast('보이스 미리듣기 생성 완료', 'success');
      }
    } catch (error: any) {
      console.error('Preview error:', error);
      showToast(error.message || '보이스 미리듣기 생성 실패', 'error');
    } finally {
      setIsPreviewingVoice(null);
    }
  };

  const toggleFavoriteVoice = () => {
    const exists = favoriteVoices.find(f => f.voice === selectedVoice && f.delivery === selectedDelivery && (f.engine || 'gemini') === selectedTtsEngine);
    if (exists) {
      setFavoriteVoices(prev => prev.filter(f => !(f.voice === selectedVoice && f.delivery === selectedDelivery && (f.engine || 'gemini') === selectedTtsEngine)));
      showToast('즐겨찾기에서 제거되었습니다.', 'info');
    } else {
      setFavoriteVoices(prev => [...prev, { voice: selectedVoice, delivery: selectedDelivery, language: ttsLanguage, engine: selectedTtsEngine }]);
      showToast('즐겨찾기에 추가되었습니다!', 'success');
    }
  };

  const handleGenerateAllTts = async () => {
    if (scenes.length === 0) {
      showToast('생성할 씬이 없습니다.', 'error');
      return;
    }
  

    setIsGenerating(true);
    setBatchProgress({ current: 0, total: scenes.length });

    try {
      for (let i = 0; i < scenes.length; i++) {
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
        await handleGenerateSingleSceneTts(i);
      }
      showToast('전체 씬 음성 생성이 완료되었습니다!', 'success');
    } catch (err) {
      showToast('일부 음성 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================================
  // [UI] 메인 콘텐츠 렌더링
  // ============================================
  const renderContent = () => {
    const generatedSceneCount = Object.keys(sceneAudioUrls).length;

    // 현재 엔진에 맞는 보이스 라이브러리 선택
    const isElevenLabsEngine = selectedTtsEngine === 'elevenlabs' || selectedTtsEngine === 'multilingual-v2';
    const currentVoiceLibrary = buildRankedVoiceLibrary(
      isElevenLabsEngine ? ELEVENLABS_VOICE_LIBRARY : GEMINI_VOICE_LIBRARY,
      selectedTtsEngine
    );

    // 엔진별 즐겨찾기 목소리 ID 집합
    const favoriteVoiceIds = new Set(
      favoriteVoices
        .filter((item) => (item?.engine || 'gemini') === selectedTtsEngine)
        .map((item) => item.voice)
    );

    const filteredVoices = currentVoiceLibrary.filter((voice) => {
      const matchesLanguage = ttsLanguage === 'all' || voice.language === ttsLanguage;
      const keyword = voiceSearch.trim().toLowerCase();
      const matchesSearch = !keyword || `${voice.name} ${voice.subtitle} ${voice.id} ${voice.useCase || ''} ${voice.recommendation || ''}`.toLowerCase().includes(keyword);
      const matchesFilter =
        voiceFilter === 'all' ||
        (voiceFilter === 'popular' && voice.popular) ||
        (voiceFilter === 'favorites' && favoriteVoiceIds.has(voice.id));
      return matchesLanguage && matchesSearch && matchesFilter;
    }).sort((a, b) => {
      const aFavorite = favoriteVoiceIds.has(a.id) ? 1 : 0;
      const bFavorite = favoriteVoiceIds.has(b.id) ? 1 : 0;
      if (aFavorite !== bFavorite) return bFavorite - aFavorite;
      const aRank = a.rank ?? 999;
      const bRank = b.rank ?? 999;
      if (aRank !== bRank) return aRank - bRank;
      const aScore = a.score ?? 0;
      const bScore = b.score ?? 0;
      if (aScore !== bScore) return bScore - aScore;
      return a.name.localeCompare(b.name, 'ko');
    });

    const topRecommendedVoices = filteredVoices.filter((voice) => typeof voice.rank === 'number').slice(0, 3);
    const femaleVoices = filteredVoices.filter((voice) => voice.gender === '여성');
    const maleVoices = filteredVoices.filter((voice) => voice.gender === '남성');
    const otherVoices = filteredVoices.filter((voice) => voice.gender !== '여성' && voice.gender !== '남성');
    const selectedVoiceMeta = currentVoiceLibrary.find((voice) => voice.id === selectedVoice);
    switch (activeStep) {
      case 'status-board':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center border-b border-white/5 pb-6">
              <div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                  <Bot className="text-lime-400" size={32} />
                  WORK STATUS BOARD
                </h2>
                <p className="text-slate-500 text-sm mt-1">Tube Factory 100% 복제 진행 상황 및 작업 내역</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-lime-500/10 border border-lime-500/20 px-4 py-2 rounded-xl">
                  <span className="text-[10px] text-lime-400 font-black uppercase block">전체 진행률</span>
                  <span className="text-xl font-black text-white">45%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: '기본 시스템', progress: 100, items: ['3001 포트 통일', '서버-클라이언트 연동', '로그인/인증 뼈대'] },
                { title: '데이터 스토리지', progress: 90, items: ['app-storage API 구현', '프로젝트 히스토리 로드', 'JSON 대본 저장 (진행중)'] },
                { title: '이미지 퓨전 (핵심)', progress: 50, items: ['TubeFactory 원본 캐릭터 UI 구현', '씬별 고정캐릭터 슬롯 연동', 'AI 참조 이미지 합성 (진행중)'] },
                { title: '대본/AI 엔진', progress: 60, items: ['Gemini 2.0 Flash 연동', 'Co-Star 프롬프트 빌더', '멀티 시나리오 생성'] },
                { title: 'TTS/음성 시스템', progress: 70, items: ['멀티 스피커 생성', '음성 속도/톤 조절', '즐겨찾기 보관함'] },
                { title: '타임라인/편집', progress: 15, items: ['장면 나열 UI', '자막 스타일링 (미구현)', '타임라인 프리뷰 (미구현)'] },
              ].map((group, i) => (
                <div key={i} className="bg-[#111a24] border border-white/5 p-6 rounded-[32px] space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white">{group.title}</h3>
                    <span className="text-xs font-black text-lime-400">{group.progress}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-lime-500 h-full transition-all duration-1000" style={{ width: `${group.progress}%` }}></div>
                  </div>
                  <ul className="space-y-2">
                    {group.items.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                        <div className={`w-1 h-1 rounded-full ${item.includes('진행중') ? 'bg-yellow-500 animate-pulse' : item.includes('미구현') ? 'bg-slate-700' : 'bg-lime-500'}`}></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="bg-[#111a24] border border-white/5 rounded-[32px] overflow-hidden">
              <div className="bg-white/5 px-8 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-widest">최근 작업 로그</h3>
                <span className="text-[10px] text-slate-500">Real-time Activity</span>
              </div>
              <div className="p-8 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                {[
                  { time: '방금 전', log: 'TubeFactory 오리지널 스타일의 캐릭터 고정/이미지 퓨전 UI 전면 도입' },
                  { time: '10분 전', log: 'TubeFactoryPanel UI 한글화 및 메뉴 구조 재편성 완료' },
                  { time: '15분 전', log: '프로젝트 히스토리(저장된 폴더) 로드 기능 이식 성공' },
                ].map((log, i) => (
                  <div key={i} className="flex gap-4 text-xs">
                    <span className="text-slate-600 shrink-0 w-16">{log.time}</span>
                    <span className="text-slate-300 font-medium">{log.log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'project-list':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Library</h2>
                <p className="text-slate-500 text-sm mt-1">작업했던 모든 대본과 이미지 폴더를 확인하세요.</p>
              </div>
              <button onClick={() => {
                setScenes([]);
                setTopic('');
                setBenchmarkSource('');
                setStorylines([]);
                setSelectedStoryIndex(null);
                setSelectedStoryDraft('');
                setScriptPhase('input');
                setCurrentProjectFolder(null);
                setSceneAudioUrls({});
                setTtsLoadingMap({});
                setSeoData(null);
                setBenchmarkAnalysis(null);
                setTargetAge('20대');
                setActiveStep('style');
              }} className="bg-lime-500 text-black px-8 py-3 rounded-2xl font-black hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20 flex items-center gap-2">
                <Plus size={20} /> 새 프로젝트 시작
              </button>

            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
               {isLoadingProjects ? (
                 <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                    <Loader2 className="animate-spin text-lime-400" size={40} />
                    <p className="font-bold text-xs uppercase tracking-widest">저장된 데이터를 찾는 중...</p>
                 </div>
               ) : (
                 <>
                   {projects.map((proj, i) => (
                      <div key={i} className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col justify-between h-[240px] relative overflow-hidden group hover:border-lime-500/30 hover:scale-[1.02] transition-all cursor-pointer" onClick={() => loadProject(proj.folderName)}>
                         <LayoutGrid size={80} className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity" />
                         <div>
                           <div className="text-[10px] text-lime-400 font-black mb-2 uppercase tracking-[0.2em]">Stored Folder</div>
                           <h3 className="text-xl font-black text-white group-hover:text-lime-400 transition-colors line-clamp-2">{proj.folderName}</h3>
                           <p className="text-xs text-slate-500 mt-2">{proj.imageCount} Images Generated</p>
                         </div>
                         <div className="flex gap-2">
                            <button className="bg-white/5 px-6 py-2.5 rounded-xl text-[11px] font-black group-hover:bg-lime-500 group-hover:text-black transition-all">이어서 작업하기</button>
                            <button className="bg-white/5 px-6 py-2.5 rounded-xl text-[11px] font-black text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all" onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(proj.folderName);
                            }}>삭제</button>
                         </div>
                      </div>
                   ))}
                   
                   {projects.length === 0 && (
                     <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
                           <LayoutGrid size={32} />
                        </div>
                        <p className="text-slate-500 font-bold text-sm">아직 저장된 프로젝트가 없습니다.</p>
                     </div>
                   )}
                 </>
               )}
            </div>
          </div>
        );

      case 'style':
        return (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto">
            <div className="bg-[#112a20] border border-lime-500/20 text-lime-400 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold w-full mx-auto shadow-lg shadow-lime-500/5">
              <div className="flex items-center gap-2">
                <span className="bg-lime-500 text-black px-2 py-0.5 rounded uppercase text-[10px] font-black">공지</span>
                플래티넘 모든 기능사용가능 , 체험등급은 골드멤버십 등급 적용됩니다. 튜브플로우는 무료 다운로드 가능합니다.
              </div>
              <X size={14} className="cursor-pointer text-lime-500/60 hover:text-lime-400" />
            </div>

            <div className="flex flex-col space-y-2 mt-4 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">영상 스타일 <Info size={16} className="text-slate-500 cursor-pointer"/></h2>
                <span className="text-xs text-slate-500 ml-2 border border-slate-600 px-2 py-0.5 rounded px-2">이용방법</span>
              </div>
              <p className="text-slate-400 text-sm">영상의 전체적인 비주얼 스타일을 선택하세요. 대본 생성과 이미지 생성에 모두 반영된다.</p>
            </div>

            <div className="bg-[#111a22] border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-20 h-14 bg-slate-800 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                  <ImageIcon className="text-slate-500" />
                </div>
                <div>
                  <h3 className="text-lime-400 font-bold text-sm mb-1">{selectedStyle}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xl">photorealistic, ultra realistic, natural skin texture...</p>
                </div>
              </div>
              <button onClick={() => setActiveStep('script')} className="bg-lime-500/10 border border-lime-500 text-lime-400 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-lime-500 hover:text-black transition-all">
                다음 단계 <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 py-2 border-y border-white/5 my-6">
              {['전체', '나만의 스타일', '고정캐릭터', '만화/카툰', '웹툰', '3D', '무협', '원본 애니', '레트로/픽셀', '코믹/팝아트', '스케치/드로잉', '빈티지', '기타'].map((tag, i) => (
                <button key={tag} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${i === 0 ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30' : 'bg-white/5 text-slate-400 hover:text-white border border-transparent hover:border-white/10'}`}>
                  {tag} {tag === '고정캐릭터' && <span className="ml-1 bg-purple-600 text-white px-1.5 py-0.5 rounded text-[9px]">3</span>}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-10">
              {[
                {name: '한국웹툰', img: ''},
                {name: '실사풍', img: ''},
                {name: '픽사 스타일', img: ''},
                {name: '3D 게임 트레일러', img: ''},
                {name: '졸라맨', badge: '고정캐릭터 1명', img: ''},
                {name: '해골 스타일', badge: '고정캐릭터 1명', img: ''},
                {name: '일본 애니 스타일', img: ''},
                {name: '클레이', img: ''},
                {name: '틸트시프트 미니어처', img: ''},
                {name: '무협', img: ''}
              ].map((style, i) => (
                <div 
                  key={style.name} 
                  onClick={() => setSelectedStyle(style.name)}
                  className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all aspect-[4/3] bg-slate-900 ${
                    selectedStyle === style.name ? 'border-lime-500 ring-4 ring-lime-500/20 scale-[1.02] shadow-2xl shadow-lime-500/10' : 'border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0d131f]">
                    <ImageIcon size={32} className="text-white/5" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
                  <div className="absolute bottom-3 left-4 right-4 z-20">
                    <h3 className="font-bold text-sm text-white group-hover:text-lime-400 transition-colors uppercase">{style.name}</h3>
                    {style.badge && <span className="text-[8px] bg-purple-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block uppercase font-black">{style.badge}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'script':
        if (scriptPhase === 'input') {
          return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold">대본 생성</h2>
                <Info size={16} className="text-slate-500 cursor-pointer" />
                <span className="text-xs text-slate-500 ml-2 border border-slate-600 px-2 py-0.5 rounded">이용방법</span>
              </div>
              
              <div className="flex bg-[#111827] rounded-2xl p-1 border border-white/5">
                <button 
                  onClick={() => setIsAutoMode(false)}
                  className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${!isAutoMode ? 'bg-lime-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <span className="text-lg">✍️</span> 자유작성
                </button>
                <button 
                  onClick={() => setIsAutoMode(true)}
                  className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isAutoMode ? 'bg-lime-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <span className="text-lg">🤖</span> 자동작성
                </button>
              </div>

              <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {AUTO_SOURCE_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAutoSourceMode(mode.id)}
                      className={`rounded-2xl border p-4 text-left transition-all ${autoSourceMode === mode.id ? 'border-lime-500 bg-lime-500/10' : 'border-white/5 bg-white/5 hover:border-white/15'}`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest text-sky-300 mb-2">클릭방식</div>
                      <div className="font-bold text-sm text-white">{mode.label}</div>
                      <div className="text-[11px] text-slate-500 mt-2 leading-relaxed">{mode.description}</div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
              <h3 className="font-bold mb-1 text-slate-200">타겟 시청자 나이</h3>
              <div className="flex gap-2 flex-wrap">
                {['10대', '20대', '30대', '40대', '50대 이상'].map((age) => (
                  <button
                    key={age}
                    onClick={() => setTargetAge(age)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                      targetAge === age
                        ? 'bg-lime-500 text-black border-lime-500'
                        : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">선택한 나이대에 맞는 어휘와 감성으로 대본이 생성됩니다.</p>
            </div>

            <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
                <h3 className="font-bold mb-1 text-slate-200">씬 구성 방식</h3>

                <div className="flex gap-2">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => setScriptLanguage(lang.id)}
                      className={`bg-white/5 border border-white/5 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors ${scriptLanguage === lang.id ? 'bg-lime-500/10 border-lime-500 text-lime-400' : ''}`}
                    >
                      <span className="text-[10px] font-black">{lang.badge}</span>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
                <h3 className="font-bold mb-1 text-slate-200">씬 구성 방식</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    {id: 'auto', label: '자동씬구성', desc: 'AI가 자동으로 씬을 나눕니다.'},
                    {id: '1-sentence', label: '1문장당 1씬', desc: '문장 하나를 하나의 씬으로 고정.'},
                    {id: '2-sentence', label: '2문장당 1씬', desc: '문장 두 개씩 묶어 씬 구성.'},
                    {id: 'custom', label: '직접입력', desc: '원하는 문장 수만큼 묶음.'}
                  ].map(compo => (
                    <div key={compo.id} onClick={() => setSceneComposition(compo.id as any)} className={`p-4 rounded-xl cursor-pointer transition-all ${sceneComposition === compo.id ? 'border border-lime-500 bg-lime-500/5' : 'border border-white/5 bg-white/5 hover:border-white/20'}`}>
                      <div className="font-bold mb-2 text-sm">{compo.label}</div>
                      <p className="text-[10px] text-slate-400">{compo.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
                  <h3 className="font-bold text-slate-200">자동 작성</h3>
                  <div className="flex flex-wrap gap-3">
                    {OUTPUT_FORMATS.map((format) => (
                      <button
                        key={format.id}
                        onClick={() => setOutputFormat(format.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${outputFormat === format.id ? 'bg-lime-500 text-black border-lime-500' : 'bg-white/5 border-white/5 text-slate-400'}`}
                      >
                        {format.label}
                      </button>
                    ))}
                    {DURATION_OPTIONS.map((duration) => (
                      <button
                        key={duration}
                        onClick={() => setTargetDuration(duration)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${targetDuration === duration ? 'bg-lime-500/10 text-lime-400 border-lime-500/50' : 'bg-white/5 border-white/5 text-slate-400'}`}
                      >
                        {duration}
                      </button>
                    ))}
                    <input
                      value={customSceneDensity}
                      onChange={(e) => setCustomSceneDensity(e.target.value)}
                      className="w-20 bg-[#0a0f16] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none"
                    />
                    <span className="self-center text-xs text-slate-500">씬</span>
                  </div>
                  <div className="flex gap-3">
                    {SCRIPT_STRUCTURE_OPTIONS.map((structure) => (
                      <button
                        key={structure.id}
                        onClick={() => setScriptStructure(structure.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${scriptStructure === structure.id ? 'bg-lime-500/10 text-lime-400 border-lime-500/50' : 'bg-white/5 border-white/5 text-slate-400'}`}
                      >
                        {structure.label}
                      </button>
                    ))}
                  </div>
                </div>

                <h3 className="font-bold text-xl text-slate-200">대본 생성 입력</h3>
                <div className="bg-[#151a24] border border-white/5 rounded-[32px] p-8 space-y-6 shadow-2xl relative">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">제작할 주제</label>
                    <textarea 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="제작하고 싶은 영상의 주제나 방향을 입력하세요. 예: 무시당하던 사람이 마지막에 판을 뒤집는 사연"
                      className="w-full h-28 bg-[#0a0f16] border border-white/5 rounded-2xl p-6 text-sm outline-none focus:border-lime-500/50 transition-all resize-none shadow-inner text-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">벤치마킹 설명서 / 자막 / 분석 원문</label>
                    <textarea 
                      value={benchmarkSource}
                      onChange={(e) => setBenchmarkSource(e.target.value)}
                      placeholder="벤치마킹할 영상의 설명, 자막, 페이지 소개 문구를 붙여 넣으면 후킹 방식과 전개 구조를 분석해 새 줄거리로 바꿉니다."
                      className="w-full h-48 bg-[#0a0f16] border border-white/5 rounded-2xl p-6 text-sm outline-none focus:border-lime-500/50 transition-all resize-none shadow-inner text-slate-300"
                    />
                    <p className="text-xs text-slate-500">
                      원문 문장을 그대로 복사하지 않고, 후킹 방식과 전개 구조만 추출해서 새 줄거리를 생성합니다.
                    </p>
                  </div>
                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={handleAnalyzeScript}
                      disabled={isGenerating}
                      className="bg-sky-500/10 border border-sky-500 text-sky-400 px-8 py-3.5 rounded-xl font-bold hover:bg-sky-500 hover:text-black transition-all"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" /> : '대본 분석'}
                    </button>
                    <button 
                      onClick={handleGenerateStorylines}
                      disabled={isGenerating}
                      className="bg-lime-500 text-black px-12 py-3.5 rounded-xl font-black text-[15px] hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20 w-48 flex justify-center items-center"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" /> : '줄거리 생성'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (scriptPhase === 'storylines') {
          return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
              <h2 className="text-2xl font-bold">줄거리 선택 <span className="text-sm font-normal text-slate-500 ml-2">({storylines.length}개)</span></h2>
              {benchmarkAnalysis && (
                <div className="bg-[#111a24] border border-lime-500/20 rounded-[24px] p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-lime-400 mb-2">원본 핵심</div>
                    <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.sourceSummary}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-lime-400 mb-2">후킹 / 구조</div>
                    <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.hookPattern}</p>
                    <p className="text-slate-500 leading-relaxed mt-2">{benchmarkAnalysis.narrativeStructure}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-lime-400 mb-2">톤 / 습관</div>
                    <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.toneStyle}</p>
                    <p className="text-slate-500 leading-relaxed mt-2">{benchmarkAnalysis.narrationHabit}</p>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-lime-400 mb-2">재구성 규칙</div>
                    <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.rebuildProtocol}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                {storylines.map((story, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectStoryline(i)}
                    className={`bg-[#0a0f16] border p-8 rounded-[24px] cursor-pointer transition-all flex flex-col justify-between group h-full ${selectedStoryIndex === i ? 'border-lime-500 shadow-lg shadow-lime-500/10' : 'border-white/5 hover:border-lime-500/50'}`}
                  >
                    <h3 className={`text-xl font-bold mb-4 transition-colors leading-relaxed ${selectedStoryIndex === i ? 'text-lime-400' : 'text-white group-hover:text-lime-400'}`}>{story.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed text-justify">{story.content}</p>
                  </div>
                ))}
              </div>
              <div className="bg-[#111a24] border border-white/5 rounded-[24px] p-6 space-y-4">
                <div className="text-sm font-bold text-white">줄거리 (편집 가능)</div>
                <textarea
                  value={selectedStoryDraft}
                  onChange={(e) => setSelectedStoryDraft(e.target.value)}
                  className="w-full h-48 bg-[#0a0f16] border border-white/10 rounded-2xl p-5 text-sm text-slate-300 outline-none resize-none"
                  placeholder="카드를 선택하면 줄거리 초안을 여기서 다듬을 수 있습니다."
                />
                <button
                  onClick={handleConfirmStoryline}
                  disabled={isGenerating}
                  className="w-full bg-lime-500 text-black px-8 py-4 rounded-2xl font-black hover:bg-lime-400 transition-all flex items-center justify-center"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : '대본 생성'}
                </button>
              </div>
            </div>
          );
        } else {
          return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">대본 확인</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await saveCurrentProject(scenes, {
                          title: storylines[selectedStoryIndex ?? 0]?.title || topic,
                        });
                        showToast('현재 대본을 작업폴더에 저장했습니다.', 'success');
                      } catch (error) {
                        console.error(error);
                        showToast('대본 저장에 실패했습니다.', 'error');
                      }
                    }}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    대본 저장
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(scenes.map((scene) => scene.scriptLine).join('\n'))}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 text-slate-200 hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    대본 복사
                  </button>
                  <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/40 text-sky-400 hover:bg-sky-500 hover:text-black px-4 py-2 rounded-xl text-xs font-bold transition-all">
                    불러오기 (JSON)
                  </button>
                  <button onClick={() => setScriptPhase('storylines')} className="flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">
                    이전
                  </button>
                </div>
              </div>

              {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                  <div className="bg-[#0d1520] border border-white/10 rounded-3xl p-8 w-full max-w-2xl">
                    <h3 className="text-lg font-black text-white mb-4">대본 JSON 불러오기</h3>
                    <textarea 
                      value={importJsonText} 
                      onChange={e => setImportJsonText(e.target.value)}
                      className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-300 outline-none"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                      <button onClick={() => setShowImportModal(false)} className="px-5 py-2 rounded-xl bg-white/5 text-slate-400 font-bold text-sm">취소</button>
                      <button onClick={() => {
                        try {
                          const parsed = JSON.parse(importJsonText);
                          if (parsed.scenes) setScenes(parsed.scenes.map((s:any, i:number) => ({ ...s, id: i+1, scriptLine: s.scriptLine || s.text || '' })));
                          setShowImportModal(false);
                          showToast('불러오기 성공', 'success');
                        } catch(e) { showToast('JSON 형식 오류', 'error'); }
                      }} className="px-5 py-2 rounded-xl bg-sky-500 text-black font-black text-sm">확인</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {scenes.map((scene, i) => (
                  <div key={i} className="flex gap-4 items-start bg-white/5 p-6 rounded-2xl border border-white/5 relative group">
                    <div className="bg-sky-500/20 text-sky-400 px-3 py-1 rounded-lg text-[10px] font-black shrink-0 uppercase">Scene {scene.id}</div>
                    <p className="text-sm text-slate-200 flex-1">{scene.scriptLine}</p>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleGenerateSingleSceneTts(i)} className="bg-lime-500/10 text-lime-400 p-2 rounded-lg hover:bg-lime-500/20">
                        {ttsLoadingMap[i] ? <Loader2 className="animate-spin" size={16}/> : <Volume2 size={16}/>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveStep('tts')} className="bg-lime-500 text-black px-16 py-4 rounded-2xl font-black text-lg hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20">
                대본 확정 → TTS 음성으로
              </button>
            </div>
          );
        }

      case 'tts':
        return (
          <div className="p-6 animate-in fade-in duration-500 max-w-[1800px] mx-auto h-[calc(100vh-80px)] flex flex-col gap-4">
            {/* 헤더 */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">TTS 및 음성 연동</h2>
                <p className="text-sm text-slate-400">Gemini 2.5 Flash 고성능 엔진으로 자연스러운 목소리를 생성합니다.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateAllTts}
                  disabled={isGenerating}
                  className="bg-lime-500 text-black px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-lime-400 transition-all"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18}/>}
                  전체 음성 생성 {isGenerating && `(${batchProgress.current}/${batchProgress.total})`}
                </button>
                <button onClick={() => setActiveStep('character')} className="bg-white/5 border border-white/10 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-white/10 transition-all">캐릭터 설정으로</button>
              </div>
            </div>

            {/* ─── 상단 설정바 (압축형) ─── */}
            <div className="bg-[#111a24] border border-white/5 rounded-2xl p-2.5 space-y-2 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-500 uppercase font-black mr-1">엔진</span>
                {TTS_ENGINES.map((engine) => (
                  <button
                    key={engine.id}
                    onClick={() => setSelectedTtsEngine(engine.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${selectedTtsEngine === engine.id ? 'border-lime-500 bg-lime-500/10 text-lime-300' : 'border-white/10 bg-[#0a0f16] text-slate-300 hover:border-white/20'}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {engine.label}
                      {selectedTtsEngine === engine.id && <Check size={11} className="text-lime-400" />}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-500 uppercase font-black">언어</span>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setTtsLanguage(lang.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all ${ttsLanguage === lang.id ? 'bg-lime-500 text-black border-lime-500' : 'bg-[#0a0f16] border-white/10 text-slate-300'}`}
                  >
                    {lang.badge}
                  </button>
                ))}

                <span className="text-[10px] text-slate-500 uppercase font-black ml-1">속도</span>
                {TTS_SPEED_PRESETS.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setTtsSpeed(speed)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold border transition-all ${ttsSpeed === speed ? 'bg-lime-500 text-black border-lime-500' : 'bg-[#0a0f16] border-white/10 text-slate-300'}`}
                  >
                    {speed}x
                  </button>
                ))}

                <span className="text-[10px] text-slate-500 uppercase font-black ml-1">딜리버리</span>
                <select
                  value={selectedDelivery}
                  onChange={(e) => setSelectedDelivery(e.target.value as DeliveryOptionId)}
                  className="w-[130px] bg-[#0a0f16] border border-white/10 rounded-md px-2 py-1 text-[11px] text-white outline-none focus:border-lime-500"
                >
                  {DELIVERY_OPTIONS.map((delivery) => (
                    <option key={delivery.id} value={delivery.id}>{delivery.label}</option>
                  ))}
                </select>

                <span className="text-[10px] text-slate-500 uppercase font-black ml-1">톤 {toneValue}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={toneValue}
                  onChange={(e) => setToneValue(Number(e.target.value))}
                  className="w-28 accent-lime-500"
                />

                <div className="ml-auto flex items-center gap-1.5">
                  <div className="bg-[#0a0f16] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-300">
                    생성 {generatedSceneCount}
                  </div>
                  <div className="bg-[#0a0f16] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-300">
                    씬 {scenes.length}
                  </div>
                  <div className="bg-[#0a0f16] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-bold text-white max-w-[120px] truncate">
                    {selectedVoiceMeta?.name || selectedVoice}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── 하단 3열 (보이스 선택 | 씬 목록 | 히스토리) ─── */}
            <div className="flex gap-4 flex-1 min-h-0">

              {/* 보이스 선택 패널 */}
		              <div className="w-[270px] bg-[#111a24] border border-white/10 rounded-2xl p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar shrink-0">
		                <div className="flex items-center justify-between">
		                  <div>
		                    <h3 className="text-sm font-black text-white uppercase tracking-widest">음성 캐릭터</h3>
		                    <div className="text-[11px] text-slate-300 mt-0.5 font-semibold">{TTS_ENGINES.find(e => e.id === selectedTtsEngine)?.label || 'Gemini TTS'}</div>
	                  </div>
                  <button
                    onClick={toggleFavoriteVoice}
                    title={favoriteVoices.find(f => f.voice === selectedVoice && f.engine === selectedTtsEngine) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    className={`p-1.5 rounded-lg transition-all ${favoriteVoices.find(f => f.voice === selectedVoice && f.engine === selectedTtsEngine) ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-500 hover:text-yellow-400 bg-white/5'}`}
                  >
                    <Star size={13} fill={favoriteVoices.find(f => f.voice === selectedVoice && f.engine === selectedTtsEngine) ? 'currentColor' : 'none'} />
                  </button>
                </div>

	                <input
	                  value={voiceSearch}
	                  onChange={(e) => setVoiceSearch(e.target.value)}
	                  placeholder="보이스 이름, 용도, 추천 사유 검색"
	                  className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none"
	                />
		                <div className="flex gap-1">
	                  {FAVORITE_FILTERS.map((filter) => (
	                    <button
	                      key={filter.id}
                      onClick={() => setVoiceFilter(filter.id)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${voiceFilter === filter.id ? 'bg-lime-500 text-black border-lime-500' : 'bg-black/20 border-white/10 text-slate-400'}`}
                    >
                      {filter.label}
                    </button>
                  ))}
	                </div>

		                {topRecommendedVoices.length > 0 && (
			                  <div className="space-y-1.5">
			                    <div className="text-[11px] text-slate-200 uppercase font-black tracking-widest">상위 추천 TOP 3</div>
			                    <select
			                      value={topRecommendedVoices.some((voice) => voice.id === selectedVoice) ? selectedVoice : topRecommendedVoices[0]?.id}
			                      onChange={(e) => setSelectedVoice(e.target.value)}
			                      className="w-full bg-black/30 border border-white/20 rounded-xl px-3 py-2 text-sm text-white font-semibold outline-none focus:border-lime-500"
			                    >
			                      {topRecommendedVoices.map((voice) => (
			                        <option key={`top-${voice.id}`} value={voice.id}>
			                          {`#${voice.rank} ${voice.name} · ${voice.score}점`}
			                        </option>
			                      ))}
			                    </select>
			                  </div>
		                )}

		                <div className="space-y-2">
		                  {filteredVoices.length > 0 && (
			                    <div className="text-[11px] text-slate-200 font-black uppercase tracking-widest px-1 flex items-center justify-between">
			                      <span><span className="text-lime-400">랭킹순</span> · {TTS_ENGINES.find(e => e.id === selectedTtsEngine)?.label?.toUpperCase() || 'GEMINI TTS'}</span>
			                      <span>{filteredVoices.length}개</span>
			                    </div>
		                  )}
		                  {filteredVoices.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 rounded-xl border border-white/15 bg-black/25 p-2">
		                      {[
		                        { key: 'female', title: '여성', voices: femaleVoices },
		                        { key: 'male', title: '남성', voices: maleVoices },
		                        { key: 'other', title: '기타', voices: otherVoices },
		                      ].filter((group) => group.voices.length > 0).map((group) => (
		                        <div key={group.key} className="space-y-1">
		                          <div className="px-1 text-[11px] font-black text-slate-300">
		                            {group.title} · {TTS_ENGINES.find(e => e.id === selectedTtsEngine)?.label || 'Gemini'}
		                          </div>
		                          {group.voices.map((voice) => (
		                            <div
		                              key={voice.id}
		                              className={`rounded-lg border px-2 py-1.5 ${selectedVoice === voice.id ? 'border-lime-500/70 bg-lime-500/10' : 'border-white/10 bg-black/20'}`}
		                            >
		                              <div className="flex items-center justify-between gap-1.5">
		                                <button
		                                  onClick={() => setSelectedVoice(voice.id)}
		                                  className="min-w-0 flex-1 text-left"
		                                >
		                                  <div className="flex items-center gap-1">
		                                    {voice.rank ? <span className="text-[9px] bg-lime-500 text-black px-1 py-0.5 rounded font-black">#{voice.rank}</span> : null}
		                                    <span className="text-[11px] font-bold text-white truncate">{voice.name}</span>
		                                  </div>
		                                  <div className="text-[10px] text-slate-300 truncate">{voice.subtitle}</div>
		                                </button>
		                                <button
		                                  onClick={() => handlePreviewSpecificVoice(voice.id)}
		                                  disabled={isPreviewingVoice === voice.id}
		                                  className="shrink-0 px-2 py-1 rounded-md text-[10px] font-black bg-sky-500/20 text-sky-200 hover:bg-sky-500/35 disabled:opacity-60"
		                                >
		                                  {isPreviewingVoice === voice.id ? '...' : '미리듣기'}
		                                </button>
		                              </div>
		                            </div>
		                          ))}
		                        </div>
		                      ))}
		                    </div>
		                  ) : (
		                    <div className="text-xs text-slate-500 py-6 text-center">조건에 맞는 보이스가 없습니다.</div>
		                  )}
		                </div>

                {favoriteVoices.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-black mb-2 flex items-center gap-1">
                      <Star size={10} className="text-yellow-400" fill="currentColor" />
                      즐겨찾기
                    </div>
                    <div className="space-y-1">
                      {favoriteVoices.map((f, i) => {
                        const lib = (f.engine === 'elevenlabs' || f.engine === 'multilingual-v2')
                          ? ELEVENLABS_VOICE_LIBRARY
                          : GEMINI_VOICE_LIBRARY;
                        const meta = (lib as any[]).find(v => v.id === f.voice);
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              setSelectedVoice(f.voice);
                              setSelectedDelivery(f.delivery);
                              if (f.language) setTtsLanguage(f.language);
                              if (f.engine) setSelectedTtsEngine(f.engine);
                            }}
                            className="bg-white/5 border border-white/5 p-2 rounded-xl cursor-pointer hover:border-lime-500/30 transition-all flex items-center justify-between group"
                          >
                            <div>
                              <div className="text-xs font-bold text-white">{meta?.name || f.voice}</div>
                              <div className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span className="bg-white/5 px-1 rounded">{TTS_ENGINES.find(e => e.id === f.engine)?.label?.replace('ElevenLabs ', 'EL ') || 'Gemini'}</span>
                                <span>{DELIVERY_OPTIONS.find((opt) => opt.id === f.delivery)?.label || f.delivery}</span>
                              </div>
                            </div>
                            <Star size={11} className="text-yellow-400 shrink-0" fill="currentColor" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 씬 목록 */}
              <div className="flex-1 bg-[#111a24] border border-white/5 rounded-2xl p-6 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white uppercase tracking-widest text-xs">Scene Scripts & TTS Status</h3>
                  <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 font-black">{scenes.length} SCENES</span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                  {scenes.map((scene, i) => (
                    <div key={i} className={`bg-[#0a0f16] border p-4 rounded-2xl flex flex-col gap-3 transition-all group ${sceneAudioUrls[i] ? 'border-lime-500/30' : 'border-white/5'}`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Scene {i+1}</span>
                        {sceneAudioUrls[i] && <span className="text-[9px] text-lime-400 font-black flex items-center gap-1"><Check size={10}/> 음성 생성됨</span>}
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{scene.scriptLine}</p>
                      <div className="flex items-center gap-2">
                        {sceneAudioUrls[i] && (
                          <audio src={sceneAudioUrls[i]} controls className="flex-1 h-8 opacity-60 hover:opacity-100 transition-opacity" />
                        )}
                        {sceneAudioUrls[i] && (
                          <button
                            onClick={() => new Audio(sceneAudioUrls[i]).play()}
                            className="px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-400 text-[11px] font-black hover:bg-sky-500/20"
                          >
                            재생
                          </button>
                        )}
                        <button
                          onClick={() => handleGenerateSingleSceneTts(i)}
                          disabled={ttsLoadingMap[i]}
                          className={`px-4 py-1.5 rounded-xl text-[11px] font-black transition-all ${sceneAudioUrls[i] ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-lime-500 text-black hover:bg-lime-400'}`}
                        >
                          {ttsLoadingMap[i] ? <Loader2 className="animate-spin" size={14}/> : (sceneAudioUrls[i] ? '다시 생성' : '음성 생성')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History 패널 */}
              <div className="w-[260px] bg-[#111a24] border border-white/5 rounded-2xl p-4 flex flex-col min-h-0 shrink-0">
                <div className="flex items-center gap-2 mb-4">
                  <Sliders size={14} className="text-lime-400" />
                  <h3 className="font-bold text-xs uppercase tracking-widest">History</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  {audioHistory.map((item, i) => (
                    <div key={item.id} className="bg-white/5 p-4 rounded-2xl border border-transparent hover:border-white/10 transition-all space-y-2">
                      <div className="flex justify-between text-[10px] font-black">
                        <span className="text-lime-400">SCENE {item.sceneId}</span>
                        <span className="text-slate-600">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-2 italic">"{item.text}"</div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                        <span className="text-[9px] text-slate-500">{item.voice} / {item.delivery.split(':')[0]}</span>
                        <button onClick={() => new Audio(item.audioUrl).play()} className="text-lime-400 hover:text-white"><Play size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {audioHistory.length === 0 && (
                    <div className="text-center py-20 text-slate-600 text-xs">히스토리가 비어 있습니다.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        );

      case 'character':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3">
                   <Users className="text-lime-400" />
                   고정 캐릭터 설정 (TubeFactory 스타일)
                </h2>
                <p className="text-slate-400 text-sm mt-1">참조 이미지와 프롬프트를 조합하여 영상 내내 일관된 인물을 유지합니다.</p>
              </div>
              <button onClick={() => setActiveStep('media')} className="bg-lime-500 text-black px-8 py-3 rounded-2xl font-black hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20 flex items-center gap-2">
                이미지/영상 제작으로 <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => setCharacters(prev => [...prev, createCharacter(prev.length)])} className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                <Plus size={16} /> 캐릭터 추가
              </button>
              <button onClick={handleGenerateAllCharacterImages} className="bg-lime-500 text-black px-4 py-2 rounded-xl text-sm font-black hover:bg-lime-400 transition-all">
                전체 이미지 생성
              </button>
              <button onClick={handleSaveCharacterLibrary} className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                {libraryDirName ? <><span className="text-lime-400">📁</span><span>{libraryDirName}</span></> : <span>라이브러리 저장</span>}
              </button>
              <button onClick={handleLoadCharacterLibrary} className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/10 transition-all flex items-center gap-2">
                {libraryDirName ? <><span className="text-violet-400">📂</span><span>{libraryDirName}에서 불러오기</span></> : <span>라이브러리에서 불러오기</span>}
              </button>
              <button
                onClick={() => { setLibraryDirHandle(null); setLibraryDirName(""); localStorage.removeItem("tubefactory-library-dir"); showToast("폴더 설정이 초기화됐습니다.", "info"); }}
                className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-slate-400"
                title="저장 폴더 초기화"
              >
                📁 폴더 변경
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {characters.map((char, charIndex) => (
                <div key={char.id} className={`bg-[#111a24] border ${char.isActive ? 'border-lime-500/50 shadow-lg shadow-lime-500/10' : 'border-white/5'} p-8 rounded-[32px] space-y-6 relative transition-all`}>
                  <div className="flex justify-between items-start mb-2">
                     <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${char.isActive ? 'bg-lime-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                           {charIndex + 1}
                        </div>
                        <input 
                          className="bg-white/5 text-xl font-bold text-white outline-none w-48 border-b-2 border-transparent focus:border-lime-500 focus:bg-white/10 px-2 py-1 rounded-t-lg transition-all hover:border-white/20"
                          value={char.name} 
                          placeholder="캐릭터 이름 입력"
                          onChange={e => handleUpdateCharacter(char.id, 'name', e.target.value)} 
                        />
                     </div>
                     <div className="flex items-center gap-2">
                       <button
                         onClick={() => handleSaveSingleCharacter(char.id)}
                         className="text-xs font-bold px-3 py-1.5 rounded-full border border-lime-500/30 bg-lime-500/5 text-lime-400 hover:bg-lime-500 hover:text-black transition-all"
                         title="이 캐릭터만 파일로 저장"
                       >
                         저장
                       </button>
                       <button
                         onClick={() => handleLoadSingleCharacter(char.id)}
                         className="text-xs font-bold px-3 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500 hover:text-black transition-all"
                         title="캐릭터 파일 불러와서 덮어쓰기"
                       >
                         불러오기
                       </button>
                       <button
                         onClick={() => handleDuplicateCharacter(char.id)}
                         className="text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/30 transition-all"
                         title="캐릭터 복사"
                       >
                         복사
                       </button>
                       <button
                         onClick={() => handleUpdateCharacter(char.id, "isActive", !char.isActive as any)}
                         className={`text-xs font-bold px-4 py-1.5 rounded-full border transition-all ${char.isActive ? "bg-lime-500/10 border-lime-500/50 text-lime-400" : "bg-white/5 border-white/10 text-slate-500 hover:text-white"}`}
                       >
                         {char.isActive ? "활성화됨" : "사용안함"}
                       </button>
                     </div>
                  </div>

                  <div className={`space-y-6 ${!char.isActive ? 'opacity-40 pointer-events-none' : ''}`}>
                     <div className="grid grid-cols-2 gap-6">
                      {/* ── 1장 업로드 → 4장 자동 생성 ── */}
                      {/* ── 1장 업로드 → 4장 자동 생성 ── */}
                      <div className="bg-violet-500/10 border border-violet-500/30 rounded-2xl p-4 space-y-3 col-span-2">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className="text-violet-400"/>
                          <span className="text-[11px] font-black text-violet-300">참조 이미지 1장으로 캐릭터 시트 자동 생성</span>
                        </div>
                        <p className="text-[10px] text-slate-500">이미지 1장을 업로드하면 AI가 정면/45도/측면/클로즈업 4장을 자동으로 만들어 슬롯에 채워줍니다.</p>
                        <div className="flex gap-3 items-start">
                          {/* 업로드 영역 */}
                          <label
                            className={`flex-1 flex items-center justify-center gap-2 h-16 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDraggingSheet === char.id ? "border-violet-400 bg-violet-500/20 scale-[1.02]" : "border-violet-500/40 hover:border-violet-400 hover:bg-violet-500/5"}`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingSheet(char.id); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingSheet(null); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingSheet(null);
                              const f = e.dataTransfer.files?.[0];
                              if (f && f.type.startsWith("image/")) {
                                const url = URL.createObjectURL(f);
                                setSheetUploadFile(prev => ({ ...prev, [char.id]: f }));
                                setSheetUploadPreview(prev => ({ ...prev, [char.id]: url }));
                              } else if (f) showToast("이미지 파일만 업로드 가능합니다.", "error");
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const url = URL.createObjectURL(f);
                                  setSheetUploadFile(prev => ({ ...prev, [char.id]: f }));
                                  setSheetUploadPreview(prev => ({ ...prev, [char.id]: url }));
                                }
                                e.target.value = "";
                              }}
                            />
                            {isDraggingSheet === char.id ? (
                              <><ImageIcon size={14} className="text-violet-300"/><span className="text-[11px] font-bold text-violet-300">여기에 놓으세요!</span></>
                            ) : (
                              <><Camera size={14} className="text-violet-400"/><span className="text-[11px] font-bold text-violet-300">클릭 또는 드래그로 업로드</span></>
                            )}
                          </label>
                          {/* 미리보기 */}
                          {sheetUploadPreview[char.id] && (
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-violet-500/40 flex-shrink-0 cursor-pointer group"
                              onClick={() => setLightboxUrl(sheetUploadPreview[char.id]!)}
                            >
                              <img src={sheetUploadPreview[char.id]!} className="w-full h-full object-cover" alt="미리보기"/>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 size={14} className="text-white"/>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setSheetUploadFile(prev => ({ ...prev, [char.id]: null })); setSheetUploadPreview(prev => ({ ...prev, [char.id]: null })); }}
                                className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 rounded-full flex items-center justify-center"
                              >
                                <X size={10} className="text-white"/>
                              </button>
                            </div>
                          )}
                        </div>
                        {/* 생성 버튼 */}
                        <button
                          onClick={() => {
                            const f = sheetUploadFile[char.id];
                            if (!f) { showToast("먼저 이미지를 업로드해주세요.", "warning"); return; }
                            handleGenerateCharacterSheet(char.id, f);
                          }}
                          disabled={isGeneratingCharImage === char.id || !sheetUploadFile[char.id]}
                          className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black transition-all flex items-center justify-center gap-2"
                        >
                          {isGeneratingCharImage === char.id ? (
                            <><Loader2 size={14} className="animate-spin"/><span>생성 중...</span></>
                          ) : (
                            <><Sparkles size={14}/><span>캐릭터 시트 생성</span></>
                          )}
                        </button>
                      </div>
                         {/* ── 생성된 캐릭터 시트 ── */}
                         <div className="space-y-3">
                           {char.referenceImageUrl ? (
                             <div className="space-y-2">
                               <label className="text-[10px] text-lime-400 font-black uppercase tracking-widest">
                                 {"생성된 캐릭터 시트"}
                               </label>
                               <div
                                 className="relative w-full rounded-xl overflow-hidden border border-lime-500/30 cursor-pointer group"
                                 onClick={() => setLightboxUrl(char.referenceImageUrl)}
                               >
                                 <img
                                   src={char.referenceImageUrl}
                                   alt={"생성된 캐릭터 시트"}
                                   className="w-full object-cover rounded-xl"
                                 />
                                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <span className="text-white text-xs font-bold">{"🔍 클릭하면 원본 크기로 보기"}</span>
                                 </div>
                               </div>
                             </div>
                           ) : (
                             <div className="w-full aspect-video bg-black/20 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center">
                               <span className="text-[11px] text-slate-600">위에서 이미지를 업로드하고 생성 버튼을 눌러주세요</span>
                             </div>
                           )}
                         </div>

                        {/* 상세 프롬프트 구역 */}
                        <div className="space-y-4">
                           <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">성별 및 연령</label>
                              <div className="flex gap-2">
                                 <select value={char.gender} onChange={e => handleUpdateCharacter(char.id, 'gender', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-lime-500">
                                    <option value="여성">여성</option>
                                    <option value="남성">남성</option>
                                 </select>
                                 <select value={char.age} onChange={e => handleUpdateCharacter(char.id, 'age', e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-lime-500">
                                    <option value="10대">10대</option>
                                    <option value="20대">20대</option>
                                    <option value="30대">30대</option>
                                    <option value="40대">40대</option>
                                    <option value="50대 이상">50대 이상</option>
                                 </select>
                              </div>
                           </div>
                           
                           <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1 flex justify-between">
                                 스타일 묘사 (의상, 헤어 등)
                              </label>
                              <div className="relative group/text">
                                 <textarea 
                                    value={char.style} 
                                    onChange={e => handleUpdateCharacter(char.id, 'style', e.target.value)}
                                    className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-lime-500 resize-none leading-relaxed"
                                    placeholder="예: 긴 생머리, 하얀색 블라우스, 검은색 슬랙스..."
                                 />
                              </div>
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] text-lime-500 font-black uppercase tracking-widest px-1 flex items-center justify-between">
                                 <span>✨ AI 최적화 프롬프트 (영문)</span>
                                 <button
                                   onClick={() => handleOptimizeCharacter(char.id)}
                                   disabled={isOptimizingChar === char.id}
                                   className="flex items-center gap-1 text-[10px] bg-lime-500/10 border border-lime-500/30 text-lime-400 px-2 py-1 rounded-lg hover:bg-lime-500 hover:text-black transition-all"
                                 >
                                   {isOptimizingChar === char.id ? <Loader2 size={10} className="animate-spin"/> : <Wand2 size={10}/>}
                                   생성
                                 </button>
                              </label>
                              <textarea
                                 value={char.aiOptimizedPrompt || ''}
                                 onChange={e => handleUpdateCharacter(char.id, 'aiOptimizedPrompt', e.target.value)}
                                 className="w-full h-24 bg-lime-500/5 border border-lime-500/20 rounded-xl p-3 text-[10px] text-lime-200/80 outline-none focus:border-lime-500 resize-none leading-relaxed"
                                 placeholder="자동 번역/최적화된 프롬프트가 표시되며 변경도 가능합니다."
                              />
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] text-red-400/70 font-black uppercase tracking-widest px-1 flex items-center justify-between">
                                 <span>🚫 네거티브 프롬프트 (제외할 항목)</span>
                                 <button
                                   onClick={() => handleOptimizeNegativePrompt(char.id)}
                                   disabled={isOptimizingNegativeChar === char.id}
                                   className="flex items-center gap-1 text-[10px] bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-1 rounded-lg hover:bg-red-500 hover:text-black transition-all"
                                 >
                                   {isOptimizingNegativeChar === char.id ? <Loader2 size={10} className="animate-spin"/> : <Wand2 size={10}/>}
                                   자동 생성
                                 </button>
                              </label>
                              <textarea
                                 value={char.negativePrompt || ''}
                                 onChange={e => handleUpdateCharacter(char.id, 'negativePrompt', e.target.value)}
                                 className="w-full h-20 bg-red-500/5 border border-red-500/20 rounded-xl p-3 text-[10px] text-red-200/70 outline-none focus:border-red-400 resize-none leading-relaxed"
                                 placeholder="blurry, distorted, bad anatomy..."
                              />
                           </div>

                        </div>
                     </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-lime-500/5 border border-lime-500/20 p-6 rounded-2xl flex items-center gap-4 text-sm mt-8">
               <ShieldAlert className="text-lime-500 shrink-0" size={24} />
               <p className="text-slate-300">
                  <span className="font-bold text-lime-400">오리지널 벤치마킹 적용:</span> 업로드한 참조 이미지와 텍스트 묘사가 조합되어 다음 단계인 <strong className="text-white">이미지/영상 제작</strong> 시 프롬프트에 자동으로 주입됩니다. 각 씬마다 어떤 캐릭터가 등장할지 슬롯을 지정할 수 있습니다.
               </p>
            </div>
          </div>
        );

      case 'media':
        return (
          <div className="p-6 space-y-5 animate-in fade-in duration-500 max-w-[1480px] mx-auto overflow-x-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">이미지 생성</h2>
                <p className="text-slate-400 text-sm">장면별 이미지/영상을 빠르게 생성하고 저장합니다.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleBatchImageGenerate} className="bg-lime-500 text-black px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-lime-400 transition-all">
                  <Wand2 size={16} /> 전체 생성
                </button>
                <button onClick={() => setActiveStep('thumbnail')} className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-white/10 transition-all">
                  썸네일 이동 <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
              <div className="bg-[#101a26] border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">미디어 모델 선택</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-[#0b121d] border border-white/10 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">이미지 모델</div>
                    <div className="flex flex-wrap gap-2">
                      {mediaImageModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedImageModel(model.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${selectedImageModel === model.id ? 'border-lime-500/70 text-lime-300 bg-lime-500/10' : 'border-white/10 text-slate-300 hover:border-white/20'}`}
                          title={model.note}
                        >
                          {model.label} <span className="text-yellow-300 ml-1">{model.credit}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#0b121d] border border-white/10 rounded-xl p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">영상 모델</div>
                    <div className="flex flex-wrap gap-2">
                      {mediaVideoModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedVideoModel(model.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${selectedVideoModel === model.id ? 'border-lime-500/70 text-lime-300 bg-lime-500/10' : 'border-white/10 text-slate-300 hover:border-white/20'}`}
                          title={model.note}
                        >
                          {model.label} <span className="text-yellow-300 ml-1">{model.credit}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      추가: <code className="text-slate-400">VITE_TUBEFACTORY_VIDEO_MODELS=id|label|credit|note,...</code>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#101a26] border border-white/10 rounded-2xl p-4 space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">현재 선택</div>
                  <div className="mt-2 space-y-2">
                    <div className="bg-[#0b121d] border border-white/10 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">이미지 모델</div>
                      <div className="text-sm font-black text-lime-300">{mediaImageModels.find((model) => model.id === selectedImageModel)?.label || selectedImageModel}</div>
                    </div>
                    <div className="bg-[#0b121d] border border-white/10 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">영상 모델</div>
                      <div className="text-sm font-black text-sky-300">{mediaVideoModels.find((model) => model.id === selectedVideoModel)?.label || selectedVideoModel}</div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#0b121d] border border-white/10 rounded-lg py-2">
                    <div className="text-[10px] text-slate-400">생성 완료</div>
                    <div className="text-lime-300 font-black">{scenes.filter(s => !!s.imageUrl).length}</div>
                  </div>
                  <div className="bg-[#0b121d] border border-white/10 rounded-lg py-2">
                    <div className="text-[10px] text-slate-400">전체 씬</div>
                    <div className="text-white font-black">{scenes.length}</div>
                  </div>
                  <div className="bg-[#0b121d] border border-white/10 rounded-lg py-2">
                    <div className="text-[10px] text-slate-400">영상 완료</div>
                    <div className="text-white font-black truncate px-1">{scenes.filter((scene: any) => !!scene.videoUrl || !!scene.videoRequested).length}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#101a26] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-white">배경 레퍼런스 사용</div>
                <p className="text-[11px] text-slate-400">참조 이미지를 프롬프트에 반영하여 장면 일관성을 맞춥니다.</p>
              </div>
              <button
                onClick={() => setUseBackgroundReference(prev => !prev)}
                className={`h-9 px-4 rounded-xl text-xs font-black border transition-all ${useBackgroundReference ? 'bg-lime-500 text-black border-lime-500' : 'bg-[#0b121d] text-slate-300 border-white/10'}`}
              >
                {useBackgroundReference ? '사용 중' : '사용 안함'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#101a26] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">생성</div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={handleRegenerateAllPrompts} className="bg-[#0b121d] border border-white/10 text-slate-100 px-4 h-9 rounded-xl text-xs font-bold">프롬프트 재생성</button>
                  <button onClick={handleBatchImageGenerate} className="bg-lime-500 text-black px-4 h-9 rounded-xl text-xs font-black">전체 이미지 생성</button>
                  <button onClick={handleGenerateRemainingCuts} className="bg-[#f59e0b] text-black px-4 h-9 rounded-xl text-xs font-black">남은 컷 다시 생성</button>
                  <button onClick={handleGenerateAllVideoPrompts} className="bg-[#4f46e5] px-4 h-9 rounded-xl text-xs font-bold">전체 영상 프롬프트 생성</button>
                  <button onClick={handleGenerateAllVideos} className="bg-[#1e3a8a] px-4 h-9 rounded-xl text-xs font-bold">전체 영상 생성</button>
                  <span className="ml-auto text-[11px] text-slate-400">이미지 {scenes.filter((scene: any) => !!scene.imageUrl).length}/{scenes.length} · 실패 {scenes.filter((scene: any) => !!scene.imageError).length} · 영상 {scenes.filter((scene: any) => !!scene.videoUrl || !!scene.videoRequested).length}/{scenes.length}</span>
                </div>
              </div>
              <div className="bg-[#101a26] border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">저장</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => downloadFile(JSON.stringify(scenes, null, 2), `${topic || 'project'}_prompts.json`, 'application/json')} className="bg-[#0b121d] border border-fuchsia-500/30 text-fuchsia-300 px-4 h-9 rounded-xl text-xs font-bold">전체 프롬프트 다운로드</button>
                  <button onClick={() => showToast('전체 이미지 저장은 서버 저장 경로로 순차 통합 예정입니다.', 'info')} className="bg-[#0b121d] border border-emerald-500/30 text-emerald-300 px-4 h-9 rounded-xl text-xs font-bold">전체 이미지 저장</button>
                  <button onClick={() => showToast('전체 영상 저장은 영상 엔진 저장 API 연결 후 활성화됩니다.', 'info')} className="bg-[#0b121d] border border-sky-500/30 text-sky-300 px-4 h-9 rounded-xl text-xs font-bold">전체 영상 저장</button>
                </div>
              </div>
              <div className="bg-[#101a26] border border-white/10 rounded-2xl p-4 space-y-2 lg:col-span-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">업로드</div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => batchImageInputRef.current?.click()} className="bg-[#0b121d] border border-cyan-500/30 text-cyan-300 px-4 h-9 rounded-xl text-xs font-bold">번호순 일괄 업로드</button>
                  <button onClick={() => promptUploadInputRef.current?.click()} className="bg-[#0b121d] border border-violet-500/30 text-violet-300 px-4 h-9 rounded-xl text-xs font-bold">이미지 프롬프트 업로드</button>
                  <span className="text-[11px] text-slate-500 self-center">지원: png/jpg/webp, txt</span>
                </div>
              </div>
            </div>

            <input
              ref={batchImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(event) => handleBatchImageUpload(event.target.files)}
            />
            <input
              ref={promptUploadInputRef}
              type="file"
              accept=".txt,.csv"
              className="hidden"
              onChange={(event) => {
                const targetFile = event.target.files?.[0] || null;
                handlePromptFileUpload(targetFile);
              }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {scenes.map((scene, i) => (
                <div key={i} className={`bg-[#111a24] border ${scene.imageUrl ? 'border-lime-500/30' : 'border-white/5'} rounded-[32px] overflow-hidden group transition-all flex flex-col shadow-xl`}>
                  {/* 이미지 프리뷰 영역 */}
                  <div className="aspect-square bg-black relative flex items-center justify-center overflow-hidden">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={`Scene ${i+1}`} />
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-600 animate-pulse">
                          <ImageIcon size={32} />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Awaiting Generation</span>
                      </div>
                    )}
                    
                    {scene.isImageGenerating && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-4 backdrop-blur-sm z-20">
                        <Loader2 className="animate-spin text-lime-400" size={40} />
                        <span className="text-xs font-black text-lime-400 uppercase tracking-[0.2em] animate-pulse">Fusion Processing...</span>
                      </div>
                    )}
                    
                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                       <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black text-white uppercase border border-white/10">Scene {i+1}</span>
                       {scene.assignedCharacter && characters.find(c => c.id === scene.assignedCharacter) && (
                         <span className="bg-lime-500/80 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black text-black flex items-center gap-1 border border-lime-400">
                            <Users size={10} /> {characters.find(c => c.id === scene.assignedCharacter)?.name}
                         </span>
                       )}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={() => handleGenerateImage(scene.id)} className="p-2.5 rounded-xl bg-lime-500 text-black hover:bg-lime-400 transition-all font-bold text-xs flex items-center gap-1"><RefreshCw size={14}/> 재생성</button>
                        <button onClick={() => setActiveStep('fusion')} className="p-2.5 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all backdrop-blur-md" title="고급 퓨전 편집기로 보내기"><Maximize2 size={16}/></button>
                    </div>
                  </div>
                  
                  {/* 설정 영역 */}
                  <div className="p-6 space-y-5 flex-1 flex flex-col bg-[#0a0f16]">
                    {/* 캐릭터 할당 UI (TubeFactory 벤치마킹 핵심) */}
                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-1">
                          <Users size={12} /> 등장 캐릭터 지정
                       </label>
                       <div className="flex gap-2">
                          <button 
                             onClick={() => handleAssignCharacterToScene(scene.id, null)}
                             className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${!scene.assignedCharacter ? 'bg-slate-700 border-slate-500 text-white' : 'bg-transparent border-white/10 text-slate-500 hover:border-white/30'}`}
                          >
                             일반 씬
                          </button>
                          {characters.filter(c => c.isActive).map((char, idx) => (
                             <button 
                                key={char.id}
                                onClick={() => handleAssignCharacterToScene(scene.id, char.id)}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${scene.assignedCharacter === char.id ? 'bg-lime-500/20 border-lime-500 text-lime-400' : 'bg-transparent border-white/10 text-slate-500 hover:border-lime-500/30 hover:text-lime-200'}`}
                             >
                                {char.name}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-1">
                       <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">내레이션 (TTS)</label>
                       <p className="text-xs text-slate-300 leading-relaxed border-l-2 border-white/10 pl-3">"{scene.scriptLine}"</p>
                    </div>
                    
                    <div className="space-y-1">
                       <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex justify-between items-end">
                          이미지 프롬프트(한글)
                          <button
                            onClick={() => handleRegenerateScenePrompt(scene.id)}
                            className="text-sky-400 hover:text-sky-300 text-[10px] font-medium flex items-center gap-1"
                          >
                            <RefreshCw size={10}/> 프롬프트 재생성
                          </button>
                       </label>
                       <textarea
                         value={scene.longPrompt || scene.shortPrompt || scene.text || ''}
                         onChange={(event) => handleScenePromptChange(scene.id, event.target.value)}
                         className="w-full h-24 bg-black/40 border border-white/5 rounded-xl p-3 text-[11px] text-slate-300 leading-snug custom-scrollbar resize-none"
                       />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest">영상 프롬프트</label>
                        <button
                          onClick={() => handleGenerateSceneVideoPrompt(scene.id)}
                          className="px-2.5 h-7 rounded-lg text-[10px] font-bold bg-blue-500/20 border border-blue-500/30 text-blue-300"
                        >
                          영상 프롬프트 생성
                        </button>
                      </div>
                      <textarea
                        value={scene.videoPrompt || ''}
                        onChange={(event) => handleSceneVideoPromptChange(scene.id, event.target.value)}
                        placeholder="영상 프롬프트를 생성하거나 직접 입력하세요."
                        className="w-full h-20 bg-black/40 border border-white/5 rounded-xl p-3 text-[11px] text-slate-300 leading-snug custom-scrollbar resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button onClick={() => handleGenerateImage(scene.id)} className="px-3 h-8 rounded-lg text-[11px] font-bold bg-lime-500 text-black">이미지 생성</button>
                      <button onClick={() => showToast('영상 생성은 전체 생성 버튼 또는 추후 개별 영상 API 연결로 동작합니다.', 'info')} className="px-3 h-8 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-slate-200">영상 생성</button>
                      <button onClick={() => sceneImageInputRefMap.current[scene.id]?.click()} className="px-3 h-8 rounded-lg text-[11px] font-bold bg-cyan-500/10 border border-cyan-500/40 text-cyan-300">이미지 업로드</button>
                      <input
                        ref={(element) => { sceneImageInputRefMap.current[scene.id] = element; }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => handleSceneImageUpload(scene.id, event.target.files?.[0] || null)}
                      />
                      <span className="text-[11px] text-slate-500 self-center">{scene.imageError ? '이전 생성 실패' : scene.imageUploaded ? '업로드 이미지 사용 중' : '자동 생성 이미지 사용 중'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'fusion':
        return (
           <div className="w-full h-full bg-[#0a0f16] flex flex-col relative z-50">
              <div className="bg-[#111a24] border-b border-white/5 p-4 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setActiveStep('media')} className="p-2 bg-white/5 rounded-xl text-slate-400 hover:text-white"><ChevronLeft size={20}/></button>
                    <div>
                       <h2 className="text-lg font-bold text-white flex items-center gap-2"><Sparkles className="text-lime-400" size={18}/> 고급 이미지 퓨전 스튜디오</h2>
                       <p className="text-[10px] text-slate-500 uppercase tracking-widest">Standalone Local Engine</p>
                    </div>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                 <SlimAiStudioFusionApp slimMode={true} />
              </div>
           </div>
        );

      case 'thumbnail':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <h2 className="text-2xl font-bold">썸네일 제작</h2>
            <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-lime-500/10 rounded-full flex items-center justify-center text-lime-400 mb-2">
                <ImageIcon size={48} />
              </div>
              <h3 className="text-xl font-bold">썸네일 스튜디오 연동</h3>
              <p className="text-slate-400 max-w-md">고퀄리티 이미지를 바탕으로 클릭을 부르는 썸네일을 제작합니다. 현재 선택된 장면의 이미지를 썸네일 배경으로 활용할 수 있습니다.</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl pt-8">
                {scenes.filter(s => s.imageUrl).map((s, i) => (
                   <div key={i} className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 hover:border-lime-500 transition-all cursor-pointer relative group">
                      <img src={s.imageUrl} className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">이 이미지로 제작</div>
                   </div>
                ))}
              </div>
              <button className="bg-lime-500 text-black px-10 py-3.5 rounded-xl font-black hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20">
                썸네일 편집기 열기
              </button>
            </div>
          </div>
        );

      case 'edit':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">타임라인 편집</h2>
              <button onClick={() => setActiveStep('seo')} className="bg-lime-500 text-black px-8 py-2.5 rounded-xl font-bold hover:bg-lime-400 transition-all flex items-center gap-2">SEO 설정으로 <ChevronRight size={18}/></button>
            </div>
            <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 min-h-[600px] flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 pr-4">
                {scenes.map((scene, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 items-center">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-xs font-black text-slate-500">{i+1}</div>
                    <div className="w-24 h-14 bg-black rounded-lg overflow-hidden border border-white/10">
                      {scene.imageUrl && <img src={scene.imageUrl} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Duration: 3.5s</div>
                      <p className="text-xs text-white line-clamp-1">{scene.scriptLine}</p>
                    </div>
                    <div className="flex gap-2">
                       <button className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white"><Edit2 size={16}/></button>
                       <button className="p-2 rounded-lg bg-white/5 text-red-400 hover:bg-red-400/20"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-6 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-6">
                    <div>
                       <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Duration</div>
                       <div className="text-xl font-black text-lime-400">00:34.2</div>
                    </div>
                    <div className="flex gap-2">
                       <button className="w-10 h-10 rounded-full bg-lime-500 text-black flex items-center justify-center hover:bg-lime-400 transition-all"><Play size={20} fill="currentColor"/></button>
                       <button className="w-10 h-10 rounded-full bg-white/5 text-slate-400 flex items-center justify-center hover:text-white"><FastForward size={20}/></button>
                    </div>
                 </div>
                 <div className="text-xs text-slate-500 uppercase font-black">Timeline Engine Active</div>
              </div>
            </div>
          </div>
        );

      case 'subtitle':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">CapCut 자막 스타일 설정</h2>
                <button onClick={() => setActiveStep('seo')} className="bg-lime-500 text-black px-8 py-2.5 rounded-xl font-bold hover:bg-lime-400 transition-all flex items-center gap-2">SEO 설정으로 <ChevronRight size={18}/></button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col space-y-6">
                 <h3 className="text-xl font-bold">스타일 설정</h3>
                 
                 <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-widest">폰트 (Font Family)</label>
                      <select value={subtitleStyle.fontFamily} onChange={e => setSubtitleStyle({...subtitleStyle, fontFamily: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-lime-500 outline-none">
                        <option value="Noto Sans KR">Noto Sans KR</option>
                        <option value="Pretendard">Pretendard</option>
                        <option value="Gmarket Sans">Gmarket Sans</option>
                        <option value="Gowun Dodum">Gowun Dodum</option>
                        <option value="CookieRun">CookieRun</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                          <label className="text-[10px] text-slate-500 block mb-1">텍스트 색상 (Color)</label>
                          <input type="color" value={subtitleStyle.color} onChange={e => setSubtitleStyle({...subtitleStyle, color: e.target.value})} className="w-full h-8 bg-transparent cursor-pointer" />
                       </div>
                       <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                          <label className="text-[10px] text-slate-500 block mb-1">외곽선 (Outline)</label>
                          <input type="color" value={subtitleStyle.outlineColor} onChange={e => setSubtitleStyle({...subtitleStyle, outlineColor: e.target.value})} className="w-full h-8 bg-transparent cursor-pointer" />
                       </div>
                    </div>
                    <div className="w-full">
                       <label className="text-[10px] text-slate-500 flex justify-between px-1"><span>글자 크기 (Font Size)</span><span>{subtitleStyle.fontSize}px</span></label>
                       <input type="range" min="10" max="100" value={subtitleStyle.fontSize} onChange={e => setSubtitleStyle({...subtitleStyle, fontSize: parseInt(e.target.value)})} className="w-full accent-lime-500" />
                    </div>
                    <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                       <input type="checkbox" id="bold-check" checked={subtitleStyle.bold} onChange={e => setSubtitleStyle({...subtitleStyle, bold: e.target.checked})} className="accent-lime-500 w-4 h-4" />
                       <label htmlFor="bold-check" className="text-sm cursor-pointer select-none">굵게 (Bold)</label>
                    </div>
                 </div>

                 <div className="border-t border-white/10 pt-6 mt-2 space-y-4">
                    <div className="flex items-center justify-between">
                       <label className="text-[10px] text-slate-500 uppercase tracking-widest">내 프리셋 (최대 5개)</label>
                       <button 
                         onClick={() => {
                           if(subtitlePresets.length >= 5) { showToast('프리셋은 최대 5개까지 저장 가능합니다.', 'error'); return; }
                           setSubtitlePresets([...subtitlePresets, subtitleStyle]);
                           showToast('현재 스타일이 프리셋으로 저장되었습니다.', 'success');
                         }}
                         className="text-xs bg-lime-500/10 text-lime-400 px-3 py-1 rounded-lg hover:bg-lime-500 hover:text-black transition-colors"
                       >
                         현재 스타일 저장
                       </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {subtitlePresets.map((preset, i) => (
                         <div key={i} className="group relative">
                           <button 
                             onClick={() => setSubtitleStyle(preset)}
                             className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs hover:bg-white/10 transition-colors"
                           >
                             프리셋 {i+1}
                           </button>
                           <button 
                             onClick={() => setSubtitlePresets(subtitlePresets.filter((_, idx) => idx !== i))}
                             className="absolute -top-2 -right-2 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                           >
                             ×
                           </button>
                         </div>
                       ))}
                       {subtitlePresets.length === 0 && <span className="text-xs text-slate-500">저장된 프리셋이 없습니다.</span>}
                    </div>
                 </div>
               </div>

               <div className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col space-y-6">
                 <h3 className="text-xl font-bold flex items-center gap-2">
                    <Monitor size={20} className="text-lime-400" />
                    미리보기 (Preview)
                 </h3>
                 <div className="flex-1 bg-black rounded-2xl border border-white/10 relative overflow-hidden flex items-center justify-center min-h-[400px]">
                    {scenes.length > 0 && scenes[0].imageUrl ? (
                       <img src={scenes[0].imageUrl} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                    ) : (
                       <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-black"></div>
                    )}
                    
                    <div className="absolute bottom-20 left-0 right-0 px-8 text-center" style={{ fontFamily: subtitleStyle.fontFamily }}>
                       <span 
                         style={{ 
                           fontSize: `${subtitleStyle.fontSize}px`, 
                           color: subtitleStyle.color, 
                           fontWeight: subtitleStyle.bold ? 'bold' : 'normal',
                           WebkitTextStroke: `2px ${subtitleStyle.outlineColor}`,
                           textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                           lineHeight: '1.2'
                         }}
                         className="inline-block"
                       >
                         {scenes.length > 0 && scenes[0].scriptLine ? scenes[0].scriptLine.split('.')[0] + '.' : '여기에 자막 미리보기가 표시됩니다.'}
                       </span>
                    </div>
                 </div>
               </div>
             </div>
          </div>
        );

      case 'seo':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">SEO 및 메타데이터</h2>
                <button 
                  onClick={handleGenerateSeo}
                  disabled={isGenerating}
                  className="bg-lime-500 text-black px-10 py-3 rounded-xl font-black hover:bg-lime-400 transition-all flex items-center gap-2"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={20}/>}
                  AI 최적화 생성
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 space-y-4">
                      <h3 className="text-sm font-bold text-slate-200">유튜브 제목 (Title)</h3>
                      <input 
                        type="text" value={seoData?.title || ''} 
                        onChange={e => setSeoData(prev => ({...prev!, title: e.target.value}))}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-lime-500 outline-none" 
                        placeholder="AI가 생성한 최적의 제목..."
                      />
                   </div>
                   <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 space-y-4">
                      <h3 className="text-sm font-bold text-slate-200">태그 (Tags)</h3>
                      <textarea 
                        value={seoData?.tags || ''} 
                        onChange={e => setSeoData(prev => ({...prev!, tags: e.target.value}))}
                        className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-lime-500 outline-none resize-none" 
                        placeholder="콤마(,)로 구분된 태그들..."
                      />
                   </div>
                </div>
                <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 flex flex-col">
                   <h3 className="text-sm font-bold text-slate-200 mb-4">영상 설명 (Description)</h3>
                   <textarea 
                      value={seoData?.description || ''} 
                      onChange={e => setSeoData(prev => ({...prev!, description: e.target.value}))}
                      className="flex-1 w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-white focus:border-lime-500 outline-none resize-none" 
                      placeholder="SEO 키워드가 포함된 상세 설명..."
                   />
                </div>
             </div>
             
             <div className="flex justify-center pt-8">
                <button onClick={() => setActiveStep('export')} className="bg-white/5 border border-white/10 text-white px-16 py-4 rounded-2xl font-black text-lg hover:bg-white/10 transition-all">내보내기 단계로 이동</button>
             </div>
          </div>
        );

      case 'export':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <div className="text-center space-y-4 mb-12">
               <div className="w-20 h-20 bg-lime-500 rounded-3xl flex items-center justify-center text-black mx-auto shadow-2xl shadow-lime-500/30">
                  <Download size={40} />
               </div>
               <h2 className="text-3xl font-black">최종 영상 데이터 내보내기</h2>
               <p className="text-slate-400">모든 작업이 완료되었습니다! 아래 형식으로 프로젝트를 저장하세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
               <div className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col items-center text-center space-y-6 hover:bg-lime-500/5 transition-all group">
                  <div className="text-5xl">📄</div>
                  <h3 className="text-xl font-bold">SRT 자막 파일</h3>
                  <p className="text-sm text-slate-500">유튜브나 프리미어 등에서 즉시 사용 가능한 표준 자막 파일입니다.</p>
                  <button onClick={() => handleExport('srt')} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-black group-hover:bg-lime-500 group-hover:text-black transition-all uppercase tracking-widest text-xs">Download SRT</button>
               </div>
               <div className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col items-center justify-center text-center space-y-6 hover:bg-white/5 transition-all group">
                  <div className="text-5xl">✂️</div>
                  <h3 className="text-xl font-bold">CapCut XML</h3>
                  <p className="text-sm text-slate-500">CapCut PC 버전에서 즉시 편집 가능한 타임라인 데이터 형식입니다.</p>
                  <button onClick={() => handleExport('capcut')} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-black group-hover:bg-lime-500 group-hover:text-black transition-all uppercase tracking-widest text-xs">Download XML</button>
               </div>
             </div>
          </div>
         );
       case 'tubeflow':
        return (
          <div className="p-8 animate-in fade-in duration-700 max-w-[1000px] mx-auto h-[calc(100vh-100px)] flex flex-col justify-center">
             <div className="bg-gradient-to-br from-lime-500/20 to-emerald-600/20 p-[1px] rounded-[48px] shadow-2xl">
                <div className="bg-[#0a0f16] rounded-[47px] p-16 flex flex-col items-center text-center space-y-8 border border-white/5">
                   <div className="w-24 h-24 bg-lime-500/10 rounded-full flex items-center justify-center text-lime-400 shadow-inner">
                      <Zap size={48} fill="currentColor" className="drop-shadow-[0_0_15px_rgba(132,204,22,0.5)]" />
                   </div>
                   <div className="space-y-3">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase text-white leading-none">TubeFlow Automation</h2>
                      <p className="text-lime-400/60 font-black text-xs uppercase tracking-[0.4em]">Viral Delivery Engine v4.0</p>
                   </div>
                   <p className="text-slate-400 max-w-lg leading-relaxed font-medium">유튜브 업로드 전용 자동화 도구입니다. 캡컷 작업을 마친 후, 생성된 모든 메타데이터를 유튜브 스튜디오에 원클릭으로 전송하고 예약을 관리하세요.</p>
                   
                   <div className="grid grid-cols-3 gap-6 w-full pt-8">
                      {[
                        { icon: <Play />, label: '유튜브 업로드', status: 'READY' },
                        { icon: <Clock />, label: '스케줄 매니저', status: 'ACTIVE' },
                        { icon: <Sliders />, label: '채널 분석', status: 'BETA' }
                      ].map(m => (
                        <div key={m.label} className="bg-white/5 border border-white/5 p-8 rounded-[40px] space-y-4 hover:bg-white/10 transition-all cursor-pointer">
                           <div className="text-lime-400 flex justify-center scale-125 mb-2">{m.icon}</div>
                           <div className="text-[11px] font-black uppercase text-white tracking-widest">{m.label}</div>
                           <div className="text-[9px] font-black bg-lime-500/10 inline-block px-3 py-1 rounded-full text-lime-400 tracking-tighter">{m.status}</div>
                        </div>
                      ))}
                   </div>

                   <button className="bg-lime-500 text-black px-12 py-5 rounded-[24px] font-black hover:bg-lime-400 transition-all shadow-2xl shadow-lime-500/30 uppercase tracking-[0.2em] text-sm flex items-center gap-3 active:scale-95">
                      <Zap size={18} fill="currentColor" /> Open Dashboard
                   </button>
                </div>
             </div>
          </div>
        );

      default:
        return <div className="p-8 text-slate-500 font-bold uppercase tracking-widest text-center py-40">Section Under Construction</div>;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0f16] text-white font-sans overflow-hidden selection:bg-lime-500/30">
      <aside className="w-64 border-r border-white/5 bg-[#0a0f16] flex flex-col shrink-0 relative z-50">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-2xl shadow-lime-500/40 rotate-3 font-black text-black">T</div>
          <span className="text-xl font-black tracking-tighter uppercase leading-none text-white">Tube<br/>Factory</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4 custom-scrollbar">
          {['시스템', '관리', '기획', '음성', '제작', '편집', '완성', '도구'].map(group => (
            <div key={group}>
	              <h3 className="px-3 text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] mb-2">{group}</h3>
	              {menuItems.filter(m => m.group === group).map(item => (
	                <button
	                  key={item.id} onClick={() => setActiveStep(item.id as Step)}
	                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-bold leading-tight transition-all ${activeStep === item.id ? 'bg-gradient-to-r from-lime-500/20 to-transparent text-lime-300 border-l-4 border-lime-500 shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
	                >
	                  {item.icon} {item.label}
	                </button>
	              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f16] relative">
        <header className="h-20 border-b border-white/5 bg-[#0a0f16]/80 backdrop-blur-3xl flex items-center justify-between px-10 z-40">
          <div className="flex items-center gap-6">
            <div className="bg-white/5 px-4 py-2 rounded-xl text-xs font-black border border-white/5">PROJECT: {topic || 'UNTITLED'}</div>
            <div className="bg-lime-500/10 px-4 py-2 rounded-xl text-xs font-black text-lime-400 border border-lime-500/20">{selectedStyle}</div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
             <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-[11px] font-black">M</div>
             <span className="text-xs font-black">마마님</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0f16]">{renderContent()}</main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.03); border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.5s ease-out forwards; }
      `}} />

      {/* 라이트박스 모달 */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[999] bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative flex items-center justify-center w-full h-full p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxUrl}
              alt="원본 크기 보기"
              style={{ maxWidth: "100%", maxHeight: "100vh", objectFit: "contain", imageRendering: "auto" }}
              className="rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center transition-all border border-white/20"
            >
              <X size={18} className="text-white"/>
            </button>
            <a
              href={lightboxUrl}
              download="character_image.png"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 px-4 py-2 bg-lime-500 hover:bg-lime-400 text-black text-xs font-black rounded-xl transition-all flex items-center gap-2"
            >
              ⬇ 원본 다운로드
            </a>
            <div className="absolute bottom-4 left-4 text-[10px] text-slate-400 bg-black/50 px-3 py-1 rounded-lg">
              클릭 외부 영역 또는 X 버튼으로 닫기
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TubeFactoryPanel;









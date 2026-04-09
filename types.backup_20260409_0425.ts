
export enum OutfitStyle {
  NONE = "0. 선택안함",
  MODERN_CHIC = "1. 모던 시크 (Modern Chic)",
  GLAMOUR_PARTY = "2. 글래머 & 파티 (Glamour & Party)",
  ACTIVITY_LUXURY = "3. 액티비티 & 럭셔리 (Activity & Luxury)",
  SECRET_ROMANCE = "4. 시크릿 로맨스 (Middle-aged Affair/Romance)"
}

export enum ScenarioMode {
  NONE = "0. 선택안함",
  DOUBLE_ENTENDRE = "1. 이중의미/오해",
  TWIST_REVERSE = "2. 반전/사이다",
  BLACK_COMEDY = "3. 블랙코미디/풍자",
  ADULT_HUMOR = "4. 부부농담/19금",
  GAG_SSUL = "5. 유머/썰",
  SAVAGE_JUSTICE = "6. 참교육/말빨 배틀"
}

export enum Dialect {
  STANDARD = "표준어",
  JEOLLA = "전라도",
  GYEONGSANG = "경상도"
}

// EngineVersion: 기본값 외에 사용자 정의 엔진도 허용
export type EngineVersion = 'V3' | 'V3_COSTAR' | 'NONE' | string;
export type TargetService = 'GEMINI' | 'CHATGPT' | 'CLAUDE' | 'GENSPARK' | 'HYBRID';

export interface PromptPresetSummary {
  id: string;
  name: string;
  description?: string;
}

export interface PromptPreset extends PromptPresetSummary {
  content: string;
}

export interface UserInput {
  engineVersion: EngineVersion; // V3 (기본) or V3_COSTAR (CO-STAR 최적화)
  category: string; // Now used for Outfit Style
  scenarioMode: ScenarioMode;
  dialect: Dialect;
  targetAge?: string; // e.g., "40s", "50s"
  customContext?: string; // User's additional prompt
  customScript?: string; // [NEW] For Script-to-Image Mode
  customJson?: string; // [NEW] For JSON Import Mode
  targetService: TargetService; // [NEW] Select AI Service
  useRegenerationGuidance?: boolean; // [NEW] 재생성참고문구 활성화
  safeGlamour?: boolean; // [NEW] Use safe but glamorous visual template
  useViralMode?: boolean; // [NEW] 대박 모드 (Viral Mode)
  lockedFemaleOutfit?: string;
  lockedMaleOutfit?: string;
  shortsGenerationMode?: 'none' | 'script-only' | 'script-image'; // [NEW] 쇼츠 생성기 전용 모드
  shortsGenre?: string; // [NEW] 쇼츠 생성기 전용 장르
  topic?: string; // [NEW] 주제 (2단계 생성 시 사용)
  enableWinterAccessories?: boolean; // [NEW] 겨울 악세서리 활성화
}

export type ChapterStatus = 'pending' | 'approved' | 'rejected';

export interface ChapterSummary {
  order: number;
  title: string;
  summary: string;
  emotions: string;
  twistHint: string;
  status?: ChapterStatus;
  content?: string;
}

export interface StyleTemplate {
  id: string;
  name: string;
  createdAt: number;
  service: string;
  type: 'shortform' | 'longform';
  structure: string[];
  tone: string;
  hookStrategy: string;
  twistStyle: string;
  characterNotes?: string;
  imageNotes?: string;
  rawAnalysis?: string;
  hookTiming?: string;
  lengthGuidance?: string;
  dialogueRatio?: string;
  visualBeats?: string[];
  gagPattern?: string;
  ctaStyle?: string;
  mustHaveObjects?: string[];
  isFavorite?: boolean;
  transcriptSource?: string;
}

export interface TemplateAnalysisRequest {
  script: string;
  type: 'shortform' | 'longform';
}

export interface Scene {
  sceneNumber: number;
  shortPrompt: string;
  shortPromptKo: string;
  longPrompt: string;
  longPromptKo: string;
  negativePrompt?: string;
  soraPrompt?: string;     // Sora Video Prompt
  soraPromptKo?: string;   // Sora Video Prompt Korean
  narration?: string;
  dialogue?: string;
  voiceType?: 'narration' | 'lipSync' | 'both' | 'none';
  narrationMeta?: {
    text?: string;
    emotion?: string;
    speed?: 'slow' | 'normal' | 'slightly-fast' | 'fast';
  };
  lipSync?: {
    speaker?: string;
    speakerName?: string;
    line?: string;
    emotion?: string;
    timing?: 'start' | 'mid' | 'end';
  };
  // Optional character metadata for multi-character visual consistency
  characterIds?: string[]; // e.g., ["A","B"] to reference characters array
  characterNames?: string[]; // fallback if ids are missing
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  publishedDate: string;
  thumbnail: string;
  viewCount: number;
  subCount: number;
  viralScore: number;
  durationSec: number;
  durationStr: string;
  url: string;
  tags: string;
}

export interface CharacterVisual {
  id: string; // "A", "B", "C"
  name?: string;
  role?: string;
  outfit?: string;
  hair?: string;
  gender?: 'FEMALE' | 'MALE' | 'OTHER';
}

export interface CharacterCollection {
  id: string;
  name: string;
  description: string;
  thumbnail?: string; // Base64 of the representative image
  generatedImageId?: string; // ID of the original image blob for reference
  age?: string;
  gender?: 'female' | 'male';
  face?: string;
  hair?: string;
  body?: string;
  style?: string;
  bodyTuning?: {
    overall: number;
    shoulderWidth: number;
    legLength: number;
    bustFront: number;
    bustHeight: number;
    pelvisWidth: number;
    buttProjection: number;
    buttLift: number;
  };
  turnaroundImageIds?: {
    front: string;
    angle45: string;
    back: string;
  };
  sourceReferenceImageId?: string;
  approvedAt?: number;
  savedFolderPath?: string;
  savedFolderUrl?: string;
}

export interface StoryResponse {
  id: string;         // 고유 식별자
  createdAt: number;  // 생성 일시 (타임스탬프)
  title: string;
  titleOptions?: string[]; // [NEW] 3 impactful title options from AI
  scriptBody: string;
  punchline: string;
  scenes: Scene[];
  characters?: CharacterVisual[]; // Optional character roster (A/B/C) for visual consistency
  service?: string; // [NEW] AI Service Name (GEMINI, CHATGPT, CLAUDE)
  isFavorite?: boolean; // [NEW] Favorites
  analysis?: AnalysisResult;
  _folderName?: string; // [Internal] Folder path for artifacts
  hook?: string;        // [Internal] Script hook
  twist?: string;       // [Internal] Script twist
}

export interface ScriptAnalysis {
  type?: 'script';
  scores: {
    hook: number;
    twist: number;
    emotion: number;
    length: number;
    viral: number;
  };
  improvements: string[];
  strengths: string[];
  totalScore: number;
}

export interface YouTubeAnalysis {
  type: 'youtube';
  videoInfo: {
    title: string;
    channel: string;
    views: string;
  };
  scores: {
    hook: number;
    immersion: number;
    twist: number;
    popularity: number;
    completeness: number;
  };
  analysis: {
    viralFactor: string;
    structure: {
      hook: string;
      retention: string;
      ending: string;
    };
  };
  benchmarks: string[];
  totalScore: number;
  // Optional compatibility fields
  improvements?: string[];
  strengths?: string[];
}

export interface ModeTemplates {
  scriptOnly: string;
  scriptImage: string;
  scriptOnlyBackups?: string[];
  scriptImageBackups?: string[];
}

export type AnalysisResult = ScriptAnalysis | YouTubeAnalysis;

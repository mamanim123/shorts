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

export type EngineVersion = 'V3' | 'V3_COSTAR' | 'NONE' | string;
export type TargetService = 'GEMINI' | 'CHATGPT' | 'CLAUDE' | 'GENSPARK' | 'HYBRID';
export type CharacterGender = 'female' | 'male' | 'non-binary';

export interface PromptPresetSummary {
  id: string;
  name: string;
  description?: string;
}

export interface PromptPreset extends PromptPresetSummary {
  content: string;
}

export interface UserInput {
  engineVersion: EngineVersion;
  category: string;
  scenarioMode: ScenarioMode;
  dialect: Dialect;
  targetAge?: string;
  customContext?: string;
  customScript?: string;
  customJson?: string;
  targetService: TargetService;
  useRegenerationGuidance?: boolean;
  safeGlamour?: boolean;
  useViralMode?: boolean;
  lockedFemaleOutfit?: string;
  lockedMaleOutfit?: string;
  shortsGenerationMode?: 'none' | 'script-only' | 'script-image';
  shortsGenre?: string;
  topic?: string;
  enableWinterAccessories?: boolean;
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
  soraPrompt?: string;
  soraPromptKo?: string;
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
  characterIds?: string[];
  characterNames?: string[];
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
  id: string;
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
  thumbnail?: string;
  generatedImageId?: string;
  age?: string;
  gender?: 'female' | 'male';
  face?: string;
  hair?: string;
  body?: string;
  style?: string;
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
  id: string;
  createdAt: number;
  title: string;
  titleOptions?: string[];
  scriptBody: string;
  punchline: string;
  scenes: Scene[];
  characters?: CharacterVisual[];
  service?: string;
  isFavorite?: boolean;
  analysis?: AnalysisResult;
  _folderName?: string;
  hook?: string;
  twist?: string;
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

export interface CharacterProfile {
  id: string;
  name: string;
  role: string;
  gender: CharacterGender;
  appearance: string;
  wardrobe: string;
  coreEmotion: string;
}

export interface GenreDefinition {
  id: string;
  label: string;
  guidance: string;
  visualTone: string;
}

export interface StylePreset {
  id: string;
  label: string;
  prompt: string;
}

export interface ScenePlan {
  id: string;
  sceneNumber: number;
  summary: string;
  beat: string;
  camera: string;
  emotion: string;
  prompt: string;
}

export interface PromptPackage {
  scriptPrompt: string;
  scenePrompts: ScenePlan[];
  negativePrompt: string;
}

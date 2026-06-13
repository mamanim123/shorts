export type V4Gender = 'female' | 'male';

export type V4OutfitMode = 'llm' | 'random';

export interface V4GenerateRawOptions {
  service: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  folderName?: string | null;
  skipFolderCreation?: boolean;
}

export interface V4Storyline {
  title: string;
  content: string;
  hook?: string;
  twist?: string;
}

export interface V4SceneSlot {
  slotId: string;
  name: string;
  role?: string;
  gender: V4Gender;
}

export interface V4ScenePlan {
  sceneNumber: number;
  scriptLine: string;
  characterIds: string[];
  action: string;
  background: string;
  cameraAngle: string;
  summary?: string;
}

export interface V4OutfitEntry {
  name: string;
  prompt: string;
}

export interface V4PanelScene {
  number: number;
  text: string;
  prompt: string;
  imageUrl?: string;
  characterIds?: string[];
  cameraAngle?: string;
  background?: string;
  action?: string;
  shortPromptKo?: string;
  longPromptKo?: string;
  summary?: string;
  camera?: string;
  shotType?: string;
  age?: string;
  outfit?: string;
  isSelected?: boolean;
  videoPrompt?: string;
  dialogue?: string;
  voiceType?: 'narration' | 'lipSync' | 'both' | 'none';
  narrationText?: string;
  narrationEmotion?: string;
  narrationSpeed?: 'slow' | 'normal' | 'slightly-fast' | 'fast';
  lipSyncSpeaker?: string;
  lipSyncSpeakerName?: string;
  lipSyncLine?: string;
  lipSyncEmotion?: string;
  lipSyncTiming?: 'start' | 'mid' | 'end';
  seed?: number;
}

export interface V4ValidationIssue {
  severity: 'error' | 'warning';
  sceneNumber?: number;
  code: string;
  message: string;
}

export interface V4FlowInput {
  service: string;
  topic: string;
  genre: string;
  targetAge: string;
  gender: V4Gender;
  selectedStoryTitle?: string;
  selectedStoryContext?: string;
  benchmarkSource?: string;
  useRandomOutfits: boolean;
  useRawLlmParsing?: boolean;
  outfitsData?: any[];
  allowedOutfitCategories?: string[];
  imagePromptLanguage?: 'en' | 'ko';
  lockBackgroundToFirst?: boolean;
}

export interface V4FlowResult {
  title: string;
  scriptBody: string;
  selectedStory?: V4Storyline;
  scenes: V4PanelScene[];
  slotIds: string[];
  outfitMap: Map<string, V4OutfitEntry>;
  folderName: string | null;
  rawAssignment: string;
  validationIssues: V4ValidationIssue[];
}

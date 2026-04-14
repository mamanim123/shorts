export interface Prompt {
  id: string;
  value: string;
}

export interface ImageResult {
  id: string;
  prompt: string;
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

export type EditingState =
  | 'idle'
  | 'prompt'
  | 'text'
  | 'background'
  | 'generating-prompt'
  | 'restoration'
  | 'age-20'
  | 'age-30'
  | 'age-40'
  | 'age-50'
  | 'age-multi'
  | 'upscale-2x'
  | 'upscale-4x'
  | 'painting'
  | 'generating-details'
  | 'chest-cover';

export interface HistoryItem {
  id: string;
  prompt: string;
  generatedImageId?: string;
  favorite: boolean;
  localFilename?: string;
  url?: string;
  createdAt: number;
  source?: string;
  storyId?: string;
  settings: {
    mode: string;
    aspectRatio: string;
    activeCheatKeys: string[];
    noGuard: boolean;
    enhanceBackground: boolean;
    removeBackground: boolean;
    creativity: number;
  };
}

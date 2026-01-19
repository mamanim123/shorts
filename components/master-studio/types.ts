// Fix: Removed self-import of Studio which caused a conflict with the enum declaration.
export enum Studio {
    Image = 'Image',
    Video = 'Video',
    PromptLab = 'PromptLab',
    Audio = 'Audio',
    Recording = 'Recording',
    ImageReverse = 'ImageReverse',
    Thumbnail = 'Thumbnail',
}

export type ImageMode = 'Generate' | 'Edit' | 'Variations' | 'Upscale' | 'Reference';

export interface ImageHistoryItem {
    id: string;
    prompt: string;
    generatedImageId: string;
    originalImageId?: string; // For Edit/Inpaint/etc.
    favorite?: boolean;
    createdAt?: number;
    storyId?: string; // ✅ Folder name (story-scoped) used for grouping images
    sceneNumber?: number; // ✅ Scene number within the story
    characterReferenceImageId?: string; // For Reference mode character
    backgroundReferenceImageId?: string; // For Reference mode background
    templateReferenceImageId?: string; // For Reference mode template
    settings: {
        mode: ImageMode;
        aspectRatio: string;
        activeCheatKeys: string[];
        noGuard: boolean;
        enhanceBackground: boolean;
        removeBackground: boolean;
        creativity: number;
        // referenceType: ReferenceType; // Removed for Dual Reference
        isProMode?: boolean;
        isInpaintMode?: boolean; // Added to track inpaint state within Edit mode
    };
    localFilename?: string;
}

export interface VideoHistoryItem {
    id: string;
    prompt: string;
    videoId: string;
    thumbnailId?: string;
    settings: {
        model: string;
        aspectRatio: string;
        resolution: string;
        noGuard: boolean;
        isProMode?: boolean;
        prioritizeFreedom?: boolean;
        removeBackground?: boolean; // Added for video transparency
    };
    localFilename?: string;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    imageUrls?: string[];
    generatedImageId?: string; // ID for model-generated images stored in DB
    sources?: Array<{ title: string; uri: string }>;
}

export interface ChatSession {
    id: string;
    name: string;
    messages: ChatMessage[];
}

export interface Speaker {
    name: string;
    delivery: string;
    dialogue: string;
    voice: string;
}

export interface AudioHistoryItem {
    id: string;
    speakers: [Speaker, Speaker];
    audioId: string;
}

// For ImageStudioData
export type CheatKeyCategory =
    | "Director's Style"
    | "Camera & Lens"
    | "Artistic Style / Medium (예술 스타일 / 매체)"
    | "만화/애니메이션 스타일 (Manga/Animation Style)"
    | "카툰 / 웹툰 / 그래픽노블 스타일 (Cartoon / Webtoon / Graphic Novel Style)"
    | "플래시 스타일 (Flash Style)"
    | "Genre / Theme (장르 / 테마)"
    | "Character Type (인물 유형)"
    | "Body Type & Appearance (체형 & 외형)"
    | "Hairstyle (헤어스타일)"
    | "Fashion & Costume (패션 & 의상)"
    | "Subject Details / Material (피사체 디테일 / 재질)"
    | "Multi-Character & Crowd (다중 인물 & 군중)"
    | "Environment / Background (환경 / 배경)"
    | "Weather & Atmosphere (날씨 & 분위기)"
    | "Expression & Action (표정 & 행동)"
    | "Detail & Realism (디테일 & 사실성)"
    | "Texture & Shading (질감 & 쉐이딩)"
    | "Lighting & Time (조명 & 시간)"
    | "Shot & Composition (샷 & 구도)";


export interface CheatKey {
    id: string;
    label: string;
    prompt: string;
    description: string;
    aspectRatioGroup?: '9:16' | '16:9' | '4:3' | '3:4';
}

export interface CheatKeyCategoryData {
    [category: string]: CheatKey[];
};

export interface ComboTip {
    id: string;
    title: string;
    description: string;
    keys: string[];
}

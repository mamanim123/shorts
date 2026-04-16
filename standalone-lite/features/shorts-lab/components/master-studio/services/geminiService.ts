import { GoogleGenAI, GenerateContentResponse, Chat, Modality, Type, FunctionDeclaration, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { buildApiUrl } from '../../../../../lib/api';
// Fix: Importing types from the newly created types.ts file.
import { ChatMessage, Speaker } from '../types';
// LUXURY_WARDROBE는 이제 constants.ts에서 직접 import
import { LUXURY_WARDROBE, LUXURY_WARDROBE_KR } from '../../../constants';
import { addApiKey, getActiveApiKeyId, getApiKeys, recordUsage } from './usageTracker';
import {
    applyPromptEnhancementSlots,
    DEFAULT_PROMPT_ENHANCEMENT_SETTINGS
} from '../../../services/promptEnhancementUtils';

// LUXURY_WARDROBE와 LUXURY_WARDROBE_KR를 재export하여 다른 파일들이 import할 수 있도록 함
export { LUXURY_WARDROBE, LUXURY_WARDROBE_KR } from '../../../constants';

let sessionApiKey = '';

export const setSessionApiKey = (value: string) => {
    sessionApiKey = (value || '').trim();
    if (sessionApiKey) {
        const keys = getApiKeys();
        const shouldActivate = keys.length === 0 || (keys.length === 1 && !keys[0].value);
        try {
            addApiKey(sessionApiKey, '세션 키', { activate: shouldActivate });
        } catch (e) {
            // ignore key tracking failures
        }
    }
};

export const initGeminiService = async () => {
    // Check if key exists in session
    if (sessionApiKey) {
        return;
    }

    try {
        const candidateUrls = Array.from(new Set([
            buildApiUrl('/api/auth/gemini-key'),
            'http://localhost:3002/api/auth/gemini-key',
        ]));

        for (const url of candidateUrls) {
            const response = await fetch(url);
            if (!response.ok) {
                continue;
            }
            const data = await response.json();
            if (data.key) {
                setSessionApiKey(data.key);
                console.log(`Master Studio API Key initialized from server: ${url}`);
                return;
            }
        }
    } catch (e) {
        console.warn("Failed to fetch API Key from server:", e);
    }
};

export const getApiKey = () => {
    // 1. Try session key
    let key = sessionApiKey || '';

    // 2. Try Vite env
    if (!key) {
        try {
            // @ts-ignore
            if (import.meta && import.meta.env) {
                // @ts-ignore
                if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
                // @ts-ignore
                if (import.meta.env.VITE_GOOGLE_API_KEY) key = import.meta.env.VITE_GOOGLE_API_KEY;
                // @ts-ignore
                if (import.meta.env.VITE_GEMINI_API_KEY) key = import.meta.env.VITE_GEMINI_API_KEY;
                // @ts-ignore
                if (import.meta.env.GEMINI_API_KEY) key = import.meta.env.GEMINI_API_KEY;
            }
        } catch (e) { }
    }

    // 3. Try global process.env (legacy/fallback)
    if (!key && typeof process !== 'undefined' && process.env) {
        if (process.env.API_KEY) key = process.env.API_KEY;
    }

    return key;
};

const getClient = () => {
    const key = getApiKey();
    if (!key) {
        throw new Error("API key is not available. Please enter your API Key in the Master Studio settings.");
    }
    return new GoogleGenAI({ apiKey: key });
};

/**
 * A wrapper function to add retry logic with exponential backoff to an API call.
 * It will retry on specific, temporary errors like 503 (UNAVAILABLE) and 429 (RESOURCE_EXHAUSTED).
 * @param apiCall The async function to call.
 * @returns The result of the apiCall.
 */
// ========== 다중 API 키 로테이션 (Master Studio용) ==========
let masterKeyPool: string[] = [];
let masterKeyIndex: number = 0;
let masterKeyCooldowns: Record<string, number> = {};
const DEFAULT_GEMINI_IMAGE_MODELS = [
    'gemini-2.5-flash-image',
    'gemini-2.0-flash-exp',
];
const DEFAULT_IMAGEN_MODELS = [
    'imagen-4.0-generate-001',
    'imagen-4.0-fast-generate-001',
    'imagen-3.0-generate-001',
];

const readEnvList = (name: string, fallback: string[]): string[] => {
    // @ts-ignore
    const raw = (typeof process !== 'undefined' && process.env && process.env[name]) || '';
    const parsed = raw
        .split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
    return parsed.length > 0 ? parsed : fallback;
};

const withPreferredModel = (preferred: string | undefined, fallback: string[]): string[] => {
    const normalized = preferred?.trim();
    return Array.from(new Set([...(normalized ? [normalized] : []), ...fallback]));
};

const getGeminiImageModels = (preferred?: string): string[] =>
    withPreferredModel(preferred, readEnvList('GEMINI_IMAGE_MODELS', DEFAULT_GEMINI_IMAGE_MODELS));

const getImagenModels = (preferred?: string): string[] =>
    withPreferredModel(preferred, readEnvList('GEMINI_IMAGEN_MODELS', DEFAULT_IMAGEN_MODELS));

const initMasterKeyPool = (): void => {
    if (masterKeyPool.length > 0) return;

    // @ts-ignore
    const keysString = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEYS) || '';
    const keysList = keysString
        .split(',')
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);

    if (keysList.length > 0) {
        masterKeyPool = keysList;
        console.log(`✅ [Master Studio] ${keysList.length}개의 API 키 로드됨. 키 로테이션 활성화.`);
    }
};

const getNextMasterKey = (): string => {
    initMasterKeyPool();
    if (masterKeyPool.length === 0) return '';

    const now = Date.now();
    for (let i = 0; i < masterKeyPool.length; i++) {
        const index = (masterKeyIndex + i) % masterKeyPool.length;
        const key = masterKeyPool[index];
        if ((masterKeyCooldowns[key] || 0) <= now) {
            masterKeyIndex = (index + 1) % masterKeyPool.length;
            return key;
        }
    }
    const key = masterKeyPool[masterKeyIndex];
    masterKeyIndex = (masterKeyIndex + 1) % masterKeyPool.length;
    return key;
};

const markMasterKeyFailed = (key: string): void => {
    masterKeyCooldowns[key] = Date.now() + 60000;
    console.warn(`⚠️ API 키 할당량 초과. 60초 쿨다운: ${key.slice(0, 10)}...`);
};

const withRetry = async <T>(apiCall: () => Promise<T>, usageContext?: string): Promise<T> => {
    initMasterKeyPool();
    const maxRetries = Math.max(3, masterKeyPool.length || 1);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 키 풀이 있으면 다음 사용 가능한 키로 sessionApiKey 교체
            if (masterKeyPool.length > 1) {
                const nextKey = getNextMasterKey();
                if (nextKey) {
                    sessionApiKey = nextKey;
                    console.log(`🔑 API 키 사용: ${nextKey.slice(0, 10)}...${nextKey.slice(-5)} (시도 ${attempt}/${maxRetries})`);
                }
            }

            const result = await apiCall();
            if (usageContext) {
                recordUsage(usageContext, result, getActiveApiKeyId());
            }
            return result;
        } catch (error) {
            lastError = error as Error;
            const errorMessage = lastError.message?.toLowerCase() || '';

            // Check for 429 / RESOURCE_EXHAUSTED
            const is429 = errorMessage.includes('resource_exhausted') || errorMessage.includes('"code":429') || errorMessage.includes('"status":"resource_exhausted"') || errorMessage.includes('quota exceeded');

            if (is429 && attempt < maxRetries && masterKeyPool.length > 1) {
                // Mark current key as failed
                if (sessionApiKey) {
                    markMasterKeyFailed(sessionApiKey);
                }
                console.log(`🔄 429 에러 감지! 다음 키로 전환 (시도 ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            // Check for other retryable errors (503)
            if (errorMessage.includes('"code":503') || errorMessage.includes('"status":"unavailable"')) {
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`API call failed (Attempt ${attempt}/${maxRetries}). Retrying in ${delay / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                } else {
                    console.error(`API call failed after ${maxRetries} attempts.`);
                    break;
                }
            }

            // Not a retryable error, break immediately
            break;
        }
    }
    throw lastError;
};

const withModelFallback = async <T>(
    models: string[],
    apiCall: (model: string) => Promise<T>,
    usageContext: string
): Promise<T> => {
    let lastError: unknown = null;
    for (let index = 0; index < models.length; index++) {
        const model = models[index];
        try {
            return await apiCall(model);
        } catch (error) {
            lastError = error;
            if (index < models.length - 1) {
                console.warn(`⚠️ ${usageContext} 모델 실패: ${model}. 다음 모델로 롤백합니다.`);
                continue;
            }
            throw error;
        }
    }
    throw lastError instanceof Error ? lastError : new Error(`${usageContext} 실패`);
};

// --- IMAGE STUDIO ---
export const generateImageWithImagen = async (
    prompt: string,
    negativePrompt: string,
    config: { aspectRatio: string; model?: string; seed?: number },
    safetySettings?: any
): Promise<any> => {
    // [FIX] Use raw prompt as server already enhanced it
    const finalPrompt = prompt;

    const payload: any = {
        model: config.model || 'imagen-4.0-generate-001',
        prompt: finalPrompt,
        negativePrompt: negativePrompt || undefined,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio: config.aspectRatio,
        },
        safetySettings
    };

    if (config.seed !== undefined) {
        payload.config.randomSeed = config.seed;
    }

    console.log("Generating Image with Imagen:", { finalPrompt, safetySettings, aspectRatio: config.aspectRatio, seed: config.seed });
    return withModelFallback(
        getImagenModels(config.model),
        (model) => withRetry(() => getClient().models.generateImages({ ...payload, model }), 'Imagen 이미지 생성'),
        'Imagen 이미지 생성'
    );
};

// [NEW] Fetch available models dynamically
// [NEW] Fetch available models dynamically
export const fetchAvailableModels = async (): Promise<string[]> => {
    // 기본적으로 보여줄 이미지 모델 후보 (API 응답에 없을 때도 노출)
    const defaultModels = [
        'imagen-4.0-generate-001',
        'imagen-4.0-fast-generate-001',
        'imagen-4.0-ultra-generate-001',
        'imagen-3.0-generate-001',
    ];

    const key = getApiKey();
    if (!key) return defaultModels;

    try {
        // Use direct REST API fetch to ensure we get the raw list correctly, 
        // avoiding potential SDK version discrepancies.
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch models: ${response.status} ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const models = data.models || [];

        const apiModels = models
            .filter((m: any) => {
                const name = m.name.toLowerCase();
                // Filter for imagen models or models that explicitly support image generation
                return name.includes('imagen') || m.supportedGenerationMethods?.includes('generateImages');
            })
            .map((m: any) => m.name.replace('models/', ''));

        // 기본 리스트와 병합 후 중복 제거
        return Array.from(new Set([...defaultModels, ...apiModels])).sort();
    } catch (e) {
        console.error("Failed to fetch models:", e);
        return defaultModels;
    }
};

export const generateImage = async (prompt: string, config: any, safetySettings?: any, imageParts?: { inlineData: { data: string, mimeType: string } }[]): Promise<GenerateContentResponse> => {
    // [FIX] Use raw prompt as server already enhanced it
    const finalPrompt = prompt;
    const parts: any[] = [{ text: finalPrompt }];
    if (imageParts && imageParts.length > 0) {
        parts.push(...imageParts);
    }
    return withModelFallback(getGeminiImageModels(config.model), (model) => withRetry(() => getClient().models.generateContent({
        model,
        contents: { parts },
        config: {
            ...config,
            responseModalities: [Modality.IMAGE],
            safetySettings,
        },
    }), 'Gemini 이미지 생성'), 'Gemini 이미지 생성');
};

// [NEW] Make prompt safe for content filters
export const makeSafePrompt = (prompt: string): string => {
    let safePrompt = prompt;

    // Define risky keywords and their safe alternatives
    const replacements: Record<string, string> = {
        // Body type descriptors
        'voluptuous figure': 'feminine silhouette',
        'voluptuous': 'shapely',
        'heavy chest': 'elegant proportions',
        'large bust': 'well-proportioned figure',
        'big breasts': 'natural curves',
        'ample bosom': 'graceful silhouette',
        'busty': 'curvaceous',
        'curvy chest': 'elegant body lines',

        // Overly explicit descriptors
        'sexy': 'elegant',
        'seductive': 'charming',
        'provocative': 'confident',
        'revealing': 'stylish',
        'exposed': 'fashionable',

        // Extreme modifiers
        'extremely voluptuous': 'well-proportioned',
        'very voluptuous': 'shapely',
        'notably full': 'balanced proportions',
        'pronounced': 'natural',
        'dramatically accentuating': 'accentuating',
    };

    // Apply replacements (case-insensitive)
    Object.entries(replacements).forEach(([risky, safe]) => {
        const regex = new RegExp(risky, 'gi');
        safePrompt = safePrompt.replace(regex, safe);
    });

    // Add safe framing if body-related terms are present
    if (safePrompt.toLowerCase().includes('figure') ||
        safePrompt.toLowerCase().includes('curves') ||
        safePrompt.toLowerCase().includes('silhouette')) {

        // Ensure it's framed as fashion/outfit description
        if (!safePrompt.toLowerCase().includes('outfit') &&
            !safePrompt.toLowerCase().includes('garment') &&
            !safePrompt.toLowerCase().includes('fashion')) {
            // Add fashion context if missing
            safePrompt = safePrompt.replace(
                /(feminine silhouette|shapely|natural curves|well-proportioned figure)/gi,
                'outfit accentuating $1'
            );
        }
    }

    return safePrompt;
};

// [NEW] Call Server-side Prompt Enhancement API
export const enhancePrompt = async (prompt: string, characterIds?: string[]): Promise<string> => {
    try {
        const response = await fetch('http://localhost:3002/api/enhance-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, characterIds })
        });
        if (response.ok) {
            const data = await response.json();
            return data.enhancedPrompt || prompt;
        }
    } catch (e) {
        console.error("Failed to enhance prompt:", e);
    }
    return prompt;
};

// Extract character description from prompt using AI
export interface ExtractedCharacterProfile {
    description: string;
    korean: string;
    age: string;
    gender: 'female' | 'male';
    face: string;
    hair: string;
    body: string;
    style: string;
    skinTone: string;
    bustDescription: string;
    heightDescription: string;
    signatureFeatures: string;
}

const normalizeCharacterProfile = (payload: Partial<ExtractedCharacterProfile>, fallbackDescription: string): ExtractedCharacterProfile => ({
    description: typeof payload.description === 'string' && payload.description.trim() ? payload.description.trim() : fallbackDescription,
    korean: typeof payload.korean === 'string' && payload.korean.trim() ? payload.korean.trim() : '추출 실패',
    age: typeof payload.age === 'string' && payload.age.trim() ? payload.age.trim() : '30대',
    gender: payload.gender === 'male' ? 'male' : 'female',
    face: typeof payload.face === 'string' ? payload.face.trim() : '',
    hair: typeof payload.hair === 'string' ? payload.hair.trim() : '',
    body: typeof payload.body === 'string' ? payload.body.trim() : '',
    style: typeof payload.style === 'string' ? payload.style.trim() : '',
    skinTone: typeof payload.skinTone === 'string' ? payload.skinTone.trim() : '',
    bustDescription: typeof payload.bustDescription === 'string' ? payload.bustDescription.trim() : '',
    heightDescription: typeof payload.heightDescription === 'string' ? payload.heightDescription.trim() : '',
    signatureFeatures: typeof payload.signatureFeatures === 'string' ? payload.signatureFeatures.trim() : '',
});

const parseCharacterProfileJson = (text: string, fallbackDescription: string): ExtractedCharacterProfile => {
    const cleaned = text
        .trim()
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();

    try {
        const parsed = JSON.parse(cleaned);
        return normalizeCharacterProfile(parsed, fallbackDescription);
    } catch {
        return normalizeCharacterProfile({ description: fallbackDescription, korean: '추출 실패 - 원본 프롬프트 사용' }, fallbackDescription);
    }
};

export const extractCharacterDescription = async (prompt: string): Promise<{ description: string; korean: string }> => {
    const ai = getClient();

    const extractionPrompt = `You are a character description extractor. Analyze the following image generation prompt and extract ONLY the character-related information (appearance, clothing, physical features, age, gender, etc.). 

Remove all non-character elements like:
- Background descriptions
- Lighting/camera settings
- Artistic style references
- Technical parameters (aspect ratio, quality, etc.)
- Actions/poses (unless they define the character's permanent traits)

Return the result in this exact format:
ENGLISH: [concise character description in English]
KOREAN: [한글로 번역된 캐릭터 설명]

If there are multiple characters, focus on the main subject.

Original Prompt:
${prompt}`;

    try {
        const result = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: { parts: [{ text: extractionPrompt }] }
        }), '캐릭터 설명 추출');

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse the response
        const englishMatch = text.match(/ENGLISH:\s*(.+?)(?=\nKOREAN:|$)/s);
        const koreanMatch = text.match(/KOREAN:\s*(.+?)$/s);

        const description = englishMatch ? englishMatch[1].trim() : text.trim();
        const korean = koreanMatch ? koreanMatch[1].trim() : '번역 실패';

        return { description, korean };
    } catch (error) {
        console.error('Character extraction failed:', error);
        // Fallback: return original prompt
        return { description: prompt, korean: '추출 실패 - 원본 프롬프트 사용' };
    }
};

export const extractCharacterProfile = async (
    prompt: string,
    images?: Array<{ inlineData: { data: string; mimeType: string } }>
): Promise<ExtractedCharacterProfile> => {
    const ai = getClient();
    const extractionPrompt = `You are a recurring-character identity analyst for AI image generation.

Analyze the provided prompt and optional reference images, then extract ONLY persistent identity traits that should remain the same across scenes.

Rules:
- Focus on immutable character traits.
- Do NOT treat outfits, background, lighting, camera, or temporary pose as identity unless they are clearly permanent signature traits.
- If images are provided, trust the images more than the prompt for face, hair, body silhouette, skin tone, and signature features.
- Keep outputs concise but useful for future prompt locking.
- Return strict JSON only.

JSON schema:
{
  "description": "concise English recurring-character prompt block",
  "korean": "한글 요약",
  "age": "10대|20대|30대|40대|50대",
  "gender": "female|male",
  "face": "face shape and facial identity",
  "hair": "hairstyle and hairline",
  "body": "body type and silhouette",
  "style": "core style/persona that should persist",
  "skinTone": "skin tone if identifiable",
  "bustDescription": "upper-body or chest silhouette if relevant",
  "heightDescription": "height or proportion impression if identifiable",
  "signatureFeatures": "beauty mark, jawline, eye shape, signature detail"
}

Prompt context:
${prompt || 'No prompt provided.'}`;

    try {
        const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: extractionPrompt }];
        if (Array.isArray(images)) {
            images.forEach((image) => {
                if (image?.inlineData?.data && image.inlineData.mimeType) {
                    parts.push(image);
                }
            });
        }

        const result = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: { parts },
            config: {
                temperature: 0.2,
                responseMimeType: 'application/json'
            }
        }), '캐릭터 프로필 추출');

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return parseCharacterProfileJson(text, prompt);
    } catch (error) {
        console.error('Character profile extraction failed:', error);
        return normalizeCharacterProfile({
            description: prompt,
            korean: '추출 실패 - 기존 프롬프트 기준',
        }, prompt);
    }
};

export const editImage = async (
    prompt: string,
    image: { inlineData: { data: string, mimeType: string } },
    config: any,
    safetySettings?: any,
    referenceImage?: { inlineData: { data: string, mimeType: string } },
    mask?: { inlineData: { data: string, mimeType: string } }
): Promise<GenerateContentResponse> => {
    // [FIX] Use raw prompt as server already enhanced it
    const finalPrompt = prompt;
    const parts: any[] = [{ text: finalPrompt }, image];
    if (referenceImage) {
        parts.push(referenceImage);
    }
    if (mask) {
        parts.push(mask);
    }
    return withModelFallback(getGeminiImageModels(config.model), (model) => withRetry(() => getClient().models.generateContent({
        model,
        contents: { parts },
        config: {
            ...config,
            responseModalities: [Modality.IMAGE],
            safetySettings,
        },
    }), '이미지 편집'), '이미지 편집');
};

export const variationsImage = async (prompt: string, image: { inlineData: { data: string, mimeType: string } }, config: any, safetySettings?: any): Promise<GenerateContentResponse> => {
    // [FIX] Use raw prompt as server already enhanced it
    const finalPrompt = prompt;
    const parts = [{ text: finalPrompt }, image];
    return withModelFallback(getGeminiImageModels(config.model), (model) => withRetry(() => getClient().models.generateContent({
        model,
        contents: { parts },
        config: {
            ...config,
            responseModalities: [Modality.IMAGE],
            safetySettings,
        },
    }), '이미지 변형'), '이미지 변형');
};


// --- VIDEO STUDIO ---
export const generateVideo = async (prompt: string, config: any, safetySettings?: any, startFrame?: { imageBytes: string, mimeType: string }, endFrame?: { imageBytes: string, mimeType: string }): Promise<any> => {
    const ai = getClient();
    const payload: any = {
        model: config.model,
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: config.resolution || '720p',
            aspectRatio: config.aspectRatio,
        },
        safetySettings
    };
    if (startFrame) payload.image = startFrame;
    // Fix: 'lastFrame' is only supported by newer models (e.g. Veo 3.1). 
    // Sending it to unsupported models (Veo 3.0) causes an INVALID_ARGUMENT error.
    if (endFrame && config.model.includes('veo-3.1')) {
        payload.config.lastFrame = endFrame;
    }

    return withRetry(() => ai.models.generateVideos(payload), 'Veo 비디오 생성');
};

export const checkVideoOperation = async (operation: any): Promise<any> => {
    const ai = getClient();
    return withRetry(() => ai.operations.getVideosOperation({ operation: operation }), 'Veo 상태 확인');
}

// --- PROMPT LAB ---
export const createChat = (): Chat => {
    const ai = getClient();

    const systemInstruction = "You are a real-time AI assistant. Your core function is to provide the most current and accurate information. You MUST use your search tool for any query about events, facts, schedules, or information that could change over time. Start your response by stating the date you are referencing. Never use your internal knowledge for time-sensitive questions.";

    return ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
            systemInstruction
        }
    });
};


// Fix: Updated function to accept pre-built parts for multi-file upload functionality.
export const sendMessageToChat = async (chat: Chat, parts: Array<{ text: string } | { inlineData: { data: string, mimeType: string } }>): Promise<GenerateContentResponse> => {
    const today = new Date().toISOString().split('T')[0];
    let processedParts = [...parts];
    const textPartIndex = processedParts.findIndex(p => 'text' in p);

    if (textPartIndex !== -1) {
        const originalTextPart = processedParts[textPartIndex] as { text: string };
        processedParts[textPartIndex] = { ...originalTextPart, text: `(Today's Date is ${today}. Use this as the basis for all real-world searches and answers.) User query: ${originalTextPart.text}` };
    } else {
        processedParts.unshift({ text: `(Today's Date is ${today}. Use this as the basis for all real-world searches and answers.)` });
    }

    const request: any = {
        message: processedParts,
        tools: [{ googleSearch: {} }]
    };

    return withRetry(() => chat.sendMessage(request), '프롬프트 연구소 채팅');
};


// --- AUDIO STUDIO ---
// 간단한 AI 대화 스크립트 생성기: 2인 대화 JSON을 돌려줍니다.
export const generateDialogueScript = async (
    scenario: string,
    cast: Array<{ name: string; voice: string }>
): Promise<[Speaker, Speaker]> => {
    const ai = getClient();
    const [a, b] = cast.length >= 2 ? cast : [{ name: 'Speaker A', voice: 'Kore' }, { name: 'Speaker B', voice: 'Puck' }];
    const prompt = `Write a short two-person dialogue (2-4 turns) for an audio drama.
Scenario: ${scenario}
Speakers: ${a.name} (voice: ${a.voice}), ${b.name} (voice: ${b.voice})
Return JSON only:
{
  "speakers": [
    { "name": "${a.name}", "voice": "${a.voice}", "delivery": "Say <tone>:", "dialogue": "<line>" },
    { "name": "${b.name}", "voice": "${b.voice}", "delivery": "Say <tone>:", "dialogue": "<line>" }
  ]
}
Do not use double quotes (") inside "delivery" or "dialogue" values. Use single quotes or parentheses instead.
Keep it concise and balanced.`;

    try {
        const res = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{ parts: [{ text: prompt }] }]
        }), '오디오 대본 생성');
        const text = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.speakers) && parsed.speakers.length >= 2) {
            return [
                { name: parsed.speakers[0].name || a.name, voice: parsed.speakers[0].voice || a.voice, delivery: parsed.speakers[0].delivery || 'Say naturally:', dialogue: parsed.speakers[0].dialogue || '' },
                { name: parsed.speakers[1].name || b.name, voice: parsed.speakers[1].voice || b.voice, delivery: parsed.speakers[1].delivery || 'Say naturally:', dialogue: parsed.speakers[1].dialogue || '' },
            ];
        }
    } catch (e) {
        console.warn('generateDialogueScript fallback 사용:', e);
    }

    // 실패 시 기본 값 반환
    return [
        { name: a.name, voice: a.voice, delivery: 'Say calmly:', dialogue: 'No script generated.' },
        { name: b.name, voice: b.voice, delivery: 'Say calmly:', dialogue: 'Please try again.' },
    ];
};

export const generateMultiSpeakerAudio = async (speakers: [Speaker, Speaker]): Promise<GenerateContentResponse> => {
    await initGeminiService();
    const ai = getClient();
    const prompt = `TTS the following conversation between ${speakers[0].name} and ${speakers[1].name}:
        ${speakers[0].name}: ${speakers[0].delivery} ${speakers[0].dialogue}
        ${speakers[1].name}: ${speakers[1].delivery} ${speakers[1].dialogue}`;

    return withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                multiSpeakerVoiceConfig: {
                    speakerVoiceConfigs: [
                        {
                            speaker: speakers[0].name,
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: speakers[0].voice } }
                        },
                        {
                            speaker: speakers[1].name,
                            voiceConfig: { prebuiltVoiceConfig: { voiceName: speakers[1].voice } }
                        }
                    ]
                }
            }
        }
    }), '멀티스피커 오디오 생성');
};

export const generateSingleSpeakerAudio = async (
    voiceName: string,
    text: string
): Promise<GenerateContentResponse> => {
    await initGeminiService();
    const ai = getClient();
    const prompt = `TTS the following text: ${text}`;

    return withRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName }
                }
            }
        }
    }), '싱글스피커 오디오 생성');
};

// [NEW] Unified Safe Glamour Logic
export const enhancePromptWithSafeGlamour = (prompt: string): string => {
    if (!prompt) return "";
    const hasFemale = /\b(Woman|Girl|Lady|Female|여성|여자)\b/i.test(prompt);
    return applyPromptEnhancementSlots(prompt, DEFAULT_PROMPT_ENHANCEMENT_SETTINGS, {
        hasFemaleCharacter: hasFemale
    });
};

import { GoogleGenAI, Schema, Type } from '@google/genai';
import { getApiKey } from './geminiService';

export enum ReversePromptMediaType {
    Image = 'image',
    Video = 'video',
    Audio = 'audio',
}

export type ReversePromptLanguage = 'ko' | 'en';

export interface AnalyzeMediaOptions {
    fileBase64: string;
    mimeType: string;
    mediaType: ReversePromptMediaType;
    language: ReversePromptLanguage;
}

export const MAX_REVERSE_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const detectMediaType = (file: File): ReversePromptMediaType | null => {
    if (file.type.startsWith('image/')) return ReversePromptMediaType.Image;
    if (file.type.startsWith('video/')) return ReversePromptMediaType.Video;
    if (file.type.startsWith('audio/')) return ReversePromptMediaType.Audio;
    return null;
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64);
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

const SYSTEM_PROMPT = `
You are an expert "Reverse Prompt Architect" and "Media Forensics Specialist".
Analyze every file with extreme precision. Use cinematography, photography, and music-production terminology.
Separate analytic descriptions from generation prompts. Be highly structured and professional.`;

const IMAGE_REQUEST_INSTRUCTION =
    'Analyze this image to craft a Midjourney-ready prompt. Provide a structured visual breakdown before the prompt.';
const VIDEO_REQUEST_INSTRUCTION =
    'Analyze this video. You must describe camera work, visuals, editing rhythm, and the audio track.';
const AUDIO_REQUEST_INSTRUCTION =
    'Analyze this audio track as a producer. Break down genre, instrumentation, vocals, mood, and create a Suno/Udio prompt.';

const IMAGE_SCHEMA: Schema = {
    type: Type.OBJECT,
    required: ['visual_analysis', 'midjourney_data'],
    properties: {
        visual_analysis: {
            type: Type.OBJECT,
            properties: {
                subject_details: { type: Type.STRING },
                environment: { type: Type.STRING },
                lighting_style: { type: Type.STRING },
                color_grade: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
                composition_guide: { type: Type.STRING },
                artistic_style: { type: Type.STRING },
            },
        },
        midjourney_data: {
            type: Type.OBJECT,
            properties: {
                prompt: { type: Type.STRING },
                negative_prompt: { type: Type.STRING },
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        aspect_ratio: { type: Type.STRING },
                        stylize: { type: Type.NUMBER },
                        chaos: { type: Type.NUMBER },
                        weird: { type: Type.NUMBER },
                        version: { type: Type.STRING },
                        tile: { type: Type.BOOLEAN },
                    },
                },
                full_command: { type: Type.STRING },
            },
        },
    },
};

const VIDEO_SCHEMA: Schema = {
    type: Type.OBJECT,
    required: ['cinematography', 'visuals', 'editing', 'audio_atmosphere', 'video_prompt'],
    properties: {
        cinematography: {
            type: Type.OBJECT,
            properties: {
                camera_movement: { type: Type.STRING },
                shot_type: { type: Type.STRING },
                camera_angle: { type: Type.STRING },
                lens_characteristics: { type: Type.STRING },
            },
        },
        visuals: {
            type: Type.OBJECT,
            properties: {
                subject_action: { type: Type.STRING },
                lighting_atmosphere: { type: Type.STRING },
                color_palette: { type: Type.STRING },
                visual_style: { type: Type.STRING },
            },
        },
        editing: {
            type: Type.OBJECT,
            properties: {
                pacing: { type: Type.STRING },
                transition_style: { type: Type.STRING },
            },
        },
        audio_atmosphere: {
            type: Type.OBJECT,
            properties: {
                sound_design: { type: Type.STRING },
                music: { type: Type.STRING },
                dialogue: { type: Type.STRING },
            },
        },
        video_prompt: { type: Type.STRING },
    },
};

const AUDIO_SCHEMA: Schema = {
    type: Type.OBJECT,
    required: ['musical_structure', 'instrumentation', 'vocal_layer', 'emotional_profile', 'audio_prompt'],
    properties: {
        musical_structure: {
            type: Type.OBJECT,
            properties: {
                genre_main: { type: Type.STRING },
                sub_genre: { type: Type.STRING },
                key_scale: { type: Type.STRING },
                bpm: { type: Type.NUMBER },
                time_signature: { type: Type.STRING },
            },
        },
        instrumentation: {
            type: Type.OBJECT,
            properties: {
                lead: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
                rhythm: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                },
                bass: { type: Type.STRING },
                drums: { type: Type.STRING },
            },
        },
        vocal_layer: {
            type: Type.OBJECT,
            properties: {
                presence: { type: Type.BOOLEAN },
                gender: { type: Type.STRING },
                style: { type: Type.STRING },
            },
        },
        emotional_profile: {
            type: Type.OBJECT,
            properties: {
                mood: { type: Type.STRING },
                energy_level: { type: Type.STRING },
            },
        },
        audio_prompt: { type: Type.STRING },
    },
};

const getSchemaByMediaType = (mediaType: ReversePromptMediaType): Schema => {
    switch (mediaType) {
        case ReversePromptMediaType.Video:
            return VIDEO_SCHEMA;
        case ReversePromptMediaType.Audio:
            return AUDIO_SCHEMA;
        default:
            return IMAGE_SCHEMA;
    }
};

const getInstructionByMediaType = (mediaType: ReversePromptMediaType): string => {
    switch (mediaType) {
        case ReversePromptMediaType.Video:
            return VIDEO_REQUEST_INSTRUCTION;
        case ReversePromptMediaType.Audio:
            return AUDIO_REQUEST_INSTRUCTION;
        default:
            return IMAGE_REQUEST_INSTRUCTION;
    }
};

const buildLanguageHint = (language: ReversePromptLanguage): string =>
    language === 'ko'
        ? 'IMPORTANT: Provide descriptive fields in Korean, but keep prompts/commands strictly in English.'
        : 'Provide all fields in English.';

export const analyzeMedia = async (options: AnalyzeMediaOptions) => {
    const key = getApiKey();
    if (!key) {
        throw new Error('API Key가 필요합니다. 먼저 Master Studio 설정에서 키를 입력하세요.');
    }

    const client = new GoogleGenAI({ apiKey: key });
    const schema = getSchemaByMediaType(options.mediaType);
    const instruction = `${getInstructionByMediaType(options.mediaType)} ${buildLanguageHint(options.language)}`;

    const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [
            {
                role: 'user',
                parts: [
                    { inlineData: { mimeType: options.mimeType, data: options.fileBase64 } },
                    { text: instruction },
                ],
            },
        ],
        config: {
            systemInstruction: SYSTEM_PROMPT,
            responseSchema: schema,
            responseMimeType: 'application/json',
            temperature: 0.4,
        },
    });

    const text = response.text ?? '';
    if (!text.trim()) {
        throw new Error('분석 결과를 찾을 수 없습니다.');
    }

    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
};

export const validateGeminiKey = async (key: string): Promise<boolean> => {
    if (!key) return false;
    const client = new GoogleGenAI({ apiKey: key });
    try {
        await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        });
        return true;
    } catch (error) {
        console.error('Gemini Key validation failed:', error);
        return false;
    }
};

export const getMediaTypeLabel = (type: ReversePromptMediaType): string => {
    switch (type) {
        case ReversePromptMediaType.Video:
            return '영상 분석';
        case ReversePromptMediaType.Audio:
            return '오디오 분석';
        default:
            return '이미지 분석';
    }
};

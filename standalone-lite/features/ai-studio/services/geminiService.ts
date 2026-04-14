import { GoogleGenAI, Modality, Type } from '@google/genai';
import { buildApiUrl } from '../../../lib/api';

type ProcessEnvMap = Record<string, string | undefined>;

type MaskPayload = {
  data: string;
  mimeType: string;
};

type ResponsePart = {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
};

let apiKeyPool: string[] = [];
let currentKeyIndex = 0;
let keyCooldowns: Record<string, number> = {};
let lastUsedKey = '';
let sessionApiKey = '';

const DEFAULT_GEMINI_IMAGE_MODELS = ['gemini-2.5-flash-image'];

export const setSessionApiKey = (value: string): void => {
  sessionApiKey = value.trim();
};

export const initGeminiService = async (): Promise<void> => {
  if (sessionApiKey) return;

  try {
    const response = await fetch(buildApiUrl('/api/auth/gemini-key'));
    if (!response.ok) return;
    const payload = await response.json();
    if (typeof payload?.key === 'string' && payload.key.trim()) {
      setSessionApiKey(payload.key);
    }
  } catch {
    // keep env fallback path
  }
};

export const getApiKey = (): string => {
  if (sessionApiKey) return sessionApiKey;

  const viteKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    import.meta.env.VITE_API_KEY ||
    '';

  if (viteKey) return viteKey;

  return readEnv('GEMINI_API_KEY') || readEnv('API_KEY');
};

const getProcessEnv = (): ProcessEnvMap | undefined => {
  const runtime = globalThis as typeof globalThis & { process?: { env?: ProcessEnvMap } };
  return runtime.process?.env;
};

const readEnv = (name: string): string => getProcessEnv()?.[name]?.trim() || '';

const getEnvList = (name: string, fallback: string[]): string[] => {
  const raw = readEnv(name);
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
};

const initializeKeyPool = (): void => {
  if (apiKeyPool.length > 0) return;
  const keys = getEnvList('GEMINI_API_KEYS', []);
  if (keys.length > 0) {
    apiKeyPool = keys;
  }
};

const getNextAvailableKey = (): string => {
  initializeKeyPool();
  if (apiKeyPool.length === 0) return '';

  const now = Date.now();
  for (let offset = 0; offset < apiKeyPool.length; offset += 1) {
    const index = (currentKeyIndex + offset) % apiKeyPool.length;
    const key = apiKeyPool[index];
    if ((keyCooldowns[key] || 0) <= now) {
      currentKeyIndex = (index + 1) % apiKeyPool.length;
      return key;
    }
  }

  const fallback = apiKeyPool[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeyPool.length;
  return fallback;
};

const markKeyFailed = (key: string): void => {
  if (!key) return;
  keyCooldowns = { ...keyCooldowns, [key]: Date.now() + 60000 };
};

const resolveApiKey = (): string => {
  return getApiKey();
};

const getClient = (): GoogleGenAI => {
  const apiKey = apiKeyPool.length > 0 ? getNextAvailableKey() : resolveApiKey();
  if (!apiKey) {
    throw new Error('API 키가 없습니다. Master Studio 설정 또는 .env를 확인해주세요.');
  }
  lastUsedKey = apiKey;
  return new GoogleGenAI({ apiKey });
};

const getRetryLimit = (): number => Math.max(1, apiKeyPool.length || 1);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getErrorStatus = (error: unknown): number | undefined => {
  if (!isRecord(error)) return undefined;
  const code = error.code;
  const status = error.status;
  if (typeof code === 'number') return code;
  if (typeof status === 'number') return status;
  return undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

const is429Error = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  const status = getErrorStatus(error);
  return status === 429 || message.includes('429') || message.includes('quota') || message.includes('resource_exhausted');
};

const isTransientError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  const status = getErrorStatus(error);
  return [500, 502, 503].includes(status || 0) || message.includes('timeout') || message.includes('unavailable');
};

const isNoImageGeneratedError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('이미지가 생성되지 않았습니다') || message.includes('image was not generated');
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('파일 인코딩 실패'));
        return;
      }
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = () => reject(reader.error || new Error('파일 읽기 실패'));
  });

const extractImageResponse = (parts: ResponsePart[] | undefined): { imageUrl: string | null; text: string | null } => {
  let imageUrl: string | null = null;
  let text: string | null = null;

  for (const part of parts || []) {
    if (part.inlineData) {
      imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    } else if (part.text) {
      text = part.text;
    }
  }

  return { imageUrl, text };
};

export const base64ToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
};

export async function generateImageFromImagesAndText(namedImageFiles: { name: string; file: File }[], prompt: string): Promise<string> {
  initializeKeyPool();
  const models = getEnvList('GEMINI_IMAGE_MODELS', DEFAULT_GEMINI_IMAGE_MODELS);
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= getRetryLimit(); attempt += 1) {
      try {
        const ai = getClient();
        const imageParts = await Promise.all(
          namedImageFiles.map(async ({ file }) => ({
            inlineData: {
              data: await fileToBase64(file),
              mimeType: file.type,
            },
          })),
        );

        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              ...imageParts,
              {
                text: `다음 이미지들을 참조하여 이미지를 만들어 주세요. 각 이미지는 스타일, 구성, 캐릭터 등의 요소를 제공합니다. 이들을 창의적으로 결합하여 다음을 만들어주세요: "${prompt}"`,
              },
            ],
          },
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        const { imageUrl, text } = extractImageResponse(response.candidates?.[0]?.content?.parts as ResponsePart[] | undefined);
        if (imageUrl) return imageUrl;
        throw new Error(text ? `이미지가 생성되지 않았습니다.\n모델 응답: ${text}` : '이미지가 생성되지 않았습니다.');
      } catch (error) {
        lastError = error;
        if (is429Error(error)) {
          markKeyFailed(lastUsedKey);
        }
        if ((is429Error(error) || isTransientError(error)) && attempt < getRetryLimit()) {
          await sleep(1000 * attempt);
          continue;
        }
        break;
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('이미지 생성에 실패했습니다.'));
}

export async function editImage(imageFile: File, prompt: string, mask?: MaskPayload): Promise<string> {
  initializeKeyPool();
  const models = getEnvList('GEMINI_IMAGE_MODELS', DEFAULT_GEMINI_IMAGE_MODELS);
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= getRetryLimit(); attempt += 1) {
      try {
        const ai = getClient();
        const base64ImageData = await fileToBase64(imageFile);
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              { inlineData: { data: base64ImageData, mimeType: imageFile.type } },
              { text: prompt },
              ...(mask ? [{ inlineData: { data: mask.data, mimeType: mask.mimeType } }] : []),
            ],
          },
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        });

        const { imageUrl, text } = extractImageResponse(response.candidates?.[0]?.content?.parts as ResponsePart[] | undefined);
        if (imageUrl) return imageUrl;
        throw new Error(text ? `이미지가 생성되지 않았습니다.\n모델 응답: ${text}` : '이미지가 생성되지 않았습니다.');
      } catch (error) {
        lastError = error;
        if (is429Error(error)) {
          markKeyFailed(lastUsedKey);
        }
        if ((is429Error(error) || isTransientError(error) || isNoImageGeneratedError(error)) && attempt < getRetryLimit()) {
          await sleep(800 * attempt);
          continue;
        }
        break;
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('이미지 편집에 실패했습니다.'));
}

async function generateTextFromImage(imageFile: File, instruction: string, thinkingBudget: number): Promise<string> {
  initializeKeyPool();

  for (let attempt = 1; attempt <= getRetryLimit(); attempt += 1) {
    try {
      const ai = getClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { text: instruction },
            { inlineData: { mimeType: imageFile.type, data: await fileToBase64(imageFile) } },
          ],
        },
        config: {
          thinkingConfig: { thinkingBudget },
        },
      });

      if (response.text) return response.text;
      throw new Error('텍스트 생성에 실패했습니다.');
    } catch (error) {
      if (is429Error(error)) {
        markKeyFailed(lastUsedKey);
      }
      if ((is429Error(error) || isTransientError(error)) && attempt < getRetryLimit()) {
        await sleep(1000 * attempt);
        continue;
      }
      throw error instanceof Error ? error : new Error('텍스트 생성에 실패했습니다.');
    }
  }

  throw new Error('텍스트 생성에 실패했습니다.');
}

export async function generatePromptFromImage(imageFile: File): Promise<string> {
  return generateTextFromImage(
    imageFile,
    '제공된 이미지를 분석해서 장면, 인물 동작, 표정, 배경 사물을 중심으로 상세한 한국어 이미지 프롬프트를 작성해주세요. 아트 스타일, 렌즈, 작가명, 조명 과장은 제외하세요.',
    2048,
  );
}

export async function generatePersonDetailsFromImage(imageFile: File): Promise<string> {
  return generateTextFromImage(
    imageFile,
    '제공된 이미지 속 인물에 대해 몸매 디테일과 의상 디테일만 한국어로 자세히 정리해주세요. 배경 설명은 제외해주세요.',
    1024,
  );
}

export async function revisePromptsForPolicy(prompts: string[]): Promise<string[]> {
  initializeKeyPool();
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Please revise the following prompts in Korean: ${JSON.stringify(prompts)}`,
    config: {
      systemInstruction:
        'You revise image prompts for safety compliance while preserving intent. Return a JSON array of strings with the same length as the input.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      thinkingConfig: { thinkingBudget: 1024 },
    },
  });

  try {
    const parsed = JSON.parse(response.text.trim());
    if (Array.isArray(parsed) && parsed.every((entry) => typeof entry === 'string')) {
      return parsed;
    }
  } catch {
    // ignore parse failure below
  }

  throw new Error('프롬프트 수정 응답을 처리하는 데 실패했습니다.');
}

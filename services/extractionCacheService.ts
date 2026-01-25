export type ExtractedOutfit = { name: string; en: string; ko: string };
export type ExtractedFeature = { en: string; ko: string };

export type ExtractionCache = {
  extractedOutfit?: ExtractedOutfit | null;
  extractedFace?: ExtractedFeature | null;
  extractedHair?: ExtractedFeature | null;
  extractedBody?: ExtractedFeature | null;
  generatedOutfitImage?: string | null;
  generatedFaceImage?: string | null;
  generatedHairImage?: string | null;
  generatedBodyImage?: string | null;
  lastOutfitImageData?: string | null;
  lastFaceImageData?: string | null;
  lastHairImageData?: string | null;
  lastBodyImageData?: string | null;
};

const API_BASE = 'http://localhost:3002';

export const fetchExtractionCache = async (): Promise<ExtractionCache> => {
  try {
    const response = await fetch(`${API_BASE}/api/extraction-cache`);
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { cache?: ExtractionCache };
    return payload.cache || {};
  } catch {
    return {};
  }
};

export const saveExtractionCache = async (cache: ExtractionCache): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/extraction-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cache })
    });
    if (!response.ok) throw new Error('failed');
    return true;
  } catch {
    return false;
  }
};

export const saveExtractionImage = async (imageData: string, type: 'outfit' | 'face' | 'hair' | 'body') => {
  try {
    const response = await fetch(`${API_BASE}/api/extraction-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, type })
    });
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { filename?: string };
    return payload.filename || null;
  } catch {
    return null;
  }
};

export const fetchExtractionImageData = async (filename: string) => {
  try {
    const response = await fetch(`${API_BASE}/api/extraction-image?filename=${encodeURIComponent(filename)}`);
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { imageData?: string };
    return payload.imageData || null;
  } catch {
    return null;
  }
};

export const resetExtractionCache = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/extraction-cache/reset`, {
      method: 'POST'
    });
    if (!response.ok) throw new Error('failed');
    return true;
  } catch {
    return false;
  }
};

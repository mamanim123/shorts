import { buildApiUrl } from '../../../lib/api';

export interface SaveImageResult {
  filename: string;
  url?: string;
  storyId?: string;
  sceneNumber?: number;
}

export const saveImageToDisk = async (
  imageData: string,
  prompt: string,
  storyId?: string,
  sceneNumber?: number,
  storyTitle?: string,
): Promise<SaveImageResult> => {
  const response = await fetch(buildApiUrl('/api/save-image'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, prompt, storyId, sceneNumber, storyTitle }),
  });

  if (!response.ok) {
    throw new Error(`Save image request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!payload?.success || typeof payload?.filename !== 'string') {
    throw new Error(payload?.error || 'Failed to save image');
  }

  return {
    filename: payload.filename,
    url: typeof payload.url === 'string' ? payload.url : undefined,
    storyId: typeof payload.storyId === 'string' ? payload.storyId : undefined,
    sceneNumber: typeof payload.sceneNumber === 'number' ? payload.sceneNumber : undefined,
  };
};

export const deleteFileFromDisk = async (filename: string, fileType: 'image' | 'video'): Promise<boolean> => {
  if (!filename) return false;

  try {
    const response = await fetch(buildApiUrl('/api/delete-file'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, fileType }),
    });
    const payload = await response.json();
    return Boolean(payload?.success);
  } catch {
    return false;
  }
};

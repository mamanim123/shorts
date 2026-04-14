import { buildApiUrl } from '../../../lib/api';

export interface StoryFolderInfo {
  folderName: string;
  imageCount: number;
}

export const fetchDiskImageList = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${buildApiUrl('/api/images/list')}?t=${Date.now()}`);
    if (!response.ok) return [];
    const payload = await response.json();
    if (Array.isArray(payload) && payload.every((entry) => typeof entry === 'string')) {
      return payload;
    }
  } catch {
    // ignore and use fallback below
  }

  return [];
};

export const fetchImageStoryFolders = async (): Promise<StoryFolderInfo[]> => {
  try {
    const response = await fetch(`${buildApiUrl('/api/scripts/story-folders')}?t=${Date.now()}`);
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [];

    return payload
      .map((entry) => ({
        folderName: typeof entry?.folderName === 'string' ? entry.folderName : '',
        imageCount: Number(entry?.imageCount ?? 0),
      }))
      .filter((entry) => entry.folderName);
  } catch {
    // ignore and use fallback below
  }

  return [];
};

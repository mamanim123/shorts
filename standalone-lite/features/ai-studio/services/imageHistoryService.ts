import type { HistoryItem } from '../types';
import { buildApiUrl } from '../../../lib/api';

const normalizeHistoryItem = (item: unknown): HistoryItem | null => {
  if (!item || typeof item !== 'object') return null;

  const candidate = item as Partial<HistoryItem> & { settings?: Partial<HistoryItem['settings']> };
  if (typeof candidate.id !== 'string') return null;

  return {
    id: candidate.id,
    prompt: typeof candidate.prompt === 'string' ? candidate.prompt : '',
    generatedImageId: typeof candidate.generatedImageId === 'string' ? candidate.generatedImageId : undefined,
    favorite: Boolean(candidate.favorite),
    localFilename: typeof candidate.localFilename === 'string' ? candidate.localFilename : undefined,
    url: typeof candidate.url === 'string' ? candidate.url : undefined,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
    source: typeof candidate.source === 'string' ? candidate.source : undefined,
    storyId: typeof candidate.storyId === 'string' ? candidate.storyId : undefined,
    settings: {
      mode: typeof candidate.settings?.mode === 'string' ? candidate.settings.mode : 'Generate',
      aspectRatio: typeof candidate.settings?.aspectRatio === 'string' ? candidate.settings.aspectRatio : '1:1',
      activeCheatKeys: Array.isArray(candidate.settings?.activeCheatKeys)
        ? candidate.settings.activeCheatKeys.filter((entry): entry is string => typeof entry === 'string')
        : [],
      noGuard: Boolean(candidate.settings?.noGuard),
      enhanceBackground: Boolean(candidate.settings?.enhanceBackground),
      removeBackground: Boolean(candidate.settings?.removeBackground),
      creativity: typeof candidate.settings?.creativity === 'number' ? candidate.settings.creativity : 0.8,
    },
  };
};

export const fetchImageHistory = async (): Promise<HistoryItem[]> => {
  try {
    const response = await fetch(buildApiUrl('/api/image-history'));
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload?.history)) return [];
    return payload.history.map(normalizeHistoryItem).filter((item): item is HistoryItem => item !== null);
  } catch {
    return [];
  }
};

export const saveImageHistory = async (history: HistoryItem[]): Promise<boolean> => {
  try {
    const response = await fetch(buildApiUrl('/api/image-history'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

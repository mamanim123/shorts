import type { V4GenerateRawOptions } from './v4Types';

const API_BASE = 'http://localhost:3002';

export const callV4GenerateRaw = async (options: V4GenerateRawOptions): Promise<string> => {
  const response = await fetch(`${API_BASE}/api/generate/raw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service: options.service,
      prompt: options.prompt,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      folderName: options.folderName ?? undefined,
      skipFolderCreation: options.skipFolderCreation ?? true
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `V4 LLM call failed: ${response.status}`);
  }

  return data.rawResponse || data.text || data.result || data.content || '';
};

export const fetchV4Outfits = async (): Promise<any[]> => {
  const response = await fetch(`${API_BASE}/api/outfits`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Outfit API failed: ${response.status}`);
  }
  return Array.isArray(data?.outfits) ? data.outfits : [];
};

export const saveV4Story = async (params: {
  title: string;
  content: string;
  service: string;
  folderName?: string | null;
}): Promise<string | null> => {
  const response = await fetch(`${API_BASE}/api/save-story`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: params.title,
      content: params.content,
      service: params.service,
      folderName: params.folderName || undefined
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Save story failed: ${response.status}`);
  }
  return data?.folderName || params.folderName || null;
};

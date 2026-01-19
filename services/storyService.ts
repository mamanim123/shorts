export type SaveStoryPayload = {
  title: string;
  content: string;
  service?: string;
  folderName?: string;
};

export type SaveStoryResponse = {
  success: boolean;
  filename?: string;
  folderName?: string;
  error?: string;
};

export async function saveStoryFile(payload: SaveStoryPayload): Promise<SaveStoryResponse> {
  const response = await fetch('http://localhost:3002/api/save-story', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to save story');
  }

  return response.json();
}

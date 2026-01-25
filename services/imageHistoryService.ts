export const fetchImageHistory = async (): Promise<any[]> => {
  try {
    const response = await fetch('http://localhost:3002/api/image-history');
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { history?: any[] };
    return Array.isArray(payload.history) ? payload.history : [];
  } catch {
    return [];
  }
};

export const saveImageHistory = async (history: any[]): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3002/api/image-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history }),
    });
    if (!response.ok) throw new Error('failed');
    return true;
  } catch {
    return false;
  }
};

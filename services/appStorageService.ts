const API_BASE = 'http://localhost:3002';
let storageCache: Record<string, unknown> | null = null;
let cachePromise: Promise<void> | null = null;
let isPrimed = false;

export const primeAppStorageCache = async (): Promise<void> => {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/api/app-storage`, { cache: 'no-store' });
      if (!response.ok) throw new Error('failed');
      const payload = (await response.json()) as { storage?: Record<string, unknown> };
      storageCache = payload.storage || {};
      isPrimed = true;
    } catch {
      storageCache = storageCache || {};
      isPrimed = true;
    }
  })();
  return cachePromise;
};

export const ensurePrimed = async (): Promise<void> => {
  if (!isPrimed) {
    await primeAppStorageCache();
  }
};

export const getAppStorageCachedValue = <T,>(key: string, fallback: T): T => {
  if (!isPrimed) {
    console.warn('[appStorageService] Cache not primed yet. Call await primeAppStorageCache() first.');
  }
  if (!storageCache) {
    primeAppStorageCache();
    return fallback;
  }
  if (Object.prototype.hasOwnProperty.call(storageCache, key)) {
    return (storageCache[key] as T) ?? fallback;
  }
  return fallback;
};

export const getAppStorageValue = async <T,>(key: string, fallback: T): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE}/api/app-storage?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { value?: T };
    if (payload && 'value' in payload) {
      if (!storageCache) storageCache = {};
      storageCache[key] = payload.value as T;
      return (payload.value as T) ?? fallback;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

export const setAppStorageValue = async (key: string, value: unknown): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/app-storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    if (!response.ok) throw new Error('failed');
    if (!storageCache) storageCache = {};
    storageCache[key] = value;
    return true;
  } catch {
    return false;
  }
};

export const setAppStorageEntries = async (entries: Record<string, unknown>): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/app-storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries })
    });
    if (!response.ok) throw new Error('failed');
    if (!storageCache) storageCache = {};
    storageCache = { ...storageCache, ...entries };
    return true;
  } catch {
    return false;
  }
};

export const removeAppStorageValue = async (key: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/app-storage`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    if (!response.ok) throw new Error('failed');
    if (storageCache) {
      delete storageCache[key];
    }
    return true;
  } catch {
    return false;
  }
};

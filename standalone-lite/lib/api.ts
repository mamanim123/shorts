const normalizePath = (path: string): string => (path.startsWith('/') ? path : `/${path}`);

export const getApiBaseUrl = (): string => {
  const base = import.meta.env.VITE_API_BASE_URL?.trim() || '';
  return base.replace(/\/$/, '');
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
};

export const buildAssetUrl = (path: string): string => {
  const normalizedPath = normalizePath(path);
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
};

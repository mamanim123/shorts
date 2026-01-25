import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from './appStorageService';

export type OutfitCategoryGender = 'female' | 'male' | 'unisex';

export interface OutfitCategory {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  gender: OutfitCategoryGender;
}

export interface OutfitItem {
  id: string;
  name: string;
  prompt: string;
  category: string;
  createdAt: string;
  imageUrl?: string;
}

export interface OutfitCatalog {
  outfits: OutfitItem[];
  categories: OutfitCategory[];
}

export interface OutfitPoolItem {
  id: string;
  name: string;
  translation: string;
  categories: string[];
  prompt?: string;
}

const OUTFIT_CACHE_KEY = 'outfit-catalog-cache-v1';
const CATEGORY_CACHE_KEY = 'outfit-category-cache-v1';

primeAppStorageCache();

const FALLBACK_CATEGORIES: OutfitCategory[] = [
  { id: 'ROYAL', name: 'ROYAL', gender: 'female' },
  { id: 'YOGA', name: 'YOGA', gender: 'female' },
  { id: 'GOLF LUXURY', name: 'GOLF LUXURY', gender: 'female' },
  { id: 'SEXY', name: 'SEXY', gender: 'female' },
  { id: 'MALE', name: 'MALE', gender: 'male' },
];

const safeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeCategory = (category: Partial<OutfitCategory>): OutfitCategory | null => {
  const id = safeString(category.id || category.name);
  if (!id) return null;
  return {
    id,
    name: safeString(category.name) || id,
    emoji: safeString(category.emoji) || undefined,
    description: safeString(category.description) || undefined,
    gender: (category.gender as OutfitCategoryGender) || 'female',
  };
};

const mergeCategories = (
  categories: OutfitCategory[] = [],
  outfits: OutfitItem[] = []
): OutfitCategory[] => {
  const map = new Map<string, OutfitCategory>();

  FALLBACK_CATEGORIES.forEach((category) => {
    map.set(category.id, category);
  });

  categories.forEach((category) => {
    const normalized = normalizeCategory(category);
    if (normalized) map.set(normalized.id, normalized);
  });

  outfits.forEach((outfit) => {
    const categoryId = safeString(outfit.category);
    if (categoryId && !map.has(categoryId)) {
      map.set(categoryId, {
        id: categoryId,
        name: categoryId,
        gender: 'female',
      });
    }
  });

  return Array.from(map.values());
};

const getStorageValue = <T,>(key: string, fallback: T): T =>
  getAppStorageCachedValue<T>(key, fallback);

export const getCachedOutfitCatalog = (): OutfitCatalog => {
  const outfits = getStorageValue<OutfitItem[]>(OUTFIT_CACHE_KEY, []);
  const categories = getStorageValue<OutfitCategory[]>(CATEGORY_CACHE_KEY, FALLBACK_CATEGORIES);
  const normalizedCategories = mergeCategories(categories, outfits);
  return { outfits, categories: normalizedCategories };
};

export const setCachedOutfitCatalog = (catalog: OutfitCatalog) => {
  const normalizedCategories = mergeCategories(catalog.categories, catalog.outfits);
  setAppStorageValue(OUTFIT_CACHE_KEY, catalog.outfits || []);
  setAppStorageValue(CATEGORY_CACHE_KEY, normalizedCategories);
};

export const fetchOutfitCatalog = async (): Promise<OutfitCatalog> => {
  try {
    const response = await fetch('http://localhost:3002/api/outfits');
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as Partial<OutfitCatalog>;
    const outfits = Array.isArray(payload.outfits) ? payload.outfits : [];
    const categories = mergeCategories(payload.categories || [], outfits);
    const catalog = { outfits, categories };
    setCachedOutfitCatalog(catalog);
    return catalog;
  } catch {
    return getCachedOutfitCatalog();
  }
};

export const saveOutfitCatalog = async (
  outfits: OutfitItem[],
  categories: OutfitCategory[]
): Promise<boolean> => {
  const normalizedCategories = mergeCategories(categories, outfits);
  try {
    const response = await fetch('http://localhost:3002/api/outfits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outfits, categories: normalizedCategories }),
    });
    if (!response.ok) throw new Error('failed');
    setCachedOutfitCatalog({ outfits, categories: normalizedCategories });
    return true;
  } catch {
    setCachedOutfitCatalog({ outfits, categories: normalizedCategories });
    return false;
  }
};

export const buildOutfitPool = (baseOutfits: OutfitPoolItem[]): OutfitPoolItem[] => {
  const { outfits, categories } = getCachedOutfitCatalog();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const savedPool: OutfitPoolItem[] = outfits.map((outfit) => {
    const category = categoryMap.get(outfit.category);
    const gender = category?.gender || 'female';
    const tags = [outfit.category].filter(Boolean);

    if (gender === 'male') tags.push('MALE');
    if (gender === 'unisex') tags.push('UNISEX');

    return {
      id: outfit.id,
      name: outfit.prompt || outfit.name,
      translation: outfit.name,
      categories: tags,
      prompt: outfit.prompt,
    };
  });

  const deduped = new Map<string, OutfitPoolItem>();
  [...baseOutfits, ...savedPool].forEach((item) => {
    if (!item || !item.name) return;
    if (!deduped.has(item.name)) {
      deduped.set(item.name, item);
    }
  });

  return Array.from(deduped.values());
};

export const saveOutfitPreviewImage = async (
  imageData: string,
  outfitId: string,
  prompt?: string
): Promise<string | null> => {
  try {
    const response = await fetch('http://localhost:3002/api/save-outfit-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData, outfitId, prompt }),
    });
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { url?: string };
    return payload.url || null;
  } catch {
    return null;
  }
};

export const fetchOutfitPreviewMap = async (): Promise<Record<string, string>> => {
  try {
    const response = await fetch('http://localhost:3002/api/outfit-preview-map');
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { previews?: Record<string, string> };
    return payload.previews || {};
  } catch {
    return {};
  }
};

export const saveOutfitPreviewMap = async (previews: Record<string, string>): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3002/api/outfit-preview-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previews }),
    });
    if (!response.ok) throw new Error('failed');
    return true;
  } catch {
    return false;
  }
};

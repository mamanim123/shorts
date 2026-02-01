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
  hidden?: boolean;
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
const BASE_OVERRIDE_CACHE_KEY = 'outfit-base-overrides-v1';

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

export interface OutfitBaseOverrides {
  hiddenBaseIds: string[];
  categoryOverrides: Record<string, string>;
}

const defaultBaseOverrides: OutfitBaseOverrides = {
  hiddenBaseIds: [],
  categoryOverrides: {}
};

export const getOutfitBaseOverrides = (): OutfitBaseOverrides =>
  getStorageValue<OutfitBaseOverrides>(BASE_OVERRIDE_CACHE_KEY, defaultBaseOverrides);

export const setOutfitBaseOverrides = (overrides: OutfitBaseOverrides) => {
  setAppStorageValue(BASE_OVERRIDE_CACHE_KEY, overrides);
};

const buildOverriddenCategories = (categories: string[], overrideCategory?: string): string[] => {
  if (!overrideCategory) return categories;
  const genderTags = categories.filter((category) => category === 'MALE' || category === 'UNISEX');
  const rest = categories.filter((category) => category !== 'MALE' && category !== 'UNISEX' && category !== overrideCategory);
  return [overrideCategory, ...genderTags, ...rest];
};

export const applyBaseOverrides = (
  baseOutfits: OutfitPoolItem[],
  overrides: OutfitBaseOverrides,
  options: { includeHidden?: boolean } = {}
): OutfitPoolItem[] => {
  const hidden = new Set(overrides.hiddenBaseIds || []);
  return baseOutfits
    .filter((item) => (options.includeHidden ? true : !hidden.has(item.id)))
    .map((item) => {
      const overrideCategory = overrides.categoryOverrides?.[item.id];
      const nextCategories = buildOverriddenCategories(item.categories || [], overrideCategory);
      return { ...item, categories: nextCategories };
    });
};

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
  const overrides = getOutfitBaseOverrides();
  const normalizedBaseOutfits = applyBaseOverrides(baseOutfits, overrides);
  const { outfits, categories } = getCachedOutfitCatalog();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const savedPool: OutfitPoolItem[] = outfits
    .filter((outfit) => !outfit.hidden)
    .map((outfit) => {
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
  [...normalizedBaseOutfits, ...savedPool].forEach((item) => {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const fetchOutfitPreviewMap = async (
  retries: number = 3,
  delayMs: number = 800
): Promise<Record<string, string>> => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch('http://localhost:3002/api/outfit-preview-map');
      if (!response.ok) throw new Error('failed');
      const payload = (await response.json()) as { previews?: Record<string, string> };
      return payload.previews || {};
    } catch {
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1));
      }
    }
  }
  return {};
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

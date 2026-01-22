export interface CharacterItem {
  id: string;
  name: string;
  age: string;
  gender: 'female' | 'male';
  face: string;
  hair: string;
  body: string;
  createdAt: string;
}

const CHARACTER_CACHE_KEY = 'character-catalog-cache-v1';

const getLocalStorageValue = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const setLocalStorageValue = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache failures.
  }
};

export const getCachedCharacters = (): CharacterItem[] =>
  getLocalStorageValue<CharacterItem[]>(CHARACTER_CACHE_KEY, []);

export const setCachedCharacters = (characters: CharacterItem[]) => {
  setLocalStorageValue(CHARACTER_CACHE_KEY, characters || []);
};

export const fetchCharacters = async (): Promise<CharacterItem[]> => {
  try {
    const response = await fetch('http://localhost:3002/api/characters');
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { characters?: CharacterItem[] };
    const characters = Array.isArray(payload.characters) ? payload.characters : [];
    setCachedCharacters(characters);
    return characters;
  } catch {
    return getCachedCharacters();
  }
};

export const saveCharacters = async (characters: CharacterItem[]): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3002/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters }),
    });
    if (!response.ok) throw new Error('failed');
    setCachedCharacters(characters);
    return true;
  } catch {
    setCachedCharacters(characters);
    return false;
  }
};

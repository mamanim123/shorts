import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from './appStorageService';
import type {
  CharacterCollection,
  CharacterIdentitySpec,
  CharacterReferencePreference,
  CharacterWardrobeProfile
} from '../types';

export interface CharacterItem {
  id: string;
  name: string;
  age: string;
  gender: 'female' | 'male';
  face: string;
  hair: string;
  body: string;
  style: string;
  bodyTuning?: {
    overall: number;
    shoulderWidth: number;
    legLength: number;
    bustFront: number;
    bustHeight: number;
    pelvisWidth: number;
    buttProjection: number;
    buttLift: number;
  };
  createdAt: string;
  generatedImageId?: string;
  turnaroundImageIds?: {
    front: string;
    angle45: string;
    back: string;
  };
  sourceReferenceImageId?: string;
  sourceType?: 'catalog' | 'ai-studio';
  identitySpec?: CharacterIdentitySpec;
  referencePreference?: CharacterReferencePreference;
  wardrobeProfile?: CharacterWardrobeProfile;
}

// 기존 데이터 호환성: style 필드가 없는 경우 빈 문자열로 처리
const normalizeCharacter = (character: Partial<CharacterItem> & { id: string }): CharacterItem => ({
  id: character.id,
  name: character.name || '',
  age: character.age || '',
  gender: character.gender || 'female',
  face: character.face || '',
  hair: character.hair || '',
  body: character.body || '',
  style: character.style || '',
  bodyTuning: character.bodyTuning,
  createdAt: character.createdAt || new Date().toISOString(),
  generatedImageId: character.generatedImageId,
  turnaroundImageIds: character.turnaroundImageIds,
  sourceReferenceImageId: character.sourceReferenceImageId,
  sourceType: character.sourceType || 'catalog',
  identitySpec: character.identitySpec,
  referencePreference: character.referencePreference,
  wardrobeProfile: character.wardrobeProfile,
});

const normalizeCharacters = (characters: Array<Partial<CharacterItem> & { id: string }>): CharacterItem[] =>
  characters.map(normalizeCharacter);

const CHARACTER_CACHE_KEY = 'character-catalog-cache-v2';

primeAppStorageCache();

const getStorageValue = <T,>(key: string, fallback: T): T => {
  // [FORCE_UPDATE] 이전 버전의 오염된 데이터 강제 무시
  if (key === 'characterCollection') {
    const val = getAppStorageCachedValue<any>(key, null);
    if (val && JSON.stringify(val).includes('red one-shoulder')) {
      console.log('Detected corrupted character data, clearing cache...');
      return fallback;
    }
  }
  return getAppStorageCachedValue<T>(key, fallback);
};

export const getCachedCharacters = (): CharacterItem[] => {
  const cached = getStorageValue<Array<Partial<CharacterItem> & { id: string }>>(CHARACTER_CACHE_KEY, []);
  return normalizeCharacters(cached);
};

export const setCachedCharacters = (characters: CharacterItem[]) => {
  setAppStorageValue(CHARACTER_CACHE_KEY, characters || []);
};

export const fetchCharacters = async (): Promise<CharacterItem[]> => {
  const aiStudioCharacters = getStorageValue<CharacterCollection[]>('characterCollection', []);
  const normalizedAiStudioCharacters: CharacterItem[] = aiStudioCharacters.map((char) => ({
    id: `aistudio-${char.id}`,
    name: char.name || '',
    age: char.age || '30대',
    gender: char.gender || 'female',
    face: char.face || char.description || 'AI Studio character',
    hair: char.hair || '',
    body: char.body || '',
    style: char.style || char.description || '',
    bodyTuning: char.bodyTuning,
    createdAt: char.approvedAt ? new Date(char.approvedAt).toISOString() : new Date().toISOString(),
    generatedImageId: char.turnaroundImageIds?.front || char.generatedImageId,
    turnaroundImageIds: char.turnaroundImageIds,
    sourceReferenceImageId: char.sourceReferenceImageId,
    sourceType: 'ai-studio',
    identitySpec: char.identitySpec,
    referencePreference: char.referencePreference,
    wardrobeProfile: char.wardrobeProfile,
  }));

  try {
    const response = await fetch('http://localhost:3002/api/characters');
    if (!response.ok) throw new Error('failed');
    const payload = (await response.json()) as { characters?: Array<Partial<CharacterItem> & { id: string }> };
    const rawCharacters = Array.isArray(payload.characters) ? payload.characters : [];
    const characters = [...normalizedAiStudioCharacters, ...normalizeCharacters(rawCharacters)];
    setCachedCharacters(characters);
    return characters;
  } catch {
    const cached = getCachedCharacters();
    const merged = [...normalizedAiStudioCharacters, ...cached.filter(char => char.sourceType !== 'ai-studio')];
    return merged;
  }
};

export const saveCharacters = async (characters: CharacterItem[]): Promise<boolean> => {
  const aiStudioCharacters = characters.filter((character) => character.sourceType === 'ai-studio');
  const serverCharacters = characters.filter((character) => character.sourceType !== 'ai-studio');

  const existingAiStudioCollections = getStorageValue<CharacterCollection[]>('characterCollection', []);
  
  // [FIX] 유지해야 할 aistudio 캐릭터의 id 맵 생성 (접두사 제외)
  const validAiStudioIds = new Set(
    aiStudioCharacters.map(c => c.id.replace(/^aistudio-/, ''))
  );

  // [FIX] 기존 컬렉션 중 지워진 항목을 필터링하고 업데이트
  const updatedAiStudioCollections = existingAiStudioCollections
    .filter(collection => validAiStudioIds.has(collection.id))
    .map(collection => {
      const updateChar = aiStudioCharacters.find(c => c.id.replace(/^aistudio-/, '') === collection.id);
      if (!updateChar) return collection;
      return {
        ...collection,
        name: updateChar.name,
        description: updateChar.style || updateChar.face || collection.description,
        age: updateChar.age,
        gender: updateChar.gender,
        face: updateChar.face,
        hair: updateChar.hair,
        body: updateChar.body,
        style: updateChar.style,
        bodyTuning: updateChar.bodyTuning,
        identitySpec: updateChar.identitySpec,
        referencePreference: updateChar.referencePreference,
        wardrobeProfile: updateChar.wardrobeProfile,
      };
    });

  await setAppStorageValue('characterCollection', updatedAiStudioCollections);

  try {
    const response = await fetch('http://localhost:3002/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters: serverCharacters }),
    });
    if (!response.ok) throw new Error('failed');
    setCachedCharacters(characters);
    return true;
  } catch {
    setCachedCharacters(characters);
    return false;
  }
};

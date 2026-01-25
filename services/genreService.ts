import { OutfitStyle } from '../types';
import { getAppStorageCachedValue, primeAppStorageCache, removeAppStorageValue, setAppStorageValue } from './appStorageService';

export interface Genre {
    id: string;
    name: string;
    description?: string;
    isCustom: boolean;
}

const STORAGE_KEY = 'shorts-generator-genres';
const DELETED_DEFAULTS_KEY = 'deleted-default-genres';

primeAppStorageCache();

// 기본 장르 목록 (기존 OutfitStyle enum 기반)
const DEFAULT_GENRES: Genre[] = [
    { id: 'NONE', name: '0. 선택안함', isCustom: false },
    { id: 'MODERN_CHIC', name: '1. 모던 시크 (Modern Chic)', isCustom: false },
    { id: 'GLAMOUR_PARTY', name: '2. 글래머 & 파티 (Glamour & Party)', isCustom: false },
    { id: 'ACTIVITY_LUXURY', name: '3. 액티비티 & 럭셔리 (Activity & Luxury)', isCustom: false },
    { id: 'SECRET_ROMANCE', name: '4. 시크릿 로맨스 (Middle-aged Affair/Romance)', isCustom: false }
];

// 삭제된 기본 장르 ID 목록 가져오기
const getDeletedDefaultIds = (): string[] => {
    const stored = getAppStorageCachedValue<string[] | null>(DELETED_DEFAULTS_KEY, null);
    return stored && Array.isArray(stored) ? stored : [];
};

export const genreService = {
    // 모든 장르 가져오기 (삭제된 기본 장르 제외)
    getGenres: (): Genre[] => {
        try {
            const deletedIds = getDeletedDefaultIds();
            const activeDefaults = DEFAULT_GENRES.filter(g => !deletedIds.includes(g.id));

            const customGenres = getAppStorageCachedValue<Genre[] | null>(STORAGE_KEY, null);
            if (customGenres && Array.isArray(customGenres)) {
                return [...activeDefaults, ...customGenres];
            }
            return activeDefaults;
        } catch (e) {
            console.error('Failed to load genres', e);
            return DEFAULT_GENRES;
        }
    },

    // 사용자 장르 추가
    addGenre: (name: string): Genre[] => {
        const genres = genreService.getCustomGenres();
        const newGenre: Genre = {
            id: `CUSTOM_${Date.now()}`,
            name,
            isCustom: true
        };
        const updated = [...genres, newGenre];
        setAppStorageValue(STORAGE_KEY, updated);
        return genreService.getGenres();
    },

    // 장르 삭제 (기본 장르 포함)
    deleteGenre: (id: string): Genre[] => {
        // 기본 장르인지 확인
        const isDefaultGenre = DEFAULT_GENRES.some(g => g.id === id);

        if (isDefaultGenre) {
            // 기본 장르는 "삭제됨" 목록에 추가
            const deletedIds = getDeletedDefaultIds();
            if (!deletedIds.includes(id)) {
                deletedIds.push(id);
                setAppStorageValue(DELETED_DEFAULTS_KEY, deletedIds);
            }
        } else {
            // 커스텀 장르는 목록에서 제거
            const genres = genreService.getCustomGenres();
            const updated = genres.filter(g => g.id !== id);
            setAppStorageValue(STORAGE_KEY, updated);
        }

        return genreService.getGenres();
    },

    // 사용자 장르만 가져오기 (내부용)
    getCustomGenres: (): Genre[] => {
        try {
            const stored = getAppStorageCachedValue<Genre[] | null>(STORAGE_KEY, null);
            return stored && Array.isArray(stored) ? stored : [];
        } catch (e) {
            return [];
        }
    },

    // 초기화 (모든 커스텀 장르 삭제 + 삭제된 기본 장르 복원)
    reset: () => {
        removeAppStorageValue(STORAGE_KEY);
        removeAppStorageValue(DELETED_DEFAULTS_KEY);
        return DEFAULT_GENRES;
    }
};

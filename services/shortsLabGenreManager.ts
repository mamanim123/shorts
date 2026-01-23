import { LAB_GENRE_GUIDELINES, LabGenreGuideline, LabGenreGuidelineEntry } from './labPromptBuilder';

const STORAGE_KEY = 'shorts-lab-genre-guidelines';

const buildDefaultGenres = (): LabGenreGuidelineEntry[] =>
  Object.entries(LAB_GENRE_GUIDELINES).map(([id, guide]) => ({ id, ...guide }));

let cachedGenres: LabGenreGuidelineEntry[] | null = null;
type GenreListener = (genres: LabGenreGuidelineEntry[]) => void;
const listeners = new Set<GenreListener>();

const notifyListeners = (genres: LabGenreGuidelineEntry[]) => {
  listeners.forEach((listener) => listener(genres));
};

const normalizeGenre = (genre: Partial<LabGenreGuidelineEntry> & { id: string }): LabGenreGuidelineEntry => ({
  id: genre.id,
  name: genre.name?.trim() || '이름 없는 장르',
  description: genre.description?.trim() || '',
  emotionCurve: genre.emotionCurve?.trim() || '',
  structure: genre.structure?.trim() || '',
  killerPhrases: Array.isArray(genre.killerPhrases) ? genre.killerPhrases.filter(Boolean) : [],
  supportingCharacterPhrasePatterns: Array.isArray(genre.supportingCharacterPhrasePatterns)
    ? genre.supportingCharacterPhrasePatterns.filter(Boolean)
    : undefined,
  bodyReactions: Array.isArray(genre.bodyReactions) ? genre.bodyReactions.filter(Boolean) : [],
  forbiddenPatterns: Array.isArray(genre.forbiddenPatterns) ? genre.forbiddenPatterns.filter(Boolean) : [],
  goodTwistExamples: Array.isArray(genre.goodTwistExamples) ? genre.goodTwistExamples.filter(Boolean) : [],
  supportingCharacterTwistPatterns: Array.isArray(genre.supportingCharacterTwistPatterns)
    ? genre.supportingCharacterTwistPatterns.filter(Boolean)
    : undefined,
  badTwistExamples: Array.isArray(genre.badTwistExamples) ? genre.badTwistExamples.filter(Boolean) : [],
});

const readStoredGenres = (): LabGenreGuidelineEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeGenre(item));
  } catch (error) {
    console.warn('[shortsLabGenreManager] Failed to read genres:', error);
    return [];
  }
};

const writeStoredGenres = (genres: LabGenreGuidelineEntry[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(genres));
  } catch (error) {
    console.warn('[shortsLabGenreManager] Failed to save genres:', error);
  }
};

export const shortsLabGenreManager = {
  getGenres: (): LabGenreGuidelineEntry[] => {
    if (cachedGenres) return cachedGenres;
    cachedGenres = buildDefaultGenres();
    return cachedGenres;
  },

  subscribe: (listener: GenreListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  loadGenres: async (): Promise<LabGenreGuidelineEntry[]> => {
    const stored = readStoredGenres();
    cachedGenres = stored.length > 0 ? stored : buildDefaultGenres();
    if (stored.length === 0) {
      writeStoredGenres(cachedGenres);
    }
    notifyListeners(cachedGenres);
    return cachedGenres;
  },

  addGenre: async (genre: LabGenreGuidelineEntry): Promise<LabGenreGuidelineEntry[]> => {
    const current = cachedGenres || buildDefaultGenres();
    const normalized = normalizeGenre(genre);
    const updated = [...current, normalized];
    cachedGenres = updated;
    writeStoredGenres(updated);
    notifyListeners(updated);
    return updated;
  },

  updateGenre: async (id: string, updates: Partial<LabGenreGuideline>): Promise<LabGenreGuidelineEntry[]> => {
    const current = cachedGenres || buildDefaultGenres();
    const updated = current.map((genre) => {
      if (genre.id !== id) return genre;
      return normalizeGenre({ ...genre, ...updates, id });
    });
    cachedGenres = updated;
    writeStoredGenres(updated);
    notifyListeners(updated);
    return updated;
  },

  deleteGenre: async (id: string): Promise<LabGenreGuidelineEntry[]> => {
    const current = cachedGenres || buildDefaultGenres();
    const updated = current.filter((genre) => genre.id !== id);
    cachedGenres = updated;
    writeStoredGenres(updated);
    notifyListeners(updated);
    return updated;
  },

  reset: async (): Promise<LabGenreGuidelineEntry[]> => {
    cachedGenres = buildDefaultGenres();
    writeStoredGenres(cachedGenres);
    notifyListeners(cachedGenres);
    return cachedGenres;
  }
};

export const getShortsLabGenreOptions = (): Array<{ value: string; label: string; description: string }> =>
  shortsLabGenreManager.getGenres().map((genre) => ({
    value: genre.id,
    label: genre.name,
    description: genre.description
  }));

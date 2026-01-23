import { LAB_GENRE_GUIDELINES, LabGenreGuideline, LabGenreGuidelineEntry } from './labPromptBuilder';

const STORAGE_KEY = 'shorts-lab-genre-guidelines';
const BACKUP_STORAGE_KEY = 'shorts-lab-genre-guidelines-backups';
const MAX_BACKUPS = 5;

const buildDefaultGenres = (): LabGenreGuidelineEntry[] =>
  Object.entries(LAB_GENRE_GUIDELINES).map(([id, guide]) => ({ id, ...guide }));

let cachedGenres: LabGenreGuidelineEntry[] | null = null;
type GenreListener = (genres: LabGenreGuidelineEntry[]) => void;
const listeners = new Set<GenreListener>();

const notifyListeners = (genres: LabGenreGuidelineEntry[]) => {
  listeners.forEach((listener) => listener(genres));
};

export interface LabGenreBackup {
  id: string;
  name: string;
  createdAt: string;
  genres: LabGenreGuidelineEntry[];
}

let cachedBackups: LabGenreBackup[] | null = null;
type BackupListener = (backups: LabGenreBackup[]) => void;
const backupListeners = new Set<BackupListener>();

const notifyBackupListeners = (backups: LabGenreBackup[]) => {
  backupListeners.forEach((listener) => listener(backups));
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

const normalizeGenreWithFallback = (genre: Partial<LabGenreGuidelineEntry>, index: number): LabGenreGuidelineEntry => {
  const fallbackId = `restored-${Date.now()}-${index}`;
  const id = (genre.id && String(genre.id).trim()) || fallbackId;
  return normalizeGenre({ ...genre, id });
};

const normalizeBackup = (backup: Partial<LabGenreBackup> & { id: string }): LabGenreBackup => ({
  id: backup.id,
  name: backup.name?.trim() || '이름 없는 백업',
  createdAt: backup.createdAt || new Date().toISOString(),
  genres: Array.isArray(backup.genres) ? backup.genres.map((item) => normalizeGenre(item)) : [],
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

const readStoredBackups = (): LabGenreBackup[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeBackup(item));
  } catch (error) {
    console.warn('[shortsLabGenreManager] Failed to read backups:', error);
    return [];
  }
};

const writeStoredBackups = (backups: LabGenreBackup[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups));
  } catch (error) {
    console.warn('[shortsLabGenreManager] Failed to save backups:', error);
  }
};

const formatBackupName = (input?: string) => {
  if (input && input.trim()) return input.trim();
  const now = new Date();
  const date = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `백업 ${date} ${time}`;
};

export const shortsLabGenreManager = {
  getGenres: (): LabGenreGuidelineEntry[] => {
    if (cachedGenres) return cachedGenres;
    cachedGenres = buildDefaultGenres();
    return cachedGenres;
  },
  getBackups: (): LabGenreBackup[] => {
    if (cachedBackups) return cachedBackups;
    cachedBackups = readStoredBackups();
    return cachedBackups;
  },

  subscribe: (listener: GenreListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  subscribeBackups: (listener: BackupListener) => {
    backupListeners.add(listener);
    return () => {
      backupListeners.delete(listener);
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
  loadBackups: async (): Promise<LabGenreBackup[]> => {
    cachedBackups = readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
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
  },
  createBackup: async (name?: string): Promise<LabGenreBackup[]> => {
    const currentGenres = cachedGenres || buildDefaultGenres();
    const backups = cachedBackups || readStoredBackups();
    const newBackup: LabGenreBackup = normalizeBackup({
      id: `backup-${Date.now()}`,
      name: formatBackupName(name),
      createdAt: new Date().toISOString(),
      genres: currentGenres.map((genre) => normalizeGenre(genre)),
    });
    const updated = [newBackup, ...backups];
    const limited = updated.slice(0, MAX_BACKUPS);
    cachedBackups = limited;
    writeStoredBackups(limited);
    notifyBackupListeners(limited);
    return limited;
  },
  restoreBackup: async (id: string): Promise<LabGenreGuidelineEntry[]> => {
    const backups = cachedBackups || readStoredBackups();
    const target = backups.find((backup) => backup.id === id);
    if (!target) {
      throw new Error('백업을 찾을 수 없습니다.');
    }
    cachedGenres = target.genres.map((genre) => normalizeGenre(genre));
    writeStoredGenres(cachedGenres);
    notifyListeners(cachedGenres);
    return cachedGenres;
  },
  deleteBackup: async (id: string): Promise<LabGenreBackup[]> => {
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.filter((backup) => backup.id !== id);
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  renameBackup: async (id: string, name: string): Promise<LabGenreBackup[]> => {
    const backups = cachedBackups || readStoredBackups();
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('백업 이름을 입력해주세요.');
    }
    const updated = backups.map((backup) => {
      if (backup.id !== id) return backup;
      return normalizeBackup({ ...backup, name: trimmedName, id: backup.id });
    });
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  updateBackupContent: async (id: string, genresInput: unknown): Promise<LabGenreBackup[]> => {
    if (!Array.isArray(genresInput)) {
      throw new Error('백업 데이터는 배열 형태여야 합니다.');
    }
    const normalizedGenres = genresInput.map((item, index) =>
      normalizeGenreWithFallback(item || {}, index)
    );
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.map((backup) => {
      if (backup.id !== id) return backup;
      return normalizeBackup({
        ...backup,
        genres: normalizedGenres,
        id: backup.id,
      });
    });
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  }
};

export const getShortsLabGenreOptions = (): Array<{ value: string; label: string; description: string }> =>
  shortsLabGenreManager.getGenres().map((genre) => ({
    value: genre.id,
    label: genre.name,
    description: genre.description
  }));

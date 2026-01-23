import { useCallback, useEffect, useState } from 'react';
import { shortsLabGenreManager } from '../services/shortsLabGenreManager';
import type { LabGenreGuidelineEntry, LabGenreGuideline } from '../services/labPromptBuilder';
import type { LabGenreBackup } from '../services/shortsLabGenreManager';

export const useShortsLabGenreManager = () => {
  const [genres, setGenres] = useState<LabGenreGuidelineEntry[]>(() => shortsLabGenreManager.getGenres());
  const [backups, setBackups] = useState<LabGenreBackup[]>(() => shortsLabGenreManager.getBackups());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await shortsLabGenreManager.loadGenres();
      setGenres(loaded);
      const loadedBackups = await shortsLabGenreManager.loadBackups();
      setBackups(loadedBackups);
      setError(null);
    } catch (err) {
      console.error('[useShortsLabGenreManager] Failed to load genres', err);
      setError('장르 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = shortsLabGenreManager.subscribe(setGenres);
    const unsubscribeBackups = shortsLabGenreManager.subscribeBackups(setBackups);
    refresh();
    return () => {
      unsubscribe();
      unsubscribeBackups();
    };
  }, [refresh]);

  const addGenre = useCallback(async (genre: LabGenreGuidelineEntry) => {
    setError(null);
    return shortsLabGenreManager.addGenre(genre);
  }, []);

  const updateGenre = useCallback(async (id: string, updates: Partial<LabGenreGuideline>) => {
    setError(null);
    return shortsLabGenreManager.updateGenre(id, updates);
  }, []);

  const deleteGenre = useCallback(async (id: string) => {
    setError(null);
    return shortsLabGenreManager.deleteGenre(id);
  }, []);

  const reset = useCallback(async () => {
    setError(null);
    return shortsLabGenreManager.reset();
  }, []);

  const createBackup = useCallback(async (name?: string) => {
    setError(null);
    return shortsLabGenreManager.createBackup(name);
  }, []);

  const restoreBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabGenreManager.restoreBackup(id);
  }, []);

  const deleteBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabGenreManager.deleteBackup(id);
  }, []);

  const renameBackup = useCallback(async (id: string, name: string) => {
    setError(null);
    return shortsLabGenreManager.renameBackup(id, name);
  }, []);

  const updateBackupContent = useCallback(async (id: string, genresInput: unknown) => {
    setError(null);
    return shortsLabGenreManager.updateBackupContent(id, genresInput);
  }, []);

  return {
    genres,
    backups,
    loading,
    error,
    refresh,
    addGenre,
    updateGenre,
    deleteGenre,
    reset,
    createBackup,
    restoreBackup,
    deleteBackup,
    renameBackup,
    updateBackupContent
  };
};

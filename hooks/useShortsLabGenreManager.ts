import { useCallback, useEffect, useState } from 'react';
import { shortsLabGenreManager } from '../services/shortsLabGenreManager';
import type { LabGenreGuidelineEntry, LabGenreGuideline } from '../services/labPromptBuilder';

export const useShortsLabGenreManager = () => {
  const [genres, setGenres] = useState<LabGenreGuidelineEntry[]>(() => shortsLabGenreManager.getGenres());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await shortsLabGenreManager.loadGenres();
      setGenres(loaded);
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
    refresh();
    return () => unsubscribe();
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

  return {
    genres,
    loading,
    error,
    refresh,
    addGenre,
    updateGenre,
    deleteGenre,
    reset
  };
};

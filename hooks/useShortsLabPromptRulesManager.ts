import { useCallback, useEffect, useState } from 'react';
import {
  shortsLabPromptRulesManager,
  ShortsLabPromptRulesBackup
} from '../services/shortsLabPromptRulesManager';
import type { ShortsLabPromptRules } from '../services/shortsLabPromptRulesDefaults';

export const useShortsLabPromptRulesManager = () => {
  const [rules, setRules] = useState<ShortsLabPromptRules>(() => shortsLabPromptRulesManager.getRules());
  const [backups, setBackups] = useState<ShortsLabPromptRulesBackup[]>(() => shortsLabPromptRulesManager.getBackups());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const loadedRules = await shortsLabPromptRulesManager.loadRules();
      setRules(loadedRules);
      const loadedBackups = await shortsLabPromptRulesManager.loadBackups();
      setBackups(loadedBackups);
      setError(null);
    } catch (err) {
      console.error('[useShortsLabPromptRulesManager] Failed to load rules', err);
      setError('프롬프트 규칙을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribeRules = shortsLabPromptRulesManager.subscribeRules(setRules);
    const unsubscribeBackups = shortsLabPromptRulesManager.subscribeBackups(setBackups);
    refresh();
    return () => {
      unsubscribeRules();
      unsubscribeBackups();
    };
  }, [refresh]);

  const updateRules = useCallback(async (rulesInput: unknown) => {
    setError(null);
    return shortsLabPromptRulesManager.updateRules(rulesInput);
  }, []);

  const resetRules = useCallback(async () => {
    setError(null);
    return shortsLabPromptRulesManager.resetRules();
  }, []);

  const createBackup = useCallback(async (name?: string) => {
    setError(null);
    return shortsLabPromptRulesManager.createBackup(name);
  }, []);

  const restoreBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabPromptRulesManager.restoreBackup(id);
  }, []);

  const deleteBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabPromptRulesManager.deleteBackup(id);
  }, []);

  const renameBackup = useCallback(async (id: string, name: string) => {
    setError(null);
    return shortsLabPromptRulesManager.renameBackup(id, name);
  }, []);

  const updateBackupContent = useCallback(async (id: string, rulesInput: unknown) => {
    setError(null);
    return shortsLabPromptRulesManager.updateBackupContent(id, rulesInput);
  }, []);

  return {
    rules,
    backups,
    loading,
    error,
    refresh,
    updateRules,
    resetRules,
    createBackup,
    restoreBackup,
    deleteBackup,
    renameBackup,
    updateBackupContent
  };
};

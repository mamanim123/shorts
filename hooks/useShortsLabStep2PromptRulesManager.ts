import { useCallback, useEffect, useState } from 'react';
import {
  shortsLabStep2PromptRulesManager,
  ShortsLabStep2PromptRulesBackup
} from '../services/shortsLabStep2PromptRulesManager';
import type { ShortsLabStep2PromptRules } from '../services/shortsLabStep2PromptRulesDefaults';

export const useShortsLabStep2PromptRulesManager = () => {
  const [rules, setRules] = useState<ShortsLabStep2PromptRules>(() =>
    shortsLabStep2PromptRulesManager.getRules()
  );
  const [backups, setBackups] = useState<ShortsLabStep2PromptRulesBackup[]>(() =>
    shortsLabStep2PromptRulesManager.getBackups()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const loadedRules = await shortsLabStep2PromptRulesManager.loadRules();
      setRules(loadedRules);
      const loadedBackups = await shortsLabStep2PromptRulesManager.loadBackups();
      setBackups(loadedBackups);
      setError(null);
    } catch (err) {
      console.error('[useShortsLabStep2PromptRulesManager] Failed to load rules', err);
      setError('2단계 규칙을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribeRules = shortsLabStep2PromptRulesManager.subscribeRules(setRules);
    const unsubscribeBackups = shortsLabStep2PromptRulesManager.subscribeBackups(setBackups);
    refresh();
    return () => {
      unsubscribeRules();
      unsubscribeBackups();
    };
  }, [refresh]);

  const updateRules = useCallback(async (rulesInput: unknown) => {
    setError(null);
    return shortsLabStep2PromptRulesManager.updateRules(rulesInput);
  }, []);

  const resetRules = useCallback(async () => {
    setError(null);
    return shortsLabStep2PromptRulesManager.resetRules();
  }, []);

  const createBackup = useCallback(async (name?: string) => {
    setError(null);
    return shortsLabStep2PromptRulesManager.createBackup(name);
  }, []);

  const restoreBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabStep2PromptRulesManager.restoreBackup(id);
  }, []);

  const deleteBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabStep2PromptRulesManager.deleteBackup(id);
  }, []);

  const renameBackup = useCallback(async (id: string, name: string) => {
    setError(null);
    return shortsLabStep2PromptRulesManager.renameBackup(id, name);
  }, []);

  const updateBackupContent = useCallback(async (id: string, rulesInput: unknown) => {
    setError(null);
    return shortsLabStep2PromptRulesManager.updateBackupContent(id, rulesInput);
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

import { useCallback, useEffect, useState } from 'react';
import {
  shortsLabScriptRulesManager,
  ShortsLabScriptRulesBackup
} from '../services/shortsLabScriptRulesManager';
import type { ShortsLabScriptRules } from '../services/shortsLabScriptRulesDefaults';

export const useShortsLabScriptRulesManager = () => {
  const [rules, setRules] = useState<ShortsLabScriptRules>(() =>
    shortsLabScriptRulesManager.getRules()
  );
  const [backups, setBackups] = useState<ShortsLabScriptRulesBackup[]>(() =>
    shortsLabScriptRulesManager.getBackups()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const loadedRules = await shortsLabScriptRulesManager.loadRules();
      setRules(loadedRules);
      const loadedBackups = await shortsLabScriptRulesManager.loadBackups();
      setBackups(loadedBackups);
      setError(null);
    } catch (err) {
      console.error('[useShortsLabScriptRulesManager] Failed to load rules', err);
      setError('대본 규칙을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribeRules = shortsLabScriptRulesManager.subscribeRules(setRules);
    const unsubscribeBackups = shortsLabScriptRulesManager.subscribeBackups(setBackups);
    refresh();
    return () => {
      unsubscribeRules();
      unsubscribeBackups();
    };
  }, [refresh]);

  const updateRules = useCallback(async (rulesInput: unknown) => {
    setError(null);
    return shortsLabScriptRulesManager.updateRules(rulesInput);
  }, []);

  const resetRules = useCallback(async () => {
    setError(null);
    return shortsLabScriptRulesManager.resetRules();
  }, []);

  const createBackup = useCallback(async (name?: string) => {
    setError(null);
    return shortsLabScriptRulesManager.createBackup(name);
  }, []);

  const restoreBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabScriptRulesManager.restoreBackup(id);
  }, []);

  const deleteBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabScriptRulesManager.deleteBackup(id);
  }, []);

  const renameBackup = useCallback(async (id: string, name: string) => {
    setError(null);
    return shortsLabScriptRulesManager.renameBackup(id, name);
  }, []);

  const updateBackupContent = useCallback(async (id: string, rulesInput: unknown) => {
    setError(null);
    return shortsLabScriptRulesManager.updateBackupContent(id, rulesInput);
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

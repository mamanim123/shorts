/**
 * useShortsLabCharacterRulesManager.ts
 * 캐릭터 의상 규칙 React 훅
 *
 * v2.0 업데이트:
 * - 캐릭터 추가/삭제 함수 추가
 */

import { useCallback, useEffect, useState } from 'react';
import {
  shortsLabCharacterRulesManager,
  ShortsLabCharacterRulesBackup
} from '../services/shortsLabCharacterRulesManager';
import type { ShortsLabCharacterRules, CharacterSlotRule } from '../services/shortsLabCharacterRulesDefaults';

export const useShortsLabCharacterRulesManager = () => {
  const [rules, setRules] = useState<ShortsLabCharacterRules>(() =>
    shortsLabCharacterRulesManager.getRules()
  );
  const [backups, setBackups] = useState<ShortsLabCharacterRulesBackup[]>(() =>
    shortsLabCharacterRulesManager.getBackups()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const loadedRules = await shortsLabCharacterRulesManager.loadRules();
      setRules(loadedRules);
      const loadedBackups = await shortsLabCharacterRulesManager.loadBackups();
      setBackups(loadedBackups);
      setError(null);
    } catch (err) {
      console.error('[useShortsLabCharacterRulesManager] Failed to load rules', err);
      setError('의상 규칙을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribeRules = shortsLabCharacterRulesManager.subscribeRules(setRules);
    const unsubscribeBackups = shortsLabCharacterRulesManager.subscribeBackups(setBackups);
    refresh();
    return () => {
      unsubscribeRules();
      unsubscribeBackups();
    };
  }, [refresh]);

  const updateRules = useCallback(async (rulesInput: unknown) => {
    setError(null);
    return shortsLabCharacterRulesManager.updateRules(rulesInput);
  }, []);

  const resetRules = useCallback(async () => {
    setError(null);
    return shortsLabCharacterRulesManager.resetRules();
  }, []);

  const createBackup = useCallback(async (name?: string) => {
    setError(null);
    return shortsLabCharacterRulesManager.createBackup(name);
  }, []);

  const restoreBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabCharacterRulesManager.restoreBackup(id);
  }, []);

  const deleteBackup = useCallback(async (id: string) => {
    setError(null);
    return shortsLabCharacterRulesManager.deleteBackup(id);
  }, []);

  const renameBackup = useCallback(async (id: string, name: string) => {
    setError(null);
    return shortsLabCharacterRulesManager.renameBackup(id, name);
  }, []);

  const updateBackupContent = useCallback(async (id: string, rulesInput: unknown) => {
    setError(null);
    return shortsLabCharacterRulesManager.updateBackupContent(id, rulesInput);
  }, []);

  // ===== 캐릭터 CRUD =====
  const addFemaleCharacter = useCallback(async () => {
    setError(null);
    return shortsLabCharacterRulesManager.addFemaleCharacter();
  }, []);

  const addMaleCharacter = useCallback(async () => {
    setError(null);
    return shortsLabCharacterRulesManager.addMaleCharacter();
  }, []);

  const deleteFemaleCharacter = useCallback(async (id: string) => {
    setError(null);
    try {
      return await shortsLabCharacterRulesManager.deleteFemaleCharacter(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '캐릭터 삭제 실패';
      setError(message);
      throw err;
    }
  }, []);

  const deleteMaleCharacter = useCallback(async (id: string) => {
    setError(null);
    try {
      return await shortsLabCharacterRulesManager.deleteMaleCharacter(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : '캐릭터 삭제 실패';
      setError(message);
      throw err;
    }
  }, []);

  const updateCharacter = useCallback(async (gender: 'female' | 'male', id: string, updates: Partial<CharacterSlotRule>) => {
    setError(null);
    return shortsLabCharacterRulesManager.updateCharacter(gender, id, updates);
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
    updateBackupContent,
    // 캐릭터 CRUD
    addFemaleCharacter,
    addMaleCharacter,
    deleteFemaleCharacter,
    deleteMaleCharacter,
    updateCharacter
  };
};

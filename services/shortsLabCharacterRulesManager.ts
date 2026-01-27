/**
 * shortsLabCharacterRulesManager.ts
 * 캐릭터 의상 규칙 스토리지 매니저
 *
 * localStorage 기반 영구 저장 및 백업 시스템
 */

import { DEFAULT_CHARACTER_RULES, ShortsLabCharacterRules, CharacterSlotRule } from './shortsLabCharacterRulesDefaults';
import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from './appStorageService';

const STORAGE_KEY = 'shorts-lab-character-rules';
const BACKUP_STORAGE_KEY = 'shorts-lab-character-rules-backups';
const MAX_BACKUPS = 5;

primeAppStorageCache();

export interface ShortsLabCharacterRulesBackup {
  id: string;
  name: string;
  createdAt: string;
  rules: ShortsLabCharacterRules;
}

let cachedRules: ShortsLabCharacterRules | null = null;
let cachedBackups: ShortsLabCharacterRulesBackup[] | null = null;

type RulesListener = (rules: ShortsLabCharacterRules) => void;
type BackupListener = (backups: ShortsLabCharacterRulesBackup[]) => void;

const rulesListeners = new Set<RulesListener>();
const backupListeners = new Set<BackupListener>();

const notifyRulesListeners = (rules: ShortsLabCharacterRules) => {
  rulesListeners.forEach((listener) => listener(rules));
};

const notifyBackupListeners = (backups: ShortsLabCharacterRulesBackup[]) => {
  backupListeners.forEach((listener) => listener(backups));
};

const normalizeCharacterSlot = (input?: Partial<CharacterSlotRule>): CharacterSlotRule => {
  const source = input || {};
  return {
    identity: typeof source.identity === 'string' ? source.identity : '',
    hair: typeof source.hair === 'string' ? source.hair : '',
    body: typeof source.body === 'string' ? source.body : '',
    ageLabel: typeof source.ageLabel === 'string' ? source.ageLabel : '',
    style: typeof source.style === 'string' ? source.style : '',
    outfitFit: typeof source.outfitFit === 'string' ? source.outfitFit : ''
  };
};

const normalizeRules = (input?: Partial<ShortsLabCharacterRules>): ShortsLabCharacterRules => {
  const source = input || {};

  return {
    femaleA: normalizeCharacterSlot(source.femaleA || DEFAULT_CHARACTER_RULES.femaleA),
    femaleB: normalizeCharacterSlot(source.femaleB || DEFAULT_CHARACTER_RULES.femaleB),
    femaleC: normalizeCharacterSlot(source.femaleC || DEFAULT_CHARACTER_RULES.femaleC),
    femaleD: normalizeCharacterSlot(source.femaleD || DEFAULT_CHARACTER_RULES.femaleD),
    maleA: normalizeCharacterSlot(source.maleA || DEFAULT_CHARACTER_RULES.maleA),
    maleB: normalizeCharacterSlot(source.maleB || DEFAULT_CHARACTER_RULES.maleB),
    maleC: normalizeCharacterSlot(source.maleC || DEFAULT_CHARACTER_RULES.maleC),
    common: {
      negativePrompt: typeof source.common?.negativePrompt === 'string'
        ? source.common.negativePrompt
        : DEFAULT_CHARACTER_RULES.common.negativePrompt,
      qualityTags: typeof source.common?.qualityTags === 'string'
        ? source.common.qualityTags
        : DEFAULT_CHARACTER_RULES.common.qualityTags,
      defaultFemaleAge: typeof source.common?.defaultFemaleAge === 'string'
        ? source.common.defaultFemaleAge
        : DEFAULT_CHARACTER_RULES.common.defaultFemaleAge,
      defaultMaleAge: typeof source.common?.defaultMaleAge === 'string'
        ? source.common.defaultMaleAge
        : DEFAULT_CHARACTER_RULES.common.defaultMaleAge
    }
  };
};

const normalizeBackup = (
  backup: Partial<ShortsLabCharacterRulesBackup> & { id: string }
): ShortsLabCharacterRulesBackup => ({
  id: backup.id,
  name: backup.name?.trim() || '이름 없는 백업',
  createdAt: backup.createdAt || new Date().toISOString(),
  rules: normalizeRules(backup.rules)
});

const readStoredRules = (): ShortsLabCharacterRules => {
  const stored = getAppStorageCachedValue<ShortsLabCharacterRules | null>(STORAGE_KEY, null);
  return stored ? normalizeRules(stored) : DEFAULT_CHARACTER_RULES;
};

const writeStoredRules = (rules: ShortsLabCharacterRules) => {
  setAppStorageValue(STORAGE_KEY, rules).catch((error) => {
    console.warn('[shortsLabCharacterRulesManager] Failed to save rules:', error);
  });
};

const readStoredBackups = (): ShortsLabCharacterRulesBackup[] => {
  const stored = getAppStorageCachedValue<ShortsLabCharacterRulesBackup[] | null>(BACKUP_STORAGE_KEY, null);
  if (!stored || !Array.isArray(stored)) return [];
  return stored.map((item) => normalizeBackup(item));
};

const writeStoredBackups = (backups: ShortsLabCharacterRulesBackup[]) => {
  setAppStorageValue(BACKUP_STORAGE_KEY, backups).catch((error) => {
    console.warn('[shortsLabCharacterRulesManager] Failed to save backups:', error);
  });
};

const formatBackupName = (input?: string) => {
  if (input && input.trim()) return input.trim();
  const now = new Date();
  const date = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `백업 ${date} ${time}`;
};

export const shortsLabCharacterRulesManager = {
  getRules: (): ShortsLabCharacterRules => {
    if (cachedRules) return cachedRules;
    cachedRules = readStoredRules();
    return cachedRules;
  },
  getBackups: (): ShortsLabCharacterRulesBackup[] => {
    if (cachedBackups) return cachedBackups;
    cachedBackups = readStoredBackups();
    return cachedBackups;
  },
  subscribeRules: (listener: RulesListener) => {
    rulesListeners.add(listener);
    return () => {
      rulesListeners.delete(listener);
    };
  },
  subscribeBackups: (listener: BackupListener) => {
    backupListeners.add(listener);
    return () => {
      backupListeners.delete(listener);
    };
  },
  loadRules: async (): Promise<ShortsLabCharacterRules> => {
    cachedRules = readStoredRules();
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  loadBackups: async (): Promise<ShortsLabCharacterRulesBackup[]> => {
    cachedBackups = readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  updateRules: async (rulesInput: unknown): Promise<ShortsLabCharacterRules> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabCharacterRules>);
    cachedRules = normalized;
    writeStoredRules(normalized);
    notifyRulesListeners(normalized);
    return normalized;
  },
  resetRules: async (): Promise<ShortsLabCharacterRules> => {
    cachedRules = DEFAULT_CHARACTER_RULES;
    writeStoredRules(cachedRules);
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  createBackup: async (name?: string): Promise<ShortsLabCharacterRulesBackup[]> => {
    const rules = cachedRules || readStoredRules();
    const backups = cachedBackups || readStoredBackups();
    const newBackup = normalizeBackup({
      id: `character-rules-backup-${Date.now()}`,
      name: formatBackupName(name),
      createdAt: new Date().toISOString(),
      rules
    });
    const updated = [newBackup, ...backups];
    const limited = updated.slice(0, MAX_BACKUPS);
    cachedBackups = limited;
    writeStoredBackups(limited);
    notifyBackupListeners(limited);
    return limited;
  },
  restoreBackup: async (id: string): Promise<ShortsLabCharacterRules> => {
    const backups = cachedBackups || readStoredBackups();
    const target = backups.find((backup) => backup.id === id);
    if (!target) {
      throw new Error('백업을 찾을 수 없습니다.');
    }
    const restored = normalizeRules(target.rules);
    cachedRules = restored;
    writeStoredRules(restored);
    notifyRulesListeners(restored);
    return restored;
  },
  deleteBackup: async (id: string): Promise<ShortsLabCharacterRulesBackup[]> => {
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.filter((backup) => backup.id !== id);
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  renameBackup: async (id: string, name: string): Promise<ShortsLabCharacterRulesBackup[]> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('백업 이름을 입력해주세요.');
    }
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.map((backup) => {
      if (backup.id !== id) return backup;
      return normalizeBackup({ ...backup, name: trimmedName, id: backup.id });
    });
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  updateBackupContent: async (
    id: string,
    rulesInput: unknown
  ): Promise<ShortsLabCharacterRulesBackup[]> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabCharacterRules>);
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.map((backup) => {
      if (backup.id !== id) return backup;
      return normalizeBackup({ ...backup, rules: normalized, id: backup.id });
    });
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  }
};

export const getCharacterRules = (): ShortsLabCharacterRules =>
  shortsLabCharacterRulesManager.getRules();

import { DEFAULT_SCRIPT_RULES, ShortsLabScriptRules } from './shortsLabScriptRulesDefaults';
import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from './appStorageService';

const STORAGE_KEY = 'shorts-lab-script-rules';
const BACKUP_STORAGE_KEY = 'shorts-lab-script-rules-backups';
const MAX_BACKUPS = 5;

primeAppStorageCache();

export interface ShortsLabScriptRulesBackup {
  id: string;
  name: string;
  createdAt: string;
  rules: ShortsLabScriptRules;
}

let cachedRules: ShortsLabScriptRules | null = null;
let cachedBackups: ShortsLabScriptRulesBackup[] | null = null;

type RulesListener = (rules: ShortsLabScriptRules) => void;
type BackupListener = (backups: ShortsLabScriptRulesBackup[]) => void;

const rulesListeners = new Set<RulesListener>();
const backupListeners = new Set<BackupListener>();

const notifyRulesListeners = (rules: ShortsLabScriptRules) => {
  rulesListeners.forEach((listener) => listener(rules));
};

const notifyBackupListeners = (backups: ShortsLabScriptRulesBackup[]) => {
  backupListeners.forEach((listener) => listener(backups));
};

const normalizeLines = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
};

const normalizeRules = (input?: Partial<ShortsLabScriptRules>): ShortsLabScriptRules => {
  const source = input || {};
  return {
    coreRules: normalizeLines(source.coreRules, DEFAULT_SCRIPT_RULES.coreRules),
    formatRules: normalizeLines(source.formatRules, DEFAULT_SCRIPT_RULES.formatRules)
  };
};

const normalizeBackup = (
  backup: Partial<ShortsLabScriptRulesBackup> & { id: string }
): ShortsLabScriptRulesBackup => ({
  id: backup.id,
  name: backup.name?.trim() || '이름 없는 백업',
  createdAt: backup.createdAt || new Date().toISOString(),
  rules: normalizeRules(backup.rules)
});

const readStoredRules = (): ShortsLabScriptRules => {
  const stored = getAppStorageCachedValue<ShortsLabScriptRules | null>(STORAGE_KEY, null);
  return stored ? normalizeRules(stored) : DEFAULT_SCRIPT_RULES;
};

const writeStoredRules = (rules: ShortsLabScriptRules) => {
  setAppStorageValue(STORAGE_KEY, rules).catch((error) => {
    console.warn('[shortsLabScriptRulesManager] Failed to save rules:', error);
  });
};

const readStoredBackups = (): ShortsLabScriptRulesBackup[] => {
  const stored = getAppStorageCachedValue<ShortsLabScriptRulesBackup[] | null>(BACKUP_STORAGE_KEY, null);
  if (!stored || !Array.isArray(stored)) return [];
  return stored.map((item) => normalizeBackup(item));
};

const writeStoredBackups = (backups: ShortsLabScriptRulesBackup[]) => {
  setAppStorageValue(BACKUP_STORAGE_KEY, backups).catch((error) => {
    console.warn('[shortsLabScriptRulesManager] Failed to save backups:', error);
  });
};

const formatBackupName = (input?: string) => {
  if (input && input.trim()) return input.trim();
  const now = new Date();
  const date = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `백업 ${date} ${time}`;
};

export const shortsLabScriptRulesManager = {
  getRules: (): ShortsLabScriptRules => {
    if (cachedRules) return cachedRules;
    cachedRules = readStoredRules();
    return cachedRules;
  },
  getBackups: (): ShortsLabScriptRulesBackup[] => {
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
  loadRules: async (): Promise<ShortsLabScriptRules> => {
    await primeAppStorageCache();
    cachedRules = readStoredRules();
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  loadBackups: async (): Promise<ShortsLabScriptRulesBackup[]> => {
    await primeAppStorageCache();
    cachedBackups = readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  updateRules: async (rulesInput: unknown): Promise<ShortsLabScriptRules> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabScriptRules>);
    cachedRules = normalized;
    writeStoredRules(normalized);
    notifyRulesListeners(normalized);
    return normalized;
  },
  resetRules: async (): Promise<ShortsLabScriptRules> => {
    cachedRules = DEFAULT_SCRIPT_RULES;
    writeStoredRules(cachedRules);
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  createBackup: async (name?: string): Promise<ShortsLabScriptRulesBackup[]> => {
    const rules = cachedRules || readStoredRules();
    const backups = cachedBackups || readStoredBackups();
    const newBackup = normalizeBackup({
      id: `script-rules-backup-${Date.now()}`,
      name: formatBackupName(name),
      createdAt: new Date().toISOString(),
      rules
    });
    const updated = [newBackup, ...backups].slice(0, MAX_BACKUPS);
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  restoreBackup: async (id: string): Promise<ShortsLabScriptRules> => {
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
  deleteBackup: async (id: string): Promise<ShortsLabScriptRulesBackup[]> => {
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.filter((backup) => backup.id !== id);
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  renameBackup: async (id: string, name: string): Promise<ShortsLabScriptRulesBackup[]> => {
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
  ): Promise<ShortsLabScriptRulesBackup[]> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabScriptRules>);
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

export const getShortsLabScriptRules = (): ShortsLabScriptRules =>
  shortsLabScriptRulesManager.getRules();

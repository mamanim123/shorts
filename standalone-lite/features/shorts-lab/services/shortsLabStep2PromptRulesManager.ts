import { DEFAULT_STEP2_PROMPT_RULES, ShortsLabStep2PromptRules } from './shortsLabStep2PromptRulesDefaults';
import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from './appStorageService';

const STORAGE_KEY = 'shorts-lab-step2-prompt-rules';
const BACKUP_STORAGE_KEY = 'shorts-lab-step2-prompt-rules-backups';
const MAX_BACKUPS = 5;

primeAppStorageCache();

export interface ShortsLabStep2PromptRulesBackup {
  id: string;
  name: string;
  createdAt: string;
  rules: ShortsLabStep2PromptRules;
}

let cachedRules: ShortsLabStep2PromptRules | null = null;
let cachedBackups: ShortsLabStep2PromptRulesBackup[] | null = null;

type RulesListener = (rules: ShortsLabStep2PromptRules) => void;
type BackupListener = (backups: ShortsLabStep2PromptRulesBackup[]) => void;

const rulesListeners = new Set<RulesListener>();
const backupListeners = new Set<BackupListener>();

const notifyRulesListeners = (rules: ShortsLabStep2PromptRules) => {
  rulesListeners.forEach((listener) => listener(rules));
};

const notifyBackupListeners = (backups: ShortsLabStep2PromptRulesBackup[]) => {
  backupListeners.forEach((listener) => listener(backups));
};

const normalizeRules = (input?: Partial<ShortsLabStep2PromptRules>): ShortsLabStep2PromptRules => {
  const source = input || {};
  const normalizeField = (value: unknown, fallback: string) => {
    // Allow empty strings - user may want to clear prompts
    return typeof value === 'string' ? value : fallback;
  };

  return {
    scriptPrompt: normalizeField(source.scriptPrompt, DEFAULT_STEP2_PROMPT_RULES.scriptPrompt),
    characterPrompt: normalizeField(source.characterPrompt, DEFAULT_STEP2_PROMPT_RULES.characterPrompt),
    finalPrompt: normalizeField(source.finalPrompt, DEFAULT_STEP2_PROMPT_RULES.finalPrompt)
  };
};

const normalizeBackup = (
  backup: Partial<ShortsLabStep2PromptRulesBackup> & { id: string }
): ShortsLabStep2PromptRulesBackup => ({
  id: backup.id,
  name: backup.name?.trim() || '이름 없는 백업',
  createdAt: backup.createdAt || new Date().toISOString(),
  rules: normalizeRules(backup.rules)
});

const readStoredRules = (): ShortsLabStep2PromptRules => {
  const stored = getAppStorageCachedValue<ShortsLabStep2PromptRules | null>(STORAGE_KEY, null);
  return stored ? normalizeRules(stored) : DEFAULT_STEP2_PROMPT_RULES;
};

const writeStoredRules = (rules: ShortsLabStep2PromptRules) => {
  setAppStorageValue(STORAGE_KEY, rules).catch((error) => {
    console.warn('[shortsLabStep2PromptRulesManager] Failed to save rules:', error);
  });
};

const readStoredBackups = (): ShortsLabStep2PromptRulesBackup[] => {
  const stored = getAppStorageCachedValue<ShortsLabStep2PromptRulesBackup[] | null>(BACKUP_STORAGE_KEY, null);
  if (!stored || !Array.isArray(stored)) return [];
  return stored.map((item) => normalizeBackup(item));
};

const writeStoredBackups = (backups: ShortsLabStep2PromptRulesBackup[]) => {
  setAppStorageValue(BACKUP_STORAGE_KEY, backups).catch((error) => {
    console.warn('[shortsLabStep2PromptRulesManager] Failed to save backups:', error);
  });
};

const formatBackupName = (input?: string) => {
  if (input && input.trim()) return input.trim();
  const now = new Date();
  const date = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `백업 ${date} ${time}`;
};

export const fillStep2PromptTemplate = (
  template: string,
  variables: Record<string, string>
): string => {
  if (!template) return '';
  return template.replace(/{{(\w+)}}/g, (_, key) => variables[key] ?? `{{${key}}}`);
};

export const shortsLabStep2PromptRulesManager = {
  getRules: (forceRefresh: boolean = false): ShortsLabStep2PromptRules => {
    if (cachedRules && !forceRefresh) return cachedRules;
    cachedRules = readStoredRules();
    return cachedRules;
  },

  getBackups: (): ShortsLabStep2PromptRulesBackup[] => {
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
  loadRules: async (): Promise<ShortsLabStep2PromptRules> => {
    await primeAppStorageCache();
    cachedRules = readStoredRules();
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  loadBackups: async (): Promise<ShortsLabStep2PromptRulesBackup[]> => {
    await primeAppStorageCache();
    cachedBackups = readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  updateRules: async (rulesInput: unknown): Promise<ShortsLabStep2PromptRules> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabStep2PromptRules>);
    cachedRules = normalized;
    writeStoredRules(normalized);
    notifyRulesListeners(normalized);
    return normalized;
  },
  resetRules: async (): Promise<ShortsLabStep2PromptRules> => {
    cachedRules = DEFAULT_STEP2_PROMPT_RULES;
    writeStoredRules(cachedRules);
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  createBackup: async (name?: string): Promise<ShortsLabStep2PromptRulesBackup[]> => {
    const rules = cachedRules || readStoredRules();
    const backups = cachedBackups || readStoredBackups();
    const newBackup = normalizeBackup({
      id: `step2-rules-backup-${Date.now()}`,
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
  restoreBackup: async (id: string): Promise<ShortsLabStep2PromptRules> => {
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
  deleteBackup: async (id: string): Promise<ShortsLabStep2PromptRulesBackup[]> => {
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.filter((backup) => backup.id !== id);
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  renameBackup: async (id: string, name: string): Promise<ShortsLabStep2PromptRulesBackup[]> => {
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
  ): Promise<ShortsLabStep2PromptRulesBackup[]> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabStep2PromptRules>);
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

export const getShortsLabStep2PromptRules = (): ShortsLabStep2PromptRules =>
  shortsLabStep2PromptRulesManager.getRules();

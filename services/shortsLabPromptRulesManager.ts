import { DEFAULT_PROMPT_RULES, ShortsLabPromptRules } from './shortsLabPromptRulesDefaults';

const STORAGE_KEY = 'shorts-lab-prompt-rules';
const BACKUP_STORAGE_KEY = 'shorts-lab-prompt-rules-backups';
const MAX_BACKUPS = 5;

export interface ShortsLabPromptRulesBackup {
  id: string;
  name: string;
  createdAt: string;
  rules: ShortsLabPromptRules;
}

let cachedRules: ShortsLabPromptRules | null = null;
let cachedBackups: ShortsLabPromptRulesBackup[] | null = null;

type RulesListener = (rules: ShortsLabPromptRules) => void;
type BackupListener = (backups: ShortsLabPromptRulesBackup[]) => void;

const rulesListeners = new Set<RulesListener>();
const backupListeners = new Set<BackupListener>();

const notifyRulesListeners = (rules: ShortsLabPromptRules) => {
  rulesListeners.forEach((listener) => listener(rules));
};

const notifyBackupListeners = (backups: ShortsLabPromptRulesBackup[]) => {
  backupListeners.forEach((listener) => listener(backups));
};

const normalizePromptRules = (input?: Partial<ShortsLabPromptRules>): ShortsLabPromptRules => {
  const source = input || {};
  return {
    promptConstants: {
      ...DEFAULT_PROMPT_RULES.promptConstants,
      ...(source.promptConstants || {})
    },
    noTextTag: typeof source.noTextTag === 'string' ? source.noTextTag : DEFAULT_PROMPT_RULES.noTextTag,
    enforceKoreanIdentity:
      source.enforceKoreanIdentity !== undefined
        ? source.enforceKoreanIdentity
        : DEFAULT_PROMPT_RULES.enforceKoreanIdentity,
    expressionKeywords:
      source.expressionKeywords && Object.keys(source.expressionKeywords).length > 0
        ? source.expressionKeywords
        : DEFAULT_PROMPT_RULES.expressionKeywords,
    cameraMapping:
      source.cameraMapping && Object.keys(source.cameraMapping).length > 0
        ? source.cameraMapping
        : DEFAULT_PROMPT_RULES.cameraMapping,
    outfitSelection: {
      ...DEFAULT_PROMPT_RULES.outfitSelection,
      ...(source.outfitSelection || {})
    },
    promptSections: {
      ...DEFAULT_PROMPT_RULES.promptSections,
      ...(source.promptSections || {})
    }
  };
};

const normalizeBackup = (backup: Partial<ShortsLabPromptRulesBackup> & { id: string }): ShortsLabPromptRulesBackup => ({
  id: backup.id,
  name: backup.name?.trim() || '이름 없는 백업',
  createdAt: backup.createdAt || new Date().toISOString(),
  rules: normalizePromptRules(backup.rules)
});

const readStoredRules = (): ShortsLabPromptRules => {
  if (typeof window === 'undefined') return DEFAULT_PROMPT_RULES;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PROMPT_RULES;
    const parsed = JSON.parse(stored);
    return normalizePromptRules(parsed);
  } catch (error) {
    console.warn('[shortsLabPromptRulesManager] Failed to read rules:', error);
    return DEFAULT_PROMPT_RULES;
  }
};

const writeStoredRules = (rules: ShortsLabPromptRules) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (error) {
    console.warn('[shortsLabPromptRulesManager] Failed to save rules:', error);
  }
};

const readStoredBackups = (): ShortsLabPromptRulesBackup[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeBackup(item));
  } catch (error) {
    console.warn('[shortsLabPromptRulesManager] Failed to read backups:', error);
    return [];
  }
};

const writeStoredBackups = (backups: ShortsLabPromptRulesBackup[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups));
  } catch (error) {
    console.warn('[shortsLabPromptRulesManager] Failed to save backups:', error);
  }
};

const formatBackupName = (input?: string) => {
  if (input && input.trim()) return input.trim();
  const now = new Date();
  const date = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `백업 ${date} ${time}`;
};

export const shortsLabPromptRulesManager = {
  getRules: (): ShortsLabPromptRules => {
    if (cachedRules) return cachedRules;
    cachedRules = readStoredRules();
    return cachedRules;
  },
  getBackups: (): ShortsLabPromptRulesBackup[] => {
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
  loadRules: async (): Promise<ShortsLabPromptRules> => {
    cachedRules = readStoredRules();
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  loadBackups: async (): Promise<ShortsLabPromptRulesBackup[]> => {
    cachedBackups = readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  updateRules: async (rulesInput: unknown): Promise<ShortsLabPromptRules> => {
    const normalized = normalizePromptRules(rulesInput as Partial<ShortsLabPromptRules>);
    cachedRules = normalized;
    writeStoredRules(normalized);
    notifyRulesListeners(normalized);
    return normalized;
  },
  resetRules: async (): Promise<ShortsLabPromptRules> => {
    cachedRules = DEFAULT_PROMPT_RULES;
    writeStoredRules(cachedRules);
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  createBackup: async (name?: string): Promise<ShortsLabPromptRulesBackup[]> => {
    const rules = cachedRules || readStoredRules();
    const backups = cachedBackups || readStoredBackups();
    const newBackup = normalizeBackup({
      id: `rules-backup-${Date.now()}`,
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
  restoreBackup: async (id: string): Promise<ShortsLabPromptRules> => {
    const backups = cachedBackups || readStoredBackups();
    const target = backups.find((backup) => backup.id === id);
    if (!target) {
      throw new Error('백업을 찾을 수 없습니다.');
    }
    const restored = normalizePromptRules(target.rules);
    cachedRules = restored;
    writeStoredRules(restored);
    notifyRulesListeners(restored);
    return restored;
  },
  deleteBackup: async (id: string): Promise<ShortsLabPromptRulesBackup[]> => {
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.filter((backup) => backup.id !== id);
    cachedBackups = updated;
    writeStoredBackups(updated);
    notifyBackupListeners(updated);
    return updated;
  },
  renameBackup: async (id: string, name: string): Promise<ShortsLabPromptRulesBackup[]> => {
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
  updateBackupContent: async (id: string, rulesInput: unknown): Promise<ShortsLabPromptRulesBackup[]> => {
    const normalized = normalizePromptRules(rulesInput as Partial<ShortsLabPromptRules>);
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

export const getShortsLabPromptRules = (): ShortsLabPromptRules =>
  shortsLabPromptRulesManager.getRules();

import { DEFAULT_PROMPT_RULES, ShortsLabPromptRules } from './shortsLabPromptRulesDefaults';
import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from './appStorageService';

const STORAGE_KEY = 'shorts-lab-prompt-rules';
const BACKUP_STORAGE_KEY = 'shorts-lab-prompt-rules-backups';
const MAX_BACKUPS = 5;

primeAppStorageCache();

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
  console.log('[DEBUG PROMPT] notifyRulesListeners called, listener count:', rulesListeners.size);
  rulesListeners.forEach((listener) => listener(rules));
};

const notifyBackupListeners = (backups: ShortsLabPromptRulesBackup[]) => {
  backupListeners.forEach((listener) => listener(backups));
};

const normalizePromptRules = (input?: Partial<ShortsLabPromptRules>): ShortsLabPromptRules => {
  console.log('[DEBUG NORMALIZE] ========== normalizePromptRules START ==========');
  console.log('[DEBUG NORMALIZE] input type:', typeof input);
  console.log('[DEBUG NORMALIZE] input is null/undefined?', !input);

  // 입력이 없으면 현재 캐시된 규칙 또는 기본값 사용
  if (!input || typeof input !== 'object') {
    console.log('[DEBUG NORMALIZE] NO INPUT - returning cachedRules or DEFAULT');
    return cachedRules || DEFAULT_PROMPT_RULES;
  }

  const source = input as Partial<ShortsLabPromptRules>;
  console.log('[DEBUG NORMALIZE] input keys:', Object.keys(source));

  const result = {
    // 각 필드가 존재하면 그대로 사용, 없으면 기본값
    promptConstants: source.promptConstants !== undefined
      ? source.promptConstants
      : DEFAULT_PROMPT_RULES.promptConstants,
    noTextTag: source.noTextTag !== undefined
      ? source.noTextTag
      : DEFAULT_PROMPT_RULES.noTextTag,
    enforceKoreanIdentity: source.enforceKoreanIdentity !== undefined
      ? source.enforceKoreanIdentity
      : DEFAULT_PROMPT_RULES.enforceKoreanIdentity,
    expressionKeywords: source.expressionKeywords !== undefined
      ? source.expressionKeywords
      : DEFAULT_PROMPT_RULES.expressionKeywords,
    cameraMapping: source.cameraMapping !== undefined
      ? source.cameraMapping
      : DEFAULT_PROMPT_RULES.cameraMapping,
    outfitSelection: source.outfitSelection !== undefined
      ? { ...DEFAULT_PROMPT_RULES.outfitSelection, ...source.outfitSelection }
      : DEFAULT_PROMPT_RULES.outfitSelection,
    promptSections: source.promptSections !== undefined
      ? { ...DEFAULT_PROMPT_RULES.promptSections, ...source.promptSections }
      : DEFAULT_PROMPT_RULES.promptSections
  };

  console.log('[DEBUG NORMALIZE] Field check:');
  console.log('  - promptConstants from:', source.promptConstants !== undefined ? 'INPUT' : 'DEFAULT');
  console.log('  - noTextTag from:', source.noTextTag !== undefined ? 'INPUT' : 'DEFAULT');
  console.log('  - enforceKoreanIdentity from:', source.enforceKoreanIdentity !== undefined ? 'INPUT' : 'DEFAULT');
  console.log('[DEBUG NORMALIZE] ========== normalizePromptRules END ==========');

  return result;
};

const normalizeBackup = (backup: Partial<ShortsLabPromptRulesBackup> & { id: string }): ShortsLabPromptRulesBackup => ({
  id: backup.id,
  name: backup.name?.trim() || '이름 없는 백업',
  createdAt: backup.createdAt || new Date().toISOString(),
  rules: normalizePromptRules(backup.rules)
});

const readStoredRules = (): ShortsLabPromptRules => {
  console.log('[DEBUG PROMPT] readStoredRules called');
  const stored = getAppStorageCachedValue<ShortsLabPromptRules | null>(STORAGE_KEY, null);
  console.log('[DEBUG PROMPT] getAppStorageCachedValue returned:', stored ? 'DATA EXISTS' : 'NULL');
  if (stored) {
    console.log('[DEBUG PROMPT] stored data keys:', Object.keys(stored));
  }
  const result = stored ? normalizePromptRules(stored) : DEFAULT_PROMPT_RULES;
  console.log('[DEBUG PROMPT] readStoredRules returning:', result ? 'NORMALIZED DATA' : 'NULL');
  return result;
};

const writeStoredRules = (rules: ShortsLabPromptRules) => {
  console.log('[DEBUG PROMPT] writeStoredRules called with:', JSON.stringify(rules).substring(0, 200));
  setAppStorageValue(STORAGE_KEY, rules).then(() => {
    console.log('[DEBUG PROMPT] writeStoredRules SUCCESS');
  }).catch((error) => {
    console.warn('[shortsLabPromptRulesManager] Failed to save rules:', error);
  });
};

const readStoredBackups = (): ShortsLabPromptRulesBackup[] => {
  const stored = getAppStorageCachedValue<ShortsLabPromptRulesBackup[] | null>(BACKUP_STORAGE_KEY, null);
  if (!stored || !Array.isArray(stored)) return [];
  return stored.map((item) => normalizeBackup(item));
};

const writeStoredBackups = (backups: ShortsLabPromptRulesBackup[]) => {
  setAppStorageValue(BACKUP_STORAGE_KEY, backups).catch((error) => {
    console.warn('[shortsLabPromptRulesManager] Failed to save backups:', error);
  });
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
    console.log('[DEBUG PROMPT] ==================== loadRules START ====================');
    await primeAppStorageCache();
    console.log('[DEBUG PROMPT] primeAppStorageCache completed');

    cachedRules = readStoredRules();
    console.log('[DEBUG PROMPT] readStoredRules completed, cachedRules keys:', Object.keys(cachedRules));

    notifyRulesListeners(cachedRules);
    console.log('[DEBUG PROMPT] Listeners notified with loaded rules');
    console.log('[DEBUG PROMPT] ==================== loadRules END ====================');
    return cachedRules;
  },
  loadBackups: async (): Promise<ShortsLabPromptRulesBackup[]> => {
    await primeAppStorageCache();
    cachedBackups = readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  updateRules: async (rulesInput: unknown): Promise<ShortsLabPromptRules> => {
    console.log('[DEBUG PROMPT] ==================== updateRules START ====================');
    console.log('[DEBUG PROMPT] 1. rulesInput received:', JSON.stringify(rulesInput).substring(0, 200));
    console.log('[DEBUG PROMPT] 2. rulesInput type:', typeof rulesInput);
    console.log('[DEBUG PROMPT] 3. STORAGE_KEY:', STORAGE_KEY);

    // 🔧 수정: normalizePromptRules 호출 제거, 입력을 그대로 사용
    // 사용자가 추가한 커스텀 필드(genreMapping, visualFocusKeywords, sceneStructureMapping)도 보존
    const rules = rulesInput as any;
    console.log('[DEBUG PROMPT] 4. Using input as-is (no normalization)');

    cachedRules = rules;
    console.log('[DEBUG PROMPT] 5. cachedRules updated');

    await setAppStorageValue(STORAGE_KEY, rules);
    console.log('[DEBUG PROMPT] 6. setAppStorageValue completed');

    notifyRulesListeners(rules);
    console.log('[DEBUG PROMPT] 7. Listeners notified');
    console.log('[DEBUG PROMPT] ==================== updateRules END ====================');
    return rules;
  },
  resetRules: async (): Promise<ShortsLabPromptRules> => {
    cachedRules = DEFAULT_PROMPT_RULES;
    await setAppStorageValue(STORAGE_KEY, DEFAULT_PROMPT_RULES);
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  createBackup: async (name?: string): Promise<ShortsLabPromptRulesBackup[]> => {
    await primeAppStorageCache();
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
    await setAppStorageValue(BACKUP_STORAGE_KEY, limited);
    notifyBackupListeners(limited);
    return limited;
  },
  restoreBackup: async (id: string): Promise<ShortsLabPromptRules> => {
    await primeAppStorageCache();
    const backups = cachedBackups || readStoredBackups();
    const target = backups.find((backup) => backup.id === id);
    if (!target) {
      throw new Error('백업을 찾을 수 없습니다.');
    }
    const restored = normalizePromptRules(target.rules);
    cachedRules = restored;
    await setAppStorageValue(STORAGE_KEY, restored);
    notifyRulesListeners(restored);
    return restored;
  },
  deleteBackup: async (id: string): Promise<ShortsLabPromptRulesBackup[]> => {
    await primeAppStorageCache();
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.filter((backup) => backup.id !== id);
    cachedBackups = updated;
    await setAppStorageValue(BACKUP_STORAGE_KEY, updated);
    notifyBackupListeners(updated);
    return updated;
  },
  renameBackup: async (id: string, name: string): Promise<ShortsLabPromptRulesBackup[]> => {
    await primeAppStorageCache();
    const backups = cachedBackups || readStoredBackups();
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('백업 이름을 입력해주세요.');
    }
    const updated = backups.map((backup) => {
      if (backup.id !== id) return backup;
      return normalizeBackup({ ...backup, name: trimmedName, id: backup.id });
    });
    cachedBackups = updated;
    await setAppStorageValue(BACKUP_STORAGE_KEY, updated);
    notifyBackupListeners(updated);
    return updated;
  },
  updateBackupContent: async (id: string, rulesInput: unknown): Promise<ShortsLabPromptRulesBackup[]> => {
    await primeAppStorageCache();
    const normalized = normalizePromptRules(rulesInput as Partial<ShortsLabPromptRules>);
    const backups = cachedBackups || readStoredBackups();
    const updated = backups.map((backup) => {
      if (backup.id !== id) return backup;
      return normalizeBackup({ ...backup, rules: normalized, id: backup.id });
    });
    cachedBackups = updated;
    await setAppStorageValue(BACKUP_STORAGE_KEY, updated);
    notifyBackupListeners(updated);
    return updated;
  }
};

export const getShortsLabPromptRules = (): ShortsLabPromptRules =>
  shortsLabPromptRulesManager.getRules();

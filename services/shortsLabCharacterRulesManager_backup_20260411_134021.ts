/**
 * shortsLabCharacterRulesManager.ts
 * 캐릭터 의상 규칙 스토리지 매니저
 *
 * v2.0 업데이트:
 * - 캐릭터 추가/삭제 기능 추가
 * - 동적 배열 구조 지원
 */

import { DEFAULT_CHARACTER_RULES, ShortsLabCharacterRules, CharacterSlotRule, generateCharacterId, ruleKeyToSlotId } from './shortsLabCharacterRulesDefaults';
import {
  getAppStorageCachedValue,
  getAppStorageValue,
  primeAppStorageCache,
  setAppStorageValue
} from './appStorageService';
import type { CharacterItem } from './characterService';

// CharacterItem → CharacterSlotRule 변환 함수
export const convertCharacterToSlotRule = (
  char: CharacterItem,
  targetSlotId: string
): CharacterSlotRule => ({
  id: targetSlotId,
  name: typeof char.name === 'string' ? char.name.trim() : '',
  identity: char.gender === 'female'
    ? `A stunning Korean woman${char.age ? ` in her ${char.age}` : ''}`
    : `A handsome Korean man${char.age ? ` in his ${char.age}` : ''}`,
  hair: char.identitySpec?.hairDescription || char.hair || 'elegant hairstyle',
  body: [
    char.identitySpec?.bodyType,
    char.identitySpec?.bustDescription,
    char.identitySpec?.heightDescription,
    char.body
  ].filter(Boolean).join(', ') || 'graceful figure',
  style: [
    char.identitySpec?.styleCore,
    char.identitySpec?.signatureFeatures,
    char.style
  ].filter(Boolean).join(', ') || (char.gender === 'female'
    ? 'perfectly managed sophisticated look'
    : 'dandy and refined presence'),
  outfitFit: char.wardrobeProfile?.preserveBodySilhouette === false
    ? 'wardrobe may change while preserving the same person'
    : char.gender === 'female'
    ? 'tight-fitting, form-hugging, accentuating curves naturally'
    : 'tailored slim-fit, clean and sharp lines',
  face: char.identitySpec?.faceShape || char.face || '',
  skinTone: char.identitySpec?.skinTone || '',
  signatureFeatures: char.identitySpec?.signatureFeatures || '',
  bustDescription: char.identitySpec?.bustDescription || '',
  heightDescription: char.identitySpec?.heightDescription || '',
  referenceViewPreference: char.referencePreference?.defaultView || 'front',
  preserveIdentityOnly: char.wardrobeProfile?.outfitChangePolicy === 'outfit-only'
});

const STORAGE_KEY = 'shorts-lab-character-rules';
const MAX_BACKUPS = 5;
const API_BASE = 'http://localhost:3002';

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

const getDefaultSlotName = (id: string) => {
  const allDefaults = [...DEFAULT_CHARACTER_RULES.females, ...DEFAULT_CHARACTER_RULES.males];
  const match = allDefaults.find((slot) => slot.id === id);
  return match?.name || '';
};

const normalizeCharacterSlot = (input?: Partial<CharacterSlotRule>): CharacterSlotRule => {
  const source = input || {};
  const rawId = typeof source.id === 'string' ? source.id : '';
  const normalizedId = rawId
    ? ruleKeyToSlotId(rawId)
    : '';
  const fallbackName = normalizedId ? getDefaultSlotName(normalizedId) : '';
  const trimmedName = typeof source.name === 'string' ? source.name.trim() : '';
  return {
    id: normalizedId,
    name: trimmedName || fallbackName,
    identity: typeof source.identity === 'string' ? source.identity : '',
    hair: typeof source.hair === 'string' ? source.hair : '',
    body: typeof source.body === 'string' ? source.body : '',
    style: typeof source.style === 'string' ? source.style : '',
    outfitFit: typeof source.outfitFit === 'string' ? source.outfitFit : '',
    face: typeof source.face === 'string' ? source.face : '',
    skinTone: typeof source.skinTone === 'string' ? source.skinTone : '',
    signatureFeatures: typeof source.signatureFeatures === 'string' ? source.signatureFeatures : '',
    bustDescription: typeof source.bustDescription === 'string' ? source.bustDescription : '',
    heightDescription: typeof source.heightDescription === 'string' ? source.heightDescription : '',
    referenceViewPreference: source.referenceViewPreference === 'angle45' || source.referenceViewPreference === 'back' ? source.referenceViewPreference : 'front',
    preserveIdentityOnly: source.preserveIdentityOnly === true,
    isFixedAge: source.isFixedAge === true,
    fixedAge: typeof source.fixedAge === 'string' ? source.fixedAge : undefined
  };
};

const hasLegacyIds = (rules: ShortsLabCharacterRules) => {
  const legacy = (id: string) => /^female|^male/.test(id);
  return rules.females.some((slot) => legacy(slot.id)) || rules.males.some((slot) => legacy(slot.id));
};

const normalizeRules = (input?: Partial<ShortsLabCharacterRules>): ShortsLabCharacterRules => {
  const source = input || {};

  // 배열 정규화
  const normalizeFemales = Array.isArray(source.females)
    ? source.females.map(normalizeCharacterSlot)
    : DEFAULT_CHARACTER_RULES.females.map(normalizeCharacterSlot);

  const normalizeMales = Array.isArray(source.males)
    ? source.males.map(normalizeCharacterSlot)
    : DEFAULT_CHARACTER_RULES.males.map(normalizeCharacterSlot);

  return {
    females: normalizeFemales,
    males: normalizeMales,
    common: {
      negativePrompt: typeof source.common?.negativePrompt === 'string'
        ? source.common.negativePrompt
        : DEFAULT_CHARACTER_RULES.common.negativePrompt,
      qualityTags: typeof source.common?.qualityTags === 'string'
        ? source.common.qualityTags
        : DEFAULT_CHARACTER_RULES.common.qualityTags
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

const readStoredBackups = async (): Promise<ShortsLabCharacterRulesBackup[]> => {
  try {
    const response = await fetch(`${API_BASE}/api/character-backups`);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.backups || []).map((item: Partial<ShortsLabCharacterRulesBackup> & { id: string }) => normalizeBackup(item));
  } catch (error) {
    console.warn('[shortsLabCharacterRulesManager] Failed to load backups:', error);
    return [];
  }
};

const writeStoredBackup = async (backup: ShortsLabCharacterRulesBackup): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/character-backups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup })
    });
    if (!response.ok) throw new Error('Failed to save backup');
    return true;
  } catch (error) {
    console.warn('[shortsLabCharacterRulesManager] Failed to save backup:', error);
    return false;
  }
};

const deleteStoredBackup = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/api/character-backups/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete backup');
    return true;
  } catch (error) {
    console.warn('[shortsLabCharacterRulesManager] Failed to delete backup:', error);
    return false;
  }
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
    // 캐시된 백업 반환 (최초 로드는 loadBackups를 통해)
    return cachedBackups || [];
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
    await primeAppStorageCache();
    const stored = await getAppStorageValue<ShortsLabCharacterRules | null>(STORAGE_KEY, null);
    cachedRules = stored ? normalizeRules(stored) : readStoredRules();
    if (stored && hasLegacyIds(cachedRules)) {
      writeStoredRules(cachedRules);
    }
    notifyRulesListeners(cachedRules);
    return cachedRules;
  },
  loadBackups: async (): Promise<ShortsLabCharacterRulesBackup[]> => {
    cachedBackups = await readStoredBackups();
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

  // ===== 캐릭터 추가/삭제 기능 =====
  addFemaleCharacter: async (): Promise<ShortsLabCharacterRules> => {
    const rules = cachedRules || readStoredRules();
    const newIndex = rules.females.length;
    const newId = generateCharacterId('female', newIndex);

    const newCharacter: CharacterSlotRule = {
      id: newId,
      name: '',
      identity: 'A stunning Korean woman in her 40s',
      hair: 'elegant hairstyle',
      body: 'graceful figure',
      style: 'elegant presence',
      outfitFit: 'tight-fitting, form-hugging'
    };

    const updated = {
      ...rules,
      females: [...rules.females, newCharacter]
    };

    cachedRules = updated;
    writeStoredRules(updated);
    notifyRulesListeners(updated);
    return updated;
  },

  addMaleCharacter: async (): Promise<ShortsLabCharacterRules> => {
    const rules = cachedRules || readStoredRules();
    const newIndex = rules.males.length;
    const newId = generateCharacterId('male', newIndex);

    const newCharacter: CharacterSlotRule = {
      id: newId,
      name: '',
      identity: 'A handsome Korean man in his 40s',
      hair: 'neat hairstyle',
      body: 'athletic build',
      style: 'refined presence',
      outfitFit: 'tailored slim-fit'
    };

    const updated = {
      ...rules,
      males: [...rules.males, newCharacter]
    };

    cachedRules = updated;
    writeStoredRules(updated);
    notifyRulesListeners(updated);
    return updated;
  },

  deleteFemaleCharacter: async (id: string): Promise<ShortsLabCharacterRules> => {
    const rules = cachedRules || readStoredRules();

    // femaleD (캐디)는 삭제 방지
    if (id === 'WomanD') {
      throw new Error('캐디(Woman D)는 삭제할 수 없습니다.');
    }

    // 최소 1개는 유지
    if (rules.females.length <= 1) {
      throw new Error('최소 1개의 여성 캐릭터는 유지해야 합니다.');
    }

    const updated = {
      ...rules,
      females: rules.females.filter(char => char.id !== id)
    };

    cachedRules = updated;
    writeStoredRules(updated);
    notifyRulesListeners(updated);
    return updated;
  },

  deleteMaleCharacter: async (id: string): Promise<ShortsLabCharacterRules> => {
    const rules = cachedRules || readStoredRules();

    // 최소 1개는 유지
    if (rules.males.length <= 1) {
      throw new Error('최소 1개의 남성 캐릭터는 유지해야 합니다.');
    }

    const updated = {
      ...rules,
      males: rules.males.filter(char => char.id !== id)
    };

    cachedRules = updated;
    writeStoredRules(updated);
    notifyRulesListeners(updated);
    return updated;
  },

  updateCharacter: async (gender: 'female' | 'male', id: string, updates: Partial<CharacterSlotRule>): Promise<ShortsLabCharacterRules> => {
    const rules = cachedRules || readStoredRules();

    const updated = gender === 'female'
      ? {
          ...rules,
          females: rules.females.map(char =>
            char.id === id ? { ...char, ...updates, id: char.id } : char
          )
        }
      : {
          ...rules,
          males: rules.males.map(char =>
            char.id === id ? { ...char, ...updates, id: char.id } : char
          )
        };

    cachedRules = updated;
    writeStoredRules(updated);
    notifyRulesListeners(updated);
    return updated;
  },

  // 캐릭터 가져오기: CharacterItem → CharacterSlotRule 변환 후 적용
  importCharacter: async (
    char: CharacterItem,
    targetSlotId: string
  ): Promise<ShortsLabCharacterRules> => {
    const rules = cachedRules || readStoredRules();
    const gender = char.gender;
    const slotRule = convertCharacterToSlotRule(char, targetSlotId);

    const updated = gender === 'female'
      ? {
          ...rules,
          females: rules.females.map(slot =>
            slot.id === targetSlotId ? slotRule : slot
          )
        }
      : {
          ...rules,
          males: rules.males.map(slot =>
            slot.id === targetSlotId ? slotRule : slot
          )
        };

    cachedRules = updated;
    writeStoredRules(updated);
    notifyRulesListeners(updated);
    return updated;
  },

  createBackup: async (name?: string): Promise<ShortsLabCharacterRulesBackup[]> => {
    const rules = cachedRules || readStoredRules();
    const newBackup = normalizeBackup({
      id: `character-rules-backup-${Date.now()}`,
      name: formatBackupName(name),
      createdAt: new Date().toISOString(),
      rules
    });

    // 파일로 백업 저장
    await writeStoredBackup(newBackup);

    // 백업 목록 갱신
    cachedBackups = await readStoredBackups();
    // 최대 개수 제한
    if (cachedBackups.length > MAX_BACKUPS) {
      const toDelete = cachedBackups.slice(MAX_BACKUPS);
      for (const backup of toDelete) {
        await deleteStoredBackup(backup.id);
      }
      cachedBackups = cachedBackups.slice(0, MAX_BACKUPS);
    }
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  restoreBackup: async (id: string): Promise<ShortsLabCharacterRules> => {
    const backups = cachedBackups || await readStoredBackups();
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
    // 파일에서 백업 삭제
    await deleteStoredBackup(id);

    // 백업 목록 갱신
    cachedBackups = await readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  renameBackup: async (id: string, name: string): Promise<ShortsLabCharacterRulesBackup[]> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('백업 이름을 입력해주세요.');
    }
    const backups = cachedBackups || await readStoredBackups();
    const target = backups.find(b => b.id === id);
    if (!target) {
      throw new Error('백업을 찾을 수 없습니다.');
    }

    // 기존 백업 삭제 후 이름만 바꿔서 재생성
    await deleteStoredBackup(id);
    const renamed = normalizeBackup({ ...target, name: trimmedName });
    await writeStoredBackup(renamed);

    // 백업 목록 갱신
    cachedBackups = await readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  },
  updateBackupContent: async (
    id: string,
    rulesInput: unknown
  ): Promise<ShortsLabCharacterRulesBackup[]> => {
    const normalized = normalizeRules(rulesInput as Partial<ShortsLabCharacterRules>);
    const backups = cachedBackups || await readStoredBackups();
    const target = backups.find(b => b.id === id);
    if (!target) {
      throw new Error('백업을 찾을 수 없습니다.');
    }

    // 기존 백업 삭제 후 내용만 바꿔서 재생성
    await deleteStoredBackup(id);
    const updated = normalizeBackup({ ...target, rules: normalized });
    await writeStoredBackup(updated);

    // 백업 목록 갱신
    cachedBackups = await readStoredBackups();
    notifyBackupListeners(cachedBackups);
    return cachedBackups;
  }
};

export const getCharacterRules = (): ShortsLabCharacterRules =>
  shortsLabCharacterRulesManager.getRules();

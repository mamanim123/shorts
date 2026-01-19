export interface ApiKeyEntry {
    id: string;
    label: string;
    value: string;
    createdAt: number;
}

export interface UsageRecord {
    timestamp: number;
    model: string;
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    context?: string;
}

export interface UsageSnapshot {
    calls: number;
    totalPromptTokens: number;
    totalResponseTokens: number;
    totalTokens: number;
    byModel: Record<string, { calls: number; totalTokens: number }>;
    last: UsageRecord | null;
}

type UsageListener = (snapshot: UsageSnapshot) => void;

interface UsageStore {
    activeKeyId: string;
    keys: ApiKeyEntry[];
    snapshots: Record<string, UsageSnapshot>;
}

const STORAGE_KEY = 'master_studio_api_usage_v2';
const LEGACY_STORAGE_KEY = 'master_studio_api_usage';
const DEFAULT_KEY_ID = 'default';

const emptySnapshot: UsageSnapshot = {
    calls: 0,
    totalPromptTokens: 0,
    totalResponseTokens: 0,
    totalTokens: 0,
    byModel: {},
    last: null,
};

const listeners: Record<string, Set<UsageListener>> = {};

let memoryStore: UsageStore = {
    activeKeyId: DEFAULT_KEY_ID,
    keys: [],
    snapshots: { [DEFAULT_KEY_ID]: { ...emptySnapshot } },
};

const getLegacyMasterKey = (): string => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('master_studio_api_key') || '';
};

const ensureSnapshot = (store: UsageStore, keyId: string): UsageSnapshot => {
    if (!store.snapshots[keyId]) {
        store.snapshots[keyId] = { ...emptySnapshot };
    }
    return store.snapshots[keyId];
};

const normalizeStore = (raw: any): UsageStore => {
    const legacyKey = getLegacyMasterKey();
    const defaultEntry: ApiKeyEntry = {
        id: legacyKey || DEFAULT_KEY_ID,
        label: '기본 키',
        value: legacyKey,
        createdAt: Date.now(),
    };

    // If raw already looks like a store
    if (raw && raw.snapshots) {
        const store: UsageStore = {
            activeKeyId: raw.activeKeyId || defaultEntry.id,
            keys: Array.isArray(raw.keys) && raw.keys.length > 0 ? raw.keys : [defaultEntry],
            snapshots: {},
        };

        Object.entries(raw.snapshots || {}).forEach(([key, snapshot]) => {
            store.snapshots[key] = {
                ...emptySnapshot,
                ...(snapshot as UsageSnapshot),
                byModel: (snapshot as UsageSnapshot).byModel || {},
                last: (snapshot as UsageSnapshot).last || null,
            };
        });

        // Ensure every key has a snapshot
        store.keys.forEach((k) => ensureSnapshot(store, k.id));
        return store;
    }

    // Legacy: raw is a single snapshot
    const store: UsageStore = {
        activeKeyId: defaultEntry.id,
        keys: [defaultEntry],
        snapshots: {},
    };

    if (raw && typeof raw === 'object' && ('calls' in raw)) {
        store.snapshots[defaultEntry.id] = {
            ...emptySnapshot,
            ...(raw as UsageSnapshot),
            byModel: (raw as UsageSnapshot).byModel || {},
            last: (raw as UsageSnapshot).last || null,
        };
    } else {
        store.snapshots[defaultEntry.id] = { ...emptySnapshot };
    }

    return store;
};

const loadStore = (): UsageStore => {
    if (typeof window === 'undefined') return memoryStore;

    const rawNew = window.localStorage.getItem(STORAGE_KEY);
    const rawLegacy = rawNew ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);

    let parsed: any = null;
    try {
        parsed = rawNew ? JSON.parse(rawNew) : rawLegacy ? JSON.parse(rawLegacy) : null;
    } catch {
        parsed = null;
    }

    const store = normalizeStore(parsed);
    memoryStore = store;

    // If we loaded legacy data, persist into the new format
    if (!rawNew) {
        persistStore(store);
    }

    return store;
};

const persistStore = (store: UsageStore, notifyKeyId?: string) => {
    memoryStore = store;
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch {
            // Ignore quota issues; keep in memory
        }
    }

    if (notifyKeyId) {
        const snapshot = store.snapshots[notifyKeyId];
        const targetListeners = listeners[notifyKeyId];
        if (snapshot && targetListeners) {
            targetListeners.forEach((l) => l(snapshot));
        }
    }
};

const syncMasterKeyStorage = (value: string) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem('master_studio_api_key', value || '');
    } catch {
        // ignore
    }
};

const extractUsageRecord = (response: any, context?: string): UsageRecord | null => {
    if (!response) return null;

    const usage =
        response.usageMetadata ||
        response.response?.usageMetadata ||
        response.result?.usageMetadata ||
        response.candidates?.[0]?.usageMetadata ||
        null;

    if (!usage) return null;

    const promptTokens =
        usage.promptTokenCount ??
        usage.promptTokens ??
        usage.inputTokenCount ??
        0;
    const responseTokens =
        usage.candidatesTokenCount ??
        usage.candidatesTokens ??
        usage.outputTokenCount ??
        usage.outputTokens ??
        0;
    const totalTokens =
        usage.totalTokenCount ??
        promptTokens + responseTokens;

    const model =
        response.model ??
        response.modelVersion ??
        response.response?.modelVersion ??
        response.candidates?.[0]?.modelVersion ??
        'unknown';

    return {
        timestamp: Date.now(),
        model,
        promptTokens,
        responseTokens,
        totalTokens,
        context,
    };
};

export const getApiKeys = (): ApiKeyEntry[] => {
    const store = loadStore();
    return store.keys;
};

export const getActiveApiKeyId = (): string => {
    const store = loadStore();
    return store.activeKeyId || getLegacyMasterKey() || DEFAULT_KEY_ID;
};

export const getActiveApiKeyValue = (): string => {
    const store = loadStore();
    const active = store.keys.find((k) => k.id === store.activeKeyId);
    return active?.value || getLegacyMasterKey() || '';
};

export const setActiveApiKey = (keyId: string) => {
    const store = loadStore();
    const target = store.keys.find((k) => k.id === keyId);
    if (!target) return;
    store.activeKeyId = keyId;
    persistStore(store);
    syncMasterKeyStorage(target.value);
};

export const addApiKey = (value: string, label?: string, options?: { activate?: boolean }): ApiKeyEntry => {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        throw new Error('API 키를 입력해주세요.');
    }

    const activate = options?.activate ?? true;
    const store = loadStore();
    const existing = store.keys.find((k) => k.value === trimmed);
    if (existing) {
        if (activate) {
            store.activeKeyId = existing.id;
            persistStore(store);
            syncMasterKeyStorage(existing.value);
        }
        return existing;
    }

    const entry: ApiKeyEntry = {
        id: trimmed,
        label: (label || '').trim() || `키 ${store.keys.length + 1}`,
        value: trimmed,
        createdAt: Date.now(),
    };

    store.keys = [...store.keys, entry];
    if (activate || store.keys.length === 1) {
        store.activeKeyId = entry.id;
        syncMasterKeyStorage(entry.value);
    }
    ensureSnapshot(store, entry.id);

    persistStore(store);
    return entry;
};

export const recordUsage = (context: string, response: any, apiKeyId?: string): UsageRecord | null => {
    const record = extractUsageRecord(response, context);
    if (!record) return null;

    const store = loadStore();
    const keyId = apiKeyId || store.activeKeyId || DEFAULT_KEY_ID;
    const baseSnapshot = ensureSnapshot(store, keyId);
    const snapshot = { ...baseSnapshot, byModel: { ...baseSnapshot.byModel } };

    snapshot.calls += 1;
    snapshot.totalPromptTokens += record.promptTokens;
    snapshot.totalResponseTokens += record.responseTokens;
    snapshot.totalTokens += record.totalTokens;

    const modelStats = snapshot.byModel[record.model] || { calls: 0, totalTokens: 0 };
    snapshot.byModel[record.model] = {
        calls: modelStats.calls + 1,
        totalTokens: modelStats.totalTokens + record.totalTokens,
    };

    snapshot.last = record;
    store.snapshots[keyId] = snapshot;

    persistStore(store, keyId);
    return record;
};

export const subscribeUsage = (apiKeyId: string, listener: UsageListener): (() => void) => {
    const snapshot = getUsageSnapshot(apiKeyId);
    listener(snapshot);

    if (!listeners[apiKeyId]) {
        listeners[apiKeyId] = new Set<UsageListener>();
    }
    listeners[apiKeyId].add(listener);

    return () => {
        listeners[apiKeyId]?.delete(listener);
    };
};

export const getUsageSnapshot = (apiKeyId?: string): UsageSnapshot => {
    const store = loadStore();
    const keyId = apiKeyId || store.activeKeyId || DEFAULT_KEY_ID;
    return ensureSnapshot(store, keyId);
};

export const resetUsage = (apiKeyId?: string) => {
    const store = loadStore();
    const keyId = apiKeyId || store.activeKeyId || DEFAULT_KEY_ID;
    store.snapshots[keyId] = { ...emptySnapshot, byModel: {} };
    persistStore(store, keyId);
};

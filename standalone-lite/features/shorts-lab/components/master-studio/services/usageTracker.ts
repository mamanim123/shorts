import { getAppStorageCachedValue, primeAppStorageCache, setAppStorageValue } from '../../../services/appStorageService';

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

interface PartialUsageRecord {
    timestamp?: number;
    model?: string;
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
    context?: string;
}

interface PartialUsageSnapshot {
    calls?: number;
    totalPromptTokens?: number;
    totalResponseTokens?: number;
    totalTokens?: number;
    byModel?: Record<string, { calls: number; totalTokens: number }>;
    last?: PartialUsageRecord | null;
}

interface RawUsageStore {
    activeKeyId?: string;
    keys?: ApiKeyEntry[];
    snapshots?: Record<string, PartialUsageSnapshot>;
}

interface UsageMetadataLike {
    promptTokenCount?: number;
    promptTokens?: number;
    inputTokenCount?: number;
    candidatesTokenCount?: number;
    candidatesTokens?: number;
    outputTokenCount?: number;
    outputTokens?: number;
    totalTokenCount?: number;
}

interface UsageResponseLike {
    usageMetadata?: UsageMetadataLike;
    response?: {
        usageMetadata?: UsageMetadataLike;
        modelVersion?: string;
    };
    result?: {
        usageMetadata?: UsageMetadataLike;
    };
    candidates?: Array<{
        usageMetadata?: UsageMetadataLike;
        modelVersion?: string;
    }>;
    model?: string;
    modelVersion?: string;
}

const STORAGE_KEY = 'master_studio_api_usage_v2';
const DEFAULT_KEY_ID = 'default';

primeAppStorageCache();

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

const getLegacyMasterKey = (): string => '';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const normalizeUsageRecord = (record: PartialUsageRecord | null | undefined): UsageRecord | null => {
    if (!record || !isRecord(record)) {
        return null;
    }

    return {
        timestamp: typeof record.timestamp === 'number' ? record.timestamp : Date.now(),
        model: typeof record.model === 'string' ? record.model : 'unknown',
        promptTokens: typeof record.promptTokens === 'number' ? record.promptTokens : 0,
        responseTokens: typeof record.responseTokens === 'number' ? record.responseTokens : 0,
        totalTokens: typeof record.totalTokens === 'number' ? record.totalTokens : 0,
        context: typeof record.context === 'string' ? record.context : undefined,
    };
};

const ensureSnapshot = (store: UsageStore, keyId: string): UsageSnapshot => {
    if (!store.snapshots[keyId]) {
        store.snapshots[keyId] = { ...emptySnapshot };
    }
    return store.snapshots[keyId];
};

const normalizeSnapshot = (snapshot: PartialUsageSnapshot | null | undefined): UsageSnapshot => {
    const byModel = isRecord(snapshot?.byModel)
        ? Object.fromEntries(
              Object.entries(snapshot.byModel).map(([model, stats]) => {
                  const normalizedStats = isRecord(stats)
                      ? {
                            calls: typeof stats.calls === 'number' ? stats.calls : 0,
                            totalTokens: typeof stats.totalTokens === 'number' ? stats.totalTokens : 0,
                        }
                      : { calls: 0, totalTokens: 0 };
                  return [model, normalizedStats];
              }),
          )
        : {};

    return {
        calls: typeof snapshot?.calls === 'number' ? snapshot.calls : 0,
        totalPromptTokens: typeof snapshot?.totalPromptTokens === 'number' ? snapshot.totalPromptTokens : 0,
        totalResponseTokens: typeof snapshot?.totalResponseTokens === 'number' ? snapshot.totalResponseTokens : 0,
        totalTokens: typeof snapshot?.totalTokens === 'number' ? snapshot.totalTokens : 0,
        byModel,
        last: normalizeUsageRecord(snapshot?.last),
    };
};

const normalizeStore = (raw: unknown): UsageStore => {
    const legacyKey = getLegacyMasterKey();
    const defaultEntry: ApiKeyEntry = {
        id: legacyKey || DEFAULT_KEY_ID,
        label: '기본 키',
        value: legacyKey,
        createdAt: Date.now(),
    };

    if (isRecord(raw) && isRecord(raw.snapshots)) {
        const rawStore = raw as RawUsageStore;
        const store: UsageStore = {
            activeKeyId: typeof rawStore.activeKeyId === 'string' ? rawStore.activeKeyId : defaultEntry.id,
            keys: Array.isArray(rawStore.keys) && rawStore.keys.length > 0 ? rawStore.keys : [defaultEntry],
            snapshots: {},
        };

        Object.entries(rawStore.snapshots ?? {}).forEach(([key, snapshot]) => {
            store.snapshots[key] = normalizeSnapshot(snapshot);
        });

        store.keys.forEach((key) => ensureSnapshot(store, key.id));
        return store;
    }

    const store: UsageStore = {
        activeKeyId: defaultEntry.id,
        keys: [defaultEntry],
        snapshots: {},
    };

    if (isRecord(raw) && Object.prototype.hasOwnProperty.call(raw, 'calls')) {
        store.snapshots[defaultEntry.id] = normalizeSnapshot(raw as PartialUsageSnapshot);
    } else {
        store.snapshots[defaultEntry.id] = { ...emptySnapshot };
    }

    return store;
};

const loadStore = (): UsageStore => {
    if (typeof window === 'undefined') {
        return memoryStore;
    }

    const stored = getAppStorageCachedValue<unknown | null>(STORAGE_KEY, null);
    const store = normalizeStore(stored);
    memoryStore = store;

    if (!stored) {
        persistStore(store);
    }

    return store;
};

const persistStore = (store: UsageStore, notifyKeyId?: string): void => {
    memoryStore = store;
    const sanitized: UsageStore = {
        ...store,
        keys: store.keys.map((key) => ({
            ...key,
            value: '',
        })),
    };

    void setAppStorageValue(STORAGE_KEY, sanitized).catch(() => {
        // Ignore failures; keep in memory.
    });

    if (notifyKeyId) {
        const snapshot = store.snapshots[notifyKeyId];
        const targetListeners = listeners[notifyKeyId];
        if (snapshot && targetListeners) {
            targetListeners.forEach((listener) => listener(snapshot));
        }
    }
};

const syncMasterKeyStorage = (_value: string): void => {
    // API 키는 .env 또는 세션 메모리에서만 관리한다.
};

const asUsageResponse = (response: unknown): UsageResponseLike | null => {
    return isRecord(response) ? (response as UsageResponseLike) : null;
};

const extractUsageRecord = (response: unknown, context?: string): UsageRecord | null => {
    const usageResponse = asUsageResponse(response);
    if (!usageResponse) {
        return null;
    }

    const usage =
        usageResponse.usageMetadata ??
        usageResponse.response?.usageMetadata ??
        usageResponse.result?.usageMetadata ??
        usageResponse.candidates?.[0]?.usageMetadata ??
        null;

    if (!usage) {
        return null;
    }

    const promptTokens = usage.promptTokenCount ?? usage.promptTokens ?? usage.inputTokenCount ?? 0;
    const responseTokens = usage.candidatesTokenCount ?? usage.candidatesTokens ?? usage.outputTokenCount ?? usage.outputTokens ?? 0;
    const totalTokens = usage.totalTokenCount ?? promptTokens + responseTokens;
    const model =
        usageResponse.model ??
        usageResponse.modelVersion ??
        usageResponse.response?.modelVersion ??
        usageResponse.candidates?.[0]?.modelVersion ??
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
    const active = store.keys.find((key) => key.id === store.activeKeyId);
    return active?.value || getLegacyMasterKey() || '';
};

export const setActiveApiKey = (keyId: string): void => {
    const store = loadStore();
    const target = store.keys.find((key) => key.id === keyId);
    if (!target) {
        return;
    }

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
    const existing = store.keys.find((key) => key.value === trimmed);
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

export const recordUsage = (context: string, response: unknown, apiKeyId?: string): UsageRecord | null => {
    const record = extractUsageRecord(response, context);
    if (!record) {
        return null;
    }

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

export const resetUsage = (apiKeyId?: string): void => {
    const store = loadStore();
    const keyId = apiKeyId || store.activeKeyId || DEFAULT_KEY_ID;
    store.snapshots[keyId] = { ...emptySnapshot, byModel: {} };
    persistStore(store, keyId);
};

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Activity, RefreshCw, Plus, KeyRound, X, Check } from 'lucide-react';
import {
    addApiKey,
    getActiveApiKeyId,
    getApiKeys,
    getUsageSnapshot,
    resetUsage,
    setActiveApiKey,
    subscribeUsage,
    UsageSnapshot,
} from './services/usageTracker';

const UsageWidget: React.FC = () => {
    const [snapshot, setSnapshot] = useState<UsageSnapshot>(() => getUsageSnapshot());
    const [selectedKeyId, setSelectedKeyId] = useState<string>(() => getActiveApiKeyId());
    const [keys, setKeys] = useState(() => getApiKeys());
    const [newKey, setNewKey] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const keyInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeUsage(selectedKeyId, setSnapshot);
        return unsubscribe;
    }, [selectedKeyId]);

    useEffect(() => {
        refreshKeys();
    }, []);

    const topModels = useMemo(() => {
        return Object.entries(snapshot.byModel || {})
            .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
            .slice(0, 2);
    }, [snapshot.byModel]);

    const last = snapshot.last;

    const refreshKeys = () => {
        const list = getApiKeys();
        setKeys(list);
        if (!list.find((k) => k.id === selectedKeyId) && list[0]) {
            handleSelectKey(list[0].id);
        }
    };

    const handleSelectKey = (keyId: string) => {
        setActiveApiKey(keyId);
        setSelectedKeyId(keyId);
        setSnapshot(getUsageSnapshot(keyId));
    };

    const handleAddKey = () => {
        try {
            const entry = addApiKey(newKey, newLabel);
            setNewKey('');
            setNewLabel('');
            setError(null);
            refreshKeys();
            handleSelectKey(entry.id);
        } catch (e: any) {
            setError(e?.message || '키를 추가할 수 없습니다.');
        }
    };

    const maskKey = (value: string) => {
        if (!value) return '키 없음';
        if (value.length <= 8) return value;
        return `${value.slice(0, 4)}...${value.slice(-4)}`;
    };

    const getDisplayName = (entry: { label?: string; value: string }) => {
        return entry.label?.trim() || maskKey(entry.value);
    };

    return (
        <div className="w-full bg-slate-900/70 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md p-4 text-white space-y-3 relative">
            <div
                className="flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 rounded-lg px-2 py-1 transition-colors"
                onClick={() => {
                    setModalOpen(true);
                    setError(null);
                    refreshKeys();
                    setTimeout(() => keyInputRef.current?.focus(), 0);
                }}
            >
                <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-300" />
                    <div className="flex flex-col leading-tight">
                        <span className="text-xs font-semibold">기본 키 관리</span>
                        <span className="text-[11px] text-gray-300">
                            {getDisplayName(keys.find((k) => k.id === selectedKeyId) || { value: '' })}
                        </span>
                    </div>
                </div>
                <span className="text-[11px] text-emerald-200">변경 / 추가</span>
            </div>

            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-300" />
                    <span className="text-sm font-semibold">API 사용량</span>
                </div>
                <button
                    onClick={() => resetUsage(selectedKeyId)}
                    className="flex items-center gap-1 text-[11px] text-emerald-200 hover:text-white transition-colors"
                >
                    <RefreshCw className="w-3 h-3" />
                    리셋
                </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-200">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <div className="text-gray-400 mb-1">총 호출</div>
                    <div className="text-lg font-semibold">{snapshot.calls}회</div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                    <div className="text-gray-400 mb-1">총 토큰</div>
                    <div className="text-lg font-semibold">{snapshot.totalTokens.toLocaleString()} tok</div>
                </div>
            </div>

            {topModels.length > 0 && (
                <div className="mt-3 text-[11px]">
                    <div className="text-xs font-semibold text-white mb-1">모델별 상위</div>
                    <div className="space-y-1">
                        {topModels.map(([model, stats]) => (
                            <div key={model} className="flex justify-between bg-white/5 rounded-lg px-2 py-1">
                                <span className="text-gray-200 truncate">{model}</span>
                                <span className="text-gray-300">
                                    {stats.totalTokens.toLocaleString()} tok / {stats.calls}회
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-3 text-[11px]">
                {last ? (
                    <>
                        <div className="flex justify-between items-center">
                            <span className="font-semibold">{last.context || '최근 호출'}</span>
                            <span className="text-gray-400">{new Date(last.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-gray-300 mt-1">모델: <span className="text-white">{last.model}</span></div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="bg-black/30 rounded-lg px-2 py-1 text-center">
                                <div className="text-gray-300">입력</div>
                                <div className="text-sm font-semibold">{last.promptTokens.toLocaleString()}</div>
                            </div>
                            <div className="bg-black/30 rounded-lg px-2 py-1 text-center">
                                <div className="text-gray-300">출력</div>
                                <div className="text-sm font-semibold">{last.responseTokens.toLocaleString()}</div>
                            </div>
                            <div className="bg-black/30 rounded-lg px-2 py-1 text-center">
                                <div className="text-gray-300">합계</div>
                                <div className="text-sm font-semibold text-emerald-200">{last.totalTokens.toLocaleString()}</div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-gray-300">아직 기록이 없습니다. 생성 요청 후 자동으로 표시됩니다.</div>
                )}
            </div>

            <p className="mt-2 text-[10px] text-gray-400">로컬에 저장된 추정치입니다. 세션별 비용 추적용으로 확인하세요.</p>

            {modalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <KeyRound className="w-4 h-4 text-emerald-300" />
                                <span className="text-sm font-semibold">API 키 설정</span>
                            </div>
                            <button
                                className="p-1 rounded-lg hover:bg-white/10"
                                onClick={() => setModalOpen(false)}
                            >
                                <X className="w-4 h-4 text-gray-300" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-2">
                                <input
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    placeholder="라벨 (선택)"
                                    className="w-full text-[12px] bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                                />
                                <input
                                    ref={keyInputRef}
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    placeholder="API 키 입력"
                                    className="w-full text-[12px] bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddKey}
                                    className="flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-[12px] hover:bg-emerald-500 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    추가
                                </button>
                            </div>
                            {error && <div className="text-[11px] text-red-300">{error}</div>}
                        </div>

                        <div className="space-y-2">
                            <div className="text-[12px] text-gray-300">등록된 키</div>
                            <div className="max-h-60 overflow-auto space-y-2 pr-1">
                                {keys.map((entry) => {
                                    const isActive = selectedKeyId === entry.id;
                                    return (
                                        <button
                                            key={entry.id}
                                            onClick={() => {
                                                handleSelectKey(entry.id);
                                                setModalOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                                                isActive
                                                    ? 'bg-emerald-600/80 border-emerald-400 text-white'
                                                    : 'bg-black/30 border-white/10 text-gray-200 hover:border-emerald-400 hover:text-white'
                                            }`}
                                            title={entry.value}
                                        >
                                            <div>
                                                <div className="text-[12px] font-semibold">{getDisplayName(entry)}</div>
                                                <div className="text-[11px] text-gray-400">{maskKey(entry.value)}</div>
                                            </div>
                                            {isActive && <Check className="w-4 h-4 text-white" />}
                                        </button>
                                    );
                                })}
                                {keys.length === 0 && (
                                    <div className="text-[11px] text-gray-400 px-1">키를 추가해주세요.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsageWidget;

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Crown, Sparkles, Power, Save, RotateCcw, Pencil } from 'lucide-react';
import { UserInput } from '../types';
import { EngineOption, loadEngineOptions, saveEngineOptions } from '../services/enginePromptStore';
import { showToast } from './Toast';

interface EngineSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    engineVersion: UserInput['engineVersion'];
    onSelect: (engine: UserInput['engineVersion']) => void;
    prompts: Record<UserInput['engineVersion'], string>;
    onPromptChange: (engine: UserInput['engineVersion'], prompt: string) => void;
    onPromptReset: (engine: UserInput['engineVersion']) => void;
    options: EngineOption[];
    onOptionsChange: (options: EngineOption[]) => void;
}

// defaultOptions removed, using props

export const EngineSettingsModal: React.FC<EngineSettingsModalProps> = ({
    isOpen,
    onClose,
    engineVersion,
    onSelect,
    prompts,
    onPromptChange,
    onPromptReset,
    options,
    onOptionsChange,
}) => {
    if (!isOpen) return null;

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [editingEngineId, setEditingEngineId] = useState<UserInput['engineVersion'] | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [draggingEngineId, setDraggingEngineId] = useState<UserInput['engineVersion'] | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        // Ignore drag starts from form controls
        const target = e.target as HTMLElement;
        if (target.closest('textarea') || target.closest('input') || target.closest('button')) return;
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    useEffect(() => {
        if (isOpen) {
            setPosition({ x: 0, y: 0 });
            setIsDragging(false);
            setDragOffset({ x: 0, y: 0 });
            setEditingEngineId(null);
            setEditTitle('');
            setEditDesc('');
            setDraggingEngineId(null);
        }
    }, [isOpen]);

    const currentPrompt = prompts[engineVersion] || '';

    const persistOptions = (list: EngineOption[]) => {
        onOptionsChange(list);
        saveEngineOptions(list);
    };

    const handleAddEngine = () => {
        if (!newTitle.trim()) {
            showToast('엔진 이름을 입력하세요.', 'warning');
            return;
        }
        const id = `CUSTOM_${Date.now()}`;
        const newOpt: EngineOption = {
            id,
            title: newTitle.trim(),
            desc: newDesc.trim() || '사용자 정의 엔진',
            iconType: 'custom',
            badge: 'Custom',
        };
        const next = [...options, newOpt];
        persistOptions(next);
        setNewTitle('');
        setNewDesc('');
        onSelect(id);
        onPromptChange(id, '');
        showToast('엔진이 추가되었습니다.', 'success');
    };

    const handleDeleteEngine = (id: UserInput['engineVersion']) => {
        // 보호: 기본 엔진은 삭제 불가
        if (id === 'V3' || id === 'V3_COSTAR' || id === 'NONE') return;
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const next = options.filter((opt) => opt.id !== id);
        persistOptions(next);
        if (engineVersion === id) {
            onSelect('V3');
        }
        showToast('엔진이 삭제되었습니다.', 'success');
    };

    const handleStartEditEngine = (opt: EngineOption) => {
        if (opt.id === 'V3' || opt.id === 'V3_COSTAR' || opt.id === 'NONE') {
            showToast('기본 엔진은 이름을 수정할 수 없습니다.', 'info');
            return;
        }
        setEditingEngineId(opt.id);
        setEditTitle(opt.title);
        setEditDesc(opt.desc);
    };

    const handleSaveEditedEngine = () => {
        if (!editingEngineId) return;
        if (!editTitle.trim()) {
            showToast('엔진 이름을 입력하세요.', 'warning');
            return;
        }
        const next = options.map((opt) =>
            opt.id === editingEngineId
                ? { ...opt, title: editTitle.trim(), desc: editDesc.trim() || '사용자 정의 엔진' }
                : opt
        );
        persistOptions(next);
        showToast('엔진 정보가 수정되었습니다.', 'success');
        setEditingEngineId(null);
        setEditTitle('');
        setEditDesc('');
    };

    const handleCancelEditEngine = () => {
        setEditingEngineId(null);
        setEditTitle('');
        setEditDesc('');
    };

    const handleDragStartEngine = (id: UserInput['engineVersion']) => {
        setDraggingEngineId(id);
    };

    const handleDragEndEngine = () => {
        setDraggingEngineId(null);
    };

    const handleDropEngine = (targetId: UserInput['engineVersion']) => {
        if (!draggingEngineId || draggingEngineId === targetId) return;
        const list = [...options];
        const fromIdx = list.findIndex(opt => opt.id === draggingEngineId);
        const toIdx = list.findIndex(opt => opt.id === targetId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        persistOptions(list);
        setDraggingEngineId(targetId);
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 text-white rounded-2xl border border-white/10 shadow-2xl p-6 flex flex-col"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    cursor: isDragging ? 'grabbing' : 'default',
                    userSelect: isDragging ? 'none' : 'auto',
                }}
                onMouseDown={handleMouseDown}
            >
                <div
                    className="flex items-center justify-between cursor-move select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div>
                        <h2 className="text-lg font-bold">엔진 설정</h2>
                        <p className="text-sm text-gray-400">럭셔리 엔진 / CO-STAR 모드를 손쉽게 전환하고, 시스템 프롬프트를 직접 편집하세요.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-4 h-4 text-gray-300" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5">
                    {options.map((opt) => {
                        const active = engineVersion === opt.id;
                        const renderIcon = () => {
                            switch (opt.iconType) {
                                case 'crown': return <Crown className="w-3 h-3 text-yellow-200" />;
                                case 'power': return <Power className="w-3 h-3 text-rose-200" />;
                                case 'custom': return <Sparkles className="w-3 h-3 text-emerald-200" />;
                                default: return <Sparkles className="w-3 h-3 text-cyan-200" />;
                            }
                        };
                        return (
                            <button
                                key={opt.id}
                                onClick={() => onSelect(opt.id)}

                                draggable
                                onDragStart={() => handleDragStartEngine(opt.id)}
                                onDragEnd={handleDragEndEngine}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    if (draggingEngineId && draggingEngineId !== opt.id) {
                                        handleDropEngine(opt.id);
                                    }
                                }}
                                className={`text-left rounded-md border p-2 transition-all h-full flex flex-col gap-1 ${active
                                    ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/20'
                                    : 'border-white/10 bg-white/5 hover:border-emerald-300/70 hover:bg-emerald-500/5'
                                    } ${draggingEngineId === opt.id ? 'opacity-70 ring-2 ring-emerald-400' : ''}`}
                            >
                                <div className="flex items-center justify-between gap-0.5">
                                    <div className="flex items-center gap-1">
                                        {renderIcon()}
                                        <span className="text-[11px] font-semibold truncate">{opt.title}</span>
                                    </div>
                                    <span className={`text-[9px] px-1 py-0.5 rounded-full ${active ? 'bg-emerald-400 text-emerald-900' : 'bg-white/10 text-gray-200'}`}>
                                        {opt.badge}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-300 leading-snug line-clamp-2 min-h-[28px]">{opt.desc}</p>
                                <div className="flex items-center justify-between text-[9px] gap-1">
                                    {active && <span className="text-emerald-200">선택됨</span>}
                                    {!(opt.id === 'V3' || opt.id === 'V3_COSTAR' || opt.id === 'NONE') && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleStartEditEngine(opt); }}
                                                className="text-emerald-200 hover:text-emerald-100 flex items-center gap-0.5"
                                            >
                                                <Pencil className="w-3 h-3" />
                                                수정
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteEngine(opt.id); }}
                                                className="text-red-300 hover:text-red-100"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                    </div>

                    {editingEngineId && (
                    <div className="p-3 rounded-xl bg-black/30 border border-emerald-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">엔진 정보 수정</p>
                            <span className="text-xs text-emerald-200">{editingEngineId}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="엔진 이름"
                                className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                            />
                            <input
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                placeholder="설명"
                                className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={handleCancelEditEngine}
                                className="px-3 py-2 rounded-lg bg-white/10 text-xs hover:bg-white/20 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveEditedEngine}
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 transition-colors"
                            >
                                변경 사항 저장
                            </button>
                        </div>
                    </div>
                    )}

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <p className="text-sm font-semibold">커스텀 엔진 추가</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="엔진 이름 (예: 테스트 엔진)"
                            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                        />
                        <input
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            placeholder="설명 (선택)"
                            className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400"
                        />
                    </div>
                    <button
                        onClick={handleAddEngine}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors"
                    >
                        엔진 추가
                    </button>
                    </div>

                    <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold">선택한 엔진 프롬프트 편집</p>
                            <p className="text-xs text-gray-400">필요한 부분만 수정하고 저장하세요. (로컬에만 저장)</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onPromptReset(engineVersion)}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 text-xs hover:bg-white/20 transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" />
                                기본값 복원
                            </button>
                            <button
                                onClick={() => {
                                    onPromptChange(engineVersion, currentPrompt);
                                    showToast('엔진 프롬프트가 저장되었습니다.', 'success');
                                }}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs hover:bg-emerald-500 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                저장
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={currentPrompt}
                        onChange={(e) => onPromptChange(engineVersion, e.target.value)}
                        className="w-full h-[360px] text-sm bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-400 font-mono"
                        spellCheck={false}
                    />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-white/10 text-sm hover:bg-white/20 transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return modalContent;
    return createPortal(modalContent, document.body);
};

export default EngineSettingsModal;

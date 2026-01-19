
import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react';
import { TemplateItem, useTemplateManager } from '../hooks/useTemplateManager';
import { showToast } from './Toast';

interface TemplateEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    manager: ReturnType<typeof useTemplateManager>;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({ isOpen, onClose, manager }) => {
    const [activeTab, setActiveTab] = useState<'genre' | 'tone'>('genre');
    const [editingItem, setEditingItem] = useState<TemplateItem | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);

    // Form state
    const [formLabel, setFormLabel] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formPrompt, setFormPrompt] = useState('');

    // Draggable state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
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

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    if (!isOpen) return null;
    // Safety check: ensure manager exists before rendering
    if (!manager) {
        console.error("TemplateEditorModal: manager prop is missing!");
        return null;
    }

    const items = activeTab === 'genre' ? manager.genres : manager.tones;

    const startEdit = (item: TemplateItem) => {
        setEditingItem(item);
        setFormLabel(item.label);
        setFormDescription(item.description || '');
        setFormPrompt(item.prompt);
        setIsAdding(false);
    };

    const startAdd = () => {
        setEditingItem(null);
        setFormLabel('');
        setFormDescription('');
        setFormPrompt('');
        setIsAdding(true);
    };

    const handleDragStartItem = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOverItem = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDropItem = async (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        if (dragIndex === null || dragIndex === index) {
            setDragIndex(null);
            return;
        }
        if (activeTab === 'genre') {
            await manager.reorderGenres(dragIndex, index);
        } else {
            await manager.reorderTones(dragIndex, index);
        }
        setDragIndex(null);
    };

    const handleDragEndItem = () => {
        setDragIndex(null);
    };

    const handleSave = async () => {
        if (!formLabel.trim()) {
            showToast('이름을 입력해주세요.', 'warning');
            return;
        }

        const newItem: TemplateItem = {
            id: editingItem ? editingItem.id : Date.now().toString(),
            label: formLabel,
            description: formDescription,
            prompt: formPrompt
        };

        if (activeTab === 'genre') {
            if (isAdding) await manager.addGenre(newItem);
            else await manager.updateGenre(newItem.id, newItem);
        } else {
            if (isAdding) await manager.addTone(newItem);
            else await manager.updateTone(newItem.id, newItem);
        }

        setEditingItem(null);
        setIsAdding(false);
        showToast('템플릿이 저장되었습니다.', 'success');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        if (activeTab === 'genre') await manager.deleteGenre(id);
        else await manager.deleteTone(id);
        showToast('템플릿이 삭제되었습니다.', 'success');
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center"
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-xl w-[95%] max-w-[900px] h-[85vh] flex flex-col shadow-2xl"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                {/* Header (Draggable Handle) */}
                <div
                    onMouseDown={handleMouseDown}
                    className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center cursor-move bg-gray-50 dark:bg-gray-800 rounded-t-xl"
                >
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">템플릿 에디터</h2>
                    <button
                        onClick={onClose}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => { setActiveTab('genre'); setEditingItem(null); setIsAdding(false); }}
                        className={`flex-1 p-3 font-semibold transition-colors ${activeTab === 'genre'
                            ? 'border-b-2 border-purple-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                    >
                        장르 (Genre)
                    </button>
                    <button
                        onClick={() => { setActiveTab('tone'); setEditingItem(null); setIsAdding(false); }}
                        className={`flex-1 p-3 font-semibold transition-colors ${activeTab === 'tone'
                            ? 'border-b-2 border-purple-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                    >
                        톤앤매너 (Tone)
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 bg-white dark:bg-gray-900">
                    {!isAdding && !editingItem ? (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={startAdd}
                                className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 font-bold hover:border-purple-500 dark:hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                            >
                                <Plus size={20} /> 새 템플릿 추가
                            </button>

                            {items.map((item, index) => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleDragStartItem(e, index)}
                                    onDragOver={handleDragOverItem}
                                    onDrop={(e) => handleDropItem(e, index)}
                                    onDragEnd={handleDragEndItem}
                                    onClick={() => {
                                        if (dragIndex !== null) return;
                                        startEdit(item);
                                    }}
                                    className={`flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${dragIndex === index ? 'opacity-60 border-purple-400' : ''
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-900 dark:text-white">{item.label}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {item.description || item.prompt.substring(0, 50) + '...'}
                                        </div>
                                    </div>
                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => startEdit(item)}
                                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 h-full">
                            <div>
                                <label className="block mb-2 font-bold text-gray-900 dark:text-white">템플릿 이름 (버튼명)</label>
                                <input
                                    type="text"
                                    value={formLabel}
                                    onChange={e => setFormLabel(e.target.value)}
                                    placeholder="예: 막장 드라마"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block mb-2 font-bold text-gray-900 dark:text-white">설명 (리스트 노출용)</label>
                                <input
                                    type="text"
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="예: 막장 드라마 스타일의 자극적인 이야기"
                                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                                />
                            </div>
                            <div className="flex-1 flex flex-col">
                                <label className="block mb-2 font-bold text-gray-900 dark:text-white">프롬프트 (AI 지침)</label>
                                <textarea
                                    value={formPrompt}
                                    onChange={e => setFormPrompt(e.target.value)}
                                    placeholder="AI에게 전달될 구체적인 지시사항을 적어주세요."
                                    className="w-full flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none font-mono text-sm leading-relaxed bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                                />
                            </div>
                            <div className="flex gap-3 mt-3">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white border-none rounded-lg font-bold flex justify-center items-center gap-2 transition-colors"
                                >
                                    <Save size={18} /> 저장하기
                                </button>
                                <button
                                    onClick={() => { setEditingItem(null); setIsAdding(false); }}
                                    className="flex-1 p-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-none rounded-lg font-bold transition-colors"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

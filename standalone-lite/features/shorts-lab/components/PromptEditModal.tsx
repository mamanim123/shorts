/**
 * PromptEditModal.tsx
 * 프롬프트 수정 모달 UI 컴포넌트
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { renderHighlightedByElement, PromptLegend, ElementAnalysis, getProblemExplanation } from '../utils/promptHighlightSystem';
import { buildApiUrl } from '../../../lib/api';

const STYLE_PRESETS = [
    { id: 'pixar', name: '픽사 스타일', emoji: '🎬', description: '3D 애니메이션' },
    { id: 'photo', name: '포토리얼리스틱', emoji: '📷', description: '실사 사진' },
    { id: 'anime', name: '애니메이션', emoji: '🎨', description: '애니메이션' },
    { id: 'oil_painting', name: '유화', emoji: '🖼️', description: '유화 스타일' },
    { id: 'cyberpunk', name: '사이버펑크', emoji: '🌃', description: '미래적' },
    { id: 'vintage', name: '빈티지', emoji: '📷', description: '복고풍' }
];

// Style recommendations mapping (Zinius-style orange stars)
const STYLE_RECOMMENDATIONS: Record<string, {
    camera?: string[];
    composition?: string[];
    lighting?: string[];
    description?: string;
}> = {
    pixar: {
        camera: ['close-up', 'medium shot', '3/4 view'],
        composition: ['rule of thirds', 'centered', 'dynamic'],
        lighting: ['soft lighting', 'rim light', 'warm tones'],
        description: '3D 애니메이션에 최적화된 구도와 조명'
    },
    photo: {
        camera: ['85mm lens', 'f/1.8', 'bokeh', 'portrait'],
        composition: ['shallow depth of field', 'natural framing'],
        lighting: ['natural light', 'golden hour', 'soft shadows'],
        description: '실사 사진 스타일 - 자연스러운 조명과 렌즈 설정'
    },
    anime: {
        camera: ['wide angle', 'dynamic angle', 'low angle'],
        composition: ['diagonal', 'asymmetrical', 'action lines'],
        lighting: ['high contrast', 'cel shading', 'vivid colors'],
        description: '애니메이션 스타일 - 강한 대비와 역동적인 구도'
    },
    oil_painting: {
        camera: ['soft focus', 'textured'],
        composition: ['classical', 'balanced', 'layered'],
        lighting: ['chiaroscuro', 'dramatic lighting', 'rich shadows'],
        description: '유화 스타일 - 클래식한 구도와 극적인 명암'
    },
    cyberpunk: {
        camera: ['neon reflections', 'wide angle', 'fisheye'],
        composition: ['vertical lines', 'layered depth', 'holographic'],
        lighting: ['neon lights', 'blue and pink', 'high contrast', 'glowing'],
        description: '사이버펑크 - 네온 조명과 미래적 구도'
    },
    vintage: {
        camera: ['film grain', '35mm', 'soft focus'],
        composition: ['nostalgic', 'warm tones', 'classic framing'],
        lighting: ['warm sunlight', 'soft glow', 'sepia tones'],
        description: '빈티지 - 필름 감성의 따뜻한 색감'
    }
};

export interface ProblemDetail {
    type: '중복' | '모순' | '불명확' | '정책위반';
    original: string;
    issue: string;
    fix: string;
    corrected: string;
}

export interface DetailedAnalysis {
    style?: string[];
    lighting?: string[];
    camera?: string[];
    composition?: string[];
    character?: string[];
    background?: string[];
    score?: number;
    problems?: ProblemDetail[];
    correctedPrompt?: string;
    suggestions?: string[];
}

// Chat message interface
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
}

// Simple word-level diff function
const computeDiff = (oldText: string, newText: string): Array<{type: 'unchanged' | 'added' | 'removed', text: string}> => {
    const oldWords = oldText.split(/(\s+)/);
    const newWords = newText.split(/(\s+)/);
    const result: Array<{type: 'unchanged' | 'added' | 'removed', text: string}> = [];
    
    let i = 0, j = 0;
    while (i < oldWords.length || j < newWords.length) {
        if (i >= oldWords.length) {
            result.push({ type: 'added', text: newWords[j] });
            j++;
        } else if (j >= newWords.length) {
            result.push({ type: 'removed', text: oldWords[i] });
            i++;
        } else if (oldWords[i] === newWords[j]) {
            result.push({ type: 'unchanged', text: oldWords[i] });
            i++;
            j++;
        } else {
            // Check if this word appears later in newWords
            const foundInNew = newWords.slice(j).indexOf(oldWords[i]);
            const foundInOld = oldWords.slice(i).indexOf(newWords[j]);
            
            if (foundInNew === -1 || (foundInOld !== -1 && foundInOld < foundInNew)) {
                result.push({ type: 'removed', text: oldWords[i] });
                i++;
            } else {
                result.push({ type: 'added', text: newWords[j] });
                j++;
            }
        }
    }
    
    return result;
};

interface PromptEditModalProps {
    isOpen: boolean;
    sceneNumber: number | null;
    originalPrompt: string;
    editingPrompt: string;
    isLoading: boolean;
    loadingType?: 'element' | 'detailed' | 'style' | null;
    error: string | null;
    elementAnalysis: ElementAnalysis;
    detailedAnalysis?: DetailedAnalysis | null;
    analysisBasePrompt?: string;
    onClose: () => void;
    onOriginalChange?: (text: string) => void;
    onEditingChange: (text: string) => void;
    onAnalyze: () => void;
    onDetailedAnalyze?: (model?: string) => void;
    onApplyStyle?: (styleId: string, model?: string) => void;
    onApply?: () => void;
    onGenerateImage?: () => void;
    onAiGenerate?: () => void;
    onReset?: () => void;
}

export const PromptEditModal: React.FC<PromptEditModalProps> = ({
    isOpen,
    sceneNumber,
    originalPrompt,
    editingPrompt,
    isLoading,
    loadingType,
    error,
    elementAnalysis,
    detailedAnalysis,
    analysisBasePrompt,
    onClose,
    onOriginalChange,
    onEditingChange,
    onAnalyze,
    onDetailedAnalyze,
    onApplyStyle,
    onApply,
    onGenerateImage,
    onAiGenerate,
    onReset
}) => {
    console.log('🚀 [PromptEditModal] Component Called - isOpen:', isOpen, 'sceneNumber:', sceneNumber);
    console.log('📊 [PromptEditModal] Props:', {
        hasElementAnalysis: Object.keys(elementAnalysis || {}).length > 0,
        hasDetailedAnalysis: !!detailedAnalysis,
        originalPromptLength: originalPrompt?.length || 0,
        editingPromptLength: editingPrompt?.length || 0
    });

    // State for selected style recommendations
    const [selectedStyle, setSelectedStyle] = React.useState<string | null>(null);

    // State for Gemini Model selection and usage stats
    const [selectedModel, setSelectedModel] = React.useState('gemini-2.0-flash');
    const [usageStats, setUsageStats] = React.useState<Record<string, number>>({});
    const MODEL_OPTIONS = [
        { id: 'gemini-3-flash-preview', label: '3 Flash', accent: 'purple' },
        { id: 'gemini-3-pro-preview', label: '3 Pro', accent: 'fuchsia' },
        { id: 'gemini-2.5-flash', label: '2.5 Flash', accent: 'sky' },
        { id: 'gemini-2.0-flash', label: '2.0 Flash', accent: 'emerald' }
    ];

    const fetchUsageStats = async () => {
        try {
            const response = await fetch(buildApiUrl('/api/usage-stats'));
            if (response.ok) {
                const data = await response.json();
                setUsageStats(data);
            }
        } catch (e) {
            console.error('Failed to fetch usage stats:', e);
        }
    };

    React.useEffect(() => {
        if (isOpen) {
            fetchUsageStats();
        }
    }, [isOpen]);

    // Refresh usage stats when loading finishes
    React.useEffect(() => {
        if (!isLoading && isOpen) {
            fetchUsageStats();
        }
    }, [isLoading, isOpen]);

    // State for Zinius Chat
    const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = React.useState('');
    const [isChatLoading, setIsChatLoading] = React.useState(false);
    const [showChat, setShowChat] = React.useState(false);
    const chatInputRef = React.useRef<HTMLInputElement>(null);
    const modalRef = React.useRef<HTMLDivElement>(null);
    const [modalPosition, setModalPosition] = React.useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = React.useState(false);
    const dragOffsetRef = React.useRef({ x: 0, y: 0 });

    React.useEffect(() => {
        if (!isOpen) return;
        const rect = modalRef.current?.getBoundingClientRect();
        const width = rect?.width || 640;
        const height = rect?.height || 480;
        const left = Math.max(16, (window.innerWidth - width) / 2);
        const top = Math.max(16, (window.innerHeight - height) / 2);
        setModalPosition({ x: left, y: top });
    }, [isOpen]);

    React.useEffect(() => {
        if (!isDragging) return;
        const handleMove = (event: PointerEvent) => {
            const rect = modalRef.current?.getBoundingClientRect();
            const width = rect?.width || 640;
            const height = rect?.height || 480;
            const nextX = event.clientX - dragOffsetRef.current.x;
            const nextY = event.clientY - dragOffsetRef.current.y;
            const maxX = Math.max(16, window.innerWidth - width - 16);
            const maxY = Math.max(16, window.innerHeight - height - 16);
            const clampedX = Math.min(Math.max(16, nextX), maxX);
            const clampedY = Math.min(Math.max(16, nextY), maxY);
            setModalPosition({ x: clampedX, y: clampedY });
        };
        const handleUp = () => {
            setIsDragging(false);
        };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [isDragging]);

    const [selectedProblemIndices, setSelectedProblemIndices] = React.useState<number[]>([]);
    const [showEditHighlight, setShowEditHighlight] = React.useState(false);

    React.useEffect(() => {
        setSelectedProblemIndices([]);
    }, [detailedAnalysis]);

    const toggleProblemSelection = (index: number) => {
        setSelectedProblemIndices((prev) =>
            prev.includes(index) ? prev.filter((id) => id !== index) : [...prev, index]
        );
    };

    const selectionBasePrompt = (analysisBasePrompt && analysisBasePrompt.trim()) ? analysisBasePrompt : editingPrompt;

    const buildPreviewPrompt = () => {
        if (!detailedAnalysis?.problems?.length) return { text: editingPrompt, applied: 0 };
        if (selectedProblemIndices.length === 0) return { text: editingPrompt, applied: 0 };
        let updated = selectionBasePrompt;
        let applied = 0;
        selectedProblemIndices.forEach((index) => {
            const problem = detailedAnalysis.problems?.[index];
            if (!problem?.original || !problem?.corrected) return;
            const escaped = problem.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = updated.match(new RegExp(escaped, 'gi'));
            if (match) {
                applied += match.length;
            }
            updated = updated.replace(new RegExp(escaped, 'gi'), problem.corrected);
        });
        return { text: updated, applied };
    };

    const previewResult = React.useMemo(
        () => buildPreviewPrompt(),
        [editingPrompt, selectionBasePrompt, detailedAnalysis, selectedProblemIndices]
    );
    const previewPrompt = previewResult.text;
    const previewAppliedCount = previewResult.applied;

    const applySelectedProblemFixes = () => {
        if (selectedProblemIndices.length === 0) return;
        onEditingChange(previewPrompt);
    };

    const simplifyProblemType = (type?: string) => {
        switch (type) {
            case '중복':
                return '같은 말이 두 번 나왔어요. 하나만 남겨요.';
            case '모순':
                return '서로 다른 말이 충돌해요. 하나만 선택해요.';
            case '불명확':
                return '말이 애매해요. 더 자세히 써요.';
            case '정책위반':
                return '규칙에 맞지 않아요. 안전한 말로 바꿔요.';
            default:
                return '문장이 헷갈려요. 더 간단하고 정확하게 써요.';
        }
    };

    const buildSimpleTips = () => {
        const tips: Array<{ title: string; fix?: string; reason?: string }> = [];
        if (detailedAnalysis?.problems?.length) {
            detailedAnalysis.problems.forEach((problem, index) => {
                tips.push({
                    title: `${index + 1}. ${problem.type || '문제'}: ${problem.original || '표현'}`,
                    reason: simplifyProblemType(problem.type),
                    fix: problem.corrected || problem.fix
                });
            });
        } else if (elementAnalysis?.problems?.length) {
            elementAnalysis.problems.forEach((problem, index) => {
                tips.push({
                    title: `${index + 1}. ${problem}`,
                    reason: getProblemExplanation(problem),
                    fix: simplifyProblemType(problem.includes('중복') ? '중복' : problem.includes('모순') ? '모순' : problem.includes('불명확') ? '불명확' : undefined)
                });
            });
        }
        return tips;
    };

    // Keyboard shortcut: Ctrl+L to toggle chat
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                setShowChat(prev => !prev);
                if (!showChat) {
                    setTimeout(() => chatInputRef.current?.focus(), 100);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showChat]);

    // Handle chat message submission
    const handleChatSubmit = async () => {
        if (!chatInput.trim() || isChatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setIsChatLoading(true);

        // Add user message to chat
        const newMessages: ChatMessage[] = [
            ...chatMessages,
            { role: 'user', content: userMessage, timestamp: Date.now() }
        ];
        setChatMessages(newMessages);

        try {
            const response = await fetch(buildApiUrl('/api/zinius-chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPrompt: editingPrompt,
                    userMessage: userMessage,
                    chatHistory: newMessages.slice(-6), // Keep last 6 messages for context
                    model: selectedModel
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Update usage stats
                fetchUsageStats();
                
                // Add assistant response to chat
                setChatMessages(prev => [
                    ...prev,
                    { 
                        role: 'assistant', 
                        content: data.explanation || '프롬프트가 수정되었습니다.',
                        timestamp: Date.now()
                    }
                ]);

                // Store the modified prompt suggestion (user can apply it)
                if (data.modifiedPrompt) {
                    // Add a system message with the modified prompt
                    setChatMessages(prev => [
                        ...prev,
                        { 
                            role: 'assistant', 
                            content: `💡 수정된 프롬프트:\n${data.modifiedPrompt}`,
                            timestamp: Date.now()
                        }
                    ]);
                }
            } else {
                throw new Error(data.error || 'Chat processing failed');
            }
        } catch (error) {
            console.error('Chat error:', error);
            setChatMessages(prev => [
                ...prev,
                { 
                    role: 'assistant', 
                    content: `❌ 오류: ${error instanceof Error ? error.message : '채팅 처리 중 오류가 발생했습니다.'}`,
                    timestamp: Date.now()
                }
            ]);
        } finally {
            setIsChatLoading(false);
        }
    };

    if (!isOpen) {
        console.log('❌ [PromptEditModal] Not open, returning null');
        return null;
    }

    console.log('✅ [PromptEditModal] Rendering modal via Portal');

    const hasAnalysis = Object.keys(elementAnalysis).length > 0 &&
                       Object.values(elementAnalysis).some(arr => Array.isArray(arr) && arr.length > 0);

    // Helper to check if an item is recommended for the selected style
    const isRecommended = (category: 'camera' | 'composition' | 'lighting', item: string): boolean => {
        if (!selectedStyle || !STYLE_RECOMMENDATIONS[selectedStyle]) return false;
        const recommendations = STYLE_RECOMMENDATIONS[selectedStyle][category];
        return recommendations ? recommendations.some(rec => item.toLowerCase().includes(rec.toLowerCase()) || rec.toLowerCase().includes(item.toLowerCase())) : false;
    };

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden absolute"
                style={{ left: modalPosition.x, top: modalPosition.y }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 헤더 */}
                <div
                    className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0 cursor-grab active:cursor-grabbing"
                    onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        const rect = modalRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        dragOffsetRef.current = {
                            x: event.clientX - rect.left,
                            y: event.clientY - rect.top
                        };
                        setIsDragging(true);
                    }}
                >
                    <div>
                        <h3 className="text-sm font-bold text-emerald-300">
                            프롬프트 수정 (씬 #{sceneNumber})
                        </h3>
                        <p className="text-[10px] text-slate-500">AI 분석으로 각 요소를 확인하고 편집하세요</p>
                    </div>
                    
                    {/* 모델 선택 및 카운팅 바 */}
                    <div className="flex items-center gap-2 bg-slate-950/50 border border-slate-700 rounded-full px-3 py-1.5 ml-4 mr-auto">
                        {MODEL_OPTIONS.map((model, index) => {
                            const isSelected = selectedModel === model.id;
                            const accent =
                                model.accent === 'purple'
                                    ? 'bg-purple-500 text-slate-950 shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                                    : model.accent === 'fuchsia'
                                        ? 'bg-fuchsia-500 text-slate-950 shadow-[0_0_10px_rgba(236,72,153,0.5)]'
                                        : model.accent === 'sky'
                                            ? 'bg-sky-400 text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                                            : 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
                            const statColor =
                                model.accent === 'purple'
                                    ? 'text-purple-400/70'
                                    : model.accent === 'fuchsia'
                                        ? 'text-fuchsia-300/70'
                                        : model.accent === 'sky'
                                            ? 'text-sky-300/70'
                                            : 'text-emerald-400/70';

                            return (
                                <React.Fragment key={model.id}>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedModel(model.id)}
                                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                                                isSelected
                                                    ? accent
                                                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {model.label}
                                        </button>
                                        <span className={`text-[10px] font-mono ${statColor}`}>{usageStats[model.id] || 0}</span>
                                    </div>
                                    {index < MODEL_OPTIONS.length - 1 && <div className="w-[1px] h-3 bg-slate-700"></div>}
                                </React.Fragment>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2">
                        {onReset && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReset();
                                }}
                                className="px-3 py-1 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                            >
                                초기화
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 본체 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* 스타일 프리셋 - 컴팩트 버전 */}
                    {onApplyStyle && (
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                            <h4 className="text-[9px] font-semibold text-slate-400 mb-1.5">스타일 프리셋</h4>
                            <div className="grid grid-cols-3 lg:grid-cols-6 gap-1.5">
                                {STYLE_PRESETS.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => {
                                            setSelectedStyle(preset.id);
                                            onApplyStyle(preset.id, selectedModel);
                                        }}
                                        disabled={isLoading}
                                        className={`flex flex-col items-center justify-center p-1.5 bg-slate-900 hover:bg-slate-800 border rounded transition-all group disabled:opacity-50 disabled:cursor-not-allowed relative ${
                                            selectedStyle === preset.id 
                                                ? 'border-orange-500 bg-orange-900/20' 
                                                : 'border-slate-700 hover:border-purple-500/50'
                                        }`}
                                    >
                                        <span className="text-lg">{preset.emoji}</span>
                                        <span className={`text-[9px] font-semibold transition-colors mt-0.5 ${
                                            selectedStyle === preset.id 
                                                ? 'text-orange-400' 
                                                : 'text-slate-300 group-hover:text-purple-400'
                                        }`}>
                                            {preset.name}
                                        </span>
                                        {selectedStyle === preset.id && (
                                            <span className="absolute -top-1 -right-1 text-orange-400 text-xs">⭐</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {selectedStyle && STYLE_RECOMMENDATIONS[selectedStyle] && (
                                <div className="mt-2 p-2 bg-orange-900/20 border border-orange-500/30 rounded text-[9px] text-orange-300">
                                    <span className="font-semibold">💡 추천:</span> {STYLE_RECOMMENDATIONS[selectedStyle].description}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 범례 */}
                    <PromptLegend />

                    {/* 입력 영역 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* 원본 프롬프트 */}
                        <div>
                            <label className="text-[10px] font-semibold text-slate-400 block mb-2">
                                원본 프롬프트
                            </label>
                            <textarea
                                value={originalPrompt}
                                onChange={(e) => onOriginalChange?.(e.target.value)}
                                rows={10}
                                readOnly={!onOriginalChange}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-300 font-mono outline-none resize-none"
                            />
                        </div>

                        {/* 수정 프롬프트 */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-semibold text-slate-400 block">
                                    수정 프롬프트
                                </label>
                                {originalPrompt.trim() && editingPrompt.trim() && originalPrompt !== editingPrompt && (
                                    <button
                                        onClick={() => setShowEditHighlight((prev) => !prev)}
                                        className="text-[9px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                                    >
                                        {showEditHighlight ? '편집 모드' : '변경 표시'}
                                    </button>
                                )}
                            </div>
                            {showEditHighlight ? (
                                <div className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px] text-slate-200 font-mono outline-none resize-none min-h-[220px]">
                                    <div className="flex gap-2 text-[9px] mb-2">
                                        <span className="text-red-400">● 삭제</span>
                                        <span className="text-green-400">● 추가</span>
                                    </div>
                                    <div className="text-[10px] leading-relaxed whitespace-pre-wrap break-words">
                                        {computeDiff(originalPrompt, editingPrompt).map((part, idx) => {
                                            if (part.type === 'added') {
                                                return <span key={idx} className="bg-green-500/30 text-green-300 px-0.5 rounded">{part.text}</span>;
                                            }
                                            if (part.type === 'removed') {
                                                return <span key={idx} className="bg-red-500/30 text-red-300 px-0.5 rounded line-through opacity-70">{part.text}</span>;
                                            }
                                            return <span key={idx} className="text-slate-300">{part.text}</span>;
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <textarea
                                    value={editingPrompt}
                                    onChange={(e) => onEditingChange(e.target.value)}
                                    rows={10}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px] text-slate-200 font-mono outline-none resize-none"
                                />
                            )}
                            {selectedProblemIndices.length > 0 && previewPrompt !== editingPrompt && (
                                <div className="mt-2 bg-emerald-950/30 border border-emerald-500/40 rounded-lg p-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-semibold text-emerald-300">선택 적용 미리보기</span>
                                        <span className="text-[9px] text-emerald-200/70">체크 즉시 반영됨</span>
                                        <span className="text-[9px] text-emerald-200/70 ml-auto">적용 {previewAppliedCount}곳</span>
                                        <div className="flex gap-2 text-[9px] ml-auto">
                                            <span className="text-red-400">● 삭제</span>
                                            <span className="text-green-400">● 추가</span>
                                        </div>
                                    </div>
                                    {previewAppliedCount === 0 && (
                                        <div className="text-[9px] text-emerald-200/80 mb-1">
                                            현재 수정본에 해당 문장이 없어서 변화가 없습니다.
                                        </div>
                                    )}
                                    <div className="text-[10px] leading-relaxed whitespace-pre-wrap break-words">
                                        {computeDiff(selectionBasePrompt, previewPrompt).map((part, idx) => {
                                            if (part.type === 'added') {
                                                return <span key={idx} className="bg-green-500/30 text-green-300 px-0.5 rounded">{part.text}</span>;
                                            }
                                            if (part.type === 'removed') {
                                                return <span key={idx} className="bg-red-500/30 text-red-300 px-0.5 rounded line-through opacity-70">{part.text}</span>;
                                            }
                                            return <span key={idx} className="text-slate-300">{part.text}</span>;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 에러 표시 */}
                    {error && (
                        <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {/* 쉬운 요약 */}
                    {(detailedAnalysis || (elementAnalysis?.problems && elementAnalysis.problems.length > 0)) && (
                        <details className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-3 open:bg-amber-950/40">
                            <summary className="cursor-pointer select-none text-[10px] font-semibold text-amber-300">
                                쉬운 요약 (초등학생 버전)
                            </summary>
                            <div className="mt-2 space-y-2">
                                {buildSimpleTips().length === 0 ? (
                                    <div className="text-[10px] text-amber-200">큰 문제는 안 보였어요. 지금도 잘 만들고 있어요!</div>
                                ) : (
                                    <ul className="space-y-2">
                                        {buildSimpleTips().map((tip, idx) => (
                                            <li key={`simple-tip-${idx}`} className="bg-amber-900/30 border border-amber-500/30 rounded-md p-2">
                                                <div className="text-[10px] font-semibold text-amber-100">{tip.title}</div>
                                                {tip.reason && <div className="text-[10px] text-amber-200 mt-1">이유: {tip.reason}</div>}
                                                {tip.fix && <div className="text-[10px] text-amber-100 mt-1">이렇게 고쳐요: {tip.fix}</div>}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {detailedAnalysis?.correctedPrompt && (
                                    <button
                                        onClick={() => onEditingChange(detailedAnalysis.correctedPrompt || '')}
                                        className="w-full px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-[10px] font-semibold transition-colors"
                                    >
                                        쉬운 수정본 바로 적용
                                    </button>
                                )}
                            </div>
                        </details>
                    )}

                    {/* 상세 분석 결과 */}
                    {detailedAnalysis && (
                        <details className="bg-slate-950 border border-slate-800 rounded-lg p-3 open:bg-slate-950/70">
                            <summary className="cursor-pointer select-none text-[10px] font-semibold text-emerald-300">
                                상세 분석 결과 (전문가용)
                            </summary>
                            <div className="mt-2 space-y-3">

                            {/* 문제점 상세 분석 - Before/After 비교 */}
                            {Array.isArray(detailedAnalysis.problems) && detailedAnalysis.problems.length > 0 && (
                                <div className="bg-red-900/20 border-2 border-red-500 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-red-400 text-xl">⚠️</span>
                                        <span className="text-sm font-bold text-red-300">발견된 문제 및 수정 방법</span>
                                        <span className="text-xs text-red-400 ml-auto">{detailedAnalysis.problems.length}건</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <button
                                            onClick={applySelectedProblemFixes}
                                            disabled={selectedProblemIndices.length === 0}
                                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-600 text-white disabled:bg-slate-700 disabled:text-slate-400"
                                        >
                                            선택 적용
                                        </button>
                                        <span className="text-[9px] text-red-200">체크한 항목만 수정 프롬프트에 반영됩니다.</span>
                                    </div>
                                    <div className="space-y-3">
                                        {detailedAnalysis.problems.map((problem, i) => {
                                            const typeColors = {
                                                '중복': 'bg-orange-900/30 border-orange-500/50 text-orange-300',
                                                '모순': 'bg-red-900/30 border-red-500/50 text-red-300',
                                                '불명확': 'bg-yellow-900/30 border-yellow-500/50 text-yellow-300',
                                                '정책위반': 'bg-purple-900/30 border-purple-500/50 text-purple-300'
                                            };
                                            const typeEmojis = {
                                                '중복': '🔄',
                                                '모순': '⚠️',
                                                '불명확': '❓',
                                                '정책위반': '🚫'
                                            };
                                            return (
                                                <div key={i} className={`border rounded-lg p-2 ${typeColors[problem.type] || 'bg-gray-900/30 border-gray-500/50'}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedProblemIndices.includes(i)}
                                                            onChange={() => toggleProblemSelection(i)}
                                                            className="accent-emerald-500"
                                                        />
                                                        <span className="text-sm">{typeEmojis[problem.type]}</span>
                                                        <span className="text-[10px] font-bold">{problem.type}</span>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">원문:</div>
                                                            <div className="text-[10px] line-through opacity-70">{problem.original}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">문제:</div>
                                                            <div className="text-[10px]">{problem.issue}</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-[9px] text-slate-400 mb-0.5">해결 방법:</div>
                                                            <div className="text-[10px] text-blue-300">{problem.fix}</div>
                                                        </div>
                                                        <div className="pt-1.5 border-t border-white/10">
                                                            <div className="flex items-center gap-1 mb-0.5">
                                                                <span className="text-green-400 text-xs">✅</span>
                                                                <div className="text-[9px] text-green-400 font-semibold">수정:</div>
                                                            </div>
                                                            <div className="text-[10px] text-green-200 font-medium">{problem.corrected}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 품질 점수 + 상세 요소 */}
                            {detailedAnalysis.score !== undefined && (
                                <details className="bg-slate-900/50 border border-slate-700 rounded-lg p-2 open:bg-slate-900/70">
                                    <summary className="cursor-pointer select-none text-[10px] font-semibold text-slate-200">
                                        품질 점수: {detailedAnalysis.score}/100
                                    </summary>
                                    <div className="mt-2 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="flex gap-0.5">
                                                {[...Array(5)].map((_, i) => (
                                                    <span key={i} className={i < Math.round(detailedAnalysis.score! / 20) ? 'text-yellow-400' : 'text-slate-700'}>
                                                        ⭐
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-slate-400">점수는 참고용입니다.</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                {/* 스타일 */}
                                {Array.isArray(detailedAnalysis.style) && detailedAnalysis.style.length > 0 && (
                                    <div className="bg-purple-950/20 border border-purple-500/30 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-purple-300 mb-1">스타일</div>
                                        <ul className="space-y-0.5">
                                            {detailedAnalysis.style.map((item, i) => (
                                                <li key={i} className="text-[10px] text-purple-200">• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* 조명 */}
                                {Array.isArray(detailedAnalysis.lighting) && detailedAnalysis.lighting.length > 0 && (
                                    <div className="bg-yellow-950/20 border border-yellow-500/30 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-yellow-300 mb-1">조명</div>
                                        <ul className="space-y-0.5">
                                            {detailedAnalysis.lighting.map((item, i) => (
                                                <li key={i} className={`text-[10px] flex items-center gap-1 ${isRecommended('lighting', item) ? 'text-orange-300 font-semibold' : 'text-yellow-200'}`}>
                                                    {isRecommended('lighting', item) && <span className="text-orange-400">⭐</span>}
                                                    <span>• {item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* 카메라 */}
                                {Array.isArray(detailedAnalysis.camera) && detailedAnalysis.camera.length > 0 && (
                                    <div className="bg-blue-950/20 border border-blue-500/30 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-blue-300 mb-1">카메라</div>
                                        <ul className="space-y-0.5">
                                            {detailedAnalysis.camera.map((item, i) => (
                                                <li key={i} className={`text-[10px] flex items-center gap-1 ${isRecommended('camera', item) ? 'text-orange-300 font-semibold' : 'text-blue-200'}`}>
                                                    {isRecommended('camera', item) && <span className="text-orange-400">⭐</span>}
                                                    <span>• {item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* 구도 */}
                                {Array.isArray(detailedAnalysis.composition) && detailedAnalysis.composition.length > 0 && (
                                    <div className="bg-green-950/20 border border-green-500/30 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-green-300 mb-1">구도</div>
                                        <ul className="space-y-0.5">
                                            {detailedAnalysis.composition.map((item, i) => (
                                                <li key={i} className={`text-[10px] flex items-center gap-1 ${isRecommended('composition', item) ? 'text-orange-300 font-semibold' : 'text-green-200'}`}>
                                                    {isRecommended('composition', item) && <span className="text-orange-400">⭐</span>}
                                                    <span>• {item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* 인물 */}
                                {Array.isArray(detailedAnalysis.character) && detailedAnalysis.character.length > 0 && (
                                    <div className="bg-pink-950/20 border border-pink-500/30 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-pink-300 mb-1">인물</div>
                                        <ul className="space-y-0.5">
                                            {detailedAnalysis.character.map((item, i) => (
                                                <li key={i} className="text-[10px] text-pink-200">• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* 배경 */}
                                {Array.isArray(detailedAnalysis.background) && detailedAnalysis.background.length > 0 && (
                                    <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-cyan-300 mb-1">배경</div>
                                        <ul className="space-y-0.5">
                                            {detailedAnalysis.background.map((item, i) => (
                                                <li key={i} className="text-[10px] text-cyan-200">• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                        </div>

                                        {/* 개선 제안 */}
                                        {Array.isArray(detailedAnalysis.suggestions) && detailedAnalysis.suggestions.length > 0 && (
                                            <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-2">
                                                <div className="text-[10px] font-semibold text-cyan-300 mb-1">개선 제안</div>
                                                <ul className="space-y-1">
                                                    {detailedAnalysis.suggestions.map((item, i) => (
                                                        <li key={i} className="text-[10px] text-cyan-200 flex items-start gap-1">
                                                            <span className="text-cyan-400">✓</span>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            {/* 수정된 전체 프롬프트 */}
                            {detailedAnalysis.correctedPrompt && (
                                <div className="bg-green-900/20 border-2 border-green-500 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-400 text-xl">💡</span>
                                            <span className="text-sm font-bold text-green-300">수정된 전체 프롬프트</span>
                                        </div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(detailedAnalysis.correctedPrompt || '');
                                                alert('클립보드에 복사되었습니다!');
                                            }}
                                            className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-[9px] transition-colors"
                                        >
                                            복사
                                        </button>
                                    </div>
                                    <div className="bg-slate-950 border border-green-500/30 rounded-lg p-2 mb-2">
                                        <div className="text-[10px] text-green-100 leading-relaxed whitespace-pre-wrap break-words">
                                            {detailedAnalysis.correctedPrompt}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => onEditingChange(detailedAnalysis.correctedPrompt || '')}
                                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span>✅</span>
                                        <span>수정된 프롬프트 적용하기</span>
                                    </button>
                                </div>
                            )}

                            {/* 변경사항 비교 (Diff Viewer) */}
                            {detailedAnalysis.correctedPrompt && originalPrompt && (
                                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-blue-400 text-lg">🔍</span>
                                        <span className="text-[10px] font-bold text-blue-300">변경사항 비교</span>
                                        <div className="flex gap-2 ml-auto text-[9px]">
                                            <span className="text-red-400">● 삭제</span>
                                            <span className="text-green-400">● 추가</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 max-h-40 overflow-y-auto">
                                        <div className="text-[10px] leading-relaxed whitespace-pre-wrap break-words">
                                            {computeDiff(originalPrompt, detailedAnalysis.correctedPrompt).map((part, idx) => {
                                                if (part.type === 'added') {
                                                    return <span key={idx} className="bg-green-500/30 text-green-300 px-0.5 rounded">{part.text}</span>;
                                                } else if (part.type === 'removed') {
                                                    return <span key={idx} className="bg-red-500/30 text-red-300 px-0.5 rounded line-through opacity-70">{part.text}</span>;
                                                } else {
                                                    return <span key={idx} className="text-slate-300">{part.text}</span>;
                                                }
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                            </div>
                        </details>
                    )}

                    {/* 분석 결과 - 요소별 하이라이트 */}
                    {hasAnalysis && (
                        <details className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 open:bg-slate-900/70">
                            <summary className="cursor-pointer select-none text-[10px] font-semibold text-emerald-300 mb-2">
                                요소별 분석 결과 (클릭해서 열기)
                            </summary>
                            <div className="text-[11px] text-slate-300 leading-relaxed space-y-3">
                                {/* 원본 프롬프트 분석 */}
                                <div>
                                    <div className="text-[10px] text-slate-500 mb-2 font-semibold">원본</div>
                                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-left break-words whitespace-pre-wrap">
                                        {renderHighlightedByElement(originalPrompt, elementAnalysis)}
                                    </div>
                                </div>

                                {/* 수정 프롬프트 분석 */}
                                <div>
                                    <div className="text-[10px] text-slate-500 mb-2 font-semibold">수정</div>
                                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-left break-words whitespace-pre-wrap">
                                        {renderHighlightedByElement(editingPrompt, elementAnalysis)}
                                    </div>
                                </div>

                                {/* 분석 통계 */}
                                {elementAnalysis.problems && elementAnalysis.problems.length > 0 && (
                                    <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-2">
                                        <div className="text-[10px] font-semibold text-red-300 mb-1">발견된 문제</div>
                                        <ul className="text-[10px] text-red-200 space-y-1">
                                            {elementAnalysis.problems.map((problem, idx) => (
                                                <li
                                                    key={`problem-${idx}`}
                                                    title={getProblemExplanation(problem)}
                                                    className="hover:bg-red-900/30 px-2 py-1 rounded"
                                                >
                                                    <div>⚠️ {problem}</div>
                                                    <div className="text-[9px] text-red-200/80 mt-0.5">쉽게 말하면: {getProblemExplanation(problem)}</div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </details>
                    )}
                </div>

                {/* Zinius Chat Section */}
                {showChat && (
                    <div className="border-t border-slate-700 bg-slate-900/95 flex-shrink-0">
                        <div className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">💬</span>
                                    <span className="text-[10px] font-bold text-purple-300">지니어스 채팅</span>
                                    <span className="text-[9px] text-slate-500">(Ctrl+L로 토글)</span>
                                </div>
                                <button
                                    onClick={() => setShowChat(false)}
                                    className="text-slate-400 hover:text-white text-xs"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {/* Chat Messages */}
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 h-32 overflow-y-auto space-y-2">
                                {chatMessages.length === 0 ? (
                                    <div className="text-[10px] text-slate-500 text-center py-4">
                                        💡 프롬프트에 대해 무엇이든 물어보세요!<br/>
                                        예: "더 몽환적으로 만들어줘", "조명을 밝게 해줘"
                                    </div>
                                ) : (
                                    chatMessages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] rounded-lg px-2 py-1 text-[10px] ${
                                                msg.role === 'user' 
                                                    ? 'bg-purple-600 text-white' 
                                                    : 'bg-slate-800 text-slate-200'
                                            }`}>
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                {isChatLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-400">
                                            <span className="animate-pulse">지니어스가 생각중...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Chat Input */}
                            <div className="flex gap-2">
                                <input
                                    ref={chatInputRef}
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleChatSubmit();
                                        }
                                    }}
                                    placeholder="프롬프트 수정 요청을 입력하세요..."
                                    disabled={isChatLoading}
                                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none focus:border-purple-500 disabled:opacity-50"
                                />
                                <button
                                    onClick={handleChatSubmit}
                                    disabled={isChatLoading || !chatInput.trim()}
                                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
                                >
                                    {isChatLoading ? '...' : '전송'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 푸터 (버튼) */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-slate-800 flex-shrink-0 bg-slate-950">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={onAnalyze}
                            disabled={isLoading || !originalPrompt.trim()}
                            className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                            {loadingType === 'element' ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    분석 중...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-3 h-3" />
                                    요소 분석
                                </>
                            )}
                        </button>
                        {onDetailedAnalyze && (
                            <button
                                onClick={() => onDetailedAnalyze(selectedModel)}
                                disabled={isLoading || !editingPrompt.trim()}
                                className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                                {loadingType === 'detailed' ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        분석 중...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3 h-3" />
                                        상세 분석
                                    </>
                                )}
                            </button>
                        )}
                        {onGenerateImage && (
                            <button
                                onClick={onGenerateImage}
                                disabled={isLoading || !editingPrompt.trim()}
                                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                                이미지 생성
                            </button>
                        )}
                        {onAiGenerate && (
                            <button
                                onClick={onAiGenerate}
                                disabled={isLoading || !editingPrompt.trim()}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
                            >
                                AI 생성
                            </button>
                        )}
                        {/* Chat Toggle Button */}
                        <button
                            onClick={() => {
                                setShowChat(!showChat);
                                if (!showChat) {
                                    setTimeout(() => chatInputRef.current?.focus(), 100);
                                }
                            }}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                                showChat 
                                    ? 'bg-purple-600 text-white' 
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                            }`}
                        >
                            <span>💬</span>
                            <span>지니어스</span>
                        </button>
                    </div>
                    {onApply && (
                        <button
                            onClick={onApply}
                            disabled={isLoading}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                            적용
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    // Portal을 사용하여 body에 직접 렌더링
    if (typeof document !== 'undefined') {
        return ReactDOM.createPortal(modalContent, document.body);
    }

    return null;
};

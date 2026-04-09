import React, { useState, useEffect } from 'react';
import { X, User, Loader2 } from 'lucide-react';
import { extractCharacterDescription } from './services/geminiService';

interface SaveCharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, description: string) => void;
    initialPrompt: string;
}

const SaveCharacterModal: React.FC<SaveCharacterModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialPrompt
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [koreanTranslation, setKoreanTranslation] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);

    // Auto-extract character description when modal opens
    useEffect(() => {
        if (isOpen && initialPrompt && !description) {
            setIsExtracting(true);
            setName(''); // Reset name when opening
            extractCharacterDescription(initialPrompt)
                .then(result => {
                    setDescription(result.description);
                    setKoreanTranslation(result.korean);
                })
                .catch(err => {
                    console.error('Extraction failed:', err);
                    setDescription(initialPrompt); // Fallback to original
                    setKoreanTranslation('추출 실패');
                })
                .finally(() => {
                    setIsExtracting(false);
                });
        }

        // Reset state when modal closes
        if (!isOpen) {
            setName('');
            setDescription('');
            setKoreanTranslation('');
            setIsExtracting(false);
        }
    }, [isOpen]); // Only depend on isOpen to prevent infinite loop

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim()) {
            alert('캐릭터 이름을 입력해주세요.');
            return;
        }
        onSave(name.trim(), description.trim());
        setName('');
        setDescription('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-gray-900 border border-purple-500/50 rounded-xl p-6 w-[600px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <User className="text-purple-400" size={24} />
                        <h2 className="text-xl font-bold text-white">캐릭터로 저장</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            캐릭터 이름 *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="예: 김대리, 월터의 여전사, 네온 시티의 해커"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            캐릭터 설명 (프롬프트)
                            {isExtracting && (
                                <span className="ml-2 text-xs text-purple-400 flex items-center gap-1 inline-flex">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    AI가 캐릭터 정보를 추출하는 중...
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="캐릭터의 외모, 의상, 특징을 설명하는 프롬프트"
                                className="w-full h-40 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none font-mono text-sm"
                                disabled={isExtracting}
                            />
                            {isExtracting && (
                                <div className="absolute inset-0 bg-gray-900/50 rounded-lg flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {isExtracting
                                ? 'AI가 원본 프롬프트에서 캐릭터 관련 정보만 자동으로 추출합니다. 잠시만 기다려주세요...'
                                : '이 설명은 나중에 다른 프롬프트에 자동으로 추가되어 동일한 캐릭터를 생성합니다. 필요하면 수정하세요.'}
                        </p>

                        {/* Korean Translation Display */}
                        {koreanTranslation && !isExtracting && (
                            <div className="mt-3 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg">
                                <p className="text-xs font-bold text-purple-300 mb-1">📖 한글 번역:</p>
                                <p className="text-sm text-purple-100">{koreanTranslation}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleSave}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            저장
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaveCharacterModal;

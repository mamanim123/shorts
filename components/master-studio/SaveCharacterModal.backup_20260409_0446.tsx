import React, { useState, useEffect } from 'react';
import { X, User, Loader2 } from 'lucide-react';
import { extractCharacterDescription, extractCharacterProfile } from './services/geminiService';
import type { CharacterIdentitySpec, CharacterReferencePreference, CharacterWardrobeProfile } from '../../types';

export interface SaveCharacterPayload {
    name: string;
    description: string;
    age: string;
    gender: 'female' | 'male';
    face: string;
    hair: string;
    body: string;
    style: string;
    identitySpec: CharacterIdentitySpec;
    referencePreference: CharacterReferencePreference;
    wardrobeProfile: CharacterWardrobeProfile;
}

interface SaveCharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (payload: SaveCharacterPayload) => void;
    initialPrompt: string;
    initialReferenceImages?: Array<{ url: string; label: string }>;
}

const SaveCharacterModal: React.FC<SaveCharacterModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialPrompt,
    initialReferenceImages = []
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [koreanTranslation, setKoreanTranslation] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [age, setAge] = useState('30대');
    const [gender, setGender] = useState<'female' | 'male'>('female');
    const [face, setFace] = useState('');
    const [hair, setHair] = useState('');
    const [body, setBody] = useState('');
    const [style, setStyle] = useState('');
    const [skinTone, setSkinTone] = useState('');
    const [bustDescription, setBustDescription] = useState('');
    const [heightDescription, setHeightDescription] = useState('');
    const [signatureFeatures, setSignatureFeatures] = useState('');
    const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);

    const convertUrlToInlineData = async (url: string): Promise<{ inlineData: { data: string; mimeType: string } } | null> => {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.onerror = () => reject(new Error('이미지 읽기 실패'));
                reader.readAsDataURL(blob);
            });
            const [, meta = '', data = ''] = dataUrl.match(/^data:(.*?);base64,(.*)$/) || [];
            if (!data) return null;
            return { inlineData: { data, mimeType: meta || blob.type || 'image/png' } };
        } catch {
            return null;
        }
    };

    const runImageAwareAnalysis = async () => {
        setIsAnalyzingImages(true);
        try {
            const imageParts = (await Promise.all((initialReferenceImages || []).map((item) => convertUrlToInlineData(item.url))))
                .filter((item): item is { inlineData: { data: string; mimeType: string } } => Boolean(item));

            const profile = await extractCharacterProfile(initialPrompt, imageParts);
            setDescription(profile.description);
            setKoreanTranslation(profile.korean);
            setAge(profile.age || '30대');
            setGender(profile.gender || 'female');
            setFace(profile.face || '');
            setHair(profile.hair || '');
            setBody(profile.body || '');
            setStyle(profile.style || '');
            setSkinTone(profile.skinTone || '');
            setBustDescription(profile.bustDescription || '');
            setHeightDescription(profile.heightDescription || '');
            setSignatureFeatures(profile.signatureFeatures || '');
        } catch (error) {
            console.error('Image-aware character analysis failed:', error);
        } finally {
            setIsAnalyzingImages(false);
        }
    };

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

            if ((initialReferenceImages || []).length > 0) {
                runImageAwareAnalysis();
            }
        }

        // Reset state when modal closes
        if (!isOpen) {
            setName('');
            setDescription('');
            setKoreanTranslation('');
            setIsExtracting(false);
            setAge('30대');
            setGender('female');
            setFace('');
            setHair('');
            setBody('');
            setStyle('');
            setSkinTone('');
            setBustDescription('');
            setHeightDescription('');
            setSignatureFeatures('');
            setIsAnalyzingImages(false);
        }
    }, [isOpen]); // Only depend on isOpen to prevent infinite loop

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim()) {
            alert('캐릭터 이름을 입력해주세요.');
            return;
        }
        onSave({
            name: name.trim(),
            description: description.trim(),
            age,
            gender,
            face: face.trim(),
            hair: hair.trim(),
            body: body.trim(),
            style: style.trim(),
            identitySpec: {
                age,
                gender,
                faceShape: face.trim(),
                hairDescription: hair.trim(),
                bodyType: body.trim(),
                styleCore: style.trim(),
                skinTone: skinTone.trim(),
                bustDescription: bustDescription.trim(),
                heightDescription: heightDescription.trim(),
                signatureFeatures: signatureFeatures.trim(),
                lockedTraits: [face.trim(), hair.trim(), body.trim(), style.trim(), skinTone.trim(), bustDescription.trim(), heightDescription.trim(), signatureFeatures.trim()].filter((value): value is string => Boolean(value))
            },
            referencePreference: {
                defaultView: 'front',
                useTurnaroundViews: true,
                lockFaceReference: true
            },
            wardrobeProfile: {
                outfitChangePolicy: 'outfit-only',
                preserveBodySilhouette: true,
                baseWardrobeNote: 'Keep the same person and body silhouette. Change outfits only.'
            }
        });
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

                    {initialReferenceImages.length > 0 && (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/10 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-emerald-200">이미지 기반 캐릭터 추출</p>
                                    <p className="text-xs text-emerald-100/80">기준 이미지/3면도를 보고 얼굴·헤어·체형을 더 자세히 자동 분석합니다.</p>
                                </div>
                                <button
                                    onClick={runImageAwareAnalysis}
                                    disabled={isAnalyzingImages}
                                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-sm font-bold transition-colors"
                                >
                                    {isAnalyzingImages ? '분석 중...' : '이미지 재분석'}
                                </button>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {initialReferenceImages.map((item) => (
                                    <div key={`${item.label}-${item.url}`} className="rounded-lg overflow-hidden border border-emerald-400/20 bg-black/20">
                                        <img src={item.url} alt={item.label} className="w-full h-20 object-cover" />
                                        <div className="px-2 py-1 text-[11px] text-emerald-100 text-center">{item.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">연령대</label>
                            <select
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                            >
                                {['10대', '20대', '30대', '40대', '50대'].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">성별</label>
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value as 'female' | 'male')}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                            >
                                <option value="female">여성</option>
                                <option value="male">남성</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">얼굴 고정 포인트</label>
                            <input value={face} onChange={(e) => setFace(e.target.value)} placeholder="예: oval face, sharp jawline, large almond eyes" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">헤어 고정 포인트</label>
                            <input value={hair} onChange={(e) => setHair(e.target.value)} placeholder="예: long black straight hair, clean hairline" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">체형 고정 포인트</label>
                            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="예: slim hourglass figure, long legs" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">스타일 코어</label>
                            <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="예: elegant sophisticated presence" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">피부톤</label>
                            <input value={skinTone} onChange={(e) => setSkinTone(e.target.value)} placeholder="예: warm light beige skin tone" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">가슴/상체 포인트</label>
                            <input value={bustDescription} onChange={(e) => setBustDescription(e.target.value)} placeholder="예: high chest line, natural full bust" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">키/비율 인상</label>
                            <input value={heightDescription} onChange={(e) => setHeightDescription(e.target.value)} placeholder="예: medium height, long-legged proportions" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">시그니처 특징</label>
                            <input value={signatureFeatures} onChange={(e) => setSignatureFeatures(e.target.value)} placeholder="예: beauty mark under left eye" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
                        </div>
                    </div>

                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-900/10 px-4 py-3 text-sm text-cyan-100">
                        저장 시 이 캐릭터는 기본적으로 <strong>동일 인물 유지 + 의상만 변경</strong> 전략으로 저장됩니다. 이후 쇼츠랩에서 이 identity spec과 3면도 참조를 재사용할 수 있게 됩니다.
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

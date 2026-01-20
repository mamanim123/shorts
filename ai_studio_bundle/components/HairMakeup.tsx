import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface HairMakeupProps {
    onApplyHairMakeup: (image: File, hairstyle: string, hairColor: string, makeupStyle: string, makeupIntensity: number) => Promise<string>;
    isProcessing: boolean;
}

const HairMakeup: React.FC<HairMakeupProps> = ({ onApplyHairMakeup, isProcessing }) => {
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [hairstyle, setHairstyle] = useState('');
    const [hairColor, setHairColor] = useState('');
    const [makeupStyle, setMakeupStyle] = useState<'natural' | 'dramatic' | 'none'>('natural');
    const [makeupIntensity, setMakeupIntensity] = useState(50);
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    const handleImageDrop = (file: File) => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        setImage(file);
        setImageUrl(URL.createObjectURL(file));
        setResultUrl(null);
    };

    const handleClearImage = () => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        setImage(null);
        setImageUrl(null);
        setResultUrl(null);
    };

    const handleApply = async () => {
        if (!image) {
            alert('이미지를 업로드해주세요.');
            return;
        }

        if (!hairstyle && !hairColor && makeupStyle === 'none') {
            alert('최소 하나 이상의 옵션을 선택해주세요.');
            return;
        }

        try {
            const result = await onApplyHairMakeup(image, hairstyle, hairColor, makeupStyle, makeupIntensity);
            setResultUrl(result);
        } catch (error) {
            console.error('Hair & makeup error:', error);
            alert('적용에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200">💄 헤어 & 메이크업</h3>
            <p className="text-sm text-gray-400">
                헤어스타일, 헤어컬러, 메이크업을 변경합니다.
            </p>

            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">1. 이미지 업로드</h4>
                <ImageDropzone onImageDrop={handleImageDrop} previewUrl={imageUrl} onClear={handleClearImage} />
            </div>

            {image && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">2. 스타일 설정</h4>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">헤어스타일</label>
                        <select
                            value={hairstyle}
                            onChange={(e) => setHairstyle(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                        >
                            <option value="">변경 안 함</option>
                            <option value="long">긴 머리</option>
                            <option value="short">짧은 머리</option>
                            <option value="curly">곱슬머리</option>
                            <option value="straight">생머리</option>
                            <option value="wavy">웨이브</option>
                            <option value="bob">단발</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">헤어컬러</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { value: '', label: '변경 안 함', color: '#666' },
                                { value: '#2C1810', label: '검정', color: '#2C1810' },
                                { value: '#8B4513', label: '갈색', color: '#8B4513' },
                                { value: '#FFD700', label: '금발', color: '#FFD700' },
                                { value: '#FF6B6B', label: '빨강', color: '#FF6B6B' },
                                { value: '#9B59B6', label: '보라', color: '#9B59B6' },
                                { value: '#3498DB', label: '파랑', color: '#3498DB' },
                                { value: '#E8E8E8', label: '은색', color: '#E8E8E8' }
                            ].map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => setHairColor(c.value)}
                                    className={`py-2 px-2 rounded-md text-xs transition border-2 ${hairColor === c.value
                                            ? 'border-indigo-500'
                                            : 'border-gray-600'
                                        }`}
                                    style={{ backgroundColor: c.color }}
                                >
                                    <span style={{ color: c.color === '#FFD700' || c.color === '#E8E8E8' ? '#000' : '#fff' }}>
                                        {c.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">메이크업 스타일</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'none', label: '없음', emoji: '🚫' },
                                { value: 'natural', label: '자연스러움', emoji: '🌸' },
                                { value: 'dramatic', label: '진하게', emoji: '💄' }
                            ].map(m => (
                                <button
                                    key={m.value}
                                    onClick={() => setMakeupStyle(m.value as any)}
                                    className={`py-2 px-3 rounded-md text-sm font-semibold transition ${makeupStyle === m.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {m.emoji} {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {makeupStyle !== 'none' && (
                        <div>
                            <label className="text-sm text-gray-400">메이크업 강도: {makeupIntensity}%</label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={makeupIntensity}
                                onChange={(e) => setMakeupIntensity(parseInt(e.target.value))}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>
            )}

            {image && (
                <button
                    onClick={handleApply}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-md flex items-center justify-center gap-2"
                >
                    {isProcessing ? <><Spinner /> 적용 중...</> : <>💄 적용하기</>}
                </button>
            )}

            {resultUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 적용 완료!</h4>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">원본</p>
                            <img src={imageUrl!} alt="Original" className="w-full rounded-md" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">결과</p>
                            <img src={resultUrl} alt="Result" className="w-full rounded-md border-2 border-green-500" />
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const a = document.createElement('a');
                            a.href = resultUrl;
                            a.download = `hair_makeup_${Date.now()}.png`;
                            a.click();
                        }}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md"
                    >
                        📥 결과 다운로드
                    </button>
                </div>
            )}
        </div>
    );
};

export default HairMakeup;

import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface SkinToneAdjusterProps {
    onAdjustSkinTone: (image: File, tone: string, evenness: number, naturalness: number) => Promise<string>;
    isProcessing: boolean;
}

const SkinToneAdjuster: React.FC<SkinToneAdjusterProps> = ({ onAdjustSkinTone, isProcessing }) => {
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [tone, setTone] = useState<'lighter' | 'darker' | 'neutral'>('neutral');
    const [evenness, setEvenness] = useState(70);
    const [naturalness, setNaturalness] = useState(90);
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

        try {
            const result = await onAdjustSkinTone(image, tone, evenness, naturalness);
            setResultUrl(result);
        } catch (error) {
            console.error('Skin tone adjustment error:', error);
            alert('피부톤 조정에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200">🌟 피부톤 튜닝</h3>
            <p className="text-sm text-gray-400">
                피부톤을 균일하게 보정하고 밝기를 조절합니다.
            </p>

            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">1. 이미지 업로드</h4>
                <ImageDropzone onImageDrop={handleImageDrop} previewUrl={imageUrl} onClear={handleClearImage} />
            </div>

            {image && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">2. 피부톤 설정</h4>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">톤 조절</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'lighter', label: '밝게', emoji: '☀️' },
                                { value: 'neutral', label: '중립', emoji: '⚖️' },
                                { value: 'darker', label: '어둡게', emoji: '🌙' }
                            ].map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => setTone(t.value as any)}
                                    className={`py-2 px-3 rounded-md text-sm font-semibold transition ${tone === t.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {t.emoji} {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400">균일함: {evenness}%</label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={evenness}
                            onChange={(e) => setEvenness(parseInt(e.target.value))}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-gray-400">자연스러움: {naturalness}%</label>
                        <input
                            type="range"
                            min="50"
                            max="100"
                            value={naturalness}
                            onChange={(e) => setNaturalness(parseInt(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            )}

            {image && (
                <button
                    onClick={handleApply}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-md flex items-center justify-center gap-2"
                >
                    {isProcessing ? <><Spinner /> 조정 중...</> : <>🌟 피부톤 조정하기</>}
                </button>
            )}

            {resultUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 조정 완료!</h4>
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
                            a.download = `skin_tone_${Date.now()}.png`;
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

export default SkinToneAdjuster;

import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface FaceCorrectionProps {
    onCorrectFace: (image: File, correctionType: string, strength: number, naturalness: number) => Promise<string>;
    isProcessing: boolean;
}

const FaceCorrection: React.FC<FaceCorrectionProps> = ({ onCorrectFace, isProcessing }) => {
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [correctionType, setCorrectionType] = useState<'face' | 'hair' | 'body' | 'all'>('face');
    const [strength, setStrength] = useState(60);
    const [naturalness, setNaturalness] = useState(80);
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
            const result = await onCorrectFace(image, correctionType, strength, naturalness);
            setResultUrl(result);
        } catch (error) {
            console.error('Face correction error:', error);
            alert('보정에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-200">✨ 얼굴 보정</h3>
            <p className="text-sm text-gray-400">
                얼굴, 헤어, 바디를 자연스럽게 보정합니다.
            </p>

            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">1. 이미지 업로드</h4>
                <ImageDropzone onImageDrop={handleImageDrop} previewUrl={imageUrl} onClear={handleClearImage} />
            </div>

            {image && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">2. 보정 설정</h4>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">보정 영역</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { value: 'face', label: '얼굴', emoji: '😊' },
                                { value: 'hair', label: '헤어', emoji: '💇' },
                                { value: 'body', label: '바디', emoji: '🏃' },
                                { value: 'all', label: '전체', emoji: '✨' }
                            ].map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setCorrectionType(type.value as any)}
                                    className={`py-2 px-3 rounded-md text-sm font-semibold transition ${correctionType === type.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    {type.emoji} {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm text-gray-400">보정 강도: {strength}%</label>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            value={strength}
                            onChange={(e) => setStrength(parseInt(e.target.value))}
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
                    {isProcessing ? <><Spinner /> 보정 중...</> : <>✨ 보정하기</>}
                </button>
            )}

            {resultUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 보정 완료!</h4>
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
                            a.download = `face_corrected_${Date.now()}.png`;
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

export default FaceCorrection;

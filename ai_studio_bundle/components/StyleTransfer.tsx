import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface StyleTransferProps {
    onTransferStyle: (sourceImage: File, styleImage: File, strength: number) => Promise<string>;
    isProcessing: boolean;
}

const StyleTransfer: React.FC<StyleTransferProps> = ({ onTransferStyle, isProcessing }) => {
    const [sourceImage, setSourceImage] = useState<File | null>(null);
    const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
    const [styleImage, setStyleImage] = useState<File | null>(null);
    const [styleImageUrl, setStyleImageUrl] = useState<string | null>(null);
    const [strength, setStrength] = useState(70);
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    const handleSourceImageDrop = (file: File) => {
        if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
        setSourceImage(file);
        setSourceImageUrl(URL.createObjectURL(file));
        setResultUrl(null);
    };

    const handleStyleImageDrop = (file: File) => {
        if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
        setStyleImage(file);
        setStyleImageUrl(URL.createObjectURL(file));
        setResultUrl(null);
    };

    const handleClearSource = () => {
        if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
        setSourceImage(null);
        setSourceImageUrl(null);
        setResultUrl(null);
    };

    const handleClearStyle = () => {
        if (styleImageUrl) URL.revokeObjectURL(styleImageUrl);
        setStyleImage(null);
        setStyleImageUrl(null);
        setResultUrl(null);
    };

    const handleApply = async () => {
        if (!sourceImage || !styleImage) {
            alert('소스 이미지와 스타일 이미지를 모두 업로드해주세요.');
            return;
        }

        try {
            const result = await onTransferStyle(sourceImage, styleImage, strength);
            setResultUrl(result);
        } catch (error) {
            console.error('Style transfer error:', error);
            alert('스타일 적용에 실패했습니다.');
        }
    };

    const handleDownload = () => {
        if (!resultUrl) return;
        const a = document.createElement('a');
        a.href = resultUrl;
        a.download = `style_transfer_${Date.now()}.png`;
        a.click();
    };

    const quickPresets = [
        { name: '약하게', strength: 30, emoji: '🌸' },
        { name: '보통', strength: 50, emoji: '🎨' },
        { name: '강하게', strength: 70, emoji: '🔥' },
        { name: '최대', strength: 100, emoji: '⚡' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🎨 스타일 따라하기</h3>
                <div className="flex gap-2">
                    {quickPresets.map(preset => (
                        <button
                            key={preset.name}
                            onClick={() => setStrength(preset.strength)}
                            className={`text-xs py-1 px-2 rounded-md transition ${strength === preset.strength
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {preset.emoji} {preset.name}
                        </button>
                    ))}
                </div>
            </div>

            <p className="text-sm text-gray-400">
                참조 이미지의 스타일(색감, 분위기, 질감)을 소스 이미지에 적용합니다.
                스타일 강도를 조절하여 원하는 결과를 얻을 수 있습니다.
            </p>

            {/* 이미지 업로드 */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="text-base font-medium text-gray-300 mb-2">
                        1. 소스 이미지 <span className="text-red-400">*</span>
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">스타일을 적용할 이미지</p>
                    <ImageDropzone
                        onImageDrop={handleSourceImageDrop}
                        previewUrl={sourceImageUrl}
                        onClear={handleClearSource}
                    />
                </div>

                <div>
                    <h4 className="text-base font-medium text-gray-300 mb-2">
                        2. 스타일 참조 이미지 <span className="text-red-400">*</span>
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">따라할 스타일의 이미지</p>
                    <ImageDropzone
                        onImageDrop={handleStyleImageDrop}
                        previewUrl={styleImageUrl}
                        onClear={handleClearStyle}
                    />
                </div>
            </div>

            {/* 설정 */}
            {sourceImage && styleImage && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">3. 스타일 강도</h4>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-400">강도: {strength}%</label>
                            <span className="text-xs text-gray-500">
                                {strength < 40 ? '자연스러움' : strength < 70 ? '균형' : '강렬함'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="10"
                            value={strength}
                            onChange={(e) => setStrength(parseInt(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>10% (약함)</span>
                            <span>50% (보통)</span>
                            <span>100% (강함)</span>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-md p-3">
                        <p className="text-xs text-gray-400">
                            <strong className="text-indigo-400">💡 팁:</strong>
                            <br />
                            • 낮은 강도(10-40%): 원본 이미지의 특징을 유지하며 스타일만 살짝 적용
                            <br />
                            • 중간 강도(50-70%): 스타일과 원본의 균형있는 조화
                            <br />
                            • 높은 강도(80-100%): 스타일을 강하게 적용하여 완전히 다른 느낌
                        </p>
                    </div>
                </div>
            )}

            {/* 적용 버튼 */}
            {sourceImage && styleImage && (
                <button
                    onClick={handleApply}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Spinner />
                            스타일 적용 중...
                        </>
                    ) : (
                        <>
                            🎨 스타일 적용하기
                        </>
                    )}
                </button>
            )}

            {/* 결과 */}
            {resultUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 스타일 적용 완료!</h4>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">소스 이미지</p>
                            <img src={sourceImageUrl!} alt="Source" className="w-full rounded-md" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">스타일 참조</p>
                            <img src={styleImageUrl!} alt="Style" className="w-full rounded-md" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">결과</p>
                            <img src={resultUrl} alt="Result" className="w-full rounded-md border-2 border-green-500" />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition"
                        >
                            📥 결과 다운로드
                        </button>
                        <button
                            onClick={() => setResultUrl(null)}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-md transition"
                        >
                            새로 만들기
                        </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-400">
                            스타일 강도: {strength}%
                        </p>
                    </div>
                </div>
            )}

            {/* 안내 메시지 */}
            {!sourceImage || !styleImage ? (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                    <p className="text-xs text-blue-300">
                        💡 <strong>사용 방법:</strong>
                        <br />
                        1. 스타일을 적용할 소스 이미지를 업로드하세요
                        <br />
                        2. 따라할 스타일의 참조 이미지를 업로드하세요
                        <br />
                        3. 스타일 강도를 조절하고 적용하기 버튼을 클릭하세요
                        <br />
                        <br />
                        <strong>예시:</strong> 사진에 유화 스타일 적용, 만화 스타일 적용, 특정 색감 적용 등
                    </p>
                </div>
            ) : null}
        </div>
    );
};

export default StyleTransfer;

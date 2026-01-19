import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface ColorChangerProps {
    onChangeColor: (image: File, targetArea: string, newColor: string, preserveTexture: boolean) => Promise<string>;
    isProcessing: boolean;
}

const ColorChanger: React.FC<ColorChangerProps> = ({ onChangeColor, isProcessing }) => {
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [targetArea, setTargetArea] = useState<'clothing' | 'hair' | 'background' | 'all'>('clothing');
    const [newColor, setNewColor] = useState('#FF6B6B');
    const [preserveTexture, setPreserveTexture] = useState(true);
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
            const result = await onChangeColor(image, targetArea, newColor, preserveTexture);
            setResultUrl(result);
        } catch (error) {
            console.error('Color change error:', error);
            alert('색상 변경에 실패했습니다.');
        }
    };

    const colorPresets = [
        { name: '빨강', color: '#FF6B6B', emoji: '🔴' },
        { name: '파랑', color: '#4ECDC4', emoji: '🔵' },
        { name: '초록', color: '#95E1D3', emoji: '🟢' },
        { name: '노랑', color: '#FFE66D', emoji: '🟡' },
        { name: '보라', color: '#A8DADC', emoji: '🟣' },
        { name: '검정', color: '#2D3436', emoji: '⚫' },
        { name: '흰색', color: '#FFFFFF', emoji: '⚪' },
        { name: '분홍', color: '#FD79A8', emoji: '🌸' }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🎨 스타일 색상 바꾸기</h3>
            </div>

            <p className="text-sm text-gray-400">
                이미지의 특정 영역(의상, 헤어, 배경 등)의 색상을 변경합니다.
                질감을 유지하면서 색상만 바꿀 수 있습니다.
            </p>

            {/* 이미지 업로드 */}
            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">
                    1. 이미지 업로드 <span className="text-red-400">*</span>
                </h4>
                <ImageDropzone
                    onImageDrop={handleImageDrop}
                    previewUrl={imageUrl}
                    onClear={handleClearImage}
                />
            </div>

            {/* 설정 */}
            {image && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">2. 색상 변경 설정</h4>

                    {/* 대상 영역 */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">변경할 영역</label>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { value: 'clothing', label: '의상', emoji: '👔' },
                                { value: 'hair', label: '헤어', emoji: '💇' },
                                { value: 'background', label: '배경', emoji: '🖼️' },
                                { value: 'all', label: '전체', emoji: '🎨' }
                            ].map(area => (
                                <button
                                    key={area.value}
                                    onClick={() => setTargetArea(area.value as any)}
                                    className={`py-2 px-3 rounded-md text-sm font-semibold transition ${targetArea === area.value
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                >
                                    <div>{area.emoji}</div>
                                    <div className="text-xs mt-1">{area.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 색상 선택 */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">새 색상</label>
                        <div className="grid grid-cols-4 gap-2 mb-2">
                            {colorPresets.map(preset => (
                                <button
                                    key={preset.name}
                                    onClick={() => setNewColor(preset.color)}
                                    className={`py-2 px-3 rounded-md text-sm transition border-2 ${newColor === preset.color
                                            ? 'border-indigo-500'
                                            : 'border-gray-600 hover:border-gray-500'
                                        }`}
                                    style={{ backgroundColor: preset.color }}
                                >
                                    <div className="text-xs font-semibold" style={{
                                        color: preset.color === '#FFFFFF' || preset.color === '#FFE66D' ? '#000' : '#fff'
                                    }}>
                                        {preset.emoji} {preset.name}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                className="w-16 h-10 rounded cursor-pointer"
                            />
                            <input
                                type="text"
                                value={newColor}
                                onChange={(e) => setNewColor(e.target.value)}
                                className="flex-1 bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                                placeholder="#FF6B6B"
                            />
                        </div>
                    </div>

                    {/* 질감 유지 */}
                    <div>
                        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={preserveTexture}
                                onChange={(e) => setPreserveTexture(e.target.checked)}
                                className="rounded"
                            />
                            질감 및 디테일 유지 (권장)
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                            {preserveTexture
                                ? '원본의 질감, 주름, 패턴을 유지하면서 색상만 변경합니다'
                                : '단색으로 부드럽게 변경합니다 (질감 제거)'}
                        </p>
                    </div>
                </div>
            )}

            {/* 적용 버튼 */}
            {image && (
                <button
                    onClick={handleApply}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Spinner />
                            색상 변경 중...
                        </>
                    ) : (
                        <>
                            🎨 색상 변경하기
                        </>
                    )}
                </button>
            )}

            {/* 결과 */}
            {resultUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 색상 변경 완료!</h4>

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

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                const a = document.createElement('a');
                                a.href = resultUrl;
                                a.download = `color_changed_${Date.now()}.png`;
                                a.click();
                            }}
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

                    <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                        <p>변경 영역: {targetArea === 'clothing' ? '의상' : targetArea === 'hair' ? '헤어' : targetArea === 'background' ? '배경' : '전체'}</p>
                        <p>새 색상: <span style={{ color: newColor }}>●</span> {newColor}</p>
                        <p>질감 유지: {preserveTexture ? '✓' : '✗'}</p>
                    </div>
                </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                    💡 <strong>활용 예시:</strong>
                    <br />
                    • 의상 색상 변경: 빨간 드레스 → 파란 드레스
                    <br />
                    • 헤어 컬러 변경: 검은 머리 → 금발
                    <br />
                    • 배경 색상 변경: 흰색 배경 → 파란색 배경
                    <br />
                    • 전체 톤 변경: 따뜻한 톤 → 차가운 톤
                </p>
            </div>
        </div>
    );
};

export default ColorChanger;

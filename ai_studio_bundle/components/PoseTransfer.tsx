import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface PoseTransferProps {
    onTransferPose: (sourceImage: File, poseReference: File, accuracy: number) => Promise<string>;
    isProcessing: boolean;
}

const PoseTransfer: React.FC<PoseTransferProps> = ({ onTransferPose, isProcessing }) => {
    const [sourceImage, setSourceImage] = useState<File | null>(null);
    const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
    const [poseReference, setPoseReference] = useState<File | null>(null);
    const [poseReferenceUrl, setPoseReferenceUrl] = useState<string | null>(null);
    const [accuracy, setAccuracy] = useState(80);
    const [resultUrl, setResultUrl] = useState<string | null>(null);

    const handleSourceImageDrop = (file: File) => {
        if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
        setSourceImage(file);
        setSourceImageUrl(URL.createObjectURL(file));
        setResultUrl(null);
    };

    const handlePoseReferenceDrop = (file: File) => {
        if (poseReferenceUrl) URL.revokeObjectURL(poseReferenceUrl);
        setPoseReference(file);
        setPoseReferenceUrl(URL.createObjectURL(file));
        setResultUrl(null);
    };

    const handleClearSource = () => {
        if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
        setSourceImage(null);
        setSourceImageUrl(null);
        setResultUrl(null);
    };

    const handleClearPose = () => {
        if (poseReferenceUrl) URL.revokeObjectURL(poseReferenceUrl);
        setPoseReference(null);
        setPoseReferenceUrl(null);
        setResultUrl(null);
    };

    const handleApply = async () => {
        if (!sourceImage || !poseReference) {
            alert('소스 이미지와 포즈 참조 이미지를 모두 업로드해주세요.');
            return;
        }

        try {
            const result = await onTransferPose(sourceImage, poseReference, accuracy);
            setResultUrl(result);
        } catch (error) {
            console.error('Pose transfer error:', error);
            alert('포즈 적용에 실패했습니다.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🤸 포즈 따라하기</h3>
            </div>

            <p className="text-sm text-gray-400">
                참조 이미지의 포즈(자세, 몸의 위치)를 소스 이미지의 인물에 적용합니다.
                정확도를 조절하여 원하는 결과를 얻을 수 있습니다.
            </p>

            {/* 이미지 업로드 */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h4 className="text-base font-medium text-gray-300 mb-2">
                        1. 소스 이미지 <span className="text-red-400">*</span>
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">포즈를 적용할 인물 이미지</p>
                    <ImageDropzone
                        onImageDrop={handleSourceImageDrop}
                        previewUrl={sourceImageUrl}
                        onClear={handleClearSource}
                    />
                </div>

                <div>
                    <h4 className="text-base font-medium text-gray-300 mb-2">
                        2. 포즈 참조 이미지 <span className="text-red-400">*</span>
                    </h4>
                    <p className="text-xs text-gray-400 mb-2">따라할 포즈의 이미지</p>
                    <ImageDropzone
                        onImageDrop={handlePoseReferenceDrop}
                        previewUrl={poseReferenceUrl}
                        onClear={handleClearPose}
                    />
                </div>
            </div>

            {/* 설정 */}
            {sourceImage && poseReference && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">3. 포즈 정확도</h4>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm text-gray-400">정확도: {accuracy}%</label>
                            <span className="text-xs text-gray-500">
                                {accuracy < 50 ? '자유로움' : accuracy < 80 ? '균형' : '정확함'}
                            </span>
                        </div>
                        <input
                            type="range"
                            min="30"
                            max="100"
                            step="10"
                            value={accuracy}
                            onChange={(e) => setAccuracy(parseInt(e.target.value))}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>30% (자연스러움)</span>
                            <span>80% (권장)</span>
                            <span>100% (정확함)</span>
                        </div>
                    </div>

                    <div className="bg-gray-900 rounded-md p-3">
                        <p className="text-xs text-gray-400">
                            <strong className="text-indigo-400">💡 팁:</strong>
                            <br />
                            • 낮은 정확도(30-50%): 포즈를 참고하되 자연스럽게 변형
                            <br />
                            • 중간 정확도(60-80%): 포즈를 잘 따르면서도 자연스러움 유지 (권장)
                            <br />
                            • 높은 정확도(90-100%): 포즈를 정확하게 따라함
                        </p>
                    </div>
                </div>
            )}

            {/* 적용 버튼 */}
            {sourceImage && poseReference && (
                <button
                    onClick={handleApply}
                    disabled={isProcessing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Spinner />
                            포즈 적용 중...
                        </>
                    ) : (
                        <>
                            🤸 포즈 적용하기
                        </>
                    )}
                </button>
            )}

            {/* 결과 */}
            {resultUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 포즈 적용 완료!</h4>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">소스 이미지</p>
                            <img src={sourceImageUrl!} alt="Source" className="w-full rounded-md" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">포즈 참조</p>
                            <img src={poseReferenceUrl!} alt="Pose" className="w-full rounded-md" />
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
                                a.download = `pose_transfer_${Date.now()}.png`;
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

                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-gray-400">
                            포즈 정확도: {accuracy}%
                        </p>
                    </div>
                </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                    💡 <strong>활용 예시:</strong>
                    <br />
                    • 제품 모델 포즈 통일: 여러 모델을 동일한 포즈로 촬영한 것처럼 만들기
                    <br />
                    • 댄스 포즈 적용: 특정 댄스 동작을 다른 인물에게 적용
                    <br />
                    • 요가/운동 포즈: 정확한 자세를 다른 사람에게 적용
                    <br />
                    • 패션 포즈: 모델 포즈를 일반인 사진에 적용
                </p>
            </div>
        </div>
    );
};

export default PoseTransfer;

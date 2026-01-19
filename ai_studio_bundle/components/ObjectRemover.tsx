import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

type FillMethod = 'smart' | 'smooth' | 'structure';

interface ObjectRemoverProps {
  onRemoveObject: (image: File, description: string, fillMethod: FillMethod, edgeProtect: number) => Promise<string>;
  isProcessing: boolean;
}

const fillOptions: Array<{ value: FillMethod; title: string; description: string; icon: string }> = [
  {
    value: 'smart',
    title: '지능형 복원',
    description: '주변 배경을 분석해 자연스럽게 채웁니다.',
    icon: '🤖',
  },
  {
    value: 'smooth',
    title: '부드러운 블러',
    description: '촬영 스튜디오처럼 부드럽게 채웁니다.',
    icon: '🌫️',
  },
  {
    value: 'structure',
    title: '패턴 유지',
    description: '건물/패턴 등 규칙적인 영역을 정교하게 복원합니다.',
    icon: '🧱',
  },
];

const ObjectRemover: React.FC<ObjectRemoverProps> = ({ onRemoveObject, isProcessing }) => {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [fillMethod, setFillMethod] = useState<FillMethod>('smart');
  const [edgeProtect, setEdgeProtect] = useState(70);
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
      const cleaned = await onRemoveObject(image, description, fillMethod, edgeProtect);
      setResultUrl(cleaned);
    } catch (error) {
      console.error('Object remove error:', error);
      alert('피사체 제거에 실패했습니다.');
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `object_removed_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">🧼 피사체 지우기</h3>
        <span className="text-xs text-gray-400">원치 않는 사람/로고/오브젝트 제거</span>
      </div>

      <p className="text-sm text-gray-400">
        제거할 대상을 설명하면 AI가 배경을 자연스럽게 복원합니다. 패턴을 유지하거나 부드럽게 채우는 방식 중 선택할 수 있습니다.
      </p>

      <div>
        <h4 className="text-base font-medium text-gray-300 mb-2">
          1. 이미지 업로드 <span className="text-red-400">*</span>
        </h4>
        <ImageDropzone onImageDrop={handleImageDrop} previewUrl={imageUrl} onClear={handleClearImage} />
      </div>

      {image && (
        <>
          <div className="bg-gray-800 rounded-lg p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                2. 제거할 대상 설명 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                rows={2}
                placeholder="예: 왼쪽 구석의 사람, 정면 바닥에 떨어진 종이컵"
              />
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">3. 배경 복원 방식 선택</p>
              <div className="grid grid-cols-3 gap-2">
                {fillOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFillMethod(option.value)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${fillMethod === option.value
                      ? 'border-indigo-400 bg-indigo-500/20 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                      }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{option.icon}</span>
                      {option.title}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">4. 가장자리 보호 정도: {edgeProtect}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={edgeProtect}
                onChange={(e) => setEdgeProtect(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                <span>낮음 (배경 우선)</span>
                <span>높음 (주체 우선)</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={isProcessing || !description.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Spinner />
                피사체 제거 중...
              </>
            ) : (
              <>🧽 피사체 제거하기</>
            )}
          </button>
        </>
      )}

      {resultUrl && (
        <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
          <h4 className="text-base font-medium text-green-400 mb-3">✅ 제거 완료</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">원본</p>
              <img src={imageUrl!} alt="original" className="w-full rounded-md" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">결과</p>
              <img src={resultUrl} alt="cleaned" className="w-full rounded-md" />
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition"
          >
            📥 결과 다운로드
          </button>
        </div>
      )}
    </div>
  );
};

export default ObjectRemover;

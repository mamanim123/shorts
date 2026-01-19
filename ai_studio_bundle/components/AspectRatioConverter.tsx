import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

type ExtendMode = 'extend' | 'crop' | 'zoom';

interface AspectRatioConverterProps {
  onConvertAspect: (image: File, ratio: string, extendMode: ExtendMode, composition: number) => Promise<string>;
  isProcessing: boolean;
}

const ratioOptions = [
  { value: '1:1', label: '1:1 정사각형', note: '인스타 피드' },
  { value: '9:16', label: '9:16 세로', note: '쇼츠/릴스' },
  { value: '16:9', label: '16:9 가로', note: '유튜브' },
  { value: '4:5', label: '4:5 세로', note: '인스타' },
  { value: '3:4', label: '3:4 세로', note: '포스터' },
];

const extendModes: Array<{ value: ExtendMode; label: string; description: string; icon: string }> = [
  { value: 'extend', label: '배경 확장', description: '배경을 자연스럽게 연장합니다.', icon: '🌄' },
  { value: 'crop', label: '지능형 크롭', description: '주요 피사체를 중심으로 크롭합니다.', icon: '✂️' },
  { value: 'zoom', label: '부드러운 확대', description: '프레임을 약간 확대하여 채웁니다.', icon: '🔍' },
];

const AspectRatioConverter: React.FC<AspectRatioConverterProps> = ({ onConvertAspect, isProcessing }) => {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState<string>('9:16');
  const [mode, setMode] = useState<ExtendMode>('extend');
  const [composition, setComposition] = useState(70);
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
      const converted = await onConvertAspect(image, ratio, mode, composition);
      setResultUrl(converted);
    } catch (error) {
      console.error('Aspect ratio convert error:', error);
      alert('화면 비율 변환에 실패했습니다.');
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `aspect_ratio_${ratio.replace(':', '-')}_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">🖼️ 화면 비율 변환기</h3>
        <span className="text-xs text-gray-400">쇼츠/릴스/썸네일 비율 자동 맞춤</span>
      </div>

      <p className="text-sm text-gray-400">
        하나의 이미지를 다양한 플랫폼에 맞는 비율로 재구성합니다. 배경 확장, 지능형 크롭 등 원하는 방식으로 자동 변환합니다.
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
              <p className="text-sm text-gray-400 mb-2">2. 목표 비율</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ratioOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRatio(option.value)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${ratio === option.value
                      ? 'border-indigo-400 bg-indigo-500/20 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                      }`}
                  >
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{option.note}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">3. 변환 방식</p>
              <div className="grid grid-cols-3 gap-2">
                {extendModes.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${mode === option.value
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                      }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{option.icon}</span>
                      {option.label}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">4. 피사체 보호 정도: {composition}%</label>
              <input
                type="range"
                min={30}
                max={100}
                value={composition}
                onChange={(e) => setComposition(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                <span>배경 강조</span>
                <span>주체 고정</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleApply}
            disabled={isProcessing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Spinner />
                비율 변환 중...
              </>
            ) : (
              <>🖼️ 새 비율로 변환하기</>
            )}
          </button>
        </>
      )}

      {resultUrl && (
        <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
          <h4 className="text-base font-medium text-green-400 mb-3">✅ 변환 완료</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">원본</p>
              <img src={imageUrl!} alt="original" className="w-full rounded-md" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">결과 ({ratio})</p>
              <img src={resultUrl} alt="converted" className="w-full rounded-md" />
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

export default AspectRatioConverter;

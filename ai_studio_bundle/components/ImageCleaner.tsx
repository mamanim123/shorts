import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface CleanOptions {
  denoise: boolean;
  sharpen: boolean;
  restoreColor: boolean;
  removeArtifacts: boolean;
  intensity: number;
}

interface ImageCleanerProps {
  onCleanImage: (image: File, options: CleanOptions) => Promise<string>;
  isProcessing: boolean;
}

const ImageCleaner: React.FC<ImageCleanerProps> = ({ onCleanImage, isProcessing }) => {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [options, setOptions] = useState<CleanOptions>({
    denoise: true,
    sharpen: true,
    restoreColor: true,
    removeArtifacts: false,
    intensity: 65,
  });
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

  const toggleOption = (key: keyof CleanOptions) => {
    if (key === 'intensity') return;
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApply = async () => {
    if (!image) {
      alert('이미지를 업로드해주세요.');
      return;
    }

    try {
      const cleaned = await onCleanImage(image, options);
      setResultUrl(cleaned);
    } catch (error) {
      console.error('Image clean error:', error);
      alert('이미지 클리닝에 실패했습니다.');
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const link = document.createElement('a');
    link.href = resultUrl;
    link.download = `image_clean_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">🧽 이미지 클리너</h3>
        <span className="text-xs text-gray-400">노이즈 제거 · 색상 복원 · 디테일 향상</span>
      </div>

      <p className="text-sm text-gray-400">
        구형 사진이나 저화질 이미지를 깨끗하게 복원합니다. 필요한 옵션만 선택하여 세밀하게 조정하세요.
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
              <p className="text-sm text-gray-400 mb-2">2. 적용할 클리닝 옵션</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'denoise', label: '노이즈 제거', desc: 'ISO 노이즈, 픽셀 노이즈를 줄입니다.', icon: '🎛️' },
                  { key: 'sharpen', label: '선명도 향상', desc: '중요한 윤곽선을 또렷하게 만듭니다.', icon: '🔎' },
                  { key: 'restoreColor', label: '색상 복원', desc: '바랜 색감을 자연스럽게 복구합니다.', icon: '🎨' },
                  { key: 'removeArtifacts', label: '압축 자국 제거', desc: 'JPEG 블록/스크래치를 최소화합니다.', icon: '🧬' },
                ].map(option => (
                  <button
                    key={option.key}
                    onClick={() => toggleOption(option.key as keyof CleanOptions)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${options[option.key as keyof CleanOptions]
                      ? 'border-emerald-400 bg-emerald-500/10 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500'
                      }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <span>{option.icon}</span>
                      {option.label}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">3. 전체 보정 강도: {options.intensity}%</label>
              <input
                type="range"
                min={30}
                max={100}
                value={options.intensity}
                onChange={(e) => setOptions(prev => ({ ...prev, intensity: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                <span>자연스러움</span>
                <span>강력한 복원</span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-md p-3 text-xs text-gray-400">
              <strong className="text-emerald-300">💡 Tip.</strong> 오래된 사진이라면 노이즈 제거 + 색상 복원을 켠 뒤 강도를 70% 이상으로 설정하면 깨끗한 결과를 얻을 수 있습니다.
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
                이미지 정리 중...
              </>
            ) : (
              <>🧼 클리닝 실행하기</>
            )}
          </button>
        </>
      )}

      {resultUrl && (
        <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
          <h4 className="text-base font-medium text-green-400 mb-3">✅ 정리 완료</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">원본</p>
              <img src={imageUrl!} alt="original" className="w-full rounded-md" />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">결과</p>
              <img src={resultUrl} alt="clean" className="w-full rounded-md" />
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

export default ImageCleaner;

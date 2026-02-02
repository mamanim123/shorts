import React, { useState, useEffect, useCallback } from 'react';
import Spinner from './Spinner';
import { ImageResult } from '../types';

// gif.js 스크립트에서 전역으로 선언된 GIF 객체를 TypeScript에 알립니다.
declare var GIF: any;

interface GifCreatorProps {
  images: (ImageResult & { imageUrl: string })[];
  onClose: () => void;
}

const GifCreator: React.FC<GifCreatorProps> = ({ images, onClose }) => {
  const [delay, setDelay] = useState(500); // 밀리초
  const [status, setStatus] = useState<'idle' | 'creating' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    if (status !== 'idle' || images.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setPreviewIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, delay);

    return () => clearInterval(intervalId);
  }, [delay, images, status]);


  const handleCreateGif = useCallback(async () => {
    setStatus('creating');
    setProgress(0);

    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js',
    });

    try {
        const imageElements = await Promise.all(
          images.map(image => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            // img.crossOrigin = "Anonymous"; // 데이터 URL에는 crossOrigin이 필요 없으며, 문제를 일으킬 수 있어 제거합니다.
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`이미지 로딩 실패: ${image.prompt}`));
            img.src = image.imageUrl;
          }))
        );
        
        imageElements.forEach(img => {
            gif.addFrame(img, { delay: delay });
        });
    
        gif.on('progress', (p: number) => {
          setProgress(Math.round(p * 100));
        });
    
        gif.on('finished', (blob: Blob) => {
          const url = URL.createObjectURL(blob);
          setGifUrl(url);
          setStatus('done');
          setProgress(100);
        });
    
        gif.render();

    } catch (error) {
        console.error("GIF 생성 오류:", error);
        alert((error as Error).message || "GIF 생성 중 오류가 발생했습니다.");
        setStatus('idle');
    }
  }, [images, delay]);
  
  // 컴포넌트 언마운트 시 생성된 Object URL 정리
  useEffect(() => {
    return () => {
        if (gifUrl) {
            URL.revokeObjectURL(gifUrl);
        }
    }
  }, [gifUrl]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-6 relative">
        <header className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">GIF 만들기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="닫기">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-grow overflow-y-auto min-h-[200px]">
            {status === 'done' && gifUrl ? (
                <div className="flex flex-col items-center justify-center h-full">
                    <img src={gifUrl} alt="생성된 GIF" className="max-w-full max-h-[400px] object-contain rounded-md border border-gray-600" />
                </div>
            ) : status === 'creating' ? (
                 <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-white">
                    <Spinner />
                    <p className="mt-4 text-lg">GIF 생성 중...</p>
                    <div className="w-full bg-gray-600 rounded-full h-2.5 mt-2">
                        <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{progress}%</p>
                </div>
            ) : (
                <div className="flex flex-col h-full">
                    <div className="flex-grow flex items-center justify-center mb-4 min-h-[300px]">
                        {images.length > 0 ? (
                            <img
                                src={images[previewIndex].imageUrl}
                                alt="GIF preview"
                                className="max-w-full max-h-[350px] object-contain rounded-md border border-gray-600"
                            />
                        ) : (
                            <p className="text-gray-500">미리볼 이미지가 없습니다.</p>
                        )}
                    </div>
                    <div className="flex-shrink-0">
                        <p className="text-xs text-gray-400 mb-2 text-center">프레임 목록 (클릭하여 이동)</p>
                        <div className="flex gap-2 justify-center p-2 overflow-x-auto">
                            {images.map((image, index) => (
                                <button
                                    key={image.id}
                                    onClick={() => setPreviewIndex(index)}
                                    className={`w-16 h-16 rounded-md border-2 cursor-pointer transition-all flex-shrink-0 ${
                                        previewIndex === index ? 'border-indigo-500 scale-105' : 'border-gray-600 hover:border-gray-500'
                                    }`}
                                    aria-label={`프레임 ${index + 1}으로 이동`}
                                >
                                    <img
                                        src={image.imageUrl}
                                        alt={`프레임 ${index + 1}`}
                                        className="w-full h-full object-cover rounded"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <footer className="flex flex-col sm:flex-row items-center gap-4 pt-4 border-t border-gray-700">
            {status !== 'creating' && (
                <div className="w-full sm:w-1/2">
                    <label htmlFor="delay-slider" className="block text-sm font-medium text-gray-300 mb-2">
                        프레임 간격 (속도): <span className="text-indigo-400 font-semibold">{delay}ms</span>
                    </label>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400">빠름</span>
                        <input
                            id="delay-slider"
                            type="range"
                            min="100"
                            max="2000"
                            step="100"
                            value={delay}
                            onChange={(e) => setDelay(Number(e.target.value))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            disabled={status !== 'idle'}
                        />
                        <span className="text-xs text-gray-400">느림</span>
                    </div>
                </div>
            )}
            
            <div className="w-full sm:w-1/2 flex justify-end gap-3">
                 {status === 'idle' && (
                    <button
                        onClick={handleCreateGif}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition"
                    >
                        GIF 생성
                    </button>
                )}
                {status === 'done' && gifUrl && (
                    <a
                        href={gifUrl}
                        download="ai-generated.gif"
                        className="w-full sm:w-auto text-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                    >
                        GIF 다운로드
                    </a>
                )}
            </div>
        </footer>
      </div>
    </div>
  );
};

export default GifCreator;
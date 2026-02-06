import React, { useState, useCallback, useRef } from 'react';
import Lightbox from './Lightbox';

interface ImageDropzoneProps {
  onImageDrop: (file: File) => void;
  previewUrl: string | null;
  onClear: () => void;
  onPreviewClick?: (url: string) => void;
  onDownload?: () => void;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ onImageDrop, previewUrl, onClear, onPreviewClick, onDownload }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalLightboxUrl, setInternalLightboxUrl] = useState<string | null>(null);

  const handleDragEvent = (e: React.DragEvent<HTMLDivElement>, isOver: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(isOver);
  };

  const buildLocalUrl = (filename: string, storyId?: string): string => {
    const trimmed = filename.replace(/^\/+/, '');
    if (trimmed.startsWith('대본폴더/')) {
      return `/generated_scripts/${trimmed}`;
    }
    if (trimmed.includes('/')) {
      return `/generated_scripts/${trimmed}`;
    }
    if (storyId) {
      return `/generated_scripts/대본폴더/${storyId}/images/${trimmed}`;
    }
    return `/generated_scripts/images/${trimmed}`;
  };

  const fetchFileFromUrl = async (url: string, fallbackName = 'dropped-image.png'): Promise<File | null> => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const nameFromUrl = url.split('/').pop() || fallbackName;
      const safeName = nameFromUrl.includes('.') ? nameFromUrl : fallbackName;
      return new File([blob], safeName, { type: blob.type || 'image/png' });
    } catch {
      return null;
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvent(e, false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageDrop(file);
      } else {
        alert('이미지 파일을 드롭해주세요.');
      }
      return;
    }

    const jsonString = e.dataTransfer.getData('application/json');
    if (jsonString) {
      try {
        const payload = JSON.parse(jsonString);
        if (payload?.type === 'image-history') {
          const payloadUrl = payload.url
            ? String(payload.url)
            : (payload.localFilename ? buildLocalUrl(String(payload.localFilename), payload.storyId) : '');
          if (payloadUrl) {
            fetchFileFromUrl(payloadUrl).then((file) => {
              if (file && file.type.startsWith('image/')) {
                onImageDrop(file);
              } else {
                alert('이미지 파일을 드롭해주세요.');
              }
            });
            return;
          }
        }
      } catch {
        // ignore invalid json
      }
    }

    const uriList = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (uriList) {
      fetchFileFromUrl(uriList.trim()).then((file) => {
        if (file && file.type.startsWith('image/')) {
          onImageDrop(file);
        } else {
          alert('이미지 파일을 드롭해주세요.');
        }
      });
    }
  }, [onImageDrop]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageDrop(e.target.files[0]);
    }
  };

  const handleContainerClick = () => {
    if (!previewUrl) {
        fileInputRef.current?.click();
    }
  };

  const handlePreview = () => {
    if (!previewUrl) return;
    if (onPreviewClick) {
      onPreviewClick(previewUrl);
    } else {
      setInternalLightboxUrl(previewUrl);
    }
  };

  return (
    <div className="w-full">
      <div
        onClick={handleContainerClick}
        onDragOver={(e) => handleDragEvent(e, true)}
        onDragEnter={(e) => handleDragEvent(e, true)}
        onDragLeave={(e) => handleDragEvent(e, false)}
        onDrop={handleDrop}
        className={`relative group w-full h-64 border-2 border-dashed rounded-lg transition-colors duration-200 flex justify-center items-center
          ${isDraggingOver ? 'border-indigo-400 bg-gray-700' : 'border-gray-600 hover:border-gray-500'}
          ${previewUrl ? '' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        {previewUrl ? (
          <>
            <img 
                src={previewUrl} 
                alt="Image preview" 
                className="object-contain h-full w-full rounded-lg cursor-pointer"
                onClick={handlePreview}
            />
            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDownload && (
                  <button
                      onClick={(e) => { e.stopPropagation(); onDownload(); }}
                      className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75"
                      aria-label="수정된 이미지 다운로드"
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                  </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75"
                    aria-label="이미지 제거"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2">이곳에 이미지를 드래그 앤 드롭하세요</p>
            <p className="text-sm">또는 클릭하여 파일을 선택하세요</p>
          </div>
        )}
      </div>
      {internalLightboxUrl && (
        <Lightbox imageUrl={internalLightboxUrl} onClose={() => setInternalLightboxUrl(null)} />
      )}
    </div>
  );
};

export default ImageDropzone;

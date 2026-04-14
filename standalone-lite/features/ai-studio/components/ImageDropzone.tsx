import React, { useCallback, useRef, useState } from 'react';
import FusionLightbox from './FusionLightbox';

interface ImageDropzoneProps {
  onImageDrop: (file: File) => void;
  previewUrl: string | null;
  onClear: () => void;
  onPreviewClick?: (url: string) => void;
  onDownload?: () => void;
}

const buildLocalUrl = (filename: string, storyId?: string): string => {
  const trimmed = filename.replace(/^\/+/, '');
  if (trimmed.startsWith('대본폴더/')) return `/generated_scripts/${trimmed}`;
  if (trimmed.includes('/')) return `/generated_scripts/${trimmed}`;
  if (storyId) return `/generated_scripts/대본폴더/${storyId}/images/${trimmed}`;
  return `/generated_scripts/images/${trimmed}`;
};

const fetchFileFromUrl = async (url: string, fallbackName = 'dropped-image.png'): Promise<File | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const urlName = url.split('/').pop() || fallbackName;
    const safeName = urlName.includes('.') ? urlName : fallbackName;
    return new File([blob], safeName, { type: blob.type || 'image/png' });
  } catch {
    return null;
  }
};

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ onImageDrop, previewUrl, onClear, onPreviewClick, onDownload }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [internalLightboxUrl, setInternalLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEvent = (event: React.DragEvent<HTMLDivElement>, isOver: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(isOver);
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      handleDragEvent(event, false);

      const file = event.dataTransfer.files[0];
      if (file) {
        if (file.type.startsWith('image/')) {
          onImageDrop(file);
        }
        return;
      }

      const jsonString = event.dataTransfer.getData('application/json');
      if (jsonString) {
        try {
          const payload = JSON.parse(jsonString) as { type?: string; url?: string; localFilename?: string; storyId?: string };
          if (payload.type === 'image-history') {
            const payloadUrl = payload.url || (payload.localFilename ? buildLocalUrl(payload.localFilename, payload.storyId) : '');
            if (payloadUrl) {
              fetchFileFromUrl(payloadUrl).then((resolvedFile) => {
                if (resolvedFile && resolvedFile.type.startsWith('image/')) {
                  onImageDrop(resolvedFile);
                }
              });
            }
          }
        } catch {
          // ignore invalid payload
        }
      }
    },
    [onImageDrop],
  );

  const handlePreview = () => {
    if (!previewUrl) return;
    if (onPreviewClick) {
      onPreviewClick(previewUrl);
      return;
    }
    setInternalLightboxUrl(previewUrl);
  };

  return (
    <div className="w-full">
      <div
        onClick={() => !previewUrl && fileInputRef.current?.click()}
        onDragOver={(event) => handleDragEvent(event, true)}
        onDragEnter={(event) => handleDragEvent(event, true)}
        onDragLeave={(event) => handleDragEvent(event, false)}
        onDrop={handleDrop}
        className={`relative group w-full h-64 border-2 border-dashed rounded-lg transition-colors duration-200 flex justify-center items-center ${
          isDraggingOver ? 'border-indigo-400 bg-gray-700' : 'border-gray-600 hover:border-gray-500'
        } ${previewUrl ? '' : 'cursor-pointer'}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(event) => {
            const nextFile = event.target.files?.[0];
            if (nextFile) onImageDrop(nextFile);
          }}
          accept="image/*"
          className="hidden"
        />
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="Image preview" className="object-contain h-full w-full rounded-lg cursor-pointer" onClick={handlePreview} />
            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {onDownload && (
                <button onClick={(event) => { event.stopPropagation(); onDownload(); }} className="bg-black/50 text-white rounded-full p-2 hover:bg-black/75" aria-label="수정된 이미지 다운로드">
                  ⬇
                </button>
              )}
              <button onClick={(event) => { event.stopPropagation(); onClear(); }} className="bg-black/50 text-white rounded-full p-2 hover:bg-black/75" aria-label="이미지 제거">
                ×
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <p className="mt-2">이곳에 이미지를 드래그 앤 드롭하세요</p>
            <p className="text-sm">또는 클릭하여 파일을 선택하세요</p>
          </div>
        )}
      </div>
      {internalLightboxUrl && <FusionLightbox imageUrl={internalLightboxUrl} onClose={() => setInternalLightboxUrl(null)} />}
    </div>
  );
};

export default ImageDropzone;

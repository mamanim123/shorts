import React, { useEffect, useRef, useState } from 'react';
import type { EditingState } from '../types';
import Spinner from './Spinner';

type SpecialEditAction = 'text' | 'background' | 'restoration' | 'painting' | 'chest-cover';

interface ImageEditorControlsProps {
  sourceImages: { id: string; file: File | null; name: string }[];
  activeEditingImageId: string | null;
  setActiveEditingImageId: (id: string) => void;
  activeImageUrl?: string | null;
  editPrompt: string;
  setEditPrompt: (value: string) => void;
  editingState: EditingState;
  onEditImage: (mask?: { data: string; mimeType: string }) => void;
  onSpecialEdit: (action: SpecialEditAction) => void;
  onUpscale: (scale: 2 | 4) => void;
  onGeneratePrompt: () => void;
  onGeneratePersonDetails: () => void;
  onAgeChange: (age: 20 | 30 | 40 | 50) => void;
  onMultiAgeGeneration: () => void;
}

const specialActions: SpecialEditAction[] = ['text', 'background', 'restoration', 'painting', 'chest-cover'];

const ImageEditorControls: React.FC<ImageEditorControlsProps> = ({
  sourceImages,
  activeEditingImageId,
  setActiveEditingImageId,
  activeImageUrl,
  editPrompt,
  setEditPrompt,
  editingState,
  onEditImage,
  onSpecialEdit,
  onUpscale,
  onGeneratePrompt,
  onGeneratePersonDetails,
  onAgeChange,
  onMultiAgeGeneration,
}) => {
  const [isMaskMode, setIsMaskMode] = useState(false);
  const [brushSize, setBrushSize] = useState(24);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const resetMaskCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const syncCanvasSize = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    resetMaskCanvas();
  };

  useEffect(() => {
    syncCanvasSize();
  }, [activeEditingImageId, activeImageUrl]);

  if (!sourceImages.some((image) => image.file)) return null;

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const buildMaskBase64 = (): { data: string; mimeType: string } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    if (!context) return null;

    const processed = document.createElement('canvas');
    processed.width = canvas.width;
    processed.height = canvas.height;
    const processedContext = processed.getContext('2d');
    if (!processedContext) return null;

    processedContext.drawImage(canvas, 0, 0);
    const imageData = processedContext.getImageData(0, 0, processed.width, processed.height);
    const raw = imageData.data;
    for (let index = 0; index < raw.length; index += 4) {
      if (raw[index + 3] > 0) {
        raw[index] = 255;
        raw[index + 1] = 255;
        raw[index + 2] = 255;
        raw[index + 3] = 255;
      }
    }
    processedContext.putImageData(imageData, 0, 0);
    return { data: processed.toDataURL('image/png').split(',')[1], mimeType: 'image/png' };
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-200 mb-2">1b. 참조 이미지 수정</h2>
      <div className="mb-4 flex border-b border-gray-700 overflow-x-auto">
        {sourceImages.map((image, index) =>
          image.file ? (
            <button
              key={image.id}
              onClick={() => setActiveEditingImageId(image.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md whitespace-nowrap ${
                activeEditingImageId === image.id ? 'border-b-2 border-indigo-500 text-white bg-gray-800' : 'text-gray-400 hover:bg-gray-700/50'
              }`}
            >
              이미지 {index + 1} 수정
            </button>
          ) : null,
        )}
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input type="checkbox" checked={isMaskMode} onChange={(event) => setIsMaskMode(event.target.checked)} disabled={editingState !== 'idle'} className="h-4 w-4" />
            마스크 편집 사용
          </label>
          {isMaskMode && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400" htmlFor="mask-brush">브러시</label>
              <input id="mask-brush" type="range" min={8} max={64} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} className="accent-indigo-500" />
              <button type="button" onClick={resetMaskCanvas} disabled={editingState !== 'idle'} className="px-2 py-1 text-xs rounded-md bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600">마스크 지우기</button>
            </div>
          )}
        </div>

        {isMaskMode && activeImageUrl && (
          <div className="relative w-full overflow-hidden rounded-md border border-gray-700 bg-gray-900">
            <img ref={imageRef} src={activeImageUrl} alt="mask-preview" className="w-full h-auto block" onLoad={syncCanvasSize} />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              onPointerDown={(event) => {
                if (!isMaskMode || editingState !== 'idle') return;
                const point = getCanvasPoint(event);
                const context = canvasRef.current?.getContext('2d');
                if (!point || !context) return;
                context.strokeStyle = 'rgba(255, 0, 0, 0.6)';
                context.lineWidth = brushSize;
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.beginPath();
                context.moveTo(point.x, point.y);
                setIsDrawing(true);
              }}
              onPointerMove={(event) => {
                if (!isDrawing) return;
                const point = getCanvasPoint(event);
                const context = canvasRef.current?.getContext('2d');
                if (!point || !context) return;
                context.lineTo(point.x, point.y);
                context.stroke();
              }}
              onPointerUp={() => {
                const context = canvasRef.current?.getContext('2d');
                if (context) context.closePath();
                setIsDrawing(false);
              }}
              onPointerLeave={() => setIsDrawing(false)}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editPrompt}
            onChange={(event) => setEditPrompt(event.target.value)}
            placeholder="예: 하늘을 보라색으로 만들어 줘"
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-3"
            disabled={editingState !== 'idle'}
          />
          <button
            onClick={() => onEditImage(isMaskMode ? buildMaskBase64() || undefined : undefined)}
            disabled={editingState !== 'idle' || !editPrompt.trim()}
            className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-600 min-w-[90px]"
          >
            {editingState === 'prompt' ? <Spinner size="sm" /> : '수정 적용'}
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            onChange={(event) => {
              const value = event.target.value;
              if (specialActions.includes(value as SpecialEditAction)) {
                onSpecialEdit(value as SpecialEditAction);
              }
              event.target.value = '';
            }}
            disabled={editingState !== 'idle'}
            className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5"
            defaultValue=""
          >
            <option value="" disabled>빠른 수정</option>
            <option value="text">텍스트 제거</option>
            <option value="background">배경 제거</option>
            <option value="restoration">사진 복원</option>
            <option value="painting">그림 변환</option>
            <option value="chest-cover">가슴골 제거</option>
          </select>

          <select
            onChange={(event) => {
              const value = event.target.value;
              if (value === '2x') onUpscale(2);
              if (value === '4x') onUpscale(4);
              if (value === 'prompt') onGeneratePrompt();
              if (value === 'details') onGeneratePersonDetails();
              event.target.value = '';
            }}
            disabled={editingState !== 'idle'}
            className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5"
            defaultValue=""
          >
            <option value="" disabled>작업 선택</option>
            <option value="2x">2x 업스케일</option>
            <option value="4x">4x 업스케일</option>
            <option value="prompt">프롬프트 생성</option>
            <option value="details">인물 디테일 추출</option>
          </select>

          <select
            onChange={(event) => {
              const value = event.target.value;
              if (value === '20' || value === '30' || value === '40' || value === '50') {
                onAgeChange(Number(value) as 20 | 30 | 40 | 50);
              }
              event.target.value = '';
            }}
            disabled={editingState !== 'idle'}
            className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5"
            defaultValue=""
          >
            <option value="" disabled>나이 변환</option>
            <option value="20">20대</option>
            <option value="30">30대</option>
            <option value="40">40대</option>
            <option value="50">50대</option>
          </select>

          <button onClick={onMultiAgeGeneration} disabled={editingState !== 'idle'} className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-orange-400 rounded-md disabled:bg-gray-600 text-xs font-semibold">
            {editingState === 'age-multi' ? <Spinner size="sm" /> : '동시 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorControls;

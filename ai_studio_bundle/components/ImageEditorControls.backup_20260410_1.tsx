
import React, { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner';

type EditingState = 'idle' | 'prompt' | 'text' | 'background' | 'generating-prompt' | 'restoration' | 'age-20' | 'age-30' | 'age-40' | 'age-50' | 'age-multi' | 'upscale-2x' | 'upscale-4x' | 'painting' | 'generating-details' | 'object-remove' | 'aspect' | 'image-clean' | 'chest-cover';

interface TurnaroundPreview {
    key: 'front' | 'angle45' | 'back';
    label: string;
    imageUrl: string;
}

interface ImageEditorControlsProps {
    sourceImages: { id: string; file: File | null; name: string }[];
    activeEditingImageId: string | null;
    setActiveEditingImageId: (id: string) => void;
    activeImageUrl?: string | null;
    editPrompt: string;
    setEditPrompt: (val: string) => void;
    editingState: EditingState;
    onEditImage: (mask?: { data: string; mimeType: string }) => void;
    onSpecialEdit: (action: 'text' | 'background' | 'restoration' | 'painting' | 'chest-cover') => void;
    onUpscale: (scale: 2 | 4) => void;
    onGeneratePrompt: () => void;
    onGeneratePersonDetails: () => void;
    onAgeChange: (age: 20 | 30 | 40 | 50 | 60) => void;
    onMultiAgeGeneration: () => void;
    bodyEnhanceLevel: number;
    setBodyEnhanceLevel: (val: number) => void;
    turnaroundOutfitMode: 'preserve' | 'neutral';
    setTurnaroundOutfitMode: (value: 'preserve' | 'neutral') => void;
    onGenerateTurnaround: () => void;
    turnaroundPreviews: TurnaroundPreview[];
    isGeneratingTurnaround: boolean;
    isTurnaroundApproved: boolean;
    turnaroundName: string;
    setTurnaroundName: (value: string) => void;
    onApproveTurnaround: () => void;
    onSaveTurnaround: () => void;
}

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
    turnaroundOutfitMode,
    setTurnaroundOutfitMode,
    onGenerateTurnaround,
    turnaroundPreviews,
    isGeneratingTurnaround,
    isTurnaroundApproved,
    turnaroundName,
    setTurnaroundName,
    onApproveTurnaround,
    onSaveTurnaround
}) => {
    if (!sourceImages.some(img => img.file)) return null;

    const [isMaskMode, setIsMaskMode] = useState(false);
    const [brushSize, setBrushSize] = useState(24);
    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    const resetMaskCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const syncCanvasSize = () => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img) return;
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        resetMaskCanvas();
    };

    useEffect(() => {
        syncCanvasSize();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeEditingImageId, activeImageUrl]);

    const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (event.clientX - rect.left) * scaleX,
            y: (event.clientY - rect.top) * scaleY,
        };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isMaskMode || editingState !== 'idle') return;
        const ctx = canvasRef.current?.getContext('2d');
        const point = getCanvasPoint(event);
        if (!ctx || !point) return;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        setIsDrawing(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        const point = getCanvasPoint(event);
        if (!ctx || !point) return;
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
    };

    const handlePointerUp = () => {
        if (!isDrawing) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.closePath();
        }
        setIsDrawing(false);
    };

    const buildMaskBase64 = (): { data: string; mimeType: string } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const processed = document.createElement('canvas');
        processed.width = canvas.width;
        processed.height = canvas.height;
        const pctx = processed.getContext('2d');
        if (!pctx) return null;
        pctx.drawImage(canvas, 0, 0);

        const imgData = pctx.getImageData(0, 0, processed.width, processed.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
                data[i + 3] = 255;
            }
        }
        pctx.putImageData(imgData, 0, 0);
        const dataUrl = processed.toDataURL('image/png');
        return { data: dataUrl.split(',')[1], mimeType: 'image/png' };
    };

    const handleApplyEdit = () => {
        if (!isMaskMode) {
            onEditImage();
            return;
        }
        const mask = buildMaskBase64();
        if (!mask) {
            onEditImage();
            return;
        }
        onEditImage(mask);
    };

    return (
        <div>
            <h2 className="text-xl font-semibold text-gray-200 mb-2">1b. 참조 이미지 수정 (선택 사항)</h2>
            <div className="mb-4 flex border-b border-gray-700 overflow-x-auto">
                {sourceImages.map((image, index) => (
                    image.file && (
                        <button
                            key={image.id}
                            onClick={() => setActiveEditingImageId(image.id)}
                            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t-md whitespace-nowrap ${activeEditingImageId === image.id ? 'border-b-2 border-indigo-500 text-white bg-gray-800' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            이미지 {index + 1} 수정
                        </button>
                    )
                ))}
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <input
                            id="mask-mode-toggle"
                            type="checkbox"
                            checked={isMaskMode}
                            onChange={(e) => setIsMaskMode(e.target.checked)}
                            disabled={editingState !== 'idle'}
                            className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                        />
                        <label htmlFor="mask-mode-toggle" className="text-sm text-gray-200">
                            마스크 편집 사용
                        </label>
                    </div>
                    {isMaskMode && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400" htmlFor="mask-brush">브러시</label>
                            <input
                                id="mask-brush"
                                type="range"
                                min={8}
                                max={64}
                                value={brushSize}
                                onChange={(e) => setBrushSize(Number(e.target.value))}
                                className="accent-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={resetMaskCanvas}
                                disabled={editingState !== 'idle'}
                                className="px-2 py-1 text-xs rounded-md bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600"
                            >
                                마스크 지우기
                            </button>
                        </div>
                    )}
                </div>

                {isMaskMode && activeImageUrl && (
                    <div className="relative w-full overflow-hidden rounded-md border border-gray-700 bg-gray-900">
                        <img
                            ref={imageRef}
                            src={activeImageUrl}
                            alt="mask-preview"
                            className="w-full h-auto block"
                            onLoad={syncCanvasSize}
                        />
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full cursor-crosshair"
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                        />
                        <div className="absolute left-2 bottom-2 rounded bg-black/60 px-2 py-1 text-xs text-gray-200">
                            수정할 영역을 칠하세요 (흰색 마스크로 전송)
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="예: '하늘을 보라색으로 만들어 줘'"
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        disabled={editingState !== 'idle'}
                    />
                    <button onClick={handleApplyEdit} disabled={editingState !== 'idle' || !editPrompt.trim()} className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-sm min-w-[90px]">
                        {editingState === 'prompt' ? <Spinner size="sm" /> : '수정 적용'}
                    </button>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-400 whitespace-nowrap">빠른 수정:</p>
                        <div className="relative inline-flex items-center gap-2">
                            <select 
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onSpecialEdit(e.target.value as any);
                                        e.target.value = "";
                                    }
                                }}
                                disabled={editingState !== 'idle'}
                                className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-all cursor-pointer disabled:bg-gray-800 disabled:text-gray-500"
                                value=""
                            >
                                <option value="" disabled>기능 선택</option>
                                <option value="text">텍스트 제거</option>
                                <option value="background">배경 제거</option>
                                <option value="restoration">사진 복원</option>
                                <option value="painting">그림 변환</option>
                                <option value="chest-cover">가슴골 제거</option>
                            </select>
                            {['text', 'background', 'restoration', 'painting', 'chest-cover'].includes(editingState) && <Spinner size="sm" />}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-400 whitespace-nowrap">기능:</p>
                        <div className="relative inline-flex items-center gap-2">
                            <select 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '2x') onUpscale(2);
                                    else if (val === '4x') onUpscale(4);
                                    else if (val === 'prompt') onGeneratePrompt();
                                    else if (val === 'details') onGeneratePersonDetails();
                                    e.target.value = "";
                                }}
                                disabled={editingState !== 'idle'}
                                className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-all cursor-pointer disabled:bg-gray-800 disabled:text-gray-500"
                                value=""
                            >
                                <option value="" disabled>작업 선택</option>
                                <option value="2x">2x 업스케일</option>
                                <option value="4x">4x 업스케일</option>
                                <option value="prompt">프롬프트 생성</option>
                                <option value="details">인물 디테일 추출</option>
                            </select>
                            {['upscale-2x', 'upscale-4x', 'generating-prompt', 'generating-details'].includes(editingState) && <Spinner size="sm" />}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-400 whitespace-nowrap">나이 변환:</p>
                        <div className="relative inline-flex items-center gap-2">
                            <select 
                                onChange={(e) => {
                                    if (e.target.value) {
                                        onAgeChange(Number(e.target.value) as any);
                                        e.target.value = "";
                                    }
                                }}
                                disabled={editingState !== 'idle'}
                                className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-all cursor-pointer disabled:bg-gray-800 disabled:text-gray-500"
                                value=""
                            >
                                <option value="" disabled>나이 선택</option>
                                <option value="20">20대</option>
                                <option value="30">30대</option>
                                <option value="40">40대</option>
                                <option value="50">50대</option>
                            </select>
                            <button
                                onClick={onMultiAgeGeneration}
                                disabled={editingState !== 'idle'}
                                className="px-3 py-1.5 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 rounded-md transition disabled:bg-gray-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs font-semibold text-white shadow-sm"
                            >
                                {editingState === 'age-multi' ? <Spinner size="sm" /> : '동시 생성'}
                            </button>
                            {['age-20', 'age-30', 'age-40', 'age-50'].includes(editingState) && (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-400 animate-pulse">
                                    <Spinner size="sm" />
                                    <span>변환 중...</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-400 whitespace-nowrap">볼륨 강조:</p>
                        <select 
                            value={bodyEnhanceLevel}
                            onChange={(e) => setBodyEnhanceLevel(Number(e.target.value))}
                            disabled={editingState !== 'idle'}
                            className="bg-gray-700 border border-gray-600 text-sm rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-100 transition-all cursor-pointer disabled:bg-gray-800 disabled:text-gray-500"
                        >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lv => (
                                <option key={lv} value={lv}>{lv === 5 ? '5 (보통)' : lv === 1 ? '1 (슬림)' : lv === 8 ? '8 (글래머)' : lv === 10 ? '10 (울트라)' : lv}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-gray-900/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-cyan-300">캐릭터 3면도 생성</h3>
                            <p className="mt-1 text-xs text-gray-400">
                                현재 선택한 참조 이미지로 정면, 45도, 뒷모습 시안을 만든 뒤 승인 후 수동 저장합니다.
                            </p>
                        </div>
                        <button
                            onClick={onGenerateTurnaround}
                            disabled={editingState !== 'idle' || isGeneratingTurnaround}
                            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[88px] font-semibold"
                        >
                            {isGeneratingTurnaround ? <Spinner size="sm" /> : '3면도 생성'}
                        </button>
                    </div>
                    <div className="mt-3">
                        <p className="text-xs font-medium text-gray-300 mb-2">의상 처리 방식</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setTurnaroundOutfitMode('preserve')}
                                disabled={editingState !== 'idle' || isGeneratingTurnaround}
                                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                                    turnaroundOutfitMode === 'preserve'
                                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                                } disabled:opacity-50`}
                            >
                                원본 의상 유지
                            </button>
                            <button
                                type="button"
                                onClick={() => setTurnaroundOutfitMode('neutral')}
                                disabled={editingState !== 'idle' || isGeneratingTurnaround}
                                className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                                    turnaroundOutfitMode === 'neutral'
                                        ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                                } disabled:opacity-50`}
                            >
                                중립 의상 통일
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500">
                            {turnaroundOutfitMode === 'preserve'
                                ? '현재는 업로드한 이미지의 의상, 신발, 악세서리를 그대로 유지하도록 생성합니다.'
                                : '현재는 포즈 확인용으로 심플한 기본 의상으로 통일해 생성합니다.'}
                        </p>
                    </div>

                    {turnaroundPreviews.length > 0 && (
                        <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                {turnaroundPreviews.map((preview) => (
                                    <div key={preview.key} className="rounded-md border border-gray-700 bg-gray-800 p-2">
                                        <img src={preview.imageUrl} alt={preview.label} className="h-28 w-full rounded object-cover" />
                                        <p className="mt-2 text-center text-xs font-medium text-gray-200">{preview.label}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={onApproveTurnaround}
                                    disabled={isTurnaroundApproved}
                                    className={`px-3 py-2 rounded-md text-xs font-semibold transition ${isTurnaroundApproved ? 'bg-emerald-900/50 text-emerald-200 cursor-default' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                >
                                    {isTurnaroundApproved ? '승인 완료' : '결과 승인'}
                                </button>
                                <input
                                    type="text"
                                    value={turnaroundName}
                                    onChange={(e) => setTurnaroundName(e.target.value)}
                                    placeholder="저장할 캐릭터 이름"
                                    disabled={!isTurnaroundApproved}
                                    className="flex-grow min-w-[180px] bg-gray-800 border border-gray-600 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:opacity-50"
                                />
                                <button
                                    onClick={onSaveTurnaround}
                                    disabled={!isTurnaroundApproved || !turnaroundName.trim()}
                                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[96px] font-semibold"
                                >
                                    캐릭터 저장
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageEditorControls;

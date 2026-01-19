
import React from 'react';
import Spinner from './Spinner';

type EditingState = 'idle' | 'prompt' | 'text' | 'background' | 'generating-prompt' | 'restoration' | 'age-20' | 'age-30' | 'age-40' | 'age-50' | 'age-multi' | 'upscale-2x' | 'upscale-4x' | 'painting' | 'generating-details';

interface ImageEditorControlsProps {
    sourceImages: { id: string; file: File | null; name: string }[];
    activeEditingImageId: string | null;
    setActiveEditingImageId: (id: string) => void;
    editPrompt: string;
    setEditPrompt: (val: string) => void;
    editingState: EditingState;
    onEditImage: () => void;
    onSpecialEdit: (action: 'text' | 'background' | 'restoration' | 'painting') => void;
    onUpscale: (scale: 2 | 4) => void;
    onGeneratePrompt: () => void;
    onGeneratePersonDetails: () => void;
    onAgeChange: (age: 20 | 30 | 40 | 50 | 60) => void;
    onMultiAgeGeneration: () => void;
}

const ImageEditorControls: React.FC<ImageEditorControlsProps> = ({
    sourceImages,
    activeEditingImageId,
    setActiveEditingImageId,
    editPrompt,
    setEditPrompt,
    editingState,
    onEditImage,
    onSpecialEdit,
    onUpscale,
    onGeneratePrompt,
    onGeneratePersonDetails,
    onAgeChange,
    onMultiAgeGeneration
}) => {
    if (!sourceImages.some(img => img.file)) return null;

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
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="예: '하늘을 보라색으로 만들어 줘'"
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        disabled={editingState !== 'idle'}
                    />
                    <button onClick={onEditImage} disabled={editingState !== 'idle' || !editPrompt.trim()} className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-sm min-w-[90px]">
                        {editingState === 'prompt' ? <Spinner size="sm" /> : '수정 적용'}
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-400 whitespace-nowrap">빠른 수정:</p>
                    <button onClick={() => onSpecialEdit('text')} disabled={editingState !== 'idle'} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[70px]">
                        {editingState === 'text' ? <Spinner size="sm" /> : '텍스트 제거'}
                    </button>
                    <button onClick={() => onSpecialEdit('background')} disabled={editingState !== 'idle'} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[70px]">
                        {editingState === 'background' ? <Spinner size="sm" /> : '배경 제거'}
                    </button>
                    <button onClick={() => onSpecialEdit('restoration')} disabled={editingState !== 'idle'} className="px-2 py-1 bg-amber-600 hover:bg-amber-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[70px]">
                        {editingState === 'restoration' ? <Spinner size="sm" /> : '사진 복원'}
                    </button>
                    <button onClick={() => onSpecialEdit('painting')} disabled={editingState !== 'idle'} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[70px]">
                        {editingState === 'painting' ? <Spinner size="sm" /> : '그림 변환'}
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-400 whitespace-nowrap">기능:</p>
                    <button onClick={() => onUpscale(2)} disabled={editingState !== 'idle'} className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[52px]">
                        {editingState === 'upscale-2x' ? <Spinner size="sm" /> : '2x'}
                    </button>
                    <button onClick={() => onUpscale(4)} disabled={editingState !== 'idle'} className="px-2 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[52px]">
                        {editingState === 'upscale-4x' ? <Spinner size="sm" /> : '4x'}
                    </button>
                    <button onClick={onGeneratePrompt} disabled={editingState !== 'idle'} className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[100px]">
                        {editingState === 'generating-prompt' ? <Spinner size="sm" /> : '프롬프트 생성'}
                    </button>
                    <button onClick={onGeneratePersonDetails} disabled={editingState !== 'idle'} className="px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[110px]">
                        {editingState === 'generating-details' ? <Spinner size="sm" /> : '인물 디테일 추출'}
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gray-400 whitespace-nowrap">나이 변환:</p>
                    {[20, 30, 40, 50].map((age) => {
                        const stateKey = `age-${age}` as EditingState;
                        const ageGroup = age as 20 | 30 | 40 | 50;
                        return (
                            <button
                                key={age}
                                onClick={() => onAgeChange(ageGroup as any)}
                                disabled={editingState !== 'idle'}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-700 rounded-md transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[50px]"
                            >
                                {editingState === stateKey ? <Spinner size="sm" /> : `${age}대`}
                            </button>
                        );
                    })}
                    <button
                        onClick={onMultiAgeGeneration}
                        disabled={editingState !== 'idle'}
                        className="px-3 py-2 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 rounded-md transition disabled:bg-gray-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed flex items-center justify-center text-xs min-w-[90px] font-semibold"
                    >
                        {editingState === 'age-multi' ? <Spinner size="sm" /> : '동시 생성'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageEditorControls;

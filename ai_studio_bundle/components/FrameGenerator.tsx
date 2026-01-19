import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';
import { CameraSettings } from './CameraControls';

export interface SceneFrame {
    sceneNumber: number;
    prompt: string;
    cameraSettings?: CameraSettings;
    imageUrl?: string;
    isLoading?: boolean;
    error?: string | null;
}

export interface FrameConfig {
    characterImage: File | null;
    characterImageUrl: string | null;
    background: string;
    scenes: SceneFrame[];
    maintainConsistency: boolean;
}

interface FrameGeneratorProps {
    onGenerate: (config: FrameConfig) => Promise<void>;
    isGenerating: boolean;
}

const FrameGenerator: React.FC<FrameGeneratorProps> = ({ onGenerate, isGenerating }) => {
    const [characterImage, setCharacterImage] = useState<File | null>(null);
    const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
    const [background, setBackground] = useState('');
    const [sceneCount, setSceneCount] = useState(6);
    const [scenes, setScenes] = useState<SceneFrame[]>(
        Array.from({ length: 6 }, (_, i) => ({
            sceneNumber: i + 1,
            prompt: ''
        }))
    );
    const [maintainConsistency, setMaintainConsistency] = useState(true);

    const handleCharacterImageDrop = (file: File) => {
        if (characterImageUrl) URL.revokeObjectURL(characterImageUrl);
        setCharacterImage(file);
        setCharacterImageUrl(URL.createObjectURL(file));
    };

    const handleClearCharacterImage = () => {
        if (characterImageUrl) URL.revokeObjectURL(characterImageUrl);
        setCharacterImage(null);
        setCharacterImageUrl(null);
    };

    const handleSceneCountChange = (count: number) => {
        setSceneCount(count);
        const newScenes = Array.from({ length: count }, (_, i) => {
            if (i < scenes.length) {
                return scenes[i];
            }
            return {
                sceneNumber: i + 1,
                prompt: ''
            };
        });
        setScenes(newScenes);
    };

    const handleScenePromptChange = (index: number, prompt: string) => {
        const newScenes = [...scenes];
        newScenes[index] = { ...newScenes[index], prompt };
        setScenes(newScenes);
    };

    const handleGenerate = async () => {
        // 유효성 검사
        const validScenes = scenes.filter(s => s.prompt.trim() !== '');
        if (validScenes.length === 0) {
            alert('최소 1개 이상의 씬 프롬프트를 입력해주세요.');
            return;
        }

        if (maintainConsistency && !characterImage) {
            alert('캐릭터 일관성을 유지하려면 참조 캐릭터 이미지를 업로드해주세요.');
            return;
        }

        const config: FrameConfig = {
            characterImage,
            characterImageUrl,
            background,
            scenes: validScenes,
            maintainConsistency
        };

        await onGenerate(config);
    };

    const loadFromShortsGenerator = () => {
        // 쇼츠 생성기에서 대본 불러오기 (추후 구현)
        alert('쇼츠 생성기 연동 기능은 곧 추가됩니다!');
    };

    const quickFillScenes = () => {
        // 빠른 예시 채우기
        const exampleScenes: SceneFrame[] = [
            { sceneNumber: 1, prompt: 'Woman looking surprised, indoor setting' },
            { sceneNumber: 2, prompt: 'Woman checking her phone, worried expression' },
            { sceneNumber: 3, prompt: 'Woman talking to someone, outdoor garden' },
            { sceneNumber: 4, prompt: 'Woman smiling, relieved expression' },
            { sceneNumber: 5, prompt: 'Woman walking away, confident pose' },
            { sceneNumber: 6, prompt: 'Woman waving goodbye, happy ending' }
        ];
        setScenes(exampleScenes.slice(0, sceneCount));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🎬 프레임 만들기 (연속 장면 생성)</h3>
                <div className="flex gap-2">
                    <button
                        onClick={loadFromShortsGenerator}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-md transition"
                    >
                        📝 쇼츠 대본 불러오기
                    </button>
                    <button
                        onClick={quickFillScenes}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-md transition"
                    >
                        ⚡ 예시 채우기
                    </button>
                </div>
            </div>

            <p className="text-sm text-gray-400">
                캐릭터 일관성을 유지하며 연속된 장면을 생성합니다. 쇼츠 영상 제작에 최적화되어 있습니다.
            </p>

            {/* 캐릭터 이미지 */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-medium text-gray-300">
                        1. 참조 캐릭터 이미지 {maintainConsistency && <span className="text-red-400">*</span>}
                    </h4>
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={maintainConsistency}
                            onChange={(e) => setMaintainConsistency(e.target.checked)}
                            className="rounded"
                        />
                        캐릭터 일관성 유지
                    </label>
                </div>
                <p className="text-xs text-gray-400 mb-2">
                    {maintainConsistency
                        ? '모든 씬에서 동일한 캐릭터가 등장합니다. 참조 이미지를 업로드해주세요.'
                        : '각 씬마다 다른 캐릭터가 등장할 수 있습니다.'}
                </p>
                <ImageDropzone
                    onImageDrop={handleCharacterImageDrop}
                    previewUrl={characterImageUrl}
                    onClear={handleClearCharacterImage}
                />
            </div>

            {/* 배경 설정 */}
            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">2. 배경 설정 (선택사항)</h4>
                <input
                    type="text"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    placeholder="예: luxury golf course, modern office, cozy cafe"
                    className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                    모든 씬에 공통으로 적용될 배경을 입력하세요. 비워두면 각 씬의 프롬프트에 따릅니다.
                </p>
            </div>

            {/* 씬 개수 */}
            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">3. 씬 개수: {sceneCount}개</h4>
                <input
                    type="range"
                    min="2"
                    max="12"
                    value={sceneCount}
                    onChange={(e) => handleSceneCountChange(parseInt(e.target.value))}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>2개 (최소)</span>
                    <span>6개 (쇼츠 권장)</span>
                    <span>12개 (최대)</span>
                </div>
            </div>

            {/* 씬 프롬프트 */}
            <div>
                <h4 className="text-base font-medium text-gray-300 mb-3">4. 각 씬 프롬프트</h4>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {scenes.map((scene, index) => (
                        <div key={index} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-indigo-400">
                                    씬 {scene.sceneNumber}
                                </span>
                                {scene.prompt.trim() === '' && (
                                    <span className="text-xs text-red-400">* 필수</span>
                                )}
                            </div>
                            <textarea
                                value={scene.prompt}
                                onChange={(e) => handleScenePromptChange(index, e.target.value)}
                                placeholder={`씬 ${scene.sceneNumber} 프롬프트를 입력하세요...
예: Woman looking surprised, checking her phone`}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                                rows={2}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* 생성 버튼 */}
            <div className="pt-4 border-t border-gray-700">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || scenes.filter(s => s.prompt.trim() !== '').length === 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Spinner />
                            프레임 생성 중... ({scenes.filter(s => s.prompt.trim() !== '').length}개 씬)
                        </>
                    ) : (
                        <>
                            🎬 {scenes.filter(s => s.prompt.trim() !== '').length}개 프레임 생성하기
                        </>
                    )}
                </button>

                {maintainConsistency && characterImage && (
                    <p className="text-xs text-green-400 mt-2 text-center">
                        ✓ 캐릭터 일관성이 유지됩니다
                    </p>
                )}
            </div>

            {/* 안내 메시지 */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                    💡 <strong>팁:</strong> 쇼츠 영상 제작을 위해서는 6개 씬을 권장합니다.
                    각 씬은 약 3초씩 표시되어 총 18초 분량의 쇼츠가 됩니다.
                </p>
            </div>
        </div>
    );
};

export default FrameGenerator;

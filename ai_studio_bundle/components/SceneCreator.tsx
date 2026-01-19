import React, { useState } from 'react';
import { ImageResult } from '../types';
import Spinner from './Spinner';

export interface VideoConfig {
    frames: string[]; // Base64 image URLs
    duration: number; // 각 프레임 표시 시간 (초)
    transition: 'none' | 'fade' | 'slide' | 'zoom';
    transitionDuration: number; // 트랜지션 시간 (초)
    cameraEffect: 'none' | 'zoom-in' | 'zoom-out' | 'pan-right' | 'pan-left';
    bgMusic?: File;
    bgMusicVolume: number; // 0-100
}

interface SceneCreatorProps {
    availableFrames: ImageResult[];
    onCreateVideo: (config: VideoConfig) => Promise<string>; // Returns video URL
}

const SceneCreator: React.FC<SceneCreatorProps> = ({ availableFrames, onCreateVideo }) => {
    const [selectedFrames, setSelectedFrames] = useState<string[]>([]);
    const [config, setConfig] = useState<VideoConfig>({
        frames: [],
        duration: 3,
        transition: 'fade',
        transitionDuration: 0.5,
        cameraEffect: 'none',
        bgMusicVolume: 50
    });
    const [isCreating, setIsCreating] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [progress, setProgress] = useState('');

    const validFrames = availableFrames.filter(f => f.imageUrl && !f.error);

    const toggleFrameSelection = (url: string) => {
        setSelectedFrames(prev => {
            if (prev.includes(url)) {
                return prev.filter(u => u !== url);
            } else {
                return [...prev, url];
            }
        });
    };

    const selectAllFrames = () => {
        setSelectedFrames(validFrames.map(f => f.imageUrl!));
    };

    const clearSelection = () => {
        setSelectedFrames([]);
    };

    const moveFrameUp = (index: number) => {
        if (index === 0) return;
        const newFrames = [...selectedFrames];
        [newFrames[index - 1], newFrames[index]] = [newFrames[index], newFrames[index - 1]];
        setSelectedFrames(newFrames);
    };

    const moveFrameDown = (index: number) => {
        if (index === selectedFrames.length - 1) return;
        const newFrames = [...selectedFrames];
        [newFrames[index], newFrames[index + 1]] = [newFrames[index + 1], newFrames[index]];
        setSelectedFrames(newFrames);
    };

    const removeFrame = (index: number) => {
        setSelectedFrames(prev => prev.filter((_, i) => i !== index));
    };

    const createVideo = async () => {
        if (selectedFrames.length === 0) {
            alert('최소 1개 이상의 프레임을 선택해주세요.');
            return;
        }

        setIsCreating(true);
        setProgress('영상 생성 준비 중...');

        try {
            const videoConfig: VideoConfig = {
                ...config,
                frames: selectedFrames
            };

            const url = await onCreateVideo(videoConfig);
            setVideoUrl(url);
            setProgress('');
        } catch (error) {
            console.error('Video creation error:', error);
            alert('영상 생성에 실패했습니다.');
            setProgress('');
        } finally {
            setIsCreating(false);
        }
    };

    const downloadVideo = () => {
        if (!videoUrl) return;
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `shorts_scene_${Date.now()}.mp4`;
        a.click();
    };

    const getTotalDuration = () => {
        const frameDuration = selectedFrames.length * config.duration;
        const transitionDuration = (selectedFrames.length - 1) * config.transitionDuration;
        return frameDuration - transitionDuration;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🎥 신 만들기 (영상 합성)</h3>
                {selectedFrames.length > 0 && (
                    <span className="text-sm text-indigo-400">
                        {selectedFrames.length}개 프레임 선택됨 · 예상 길이: {getTotalDuration().toFixed(1)}초
                    </span>
                )}
            </div>

            <p className="text-sm text-gray-400">
                생성된 프레임들을 선택하여 쇼츠 영상으로 합성합니다. 트랜지션과 카메라 효과를 추가할 수 있습니다.
            </p>

            {/* 프레임 선택 */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-medium text-gray-300">
                        1. 프레임 선택 ({validFrames.length}개 사용 가능)
                    </h4>
                    <div className="flex gap-2">
                        <button
                            onClick={selectAllFrames}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-1 px-3 rounded-md transition"
                        >
                            전체 선택
                        </button>
                        <button
                            onClick={clearSelection}
                            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-1 px-3 rounded-md transition"
                        >
                            선택 해제
                        </button>
                    </div>
                </div>

                {validFrames.length === 0 ? (
                    <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                        <p className="text-gray-400 mb-2">사용 가능한 프레임이 없습니다.</p>
                        <p className="text-sm text-gray-500">먼저 프레임을 생성해주세요.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto bg-gray-900 rounded-md p-2">
                        {validFrames.map((frame, i) => (
                            <div
                                key={i}
                                onClick={() => toggleFrameSelection(frame.imageUrl!)}
                                className={`relative cursor-pointer rounded-md overflow-hidden border-2 transition-all ${selectedFrames.includes(frame.imageUrl!)
                                        ? 'border-indigo-500 ring-2 ring-indigo-500'
                                        : 'border-gray-700 hover:border-gray-500'
                                    }`}
                            >
                                <img src={frame.imageUrl!} alt={frame.prompt} className="w-full h-24 object-cover" />
                                {selectedFrames.includes(frame.imageUrl!) && (
                                    <div className="absolute top-1 right-1 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                                        {selectedFrames.indexOf(frame.imageUrl!) + 1}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 선택된 프레임 순서 */}
            {selectedFrames.length > 0 && (
                <div>
                    <h4 className="text-base font-medium text-gray-300 mb-3">2. 프레임 순서 조정</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto bg-gray-900 rounded-md p-2">
                        {selectedFrames.map((frameUrl, index) => (
                            <div key={index} className="flex items-center gap-2 bg-gray-800 rounded-md p-2">
                                <span className="text-sm font-semibold text-indigo-400 w-8">#{index + 1}</span>
                                <img src={frameUrl} alt={`Frame ${index + 1}`} className="w-16 h-16 object-cover rounded" />
                                <div className="flex-1" />
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => moveFrameUp(index)}
                                        disabled={index === 0}
                                        className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="위로"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => moveFrameDown(index)}
                                        disabled={index === selectedFrames.length - 1}
                                        className="p-1 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="아래로"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        onClick={() => removeFrame(index)}
                                        className="p-1 text-red-400 hover:text-red-300"
                                        title="제거"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 영상 설정 */}
            {selectedFrames.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                    <h4 className="text-base font-medium text-gray-300">3. 영상 설정</h4>

                    {/* 프레임 표시 시간 */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">
                            각 프레임 표시 시간: {config.duration}초
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="0.5"
                            value={config.duration}
                            onChange={(e) => setConfig({ ...config, duration: parseFloat(e.target.value) })}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>1초 (빠름)</span>
                            <span>3초 (권장)</span>
                            <span>10초 (느림)</span>
                        </div>
                    </div>

                    {/* 트랜지션 효과 */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">트랜지션 효과</label>
                        <select
                            value={config.transition}
                            onChange={(e) => setConfig({ ...config, transition: e.target.value as any })}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                        >
                            <option value="none">없음 (컷 전환)</option>
                            <option value="fade">페이드 (부드러운 전환)</option>
                            <option value="slide">슬라이드 (밀어내기)</option>
                            <option value="zoom">줌 (확대/축소)</option>
                        </select>
                    </div>

                    {/* 트랜지션 시간 */}
                    {config.transition !== 'none' && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">
                                트랜지션 시간: {config.transitionDuration}초
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="2"
                                step="0.1"
                                value={config.transitionDuration}
                                onChange={(e) => setConfig({ ...config, transitionDuration: parseFloat(e.target.value) })}
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* 카메라 효과 */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">카메라 효과</label>
                        <select
                            value={config.cameraEffect}
                            onChange={(e) => setConfig({ ...config, cameraEffect: e.target.value as any })}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                        >
                            <option value="none">없음</option>
                            <option value="zoom-in">줌 인 (서서히 확대)</option>
                            <option value="zoom-out">줌 아웃 (서서히 축소)</option>
                            <option value="pan-right">팬 오른쪽 (좌→우 이동)</option>
                            <option value="pan-left">팬 왼쪽 (우→좌 이동)</option>
                        </select>
                    </div>

                    {/* 배경 음악 */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">배경 음악 (선택사항)</label>
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => setConfig({ ...config, bgMusic: e.target.files?.[0] })}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
                        />
                    </div>

                    {config.bgMusic && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">
                                음악 볼륨: {config.bgMusicVolume}%
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={config.bgMusicVolume}
                                onChange={(e) => setConfig({ ...config, bgMusicVolume: parseInt(e.target.value) })}
                                className="w-full"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 생성 버튼 */}
            {selectedFrames.length > 0 && (
                <div className="pt-4 border-t border-gray-700">
                    <button
                        onClick={createVideo}
                        disabled={isCreating}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <Spinner />
                                {progress || '영상 생성 중...'}
                            </>
                        ) : (
                            <>
                                🎥 영상 생성하기 ({selectedFrames.length}개 프레임, {getTotalDuration().toFixed(1)}초)
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* 생성된 영상 */}
            {videoUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 영상 생성 완료!</h4>
                    <video src={videoUrl} controls className="w-full rounded-md mb-3" />
                    <div className="flex gap-2">
                        <button
                            onClick={downloadVideo}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition"
                        >
                            📥 영상 다운로드
                        </button>
                        <button
                            onClick={() => setVideoUrl(null)}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-md transition"
                        >
                            새로 만들기
                        </button>
                    </div>
                </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                    💡 <strong>팁:</strong> 쇼츠 영상은 9:16 비율로 생성됩니다.
                    각 프레임은 {config.duration}초씩 표시되며, 총 {getTotalDuration().toFixed(1)}초 분량의 영상이 만들어집니다.
                </p>
            </div>
        </div>
    );
};

export default SceneCreator;

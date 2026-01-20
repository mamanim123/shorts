import React, { useState } from 'react';
import ImageDropzone from './ImageDropzone';
import Spinner from './Spinner';

interface AnalysisResult {
    fullPrompt: string;
    style: string;
    mood: string;
    colors: string;
    composition: string;
    lighting: string;
    details: string;
}

interface ImageAnalyzerProps {
    onAnalyze: (file: File) => Promise<string>;
    isAnalyzing: boolean;
}

const ImageAnalyzer: React.FC<ImageAnalyzerProps> = ({ onAnalyze, isAnalyzing }) => {
    const [image, setImage] = useState<File | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const handleImageDrop = (file: File) => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        setImage(file);
        setImageUrl(URL.createObjectURL(file));
        setAnalysisResult(null);
    };

    const handleClearImage = () => {
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        setImage(null);
        setImageUrl(null);
        setAnalysisResult(null);
    };

    const handleAnalyze = async () => {
        if (!image) {
            alert('먼저 이미지를 업로드해주세요.');
            return;
        }

        try {
            const fullPrompt = await onAnalyze(image);

            // 프롬프트를 파싱하여 구조화
            const parsed = parseAnalysisResult(fullPrompt);
            setAnalysisResult(parsed);
        } catch (error) {
            console.error('Analysis error:', error);
            alert('이미지 분석에 실패했습니다.');
        }
    };

    const parseAnalysisResult = (text: string): AnalysisResult => {
        // AI 응답을 파싱하여 구조화
        const lines = text.split('\n');
        const result: AnalysisResult = {
            fullPrompt: text,
            style: '',
            mood: '',
            colors: '',
            composition: '',
            lighting: '',
            details: ''
        };

        let currentSection = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.toLowerCase().startsWith('style:')) {
                currentSection = 'style';
                result.style = trimmed.substring(6).trim();
            } else if (trimmed.toLowerCase().startsWith('mood:')) {
                currentSection = 'mood';
                result.mood = trimmed.substring(5).trim();
            } else if (trimmed.toLowerCase().startsWith('colors:')) {
                currentSection = 'colors';
                result.colors = trimmed.substring(7).trim();
            } else if (trimmed.toLowerCase().startsWith('composition:')) {
                currentSection = 'composition';
                result.composition = trimmed.substring(12).trim();
            } else if (trimmed.toLowerCase().startsWith('lighting:')) {
                currentSection = 'lighting';
                result.lighting = trimmed.substring(9).trim();
            } else if (trimmed.toLowerCase().startsWith('details:')) {
                currentSection = 'details';
                result.details = trimmed.substring(8).trim();
            } else if (trimmed && currentSection) {
                // 멀티라인 내용 추가
                result[currentSection as keyof AnalysisResult] += ' ' + trimmed;
            }
        }

        return result;
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('클립보드에 복사되었습니다!');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🔍 이미지 분석기 (프롬프트 추출)</h3>
            </div>

            <p className="text-sm text-gray-400">
                이미지를 업로드하면 AI가 스타일, 색상, 구도, 조명 등을 분석하여 상세한 프롬프트를 생성합니다.
            </p>

            {/* 이미지 업로드 */}
            <div>
                <h4 className="text-base font-medium text-gray-300 mb-2">1. 이미지 업로드</h4>
                <ImageDropzone
                    onImageDrop={handleImageDrop}
                    previewUrl={imageUrl}
                    onClear={handleClearImage}
                />
            </div>

            {/* 분석 버튼 */}
            {image && !analysisResult && (
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
                >
                    {isAnalyzing ? (
                        <>
                            <Spinner />
                            이미지 분석 중...
                        </>
                    ) : (
                        <>
                            🔍 이미지 분석하기
                        </>
                    )}
                </button>
            )}

            {/* 분석 결과 */}
            {analysisResult && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base font-medium text-gray-300">2. 분석 결과</h4>
                        <button
                            onClick={() => setAnalysisResult(null)}
                            className="text-sm text-gray-400 hover:text-gray-200"
                        >
                            새로 분석하기
                        </button>
                    </div>

                    {/* 구조화된 분석 결과 */}
                    <div className="space-y-3">
                        {analysisResult.style && (
                            <div className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-semibold text-indigo-400">🎨 스타일 (Style)</h5>
                                    <button
                                        onClick={() => copyToClipboard(analysisResult.style)}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                    >
                                        📋 복사
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200">{analysisResult.style}</p>
                            </div>
                        )}

                        {analysisResult.mood && (
                            <div className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-semibold text-indigo-400">😊 분위기 (Mood)</h5>
                                    <button
                                        onClick={() => copyToClipboard(analysisResult.mood)}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                    >
                                        📋 복사
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200">{analysisResult.mood}</p>
                            </div>
                        )}

                        {analysisResult.colors && (
                            <div className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-semibold text-indigo-400">🌈 색상 (Colors)</h5>
                                    <button
                                        onClick={() => copyToClipboard(analysisResult.colors)}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                    >
                                        📋 복사
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200">{analysisResult.colors}</p>
                            </div>
                        )}

                        {analysisResult.composition && (
                            <div className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-semibold text-indigo-400">📐 구도 (Composition)</h5>
                                    <button
                                        onClick={() => copyToClipboard(analysisResult.composition)}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                    >
                                        📋 복사
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200">{analysisResult.composition}</p>
                            </div>
                        )}

                        {analysisResult.lighting && (
                            <div className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-semibold text-indigo-400">💡 조명 (Lighting)</h5>
                                    <button
                                        onClick={() => copyToClipboard(analysisResult.lighting)}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                    >
                                        📋 복사
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200">{analysisResult.lighting}</p>
                            </div>
                        )}

                        {analysisResult.details && (
                            <div className="bg-gray-800 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-sm font-semibold text-indigo-400">✨ 세부사항 (Details)</h5>
                                    <button
                                        onClick={() => copyToClipboard(analysisResult.details)}
                                        className="text-xs text-gray-400 hover:text-gray-200"
                                    >
                                        📋 복사
                                    </button>
                                </div>
                                <p className="text-sm text-gray-200">{analysisResult.details}</p>
                            </div>
                        )}
                    </div>

                    {/* 전체 프롬프트 */}
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-green-400">📝 완성된 프롬프트</h5>
                            <button
                                onClick={() => copyToClipboard(analysisResult.fullPrompt)}
                                className="text-sm bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded-md transition"
                            >
                                📋 전체 복사
                            </button>
                        </div>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                            {analysisResult.fullPrompt}
                        </p>
                    </div>

                    {/* 사용 가이드 */}
                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                        <p className="text-xs text-blue-300">
                            💡 <strong>사용 방법:</strong> 생성된 프롬프트를 복사하여 다른 모드(텍스트로 이미지 생성, 카메라 컨트롤 등)에서 사용할 수 있습니다.
                            각 섹션을 개별적으로 복사하거나, 전체 프롬프트를 한 번에 복사할 수 있습니다.
                        </p>
                    </div>
                </div>
            )}

            {/* 안내 메시지 */}
            {!image && (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                    <p className="text-gray-400 mb-2">이미지를 업로드하여 분석을 시작하세요</p>
                    <p className="text-sm text-gray-500">
                        AI가 이미지의 스타일, 색상, 구도, 조명 등을 분석하여<br />
                        재사용 가능한 상세한 프롬프트를 생성합니다
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImageAnalyzer;

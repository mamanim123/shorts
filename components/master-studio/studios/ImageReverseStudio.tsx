import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AlertTriangle,
    Check,
    Copy,
    FileJson,
    HelpCircle,
    Image as ImageIcon,
    Loader2,
    Music2,
    Settings,
    Sparkles,
    Upload,
    Video,
    X,
} from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import ImageHistorySidebar from '../ImageHistorySidebar';
import { ImageHistoryItem } from '../types';
import { fetchImageHistory, saveImageHistory } from '../../../services/imageHistoryService';
import {
    ReversePromptMediaType,
    ReversePromptLanguage,
    MAX_REVERSE_FILE_SIZE,
    analyzeMedia,
    detectMediaType,
    fileToBase64,
    getMediaTypeLabel,
    validateGeminiKey,
} from '../services/reversePromptArchitectService';
import { resolveImageHistoryUrls } from '../services/historyImageLoader';
import { getBlob, deleteBlob } from '../services/dbService';
import { deleteFileFromDisk } from '../services/serverService';

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getPromptFromResult = (type: ReversePromptMediaType, data: any): string => {
    if (!data) return '';
    if (type === ReversePromptMediaType.Image) {
        return data.midjourney_data?.full_command || data.midjourney_data?.prompt || '';
    }
    if (type === ReversePromptMediaType.Video) {
        return data.video_prompt || '';
    }
    return data.audio_prompt || '';
};

const getNegativePrompt = (type: ReversePromptMediaType, data: any): string | null => {
    if (type === ReversePromptMediaType.Image) {
        return data.midjourney_data?.negative_prompt || null;
    }
    return null;
};

const getTargetLabel = (type: ReversePromptMediaType): string => {
    switch (type) {
        case ReversePromptMediaType.Video:
            return 'Sora / Veo';
        case ReversePromptMediaType.Audio:
            return 'Suno / Udio';
        default:
            return 'Midjourney / DALL·E';
    }
};

const ImageReverseStudio: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [language, setLanguage] = useLocalStorage<ReversePromptLanguage>('imageReverseLanguage', 'ko');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<ReversePromptMediaType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<{ type: ReversePromptMediaType; data: any } | null>(null);
    const [copiedPrompt, setCopiedPrompt] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [keyInput, setKeyInput] = useState('');
    const [keyStatus, setKeyStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
    const [historyItems, setHistoryItems] = useState<ImageHistoryItem[]>([]);
    const [historyImages, setHistoryImages] = useState<Record<string, string>>({});
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    const resetState = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        setAnalysisResult(null);
        setMediaType(null);
        setErrorMessage(null);
    };

    const deleteFromHistory = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
        const target = historyItems.find(item => item.id === id);
        if (target) {
            await deleteBlob(target.generatedImageId);
            if (target.localFilename) {
                try {
                    await deleteFileFromDisk(target.localFilename, 'image');
                } catch (error) {
                    console.error('Failed to delete local file for reverse history', error);
                }
            }
        }
        setHistoryItems(prev => prev.filter(item => item.id !== id));
        if (historyImages[id]) {
            URL.revokeObjectURL(historyImages[id]);
            setHistoryImages(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    };

    const toggleFavorite = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setHistoryItems(prev => prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item));
    };

    const handleHistorySelect = async (item: ImageHistoryItem) => {
        try {
            let file: File | null = null;
            if (item.generatedImageId) {
                const blob = await getBlob(item.generatedImageId);
                if (blob) {
                    file = new File([blob], `${item.id}.png`, { type: blob.type || 'image/png' });
                }
            } else if (item.localFilename) {
                const candidates = [
                    `/generated_scripts/images/${item.localFilename}`,
                    `http://localhost:3002/generated_scripts/images/${item.localFilename}`,
                    `http://127.0.0.1:3002/generated_scripts/images/${item.localFilename}`,
                ];
                for (const url of candidates) {
                    try {
                        const resp = await fetch(url);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            file = new File([blob], item.localFilename, { type: blob.type || 'image/png' });
                            break;
                        }
                    } catch (error) {
                        console.error('Failed to fetch disk image for reverse history select', error);
                    }
                }
            } else if (historyImages[item.id]) {
                const resp = await fetch(historyImages[item.id]);
                const blob = await resp.blob();
                file = new File([blob], `${item.id}.png`, { type: blob.type || 'image/png' });
            }
            if (file) {
                await handleFiles(file);
            } else {
                console.warn('Unable to load history item for Image Reverse');
            }
        } catch (error) {
            console.error('Failed to load history item for reverse studio', error);
        }
    };

    const createdHistoryUrlsRef = useRef<string[]>([]);

    const handleFiles = useCallback(async (file: File | undefined | null) => {
        if (!file) return;
        const detected = detectMediaType(file);
        if (!detected) {
            setErrorMessage('지원하지 않는 파일 형식입니다.');
            return;
        }
        if (file.size > MAX_REVERSE_FILE_SIZE) {
            setErrorMessage(`파일 크기가 너무 큽니다. (최대 ${formatBytes(MAX_REVERSE_FILE_SIZE)})`);
            return;
        }
        setErrorMessage(null);
        setSelectedFile(file);
        setMediaType(detected);
        setAnalysisResult(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(file));
    }, [previewUrl]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        handleFiles(file);
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files?.[0];
        handleFiles(file);
    };

    const handleAnalyze = async () => {
        if (!selectedFile || !mediaType) {
            setErrorMessage('먼저 분석할 파일을 선택하세요.');
            return;
        }
        setIsLoading(true);
        setErrorMessage(null);
        setCopiedJson(false);
        setCopiedPrompt(false);
        try {
            const base64 = await fileToBase64(selectedFile);
            const data = await analyzeMedia({
                fileBase64: base64,
                mimeType: selectedFile.type,
                mediaType,
                language,
            });
            setAnalysisResult({ type: mediaType, data });
        } catch (error: any) {
            console.error('Image Reverse analysis failed:', error);
            setAnalysisResult(null);
            setErrorMessage(error.message || '분석에 실패했습니다. 다시 시도하세요.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyPrompt = () => {
        if (!analysisResult) return;
        const prompt = getPromptFromResult(analysisResult.type, analysisResult.data);
        if (!prompt) return;
        navigator.clipboard.writeText(prompt);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
    };

    const handleCopyJson = () => {
        if (!analysisResult) return;
        navigator.clipboard.writeText(JSON.stringify(analysisResult.data, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    const openFileDialog = () => fileInputRef.current?.click();

    const keyModalOpen = () => {
        setKeyInput(localStorage.getItem('master_studio_api_key') || '');
        setKeyStatus('idle');
        setShowKeyModal(true);
    };

    const saveKey = async () => {
        if (!keyInput.trim()) {
            setKeyStatus('invalid');
            return;
        }
        setKeyStatus('testing');
        const isValid = await validateGeminiKey(keyInput.trim());
        if (isValid) {
            localStorage.setItem('master_studio_api_key', keyInput.trim());
            setKeyStatus('valid');
            setTimeout(() => setShowKeyModal(false), 800);
        } else {
            setKeyStatus('invalid');
        }
    };

    const removeKey = () => {
        localStorage.removeItem('master_studio_api_key');
        setKeyInput('');
        setKeyStatus('idle');
    };

    const summaryCards = useMemo(() => {
        if (!analysisResult?.data) return [];
        const data = analysisResult.data;
        if (analysisResult.type === ReversePromptMediaType.Image) {
            return [
                { title: 'Visual Analysis', content: data.visual_analysis },
                { title: 'Midjourney Parameters', content: data.midjourney_data?.parameters },
            ];
        }
        if (analysisResult.type === ReversePromptMediaType.Video) {
            return [
                { title: 'Cinematography', content: data.cinematography },
                { title: 'Visuals', content: data.visuals },
                { title: 'Editing', content: data.editing },
                { title: 'Audio Atmosphere', content: data.audio_atmosphere },
            ];
        }
        return [
            { title: 'Musical Structure', content: data.musical_structure },
            { title: 'Instrumentation', content: data.instrumentation },
            { title: 'Vocal Layer', content: data.vocal_layer },
            { title: 'Emotional Profile', content: data.emotional_profile },
        ];
    }, [analysisResult]);

    const renderContentValue = (value: any) => {
        if (!value) return <span className="text-gray-500">-</span>;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return <span className="text-gray-100 break-words">{String(value)}</span>;
        }
        if (Array.isArray(value)) {
            return (
                <div className="space-y-1">
                    {value.map((item, index) => (
                        <p key={`${item}-${index}`} className="text-gray-100 text-sm">
                            • {item}
                        </p>
                    ))}
                </div>
            );
        }
        return (
            <div className="space-y-1 text-sm text-gray-100">
                {Object.entries(value).map(([key, val]) => (
                    <div key={key} className="flex items-start gap-2">
                        <span className="text-gray-400 min-w-[120px] text-xs uppercase tracking-wide">{key}</span>
                        <div className="flex-1">{renderContentValue(val)}</div>
                    </div>
                ))}
            </div>
        );
    };

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const legacyRaw = localStorage.getItem('imageHistory');
                if (legacyRaw) {
                    try {
                        const legacy = JSON.parse(legacyRaw);
                        if (Array.isArray(legacy) && legacy.length > 0) {
                            await saveImageHistory(legacy);
                        }
                    } catch (err) {
                        console.error('Failed to migrate legacy image history', err);
                    } finally {
                        localStorage.removeItem('imageHistory');
                    }
                }
                const serverHistory = await fetchImageHistory();
                if (Array.isArray(serverHistory)) {
                    setHistoryItems(serverHistory);
                }
            } catch (error) {
                console.error('Failed to load image history for reverse studio', error);
            }
        };
        loadHistory();
    }, []);

    useEffect(() => {
        const loadHistoryImages = async () => {
            const urls = await resolveImageHistoryUrls(historyItems, historyImages);
            if (Object.keys(urls).length > 0) {
                createdHistoryUrlsRef.current.push(...Object.values(urls));
                setHistoryImages((prev) => ({ ...prev, ...urls }));
            }
        };
        loadHistoryImages();
    }, [historyItems, historyImages]);

    useEffect(() => {
        return () => {
            createdHistoryUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        };
    }, []);

    const previewBadgeIcon = () => {
        switch (mediaType) {
            case ReversePromptMediaType.Video:
                return <Video className="w-5 h-5" />;
            case ReversePromptMediaType.Audio:
                return <Music2 className="w-5 h-5" />;
            default:
                return <ImageIcon className="w-5 h-5" />;
        }
    };

    const renderPreview = () => {
        if (!selectedFile || !previewUrl || !mediaType) return null;
        if (mediaType === ReversePromptMediaType.Image) {
            return <img src={previewUrl} alt="preview" className="w-full max-h-[420px] object-contain rounded-xl" />;
        }
        if (mediaType === ReversePromptMediaType.Video) {
            return <video src={previewUrl} controls className="w-full max-h-[420px] rounded-xl shadow-lg" />;
        }
        return (
            <div className="w-full max-w-md mx-auto bg-gray-900 rounded-xl border border-gray-700 p-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
                    <Music2 className="w-8 h-8 text-purple-300" />
                </div>
                <p className="text-gray-200 mb-4 font-mono text-sm truncate w-full text-center">{selectedFile.name}</p>
                <audio src={previewUrl} controls className="w-full" />
            </div>
        );
    };

    const currentPrompt = analysisResult ? getPromptFromResult(analysisResult.type, analysisResult.data) : '';
    const negativePrompt = analysisResult ? getNegativePrompt(analysisResult.type, analysisResult.data) : null;

    return (
        <div className="relative flex flex-col h-full bg-[#050505]/80 text-white pr-24">
            <header className="px-8 py-6 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs uppercase text-gray-400 tracking-[0.2em]">Master Studio</p>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Sparkles className="text-purple-400" />
                        이미지 리버스
                    </h1>
                    <p className="text-sm text-gray-400">이미지·영상·오디오에서 프롬프트를 추출하고 분석합니다.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-full border border-white/10 overflow-hidden">
                        <button
                            className={`px-4 py-2 text-sm ${language === 'ko' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                            onClick={() => setLanguage('ko')}
                        >
                            한글
                        </button>
                        <button
                            className={`px-4 py-2 text-sm ${language === 'en' ? 'bg-purple-600 text-white' : 'text-gray-300'}`}
                            onClick={() => setLanguage('en')}
                        >
                            EN
                        </button>
                    </div>
                    <button
                        onClick={keyModalOpen}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                    >
                        <Settings className="w-4 h-4" />
                        API Key
                    </button>
                    <button
                        onClick={() => setShowHelpModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 transition"
                    >
                        <HelpCircle className="w-4 h-4" />
                        Help
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-auto px-8 py-6 space-y-6">
                <div
                    className="border border-dashed border-white/20 rounded-3xl p-8 bg-white/5 hover:bg-white/10 transition cursor-pointer"
                    onClick={openFileDialog}
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onDrop={onDrop}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,video/*,audio/*"
                        onChange={onFileChange}
                    />
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Upload className="w-7 h-7 text-purple-300" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold">클릭하거나 파일을 끌어다 놓으세요.</p>
                            <p className="text-sm text-gray-400">이미지, 영상, 오디오 파일을 모두 지원합니다. (최대 {formatBytes(MAX_REVERSE_FILE_SIZE)})</p>
                        </div>
                        {selectedFile && mediaType && (
                            <div className="flex items-center gap-3 bg-black/30 rounded-full px-6 py-3 border border-white/10">
                                {previewBadgeIcon()}
                                <div className="text-left">
                                    <p className="font-semibold text-white">{selectedFile.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {getMediaTypeLabel(mediaType)} · {formatBytes(selectedFile.size)}
                                    </p>
                                </div>
                                <button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        resetState();
                                    }}
                                    className="ml-2 p-1 rounded-full hover:bg-white/10 transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {selectedFile && (
                    <div className="bg-black/30 border border-white/5 rounded-3xl p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Preview</p>
                                <h3 className="text-2xl font-semibold text-white">{selectedFile.name}</h3>
                            </div>
                            <button
                                onClick={handleAnalyze}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        분석 중...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        이미지 리버스 실행
                                    </>
                                )}
                            </button>
                        </div>
                        {renderPreview()}
                    </div>
                )}

                {errorMessage && (
                    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-2xl">
                        <AlertTriangle className="w-5 h-5" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {isLoading && (
                    <div className="bg-black/40 border border-white/5 rounded-3xl p-8 flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                        <p className="text-lg font-semibold text-white">분석을 진행 중입니다...</p>
                        <p className="text-sm text-gray-400">Gemini 3 Pro Preview 모델을 호출하고 있어요.</p>
                    </div>
                )}

                {analysisResult && (
                    <section className="space-y-6">
                        <div className="border border-white/5 rounded-3xl p-6 bg-gradient-to-br from-purple-900/30 to-black/40">
                            <div className="flex flex-wrap items-center gap-4 justify-between">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-gray-300">Result</p>
                                    <h3 className="text-2xl font-bold flex items-center gap-3">
                                        {getMediaTypeLabel(analysisResult.type)}
                                        <span className="text-sm font-normal text-gray-400 px-3 py-1 bg-white/10 rounded-full">
                                            Target: {getTargetLabel(analysisResult.type)}
                                        </span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleCopyPrompt}
                                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
                                    >
                                        {copiedPrompt ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                        {copiedPrompt ? 'Copied!' : 'Copy Prompt'}
                                    </button>
                                    <button
                                        onClick={handleCopyJson}
                                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 transition"
                                    >
                                        {copiedJson ? <Check className="w-4 h-4 text-emerald-400" /> : <FileJson className="w-4 h-4" />}
                                        {copiedJson ? 'JSON Copied' : 'Copy JSON'}
                                    </button>
                                </div>
                            </div>
                            {currentPrompt && (
                                <div className="mt-4 p-4 bg-black/50 rounded-2xl border border-white/5">
                                    <p className="text-gray-400 text-xs uppercase tracking-[0.3em] mb-2">Primary Prompt</p>
                                    <p className="text-lg leading-relaxed text-white">{currentPrompt}</p>
                                </div>
                            )}
                            {negativePrompt && (
                                <div className="mt-3 text-sm text-red-200">
                                    <span className="font-semibold text-red-300 mr-2">Negative:</span>
                                    {negativePrompt}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {summaryCards.map((card) => (
                                <div key={card.title} className="bg-black/40 border border-white/5 rounded-2xl p-5 space-y-3">
                                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{card.title}</p>
                                    {renderContentValue(card.content)}
                                </div>
                            ))}
                        </div>

                        <div className="bg-black/60 border border-white/5 rounded-3xl p-6">
                            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 mb-3">Raw JSON</p>
                            <div className="bg-black/70 rounded-2xl border border-white/5 p-4 overflow-auto max-h-[360px]">
                                <pre className="text-xs text-gray-200 whitespace-pre-wrap leading-5">
                                    {JSON.stringify(analysisResult.data, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            <ImageHistorySidebar
                isOpen={isHistoryOpen}
                setIsOpen={setIsHistoryOpen}
                historyItems={historyItems}
                historyImages={historyImages}
                onSelect={handleHistorySelect}
                onDelete={deleteFromHistory}
                onToggleFavorite={toggleFavorite}
                onEdit={(item, e) => {
                    e.stopPropagation();
                    localStorage.setItem('imageStudio_load_from_history', JSON.stringify(item));
                    setToast({ type: 'success', message: '이미지 스튜디오에서 편집을 계속하세요.' });
                }}
            />

            {showKeyModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg space-y-4 relative">
                        <button className="absolute top-3 right-3 text-gray-500 hover:text-white" onClick={() => setShowKeyModal(false)}>
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <Settings className="text-purple-400" />
                            Gemini API Key
                        </h3>
                        <p className="text-sm text-gray-400">Google AI Studio에서 발급받은 Gemini API Key를 입력하세요.</p>
                        <input
                            type="password"
                            value={keyInput}
                            onChange={(event) => {
                                setKeyInput(event.target.value);
                                setKeyStatus('idle');
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                            placeholder="AIzz..."
                        />
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <button onClick={removeKey} className="text-red-400 hover:text-red-300">
                                키 삭제
                            </button>
                            <a
                                className="text-blue-400 hover:underline"
                                href="https://aistudio.google.com/app/apikey"
                                target="_blank"
                                rel="noreferrer"
                            >
                                AI Studio에서 키 발급 받기 →
                            </a>
                        </div>
                        <button
                            onClick={saveKey}
                            disabled={keyStatus === 'testing'}
                            className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {keyStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
                            {keyStatus === 'valid' ? '저장 완료' : 'API Key 저장'}
                        </button>
                        {keyStatus === 'invalid' && <p className="text-sm text-red-300">API Key 검증에 실패했습니다.</p>}
                        {keyStatus === 'valid' && <p className="text-sm text-emerald-400">정상적으로 저장되었습니다!</p>}
                    </div>
                </div>
            )}

            {showHelpModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-2xl space-y-4 relative max-h-[80vh] overflow-y-auto">
                        <button className="absolute top-3 right-3 text-gray-500 hover:text-white" onClick={() => setShowHelpModal(false)}>
                            <X className="w-5 h-5" />
                        </button>
                        <h3 className="text-2xl font-bold flex items-center gap-2">
                            <HelpCircle className="text-purple-400" />
                            이미지 리버스 가이드
                        </h3>
                        <div className="space-y-4 text-sm text-gray-300">
                            <section>
                                <h4 className="text-gray-100 font-semibold mb-1">1. 지원 포맷</h4>
                                <p>이미지(JPG/PNG/WebP), 영상(MP4/MOV), 오디오(MP3/WAV) 파일을 지원하며 최대 {formatBytes(MAX_REVERSE_FILE_SIZE)} 까지 업로드 가능합니다.</p>
                            </section>
                            <section>
                                <h4 className="text-gray-100 font-semibold mb-1">2. 사용 방법</h4>
                                <ul className="list-disc list-inside space-y-1 text-gray-400">
                                    <li>좌측 상단에서 언어를 선택하면 분석 설명 언어가 바뀝니다.</li>
                                    <li>파일을 업로드하고 “이미지 리버스 실행” 버튼을 누르면 Gemini 3 Pro Preview가 분석을 수행합니다.</li>
                                    <li>결과는 Midjourney, Sora, Suno 등 생성형 모델에서 바로 사용할 수 있는 프롬프트 형식으로 정리됩니다.</li>
                                </ul>
                            </section>
                            <section>
                                <h4 className="text-gray-100 font-semibold mb-1">3. API 비용</h4>
                                <p>Google AI Studio에서 발급받은 Gemini API Key가 필요하며, 사용량에 따라 과금됩니다. (무료 크레딧 확인 권장)</p>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageReverseStudio;

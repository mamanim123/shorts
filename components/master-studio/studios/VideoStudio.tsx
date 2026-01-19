
import React, { useState, useEffect, useRef } from 'react';
import { VideoHistoryItem } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { generateVideo, checkVideoOperation, getApiKey } from '../services/geminiService';
import { getBlob, setBlob, deleteBlob } from '../services/dbService';
import { fetchDiskImageList } from '../services/diskImageList';
import { saveVideoToDisk, deleteFileFromDisk } from '../services/serverService';
import { resolveImageHistoryUrls } from '../services/historyImageLoader';
import { v4 as uuidv4 } from 'uuid';
import { Film, Upload, Download, Trash2, Loader2, PlayCircle, ImagePlus, X, Sparkles, ShieldOff, Square, ChevronUp, ChevronDown, Library } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { ImageHistoryItem } from '../types';
import ImageHistorySidebar from '../ImageHistorySidebar';

const loadingMessages = [
    "시나리오를 구상하고 있습니다...", "캐릭터의 스타일을 정의하고 있습니다...", "조명을 설정하고 있습니다...", "카메라 앵글을 잡고 있습니다...", "촬영 준비 중입니다...", "첫 번째 컷을 촬영하고 있습니다...", "장면을 렌더링하고 있습니다...", "특수 효과를 추가하고 있습니다...", "사운드 디자인을 입히고 있습니다...", "최종 편집 중입니다...",
    "Imagining the scenario...", "Defining character styles...", "Setting up the lighting...", "Choosing camera angles...", "Preparing for the shoot...", "Filming the first cut...", "Rendering the scene...", "Adding special effects...", "Incorporating sound design...", "Finalizing the edit...",
];

const videoTemplates = [
    {
        id: 'action',
        label: '💥 [액션 / 블록버스터] (Action & Blockbuster)',
        prompt: 'in the visual style of Michael Bay and Zack Snyder, known for high-octane action, dramatic slow motion, high contrast, intense explosions, and epic cinematic scale',
        description: '특징: 터지고 부서지는 타격감, 슬로우 모션, 강렬한 대비, 웅장한 스케일. 적용: 슈퍼히어로물, 전쟁, 자동차 추격, 3D 전투씬.',
        color: 'bg-red-900/60 hover:bg-red-800/70 border-red-700/50 text-red-100'
    },
    {
        id: 'romance',
        label: '💘 [로맨스 / 감성] (Romance & Emotional)',
        prompt: 'in the visual style of Wong Kar-wai and Joe Wright, known for moody atmospheric lighting, rich emotional colors, soft focus bokeh, and sentimental storytelling',
        description: '특징: 부드러운 빛, 아웃포커싱(보케), 따뜻한 색감, 인물의 감정선 집중. 적용: 멜로 영화, 감성 브이로그, 커플 화보, 드라마틱한 인물 숏.',
        color: 'bg-pink-900/60 hover:bg-pink-800/70 border-pink-700/50 text-pink-100'
    },
    {
        id: 'thriller',
        label: '🔪 [스릴러 / 느와르] (Thriller & Noir)',
        prompt: 'in the visual style of David Fincher and Christopher Nolan, known for low-key lighting, deep shadows, cold gritty color palettes, and intense psychological tension',
        description: '특징: 어두운 그림자, 차가운 톤(초록/파랑), 긴장감, 실루엣 강조. 적용: 범죄 수사물, 공포 게임, 미스터리, 좀비물.',
        color: 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-600/50 text-slate-200'
    },
    {
        id: 'scifi',
        label: '🚀 [SF / 사이버펑크] (Sci-Fi & Cyberpunk)',
        prompt: 'in the visual style of Denis Villeneuve and Ridley Scott, known for stunning futuristic visuals, neon volumetric lighting, brutalist architecture, and immersive sci-fi atmosphere',
        description: '특징: 네온 사인, 기하학적 구조, 금속 질감, 압도적인 배경 스케일. 적용: 미래 도시, 로봇, 우주선, 하이테크 장비.',
        color: 'bg-cyan-900/60 hover:bg-cyan-800/70 border-cyan-700/50 text-cyan-100'
    },
    {
        id: 'fantasy',
        label: '🏰 [판타지 / 에픽] (Fantasy & Epic)',
        prompt: 'in the visual style of Peter Jackson and Guillermo del Toro, known for epic world-building, magical realism, intricate creature designs, and grand cinematic landscapes',
        description: '특징: 마법 같은 빛, 거대한 자연, 신비로움, 고전적인 미학. 적용: 중세 판타지, 마법사, 괴물, 신화적인 장면.',
        color: 'bg-amber-900/60 hover:bg-amber-800/70 border-amber-700/50 text-amber-100'
    },
    {
        id: 'animation',
        label: '🎨 [3D 애니 / 동화] (3D Animation)',
        prompt: 'in the visual style of Pixar and Disney Animation, known for vibrant colors, subsurface scattering textures, expressive character designs, and heartwarming storytelling',
        description: '특징: 쨍하고 예쁜 색감, 말랑한 피부 질감(SSS), 사랑스럽고 활기찬 분위기. 적용: 귀여운 캐릭터 영상, 아이들을 위한 콘텐츠, 힐링 영상.',
        color: 'bg-orange-600/60 hover:bg-orange-500/70 border-orange-400/50 text-white'
    }
];

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const videoToThumbnailBlob = (videoUrl: string): Promise<Blob | null> => {
    return new Promise(resolve => {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.crossOrigin = 'anonymous';
        video.onloadeddata = () => {
            video.currentTime = 1; // Seek to 1s to get a frame
        };
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
        };
        video.onerror = () => resolve(null);
    });
};


const VideoStudio: React.FC = () => {
    const [videoHistory, setVideoHistory] = useLocalStorage<VideoHistoryItem[]>('videoHistory', []);
    const [prompt, setPrompt] = useState('');
    const [model, setModel] = useState('veo-3.0-generate-001');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [resolution, setResolution] = useState('720p');
    const [noGuard, setNoGuard] = useState(false);
    const [isProMode, setIsProMode] = useState(false);
    const [prioritizeFreedom, setPrioritizeFreedom] = useState(false);
    const [removeBackground, setRemoveBackground] = useState(false); // New state for remove background
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

    // Image History State
    const [imageHistory, setImageHistory] = useLocalStorage<ImageHistoryItem[]>('imageHistory', []);
    const [historyImages, setHistoryImages] = useState<Record<string, string>>({});
    const [isImageHistoryOpen, setIsImageHistoryOpen] = useState(true);
    const createdImageHistoryUrlsRef = useRef<string[]>([]);
    const hasBootstrappedImageHistoryRef = useRef(false);

    const [startFrame, setStartFrame] = useState<{ file: File; url: string; base64: string } | null>(null);
    const [endFrame, setEndFrame] = useState<{ file: File; url: string; base64: string } | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [generatedVideo, setGeneratedVideo] = useState<{ url: string; id: string } | null>(null);
    const [historyThumbnails, setHistoryThumbnails] = useState<Record<string, string>>({});

    const startFrameInputRef = useRef<HTMLInputElement>(null);
    const endFrameInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<number | null>(null);
    const loadingMessageIntervalRef = useRef<number | null>(null);

    const handleImageHistoryDelete = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm('이 이미지를 삭제하시겠습니까?')) return;
        const itemToDelete = imageHistory.find(item => item.id === id);
        if (itemToDelete) {
            await deleteBlob(itemToDelete.generatedImageId);
            if (itemToDelete.localFilename) {
                try {
                    await deleteFileFromDisk(itemToDelete.localFilename, 'image');
                } catch (error) {
                    console.error('Failed to delete local file from video sidebar', error);
                }
            }
        }
        setImageHistory(prev => prev.filter(item => item.id !== id));
        if (historyImages[id]) {
            URL.revokeObjectURL(historyImages[id]);
            setHistoryImages(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        }
    };

    const handleToggleFavorite = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setImageHistory(prev => prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item));
    };

    const models = [
        { label: 'Veo 3.1 Preview', value: 'veo-3.1-generate-preview' },
        { label: 'Veo 3.1 Fast Preview', value: 'veo-3.1-fast-generate-preview' },
        { label: 'Veo 3', value: 'veo-3.0-generate-001' },
        { label: 'Veo 3 Fast', value: 'veo-3.0-fast-generate-001' },
    ];

    useEffect(() => {
        const urls: Record<string, string> = {};
        const loadHistoryThumbnails = async () => {
            if (!Array.isArray(videoHistory)) return;
            for (const item of videoHistory) {
                if (item.thumbnailId) {
                    try {
                        const blob = await getBlob(item.thumbnailId);
                        if (blob) {
                            urls[item.id] = URL.createObjectURL(blob);
                        }
                    } catch (e) {
                        console.error(`Failed to load history thumbnail ${item.thumbnailId}`, e);
                    }
                }
            }
            setHistoryThumbnails(urls);
        };



        loadHistoryThumbnails();

        return () => {
            Object.values(urls).forEach(URL.revokeObjectURL);
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
            if (loadingMessageIntervalRef.current) clearInterval(loadingMessageIntervalRef.current);
        };
    }, [videoHistory]);

    useEffect(() => {
        const loadHistoryImages = async () => {
            const urls = await resolveImageHistoryUrls(imageHistory, historyImages);
            if (Object.keys(urls).length > 0) {
                createdImageHistoryUrlsRef.current.push(...Object.values(urls));
                setHistoryImages(prev => ({ ...prev, ...urls }));
            }
        };
        loadHistoryImages();
    }, [imageHistory, historyImages]);

    useEffect(() => {
        return () => {
            createdImageHistoryUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    // Bootstrap image history from disk if empty (for sidebar thumbnails)
    useEffect(() => {
        const bootstrapFromDisk = async () => {
            if (hasBootstrappedImageHistoryRef.current || imageHistory.length > 0) return;
            const files = await fetchDiskImageList();
            if (files.length === 0) return;
            const synthetic = files.map((filename, idx) => ({
                id: `disk-${idx}-${filename}`,
                prompt: filename,
                generatedImageId: '',
                favorite: false,
                createdAt: Date.now(),
                localFilename: filename,
                settings: {
                    model,
                    aspectRatio,
                    resolution,
                    noGuard,
                    isProMode,
                    prioritizeFreedom,
                    removeBackground
                }
            } as ImageHistoryItem));
            setImageHistory(synthetic);
            hasBootstrappedImageHistoryRef.current = true;
        };
        bootstrapFromDisk();
    }, [imageHistory.length, model, aspectRatio, resolution, noGuard, isProMode, prioritizeFreedom, removeBackground, setImageHistory]);

    useEffect(() => {
        if (isProMode) {
            setModel('veo-3.1-generate-preview');
            setPrioritizeFreedom(false);
        }
    }, [isProMode]);

    useEffect(() => {
        if (prioritizeFreedom) {
            setIsProMode(false);
        }
    }, [prioritizeFreedom]);

    useEffect(() => {
        // If a model that does not support 1080p is selected (i.e., not a veo-3.1 model),
        // and the current resolution is 1080p, reset it to 720p to prevent errors.
        if (!model.includes('veo-3.1') && resolution === '1080p') {
            setResolution('720p');
        }
    }, [model]);


    const handleImageUpload = async (file: File | null, type: 'start' | 'end') => {
        if (file) {
            const url = URL.createObjectURL(file);
            const base64 = await blobToBase64(file);
            const frame = { file, url, base64 };
            if (type === 'start') setStartFrame(frame);
            else setEndFrame(frame);
        }
    };

    const cleanupIntervals = () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (loadingMessageIntervalRef.current) clearInterval(loadingMessageIntervalRef.current);
        pollingIntervalRef.current = null;
        loadingMessageIntervalRef.current = null;
    };

    const handleDrop = async (e: React.DragEvent, type: 'start' | 'end') => {
        e.preventDefault();
        e.stopPropagation();

        try {
            const jsonString = e.dataTransfer.getData('application/json');
            if (jsonString) {
                const data = JSON.parse(jsonString);
                if (data.type === 'image-history' && data.generatedImageId) {
                    const blob = await getBlob(data.generatedImageId);
                    if (blob) {
                        const file = new File([blob], "dragged-choice.png", { type: "image/png" });
                        await handleImageUpload(file, type);
                    }
                }
            }
        } catch (err) {
            console.error("Drop failed:", err);
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setGeneratedVideo(null);
        setLoadingMessage(loadingMessages[0]);

        let messageIndex = 0;
        loadingMessageIntervalRef.current = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % loadingMessages.length;
            setLoadingMessage(loadingMessages[messageIndex]);
        }, 3000);

        try {
            if (!prompt && !startFrame) {
                throw new Error("프롬프트를 입력하거나 시작 이미지를 업로드해주세요. / Please enter a prompt or upload a start frame.");
            }

            const safetySettings = noGuard ? [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
            ] : undefined;

            const currentModel = prioritizeFreedom ? 'veo-3.0-generate-preview' : isProMode ? 'veo-3.1-generate-preview' : model;

            let finalPrompt = prompt;
            if (removeBackground) {
                finalPrompt += " Remove the background completely and leave only the character without shadows. Make sure the background is fully transparent -alpha channel PNG, with smooth edges and natural lighting.";
            }

            const config = { model: currentModel, aspectRatio, resolution };

            const startFramePayload = startFrame ? { imageBytes: startFrame.base64, mimeType: startFrame.file.type } : undefined;
            const endFramePayload = endFrame ? { imageBytes: endFrame.base64, mimeType: endFrame.file.type } : undefined;

            let operation = await generateVideo(finalPrompt, config, safetySettings, startFramePayload, endFramePayload);

            const pollOperation = async (): Promise<any> => {
                if (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    try {
                        operation = await checkVideoOperation(operation);
                        return pollOperation();
                    } catch (e: any) {
                        // API 키 오류 처리 (Modal 대신 에러 메시지 표시)
                        if (e.message?.includes("Requested entity was not found")) {
                            throw new Error("API 키가 유효하지 않거나 만료되었습니다. 설정을 확인해주세요.");
                        }
                        throw e; // re-throw other errors
                    }
                }
                return operation;
            }

            const finalOperation = await pollOperation();
            console.log("[VideoStudio] Final Operation:", finalOperation);
            cleanupIntervals();

            if (finalOperation.error) {
                throw new Error(`API 오류: ${finalOperation.error.message} (코드: ${finalOperation.error.code}) / API Error: ${finalOperation.error.message} (Code: ${finalOperation.error.code})`);
            }

            const result = finalOperation.response;
            console.log("[VideoStudio] Result Body:", result);

            if (result?.blockReason) {
                let reasonMessage = `프롬프트가 안전 정책에 의해 차단되었습니다 (이유: ${result.blockReason}).`;
                if (result.blockReasonMessage) reasonMessage += ` 상세: ${result.blockReasonMessage}`;

                if (result.safetyFeedback && Array.isArray(result.safetyFeedback)) {
                    const feedbackDetails = result.safetyFeedback.map((fb: any) => `${fb.category} (${fb.probability})`).join(', ');
                    reasonMessage += ` [피드백: ${feedbackDetails}]`;
                }
                throw new Error(reasonMessage);
            }

            // Check for RAI (Responsible AI) Media Filtering
            // This happens when the video is generated but then deleted by the safety filter immediately.
            if (result?.raiMediaFilteredCount > 0) {
                let raiMessage = "생성된 비디오가 안전 정책(RAI)에 의해 차단되었습니다. / Video blocked by safety policy.";
                if (result.raiMediaFilteredReasons && Array.isArray(result.raiMediaFilteredReasons)) {
                    raiMessage += ` (이유: ${result.raiMediaFilteredReasons.join(', ')})`;
                }
                throw new Error(raiMessage + " 프롬프트를 수정하거나 '검열 해제' 옵션을 확인해보세요.");
            }

            const videoUri = result?.generatedVideos?.[0]?.video?.uri || result?.videos?.[0]?.video?.uri || result?.videos?.[0]?.uri;

            if (!videoUri) {
                const resultKeys = result ? JSON.stringify(Object.keys(result)) : "null";
                throw new Error(`비디오 생성이 완료되었지만, 데이터가 없습니다. (응답 키: ${resultKeys}) / Video generation completed but no video data found. (Keys: ${resultKeys})`);
            }

            // Using the new prioritized key access from geminiService might be tricky here directly via process.env
            // Ideally we should use a service method to get the key, but the fetch usually requires the key.
            // Let's assume geminiService ensures process.env.API_KEY is populated or we need another way.
            // Wait, I modified geminiService to SET process.env.API_KEY if found in localStorage/meta.env.
            // So process.env.API_KEY should be safe to use here.

            const apiKey = getApiKey();

            if (!apiKey) {
                throw new Error("API Key not found. Please ensure the API key is set.");
            }

            const separator = videoUri.includes('?') ? '&' : '?';
            const videoResponse = await fetch(`${videoUri}${separator}key=${apiKey}`);

            if (!videoResponse.ok) {
                const errText = await videoResponse.text().catch(() => "No response text");
                throw new Error(`생성된 비디오를 다운로드하는 데 실패했습니다. / Failed to download the generated video. Status: ${videoResponse.status} ${videoResponse.statusText}, Body: ${errText.substring(0, 100)}`);
            }

            const videoBlob = await videoResponse.blob();
            const videoId = uuidv4();
            await setBlob(videoId, videoBlob);

            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideo({ url: videoUrl, id: videoId });

            // Save to local disk
            const base64Video = await blobToBase64(videoBlob);
            const savedLocalFilename = await saveVideoToDisk(base64Video, prompt);

            const thumbnailBlob = await videoToThumbnailBlob(videoUrl);
            const thumbnailId = thumbnailBlob ? uuidv4() : undefined;
            if (thumbnailId && thumbnailBlob) {
                await setBlob(thumbnailId, thumbnailBlob);
            }

            const newHistoryItem: VideoHistoryItem = {
                id: uuidv4(),
                prompt,
                videoId,
                thumbnailId,
                localFilename: savedLocalFilename || undefined,
                settings: { model: currentModel, aspectRatio, resolution, noGuard, isProMode, prioritizeFreedom },
            };
            setVideoHistory(prev => [newHistoryItem, ...(Array.isArray(prev) ? prev : [])].slice(0, 25));

        } catch (err) {
            cleanupIntervals();
            console.error(err);
            setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다. / An unknown error occurred.");
        } finally {
            cleanupIntervals();
            setIsLoading(false);
        }
    };

    const loadFromHistory = async (item: VideoHistoryItem) => {
        setPrompt(item.prompt);
        setModel(item.settings.model);
        setAspectRatio(item.settings.aspectRatio);
        setResolution(item.settings.resolution);
        setNoGuard(item.settings.noGuard);
        setIsProMode(item.settings.isProMode ?? false);
        setPrioritizeFreedom(item.settings.prioritizeFreedom ?? false);
        setRemoveBackground(item.settings.removeBackground ?? false); // Load remove background setting

        if (generatedVideo?.url) URL.revokeObjectURL(generatedVideo.url);

        try {
            const videoBlob = await getBlob(item.videoId);
            if (videoBlob) {
                const url = URL.createObjectURL(videoBlob);
                setGeneratedVideo({ url, id: item.videoId });
            } else {
                setGeneratedVideo(null);
            }
        } catch (e) {
            console.error("Error loading video from history:", e);
            setGeneratedVideo(null);
        }

        setStartFrame(null);
        setEndFrame(null);
    };

    const deleteFromHistory = async (id: string) => {
        const itemToDelete = videoHistory.find(item => item.id === id);
        if (itemToDelete) {
            await deleteBlob(itemToDelete.videoId);
            if (itemToDelete.thumbnailId) await deleteBlob(itemToDelete.thumbnailId);
            if (itemToDelete.localFilename) {
                await deleteFileFromDisk(itemToDelete.localFilename, 'video');
            }
        }
        setVideoHistory(prev => Array.isArray(prev) ? prev.filter(item => item.id !== id) : []);
    };

    const handleOptimizeForTransparency = () => {
        setPrompt(prev => prev + " Remove the background completely and leave only the character without shadows. Make sure the background is fully transparent -alpha channel PNG, with smooth edges and natural lighting.");
        setRemoveBackground(true);
        setIsProMode(false); // Transparency often works better with specific models
        setPrioritizeFreedom(false);
        setNoGuard(true); // Allow more freedom for transparency
    };

    const toggleTemplate = (templatePrompt: string) => {
        // Robust check to see if the template is already in the prompt
        if (prompt.includes(templatePrompt)) {
            setPrompt(prompt.replace(templatePrompt, '').replace(/,\s*$/, '').trim());
        } else {
            const separator = prompt.trim().length > 0 ? ', ' : '';
            setPrompt(prompt.trim() + separator + templatePrompt);
        }
    };

    return (
        <div className="relative flex h-full bg-black/20 pr-24">
            <div className="w-[45%] flex flex-col p-4">
                <div className="flex-1 space-y-3 overflow-y-auto pr-2 -mr-2">
                    <div className="flex-none p-4 bg-gray-900/50 rounded-lg border border-white/10">
                        <div className="flex items-center mb-3">
                            <Film className="text-purple-400 mr-3" />
                            <h1 className="text-xl font-bold text-purple-300">비디오 스튜디오 / Video Studio</h1>
                        </div>

                        {/* Cinematic Style Templates Accordion */}
                        <div className="mb-3 bg-gray-800/50 rounded-lg border border-white/10 overflow-hidden">
                            <button
                                onClick={() => setIsTemplatesOpen(!isTemplatesOpen)}
                                className="w-full flex justify-between items-center p-3 text-md font-bold text-purple-300 hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center">
                                    <Library className="mr-2" size={18} />
                                    <span>🎬 시네마틱 스타일 템플릿 / Cinematic Style Templates</span>
                                </div>
                                {isTemplatesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>

                            {isTemplatesOpen && (
                                <div className="p-2 grid grid-cols-1 gap-2 border-t border-white/10">
                                    {videoTemplates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => toggleTemplate(template.prompt)}
                                            title={template.description}
                                            className={`w-full text-left py-2 px-3 rounded-lg text-sm font-semibold transition-all transform hover:scale-[1.02] border ${template.color} ${prompt.includes(template.prompt) ? 'ring-2 ring-white' : ''}`}
                                        >
                                            {template.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="Enter your prompt here..."
                            rows={4}
                            className="w-full bg-gray-800/70 p-2 rounded-md border border-gray-700 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        />


                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div
                                onClick={() => startFrameInputRef.current?.click()}
                                className="cursor-pointer h-24 bg-gray-800/70 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-600 hover:border-purple-500 transition-colors relative group"
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                onDrop={(e) => handleDrop(e, 'start')}
                            >
                                <input type="file" ref={startFrameInputRef} className="hidden" onChange={e => handleImageUpload(e.target.files?.[0] || null, 'start')} accept="image/*" />
                                {startFrame ? <>
                                    <img src={startFrame.url} alt="Start frame" className="h-full w-full object-contain p-1 rounded" />
                                    <button onClick={(e) => { e.stopPropagation(); setStartFrame(null); }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                </> : <><ImagePlus className="mb-1 text-gray-400" /> <p className="text-xs text-gray-400">시작 이미지 / Start Image</p></>}
                            </div>

                            <div
                                onClick={() => endFrameInputRef.current?.click()}
                                className="cursor-pointer h-24 bg-gray-800/70 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-600 hover:border-purple-500 transition-colors relative group"
                                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                                onDrop={(e) => handleDrop(e, 'end')}
                            >
                                <input type="file" ref={endFrameInputRef} className="hidden" onChange={e => handleImageUpload(e.target.files?.[0] || null, 'end')} accept="image/*" />
                                {endFrame ? <>
                                    <img src={endFrame.url} alt="End frame" className="h-full w-full object-contain p-1 rounded" />
                                    <button onClick={(e) => { e.stopPropagation(); setEndFrame(null); }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                </> : <><ImagePlus className="mb-1 text-gray-400" /> <p className="text-xs text-gray-400">종료 이미지 / End Image</p></>}
                            </div>
                        </div>
                    </div>

                    <div className="flex-none p-4 bg-gray-900/50 rounded-lg border border-white/10 flex flex-col overflow-hidden">
                        <h2 className="text-lg font-semibold text-gray-300 mb-3 border-b border-white/10 pb-2">설정 / Settings</h2>
                        <div className="space-y-4 overflow-y-auto pr-2 -mr-4 flex-1">
                            <div>
                                <label className="text-sm font-semibold text-gray-300 mb-1 block">모델 / Model</label>
                                <select value={model} onChange={e => setModel(e.target.value)} disabled={isProMode || prioritizeFreedom} className="w-full p-2 bg-gray-900/70 rounded-lg border border-white/20 disabled:opacity-50">
                                    {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-semibold text-gray-300 mb-1 block">화면 비율 / Aspect Ratio</label>
                                    <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full p-2 bg-gray-900/70 rounded-lg border border-white/20">
                                        <option value="16:9">16:9 (Landscape)</option>
                                        <option value="9:16">9:16 (Portrait)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-gray-300 mb-1 block">해상도 / Resolution</label>
                                    <select value={resolution} onChange={e => setResolution(e.target.value)} className="w-full p-2 bg-gray-900/70 rounded-lg border border-white/20">
                                        <option value="720p">720p</option>
                                        <option value="1080p" disabled={!model.includes('veo-3.1')}>
                                            1080p {!model.includes('veo-3.1') && '(Veo 3.1+ 전용)'}
                                        </option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2 pt-2">
                                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={noGuard} onChange={e => setNoGuard(e.target.checked)} className="form-checkbox bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-600" /> <span>가드 해제 / Guard Off</span></label>
                                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isProMode} onChange={e => setIsProMode(e.target.checked)} className="form-checkbox bg-gray-700 border-gray-600 text-fuchsia-500 focus:ring-fuchsia-600" /> <span className={`${isProMode ? 'text-fuchsia-400 font-bold' : ''}`}>프로 모드 / Pro Mode</span></label>
                                <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={prioritizeFreedom} onChange={e => setPrioritizeFreedom(e.target.checked)} className="form-checkbox bg-gray-700 border-gray-600 text-teal-500 focus:ring-teal-600" /> <span className={`${prioritizeFreedom ? 'text-teal-400 font-bold' : ''}`}>창작 자유도 우선 (Veo 3)</span></label>
                            </div>
                        </div>
                    </div>

                    {/* Remove Background for 3D Graphic Animation */}
                    <div className="flex-none p-4 bg-gray-900/50 rounded-lg border border-white/10 flex flex-col overflow-hidden">
                        <h2 className="text-lg font-semibold text-gray-300 mb-3 border-b border-white/10 pb-2">배경 없는 3D 그래픽 애니메이션 프롬프트 작성</h2>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" checked={removeBackground} onChange={e => setRemoveBackground(e.target.checked)} className="form-checkbox bg-gray-700 border-gray-600 text-purple-500 focus:ring-purple-600" />
                                <div className='flex items-center gap-1'><Square size={14} /><span>배경 제거 / Remove Background</span></div>
                            </label>
                            <button
                                onClick={handleOptimizeForTransparency}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-all duration-300 transform hover:scale-105"
                            >
                                투명도를 위한 최적 프롬프트 / Optimize Prompt for Transparency
                            </button>
                        </div>
                    </div>
                </div>
                {/* Generate Button - Fixed at bottom of left panel */}
                <div className="flex-none pt-4 mt-4 border-t border-gray-700/50">
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className={`w-full text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-lg disabled:bg-gray-600 disabled:cursor-not-allowed transition-all transform hover:scale-105 ${isProMode ? 'bg-fuchsia-600 hover:bg-fuchsia-700' : prioritizeFreedom ? 'bg-teal-600 hover:bg-teal-700' : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                        {isProMode ? '프로 생성 (Veo 3.1 Pro)' : prioritizeFreedom ? '자유 생성 (Veo 3)' : '비디오 생성'}
                    </button>
                </div>
            </div>
            <div className="w-[55%] flex flex-col p-4 space-y-3 overflow-hidden">
                <div className="flex-1 flex items-center justify-center bg-gray-900/50 rounded-lg border border-white/10 relative overflow-hidden">
                    {isLoading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-10"><Loader2 size={64} className="animate-spin text-purple-400" /><p className="mt-4 text-center text-lg font-semibold">{loadingMessage}</p></div>}
                    {error && <div className="text-red-400 text-center bg-red-900/50 p-4 rounded-lg m-4 max-h-[90%] overflow-y-auto"><p className="font-bold mb-2">오류 / Error</p>{error}</div>}
                    {generatedVideo && !isLoading && !error && (
                        <div className="w-full h-full p-2 relative group">
                            <video src={generatedVideo.url} controls autoPlay loop className="w-full h-full object-contain rounded-md" />
                            <a href={generatedVideo.url} download={`creator_studio_video_${generatedVideo.id}.mp4`} className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-purple-600 transition-all opacity-0 group-hover:opacity-100"><Download size={20} /></a>
                        </div>
                    )}
                    {!generatedVideo && !isLoading && !error && (
                        <div className="text-center text-gray-500">
                            <PlayCircle size={80} className="mx-auto mb-4" />
                            <p>결과물이 여기에 표시됩니다. / Generation result will appear here.</p>
                        </div>
                    )}
                </div>
                <div className="h-48 flex flex-col bg-gray-900/50 rounded-lg border border-white/10 overflow-hidden">
                    <h2 className="text-md font-semibold text-gray-300 p-2 border-b border-white/10">📜 히스토리 / History</h2>
                    <div className="flex-1 overflow-x-auto p-2">
                        {Array.isArray(videoHistory) && videoHistory.length > 0 ? (
                            <div className="flex space-x-3 h-full">
                                {videoHistory.map(item => (
                                    <div key={item.id} className="relative group aspect-video h-full flex-shrink-0" onClick={() => loadFromHistory(item)}>
                                        <img src={historyThumbnails[item.id]} alt={item.prompt} className="w-full h-full object-cover rounded-md cursor-pointer bg-gray-800" />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                                            <p className="text-xs text-white text-center line-clamp-3">{item.prompt}</p>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); deleteFromHistory(item.id); }} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        ) : (<p className="text-gray-500 text-sm text-center mt-4">생성된 비디오가 없습니다.</p>)}
                    </div>
                </div>
            </div>
            {/* Image History Sidebar for Video Studio */}
            <ImageHistorySidebar
                isOpen={isImageHistoryOpen}
                setIsOpen={setIsImageHistoryOpen}
                historyItems={imageHistory}
                historyImages={historyImages}
                onSelect={() => { }}
                onDelete={(id, e) => handleImageHistoryDelete(id, e)}
                onToggleFavorite={(id, e) => handleToggleFavorite(id, e)}
                onEdit={(item, e) => {
                    e.stopPropagation();
                    localStorage.setItem('imageStudio_load_from_history', JSON.stringify(item));
                    setNotification({ message: '이미지 스튜디오에서 편집을 계속하세요.', type: 'success' });
                }}
            />
        </div >
    );
};

export default VideoStudio;

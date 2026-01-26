import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Sparkles,
    Upload,
    HelpCircle,
    AlertTriangle,
    Check,
    Copy,
    Download,
    Palette,
    Type,
    Layers,
    Loader2,
} from 'lucide-react';
import useLocalStorage from '../hooks/useLocalStorage';
import ImageHistorySidebar from '../ImageHistorySidebar';
import { ImageHistoryItem } from '../types';
import { getBlob, setBlob, deleteBlob } from '../services/dbService';
import { deleteFileFromDisk } from '../services/serverService';
import { resolveImageHistoryUrls } from '../services/historyImageLoader';
import { v4 as uuidv4 } from 'uuid';
import { fetchImageHistory, saveImageHistory } from '../../../services/imageHistoryService';
import { setAppStorageValue } from '../../../services/appStorageService';

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

interface UploadedImage {
    file: File;
    url: string;
    id: string;
}

const fontFamilies = [
    'Pretendard',
    'Black Han Sans',
    'Roboto',
    'Bebas Neue',
    'Montserrat',
    'Anton',
    'Noto Sans KR',
];

const ThumbnailStudio: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [titleText, setTitleText] = useLocalStorage('thumbnail_title', '이 아이디어 놓치면 손해!');
    const [subtitleText, setSubtitleText] = useLocalStorage('thumbnail_subtitle', 'AI 썸네일 마스터 완전정복');
    const [ctaText, setCtaText] = useLocalStorage('thumbnail_cta', '지금 확인');
    const [titleSize, setTitleSize] = useLocalStorage('thumbnail_title_size', 92);
    const [subtitleSize, setSubtitleSize] = useLocalStorage('thumbnail_subtitle_size', 48);
    const [titleColor, setTitleColor] = useLocalStorage('thumbnail_title_color', '#ffffff');
    const [subtitleColor, setSubtitleColor] = useLocalStorage('thumbnail_subtitle_color', '#facc15');
    const [ctaTextColor, setCtaTextColor] = useLocalStorage('thumbnail_cta_color', '#ffffff');
    const [ctaBgColor, setCtaBgColor] = useLocalStorage('thumbnail_cta_bg', '#e11d48');
    const [fontFamily, setFontFamily] = useLocalStorage('thumbnail_font', fontFamilies[0]);
    const [gradientStart, setGradientStart] = useLocalStorage('thumbnail_gradient_start', '#0f172a');
    const [gradientEnd, setGradientEnd] = useLocalStorage('thumbnail_gradient_end', '#020617');
    const [useDiagonalOverlay, setUseDiagonalOverlay] = useLocalStorage('thumbnail_overlay', true);
    const [useGlow, setUseGlow] = useLocalStorage('thumbnail_glow', true);
    const [backgroundImage, setBackgroundImage] = useState<UploadedImage | null>(null);
    const [logoImage, setLogoImage] = useState<UploadedImage | null>(null);
    const [historyItems, setHistoryItems] = useState<ImageHistoryItem[]>([]);
    const [historyImages, setHistoryImages] = useState<Record<string, string>>({});
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const createdUrlsRef = useRef<string[]>([]);

    const handleHistorySync = useCallback(async (items: ImageHistoryItem[]) => {
        await saveImageHistory(items);
        setHistoryItems(items);
    }, []);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const serverHistory = await fetchImageHistory();
                if (Array.isArray(serverHistory)) {
                    setHistoryItems(serverHistory);
                }
            } catch (e) {
                console.error('Failed to load history', e);
            }
        };
        loadHistory();
    }, []);

    useEffect(() => {
        const load = async () => {
            const urls = await resolveImageHistoryUrls(historyItems, historyImages);
            if (Object.keys(urls).length > 0) {
                createdUrlsRef.current.push(...Object.values(urls));
                setHistoryImages(prev => ({ ...prev, ...urls }));
            }
        };
        load();
    }, [historyItems, historyImages]);

    useEffect(() => {
        return () => {
            createdUrlsRef.current.forEach(URL.revokeObjectURL);
            if (backgroundImage) URL.revokeObjectURL(backgroundImage.url);
            if (logoImage) URL.revokeObjectURL(logoImage.url);
        };
    }, [backgroundImage, logoImage]);

    const drawThumbnail = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const drawCore = () => {
            ctx.save();
            const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            gradient.addColorStop(0, gradientStart);
            gradient.addColorStop(1, gradientEnd);
            ctx.fillStyle = gradient;
            ctx.globalAlpha = backgroundImage ? 0.6 : 1;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.globalAlpha = 1;

            if (useDiagonalOverlay) {
                ctx.fillStyle = '#00000044';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(CANVAS_WIDTH * 0.65, 0);
                ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
                ctx.lineTo(CANVAS_WIDTH * 0.35, CANVAS_HEIGHT);
                ctx.closePath();
                ctx.fill();
            }

            const drawText = (text: string, startY: number, fontSize: number, color: string, maxWidth: number, bold = true) => {
                const words = text.split(' ');
                let line = '';
                let y = startY;
                ctx.font = `${bold ? '700' : '500'} ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = color;
                ctx.shadowColor = useGlow ? '#000000aa' : 'transparent';
                ctx.shadowBlur = useGlow ? 15 : 0;

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && n > 0) {
                        ctx.fillText(line, 80, y);
                        line = words[n] + ' ';
                        y += fontSize * 1.2;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, 80, y);
                return y + fontSize * 1.5;
            };

            let currentY = 200;
            currentY = drawText(titleText, currentY, titleSize, titleColor, CANVAS_WIDTH - 160);
            currentY = drawText(subtitleText, currentY, subtitleSize, subtitleColor, CANVAS_WIDTH - 160, false);

            if (ctaText.trim()) {
                const paddingX = 28;
                const paddingY = 16;
                ctx.font = `700 48px ${fontFamily}`;
                const textWidth = ctx.measureText(ctaText).width;
                const boxWidth = textWidth + paddingX * 2;
                const boxHeight = 48 + paddingY * 2;
                ctx.fillStyle = ctaBgColor;
                ctx.shadowColor = '#00000066';
                ctx.shadowBlur = 10;
                ctx.beginPath();
                const radius = 18;
                const x = 80;
                const y = currentY;
                const width = boxWidth;
                const height = boxHeight;
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + width - radius, y);
                ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
                ctx.lineTo(x + width, y + height - radius);
                ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                ctx.lineTo(x + radius, y + height);
                ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = ctaTextColor;
                ctx.shadowBlur = 0;
                ctx.fillText(ctaText, 80 + paddingX, currentY + 48 + paddingY / 2);
            }

            if (logoImage) {
                const img = new Image();
                img.src = logoImage.url;
                img.onload = () => {
                    const size = 150;
                    ctx.save();
                    ctx.globalAlpha = 0.9;
                    ctx.drawImage(img, CANVAS_WIDTH - size - 60, 60, size, size);
                    ctx.restore();
                };
            }
            ctx.restore();
        };

        const baseFill = () => {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            drawCore();
        };

        if (backgroundImage) {
            const img = new Image();
            img.src = backgroundImage.url;
            img.onload = () => {
                ctx.save();
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
                const ratio = Math.max(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height);
                const width = img.width * ratio;
                const height = img.height * ratio;
                ctx.drawImage(img, (CANVAS_WIDTH - width) / 2, (CANVAS_HEIGHT - height) / 2, width, height);
                ctx.restore();
                drawCore();
            };
            img.onerror = baseFill;
        } else {
            baseFill();
        }
    }, [
        backgroundImage,
        logoImage,
        titleText,
        subtitleText,
        ctaText,
        titleSize,
        subtitleSize,
        titleColor,
        subtitleColor,
        ctaTextColor,
        ctaBgColor,
        fontFamily,
        gradientStart,
        gradientEnd,
        useDiagonalOverlay,
        useGlow,
    ]);

    useEffect(() => {
        drawThumbnail();
    }, [drawThumbnail]);

    const handleFile = (file: File | null, setter: React.Dispatch<React.SetStateAction<UploadedImage | null>>) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        setter({ file, url, id: uuidv4() });
    };

    const handleBackgroundChange = (file: File | null) => {
        if (backgroundImage) URL.revokeObjectURL(backgroundImage.url);
        if (!file) {
            setBackgroundImage(null);
            return;
        }
        handleFile(file, setBackgroundImage);
    };

    const handleLogoChange = (file: File | null) => {
        if (logoImage) URL.revokeObjectURL(logoImage.url);
        if (!file) {
            setLogoImage(null);
            return;
        }
        handleFile(file, setLogoImage);
    };

    const handleBackgroundDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            handleBackgroundChange(file);
        }
    };

    const saveThumbnail = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        setIsSaving(true);
        setError(null);
        canvas.toBlob(async (blob) => {
            if (!blob) {
                setError('캔버스를 저장할 수 없습니다.');
                setIsSaving(false);
                return;
            }
            const imageId = uuidv4();
            await setBlob(imageId, blob);
            const newItem: ImageHistoryItem = {
                id: uuidv4(),
                prompt: `${titleText} | ${subtitleText}`,
                generatedImageId: imageId,
                settings: {
                    mode: 'Generate',
                    aspectRatio: '16:9',
                    activeCheatKeys: [],
                    noGuard: false,
                    enhanceBackground: false,
                    removeBackground: false,
                    creativity: 0,
                },
            };
            handleHistorySync([newItem, ...(Array.isArray(historyItems) ? historyItems : [])].slice(0, 50));
            setIsSaving(false);
        }, 'image/png');
    };

    const downloadThumbnail = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `thumbnail_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const copyToClipboard = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([
                    new window.ClipboardItem({
                        'image/png': blob,
                    }),
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch {
                setError('클립보드 복사에 실패했습니다.');
            }
        });
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
                    console.error('Failed to delete file', error);
                }
            }
        }
        const updated = historyItems.filter(item => item.id !== id);
        handleHistorySync(updated);
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
        const updated = historyItems.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item);
        handleHistorySync(updated);
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
                        console.error('Failed to fetch history image', error);
                    }
                }
            } else if (historyImages[item.id]) {
                const resp = await fetch(historyImages[item.id]);
                const blob = await resp.blob();
                file = new File([blob], `${item.id}.png`, { type: blob.type || 'image/png' });
            }
            if (file) {
                handleBackgroundChange(file);
            }
        } catch (error) {
            console.error('Failed to load history image', error);
        }
    };

    const previewStyle = useMemo(() => ({
        width: '100%',
        maxWidth: 640,
        borderRadius: '1rem',
        boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
    }), []);

    return (
        <div className="relative flex h-full bg-[#050505]/80 text-white pr-24">
            <div className="w-[38%] flex flex-col gap-4 p-6 overflow-y-auto">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Master Studio</p>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Sparkles className="text-pink-400" />
                        썸네일 스튜디오
                    </h1>
                    <p className="text-sm text-gray-400">텍스트, 컬러, 로고를 조합해 하이엔드 썸네일을 만드세요.</p>
                </div>

                <div
                    className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3"
                    onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                    }}
                    onDrop={handleBackgroundDrop}
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Upload className="text-purple-300" />
                            배경 이미지
                        </h3>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1 text-xs bg-purple-600/60 rounded-full hover:bg-purple-600"
                        >
                            업로드
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleBackgroundChange(event.target.files?.[0] || null)}
                        />
                    </div>
                    {backgroundImage ? (
                        <div className="relative group">
                            <img src={backgroundImage.url} alt="배경" className="w-full rounded-xl border border-white/10" />
                            <button
                                onClick={() => handleBackgroundChange(null)}
                                className="absolute top-2 right-2 px-2 py-1 text-xs bg-black/60 rounded-full opacity-0 group-hover:opacity-100"
                            >
                                제거
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400">배경을 업로드하지 않으면 그라데이션만 적용됩니다.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-400 flex items-center gap-1">
                                <Palette size={14} />
                                그라데이션 시작
                            </label>
                            <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="w-full h-10 rounded-lg border border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 flex items-center gap-1">
                                <Palette size={14} />
                                그라데이션 끝
                            </label>
                            <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="w-full h-10 rounded-lg border border-white/10" />
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input type="checkbox" className="accent-purple-500" checked={useDiagonalOverlay} onChange={(e) => setUseDiagonalOverlay(e.target.checked)} />
                        대각선 오버레이
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input type="checkbox" className="accent-purple-500" checked={useGlow} onChange={(e) => setUseGlow(e.target.checked)} />
                        글로우 효과
                    </label>
                </div>

                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Type className="text-green-300" />
                            텍스트 설정
                        </h3>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-400">제목</label>
                            <input value={titleText} onChange={(e) => setTitleText(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2" />
                            <input type="range" min={40} max={120} value={titleSize} onChange={(e) => setTitleSize(Number(e.target.value))} className="w-full mt-1" />
                            <input type="color" value={titleColor} onChange={(e) => setTitleColor(e.target.value)} className="w-full h-8 rounded border border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">서브 텍스트</label>
                            <input value={subtitleText} onChange={(e) => setSubtitleText(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2" />
                            <input type="range" min={24} max={72} value={subtitleSize} onChange={(e) => setSubtitleSize(Number(e.target.value))} className="w-full mt-1" />
                            <input type="color" value={subtitleColor} onChange={(e) => setSubtitleColor(e.target.value)} className="w-full h-8 rounded border border-white/10" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">CTA 버튼</label>
                            <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2" />
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                <input type="color" value={ctaBgColor} onChange={(e) => setCtaBgColor(e.target.value)} className="w-full h-8 rounded border border-white/10" />
                                <input type="color" value={ctaTextColor} onChange={(e) => setCtaTextColor(e.target.value)} className="w-full h-8 rounded border border-white/10" />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">폰트</label>
                            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                                {fontFamilies.map(font => (
                                    <option key={font} value={font}>{font}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Layers className="text-orange-300" />
                            로고/아이콘
                        </h3>
                        <button
                            onClick={() => logoInputRef.current?.click()}
                            className="px-3 py-1 text-xs bg-orange-500/60 rounded-full hover:bg-orange-500"
                        >
                            추가
                        </button>
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleLogoChange(event.target.files?.[0] || null)}
                        />
                    </div>
                    {logoImage && (
                        <div className="flex items-center justify-between bg-black/30 rounded-lg px-3 py-2 text-sm">
                            <span className="text-gray-300 truncate">{logoImage.file.name}</span>
                            <button onClick={() => handleLogoChange(null)} className="text-red-400 text-xs">삭제</button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 flex items-center gap-2 text-sm">
                        <AlertTriangle size={16} />
                        {error}
                    </div>
                )}

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={saveThumbnail}
                        disabled={isSaving}
                        className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        저장 & 히스토리
                    </button>
                    <button
                        onClick={downloadThumbnail}
                        className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        PNG 다운로드
                    </button>
                    <button
                        onClick={copyToClipboard}
                        className="flex-1 min-w-[140px] px-4 py-3 rounded-xl bg-white/5 hover:bg-white/15 text-white font-semibold flex items-center justify-center gap-2"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                        {copied ? '복사 완료' : '클립보드 복사'}
                    </button>
                </div>

                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 space-y-2 text-sm text-gray-300">
                    <h3 className="flex items-center gap-2 text-white font-semibold">
                        <HelpCircle size={16} />
                        활용 팁
                    </h3>
                    <p>• 배경 이미지는 밝기 조절을 통해 글자가 잘 보이도록 처리합니다.</p>
                    <p>• 제목은 2~3줄, 서브 텍스트는 1~2줄로 간결하게 유지하세요.</p>
                    <p>• CTA 버튼은 강렬한 대비 색상을 사용하면 클릭률이 올라갑니다.</p>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
                <div className="w-full flex justify-between items-center">
                    <div className="text-sm text-gray-400">미리보기 1280x720</div>
                    {backgroundImage && (
                        <button onClick={() => handleBackgroundChange(null)} className="text-xs text-gray-400 hover:text-white">
                            배경 제거
                        </button>
                    )}
                </div>
                <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={previewStyle} />
            </div>

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
                    setAppStorageValue('imageStudio_load_from_history', item);
                    setNotification({ message: '이미지 스튜디오에서 편집을 계속하세요.', type: 'success' });
                }}
            />
        </div>
    );
};

export default ThumbnailStudio;

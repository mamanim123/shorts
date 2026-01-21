/**
 * ShortsLabPanel.tsx
 * 쇼츠 영상 제작을 위한 테스트 패널 V2
 * 
 * 기능:
 * - AI 대본 생성 (신규!)
 * - 대본 입력 → 씬 자동 분해
 * - 고정 문구 체크박스 (ON/OFF 토글)
 * - 프롬프트 미리보기
 * - 클립보드 복사
 * - 이미지 생성 / AI 생성 버튼 (신규!)
 */

import React, { useState, useCallback, useRef } from 'react';
import { Copy, Check, Sparkles, Settings2, Eye, Scissors, RefreshCw, Wand2, Loader2, Folder, Image as ImageIcon, Bot, Maximize2, Trash2, Download, Edit3, Video, X } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { buildLabScriptPrompt, LAB_GENRE_GUIDELINES, validateAndFixPrompt } from '../services/labPromptBuilder';
import { parseJsonFromText } from '../services/jsonParse';
import { generateImage, generateImageWithImagen, initGeminiService } from './master-studio/services/geminiService';
import { showToast } from './Toast';
import Lightbox from './master-studio/Lightbox';

// ============================================
// 고정 문구 데이터 (기존 코드에서 추출)
// ============================================

const QUALITY_TAGS = 'photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field';
const ASPECT_RATIO = '--ar 9:16';

const KOREAN_IDENTITY_FEMALE = 'A stunning Korean woman';
const KOREAN_IDENTITY_MALE = 'A handsome Korean man';

const SLOT_PRESETS = {
    'woman-a': {
        name: 'Woman A (롱웨이브)',
        desc: 'Long soft-wave hairstyle, Voluptuous hourglass figure',
        prompt: 'Long soft-wave hairstyle with natural highlights, Voluptuous hourglass figure with elegant posture'
    },
    'woman-b': {
        name: 'Woman B (단발)',
        desc: 'Short bob hair, Petite but glamorous',
        prompt: 'Short stylish bob hair with side swept bangs, Petite but glamorous figure with confident stance'
    },
    'man-a': {
        name: 'Man A (운동형)',
        desc: 'Fit athletic build, Short neat hairstyle',
        prompt: 'Fit athletic build with broad shoulders, Short neat hairstyle with clean-shaven face'
    }
};

const BODY_KEYWORDS = [
    'Elegant hourglass silhouette',
    'Slender and graceful frame',
    'Naturally voluptuous curves',
    'Athletic and toned physique'
];

const OUTFIT_KEYWORDS = [
    'Tight-fitting premium tailored design',
    'Luxurious high-end fashion',
    'Elegant evening wear',
    'Casual chic streetwear'
];

const ETHNICITY_KEYWORDS = [
    'South Korean style',
    'Cheongdam-dong high society aura',
    'K-drama visual aesthetics'
];

const STYLE_PRESETS = [
    { id: 'cinematic', name: '시네마틱 실사', prompt: 'cinematic photography, film grain, dramatic lighting, shallow depth of field' },
    { id: 'kdrama', name: 'K-드라마', prompt: 'Korean drama aesthetic, soft romantic lighting, dreamy atmosphere' },
    { id: 'noir', name: '누아르', prompt: 'film noir style, high contrast, dramatic shadows, moody atmosphere' },
    { id: 'fantasy', name: '감성사극', prompt: 'Korean historical drama, hanbok inspired, ethereal lighting' },
    { id: 'illustration', name: '동화 일러스트', prompt: 'fairytale illustration style, soft pastel colors, whimsical' }
];

// ============================================
// 장르 옵션 (labPromptBuilder에서 가져옴)
// ============================================

const GENRE_OPTIONS = [
    { id: 'comedy-humor', name: '코미디/유머', desc: '웃긴 상황, 황당한 에피소드' },
    { id: 'romance-flutter', name: '로맨스/설렘', desc: '감성적인 연애, 설렘 가득한 순간' },
    { id: 'affair-suspicion', name: '불륜/외도 의심', desc: '배우자의 이상한 행동, 의심과 반전' },
    { id: 'hit-twist-spicy', name: '대박 반전 (매운맛)', desc: '아슬아슬한 오해와 건전한 반전' }
];

const AGE_OPTIONS = [
    { value: '', label: '나이 미선택' },
    { value: '20s', label: '20대' },
    { value: '30s', label: '30대' },
    { value: '40s', label: '40대' },
    { value: '50s', label: '50대' },
    { value: '60s', label: '60대' },
    { value: '70s', label: '70대' },
];

const OUTFIT_OPTIONS = [
    { value: '', label: '의상 미선택' },
    { value: 'wearing traditional Korean hanbok', label: '조선 시대 한복' },
    { value: 'wearing an ultra-short jeogori that barely covers the chest and an ultra-short tight-fitting low-waisted mini chima skirt revealing the navel, provocative tavern hostess style, strictly no high-waist', label: '섹시한 주막 한복(타이트/초미니)' },
    { value: 'wearing a sheer see-through silk jeogori and a matching low-waisted mini chima skirt revealing the navel', label: '시스루 한복(비치는 소재)' },
    { value: 'wearing an ultra-short see-through jeogori and a tight-fitting low-waisted mini chima with elegant color gradation, revealing the navel', label: '그라데이션 시스루(타이트/초미니)' },
    { value: 'wearing an ultra-short see-through jeogori and a tight-fitting low-waisted mini chima with intricate floral embroidery, revealing the navel', label: '화려한 자수 시스루(타이트/초미니)' },
    { value: 'wearing an ultra-short see-through jeogori and a tight-fitting low-waisted mini chima in soft pastel tones, revealing the navel', label: '파스텔 시스루(타이트/초미니)' },
    { value: 'wearing modern K-drama style outfit', label: 'K-드라마 리얼톤' },
    { value: 'wearing cinematic noir style dark outfit', label: '누아르 스타일' },
    { value: 'wearing soft fairytale-like outfit', label: '동화풍 의상' },
    { value: 'wearing epic cinematic costume', label: '시네마틱 의상' },
    { value: 'wearing mystical Asian folklore costume', label: '동양 설화 복식' },
    { value: 'wearing luxury high-fashion outfit', label: '하이퍼 리얼(명품)' },
    { value: 'wearing professional golf attire', label: '골프웨어' },
    { value: 'wearing a sharp business suit', label: '비즈니스 정장' },
    { value: 'wearing casual everyday clothes', label: '캐주얼' },
];

const AGE_LABELS = ['20대', '30대', '40대', '50대', '60대'];

const getVoiceBadge = (scene: Scene) => {
    switch (scene.voiceType) {
        case 'lipSync':
            return { label: 'LIP', tone: 'border-amber-500/30 text-amber-300' };
        case 'both':
            return { label: 'BOTH', tone: 'border-purple-500/30 text-purple-300' };
        case 'none':
            return { label: 'NONE', tone: 'border-slate-600/50 text-slate-400' };
        case 'narration':
        default:
            return { label: 'NARR', tone: 'border-emerald-500/30 text-emerald-400' };
    }
};

// ============================================
// 타입 정의
// ============================================

interface Scene {
    number: number;
    text: string;
    prompt: string;
    imageUrl?: string;
    // 씨네보드 호환 필드
    shortPromptKo?: string;
    longPromptKo?: string;
    summary?: string;
    camera?: string;
    shotType?: string;
    age?: string;
    outfit?: string;
    isSelected?: boolean;
    // 영상 프롬프트 필드
    videoPrompt?: string;
    dialogue?: string;
    voiceType?: 'narration' | 'lipSync' | 'both' | 'none';
    narrationText?: string;
    narrationEmotion?: string;
    narrationSpeed?: 'slow' | 'normal' | 'slightly-fast' | 'fast';
    lipSyncSpeaker?: string;
    lipSyncSpeakerName?: string;
    lipSyncLine?: string;
    lipSyncEmotion?: string;
    lipSyncTiming?: 'start' | 'mid' | 'end';
    isVideoPromptGenerating?: boolean;
    videoUrl?: string;
    isVideoGenerating?: boolean;
    videoError?: string;
}

interface PromptSettings {
    useQualityTags: boolean;
    useAspectRatio: boolean;
    useKoreanIdentity: boolean;
    koreanGender: 'female' | 'male';
    useSlotSystem: boolean;
    selectedSlot: keyof typeof SLOT_PRESETS | '';
    useBodyKeywords: boolean;
    selectedBody: string;
    useOutfitKeywords: boolean;
    selectedOutfit: string;
    useEthnicityKeywords: boolean;
    selectedEthnicity: string;
    useStylePreset: boolean;
    selectedStyle: string;
}

// ============================================
// 후처리 유틸리티 함수 (쇼츠 생성기에서 이식)
// ============================================

/**
 * 한국인 정체성을 강제로 적용하는 함수
 * - 다른 국적 언급을 한국인으로 교체
 * - "A stunning Korean woman in her Xs" 프리픽스 강제 적용
 */
const enforceKoreanIdentity = (text: string, targetAgeLabel?: string, sceneNumber?: number, gender: 'female' | 'male' = 'female'): string => {
    if (!text) return text;
    let updated = text;

    // 다른 국적을 한국인으로 교체
    const replacements: Array<[RegExp, string]> = [
        [/\b(Vietnamese|Vietnam|Thai|Thailand|Japanese|Japan|Chinese|China|American|Europe(?:an)?|Western)\b/gi, 'Korean'],
        [/(베트남|베트남인|태국|일본|중국|미국|서양|서구)/g, '한국인']
    ];
    replacements.forEach(([regex, value]) => {
        updated = updated.replace(regex, value);
    });

    // 나이 포맷팅
    const formatEnglishAgeLabel = (label?: string): string => {
        if (!label) return '';
        const match = label.match(/\d+/);
        return match ? `${match[0]}s` : '';
    };

    const englishAge = formatEnglishAgeLabel(targetAgeLabel);
    const ageString = englishAge ? `in ${gender === 'female' ? 'her' : 'his'} ${englishAge}` : '';
    const identityDescriptor = gender === 'female'
        ? `A stunning Korean woman ${ageString}`.trim()
        : `Korean man ${ageString}`.trim();

    // 씬 번호와 정체성을 맨 앞으로 강제 배치
    const scenePrefix = sceneNumber ? `Scene ${sceneNumber}, ` : '';
    const mandatoryPrefix = `${scenePrefix}${identityDescriptor}, `;

    // 기존 텍스트에서 중복될 수 있는 패턴들 제거
    const cleanText = updated
        .replace(/^Scene \d+[\.,]\s*/i, '')
        .replace(/^A stunning Korean woman in her [\d\w\s]+[\.,]\s*/i, '')
        .replace(/^A handsome Korean man in his [\d\w\s]+[\.,]\s*/i, '')
        .replace(/^A stunning Korean woman[\.,]\s*/i, '')
        .replace(/^A handsome Korean man[\.,]\s*/i, '')
        .replace(/^in (her|his) [\d\w\s]+[\.,]\s*/i, '')
        .trim();

    // 카메라 앵글로 시작하면 정체성을 맨 앞에 배치
    const cameraAnglePattern = /^(Candid|Two-shot|Three-shot|Dutch|Extreme|Close-up|Wide|Medium|Over-the-shoulder|Zoom|Pan|Tracking|Bird|Aerial|Low|High|Point of view|POV)/i;
    if (cameraAnglePattern.test(cleanText)) {
        return `${scenePrefix}${identityDescriptor}, ${cleanText}`;
    }

    return `${mandatoryPrefix}${cleanText}`;
};

/**
 * 씬 프롬프트를 보강하는 함수
 * - 의상 태그 추가
 * - 씬 번호 강제 적용
 * - "no text" 태그 추가
 */
const enhanceScenePrompt = (
    text: string = "",
    options: {
        sceneNumber?: number;
        femaleOutfit?: string;
        maleOutfit?: string;
        targetAgeLabel?: string;
        gender?: 'female' | 'male';
    } = {}
): string => {
    if (!text) return text;
    let updated = text.trim();

    // LLM이 이미 Outfit을 제공했는지 확인
    const llmProvidedOutfit = updated.includes("Outfit:");

    // 의상 태그가 없으면 추가
    if (!llmProvidedOutfit && options.gender === 'male' && options.maleOutfit) {
        const maleTag = `Outfit: ${options.maleOutfit}`;
        if (!updated.includes(maleTag) && !updated.includes(options.maleOutfit)) {
            updated += `, ${maleTag}`;
        }
    } else if (!llmProvidedOutfit && options.femaleOutfit) {
        const femaleTag = `Outfit: ${options.femaleOutfit}`;
        if (!updated.includes(femaleTag) && !updated.includes(options.femaleOutfit)) {
            updated += `, ${femaleTag}`;
        }
    }

    // 씬 번호 강제 적용
    if (options.sceneNumber !== undefined) {
        const scenePrefix = `Scene ${options.sceneNumber}. `;
        if (!updated.startsWith(`Scene ${options.sceneNumber}`)) {
            updated = updated.replace(/^Scene \d+\.\s*/i, '');
            updated = scenePrefix + updated;
        }
    }

    // "no text" 태그 추가
    const noTextTag = "no text, no letters, no typography, no watermarks, no words";
    if (!updated.toLowerCase().includes("no text")) {
        updated += `, ${noTextTag}`;
    }

    // 한국인 정체성 강제 적용
    updated = enforceKoreanIdentity(updated, options.targetAgeLabel, options.sceneNumber, options.gender);

    return updated;
};

/**
 * AI 생성된 씬들을 후처리하는 함수
 */
const postProcessAiScenes = (
    scenes: any[],
    options: {
        femaleOutfit?: string;
        maleOutfit?: string;
        targetAgeLabel?: string;
        gender?: 'female' | 'male';
        characters?: any[]; // [NEW] 캐릭터 정보 추가
    }
): any[] => {
    if (!Array.isArray(scenes)) return [];

    return scenes.map((scene: any, idx: number) => {
        const sceneNumber = scene.sceneNumber || idx + 1;
        const shotType = (scene.shotType || '원샷') as '원샷' | '투샷' | '쓰리샷';

        // 1. 기존 방식의 강화 (identity, outfit 등 삽입)
        let processedPrompt = enhanceScenePrompt(
            scene.longPrompt || scene.shortPrompt || '',
            {
                sceneNumber,
                femaleOutfit: options.femaleOutfit,
                maleOutfit: options.maleOutfit,
                targetAgeLabel: options.targetAgeLabel,
                gender: options.gender
            }
        );

        // 2. [V3.2] 신규 검증 및 자동 수정 레이어 적용
        if (options.characters) {
            const validation = validateAndFixPrompt(
                processedPrompt,
                shotType,
                options.characters.map(c => ({
                    identity: c.identity || '',
                    hair: c.hair || '',
                    body: c.body || '',
                    outfit: c.outfit || ''
                }))
            );
            processedPrompt = validation.fixedPrompt;
        }

        // 3. 네거티브 프롬프트 분리 처리
        const negativePrompt = scene.negativePrompt || '';

        return {
            ...scene,
            longPrompt: processedPrompt,
            negativePrompt: negativePrompt, // [NEW] 필드 추가
            shortPrompt: scene.shortPrompt ? enhanceScenePrompt(
                scene.shortPrompt,
                { sceneNumber, femaleOutfit: options.femaleOutfit, maleOutfit: options.maleOutfit, targetAgeLabel: options.targetAgeLabel, gender: options.gender }
            ) : processedPrompt
        };
    });
};

// ============================================
// 메인 컴포넌트
// ============================================

export const ShortsLabPanel: React.FC = () => {
    // 대본 입력 상태
    const [scriptInput, setScriptInput] = useState('');
    const [scenes, setScenes] = useState<Scene[]>([]);

    // AI 대본 생성 상태 (신규!)
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenre, setAiGenre] = useState('comedy-humor');
    const [aiTargetAge, setAiTargetAge] = useState('40대');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [currentFolderName, setCurrentFolderName] = useState<string | null>(null);

    // 이미지 생성 상태 (신규!)
    const [imageModel] = useState<string>('imagen-4.0-generate-001');
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [aiForwardingId, setAiForwardingId] = useState<string | null>(null);
    const aiForwardAbortRef = useRef<AbortController | null>(null);
    const [noGuard] = useState<boolean>(false);

    // 프롬프트 설정 상태
    const [settings, setSettings] = useState<PromptSettings>({
        useQualityTags: true,
        useAspectRatio: true,
        useKoreanIdentity: true,
        koreanGender: 'female',
        useSlotSystem: false,
        selectedSlot: '',
        useBodyKeywords: true,
        selectedBody: BODY_KEYWORDS[0],
        useOutfitKeywords: true,
        selectedOutfit: OUTFIT_KEYWORDS[0],
        useEthnicityKeywords: true,
        selectedEthnicity: ETHNICITY_KEYWORDS[0],
        useStylePreset: true,
        selectedStyle: 'cinematic'
    });

    // UI 상태
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'input' | 'settings' | 'preview'>('input');
    const [sceneTabs, setSceneTabs] = useState<Record<number, 'IMG' | 'VIDEO' | 'JSON' | 'VOICE'>>({});
    const [editingScene, setEditingScene] = useState<{ number: number; field: 'ko' | 'en' } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);

    // 폴더 불러오기 상태 (신규!)
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [availableFolders, setAvailableFolders] = useState<Array<{ folderName: string; imageCount: number; scriptCount: number; mtimeMs: number }>>([]);
    const [isLoadingFolder, setIsLoadingFolder] = useState(false);
    const [isVideoImporting, setIsVideoImporting] = useState<number | null>(null);

    // [NEW] 최근 영상 선택 모달 상태
    const [showRecentVideoPicker, setShowRecentVideoPicker] = useState(false);
    const [recentVideos, setRecentVideos] = useState<any[]>([]);
    const [pickingSceneNumber, setPickingSceneNumber] = useState<number | null>(null);
    const [isImportingSpecific, setIsImportingSpecific] = useState(false);

    // Gemini 서비스 초기화
    React.useEffect(() => {
        initGeminiService();
    }, []);

    React.useEffect(() => {
        try {
            const savedScenes = localStorage.getItem('shorts-lab-scenes');
            const savedFolder = localStorage.getItem('shorts-lab-folder');
            const savedTopic = localStorage.getItem('shorts-lab-topic');

            if (savedFolder) setCurrentFolderName(savedFolder);
            if (savedTopic) setAiTopic(savedTopic);

            if (savedScenes) {
                const parsed = JSON.parse(savedScenes);
                if (Array.isArray(parsed)) {
                    const normalized = (parsed as Scene[]).map(scene => {
                        const voiceType = scene.voiceType || (scene.lipSyncLine ? 'both' : scene.narrationText ? 'narration' : 'none');
                        return {
                            ...scene,
                            voiceType,
                            narrationText: scene.narrationText || scene.text,
                            narrationSpeed: scene.narrationSpeed || 'normal'
                        };
                    });
                    setScenes(normalized);
                    setActiveTab('preview');
                }

            }
        } catch (error) {
            console.warn('[ShortsLab] Failed to restore state:', error);
        }
    }, []);

    // [NEW] 상태 변경 시 localStorage 저장
    React.useEffect(() => {
        if (currentFolderName) localStorage.setItem('shorts-lab-folder', currentFolderName);
        else localStorage.removeItem('shorts-lab-folder');
    }, [currentFolderName]);

    React.useEffect(() => {
        if (aiTopic) localStorage.setItem('shorts-lab-topic', aiTopic);
        else localStorage.removeItem('shorts-lab-topic');
    }, [aiTopic]);

    // ============================================
    // 이미지 생성 핸들러 (신규!)
    // ============================================

    const handleGenerateImage = async (prompt: string, id: string, sceneNumber?: number) => {
        if (generatingId) return;
        setGeneratingId(id);

        try {
            const safetySettings = noGuard ? [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
            ] : undefined;

            let result: any;
            if (imageModel.toLowerCase().includes('imagen')) {
                result = await generateImageWithImagen(prompt, "", { aspectRatio: "9:16", model: imageModel }, safetySettings);
            } else {
                result = await generateImage(prompt, { aspectRatio: "9:16", model: imageModel }, safetySettings);
            }

            let base64Image: string | null = null;

            if (result && 'generatedImages' in result && result.generatedImages?.length > 0) {
                const generatedImage = result.generatedImages[0];
                if (generatedImage?.image?.imageBytes) {
                    base64Image = generatedImage.image.imageBytes;
                } else if (generatedImage?.imageBytes) {
                    base64Image = generatedImage.imageBytes;
                }
            }
            else if (result && result.images && result.images.length > 0) {
                base64Image = result.images[0];
            }
            else if (result && result.candidates) {
                const inlineData = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
                if (inlineData?.data) {
                    base64Image = inlineData.data;
                }
            }

            if (base64Image) {
                // 이미지 저장 API 호출
                const saveResponse = await fetch('http://localhost:3002/api/save-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imageData: `data:image/png;base64,${base64Image}`,
                        prompt,
                        storyId: currentFolderName || aiTopic?.trim()?.replace(/\s+/g, '_') || 'shorts-lab',


                        sceneNumber
                    })
                });

                const saveResult = await saveResponse.json();
                if (saveResult.success) {
                    // ✅ [NEW] Scene에 이미지 URL 저장
                    const imageUrl = saveResult.url || `/generated_scripts/대본폴더/${currentFolderName || 'shorts-lab'}/images/${saveResult.filename?.split('/').pop()}`;
                    setScenes(prev => prev.map(s =>
                        s.number === sceneNumber
                            ? { ...s, imageUrl }
                            : s
                    ));
                    showToast(`이미지가 생성되었습니다: ${saveResult.filename}`, 'success');
                } else {
                    throw new Error(saveResult.error || '이미지 저장 실패');
                }
            } else if (result && 'generatedImages' in result && result.generatedImages?.length === 0) {
                throw new Error("이미지가 생성되지 않았습니다. 안전 정책에 의해 차단되었을 수 있습니다.");
            } else {
                throw new Error("이미지 데이터 형식을 인식할 수 없습니다.");
            }
        } catch (error: any) {
            console.error("Image Generation Failed:", error);
            if (error.message?.includes("API key")) {
                const key = window.prompt("API Key가 필요합니다. Google Gemini API Key를 입력해주세요:");
                if (key) {
                    localStorage.setItem('master_studio_api_key', key);
                    showToast("API Key가 저장되었습니다. 다시 시도해주세요.", 'success');
                }
            } else {
                showToast(`이미지 생성 실패: ${error.message || "알 수 없는 오류"}`, 'error');
            }
        } finally {
            setGeneratingId(null);
        }
    };

    const cancelAiForwarding = () => {
        if (aiForwardAbortRef.current) {
            try {
                aiForwardAbortRef.current.abort();
            } catch (err) {
                console.warn('AI forwarding abort error:', err);
            }
            aiForwardAbortRef.current = null;
        }
        setAiForwardingId(null);
    };

    const handleForwardPromptToImageAI = async (prompt: string, id: string, sceneNumber?: number) => {
        if (aiForwardingId && aiForwardingId === id) {
            cancelAiForwarding();
            showToast('AI 생성 요청을 취소했습니다.', 'info');
            return;
        }
        if (!prompt || !prompt.trim()) {
            showToast('전송할 프롬프트가 없습니다.', 'warning');
            return;
        }
        setAiForwardingId(id);
        try {
            if (aiForwardAbortRef.current) {
                aiForwardAbortRef.current.abort();
            }
            const controller = new AbortController();
            aiForwardAbortRef.current = controller;

            const response = await fetch('http://localhost:3002/api/image/ai-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    storyId: currentFolderName || aiTopic?.trim()?.replace(/\s+/g, '_') || 'shorts-lab',


                    sceneNumber,
                    service: 'GEMINI',
                    autoCapture: true,
                    title: 'ShortsLab'
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                let message = 'AI 서비스 전송에 실패했습니다.';
                try {
                    const errorData = await response.json();
                    if (errorData?.error) message = errorData.error;
                } catch (err) {
                    console.warn("Failed to parse AI forward error", err);
                }
                throw new Error(message);
            }

            const payload = await response.json();
            const infoDetails: string[] = [];
            if (payload?.imagePath) infoDetails.push(`경로 ${payload.imagePath}`);
            if (typeof payload?.bytes === 'number') {
                const kb = (payload.bytes / 1024).toFixed(1);
                infoDetails.push(`용량 ${kb}KB`);
            }
            const infoMessage = infoDetails.length > 0
                ? ` - ${infoDetails.join(' / ')}`
                : (payload?.message ? ` - ${payload.message}` : '');
            showToast(`AI 서비스(${payload?.service || 'GEMINI'})로 프롬프트를 전송했습니다.${infoMessage}`, 'success');

            // ✅ [FIX] Scene에 이미지 URL 업데이트 - 미리보기에 이미지 표시
            if (payload?.success && sceneNumber !== undefined) {
                const resolvedStoryId = payload.storyId || currentFolderName || 'shorts-lab';
                // 서버에서 전달해준 URL을 우선 사용 (하이브리드 경로 지원)
                const imageUrl = payload.url
                    ? `http://localhost:3002${payload.url}`
                    : `http://localhost:3002/generated_scripts/대본폴더/${resolvedStoryId}/images/${payload.filename}`;
                setScenes(prev => prev.map(s =>
                    s.number === sceneNumber
                        ? { ...s, imageUrl }
                        : s
                ));
                console.log(`[ShortsLab] Scene ${sceneNumber} image updated: ${imageUrl}`);
            }
        } catch (error) {
            console.error("Failed to forward prompt to AI image service", error);
            if (error instanceof Error && error.message.includes('Waiting failed')) {
                showToast('이미지를 찾지 못했습니다. 프롬프트 전송 후 새 이미지가 생성되는지 확인해주세요.', 'warning');
            } else {
                showToast(error instanceof Error ? error.message : 'AI 서비스 전송 오류가 발생했습니다.', 'error');
            }
        } finally {
            setAiForwardingId(null);
            if (aiForwardAbortRef.current) {
                aiForwardAbortRef.current = null;
            }
        }
    };

    // ============================================
    // 씬 분해 로직
    // ============================================

    const parseScenes = useCallback((text: string): Scene[] => {
        if (!text.trim()) return [];

        // 1. 전처리: 대본 본문만 추출 시도 (구분선 --- 사이의 내용)
        let targetText = text;
        const scriptMatch = text.match(/---\s*([\s\S]*?)\s*---/);
        if (scriptMatch) targetText = scriptMatch[1];

        // 2. 불필요한 메타 정보 제거 (제목:, 펀치라인:, 등)
        const lines = targetText.split('\n')
            .map(line => line.trim())
            .filter(line => {
                if (!line) return false;
                if (line.startsWith('제목:')) return false;
                if (line.startsWith('펀치라인:')) return false;
                if (line.startsWith('---')) return false;
                if (line.startsWith('**')) return false; // 마크다운 강조 제거
                return true;
            });

        if (lines.length === 0) return [];

        const parsedScenes: Scene[] = [];
        const scenePattern = /^[\[\(]?\s*(?:씬|scene|장면)\s*(\d+)\s*[\]\)]?\s*[:：]?\s*/i;
        const numberPattern = /^(\d+)[.\)]\s*/;

        let currentScene: { number: number; lines: string[] } | null = null;

        for (const line of lines) {
            const sceneMatch = line.match(scenePattern);
            const numberMatch = line.match(numberPattern);

            if (sceneMatch || numberMatch) {
                // 새로운 씬 시작
                if (currentScene) {
                    parsedScenes.push({
                        number: currentScene.number,
                        text: currentScene.lines.join(' ').trim(),
                        prompt: ''
                    });
                }
                const num = sceneMatch ? parseInt(sceneMatch[1]) : parseInt(numberMatch![1]);
                const content = line.replace(scenePattern, '').replace(numberPattern, '').trim();
                currentScene = {
                    number: num,
                    lines: content ? [content] : []
                };
            } else if (currentScene) {
                // 현재 씬에 내용 추가
                currentScene.lines.push(line);
            } else {
                // 번호가 없는 경우: 각 줄을 하나의 씬으로 간주
                parsedScenes.push({
                    number: parsedScenes.length + 1,
                    text: line,
                    prompt: ''
                });
            }
        }

        // 마지막 씬 추가
        if (currentScene) {
            parsedScenes.push({
                number: currentScene.number,
                text: currentScene.lines.join(' ').trim(),
                prompt: ''
            });
        }

        // 결과가 너무 적으면 (예: 1개) 문장 단위로 재분할 시도
        if (parsedScenes.length === 1 && parsedScenes[0].text.includes('.')) {
            const sentences = parsedScenes[0].text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
            if (sentences.length > 1) {
                return sentences.map((s, i) => ({
                    number: i + 1,
                    text: s.trim(),
                    prompt: ''
                }));
            }
        }

        return parsedScenes;
    }, []);

    // ============================================
    // 프롬프트 생성 로직
    // ============================================

    const generatePrompt = useCallback((sceneText: string): string => {
        const parts: string[] = [];

        // 1. 한국인 정체성
        if (settings.useKoreanIdentity) {
            const identity = settings.koreanGender === 'female'
                ? KOREAN_IDENTITY_FEMALE
                : 'Korean man';
            const ageString = aiTargetAge ? `in ${settings.koreanGender === 'female' ? 'her' : 'his'} ${aiTargetAge}` : '';
            parts.push(`${identity} ${ageString}`);
        }

        // 2. 슬롯 시스템
        if (settings.useSlotSystem && settings.selectedSlot) {
            parts.push(SLOT_PRESETS[settings.selectedSlot].prompt);
        }

        // 3. 체형 키워드
        if (settings.useBodyKeywords && settings.selectedBody) {
            parts.push(settings.selectedBody);
        }

        // 4. 민족성 키워드
        if (settings.useEthnicityKeywords && settings.selectedEthnicity) {
            parts.push(settings.selectedEthnicity);
        }

        // 5. 의상 키워드
        if (settings.useOutfitKeywords && settings.selectedOutfit) {
            parts.push(settings.selectedOutfit);
        }

        // 6. 씬 설명 (원본 텍스트 기반)
        parts.push(sceneText);

        // 7. 스타일 프리셋
        if (settings.useStylePreset && settings.selectedStyle) {
            const style = STYLE_PRESETS.find(s => s.id === settings.selectedStyle);
            if (style) {
                parts.push(style.prompt);
            }
        }

        // 8. 퀄리티 태그
        if (settings.useQualityTags) {
            parts.push(QUALITY_TAGS);
        }

        // 9. 화면비
        if (settings.useAspectRatio) {
            parts.push(ASPECT_RATIO);
        }

        // 10. 텍스트 방지 태그 (이미지 생성 시 텍스트 생성 방지)
        parts.push('no text, no letters, no typography, no watermarks, no words');

        return parts.filter(Boolean).join(', ');
    }, [settings, aiTargetAge]);

    // ============================================
    // 이벤트 핸들러
    // ============================================

    const handleParseScenes = () => {
        const parsed = parseScenes(scriptInput);
        const withPrompts = parsed.map(scene => ({
            ...scene,
            prompt: generatePrompt(scene.text)
        }));
        setScenes(withPrompts);
        setActiveTab('preview');

        try {
            localStorage.setItem('shorts-lab-scenes', JSON.stringify(withPrompts));
        } catch (storageError) {
            console.warn('[ShortsLab] Failed to persist scenes:', storageError);
        }
    };

    const handleRegeneratePrompts = () => {
        if (scenes.length === 0) return;
        const updated = scenes.map(scene => ({
            ...scene,
            prompt: generatePrompt(scene.text)
        }));
        setScenes(updated);
        setActiveTab('preview');

        try {
            localStorage.setItem('shorts-lab-scenes', JSON.stringify(updated));
        } catch (storageError) {
            console.warn('[ShortsLab] Failed to persist scenes:', storageError);
        }
    };

    const handleRefineVideoPrompt = async (sceneNumber: number) => {
        const sceneIndex = scenes.findIndex(s => s.number === sceneNumber);
        if (sceneIndex === -1) return;

        const scene = scenes[sceneIndex];
        if (scene.isVideoPromptGenerating) return;

        setScenes(prev => {
            const updated = [...prev];
            updated[sceneIndex] = { ...scene, isVideoPromptGenerating: true };
            return updated;
        });

        try {
            const response = await fetch('http://localhost:3002/api/video/refine-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: scriptInput,
                    scriptLine: scene.text,
                    action: scene.summary || '',
                    emotion: scene.narrationEmotion || scene.lipSyncEmotion || '',
                    visualPrompt: scene.prompt,
                    targetAge: aiTargetAge,
                    characterSlot: settings.selectedSlot || ''
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '비디오 프롬프트 생성 실패');
            }

            const data = await response.json();
            setScenes(prev => {
                const updated = [...prev];
                updated[sceneIndex] = {
                    ...scene,
                    videoPrompt: data.refinedPrompt,
                    dialogue: data.dialogue || scene.dialogue || '',
                    isVideoPromptGenerating: false
                };
                return updated;
            });
            showToast(`${sceneNumber}번 장면의 비디오 지시어가 생성되었습니다.`, 'success');
        } catch (error) {
            console.error('Video prompt refinement failed:', error);
            setScenes(prev => {
                const updated = [...prev];
                updated[sceneIndex] = { ...scene, isVideoPromptGenerating: false };
                return updated;
            });
            showToast('비디오 지시어 생성에 실패했습니다.', 'error');
        }
    };

    const handleGenerateSceneVideo = async (sceneNumber: number) => {
        const sceneIndex = scenes.findIndex(s => s.number === sceneNumber);
        if (sceneIndex === -1) return;

        const scene = scenes[sceneIndex];
        if (scene.isVideoGenerating || !scene.videoPrompt) return;

        setScenes(prev => {
            const updated = [...prev];
            updated[sceneIndex] = { ...scene, isVideoGenerating: true, videoError: undefined };
            return updated;
        });

        try {
            const response = await fetch('http://localhost:3002/api/video/generate-smart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refinedPrompt: scene.videoPrompt,
                    storyId: getEffectiveStoryId(),
                    storyTitle: aiTopic?.trim() || 'ShortsLab',
                    sceneNumber: scene.number,
                    imageUrl: scene.imageUrl
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '비디오 생성 실패');
            }

            const data = await response.json();
            setScenes(prev => {
                const updated = [...prev];
                const resolvedUrl = data.url ? data.url : undefined;
                updated[sceneIndex] = { ...scene, videoUrl: resolvedUrl, isVideoGenerating: false };
                try {
                    localStorage.setItem('shorts-lab-scenes', JSON.stringify(updated));
                } catch (storageError) {
                    console.warn('[ShortsLab] Failed to persist scenes:', storageError);
                }
                return updated;
            });

            if (data.url) {
                showToast(`${sceneNumber}번 장면의 비디오 생성이 완료되었습니다.`, 'success');
            } else if (data.message) {
                showToast(data.message, 'info');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : '비디오 생성 실패';
            if (message.includes('aborted')) {
                showToast('비디오 생성이 취소되었습니다.', 'info');
            } else {
                showToast(`비디오 생성 실패: ${message}`, 'error');
            }
            setScenes(prev => {
                const updated = [...prev];
                updated[sceneIndex] = { ...scene, isVideoGenerating: false, videoError: message };
                return updated;
            });
        }
    };

    const handleCancelSceneVideo = (sceneNumber: number) => {
        const sceneIndex = scenes.findIndex(s => s.number === sceneNumber);
        if (sceneIndex === -1) return;

        setScenes(prev => {
            const updated = [...prev];
            updated[sceneIndex] = { ...updated[sceneIndex], isVideoGenerating: false };
            try {
                localStorage.setItem('shorts-lab-scenes', JSON.stringify(updated));
            } catch (storageError) {
                console.warn('[ShortsLab] Failed to persist scenes:', storageError);
            }
            return updated;
        });
        showToast('비디오 생성이 취소되었습니다.', 'info');
    };

    // ============================================
    // 스마트 경로 추출 및 비디오 가져오기
    // ============================================

    /**
     * [NEW] 현재 작업 중인 폴더명을 지능적으로 결정하는 함수
     */
    const getEffectiveStoryId = () => {
        // 1. 현재 상태에 폴더명이 있으면 최우선 사용
        if (currentFolderName) return currentFolderName;

        // 2. 현재 로드된 장면들의 이미지 URL에서 폴더명 추출 시도
        // 예: /generated_scripts/대본폴더/260119_.../images/scene-01.png
        const sceneWithImage = scenes.find(s => s.imageUrl);
        if (sceneWithImage?.imageUrl) {
            try {
                const url = sceneWithImage.imageUrl;
                const match = url.match(/대본폴더\/([^\/]+)\//);
                if (match && match[1]) {
                    const extracted = decodeURIComponent(match[1]);
                    console.log(`[ShortsLab] Extracted folder name from image URL: ${extracted}`);
                    return extracted;
                }
            } catch (e) {
                console.warn('[ShortsLab] Failed to extract folder from URL:', e);
            }
        }

        // 3. 주제(aiTopic)를 기반으로 생성
        if (aiTopic?.trim()) {
            return aiTopic.trim().replace(/\s+/g, '_');
        }

        // 4. 최후의 수단
        return 'shorts-lab';
    };

    const getTempPreviewUrl = (fileName: string) =>
        `http://localhost:3002/api/video/temp-preview/${encodeURIComponent(fileName)}`;

    const isSceneMismatch = (fileName: string, sceneNumber: number | null) => {
        if (!sceneNumber) return false;
        const lower = fileName.toLowerCase();
        const padded = String(sceneNumber).padStart(2, '0');
        const candidates = [
            `scene-${padded}`,
            `scene_${padded}`,
            `scene-${sceneNumber}`,
            `scene_${sceneNumber}`
        ];
        return !candidates.some(token => lower.includes(token));
    };

    const handleImportVideoFromDownloads = async (sceneNumber: number) => {
        const sceneIndex = scenes.findIndex(s => s.number === sceneNumber);
        if (sceneIndex === -1) return;

        const scene = scenes[sceneIndex];
        setIsVideoImporting(sceneNumber);

        try {
            showToast('다운로드 폴더에서 영상을 찾는 중...', 'info');

            const storyId = getEffectiveStoryId();
            const response = await fetch('http://localhost:3002/api/video/import-from-downloads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: storyId,
                    storyTitle: aiTopic?.trim() || storyId.split('_').pop() || 'ShortsLab',
                    sceneNumber: scene.number
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '영상 가져오기 실패');
            }

            // [NEW] 10분이 경과하여 선택이 필요한 경우
            if (data.requiresSelection) {
                setRecentVideos((data.recentFiles || []).map((video: any) => ({ ...video, previewUrl: getTempPreviewUrl(video.name) })));
                setPickingSceneNumber(sceneNumber);
                setShowRecentVideoPicker(true);
                showToast(data.message, 'info');
                return;
            }

            // Scene 업데이트
            setScenes(prev => {
                const updated = [...prev];
                updated[sceneIndex] = {
                    ...scene,
                    videoUrl: `http://localhost:3002${data.url}`,
                    videoError: undefined
                };
                try {
                    localStorage.setItem('shorts-lab-scenes', JSON.stringify(updated));
                } catch (e) {
                    console.warn('[ShortsLab] Failed to persist scenes:', e);
                }
                return updated;
            });

            showToast(`✅ 영상 가져오기 완료! (${data.originalFile}, ${data.sizeFormatted})`, 'success');

        } catch (error) {
            console.error('[ShortsLab] Video import failed:', error);
            showToast(error instanceof Error ? error.message : '영상 가져오기 실패', 'error');
        } finally {
            setIsVideoImporting(null);
        }
    };

    // [NEW] 특정 파일 선택해서 가져오기 실행
    const handleImportSpecificVideo = async (fileName: string) => {
        if (isSceneMismatch(fileName, pickingSceneNumber)) {
            const ok = window.confirm(`마마님, 선택한 영상이 ${pickingSceneNumber}번 장면과 일치하지 않아 보입니다. 그래도 가져올까요?`);
            if (!ok) return;
        }
        if (pickingSceneNumber === null) return;

        const storyId = getEffectiveStoryId();
        setIsImportingSpecific(true);
        try {
            const response = await fetch('http://localhost:3002/api/video/import-specific', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: storyId,
                    storyTitle: aiTopic?.trim() || storyId.split('_').pop() || 'ShortsLab',
                    sceneNumber: pickingSceneNumber,
                    fileName
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || '영상 가져오기 실패');

            setScenes(prev => prev.map(s =>
                s.number === pickingSceneNumber
                    ? { ...s, videoUrl: `http://localhost:3002${data.url}`, videoError: undefined }
                    : s
            ));

            showToast(`✅ 영상 가져오기 완료! (${data.originalFile})`, 'success');
            setShowRecentVideoPicker(false);
        } catch (error: any) {
            showToast(error.message || '영상 가져오기 실패', 'error');
        } finally {
            setIsImportingSpecific(false);
        }
    };
    // ============================================
    // AI 대본 생성 (신규!)
    // ============================================

    const handleAiGenerate = async () => {
        if (!aiTopic.trim()) {
            setGenerationError('주제를 입력해주세요.');
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);

        try {
            // 쇼츠랩 전용 경량 프롬프트 생성
            const prompt = buildLabScriptPrompt({
                topic: aiTopic,
                genre: aiGenre,
                targetAge: aiTargetAge,
                gender: settings.koreanGender
            });

            // 서버 API 호출 (백엔드는 3002 포트)
            const response = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    maxTokens: 2000,
                    temperature: 0.9
                })
            });

            if (!response.ok) {
                throw new Error(`API 오류: ${response.status}`);
            }

            const data = await response.json();
            const generatedText = data.rawResponse || data.text || data.result || '';

            // 스토리 폴더명 저장 (기존 시스템 호환)
            if (data._folderName) {
                setCurrentFolderName(data._folderName);
                console.log(`[ShortsLab] Story folder assigned: ${data._folderName}`);
            }

            // 결과에서 대본 및 scenes 추출
            let finalScript = '';  // [FIX] 빈 문자열로 초기화 (JSON 전체가 들어가는 것 방지)
            let extractedScenes: Scene[] = [];

            try {
                // 1. JSON 클리닝 로직 강화: "JSON" 접두사, 마크다운 등 제거
                let jsonClean = generatedText.trim();
                jsonClean = jsonClean.replace(/^(JSON|json)\s+/, "").trim();
                if (jsonClean.startsWith("```")) {
                    jsonClean = jsonClean.replace(/^```(json)?/, "").replace(/```$/, "").trim();
                }

                const parsed = parseJsonFromText<any>(jsonClean, ["script", "scriptBody", "scriptLine", "shortPrompt", "shortPromptKo", "longPrompt", "longPromptKo", "hook", "punchline", "twist", "title"]);
                if (!parsed) {
                    throw new Error('JSON parse failed');
                }

                // 쇼츠 생성기 호환 구조 (scriptBody) 또는 기존 구조 (scripts[0].script)
                const scriptData = parsed.scripts?.[0] || parsed;
                const rawScript = scriptData.scriptBody || scriptData.script || parsed.scriptBody || parsed.script || "";

                if (rawScript) {
                    // --- 구분자가 포함되어 있다면 본문만 추출 시도
                    const scriptMatch = rawScript.match(/---\s*([\s\S]*?)\s*---/);
                    finalScript = scriptMatch ? scriptMatch[1].trim() : rawScript.trim();
                }

                // scenes 배열 추출 + 후처리 적용
                const scenesSource = scriptData.scenes || parsed.scenes;
                if (scenesSource && Array.isArray(scenesSource)) {
                    // [FIX] 후처리 적용: 한국인 정체성, 의상, no text 태그 등
                    const lockedOutfits = scriptData.lockedOutfits || parsed.lockedOutfits;
                    const preferredFemaleOutfit = lockedOutfits?.womanA || settings.selectedOutfit || undefined;
                    const preferredMaleOutfit = lockedOutfits?.manA || undefined;

                    const processedScenes = postProcessAiScenes(scenesSource, {
                        femaleOutfit: preferredFemaleOutfit,
                        maleOutfit: preferredMaleOutfit,
                        targetAgeLabel: aiTargetAge,
                        gender: settings.koreanGender,
                        characters: scenesSource[0]?.characters || scenesSource.characters || scriptData.characters || parsed.characters // 캐릭터 정보 전달
                    });

                    extractedScenes = processedScenes.map((scene: any, idx: number) => {
                        const sceneText = scene.scriptLine || scene.summary || scene.text || `장면 ${idx + 1}`;
                        const narrationText = typeof scene.narration === 'string'
                            ? scene.narration
                            : scene.narration?.text || '';
                        const lipSyncLine = scene.lipSync?.line || scene.dialogue || '';
                        const voiceType = scene.voiceType || (lipSyncLine ? 'both' : narrationText ? 'narration' : 'none');

                        return {
                            number: scene.sceneNumber || idx + 1,
                            text: sceneText,
                            prompt: scene.longPrompt || scene.shortPrompt || scene.prompt || '',
                            imageUrl: undefined,
                            shortPromptKo: scene.shortPromptKo || '',
                            longPromptKo: scene.longPromptKo || '',
                            summary: scene.summary || sceneText,
                            camera: scene.camera || '',
                            shotType: scene.shotType || '',
                            age: scene.age || '',
                            outfit: scene.outfit || '',
                            isSelected: true,
                            videoPrompt: scene.videoPrompt || '',
                            dialogue: scene.dialogue || lipSyncLine || '',
                            voiceType,
                            narrationText: narrationText || sceneText,
                            narrationEmotion: scene.narration?.emotion || '',
                            narrationSpeed: scene.narration?.speed || 'normal',
                            lipSyncSpeaker: scene.lipSync?.speaker || '',
                            lipSyncSpeakerName: scene.lipSync?.speakerName || '',
                            lipSyncLine: lipSyncLine || '',
                            lipSyncEmotion: scene.lipSync?.emotion || '',
                            lipSyncTiming: scene.lipSync?.timing || undefined
                        };
                    });
                    console.log(`[ShortsLab] Extracted and post-processed ${extractedScenes.length} scenes`);
                }
            } catch (e) {
                console.warn('[ShortsLab] JSON parsing failed, using regex fallback:', e);
                // 2. JSON 파싱 실패 시 정규식 시도
                const scriptMatch = generatedText.match(/---\s*([\s\S]*?)\s*---/);
                if (scriptMatch) {
                    finalScript = scriptMatch[1].trim();
                }
                if (!finalScript) {
                    const scriptBodyMatch = generatedText.match(/"scriptBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                    if (scriptBodyMatch && scriptBodyMatch[1]) {
                        try {
                            finalScript = JSON.parse(`"${scriptBodyMatch[1]}"`);
                        } catch {
                            finalScript = scriptBodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                        }
                    }
                }
            }

            // 결과 유효성 체크 및 상태 업데이트
            if (!finalScript && extractedScenes.length === 0) {
                throw new Error('대본을 추출할 수 없습니다. AI 응답 형식이 올바르지 않습니다.');
            }

            if (finalScript) setScriptInput(finalScript.trim());

            if (extractedScenes.length > 0) {
                setScenes(extractedScenes);
                setActiveTab('preview');
            }

        } catch (error) {
            console.error('AI 대본 생성 실패:', error);
            setGenerationError(error instanceof Error ? error.message : '대본 생성에 실패했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };

    // ============================================
    // 폴더 불러오기 (신규!)
    // ============================================

    const handleLoadFolders = async () => {
        try {
            const response = await fetch('http://localhost:3002/api/scripts/story-folders');
            if (!response.ok) throw new Error('폴더 목록 로드 실패');
            const folders = await response.json();
            setAvailableFolders(folders);
            setShowFolderPicker(true);
        } catch (error) {
            console.error('Failed to load folders:', error);
            showToast('폴더 목록을 불러오는데 실패했습니다.', 'error');
        }
    };

    const handleSelectFolder = async (folderName: string) => {
        setIsLoadingFolder(true);
        try {
            let loadedScenes: Scene[] = [];

            // 1. 대본 로드 및 scenes 추출
            const scriptResponse = await fetch(`http://localhost:3002/api/scripts/by-folder/${encodeURIComponent(folderName)}`);
            if (scriptResponse.ok) {
                const scriptData = await scriptResponse.json();
                const content = scriptData.content || '';

                // ✅ [개선] 서버에서 이미 파싱한 scenes가 있으면 우선 사용
                if (scriptData.parsedScenes && Array.isArray(scriptData.parsedScenes) && scriptData.parsedScenes.length > 0) {
                    console.log(`[ShortsLab] Using ${scriptData.parsedScenes.length} scenes parsed by server.`);
                    loadedScenes = scriptData.parsedScenes.map((scene: any, idx: number) => ({
                        number: scene.sceneNumber || idx + 1,
                        text: scene.scriptLine || scene.summary || scene.text || `장면 ${idx + 1}`,
                        prompt: scene.longPrompt || scene.shortPrompt || scene.prompt || scene.imagePrompt || '',
                        imageUrl: undefined,
                        shortPromptKo: scene.shortPromptKo || '',
                        longPromptKo: scene.longPromptKo || '',
                        summary: scene.summary || scene.scriptLine || `장면 ${idx + 1}`,
                        camera: scene.camera || '',
                        shotType: scene.shotType || '',
                        age: scene.age || '',
                        outfit: scene.outfit || '',
                        videoPrompt: scene.videoPrompt || '',
                        isSelected: true
                    }));
                } else {
                    // 서버 파싱 실패 시 클라이언트 폴백 (기존 로직 유지하되 안전하게)
                    try {
                        let jsonClean = content.trim();
                        jsonClean = jsonClean.replace(/^(JSON|json)\s+/, "").trim();
                        if (jsonClean.startsWith("```")) {
                            jsonClean = jsonClean.replace(/^```(json|txt)?/, "").replace(/```$/, "").trim();
                        }

                        // 직접 파싱 시도 (간단한 경우만 성공할 것)
                        const parsed = parseJsonFromText<any>(jsonClean, ["script", "scriptBody", "scriptLine", "shortPrompt", "shortPromptKo", "longPrompt", "longPromptKo", "hook", "punchline", "twist", "title"]);
                        if (!parsed) {
                            throw new Error('JSON parse failed');
                        }
                        const scriptObj = parsed.scripts?.[0] || parsed;
                        const scenesSource = scriptObj.scenes || parsed.scenes;

                        if (scenesSource && Array.isArray(scenesSource)) {
                            loadedScenes = scenesSource.map((scene: any, idx: number) => ({
                                number: scene.sceneNumber || idx + 1,
                                text: scene.scriptLine || scene.summary || scene.text || `장면 ${idx + 1}`,
                                prompt: scene.longPrompt || scene.shortPrompt || scene.prompt || scene.imagePrompt || '',
                                imageUrl: undefined,
                                shortPromptKo: scene.shortPromptKo || '',
                                longPromptKo: scene.longPromptKo || '',
                                summary: scene.summary || scene.scriptLine || `장면 ${idx + 1}`,
                                camera: scene.camera || '',
                                shotType: scene.shotType || '',
                                isSelected: true
                            }));
                        }
                    } catch (e) {
                        console.warn("[ShortsLab] Client-side JSON parse failed during fallback.");
                    }
                }

                // 대본 텍스트 설정 (UI 입력창용)
                try {
                    // JSON 데이터 내에서 대본 본문 추출 시도
                    let jsonClean = content.trim();
                    if (jsonClean.includes('{')) {
                        const firstOpen = jsonClean.indexOf('{');
                        const lastClose = jsonClean.lastIndexOf('}');
                        if (firstOpen !== -1 && lastClose !== -1) {
                            const candidate = jsonClean.substring(firstOpen, lastClose + 1);
                            const parsed = JSON.parse(candidate);
                            const scriptObj = parsed.scripts?.[0] || parsed;
                            const rawScript = scriptObj.scriptBody || scriptObj.script || '';
                            if (rawScript) {
                                const scriptMatch = rawScript.match(/---\s*([\s\S]*?)\s*---/);
                                setScriptInput(scriptMatch ? scriptMatch[1].trim() : rawScript.trim());
                            } else {
                                setScriptInput(content); // 실패 시 전체 내용
                            }
                        }
                    } else {
                        setScriptInput(content);
                    }
                } catch (e) {
                    setScriptInput(content);
                }
            }

            // 2. 이미지 로드
            const imagesResponse = await fetch(`http://localhost:3002/api/images/by-story/${encodeURIComponent(folderName)}`);
            let imagesByScene = new Map<number, string>();
            if (imagesResponse.ok) {
                const images = await imagesResponse.json();
                images.forEach((img: any) => {
                    const sceneNum = img.sceneNumber || parseInt(img.filename?.match(/scene-?(\d+)/i)?.[1] || '0');
                    if (sceneNum > 0) {
                        const url = img.isUnifiedPath
                            ? `http://localhost:3002/generated_scripts/${img.filename}`
                            : `http://localhost:3002/generated_scripts/images/${img.filename}`;
                        imagesByScene.set(sceneNum, url);
                    }
                });
            }

            // 3. [NEW] 비디오 로드
            const videosResponse = await fetch(`http://localhost:3002/api/video/by-story/${encodeURIComponent(folderName)}`);
            let videosByScene = new Map<number, string>();
            if (videosResponse.ok) {
                const videos = await videosResponse.json();
                videos.forEach((vid: any) => {
                    if (vid.sceneNumber) {
                        videosByScene.set(vid.sceneNumber, `http://localhost:3002${vid.url}`);
                    }
                });
            }

            // 4. 통합 및 상항 업데이트
            if (loadedScenes.length > 0) {
                loadedScenes = loadedScenes.map(scene => ({
                    ...scene,
                    imageUrl: imagesByScene.get(scene.number) || undefined,
                    videoUrl: videosByScene.get(scene.number) || undefined
                }));
                setScenes(loadedScenes);
                console.log(`[ShortsLab] Successfully loaded ${loadedScenes.length} scenes with images and videos.`);
            } else if (imagesByScene.size > 0 || videosByScene.size > 0) {
                // 대본 파싱은 실패했지만 이미지나 비디오는 있는 경우
                const allSceneNums = new Set([...imagesByScene.keys(), ...videosByScene.keys()]);
                const restoredScenes: Scene[] = Array.from(allSceneNums)
                    .sort((a, b) => a - b)
                    .map(num => ({
                        number: num,
                        text: `Scene ${num} (Restored)`,
                        prompt: '',
                        imageUrl: imagesByScene.get(num),
                        videoUrl: videosByScene.get(num),
                        isSelected: true
                    }));
                setScenes(restoredScenes);
                console.log(`[ShortsLab] Restored ${restoredScenes.length} scenes from media.`);
            } else {
                showToast('대본 또는 미디어 데이터를 찾을 수 없습니다.', 'warning');
            }

            setCurrentFolderName(folderName);
            setShowFolderPicker(false);
            setActiveTab('preview');
            showToast(`"${folderName}" 폴더를 불러왔습니다.`, 'success');
        } catch (error) {
            console.error('[ShortsLab] Failed to select folder:', error);
            showToast('데이터를 불러오는 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsLoadingFolder(false);
        }
    };

    // ============================================
    // 장면 설정 및 편집 핸들러 (씨네보드 이식)
    // ============================================

    const handleUpdateSceneSettings = (
        sceneNumber: number,
        field: 'age' | 'outfit' | 'dialogue' | 'voiceType' | 'narrationText' | 'narrationEmotion' | 'narrationSpeed' | 'lipSyncLine' | 'lipSyncSpeakerName' | 'lipSyncEmotion' | 'lipSyncTiming',
        value: string
    ) => {
        setScenes(prev => prev.map(s => {
            if (s.number !== sceneNumber) return s;
            if (field === 'lipSyncLine') {
                return { ...s, lipSyncLine: value, dialogue: value };
            }
            if (field === 'dialogue') {
                return { ...s, dialogue: value, lipSyncLine: value };
            }
            return { ...s, [field]: value };
        }));
    };

    const handleStartEdit = (sceneNumber: number, field: 'ko' | 'en', currentVal: string) => {
        setEditingScene({ number: sceneNumber, field });
        setEditValue(currentVal || '');
    };

    const handleSaveEdit = () => {
        if (!editingScene) return;
        setScenes(prev => prev.map(s => {
            if (s.number === editingScene.number) {
                if (editingScene.field === 'ko') return { ...s, longPromptKo: editValue };
                if (editingScene.field === 'en') return { ...s, prompt: editValue };
            }
            return s;
        }));
        setEditingScene(null);
        setEditValue('');
    };

    const handleToggleSceneSelection = (sceneNumber: number) => {
        setScenes(prev => prev.map(s =>
            s.number === sceneNumber ? { ...s, isSelected: !s.isSelected } : s
        ));
    };

    const handleDownloadSceneImage = async (scene: Scene) => {
        if (!scene.imageUrl) return;
        try {
            const response = await fetch(scene.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scene_${scene.number}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (e) {
            console.error('Download failed:', e);
            showToast('이미지 다운로드에 실패했습니다.', 'error');
        }
    };

    const handleDeleteScene = (sceneNumber: number) => {
        if (window.confirm(`Scene ${sceneNumber}를 삭제하시겠습니까?`)) {
            setScenes(prev => prev.filter(s => s.number !== sceneNumber));
        }
    };

    // ============================================
    // 렌더링
    // ============================================

    return (
        <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
            {/* 헤더 */}
            <div className="flex-shrink-0 border-b border-slate-800 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold">쇼츠 랩</h2>
                            <p className="text-xs text-slate-400">프롬프트 고정 문구 테스트</p>
                        </div>
                    </div>

                    {/* 탭 버튼 */}
                    <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                        {(['input', 'settings', 'preview'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${activeTab === tab
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab === 'input' && <Scissors className="w-4 h-4" />}
                                {tab === 'settings' && <Settings2 className="w-4 h-4" />}
                                {tab === 'preview' && <Eye className="w-4 h-4" />}
                                {tab === 'input' ? '입력' : tab === 'settings' ? '설정' : '미리보기'}
                            </button>
                        ))}
                    </div>

                    {/* 불러오기 버튼 */}
                    <button
                        onClick={handleLoadFolders}
                        className="px-4 py-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Folder className="w-4 h-4" />
                        불러오기
                    </button>
                </div>
            </div>

            {/* 폴더 선택 모달 */}
            {showFolderPicker && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-emerald-400">📁 작업 폴더 선택</h3>
                            <button onClick={() => setShowFolderPicker(false)} className="text-slate-400 hover:text-white transition">✕</button>
                        </div>
                        {isLoadingFolder ? (
                            <div className="py-12 text-center">
                                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-emerald-500" />
                                <p className="text-slate-400">폴더 데이터를 불러오는 중...</p>
                            </div>
                        ) : availableFolders.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                                <p>저장된 작업 폴더가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {availableFolders.map((folder) => (
                                    <button
                                        key={folder.folderName}
                                        onClick={() => handleSelectFolder(folder.folderName)}
                                        className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-emerald-500 transition-all text-left group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">📁</span>
                                                <div>
                                                    <p className="font-semibold text-white group-hover:text-emerald-300 transition">{folder.folderName.replace(/_/g, ' ')}</p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                                        <span>{folder.imageCount} 이미지</span>
                                                        {folder.scriptCount > 0 ? (
                                                            <span className="text-emerald-400">✅ 대본 있음</span>
                                                        ) : (
                                                            <span className="text-amber-400">⚠️ 대본 없음</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-slate-500 group-hover:text-emerald-400 transition">→</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 메인 컨텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* 입력 탭 */}
                {activeTab === 'input' && (
                    <div className="space-y-6">
                        {/* AI 대본 생성 섹션 */}
                        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-700/50 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="w-5 h-5 text-purple-400" />
                                        <h3 className="font-semibold text-purple-300">AI 대본 생성</h3>
                                        <span className="text-xs bg-purple-600/50 text-purple-200 px-2 py-0.5 rounded-full">NEW</span>
                                    </div>

                                    {/* ✅ [REFINED] 헤더 내 한국인 정체성 설정 - 토글 제거, 텍스트 클릭 방식 */}
                                    <div className="flex items-center gap-2 pl-4 border-l border-slate-700/50">
                                        <button
                                            onClick={() => updateSetting('useKoreanIdentity', !settings.useKoreanIdentity)}
                                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200 border ${settings.useKoreanIdentity
                                                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
                                                : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:text-slate-400 hover:border-slate-600'
                                                }`}
                                        >
                                            한국인
                                        </button>

                                        {settings.useKoreanIdentity && (
                                            <div className="flex items-center bg-slate-800/60 rounded-full p-0.5 border border-slate-700/50 ml-1">
                                                <button
                                                    onClick={() => updateSetting('koreanGender', 'female')}
                                                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full transition-all ${settings.koreanGender === 'female'
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-300'
                                                        }`}
                                                >
                                                    여성
                                                </button>
                                                <button
                                                    onClick={() => updateSetting('koreanGender', 'male')}
                                                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full transition-all ${settings.koreanGender === 'male'
                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                        : 'text-slate-500 hover:text-slate-300'
                                                        }`}
                                                >
                                                    남성
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {currentFolderName && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700">
                                        <Folder className="w-3 h-3 text-emerald-500" />
                                        <span className="truncate max-w-[150px]">{currentFolderName}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1.5">주제/키워드</label>
                                    <input
                                        type="text"
                                        value={aiTopic}
                                        onChange={(e) => setAiTopic(e.target.value)}
                                        placeholder="예: 골프장에서 갑자기 눈이 온 상황"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">장르</label>
                                        <select
                                            value={aiGenre}
                                            onChange={(e) => setAiGenre(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm"
                                        >
                                            {GENRE_OPTIONS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">타겟 연령</label>
                                        <select
                                            value={aiTargetAge}
                                            onChange={(e) => setAiTargetAge(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm"
                                        >
                                            {AGE_OPTIONS.map(age => <option key={age.value} value={age.value}>{age.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={handleAiGenerate}
                                    disabled={isGenerating || !aiTopic.trim()}
                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                >
                                    {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> AI가 대본을 작성 중...</> : <><Wand2 className="w-5 h-5" /> AI 대본 생성</>}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-slate-700" />
                            <span className="text-xs text-slate-500">또는 직접 입력</span>
                            <div className="flex-1 h-px bg-slate-700" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">대본 입력</label>
                            <textarea
                                value={scriptInput}
                                onChange={(e) => setScriptInput(e.target.value)}
                                placeholder={`씬별로 대본을 입력하세요.\n\n예시:\n[씬 1] 여자가 카페에서 커피를 마시고 있다.\n[씬 2] 남자가 들어와 여자를 본다.`}
                                className="w-full h-64 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                            />
                        </div>

                        <button
                            onClick={handleParseScenes}
                            disabled={!scriptInput.trim()}
                            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                        >
                            <Scissors className="w-5 h-5" />
                            씬 분해 & 프롬프트 생성
                        </button>
                    </div>
                )}

                {/* 설정 탭 */}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        <SettingSection title="퀄리티 태그">
                            <ToggleItem checked={settings.useQualityTags} onChange={(v) => updateSetting('useQualityTags', v)} label="8K, 시네마틱 라이팅, 마스터피스" description={QUALITY_TAGS} />
                            <ToggleItem checked={settings.useAspectRatio} onChange={(v) => updateSetting('useAspectRatio', v)} label="세로 화면비 (9:16)" description={ASPECT_RATIO} />
                        </SettingSection>

                        <SettingSection title="한국인 정체성">
                            <ToggleItem checked={settings.useKoreanIdentity} onChange={(v) => updateSetting('useKoreanIdentity', v)} label="한국인 강제" description="A stunning Korean woman/man" />
                            {settings.useKoreanIdentity && (
                                <div className="ml-6 mt-2 space-y-2">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={settings.koreanGender === 'female'} onChange={() => updateSetting('koreanGender', 'female')} className="accent-emerald-500" /> 여성</label>
                                        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={settings.koreanGender === 'male'} onChange={() => updateSetting('koreanGender', 'male')} className="accent-emerald-500" /> 남성</label>
                                    </div>
                                </div>
                            )}
                        </SettingSection>

                        <SettingSection title="캐릭터 슬롯">
                            <ToggleItem checked={settings.useSlotSystem} onChange={(v) => updateSetting('useSlotSystem', v)} label="슬롯 시스템 사용" description="미리 정의된 캐릭터 외형 적용" />
                            {settings.useSlotSystem && (
                                <div className="ml-6 mt-2 space-y-2">
                                    {Object.entries(SLOT_PRESETS).map(([key, slot]) => (
                                        <label key={key} className="flex items-start gap-2 text-sm cursor-pointer">
                                            <input type="radio" checked={settings.selectedSlot === key} onChange={() => updateSetting('selectedSlot', key as keyof typeof SLOT_PRESETS)} className="accent-emerald-500 mt-1" />
                                            <div><div className="font-medium">{slot.name}</div><div className="text-xs text-slate-400">{slot.desc}</div></div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </SettingSection>

                        <SettingSection title="체형 키워드">
                            <ToggleItem checked={settings.useBodyKeywords} onChange={(v) => updateSetting('useBodyKeywords', v)} label="체형 설명 추가" />
                            {settings.useBodyKeywords && (
                                <select value={settings.selectedBody} onChange={(e) => updateSetting('selectedBody', e.target.value)} className="ml-6 mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm w-full max-w-md">
                                    {BODY_KEYWORDS.map(body => <option key={body} value={body}>{body}</option>)}
                                </select>
                            )}
                        </SettingSection>

                        <SettingSection title="의상 키워드">
                            <ToggleItem checked={settings.useOutfitKeywords} onChange={(v) => updateSetting('useOutfitKeywords', v)} label="의상 스타일 추가" />
                            {settings.useOutfitKeywords && (
                                <select value={settings.selectedOutfit} onChange={(e) => updateSetting('selectedOutfit', e.target.value)} className="ml-6 mt-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm w-full max-w-md">
                                    {OUTFIT_KEYWORDS.map(outfit => <option key={outfit} value={outfit}>{outfit}</option>)}
                                </select>
                            )}
                        </SettingSection>

                        <SettingSection title="스타일 프리셋">
                            <ToggleItem checked={settings.useStylePreset} onChange={(v) => updateSetting('useStylePreset', v)} label="스타일 프리셋 적용" />
                            {settings.useStylePreset && (
                                <div className="ml-6 mt-2 grid grid-cols-2 gap-2">
                                    {STYLE_PRESETS.map(style => (
                                        <button key={style.id} onClick={() => updateSetting('selectedStyle', style.id)} className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${settings.selectedStyle === style.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{style.name}</button>
                                    ))}
                                </div>
                            )}
                        </SettingSection>

                        {scenes.length > 0 && (
                            <button onClick={handleRegeneratePrompts} className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                                <RefreshCw className="w-5 h-5" /> 설정 적용 (프롬프트 재생성)
                            </button>
                        )}
                    </div>
                )}

                {/* 미리보기 탭 */}
                {activeTab === 'preview' && (
                    <div className="space-y-4">
                        {scenes.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>아직 생성된 프롬프트가 없습니다.</p>
                                <p className="text-sm mt-2">입력 탭에서 대본을 입력하고 씬을 분해하세요.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {scenes.map((scene) => (
                                    <div key={scene.number} className={`relative bg-slate-900 border rounded-xl overflow-hidden transition-all group ${scene.isSelected ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-800 hover:border-slate-700'}`}>
                                        {/* 카드 헤더: 씬 번호 & 샷 타입 */}
                                        <div className="absolute top-0 left-0 right-0 z-10 p-2 flex justify-between items-start pointer-events-none">
                                            <div className="flex gap-1.5 pointer-events-auto">
                                                <span className="bg-black/70 backdrop-blur-md text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">SCENE {scene.number}</span>
                                                {scene.shotType && <span className="bg-black/70 backdrop-blur-md text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-700/50 uppercase">{scene.shotType}</span>}
                                                <span className={`bg-black/70 backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded-md border ${getVoiceBadge(scene).tone}`}>{getVoiceBadge(scene).label}</span>
                                            </div>
                                            <input type="checkbox" checked={scene.isSelected || false} onChange={() => handleToggleSceneSelection(scene.number)} className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500 pointer-events-auto cursor-pointer" />
                                        </div>

                                        {/* 이미지 영역 */}
                                        <div className="aspect-[9/16] bg-slate-950 relative group/img overflow-hidden">
                                            {scene.imageUrl ? (
                                                <>
                                                    {/* ✅ [FIX] 이미지 클릭시 라이트박스 열기 */}
                                                    <img
                                                        src={scene.imageUrl}
                                                        alt={`Scene ${scene.number}`}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105 cursor-pointer"
                                                        onClick={() => setSelectedImageForView(scene.imageUrl || null)}
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                                                        <div className="p-2 bg-white/10 backdrop-blur-md rounded-full text-white transition-all transform translate-y-2 group-hover/img:translate-y-0"><Maximize2 className="w-5 h-5" /></div>
                                                        <button onClick={() => handleDownloadSceneImage(scene)} className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform translate-y-2 group-hover/img:translate-y-0 delay-75 pointer-events-auto"><Download className="w-5 h-5" /></button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                                                    <ImageIcon className="w-10 h-10 opacity-20" />
                                                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-40">No Image</span>
                                                </div>
                                            )}

                                            {/* 액션 버튼 오버레이 */}
                                            <div className="absolute bottom-2 left-2 right-2 flex gap-1">
                                                <button onClick={() => handleGenerateImage(scene.prompt, `scene-${scene.number}`, scene.number)} disabled={generatingId === `scene-${scene.number}`} className="flex-1 py-2 bg-emerald-600/90 hover:bg-emerald-500 backdrop-blur-md text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                                                    {generatingId === `scene-${scene.number}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} 이미지 생성
                                                </button>
                                                <button onClick={() => handleForwardPromptToImageAI(scene.prompt, `scene-${scene.number}`, scene.number)} disabled={aiForwardingId === `scene-${scene.number}`} className="p-2 bg-purple-600/90 hover:bg-purple-500 backdrop-blur-md text-white rounded-lg transition-all disabled:opacity-50" title="AI 생성">
                                                    {aiForwardingId === `scene-${scene.number}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSceneTabs(prev => ({ ...prev, [scene.number]: 'VIDEO' }));
                                                        if (!scene.videoPrompt) {
                                                            handleRefineVideoPrompt(scene.number);
                                                        }
                                                    }}
                                                    disabled={scene.isVideoPromptGenerating}
                                                    className="p-2 bg-amber-600/90 hover:bg-amber-500 backdrop-blur-md text-white rounded-lg transition-all disabled:opacity-50"
                                                    title="스마트 비디오 프롬프트 생성"
                                                >
                                                    {scene.isVideoPromptGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* 카드 정보 영역 */}
                                        <div className="p-3 space-y-3">
                                            {/* 씬 탭 (IMG, VIDEO, JSON) */}
                                            <div className="flex border-b border-slate-800">
                                                {(['IMG', 'VIDEO', 'VOICE', 'JSON'] as const).map((tab) => (
                                                    <button key={tab} onClick={() => setSceneTabs(prev => ({ ...prev, [scene.number]: tab }))} className={`px-3 py-1.5 text-[10px] font-bold transition-all border-b-2 ${(sceneTabs[scene.number] || 'IMG') === tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{tab}</button>
                                                ))}
                                            </div>

                                            {/* 탭 컨텐츠 */}
                                            <div className="min-h-[120px]">
                                                {(sceneTabs[scene.number] || 'IMG') === 'IMG' && (
                                                    <div className="space-y-2.5">
                                                        {/* 한국어 프롬프트 */}
                                                        <div className="group/edit relative">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Korean Prompt</span>
                                                                <button onClick={() => handleStartEdit(scene.number, 'ko', scene.longPromptKo || '')} className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-slate-800 rounded transition-all"><Edit3 className="w-3 h-3 text-slate-400" /></button>
                                                            </div>
                                                            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{scene.longPromptKo || scene.text}</p>
                                                        </div>

                                                        {/* 영어 프롬프트 */}
                                                        <div className="group/edit relative">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-tight">English Prompt</span>
                                                                <button onClick={() => handleStartEdit(scene.number, 'en', scene.prompt)} className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-slate-800 rounded transition-all"><Edit3 className="w-3 h-3 text-slate-400" /></button>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 font-mono leading-relaxed line-clamp-2 italic">{scene.prompt}</p>
                                                        </div>

                                                        {/* 설정 선택기 */}
                                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                                            <select value={scene.age || ''} onChange={(e) => handleUpdateSceneSettings(scene.number, 'age', e.target.value)} className="bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-emerald-500/50">
                                                                <option value="">Age: Default</option>
                                                                {AGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                            </select>
                                                            <select value={scene.outfit || ''} onChange={(e) => handleUpdateSceneSettings(scene.number, 'outfit', e.target.value)} className="bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-emerald-500/50">
                                                                <option value="">Outfit: Default</option>
                                                                {OUTFIT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}
                                                {(sceneTabs[scene.number] || 'IMG') === 'VIDEO' && (
                                                    <div className="flex flex-col gap-3 py-4">
                                                        {scene.videoPrompt ? (
                                                            <div className="space-y-2">
                                                                <span className="text-[10px] font-bold text-purple-500/70 uppercase tracking-tight">Video Prompt</span>
                                                                <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-800/50 p-3 rounded-lg border border-purple-500/30">{scene.videoPrompt}</p>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-tight">비디오 프롬프트 미리보기</span>
                                                                <div className="text-[10px] text-slate-400 leading-relaxed space-y-1">
                                                                    <div><span className="text-purple-400">정체성:</span> A stunning Korean woman/man in her/his {aiTargetAge}</div>
                                                                    <div><span className="text-purple-400">말(대사):</span> {scene.dialogue || scene.text}</div>
                                                                    <div><span className="text-purple-400">동작/감정:</span> {scene.summary || scene.text.split('.')[0]}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Dialogue</span>
                                                            <textarea
                                                                value={scene.dialogue ?? scene.text}
                                                                onChange={(e) => handleUpdateSceneSettings(scene.number, 'dialogue', e.target.value)}
                                                                rows={3}
                                                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/50"
                                                                placeholder="대사를 입력하세요"
                                                            />
                                                        </div>
                                                        {scene.videoUrl && (
                                                            <div className="space-y-2">
                                                                <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-tight">Video Preview</span>
                                                                <video
                                                                    src={scene.videoUrl}
                                                                    controls
                                                                    className="w-full rounded-lg border border-emerald-500/30 bg-black"
                                                                />
                                                            </div>
                                                        )}
                                                        {scene.videoError && (
                                                            <div className="text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded-lg px-3 py-2">
                                                                {scene.videoError}
                                                            </div>
                                                        )}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleRefineVideoPrompt(scene.number)}
                                                                disabled={scene.isVideoPromptGenerating}
                                                                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-white text-[10px] font-bold rounded-lg border border-purple-500/50 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                {scene.isVideoPromptGenerating ? (
                                                                    <><Loader2 className="w-3 h-3 animate-spin" /> 생성 중...</>
                                                                ) : (
                                                                    <><Video className="w-3 h-3" /> {scene.videoPrompt ? '재생성' : '스마트 비디오 프롬프트 생성'}</>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleGenerateSceneVideo(scene.number)}
                                                                disabled={scene.isVideoGenerating || !scene.videoPrompt}
                                                                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-[10px] font-bold rounded-lg border border-emerald-500/50 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                {scene.isVideoGenerating ? (
                                                                    <><Loader2 className="w-3 h-3 animate-spin" /> 생성 중...</>
                                                                ) : (
                                                                    <>영상 생성</>
                                                                )}
                                                            </button>
                                                            {scene.isVideoGenerating && (
                                                                <button
                                                                    onClick={() => handleCancelSceneVideo(scene.number)}
                                                                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg border border-slate-500/50 transition-all"
                                                                >
                                                                    취소
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleImportVideoFromDownloads(scene.number)}
                                                                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold rounded-lg border border-blue-500/50 transition-all flex items-center gap-1.5"
                                                                title="다운로드 폴더에서 최근 영상 가져오기 (10분 이내)"
                                                            >
                                                                <Download className="w-3 h-3" />
                                                                가져오기
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                {(sceneTabs[scene.number] || 'IMG') === 'VOICE' && (
                                                    <div className="flex flex-col gap-3 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">Voice Type</span>
                                                            <select
                                                                value={scene.voiceType || 'narration'}
                                                                onChange={(e) => handleUpdateSceneSettings(scene.number, 'voiceType', e.target.value)}
                                                                className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-emerald-500/50"
                                                            >
                                                                <option value="narration">narration</option>
                                                                <option value="lipSync">lipSync</option>
                                                                <option value="both">both</option>
                                                                <option value="none">none</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">Narration</span>
                                                            <textarea
                                                                value={scene.narrationText ?? ''}
                                                                onChange={(e) => handleUpdateSceneSettings(scene.number, 'narrationText', e.target.value)}
                                                                rows={3}
                                                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/50"
                                                                placeholder="나레이션 텍스트"
                                                            />
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <input
                                                                    value={scene.narrationEmotion ?? ''}
                                                                    onChange={(e) => handleUpdateSceneSettings(scene.number, 'narrationEmotion', e.target.value)}
                                                                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200"
                                                                    placeholder="감정 (예: 당황)"
                                                                />
                                                                <select
                                                                    value={scene.narrationSpeed || 'normal'}
                                                                    onChange={(e) => handleUpdateSceneSettings(scene.number, 'narrationSpeed', e.target.value)}
                                                                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200"
                                                                >
                                                                    <option value="slow">slow</option>
                                                                    <option value="normal">normal</option>
                                                                    <option value="slightly-fast">slightly-fast</option>
                                                                    <option value="fast">fast</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-tight">Lip Sync</span>
                                                            <input
                                                                value={scene.lipSyncSpeakerName ?? ''}
                                                                onChange={(e) => handleUpdateSceneSettings(scene.number, 'lipSyncSpeakerName', e.target.value)}
                                                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/50"
                                                                placeholder="화자 이름 (예: 지영)"
                                                            />
                                                            <textarea
                                                                value={scene.lipSyncLine ?? ''}
                                                                onChange={(e) => handleUpdateSceneSettings(scene.number, 'lipSyncLine', e.target.value)}
                                                                rows={2}
                                                                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500/50"
                                                                placeholder="립싱크 대사"
                                                            />
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <input
                                                                    value={scene.lipSyncEmotion ?? ''}
                                                                    onChange={(e) => handleUpdateSceneSettings(scene.number, 'lipSyncEmotion', e.target.value)}
                                                                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200"
                                                                    placeholder="emotion (EN)"
                                                                />
                                                                <select
                                                                    value={scene.lipSyncTiming || 'mid'}
                                                                    onChange={(e) => handleUpdateSceneSettings(scene.number, 'lipSyncTiming', e.target.value)}
                                                                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200"
                                                                >
                                                                    <option value="start">start</option>
                                                                    <option value="mid">mid</option>
                                                                    <option value="end">end</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {(sceneTabs[scene.number] || 'IMG') === 'JSON' && (
                                                    <div className="bg-slate-950/50 rounded-lg p-2 font-mono text-[9px] text-slate-500 overflow-hidden">
                                                        <pre className="whitespace-pre-wrap">
                                                            {JSON.stringify({ camera: scene.camera, shotType: scene.shotType, summary: scene.summary }, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 라이트박스 */}
            {selectedImageForView && (
                <Lightbox
                    imageUrl={selectedImageForView}
                    onClose={() => setSelectedImageForView(null)}
                />
            )}

            {/* 편집 모달 */}
            {editingScene && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                            <Edit3 className="w-5 h-5" />
                            {editingScene.field === 'ko' ? '한국어 프롬프트 편집' : '영어 프롬프트 편집'}
                        </h3>
                        <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full h-40 bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-6 font-mono"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setEditingScene(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition-all">취소</button>
                            <button onClick={handleSaveEdit} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold transition-all">저장하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* [NEW] 최근 영상 선택 모달 */}
            {showRecentVideoPicker && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                                <Download className="w-6 h-6" />
                                최근 다운로드 영상 선택
                            </h3>
                            <button
                                onClick={() => setShowRecentVideoPicker(false)}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="text-sm text-slate-400 mb-4 bg-blue-950/30 border border-blue-500/20 rounded-lg px-4 py-3">
                            최근 10분 내에 다운로드된 영상이 없습니다. 아래 목록에서 가져올 영상을 선택해주세요.
                            <br />
                            <span className="text-[11px] text-blue-400/70">* 선택 시 해당 장면({pickingSceneNumber}번)으로 이름이 변경되어 이동됩니다.</span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {recentVideos.length > 0 ? (
                                recentVideos.map((video, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => !isImportingSpecific && handleImportSpecificVideo(video.name)}
                                        className={`group flex items-center justify-between p-4 bg-slate-800/50 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 rounded-xl cursor-pointer transition-all ${isImportingSpecific ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-24 h-14 bg-slate-800 rounded-lg overflow-hidden border border-slate-700/60">
                                                {video.previewUrl ? (
                                                    <video
                                                        src={video.previewUrl}
                                                        muted
                                                        playsInline
                                                        preload="metadata"
                                                        onMouseEnter={(e) => {
                                                            const el = e.currentTarget;
                                                            el.play().catch(() => { });
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            const el = e.currentTarget;
                                                            el.pause();
                                                            el.currentTime = 0;
                                                        }}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                        <Video className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-200 group-hover:text-white truncate max-w-[300px]" title={video.name}>
                                                    {video.name}
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex gap-3 mt-1">
                                                    <span>{new Date(video.mtime).toLocaleString()}</span>
                                                    <span>{video.sizeFormatted}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button className="px-4 py-1.5 bg-slate-700 group-hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg transition-all">
                                            선택하기
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-500">
                                    다운로드 폴더에 mp4 파일이 없습니다.
                                </div>
                            )}
                        </div>

                        {isImportingSpecific && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center rounded-2xl">
                                <div className="bg-slate-800 px-6 py-4 rounded-xl border border-slate-600 shadow-xl flex items-center gap-3">
                                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                    <span className="text-sm font-medium text-white">영상을 가져오는 중...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================
// 보조 컴포넌트
// ============================================

interface SettingSectionProps {
    title: string;
    children: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-emerald-400 mb-3">{title}</h3>
        <div className="space-y-2">
            {children}
        </div>
    </div>
);

interface ToggleItemProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ checked, onChange, label, description }) => (
    <label className="flex items-start gap-3 cursor-pointer group">
        <div className="relative mt-0.5">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-700 rounded-full peer-checked:bg-emerald-600 transition-colors" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
        </div>
        <div className="flex-1">
            <div className="text-sm font-medium text-slate-200 group-hover:text-white">
                {label}
            </div>
            {description && (
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                    {description}
                </div>
            )}
        </div>
    </label>
);

export default ShortsLabPanel;

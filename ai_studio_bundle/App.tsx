
import React, { useState, useCallback, useEffect } from 'react';
import { Prompt, ImageResult, VideoResult } from './types';
import { generateImageFromImagesAndText, generateImageFromText, editImage, base64ToFile, generatePromptFromImage, generateVideo, generatePersonDetailsFromImage, revisePromptsForPolicy } from './services/geminiService';
import ImageDropzone from './components/ImageDropzone';
import Spinner from './components/Spinner';
import Lightbox from './components/Lightbox';
import GifCreator from './components/GifCreator';
import ImageEditorControls from './components/ImageEditorControls';
import ToastContainer, { ToastMessage } from './components/Toast';
import CameraControls, { CameraSettings } from './components/CameraControls';
import FrameGenerator, { FrameConfig, SceneFrame } from './components/FrameGenerator';
import SceneCreator, { VideoConfig } from './components/SceneCreator';
import ImageAnalyzer from './components/ImageAnalyzer';
import VoiceStudio from './components/VoiceStudio';
import StyleTransfer from './components/StyleTransfer';
import ColorChanger from './components/ColorChanger';
import PoseTransfer from './components/PoseTransfer';
import FaceCorrection from './components/FaceCorrection';
import SkinToneAdjuster from './components/SkinToneAdjuster';
import HairMakeup from './components/HairMakeup';
import ObjectRemover from './components/ObjectRemover';
import AspectRatioConverter from './components/AspectRatioConverter';
import ImageCleaner from './components/ImageCleaner';
import { setBlob } from '../components/master-studio/services/dbService';
import { getAppStorageValue, setAppStorageValue } from '../services/appStorageService';
import type { CharacterCollection } from '../types';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const MAX_PROMPTS = 4;
type Mode = 'fusion' | 'text' | 'video' | 'camera-control' | 'frame-generator' | 'scene-creator' | 'image-analyzer' | 'voice-studio' | 'style-transfer' | 'color-changer' | 'pose-transfer' | 'face-correction' | 'skin-tone' | 'hair-makeup' | 'object-remover' | 'aspect-ratio' | 'image-cleaner';
type EditingState = 'idle' | 'prompt' | 'text' | 'background' | 'generating-prompt' | 'restoration' | 'age-20' | 'age-30' | 'age-40' | 'age-50' | 'age-multi' | 'upscale-2x' | 'upscale-4x' | 'painting' | 'generating-details' | 'object-remove' | 'aspect' | 'image-clean' | 'chest-cover';

type ModeGroupKey = 'creations' | 'scene-builder' | 'enhance' | 'polish' | 'audio-tools' | 'utility';

interface ModeGroup {
  key: ModeGroupKey;
  label: string;
  step: string;
  description: string;
  accentClass?: string;
  modes: Array<{
    mode: Mode;
    label: string;
    icon: string;
    summary: string;
  }>;
}

const MODE_GROUPS: ModeGroup[] = [
  {
    key: 'creations',
    label: '제작 준비',
    step: '1',
    description: '대본과 레퍼런스를 토대로 기본 이미지를 만드는 단계입니다.',
    accentClass: 'from-purple-500/40 to-indigo-500/30',
    modes: [
      { mode: 'fusion', label: '이미지 퓨전 & 수정', icon: '🧬', summary: '여러 레퍼런스를 섞어 스타일/구성을 조합합니다.' },
      { mode: 'text', label: '텍스트로 이미지 생성', icon: '📝', summary: '프롬프트만으로 고해상도 이미지를 생성합니다.' },
      { mode: 'video', label: '동영상 생성', icon: '🎞️', summary: '아이디어를 짧은 영상 클립으로 바로 확인합니다.' },
    ],
  },
  {
    key: 'scene-builder',
    label: '장면 제작',
    step: '2',
    description: '카메라 설정→프레임→신 만들기까지 쇼츠 씬 구성 단계입니다.',
    accentClass: 'from-blue-500/40 to-cyan-500/30',
    modes: [
      { mode: 'camera-control', label: '카메라 컨트롤', icon: '📷', summary: '샷 크기·앵글·조명 프리셋으로 전문적인 룩을 설정.' },
      { mode: 'frame-generator', label: '프레임 만들기', icon: '🎬', summary: '캐릭터 일관성을 유지하며 6~12컷을 생성.' },
      { mode: 'scene-creator', label: '신 만들기', icon: '🎥', summary: '프레임에 트랜지션/음악을 더해 영상으로 합성.' },
    ],
  },
  {
    key: 'enhance',
    label: '스타일 & 색감',
    step: '3',
    description: '스타일·색감·포즈를 보정해 전체 톤을 통일합니다.',
    accentClass: 'from-emerald-500/40 to-teal-500/30',
    modes: [
      { mode: 'style-transfer', label: '스타일 따라하기', icon: '🎨', summary: '참조 이미지를 분석해 동일한 스타일을 적용.' },
      { mode: 'color-changer', label: '색상 바꾸기', icon: '🪄', summary: '의상/배경 색을 질감 유지 상태로 변경.' },
      { mode: 'pose-transfer', label: '포즈 따라하기', icon: '🤸', summary: '참조 포즈를 원하는 인물에게 정확히 반영.' },
    ],
  },
  {
    key: 'polish',
    label: '디테일 보정',
    step: '4',
    description: '디테일 보정·분석 단계로 완성도를 높입니다.',
    accentClass: 'from-amber-500/40 to-rose-500/30',
    modes: [
      { mode: 'face-correction', label: '얼굴 보정', icon: '✨', summary: '얼굴·헤어·바디 영역을 자연스럽게 보정.' },
      { mode: 'skin-tone', label: '피부톤 튜닝', icon: '🌟', summary: '피부톤을 균일하게 정리하고 자연스러운 톤으로 조절.' },
      { mode: 'hair-makeup', label: '헤어 & 메이크업', icon: '💄', summary: '헤어스타일/컬러/메이크업을 시뮬레이션.' },
      { mode: 'image-analyzer', label: '이미지 분석기', icon: '🔍', summary: '참조 이미지에서 스타일·색감·조명을 추출.' },
    ],
  },
  {
    key: 'audio-tools',
    label: '오디오 & 도구',
    step: '5',
    description: '음성·보조 기능으로 최종 결과물을 마무리합니다.',
    accentClass: 'from-pink-500/40 to-purple-500/30',
    modes: [
      { mode: 'voice-studio', label: '보이스 스튜디오', icon: '🎤', summary: '대본을 감정이 담긴 음성으로 변환.' },
    ],
  },
  {
    key: 'utility',
    label: '편의 기능',
    step: '6',
    description: '불필요한 요소 제거, 비율 변환, 노이즈 정리 등 마무리 작업을 제공합니다.',
    accentClass: 'from-slate-500/40 to-gray-500/30',
    modes: [
      { mode: 'object-remover', label: '피사체 지우기', icon: '🧼', summary: '필요없는 사람/로고를 제거하고 배경을 복원.' },
      { mode: 'aspect-ratio', label: '화면 비율 변환기', icon: '🖼️', summary: '쇼츠/릴스용 세로 등 원하는 비율로 재구성.' },
      { mode: 'image-cleaner', label: '이미지 클리너', icon: '🧽', summary: '노이즈 제거, 색상 복원 등 후처리.' },
    ],
  },
];

const MODE_TO_GROUP = MODE_GROUPS.reduce<Record<Mode, ModeGroupKey>>((map, group) => {
  group.modes.forEach(item => {
    map[item.mode] = group.key;
  });
  return map;
}, {} as Record<Mode, ModeGroupKey>);

const MODE_LABEL_MAP = MODE_GROUPS.reduce<Record<Mode, { label: string; icon: string }>>((map, group) => {
  group.modes.forEach(item => {
    map[item.mode] = { label: item.label, icon: item.icon };
  });
  return map;
}, {} as Record<Mode, { label: string; icon: string }>);

interface SourceImage {
  id: string;
  file: File | null;
  url: string | null;
  name: string;
}

type TurnaroundViewKey = 'front' | 'angle45' | 'back';

interface PendingTurnaroundSet {
  previews: Array<{ key: TurnaroundViewKey; label: string; imageUrl: string }>;
  approved: boolean;
  sourceImageId: string;
  sourcePrompt: string;
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('blob data url 변환 실패'));
    };
    reader.onerror = () => reject(reader.error || new Error('blob 읽기 실패'));
    reader.readAsDataURL(blob);
  });

interface AppProps {
  onAddHistory?: (dataUrl: string, prompt: string) => void;
}

const App: React.FC<AppProps> = ({ onAddHistory }) => {
  const [mode, setMode] = useState<Mode>('fusion');
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([{ id: `source-${Date.now()}`, file: null, url: null, name: '' }]);
  const [activeEditingImageId, setActiveEditingImageId] = useState<string | null>(sourceImages[0]?.id || null);

  const [editPrompt, setEditPrompt] = useState('');
  const [editingState, setEditingState] = useState<EditingState>('idle');
  const [prompts, setPrompts] = useState<Prompt[]>([{ id: `prompt-${Date.now()}`, value: '' }]);
  const [videoPrompt, setVideoPrompt] = useState('');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [videoResult, setVideoResult] = useState<VideoResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevisingPrompts, setIsRevisingPrompts] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isGifCreatorOpen, setIsGifCreatorOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [cameraSettings, setCameraSettings] = useState<CameraSettings | null>(null);
  const [activeGroupKey, setActiveGroupKey] = useState<ModeGroupKey>(MODE_TO_GROUP['fusion']);
  const [recentModes, setRecentModes] = useState<Mode[]>([]);
  const [openGroupKey, setOpenGroupKey] = useState<ModeGroupKey | null>(MODE_TO_GROUP['fusion']);
  const groupNavRef = React.useRef<HTMLDivElement | null>(null);
  const [pendingTurnaroundSet, setPendingTurnaroundSet] = useState<PendingTurnaroundSet | null>(null);
  const [turnaroundName, setTurnaroundName] = useState('');
  const [turnaroundOutfitMode, setTurnaroundOutfitMode] = useState<'preserve' | 'neutral'>('preserve');
  const [savedCharacterCount, setSavedCharacterCount] = useState(0);
  const [bodyEnhanceLevel, setBodyEnhanceLevel] = useState(5); // 신체 볼륨 강조 기본값 5 (1~10)

  // 신체 강조 레벨에 따른 가중치 태그 생성 함수
  const getBodyEnhancePrompt = useCallback(() => {
    if (bodyEnhanceLevel <= 2) return ''; // 낮은 단계는 자연스럽게
    const weight = (1.0 + (bodyEnhanceLevel * 0.05)).toFixed(2); // 최대 1.5 가중치
    const tags = [
      `(extremely large breasts:${weight})`,
      `(curvy hourglass figure:${weight})`,
      `(thick thighs:${weight})`,
      `(shapely emphasized hips:${weight})`,
      `(narrow waist:1.2)`
    ];
    return tags.join(', ');
  }, [bodyEnhanceLevel]);
  const [isGeneratingTurnaround, setIsGeneratingTurnaround] = useState(false);

  const aspectRatios = [
    { label: '정사각형', value: '1:1' as const },
    { label: '세로', value: '9:16' as const },
    { label: '가로', value: '16:9' as const },
  ];

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToasts(prev => [...prev, { id: Date.now().toString(), type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const pushResultToGallery = useCallback((label: string, imageUrl: string) => {
    setResults(prev => [
      {
        id: `edit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt: label,
        imageUrl,
        isLoading: false,
        error: null,
      },
      ...prev,
    ]);
    if (onAddHistory) {
      onAddHistory(imageUrl, label);
    }
  }, [onAddHistory]);

  useEffect(() => {
    const loadCharacterCount = async () => {
      const saved = await getAppStorageValue<CharacterCollection[] | null>('characterCollection', null);
      if (Array.isArray(saved)) {
        setSavedCharacterCount(saved.length);
      }
    };
    loadCharacterCount();
  }, []);

  useEffect(() => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    if (!activeImage || !activeImage.file) {
      const nextActiveImage = sourceImages.find(img => img.file);
      if (nextActiveImage) {
        setActiveEditingImageId(nextActiveImage.id);
      } else if (sourceImages.length > 0) {
        setActiveEditingImageId(sourceImages[0].id);
      } else {
        setActiveEditingImageId(null);
      }
    }
  }, [sourceImages, activeEditingImageId]);

  useEffect(() => {
    return () => {
      sourceImages.forEach(image => {
        if (image.url) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, [sourceImages]);

  useEffect(() => {
    if (!openGroupKey) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!groupNavRef.current) return;
      if (event.target instanceof Node && !groupNavRef.current.contains(event.target)) {
        setOpenGroupKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openGroupKey]);

  // [FIX] Ctrl+C 종료 버그 방지 - 복사 단축키가 터미널로 유출되는 것을 차단
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C 또는 Meta+C (Mac) 감지
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) {
          e.stopPropagation();
          console.log('[Fix] Ctrl+C detected with selection in AI Studio, stopping propagation.');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const handleModeChange = (newMode: Mode, keepGroupOpen = false) => {
    setMode(newMode);
    const groupKey = MODE_TO_GROUP[newMode];
    if (groupKey) {
      setActiveGroupKey(groupKey);
    }
    if (!keepGroupOpen) {
      setOpenGroupKey(null);
    }
    setRecentModes(prev => {
      const filtered = prev.filter(modeName => modeName !== newMode);
      return [newMode, ...filtered].slice(0, 3);
    });
    setResults([]);
    setVideoResult(null);
    const newSourceImage = { id: `source-${Date.now()}`, file: null, url: null, name: '' };
    setSourceImages([newSourceImage]);
    setActiveEditingImageId(newSourceImage.id);
  }

  const handleImageDrop = useCallback((id: string, file: File) => {
    setSourceImages(prev => {
      const newImages = [...prev];
      const index = newImages.findIndex(img => img.id === id);
      if (index !== -1) {
        if (newImages[index].url) {
          URL.revokeObjectURL(newImages[index].url!);
        }
        const objectUrl = URL.createObjectURL(file);
        newImages[index] = { ...newImages[index], file, url: objectUrl };
      }
      return newImages;
    });
  }, []);

  const handleImageNameChange = (id: string, name: string) => {
    setSourceImages(prev => prev.map(img => img.id === id ? { ...img, name } : img));
  };

  const handleGroupToggle = (groupKey: ModeGroupKey) => {
    setActiveGroupKey(groupKey);
    setOpenGroupKey(prev => prev === groupKey ? null : groupKey);
  };

  const handleClearImage = (id: string) => {
    setSourceImages(prev => {
      const targetImage = prev.find(img => img.id === id);
      if (targetImage?.url) {
        URL.revokeObjectURL(targetImage.url);
      }

      if (prev.length > 1) {
        return prev.filter(img => img.id !== id);
      } else {
        const newSourceImage = { ...prev[0], file: null, url: null, name: '' };
        setActiveEditingImageId(newSourceImage.id);
        return [newSourceImage];
      }
    });
  };

  const addSourceImage = () => {
    setSourceImages(prev => [...prev, { id: `source-${Date.now()}`, file: null, url: null, name: '' }]);
  };

  const handleError = (error: unknown) => {
    const errorMessage = (error as Error).message || "알 수 없는 오류가 발생했습니다.";
    addToast('error', errorMessage);
  };

  const updateSourceImage = async (imageUrl: string, originalFileName: string, imageId: string, addToHistoryPrompt?: string) => {
    const mimeType = imageUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';
    const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
    const newFileName = `edited_${baseName}.${extension}`;

    const editedImageFile = await base64ToFile(imageUrl, newFileName);

    setSourceImages(prev => {
      return prev.map(img => {
        if (img.id === imageId) {
          if (img.url) {
            URL.revokeObjectURL(img.url);
          }
          return { ...img, file: editedImageFile, url: URL.createObjectURL(editedImageFile) };
        }
        return img;
      });
    });
    if (onAddHistory) {
      onAddHistory(imageUrl, addToHistoryPrompt || '');
    }
    addToast('success', '이미지가 성공적으로 수정되었습니다.');
  }

  const handleEditImage = async (mask?: { data: string; mimeType: string }) => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;

    if (!currentFile || !editPrompt.trim()) {
      addToast('info', '이미지와 수정 프롬프트를 모두 입력해주세요.');
      return;
    }
    setEditingState('prompt');
    try {
      // 사용자 입력 프롬프트는 그대로 사용 (사용자가 영어를 입력할 수도 있으므로)
      const prompt = mask
        ? `Only paint inside the masked area. Do not change anything else. Prompt: "${editPrompt.trim()}"`
        : editPrompt.trim();
      const editedImageUrl = await editImage(currentFile, prompt, mask);
      await updateSourceImage(editedImageUrl, currentFile.name, activeEditingImageId!, editPrompt.trim());
      setEditPrompt('');
    } catch (error) {
      console.error("이미지 수정 실패:", error);
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleSpecialEdit = async (action: 'text' | 'background' | 'restoration' | 'painting' | 'chest-cover') => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;

    if (!currentFile) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }
    setEditingState(action);

    // 모델 성능 향상을 위해 편집 프롬프트를 영어로 최적화
    const prompts = {
      text: "Remove all text from this image. Fill the space naturally to match the surrounding background.",
      background: "Remove the background from this image. Leave only the main subject on a transparent background.",
      restoration: "Upscale and improve the quality of this image. Fix blurriness and artifacts while maintaining original details.",
      'painting': "Convert this image into a high-quality realistic oil painting with visible brush strokes.",
      'chest-cover': "Add a high-neck sweater covering the chest. Keep face, hair, and background unchanged."
    };

    try {
      const editedImageUrl = await editImage(currentFile, prompts[action]);
      await updateSourceImage(editedImageUrl, currentFile.name, activeEditingImageId!, prompts[action]);
    } catch (error) {
      const actionText = {
        text: '텍스트 제거',
        background: '배경 제거',
        restoration: '사진 복원',
        'painting': '그림 변환',
        'chest-cover': '가슴골 제거'
      }[action];
      console.error(`이미지 ${actionText} 실패:`, error);
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleUpscale = async (scale: 2 | 4) => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;
    if (!currentFile) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    const editingAction = `upscale-${scale}x` as EditingState;
    setEditingState(editingAction);

    // 영어 프롬프트 사용
    const prompt = `Upscale this image by ${scale}x. Increase resolution and sharpness significantly while preserving all original details and identity.`;

    try {
      const editedImageUrl = await editImage(currentFile, prompt);
      await updateSourceImage(editedImageUrl, currentFile.name, activeEditingImageId!, `Upscale ${scale}x`);
    } catch (error) {
      console.error(`이미지 ${scale}x 업스케일 실패:`, error);
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleAgeChange = async (age: 20 | 30 | 40 | 50 | 60) => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;
    if (!currentFile) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    const editingAction = `age-${age}` as EditingState;
    setEditingState(editingAction);

    // 영어 프롬프트 사용
    const prompt = `Modify this person's face to look approximately ${age} years old. Add realistic aging features like skin texture and wrinkles appropriate for this age. Keep hairstyle, clothes, and background exactly the same.`;

    try {
      const editedImageUrl = await editImage(currentFile, prompt);
      await updateSourceImage(editedImageUrl, currentFile.name, activeEditingImageId!, `Age ${age}`);
    } catch (error) {
      console.error(`이미지 나이 변환 실패:`, error);
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleMultiAgeGeneration = async () => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;
    if (!currentFile) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    setEditingState('age-multi');

    const targetAges = [20, 30, 40, 50];
    const initialResults: ImageResult[] = targetAges.map(age => ({
      id: `age-${age}-${Date.now()}`,
      prompt: `${age}대로 나이 변환`,
      imageUrl: null,
      isLoading: true,
      error: null,
    }));

    setResults(initialResults);

    try {
      const generationPromises = initialResults.map(result => {
        const age = parseInt(result.prompt.substring(0, 2), 10);
        // 영어 프롬프트 사용
        const apiPrompt = `Modify this person's face to look approximately ${age} years old. Add realistic aging features appropriate for this age. Keep hairstyle, clothes, and background exactly the same.`;

        return editImage(currentFile, apiPrompt)
          .then(imageUrl => ({ id: result.id, status: 'fulfilled' as const, value: imageUrl }))
          .catch(error => ({ id: result.id, status: 'rejected' as const, reason: (error as Error).message }));
      });

      const outcomes = await Promise.all(generationPromises);

      const finalResults = initialResults.map(initialResult => {
        const outcome = outcomes.find(o => o.id === initialResult.id);
        if (outcome) {
          if (outcome.status === 'fulfilled') {
            if (onAddHistory) onAddHistory(outcome.value, initialResult.prompt);
            return { ...initialResult, imageUrl: outcome.value, isLoading: false };
          } else {
            return { ...initialResult, error: outcome.reason || "알 수 없는 오류가 발생했습니다.", isLoading: false };
          }
        }
        return { ...initialResult, isLoading: false, error: '결과를 처리하는 중 오류가 발생했습니다.' };
      });

      setResults(finalResults);
      addToast('success', '다중 연령 이미지가 생성되었습니다.');
    } catch (error) {
      console.error("다중 연령 생성 실패:", error);
      handleError(error);
      setResults([]);
    } finally {
      setEditingState('idle');
    }
  };

  const handleGeneratePrompt = async () => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;
    if (!currentFile) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }
    setEditingState('generating-prompt');
    try {
      const newPromptText = await generatePromptFromImage(currentFile);

      setPrompts(prevPrompts => {
        const firstEmptyIndex = prevPrompts.findIndex(p => p.value.trim() === '');
        if (firstEmptyIndex !== -1) {
          const updatedPrompts = [...prevPrompts];
          updatedPrompts[firstEmptyIndex] = { ...updatedPrompts[firstEmptyIndex], value: newPromptText };
          return updatedPrompts;
        } else if (prevPrompts.length < MAX_PROMPTS) {
          return [...prevPrompts, { id: `prompt-${Date.now()}`, value: newPromptText }];
        } else {
          const updatedPrompts = [...prevPrompts];
          updatedPrompts[0] = { ...updatedPrompts[0], value: newPromptText };
          return updatedPrompts;
        }
      });
      addToast('success', '이미지에서 프롬프트가 생성되었습니다.');

    } catch (error) {
      console.error("프롬프트 생성 실패:", error);
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleAnalyzeImage = async (file: File): Promise<string> => {
    setEditingState('generating-prompt');
    try {
      const promptText = await generatePromptFromImage(file);
      addToast('success', '이미지 분석이 완료되었습니다.');
      return promptText;
    } catch (error) {
      console.error("이미지 분석 실패:", error);
      addToast('error', '이미지 분석에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleGeneratePersonDetails = async () => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;
    if (!currentFile) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }
    setEditingState('generating-details');
    try {
      const newPromptText = await generatePersonDetailsFromImage(currentFile);

      setPrompts(prevPrompts => {
        const firstEmptyIndex = prevPrompts.findIndex(p => p.value.trim() === '');
        if (firstEmptyIndex !== -1) {
          const updatedPrompts = [...prevPrompts];
          updatedPrompts[firstEmptyIndex] = { ...updatedPrompts[firstEmptyIndex], value: newPromptText };
          return updatedPrompts;
        } else if (prevPrompts.length < MAX_PROMPTS) {
          return [...prevPrompts, { id: `prompt-${Date.now()}`, value: newPromptText }];
        } else {
          const updatedPrompts = [...prevPrompts];
          updatedPrompts[0] = { ...updatedPrompts[0], value: newPromptText };
          return updatedPrompts;
        }
      });
      addToast('success', '인물 디테일이 성공적으로 추출되었습니다.');

    } catch (error) {
      console.error("인물 디테일 생성 실패:", error);
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleGenerateTurnaround = async () => {
    const activeImage = sourceImages.find(img => img.id === activeEditingImageId);
    const currentFile = activeImage?.file;
    if (!currentFile) {
      addToast('info', '먼저 참조 이미지를 업로드해주세요.');
      return;
    }

    setIsGeneratingTurnaround(true);
    setPendingTurnaroundSet(null);
    setTurnaroundName('');

    const prompts: Array<{ key: TurnaroundViewKey; label: string; instruction: string }> = [
      {
        key: 'front',
        label: '정면',
        instruction: 'Generate a full-body front view turnaround of the exact same person from this reference image.'
      },
      {
        key: 'angle45',
        label: '45도',
        instruction: 'Generate a full-body 45-degree three-quarter turnaround of the exact same person from this reference image.'
      },
      {
        key: 'back',
        label: '뒷모습',
        instruction: 'Generate a full-body back view turnaround of the exact same person from this reference image.'
      }
    ];

    try {
      const previews: Array<{ key: TurnaroundViewKey; label: string; imageUrl: string }> = [];

      for (const item of prompts) {
        const outfitInstruction = turnaroundOutfitMode === 'preserve'
          ? `Preserve the exact original outfit from the reference image.
Keep the same clothing, colors, fabric, silhouette, shoes, and accessories.
Do not redesign, simplify, replace, restyle, or swap the outfit.
Only change the viewpoint to ${item.label}.`
          : `Use a plain studio background and a neutral standing pose.
Show the character alone, full body, in a fitted simple base outfit.
Do not add any props, text, split panels, or extra people.`;

        const prompt = `${item.instruction}

Preserve the exact same face, body shape, proportions, height impression, hairstyle, and identity.
${outfitInstruction}
Use a clean plain background and show the character alone in a full-body standing pose.`;

        const imageUrl = await editImage(currentFile, prompt);
        previews.push({ key: item.key, label: item.label, imageUrl });
      }

      setPendingTurnaroundSet({
        previews,
        approved: false,
        sourceImageId: activeImage!.id,
        sourcePrompt: prompts.map(p => p.instruction).join(' ')
      });
      setResults(previews.map((preview) => ({
        id: `turnaround-${preview.key}-${Date.now()}`,
        prompt: `캐릭터 3면도 - ${preview.label}`,
        imageUrl: preview.imageUrl,
        isLoading: false,
        error: null,
      })));
      addToast('success', '캐릭터 3면도 시안이 생성되었습니다. 확인 후 승인해주세요.');
    } catch (error) {
      console.error('캐릭터 3면도 생성 실패:', error);
      handleError(error);
    } finally {
      setIsGeneratingTurnaround(false);
    }
  };

  const handleApproveTurnaround = () => {
    if (!pendingTurnaroundSet) return;
    setPendingTurnaroundSet({ ...pendingTurnaroundSet, approved: true });
    addToast('success', '3면도 결과를 승인했습니다. 이름을 입력하고 저장해주세요.');
  };

  const handleSaveTurnaround = async () => {
    if (!pendingTurnaroundSet?.approved) {
      addToast('info', '먼저 생성 결과를 승인해주세요.');
      return;
    }
    if (!turnaroundName.trim()) {
      addToast('info', '캐릭터 이름을 입력해주세요.');
      return;
    }

    try {
      const imageIds = {} as Record<TurnaroundViewKey, string>;
      const previewDataUrls = {} as Record<TurnaroundViewKey, string>;
      for (const preview of pendingTurnaroundSet.previews) {
        const response = await fetch(preview.imageUrl);
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        const imageId = crypto.randomUUID();
        await setBlob(imageId, blob);
        imageIds[preview.key] = imageId;
        previewDataUrls[preview.key] = dataUrl;
      }

      const activeImage = sourceImages.find((img) => img.id === pendingTurnaroundSet.sourceImageId);
      const sourceImageData = activeImage?.file ? await blobToDataUrl(activeImage.file) : null;

      const folderResponse = await fetch('http://localhost:3002/api/save-character-turnaround', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterName: turnaroundName.trim(),
          sourceImageData,
          turnaroundImages: previewDataUrls,
          metadata: {
            outfitMode: turnaroundOutfitMode,
            approvedAt: Date.now(),
            sourcePrompt: pendingTurnaroundSet.sourcePrompt,
          }
        })
      });

      const folderPayload = await folderResponse.json().catch(() => null);
      if (!folderResponse.ok || !folderPayload?.success) {
        throw new Error(folderPayload?.error || '캐릭터 폴더 저장 실패');
      }

      const existing = await getAppStorageValue<CharacterCollection[] | null>('characterCollection', null);
      const nextCharacter: CharacterCollection = {
        id: crypto.randomUUID(),
        name: turnaroundName.trim(),
        description: 'AI Studio에서 생성한 캐릭터 3면도 세트',
        generatedImageId: imageIds.front,
        turnaroundImageIds: {
          front: imageIds.front,
          angle45: imageIds.angle45,
          back: imageIds.back
        },
        sourceReferenceImageId: pendingTurnaroundSet.sourceImageId,
        approvedAt: Date.now(),
        savedFolderPath: folderPayload.folderPath,
        savedFolderUrl: folderPayload.folderUrl,
      };

      const next = [nextCharacter, ...(Array.isArray(existing) ? existing : [])];
      await setAppStorageValue('characterCollection', next);
      setSavedCharacterCount(next.length);
      setPendingTurnaroundSet(null);
      setTurnaroundName('');
      addToast('success', `캐릭터 "${nextCharacter.name}" 저장 완료 (${folderPayload.folderPath})`);
    } catch (error) {
      console.error('캐릭터 저장 실패:', error);
      handleError(error);
    }
  };


  const handlePromptChange = (id: string, value: string) => {
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };

  const addPrompt = () => {
    if (prompts.length < MAX_PROMPTS) {
      setPrompts((prev) => [...prev, { id: `prompt-${Date.now()}`, value: '' }]);
    }
  };

  const removePrompt = (id: string) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleGenerateImages = async () => {
    const validPrompts = prompts.filter(p => p.value.trim() !== '');
    if (validPrompts.length === 0) {
      addToast('info', "하나 이상의 프롬프트를 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    setResults(validPrompts.map(p => ({
      id: p.id,
      prompt: p.value,
      imageUrl: null,
      isLoading: true,
      error: null,
    })));

    let generationPromises;

    try {
      // 카메라 설정을 프롬프트에 적용
      const enhancePromptWithCamera = (prompt: string): string => {
        if (cameraSettings && mode === 'camera-control') {
          return `${cameraSettings.shotSize}, ${cameraSettings.angle}, ${cameraSettings.movement}, ${cameraSettings.lighting}, ${prompt}`;
        }
        return prompt;
      };

      if (mode === 'fusion' || mode === 'camera-control') {
        const imageFiles = sourceImages
          .map(img => ({ file: img.file, name: img.name.trim() }))
          .filter((item): item is { file: File, name: string } => item.file !== null);

        if (imageFiles.length === 0) {
          addToast('info', "퓨전 모드에서는 하나 이상의 참조 이미지를 제공해야 합니다.");
          setIsGenerating(false);
          setResults([]);
          return;
        }
        generationPromises = validPrompts.map(prompt => {
          const enhancedPrompt = `${getBodyEnhancePrompt()}, ${enhancePromptWithCamera(prompt.value)}`;
          return generateImageFromImagesAndText(imageFiles, enhancedPrompt)
            .then(imageUrl => ({ id: prompt.id, status: 'fulfilled' as const, value: imageUrl }))
            .catch(error => ({ id: prompt.id, status: 'rejected' as const, reason: (error as Error).message }));
        });
      } else { // text mode
        generationPromises = validPrompts.map(prompt =>
          generateImageFromText(enhancePromptWithCamera(prompt.value), aspectRatio)
            .then(imageUrl => ({ id: prompt.id, status: 'fulfilled' as const, value: imageUrl }))
            .catch(error => ({ id: prompt.id, status: 'rejected' as const, reason: (error as Error).message }))
        );
      }

      const outcomes = await Promise.all(generationPromises);

      setResults(currentResults => {
        return currentResults.map(result => {
          const outcome = outcomes.find(o => o.id === result.id);
          if (!outcome) return result;

          if (outcome.status === 'fulfilled') {
            if (onAddHistory) {
              onAddHistory(outcome.value, result.prompt || '');
            }
            return { ...result, imageUrl: outcome.value, isLoading: false };
          } else {
            return { ...result, error: outcome.reason || "알 수 없는 오류가 발생했습니다.", isLoading: false };
          }
        });
      });
      addToast('success', '이미지 생성이 완료되었습니다.');
    } catch (error) {
      console.error("이미지 생성 실패:", error);
      handleError(error);
      setResults([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      addToast('info', "동영상 생성을 위한 프롬프트를 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    const initialResult: VideoResult = {
      id: `video-${Date.now()}`,
      prompt: videoPrompt,
      videoUrl: null,
      isLoading: true,
      error: null,
      loadingMessage: '동영상 생성을 초기화하는 중...',
    };
    setVideoResult(initialResult);

    try {
      const onProgress = (message: string) => {
        setVideoResult(prev => prev ? { ...prev, loadingMessage: message } : null);
      };

      const referenceImageFile = sourceImages.length > 0 ? sourceImages[0].file : null;
      const videoUrl = await generateVideo(videoPrompt, referenceImageFile, onProgress);

      setVideoResult(prev => prev ? { ...prev, videoUrl, isLoading: false } : null);
      addToast('success', '동영상 생성이 완료되었습니다.');
    } catch (error) {
      console.error("동영상 생성 실패:", error);
      handleError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFrames = async (config: FrameConfig) => {
    setIsGenerating(true);

    // 초기 결과 설정
    const initialResults: ImageResult[] = config.scenes.map(scene => ({
      id: `frame-${scene.sceneNumber}-${Date.now()}`,
      prompt: scene.prompt,
      imageUrl: null,
      isLoading: true,
      error: null,
    }));

    setResults(initialResults);

    try {
      const generationPromises = config.scenes.map(scene => {
        let finalPrompt = scene.prompt;

        // 배경 추가
        if (config.background) {
          finalPrompt = `${finalPrompt}, Background: ${config.background}`;
        }

        // 캐릭터 일관성 유지
        if (config.maintainConsistency && config.characterImage) {
          const imageFiles = [{ file: config.characterImage, name: 'character' }];
          finalPrompt = `consistent character from reference image, ${finalPrompt}`;

          return generateImageFromImagesAndText(imageFiles, finalPrompt)
            .then(imageUrl => ({
              id: `frame-${scene.sceneNumber}-${Date.now()}`,
              status: 'fulfilled' as const,
              value: imageUrl
            }))
            .catch(error => ({
              id: `frame-${scene.sceneNumber}-${Date.now()}`,
              status: 'rejected' as const,
              reason: (error as Error).message
            }));
        } else {
          // 캐릭터 일관성 없이 텍스트만으로 생성
          return generateImageFromText(finalPrompt, aspectRatio)
            .then(imageUrl => ({
              id: `frame-${scene.sceneNumber}-${Date.now()}`,
              status: 'fulfilled' as const,
              value: imageUrl
            }))
            .catch(error => ({
              id: `frame-${scene.sceneNumber}-${Date.now()}`,
              status: 'rejected' as const,
              reason: (error as Error).message
            }));
        }
      });

      const outcomes = await Promise.all(generationPromises);

      setResults(currentResults => {
        return currentResults.map((result, index) => {
          const outcome = outcomes[index];
          if (!outcome) return result;

          if (outcome.status === 'fulfilled') {
            if (onAddHistory) {
              onAddHistory(outcome.value, result.prompt || '');
            }
            return { ...result, imageUrl: outcome.value, isLoading: false };
          } else {
            return { ...result, error: outcome.reason || "알 수 없는 오류가 발생했습니다.", isLoading: false };
          }
        });
      });

      addToast('success', `${config.scenes.length}개 프레임이 생성되었습니다.`);
    } catch (error) {
      console.error("프레임 생성 실패:", error);
      handleError(error);
      setResults([]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateScene = async (config: VideoConfig): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('config', JSON.stringify(config));

      if (config.bgMusic) {
        formData.append('bgMusic', config.bgMusic);
      }

      const response = await fetch('http://localhost:3002/api/create-scene', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Video creation failed');
      }

      const data = await response.json();
      addToast('success', `영상이 생성되었습니다! (${data.frameCount}개 프레임, ${data.duration.toFixed(1)}초)`);
      return data.videoUrl;
    } catch (error) {
      console.error('Scene creation error:', error);
      addToast('error', '영상 생성에 실패했습니다.');
      throw error;
    }
  };

  const handleGenerate = () => {
    if (mode === 'video') {
      handleGenerateVideo();
    } else {
      handleGenerateImages();
    }
  }

  const handleGenerateVoice = async (settings: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        // Web Speech API 사용 (브라우저 내장 TTS)
        const utterance = new SpeechSynthesisUtterance(settings.text);

        // 한국어 음성 설정
        const voices = window.speechSynthesis.getVoices();
        const koreanVoice = voices.find(voice => voice.lang.startsWith('ko'));
        if (koreanVoice) {
          utterance.voice = koreanVoice;
        }

        // 속도 및 음높이 설정
        utterance.rate = settings.speed;
        utterance.pitch = 1 + (settings.pitch / 20); // -20~20을 0.0~2.0으로 변환

        // 음성 생성 완료 후 오디오 URL 생성
        // 실제로는 서버에서 생성하거나 녹음해야 하지만, 여기서는 간단히 처리
        utterance.onend = () => {
          // 더미 오디오 URL 반환 (실제로는 녹음된 오디오 URL)
          const dummyAudioUrl = 'data:audio/mp3;base64,//uQx...'; // 실제 구현 필요
          addToast('success', '음성이 생성되었습니다.');
          resolve(dummyAudioUrl);
        };

        utterance.onerror = (error) => {
          console.error('TTS error:', error);
          addToast('error', '음성 생성에 실패했습니다.');
          reject(error);
        };

        // 음성 재생
        window.speechSynthesis.speak(utterance);

      } catch (error) {
        console.error('Voice generation error:', error);
        addToast('error', '음성 생성에 실패했습니다.');
        reject(error);
      }
    });
  };

  // Phase 2 핸들러들
  const handleTransferStyle = async (sourceImage: File, styleImage: File, strength: number): Promise<string> => {
    setEditingState('generating-prompt');
    try {
      const prompt = `Apply the artistic style from the style image to the source image with ${strength}% strength`;
      const imageUrl = await generateImageFromImagesAndText([{ file: sourceImage, name: 'source' }, { file: styleImage, name: 'style' }], prompt);
      addToast('success', '스타일이 적용되었습니다.');
      pushResultToGallery('스타일 따라하기', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '스타일 적용에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleChangeColor = async (image: File, targetArea: string, newColor: string, preserveTexture: boolean): Promise<string> => {
    setEditingState('prompt');
    try {
      const prompt = `Change the ${targetArea} color to ${newColor}${preserveTexture ? ', preserve texture' : ''}`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '색상이 변경되었습니다.');
      pushResultToGallery('색상 바꾸기', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '색상 변경에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleTransferPose = async (sourceImage: File, poseReference: File, accuracy: number): Promise<string> => {
    setEditingState('generating-prompt');
    try {
      const prompt = `Transfer the pose from reference to source with ${accuracy}% accuracy`;
      const imageUrl = await generateImageFromImagesAndText([{ file: sourceImage, name: 'person' }, { file: poseReference, name: 'pose' }], prompt);
      addToast('success', '포즈가 적용되었습니다.');
      pushResultToGallery('포즈 따라하기', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '포즈 적용에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleCorrectFace = async (image: File, correctionType: string, strength: number, naturalness: number): Promise<string> => {
    setEditingState('prompt');
    try {
      const prompt = `Enhance ${correctionType} with ${strength}% strength, ${naturalness}% natural`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '보정이 완료되었습니다.');
      pushResultToGallery('얼굴 보정', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '보정에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleAdjustSkinTone = async (image: File, tone: string, evenness: number, naturalness: number): Promise<string> => {
    setEditingState('prompt');
    try {
      const prompt = `Adjust skin tone to ${tone}, ${evenness}% evenness, ${naturalness}% natural`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '피부톤이 조정되었습니다.');
      pushResultToGallery('피부톤 튜닝', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '피부톤 조정에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleApplyHairMakeup = async (image: File, hairstyle: string, hairColor: string, makeupStyle: string, makeupIntensity: number): Promise<string> => {
    setEditingState('prompt');
    try {
      let prompt = '';
      if (hairstyle) prompt += `Change hairstyle to ${hairstyle}, `;
      if (hairColor) prompt += `change hair color to ${hairColor}, `;
      if (makeupStyle && makeupStyle !== 'none') prompt += `apply ${makeupStyle} makeup ${makeupIntensity}%`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '헤어 & 메이크업이 적용되었습니다.');
      pushResultToGallery('헤어 & 메이크업', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '적용에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleRemoveObject = async (image: File, description: string, fillMethod: 'smart' | 'smooth' | 'structure', edgeProtect: number): Promise<string> => {
    setEditingState('object-remove');
    try {
      const target = description.trim() || 'the unwanted object';
      const fillPromptMap = {
        smart: 'Fill the removed area with context-aware background details and match lighting.',
        smooth: 'Fill the area with a subtle studio-like blur for a clean finish.',
        structure: 'Reconstruct architectural lines and repeating patterns with high fidelity.',
      };
      const prompt = `Remove ${target} from this photo. ${fillPromptMap[fillMethod]} Protect the remaining subject edges at ${edgeProtect}% strength and avoid distorting the main subject.`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '피사체가 제거되었습니다.');
      pushResultToGallery('피사체 지우기', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '피사체 제거에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleConvertAspect = async (image: File, ratio: string, extendMode: 'extend' | 'crop' | 'zoom', composition: number): Promise<string> => {
    setEditingState('aspect');
    try {
      const modePromptMap = {
        extend: 'Extend the canvas outward by hallucinating matching background textures.',
        crop: 'Perform an intelligent crop that keeps the primary subject framed at the center.',
        zoom: 'Apply a gentle zoom/scale to fill the new canvas without stretching.',
      };
      const prompt = `Convert this image to a ${ratio} aspect ratio. ${modePromptMap[extendMode]} Keep the subject proportions untouched and protect composition ${composition}%.`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '화면 비율이 변환되었습니다.');
      pushResultToGallery('화면 비율 변환', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '화면 비율 변환에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };

  const handleCleanImage = async (image: File, options: { denoise: boolean; sharpen: boolean; restoreColor: boolean; removeArtifacts: boolean; intensity: number }): Promise<string> => {
    setEditingState('image-clean');
    try {
      const tasks: string[] = [];
      if (options.denoise) tasks.push('remove digital noise');
      if (options.sharpen) tasks.push('restore crisp edges and fine detail');
      if (options.restoreColor) tasks.push('restore natural color balance');
      if (options.removeArtifacts) tasks.push('remove compression blocks and scratches');
      const actions = tasks.length > 0 ? tasks.join(', ') : 'lightly enhance the photo';
      const prompt = `Clean and restore this image. ${actions}. Overall enhancement intensity ${options.intensity}%. Keep the person\'s identity and original lighting intact.`;
      const imageUrl = await editImage(image, prompt);
      addToast('success', '이미지를 깨끗하게 정리했습니다.');
      pushResultToGallery('이미지 클리너', imageUrl);
      return imageUrl;
    } catch (error) {
      addToast('error', '이미지 정리에 실패했습니다.');
      throw error;
    } finally {
      setEditingState('idle');
    }
  };


  const handleRevisePrompts = async () => {
    const validPrompts = prompts.filter(p => p.value.trim() !== '');
    if (validPrompts.length === 0) {
      addToast('info', "수정할 프롬프트가 없습니다.");
      return;
    }

    setIsRevisingPrompts(true);
    try {
      const originalPromptTexts = validPrompts.map(p => p.value);
      const revisedPromptTexts = await revisePromptsForPolicy(originalPromptTexts);

      if (revisedPromptTexts.length !== validPrompts.length) {
        throw new Error("프롬프트 수정 중 오류가 발생했습니다: 개수가 일치하지 않습니다.");
      }

      const newPrompts = [...prompts];
      let revisedIndex = 0;
      for (let i = 0; i < newPrompts.length; i++) {
        if (newPrompts[i].value.trim() !== '') {
          newPrompts[i].value = revisedPromptTexts[revisedIndex];
          revisedIndex++;
        }
      }
      setPrompts(newPrompts);
      addToast('success', "프롬프트가 자동으로 수정되었습니다. 이제 이미지를 생성해 보세요.");

    } catch (error) {
      console.error("프롬프트 수정 실패:", error);
      handleError(error);
    } finally {
      setIsRevisingPrompts(false);
    }
  };

  const handleDownloadResult = async (imageUrl: string, prompt: string) => {
    try {
      // Base64 Data URL을 Blob으로 변환
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Blob URL 생성
      const blobUrl = URL.createObjectURL(blob);

      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = blobUrl;

      const sanitizedPrompt = prompt.slice(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${sanitizedPrompt || 'generated-image'}.png`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Blob URL 정리 (메모리 누수 방지)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      addToast('success', '이미지가 다운로드되었습니다.');
    } catch (error) {
      console.error('이미지 다운로드 실패:', error);
      addToast('error', '이미지 다운로드에 실패했습니다.');
    }
  };

  const handleDownloadVideoResult = async (videoUrl: string, prompt: string) => {
    try {
      // Base64 Data URL을 Blob으로 변환
      const response = await fetch(videoUrl);
      const blob = await response.blob();

      // Blob URL 생성
      const blobUrl = URL.createObjectURL(blob);

      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = blobUrl;

      const sanitizedPrompt = prompt.slice(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${sanitizedPrompt || 'generated-video'}.mp4`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Blob URL 정리 (메모리 누수 방지)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

      addToast('success', '동영상이 다운로드되었습니다.');
    } catch (error) {
      console.error('동영상 다운로드 실패:', error);
      addToast('error', '동영상 다운로드에 실패했습니다.');
    }
  };

  const handleDownloadSourceImage = (id: string) => {
    const image = sourceImages.find(img => img.id === id);
    if (!image || !image.url || !image.file) return;

    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast('success', '프롬프트가 클립보드에 복사되었습니다.');
    }).catch(() => {
      addToast('error', '복사에 실패했습니다.');
    });
  };

  const canGenerate = (
    !isGenerating && !isRevisingPrompts && (
      (mode === 'fusion' && sourceImages.some(img => img.file) && prompts.some(p => p.value.trim() !== '')) ||
      (mode === 'text' && prompts.some(p => p.value.trim() !== '')) ||
      (mode === 'video' && videoPrompt.trim() !== '')
    )
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-7xl mx-auto relative space-y-4">
        <div
          ref={groupNavRef}
          className="rounded-2xl border border-gray-800/70 bg-gray-900/70 p-4 shadow-lg shadow-black/30"
        >
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex flex-wrap items-start gap-3 flex-1">
              {MODE_GROUPS.map(group => {
                const isActive = activeGroupKey === group.key;
                const isOpen = openGroupKey === group.key;
                return (
                  <div key={group.key} className="relative">
                    <button
                      onClick={() => handleGroupToggle(group.key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${isActive
                        ? 'bg-gradient-to-r from-indigo-500/80 to-sky-500/80 text-white shadow-lg shadow-indigo-900/40'
                        : 'bg-gray-800/70 text-gray-300 hover:bg-gray-700/70'
                        }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-xs font-bold">
                        {group.step}
                      </span>
                      {group.label}
                      <span className="text-xs text-white/80">{isOpen ? '▲' : '▼'}</span>
                    </button>
                    {isOpen && (
                      <div className="absolute left-0 top-full z-20 mt-3 w-72 sm:w-80">
                        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/95 via-gray-900/90 to-slate-950/90 p-4 shadow-2xl shadow-black/30 backdrop-blur">
                          <div className="mb-3">
                            <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/70">STEP {group.step}</p>
                            <p className="text-base font-semibold text-white">{group.label}</p>
                            <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">{group.description}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {group.modes.map(item => (
                              <button
                                key={item.mode}
                                onClick={() => handleModeChange(item.mode)}
                                className={`flex items-center justify-between rounded-xl border border-white/5 bg-gray-800/70 px-4 py-3 text-left text-sm transition-all hover:border-indigo-400/50 ${mode === item.mode ? 'ring-2 ring-indigo-400/70 bg-indigo-950/40' : ''}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{item.icon}</span>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-white">{item.label}</span>
                                    <span className="text-[11px] text-gray-400">{item.summary}</span>
                                  </div>
                                </div>
                                <span className="text-gray-500 text-xs">▶</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-3">
              {recentModes.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span className="uppercase tracking-wide text-gray-500">최근</span>
                  {recentModes.map(recentMode => {
                    const info = MODE_LABEL_MAP[recentMode];
                    if (!info) return null;
                    return (
                      <button
                        key={recentMode}
                        onClick={() => handleModeChange(recentMode)}
                        className="flex items-center gap-1 rounded-full bg-gray-800/70 px-3 py-1 text-[11px] font-semibold text-gray-200 hover:bg-gray-700/80"
                      >
                        <span>{info.icon}</span>
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-4 lg:gap-6">
          {/* Controls Column */}
          <div className="flex flex-col gap-8">

            {(mode === 'fusion' || mode === 'video') && (
              <div>
                <h2 className="text-xl font-semibold text-gray-200 mb-2">1. {mode === 'video' ? '참조 이미지 (선택)' : '참조 이미지 업로드'}</h2>
                {mode === 'fusion' && (
                  <p className="text-xs text-cyan-300 mb-4">
                    저장된 캐릭터: {savedCharacterCount}명
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(mode === 'video' ? sourceImages.slice(0, 1) : sourceImages).map((image, index) => (
                    <div key={image.id}>
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <h3 className="text-base font-medium text-gray-300">
                          {mode === 'fusion' ? `이미지 ${index + 1}` : '입력 이미지'}
                        </h3>
                        {mode === 'fusion' && sourceImages.length > 1 && (
                          <button
                            onClick={() => handleClearImage(image.id)}
                            className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                            title="이미지 슬롯 삭제"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <ImageDropzone
                        onImageDrop={(file) => handleImageDrop(image.id, file)}
                        previewUrl={image.url}
                        onClear={() => handleClearImage(image.id)}
                        onPreviewClick={() => image.url && setLightboxImageUrl(image.url)}
                        onDownload={() => handleDownloadSourceImage(image.id)}
                      />
                      {mode === 'fusion' && (
                        <input
                          type="text"
                          value={image.name}
                          onChange={(e) => handleImageNameChange(image.id, e.target.value)}
                          placeholder="이미지 이름 (예: 캐디)"
                          className="w-full mt-2 bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                        />
                      )}
                    </div>
                  ))}
                </div>
                {mode === 'fusion' && (
                  <button onClick={addSourceImage} className="mt-4 flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110 2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    참조 이미지 추가
                  </button>
                )}
              </div>
            )}

            {mode === 'fusion' && sourceImages.some(img => img.file) && (
              <ImageEditorControls
                sourceImages={sourceImages}
                activeEditingImageId={activeEditingImageId}
                setActiveEditingImageId={setActiveEditingImageId}
                activeImageUrl={sourceImages.find(img => img.id === activeEditingImageId)?.url || null}
                editPrompt={editPrompt}
                setEditPrompt={setEditPrompt}
                editingState={editingState}
                onEditImage={handleEditImage}
                onSpecialEdit={handleSpecialEdit}
                onUpscale={handleUpscale}
                onGeneratePrompt={handleGeneratePrompt}
                onGeneratePersonDetails={handleGeneratePersonDetails}
                onAgeChange={handleAgeChange}
                onMultiAgeGeneration={handleMultiAgeGeneration}
                bodyEnhanceLevel={bodyEnhanceLevel}
                setBodyEnhanceLevel={setBodyEnhanceLevel}
                turnaroundOutfitMode={turnaroundOutfitMode}
                setTurnaroundOutfitMode={setTurnaroundOutfitMode}
                onGenerateTurnaround={handleGenerateTurnaround}
                turnaroundPreviews={pendingTurnaroundSet?.previews || []}
                isGeneratingTurnaround={isGeneratingTurnaround}
                isTurnaroundApproved={!!pendingTurnaroundSet?.approved}
                turnaroundName={turnaroundName}
                setTurnaroundName={setTurnaroundName}
                onApproveTurnaround={handleApproveTurnaround}
                onSaveTurnaround={handleSaveTurnaround}
              />
            )}

            {mode === 'camera-control' && (
              <CameraControls onSettingsChange={setCameraSettings} />
            )}

            {mode === 'frame-generator' && (
              <FrameGenerator onGenerate={handleGenerateFrames} isGenerating={isGenerating} />
            )}

            {mode === 'scene-creator' && (
              <SceneCreator availableFrames={results} onCreateVideo={handleCreateScene} />
            )}

            {mode === 'image-analyzer' && (
              <ImageAnalyzer onAnalyze={handleAnalyzeImage} isAnalyzing={editingState === 'generating-prompt'} />
            )}

            {mode === 'voice-studio' && (
              <VoiceStudio onGenerateVoice={handleGenerateVoice} isGenerating={editingState === 'generating-prompt'} />
            )}

            {mode === 'style-transfer' && (
              <StyleTransfer onTransferStyle={handleTransferStyle} isProcessing={editingState === 'generating-prompt'} />
            )}

            {mode === 'color-changer' && (
              <ColorChanger onChangeColor={handleChangeColor} isProcessing={editingState === 'prompt'} />
            )}

            {mode === 'pose-transfer' && (
              <PoseTransfer onTransferPose={handleTransferPose} isProcessing={editingState === 'generating-prompt'} />
            )}

            {mode === 'face-correction' && (
              <FaceCorrection onCorrectFace={handleCorrectFace} isProcessing={editingState === 'prompt'} />
            )}

            {mode === 'skin-tone' && (
              <SkinToneAdjuster onAdjustSkinTone={handleAdjustSkinTone} isProcessing={editingState === 'prompt'} />
            )}

            {mode === 'hair-makeup' && (
              <HairMakeup onApplyHairMakeup={handleApplyHairMakeup} isProcessing={editingState === 'prompt'} />
            )}

            {mode === 'object-remover' && (
              <ObjectRemover onRemoveObject={handleRemoveObject} isProcessing={editingState === 'object-remove'} />
            )}

            {mode === 'aspect-ratio' && (
              <AspectRatioConverter onConvertAspect={handleConvertAspect} isProcessing={editingState === 'aspect'} />
            )}

            {mode === 'image-cleaner' && (
              <ImageCleaner onCleanImage={handleCleanImage} isProcessing={editingState === 'image-clean'} />
            )}

            {mode !== 'frame-generator' && mode !== 'scene-creator' && mode !== 'image-analyzer' && mode !== 'voice-studio' && mode !== 'style-transfer' && mode !== 'color-changer' && mode !== 'pose-transfer' && mode !== 'face-correction' && mode !== 'skin-tone' && mode !== 'hair-makeup' && mode !== 'object-remover' && mode !== 'aspect-ratio' && mode !== 'image-cleaner' && (

              <div>
                <h2 className="text-xl font-semibold text-gray-200 mb-2">
                  {mode === 'text' ? '1.' : mode === 'camera-control' ? '2.' : '2.'} 창의적인 프롬프트 추가
                </h2>
                {mode === 'video' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder="예: '밤하늘을 나는 용'"
                      className="flex-grow bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {prompts.map((prompt, index) => (
                      <div key={prompt.id} className="flex items-start gap-2">
                        <textarea
                          value={prompt.value}
                          onChange={(e) => handlePromptChange(prompt.id, e.target.value)}
                          placeholder={`프롬프트 #${index + 1}...`}
                          className="flex-grow bg-gray-800 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y"
                          rows={1}
                        />
                        {prompts.length > 1 && (
                          <button onClick={() => removePrompt(prompt.id)} className="p-2 text-gray-400 hover:text-red-400 transition mt-1" aria-label="프롬프트 제거">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                    {prompts.length < MAX_PROMPTS && (
                      <button onClick={addPrompt} className="self-start flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition mt-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110 2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        프롬프트 추가하기
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode !== 'video' && (
              <div>
                <h2 className="text-xl font-semibold text-gray-200 mb-2">{mode === 'text' ? '2.' : '3.'} 이미지 비율 선택</h2>
                <div className="flex flex-wrap gap-2">
                  {aspectRatios.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setAspectRatio(value)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${aspectRatio === value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    >
                      {label} ({value})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`w-full sm:flex-grow py-4 px-6 text-lg font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-3
                  ${canGenerate ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                `}
              >
                {isGenerating ? '생성 중...' :
                  mode === 'video' ? '동영상 생성하기' : `${prompts.filter(p => p.value.trim()).length}개의 이미지 생성하기`
                }
                {isGenerating && <Spinner />}
              </button>
              {mode !== 'video' && (
                <button
                  onClick={handleRevisePrompts}
                  disabled={!canGenerate}
                  className={`w-full sm:w-auto mt-2 sm:mt-0 px-4 py-4 text-base font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-2
                    ${canGenerate ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                  `}
                  title="정책 문제로 생성이 거부될 경우, AI가 프롬프트를 안전하게 수정합니다."
                >
                  {isRevisingPrompts ? <Spinner size="sm" /> : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">자동 수정</span>
                  <span className="sm:hidden">프롬프트 자동 수정</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Column */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 sm:p-6 min-h-[30rem]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-200">결과</h2>
              {mode !== 'video' && results.filter(r => r.imageUrl).length >= 2 && (
                <button
                  onClick={() => setIsGifCreatorOpen(true)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-md transition text-sm font-semibold"
                >
                  GIF 만들기
                </button>
              )}
            </div>
            {mode === 'video' ? (
              <>
                {!videoResult ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-center">생성된 동영상이 여기에 표시됩니다.</p>
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg flex flex-col">
                    <div className="w-full bg-gray-900 flex items-center justify-center relative group aspect-video">
                      {videoResult.isLoading && (
                        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                          <Spinner />
                          <p className="mt-4 text-lg font-semibold">{videoResult.loadingMessage}</p>
                          <p className="mt-2 text-sm text-gray-400">동영상 생성은 몇 분 정도 소요될 수 있습니다. 잠시만 기다려주세요.</p>
                        </div>
                      )}
                      {videoResult.error && (
                        <div className="p-4 text-center text-red-400 w-full h-full flex flex-col items-center justify-center">
                          <p><strong>오류</strong></p>
                          <p className="text-sm">{videoResult.error}</p>
                        </div>
                      )}
                      {videoResult.videoUrl && (
                        <>
                          <video
                            src={videoResult.videoUrl}
                            controls
                            className="w-full h-full object-contain"
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownloadVideoResult(videoResult.videoUrl!, videoResult.prompt); }}
                            className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-opacity opacity-0 group-hover:opacity-100"
                            aria-label="동영상 다운로드"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                    <div className="p-3 bg-gray-700 flex justify-between items-center gap-2">
                      <p className="text-sm text-gray-300 truncate flex-grow">{videoResult.prompt}</p>
                      <button
                        onClick={() => handleCopyPrompt(videoResult.prompt)}
                        className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-white transition-colors whitespace-nowrap"
                      >
                        복사
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {results.length === 0 && !isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-center">생성된 이미지가 여기에 표시됩니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {results.map((result) => (
                      <div key={result.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg flex flex-col">
                        <div className="w-full bg-gray-900 flex items-center justify-center relative group aspect-square">
                          {result.isLoading && (
                            <div className="w-full h-full flex items-center justify-center">
                              <Spinner />
                            </div>
                          )}
                          {result.error && (
                            <div className="p-4 text-center text-red-400 w-full h-full flex flex-col items-center justify-center">
                              <p><strong>오류</strong></p>
                              <p className="text-sm">{result.error}</p>
                            </div>
                          )}
                          {result.imageUrl && (
                            <>
                              <img
                                src={result.imageUrl}
                                alt={result.prompt}
                                className="w-full h-full object-contain cursor-pointer"
                                onClick={() => setLightboxImageUrl(result.imageUrl)}
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDownloadResult(result.imageUrl!, result.prompt); }}
                                className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-opacity opacity-0 group-hover:opacity-100"
                                aria-label="이미지 다운로드"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                        <div className="p-3 bg-gray-700 flex justify-between items-center gap-2">
                          <p className="text-sm text-gray-300 truncate flex-grow">{result.prompt}</p>
                          <button
                            onClick={() => handleCopyPrompt(result.prompt)}
                            className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-white transition-colors whitespace-nowrap"
                          >
                            복사
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        </main>
      </div>
      {lightboxImageUrl && (
        <Lightbox imageUrl={lightboxImageUrl} onClose={() => setLightboxImageUrl(null)} />
      )}
      {isGifCreatorOpen && (
        <GifCreator
          images={results.filter(r => !!r.imageUrl) as (ImageResult & { imageUrl: string })[]}
          onClose={() => setIsGifCreatorOpen(false)}
        />
      )}
    </div>
  );
};

export default App;

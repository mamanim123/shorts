/**
 * CharacterPanel.tsx
 * 캐릭터 및 의상 관리 패널
 * 
 * 기능:
 * - 캐릭터선택: 저장된 캐릭터 목록에서 슬롯에 할당
 * - 캐릭터관리: 얼굴/헤어/체형 설정으로 새 캐릭터 생성
 * - 의상추출: 이미지에서 AI로 의상 프롬프트 추출 + 의상 리스트 관리
 * - 드래그 앤 드롭: 이미지 업로드 지원
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Users, Shirt, Plus, Trash2, Upload, Sparkles, Save, ChevronDown, X, Loader2, Copy, Check, Pencil } from 'lucide-react';
import { showToast } from './Toast';

import { generateImageWithImagen } from './master-studio/services/geminiService';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { Bot, Image as ImageIcon, RefreshCw } from 'lucide-react';
import Lightbox from './master-studio/Lightbox';
import { UNIFIED_OUTFIT_LIST } from '../constants';
import { fetchOutfitCatalog, saveOutfitCatalog } from '../services/outfitService';
import type { OutfitCategory, OutfitItem } from '../services/outfitService';
import { fetchCharacters, saveCharacters } from '../services/characterService';
import type { CharacterItem } from '../services/characterService';

// ============================================
// 타입 정의
// ============================================

type Character = CharacterItem;
type Outfit = OutfitItem;

// UNIFIED_OUTFIT_LIST 아이템 타입
interface BaseOutfitItem {
  id: string;
  name: string;
  translation: string;
  categories: string[];
  prompt?: string;
}

interface CharacterPanelProps {
  onCharacterSelect?: (character: Character | null, slot: string) => void;
  onOutfitSelect?: (outfit: Outfit | null) => void;
  selectedSlot?: string;
}

// ============================================
// 프리셋 데이터
// ============================================

const HAIR_PRESETS = [
  { id: 'long-wave', name: '롱 웨이브', prompt: 'long soft-wave hairstyle with natural highlights' },
  { id: 'short-bob', name: '단발 보브', prompt: 'short stylish bob hair with side swept bangs' },
  { id: 'ponytail', name: '포니테일', prompt: 'elegant high ponytail hairstyle' },
  { id: 'updo', name: '업스타일', prompt: 'sophisticated updo hairstyle' },
  { id: 'short-neat', name: '짧은 정돈', prompt: 'short neat hairstyle with clean-shaven face' },
];

const BODY_PRESETS = [
  { id: 'slim-hourglass', name: '슬림 모래시계', prompt: 'slim hourglass figure with toned body, elegant posture' },
  { id: 'petite-glamour', name: '아담 글래머', prompt: 'petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves' },
  { id: 'athletic', name: '건강미 탄탄', prompt: 'gracefully toned and slim athletic body, expertly managed sleek silhouette with perky high-seated bust' },
  { id: 'curvy', name: '볼륨 글래머', prompt: 'extraordinarily high-projection perky bust, high-seated chest line, voluptuous hourglass figure' },
];

const DEFAULT_OUTFITS: Outfit[] = [];

const SLOT_OPTIONS = [
  { id: 'woman-a', name: 'Woman A', gender: 'female' as const },
  { id: 'woman-b', name: 'Woman B', gender: 'female' as const },
  { id: 'man-a', name: 'Man A', gender: 'male' as const },
  { id: 'man-b', name: 'Man B', gender: 'male' as const },
];

// 의상 카테고리 (대본 생성에 사용되는 실제 카테고리)
const DEFAULT_OUTFIT_CATEGORIES: OutfitCategory[] = [
  { id: 'ROYAL', name: 'ROYAL', emoji: '👗', description: '로얄/우아한 의상', gender: 'female' },
  { id: 'YOGA', name: 'YOGA', emoji: '🧘', description: '요가/애슬레저', gender: 'female' },
  { id: 'GOLF LUXURY', name: 'GOLF LUXURY', emoji: '🏌️', description: '골프/럭셔리 스포츠웨어', gender: 'female' },
  { id: 'SEXY', name: 'SEXY', emoji: '💋', description: '섹시/매혹적인 의상', gender: 'female' },
  { id: 'MALE', name: 'MALE', emoji: '🕺', description: '남성 의상', gender: 'male' },
];
const DEFAULT_CATEGORY_IDS = new Set(DEFAULT_OUTFIT_CATEGORIES.map(category => category.id));

// ============================================
// 메인 컴포넌트
// ============================================

const CharacterPanel: React.FC<CharacterPanelProps> = ({
  onCharacterSelect,
  onOutfitSelect,
  selectedSlot = 'woman-a'
}) => {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'select' | 'manage' | 'outfit'>('select');

  // 데이터 상태
  const [characters, setCharacters] = useState<Character[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>(DEFAULT_OUTFITS);
  const [outfitCategories, setOutfitCategories] = useState<OutfitCategory[]>(DEFAULT_OUTFIT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(false);

  // 선택 상태
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);
  const [selectedBaseOutfitId, setSelectedBaseOutfitId] = useState<string | null>(null);

  // 의상 추가 상태
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [newOutfitName, setNewOutfitName] = useState('');
  const [newOutfitPrompt, setNewOutfitPrompt] = useState('');
  const [newOutfitCategory, setNewOutfitCategory] = useState(DEFAULT_OUTFIT_CATEGORIES[0]?.id || 'ROYAL');

  // 카테고리 추가 상태
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryGender, setNewCategoryGender] = useState<OutfitCategory['gender']>('female');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryGender, setEditingCategoryGender] = useState<OutfitCategory['gender']>('female');

  // 카테고리 드롭다운 상태
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // 캐릭터 관리 상태 (서브탭)
  const [manageSubTab, setManageSubTab] = useState<'face' | 'hair' | 'body'>('face');
  const [newCharacter, setNewCharacter] = useState({
    name: '',
    age: '30대',
    gender: 'female' as 'female' | 'male',
    face: '',
    hair: '',
    body: ''
  });

  // 의상 추출 상태 (localStorage에서 복원)
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedOutfit, setExtractedOutfit] = useState<{ name: string; en: string; ko: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('extractedOutfit');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  // 얼굴 추출 상태 (localStorage에서 복원)
  const [isExtractingFace, setIsExtractingFace] = useState(false);
  const [extractedFace, setExtractedFace] = useState<{ en: string; ko: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('extractedFace');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  // 헤어 추출 상태 (localStorage에서 복원)
  const [isExtractingHair, setIsExtractingHair] = useState(false);
  const [extractedHair, setExtractedHair] = useState<{ en: string; ko: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('extractedHair');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  // 체형 추출 상태 (localStorage에서 복원)
  const [isExtractingBody, setIsExtractingBody] = useState(false);
  const [extractedBody, setExtractedBody] = useState<{ en: string; ko: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('extractedBody');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  // 자동 번역 상태
  const [isTranslatingOutfit, setIsTranslatingOutfit] = useState(false);
  const [isTranslatingFace, setIsTranslatingFace] = useState(false);
  const [isTranslatingHair, setIsTranslatingHair] = useState(false);
  const [isTranslatingBody, setIsTranslatingBody] = useState(false);
  const outfitTranslateTimer = useRef<NodeJS.Timeout | null>(null);
  const faceTranslateTimer = useRef<NodeJS.Timeout | null>(null);
  const hairTranslateTimer = useRef<NodeJS.Timeout | null>(null);
  const bodyTranslateTimer = useRef<NodeJS.Timeout | null>(null);

  // 이미지 생성 상태 (localStorage에서 복원)
  const [generatedOutfitImage, setGeneratedOutfitImage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('generatedOutfitImage') || null;
    }
    return null;
  });
  const [generatedFaceImage, setGeneratedFaceImage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('generatedFaceImage') || null;
    }
    return null;
  });
  const [generatedHairImage, setGeneratedHairImage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('generatedHairImage') || null;
    }
    return null;
  });
  const [generatedBodyImage, setGeneratedBodyImage] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('generatedBodyImage') || null;
    }
    return null;
  });
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aiForwardingType, setAiForwardingType] = useState<'outfit' | 'face' | 'hair' | 'body' | null>(null);
  const aiForwardAbortRef = useRef<AbortController | null>(null);

  // Lightbox 상태
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 드래그 앤 드롭 상태
  const [isDraggingFace, setIsDraggingFace] = useState(false);
  const [isDraggingOutfit, setIsDraggingOutfit] = useState(false);
  const [isDraggingHair, setIsDraggingHair] = useState(false);
  const [isDraggingBody, setIsDraggingBody] = useState(false);

  // 마지막 업로드 파일 저장 (재분석용)
  const [lastFaceFile, setLastFaceFile] = useState<File | null>(null);
  const [lastOutfitFile, setLastOutfitFile] = useState<File | null>(null);
  const [lastOutfitImageData, setLastOutfitImageData] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastOutfitImageData') || null;
    }
    return null;
  });
  const [lastFaceImageData, setLastFaceImageData] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastFaceImageData') || null;
    }
    return null;
  });
  const [lastHairImageData, setLastHairImageData] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastHairImageData') || null;
    }
    return null;
  });
  const [lastBodyImageData, setLastBodyImageData] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('lastBodyImageData') || null;
    }
    return null;
  });

  // 복사 상태
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // ---------------------------------------------------------
  // 데이터 로드
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [loadedCharacters, outfitCatalog] = await Promise.all([
          fetchCharacters(),
          fetchOutfitCatalog()
        ]);

        if (loadedCharacters.length > 0) setCharacters(loadedCharacters);

        if (outfitCatalog.outfits.length > 0) {
          setOutfits(outfitCatalog.outfits);
        }

        if (outfitCatalog.categories.length > 0) {
          setOutfitCategories(outfitCatalog.categories);
          setNewOutfitCategory(outfitCatalog.categories[0].id);
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---------------------------------------------------------
  // 추출 결과 localStorage 저장
  // ---------------------------------------------------------
  useEffect(() => {
    if (extractedOutfit) {
      localStorage.setItem('extractedOutfit', JSON.stringify(extractedOutfit));
    } else {
      localStorage.removeItem('extractedOutfit');
    }
  }, [extractedOutfit]);

  useEffect(() => {
    if (extractedFace) {
      localStorage.setItem('extractedFace', JSON.stringify(extractedFace));
    } else {
      localStorage.removeItem('extractedFace');
    }
  }, [extractedFace]);

  useEffect(() => {
    if (extractedHair) {
      localStorage.setItem('extractedHair', JSON.stringify(extractedHair));
    } else {
      localStorage.removeItem('extractedHair');
    }
  }, [extractedHair]);

  useEffect(() => {
    if (extractedBody) {
      localStorage.setItem('extractedBody', JSON.stringify(extractedBody));
    } else {
      localStorage.removeItem('extractedBody');
    }
  }, [extractedBody]);

  useEffect(() => {
    if (generatedOutfitImage) {
      localStorage.setItem('generatedOutfitImage', generatedOutfitImage);
    } else {
      localStorage.removeItem('generatedOutfitImage');
    }
  }, [generatedOutfitImage]);

  useEffect(() => {
    if (generatedFaceImage) {
      localStorage.setItem('generatedFaceImage', generatedFaceImage);
    } else {
      localStorage.removeItem('generatedFaceImage');
    }
  }, [generatedFaceImage]);

  useEffect(() => {
    if (generatedHairImage) {
      localStorage.setItem('generatedHairImage', generatedHairImage);
    } else {
      localStorage.removeItem('generatedHairImage');
    }
  }, [generatedHairImage]);

  useEffect(() => {
    if (generatedBodyImage) {
      localStorage.setItem('generatedBodyImage', generatedBodyImage);
    } else {
      localStorage.removeItem('generatedBodyImage');
    }
  }, [generatedBodyImage]);

  useEffect(() => {
    if (lastOutfitImageData) {
      localStorage.setItem('lastOutfitImageData', lastOutfitImageData);
    } else {
      localStorage.removeItem('lastOutfitImageData');
    }
  }, [lastOutfitImageData]);

  useEffect(() => {
    if (lastFaceImageData) {
      localStorage.setItem('lastFaceImageData', lastFaceImageData);
    } else {
      localStorage.removeItem('lastFaceImageData');
    }
  }, [lastFaceImageData]);

  useEffect(() => {
    if (lastHairImageData) {
      localStorage.setItem('lastHairImageData', lastHairImageData);
    } else {
      localStorage.removeItem('lastHairImageData');
    }
  }, [lastHairImageData]);

  useEffect(() => {
    if (lastBodyImageData) {
      localStorage.setItem('lastBodyImageData', lastBodyImageData);
    } else {
      localStorage.removeItem('lastBodyImageData');
    }
  }, [lastBodyImageData]);

  // ---------------------------------------------------------
  // 저장 헬퍼
  // ---------------------------------------------------------
  const saveOutfitsToBE = async (newOutfits: Outfit[], categories = outfitCategories) => {
    try {
      await saveOutfitCatalog(newOutfits, categories);
    } catch (error) {
      console.error('의상 저장 실패:', error);
    }
  };

  const saveCharactersToBE = async (newChars: Character[]) => {
    try {
      await saveCharacters(newChars);
    } catch (error) {
      console.error('캐릭터 저장 실패:', error);
    }
  };

  // ---------------------------------------------------------
  // 프롬프트 복사 핸들러
  // ---------------------------------------------------------
  const handleCopyPrompt = useCallback((prompt: string, id: string) => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedPromptId(id);
      showToast('프롬프트가 복사되었습니다.', 'success');
      setTimeout(() => setCopiedPromptId(null), 2000);
    }).catch(() => {
      showToast('복사에 실패했습니다.', 'error');
    });
  }, []);

  // ---------------------------------------------------------
  // 한글 → 영문 자동 번역 함수
  // ---------------------------------------------------------
  const translateToEnglish = useCallback(async (koreanText: string, type: 'outfit' | 'face' | 'hair' | 'body') => {
    if (!koreanText.trim()) return;

    try {
      if (type === 'outfit') setIsTranslatingOutfit(true);
      if (type === 'face') setIsTranslatingFace(true);
      if (type === 'hair') setIsTranslatingHair(true);
      if (type === 'body') setIsTranslatingBody(true);

      const response = await fetch('http://localhost:3002/api/translate-to-english', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: koreanText, type })
      });

      const result = await response.json();
      if (result.success && result.translated) {
        if (type === 'outfit') {
          setExtractedOutfit(prev => prev ? { ...prev, en: result.translated } : null);
        }
        if (type === 'face') {
          setExtractedFace(prev => prev ? { ...prev, en: result.translated } : null);
        }
        if (type === 'hair') {
          setExtractedHair(prev => prev ? { ...prev, en: result.translated } : null);
        }
        if (type === 'body') {
          setExtractedBody(prev => prev ? { ...prev, en: result.translated } : null);
        }
        showToast('영문 프롬프트가 자동 번역되었습니다.', 'success');
      }
    } catch (error) {
      console.error('번역 실패:', error);
    } finally {
      if (type === 'outfit') setIsTranslatingOutfit(false);
      if (type === 'face') setIsTranslatingFace(false);
      if (type === 'hair') setIsTranslatingHair(false);
      if (type === 'body') setIsTranslatingBody(false);
    }
  }, []);

  // 한글 수정 시 debounce 번역 (의상)
  const handleOutfitKoChange = useCallback((newKo: string) => {
    setExtractedOutfit(prev => prev ? { ...prev, ko: newKo } : null);

    // 기존 타이머 취소
    if (outfitTranslateTimer.current) {
      clearTimeout(outfitTranslateTimer.current);
    }

    // 1초 후 자동 번역
    outfitTranslateTimer.current = setTimeout(() => {
      translateToEnglish(newKo, 'outfit');
    }, 1000);
  }, [translateToEnglish]);

  // 한글 수정 시 debounce 번역 (얼굴)
  const handleFaceKoChange = useCallback((newKo: string) => {
    setExtractedFace(prev => prev ? { ...prev, ko: newKo } : null);

    // 기존 타이머 취소
    if (faceTranslateTimer.current) {
      clearTimeout(faceTranslateTimer.current);
    }

    // 1초 후 자동 번역
    faceTranslateTimer.current = setTimeout(() => {
      translateToEnglish(newKo, 'face');
    }, 1000);
  }, [translateToEnglish]);

  const handleHairKoChange = useCallback((newKo: string) => {
    setExtractedHair(prev => prev ? { ...prev, ko: newKo } : null);

    if (hairTranslateTimer.current) {
      clearTimeout(hairTranslateTimer.current);
    }

    hairTranslateTimer.current = setTimeout(() => {
      translateToEnglish(newKo, 'hair');
    }, 1000);
  }, [translateToEnglish]);

  const handleBodyKoChange = useCallback((newKo: string) => {
    setExtractedBody(prev => prev ? { ...prev, ko: newKo } : null);

    if (bodyTranslateTimer.current) {
      clearTimeout(bodyTranslateTimer.current);
    }

    bodyTranslateTimer.current = setTimeout(() => {
      translateToEnglish(newKo, 'body');
    }, 1000);
  }, [translateToEnglish]);

  // ---------------------------------------------------------
  // 핸들러 (useCallback으로 메모이제이션)
  // ---------------------------------------------------------
  const handleExtractOutfit = useCallback(async (file: File | null, imageData?: string) => {
  setIsExtracting(true);
  setExtractedOutfit(null);
  setGeneratedOutfitImage(null);

  try {
    let base64Image = imageData;

    // ★★★ 핵심 수정: 파일이 있으면 무조건 새로 읽기 ★★★
    if (file) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      base64Image = await base64Promise;
      
      // 새 파일이면 이전 데이터 초기화 후 새 데이터 저장
      setLastOutfitFile(file);
      setLastOutfitImageData(base64Image);
    }

    // imageData만 있는 경우 (재분석)
    if (!base64Image) {
      throw new Error('이미지 데이터가 없습니다.');
    }

    const response = await fetch('http://localhost:3002/api/extract-outfit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64Image })
    });

      const result = await response.json();
      if (result.success && result.prompt) {
        const promptData = typeof result.prompt === 'string'
          ? { name: '추출된 의상', en: result.prompt, ko: "분석된 의상입니다." }
          : {
              name: result.prompt.name || '추출된 의상',
              en: result.prompt.en || result.prompt,
              ko: result.prompt.ko || "분석된 의상입니다."
            };

        setExtractedOutfit(promptData);
        showToast('의상 분석이 완료되었습니다.', 'success');
      } else {
        throw new Error(result.error || '분석 결과가 없습니다.');
      }
    } catch (error: any) {
      console.error('의상 추출 실패:', error);
      showToast(error.message || '이미지 분석에 실패했습니다.', 'error');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleExtractFace = useCallback(async (file: File | null, imageData?: string) => {
    setIsExtractingFace(true);
    setExtractedFace(null);
    setGeneratedFaceImage(null);

    try {
      let base64Image = imageData;

      if (!base64Image && file) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        base64Image = await base64Promise;
      }

      if (!base64Image) {
        throw new Error('이미지 데이터가 없습니다.');
      }

      if (file) {
        setLastFaceFile(file);
      }
      setLastFaceImageData(base64Image);

      const response = await fetch('http://localhost:3002/api/extract-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Image })
      });

      const result = await response.json();
      if (result.success && result.prompt) {
        const promptData = typeof result.prompt === 'string'
          ? { en: result.prompt, ko: "분석된 얼굴 특징입니다." }
          : result.prompt;

        setExtractedFace(promptData);
        setNewCharacter(prev => ({ ...prev, face: promptData.en }));
        showToast('얼굴 특징 분석이 완료되었습니다.', 'success');
      } else {
        throw new Error(result.error || '분석 결과가 없습니다.');
      }
    } catch (error: any) {
      console.error('얼굴 추출 실패:', error);
      showToast(error.message || '얼굴 분석에 실패했습니다.', 'error');
    } finally {
      setIsExtractingFace(false);
    }
  }, []);

  const handleExtractHair = useCallback(async (file: File | null, imageData?: string) => {
    setIsExtractingHair(true);
    setExtractedHair(null);
    setGeneratedHairImage(null);

    try {
      let base64Image = imageData;

      if (file) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        base64Image = await base64Promise;
        setLastHairImageData(base64Image);
      }

      if (!base64Image) {
        throw new Error('이미지 데이터가 없습니다.');
      }

      const response = await fetch('http://localhost:3002/api/extract-hair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Image })
      });

      const result = await response.json();
      if (result.success && result.prompt) {
        const promptData = typeof result.prompt === 'string'
          ? { en: result.prompt, ko: "분석된 헤어 특징입니다." }
          : result.prompt;

        setExtractedHair(promptData);
        setNewCharacter(prev => ({ ...prev, hair: promptData.en }));
        showToast('헤어 특징 분석이 완료되었습니다.', 'success');
      } else {
        throw new Error(result.error || '분석 결과가 없습니다.');
      }
    } catch (error: any) {
      console.error('헤어 추출 실패:', error);
      showToast(error.message || '헤어 분석에 실패했습니다.', 'error');
    } finally {
      setIsExtractingHair(false);
    }
  }, []);

  const handleExtractBody = useCallback(async (file: File | null, imageData?: string) => {
    setIsExtractingBody(true);
    setExtractedBody(null);
    setGeneratedBodyImage(null);

    try {
      let base64Image = imageData;

      if (file) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        base64Image = await base64Promise;
        setLastBodyImageData(base64Image);
      }

      if (!base64Image) {
        throw new Error('이미지 데이터가 없습니다.');
      }

      const response = await fetch('http://localhost:3002/api/extract-body', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Image })
      });

      const result = await response.json();
      if (result.success && result.prompt) {
        const promptData = typeof result.prompt === 'string'
          ? { en: result.prompt, ko: "분석된 체형 특징입니다." }
          : result.prompt;

        setExtractedBody(promptData);
        setNewCharacter(prev => ({ ...prev, body: promptData.en }));
        showToast('체형 특징 분석이 완료되었습니다.', 'success');
      } else {
        throw new Error(result.error || '분석 결과가 없습니다.');
      }
    } catch (error: any) {
      console.error('체형 추출 실패:', error);
      showToast(error.message || '체형 분석에 실패했습니다.', 'error');
    } finally {
      setIsExtractingBody(false);
    }
  }, []);

  const handleGenerateCharacterImage = useCallback(async (prompt: string, type: 'outfit' | 'face' | 'hair' | 'body') => {
    if (isGeneratingImage) return;
    setIsGeneratingImage(true);

    try {
    const finalPrompt = type === 'body'
      ? `${prompt}, full bust, pronounced bustline, strong bust-to-waist contrast, fitted ribbed top accentuating the bust, photorealistic human body, realistic skin texture, natural anatomy, not mannequin, not doll, not CGI, not illustration, not anime`
      : prompt;
      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ];

      const result: any = await generateImageWithImagen(
        finalPrompt,
        "",
        { aspectRatio: "1:1", model: "imagen-4.0-generate-001" },
        safetySettings
      );

      let base64Image: string | null = null;
      if (result && 'generatedImages' in result && result.generatedImages?.length > 0) {
        const generatedImage = result.generatedImages[0];
        if (generatedImage?.image?.imageBytes) {
          base64Image = generatedImage.image.imageBytes;
        } else if (generatedImage?.imageBytes) {
          base64Image = generatedImage.imageBytes;
        }
      } else if (result && result.images && result.images.length > 0) {
        base64Image = result.images[0];
      }

      if (!base64Image) throw new Error("이미지 생성에 실패했습니다.");

      const saveResponse = await fetch('http://localhost:3002/api/save-character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: `data:image/png;base64,${base64Image}`,
          prompt: finalPrompt,
          type
        })
      });

      const saveResult = await saveResponse.json();
      if (saveResult.success) {
        const imageUrl = `http://localhost:3002${saveResult.url}`;
        if (type === 'outfit') setGeneratedOutfitImage(imageUrl);
        if (type === 'face') setGeneratedFaceImage(imageUrl);
        if (type === 'hair') setGeneratedHairImage(imageUrl);
        if (type === 'body') setGeneratedBodyImage(imageUrl);
        showToast('이미지가 생성되고 저장되었습니다.', 'success');
      } else {
        throw new Error(saveResult.error || '이미지 저장 실패');
      }

    } catch (error: any) {
      console.error('이미지 생성 실패:', error);
      showToast(error.message || '이미지 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  }, [isGeneratingImage]);

  const cancelAiForwarding = useCallback(() => {
    if (aiForwardAbortRef.current) {
      try {
        aiForwardAbortRef.current.abort();
      } catch (err) {
        console.warn('AI 생성 중단 실패:', err);
      }
      aiForwardAbortRef.current = null;
    }
    setAiForwardingType(null);
  }, []);

  const handleForwardPromptToImageAI = useCallback(async (prompt: string, type: 'outfit' | 'face' | 'hair' | 'body') => {
    if (aiForwardingType === type) {
      cancelAiForwarding();
      showToast('AI 생성 요청을 취소했습니다.', 'info');
      return;
    }
    if (!prompt || !prompt.trim()) {
      showToast('전송할 프롬프트가 없습니다.', 'warning');
      return;
    }

    const finalPrompt = type === 'body'
      ? `${prompt}, full bust, pronounced bustline, strong bust-to-waist contrast, fitted ribbed top accentuating the bust, photorealistic human body, realistic skin texture, natural anatomy, not mannequin, not doll, not CGI, not illustration, not anime`
      : prompt;

    setAiForwardingType(type);

    try {
      if (aiForwardAbortRef.current) {
        aiForwardAbortRef.current.abort();
      }
      const controller = new AbortController();
      aiForwardAbortRef.current = controller;

      const sceneMap: Record<typeof type, number> = {
        face: 1,
        hair: 2,
        body: 3,
        outfit: 4
      };

      const response = await fetch('http://localhost:3002/api/image/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          storyId: 'character_assets',
          sceneNumber: sceneMap[type],
          service: 'GEMINI',
          autoCapture: true,
          title: 'CharacterPanel'
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        let message = 'AI 서비스 전송에 실패했습니다.';
        try {
          const errorData = await response.json();
          if (errorData?.error) message = errorData.error;
        } catch (err) {
          console.warn('AI 생성 오류 파싱 실패:', err);
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

      if (payload?.success) {
        const resolvedStoryId = payload.storyId || 'character_assets';
        const imageUrl = payload.url
          ? `http://localhost:3002${payload.url}`
          : `http://localhost:3002/generated_scripts/대본폴더/${resolvedStoryId}/images/${payload.filename}`;
        if (type === 'face') setGeneratedFaceImage(imageUrl);
        if (type === 'hair') setGeneratedHairImage(imageUrl);
        if (type === 'body') setGeneratedBodyImage(imageUrl);
        if (type === 'outfit') setGeneratedOutfitImage(imageUrl);
      }
    } catch (error) {
      console.error('AI 생성 전송 실패:', error);
      if (error instanceof Error && error.message.includes('Waiting failed')) {
        showToast('이미지를 찾지 못했습니다. 프롬프트 전송 후 새 이미지가 생성되는지 확인해주세요.', 'warning');
      } else {
        showToast(error instanceof Error ? error.message : 'AI 서비스 전송 오류가 발생했습니다.', 'error');
      }
    } finally {
      setAiForwardingType(null);
      if (aiForwardAbortRef.current) {
        aiForwardAbortRef.current = null;
      }
    }
  }, [aiForwardingType, cancelAiForwarding]);

  // ---------------------------------------------------------
  // 드래그 앤 드롭 핸들러
  // ---------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent, type: 'face' | 'outfit' | 'hair' | 'body') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'face') setIsDraggingFace(true);
    if (type === 'outfit') setIsDraggingOutfit(true);
    if (type === 'hair') setIsDraggingHair(true);
    if (type === 'body') setIsDraggingBody(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, type: 'face' | 'outfit' | 'hair' | 'body') => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && target.contains(relatedTarget)) return;

    if (type === 'face') setIsDraggingFace(false);
    if (type === 'outfit') setIsDraggingOutfit(false);
    if (type === 'hair') setIsDraggingHair(false);
    if (type === 'body') setIsDraggingBody(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, type: 'face' | 'outfit' | 'hair' | 'body') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'face') setIsDraggingFace(false);
    if (type === 'outfit') setIsDraggingOutfit(false);
    if (type === 'hair') setIsDraggingHair(false);
    if (type === 'body') setIsDraggingBody(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) {
      showToast('파일을 찾을 수 없습니다.', 'error');
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast('10MB 이하 이미지만 업로드 가능합니다.', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드 가능합니다.', 'error');
      return;
    }

    if (type === 'face') handleExtractFace(file);
    if (type === 'outfit') handleExtractOutfit(file);
    if (type === 'hair') handleExtractHair(file);
    if (type === 'body') handleExtractBody(file);
  }, [handleExtractFace, handleExtractOutfit, handleExtractHair, handleExtractBody]);

  const handleAddCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;

    const exists = outfitCategories.some(category => category.id.toLowerCase() === name.toLowerCase());
    if (exists) {
      showToast('이미 존재하는 카테고리입니다.', 'warning');
      return;
    }

    const newCategory: OutfitCategory = {
      id: name,
      name,
      emoji: '✨',
      description: '사용자 추가 카테고리',
      gender: newCategoryGender
    };

    const updated = [...outfitCategories, newCategory];
    setOutfitCategories(updated);
    setNewOutfitCategory(name);
    setNewCategoryName('');
    setShowAddCategory(false);
    setEditingCategoryId(null);
    saveOutfitsToBE(outfits, updated);
    showToast(`'${name}' 카테고리가 추가되었습니다.`, 'success');
  }, [newCategoryName, newCategoryGender, outfitCategories, outfits, saveOutfitsToBE]);

  const handleStartEditCategory = useCallback((category: OutfitCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryGender(category.gender || 'female');
    setShowAddCategory(false);
  }, []);

  const handleUpdateCategory = useCallback(() => {
    if (!editingCategoryId) return;
    const name = editingCategoryName.trim();
    if (!name) return;

    const updated = outfitCategories.map(category => (
      category.id === editingCategoryId
        ? { ...category, name, gender: editingCategoryGender }
        : category
    ));

    setOutfitCategories(updated);
    saveOutfitsToBE(outfits, updated);
    setEditingCategoryId(null);
    setEditingCategoryName('');
    showToast('카테고리가 수정되었습니다.', 'success');
  }, [editingCategoryId, editingCategoryName, editingCategoryGender, outfitCategories, outfits, saveOutfitsToBE]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    if (DEFAULT_CATEGORY_IDS.has(categoryId)) {
      showToast('기본 카테고리는 삭제할 수 없습니다.', 'warning');
      return;
    }

    const removeCount = outfits.filter(outfit => outfit.category === categoryId).length;
    const confirmed = window.confirm(`'${categoryId}' 카테고리를 삭제할까요? (의상 ${removeCount}개 포함)`);
    if (!confirmed) return;

    const updatedCategories = outfitCategories.filter(category => category.id !== categoryId);
    const updatedOutfits = outfits.filter(outfit => outfit.category !== categoryId);

    setOutfitCategories(updatedCategories);
    setOutfits(updatedOutfits);
    saveOutfitsToBE(updatedOutfits, updatedCategories);
    setExpandedCategories(prev => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
    if (newOutfitCategory === categoryId) {
      setNewOutfitCategory(updatedCategories[0]?.id || 'ROYAL');
    }
    showToast('카테고리가 삭제되었습니다.', 'success');
  }, [outfits, outfitCategories, newOutfitCategory, saveOutfitsToBE]);

  const handleAddOutfit = useCallback(() => {
    if (!newOutfitName.trim() || !newOutfitPrompt.trim()) return;

    const newOutfit: Outfit = {
      id: `outfit-${Date.now()}`,
      name: newOutfitName.trim(),
      prompt: newOutfitPrompt.trim(),
      category: newOutfitCategory,
      createdAt: new Date().toISOString()
    };

    const updated = [...outfits, newOutfit];
    setOutfits(updated);
    saveOutfitsToBE(updated, outfitCategories);
    setNewOutfitName('');
    setNewOutfitPrompt('');
    setNewOutfitCategory(outfitCategories[0]?.id || 'ROYAL');
    setShowAddOutfit(false);
    setExpandedCategories({ [newOutfitCategory]: true });
    showToast(`'${newOutfit.name}' 의상이 ${newOutfitCategory} 카테고리에 추가되었습니다.`, 'success');
  }, [newOutfitName, newOutfitPrompt, newOutfitCategory, outfits, outfitCategories, saveOutfitsToBE]);

  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => (prev[categoryId] ? {} : { [categoryId]: true }));
  }, []);

  // UNIFIED_OUTFIT_LIST에서 카테고리별 의상 가져오기
  const getBaseOutfitsByCategory = useMemo(() => {
    const categoryMap: Record<string, BaseOutfitItem[]> = {};
    outfitCategories.forEach(cat => {
      categoryMap[cat.id] = (UNIFIED_OUTFIT_LIST as BaseOutfitItem[]).filter(
        item => item.categories.includes(cat.id)
      );
    });
    return categoryMap;
  }, [outfitCategories]);

  const getOutfitsByCategory = useCallback((categoryId: string) => {
    const userOutfits = outfits.filter(outfit => outfit.category === categoryId);
    return userOutfits;
  }, [outfits]);

  const getCategoryCount = useCallback((categoryId: string) => {
    const baseCount = getBaseOutfitsByCategory[categoryId]?.length || 0;
    const userCount = outfits.filter(o => o.category === categoryId).length;
    return baseCount + userCount;
  }, [getBaseOutfitsByCategory, outfits]);

  const handleDeleteOutfit = useCallback((id: string) => {
    const updated = outfits.filter(o => o.id !== id);
    setOutfits(updated);
    saveOutfitsToBE(updated, outfitCategories);
    if (selectedOutfitId === id) {
      setSelectedOutfitId(null);
      onOutfitSelect?.(null);
    }
  }, [outfits, selectedOutfitId, onOutfitSelect, outfitCategories, saveOutfitsToBE]);

  const handleSelectOutfit = useCallback((outfit: Outfit) => {
    setSelectedOutfitId(outfit.id);
    setSelectedBaseOutfitId(null);
    onOutfitSelect?.(outfit);
  }, [onOutfitSelect]);

  // 기본 의상 선택 핸들러 (프롬프트 포함)
  const handleSelectBaseOutfit = useCallback((item: BaseOutfitItem) => {
    setSelectedBaseOutfitId(item.id);
    setSelectedOutfitId(null);
    
    // Outfit 형태로 변환하여 콜백 호출
    const outfitData: Outfit = {
      id: item.id,
      name: item.translation || item.name,
      prompt: item.prompt || item.name, // prompt가 없으면 name 사용
      category: item.categories[0] || 'ROYAL',
      createdAt: ''
    };
    
    onOutfitSelect?.(outfitData);
    showToast(`'${item.translation}' 의상이 선택되었습니다.`, 'success');
  }, [onOutfitSelect]);

  const handleSaveCharacter = useCallback(() => {
    if (!newCharacter.name.trim()) return;

    const character: Character = {
      id: `char-${Date.now()}`,
      ...newCharacter,
      createdAt: new Date().toISOString()
    };

    const updated = [...characters, character];
    setCharacters(updated);
    saveCharactersToBE(updated);
    setNewCharacter({
      name: '',
      age: '30대',
      gender: 'female',
      face: '',
      hair: '',
      body: ''
    });
    setActiveTab('select');
    showToast(`${character.name} 캐릭터가 저장되었습니다.`, 'success');
  }, [newCharacter, characters]);

  const handleReExtractFace = useCallback(() => {
    if (lastFaceImageData) {
      handleExtractFace(null, lastFaceImageData);
    } else {
      showToast('재분석할 이미지가 없습니다. 이미지를 다시 업로드해주세요.', 'warning');
    }
  }, [lastFaceImageData, handleExtractFace]);

  const handleReExtractOutfit = useCallback(() => {
    if (lastOutfitImageData) {
      handleExtractOutfit(null, lastOutfitImageData);
    } else {
      showToast('재분석할 이미지가 없습니다. 이미지를 다시 업로드해주세요.', 'warning');
    }
  }, [lastOutfitImageData, handleExtractOutfit]);

  const handleReExtractHair = useCallback(() => {
    if (lastHairImageData) {
      handleExtractHair(null, lastHairImageData);
    } else {
      showToast('재분석할 이미지가 없습니다. 이미지를 다시 업로드해주세요.', 'warning');
    }
  }, [lastHairImageData, handleExtractHair]);

  const handleReExtractBody = useCallback(() => {
    if (lastBodyImageData) {
      handleExtractBody(null, lastBodyImageData);
    } else {
      showToast('재분석할 이미지가 없습니다. 이미지를 다시 업로드해주세요.', 'warning');
    }
  }, [lastBodyImageData, handleExtractBody]);

  // ---------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative">
      {/* 탭 헤더 */}
      <div className="flex bg-slate-800/50 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('select')}
          className={`flex-1 px-3 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'select'
            ? 'bg-purple-600 text-white shadow-inner'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
        >
          <Users size={14} />
          캐릭터선택
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex-1 px-3 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'manage'
            ? 'bg-purple-600 text-white shadow-inner'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
        >
          <User size={14} />
          캐릭터관리
        </button>
        <button
          onClick={() => setActiveTab('outfit')}
          className={`flex-1 px-3 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'outfit'
            ? 'bg-purple-600 text-white shadow-inner'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
            }`}
        >
          <Shirt size={14} />
          의상추출
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-purple-500" />
          </div>
        )}

        {/* 캐릭터선택 탭 */}
        {activeTab === 'select' && (
          <div className="space-y-4">
            <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-700/50">
              <div className="text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-wider">슬롯 할당</div>
              <div className="grid grid-cols-2 gap-2">
                {SLOT_OPTIONS.map(slot => (
                  <button
                    key={slot.id}
                    className={`p-2.5 rounded-lg text-xs font-bold border transition-all ${selectedSlot === slot.id
                      ? 'border-purple-500 bg-purple-600/20 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                      : 'border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                      }`}
                  >
                    {slot.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">저장된 캐릭터</div>
              {characters.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
                  <User size={32} className="mb-2 opacity-20" />
                  <p className="text-xs">저장된 캐릭터가 없습니다.</p>
                  <p className="text-[10px] mt-1">캐릭터관리 탭에서 새로 만들어보세요!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {characters.map(char => (
                    <div
                      key={char.id}
                      onClick={() => {
                        setSelectedCharacterId(char.id);
                        onCharacterSelect?.(char, selectedSlot);
                      }}
                      className={`group p-3 rounded-xl border cursor-pointer transition-all ${selectedCharacterId === char.id
                        ? 'border-purple-500 bg-purple-600/10 shadow-lg'
                        : 'border-slate-800 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-slate-200 group-hover:text-purple-300 transition-colors">{char.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{char.age} · {char.gender === 'female' ? '여성' : '남성'}</div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${selectedCharacterId === char.id ? 'bg-purple-500 animate-pulse' : 'bg-slate-700'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 캐릭터관리 탭 */}
        {activeTab === 'manage' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 기본 정보 */}
            <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 space-y-3">
              <input
                type="text"
                placeholder="캐릭터 이름 (예: 지영, 철수)"
                value={newCharacter.name}
                onChange={e => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
              />
              <div className="flex gap-2">
                <select
                  value={newCharacter.age}
                  onChange={e => setNewCharacter(prev => ({ ...prev, age: e.target.value }))}
                  className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  {['20대', '30대', '40대', '50대', '60대'].map(age => <option key={age} value={age}>{age}</option>)}
                </select>
                <select
                  value={newCharacter.gender}
                  onChange={e => setNewCharacter(prev => ({ ...prev, gender: e.target.value as 'female' | 'male' }))}
                  className="flex-1 px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <option value="female">여성</option>
                  <option value="male">남성</option>
                </select>
              </div>
            </div>

            {/* 서브탭 */}
            <div className="flex p-1 bg-slate-900/50 rounded-lg border border-slate-800">
              {(['face', 'hair', 'body'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setManageSubTab(tab)}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${manageSubTab === tab
                    ? 'bg-slate-700 text-purple-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {tab === 'face' ? '얼굴' : tab === 'hair' ? '헤어' : '체형'}
                </button>
              ))}
            </div>

            {/* 서브탭 콘텐츠 */}
            <div className="min-h-[160px] space-y-3">
              {manageSubTab === 'face' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <label
                    className={`flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${isDraggingFace
                      ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
                      : 'border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5'
                      }`}
                    onDragOver={(e) => handleDragOver(e, 'face')}
                    onDragLeave={(e) => handleDragLeave(e, 'face')}
                    onDrop={(e) => handleDrop(e, 'face')}
                  >
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleExtractFace(file);
                      e.target.value = '';  // ← 추가
                    }} />
                    {isExtractingFace ? (
                      <>
                        <Loader2 size={24} className="text-purple-400 animate-spin mb-2" />
                        <span className="text-[11px] font-bold text-purple-400">특징 분석 중...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={24} className={`${isDraggingFace ? 'text-purple-400 animate-bounce' : 'text-slate-600 group-hover:text-purple-400'} mb-2 transition-colors`} />
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300">
                          {isDraggingFace ? '여기에 놓으세요!' : '얼굴 사진 드래그 또는 클릭'}
                        </span>
                      </>
                    )}
                  </label>

                  {extractedFace && (
                    <div className="p-3 bg-purple-950/20 border border-purple-800/50 rounded-xl space-y-2 animate-in zoom-in-95 duration-300">
                      <div className="flex items-start gap-3">
                        {generatedFaceImage && (
                          <img
                            src={generatedFaceImage}
                            alt="Generated Face"
                            className="w-16 h-16 rounded-lg object-cover border border-purple-500/30 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                            onClick={() => setLightboxImage(generatedFaceImage)}
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="text-[10px] font-bold text-purple-400 mb-1">✨ 분석 결과 (한글 수정 시 자동 번역)</div>
                          <div>
                            <label className="text-[9px] text-purple-300 mb-0.5 block flex items-center gap-1">
                              한글 설명 (수정하면 영문 자동 번역)
                              {isTranslatingFace && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                            </label>
                            <textarea
                              value={extractedFace.ko}
                              onChange={e => handleFaceKoChange(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900/80 border border-purple-700/50 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none h-14"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-purple-300 mb-0.5 block">영문 프롬프트 (자동 생성)</label>
                            <textarea
                              value={extractedFace.en}
                              onChange={e => setExtractedFace(prev => prev ? { ...prev, en: e.target.value } : null)}
                              className="w-full px-2 py-1.5 bg-slate-900/80 border border-purple-700/50 rounded-lg text-[10px] text-slate-400 placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none h-16 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleGenerateCharacterImage(extractedFace.en, 'face')}
                          disabled={isGeneratingImage}
                          className="flex-1 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} 이미지 생성
                        </button>
                        <button
                          onClick={() => handleForwardPromptToImageAI(extractedFace.en, 'face')}
                          disabled={!!aiForwardingType && aiForwardingType !== 'face'}
                          className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {aiForwardingType === 'face' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} AI 생성
                        </button>
                        <button
                          onClick={handleReExtractFace}
                          disabled={isExtractingFace}
                          className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
                          title="다시 분석"
                        >
                          {isExtractingFace ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    placeholder="얼굴 특징 직접 입력 (영어 권장)"
                    value={newCharacter.face}
                    onChange={e => setNewCharacter(prev => ({ ...prev, face: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 placeholder-slate-600 focus:ring-2 focus:ring-purple-500/50 outline-none resize-none h-24 transition-all"
                  />
                </div>
              )}

              {manageSubTab === 'hair' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <label
                    className={`flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${isDraggingHair
                      ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
                      : 'border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5'
                      }`}
                    onDragOver={(e) => handleDragOver(e, 'hair')}
                    onDragLeave={(e) => handleDragLeave(e, 'hair')}
                    onDrop={(e) => handleDrop(e, 'hair')}
                  >
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleExtractHair(file);
                      e.target.value = '';
                    }} />
                    {isExtractingHair ? (
                      <>
                        <Loader2 size={24} className="text-purple-400 animate-spin mb-2" />
                        <span className="text-[11px] font-bold text-purple-400">헤어 분석 중...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={24} className={`${isDraggingHair ? 'text-purple-400 animate-bounce' : 'text-slate-600 group-hover:text-purple-400'} mb-2 transition-colors`} />
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300">
                          {isDraggingHair ? '여기에 놓으세요!' : '헤어 사진 드래그 또는 클릭'}
                        </span>
                      </>
                    )}
                  </label>

                  {extractedHair && (
                    <div className="p-3 bg-purple-950/20 border border-purple-800/50 rounded-xl space-y-2 animate-in zoom-in-95 duration-300">
                      <div className="flex items-start gap-3">
                        {generatedHairImage && (
                          <img
                            src={generatedHairImage}
                            alt="Generated Hair"
                            className="w-16 h-16 rounded-lg object-cover border border-purple-500/30 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                            onClick={() => setLightboxImage(generatedHairImage)}
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="text-[10px] font-bold text-purple-400 mb-1">✨ 분석 결과 (한글 수정 시 자동 번역)</div>
                          <div>
                            <label className="text-[9px] text-purple-300 mb-0.5 block flex items-center gap-1">
                              한글 설명 (수정하면 영문 자동 번역)
                              {isTranslatingHair && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                            </label>
                            <textarea
                              value={extractedHair.ko}
                              onChange={e => handleHairKoChange(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900/80 border border-purple-700/50 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none h-14"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-purple-300 mb-0.5 block">영문 프롬프트 (자동 생성)</label>
                            <textarea
                              value={extractedHair.en}
                              onChange={e => setExtractedHair(prev => prev ? { ...prev, en: e.target.value } : null)}
                              className="w-full px-2 py-1.5 bg-slate-900/80 border border-purple-700/50 rounded-lg text-[10px] text-slate-400 placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none h-16 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleGenerateCharacterImage(extractedHair.en, 'hair')}
                          disabled={isGeneratingImage}
                          className="flex-1 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} 이미지 생성
                        </button>
                        <button
                          onClick={() => handleForwardPromptToImageAI(extractedHair.en, 'hair')}
                          disabled={!!aiForwardingType && aiForwardingType !== 'hair'}
                          className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {aiForwardingType === 'hair' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} AI 생성
                        </button>
                        <button
                          onClick={handleReExtractHair}
                          disabled={isExtractingHair}
                          className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
                          title="다시 분석"
                        >
                          {isExtractingHair ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {HAIR_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setNewCharacter(prev => ({ ...prev, hair: preset.prompt }));
                          setExtractedHair(prev => (prev ? { ...prev, en: preset.prompt } : prev));
                        }}
                        className={`px-3 py-2 text-[10px] font-bold rounded-lg border transition-all ${newCharacter.hair === preset.prompt
                          ? 'border-purple-500 bg-purple-600/20 text-purple-300 shadow-sm'
                          : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="헤어스타일 상세 정보"
                    value={newCharacter.hair}
                    onChange={e => setNewCharacter(prev => ({ ...prev, hair: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 outline-none focus:ring-2 focus:ring-purple-500/50 resize-none h-20 transition-all"
                  />
                </div>
              )}

              {manageSubTab === 'body' && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <label
                    className={`flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${isDraggingBody
                      ? 'border-purple-400 bg-purple-500/10 scale-[1.02]'
                      : 'border-slate-700 hover:border-purple-500/50 hover:bg-purple-500/5'
                      }`}
                    onDragOver={(e) => handleDragOver(e, 'body')}
                    onDragLeave={(e) => handleDragLeave(e, 'body')}
                    onDrop={(e) => handleDrop(e, 'body')}
                  >
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleExtractBody(file);
                      e.target.value = '';
                    }} />
                    {isExtractingBody ? (
                      <>
                        <Loader2 size={24} className="text-purple-400 animate-spin mb-2" />
                        <span className="text-[11px] font-bold text-purple-400">체형 분석 중...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={24} className={`${isDraggingBody ? 'text-purple-400 animate-bounce' : 'text-slate-600 group-hover:text-purple-400'} mb-2 transition-colors`} />
                        <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300">
                          {isDraggingBody ? '여기에 놓으세요!' : '체형 사진 드래그 또는 클릭'}
                        </span>
                      </>
                    )}
                  </label>

                  {extractedBody && (
                    <div className="p-3 bg-purple-950/20 border border-purple-800/50 rounded-xl space-y-2 animate-in zoom-in-95 duration-300">
                      <div className="flex items-start gap-3">
                        {generatedBodyImage && (
                          <img
                            src={generatedBodyImage}
                            alt="Generated Body"
                            className="w-16 h-16 rounded-lg object-cover border border-purple-500/30 cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all"
                            onClick={() => setLightboxImage(generatedBodyImage)}
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="text-[10px] font-bold text-purple-400 mb-1">✨ 분석 결과 (한글 수정 시 자동 번역)</div>
                          <div>
                            <label className="text-[9px] text-purple-300 mb-0.5 block flex items-center gap-1">
                              한글 설명 (수정하면 영문 자동 번역)
                              {isTranslatingBody && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
                            </label>
                            <textarea
                              value={extractedBody.ko}
                              onChange={e => handleBodyKoChange(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-900/80 border border-purple-700/50 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none h-14"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-purple-300 mb-0.5 block">영문 프롬프트 (자동 생성)</label>
                            <textarea
                              value={extractedBody.en}
                              onChange={e => setExtractedBody(prev => prev ? { ...prev, en: e.target.value } : null)}
                              className="w-full px-2 py-1.5 bg-slate-900/80 border border-purple-700/50 rounded-lg text-[10px] text-slate-400 placeholder-slate-600 focus:ring-1 focus:ring-purple-500/50 outline-none resize-none h-16 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleGenerateCharacterImage(extractedBody.en, 'body')}
                          disabled={isGeneratingImage}
                          className="flex-1 py-1.5 bg-purple-600/90 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} 이미지 생성
                        </button>
                        <button
                          onClick={() => handleForwardPromptToImageAI(extractedBody.en, 'body')}
                          disabled={!!aiForwardingType && aiForwardingType !== 'body'}
                          className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {aiForwardingType === 'body' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} AI 생성
                        </button>
                        <button
                          onClick={handleReExtractBody}
                          disabled={isExtractingBody}
                          className="p-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all disabled:opacity-50"
                          title="다시 분석"
                        >
                          {isExtractingBody ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {BODY_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setNewCharacter(prev => ({ ...prev, body: preset.prompt }));
                          setExtractedBody(prev => (prev ? { ...prev, en: preset.prompt } : prev));
                        }}
                        className={`px-3 py-2 text-[10px] font-bold rounded-lg border transition-all ${newCharacter.body === preset.prompt
                          ? 'border-purple-500 bg-purple-600/20 text-purple-300 shadow-sm'
                          : 'border-slate-800 bg-slate-800/50 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                          }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="체형/포즈 상세 정보"
                    value={newCharacter.body}
                    onChange={e => setNewCharacter(prev => ({ ...prev, body: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 outline-none focus:ring-2 focus:ring-purple-500/50 resize-none h-20 transition-all"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSaveCharacter}
              disabled={!newCharacter.name.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white text-sm font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Save size={16} />
              새 캐릭터 저장
            </button>
          </div>
        )}

        {/* 의상추출 탭 */}
        {activeTab === 'outfit' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* 의상 추출 영역 */}
            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">AI 의상 추출</div>
              <label
                className={`flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all group ${isDraggingOutfit
                  ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02]'
                  : 'border-slate-700 hover:border-emerald-500/50 hover:bg-emerald-500/5'
                  }`}
                onDragOver={(e) => handleDragOver(e, 'outfit')}
                onDragLeave={(e) => handleDragLeave(e, 'outfit')}
                onDrop={(e) => handleDrop(e, 'outfit')}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleExtractOutfit(file);
                    e.target.value = '';  // ← 추가
                  }}
                />
                {isExtracting ? (
                  <>
                    <Loader2 size={32} className="text-emerald-500 animate-spin mb-2" />
                    <span className="text-[11px] font-bold text-emerald-400">이미지 분석 중...</span>
                  </>
                ) : (
                  <>
                    <Shirt size={32} className={`${isDraggingOutfit ? 'text-emerald-400 animate-bounce' : 'text-slate-600 group-hover:text-emerald-400'} mb-2 transition-colors`} />
                    <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300">
                      {isDraggingOutfit ? '여기에 놓으세요!' : '의상 사진 드래그 또는 클릭'}
                    </span>
                  </>
                )}
              </label>

              {extractedOutfit && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/50 rounded-xl space-y-2 animate-in zoom-in-95 duration-300">
                  <div className="flex items-start gap-3">
                    {generatedOutfitImage && (
                      <img
                        src={generatedOutfitImage}
                        alt="Generated Outfit"
                        className="w-20 h-20 rounded-lg object-cover border border-emerald-500/30 cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                        onClick={() => setLightboxImage(generatedOutfitImage)}
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="text-[10px] font-bold text-emerald-400">✨ 분석 결과 (한글 수정 시 자동 번역)</div>
                      {/* 의상 이름 수정 */}
                      <div>
                        <label className="text-[9px] text-emerald-300 mb-0.5 block">👗 의상 이름</label>
                        <input
                          type="text"
                          value={extractedOutfit.name}
                          onChange={e => setExtractedOutfit(prev => prev ? { ...prev, name: e.target.value } : null)}
                          className="w-full px-2 py-1.5 bg-slate-900/80 border border-emerald-700/50 rounded-lg text-sm font-bold text-emerald-300 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500/50 outline-none"
                        />
                      </div>
                      {/* 한글 설명 수정 */}
                      <div>
                        <label className="text-[9px] text-emerald-300 mb-0.5 block flex items-center gap-1">
                          한글 설명 (수정하면 영문 자동 번역)
                          {isTranslatingOutfit && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                        </label>
                        <textarea
                          value={extractedOutfit.ko}
                          onChange={e => handleOutfitKoChange(e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-900/80 border border-emerald-700/50 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500/50 outline-none resize-none h-14"
                        />
                      </div>
                      {/* 영문 프롬프트 수정 */}
                      <div>
                        <label className="text-[9px] text-emerald-300 mb-0.5 block">영문 프롬프트 (자동 생성)</label>
                        <textarea
                          value={extractedOutfit.en}
                          onChange={e => setExtractedOutfit(prev => prev ? { ...prev, en: e.target.value } : null)}
                          className="w-full px-2 py-1.5 bg-slate-900/80 border border-emerald-700/50 rounded-lg text-[10px] text-slate-400 placeholder-slate-600 focus:ring-1 focus:ring-emerald-500/50 outline-none resize-none h-20 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleGenerateCharacterImage(extractedOutfit.en, 'outfit')}
                      disabled={isGeneratingImage}
                      className="flex-1 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />} 이미지 생성
                    </button>
                    <button
                      onClick={() => handleForwardPromptToImageAI(extractedOutfit.en, 'outfit')}
                      disabled={!!aiForwardingType && aiForwardingType !== 'outfit'}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {aiForwardingType === 'outfit' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />} AI 생성
                    </button>
                    <button
                      onClick={() => handleCopyPrompt(extractedOutfit.en, 'extracted')}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                      title="프롬프트 복사"
                    >
                      {copiedPromptId === 'extracted' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={handleReExtractOutfit}
                      disabled={isExtracting}
                      className="p-2 bg-purple-600/90 hover:bg-purple-500 text-white rounded-lg transition-all disabled:opacity-50"
                      title="AI 재분석"
                    >
                      {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      // 한글 이름과 영문 프롬프트 모두 설정
                      setNewOutfitName(extractedOutfit.name || '추출된 의상');
                      setNewOutfitPrompt(extractedOutfit.en);
                      setShowAddOutfit(true);
                      setExtractedOutfit(null);
                      setGeneratedOutfitImage(null);
                    }}
                    className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold rounded-lg transition-all shadow-md mt-1"
                  >
                    리스트에 추가하기
                  </button>
                </div>
              )}
            </div>

            {/* 의상 리스트 - 카테고리별 드롭다운 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📋 의상 라이브러리</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-lg transition-all"
                  >
                    카테고리 추가
                  </button>
                  <button
                    onClick={() => setShowAddOutfit(true)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {showAddCategory && (
                <div className="p-3 bg-slate-800 border border-emerald-500/30 rounded-xl space-y-3 shadow-xl animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400">새 카테고리 추가</span>
                    <button onClick={() => setShowAddCategory(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                  </div>

                  <input
                    type="text"
                    placeholder="카테고리 이름 (예: 캐주얼, 정장)"
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                  />

                  <div className="flex gap-2">
                    <select
                      value={newCategoryGender}
                      onChange={e => setNewCategoryGender(e.target.value as OutfitCategory['gender'])}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                    >
                      <option value="female">여성용</option>
                      <option value="male">남성용</option>
                      <option value="unisex">공용</option>
                    </select>
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCategoryName.trim()}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-bold rounded-lg transition-all"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {editingCategoryId && (
                <div className="p-3 bg-slate-800 border border-amber-500/30 rounded-xl space-y-3 shadow-xl animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-400">카테고리 수정</span>
                    <button onClick={() => setEditingCategoryId(null)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                  </div>

                  <input
                    type="text"
                    placeholder="카테고리 이름"
                    value={editingCategoryName}
                    onChange={e => setEditingCategoryName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                  />

                  <div className="flex gap-2">
                    <select
                      value={editingCategoryGender}
                      onChange={e => setEditingCategoryGender(e.target.value as OutfitCategory['gender'])}
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                    >
                      <option value="female">여성용</option>
                      <option value="male">남성용</option>
                      <option value="unisex">공용</option>
                    </select>
                    <button
                      onClick={handleUpdateCategory}
                      disabled={!editingCategoryName.trim()}
                      className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-bold rounded-lg transition-all"
                    >
                      수정
                    </button>
                  </div>
                </div>
              )}

              {/* 추가 폼 */}
              {showAddOutfit && (
                <div className="p-3 bg-slate-800 border border-purple-500/30 rounded-xl space-y-3 shadow-xl animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-400">새 의상 정보</span>
                    <button onClick={() => setShowAddOutfit(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500">저장할 카테고리</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {outfitCategories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setNewOutfitCategory(cat.id)}
                          className={`px-2 py-1.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1.5 ${
                            newOutfitCategory === cat.id
                              ? 'border-purple-500 bg-purple-600/20 text-purple-300'
                              : 'border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-600'
                          }`}
                        >
                          <span>{cat.emoji}</span>
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="의상 이름 (한글, 예: 블랙 튜브탑 + 데님 쇼츠)"
                    value={newOutfitName}
                    onChange={e => setNewOutfitName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                  />
                  <textarea
                    placeholder="의상 프롬프트 (영어, 이미지 생성에 사용됨)"
                    value={newOutfitPrompt}
                    onChange={e => setNewOutfitPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-300 outline-none resize-none h-20"
                  />
                  <button
                    onClick={handleAddOutfit}
                    disabled={!newOutfitName.trim() || !newOutfitPrompt.trim()}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[11px] font-bold rounded-lg transition-all shadow-md"
                  >
                    {outfitCategories.find(c => c.id === newOutfitCategory)?.emoji} {newOutfitCategory}에 저장하기
                  </button>
                </div>
              )}

              {/* 카테고리별 드롭다운 목록 */}
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {outfitCategories.map(category => {
                  const baseOutfits = getBaseOutfitsByCategory[category.id] || [];
                  const userOutfits = getOutfitsByCategory(category.id);
                  const totalCount = getCategoryCount(category.id);
                  const isExpanded = expandedCategories[category.id];

                  return (
                    <div key={category.id} className="border border-slate-800 rounded-xl overflow-hidden">
                      {/* 카테고리 헤더 */}
                      <div
                        className={`w-full flex items-center justify-between p-3 transition-all ${
                          isExpanded
                            ? 'bg-slate-800/80 border-b border-slate-700'
                            : 'bg-slate-800/40 hover:bg-slate-800/60'
                        }`}
                      >
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <span className="text-base">{category.emoji}</span>
                          <span className="text-xs font-bold text-slate-300">{category.name}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded-full font-bold">
                            {totalCount}
                          </span>
                          {userOutfits.length > 0 && (
                            <span className="text-[9px] text-purple-400">+{userOutfits.length} 추가됨</span>
                          )}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditCategory(category)}
                            className="p-1 text-slate-500 hover:text-amber-300 transition-colors"
                            title="카테고리 수정"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={DEFAULT_CATEGORY_IDS.has(category.id)}
                            className="p-1 text-slate-500 hover:text-red-300 transition-colors disabled:opacity-40 disabled:hover:text-slate-500"
                            title={DEFAULT_CATEGORY_IDS.has(category.id) ? '기본 카테고리는 삭제할 수 없습니다.' : '카테고리 삭제'}
                          >
                            <Trash2 size={12} />
                          </button>
                          <ChevronDown
                            size={16}
                            className={`text-slate-500 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* 카테고리 내 의상 목록 */}
                      {isExpanded && (
                        <div className="bg-slate-900/50 max-h-[300px] overflow-y-auto custom-scrollbar">
                          {/* 사용자 정의 의상 (삭제 가능) */}
                          {userOutfits.length > 0 && (
                            <div className="border-b border-purple-500/20">
                              <div className="px-2.5 py-1.5 bg-purple-900/20 text-[9px] font-bold text-purple-400">
                                ✨ 사용자 추가 ({userOutfits.length})
                              </div>
                              {userOutfits.map(outfit => (
                                <div
                                  key={outfit.id}
                                  onClick={() => handleSelectOutfit(outfit)}
                                  className={`group flex items-center gap-2 p-2 cursor-pointer transition-all ${
                                    selectedOutfitId === outfit.id
                                      ? 'bg-emerald-500/10'
                                      : 'hover:bg-slate-800/50'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                    selectedOutfitId === outfit.id
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-purple-800 text-purple-400'
                                  }`}>
                                    <Shirt size={10} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-[10px] font-bold truncate ${
                                      selectedOutfitId === outfit.id
                                        ? 'text-emerald-400'
                                        : 'text-slate-300'
                                    }`}>
                                      {outfit.name}
                                    </div>
                                    {/* 프롬프트 미리보기 */}
                                    <div className="text-[9px] text-slate-500 truncate mt-0.5">
                                      {outfit.prompt.substring(0, 50)}...
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyPrompt(outfit.prompt, outfit.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-emerald-400 transition-all flex-shrink-0"
                                    title="프롬프트 복사"
                                  >
                                    {copiedPromptId === outfit.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOutfit(outfit.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-red-400 transition-all flex-shrink-0"
                                    title="삭제"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 기본 의상 (선택 가능, 프롬프트 포함) */}
                          <div className="divide-y divide-slate-800/30">
                            <div className="px-2.5 py-1.5 bg-slate-800/30 text-[9px] font-bold text-slate-500">
                              📦 기본 의상 ({baseOutfits.length})
                            </div>
                            {baseOutfits.map(item => (
                              <div
                                key={item.id}
                                onClick={() => handleSelectBaseOutfit(item)}
                                className={`group flex items-center gap-2 p-2 cursor-pointer transition-all ${
                                  selectedBaseOutfitId === item.id
                                    ? 'bg-emerald-500/10'
                                    : 'hover:bg-slate-800/30'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                                  selectedBaseOutfitId === item.id
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-800 text-slate-600'
                                }`}>
                                  <Shirt size={10} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-[10px] truncate ${
                                    selectedBaseOutfitId === item.id
                                      ? 'text-emerald-400 font-bold'
                                      : 'text-slate-400'
                                  }`}>
                                    {item.translation || item.name}
                                  </div>
                                  {/* 프롬프트 미리보기 (있는 경우) */}
                                  {item.prompt && (
                                    <div className="text-[9px] text-slate-600 truncate mt-0.5">
                                      {item.prompt.substring(0, 40)}...
                                    </div>
                                  )}
                                </div>
                                {item.prompt && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyPrompt(item.prompt!, item.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-emerald-400 transition-all flex-shrink-0"
                                    title="프롬프트 복사"
                                  >
                                    {copiedPromptId === item.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <Lightbox
          imageUrl={lightboxImage}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};

export default CharacterPanel;

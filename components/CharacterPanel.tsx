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

import React, { useState, useEffect, useCallback } from 'react';
import { User, Users, Shirt, Plus, Trash2, Upload, Sparkles, Save, ChevronDown, X, Loader2 } from 'lucide-react';
import { showToast } from './Toast';

import { generateImage } from './master-studio/services/geminiService';
import { Bot, Image as ImageIcon, RefreshCw } from 'lucide-react';

// ============================================
// 타입 정의
// ============================================

interface Character {
  id: string;
  name: string;
  age: string;
  gender: 'female' | 'male';
  face: string;
  hair: string;
  body: string;
  createdAt: string;
}

interface Outfit {
  id: string;
  name: string;
  prompt: string;
  category: string;
  createdAt: string;
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
  { id: 'petite-glamour', name: '아담 글래머', prompt: 'petite but glamorous figure with confident stance' },
  { id: 'athletic', name: '건강미 탄탄', prompt: 'fit athletic build with broad shoulders' },
  { id: 'curvy', name: '볼륨 글래머', prompt: 'voluptuous hourglass figure with elegant curves' },
];

const DEFAULT_OUTFITS: Outfit[] = [
  { id: 'outfit-001', name: '골프웨어', prompt: 'wearing professional golf attire, polo shirt, pleated skirt', category: '스포츠', createdAt: '' },
  { id: 'outfit-002', name: '비즈니스 정장', prompt: 'wearing a sharp business suit, tailored blazer', category: '정장', createdAt: '' },
  { id: 'outfit-003', name: 'K-드라마 리얼톤', prompt: 'wearing modern K-drama style outfit', category: '캐주얼', createdAt: '' },
  { id: 'outfit-004', name: '캐주얼', prompt: 'wearing casual everyday clothes', category: '캐주얼', createdAt: '' },
];

const SLOT_OPTIONS = [
  { id: 'woman-a', name: 'Woman A', gender: 'female' as const },
  { id: 'woman-b', name: 'Woman B', gender: 'female' as const },
  { id: 'man-a', name: 'Man A', gender: 'male' as const },
  { id: 'man-b', name: 'Man B', gender: 'male' as const },
];

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
  const [isLoading, setIsLoading] = useState(false);

  // 선택 상태
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(null);

  // 의상 추가 상태
  const [showAddOutfit, setShowAddOutfit] = useState(false);
  const [newOutfitName, setNewOutfitName] = useState('');
  const [newOutfitPrompt, setNewOutfitPrompt] = useState('');

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
  const [extractedOutfit, setExtractedOutfit] = useState<{ en: string; ko: string } | null>(() => {
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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);


  // 드래그 앤 드롭 상태
  const [isDraggingFace, setIsDraggingFace] = useState(false);
  const [isDraggingOutfit, setIsDraggingOutfit] = useState(false);

  // 마지막 업로드 파일 저장 (재분석용)
  const [lastFaceFile, setLastFaceFile] = useState<File | null>(null);
  const [lastOutfitFile, setLastOutfitFile] = useState<File | null>(() => {
    // localStorage에서 base64 복원 시도
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lastOutfitImageData');
      if (saved) {
        // base64 데이터가 있으면 상태 표시용으로만 사용
        return null; // File 객체는 직렬화 불가, 별도 처리
      }
    }
    return null;
  });
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

  // ---------------------------------------------------------
  // 데이터 로드
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const charRes = await fetch('http://localhost:3002/api/characters');
        const charData = await charRes.json();
        if (charData.characters) setCharacters(charData.characters);

        const outfitRes = await fetch('http://localhost:3002/api/outfits');
        const outfitData = await outfitRes.json();
        if (outfitData.outfits && outfitData.outfits.length > 0) {
          setOutfits(outfitData.outfits);
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

  // ---------------------------------------------------------
  // 저장 헬퍼
  // ---------------------------------------------------------
  const saveOutfitsToBE = async (newOutfits: Outfit[]) => {
    try {
      await fetch('http://localhost:3002/api/outfits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outfits: newOutfits })
      });
    } catch (error) {
      console.error('의상 저장 실패:', error);
    }
  };

  const saveCharactersToBE = async (newChars: Character[]) => {
    try {
      await fetch('http://localhost:3002/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characters: newChars })
      });
    } catch (error) {
      console.error('캐릭터 저장 실패:', error);
    }
  };

  // ---------------------------------------------------------
  // 핸들러
  // ---------------------------------------------------------
  const handleExtractOutfit = async (file: File, imageData?: string) => {
    setIsExtracting(true);
    setExtractedOutfit(null);
    setGeneratedOutfitImage(null);

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

      // 재분석용으로 이미지 데이터 저장
      setLastOutfitFile(file);
      setLastOutfitImageData(base64Image);

      const response = await fetch('http://localhost:3002/api/extract-outfit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Image })
      });

      const result = await response.json();
      if (result.success && result.prompt) {
        // JSON 파싱된 결과 처리
        const promptData = typeof result.prompt === 'string'
          ? { en: result.prompt, ko: "분석된 의상입니다." }
          : result.prompt;

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
  };

  const handleExtractFace = async (file: File, imageData?: string) => {
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

      // 재분석용으로 이미지 데이터 저장
      setLastFaceFile(file);
      setLastFaceImageData(base64Image);

      const response = await fetch('http://localhost:3002/api/extract-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64Image })
      });

      const result = await response.json();
      if (result.success && result.prompt) {
        // JSON 파싱된 결과 처리
        const promptData = typeof result.prompt === 'string'
          ? { en: result.prompt, ko: "분석된 얼굴 특징입니다." }
          : result.prompt;

        setExtractedFace(promptData);
        setNewCharacter(prev => ({ ...prev, face: promptData.en })); // 영문 프롬프트 자동 입력
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
  };

  const handleGenerateCharacterImage = async (prompt: string, type: 'outfit' | 'face') => {
    if (isGeneratingImage) return;
    setIsGeneratingImage(true);

    try {
      // 1. 이미지 생성 (Imagen 모델 사용)
      const result: any = await generateImage(prompt, {
        aspectRatio: "1:1",
        model: "imagen-4.0-generate-001"  // 이미지 생성 전용 모델 명시
      });

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

      // 2. 이미지 저장 (Backend API)
      const saveResponse = await fetch('http://localhost:3002/api/save-character-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: `data:image/png;base64,${base64Image}`,
          prompt,
          type
        })
      });

      const saveResult = await saveResponse.json();
      if (saveResult.success) {
        const imageUrl = `http://localhost:3002${saveResult.url}`;
        if (type === 'outfit') setGeneratedOutfitImage(imageUrl);
        else setGeneratedFaceImage(imageUrl);
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
  };

  // ---------------------------------------------------------
  // 드래그 앤 드롭 핸들러 (안정화)
  // ---------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent, type: 'face' | 'outfit') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'face') setIsDraggingFace(true);
    else setIsDraggingOutfit(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, type: 'face' | 'outfit') => {
    e.preventDefault();
    e.stopPropagation();
    // relatedTarget이 자식 요소면 무시 (깜빡임 방지)
    const target = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && target.contains(relatedTarget)) return;

    if (type === 'face') setIsDraggingFace(false);
    else setIsDraggingOutfit(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, type: 'face' | 'outfit') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'face') setIsDraggingFace(false);
    else setIsDraggingOutfit(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) {
      showToast('파일을 찾을 수 없습니다.', 'error');
      return;
    }

    // 파일 크기 체크 (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast('10MB 이하 이미지만 업로드 가능합니다.', 'error');
      return;
    }

    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드 가능합니다.', 'error');
      return;
    }

    if (type === 'face') {
      handleExtractFace(file);
    } else {
      handleExtractOutfit(file);
    }
  }, []);

  const handleAddOutfit = () => {
    if (!newOutfitName.trim() || !newOutfitPrompt.trim()) return;

    const newOutfit: Outfit = {
      id: `outfit-${Date.now()}`,
      name: newOutfitName.trim(),
      prompt: newOutfitPrompt.trim(),
      category: '사용자 정의',
      createdAt: new Date().toISOString()
    };

    const updated = [...outfits, newOutfit];
    setOutfits(updated);
    saveOutfitsToBE(updated);
    setNewOutfitName('');
    setNewOutfitPrompt('');
    setShowAddOutfit(false);
    showToast(`'${newOutfit.name}' 의상이 추가되었습니다.`, 'success');
  };

  const handleDeleteOutfit = (id: string) => {
    const updated = outfits.filter(o => o.id !== id);
    setOutfits(updated);
    saveOutfitsToBE(updated);
    if (selectedOutfitId === id) {
      setSelectedOutfitId(null);
      onOutfitSelect?.(null);
    }
  };

  const handleSelectOutfit = (outfit: Outfit) => {
    setSelectedOutfitId(outfit.id);
    onOutfitSelect?.(outfit);
  };

  const handleSaveCharacter = () => {
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
  };

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

                  {/* 얼굴 분석 결과 및 이미지 생성 */}
                  {extractedFace && (
                    <div className="p-3 bg-purple-950/20 border border-purple-800/50 rounded-xl space-y-2 animate-in zoom-in-95 duration-300">
                      <div className="flex items-start gap-3">
                        {generatedFaceImage && (
                          <img src={generatedFaceImage} alt="Generated Face" className="w-16 h-16 rounded-lg object-cover border border-purple-500/30" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-purple-400 mb-1">✨ 분석 결과 (Korean)</div>
                          <div className="text-xs text-slate-200 leading-relaxed mb-1">{extractedFace.ko}</div>
                          <div className="text-[10px] text-slate-500 leading-relaxed italic truncate">{extractedFace.en}</div>
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
                          onClick={() => {
                            // AI 재분석 - 저장된 이미지로 다시 분석
                            if (lastFaceImageData) {
                              handleExtractFace(lastFaceFile!, lastFaceImageData);
                            } else {
                              showToast('재분석할 이미지가 없습니다. 이미지를 다시 업로드해주세요.', 'warning');
                            }
                          }}
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
                  <div className="grid grid-cols-2 gap-2">
                    {HAIR_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setNewCharacter(prev => ({ ...prev, hair: preset.prompt }))}
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
                  <div className="grid grid-cols-2 gap-2">
                    {BODY_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setNewCharacter(prev => ({ ...prev, body: preset.prompt }))}
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
                      <img src={generatedOutfitImage} alt="Generated Outfit" className="w-20 h-20 rounded-lg object-cover border border-emerald-500/30" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-bold text-emerald-400 mb-1">✨ 추출 결과 (Korean)</div>
                      <div className="text-xs text-slate-200 leading-relaxed mb-1">{extractedOutfit.ko}</div>
                      <div className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-2">{extractedOutfit.en}</div>
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
                      onClick={() => {
                        // AI 재분석 - 저장된 이미지로 다시 분석
                        if (lastOutfitImageData) {
                          handleExtractOutfit(lastOutfitFile!, lastOutfitImageData);
                        } else {
                          showToast('재분석할 이미지가 없습니다. 이미지를 다시 업로드해주세요.', 'warning');
                        }
                      }}
                      disabled={isExtracting}
                      className="p-2 bg-purple-600/90 hover:bg-purple-500 text-white rounded-lg transition-all disabled:opacity-50"
                      title="AI 재분석"
                    >
                      {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                    </button>
                  </div>

                  <button
                    onClick={() => {
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

            {/* 의상 리스트 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">📋 의상 라이브러리</div>
                <button
                  onClick={() => setShowAddOutfit(true)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg transition-all"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* 추가 폼 */}
              {showAddOutfit && (
                <div className="p-3 bg-slate-800 border border-purple-500/30 rounded-xl space-y-3 shadow-xl animate-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-400">새 의상 정보</span>
                    <button onClick={() => setShowAddOutfit(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                  </div>
                  <input
                    type="text"
                    placeholder="의상 이름 (예: 테니스복)"
                    value={newOutfitName}
                    onChange={e => setNewOutfitName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                  />
                  <textarea
                    placeholder="의상 프롬프트 (영어)"
                    value={newOutfitPrompt}
                    onChange={e => setNewOutfitPrompt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-[11px] text-slate-300 outline-none resize-none h-16"
                  />
                  <button
                    onClick={handleAddOutfit}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg transition-all shadow-md"
                  >
                    저장하기
                  </button>
                </div>
              )}

              {/* 목록 */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {outfits.map(outfit => (
                  <div
                    key={outfit.id}
                    onClick={() => handleSelectOutfit(outfit)}
                    className={`group relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedOutfitId === outfit.id
                      ? 'border-emerald-500 bg-emerald-500/5 shadow-lg'
                      : 'border-slate-800 bg-slate-800/20 hover:border-slate-700 hover:bg-slate-800/40'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedOutfitId === outfit.id ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600'}`}>
                      <Shirt size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">{outfit.name}</div>
                      <div className="text-[10px] text-slate-600 truncate mt-0.5 italic">{outfit.prompt}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOutfit(outfit.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterPanel;

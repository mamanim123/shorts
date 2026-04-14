const fs = require('fs');

const code = `import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  LayoutGrid, FileText, Mic2, Users, Image as ImageIcon, Sparkles, 
  Settings, Download, Search, Video, Music, Scissors, Type, 
  ChevronRight, Play, Plus, Trash2, Check, ExternalLink, Info, Bell, Sun, User,
  ChevronLeft, MessageSquare, Volume2, FastForward, Sliders, Edit2, Loader2, X, Camera, Wand2, Star,
  Zap, RefreshCw, Bot, Clock
} from 'lucide-react';

// 기존 로직 서비스 및 컴포넌트 가져오기
import { initGeminiService, generateImageWithImagen, generateMultiSpeakerAudio } from './master-studio/services/geminiService';
import { generateTrendingStorylines, generateStory } from '../services/geminiService';
import { buildLabScriptPrompt } from '../services/labPromptBuilder';
import { parseJsonFromText } from '../services/jsonParse';
import { showToast } from './Toast';
import { generateSRT, generateCapCutXML, downloadFile } from '../services/exportService';
import { pcmToWavBlob } from './master-studio/services/audioUtils';
import { v4 as uuidv4 } from 'uuid';

// 이미지 퓨전 엔진 가져오기
import SlimAiStudioFusionApp from '../../ai-studio/components/SlimAiStudioFusionApp';

const VOICES = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir'];
const DELIVERIES = [
  'Say naturally:', 'Say cheerfully:', 'Say calmly:', 'Say excitedly:', 
  'Say sadly:', 'Say angrily:', 'Whispering:', 'Announce dramatically:'
];

type Step = 'status-board' | 'project-list' | 'style' | 'script' | 'tts' | 'character' | 'media' | 'fusion' | 'thumbnail' | 'edit' | 'seo' | 'export' | 'tubeflow';
type ScriptPhase = 'input' | 'storylines' | 'editor';

const TubeFactoryPanel: React.FC = () => {
  // 1. 상태 관리 (Step & UI)
  const [activeStep, setActiveStep] = useState<Step>('status-board');
  const [scriptPhase, setScriptPhase] = useState<ScriptPhase>('input');
  const [activeSubStep, setActiveSubStep] = useState<'manual' | 'auto'>('auto');
  
  // 2. 대본 관련 데이터
  const [topic, setTopic] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('실사풍');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storylines, setStorylines] = useState<{title: string, content: string}[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [sceneComposition, setSceneComposition] = useState<'auto'|'1-sentence'|'2-sentence'|'custom'>('auto');
  const [customSentenceCount, setCustomSentenceCount] = useState<number>(4);
  const [isAutoMode, setIsAutoMode] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // SEO 및 내보내기 상태
  const [seoData, setSeoData] = useState<{title: string, tags: string, description: string} | null>(null);

  // 프로젝트 히스토리 데이터
  const [projects, setProjects] = useState<{folderName: string, imageCount: number}[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true);
    try {
      const res = await fetch('http://localhost:3001/api/scripts/story-folders');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
         const altRes = await fetch('http://localhost:3002/api/scripts/story-folders');
         if (altRes.ok) {
            const data = await altRes.json();
            setProjects(data);
         }
      }
    } catch (err) {
      console.error('프로젝트 목록 로드 실패:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    if (activeStep === 'project-list') {
      fetchProjects();
    }
  }, [activeStep, fetchProjects]);

  const loadProject = async (folderName: string) => {
    setIsGenerating(true);
    showToast(\`'\${folderName}' 프로젝트를 불러오는 중...\`, 'info');
    try {
      let imgRes = await fetch(\`http://localhost:3001/api/images/by-story/\${encodeURIComponent(folderName)}\`);
      if (!imgRes.ok) {
         imgRes = await fetch(\`http://localhost:3002/api/images/by-story/\${encodeURIComponent(folderName)}\`);
      }
      const images = imgRes.ok ? await imgRes.json() : [];
      
      if (images.length > 0) {
        setScenes(images.map((img: any, i: number) => ({
          id: i + 1,
          scriptLine: img.prompt || '불러온 장면',
          imageUrl: \`http://localhost:3001/generated_scripts/\${img.filename}\`,
          isImageGenerating: false,
          longPrompt: img.prompt
        })));
        setTopic(folderName);
        setScriptPhase('editor');
        setActiveStep('media');
        showToast('프로젝트 로드 완료!', 'success');
      } else {
        showToast('프로젝트에 생성된 데이터가 없습니다.', 'info');
      }
    } catch (err) {
      showToast('프로젝트 로드 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSeo = async () => {
    if (scenes.length === 0) {
      showToast('대본이 없습니다.', 'error');
      return;
    }
    setIsGenerating(true);
    showToast('SEO 데이터를 분석 중입니다...', 'info');
    try {
      const fullText = scenes.map(s => s.scriptLine).join('\\n');
      const prompt = \`Analyze the following script and generate a viral YouTube Title, Tags, and Description.
      Script:
      \${fullText}
      
      Format (JSON):
      {
        "title": "Viral Title",
        "tags": "#tag1 #tag2 #tag3",
        "description": "SEO optimized description..."
      }\`;
      
      const response = await initGeminiService().models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsed = parseJsonFromText(text);
      setSeoData(parsed);
      showToast('SEO 최적화 완료!', 'success');
    } catch (err) {
      console.error(err);
      showToast('SEO 생성 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const [subtitleStyle, setSubtitleStyle] = useState({ fontSize: 40, color: '#ffffff', outlineColor: '#000000', bold: true });

  const handleAnalyzeScript = async () => {
    if (!topic.trim()) {
      showToast('분석할 대본 주제나 내용을 입력하세요.', 'error');
      return;
    }
    setIsGenerating(true);
    showToast('대본의 구조와 흐름을 분석 중입니다...', 'info');
    try {
      const prompt = \`Analyze this script/topic for a short-form video (60s).
      Topic: \${topic}
      Provide:
      1. Hook effectiveness
      2. Pacing suggestions
      3. Key visual suggestions
      Format (JSON):
      { "hook": "...", "pacing": "...", "visual": "..." }\`;
      
      const response = await initGeminiService().models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ parts: [{ text: prompt }] }]
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const analysis = parseJsonFromText(text);
      showToast('분석 완료: ' + analysis.hook.substring(0, 30) + '...', 'success');
    } catch (err) {
      showToast('대본 분석 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVariation = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isImageGenerating: true } : s));
    showToast(\`\${sceneId}번 장면의 다른 버전을 생성합니다...\`, 'info');
    try {
      let finalPrompt = (scene.longPrompt || scene.shortPrompt || scene.text) + ', different perspective, alternative composition';
      const imageUrl = await generateImageWithImagen(finalPrompt);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageUrl, isImageGenerating: false } : s));
      showToast('새로운 버전 생성 완료', 'success');
    } catch (e) {
      showToast('변주 생성 실패', 'error');
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isImageGenerating: false } : s));
    }
  };

  const handleExport = (type: 'srt' | 'capcut') => {
    if (scenes.length === 0) {
      showToast('내보낼 데이터가 없습니다.', 'error');
      return;
    }
    const fileName = topic || 'shorts_project';
    try {
      if (type === 'srt') {
        const srt = generateSRT(scenes);
        downloadFile(srt, \`\${fileName}.srt\`);
        showToast('SRT 자막 파일이 다운로드되었습니다.', 'success');
      } else {
        const xml = generateCapCutXML(scenes, topic);
        downloadFile(xml, \`\${fileName}.xml\`);
        showToast('CapCut XML 파일이 다운로드되었습니다.', 'success');
      }
    } catch (err) {
      showToast('내보내기 실패', 'error');
    }
  };

  const handleUpdateCharacter = (id: string, field: string, value: string) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const [imageEffect, setImageEffect] = useState('none');
  const IMAGE_EFFECTS = [
    { id: 'none', label: '기본 (None)', prompt: '' },
    { id: 'vintage', label: '빈티지 (Vintage)', prompt: ', vintage film look, low saturation, grainy' },
    { id: 'noir', label: '누아르 (Noir)', prompt: ', dramatic noir, black and white, high contrast' },
    { id: 'cyberpunk', label: '사이버펑크 (Cyber)', prompt: ', cyberpunk neon lighting, futuristic colors' },
    { id: 'watercolor', label: '수채화 (Watercolor)', prompt: ', watercolor illustration, soft brush strokes' }
  ];


  
  // 3. 캐릭터 일관성 데이터 (Character Design)
  const [characters, setCharacters] = useState<any[]>([
    { id: 'WomanA', slotId: 'Woman A', name: '수아', hair: 'long soft-wave', body: 'slim hourglass', outfit: 'casual chic', active: true },
    { id: 'ManA', slotId: 'Man A', name: '준혁', hair: 'short neat', body: 'athletic', outfit: 'business suit', active: true }
  ]);

  // 4. TTS 및 이미지 생성 상태
  const [selectedTtsEngine, setSelectedTtsEngine] = useState('Gemini 2.5 TTS');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [sceneAudioUrls, setSceneAudioUrls] = useState<Record<number, string>>({});
  const [ttsLoadingMap, setTtsLoadingMap] = useState<Record<number, boolean>>({});
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [selectedDelivery, setSelectedDelivery] = useState(DELIVERIES[0]);
  const [audioHistory, setAudioHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('shorts-lab-audio-history');
    return saved ? JSON.parse(saved) : [];
  });
  const [favoriteVoices, setFavoriteVoices] = useState<any[]>(() => {
    const saved = localStorage.getItem('shorts-lab-favorite-voices');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('shorts-lab-audio-history', JSON.stringify(audioHistory));
  }, [audioHistory]);

  useEffect(() => {
    localStorage.setItem('shorts-lab-favorite-voices', JSON.stringify(favoriteVoices));
  }, [favoriteVoices]);


  // 사이드바 메뉴 아이템 정의 (한글화 및 메뉴 추가)
  const menuItems: { id: Step; label: string; icon: React.ReactNode; group: string }[] = [
    { id: 'status-board', label: '작업 현황판', icon: <Bot size={18} />,     group: '시스템' },
    { id: 'project-list', label: '프로젝트 목록', icon: <LayoutGrid size={18} />, group: '관리' },
    { id: 'style',        label: '영상 스타일',   icon: <Sparkles size={18} />,   group: '기획' },
    { id: 'script',       label: '대본 생성',     icon: <FileText size={18} />,   group: '기획' },
    { id: 'tts',          label: 'TTS 음성',     icon: <Mic2 size={18} />,       group: '음성' },
    { id: 'character',    label: '캐릭터 설정',   icon: <Users size={18} />,      group: '제작' },
    { id: 'media',        label: '이미지/영상',   icon: <ImageIcon size={18} />, group: '제작' },
    { id: 'fusion',       label: '이미지 퓨전',   icon: <Sparkles size={18} />,   group: '제작' },
    { id: 'thumbnail',    label: '썸네일 제작',   icon: <ImageIcon size={18} />,   group: '제작' },
    { id: 'edit',         label: '타임라인 편집', icon: <Scissors size={18} />,   group: '편집' },
    { id: 'seo',          label: 'SEO/메타데이터', icon: <Search size={18} />,     group: '완성' },
    { id: 'export',       label: '내보내기',     icon: <Download size={18} />,   group: '완성' },
    { id: 'tubeflow',     label: '튜브플로우',     icon: <Zap size={18} />,       group: '도구' },
  ];


  // ============================================
  // [로직] 1. AI 줄거리 및 대본 생성
  // ============================================
  const handleGenerateStorylines = async () => {
    if (!topic.trim()) {
      showToast('주제를 입력해주세요.', 'error');
      return;
    }
    setIsGenerating(true);
    
    try {
      initGeminiService();
      const items = await generateTrendingStorylines(topic, 6);
      setStorylines(items);
      setScriptPhase('storylines');
      setIsGenerating(false);
      showToast('AI가 바이럴 될 만한 줄거리들을 생성했습니다.', 'success');
    } catch (err) {
      showToast('AI 연결에 실패했습니다.', 'error');
      setIsGenerating(false);
    }
  };

  const handleConfirmStoryline = async (index: number) => {
    setSelectedStoryIndex(index);
    setIsGenerating(true);
    showToast('AI가 대본을 작성하고 장면을 추출합니다...', 'info');
    
    try {
      const selectedStory = storylines[index] || { title: topic, content: topic };
      let compositionPrompt = '';
      if (sceneComposition === '1-sentence') compositionPrompt = '반드시 1개의 문장마다 1개의 씬(Scene)을 분리하여 구성할 것.';
      else if (sceneComposition === '2-sentence') compositionPrompt = '반드시 2개의 문장을 묶어서 1개의 씬(Scene)으로 분리할 것.';
      else if (sceneComposition === 'custom') compositionPrompt = \`반드시 \${customSentenceCount}개의 문장을 묶어서 1개의 씬(Scene)으로 분리할 것.\`;
      
      const customContext = \`[제작 요구사항]\\n\${compositionPrompt}\\n[줄거리]\\n\${selectedStory.title}\\n\${selectedStory.content}\`;
      
      const response = await generateStory({
        engineVersion: 'V3_COSTAR' as any,
        category: 'short',
        scenarioMode: 'default' as any,
        dialect: 'standard' as any,
        targetService: 'GEMINI',
        customContext,
        targetAge: '20대'
      });
      
      let parsedLines: string[] = [];
      if (response && response.scriptBody) {
        parsedLines = response.scriptBody.split('\\n').map((l: string) => l.trim()).filter((l: string) => l !== '');
      }

      if (response && response.scenes && response.scenes.length > 0) {
        setScenes(response.scenes.map((s: any, i: number) => {
          let fallbackText = s.scriptLine || s.text || '';
          if (!fallbackText && parsedLines.length > 0) {
            const chunkCount = Math.max(1, Math.round(parsedLines.length / response.scenes.length));
            const startIdx = i * chunkCount;
            const endIdx = Math.min(startIdx + chunkCount, parsedLines.length);
            fallbackText = parsedLines.slice(startIdx, endIdx).join(' ');
          }
          return {
            ...s,
            id: i + 1,
            scriptLine: fallbackText,
            shortPrompt: s.shortPrompt || s.text || '',
            longPrompt: s.longPrompt || s.shortPrompt || s.text || ''
          };
        }));
        setScriptPhase('editor');
        showToast('대본 생성이 완료되었습니다.', 'success');
      } else if (parsedLines.length > 0) {
        setScenes(parsedLines.map((line: string, i: number) => ({
          id: i + 1,
          scriptLine: line,
          text: line,
          shortPrompt: line,
          longPrompt: line,
          imageUrl: '',
          isImageGenerating: false
        })));
        setScriptPhase('editor');
        showToast('대본 생성이 완료되었습니다. (자동 씬 분리)', 'success');
      } else {
        throw new Error("No scenes generated");
      }
    } catch (err) {
      console.error(err);
      showToast('대본 생성에 실패했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================================
  // [로직] 2. 실제 이미지 생성 연동 (Imagen 3)
  // ============================================
  const handleGenerateImage = async (sceneId: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isImageGenerating: true } : s));
    
    try {
      let finalPrompt = scene.longPrompt || scene.shortPrompt || scene.text;
      
      // 스타일 반영
      if (selectedStyle && selectedStyle !== '실사풍' && selectedStyle !== '전체') {
        finalPrompt += ', in ' + selectedStyle + ' style';
      }

      // 효과(Effect) 반영
      const targetEffect = IMAGE_EFFECTS.find(e => e.id === imageEffect);
      if (targetEffect && targetEffect.prompt) {
        finalPrompt += targetEffect.prompt;
      }

      finalPrompt += ', 8k resolution, masterpiece';

      const imageUrl = await generateImageWithImagen(finalPrompt);
      
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, imageUrl, isImageGenerating: false } : s));
      showToast(\`\${sceneId}번 장면 이미지 생성 완료\`, 'success');
    } catch (error) {

      showToast('이미지 생성에 실패했습니다.', 'error');
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, isImageGenerating: false } : s));
    }
  };

  const handleBatchImageGenerate = async () => {
    if (scenes.length === 0) return;
    showToast('모든 장면의 이미지 생성을 시작합니다.', 'info');
    
    for (const scene of scenes) {
      if (!scene.imageUrl) {
        await handleGenerateImage(scene.id);
      }
    }
    showToast('모든 이미지가 생성되었습니다.', 'success');
  };

  // ============================================
  // [로직] 3. TTS 음성 생성
  // ============================================
  const handleGenerateSingleSceneTts = async (index: number) => {
    const scene = scenes[index];
    if (!scene || !scene.scriptLine) {
      showToast('대본 내용이 없습니다.', 'error');
      return;
    }

    setTtsLoadingMap(prev => ({ ...prev, [index]: true }));

    try {
      const speakers: any = [
        { 
          name: 'Speaker', 
          voice: selectedVoice, 
          delivery: selectedDelivery.includes('at') ? selectedDelivery : \`\${selectedDelivery} at \${ttsSpeed}x speed:\`, 
          dialogue: scene.scriptLine 
        },
        { name: 'Dummy', voice: 'Puck', delivery: '', dialogue: '' }
      ];

      const response = await generateMultiSpeakerAudio(speakers);
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        const wavBlob = pcmToWavBlob(base64Audio);
        const audioUrl = URL.createObjectURL(wavBlob);
        
        setSceneAudioUrls(prev => ({ ...prev, [index]: audioUrl }));
        
        // 히스토리에 추가
        const newHistoryItem = {
          id: uuidv4(),
          sceneId: index + 1,
          voice: selectedVoice,
          delivery: selectedDelivery,
          text: scene.scriptLine,
          timestamp: new Date().toISOString(),
          audioUrl
        };
        setAudioHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
        
        showToast(\`Scene \${index + 1} 음성 생성 완료!\`, 'success');
      } else {
        throw new Error('음성 데이터가 없습니다.');
      }
    } catch (err) {
      console.error(err);
      showToast(\`Scene \${index + 1} 음성 생성 실패\`, 'error');
    } finally {
      setTtsLoadingMap(prev => ({ ...prev, [index]: false }));
    }
  };

  const handlePreviewTts = async () => {
    setIsGenerating(true);
    showToast('미리듣기 생성 중...', 'info');
    try {
      const testText = "안녕하세요, 튜브팩토리의 최고 성능 음성 엔진입니다. 마음에 드시나요?";
      const speakers: any = [
        { 
          name: 'Preview', 
          voice: selectedVoice, 
          delivery: selectedDelivery, 
          dialogue: testText 
        },
        { name: 'Dummy', voice: 'Puck', delivery: '', dialogue: '' }
      ];
      const response = await generateMultiSpeakerAudio(speakers);
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (base64Audio) {
        const wavBlob = pcmToWavBlob(base64Audio);
        const audioUrl = URL.createObjectURL(wavBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        showToast('미리듣기 재생 시작', 'success');
      }
    } catch (err) {
      showToast('미리듣기 생성 실패', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleFavoriteVoice = () => {
    const exists = favoriteVoices.find(f => f.voice === selectedVoice && f.delivery === selectedDelivery);
    if (exists) {
      setFavoriteVoices(prev => prev.filter(f => !(f.voice === selectedVoice && f.delivery === selectedDelivery)));
      showToast('즐겨찾기에서 제거되었습니다.', 'info');
    } else {
      setFavoriteVoices(prev => [...prev, { voice: selectedVoice, delivery: selectedDelivery }]);
      showToast('즐겨찾기에 추가되었습니다!', 'success');
    }
  };

  const handleGenerateAllTts = async () => {
    if (scenes.length === 0) {
      showToast('생성할 씬이 없습니다.', 'error');
      return;
    }

    setIsGenerating(true);
    setBatchProgress({ current: 0, total: scenes.length });

    try {
      for (let i = 0; i < scenes.length; i++) {
        setBatchProgress(prev => ({ ...prev, current: i + 1 }));
        await handleGenerateSingleSceneTts(i);
      }
      showToast('전체 씬 음성 생성이 완료되었습니다!', 'success');
    } catch (err) {
      showToast('일부 음성 생성 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================================
  // [UI] 메인 콘텐츠 렌더링
  // ============================================
  const renderContent = () => {
    switch (activeStep) {
      case 'status-board':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center border-b border-white/5 pb-6">
              <div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase flex items-center gap-3">
                  <Bot className="text-lime-400" size={32} />
                  WORK STATUS BOARD
                </h2>
                <p className="text-slate-500 text-sm mt-1">Tube Factory 100% 복제 진행 상황 및 작업 내역</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-lime-500/10 border border-lime-500/20 px-4 py-2 rounded-xl">
                  <span className="text-[10px] text-lime-400 font-black uppercase block">전체 진행률</span>
                  <span className="text-xl font-black text-white">42%</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: '기본 시스템', progress: 100, items: ['3001 포트 통일', '서버-클라이언트 연동', '로그인/인증 뼈대'] },
                { title: '데이터 스토리지', progress: 90, items: ['app-storage API 구현', '프로젝트 히스토리 로드', 'JSON 대본 저장 (진행중)'] },
                { title: '이미지 퓨전 (핵심)', progress: 30, items: ['퓨전 생성 엔진 이식', '이미지 수정 도구', '프롬프트 분석기'] },
                { title: '대본/AI 엔진', progress: 60, items: ['Gemini 2.0 Flash 연동', 'Co-Star 프롬프트 빌더', '멀티 시나리오 생성'] },
                { title: 'TTS/음성 시스템', progress: 70, items: ['멀티 스피커 생성', '음성 속도/톤 조절', '즐겨찾기 보관함'] },
                { title: '타임라인/편집', progress: 15, items: ['장면 나열 UI', '자막 스타일링 (미구현)', '타임라인 프리뷰 (미구현)'] },
              ].map((group, i) => (
                <div key={i} className="bg-[#111a24] border border-white/5 p-6 rounded-[32px] space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white">{group.title}</h3>
                    <span className="text-xs font-black text-lime-400">{group.progress}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-lime-500 h-full transition-all duration-1000" style={{ width: \`\${group.progress}%\` }}></div>
                  </div>
                  <ul className="space-y-2">
                    {group.items.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-slate-400">
                        <div className={\`w-1 h-1 rounded-full \${item.includes('진행중') ? 'bg-yellow-500 animate-pulse' : item.includes('미구현') ? 'bg-slate-700' : 'bg-lime-500'}\`}></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="bg-[#111a24] border border-white/5 rounded-[32px] overflow-hidden">
              <div className="bg-white/5 px-8 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-widest">최근 작업 로그</h3>
                <span className="text-[10px] text-slate-500">Real-time Activity</span>
              </div>
              <div className="p-8 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                {[
                  { time: '방금 전', log: 'TubeFactoryPanel UI 한글화 및 메뉴 구조 재편성 완료' },
                  { time: '1분 전', log: '프로젝트 히스토리(저장된 폴더) 로드 기능 이식 성공' },
                  { time: '5분 전', log: 'standalone-lite 서버 내 app-storage API 핸들러 추가' },
                  { time: '10분 전', log: '메인 포트 3001번 통일 및 배치 파일(.bat) 전수 수정' },
                ].map((log, i) => (
                  <div key={i} className="flex gap-4 text-xs">
                    <span className="text-slate-600 shrink-0 w-16">{log.time}</span>
                    <span className="text-slate-300 font-medium">{log.log}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'project-list':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">Library</h2>
                <p className="text-slate-500 text-sm mt-1">작업했던 모든 대본과 이미지 폴더를 확인하세요.</p>
              </div>
              <button onClick={() => setActiveStep('style')} className="bg-lime-500 text-black px-8 py-3 rounded-2xl font-black hover:bg-lime-400 transition-all flex items-center gap-2 shadow-xl shadow-lime-500/20">
                <Plus size={20} /> 새 프로젝트 시작
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
               {isLoadingProjects ? (
                 <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                    <Loader2 className="animate-spin text-lime-400" size={40} />
                    <p className="font-bold text-xs uppercase tracking-widest">저장된 데이터를 찾는 중...</p>
                 </div>
               ) : (
                 <>
                   {projects.map((proj, i) => (
                      <div key={i} className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col justify-between h-[240px] relative overflow-hidden group hover:border-lime-500/30 hover:scale-[1.02] transition-all cursor-pointer" onClick={() => loadProject(proj.folderName)}>
                         <LayoutGrid size={80} className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity" />
                         <div>
                           <div className="text-[10px] text-lime-400 font-black mb-2 uppercase tracking-[0.2em]">Stored Folder</div>
                           <h3 className="text-xl font-black text-white group-hover:text-lime-400 transition-colors line-clamp-2">{proj.folderName}</h3>
                           <p className="text-xs text-slate-500 mt-2">{proj.imageCount} Images Generated</p>
                         </div>
                         <div className="flex gap-2">
                            <button className="bg-white/5 px-6 py-2.5 rounded-xl text-[11px] font-black group-hover:bg-lime-500 group-hover:text-black transition-all">이어서 작업하기</button>
                            <button className="bg-white/5 px-6 py-2.5 rounded-xl text-[11px] font-black text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all" onClick={(e) => {
                              e.stopPropagation();
                            }}>삭제</button>
                         </div>
                      </div>
                   ))}
                   
                   {projects.length === 0 && (
                     <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-[40px] flex flex-col items-center justify-center space-y-4">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center text-slate-700">
                           <LayoutGrid size={32} />
                        </div>
                        <p className="text-slate-500 font-bold text-sm">아직 저장된 프로젝트가 없습니다.</p>
                     </div>
                   )}
                 </>
               )}
            </div>
          </div>
        );

      case 'style':
        return (
          <div className="p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1400px] mx-auto">
            <div className="bg-[#112a20] border border-lime-500/20 text-lime-400 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-bold w-full mx-auto shadow-lg shadow-lime-500/5">
              <div className="flex items-center gap-2">
                <span className="bg-lime-500 text-black px-2 py-0.5 rounded uppercase text-[10px] font-black">공지</span>
                플래티넘 모든 기능사용가능 , 체험등급은 골드멤버십 등급 적용됩니다. 튜브플로우는 무료 다운로드 가능합니다.
              </div>
              <X size={14} className="cursor-pointer text-lime-500/60 hover:text-lime-400" />
            </div>

            <div className="flex flex-col space-y-2 mt-4 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2">영상 스타일 <Info size={16} className="text-slate-500 cursor-pointer"/></h2>
                <span className="text-xs text-slate-500 ml-2 border border-slate-600 px-2 py-0.5 rounded px-2">이용방법</span>
              </div>
              <p className="text-slate-400 text-sm">영상의 전체적인 비주얼 스타일을 선택하세요. 대본 생성과 이미지 생성에 모두 반영된다.</p>
            </div>

            <div className="bg-[#111a22] border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-20 h-14 bg-slate-800 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                  <ImageIcon className="text-slate-500" />
                </div>
                <div>
                  <h3 className="text-lime-400 font-bold text-sm mb-1">{selectedStyle}</h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1 max-w-xl">photorealistic, ultra realistic, natural skin texture...</p>
                </div>
              </div>
              <button onClick={() => setActiveStep('script')} className="bg-lime-500/10 border border-lime-500 text-lime-400 px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-lime-500 hover:text-black transition-all">
                다음 단계 <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 py-2 border-y border-white/5 my-6">
              {['전체', '나만의 스타일', '고정캐릭터', '만화/카툰', '웹툰', '3D', '무협', '원본 애니', '레트로/픽셀', '코믹/팝아트', '스케치/드로잉', '빈티지', '기타'].map((tag, i) => (
                <button key={tag} className={\`px-4 py-1.5 rounded-full text-xs font-bold transition-colors \${i === 0 ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30' : 'bg-white/5 text-slate-400 hover:text-white border border-transparent hover:border-white/10'}\`}>
                  {tag} {tag === '고정캐릭터' && <span className="ml-1 bg-purple-600 text-white px-1.5 py-0.5 rounded text-[9px]">3</span>}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-10">
              {[
                {name: '한국웹툰', img: ''},
                {name: '실사풍', img: ''},
                {name: '픽사 스타일', img: ''},
                {name: '3D 게임 트레일러', img: ''},
                {name: '졸라맨', badge: '고정캐릭터 1명', img: ''},
                {name: '해골 스타일', badge: '고정캐릭터 1명', img: ''},
                {name: '일본 애니 스타일', img: ''},
                {name: '클레이', img: ''},
                {name: '틸트시프트 미니어처', img: ''},
                {name: '무협', img: ''}
              ].map((style, i) => (
                <div 
                  key={style.name} 
                  onClick={() => setSelectedStyle(style.name)}
                  className={\`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all aspect-[4/3] bg-slate-900 \${
                    selectedStyle === style.name ? 'border-lime-500 ring-4 ring-lime-500/20 scale-[1.02] shadow-2xl shadow-lime-500/10' : 'border-white/5 hover:border-white/20'
                  }\`}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0d131f]">
                    <ImageIcon size={32} className="text-white/5" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10" />
                  <div className="absolute bottom-3 left-4 right-4 z-20">
                    <h3 className="font-bold text-sm text-white group-hover:text-lime-400 transition-colors uppercase">{style.name}</h3>
                    {style.badge && <span className="text-[8px] bg-purple-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block uppercase font-black">{style.badge}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'script':
        if (scriptPhase === 'input') {
          return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-20">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold">대본 생성</h2>
                <Info size={16} className="text-slate-500 cursor-pointer" />
                <span className="text-xs text-slate-500 ml-2 border border-slate-600 px-2 py-0.5 rounded">이용방법</span>
              </div>
              
              <div className="flex bg-[#111827] rounded-2xl p-1 border border-white/5">
                <button 
                  onClick={() => setIsAutoMode(false)}
                  className={\`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all \${!isAutoMode ? 'bg-lime-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}\`}
                >
                  <span className="text-lg">✍️</span> 자유작성
                </button>
                <button 
                  onClick={() => setIsAutoMode(true)}
                  className={\`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all \${isAutoMode ? 'bg-lime-500 text-black shadow-lg' : 'text-slate-400 hover:text-white'}\`}
                >
                  <span className="text-lg">🤖</span> 자동작성
                </button>
              </div>

              <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
                <h3 className="font-bold mb-1 text-slate-200">기본 언어</h3>
                <div className="flex gap-2">
                  {['한국어', '영어', '일본어'].map(lang => (
                    <button key={lang} className={\`bg-white/5 border border-white/5 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors \${lang === '한국어' ? 'bg-lime-500/10 border-lime-500 text-lime-400' : ''}\`}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#111a22] border border-white/5 rounded-[24px] p-6 space-y-4">
                <h3 className="font-bold mb-1 text-slate-200">씬 구성 방식</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    {id: 'auto', label: '자동씬구성', desc: 'AI가 자동으로 씬을 나눕니다.'},
                    {id: '1-sentence', label: '1문장당 1씬', desc: '문장 하나를 하나의 씬으로 고정.'},
                    {id: '2-sentence', label: '2문장당 1씬', desc: '문장 두 개씩 묶어 씬 구성.'},
                    {id: 'custom', label: '직접입력', desc: '원하는 문장 수만큼 묶음.'}
                  ].map(compo => (
                    <div key={compo.id} onClick={() => setSceneComposition(compo.id as any)} className={\`p-4 rounded-xl cursor-pointer transition-all \${sceneComposition === compo.id ? 'border border-lime-500 bg-lime-500/5' : 'border border-white/5 bg-white/5 hover:border-white/20'}\`}>
                      <div className="font-bold mb-2 text-sm">{compo.label}</div>
                      <p className="text-[10px] text-slate-400">{compo.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <h3 className="font-bold text-xl text-slate-200">자유 작성</h3>
                <div className="bg-[#151a24] border border-white/5 rounded-[32px] p-8 space-y-6 shadow-2xl relative">
                  <textarea 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="제작하고 싶은 영상의 주제나 아이디어를 자유롭게 입력하세요."
                    className="w-full h-40 bg-[#0a0f16] border border-white/5 rounded-2xl p-6 text-sm outline-none focus:border-lime-500/50 transition-all resize-none shadow-inner text-slate-300"
                  />
                  <div className="flex justify-center gap-4">
                    <button 
                      onClick={handleAnalyzeScript}
                      disabled={isGenerating}
                      className="bg-sky-500/10 border border-sky-500 text-sky-400 px-8 py-3.5 rounded-xl font-bold hover:bg-sky-500 hover:text-black transition-all"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" /> : '대본 분석'}
                    </button>
                    <button 
                      onClick={handleGenerateStorylines}
                      disabled={isGenerating}
                      className="bg-lime-500 text-black px-12 py-3.5 rounded-xl font-black text-[15px] hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20 w-48 flex justify-center items-center"
                    >
                      {isGenerating ? <Loader2 className="animate-spin" /> : '줄거리 생성'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (scriptPhase === 'storylines') {
          return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
              <h2 className="text-2xl font-bold">줄거리 선택 <span className="text-sm font-normal text-slate-500 ml-2">({storylines.length}개)</span></h2>
              <div className="grid grid-cols-2 gap-6">
                {storylines.map((story, i) => (
                  <div key={i} onClick={() => handleConfirmStoryline(i)} className="bg-[#0a0f16] border border-white/5 p-8 rounded-[24px] hover:border-lime-500/50 cursor-pointer transition-all flex flex-col justify-between group h-full">
                    <h3 className="text-xl font-bold mb-4 text-white group-hover:text-lime-400 transition-colors leading-relaxed">{story.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed text-justify">{story.content}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        } else {
          return (
            <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">대본 편집</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/40 text-sky-400 hover:bg-sky-500 hover:text-black px-4 py-2 rounded-xl text-xs font-bold transition-all">
                    불러오기 (JSON)
                  </button>
                  <button onClick={() => setScriptPhase('storylines')} className="flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">
                    다시 선택
                  </button>
                </div>
              </div>

              {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                  <div className="bg-[#0d1520] border border-white/10 rounded-3xl p-8 w-full max-w-2xl">
                    <h3 className="text-lg font-black text-white mb-4">대본 JSON 불러오기</h3>
                    <textarea 
                      value={importJsonText} 
                      onChange={e => setImportJsonText(e.target.value)}
                      className="w-full h-64 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs font-mono text-slate-300 outline-none"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                      <button onClick={() => setShowImportModal(false)} className="px-5 py-2 rounded-xl bg-white/5 text-slate-400 font-bold text-sm">취소</button>
                      <button onClick={() => {
                        try {
                          const parsed = JSON.parse(importJsonText);
                          if (parsed.scenes) setScenes(parsed.scenes.map((s:any, i:number) => ({ ...s, id: i+1, scriptLine: s.scriptLine || s.text || '' })));
                          setShowImportModal(false);
                          showToast('불러오기 성공', 'success');
                        } catch(e) { showToast('JSON 형식 오류', 'error'); }
                      }} className="px-5 py-2 rounded-xl bg-sky-500 text-black font-black text-sm">확인</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {scenes.map((scene, i) => (
                  <div key={i} className="flex gap-4 items-start bg-white/5 p-6 rounded-2xl border border-white/5 relative group">
                    <div className="bg-sky-500/20 text-sky-400 px-3 py-1 rounded-lg text-[10px] font-black shrink-0 uppercase">Scene {scene.id}</div>
                    <p className="text-sm text-slate-200 flex-1">{scene.scriptLine}</p>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleGenerateSingleSceneTts(i)} className="bg-lime-500/10 text-lime-400 p-2 rounded-lg hover:bg-lime-500/20">
                        {ttsLoadingMap[i] ? <Loader2 className="animate-spin" size={16}/> : <Volume2 size={16}/>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setActiveStep('tts')} className="bg-lime-500 text-black px-16 py-4 rounded-2xl font-black text-lg hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20">
                대본 확정 → TTS 음성으로
              </button>
            </div>
          );
        }

      case 'tts':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">TTS 및 음성 연동</h2>
                <p className="text-sm text-slate-400">Gemini 2.5 Flash 고성능 엔진으로 자연스러운 목소리를 생성합니다.</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleGenerateAllTts}
                  disabled={isGenerating}
                  className="bg-lime-500 text-black px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-lime-400 transition-all"
                >
                  {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18}/>}
                  전체 음성 생성 {isGenerating && \`(\${batchProgress.current}/\${batchProgress.total})\`}
                </button>
                <button onClick={() => setActiveStep('character')} className="bg-white/5 border border-white/10 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-white/10 transition-all">캐릭터 설정으로</button>
              </div>
            </div>

            <div className="flex gap-8 flex-1 min-h-0">
              {/* Settings Panel */}
              <div className="w-[400px] bg-[#111a24] border border-white/5 rounded-[32px] p-8 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center justify-between">
                    음성 엔진 및 설정
                    <button 
                      onClick={toggleFavoriteVoice}
                      className={\`p-2 rounded-lg transition-all \${favoriteVoices.find(f => f.voice === selectedVoice && f.delivery === selectedDelivery) ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-500 hover:text-white bg-white/5'}\`}
                    >
                      <Star size={16} fill={favoriteVoices.find(f => f.voice === selectedVoice && f.delivery === selectedDelivery) ? 'currentColor' : 'none'} />
                    </button>
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-[#0a0f16] border border-white/10 rounded-2xl p-4">
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Engine</div>
                      <div className="text-lime-400 font-bold text-sm">Gemini 2.0 Flash (Multi-Speaker)</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-2 px-1">Voice</div>
                      <select 
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full bg-[#0a0f16] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-lime-500"
                      >
                        {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-2 px-1">Style / Delivery</div>
                      <select 
                        value={selectedDelivery}
                        onChange={(e) => setSelectedDelivery(e.target.value)}
                        className="w-full bg-[#0a0f16] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-lime-500"
                      >
                        {DELIVERIES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black mb-2 px-1">
                        <span>Speed</span>
                        <span className="text-lime-400">{\`\${ttsSpeed}x\`}</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2.0" step="0.1" value={ttsSpeed} 
                        onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                        className="w-full accent-lime-500"
                      />
                    </div>
                    <button 
                      onClick={handlePreviewTts}
                      className="w-full bg-white/5 border border-white/10 text-slate-200 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                    >
                      <Volume2 size={16} /> 설정 미리듣기 (Preview)
                    </button>
                  </div>
                </div>

                {favoriteVoices.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">즐겨찾기 보관함</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {favoriteVoices.map((f, i) => (
                        <div 
                          key={i} 
                          onClick={() => { setSelectedVoice(f.voice); setSelectedDelivery(f.delivery); }}
                          className="bg-white/5 border border-white/5 p-3 rounded-xl cursor-pointer hover:border-lime-500/30 transition-all flex items-center justify-between group"
                        >
                          <div>
                            <div className="text-xs font-bold text-white">{f.voice}</div>
                            <div className="text-[10px] text-slate-500">{f.delivery}</div>
                          </div>
                          <Star size={12} className="text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Scene List Panel */}
              <div className="flex-1 bg-[#111a24] border border-white/5 rounded-[32px] p-8 flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-white uppercase tracking-widest text-sm">Scene Scripts & TTS Status</h3>
                  <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-slate-500 font-black">{scenes.length} SCENES</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-4">
                  {scenes.map((scene, i) => (
                    <div key={i} className={\`bg-[#0a0f16] border p-6 rounded-2xl flex flex-col gap-4 relative transition-all group \${sceneAudioUrls[i] ? 'border-lime-500/30' : 'border-white/5'}\`}>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-500 uppercase">Scene {i+1}</span>
                        {sceneAudioUrls[i] && <span className="text-[9px] text-lime-400 font-black flex items-center gap-1"><Check size={10}/> 음성 생성됨</span>}
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{scene.scriptLine}</p>
                      
                      <div className="flex items-center gap-3">
                        {sceneAudioUrls[i] && (
                          <audio src={sceneAudioUrls[i]} controls className="flex-1 h-8 opacity-60 hover:opacity-100 transition-opacity" />
                        )}
                        <button 
                          onClick={() => handleGenerateSingleSceneTts(i)}
                          disabled={ttsLoadingMap[i]}
                          className={\`px-4 py-2 rounded-xl text-[11px] font-black transition-all \${sceneAudioUrls[i] ? 'bg-white/5 text-slate-400 hover:text-white' : 'bg-lime-500 text-black hover:bg-lime-400'}\`}
                        >
                          {ttsLoadingMap[i] ? <Loader2 className="animate-spin" size={14}/> : (sceneAudioUrls[i] ? '다시 생성' : '음성 생성')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History Sidebar */}
              <div className="w-[300px] bg-[#0a0f16]/50 border-l border-white/5 p-6 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-6">
                  <Sliders size={18} className="text-lime-400" />
                  <h3 className="font-bold text-sm uppercase tracking-widest">History</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                  {audioHistory.map((item, i) => (
                    <div key={item.id} className="bg-white/5 p-4 rounded-2xl border border-transparent hover:border-white/10 transition-all space-y-2">
                      <div className="flex justify-between text-[10px] font-black">
                        <span className="text-lime-400">SCENE {item.sceneId}</span>
                        <span className="text-slate-600">{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-2 italic">"{item.text}"</div>
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                        <span className="text-[9px] text-slate-500">{item.voice} / {item.delivery.split(':')[0]}</span>
                        <button onClick={() => new Audio(item.audioUrl).play()} className="text-lime-400 hover:text-white"><Play size={14} /></button>
                      </div>
                    </div>
                  ))}
                  {audioHistory.length === 0 && (
                    <div className="text-center py-20 text-slate-600 text-xs">히스토리가 비어 있습니다.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        );

      case 'character':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-20">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">캐릭터 디자인 마스터</h2>
                <p className="text-slate-400 text-sm font-medium">등장 인물의 비주얼 DNA를 설정하여 영상 내내 일관된 모습을 유지합니다.</p>
              </div>
              <button onClick={() => setActiveStep('media')} className="bg-lime-500 text-black px-10 py-3 rounded-xl font-black hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20">
                제작 단계로 이동 <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {characters.map(char => (
                <div key={char.id} className="bg-[#111a24] border border-white/5 p-10 rounded-[48px] space-y-8 shadow-2xl relative group hover:border-lime-500/30 transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 bg-gradient-to-br from-lime-500 to-lime-600 rounded-[32px] flex items-center justify-center text-4xl font-black text-black shadow-lg shadow-lime-500/10">
                      {char.name[0]}
                    </div>
                    <div className="flex-1">
                      <input 
                        className="bg-transparent border-b border-white/5 focus:border-lime-400 text-2xl font-black text-white outline-none w-full"
                        value={char.name} onChange={e => handleUpdateCharacter(char.id, 'name', e.target.value)} 
                      />
                      <p className="text-xs text-lime-400/60 mt-2 font-black uppercase tracking-widest tracking-widest">Target Slot: {char.slotId}</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Visual Identity</label>
                      <input 
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm font-bold text-slate-200 outline-none focus:border-lime-500"
                        value={char.identity || ''} onChange={e => handleUpdateCharacter(char.id, 'identity', e.target.value)}
                        placeholder="예: A stunning Korean woman in her 20s"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Hairstyle</label>
                        <input 
                          className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-lime-500"
                          value={char.hair} onChange={e => handleUpdateCharacter(char.id, 'hair', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Physical Body</label>
                        <input 
                          className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-slate-300 outline-none focus:border-lime-500"
                          value={char.body} onChange={e => handleUpdateCharacter(char.id, 'body', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest px-1">Main Outfit</label>
                      <input 
                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-sm font-bold text-slate-200 outline-none focus:border-lime-500"
                        value={char.outfit} onChange={e => handleUpdateCharacter(char.id, 'outfit', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-lime-500/5 border border-lime-500/20 p-8 rounded-[32px] max-w-2xl mx-auto flex items-center gap-6">
               <Bot size={40} className="text-lime-400 shrink-0" />
               <div>
                  <h4 className="font-bold text-lime-400">AI 캐릭터 일관성 보장</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1">설정된 정보는 이미지 생성 시 프롬프트에 자동으로 포함되어 캐릭터의 얼굴과 특징이 일정하게 유지됩니다. 마마님만의 유니크한 캐릭터를 만들어보세요.</p>
               </div>
            </div>
          </div>
        );

      case 'media':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1400px] mx-auto overflow-x-hidden">
            <div className="flex justify-between items-end border-b border-white/5 pb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">이미지 & 영상 제작</h2>
                <p className="text-slate-400 text-sm">AI 아티스트가 장면에 맞는 이미지를 생성합니다.</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col gap-1">
                   <label className="text-[10px] text-slate-500 font-black uppercase px-1">Image Effect</label>
                   <select value={imageEffect} onChange={e => setImageEffect(e.target.value)} className="bg-slate-800 border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-lime-500">
                      {IMAGE_EFFECTS.map(eff => <option key={eff.id} value={eff.id}>{eff.label}</option>)}
                   </select>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBatchImageGenerate} className="bg-white/5 border border-white/10 hover:bg-white/10 px-8 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
                    <Wand2 size={18} className="text-lime-400" /> 전체 일괄 생성
                  </button>
                  <button onClick={() => setActiveStep('thumbnail')} className="bg-lime-500 text-black px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-lime-400 transition-all shadow-lg shadow-lime-500/10">
                    다음: 썸네일 제작 <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {scenes.map((scene, i) => (
                <div key={i} className="bg-[#111a24] border border-white/5 rounded-[40px] overflow-hidden group hover:border-lime-500/30 transition-all flex flex-col">
                  <div className="aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={\`Scene \${i+1}\`} />
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-slate-600 animate-pulse">
                          <ImageIcon size={24} />
                        </div>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Image Pending</span>
                      </div>
                    )}
                    {scene.isImageGenerating && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="animate-spin text-lime-400" size={32} />
                        <span className="text-[10px] font-black text-lime-400 uppercase tracking-[0.2em]">Generating Image...</span>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-between items-end">
                       <span className="text-[10px] font-black text-white/40 uppercase">Scene {i+1}</span>
                       <div className="flex gap-2">
                          <button onClick={() => handleGenerateImage(scene.id)} className="p-2 rounded-lg bg-black/60 text-white hover:bg-lime-500 hover:text-black transition-all"><RefreshCw size={14}/></button>
                          <button onClick={() => handleGenerateVariation(scene.id)} className="p-2 rounded-lg bg-black/60 text-white hover:bg-sky-500 hover:text-white transition-all"><Plus size={14}/></button>
                       </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 flex-1 flex flex-col">
                    <p className="text-xs text-slate-400 italic font-medium leading-relaxed">"{scene.scriptLine}"</p>
                    <div className="bg-black/40 p-4 rounded-2xl flex-1">
                      <div className="text-[9px] text-slate-600 font-black uppercase mb-1">Visual Prompt</div>
                      <p className="text-[11px] text-slate-300 leading-snug line-clamp-3">{scene.longPrompt || scene.shortPrompt || scene.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'fusion':
        return <SlimAiStudioFusionApp slimMode={true} />;

      case 'thumbnail':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <h2 className="text-2xl font-bold">썸네일 제작</h2>
            <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-24 h-24 bg-lime-500/10 rounded-full flex items-center justify-center text-lime-400 mb-2">
                <ImageIcon size={48} />
              </div>
              <h3 className="text-xl font-bold">썸네일 스튜디오 연동</h3>
              <p className="text-slate-400 max-w-md">고퀄리티 이미지를 바탕으로 클릭을 부르는 썸네일을 제작합니다. 현재 선택된 장면의 이미지를 썸네일 배경으로 활용할 수 있습니다.</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl pt-8">
                {scenes.filter(s => s.imageUrl).map((s, i) => (
                   <div key={i} className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 hover:border-lime-500 transition-all cursor-pointer relative group">
                      <img src={s.imageUrl} className="w-full h-full object-cover opacity-60" />
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">이 이미지로 제작</div>
                   </div>
                ))}
              </div>
              <button className="bg-lime-500 text-black px-10 py-3.5 rounded-xl font-black hover:bg-lime-400 transition-all shadow-xl shadow-lime-500/20">
                썸네일 편집기 열기
              </button>
            </div>
          </div>
        );

      case 'edit':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">타임라인 편집</h2>
              <button onClick={() => setActiveStep('seo')} className="bg-lime-500 text-black px-8 py-2.5 rounded-xl font-bold hover:bg-lime-400 transition-all flex items-center gap-2">SEO 설정으로 <ChevronRight size={18}/></button>
            </div>
            <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 min-h-[600px] flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 pr-4">
                {scenes.map((scene, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 items-center">
                    <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-xs font-black text-slate-500">{i+1}</div>
                    <div className="w-24 h-14 bg-black rounded-lg overflow-hidden border border-white/10">
                      {scene.imageUrl && <img src={scene.imageUrl} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Duration: 3.5s</div>
                      <p className="text-xs text-white line-clamp-1">{scene.scriptLine}</p>
                    </div>
                    <div className="flex gap-2">
                       <button className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white"><Edit2 size={16}/></button>
                       <button className="p-2 rounded-lg bg-white/5 text-red-400 hover:bg-red-400/20"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-6 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-6">
                    <div>
                       <div className="text-[10px] text-slate-500 uppercase font-black mb-1">Total Duration</div>
                       <div className="text-xl font-black text-lime-400">00:34.2</div>
                    </div>
                    <div className="flex gap-2">
                       <button className="w-10 h-10 rounded-full bg-lime-500 text-black flex items-center justify-center hover:bg-lime-400 transition-all"><Play size={20} fill="currentColor"/></button>
                       <button className="w-10 h-10 rounded-full bg-white/5 text-slate-400 flex items-center justify-center hover:text-white"><FastForward size={20}/></button>
                    </div>
                 </div>
                 <div className="text-xs text-slate-500 uppercase font-black">Timeline Engine Active</div>
              </div>
            </div>
          </div>
        );

      case 'seo':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">SEO 및 메타데이터</h2>
                <button 
                  onClick={handleGenerateSeo}
                  disabled={isGenerating}
                  className="bg-lime-500 text-black px-10 py-3 rounded-xl font-black hover:bg-lime-400 transition-all flex items-center gap-2"
                >
                  {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={20}/>}
                  AI 최적화 생성
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 space-y-4">
                      <h3 className="text-sm font-bold text-slate-200">유튜브 제목 (Title)</h3>
                      <input 
                        type="text" value={seoData?.title || ''} 
                        onChange={e => setSeoData(prev => ({...prev!, title: e.target.value}))}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-lime-500 outline-none" 
                        placeholder="AI가 생성한 최적의 제목..."
                      />
                   </div>
                   <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 space-y-4">
                      <h3 className="text-sm font-bold text-slate-200">태그 (Tags)</h3>
                      <textarea 
                        value={seoData?.tags || ''} 
                        onChange={e => setSeoData(prev => ({...prev!, tags: e.target.value}))}
                        className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-lime-500 outline-none resize-none" 
                        placeholder="콤마(,)로 구분된 태그들..."
                      />
                   </div>
                </div>
                <div className="bg-[#111a24] border border-white/5 rounded-[32px] p-8 flex flex-col">
                   <h3 className="text-sm font-bold text-slate-200 mb-4">영상 설명 (Description)</h3>
                   <textarea 
                      value={seoData?.description || ''} 
                      onChange={e => setSeoData(prev => ({...prev!, description: e.target.value}))}
                      className="flex-1 w-full bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-white focus:border-lime-500 outline-none resize-none" 
                      placeholder="SEO 키워드가 포함된 상세 설명..."
                   />
                </div>
             </div>
             
             <div className="flex justify-center pt-8">
                <button onClick={() => setActiveStep('export')} className="bg-white/5 border border-white/10 text-white px-16 py-4 rounded-2xl font-black text-lg hover:bg-white/10 transition-all">내보내기 단계로 이동</button>
             </div>
          </div>
        );

      case 'export':
        return (
          <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-[1200px] mx-auto min-h-[calc(100vh-200px)] flex flex-col justify-center">
            <div className="text-center space-y-4 mb-12">
               <div className="w-20 h-20 bg-lime-500 rounded-3xl flex items-center justify-center text-black mx-auto shadow-2xl shadow-lime-500/30">
                  <Download size={40} />
               </div>
               <h2 className="text-3xl font-black">최종 영상 데이터 내보내기</h2>
               <p className="text-slate-400">모든 작업이 완료되었습니다! 아래 형식으로 프로젝트를 저장하세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
               <div className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col items-center text-center space-y-6 hover:bg-lime-500/5 transition-all group">
                  <div className="text-5xl">📄</div>
                  <h3 className="text-xl font-bold">SRT 자막 파일</h3>
                  <p className="text-sm text-slate-500">유튜브나 프리미어 등에서 즉시 사용 가능한 표준 자막 파일입니다.</p>
                  <button onClick={() => handleExport('srt')} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-black group-hover:bg-lime-500 group-hover:text-black transition-all uppercase tracking-widest text-xs">Download SRT</button>
               </div>
               <div className="bg-[#111a24] border border-white/5 p-8 rounded-[40px] flex flex-col items-center text-center space-y-6">
                  <div className="text-5xl">🎨</div>
                  <h3 className="text-xl font-bold">자막 스타일 설정</h3>
                  <div className="w-full grid grid-cols-2 gap-4">
                     <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-slate-500 block mb-1">Color</label>
                        <input type="color" value={subtitleStyle.color} onChange={e => setSubtitleStyle({...subtitleStyle, color: e.target.value})} className="w-full h-8 bg-transparent cursor-pointer" />
                     </div>
                     <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                        <label className="text-[10px] text-slate-500 block mb-1">Outline</label>
                        <input type="color" value={subtitleStyle.outlineColor} onChange={e => setSubtitleStyle({...subtitleStyle, outlineColor: e.target.value})} className="w-full h-8 bg-transparent cursor-pointer" />
                     </div>
                  </div>
                  <div className="w-full">
                     <label className="text-[10px] text-slate-500 flex justify-between px-1"><span>Font Size</span><span>{\`\${subtitleStyle.fontSize}px\`}</span></label>
                     <input type="range" min="10" max="100" value={subtitleStyle.fontSize} onChange={e => setSubtitleStyle({...subtitleStyle, fontSize: parseInt(e.target.value)})} className="w-full accent-lime-500" />
                  </div>
               </div>
             </div>
          </div>
         );
       case 'tubeflow':
        return (
          <div className="p-8 animate-in fade-in duration-700 max-w-[1000px] mx-auto h-[calc(100vh-100px)] flex flex-col justify-center">
             <div className="bg-gradient-to-br from-lime-500/20 to-emerald-600/20 p-[1px] rounded-[48px] shadow-2xl">
                <div className="bg-[#0a0f16] rounded-[47px] p-16 flex flex-col items-center text-center space-y-8 border border-white/5">
                   <div className="w-24 h-24 bg-lime-500/10 rounded-full flex items-center justify-center text-lime-400 shadow-inner">
                      <Zap size={48} fill="currentColor" className="drop-shadow-[0_0_15px_rgba(132,204,22,0.5)]" />
                   </div>
                   <div className="space-y-3">
                      <h2 className="text-5xl font-black italic tracking-tighter uppercase text-white leading-none">TubeFlow Automation</h2>
                      <p className="text-lime-400/60 font-black text-xs uppercase tracking-[0.4em]">Viral Delivery Engine v4.0</p>
                   </div>
                   <p className="text-slate-400 max-w-lg leading-relaxed font-medium">유튜브 업로드 전용 자동화 도구입니다. 캡컷 작업을 마친 후, 생성된 모든 메타데이터를 유튜브 스튜디오에 원클릭으로 전송하고 예약을 관리하세요.</p>
                   
                   <div className="grid grid-cols-3 gap-6 w-full pt-8">
                      {[
                        { icon: <Play />, label: '유튜브 업로드', status: 'READY' },
                        { icon: <Clock />, label: '스케줄 매니저', status: 'ACTIVE' },
                        { icon: <Sliders />, label: '채널 분석', status: 'BETA' }
                      ].map(m => (
                        <div key={m.label} className="bg-white/5 border border-white/5 p-8 rounded-[40px] space-y-4 hover:bg-white/10 transition-all cursor-pointer">
                           <div className="text-lime-400 flex justify-center scale-125 mb-2">{m.icon}</div>
                           <div className="text-[11px] font-black uppercase text-white tracking-widest">{m.label}</div>
                           <div className="text-[9px] font-black bg-lime-500/10 inline-block px-3 py-1 rounded-full text-lime-400 tracking-tighter">{m.status}</div>
                        </div>
                      ))}
                   </div>

                   <button className="bg-lime-500 text-black px-12 py-5 rounded-[24px] font-black hover:bg-lime-400 transition-all shadow-2xl shadow-lime-500/30 uppercase tracking-[0.2em] text-sm flex items-center gap-3 active:scale-95">
                      <Zap size={18} fill="currentColor" /> Open Dashboard
                   </button>
                </div>
             </div>
          </div>
        );

      default:
        return <div className="p-8 text-slate-500 font-bold uppercase tracking-widest text-center py-40">Section Under Construction</div>;
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0f16] text-white font-sans overflow-hidden selection:bg-lime-500/30">
      <aside className="w-64 border-r border-white/5 bg-[#0a0f16] flex flex-col shrink-0 relative z-50">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-2xl shadow-lime-500/40 rotate-3 font-black text-black">T</div>
          <span className="text-xl font-black tracking-tighter uppercase leading-none text-white">Tube<br/>Factory</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-10 custom-scrollbar">
          {['시스템', '관리', '기획', '음성', '제작', '편집', '완성', '도구'].map(group => (
            <div key={group}>
              <h3 className="px-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">{group}</h3>
              {menuItems.filter(m => m.group === group).map(item => (
                <button
                  key={item.id} onClick={() => setActiveStep(item.id as Step)}
                  className={\`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-[13px] font-bold transition-all \${activeStep === item.id ? 'bg-gradient-to-r from-lime-500/20 to-transparent text-lime-400 border-l-4 border-lime-500 shadow-lg' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'}\`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0f16] relative">
        <header className="h-20 border-b border-white/5 bg-[#0a0f16]/80 backdrop-blur-3xl flex items-center justify-between px-10 z-40">
          <div className="flex items-center gap-6">
            <div className="bg-white/5 px-4 py-2 rounded-xl text-xs font-black border border-white/5">PROJECT: {topic || 'UNTITLED'}</div>
            <div className="bg-lime-500/10 px-4 py-2 rounded-xl text-xs font-black text-lime-400 border border-lime-500/20">{selectedStyle}</div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5">
             <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-[11px] font-black">M</div>
             <span className="text-xs font-black">마마님</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0f16]">{renderContent()}</main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: \`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.03); border-radius: 20px; border: 2px solid transparent; background-clip: content-box; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-in { animation: fadeIn 0.5s ease-out forwards; }
      \`}} />
    </div>
  );
};

export default TubeFactoryPanel;
\`;

fs.writeFileSync('standalone-lite/features/shorts-lab/components/TubeFactoryPanel.tsx', code, 'utf8');
console.log('업데이트 성공!');

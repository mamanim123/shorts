import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { EditingState, ImageResult, Prompt } from '../types';
import {
  base64ToFile,
  editImage,
  generateImageFromImagesAndText,
  generatePersonDetailsFromImage,
  generatePromptFromImage,
  revisePromptsForPolicy,
} from '../services/geminiService';
import ImageDropzone from './ImageDropzone';
import ImageEditorControls from './ImageEditorControls';
import FusionLightbox from './FusionLightbox';
import Spinner from './Spinner';
import ToastContainer, { ToastMessage } from './Toast';

interface SourceImage {
  id: string;
  file: File | null;
  url: string | null;
  name: string;
}

interface SlimAiStudioFusionAppProps {
  onAddHistory?: (dataUrl: string, prompt: string) => void;
  slimMode?: boolean;
}

const MAX_PROMPTS = 4;

const createSourceImage = (): SourceImage => ({
  id: `source-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  file: null,
  url: null,
  name: '',
});

const SlimAiStudioFusionApp: React.FC<SlimAiStudioFusionAppProps> = ({ onAddHistory }) => {
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([createSourceImage()]);
  const [activeEditingImageId, setActiveEditingImageId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editingState, setEditingState] = useState<EditingState>('idle');
  const [prompts, setPrompts] = useState<Prompt[]>([{ id: `prompt-${Date.now()}`, value: '' }]);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevisingPrompts, setIsRevisingPrompts] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setActiveEditingImageId((current) => current ?? sourceImages[0]?.id ?? null);
  }, [sourceImages]);

  useEffect(() => {
    return () => {
      sourceImages.forEach((image) => {
        if (image.url) URL.revokeObjectURL(image.url);
      });
    };
  }, [sourceImages]);

  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    setToasts((current) => [...current, { id: `${Date.now()}-${Math.random()}`, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const handleImageDrop = useCallback((id: string, file: File) => {
    setSourceImages((current) =>
      current.map((image) => {
        if (image.id !== id) return image;
        if (image.url) URL.revokeObjectURL(image.url);
        return { ...image, file, url: URL.createObjectURL(file) };
      }),
    );
    setActiveEditingImageId(id);
  }, []);

  const handleClearImage = useCallback((id: string) => {
    setSourceImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target?.url) URL.revokeObjectURL(target.url);
      if (current.length === 1) return [{ ...current[0], file: null, url: null, name: '' }];
      return current.filter((image) => image.id !== id);
    });
  }, []);

  const handleError = useCallback((error: unknown) => {
    addToast('error', error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
  }, [addToast]);

  const updateSourceImage = useCallback(
    async (imageUrl: string, originalFileName: string, imageId: string, historyPrompt?: string) => {
      const mimeType = imageUrl.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
      const extension = mimeType.split('/')[1] || 'png';
      const baseName = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;
      const editedFile = await base64ToFile(imageUrl, `edited_${baseName}.${extension}`);

      setSourceImages((current) =>
        current.map((image) => {
          if (image.id !== imageId) return image;
          if (image.url) URL.revokeObjectURL(image.url);
          return { ...image, file: editedFile, url: URL.createObjectURL(editedFile) };
        }),
      );

      if (onAddHistory) onAddHistory(imageUrl, historyPrompt || '');
      addToast('success', '이미지가 성공적으로 수정되었습니다.');
    },
    [addToast, onAddHistory],
  );

  const handleEditImage = async (mask?: { data: string; mimeType: string }) => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file || !editPrompt.trim()) {
      addToast('info', '이미지와 수정 프롬프트를 모두 입력해주세요.');
      return;
    }

    setEditingState('prompt');
    try {
      const prompt = mask ? `Only paint inside the masked area. Do not change anything else. Prompt: "${editPrompt.trim()}"` : editPrompt.trim();
      const editedImageUrl = await editImage(activeImage.file, prompt, mask);
      await updateSourceImage(editedImageUrl, activeImage.file.name, activeImage.id, editPrompt.trim());
      setEditPrompt('');
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleSpecialEdit = async (action: 'text' | 'background' | 'restoration' | 'painting' | 'chest-cover') => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    const promptMap: Record<typeof action, string> = {
      text: 'Remove all text from this image. Fill the space naturally to match the surrounding background.',
      background: 'Remove the background from this image. Leave only the main subject on a transparent background.',
      restoration: 'Upscale and improve the quality of this image. Fix blurriness and artifacts while maintaining original details.',
      painting: 'Convert this image into a high-quality realistic oil painting with visible brush strokes.',
      'chest-cover': 'Add a high-neck sweater covering the chest. Keep face, hair, and background unchanged.',
    };

    setEditingState(action);
    try {
      const editedImageUrl = await editImage(activeImage.file, promptMap[action]);
      await updateSourceImage(editedImageUrl, activeImage.file.name, activeImage.id, promptMap[action]);
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleUpscale = async (scale: 2 | 4) => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    setEditingState(`upscale-${scale}x`);
    try {
      const editedImageUrl = await editImage(
        activeImage.file,
        `Upscale this image by ${scale}x. Increase resolution and sharpness while preserving identity and details.`,
      );
      await updateSourceImage(editedImageUrl, activeImage.file.name, activeImage.id, `Upscale ${scale}x`);
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleAgeChange = async (age: 20 | 30 | 40 | 50) => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    setEditingState(`age-${age}`);
    try {
      const editedImageUrl = await editImage(
        activeImage.file,
        `Modify this person's face to look approximately ${age} years old. Keep hairstyle, clothes, and background exactly the same.`,
      );
      await updateSourceImage(editedImageUrl, activeImage.file.name, activeImage.id, `Age ${age}`);
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleMultiAgeGeneration = async () => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    const ages: Array<20 | 30 | 40 | 50> = [20, 30, 40, 50];
    setEditingState('age-multi');
    const initialResults: ImageResult[] = ages.map((age) => ({
      id: `age-${age}-${Date.now()}`,
      prompt: `${age}대로 나이 변환`,
      imageUrl: null,
      isLoading: true,
      error: null,
    }));
    setResults(initialResults);

    try {
      const outcomes = await Promise.all(
        ages.map(async (age, index) => {
          try {
            const imageUrl = await editImage(
              activeImage.file as File,
              `Modify this person's face to look approximately ${age} years old. Keep hairstyle, clothes, and background exactly the same.`,
            );
            return { id: initialResults[index].id, imageUrl };
          } catch (error) {
            return { id: initialResults[index].id, error: error instanceof Error ? error.message : '오류' };
          }
        }),
      );

      setResults(
        initialResults.map((result) => {
          const outcome = outcomes.find((entry) => entry.id === result.id);
          if (!outcome) return { ...result, isLoading: false, error: '결과 처리 실패' };
          if ('imageUrl' in outcome) {
            if (onAddHistory) onAddHistory(outcome.imageUrl, result.prompt);
            return { ...result, imageUrl: outcome.imageUrl, isLoading: false };
          }
          return { ...result, isLoading: false, error: outcome.error || '오류' };
        }),
      );
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const fillPromptSlot = useCallback((text: string) => {
    setPrompts((current) => {
      const firstEmptyIndex = current.findIndex((prompt) => prompt.value.trim() === '');
      if (firstEmptyIndex >= 0) {
        const next = [...current];
        next[firstEmptyIndex] = { ...next[firstEmptyIndex], value: text };
        return next;
      }
      if (current.length < MAX_PROMPTS) {
        return [...current, { id: `prompt-${Date.now()}`, value: text }];
      }
      const next = [...current];
      next[0] = { ...next[0], value: text };
      return next;
    });
  }, []);

  const handleGeneratePrompt = async () => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    setEditingState('generating-prompt');
    try {
      fillPromptSlot(await generatePromptFromImage(activeImage.file));
      addToast('success', '이미지에서 프롬프트가 생성되었습니다.');
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleGeneratePersonDetails = async () => {
    const activeImage = sourceImages.find((image) => image.id === activeEditingImageId);
    if (!activeImage?.file) {
      addToast('info', '먼저 이미지를 업로드해주세요.');
      return;
    }

    setEditingState('generating-details');
    try {
      fillPromptSlot(await generatePersonDetailsFromImage(activeImage.file));
      addToast('success', '인물 디테일이 성공적으로 추출되었습니다.');
    } catch (error) {
      handleError(error);
    } finally {
      setEditingState('idle');
    }
  };

  const handleGenerateImages = async () => {
    const validPrompts = prompts.filter((prompt) => prompt.value.trim());
    const imageFiles = sourceImages
      .map((image) => ({ file: image.file, name: image.name.trim() }))
      .filter((entry): entry is { file: File; name: string } => entry.file !== null);

    if (validPrompts.length === 0) {
      addToast('info', '하나 이상의 프롬프트를 입력해주세요.');
      return;
    }

    if (imageFiles.length === 0) {
      addToast('info', '퓨전 모드에서는 하나 이상의 참조 이미지를 제공해야 합니다.');
      return;
    }

    setIsGenerating(true);
    setResults(validPrompts.map((prompt) => ({ id: prompt.id, prompt: prompt.value, imageUrl: null, isLoading: true, error: null })));

    try {
      const outcomes = await Promise.all(
        validPrompts.map(async (prompt) => {
          try {
            const imageUrl = await generateImageFromImagesAndText(imageFiles, prompt.value);
            return { id: prompt.id, imageUrl };
          } catch (error) {
            return { id: prompt.id, error: error instanceof Error ? error.message : '오류' };
          }
        }),
      );

      setResults((current) =>
        current.map((result) => {
          const outcome = outcomes.find((entry) => entry.id === result.id);
          if (!outcome) return result;
          if ('imageUrl' in outcome) {
            if (onAddHistory) onAddHistory(outcome.imageUrl, result.prompt);
            return { ...result, imageUrl: outcome.imageUrl, isLoading: false };
          }
          return { ...result, error: outcome.error || '오류', isLoading: false };
        }),
      );
      addToast('success', '이미지 생성이 완료되었습니다.');
    } catch (error) {
      handleError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevisePrompts = async () => {
    const validPrompts = prompts.filter((prompt) => prompt.value.trim());
    if (validPrompts.length === 0) {
      addToast('info', '수정할 프롬프트가 없습니다.');
      return;
    }

    setIsRevisingPrompts(true);
    try {
      const revised = await revisePromptsForPolicy(validPrompts.map((prompt) => prompt.value));
      let revisedIndex = 0;
      setPrompts((current) =>
        current.map((prompt) => {
          if (!prompt.value.trim()) return prompt;
          const nextValue = revised[revisedIndex] || prompt.value;
          revisedIndex += 1;
          return { ...prompt, value: nextValue };
        }),
      );
      addToast('success', '프롬프트가 자동으로 수정되었습니다.');
    } catch (error) {
      handleError(error);
    } finally {
      setIsRevisingPrompts(false);
    }
  };

  const canGenerate = useMemo(
    () => !isGenerating && !isRevisingPrompts && sourceImages.some((image) => image.file) && prompts.some((prompt) => prompt.value.trim()),
    [isGenerating, isRevisingPrompts, sourceImages, prompts],
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="max-w-7xl mx-auto relative space-y-4">
        <div className="rounded-2xl border border-gray-800/70 bg-gray-900/70 p-4 shadow-lg shadow-black/30">
          <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/70">Standalone Lite / AI Studio</p>
          <h2 className="text-xl font-semibold text-white">이미지 퓨전 & 수정 전용 로컬 복제</h2>
          <p className="mt-1 text-xs text-gray-400">ai_studio_bundle 직접 import 없이 standalone-lite 내부 복사본으로 동작합니다.</p>
        </div>

        <main className="grid grid-cols-1 lg:grid-cols-[1.1fr_1.9fr] gap-4 lg:gap-6">
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">1. 참조 이미지 업로드</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sourceImages.map((image, index) => (
                  <div key={image.id}>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <h3 className="text-base font-medium text-gray-300">이미지 {index + 1}</h3>
                      {sourceImages.length > 1 && (
                        <button onClick={() => handleClearImage(image.id)} className="p-1 text-gray-500 hover:text-red-500 transition-colors" title="이미지 슬롯 삭제">
                          ×
                        </button>
                      )}
                    </div>
                    <ImageDropzone
                      onImageDrop={(file) => handleImageDrop(image.id, file)}
                      previewUrl={image.url}
                      onClear={() => handleClearImage(image.id)}
                      onPreviewClick={(url) => setLightboxImageUrl(url)}
                      onDownload={() => {
                        if (!image.url || !image.file) return;
                        const link = document.createElement('a');
                        link.href = image.url;
                        link.download = image.file.name;
                        link.click();
                      }}
                    />
                    <input type="text" value={image.name} onChange={(event) => setSourceImages((current) => current.map((entry) => entry.id === image.id ? { ...entry, name: event.target.value } : entry))} placeholder="이미지 이름 (예: 캐디)" className="w-full mt-2 bg-gray-700 border border-gray-600 rounded-md p-2 text-sm" />
                  </div>
                ))}
              </div>
              <button onClick={() => setSourceImages((current) => [...current, createSourceImage()])} className="mt-4 text-indigo-400 hover:text-indigo-300 transition">
                참조 이미지 추가
              </button>
            </div>

            <ImageEditorControls
              sourceImages={sourceImages}
              activeEditingImageId={activeEditingImageId}
              setActiveEditingImageId={setActiveEditingImageId}
              activeImageUrl={sourceImages.find((image) => image.id === activeEditingImageId)?.url || null}
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
            />

            <div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">2. 창의적인 프롬프트 추가</h2>
              <div className="flex flex-col gap-4">
                {prompts.map((prompt, index) => (
                  <div key={prompt.id} className="flex items-start gap-2">
                    <textarea value={prompt.value} onChange={(event) => setPrompts((current) => current.map((entry) => entry.id === prompt.id ? { ...entry, value: event.target.value } : entry))} placeholder={`프롬프트 #${index + 1}...`} className="flex-grow bg-gray-800 border border-gray-600 rounded-md p-3 resize-y" rows={1} />
                    {prompts.length > 1 && <button onClick={() => setPrompts((current) => current.filter((entry) => entry.id !== prompt.id))} className="p-2 text-gray-400 hover:text-red-400 transition mt-1">삭제</button>}
                  </div>
                ))}
                {prompts.length < MAX_PROMPTS && <button onClick={() => setPrompts((current) => [...current, { id: `prompt-${Date.now()}`, value: '' }])} className="self-start text-indigo-400 hover:text-indigo-300 transition mt-2">프롬프트 추가하기</button>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <button onClick={handleGenerateImages} disabled={!canGenerate} className={`w-full sm:flex-grow py-4 px-6 text-lg font-semibold rounded-lg ${canGenerate ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                {isGenerating ? '생성 중...' : `${prompts.filter((prompt) => prompt.value.trim()).length}개의 이미지 생성하기`}
                {isGenerating && <span className="inline-flex ml-3"><Spinner size="sm" /></span>}
              </button>
              <button onClick={handleRevisePrompts} disabled={!canGenerate} className={`w-full sm:w-auto px-4 py-4 text-base font-semibold rounded-lg ${canGenerate ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>
                {isRevisingPrompts ? <Spinner size="sm" /> : '자동 수정'}
              </button>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 sm:p-6 min-h-[30rem]">
            <h2 className="text-2xl font-bold text-gray-200 mb-4">결과</h2>
            {results.length === 0 && !isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p className="text-center">생성된 이미지가 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((result) => (
                  <div key={result.id} className="bg-gray-800 rounded-lg overflow-hidden shadow-lg flex flex-col">
                    <div className="w-full bg-gray-900 flex items-center justify-center relative group aspect-square">
                      {result.isLoading && <Spinner />}
                      {result.error && <div className="p-4 text-center text-red-400">{result.error}</div>}
                      {result.imageUrl && (
                        <>
                          <img src={result.imageUrl} alt={result.prompt} className="w-full h-full object-contain cursor-pointer" onClick={() => setLightboxImageUrl(result.imageUrl)} />
                          <button onClick={() => navigator.clipboard.writeText(result.prompt)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/75">복사</button>
                        </>
                      )}
                    </div>
                    <div className="p-3 bg-gray-700">
                      <p className="text-sm text-gray-300 truncate">{result.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      {lightboxImageUrl && <FusionLightbox imageUrl={lightboxImageUrl} onClose={() => setLightboxImageUrl(null)} />}
    </div>
  );
};

export default SlimAiStudioFusionApp;

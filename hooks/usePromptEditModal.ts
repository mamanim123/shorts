/**
 * usePromptEditModal.ts
 * 프롬프트 수정 모달 관련 로직
 */

import { useCallback } from 'react';
import { parseJsonFromText } from '../services/jsonParse';
import { ElementAnalysis, buildElementAnalysisPrompt } from '../utils/promptHighlightSystem';

interface UsePromptEditModalParams {
    promptEditOriginal: string;
    promptEditLoading: boolean;
    targetService?: string;
    setPromptEditLoading: (loading: boolean) => void;
    setPromptEditLoadingType: (type: 'element' | 'detailed' | 'style' | null) => void;
    setPromptEditError: (error: string | null) => void;
    setPromptElementAnalysis: (analysis: ElementAnalysis) => void;
}

export const usePromptEditModal = ({
    promptEditOriginal,
    promptEditLoading,
    targetService,
    setPromptEditLoading,
    setPromptEditLoadingType,
    setPromptEditError,
    setPromptElementAnalysis
}: UsePromptEditModalParams) => {
    // 요소별 분석 함수
    const handleAnalyzePromptByElement = useCallback(async () => {
        if (!promptEditOriginal.trim()) {
            setPromptEditError('원본 프롬프트가 비어있습니다.');
            return;
        }

        if (promptEditLoading) return;

        setPromptEditLoading(true);
        setPromptEditLoadingType('element');
        setPromptEditError(null);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 45000);

        try {
            const selectedService = targetService || 'GEMINI';
            const prompt = buildElementAnalysisPrompt(promptEditOriginal);

            const response = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    service: selectedService,
                    prompt,
                    maxTokens: 800,
                    temperature: 0.2,
                    freshChat: true
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API 오류 (${response.status}): ${errorData.error || errorData.details || '서버 응답 실패'}`);
            }

            const data = await response.json();
            console.log('🔍 [요소 분석] 서버 응답 데이터:', data);
            const generatedText = (data.rawResponse || data.text || data.result || '').trim();
            if (!generatedText) {
                throw new Error('AI로부터 빈 응답을 받았습니다. 다시 시도해주세요.');
            }
            const normalized = generatedText.replace(/^(JSON|json)\s*/i, '').trim();

            const parsed = parseJsonFromText<ElementAnalysis>(normalized) ||
                          parseJsonFromText<ElementAnalysis>(generatedText);

            if (parsed && typeof parsed === 'object') {
                const normalize = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);
                const analysis: ElementAnalysis = {
                    style: normalize(parsed.style),
                    lighting: normalize(parsed.lighting),
                    camera: normalize(parsed.camera),
                    composition: normalize(parsed.composition),
                    character: normalize(parsed.character),
                    background: normalize(parsed.background),
                    problems: normalize(parsed.problems)
                };
                setPromptElementAnalysis(analysis);
                console.log('[요소별 분석 완료]', analysis);
            } else {
                console.error('[요소 분석] 파싱 실패. 원본 텍스트:', generatedText);
                setPromptEditError('요소별 분석 결과를 파싱하지 못했습니다. AI 응답 형식이 올바르지 않습니다.');
            }
        } catch (error) {
            console.error('요소별 분석 실패:', error);
            if (error instanceof DOMException && error.name === 'AbortError') {
                setPromptEditError('응답 시간이 길어 중단되었습니다. 다시 시도해주세요.');
            } else {
                setPromptEditError(error instanceof Error ? error.message : '요소별 분석에 실패했습니다.');
            }
        } finally {
            window.clearTimeout(timeoutId);
            setPromptEditLoading(false);
            setPromptEditLoadingType(null);
        }
    }, [
        promptEditOriginal,
        promptEditLoading,
        targetService,
        setPromptEditLoading,
        setPromptEditLoadingType,
        setPromptEditError,
        setPromptElementAnalysis
    ]);

    return {
        handleAnalyzePromptByElement
    };
};

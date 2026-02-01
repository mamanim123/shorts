/**
 * promptHighlightSystem.tsx
 * 프롬프트 요소별 하이라이트 시스템
 *
 * 기능:
 * - 요소별 하이라이트 렌더링 (스타일, 조명, 카메라, 구도, 인물, 배경, 문제)
 * - 요소별 분석 프롬프트 생성
 * - 범례(Legend) 컴포넌트
 */

import React from 'react';

// ==========================================
// 타입 정의
// ==========================================

export interface ElementAnalysis {
    style?: string[];
    lighting?: string[];
    camera?: string[];
    composition?: string[];
    character?: string[];
    background?: string[];
    problems?: string[];
}

// ==========================================
// 색상 맵 정의
// ==========================================

export const colorMap = {
    style: 'bg-purple-500/30 text-purple-100',
    lighting: 'bg-yellow-500/30 text-yellow-100',
    camera: 'bg-blue-500/30 text-blue-100',
    composition: 'bg-green-500/30 text-green-100',
    character: 'bg-pink-500/30 text-pink-100',
    background: 'bg-cyan-500/30 text-cyan-100',
    problem: 'bg-red-500/40 text-red-100 font-bold'
};

// ==========================================
// 요소별 렌더링 함수
// ==========================================

export const renderHighlightedByElement = (text: string, analysis: ElementAnalysis): React.ReactNode => {
    if (!analysis || Object.keys(analysis).length === 0) {
        return <span>{text}</span>;
    }

    // 매핑할 요소와 색상 정의
    const normalize = (val: any) => Array.isArray(val) ? val : (typeof val === 'string' && val ? [val] : []);
    const elementColorMap: Record<string, { className: string; terms: string[] }> = {
        style: { className: colorMap.style, terms: normalize(analysis.style) },
        lighting: { className: colorMap.lighting, terms: normalize(analysis.lighting) },
        camera: { className: colorMap.camera, terms: normalize(analysis.camera) },
        composition: { className: colorMap.composition, terms: normalize(analysis.composition) },
        character: { className: colorMap.character, terms: normalize(analysis.character) },
        background: { className: colorMap.background, terms: normalize(analysis.background) },
        problems: { className: colorMap.problem, terms: normalize(analysis.problems) }
    };

    // 모든 매핑할 용어 수집
    const allMappings: Array<{ term: string; className: string }> = [];
    Object.entries(elementColorMap).forEach(([, config]) => {
        config.terms.forEach((term) => {
            allMappings.push({
                term: term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                className: config.className
            });
        });
    });

    if (allMappings.length === 0) {
        return <span>{text}</span>;
    }

    // 정렬 (긴 문자열 먼저)
    allMappings.sort((a, b) => b.term.length - a.term.length);

    let result: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        let found = false;

        for (const mapping of allMappings) {
            const regex = new RegExp(`^(${mapping.term})`, 'i');
            const match = remaining.match(regex);

            if (match) {
                result.push(
                    <span
                        key={`highlight-${key}`}
                        className={`${mapping.className} px-0.5 rounded inline-block`}
                        title={mapping.term}
                    >
                        {match[1]}
                    </span>
                );
                remaining = remaining.slice(match[1].length);
                key++;
                found = true;
                break;
            }
        }

        if (!found) {
            // 다음 하이라이트 위치 찾기
            let nextPos = remaining.length;
            for (const mapping of allMappings) {
                const regex = new RegExp(`(${mapping.term})`, 'i');
                const match = remaining.search(regex);
                if (match !== -1 && match < nextPos) {
                    nextPos = match;
                }
            }

            if (nextPos > 0) {
                result.push(
                    <span key={`normal-${key}`}>{remaining.slice(0, nextPos)}</span>
                );
                remaining = remaining.slice(nextPos);
            } else {
                result.push(
                    <span key={`normal-${key}`}>{remaining[0]}</span>
                );
                remaining = remaining.slice(1);
            }
            key++;
        }
    }

    return <span>{result}</span>;
};

// ==========================================
// 범례 컴포넌트
// ==========================================

export const PromptLegend: React.FC = () => {
    return (
        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
            <span className="text-[9px] px-2 py-1 bg-purple-500/30 text-purple-100 rounded font-semibold">스타일</span>
            <span className="text-[9px] px-2 py-1 bg-yellow-500/30 text-yellow-100 rounded font-semibold">조명</span>
            <span className="text-[9px] px-2 py-1 bg-blue-500/30 text-blue-100 rounded font-semibold">카메라</span>
            <span className="text-[9px] px-2 py-1 bg-green-500/30 text-green-100 rounded font-semibold">구도</span>
            <span className="text-[9px] px-2 py-1 bg-pink-500/30 text-pink-100 rounded font-semibold">인물</span>
            <span className="text-[9px] px-2 py-1 bg-cyan-500/30 text-cyan-100 rounded font-semibold">배경</span>
            <span className="text-[9px] px-2 py-1 bg-red-500/40 text-red-100 rounded font-bold">! 문제</span>
        </div>
    );
};

// ==========================================
// 요소별 분석 프롬프트 생성
// ==========================================

export const buildElementAnalysisPrompt = (originalPrompt: string): string => {
    return [
        '당신은 이미지 프롬프트 분석가입니다.',
        '주어진 프롬프트를 다음 요소별로 분석하여 각 요소에 해당하는 텍스트를 추출하세요.',
        '',
        '요소 정의:',
        '- style: 화풍, 렌더링 스타일, 아트 스타일 (예: cinematic, photorealistic, oil painting)',
        '- lighting: 조명 관련 표현 (예: dramatic lighting, soft lighting, neon lights)',
        '- camera: 카메라 앵글, 렌즈, 프레이밍 (예: close-up, wide shot, 50mm lens)',
        '- composition: 구도, 배치, 레이아웃 (예: rule of thirds, centered composition)',
        '- character: 인물 관련 표현 (예: woman, Korean, dressed in red)',
        '- background: 배경 관련 표현 (예: urban background, forest, night sky)',
        '- problems: 중복된 표현이나 모순되는 표현 (예: "cinematic cinematic")',
        '',
        '출력 형식: 다음 JSON만 출력하세요. JSON 객체만 반환하고 다른 텍스트는 금지입니다.',
        '{',
        '  "style": ["항목1", "항목2", ...],',
        '  "lighting": ["항목1", ...],',
        '  "camera": ["항목1", ...],',
        '  "composition": ["항목1", ...],',
        '  "character": ["항목1", ...],',
        '  "background": ["항목1", ...],',
        '  "problems": ["문제1", "문제2", ...]',
        '}',
        '',
        '프롬프트:',
        originalPrompt
    ].join('\n');
};

// ==========================================
// 호버 시 설명 표시 (문제점 해결 팁)
// ==========================================

export const getProblemExplanation = (problem: string): string => {
    const explanations: Record<string, string> = {
        '중복': '같은 말이 여러 번 나왔어요. 하나만 남겨요.',
        '모순': '말이 서로 다르게 말해요. 하나만 고르세요.',
        '불명확': '말이 애매해요. 더 자세히 써요.',
        '과도': '말이 너무 많아요. 조금 줄여요.',
        '문법': '글이 어색해요. 자연스럽게 고쳐요.'
    };

    for (const [key, explanation] of Object.entries(explanations)) {
        if (problem.includes(key)) {
            return explanation;
        }
    }

    return '쉽게 고치면 더 잘돼요.';
};

// ==========================================
// 요소별 분석 결과 검증
// ==========================================

export const validateElementAnalysis = (analysis: ElementAnalysis): boolean => {
    // 최소한 하나의 요소가 있어야 함
    const hasContent = Object.values(analysis).some(
        (value) => Array.isArray(value) && value.length > 0
    );
    return hasContent;
};

// ==========================================
// 분석 결과 통계
// ==========================================

export const getAnalysisStats = (analysis: ElementAnalysis): Record<string, number> => {
    const stats: Record<string, number> = {};
    Object.entries(analysis).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            stats[key] = value.length;
        }
    });
    return stats;
};

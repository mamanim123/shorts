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

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Copy, Check, Sparkles, Settings2, Eye, Scissors, RefreshCw, Wand2, Loader2, Folder, Image as ImageIcon, Bot, Maximize2, Trash2, Download, Edit3, Video, X, Plus, Save, Lock, ChevronDown, FileText } from 'lucide-react';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { buildLabScriptPrompt, buildLabScriptOnlyPrompt, enhanceScenePrompt, extractNegativePrompt, validateAndFixPrompt, applyWinterLookToExistingPrompt, PROMPT_CONSTANTS, convertAgeToEnglish, isWinterTopic, convertToTightLongSleeveWithShoulderLine, getStoryStageBySceneNumber, getExpressionForScene, getCameraPromptForScene, selectWinterItems, getExpressionKeywordMap, getWinterAccessoryPool, translateActionToEnglish, pickFemaleOutfit, pickMaleOutfit, resetAngleHistory } from '../services/labPromptBuilder';
import type { LabGenreGuidelineEntry, LabGenreGuideline, CharacterInfo } from '../services/labPromptBuilder';
import { useShortsLabGenreManager } from '../hooks/useShortsLabGenreManager';
import { useShortsLabPromptRulesManager } from '../hooks/useShortsLabPromptRulesManager';
import { useShortsLabStep2PromptRulesManager } from '../hooks/useShortsLabStep2PromptRulesManager';
import { useShortsLabCharacterRulesManager } from '../hooks/useShortsLabCharacterRulesManager';
import { shortsLabStep2PromptRulesManager } from '../services/shortsLabStep2PromptRulesManager';

import { parseJsonFromText } from '../services/jsonParse';
import { buildCharacterExtractionPrompt, buildManualSceneDecompositionPrompt, parseCharacterExtractionResponse, parseManualSceneDecompositionResponse } from '../services/manualSceneBuilder';
import { generateImage, generateImageWithImagen, initGeminiService, setSessionApiKey } from './master-studio/services/geminiService';
import { showToast } from './Toast';
import Lightbox from './master-studio/Lightbox';
import CharacterPanel from './CharacterPanel';
import { ShortsIdentityCard, CharacterIdentity } from './ShortsIdentityCard';
import { getAppStorageValue, removeAppStorageValue, setAppStorageValue } from '../services/appStorageService';
import { buildOutfitPool, fetchOutfitCatalog, fetchOutfitPreviewMap } from '../services/outfitService';
import type { OutfitCatalog, OutfitCategory, OutfitPoolItem } from '../services/outfitService';
import { UNIFIED_OUTFIT_LIST } from '../constants';
import { fetchCharacters } from '../services/characterService';
import type { CharacterItem } from '../services/characterService';
import { shortsLabCharacterRulesManager } from '../services/shortsLabCharacterRulesManager';
import { renderHighlightedByElement, PromptLegend, buildElementAnalysisPrompt, ElementAnalysis, getProblemExplanation } from '../utils/promptHighlightSystem';
import { usePromptEditModal } from '../hooks/usePromptEditModal';
import { PromptEditModal, DetailedAnalysis } from './PromptEditModal';

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

const IDENTITY_SLOTS = [
    { id: 'woman-a', label: 'Woman A', gender: 'female' as const, presetKey: 'woman-a' as const },
    { id: 'woman-b', label: 'Woman B', gender: 'female' as const, presetKey: 'woman-b' as const },
    { id: 'woman-c', label: 'Woman C', gender: 'female' as const, presetKey: null },
    { id: 'woman-d', label: 'Woman D', gender: 'female' as const, presetKey: null },
    { id: 'man-a', label: 'Man A', gender: 'male' as const, presetKey: 'man-a' as const },
    { id: 'man-b', label: 'Man B', gender: 'male' as const, presetKey: null },
    { id: 'man-c', label: 'Man C', gender: 'male' as const, presetKey: null }
];

const MANUAL_SLOT_META: Record<string, { id: string; slotLabel: string; gender: 'female' | 'male'; hair: string; body: string }> = {
    'Woman A': { id: 'WomanA', slotLabel: 'Woman A', gender: 'female', hair: 'long soft-wave hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_A },
    'Woman B': { id: 'WomanB', slotLabel: 'Woman B', gender: 'female', hair: 'short chic bob cut', body: PROMPT_CONSTANTS.FEMALE_BODY_B },
    'Woman C': { id: 'WomanC', slotLabel: 'Woman C', gender: 'female', hair: 'low ponytail hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_C },
    'Woman D': { id: 'WomanD', slotLabel: 'Woman D', gender: 'female', hair: 'high-bun hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_D },
    'Man A': { id: 'ManA', slotLabel: 'Man A', gender: 'male', hair: 'short neat hairstyle', body: PROMPT_CONSTANTS.MALE_BODY },
    'Man B': { id: 'ManB', slotLabel: 'Man B', gender: 'male', hair: 'clean short cut', body: PROMPT_CONSTANTS.MALE_BODY },
    'Man C': { id: 'ManC', slotLabel: 'Man C', gender: 'male', hair: 'classic side-part hairstyle', body: PROMPT_CONSTANTS.MALE_BODY },
    'WomanA': { id: 'WomanA', slotLabel: 'Woman A', gender: 'female', hair: 'long soft-wave hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_A },
    'WomanB': { id: 'WomanB', slotLabel: 'Woman B', gender: 'female', hair: 'short chic bob cut', body: PROMPT_CONSTANTS.FEMALE_BODY_B },
    'WomanC': { id: 'WomanC', slotLabel: 'Woman C', gender: 'female', hair: 'low ponytail hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_C },
    'WomanD': { id: 'WomanD', slotLabel: 'Woman D', gender: 'female', hair: 'high-bun hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_D },
    'ManA': { id: 'ManA', slotLabel: 'Man A', gender: 'male', hair: 'short neat hairstyle', body: PROMPT_CONSTANTS.MALE_BODY },
    'ManB': { id: 'ManB', slotLabel: 'Man B', gender: 'male', hair: 'clean short cut', body: PROMPT_CONSTANTS.MALE_BODY },
    'ManC': { id: 'ManC', slotLabel: 'Man C', gender: 'male', hair: 'classic side-part hairstyle', body: PROMPT_CONSTANTS.MALE_BODY }
};

const DEFAULT_CHARACTER_META: Record<string, { gender: 'female' | 'male'; hair: string; body: string }> = {
    WomanA: { gender: 'female', hair: 'long soft-wave hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_A },
    WomanB: { gender: 'female', hair: 'short chic bob cut', body: PROMPT_CONSTANTS.FEMALE_BODY_B },
    WomanC: { gender: 'female', hair: 'low ponytail hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_C },
    WomanD: { gender: 'female', hair: 'high-bun hairstyle', body: PROMPT_CONSTANTS.FEMALE_BODY_D },
    ManA: { gender: 'male', hair: 'short neat hairstyle', body: PROMPT_CONSTANTS.MALE_BODY },
    ManB: { gender: 'male', hair: 'clean short cut', body: PROMPT_CONSTANTS.MALE_BODY },
    ManC: { gender: 'male', hair: 'classic side-part hairstyle', body: PROMPT_CONSTANTS.MALE_BODY }
};

const SLOT_ORDER = ['WomanA', 'WomanB', 'WomanC', 'WomanD', 'ManA', 'ManB', 'ManC'];
const CAMERA_ANGLE_KEYWORDS = [
    'close-up',
    'close up',
    'medium',
    'wide',
    'canted',
    'over-the-shoulder',
    'ots',
    'pov',
    'low-angle',
    'high-angle',
    'bird\'s-eye',
    'overhead',
    'tracking',
    'handheld'
];
const CAMERA_PROMPT_FALLBACKS: Record<string, string> = {
    'close-up': 'close-up portrait shot, face in focus, shallow depth of field',
    'close up': 'close-up portrait shot, face in focus, shallow depth of field',
    medium: 'medium shot, waist-up framing, natural pose',
    wide: 'wide establishing shot, full body visible, environment context',
    canted: 'canted (dutch) angle shot, dynamic framing',
    'over-the-shoulder': 'over-the-shoulder shot, perspective view',
    ots: 'over-the-shoulder shot, perspective view',
    pov: 'first-person POV shot, subjective camera angle',
    'low-angle': 'low-angle shot, dramatic perspective',
    'high-angle': 'high-angle shot, overhead perspective',
    'bird\'s-eye': 'bird\'s-eye view shot, elevated perspective',
    overhead: 'overhead shot, top-down composition',
    tracking: 'tracking shot, subject in motion, dynamic framing',
    handheld: 'handheld candid shot, subtle motion blur'
};
const CANDID_ACTION_FLAVORS = [
    'candid action shot, mid-motion, natural movement',
    'dynamic pose, hair in motion, spontaneous gesture',
    'playful movement, caught mid-step, lively energy',
    'energetic action, subtle motion blur, candid vibe',
    'cinematic candid shot, authentic body language'
];
const GROUP_ACTION_FLAVORS = [
    'natural interaction, candid moment, each person reacting differently',
    'captured mid-action, lively group dynamic, varied gestures',
    'spontaneous group moment, mixed reactions, authentic movement',
    'candid interaction, playful exchanges, unscripted energy'
];
const WINTER_ACCESSORY_SET = new Set(getWinterAccessoryPool());

const getCharacterGender = (id: string): 'female' | 'male' => {
    const meta = DEFAULT_CHARACTER_META[id];
    if (meta) return meta.gender;
    return id.toLowerCase().includes('man') ? 'male' : 'female';
};

const normalizeSlotToken = (value: string) => value.replace(/[\s_]+/g, '').trim();

const normalizeSlotId = (value: string): string => {
    const normalized = normalizeSlotToken(value);
    if (!normalized) return '';
    const key = normalized.toLowerCase();
    const canonical: Record<string, string> = {
        womana: 'WomanA',
        womanb: 'WomanB',
        womanc: 'WomanC',
        womand: 'WomanD',
        mana: 'ManA',
        manb: 'ManB',
        manc: 'ManC'
    };
    return canonical[key] || '';
};

const mapAliasToSlot = (value: string, defaultGender: 'female' | 'male'): string => {
    const lower = value.toLowerCase();
    if (/(주인공|나|내가|narrator|protagonist|character1|character_1)/i.test(lower)) {
        return defaultGender === 'male' ? 'ManA' : 'WomanA';
    }
    if (/캐디|caddy/i.test(lower)) return 'WomanD';
    return '';
};

const inferGenderFromText = (text: string, fallback: 'female' | 'male') => {
    const lower = (text || '').toLowerCase();
    const femaleHints = /(여성|여자|여신|언니|언니들|여성들|미녀|걸|girl|woman|ladies|her)/i;
    const maleHints = /(남성|남자|오빠|형|bro|boy|man|men|his)/i;
    if (femaleHints.test(lower) && !maleHints.test(lower)) return 'female';
    if (maleHints.test(lower) && !femaleHints.test(lower)) return 'male';
    return fallback;
};

const pickUniqueItems = (pool: string[], used: Set<string>, count: number) => {
    const available = pool.filter((item) => !used.has(item));
    const picks: string[] = [];
    while (picks.length < count && available.length > 0) {
        const index = Math.floor(Math.random() * available.length);
        const [picked] = available.splice(index, 1);
        if (picked) picks.push(picked);
    }
    if (picks.length < count) {
        const fallbackPool = pool.filter((item) => !picks.includes(item));
        while (picks.length < count && fallbackPool.length > 0) {
            const index = Math.floor(Math.random() * fallbackPool.length);
            const [picked] = fallbackPool.splice(index, 1);
            if (picked) picks.push(picked);
        }
    }
    picks.forEach((item) => used.add(item));
    return picks;
};

const buildWinterAccessoryMap = (characterIds: string[]) => {
    const pool = getWinterAccessoryPool();
    const used = new Set<string>();
    const map = new Map<string, string[]>();
    characterIds.forEach((id) => {
        if (getCharacterGender(id) !== 'female') {
            map.set(id, []);
            return;
        }
        const picks = pickUniqueItems(pool, used, 2);
        map.set(id, picks);
    });
    return map;
};

const normalizeSlotList = (slotIds: string[], defaultGender: 'female' | 'male', hasCaddy: boolean) => {
    const normalized = slotIds
        .map((id) => normalizeSlotId(id))
        .filter(Boolean);
    if (hasCaddy) normalized.push('WomanD');
    const unique = new Set(normalized);
    const ordered = SLOT_ORDER.filter((id) => unique.has(id));
    if (ordered.length === 0) {
        return [defaultGender === 'male' ? 'ManA' : 'WomanA'];
    }
    return ordered;
};

const normalizeSceneCharacterIds = (
    rawIds: string[],
    slotMap: Map<string, string>,
    defaultGender: 'female' | 'male',
    hasCaddy: boolean
) => {
    const resolved: string[] = [];
    const seen = new Set<string>();
    rawIds.forEach((raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return;
        const direct = normalizeSlotId(trimmed);
        const mapped = slotMap.get(trimmed) || slotMap.get(normalizeSlotToken(trimmed));
        const alias = mapAliasToSlot(trimmed, defaultGender);
        const slot = direct || mapped || alias;
        if (!slot) return;
        if (!seen.has(slot)) {
            seen.add(slot);
            resolved.push(slot);
        }
    });
    if (hasCaddy && !seen.has('WomanD')) {
        resolved.push('WomanD');
    }
    if (resolved.length === 0) {
        resolved.push(defaultGender === 'male' ? 'ManA' : 'WomanA');
    }
    return normalizeSlotList(resolved, defaultGender, hasCaddy);
};

const stripLongPromptMarkers = (prompt: string) => {
    let cleaned = (prompt || '').trim();
    if (!cleaned) return '';
    cleaned = cleaned.replace(/^Scene\s+\d+[.,]?\s*/i, '');
    if (cleaned.includes(PROMPT_CONSTANTS.START)) {
        cleaned = cleaned.replace(PROMPT_CONSTANTS.START, '').trim();
    }
    if (cleaned.includes(PROMPT_CONSTANTS.END)) {
        cleaned = cleaned.replace(PROMPT_CONSTANTS.END, '').trim();
    }
    cleaned = cleaned.replace(/Slot\s+[^:]+:/gi, '').trim();
    cleaned = cleaned.replace(/^,\s*/g, '').replace(/,\s*$/g, '').trim();
    return cleaned;
};

const stripCameraPrefix = (prompt: string) => {
    const keywordPattern = CAMERA_ANGLE_KEYWORDS.map((item) => item.replace('-', '\\-')).join('|');
    const regex = new RegExp(`^\\s*(?:${keywordPattern})[^,]*,?\\s*`, 'i');
    return prompt.replace(regex, '').trim();
};

const mergeNarrativeParts = (parts: string[]) => {
    const seen = new Set<string>();
    const merged: string[] = [];
    parts.forEach((part) => {
        const trimmed = (part || '').trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(trimmed);
    });
    return merged.join(', ');
};

const detectCameraKeyword = (prompt: string) => {
    const lower = (prompt || '').toLowerCase();
    return CAMERA_ANGLE_KEYWORDS.find((keyword) => lower.includes(keyword)) || '';
};

const pickRotatingCandidate = (candidates: string[], index: number, lastValue?: string) => {
    const filtered = candidates.map((item) => (item || '').trim()).filter(Boolean);
    if (filtered.length === 0) return '';
    let pick = filtered[index % filtered.length];
    if (lastValue && pick.toLowerCase() === lastValue.toLowerCase() && filtered.length > 1) {
        pick = filtered[(index + 1) % filtered.length];
    }
    return pick;
};

const getExpressionCandidates = (genre: string, storyStage: string) => {
    const genreKey = genre.toLowerCase().replace(/\s+/g, '-').replace(/[\/\\]/g, '-');
    const expressionMap = getExpressionKeywordMap();
    const expressions = expressionMap[genreKey] || expressionMap['default'] || {};
    const candidate = (expressions as Record<string, unknown>)[storyStage];
    if (Array.isArray(candidate)) return candidate.filter((item) => typeof item === 'string') as string[];
    const base: string[] = typeof candidate === 'string' ? [candidate] : [];
    const fallback = (expressionMap['default'] || {})[storyStage];
    if (typeof fallback === 'string' && fallback && !base.includes(fallback)) {
        base.push(fallback);
    }
    return base;
};

const pickCameraPrompt = (basePrompt: string, sceneIndex: number, lastKeyword?: string) => {
    const baseKeyword = detectCameraKeyword(basePrompt);
    const shouldRotate = !baseKeyword || baseKeyword === 'medium' || baseKeyword === 'close-up' || baseKeyword === 'close up';
    let keyword = shouldRotate
        ? CAMERA_ANGLE_KEYWORDS[(sceneIndex + 1) % CAMERA_ANGLE_KEYWORDS.length]
        : baseKeyword;
    const normalizedKeyword = keyword.toLowerCase();
    const lastNormalized = lastKeyword ? lastKeyword.toLowerCase() : '';
    if (normalizedKeyword === 'medium' && lastNormalized === 'medium') {
        const alternatives = CAMERA_ANGLE_KEYWORDS.filter((item) => item !== 'medium');
        keyword = alternatives[(sceneIndex + 2) % alternatives.length] || keyword;
    }
    if (lastKeyword && normalizedKeyword === lastKeyword.toLowerCase()) {
        const currentIndex = CAMERA_ANGLE_KEYWORDS.findIndex((item) => item === normalizedKeyword);
        const nextIndex = currentIndex >= 0
            ? (currentIndex + 1) % CAMERA_ANGLE_KEYWORDS.length
            : (sceneIndex + 1) % CAMERA_ANGLE_KEYWORDS.length;
        keyword = CAMERA_ANGLE_KEYWORDS[nextIndex];
        return CAMERA_PROMPT_FALLBACKS[keyword] || basePrompt;
    }
    if (shouldRotate) {
        return CAMERA_PROMPT_FALLBACKS[keyword] || basePrompt;
    }
    return basePrompt;
};

const buildAccessoryMap = (
    characters: any[] | undefined,
    enableWinterAccessories?: boolean
) => {
    const map = new Map<string, string[]>();
    const usedAccessories = new Set<string>();

    if (Array.isArray(characters)) {
        characters.forEach((ch) => {
            const id = String(ch.id || ch.slot || ch.slotId || ch.characterSlot || '').trim();
            if (!id) return;
            const baseAccessories = (ch.accessories || ch.accessory || '')
                .split(',')
                .map((item: string) => item.trim())
                .filter(Boolean);
            map.set(id, baseAccessories);
        });
    }

    if (enableWinterAccessories) {
        const ids = Array.isArray(characters)
            ? characters
                .map((ch) => String(ch.id || ch.slot || ch.slotId || ch.characterSlot || '').trim())
                .filter(Boolean)
            : [];
        ids.forEach((id) => {
            const gender = getCharacterGender(id);
            if (gender === 'male') return;
            let accessories: string[] = [];
            let attempts = 0;
            while (attempts < 5 && accessories.length === 0) {
                const pick = selectWinterItems(gender).accessories;
                const unique = pick.filter((item) => !usedAccessories.has(item));
                accessories = unique.length > 0 ? unique : pick;
                attempts += 1;
            }
            accessories.forEach((item) => usedAccessories.add(item));
            const current = map.get(id) || [];
            const merged = Array.from(new Set([...current, ...accessories]));
            map.set(id, merged);
        });
    }

    return map;
};

const applyAccessoriesToPrompt = (
    prompt: string,
    characterIds: string[],
    accessoryMap: Map<string, string[]>
) => {
    let updated = prompt;
    const hasPersonMarkers = /\[Person\s+\d+:/i.test(updated);

    characterIds.forEach((id, index) => {
        const accessories = accessoryMap.get(id) || [];
        if (accessories.length === 0) return;
        const accsStr = accessories.join(', ');
        const markerRegex = new RegExp(`\\[Person\\s+${index + 1}:[^\\]]*\\]`, 'i');

        if (markerRegex.test(updated)) {
            updated = updated.replace(markerRegex, (match) => {
                if (/accessorized with/i.test(match)) {
                    return match.replace(/accessorized with\s*([^\\]]+)/i, (innerMatch, existing) => {
                        const existingItems = existing
                            .split(',')
                            .map((item: string) => item.trim())
                            .filter(Boolean);
                        const merged = Array.from(new Set([...existingItems, ...accessories]));
                        return `accessorized with ${merged.join(', ')}`;
                    });
                }
                return match.replace(']', `, accessorized with ${accsStr}]`);
            });
        } else if (!hasPersonMarkers && characterIds.length === 1) {
            if (!/accessorized with/i.test(updated)) {
                updated = updated.replace(/,\s*$/, '') + `, accessorized with ${accsStr}`;
            }
        }
    });

    return updated;
};

type ManualCharacterPrompt = {
    id: string;
    slotLabel: string;
    gender: 'female' | 'male';
    name: string;
    identity: string;
    hair: string;
    body: string;
    outfit: string;
    accessories: string[];
};

const pickRandomFromList = <T,>(items: T[], exclude: Set<T>): T | null => {
    const filtered = items.filter(item => !exclude.has(item));
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
};

const buildRandomOutfitsByCharacter = (characterIds: string[]) => {
    const outfitPool = buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]);
    // Filter out female candidates (not MALE) and male candidates (MALE or UNISEX)
    const femaleCandidates = outfitPool.filter(item => !item.categories.includes('MALE'));
    const maleCandidates = outfitPool.filter(item => item.categories.includes('MALE') || item.categories.includes('UNISEX'));

    const usedOutfits = new Set<string>();
    const outfitMap = new Map<string, string>();

    // Sort to ensure deterministic behavior or just process as is
    characterIds.forEach((id) => {
        const gender = getCharacterGender(id);
        const candidates = gender === 'male' ? maleCandidates : femaleCandidates;

        const available = candidates.filter(item => !usedOutfits.has(item.name));
        const picked = available.length > 0
            ? available[Math.floor(Math.random() * available.length)]
            : candidates[0];

        if (picked) {
            usedOutfits.add(picked.name);
            outfitMap.set(id, picked.name);
        }
    });

    return outfitMap;
};

const buildRandomAccessoriesByCharacter = (characterIds: string[], enableWinter?: boolean) => {
    const map = new Map<string, string[]>();
    const used = new Set<string>();

    characterIds.forEach((id) => {
        const gender = getCharacterGender(id);
        if (gender === 'male') {
            map.set(id, []);
            return;
        }
        const basePool = GENERAL_ACCESSORIES.flatMap(group => group.items);
        const basePick = basePool.length > 0 ? basePool[Math.floor(Math.random() * basePool.length)] : '';
        const baseAccessories = basePick ? [basePick] : [];
        let winterAccessories: string[] = [];
        if (enableWinter) {
            // 🔹 [V3.9] 캐릭터당 고정 2개 방한용품 할당 (중복 금지)
            const picked = selectWinterItems(gender).accessories;
            // 셔플하여 랜덤성 확보
            const shuffled = [...picked].sort(() => Math.random() - 0.5);
            const uniquePicked = shuffled.filter(item => !used.has(item));
            
            // 가용 아이템이 부족하면 중복을 허용하되 최대한 2개 확보
            winterAccessories = (uniquePicked.length >= 2) 
                ? uniquePicked.slice(0, 2) 
                : [...uniquePicked, ...shuffled.filter(p => !uniquePicked.includes(p))].slice(0, 2);
        }
        const merged = Array.from(new Set([...baseAccessories, ...winterAccessories]));

        merged.forEach(item => used.add(item));
        map.set(id, merged);
    });

    return map;
};

const buildAutoCharacterMap = (
    characterIds: string[],
    targetAgeLabel: string,
    enableWinter?: boolean
) => {
    const outfitMap = buildRandomOutfitsByCharacter(characterIds);
    const accessoriesMap = buildRandomAccessoriesByCharacter(characterIds, enableWinter);
    const map = new Map<string, ManualCharacterPrompt>();

    characterIds.forEach((id) => {
        const slotMeta = MANUAL_SLOT_META[id] || {
            id,
            slotLabel: id,
            gender: getCharacterGender(id),
            hair: '',
            body: ''
        };
        let ageLabel = targetAgeLabel ? convertAgeToEnglish(targetAgeLabel) : '';
        // 🔹 [V3.9] 캐디(WomanD)는 타겟 연령과 상관없이 항상 20대로 고정
        if (id === 'WomanD') ageLabel = 'early 20s';

        const identityText = slotMeta.gender === 'female'
            ? `A stunning Korean woman${ageLabel ? ` in her ${ageLabel}` : ''}`
            : `A handsome Korean man${ageLabel ? ` in his ${ageLabel}` : ''}`;

        let outfit = outfitMap.get(id) || '';
        if (enableWinter && slotMeta.gender === 'female' && outfit) {
            outfit = convertToTightLongSleeveWithShoulderLine(outfit);
        }
        const accessories = accessoriesMap.get(id) || [];

        map.set(id, {
            id: slotMeta.id,
            slotLabel: slotMeta.slotLabel,
            gender: slotMeta.gender,
            name: '',
            identity: identityText,
            hair: slotMeta.hair,
            body: slotMeta.body,
            outfit,
            accessories
        });
    });

    return map;
};

const normalizeShotType = (shotType?: string, characterIds?: string[]): '원샷' | '투샷' | '쓰리샷' => {
    if (shotType === '원샷' || shotType === '투샷' || shotType === '쓰리샷') return shotType;
    const count = Array.isArray(characterIds) ? characterIds.length : 0;
    if (count >= 3) return '쓰리샷';
    if (count === 2) return '투샷';
    return '원샷';
};

const enforceShotTypeMix = (
    shotType: '원샷' | '투샷' | '쓰리샷',
    characterIds: string[],
    sceneIndex: number,
    totalScenes: number
): '원샷' | '투샷' | '쓰리샷' => {
    const hasTwo = characterIds.length >= 2;
    const hasThree = characterIds.length >= 3;

    if (hasThree && (sceneIndex === totalScenes - 1 || sceneIndex % 7 === 0)) {
        return '쓰리샷';
    }
    if (hasTwo && (sceneIndex % 2 === 1)) {
        return '투샷';
    }
    return shotType;
};

const buildCharacterSlotMapping = (characters: Array<{ name: string; gender: string; role?: string }>) => {
    const mapping = new Map<string, string>();
    const hasCaddy = characters.some((char) => {
        const name = (char.name || '').trim();
        return /캐디|caddy/i.test(name) || /caddy/i.test(char.role || '');
    });
    const femaleSlots = ['WomanA', 'WomanB', 'WomanC', 'WomanD'];
    const maleSlots = ['ManA', 'ManB', 'ManC'];
    const usedSlots = new Set<string>();
    let femaleIndex = 0;
    let maleIndex = 0;

    const getPreferredSlot = (name: string, role?: string) => {
        const combined = `${name} ${role || ''}`.trim();
        if (/캐디|caddy/i.test(combined)) return 'WomanD';
        if (/(마누라|와이프|아내|부인|wife|spouse)/i.test(combined)) return 'WomanA';
        return '';
    };

    const pickNextSlot = (slots: string[], index: number) => {
        let cursor = index;
        while (cursor < slots.length && usedSlots.has(slots[cursor])) {
            cursor += 1;
        }
        return slots[cursor] || slots[slots.length - 1];
    };

    // 🔹 [V3.9.2] 지능형 이름 정규화 (이름 뒤의 숫자나 수식어 제거하여 매핑 확률 높임)
    const normalizeName = (n: string) => n.trim().replace(/\d+$/, '').replace(/(님|씨|가|는|이|가)$/, '').trim();

    characters.forEach((char) => {
        const name = char.name.trim();
        if (!name) return;
        const normalized = normalizeName(name);

        const preferred = getPreferredSlot(name, char.role);
        if (preferred && !usedSlots.has(preferred)) {
            mapping.set(name, preferred);
            mapping.set(normalized, preferred);
            usedSlots.add(preferred);
            return;
        }
        if (char.gender === 'male') {
            const slot = pickNextSlot(maleSlots, maleIndex);
            mapping.set(name, slot);
            mapping.set(normalized, slot);
            usedSlots.add(slot);
            maleIndex += 1;
            return;
        }
        const slot = pickNextSlot(femaleSlots, femaleIndex);
        mapping.set(name, slot);
        mapping.set(normalized, slot);
        usedSlots.add(slot);
        femaleIndex += 1;
    });

    return mapping;
};


const mapLineCharactersToSlots = (
    lineCharacterNames: Array<{ line: number; characters: string[] }>,
    slotMap: Map<string, string>
) => {
    const lineMap = new Map<number, string[]>();
    const normalizeName = (n: string) => n.trim().replace(/\d+$/, '').replace(/(님|씨|가|는|이|가)$/, '').trim();

    lineCharacterNames.forEach((item) => {
        const slots = item.characters
            .map((name) => {
                const exact = slotMap.get(name);
                if (exact) return exact;
                const normalized = slotMap.get(normalizeName(name));
                return normalized || '';
            })
            .filter(Boolean);
        if (slots.length > 0) {
            lineMap.set(item.line, Array.from(new Set(slots)));
        }
    });
    return lineMap;
};


const buildFallbackIdentity = (gender: 'female' | 'male', targetAgeLabel?: string) => {
    const age = convertAgeToEnglish(targetAgeLabel || '');
    if (gender === 'female') {
        return age ? `A stunning Korean woman in her ${age}` : 'A stunning Korean woman';
    }
    return age ? `A handsome Korean man in his ${age}` : 'A handsome Korean man';
};

const buildCharacterInfoMap = (characters: any[] | undefined, targetAgeLabel?: string) => {
    const map = new Map<string, CharacterInfo>();
    if (Array.isArray(characters)) {
        characters.forEach((ch) => {
            const id = String(ch.id || ch.slot || ch.slotId || ch.characterSlot || '').trim();
            if (!id) return;
            const defaults = DEFAULT_CHARACTER_META[id];
            const gender = defaults?.gender || (id.toLowerCase().includes('man') ? 'male' : 'female');
            const identity = ch.identity || buildFallbackIdentity(gender, targetAgeLabel);
            map.set(id, {
                identity,
                hair: ch.hair || defaults?.hair || '',
                body: ch.body || defaults?.body || '',
                outfit: ch.outfit || ''
            });
        });
    }
    return map;
};

const GENERAL_ACCESSORIES = [
    {
        id: 'necklaces',
        label: '목걸이',
        items: [
            'delicate gold necklace',
            'pearl pendant necklace',
            'minimalist diamond choker',
            'fine platinum chain necklace'
        ]
    },
    {
        id: 'rings',
        label: '반지',
        items: [
            'sleek platinum ring',
            'thin diamond band ring',
            'minimalist gold ring',
            'luxury sapphire ring'
        ]
    },
    {
        id: 'watches',
        label: '시계',
        items: [
            'luxury stainless steel watch',
            'elegant leather-strap watch',
            'rose-gold designer watch',
            'minimalist ceramic watch'
        ]
    }
];

const WINTER_ACCESSORIES = [
    'luxurious mink fur beanie with crystal embellishments',
    'elegant velvet headband with pearl embroidery',
    'premium mink-style oversized earmuffs',
    'refined cashmere wrap scarf with velvet trim',
    'long opera-length velvet gloves',
    'touch-screen silk gloves with crystal ribbon bows',
    'ribbed knit thigh-high leg warmers',
    'elegant knee-high suede boots with fur lining'
];

// ============================================
// 장르 옵션 - useShortsLabGenreManager hook에서 동적으로 로드
// ============================================

// Empty genre template for new genres
const EMPTY_GENRE_TEMPLATE: Omit<LabGenreGuidelineEntry, 'id'> = {
    name: '',
    description: '',
    emotionCurve: '',
    structure: '',
    killerPhrases: [],
    allowedOutfitCategories: [],
    supportingCharacterPhrasePatterns: [],
    bodyReactions: [],
    forbiddenPatterns: [],
    goodTwistExamples: [],
    supportingCharacterTwistPatterns: [],
    badTwistExamples: []
};

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

const PARTICLE_REGEX = /(은|는|이|가|을|를|와|과|도|에|에서|으로|로|에게|께|한테|까지|부터|만|의)$/;
const STOP_WORDS = new Set([
    '그', '그녀', '그는', '그가', '그를', '그녀를', '여자', '남자', '사람', '주인공', '친구', '상대', '상황', '오늘',
    '지금', '저', '나', '우리', '너', '너희', '말', '대사', '장면', '씬', '장소', '마음', '생각', '느낌'
]);

const normalizeToken = (token: string): string => token.replace(PARTICLE_REGEX, '');

const extractCandidateNames = (script: string, candidates: string[]): string[] => {
    const tokens = script.match(/[가-힣]{2,5}/g) ?? [];
    const frequency = new Map<string, number>();
    const normalizedCandidates = candidates
        .map((candidate) => normalizeToken(candidate.trim()))
        .filter((candidate) => candidate.length >= 2 && !STOP_WORDS.has(candidate));

    normalizedCandidates.forEach((candidate) => {
        if (script.includes(candidate)) {
            frequency.set(candidate, (frequency.get(candidate) ?? 0) + 5);
        }
    });

    tokens.forEach((token) => {
        const normalized = normalizeToken(token);
        if (!normalized || normalized.length < 2) return;
        if (STOP_WORDS.has(normalized)) return;
        const count = frequency.get(normalized) ?? 0;
        frequency.set(normalized, count + 1);
    });

    return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name]) => name);
};
const normalizeSceneNumbers = (items: Scene[]): Scene[] =>
    items.map((scene, index) => ({
        ...scene,
        number: index + 1
    }));

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

type IdentitySlotId = typeof IDENTITY_SLOTS[number]['id'];

interface IdentityCharacter {
    id: string;
    name: string;
    slotId: IdentitySlotId;
    age: string;
    outfitId: string;
    outfitName: string;
    outfitPrompt: string;
    accessories: string[];
}


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
        genre?: string;     // [v3.6] 장르 정보 추가
        totalScenes?: number; // [v3.6] 전체 장면 수 추가
        enableWinterAccessories?: boolean;
    }
): any[] => {
    if (!Array.isArray(scenes)) return [];

    resetAngleHistory();

    const totalScenes = options.totalScenes || scenes.length || 12;
    let characterInfoMap = buildCharacterInfoMap(options.characters, options.targetAgeLabel);
    let accessoryMap = buildAccessoryMap(options.characters, options.enableWinterAccessories);

    if (options.enableWinterAccessories) {
        if (accessoryMap.size === 0 && characterInfoMap.size > 0) {
            accessoryMap = buildWinterAccessoryMap(Array.from(characterInfoMap.keys()));
        }
        const winterized = new Map<string, CharacterInfo>();
        characterInfoMap.forEach((info, id) => {
            const gender = getCharacterGender(id);
            const outfit = (gender === 'female' && info.outfit)
                ? convertToTightLongSleeveWithShoulderLine(info.outfit)
                : info.outfit;
            winterized.set(id, { ...info, outfit });
        });
        characterInfoMap = winterized;
    }

    return scenes.map((scene: any, idx: number) => {
        const sceneNumber = scene.sceneNumber || idx + 1;
        const characterIds = Array.isArray(scene.characterIds) ? scene.characterIds : [];
        const shotType = normalizeShotType(scene.shotType, characterIds);

        // 1. 기존 방식의 강화 (identity, outfit 등 삽입) + v3.6 표정/카메라 앵글
        const sceneGender = characterIds.length === 1
            ? getCharacterGender(characterIds[0])
            : options.gender;
        const sceneOutfit = characterIds.length === 1
            ? characterInfoMap.get(characterIds[0])?.outfit
            : undefined;

        let processedPrompt = enhanceScenePrompt(
            scene.longPrompt || scene.shortPrompt || '',
            {
                sceneNumber,
                femaleOutfit: sceneGender === 'female' ? sceneOutfit : undefined,
                maleOutfit: sceneGender === 'male' ? sceneOutfit : undefined,
                targetAgeLabel: options.targetAgeLabel,
                gender: sceneGender,
                genre: options.genre,         // v3.6
                totalScenes: totalScenes      // v3.6
            }
        );

        // 2. [V3.2] 신규 검증 및 자동 수정 레이어 적용
        // 프롬프트 검증 및 수정
        const characterInfos = characterIds
            .map((id: string) => characterInfoMap.get(id))
            .filter(Boolean) as CharacterInfo[];
        const fallbackCharacters = characterInfos.length > 0
            ? characterInfos
            : Array.from(characterInfoMap.values()).slice(0, 3);
        const validation = validateAndFixPrompt(processedPrompt, shotType, fallbackCharacters);
        processedPrompt = applyAccessoriesToPrompt(validation.fixedPrompt, characterIds, accessoryMap);

        // 3. 네거티브 프롬프트 분리 처리
        const extracted = extractNegativePrompt(processedPrompt);
        processedPrompt = extracted.cleaned;
        if (options.enableWinterAccessories) {
            const genderForWinter = sceneGender || 'female';
            const winterApplied = applyWinterLookToExistingPrompt(
                processedPrompt,
                scene.longPromptKo || '',
                genderForWinter,
                { applyAccessories: false }
            );
            processedPrompt = winterApplied.longPrompt;
            scene.longPromptKo = winterApplied.longPromptKo || scene.longPromptKo;
        }
        const negativePrompt = scene.negativePrompt || extracted.negative || '';

        return {
            ...scene,
            longPrompt: processedPrompt,
            negativePrompt: negativePrompt, // [NEW] 필드 추가
            shortPrompt: scene.shortPrompt ? enhanceScenePrompt(
                scene.shortPrompt,
                { sceneNumber, femaleOutfit: options.femaleOutfit, maleOutfit: options.maleOutfit, targetAgeLabel: options.targetAgeLabel, gender: options.gender, genre: options.genre, totalScenes: totalScenes }
            ) : processedPrompt
        };
    });
};

// ============================================
// 메인 컴포넌트
// ============================================

interface ShortsLabPanelProps {
    targetService?: 'GEMINI' | 'CHATGPT' | 'CLAUDE' | 'GENSPARK';
}

export const ShortsLabPanel: React.FC<ShortsLabPanelProps> = ({ targetService }) => {
    // ===========================================
    // ShortsLab Genre Manager Hook
    // ===========================================
    const {
        genres: labGenres,
        backups: labGenreBackups,
        loading: genresLoading,
        refresh: refreshGenres,
        addGenre,
        updateGenre,
        deleteGenre,
        reset: resetGenres,
        createBackup,
        restoreBackup,
        deleteBackup,
        renameBackup,
        updateBackupContent
    } = useShortsLabGenreManager();

    const {
        rules: labPromptRules,
        backups: labPromptRuleBackups,
        refresh: refreshStep1Rules,
        updateRules: updatePromptRules,
        resetRules: resetPromptRules,
        createBackup: createPromptRulesBackup,
        restoreBackup: restorePromptRulesBackup,
        deleteBackup: deletePromptRulesBackup,
        renameBackup: renamePromptRulesBackup,
        updateBackupContent: updatePromptRulesBackupContent
    } = useShortsLabPromptRulesManager();
    const {
        rules: labStep2Rules,
        backups: labStep2Backups,
        refresh: refreshStep2Rules,
        updateRules: updateStep2Rules,
        resetRules: resetStep2Rules,
        createBackup: createStep2Backup,
        restoreBackup: restoreStep2Backup,
        deleteBackup: deleteStep2Backup,
        renameBackup: renameStep2Backup,
        updateBackupContent: updateStep2BackupContent
    } = useShortsLabStep2PromptRulesManager();
    const {
        rules: characterRules,
        backups: characterRulesBackups, // 원본 변수명 유지
        refresh: refreshCharacterRules,
        updateRules: updateCharacterRules,
        resetRules: resetCharacterRules,
        createBackup: createCharacterRulesBackup, // 원본 변수명 유지
        restoreBackup: restoreCharacterRulesBackup, // 원본 변수명 유지
        deleteBackup: deleteCharacterRulesBackup, // 원본 변수명 유지
        renameBackup: renameCharacterRulesBackup, // 원본 변수명 유지
        updateBackupContent: updateCharacterRulesBackupContent, // 원본 변수명 유지
        addFemaleCharacter,
        addMaleCharacter,
        deleteFemaleCharacter,
        deleteMaleCharacter,
        updateCharacter
    } = useShortsLabCharacterRulesManager();


    // 지침 전체 보기 모달 상태는 GenreManagementModal에서 관리합니다

    // Genre management modal state
    const [showGenreModal, setShowGenreModal] = useState(false);

    // 대본 입력 상태
    const [scriptInput, setScriptInput] = useState('');
    const [scenes, setScenes] = useState<Scene[]>([]);

    // AI 대본 생성 상태 (신규!)
    const [aiTopic, setAiTopic] = useState('');
    const [aiGenre, setAiGenre] = useState('comedy-humor');
    const [aiTargetAge, setAiTargetAge] = useState('40대');
    const [scriptCharacterMode, setScriptCharacterMode] = useState<'slot-only' | 'slot+name'>('slot-only');
    // 겨울 악세서리 자동 적용 토글 (입력 탭 전용)
    const [enableWinterAccessories, setEnableWinterAccessories] = useState(false);
    const [useRandomOutfits, setUseRandomOutfits] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTwoStepGenerating, setIsTwoStepGenerating] = useState(false);
    const [isManualSceneParsing, setIsManualSceneParsing] = useState(false);
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

    // Identity Lock (씬 분해 전 캐릭터/의상/악세서리 고정)
    const [identityLockEnabled, setIdentityLockEnabled] = useState(false);
    const [identityCharacters, setIdentityCharacters] = useState<IdentityCharacter[]>([]);
    const [outfitCatalog, setOutfitCatalog] = useState<OutfitCatalog>({ outfits: [], categories: [] });
    const [isLoadingOutfitCatalog, setIsLoadingOutfitCatalog] = useState(false);
    const [outfitPreviewMap, setOutfitPreviewMap] = useState<Record<string, string>>({});
    const [manualIdentities, setManualIdentities] = useState<CharacterIdentity[]>([]);
    const manualIdentitiesLoadedRef = useRef(false);
    const [manualIdentityLockEnabled, setManualIdentityLockEnabled] = useState(true);
    const [manualCandidateText, setManualCandidateText] = useState('');
    const [manualCandidateList, setManualCandidateList] = useState<string[]>([]);
    const [manualMissingNotice, setManualMissingNotice] = useState('');
    const [manualExtractionNotice, setManualExtractionNotice] = useState('');
    const [manualAnalyzing, setManualAnalyzing] = useState(false);

    // 프롬프트 수정 모달 상태
    const [showPromptEditModal, setShowPromptEditModal] = useState(false);
    const [promptEditSceneNumber, setPromptEditSceneNumber] = useState<number | null>(null);
    const [promptEditOriginal, setPromptEditOriginal] = useState('');
    const [promptEditText, setPromptEditText] = useState('');
    const [promptEditLoading, setPromptEditLoading] = useState(false);
    const [promptEditLoadingType, setPromptEditLoadingType] = useState<'element' | 'detailed' | 'style' | null>(null);
    const [promptEditError, setPromptEditError] = useState<string | null>(null);
    const [promptElementAnalysis, setPromptElementAnalysis] = useState<ElementAnalysis>({});
    const [detailedAnalysis, setDetailedAnalysis] = useState<DetailedAnalysis | null>(null);
    const [promptAnalysisBase, setPromptAnalysisBase] = useState('');
    const promptAnalysisCacheRef = useRef<Record<number, {
        original: string;
        editing: string;
        elementAnalysis: ElementAnalysis;
        detailedAnalysis: DetailedAnalysis | null;
        analysisBase: string;
    }>>({});

    /**
     * 프롬프트 설정 업데이트 헬퍼
     */
    const updateSetting = useCallback(<K extends keyof PromptSettings>(key: K, value: PromptSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    }, []);

    // 프롬프트 수정 모달 hook
    const { handleAnalyzePromptByElement } = usePromptEditModal({
        promptEditOriginal,
        promptEditLoading,
        targetService,
        setPromptEditLoading,
        setPromptEditLoadingType,
        setPromptEditError,
        setPromptElementAnalysis
    });

    // 프롬프트 수정 모달 함수들
    const openPromptEditModal = useCallback((sceneNumber: number, currentPrompt: string) => {
        console.log('🔍 [ShortsLab] 상세 분석 모달 열기:', { sceneNumber, promptLength: currentPrompt?.length });
        const cache = promptAnalysisCacheRef.current[sceneNumber];
        if (cache) {
            setPromptEditSceneNumber(sceneNumber);
            setPromptEditOriginal(cache.original);
            setPromptEditText(cache.editing);
            setPromptEditError(null);
            setPromptElementAnalysis(cache.elementAnalysis || {});
            setDetailedAnalysis(cache.detailedAnalysis || null);
            setPromptAnalysisBase(cache.analysisBase || cache.editing || currentPrompt || '');
        } else {
            setPromptEditSceneNumber(sceneNumber);
            setPromptEditOriginal(currentPrompt || '');
            setPromptEditText(currentPrompt || '');
            setPromptEditError(null);
            setPromptElementAnalysis({});
            setDetailedAnalysis(null); // Reset previous analysis when opening for new scene
            setPromptAnalysisBase(currentPrompt || '');
        }
        setShowPromptEditModal(true);
        console.log('🔍 [ShortsLab] 모달 상태 변경 완료');
    }, []);

    const closePromptEditModal = useCallback(() => {
        setShowPromptEditModal(false);
    }, []);

    const resetPromptEditModal = useCallback(() => {
        if (promptEditSceneNumber !== null) {
            delete promptAnalysisCacheRef.current[promptEditSceneNumber];
        }
        setPromptEditSceneNumber(null);
        setPromptEditOriginal('');
        setPromptEditText('');
        setPromptEditError(null);
        setPromptElementAnalysis({});
        setDetailedAnalysis(null);
        setPromptAnalysisBase('');
    }, [promptEditSceneNumber]);

    useEffect(() => {
        if (promptEditSceneNumber === null) return;
        promptAnalysisCacheRef.current[promptEditSceneNumber] = {
            original: promptEditOriginal,
            editing: promptEditText,
            elementAnalysis: promptElementAnalysis,
            detailedAnalysis,
            analysisBase: promptAnalysisBase || promptEditText || promptEditOriginal
        };
    }, [
        promptEditSceneNumber,
        promptEditOriginal,
        promptEditText,
        promptElementAnalysis,
        detailedAnalysis,
        promptAnalysisBase
    ]);

    // 디버깅: 모달 상태 변화 추적
    useEffect(() => {
        console.log('🔄 [ShortsLab] Modal State Changed:', {
            showPromptEditModal,
            promptEditSceneNumber,
            promptEditTextLength: promptEditText?.length,
            hasDetailedAnalysis: !!detailedAnalysis
        });
    }, [showPromptEditModal, promptEditSceneNumber, promptEditText, detailedAnalysis]);

    // 스타일 적용 함수
    const handleApplyStyle = useCallback(async (styleId: string, model?: string) => {
        setPromptEditLoading(true);
        setPromptEditLoadingType('style');
        try {
            const response = await fetch('http://localhost:3002/api/prompt-style-convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptEditText,
                    targetStyle: styleId,
                    model: model
                })
            });

            if (!response.ok) {
                throw new Error(`API 오류: ${response.status}`);
            }

            const data = await response.json();
            if (data.result?.prompt) {
                setPromptEditText(data.result.prompt);
                const styleName = STYLE_PRESETS.find(p => p.id === styleId)?.name || styleId;
                showToast(`${styleName} 스타일이 적용되었습니다.`, 'success');
            } else {
                throw new Error('스타일 변환 결과가 없습니다.');
            }
        } catch (error) {
            console.error('스타일 변환 실패:', error);
            setPromptEditError(error instanceof Error ? error.message : '스타일 변환에 실패했습니다.');
        } finally {
            setPromptEditLoading(false);
            setPromptEditLoadingType(null);
        }
    }, [promptEditText]);

    // 상세 분석 함수
    const handleDetailedAnalysis = useCallback(async (model?: string) => {
        if (!promptEditText.trim()) {
            setPromptEditError('분석할 프롬프트가 없습니다.');
            return;
        }

        setPromptEditLoading(true);
        setPromptEditLoadingType('detailed');
        setPromptEditError(null);

        try {
            const response = await fetch('http://localhost:3002/api/prompt-analyze-detailed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptEditText,
                    model: model
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API 오류 (${response.status}): ${errorData.error || errorData.details || '서버 응답 실패'}`);
            }

            const data = await response.json();
            console.log('🔍 [ShortsLab] 상세 분석 응답:', data);
            if (data.success && data.analysis) {
                setDetailedAnalysis(data.analysis);
                setPromptAnalysisBase(promptEditText);
                showToast('상세 분석이 완료되었습니다.', 'success');
            } else {
                throw new Error(data.error || data.details || '분석 결과가 없습니다.');
            }
        } catch (error) {
            console.error('상세 분석 실패:', error);
            setPromptEditError(error instanceof Error ? error.message : '상세 분석에 실패했습니다.');
        } finally {
            setPromptEditLoading(false);
            setPromptEditLoadingType(null);
        }
    }, [promptEditText, targetService]);

    useEffect(() => {
        let alive = true;
        setIsLoadingOutfitCatalog(true);
        fetchOutfitCatalog()
            .then((catalog) => {
                if (!alive) return;
                setOutfitCatalog(catalog);
            })
            .finally(() => {
                if (!alive) return;
                setIsLoadingOutfitCatalog(false);
            });
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        let alive = true;
        fetchOutfitPreviewMap()
            .then((map) => {
                if (!alive) return;
                setOutfitPreviewMap(map || {});
            })
            .catch(() => {
                if (!alive) return;
                setOutfitPreviewMap({});
            });
        return () => {
            alive = false;
        };
    }, []);

    const outfitPool = useMemo(() => {
        return buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]);
    }, [outfitCatalog]);

    const outfitOptions = useMemo(() => {
        const categories = outfitCatalog.categories || [];
        const categoryMap = new Map<string, OutfitCategory>();
        categories.forEach((category) => {
            categoryMap.set(category.id, category);
        });

        const grouped: Record<string, OutfitPoolItem[]> = {};
        outfitPool.forEach((item) => {
            const categoryId = item.categories?.[0] || 'ETC';
            if (!grouped[categoryId]) grouped[categoryId] = [];
            grouped[categoryId].push(item);
        });

        const sortedKeys = Object.keys(grouped);
        return {
            grouped,
            sortedKeys,
            categoryMap
        };
    }, [outfitPool, outfitCatalog.categories]);

    const outfitById = useMemo(() => {
        const map = new Map<string, OutfitPoolItem>();
        outfitPool.forEach((item) => {
            map.set(item.id, item);
        });
        return map;
    }, [outfitPool]);

    const manualOutfitPresets = useMemo(() => {
        return outfitPool.map((item) => {
            const imageUrl = outfitPreviewMap[item.id]
                || outfitPreviewMap[item.name]
                || outfitPreviewMap[item.translation || '']
                || '';
            return {
                id: item.id,
                name: item.prompt || item.name,
                translation: item.translation || item.name,
                imageUrl
            };
        });
    }, [outfitPool, outfitPreviewMap]);

    const addManualIdentity = useCallback(() => {
        const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setManualIdentities((prev) => ([
            ...prev,
            {
                id: nextId,
                slotId: '',
                name: '',
                age: '',
                outfit: '',
                accessories: '',
                isLocked: false,
                lockedFields: new Set()
            }
        ]));
    }, []);

    const createManualIdentity = useCallback((overrides: Partial<CharacterIdentity> = {}): CharacterIdentity => {
        const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        return {
            id: nextId,
            slotId: '',
            name: '',
            age: '',
            outfit: '',
            accessories: '',
            isLocked: true,
            lockedFields: new Set(),
            ...overrides
        };
    }, []);

    const updateManualIdentity = useCallback((id: string, updates: Partial<CharacterIdentity>) => {
        setManualIdentities((prev) => prev.map((identity) => (
            identity.id === id ? { ...identity, ...updates } : identity
        )));
    }, []);

    const deleteManualIdentity = useCallback((id: string) => {
        setManualIdentities((prev) => prev.filter((identity) => identity.id !== id));
    }, []);

    const createIdentityCharacter = useCallback((): IdentityCharacter => ({
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `identity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: '',
        slotId: 'woman-a',
        age: '30대',
        outfitId: '',
        outfitName: '',
        outfitPrompt: '',
        accessories: [],
    }), []);

    useEffect(() => {
        if (identityLockEnabled && identityCharacters.length === 0) {
            setIdentityCharacters([createIdentityCharacter()]);
        }
    }, [createIdentityCharacter, identityCharacters.length, identityLockEnabled]);

    const handleAddIdentityCharacter = useCallback(() => {
        setIdentityCharacters((prev) => [...prev, createIdentityCharacter()]);
    }, [createIdentityCharacter]);

    const handleUpdateIdentityCharacter = useCallback((id: string, changes: Partial<IdentityCharacter>) => {
        setIdentityCharacters((prev) => prev.map((char) => (
            char.id === id ? { ...char, ...changes } : char
        )));
    }, []);

    const handleRemoveIdentityCharacter = useCallback((id: string) => {
        setIdentityCharacters((prev) => prev.filter((char) => char.id !== id));
    }, []);

    const toggleAccessory = useCallback((id: string, value: string) => {
        setIdentityCharacters((prev) => prev.map((char) => {
            if (char.id !== id) return char;
            const next = char.accessories.includes(value)
                ? char.accessories.filter((item) => item !== value)
                : [...char.accessories, value];
            return { ...char, accessories: next };
        }));
    }, []);


    // UI 상태
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'input' | 'settings' | 'preview' | 'manual'>('preview');
    const [sceneTabs, setSceneTabs] = useState<Record<number, 'IMG' | 'VIDEO' | 'JSON' | 'VOICE'>>({});
    const [editingScene, setEditingScene] = useState<{ number: number; field: 'ko' | 'en' } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [selectedImageForView, setSelectedImageForView] = useState<string | null>(null);

    // 폴더 불러오기 상태 (신규!)
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [availableFolders, setAvailableFolders] = useState<Array<{ folderName: string; imageCount: number; scriptCount: number; mtimeMs: number }>>([]);
    const [isLoadingFolder, setIsLoadingFolder] = useState(false);
    const [isVideoImporting, setIsVideoImporting] = useState<number | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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
        const loadState = async () => {
            try {
                const savedScenes = await getAppStorageValue<Scene[] | null>('shorts-lab-scenes', null);
                const savedFolder = await getAppStorageValue<string | null>('shorts-lab-folder', null);
                const savedTopic = await getAppStorageValue<string | null>('shorts-lab-topic', null);
                const savedManualIdentities = await getAppStorageValue<any[] | null>('shorts-generator-identities', null);
                const savedManualCandidates = await getAppStorageValue<string | null>('shorts-lab-manual-candidates', null);

                if (savedFolder) setCurrentFolderName(savedFolder);
                if (savedTopic) setAiTopic(savedTopic);
                if (savedManualCandidates) setManualCandidateText(savedManualCandidates);

                if (savedScenes && Array.isArray(savedScenes)) {
                    const normalized = (savedScenes as Scene[]).map(scene => {
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

                if (savedManualIdentities && Array.isArray(savedManualIdentities)) {
                    setManualIdentities(savedManualIdentities.map((identity) => ({
                        ...identity,
                        lockedFields: new Set(identity.lockedFields || [])
                    })));
                    manualIdentitiesLoadedRef.current = true;
                }
            } catch (error) {
                console.warn('[ShortsLab] Failed to restore state:', error);
            } finally {
                manualIdentitiesLoadedRef.current = true;
            }
        };
        loadState();
    }, []);

    React.useEffect(() => {
        const loadFavorites = async () => {
            try {
                const response = await fetch('http://localhost:3002/api/cineboard/favorites');
                if (response.ok) {
                    const data = await response.json();
                    setFavorites(data.favorites || []);
                    console.log(`[ShortsLab] ✅ Loaded ${data.favorites?.length || 0} favorites`);
                }
            } catch (error) {
                console.error('Failed to load favorites:', error);
            }
        };
        loadFavorites();
    }, []);

    // [NEW] 상태 변경 시 app storage 저장
    React.useEffect(() => {
        if (currentFolderName) {
            setAppStorageValue('shorts-lab-folder', currentFolderName);
        } else {
            removeAppStorageValue('shorts-lab-folder');
        }
    }, [currentFolderName]);

    React.useEffect(() => {
        if (aiTopic) {
            setAppStorageValue('shorts-lab-topic', aiTopic);
        } else {
            removeAppStorageValue('shorts-lab-topic');
        }
    }, [aiTopic]);

    React.useEffect(() => {
        if (scenes.length > 0) {
            setAppStorageValue('shorts-lab-scenes', scenes);
        } else {
            removeAppStorageValue('shorts-lab-scenes');
        }
    }, [scenes]);

    React.useEffect(() => {
        if (!manualIdentitiesLoadedRef.current) return;
        const serialized = manualIdentities.map((identity) => ({
            ...identity,
            lockedFields: Array.from(identity.lockedFields || [])
        }));
        setAppStorageValue('shorts-generator-identities', serialized);
    }, [manualIdentities]);

    React.useEffect(() => {
        const parsed = manualCandidateText
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter((value) => value.length >= 2);
        setManualCandidateList(parsed);
        setAppStorageValue('shorts-lab-manual-candidates', manualCandidateText);
    }, [manualCandidateText]);

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
                    try {
                        setSessionApiKey(key);
                        showToast("API Key가 세션에 적용되었습니다. 다시 시도해주세요.", 'success');
                    } catch (storageError) {
                        console.error("Failed to save API key:", storageError);
                        showToast("API Key 저장에 실패했습니다.", 'error');
                    }
                }
            } else {
                showToast(`이미지 생성 실패: ${error.message || "알 수 없는 오류"}`, 'error');
            }
        } finally {
            setGeneratingId(null);
        }
    };

    // ============================================
    // 전체 이미지 생성 핸들러
    // ============================================
    const handleGenerateAllImages = async () => {
        if (scenes.length === 0) {
            showToast('생성할 씬이 없습니다.', 'warning');
            return;
        }

        const scenesWithoutImages = scenes.filter(s => !s.imageUrl && s.prompt);
        if (scenesWithoutImages.length === 0) {
            showToast('모든 씬에 이미지가 있습니다.', 'info');
            return;
        }

        showToast(`${scenesWithoutImages.length}개 씬의 이미지를 생성합니다...`, 'info');

        for (const scene of scenesWithoutImages) {
            try {
                await handleForwardPromptToImageAI(scene.prompt, `scene-${scene.number}`, scene.number);
                // 각 요청 사이에 잠시 대기 (API 제한 방지)
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`Scene ${scene.number} image generation failed:`, error);
            }
        }

        showToast('전체 이미지 생성 완료!', 'success');
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
            const message = error instanceof Error ? error.message : String(error || '');
            if (message.includes('Waiting failed')) {
                showToast('이미지를 찾지 못했습니다. 프롬프트 전송 후 새 이미지가 생성되는지 확인해주세요.', 'warning');
            } else if (/rate|quota|limit/i.test(message)) {
                showToast('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', 'error');
            } else if (/policy|safety|blocked|harm/i.test(message)) {
                showToast('안전 정책으로 인해 이미지 생성이 차단되었습니다.', 'error');
            } else if (/network|failed to fetch|timeout/i.test(message)) {
                showToast('네트워크 오류로 이미지 생성에 실패했습니다.', 'error');
            } else {
                showToast(message || 'AI 서비스 전송 오류가 발생했습니다.', 'error');
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

    const isIdentityLockActive = identityLockEnabled && identityCharacters.length > 0;

    const formatAgeLabel = useCallback((age: string, gender: 'female' | 'male') => {
        const map: Record<string, string> = {
            '10대': '10s',
            '20대': '20s',
            '30대': '30s',
            '40대': '40s',
            '50대': '50s',
            '60대': '60s',
            '70대': '70s'
        };
        const label = map[age] || age;
        if (!label) return '';
        return `in ${gender === 'female' ? 'her' : 'his'} ${label}`;
    }, []);

    const buildIdentityLockPrompt = useCallback(() => {
        if (!isIdentityLockActive) return '';
        const lines = identityCharacters.map((char) => {
            const slotMeta = IDENTITY_SLOTS.find((slot) => slot.id === char.slotId);
            const gender = slotMeta?.gender || 'female';
            const slotLabel = slotMeta?.label || char.slotId;
            const slotPrompt = slotMeta?.presetKey ? SLOT_PRESETS[slotMeta.presetKey].prompt : '';
            const ageText = char.age ? formatAgeLabel(char.age, gender) : '';
            const outfitText = char.outfitPrompt || char.outfitName;
            const accessories = [...char.accessories].filter(Boolean);
            const accessoryText = accessories.length > 0 ? `accessorized with ${accessories.join(', ')}` : '';
            const descriptor = [slotPrompt, ageText, outfitText ? `wearing ${outfitText}` : '', accessoryText]
                .filter(Boolean)
                .join(', ');
            const nameLabel = char.name ? ` (${char.name})` : '';
            return `Slot ${slotLabel}${nameLabel}: ${descriptor || 'character locked'}`;
        });
        return `Character lock: ${lines.join(' | ')}`;
    }, [formatAgeLabel, identityCharacters, isIdentityLockActive]);

    const validateIdentityLock = useCallback(() => {
        if (!isIdentityLockActive) return true;
        const missingOutfit = identityCharacters.filter((char) => !char.outfitPrompt && !char.outfitName);
        if (missingOutfit.length > 0) {
            showToast('Identity Lock: 의상 선택이 비어있는 캐릭터가 있습니다.', 'warning');
            return false;
        }
        return true;
    }, [identityCharacters, isIdentityLockActive]);

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

        // 2. Identity Lock (캐릭터/의상/악세서리 고정)
        if (isIdentityLockActive) {
            const identityPrompt = buildIdentityLockPrompt();
            if (identityPrompt) parts.push(identityPrompt);
        } else {
            // 2-1. 슬롯 시스템
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
    }, [aiTargetAge, buildIdentityLockPrompt, isIdentityLockActive, settings]);

    // ============================================
    // 수동 대본 AI 씬 분해용 헬퍼
    // ============================================

    const getManualSlotMeta = useCallback((slotId: string) => {
        return MANUAL_SLOT_META[slotId] || null;
    }, []);

    const extractManualScriptLines = useCallback((input: string) => {
        const cleaned = input
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => line.replace(/^[\[\(]?\s*(?:씬|scene|장면)\s*\d+\s*[\]\)]?\s*[:：]?\s*/i, '').trim())
            .filter(Boolean);

        if (cleaned.length === 0 && input.trim()) {
            return [input.trim()];
        }

        return cleaned;
    }, []);

    const buildManualIdentityPayload = useCallback((inputScript: string): ManualCharacterPrompt[] => {
        if (!manualIdentityLockEnabled) return [];
        const hasLockedSelection = manualIdentities.some(identity => identity.isLocked);
        const winterMode = isWinterTopic(inputScript);

        return manualIdentities
            .filter(identity => identity.slotId && (identity.isLocked || !hasLockedSelection))
            .map((identity) => {
                const slotMeta = getManualSlotMeta(identity.slotId);
                if (!slotMeta) return null;
                const rawAge = identity.age || aiTargetAge || '';
                const ageLabel = rawAge ? convertAgeToEnglish(rawAge) : '';
                const identityText = slotMeta.gender === 'female'
                    ? `A stunning Korean woman${ageLabel ? ` in her ${ageLabel}` : ''}`
                    : `A handsome Korean man${ageLabel ? ` in his ${ageLabel}` : ''}`;
                const rawOutfit = identity.outfit?.trim() || '';
                const adjustedOutfit = slotMeta.gender === 'female' && rawOutfit && winterMode
                    ? convertToTightLongSleeveWithShoulderLine(rawOutfit)
                    : rawOutfit;
                const accessories = identity.accessories
                    ? identity.accessories.split(',').map(item => item.trim()).filter(Boolean)
                    : [];

                return {
                    id: slotMeta.id,
                    slotLabel: slotMeta.slotLabel,
                    gender: slotMeta.gender,
                    name: identity.name?.trim() || '',
                    identity: identityText,
                    hair: slotMeta.hair,
                    body: identity.body?.trim() || slotMeta.body,
                    outfit: adjustedOutfit,
                    accessories
                };
            })
            .filter((item): item is ManualCharacterPrompt => Boolean(item));
    }, [aiTargetAge, getManualSlotMeta, manualIdentities, manualIdentityLockEnabled]);

    const composeManualPrompt = useCallback((
        rawPrompt: string,
        sceneNumber: number,
        characterIds: string[],
        characterMap: Map<string, ManualCharacterPrompt>,
        guidance?: { expression?: string; camera?: string; action?: string; background?: string }
    ) => {
        const scenePrefix = `Scene ${sceneNumber}.`;
        let remainder = (rawPrompt || '').trim();
        const hadPersonMarkers = /\[Person\s+\d+:/i.test(remainder);

        // Clean up common AI prefixes
        remainder = remainder.replace(/^Scene\s+\d+[.,]?\s*/i, '').trim();
        if (remainder.includes(PROMPT_CONSTANTS.START)) {
            remainder = remainder.replace(PROMPT_CONSTANTS.START, '').trim();
        }
        if (remainder.includes(PROMPT_CONSTANTS.END)) {
            remainder = remainder.replace(PROMPT_CONSTANTS.END, '').trim();
        }
        remainder = remainder.replace(/^,\s*/, '').replace(/,\s*$/, '').trim();

        // [v3.5.3] De-duplication Logic: 
        // If AI already wrote a long prompt, we want to replace its generic character descriptions
        // with our specific [Person X] markers to ensure consistency while avoiding "A stunning Korean woman" appearing twice.

        const actionChunks = (guidance?.action || '').split(/\s*,\s*/).filter(Boolean);
        const expressionChunks = (guidance?.expression || '').split(/\s*,\s*/).filter(Boolean);

        const identityBlock = characterIds
            .map((id, index) => {
                const meta = characterMap.get(id);
                if (!meta) return '';

                const fallbackHair = meta.hair || DEFAULT_CHARACTER_META[meta.id]?.hair || '';
                const fallbackBody = meta.body
                    || DEFAULT_CHARACTER_META[meta.id]?.body
                    || (meta.gender === 'female' ? PROMPT_CONSTANTS.FEMALE_BODY_A : '');

                const outfitPhrase = meta.outfit
                    ? (meta.outfit.toLowerCase().startsWith('wearing ') ? meta.outfit : `wearing ${meta.outfit}`)
                    : '';
                const accessoryPhrase = meta.accessories.length > 0
                    ? `accessorized with ${meta.accessories.join(', ')}`
                    : '';

                const personAction = actionChunks[index] || actionChunks[0] || '';
                const personExpression = expressionChunks[index] || expressionChunks[0] || '';

                const descriptor = [
                    meta.identity,
                    fallbackHair,
                    fallbackBody,
                    outfitPhrase,
                    accessoryPhrase,
                    personAction ? `action: ${personAction}` : '',
                    personExpression ? `expression: ${personExpression}` : ''
                ].filter(Boolean).join(', ');

                // Use Person index for the marker
                return `[Person ${index + 1} (${meta.slotLabel}): ${descriptor}]`;
            })
            .filter(Boolean)
            .join(', ');

        // Try to find where the AI described characters and replace or suppress
        // For now, let's keep it simple: Start with our identity markers, then add the rest.
        const parts = [PROMPT_CONSTANTS.START];
        const actionPrompt = guidance?.action ? translateActionToEnglish(guidance.action) : '';
        const cameraPrompt = guidance?.camera || '';
        const isWideShot = /\bwide\b|establishing|panoramic|bird\'s-eye|overhead/i.test(cameraPrompt);
        const backgroundPrompt = guidance?.background ? guidance.background.trim() : '';
        const environmentBoost = isWideShot
            ? 'scenic backdrop, wide field of view, deep focus, sharp background details'
            : 'environment context';
        const environmentPrompt = [backgroundPrompt, environmentBoost]
            .filter(Boolean)
            .join(', ');

        if (cameraPrompt) parts.push(cameraPrompt);

        // 🔹 [V3.9.2] 마마님 요청: 동작(Action)과 표정을 최우선 배치하여 역동성 강화
        if (guidance?.expression) parts.push(`[${guidance.expression}]`);
        if (actionPrompt) parts.push(actionPrompt);

        if (environmentPrompt) parts.push(environmentPrompt);
        if (identityBlock) parts.push(identityBlock);

        // Suppress AI's attempt to REDESCRIBE characters if we already have the block

        // We look for patterns like "A stunning Korean woman" or "Slot Woman A" and remove them from the remainder
        let cleanedRemainder = remainder;
        if (hadPersonMarkers) {
            cleanedRemainder = cleanedRemainder.replace(/\[Person\s+\d+:[^\]]*\]/gi, '').trim();
        }
        characterIds.forEach((id) => {
            const meta = characterMap.get(id);
            if (!meta) return;
            // Remove things like "A stunning Korean woman", "Woman A", "Slot Woman A"
            const namePattern = new RegExp(`(A\\s+stunning\\s+Korean\\s+woman|A\\s+handsome\\s+Korean\\s+man|Slot\\s+${meta.slotLabel}|${meta.slotLabel})`, 'gi');
            cleanedRemainder = cleanedRemainder.replace(namePattern, '').trim();
        });
        if (actionPrompt && guidance?.action) {
            cleanedRemainder = cleanedRemainder.replace(guidance.action, '').trim();
        }
        cleanedRemainder = cleanedRemainder
            .replace(/\bwearing\s+[^,]+/gi, '')
            .replace(/\boutfit:\s*[^,]+/gi, '')
            .replace(/\bin\s+a\s+[^,]+\s+(knit|coat|jacket|puffer|vest|turtleneck|sweater|hoodie)\b/gi, '')
            .trim();
        if (isWideShot) {
            cleanedRemainder = cleanedRemainder
                .replace(/shallow depth of field/gi, '')
                .replace(/studio (backdrop|lighting)/gi, '')
                .replace(/portrait (lighting|background|shot)/gi, '')
                .trim();
        }
        const adjectivePattern = /\b(stunning|beautiful|attractive|gorgeous|sexy|elegant|handsome)\b\s+(korean\s+)?(woman|man|female|male|lady|gentleman|caddy)\b/gi;
        cleanedRemainder = cleanedRemainder.replace(adjectivePattern, '').trim();

        // Clean up messy commas from replacement
        cleanedRemainder = cleanedRemainder.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();

        if (cleanedRemainder) parts.push(cleanedRemainder);
        parts.push(PROMPT_CONSTANTS.END);

        return `${scenePrefix} ${parts.join(', ')}`;
    }, []);

    const buildManualAiPrompt = useCallback((inputScript: string) => {
        const scriptLines = extractManualScriptLines(inputScript);
        const identities = buildManualIdentityPayload(inputScript);
        return buildManualSceneDecompositionPrompt({
            scriptLines,
            characters: identities.map((identity) => ({
                id: identity.id,
                name: identity.name,
                slotLabel: identity.slotLabel
            }))
        });
    }, [buildManualIdentityPayload, extractManualScriptLines]);

    // ============================================
    // 이벤트 핸들러
    // ============================================

    const handleManualSceneGeneration = async () => {
        if (isManualSceneParsing) return;
        if (!scriptInput.trim()) return;

        setIsManualSceneParsing(true);
        try {
            const selectedService = targetService || 'GEMINI';
            const finalScript = scriptInput.trim();

            // 1단계: 대본에서 스크립트 라인 추출 및 성별 추론
            const scriptLines = extractManualScriptLines(finalScript);
            const inferredScriptGender = inferGenderFromText(finalScript, settings.koreanGender);

            // 2단계: AI 인물 추출
            showToast(`${selectedService} AI로 인물 추출 중...`, 'info');
            const characterExtractPrompt = buildCharacterExtractionPrompt({
                scriptLines,
                defaultGender: inferredScriptGender
            });

            const characterResponse = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,
                    prompt: characterExtractPrompt,
                    maxTokens: 1200,
                    temperature: 0.2,
                    folderName: currentFolderName,
                    skipFolderCreation: true
                })
            });

            if (!characterResponse.ok) {
                throw new Error(`인물 추출 API 오류: ${characterResponse.status}`);
            }

            const characterData = await characterResponse.json();
            const characterText = characterData.rawResponse || characterData.text || characterData.result || '';
            const extractedCharacters = parseCharacterExtractionResponse(characterText);

            // 3단계: 슬롯 매핑
            const slotMap = buildCharacterSlotMapping(extractedCharacters.characters);
            const lineCharacterMap = mapLineCharactersToSlots(extractedCharacters.lineCharacterNames, slotMap);

            const uniqueSlotIds = Array.from(new Set(Array.from(slotMap.values())));
            const hasCaddy = extractedCharacters.characters.some((char) => {
                const name = (char.name || '').trim();
                return /캐디|caddy/i.test(name) || /caddy/i.test(char.role || '');
            });
            const allSlotIds = normalizeSlotList(uniqueSlotIds, settings.koreanGender, hasCaddy);

            const characterList = allSlotIds.map((slotId) => ({
                id: slotId,
                name: '',
                slotLabel: slotId.replace('Woman', 'Woman ').replace('Man', 'Man ')
            }));

            // 4단계: 씬 분해 프롬프트 생성
            const scenePrompt = buildManualSceneDecompositionPrompt({
                scriptLines,
                characters: characterList,
                enableWinterAccessories: enableWinterAccessories
            });

            showToast(`${selectedService} AI로 씬 분해/프롬프트 생성을 진행합니다...`, 'info');
            const sceneResponse = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,
                    prompt: scenePrompt,
                    folderName: currentFolderName,
                    maxTokens: 2000,
                    temperature: 0.6,
                    skipFolderCreation: true
                })
            });

            if (!sceneResponse.ok) {
                throw new Error(`씬 분해 API 오류: ${sceneResponse.status}`);
            }

            const sceneData = await sceneResponse.json();
            const generatedText = sceneData.rawResponse || sceneData.text || sceneData.result || '';

            const parsedResult = parseManualSceneDecompositionResponse(generatedText);
            const scenesSource = parsedResult.scenes || [];

            if (scenesSource.length === 0) {
                throw new Error('씬 분해 결과가 비어있습니다.');
            }

            const consolidatedPayload = {
                title: 'manual_script',
                scriptBody: finalScript,
                scenes: scenesSource,
                characters: extractedCharacters.characters || [],
                lineCharacterNames: extractedCharacters.lineCharacterNames || [],
                source: 'manual'
            };

            try {
                const saveResponse = await fetch('http://localhost:3002/api/save-story', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: 'manual_script',
                        content: JSON.stringify(consolidatedPayload, null, 2),
                        service: selectedService
                    })
                });

                if (saveResponse.ok) {
                    const saveData = await saveResponse.json();
                    if (saveData?.folderName) {
                        setCurrentFolderName(saveData.folderName);
                    }
                } else {
                    showToast('대본 저장에 실패했습니다.', 'warning');
                }
            } catch (saveError) {
                console.error('Failed to save consolidated story:', saveError);
                showToast('대본 저장에 실패했습니다.', 'warning');
            }

            try {
                await fetch('http://localhost:3002/api/scripts/cleanup-empty-folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ minAgeMinutes: 5 })
                });
            } catch (cleanupError) {
                console.warn('Empty folder cleanup skipped:', cleanupError);
            }

            // 5단계: 캐릭터 맵 생성
            const characterIds = characterList.map(item => item.id);
            let autoCharacterMap = buildAutoCharacterMap(characterIds, aiTargetAge, false);
            if (enableWinterAccessories) {
                const winterAccessoryMap = buildWinterAccessoryMap(characterIds);
                const updated = new Map<string, ManualCharacterPrompt>();
                autoCharacterMap.forEach((meta, id) => {
                    const winterOutfit = meta.gender === 'female' && meta.outfit
                        ? convertToTightLongSleeveWithShoulderLine(meta.outfit)
                        : meta.outfit;
                    if (meta.gender !== 'female') {
                        updated.set(id, { ...meta, outfit: winterOutfit });
                        return;
                    }
                    const winterAccessories = winterAccessoryMap.get(id) || [];
                    const accessories = Array.from(new Set([...meta.accessories, ...winterAccessories]));
                    updated.set(id, { ...meta, outfit: winterOutfit, accessories });
                });
                autoCharacterMap = updated;
            }

            // 6단계: 씬별 프롬프트 구성
            const totalScenes = scenesSource.length || scriptLines.length || 8;
            let lastExpressionKeyword = '';
            let lastCameraKeyword = '';
            let lastActionFlavor = '';
            let lastGroupActionFlavor = '';

            const newScenes = scenesSource.map((scene, idx) => {
                const sceneNumber = scene.sceneNumber || idx + 1;
                const sceneText = scene.scriptLine || `장면 ${idx + 1}`;
                const lineSlots = normalizeSceneCharacterIds(
                    lineCharacterMap.get(sceneNumber) || [],
                    slotMap,
                    settings.koreanGender,
                    hasCaddy
                );
                const normalizedSceneIds = normalizeSceneCharacterIds(
                    Array.isArray(scene.characterIds) ? scene.characterIds : [],
                    slotMap,
                    settings.koreanGender,
                    hasCaddy
                );
                const sceneCharacterIds = lineSlots.length > 0
                    ? lineSlots
                    : (normalizedSceneIds.length > 0 ? normalizedSceneIds : [characterIds[0]]);
                let shotType = normalizeShotType(scene.shotType, sceneCharacterIds);
                shotType = enforceShotTypeMix(shotType, sceneCharacterIds, idx, totalScenes);
                const storyStage = getStoryStageBySceneNumber(sceneNumber, totalScenes);
                const expressionCandidates = getExpressionCandidates(aiGenre, storyStage);
                let expression = pickRotatingCandidate(expressionCandidates, idx, lastExpressionKeyword);
                if (!expression) {
                    expression = 'candid, off-guard';
                } else if (lastExpressionKeyword && expression.toLowerCase() === lastExpressionKeyword.toLowerCase()) {
                    if (!expression.toLowerCase().includes('candid')) {
                        expression = `${expression}, candid, off-guard`;
                    }
                }
                const baseCameraPrompt = scene.cameraAngle || getCameraPromptForScene(storyStage);
                const cameraPrompt = pickCameraPrompt(baseCameraPrompt, idx, lastCameraKeyword);
                lastExpressionKeyword = expression;
                const cameraKeyword = detectCameraKeyword(cameraPrompt);
                if (cameraKeyword) {
                    lastCameraKeyword = cameraKeyword;
                }
                const actionFlavor = pickRotatingCandidate(CANDID_ACTION_FLAVORS, idx, lastActionFlavor) || CANDID_ACTION_FLAVORS[0];
                lastActionFlavor = actionFlavor;
                const isGroupShot = sceneCharacterIds.length >= 2;
                const groupActionFlavor = isGroupShot
                    ? pickRotatingCandidate(GROUP_ACTION_FLAVORS, idx, lastGroupActionFlavor) || GROUP_ACTION_FLAVORS[0]
                    : '';
                if (groupActionFlavor) {
                    lastGroupActionFlavor = groupActionFlavor;
                }
                const cleanedLongPrompt = stripCameraPrefix(stripLongPromptMarkers(scene.longPrompt || ''));
                const narrativeParts = mergeNarrativeParts([
                    scene.background,
                    scene.summary,
                    scene.action,
                    actionFlavor,
                    groupActionFlavor,
                    cleanedLongPrompt
                ]);
                const normalizedPrompt = composeManualPrompt(
                    narrativeParts || sceneText,
                    sceneNumber,
                    sceneCharacterIds,
                    autoCharacterMap,
                    { expression, camera: cameraPrompt, action: scene.action, background: scene.background }
                );
                const characterInfos = sceneCharacterIds
                    .map((id) => autoCharacterMap.get(id))
                    .filter(Boolean)
                    .map((item) => ({
                        identity: item!.identity,
                        hair: item!.hair,
                        body: item!.body,
                        outfit: item!.outfit
                    })) as CharacterInfo[];
                const fallbackCharacters = characterInfos.length > 0
                    ? characterInfos
                    : Array.from(autoCharacterMap.values())
                        .slice(0, 3)
                        .map((item) => ({
                            identity: item.identity,
                            hair: item.hair,
                            body: item.body,
                            outfit: item.outfit
                        }));
                const fixed = validateAndFixPrompt(
                    normalizedPrompt,
                    shotType,
                    fallbackCharacters
                );
                let mergedPrompt = fixed.fixedPrompt;
                if (enableWinterAccessories) {
                    const winterGender = sceneCharacterIds.some((id) => getCharacterGender(id) === 'female')
                        ? 'female'
                        : 'male';
                    const winterApplied = applyWinterLookToExistingPrompt(mergedPrompt, '', winterGender, { applyAccessories: false });
                    mergedPrompt = winterApplied.longPrompt;
                }
                const accessoryMap = new Map<string, string[]>();
                sceneCharacterIds.forEach((id) => {
                    const meta = autoCharacterMap.get(id);
                    accessoryMap.set(id, meta?.accessories || []);
                });
                const promptWithAccessories = applyAccessoriesToPrompt(mergedPrompt, sceneCharacterIds, accessoryMap);

                return {
                    number: sceneNumber,
                    text: sceneText,
                    prompt: promptWithAccessories,
                    imageUrl: undefined,
                    shortPromptKo: '',
                    longPromptKo: '',
                    summary: scene.summary || sceneText,
                    camera: scene.background || '',
                    shotType,
                    age: '',
                    outfit: '',
                    isSelected: true,
                    videoPrompt: '',
                    dialogue: '',
                    voiceType: 'narration',
                    narrationText: sceneText,
                    narrationEmotion: '',
                    narrationSpeed: 'normal',
                    lipSyncSpeaker: '',
                    lipSyncSpeakerName: '',
                    lipSyncLine: '',
                    lipSyncEmotion: '',
                    lipSyncTiming: undefined,
                    characterIds: sceneCharacterIds
                } as Scene;
            });

            setScenes(newScenes);
            setActiveTab('preview');
            showToast(`✅ ${selectedService} AI로 인물추출 + 씬 분해 완료! (${newScenes.length}개 씬)`, 'success');
        } catch (error) {
            console.error('Manual scene generation failed:', error);
            const message = error instanceof Error ? error.message : '씬 분해에 실패했습니다.';
            showToast(message, 'error');

            const fallbackParsed = parseScenes(scriptInput);
            if (fallbackParsed.length > 0) {
                const withPrompts = fallbackParsed.map(scene => ({
                    ...scene,
                    prompt: generatePrompt(scene.text)
                }));
                setScenes(normalizeSceneNumbers(withPrompts));
                setActiveTab('preview');
                showToast('AI 파싱 실패로 로컬 씬 분해를 사용했습니다.', 'warning');
            }
        } finally {
            setIsManualSceneParsing(false);
        }
    };

    // ============================================
    // 수동대본 인물 분석/누락 찾기
    // ============================================

    const handleManualAICharacterAnalysis = async () => {
        if (!scriptInput.trim() || manualAnalyzing) return;
        setManualAnalyzing(true);
        setManualExtractionNotice('AI 인물 분석 중...');
        setManualMissingNotice('');

        try {
            const prompt = `
[TASK: CHARACTER ANALYSIS]
Analyze the following script and extract key characters with their detailed visual profiles and personalities.
Output ONLY a JSON array of character objects.

[SCRIPT]
${scriptInput}

[OUTPUT FORMAT]
[
  {
    "name": "Character Name",
    "role": "Role in the story",
    "personality": "Psychological traits, vibes, tone of voice",
    "visualProfile": {
      "hair": "Detailed hairstyle and color (English)",
      "eyes": "Eye shape and mood (English)",
      "bodyType": "Body shape, height, posture (English)",
      "distinctFeatures": "Scars, beauty marks, tattoos, unique accessories (English)",
      "visualVibe": "Overall visual atmosphere (English)"
    }
  }
]
`;
            const response = await fetch('http://localhost:3002/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: targetService ?? 'GEMINI',
                    prompt
                })
            });

            if (!response.ok) throw new Error('AI 분석 실패');
            const data = await response.json();
            const analyzed = Array.isArray(data) ? data : (data.characters || []);

            if (analyzed.length === 0) {
                setManualExtractionNotice('AI 분석 결과가 없습니다.');
                return;
            }

            const slotSequence = ['Woman A', 'Woman B', 'Woman C', 'Woman D', 'Man A', 'Man B'];
            const newIdentities = analyzed.map((char: any, index: number) => {
                const slotId = slotSequence[index % slotSequence.length];
                const bodyFromProfile = typeof char?.visualProfile?.bodyType === 'string'
                    ? char.visualProfile.bodyType
                    : '';
                const body = bodyFromProfile
                    || (typeof char?.body === 'string' ? char.body : '')
                    || (typeof char?.bodyType === 'string' ? char.bodyType : '');
                return createManualIdentity({
                    slotId,
                    name: char.name || '',
                    body,
                    accessories: '',
                    isLocked: true
                });
            });

            setManualIdentities(newIdentities);
            setManualExtractionNotice(`AI 분석 완료 · ${newIdentities.length}명 추출됨`);
        } catch (error) {
            console.error('Manual AI character analysis failed:', error);
            setManualExtractionNotice('AI 분석 실패');
        } finally {
            setManualAnalyzing(false);
        }
    };

    const handleManualFindMissing = () => {
        if (!scriptInput.trim()) {
            setManualMissingNotice('대본이 비어 있습니다.');
            return;
        }
        const currentNames = new Set(manualIdentities.map((identity) => identity.name).filter(Boolean));
        const candidates = manualCandidateList.length > 0
            ? manualCandidateList
            : extractCandidateNames(scriptInput, []);
        const missing = candidates.filter((name) => scriptInput.includes(name) && !currentNames.has(name));

        if (missing.length > 0) {
            const slotSequence = ['Woman A', 'Woman B', 'Woman C', 'Woman D', 'Man A', 'Man B'];
            const newIdentities = missing.map((name, index) => createManualIdentity({
                slotId: slotSequence[(manualIdentities.length + index) % slotSequence.length],
                name,
                isLocked: true
            }));
            setManualIdentities((prev) => [...prev, ...newIdentities]);
            setManualMissingNotice(`새로운 인물 ${missing.length}명을 찾았습니다: ${missing.join(', ')}`);
        } else {
            setManualMissingNotice('누락된 인물을 찾지 못했습니다.');
        }
    };

    const handleParseScenes = () => {
        if (activeTab === 'manual') {
            handleManualSceneGeneration();
            return;
        }
        if (!validateIdentityLock()) return;
        const parsed = parseScenes(scriptInput);
        const withPrompts = parsed.map(scene => ({
            ...scene,
            prompt: generatePrompt(scene.text)
        }));
        setScenes(normalizeSceneNumbers(withPrompts));
        setActiveTab('preview');
    };

    const handleRegeneratePrompts = () => {
        if (scenes.length === 0) return;
        if (!validateIdentityLock()) return;
        const updated = scenes.map(scene => ({
            ...scene,
            prompt: generatePrompt(scene.text)
        }));
        setScenes(updated);
        setActiveTab('preview');
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
                setAppStorageValue('shorts-lab-scenes', updated);
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
            setAppStorageValue('shorts-lab-scenes', updated);
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
                setAppStorageValue('shorts-lab-scenes', updated);
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

    const getAllowedOutfitCategoriesForGenre = useCallback((genreId: string): string[] | undefined => {
        const genreData = labGenres.find(g => g.id === genreId);
        const allowed = genreData?.allowedOutfitCategories;
        return Array.isArray(allowed) && allowed.length > 0 ? allowed : undefined;
    }, [labGenres]);

    const handleAiGenerate = async () => {
        if (!aiTopic.trim()) {
            setGenerationError('주제를 입력해주세요.');
            return;
        }

        setIsGenerating(true);
        setGenerationError(null);

        try {
            // Find selected genre guideline from dynamic genres
            const selectedGenreData = labGenres.find(g => g.id === aiGenre);
            const allowedOutfitCategories = getAllowedOutfitCategoriesForGenre(aiGenre);
            const genreGuideOverride: LabGenreGuideline | undefined = selectedGenreData
                ? {
                    name: selectedGenreData.name,
                    description: selectedGenreData.description,
                    emotionCurve: selectedGenreData.emotionCurve,
                    structure: selectedGenreData.structure,
                    killerPhrases: selectedGenreData.killerPhrases,
                    supportingCharacterPhrasePatterns: selectedGenreData.supportingCharacterPhrasePatterns,
                    bodyReactions: selectedGenreData.bodyReactions,
                    forbiddenPatterns: selectedGenreData.forbiddenPatterns,
                    goodTwistExamples: selectedGenreData.goodTwistExamples,
                    supportingCharacterTwistPatterns: selectedGenreData.supportingCharacterTwistPatterns,
                    badTwistExamples: selectedGenreData.badTwistExamples,
                    allowedOutfitCategories: selectedGenreData.allowedOutfitCategories
                }
                : undefined;

            // ShortsLab lightweight prompt generation with genre guide override
            const prompt = buildLabScriptPrompt({
                topic: aiTopic,
                genre: aiGenre,
                targetAge: aiTargetAge,
                gender: settings.koreanGender,
                genreGuideOverride,
                enableWinterAccessories: enableWinterAccessories,
                useRandomOutfits,
                allowedOutfitCategories,
                characterSlotMode: scriptCharacterMode
            });

            // 선택된 AI 서비스 (기본값: GEMINI)
            const selectedService = targetService || 'GEMINI';

            // 사용자 피드백: 생성 시작
            showToast(`${selectedService} AI로 대본을 생성하고 있습니다...`, 'info');

            // 서버 API 호출 (백엔드는 3002 포트)
            const response = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,  // ← AI 서비스 선택 추가
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
                    if (Array.isArray(scriptData.characters)) {
                        scriptData.characters = scriptData.characters.map((character: any) => {
                            const id = String(character?.id || '').trim();
                            if (id.toLowerCase().startsWith('man') && typeof character.identity === 'string') {
                                const fixedIdentity = character.identity.replace(/\bin her\b/gi, 'in his');
                                return { ...character, identity: fixedIdentity };
                            }
                            return character;
                        });
                    }
                    // [FIX] 후처리 적용: 한국인 정체성, 의상, no text 태그 등
                    const lockedOutfits = scriptData.lockedOutfits || parsed.lockedOutfits;
                    const preferredFemaleOutfit = lockedOutfits?.womanA || settings.selectedOutfit || undefined;
                    const preferredMaleOutfit = lockedOutfits?.manA || undefined;

                    const processedScenes = postProcessAiScenes(scenesSource, {
                        femaleOutfit: preferredFemaleOutfit,
                        maleOutfit: preferredMaleOutfit,
                        targetAgeLabel: aiTargetAge,
                        gender: settings.koreanGender,
                        characters: scriptData.characters || parsed.characters, // 캐릭터 정보 전달
                        genre: aiGenre,                    // v3.6: 장르 정보 전달
                        totalScenes: scenesSource.length,   // v3.6: 전체 장면 수 전달
                        enableWinterAccessories
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

                // 사용자 피드백: 생성 완료
                const selectedService = targetService || 'GEMINI';
                showToast(`✅ ${selectedService} AI로 대본이 생성되었습니다! (${extractedScenes.length}개 씬)`, 'success');
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

    const displayFolders = useMemo(() => {
        const filtered = showFavoritesOnly
            ? availableFolders.filter(folder => favorites.includes(folder.folderName))
            : availableFolders;
        return [...filtered].sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
    }, [availableFolders, favorites, showFavoritesOnly]);

    const toggleFavoritesFilter = () => {
        setShowFavoritesOnly(!showFavoritesOnly);
    };

    const addToFavorites = async (folderName: string) => {
        try {
            const response = await fetch('http://localhost:3002/api/cineboard/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName })
            });

            if (response.ok) {
                const data = await response.json();
                setFavorites(data.favorites || []);
                console.log(`[ShortsLab] ⭐ Added to favorites: ${folderName}`);
            }
        } catch (error) {
            console.error('Failed to add favorite:', error);
        }
    };

    const handleTwoStepGenerate = async () => {
        if (!aiTopic.trim()) {
            setGenerationError('주제를 입력해주세요.');
            return;
        }
        if (isGenerating || isTwoStepGenerating) return;

        setIsTwoStepGenerating(true);
        setGenerationError(null);

        try {
            // 🔹 [V3.9.2] 최신 규칙 강제 로드 (매니저 설정 실시간 동기화)
            await Promise.all([
                refreshStep1Rules(),
                refreshStep2Rules(),
                refreshCharacterRules(),
                refreshGenres()
            ]);

            const inferredTopicGender = inferGenderFromText(aiTopic, settings.koreanGender);

            const selectedGenreData = labGenres.find(g => g.id === aiGenre);
            const allowedOutfitCategories = getAllowedOutfitCategoriesForGenre(aiGenre);
            const genreGuideOverride: LabGenreGuideline | undefined = selectedGenreData
                ? {
                    name: selectedGenreData.name,
                    description: selectedGenreData.description,
                    emotionCurve: selectedGenreData.emotionCurve,
                    structure: selectedGenreData.structure,
                    killerPhrases: selectedGenreData.killerPhrases,
                    supportingCharacterPhrasePatterns: selectedGenreData.supportingCharacterPhrasePatterns,
                    bodyReactions: selectedGenreData.bodyReactions,
                    forbiddenPatterns: selectedGenreData.forbiddenPatterns,
                    goodTwistExamples: selectedGenreData.goodTwistExamples,
                    supportingCharacterTwistPatterns: selectedGenreData.supportingCharacterTwistPatterns,
                    badTwistExamples: selectedGenreData.badTwistExamples,
                    allowedOutfitCategories: selectedGenreData.allowedOutfitCategories
                }
                : undefined;

            const scriptPrompt = buildLabScriptOnlyPrompt({
                topic: aiTopic,
                genre: aiGenre,
                targetAge: aiTargetAge,
                gender: inferredTopicGender,
                genreGuideOverride,
                enableWinterAccessories,
                allowedOutfitCategories,
                characterSlotMode: scriptCharacterMode
            });

            const selectedService = targetService || 'GEMINI';
            showToast(`${selectedService} AI로 대본만 생성합니다...`, 'info');

            const scriptResponse = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,
                    prompt: scriptPrompt,
                    maxTokens: 2000,
                    temperature: 0.7,
                    skipFolderCreation: true
                })
            });

            if (!scriptResponse.ok) {
                throw new Error(`API 오류: ${scriptResponse.status}`);
            }

            const scriptData = await scriptResponse.json();
            const scriptText = scriptData.rawResponse || scriptData.text || scriptData.result || '';
            const scriptFolderName = scriptData._folderName;

            let jsonClean = scriptText.trim();
            jsonClean = jsonClean.replace(/^(JSON|json)\s+/, "").trim();
            if (jsonClean.startsWith("```")) {
                jsonClean = jsonClean.replace(/^```(json)?/, "").replace(/```$/, "").trim();
            }

            const parsed = parseJsonFromText<any>(jsonClean, ["title", "titleOptions", "scriptBody", "punchline", "hook", "twist", "foreshadowing", "narrator", "emotionFlow"]);
            if (!parsed) {
                throw new Error('대본 JSON 파싱 실패');
            }

            const scriptTitle = (parsed.title || aiTopic || '').trim() || '무제대본';

            const rawScript = parsed.scriptBody || parsed.script || parsed.text || '';
            if (!rawScript || !rawScript.trim()) {
                throw new Error('대본 내용이 비어있습니다.');
            }

            const finalScript = rawScript.trim();
            setScriptInput(finalScript);

            const scriptLines = extractManualScriptLines(finalScript);
            const inferredScriptGender = inferGenderFromText(`${aiTopic} ${finalScript}`, inferredTopicGender);

            const characterExtractPrompt = buildCharacterExtractionPrompt({
                scriptLines,
                defaultGender: inferredScriptGender
            });

            const characterResponse = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,
                    prompt: characterExtractPrompt,
                    maxTokens: 1200,
                    temperature: 0.2,
                    folderName: scriptFolderName,
                    skipFolderCreation: true
                })
            });

            if (!characterResponse.ok) {
                throw new Error(`API 오류: ${characterResponse.status}`);
            }

            const characterData = await characterResponse.json();
            const characterText = characterData.rawResponse || characterData.text || characterData.result || '';
            const extractedCharacters = parseCharacterExtractionResponse(characterText);

            const slotMap = buildCharacterSlotMapping(extractedCharacters.characters);
            const lineCharacterMap = mapLineCharactersToSlots(extractedCharacters.lineCharacterNames, slotMap);

            const uniqueSlotIds = Array.from(new Set(Array.from(slotMap.values())));
            const hasCaddy = extractedCharacters.characters.some((char) => {
                const name = (char.name || '').trim();
                return /캐디|caddy/i.test(name) || /caddy/i.test(char.role || '');
            });
            const allSlotIds = normalizeSlotList(uniqueSlotIds, settings.koreanGender, hasCaddy);

            // [v3.5.3] 의상 선택 방식 결정 (랜덤 선택 옵션 준수)
            const characterList = allSlotIds.map((slotId) => {
                const gender = slotId.startsWith('Woman') ? 'female' : 'male';
                let outfit = '';

                if (useRandomOutfits) {
                    // 랜덤 선택 ON인 경우 로컬 카탈로그에서 미리 할당
                    if (gender === 'female') {
                        outfit = pickFemaleOutfit(aiGenre, aiTopic, [], allowedOutfitCategories);
                    } else {
                        outfit = pickMaleOutfit(aiTopic, [], allowedOutfitCategories);
                    }
                }

                return {
                    id: slotId,
                    name: '',
                    slotLabel: slotId.replace('Woman', 'Woman ').replace('Man', 'Man '),
                    outfit: outfit
                };
            });

            // 🔹 [V3.9.3] autoCharacterMap 초기화를 위로 이동하여 참조 오류 방지 및 일관성 확보
            const characterIds = characterList.map(item => item.id);
            let autoCharacterMap = buildAutoCharacterMap(characterIds, aiTargetAge, enableWinterAccessories);

            const scenePrompt = buildManualSceneDecompositionPrompt({
                scriptLines,
                characters: characterList,
                enableWinterAccessories: enableWinterAccessories
            });


            showToast(`${selectedService} AI로 씬 분해/프롬프트 생성을 진행합니다...`, 'info');
            const sceneResponse = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,
                    prompt: scenePrompt,
                    folderName: scriptFolderName,
                    maxTokens: 2000,
                    temperature: 0.6,
                    skipFolderCreation: true
                })
            });

            if (!sceneResponse.ok) {
                throw new Error(`API 오류: ${sceneResponse.status}`);
            }

            const sceneData = await sceneResponse.json();
            const generatedText = sceneData.rawResponse || sceneData.text || sceneData.result || '';

            const parsedResult = parseManualSceneDecompositionResponse(generatedText);
            let scenesSource = parsedResult.scenes || [];
            const llmOutfits = parsedResult.lockedOutfits || {};

            if (scenesSource.length === 0) {
                throw new Error('씬 분해 결과가 비어있습니다.');
            }


            const consolidatedPayload = {
                title: scriptTitle,
                scriptBody: finalScript,
                scenes: scenesSource,
                characters: extractedCharacters.characters || [],
                lineCharacterNames: extractedCharacters.lineCharacterNames || [],
                lockedOutfits: llmOutfits,
                source: 'step2'
            };

            try {
                const saveResponse = await fetch('http://localhost:3002/api/save-story', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: scriptTitle,
                        content: JSON.stringify(consolidatedPayload, null, 2),
                        service: selectedService
                    })
                });

                if (saveResponse.ok) {
                    const saveData = await saveResponse.json();
                    if (saveData?.folderName) {
                        setCurrentFolderName(saveData.folderName);
                    }
                } else {
                    showToast('대본 저장에 실패했습니다.', 'warning');
                }
            } catch (saveError) {
                console.error('Failed to save consolidated story:', saveError);
                showToast('대본 저장에 실패했습니다.', 'warning');
            }

            try {
                await fetch('http://localhost:3002/api/scripts/cleanup-empty-folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ minAgeMinutes: 5 })
                });
            } catch (cleanupError) {
                console.warn('Empty folder cleanup skipped:', cleanupError);
            }

            // [v3.5.3] LLM 선택 모드일 경우 AI가 고른 의상을 맵에 덮어쓰기 + 마마님 겨울 변환 로직 적용

            if (!useRandomOutfits && Object.keys(llmOutfits).length > 0) {
                autoCharacterMap.forEach((meta, id) => {
                    const slotKey = id.charAt(0).toLowerCase() + id.slice(1);
                    let chosenOutfit = llmOutfits[id] || llmOutfits[slotKey] || meta.outfit;

                    // 마마님의 철학: 겨울이면 딥브이넥->오프숄더, 짧은소매->긴팔로 강제 치환
                    if (enableWinterAccessories && chosenOutfit) {
                        chosenOutfit = convertToTightLongSleeveWithShoulderLine(chosenOutfit);
                    }

                    autoCharacterMap.set(id, { ...meta, outfit: chosenOutfit });
                });
            }
            if (enableWinterAccessories) {
                const winterAccessoryMap = buildWinterAccessoryMap(characterIds);
                const updated = new Map<string, ManualCharacterPrompt>();
                autoCharacterMap.forEach((meta, id) => {
                    const winterAccessories = winterAccessoryMap.get(id) || [];
                    const accessories = Array.from(new Set([...meta.accessories, ...winterAccessories]));
                    updated.set(id, { ...meta, accessories });
                });
                autoCharacterMap = updated;
            }
            const totalScenes = scenesSource.length || scriptLines.length || 8;
            let lastExpressionKeyword = '';
            let lastCameraKeyword = '';
            let lastActionFlavor = '';
            let lastGroupActionFlavor = '';

            const newScenes = scenesSource.map((scene, idx) => {
                const sceneNumber = scene.sceneNumber || idx + 1;
                const sceneText = scene.scriptLine || `장면 ${idx + 1}`;
                const lineSlots = normalizeSceneCharacterIds(
                    lineCharacterMap.get(sceneNumber) || [],
                    slotMap,
                    settings.koreanGender,
                    hasCaddy
                );
                const normalizedSceneIds = normalizeSceneCharacterIds(
                    Array.isArray(scene.characterIds) ? scene.characterIds : [],
                    slotMap,
                    settings.koreanGender,
                    hasCaddy
                );
                const sceneCharacterIds = lineSlots.length > 0
                    ? lineSlots
                    : (normalizedSceneIds.length > 0 ? normalizedSceneIds : [characterIds[0]]);
                let shotType = normalizeShotType(scene.shotType, sceneCharacterIds);
                shotType = enforceShotTypeMix(shotType, sceneCharacterIds, idx, totalScenes);
                const storyStage = getStoryStageBySceneNumber(sceneNumber, totalScenes);
                const expressionCandidates = getExpressionCandidates(aiGenre, storyStage);
                let expression = pickRotatingCandidate(expressionCandidates, idx, lastExpressionKeyword);
                if (!expression) {
                    expression = 'candid, off-guard';
                } else if (lastExpressionKeyword && expression.toLowerCase() === lastExpressionKeyword.toLowerCase()) {
                    if (!expression.toLowerCase().includes('candid')) {
                        expression = `${expression}, candid, off-guard`;
                    }
                }
                const baseCameraPrompt = scene.cameraAngle || getCameraPromptForScene(storyStage);
                const cameraPrompt = pickCameraPrompt(baseCameraPrompt, idx, lastCameraKeyword);
                lastExpressionKeyword = expression;
                const cameraKeyword = detectCameraKeyword(cameraPrompt);
                if (cameraKeyword) {
                    lastCameraKeyword = cameraKeyword;
                }
                const actionFlavor = pickRotatingCandidate(CANDID_ACTION_FLAVORS, idx, lastActionFlavor) || CANDID_ACTION_FLAVORS[0];
                lastActionFlavor = actionFlavor;
                const isGroupShot = sceneCharacterIds.length >= 2;
                const groupActionFlavor = isGroupShot
                    ? pickRotatingCandidate(GROUP_ACTION_FLAVORS, idx, lastGroupActionFlavor) || GROUP_ACTION_FLAVORS[0]
                    : '';
                if (groupActionFlavor) {
                    lastGroupActionFlavor = groupActionFlavor;
                }
                const cleanedLongPrompt = stripCameraPrefix(stripLongPromptMarkers(scene.longPrompt || ''));
                const narrativeParts = mergeNarrativeParts([
                    scene.background,
                    scene.summary,
                    scene.action,
                    actionFlavor,
                    groupActionFlavor,
                    cleanedLongPrompt
                ]);
                const normalizedPrompt = composeManualPrompt(
                    narrativeParts || sceneText,
                    sceneNumber,
                    sceneCharacterIds,
                    autoCharacterMap,
                    { expression, camera: cameraPrompt, action: scene.action, background: scene.background }
                );
                const characterInfos = sceneCharacterIds
                    .map((id) => autoCharacterMap.get(id))
                    .filter(Boolean)
                    .map((item) => ({
                        identity: item!.identity,
                        hair: item!.hair,
                        body: item!.body,
                        outfit: item!.outfit
                    })) as CharacterInfo[];
                const fallbackCharacters = characterInfos.length > 0
                    ? characterInfos
                    : Array.from(autoCharacterMap.values())
                        .slice(0, 3)
                        .map((item) => ({
                            identity: item.identity,
                            hair: item.hair,
                            body: item.body,
                            outfit: item.outfit
                        }));
                const fixed = validateAndFixPrompt(
                    normalizedPrompt,
                    shotType,
                    fallbackCharacters
                );
                let mergedPrompt = fixed.fixedPrompt;
                if (enableWinterAccessories) {
                    const winterGender = sceneCharacterIds.some((id) => getCharacterGender(id) === 'female')
                        ? 'female'
                        : 'male';
                    const winterApplied = applyWinterLookToExistingPrompt(mergedPrompt, '', winterGender, { applyAccessories: false });
                    mergedPrompt = winterApplied.longPrompt;
                }
                const accessoryMap = new Map<string, string[]>();
                sceneCharacterIds.forEach((id) => {
                    const meta = autoCharacterMap.get(id);
                    accessoryMap.set(id, meta?.accessories || []);
                });
                const promptWithAccessories = applyAccessoriesToPrompt(mergedPrompt, sceneCharacterIds, accessoryMap);

                return {
                    number: sceneNumber,
                    text: sceneText,
                    prompt: promptWithAccessories,
                    imageUrl: undefined,
                    shortPromptKo: '',
                    longPromptKo: '',
                    summary: scene.summary || sceneText,
                    camera: scene.background || '',
                    shotType,
                    age: '',
                    outfit: '',
                    isSelected: true,
                    videoPrompt: '',
                    dialogue: '',
                    voiceType: 'narration',
                    narrationText: sceneText,
                    narrationEmotion: '',
                    narrationSpeed: 'normal',
                    lipSyncSpeaker: '',
                    lipSyncLine: '',
                    lipSyncEmotion: '',
                    lipSyncTiming: undefined,
                    characterIds: sceneCharacterIds
                } as Scene;
            });

            setScenes(newScenes);
            setActiveTab('preview');
            showToast('2단계 생성이 완료되었습니다.', 'success');
        } catch (error: any) {
            console.error('2단계 생성 실패:', error);
            showToast(error?.message || '2단계 생성 실패', 'error');
        } finally {
            setIsTwoStepGenerating(false);
        }
    };

    const removeFromFavorites = async (folderName: string) => {
        try {
            const response = await fetch(`http://localhost:3002/api/cineboard/favorites/${encodeURIComponent(folderName)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                setFavorites(data.favorites || []);
                console.log(`[ShortsLab] 🗑️ Removed from favorites: ${folderName}`);
            }
        } catch (error) {
            console.error('Failed to remove favorite:', error);
        }
    };

    const isFavorite = (folderName: string) => favorites.includes(folderName);

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

    const handleOpenImageFolder = async () => {
        const fallbackName = aiTopic?.trim()?.replace(/\s+/g, '_');
        const folderName = currentFolderName || fallbackName;
        if (!folderName) {
            showToast('열 수 있는 폴더가 없습니다.', 'warning');
            return;
        }

        try {
            const response = await fetch('http://localhost:3002/api/open-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName })
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || payload?.success === false) {
                throw new Error(payload?.error || '폴더 열기 실패');
            }
            showToast('이미지 폴더를 열었습니다.', 'success');
        } catch (error) {
            console.error('Failed to open image folder:', error);
            showToast(error instanceof Error ? error.message : '폴더 열기에 실패했습니다.', 'error');
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

    const handleApplyWinterLook = (sceneNumber: number) => {
        setScenes(prev => prev.map(s => {
            if (s.number === sceneNumber) {
                const gender = (s.lipSyncSpeaker?.toLowerCase().startsWith('man')) ? 'male' : 'female';
                const { longPrompt, longPromptKo } = applyWinterLookToExistingPrompt(s.prompt, s.longPromptKo || '', gender);
                return { ...s, prompt: longPrompt, longPromptKo };
            }
            return s;
        }));
        showToast(`${sceneNumber}번 장면에 겨울 룩이 적용되었습니다.`, 'success');
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
            setScenes(prev => normalizeSceneNumbers(prev.filter(s => s.number !== sceneNumber)));
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

                        {/* 불러오기 버튼 - 쇼츠 랩 옆으로 이동 */}
                        <button
                            onClick={handleLoadFolders}
                            className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <Folder className="w-4 h-4" />
                            불러오기
                        </button>

                        {/* 테스트: 모달 강제 열기 버튼 (임시) */}
                        <button
                            onClick={() => {
                                console.log('🧪 [TEST] 강제 모달 열기 테스트');
                                openPromptEditModal(1, 'A stunning Korean woman in her mid-20s');
                            }}
                            className="px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <Edit3 className="w-4 h-4" />
                            모달 테스트
                        </button>

                        {/* 전체 이미지 생성 버튼 */}
                        <button
                            onClick={handleGenerateAllImages}
                            disabled={scenes.length === 0 || generatingId !== null || aiForwardingId !== null}
                            className="px-3 py-1.5 bg-purple-600/80 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                        >
                            <ImageIcon className="w-4 h-4" />
                            전체이미지생성
                        </button>
                    </div>

                    {/* 탭 버튼 */}
                    <div className="flex gap-1 bg-slate-900 rounded-lg p-1">
                        {(['input', 'settings', 'preview', 'manual'] as const).map((tab) => (
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
                                {tab === 'manual' && <Edit3 className="w-4 h-4" />}
                                {tab === 'input'
                                    ? '입력'
                                    : tab === 'settings'
                                        ? '설정'
                                        : tab === 'preview'
                                            ? '미리보기'
                                            : '수동대본만들기'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 폴더 선택 모달 */}
            {showFolderPicker && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowFolderPicker(false)}
                >
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-emerald-400">📁 작업 폴더 선택</h3>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={toggleFavoritesFilter}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition flex items-center gap-1 ${showFavoritesOnly
                                        ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'
                                        : 'bg-slate-700 border border-slate-600 text-slate-400 hover:text-slate-300'
                                        }`}
                                >
                                    <span>{showFavoritesOnly ? '⭐' : '☆'}</span>
                                    <span>{showFavoritesOnly ? '즐겨찾기만' : '전체 보기'}</span>
                                </button>
                                <button onClick={() => setShowFolderPicker(false)} className="text-slate-400 hover:text-white transition">✕</button>
                            </div>
                        </div>
                        {isLoadingFolder ? (
                            <div className="py-12 text-center">
                                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-emerald-500" />
                                <p className="text-slate-400">폴더 데이터를 불러오는 중...</p>
                            </div>
                        ) : displayFolders.length === 0 ? (
                            <div className="py-12 text-center text-slate-500">
                                <p>
                                    {showFavoritesOnly
                                        ? '즐겨찾기한 폴더가 없습니다.'
                                        : '저장된 작업 폴더가 없습니다.'
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {displayFolders.map((folder) => (
                                    <div
                                        key={folder.folderName}
                                        onClick={() => handleSelectFolder(folder.folderName)}
                                        className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-emerald-500 transition-all text-left group cursor-pointer"
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleSelectFolder(folder.folderName);
                                            }
                                        }}
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
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        isFavorite(folder.folderName)
                                                            ? removeFromFavorites(folder.folderName)
                                                            : addToFavorites(folder.folderName);
                                                    }}
                                                    className={`p-1.5 rounded-lg transition ${isFavorite(folder.folderName)
                                                        ? 'text-yellow-400 hover:text-yellow-300'
                                                        : 'text-slate-500 hover:text-yellow-400'
                                                        }`}
                                                    title={isFavorite(folder.folderName) ? '즐겨찾기 제거' : '즐겨찾기 추가'}
                                                >
                                                    {isFavorite(folder.folderName) ? '⭐' : '☆'}
                                                </button>
                                                <span className="text-slate-500 group-hover:text-emerald-400 transition">→</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 메인 컨텐츠 */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* 입력/수동 탭 */}
                {(activeTab === 'input' || activeTab === 'manual') && (
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* 왼쪽: 대본 입력 및 생성 영역 (8/12) */}
                        <div className="flex-1 space-y-6">
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
                                            <div className="flex gap-2">
                                                <select
                                                    value={aiGenre}
                                                    onChange={(e) => setAiGenre(e.target.value)}
                                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm"
                                                    disabled={genresLoading}
                                                >
                                                    {labGenres.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                                </select>
                                                <button
                                                    onClick={() => setShowGenreModal(true)}
                                                    className="px-3 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                                                    title="장르 관리"
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                </button>
                                            </div>
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

                                    <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <div>
                                            <div className="text-sm font-medium text-slate-300">캐릭터 고정 방식</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">캐디는 WomanD 고정</div>
                                        </div>
                                        <div className="flex items-center bg-slate-900/60 border border-slate-700 rounded-full p-0.5">
                                            <button
                                                onClick={() => setScriptCharacterMode('slot-only')}
                                                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${scriptCharacterMode === 'slot-only'
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                            >
                                                슬롯만
                                            </button>
                                            <button
                                                onClick={() => setScriptCharacterMode('slot+name')}
                                                className={`px-3 py-1 text-[11px] font-bold rounded-full transition-all ${scriptCharacterMode === 'slot+name'
                                                    ? 'bg-purple-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                            >
                                                슬롯+이름
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <button
                                            onClick={handleAiGenerate}
                                            disabled={isGenerating || isTwoStepGenerating || !aiTopic.trim()}
                                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                        >
                                            {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> AI가 대본을 작성 중...</> : <><Wand2 className="w-5 h-5" /> AI 대본 생성</>}
                                        </button>
                                        <button
                                            onClick={handleTwoStepGenerate}
                                            disabled={isGenerating || isTwoStepGenerating || !aiTopic.trim()}
                                            className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                        >
                                            {isTwoStepGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> 2단계 생성 중...</> : <><Sparkles className="w-5 h-5" /> 2단계 생성</>}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {activeTab === 'input' && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-300">겨울 악세서리 추가</span>
                                            <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">여성 전용</span>
                                        </div>
                                        <button
                                            onClick={() => setEnableWinterAccessories(!enableWinterAccessories)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableWinterAccessories ? 'bg-purple-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableWinterAccessories ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-300">
                                                {useRandomOutfits ? '의상 랜덤 선택' : '의상 LLM 선택'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 bg-slate-700/50 px-1.5 py-0.5 rounded">
                                                {useRandomOutfits ? 'ON: 랜덤 선택' : 'ON: LLM 선택'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setUseRandomOutfits(!useRandomOutfits)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useRandomOutfits ? 'bg-emerald-600' : 'bg-slate-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${useRandomOutfits ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            )}

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

                            {/* 입력 탭에서는 인물 고정 UI 미표시 */}

                            <button
                                onClick={handleParseScenes}
                                disabled={!scriptInput.trim() || isManualSceneParsing}
                                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                            >
                                {activeTab === 'manual' && isManualSceneParsing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        AI 씬 분해 중...
                                    </>
                                ) : (
                                    <>
                                        <Scissors className="w-5 h-5" />
                                        씬 분해 & 프롬프트 생성
                                    </>
                                )}
                            </button>
                        </div>

                        {/* 오른쪽: 캐릭터 및 의상 관리 패널 (4/12) */}
                        <div className={activeTab === 'manual'
                            ? 'w-full flex-1 min-w-[420px]'
                            : 'w-full lg:w-[400px] flex-shrink-0'}
                        >
                            {activeTab === 'manual' ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-purple-900/40 rounded-lg text-purple-300">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-100">인물 고정</h3>
                                                <p className="text-[10px] text-slate-400">수동대본 = 캐릭터/의상/악세 고정형 씬 분해</p>
                                                <p className="text-[10px] text-slate-500">선택한 값만 프롬프트에 반영, 미선택은 제외됩니다.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                <span>인물 고정</span>
                                                <button
                                                    onClick={() => setManualIdentityLockEnabled(!manualIdentityLockEnabled)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${manualIdentityLockEnabled ? 'bg-purple-600' : 'bg-slate-700'
                                                        }`}
                                                    title="인물 고정 토글"
                                                >
                                                    <span
                                                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${manualIdentityLockEnabled ? 'translate-x-5' : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                            <button
                                                onClick={addManualIdentity}
                                                className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-700 bg-slate-900 text-purple-300 hover:border-purple-500 transition-all flex items-center gap-1.5"
                                            >
                                                <Plus className="w-3 h-3" /> 캐릭터 추가
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={handleManualAICharacterAnalysis}
                                            disabled={!scriptInput.trim() || manualAnalyzing}
                                            className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-purple-500/50 bg-purple-900/40 text-purple-200 hover:border-purple-400 transition-all disabled:opacity-50"
                                        >
                                            {manualAnalyzing ? 'AI 인물 분석 중...' : 'AI 인물 분석'}
                                        </button>
                                        <button
                                            onClick={handleManualFindMissing}
                                            disabled={!scriptInput.trim()}
                                            className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 transition-all disabled:opacity-50"
                                        >
                                            누락 인물 찾기
                                        </button>
                                        <div className="text-[10px] text-slate-500">
                                            후보명 목록(선택): {manualCandidateList.length > 0 ? `${manualCandidateList.length}개` : '없음'}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                                        <div className="text-[10px] text-slate-500 mb-1">인물 후보 리스트 (쉼표/줄바꿈)</div>
                                        <textarea
                                            value={manualCandidateText}
                                            onChange={(e) => setManualCandidateText(e.target.value)}
                                            placeholder="예: 지영, 혜경, 준호\n캐디, 민수"
                                            className="w-full h-16 bg-slate-900 border border-slate-800 rounded-md p-2 text-[10px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                                        />
                                        {manualExtractionNotice && (
                                            <div className="mt-1 text-[10px] text-purple-300">{manualExtractionNotice}</div>
                                        )}
                                        {manualMissingNotice && (
                                            <div className="mt-1 text-[10px] text-amber-300">{manualMissingNotice}</div>
                                        )}
                                    </div>
                                    {manualIdentities.length > 0 ? (
                                        <div className={`grid grid-cols-1 xl:grid-cols-2 gap-3 ${manualIdentityLockEnabled ? '' : 'opacity-60 pointer-events-none'}`}>
                                            {manualIdentities.map((identity) => (
                                                <ShortsIdentityCard
                                                    key={identity.id}
                                                    identity={identity}
                                                    onUpdate={updateManualIdentity}
                                                    onDelete={deleteManualIdentity}
                                                    outfitPresets={manualOutfitPresets}
                                                    showOutfitGallery
                                                    showAccessoryGallery
                                                    accessoryGroups={GENERAL_ACCESSORIES}
                                                    winterAccessoryOptions={WINTER_ACCESSORIES}
                                                    showLockControls={false}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="border border-dashed border-slate-700 rounded-xl p-6 text-center text-xs text-slate-500">
                                            설정된 캐릭터가 없습니다. [캐릭터 추가]를 눌러 시작하세요.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <CharacterPanel
                                    selectedSlot={settings.selectedSlot}
                                    onCharacterSelect={(char, slot) => {
                                        if (char) {
                                            updateSetting('selectedSlot', slot as any);
                                            updateSetting('useSlotSystem', true);
                                            showToast(`${char.name} 캐릭터가 ${slot} 슬롯에 설정되었습니다.`, 'success');
                                        }
                                    }}
                                    onOutfitSelect={(outfit) => {
                                        if (outfit) {
                                            updateSetting('selectedOutfit', outfit.prompt);
                                            updateSetting('useOutfitKeywords', true);
                                            showToast(`'${outfit.name}' 의상이 설정되었습니다.`, 'success');
                                        }
                                    }}
                                />
                            )}
                        </div>
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
                                                <span className="bg-black/70 backdrop-blur-md text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">장면 {scene.number}</span>
                                                {scene.shotType && <span className="bg-black/70 backdrop-blur-md text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-700/50 uppercase">{scene.shotType}</span>}
                                                <span className={`bg-black/70 backdrop-blur-md text-[10px] font-bold px-2 py-0.5 rounded-md border ${getVoiceBadge(scene).tone}`}>{getVoiceBadge(scene).label}</span>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleOpenImageFolder();
                                                    }}
                                                    className="bg-black/70 hover:bg-black/80 backdrop-blur-md text-slate-200 border border-slate-700/60 rounded-md p-1 transition-colors"
                                                    title="이미지 폴더 열기"
                                                    aria-label="이미지 폴더 열기"
                                                >
                                                    <Folder className="w-3 h-3" />
                                                </button>
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
                                                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-40">이미지 없음</span>
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
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">한국어 프롬프트</span>
                                                                <button onClick={() => handleStartEdit(scene.number, 'ko', scene.longPromptKo || '')} className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-slate-800 rounded transition-all"><Edit3 className="w-3 h-3 text-slate-400" /></button>
                                                            </div>
                                                            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{scene.longPromptKo || scene.text}</p>
                                                        </div>

                                                        {/* 영어 프롬프트 */}
                                                        <div className="group/edit relative">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-tight">영어 프롬프트</span>
                                                                    <button
                                                                        onClick={() => handleApplyWinterLook(scene.number)}
                                                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-[9px] text-blue-400 transition-all"
                                                                        title="지능형 겨울 룩 즉시 적용 (상의 긴팔 + 악세서리)"
                                                                    >
                                                                        <Sparkles className="w-2.5 h-2.5" />
                                                                        겨울 룩 적용
                                                                    </button>
                                                                    <button
                                                                        onClick={() => openPromptEditModal(scene.number, scene.prompt)}
                                                                        className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-[9px] text-purple-400 transition-all"
                                                                        title="프롬프트 상세 분석 및 스타일 변환"
                                                                    >
                                                                        <Sparkles className="w-2.5 h-2.5" />
                                                                        상세 분석
                                                                    </button>
                                                                </div>
                                                                <button onClick={() => handleStartEdit(scene.number, 'en', scene.prompt)} className="opacity-0 group-hover/edit:opacity-100 p-1 hover:bg-slate-800 rounded transition-all"><Edit3 className="w-3 h-3 text-slate-400" /></button>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 font-mono leading-relaxed line-clamp-2 italic">{scene.prompt}</p>
                                                        </div>

                                                        {/* 설정 선택기 */}
                                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                                            <select value={scene.age || ''} onChange={(e) => handleUpdateSceneSettings(scene.number, 'age', e.target.value)} className="bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-emerald-500/50">
                                                                <option value="">나이: 기본값</option>
                                                                {AGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                            </select>
                                                            <select value={scene.outfit || ''} onChange={(e) => handleUpdateSceneSettings(scene.number, 'outfit', e.target.value)} className="bg-slate-800/50 border border-slate-700/50 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-emerald-500/50">
                                                                <option value="">의상: 기본값</option>
                                                                {OUTFIT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}
                                                {(sceneTabs[scene.number] || 'IMG') === 'VIDEO' && (
                                                    <div className="flex flex-col gap-3 py-4">
                                                        {scene.videoPrompt ? (
                                                            <div className="space-y-2">
                                                                <span className="text-[10px] font-bold text-purple-500/70 uppercase tracking-tight">영상 프롬프트</span>
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
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">대사 (Dialogue)</span>
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
                                                                <span className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-tight">영상 미리보기</span>
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
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">목소리 타입</span>
                                                            <select
                                                                value={scene.voiceType || 'narration'}
                                                                onChange={(e) => handleUpdateSceneSettings(scene.number, 'voiceType', e.target.value)}
                                                                className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-emerald-500/50"
                                                            >
                                                                <option value="narration">나레이션</option>
                                                                <option value="lipSync">립싱크</option>
                                                                <option value="both">둘 다</option>
                                                                <option value="none">없음</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tight">나레이션 (Narration)</span>
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
                                                                    <option value="slow">느리게</option>
                                                                    <option value="normal">보통</option>
                                                                    <option value="slightly-fast">약간 빠르게</option>
                                                                    <option value="fast">빠르게</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-tight">립싱크 (Lip Sync)</span>
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
                                                                    placeholder="감정 (영문)"
                                                                />
                                                                <select
                                                                    value={scene.lipSyncTiming || 'mid'}
                                                                    onChange={(e) => handleUpdateSceneSettings(scene.number, 'lipSyncTiming', e.target.value)}
                                                                    className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] text-slate-200"
                                                                >
                                                                    <option value="start">시작</option>
                                                                    <option value="mid">중간</option>
                                                                    <option value="end">끝</option>
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

            {/* Genre Management Modal */}
            {showGenreModal && (
                <GenreManagementModal
                    genres={labGenres}
                    backups={labGenreBackups}
                    outfitCategories={outfitCatalog.categories || []}
                    promptRules={labPromptRules}
                    promptRuleBackups={labPromptRuleBackups}
                    onClose={() => {
                        setShowGenreModal(false);
                    }}
                    onAdd={async (genre) => {
                        await addGenre(genre);
                        showToast(`'${genre.name}' genre added.`, 'success');
                    }}
                    onUpdate={async (id, updates) => {
                        await updateGenre(id, updates);
                        showToast(`Genre updated.`, 'success');
                    }}
                    onDelete={async (id) => {
                        await deleteGenre(id);
                        showToast(`Genre deleted.`, 'success');
                    }}
                    onReset={async () => {
                        await resetGenres();
                        showToast(`Genres reset to default.`, 'success');
                    }}
                    onBackupCreate={async (name) => {
                        await createBackup(name);
                        showToast('장르 백업이 저장되었습니다.', 'success');
                    }}
                    onBackupRestore={async (id) => {
                        await restoreBackup(id);
                        showToast('백업에서 장르를 복구했습니다.', 'success');
                    }}
                    onBackupDelete={async (id) => {
                        await deleteBackup(id);
                        showToast('백업이 삭제되었습니다.', 'success');
                    }}
                    onBackupRename={async (id, name) => {
                        await renameBackup(id, name);
                        showToast('백업 이름이 변경되었습니다.', 'success');
                    }}
                    onBackupEdit={async (id, genresInput) => {
                        await updateBackupContent(id, genresInput);
                        showToast('백업 내용이 저장되었습니다.', 'success');
                    }}
                    onPromptRulesSave={async (rulesInput) => {
                        await updatePromptRules(rulesInput);
                        showToast('프롬프트 규칙이 저장되었습니다.', 'success');
                    }}
                    onPromptRulesReset={async () => {
                        await resetPromptRules();
                        showToast('프롬프트 규칙이 기본값으로 초기화되었습니다.', 'success');
                    }}
                    onPromptRulesBackupCreate={async (name) => {
                        await createPromptRulesBackup(name);
                        showToast('프롬프트 규칙 백업이 저장되었습니다.', 'success');
                    }}
                    onPromptRulesBackupRestore={async (id) => {
                        await restorePromptRulesBackup(id);
                        showToast('프롬프트 규칙을 백업에서 복구했습니다.', 'success');
                    }}
                    onPromptRulesBackupDelete={async (id) => {
                        await deletePromptRulesBackup(id);
                        showToast('프롬프트 규칙 백업이 삭제되었습니다.', 'success');
                    }}
                    onPromptRulesBackupRename={async (id, name) => {
                        await renamePromptRulesBackup(id, name);
                        showToast('백업 이름이 변경되었습니다.', 'success');
                    }}
                    onPromptRulesBackupEdit={async (id, rulesInput) => {
                        await updatePromptRulesBackupContent(id, rulesInput);
                        showToast('백업 내용이 저장되었습니다.', 'success');
                    }}
                    step2Rules={labStep2Rules}
                    step2Backups={labStep2Backups}
                    onStep2RulesSave={async (rulesInput) => {
                        await updateStep2Rules(rulesInput);
                        showToast('2단계 규칙이 저장되었습니다.', 'success');
                    }}
                    onStep2RulesReset={async () => {
                        await resetStep2Rules();
                        showToast('2단계 규칙이 기본값으로 초기화되었습니다.', 'success');
                    }}
                    onStep2BackupCreate={async (name) => {
                        await createStep2Backup(name);
                        showToast('2단계 규칙 백업이 저장되었습니다.', 'success');
                    }}
                    onStep2BackupRestore={async (id) => {
                        await restoreStep2Backup(id);
                        showToast('2단계 규칙을 백업에서 복구했습니다.', 'success');
                    }}
                    onStep2BackupDelete={async (id) => {
                        await deleteStep2Backup(id);
                        showToast('2단계 규칙 백업이 삭제되었습니다.', 'success');
                    }}
                    onStep2BackupRename={async (id, name) => {
                        await renameStep2Backup(id, name);
                        showToast('백업 이름이 변경되었습니다.', 'success');
                    }}
                    onStep2BackupEdit={async (id, rulesInput) => {
                        await updateStep2BackupContent(id, rulesInput);
                        showToast('백업 내용이 저장되었습니다.', 'success');
                    }}
                    characterRules={characterRules}
                    characterRulesBackups={characterRulesBackups}
                    onCharacterRulesSave={async (rulesInput) => {
                        await updateCharacterRules(rulesInput);
                        showToast('의상 규칙이 저장되었습니다.', 'success');
                    }}
                    onCharacterRulesReset={async () => {
                        await resetCharacterRules();
                        showToast('의상 규칙이 기본값으로 초기화되었습니다.', 'success');
                    }}
                    onCharacterRulesBackupCreate={async (name) => {
                        await createCharacterRulesBackup(name);
                        showToast('의상 규칙 백업이 저장되었습니다.', 'success');
                    }}
                    onCharacterRulesBackupRestore={async (id) => {
                        await restoreCharacterRulesBackup(id);
                        showToast('의상 규칙을 백업에서 복구했습니다.', 'success');
                    }}
                    onCharacterRulesBackupDelete={async (id) => {
                        await deleteCharacterRulesBackup(id);
                        showToast('의상 규칙 백업이 삭제되었습니다.', 'success');
                    }}
                    onCharacterRulesBackupRename={async (id, name) => {
                        await renameCharacterRulesBackup(id, name);
                        showToast('백업 이름이 변경되었습니다.', 'success');
                    }}
                    onCharacterRulesBackupEdit={async (id, rulesInput) => {
                        await updateCharacterRulesBackupContent(id, rulesInput);
                        showToast('백업 내용이 저장되었습니다.', 'success');
                    }}
                    onAddFemaleCharacter={addFemaleCharacter}
                    onAddMaleCharacter={addMaleCharacter}
                    onDeleteFemaleCharacter={deleteFemaleCharacter}
                    onDeleteMaleCharacter={deleteMaleCharacter}
                />
            )}

            {/* 프롬프트 수정 모달 */}
            {console.log('🎯 [ShortsLab RENDER] showPromptEditModal:', showPromptEditModal, 'sceneNumber:', promptEditSceneNumber, 'promptEditText:', promptEditText?.substring(0, 50))}
            <PromptEditModal
                isOpen={showPromptEditModal}
                sceneNumber={promptEditSceneNumber}
                originalPrompt={promptEditOriginal}
                editingPrompt={promptEditText}
                isLoading={promptEditLoading}
                loadingType={promptEditLoadingType}
                error={promptEditError}
                elementAnalysis={promptElementAnalysis}
                detailedAnalysis={detailedAnalysis}
                analysisBasePrompt={promptAnalysisBase}
                onClose={closePromptEditModal}
                onReset={resetPromptEditModal}
                onEditingChange={setPromptEditText}
                onAnalyze={handleAnalyzePromptByElement}
                onDetailedAnalyze={handleDetailedAnalysis}
                onApplyStyle={handleApplyStyle}
            />

            {/* 디버그: 강제 오픈 테스트 모달 (임시) */}
            {showPromptEditModal && (
                <div className="fixed top-4 right-4 z-[10000] bg-yellow-500 text-black p-4 rounded-lg shadow-xl text-xs">
                    <div className="font-bold mb-2">디버그: 모달 상태</div>
                    <div>isOpen: {String(showPromptEditModal)}</div>
                    <div>sceneNumber: {promptEditSceneNumber}</div>
                    <div>textLength: {promptEditText?.length || 0}</div>
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

// ============================================
// Genre Management Modal Component
// ============================================

interface GenreManagementModalProps {
    genres: LabGenreGuidelineEntry[];
    backups: {
        id: string;
        name: string;
        createdAt: string;
        genres: LabGenreGuidelineEntry[];
    }[];
    outfitCategories: OutfitCategory[];
    promptRules: unknown;
    promptRuleBackups: {
        id: string;
        name: string;
        createdAt: string;
        rules: unknown;
    }[];
    step2Rules?: unknown;
    step2Backups?: {
        id: string;
        name: string;
        createdAt: string;
        rules: unknown;
    }[];
    onClose: () => void;
    onAdd: (genre: LabGenreGuidelineEntry) => Promise<void>;
    onUpdate: (id: string, updates: Partial<LabGenreGuideline>) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onReset: () => Promise<void>;
    onBackupCreate: (name?: string) => Promise<void>;
    onBackupRestore: (id: string) => Promise<void>;
    onBackupDelete: (id: string) => Promise<void>;
    onBackupRename: (id: string, name: string) => Promise<void>;
    onBackupEdit: (id: string, genresInput: unknown) => Promise<void>;
    onPromptRulesSave: (rulesInput: unknown) => Promise<void>;
    onPromptRulesReset: () => Promise<void>;
    onPromptRulesBackupCreate: (name?: string) => Promise<void>;
    onPromptRulesBackupRestore: (id: string) => Promise<void>;
    onPromptRulesBackupDelete: (id: string) => Promise<void>;
    onPromptRulesBackupRename: (id: string, name: string) => Promise<void>;
    onPromptRulesBackupEdit: (id: string, rulesInput: unknown) => Promise<void>;
    onStep2RulesSave?: (rulesInput: unknown) => Promise<void>;
    onStep2RulesReset?: () => Promise<void>;
    onStep2BackupCreate?: (name?: string) => Promise<void>;
    onStep2BackupRestore?: (id: string) => Promise<void>;
    onStep2BackupDelete?: (id: string) => Promise<void>;
    onStep2BackupRename?: (id: string, name: string) => Promise<void>;
    onStep2BackupEdit?: (id: string, rulesInput: unknown) => Promise<void>;
    characterRules?: any;
    characterRulesBackups?: any[];
    onCharacterRulesSave?: (rulesInput: unknown) => Promise<void>;
    onCharacterRulesReset?: () => Promise<void>;
    onCharacterRulesBackupCreate?: (name?: string) => Promise<void>;
    onCharacterRulesBackupRestore?: (id: string) => Promise<void>;
    onCharacterRulesBackupDelete?: (id: string) => Promise<void>;
    onCharacterRulesBackupRename?: (id: string, name: string) => Promise<void>;
    onCharacterRulesBackupEdit?: (id: string, rulesInput: unknown) => Promise<void>;
    onAddFemaleCharacter?: () => Promise<any>;
    onAddMaleCharacter?: () => Promise<any>;
    onDeleteFemaleCharacter?: (id: string) => Promise<any>;
    onDeleteMaleCharacter?: (id: string) => Promise<any>;
}

const GenreManagementModal: React.FC<GenreManagementModalProps> = ({
    genres,
    backups,
    outfitCategories,
    promptRules,
    promptRuleBackups,
    step2Rules,
    step2Backups,
    onClose,
    onAdd,
    onUpdate,
    onDelete,
    onReset,
    onBackupCreate,
    onBackupRestore,
    onBackupDelete,
    onBackupRename,
    onBackupEdit,
    onPromptRulesSave,
    onPromptRulesReset,
    onPromptRulesBackupCreate,
    onPromptRulesBackupRestore,
    onPromptRulesBackupDelete,
    onPromptRulesBackupRename,
    onPromptRulesBackupEdit,
    onStep2RulesSave,
    onStep2RulesReset,
    onStep2BackupCreate,
    onStep2BackupRestore,
    onStep2BackupDelete,
    onStep2BackupRename,
    onStep2BackupEdit,
    characterRules,
    characterRulesBackups,
    onCharacterRulesSave,
    onCharacterRulesReset,
    onCharacterRulesBackupCreate,
    onCharacterRulesBackupRestore,
    onCharacterRulesBackupDelete,
    onCharacterRulesBackupRename,
    onCharacterRulesBackupEdit,
    onAddFemaleCharacter,
    onAddMaleCharacter,
    onDeleteFemaleCharacter,
    onDeleteMaleCharacter
}) => {
    const [activeTab, setActiveTab] = useState<'genres' | 'rules' | 'step2_rules' | 'character_rules' | 'winter_accessories' | 'outfit_selection'>('genres');
    const [mode, setMode] = useState<'list' | 'edit' | 'add'>('list');
    const [selectedGenre, setSelectedGenre] = useState<LabGenreGuidelineEntry | null>(null);

    // 지침 전체 보기 모달 상태
    const [isGuidelineViewOpen, setIsGuidelineViewOpen] = useState(false);
    const [selectedGuidelineGenre, setSelectedGuidelineGenre] = useState<LabGenreGuidelineEntry | null>(null);

    // 2단계 프롬프트 전체 보기 모달 상태
    const [isStep2PromptViewOpen, setIsStep2PromptViewOpen] = useState(false);

    // Draggable state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragOffset.x,
                y: e.clientY - dragOffset.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };
    const [formData, setFormData] = useState<LabGenreGuidelineEntry>({
        id: '',
        name: '',
        description: '',
        emotionCurve: '',
        structure: '',
        killerPhrases: [],
        allowedOutfitCategories: [],
        supportingCharacterPhrasePatterns: [],
        bodyReactions: [],
        forbiddenPatterns: [],
        goodTwistExamples: [],
        supportingCharacterTwistPatterns: [],
        badTwistExamples: []
    });
    const [isSaving, setIsSaving] = useState(false);
    const [backupName, setBackupName] = useState('');
    const [backupEdits, setBackupEdits] = useState<Record<string, string>>({});
    const [editingBackupId, setEditingBackupId] = useState<string | null>(null);
    const [backupEditText, setBackupEditText] = useState('');
    const [backupEditError, setBackupEditError] = useState<string | null>(null);
    const [rulesEditText, setRulesEditText] = useState('');
    const [rulesEditError, setRulesEditError] = useState<string | null>(null);
    const [rulesDirty, setRulesDirty] = useState(false);
    const [rulesBackupName, setRulesBackupName] = useState('');
    const [rulesBackupEdits, setRulesBackupEdits] = useState<Record<string, string>>({});
    const [editingRulesBackupId, setEditingRulesBackupId] = useState<string | null>(null);
    const [rulesBackupEditText, setRulesBackupEditText] = useState('');
    const [rulesBackupEditError, setRulesBackupEditError] = useState<string | null>(null);

    // Step 2 Rules State
    const [step2ScriptPrompt, setStep2ScriptPrompt] = useState('');
    const [step2CharacterPrompt, setStep2CharacterPrompt] = useState('');
    const [step2FinalPrompt, setStep2FinalPrompt] = useState('');
    const [step2RulesEditError, setStep2RulesEditError] = useState<string | null>(null);
    const [step2RulesDirty, setStep2RulesDirty] = useState(false);
    const [selectedStep2BackupId, setSelectedStep2BackupId] = useState<string | null>(null);
    const [step2BackupName, setStep2BackupName] = useState('');
    const [step2BackupEdits, setStep2BackupEdits] = useState<Record<string, string>>({});
    const [editingStep2BackupId, setEditingStep2BackupId] = useState<string | null>(null);
    const [step2BackupEditText, setStep2BackupEditText] = useState('');
    const [step2BackupEditError, setStep2BackupEditError] = useState<string | null>(null);

    // Character Rules State (v2.0: 동적 배열 구조)
    const [characterRulesState, setCharacterRulesState] = useState<{
        females: Array<{
            id: string;
            identity: string;
            hair: string;
            body: string;
            style: string;
            outfitFit: string;
            isFixedAge?: boolean;
            fixedAge?: string;
        }>;
        males: Array<{
            id: string;
            identity: string;
            hair: string;
            body: string;
            style: string;
            outfitFit: string;
            isFixedAge?: boolean;
            fixedAge?: string;
        }>;
        common: {
            negativePrompt: string;
            qualityTags: string;
        };
    }>({
        females: [],
        males: [],
        common: { negativePrompt: '', qualityTags: '' }
    });
    const [characterRulesDirty, setCharacterRulesDirty] = useState(false);
    const [characterRulesEditError, setCharacterRulesEditError] = useState<string | null>(null);
    const [selectedCharacterRulesBackupId, setSelectedCharacterRulesBackupId] = useState<string | null>(null);
    const [characterRulesBackupName, setCharacterRulesBackupName] = useState('');
    const [editingCharacterRulesBackupId, setEditingCharacterRulesBackupId] = useState<string | null>(null);
    const [characterRulesBackupEditText, setCharacterRulesBackupEditText] = useState('');
    const [characterRulesBackupEditError, setCharacterRulesBackupEditError] = useState<string | null>(null);
    const [characterRulesBackupEdits, setCharacterRulesBackupEdits] = useState<Record<string, string>>({});

    // 아코디언 상태 (펼쳐진 캐릭터 ID들)
    const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(new Set());
    // 섹션 아코디언 상태 (여성/남성 캐릭터 섹션 펼침/접힘)
    const [isFemaleSectionExpanded, setIsFemaleSectionExpanded] = useState(true);
    const [isMaleSectionExpanded, setIsMaleSectionExpanded] = useState(true);

    React.useEffect(() => {
        if (step2RulesDirty) return;
        const rulesValue = (step2Rules || {}) as {
            scriptPrompt?: string;
            characterPrompt?: string;
            finalPrompt?: string;
        };
        setStep2ScriptPrompt(rulesValue.scriptPrompt || '');
        setStep2CharacterPrompt(rulesValue.characterPrompt || '');
        setStep2FinalPrompt(rulesValue.finalPrompt || '');
    }, [step2Rules, step2RulesDirty]);

    React.useEffect(() => {
        if (rulesDirty) return;
        setRulesEditText(JSON.stringify(promptRules, null, 2));
    }, [promptRules, rulesDirty]);

    React.useEffect(() => {
        if (characterRulesDirty) return;
        if (characterRules) {
            setCharacterRulesState({
                females: characterRules.females || [],
                males: characterRules.males || [],
                common: characterRules.common || { negativePrompt: '', qualityTags: '' }
            });
        }
    }, [characterRules, characterRulesDirty]);

    const handleStartEdit = (genre: LabGenreGuidelineEntry) => {
        setSelectedGenre(genre);
        setFormData({ ...genre });
        setMode('edit');
    };

    const handleStartAdd = () => {
        const newId = `custom-${Date.now()}`;
        setFormData({
            ...EMPTY_GENRE_TEMPLATE,
            id: newId
        });
        setSelectedGenre(null);
        setMode('add');
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            alert('장르 이름을 입력해주세요.');
            return;
        }
        setIsSaving(true);

        // 데이터 저장 전 배열 필드 정리 (공백 제거 및 빈 줄 삭제)
        const cleanedData: LabGenreGuidelineEntry = {
            ...formData,
            killerPhrases: (formData.killerPhrases || []).map(s => s.trim()).filter(Boolean),
            allowedOutfitCategories: (formData.allowedOutfitCategories || []).map(s => s.trim()).filter(Boolean),
            supportingCharacterPhrasePatterns: (formData.supportingCharacterPhrasePatterns || []).map(s => s.trim()).filter(Boolean),
            bodyReactions: (formData.bodyReactions || []).map(s => s.trim()).filter(Boolean),
            forbiddenPatterns: (formData.forbiddenPatterns || []).map(s => s.trim()).filter(Boolean),
            goodTwistExamples: (formData.goodTwistExamples || []).map(s => s.trim()).filter(Boolean),
            supportingCharacterTwistPatterns: (formData.supportingCharacterTwistPatterns || []).map(s => s.trim()).filter(Boolean),
            badTwistExamples: (formData.badTwistExamples || []).map(s => s.trim()).filter(Boolean)
        };

        try {
            if (mode === 'add') {
                await onAdd(cleanedData);
            } else if (mode === 'edit' && selectedGenre) {
                await onUpdate(selectedGenre.id, cleanedData);
            }
            setMode('list');
            setSelectedGenre(null);
        } catch (err) {
            console.error('Failed to save genre:', err);
            alert('장르 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('정말 이 장르를 삭제하시겠습니까?')) return;
        try {
            await onDelete(id);
        } catch (err) {
            console.error('Failed to delete genre:', err);
            alert('장르 삭제에 실패했습니다.');
        }
    };

    const handleReset = async () => {
        if (!window.confirm('모든 장르를 기본값으로 초기화하시겠습니까? 커스텀 장르는 삭제됩니다.')) return;
        try {
            await onReset();
        } catch (err) {
            console.error('Failed to reset genres:', err);
            alert('장르 초기화에 실패했습니다.');
        }
    };

    const handleBackupCreate = async () => {
        try {
            await onBackupCreate(backupName);
            setBackupName('');
        } catch (err) {
            console.error('Failed to create backup:', err);
            alert('백업 생성에 실패했습니다.');
        }
    };

    const handleBackupRestore = async (id: string) => {
        if (!window.confirm('이 백업으로 장르를 복구하시겠습니까? 현재 장르 목록이 덮어씌워집니다.')) return;
        try {
            await onBackupRestore(id);
        } catch (err) {
            console.error('Failed to restore backup:', err);
            alert('백업 복구에 실패했습니다.');
        }
    };

    const handleBackupDelete = async (id: string) => {
        if (!window.confirm('이 백업을 삭제하시겠습니까?')) return;
        try {
            await onBackupDelete(id);
        } catch (err) {
            console.error('Failed to delete backup:', err);
            alert('백업 삭제에 실패했습니다.');
        }
    };

    const handleBackupRename = async (id: string) => {
        const name = (backupEdits[id] || '').trim();
        if (!name) {
            alert('백업 이름을 입력해주세요.');
            return;
        }
        try {
            await onBackupRename(id, name);
            setBackupEdits(prev => ({ ...prev, [id]: name }));
        } catch (err) {
            console.error('Failed to rename backup:', err);
            alert('백업 이름 변경에 실패했습니다.');
        }
    };

    const handleOpenBackupEditor = (backupId: string) => {
        const backup = backups.find(item => item.id === backupId);
        if (!backup) return;
        setEditingBackupId(backupId);
        setBackupEditText(JSON.stringify(backup.genres, null, 2));
        setBackupEditError(null);
    };

    const handleCloseBackupEditor = () => {
        setEditingBackupId(null);
        setBackupEditText('');
        setBackupEditError(null);
    };

    const handleBackupSaveContent = async () => {
        if (!editingBackupId) return;
        try {
            const parsed = JSON.parse(backupEditText);
            await onBackupEdit(editingBackupId, parsed);
            handleCloseBackupEditor();
        } catch (err) {
            console.error('Failed to save backup content:', err);
            setBackupEditError('JSON 형식이 올바르지 않습니다.');
        }
    };

    const handlePromptRulesSave = async () => {
        console.log('[DEBUG FRONTEND] ==================== handlePromptRulesSave START ====================');
        console.log('[DEBUG FRONTEND] rulesEditText length:', rulesEditText.length);
        try {
            const parsed = JSON.parse(rulesEditText);
            console.log('[DEBUG FRONTEND] JSON.parse success, keys:', Object.keys(parsed));
            console.log('[DEBUG FRONTEND] Calling onPromptRulesSave...');
            await onPromptRulesSave(parsed);
            console.log('[DEBUG FRONTEND] onPromptRulesSave completed');
            // dirty 플래그를 약간 지연시켜 설정 (useEffect 트리거 방지)
            setTimeout(() => {
                setRulesDirty(false);
            }, 100);
            setRulesEditError(null);
            console.log('[DEBUG FRONTEND] ==================== handlePromptRulesSave END ====================');
        } catch (err) {
            console.error('Failed to save prompt rules:', err);
            setRulesEditError('JSON 형식이 올바르지 않습니다.');
        }
    };

    const handlePromptRulesReset = async () => {
        if (!window.confirm('프롬프트 규칙을 기본값으로 초기화하시겠습니까?')) return;
        try {
            await onPromptRulesReset();
            setRulesDirty(false);
            setRulesEditError(null);
        } catch (err) {
            console.error('Failed to reset prompt rules:', err);
            alert('프롬프트 규칙 초기화에 실패했습니다.');
        }
    };

    const handlePromptRulesBackupCreate = async () => {
        try {
            await onPromptRulesBackupCreate(rulesBackupName);
            setRulesBackupName('');
        } catch (err) {
            console.error('Failed to create prompt rules backup:', err);
            alert('프롬프트 규칙 백업 생성에 실패했습니다.');
        }
    };

    const handlePromptRulesBackupRestore = async (id: string) => {
        if (!window.confirm('이 백업으로 프롬프트 규칙을 복구하시겠습니까?')) return;
        try {
            await onPromptRulesBackupRestore(id);
            setRulesDirty(false);
            setRulesEditError(null);
        } catch (err) {
            console.error('Failed to restore prompt rules backup:', err);
            alert('프롬프트 규칙 백업 복구에 실패했습니다.');
        }
    };

    const handlePromptRulesBackupDelete = async (id: string) => {
        if (!window.confirm('이 백업을 삭제하시겠습니까?')) return;
        try {
            await onPromptRulesBackupDelete(id);
        } catch (err) {
            console.error('Failed to delete prompt rules backup:', err);
            alert('프롬프트 규칙 백업 삭제에 실패했습니다.');
        }
    };

    const handlePromptRulesBackupRename = async (id: string) => {
        const name = (rulesBackupEdits[id] || '').trim();
        if (!name) {
            alert('백업 이름을 입력해주세요.');
            return;
        }
        try {
            await onPromptRulesBackupRename(id, name);
            setRulesBackupEdits(prev => ({ ...prev, [id]: name }));
        } catch (err) {
            console.error('Failed to rename prompt rules backup:', err);
            alert('백업 이름 변경에 실패했습니다.');
        }
    };

    const handleOpenPromptRulesBackupEditor = (backupId: string) => {
        const backup = promptRuleBackups.find(item => item.id === backupId);
        if (!backup) return;
        setEditingRulesBackupId(backupId);
        setRulesBackupEditText(JSON.stringify(backup.rules, null, 2));
        setRulesBackupEditError(null);
    };

    const handleClosePromptRulesBackupEditor = () => {
        setEditingRulesBackupId(null);
        setRulesBackupEditText('');
        setRulesBackupEditError(null);
    };

    const handleSavePromptRulesBackupContent = async () => {
        if (!editingRulesBackupId) return;
        try {
            const parsed = JSON.parse(rulesBackupEditText);
            await onPromptRulesBackupEdit(editingRulesBackupId, parsed);
            handleClosePromptRulesBackupEditor();
        } catch (err) {
            console.error('Failed to save prompt rules backup content:', err);
            setRulesBackupEditError('JSON 형식이 올바르지 않습니다.');
        }
    };

    // Step 2 Rules Handlers
    const handleStep2RulesSave = async () => {
        if (!onStep2RulesSave) return;
        try {
            await onStep2RulesSave({
                scriptPrompt: step2ScriptPrompt,
                characterPrompt: step2CharacterPrompt,
                finalPrompt: step2FinalPrompt
            });
            setStep2RulesDirty(false);
            setStep2RulesEditError(null);
        } catch (err) {
            console.error('Failed to save step2 rules:', err);
            setStep2RulesEditError('2단계 규칙 저장에 실패했습니다.');
        }
    };

    const handleStep2RulesReset = async () => {
        if (!onStep2RulesReset) return;
        if (!window.confirm('2단계 규칙을 기본값으로 초기화하시겠습니까?')) return;
        try {
            await onStep2RulesReset();
            setStep2RulesDirty(false);
            setStep2RulesEditError(null);
        } catch (err) {
            console.error('Failed to reset step2 rules:', err);
            alert('2단계 규칙 초기화에 실패했습니다.');
        }
    };

    const handleStep2BackupCreate = async () => {
        if (!onStep2BackupCreate) return;
        try {
            await onStep2BackupCreate(step2BackupName);
            setStep2BackupName('');
        } catch (err) {
            console.error('Failed to create step2 backup:', err);
            alert('2단계 규칙 백업 생성에 실패했습니다.');
        }
    };

    const handleStep2BackupRestore = async (id: string) => {
        if (!onStep2BackupRestore) return;
        if (!window.confirm('이 백업으로 2단계 규칙을 복구하시겠습니까?')) return;
        try {
            await onStep2BackupRestore(id);
            setStep2RulesDirty(false);
            setStep2RulesEditError(null);
            setSelectedStep2BackupId(id);
        } catch (err) {
            console.error('Failed to restore step2 backup:', err);
            alert('2단계 규칙 백업 복구에 실패했습니다.');
        }
    };

    const handleStep2BackupRestoreSelected = async () => {
        if (!selectedStep2BackupId) {
            alert('복구할 백업을 선택해주세요.');
            return;
        }
        await handleStep2BackupRestore(selectedStep2BackupId);
    };

    const handleStep2BackupDelete = async (id: string) => {
        if (!onStep2BackupDelete) return;
        if (!window.confirm('이 백업을 삭제하시겠습니까?')) return;
        try {
            await onStep2BackupDelete(id);
        } catch (err) {
            console.error('Failed to delete step2 backup:', err);
            alert('2단계 규칙 백업 삭제에 실패했습니다.');
        }
    };

    const handleStep2BackupRename = async (id: string) => {
        if (!onStep2BackupRename) return;
        const name = (step2BackupEdits[id] || '').trim();
        if (!name) {
            alert('백업 이름을 입력해주세요.');
            return;
        }
        try {
            await onStep2BackupRename(id, name);
            setStep2BackupEdits(prev => ({ ...prev, [id]: name }));
        } catch (err) {
            console.error('Failed to rename step2 backup:', err);
            alert('백업 이름 변경에 실패했습니다.');
        }
    };

    const handleOpenStep2BackupEditor = (backupId: string) => {
        const backup = step2Backups?.find(item => item.id === backupId);
        if (!backup) return;
        setEditingStep2BackupId(backupId);
        setStep2BackupEditText(JSON.stringify(backup.rules, null, 2));
        setStep2BackupEditError(null);
    };

    const handleCloseStep2BackupEditor = () => {
        setEditingStep2BackupId(null);
        setStep2BackupEditText('');
        setStep2BackupEditError(null);
    };

    const handleSaveStep2BackupContent = async () => {
        if (!editingStep2BackupId || !onStep2BackupEdit) return;
        try {
            const parsed = JSON.parse(step2BackupEditText);
            await onStep2BackupEdit(editingStep2BackupId, parsed);
            handleCloseStep2BackupEditor();
        } catch (err) {
            console.error('Failed to save step2 backup content:', err);
            setStep2BackupEditError('JSON 형식이 올바르지 않습니다.');
        }
    };

    const handleOpenCharacterRulesBackupEditor = (backupId: string) => {
        const backup = characterRulesBackups?.find(item => item.id === backupId);
        if (!backup) return;
        setEditingCharacterRulesBackupId(backupId);
        setCharacterRulesBackupEditText(JSON.stringify(backup.rules, null, 2));
        setCharacterRulesBackupEditError(null);
    };

    const handleCloseCharacterRulesBackupEditor = () => {
        setEditingCharacterRulesBackupId(null);
        setCharacterRulesBackupEditText('');
        setCharacterRulesBackupEditError(null);
    };

    const handleSaveCharacterRulesBackupContent = async () => {
        if (!editingCharacterRulesBackupId || !onCharacterRulesBackupEdit) return;
        try {
            const parsed = JSON.parse(characterRulesBackupEditText);
            await onCharacterRulesBackupEdit(editingCharacterRulesBackupId, parsed);
            handleCloseCharacterRulesBackupEditor();
        } catch (err) {
            console.error('Failed to save character rules backup content:', err);
            setCharacterRulesBackupEditError('JSON 형식이 올바르지 않습니다.');
        }
    };


    // Character Import Modal State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTargetGender, setImportTargetGender] = useState<'female' | 'male'>('female');
    const [importTargetSlotId, setImportTargetSlotId] = useState<string>('');
    const [importableCharacters, setImportableCharacters] = useState<CharacterItem[]>([]);
    const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);

    const handleOpenImportModal = useCallback(async (gender: 'female' | 'male', slotId: string) => {
        setImportTargetGender(gender);
        setImportTargetSlotId(slotId);
        setIsLoadingCharacters(true);
        setShowImportModal(true);
        try {
            const chars = await fetchCharacters();
            // 성별 필터링
            const filtered = chars.filter(c => c.gender === gender);
            setImportableCharacters(filtered);
        } catch (err) {
            console.error('Failed to fetch characters:', err);
            showToast('캐릭터 목록을 불러오는데 실패했습니다.', 'error');
        } finally {
            setIsLoadingCharacters(false);
        }
    }, []);

    const handleImportCharacter = useCallback(async (char: CharacterItem) => {
        try {
            await shortsLabCharacterRulesManager.importCharacter(char, importTargetSlotId);
            showToast(`${char.name} 캐릭터를 가져왔습니다.`, 'success');
            setShowImportModal(false);
        } catch (err) {
            console.error('Failed to import character:', err);
            const message = err instanceof Error ? err.message : '캐릭터 가져오기 실패';
            showToast(message, 'error');
        }
    }, [importTargetSlotId]);

    // Character Rules Handlers
    const handleCharacterRulesSave = async () => {
        if (!onCharacterRulesSave) return;
        try {
            await onCharacterRulesSave(characterRulesState);
            setCharacterRulesDirty(false);
            setCharacterRulesEditError(null);
        } catch (err) {
            console.error('Failed to save character rules:', err);
            setCharacterRulesEditError('의상 규칙 저장에 실패했습니다.');
        }
    };

    const handleCharacterRulesReset = async () => {
        if (!onCharacterRulesReset) return;
        if (!window.confirm('의상 규칙을 기본값으로 초기화하시겠습니까?')) return;
        try {
            await onCharacterRulesReset();
            setCharacterRulesDirty(false);
            setCharacterRulesEditError(null);
        } catch (err) {
            console.error('Failed to reset character rules:', err);
            alert('의상 규칙 초기화에 실패했습니다.');
        }
    };

    const handleCharacterRulesBackupCreate = async () => {
        if (!onCharacterRulesBackupCreate) return;
        try {
            await onCharacterRulesBackupCreate(characterRulesBackupName);
            setCharacterRulesBackupName('');
        } catch (err) {
            console.error('Failed to create character rules backup:', err);
            alert('의상 규칙 백업 생성에 실패했습니다.');
        }
    };

    const handleCharacterRulesBackupRestore = async (id: string) => {
        if (!onCharacterRulesBackupRestore) return;
        if (!window.confirm('이 백업으로 의상 규칙을 복구하시겠습니까?')) return;
        try {
            await onCharacterRulesBackupRestore(id);
            setCharacterRulesDirty(false);
            setCharacterRulesEditError(null);
            setSelectedCharacterRulesBackupId(id);
        } catch (err) {
            console.error('Failed to restore character rules backup:', err);
            alert('의상 규칙 백업 복구에 실패했습니다.');
        }
    };

    const handleCharacterRulesBackupRestoreSelected = async () => {
        if (!selectedCharacterRulesBackupId) {
            alert('복구할 백업을 선택해주세요.');
            return;
        }
        await handleCharacterRulesBackupRestore(selectedCharacterRulesBackupId);
    };

    const handleCharacterRulesBackupDelete = async (id: string) => {
        if (!onCharacterRulesBackupDelete) return;
        if (!window.confirm('이 백업을 삭제하시겠습니까?')) return;
        try {
            await onCharacterRulesBackupDelete(id);
        } catch (err) {
            console.error('Failed to delete character rules backup:', err);
            alert('의상 규칙 백업 삭제에 실패했습니다.');
        }
    };

    const updateCharacterRulesField = (gender: 'female' | 'male', id: string, field: string, value: string | boolean) => {
        setCharacterRulesState(prev => ({
            ...prev,
            [gender === 'female' ? 'females' : 'males']: prev[gender === 'female' ? 'females' : 'males'].map(char =>
                char.id === id ? { ...char, [field]: value } : char
            )
        }));
        setCharacterRulesDirty(true);
        setCharacterRulesEditError(null);
    };

    const toggleCharacterExpand = (id: string) => {
        setExpandedCharacters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const updateField = <K extends keyof LabGenreGuidelineEntry>(key: K, value: LabGenreGuidelineEntry[K]) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const updateArrayField = (key: keyof LabGenreGuidelineEntry, text: string) => {
        const lines = text.split('\n');
        setFormData(prev => ({ ...prev, [key]: lines }));
    };

    const toggleAllowedOutfitCategory = (categoryId: string) => {
        setFormData((prev) => {
            const current = new Set(prev.allowedOutfitCategories || []);
            if (current.has(categoryId)) {
                current.delete(categoryId);
            } else {
                current.add(categoryId);
            }
            return { ...prev, allowedOutfitCategories: Array.from(current) };
        });
    };

    const arrayToText = (arr: string[] | undefined): string => {
        return arr?.join('\n') || '';
    };

    const formatGuidelineAsText = (genre: LabGenreGuidelineEntry): string => {
        return `
╔═════════════════════════════════════════════════════════════════╗
║  📋 ${genre.name} - 전체 지침                              ║
╚═════════════════════════════════════════════════════════════════╝

📝 설명
${genre.description || ''}

🎭 감정 곡선 (Emotion Curve)
${genre.emotionCurve || ''}

📖 구조 (Structure)
${genre.structure || ''}

👗 허용 의상 카테고리
${genre.allowedOutfitCategories && genre.allowedOutfitCategories.length > 0
        ? genre.allowedOutfitCategories.map(cat => `  - ${cat}`).join('\n')
        : '  - 전체 허용'}

🎯 킬러 프레이즈 (Killer Phrases)
${genre.killerPhrases?.map(p => `  - "${p}"`).join('\n') || '  - 없음'}

💬 조연 캐릭터 패턴 (Supporting Character Patterns)
${genre.supportingCharacterPhrasePatterns?.map(p => `  - ${p}`).join('\n') || '  - 없음'}

🎭 신체 반응 (Body Reactions)
${genre.bodyReactions?.map(p => `  - "${p}"`).join('\n') || '  - 없음'}

🚫 금지 패턴 (Forbidden Patterns)
${genre.forbiddenPatterns?.map(p => `  - ${p}`).join('\n') || '  - 없음'}

✅ 좋은 반전 예시 (Good Twist Examples)
${genre.goodTwistExamples?.map(p => `  - ${p}`).join('\n') || '  - 없음'}

❌ 나쁜 반전 예시 (Bad Twist Examples)
${genre.badTwistExamples?.map(p => `  - ${p}`).join('\n') || '  - 없음'}

💬 조연 캐릭터 반전 패턴
${genre.supportingCharacterTwistPatterns?.map(p => `  - ${p}`).join('\n') || '  - 없음'}
`;
    };

    const handleOpenGuidelineView = (genre: LabGenreGuidelineEntry) => {
        setSelectedGuidelineGenre(genre);
        setIsGuidelineViewOpen(true);
    };

    const handleCopyGuidelines = async () => {
        if (!selectedGuidelineGenre) return;
        const text = formatGuidelineAsText(selectedGuidelineGenre);
        try {
            await navigator.clipboard.writeText(text);
            showToast('지침이 복사되었습니다.', 'success');
        } catch (error) {
            console.error('Failed to copy guidelines:', error);
            showToast('복사 실패', 'error');
        }
    };

    const handleDownloadGuidelines = () => {
        if (!selectedGuidelineGenre) return;
        const text = formatGuidelineAsText(selectedGuidelineGenre);
        const fileName = `${selectedGuidelineGenre.name.replace(/[\/\\:*?"<>|]/g, '_')}_지침.txt`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast('지침이 다운로드되었습니다.', 'success');
    };

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-6 border-b border-slate-800 cursor-move select-none"
                    onMouseDown={handleMouseDown}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <Settings2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">쇼츠랩 장르 매니저</h2>
                            <p className="text-xs text-slate-400">커스텀 장르 가이드라인을 관리합니다</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="px-6 pt-4">
                    <div className="inline-flex rounded-xl border border-slate-700 bg-slate-800/60 p-1">
                        <button
                            onClick={() => {
                                setActiveTab('genres');
                            }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'genres'
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            장르 관리
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('rules');
                                setMode('list');
                                setSelectedGenre(null);
                            }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'rules'
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            프롬프트 규칙
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('step2_rules');
                                setMode('list');
                                setSelectedGenre(null);
                            }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'step2_rules'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            2단계규칙
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('character_rules');
                                setMode('list');
                                setSelectedGenre(null);
                            }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'character_rules'
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            의상규칙
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('winter_accessories');
                                setMode('list');
                                setSelectedGenre(null);
                            }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'winter_accessories'
                                ? 'bg-cyan-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            겨울악세
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('outfit_selection');
                                setMode('list');
                                setSelectedGenre(null);
                            }}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${activeTab === 'outfit_selection'
                                ? 'bg-orange-600 text-white'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            의상선택
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'genres' && mode === 'list' && (
                        <div className="space-y-4">
                            {/* Action buttons */}
                            <div className="flex gap-2 mb-4">
                                <button
                                    onClick={handleStartAdd}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    새 장르 추가
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    기본값으로 초기화
                                </button>
                            </div>

                            {/* Backup manager */}
                            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">백업 관리</h3>
                                        <p className="text-[11px] text-slate-500">최대 5개까지 저장됩니다. 초과 시 오래된 백업이 제거됩니다.</p>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={backupName}
                                        onChange={(e) => setBackupName(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="백업 이름 (비워두면 자동 생성)"
                                    />
                                    <button
                                        onClick={handleBackupCreate}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        백업 생성
                                    </button>
                                </div>
                                {backups.length === 0 ? (
                                    <div className="text-xs text-slate-500">저장된 백업이 없습니다.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {backups.map((backup) => (
                                            <div
                                                key={backup.id}
                                                className="flex flex-col md:flex-row md:items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2"
                                            >
                                                <div className="flex-1 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={backupEdits[backup.id] ?? backup.name}
                                                            onChange={(e) =>
                                                                setBackupEdits((prev) => ({ ...prev, [backup.id]: e.target.value }))
                                                            }
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        />
                                                        <button
                                                            onClick={() => handleBackupRename(backup.id)}
                                                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-[11px] font-medium"
                                                        >
                                                            이름 저장
                                                        </button>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {new Date(backup.createdAt).toLocaleString()}
                                                        <span className="ml-2 text-slate-600">({backup.genres.length}개 장르)</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleOpenBackupEditor(backup.id)}
                                                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-medium"
                                                    >
                                                        보기/편집
                                                    </button>
                                                    <button
                                                        onClick={() => handleBackupRestore(backup.id)}
                                                        className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        복구
                                                    </button>
                                                    <button
                                                        onClick={() => handleBackupDelete(backup.id)}
                                                        className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Genre list */}
                            <div className="grid gap-3">
                                {genres.map(genre => (
                                    <div
                                        key={genre.id}
                                        className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-purple-500/50 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="text-base font-semibold text-white group-hover:text-purple-300 transition-colors">
                                                    {genre.name}
                                                </h3>
                                                <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                                                    {genre.description}
                                                </p>
                                                <div className="flex gap-2 mt-2 flex-wrap">
                                                    <span className="text-[10px] bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">
                                                        킬러 문구 {genre.killerPhrases?.length || 0}개
                                                    </span>
                                                    <span className="text-[10px] bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">
                                                        반전 예시 {genre.goodTwistExamples?.length || 0}개
                                                    </span>
                                                    <span className="text-[10px] bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded">
                                                        금지 패턴 {genre.forbiddenPatterns?.length || 0}개
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleStartEdit(genre)}
                                                    className="p-2 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg transition-colors"
                                                    title="수정"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(genre.id)}
                                                    className="p-2 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg transition-colors"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'genres' && (mode === 'edit' || mode === 'add') && (
                        <div className="space-y-6">
                            {/* Back button */}
                            <button
                                onClick={() => {
                                    setMode('list');
                                    setSelectedGenre(null);
                                }}
                                className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                목록으로 돌아가기
                            </button>

                            <h3 className="text-lg font-bold text-purple-400">
                                {mode === 'add' ? '새 장르 추가' : `수정: ${selectedGenre?.name}`}
                            </h3>

                            {/* Form fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Basic info */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">이름 *</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => updateField('name', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="장르 이름 (예: 코미디/유머)"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">설명</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => updateField('description', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="장르에 대한 설명..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">감정 곡선 (Emotion Curve)</label>
                                        <input
                                            type="text"
                                            value={formData.emotionCurve}
                                            onChange={(e) => updateField('emotionCurve', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="예: 즐거움 -> 놀람 -> 웃음"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">구성 방식 (Structure)</label>
                                        <textarea
                                            value={formData.structure}
                                            onChange={(e) => updateField('structure', e.target.value)}
                                            rows={6}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono"
                                            placeholder="[HOOK] ..."
                                        />
                                    </div>

                                    <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-medium text-slate-300">허용 의상 카테고리</label>
                                            <span className="text-[10px] text-slate-500">
                                                {formData.allowedOutfitCategories?.length ? `${formData.allowedOutfitCategories.length}개 선택` : '전체 허용'}
                                            </span>
                                        </div>
                                        {outfitCategories.length === 0 ? (
                                            <div className="text-[11px] text-slate-500">의상 카테고리를 불러오는 중...</div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {outfitCategories.map((category) => {
                                                    const isChecked = (formData.allowedOutfitCategories || []).includes(category.id);
                                                    return (
                                                        <label key={category.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => toggleAllowedOutfitCategory(category.id)}
                                                                className="accent-purple-500"
                                                            />
                                                            <span>{category.emoji} {category.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <div className="text-[10px] text-slate-500 mt-2">
                                            선택한 카테고리만 랜덤 의상 선택에 사용됩니다.
                                        </div>
                                    </div>
                                </div>

                                {/* Array fields */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            킬러 문구 (Killer Phrases) <span className="text-slate-500">(한 줄에 하나씩)</span>
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.killerPhrases)}
                                            onChange={(e) => updateArrayField('killerPhrases', e.target.value)}
                                            rows={4}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="핵심 문구들을 입력하세요..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            신체 반응 (Body Reactions) <span className="text-slate-500">(한 줄에 하나씩)</span>
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.bodyReactions)}
                                            onChange={(e) => updateArrayField('bodyReactions', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="묘사할 신체 반응들을 입력하세요..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            좋은 반전 예시 (Good Twist Examples) <span className="text-slate-500">(한 줄에 하나씩)</span>
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.goodTwistExamples)}
                                            onChange={(e) => updateArrayField('goodTwistExamples', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="좋은 반전 사례들을 입력하세요..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            나쁜 반전 예시 (Bad Twist Examples) <span className="text-slate-500">(한 줄에 하나씩)</span>
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.badTwistExamples)}
                                            onChange={(e) => updateArrayField('badTwistExamples', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="피해야 할 반전 사례들을 입력하세요..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            금지 패턴 (Forbidden Patterns) <span className="text-slate-500">(한 줄에 하나씩)</span>
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.forbiddenPatterns)}
                                            onChange={(e) => updateArrayField('forbiddenPatterns', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="금지할 패턴들을 입력하세요..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Advanced array fields (collapsible) */}
                            <details className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
                                <summary className="text-sm font-medium text-slate-300 cursor-pointer hover:text-white">
                                    고급 설정 (조연 캐릭터 패턴)
                                </summary>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            조연 대사 패턴
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.supportingCharacterPhrasePatterns)}
                                            onChange={(e) => updateArrayField('supportingCharacterPhrasePatterns', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="조연 캐릭터의 말투나 패턴..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1.5">
                                            조연 반전 패턴
                                        </label>
                                        <textarea
                                            value={arrayToText(formData.supportingCharacterTwistPatterns)}
                                            onChange={(e) => updateArrayField('supportingCharacterTwistPatterns', e.target.value)}
                                            rows={3}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                            placeholder="조연과 관련된 반전 패턴..."
                                        />
                                    </div>
                                </div>
                            </details>
                        </div>
                    )}

                    {activeTab === 'rules' && (
                        <div className="space-y-5">
                            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">프롬프트 규칙 편집</h3>
                                        <p className="text-[11px] text-slate-500">JSON 수정 후 저장하면 즉시 적용됩니다.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handlePromptRulesReset}
                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold"
                                        >
                                            기본값으로 초기화
                                        </button>
                                        <button
                                            onClick={handlePromptRulesSave}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>
                                <textarea
                                    value={rulesEditText}
                                    onChange={(e) => {
                                        setRulesEditText(e.target.value);
                                        setRulesDirty(true);
                                        setRulesEditError(null);
                                    }}
                                    rows={14}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                />
                                {rulesEditError && (
                                    <div className="text-xs text-rose-400">{rulesEditError}</div>
                                )}
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-200">프롬프트 규칙 백업</h3>
                                        <p className="text-[11px] text-slate-500">최대 5개까지 저장됩니다.</p>
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={rulesBackupName}
                                        onChange={(e) => setRulesBackupName(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        placeholder="백업 이름 (비워두면 자동 생성)"
                                    />
                                    <button
                                        onClick={handlePromptRulesBackupCreate}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        백업 생성
                                    </button>
                                </div>
                                {promptRuleBackups.length === 0 ? (
                                    <div className="text-xs text-slate-500">저장된 백업이 없습니다.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {promptRuleBackups.map((backup) => (
                                            <div
                                                key={backup.id}
                                                className="flex flex-col md:flex-row md:items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2"
                                            >
                                                <div className="flex-1 flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={rulesBackupEdits[backup.id] ?? backup.name}
                                                            onChange={(e) =>
                                                                setRulesBackupEdits((prev) => ({ ...prev, [backup.id]: e.target.value }))
                                                            }
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                        <button
                                                            onClick={() => handlePromptRulesBackupRename(backup.id)}
                                                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md text-[11px] font-medium"
                                                        >
                                                            이름 저장
                                                        </button>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {new Date(backup.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleOpenPromptRulesBackupEditor(backup.id)}
                                                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-medium"
                                                    >
                                                        보기/편집
                                                    </button>
                                                    <button
                                                        onClick={() => handlePromptRulesBackupRestore(backup.id)}
                                                        className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        복구
                                                    </button>
                                                    <button
                                                        onClick={() => handlePromptRulesBackupDelete(backup.id)}
                                                        className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded-lg text-xs font-medium"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'step2_rules' && (
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
                            <div className="space-y-6">
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-2">
                                    <div className="text-sm font-semibold text-slate-200">대본생성 프롬프트</div>
                                    <textarea
                                        value={step2ScriptPrompt}
                                        onChange={(e) => {
                                            setStep2ScriptPrompt(e.target.value);
                                            setStep2RulesDirty(true);
                                            setStep2RulesEditError(null);
                                        }}
                                        rows={6}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-2">
                                    <div className="text-sm font-semibold text-slate-200">캐릭터분석 프롬프트</div>
                                    <textarea
                                        value={step2CharacterPrompt}
                                        onChange={(e) => {
                                            setStep2CharacterPrompt(e.target.value);
                                            setStep2RulesDirty(true);
                                            setStep2RulesEditError(null);
                                        }}
                                        rows={6}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-2">
                                    <div className="text-sm font-semibold text-slate-200">이미지프롬프트 생성 프롬프트</div>
                                    <textarea
                                        value={step2FinalPrompt}
                                        onChange={(e) => {
                                            setStep2FinalPrompt(e.target.value);
                                            setStep2RulesDirty(true);
                                            setStep2RulesEditError(null);
                                        }}
                                        rows={8}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 space-y-3">
                                    <button
                                        onClick={() => setIsStep2PromptViewOpen(true)}
                                        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                                    >
                                        <FileText className="w-4 h-4" />
                                        전체 프롬프트 보기
                                    </button>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={handleStep2BackupCreate}
                                            className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold"
                                        >
                                            백업
                                        </button>
                                        <button
                                            onClick={handleStep2BackupRestoreSelected}
                                            className="px-2 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                                        >
                                            복원
                                        </button>
                                        <button
                                            onClick={handleStep2RulesSave}
                                            className="px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                                        >
                                            저장
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleStep2RulesReset}
                                        className="w-full px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold"
                                    >
                                        기본값으로 초기화
                                    </button>
                                    <div className="text-[11px] text-slate-500">저장 후 즉시 적용됩니다.</div>
                                    {step2RulesEditError && (
                                        <div className="text-xs text-rose-400">{step2RulesEditError}</div>
                                    )}
                                </div>
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 space-y-2">
                                    <div className="text-xs font-semibold text-slate-300">백업 선택 (최대 5개)</div>
                                    {(!step2Backups || step2Backups.length === 0) ? (
                                        <div className="text-xs text-slate-500">저장된 백업이 없습니다.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {step2Backups.map((backup, index) => (
                                                <div
                                                    key={backup.id}
                                                    className={`rounded-lg border transition-colors ${selectedStep2BackupId === backup.id
                                                        ? 'border-blue-500 bg-blue-600/20'
                                                        : 'border-slate-800 bg-slate-900'
                                                        }`}
                                                >
                                                    <div className="p-3 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={step2BackupEdits[backup.id] ?? backup.name}
                                                                onChange={(e) =>
                                                                    setStep2BackupEdits((prev) => ({ ...prev, [backup.id]: e.target.value }))
                                                                }
                                                                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                            <button
                                                                onClick={() => handleStep2BackupRename(backup.id)}
                                                                className="px-1.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[9px]"
                                                            >
                                                                저장
                                                            </button>
                                                        </div>
                                                        <div
                                                            className="cursor-pointer"
                                                            onClick={() => setSelectedStep2BackupId(backup.id)}
                                                        >
                                                            <div className="text-[10px] text-slate-400">{new Date(backup.createdAt).toLocaleString()}</div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handleOpenStep2BackupEditor(backup.id)}
                                                                className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-semibold"
                                                            >
                                                                보기/편집
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (selectedStep2BackupId === backup.id) {
                                                                        setSelectedStep2BackupId(null);
                                                                    }
                                                                    handleStep2BackupDelete(backup.id);
                                                                }}
                                                                className="px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded text-[10px] font-semibold"
                                                            >
                                                                삭제
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'character_rules' && (
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
                            <div className="space-y-6">
                                {/* Female Characters */}
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/60 transition-colors"
                                        onClick={() => setIsFemaleSectionExpanded(!isFemaleSectionExpanded)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronDown
                                                className={`w-5 h-5 text-blue-400 transition-transform ${isFemaleSectionExpanded ? 'rotate-180' : ''}`}
                                            />
                                            <div className="text-lg font-bold text-blue-400">여성 캐릭터</div>
                                            <span className="text-xs text-slate-500">({characterRulesState.females.length}명)</span>
                                        </div>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    if (!onAddFemaleCharacter) return;
                                                    const updated = await onAddFemaleCharacter();
                                                    if (updated?.females) {
                                                        setCharacterRulesState((prev) => {
                                                            const existing = new Set(prev.females.map((char) => char.id));
                                                            const additions = updated.females.filter((char) => !existing.has(char.id));
                                                            if (additions.length === 0) return prev;
                                                            return {
                                                                ...prev,
                                                                females: [...prev.females, ...additions]
                                                            };
                                                        });
                                                    }
                                                    showToast('여성 캐릭터가 추가되었습니다.', 'success');
                                                } catch (err) {
                                                    console.error('Failed to add female character:', err);
                                                    showToast('캐릭터 추가 실패', 'error');
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            추가
                                        </button>
                                    </div>
                                    {isFemaleSectionExpanded && (
                                        <div className="px-4 pb-4 space-y-3">
                                    {characterRulesState.females.map((char, idx) => {
                                        const isExpanded = expandedCharacters.has(char.id);
                                        return (
                                            <div key={char.id} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/60 transition-colors"
                                                    onClick={() => toggleCharacterExpand(char.id)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown
                                                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                        <div className="text-sm font-semibold text-slate-200">
                                                            Female {String.fromCharCode(65 + idx)}
                                                            {char.id === 'femaleD' && (
                                                                <span className="ml-2 text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-0.5 rounded">캐디</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                handleOpenImportModal('female', char.id);
                                                            }}
                                                            className="px-2 py-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            가져오기
                                                        </button>
                                                        {char.id !== 'femaleD' && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    try {
                                                                        if (!onDeleteFemaleCharacter) return;
                                                                        await onDeleteFemaleCharacter(char.id);
                                                                        showToast('캐릭터가 삭제되었습니다.', 'success');
                                                                    } catch (err) {
                                                                        const message = err instanceof Error ? err.message : '캐릭터 삭제 실패';
                                                                        showToast(message, 'error');
                                                                    }
                                                                }}
                                                                className="px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                삭제
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 space-y-3">
                                                        <div className="grid grid-cols-1 gap-3">
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Identity</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.identity}
                                                                    onChange={(e) => updateCharacterRulesField('female', char.id, 'identity', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="A stunning Korean woman"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Hair</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.hair}
                                                                    onChange={(e) => updateCharacterRulesField('female', char.id, 'hair', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="long soft-wave hairstyle"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Body</label>
                                                                <textarea
                                                                    value={char.body}
                                                                    onChange={(e) => updateCharacterRulesField('female', char.id, 'body', e.target.value)}
                                                                    rows={2}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                                    placeholder="slim hourglass figure..."
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Style</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.style}
                                                                    onChange={(e) => updateCharacterRulesField('female', char.id, 'style', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="perfectly managed sophisticated look"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Outfit Fit</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.outfitFit}
                                                                    onChange={(e) => updateCharacterRulesField('female', char.id, 'outfitFit', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="tight-fitting, form-hugging"
                                                                />
                                                            </div>
                                                            {char.id === 'femaleD' && (
                                                                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                                                                        <span className="text-xs font-semibold text-emerald-300">나이 고정 (캐디 전용)</span>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-xs text-slate-400 mb-1 block">Fixed Age</label>
                                                                        <input
                                                                            type="text"
                                                                            value={char.fixedAge || 'in her early 20s'}
                                                                            onChange={(e) => updateCharacterRulesField('female', char.id, 'fixedAge', e.target.value)}
                                                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                                            disabled={!char.isFixedAge}
                                                                        />
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-500">캐디는 항상 20대 초반으로 고정됩니다</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                        </div>
                                    )}
                                </div>

                                {/* Male Characters */}
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/60 transition-colors"
                                        onClick={() => setIsMaleSectionExpanded(!isMaleSectionExpanded)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <ChevronDown
                                                className={`w-5 h-5 text-blue-400 transition-transform ${isMaleSectionExpanded ? 'rotate-180' : ''}`}
                                            />
                                            <div className="text-lg font-bold text-blue-400">남성 캐릭터</div>
                                            <span className="text-xs text-slate-500">({characterRulesState.males.length}명)</span>
                                        </div>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    if (!onAddMaleCharacter) return;
                                                    const updated = await onAddMaleCharacter();
                                                    if (updated?.males) {
                                                        setCharacterRulesState((prev) => {
                                                            const existing = new Set(prev.males.map((char) => char.id));
                                                            const additions = updated.males.filter((char) => !existing.has(char.id));
                                                            if (additions.length === 0) return prev;
                                                            return {
                                                                ...prev,
                                                                males: [...prev.males, ...additions]
                                                            };
                                                        });
                                                    }
                                                    showToast('남성 캐릭터가 추가되었습니다.', 'success');
                                                } catch (err) {
                                                    console.error('Failed to add male character:', err);
                                                    showToast('캐릭터 추가 실패', 'error');
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            추가
                                        </button>
                                    </div>
                                    {isMaleSectionExpanded && (
                                        <div className="px-4 pb-4 space-y-3">
                                    {characterRulesState.males.map((char, idx) => {
                                        const isExpanded = expandedCharacters.has(char.id);
                                        return (
                                            <div key={char.id} className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
                                                <div
                                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/60 transition-colors"
                                                    onClick={() => toggleCharacterExpand(char.id)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ChevronDown
                                                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                        />
                                                        <div className="text-sm font-semibold text-slate-200">Male {String.fromCharCode(65 + idx)}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                handleOpenImportModal('male', char.id);
                                                            }}
                                                            className="px-2 py-1 bg-blue-600/80 hover:bg-blue-500 text-white rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            가져오기
                                                        </button>
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                try {
                                                                    if (!onDeleteMaleCharacter) return;
                                                                    await onDeleteMaleCharacter(char.id);
                                                                    showToast('캐릭터가 삭제되었습니다.', 'success');
                                                                } catch (err) {
                                                                    const message = err instanceof Error ? err.message : '캐릭터 삭제 실패';
                                                                    showToast(message, 'error');
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded-md text-[10px] font-semibold transition-colors flex items-center gap-1"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                            삭제
                                                        </button>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 space-y-3">
                                                        <div className="grid grid-cols-1 gap-3">
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Identity</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.identity}
                                                                    onChange={(e) => updateCharacterRulesField('male', char.id, 'identity', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="A handsome Korean man"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Hair</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.hair}
                                                                    onChange={(e) => updateCharacterRulesField('male', char.id, 'hair', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="short neat hairstyle"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Body</label>
                                                                <textarea
                                                                    value={char.body}
                                                                    onChange={(e) => updateCharacterRulesField('male', char.id, 'body', e.target.value)}
                                                                    rows={2}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                                    placeholder="fit athletic build..."
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Style</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.style}
                                                                    onChange={(e) => updateCharacterRulesField('male', char.id, 'style', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="dandy and refined presence"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs text-slate-400 mb-1 block">Outfit Fit</label>
                                                                <input
                                                                    type="text"
                                                                    value={char.outfitFit}
                                                                    onChange={(e) => updateCharacterRulesField('male', char.id, 'outfitFit', e.target.value)}
                                                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="tailored slim-fit"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                        </div>
                                    )}
                                </div>

                                {/* Common Settings */}
                                <div className="space-y-4">
                                    <div className="text-lg font-bold text-purple-400">공통 설정</div>
                                    <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3">
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Negative Prompt</label>
                                            <textarea
                                                value={characterRulesState.common.negativePrompt}
                                                onChange={(e) => setCharacterRulesState(prev => ({
                                                    ...prev,
                                                    common: { ...prev.common, negativePrompt: e.target.value }
                                                }))}
                                                rows={3}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                placeholder="NOT cartoon, NOT anime..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-400 mb-1 block">Quality Tags</label>
                                            <textarea
                                                value={characterRulesState.common.qualityTags}
                                                onChange={(e) => setCharacterRulesState(prev => ({
                                                    ...prev,
                                                    common: { ...prev.common, qualityTags: e.target.value }
                                                }))}
                                                rows={3}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                                placeholder="photorealistic, 8k resolution..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar - Actions & Backups */}
                            <div className="space-y-4">
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={handleCharacterRulesBackupCreate}
                                            className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg text-xs font-semibold"
                                        >
                                            백업
                                        </button>
                                        <button
                                            onClick={handleCharacterRulesBackupRestoreSelected}
                                            className="px-2 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                                        >
                                            복원
                                        </button>
                                        <button
                                            onClick={handleCharacterRulesSave}
                                            className="px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
                                        >
                                            저장
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleCharacterRulesReset}
                                        className="w-full px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold"
                                    >
                                        기본값으로 초기화
                                    </button>
                                    <div className="text-[11px] text-slate-500">저장 후 즉시 적용됩니다.</div>
                                    {characterRulesEditError && (
                                        <div className="text-xs text-rose-400">{characterRulesEditError}</div>
                                    )}
                                </div>
                                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 space-y-2">
                                    <div className="text-xs font-semibold text-slate-300">백업 선택 (최대 5개)</div>
                                    {(!characterRulesBackups || characterRulesBackups.length === 0) ? (
                                        <div className="text-xs text-slate-500">저장된 백업이 없습니다.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {characterRulesBackups.map((backup, index) => (
                                                <div
                                                    key={backup.id}
                                                    className={`rounded-lg border transition-colors ${selectedCharacterRulesBackupId === backup.id
                                                        ? 'border-blue-500 bg-blue-600/20'
                                                        : 'border-slate-800 bg-slate-900'
                                                        }`}
                                                >
                                                    <div className="p-3 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={characterRulesBackupEdits[backup.id] ?? backup.name}
                                                                onChange={(e) =>
                                                                    setCharacterRulesBackupEdits((prev) => ({ ...prev, [backup.id]: e.target.value }))
                                                                }
                                                                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const name = (characterRulesBackupEdits[backup.id] || '').trim();
                                                                    if (name) onCharacterRulesBackupRename(backup.id, name);
                                                                }}
                                                                className="px-1.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-[9px]"
                                                            >
                                                                저장
                                                            </button>
                                                        </div>
                                                        <div
                                                            className="cursor-pointer"
                                                            onClick={() => setSelectedCharacterRulesBackupId(backup.id)}
                                                        >
                                                            <div className="text-[10px] text-slate-400">{new Date(backup.createdAt).toLocaleString()}</div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => handleOpenCharacterRulesBackupEditor(backup.id)}
                                                                className="flex-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-semibold"
                                                            >
                                                                보기/편집
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (selectedCharacterRulesBackupId === backup.id) {
                                                                        setSelectedCharacterRulesBackupId(null);
                                                                    }
                                                                    handleCharacterRulesBackupDelete(backup.id);
                                                                }}
                                                                className="px-2 py-1 bg-rose-600/80 hover:bg-rose-500 text-white rounded text-[10px] font-semibold"
                                                            >
                                                                삭제
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 겨울악세 탭 */}
                    {activeTab === 'winter_accessories' && (
                        <div className="space-y-6">
                            {/* ON 상태 지침 */}
                            <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl">❄️</span>
                                    <h3 className="text-lg font-bold text-cyan-400">겨울 악세서리 ON</h3>
                                </div>
                                <p className="text-sm text-slate-300 mb-4">
                                    모든 씬의 이미지 프롬프트에 겨울 악세서리가 자동으로 추가됩니다.
                                </p>
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">규칙</h4>
                                    <ul className="space-y-2">
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-cyan-500 mt-0.5">•</span>
                                            <span>beanie (비니), earmuffs (귀마개), scarf (목도리), gloves (장갑), winter boots (겨울 부츠) 중 1~2개를 자연스럽게 배치</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-cyan-500 mt-0.5">•</span>
                                            <span>겨울 키워드(눈, 스키, 겨울 등)가 있을 때 상의를 타이트한 긴팔 + 어깨/쇄골 노출 스타일로 변환</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-cyan-500 mt-0.5">•</span>
                                            <span>악세서리는 "accessorized with [item1], [item2]" 형식으로 프롬프트에 추가</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-cyan-500 mt-0.5">•</span>
                                            <span>딥브이넥 → 오프숄더, 짧은소매 → 긴팔로 강제 치환</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="mt-4 pt-4 border-t border-cyan-700/30">
                                    <h4 className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-2">예시</h4>
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500 font-mono">accessorized with stylish pom-pom beanie, leather gloves</p>
                                        <p className="text-xs text-slate-500 font-mono">accessorized with fur earmuffs, cashmere scarf</p>
                                    </div>
                                </div>
                            </div>

                            {/* OFF 상태 지침 */}
                            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl">🚫</span>
                                    <h3 className="text-lg font-bold text-slate-400">겨울 악세서리 OFF</h3>
                                </div>
                                <p className="text-sm text-slate-400 mb-4">
                                    겨울 악세서리를 자동으로 추가하지 않습니다.
                                </p>
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">규칙</h4>
                                    <ul className="space-y-2">
                                        <li className="text-xs text-slate-500 flex items-start gap-2">
                                            <span className="text-slate-600 mt-0.5">•</span>
                                            <span>기존 의상 프롬프트를 그대로 사용</span>
                                        </li>
                                        <li className="text-xs text-slate-500 flex items-start gap-2">
                                            <span className="text-slate-600 mt-0.5">•</span>
                                            <span>수동으로 겨울 악세서리를 추가하려면 프롬프트에 직접 입력</span>
                                        </li>
                                        <li className="text-xs text-slate-500 flex items-start gap-2">
                                            <span className="text-slate-600 mt-0.5">•</span>
                                            <span>겨울 키워드가 있어도 상의 변환 없이 원본 의상 유지</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 의상선택 탭 */}
                    {activeTab === 'outfit_selection' && (
                        <div className="space-y-6">
                            {/* 랜덤 선택 (ON) 지침 */}
                            <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl">🎲</span>
                                    <h3 className="text-lg font-bold text-orange-400">의상 랜덤 선택 ON</h3>
                                </div>
                                <p className="text-sm text-slate-300 mb-4">
                                    로컬 카탈로그에서 미리 정의된 의상을 무작위로 선택합니다.
                                </p>
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-orange-300 uppercase tracking-wider">규칙</h4>
                                    <ul className="space-y-2">
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-orange-500 mt-0.5">•</span>
                                            <span>pickFemaleOutfit(), pickMaleOutfit() 함수가 로컬 의상 풀에서 랜덤 선택</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-orange-500 mt-0.5">•</span>
                                            <span>같은 의상이 중복되지 않도록 필터링</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-orange-500 mt-0.5">•</span>
                                            <span>Woman A, B, D와 Man A, B 각각 독립적으로 선택</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-orange-500 mt-0.5">•</span>
                                            <span>빠른 처리 속도 (LLM 호출 없음)</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="mt-4 pt-4 border-t border-orange-700/30">
                                    <h4 className="text-xs font-semibold text-orange-300 uppercase tracking-wider mb-2">장점</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-orange-600/20 text-orange-400 rounded text-xs">⚡ 속도 빠름</span>
                                        <span className="px-2 py-1 bg-orange-600/20 text-orange-400 rounded text-xs">📊 결과 일관성</span>
                                        <span className="px-2 py-1 bg-orange-600/20 text-orange-400 rounded text-xs">🎯 예측 가능한 스타일</span>
                                    </div>
                                </div>
                            </div>

                            {/* LLM 선택 (OFF) 지침 */}
                            <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-2xl">🤖</span>
                                    <h3 className="text-lg font-bold text-purple-400">의상 LLM 선택 ON</h3>
                                </div>
                                <p className="text-sm text-slate-300 mb-4">
                                    AI가 주제와 장르에 맞는 의상을 실시간으로 생성합니다.
                                </p>
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider">규칙</h4>
                                    <ul className="space-y-2">
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-purple-500 mt-0.5">•</span>
                                            <span>프롬프트 빌드 시 outfitPlaceholder로 표시</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-purple-500 mt-0.5">•</span>
                                            <span>LLM이 주제, 장르, 캐릭터 특성을 고려하여 의상 생성</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-purple-500 mt-0.5">•</span>
                                            <span>더 창의적이고 주제에 맞는 의상 가능</span>
                                        </li>
                                        <li className="text-xs text-slate-400 flex items-start gap-2">
                                            <span className="text-purple-500 mt-0.5">•</span>
                                            <span>약간의 처리 시간 추가 소요</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="mt-4 pt-4 border-t border-purple-700/30">
                                    <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">장점</h4>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs">✨ 창의적인 의상</span>
                                        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs">🎭 주제 적합성</span>
                                        <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs">🌈 다양성</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {activeTab === 'genres' && (mode === 'edit' || mode === 'add') && (
                    <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
                        <button
                            onClick={() => handleOpenGuidelineView(selectedGenre || formData)}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            전체보기
                        </button>
                        <button
                            onClick={() => {
                                setMode('list');
                                setSelectedGenre(null);
                            }}
                            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                        >
                            취소
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    저장 중...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    장르 저장
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* 지침 전체 보기 모달 */}
                {isGuidelineViewOpen && selectedGuidelineGenre && (
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4"
                        onClick={() => setIsGuidelineViewOpen(false)}
                    >
                        <div
                            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-800">
                                <div>
                                    <h3 className="text-xl font-bold text-white">📋 {selectedGuidelineGenre.name} - 전체 지침</h3>
                                    <p className="text-xs text-slate-400 mt-1">{selectedGuidelineGenre.description}</p>
                                </div>
                                <button
                                    onClick={() => setIsGuidelineViewOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-800/50">
                                <pre className="whitespace-pre-wrap text-sm text-slate-200 font-mono leading-relaxed">
                                    {formatGuidelineAsText(selectedGuidelineGenre)}
                                </pre>
                            </div>

                            <div className="flex justify-end gap-2 p-6 border-t border-slate-800">
                                <button
                                    onClick={handleCopyGuidelines}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" />
                                    복사
                                </button>
                                <button
                                    onClick={handleDownloadGuidelines}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    다운로드
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2단계 프롬프트 전체 보기/편집 모달 */}
                {isStep2PromptViewOpen && (
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4"
                        onClick={() => setIsStep2PromptViewOpen(false)}
                    >
                        <div
                            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-800">
                                <div>
                                    <h3 className="text-xl font-bold text-white">📋 2단계 프롬프트 - 보기/편집</h3>
                                    <p className="text-xs text-slate-400 mt-1">대본생성, 캐릭터분석, 이미지프롬프트 생성 프롬프트를 수정하고 저장할 수 있습니다</p>
                                </div>
                                <button
                                    onClick={() => setIsStep2PromptViewOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-800/50 space-y-6">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-blue-400">📝 대본생성 프롬프트</h4>
                                    <textarea
                                        value={step2ScriptPrompt}
                                        onChange={(e) => {
                                            setStep2ScriptPrompt(e.target.value);
                                            setStep2RulesDirty(true);
                                            setStep2RulesEditError(null);
                                        }}
                                        rows={8}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                        placeholder="대본생성 프롬프트를 입력하세요..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-emerald-400">👤 캐릭터분석 프롬프트</h4>
                                    <textarea
                                        value={step2CharacterPrompt}
                                        onChange={(e) => {
                                            setStep2CharacterPrompt(e.target.value);
                                            setStep2RulesDirty(true);
                                            setStep2RulesEditError(null);
                                        }}
                                        rows={8}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                        placeholder="캐릭터분석 프롬프트를 입력하세요..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold text-purple-400">🎨 이미지프롬프트 생성 프롬프트</h4>
                                    <textarea
                                        value={step2FinalPrompt}
                                        onChange={(e) => {
                                            setStep2FinalPrompt(e.target.value);
                                            setStep2RulesDirty(true);
                                            setStep2RulesEditError(null);
                                        }}
                                        rows={10}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                        placeholder="이미지프롬프트 생성 프롬프트를 입력하세요..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 p-6 border-t border-slate-800">
                                <button
                                    onClick={() => setIsStep2PromptViewOpen(false)}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={async () => {
                                        const fullText = `=== 대본생성 프롬프트 ===\n${step2ScriptPrompt}\n\n=== 캐릭터분석 프롬프트 ===\n${step2CharacterPrompt}\n\n=== 이미지프롬프트 생성 프롬프트 ===\n${step2FinalPrompt}`;
                                        try {
                                            await navigator.clipboard.writeText(fullText);
                                            showToast('모든 프롬프트가 복사되었습니다.', 'success');
                                        } catch (error) {
                                            console.error('Failed to copy prompts:', error);
                                            showToast('복사 실패', 'error');
                                        }
                                    }}
                                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" />
                                    복사
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await onStep2RulesSave({
                                                scriptPrompt: step2ScriptPrompt,
                                                characterPrompt: step2CharacterPrompt,
                                                finalPrompt: step2FinalPrompt
                                            });
                                            setStep2RulesDirty(false);
                                            showToast('프롬프트가 저장되었습니다.', 'success');
                                            setIsStep2PromptViewOpen(false);
                                        } catch (error) {
                                            console.error('Failed to save step2 rules:', error);
                                            showToast('저장 실패', 'error');
                                        }
                                    }}
                                    disabled={!step2RulesDirty}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {step2RulesDirty ? '저장' : '저장됨'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* 🔹 통합 백업 편집기 모달 (v3.9.5 - 부모 모달 닫힘 방지 조치) */}
            {(editingBackupId || editingRulesBackupId || editingStep2BackupId || editingCharacterRulesBackupId) && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={(e) => {
                        e.stopPropagation(); // 🔹 장르매니저가 같이 닫히지 않도록 이벤트 전파 차단
                        if (editingBackupId) handleCloseBackupEditor();
                        else if (editingRulesBackupId) handleClosePromptRulesBackupEditor();
                        else if (editingStep2BackupId) handleCloseStep2BackupEditor();
                        else handleCloseCharacterRulesBackupEditor();
                    }}
                >
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {editingBackupId && '장르 가이드라인 백업 편집'}
                                    {editingRulesBackupId && '프롬프트 규칙 백업 편집'}
                                    {editingStep2BackupId && '2단계 규칙 백업 편집'}
                                    {editingCharacterRulesBackupId && '의상 규칙 백업 편집'}
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">JSON 데이터를 수정한 뒤 저장하세요.</p>
                            </div>
                            <button
                                onClick={() => {
                                    if (editingBackupId) handleCloseBackupEditor();
                                    else if (editingRulesBackupId) handleClosePromptRulesBackupEditor();
                                    else if (editingStep2BackupId) handleCloseStep2BackupEditor();
                                    else handleCloseCharacterRulesBackupEditor();
                                }}
                                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-hidden flex flex-col">
                            <textarea
                                value={
                                    editingBackupId ? backupEditText : 
                                    (editingRulesBackupId ? rulesBackupEditText : 
                                    (editingStep2BackupId ? step2BackupEditText : characterRulesBackupEditText))
                                }
                                onChange={(e) => {
                                    if (editingBackupId) {
                                        setBackupEditText(e.target.value);
                                        setBackupEditError(null);
                                    } else if (editingRulesBackupId) {
                                        setRulesBackupEditText(e.target.value);
                                        setRulesBackupEditError(null);
                                    } else if (editingStep2BackupId) {
                                        setStep2BackupEditText(e.target.value);
                                        setStep2BackupEditError(null);
                                    } else {
                                        setCharacterRulesBackupEditText(e.target.value);
                                        setCharacterRulesBackupEditError(null);
                                    }
                                }}
                                className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                placeholder="JSON 데이터를 입력하세요..."
                            />
                            {(backupEditError || rulesBackupEditError || step2BackupEditError || characterRulesBackupEditError) && (
                                <div className="mt-2 text-xs text-rose-400">
                                    {backupEditError || rulesBackupEditError || step2BackupEditError || characterRulesBackupEditError}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
                            <button
                                onClick={() => {
                                    if (editingBackupId) handleCloseBackupEditor();
                                    else if (editingRulesBackupId) handleClosePromptRulesBackupEditor();
                                    else if (editingStep2BackupId) handleCloseStep2BackupEditor();
                                    else handleCloseCharacterRulesBackupEditor();
                                }}
                                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    if (editingBackupId) handleBackupSaveContent();
                                    else if (editingRulesBackupId) handleSavePromptRulesBackupContent();
                                    else if (editingStep2BackupId) handleSaveStep2BackupContent();
                                    else handleSaveCharacterRulesBackupContent();
                                }}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                저장
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* 캐릭터 가져오기 모달 */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-100">
                                캐릭터 가져오기
                            </h3>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="p-1 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="text-sm text-slate-400 mb-3">
                                {importTargetGender === 'female' ? '여성' : '남성'} 캐릭터 목록에서 선택하세요
                            </div>
                            {isLoadingCharacters ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                </div>
                            ) : importableCharacters.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    저장된 {importTargetGender === 'female' ? '여성' : '남성'} 캐릭터가 없습니다.
                                    <br />
                                    <span className="text-xs">입력탭 → 캐릭터관리에서 먼저 캐릭터를 생성해주세요.</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {importableCharacters.map((char) => (
                                        <button
                                            key={char.id}
                                            onClick={() => handleImportCharacter(char)}
                                            className="w-full p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-blue-500/50 rounded-xl text-left transition-all group"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
                                                        {char.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {char.age} · {char.gender === 'female' ? '여성' : '남성'}
                                                    </div>
                                                </div>
                                                <Download className="w-4 h-4 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                            </div>
                                            {char.hair && (
                                                <div className="mt-2 text-[10px] text-slate-500 truncate">
                                                    헤어: {char.hair.substring(0, 50)}...
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ShortsLabPanel;

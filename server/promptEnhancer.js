import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = path.join(__dirname, 'prompt_enhancement_settings.json');

const QUALITY_TAG_FALLBACK = ", photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field --ar 9:16";

const DEFAULT_SLOT_PRESETS = [
    {
        id: 'slot-nationality',
        label: '국적/민족성',
        keywords: ['South Korean style', 'Cheongdam-dong high society aura'],
        autoSentence: true,
        enabled: true
    },
    {
        id: 'slot-figure',
        label: '체형/실루엣',
        keywords: [
            'Sculpted hourglass silhouette',
            'Graceful S-line curves',
            'Healthy glow'
        ],
        autoSentence: true,
        enabled: true
    },
    {
        id: 'slot-outfit',
        label: '의상 스타일',
        keywords: ['Ultra-tight couture golf mini dress', 'High-fashion textures'],
        autoSentence: true,
        enabled: true
    }
];

const DEFAULT_SETTINGS = {
    autoEnhanceOnGeneration: true,
    slots: DEFAULT_SLOT_PRESETS,
    useQualityTags: true,
    qualityTags: QUALITY_TAG_FALLBACK
};

const DEFAULT_PROFILE = {
    id: 'profile-default',
    name: '기본 옵션',
    settings: DEFAULT_SETTINGS
};

const cloneSlot = (slot = {}) => ({
    id: slot.id || `slot-${Math.random().toString(36).slice(2, 10)}`,
    label: slot.label || '커스텀 슬롯',
    keywords: Array.isArray(slot.keywords) ? slot.keywords.map((kw) => kw.trim()).filter(Boolean) : [],
    autoSentence: slot.autoSentence !== undefined ? Boolean(slot.autoSentence) : true,
    customSentence: slot.customSentence || '',
    enabled: slot.enabled !== undefined ? Boolean(slot.enabled) : true
});

const convertLegacySlots = (raw = {}) => {
    const slots = [];
    if (Array.isArray(raw.koreanKeywords) && raw.koreanKeywords.length) {
        slots.push(cloneSlot({
            id: 'slot-nationality',
            label: '국적/민족성',
            keywords: raw.koreanKeywords,
            autoSentence: true,
            enabled: raw.useKoreanForce !== false
        }));
    }
    if (Array.isArray(raw.slimGlamourKeywords) && raw.slimGlamourKeywords.length) {
        slots.push(cloneSlot({
            id: 'slot-figure',
            label: '체형/실루엣',
            keywords: raw.slimGlamourKeywords,
            autoSentence: true,
            enabled: raw.useSlimGlamour !== false
        }));
    }
    return slots;
};

const normalizeSettings = (raw = {}) => {
    const slots = Array.isArray(raw.slots) && raw.slots.length
        ? raw.slots.map((slot) => cloneSlot(slot))
        : convertLegacySlots(raw);

    return {
        autoEnhanceOnGeneration: raw.autoEnhanceOnGeneration !== undefined ? Boolean(raw.autoEnhanceOnGeneration) : DEFAULT_SETTINGS.autoEnhanceOnGeneration,
        slots: slots.length ? slots : DEFAULT_SLOT_PRESETS.map((slot) => cloneSlot({ ...slot, id: `slot-${Math.random().toString(36).slice(2, 10)}` })),
        useQualityTags: raw.useQualityTags !== undefined ? Boolean(raw.useQualityTags) : DEFAULT_SETTINGS.useQualityTags,
        qualityTags: typeof raw.qualityTags === 'string' && raw.qualityTags.trim().length ? raw.qualityTags : QUALITY_TAG_FALLBACK
    };
};

const normalizeProfile = (profile = {}) => {
    const profileSettings = profile.settings || {};
    return {
        id: profile.id || `profile-${Math.random().toString(36).slice(2, 10)}`,
        name: profile.name || '새 옵션',
        settings: normalizeSettings(profileSettings)
    };
};

const normalizeProfileStore = (raw = {}) => {
    if (!raw || !Array.isArray(raw.profiles)) {
        const fallbackProfile = {
            ...DEFAULT_PROFILE,
            settings: normalizeSettings(raw)
        };
        return {
            activeProfileId: fallbackProfile.id,
            profiles: [fallbackProfile]
        };
    }

    const normalizedProfiles = raw.profiles.map((profile) => normalizeProfile(profile));
    if (!normalizedProfiles.length) {
        normalizedProfiles.push({
            ...DEFAULT_PROFILE,
            settings: normalizeSettings(DEFAULT_SETTINGS)
        });
    }

    const activeProfileId = normalizedProfiles.some((profile) => profile.id === raw.activeProfileId)
        ? raw.activeProfileId
        : normalizedProfiles[0].id;

    return {
        activeProfileId,
        profiles: normalizedProfiles
    };
};

const readRawStoreFromDisk = () => {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Failed to load prompt enhancement settings:", e);
    }
    return { profiles: [DEFAULT_PROFILE], activeProfileId: DEFAULT_PROFILE.id };
};

const writeStoreToDisk = (store) => {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(store, null, 2));
};

export const getProfileStore = () => normalizeProfileStore(readRawStoreFromDisk());

// Load settings
export const getSettings = () => {
    const store = getProfileStore();
    const activeProfile = store.profiles.find((profile) => profile.id === store.activeProfileId) || store.profiles[0];
    return normalizeSettings(activeProfile ? activeProfile.settings : DEFAULT_SETTINGS);
};

// Save settings
export const saveSettings = (newSettings) => {
    try {
        const store = getProfileStore();
        const normalized = normalizeSettings(newSettings);
        const updatedProfiles = store.profiles.map((profile) =>
            profile.id === store.activeProfileId
                ? { ...profile, settings: normalized }
                : profile
        );
        writeStoreToDisk({
            activeProfileId: store.activeProfileId,
            profiles: updatedProfiles
        });
        return true;
    } catch (e) {
        console.error("Failed to save prompt enhancement settings:", e);
        return false;
    }
};

export const saveProfileStore = (incomingStore = {}) => {
    try {
        const normalizedStore = normalizeProfileStore(incomingStore);
        writeStoreToDisk(normalizedStore);
        return true;
    } catch (e) {
        console.error("Failed to save prompt enhancement settings:", e);
        return false;
    }
};

// --- Character Helper Functions ---

export const buildCharacterMap = (characters = []) => {
    const map = {};
    characters.forEach((ch) => {
        if (ch && ch.id) {
            map[ch.id] = {
                ...ch,
                gender: ch.gender ? String(ch.gender).toUpperCase() : undefined
            };
        }
    });
    return map;
};

export const injectCharacterDetails = (prompt, characterIds, characterMap) => {
    if (!prompt) return "";
    let updated = prompt;
    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0 || !characterMap) {
        return updated;
    }
    characterIds.forEach((id) => {
        const ch = characterMap[id];
        if (!ch) return;
        if (ch.outfit && !updated.includes(ch.outfit)) {
            updated += `, ${ch.outfit}`;
        }
        if (ch.hair && !updated.includes(ch.hair)) {
            updated += `, ${ch.hair}`;
        }
    });
    return updated;
};

export const isFemaleFromCharacters = (characterIds, characterMap) => {
    if (!characterIds || !characterMap) return false;
    return characterIds.some((id) => {
        const ch = characterMap[id];
        if (!ch) return false;
        if (ch.gender && ch.gender.toUpperCase() === 'FEMALE') return true;
        const outfitText = `${ch.outfit || ''} ${ch.role || ''} ${ch.name || ''}`.toLowerCase();
        return /female|woman|girl|wife|lady|korean woman|korean girl/.test(outfitText);
    });
};

export const assignCharacterIdsIfMissing = (scenes = [], characterMap = {}) => {
    const ids = Object.keys(characterMap);
    if (!ids.length) return scenes;
    const primaryFemale = ids.find(id => isFemaleFromCharacters([id], characterMap));
    const primary = primaryFemale || ids[0];
    return scenes.map(scene => {
        if (scene.characterIds && scene.characterIds.length) return scene;
        return { ...scene, characterIds: [primary] };
    });
};

const SLOT_TEMPLATE_RULES = [
    {
        match: /(국적|민족|nation|korean|ethnic)/i,
        en: (phrase) => `She embodies ${phrase}.`,
        ko: (phrase) => `그녀는 ${phrase} 품격을 보여준다.`
    },
    {
        match: /(체형|몸매|body|figure|silhouette|curve|곡선)/i,
        en: (phrase) => `Her silhouette highlights ${phrase}.`,
        ko: (phrase) => `실루엣은 ${phrase}를 강조한다.`
    },
    {
        match: /(의상|outfit|스타일|look|복장)/i,
        en: (phrase) => `Her outfit features ${phrase}.`,
        ko: (phrase) => `의상은 ${phrase} 디테일을 담고 있다.`
    },
    {
        match: /(헤어|머리|hair)/i,
        en: (phrase) => `Her hair is styled with ${phrase}.`,
        ko: (phrase) => `헤어스타일은 ${phrase} 느낌으로 완성된다.`
    }
];

const FEMALE_SLOT_REGEX = /(체형|몸매|silhouette|figure|곡선|curve|woman|여성)/i;

const containsHangul = (text = '') => /[가-힣]/.test(text);

const ensureSentence = (text = '') => {
    if (!text) return '';
    return /[.!?]$/.test(text) ? text : `${text}.`;
};

const formatKeywords = (keywords = []) => {
    const cleaned = keywords.map((kw) => String(kw || '').trim()).filter(Boolean);
    if (!cleaned.length) return '';
    if (cleaned.length === 1) return cleaned[0];
    const isKorean = cleaned.some((kw) => containsHangul(kw));
    const connector = isKorean ? ' 그리고 ' : ' and ';
    const last = cleaned.pop();
    return `${cleaned.join(isKorean ? ', ' : ', ')}${connector}${last}`;
};

const buildSlotSentence = (slot = {}) => {
    if (slot.customSentence && slot.customSentence.trim().length) {
        return ensureSentence(slot.customSentence.trim());
    }
    if (slot.autoSentence === false) {
        return slot.keywords ? slot.keywords.join(', ') : '';
    }
    const phrase = formatKeywords(slot.keywords);
    if (!phrase) return '';
    const template =
        SLOT_TEMPLATE_RULES.find((rule) => rule.match.test(slot.label || '')) || SLOT_TEMPLATE_RULES[0];
    const isKorean = containsHangul(slot.label || '') || containsHangul(slot.keywords?.join(' ') || '');
    const rawSentence = isKorean ? template.ko(phrase) : template.en(phrase);
    return ensureSentence(rawSentence);
};

const insertSentence = (prompt = '', sentence = '') => {
    if (!sentence) return prompt;
    const markers = [
        'Dynamic Motion',
        'Camera Angle',
        'Expression',
        'Lighting',
        'Background',
        'photorealistic',
        '--ar'
    ];
    let insertionIndex = -1;
    for (const marker of markers) {
        const idx = prompt.indexOf(marker);
        if (idx !== -1) {
            insertionIndex = idx;
            break;
        }
    }
    if (insertionIndex === -1) {
        return prompt.endsWith('.')
            ? `${prompt} ${sentence}`
            : `${prompt}. ${sentence}`;
    }
    const before = prompt.slice(0, insertionIndex).trimEnd();
    const after = prompt.slice(insertionIndex);
    const separator = before.endsWith('.') ? ' ' : '. ';
    return `${before}${separator}${sentence} ${after}`.replace(/\s+/g, ' ');
};

export const previewSlotSentence = (slotInput = {}) => buildSlotSentence(cloneSlot(slotInput));

// --- Core Enhancement Logic ---

// Check if the prompt mentions Korean woman/women or character map says female
const hasFemaleCharacter = (prompt, characterIds, characterMap) => {
    if (isFemaleFromCharacters(characterIds, characterMap)) return true;
    if (!prompt) return false;
    const femaleHit = /(korean\s+)?woman|women|female|lady|girls?|her\b|she\b/i.test(prompt);
    const maleHit = /\bman\b|\bmen\b|male|gentleman|boyfriend|husband|golf pro\b/i.test(prompt);
    // Default bias: if not clearly male, treat as female to enforce curves
    if (femaleHit) return true;
    if (maleHit && !femaleHit) return false;
    return true;
};

// Enhancement function (Slim Glamour)
const enhancePromptInternal = (prompt, characterIds, characterMap, settings) => {
    if (!prompt) return "";
    let updated = injectCharacterDetails(prompt, characterIds, characterMap);

    // Skip if disabled or no female character
    if (!settings.useSlimGlamour) return updated;
    if (!hasFemaleCharacter(updated, characterIds, characterMap)) return updated;

    // Check if already enhanced (avoid double enhancement)
    if (updated.includes("Sculpted hourglass silhouette")) return updated;

    // Find insertion point (after character description, before camera/lighting)
    const insertionMarkers = [
        "Dynamic Motion:",
        "Camera Angle:",
        "Expression:",
        "Lighting:",
        "Background:",
        "photorealistic"
    ];

    let insertionIndex = -1;
    for (const marker of insertionMarkers) {
        const idx = updated.indexOf(marker);
        if (idx !== -1) {
            insertionIndex = idx;
            break;
        }
    }

    // If no marker found, append before quality tags
    if (insertionIndex === -1) {
        insertionIndex = updated.indexOf(", photorealistic");
        if (insertionIndex === -1) insertionIndex = updated.length;
    }

    // Insert enhancements
    const enhancement = settings.slimGlamourKeywords.join(", ");
    const before = updated.substring(0, insertionIndex).trim();
    const after = updated.substring(insertionIndex).trim();

    return `${before}, ${enhancement}, ${after}`;
};

const enforceUltraTightOutfits = (text = "") => {
    if (!text) return text;
    const replacements = [
        { regex: /mini dress(es)?/gi, singular: 'ultra-tight bodycon mini dress', plural: 'ultra-tight bodycon mini dresses' },
        { regex: /mini skirt(s)?/gi, singular: 'ultra-tight bodycon mini skirt', plural: 'ultra-tight bodycon mini skirts' },
        { regex: /micro dress(es)?/gi, singular: 'second-skin micro dress', plural: 'second-skin micro dresses' },
        { regex: /micro skirt(s)?/gi, singular: 'second-skin micro skirt', plural: 'second-skin micro skirts' },
        { regex: /short dress(es)?/gi, singular: 'ultra-tight short bodycon dress', plural: 'ultra-tight short bodycon dresses' },
        { regex: /short skirt(s)?/gi, singular: 'ultra-tight short skirt', plural: 'ultra-tight short skirts' },
        { regex: /santa outfit(s)?/gi, singular: 'second-skin Santa-inspired micro outfit', plural: 'second-skin Santa-inspired micro outfits' },
        { regex: /santa dress(es)?/gi, singular: 'second-skin Santa-inspired micro dress', plural: 'second-skin Santa-inspired micro dresses' },
        { regex: /santa costume(s)?/gi, singular: 'second-skin Santa-inspired micro costume', plural: 'second-skin Santa-inspired micro costumes' },
        { regex: /mini short(s)?/gi, singular: 'ultra-tight micro shorts', plural: 'ultra-tight micro shorts' },
        { regex: /shorts\b/gi, singular: 'second-skin shorts', plural: 'second-skin shorts' }
    ];

    let updated = text;
    replacements.forEach(({ regex, singular, plural }) => {
        updated = updated.replace(regex, (_, pluralGroup) => pluralGroup ? plural : singular);
    });
    return updated;
};

// [MAIN] Full Prompt Enhancement
export const applyFullEnhancement = (prompt, characterIds, characterMap) => {
    if (!prompt) return "";
    const settings = getSettings();
    let newPrompt = injectCharacterDetails(prompt, characterIds, characterMap);
    const hasFemale = hasFemaleCharacter(newPrompt, characterIds, characterMap);

    settings.slots.forEach((slot) => {
        if (!slot || slot.enabled === false) return;
        const hasKeywords = Array.isArray(slot.keywords) && slot.keywords.length > 0;
        const hasCustomSentence = slot.customSentence && slot.customSentence.trim().length > 0;
        if (!hasKeywords && !hasCustomSentence) return;
        if (FEMALE_SLOT_REGEX.test(slot.label || '') && !hasFemale) return;
        const sentence = buildSlotSentence(slot);
        if (sentence) {
            newPrompt = insertSentence(newPrompt, sentence);
        }
    });

    if (hasFemale) {
        newPrompt = enforceUltraTightOutfits(newPrompt);
        const hasMini = /mini|micro|short skirt|short dress|shorts/i.test(newPrompt);
        const hasLongDress = /long dress|floor-length|gown/i.test(newPrompt);
        if (!hasMini || hasLongDress) {
            newPrompt = newPrompt.replace(/dress/gi, 'mini dress');
            if (!/mini|micro|short/i.test(newPrompt)) {
                newPrompt = `${newPrompt}, ultra-short mini length, tight fit`;
            }
        }
    }

    if (settings.useQualityTags !== false) {
        if (!/8k\s+resolution/i.test(newPrompt)) {
            newPrompt = newPrompt.replace(/--ar\s+\d+:\d+/gi, '').trim() + (settings.qualityTags || QUALITY_TAG_FALLBACK);
        } else if (!/--ar\s+9:16/i.test(newPrompt)) {
            newPrompt = `${newPrompt} --ar 9:16`;
        }
    }

    return newPrompt;
};

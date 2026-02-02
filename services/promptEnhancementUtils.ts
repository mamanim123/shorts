export interface PromptEnhancementSlot {
  id: string;
  label: string;
  keywords: string[];
  autoSentence: boolean;
  customSentence?: string;
  enabled: boolean;
}

export interface PromptEnhancementSettings {
  autoEnhanceOnGeneration: boolean;
  slots?: PromptEnhancementSlot[];
  useQualityTags?: boolean;
  qualityTags?: string;
  useGenderGuard?: boolean;
  /**
   * Legacy fields kept for backwards compatibility.
   */

  koreanKeywords?: string[];
  slimGlamourKeywords?: string[];
  useKoreanForce?: boolean;
  useSlimGlamour?: boolean;
}

export interface NormalizedPromptEnhancementSettings extends PromptEnhancementSettings {
  slots: PromptEnhancementSlot[];
  useQualityTags: boolean;
  qualityTags: string;
}

export const fetchPromptEnhancementSettings = async (): Promise<PromptEnhancementSettings | null> => {
  try {
    const res = await fetch('http://localhost:3002/api/prompt-enhancement-settings');
    if (res.ok) {
      const data = await res.json();
      if (data && data.profiles && data.activeProfileId) {
        const activeProfile = data.profiles.find((p: any) => p.id === data.activeProfileId);
        return activeProfile ? activeProfile.settings : data.profiles[0].settings;
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch prompt enhancement settings:', error);
    return null;
  }
};

const QUALITY_TAG_FALLBACK =

  ', photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field --ar 9:16';

const DEFAULT_SLOT_PRESETS: Array<Partial<PromptEnhancementSlot>> = [
  {
    id: 'slot-nationality',
    label: '국적/민족성',
    keywords: ['South Korean style', 'Cheongdam-dong high society aura'],
    autoSentence: true,
    enabled: true,
  },
  {
    id: 'slot-figure',
    label: '체형/실루엣',
    keywords: [
      'Elegant hourglass silhouette with graceful curves',
      'Well-proportioned feminine figure',
      'Sophisticated body lines with radiant glow',
      'Fit and toned physique with glamorous volume',
      'Ageless beauty and confident presence',
    ],
    autoSentence: true,
    enabled: true,
  },
  {
    id: 'slot-outfit',
    label: '의상 스타일',
    keywords: [
      'Tight-fitting premium tailored design',
      'Bodycon silhouette with elegant refinement',
      'Form-fitting high-fashion fabrics',
      'Body-conscious couture attire',
    ],
    autoSentence: true,
    enabled: true,
  },
];

export const DEFAULT_PROMPT_ENHANCEMENT_SETTINGS: NormalizedPromptEnhancementSettings = {
  autoEnhanceOnGeneration: false,
  slots: DEFAULT_SLOT_PRESETS.map(createSlotFromPreset),
  useQualityTags: true,
  qualityTags: QUALITY_TAG_FALLBACK,
  useGenderGuard: true,
};


function createSlotFromPreset(preset: Partial<PromptEnhancementSlot>): PromptEnhancementSlot {
  return {
    id: preset.id ?? generateSlotId(),
    label: preset.label ?? '커스텀 슬롯',
    keywords: preset.keywords ? [...preset.keywords] : [],
    autoSentence: preset.autoSentence !== undefined ? preset.autoSentence : true,
    customSentence: preset.customSentence ?? '',
    enabled: preset.enabled !== undefined ? preset.enabled : true,
  };
}

export function generateSlotId() {
  return `slot-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureSlotShape(slot?: Partial<PromptEnhancementSlot>): PromptEnhancementSlot {
  if (!slot) return createSlotFromPreset({});
  return {
    id: slot.id ?? generateSlotId(),
    label: slot.label ?? '커스텀 슬롯',
    keywords: Array.isArray(slot.keywords)
      ? slot.keywords.map((kw) => kw.trim()).filter(Boolean)
      : [],
    autoSentence: slot.autoSentence !== undefined ? slot.autoSentence : true,
    customSentence: slot.customSentence ?? '',
    enabled: slot.enabled !== undefined ? slot.enabled : true,
  };
}

export function createPromptEnhancementSlot(
  overrides?: Partial<PromptEnhancementSlot>
): PromptEnhancementSlot {
  return ensureSlotShape(overrides);
}

function convertLegacySlots(
  settings?: Partial<PromptEnhancementSettings>
): PromptEnhancementSlot[] {
  const slots: PromptEnhancementSlot[] = [];
  if (settings?.koreanKeywords?.length) {
    slots.push(
      ensureSlotShape({
        id: 'slot-nationality',
        label: '국적/민족성',
        keywords: settings.koreanKeywords,
        autoSentence: true,
        enabled: settings.useKoreanForce !== false,
      })
    );
  }
  if (settings?.slimGlamourKeywords?.length) {
    slots.push(
      ensureSlotShape({
        id: 'slot-figure',
        label: '체형/실루엣',
        keywords: settings.slimGlamourKeywords,
        autoSentence: true,
        enabled: settings.useSlimGlamour !== false,
      })
    );
  }
  return slots;
}

export function normalizePromptEnhancementSettings(
  raw?: Partial<PromptEnhancementSettings>
): NormalizedPromptEnhancementSettings {
  const slotsFromFile =
    Array.isArray(raw?.slots) && raw?.slots.length
      ? raw!.slots.map(ensureSlotShape)
      : convertLegacySlots(raw);

  const slots =
    slotsFromFile.length > 0
      ? slotsFromFile
      : DEFAULT_PROMPT_ENHANCEMENT_SETTINGS.slots.map((slot) => ({
        ...slot,
        id: generateSlotId(),
      }));

  return {
    ...raw,
    autoEnhanceOnGeneration:
      raw?.autoEnhanceOnGeneration !== undefined
        ? raw.autoEnhanceOnGeneration
        : DEFAULT_PROMPT_ENHANCEMENT_SETTINGS.autoEnhanceOnGeneration,
    slots,
    useQualityTags:
      raw?.useQualityTags !== undefined
        ? raw.useQualityTags
        : DEFAULT_PROMPT_ENHANCEMENT_SETTINGS.useQualityTags,
    qualityTags:
      typeof raw?.qualityTags === 'string' && raw.qualityTags.trim().length
        ? raw.qualityTags
        : DEFAULT_PROMPT_ENHANCEMENT_SETTINGS.qualityTags,
    useGenderGuard:
      raw?.useGenderGuard !== undefined
        ? raw.useGenderGuard
        : DEFAULT_PROMPT_ENHANCEMENT_SETTINGS.useGenderGuard,
  };
}


export function clonePromptEnhancementSettings(
  raw?: Partial<PromptEnhancementSettings>
): NormalizedPromptEnhancementSettings {
  const normalized = normalizePromptEnhancementSettings(raw);
  return {
    ...normalized,
    slots: normalized.slots.map((slot) => ({
      ...slot,
      id: generateSlotId(),
    })),
  };
}

const SLOT_TEMPLATE_RULES: Array<{
  match: RegExp;
  en: (phrase: string) => string;
  ko: (phrase: string) => string;
}> = [
    {
      match: /(국적|민족|korean|nation|ethnic)/i,
      en: (phrase) => `She embodies ${phrase}.`,
      ko: (phrase) => `그녀는 ${phrase} 품격을 보여준다.`,
    },
    {
      match: /(체형|몸매|body|figure|silhouette|curve|곡선)/i,
      en: (phrase) => `Her silhouette highlights ${phrase}.`,
      ko: (phrase) => `그녀의 실루엣은 ${phrase}를 강조한다.`,
    },
    {
      match: /(의상|outfit|복장|스타일|look)/i,
      en: (phrase) => `Her outfit features ${phrase}.`,
      ko: (phrase) => `의상은 ${phrase} 디테일을 담고 있다.`,
    },
    {
      match: /(머리|헤어|hair|헤어스타일)/i,
      en: (phrase) => `Her hair is styled with ${phrase}.`,
      ko: (phrase) => `헤어스타일은 ${phrase} 느낌으로 완성된다.`,
    },
  ];

const FEMALE_SLOT_REGEX = /(체형|몸매|silhouette|figure|곡선|curve|woman|여성)/i;

export interface ApplySlotOptions {
  hasFemaleCharacter?: boolean;
}

export function applyPromptEnhancementSlots(
  inputPrompt: string,
  settings?: Partial<PromptEnhancementSettings>,
  options?: ApplySlotOptions
): string {
  if (!inputPrompt) return inputPrompt;
  const normalized = normalizePromptEnhancementSettings(settings);
  let prompt = inputPrompt.trim();
  const hasFemale = options?.hasFemaleCharacter ?? true;

  for (const slot of normalized.slots) {
    if (!slot.enabled) continue;
    if (!slot.keywords.length && !slot.customSentence?.trim()) continue;
    if (FEMALE_SLOT_REGEX.test(slot.label || '') && !hasFemale) continue;

    // [NEW] Male Character Protection: If the prompt explicitly mentions a male, skip female-specific slots
    // This prevents "Her silhouette..." from being appended to a male character description
    const isMaleScene = /\b(Man|Male|Boy|Guy|Husband|He|His|Him|남성|남자|남편)\b/i.test(prompt);
    const isMultiCharacterScene = /Two-shot|Three-shot/i.test(prompt);

    // Skip female-specific enhancement in male-only scenes OR multi-character scenes
    if (FEMALE_SLOT_REGEX.test(slot.label || '')) {
      if (isMaleScene && !prompt.match(/\b(woman|girl|female|여성|여자)\b/i)) {
        // Male-only scene: skip female slots
        continue;
      }
      if (isMultiCharacterScene) {
        // Multi-character scene: skip generic female slots to avoid AI focusing only on female
        continue;
      }
    }

    const sentence = buildSlotSentence(slot);
    prompt = injectSentence(prompt, sentence);
  }

  if (normalized.useQualityTags !== false) {
    const tagString = normalized.qualityTags?.trim() || QUALITY_TAG_FALLBACK;
    if (tagString && !prompt.includes('photorealistic')) {
      prompt = `${prompt.replace(/--ar\s+\d+:\d+/g, '').trim()}${tagString}`;
    } else if (!prompt.includes('--ar 9:16')) {
      prompt = `${prompt} --ar 9:16`;
    }
  }

  return prompt;
}

export function buildSlotSentence(slot: PromptEnhancementSlot): string {
  if (!slot) return '';
  if (slot.customSentence && slot.customSentence.trim().length > 0) {
    return ensureSentence(slot.customSentence.trim());
  }
  if (!slot.autoSentence) {
    return slot.keywords.join(', ');
  }
  const phrase = formatKeywords(slot.keywords);
  if (!phrase) return '';
  const isKorean = /[가-힣]/.test(slot.keywords.join(' '));
  const template =
    SLOT_TEMPLATE_RULES.find((rule) => rule.match.test(slot.label || '')) ??
    SLOT_TEMPLATE_RULES[0];
  const rawSentence = isKorean ? template.ko(phrase) : template.en(phrase);
  return ensureSentence(rawSentence);
}

function formatKeywords(keywords: string[]): string {
  if (!Array.isArray(keywords) || keywords.length === 0) return '';
  const cleaned = keywords.map((kw) => kw.trim()).filter(Boolean);
  if (!cleaned.length) return '';
  if (cleaned.length === 1) return cleaned[0];
  const isKorean = cleaned.some((kw) => /[가-힣]/.test(kw));
  const connector = isKorean ? ' 그리고 ' : ' and ';
  const last = cleaned.pop();
  return `${cleaned.join(isKorean ? ', ' : ', ')}${connector}${last}`;
}

function ensureSentence(sentence: string) {
  if (!sentence) return '';
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

const INSERTION_MARKERS = [
  'Dynamic Motion',
  'Camera Angle',
  'Expression',
  'Lighting',
  'Background',
  'photorealistic',
  '--ar',
];

function injectSentence(prompt: string, sentence: string) {
  if (!sentence) return prompt;
  const trimmedSentence = sentence.trim();
  if (!trimmedSentence) return prompt;
  let targetIndex = -1;
  for (const marker of INSERTION_MARKERS) {
    const idx = prompt.indexOf(marker);
    if (idx !== -1) {
      targetIndex = idx;
      break;
    }
  }
  if (targetIndex === -1) {
    return prompt.endsWith('.')
      ? `${prompt} ${trimmedSentence}`
      : `${prompt}. ${trimmedSentence}`;
  }
  const before = prompt.slice(0, targetIndex).trimEnd();
  const after = prompt.slice(targetIndex);
  const separator = before.endsWith('.') ? ' ' : '. ';
  return `${before}${separator}${trimmedSentence} ${after}`.replace(/\s+/g, ' ');
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Copy, RefreshCw, TrendingUp, Target, ArrowLeft, ChevronDown, ChevronUp, Image as ImageIcon, Loader2, X, History as HistoryIcon, Maximize, Trash2, Settings2, Sparkles as SparklesIcon, Star, Plus, Eye, Save, Layout, Zap, Lock } from 'lucide-react';
import { ShortsIdentityCard, CharacterIdentity } from './components/ShortsIdentityCard';
import { genreManager } from './services/genreGuidelines';
import { previewPrompt } from './services/geminiService';
import { showToast } from './components/Toast';
import { saveStoryFile } from './services/storyService';
import { getAppStorageValue, setAppStorageValue } from './services/appStorageService';
import { useTemplateManager } from './hooks/useTemplateManager';
import { TemplateEditorModal } from './components/TemplateEditorModal';
import { HarmCategory, HarmBlockThreshold } from '@google/genai';
import { jsonrepair } from 'jsonrepair';
import { parseJsonFromText } from './services/jsonParse';
import { StoryResponse, AnalysisResult, ModeTemplates } from './types';
import { generateImageWithImagen, initGeminiService, fetchAvailableModels } from './components/master-studio/services/geminiService';
import { setBlob, getBlob, deleteBlob } from './components/master-studio/services/dbService';
import { fetchDiskImageList } from './components/master-studio/services/diskImageList';
import { saveImageToDisk } from './components/master-studio/services/serverService';
import Lightbox from './components/master-studio/Lightbox';
import {
  applyPromptEnhancementSlots,
  DEFAULT_PROMPT_ENHANCEMENT_SETTINGS,
  NormalizedPromptEnhancementSettings,
  normalizePromptEnhancementSettings,
} from './services/promptEnhancementUtils';
import { buildFinalPrompt } from './services/promptBuilder';
import { getGenreOptions } from './services/genreGuidelines';
import {
  FEMALE_OUTFIT_PRESETS,
  MALE_OUTFIT_PRESETS
} from './constants';
import { pickFemaleOutfit, pickMaleOutfit } from './services/labPromptBuilder';
import ShortsImageHistorySidebar from './components/ShortsImageHistorySidebar';
import ModeTemplateSettingsModal from './components/ModeTemplateSettingsModal';

const MODE_TEMPLATE_STORAGE_KEY = 'shorts-generator-mode-templates-v6';

const DEFAULT_MODE_TEMPLATES: ModeTemplates = {
  scriptOnly: `[🎲 요청 ID: {{CREATIVITY_BOOSTER}} - 매번 완전히 새로운 창의적인 대본을 작성하세요. 이전 응답과 동일하거나 유사한 내용은 절대 금지입니다.]

선택된 엔진 지침을 그대로 따르되, "대본만 생성" 모드에서는 대본 JSON만 출력합니다. 엔진의 장르·톤·반전 규칙을 우선 적용하고, 아래 공통 구조를 덧붙여 주세요.

**🚨 중요: 이 모드에서는 scenes 배열을 절대 포함하지 마세요. 이미지 프롬프트는 생성하지 않습니다.**

==========================================================
■ 바이럴 대본 성공 공식 (🚨 CRITICAL)
==========================================================

1. **IMMEDIATE HOOK (첫 문장)**
   - 배경 설명 없이 즉시 핵심 사건/충격/질문으로 시작하세요.
   - ✅ "남편 친구가 내 방 문을 열고 들어왔어."
   - ✅ "시어머니가 내 카드로 500만 원을 긁었지 뭐야."
   - ❌ "오늘 날씨가 좋아서 친구랑 만났어." (이탈 유발)

2. **DIALOGUE RATIO (7:3 법칙)**
   - **나레이션 30% : 대사 70%** 비율을 유지하세요.
   - 캐릭터들이 직접 대화하며 상황을 전개하는 것이 몰입감이 훨씬 높습니다.

3. **TRIPLE TWIST (3단 반전)**
   - **오해(Mislead)**: 야하거나 수상한 상황인 것처럼 묘사
   - **강화(Reinforce)**: "정말 그거네!" 싶을 정도로 오해를 깊게 만듦
   - **폭발(Reveal)**: 알고 보니 완전히 다른, 반전 있는 진실 공개

4. **ACTION OVER EMOTION (행동 묘사)**
   - 감정 단어(슬프다, 놀랍다) 대신 행동(입술을 깨물다, 숨을 멈추다)으로 표현하세요.

==========================================================
■ 문체 및 표현 규칙
==========================================================

✅ 구어체 반말: "~했어 / ~했지 / ~더라고 / ~잖아"
✅ 짧은 호흡: 한 문장 20자 내외 권장
✅ 현장감: 의성어/의태어 적극 활용 (덜컥, 움찔, 꼴깍)

==========================================================
■ 출력 형식
==========================================================

{
  "scripts": [
    {
      "version": 1,
      "title": "클릭을 부르는 자극적인 제목 (15자 이내)",
      "titleOptions": ["제목 1", "제목 2", "제목 3"],
      "hook": "첫 문장 그대로 복사",
      "twist": "반전이 밝혀지는 핵심 대사/문장",
      "length": 0,
      "script": "대본 전체 내용 (대화 위주, \\n으로 구분, 8~15문장)"
    }
  ]
}

{{SPECIFIC_INSTRUCTIONS}}
{{STYLE_GUIDE}}`,
  scriptImage: `You are "Shorts Master", an expert AI for creating viral YouTube Shorts scripts AND high-end cinematic image prompts for Korean viewers.

==========================================================
■ PART 1: 바이럴 대본 생성 규칙 (Script Rules)
==========================================================

[톤 & 매너]
- 친한 동생한테 썰 푸는 맛깔나는 구어체 (~했어, ~거든, ~더라고, ~잖아)
- **나레이션 30% : 대사 70%** 비율 준수 (대화 중심으로 전개)
- 배경 설명 생략, 첫 문장부터 즉시 사건 중심으로 돌진 (3초 법칙)

[스토리 구조: 3단 반전(Triple Twist)]
1. **오해(Mislead)**: 야하거나 수상쩍은 상황으로 오해 유도
2. **심화(Reinforce)**: 오해를 확신으로 바꾸는 구체적 대사와 행동
3. **반전(Reveal)**: 예상치 못한 황당하거나 코믹한 진실로 마무리

[길이 & 리듬]
- 총 8-15문장 (45-55초 분량)
- 짧은 문장 위주로 빠른 템포 유지

==========================================================
■ 호칭 가이드 (연령별 캐릭터 이름)
==========================================================

[여성 호칭]
- 20-30대: 수아, 민지, 유진, 서연 + "씨"
- 40-60대: 김여사, 이여사, 박여사, 최여사
- 캐디 : 캐디
[남성 호칭]
- 김프로, 박사장, 최과장, 민철 씨, 준혁 씨

==========================================================
■ PART 2: 이미지 생성 규칙 (Image Generation Rules)
==========================================================

[캐릭터 슬롯 시스템 - 일관성 필수]
- Slot Woman A: Long soft-wave hairstyle, voluptuous hourglass figure
- Slot Woman B: Short chic bob cut, petite and alluring aura
- Slot Woman C: Low ponytail, athletic and calm demeanor
- Slot Man A: Short neat hairstyle, fit athletic build
- Slot Man B: Clean short cut, well-built dandy physique

[의상 로직]
- 모든 장면(1~8)에서 캐릭터별 의상은 **단어 하나 틀리지 않고 동일하게** 유지하세요.
- 여성 캐릭터는 "stunning Korean woman, slim hourglass figure, full bust slim waist" 묘사를 매 씬 포함하여 세련된 볼륨감을 강조하세요.

==========================================================
■ 출력 형식 (JSON)
==========================================================

{
  "title": "자극적이고 궁금증을 유발하는 제목 (15자 이내)",
  "titleOptions": ["제목 1", "제목 2", "제목 3"],
  "scriptBody": "대본 전체 내용 (\\n으로 구분)",
  "punchline": "핵심 반전 대사",
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptLine": "해당 장면의 대사 또는 나레이션",
      "shortPrompt": "unfiltered raw photo, A stunning Korean woman in her {{TARGET_LABEL}}, [Slot ID], [상세 의상], [동작/표정], 8k --ar 9:16",
      "longPrompt": "unfiltered raw photograph, highly detailed skin texture, A stunning Korean woman in her {{TARGET_LABEL}}, [Slot ID], [헤어], [체형], [상세 의상], [배경], [동작], [표정], shot on 85mm, f/1.8, 8k --ar 9:16"
    }
  ]
}

**🚨 주의: 정확히 8개의 scenes를 생성하세요. 8개 미만 절대 금지.**`,
  scriptOnlyBackups: [],
  scriptImageBackups: []
};
const MODE_TEMPLATE_BACKUP_LIMIT = 3;

const sanitizeBackups = (backups?: string[]): string[] => {
  if (!Array.isArray(backups)) return [];
  return backups
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .slice(0, MODE_TEMPLATE_BACKUP_LIMIT);
};

const normalizeModeTemplates = (input: ModeTemplates): ModeTemplates => ({
  scriptOnly: input.scriptOnly || DEFAULT_MODE_TEMPLATES.scriptOnly,
  scriptImage: input.scriptImage || DEFAULT_MODE_TEMPLATES.scriptImage,
  scriptOnlyBackups: sanitizeBackups(input.scriptOnlyBackups),
  scriptImageBackups: sanitizeBackups(input.scriptImageBackups)
});

const getDefaultModeTemplates = (): ModeTemplates => normalizeModeTemplates(DEFAULT_MODE_TEMPLATES);

const fillTemplate = (template: string, variables: Record<string, string>) => {
  if (!template) return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = variables[key];
    return typeof value === 'string' ? value : '';
  });
};

const pickRandom = <T,>(array: T[]): T => array[Math.floor(Math.random() * array.length)];

const SHORTFORM_OUTFIT_LIST = [
  // [Style 1: Royal Signature]
  { name: "White Sleeveless Turtleneck + Navy Leather Mini Skirt", translation: "화이트 슬리브리스 터틀넥 + 네이비 가죽 미니스커트", categories: ["ROYAL"] },
  { name: "White Halter-neck Tight Crop Top + Tight Blue Jeans", translation: "화이트 홀터넥 타이트 크롭탑 + 타이트 블루 진", categories: ["ROYAL"] },
  { name: "White See-through Blouse + Royal Blue Tight Micro Skirt", translation: "화이트 시스루 블라우스 + 로열 블루 타이트 마이크로 스커트", categories: ["ROYAL"] },
  { name: "White Off-shoulder Tube Top + Navy Mini Skirt", translation: "화이트 오프숄더 튜브탑 + 네이비 미니스커트", categories: ["ROYAL"] },
  { name: "Navy Blue Textured Tweed Deep V-neck Tight Mini Dress", translation: "네이비 블루 텍스처 트위드 딥 V넥 타이트 미니 드레스", categories: ["ROYAL"] },
  { name: "White Silk Deep V-neck Blouse + Royal Blue Tight Micro Mini Skirt", translation: "화이트 실크 딥 V넥 블라우스 + 로열 블루 타이트 마이크로 미니스커트", categories: ["ROYAL"] },
  { name: "Navy Off-shoulder Tight Knit + White Micro Mini Skirt", translation: "네이비 오프숄더 타이트 니트 + 화이트 마이크로 미니스커트", categories: ["ROYAL"] },
  { name: "White Lace Crop Top + Deep Blue Satin Micro Mini Skirt", translation: "화이트 레이스 크롭탑 + 딥 블루 새틴 마이크로 미니 스커트", categories: ["ROYAL"] },
  { name: "Royal Blue Sleeveless Turtleneck + White Micro Mini Skirt", translation: "로열 블루 슬리브리스 터틀넥 + 화이트 마이크로 미니스커트", categories: ["ROYAL"] },
  { name: "White Chiffon Shirt (Unbuttoned) + Navy Lace Micro Mini Skirt", translation: "화이트 시폰 셔츠(언버튼) + 네이비 레이스 마이크로 미니스커트", categories: ["ROYAL"] },

  // [Style 5: Golf Field Luxury]
  { name: "White Halter-neck Knit + Red Micro Mini Skirt", translation: "화이트 홀터넥 니트 + 레드 마이크로 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "V-neck Tight Polo Shirt + Micro Mini Skirt", translation: "V넥 타이트 폴로셔츠 + 마이크로 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "Pink Sleeveless Polo + White Tight Wrap Mini Skirt", translation: "핑크 슬리브리스 폴로 + 화이트 타이트 랩 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "White Tube Top + White Tennis Skirt", translation: "화이트 튜브탑 + 화이트 테니스 스커트", categories: ["GOLF LUXURY"] },
  { name: "Tight Golf Mini One-piece (Belted)", translation: "타이트 골프 미니 원피스 (벨트 장식)", categories: ["GOLF LUXURY"] },
  { name: "Navy Sleeveless Polo + White Micro Skirt with Navy Trim", translation: "네이비 슬리브리스 폴로 + 화이트 마이크로 스커트(네이비 트림)", categories: ["GOLF LUXURY"] },
  { name: "White Zip-up Vest + Navy Turtleneck + White Micro Skirt", translation: "화이트 지퍼 베스트 + 네이비 터틀넥 + 화이트 마이크로 스커트", categories: ["GOLF LUXURY"] },
  { name: "Red Cap-sleeve Tight Tee + White Micro Skirt", translation: "레드 캡소매 타이트 티 + 화이트 마이크로 스커트", categories: ["GOLF LUXURY"] },
  { name: "Black Sleeveless High-neck Top + Beige Micro Pleated Skirt", translation: "블랙 슬리브리스 하이넥 탑 + 베이지 마이크로 플리츠 스커트", categories: ["GOLF LUXURY"] },
  { name: "Pink & White Striped Knit + White Micro Short Pants", translation: "핑크&화이트 스트라이프 니트 + 화이트 마이크로 쇼츠", categories: ["GOLF LUXURY"] },
  { name: "Black Sleeveless Turtleneck + White Micro Pleated Skirt (Monochrome Chic)", translation: "블랙 슬리브리스 터틀넥 + 화이트 마이크로 플리츠 스커트", categories: ["GOLF LUXURY"] },
  { name: "Beige Halter-neck Knit + Navy Tight Mini Skirt (Elegant)", translation: "베이지 홀터넥 니트 + 네이비 타이트 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "Dark Green Sleeveless Polo + White Micro Shorts (Sophisticated Sporty)", translation: "다크 그린 슬리브리스 폴로 + 화이트 마이크로 쇼츠", categories: ["GOLF LUXURY"] },
  { name: "Navy Zip-up Sleeveless Vest + White Tight Micro Skirt (Professional)", translation: "네이비 지퍼 슬리브리스 베스트 + 화이트 타이트 마이크로 스커트", categories: ["GOLF LUXURY"] },
  { name: "White Mock-neck Sleeveless + Burgundy Micro Mini Skirt (Color Point)", translation: "화이트 목넥 슬리브리스 + 버건디 마이크로 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "Pink Tight Polo Shirt + White Micro Mini Skirt (Lovely Sporty)", translation: "핑크 타이트 폴로 셔츠 + 화이트 마이크로 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "Black Cross-strap Halter Top + White Micro Mini Skirt (Black & White Sexy)", translation: "블랙 크로스 스트랩 홀터탑 + 화이트 마이크로 미니스커트", categories: ["GOLF LUXURY"] },
  { name: "Grey Ribbed Knit Tight Mini Dress (Modern Chic)", translation: "그레이 골지 니트 타이트 미니 드레스", categories: ["GOLF LUXURY"] },
  { name: "White See-through Shirt + White High-waist Hot Pants (Pure Luxury)", translation: "화이트 시스루 셔츠 + 화이트 하이웨이스트 핫팬츠", categories: ["GOLF LUXURY"] },
  { name: "Charcoal Sleeveless Mock-neck + Black Micro Pleated Skirt (Dark Luxury)", translation: "차콜 슬리브리스 목넥 + 블랙 마이크로 플리츠 스커트", categories: ["GOLF LUXURY"] },
  { name: "Grey Halter-neck Tight Mini Dress (Sleek)", translation: "그레이 홀터넥 타이트 미니 드레스", categories: ["GOLF LUXURY"] },
  { name: "Peach Silk Camisole + White High-waist Micro Skirt (Soft Luxury)", translation: "피치 실크 캐미솔 + 화이트 하이웨이스트 마이크로 스커트", categories: ["GOLF LUXURY"] },
  { name: "White Long-sleeve V-neck Tight Mini Dress (Clean Sexy)", translation: "화이트 롱슬리브 V넥 타이트 미니 드레스", categories: ["GOLF LUXURY"] },
  { name: "Grey Checkered Jacket Mini Dress (Classy Field)", translation: "그레이 체크 자켓 미니 드레스", categories: ["GOLF LUXURY"] },
  { name: "Beige & White Argyle Check V-neck Set (Glitz & Glam)", translation: "베이지&화이트 아가일 체크 V넥 세트", categories: ["GOLF LUXURY"] },

  // [Style 8: Sexy Collection]
  { name: "Black Lace Corset Top + Black Satin Micro Mini Skirt", translation: "블랙 레이스 코르셋 탑 + 블랙 새틴 마이크로 미니스커트", categories: ["SEXY"] },
  { name: "Red See-through Lingerie Style Mini Dress", translation: "레드 시스루 란제리 스타일 미니 드레스", categories: ["SEXY"] },
  { name: "White Silk Slip Mini Dress (Short)", translation: "화이트 실크 슬립 미니 드레스 (숏)", categories: ["SEXY"] },
  { name: "Black Leather Harness Detail Bodycon Dress", translation: "블랙 레더 하네스 디테일 바디콘 드레스", categories: ["SEXY"] },
  { name: "Nude Tone Mesh Bodysuit + Tight Leather Skirt", translation: "누드톤 메쉬 보디수트 + 타이트 가죽 스커트", categories: ["SEXY"] },
  { name: "Burgundy Velvet Corset Mini Dress", translation: "버건디 벨벳 코르셋 미니 드레스", categories: ["SEXY"] },
  { name: "Black Sheer Blouse (Black Bra Visible) + Tight Micro Skirt", translation: "블랙 시어 블라우스 (블랙 브라 노출) + 타이트 마이크로 스커트", categories: ["SEXY"] },
  { name: "Silver Metallic Mini Dress with Crystal details", translation: "실버 메탈릭 미니 드레스 (크리스털 디테일)", categories: ["SEXY"] },
  { name: "Pink Satin Bustier Top + White Hot Pants", translation: "핑크 새틴 뷔스티에 탑 + 화이트 핫팬츠", categories: ["SEXY"] },
  { name: "Leopard Print V-neck Tight Mini Dress", translation: "레오파드 프린트 V넥 타이트 미니 드레스", categories: ["SEXY"] }
];

const enforceKoreanIdentity = (text: string, targetAgeLabel?: string, sceneNumber?: number) => {
  let updated = text;
  const replacements: Array<[RegExp, string]> = [
    [/\b(Vietnamese|Vietnam|Thai|Thailand|Japanese|Japan|Chinese|China|American|Europe(?:an)?|Western)\b/gi, 'Korean'],
    [/(베트남|베트남인|태국|일본|중국|미국|서양|서구)/g, '한국인']
  ];
  replacements.forEach(([regex, value]) => {
    updated = updated.replace(regex, value);
  });

  const formatEnglishAgeLabel = (label?: string) => {
    if (!label) return '';
    const match = label.match(/\d+/);
    return match ? `${match[0]}s` : '';
  };

  const englishAge = formatEnglishAgeLabel(targetAgeLabel);
  const ageString = englishAge ? `in her ${englishAge}` : '';
  const identityDescriptor = `A stunning Korean woman ${ageString}`;

  // [ABSOLUTE FORMULA] 씬 번호와 정체성을 맨 앞으로 강제 배치
  const scenePrefix = sceneNumber ? `Scene ${sceneNumber}, ` : '';
  const mandatoryPrefix = `${scenePrefix}${identityDescriptor}, `;

  // 기존 텍스트에서 중복될 수 있는 패턴들을 과감하게 제거
  const cleanText = updated
    .replace(/^Scene \d+[\.,]\s*/i, '')
    .replace(/^A stunning Korean woman in her [\d\w\s]+[\.,]\s*/i, '')
    .replace(/^A stunning Korean woman[\.,]\s*/i, '')
    .replace(/^in her [\d\w\s]+[\.,]\s*/i, '')
    .trim();

  // [FIX] LLM이 카메라 앵글을 먼저 적을 경우, 정체성을 강제로 앞에 배치
  const cameraAnglePattern = /^(Candid|Two-shot|Three-shot|Dutch|Extreme|Close-up|Wide|Medium|Over-the-shoulder|Zoom|Pan|Tracking|Bird|Aerial|Low|High|Point of view|POV)/i;

  if (cameraAnglePattern.test(cleanText)) {
    // 카메라 앵글로 시작하면, 정체성을 맨 앞에 배치
    return `${scenePrefix}${identityDescriptor}, ${cleanText}`;
  }

  return `${mandatoryPrefix}${cleanText}`;
};

const SLOT_VISUAL_PRESETS: Record<string, string> = {
  'Woman A': 'Long soft-wave hairstyle, voluptuous hourglass figure',
  'Woman B': 'Short chic bob cut, petite and alluring aura',
  'Woman C': 'Low ponytail, athletic and calm demeanor',
  'Woman D': 'Neat ponytail, slim and professional demeanor',
  'Man A': 'Short neat hairstyle, fit athletic build',
  'Man B': 'Clean short cut, well-built dandy physique'
};

const normalizeSlotId = (value?: string): string => {
  if (!value) return '';
  const trimmed = value.trim();
  const cleaned = trimmed.replace(/^Slot\s+/i, '').replace(/[_-]+/g, ' ');
  const match = cleaned.match(/(Woman|Man)\s*([ABC])/i);
  if (!match) return cleaned;
  return `${match[1].charAt(0).toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2].toUpperCase()}`;
};

const formatIdentityAge = (label: string, gender: 'female' | 'male') => {
  if (!label) return '';
  if (label.includes('대')) {
    const digits = label.match(/\d+/);
    if (!digits) return '';
    return `in ${gender === 'female' ? 'her' : 'his'} ${digits[0]}s`;
  }
  const digits = label.match(/\d+/);
  if (!digits) return '';
  return `in ${gender === 'female' ? 'her' : 'his'} ${digits[0]}s`;
};

const getSceneCharacterSlots = (
  scene: any,
  characterMap?: Record<string, any>
): string[] => {
  const slots = new Set<string>();
  if (typeof scene?.characterSlot === 'string') {
    scene.characterSlot.split(/[,\|]/).forEach((raw: string) => {
      const normalized = normalizeSlotId(raw);
      if (normalized) slots.add(normalized);
    });
  }
  if (Array.isArray(scene?.characterIds) && characterMap) {
    scene.characterIds.forEach((id: string) => {
      const ch = characterMap[id];
      const rawSlot = ch?.slot || ch?.slotId || ch?.characterSlot || '';
      const normalized = normalizeSlotId(rawSlot);
      if (normalized) slots.add(normalized);
    });
  }
  return Array.from(slots);
};

const buildIdentityLockDescriptor = (
  identities: CharacterIdentity[] = [],
  sceneSlots: string[] = []
) => {
  const activeIdentities = identities.filter((identity) => (
    identity.isLocked || identity.lockedFields?.size > 0
  ));
  if (activeIdentities.length === 0) return '';

  const normalizedSceneSlots = new Set(sceneSlots.map((slot) => normalizeSlotId(slot)));
  const scopedIdentities = normalizedSceneSlots.size > 0
    ? activeIdentities.filter((identity) => normalizedSceneSlots.has(normalizeSlotId(identity.slotId)))
    : activeIdentities;

  if (scopedIdentities.length === 0) return '';

  const lines = scopedIdentities.map((identity) => {
    const normalizedSlot = normalizeSlotId(identity.slotId);
    const gender: 'female' | 'male' = normalizedSlot.startsWith('Man') ? 'male' : 'female';
    const slotPrompt = SLOT_VISUAL_PRESETS[normalizedSlot] || '';
    const nameLabel = identity.name ? ` (${identity.name})` : '';
    const ageText = identity.isLocked ? formatIdentityAge(identity.age, gender) : '';
    const useOutfit = identity.isLocked || identity.lockedFields?.has('outfit');
    const useAccessories = identity.isLocked || identity.lockedFields?.has('accessories');
    const outfitText = useOutfit && identity.outfit ? `wearing ${identity.outfit}` : '';
    const accessoryText = useAccessories && identity.accessories ? `accessorized with ${identity.accessories}` : '';
    const descriptors = [slotPrompt, ageText, outfitText, accessoryText].filter(Boolean).join(', ');
    const slotLabel = normalizedSlot ? `Slot ${normalizedSlot}` : 'Slot';
    return `${slotLabel}${nameLabel}: ${descriptors || 'locked identity'}`;
  });

  return `Identity Lock: ${lines.join(' | ')}`;
};

const injectIdentityLock = (text: string, descriptor: string) => {
  if (!descriptor) return text;
  if (text.includes(descriptor) || text.includes('Identity Lock:')) return text;
  const prefixPattern = /^(Scene \d+,\s*)?(A stunning Korean woman[^,]*,\s*)/i;
  const match = text.match(prefixPattern);
  if (match) {
    const prefix = match[0];
    const rest = text.slice(prefix.length);
    return `${prefix}${descriptor}, ${rest}`.trim();
  }
  return `${descriptor}, ${text}`.trim();
};

const buildCharacterMap = (characters: any[] = []) => {
  const map: Record<string, any> = {};
  characters.forEach((ch) => {
    if (ch?.id) map[ch.id] = ch;
  });
  return map;
};

const isFemaleCharacter = (ch: any) => {
  if (!ch) return false;
  if (typeof ch.gender === 'string' && ch.gender.toUpperCase() === 'FEMALE') return true;
  const text = `${ch.name || ''} ${ch.role || ''} ${ch.outfit || ''}`.toLowerCase();
  return /(female|woman|girl|wife|lady)/i.test(text);
};

const hasFemaleInScene = (
  text: string,
  characterIds?: string[],
  characterMap?: Record<string, any>
) => {
  if ((characterIds || []).some((id) => isFemaleCharacter(characterMap?.[id]))) {
    return true;
  }
  return /(여성|여자|female|woman|wife|아줌마|부인|lady)/i.test(text);
};

/**
 * [Phase 3] Replace truncated/incorrect AI-generated body descriptions with correct ones
 * @param prompt - The current prompt text
 * @param correctBody - The correct full body description from characterMap
 * @returns Updated prompt with body replaced
 */
const replaceAIBodyWithCorrectBody = (prompt: string, correctBody: string): string => {
  if (!correctBody || !prompt) return prompt;

  // If full body already exists, no replacement needed
  if (prompt.includes(correctBody)) return prompt;

  // Extract signature phrase (first clause before comma, max 50 chars)
  const signatureMatch = correctBody.match(/^([^,]{10,50})/);
  if (!signatureMatch) return prompt;

  const signature = signatureMatch[1].trim();

  // Check if signature exists in prompt (indicating truncated body)
  const signatureIndex = prompt.indexOf(signature);
  if (signatureIndex === -1) return prompt;

  // Find the extent of the truncated body description
  // Look for the end marker: comma, period, or "wearing"/"Outfit:"
  const afterSignature = prompt.slice(signatureIndex);
  const endMatch = afterSignature.match(/^[^,.]+(,|\.|(?=\s+wearing)|(?=\s+Outfit:))/);

  if (!endMatch) return prompt;

  const truncatedBody = endMatch[0].replace(/[,.]$/, '').trim();

  // Replace truncated body with full correct body
  const updated = prompt.replace(truncatedBody, correctBody);

  return updated;
};

/**
 * [Phase 4] Insert body into Person block for multi-character scenes
 * @param prompt - The current prompt text
 * @param characterId - Character ID (e.g., 'WomanA', 'ManB')
 * @param characterIds - Array of all character IDs in this scene (in Person order)
 * @param correctBody - The correct body description to insert
 * @returns Updated prompt with body inserted into correct Person block
 */
const insertBodyIntoPersonBlock = (
  prompt: string,
  characterId: string,
  characterIds: string[],
  correctBody: string
): string => {
  if (!correctBody || !prompt || !characterIds || characterIds.length === 0) return prompt;

  // Check if this is a Person block scene
  if (!prompt.includes('[Person ')) return prompt;

  // Find the Person number for this character (1-indexed)
  const personIndex = characterIds.indexOf(characterId);
  if (personIndex === -1) return prompt;

  const personNumber = personIndex + 1;
  const personBlockPattern = new RegExp(
    `\\[Person ${personNumber}:([^\\]]+)\\]`,
    'i'
  );

  const match = prompt.match(personBlockPattern);
  if (!match) return prompt;

  const personBlockContent = match[1];

  // Check if body already exists in this Person block
  if (personBlockContent.includes(correctBody)) return prompt;

  // Find where to insert body: after hair, before "wearing"
  // Pattern: identity, hair, [BODY HERE], wearing outfit
  const wearingMatch = personBlockContent.match(/(,\s*wearing\s+)/i);

  if (wearingMatch && wearingMatch.index !== undefined) {
    // Insert body before "wearing"
    const insertPosition = match.index! + '[Person X:'.length + wearingMatch.index;
    const beforeWearing = prompt.slice(0, insertPosition);
    const afterWearing = prompt.slice(insertPosition);
    return `${beforeWearing}, ${correctBody}${afterWearing}`;
  }

  // If no "wearing" found, append body before closing bracket
  const closeBracketIndex = match.index! + match[0].length - 1;
  const beforeBracket = prompt.slice(0, closeBracketIndex);
  const afterBracket = prompt.slice(closeBracketIndex);
  return `${beforeBracket}, ${correctBody}${afterBracket}`;
};

const enhanceScenePrompt = (
  text: string = "",
  options: {
    sceneNumber?: number;
    femaleOutfit?: string;
    femaleOutfit2?: string;
    maleOutfit?: string;
    characterMap?: Record<string, any>;
    characterIds?: string[];
    sceneCharacterSlots?: string[];
    identities?: CharacterIdentity[];
    autoEnhance?: boolean;
    enhancementSettings?: NormalizedPromptEnhancementSettings;
  } = {}
) => {
  if (!text) return text;
  let updated = text.trim();
  let hasAddedCharacterOutfit = false;

  // [FIX] Check if LLM already provided outfit - if so, skip all outfit injection
  const llmProvidedOutfit = updated.includes("Outfit:");
  if (llmProvidedOutfit) {
    hasAddedCharacterOutfit = true; // Mark as added to prevent global fallback
  }

  // Inject per-character outfits/hair if IDs are available
  // [FIX] Only inject if autoEnhance is true AND LLM didn't already provide outfit
  if (options.autoEnhance && !llmProvidedOutfit && options.characterIds && options.characterMap) {
    options.characterIds.forEach((id) => {
      const ch = options.characterMap?.[id];
      if (!ch) return;

      if (ch.outfit) {
        // Ensure "Outfit: " prefix is added if missing
        const outfitStr = ch.outfit.startsWith("Outfit:") ? ch.outfit : `Outfit: ${ch.outfit}`;
        if (!updated.includes(outfitStr) && !updated.includes(ch.outfit)) {
          updated += `, ${outfitStr}`;
          hasAddedCharacterOutfit = true;
        } else {
          // Mark as added if it's already in the text to prevent global fallback
          hasAddedCharacterOutfit = true;
        }
      }
      if (ch.hair && !updated.includes(ch.hair)) {
        updated += `, ${ch.hair}`;
      }
      // [Phase 3] Replace truncated/incorrect body descriptions before adding
      if (ch.body) {
        updated = replaceAIBodyWithCorrectBody(updated, ch.body);
      }
      // [Phase 4] Insert body into Person block for multi-character scenes
      // [Phase 2] Add body to post-processing if still missing
      if (ch.body && !updated.includes(ch.body)) {
        // Try Person block insertion first (for two-shot/three-shot scenes)
        const withPersonBlock = insertBodyIntoPersonBlock(updated, id, options.characterIds, ch.body);
        if (withPersonBlock !== updated) {
          // Successfully inserted into Person block
          updated = withPersonBlock;
        } else {
          // No Person block found, use simple append (single character scenes)
          updated += `, ${ch.body}`;
        }
      }
    });
  }

  // Only add global female outfit if no character-specific outfit was added
  // This prevents the "Double Outfit" issue where specific + global both appear.
  // [FIX] Only inject if autoEnhance is true AND LLM didn't already provide outfit
  if (options.autoEnhance && !llmProvidedOutfit && options.femaleOutfit && !hasAddedCharacterOutfit) {
    const femaleTag = `Outfit: ${options.femaleOutfit}`;
    // Check for both the tagged and untagged version to be safe
    if (!updated.includes(femaleTag) && !updated.includes(options.femaleOutfit)) {
      updated += `, ${femaleTag}`;
    }
  }

  // [FIX] Only inject if autoEnhance is true AND LLM didn't already provide outfit
  if (options.autoEnhance && !llmProvidedOutfit && options.femaleOutfit2 && options.femaleOutfit2 !== options.femaleOutfit) {
    const femaleTag2 = `Outfit: ${options.femaleOutfit2}`;
    if (!updated.includes(femaleTag2) && !updated.includes(options.femaleOutfit2)) {
      updated += `, ${femaleTag2}`;
    }
  }

  const maleRegex = /\b(male|man|men|husband)\b|남성|남자|오빠|남편/i;
  const noMaleRegex = /no male characters|no men/i;

  // [FIX] Only inject if autoEnhance is true AND LLM didn't already provide outfit
  if (options.autoEnhance && !llmProvidedOutfit && options.maleOutfit && !noMaleRegex.test(updated) && maleRegex.test(updated)) {
    const maleTag = `Outfit: ${options.maleOutfit}`;
    if (!updated.includes(maleTag) && !updated.includes(options.maleOutfit)) {
      updated += `, ${maleTag}`;
    }
  }

  if (options.autoEnhance) {
    const hasFemale = hasFemaleInScene(updated, options.characterIds, options.characterMap);
    const enhancement = options.enhancementSettings ?? DEFAULT_PROMPT_ENHANCEMENT_SETTINGS;
    updated = applyPromptEnhancementSlots(updated, enhancement, { hasFemaleCharacter: hasFemale });
  }

  // [NEW] Enforce Scene Number at the very beginning
  if (options.sceneNumber !== undefined) {
    const scenePrefix = `Scene ${options.sceneNumber}. `;
    if (!updated.startsWith(`Scene ${options.sceneNumber}`)) {
      // Remove any existing "Scene X." if it's in the wrong place or wrong number
      updated = updated.replace(/^Scene \d+\.\s*/i, '');
      updated = scenePrefix + updated;
    }
  }

  // [NEW] Enforce Shot Type (Two-shot, Three-shot) for multi-person scenes
  const femaleCount = (options.characterIds || []).filter(id => isFemaleCharacter(options.characterMap?.[id])).length;
  const hasMale = maleRegex.test(updated);
  const totalPeople = femaleCount + (hasMale ? 1 : 0);

  if (totalPeople >= 2) {
    const shotType = totalPeople === 2 ? "Two-shot" : "Three-shot";
    if (!updated.includes("shot") && !updated.includes("Shot")) {
      // Insert after Scene N.
      updated = updated.replace(/^(Scene \d+\.\s*)/i, `$1${shotType}, `);
    }
  }

  // [NEW] Enforce Accessories
  if (updated.includes("Slot A") && !updated.toLowerCase().includes("watch")) {
    updated = updated.replace(/Slot A/g, "Slot A [wearing a luxury diamond watch]");
  }
  if (updated.includes("Slot B") && !updated.toLowerCase().includes("necklace")) {
    updated = updated.replace(/Slot B/g, "Slot B [wearing a simple silver necklace]");
  }

  // [NEW] Prevent Text/Letters
  const noTextTag = "no text, no letters, no typography, no watermarks, no words";
  if (!updated.toLowerCase().includes("no text")) {
    updated += `, ${noTextTag}`;
  }

  updated = enforceKoreanIdentity(updated, (options as any).targetAgeLabel, options.sceneNumber);
  if (options.identities && options.identities.length > 0) {
    const descriptor = buildIdentityLockDescriptor(options.identities, options.sceneCharacterSlots || []);
    updated = injectIdentityLock(updated, descriptor);
  }
  return updated;
};

// Ensure 주/조연 의상 태그가 모두 포함되도록 한 번 더 보강
// [DEPRECATED] enhanceScenePrompt now handles this logic internally to avoid duplicates.
const ensureOutfitTags = (
  text: string,
  femaleOutfit?: string,
  femaleOutfit2?: string,
  maleOutfit?: string
) => {
  return text;
};

/**
 * [Outfit Uniqueness Validation] Ensures each character has a unique outfit
 * @param characters - Array of character objects with outfit field
 * @returns Modified characters array with unique outfits
 */
const validateAndFixOutfitUniqueness = (
  characters: any[],
  genre: string,
  topic: string,
  allowedOutfitCategories?: string[]
): any[] => {
  if (!Array.isArray(characters) || characters.length === 0) return characters;

  const outfitMap = new Map<string, string[]>(); // outfit -> [characterIds]
  const modifiedCharacters = [...characters];

  // Step 1: Detect duplicates
  characters.forEach((ch) => {
    if (!ch?.outfit || !ch?.id) return;
    const outfit = ch.outfit.trim();
    if (!outfitMap.has(outfit)) {
      outfitMap.set(outfit, []);
    }
    outfitMap.get(outfit)!.push(ch.id);
  });

  // Step 2: Fix duplicates by picking NEW outfit from outfit pool
  outfitMap.forEach((charIds, outfit) => {
    if (charIds.length <= 1) return; // No duplicate

    console.warn(`⚠️ [Outfit Duplicate Detected] ${charIds.length} characters wearing: "${outfit}"`);
    console.warn(`   Characters: ${charIds.join(', ')}`);

    // Collect all currently used outfits to exclude
    const usedOutfits = modifiedCharacters
      .map((c) => c.outfit)
      .filter((o) => o && o !== outfit);

    // Keep first character's outfit unchanged, re-pick for others
    for (let i = 1; i < charIds.length; i++) {
      const charId = charIds[i];
      const charIndex = modifiedCharacters.findIndex((c) => c.id === charId);
      if (charIndex === -1) continue;

      let newOutfit: string;

      // Determine if character is male or female based on ID
      const isMale = charId.toLowerCase().startsWith('man');

      if (isMale) {
        // Pick new male outfit from pool, excluding used outfits
        newOutfit = pickMaleOutfit(topic, [...usedOutfits, outfit], allowedOutfitCategories);
        console.warn(`   ✅ Re-picked (Male): ${charId} → "${newOutfit}"`);
      } else {
        // Pick new female outfit from pool, excluding used outfits
        newOutfit = pickFemaleOutfit(genre, topic, [...usedOutfits, outfit], allowedOutfitCategories);
        console.warn(`   ✅ Re-picked (Female): ${charId} → "${newOutfit}"`);
      }

      modifiedCharacters[charIndex].outfit = newOutfit;
      usedOutfits.push(newOutfit); // Add to used list for next iteration
    }
  });

  return modifiedCharacters;
};

const postProcessScripts = (
  scripts: any[],
  outfits: {
    femaleOutfit?: string;
    femaleOutfit2?: string;
    maleOutfit?: string;
    autoEnhance?: boolean;
    enhancementSettings?: NormalizedPromptEnhancementSettings;
    targetAgeLabel?: string;
    identities?: CharacterIdentity[];
    genre?: string;
    topic?: string;
    allowedOutfitCategories?: string[];
  }
) => {
  if (!Array.isArray(scripts)) return [];
  return scripts.map((script, idx) => {
    // [Outfit Uniqueness Validation] Fix duplicate outfits before processing
    const validatedCharacters = validateAndFixOutfitUniqueness(
      script?.characters || [],
      outfits.genre || '',
      outfits.topic || '',
      outfits.allowedOutfitCategories
    );
    const scenes = Array.isArray(script?.scenes) ? script.scenes : [];
    const characterMap = buildCharacterMap(validatedCharacters);
    const processedScenes = scenes.map((scene: any, sceneIdx: number) => {
      const sNum = scene?.sceneNumber ?? sceneIdx + 1;
      const sceneSlots = getSceneCharacterSlots(scene, characterMap);
      return {
        ...scene,
        shortPrompt: enhanceScenePrompt(
          scene?.shortPrompt,
          {
            ...outfits,
            sceneNumber: sNum,
            characterMap,
            characterIds: scene?.characterIds,
            sceneCharacterSlots: sceneSlots,
            identities: outfits.identities
          }
        ),
        longPrompt: enforceKoreanIdentity(
          enhanceScenePrompt(
            scene?.longPrompt,
            {
              ...outfits,
              sceneNumber: sNum,
              characterMap,
              characterIds: scene?.characterIds,
              sceneCharacterSlots: sceneSlots,
              identities: outfits.identities
            }
          ),
          outfits.targetAgeLabel,
          sNum
        ),
        sceneNumber: sNum
      };
    });

    return {
      ...script,
      version: script?.version ?? idx + 1,
      title: script?.title || `대본 버전 ${idx + 1}`,
      script: script?.script || script?.scriptBody || '',
      hook: script?.hook || script?.openingHook || '',
      twist: script?.twist || script?.punchline || '',
      characters: validatedCharacters, // Use validated characters with unique outfits
      scenes: processedScenes,
      // 🆕 사용된 의상 정보 저장 (나중에 재사용하기 위해)
      usedOutfits: {
        femaleOutfit: outfits.femaleOutfit,
        femaleOutfit2: outfits.femaleOutfit2,
        maleOutfit: outfits.maleOutfit
      }
    };
  });
};

const preprocessJson = (str: string): string => {
  const escapeInternalQuotes = (input: string): string => {
    let result = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];

      if (!inString) {
        if (ch === '"') inString = true;
        result += ch;
        continue;
      }

      if (escaped) {
        result += ch;
        escaped = false;
        continue;
      }

      if (ch === '\\') {
        result += ch;
        escaped = true;
        continue;
      }

      if (ch === '"') {
        let j = i + 1;
        while (j < input.length && /\s/.test(input[j])) j += 1;
        const next = input[j];

        if (next === undefined || next === ',' || next === '}' || next === ']' || next === ':') {
          inString = false;
          result += ch;
          continue;
        }

        result += '\\"';
        continue;
      }

      result += ch;
    }

    return result;
  };

  // Helper to fix common JSON issues in Korean context
  return escapeInternalQuotes(str)
    // Fix 1: Unescaped double quotes inside Korean text
    .replace(/([가-힣]\s*)"([가-힣])/g, '$1\\"$2')
    // Fix 2: Unescaped closing double quote before the actual closing quote
    .replace(/([가-힣])"(\s*")/g, '$1\\"$2')
    // Fix 3: Unescaped quotes around Korean words inside a string
    .replace(/([가-힣])"([가-힣])/g, '$1\\"$2');
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeInlineQuotesForKeys = (text: string, keys: string[]) => {
  if (!text || keys.length === 0) return text;

  const keyPattern = keys.map(escapeRegex).join('|');
  const regex = new RegExp(`"(${keyPattern})"\\s*:\\s*"`, 'g');
  let result = '';
  let lastIndex = 0;

  while (true) {
    const match = regex.exec(text);
    if (!match) break;

    const valueStart = regex.lastIndex;
    result += text.slice(lastIndex, valueStart);

    let j = valueStart;
    let escaped = false;
    let chunk = '';

    while (j < text.length) {
      const ch = text[j];

      if (ch === '\\' && !escaped) {
        escaped = true;
        chunk += ch;
        j += 1;
        continue;
      }

      if (ch === '"' && !escaped) {
        let k = j + 1;
        while (k < text.length && /\s/.test(text[k])) k += 1;
        if (k >= text.length || /[,\]}]/.test(text[k])) {
          break;
        }
        chunk += '\\"';
        j += 1;
        continue;
      }

      escaped = false;
      chunk += ch;
      j += 1;
    }

    result += chunk;
    if (j < text.length && text[j] === '"') {
      result += '"';
      j += 1;
    }

    lastIndex = j;
    regex.lastIndex = j;
  }

  result += text.slice(lastIndex);
  return result;
};

const extractValidJson = (text: string) => {
  if (!text) return null;
  let startIndex = -1;
  let endIndex = -1;
  let startChar = '';
  let endChar = '';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '\\' && !escaped) {
      escaped = true;
      continue;
    }

    if (ch === '"' && !escaped) {
      inString = !inString;
    }
    escaped = false;

    if (inString) continue;

    if (startIndex === -1 && (ch === '{' || ch === '[')) {
      startIndex = i;
      startChar = ch;
      endChar = ch === '{' ? '}' : ']';
      depth = 1;
      continue;
    }

    if (startIndex !== -1) {
      if (ch === startChar) depth += 1;
      if (ch === endChar) depth -= 1;
      if (depth === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    return text.substring(startIndex, endIndex);
  }
  return null;
};

const parseScriptsJson = (text: string) => {
  return parseJsonFromText(text, [
    'script',
    'scriptBody',
    'scriptLine',
    'shortPrompt',
    'shortPromptKo',
    'longPrompt',
    'longPromptKo',
    'hook',
    'punchline',
    'twist',
    'title'
  ]);
};

interface ShortsScriptGeneratorProps {
  onSave?: (scriptData: any) => void;
  selectedStory?: StoryResponse | null;
  onClearSelection?: () => void;
  defaultSettings?: any;
  darkMode?: boolean;
  autoGenerate?: boolean;
  onAutoGenerateComplete?: () => void;
  externalTrigger?: {
    topic: string;
    generationMode: 'none' | 'script-only' | 'script-image';
    genre: string;
    targetAge?: string;
  } | null;
  onExternalGenerateComplete?: () => void;
}

export function ShortsScriptGenerator({
  onSave,
  selectedStory,
  onClearSelection,
  defaultSettings,
  darkMode = false,
  autoGenerate = false,
  onAutoGenerateComplete,
  externalTrigger,
  onExternalGenerateComplete
}: ShortsScriptGeneratorProps) {
  // Template Manager
  const templateManager = useTemplateManager();
  console.log('ShortsScriptGenerator: templateManager:', templateManager);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [generationMode, setGenerationMode] = useState<'none' | 'script-only' | 'script-image'>('script-image');
  const [customScript, setCustomScript] = useState('');
  const [genre, setGenre] = useState('affair-suspicion');

  // [NEW] Genre Management State
  const [genres, setGenres] = useState(() => genreManager.getGenres());
  const [isGenreManagerOpen, setIsGenreManagerOpen] = useState(false);
  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");

  // Genre Manager v2 State
  const [selectedGenreId, setSelectedGenreId] = useState<string | null>(null);
  const [editingGenre, setEditingGenre] = useState<{ name: string; description: string; prompt: string } | null>(null);

  // [NEW] Identity Lock State
  const [identities, setIdentities] = useState<CharacterIdentity[]>([]);
  const identityLoadedRef = useRef(false);
  const identitySaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;
    getAppStorageValue<string>('shorts-generator-genre', 'affair-suspicion')
      .then((saved) => {
        if (!isActive) return;
        if (typeof saved === 'string' && saved.trim()) {
          setGenre(saved);
        }
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const loadIdentities = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/app-storage?key=shorts-generator-identities');
        if (!response.ok) return;
        const data = await response.json();
        const value = data?.value;
        if (Array.isArray(value)) {
          setIdentities(value.map((id: any) => ({
            ...id,
            lockedFields: new Set(id.lockedFields || [])
          })));
        }
      } catch (error) {
        console.warn('Failed to load identities from app storage:', error);
      } finally {
        identityLoadedRef.current = true;
      }
    };
    loadIdentities();
  }, []);

  // Sync identities to server-side app storage (workspace file)
  useEffect(() => {
    if (!identityLoadedRef.current) return;
    if (identitySaveTimerRef.current) {
      window.clearTimeout(identitySaveTimerRef.current);
    }
    identitySaveTimerRef.current = window.setTimeout(async () => {
      const toSave = identities.map(id => ({
        ...id,
        image: undefined,
        lockedFields: Array.from(id.lockedFields)
      }));
      try {
        await fetch('http://localhost:3002/api/app-storage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: 'shorts-generator-identities',
            value: toSave
          })
        });
      } catch (error) {
        console.warn('Failed to persist identities to app storage:', error);
      }
    }, 400);
  }, [identities]);

  useEffect(() => {
    return () => {
      if (identitySaveTimerRef.current) {
        window.clearTimeout(identitySaveTimerRef.current);
      }
    };
  }, []);

  const handleUpdateIdentity = (id: string, updates: Partial<CharacterIdentity>) => {
    setIdentities(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleDeleteIdentity = (id: string) => {
    if (confirm('이 캐릭터 설정을 삭제하시겠습니까?')) {
      setIdentities(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleAddIdentity = () => {
    const newId: CharacterIdentity = {
      id: `char-${Date.now()}`,
      slotId: '',
      name: '',
      age: '',
      outfit: '',
      accessories: '',
      isLocked: false,
      lockedFields: new Set()
    };
    setIdentities(prev => [...prev, newId]);
  };


  useEffect(() => {
    let isActive = true;

    const unsubscribe = genreManager.subscribe((updated) => {
      if (!isActive) return;
      setGenres(updated);
    });

    genreManager.loadGenres()
      .then((loaded) => {
        if (!isActive) return;
        setGenres(loaded);

        setGenre((current) => {
          if (loaded.some((item) => item.id === current)) return current;
          const fallback = loaded[0]?.id || 'affair-suspicion';
          setAppStorageValue('shorts-generator-genre', fallback);
          if (defaultSettings?.onChange) {
            defaultSettings.onChange({ ...defaultSettings, shortsGenre: fallback });
          }
          return fallback;
        });
      })
      .catch((error) => {
        showToast(error?.message || '장르 목록을 불러오지 못했습니다.', 'error');
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [defaultSettings]);

  // Initialize selection when modal opens
  useEffect(() => {
    if (isGenreManagerOpen && genres.length > 0 && !selectedGenreId) {
      setSelectedGenreId(genres[0].id);
    }
  }, [isGenreManagerOpen, genres]);

  // Load genre data into editor when selection changes
  useEffect(() => {
    if (selectedGenreId) {
      const target = genres.find(g => g.id === selectedGenreId);
      if (target) {
        setEditingGenre({
          name: target.name,
          description: target.description,
          prompt: target.prompt
        });
      }
    }
  }, [selectedGenreId, genres]);

  const handleAddNewGenre = async () => {
    const newId = `custom-${Date.now()}`;
    const newGenre = {
      id: newId,
      name: '새 장르',
      description: '새로운 장르 설명',
      prompt: `[장르: 새 장르]\n\n🔥 **필수 규칙: 사용자 입력을 반드시 따르세요.**\n- **키워드**: "{{TOPIC}}"을 대본의 핵심 소재로 사용\n\n**핵심 콘셉트:**\n...\n\n**스토리 구조:**\n1. 훅\n2. 전개\n3. 결말`,
      isCustom: true
    };
    try {
      const updated = await genreManager.addGenre(newGenre);
      setGenres(updated);
      setSelectedGenreId(newId);
      setGenre(newId);
      setAppStorageValue('shorts-generator-genre', newId);
      if (defaultSettings?.onChange) {
        defaultSettings.onChange({ ...defaultSettings, shortsGenre: newId });
      }
      showToast('장르가 추가되었습니다.', 'success');
    } catch (error: any) {
      showToast(error?.message || '장르 저장에 실패했습니다.', 'error');
    }
  };

  // [MODIFIED] Manual save handler
  const handleFieldChange = (field: 'name' | 'description' | 'prompt', value: string) => {
    if (!selectedGenreId || !editingGenre) return;
    setEditingGenre({ ...editingGenre, [field]: value });
  };

  const handleSaveGenreChanges = async () => {
    if (!selectedGenreId || !editingGenre) return;

    if (!editingGenre.name.trim()) {
      alert('장르 이름을 입력해주세요.');
      return;
    }

    try {
      const updated = await genreManager.updateGenre(selectedGenreId, editingGenre);
      setGenres(updated);
      showToast('장르가 저장되었습니다.', 'success');
    } catch (error: any) {
      showToast(error?.message || '장르 저장에 실패했습니다.', 'error');
    }
  };

  const handleResetGenres = async () => {
    if (confirm('모든 장르 설정을 초기 상태로 되돌리시겠습니까? 커스텀 장르도 모두 삭제됩니다.')) {
      try {
        const updated = await genreManager.reset();
        setGenres(updated);
        setSelectedGenreId(updated[0]?.id || null);
        setGenre(updated[0]?.id || 'affair-suspicion');
        setAppStorageValue('shorts-generator-genre', updated[0]?.id || 'affair-suspicion');
        if (defaultSettings?.onChange) {
          defaultSettings.onChange({ ...defaultSettings, shortsGenre: updated[0]?.id || 'affair-suspicion' });
        }
        showToast('장르가 초기화되었습니다.', 'success');
      } catch (error: any) {
        showToast(error?.message || '장르 초기화에 실패했습니다.', 'error');
      }
    }
  };

  const handleDeleteGenre = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 복구할 수 없습니다.')) return;

    try {
      const updated = await genreManager.deleteGenre(id);
      setGenres(updated);

      if (selectedGenreId === id) {
        setSelectedGenreId(updated[0]?.id || null);
      }

      if (genre === id) {
        const fallback = updated[0]?.id || 'affair-suspicion';
        setGenre(fallback);
        setAppStorageValue('shorts-generator-genre', fallback);
        if (defaultSettings?.onChange) {
          defaultSettings.onChange({ ...defaultSettings, shortsGenre: fallback });
        }
      }

      showToast('장르가 삭제되었습니다.', 'success');
    } catch (error: any) {
      showToast(error?.message || '장르 삭제에 실패했습니다.', 'error');
    }
  };

  const handlePreviewPrompt = async () => {
    setPreviewContent("프롬프트를 생성 중입니다...");
    setIsPromptPreviewOpen(true);
    try {
      const { lockedFemaleOutfit, lockedFemaleOutfit2, lockedMaleOutfit } = resolveEffectiveOutfits();

      const fullPrompt = buildFinalPrompt({
        generationMode: generationMode as 'none' | 'script-only' | 'script-image',
        modeTemplates,
        genre,
        topic,
        target,
        scriptCount,
        outfits: {
          lockedFemaleOutfit,
          lockedFemaleOutfit2,
          lockedMaleOutfit
        },
        backgroundContext: resolveBackgroundFromInputs(topic, defaultSettings?.customContext, genre)
      });

      setPreviewContent(fullPrompt);
    } catch (e) {
      setPreviewContent("프롬프트 미리보기 생성 실패: " + (e as any).message);
    }
  };
  const genreOptions = getGenreOptions(); // 장르 목록
  const [topic, setTopic] = useState('');
  const [target, setTarget] = useState('40대');
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [aiForwardingId, setAiForwardingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualJson, setManualJson] = useState('');
  const [showImagePrompts, setShowImagePrompts] = useState<Record<number, boolean>>({});
  const [showSavedImagePrompts, setShowSavedImagePrompts] = useState(false);
  const [showImageHistory, setShowImageHistory] = useState(true);

  const buildImageHistoryKey = (item: any): string => {
    if (!item) return 'unknown';
    if (item.id) return `id:${item.id}`;
    if (item.generatedImageId) return `blob:${item.generatedImageId}`;
    if (item.localFilename) return `file:${item.localFilename}`;
    return `hash:${item.prompt || ''}-${item.createdAt || 0}`;
  };

  function dedupeImageHistory(items: any[]): any[] {
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = buildImageHistoryKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const [imageHistory, setImageHistoryState] = useState<any[]>([]);

  const updateImageHistory = (updater: ((prev: any[]) => any[]) | any[]) => {
    setImageHistoryState(prev => {
      const next = typeof updater === 'function'
        ? (updater as (prev: any[]) => any[])(prev)
        : updater;
      if (!Array.isArray(next)) return prev;
      const normalized = dedupeImageHistory(next);
      if (normalized.length !== next.length) {
        console.log(`[Performance] Removed ${next.length - normalized.length} duplicate images from history`);
      }
      return normalized;
    });
  };

  useEffect(() => {
    let isActive = true;
    const loadStorage = async () => {
      const [
        savedTopic,
        savedTarget,
        savedScripts,
        savedAnalysis,
        savedHistory
      ] = await Promise.all([
        getAppStorageValue<string>('shorts-generator-topic', ''),
        getAppStorageValue<string>('shorts-generator-target', '40대'),
        getAppStorageValue<any[]>('shorts-generator-scripts', []),
        getAppStorageValue<AnalysisResult | null>('shorts-generator-analysis', null),
        getAppStorageValue<any[]>('imageHistory', [])
      ]);

      if (!isActive) return;
      if (typeof savedTopic === 'string') setTopic(savedTopic);
      if (typeof savedTarget === 'string') setTarget(savedTarget);
      if (Array.isArray(savedScripts)) setScripts(savedScripts);
      if (savedAnalysis && typeof savedAnalysis === 'object') setAnalysis(savedAnalysis);
      if (Array.isArray(savedHistory)) setImageHistoryState(dedupeImageHistory(savedHistory));
    };
    loadStorage().catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, []);
  const [historyUrls, setHistoryUrls] = useState<Record<string, string>>({});
  const historyUrlsRef = useRef<Record<string, string>>({});
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<any | null>(null);
  const [noGuard, setNoGuard] = useState(false);
  const [imageModel, setImageModel] = useState<string>('imagen-4.0-generate-001');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'imagen-4.0-generate-001',
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-ultra-generate-001',
    'imagen-3.0-generate-001',
    'imagen-2.5-fast'
  ]);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [femaleOutfit, setFemaleOutfit] = useState('0. 선택안함');
  const [maleOutfit, setMaleOutfit] = useState('');
  const [scriptCount, setScriptCount] = useState(1);
  const [enhancementSettings, setEnhancementSettings] = useState<NormalizedPromptEnhancementSettings | null>(null);
  const [viewingStory, setViewingStory] = useState<StoryResponse | null>(null);
  const activeEnhancementSettings = enhancementSettings ?? DEFAULT_PROMPT_ENHANCEMENT_SETTINGS;
  const identitySeededRef = useRef(false);

  const normalizeIdentityAgeLabel = (value?: string) => {
    if (!value) return '';
    const trimmed = value.trim();
    if (trimmed.includes('대')) return trimmed;
    const match = trimmed.match(/\d{2}/);
    return match ? `${match[0]}대` : trimmed;
  };

  const shouldAutoSeedIdentities = useCallback(() => {
    if (identitySeededRef.current) return false;
    if (identities.length === 0) return true;
    return !identities.some((identity) => (
      identity.isLocked ||
      identity.lockedFields?.size > 0 ||
      identity.name ||
      identity.age ||
      identity.outfit ||
      identity.accessories ||
      identity.slotId
    ));
  }, [identities]);

  const buildIdentitiesFromCharacters = useCallback((characters: any[]) => {
    return characters.map((ch: any, index: number): CharacterIdentity => ({
      id: `char-${Date.now()}-${index}`,
      slotId: normalizeSlotId(ch?.slot || ch?.slotId || ch?.characterSlot || ''),
      name: ch?.name || '',
      age: normalizeIdentityAgeLabel(ch?.age || ch?.targetAge || ''),
      outfit: ch?.outfit || '',
      accessories: ch?.accessories || ch?.accessory || '',
      isLocked: false,
      lockedFields: new Set()
    }));
  }, []);

  useEffect(() => {
    if (!shouldAutoSeedIdentities()) return;
    const scriptCharacters = scripts?.[0]?.characters;
    if (Array.isArray(scriptCharacters) && scriptCharacters.length > 0) {
      setIdentities(buildIdentitiesFromCharacters(scriptCharacters));
      identitySeededRef.current = true;
      return;
    }
    if (viewingStory?.characters && Array.isArray(viewingStory.characters) && viewingStory.characters.length > 0) {
      setIdentities(buildIdentitiesFromCharacters(viewingStory.characters));
      identitySeededRef.current = true;
    }
  }, [buildIdentitiesFromCharacters, scripts, shouldAutoSeedIdentities, viewingStory]);
  const [modeTemplates, setModeTemplates] = useState<ModeTemplates>(() => getDefaultModeTemplates());
  const [isModeTemplateModalOpen, setIsModeTemplateModalOpen] = useState(false);

  const persistModeTemplates = useCallback((nextTemplates: ModeTemplates) => {
    const normalized = normalizeModeTemplates(nextTemplates);
    setModeTemplates(normalized);
    try {
      setAppStorageValue(MODE_TEMPLATE_STORAGE_KEY, normalized);
    } catch (e) {
      console.error('[ShortsGenerator] Failed to save mode templates:', e);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadModeTemplates = async () => {
      const saved = await getAppStorageValue<ModeTemplates | null>(MODE_TEMPLATE_STORAGE_KEY, null);
      if (!isActive || !saved) return;
      if (saved.scriptOnly && saved.scriptImage) {
        setModeTemplates(normalizeModeTemplates({
          scriptOnly: String(saved.scriptOnly),
          scriptImage: String(saved.scriptImage),
          scriptOnlyBackups: Array.isArray(saved.scriptOnlyBackups) ? saved.scriptOnlyBackups.map(String) : [],
          scriptImageBackups: Array.isArray(saved.scriptImageBackups) ? saved.scriptImageBackups.map(String) : []
        }));
      }
    };
    loadModeTemplates().catch((e) => {
      console.error('[ShortsGenerator] Failed to load mode templates:', e);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const resolveEffectiveOutfits = () => {
    const override = (femaleOutfit && femaleOutfit.trim().length > 0) ? femaleOutfit : "0.";
    const fallbackCategory = defaultSettings?.category ? defaultSettings.category : "0.";
    const effectiveInput = (override.startsWith("0.") && fallbackCategory) ? fallbackCategory : override;
    const pickRandomOutfit = (exclude: string[] = []) => {
      const usable = SHORTFORM_OUTFIT_LIST.map(o => o.name).filter(name => name && !exclude.includes(name));
      if (usable.length === 0) {
        return 'White Halter-neck Knit + Red Micro Mini Skirt';
      }
      return pickRandom(usable);
    };
    let resolvedFemale = resolveOutfit(effectiveInput)?.trim() || '';
    if (!resolvedFemale) {
      resolvedFemale = pickRandomOutfit();
    }
    const resolvedMale = (maleOutfit && maleOutfit.trim().length > 0)
      ? maleOutfit
      : (MALE_OUTFIT_PRESETS.length ? pickRandom(MALE_OUTFIT_PRESETS) : "Navy Slim-fit Polo + White Tailored Golf Pants");

    // 주인공 의상 = 선택값 고정, 조연 의상은 다른 스타일에서 자동 선택
    // 1) 주인공
    const primaryFemaleOutfit = resolvedFemale;
    // 2) 조연: 주인공과 다른 의상 하나 자동 선택
    const secondaryFemaleOutfit = pickRandomOutfit([primaryFemaleOutfit]);

    return {
      lockedFemaleOutfit: primaryFemaleOutfit, // 주인공
      lockedFemaleOutfit2: secondaryFemaleOutfit, // 조연
      lockedMaleOutfit: resolvedMale
    };
  };

  // [PERSISTENCE] Save state to app storage
  useEffect(() => {
    setAppStorageValue('shorts-generator-topic', topic);
    setAppStorageValue('shorts-generator-target', target);
  }, [topic, target]);

  useEffect(() => {
    setAppStorageValue('shorts-generator-scripts', scripts);
  }, [scripts]);

  useEffect(() => {
    setAppStorageValue('shorts-generator-analysis', analysis);
  }, [analysis]);

  useEffect(() => {
    setViewingStory(selectedStory || null);
  }, [selectedStory]);

  const handleSaveModeTemplateSettings = (updated: ModeTemplates) => {
    persistModeTemplates(updated);
    showToast('생성 모드 템플릿을 저장했습니다.', 'success');
    // 창을 닫지 않고 유지 (사용자가 계속 작업할 수 있도록)
  };

  const handleResetModeTemplateSettings = () => {
    // 백업은 유지하면서 템플릿만 초기화
    const currentBackups = {
      scriptOnlyBackups: modeTemplates.scriptOnlyBackups || [],
      scriptImageBackups: modeTemplates.scriptImageBackups || []
    };

    const resetWithBackups = {
      ...getDefaultModeTemplates(),
      ...currentBackups
    };

    persistModeTemplates(resetWithBackups);
    showToast('생성 모드 템플릿을 기본값으로 초기화했습니다. (백업은 유지됨)', 'info');
  };

  useEffect(() => {
    if (defaultSettings?.targetAge) {
      setTarget(defaultSettings.targetAge);
    }
  }, [defaultSettings?.targetAge]);

  // Sync shortsGenre from ConfigPanel
  useEffect(() => {
    if (defaultSettings?.shortsGenre) {
      setGenre(defaultSettings.shortsGenre);
      setAppStorageValue('shorts-generator-genre', defaultSettings.shortsGenre);
    }
  }, [defaultSettings?.shortsGenre]);

  // Sync shortsGenerationMode from ConfigPanel
  useEffect(() => {
    if (defaultSettings?.shortsGenerationMode) {
      setGenerationMode(defaultSettings.shortsGenerationMode);
    }
  }, [defaultSettings?.shortsGenerationMode]);

  // Handle external trigger from App.tsx (테스트/장르생성 버튼)
  useEffect(() => {
    if (externalTrigger) {
      console.log('[ShortsScriptGenerator] External trigger received:', externalTrigger);

      // Apply settings from external trigger
      setTopic(externalTrigger.topic);
      setGenerationMode(externalTrigger.generationMode);
      setGenre(externalTrigger.genre);
      if (externalTrigger.targetAge) {
        setTarget(externalTrigger.targetAge);
      }

      // Auto-generate after short delay to ensure state is updated
      setTimeout(() => {
        generateScript();  // ← 함수 이름 수정!
        // Clear trigger after generation
        if (onExternalGenerateComplete) {
          onExternalGenerateComplete();
        }
      }, 100);
    }
  }, [externalTrigger]);

  // Sync topic from defaultSettings.customContext (always)
  useEffect(() => {
    if (defaultSettings?.customContext !== undefined) {
      setTopic(defaultSettings.customContext);
    }
  }, [defaultSettings?.customContext]);

  const handleRefreshModels = async () => {
    setIsModelLoading(true);
    try {
      const models = await fetchAvailableModels();
      if (models.length > 0) {
        // Remove duplicates and sort
        const uniqueModels = Array.from(new Set(models)).sort();
        setAvailableModels(uniqueModels);

        // If current model is not in list, switch to first available (preferring 3.0 or 4.0)
        if (!uniqueModels.includes(imageModel)) {
          const preferred =
            uniqueModels.find(m => m.includes('imagen-4')) ||
            uniqueModels.find(m => m.includes('imagen-3')) ||
            uniqueModels[0];
          setImageModel(preferred);
        }
      }
    } catch (e) {
      console.error("Failed to refresh models", e);
    } finally {
      setIsModelLoading(false);
    }
  };

  useEffect(() => {
    handleRefreshModels();
  }, []);

  useEffect(() => {
    fetch('http://localhost:3002/api/prompt-enhancement-settings')
      .then(res => res.json())
      .then(data => setEnhancementSettings(normalizePromptEnhancementSettings(data)))
      .catch(err => console.error("Failed to load enhancement settings:", err));
  }, []);

  const handleEnhanceAll = (scriptIndex: number, isSavedStory: boolean = false) => {
    const { lockedFemaleOutfit, lockedFemaleOutfit2, lockedMaleOutfit } = resolveEffectiveOutfits();
    if (isSavedStory) {
      if (!viewingStory || !viewingStory.scenes) return;
      const characterMap = buildCharacterMap(viewingStory.characters || []);
      const enhancedScenes = viewingStory.scenes.map((scene: any) => ({
        ...scene,
        shortPrompt: enhanceScenePrompt(scene.shortPrompt, {
          femaleOutfit: lockedFemaleOutfit || femaleOutfit || undefined,
          femaleOutfit2: lockedFemaleOutfit2 || undefined,
          maleOutfit: lockedMaleOutfit || maleOutfit || undefined,
          characterMap,
          characterIds: scene.characterIds,
          sceneCharacterSlots: getSceneCharacterSlots(scene, characterMap),
          identities,
          autoEnhance: true, // Force enhance
          enhancementSettings: activeEnhancementSettings
        }),
        longPrompt: enhanceScenePrompt(scene.longPrompt, {
          femaleOutfit: lockedFemaleOutfit || femaleOutfit || undefined,
          femaleOutfit2: lockedFemaleOutfit2 || undefined,
          maleOutfit: lockedMaleOutfit || maleOutfit || undefined,
          characterMap,
          characterIds: scene.characterIds,
          sceneCharacterSlots: getSceneCharacterSlots(scene, characterMap),
          identities,
          autoEnhance: true, // Force enhance
          enhancementSettings: activeEnhancementSettings
        })
      }));
      setViewingStory({ ...viewingStory, scenes: enhancedScenes });
      alert('모든 장면의 프롬프트가 후처리되었습니다!');
    } else {
      const newScripts = [...scripts];
      const targetScript = newScripts[scriptIndex];
      if (!targetScript || !targetScript.scenes) return;

      const characterMap = buildCharacterMap(targetScript.characters || []);
      targetScript.scenes = targetScript.scenes.map((scene: any) => ({
        ...scene,
        shortPrompt: enhanceScenePrompt(scene.shortPrompt, {
          femaleOutfit: lockedFemaleOutfit || femaleOutfit || undefined,
          femaleOutfit2: lockedFemaleOutfit2 || undefined,
          maleOutfit: lockedMaleOutfit || maleOutfit || undefined,
          characterMap,
          characterIds: scene.characterIds,
          sceneCharacterSlots: getSceneCharacterSlots(scene, characterMap),
          identities,
          autoEnhance: true, // Force enhance
          enhancementSettings: activeEnhancementSettings
        }),
        longPrompt: enhanceScenePrompt(scene.longPrompt, {
          femaleOutfit: lockedFemaleOutfit || femaleOutfit || undefined,
          femaleOutfit2: lockedFemaleOutfit2 || undefined,
          maleOutfit: lockedMaleOutfit || maleOutfit || undefined,
          characterMap,
          characterIds: scene.characterIds,
          sceneCharacterSlots: getSceneCharacterSlots(scene, characterMap),
          identities,
          autoEnhance: true, // Force enhance
          enhancementSettings: activeEnhancementSettings
        })
      }));
      setScripts(newScripts);
      alert('모든 장면의 프롬프트가 후처리되었습니다!');
    }
  };

  const handleEnhanceSingle = (scriptIndex: number, sceneIndex: number, type: 'short' | 'long', isSavedStory: boolean = false) => {
    const { lockedFemaleOutfit, lockedFemaleOutfit2, lockedMaleOutfit } = resolveEffectiveOutfits();
    if (isSavedStory) {
      if (!viewingStory || !viewingStory.scenes) return;
      const newScenes = [...viewingStory.scenes];
      const targetScene = newScenes[sceneIndex];
      const characterMap = buildCharacterMap(viewingStory.characters || []);

      const enhancedText = enhanceScenePrompt(type === 'short' ? targetScene.shortPrompt : targetScene.longPrompt, {
        femaleOutfit: lockedFemaleOutfit || femaleOutfit || undefined,
        femaleOutfit2: lockedFemaleOutfit2 || undefined,
        maleOutfit: lockedMaleOutfit || maleOutfit || undefined,
        characterMap,
        characterIds: targetScene.characterIds,
        sceneCharacterSlots: getSceneCharacterSlots(targetScene, characterMap),
        identities,
        autoEnhance: true,
        enhancementSettings: activeEnhancementSettings
      });

      if (type === 'short') targetScene.shortPrompt = enhancedText;
      else targetScene.longPrompt = enhancedText;

      setViewingStory({ ...viewingStory, scenes: newScenes });
    } else {
      const newScripts = [...scripts];
      const targetScript = newScripts[scriptIndex];
      const targetScene = targetScript.scenes[sceneIndex];
      const characterMap = buildCharacterMap(targetScript.characters || []);

      const enhancedText = enhanceScenePrompt(type === 'short' ? targetScene.shortPrompt : targetScene.longPrompt, {
        femaleOutfit: lockedFemaleOutfit || femaleOutfit || undefined,
        femaleOutfit2: lockedFemaleOutfit2 || undefined,
        maleOutfit: lockedMaleOutfit || maleOutfit || undefined,
        characterMap,
        characterIds: targetScene.characterIds,
        sceneCharacterSlots: getSceneCharacterSlots(targetScene, characterMap),
        identities,
        autoEnhance: true
      });

      if (type === 'short') targetScene.shortPrompt = enhancedText;
      else targetScene.longPrompt = enhancedText;

      setScripts(newScripts);
    }
  };

  // const genres = ... (Removed hardcoded)
  const targets = ['20대', '30대', '40대', '50대', '전연령'];
  // const tones = ... (Removed hardcoded)

  const handleForceStop = () => {
    if (!loading) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    alert(`대본 생성을 강제로 중지했습니다. 다시 시도하려면 "대본 ${scriptCount}개 생성하기" 버튼을 눌러주세요.`);
  };

  // --- HELPER FUNCTIONS FOR RANDOM OUTFIT SELECTION ---
  function pickRandom(array: any[]) {
    return array[Math.floor(Math.random() * array.length)];
  }

  const V3_MATERIALS = [
    "High-gloss Satin", "Matte Leather", "Textured Tweed", "Sheer Chiffon",
    "Fine Cashmere", "Stretch Spandex", "Metallic Knit", "Velvet"
  ];

  const V3_DETAILS = [
    "Gold zipper detail", "Pearl buttons", "Asymmetric cut", "Ruffled hem",
    "Lace trimming", "Side slit", "Backless design", "Crystal embellishments"
  ];

  function pickV3Item(category: string): string {
    // 카테고리 구분 없이 전체 여성 의상 리스트에서 랜덤 선택
    if (!category || category.startsWith('0')) {
      // If 0, return empty string to let AI decide
      return "";
    }

    // 1. Pick from unified female outfit list
    const itemBase = pickRandom(FEMALE_OUTFIT_PRESETS);

    // 2. Select Components (Color, Material, Detail)
    const material = pickRandom(V3_MATERIALS);
    const detail = pickRandom(V3_DETAILS);

    // 3. Combine
    return `${material} ${itemBase} with ${detail}`;
  }

  function resolveOutfit(outfitInput: string) {
    if (!outfitInput || outfitInput.trim() === '') return ""; // Let AI Decide

    // Check for Category Inputs
    if (outfitInput.startsWith("0.")) return "";
    if (outfitInput.startsWith("1.") || outfitInput.startsWith("2.") || outfitInput.startsWith("3.") || outfitInput.startsWith("4.")) {
      return pickV3Item(outfitInput);
    }

    // Fallback for legacy specific inputs (or if user types manually)
    return outfitInput;
  }

  const normalizeBackgroundText = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();
  const ensureBackgroundLabel = (text: string) => {
    if (!text) return '사용자가 선택한 장소';
    const hasLocationKeyword = /(에서|현장|장소|무드|location|배경|course|golf|카페|교실|사무실|공원|거리|in |at )/i.test(text);
    return hasLocationKeyword ? text : `${text} 현장`;
  };
  const resolveBackgroundFromInputs = (topicValue: string, contextValue?: string, genreValue?: string) => {
    const normalizedContext = normalizeBackgroundText(contextValue);
    const normalizedTopic = normalizeBackgroundText(topicValue);
    const normalizedGenre = normalizeBackgroundText(genreValue ? `${genreValue} 분위기` : '');
    const base = normalizedContext || normalizedTopic || normalizedGenre;
    return ensureBackgroundLabel(base);
  };

  const formatScriptContent = (script: any) => {
    const title = script?.title || 'Untitled';
    const sceneLines = Array.isArray(script?.scenes)
      ? script.scenes.map((scene: any, idx: number) => {
        const sceneNumber = scene.sceneNumber || idx + 1;
        return `
[Scene ${sceneNumber}]
KR: ${scene.shortPromptKo || ''}
EN: ${scene.shortPrompt || ''}
Long: ${scene.longPrompt || ''}
`;
      }).join('\n')
      : '';

    return `TITLE: ${title}
DATE: ${new Date().toLocaleString()}

=== SCRIPT ===
${script?.script || script?.scriptBody || ''}

=== PUNCHLINE ===
${script?.punchline || script?.twist || script?.hook || ''}

=== SCENES (IMAGE PROMPTS) ===
${sceneLines}
`;
  };

  const generateScript = async () => {
    if (!topic.trim()) {
      alert('소재/키워드를 입력해주세요!');
      return;
    }

    // Check for 'none' mode: genre must be selected
    if (generationMode === 'none' && (!genre || genre === 'none')) {
      alert('⚠️ 선택안함 모드에서는 장르를 먼저 선택해주세요!\n\n장르 지침만으로 대본을 생성합니다.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setScripts([]);
    setAnalysis(null);
    setShowImagePrompts({});

    try {
      const { lockedFemaleOutfit, lockedFemaleOutfit2, lockedMaleOutfit } = resolveEffectiveOutfits();

      const fullPrompt = buildFinalPrompt({
        generationMode: generationMode as 'none' | 'script-only' | 'script-image',
        modeTemplates,
        genre,
        topic,
        target,
        scriptCount,
        outfits: {
          lockedFemaleOutfit,
          lockedFemaleOutfit2,
          lockedMaleOutfit
        },
        backgroundContext: resolveBackgroundFromInputs(topic, defaultSettings?.customContext, genre)
      });

      console.log('[ShortsGenerator] Final Prompt Preview:', fullPrompt.substring(0, 200) + '...');
      console.log('[ShortsGenerator] 🎲 CREATIVITY_BOOSTER:', fullPrompt.match(/요청 ID: ([^\s\]]+)/)?.[1] || 'NOT FOUND');
      console.log('[ShortsGenerator] Full Prompt Length:', fullPrompt.length);

      // 2. Call API
      const targetService = defaultSettings?.targetService || 'GEMINI';
      const response = await fetch('http://localhost:3002/api/generate/raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: targetService,
          prompt: fullPrompt
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`[${response.status}] 생성 요청 실패: ${text || '서버 응답 없음'}`);
      }

      let data: any;
      let content: string;
      const responseClone = response.clone();
      try {
        data = await response.json();
        content = data.rawResponse;
        if (!content) throw new Error('응답이 비어있습니다.');
      } catch (err) {
        const text = await response.text().catch(() => '');
        throw new Error(`응답 JSON 파싱 실패: ${text || (err as Error).message}`);
      }

      // 3. Parse Response
      let jsonText = content;
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        const result = parseScriptsJson(jsonText);

        // [FIX] Handle various JSON structures (Single object vs Scripts array)
        let rawScripts = [];
        if (Array.isArray(result)) {
          rawScripts = result;
        } else if (result && result.scripts && Array.isArray(result.scripts)) {
          rawScripts = result.scripts;
        } else if (result && typeof result === 'object') {
          // It's a single script object (V3 standard)
          rawScripts = [result];
        }

        if (rawScripts.length > 0) {
          // [Post-Processing] Always run postProcessScripts for field normalization
          const processedScripts = postProcessScripts(rawScripts, {
            femaleOutfit: lockedFemaleOutfit,
            femaleOutfit2: lockedFemaleOutfit2,
            maleOutfit: lockedMaleOutfit,
            autoEnhance: activeEnhancementSettings.autoEnhanceOnGeneration ?? false,
            enhancementSettings: activeEnhancementSettings,
            targetAgeLabel: target,
            identities,
            genre,
            topic
          });

          // [v3.1.2 복원] 서버에 저장하고 folderName 받아오기
          const savedScripts = await Promise.all(processedScripts.map(async (script: any, idx: number) => {
            const scriptTitle = script.title || `Script ${idx + 1}`;

            const payload = {
              title: scriptTitle,
              content: formatScriptContent(script),
              service: targetService,
              folderName: script._folderName || data._folderName
            };

            try {
              const saveResult = await saveStoryFile(payload);
              return {
                ...script,
                _folderName: saveResult.folderName || script._folderName
              };
            } catch (saveError) {
              console.warn('Failed to save script file:', saveError);
              return script;
            }
          }));

          setScripts(savedScripts);

          if (generationMode === 'script-image') {
            const expanded: Record<number, boolean> = {};
            savedScripts.forEach((_: any, idx: number) => {
              expanded[idx] = true;
            });
            setShowImagePrompts(expanded);
          }

          if (onSave) {
            savedScripts.forEach((script: any, idx: number) => {
              onSave({ ...script, version: script.version ?? idx + 1 });
            });
          }
        } else {
          throw new Error('데이터 형식이 올바르지 않거나 빈 결과입니다.');
        }
      } else {
        throw new Error('JSON을 찾을 수 없습니다.');
      }


    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        console.warn('대본 생성 요청이 사용자에 의해 중단되었습니다.');
      } else {
        console.error('Error:', error);
        alert('대본 생성 중 JSON 파싱 오류가 발생했습니다. 서버 로그를 확인해주세요.');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Auto-generate when autoGenerate prop is true
  useEffect(() => {
    if (autoGenerate && topic.trim()) {
      generateScript().finally(() => {
        if (onAutoGenerateComplete) {
          onAutoGenerateComplete();
        }
      });
    }
  }, [autoGenerate]);

  const analyzeScript = async (script: string) => {
    setLoading(true);

    const prompt = `다음 유튜브 쇼츠 대본을 분석해주세요:

"${script}"

**분석 항목:**
1. 훅 강도 (1-10점)
2. 반전 효과 (1-10점)
3. 감정 곡선 (1-10점)
4. 길이 적절성 (1-10점)
5. 바이럴 가능성 (1-10점)
6. 개선점 3가지
7. 강점 3가지

JSON 형식으로만 답변:
\`\`\`json
{
  "scores": {
    "hook": 점수,
    "twist": 점수,
    "emotion": 점수,
    "length": 점수,
    "viral": 점수
  },
  "improvements": ["개선점1", "개선점2", "개선점3"],
  "strengths": ["강점1", "강점2", "강점3"],
  "totalScore": 총점
}
\`\`\``;

    try {
      // Use raw endpoint here too
      const response = await fetch('http://localhost:3002/api/generate/raw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: defaultSettings?.targetService || 'GEMINI',
          prompt: prompt
        })
      });

      const data = await response.json();
      const content = data.rawResponse;

      if (!content) throw new Error('응답이 비어있습니다.');

      let jsonText = content;
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        const result = JSON.parse(jsonText);
        setAnalysis(result);
      } else {
        throw new Error('JSON을 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // [NEW] YouTube Analysis Logic
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isAnalyzingYoutube, setIsAnalyzingYoutube] = useState(false);

  const handleAnalyzeYoutube = async () => {
    if (!youtubeUrl.trim()) {
      alert('유튜브 URL을 입력해주세요.');
      return;
    }

    setIsAnalyzingYoutube(true);
    setAnalysis(null);

    try {
      // 1. Extract Data from YouTube
      const extractRes = await fetch('http://localhost:3002/api/analyze-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl })
      });

      if (!extractRes.ok) {
        const err = await extractRes.json();
        throw new Error(err.error || '유튜브 데이터 추출 실패');
      }

      const videoData = await extractRes.json();

      // 2. Analyze with Gemini
      const analysisPrompt = `
      다음은 유튜브 쇼츠 영상의 정보와 자막(대본)입니다. 이 영상이 왜 인기가 있는지(혹은 없을지) 상세하게 분석해주세요.

      **영상 정보:**
      - 제목: ${videoData.title}
      - 채널: ${videoData.channel}
      - 조회수: ${videoData.viewCount}
      - 좋아요: ${videoData.likeCount}
      - 길이: ${videoData.duration}초

      **자막(대본):**
      "${videoData.transcript}"

      **분석 요청 사항:**
      1. **성공 요인 (Viral Factor)**: 조회수와 좋아요를 기반으로, 이 영상이 왜 떴는지(또는 왜 안 떴는지) 분석. (제목 어그로, 썸네일 추정, 초반 훅 등)
      2. **대본 구조 분석**: 
         - Hook (초반 3초): 시청자를 어떻게 잡았는가?
         - Retention (중반): 이탈을 어떻게 막았는가?
         - Twist/Payoff (결말): 만족감을 주었는가?
      3. **점수 평가 (10점 만점)**: 훅, 몰입도, 반전, 대중성, 완성도
      4. **벤치마킹 포인트**: 내 대본에 적용할 만한 핵심 전략 3가지.

      **출력 형식 (JSON Only):**
      \`\`\`json
      {
        "videoInfo": {
          "title": "${videoData.title}",
          "channel": "${videoData.channel}",
          "views": "${videoData.viewCount}"
        },
        "scores": {
          "hook": 점수,
          "immersion": 점수,
          "twist": 점수,
          "popularity": 점수,
          "completeness": 점수
        },
        "analysis": {
          "viralFactor": "성공 요인 분석 내용...",
          "structure": {
            "hook": "훅 분석...",
            "retention": "중반 분석...",
            "ending": "결말 분석..."
          }
        },
        "benchmarks": ["전략1", "전략2", "전략3"],
        "totalScore": 총점
      }
      \`\`\`
      `;

      const aiRes = await fetch('http://localhost:3002/api/generate/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: defaultSettings?.targetService || 'GEMINI',
          prompt: analysisPrompt
        })
      });

      const aiData = await aiRes.json();
      let jsonText = aiData.rawResponse;
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
      const firstBrace = jsonText.indexOf('{');
      const lastBrace = jsonText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1) {
        jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        const result = JSON.parse(jsonText);
        setAnalysis({ ...result, type: 'youtube' }); // Mark as YouTube analysis
      } else {
        throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
      }

    } catch (e) {
      console.error(e);
      alert('분석 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'));
    } finally {
      setIsAnalyzingYoutube(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // alert('대본이 클립보드에 복사되었습니다!'); // 팝업 제거
  };

  const copyAllLongPrompts = (scriptIdx: number) => {
    const script = scripts[scriptIdx];
    if (!script?.scenes || script.scenes.length === 0) {
      showToast('복사할 롱프롬프트가 없습니다.', 'error');
      return;
    }

    const allLongPrompts = script.scenes
      .map((scene: any, idx: number) => {
        const sceneNum = scene.sceneNumber || idx + 1;
        return `[Scene ${sceneNum}]\n${scene.longPrompt || ''}`;
      })
      .join('\n\n' + '='.repeat(80) + '\n\n');

    navigator.clipboard.writeText(allLongPrompts);
    showToast('모든 롱 프롬프트를 복사했습니다.', 'success');
  };

  const handleForwardPromptToImageAI = async (prompt: string, id: string, scriptData?: any, sceneNumber?: number) => {
    if (aiForwardingId && aiForwardingId === id) {
      setAiForwardingId(null);
      showToast('AI 생성 요청을 취소했습니다.', 'info');
      return;
    }
    if (!prompt || !prompt.trim()) {
      showToast('전송할 롱 프롬프트가 없습니다.', 'warning');
      return;
    }
    setAiForwardingId(id);
    try {
      const title = scriptData?.title || `Script_${id}`;
      // ✅ [FIX] scriptData._folderName(제목 폴더명)을 우선 사용하여 폴더 이탈 방지
      const storyId = scriptData?._folderName || scriptData?.id || `story_${Date.now()}`;

      const response = await fetch('http://localhost:3002/api/image/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          storyId,
          sceneNumber: sceneNumber || 1,
          service: 'GEMINI',
          autoCapture: true,
          title
        })
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
      showToast(`AI 서비스(${payload?.service || 'GEMINI'})로 프롬프트를 전송했습니다.`, 'success');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('AI 생성 요청이 취소되었습니다.');
      } else {
        console.error('AI 생성 오류:', error);
        showToast(error?.message || 'AI 서비스 전송 중 오류가 발생했습니다.', 'error');
      }
    } finally {
      setAiForwardingId(null);
    }
  };

  const handleGenerateImage = async (prompt: string, id: string, storyId?: string, sceneNumber?: number, isRetryWithShort: boolean = false, originalPrompt?: string) => {
    if (generatingId) return;
    setGeneratingId(id);
    try {
      initGeminiService();
      const safetySettings = noGuard ? [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
      ] : undefined;

      const generationOptions = { aspectRatio: "9:16", model: imageModel };
      const result = await generateImageWithImagen(prompt, "", generationOptions, safetySettings);
      let base64Image: string | null = null;
      if (result && 'generatedImages' in result && result.generatedImages?.length > 0) {
        const generatedImage = result.generatedImages[0];
        if (generatedImage?.image?.imageBytes) {
          base64Image = generatedImage.image.imageBytes;
        } else if (generatedImage?.imageBytes) {
          base64Image = generatedImage.imageBytes;
        }
      } else if ((result as any)?.images?.length > 0) {
        base64Image = (result as any).images[0];
      } else if ((result as any)?.candidates) {
        const inlineData = (result as any).candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
        if (inlineData?.data) base64Image = inlineData.data;
      }

      if (!base64Image) throw new Error('이미지를 받지 못했습니다.');
      const blob = await fetch(`data:image/png;base64,${base64Image}`).then(res => res.blob());
      const imageId = crypto.randomUUID();
      await setBlob(imageId, blob);

      // 디스크에 이미지 저장 (AI Studio에서도 보이도록)
      const saveToDiskPayload = {
        imageData: `data:image/png;base64,${base64Image}`,
        prompt: originalPrompt || prompt,
        storyId: storyId || 'shorts-generator',
        sceneNumber: sceneNumber || 1
      };

      const saveResponse = await fetch('http://localhost:3002/api/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveToDiskPayload)
      });
      const saveResult = await saveResponse.json();
      const savedLocalFilename = saveResult.filename;

      // history 공유 스토리지에 기록 (AI Studio와 동일한 형식)
      const newItem = {
        id: crypto.randomUUID(),
        prompt: originalPrompt || prompt,
        generatedImageId: imageId,
        favorite: false,
        createdAt: Date.now(),
        source: 'shorts',
        localFilename: savedLocalFilename || undefined,
        settings: { mode: 'Generate', aspectRatio: "9:16", activeCheatKeys: [], noGuard, enhanceBackground: false, removeBackground: false, creativity: 0.8 }
      };

      updateImageHistory(prev => {
        const existingIds = new Set(prev.map((item: any) => item.id));
        if (existingIds.has(newItem.id)) return prev;
        const newHistory = [newItem, ...prev].slice(0, 100);
        // app storage에 즉시 저장 (다른 탭과 동기화)
        setAppStorageValue('imageHistory', newHistory);
        return newHistory;
      });

      const successMsg = isRetryWithShort
        ? '⚠️ Long Prompt가 정책 위반으로 차단되어 Short Prompt로 이미지를 생성했습니다.\n(우측 사이드바/이미지 히스토리에서 확인)'
        : '이미지가 생성되어 히스토리에 저장되었습니다. (우측 사이드바/이미지 히스토리에서 확인)';
      alert(successMsg);
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : '이미지 생성에 실패했습니다.';

      // 정책 위반 감지 (SAFETY, BLOCKED_REASON 등)
      const isPolicyViolation = errorMsg.toLowerCase().includes('safety') ||
        errorMsg.toLowerCase().includes('blocked') ||
        errorMsg.toLowerCase().includes('policy') ||
        errorMsg.toLowerCase().includes('harm');

      // Long Prompt 실패 시 Short Prompt로 자동 재시도
      if (isPolicyViolation && !isRetryWithShort && id.includes('long-')) {
        const shortId = id.replace('long-', 'short-');
        // id format check: saved-long-idx (from view history) or long-scriptidx-sceneidx (from generation)
        const longMatch = id.match(/long-(\d+)-(\d+)/);
        const savedMatch = id.match(/saved-long-(\d+)/);

        if (longMatch) {
          const scriptIdx = parseInt(longMatch[1]);
          const sceneIdx = parseInt(longMatch[2]);
          const script = scripts[scriptIdx];
          const scene = script?.scenes?.[sceneIdx];

          if (scene?.shortPrompt) {
            setGeneratingId(null);
            alert(`⚠️ Long Prompt가 정책 위반으로 차단되었습니다.\nShort Prompt로 자동 재시도합니다...`);
            handleGenerateImage(scene.shortPrompt, shortId, script?._folderName, scene.sceneNumber, true, prompt);
            return;
          }
        } else if (savedMatch && viewingStory) {
          const sceneIdx = parseInt(savedMatch[1]);
          const scene = viewingStory.scenes?.[sceneIdx];
          if (scene?.shortPrompt) {
            setGeneratingId(null);
            alert(`⚠️ Long Prompt가 정책 위반으로 차단되었습니다.\nShort Prompt로 자동 재시도합니다...`);
            handleGenerateImage(scene.shortPrompt, shortId, viewingStory._folderName, scene.sceneNumber, true, prompt);
            return;
          }
        }
      }

      alert(errorMsg);
    } finally {
      setGeneratingId(null);
    }
  };

  // Load shared image history (same 스토리지 as 보관함)
  useEffect(() => {
    historyUrlsRef.current = historyUrls;
  }, [historyUrls]);

  useEffect(() => {
    return () => {
      Object.values(historyUrlsRef.current).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore revoke errors
        }
      });
      historyUrlsRef.current = {};
    };
  }, []);

  useEffect(() => {
    initGeminiService();

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key === 'imageHistory' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) {
            updateImageHistory(parsed);
          }
        } catch (err) {
          console.error('Failed to sync image history', err);
        }
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  // Persist history locally whenever it changes (safety net for any flow)
  useEffect(() => {
    try {
      const normalized = dedupeImageHistory(imageHistory);
      setAppStorageValue('imageHistory', normalized);
    } catch (e) {
      console.error('Failed to persist imageHistory', e);
    }
  }, [imageHistory]);

  // Persist shared history whenever it changes

  // Resolve blobs to URLs
  // MOUNTED REF to avoid setting state on unmounted component
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadingIdsRef = useRef<Set<string>>(new Set());
  const loadedIdsRef = useRef<Set<string>>(new Set()); // [PERFORMANCE] Track loaded images
  const loadUrlsTimeoutRef = useRef<NodeJS.Timeout | null>(null); // [PERFORMANCE] Debounce timer

  const loadUrls = async () => {
    if (imageHistory.length === 0) return;

    const needsLoad = imageHistory.filter(item =>
      (item.generatedImageId || item.localFilename) &&
      !historyUrls[item.id] &&
      !loadingIdsRef.current.has(item.id) &&
      !loadedIdsRef.current.has(item.id) // [PERFORMANCE] Skip already loaded
    );

    if (needsLoad.length === 0) return;

    console.log(`[Performance] Loading ${needsLoad.length} new thumbnails (${loadedIdsRef.current.size} already loaded)`);

    // Mark as loading
    needsLoad.forEach(item => loadingIdsRef.current.add(item.id));

    const fetchFromLocalFile = async (filename: string, storyId?: string): Promise<string | null> => {
      const trimmed = filename.replace(/^\/+/, '');
      const baseName = trimmed.split('/').pop() || trimmed;
      const storyPath = storyId ? `대본폴더/${storyId}/images/${baseName}` : null;
      const candidates = [
        `/generated_scripts/images/${trimmed}`,
        `/generated_scripts/${trimmed}`,
        storyPath ? `/generated_scripts/${storyPath}` : null,
        `http://localhost:3002/generated_scripts/images/${trimmed}`,
        `http://localhost:3002/generated_scripts/${trimmed}`,
        storyPath ? `http://localhost:3002/generated_scripts/${storyPath}` : null,
        `http://127.0.0.1:3002/generated_scripts/images/${trimmed}`,
        `http://127.0.0.1:3002/generated_scripts/${trimmed}`,
        storyPath ? `http://127.0.0.1:3002/generated_scripts/${storyPath}` : null
      ].filter(Boolean) as string[];
      for (const url of candidates) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            return URL.createObjectURL(blob);
          }
        } catch (e) {
          // Ignore failure, try next candidate
        }
      }
      return null;
    };

    const newUrls: Record<string, string> = {};
    // Load all in parallel
    await Promise.all(needsLoad.map(async (item) => {
      try {
        let url: string | null = null;
        // 1. Try Loading Blob from DB
        if (item.generatedImageId) {
          const blob = await getBlob(item.generatedImageId);
          if (blob) {
            url = URL.createObjectURL(blob);
          }
        }

        // 2. Try Loading from Local File (Fallback)
        if (!url && item.localFilename) {
          url = await fetchFromLocalFile(item.localFilename, (item as any).storyId);
        }

        if (url && isMountedRef.current) {
          newUrls[item.id] = url;
          loadedIdsRef.current.add(item.id); // [PERFORMANCE] Mark as loaded
        }
      } catch (e) {
        console.error(`Failed to load image for item ${item.id}`, e);
      } finally {
        loadingIdsRef.current.delete(item.id);
      }
    }));

    if (isMountedRef.current && Object.keys(newUrls).length > 0) {
      setHistoryUrls(prev => ({ ...prev, ...newUrls }));
      console.log(`[Performance] Loaded ${Object.keys(newUrls).length} thumbnails successfully`);
    }
  };

  // [PERFORMANCE] Debounced image loading - only load after 300ms of no changes
  useEffect(() => {
    if (loadUrlsTimeoutRef.current) {
      clearTimeout(loadUrlsTimeoutRef.current);
    }

    loadUrlsTimeoutRef.current = setTimeout(() => {
      loadUrls();
    }, 300); // 300ms debounce

    return () => {
      if (loadUrlsTimeoutRef.current) {
        clearTimeout(loadUrlsTimeoutRef.current);
      }
    };
  }, [imageHistory]);

  const bootstrapFromDisk = async (force: boolean = false) => {
    if (!force && imageHistory.length > 0) return;
    const files = await fetchDiskImageList();
    if (files.length === 0) {
      if (force) showToast('디스크에서 로드할 이미지가 없습니다.', 'info');
      return;
    }

    // Merge logic: Filter out files that already exist in history (checking localFilename)
    const existingFilenames = new Set(imageHistory.map(item => item.localFilename).filter(Boolean));
    const newFiles = files.filter(f => !existingFilenames.has(f));

    if (newFiles.length === 0) {
      if (force) showToast('새로운 이미지가 없습니다.', 'info');
      return;
    }

    const synthetic = newFiles.slice(0, 50).map((filename) => ({
      id: `disk-${filename}`, // 파일명 기반의 안정적인 ID 사용
      prompt: filename,
      generatedImageId: '',
      favorite: false,
      localFilename: filename,
      createdAt: Date.now(),
      source: 'disk',
      settings: { mode: 'Generate', aspectRatio: "9:16", activeCheatKeys: [], noGuard, enhanceBackground: false, removeBackground: false, creativity: 0.8 }
    }));

    updateImageHistory(prev => {
      const existingIds = new Set(prev.map(item => item.id));
      const filteredSynthetic = synthetic.filter(item => !existingIds.has(item.id));
      if (filteredSynthetic.length === 0) return prev;
      const newHistory = [...filteredSynthetic, ...prev].slice(0, 200);
      return newHistory;
    });
    if (force) {
      showToast(`${synthetic.length}개의 이미지를 새로 불러왔습니다.`, 'success');
      // Delay explicitly to allow state to settle
      setTimeout(loadUrls, 500);
    }
  };

  // Fallback: if no history, bootstrap from disk images (limited)
  useEffect(() => {
    bootstrapFromDisk(false);
  }, []); // Run only on mount

  const handleRefreshHistory = async () => {
    if (!window.confirm('디스크에서 이미지를 다시 불러오시겠습니까? (현재 목록에 없는 파일만 추가됩니다)')) return;
    await bootstrapFromDisk(true);
  };

  const handleManualImport = async () => {
    try {
      if (!manualJson.trim()) {
        showToast('JSON 텍스트를 입력해주세요.', 'warning');
        return;
      }

      const result = parseScriptsJson(manualJson);
      const rawScripts = Array.isArray(result)
        ? result
        : result?.scripts && Array.isArray(result.scripts)
          ? result.scripts
          : result && typeof result === 'object'
            ? [result]
            : [];

      if (rawScripts.length > 0) {
        const { lockedFemaleOutfit, lockedFemaleOutfit2, lockedMaleOutfit } = resolveEffectiveOutfits();
        // [Post-Processing] Always run postProcessScripts for field normalization
        const processed = postProcessScripts(rawScripts, {
          femaleOutfit: lockedFemaleOutfit || undefined,
          femaleOutfit2: lockedFemaleOutfit2 || undefined,
          maleOutfit: lockedMaleOutfit || undefined,
          autoEnhance: activeEnhancementSettings.autoEnhanceOnGeneration ?? false,
          enhancementSettings: activeEnhancementSettings,
          targetAgeLabel: target,
          identities,
          genre,
          topic
        });
        // 수동 JSON도 저장 로직을 태워 쇼츠랩 불러오기와 동일하게 동작하도록 처리
        const savedScripts = await Promise.all(processed.map(async (script: any, idx: number) => {
          const scriptTitle = script.title || `Script ${idx + 1}`;
          const payload = {
            title: scriptTitle,
            content: formatScriptContent(script),
            service: defaultSettings?.targetService || 'GEMINI',
            folderName: script._folderName
          };
          try {
            const saveResult = await saveStoryFile(payload);
            return {
              ...script,
              _folderName: saveResult.folderName || script._folderName
            };
          } catch (saveError) {
            console.warn('Failed to save manual JSON script file:', saveError);
            return script;
          }
        }));
        setScripts(savedScripts);
        try {
          const primaryScript = savedScripts[0];
          if (primaryScript?.scenes && Array.isArray(primaryScript.scenes)) {
            const labScenes = primaryScript.scenes.map((scene: any, idx: number) => {
              const sceneNumber = scene.sceneNumber || idx + 1;
              const narrationText = typeof scene.narration === 'string'
                ? scene.narration
                : scene.narration?.text || '';
              const lipSyncLine = scene.lipSync?.line || scene.dialogue || '';
              const voiceType = scene.voiceType || (lipSyncLine ? 'both' : narrationText ? 'narration' : 'none');
              return {
                number: sceneNumber,
                text: scene.scriptLine || scene.summary || scene.text || `장면 ${sceneNumber}`,
                prompt: scene.longPrompt || scene.shortPrompt || scene.prompt || '',
                imageUrl: undefined,
                shortPromptKo: scene.shortPromptKo || '',
                longPromptKo: scene.longPromptKo || '',
                summary: scene.summary || scene.scriptLine || '',
                camera: scene.camera || '',
                shotType: scene.shotType || '',
                age: scene.age || '',
                outfit: scene.outfit || '',
                isSelected: true,
                videoPrompt: scene.videoPrompt || '',
                dialogue: scene.dialogue || lipSyncLine || '',
                voiceType,
                narrationText: narrationText || scene.scriptLine || '',
                narrationEmotion: scene.narration?.emotion || '',
                narrationSpeed: scene.narration?.speed || 'normal',
                lipSyncSpeaker: scene.lipSync?.speaker || '',
                lipSyncSpeakerName: scene.lipSync?.speakerName || '',
                lipSyncLine: lipSyncLine || '',
                lipSyncEmotion: scene.lipSync?.emotion || '',
                lipSyncTiming: scene.lipSync?.timing || undefined
              };
            });

            await setAppStorageValue('shorts-lab-scenes', labScenes);
            await setAppStorageValue('shorts-lab-folder', primaryScript._folderName || '');
            await setAppStorageValue('shorts-lab-topic', primaryScript.title || '');
            window.dispatchEvent(new CustomEvent('open-shorts-lab'));
          }
        } catch (e) {
          console.warn('Failed to sync manual JSON to ShortsLab:', e);
        }
        if (generationMode === 'script-image') {
          const expanded: Record<number, boolean> = {};
          savedScripts.forEach((_: any, idx: number) => {
            expanded[idx] = true;
          });
          setShowImagePrompts(expanded);
        }
        setShowManualInput(false);
        setManualJson('');
        showToast('대본을 성공적으로 불러왔습니다!', 'success');
      } else {
        showToast('형식이 올바르지 않습니다. "scripts" 배열이 포함되어야 합니다.', 'warning');
      }
    } catch (e) {
      console.error(e);
      showToast('JSON 변환에 실패했습니다. 형식과 따옴표를 확인해주세요.', 'error');
    }
  };

  const handleDeleteHistoryItem = async (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const target = imageHistory.find((item) => item.id === id);
    if (!target) return;
    if (!window.confirm('이 이미지를 삭제하시겠습니까?')) return;

    if (target.generatedImageId) {
      try {
        await deleteBlob(target.generatedImageId);
      } catch (err) {
        console.error('Failed to delete blob', err);
      }
    }

    updateImageHistory(prev => {
      const nextHistory = prev.filter((item) => item.id !== id);
      return nextHistory;
    });

    if (historyUrls[id]) {
      URL.revokeObjectURL(historyUrls[id]);
      setHistoryUrls((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }

    showToast('이미지를 삭제했습니다.', 'success');
  };

  const handleCopyPrompt = async (prompt: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(prompt || '');
    } catch (err) {
      console.error('Prompt copy failed', err);
    }
    showToast('복사했습니다.', 'success');
  };

  const createSyntheticEvent = () => ({ stopPropagation() { } }) as any;

  const lightboxActions = useMemo(() => {
    if (!lightboxItem) return [];
    return [
      {
        label: lightboxItem.favorite ? '즐겨찾기 해제' : '즐겨찾기',
        icon: <Star size={14} className={lightboxItem.favorite ? 'fill-yellow-300 text-yellow-200' : 'text-yellow-200'} />,
        onClick: () => toggleFavorite(lightboxItem.id)
      },
      {
        label: '프롬프트 복사',
        icon: <Copy size={14} />,
        onClick: () => handleCopyPrompt(lightboxItem.prompt || '', createSyntheticEvent())
      },
      {
        label: '편집',
        icon: <ImageIcon size={14} />,
        onClick: () => {
          setAppStorageValue('imageStudio_load_from_history', lightboxItem);
          setShowImageHistory(false);
          setLightboxImageUrl(null);
          setLightboxItem(null);
          showToast('이미지 스튜디오에서 편집을 계속하세요. (히스토리에서 선택됨)', 'info');
        }
      },
      {
        label: '삭제',
        icon: <X size={14} />,
        tone: 'danger' as const,
        onClick: () => handleDeleteHistoryItem(lightboxItem.id, createSyntheticEvent())
      }
    ];
  }, [lightboxItem, handleCopyPrompt, handleDeleteHistoryItem]);

  const toggleFavorite = (id: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    updateImageHistory(prev => {
      const next = prev.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item);
      return next;
    });
    const target = imageHistory.find(i => i.id === id);
    const toggledOn = target ? !target.favorite : true;
    showToast(toggledOn ? '즐겨찾기에 추가되었습니다.' : '즐겨찾기가 해제되었습니다.', 'success');
  };

  return (
    <div className="flex h-full overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-1">
      <div className="flex-1 relative h-full flex flex-col overflow-y-auto mr-24">
        <Lightbox
          imageUrl={lightboxImageUrl}
          actions={lightboxActions}
          onClose={() => {
            setLightboxImageUrl(null);
            setLightboxItem(null);
          }}
        />

        {/* 저장된 대본 표시 */}
        {viewingStory ? (
          <>
            {/* 뒤로가기 버튼 */}
            <button
              onClick={onClearSelection}
              className="mb-6 px-4 py-2 bg-white dark:bg-slate-900 border-2 border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-slate-800 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300 font-semibold shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              대본 생성으로 돌아가기
            </button>

            {/* 대본 분석 버튼 */}
            <div className="mb-6">
              <button
                onClick={() => analyzeScript(viewingStory.scriptBody)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    대본을 분석하고 있습니다...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    대본 분석하기
                  </>
                )}
              </button>
            </div>

            {/* 대본 카드 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="inline-block px-3 py-1 bg-green-100 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold mb-2">
                    저장된 대본
                  </span>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{viewingStory.title}</h3>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(viewingStory.createdAt).toLocaleString('ko-KR')}
                </span>
              </div>

              {/* 대본 내용 */}
              <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">📝 대본</h4>
                <p className="text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                  {viewingStory.scriptBody}
                </p>
              </div>

              {/* 펀치라인 */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-4">
                <h4 className="text-sm font-bold text-green-700 dark:text-green-400 mb-2">💥 펀치라인</h4>
                <p className="text-gray-800 dark:text-gray-100">{viewingStory.punchline}</p>
              </div>

              {/* 이미지 프롬프트 (저장본) */}
              {viewingStory.scenes && viewingStory.scenes.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setShowSavedImagePrompts(!showSavedImagePrompts)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowSavedImagePrompts(!showSavedImagePrompts); }}
                    className="w-full flex items-center justify-between text-left font-bold text-purple-800 dark:text-purple-300 mb-2 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      이미지 프롬프트 (총 {viewingStory.scenes.length}장)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const allLongPrompts = viewingStory.scenes.map((s, i) => `[장면 ${i + 1}]\n${s.longPrompt}`).join('\n\n');
                          copyToClipboard(allLongPrompts);
                          showToast(`${viewingStory.scenes.length}개 장면의 롱 프롬프트를 복사했습니다.`, 'success');
                        }}
                        className="text-xs px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 border border-purple-500 flex items-center gap-1"
                        title="모든 롱 프롬프트 복사"
                      >
                        <Copy className="w-3 h-3" />
                        롱프롬프트 전체복사
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          for (let i = 0; i < viewingStory.scenes.length; i++) {
                            const scene = viewingStory.scenes[i];
                            await handleForwardPromptToImageAI(scene.longPrompt, `oneclick-${i}`, viewingStory, scene.sceneNumber);
                            // Wait a bit between requests to avoid overwhelming the server
                            if (i < viewingStory.scenes.length - 1) {
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                          }
                        }}
                        className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-500 flex items-center gap-1"
                        title="모든 롱 프롬프트를 AI 서비스로 순차 전송"
                      >
                        <Zap className="w-3 h-3" />
                        원클릭
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleEnhanceAll(0, true); }}
                        className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-500 flex items-center gap-1"
                        title="모든 프롬프트에 한국인/고화질 태그 강제 적용"
                      >
                        <Sparkles className="w-3 h-3" />
                        전체 후처리
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setNoGuard(!noGuard); }}
                        className={`text-xs px-2 py-1 rounded border ${noGuard ? 'bg-red-500/10 text-red-500 border-red-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-300'}`}
                      >
                        {noGuard ? '검열 해제' : '안전 필터'}
                      </button>
                      {showSavedImagePrompts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {showSavedImagePrompts && (
                    <div className="space-y-3">
                      {viewingStory.scenes.map((scene, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-purple-600 dark:text-purple-400">장면 #{scene.sceneNumber}</span>
                              <span className="text-xs text-gray-500">{scene.shortPromptKo}</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleGenerateImage(scene.shortPrompt, `saved-short-${idx}`, viewingStory._folderName, scene.sceneNumber)}
                                disabled={!!generatingId}
                                className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                              >
                                {generatingId === `saved-short-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                생성
                              </button>
                              <button
                                onClick={() => copyToClipboard(scene.shortPrompt)}
                                className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 hover:scale-105 transition-transform flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> 복사
                              </button>
                              <button
                                onClick={() => handleEnhanceSingle(0, idx, 'short', true)}
                                className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1"
                                title="이 프롬프트만 후처리"
                              >
                                <Sparkles className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">Short Prompt</label>
                              <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 rounded p-2 whitespace-pre-wrap">{scene.shortPrompt}</p>
                            </div>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Long Prompt</label>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleGenerateImage(scene.longPrompt, `saved-long-${idx}`, viewingStory._folderName, scene.sceneNumber)}
                                    disabled={!!generatingId}
                                    className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {generatingId === `saved-long-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                    생성
                                  </button>
                                  <button
                                    onClick={() => handleForwardPromptToImageAI(scene.longPrompt, `saved-long-ai-${idx}`, viewingStory, scene.sceneNumber)}
                                    disabled={!!aiForwardingId && aiForwardingId !== `saved-long-ai-${idx}`}
                                    className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {aiForwardingId === `saved-long-ai-${idx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    {aiForwardingId === `saved-long-ai-${idx}` ? '취소' : 'AI 생성'}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(scene.longPrompt)}
                                    className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 hover:scale-105 transition-transform flex items-center gap-1"
                                  >
                                    <Copy className="w-3 h-3" /> 복사
                                  </button>
                                  <button
                                    onClick={() => handleEnhanceSingle(0, idx, 'long', true)}
                                    className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1"
                                    title="이 프롬프트만 후처리"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 rounded p-2 whitespace-pre-wrap">{scene.longPrompt}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 분석 결과 */}
            {(viewingStory.analysis || analysis) && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">📊 대본 분석 결과</h3>

                {/* 점수 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  {[
                    { key: 'hook', label: '훅 강도', color: 'purple' },
                    { key: 'twist', label: '반전 효과', color: 'pink' },
                    { key: 'emotion', label: '감정 곡선', color: 'blue' },
                    { key: 'length', label: '길이', color: 'green' },
                    { key: 'viral', label: '바이럴', color: 'yellow' }
                  ].map(item => (
                    <div key={item.key} className={`bg-${item.color}-50 rounded-xl p-4 text-center`}>
                      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                        {(viewingStory.analysis || analysis)!.scores[item.key]}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>

                {/* 총점 */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-center mb-6">
                  <p className="text-white text-sm font-semibold mb-2">총점</p>
                  <p className="text-white text-5xl font-bold">
                    {(viewingStory.analysis || analysis)!.totalScore} / 50
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 강점 */}
                  <div>
                    <h4 className="font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                      ✅ 강점
                    </h4>
                    <ul className="space-y-2">
                      {(viewingStory.analysis || analysis)!.strengths.map((strength, idx) => (
                        <li key={idx} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 개선점 */}
                  <div>
                    <h4 className="font-bold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                      💡 개선점
                    </h4>
                    <ul className="space-y-2">
                      {(viewingStory.analysis || analysis)!.improvements.map((improvement, idx) => (
                        <li key={idx} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* 헤더 - 공간 축소 */}
            <div className="mb-2 pt-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  유튜브 쇼츠 대본 생성기
                </h1>
              </div>
            </div>

            {/* 설정 패널 */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4 mb-4">
              {/* 생성 모드 / 이미지 모델 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                      생성 모드 선택
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsModeTemplateModalOpen(true)}
                        className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-400 hover:text-purple-500 transition-colors"
                      >
                        설정
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'none', label: '선택안함', color: 'red' },
                      { key: 'script-only', label: '대본만', color: 'blue' },
                      { key: 'script-image', label: '대본+이미지', color: 'purple' }
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          const newMode = opt.key as 'none' | 'script-only' | 'script-image';
                          setGenerationMode(newMode);
                          // 양방향 동기화: 설정창도 같이 업데이트
                          if (defaultSettings?.onChange) {
                            defaultSettings.onChange({ ...defaultSettings, shortsGenerationMode: newMode });
                          }
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-all border ${generationMode === opt.key
                          ? opt.color === 'red'
                            ? 'bg-red-600 border-red-500 text-white shadow-md shadow-red-500/30'
                            : opt.color === 'blue'
                              ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                              : 'bg-purple-600 border-purple-500 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 장르 선택 */}
                {/* 장르 선택 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      <SparklesIcon className="w-4 h-4" />
                      장르 선택
                    </label>
                    <div className="flex gap-1">
                      <button
                        onClick={handlePreviewPrompt}
                        className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center gap-1 transition-colors"
                        title="현재 프롬프트 미리보기"
                      >
                        <Eye className="w-3 h-3" /> 미리보기
                      </button>
                      <button
                        onClick={() => setIsGenreManagerOpen(true)}
                        className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-1 transition-colors"
                        title="장르 관리"
                      >
                        <Settings2 className="w-3 h-3" /> 관리
                      </button>
                    </div>
                  </div>
                  <select
                    value={genre}
                    onChange={(e) => {
                      const newGenre = e.target.value;
                      setGenre(newGenre);
                      setAppStorageValue('shorts-generator-genre', newGenre);
                      // 양방향 동기화: 설정창도 같이 업데이트
                      if (defaultSettings?.onChange) {
                        defaultSettings.onChange({ ...defaultSettings, shortsGenre: newGenre });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {genres.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {genres.find((opt) => opt.id === genre)?.description || '장르를 선택하세요.'}
                  </p>
                </div>

                {/* 이미지 모델 선택 - 숨김 처리 */}
                <div className="hidden">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                    이미지 모델 선택
                    <button
                      onClick={handleRefreshModels}
                      disabled={isModelLoading}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1"
                      title="모델 목록 새로고침"
                    >
                      <RefreshCw className={`w-3 h-3 ${isModelLoading ? 'animate-spin' : ''}`} />
                      {isModelLoading ? '갱신 중...' : '새로고침'}
                    </button>
                  </label>
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 text-sm"
                  >
                    {availableModels.map((model, modelIdx) => (
                      <option key={`${model}-${modelIdx}`} value={model}>{model}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Google AI Studio에서 사용 가능한 모델 목록입니다.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 장르 선택 UI는 숨김 처리 (템플릿 편집은 다른 영역에서 접근) */}

                {/* 입력 옵션 */}
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      <Target className="w-4 h-4" />
                      타겟 연령
                    </label>
                    <select
                      value={target}
                      onChange={(e) => {
                        const newTarget = e.target.value;
                        setTarget(newTarget);
                        // 양방향 동기화: 설정창도 같이 업데이트
                        if (defaultSettings?.onChange) {
                          defaultSettings.onChange({ ...defaultSettings, targetAge: newTarget });
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      {targets.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      생성할 대본 수
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((count) => (
                        <button
                          key={count}
                          onClick={() => setScriptCount(count)}
                          className={`text-xs px-2 py-1 rounded-md font-semibold transition-all ${scriptCount === count
                            ? 'bg-teal-600 text-white shadow'
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                            }`}
                        >
                          {count}개
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      여성 캐릭터 의상 스타일
                    </label>
                    <select
                      value={femaleOutfit}
                      onChange={(e) => setFemaleOutfit(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors bg-white dark:bg-slate-900 text-sm text-gray-800 dark:text-gray-100"
                    >
                      <option value="0. 선택안함">0. 선택안함 (AI 자동)</option>
                      <option value="1. 모던 시크 (Modern Chic)">1. 모던 시크 (Modern Chic) - 랜덤</option>
                      <option value="2. 글래머 & 파티 (Glamour & Party)">2. 글래머 & 파티 (Glamour & Party) - 랜덤</option>
                      <option value="3. 액티비티 & 럭셔리 (Activity & Luxury)">3. 액티비티 & 럭셔리 (Activity & Luxury) - 랜덤</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* [NEW] Identity Lock Section (Cineboard Style) */}
              <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                      <Lock size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">Identity Lock</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">모든 장면에서 캐릭터의 시각적 일관성을 강제로 유지합니다.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAddIdentity}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-purple-600 dark:text-purple-400 hover:border-purple-500 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus size={14} /> 캐릭터 추가
                  </button>
                </div>

                {identities.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {identities.map((identity) => (
                      <ShortsIdentityCard
                        key={identity.id}
                        identity={identity}
                        onUpdate={handleUpdateIdentity}
                        onDelete={handleDeleteIdentity}
                        outfitPresets={SHORTFORM_OUTFIT_LIST}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                    <p className="text-sm text-slate-400">설정된 캐릭터가 없습니다. [캐릭터 추가]를 눌러 정체성을 고정하세요.</p>
                  </div>
                )}
              </div>

              {/* 소재 입력 */}
              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">

                  소재 / 키워드 (자극적이고 구체적일수록 좋아요!)
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => {
                    const newTopic = e.target.value;
                    setTopic(newTopic);
                    // 양방향 동기화: 설정창도 같이 업데이트
                    if (defaultSettings?.onChange) {
                      defaultSettings.onChange({ ...defaultSettings, customContext: newTopic });
                    }
                  }}
                  placeholder="예: 시어머니의 충격적인 비밀, 남편의 이중생활, 친구의 배신과 복수"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-purple-500 focus:outline-none transition-colors bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100"
                />
              </div>

              {/* 생성 버튼 + 수동 가져오기 버튼 */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={generateScript}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold text-base hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      AI가 대본을 작성하고 있습니다...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      대본 {scriptCount}개 생성하기
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="px-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 py-3 rounded-lg font-semibold text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {showManualInput ? '입력창 닫기' : '수동 가져오기'}
                </button>
              </div>

              {loading && (
                <button
                  onClick={handleForceStop}
                  className="w-full mt-3 bg-red-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-red-500 transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  <X className="w-5 h-5" />
                  강제로 중지하기
                </button>
              )}

              {/* 이미지 히스토리 버튼 */}
              <div className="mt-3">
                <button
                  onClick={() => setShowImageHistory(!showImageHistory)}
                  className="w-full bg-white dark:bg-slate-900/70 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 py-2 rounded-lg font-semibold text-xs hover:bg-white dark:bg-slate-900 transition-all flex items-center justify-center gap-2"
                >
                  <HistoryIcon className="w-4 h-4" />
                  {showImageHistory ? '이미지 히스토리 숨기기' : '이미지 히스토리 보기'}
                </button>
              </div>

              {/* 수동 입력 패널 */}
              {showManualInput && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-gray-300">
                  <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    JSON 데이터 붙여넣기
                  </label>
                  <textarea
                    value={manualJson}
                    onChange={(e) => setManualJson(e.target.value)}
                    placeholder='{"scripts": [...]} 형식의 JSON을 여기에 붙여넣으세요.'
                    className="w-full h-32 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 text-sm font-mono mb-3"
                  />
                  <button
                    onClick={handleManualImport}
                    className="w-full bg-slate-700 text-white py-2 rounded-lg font-bold hover:bg-slate-800 transition-all"
                  >
                    가져오기 적용
                  </button>
                </div>
              )}
            </div>

            {/* 생성된 대본들 */}
            {scripts.length > 0 && (
              <div className="grid grid-cols-1 gap-4 mb-4">
                {scripts.map((script, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-4 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold mb-2">
                          버전 {script.version}
                        </span>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{script.title}</h3>
                      </div>
                      <span className="text-sm text-gray-500">{script.length}자</span>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-4">
                      <p className="text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
                        {(script.script || script.scriptBody || '').split('/').map((line: string, i: number) => (
                          <span key={i} className="block mb-2">
                            {line.trim()}
                            {i < (script.script || script.scriptBody || '').split('/').length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">🎣 오프닝 훅</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{script.hook || script.openingHook || '정보 없음'}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">💥 반전/펀치라인</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{script.twist || script.punchline || '정보 없음'}</p>
                      </div>
                    </div>

                    {/* 이미지 프롬프트 (접기/펼치기 + 복사/생성) */}
                    {script.scenes && script.scenes.length > 0 && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 mb-4">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setShowImagePrompts(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowImagePrompts(prev => ({ ...prev, [idx]: !prev[idx] })); }}
                          className="w-full flex items-center justify-between text-left font-bold text-purple-800 dark:text-purple-300 mb-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span>이미지 프롬프트 (총 {script.scenes.length}장)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-700 dark:text-purple-300 font-mono">
                              Model: {imageModel}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleEnhanceAll(idx, false); }}
                              className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-500 flex items-center gap-1"
                              title="모든 프롬프트에 한국인/고화질 태그 강제 적용"
                            >
                              <Sparkles className="w-3 h-3" />
                              전체 후처리
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); copyAllLongPrompts(idx); }}
                              className="text-xs px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 border border-purple-500 flex items-center gap-1"
                              title="모든 롱프롬프트를 한번에 복사"
                            >
                              <Copy className="w-3 h-3" />
                              롱프롬프트 전체 복사
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setNoGuard(!noGuard); }}
                              className={`text-xs px-2 py-1 rounded border ${noGuard ? 'bg-red-500/10 text-red-500 border-red-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-300'}`}
                            >
                              {noGuard ? '검열 해제' : '안전 필터'}
                            </button>
                            {showImagePrompts[idx] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>

                        {showImagePrompts[idx] && (
                          <div className="space-y-4">
                            {script.scenes.map((scene: any, sIdx: number) => (
                              <div key={sIdx} className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                                <div className="flex-1">
                                  <h4 className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                                    장면 #{scene.sceneNumber}
                                    <span className="ml-2 font-normal text-gray-500 text-xs">
                                      {scene.shortPromptKo}
                                    </span>
                                  </h4>
                                </div>
                                {/* 
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">장면 #{scene.sceneNumber || sIdx + 1}</span>
                                    <span className="text-xs text-gray-500">{scene.shortPromptKo}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleGenerateImage(scene.shortPrompt, `short-${idx}-${sIdx}`)}
                                      disabled={!!generatingId}
                                      className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {generatingId === `short-${idx}-${sIdx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                      생성
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(scene.shortPrompt)}
                                      className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 hover:scale-105 transition-transform flex items-center gap-1"
                                    >
                                      <Copy className="w-3 h-3" /> 복사
                                    </button>
                                    <button
                                      onClick={() => handleEnhanceSingle(idx, sIdx, 'short', false)}
                                      className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1"
                                      title="이 프롬프트만 후처리"
                                    >
                                      <Sparkles className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                */}

                                {/* Short Prompt */}
                                <div className="space-y-3">
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Short Prompt</label>
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50" title="Long Prompt가 정책 위반으로 차단될 때 자동으로 사용됩니다">
                                          🛡️ 정책 우회용
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleGenerateImage(scene.shortPrompt, `short-${idx}-${sIdx}`)}
                                          disabled={!!generatingId}
                                          className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                        >
                                          {generatingId === `short-${idx}-${sIdx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                          생성
                                        </button>
                                        <button
                                          onClick={() => copyToClipboard(scene.shortPrompt)}
                                          className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 flex items-center gap-1"
                                        >
                                          <Copy className="w-3 h-3" /> 복사
                                        </button>
                                        <button
                                          onClick={() => handleEnhanceSingle(idx, sIdx, 'short', false)}
                                          className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1"
                                          title="이 프롬프트만 후처리"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <textarea
                                      value={scene.shortPrompt}
                                      onChange={(e) => {
                                        const newScripts = [...scripts];
                                        newScripts[idx].scenes[sIdx].shortPrompt = e.target.value;
                                        setScripts(newScripts);
                                      }}
                                      className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg p-2 focus:border-purple-500 focus:outline-none resize-none h-20"
                                    />
                                  </div>

                                  {/* Long Prompt */}
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Long Prompt</label>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleGenerateImage(scene.longPrompt, `long-${idx}-${sIdx}`)}
                                          disabled={!!generatingId}
                                          className="px-2 py-1 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                                        >
                                          {generatingId === `long-${idx}-${sIdx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
                                          생성
                                        </button>
                                        <button
                                          onClick={() => handleForwardPromptToImageAI(scene.longPrompt, `long-ai-${idx}-${sIdx}`, idx, sIdx)}
                                          disabled={!!aiForwardingId}
                                          className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                        >
                                          {aiForwardingId === `long-ai-${idx}-${sIdx}` ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                          AI 생성
                                        </button>
                                        <button
                                          onClick={() => copyToClipboard(scene.longPrompt)}
                                          className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 hover:scale-105 transition-transform flex items-center gap-1"
                                        >
                                          <Copy className="w-3 h-3" /> 복사
                                        </button>
                                        <button
                                          onClick={() => handleEnhanceSingle(idx, sIdx, 'long', false)}
                                          className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1"
                                          title="이 프롬프트만 후처리"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <textarea
                                      value={scene.longPrompt}
                                      onChange={(e) => {
                                        const newScripts = [...scripts];
                                        newScripts[idx].scenes[sIdx].longPrompt = e.target.value;
                                        setScripts(newScripts);
                                      }}
                                      className="w-full text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg p-2 focus:border-purple-500 focus:outline-none resize-none h-24"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(script.script || script.scriptBody)}
                        className="flex-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        복사하기
                      </button>
                      <button
                        onClick={() => analyzeScript(script.script || script.scriptBody)}
                        disabled={loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        대본 분석하기
                      </button>
                      {onSave && (
                        <button
                          onClick={() => onSave({ ...script, analysis })}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors"
                        >
                          보관함에 저장
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 분석 결과 */}
            {(() => {
              const currentAnalysis = viewingStory?.analysis || analysis;
              if (!currentAnalysis) return null;

              const isYoutube = currentAnalysis.type === 'youtube';
              // Type assertion for easier access within the block, safe because of the check
              const youtubeData = isYoutube ? (currentAnalysis as import('./types').YouTubeAnalysis) : null;
              const scriptData = !isYoutube ? (currentAnalysis as import('./types').ScriptAnalysis) : null;
              const scoreCardStyles: Record<string, string> = {
                purple: 'bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-700/60',
                pink: 'bg-pink-50 dark:bg-pink-900/30 border border-pink-100 dark:border-pink-700/60',
                blue: 'bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700/60',
                yellow: 'bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-100 dark:border-yellow-700/60',
                green: 'bg-green-50 dark:bg-green-900/30 border border-green-100 dark:border-green-700/60'
              };

              return (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                    {isYoutube ? '📺 유튜브 영상 분석 결과' : '📊 대본 분석 결과'}
                  </h3>

                  {/* YouTube Video Info */}
                  {youtubeData && (
                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 mb-6 flex items-start gap-4">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                          {youtubeData.videoInfo.title}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span>{youtubeData.videoInfo.channel}</span>
                          <span>👁️ {youtubeData.videoInfo.views}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 점수 */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {isYoutube ? (
                      // YouTube Analysis Scores
                      [
                        { key: 'hook', label: '훅 강도', color: 'purple' },
                        { key: 'immersion', label: '몰입도', color: 'blue' },
                        { key: 'twist', label: '반전 효과', color: 'pink' },
                        { key: 'popularity', label: '대중성', color: 'yellow' },
                        { key: 'completeness', label: '완성도', color: 'green' }
                      ].map(item => (
                        <div
                          key={item.key}
                          className={`${scoreCardStyles[item.color] || 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'} rounded-xl p-4 text-center`}
                        >
                          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {youtubeData!.scores[item.key as keyof typeof youtubeData.scores]}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.label}</p>
                        </div>
                      ))
                    ) : (
                      // Script Analysis Scores
                      [
                        { key: 'hook', label: '훅 강도', color: 'purple' },
                        { key: 'twist', label: '반전 효과', color: 'pink' },
                        { key: 'emotion', label: '감정 곡선', color: 'blue' },
                        { key: 'length', label: '길이', color: 'green' },
                        { key: 'viral', label: '바이럴', color: 'yellow' }
                      ].map(item => (
                        <div
                          key={item.key}
                          className={`${scoreCardStyles[item.color] || 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'} rounded-xl p-4 text-center`}
                        >
                          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {scriptData!.scores[item.key as keyof typeof scriptData.scores]}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.label}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 총점 */}
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-center mb-6">
                    <p className="text-white text-sm font-semibold mb-2">총점</p>
                    <p className="text-white text-5xl font-bold">
                      {currentAnalysis.totalScore} / {isYoutube ? 10 : 50}
                    </p>
                  </div>

                  {/* YouTube Analysis Details */}
                  {youtubeData ? (
                    <div className="space-y-6">
                      {/* Viral Factor */}
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="font-bold text-yellow-800 dark:text-yellow-400 mb-2 flex items-center gap-2">
                          🚀 성공 요인 (Viral Factor)
                        </h4>
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
                          {youtubeData.analysis.viralFactor}
                        </p>
                      </div>

                      {/* Structure Analysis */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
                          <h5 className="font-bold text-purple-800 dark:text-purple-400 mb-2 text-sm">🎣 Hook (초반)</h5>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{youtubeData.analysis.structure.hook}</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                          <h5 className="font-bold text-blue-800 dark:text-blue-400 mb-2 text-sm">👀 Retention (중반)</h5>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{youtubeData.analysis.structure.retention}</p>
                        </div>
                        <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4">
                          <h5 className="font-bold text-pink-800 dark:text-pink-400 mb-2 text-sm">💥 Payoff (결말)</h5>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{youtubeData.analysis.structure.ending}</p>
                        </div>
                      </div>

                      {/* Benchmarks */}
                      <div>
                        <h4 className="font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                          ✅ 벤치마킹 포인트
                        </h4>
                        <ul className="space-y-2">
                          {youtubeData.benchmarks.map((point: string, idx: number) => (
                            <li key={idx} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                              <span className="text-green-600 font-bold">{idx + 1}.</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    // Script Analysis Details (Existing)
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 강점 */}
                      <div>
                        <h4 className="font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                          ✅ 강점
                        </h4>
                        <ul className="space-y-2">
                          {currentAnalysis.strengths?.map((strength: string, idx: number) => (
                            <li key={idx} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* 개선점 */}
                      <div>
                        <h4 className="font-bold text-orange-700 dark:text-orange-400 mb-3 flex items-center gap-2">
                          💡 개선점
                        </h4>
                        <ul className="space-y-2">
                          {currentAnalysis.improvements?.map((improvement: string, idx: number) => (
                            <li key={idx} className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300">
                              {improvement}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* YouTube Analysis Input Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 mb-6 border border-purple-100 dark:border-purple-900">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                📺 유튜브 쇼츠 분석하기
              </h3>
              <div className="flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="분석하고 싶은 유튜브 쇼츠 URL을 입력하세요 (예: https://youtube.com/shorts/...)"
                  className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:outline-none bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-100 text-sm"
                />
                <button
                  onClick={handleAnalyzeYoutube}
                  disabled={isAnalyzingYoutube}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAnalyzingYoutube ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-4 h-4" />
                      분석하기
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                * 영상의 자막과 메타데이터를 추출하여 성공 요인을 정밀 분석합니다. (자막이 없는 영상은 분석이 제한될 수 있습니다)
              </p>
            </div>

            {/* 사용 팁 */}
            {scripts.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">💡 효과적인 대본 생성 팁</h3>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">1.</span>
                    <span><strong>충격적이고 자극적인 소재</strong>를 입력하세요. "비밀" 보다는 "남편의 충격적인 이중생활"이 더 좋습니다.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">2.</span>
                    <span><strong>반전이 2번 이상</strong> 들어가는 대본이 바이럴됩니다. 예상을 계속 뒤집으세요.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">3.</span>
                    <span><strong>디테일한 상황</strong>을 넣으면 몰입도가 높아집니다. "화났다" 보다 "얼굴이 새빨개져서 손을 떨었다"가 좋습니다.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 font-bold">4.</span>
                    <span>생성된 대본의 <strong>첫 3초가 가장 중요</strong>합니다. 훅이 약하면 수정하세요.</span>
                  </li>
                </ul>
              </div>
            )}
          </>
        )}
      </div>
      <ShortsImageHistorySidebar
        show={showImageHistory}
        favoritesOnly={showFavoritesOnly}
        setFavoritesOnly={setShowFavoritesOnly}
        onClose={() => setShowImageHistory(false)}
        imageHistory={imageHistory}
        historyUrls={historyUrls}
        onToggleFavorite={toggleFavorite}
        onCopyPrompt={(prompt, e) => {
          e.stopPropagation();
          copyToClipboard(prompt);
        }}
        onDelete={handleDeleteHistoryItem}
        onSelectImage={(url, item) => {
          setLightboxImageUrl(url);
          setLightboxItem(item);
        }}
        onRefresh={handleRefreshHistory}
      />
      <TemplateEditorModal isOpen={isTemplateEditorOpen} onClose={() => setIsTemplateEditorOpen(false)} manager={templateManager} />
      <ModeTemplateSettingsModal
        isOpen={isModeTemplateModalOpen}
        templates={modeTemplates}
        onClose={() => setIsModeTemplateModalOpen(false)}
        onSave={handleSaveModeTemplateSettings}
        onReset={handleResetModeTemplateSettings}
      />
      {/* Genre Manager Modal v2 (Split View) */}
      {
        isGenreManagerOpen && createPortal(
          <div className={darkMode ? "dark" : ""}>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200 text-slate-900 dark:text-slate-100">
              <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                      <Settings2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-white">장르 스타일 관리자</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">변경사항을 수정한 후 반드시 [저장] 버튼을 눌러주세요.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetGenres}
                      className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-1"
                      title="모든 설정을 초기화합니다"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      초기화
                    </button>
                    <button
                      onClick={() => setIsGenreManagerOpen(false)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Body (Split View) */}
                <div className="flex-1 flex overflow-hidden">

                  {/* Left Sidebar: List */}
                  <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                      <button
                        onClick={handleAddNewGenre}
                        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
                      >
                        <Plus className="w-5 h-5" />
                        새 장르 추가
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {genres.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => setSelectedGenreId(g.id)}
                          className={`p-3 rounded-xl cursor-pointer transition-all border ${selectedGenreId === g.id
                            ? 'bg-white dark:bg-slate-800 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                            : 'hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                            }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-bold ${selectedGenreId === g.id ? 'text-purple-600 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                              {g.name}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${g.isCustom
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                              }`}>
                              {g.isCustom ? '커스텀' : '기본'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{g.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Content: Editor */}
                  <div className="w-2/3 bg-white dark:bg-slate-900 p-6 flex flex-col overflow-y-auto">
                    {selectedGenreId && editingGenre ? (
                      <>
                        {/* Editor Header */}
                        <div className="flex justify-between items-end mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">장르 상세 편집</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {genres.find(g => g.id === selectedGenreId)?.isCustom
                                ? '커스텀 장르 설정을 수정합니다.'
                                : '기본 장르 설정을 수정합니다. (주의: 원본이 변경됩니다)'}
                            </p>
                          </div>
                          {/* 삭제 버튼 - 모든 장르 삭제 가능 */}
                          <button
                            onClick={() => handleDeleteGenre(selectedGenreId)}
                            className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            삭제
                          </button>
                        </div>

                        {/* Form */}
                        <div className="space-y-5 flex-1 flex flex-col">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">장르 이름</label>
                              <input
                                type="text"
                                value={editingGenre.name}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                placeholder="장르 이름을 입력하세요"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">장르 ID</label>
                              <input
                                type="text"
                                value={selectedGenreId}
                                disabled
                                className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">설명 (UI 표시용)</label>
                            <input
                              type="text"
                              value={editingGenre.description}
                              onChange={(e) => handleFieldChange('description', e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                              placeholder="간단한 설명을 입력하세요"
                            />
                          </div>

                          <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">시스템 프롬프트 설정</label>
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/20">AI 지침</span>
                            </div>
                            <div className="relative flex-1">
                              <textarea
                                value={editingGenre.prompt}
                                onChange={(e) => handleFieldChange('prompt', e.target.value)}
                                className="w-full h-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm text-slate-800 dark:text-slate-300 font-mono leading-relaxed focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">* {'{{TOPIC}}'}, {'{{TARGET_LABEL}}'} 등의 변수를 사용하여 동적으로 내용을 구성할 수 있습니다.</p>
                          </div>

                          {/* Footer Actions */}
                          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                            <button
                              onClick={() => setIsGenreManagerOpen(false)}
                              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              취소
                            </button>
                            <button
                              onClick={handleSaveGenreChanges}
                              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-900/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                            >
                              <Save className="w-4 h-4" />
                              변경사항 저장
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <Layout className="w-16 h-16 mb-4 opacity-20" />
                        <p>좌측 목록에서 장르를 선택하거나<br />새 장르를 추가해주세요.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* Prompt Preview Modal */}
      {
        isPromptPreviewOpen && createPortal(
          <div className={darkMode ? "dark" : ""}>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200 text-slate-900 dark:text-slate-100">
              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5 text-blue-500" />
                    프롬프트 미리보기
                  </h3>
                  <button onClick={() => setIsPromptPreviewOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 p-0 overflow-hidden relative">
                  <textarea
                    readOnly
                    value={previewContent}
                    className="w-full h-full p-4 bg-slate-900 text-green-400 font-mono text-xs resize-none focus:outline-none"
                  />
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
                  <button
                    onClick={() => setIsPromptPreviewOpen(false)}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-bold"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
};

export default ShortsScriptGenerator;

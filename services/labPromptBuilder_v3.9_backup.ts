import { UNIFIED_OUTFIT_LIST } from '../constants';

// 1. 장르 데이터
export interface LabGenreGuideline {
  name: string;
  description: string;
  emotionCurve: string;
  structure: string;
  killerPhrases: string[];
  bodyReactions: string[];
  forbiddenPatterns: string[];
}

export const LAB_GENRE_GUIDELINES: Record<string, LabGenreGuideline> = {
  'comedy-humor': {
    name: '코미디 / 유머',
    description: '사소한 오해나 실수로 망가지는 상황. 생생한 표정과 역동적인 포즈가 핵심.',
    emotionCurve: '😊 평화 → 😳 당황 → 😱 충격 → 🤦 민망 → 😂 자폭 웃음',
    structure: 'Hook -> Setup -> Buildup -> Climax -> Twist -> Outro',
    killerPhrases: ['드디어 올 게 왔구나 싶었지', '심장이 철렁 내려앉더라고'],
    bodyReactions: ['얼굴이 화끈거렸어', '동공이 지진 난 것처럼 떨렸어'],
    forbiddenPatterns: ['지나치게 진지한 분위기']
  },
  'romance-flutter': {
    name: '로맨스/설렘',
    description: '중년의 설렘. 첫사랑 감성, 권태기 부부의 재발견.',
    emotionCurve: '😐 무덤덤 → 👀 의식됨 → 💓 두근 → 🤔 궁금함',
    structure: 'Hook -> Setup -> Buildup -> Climax -> Twist -> Outro',
    killerPhrases: ['오늘따라 왜 이러지', '원래 이랬나?'],
    bodyReactions: ['심장이 갑자기 빨라졌어', '손끝이 미세하게 떨렸어'],
    forbiddenPatterns: ['키스/신체접촉 직접 묘사']
  },
  'affair-suspicion': {
    name: '불륜/외도 의심',
    description: '배우자의 수상한 행동 → 의심 폭발 → 건전한 반전.',
    emotionCurve: '🤨 수상함 → 😠 의심 → 😮 반전 → 😅 안도',
    structure: 'Hook -> Setup -> Buildup -> Climax -> Twist -> Outro',
    killerPhrases: ['이거 뭐야?', '솔직히 말해봐'],
    bodyReactions: ['손이 벌벌 떨렸어', '다리에 힘이 풀렸어'],
    forbiddenPatterns: ['실제 불륜 확정']
  },
  'hit-twist-spicy': {
    name: '대박 반전 (매운맛)',
    description: '성적 뉘앙스로 오해받는 상황 → 알고보니 완전 건전.',
    emotionCurve: '😏 뭔가 야해...? → 😳 당황 → 😱 헐 설마 → 🤣 뭐야 아니잖아',
    structure: 'Hook -> Setup -> Buildup -> Climax -> Twist -> Outro',
    killerPhrases: ['조금만 더요', '너무 꽉 조여요'],
    bodyReactions: ['얼굴이 새빨개졌어', '식은땀이 줄줄 났어'],
    forbiddenPatterns: ['실제 성적 상황 묘사']
  }
};

// 2. 캐릭터 프리셋 (마마님 특명)
export const MAMA_CHARACTER_PRESETS = {
  FEMALE_A: {
    identity: 'A stunning Korean woman',
    bodyType: 'Extraordinarily high-projection perky bust with high-seated chest line, voluptuous hourglass figure',
    style: 'sophisticated look, long soft-wave hair'
  },
  MALE_A: {
    identity: 'A handsome Korean man',
    bodyType: 'fit athletic build with broad shoulders',
    style: 'dandy style, short neat hair'
  }
};

// 3. 겨울 로직 및 변환
export const convertToTightLongSleeveWithShoulderLine = (outfit: string): string => {
  if (!outfit) return outfit;
  let nt = outfit;
  const ks = ['Sleeveless', 'Halter-neck', 'Short-sleeve', 'Cowl-neck', 'Twist Front', 'One-shoulder'];
  ks.forEach(k => {
    if (new RegExp(k, 'i').test(nt)) nt = nt.replace(new RegExp(k, 'i'), `Off-shoulder tight-fitting long-sleeve ${k}`);
  });
  if (nt.toLowerCase().includes('deep v-neck')) nt = nt.replace(/deep v-neck/gi, 'Elegant Mock-neck tight-fitting long-sleeve');
  return nt;
};

// 4. UI 유틸리티 (대본 생성 및 보강)
export const extractNegativePrompt = (prompt: string) => ({ cleaned: prompt || '', negative: 'no text, no watermark' });
export const validateAndFixPrompt = (p: string) => p;
export const enhanceScenePrompt = (t: string, o: any = {}) => ({ fixedPrompt: t, explanation: "v3.9.8 최적화 적용" });
export const isWinterTopic = (t: string) => ['눈', '겨울', 'snow', 'winter'].some(k => t.toLowerCase().includes(k));
export const applyWinterLookToExistingPrompt = (p: string, pk: string) => ({ longPrompt: p, longPromptKo: pk });

export const buildLabScriptPrompt = (options: any): string => {
  const genre = LAB_GENRE_GUIDELINES[options.genre] || LAB_GENRE_GUIDELINES['comedy-humor'];
  const narrator = options.gender === 'female' ? 'Woman A (지영)' : 'Man A (준호)';
  const bodyA = MAMA_CHARACTER_PRESETS.FEMALE_A.bodyType;
  const bodyM = MAMA_CHARACTER_PRESETS.MALE_A.bodyType;

  return `
🚨 [MAMA'S MASTER INSTRUCTION v3.9.8] 🚨
[CONTEXT] Create a viral YouTube Shorts script about "${options.topic}".
[GENRE] ${genre.name}: ${genre.description}
[EMOTION] ${genre.emotionCurve}
[STRUCTURE] ${genre.structure}
[CHARACTERS]
- WomanA (지영): ${bodyA}, sophisticated wave hair.
- ManA (준호): ${bodyM}, dandy style.
[RULES]
1. Use 10-12 punchy sentences in spoken Korean (~했어, ~지, ~더라고).
2. OUTPUT ONLY VALID JSON.
3. Every scene MUST include character consistency.
[JSON SCHEMA]
{
  "title": "string",
  "scriptBody": "string (newlines included)",
  "punchline": "string",
  "scenes": [{"sceneNumber": 1, "longPrompt": "string", "longPromptKo": "string"}]
}
`;
};

// 하위 호환성 함수
export const pickMaleOutfit = () => 'Navy Polo + White Pants';
export const pickFemaleOutfit = () => 'White Knit + Red Skirt';
export const getStoryStageBySceneNumber = (s: number) => 'hook';
export const getExpressionForScene = () => 'smiling';
export const getCameraPromptForScene = () => 'close-up';
export const translateActionToEnglish = (a: string) => a;
export const enforceKoreanIdentity = (t: string) => t;
export const applyWinterItems = (o: string, ow: string, a: string[]) => o;
export const selectWinterItems = () => ({ outerwear: '', accessories: [] });


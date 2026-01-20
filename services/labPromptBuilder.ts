/**
 * labPromptBuilder.ts
 * 쇼츠랩 전용 경량화 프롬프트 빌더
 * 
 * v2.3 업데이트 (2026-01-18):
 * - 예시 제거 → 구조/공식만 제공
 * - 랜덤 시드 시스템 추가 (창작 다양성)
 * - 의상 카테고리 단순화 (SEXY / NORMAL)
 * - 씬보드/쇼츠생성기 호환 JSON 스키마
 * - 투샷/쓰리샷 규칙 강화 (의상 전체 명시, 헤어 필수)
 * - 체형 표현 안전하게 변경 (정책 위반 방지)
 * - 마네킹/애니메이션 방지 키워드 추가
 */

import { UNIFIED_OUTFIT_LIST } from '../constants';

// ============================================
// 타입 정의
// ============================================

export interface LabScriptOptions {
  topic: string;
  genre: string;
  targetAge: string;
  gender: 'female' | 'male';
  additionalContext?: string;
}

export interface LabImagePromptOptions {
  sceneText: string;
  characterGender: 'female' | 'male';
  characterAge: string;
  bodyType: string;
  outfit: string;
  style: string;
  includeQualityTags: boolean;
  includeAspectRatio: boolean;
}

// ============================================
// 마마님 취향 반영 캐릭터 프리셋
// ============================================

export const MAMA_CHARACTER_PRESETS = {
  FEMALE: {
    identity: 'A stunningly beautiful and glamorous Korean woman',
    bodyType: 'perfectly managed slim hourglass figure with toned body, curvy feminine figure, glamorous and sophisticated silhouette, elegant feminine curves',
    style: 'high-end fashion model aesthetics, well-managed sophisticated look despite age, elegant and confident presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally and elegantly'
  },
  MALE: {
    identity: 'Korean man',
    bodyType: '',
    style: '',
    outfitFit: ''
  }
};

// ============================================
// 이미지 프롬프트 고정 문구 (절대 생략 금지)
// ============================================

export const PROMPT_CONSTANTS = {
  // 시작 문구 (리얼리즘 강조)
  START: 'unfiltered raw photograph, 8k ultra photorealism, ultra detailed skin texture with visible pores and natural skin imperfections, professional cinematic lighting, RAW photo, real human skin texture, candid photography style',

  // 여성 체형 필수 문구 (정책 위반 방지 버전)
  FEMALE_BODY: 'perfectly managed slim hourglass figure with toned body, curvy feminine figure, glamorous and sophisticated silhouette, elegant feminine curves, high-end fashion model aesthetics, tight-fitting clothes accentuating curves naturally and elegantly',

  // 남성 체형 필수 문구
  MALE_BODY: 'Korean man',

  // 종결 문구
  END: 'high-fashion editorial refined, depth of field, shot on 85mm lens, f/1.8, realistic soft skin, 8k ultra-hd, no text, no captions, no typography, --ar 9:16',

  // 금지 키워드 (마네킹/애니메이션 방지)
  NEGATIVE: 'NOT cartoon, NOT anime, NOT 3D render, NOT CGI, NOT plastic skin, NOT mannequin, NOT doll-like, NOT airbrushed, NOT overly smooth skin, NOT uncanny valley, NOT artificial looking, NOT illustration, NOT painting, NOT drawing'
};

// ============================================
// 강화된 장르 지침 (쇼츠랩 전용) - 예시 제거, 구조만
// ============================================

export const LAB_GENRE_GUIDELINES: Record<string, {
  name: string;
  structure: string;
  killerPhrases: string[];
  forbiddenPatterns: string[];
}> = {
  'comedy-humor': {
    name: '코미디/유머',
    structure: `
[HOOK] (장소) + (황당한 일 예고) → '오늘 (장소)에서 진짜 (감정) 일 있었어'
[SETUP] (평범한 시작) → '(행동)하고 있었는데...'
[BUILD-UP] (상황 꼬임) + (상대 반응) → '근데 문제는...', '하필이면...'
[CLIMAX] (터지는 순간) + (킬러 대사) → 구체적 행동/표정 묘사
[TWIST] (반전) → '알고보니...', '그래서 결국...'
`,
    killerPhrases: [
      '이게 뭐야 진짜',
      '아 진짜 미치겠네',
      '헐, 뭐라고?',
      '그 순간 눈이 마주쳤는데',
      '알고보니...',
      '근데 문제는',
      '하필이면',
      '그러게 왜'
    ],
    forbiddenPatterns: [
      '얼굴이 빨개졌다',
      '심장이 터질 것 같았다',
      '나이스샷 오해',
      '쌍둥이 반전',
      '흰 가루 오해'
    ]
  },

  'romance-flutter': {
    name: '로맨스/설렘',
    structure: `
[HOOK] (평소와 다른 느낌) → '오늘따라 왜 이러지', '뭔가 달랐어'
[SETUP] (일상적 만남) → '평소처럼 (행동)하는데...'
[BUILD-UP] (물리적/감정적 거리 좁혀짐) → 시선, 손끝, 목소리 변화 묘사
[CLIMAX] (의미심장한 순간) → 짧은 대사 + 행동
[TWIST] (혼란/여운) → '나만 이런 건가', '뭔가 있는 건가'
`,
    killerPhrases: [
      '오늘따라 왜 이러지',
      '시선을 어디 둘지 몰랐어',
      '손끝이 미세하게 떨렸지',
      '그 한마디에 멈췄어',
      '나만 이런 건가',
      '괜히 의식됐어',
      '목소리가 작아졌어'
    ],
    forbiddenPatterns: [
      '심장이 쿵쾅쿵쾅',
      '얼굴이 달아올랐다',
      '첫눈에 반했다',
      '운명 같은 만남',
      '그립 잡아주기'
    ]
  },

  'affair-suspicion': {
    name: '불륜/외도 의심',
    structure: `
[HOOK] (충격적 발견) → '(물건)에서 (이상한 것)이 나왔어', '뭔가 이상해'
[SETUP] (최근 정황) → '요즘 좀 (이상한 행동)하긴 했어...'
[BUILD-UP] (의심 증폭) → 증거 수집, 내면 독백
[CLIMAX] (대면/추궁) → 짧고 날카로운 대사
[TWIST] (건전한 반전) → '알고보니 (선물/서프라이즈)였어'
`,
    killerPhrases: [
      '이거 뭐야?',
      '요즘 좀 이상하지 않아?',
      '솔직히 말해봐',
      '내가 다 알아',
      '알고보니...',
      '설마 했는데',
      '뭔가 숨기는 거 있지'
    ],
    forbiddenPatterns: [
      '실제 불륜 확정',
      '이혼 결심',
      '폭력적 대응',
      '영수증 발견 패턴',
      '귀걸이 발견 패턴'
    ]
  },

  'hit-twist-spicy': {
    name: '대박 반전 (매운맛)',
    structure: `
[HOOK] (오해 유발 대사) → 이중 의미 대사로 시작
[SETUP] (아슬아슬한 상황) → 좁은 공간, 가까운 거리
[BUILD-UP] (오해 극대화) → 들리면 오해할 대사들 연속
[CLIMAX] (목격/등장) → 제3자 반응
[TWIST] (건전한 진실) → '알고보니 (일상적인 행동)이었어'
`,
    killerPhrases: [
      '조금만 더...',
      '너무 꽉 조여요',
      '금방 끝나요',
      '누가 보면 어떡해',
      '알고보니...',
      '이게 아닌데',
      '오해예요!'
    ],
    forbiddenPatterns: [
      '실제 성적 상황',
      '노출 묘사',
      '신체 접촉 직접 묘사',
      '장갑 끼워주기 패턴'
    ]
  }
};

// ============================================
// 랜덤 시드 키워드 (창작 다양성 확보)
// ============================================

export const RANDOM_SEED_POOLS = {
  locations: [
    '엘리베이터', '주차장', '라커룸', '카페', '마트',
    '미용실', '헬스장', '식당', '공원', '백화점',
    '편의점', '병원 대기실', '영화관', '호텔 로비', '공항',
    '사우나', '네일샵', '세차장', '꽃집', '약국'
  ],
  objects: [
    '립스틱', '영수증', '향수', '머리카락', '문자메시지',
    '사진', '카드명세서', '선글라스', '손수건', '열쇠',
    '귀걸이', '넥타이', '명함', '쇼핑백', '꽃다발',
    '초콜릿', '와인', '책', '운동화', '시계'
  ],
  reactions: [
    '기침', '한숨', '멈칫', '눈 피함', '손 떨림',
    '말 더듬', '헛웃음', '침묵', '눈 커짐', '입 벌림',
    '고개 돌림', '핸드폰 확인', '물 마심', '기지개', '하품'
  ],
  misunderstandings: [
    '바람피는 줄', '싸우는 줄', '고백하는 줄', '헤어지는 줄',
    '비밀 있는 줄', '거짓말하는 줄', '숨기는 줄', '화난 줄',
    '울고 있는 줄', '아픈 줄', '취한 줄', '졸린 줄'
  ],
  truths: [
    '서프라이즈 준비', '선물 고르는 중', '깜짝 파티 계획',
    '다이어트 중', '이직 준비', '자격증 공부',
    '부모님 용돈', '기부 활동', '재테크 공부', '운동 시작'
  ]
};

/**
 * 랜덤 시드 생성 - 매번 다른 조합으로 창작 유도
 */
export const generateRandomSeed = (): {
  location: string;
  object: string;
  reaction: string;
  misunderstanding: string;
  truth: string;
} => {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  return {
    location: pick(RANDOM_SEED_POOLS.locations),
    object: pick(RANDOM_SEED_POOLS.objects),
    reaction: pick(RANDOM_SEED_POOLS.reactions),
    misunderstanding: pick(RANDOM_SEED_POOLS.misunderstandings),
    truth: pick(RANDOM_SEED_POOLS.truths)
  };
};

// ============================================
// 의상 선택 함수 (SEXY / NORMAL 이원화)
// ============================================

/**
 * 여성 의상 선택
 * - 불륜/외도 장르: SEXY 카테고리에서 선택
 * - 그 외 장르: NORMAL (SEXY 제외 전체)에서 랜덤 선택
 */
export const pickFemaleOutfit = (genre: string, excludeOutfits: string[] = []): string => {
  const isSexyGenre = genre === 'affair-suspicion';

  const candidates = UNIFIED_OUTFIT_LIST.filter(item => {
    // 남성 의상 제외
    if (item.categories.includes('MALE')) return false;
    // 이미 선택된 의상 제외
    if (excludeOutfits.includes(item.name)) return false;

    if (isSexyGenre) {
      // 불륜/외도: SEXY 카테고리만
      return item.categories.includes('SEXY');
    } else {
      // 그 외: SEXY 제외 전체
      return !item.categories.includes('SEXY');
    }
  });

  if (candidates.length === 0) {
    return 'White Halter-neck Knit + Red Micro Mini Skirt';
  }

  return candidates[Math.floor(Math.random() * candidates.length)].name;
};

/**
 * 남성 의상 선택 - 전체에서 랜덤
 */
export const pickMaleOutfit = (excludeOutfits: string[] = []): string => {
  const candidates = UNIFIED_OUTFIT_LIST.filter(item => {
    if (!item.categories.includes('MALE')) return false;
    if (excludeOutfits.includes(item.name)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return 'Navy Slim-fit Polo + White Tailored Golf Pants';
  }

  return candidates[Math.floor(Math.random() * candidates.length)].name;
};

// ============================================
// 대본 생성용 프롬프트 (메인 함수)
// ============================================

export const buildLabScriptPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender, additionalContext } = options;

  const genreGuide = LAB_GENRE_GUIDELINES[genre];

  // 🎲 랜덤 시드 생성
  const seed = generateRandomSeed();

  // 👗 의상 선택 (중복 방지)
  const womanAOutfit = pickFemaleOutfit(genre, []);
  const womanBOutfit = pickFemaleOutfit(genre, [womanAOutfit]);
  const manAOutfit = pickMaleOutfit([]);

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 **유튜브 쇼츠 바이럴 대본 전문 작가**입니다.
${targetAge} 한국 ${gender === 'female' ? '여성' : '남성'} 시청자가 끝까지 보게 만드는 대본을 작성하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 주제: "${topic}"
📌 장르: ${genreGuide?.name || '일반'}
📌 타겟: ${targetAge} 한국 ${gender === 'female' ? '여성' : '남성'}
📌 주인공 성별: ${gender === 'female' ? '여성' : '남성'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎭 스토리 구조 및 주인공 설정
- **주인공**: ${gender === 'female' ? '20~50대 한국 여성' : '20~50대 한국 남성'}
- **관점**: 주인공의 시점에서 이야기가 전개되도록 하세요.
${genreGuide?.structure || ''}

## 🎲 이번 대본 필수 요소 (창작 시드)
다음 요소들을 **반드시 창의적으로 활용**하세요:

- 장소/상황: **${seed.location}**
- 소품/단서: **${seed.object}**
- 반응/행동: **${seed.reaction}**
- 오해 포인트: **${seed.misunderstanding}**
- 반전 진실: **${seed.truth}**

⚠️ 중요! 주제(topic)가 최우선!
⚠️ 랜덤 시드는 참고만! 주제와 충돌하면 주제를 따르세요!
⚠️ 주제가 "골프장", "캐디"면 → 배경은 반드시 골프장!
⚠️ 시드의 장소가 "편의점"이어도 주제가 "골프장"이면 골프장으로!
⚠️ 위 요소들을 자연스럽게 녹여서 **완전히 새로운 스토리**를 만드세요.
⚠️ 요소를 억지로 다 넣지 말고, 3개 이상 자연스럽게 활용하면 됩니다.

## 🎭 스토리 구조 (이 공식을 따르되, 내용은 새롭게!)
${genreGuide?.structure || ''}

## 💬 킬러 대사 (최소 2개 자연스럽게 삽입)
${genreGuide?.killerPhrases.map(p => `'${p}'`).join(', ') || ''}

## ❌ 금지 패턴 (이미 너무 많이 쓴 것들)
${genreGuide?.forbiddenPatterns.map(p => `- ${p}`).join('\n') || ''}

## 📝 대본 규칙
1. 분량: 10-12문장
2. 문체: ~했어, ~했지, ~더라고 (친구한테 말하듯)
3. 대사: 작은따옴표 사용 ('이렇게')
4. 구체성: 장소, 행동, 표정 생생하게
5. 의상 이름 대본에 절대 언급 금지
${additionalContext ? `6. 추가: ${additionalContext}` : ''}

## 👗 의상 설정 (이미지 프롬프트 전용 - 절대 변경 금지!)
- **Woman A (지영) 고정 의상**: ${womanAOutfit}
- **Woman B (혜경) 고정 의상**: ${womanBOutfit}  
- **Man A (준호) 고정 의상**: ${manAOutfit}

⚠️ 모든 8개 씬에서 위 의상을 **100% 동일하게** 사용하세요!
⚠️ 투샷/쓰리샷에서도 **상의 + 하의 전체**를 명시하세요! (축약 금지)

## 💇 헤어스타일 설정 (모든 씬에서 고정!)
- **Woman A (지영)**: long soft-wave hairstyle
- **Woman B (혜경)**: short chic bob cut
- **Man A (준호)**: short neat hairstyle

⚠️ 모든 씬에서 헤어스타일을 **반드시 포함**하세요! (투샷/쓰리샷 포함)

## 📸 이미지 샷 타입 규칙 (중요!)
대본 내용에 따라 적절한 샷 타입을 선택하세요:

| 상황 | 샷 타입 | 프롬프트 작성법 |
|-----|--------|---------------|
| 1명 행동/감정 | 원샷 | "A stunning Korean woman..." |
| 2명 함께 등장 | 투샷 | "Two stunning Korean women..." (각각 헤어+체형+의상 전체 명시) |
| 3명 함께 등장 | 쓰리샷 | "Three people in frame..." (각각 헤어+체형+의상 전체 명시) |

### 🎬 캐릭터 샷 규칙 (투샷/쓰리샷 필수!)
⚠️ 모든 인물이 같은 동작 금지! (예: 다 같이 웃기 ❌)
⚠️ 각 캐릭터마다 서로 다른 동작/표정 필수!

✅ 좋은 예시:
- Woman A: 커피 마시다 멈추며 눈 크게 뜸
- Woman B: 핸드폰 보다가 고개 돌림
- Man A: 손 흔들며 다가오는 중

❌ 나쁜 예시:
- 세 명이 나란히 서서 웃음
- 두 명이 같이 앉아서 대화
 
## 🎥 비디오 프롬프트 생성 규칙 (모든 씬 필수!)

각 씬마다 동영상 프롬프트(videoPrompt)를 생성하세요:

### ✅ 비디오 프롬프트 템플릿:
\`\`\`
A stunning [Korean woman/man in her/his ${targetAge}], [동작/행동], [감정 표현]
\`\`\`

### 📝 비디오 프롬프트 생성 방법:
1. **scriptLine에서 동작 추출**: 대사 전/후에 나오는 행동 묘사 (예: "커피 마시다 멈추며" → "pauses while drinking coffee")
2. **emotion에서 감정 추출**: 시작감정→끝감정 (예: "신남→기뻐" → "excited expression, happy")
3. **정체성 포함**: 한국인 + 나이 (예: "A stunning Korean woman in her 40s")
4. **영어로 번역**: 모든 것을 영어로 명확하게 표현

### ✅ 비디오 프롬프트 예시:
- **scriptLine**: "커피 마시다 멈추며 눈 크게 뜸" → **videoPrompt**: "A stunning Korean woman in her 40s pauses while drinking coffee, eyes widening with surprise, surprised expression"
- **scriptLine**: "핸드폰 보다가 고개 돌림" → **videoPrompt**: "A stunning Korean woman in her 40s looks at phone and turns head, curious expression"
- **scriptLine**: "손 흔들며 다가오는 중" → **videoPrompt**: "A handsome Korean man in his 40s waves hand while approaching, friendly expression"


### ✅ 비디오 프롬프트 템플릿:
\`\`\`
A stunning [Korean woman/man in her/his ${targetAge}], [동작/행동], [감정 표현]
\`\`\`
 
### 📝 비디오 프롬프트 생성 방법:
1. **scriptLine에서 동작 추출**: 대사 전/후에 나오는 행동 묘사 (예: "커피 마시다 멈추며" → "pauses while drinking coffee")
2. **emotion에서 감정 추출**: 시작감정→끝감정 (예: "신남→기뻐" → "excited expression, happy")
3. **정체성 포함**: 한국인 + 나이 (예: "A stunning Korean woman in her 40s")
4. **영어로 번역**: 모든 것을 영어로 명확하게 표현
 
### ✅ 비디오 프롬프트 예시:
- **scriptLine**: "커피 마시다 멈추며 눈 크게 뜸" → **videoPrompt**: "A stunning Korean woman in her 40s pauses while drinking coffee, eyes widening with surprise, surprised expression"
- **scriptLine**: "핸드폰 보다가 고개 돌림" → **videoPrompt**: "A stunning Korean woman in her 40s looks at phone and turns head, curious expression"
- **scriptLine**: "손 흔들며 다가오는 중" → **videoPrompt**: "A handsome Korean man in his 40s waves hand while approaching, friendly expression"
 
### ⚠️ 비디오 프롬프트 체크리스트:
✅ 한국인 정체성 포함? (A stunning Korean woman/man in her/his [age])
✅ 나이 포함? (in her/his 40s)
✅ 동작 구체적? (pauses, turns, waves 등)
✅ 감정 명확? (surprised, curious, happy 등)
✅ 영어 문법 정확? (present tense, action verbs)



## 🎨 이미지 프롬프트 필수 규칙 (모든 씬 적용)

### ✅ 여성 원샷 템플릿:
\`\`\`
${PROMPT_CONSTANTS.START}, A stunning Korean woman in her ${targetAge}, [헤어스타일], slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes accentuating curves naturally, wearing [상의 + 하의 전체 의상명], [액세서리], [행동/표정], [배경], [카메라앵글], ${PROMPT_CONSTANTS.END}, ${PROMPT_CONSTANTS.NEGATIVE}
\`\`\`

### ✅ 남성 원샷 템플릿:
\`\`\`
${PROMPT_CONSTANTS.START}, Korean man in his ${targetAge}, [헤어스타일], wearing [상의 + 하의 전체 의상명], [액세서리], [행동/표정], [배경], [카메라앵글], ${PROMPT_CONSTANTS.END}, ${PROMPT_CONSTANTS.NEGATIVE}
\`\`\`

### ✅ 투샷 템플릿 (🚨 각 캐릭터별 전체 명시 필수!):
\`\`\`
${PROMPT_CONSTANTS.START}, Two stunning Korean women in their ${targetAge}, side by side,
First woman (Woman A): long soft-wave hairstyle, slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes accentuating curves naturally, wearing ${womanAOutfit}, delicate gold hoop earrings,
Second woman (Woman B): short chic bob cut, slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes accentuating curves naturally, wearing ${womanBOutfit}, pearl drop earrings,
[두 사람의 행동/표정], [배경], [카메라앵글], ${PROMPT_CONSTANTS.END}, ${PROMPT_CONSTANTS.NEGATIVE}
\`\`\`

⚠️ 체형 문구 축약 금지! 반드시 "slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes" 전체 포함!

### ✅ 쓰리샷 템플릿 (🚨 각 캐릭터별 전체 명시 필수!):
\`\`\`
${PROMPT_CONSTANTS.START}, Three people in frame, all in their ${targetAge},
First woman (Woman A): long soft-wave hairstyle, slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes accentuating curves naturally, wearing ${womanAOutfit}, delicate gold hoop earrings,
Second woman (Woman B): short chic bob cut, slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes accentuating curves naturally, wearing ${womanBOutfit}, pearl drop earrings,
Man (Man A): short neat hairstyle, Korean man, wearing ${manAOutfit}, silver watch,
[세 사람의 행동/상호작용], [배경], [카메라앵글], ${PROMPT_CONSTANTS.END}, ${PROMPT_CONSTANTS.NEGATIVE}
\`\`\`

⚠️ 체형 문구 축약 금지! 
- 여성: "slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes" 전체 포함!
- 남성: "Korean man"

### ⚠️ 프롬프트 체크리스트 (매 씬마다 확인!):
✅ 시작 문구 "unfiltered raw photograph, 8k ultra photorealism..." 포함?
✅ 헤어스타일 명시? (long soft-wave / short chic bob cut / short neat)
✅ 체형 문구 전체 포함? (여성: "slim hourglass figure, curvy feminine figure, glamorous silhouette, elegant feminine curves, tight-fitting clothes")
✅ 의상 앞에 **wearing** 키워드 포함? (예: wearing Ivory Bodycon Blazer Mini Dress)
✅ 의상이 **상의 + 하의 전체** 명시? (축약 금지!)
✅ 액세서리 포함? (Woman A: delicate gold hoop earrings, Woman B: pearl drop earrings, Man A: silver watch)
✅ 종결 문구 "shot on 85mm lens, f/1.8... --ar 9:16" 포함?
✅ 금지 문구 "NOT cartoon, NOT anime, NOT mannequin..." 포함?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (반드시 이 JSON 구조만 출력)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "title": "자극적인 제목 (15자 이내)",
  "titleOptions": ["제목옵션1", "제목옵션2", "제목옵션3"],
  "scriptBody": "문장1\\n문장2\\n문장3\\n...\\n문장10-12",
  "punchline": "핵심 펀치라인 대사",
  "hook": "첫 문장",
  "twist": "반전 문장",
  "lockedOutfits": {
    "womanA": "${womanAOutfit}",
    "womanB": "${womanBOutfit}",
    "manA": "${manAOutfit}"
  },
  "characters": [
    {
      "id": "WomanA",
      "name": "지영",
      "slot": "Slot Woman A",
      "hair": "Long soft-wave hairstyle",
      "body": "Slim hourglass figure, curvy feminine figure, glamorous silhouette",
      "outfit": "${womanAOutfit}",
      "accessories": "delicate gold hoop earrings, luxury watch"
    },
    {
      "id": "WomanB",
      "name": "혜경",
      "slot": "Slot Woman B",
      "hair": "Short chic bob cut",
      "body": "Slim hourglass figure, curvy feminine figure, glamorous silhouette",
      "outfit": "${womanBOutfit}",
      "accessories": "pearl drop earrings, gold bangle bracelet"
    },
    {
      "id": "ManA",
      "name": "준호",
      "slot": "Slot Man A",
      "hair": "Short neat hairstyle",
      "body": "Korean man",
      "outfit": "${manAOutfit}",
      "accessories": "silver watch"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "characterSlot": "Woman A | Woman B | Man A | Woman A, Woman B | Woman A, Woman B, Man A 중 선택",
      "shotType": "원샷 | 투샷 | 쓰리샷 중 선택",
      "summary": "장면 한줄 요약",
      "scriptLine": "scriptBody에서 이 장면에 해당하는 대사",
      "action": "캐릭터의 구체적 행동",
      "emotion": "시작감정 → 끝감정",
      "shortPrompt": "간단한 영문 프롬프트",
      "shortPromptKo": "간단한 한글 프롬프트",
      "longPrompt": "위 템플릿을 따른 상세 프롬프트 (헤어+체형+의상 전체 포함)",
      "longPromptKo": "상세 한글 프롬프트",
      "videoPrompt": "A stunning [Korean woman/man in her/his ${targetAge}], [scriptLine에서 추출한 동작], [emotion에서 추출한 감정 표현] (영어로)"
    }
  ]
}

**최종 체크리스트**:
1. ✅ scriptBody는 순수 대본만 (10-12문장)
2. ✅ 정확히 8개 scenes
3. ✅ 대본 내용에 맞는 shotType (원샷/투샷/쓰리샷)
4. ✅ 모든 씬 의상 = lockedOutfits와 **상의+하의 전체** 동일
5. ✅ 모든 씬에 **헤어스타일** 포함
6. ✅ 모든 여성 프롬프트에 "slim hourglass, curvy feminine, glamorous silhouette" 포함
7. ✅ 모든 프롬프트에 "NOT cartoon, NOT mannequin" 포함
8. ✅ 모든 프롬프트에 "shot on 85mm lens, --ar 9:16" 포함
9. ✅ **모든 씬마다 videoPrompt 생성!** (한국인+나이+동작+감정 포함)
10. ✅ JSON 외 텍스트 없음
`;
};

// ============================================
// 이미지 프롬프트 생성 (경량화)
// ============================================

export const buildLabImagePrompt = (options: LabImagePromptOptions): string => {
  const {
    sceneText,
    characterGender,
    characterAge,
    bodyType,
    outfit,
    style,
    includeQualityTags,
    includeAspectRatio
  } = options;

  const parts: string[] = [];

  // 시작 문구
  parts.push(PROMPT_CONSTANTS.START);

  if (characterGender === 'female') {
    parts.push(`A stunning Korean woman in her ${characterAge}`);
    parts.push(bodyType || PROMPT_CONSTANTS.FEMALE_BODY);
  } else {
    parts.push(`Korean man in his ${characterAge}`);
    parts.push(bodyType || PROMPT_CONSTANTS.MALE_BODY);
  }

  if (outfit) {
    parts.push(`wearing ${outfit}`);
  }

  parts.push(sceneText);

  if (style) {
    parts.push(style);
  }

  if (includeQualityTags) {
    parts.push(PROMPT_CONSTANTS.END);
  }

  // 금지 키워드 추가
  parts.push(PROMPT_CONSTANTS.NEGATIVE);

  if (includeAspectRatio && !parts.some(p => p.includes('--ar'))) {
    parts.push('--ar 9:16');
  }

  return parts.filter(Boolean).join(', ');
};

// ============================================
// 하위 호환성 함수 (기존 코드에서 호출할 경우 대비)
// ============================================

export const pickLabOutfitByGenre = (
  gender: 'female' | 'male',
  genre: string
): string => {
  if (gender === 'male') {
    return pickMaleOutfit([]);
  }
  return pickFemaleOutfit(genre, []);
};

export const pickLabMaleOutfit = (): string => {
  return pickMaleOutfit([]);
};

export const pickRandomOutfit = (
  gender: 'female' | 'male',
  category: 'GOLF' | 'CASUAL' | 'ELEGANT' | 'BUSINESS'
): string => {
  if (gender === 'male') {
    return pickMaleOutfit([]);
  }
  return pickFemaleOutfit('comedy-humor', []);
};

// 나이 변환 헬퍼 (40대 → 40s)
export const convertAgeToEnglish = (koreanAge: string): string => {
  const match = koreanAge.match(/(\d+)/);
  if (match) {
    return `${match[1]}s`;
  }
  return '40s';
};

// ============================================
// 의상 프리셋 (레거시 지원)
// ============================================

export const LAB_OUTFIT_PRESETS = {
  FEMALE: {
    GOLF: [
      'White V-neck fitted polo with micro pleated skirt',
      'Pink sleeveless polo with white tennis skirt',
      'Navy halter-neck knit with white micro shorts',
      'White tube top with red micro mini skirt',
      'Beige argyle V-neck knit with white fitted skirt'
    ],
    CASUAL: [
      'White off-shoulder blouse with fitted jeans',
      'Navy fitted turtleneck with leather mini skirt',
      'Cream cashmere V-neck with white tailored pants',
      'Black sleeveless top with high-waist shorts'
    ],
    ELEGANT: [
      'Deep V-neck silk blouse with satin skirt',
      'Wine red wrap dress with subtle slit',
      'Black fitted mini dress with elegant neckline',
      'Navy textured tweed fitted dress'
    ]
  },
  MALE: {
    GOLF: [
      'Navy slim-fit polo with white tailored pants',
      'White performance polo with beige chinos',
      'Charcoal mock-neck knit with grey slacks'
    ],
    BUSINESS: [
      'White shirt with navy blazer and grey slacks',
      'Charcoal double-breasted suit with black tie'
    ]
  }
};

// ============================================
// 스타일 프리셋
// ============================================

export const LAB_STYLE_PRESETS = {
  cinematic: 'cinematic photography, film grain, dramatic lighting, shallow depth of field',
  kdrama: 'Korean drama aesthetic, soft romantic lighting, dreamy atmosphere',
  noir: 'film noir style, high contrast, dramatic shadows, moody atmosphere',
  fantasy: 'Korean historical drama, hanbok inspired, ethereal lighting',
  luxury: 'high-end luxury aesthetic, magazine cover quality, refined elegance'
};

// ============================================
// Export
// ============================================

export default {
  buildLabScriptPrompt,
  buildLabImagePrompt,
  pickRandomOutfit,
  pickLabOutfitByGenre,
  pickLabMaleOutfit,
  pickFemaleOutfit,
  pickMaleOutfit,
  generateRandomSeed,
  LAB_GENRE_GUIDELINES,
  LAB_OUTFIT_PRESETS,
  LAB_STYLE_PRESETS,
  MAMA_CHARACTER_PRESETS,
  PROMPT_CONSTANTS,
  RANDOM_SEED_POOLS
};
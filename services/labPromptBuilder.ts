/**
 * labPromptBuilder.ts
 * 쇼츠랩 전용 경량화 프롬프트 빌더
 * 
 * v3.5 업데이트 (2026-01-23):
 * - 가슴라인 강조 강화 (voluptuous chest line)
 * - 겨울 방한용품 시스템 도입 (귀도리, 비니, 크롭 패딩 등)
 * - 코미디 장르 최적화 (생생한 표정 및 역동적 포즈 강조)
 * - 의상 일관성 강제 규칙 강화 (lockedOutfits 100% 복사)
 */

import { UNIFIED_OUTFIT_LIST } from '../constants';
import { buildOutfitPool } from './outfitService';
import type { OutfitPoolItem } from './outfitService';

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
    identity: 'A stunning Korean woman',
    bodyType: 'slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves, voluptuous chest line, emphasizing chest line',
    style: 'well-managed sophisticated look despite age, elegant and confident presence',
    outfitFit: 'tight-fitting, form-hugging, accentuating curves naturally'
  },
  MALE: {
    identity: 'A handsome Korean man',
    bodyType: 'fit athletic build with broad shoulders',
    style: 'dandy and refined presence, well-groomed appearance',
    outfitFit: 'tailored slim-fit, clean lines'
  }
};

// ============================================
// 이미지 프롬프트 고정 문구 (절대 생략 금지)
// ============================================

export const PROMPT_CONSTANTS = {
  START: 'unfiltered raw photograph, 8k ultra photorealism, ultra detailed skin texture with visible pores and natural skin imperfections, professional cinematic lighting, RAW photo, real human skin texture, candid photography style',

  FEMALE_BODY: 'slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves, voluptuous chest line, emphasizing chest line, deep cleavage, defined chest silhouette, well-managed sophisticated look despite age, tight-fitting clothes accentuating curves naturally',

  MALE_BODY: 'fit athletic build with broad shoulders, dandy and refined presence, tailored slim-fit clothes',

  END: 'high-fashion editorial refined, depth of field, shot on 85mm lens, f/1.8, realistic soft skin, 8k ultra-hd, no text, no captions, no typography, --ar 9:16',

  NEGATIVE: 'NOT cartoon, NOT anime, NOT 3D render, NOT CGI, NOT plastic skin, NOT mannequin, NOT doll-like, NOT airbrushed, NOT overly smooth skin, NOT uncanny valley, NOT artificial looking, NOT illustration, NOT painting, NOT drawing'
};

// ============================================
// 샷 타입별 프롬프트 템플릿 (v3.2 - 캐릭터 구분자 시스템)
// ============================================

export const SHOT_TEMPLATES = {
  // 원샷: 1명 캐릭터만 등장
  SINGLE: {
    description: '1명 캐릭터 단독 등장',
    format: '[Character] identity, hair, body, wearing outfit, [Action], [Background]',
  },

  // 투샷: 2명 캐릭터 등장 - 반드시 [Person 1], [Person 2]로 구분
  TWO_SHOT: {
    description: '2명 캐릭터 상호작용',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Interaction], [Background]',
  },

  // 쓰리샷: 3명 캐릭터 등장 - 반드시 [Person 1], [Person 2], [Person 3]로 구분
  THREE_SHOT: {
    description: '3명 캐릭터 함께 등장',
    format: '[Person 1: identity, hair, body, wearing outfit] [Person 2: identity, hair, body, wearing outfit] [Person 3: identity, hair, body, wearing outfit] [Group Action], [Background]',
  },

  // v3.3 - 카메라 앵글 (영상 다양성을 위한 샷 타입)
  CAMERA_ANGLES: {
    CLOSE_UP: {
      name: '클로즈업',
      promptKeyword: 'close-up portrait shot, face in focus, shallow depth of field',
      usage: 'Hook/Twist 감정 강조, 충격/당황/긴장 순간',
    },
    MEDIUM_SHOT: {
      name: '미디엄샷',
      promptKeyword: 'medium shot, waist-up framing, natural pose',
      usage: '대화, 일반적인 상호작용',
    },
    WIDE_SHOT: {
      name: '와이드샷',
      promptKeyword: 'wide establishing shot, full body visible, environment context',
      usage: '장소 전환, 상황 설정, 첫 등장',
    },
    OVER_SHOULDER: {
      name: '오버숄더',
      promptKeyword: 'over-the-shoulder shot, perspective view',
      usage: '한쪽 시점 강조, 긴장감 고조, 대면 상황',
    },
    POV: {
      name: 'POV',
      promptKeyword: 'first-person POV shot, subjective camera angle',
      usage: '몰입감 강화, 소품/명함 클로즈업',
    }
  }
};

// ============================================
// 40~60대 타겟 장르 지침 (v3.5)
// ============================================

export const LAB_GENRE_GUIDELINES: Record<string, {
  name: string;
  description: string;
  emotionCurve: string;
  structure: string;
  killerPhrases: string[];
  supportingCharacterPhrasePatterns?: string[];
  bodyReactions: string[];
  forbiddenPatterns: string[];
  goodTwistExamples: string[];
  supportingCharacterTwistPatterns?: string[];
  badTwistExamples: string[];
}> = {

  'comedy-humor': {
    name: '코미디 / 유머',
    description: '일상의 사소한 오해나 실수로 망가지는 상황. 화보 같은 느낌보다는 **생생하고 익살스러운 표정(expressive facial expressions)**과 **역동적인 굴욕 포즈(dynamic clumsy poses)**가 핵심.',
    emotionCurve: '😊 평화 → 😳 당황 → 😱 충격 → 🤦 민망 → 😂 자폭 웃음',
    structure: `
[HOOK] 🎯 시청자를 1초 안에 멈추게 하는 오프닝 (⚠️ 예시 그대로 복사 금지! 주제에 맞게 새롭게 창작할 것)
→ 패턴1: 상황 중간 시작 - "근데 그 사람이 돌아보는 거야", "손님이 갑자기 나를 보더니..."
→ 패턴2: 질문형 공감 - "혹시 이런 실수 해본 적 있어요?", "이거 나만 그래?"
→ 패턴3: 결과 스포일러 - "결국 그날... 가족회의 열렸어", "그래서 지금도 그 카페 못 가"
→ 패턴4: 미스터리/긴장 - "근데 뒤에 있던 사람이...", "웃으면서 다가오는데 뭔가 이상해"
→ 핵심: "망가지기 직전" 또는 "반전 1초 전"에서 시작해서 궁금증 유발

[SETUP] 😊 평화로운 일상 + 복선(Foreshadowing)
→ 아무것도 모른 채 잘난 척하거나 행복한 모습
→ 나중에 반전이 될 힌트를 슬쩍 흘림

[BUILD-UP] 😳 오해의 심화
→ 주변의 시선, 착각, 어깨에 힘 들어가는 상황

[CLIMAX] 😱 진실의 목격/폭로
→ 가장 민망한 순간에 정체가 탄로남
→ 예시 패턴: 알고보니 가족, 직장동료, 완전히 다른 상황 (⚠️ 주제에 맞게 새롭게 창작)

[TWIST] 🤦 민망함의 극치 + 반전 공개
→ 알고보니 가족, 친척, 혹은 완전히 다른 상황

[OUTRO] 😂 자폭하며 마무리
→ 웃음과 함께 교훈 또는 후일담 (⚠️ 주제에 맞게 새롭게 창작)
`,
    killerPhrases: [
      // ⚠️ 아래는 참고용 패턴! 그대로 복사하지 말고 주제에 맞게 새롭게 창작할 것
      '드디어 올 게 왔구나 싶었지',
      '심장이 철렁 내려앉더라고',
      '어깨에 힘이 빡 들어가더라고',
      '멋진 척 한 번 해봤지',
      '아무것도 모르고 신나있었어',
      '그때까지만 해도 좋았어',
    ],
    supportingCharacterPhrasePatterns: [
      '조연이 화자의 가족/지인을 알아보는 대사 ("어머, OO씨 남편분이시네요!")',
      '조연이 민망한 실수를 지적하는 대사 ("저기... 이거 왜 이래요?")',
      '조연이 뜻밖의 연결고리를 드러내는 대사 ("혹시 OO씨 아세요?")',
    ],
    bodyReactions: [
      '얼굴이 화끈거렸어',
      '헛기침을 계속했어',
      '입술을 바짝 깨물었어',
      '동공이 지진 난 것처럼 떨렸어',
      '뒷머리를 긁적였어',
      '어색하게 미소 지었어',
      '두 손으로 얼굴을 가렸어',
    ],
    forbiddenPatterns: [
      '지나치게 진지한 분위기',
      '화보 같은 포즈 (Sexy/Elegant 위주 금지)',
      '감동적인 마무리 (웃음으로 끝낼 것)',
      '복선 없는 갑작스러운 반전',
    ],
    goodTwistExamples: [
      '알고보니 아름다운 캐디가 막내 처제였음',
      '알고보니 헌팅하려던 미녀가 변장한 와이프였음',
      '알고보니 나를 유혹하는 줄 알았던 여자가 내 바지 지퍼 열렸다고 알려주려던 것이었음',
    ],
    supportingCharacterTwistPatterns: [
      '조연(캐디, 스태프, 점원 등)이 화자의 가족/지인과 뜻밖의 연결고리가 있어서 들킴',
      '조연이 나중에 진실을 밝혀줌 ("아까 그분, 사모님 동생이세요")',
    ],
    badTwistExamples: [
      '알고보니 서프라이즈 파티 (뻔함)',
      '알고보니 몰래카메라 (불쾌함)',
      '알고보니 꿈이었음 (허무함)',
    ],
  },

  'romance-flutter': {
    name: '로맨스/설렘',
    description: '중년의 설렘. 첫사랑 감성, 권태기 부부의 재발견, 예상치 못한 두근거림',
    emotionCurve: '😐 무덤덤 → 👀 의식됨 → 💓 두근 → 😳 당황 → 🤔 "나만 이런가?"',
    structure: `
[HOOK] ⚡ 사건/충격을 첫 문장에 바로 던지기
→ "캐디가 내 손목을 붙잡는 순간 숨이 멎었어"
→ "문 열자마자 들린 한마디에 다리가 풀렸어"

[SETUP] 👀 일상 속 만남 + 복선
→ 늘 보던 사람인데 오늘 뭔가 다름
→ "평소처럼 (행동)하는데..."

[BUILD-UP] 💓 물리적/심리적 거리 좁혀짐
→ 우연한 접촉, 눈 마주침, 목소리 톤 변화
→ 시간이 느려지는 느낌 묘사
→ 신체반응 필수

[CLIMAX] 😳 결정적 순간
→ 의미심장한 한마디 or 행동
→ "그때 그 사람이 (말/행동)하더니..."

[TWIST] 🤔 혼란 + 여운
→ 확신 없는 결말
→ "나만 이런 건가?", "뭔가 있는 건가?"
`,
    killerPhrases: [
      '오늘따라 왜 이러지',
      '원래 이랬나?',
      '목소리가 왜 이렇게 낮아졌지',
      '눈을 어디다 둘지 모르겠더라',
      '괜히 신경 쓰였어',
      '그 말이 자꾸 맴돌아',
      '나만 이런 건가',
      '무슨 의미였을까',
      '설마... 아니겠지?',
      '왜 자꾸 생각나지',
      '내가 왜 이래 갑자기',
    ],
    bodyReactions: [
      '심장이 갑자기 빨라졌어',
      '귀가 빨개지는 게 느껴졌어',
      '목소리가 작아졌어',
      '눈을 못 마주치겠더라',
      '손끝이 미세하게 떨렸어',
      '숨을 참고 있었어',
      '입이 바짝 말랐어',
      '시간이 멈춘 것 같았어',
    ],
    forbiddenPatterns: [
      '심장이 쿵쾅쿵쾅 (유치한 표현)',
      '나비가 날아다니는 것 같았다',
      '운명 같은 만남',
      '첫눈에 반했다',
      '바로 고백',
      '키스/신체접촉',
      '바로 사귀기 시작',
      '골프장 그립 잡아주기',
      '우연히 같은 호텔',
      '비 오는 날 우산 씌워주기',
      '떨어진 물건 같이 줍다 손 닿기',
    ],
    goodTwistExamples: [
      '평소엔 무뚝뚝한 남편이 오늘따라 내 머리 냄새를 맡더니 "향 바꿨어?" 한마디',
      '항상 무심한 줄 알았던 그 사람이 내 커피 취향을 정확히 기억하고 있었음',
      '악수하는데 손을 평소보다 1초 더 잡고 있더라',
      '옆에 앉았는데 향수 냄새가... 집에 와서도 코끝에 남아있었어',
      '헤어질 때 "조심히 가"가 아니라 "연락해"라고 하더라',
    ],
    supportingCharacterTwistPatterns: [
      '조연이 둘 사이의 미묘한 분위기를 눈치채고 언급함 ("두 분 뭔가 있어 보여요")',
      '조연이 우연히 둘만의 시간/공간을 만들어줌',
      '조연을 통해 상대방의 관심을 간접적으로 알게 됨',
      '조연이 과거 상대방이 나에 대해 말한 것을 전해줌',
    ],
    supportingCharacterPhrasePatterns: [
      '조연이 분위기를 눈치채는 대사 ("어머, 두 분 좀 이상한데?")',
      '조연이 둘을 엮어주는 대사 ("저는 먼저 갈게요~")',
      '조연이 상대방의 마음을 떠보는 대사 ("걔가 너 얘기 많이 하던데?")',
    ],
    badTwistExamples: [
      '알고보니 나를 좋아했다 (너무 직접적)',
      '바로 고백받음 (전개 급함)',
      '꿈이었음 (허무)',
      '알고보니 유부남/유부녀 (불쾌)',
    ],
  },

  'affair-suspicion': {
    name: '불륜/외도 의심',
    description: '배우자의 수상한 행동 → 의심 폭발 → 건전한 반전. 시청자가 같이 의심하다가 안도하는 장르',
    emotionCurve: '🤨 수상함 → 😠 의심 → 😤 분노 폭발 직전 → 😮 반전 → 😅 안도+민망',
    structure: `
[HOOK] 🤨 충격적 발견/목격
→ "오늘 (물건)에서 이상한 거 발견했어"
→ "남편/와이프가 (수상한 행동)하는 거 봤어"

[SETUP] 🧐 최근 정황 나열 + 복선!
→ "생각해보니 요즘 좀 이상하긴 했어..."
→ 여기서 반전의 힌트를 슬쩍 깔기

[BUILD-UP] 😠 증거 수집 + 의심 폭주
→ 추가 증거들이 쌓임
→ "그래서 몰래 (조사 행동)했더니..."
→ 신체반응 필수

[CLIMAX] 😤 대면/추궁 순간
→ "결국 참다참다 물어봤어"
→ "이게 뭐야? 솔직히 말해"

[TWIST] 😮 건전한 반전
→ "알고보니 (감동적/웃긴 진실)이었어"
→ SETUP의 복선과 연결!

[OUTRO] 😅 안도 + 민망함
→ "내가 너무했나... 근데 누가 봐도 의심하잖아!"
`,
    killerPhrases: [
      '이거 뭐야?',
      '요즘 왜 이래?',
      '솔직히 말해봐',
      '나한테 숨기는 거 있지?',
      '다 알아, 딴 소리 하지 마',
      '눈 똑바로 보고 말해',
      '알고보니...',
      '아 진짜... 나 진짜 미안해',
      '누가 봐도 오해하잖아!',
      '생각해보니 요즘 좀 이상하긴 했어',
      '설마 했는데',
      '아니 근데 왜 숨겨',
    ],
    bodyReactions: [
      '손이 벌벌 떨렸어',
      '목소리가 갈라졌어',
      '눈물이 핑 돌았어',
      '심장이 쿵쿵 거렸어',
      '다리에 힘이 풀렸어',
      '숨이 턱 막히더라',
      '머리가 하얘졌어',
      '손에 쥔 핸드폰을 떨어뜨릴 뻔했어',
    ],
    forbiddenPatterns: [
      '실제 불륜 확정',
      '이혼 결심',
      '폭력적 대응',
      '자녀에게 피해',
      '립스틱 묻음',
      '향수 냄새',
      '머리카락 발견',
      '속옷 발견',
      '영수증 발견',
      '카톡 하트 이모지',
      '깜짝 파티 준비 (뻔함)',
      '서프라이즈 여행 준비 (뻔함)',
      '결혼기념일 선물 (뻔함)',
      '생일 선물 (뻔함)',
    ],
    goodTwistExamples: [
      '알고보니 남편이 내 갱년기 증상 때문에 몰래 한의원 상담받고 있었음',
      '알고보니 와이프가 내 퇴직 후 우울해할까봐 몰래 부부동반 여행 알아보는 중이었음',
      '알고보니 남편이 유튜브 보면서 몰래 요리 연습 중이었음 (맨날 라면만 끓이던 사람이)',
      '알고보니 딸이랑 짜고 내 환갑 축하 영상 만들고 있었음',
    ],
    supportingCharacterTwistPatterns: [
      '조연(친구, 이웃, 스태프)이 오해를 부추기는 정보를 줌 ("어제 남편분 젊은 여자랑 봤어요")',
      '조연이 나중에 진실을 밝혀줌 ("아 그거 서프라이즈 준비하는 거예요")',
      '조연이 배우자의 숨은 노력을 알려줌 ("사모님 위해 열심히 준비하시던데요")',
      '조연을 통해 배우자의 진심을 알게 됨',
    ],
    supportingCharacterPhrasePatterns: [
      '조연이 오해를 부추기는 대사 ("어제 카페에서 봤는데...")',
      '조연이 진실을 밝히는 대사 ("아 그거요? 사실은...")',
      '조연이 감동을 전하는 대사 ("사모님 몰래 얼마나 고민하셨는지...")',
    ],
    badTwistExamples: [
      '알고보니 회사 일 (너무 평범함)',
      '알고보니 친구 만남 (긴장감 대비 허무)',
      '실제 불륜이었음 (정책 위반)',
      '그냥 오해였음으로 끝남 (감동 없음)',
    ],
  },

  'hit-twist-spicy': {
    name: '대박 반전 (매운맛)',
    description: '성적 뉘앙스로 오해받는 상황 → 알고보니 완전 건전. 야한 것 같은데 야한 게 아닌 장르',
    emotionCurve: '😏 뭔가 야해...? → 😳 어머 저게 뭐야 → 😱 헐 설마 → 🤣 뭐야 아니잖아',
    structure: `
[HOOK] 😏 이중 의미 대사로 시작
→ 들으면 야하게 들리는 대사
→ "조금만 더요", "너무 빡빡해요", "살살 해요"

[SETUP] 😳 아슬아슬한 상황 설정 + 복선
→ 좁은 공간, 가까운 거리, 닫힌 문
→ 시각적으로 오해할 만한 구도

[BUILD-UP] 😱 오해 극대화
→ 밖에서 들으면 오해할 대사들 연속
→ "조심해요", "거기 말고요", "누가 오면 어떡해"
→ 제3자 등장 임박 암시

[CLIMAX] 😲 목격 순간
→ 누군가 문을 열거나 등장
→ "뭐... 뭐 하는 거야 너희?!"

[TWIST] 🤣 민망한 진실 공개
→ "아니 이게 아니라..."
→ 완전히 건전한 상황이었음

[OUTRO] 😂 웃음 + 해명
→ "오해예요 진짜!", "아 진짜 타이밍 왜..."
`,
    killerPhrases: [
      '조금만 더요',
      '너무 꽉 조여요',
      '힘 좀 빼요',
      '거기 말고요',
      '아 살살요',
      '누가 오면 어떡해',
      '빨리요 빨리',
      '뭐... 뭐 하는 거야?!',
      '아니 이거 오해예요!',
      '진짜 아무것도 아니에요!',
      '아니 타이밍이 왜...',
      '들어보면 알아요!',
    ],
    bodyReactions: [
      '얼굴이 새빨개졌어',
      '말문이 막혔어',
      '손사레를 미친듯이 쳤어',
      '버벅거리면서 해명했어',
      '식은땀이 줄줄 났어',
      '입이 벌어진 채로 굳었어',
      '눈이 왔다갔다 했어',
    ],
    forbiddenPatterns: [
      '실제 성적 상황',
      '노출 묘사',
      '신체 접촉 직접 묘사',
      '키스/포옹 장면',
      '속옷 언급',
      '장갑 끼워주기 (식상)',
      '파스 붙여주기 (식상)',
      '지퍼 올려주기 (식상)',
      '넥타이 매주기 (식상)',
      '머리에 뭐 붙은 거 떼주기 (식상)',
      '마사지 (여전히 애매함)',
    ],
    goodTwistExamples: [
      '알고보니 옷 매장 피팅룸에서 찢어진 바지 꿰매주고 있었음',
      '알고보니 콘택트렌즈 빠져서 찾아주고 있었음 (얼굴 가까이 대고)',
      '알고보니 목에 뭐가 걸려서 하임리히법 하고 있었음',
      '알고보니 새 구두 너무 꽉 껴서 억지로 벗기고 있었음',
      '알고보니 목걸이가 머리카락에 엉켜서 풀어주고 있었음',
    ],
    supportingCharacterTwistPatterns: [
      '목격자(조연)가 상황을 완전히 오해하고 당황함',
      '목격자의 리액션이 웃음 포인트가 됨 ("뭐... 뭐 하는 거야?!")',
      '목격자가 오해한 채로 소문을 퍼뜨릴 뻔함',
      '목격자에게 해명하는 과정이 더 민망해짐',
      '목격자가 나중에 진실을 알고 더 창피해함',
    ],
    supportingCharacterPhrasePatterns: [
      '목격자가 오해하며 당황하는 대사 ("뭐... 뭐 하는 거야 너희?!")',
      '목격자가 믿지 않는 대사 ("아니 무슨 그런 말도 안 되는...")',
      '목격자가 나중에 진실 알고 민망해하는 대사 ("아... 그거였구나...")',
    ],
    badTwistExamples: [
      '마사지해주고 있었음 (여전히 애매함)',
      '운동 동작 가르쳐주고 있었음 (식상함)',
      '춤 연습 (뻔함)',
      '요가 동작 (애매함)',
    ],
  },
};

// ============================================
// 40~60대 현실 반영 랜덤 시드 풀 (v3.1)
// ============================================

export const RANDOM_SEED_POOLS = {
  locations: [
    '골프장 라커룸', '클럽하우스 카페', '골프 연습장', '골프장 주차장',
    '백화점', '대형마트', '아파트 엘리베이터', '동네 카페',
    '미용실', '피부과 대기실', '헬스장', '필라테스 학원',
    '한의원', '정형외과', '안과',
    '동창회 식당', '계모임 장소', '와인바', '호텔 뷔페',
    '고급 레스토랑', '골프 클럽 식당',
    '자녀 집', '공항', '예식장', '돌잔치장',
  ],

  objects: [
    '카카오톡 알림', '문자 메시지', '새 옷 쇼핑백',
    '꽃다발', '고급 레스토랑 영수증', '호텔 주차권',
    '다이어트 보조제', '영양제 쇼핑백', '건강식품',
    '성형외과 명함', '새 운동복', '향수',
    '몰래 산 골프채', '고가의 선물 포장',
    '낯선 전화번호', '늦은 밤 문자',
  ],

  reactions: [
    '손이 벌벌 떨림',
    '목소리가 갈라짐',
    '귀까지 빨개짐',
    '한숨이 절로 나옴',
    '입이 바짝 마름',
    '다리에 힘이 풀림',
    '눈물이 핑 돎',
    '숨이 턱 막힘',
    '식은땀이 남',
    '심장이 철렁 내려앉음',
    '머리가 하얘짐',
  ],

  misunderstandings: [
    '바람피는 줄',
    '이혼 준비하는 줄',
    '건강검진 결과 안 좋은 줄',
    '자녀한테 목돈 빌려주는 줄',
    '주식/코인으로 돈 날린 줄',
    '성형 몰래 한 줄',
    '퇴직 통보받은 줄',
    '숨기는 병 있는 줄',
    '빚 있는 줄',
  ],

  truths: [
    '알고보니 블라우스 단추를 하나씩 밀려 끼운 채로 하루 종일 다님',
    '알고보니 명찰을 거꾸로 달고 다니고 있었음',
    '알고보니 셀카모드 켜진 줄 모르고 혼자 표정 연습 중이었는데 뒤에서 다 보고 있었음',
    '알고보니 마스크 안쪽에 립스틱이 번져있었는데 본인만 몰랐음',
    '알고보니 바지 주머니에서 영수증이 길게 삐져나와 있었음',
    '알고보니 휴대폰 플래시가 계속 켜져 있었음',
    '알고보니 한쪽 소매만 접힌 채로 중요한 자리 참석함',
    '알고보니 스카프가 가방 손잡이에 걸려 끌고 다녔음'
  ],

  twistTypes: [
    '배우자/가족 위한 서프라이즈 준비',
    '건강 관련 좋은 소식 또는 배려',
    '자녀/손주 관련 이벤트 준비',
    '본인 외모/건강 관리 비밀 시작',
    '가족 위한 재테크/저축',
    '말하기 쑥스러운 취미/자기계발',
    '과거 추억 정리/복원 프로젝트',
  ],
};

/**
 * 랜덤 시드 생성
 */
export const generateRandomSeed = (): {
  location: string;
  object: string;
  reaction: string;
  misunderstanding: string;
  truth: string;
  twistType: string;
} => {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  return {
    location: pick(RANDOM_SEED_POOLS.locations),
    object: pick(RANDOM_SEED_POOLS.objects),
    reaction: pick(RANDOM_SEED_POOLS.reactions),
    misunderstanding: pick(RANDOM_SEED_POOLS.misunderstandings),
    truth: pick(RANDOM_SEED_POOLS.truths),
    twistType: pick(RANDOM_SEED_POOLS.twistTypes),
  };
};

// ============================================
// 의상 선택 함수 (v3.5 - 겨울 테마 및 가슴라인 강조)
// ============================================

const WINTER_KEYWORDS = ['눈', '겨울', 'snow', 'winter', '스키', 'ski', '썰매', 'sled', 'ice', '빙판', '얼음', 'snowy'];

const isWinterTopic = (topic: string): boolean =>
  WINTER_KEYWORDS.some((keyword) => topic.toLowerCase().includes(keyword.toLowerCase()));

const splitOutfitTop = (outfit: string) => {
  const separators = [' + ', ' with ', ' and '];
  for (const separator of separators) {
    const index = outfit.toLowerCase().indexOf(separator);
    if (index > 0) {
      return {
        top: outfit.slice(0, index),
        tail: outfit.slice(index + separator.length),
        joiner: separator
      };
    }
  }
  return { top: outfit, tail: '', joiner: '' };
};

// 겨울 악세서리 (귀엽고 여성스러운 아이템 19종)
const WINTER_ACCESSORIES = [
  // 기존 7종
  'fluffy faux fur earmuffs',
  'cute pom-pom knit beanie',
  'fuzzy faux fur bucket hat',
  'faux fur trapper hat',
  'cute fuzzy mittens',
  'chunky faux fur moon boots',
  'knit leg warmers',
  // 리본/하트 계열
  'ribbon bow earmuffs',
  'heart-shaped fluffy earmuffs',
  'pearl-decorated earmuffs',
  'ribbon-tied knit mittens',
  // 귀여운 동물 계열
  'cat ear knit beanie',
  'bunny ear fuzzy hood',
  'bear ear fleece headband',
  // 여성스러운 계열
  'fluffy faux fur hand muff',
  'oversized chunky cable knit scarf',
  'angora beret with pom-pom',
  'fuzzy faux fur neck warmer'
];

// 겨울 아우터 (순수 아우터만 - 3종)
const WINTER_OUTERWEAR = [
  'cropped puffer jacket',
  'fur-hooded puffer jacket',
  'luxurious fur vest'
];

// 겨울 아우터 + 악세서리 한번 선택 (모든 씬 일관성용)
export const selectWinterItems = (): { outerwear: string; accessories: string[] } => {
  const outerwear = WINTER_OUTERWEAR[Math.floor(Math.random() * WINTER_OUTERWEAR.length)];
  const shuffled = [...WINTER_ACCESSORIES].sort(() => 0.5 - Math.random());
  const accessories = shuffled.slice(0, Math.random() < 0.5 ? 1 : 2);
  return { outerwear, accessories };
};

// 의상에 겨울 아이템 추가 (기존 의상 유지 + 아우터 + 악세서리)
export const applyWinterItems = (
  outfit: string,
  outerwear: string,
  accessories: string[]
): string => {
  const accsStr = accessories.join(', ');
  return `${outfit}, layered with ${outerwear}, accessorized with ${accsStr}`;
};

export const adjustOutfitForSeason = (outfit: string, topic: string): string => {
  // 이 함수는 더 이상 직접 사용하지 않음 (buildLabScriptPrompt에서 일괄 처리)
  return outfit;
};

const getOutfitPool = (): OutfitPoolItem[] =>
  buildOutfitPool(UNIFIED_OUTFIT_LIST as OutfitPoolItem[]);

const isMaleOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.includes('MALE');

const isUnisexOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.includes('UNISEX');

const isGolfOutfit = (item: OutfitPoolItem): boolean =>
  item.categories.some((category) => category.toLowerCase().includes('golf'));

export const pickFemaleOutfit = (
  genre: string,
  topic: string = '',
  excludeOutfits: string[] = []
): string => {
  const isSexyGenre = genre === 'affair-suspicion';
  const candidates = getOutfitPool().filter(item => {
    if (isMaleOutfit(item)) return false;
    if (excludeOutfits.includes(item.name)) return false;
    if (isSexyGenre) return item.categories.includes('SEXY');
    return !item.categories.includes('SEXY');
  });

  const selectedName = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].name
    : 'White Halter-neck Knit + Red Micro Mini Skirt';

  return adjustOutfitForSeason(selectedName, topic);
};

export const pickMaleOutfit = (topic: string = '', excludeOutfits: string[] = []): string => {
  const isGolfTopic = topic.includes('골프') || topic.includes('golf') || topic.includes('Golf');
  const candidates = getOutfitPool().filter(item => {
    if (!isMaleOutfit(item) && !isUnisexOutfit(item)) return false;
    if (excludeOutfits.includes(item.name)) return false;
    if (isGolfTopic) return isGolfOutfit(item);
    return !isGolfOutfit(item) || Math.random() > 0.7;
  });

  const selectedName = candidates.length > 0
    ? candidates[Math.floor(Math.random() * candidates.length)].name
    : (isGolfTopic ? 'Navy Slim-fit Polo + White Tailored Golf Pants' : 'Black Knit Polo + Dark Indigo Denim');

  return adjustOutfitForSeason(selectedName, topic);
};

// ============================================
// 대본 생성용 프롬프트 (v3.5 - 완전판)
// ============================================

export const buildLabScriptPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender, additionalContext } = options;
  const genreGuide = LAB_GENRE_GUIDELINES[genre];
  const seed = generateRandomSeed();

  // 기본 의상 선택
  let womanAOutfit = pickFemaleOutfit(genre, topic, []);
  let womanBOutfit = pickFemaleOutfit(genre, topic, [womanAOutfit]);
  let womanDOutfit = pickFemaleOutfit(genre, topic, [womanAOutfit, womanBOutfit]);
  const manAOutfit = pickMaleOutfit(topic, []);
  const manBOutfit = pickMaleOutfit(topic, [manAOutfit]);

  // 겨울 테마 감지 시 아우터 + 악세서리 일괄 적용 (모든 씬 일관성)
  let winterOuterwear = '';
  let winterAccessories: string[] = [];
  if (isWinterTopic(topic)) {
    const winterItems = selectWinterItems();
    winterOuterwear = winterItems.outerwear;
    winterAccessories = winterItems.accessories;
    // 여성 의상에만 겨울 아이템 적용
    womanAOutfit = applyWinterItems(womanAOutfit, winterOuterwear, winterAccessories);
    womanBOutfit = applyWinterItems(womanBOutfit, winterOuterwear, winterAccessories);
    womanDOutfit = applyWinterItems(womanDOutfit, winterOuterwear, winterAccessories);
  }

  const narratorSlot = gender === 'female' ? 'Woman A (지영)' : 'Man A (준호)';
  const narratorName = gender === 'female' ? '지영' : '준호';

  return `[SYSTEM: STRICT JSON OUTPUT ONLY - NO EXTRA TEXT]

당신은 **유튜브 쇼츠 바이럴 대본 전문 작가**입니다.
40~60대 한국 ${gender === 'female' ? '여성' : '남성'} 시청자가 "내 얘기잖아!" 하면서 끝까지 보게 만드는 대본을 작성하세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 주제: "${topic}"
📌 장르: ${genreGuide?.name || '일반'}
📌 타겟: 40~60대 한국 ${gender === 'female' ? '여성' : '남성'}
📌 화자: ${narratorSlot} (${narratorName})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 이 장르의 핵심
**${genreGuide?.description || ''}**

## 📈 감정 곡선
${genreGuide?.emotionCurve || ''}

## 🎲 창작 힌트
- 장소 힌트: ${seed.location}
- 소품 힌트: ${seed.object}  
- 신체반응 참고: ${seed.reaction}
- 오해 방향: ${seed.misunderstanding}
- 반전 유형: ${seed.twistType}
- 구체 반전(황당) 힌트: ${seed.truth} (예시, 복사 금지)

## 🎭 스토리 구조
${genreGuide?.structure || ''}

## 💬 킬러 대사
${genreGuide?.killerPhrases.map(p => `"${p}"`).join(', ') || ''}

## ⭐ 조연 대사 패턴
${genreGuide?.supportingCharacterPhrasePatterns?.map(p => `• ${p}`).join('\n') || '조연이 반전을 드러내는 대사를 자연스럽게 활용!'}

## 🫀 신체 반응 표현
${genreGuide?.bodyReactions.map(p => `"${p}"`).join(', ') || ''}

## ✅ 좋은 반전 예시
${genreGuide?.goodTwistExamples?.map(p => `• ${p}`).join('\n') || ''}

## ⭐ 조연 활용 반전 패턴
${genreGuide?.supportingCharacterTwistPatterns?.map(p => `• ${p}`).join('\n') || '조연이 반전의 핵심 역할을 하면 스토리가 더 재밌어짐!'}

## ❌ 절대 금지
${genreGuide?.forbiddenPatterns.map(p => `• ${p}`).join('\n') || ''}

## 🚨🚨🚨 예시 복사 절대 금지 🚨🚨🚨
**이 프롬프트에 나오는 모든 예시는 "형식/패턴 설명용"일 뿐입니다!**
❌ 예시 문장을 그대로 복사하면 즉시 실패!
✅ 예시는 패턴만 참고하고, 주제(topic)에 맞는 완전히 새로운 스토리를 창작!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ✅ 핵심 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 화자는 1인칭. **본인 이름 3인칭 금지**.
2. 인물 첫 등장 시 관계가 **자연스럽게 드러나게**.
3. 반전이 있으면 SETUP(2~3문장)에 **힌트 1개**.
4. 감정 직접 서술 금지. **행동/신체반응으로 표현**.
5. 제목은 구체적 상황으로 ("충격/반전" 같은 추상어 금지).
6. **항상 새로운 소재/상황/소품 조합**으로 창작 (기존 예시·전개 복제 금지).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📝 대본 형식 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 분량: 10~12문장
2. 문체: ~했어, ~했지, ~더라고, ~잖아 (친구한테 수다)
3. 대사: 작은따옴표 사용 ('이렇게 말했어')
${additionalContext ? `4. 추가 요청: ${additionalContext}` : ''}

## 👗 의상 설정 (이미지 프롬프트용)
- **Woman A (지영)**: ${womanAOutfit}
- **Woman B (혜경)**: ${womanBOutfit}  
- **Woman D (캐디)**: ${womanDOutfit}
- **Man A (준호)**: ${manAOutfit}
- **Man B (민수)**: ${manBOutfit}

## 💇 헤어스타일
- **Woman A (지영)**: long soft-wave hairstyle
- **Woman B (혜경)**: short chic bob cut
- **Man A (준호)**: short neat hairstyle
- **Man B (민수)**: clean short cut

<<<<<<< Updated upstream
## 🚨 이미지 프롬프트 절대 규칙 (위반 시 즉시 실패)
1. **longPrompt와 negativePrompt 분리**: 모든 씬의 longPrompt에는 PROMPT_CONSTANTS.START/END를 포함하고, negativePrompt 필드에는 PROMPT_CONSTANTS.NEGATIVE를 별도로 입력해야 함. (누락/변형 금지)
2. **캐릭터 정체성은 반드시 characters[].identity 필드 값을 그대로 사용**
3. **의상 앞에 반드시 "wearing" 키워드 추가** (characters[].outfitPrefix 참조)
4. **8개 모든 씬에서 identity/hair/body/outfit 문구 100% 동일** (문자열 한 글자도 바꾸지 말 것)
5. **캔디드 에스테틱 (Candid Aesthetic) & 카메라 시선**:
   - **Scene 1 (Hook)**: 시청자와의 연결을 위해 카메라를 정면 응시하며 미소 지을 것 (Eye contact, smiling at camera).
   - **Scene 2~8**: 자연스러운 일상의 찰나를 포착한 **Candid Shot**이어야 함. 캐릭터는 **카메라를 절대 응시하지 말고(Looking away from camera)** 자신의 행동이나 상대방에게 집중할 것. 인위적인 포즈(Posed) 금지.
6. **텍스트 금지**: 이미지 내에 어떠한 글자, 로고, 워터마크도 포함되지 않도록 "no text, no letters, no typography"를 강조할 것.
7. **투샷/쓰리샷에서는 각 인물마다 identity+hair+body+wearing+outfit 전체를 개별로 명시**
8. **배경은 1번 씬의 문구를 그대로 복붙** (장소 전환이 scriptLine에 명시된 경우만 변경 허용)
9. **의상 명칭 보존 (중요)**: \`shortPrompt\`와 \`longPrompt\` 모두에서 캐릭터에게 지정된 의상 명칭(예: "Pink & White Striped Knit + White Micro Short Pants")을 절대 요약하거나 일부를 생략하지 말고 **명칭 전체를 100% 동일하게 입력**할 것.
10. **[대괄호 템플릿] 형태 그대로 출력 금지** (실제 문장으로 채우기)

## 📸 샷 타입 규칙
| 상황 | 샷 타입 |
|-----|--------|
| 1명 행동/감정 | 원샷 |
| 2명 상호작용 | 투샷 |
| 3명 함께 | 쓰리샷 |

### 🚨 투샷/쓰리샷 longPrompt 작성 필수 규칙 (매우 중요!)
**여러 캐릭터가 등장할 때는 반드시 [Person 1], [Person 2], [Person 3]로 구분해야 합니다!**

✅ **원샷 예시** (1명):
\`\`\`
unfiltered raw photograph..., A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress, smiling at camera, snowy golf course, ...
\`\`\`

✅ **투샷 예시** (2명) - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress] [Person 2: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit] walking together, snowy golf course, ...
\`\`\`

✅ **쓰리샷 예시** (3명) - [Person 1], [Person 2], [Person 3] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A stunning Korean woman in her 40s, long soft-wave hairstyle, slim hourglass figure..., wearing Navy Dress] [Person 2: A stunning Korean woman in her 40s, short chic bob cut, slim hourglass figure..., wearing Teal Dress] [Person 3: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Charcoal Knit] standing together laughing, snowy golf course, ...
\`\`\`

✅ **남성 2명 투샷 예시** - [Person 1], [Person 2] 필수:
\`\`\`
unfiltered raw photograph..., [Person 1: A handsome Korean man in his 40s, short neat hairstyle, fit athletic build..., wearing Navy Polo] [Person 2: A handsome Korean man in his 40s, clean short cut hair, well-built physique..., wearing White Polo] walking together on a golf course...
\`\`\`

❌ **금지 (캐릭터 혼동 발생)**:
\`\`\`
A stunning Korean woman..., A stunning Korean woman..., A handsome Korean man..., walking together
\`\`\`
→ 구분자 없이 쉼표로만 연결하면 AI가 캐릭터를 혼동합니다!
=======
## 🚨 이미지 프롬프트 절대 규칙
1. **의상 일관성 (100% 복사)**: 각 캐릭터의 의상은 상단에 정의된 **"lockedOutfits"의 내용을 토씨 하나 틀리지 말고 그대로 복사**하여 사용하세요.
2. **액션 우선순위 (Action First)**: \`longPrompt\`에서 캐릭터 정보 바로 뒤에 **대본의 핵심 동작(윙크, 팔 치기, 당황한 표정 등)**을 가장 먼저 배치하세요.
3. **장르별 톤 준수**: 코미디 장르에선 **망가지는 표정, 당황한 눈빛, 어색한 포즈**를 구체적으로 묘사하세요.
4. **카메라 앵글**: 같은 앵글 2연속 금지. 와이드샷, 오버숄더, POV를 각각 최소 1개 이상 포함.
5. **Candid Aesthetic**: 1번 씬만 카메라 응시, 나머지는 카메라 외면.
>>>>>>> Stashed changes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (JSON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "title": "제목",
  "titleOptions": ["옵션1", "옵션2", "옵션3"],
  "scriptBody": "문장1\\n문장2...",
  "punchline": "펀치라인",
  "hook": "HOOK",
  "twist": "TWIST",
  "foreshadowing": "복선",
  "narrator": { "slot": "${gender === 'female' ? 'WomanA' : 'ManA'}", "name": "${narratorName}" },
  "emotionFlow": "${genreGuide?.emotionCurve || ''}",
  "lockedOutfits": {
    "womanA": "${womanAOutfit}",
    "womanB": "${womanBOutfit}",
    "womanD": "${womanDOutfit}",
    "manA": "${manAOutfit}",
    "manB": "${manBOutfit}",
    "winterOuterwear": "${winterOuterwear}",
    "winterAccessories": "${winterAccessories.join(', ')}"
  },
  "characters": [
    { "id": "WomanA", "name": "지영", "identity": "A stunning Korean woman in her ${targetAge}", "hair": "long soft-wave hairstyle", "body": "${PROMPT_CONSTANTS.FEMALE_BODY}", "outfit": "${womanAOutfit}", "outfitPrefix": "wearing" },
    { "id": "WomanB", "name": "혜경", "identity": "A stunning Korean woman in her ${targetAge}", "hair": "short chic bob cut", "body": "${PROMPT_CONSTANTS.FEMALE_BODY}", "outfit": "${womanBOutfit}", "outfitPrefix": "wearing" },
    { "id": "ManA", "name": "준호", "identity": "A handsome Korean man in his ${targetAge}", "hair": "short neat hairstyle", "body": "${PROMPT_CONSTANTS.MALE_BODY}", "outfit": "${manAOutfit}", "outfitPrefix": "wearing" },
    { "id": "ManB", "name": "민수", "identity": "A handsome Korean man in his ${targetAge}", "hair": "clean short cut", "body": "${PROMPT_CONSTANTS.MALE_BODY}", "outfit": "${manBOutfit}", "outfitPrefix": "wearing" },
    { "id": "WomanD", "name": "캐디", "identity": "A stunning Korean woman in her early 20s", "hair": "high-bun hairstyle", "body": "${PROMPT_CONSTANTS.FEMALE_BODY}", "outfit": "${womanDOutfit}", "outfitPrefix": "wearing" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
<<<<<<< Updated upstream
      "characterSlot": "캐릭터 슬롯",
      "shotType": "원샷 | 투샷 | 쓰리샷",
      "emotionBeat": "이 장면 감정",
      "summary": "장면 한줄 요약",
      "scriptLine": "이 장면 대사",
      "action": "캐릭터의 구체적 행동",
      "emotion": "시작감정 → 끝감정",
      
      "voiceType": "narration | lipSync | both | none",
      "narration": {
        "text": "TTS용 텍스트 (자연스러운 문장)",
        "emotion": "감정 (한글)",
        "speed": "slow | normal | slightly-fast | fast"
      },
      "lipSync": {
        "speaker": "WomanA | WomanB | ManA | ManB",
        "speakerName": "캐릭터 이름",
        "line": "대사 (한글)",
        "emotion": "감정 (영어)",
        "timing": "start | mid | end"
      },
      
      "shortPrompt": "간단한 영문 프롬프트",
      "shortPromptKo": "간단한 한글 프롬프트",
      "longPrompt": "${PROMPT_CONSTANTS.START}, [characters[해당캐릭터].identity 그대로 복사 예: A stunning Korean woman in her 40s], [characters[해당캐릭터].hair 그대로 복사], [characters[해당캐릭터].body 그대로 복사], wearing [characters[해당캐릭터].outfit 그대로 복사], [행동/표정], [배경], ${PROMPT_CONSTANTS.END}",
      "negativePrompt": "${PROMPT_CONSTANTS.NEGATIVE}",
      "longPromptKo": "상세 한글 프롬프트",
      "videoPrompt": "[한국어] 40대 한국인 여성이 [동작], [카메라 무빙], [조명/분위기]"
    }
  ]
}


## ✅ 최종 체크리스트 (전부 통과해야 함!)

**기본:**
1. ✅ scriptBody 10-12문장
2. ✅ 정확히 8개 scenes
3. ✅ 의상 일관성 (lockedOutfits)
4. ✅ JSON만 출력

**품질 (핵심):**
5. ✅ 화자(${narratorName})가 자기 이름 3인칭으로 안 씀?
6. ✅ 캐릭터 첫 등장 시 관계가 자연스럽게 드러남?
7. ✅ 반전 복선이 SETUP(2~3문장)에 있음?
8. ✅ 제목이 구체적? (충격/반전 같은 추상어 금지)
9. ✅ Show, Don't Tell 적용? (감정 직접 서술 금지)
10. ✅ 신체 반응 최소 2개?

**이미지 프롬프트 (필수!):**
11. ✅ 모든 longPrompt가 characters[].identity 값으로 시작? (예: "A stunning Korean woman in her 40s")
12. ✅ "Woman A (지영)" 형태 사용 안 함? (identity 필드 값만 사용!)
13. ✅ 의상 앞에 "wearing" 키워드 있음?
14. ✅ identity/hair/body/outfit 문구가 모든 씬에서 완전 동일?
15. ✅ 배경 문구가 장면 전환 없을 때 동일?
16. ✅ 투샷/쓰리샷에서 각 캐릭터 identity+hair+body+wearing+outfit 개별 명시?

**음성:**
17. ✅ 모든 씬에 voiceType 지정?
18. ✅ 작은따옴표 대사 있으면 lipSync 생성?
=======
      "characterSlot": "Slot",
      "shotType": "앵글",
      "scriptLine": "대사",
      "action": "동작",
      "emotion": "감정",
      "voiceType": "narration",
      "narration": { "text": "TTS", "emotion": "감정", "speed": "normal" },
      "shortPrompt": "short",
      "longPrompt": "${PROMPT_CONSTANTS.START}, [앵글], [캐릭터 identity/hair/body], wearing [outfit], [⚠️ action 동작], [배경], ${PROMPT_CONSTANTS.END}",
      "negativePrompt": "${PROMPT_CONSTANTS.NEGATIVE}"
    }
  ]
}
>>>>>>> Stashed changes
`;
};

export const buildLabImagePrompt = (options: LabImagePromptOptions): string => {
  const { sceneText, characterGender, characterAge, bodyType, outfit, style, includeQualityTags, includeAspectRatio } = options;
  const parts: string[] = [PROMPT_CONSTANTS.START];
  if (characterGender === 'female') {
    parts.push(`A stunning Korean woman in her ${characterAge}`, bodyType || PROMPT_CONSTANTS.FEMALE_BODY);
  } else {
    parts.push(`A handsome Korean man in his ${characterAge}`, bodyType || PROMPT_CONSTANTS.MALE_BODY);
  }
  if (outfit) parts.push(`wearing ${outfit}`);
  parts.push(sceneText);
  if (style) parts.push(style);
  if (includeQualityTags) parts.push(PROMPT_CONSTANTS.END);
  parts.push(PROMPT_CONSTANTS.NEGATIVE);
  if (includeAspectRatio && !parts.some(p => p.includes('--ar'))) parts.push('--ar 9:16');
  return parts.filter(Boolean).join(', ');
};

export interface PromptValidationResult { isValid: boolean; issues: string[]; fixedPrompt: string; }
export interface CharacterInfo { identity: string; hair: string; body: string; outfit: string; }

export const validateAndFixPrompt = (longPrompt: string, shotType: '원샷' | '투샷' | '쓰리샷', characters: CharacterInfo[]): PromptValidationResult => {
  const issues: string[] = [];
  let fixedPrompt = longPrompt;
  if (!longPrompt.includes('unfiltered raw photograph')) fixedPrompt = `${PROMPT_CONSTANTS.START}, ${fixedPrompt}`;
  if (!longPrompt.includes('NOT cartoon')) fixedPrompt = `${fixedPrompt}, ${PROMPT_CONSTANTS.NEGATIVE}`;
  return { isValid: issues.length === 0, issues, fixedPrompt };
};

export const pickRandomOutfit = (gender: 'female' | 'male', category: string): string => {
  if (gender === 'male') return pickMaleOutfit('', []);
  return pickFemaleOutfit('comedy-humor', '', []);
};

export const convertAgeToEnglish = (koreanAge: string): string => {
  const match = koreanAge.match(/(\d+)/);
  return match ? `${match[1]}s` : '40s';
};

export default {
  buildLabScriptPrompt,
  buildLabImagePrompt,
  pickRandomOutfit,
  pickFemaleOutfit,
  pickMaleOutfit,
  generateRandomSeed,
  convertAgeToEnglish,
  LAB_GENRE_GUIDELINES,
  MAMA_CHARACTER_PRESETS,
  PROMPT_CONSTANTS,
  RANDOM_SEED_POOLS
};

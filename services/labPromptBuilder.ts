/**
 * labPromptBuilder.ts
 * 쇼츠랩 전용 경량화 프롬프트 빌더
 * 
 * v3.1 업데이트 (2026-01-20):
 * - 40~60대 타겟 전면 리뉴얼
 * - 4개 장르 지침 강화 (감정 곡선, 신체 반응, 좋은/나쁜 예시)
 * - 화자(POV) 규칙 추가 - 자기 이름 3인칭 금지
 * - 캐릭터 관계 명시 규칙 추가
 * - 복선(Foreshadowing) 규칙 추가
 * - 씬-캐릭터 매칭 규칙 추가
 * - 음성 스크립트 추가 (나레이션 + 립싱크 선택)
 * - 의상 선택 개선 (장르 + 주제 기반)
 * - Show, Don't Tell 강제 규칙
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
    identity: 'A stunning Korean woman',
    bodyType: 'slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves',
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

  FEMALE_BODY: 'slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves, well-managed sophisticated look despite age, tight-fitting clothes accentuating curves naturally',

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
  }
};

// ============================================
// 40~60대 타겟 장르 지침 (v3.1)
// ============================================

export const LAB_GENRE_GUIDELINES: Record<string, {
  name: string;
  description: string;
  emotionCurve: string;
  structure: string;
  killerPhrases: string[];
  bodyReactions: string[];
  forbiddenPatterns: string[];
  goodTwistExamples: string[];
  badTwistExamples: string[];
}> = {

  // ============================================
  // 1. 코미디/유머
  // ============================================
  'comedy-humor': {
    name: '코미디/유머',
    description: '본인이 바보가 되는 민망한 상황. 시청자가 "에이~ 뭐야" 하면서 웃는 장르',

    emotionCurve: '😊 평화 → 😳 당황 → 😱 충격 → 🤦 민망 → 😂 자폭 웃음',

    structure: `
[HOOK] 😊 평화로운 시작 + 복선
→ "오늘 (장소)에서 완전 창피당했어"
→ 시청자 호기심 유발: "뭔데뭔데?"

[SETUP] 😌 일상적 상황 묘사 + 반전 힌트 슬쩍!
→ "(누구)랑 (뭐)하고 있었는데..."
→ 여기서 나중에 반전될 내용 복선으로 깔기

[BUILD-UP] 😳 뭔가 이상함 감지
→ "근데 사람들이 자꾸 쳐다보는 거야"
→ 신체반응 필수: 찜찜함, 불안감

[CLIMAX] 😱 진실 발견 순간
→ 거울, 사진, 누군가의 지적으로 발견
→ "그때 (누가) '언니/형 저기...' 하는 거야"

[TWIST] 🤦 민망한 진실 공개
→ "알고보니 (창피한 상황)이었던 거야"
→ SETUP의 복선과 연결!

[OUTRO] 😂 자폭 멘트
→ "아 진짜 쥐구멍에 숨고 싶었어"
`,

    killerPhrases: [
      '야, 저기 좀 봐봐',
      '언니 저기...',
      '어... 그게...',
      '아니 근데 왜 아무도 안 알려줘?',
      '그걸 왜 이제야 말해!',
      '아 진짜 죽고 싶었어',
      '얼굴을 어디다 들고 다녀',
      '그날 이후로 거기 못 가',
      '하필이면 그날따라',
      '에이~ 뭐야 그게',
      '아이고 창피해라',
      '내 참 기가 막혀서',
    ],

    bodyReactions: [
      '얼굴이 화끈거렸어',
      '땀이 삐질삐질 났어',
      '다리에 힘이 풀렸어',
      '목소리가 안 나오더라',
      '손으로 얼굴을 가렸어',
      '그 자리에 얼어붙었어',
      '심장이 철렁 내려앉았어',
      '귀까지 빨개지는 게 느껴졌어',
    ],

    forbiddenPatterns: [
      '지퍼 열림',
      '휴지 묻음',
      '코털/콧수염 관련',
      '이빨에 뭐 낌',
      '방귀/트림',
      '가발 벗겨짐',
      '대파/야채 소재',
      '다 같이 웃었다',
      '해피엔딩 마무리',
      '오해가 풀리며 훈훈',
      '쌍둥이 반전',
      '우연히 연예인 만남',
      '얼굴이 빨개졌다 (직접 서술 금지)',
      '심장이 터질 것 같았다 (직접 서술 금지)',
    ],

    goodTwistExamples: [
      '알고보니 블라우스를 뒤집어 입은 채로 하루종일 다님',
      '알고보니 한쪽 눈썹이 반쯤 지워진 채로 미팅함',
      '알고보니 치마가 스타킹에 끼여서 뒤태가 다 보였음',
      '알고보니 입가에 김치 묻은 채로 2시간째 대화함',
      '알고보니 셀카모드 켜진 줄 모르고 혼자 표정 연습하고 있었는데 뒤에 사람들이 다 보고 있었음',
      '알고보니 에어팟인 줄 알고 혼잣말 했는데 그냥 귀마개였음',
    ],

    badTwistExamples: [
      '알고보니 서프라이즈 파티 (뻔함)',
      '알고보니 몰래카메라 (불쾌함)',
      '알고보니 꿈이었음 (허무함)',
      '알고보니 대파가 가방에 (억지스러움)',
    ],
  },

  // ============================================
  // 2. 로맨스/설렘
  // ============================================
  'romance-flutter': {
    name: '로맨스/설렘',
    description: '중년의 설렘. 첫사랑 감성, 권태기 부부의 재발견, 예상치 못한 두근거림',

    emotionCurve: '😐 무덤덤 → 👀 의식됨 → 💓 두근 → 😳 당황 → 🤔 "나만 이런가?"',

    structure: `
[HOOK] 😐 평소와 다른 느낌 암시
→ "오늘따라 왜 그랬는지 모르겠어"
→ "그 사람이 갑자기 달라 보였어"

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
      '단톡방에서만 보던 사람인데 실제로 보니까 자꾸 눈이 갔어',
      '옆에 앉았는데 향수 냄새가... 집에 와서도 코끝에 남아있었어',
      '헤어질 때 "조심히 가"가 아니라 "연락해"라고 하더라',
    ],

    badTwistExamples: [
      '알고보니 나를 좋아했다 (너무 직접적)',
      '바로 고백받음 (전개 급함)',
      '꿈이었음 (허무)',
      '알고보니 유부남/유부녀 (불쾌)',
    ],
  },

  // ============================================
  // 3. 불륜/외도 의심
  // ============================================
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
      '알고보니 와이프가 건강검진 결과 걱정돼서 몰래 영양제 공부하고 있었음',
      '알고보니 딸이랑 짜고 내 환갑 축하 영상 만들고 있었음',
      '알고보니 남편이 내 명품백 중고로 팔아서 뭐하나 했더니 나 몰래 적금 들고 있었음',
    ],

    badTwistExamples: [
      '알고보니 회사 일 (너무 평범함)',
      '알고보니 친구 만남 (긴장감 대비 허무)',
      '실제 불륜이었음 (정책 위반)',
      '그냥 오해였음으로 끝남 (감동 없음)',
    ],
  },

  // ============================================
  // 4. 대박 반전 (매운맛)
  // ============================================
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
      '알고보니 허리 담 걸려서 일으켜 세우고 있었음',
      '알고보니 폰 비번 풀어달라고 손가락 억지로 가져다 대고 있었음 (지문인식)',
      '알고보니 새 구두 너무 꽉 껴서 억지로 벗기고 있었음',
      '알고보니 목걸이가 머리카락에 엉켜서 풀어주고 있었음',
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
// 의상 선택 함수 (v3.1 - 장르 기반)
// ============================================

export const pickFemaleOutfit = (
  genre: string,
  _topic: string = '',
  excludeOutfits: string[] = []
): string => {
  const isSexyGenre = genre === 'affair-suspicion';

  const candidates = UNIFIED_OUTFIT_LIST.filter(item => {
    if (item.categories.includes('MALE')) return false;
    if (excludeOutfits.includes(item.name)) return false;
    if (isSexyGenre) return item.categories.includes('SEXY');
    return !item.categories.includes('SEXY');
  });

  if (candidates.length === 0) {
    return 'White Halter-neck Knit + Red Micro Mini Skirt';
  }

  return candidates[Math.floor(Math.random() * candidates.length)].name;
};

export const pickMaleOutfit = (_topic: string = '', excludeOutfits: string[] = []): string => {
  const candidates = UNIFIED_OUTFIT_LIST.filter(item => {
    if (!item.categories.includes('MALE')) return false;
    if (excludeOutfits.includes(item.name)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return 'Black Knit Polo + Dark Indigo Denim';
  }

  return candidates[Math.floor(Math.random() * candidates.length)].name;
};

// ============================================
// 대본 생성용 프롬프트 (v3.1 - 완전판)
// ============================================

export const buildLabScriptPrompt = (options: LabScriptOptions): string => {
  const { topic, genre, targetAge, gender, additionalContext } = options;

  const genreGuide = LAB_GENRE_GUIDELINES[genre];
  const seed = generateRandomSeed();

  // 의상 선택 (장르 기반)
  const womanAOutfit = pickFemaleOutfit(genre, topic, []);
  const womanBOutfit = pickFemaleOutfit(genre, topic, [womanAOutfit]);
  const manAOutfit = pickMaleOutfit(topic, []);


  // 화자 설정
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

## 📈 감정 곡선 (이 흐름을 반드시 따라가세요!)
${genreGuide?.emotionCurve || ''}

## 🎲 창작 힌트 (영감용 - 억지로 다 넣지 마세요!)
- 장소 힌트: ${seed.location}
- 소품 힌트: ${seed.object}  
- 신체반응 참고: ${seed.reaction}
- 오해 방향: ${seed.misunderstanding}
- 반전 유형: ${seed.twistType}
- 구체 반전(황당) 힌트: ${seed.truth}


⚠️ **중요**: 주제(topic)가 최우선! 
⚠️ 힌트는 영감만 받고, 주제와 안 맞으면 무시하세요!

## 🎭 스토리 구조
${genreGuide?.structure || ''}

## 💬 킬러 대사 (자연스럽게 2~3개 녹이세요)
${genreGuide?.killerPhrases.map(p => `"${p}"`).join(', ') || ''}

## 🫀 신체 반응 표현 (최소 2개 필수!)
${genreGuide?.bodyReactions.map(p => `"${p}"`).join(', ') || ''}

## ✅ 좋은 반전 예시
${genreGuide?.goodTwistExamples?.map(p => `• ${p}`).join('\n') || ''}

## ❌ 절대 금지
${genreGuide?.forbiddenPatterns.map(p => `• ${p}`).join('\n') || ''}

## ❌ 나쁜 반전 예시
${genreGuide?.badTwistExamples?.map(p => `• ${p}`).join('\n') || ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ✅ 핵심 규칙 (간단/명확)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 화자는 1인칭. **본인 이름 3인칭 금지**.
2. 인물 첫 등장 시 관계가 **자연스럽게 드러나게**.
3. 반전이 있으면 SETUP(2~3문장)에 **힌트 1개**.
4. 감정 직접 서술 금지. **행동/신체반응으로 표현**.
5. 제목은 구체적 상황으로 ("충격/반전" 같은 추상어 금지).
6. titleOptions 3개는 **서로 다른 표현**으로 작성.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 📝 대본 형식 규칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 분량: 10~12문장
2. 문체: ~했어, ~했지, ~더라고, ~잖아 (친구한테 수다)
3. 대사: 작은따옴표 사용 ('이렇게 말했어')
4. 의상 이름 대본에 절대 언급 금지!
${additionalContext ? `5. 추가 요청: ${additionalContext}` : ''}

## 👗 의상 설정 (이미지 프롬프트용)
- **Woman A (지영)**: ${womanAOutfit}
- **Woman B (혜경)**: ${womanBOutfit}  
- **Man A (준호)**: ${manAOutfit}

## 💇 헤어스타일 (모든 씬 고정!)
- **Woman A (지영)**: long soft-wave hairstyle
- **Woman B (혜경)**: short chic bob cut
- **Man A (준호)**: short neat hairstyle

## 🚨 이미지 프롬프트 절대 규칙 (위반 시 즉시 실패)
1. **longPrompt와 negativePrompt 분리**: 모든 씬의 longPrompt에는 PROMPT_CONSTANTS.START/END를 포함하고, negativePrompt 필드에는 PROMPT_CONSTANTS.NEGATIVE를 별도로 입력해야 함. (누락/변형 금지)
2. **캐릭터 정체성은 반드시 characters[].identity 필드 값을 그대로 사용**
   - ✅ 올바름: "A stunning Korean woman in her 40s" (identity 필드 그대로)
   - ❌ 금지: "Woman A (지영)", "WomanA", "지영", "Korean woman" 등 임의 형식
3. **의상 앞에 반드시 "wearing" 키워드 추가** (characters[].outfitPrefix 참조)
   - ✅ 올바름: "wearing White Mock-neck Sleeveless + Burgundy Skirt"
   - ❌ 금지: "White Mock-neck Sleeveless + Burgundy Skirt" (wearing 없음)
4. **8개 모든 씬에서 identity/hair/body/outfit 문구 100% 동일** (문자열 한 글자도 바꾸지 말 것)
5. **characters[] 배열의 hair, body, outfit 문자열을 그대로 복사해서 사용** (축약/의역/재서술 금지)
6. **투샷/쓰리샷에서는 각 인물마다 identity+hair+body+wearing+outfit 전체를 개별로 명시**
7. **배경은 1번 씬의 문구를 그대로 복붙** (장소 전환이 scriptLine에 명시된 경우만 변경 허용)
8. **배경 문구는 씬마다 변형/축약/번역 금지**
9. **[대괄호 템플릿] 형태 그대로 출력 금지** (실제 문장으로 채우기)

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

❌ **금지 (캐릭터 혼동 발생)**:
\`\`\`
A stunning Korean woman..., A stunning Korean woman..., A handsome Korean man..., walking together
\`\`\`
→ 구분자 없이 쉼표로만 연결하면 AI가 캐릭터를 혼동합니다!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎙️ 음성 스크립트 규칙 (간단)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- **voiceType**: "narration" | "lipSync" | "both" | "none"
  - narration: 설명/묘사 위주
  - lipSync: 대사만 있는 경우
  - both: 설명 + 대사 혼합
  - none: 무음
- **narration.text**: scriptLine 기반 자연스러운 문장 (쉼표 강제 없음)
- **lipSync**: 작은따옴표 대사가 있을 때만 생성
  - line은 따옴표 안의 대사만 그대로

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⚠️ 출력 형식 (반드시 이 JSON 구조만!)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "title": "구체적이고 호기심 유발하는 제목 (15자 이내)",
  "titleOptions": ["제목옵션1", "제목옵션2", "제목옵션3"],
  "scriptBody": "문장1\\n문장2\\n...\\n문장10-12",
  "punchline": "핵심 펀치라인",
  "hook": "첫 문장 (HOOK)",
  "twist": "반전 문장 (TWIST)",
  "foreshadowing": "복선 문장 (SETUP에서 깐 힌트)",
  "narrator": {
    "slot": "${gender === 'female' ? 'WomanA' : 'ManA'}",
    "name": "${narratorName}"
  },
  "emotionFlow": "${genreGuide?.emotionCurve || ''}",
  "lockedOutfits": {
    "womanA": "${womanAOutfit}",
    "womanB": "${womanBOutfit}",
    "manA": "${manAOutfit}"
  },
  "characters": [
    {
      "id": "WomanA",
      "name": "지영",
      "identity": "A stunning Korean woman in her ${targetAge}",
      "relationToNarrator": "화자와의 관계 (예: 화자 본인, 화자의 와이프, 화자의 친구 등)",
      "slot": "Slot Woman A",
      "hair": "long soft-wave hairstyle",
      "body": "slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves",
      "outfit": "${womanAOutfit}",
      "outfitPrefix": "wearing",
      "accessories": "delicate gold hoop earrings, luxury watch"
    },
    {
      "id": "WomanB",
      "name": "혜경",
      "identity": "A stunning Korean woman in her ${targetAge}",
      "relationToNarrator": "화자와의 관계",
      "slot": "Slot Woman B",
      "hair": "short chic bob cut",
      "body": "slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves",
      "outfit": "${womanBOutfit}",
      "outfitPrefix": "wearing",
      "accessories": "pearl drop earrings, gold bangle bracelet"
    },
    {
      "id": "ManA",
      "name": "준호",
      "identity": "A handsome Korean man in his ${targetAge}",
      "relationToNarrator": "화자와의 관계",
      "slot": "Slot Man A",
      "hair": "short neat hairstyle",
      "body": "fit athletic build with broad shoulders, dandy and refined presence",
      "outfit": "${manAOutfit}",
      "outfitPrefix": "wearing",
      "accessories": "silver watch"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
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
        "speaker": "WomanA | WomanB | ManA",
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
      "videoPrompt": "영상용 프롬프트"
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
`;
};

// ============================================
// 이미지 프롬프트 생성 (개별 씬용)
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

  parts.push(PROMPT_CONSTANTS.START);

  if (characterGender === 'female') {
    parts.push(`A stunning Korean woman in her ${characterAge}`);
    parts.push(bodyType || PROMPT_CONSTANTS.FEMALE_BODY);
  } else {
    parts.push(`A handsome Korean man in his ${characterAge}`);
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

  parts.push(PROMPT_CONSTANTS.NEGATIVE);

  if (includeAspectRatio && !parts.some(p => p.includes('--ar'))) {
    parts.push('--ar 9:16');
  }

  return parts.filter(Boolean).join(', ');
};

// ============================================
// 프롬프트 검증 및 수정 레이어 (v3.2)
// ============================================

export interface PromptValidationResult {
  isValid: boolean;
  issues: string[];
  fixedPrompt: string;
}

export interface CharacterInfo {
  identity: string;
  hair: string;
  body: string;
  outfit: string;
}

/**
 * LLM이 생성한 longPrompt를 검증하고 필요시 수정합니다.
 * 특히 투샷/쓰리샷에서 캐릭터 구분자가 없으면 추가합니다.
 */
export const validateAndFixPrompt = (
  longPrompt: string,
  shotType: '원샷' | '투샷' | '쓰리샷',
  characters: CharacterInfo[]
): PromptValidationResult => {
  const issues: string[] = [];
  let fixedPrompt = longPrompt;

  // 1. 기본 검증: PROMPT_CONSTANTS 포함 여부
  if (!longPrompt.includes('unfiltered raw photograph')) {
    issues.push('START 문구 누락');
    fixedPrompt = `${PROMPT_CONSTANTS.START}, ${fixedPrompt}`;
  }

  if (!longPrompt.includes('NOT cartoon')) {
    issues.push('NEGATIVE 문구 누락');
    fixedPrompt = `${fixedPrompt}, ${PROMPT_CONSTANTS.NEGATIVE}`;
  }

  // 2. 투샷/쓰리샷 캐릭터 구분자 검증
  if (shotType === '투샷' || shotType === '쓰리샷') {
    const hasPersonTags = /\[Person \d+:/.test(longPrompt);

    if (!hasPersonTags) {
      issues.push('캐릭터 구분자 [Person N:] 누락 - 자동 수정 시도');

      // 캐릭터 구분자가 없는 경우 자동 수정 시도
      fixedPrompt = autoFixMultiCharacterPrompt(longPrompt, characters, shotType);
    }
  }

  // 3. wearing 키워드 검증
  if (longPrompt.includes('Dress') || longPrompt.includes('Skirt') || longPrompt.includes('Polo')) {
    // 의상 관련 키워드가 있지만 wearing이 없는 경우
    const outfitPatterns = ['Dress', 'Skirt', 'Polo', 'Knit', 'Blouse', 'Pants'];
    for (const pattern of outfitPatterns) {
      const regex = new RegExp(`(?<!wearing )${pattern}`, 'g');
      if (regex.test(fixedPrompt)) {
        // 의상 앞에 wearing이 없는 경우는 경고만 (자동 수정 어려움)
        issues.push(`의상 앞 "wearing" 누락 가능성 (${pattern})`);
        break;
      }
    }
  }

  // 4. identity 일관성 검증 (Korean woman/man 포함 여부)
  const expectedCharCount = shotType === '쓰리샷' ? 3 : (shotType === '투샷' ? 2 : 1);
  const koreanWomanCount = (fixedPrompt.match(/Korean woman/g) || []).length;
  const koreanManCount = (fixedPrompt.match(/Korean man/g) || []).length;

  if (koreanWomanCount + koreanManCount < expectedCharCount) {
    issues.push(`기대 캐릭터 수(${expectedCharCount})보다 적은 identity 발견(${koreanWomanCount + koreanManCount})`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    fixedPrompt
  };
};

/**
 * 캐릭터 구분자가 없는 투샷/쓰리샷 프롬프트를 자동으로 수정합니다.
 */
const autoFixMultiCharacterPrompt = (
  prompt: string,
  characters: CharacterInfo[],
  shotType: '투샷' | '쓰리샷'
): string => {
  const charCount = shotType === '쓰리샷' ? 3 : 2;
  const usedChars = characters.slice(0, charCount);

  if (usedChars.length < charCount) {
    // 캐릭터 정보가 부족하면 원본 반환
    return prompt;
  }

  // START 문구 추출
  const startMatch = prompt.match(/^(unfiltered raw photograph[^,]*,?\s*)/);
  const startPart = startMatch ? startMatch[1] : PROMPT_CONSTANTS.START + ', ';

  // 배경/액션 추출 (마지막 부분에서)
  const endPatterns = [
    /,?\s*(beautiful[^,]*background[^,]*)/i,
    /,?\s*(snowy[^,]*)/i,
    /,?\s*(golf course[^,]*)/i,
    /,?\s*(standing[^,]*)/i,
    /,?\s*(walking[^,]*)/i,
  ];

  let backgroundAction = '';
  for (const pattern of endPatterns) {
    const match = prompt.match(pattern);
    if (match) {
      backgroundAction = match[1];
      break;
    }
  }
  if (!backgroundAction) backgroundAction = 'standing together';

  // END/NEGATIVE 추출
  const hasEnd = prompt.includes('high-fashion');
  const endPart = hasEnd ? '' : `, ${PROMPT_CONSTANTS.END}`;
  const negativePart = prompt.includes('NOT cartoon') ? '' : `, ${PROMPT_CONSTANTS.NEGATIVE}`;

  // 캐릭터별 구분자 생성
  const characterParts = usedChars.map((char, idx) => {
    return `[Person ${idx + 1}: ${char.identity}, ${char.hair}, ${char.body}, wearing ${char.outfit}]`;
  });

  return `${startPart}${characterParts.join(' ')} ${backgroundAction}${endPart}${negativePart}`;
};

/**
 * 전체 scenes 배열의 프롬프트를 일괄 검증합니다.
 */
export const validateAllScenePrompts = (
  scenes: Array<{ longPrompt: string; shotType: string; characterSlot?: string }>,
  characters: CharacterInfo[]
): Array<PromptValidationResult> => {
  return scenes.map(scene => {
    const shotType = scene.shotType as '원샷' | '투샷' | '쓰리샷';
    return validateAndFixPrompt(scene.longPrompt, shotType, characters);
  });
};

// ============================================
// 하위 호환성 함수
// ============================================

export const pickLabOutfitByGenre = (
  gender: 'female' | 'male',
  genre: string
): string => {
  if (gender === 'male') {
    return pickMaleOutfit('', []);
  }
  return pickFemaleOutfit(genre, '', []);
};

export const pickLabMaleOutfit = (): string => {
  return pickMaleOutfit('', []);
};

export const pickRandomOutfit = (
  gender: 'female' | 'male',
  category: 'GOLF' | 'CASUAL' | 'ELEGANT' | 'BUSINESS'
): string => {
  if (gender === 'male') {
    return pickMaleOutfit('', []);
  }
  return pickFemaleOutfit('comedy-humor', '', []);
};

export const convertAgeToEnglish = (koreanAge: string): string => {
  const match = koreanAge.match(/(\d+)/);
  if (match) {
    return `${match[1]}s`;
  }
  return '40s';
};

// ============================================
// 레거시 프리셋
// ============================================

export const LAB_OUTFIT_PRESETS = {
  FEMALE: {
    GOLF: [
      'White V-neck fitted polo with micro pleated skirt',
      'Pink sleeveless polo with white tennis skirt',
      'Navy halter-neck knit with white micro shorts',
    ],
    CASUAL: [
      'White off-shoulder blouse with fitted jeans',
      'Navy fitted turtleneck with leather mini skirt',
    ],
    ELEGANT: [
      'Deep V-neck silk blouse with satin skirt',
      'Wine red wrap dress with subtle slit',
    ]
  },
  MALE: {
    GOLF: [
      'Navy slim-fit polo with white tailored pants',
      'White performance polo with beige chinos',
    ],
    BUSINESS: [
      'White shirt with navy blazer and grey slacks',
      'Charcoal double-breasted suit with black tie',
    ]
  }
};

export const LAB_STYLE_PRESETS = {
  cinematic: 'cinematic photography, film grain, dramatic lighting, shallow depth of field',
  kdrama: 'Korean drama aesthetic, soft romantic lighting, dreamy atmosphere',
  noir: 'film noir style, high contrast, dramatic shadows, moody atmosphere',
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
  convertAgeToEnglish,
  LAB_GENRE_GUIDELINES,
  LAB_OUTFIT_PRESETS,
  LAB_STYLE_PRESETS,
  MAMA_CHARACTER_PRESETS,
  PROMPT_CONSTANTS,
  RANDOM_SEED_POOLS
};

/**
 * 장르별 기본 지침
 * 각 장르의 특성에 맞는 스토리텔링 가이드라인
 */

import { apiClient, API_ENDPOINTS } from '../utils';

export interface GenreGuideline {
   id: string;
   name: string;
   description: string;
   prompt: string;
   isCustom?: boolean;
}

const LEGACY_STORAGE_KEY = 'shorts-generator-custom-genres';
const DELETED_DEFAULTS_KEY = 'shorts-genre-deleted-defaults';

// 삭제된 기본 장르 ID 목록 관리
const getDeletedDefaultIds = (): string[] => {
   if (typeof window === 'undefined') return [];
   try {
      const stored = localStorage.getItem(DELETED_DEFAULTS_KEY);
      return stored ? JSON.parse(stored) : [];
   } catch {
      return [];
   }
};

const addDeletedDefaultId = (id: string) => {
   if (typeof window === 'undefined') return;
   const current = getDeletedDefaultIds();
   if (!current.includes(id)) {
      current.push(id);
      localStorage.setItem(DELETED_DEFAULTS_KEY, JSON.stringify(current));
   }
};

const clearDeletedDefaults = () => {
   if (typeof window === 'undefined') return;
   localStorage.removeItem(DELETED_DEFAULTS_KEY);
};

// 삭제되지 않은 기본 장르만 가져오기
const getActiveDefaultGenres = (): GenreGuideline[] => {
   const deletedIds = getDeletedDefaultIds();
   return DEFAULT_GENRE_GUIDELINES.filter(g => !deletedIds.includes(g.id));
};

export const DEFAULT_GENRE_GUIDELINES: GenreGuideline[] = [
   {
      id: 'none',
      name: '선택안함',
      description: '장르 가이드라인 없이 자유로운 스토리 생성',
      prompt: '',  // 빈 프롬프트 - promptBuilder에서 제외됨
   },
   {
      id: 'affair-suspicion',
      name: '불륜/외도 의심',
      description: '배우자의 이상한 행동, 의심과 반전',
      prompt: `
[장르: 불륜/외도 의심]

 🔥 **쇼츠 최적화 규칙 (절대 준수)**
- **호흡**: 8~15문장 사이의 유연한 전개 (속도감 극대화)
- **구조**: 3단 반전(오해 -> 강화 -> 반전) 및 대사 중심(7:3 비율)
- **훅**: 첫 문장에 상황과 충격을 동시에 녹여낼 것
- **홍조 금지**: "얼굴이 빨개졌다" 등 진부한 표현 금지. 행동으로 묘사.
- **대화 위주**: 지루한 나레이션 대신 캐릭터 간의 맛깔나는 대화로 전개.
- **예시 (참고만 하되 창조할 것)**:
  "남편 차 시트 밑에서 낯선 여자 귀걸이가 나왔어.
  어제 세차했다더니, 이게 왜 여기 있지?
  남편은 당황하며 내 손에서 귀걸이를 뺏더라고.
  알고보니 내 생일 선물로 산 건데, 포장하다 흘린 거래.
  이게 뭐야 진짜, 사람 피 말리게."

 👥 **캐릭터 성별 표현 규칙**:
- **이름 사용**: 지영(WomanA), 준호(ManA) 등 CHARACTER_PRESETS 캐릭터만 사용
- **성별 명확화**: "지영 씨가 의심하며", "준호 씨가 당황하며"처럼 성별 확실히 표현
- **관계 명시**: 부부, 연인 관계를 명확히 표시
`
    },
   {
      id: 'friends-reunion',
      name: '친구/동창 관계',
      description: '옛 친구 재회, 동창회 이야기',
      prompt: `
[장르: 친구/동창 관계]

 🔥 **쇼츠 최적화 규칙 (절대 준수)**
- **호흡**: 8~15문장 사이의 유연한 전개
- **구조**: 3단 반전(오해 -> 강화 -> 반전) 및 대사 중심(7:3 비율)
- **훅**: 첫 문장에 과거의 인연과 현재의 긴장감을 동시에 녹여낼 것
- **홍조 금지**: 감정 과잉 금지. 차가운 눈빛이나 미세한 손떨림으로 표현.
- **대화 위주**: 캐릭터 간의 묘한 신경전을 맛깔나는 대화로 전개.
- **예시 (참고만 하되 창조할 것)**:
  "고등학교 때 날 괴롭히던 그 애가 내 상사로 왔어.
  커피를 타 오라며 내 어깨를 툭 치는데 소름이 돋더라고.
  복수를 다짐하며 그 애의 서랍을 열었지.
  거기엔 내 이름이 적힌 사과 편지가 가득하더라.
  이게 뭐야 진짜, 20년 만에 사과라니."

 👥 **캐릭터 성별 표현 규칙**:
- **이름 사용**: 지영(WomanA), 준호(ManA) 등 CHARACTER_PRESETS 캐릭터만 사용
- **성별 명확화**: "지영 씨가 기억하며", "준호 씨가 회피하며"처럼 성별 확실히 표현
- **과거 관계**: 학교 시절 관계를 명확히 표시
`
    },
    {
      id: 'comedy-humor',
      name: '코미디/유머',
      description: '웃긴 상황, 황당한 에피소드',
      prompt: `
[장르: 코미디/유머 - 중년의 일상 코미디]

 🎯 **코미디 원칙**: 중년이라서 더 웃긴 상황의 황당함과 리얼한 반응
- **핵심**: 나이 들면서 생기는 어이없는 상황, "나만 그런 거 아니구나" 공감
- **웃음 포인트**: "헐!", "이게 뭐야!", "아 진짜!" 같은 찐 반응
- **바이럴 규칙**: 3단 반전 및 대사 중심(7:3 비율) 준수

 🔥 **구조 (8-15문장)**:
1. **Hook**: 황당한 상황과 충격을 한 번에 ("오늘 헬스장에서 딸 레깅스 입고 운동했지 뭐야")
2. **Setup & Build-up**: 상황의 심화와 주변의 반응을 대화 위주로 전개
3. **Twist**: 예상 못한 현실적/유머러스한 반전으로 마무리

 👥 **캐릭터 설정**:
- **주인공**: 지영(WomanA) - 열정은 있지만 서툰 중년
- **조력자/목격자**: 준호(ManA), 혜경(WomanB) - 상황을 더 웃기게 만드는 역할
`
    },
   {
      id: 'romance-flutter',
      name: '로맨스/설렘',
      description: '감성적인 연애, 설렘 가득한 순간',
      prompt: `
[장르: 로맨스/설렘 - 성숙한 감성]

🎯 **로맨스 원칙**: 유치한 고백이나 뻔한 클리셰보다는 '절제된 떨림'과 '미묘한 분위기'를 강조
- **핵심 키워드**: 찰나의 시선, 스치는 손끝, 묘한 정적, 성숙한 대화
- **표현 방식**: 직접적인 "사랑해" 보다는 "오늘 향수 바뀌었네?" 같은 디테일한 관심
- **호칭 사용**: "오빠"라는 호칭은 관계에 따라 자연스럽게 사용 가능 (단, 유치하지 않게)

🚫 **금지 클리셰 (절대 사용 금지)**:
- "20년 만에", "10년 만에" 등 진부한 재회 설정 금지
- "흰 가루", "마약 오해" 등 억지스러운 반전 설정 금지
- "얼굴이 빨개졌다", "심장이 터질 것 같았다" 등 식상한 감정 묘사 금지

🔥 **쇼츠 최적화 규칙 (절대 준수)**
- **문장 수**: 10~12문장
- **구조**: 1.Hook(심쿵 선언) -> 2.Setup(일상적 만남) -> 3.Build-up(미묘한 텐션) -> 4.Climax(감정의 교차) -> 5.Ending(여운 있는 결말)
- **홍조 금지**: 시각적 묘사 대신 "시선을 어디에 둘지 몰랐다" 또는 "손끝이 미세하게 떨렸다"로 표현

👥 **캐릭터 성별 표현 규칙**:
- **이름 사용**: 지영(WomanA), 준호(ManA) 등 CHARACTER_PRESETS 캐릭터만 사용
- **성별 명확화**: "지영 씨가 머리를 쓸어넘기며", "준호 씨가 나직하게 웃으며"처럼 성별 확실히 표현

 🚫 **패턴/예시 복제 금지 (절대 준수)**:
 - 예시 문장처럼 보이는 고정 문구, 사건 흐름, 대사를 반복하지 마세요.
 - “낯설게 느껴졌다/손이 겹쳐졌다/정적이 흘렀다/심장이 뛰었다” 같은 익숙한 조합은 금지합니다.
 - 매번 **새로운 장소·소품·관계** 조합으로 시작하고 끝내세요.
`
    },

   {
      id: 'hit-twist-spicy',
      name: '🌶️ 대박 반전 (매운맛)',
      description: '100만 조회수 보장! 섹시한 오해와 건전한 반전의 아슬아슬한 줄타기',
      prompt: `
   [장르: 대박 반전(매운맛)]

🎯 ** 반전 원칙 **: 시청자가 야릇하거나 위험한 상황으로 100 % 착각하게 만든 뒤, 아주 건전하고 황당한 진실로 뒤통수를 친다.
- ** 전략 **: 이중적 의미의 대사, 묘한 숨소리, 좁은 공간 활용
   - ** 결과 **: "아, 뭐야~ ㅋㅋㅋ" 하는 반응 유발

🔥 ** 구조(5 STEPS) **:
1. ** Hook **: 도발적인 대사나 상황으로 시작("조금만 더... 깊숙이 넣어봐요.")
2. ** Setup **: 좁거나 어두운 장소 설정(차 안, 라커룸, 창고 등)
3. ** Build - up **: 오해를 증폭시키는 대사와 신음 섞인 반응("아, 거기... 너무 꽉 조여요!")
4. ** Climax **: 절정의 오해("누가 보면 어떡해!", "금방 끝나요, 조금만 참아!")
5. ** Twist **: 허무할 정도로 건전한 진실 공개(작은 신발 신기, 꽉 낀 뚜껑 열기, 골프 장갑 끼워주기 등)

👥 ** 캐릭터 성별 표현 규칙 **:
- ** 이름 사용 **: 지영(WomanA), 준호(ManA) 등 CHARACTER_PRESETS 캐릭터만 사용
   - ** 성별 명확화 **: "지영 씨가 끙끙대며", "준호 씨가 땀 흘리며"처럼 성별 확실히 표현
      - ** 오해 유발 **: 두 사람의 물리적 거리가 아주 가까운 상황 묘사
          `
   },
   {
      id: 'health-diet',
      name: '건강/다이어트',
      description: '중년의 절실함! 몸의 배신과 다이어트 분투기',
      prompt: `
[장르: 건강/다이어트 - 중년의 절실함]

🎯 **핵심**: 나이 들면서 몸이 말을 안 듣는 황당함과 절박함
- **공감 포인트**: "옛날엔 안 이랬는데", "물만 마셔도 살쪄", "계단이 무서워"

🔥 **구조 (10-12문장)**:
1. **Hook**: 몸의 배신 선언 ("오늘 아침에 바지가 안 잠겨서 진짜 멘붕 왔어")
2. **Setup**: 상황 설명 ("어제까진 분명히 맞았는데, 하룻밤 사이에 무슨 일이 생긴 거지?")
3. **Build-up**: 다이어트/운동 시도 ("큰맘 먹고 헬스장 등록해서 런닝머신 위에 올라갔지")
4. **Climax**: 예상 못한 고비/황당 상황 ("옆에서 뛰는 20대는 날아가는데, 난 5분 만에 다리가 후들거리더라고")
5. **Twist**: 현실적/유머러스한 반전 ("알고 보니 내가 입은 게 내 바지가 아니라 남편 꺼였지 뭐야")

👥 **캐릭터 설정**:
- **주인공**: 지영(WomanA) - 의욕은 넘치나 체력이 안 따라주는 캐릭터
- **성별 명명**: "지영 씨가 한숨 쉬며", "혜경 씨가 웃참하며" 등 명확히 기재
`
   },
   {
      id: 'married-life',
      name: '부부관계',
      description: '20년차의 리얼! 배우자의 수상한 행동과 반전',
      prompt: `
[장르: 부부관계 - 20년차의 리얼]

🎯 **핵심**: 오래된 부부의 케미, 투닥거림, 그리고 묘한 설렘이나 오해
- **공감 포인트**: "남편이 갑자기 친절해", "아내가 몰래 뭘 하는 것 같아"

🔥 **구조 (10-12문장)**:
1. **Hook**: 배우자의 수상한 행동 발견 ("무뚝뚝하던 남편이 갑자기 꽃다발을 들고 왔어")
2. **Setup**: 의심의 시작 ("혹시 뭐 잘못한 거 있나? 아니면 오늘 무슨 날인가?")
3. **Build-up**: 오해의 증폭 ("휴대폰을 자꾸 가리면서 웃는데, 진짜 촉이 오더라고")
4. **Climax**: 결정적 증거(?) 포착 ("드디어 남편 서랍에서 비밀 봉투를 찾아냈지")
5. **Twist**: 따뜻하거나 황당한 진실 ("알고 보니 20주년 기념 여행 가려고 몰래 비상금 모은 거였어")

👥 **캐릭터 설정**:
- **주인공 부부**: 지영(WomanA), 준호(ManA) - 현실적인 중년 부부 대화체 사용
`
   },
   {
      id: 'in-laws',
      name: '시댁/친정 갈등',
      description: '영원한 고민! 시월드와 처월드의 미묘한 신경전',
      prompt: `
[장르: 시댁/친정 - 영원한 고민]

🎯 **핵심**: 명절, 집안 행사의 미묘한 신경전과 반전
- **주의**: 악역 만들기 금지, 극단적 갈등 금지 (웃픈 상황 위주)

🔥 **구조 (10-12문장)**:
1. **Hook**: 시댁/친정 방문 전 긴박함 ("드디어 그날이 왔어, 시댁 김장하는 날")
2. **Setup**: 은근히 시작되는 신경전 ("어머니가 부르시는데 목소리 톤부터 다르시더라고")
3. **Build-up**: 눈치 싸움과 노력 ("최대한 열심히 하는데 자꾸만 옆에서 한마디씩 하셔")
4. **Climax**: 폭발 직전의 위기 ("결국 나도 한마디 하려는 찰나에...")
5. **Twist**: 예상 밖의 따뜻한 반전 ("어머니가 내 손을 꼭 잡으시더니 고생 많았다며 봉투를 쓱 주시네")

👥 **캐릭터 설정**:
- **주역**: 지영(WomanA)와 시어머니 또는 동서 등 관계 명확히 설정
`
   },
   {
      id: 'child-education',
      name: '자녀교육/입시',
      description: '학부모의 현실! 자녀 키우며 겪는 황당한 일들',
      prompt: `
[장르: 자녀교육 - 학부모의 현실]

🎯 **핵심**: 자녀 양육과 입시 현실 속에서의 웃픈 에피소드
- **공감 포인트**: "학원비가 내 월급", "공부 안 하는 자녀와의 전쟁"

🔥 **구조 (10-12문장)**:
1. **Hook**: 자녀의 성적이나 행동에 충격 ("드디어 시험 점수가 나왔는데 눈을 의심했어")
2. **Setup**: 해결을 위한 고군분투 ("학원을 더 보내야 하나, 내가 직접 가르쳐야 하나 고민했지")
3. **Build-up**: 자녀와의 미묘한 갈등 ("공부 좀 하라고 하면 자꾸 방으로 들어가 버려")
4. **Climax**: 결정적인 담판의 순간 ("결국 방문 열고 들어가서 소리 좀 질렀는데...")
5. **Twist**: 어이없지만 귀여운 반전 ("알고 보니 폰 보는 게 아니라 내 생일 축하 영상 편집 중이었대")

👥 **캐릭터 설정**:
- **주인공**: 지영(WomanA) - 자녀 걱정 많은 열혈 엄마
`
   },
   {
      id: 'work-life',
      name: '직장생활/퇴사',
      description: '40-50대의 현실! 상사와의 갈등과 퇴사 고민',
      prompt: `
[장르: 직장생활 - 40-50대의 현실]

🎯 **핵심**: 회사 생활의 애환, 젊은 상사와의 관계, 퇴사 고민
- **공감 포인트**: "나보다 어린 상사", "메일 쓰는 게 힘드네", "정년이 다가와"

🔥 **구조 (10-12문장)**:
1. **Hook**: 출근길의 무거운 발걸음 ("오늘따라 회사 가기가 미치게 싫더라고")
2. **Setup**: 사무실에서의 피곤한 일상 ("나이 어린 팀장이 자꾸만 영어 섞어가며 지시하는데 머리 아파")
3. **Build-up**: 퇴사 욕구가 치솟는 순간 ("사표를 낼까 말까 주머니 속 봉투만 만지작거렸지")
4. **Climax**: 결정적인 사표 제출의 타이밍 ("딱 말하려고 입을 뗐는데...")
5. **Twist**: 허무하고 서글픈 반전 ("팀장이 먼저 선수 쳤어, 자기 다음 주에 결혼한다고 축의금 명단 넘기네")

👥 **캐릭터 설정**:
- **주인공**: 준호(ManA) 또는 지영(WomanA) - 직함(부장, 차장 등) 명확히 사용
`
   }
];

// 내부 상태 (메모리 캐시)
let cachedGenres: GenreGuideline[] | null = null;
type GenreListener = (genres: GenreGuideline[]) => void;
const listeners = new Set<GenreListener>();

const notifyListeners = (genres: GenreGuideline[]) => {
   listeners.forEach(listener => listener(genres));
};

const normalizeCustomGenres = (genres: GenreGuideline[]) => {
   return genres.map(genre => ({ ...genre, isCustom: true }));
};

const mergeGenres = (customGenres: GenreGuideline[]) => {
   return [...getActiveDefaultGenres(), ...customGenres];
};

const readLegacyCustomGenres = (): GenreGuideline[] => {
   if (typeof window === 'undefined') return [];
   try {
      const stored = localStorage.getItem(LEGACY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
   } catch (e) {
      console.warn('Failed to read legacy genre storage', e);
      return [];
   }
};

const clearLegacyCustomGenres = () => {
   if (typeof window === 'undefined') return;
   try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
   } catch (e) {
      console.warn('Failed to clear legacy genre storage', e);
   }
};

const fetchCustomGenres = async (): Promise<GenreGuideline[]> => {
   const response = await apiClient.get<{ genres?: GenreGuideline[] }>(API_ENDPOINTS.GENRE_GUIDELINES);
   const genres = Array.isArray(response?.genres) ? response.genres : [];
   return normalizeCustomGenres(genres);
};

const saveCustomGenres = async (customGenres: GenreGuideline[]) => {
   const normalized = normalizeCustomGenres(customGenres);
   await apiClient.post(API_ENDPOINTS.GENRE_GUIDELINES, { genres: normalized });
};

export const genreManager = {
   getGenres: (): GenreGuideline[] => {
      return cachedGenres || [...getActiveDefaultGenres()];
   },

   subscribe: (listener: GenreListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
   },

   loadGenres: async (): Promise<GenreGuideline[]> => {
      try {
         let customGenres = await fetchCustomGenres();

         if (customGenres.length === 0) {
            const legacyGenres = normalizeCustomGenres(readLegacyCustomGenres());
            if (legacyGenres.length > 0) {
               await saveCustomGenres(legacyGenres);
               clearLegacyCustomGenres();
               customGenres = legacyGenres;
            }
         }

         cachedGenres = mergeGenres(customGenres);
      } catch (e) {
         console.error('Failed to load genres', e);
         if (!cachedGenres) {
            cachedGenres = [...getActiveDefaultGenres()];
         }
      }

      notifyListeners(cachedGenres!);
      return cachedGenres!;
   },

   addGenre: async (genre: GenreGuideline): Promise<GenreGuideline[]> => {
      const current = cachedGenres || mergeGenres(await fetchCustomGenres());
      const customGenres = current.filter(g => g.isCustom);
      const newGenre = { ...genre, isCustom: true };
      const updatedCustom = [...customGenres, newGenre];

      await saveCustomGenres(updatedCustom);
      cachedGenres = mergeGenres(updatedCustom);
      notifyListeners(cachedGenres);
      return cachedGenres;
   },

   deleteGenre: async (id: string): Promise<GenreGuideline[]> => {
      // 기본 장르인지 확인
      const isDefaultGenre = DEFAULT_GENRE_GUIDELINES.some(g => g.id === id);

      if (isDefaultGenre) {
         // 기본 장르는 삭제됨 목록에 추가
         addDeletedDefaultId(id);
      }

      // 커스텀 장르 필터링 (해당 ID 제외)
      const current = cachedGenres || mergeGenres(await fetchCustomGenres());
      const customGenres = current.filter(g => g.isCustom && g.id !== id);

      await saveCustomGenres(customGenres);
      cachedGenres = mergeGenres(customGenres);
      notifyListeners(cachedGenres);
      return cachedGenres;
   },

   updateGenre: async (id: string, updates: Partial<GenreGuideline>): Promise<GenreGuideline[]> => {
      const current = cachedGenres || mergeGenres(await fetchCustomGenres());
      const targetIndex = current.findIndex(g => g.id === id);
      if (targetIndex === -1) return current;

      const target = current[targetIndex];
      // 기본 장르는 수정 불가 (필요시 정책 변경 가능하지만 안전을 위해 막음)
      if (!target.isCustom) return current;

      const updatedGenre = { ...target, ...updates, isCustom: true };

      // 커스텀 장르 목록 업데이트
      const customGenres = current.filter(g => g.isCustom).map(g => g.id === id ? updatedGenre : g);
      await saveCustomGenres(customGenres);

      cachedGenres = mergeGenres(customGenres);
      notifyListeners(cachedGenres);
      return cachedGenres;
   },

   // 기본 장르 초기화 (삭제된 기본 장르 복원 포함)
   reset: async (): Promise<GenreGuideline[]> => {
      await saveCustomGenres([]);
      clearLegacyCustomGenres();
      clearDeletedDefaults(); // 삭제된 기본 장르도 복원
      cachedGenres = [...DEFAULT_GENRE_GUIDELINES];
      notifyListeners(cachedGenres);
      return cachedGenres;
   }
};

/**
 * 장르 ID로 지침 가져오기
 */
export const getGenreGuideline = (genreId: string): GenreGuideline | null => {
   // 'none' 또는 빈 문자열은 null 반환 (의도적 제외)
   if (!genreId || genreId === 'none') {
      return null;
   }

   // 장르 찾기
   const genre = genreManager.getGenres().find(g => g.id === genreId);

   // 못 찾으면 기본값 폴백 (affair-suspicion)
   if (!genre) {
      console.warn(`[genreGuidelines] 장르 ID "${genreId}"를 찾을 수 없습니다.기본값(affair - suspicion) 사용`);
      return genreManager.getGenres().find(g => g.id === 'affair-suspicion') || null;
   }

   return genre;
};

/**
 * 모든 장르 목록 (선택 UI용)
 */
export const getGenreOptions = (): Array<{ value: string; label: string; description: string }> => {
   return genreManager.getGenres().map(g => ({
      value: g.id,
      label: g.name,
      description: g.description
   }));
};

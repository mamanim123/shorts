export interface ShortsLabPromptRules {
  promptConstants: {
    START: string;
    FEMALE_BODY: string;
    FEMALE_BODY_A: string;
    FEMALE_BODY_B: string;
    FEMALE_BODY_C: string;
    FEMALE_BODY_D: string;
    MALE_BODY: string;
    MALE_BODY_A: string;
    MALE_BODY_B: string;
    END: string;
    NEGATIVE: string;
  };
  noTextTag: string;
  enforceKoreanIdentity: boolean;
  expressionKeywords: Record<string, Record<string, string>>;
  cameraMapping: Record<string, { angle: string; prompt: string }>;
  outfitSelection: {
    femaleAllowList: string[];
    femaleExcludeList: string[];
    maleAllowList: string[];
    maleExcludeList: string[];
    allowDuplicateFemale: boolean;
  };
  promptSections: {
    hairstyleSection?: string;
    characterSection?: string;
    outfitRulesSection?: string;
    imagePromptRulesExtra?: string;
  };
}

export const DEFAULT_PROMPT_RULES: ShortsLabPromptRules = {
  promptConstants: {
    START:
      'unfiltered raw photograph, 8k ultra photorealism, ultra detailed skin texture with visible pores and natural skin imperfections, professional cinematic lighting, RAW photo, real human skin texture, candid photography style',
    FEMALE_BODY:
      'slim hourglass figure with toned body, curvy feminine figure, glamorous silhouette, elegant feminine curves, voluptuous chest line, emphasizing chest line, deep cleavage, defined chest silhouette, well-managed sophisticated look despite age, tight-fitting clothes accentuating curves naturally',
    // 캐릭터별 체형 (v3.5.4 - 마마님 커스텀)
    FEMALE_BODY_A:
      'perfectly managed sophisticated look, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    FEMALE_BODY_B:
      'Petite and slim frame with an extraordinarily voluminous high-projection bust, surprising perky curves, charming presence, high-seated chest line',
    FEMALE_BODY_C:
      'Gracefully toned and slim athletic body, expertly managed sleek silhouette, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves, calm observer demeanor',
    FEMALE_BODY_D:
      'bright cheerful professional presence, high-seated chest line, extraordinarily voluminous high-projection bust, surprising perky curves',
    MALE_BODY: 'fit athletic build with broad shoulders, dandy and refined presence, well-groomed appearance, tailored slim-fit clothes',
    // 캐릭터별 남성 체형 (ManA vs ManB 차별화)
    MALE_BODY_A: 'fit athletic build with broad shoulders, refined intellectual appearance, scholarly gentleman presence, elegant facial features, well-groomed sophisticated look',
    MALE_BODY_B: 'fit athletic build with broad shoulders, strong masculine presence, rugged charm, defined jawline, dynamic energetic appearance',
    END:
      'high-fashion editorial refined, depth of field, shot on 85mm lens, f/1.8, realistic soft skin, 8k ultra-hd, no text, no captions, no typography, --ar 9:16',
    NEGATIVE:
      'NOT cartoon, NOT anime, NOT 3D render, NOT CGI, NOT plastic skin, NOT mannequin, NOT doll-like, NOT airbrushed, NOT overly smooth skin, NOT uncanny valley, NOT artificial looking, NOT illustration, NOT painting, NOT drawing'
  },
  noTextTag: 'no text, no letters, no typography, no watermarks, no words',
  enforceKoreanIdentity: true,
  expressionKeywords: {
    'romance-thrill': {
      hook: 'shy blushing smile, nervous fluttering eyes, heart-fluttering gaze',
      setup: 'curious gentle smile, soft anticipating eyes, subtle excitement',
      buildup: 'longing gaze, blushing cheeks, nervous lip bite, trembling anticipation',
      climax: 'intense eye contact, passionate expression, breathless surprise',
      twist: 'tearful happy smile, overwhelming emotion, touched expression',
      outro: 'warm loving smile, soft tender eyes, peaceful contentment'
    },
    'romance-flutter': {
      hook: 'shy blushing smile, nervous fluttering eyes, heart-fluttering gaze',
      setup: 'curious gentle smile, soft anticipating eyes, subtle excitement',
      buildup: 'longing gaze, blushing cheeks, nervous lip bite, trembling anticipation',
      climax: 'intense eye contact, passionate expression, breathless surprise',
      twist: 'tearful happy smile, overwhelming emotion, touched expression',
      outro: 'warm loving smile, soft tender eyes, peaceful contentment'
    },
    'comedy-humor': {
      hook: 'confident smirk, oblivious happy face, clueless cheerful expression',
      setup: 'proud satisfied smile, self-assured expression, relaxed confident look',
      buildup: 'slightly confused look, dawning realization, nervous smile',
      climax: 'shocked wide eyes, jaw-dropping surprise, mortified expression, embarrassed frozen face',
      twist: 'cringing embarrassment, facepalm moment, awkward grimace',
      outro: 'self-deprecating laugh, sheepish grin, resigned amusement'
    },
    'touching-warm': {
      hook: 'wistful nostalgic gaze, gentle reminiscing smile',
      setup: 'soft caring expression, warm loving eyes',
      buildup: 'concerned worried look, anxious caring face',
      climax: 'tearful emotional eyes, moved to tears, overwhelming gratitude',
      twist: 'surprised touched expression, happy crying, grateful smile',
      outro: 'peaceful warm smile, content happy tears, serene loving gaze'
    },
    'revenge-twist': {
      hook: 'subtle knowing smirk, mysterious confident gaze',
      setup: 'calm collected expression, patient calculating look',
      buildup: 'hidden satisfaction, suppressed smile, anticipating expression',
      climax: 'triumphant smile, victorious expression, satisfying smirk',
      twist: 'shocked frozen face, disbelief expression, stunned realization',
      outro: 'satisfied peaceful smile, justice-served expression, content relief'
    },
    'affair-suspicion': {
      hook: 'suspicious narrow eyes, doubtful expression, wary gaze',
      setup: 'nervous anxious look, subtle worry, guarded expression',
      buildup: 'increasingly tense face, paranoid look, jealous eyes',
      climax: 'shocked betrayed expression, devastated face, tearful anger',
      twist: 'relieved embarrassed smile, sheepish guilty look, apologetic expression',
      outro: 'reconciled warm smile, grateful tender eyes, loving forgiveness'
    },
    'hit-twist-spicy': {
      hook: 'intrigued raised eyebrow, curious smirk, mischievous gaze',
      setup: 'playful confident smile, teasing expression, sly look',
      buildup: 'escalating excitement, anticipating grin, building tension face',
      climax: 'explosive surprised face, jaw-dropping shock, mind-blown expression',
      twist: 'triumphant satisfied smirk, gotcha moment, victorious grin',
      outro: 'satisfied knowing smile, content smirk, entertained expression'
    },
    default: {
      hook: 'expressive engaging face, attention-grabbing expression',
      setup: 'natural relaxed expression, authentic genuine look',
      buildup: 'building tension face, anticipating expression',
      climax: 'peak emotion expression, intense dramatic face',
      twist: 'surprised realization, unexpected discovery face',
      outro: 'resolved peaceful expression, satisfying conclusion look'
    }
  },
  cameraMapping: {
    hook: {
      angle: 'close-up',
      prompt: 'close-up portrait shot, face in focus, shallow depth of field, dramatic lighting'
    },
    setup: {
      angle: 'drone/wide',
      prompt: 'drone shot, bird\'s-eye view, wide establishing shot, full body visible, environment context, cinematic framing'
    },
    buildup: {
      angle: 'over-the-shoulder',
      prompt: 'over-the-shoulder shot, conversational distance, layered depth, natural interaction, medium-wide framing'
    },
    climax: {
      angle: 'low-angle/wide',
      prompt: 'low angle wide shot, full body visible, heightened tension, dynamic perspective, cinematic framing'
    },
    twist: {
      angle: 'birds-eye/POV',
      prompt: 'bird\'s-eye view POV shot, unique perspective looking down, target looking at camera, heightened immersion'
    },
    outro: {
      angle: 'landscape/wide',
      prompt: 'wide landscape shot, relaxed framing, full body visible, warm natural lighting, detailed background'
    }
  },
  outfitSelection: {
    femaleAllowList: [],
    femaleExcludeList: [],
    maleAllowList: [],
    maleExcludeList: [],
    allowDuplicateFemale: false
  },
  promptSections: {
    hairstyleSection: `## 💇 헤어스타일 세부 규칙

1. **WomanA (지영)**: long soft-wave hairstyle (어깨 아래 긴 웨이브)
   - 모든 씬에서 정확히 "long soft-wave hairstyle" 사용
   - 절대 "wavy hair", "long hair"로 축약 금지

2. **WomanB (혜경)**: short chic bob cut (턱선 단발)
   - 모든 씬에서 정확히 "short chic bob cut" 사용
   - 절대 "bob", "short hair"로 축약 금지

3. **WomanD (캐디)**: high ponytail / sleek bun (활동적인 스타일)
   - 골프 관련 주제: "high sleek ponytail"
   - 기타 주제: "elegant low bun"

4. **ManA (준호)**: clean short cut (단정한 짧은 머리)
   - 모든 씬에서 "clean short cut" 사용

5. **ManB (민수)**: short neat hairstyle (깔끔한 스타일)
   - 모든 씬에서 "short neat hairstyle" 사용

⚠️ **절대 규칙**: 헤어스타일 명칭은 한 글자도 바꾸지 말고 위 정확한 명칭 사용`,
    characterSection: `## 👥 캐릭터 관계 및 상호작용 규칙

1. **캐릭터 관계 명시**:
   - 첫 등장 씬에서 관계를 자연스럽게 드러내기
   - "내 친구 혜경이", "남편 준호", "회사 동료 민수" 등

2. **시선 처리**:
   - Scene 1 (Hook): 카메라 정면 응시 + 미소 (looking at camera, smiling)
   - Scene 2~12: 자연스러운 캔디드 샷 (looking away from camera, natural candid moment)

3. **투샷/쓰리샷 상호작용**:
   - 각 캐릭터의 행동을 서로 다르게 명시
   - 예: [Person 1: smiling and gesturing with hands] [Person 2: listening attentively, nodding]
   - 금지: 같은 행동 반복 (both smiling, both laughing)

4. **POV (1인칭 시점) 샷 특수 규칙**:
   - "지영의 시선에서" = 지영 제외, 보이는 대상만 프롬프트에 포함
   - "준호가 보는" = 준호 제외, 앞에 있는 사람만 포함`,
    outfitRulesSection: '',
    imagePromptRulesExtra: `## 🎨 이미지 품질 향상 규칙

1. **배경 일관성**:
   - Scene 1에서 설정한 배경(골프장, 카페 등)은 장소 전환이 명시되지 않는 한 모든 씬에서 동일하게 유지
   - 배경 묘사 복사: "snowy golf course with luxury clubhouse background" → 전체 문구 그대로 복사

2. **조명 일관성**:
   - 시간대를 Scene 1에서 명시 (morning sunlight / afternoon warm light / evening golden hour)
   - 이후 모든 씬에서 동일한 조명 환경 유지

3. **계절/날씨 일관성**:
   - 겨울(snowy), 봄(cherry blossoms), 여름(bright sunny), 가을(autumn leaves) 중 하나로 통일
   - Scene 1에서 설정한 날씨를 모든 씬에 적용

4. **소품 일관성**:
   - 안경, 시계, 반지 등의 소품은 Scene 1에 명시했다면 모든 씬에서 동일하게 포함
   - 골프채, 골프공, 카트 등 주제 관련 소품도 일관성 유지

5. **NO TEXT 강조 (매우 중요)**:
   - 모든 longPrompt 끝에 "no text, no letters, no typography, no watermarks, no logos, no signs, no captions" 반드시 포함
   - 특히 골프장, 카페 등 간판/표지판이 있을 수 있는 장소에서는 2번 강조`
  }
};

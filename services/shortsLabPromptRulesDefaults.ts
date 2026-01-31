export interface ShortsLabPromptRules {
  promptConstants: {
    START: string;
    FEMALE_BODY: string;
    FEMALE_BODY_A: string;
    FEMALE_BODY_B: string;
    FEMALE_BODY_C: string;
    FEMALE_BODY_D: string;
    MALE_BODY: string;
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
    hairstyleSection: '',
    characterSection: '',
    outfitRulesSection: '',
    imagePromptRulesExtra: ''
  }
};

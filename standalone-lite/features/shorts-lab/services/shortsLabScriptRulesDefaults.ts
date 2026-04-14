export interface ShortsLabScriptRules {
  coreRules: string[];
  formatRules: string[];
}

export const DEFAULT_SCRIPT_RULES: ShortsLabScriptRules = {
  coreRules: [
    '화자는 1인칭. 본인 이름 3인칭 금지.',
    '첫 문장은 반드시 질문형/충격형/관계 의심형 Hook으로 시작. 배경 설명, 인사, 평범한 도입 금지.',
    '인물 첫 등장 시 관계가 자연스럽게 드러나게.',
    '반전이 있으면 SETUP(2~3문장)에 힌트 1개.',
    '구조는 오해 유발 → 오해 강화 → 반전 폭발의 3단 구조를 유지.',
    '감정 직접 서술 금지. 행동/신체반응으로 표현.',
    '마지막 문장은 반드시 가장 강한 반전 대사 또는 펀치라인으로 마무리.',
    '제목은 구체적 상황으로 ("충격/반전" 같은 추상어 금지).',
    '항상 새로운 소재/상황/소품 조합으로 창작 (기존 예시/전개 복제 금지).'
  ],
  formatRules: [
    '분량: 10~12문장',
    '대사 비율: 전체 문장의 70% 이상',
    '첫 문장 길이: 18자 이상 32자 이하 권장',
    '문체: ~했어, ~했지, ~더라고, ~잖아 (반말 구어체 고정)',
    '존댓말(~요/~습니다) 금지',
    "대사: 작은따옴표 사용 ('이렇게 말했어')",
    'openingCaption은 첫 1초 자막용 한 줄로 작성',
    'openingLine은 scriptLines의 첫 문장과 반드시 동일',
    'closingPunch는 scriptLines의 마지막 문장과 반드시 동일'
  ]
};

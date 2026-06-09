export interface V4SceneInput {
  scenes: any[];
  profiles: any[];
  outfitMap: Map<string, { name: string; prompt: string }>;
}

export function applyCharacterProfilesToScenesV4(input: V4SceneInput): any[] {
  const { scenes, profiles, outfitMap } = input;

  return scenes.map((scene) => {
    const characterIds: string[] = scene.characterIds || [];
    const profileBlocks = characterIds
      .map((slotId) => profiles.find((p) => p.slotId === slotId))
      .filter(Boolean)
      .map((profile) => [
        `${profile.slotId} (${profile.name})`,
        profile.identity,
        profile.face,
        profile.hair,
        profile.body,
        profile.style,
        profile.skinTone,
        profile.signatureFeatures,
        profile.outfitPrompt || profile.outfit
      ].filter(Boolean).join(', '))
      .join(' | ');

    return {
      ...scene,
      prompt: [
        profileBlocks,
        scene.background,
        scene.action,
        scene.cameraAngle || scene.camera,
        scene.longPrompt || scene.prompt
      ].filter(Boolean).join(', '),
      characterProfilesApplied: true
    };
  });
}

// ============================================
// [V4] 씬 배정 프롬프트 — 고정 슬롯 목록 중에서만 선택
// LLM은 (1) 대본을 문장별로 나누고 (2) 각 문장에 등장하는 인물을
// "주어진 고정 슬롯 목록"에서만 고른다. 인물 신규 생성/추출 금지.
// 의상/배경/외모는 LLM이 만들지 않는다(코드가 조립).
// ============================================

export interface V4SceneAssignSlot {
  slotId: string;   // WomanA ...
  name: string;     // 혜진 ...
  role?: string;    // 주인공/조연/내레이터 등
}

export interface V4SceneAssignParams {
  scriptBody: string;       // 줄 단위 대본
  slots: V4SceneAssignSlot[];
  background: string;       // 영상 전체 고정 배경(영문)
}

export function buildV4SceneAssignmentPrompt(params: V4SceneAssignParams): string {
  const { scriptBody, slots, background } = params;
  const lines = scriptBody.split('\n').map(s => s.trim()).filter(Boolean);

  const slotTable = slots
    .map(s => `- ${s.slotId} = ${s.name}${s.role ? ` (${s.role})` : ''}`)
    .join('\n');

  const numberedLines = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');

  return `너는 영상 콘티 배정 전문가다. 아래 대본을 장면으로 나누고, 각 장면에 등장하는 인물을 "고정 캐릭터 목록"에서만 골라라.

## 절대 규칙
1. characterIds는 반드시 아래 목록의 slotId만 사용한다. 새 인물 생성/추측 금지.
2. 대본 문장 1개 = 장면 1개. 문장 순서와 개수를 그대로 유지한다.
3. 그 문장에서 화면에 실제로 보이는 인물만 넣는다. 억지로 여러 명 넣지 마라(1인 장면은 1명).
4. 의상/외모/배경/카메라 묘사는 절대 만들지 마라. characterIds와 action만 정한다.
5. action은 그 문장의 핵심 동작을 영어 5~12단어로 간결히.

## 고정 캐릭터 목록 (이 slotId만 사용)
${slotTable}

## 고정 배경 (모든 장면 동일, 참고용)
${background || '(미지정)'}

## 대본
${numberedLines}

## 출력 (JSON만, 설명 금지)
{
  "scenes": [
    { "sceneNumber": 1, "scriptLine": "원문 그대로", "characterIds": ["WomanA"], "action": "short english action" }
  ]
}`;
}

export function parseV4SceneAssignment(text: string, allowedSlotIds: string[]): Array<{
  sceneNumber: number; scriptLine: string; characterIds: string[]; action: string;
}> {
  let clean = String(text || '').trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) clean = m[0];
  let parsed: any;
  try { parsed = JSON.parse(clean); } catch { return []; }
  const allow = new Set(allowedSlotIds);
  const out = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  return out.map((s: any, i: number) => {
    const ids = (Array.isArray(s.characterIds) ? s.characterIds : [])
      .map((x: any) => String(x || '').trim())
      .filter((x: string) => allow.has(x));   // 고정 목록 밖이면 제거
    return {
      sceneNumber: s.sceneNumber || i + 1,
      scriptLine: String(s.scriptLine || '').trim(),
      characterIds: Array.from(new Set(ids)),
      action: String(s.action || '').trim()
    };
  });
}

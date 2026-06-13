// services/shorts-lab/sceneDiagnostics.ts
// 읽기 전용 Scene 진단기 (Phase 1)
// 기존 로직/프롬프트를 절대 변경하지 않는다. scene 배열을 받아 문제만 리포트한다.
//
// 주의: 런타임 scene은 types.ts의 Scene보다 많은 필드를 동적으로 가진다.
// (shotType, cameraAngle, camera, imageUrl, prompt 등) 그래서 확장 타입으로 받는다.

import type { Scene } from '../../types';

/** 런타임에 동적으로 붙는 필드까지 포함한 느슨한 Scene 타입 */
export type DiagnosableScene = Partial<Scene> & {
  sceneNumber?: number;
  shortPrompt?: string;
  longPrompt?: string;
  prompt?: string;          // 레거시 fallback
  scriptLine?: string;
  text?: string;
  shotType?: string;
  cameraAngle?: string;
  camera?: string;
  background?: string;
  imageUrl?: string;
  characterIds?: string[];
  characterNames?: string[];
  [key: string]: unknown;
};

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface SceneDiagnosticIssue {
  severity: DiagnosticSeverity;
  sceneNumber?: number;
  code: string;
  message: string;
}

export interface SceneDiagnosticsContext {
  /** 슬롯 규칙에 존재하는 캐릭터 ID 목록 (있으면 캐릭터 ID 유효성 검사) */
  knownCharacterIds?: string[];
  /** 기대 Person 블록 수 검사를 위한 prompt 내부 Person 카운트 함수(선택) */
}

/** 코드에서 일관되게 쓰이는 프롬프트 우선순위: longPrompt -> shortPrompt -> prompt */
export function resolveScenePrompt(scene: DiagnosableScene): string {
  return String(scene.longPrompt || scene.shortPrompt || scene.prompt || '').trim();
}

/** 한국어 샷타입/캐릭터수 매핑 */
function expectedCharCountForShotType(shotType?: string): number | null {
  if (!shotType) return null;
  const s = String(shotType);
  if (s.includes('원샷') || /one\s*shot/i.test(s)) return 1;
  if (s.includes('투샷') || /two\s*shot/i.test(s)) return 2;
  if (s.includes('쓰리샷') || /three\s*shot/i.test(s)) return 3;
  return null;
}

function countPersonBlocks(prompt: string): number {
  const matches = prompt.match(/Person\s*\d+/gi);
  if (!matches) return 0;
  // 중복 제거 (Person 1, Person 2 ...)
  return new Set(matches.map(m => m.replace(/\s+/g, '').toLowerCase())).size;
}

/**
 * 단일 scene 진단 (읽기 전용).
 */
export function diagnoseScene(
  scene: DiagnosableScene,
  context: SceneDiagnosticsContext = {}
): SceneDiagnosticIssue[] {
  const issues: SceneDiagnosticIssue[] = [];
  const sceneNumber = typeof scene.sceneNumber === 'number' ? scene.sceneNumber : undefined;
  const add = (severity: DiagnosticSeverity, code: string, message: string) =>
    issues.push({ severity, sceneNumber, code, message });

  // 1. scene number 누락
  if (typeof scene.sceneNumber !== 'number') {
    add('error', 'SCENE_NUMBER_MISSING', 'sceneNumber가 없거나 숫자가 아닙니다.');
  }

  // 2. script/text 누락
  const scriptText = String(scene.scriptLine || scene.text || '').trim();
  if (!scriptText) {
    add('warning', 'SCRIPT_TEXT_MISSING', '대본 라인(scriptLine/text)이 비어 있습니다.');
  }

  // 3. prompt 누락 (longPrompt/shortPrompt/prompt 모두 빈 경우)
  const prompt = resolveScenePrompt(scene);
  if (!prompt) {
    add('error', 'PROMPT_EMPTY', '이미지 프롬프트(longPrompt/shortPrompt/prompt)가 비어 있습니다.');
  }

  // 4. characterIds 누락
  const characterIds = Array.isArray(scene.characterIds) ? scene.characterIds : [];
  if (characterIds.length === 0) {
    add('warning', 'CHARACTER_IDS_EMPTY', 'characterIds가 비어 있습니다.');
  }

  // 5. 슬롯 규칙에 없는 캐릭터 ID
  if (context.knownCharacterIds && context.knownCharacterIds.length > 0 && characterIds.length > 0) {
    const known = new Set(context.knownCharacterIds);
    const unknown = characterIds.filter(id => !known.has(id));
    if (unknown.length > 0) {
      add('error', 'CHARACTER_ID_UNKNOWN', `슬롯 규칙에 없는 캐릭터 ID: ${unknown.join(', ')}`);
    }
  }

  // 6. shotType과 캐릭터 수 불일치
  const expected = expectedCharCountForShotType(scene.shotType);
  if (expected !== null && characterIds.length > 0 && expected !== characterIds.length) {
    add(
      'warning',
      'SHOTTYPE_CHARCOUNT_MISMATCH',
      `shotType(${scene.shotType})은 ${expected}명 기대인데 characterIds는 ${characterIds.length}명입니다.`
    );
  }

  // 7. prompt 내부 Person 블록 수 불일치 (다중 인물일 때만 의미)
  if (prompt && characterIds.length >= 2) {
    const personBlocks = countPersonBlocks(prompt);
    if (personBlocks > 0 && personBlocks !== characterIds.length) {
      add(
        'warning',
        'PERSON_BLOCK_MISMATCH',
        `prompt 내 Person 블록 ${personBlocks}개 vs characterIds ${characterIds.length}개 불일치.`
      );
    }
  }

  // 8. camera 누락 (shotType/cameraAngle/camera 어느 것도 없고 prompt에도 camera 단서 없음)
  const hasCameraField = !!(scene.cameraAngle || scene.camera);
  if (!hasCameraField && prompt && !/camera|angle|shot|view/i.test(prompt)) {
    add('info', 'CAMERA_MISSING', '카메라 앵글 정보가 필드/프롬프트 어디에도 없습니다.');
  }

  // 9. background 누락
  const hasBackground = !!String(scene.background || '').trim();
  if (!hasBackground && prompt && !/background|backdrop|setting|location/i.test(prompt)) {
    add('info', 'BACKGROUND_MISSING', '배경 정보가 필드/프롬프트 어디에도 없습니다.');
  }

  return issues;
}

/**
 * scene 배열 전체 진단 (읽기 전용).
 */
export function diagnoseScenes(
  scenes: DiagnosableScene[] | undefined | null,
  context: SceneDiagnosticsContext = {}
): SceneDiagnosticIssue[] {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return [{ severity: 'warning', code: 'SCENES_EMPTY', message: 'scene 배열이 비어 있습니다.' }];
  }
  const all: SceneDiagnosticIssue[] = [];
  for (const scene of scenes) {
    all.push(...diagnoseScene(scene, context));
  }
  return all;
}

/** 진단 결과 요약 (콘솔/패널 표시용) */
export function summarizeDiagnostics(issues: SceneDiagnosticIssue[]): {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
} {
  let errors = 0, warnings = 0, infos = 0;
  for (const i of issues) {
    if (i.severity === 'error') errors++;
    else if (i.severity === 'warning') warnings++;
    else infos++;
  }
  return { errors, warnings, infos, total: issues.length };
}

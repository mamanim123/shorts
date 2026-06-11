import type { V4OutfitEntry, V4PanelScene, V4ValidationIssue } from './v4Types';

const countPersonBlocks = (prompt: string): number => {
  const matches = prompt.match(/\[(?:Person\s+\d+|Reference Character)\s*:/g);
  return matches ? matches.length : 0;
};

export const validateV4Scenes = (params: {
  scriptBody: string;
  allowedSlotIds: string[];
  scenes: V4PanelScene[];
  outfitMap: Map<string, V4OutfitEntry>;
}): V4ValidationIssue[] => {
  const issues: V4ValidationIssue[] = [];
  const lines = params.scriptBody.split('\n').map((line) => line.trim()).filter(Boolean);
  const allowed = new Set(params.allowedSlotIds);

  if (params.scenes.length !== lines.length) {
    issues.push({
      severity: 'warning',
      code: 'SCENE_COUNT_MISMATCH',
      message: `대본 라인 ${lines.length}개와 씬 ${params.scenes.length}개가 다릅니다.`
    });
  }

  params.scenes.forEach((scene, index) => {
    const expectedNumber = index + 1;
    if (scene.number !== expectedNumber) {
      issues.push({
        severity: 'warning',
        sceneNumber: scene.number,
        code: 'SCENE_NUMBER_GAP',
        message: `씬 번호가 연속되지 않습니다. 기대값 ${expectedNumber}, 실제값 ${scene.number}`
      });
    }

    const ids = scene.characterIds || [];
    ids.forEach((slotId) => {
      if (!allowed.has(slotId)) {
        issues.push({
          severity: 'error',
          sceneNumber: scene.number,
          code: 'UNKNOWN_SLOT',
          message: `허용되지 않은 캐릭터 슬롯 ${slotId}가 사용되었습니다.`
        });
      }
      if (!params.outfitMap.has(slotId)) {
        issues.push({
          severity: 'warning',
          sceneNumber: scene.number,
          code: 'MISSING_OUTFIT',
          message: `${slotId} 의상이 고정되지 않았습니다.`
        });
      }
    });

    const promptPersonCount = countPersonBlocks(scene.prompt || '');
    const expectedPersonCount = ids.length;
    if (promptPersonCount !== expectedPersonCount) {
      issues.push({
        severity: 'error',
        sceneNumber: scene.number,
        code: 'PERSON_COUNT_MISMATCH',
        message: `프롬프트 Person 블록 ${promptPersonCount}개와 characterIds ${expectedPersonCount}개가 다릅니다.`
      });
    }

    if (!scene.prompt?.trim()) {
      issues.push({
        severity: 'error',
        sceneNumber: scene.number,
        code: 'EMPTY_PROMPT',
        message: '이미지 프롬프트가 비어 있습니다.'
      });
    }
  });

  return issues;
};

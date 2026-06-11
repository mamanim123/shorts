import { resolveV4StoryContext } from './v4StorylineService';
import { generateV4ScriptOnly } from './v4ScriptService';
import { getV4AllowedSlotIds, getV4FixedSlots } from './v4SlotService';
import { generateV4SceneAssignment } from './v4SceneAssignmentService';
import { resolveV4Outfits } from './v4OutfitService';
import { buildV4Scenes } from './v4PromptFactory';
import { validateV4Scenes } from './v4Validator';
import { saveV4Result } from './v4PersistenceService';
import type { V4FlowInput, V4FlowResult, V4ScenePlan } from './v4Types';

const normalizeScriptLines = (scriptBody: string): string[] => (
  scriptBody.split('\n').map((line) => line.trim()).filter(Boolean)
);

const fallbackScenePlans = (params: {
  scriptBody: string;
  fallbackSlotId: string;
}): V4ScenePlan[] => (
  normalizeScriptLines(params.scriptBody).map((line, index) => ({
    sceneNumber: index + 1,
    scriptLine: line,
    characterIds: [params.fallbackSlotId],
    action: 'standing naturally in a cinematic candid moment',
    background: '',
    cameraAngle: 'full body wide shot',
    summary: line
  }))
);

const normalizeAssignedScenes = (params: {
  assigned: V4ScenePlan[];
  scriptBody: string;
  fallbackSlotId: string;
}): V4ScenePlan[] => {
  const lines = normalizeScriptLines(params.scriptBody);
  if (params.assigned.length === 0) {
    return fallbackScenePlans({ scriptBody: params.scriptBody, fallbackSlotId: params.fallbackSlotId });
  }

  return lines.map((line, index) => {
    const scene = params.assigned.find((item) => item.sceneNumber === index + 1) || params.assigned[index];
    return {
      sceneNumber: index + 1,
      scriptLine: scene?.scriptLine?.trim() || line,
      characterIds: scene?.characterIds?.length ? scene.characterIds : [params.fallbackSlotId],
      action: scene?.action || 'standing naturally in a cinematic candid moment',
      background: scene?.background || '',
      cameraAngle: scene?.cameraAngle || 'full body wide shot',
      summary: scene?.summary || line
    };
  });
};

export const runShortsLabV4Flow = async (input: V4FlowInput): Promise<V4FlowResult> => {
  if (!input.topic.trim()) {
    throw new Error('V4 생성 실패: 주제가 비어 있습니다.');
  }

  const { selectedStory, storyContext } = await resolveV4StoryContext(input);
  const scriptResult = await generateV4ScriptOnly(input, storyContext);

  const fixedSlots = getV4FixedSlots({ gender: input.gender, topic: input.topic });
  const allowedSlotIds = getV4AllowedSlotIds(fixedSlots);
  const fallbackSlotId = input.gender === 'male' ? 'ManA' : 'WomanA';

  const assignment = await generateV4SceneAssignment({
    service: input.service,
    scriptBody: scriptResult.scriptBody,
    slots: fixedSlots,
    topic: input.topic,
    targetAge: input.targetAge
  });

  const scenePlans = normalizeAssignedScenes({
    assigned: assignment.scenes,
    scriptBody: scriptResult.scriptBody,
    fallbackSlotId
  });

  const usedSlotIds = Array.from(new Set(scenePlans.flatMap((scene) => scene.characterIds)));
  const outfitMap = await resolveV4Outfits({
    input,
    scriptBody: scriptResult.scriptBody,
    slots: fixedSlots,
    usedSlotIds
  });

  const scenes = buildV4Scenes({
    scenePlans,
    outfitMap,
    targetAge: input.targetAge,
    lockBackgroundToFirst: input.lockBackgroundToFirst ?? false
  });

  const validationIssues = validateV4Scenes({
    scriptBody: scriptResult.scriptBody,
    allowedSlotIds,
    scenes,
    outfitMap
  });

  const title = selectedStory?.title || input.topic;
  const folderName = await saveV4Result({
    input,
    title,
    scriptBody: scriptResult.scriptBody,
    scenePlans,
    scenes,
    outfitMap,
    rawAssignment: assignment.rawText,
    validationIssues
  });

  return {
    title,
    scriptBody: scriptResult.scriptBody,
    selectedStory,
    scenes,
    slotIds: usedSlotIds,
    outfitMap,
    folderName,
    rawAssignment: assignment.rawText,
    validationIssues
  };
};

export const runShortsLabV4Master = async (input: V4FlowInput): Promise<V4FlowResult> => {
  return runShortsLabV4Flow(input);
};

export const runShortsLabV4FromStoryContext = async (input: V4FlowInput): Promise<V4FlowResult> => {
  const selectedStoryContext = input.selectedStoryContext?.trim();
  if (!selectedStoryContext) {
    throw new Error('V4 생성 실패: 선택된 줄거리가 없습니다.');
  }

  const scriptResult = await generateV4ScriptOnly(input, selectedStoryContext);
  const fixedSlots = getV4FixedSlots({ gender: input.gender, topic: input.topic });
  const allowedSlotIds = getV4AllowedSlotIds(fixedSlots);
  const fallbackSlotId = input.gender === 'male' ? 'ManA' : 'WomanA';

  const assignment = await generateV4SceneAssignment({
    service: input.service,
    scriptBody: scriptResult.scriptBody,
    slots: fixedSlots,
    topic: input.topic,
    targetAge: input.targetAge
  });

  const scenePlans = normalizeAssignedScenes({
    assigned: assignment.scenes,
    scriptBody: scriptResult.scriptBody,
    fallbackSlotId
  });

  const usedSlotIds = Array.from(new Set(scenePlans.flatMap((scene) => scene.characterIds)));
  const outfitMap = await resolveV4Outfits({
    input,
    scriptBody: scriptResult.scriptBody,
    slots: fixedSlots,
    usedSlotIds
  });

  const scenes = buildV4Scenes({
    scenePlans,
    outfitMap,
    targetAge: input.targetAge,
    lockBackgroundToFirst: input.lockBackgroundToFirst ?? false
  });

  const validationIssues = validateV4Scenes({
    scriptBody: scriptResult.scriptBody,
    allowedSlotIds,
    scenes,
    outfitMap
  });

  const title = input.selectedStoryTitle?.trim() || selectedStoryContext.split('\n').find(Boolean) || input.topic;
  const folderName = await saveV4Result({
    input,
    title,
    scriptBody: scriptResult.scriptBody,
    scenePlans,
    scenes,
    outfitMap,
    rawAssignment: assignment.rawText,
    validationIssues
  });

  return {
    title,
    scriptBody: scriptResult.scriptBody,
    selectedStory: input.selectedStoryTitle
      ? { title: input.selectedStoryTitle, content: selectedStoryContext }
      : undefined,
    scenes,
    slotIds: usedSlotIds,
    outfitMap,
    folderName,
    rawAssignment: assignment.rawText,
    validationIssues
  };
};

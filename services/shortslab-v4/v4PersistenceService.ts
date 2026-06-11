import { saveV4Story } from './v4ApiClient';
import type { V4FlowInput, V4OutfitEntry, V4PanelScene, V4ScenePlan, V4ValidationIssue } from './v4Types';

const serializeOutfitMap = (outfitMap: Map<string, V4OutfitEntry>): Record<string, V4OutfitEntry> => {
  const result: Record<string, V4OutfitEntry> = {};
  outfitMap.forEach((value, key) => {
    result[key] = value;
  });
  return result;
};

export const saveV4Result = async (params: {
  input: V4FlowInput;
  title: string;
  scriptBody: string;
  scenePlans: V4ScenePlan[];
  scenes: V4PanelScene[];
  outfitMap: Map<string, V4OutfitEntry>;
  rawAssignment: string;
  validationIssues: V4ValidationIssue[];
}): Promise<string | null> => {
  const payload = {
    title: params.title,
    source: 'shortslab-v4',
    topic: params.input.topic,
    genre: params.input.genre,
    targetAge: params.input.targetAge,
    gender: params.input.gender,
    outfitMode: params.input.useRandomOutfits ? 'random' : 'llm',
    scriptBody: params.scriptBody,
    scenePlans: params.scenePlans,
    scenes: params.scenes,
    outfitMap: serializeOutfitMap(params.outfitMap),
    rawAssignment: params.rawAssignment,
    validationIssues: params.validationIssues
  };

  return saveV4Story({
    title: params.title,
    content: JSON.stringify(payload, null, 2),
    service: params.input.service
  });
};

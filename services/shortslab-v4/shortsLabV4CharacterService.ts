export interface V4MasterProfile {
  slotId: string;
  characterId?: string;
  name: string;
  identity: string;
  face: string;
  hair: string;
  body: string;
  style: string;
  skinTone: string;
  signatureFeatures: string;
  outfit: string;
  outfitPrompt: string;
  accessory?: string;
}

export interface V4BuildProfilesInput {
  slotIds: string[];
  characterRules: any;
  outfitMap: Map<string, { name: string; prompt: string }>;
}

export function buildMasterCharacterProfilesV4(input: V4BuildProfilesInput): V4MasterProfile[] {
  const { slotIds, characterRules, outfitMap } = input;

  return slotIds.map((slotId) => {
    const outfit = outfitMap.get(slotId);
    const isWoman = slotId.startsWith('Woman');
    const rule = isWoman
      ? characterRules?.females?.find((item: any) => item.id === slotId)
      : characterRules?.males?.find((item: any) => item.id === slotId);

    return {
      slotId,
      characterId: rule?.characterId,
      name: rule?.name || slotId,
      identity: rule?.identity || '',
      face: rule?.face || '',
      hair: rule?.hair || '',
      body: rule?.body || '',
      style: rule?.style || '',
      skinTone: rule?.skinTone || '',
      signatureFeatures: rule?.signatureFeatures || '',
      outfit: outfit?.name || '의상 미선택',
      outfitPrompt: outfit?.prompt || ''
    };
  });
}

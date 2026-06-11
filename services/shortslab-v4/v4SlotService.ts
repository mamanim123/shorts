import { getCharacterRules } from '../shortsLabCharacterRulesManager';
import type { V4Gender, V4SceneSlot } from './v4Types';

const isGolfTopic = (topic: string): boolean => /골프|golf/i.test(topic || '');

export const getV4FixedSlots = (params: {
  gender: V4Gender;
  topic: string;
}): V4SceneSlot[] => {
  const rules = getCharacterRules();
  const femaleRules = Array.isArray(rules.females) ? rules.females : [];
  const maleRules = Array.isArray(rules.males) ? rules.males : [];
  const includeCaddy = isGolfTopic(params.topic);

  const females = femaleRules
    .filter((rule: any) => includeCaddy || rule.id !== 'WomanD')
    .map((rule: any): V4SceneSlot => ({
      slotId: rule.id,
      name: rule.name || rule.id,
      role: rule.id === 'WomanD' ? '캐디' : '',
      gender: 'female'
    }));

  const males = maleRules.map((rule: any): V4SceneSlot => ({
    slotId: rule.id,
    name: rule.name || rule.id,
    role: '',
    gender: 'male'
  }));

  const narratorId = params.gender === 'male' ? 'ManA' : 'WomanA';
  const ordered = params.gender === 'male' ? [...males, ...females] : [...females, ...males];

  return ordered.map((slot) => (
    slot.slotId === narratorId
      ? { ...slot, role: [slot.role, '주인공/내레이터'].filter(Boolean).join(', ') }
      : slot
  ));
};

export const getV4AllowedSlotIds = (slots: V4SceneSlot[]): string[] => (
  Array.from(new Set(slots.map((slot) => slot.slotId).filter(Boolean)))
);

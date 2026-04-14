/**
 * Slot ID Mapper Utility
 * Converts between UI slot IDs and Rule slot IDs for character-costume rules sync
 */

// UI Slot IDs (used in CharacterPanel)
export type UiSlotId = string; // Allow dynamic IDs

// Rule Slot IDs (used in ShortsLabCharacterRules)
export type RuleSlotId = string; // Allow dynamic IDs

// Forward mapping: UI → Rule
// Now unified: Woman_01 -> Woman_01
const UI_TO_RULE_MAP: Record<string, string> = {
  'Woman_01': 'Woman_01',
  'Woman_02': 'Woman_02',
  'Woman_03': 'Woman_03',
  'Woman_04': 'Woman_04',
  'Man_01': 'Man_01',
  'Man_02': 'Man_02',
  'Man_03': 'Man_03'
};

// Reverse mapping: Rule → UI
const RULE_TO_UI_MAP: Record<string, string> = {
  'Woman_01': 'Woman_01',
  'Woman_02': 'Woman_02',
  'Woman_03': 'Woman_03',
  'Woman_04': 'Woman_04',
  'Man_01': 'Man_01',
  'Man_02': 'Man_02',
  'Man_03': 'Man_03'
};

/**
 * Convert UI slot ID to Rule slot ID
 * @param uiSlot - UI slot ID (e.g., 'Woman_01')
 * @returns Rule slot ID (e.g., 'Woman_01') or empty string if invalid
 */
export const uiSlotToRuleSlot = (uiSlot: string): string => {
  // Pass through if not in map (for dynamic IDs like Woman_05)
  return UI_TO_RULE_MAP[uiSlot] || uiSlot;
};

/**
 * Convert Rule slot ID to UI slot ID
 * @param ruleSlot - Rule slot ID (e.g., 'Woman_01')
 * @returns UI slot ID (e.g., 'Woman_01') or empty string if invalid
 */
export const ruleSlotToUiSlot = (ruleSlot: string): string => {
  return RULE_TO_UI_MAP[ruleSlot] || ruleSlot;
};

/**
 * Check if string is a valid UI slot ID
 */
export const isValidUiSlot = (slot: string): boolean => {
  return /(Woman|Man)_\d+/i.test(slot);
};

/**
 * Check if string is a valid Rule slot ID
 */
export const isValidRuleSlot = (slot: string): boolean => {
  return /(Woman|Man)_\d+/i.test(slot);
};



/**
 * Get gender from slot ID
 */
export const getSlotGender = (slotId: string): 'female' | 'male' | null => {
  if (slotId.startsWith('woman') || slotId.startsWith('female')) return 'female';
  if (slotId.startsWith('man') || slotId.startsWith('male')) return 'male';
  return null;
};

// Export mapping tables for reference
export { UI_TO_RULE_MAP, RULE_TO_UI_MAP };

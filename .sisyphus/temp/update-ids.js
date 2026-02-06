const fs = require('fs');
const path = './services/shortsLabCharacterRulesDefaults.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace IDs in DEFAULT_CHARACTER_RULES
content = content.replace(/id: 'femaleA'/g, "id: 'Woman_01'");
content = content.replace(/id: 'femaleB'/g, "id: 'Woman_02'");
content = content.replace(/id: 'femaleC'/g, "id: 'Woman_03'");
content = content.replace(/id: 'femaleD'/g, "id: 'Woman_04'");
content = content.replace(/id: 'maleA'/g, "id: 'Man_01'");
content = content.replace(/id: 'maleB'/g, "id: 'Man_02'");
content = content.replace(/id: 'maleC'/g, "id: 'Man_03'");

// Replace generateCharacterId function
const oldFunc = `export const generateCharacterId = (gender: 'female' | 'male', index: number): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return \`\${gender}\${letters[index] || index}\`;
};`;

const newFunc = `export const generateCharacterId = (gender: 'female' | 'male', index: number): string => {
  const prefix = gender === 'female' ? 'Woman' : 'Man';
  const num = String(index + 1).padStart(2, '0');
  return \`\${prefix}_\${num}\`;
};`;

content = content.replace(oldFunc, newFunc);

// Replace slotIdToRuleKey
const oldSlotId = `export const slotIdToRuleKey = (slotId: string): string => {
  return slotId
    .replace(/^Woman/, 'female')
    .replace(/^Man/, 'male')
    .replace(/^(female|male)([A-Z])/, (_, g, letter) => g + letter.toLowerCase());
};`;

const newSlotId = `export const slotIdToRuleKey = (slotId: string): string => {
  return slotId;
};`;

content = content.replace(oldSlotId, newSlotId);

// Replace ruleKeyToSlotId
const oldRuleKey = `export const ruleKeyToSlotId = (ruleKey: string): string => {
  return ruleKey
    .replace(/^female/, 'Woman')
    .replace(/^male/, 'Man')
    .replace(/^(Woman|Man)([a-z])/, (_, prefix, letter) => prefix + letter.toUpperCase());
};`;

const newRuleKey = `export const ruleKeyToSlotId = (ruleKey: string): string => {
  return ruleKey;
};`;

content = content.replace(oldRuleKey, newRuleKey);

fs.writeFileSync(path, content);
console.log('✅ Task 1: Character ID refactor completed');
console.log('- femaleA → Woman_01');
console.log('- femaleB → Woman_02');
console.log('- femaleC → Woman_03');
console.log('- femaleD → Woman_04');
console.log('- maleA → Man_01');
console.log('- maleB → Man_02');
console.log('- maleC → Man_03');
console.log('- generateCharacterId updated to numeric format');

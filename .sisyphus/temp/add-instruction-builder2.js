const fs = require('fs');
const path = './services/labPromptBuilder.ts';
let content = fs.readFileSync(path, 'utf8');

// Find the line with the ShortsLabCharacterRules import and add function after it
const targetPattern = `import type { ShortsLabCharacterRules } from './shortsLabCharacterRulesDefaults';

// ============================================
// 겨울 테마 및 럭셔리 컬렉션 (v3.8.0)`;

const replacement = `import type { ShortsLabCharacterRules } from './shortsLabCharacterRulesDefaults';

// ============================================
// Dynamic Character Slot Instruction Builder (v4)
// ============================================

/**
 * Build dynamic character slot instruction from Genre Manager rules
 * This allows unlimited characters and real-time updates without code changes
 * @param characterRules - Character rules from Genre Manager
 * @returns Formatted instruction string for AI
 */
export const buildDynamicSlotInstruction = (characterRules: ShortsLabCharacterRules): string => {
  const femaleLines = characterRules.females.map((char) => {
    const role = char.identity || 'Female Character';
    return \`- \${char.id}: \${role}\`;
  });
  
  const maleLines = characterRules.males.map((char) => {
    const role = char.identity || 'Male Character';
    return \`- \${char.id}: \${role}\`;
  });
  
  return \`## 👥 Character Slots
Use the following IDs to identify characters in the script:
\${femaleLines.join('\\n')}
\${maleLines.join('\\n')}

When writing the script, use these exact IDs (e.g., "Woman_01", "Man_01") to identify which character is speaking or acting.\`;
};

// ============================================
// 겨울 테마 및 럭셔리 컬렉션 (v3.8.0)`;

if (content.includes(targetPattern)) {
  content = content.replace(targetPattern, replacement);
  fs.writeFileSync(path, content);
  console.log('✅ Task 2: Dynamic instruction builder added successfully');
} else {
  console.log('⚠️ Pattern not found, trying alternative approach...');
  // Try inserting after the import line directly
  const importLine = "import type { ShortsLabCharacterRules } from './shortsLabCharacterRulesDefaults';";
  const insertPoint = content.indexOf(importLine);
  if (insertPoint !== -1) {
    const before = content.substring(0, insertPoint + importLine.length);
    const after = content.substring(insertPoint + importLine.length);
    const newContent = before + "\n\n" + replacement.split(targetPattern)[1] + after;
    fs.writeFileSync(path, newContent);
    console.log('✅ Task 2: Dynamic instruction builder added (alternative method)');
  }
}

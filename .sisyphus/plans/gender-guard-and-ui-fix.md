# Plan: Gender-Consistent Outfit Guard & UI Layering Fix

## TL;DR

> **Quick Summary**: This plan fixes the UI layering issue where the 'Prompt Enhancement Settings' modal is hidden behind other panels, and implements a 'Gender Guard' in the post-processing stage to prevent male characters from wearing female outfits.
> 
> **Deliverables**:
> - Fixed UI layering for `PromptEnhancementSettings.tsx` (using createPortal).
> - New `Gender Guard` logic in `server/promptEnhancer.js`.
> - Integration in `ShortsLabPanel.tsx` to ensure AI-generated scenes are sanitized.
> 
> **Estimated Effort**: Short
> **Parallel Execution**: NO - sequential fixes required.
> **Critical Path**: UI Fix → Server Logic → Integration

---

## Context

### Original Request
The user reported that male characters are appearing in female clothing (miniskirts/dresses) during AI generation. Additionally, the settings modal for prompt enhancement is rendered behind the main content area, making it inaccessible.

### Interview Summary
**Key Discussions**:
- Post-processing is the preferred method for enforcement.
- Root cause identified as naive indexing in multi-person prompt replacement.
- UI issue caused by CSS stacking contexts (Sidebar z-20 vs Right Panel z-30).

---

## Work Objectives

### Core Objective
Ensure the 'Prompt Enhancement Settings' modal is always on top and male characters never wear female clothing by using smart keyword-based sanitization.

### Concrete Deliverables
- `components/PromptEnhancementSettings.tsx`: Modal migration to `createPortal`.
- `server/promptEnhancer.js`: Logic to match [Person X] blocks by gender tokens and strip invalid keywords.
- `types.ts`: Updated to include `useGenderGuard` setting.

### Definition of Done
- [ ] 'Prompt Enhancement Settings' modal appears on top of all UI elements.
- [ ] Male character prompts containing "skirt" or "dress" are automatically sanitized in post-processing.
- [ ] Gender-appropriate outfits are enforced regardless of person order in the AI response.

### Must Have
- `createPortal` for UI layering fix.
- Regex-based keyword sanitization for male character blocks.
- Toggle in the UI to enable/disable Gender Guard.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: NO
- **User wants tests**: Manual-only
- **Framework**: none

### Automated Verification (Agent-Executable)

**For UI layering fix** (using playwright skill):
\`\`\`
# Agent executes via playwright:
1. Navigate to main page.
2. Click "프롬프트 후처리 설정" button in sidebar.
3. Assert: Modal with text "Enhancement Settings" is visible.
4. Screenshot: .sisyphus/evidence/modal-on-top.png
\`\`\`

**For Server Sanitization Logic**:
\`\`\`bash
# Agent runs node script to test the enhancer logic:
node -e "
const { applyFullEnhancement } = await import('./server/promptEnhancer.js');
const sample = '[Person 1: handsome Korean man, wearing mini dress]';
const result = applyFullEnhancement(sample, ['ManA'], { 'ManA': { gender: 'MALE', outfit: 'blue suit' } });
console.log(result.includes('mini dress') ? 'FAIL' : 'PASS');
"
\`\`\`

---

## TODOs

- [ ] 1. Fix UI Stacking Context in PromptEnhancementSettings.tsx

  **What to do**:
  - Wrap the modal's return JSX in `createPortal` to render it into `document.body`.
  - Increase `z-index` to `100` in the container div.
  - Fix any CSS issues arising from the portal move.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Acceptance Criteria**:
  - [ ] Modal appears on top of the right panel (Cineboard/ShortsLab).
  - [ ] Close button still works.

- [ ] 2. Implement Gender Guard logic in server/promptEnhancer.js

  **What to do**:
  - Modify `applyFullEnhancement` to parse `[Person X: ...]` blocks.
  - Match each block to its intended character using ID or keywords (Man, handsome).
  - If a male character is identified, remove keywords: `skirt`, `dress`, `cleavage`, `bra`, `feminine`, `her`.
  - Replace the "wearing ..." part with the character's original `lockedOutfit` if a mismatch is detected.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: [`explore`]

  **Acceptance Criteria**:
  - [ ] Passing a male prompt with "skirt" through the enhancer returns a prompt with "skirt" removed.
  - [ ] "her" is replaced with "his" for male blocks.

- [ ] 3. Update UI and Integration

  **What to do**:
  - Add `useGenderGuard` checkbox to `PromptEnhancementSettings.tsx`.
  - Update `ShortsLabPanel.tsx` to call the `/api/enhance-prompt` API (or use the internal logic) after receiving AI results.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Acceptance Criteria**:
  - [ ] Toggle appears in settings.
  - [ ] Generation flow results are noticeably cleaner.

---

## Success Criteria

### Final Checklist
- [ ] Modal never hides behind right panel.
- [ ] Male characters in ShortsLab wear male clothing.
- [ ] Post-processing can be toggled via settings.

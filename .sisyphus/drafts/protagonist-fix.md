# Draft: Shorts Lab Protagonist and Gender Mapping Fix

## Requirements (confirmed)
- [Requirement]: When generating a script, the AI must know who the protagonist (narrator) is based on the user's gender selection.
- [Requirement]: If 'Female' is selected, the protagonist should be 'WomanA' (Jiyoung).
- [Requirement]: If 'Male' is selected, the protagonist should be 'ManA' (Junho).
- [Requirement]: "Caddy" characters should consistently map to 'WomanD' and maintain a 20s age setting.
- [Requirement]: Resolve ambiguity where the AI sometimes treats the wrong character as the protagonist or ignores the user's gender preference.

## Technical Decisions
- **Prompt Template Update**: Add `{{NARRATOR_NAME}}` and `{{NARRATOR_SLOT}}` to `DEFAULT_STEP2_PROMPT_RULES.scriptPrompt` in `services/shortsLabStep2PromptRulesDefaults.ts`.
- **System Role Clarification**: Instruct the AI that it is writing from the perspective of the specified narrator.
- **Relationship Clarification**: For topics like "Beautiful Caddy," if the narrator is male, explicitly state the perspective is a male narrator observing the caddy.

## Research Findings
- **Missing Placeholders**: `labPromptBuilder.ts` calculates `narratorName` and `narratorSlot` but the template in `shortsLabStep2PromptRulesDefaults.ts` doesn't use them.
- **Caddy Configuration**: `WomanD` is already hardcoded for the Caddy persona with a fixed age of 20s in `shortsLabCharacterRulesDefaults.ts`.
- **Mapping Logic**: `ShortsLabPanel.tsx` has logic to map "나/주인공" to the narrator slot, but it fails if the AI doesn't use those terms or follows a different perspective.

## Open Questions
- None for now. The root cause is identified as a missing link between the logic and the prompt template.

## Scope Boundaries
- INCLUDE: Prompt template updates, narrator perspective instructions.
- EXCLUDE: Core LLM logic changes (Gemini API), UI redesign.

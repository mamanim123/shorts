## Learnings (2026-01-27)
- Existing prompt rules infra uses `services/shortsLabPromptRulesManager.ts` with app-storage keys and MAX_BACKUPS=5.
- Step2 rules should mirror this structure but with its own storage keys and MAX_BACKUPS=2.
- Data shape for Step2 rules likely three text fields: script prompt, character prompt, final image prompt.
- `hooks/useShortsLabPromptRulesManager.ts` shows subscription + load/backup/update pattern to mirror for Step2 rules UI.
- Step2 rules already exist in `services/shortsLabStep2PromptRulesManager.ts` and UI in `components/ShortsLabPanel.tsx` with `step2_rules` tab; current MAX_BACKUPS is 5 and UI text also says max 5.
- Step2 rules are already used in generation via `buildLabScriptOnlyPrompt` and `buildCharacterExtractionPrompt`/`buildManualSceneDecompositionPrompt` (labPromptBuilder/manualSceneBuilder).

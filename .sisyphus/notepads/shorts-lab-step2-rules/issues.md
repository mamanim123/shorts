## Issues / Blockers (2026-01-27)
- Code edits are blocked until explicit user approval per repository rules. Step2 tasks require code changes (new manager/hook/UI changes).
- Step2 rules already exist; remaining gap vs plan is reducing MAX_BACKUPS from 5 to 2 and updating UI text. Requires code edits in `services/shortsLabStep2PromptRulesManager.ts` and `components/ShortsLabPanel.tsx`.
- Outfit randomness fix requires code edit in `components/ShortsLabPanel.tsx`, blocked by approval requirement.

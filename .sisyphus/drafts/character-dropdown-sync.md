# Draft: 캐릭터 정보 드롭다운 및 동기화 기능 추가
## Requirements (confirmed)
- 마마님(User) wants dropdowns for Costume (의상), Hair (헤어), and Body Type (체형) in the Character Profile section of the Preview tab in Shorts Lab.
- The dropdowns should allow immediate selection and update.
- Clicking "Apply Character Info" (캐릭터 정보 적용) should generate image prompts with the modified info.
- The Costume dropdown should use categories from the "Costume Extraction" (의상추출) tab: Royal, Yoga, Golf Luxury, Sexy.
- Dropdown changes apply to outfit + accessory only (hair/body excluded).
- Dropdown selection reflects in UI immediately, but prompt updates occur only after clicking "Apply Character Info" (캐릭터 정보 적용).
- Sync priority: dropdown selection wins over genre manager rules.
- Apply scope: currently selected character only.
- Undo/cancel UX is required in this area.
- Costume dropdown uses categories from the "Costume Extraction" (의상추출) tab: Royal, Yoga, Golf Luxury, Sexy.
- Sync with Genre Manager's Costume Rules.
## Technical Decisions
- Move `HAIR_PRESETS` and `BODY_PRESETS` to `constants.ts` for shared access.
- Use `fetchOutfitCatalog` from `outfitService` to get user-added outfits.
- Group outfits by category in the dropdown.
- Use `updateCharacter` from `useShortsLabCharacterRulesManager` to sync Hair/Body changes to the global rules.
- Use `updateCharacter` from `useShortsLabCharacterRulesManager` to sync dropdown selections to global rules.
- Update `masterCharacterProfiles` and `masterOutfitMap` state in `ShortsLabPanel.tsx` to reflect changes immediately in UI and prompt generation.
## Research Findings
- `ShortsLabPanel.tsx` is the main component for the Shorts Lab UI.
- `shortsLabCharacterRulesManager.ts` handles the persistence of character rules.
- `applyCharacterInfoToScenes` in `labPromptBuilder.ts` uses `outfitMap` and `characterRules` for final prompt assembly.
## Open Questions
- None.
- Confirm accessory data model and where it is stored (single field vs list).
- Define undo/cancel behavior details (revert to previous selection vs session rollback).
## Scope Boundaries
- INCLUDE: Dropdowns for Outfit, Hair, Body in Preview tab's Character Profile.
- INCLUDE: Sync with costume extraction library.
- INCLUDE: Prompt generation update based on selection.
- INCLUDE: Moving shared constants to `constants.ts`.
- INCLUDE: Outfit + accessory dropdowns in Preview tab's Character Profile.
- INCLUDE: Sync with costume extraction library and Genre Manager rules.
- INCLUDE: Prompt generation update based on selection after "Apply Character Info".
- EXCLUDE: Hair/body presets.

# Cineboard Full Implementation Plan (2026-01-12)

## Goal
Replicate the core Cineboard workflow shown in the reference video within this codebase, ensuring script-driven scene generation, character consistency (Identity Lock), casting image integration, and a usable result viewer with file-saving.

## Current Status (Completed)
- Cineboard panel UI exists (style/engine/aspect/scene count/script input).
- Character extraction and identity lock UI exists (notes, candidate dictionary, name dictionary).
- Cineboard generate button wired to `/api/generate` and saves results via `/api/save-story`.
- Cineboard tab is connected in `App.tsx`.

## Gaps to Implement
1) **Result Viewer (Core)**
   - Display generated Cineboard JSON output in UI (scenes list, prompts, metadata).
   - Provide copy/export actions (copy JSON, copy prompts, download file path).
   - Surface generation status + errors (loading indicator, error banner).

2) **Missing Character Re-Scan (Core)**
   - Implement "누락 인물 찾기" with actual re-scan logic based on script + candidate dictionary.
   - Update character cards and approval state without losing existing notes when possible.

3) **Casting Image Integration (Core)**
   - Allow image upload per character and persist in local state.
   - Include casting metadata in generation prompt (image descriptors or tags).
   - Optional: upload image to server endpoint for future reuse (if required by flow).

4) **Save Format + Metadata (Core)**
   - Standardize Cineboard save format for files (`CINEBOARD RESULT` + settings + JSON).
   - Include: style/engine/aspect/scene count/service/createdAt/script source.
   - Keep `/api/save-story` contract intact.

5) **Polish & Stability (Core)**
   - Guard against empty script, invalid scene count, or no approved characters.
   - Ensure types are strict (no `any`, use `types.ts` where possible).

## Implementation Steps
1. Add result viewer state + UI blocks in `CineboardPanel.tsx`.
2. Add missing-character re-scan logic (script + candidate dictionary).
3. Add casting image upload UI and integrate into prompt building.
4. Update Cineboard save formatting and metadata.
5. Validate with diagnostics and manual smoke check.

## Acceptance Criteria
- After generating, Cineboard results are visible in-panel (scene list + JSON).
- Missing character re-scan updates characters reliably.
- Casting images are accepted and referenced in prompt output.
- Save file includes standardized Cineboard metadata and content.
- No TypeScript errors in modified files.

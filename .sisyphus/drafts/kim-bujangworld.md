Microsoft Windows [Version 10.0.26200.7623]
(c) Microsoft Corporation. All rights reserved.

F:\projact\쇼츠대본생성기-v3.5.3>

# Draft: kim-bujangworld

## Requirements (confirmed)
- Analyze [김부장월드]1-4.txt to extract how scripts and image prompts are produced and explain how to implement consistent image prompts for shorts scripts.
- Include guidance to check UI based on the site addresses in the text files.
- Add a new tab next to Cineboard and ShortsLab with a fresh UI/flow; reuse only the ShortsLab AI script generation logic at the first script creation step; everything after that is newly designed.
- Primary scope is shorts script -> consistent image prompt; longform support may be added later if shorts flow succeeds.
- Output format for the new tab should be a production report style HTML/JSON export.
- Default scene split should be normal/context-based; precision split offered as an option.
- Consistency enforcement: character/style tokens must be injected into every scene prompt (strict).

## Technical Decisions
- None yet. Awaiting codebase findings and Oracle input.

## Research Findings
- [김부장월드]1.txt: Explains visual style selection, engine choice (nano vs pro), aspect ratio (shorts 9:16), identity lock for character consistency, script anchoring, prompt editing loop, and production report download.
- [김부장월드]2.txt: Describes workflow linking longform studio -> cineboard; shorts generation by selecting 9:16, scene selection, batch image generation, and prompt export for video creation.
- [김부장월드]3.txt: Describes precision split mode, user style DNA (reference images -> style analysis), and automation steps; emphasizes consistent style across scenes/episodes.
- [김부장월드]4.txt: Details longform studio steps (synopsis, script generation, persona generation, scene images, asset generation) and production report outputs.

## Open Questions
- Which UI should be checked: the YouTube pages referenced in the text files, or the app UI in this repo?
- Are there additional reference files or UI docs beyond the four text files?

## Scope Boundaries
- INCLUDE: Shorts image-prompt consistency strategy aligned to [김부장월드] references; UI checks tied to referenced URLs.
- INCLUDE: New tab concept next to Cineboard/ShortsLab; reuse ShortsLab LLM script generation logic only at the initial step; new UI/flow for the rest.
- EXCLUDE: Implementation changes to code (planning only).

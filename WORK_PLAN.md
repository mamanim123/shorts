# Goal
- Add saved outfits and characters into random selection pools used by Shorts Lab prompt generation.
- Allow managing outfit categories (add/edit) and use them in selection.
- Update character management flow: extraction uses active sub-tab (face/hair/body), keep existing presets, and support prompt-based image generation for hair/body.
- Keep the fixed behavior where new image always triggers a fresh extraction.
- Ensure hair/body preset selection updates extracted prompt used for image generation.
- Add AI generate button next to image generate for extracted face/hair/body/outfit prompts.
- Force Korean identity in face/hair/body extraction prompts unless explicitly stated otherwise.
- Prevent mannequin/anime-style body outputs by enforcing photorealistic human body constraints.
- Enable editing/deleting outfit categories and enforce single expanded category at a time.

# Checklist
- [x] Confirm current extraction flow and bugfix behavior in CharacterPanel.
- [x] Design data flow for saved outfits/characters to be used by random selection.
- [x] Implement outfit category management UI and persistence.
- [x] Update Shorts Lab/random selection logic to include saved outfits and characters.
- [x] Update CharacterPanel extraction behavior (face/hair/body) and UI actions.
- [ ] Verify no regression in existing outfit extraction flow.
- [x] Wire hair/body presets to update extracted prompt used by image generation.
- [x] Add AI generate buttons for extracted prompt panels.
- [x] Force Korean identity in face/hair/body extraction prompts.
- [x] Enforce photorealistic human body constraints for body extraction and generation.
- [x] Enable category edit/delete and exclusive category expansion.

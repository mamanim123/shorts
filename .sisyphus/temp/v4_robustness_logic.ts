
// Logic to be injected into handleExperimentalGenerate

// [ROBUSTNESS 1] Male Identity Fix (in her -> in his)
if (Array.isArray(scriptData.characters)) {
    scriptData.characters = scriptData.characters.map((character: any) => {
        const id = String(character?.id || '').trim();
        // Check if ID starts with Man (case-insensitive)
        if (/^man/i.test(id) && typeof character.identity === 'string') {
            const fixedIdentity = character.identity.replace(/\bin her\b/gi, 'in his');
            return { ...character, identity: fixedIdentity };
        }
        return character;
    });
}

// [ROBUSTNESS 2] Locked Outfits Logic (Dynamic ID Support)
const lockedOutfits = scriptData.lockedOutfits || parsed.lockedOutfits;
const preferredFemaleOutfit = lockedOutfits ? (
    lockedOutfits['Woman_01'] || 
    lockedOutfits['woman_01'] || 
    lockedOutfits['womanA'] || 
    settings.selectedOutfit
) : (settings.selectedOutfit || undefined);

const preferredMaleOutfit = lockedOutfits ? (
    lockedOutfits['Man_01'] || 
    lockedOutfits['man_01'] || 
    lockedOutfits['manA']
) : undefined;

// [ROBUSTNESS 3] Post-Processing Call
const processedScenes = postProcessAiScenes(scenesSource, {
    femaleOutfit: preferredFemaleOutfit,
    maleOutfit: preferredMaleOutfit,
    targetAgeLabel: aiTargetAge,
    gender: settings.koreanGender,
    characters: scriptData.characters || parsed.characters,
    genre: aiGenre,
    totalScenes: scenesSource.length,
    enableWinterAccessories,
    useGenderGuard: settings.useGenderGuard,
    postProcessConfig: selectedGenreData?.postProcessConfig,
    characterRules // [V4] Pass dynamic rules
});

// [ROBUSTNESS 4] Advanced JSON Fallback (Regex)
// If JSON.parse fails...
/*
console.warn('[ShortsLab] JSON parsing failed, using regex fallback:', e);
const scriptMatch = generatedText.match(/---\s*([\s\S]*?)\s*---/);
if (scriptMatch) {
    finalScript = scriptMatch[1].trim();
}
if (!finalScript) {
    const scriptBodyMatch = generatedText.match(/"scriptBody"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (scriptBodyMatch) {
        finalScript = scriptBodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
}
*/

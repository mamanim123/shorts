
// Logic copied from geminiService.ts for demonstration

const GLAMOUR_KEYWORDS = "Extremely sexy and tight-fitting, Second-skin fit, Perfect body proportions, Voluptuous hourglass figure, Deep plunging neckline, Feminine curves and cleavage emphasized, Sophisticated high-end fashion";

const enhancePromptWithSafeGlamour = (prompt, context = "") => {
    if (!prompt) return "";
    const isForeignRequested = /외국인|foreigner|american|western|white|black|latino|백인|흑인/i.test(context);
    let enhancedPrompt = prompt;

    if (!isForeignRequested) {
        enhancedPrompt = enhancedPrompt.replace(/\b(Woman|Man|Girl|Lady|Male|Female)\b/gi, (match) => {
            return `Korean ${match}`;
        });
        enhancedPrompt = enhancedPrompt.replace(/Korean\s+Korean/gi, "Korean");
    }

    const hasFemale = /\b(Woman|Girl|Lady|Female)\b/i.test(enhancedPrompt);
    if (hasFemale) {
        if (!enhancedPrompt.includes("Second-skin fit")) {
            enhancedPrompt = `${enhancedPrompt}, ${GLAMOUR_KEYWORDS}`;
        }
    }
    return enhancedPrompt;
};

const qualitySuffix = ", Volumetric lighting, Rim light, Detailed skin texture, 8k uhd, High fashion photography, masterpiece, depth of field --ar 9:16 --style raw --stylize 250";

const tagsToRemove = [
    "photorealistic", "8k resolution", "cinematic lighting", "masterpiece",
    "professional photography", "depth of field", "--ar 9:16", "--style raw",
    "detailed texture", "magazine cover quality", "hyper-realistic"
];

const cleanPrompt = (text) => {
    let cleaned = text;
    tagsToRemove.forEach(tag => {
        const regex = new RegExp(tag.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
        cleaned = cleaned.replace(regex, "");
    });
    return cleaned.split(',').map(s => s.trim()).filter(s => s.length > 0).join(', ');
};

// USER'S INPUT PROMPT (The "Bad" one)
const originalPrompt = `A group of Korean people in their 40s, High-End Luxury Golf Aesthetic, Protagonist (박프로: Sky Blue Pique Polo + Navy Slim Trousers, Dandy, Fit, Luxury) suddenly appearing with a golf course radio (무전기) in his hand, a confident, knowing smirk on his face, surprising the Arrogant Woman (강여사: Matte Leather Beige Halter-neck Knit + Navy Leather Micro Mini Skirt with Side slit, Ultra-tight fitting outfits, Glamorous hourglass figure, S-line curves, Healthy beauty) and Caddy (이지은 캐디: Fine Cashmere Dark Green Sleeveless Polo + Deep Blue Satin Micro Mini Skirt with Crystal embellishments)., Slender Silhouette, Skinny Fit, Small Waist, Full natural bust, Shapely hips strongly emphasized, Healthy beauty, Elegant refined posture, Dynamic Motion: 박프로가 무전기를 들고 강여사를 내려다보는 순간. 강여사의 얼굴은 사색이 되고, 캐디는 놀란 표정. Wide shot, 배경의 해저드 지역은 흐릿하게 처리. Hyper-realistic 8K cinematic photograph, Magazine Cover Quality, Shallow depth of field, Motion blur, Bokeh background,  --q 2 --style raw, photorealistic, 8k resolution, cinematic lighting, detailed texture, masterpiece, professional fashion photography, depth of field, Wavy brown hair, Ponytail, Elegant updo, photorealistic, 8k resolution, cinematic lighting, masterpiece, professional photography, depth of field --ar 9:16`;

// 1. Apply Safe Glamour (Korean + Tightness)
let step1 = enhancePromptWithSafeGlamour(originalPrompt, "");

// 2. Clean up duplicates and add Aesthetic Suffix
let finalPrompt = cleanPrompt(step1) + qualitySuffix;

import fs from 'fs';

const output = `=== ORIGINAL PROMPT ===
${originalPrompt}

=== TRANSFORMED PROMPT (What AI will actually see) ===
${finalPrompt}
`;

fs.writeFileSync('demo_output_utf8.txt', output, 'utf8');
console.log("Output written to demo_output_utf8.txt");

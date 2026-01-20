
import { generateStory } from './services/geminiService';
import { UserInput, SpiceLevel, OutfitStyle, Dialect, StyleTemplate } from './types';

// Mock types if needed, but we import them.

const mockInput: UserInput = {
    engineVersion: 'V3',
    category: '골프장', // Golf Course
    spiceLevel: SpiceLevel.MILD, // 0 -> Mild
    dialect: Dialect.STANDARD,
    targetAge: '40s',
    targetService: 'CHATGPT', // User said "GPT"
    safeGlamour: true, // Likely true for ChatGPT
};

const mockTemplate: StyleTemplate = {
    id: 'test-template',
    name: 'Test Template',
    type: 'shortform',
    structure: ['Intro', 'Body', 'Outro'],
    tone: 'Funny',
    hookStrategy: 'Question',
    twistStyle: 'Surprise',
    createdAt: Date.now(),
    service: 'CHATGPT',
};

// We need to mock fetch because generateStory calls it.
// Or we can just extract the logic we want to test.
// Since we can't easily mock fetch in this environment without a library,
// I will copy the relevant logic from geminiService.ts into this file 
// to inspect the string construction directly.
// Actually, I can just modify geminiService.ts temporarily to log the prompt 
// and then run a test script that calls it. 
// But modifying the source code is risky.
// Better to copy the logic here.

// ... Copying logic ...
// To avoid copying 1000 lines, I'll just import the functions if they were exported.
// But they are not exported.
// So I will create a simplified version of the logic here to verify my hypothesis.

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (url.toString().includes('/api/generate')) {
        const body = JSON.parse(options.body as string);
        const prompt = body.prompt;

        console.log("---------------------------------------------------");
        console.log("VERIFICATION RESULTS:");

        // Check for MILD case
        if (prompt.includes("Scenario: MILD")) {
            const hasWomanC = prompt.includes("Woman C Outfit");
            console.log(`[MILD] Contains 'Woman C Outfit' in Locked Reminder? ${hasWomanC} (EXPECTED: FALSE)`);
            if (!hasWomanC) console.log("✅ PASS: Woman C is correctly omitted.");
            else console.log("❌ FAIL: Woman C is present.");
        }

        // Check for NONE case
        if (prompt.includes("Scenario: NONE") || prompt.includes("Scenario: 0") || prompt.includes("선택안함")) {
            const hasActorPool = prompt.includes("[Actor Pool");
            const hasStyleConstraint = prompt.includes("STYLE CONSTRAINT");
            const hasAiDesign = prompt.includes("[AI DESIGN REQUIRED]");

            console.log(`[NONE] Contains '[Actor Pool'? ${hasActorPool} (EXPECTED: TRUE)`);
            console.log(`[NONE] Contains 'STYLE CONSTRAINT'? ${hasStyleConstraint} (EXPECTED: TRUE)`);
            console.log(`[NONE] Contains '[AI DESIGN REQUIRED]'? ${hasAiDesign} (EXPECTED: TRUE)`);

            if (hasActorPool && hasStyleConstraint && hasAiDesign) console.log("✅ PASS: Template Regeneration Mode is active.");
            else console.log("❌ FAIL: Missing key elements for Mode 0.");
        }

        console.log("---------------------------------------------------");
        return {
            ok: true,
            json: async () => ({
                title: "Test Story",
                scriptBody: "Test Content",
                scenes: [],
                punchline: "Test Punchline"
            })
        } as any;
    }
    return originalFetch(url, options);
};
async function runTest() {
    console.log("Running reproduction test...");

    console.log("\n=== TEST CASE 1: MILD (Husband) ===");
    try {
        // MILD should only have Woman A and Man B in Locked Outfit Reminder
        const input1 = { ...mockInput, spiceLevel: SpiceLevel.MILD };
        await generateStory(input1, undefined, mockTemplate);
    } catch (e) {
        console.error("Error during test 1:", e);
    }

    console.log("\n=== TEST CASE 2: NONE (Template Regeneration) ===");
    try {
        // NONE should have Actor Pool, Style Constraint, and generic Locked Outfit Reminder
        const input2 = { ...mockInput, spiceLevel: SpiceLevel.NONE };
        await generateStory(input2, undefined, mockTemplate);
    } catch (e) {
        console.error("Error during test 2:", e);
    }
}

runTest();


import { generateStory } from './services/geminiService';
import { UserInput, ScenarioMode, OutfitStyle, Dialect, StyleTemplate } from './types';

const mockInput: UserInput = {
    engineVersion: 'V3',
    category: '골프장',
    scenarioMode: ScenarioMode.DOUBLE_ENTENDRE,
    dialect: Dialect.STANDARD,
    targetAge: '40s',
    targetService: 'GEMINI',
    safeGlamour: true,
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
    service: 'GEMINI',
};

const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (url.toString().includes('/api/generate')) {
        const body = JSON.parse(options.body as string);
        const prompt = body.prompt;

        console.log("---------------------------------------------------");
        console.log(`PROMPT CHECK FOR: ${currentMode}`);
        // Write to file for inspection
        const fs = await import('fs');
        fs.writeFileSync(`test_output_${currentMode.substring(0, 1)}.txt`, prompt);
        console.log(`Prompt written to test_output_${currentMode.substring(0, 1)}.txt`);

        let passed = false;
        if (currentMode === ScenarioMode.DOUBLE_ENTENDRE) {
            if (prompt.includes("DOUBLE ENTENDRE") && prompt.includes("innocent twist")) passed = true;
        } else if (currentMode === ScenarioMode.TWIST_REVERSE) {
            if (prompt.includes("TWIST/REVERSE") && prompt.includes("Arrogant")) passed = true;
        } else if (currentMode === ScenarioMode.BLACK_COMEDY) {
            if (prompt.includes("BLACK COMEDY") && prompt.includes("Father")) passed = true;
        } else if (currentMode === ScenarioMode.ADULT_HUMOR) {
            if (prompt.includes("ADULT HUMOR") && prompt.includes("Dangerous Double Entendre")) passed = true;
        } else if (currentMode === ScenarioMode.GAG_SSUL) {
            if (prompt.includes("GAG/SSUL") && prompt.includes("Storyteller")) passed = true;
        }

        if (passed) console.log("✅ PASS: Prompt contains correct instructions.");
        else {
            console.log("❌ FAIL: Prompt missing expected keywords.");
            console.log("Partial Prompt:", prompt.substring(0, 500));
        }

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

let currentMode = "";

async function runTest() {
    console.log("Running Scenario Mode Verification...");

    const modes = [
        ScenarioMode.DOUBLE_ENTENDRE,
        ScenarioMode.TWIST_REVERSE,
        ScenarioMode.BLACK_COMEDY,
        ScenarioMode.ADULT_HUMOR,
        ScenarioMode.GAG_SSUL
    ];

    for (const mode of modes) {
        currentMode = mode;
        console.log(`\nTesting Mode: ${mode}`);
        try {
            const input = { ...mockInput, scenarioMode: mode };
            await generateStory(input, undefined, mockTemplate);
        } catch (e) {
            console.error(`Error testing ${mode}:`, e);
        }
    }
}

runTest();

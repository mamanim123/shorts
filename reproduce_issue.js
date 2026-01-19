
import { generateStory } from './services/geminiService.js'; // Note the .js extension for ESM imports

// Mock input
const mockInput = {
    engineVersion: 'V3',
    category: '골프장', // Golf Course
    spiceLevel: 'MILD', // 0 -> Mild
    dialect: 'STANDARD',
    targetAge: '40s',
    targetService: 'CHATGPT', // User said "GPT"
    safeGlamour: true, // Likely true for ChatGPT
};

const mockTemplate = {
    id: 'test-template',
    name: 'Test Template',
    type: 'shortform',
    structure: ['Intro', 'Body', 'Outro'],
    tone: 'Funny',
    hookStrategy: 'Question',
    twistStyle: 'Surprise',
    createdAt: Date.now(),
};

// Mock fetch
const originalFetch = global.fetch;
global.fetch = async (url, options) => {
    if (url.toString().includes('/api/generate')) {
        const body = JSON.parse(options.body);
        console.log("---------------------------------------------------");
        console.log("CAPTURED PROMPT:");
        console.log(body.prompt);
        console.log("---------------------------------------------------");
        return {
            ok: true,
            json: async () => ({
                title: "Test Story",
                scriptBody: "Test Content",
                scenes: [],
                punchline: "Test Punchline"
            })
        };
    }
    return originalFetch(url, options);
};

async function runTest() {
    console.log("Running reproduction test (JS)...");
    try {
        await generateStory(mockInput, undefined, mockTemplate);
    } catch (e) {
        console.error("Error during test:", e);
    }
}

runTest();


import { generateHybridStory } from './services/hybridService';

// Mock Fetch to simulate backend response and capture the Prompt
global.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    console.log("\n[MOCK FETCH] Request Sent to:", url);

    if (options && options.body) {
        const body = JSON.parse(options.body as string);
        console.log("[MOCK FETCH] Service:", body.service);
        console.log("[MOCK FETCH] Prompt Sent to AI:\n", "--- START OF PROMPT ---");
        console.log(body.prompt);
        console.log("--- END OF PROMPT ---\n");
    }

    return {
        ok: true,
        json: async () => ({
            title: " 등산의 반전 (AI Generated)",
            scriptBody: "Scene 1: 김사장과 홍여사가 산을 오르는데...",
            punchline: "알고보니 뒷산 약수터였다.",
            scenes: []
        })
    } as Response;
};

async function runTest() {
    console.log("=== Testing Hybrid AI Proxy ===");

    const input = {
        engineVersion: 'V3',
        scenarioMode: 'default',
        customContext: '등산', // User's theme
        targetService: 'GEMINI' // User's choice
    };

    console.log(`User Input: Theme='${input.customContext}', Service='${input.targetService}'`);

    try {
        const result = await generateHybridStory(input as any);
        console.log("\n=== Result Received ===");
        console.log("Title:", result.title);
        console.log("Script Preview:", result.scriptBody);
        console.log("Source:", result.service); // Should be 'HYBRID' but backed by 'GEMINI' logic
    } catch (e) {
        console.error(e);
    }
}

runTest();

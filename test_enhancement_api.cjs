const fetch = require('node-fetch');

async function testAPIs() {
    console.log("Testing Prompt Enhancement APIs...");

    const baseUrl = 'http://localhost:3002';

    // 1. Test GET Settings
    try {
        console.log("\n1. Testing GET /api/prompt-enhancement-settings");
        const res = await fetch(`${baseUrl}/api/prompt-enhancement-settings`);
        if (res.ok) {
            const data = await res.json();
            console.log("SUCCESS: Retrieved settings:", data);
        } else {
            console.error("FAILED: Status", res.status);
        }
    } catch (e) {
        console.error("FAILED: Connection error", e.message);
    }

    // 2. Test POST Enhance Prompt
    try {
        console.log("\n2. Testing POST /api/enhance-prompt");
        const prompt = "A woman in a cafe";
        const res = await fetch(`${baseUrl}/api/enhance-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        if (res.ok) {
            const data = await res.json();
            console.log("SUCCESS: Enhanced prompt:", data.enhancedPrompt);
        } else {
            console.error("FAILED: Status", res.status);
        }
    } catch (e) {
        console.error("FAILED: Connection error", e.message);
    }
}

testAPIs();

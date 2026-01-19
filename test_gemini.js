
async function testGemini() {
    console.log("Testing Gemini API with User Topic...");
    try {
        const response = await fetch('http://localhost:3002/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: 'GEMINI',
                prompt: `You are a script engine. Generate a JSON response for a YouTube Short script. 
                Topic: Beautiful Autumn Golf Course, 40s Couple. 
                Style: Humor Anecdote (3rd person). 
                Output JSON format: { "title": "Autumn Golf Date", "scriptBody": "Scene 1: ...", "scenes": [] }.
                IMPORTANT: Do NOT output any thought process. Output ONLY JSON.`
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`HTTP Error: ${response.status} ${err}`);
        }

        const data = await response.json();
        console.log("Success! Received Data:");
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Test Failed:", error);
    }
}

testGemini();

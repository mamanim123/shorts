
async function testClaude() {
    console.log("Testing Claude API...");
    try {
        const response = await fetch('http://localhost:3002/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: 'CLAUDE',
                prompt: `You are a script engine. Generate a JSON response for a YouTube Short script. 
                Topic: Golf, Autumn, 40s Women. 
                Style: Humor Anecdote (3rd person). 
                Output JSON format: { "title": "Autumn Golf", "scriptBody": "Scene 1: Two women went to golf...", "scenes": [] }.
                Do not include any conversational text.`
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

testClaude();

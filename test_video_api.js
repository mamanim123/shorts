
import fetch from 'node-fetch';

const testRefineAndGenerate = async () => {
    try {
        console.log('--- Testing Refine Prompt ---');
        const response = await fetch('http://localhost:3002/api/video/refine-prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scriptLine: "그녀가 공원에서 춤을 춘다",
                visualPrompt: "unfiltered raw photograph, a woman dancing in park, 8k"
            })
        });
        const data = await response.json();
        console.log('Refine Result:', JSON.stringify(data, null, 2));

        if (data.success) {
            console.log('\n--- Testing Generate Smart (Mocking Object Input) ---');
            // Mocking the videoData object that used to cause "replace is not a function"
            // The server now handles both string and object.
            // But we need to mock the /api/video/generate-smart which calls generateVideoFX.
            // Since we can't easily mock the internal puppeteer call here without injecting,
            // we'll just check if the server is still alive or if we can hit it.

            // To actually test the fix in generate-smart, we'd need it to call generateVideoFX 
            // and have it return an object. 
            // We can check the server code for syntax errors at least.
        }
    } catch (e) {
        console.error('Test Failed:', e);
    }
};

testRefineAndGenerate();

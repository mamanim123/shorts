const http = require('http');

const promptText = `Create a short video script about a cute cat. 
Return strictly valid JSON. 
The JSON must have a "scenes" array. 
Each scene must have an "imagePrompt" field describing the visual.
Example:
{
  "scenes": [
    { "imagePrompt": "A fluffy white cat sitting on a windowsill" }
  ]
}`;

const data = JSON.stringify({
    service: 'GEMINI', // Must be uppercase
    prompt: promptText
});

const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/generate',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

console.log("Sending request to /api/generate...");

const req = http.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
                const parsedData = JSON.parse(responseBody);
                console.log("Response Data:", JSON.stringify(parsedData, null, 2));

                // Check for enhancements
                const scenes = parsedData.scenes || [];
                let hasKorean = false;
                let hasQualityTags = false;

                scenes.forEach(scene => {
                    const promptToCheck = scene.shortPrompt || scene.longPrompt || scene.imagePrompt || "";
                    console.log(`Checking prompt: "${promptToCheck}"`);

                    if (promptToCheck && (promptToCheck.includes('Korean') || promptToCheck.includes('South Korean style'))) {
                        hasKorean = true;
                    }
                    if (promptToCheck && promptToCheck.includes('8k resolution')) {
                        hasQualityTags = true;
                    }
                });

                console.log("Has Korean Enhancement:", hasKorean);
                console.log("Has Quality Tags:", hasQualityTags);
            } catch (e) {
                console.error("Error parsing JSON:", e);
                console.log("Raw Response:", responseBody);
            }
        } else {
            console.error(`HTTP Error: ${res.statusCode}`);
            console.log("Response Body:", responseBody);
        }
    });
});

req.on('error', (error) => {
    console.error("Error:", error);
});

req.write(data);
req.end();

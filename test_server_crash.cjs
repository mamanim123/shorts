const http = require('http');

// Test case: Prompt is missing/undefined
const data = JSON.stringify({
    service: 'GEMINI',
    // prompt is missing
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

console.log("Sending request with MISSING prompt to /api/generate...");

const req = http.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
        responseBody += chunk;
    });

    res.on('end', () => {
        console.log(`Response Status: ${res.statusCode}`);
        console.log("Response Body:", responseBody);

        if (res.statusCode === 500) {
            console.log("FAILURE: Server still crashes (500).");
        } else if (res.statusCode === 400) {
            console.log("SUCCESS: Server handled missing prompt gracefully (400).");
        } else {
            console.log("Unexpected status code.");
        }
    });
});

req.on('error', (error) => {
    console.error("Error:", error);
});

req.write(data);
req.end();

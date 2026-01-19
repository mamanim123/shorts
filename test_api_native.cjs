const http = require('http');

function request(method, path, data) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: body });
            });
        });

        req.on('error', (e) => reject(e));

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function run() {
    console.log("Testing APIs...");

    // 1. GET Settings
    try {
        const res = await request('GET', '/api/prompt-enhancement-settings');
        console.log("GET /api/prompt-enhancement-settings:", res.status);
        console.log("Body:", res.body.substring(0, 100));
    } catch (e) {
        console.error("GET Failed:", e.message);
    }

    // 2. POST Enhance
    try {
        const res = await request('POST', '/api/enhance-prompt', { prompt: "A woman in a cafe" });
        console.log("POST /api/enhance-prompt:", res.status);
        console.log("Body:", res.body);
    } catch (e) {
        console.error("POST Failed:", e.message);
    }
}

run();

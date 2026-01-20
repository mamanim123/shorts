import http from 'http';

function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3002,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTest() {
    console.log("--- Testing Prompt Enhancement Settings API ---");

    // 1. GET Settings
    try {
        console.log("\n1. GET /api/prompt-enhancement-settings");
        const getRes = await makeRequest('GET', '/api/prompt-enhancement-settings');
        console.log("Status:", getRes.statusCode);
        console.log("Settings:", getRes.data);

        if (getRes.statusCode === 200 && getRes.data.autoEnhanceOnGeneration !== undefined) {
            console.log("PASS: Retrieved settings successfully.");
        } else {
            console.error("FAIL: Failed to retrieve settings.");
        }

        // 2. POST Settings (Toggle autoEnhanceOnGeneration)
        console.log("\n2. POST /api/prompt-enhancement-settings (Toggle autoEnhanceOnGeneration)");
        const newSettings = { ...getRes.data, autoEnhanceOnGeneration: !getRes.data.autoEnhanceOnGeneration };
        const postRes = await makeRequest('POST', '/api/prompt-enhancement-settings', newSettings);
        console.log("Status:", postRes.statusCode);
        console.log("Response:", postRes.data);

        if (postRes.statusCode === 200 && postRes.data.success) {
            console.log("PASS: Updated settings successfully.");
        } else {
            console.error("FAIL: Failed to update settings.");
        }

        // 3. Verify Update
        console.log("\n3. Verify Update");
        const verifyRes = await makeRequest('GET', '/api/prompt-enhancement-settings');
        console.log("New Value:", verifyRes.data.autoEnhanceOnGeneration);

        if (verifyRes.data.autoEnhanceOnGeneration === newSettings.autoEnhanceOnGeneration) {
            console.log("PASS: Verification successful.");
            // Revert change
            await makeRequest('POST', '/api/prompt-enhancement-settings', getRes.data);
            console.log("Reverted settings to original state.");
        } else {
            console.error("FAIL: Settings were not updated.");
        }

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

runTest();

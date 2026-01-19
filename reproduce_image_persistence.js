
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const PORT = 3002;
const BASE_URL = `http://localhost:${PORT}`;

async function testImagePersistence() {
    console.log("Starting Image Persistence Test...");

    // 1. Simulate saving an image
    const testImageData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; // 1x1 red pixel
    const testPrompt = "test_persistence_prompt";

    console.log("1. Saving image via API...");
    try {
        const saveRes = await fetch(`${BASE_URL}/api/save-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: testImageData, prompt: testPrompt })
        });

        const saveData = await saveRes.json();
        if (!saveData.success) {
            console.error("Failed to save image:", saveData.error);
            return;
        }
        console.log("Image saved successfully:", saveData.filename);

        // 2. Verify file exists on disk
        const filePath = saveData.path;
        if (fs.existsSync(filePath)) {
            console.log("File exists on disk:", filePath);
        } else {
            console.error("File NOT found on disk:", filePath);
            return;
        }

        // 3. Try to fetch it back using the URL logic from OutputDisplay.tsx
        const filename = saveData.filename;
        const candidates = [
            `${BASE_URL}/generated_scripts/images/${filename}`,
            `http://127.0.0.1:${PORT}/generated_scripts/images/${filename}`
        ];

        let fetched = false;
        for (const url of candidates) {
            console.log(`Trying to fetch from: ${url}`);
            try {
                const res = await fetch(url);
                if (res.ok) {
                    console.log(`Success! Fetched from ${url}`);
                    fetched = true;
                    break;
                } else {
                    console.log(`Failed (Status ${res.status}) from ${url}`);
                }
            } catch (e) {
                console.log(`Error fetching from ${url}:`, e.message);
            }
        }

        if (fetched) {
            console.log("TEST PASSED: Image persistence and retrieval works.");
        } else {
            console.error("TEST FAILED: Could not retrieve saved image via HTTP.");
        }

    } catch (e) {
        console.error("Test failed with exception:", e);
    }
}

testImagePersistence();

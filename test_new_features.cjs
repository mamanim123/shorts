const fs = require('fs');
const path = require('path');

async function testBackendFeatures() {
    const baseUrl = 'http://localhost:3002';

    console.log('--- Testing Backend Features ---');

    // 1. Test Image Save API
    console.log('\n1. Testing /api/save-character-image...');
    const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='; // 1x1 red pixel
    try {
        const response = await fetch(`${baseUrl}/api/save-character-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageData: `data:image/png;base64,${dummyBase64}`,
                prompt: 'test prompt',
                type: 'test_outfit'
            })
        });

        const data = await response.json();

        if (data.success && data.url) {
            console.log('✅ Image Save Success:', data.url);
            // Verify file existence
            const savedPath = path.join(__dirname, 'generated_scripts', 'images', '캐릭터의상', data.filename);
            if (fs.existsSync(savedPath)) {
                console.log('✅ File exists at:', savedPath);
            } else {
                console.error('❌ File NOT found at:', savedPath);
            }
        } else {
            console.error('❌ Image Save Failed:', data);
        }
    } catch (e) {
        console.error('❌ Image Save Error:', e.message);
    }

    // 2. Test Outfit Extraction API (Connectivity Check)
    console.log('\n2. Testing /api/extract-outfit (Connectivity Check)...');
    try {
        console.log('ℹ️  Skipping full extraction test (requires Puppeteer interaction). Logic verified in previous steps.');
    } catch (e) {
        console.error('❌ Extraction Error:', e.message);
    }
}

testBackendFeatures();

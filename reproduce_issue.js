import { generateContent } from './server/puppeteerHandler.js';

async function testExtractOutfit() {
    // 1x1 투명 PNG base64
    const dummyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    console.log('Starting outfit extraction test...');
    try {
        const result = await generateContent('GEMINI', 'Analyze this image and describe the outfit.', [dummyBase64]);
        console.log('Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

testExtractOutfit();


import puppeteer from 'puppeteer';

async function runE2ETest() {
    console.log("Starting E2E Test (Final Verification)...");
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();

    try {
        // 1. Go to Frontend
        console.log("Navigating to http://localhost:3000...");
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

        // 2. Select CLAUDE service
        console.log("Selecting CLAUDE service...");
        const claudeBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.innerText.includes('CLAUDE'));
        });
        if (!claudeBtn) throw new Error("Could not find CLAUDE button");
        await claudeBtn.click();

        // 3. Click Generate Story
        console.log("Clicking Generate Story...");
        const generateBtn = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(b => b.innerText.includes('스토리 생성하기'));
        });
        if (!generateBtn) throw new Error("Could not find Generate button");
        await generateBtn.click();

        // 4. Wait for Result
        console.log("Waiting for result...");
        await page.waitForFunction(() => {
            const body = document.body.innerText;
            return body.includes('HOOK') ||
                body.includes('Scene 1') ||
                body.includes('오류가 발생했습니다');
        }, { timeout: 180000 }); // 3 minutes

        // 5. Analyze Result
        const bodyText = await page.evaluate(() => document.body.innerText);

        if (bodyText.includes('오류가 발생했습니다')) {
            console.error("❌ E2E TEST FAILED: Error message found on screen.");
        }
        else if (bodyText.includes('[GENERATE') || bodyText.includes('Actual Title of the story')) {
            console.error("❌ E2E TEST FAILED: Placeholder text found!");
            console.error("Claude copied the schema instructions again.");
        }
        else if (bodyText.includes('Scene 1')) {
            console.log("✅ E2E TEST PASSED: Real content generated.");
            const resultPreview = bodyText.split('\n').filter(line => line.trim().length > 0).slice(0, 15).join('\n');
            console.log("--- CAPTURED SCREEN CONTENT ---");
            console.log(resultPreview);
            console.log("-------------------------------");
        } else {
            console.log("❓ E2E TEST INDETERMINATE: Unknown state.");
        }

    } catch (error) {
        console.error("❌ E2E TEST ERROR:", error);
    } finally {
        await browser.close();
    }
}

runE2ETest();

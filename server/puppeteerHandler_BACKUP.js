import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

let browser;
let page;

const SERVICES = {
    GEMINI: {
        url: 'https://gemini.google.com/app',
        selectors: {
            input: 'div[contenteditable="true"], div[role="textbox"]',
            sendBtn: 'button[aria-label="ë³´ë´ê¸?], button[aria-label="Send"], button[aria-label*="Send"], button[aria-label*="ë³´ë´ê¸?], .send-button, button[data-testid="send-button"]',
            response: 'model-response, .model-response-text',
        }
    },
    CHATGPT: {
        url: 'https://chatgpt.com',
        selectors: {
            input: '#prompt-textarea',
            sendBtn: 'button[data-testid="send-button"]',
            response: '.markdown',
        }
    },
    CLAUDE: {
        url: 'https://claude.ai/new',
        selectors: {
            input: 'div[contenteditable="true"]',
            sendBtn: 'button[aria-label="Send Message"]',
            response: '[data-testid="assistant-message"], [data-testid="assistant-response"], [data-testid="bot-message"], pre code, pre[class*="code"], .code-block__code, .font-claude-message, [data-message-author="assistant"], .prose, .markdown, div[class*="MessageContent"]',
        }
    },
    GENSPARK: {
        url: 'https://genspark.ai',
        selectors: {
            input: 'textarea.search-input, .j-search-input, textarea[placeholder*="ë¬´ì?´ë "]',
            // Found via agent: element 27 (textarea) -> element 28 (div button)
            sendBtn: '.j-search-input + div, textarea.search-input + div, div[class*="send-button"], button[aria-label="Send"]',
            response: '.markdown-body, .message-content, div[class*="answer"], div[class*="model-response"]',
        }
    }
};

export async function launchBrowser() {
    try {
        if (browser && browser.isConnected()) {
            if (page && !page.isClosed()) {
                return;
            }
        }

        if (browser) {
            try { await browser.close(); } catch (e) { }
        }

        // Default to headless in environments without an X server; allow opt-out via env.
        const headlessEnv = process.env.PUPPETEER_HEADLESS;
        const headless = false; // Force headless=false to show browser window

        const userDataPath = path.join(process.cwd(), 'user_data_stealth');
        console.log(`[Puppeteer] Using user data dir: ${userDataPath}`);
        console.log(`[Puppeteer] Headless mode: ${headless}`);

        browser = await puppeteer.launch({
            headless,
            defaultViewport: null,
            args: [
                '--window-size=1024,768', // Smaller window size
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
            userDataDir: userDataPath // Absolute path for reliability
        });

        const pages = await browser.pages();
        page = pages.length > 0 ? pages[0] : await browser.newPage();

        await page.setBypassCSP(true);
        const context = page.browserContext();
        await context.overridePermissions('https://gemini.google.com', ['clipboard-read', 'clipboard-write']);

        browser.on('disconnected', () => {
            console.log("Browser disconnected.");
            browser = null;
            page = null;
        });

        console.log("Browser launched successfully.");
    } catch (error) {
        console.error("Failed to launch browser:", error);
        throw error;
    }
}

export const initBrowser = launchBrowser;

export async function switchService(serviceName) {
    await launchBrowser();

    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    if (page.url().includes(config.url)) {
        return;
    }

    await page.goto(config.url, { waitUntil: 'networkidle2' });
}

async function sendPromptToPage(activePage, config, prompt, serviceName) {
    await activePage.waitForSelector(config.selectors.input);
    await activePage.click(config.selectors.input);

    console.log("[Puppeteer] Clearing input field...");
    await activePage.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (!el) return;
        if ('value' in el) {
            el.value = '';
        } else {
            el.textContent = '';
        }
    }, config.selectors.input);

    await activePage.keyboard.down('Control');
    await activePage.keyboard.press('A');
    await activePage.keyboard.up('Control');
    await activePage.keyboard.press('Backspace');

    await new Promise(r => setTimeout(r, 500));

    console.log("[Puppeteer] Inserting new prompt...");
    await activePage.evaluate((selector, text) => {
        const el = document.querySelector(selector);
        if (!el) return;
        if ('value' in el) {
            el.value = text;
        } else {
            el.textContent = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, config.selectors.input, prompt);

    await new Promise(r => setTimeout(r, 1000));

    // ?¥ GEMINI? CLAUDE??Enter ?¤ë¡ ?ì¡
    if (serviceName === 'CLAUDE' || serviceName === 'GEMINI') {
        console.log(`[Puppeteer] Sending to ${serviceName} via Enter key...`);
        await activePage.keyboard.press('Enter');
    } else {
        try {
            await activePage.click(config.selectors.sendBtn, { timeout: 3000 });
        } catch (e) {
            console.log("Button click failed, trying Enter...");
            await activePage.keyboard.press('Enter');
        }
    }

    await new Promise(r => setTimeout(r, 1000));
}

export async function generateContent(serviceName, prompt) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    await sendPromptToPage(page, config, prompt, serviceName);

    console.log("Waiting for response...");
    await new Promise(r => setTimeout(r, 5000));

    const MAX_ATTEMPTS = 300; // 300 * 2s = 600s (10 minutes) timeout
    let attempts = 0;
    let lastText = "";
    let stableCount = 0;

    while (attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s

        // [NEW] Check for Login Redirect or Modal (Critical for Genspark)
        const isLoginModalVisible = await page.evaluate(() => {
            const modal = document.querySelector('.n-modal, .auth-modal, div[role="dialog"]');
            if (modal && (modal.innerText.includes('Sign in') || modal.innerText.includes('Log in') || modal.innerText.includes('로그인'))) {
                return true;
            }
            return false;
        });

        if (page.url().includes('accounts.google.com') || page.url().includes('/login') || page.url().includes('signin') || isLoginModalVisible) {
            console.warn("[Puppeteer] Login detected.");
            throw new Error("Login page/modal detected. Please log in manually.");
        }

        // [NEW] Check for "Continue generating" button (ChatGPT/Claude)
        const continueClicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const continueBtn = buttons.find(b =>
                b.innerText.includes('Continue generating') ||
                b.innerText.includes('Continue code') ||
                (b.getAttribute('aria-label') && b.getAttribute('aria-label').includes('Continue'))
            );
            if (continueBtn && !continueBtn.disabled) {
                continueBtn.click();
                return true;
            }
            return false;
        });

        if (continueClicked) {
            console.log("Clicked 'Continue generating' button. Resetting stability check.");
            stableCount = 0; // Reset stability as text will change
            attempts = Math.max(0, attempts - 30); // Give more time (extend timeout)
            continue; // Skip the rest of the loop to wait for new text
        }

        // Check if generation is complete by looking for the Send button
        const isGenerationComplete = await page.evaluate((selector) => {
            const sendBtn = document.querySelector(selector);
            // If send button exists and is NOT disabled, generation is likely done
            if (sendBtn && !sendBtn.disabled && !sendBtn.hasAttribute('disabled')) {
                return true;
            }
            return false;
        }, config.selectors.sendBtn);

        const currentText = await page.evaluate((selector, serviceName) => {
            // 1. Try standard selector first
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return elements[elements.length - 1].innerText;
            }

            // 2. Fallback: Content-based search (Critical for Claude if selectors change)
            if (serviceName === 'CLAUDE') {
                const aiMsgSelectors = [
                    '[data-testid="assistant-message"]',
                    '[data-testid="assistant-response"]',
                    '[data-testid="bot-message"]',
                    'pre code',
                    'pre[class*="code"]',
                    '.code-block__code',
                    '.font-claude-message',
                    '[data-message-author="assistant"]',
                    '.prose',
                    '.markdown',
                    'div[class*="MessageContent"]'
                ];

                let foundText = "";
                for (const sel of aiMsgSelectors) {
                    const els = document.querySelectorAll(sel);
                    if (els.length > 0) {
                        const lastEl = els[els.length - 1];
                        if (lastEl.innerText.includes('scriptBody')) {
                            foundText = lastEl.innerText;
                            break;
                        }
                    }
                }

                if (foundText) return foundText;
            }
            return "";
        }, config.selectors.response, serviceName);

        // [SMART JSON CHECK + STABILITY FALLBACK]
        if (currentText && currentText.length > 50) {
            // 1. Try to PARSE (Fast Path)
            try {
                let cleanText = currentText.trim();
                if (cleanText.startsWith('```')) {
                    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '');
                }
                JSON.parse(cleanText);
                console.log("JSON Parse Successful! Generation Complete.");
                return currentText;
            } catch (e) {
                // Parse failed. Check stability (Slow Path)
                if (currentText === lastText) {
                    stableCount++;
                } else {
                    stableCount = 0;
                }

                // If text hasn't changed for 20 seconds (10 checks * 2s), assume done.
                if (stableCount >= 10) {
                    console.warn("JSON invalid but text stable for 20s. Returning anyway.");
                    return currentText;
                }

                if (attempts % 5 === 0) console.log(`JSON incomplete, waiting... (Stable: ${stableCount}/10)`);
            }
        } else {
            stableCount = 0;
        }

        if (attempts === 10) {
            const html = await page.content();
            const fs = await import('fs');
            fs.writeFileSync('debug_claude.html', html);
            console.log("Dumped HTML to debug_claude.html");
        }

        lastText = currentText;
        attempts++;
        if (attempts % 5 === 0) console.log(`[${attempts}/${MAX_ATTEMPTS}] Waiting for response... (${currentText.length} chars)`);
    }

    throw new Error("Timeout waiting for AI response.");
}

export async function submitPromptOnly(serviceName, prompt) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    await sendPromptToPage(page, config, prompt, serviceName);
    console.log("[Puppeteer] Prompt submitted without waiting for response.");
    return { success: true };
}

export async function submitPromptAndCaptureImage(serviceName, prompt, screenshotPath) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);
    if (serviceName !== 'GEMINI') {
        throw new Error("?ë ?´ë?ì§ ìº¡ì²???ì¬ GEMINI ?ë¹?¤ì?ë§ ì§?ë©?ë¤.");
    }

    await launchBrowser();
    if (!page) throw new Error("ë©ì¸ ?ì´ì§ê° ì´ê¸°?ëì§ ?ì?µë??");

    // ?¥ ?ë¡¬?í¸ ?ì¡
    console.log("[Puppeteer] Sending prompt to Gemini...");
    await sendPromptToPage(page, config, prompt, serviceName);

    console.log("[Puppeteer] Waiting for image generation to complete...");
    const imageHandleRef = await page.waitForFunction(() => {
        const responses = Array.from(document.querySelectorAll('model-response'));
        if (responses.length === 0) return null;
        const lastResponse = responses[responses.length - 1];
        const queryTargets = [
            ...lastResponse.querySelectorAll('img'),
            ...lastResponse.querySelectorAll('canvas')
        ];
        for (const target of queryTargets) {
            const rect = target.getBoundingClientRect();
            if (!rect || rect.width < 200 || rect.height < 200) continue;
            const tag = target.tagName ? target.tagName.toLowerCase() : '';
            if (tag === 'img') {
                const img = target;
                if (img.complete && img.naturalWidth > 200 && img.naturalHeight > 200) {
                    return target;
                }
            } else if (tag === 'canvas') {
                const canvas = target;
                if (canvas.width > 200 && canvas.height > 200) {
                    return target;
                }
            }
        }
        return null;
    }, { timeout: 120000 }); // 120ì´?(2ë¶? - Gemini ?´ë?ì§ ?ì± ?ê¸?

    const imageHandle = imageHandleRef ? await imageHandleRef.asElement() : null;
    if (!imageHandle) {
        throw new Error("?ì¬ ?ë©´?ì ?´ë?ì§ë¥?ì°¾ì ???ìµ?ë¤.");
    }

    console.log("[Puppeteer] Image found, clicking to open modal...");
    await new Promise(r => setTimeout(r, 500));
    const box = await imageHandle.boundingBox();
    if (!box) throw new Error("?´ë?ì§ ?ì¹ë¥?ì°¾ì ???ìµ?ë¤.");

    // ?´ë?ì§ ?´ë¦­?ì¬ ëª¨ë¬ ?´ê¸°
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await new Promise(r => setTimeout(r, 1500)); // ëª¨ë¬ ë¡ë© ?ê¸?

    console.log("[Puppeteer] Modal opened, extracting image data...");

    let clipboardCopyBase64 = null;
    let copyButtonClicked = false;

    for (let attempt = 0; attempt < 3 && !clipboardCopyBase64; attempt++) {
        const buttonHandleRef = await page.evaluateHandle(() => {
            const candidates = Array.from(document.querySelectorAll('button, div[role="button"], span[role="button"]'));
            return candidates.find((el) => {
                const rawLabel = (el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title') || el.textContent || '').trim();
                if (!rawLabel) return false;
                const normalized = rawLabel.replace(/\s+/g, '').toLowerCase();
                return normalized.includes('이미지복사') || normalized.includes('copyimage');
            }) || null;
        });

        const buttonHandle = buttonHandleRef ? await buttonHandleRef.asElement() : null;
        if (!buttonHandle) {
            if (buttonHandleRef) await buttonHandleRef.dispose();
            await new Promise(r => setTimeout(r, 300));
            continue;
        }

        copyButtonClicked = true;
        const buttonInfo = await page.evaluate((el) => ({
            label: el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title') || el.textContent || '',
            rect: el.getBoundingClientRect()
        }), buttonHandle);
        const labelText = (buttonInfo.label || '').trim();
        console.log(`[Puppeteer] Attempting clipboard copy via label: ${labelText || 'unknown'}`);

        const rect = buttonInfo.rect;
        if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top) && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
            const targetX = rect.left + rect.width / 2;
            const targetY = rect.top + rect.height / 2;
            try {
                await page.mouse.move(targetX, targetY);
            } catch (err) {
                console.warn('[Puppeteer] Mouse move failed, proceeding with direct click:', err?.message);
            }
        }

        await buttonHandle.click({ delay: 80 });
        await new Promise(r => setTimeout(r, 900));

        clipboardCopyBase64 = await page.evaluate(async () => {
            if (!navigator?.clipboard?.read) {
                console.warn('[Browser] Clipboard read API unavailable');
                return null;
            }
            try {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                    if (item.types.includes('image/png')) {
                        const blob = await item.getType('image/png');
                        const buffer = await blob.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        const chunkSize = 32768;
                        let binary = '';
                        for (let i = 0; i < bytes.length; i += chunkSize) {
                            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
                        }
                        return btoa(binary);
                    }
                }
                console.warn('[Browser] Clipboard read did not include image/png');
                return null;
            } catch (err) {
                console.error('[Browser] Clipboard read failed:', err);
                return null;
            }
        });

        await buttonHandle.dispose();

        if (!clipboardCopyBase64) {
            console.warn('[Puppeteer] Clipboard read returned null, retrying...');
            await new Promise(r => setTimeout(r, 400));
        }
    }

    if (clipboardCopyBase64) {
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
        fs.writeFileSync(screenshotPath, clipboardCopyBase64, 'base64');
        console.log(`[Puppeteer] Saved image via clipboard copy -> ${screenshotPath}`);
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 500));
        await imageHandle.dispose();
        return screenshotPath;
    } else if (copyButtonClicked) {
        console.warn('[Puppeteer] Clipboard copy failed, continuing with canvas extraction...');
    } else {
        console.warn('[Puppeteer] Clipboard copy button not found, continuing with canvas extraction...');
    }

    // 원본 URL 우선 추출 후 실패 시 캔버스 폴백
    const imageData = await page.evaluate(async () => {
        // ëª¨ë¬ ???´ë?ì§ ì°¾ê¸° (?¬ë¬ ??í° ?ë)
        const selectors = [
            'div[role="dialog"] img',
            '.image-viewer img',
            'img[src*="googleusercontent"]',
            'model-response img:last-of-type',
            'img[alt*="Generated"]'
        ];

        let img = null;
        for (const selector of selectors) {
            const candidate = document.querySelector(selector);
            if (candidate && candidate.complete && candidate.naturalWidth > 200) {
                img = candidate;
                console.log(`[Browser] Found image with selector: ${selector}`);
                break;
            }
        }

        if (!img) {
            console.error('[Browser] No valid image found in modal');
            return { method: 'none', data: null };
        }

        console.log(`[Browser] Image src: ${img.src?.substring(0, 100)}...`);

        if (img.src && (img.src.startsWith('http://') || img.src.startsWith('https://'))) {
            console.log('[Browser] Fetching image via URL with credentials...');
            try {
                const response = await fetch(img.src, { credentials: 'include' });
                if (!response.ok) {
                    console.error(`[Browser] Fetch failed with status ${response.status}`);
                } else {
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    const chunkSize = 32768;
                    let binary = '';
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
                    }
                    const base64 = btoa(binary);
                    return { method: 'url', data: base64, mime: blob.type || 'image/png' };
                }
            } catch (err) {
                console.error('[Browser] Credentialed fetch failed:', err);
            }
        }

        // ?¥ CORS ë¬¸ì  ?ë¬¸??ë¬´ì¡°ê±?Canvasë¡?ë³??

        console.log('[Browser] Converting image to Canvas (bypassing CORS)...');
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('[Browser] Failed to get canvas context');
                return { method: 'none', data: null };
            }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            console.log(`[Browser] Canvas conversion successful, data length: ${dataUrl.length}`);
            return { method: 'canvas', data: dataUrl };
        } catch (err) {
            console.error('[Browser] Canvas conversion failed:', err);
            return { method: 'none', data: null };
        }
    });

    if (!imageData || !imageData.data) {
        await page.keyboard.press('Escape');
        throw new Error("?´ë?ì§ ?°ì´?°ë? ì¶ì¶?????ìµ?ë¤.");
    }

    console.log(`[Puppeteer] Image extraction method: ${imageData.method}`);

    // ????ë ? ë¦¬ ?ì±
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

    // ???ì²ë¦¬
    if (imageData.method === 'url') {
        // HTTP URL?ì fetchë¡??¤ì´ë¡ë (?ì¬ ?ì´ì§ ? ì?)
        console.log("[Puppeteer] Downloading image from URL via fetch...");
        const imageBuffer = await page.evaluate(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const reader = new FileReader();
                return new Promise((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (err) {
                console.error('[Browser] Fetch failed:', err);
                return null;
            }
        }, imageData.data);

        if (!imageBuffer) {
            await page.keyboard.press('Escape');
            throw new Error("?´ë?ì§ ?¤ì´ë¡ë???¤í¨?ìµ?ë¤.");
        }

        const base64Data = imageBuffer.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(screenshotPath, base64Data, 'base64');
        console.log(`[Puppeteer] Downloaded image from URL -> ${screenshotPath}`);

    } else if (imageData.method === 'canvas') {
        // Base64 ?°ì´??ì§ì  ???
        console.log("[Puppeteer] Saving image from Canvas conversion...");
        const base64Data = imageData.data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(screenshotPath, base64Data, 'base64');
        console.log(`[Puppeteer] Saved image from Canvas -> ${screenshotPath}`);
    }

    // ëª¨ë¬ ?«ê¸°
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    await imageHandle.dispose();
    console.log(`[Puppeteer] ??Image capture completed: ${screenshotPath}`);
    return screenshotPath;
}

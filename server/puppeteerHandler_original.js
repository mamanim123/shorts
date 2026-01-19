import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

puppeteer.use(StealthPlugin());

// 🔹 대본 생성용 브라우저 (generateContent용)
let scriptBrowser;
let scriptPage;

// 🔹 이미지 생성용 브라우저 (submitPromptAndCaptureImage용)
let imageBrowser;
let imagePage;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const SERVICES = {
    GEMINI: {
        url: 'https://gemini.google.com/app',
        selectors: {
            input: 'div[contenteditable="true"], div[role="textbox"]',
            sendBtn: 'button[aria-label="Send"], button[aria-label*="Send"], .send-button, button[data-testid="send-button"]',
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
            input: 'textarea.search-input, .j-search-input, textarea[placeholder]',
            // Found via agent: element 27 (textarea) -> element 28 (div button)
            sendBtn: '.j-search-input + div, textarea.search-input + div, div[class*="send-button"], button[aria-label="Send"]',
            response: '.markdown-body, .message-content, div[class*="answer"], div[class*="model-response"]',
        }
    }
};

// 🔹 대본 생성용 브라우저 실행
export async function launchScriptBrowser() {
    try {
        if (scriptBrowser && scriptBrowser.isConnected()) {
            if (scriptPage && !scriptPage.isClosed()) {
                return;
            }
        }

        if (scriptBrowser) {
            try { await scriptBrowser.close(); } catch (e) { }
        }

        const headless = false;
        const userDataPath = path.join(process.cwd(), 'user_data_script');
        console.log(`[Puppeteer Script] 📝 Using user data dir: ${userDataPath}`);
        console.log(`[Puppeteer Script] Headless mode: ${headless}`);

        scriptBrowser = await puppeteer.launch({
            headless,
            defaultViewport: null,
            args: [
                '--window-size=1024,768',
                '--window-position=0,0',  // 왼쪽에 배치
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
            userDataDir: userDataPath
        });

        const pages = await scriptBrowser.pages();
        scriptPage = pages.length > 0 ? pages[0] : await scriptBrowser.newPage();

        await scriptPage.setBypassCSP(true);
        const context = scriptPage.browserContext();
        await context.overridePermissions('https://gemini.google.com', ['clipboard-read', 'clipboard-write']);

        scriptBrowser.on('disconnected', () => {
            console.log("[Puppeteer Script] 📝 Browser disconnected.");
            scriptBrowser = null;
            scriptPage = null;
        });

        console.log("[Puppeteer Script] 📝 Browser launched successfully.");
    } catch (error) {
        console.error("[Puppeteer Script] Failed to launch browser:", error);
        throw error;
    }
}

// 🔹 이미지 생성용 브라우저 실행
export async function launchImageBrowser() {
    try {
        if (imageBrowser && imageBrowser.isConnected()) {
            if (imagePage && !imagePage.isClosed()) {
                return;
            }
        }

        if (imageBrowser) {
            try { await imageBrowser.close(); } catch (e) { }
        }

        const headless = false;
        const userDataPath = path.join(process.cwd(), 'user_data_image');
        console.log(`[Puppeteer Image] 🎨 Using user data dir: ${userDataPath}`);
        console.log(`[Puppeteer Image] Headless mode: ${headless}`);

        imageBrowser = await puppeteer.launch({
            headless,
            defaultViewport: null,
            args: [
                '--window-size=1024,768',
                '--window-position=1050,0',  // 오른쪽에 배치
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
            userDataDir: userDataPath
        });

        const pages = await imageBrowser.pages();
        imagePage = pages.length > 0 ? pages[0] : await imageBrowser.newPage();

        await imagePage.setBypassCSP(true);
        const context = imagePage.browserContext();
        await context.overridePermissions('https://gemini.google.com', ['clipboard-read', 'clipboard-write']);

        imageBrowser.on('disconnected', () => {
            console.log("[Puppeteer Image] 🎨 Browser disconnected.");
            imageBrowser = null;
            imagePage = null;
        });

        // [FIX] Navigate to Gemini page after launching
        console.log("[Puppeteer Image] 🎨 Navigating to Gemini...");
        await imagePage.goto('https://gemini.google.com/app', { waitUntil: 'networkidle2' });

        console.log("[Puppeteer Image] 🎨 Browser launched successfully.");
    } catch (error) {
        console.error("[Puppeteer Image] Failed to launch browser:", error);
        throw error;
    }
}

// 🔹 Backward compatibility (기본은 대본 브라우저 사용)
export const launchBrowser = launchScriptBrowser;
export const initBrowser = launchScriptBrowser;

// 🔹 대본 생성용 서비스 전환
export async function switchScriptService(serviceName) {
    await launchScriptBrowser();

    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    if (scriptPage.url().includes(config.url)) {
        console.log(`[Puppeteer Script] 📝 Already on ${serviceName}`);
        return;
    }

    console.log(`[Puppeteer Script] 📝 Switching to ${serviceName}...`);
    await scriptPage.goto(config.url, { waitUntil: 'networkidle2' });
}

// 🔹 이미지 생성용 서비스 전환
export async function switchImageService(serviceName) {
    await launchImageBrowser();

    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    if (imagePage.url().includes(config.url)) {
        console.log(`[Puppeteer Image] 🎨 Already on ${serviceName}`);
        return;
    }

    console.log(`[Puppeteer Image] 🎨 Switching to ${serviceName}...`);
    await imagePage.goto(config.url, { waitUntil: 'networkidle2' });
}

// 🔹 Backward compatibility (기본은 대본 서비스 전환)
export const switchService = switchScriptService;

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

    // GEMINI와 CLAUDE는 Enter로 전송
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

    // 🔹 대본 생성은 scriptPage 사용
    await launchScriptBrowser();
    await sendPromptToPage(scriptPage, config, prompt, serviceName);

    console.log("Waiting for response...");
    await new Promise(r => setTimeout(r, 5000));

    const MAX_ATTEMPTS = 300; // 300 * 2s = 600s (10 minutes) timeout
    let attempts = 0;
    let lastText = "";
    let stableCount = 0;

    while (attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s

        // [NEW] Check for Login Redirect or Modal (Critical for Genspark)
        const isLoginModalVisible = await scriptPage.evaluate(() => {
            const modal = document.querySelector('.n-modal, .auth-modal, div[role="dialog"]');
            if (modal && (modal.innerText.includes('Sign in') || modal.innerText.includes('Log in') || modal.innerText.includes('로그인'))) {
                return true;
            }
            return false;
        });

        if (scriptPage.url().includes('accounts.google.com') || scriptPage.url().includes('/login') || scriptPage.url().includes('signin') || isLoginModalVisible) {
            console.warn("[Puppeteer Script] Login detected.");
            throw new Error("Login page/modal detected. Please log in manually.");
        }

        // [NEW] Check for "Continue generating" button (ChatGPT/Claude)
        const continueClicked = await scriptPage.evaluate(() => {
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
            console.log("[Puppeteer Script] Clicked 'Continue generating' button. Resetting stability check.");
            stableCount = 0; // Reset stability as text will change
            attempts = Math.max(0, attempts - 30); // Give more time (extend timeout)
            continue; // Skip the rest of the loop to wait for new text
        }

        // Check if generation is complete by looking for the Send button
        const isGenerationComplete = await scriptPage.evaluate((selector) => {
            const sendBtn = document.querySelector(selector);
            // If send button exists and is NOT disabled, generation is likely done
            if (sendBtn && !sendBtn.disabled && !sendBtn.hasAttribute('disabled')) {
                return true;
            }
            return false;
        }, config.selectors.sendBtn);

        const currentText = await scriptPage.evaluate((selector, serviceName) => {
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
        if (currentText && currentText.length > 300) {
            // 1. Try to PARSE (Fast Path)
            try {
                let cleanText = currentText.trim();
                if (cleanText.startsWith('```')) {
                    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '');
                }
                const parsed = JSON.parse(cleanText);

                // [DEBUG] Log actual JSON structure
                console.log("🔍 DEBUG: Parsed JSON keys:", Object.keys(parsed));
                console.log("🔍 DEBUG: Has 'scripts' array?", Array.isArray(parsed.scripts));
                if (parsed.scripts && Array.isArray(parsed.scripts) && parsed.scripts.length > 0) {
                    console.log("🔍 DEBUG: First script keys:", Object.keys(parsed.scripts[0]));
                }

                // [ENHANCED] Support both direct format and { scripts: [...] } format
                let dataToCheck = parsed;
                if (parsed.scripts && Array.isArray(parsed.scripts) && parsed.scripts.length > 0) {
                    dataToCheck = parsed.scripts[0]; // Use first script in array
                    console.log("📦 Detected scripts array format, checking first script");
                }

                // [ENHANCED] Check if JSON has required fields for various modes
                const isScript = (dataToCheck.title || dataToCheck.titleOptions) && (dataToCheck.scriptBody || dataToCheck.script || dataToCheck.scenes);
                const isTemplate = dataToCheck.templateName && dataToCheck.structure;
                const isAnalysis = dataToCheck.scores && (dataToCheck.totalScore !== undefined || dataToCheck.improvements);

                if (isScript || isTemplate || isAnalysis) {
                    console.log(`✅ JSON Parse Successful! ${isScript ? 'Script' : isTemplate ? 'Template' : 'Analysis'} detected. Generation Complete.`);
                    return currentText;
                } else {
                    console.log(`⏳ JSON parsed but incomplete (Script: ${!!isScript}, Template: ${!!isTemplate}, Analysis: ${!!isAnalysis}). Waiting...`);
                }
            } catch (e) {
                // Parse failed. Check stability (Slow Path)
                if (currentText === lastText) {
                    stableCount++;
                } else {
                    stableCount = 0;
                }

                // [ENHANCED] If text hasn't changed for 60 seconds (30 checks * 2s), assume done.
                if (stableCount >= 30) {
                    console.warn(`⚠️ JSON invalid but text stable for 60s. Returning anyway. Length: ${currentText.length}`);
                    return currentText;
                }

                if (attempts % 5 === 0) console.log(`⏳ JSON incomplete, waiting... (Stable: ${stableCount}/30, Length: ${currentText.length})`);
            }
        } else {
            stableCount = 0;
            if (attempts % 10 === 0 && currentText) {
                console.log(`⏳ Response too short (${currentText.length} chars), waiting for more content...`);
            }
        }

        if (attempts === 10) {
            const html = await scriptPage.content();
            const fs = await import('fs');
            fs.writeFileSync('debug_script_browser.html', html);
            console.log("[Puppeteer Script] Dumped HTML to debug_script_browser.html");
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

    // 🔹 이미지 생성은 imagePage 사용
    await launchImageBrowser();
    await sendPromptToPage(imagePage, config, prompt, serviceName);
    console.log("[Puppeteer Image] 🎨 Prompt submitted without waiting for response.");
    return { success: true };
}

const GEMINI_NEW_CHAT_SELECTORS = [
    'button[aria-label="새 채팅"]',
    'button[aria-label="새 대화"]',
    'button[aria-label="New chat"]',
    'a[aria-label="새 채팅"]',
    'a[aria-label="New chat"]',
    'div[role="button"][aria-label="새 채팅"]',
    'div[role="button"][aria-label="New chat"]'
];

async function startFreshGeminiChat() {
    if (!imagePage) return false;
    try {
        for (const selector of GEMINI_NEW_CHAT_SELECTORS) {
            const buttonHandle = await imagePage.$(selector);
            if (buttonHandle) {
                await buttonHandle.click();
                await delay(800);
                return true;
            }
        }

        const clickedByText = await imagePage.evaluate(() => {
            const keywords = ['새 채팅', '새 대화', 'New chat', 'New conversation'];
            const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], md-icon-button, span[role="button"]'));
            for (const el of candidates) {
                const text = (el.textContent || '').trim();
                const aria = (el.getAttribute('aria-label') || '').trim();
                if (keywords.some(keyword => text === keyword || aria === keyword || text.includes(keyword))) {
                    el.click();
                    return true;
                }
            }
            return false;
        });

        if (clickedByText) {
            await delay(800);
            return true;
        }
    } catch (err) {
        console.warn(`[Puppeteer] Failed to trigger Gemini new chat button: ${err.message}`);
    }

    try {
        await imagePage.goto('https://gemini.google.com/app', { waitUntil: 'networkidle2' });
        await delay(800);
        return true;
    } catch (err) {
        console.warn(`[Puppeteer] Fallback navigation to Gemini failed: ${err.message}`);
    }
    return false;
}

export async function submitPromptAndCaptureImage(serviceName, prompt, screenshotPath, options = {}) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);
    if (serviceName !== 'GEMINI') {
        throw new Error("Image capture is only supported for GEMINI service.");
    }

    const { requestToken, storyId, sceneNumber, attempt = 1 } = options;
    const captureLabel = `[${storyId || 'unknown'}:${sceneNumber ?? '?'}|attempt-${attempt}]`;

    await launchImageBrowser();
    if (!imagePage) throw new Error("Image page not initialized");

    try {
        await startFreshGeminiChat();
    } catch (err) {
        console.warn(`[Puppeteer] Failed to reset Gemini chat session: ${err?.message || err}`);
    }

    const downloadDir = path.dirname(path.resolve(screenshotPath));
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`[Puppeteer Image] 🎨 Download directory set to: ${downloadDir}`);

    const cleanupOldGeminiFiles = () => {
        try {
            const existingFiles = fs.readdirSync(downloadDir);
            const geminiFiles = existingFiles.filter(f => f.startsWith('Gemini_Generated_Image_'));
            if (geminiFiles.length === 0) {
                console.log(`[Puppeteer] 🧹 No old Gemini files to clean up`);
                return;
            }
            console.log(`[Puppeteer] 🧹 Cleaning ${geminiFiles.length} Gemini files before capture`);
            for (const file of geminiFiles) {
                const filePath = path.join(downloadDir, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.warn(`[Puppeteer] ⚠️ Failed to delete ${file}: ${err.message}`);
                }
            }
        } catch (err) {
            console.error(`[Puppeteer] ❌ Cleanup error: ${err.message}`);
        }
    };
    cleanupOldGeminiFiles();

    const downloadStartTime = Date.now();
    console.log(`[Puppeteer] ${captureLabel} Download start at ${new Date(downloadStartTime).toISOString()}`);

    const client = await imagePage.createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir
    });

    const initialResponseMeta = await imagePage.evaluate(() => {
        return Array.from(document.querySelectorAll('model-response')).map(el => el.getAttribute('data-response-id') || '');
    });
    const initialResponseCount = initialResponseMeta.length;
    console.log(`[Puppeteer Image] 📊 ${captureLabel} Initial response count: ${initialResponseCount}`);

    const markerInstruction = requestToken
        ? `\n\n(자동화 검증 토큰: ${requestToken}. Gemini 응답 텍스트에 동일한 토큰을 포함해주세요.)`
        : '';

    console.log(`[Puppeteer Image] 🎨 Sending prompt to Gemini ${captureLabel}...`);
    await sendPromptToPage(imagePage, config, `${prompt}${markerInstruction}`, serviceName);
    console.log("[Puppeteer Image] 🎨 Waiting for NEW response to appear...");

    const downloadMeta = await imagePage.evaluate(({ expectedCount, knownIds, token }) => {
        return new Promise((resolve) => {
            const knownSet = new Set((knownIds || []).filter(Boolean));

            const checkInterval = setInterval(() => {
                const responses = Array.from(document.querySelectorAll('model-response'));
                if (responses.length <= expectedCount) {
                    return;
                }

                const newResponses = responses.filter((_, idx) => idx >= expectedCount);
                let targetResponse = null;

                for (let i = newResponses.length - 1; i >= 0; i--) {
                    const el = newResponses[i];
                    const responseId = el.getAttribute('data-response-id') || el.getAttribute('data-id') || `${Date.now()}-${i}`;
                    if (!responseId || knownSet.has(responseId)) continue;
                    const text = (el.innerText || el.textContent || '').trim();
                    const tokenMatched = token ? text.includes(token) : false;
                    targetResponse = { el, responseId, tokenMatched };
                    knownSet.add(responseId);
                    break;
                }

                if (!targetResponse) {
                    return;
                }

                const queryTargets = [
                    ...targetResponse.el.querySelectorAll('img'),
                    ...targetResponse.el.querySelectorAll('canvas')
                ];

                let lastValidImage = null;
                for (const target of queryTargets) {
                    const rect = target.getBoundingClientRect();
                    if (!rect || rect.width < 200 || rect.height < 200) continue;

                    const tag = target.tagName ? target.tagName.toLowerCase() : '';
                    if (tag === 'img') {
                        const img = target;
                        if (img.complete && img.naturalWidth > 200 && img.naturalHeight > 200) {
                            lastValidImage = target;
                        }
                    } else if (tag === 'canvas') {
                        const canvas = target;
                        if (canvas.width > 200 && canvas.height > 200) {
                            lastValidImage = target;
                        }
                    }
                }

                if (lastValidImage) {
                    lastValidImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    lastValidImage.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));

                    setTimeout(() => {
                        const buttons = Array.from(document.querySelectorAll('button, span[role="button"], md-icon-button, a'));
                        const downloadBtn = buttons.find(btn => {
                            const label = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || btn.innerText || '').trim();
                            return label.includes('원본') || label.includes('다운로드') || label.toLowerCase().includes('download');
                        });

                        if (downloadBtn) {
                            downloadBtn.click();
                            clearInterval(checkInterval);
                            resolve({
                                clicked: true,
                                responseId: targetResponse.responseId,
                                tokenMatched: targetResponse.tokenMatched
                            });
                        }
                    }, 1000);
                }
            }, 500);

            setTimeout(() => {
                clearInterval(checkInterval);
                resolve({ clicked: false, reason: 'timeout' });
            }, 120000);
        });
    }, {
        expectedCount: initialResponseCount,
        knownIds: initialResponseMeta,
        token: requestToken
    });

    if (!downloadMeta?.clicked) {
        throw new Error("Download button not found or not clickable");
    }

    console.log(`[Puppeteer Image] ✅ Response ${downloadMeta.responseId || 'unknown'} (token match: ${downloadMeta.tokenMatched ? 'yes' : 'no'})`);

    console.log(`[Puppeteer Image] 🎨 Download button clicked, waiting for file...`);

    let downloadedFile = null;
    const maxWaitTime = 30000;
    const startTime = Date.now();

    while (!downloadedFile && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(r => setTimeout(r, 1000));

        try {
            const files = fs.readdirSync(downloadDir);
            const geminiFiles = files.filter(f => f.startsWith('Gemini_Generated_Image_'));

            if (geminiFiles.length > 0) {
                const imageFiles = geminiFiles
                    .filter(f => {
                        const ext = f.toLowerCase();
                        return (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp'))
                            && !ext.endsWith('.crdownload') && !ext.endsWith('.tmp');
                    })
                    .map(f => {
                        const filePath = path.join(downloadDir, f);
                        const stats = fs.statSync(filePath);
                        return {
                            name: f,
                            path: filePath,
                            mtime: stats.mtime.getTime(),
                            ctime: stats.ctime.getTime()
                        };
                    })
                    .filter(f => f.ctime >= downloadStartTime)
                    .sort((a, b) => b.mtime - a.mtime);

                if (imageFiles.length > 0) {
                    downloadedFile = imageFiles[0].path;
                    console.log(`[Puppeteer] ✅ Found newly downloaded file: ${downloadedFile}`);
                    break;
                }
            }
        } catch (err) {
            console.error(`[Puppeteer] Error reading download dir: ${err.message}`);
        }
    }

    if (!downloadedFile) {
        throw new Error("Failed to download image via download button");
    }

    if (downloadedFile !== path.resolve(screenshotPath)) {
        fs.copyFileSync(downloadedFile, screenshotPath);
        console.log(`[Puppeteer] ✅ Image saved to: ${screenshotPath}`);
        try {
            fs.unlinkSync(downloadedFile);
        } catch (err) {
            console.warn(`[Puppeteer] ⚠️ Failed to delete original download ${downloadedFile}: ${err.message}`);
        }
    }

    const fileBuffer = fs.readFileSync(screenshotPath);
    const fileHash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
    const bytes = fileBuffer.length;

    const tokenMatched = requestToken ? Boolean(downloadMeta?.tokenMatched) : true;

    return {
        path: screenshotPath,
        hash: fileHash,
        bytes,
        responseId: downloadMeta?.responseId || null,
        tokenMatched
    };
}

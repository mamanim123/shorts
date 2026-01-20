import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_BASE = path.join(__dirname, '..', 'puppeteer_user_data');
if (!fs.existsSync(USER_DATA_BASE)) fs.mkdirSync(USER_DATA_BASE, { recursive: true });

// 🔹 통합 브라우저 (대본 생성 + 이미지 생성 모두 사용)
let scriptBrowser;
let scriptPage;
let scriptCdpClient = null;

// 🔹 [DEPRECATED] 이미지 브라우저는 더 이상 사용하지 않음 - scriptBrowser로 통합됨
// 하위 호환성을 위해 별칭만 유지
let imageBrowser = null;
let imagePage = null;
let imageCdpClient = null;

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
    },
    DEEPSEEK: {
        url: 'https://chat.deepseek.com',
        selectors: {
            input: '#chat-input',
            sendBtn: '.ds-icon-button',
            response: '.ds-markdown',
        }
    },
    VIDEOFX: {
        url: 'https://labs.google/fx/tools/flow', // Updated URL (Flow)
        selectors: {
            input: 'textarea[placeholder*="비디오"], textarea[placeholder*="video"], textarea[placeholder*="Describe"], textarea, .prompt-input',
            sendBtn: 'button[aria-label*="생성"], button[aria-label*="Generate"], button[aria-label*="Create"], button[aria-label*="Start"], button[type="submit"], .generate-button',
            response: 'video, .video-container, [data-testid="video-player"]',
        }
    }
};

// 🔹 비디오 생성용 브라우저
let videoBrowser;
let videoPage;
let videoGenerationInProgress = false;

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
        console.log(`[Puppeteer Script] Headless mode: ${headless}`);

        scriptBrowser = await puppeteer.launch({
            headless,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--window-size=1024,768',
                '--window-position=0,0',  // 왼쪽에 배치
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            userDataDir: path.join(USER_DATA_BASE, 'script_gen')
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

// 🔹 [UNIFIED] 이미지 생성도 scriptBrowser 사용 (통합됨)
// 기존 launchImageBrowser 호출을 위한 하위 호환성 유지
export async function launchImageBrowser() {
    console.log("[Puppeteer] 🔄 launchImageBrowser → switchScriptService('GEMINI') (통합됨)");
    await switchScriptService('GEMINI');
    // 별칭 설정 (하위 호환성)
    imageBrowser = scriptBrowser;
    imagePage = scriptPage;
    imageCdpClient = scriptCdpClient;
}

// 🔹 비디오 생성용 브라우저 실행
export async function launchVideoBrowser() {
    try {
        if (videoBrowser && videoBrowser.isConnected()) {
            if (videoPage && !videoPage.isClosed()) {
                return;
            }
        }

        if (videoBrowser) {
            try { await videoBrowser.close(); } catch (e) { }
        }

        const headless = false;
        console.log(`[Puppeteer Video] Headless mode: ${headless}`);

        videoBrowser = await puppeteer.launch({
            headless,
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--window-size=1280,800',
                '--window-position=50,50',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            userDataDir: path.join(USER_DATA_BASE, 'video_gen')
        });

        const pages = await videoBrowser.pages();
        videoPage = pages.length > 0 ? pages[0] : await videoBrowser.newPage();

        await videoPage.setBypassCSP(true);

        videoBrowser.on('disconnected', () => {
            console.log("[Puppeteer Video] 🎞️ Browser disconnected.");
            videoBrowser = null;
            videoPage = null;
        });

        console.log("[Puppeteer Video] 🎞️ Browser launched successfully.");
    } catch (error) {
        console.error("[Puppeteer Video] Failed to launch browser:", error);
        throw error;
    }
}

// 🔹 비디오 서비스 전환
export async function switchVideoService() {
    await launchVideoBrowser();
    const config = SERVICES.VIDEOFX;

    const currentUrl = videoPage.url();
    if (currentUrl.includes('labs.google/fx/tools/flow') || currentUrl.includes('labs.google/fx/tools/video-fx')) {
        console.log(`[Puppeteer Video] 🎞️ Already on VideoFX/Flow`);
    } else {
        console.log(`[Puppeteer Video] 🎞️ Navigating to VideoFX (Flow)...`);
        await videoPage.goto(config.url, { waitUntil: 'networkidle2' });
    }

    // [NEW] 자동 로그인 지원 - "Sign in" 또는 "Get started" 버튼이 있으면 클릭
    try {
        await videoPage.evaluate(() => {
            const loginKeywords = [
                'Sign in', 'Log in', 'Get started', 'Try it',
                '로그인', '시작하기', '사용해보기'
            ];
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
            for (const btn of buttons) {
                const text = (btn.innerText || btn.textContent || '').trim();
                if (loginKeywords.some(k => text.includes(k))) {
                    console.log(`[Puppeteer AutoLogin] Found login-like button: ${text}. Clicking...`);
                    btn.click();
                    return true;
                }
            }
            return false;
        });
        await delay(2000);
    } catch (e) {
        // Ignore errors during auto-login attempt
    }

    // [NEW] 새 프로젝트 버튼 처리 (Flow 초기 진입 게이트)
    try {
        const newProjectClicked = await videoPage.evaluate(() => {
            const keywords = ['New project', '새 프로젝트', '새 프로젝트 만들기', 'Create new project', 'Start a new project', '프로젝트 만들기'];
            const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
            for (const btn of buttons) {
                const text = (btn.innerText || btn.textContent || '').trim();
                if (!text) continue;
                if (keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
                    btn.click();
                    return true;
                }
            }
            return false;
        });
        if (newProjectClicked) {
            console.log('[Puppeteer Video] 🎞️ New Project gate clicked');
            await delay(2000);
        }
    } catch (e) {
        // Ignore errors during new project attempt
    }
}

// 🔹 VideoFX(Veo) 전용 비디오 생성 로직
export async function generateVideoFX(prompt, imageUrl) {
    const config = SERVICES.VIDEOFX;
    await switchVideoService();

    const targetModeKeywords = imageUrl
        ? ['Ingredients to Video', '애셋으로 동영상 만들기']
        : ['Text to Video', '텍스트 동영상 변환'];

    // 1. Precise Mode Switching
    try {
        console.log("[Puppeteer Video] 🎞️ Checking current mode...");
        let modeCorrect = false;
        for (let i = 0; i < 3; i++) {
            modeCorrect = await videoPage.evaluate((keywords) => {
                const combo = document.querySelector('button[role="combobox"], div[role="combobox"]');
                const label = (combo?.innerText || combo?.textContent || '').trim();
                return label && keywords.some(k => label.includes(k));
            }, targetModeKeywords);

            if (modeCorrect) break;

            console.log(`[Puppeteer Video] 🎞️ Switching mode (attempt ${i + 1})...`);
            await videoPage.evaluate(() => {
                const combo = document.querySelector('button[role="combobox"], div[role="combobox"]');
                if (combo) combo.click();
            });
            await delay(1000);

            await videoPage.evaluate((keywords) => {
                const items = Array.from(document.querySelectorAll('[role="option"], li, button, span'));
                const target = items.find(item => {
                    const text = (item.textContent || '').trim();
                    return keywords.some(k => text === k || text.includes(k));
                });
                if (target) target.click();
            }, targetModeKeywords);
            await delay(2000);
        }
    } catch (e) {
        console.warn('[Puppeteer Video] Mode switch failed:', e.message);
    }

    // 2. Robust Image Upload
    if (imageUrl) {
        console.log("[Puppeteer Video] 🎞️ Starting image upload process...");
        try {
            const fullPath = path.resolve(process.cwd(), imageUrl.startsWith("/") ? imageUrl.substring(1) : imageUrl);

            let uploaded = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`[Puppeteer Video] Upload attempt ${attempt}...`);

                // [NEW] Wait specifically for the Add button to appear after mode switch
                try {
                    await videoPage.waitForFunction(() => {
                        const btns = Array.from(document.querySelectorAll('button'));
                        return btns.some(b => b.innerText.trim() === '+' || b.innerText.trim().toLowerCase() === 'add' || (b.querySelector('i') && b.querySelector('i').innerText.trim() === 'add'));
                    }, { timeout: 5000 });
                } catch (e) {
                    console.log("[Puppeteer Video] 🎞️ Add button not detected yet, trying to click anyway...");
                }

                const chooserPromise = videoPage.waitForFileChooser({ timeout: 10000 }).catch(() => null);

                const plusClicked = await videoPage.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const plusBtn = buttons.find(b => {
                        const text = b.innerText.trim().toLowerCase();
                        const iconText = b.querySelector('i')?.innerText.trim().toLowerCase();
                        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                        return text === '+' || text === 'add' || iconText === 'add' || aria.includes('add') || aria.includes('upload');
                    });

                    if (plusBtn) {
                        plusBtn.scrollIntoView();
                        plusBtn.click();
                        return true;
                    }
                    return false;
                });

                console.log(`[Puppeteer Video] 🎞️ Plus button clicked: ${plusClicked}`);
                await delay(2000);

                // Now look for the "Upload" card
                const cardClicked = await videoPage.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('div, button, span'));
                    const uploadCard = els.find(el => {
                        const t = (el.innerText || el.textContent || '').trim();
                        return (t.includes('업로드') || t.includes('Upload')) && (t.includes('.') || t.includes('png') || t.includes('avif'));
                    });
                    if (uploadCard) {
                        uploadCard.click();
                        return true;
                    }
                    return false;
                });

                if (plusClicked || cardClicked) {
                    const fileChooser = await chooserPromise;
                    if (fileChooser) {
                        await fileChooser.accept([fullPath]);
                        console.log("[Puppeteer Video] 🎞️ Image file selected.");
                        uploaded = true;
                        break;
                    }
                }

                const fileInput = await videoPage.$('input[type="file"]');
                if (fileInput) {
                    await fileInput.uploadFile(fullPath);
                    console.log("[Puppeteer Video] 🎞️ Image uploaded via input.");
                    uploaded = true;
                    break;
                }
                await delay(2000);
            }

            if (!uploaded) throw new Error("Could not trigger image upload.");

            console.log("[Puppeteer Video] 🎞️ Waiting for 'Crop and Save' button...");
            let cropBtnClicked = false;
            for (let i = 0; i < 20; i++) {
                cropBtnClicked = await videoPage.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"], span'));
                    const cropBtn = buttons.find(b => {
                        const text = (b.innerText || b.textContent || '').trim();
                        return text.includes('자르기 및 저장') || text.includes('Crop and save') || b.className.includes('jcyPCc');
                    });
                    if (cropBtn) {
                        cropBtn.click();
                        return true;
                    }
                    return false;
                });
                if (cropBtnClicked) {
                    console.log("[Puppeteer Video] 🎞️ 'Crop and Save' button clicked!");
                    break;
                }
                await delay(1000);
            }
            if (cropBtnClicked) await delay(3000);
        } catch (e) {
            console.error("[Puppeteer Video] ❌ Image upload failed:", e.message);
            throw e;
        }
    }

    console.log("[Puppeteer Video] 🎞️ Inserting prompt...");

    try {
        // [ENHANCED] Wait for either input or specialized containers
        await videoPage.waitForSelector(config.selectors.input, { timeout: 30000 });

        // Ensure page is interactive
        await new Promise(r => setTimeout(r, 2000));

        // 입력 필드 클리어 및 프롬프트 입력
        await videoPage.click(config.selectors.input);

        // Select all and Delete
        await videoPage.keyboard.down('Control');
        await videoPage.keyboard.press('A');
        await videoPage.keyboard.up('Control');
        await videoPage.keyboard.press('Backspace');

        // Type prompt slowly to trigger UI updates
        await videoPage.type(config.selectors.input, prompt, { delay: 30 });

        await new Promise(r => setTimeout(r, 1500));

        if (videoGenerationInProgress) {
            console.log("[Puppeteer Video] 🎞️ Generation already in progress. Attempting cancel...");
            const cancelled = await videoPage.evaluate(() => {
                const keywords = ['Cancel', 'Stop', '취소', '중지', '정지'];
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a'));
                for (const btn of buttons) {
                    const text = (btn.innerText || btn.textContent || '').trim();
                    const aria = (btn.getAttribute('aria-label') || '').trim();
                    if (!text && !aria) continue;
                    if (keywords.some(k => text.includes(k) || aria.includes(k))) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });
            if (cancelled) {
                videoGenerationInProgress = false;
                throw new Error('Video generation cancelled by user action');
            }
        }

        console.log("[Puppeteer Video] 🎞️ Clicking Generate button...");
        let clicked = false;
        try {
            await videoPage.click(config.selectors.sendBtn, { timeout: 3000 });
            clicked = true;
        } catch (clickErr) {
            console.warn("[Puppeteer Video] Generate button not found, trying Enter + fallback click by text.");
            await videoPage.keyboard.press('Enter');
            clicked = true;
        }

        if (!clicked) {
            const clickedByText = await videoPage.evaluate(() => {
                const keywords = ['Generate', 'Create', 'Start', '생성', '만들기', '시작'];
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"], a'));
                for (const btn of buttons) {
                    const text = (btn.innerText || btn.textContent || '').trim();
                    if (!text) continue;
                    if (keywords.some(k => text.toLowerCase().includes(k.toLowerCase()))) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });
            if (!clickedByText) {
                throw new Error('Generate button not found after fallback');
            }
        }
        videoGenerationInProgress = true;
    } catch (err) {
        console.error("[Puppeteer Video] Input/Generate failed:", err.message);
        throw err;
    }

    // ✅ 프롬프트 전송 완료 - 여기서 바로 종료 (대기 루프 제거)
    console.log("[Puppeteer Video] ✅ 영상 생성 요청 완료 - Flow에서 수동 다운로드 후 '가져오기' 버튼 사용");

    return {
        success: true,
        message: '영상 생성 요청 완료. Flow에서 영상이 완성되면 다운로드 후 가져오기 버튼을 사용하세요.',
        status: 'submitted'
    };
}

/*console.log("[Puppeteer Video] 🎞️ Waiting for video generation (this may take a few minutes)...");

// 비디오 생성 완료 대기 로직
// VideoFX는 보통 생성이 완료되면 <video> 태그가 나타나거나 업데이트됨
const MAX_WAIT = 60; // 60 * 5s = 300s (5분)
let waited = 0;
let videoUrl = null;

while (waited < MAX_WAIT) {
    await new Promise(r => setTimeout(r, 5000));

    const videoResult = await videoPage.evaluate((selector) => {
        const container = document.querySelector(selector);
        const directVideo = container && container.tagName === 'VIDEO' ? container : null;
        const nestedVideo = container ? container.querySelector('video') : null;
        const fallbackVideo = document.querySelector('video');
        const video = directVideo || nestedVideo || fallbackVideo;
        if (!video) return { url: null };

        const source = video.querySelector('source');
        const url = video.currentSrc || video.src || (source ? source.src : null);

        if (url && (url.startsWith('blob:') || url.includes('googleusercontent') || url.includes('data:video'))) {
            return { url };
        }
        return { url: null };
    }, config.selectors.response);

    videoUrl = videoResult?.url || null;

    if (videoUrl) {
        console.log("✅ Video generation complete!");
        videoGenerationInProgress = false;

        // Hover over video to reveal download controls
        try {
            await videoPage.evaluate((selector) => {
                const container = document.querySelector(selector);
                const directVideo = container && container.tagName === 'VIDEO' ? container : null;
                const nestedVideo = container ? container.querySelector('video') : null;
                const fallbackVideo = document.querySelector('video');
                const video = directVideo || nestedVideo || fallbackVideo;
                if (!video) return false;
                const rect = video.getBoundingClientRect();
                const event = new MouseEvent('mousemove', {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                });
                video.dispatchEvent(event);
                return true;
            }, config.selectors.response);
            await delay(800);
        } catch (e) {
            console.warn("[Puppeteer Video] Hover to reveal download controls failed:", e.message);
        }

        // Click download button and select 1080p option
        try {
            const downloadClicked = await videoPage.evaluate(() => {
                const candidates = Array.from(document.querySelectorAll('button, a, div[role="button"], span'));
                const downloadBtn = candidates.find(el => {
                    const text = (el.innerText || el.textContent || '').trim();
                    const aria = (el.getAttribute('aria-label') || '').trim();
                    return text.includes('다운로드') || text.includes('Download') || aria.includes('Download') || aria.includes('다운로드');
                });
                if (downloadBtn) {
                    downloadBtn.click();
                    return true;
                }
                return false;
            });
            if (downloadClicked) {
                console.log("[Puppeteer Video] 🎞️ Download button clicked.");
                await delay(800);
                const optionClicked = await videoPage.evaluate(() => {
                    const items = Array.from(document.querySelectorAll('button, div[role="menuitem"], div[role="button"], li, span'));
                    const target = items.find(el => {
                        const text = (el.innerText || el.textContent || '').trim();
                        return text.includes('업스케일') || text.includes('1080p');
                    });
                    if (target) {
                        target.scrollIntoView();
                        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                        target.click();
                        return true;
                    }
                    return false;
                });
                if (optionClicked) {
                    console.log("[Puppeteer Video] 🎞️ Download option selected: 1080p.");
                } else {
                    console.warn("[Puppeteer Video] ⚠️ Download option 1080p not found.");
                }
            }
        } catch (e) {
            console.warn("[Puppeteer Video] Download click failed:", e.message);
        }

        // Blob URL인 경우 직접 다운로드하여 base64로 변환하거나 서버측에서 처리 필요
        // 여기서는 일단 URL 반환 후 필요 시 추가 처리
        if (videoUrl.startsWith('blob:')) {
            const base64 = await videoPage.evaluate(async (url) => {
                const resp = await fetch(url);
                const blob = await resp.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
            }, videoUrl);
            return base64;
        }

        return videoUrl;
    }

    waited++;
    if (waited % 2 === 0) console.log(`⏳ Still waiting for video... (${waited * 5}s)`);
}

videoGenerationInProgress = false;
throw new Error("Video generation timed out.");
}*/

// 🔹 [NEW] 모든 브라우저 종료 (클린업용)
export async function closeAllBrowsers() {
    console.log("[Puppeteer] 🧹 Closing all browser instances...");
    try {
        if (scriptBrowser) {
            console.log("[Puppeteer Script] Closing browser...");
            await scriptBrowser.close();
            scriptBrowser = null;
            scriptPage = null;
        }
        if (videoBrowser) {
            console.log("[Puppeteer Video] Closing browser...");
            await videoBrowser.close();
            videoBrowser = null;
            videoPage = null;
        }
        imageBrowser = null; // scriptBrowser와 통합되어 있으므로 참조만 해제
        console.log("[Puppeteer] 🏠 All browsers closed.");
        return true;
    } catch (err) {
        console.error("[Puppeteer] ❌ Error during browser cleanup:", err.message);
        return false;
    }
}

// 🔹 Backward compatibility (기본은 대본 브라우저 사용)
export const launchBrowser = launchScriptBrowser;
export const initBrowser = launchScriptBrowser;
export const closeBrowser = closeAllBrowsers; // 별칭 추가

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

async function uploadFileToPage(activePage, filePath) {
    try {
        console.log(`[Puppeteer] Attempting to upload file: ${filePath}`);
        const [fileChooser] = await Promise.all([
            activePage.waitForFileChooser(),
            activePage.click('button[aria-label*="업로드"], button[aria-label*="upload"], .upload-button, md-icon-button:has(mat-icon[svgicon*="upload"])').catch(() => {
                // Fallback for Gemini specifically
                return activePage.click('input[type="file"]');
            })
        ]);
        await fileChooser.accept([filePath]);
        await delay(2000); // Wait for upload to process
        console.log(`[Puppeteer] File uploaded successfully.`);
    } catch (err) {
        console.warn(`[Puppeteer] File upload failed: ${err.message}. Proceeding with text only.`);
    }
}

async function sendPromptToPage(activePage, config, prompt, serviceName, files = []) {
    await activePage.waitForSelector(config.selectors.input);

    // Upload files if provided
    if (files && files.length > 0) {
        for (const file of files) {
            await uploadFileToPage(activePage, file);
        }
    }

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

    // GEMINI, CLAUDE, DEEPSEEK는 Enter로 전송
    if (serviceName === 'CLAUDE' || serviceName === 'GEMINI' || serviceName === 'DEEPSEEK') {
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

export async function generateContent(serviceName, prompt, files = []) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    // 🔹 대본 생성은 scriptPage 사용
    await launchScriptBrowser();
    await sendPromptToPage(scriptPage, config, prompt, serviceName, files);

    console.log("Waiting for response...");
    await new Promise(r => setTimeout(r, 5000));

    const MAX_ATTEMPTS = 300; // 300 * 2s = 600s (10 minutes) timeout
    let attempts = 0;
    let lastText = "";
    let stableCount = 0;

    while (attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s

        // [REMOVED] Login detection logic to allow manual intervention without error
        /*
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
        */

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

                // [OPTIMIZED] Relaxed validation - accept if ANY key field exists
                const isScript = dataToCheck.script || dataToCheck.scriptBody ||
                    dataToCheck.scenes || dataToCheck.title || dataToCheck.titleOptions ||
                    dataToCheck.hook || dataToCheck.twist;
                const isTemplate = dataToCheck.templateName && dataToCheck.structure;
                const isAnalysis = dataToCheck.scores && (dataToCheck.totalScore !== undefined || dataToCheck.improvements);
                const isCharacterAnalysis = Array.isArray(parsed) ||
                    (parsed.characters && Array.isArray(parsed.characters)) ||
                    (Object.keys(parsed).length > 0 && Object.keys(parsed).every(k => !isNaN(parseInt(k))));

                if (isScript || isTemplate || isAnalysis || isCharacterAnalysis) {
                    console.log(`✅ JSON Parse Successful! ${isScript ? 'Script' : isTemplate ? 'Template' : isAnalysis ? 'Analysis' : 'Character'} detected. Generation Complete.`);
                    return currentText;
                } else {
                    console.log(`⏳ JSON parsed but incomplete (Script: ${!!isScript}, Template: ${!!isTemplate}, Analysis: ${!!isAnalysis}, Char: ${!!isCharacterAnalysis}). Waiting...`);
                }
            } catch (e) {
                // Parse failed. Check stability (Slow Path)
                if (currentText === lastText) {
                    stableCount++;
                } else {
                    stableCount = 0;
                }

                // [OPTIMIZED] Reduced stability wait time from 60s to 20s
                if (stableCount >= 10) {
                    console.warn(`⚠️ JSON invalid but text stable for 20s. Returning anyway. Length: ${currentText.length}`);
                    return currentText;
                }

                if (attempts % 5 === 0) console.log(`⏳ JSON incomplete, waiting... (Stable: ${stableCount}/10, Length: ${currentText.length})`);
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

// 🔹 [NEW] 단순 텍스트 생성 (비디오 프롬프트 등 일반 텍스트 응답용)
// JSON 검증 없이 텍스트 안정성만 체크하여 빠른 응답 반환
export async function generateSimpleText(serviceName, prompt) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    // ✅ [FIX] Gemini 페이지로 먼저 이동해야 입력 필드를 찾을 수 있음
    await switchScriptService(serviceName);
    await sendPromptToPage(scriptPage, config, prompt, serviceName);

    console.log("[SimpleText] Waiting for text response...");
    await new Promise(r => setTimeout(r, 3000));

    const MAX_ATTEMPTS = 60; // 60 * 2s = 120s (2분 타임아웃)
    let attempts = 0;
    let lastText = "";
    let stableCount = 0;

    while (attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 2000));

        const currentText = await scriptPage.evaluate((selector) => {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return elements[elements.length - 1].innerText;
            }
            return "";
        }, config.selectors.response);

        // 텍스트가 있고, 50자 이상이면 안정성 체크
        if (currentText && currentText.length > 50) {
            if (currentText === lastText) {
                stableCount++;
            } else {
                stableCount = 0;
            }

            // 6초간 텍스트가 변하지 않으면 완료로 간주
            if (stableCount >= 3) {
                console.log(`[SimpleText] ✅ Text stable for 6s. Returning response. Length: ${currentText.length}`);
                return currentText.trim();
            }
        }

        lastText = currentText;
        attempts++;
        if (attempts % 5 === 0) {
            console.log(`[SimpleText] [${attempts}/${MAX_ATTEMPTS}] Waiting... (${currentText?.length || 0} chars, stable: ${stableCount}/3)`);
        }
    }

    // 타임아웃이어도 마지막 텍스트가 있으면 반환
    if (lastText && lastText.length > 50) {
        console.warn(`[SimpleText] ⚠️ Timeout but returning last text. Length: ${lastText.length}`);
        return lastText.trim();
    }

    throw new Error("Timeout waiting for simple text response.");
}

export async function submitPromptOnly(serviceName, prompt) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    // 🔹 [UNIFIED] scriptBrowser 사용 (통합됨)
    await launchImageBrowser();  // 내부적으로 switchScriptService 호출
    await sendPromptToPage(scriptPage, config, prompt, serviceName);
    console.log("[Puppeteer] 🎨 Prompt submitted without waiting for response.");
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
    // 🔹 [UNIFIED] scriptPage 사용 (통합됨)
    if (!scriptPage) return false;

    // [FIX] Always reload page to ensure completely fresh state
    try {
        console.log('[Puppeteer] 🔄 Reloading Gemini page for fresh chat session...');
        await scriptPage.goto('https://gemini.google.com/app', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        await delay(1500);
        console.log('[Puppeteer] ✅ Fresh Gemini page loaded');
        return true;
    } catch (err) {
        console.warn(`[Puppeteer] ⚠️ Failed to reload Gemini page: ${err.message}`);
    }

    // Fallback: Try clicking new chat button
    try {
        for (const selector of GEMINI_NEW_CHAT_SELECTORS) {
            const buttonHandle = await scriptPage.$(selector);
            if (buttonHandle) {
                await buttonHandle.click();
                await delay(800);
                console.log('[Puppeteer] ✅ New chat button clicked');
                return true;
            }
        }

        const clickedByText = await scriptPage.evaluate(() => {
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
            console.log('[Puppeteer] ✅ New chat triggered by text search');
            return true;
        }
    } catch (err) {
        console.warn(`[Puppeteer] ⚠️ Failed to trigger new chat button: ${err.message}`);
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
    if (!scriptPage) throw new Error("Script page not initialized");

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

    // [FIX] Always recreate CDP session to ensure fresh download behavior
    if (scriptCdpClient) {
        try {
            await scriptCdpClient.detach();
            console.log('[Puppeteer] 🔄 Detached previous CDP session');
        } catch (err) {
            console.warn(`[Puppeteer] ⚠️ Failed to detach CDP: ${err.message}`);
        }
    }

    console.log('[Puppeteer] 🔄 Creating fresh CDP session for download behavior');
    scriptCdpClient = await scriptPage.createCDPSession();
    await scriptCdpClient.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir
    });

    const initialResponseMeta = await scriptPage.evaluate(() => {
        return Array.from(document.querySelectorAll('model-response')).map(el => el.getAttribute('data-response-id') || '');
    });
    const initialResponseCount = initialResponseMeta.length;
    console.log(`[Puppeteer] 📊 ${captureLabel} Initial response count: ${initialResponseCount}`);

    const markerInstruction = requestToken
        ? `\n\n(자동화 검증 토큰: ${requestToken}. Gemini 응답 텍스트에 동일한 토큰을 포함해주세요.)`
        : '';

    console.log(`[Puppeteer] 🎨 Sending prompt to Gemini ${captureLabel}...`);
    await sendPromptToPage(scriptPage, config, `${prompt}${markerInstruction}`, serviceName);
    console.log("[Puppeteer] 🎨 Waiting for NEW response to appear...");

    const downloadMeta = await scriptPage.evaluate(({ expectedCount, knownIds, token }) => {
        return new Promise((resolve) => {
            const knownSet = new Set((knownIds || []).filter(Boolean));

            let checkCount = 0;
            const checkInterval = setInterval(() => {
                checkCount++;
                const responses = Array.from(document.querySelectorAll('model-response'));

                // [DEBUG] 30초마다 상태 출력 (60회 체크 = 30초)
                if (checkCount % 60 === 0) {
                    console.log(`[Puppeteer Image] 🔍 Still waiting... Current responses: ${responses.length}, Expected: ${expectedCount}`);
                }

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
                    console.log(`[Puppeteer Image] 🎯 New response detected! ID: ${responseId}, Token match: ${tokenMatched}`);
                    break;
                }

                if (!targetResponse) {
                    return;
                }

                const queryTargets = [
                    ...targetResponse.el.querySelectorAll('img'),
                    ...targetResponse.el.querySelectorAll('canvas')
                ];

                console.log(`[Puppeteer Image] 🔍 Searching for images/canvas... Found ${queryTargets.length} elements`);

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
                    console.log(`[Puppeteer Image] ✅ Valid image found! Scrolling and hovering...`);
                    lastValidImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    lastValidImage.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));

                    setTimeout(() => {
                        const buttons = Array.from(document.querySelectorAll('button, span[role="button"], md-icon-button, a'));
                        const downloadBtn = buttons.find(btn => {
                            const label = (btn.getAttribute('aria-label') || btn.getAttribute('data-tooltip') || btn.getAttribute('title') || btn.innerText || '').trim();
                            return label.includes('원본') || label.includes('다운로드') || label.toLowerCase().includes('download');
                        });

                        if (downloadBtn) {
                            console.log(`[Puppeteer Image] 🖱️ Download button found! Clicking...`);
                            downloadBtn.click();
                            clearInterval(checkInterval);
                            resolve({
                                clicked: true,
                                responseId: targetResponse.responseId,
                                tokenMatched: targetResponse.tokenMatched
                            });
                        } else {
                            console.log(`[Puppeteer Image] ⚠️ Download button NOT found!`);
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

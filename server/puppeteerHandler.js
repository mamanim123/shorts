import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_BASE = path.join(__dirname, '..', 'puppeteer_user_data');
if (!fs.existsSync(USER_DATA_BASE)) fs.mkdirSync(USER_DATA_BASE, { recursive: true });

const CHROME_LOCK_FILES = [
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'SingletonPort',
    'lockfile'
];

const SCRIPT_USERDATA_PRIMARY = path.join(USER_DATA_BASE, 'script_gen');
const SCRIPT_USERDATA_FALLBACK = path.join(USER_DATA_BASE, 'script_gen_fallback');

let scriptUserDataDirOverride = null;

const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

const tryRemoveChromeLocks = (dirPath) => {
    ensureDir(dirPath);
    let locked = false;
    CHROME_LOCK_FILES.forEach((filename) => {
        const filePath = path.join(dirPath, filename);
        if (!fs.existsSync(filePath)) return;
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            locked = true;
        }
    });
    if (!locked) {
        locked = CHROME_LOCK_FILES.some((filename) => fs.existsSync(path.join(dirPath, filename)));
    }
    return !locked;
};

const resolveScriptUserDataDir = () => {
    if (scriptUserDataDirOverride) return scriptUserDataDirOverride;

    const primaryUnlocked = tryRemoveChromeLocks(SCRIPT_USERDATA_PRIMARY);
    if (primaryUnlocked) {
        scriptUserDataDirOverride = SCRIPT_USERDATA_PRIMARY;
        return scriptUserDataDirOverride;
    }

    console.warn("[Puppeteer Script] ⚠️ script_gen profile appears locked. Falling back to script_gen_fallback.");
    const fallbackUnlocked = tryRemoveChromeLocks(SCRIPT_USERDATA_FALLBACK);
    if (fallbackUnlocked) {
        scriptUserDataDirOverride = SCRIPT_USERDATA_FALLBACK;
        return scriptUserDataDirOverride;
    }

    const uniqueDir = path.join(USER_DATA_BASE, `script_gen_${Date.now()}`);
    ensureDir(uniqueDir);
    console.warn(`[Puppeteer Script] ⚠️ Both primary and fallback are locked. Using ${uniqueDir}`);
    scriptUserDataDirOverride = uniqueDir;
    return scriptUserDataDirOverride;
};

// 🔹 통합 브라우저 (대본 생성 + 이미지 생성 모두 사용)
let scriptBrowser;
let scriptPage;
let scriptBrowserLaunchPromise = null;

// 🔹 이미지 생성 동시성 제어용 락
let imageCaptureLock = Promise.resolve();

/**
 * 이미지 캡처 프로세스의 순차적 실행을 보장하기 위한 락 획득
 */
async function acquireLock() {
    let release;
    const waitPromise = new Promise(resolve => {
        release = resolve;
    });
    const previousLock = imageCaptureLock;
    imageCaptureLock = previousLock.then(() => waitPromise).catch(() => waitPromise);
    await previousLock;
    return release;
}

// 🔹 [DEPRECATED] 이미지 브라우저는 더 이상 사용하지 않음 - scriptBrowser로 통합됨
// 하위 호환성을 위해 별칭만 유지
let imageBrowser = null;
let imagePage = null;

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
        url: 'https://genspark.ai/ai_image',
        selectors: {
            input: 'textarea[placeholder*="Describe"], textarea[placeholder*="scene"], textarea[placeholder*="imagine"], textarea[placeholder*="이미지"], textarea.search-input, .j-search-input, textarea[placeholder], div[contenteditable="true"], div[role="textbox"]',
            // Found via agent: element 27 (textarea) -> element 28 (div button)
            sendBtn: '.j-search-input + div, textarea.search-input + div, div[class*="send-button"], button[aria-label="Send"]',
            response: '.markdown-body, .message-content, div[class*="answer"], div[class*="model-response"], .prose, div[class*="response"], div[class*="content"], div[class*="result"], div[class*="output"]',
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
let videoBrowserLaunchPromise = null;
let videoGenerationInProgress = false;


// 🔹 대본 생성용 브라우저 실행
export async function launchScriptBrowser() {
    if (scriptBrowserLaunchPromise) {
        return scriptBrowserLaunchPromise;
    }

    scriptBrowserLaunchPromise = (async () => {
        try {
            if (scriptBrowser && scriptBrowser.isConnected()) {
                if (scriptPage && !scriptPage.isClosed()) {
                    return;
                }
            }

            if (scriptBrowser) {
                try { await scriptBrowser.close(); } catch (e) { }
            }

            const userDataDir = resolveScriptUserDataDir();
            console.log(`[Puppeteer Script] Using userDataDir: ${userDataDir}`);

            const headless = false;
            console.log(`[Puppeteer Script] Headless mode: ${headless}`);

            const launchArgs = {
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
                userDataDir
            };

            try {
                scriptBrowser = await puppeteer.launch(launchArgs);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error || '');
                if (message.includes('already running')) {
                    console.warn("[Puppeteer Script] ⚠️ userDataDir already in use. Retrying with fallback profile...");
                    scriptUserDataDirOverride = null;
                    const fallbackDir = resolveScriptUserDataDir();
                    if (fallbackDir !== userDataDir) {
                        scriptBrowser = await puppeteer.launch({ ...launchArgs, userDataDir: fallbackDir });
                    } else {
                        throw error;
                    }
                } else {
                    throw error;
                }
            }

            const pages = await scriptBrowser.pages();
            scriptPage = pages.length > 0 ? pages[0] : await scriptBrowser.newPage();

            await scriptPage.setBypassCSP(true);
            const context = scriptPage.browserContext();
            await context.overridePermissions('https://gemini.google.com', ['clipboard-read', 'clipboard-write']);

            scriptBrowser.on('disconnected', () => {
                console.log("[Puppeteer Script] 📝 Browser disconnected.");
                scriptBrowser = null;
                scriptPage = null;
                scriptBrowserLaunchPromise = null;
            });

            console.log("[Puppeteer Script] 📝 Browser launched successfully.");
        } catch (error) {
            console.error("[Puppeteer Script] Failed to launch browser:", error);
            scriptBrowserLaunchPromise = null;
            throw error;
        } finally {
            scriptBrowserLaunchPromise = null;
        }
    })();

    return scriptBrowserLaunchPromise;
}


export function getScriptPage() {
    return scriptPage;
}

// 🔹 [UNIFIED] 이미지 생성도 scriptBrowser 사용 (통합됨)
// 기존 launchImageBrowser 호출을 위한 하위 호환성 유지
export async function launchImageBrowser() {
    console.log("[Puppeteer] 🔄 launchImageBrowser → switchScriptService('GEMINI') (통합됨)");
    await switchScriptService('GEMINI');
    // 별칭 설정 (하위 호환성)
    imageBrowser = scriptBrowser;
    imagePage = scriptPage;
}

// 🔹 비디오 생성용 브라우저 실행
export async function launchVideoBrowser() {
    if (videoBrowserLaunchPromise) {
        return videoBrowserLaunchPromise;
    }

    videoBrowserLaunchPromise = (async () => {
        try {
            if (videoBrowser && videoBrowser.isConnected()) {
                if (videoPage && !videoPage.isClosed()) {
                    return;
                }
            }

            if (videoBrowser) {
                try { await videoBrowser.close(); } catch (e) { }
            }

            const userDataDir = path.join(USER_DATA_BASE, 'video_gen');
            
            // 🔹 [NEW] 강제 점유 해제
            const lockFile = path.join(userDataDir, 'lockfile');
            if (fs.existsSync(lockFile)) {
                try {
                    console.log("[Puppeteer Video] 🔒 Stale lockfile detected, removing...");
                    fs.unlinkSync(lockFile);
                } catch (e) {
                    console.warn("[Puppeteer Video] ⚠️ Failed to remove lockfile:", e.message);
                }
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
                userDataDir
            });

            const pages = await videoBrowser.pages();
            videoPage = pages.length > 0 ? pages[0] : await videoBrowser.newPage();

            await videoPage.setBypassCSP(true);

            videoBrowser.on('disconnected', () => {
                console.log("[Puppeteer Video] 🎞️ Browser disconnected.");
                videoBrowser = null;
                videoPage = null;
                videoBrowserLaunchPromise = null;
            });

            console.log("[Puppeteer Video] 🎞️ Browser launched successfully.");
        } catch (error) {
            console.error("[Puppeteer Video] Failed to launch browser:", error);
            videoBrowserLaunchPromise = null;
            throw error;
        } finally {
            videoBrowserLaunchPromise = null;
        }
    })();

    return videoBrowserLaunchPromise;
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
        console.log(`[Puppeteer Video] 📍 Received imageUrl: ${imageUrl}`);
        try {
            // URL 형태인 경우 경로만 추출
            let normalizedUrl = imageUrl;
            if (imageUrl.startsWith('http://localhost:3002')) {
                normalizedUrl = imageUrl.replace('http://localhost:3002', '');
                console.log(`[Puppeteer Video] 📍 Normalized URL: ${normalizedUrl}`);
            }
            const fullPath = path.resolve(process.cwd(), normalizedUrl.startsWith("/") ? normalizedUrl.substring(1) : normalizedUrl);
            console.log(`[Puppeteer Video] 📍 Full path: ${fullPath}`);
            console.log(`[Puppeteer Video] 📍 File exists: ${fs.existsSync(fullPath)}`);

            if (!fs.existsSync(fullPath)) {
                throw new Error(`이미지 파일을 찾을 수 없습니다: ${fullPath}`);
            }

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

            console.log("[Puppeteer Video] 🎞️ Waiting for 'Crop and Save' button (max 60s)...");
            let cropBtnClicked = false;
            for (let i = 0; i < 60; i++) {
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

            if (!cropBtnClicked) {
                throw new Error("'자르기 및 저장' 버튼을 찾을 수 없습니다. 이미지 업로드가 완료되지 않았습니다.");
            }

            await delay(3000);
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
    const browsers = [
        { name: 'Script', instance: scriptBrowser, setter: (val) => { scriptBrowser = val; scriptPage = null; } },
        { name: 'Video', instance: videoBrowser, setter: (val) => { videoBrowser = val; videoPage = null; } }
    ];

    for (const b of browsers) {
        if (b.instance) {
            console.log(`[Puppeteer ${b.name}] Closing browser...`);
            try {
                // 1. 정상 종료 시도 (5초 타임아웃)
                await Promise.race([
                    b.instance.close(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]);
                console.log(`[Puppeteer ${b.name}] Closed gracefully.`);
            } catch (err) {
                console.warn(`[Puppeteer ${b.name}] ⚠️ Graceful close failed or timed out. Forcing kill...`);
                try {
                    // 2. 강제 종료 (SIGKILL)
                    const proc = b.instance.process();
                    if (proc) proc.kill('SIGKILL');
                } catch (killErr) {
                    console.error(`[Puppeteer ${b.name}] ❌ Failed to force kill:`, killErr.message);
                }
            } finally {
                b.setter(null);
            }
        }
    }
    scriptBrowserLaunchPromise = null;
    videoBrowserLaunchPromise = null;
    imageBrowser = null;
    scriptUserDataDirOverride = null;

    console.log("[Puppeteer] 🏠 All browsers cleanup attempt finished.");
    return true;
}

// 프로세스 종료 시 마지막 안전장치
process.on('exit', () => {
    if (scriptBrowser || videoBrowser) {
        console.log("[Puppeteer] 🚨 Process exiting with active browsers. Attempting emergency kill...");
        try { if (scriptBrowser) scriptBrowser.process()?.kill('SIGKILL'); } catch (e) { }
        try { if (videoBrowser) videoBrowser.process()?.kill('SIGKILL'); } catch (e) { }
    }
});

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
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[Puppeteer] Attempting to upload file (attempt ${attempt}/${MAX_RETRIES}): ${filePath}`);

            // 0. 기존 file input이 있는지 확인하고 직접 업로드 시도
            const existingFileInput = await activePage.$('input[type="file"]');
            if (existingFileInput) {
                console.log("[Puppeteer] Found existing file input, uploading directly...");
                await existingFileInput.uploadFile(filePath);
                await new Promise(r => setTimeout(r, 3000)); // 대기 시간 증가

                // 썸네일 확인
                const thumbnailDetected = await activePage.evaluate(() => {
                    return document.querySelectorAll('mat-chip, .thumbnail, img[src*="blob"], [aria-label*="삭제"], [aria-label*="Remove"]').length > 0;
                });

                if (thumbnailDetected) {
                    console.log(`[Puppeteer] File uploaded successfully (thumbnail detected via direct input).`);
                    return;
                } else {
                    console.log("[Puppeteer] Direct upload didn't show thumbnail, trying UI interaction...");
                }
            }

            // 1. "+" 버튼 클릭하여 메뉴 열기 (UI 상호작용 우선)
            let plusBtnClicked = false;
            try {
                console.log("[Puppeteer] Looking for '+' button...");
                const plusBtn = await activePage.waitForSelector('button.upload-card-button, button[aria-label*="Upload"], button[aria-label*="업로드"], button[aria-label*="Add"]', { timeout: 5000 });
                if (plusBtn) {
                    console.log("[Puppeteer] Clicking '+' button...");
                    await plusBtn.click();
                    plusBtnClicked = true;
                    await new Promise(r => setTimeout(r, 2000)); // 메뉴 애니메이션 대기 시간 증가
                }
            } catch (e) {
                console.log("[Puppeteer] '+' button not found or not clickable, trying direct approach...");
            }

            // 2. 파일 선택기 트리거 - 순차적 접근 (Promise.all 대신)
            console.log("[Puppeteer] Waiting for file chooser...");

            // FileChooser 대기 시작 (30초로 증가)
            const chooserPromise = activePage.waitForFileChooser({ timeout: 30000 }).catch(() => null);
            const inputPromise = activePage.waitForSelector('input[type="file"]', { timeout: 5000 }).catch(() => null);

            // 약간의 딜레이 후 메뉴 아이템 클릭
            await new Promise(r => setTimeout(r, 500));

            const clickResult = await activePage.evaluate(() => {
                // 메뉴 아이템 찾기 (텍스트 기반) - 더 많은 선택자 추가
                const menuItems = Array.from(document.querySelectorAll('button, li, div[role="menuitem"], span.mat-mdc-list-item-unscoped-content, div.menu-text, mat-list-item, [role="option"]'));
                const uploadImgItem = menuItems.find(el =>
                    el.textContent.includes('Upload image') ||
                    el.textContent.includes('이미지 업로드') ||
                    el.textContent.includes('Upload files') ||
                    el.textContent.includes('파일 업로드') ||
                    el.textContent.includes('Upload from computer') ||
                    el.textContent.includes('컴퓨터에서 업로드')
                );

                if (uploadImgItem) {
                    // 클릭 가능한 상위 요소 찾기
                    const clickable = uploadImgItem.closest('button') || uploadImgItem.closest('mat-list-item') || uploadImgItem;
                    clickable.click();
                    return "menu-item-clicked";
                }

                // 히든 버튼 폴백
                const hiddenBtn = document.querySelector('button[data-test-id="hidden-local-image-upload-button"]');
                if (hiddenBtn) {
                    hiddenBtn.click();
                    return "hidden-btn-clicked";
                }

                // 일반 파일 입력 폴백 (새로 생성된 것일 수 있음)
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                    fileInput.click();
                    return "file-input-clicked";
                }

                return "no-trigger-found";
            });

            console.log(`[Puppeteer] Click result: ${clickResult}`);

            // FileChooser 대기 (input 등장과 레이스)
            const chooserResult = await Promise.race([
                chooserPromise.then((chooser) => ({ type: 'chooser', chooser })),
                inputPromise.then((input) => ({ type: 'input', input }))
            ]);

            if (chooserResult?.type === 'input' && chooserResult.input) {
                console.log("[Puppeteer] File input detected before chooser, uploading directly...");
                await chooserResult.input.uploadFile(filePath);
            } else if (chooserResult?.type === 'chooser' && chooserResult.chooser) {
                await chooserResult.chooser.accept([filePath]);
                console.log(`[Puppeteer] File selected via chooser, waiting for upload to complete...`);
            } else {
                const fallbackInput = await activePage.$('input[type="file"]');
                if (fallbackInput) {
                    console.log("[Puppeteer] File input found after chooser timeout, uploading directly...");
                    await fallbackInput.uploadFile(filePath);
                } else {
                    throw new Error('File chooser not triggered and file input not found.');
                }
            }

            // 3. 업로드 완료 대기 (썸네일 확인) - 타임아웃 증가
            try {
                await activePage.waitForFunction(() => {
                    const indicators = document.querySelectorAll('mat-chip, .thumbnail, img[src*="blob"], [aria-label*="삭제"], [aria-label*="Remove"], img[alt*="Upload"]');
                    return indicators.length > 0;
                }, { timeout: 30000 });
                console.log(`[Puppeteer] File uploaded successfully (thumbnail detected).`);
                return; // 성공 시 함수 종료
            } catch (e) {
                console.warn(`[Puppeteer] Warning: Upload thumbnail not detected. The image might not have been attached.`);
                // 스크린샷 저장 (디버깅용)
                try {
                    const screenshotPath = path.join(os.tmpdir(), `upload_fail_${Date.now()}.png`);
                    await activePage.screenshot({ path: screenshotPath });
                    console.log(`[Puppeteer] Saved screenshot to: ${screenshotPath}`);
                } catch (err) { }
            }

            return; // FileChooser 성공했으면 종료 (썸네일 미감지여도)

        } catch (err) {
            console.warn(`[Puppeteer] File upload attempt ${attempt} failed: ${err.message}`);

            if (attempt < MAX_RETRIES) {
                console.log(`[Puppeteer] Retrying in 3 seconds...`);
                await new Promise(r => setTimeout(r, 3000)); // 재시도 전 대기

                // 페이지 새로고침 없이 상태 초기화 시도
                try {
                    await activePage.keyboard.press('Escape'); // 열려있는 메뉴 닫기
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) { }
            } else {
                console.warn(`[Puppeteer] All ${MAX_RETRIES} upload attempts failed. Proceeding with text only.`);
            }
        }
    }
}

async function sendPromptToPage(activePage, config, prompt, serviceName, files = []) {
    await activePage.waitForSelector(config.selectors.input);

    const tempFiles = [];
    // Upload files if provided
    if (files && files.length > 0) {
        try {
            for (let i = 0; i < files.length; i++) {
                let fileToUpload = files[i];

                // base64 데이터인 경우 임시 파일로 저장
                if (typeof fileToUpload === 'string' && fileToUpload.startsWith('data:')) {
                    console.log(`[Puppeteer] Converting base64 image to temporary file...`);
                    const base64Data = fileToUpload.split(',')[1];
                    const extension = fileToUpload.split(';')[0].split('/')[1] || 'png';
                    const tempPath = path.join(os.tmpdir(), `gemini_upload_${Date.now()}_${i}.${extension}`);
                    fs.writeFileSync(tempPath, Buffer.from(base64Data, 'base64'));
                    fileToUpload = tempPath;
                    tempFiles.push(tempPath);
                }

                await uploadFileToPage(activePage, fileToUpload);
            }
        } catch (err) {
            console.error(`[Puppeteer] Error during file processing/upload: ${err.message}`);
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

    // GEMINI, CLAUDE, GENSPARK는 Enter로 전송
    if (serviceName === 'CLAUDE' || serviceName === 'GEMINI' || serviceName === 'GENSPARK') {
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

    await new Promise(r => setTimeout(r, 2000));

    // 임시 파일 삭제
    for (const tempPath of tempFiles) {
        try {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
                console.log(`[Puppeteer] Deleted temporary file: ${tempPath}`);
            }
        } catch (err) {
            console.warn(`[Puppeteer] Failed to delete temporary file ${tempPath}: ${err.message}`);
        }
    }
}

export async function generateContent(serviceName, prompt, files = [], options = {}) {
    const config = SERVICES[serviceName];
    if (!config) throw new Error(`Unknown service: ${serviceName}`);

    // 🔹 대본 생성은 scriptPage 사용
    await launchScriptBrowser();
    await switchScriptService(serviceName);

    // 🔹 freshChat 옵션: 새 채팅에서 시작 (의상/얼굴 추출 등)
    if (options.freshChat && serviceName === 'GEMINI') {
        console.log('[Puppeteer] 🆕 Starting fresh chat for extraction...');
        await startFreshGeminiChat();
        await new Promise(r => setTimeout(r, 1000));
    }

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

            // 1-1. Gemini fallback: prefer markdown text inside latest model-response
            if (serviceName === 'GEMINI') {
                const responses = Array.from(document.querySelectorAll('model-response'));
                for (let i = responses.length - 1; i >= 0; i--) {
                    const el = responses[i];
                    const hasImage = el.querySelector('generated-image, .generated-image, img');
                    const markdownNodes = el.querySelectorAll('.markdown, .markdown-main-panel, .model-response-text, message-content');
                    let text = '';
                    for (const node of markdownNodes) {
                        const t = (node.innerText || '').trim();
                        if (t.length > text.length) text = t;
                    }
                    if (text.length > 0) return text;
                    // 이미지 응답인데 텍스트가 없으면 이전 응답으로 계속 탐색
                    if (hasImage) continue;
                }
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
        // 100자로 낮춤 (의상/얼굴 추출 JSON은 200~300자 정도로 짧음)
        if (currentText) {
            // 1. Try to PARSE (Fast Path) - allow short JSON like {"prompt":"..."}
            try {
                let cleanText = currentText.trim();
                if (cleanText.startsWith('```')) {
                    cleanText = cleanText.replace(/^```(json)?/, '').replace(/```$/, '');
                }
                const parsed = JSON.parse(cleanText);

                // [DEBUG] Log actual JSON structure (disabled by default)

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
                const isDetailedAnalysis = dataToCheck.style && dataToCheck.lighting && dataToCheck.camera && dataToCheck.score !== undefined;
                const isElementAnalysis = dataToCheck.style && dataToCheck.lighting && dataToCheck.camera && dataToCheck.problems;
                const isCharacterAnalysis = Array.isArray(parsed) ||
                    (parsed.characters && Array.isArray(parsed.characters)) ||
                    (Object.keys(parsed).length > 0 && Object.keys(parsed).every(k => !isNaN(parseInt(k))));

                // [NEW] 의상/얼굴 추출 포맷 지원 ({ en: "...", ko: "..." })
                const isExtraction = dataToCheck.en && dataToCheck.ko;
                const isPromptOnly = typeof dataToCheck.prompt === 'string';

                if (isScript || isTemplate || isAnalysis || isDetailedAnalysis || isElementAnalysis || isCharacterAnalysis || isExtraction || isPromptOnly) {
                    console.log(`✅ JSON Parse Successful! ${isScript ? 'Script' : isTemplate ? 'Template' : isAnalysis ? 'Analysis' : isDetailedAnalysis ? 'DetailedAnalysis' : isElementAnalysis ? 'ElementAnalysis' : isExtraction ? 'Extraction' : isPromptOnly ? 'Prompt' : 'Character'} detected. Generation Complete.`);
                    return currentText;
                } else {
                    // 기다림 로그는 소음이 많아 주기적으로만 남김
                    if (attempts % 5 === 0) {
                        console.log(`⏳ JSON parsed but incomplete (Script: ${!!isScript}, Template: ${!!isTemplate}, Analysis: ${!!isAnalysis}, Detailed: ${!!isDetailedAnalysis}, Element: ${!!isElementAnalysis}, Char: ${!!isCharacterAnalysis}, Ext: ${!!isExtraction}, Prompt: ${!!isPromptOnly}). Waiting...`);
                    }
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
    
    // [V3.5.4] GENSPARK 이미지 생성 지원 추가 (실험적)
    if (serviceName !== 'GEMINI' && serviceName !== 'GENSPARK') {
        throw new Error("Image capture is currently supported for GEMINI and GENSPARK services.");
    }

    const { requestToken, storyId, sceneNumber, attempt = 1 } = options;
    const captureLabel = `[${storyId || 'unknown'}:${sceneNumber ?? '?'}|attempt-${attempt}]`;

    const releaseLock = await acquireLock();
    let cdpClient = null;

    try {
        if (serviceName === 'GEMINI') {
        await launchImageBrowser();
    } else {
        await switchScriptService(serviceName);
    }
    
    if (!scriptPage) throw new Error("Script page not initialized");

    if (serviceName === 'GEMINI') {
        try {
            await startFreshGeminiChat();
        } catch (err) {
            console.warn(`[Puppeteer] Failed to reset Gemini chat session: ${err?.message || err}`);
        }
    }

    const downloadDir = path.dirname(path.resolve(screenshotPath));
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`[Puppeteer Image] 🎨 Download directory set to: ${downloadDir}`);

    const cleanupOldFiles = () => {
        try {
            const existingFiles = fs.readdirSync(downloadDir);
            // Gemini 및 Genspark 관련 파일 패턴 정리
            const filesToClean = existingFiles.filter(f => 
                f.startsWith('Gemini_Generated_Image_') || 
                f.toLowerCase().includes('genspark') ||
                f.startsWith('image_')
            );
            if (filesToClean.length === 0) return;
            
            console.log(`[Puppeteer] 🧹 Cleaning ${filesToClean.length} old files before capture`);
            for (const file of filesToClean) {
                try { fs.unlinkSync(path.join(downloadDir, file)); } catch (e) { }
            }
        } catch (err) { }
    };
    cleanupOldFiles();

    const downloadStartTime = Date.now();
    console.log(`[Puppeteer] ${captureLabel} Download start at ${new Date(downloadStartTime).toISOString()}`);

    // CDP 세션 설정 (다운로드 허용)
    cdpClient = await scriptPage.createCDPSession();
    await cdpClient.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadDir
    });

    const initialResponseMeta = await scriptPage.evaluate(() => {
        return Array.from(document.querySelectorAll('model-response, .message-content, .answer, .genspark-response')).map(el => el.getAttribute('data-response-id') || el.innerText.substring(0, 20));
    });
    const initialResponseCount = initialResponseMeta.length;

    console.log(`[Puppeteer] 🎨 Sending prompt to ${serviceName} ${captureLabel}...`);
    const imagePrompt = serviceName === 'GENSPARK' 
        ? `Generate the following image immediately. Do not ask for confirmation or provide any warning about credits. Just start the generation process now:\n\n${prompt}` 
        : `Generate this image:\n\n${prompt}${requestToken ? `\n\n(Token: ${requestToken})` : ''}`;
        
    await sendPromptToPage(scriptPage, config, imagePrompt, serviceName);
    console.log(`[Puppeteer] 🎨 Waiting for ${serviceName} response...`);

    // [Genspark 특화 대기 및 상호작용 로직]
    if (serviceName === 'GENSPARK') {
        console.log("[Puppeteer Genspark] 🔍 Monitoring for confirmation prompts or buttons...");
        // 20초 동안 매우 공격적으로 감시
        for (let i = 0; i < 20; i++) {
            const result = await scriptPage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, div[class*="button"]'));
                
                // 1. "Generate", "Start", "Confirm", "Yes" 버튼이 있는지 확인 (더 넓은 범위)
                const targetBtn = buttons.find(b => {
                    const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
                    return t === 'yes' || t === 'confirm' || t === 'proceed' || t === 'generate' || 
                           t.includes('start generation') || t.includes('생성 시작') || 
                           t.includes('create image');
                });

                if (targetBtn) {
                    targetBtn.click();
                    return 'button-clicked';
                }

                // 2. 텍스트로 물어보는 경우 (질문 끝에 '?' 가 있거나 proceed/proceeding 키워드)
                const messages = document.querySelectorAll('.markdown-body, .message-content, div[class*="answer"]');
                const lastMsg = messages[messages.length - 1];
                if (lastMsg) {
                    const text = lastMsg.innerText.toLowerCase();
                    if (text.includes('proceed') || text.includes('confirm') || text.includes('should i') || text.includes('ready to') || text.includes('may i')) {
                        return 'needs-force-yes';
                    }
                }
                return 'waiting';
            });

            if (result === 'button-clicked') {
                console.log("[Puppeteer Genspark] 🖱️ Forced button click successful!");
                // 클릭 후 실제 생성까지 시간이 걸릴 수 있으므로 2초 더 감시 후 탈출
                await new Promise(r => setTimeout(r, 2000));
            } else if (result === 'needs-force-yes') {
                console.log("[Puppeteer Genspark] 🤖 AI is talking. Forcing 'Yes'...");
                await scriptPage.keyboard.type('YES', { delay: 10 });
                await scriptPage.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 2000));
            }
            
            // 이미지 태그가 생겼는지 수시로 체크해서 생겼으면 조기 탈출
            const hasImage = await scriptPage.evaluate(() => {
                const imgs = document.querySelectorAll('img[src*="genspark"], img[src*="blob"], img[src*="googleusercontent"]');
                return Array.from(imgs).some(img => {
                    const r = img.getBoundingClientRect();
                    return r.width > 200 && r.height > 200;
                });
            });
            if (hasImage) {
                console.log("[Puppeteer Genspark] 🖼️ Image detected! Proceeding to capture...");
                break;
            }

            await new Promise(r => setTimeout(r, 1000));
        }
    }

    const downloadMeta = await scriptPage.evaluate(({ expectedCount, serviceName }) => {
        return new Promise((resolve) => {
            let checkCount = 0;
            const checkInterval = setInterval(() => {
                checkCount++;
                const responses = serviceName === 'GEMINI' 
                    ? Array.from(document.querySelectorAll('model-response'))
                    : Array.from(document.querySelectorAll('.markdown-body, .message-content, div[class*="answer"], div[class*="response"]'));
                const noResponses = responses.length === 0;

                if (!noResponses && responses.length <= expectedCount && checkCount < 60) return;

                const targetEl = (noResponses && serviceName === 'GENSPARK')
                    ? document.body
                    : responses[responses.length - 1];
                if (!targetEl) return;

                const images = Array.from(targetEl.querySelectorAll('img, canvas, [role="img"]'));
                let validImage = images.find(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.width > 100 && rect.height > 100;
                });

                if (validImage) {
                    validImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (validImage instanceof HTMLElement) {
                        validImage.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                        validImage.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                    }

                    const isDownloadButton = (btn) => {
                        if (!btn) return false;
                        const txt = (btn.getAttribute('aria-label') || btn.title || btn.innerText || '').toLowerCase();
                        return (
                            txt.includes('download') ||
                            txt.includes('다운로드') ||
                            txt.includes('원본') ||
                            txt.includes('save')
                        );
                    };

                    const findInContainer = (container) => {
                        if (!container) return null;
                        const candidates = Array.from(container.querySelectorAll('button, a, [role="button"]'));
                        return candidates.find(isDownloadButton) || null;
                    };

                    let downloadBtn = findInContainer(targetEl);
                    if (!downloadBtn) {
                        let current = validImage.parentElement;
                        for (let depth = 0; depth < 6 && current; depth++) {
                            downloadBtn = findInContainer(current);
                            if (downloadBtn) break;
                            current = current.parentElement;
                        }
                    }

                    if (!downloadBtn) {
                        const imgRect = validImage.getBoundingClientRect();
                        const isNearImage = (btn) => {
                            const rect = btn.getBoundingClientRect();
                            if (rect.width === 0 || rect.height === 0) return false;
                            const margin = 120;
                            const nearHoriz = rect.left <= imgRect.right + margin && rect.right >= imgRect.left - margin;
                            const nearVert = rect.top <= imgRect.bottom + margin && rect.bottom >= imgRect.top - margin;
                            return nearHoriz && nearVert;
                        };
                        const globalButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                        downloadBtn = globalButtons.find(btn => isDownloadButton(btn) && isNearImage(btn)) || null;
                    }

                    if (!downloadBtn && serviceName === 'GENSPARK') {
                        const imgRect = validImage.getBoundingClientRect();
                        const pickClosestToBottomCenter = (buttons) => {
                            if (!buttons.length) return null;
                            const targetX = imgRect.left + imgRect.width / 2;
                            const targetY = imgRect.bottom - 24;
                            let best = null;
                            let bestDist = Number.POSITIVE_INFINITY;
                            for (const btn of buttons) {
                                const rect = btn.getBoundingClientRect();
                                const cx = rect.left + rect.width / 2;
                                const cy = rect.top + rect.height / 2;
                                const dist = Math.hypot(cx - targetX, cy - targetY);
                                if (dist < bestDist) {
                                    bestDist = dist;
                                    best = btn;
                                }
                            }
                            return best;
                        };

                        const isIconOnlyButton = (btn) => {
                            if (!btn) return false;
                            const txt = (btn.innerText || '').trim();
                            const aria = (btn.getAttribute('aria-label') || btn.title || '').trim();
                            if (txt || aria) return false;
                            return !!btn.querySelector('svg');
                        };

                        const isOverlayOnImage = (btn) => {
                            const rect = btn.getBoundingClientRect();
                            if (rect.width === 0 || rect.height === 0) return false;
                            const withinHoriz = rect.left >= imgRect.left - 8 && rect.right <= imgRect.right + 8;
                            const withinVert = rect.top >= imgRect.top - 8 && rect.bottom <= imgRect.bottom + 8;
                            return withinHoriz && withinVert;
                        };

                        const iconButtons = [];
                        const containers = [];
                        let current = validImage.parentElement;
                        for (let depth = 0; depth < 6 && current; depth++) {
                            containers.push(current);
                            current = current.parentElement;
                        }
                        containers.push(targetEl);

                        for (const container of containers) {
                            if (!container) continue;
                            const candidates = Array.from(container.querySelectorAll('button, a, [role="button"]'));
                            for (const btn of candidates) {
                                if (isIconOnlyButton(btn) && isOverlayOnImage(btn)) {
                                    iconButtons.push(btn);
                                }
                            }
                        }

                        downloadBtn = pickClosestToBottomCenter(iconButtons);
                    }

                    if (downloadBtn) {
                        downloadBtn.click();
                        clearInterval(checkInterval);
                        resolve({ clicked: true });
                    } else if (serviceName === 'GENSPARK') {
                        // Genspark에서 버튼이 없는 경우 이미지 소스 추출 시도 (서버에서 별도 처리)
                        clearInterval(checkInterval);
                        resolve({ clicked: false, fallbackSrc: validImage.src || (validImage.toDataURL ? validImage.toDataURL() : null) });
                    }
                }
            }, 1000);
            setTimeout(() => { clearInterval(checkInterval); resolve({ clicked: false, reason: 'timeout' }); }, 120000);
        });
    }, { expectedCount: initialResponseCount, serviceName });

    if (!downloadMeta?.clicked && !downloadMeta?.fallbackSrc) {
        throw new Error(`${serviceName}에서 이미지를 생성하거나 다운로드 버튼을 찾지 못했습니다.`);
    }

    // 파일 대기 (다운로드 완료 확인)
    let downloadedFile = null;
    if (downloadMeta.clicked) {
        const maxWaitTime = 45000;
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            const files = fs.readdirSync(downloadDir);
            const newFiles = files.filter(f => {
                const stat = fs.statSync(path.join(downloadDir, f));
                return stat.birthtimeMs > downloadStartTime && !f.endsWith('.crdownload') && !f.endsWith('.tmp');
            });
            if (newFiles.length > 0) {
                downloadedFile = path.join(downloadDir, newFiles[0]);
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
    } else if (downloadMeta.fallbackSrc) {
        // base64 또는 URL 직접 저장
        downloadedFile = screenshotPath;
        const data = downloadMeta.fallbackSrc.startsWith('data:') 
            ? Buffer.from(downloadMeta.fallbackSrc.split(',')[1], 'base64')
            : await (await fetch(downloadMeta.fallbackSrc)).arrayBuffer();
        fs.writeFileSync(downloadedFile, Buffer.from(data));
    }

    if (!downloadedFile || !fs.existsSync(downloadedFile)) {
        throw new Error("이미지 파일이 생성되지 않았습니다.");
    }

    // 최종 파일 이동 (요청된 screenshotPath로)
    if (downloadedFile !== screenshotPath) {
        fs.copyFileSync(downloadedFile, screenshotPath);
        try { fs.unlinkSync(downloadedFile); } catch (e) { }
    }

    const stats = fs.statSync(screenshotPath);
    return {
        success: true,
        path: screenshotPath,
        bytes: stats.size,
        hash: crypto.createHash('md5').update(fs.readFileSync(screenshotPath)).digest('hex')
    };
    } finally {
        if (cdpClient) {
            await cdpClient.detach().catch(() => {});
        }
        releaseLock();
    }
}

export async function submitPromptAndCaptureImage_LEGACY(serviceName, prompt, screenshotPath, options = {}) {
    const config = SERVICES[serviceName];

    return {
        path: screenshotPath,
        hash: fileHash,
        bytes,
        responseId: downloadMeta?.responseId || null,
        tokenMatched
    };
}

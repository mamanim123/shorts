import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const liteRootDir = path.join(__dirname, '..');
const userDataBaseDir = path.join(liteRootDir, 'server', 'user_data', 'puppeteer');

const SERVICES = {
  GEMINI: {
    url: 'https://gemini.google.com/app',
    selectors: {
      input: 'div[contenteditable="true"], div[role="textbox"]',
      sendBtn: 'button[aria-label="Send"], button[aria-label*="Send"], .send-button, button[data-testid="send-button"]',
      response: 'model-response, .model-response-text',
    },
  },
  CHATGPT: {
    url: 'https://chatgpt.com',
    selectors: {
      input: '#prompt-textarea',
      sendBtn: 'button[data-testid="send-button"]',
      response: '.markdown',
    },
  },
  CLAUDE: {
    url: 'https://claude.ai/new',
    selectors: {
      input: 'div[contenteditable="true"]',
      sendBtn: 'button[aria-label="Send Message"]',
      response: '[data-testid="assistant-message"], [data-testid="assistant-response"], [data-testid="bot-message"], pre code, pre[class*="code"], .code-block__code, .font-claude-message, [data-message-author="assistant"], .prose, .markdown, div[class*="MessageContent"]',
    },
  },
  GENSPARK: {
    url: 'https://genspark.ai/ai_image',
    selectors: {
      input: 'textarea[placeholder*="Describe"], textarea[placeholder*="scene"], textarea[placeholder*="imagine"], textarea[placeholder], div[contenteditable="true"], div[role="textbox"]',
      sendBtn: '.j-search-input + div, textarea.search-input + div, div[class*="send-button"], button[aria-label="Send"]',
      response: '.markdown-body, .message-content, div[class*="answer"], div[class*="model-response"], .prose',
    },
  },
};

let browser = null;
let page = null;
let launchPromise = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const parseHeadless = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return false;
};

const resolveExecutablePath = () => {
  const configuredPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (!configuredPath) {
    return undefined;
  }

  if (!fs.existsSync(configuredPath)) {
    throw new Error(`PUPPETEER_EXECUTABLE_PATH not found: ${configuredPath}`);
  }

  return configuredPath;
};

const detectLogin = async (activePage) => activePage.evaluate(() => {
  const modal = document.querySelector('.n-modal, .auth-modal, div[role="dialog"]');
  if (!modal) {
    return false;
  }

  const text = modal.innerText || '';
  return text.includes('Sign in') || text.includes('Log in') || text.includes('로그인');
});

const extractLatestResponseText = async (activePage, config, serviceName) => activePage.evaluate(({ responseSelector, service }) => {
  const elements = document.querySelectorAll(responseSelector);
  if (elements.length > 0) {
    return (elements[elements.length - 1].innerText || '').trim();
  }

  if (service === 'CLAUDE') {
    const selectors = [
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
      'div[class*="MessageContent"]',
    ];

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector);
      if (nodes.length > 0) {
        return (nodes[nodes.length - 1].innerText || '').trim();
      }
    }
  }

  return '';
}, { responseSelector: config.selectors.response, service: serviceName });

async function waitForResponseText(activePage, config, serviceName, { minLength, stableTarget, maxAttempts, initialDelayMs }) {
  await delay(initialDelayMs);

  let attempts = 0;
  let lastText = '';
  let stableCount = 0;

  while (attempts < maxAttempts) {
    await delay(2000);

    const loginDetected = await detectLogin(activePage);
    const currentUrl = activePage.url();
    if (loginDetected || currentUrl.includes('accounts.google.com') || currentUrl.includes('/login') || currentUrl.includes('signin')) {
      throw new Error('Login page/modal detected. Please log in manually.');
    }

    const currentText = await extractLatestResponseText(activePage, config, serviceName);

    if (currentText && currentText.length >= minLength) {
      if (currentText === lastText) {
        stableCount += 1;
      } else {
        stableCount = 0;
      }

      // ✅ 수정: looksStructured 조기 리턴 제거, stableCount 충족 후 리턴
      if (stableCount >= stableTarget) {
        return currentText;
      }
    }

    lastText = currentText;
    attempts += 1;
  }

  if (lastText && lastText.length >= minLength) {
    return lastText.trim();
  }

  if (lastText.trim()) {
    return lastText.trim();
  }

  throw new Error(`Timeout waiting for ${serviceName} response.`);
}

async function sendPromptToPage(activePage, config, prompt, serviceName) {
  await activePage.waitForSelector(config.selectors.input, { timeout: 30000 });
  await activePage.click(config.selectors.input);

  await activePage.evaluate((selector) => {
    const element = document.querySelector(selector);
    if (!element) {
      return;
    }

    if ('value' in element) {
      element.value = '';
    } else {
      element.textContent = '';
    }
  }, config.selectors.input);

  await activePage.keyboard.down('Control');
  await activePage.keyboard.press('A');
  await activePage.keyboard.up('Control');
  await activePage.keyboard.press('Backspace');
  await delay(300);

  await activePage.evaluate((selector, text) => {
    const element = document.querySelector(selector);
    if (!element) {
      return;
    }

    if ('value' in element) {
      element.value = text;
    } else {
      element.textContent = text;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, config.selectors.input, prompt);

  await delay(800);

  if (serviceName === 'GEMINI' || serviceName === 'CLAUDE') {
    await activePage.keyboard.press('Enter');
    return;
  }

  try {
    await activePage.click(config.selectors.sendBtn, { timeout: 3000 });
  } catch {
    await activePage.keyboard.press('Enter');
  }
}

export async function launchBrowser() {
  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = (async () => {
    if (browser?.isConnected() && page && !page.isClosed()) {
      return;
    }

    ensureDir(userDataBaseDir);

    const launchOptions = {
      headless: parseHeadless(process.env.PUPPETEER_HEADLESS),
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--window-size=1024,768',
        '--window-position=0,0',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
      userDataDir: userDataBaseDir,
    };

    const executablePath = resolveExecutablePath();
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    try {
      browser = await puppeteer.launch(launchOptions);
      const pages = await browser.pages();
      page = pages.length > 0 ? pages[0] : await browser.newPage();
      await page.setBypassCSP(true);

      const context = page.browserContext();
      await context.overridePermissions('https://gemini.google.com', ['clipboard-read', 'clipboard-write']);

      browser.on('disconnected', () => {
        browser = null;
        page = null;
        launchPromise = null;
      });
    } catch (error) {
      browser = null;
      page = null;
      throw error;
    } finally {
      launchPromise = null;
    }
  })();

  return launchPromise;
}

export async function closeBrowser() {
  if (!browser) {
    return;
  }

  const currentBrowser = browser;
  browser = null;
  page = null;
  launchPromise = null;
  await currentBrowser.close();
}

async function switchService(serviceName) {
  const config = SERVICES[serviceName];
  if (!config) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  await launchBrowser();
  if (!page) {
    throw new Error('Browser page not initialized.');
  }

  const shouldResetSession = serviceName === 'GEMINI' || serviceName === 'CLAUDE';
  const isSameServicePage = page.url().includes(config.url);

  if (shouldResetSession || !isSameServicePage) {
    await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(1200);
  }

  return config;
}

export async function generateContent(serviceName, prompt) {
  const config = await switchService(serviceName);
  await sendPromptToPage(page, config, prompt, serviceName);
  return waitForResponseText(page, config, serviceName, {
    minLength: 200,
    stableTarget: 5,    // ✅ 3 → 5 (완성 안정화 강화)
    maxAttempts: 180,
    initialDelayMs: 8000, // ✅ 5000 → 8000ms (LLM 응답 시작 여유)
  });
}

export async function generateSimpleText(serviceName, prompt) {
  const config = await switchService(serviceName);
  await sendPromptToPage(page, config, prompt, serviceName);
  return waitForResponseText(page, config, serviceName, {
    minLength: 50,
    stableTarget: 2,
    maxAttempts: 90,
    initialDelayMs: 3000,
  });
}

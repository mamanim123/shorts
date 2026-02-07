import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_DIR = path.join(__dirname, 'puppeteer_user_data', 'grok_video');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function analyzeGrokVideo() {
    console.log('=== Grok Video 모드 분석 (좌표 클릭) ===\n');

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        defaultViewport: { width: 1400, height: 900 },
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--window-size=1400,900',
            '--window-position=100,50',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        userDataDir: USER_DATA_DIR
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    await page.setBypassCSP(true);

    console.log('[1] grok.com/imagine 접속...');
    await page.goto('https://grok.com/imagine', { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(5000);

    // "Image" 모델 선택기 위치 확인
    const selectorInfo = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Model select"]');
        if (!btn) return null;
        const rect = btn.getBoundingClientRect();
        return {
            text: btn.innerText.trim(),
            x: rect.x + rect.width / 2,
            y: rect.y + rect.height / 2,
            width: rect.width,
            height: rect.height
        };
    });

    console.log('[2] 모델 선택기 위치:', JSON.stringify(selectorInfo));

    if (!selectorInfo) {
        console.log('모델 선택기를 찾을 수 없습니다!');
        await browser.close();
        return;
    }

    // Puppeteer 네이티브 클릭 (좌표 기반)
    console.log('[3] 모델 선택기 네이티브 클릭...');
    await page.mouse.click(selectorInfo.x, selectorInfo.y);
    await delay(2000);

    // 드롭다운 스크린샷
    await page.screenshot({ path: path.join(__dirname, 'grok_dropdown_1.png') });

    // 드롭다운 내용 확인
    const dropdown1 = await page.evaluate(() => {
        const result = [];
        // 모든 visible 요소 중 z-index가 높거나 팝오버인 것
        document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const zIndex = parseInt(style.zIndex) || 0;
            const pos = style.position;

            // 팝오버/드롭다운 메뉴 감지
            if ((zIndex > 10 || pos === 'fixed' || pos === 'absolute') && rect.width > 50 && rect.height > 20) {
                const text = el.innerText?.trim();
                if (text && text.length < 200 && text.length > 0) {
                    result.push({
                        tag: el.tagName,
                        text: text.substring(0, 150),
                        zIndex,
                        position: pos,
                        x: Math.round(rect.x), y: Math.round(rect.y),
                        w: Math.round(rect.width), h: Math.round(rect.height),
                        class: (el.className || '').substring(0, 80),
                        role: el.getAttribute('role'),
                        dataState: el.getAttribute('data-state')
                    });
                }
            }
        });
        return result;
    });

    console.log('\n--- 팝업/드롭다운 감지 (클릭 후) ---');
    dropdown1.forEach(d => {
        console.log(`  <${d.tag}> z=${d.zIndex} pos=${d.position} "${d.text}" ${d.w}x${d.h} at(${d.x},${d.y}) role="${d.role}" state="${d.dataState}"`);
    });

    // "Video" 텍스트 찾기 (드롭다운 내)
    const videoOption = await page.evaluate(() => {
        const allEls = Array.from(document.querySelectorAll('*'));
        const matches = [];
        for (const el of allEls) {
            const directText = Array.from(el.childNodes)
                .filter(n => n.nodeType === 3)
                .map(n => n.textContent.trim())
                .join('');
            const fullText = (el.innerText || '').trim();

            if (directText === 'Video' || fullText === 'Video' || directText === 'Image' || fullText === 'Image') {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0) {
                    matches.push({
                        tag: el.tagName,
                        directText,
                        fullText: fullText.substring(0, 50),
                        x: Math.round(rect.x), y: Math.round(rect.y),
                        w: Math.round(rect.width), h: Math.round(rect.height),
                        class: (el.className || '').substring(0, 100),
                        clickable: el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.onclick !== null || el.getAttribute('role') === 'option' || el.getAttribute('role') === 'menuitem',
                        parent: {
                            tag: el.parentElement?.tagName,
                            class: (el.parentElement?.className || '').substring(0, 80),
                            role: el.parentElement?.getAttribute('role')
                        }
                    });
                }
            }
        }
        return matches;
    });

    console.log('\n--- "Video"/"Image" 텍스트 요소 ---');
    videoOption.forEach(v => {
        console.log(`  <${v.tag}> direct="${v.directText}" full="${v.fullText}" at(${v.x},${v.y}) ${v.w}x${v.h} clickable=${v.clickable}`);
        console.log(`    class="${v.class}" parent=<${v.parent.tag}> parentRole="${v.parent.role}"`);
    });

    // 드롭다운이 안 열렸으면 다시 시도 (더블클릭)
    if (videoOption.filter(v => v.directText === 'Video').length === 0) {
        console.log('\n[3b] Video 옵션 미발견. 더블클릭 시도...');
        await page.mouse.click(selectorInfo.x, selectorInfo.y, { clickCount: 2 });
        await delay(2000);
        await page.screenshot({ path: path.join(__dirname, 'grok_dropdown_2.png') });

        // ESC 후 재시도
        console.log('[3c] ESC 후 재클릭...');
        await page.keyboard.press('Escape');
        await delay(1000);
        await page.mouse.click(selectorInfo.x, selectorInfo.y);
        await delay(2000);
        await page.screenshot({ path: path.join(__dirname, 'grok_dropdown_3.png') });

        // 다시 확인
        const retryOptions = await page.evaluate(() => {
            const matches = [];
            document.querySelectorAll('*').forEach(el => {
                const text = (el.innerText || '').trim();
                if (text === 'Video' || text === 'Image') {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && el.children.length === 0) {
                        matches.push({
                            tag: el.tagName, text,
                            x: Math.round(rect.x), y: Math.round(rect.y),
                            class: (el.className || '').substring(0, 100)
                        });
                    }
                }
            });
            return matches;
        });
        console.log('\n--- 재시도 후 매치 ---');
        retryOptions.forEach(o => console.log(`  <${o.tag}> "${o.text}" at(${o.x},${o.y}) class="${o.class}"`));
    }

    // Video 옵션 발견되면 클릭
    console.log('\n[4] Video 옵션 클릭 시도...');
    const clickResult = await page.evaluate(() => {
        // 방법 1: 정확히 "Video" 텍스트를 가진 leaf 요소
        const allEls = Array.from(document.querySelectorAll('span, div, button, li, a, p'));
        for (const el of allEls) {
            const directText = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
            if (directText === 'Video') {
                el.click();
                return { method: 'direct-click', tag: el.tagName };
            }
        }

        // 방법 2: innerText가 "Video"인 요소의 부모 클릭
        for (const el of allEls) {
            if ((el.innerText || '').trim() === 'Video' && el.children.length === 0) {
                const clickTarget = el.closest('button') || el.closest('[role="option"]') || el.closest('[role="menuitem"]') || el.parentElement;
                if (clickTarget) {
                    clickTarget.click();
                    return { method: 'parent-click', tag: clickTarget.tagName };
                }
            }
        }

        return { method: 'not-found' };
    });

    console.log('Video 클릭 결과:', JSON.stringify(clickResult));
    await delay(3000);

    // 최종 스크린샷
    await page.screenshot({ path: path.join(__dirname, 'grok_final_state.png') });

    // 최종 상태 분석
    console.log('\n[5] 최종 상태 분석...');
    const finalState = await page.evaluate(() => {
        const modelBtn = document.querySelector('button[aria-label="Model select"]');
        const modelText = modelBtn ? modelBtn.innerText.trim() : 'N/A';

        const textarea = document.querySelector('textarea');
        const submitBtn = document.querySelector('button[aria-label="Submit"]');
        const attachBtn = document.querySelector('button[aria-label="Attach"]');
        const fileInput = document.querySelector('input[type="file"]');

        return {
            currentModel: modelText,
            url: window.location.href,
            hasTextarea: !!textarea,
            textareaPlaceholder: textarea?.placeholder || '',
            submitDisabled: submitBtn?.disabled,
            hasAttach: !!attachBtn,
            fileInputAccept: fileInput?.accept || 'N/A',
            fileInputMultiple: fileInput?.multiple
        };
    });

    console.log('최종 상태:', JSON.stringify(finalState, null, 2));

    // 결과 저장
    fs.writeFileSync(
        path.join(__dirname, 'grok_video_analysis.json'),
        JSON.stringify({ selectorInfo, dropdown1, videoOption, clickResult, finalState }, null, 2),
        'utf-8'
    );

    console.log('\n=== 완료 ===');
    console.log('90초 후 브라우저 종료...');
    await delay(90000);
    await browser.close();
}

analyzeGrokVideo().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});

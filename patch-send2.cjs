const fs = require('fs');
const p = './server/puppeteerHandler.js';
let t = fs.readFileSync(p, 'utf8');

const oldBlock = `    if (serviceName === 'CLAUDE' || serviceName === 'GEMINI' || serviceName === 'GENSPARK') {
        console.log(\`[Puppeteer] Sending to \${serviceName} via Enter key...\`);
        await activePage.keyboard.press('Enter');
    } else {`;

const newBlock = `    if (serviceName === 'CLAUDE' || serviceName === 'GEMINI' || serviceName === 'GENSPARK') {
        console.log(\`[Puppeteer] Sending to \${serviceName}...\`);
        let sent = false;
        if (serviceName === 'GEMINI' && config.selectors.sendBtn) {
            try {
                await new Promise(r => setTimeout(r, 800));
                sent = await activePage.evaluate((sel) => {
                    const btns = Array.from(document.querySelectorAll(sel));
                    let target = btns.find(b => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
                    if (!target) {
                        const icon = document.querySelector('mat-icon[fonticon="arrow_upward"]');
                        if (icon) target = icon.closest('button');
                    }
                    if (target && !target.disabled) { target.click(); return true; }
                    return false;
                }, config.selectors.sendBtn);
                if (sent) console.log('[Puppeteer] OK Send button clicked.');
            } catch (e) { console.warn('[Puppeteer] Send btn click failed:', e.message); }
        }
        if (!sent) {
            console.log('[Puppeteer] Falling back to Enter key...');
            await activePage.keyboard.press('Enter');
        }
    } else {`;

if (t.includes(newBlock)) { console.log('SKIP: 이미 적용됨'); }
else if (t.includes(oldBlock)) { t = t.replace(oldBlock, newBlock); fs.writeFileSync(p, t, 'utf8'); console.log('OK: 전송 버튼 클릭 패치 완료'); }
else { console.error('FAIL: 4953 블록 못 찾음'); }

const fs = require('fs');
const p = './server/puppeteerHandler.js';
let t = fs.readFileSync(p, 'utf8');

// --- 1) GEMINI selectors 에 sendBtn 추가 ---
const gemOld = `    GEMINI: {
`;
// GEMINI 블록의 input 라인 뒤에 sendBtn 삽입
const inputLine = `        input: 'div[contenteditable="true"], div[role="textbox"]',`;
const inputWithSend = `        input: 'div[contenteditable="true"], div[role="textbox"]',
        sendBtn: 'button[aria-label*="보내기"], button[aria-label*="Send"], button[aria-label*="Submit"], button[mattooltip*="Send"], button:has(mat-icon[fonticon="arrow_upward"]), button[aria-label*="제출"]',`;

if (t.includes(inputWithSend)) {
  console.log('SKIP: GEMINI sendBtn 이미 존재');
} else if (t.includes(inputLine)) {
  t = t.replace(inputLine, inputWithSend);
  console.log('OK: GEMINI sendBtn 셀렉터 추가');
} else {
  console.error('FAIL: GEMINI input 라인을 못 찾음 (151라인 확인 필요)');
}

// --- 2) 전송부: Enter 누르기 전에 sendBtn 직접 클릭 시도 ---
const sendOld = `    console.log(\`[Puppeteer] Sending to \${serviceName} via Enter key...\`);
    await activePage.keyboard.press('Enter');`;

const sendNew = `    console.log(\`[Puppeteer] Sending to \${serviceName}...\`);
    // 1순위: 전송 버튼(arrow_upward) 직접 클릭
    let sent = false;
    try {
        if (config.selectors.sendBtn) {
            await new Promise(r => setTimeout(r, 800)); // 업로드/입력 안정화 대기
            const clicked = await activePage.evaluate((sel) => {
                const btns = Array.from(document.querySelectorAll(sel));
                const target = btns.find(b => !b.disabled && b.getAttribute('aria-disabled') !== 'true');
                if (target) { target.click(); return true; }
                // arrow_upward 아이콘 기반 폴백
                const icon = document.querySelector('mat-icon[fonticon="arrow_upward"]');
                if (icon) {
                    const btn = icon.closest('button');
                    if (btn && !btn.disabled) { btn.click(); return true; }
                }
                return false;
            }, config.selectors.sendBtn);
            if (clicked) { sent = true; console.log('[Puppeteer] ✅ Send button clicked.'); }
        }
    } catch (e) {
        console.warn('[Puppeteer] Send button click failed:', e.message);
    }
    // 2순위: Enter 키 폴백
    if (!sent) {
        console.log('[Puppeteer] Send button not used, falling back to Enter key...');
        await activePage.keyboard.press('Enter');
    }`;

if (t.includes(sendNew)) {
  console.log('SKIP: 전송 fallback 이미 적용됨');
} else if (t.includes(sendOld)) {
  t = t.replace(sendOld, sendNew);
  console.log('OK: 전송 버튼 클릭 fallback 추가');
} else {
  console.error('FAIL: 전송부(Sending via Enter key)를 못 찾음 (1907라인 확인 필요)');
}

fs.writeFileSync(p, t, 'utf8');
console.log('패치1 완료');

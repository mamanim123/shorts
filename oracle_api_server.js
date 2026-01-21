
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const app = express();
const port = 3003;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_PATH = "F:\\test\\쇼츠대본생성기-v3.5.3\\user_data_script";

app.use(cors());
app.use(bodyParser.json());

let browser = null;
let page = null;

// 브라우저 초기화 및 유지
async function initBrowser() {
    if (browser && browser.isConnected()) return;
    
    console.log("🚀 오라클 브라우저 세션 시작 중...");
    browser = await puppeteer.launch({
        headless: false, // 마마님이 세션 돌아가는 걸 보실 수 있게 false로 둡니다
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        userDataDir: USER_DATA_PATH,
        args: ['--window-size=1280,800', '--no-sandbox']
    });
    
    const pages = await browser.pages();
    page = pages.length > 0 ? pages[0] : await browser.newPage();
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
}

// OpenAI 호환 /v1/chat/completions 엔드포인트
app.post('/v1/chat/completions', async (req, res) => {
    const { messages } = req.body;
    const lastMessage = messages[messages.length - 1].content;

    try {
        await initBrowser();
        
        console.log("📝 OpenCode로부터 요청 수신: " + lastMessage.substring(0, 30) + "...");
        
        // 입력창 대기 및 입력
        await page.waitForSelector('#prompt-textarea');
        await page.click('#prompt-textarea');
        
        // 기존 텍스트 삭제 후 입력
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.type('#prompt-textarea', lastMessage);
        await page.keyboard.press('Enter');

        // 답변 대기 및 추출
        let lastText = "";
        let stableCount = 0;
        
        for (let i = 0; i < 60; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const currentText = await page.evaluate(() => {
                const articles = document.querySelectorAll('article');
                if (articles.length === 0) return "";
                const lastAssistantMessage = Array.from(articles).reverse().find(a => a.querySelector('.markdown'));
                return lastAssistantMessage ? lastAssistantMessage.querySelector('.markdown').innerText : "";
            });

            if (currentText && currentText === lastText && currentText.length > 0) {
                stableCount++;
                if (stableCount >= 3) break;
            } else {
                stableCount = 0;
                lastText = currentText;
            }
        }

        // OpenAI 형식의 응답 생성
        const response = {
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: req.body.model || 'gpt-4o',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: lastText
                },
                finish_reason: 'stop'
            }]
        };

        console.log("✅ 답변 생성 완료 및 OpenCode로 전송");
        res.json(response);

    } catch (err) {
        console.error("❌ 처리 중 오류:", err);
        res.status(500).json({ error: "브라우저 제어 중 오류 발생" });
    }
});

app.listen(port, async () => {
    console.log(`\n✨ 오라클 중계 서버가 http://localhost:${port} 에서 실행 중입니다.`);
    console.log(`💡 이제 OpenCode 설정에서 OpenAI Base URL을 http://localhost:${port}/v1 로 설정하세요.`);
    await initBrowser();
});

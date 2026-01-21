
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

puppeteer.use(StealthPlugin());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_DATA_PATH = "F:\\test\\쇼츠대본생성기-v3.5.3\\user_data_script";

async function askChatGPT(prompt) {
    console.log("🚀 ChatGPT 세션 연결 중...");
    const browser = await puppeteer.launch({
        headless: false, // 마마님이 확인하실 수 있게 창을 띄웁니다
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        userDataDir: USER_DATA_PATH,
        args: ['--window-size=1280,800', '--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });

        // 로그인 여부 확인 (간단하게 프로필 영역이나 입력창 확인)
        const isLoggedIn = await page.evaluate(() => {
            return !!document.querySelector('#prompt-textarea');
        });

        if (!isLoggedIn) {
            console.log("❌ 로그인이 되어 있지 않습니다. setup_login.js를 먼저 실행해 주세요.");
            await browser.close();
            return;
        }

        console.log("📝 질문 입력 중: " + prompt.substring(0, 30) + "...");
        await page.type('#prompt-textarea', prompt);
        await page.keyboard.press('Enter');

        console.log("⏳ 답변 대기 중...");
        // 답변이 생성될 때까지 대기 (마지막 markdown 영역의 텍스트가 멈출 때까지)
        let lastText = "";
        let stableCount = 0;
        
        for (let i = 0; i < 60; i++) { // 최대 2분
            await new Promise(r => setTimeout(r, 2000));
            const currentText = await page.evaluate(() => {
                const articles = document.querySelectorAll('article');
                if (articles.length === 0) return "";
                const lastAssistantMessage = Array.from(articles).reverse().find(a => a.querySelector('.markdown'));
                return lastAssistantMessage ? lastAssistantMessage.querySelector('.markdown').innerText : "";
            });

            if (currentText && currentText === lastText) {
                stableCount++;
                if (stableCount >= 3) break; // 6초간 변화 없으면 완료
            } else {
                stableCount = 0;
                lastText = currentText;
            }
        }

        console.log("\n✅ ChatGPT 답변:\n");
        console.log(lastText);
        
        // 결과를 파일로도 저장 (필요시)
        fs.writeFileSync('oracle_response.txt', lastText, 'utf8');

    } catch (err) {
        console.error("❌ 오류 발생:", err);
    } finally {
        console.log("\n💡 5초 후 브라우저를 닫습니다...");
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
}

const userPrompt = process.argv.slice(2).join(' ') || "안녕? 너는 누구니?";
askChatGPT(userPrompt);

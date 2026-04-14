import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    console.log('마마님, Playwright로 로컬 서버(http://localhost:3001)에 접속을 시도합니다...');
    await page.goto('http://localhost:3001');
    
    // 페이지 제목이나 특정 요소가 나타날 때까지 대기
    await page.waitForTimeout(5000); 
    
    const title = await page.title();
    console.log(`페이지 접속 성공! 제목: ${title}`);
    
    // 잠시 창을 유지하여 마마님이 보실 수 있게 함
    await page.waitForTimeout(10000);
  } catch (error) {
    console.error('접속 실패:', error);
  } finally {
    await browser.close();
    console.log('Playwright 테스트 종료.');
  }
})();

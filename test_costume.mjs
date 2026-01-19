import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');

  // 쇼츠 생성기 창 찾기 - 클래스나 텍스트로 찾기
  await page.waitForSelector('.shorts-generator'); // 예시 클래스

  // 대본생성하기 버튼 클릭
  await page.click('button:has-text("대본생성하기")');

  // 이미지 프롬프트 섹션 기다림
  await page.waitForSelector('.image-prompt'); // 예시

  // 의상 선택 드롭다운이나 리스트 찾기
  const costumeSelect = await page.locator('select[name="costume"]'); // 예시
  const options = await costumeSelect.locator('option').allTextContents();
  console.log('의상 리스트:', options);

  await browser.close();
})();
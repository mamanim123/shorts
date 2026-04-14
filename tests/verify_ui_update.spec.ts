import { test, expect } from '@playwright/test';

test('Verify TubeFactoryPanel updates', async ({ page }) => {
  // 3001 포트로 접속
  await page.goto('http://localhost:3001');
  
  // 1. 작업 현황판 텍스트가 있는지 확인 (첫 화면)
  const statusBoardHeader = page.getByText('WORK STATUS BOARD');
  
  // 2. 좌측 메뉴에 '이미지 퓨전'이 있는지 확인
  const fusionMenu = page.getByText('이미지 퓨전');
  
  // 3. '프로젝트 목록' 메뉴가 있는지 확인
  const projectListMenu = page.getByText('프로젝트 목록');

  // 스크린샷 저장
  await page.screenshot({ path: 'verify_result.png', fullPage: true });

  console.log('--- Verification Result ---');
  if (await statusBoardHeader.isVisible()) {
    console.log('✅ WORK STATUS BOARD is visible');
  } else {
    console.log('❌ WORK STATUS BOARD is NOT visible');
  }

  if (await fusionMenu.isVisible()) {
    console.log('✅ 이미지 퓨전 menu is visible');
  } else {
    console.log('❌ 이미지 퓨전 menu is NOT visible');
  }
  
  if (await projectListMenu.isVisible()) {
    console.log('✅ 프로젝트 목록 menu is visible');
  } else {
    console.log('❌ 프로젝트 목록 menu is NOT visible');
  }
});

import { test, expect } from 'playwright/test';

test('2단계 생성은 단일 저장과 스킵 플래그를 사용한다', async ({ page }) => {
  let generateCallIndex = 0;

  await page.route('**/api/generate/raw', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.skipFolderCreation).toBe(true);
    generateCallIndex += 1;

    if (generateCallIndex === 1) {
      const payload = {
        title: '테스트 제목',
        scriptBody: '문장1\n문장2'
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rawResponse: JSON.stringify(payload) })
      });
      return;
    }

    if (generateCallIndex === 2) {
      const payload = {
        characters: [{ name: '주인공', gender: 'female', role: 'narrator' }],
        lineCharacterNames: [
          { line: 1, characters: ['주인공'] },
          { line: 2, characters: ['주인공'] }
        ]
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rawResponse: JSON.stringify(payload) })
      });
      return;
    }

    const payload = {
      title: '테스트 제목',
      scenes: [
        { sceneNumber: 1, scriptLine: '문장1', summary: 'Scene 1', longPrompt: 'prompt1' },
        { sceneNumber: 2, scriptLine: '문장2', summary: 'Scene 2', longPrompt: 'prompt2' }
      ]
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rawResponse: JSON.stringify(payload) })
    });
  });

  await page.route('**/api/save-story', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.title).toBe('테스트 제목');
    expect(String(body.content || '')).toContain('scriptBody');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, folderName: '테스트_폴더' })
    });
  });

  await page.route('**/api/scripts/cleanup-empty-folders', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deleted: [], skipped: [], errors: [] })
    });
  });

  await page.goto('/');
  await page.getByPlaceholder('예: 골프장에서 갑자기 눈이 온 상황').fill('테스트 주제');
  await page.getByRole('button', { name: /2단계 생성/ }).first().click();

  await expect.poll(() => generateCallIndex).toBe(3);
  await expect(page.getByText('2단계 생성이 완료되었습니다.')).toBeVisible();
});

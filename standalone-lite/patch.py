import re

# 수정할 파일 경로
FILE_PATH = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\server\puppeteerHandler.js"

with open(FILE_PATH, 'r', encoding='utf-8') as f:
    content = f.read()

# ─────────────────────────────────────────
# 패치 1: waitForResponseText 함수 전체 교체
# ─────────────────────────────────────────
OLD_WAIT = '''async function waitForResponseText(activePage, config, serviceName, { minLength, stableTarget, maxAttempts, initialDelayMs }) {
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

      const trimmed = currentText.trim();
      const looksStructured = trimmed.startsWith(\'{\') || trimmed.startsWith(\'[\') || trimmed.startsWith(\'```\');
      if (looksStructured) {
        return currentText;
      }

      if (stableCount >= stableTarget) {
        return currentText;
      }
    }

    lastText = currentText;
    attempts += 1;
  }

  if (lastText.trim()) {
    return lastText.trim();
  }

  throw new Error(`Timeout waiting for ${serviceName} response.`);
}'''

NEW_WAIT = '''async function waitForResponseText(activePage, config, serviceName, { minLength, stableTarget, maxAttempts, initialDelayMs }) {
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
}'''

# ─────────────────────────────────────────
# 패치 2: generateContent 파라미터 수정
# ─────────────────────────────────────────
OLD_GEN = '''export async function generateContent(serviceName, prompt) {
  const config = await switchService(serviceName);
  await sendPromptToPage(page, config, prompt, serviceName);
  return waitForResponseText(page, config, serviceName, {
    minLength: 200,
    stableTarget: 3,
    maxAttempts: 180,
    initialDelayMs: 5000,
  });
}'''

NEW_GEN = '''export async function generateContent(serviceName, prompt) {
  const config = await switchService(serviceName);
  await sendPromptToPage(page, config, prompt, serviceName);
  return waitForResponseText(page, config, serviceName, {
    minLength: 200,
    stableTarget: 5,    // ✅ 3 → 5 (완성 안정화 강화)
    maxAttempts: 180,
    initialDelayMs: 8000, // ✅ 5000 → 8000ms (LLM 응답 시작 여유)
  });
}'''

# ─────────────────────────────────────────
# 패치 적용
# ─────────────────────────────────────────
patched = content

if OLD_WAIT in patched:
    patched = patched.replace(OLD_WAIT, NEW_WAIT)
    print("✅ 패치 1 적용 완료: waitForResponseText 수정")
else:
    print("⚠️  패치 1 실패: waitForResponseText 원본을 찾지 못했습니다. 수동 확인 필요")

if OLD_GEN in patched:
    patched = patched.replace(OLD_GEN, NEW_GEN)
    print("✅ 패치 2 적용 완료: generateContent 파라미터 수정")
else:
    print("⚠️  패치 2 실패: generateContent 원본을 찾지 못했습니다. 수동 확인 필요")

# 백업 저장
backup_path = FILE_PATH + '.bak'
with open(backup_path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"💾 원본 백업 저장: {backup_path}")

# 수정본 저장
with open(FILE_PATH, 'w', encoding='utf-8') as f:
    f.write(patched)
print(f"✅ 패치 완료: {FILE_PATH}")

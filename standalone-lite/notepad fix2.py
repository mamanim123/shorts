handler_path = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\server\puppeteerHandler.js"

with open(handler_path, "r", encoding="utf-8") as f:
    content = f.read()

old = "const userDataBaseDir = process.env.PUPPETEER_USER_DATA_DIR || path.join(liteRootDir, 'server', 'user_data', 'puppeteer');"
new = "const userDataBaseDir = 'C:\\\\puppeteer-user-data';"

if old in content:
    content = content.replace(old, new)
    print("[OK] userDataBaseDir 하드코딩 완료")
else:
    print("[FAIL] 해당 라인을 찾지 못했습니다. 현재 12번째 줄:")
    lines = content.split('\n')
    print(lines[11])

with open(handler_path, "w", encoding="utf-8") as f:
    f.write(content)

print("저장 완료!")

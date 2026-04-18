handler_path = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\server\puppeteerHandler.js"

with open(handler_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. puppeteer-extra 대신 puppeteer-core 직접 사용
old_import = """import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());"""

new_import = """import puppeteer from 'puppeteer-core';"""

if old_import in content:
    content = content.replace(old_import, new_import)
    print("[OK] puppeteer import 교체 완료")
else:
    print("[FAIL] import 구문을 찾지 못했습니다. 현재 상단 10줄:")
    for i, line in enumerate(content.split('\n')[:10]):
        print(f"  {i+1}: {line}")

# 2. 하드코딩된 userDataDir 수정 (혹시 이전 fix 안됐을 경우 대비)
old_data1 = "const userDataBaseDir = 'C:\\\\puppeteer-user-data';"
old_data2 = "const userDataBaseDir = process.env.PUPPETEER_USER_DATA_DIR || path.join(liteRootDir, 'server', 'user_data', 'puppeteer');"
new_data  = "const userDataBaseDir = 'C:\\\\puppeteer-user-data';"

if old_data1 in content:
    print("[OK] userDataBaseDir 이미 하드코딩됨")
elif old_data2 in content:
    content = content.replace(old_data2, new_data)
    print("[OK] userDataBaseDir 하드코딩 완료")
else:
    print("[WARN] userDataBaseDir 라인을 찾지 못했습니다 - 수동 확인 필요")

with open(handler_path, "w", encoding="utf-8") as f:
    f.write(content)

print("\n저장 완료! 이제 npm run dev 실행하세요.")

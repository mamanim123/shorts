import subprocess
import os
import json

base = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite"
handler_path = os.path.join(base, "server", "puppeteerHandler.js")

print("=== 1단계: puppeteerHandler.js 원상복구 ===")
with open(handler_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. puppeteer-core 직접 import → puppeteer-extra + stealth 복구
old_import = "import puppeteer from 'puppeteer-core';"
new_import = """import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());"""

if old_import in content:
    content = content.replace(old_import, new_import)
    print("[OK] puppeteer-extra + StealthPlugin import 복구 완료")
else:
    print("[SKIP] 이미 복구되어 있거나 다른 형태")

# 2. 하드코딩된 userDataBaseDir → 환경변수 방식으로 복구
old_data = "const userDataBaseDir = 'C:\\\\puppeteer-user-data';"
new_data = "const userDataBaseDir = process.env.PUPPETEER_USER_DATA_DIR || 'C:\\\\puppeteer-user-data';"

if old_data in content:
    content = content.replace(old_data, new_data)
    print("[OK] userDataBaseDir 환경변수 방식으로 복구 완료")
else:
    print("[SKIP] userDataBaseDir 이미 처리됨")

# 3. 디버그 로그 제거
debug_log = "console.log('[DEBUG] launchOptions:', JSON.stringify(launchOptions, null, 2));\n      "
if debug_log in content:
    content = content.replace(debug_log, "")
    print("[OK] 디버그 로그 제거 완료")
else:
    print("[SKIP] 디버그 로그 없음")

with open(handler_path, "w", encoding="utf-8") as f:
    f.write(content)

print("\n=== 2단계: 호환되는 puppeteer 버전으로 재설치 ===")
print("설치 중... (시간이 걸릴 수 있습니다)\n")

result = subprocess.run(
    "npm install puppeteer-core@21.11.0 puppeteer-extra@3.3.6 puppeteer-extra-plugin-stealth@2.11.2",
    cwd=base,
    shell=True,
    encoding="utf-8",
    errors="replace",
    capture_output=True
)
print(result.stdout)
if result.stderr:
    print("[STDERR]", result.stderr)

print("\n=== 3단계: 설치된 버전 확인 ===")
packages = ["puppeteer-core", "puppeteer-extra", "puppeteer-extra-plugin-stealth"]
for pkg in packages:
    pkg_json = os.path.join(base, "node_modules", pkg, "package.json")
    try:
        with open(pkg_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            print(f"{pkg}: {data.get('version')}")
    except:
        print(f"{pkg}: 확인 실패")

print("\n모든 작업 완료! npm run dev 로 서버를 실행하세요.")

import subprocess
import threading
import time

handler_path = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\server\puppeteerHandler.js"

with open(handler_path, "r", encoding="utf-8") as f:
    content = f.read()

debug_log = "console.log('[DEBUG] launchOptions:', JSON.stringify(launchOptions, null, 2));"

if debug_log not in content:
    old_launch = "browser = await puppeteer.launch(launchOptions);"
    new_launch = debug_log + "\n      " + old_launch
    if old_launch in content:
        content = content.replace(old_launch, new_launch)
        print("[OK] 디버그 로그 추가 완료")
    else:
        print("[FAIL] launch 라인을 찾지 못했습니다")
else:
    print("[OK] 디버그 로그 이미 있음")

with open(handler_path, "w", encoding="utf-8") as f:
    f.write(content)

print("파일 저장 완료. 서버 시작...\n")

proc = subprocess.Popen(
    "npm run dev",
    cwd=r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite",
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    shell=True,
    encoding="utf-8",
    errors="replace"
)

lines = []

def read_output():
    for line in proc.stdout:
        lines.append(line)
        keywords = ["DEBUG", "headless", "userDataDir", "executablePath", "Failed", "Error", "Launched", "launch"]
        if any(k.lower() in line.lower() for k in keywords):
            print(line, end="")

t = threading.Thread(target=read_output)
t.start()
time.sleep(20)
proc.terminate()
t.join(timeout=5)

print("\n=== 전체 로그 ===")
for line in lines:
    print(line, end="")

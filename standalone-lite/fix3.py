import subprocess
import os

base = r"F:\test\쇼츠대본생성기-v3.5.3\standalone-lite"

# puppeteer 관련 버전 모두 확인
packages = [
    "puppeteer-core",
    "puppeteer-extra",
    "puppeteer-extra-plugin-stealth",
    "@puppeteer/browsers"
]

print("=== 현재 버전 확인 ===")
for pkg in packages:
    pkg_json = os.path.join(base, "node_modules", pkg, "package.json")
    try:
        with open(pkg_json, "r", encoding="utf-8") as f:
            import json
            data = json.load(f)
            print(f"{pkg}: {data.get('version', 'unknown')}")
    except:
        print(f"{pkg}: 찾을 수 없음")

print("\n=== package.json 의존성 확인 ===")
with open(os.path.join(base, "package.json"), "r", encoding="utf-8") as f:
    pkg_data = json.load(f)
    deps = {**pkg_data.get("dependencies", {}), **pkg_data.get("devDependencies", {})}
    for k, v in deps.items():
        if "puppeteer" in k.lower():
            print(f"{k}: {v}")

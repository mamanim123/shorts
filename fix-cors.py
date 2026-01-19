import re

# 파일 읽기
with open('server/puppeteerHandler.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. URL 체크 부분 제거 (Line 407-411)
content = re.sub(
    r"        // 방법 A: 일반 HTTP/HTTPS URL인 경우\r?\n        if \(img\.src && \(img\.src\.startsWith\('http://'\) \|\| img\.src\.startsWith\('https://'\)\)\) \{\r?\n            console\.log\('\[Browser\] Using URL download method'\);\r?\n            return \{ method: 'url', data: img\.src \};\r?\n        \}\r?\n\r?\n        // 방법 B: Blob URL 또는 Base64인 경우 Canvas로 변환\r?\n        console\.log\('\[Browser\] Using Canvas conversion method'\);",
    "        // 🔥 CORS 문제 때문에 무조건 Canvas로 변환\r\n        console.log('[Browser] Converting to Canvas (bypassing CORS)...');",
    content
)

# 2. URL fetch 로직 전체 제거 (Line 440-469)
content = re.sub(
    r"    // 저장 처리\r?\n    if \(imageData\.method === 'url'\) \{[\s\S]*?\} else if \(imageData\.method === 'canvas'\) \{\r?\n        // Base64 데이터 직접 저장\r?\n        console\.log\(\"",
    "    // 저장 처리 - Canvas 변환된 이미지 저장\r\n    console.log(\"",
    content
)

# 3. 마지막 } 제거
content = re.sub(
    r"        console\.log\(`\[Puppeteer\] Saved image from Canvas -> \$\{screenshotPath\}`\);\r?\n    \}",
    "        console.log(`[Puppeteer] Saved image from Canvas -> ${screenshotPath}`);",
    content
)

# 파일 쓰기
with open('server/puppeteerHandler.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 수정 완료!")


import fs from 'fs';
import path from 'path';

const filePath = 'f:/projact/쇼츠대본생성기-v3.5.3/server/index.js';

try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split(/\r?\n/);

    // Line numbers from grep are 1-indexed
    // Line 1419: Now process...
    lines[1418] = '[IMPORTANT] All outputs must be in KOREAN. (모든 출력은 반드시 한국어로 작성하세요.)\n\n' + lines[1418];

    // Line 1506: const base64Data = videoData.replace...
    lines[1505] = `        // [FIX] videoData가 객체로 오는 경우 처리
        let finalBase64 = '';
        if (typeof videoData === 'string') {
            finalBase64 = videoData.replace(/^data:video\\/\\w+;base64,/, "");
        } else if (videoData && typeof videoData === 'object') {
            finalBase64 = videoData.base64 || videoData.data || '';
        }

        if (!finalBase64) {
            console.error("[SmartVideo] Failed to extract base64 from videoData:", typeof videoData);
            throw new Error("비디오 데이터를 추출할 수 없습니다.");
        }`;

    // Update next line: fs.writeFileSync(filePath, base64Data, 'base64');
    lines[1506] = lines[1506].replace('base64Data', 'finalBase64');

    // Line 1715: const base64Data = videoData.replace...
    lines[1714] = `        // [FIX] videoData가 객체로 오는 경우 처리
        let finalBase64_2 = '';
        if (typeof videoData === 'string') {
            finalBase64_2 = videoData.replace(/^data:video\\/\\w+;base64,/, "");
        } else if (videoData && typeof videoData === 'object') {
            finalBase64_2 = videoData.base64 || videoData.data || '';
        }

        if (!finalBase64_2) {
            console.error("[VideoFX] Failed to extract base64 from videoData:", typeof videoData);
            throw new Error("비디오 데이터를 추출할 수 없습니다.");
        }`;

    // Update next line: fs.writeFileSync(filePath, base64Data, 'base64');
    lines[1715] = lines[1715].replace('base64Data', 'finalBase64_2');

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log("Replacement successful via Node.js.");
} catch (err) {
    console.error("Replacement failed:", err);
    process.exit(1);
}

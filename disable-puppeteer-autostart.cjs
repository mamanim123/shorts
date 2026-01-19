const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server', 'index.js');
let content = fs.readFileSync(serverFile, 'utf8');

// Line 79: launchBrowser(); 주석 처리
const lines = content.split('\n');
if (lines[78] && lines[78].trim() === 'launchBrowser();') {
    lines[78] = '// launchBrowser(); // [PERFORMANCE] Disabled auto-start - use /api/launch';
    content = lines.join('\n');
    fs.writeFileSync(serverFile, content, 'utf8');
    console.log('✅ Puppeteer auto-start disabled successfully!');
    console.log('Modified line 79 in server/index.js');
} else {
    console.log('❌ Could not find launchBrowser() at line 79');
    console.log('Current line 79:', lines[78]);
}

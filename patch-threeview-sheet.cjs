const fs = require('fs');
const p = './server/index.js';
let t = fs.readFileSync(p, 'utf8');

// 1) sharp import 확인 후 없으면 추가
if (!/from ['"]sharp['"]|require\(['"]sharp['"]\)/.test(t)) {
  t = t.replace(/import path from 'path';/, "import path from 'path';\nimport sharp from 'sharp';");
  console.log('OK: sharp import 추가');
} else {
  console.log('SKIP: sharp 이미 import됨');
}

// 2) back.png 저장 뒤에 threeview 합본 생성 로직 삽입
const anchor = `        saveBase64Png('front.png', turnaroundImages.front);
        saveBase64Png('angle45.png', turnaroundImages.angle45);
        saveBase64Png('back.png', turnaroundImages.back);`;

const withSheet = `        saveBase64Png('front.png', turnaroundImages.front);
        saveBase64Png('angle45.png', turnaroundImages.angle45);
        saveBase64Png('back.png', turnaroundImages.back);

        // [3면 합본] front+angle45+back 를 가로로 이어붙여 threeview.png 생성
        let threeviewCreated = false;
        try {
            const decode = (d) => d ? Buffer.from(String(d).replace(/^data:image\\/\\w+;base64,/, ''), 'base64') : null;
            const parts = [turnaroundImages.front, turnaroundImages.angle45, turnaroundImages.back]
                .map(decode).filter(Boolean);
            if (parts.length > 0) {
                const CELL_W = 512, CELL_H = 768;
                const resized = await Promise.all(parts.map(buf =>
                    sharp(buf).resize(CELL_W, CELL_H, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer()
                ));
                const canvas = sharp({
                    create: { width: CELL_W * resized.length, height: CELL_H, channels: 3, background: { r: 255, g: 255, b: 255 } }
                });
                const composite = resized.map((buf, i) => ({ input: buf, left: i * CELL_W, top: 0 }));
                await canvas.composite(composite).png().toFile(path.join(targetDir, 'threeview.png'));
                threeviewCreated = true;
                console.log('[Turnaround] threeview.png 합본 생성 완료 (' + resized.length + '면)');
            }
        } catch (e) {
            console.warn('[Turnaround] threeview 합본 생성 실패:', e.message);
        }`;

if (t.includes("saveBase64Png('threeview.png'") || t.includes("threeviewCreated")) {
  console.log('SKIP: threeview 로직 이미 존재');
} else if (t.includes(anchor)) {
  t = t.replace(anchor, withSheet);
  console.log('OK: threeview 합본 생성 로직 추가');
} else {
  console.error('FAIL: front/angle45/back 저장 블록 못 찾음');
}

// 3) meta.files 와 응답 files 에 threeview 추가
const metaOld = `                front: 'front.png',
                angle45: 'angle45.png',
                back: 'back.png'
            },`;
const metaNew = `                front: 'front.png',
                angle45: 'angle45.png',
                back: 'back.png',
                threeview: threeviewCreated ? 'threeview.png' : null
            },`;
if (t.includes(metaNew)) { console.log('SKIP: meta.threeview 존재'); }
else if (t.includes(metaOld)) { t = t.replace(metaOld, metaNew); console.log('OK: meta.threeview 추가'); }
else { console.error('FAIL: meta.files 블록 못 찾음'); }

const resOld = `                back: \`/generated_scripts/characters/\${folderName}/back.png\`,
                meta: \`/generated_scripts/characters/\${folderName}/character.json\``;
const resNew = `                back: \`/generated_scripts/characters/\${folderName}/back.png\`,
                threeview: threeviewCreated ? \`/generated_scripts/characters/\${folderName}/threeview.png\` : null,
                meta: \`/generated_scripts/characters/\${folderName}/character.json\``;
if (t.includes(resNew)) { console.log('SKIP: 응답 threeview 존재'); }
else if (t.includes(resOld)) { t = t.replace(resOld, resNew); console.log('OK: 응답 threeview 추가'); }
else { console.error('FAIL: 응답 files 블록 못 찾음'); }

fs.writeFileSync(p, t, 'utf8');
console.log('패치2 완료');

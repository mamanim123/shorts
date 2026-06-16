const fs = require('fs');
const p = './server/index.js';
let t = fs.readFileSync(p, 'utf8');

// GET /api/characters 핸들러 끝('});' 다음)에 DELETE 라우트 삽입
const anchor = "app.post('/api/characters', (req, res) => {";

const deleteRoute = `// 캐릭터 폴더 삭제 (AI Studio 캐릭터의 turnaround 폴더 제거)
app.delete('/api/characters/:folderName', (req, res) => {
    try {
        const raw = decodeURIComponent(req.params.folderName || '').replace(/^aistudio-/, '');
        const safe = path.basename(raw); // 경로 탈출 방지
        if (!safe || safe !== raw) {
            return res.status(400).json({ success: false, error: 'invalid folder name' });
        }
        const targetDir = path.join(GENERATED_DIR, 'characters', safe);
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
            console.log('[Characters] 폴더 삭제됨:', safe);
        }
        // CHARACTERS_FILE 목록에서도 해당 id 제거
        try {
            let parsed = { characters: [] };
            try { parsed = JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8')); } catch (e) {}
            if (Array.isArray(parsed.characters)) {
                parsed.characters = parsed.characters.filter(c => c.id !== safe && c.id !== raw);
                fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(parsed, null, 2), 'utf8');
            }
        } catch (e) {}
        res.json({ success: true, deleted: safe });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/characters', (req, res) => {`;

if (t.includes("app.delete('/api/characters/:folderName'")) {
  console.log('SKIP: DELETE 라우트 이미 존재');
} else if (t.includes(anchor)) {
  t = t.replace(anchor, deleteRoute);
  fs.writeFileSync(p, t, 'utf8');
  console.log('OK: DELETE /api/characters/:folderName 추가');
} else {
  console.error('FAIL: app.post(/api/characters) 앵커 못 찾음');
}

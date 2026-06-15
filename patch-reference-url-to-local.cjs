const fs = require('fs');
const path = './server/index.js';
let text = fs.readFileSync(path, 'utf8');

const oldText = `    const referenceFiles = Array.isArray(referenceImages)
        ? referenceImages.map((item) => typeof item === 'string' ? item : item?.imageUrl).filter(Boolean)
        : [];
    console.log('[ImageAI] Reference files:', referenceFiles.length);`;

const newText = `    const toLocalReferenceFile = (value) => {
        const raw = typeof value === 'string' ? value : value?.imageUrl;
        if (!raw) return null;

        if (raw.startsWith('data:')) {
            const match = raw.match(/^data:(.*?);base64,(.*)$/);
            if (!match) return null;
            const mime = match[1] || 'image/png';
            const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
            const tempPath = pathModule.join(os.tmpdir(), \`shortslab_ref_\${Date.now()}_\${Math.random().toString(36).slice(2)}.\${ext}\`);
            fs.writeFileSync(tempPath, Buffer.from(match[2], 'base64'));
            return tempPath;
        }

        if (/^https?:\\/\\//i.test(raw)) {
            try {
                const url = new URL(raw);
                const pathname = decodeURIComponent(url.pathname.replace(/^\\/+/, ''));
                if (pathname.startsWith('generated_scripts/')) {
                    return pathModule.join(process.cwd(), pathname);
                }
            } catch {}
            return raw;
        }

        if (raw.startsWith('/generated_scripts/')) {
            return pathModule.join(process.cwd(), decodeURIComponent(raw.replace(/^\\/+/, '')));
        }

        return raw;
    };

    const referenceFiles = Array.isArray(referenceImages)
        ? referenceImages.map(toLocalReferenceFile).filter(Boolean)
        : [];
    console.log('[ImageAI] Reference files:', referenceFiles.length, referenceFiles);`;

if (!text.includes(oldText)) {
  console.error('패치 실패: referenceFiles 블록을 찾지 못했습니다.');
  process.exit(1);
}

text = text.replace(oldText, newText);
fs.writeFileSync(path, text, 'utf8');
console.log('패치 완료: reference URL → local file path 변환');

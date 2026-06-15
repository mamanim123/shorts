const fs = require('fs');
const p = './components/CharacterPanel.tsx';
let t = fs.readFileSync(p, 'utf8');

// === 1) 미리보기: blobId가 http URL이면 그대로 사용 (getBlob 대신) ===
const blobOld = `      const blobToUrl = async (blobId?: string) => {
        if (!blobId) return null;
        try {
          const blob = await getBlob(blobId);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return url;
        } catch {
          return null;
        }
      };`;

const blobNew = `      const blobToUrl = async (blobId?: string) => {
        if (!blobId) return null;
        // http(s) URL 또는 data: 면 그대로 사용 (AI Studio 캐릭터는 서버 URL)
        if (/^(https?:|data:|blob:)/i.test(blobId)) return blobId;
        try {
          const blob = await getBlob(blobId);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return url;
        } catch {
          return null;
        }
      };`;

if (t.includes(blobNew)) { console.log('SKIP: 미리보기 URL 지원 이미 적용됨'); }
else if (t.includes(blobOld)) { t = t.replace(blobOld, blobNew); console.log('OK: 미리보기에 URL/data 직접 지원 추가'); }
else { console.error('FAIL: blobToUrl 블록 못 찾음'); }

fs.writeFileSync(p, t, 'utf8');
console.log('패치 완료');

const fs = require('fs');
const path = require('path');
const os = require('os');

// 서버 index.js 의 toLocalReferenceFile 과 동일 로직 (검증용 복제)
const toLocalReferenceFile = (value) => {
  const raw = typeof value === 'string' ? value : value?.imageUrl;
  if (!raw) return null;
  if (raw.startsWith('data:')) {
    const match = raw.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return null;
    const mime = match[1] || 'image/png';
    const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
    const tempPath = path.join(os.tmpdir(), `shortslab_ref_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
    fs.writeFileSync(tempPath, Buffer.from(match[2], 'base64'));
    return tempPath;
  }
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      if (pathname.startsWith('generated_scripts/')) return path.join(process.cwd(), pathname);
    } catch {}
    return raw;
  }
  if (raw.startsWith('/generated_scripts/')) {
    return path.join(process.cwd(), decodeURIComponent(raw.replace(/^\/+/, '')));
  }
  return raw;
};

console.log('===== toLocalReferenceFile 검증 =====');

// [테스트 1] 실제 3면도 front.png 를 base64(data:)로 변환 후 통과
const real = path.join(process.cwd(), 'generated_scripts/characters/2026-04-09T04-40-39-148Z_혜진이/front.png');
console.log('\n[테스트1] data:base64 입력 (실제 front.png)');
if (fs.existsSync(real)) {
  const b64 = fs.readFileSync(real).toString('base64');
  const dataUrl = `data:image/png;base64,${b64}`;
  const out = toLocalReferenceFile({ imageUrl: dataUrl });
  console.log('  반환 경로 :', out);
  console.log('  파일 존재 :', fs.existsSync(out));
  console.log('  파일 크기 :', fs.existsSync(out) ? (fs.statSync(out).size/1024).toFixed(1)+' KB' : 'N/A');
  console.log('  원본 크기 :', (fs.statSync(real).size/1024).toFixed(1)+' KB');
  console.log('  >>> ', (fs.existsSync(out) && fs.statSync(out).size === fs.statSync(real).size) ? 'PASS (크기 일치)' : 'CHECK');
} else {
  console.log('  원본 없음:', real);
}

// [테스트 2] http://localhost URL 입력 → 로컬경로 변환
console.log('\n[테스트2] http://localhost URL 입력');
const out2 = toLocalReferenceFile({ imageUrl: 'http://localhost:3002/generated_scripts/characters/2026-04-09T04-40-39-148Z_혜진이/front.png' });
console.log('  반환 경로 :', out2);
console.log('  파일 존재 :', fs.existsSync(out2));
console.log('  >>> ', fs.existsSync(out2) ? 'PASS' : 'FAIL (경로 존재 안함)');

// [테스트 3] /generated_scripts/ 상대경로 입력
console.log('\n[테스트3] /generated_scripts/ 상대 입력');
const out3 = toLocalReferenceFile('/generated_scripts/characters/2026-04-09T04-40-39-148Z_혜진이/back.png');
console.log('  반환 경로 :', out3);
console.log('  파일 존재 :', fs.existsSync(out3));
console.log('  >>> ', fs.existsSync(out3) ? 'PASS' : 'FAIL');

console.log('\n===== 검증 끝 =====');

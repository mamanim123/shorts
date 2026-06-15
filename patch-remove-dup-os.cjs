const fs = require('fs');
const p = './server/index.js';
let t = fs.readFileSync(p, 'utf8');

// 중복 os 지역 선언 제거 (상단 import os from "os" 만 남김)
const patterns = [
  /^\s*const os = await import\(['"]os['"]\);\s*$/m,
  /^\s*const os = require\(['"]os['"]\);\s*$/m,
  /^\s*let os = await import\(['"]os['"]\);\s*$/m
];

let removed = 0;
for (const re of patterns) {
  while (re.test(t)) {
    t = t.replace(re, '        // [removed duplicate os declaration - using top-level import os]');
    removed++;
  }
}
console.log('제거된 중복 os 선언:', removed);

// 상단 import os 가 정확히 1개인지 확인
const importCount = (t.match(/^import os from ['"]os['"];/m) || []).length;
console.log('상단 import os 개수:', importCount);

fs.writeFileSync(p, t, 'utf8');
console.log('패치 완료');

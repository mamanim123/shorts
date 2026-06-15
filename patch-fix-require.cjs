const fs = require('fs');
const p = './server/index.js';
let t = fs.readFileSync(p, 'utf8');

// 1) os import 없으면 추가 (import path 다음 줄에)
if (!/import\s+os\s+from\s+['"]os['"]|import\s+\*\s+as\s+os\s+from\s+['"]os['"]/.test(t)) {
  if (/import path from 'path';/.test(t)) {
    t = t.replace(/import path from 'path';/, "import path from 'path';\nimport os from 'os';");
    console.log('OK: import os 추가');
  } else {
    console.error('FAIL: import path 라인 못 찾음 - 수동 확인 필요');
  }
} else {
  console.log('SKIP: os 이미 import됨');
}

// 2) require('os') 전부 os 로 치환 (ESM 호환)
const before = (t.match(/require\(['"]os['"]\)/g) || []).length;
t = t.replace(/require\(['"]os['"]\)\.tmpdir\(\)/g, 'os.tmpdir()');
t = t.replace(/require\(['"]os['"]\)/g, 'os');
const after = (t.match(/require\(['"]os['"]\)/g) || []).length;
console.log(`OK: require('os') 치환 ${before} -> ${after}`);

// 3) 혹시 다른 require( 가 남아있는지 경고 (ESM에서 터질 수 있음)
const otherRequire = (t.match(/\brequire\(/g) || []).length;
if (otherRequire > 0) {
  console.warn(`주의: 남은 require( ${otherRequire}개 - 아래 위치 확인`);
}

fs.writeFileSync(p, t, 'utf8');
console.log('패치 완료');

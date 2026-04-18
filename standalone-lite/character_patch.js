// character_patch.js
// Node.js로 실행: node character_patch.js
// character-library.json의 name을 미숙.json, 혜진.json과 동기화

const fs = require('fs');
const path = require('path');

const CHAR_DIR = path.join(__dirname, '캐릭터');
const LIB_PATH = path.join(CHAR_DIR, 'character-library.json');

// 1. 개별 JSON 파일에서 이름 읽기
function loadNameFromJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    // 단일 캐릭터 파일
    if (data.character && data.character.name) return data.character.name;
    // 라이브러리 형식
    if (data.characters && data.characters[0] && data.characters[0].name) return data.characters[0].name;
    // 이미지 base64가 직접 들어있는 경우 (미숙.json 등)
    if (data.name) return data.name;
    return null;
  } catch(e) {
    return null;
  }
}

// 2. character-library.json 읽기
const raw = fs.readFileSync(LIB_PATH, 'utf8').replace(/^\uFEFF/, '');
const library = JSON.parse(raw);

console.log('\n=== character-library.json 현재 상태 ===');
library.characters.forEach((c, i) => {
  console.log(`[${i}] id=${c.id} | name=${c.name} | isActive=${c.isActive} | sheet=${c.referenceImageFileName}`);
});

// 3. 폴더에서 _sheet.png 파일 목록
const sheets = fs.readdirSync(CHAR_DIR).filter(f => f.endsWith('_sheet.png') || f.endsWith('_sheet.jpg'));
console.log('\n=== 캐릭터 시트 파일 ===');
sheets.forEach((f, i) => console.log(`[${i}] ${f}`));

// 4. 개별 JSON 파일 이름 목록
const jsonFiles = fs.readdirSync(CHAR_DIR).filter(f => f.endsWith('.json') && f !== 'character-library.json' && !f.startsWith('tubefactory') && !f.startsWith('캐릭터_'));
console.log('\n=== 개별 캐릭터 JSON 파일 ===');
jsonFiles.forEach(f => {
  const name = loadNameFromJson(path.join(CHAR_DIR, f));
  console.log(`  ${f} → name: ${name}`);
});

// 5. character-library.json의 isActive 캐릭터에 sheet 연결
console.log('\n=== 패치 진행 ===');
let changed = false;

library.characters.forEach((char, i) => {
  // sheet.png 연결 (파일명 깨짐 대비: 인덱스 기준)
  if (!char.referenceImageFileName || !fs.existsSync(path.join(CHAR_DIR, char.referenceImageFileName))) {
    // 인덱스 기준으로 시트 할당
    const matchIdx = library.characters.filter(c => c.isActive).indexOf(char);
    if (matchIdx >= 0 && sheets[matchIdx]) {
      char.referenceImageFileName = sheets[matchIdx];
      console.log(`  [수정] ${char.id} → referenceImageFileName = ${sheets[matchIdx]}`);
      changed = true;
    }
  }
});

if (changed) {
  fs.writeFileSync(LIB_PATH, JSON.stringify(library, null, 2), 'utf8');
  console.log('\ncharacter-library.json 업데이트 완료');
} else {
  console.log('\n변경 사항 없음');
}

console.log('\n=== 완료 ===');
console.log('이제 브라우저에서 캐릭터 디자인 페이지를 새로고침하고');
console.log('캐릭터 이름을 미숙/혜진으로 수정 후 저장하세요.');
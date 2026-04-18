import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAR_DIR = path.join(__dirname, '캐릭터');
const LIB_PATH = path.join(CHAR_DIR, 'character-library.json');

function loadNameFromJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (data.character && data.character.name) return data.character.name;
    if (data.characters && data.characters[0] && data.characters[0].name) return data.characters[0].name;
    if (data.name) return data.name;
    return null;
  } catch(e) { return null; }
}

const raw = fs.readFileSync(LIB_PATH, 'utf8').replace(/^\uFEFF/, '');
const library = JSON.parse(raw);

console.log('\n=== character-library.json 현재 상태 ===');
library.characters.forEach((c, i) => {
  console.log(`[${i}] id=${c.id} | name=${c.name} | isActive=${c.isActive} | sheet=${c.referenceImageFileName}`);
});

const sheets = fs.readdirSync(CHAR_DIR).filter(f => f.endsWith('_sheet.png') || f.endsWith('_sheet.jpg'));
console.log('\n=== 캐릭터 시트 파일 ===');
sheets.forEach((f, i) => console.log(`[${i}] ${f}`));

const jsonFiles = fs.readdirSync(CHAR_DIR).filter(f =>
  f.endsWith('.json') &&
  f !== 'character-library.json' &&
  !f.startsWith('tubefactory') &&
  !f.startsWith('캐릭터_')
);
console.log('\n=== 개별 캐릭터 JSON 파일 ===');
jsonFiles.forEach(f => {
  const name = loadNameFromJson(path.join(CHAR_DIR, f));
  console.log(`  ${f} → name: ${name}`);
});

// ── 핵심: isActive 캐릭터에 시트 파일 연결 ──
console.log('\n=== 패치 진행 ===');
let changed = false;

const activeChars = library.characters.filter(c => c.isActive);

activeChars.forEach((char, activeIdx) => {
  const sheetExists = char.referenceImageFileName &&
    fs.existsSync(path.join(CHAR_DIR, char.referenceImageFileName));

  if (!sheetExists) {
    if (sheets[activeIdx]) {
      char.referenceImageFileName = sheets[activeIdx];
      console.log(`  [수정] ${char.id} (${char.name}) → sheet = ${sheets[activeIdx]}`);
      changed = true;
    } else {
      console.log(`  [스킵] ${char.id} (${char.name}) → 할당할 시트 없음`);
    }
  } else {
    console.log(`  [OK]   ${char.id} (${char.name}) → ${char.referenceImageFileName}`);
  }
});

// ── 개별 JSON 파일로 이름 동기화 ──
console.log('\n=== 이름 동기화 ===');
jsonFiles.forEach(f => {
  const name = loadNameFromJson(path.join(CHAR_DIR, f));
  if (!name) return;

  // 이름이 같은 캐릭터 찾기
  const match = library.characters.find(c =>
    c.name === name ||
    c.name === f.replace('.json', '') ||
    (c.isActive && library.characters.filter(x => x.isActive).indexOf(c) === jsonFiles.indexOf(f))
  );

  if (match && match.name !== name) {
    console.log(`  [이름 수정] ${match.id}: "${match.name}" → "${name}"`);
    match.name = name;
    changed = true;
  } else if (match) {
    console.log(`  [이름 OK] ${match.id}: "${name}"`);
  }
});

if (changed) {
  fs.writeFileSync(LIB_PATH, JSON.stringify(library, null, 2), 'utf8');
  console.log('\n✅ character-library.json 업데이트 완료');
} else {
  console.log('\n변경 사항 없음 (이미 정상)');
}

// ── 현재 실제 사용 가능한 시트 요약 ──
console.log('\n=== 최종 상태 요약 ===');
library.characters.filter(c => c.isActive).forEach(c => {
  const sheetPath = c.referenceImageFileName
    ? path.join(CHAR_DIR, c.referenceImageFileName)
    : null;
  const exists = sheetPath && fs.existsSync(sheetPath);
  console.log(`  ${c.name} (${c.id})`);
  console.log(`    시트: ${c.referenceImageFileName || '없음'} [${exists ? '✅ 파일 존재' : '❌ 파일 없음'}]`);
  console.log(`    프롬프트: ${(c.aiOptimizedPrompt || '').substring(0, 60)}...`);
});
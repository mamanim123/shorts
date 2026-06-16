const fs = require('fs');

// ===== 1) characterService.ts: deleteCharacterFolder 함수 추가 =====
{
  const p = './services/characterService.ts';
  let t = fs.readFileSync(p, 'utf8');

  const anchor = 'export const saveCharacters = async';
  const fn = `export const deleteCharacterFolder = async (id: string): Promise<boolean> => {
  try {
    const folderName = id.replace(/^aistudio-/, '');
    const response = await fetch('http://localhost:3002/api/characters/' + encodeURIComponent(folderName), {
      method: 'DELETE',
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const saveCharacters = async`;

  if (t.includes('export const deleteCharacterFolder')) {
    console.log('SKIP: deleteCharacterFolder 이미 존재');
  } else if (t.includes(anchor)) {
    t = t.replace(anchor, fn);
    fs.writeFileSync(p, t, 'utf8');
    console.log('OK: deleteCharacterFolder 추가');
  } else {
    console.error('FAIL: saveCharacters 앵커 못 찾음');
  }
}

// ===== 2) CharacterPanel.tsx: import + handleDeleteCharacter 에서 폴더 삭제 호출 =====
{
  const p = './components/CharacterPanel.tsx';
  let t = fs.readFileSync(p, 'utf8');

  // 2-1) import 에 deleteCharacterFolder 추가
  const impOld = "import { fetchCharacters, saveCharacters } from '../services/characterService';";
  const impNew = "import { fetchCharacters, saveCharacters, deleteCharacterFolder } from '../services/characterService';";
  if (t.includes(impNew)) {
    console.log('SKIP: import 이미 수정됨');
  } else if (t.includes(impOld)) {
    t = t.replace(impOld, impNew);
    console.log('OK: import 수정');
  } else {
    console.error('FAIL: import 라인 못 찾음');
  }

  // 2-2) 삭제 핸들러에서 서버 저장 전에 폴더 삭제 호출
  const delOld = `    const updated = characters.filter((char) => char.id !== id);
    setCharacters(updated);
    await saveCharactersToBE(updated);`;
  const delNew = `    const updated = characters.filter((char) => char.id !== id);
    setCharacters(updated);
    // AI Studio 캐릭터는 서버 폴더(generated_scripts/characters)도 삭제
    if (target.sourceType === 'ai-studio') {
      try { await deleteCharacterFolder(target.id); } catch (e) { /* noop */ }
    }
    await saveCharactersToBE(updated);`;

  if (t.includes('deleteCharacterFolder(target.id)')) {
    console.log('SKIP: 폴더 삭제 호출 이미 적용됨');
  } else if (t.includes(delOld)) {
    t = t.replace(delOld, delNew);
    console.log('OK: handleDeleteCharacter 폴더 삭제 호출 추가');
  } else {
    console.error('FAIL: handleDeleteCharacter 블록 못 찾음');
  }

  fs.writeFileSync(p, t, 'utf8');
}

console.log('패치2 완료');

const fs = require('fs');
const path = 'components/ShortsLabPanel.tsx';
let src = fs.readFileSync(path, 'utf8');

// 각 단계 직후에 console.log 삽입 (디버그용)
const inserts = [
  { after: "if (first) storyContext = first.title + '\\\\n' + first.content;\n            }",
    log: "\n            console.log('[V4-1 줄거리]', storyContext.slice(0,200));" },
  { after: "if (!finalScript) throw new Error('대본 추출 실패');",
    log: "\n            console.log('[V4-2 대본raw]', scriptRaw.slice(0,300));\n            console.log('[V4-2 finalScript]', finalScript.slice(0,300));" },
  { after: "let assigned = parseV4SceneAssignment(assignRaw, allowedSlotIds);",
    log: "\n            console.log('[V4-3 배정raw]', assignRaw.slice(0,300));\n            console.log('[V4-3 assigned]', JSON.stringify(assigned).slice(0,300));" }
];

let count = 0;
for (const ins of inserts) {
  const idx = src.indexOf(ins.after);
  if (idx !== -1) {
    const pos = idx + ins.after.length;
    src = src.slice(0, pos) + ins.log + src.slice(pos);
    count++;
  } else {
    console.log('SKIP (못찾음):', ins.after.slice(0,40));
  }
}
fs.writeFileSync(path, src, 'utf8');
console.log('로그 삽입 완료:', count, '/3');
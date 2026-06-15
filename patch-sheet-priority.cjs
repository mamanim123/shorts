const fs = require('fs');
const p = './components/ShortsLabPanel.tsx';
let t = fs.readFileSync(p, 'utf8');

const oldSel = `                const refs = casting.referenceImageUrls;
                const imageUrl =
                    refs?.[preferredView] ||
                    refs?.[casting.referenceViewPreference || 'front'] ||
                    casting.referenceImageUrl ||
                    refs?.front ||
                    refs?.angle45 ||
                    refs?.back ||
                    '';`;

const newSel = `                const refs = casting.referenceImageUrls;
                // [합본 우선] 3면 합본(referenceImageUrl=sheet)을 1순위로 첨부, 없으면 개별 view 폴백
                const imageUrl =
                    casting.referenceImageUrl ||
                    refs?.[preferredView] ||
                    refs?.[casting.referenceViewPreference || 'front'] ||
                    refs?.front ||
                    refs?.angle45 ||
                    refs?.back ||
                    '';`;

if (t.includes(newSel)) { console.log('SKIP: 이미 합본 우선 적용됨'); }
else if (t.includes(oldSel)) { t = t.replace(oldSel, newSel); fs.writeFileSync(p, t, 'utf8'); console.log('OK: 합본(threeview/sheet) 우선 첨부 패치 완료'); }
else { console.error('FAIL: imageUrl 선택 블록 못 찾음'); }

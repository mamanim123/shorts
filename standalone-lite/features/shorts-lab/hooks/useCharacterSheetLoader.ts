// useCharacterSheetLoader.ts
// F:\test\쇼츠대본생성기-v3.5.3\standalone-lite\features\shorts-lab\hooks\useCharacterSheetLoader.ts

import { useEffect } from 'react';

const API = 'http://localhost:3002';

/**
 * 앱 시작 시 character-library.json을 읽어
 * isActive 캐릭터의 시트 PNG를 base64로 로드해서
 * characters state에 referenceImageUrl로 주입합니다.
 */
export const useCharacterSheetLoader = (
  characters: any[],
  setCharacters: (fn: (prev: any[]) => any[]) => void
) => {
  useEffect(() => {
    const loadSheets = async () => {
      try {
        // 1. character-library.json 전체 로드
        const libRes = await fetch(`${API}/api/character-library-full`);
        if (!libRes.ok) return;
        const lib = await libRes.json();
        
        // 2. isActive 캐릭터만 처리
        const activeLibChars = (lib.characters || []).filter((c: any) => c.isActive);
        if (activeLibChars.length === 0) {
          console.log('[SheetLoader] 활성화된 캐릭터 정보가 서버에 없음. 기존 데이터 유지.');
          return;
        }

        // 3. 각 캐릭터의 시트 base64 로드
        const updates: Record<string, { name: string; dataUrl: string; prompt: string }> = {};
        
        for (const libChar of activeLibChars) {
          if (!libChar.sheetFileExists || !libChar.referenceImageFileName) continue;
          
          try {
            const sheetRes = await fetch(
              `${API}/api/character-sheet-b64?fileName=${encodeURIComponent(libChar.referenceImageFileName)}`
            );
            if (!sheetRes.ok) continue;
            const sheetData = await sheetRes.json();
            if (!sheetData.success) continue;
            
            updates[libChar.id] = {
              name: libChar.name,
              dataUrl: sheetData.dataUrl,
              prompt: libChar.aiOptimizedPrompt || ''
            };
            console.log(`[SheetLoader] 로드 완료: ${libChar.name} (${libChar.id})`);
          } catch(e) {
            console.warn(`[SheetLoader] 시트 로드 실패: ${libChar.id}`, e);
          }
        }

        if (Object.keys(updates).length === 0) return;

        // 4. characters state 업데이트
        // library id와 state id 매칭: 순서 기반 폴백
        setCharacters(prev => {
          const activeLibIds = activeLibChars.map((c: any) => c.id);
          const activePrevChars = prev.filter(c => c.isActive);
          
          return prev.map(char => {
            // 직접 id 매칭
            if (updates[char.id]) {
              const u = updates[char.id];
              return {
                ...char,
                name: u.name,
                referenceImageUrl: u.dataUrl,
                aiOptimizedPrompt: u.prompt || char.aiOptimizedPrompt
              };
            }
            
            // 순서 기반 매칭 (id가 다른 경우)
            const activeIdx = activePrevChars.indexOf(char);
            if (activeIdx >= 0 && activeLibIds[activeIdx]) {
              const libId = activeLibIds[activeIdx];
              if (updates[libId]) {
                const u = updates[libId];
                return {
                  ...char,
                  name: u.name,
                  referenceImageUrl: u.dataUrl,
                  aiOptimizedPrompt: u.prompt || char.aiOptimizedPrompt
                };
              }
            }
            
            return char;
          });
        });

        console.log(`[SheetLoader] ${Object.keys(updates).length}개 캐릭터 시트 로드 완료`);
      } catch(e) {
        console.warn('[SheetLoader] 전체 로드 실패:', e);
      }
    };

    // 서버 준비 후 실행 (약간의 딜레이)
    const timer = setTimeout(loadSheets, 1500);
    return () => clearTimeout(timer);
  }, []); // 마운트 시 1회만
};
const fs = require('fs');

const file = './ai_studio_bundle/components/FrameGenerator.tsx';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('selectedCharacterId')) {
  console.log('이미 저장된 캐릭터 선택 기능이 적용되어 있습니다.');
  process.exit(0);
}

src = src.replace(
  "import React, { useState } from 'react';",
  "import React, { useState, useEffect } from 'react';"
);

src = src.replace(
  "import { CameraSettings } from './CameraControls';",
  "import { CameraSettings } from './CameraControls';\nimport { CharacterCollection } from '../../types';\nimport { getAppStorageValue } from '../../services/appStorageService';"
);

src = src.replace(
  "const [maintainConsistency, setMaintainConsistency] = useState(true);",
  `const [maintainConsistency, setMaintainConsistency] = useState(true);
    const [savedCharacters, setSavedCharacters] = useState<CharacterCollection[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState('');

    useEffect(() => {
        const loadCharacters = async () => {
            try {
                const saved = await getAppStorageValue<CharacterCollection[] | null>('characterCollection', null);
                setSavedCharacters(Array.isArray(saved) ? saved : []);
            } catch (err) {
                console.error('[FrameGenerator] 캐릭터 목록 로드 실패:', err);
            }
        };

        loadCharacters();
    }, []);`
);

src = src.replace(
  `const handleClearCharacterImage = () => {
        if (characterImageUrl) URL.revokeObjectURL(characterImageUrl);
        setCharacterImage(null);
        setCharacterImageUrl(null);
    };`,
  `const handleClearCharacterImage = () => {
        if (characterImageUrl && characterImageUrl.startsWith('blob:')) URL.revokeObjectURL(characterImageUrl);
        setCharacterImage(null);
        setCharacterImageUrl(null);
        setSelectedCharacterId('');
    };

    const urlToFile = async (url: string, filename: string): Promise<File> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type || 'image/png' });
    };

    const handleSelectCharacter = async (id: string) => {
        setSelectedCharacterId(id);

        if (!id) {
            setCharacterImage(null);
            setCharacterImageUrl(null);
            return;
        }

        const character = savedCharacters.find(c => c.id === id);
        const imageUrl =
            character?.turnaroundImageIds?.front ||
            character?.generatedImageId ||
            character?.thumbnail ||
            null;

        if (!character || !imageUrl) {
            alert('선택한 캐릭터의 참조 이미지를 찾지 못했습니다.');
            return;
        }

        try {
            const resolvedUrl = imageUrl.startsWith('http')
                ? imageUrl
                : imageUrl.startsWith('/')
                    ? \`http://localhost:3002\${imageUrl}\`
                    : imageUrl;

            const file = await urlToFile(resolvedUrl, \`\${character.name || 'character'}_front.png\`);

            if (characterImageUrl && characterImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(characterImageUrl);
            }

            setCharacterImage(file);
            setCharacterImageUrl(resolvedUrl);
            setMaintainConsistency(true);
        } catch (err) {
            console.error('[FrameGenerator] 캐릭터 이미지 적용 실패:', err);
            alert('캐릭터 이미지를 불러오지 못했습니다.');
        }
    };`
);

src = src.replace(
  `<ImageDropzone
                    onImageDrop={handleCharacterImageDrop}
                    previewUrl={characterImageUrl}
                    onClear={handleClearCharacterImage}
                />`,
  `{savedCharacters.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm text-gray-300 mb-2">
                            저장된 캐릭터 선택
                        </label>
                        <select
                            value={selectedCharacterId}
                            onChange={(e) => handleSelectCharacter(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-sm text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value="">직접 업로드</option>
                            {savedCharacters.map(character => (
                                <option key={character.id} value={character.id}>
                                    {character.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            선택하면 해당 캐릭터의 정면 이미지가 참조 이미지로 자동 적용됩니다.
                        </p>
                    </div>
                )}

                <ImageDropzone
                    onImageDrop={handleCharacterImageDrop}
                    previewUrl={characterImageUrl}
                    onClear={handleClearCharacterImage}
                />`
);

fs.writeFileSync(file, src, 'utf8');
console.log('FrameGenerator 저장 캐릭터 선택 기능 패치 완료');

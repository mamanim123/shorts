const fs = require('fs');
const path = './components/ShortsLabPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

const newFunction = `

    // ============================================
    // V4 실험용 생성 (동적 캐릭터 주입 시스템)
    // ============================================

    const handleExperimentalGenerate = async () => {
        if (!aiTopic.trim()) {
            setGenerationError('주제를 입력해주세요.');
            return;
        }

        setIsTwoStepGenerating(true);
        setGenerationError(null);

        try {
            // Get current character rules from Genre Manager
            const characterRules = getCharacterRules();

            // Build dynamic slot instruction
            const slotInstruction = buildDynamicSlotInstruction(characterRules);

            const selectedGenreData = labGenres.find(g => g.id === aiGenre);
            const allowedOutfitCategories = getAllowedOutfitCategoriesForGenre(aiGenre);
            
            // Build prompt with dynamic character injection
            const prompt = buildLabScriptPrompt({
                topic: aiTopic,
                genre: aiGenre,
                targetAge: aiTargetAge,
                gender: settings.koreanGender,
                genreGuideOverride: selectedGenreData ? {
                    name: selectedGenreData.name,
                    description: selectedGenreData.description,
                    emotionCurve: selectedGenreData.emotionCurve,
                    structure: selectedGenreData.structure,
                    killerPhrases: selectedGenreData.killerPhrases,
                    supportingCharacterPhrasePatterns: selectedGenreData.supportingCharacterPhrasePatterns,
                    bodyReactions: selectedGenreData.bodyReactions,
                    forbiddenPatterns: selectedGenreData.forbiddenPatterns,
                    goodTwistExamples: selectedGenreData.goodTwistExamples,
                    supportingCharacterTwistPatterns: selectedGenreData.supportingCharacterTwistPatterns,
                    badTwistExamples: selectedGenreData.badTwistExamples,
                    allowedOutfitCategories: selectedGenreData.allowedOutfitCategories
                } : undefined,
                enableWinterAccessories,
                useRandomOutfits,
                allowedOutfitCategories,
                characterSlotMode: scriptCharacterMode,
                // V4: Inject dynamic slot instruction
                customInstructions: slotInstruction
            });

            const selectedService = targetService || 'GEMINI';
            showToast(\`[V4] \${selectedService} AI로 동적 캐릭터 주입 생성 중...\`, 'info');

            const response = await fetch('http://localhost:3002/api/generate/raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: selectedService,
                    prompt,
                    maxTokens: 2000,
                    temperature: 0.9
                })
            });

            if (!response.ok) {
                throw new Error(\`API 오류: \${response.status}\`);
            }

            const data = await response.json();
            const generatedText = data.rawResponse || data.text || data.result || '';

            if (data._folderName) {
                setCurrentFolderName(data._folderName);
            }

            let finalScript = '';
            let extractedScenes = [];

            try {
                let jsonClean = generatedText.trim();
                jsonClean = jsonClean.replace(/^(JSON|json)\\s+/, "").trim();
                if (jsonClean.startsWith("\`\`\`")) {
                    jsonClean = jsonClean.replace(/^\`\`\`(json)?/, "").replace(/\`\`\`$/, "").trim();
                }

                const parsed = parseJsonFromText(jsonClean, ["script", "scriptBody", "scriptLine", "shortPrompt", "shortPromptKo", "longPrompt", "longPromptKo", "hook", "punchline", "twist", "title"]);
                if (!parsed) {
                    throw new Error('JSON parse failed');
                }

                const scriptData = parsed.scripts?.[0] || parsed;
                const rawScript = scriptData.scriptBody || scriptData.script || parsed.scriptBody || parsed.script || "";

                if (rawScript) {
                    const scriptMatch = rawScript.match(/---\\s*([\\s\\S]*?)\\s*---/);
                    finalScript = scriptMatch ? scriptMatch[1].trim() : rawScript.trim();
                }

                const scenesSource = scriptData.scenes || parsed.scenes;
                if (scenesSource && Array.isArray(scenesSource)) {
                    // V4: Process with characterRules for proper identity injection
                    const processedScenes = postProcessAiScenes(scenesSource, {
                        femaleOutfit: settings.selectedOutfit || undefined,
                        maleOutfit: undefined,
                        targetAgeLabel: aiTargetAge,
                        gender: settings.koreanGender,
                        characters: scriptData.characters || parsed.characters,
                        genre: aiGenre,
                        totalScenes: scenesSource.length,
                        enableWinterAccessories,
                        useGenderGuard: settings.useGenderGuard,
                        postProcessConfig: selectedGenreData?.postProcessConfig,
                        characterRules // V4: Pass characterRules for dynamic slot matching
                    });

                    // Normalize slots using the new regex-based parser
                    const scenesWithCharacterSlots = scenesSource.map((scene) => {
                        const slot = scene.characterSlot || scene.slot || '';
                        return {
                            ...scene,
                            _normalizedSlot: slot ? normalizeSlotId(String(slot)) : ''
                        };
                    });

                    extractedScenes = processedScenes.map((scene, idx) => {
                        const sceneText = scene.scriptLine || scene.summary || scene.text || \`장면 \${idx + 1}\`;
                        const narrationText = typeof scene.narration === 'string'
                            ? scene.narration
                            : scene.narration?.text || '';
                        const lipSyncLine = scene.lipSync?.line || scene.dialogue || '';
                        const voiceType = scene.voiceType || (lipSyncLine ? 'both' : narrationText ? 'narration' : 'none');
                        
                        const sourceScene = scenesWithCharacterSlots[idx];
                        const characterIds = sourceScene?._normalizedSlot 
                            ? [sourceScene._normalizedSlot] 
                            : undefined;

                        return {
                            number: scene.sceneNumber || idx + 1,
                            text: sceneText,
                            prompt: scene.longPrompt || scene.shortPrompt || scene.prompt || '',
                            imageUrl: undefined,
                            shortPromptKo: scene.shortPromptKo || '',
                            longPromptKo: scene.longPromptKo || '',
                            summary: scene.summary || sceneText,
                            camera: scene.camera || '',
                            shotType: scene.shotType || '',
                            age: scene.age || '',
                            outfit: scene.outfit || '',
                            isSelected: true,
                            videoPrompt: scene.videoPrompt || '',
                            dialogue: scene.dialogue || lipSyncLine || '',
                            voiceType,
                            narrationText: narrationText || sceneText,
                            narrationEmotion: scene.narration?.emotion || '',
                            narrationSpeed: scene.narration?.speed || 'normal',
                            lipSyncSpeaker: scene.lipSync?.speaker || '',
                            lipSyncSpeakerName: scene.lipSync?.speakerName || '',
                            lipSyncLine: lipSyncLine || '',
                            lipSyncEmotion: scene.lipSync?.emotion || '',
                            lipSyncTiming: scene.lipSync?.timing || undefined,
                            characterIds
                        };
                    });
                }
            } catch (e) {
                console.warn('[ShortsLab V4] JSON parsing failed:', e);
                const scriptMatch = generatedText.match(/---\\s*([\\s\\S]*?)\\s*---/);
                if (scriptMatch) {
                    finalScript = scriptMatch[1].trim();
                }
            }

            if (!finalScript && extractedScenes.length === 0) {
                throw new Error('대본을 추출할 수 없습니다.');
            }

            if (finalScript) setScriptInput(finalScript.trim());

            if (extractedScenes.length > 0) {
                setScenes(extractedScenes);
                setActiveTab('preview');
                showToast(\`✅ [V4] 동적 캐릭터 주입 생성 완료! (\${extractedScenes.length}개 씬)\`, 'success');
            }

        } catch (error) {
            console.error('[V4] 생성 실패:', error);
            setGenerationError(error instanceof Error ? error.message : 'V4 생성에 실패했습니다.');
        } finally {
            setIsTwoStepGenerating(false);
        }
    };`;

// Find the pattern after handleAiGenerate function ends
const pattern = `} finally {
            setIsGenerating(false);
        }
    };

    // ============================================`;

const replacement = `} finally {
            setIsGenerating(false);
        }
    };${newFunction}

    // ============================================`;

if (content.includes(pattern)) {
  content = content.replace(pattern, replacement);
  fs.writeFileSync(path, content);
  console.log('✅ Task 4: V4 experimental handler added successfully');
} else {
  console.log('⚠️ Pattern not found');
}

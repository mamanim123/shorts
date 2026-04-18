    // ============================================================
    // [신규] 줄거리 생성 흐름
    // ============================================================

    const handleGenerateStorylines = async () => {
        if (!aiTopic.trim() && !benchmarkSource.trim()) {
            showToast('주제/키워드를 입력해주세요.', 'error');
            return;
        }
        setIsGenerating(true);
        try {
            const result = await generateBenchmarkStorylinePackage(
                aiTopic.trim() || benchmarkSource.trim(),
                10,
                benchmarkSource.trim()
            );
            setBenchmarkAnalysis(result.analysis);
            setStorylines(result.storylines);
            setSelectedStoryIndex(result.storylines.length > 0 ? 0 : null);
            setSelectedStoryDraft(result.storylines[0]?.content || '');
            setScriptPhase('storylines');
            showToast(
                benchmarkSource.trim()
                    ? '벤치마킹 분석 + 줄거리 10개 생성 완료!'
                    : 'AI 바이럴 줄거리 10개 생성 완료!',
                'success'
            );
        } catch (err) {
            showToast('줄거리 생성에 실패했습니다.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelectStoryline = (index: number) => {
        const story = storylines[index];
        if (!story) return;
        setSelectedStoryIndex(index);
        setSelectedStoryDraft(story.content);
    };

    const handleConfirmStoryline = async () => {
        if (selectedStoryIndex === null) {
            showToast('줄거리를 먼저 선택해주세요.', 'error');
            return;
        }
        const selectedStory = storylines[selectedStoryIndex];
        const storyContext = selectedStory.title + '\n' + (selectedStoryDraft || selectedStory.content);
        setScriptPhase('idle');
        await handleAiGenerateWithContext(storyContext);
    };

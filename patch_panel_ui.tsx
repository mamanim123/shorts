                                    {scriptPhase === 'idle' ? (
                                        <div className="space-y-3">
                                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                                                <details>
                                                    <summary className="px-4 py-3 text-sm text-slate-400 cursor-pointer hover:text-slate-200 transition-colors list-none flex items-center gap-2">
                                                        <span>📎</span>
                                                        <span>벤치마킹 참고 영상 설명 (선택사항)</span>
                                                    </summary>
                                                    <div className="px-4 pb-4 space-y-2 border-t border-slate-700">
                                                        <textarea
                                                            value={benchmarkSource}
                                                            onChange={(e) => setBenchmarkSource(e.target.value)}
                                                            placeholder="벤치마킹할 영상의 설명, 자막, 소개 문구를 붙여넣으세요."
                                                            className="w-full h-28 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 outline-none resize-none focus:border-lime-500/50 transition-all mt-3"
                                                        />
                                                        <p className="text-xs text-slate-500">원문 문장을 그대로 복사하지 않고 구조만 참고합니다.</p>
                                                    </div>
                                                </details>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <button
                                                    onClick={handleGenerateStorylines}
                                                    disabled={isGenerating || isMasterGenerating || !aiTopic.trim()}
                                                    className="w-full py-3 bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isGenerating
                                                        ? <><Loader2 className="w-5 h-5 animate-spin" /> 줄거리 생성 중...</>
                                                        : <><Sparkles className="w-5 h-5" /> AI 줄거리 생성</>}
                                                </button>
                                                <button
                                                    onClick={handleMasterGenerate}
                                                    disabled={isGenerating || isMasterGenerating || !aiTopic.trim()}
                                                    className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isMasterGenerating
                                                        ? <><Loader2 className="w-5 h-5 animate-spin" /> 마스터 생성 중...</>
                                                        : <><Wand2 className="w-5 h-5" /> AI 마스터 생성</>}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 animate-in fade-in duration-300">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-lime-400" />
                                                    줄거리 선택
                                                    <span className="text-xs font-normal text-slate-400">
                                                        ({storylines.length}개)
                                                    </span>
                                                </h3>
                                                <button
                                                    onClick={() => setScriptPhase('idle')}
                                                    className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
                                                >
                                                    <X className="w-3 h-3" /> 다시 입력
                                                </button>
                                            </div>
                                            {benchmarkAnalysis && (
                                                <div className="bg-slate-800/60 border border-lime-500/20 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <div className="text-xs font-black text-lime-400 mb-1">원본 핵심</div>
                                                        <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.sourceSummary}</p>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-lime-400 mb-1">후킹 방식</div>
                                                        <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.hookPattern}</p>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-lime-400 mb-1">톤/말투</div>
                                                        <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.toneStyle}</p>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-black text-lime-400 mb-1">재구성 규칙</div>
                                                        <p className="text-slate-300 leading-relaxed">{benchmarkAnalysis.rebuildProtocol}</p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                                                {storylines.map((story, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => handleSelectStoryline(i)}
                                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                            selectedStoryIndex === i
                                                                ? 'border-lime-500 bg-lime-500/10'
                                                                : 'border-slate-700 bg-slate-800/50 hover:border-lime-500/50'
                                                        }`}
                                                    >
                                                        <div className={`text-xs font-bold mb-1 leading-snug ${selectedStoryIndex === i ? 'text-lime-400' : 'text-white'}`}>
                                                            {i + 1}. {story.title}
                                                        </div>
                                                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{story.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-2">
                                                <div className="text-xs font-bold text-slate-300">선택한 줄거리 (편집 가능)</div>
                                                <textarea
                                                    value={selectedStoryDraft}
                                                    onChange={(e) => setSelectedStoryDraft(e.target.value)}
                                                    className="w-full h-24 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-300 outline-none resize-none focus:border-lime-500/50 transition-all"
                                                    placeholder="카드를 선택하면 여기서 수정할 수 있습니다."
                                                />
                                                <button
                                                    onClick={handleConfirmStoryline}
                                                    disabled={isGenerating || selectedStoryIndex === null}
                                                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isGenerating
                                                        ? <><Loader2 className="w-5 h-5 animate-spin" /> 대본 생성 중...</>
                                                        : <><Wand2 className="w-5 h-5" /> 이 줄거리로 대본 생성</>}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

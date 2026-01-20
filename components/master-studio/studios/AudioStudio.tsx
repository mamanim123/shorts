import React, { useState, useEffect } from 'react';
import { AudioHistoryItem, Speaker } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';
import { generateMultiSpeakerAudio, generateDialogueScript } from '../services/geminiService';
import { pcmToWavBlob } from '../services/audioUtils';
import { getBlob, setBlob, deleteBlob } from '../services/dbService';
import { Play, Loader2, Download, Trash2, Mic2, Sparkles, Edit3 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const initialSpeakers: [Speaker, Speaker] = [
    { name: 'Darling', delivery: 'Say cheerfully:', dialogue: "How's it going today Donis?", voice: 'Kore' },
    { name: 'Donis', delivery: 'Say calmly:', dialogue: 'Not too bad, how about you?', voice: 'Puck' },
];

const voices = ['Kore', 'Puck', 'Charon', 'Zephyr', 'Fenrir'];
const deliveries = [
    'Say cheerfully:', 'Say calmly:', 'Say excitedly:', 'Say sadly:', 'Say angrily:', 'Whispering:', 'Announce dramatically:',
];

const AudioStudio: React.FC = () => {
    const [speakers, setSpeakers] = useState<[Speaker, Speaker]>(initialSpeakers);
    const [audioHistory, setAudioHistory] = useLocalStorage<AudioHistoryItem[]>('audioHistory', []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentAudio, setCurrentAudio] = useState<{ id: string; url: string } | null>(null);
    const [historyAudioUrls, setHistoryAudioUrls] = useState<Record<string, string>>({});

    // AI Director Mode State
    const [mode, setMode] = useState<'Manual' | 'Director'>('Manual');
    const [scenarioPrompt, setScenarioPrompt] = useState('');
    const [directorCast, setDirectorCast] = useState([
        { name: 'Alice', voice: 'Kore' },
        { name: 'Bob', voice: 'Puck' }
    ]);

    useEffect(() => {
        const urls: Record<string, string> = {};
        const loadAudios = async () => {
            if (!Array.isArray(audioHistory)) return;
            for (const item of audioHistory) {
                if (item.audioId) {
                    try {
                        const blob = await getBlob(item.audioId);
                        if (blob) {
                            urls[item.id] = URL.createObjectURL(blob);
                        }
                    } catch (e) {
                        console.error(`Failed to load audio ${item.audioId}`, e);
                    }
                }
            }
            setHistoryAudioUrls(urls);
        };
        loadAudios();
        return () => {
            Object.values(urls).forEach(URL.revokeObjectURL);
        };
    }, [audioHistory]);

    const handleSpeakerChange = (index: 0 | 1, field: keyof Speaker, value: string) => {
        const newSpeakers = [...speakers] as [Speaker, Speaker];
        newSpeakers[index] = { ...newSpeakers[index], [field]: value };
        setSpeakers(newSpeakers);
    };

    const handleDirectorCastChange = (index: 0 | 1, field: 'name' | 'voice', value: string) => {
        const newCast = [...directorCast];
        newCast[index] = { ...newCast[index], [field]: value };
        setDirectorCast(newCast);
    };

    const handleGenerateScript = async () => {
        if (!scenarioPrompt.trim()) {
            setError("시나리오를 입력해주세요. / Please enter a scenario.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const generatedScript = await generateDialogueScript(scenarioPrompt, directorCast);
            if (generatedScript && generatedScript.length >= 2) {
                setSpeakers([generatedScript[0], generatedScript[1]]);
                setMode('Manual'); // Switch to manual to view/edit result
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "대본 생성 실패");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateAudio = async () => {
        setIsLoading(true);
        setError(null);
        setCurrentAudio(null);
        try {
            const response = await generateMultiSpeakerAudio(speakers);
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const wavBlob = pcmToWavBlob(base64Audio);
                const audioId = uuidv4();
                await setBlob(audioId, wavBlob);

                const newHistoryItem: AudioHistoryItem = {
                    id: uuidv4(),
                    speakers: JSON.parse(JSON.stringify(speakers)),
                    audioId,
                };
                setAudioHistory(prev => [newHistoryItem, ...(Array.isArray(prev) ? prev : [])].slice(0, 25));

                const audioUrl = URL.createObjectURL(wavBlob);
                setCurrentAudio({ id: newHistoryItem.id, url: audioUrl });
            } else {
                throw new Error("API에서 오디오 데이터를 반환하지 않았습니다. / No audio data returned from API.");
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다. / An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const playFromHistory = (item: AudioHistoryItem) => {
        const url = historyAudioUrls[item.id];
        if (url) {
            setCurrentAudio({ url, id: item.id });
            setSpeakers(item.speakers);
        }
    };

    const deleteFromHistory = async (id: string) => {
        const itemToDelete = audioHistory.find(item => item.id === id);
        if (itemToDelete) {
            await deleteBlob(itemToDelete.audioId);
        }
        setAudioHistory(prev => (Array.isArray(prev) ? prev.filter(item => item.id !== id) : []));
        if (currentAudio?.id === id) {
            setCurrentAudio(null);
        }
    };

    const SpeakerEditor: React.FC<{ speaker: Speaker; index: 0 | 1 }> = ({ speaker, index }) => (
        <div className="bg-gray-800/50 p-4 rounded-xl border border-purple-500/30 flex-1">
            <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/50 mr-3 flex items-center justify-center font-bold text-lg">{speaker.name.charAt(0)}</div>
                <input type="text" value={speaker.name} onChange={e => handleSpeakerChange(index, 'name', e.target.value)} placeholder="Speaker Name" className="text-xl font-bold bg-transparent focus:outline-none w-full text-white" />
            </div>
            <div className="space-y-3">
                <select value={speaker.voice} onChange={e => handleSpeakerChange(index, 'voice', e.target.value)} className="w-full bg-gray-900/70 p-2 rounded-md border border-gray-700 focus:ring-purple-500 focus:border-purple-500 text-gray-200">
                    {voices.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={speaker.delivery} onChange={e => handleSpeakerChange(index, 'delivery', e.target.value)} className="w-full bg-gray-900/70 p-2 rounded-md border border-gray-700 focus:ring-purple-500 focus:border-purple-500 text-gray-200">
                    {deliveries.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <textarea value={speaker.dialogue} onChange={e => handleSpeakerChange(index, 'dialogue', e.target.value)} placeholder="Dialogue" rows={3} className="w-full bg-gray-900/70 p-2 rounded-md border border-gray-700 focus:ring-purple-500 focus:border-purple-500 text-gray-200" />
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-black/20">
            <div className="flex-1 p-6 flex flex-col">
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <div className="flex items-center p-3 mb-4 bg-gray-900/50 rounded-lg border border-white/10">
                        <Mic2 className="text-purple-400 mr-3" />
                        <h1 className="text-xl font-bold text-purple-300">오디오 스튜디오 / Audio Studio</h1>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex bg-gray-900/50 p-1 rounded-lg mb-4 border border-white/10 w-fit">
                        <button
                            onClick={() => setMode('Manual')}
                            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${mode === 'Manual' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Edit3 size={16} className="mr-2" /> 🎛️ 수동 모드 / Manual
                        </button>
                        <button
                            onClick={() => setMode('Director')}
                            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center transition-all ${mode === 'Director' ? 'bg-fuchsia-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Sparkles size={16} className="mr-2" /> 🎬 AI 디렉터 모드 / AI Director
                        </button>
                    </div>

                    {mode === 'Director' ? (
                        <div className="bg-gray-800/30 p-6 rounded-xl border border-fuchsia-500/30 mb-6">
                            <h2 className="text-lg font-bold text-fuchsia-300 mb-4">AI Director (Gemini 3.0 Pro)</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">상황 묘사 (Scenario)</label>
                                    <textarea
                                        value={scenarioPrompt}
                                        onChange={e => setScenarioPrompt(e.target.value)}
                                        placeholder="예: 비 오는 날, 카페에서 헤어지는 연인. 남자는 차갑고 여자는 울먹인다. / E.g., A couple breaking up in a rainy cafe. The man is cold, the woman is tearful."
                                        rows={3}
                                        className="w-full bg-gray-900/70 p-3 rounded-lg border border-gray-600 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Character 1</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={directorCast[0].name} onChange={e => handleDirectorCastChange(0, 'name', e.target.value)} className="bg-gray-900/70 p-2 rounded border border-gray-600 w-full" placeholder="Name" />
                                            <select value={directorCast[0].voice} onChange={e => handleDirectorCastChange(0, 'voice', e.target.value)} className="bg-gray-900/70 p-2 rounded border border-gray-600">
                                                {voices.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-300 mb-2">Character 2</label>
                                        <div className="flex gap-2">
                                            <input type="text" value={directorCast[1].name} onChange={e => handleDirectorCastChange(1, 'name', e.target.value)} className="bg-gray-900/70 p-2 rounded border border-gray-600 w-full" placeholder="Name" />
                                            <select value={directorCast[1].voice} onChange={e => handleDirectorCastChange(1, 'voice', e.target.value)} className="bg-gray-900/70 p-2 rounded border border-gray-600">
                                                {voices.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerateScript}
                                    disabled={isLoading}
                                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                                    대본 작성 (Write Script)
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-6 mb-4 items-start">
                            <SpeakerEditor speaker={speakers[0]} index={0} />
                            <SpeakerEditor speaker={speakers[1]} index={1} />
                        </div>
                    )}

                    {error && <div className="mt-4 text-red-400 bg-red-900/50 p-3 rounded-md">{error}</div>}

                    {currentAudio && (
                        <div className="mt-6 bg-gray-800/50 p-4 rounded-xl border border-purple-500/30">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-200">현재 재생 / Now Playing</h3>
                                <a href={currentAudio.url} download={`audio_${currentAudio.id}.wav`} className="flex items-center text-gray-400 hover:text-white text-sm"><Download size={16} className="mr-1" /> Download</a>
                            </div>
                            <audio controls src={currentAudio.url} className="w-full mt-2" autoPlay key={currentAudio.id}>Your browser does not support the audio element.</audio>
                        </div>
                    )}
                </div>

                {/* Generate Button - Only show in Manual Mode or if we have a script ready */}
                {mode === 'Manual' && (
                    <div className="flex-none pt-4 mt-4 border-t border-gray-700/50">
                        <button onClick={handleGenerateAudio} disabled={isLoading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-400/50 flex items-center justify-center text-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {isLoading ? <><Loader2 className="animate-spin mr-2" /> Generating...</> : 'Generate Audio (TTS)'}
                        </button>
                    </div>
                )}
            </div>
            <div className="w-80 bg-black/40 p-4 flex flex-col overflow-hidden border-l border-white/10">
                <h2 className="text-xl font-bold mb-4 text-purple-300 p-2">히스토리 / History</h2>
                <div className="flex-1 overflow-y-auto space-y-3 -mr-2 pr-2">
                    {Array.isArray(audioHistory) && audioHistory.map(item => (
                        <div key={item.id} className={`p-3 rounded-lg bg-gray-800/60 border ${currentAudio?.id === item.id ? 'border-purple-500' : 'border-gray-700'}`}>
                            <p className="font-semibold text-xs truncate text-purple-300">{item.speakers[0].name}</p>
                            <p className="text-xs text-gray-300 line-clamp-2 italic mb-1">"{item.speakers[0].dialogue}"</p>
                            <p className="font-semibold text-xs truncate text-purple-300 mt-2">{item.speakers[1].name}</p>
                            <p className="text-xs text-gray-300 line-clamp-2 italic">"{item.speakers[1].dialogue}"</p>
                            <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-gray-700">
                                <button onClick={() => playFromHistory(item)} className="flex items-center text-purple-400 hover:text-purple-300 text-sm"><Play size={16} className="mr-1" /> Play</button>
                                <button onClick={(e) => { e.stopPropagation(); deleteFromHistory(item.id); }} className="text-red-500 hover:text-red-400"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {audioHistory.length === 0 && <p className="text-gray-500 text-sm text-center mt-4">생성된 오디오가 없습니다.</p>}
                </div>
            </div>
        </div>
    );
};

export default AudioStudio;

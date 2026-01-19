import React, { useState } from 'react';
import Spinner from './Spinner';

interface VoiceSettings {
    text: string;
    voice: string;
    emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
    speed: number; // 0.5 ~ 2.0
    pitch: number; // -20 ~ 20
}

interface VoiceStudioProps {
    onGenerateVoice: (settings: VoiceSettings) => Promise<string>; // Returns audio URL
    isGenerating: boolean;
}

const VOICE_OPTIONS = [
    { value: 'ko-KR-Standard-A', label: '여성 1 (표준)' },
    { value: 'ko-KR-Standard-B', label: '여성 2 (부드러움)' },
    { value: 'ko-KR-Standard-C', label: '남성 1 (표준)' },
    { value: 'ko-KR-Standard-D', label: '남성 2 (깊은 목소리)' },
    { value: 'ko-KR-Wavenet-A', label: '여성 3 (자연스러움)' },
    { value: 'ko-KR-Wavenet-B', label: '여성 4 (밝음)' },
    { value: 'ko-KR-Wavenet-C', label: '남성 3 (자연스러움)' },
    { value: 'ko-KR-Wavenet-D', label: '남성 4 (차분함)' }
];

const EMOTION_PRESETS = {
    neutral: { pitch: 0, speed: 1.0, label: '중립', emoji: '😐' },
    happy: { pitch: 5, speed: 1.1, label: '기쁨', emoji: '😊' },
    sad: { pitch: -5, speed: 0.9, label: '슬픔', emoji: '😢' },
    angry: { pitch: 3, speed: 1.2, label: '화남', emoji: '😠' },
    excited: { pitch: 8, speed: 1.3, label: '흥분', emoji: '🤩' }
};

const VoiceStudio: React.FC<VoiceStudioProps> = ({ onGenerateVoice, isGenerating }) => {
    const [settings, setSettings] = useState<VoiceSettings>({
        text: '',
        voice: 'ko-KR-Wavenet-A',
        emotion: 'neutral',
        speed: 1.0,
        pitch: 0
    });
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    const handleEmotionChange = (emotion: VoiceSettings['emotion']) => {
        const preset = EMOTION_PRESETS[emotion];
        setSettings({
            ...settings,
            emotion,
            pitch: preset.pitch,
            speed: preset.speed
        });
    };

    const handleGenerate = async () => {
        if (!settings.text.trim()) {
            alert('텍스트를 입력해주세요.');
            return;
        }

        try {
            const url = await onGenerateVoice(settings);
            setAudioUrl(url);
            setIsPlaying(false);
        } catch (error) {
            console.error('Voice generation error:', error);
            alert('음성 생성에 실패했습니다.');
        }
    };

    const handlePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const handleDownload = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `voice_${Date.now()}.mp3`;
        a.click();
    };

    const loadFromScript = () => {
        // 쇼츠 생성기에서 대본 불러오기 (추후 구현)
        alert('쇼츠 생성기 연동 기능은 곧 추가됩니다!');
    };

    const quickFillExample = () => {
        setSettings({
            ...settings,
            text: '안녕하세요! 오늘은 정말 멋진 날씨네요. 여러분은 어떤 하루를 보내고 계신가요?'
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">🎤 보이스 스튜디오 (TTS)</h3>
                <div className="flex gap-2">
                    <button
                        onClick={loadFromScript}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded-md transition"
                    >
                        📝 대본 불러오기
                    </button>
                    <button
                        onClick={quickFillExample}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-md transition"
                    >
                        ⚡ 예시 채우기
                    </button>
                </div>
            </div>

            <p className="text-sm text-gray-400">
                텍스트를 입력하면 AI가 자연스러운 음성으로 변환합니다. 목소리, 감정, 속도, 음높이를 조절할 수 있습니다.
            </p>

            {/* 텍스트 입력 */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-medium text-gray-300">1. 텍스트 입력</h4>
                    <span className="text-xs text-gray-400">{settings.text.length}자</span>
                </div>
                <textarea
                    value={settings.text}
                    onChange={(e) => setSettings({ ...settings, text: e.target.value })}
                    placeholder="음성으로 변환할 텍스트를 입력하세요...

예: 안녕하세요! 오늘은 정말 멋진 날씨네요."
                    className="w-full bg-gray-800 border border-gray-600 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                    rows={6}
                />
            </div>

            {/* 음성 설정 */}
            <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                <h4 className="text-base font-medium text-gray-300">2. 음성 설정</h4>

                {/* 목소리 선택 */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">목소리</label>
                    <select
                        value={settings.voice}
                        onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                    >
                        {VOICE_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                {/* 감정 선택 */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">감정</label>
                    <div className="grid grid-cols-5 gap-2">
                        {Object.entries(EMOTION_PRESETS).map(([key, preset]) => (
                            <button
                                key={key}
                                onClick={() => handleEmotionChange(key as VoiceSettings['emotion'])}
                                className={`py-2 px-3 rounded-md text-sm font-semibold transition ${settings.emotion === key
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                    }`}
                            >
                                <div>{preset.emoji}</div>
                                <div className="text-xs mt-1">{preset.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 속도 조절 */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1">
                        속도: {settings.speed.toFixed(1)}x
                    </label>
                    <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={settings.speed}
                        onChange={(e) => setSettings({ ...settings, speed: parseFloat(e.target.value) })}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>0.5x (느림)</span>
                        <span>1.0x (보통)</span>
                        <span>2.0x (빠름)</span>
                    </div>
                </div>

                {/* 음높이 조절 */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1">
                        음높이: {settings.pitch > 0 ? '+' : ''}{settings.pitch}
                    </label>
                    <input
                        type="range"
                        min="-20"
                        max="20"
                        step="1"
                        value={settings.pitch}
                        onChange={(e) => setSettings({ ...settings, pitch: parseInt(e.target.value) })}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>-20 (낮음)</span>
                        <span>0 (보통)</span>
                        <span>+20 (높음)</span>
                    </div>
                </div>
            </div>

            {/* 생성 버튼 */}
            <button
                onClick={handleGenerate}
                disabled={isGenerating || !settings.text.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
                {isGenerating ? (
                    <>
                        <Spinner />
                        음성 생성 중...
                    </>
                ) : (
                    <>
                        🎤 음성 생성하기
                    </>
                )}
            </button>

            {/* 생성된 음성 */}
            {audioUrl && (
                <div className="bg-gray-900 rounded-lg p-4 border border-green-700/50">
                    <h4 className="text-base font-medium text-green-400 mb-3">✅ 음성 생성 완료!</h4>

                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                    />

                    <div className="flex items-center gap-3 mb-3">
                        <button
                            onClick={handlePlay}
                            className="flex-shrink-0 w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full flex items-center justify-center transition"
                        >
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition"
                        >
                            📥 음성 다운로드
                        </button>
                        <button
                            onClick={() => setAudioUrl(null)}
                            className="bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-4 rounded-md transition"
                        >
                            새로 만들기
                        </button>
                    </div>

                    {/* 음성 정보 */}
                    <div className="mt-3 pt-3 border-t border-gray-700">
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                            <div>목소리: {VOICE_OPTIONS.find(v => v.value === settings.voice)?.label}</div>
                            <div>감정: {EMOTION_PRESETS[settings.emotion].emoji} {EMOTION_PRESETS[settings.emotion].label}</div>
                            <div>속도: {settings.speed.toFixed(1)}x</div>
                            <div>음높이: {settings.pitch > 0 ? '+' : ''}{settings.pitch}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 안내 메시지 */}
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                    💡 <strong>팁:</strong> 생성된 음성을 신 만들기 모드에서 배경 음악으로 사용하거나,
                    영상 편집 도구에서 내레이션으로 추가할 수 있습니다.
                </p>
            </div>

            {/* 사용 가이드 */}
            {!audioUrl && settings.text.trim() === '' && (
                <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
                    <p className="text-gray-400 mb-2">텍스트를 입력하여 음성 생성을 시작하세요</p>
                    <p className="text-sm text-gray-500">
                        자연스러운 한국어 TTS로 쇼츠 영상에<br />
                        내레이션을 추가할 수 있습니다
                    </p>
                </div>
            )}
        </div>
    );
};

export default VoiceStudio;

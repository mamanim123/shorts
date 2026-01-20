import React, { useState, useRef } from 'react';
import { Mic, StopCircle, Download, Loader2, AlertTriangle, Music, RotateCcw } from 'lucide-react';

const RecordingStudio: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        setError(null);
        setRecordedUrl(null);
        setIsLoading(true);

        try {
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: true, // required to show the prompt, but we won't use it
                audio: {
                    sampleRate: 48000,
                    channelCount: 2,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });

            if (displayStream.getAudioTracks().length === 0) {
                displayStream.getTracks().forEach(track => track.stop());
                throw new Error("오디오가 공유되지 않았습니다. 브라우저 프롬프트에서 '시스템 오디오 공유' 또는 '탭 오디오 공유'를 선택했는지 확인하세요.");
            }

            streamRef.current = displayStream;

            // Create a new stream with only the audio tracks to avoid mimeType conflicts
            const audioStream = new MediaStream(displayStream.getAudioTracks());

            // Stop the video track as it's not needed for recording
            displayStream.getVideoTracks().forEach(track => track.stop());

            mediaRecorderRef.current = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                setRecordedUrl(audioUrl);
                streamRef.current?.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);

        } catch (err) {
            console.error("Error starting recording:", err);
            if (err instanceof DOMException && err.name === 'NotAllowedError') {
                setError("녹음 권한이 거부되었습니다. 페이지를 새로고침하고 다시 시도하세요.");
            } else if (err instanceof Error) {
                setError(err.message);
            }
            else {
                setError("녹음을 시작하는 중 오류가 발생했습니다.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleReset = () => {
        if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
        }
        setRecordedUrl(null);
        setError(null);
        setIsRecording(false);
        setIsLoading(false);
    };

    const Instructions = () => (
        <div className="text-sm text-gray-400 p-4 bg-gray-800/60 rounded-lg border border-purple-500/20 mb-6">
            <h3 className="font-bold text-lg text-purple-300 mb-2">
                📢 잠깐! 시스템 오디오 녹음 방법 (중요)
            </h3>
            <p className="mb-3">
                보안상의 이유로 브라우저는 컴퓨터 사운드를 직접 녹음하는 것을 허용하지 않습니다. 아래 단계를 따라야만 소리를 녹음할 수 있습니다.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-left">
                <li>
                    <strong>'녹음 시작'</strong> 버튼을 누르면 화면 공유 창이 나타납니다.
                </li>
                <li>
                    녹음하고 싶은 소리가 나는 <strong>[Chrome 탭]</strong> 또는 <strong>[전체 화면]</strong>을 선택하세요.
                </li>
                <li>
                    <strong className="text-yellow-300">[매우 중요]</strong> 창 왼쪽 하단의 <strong>'탭 오디오 공유'</strong> 또는 <strong>'시스템 오디오 공유'</strong> 체크박스를 <strong>반드시</strong> 선택하세요.
                </li>
            </ol>
            <p className="mt-4 text-xs text-gray-500">
                ※ 화면은 녹화되지 않으며, 선택한 소스에서 나오는 오디오만 녹음됩니다.
            </p>
        </div>
    );


    return (
        <div className="flex h-full bg-black/20 justify-center items-center">
            <div className="w-full max-w-2xl p-8 bg-gray-900/50 rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/10 text-center">
                <Music size={48} className="mx-auto text-purple-400 mb-4" />
                <h1 className="text-3xl font-bold mb-2 text-gray-100">녹음실 / Recording Studio</h1>
                <p className="text-gray-400 mb-8">컴퓨터에서 재생되는 모든 소리(시스템 오디오, 유튜브, 음악 등)를 녹음하세요.</p>

                {error && (
                    <div className="bg-red-900/50 text-red-300 p-4 rounded-lg mb-6 flex items-center justify-center text-sm">
                        <AlertTriangle size={20} className="mr-3 flex-shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {!isRecording && !recordedUrl && <Instructions />}

                {!recordedUrl && (
                    <div className="space-y-4">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isLoading}
                            className={`w-full text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 flex items-center justify-center text-lg disabled:opacity-50 disabled:cursor-wait ${isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400/50' : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-400/50'
                                }`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin mr-3" />
                                    <span>사용자 승인 대기 중...</span>
                                </>
                            ) : isRecording ? (
                                <>
                                    <StopCircle className="mr-3" />
                                    <span>녹음 중지 / Stop Recording</span>
                                </>
                            ) : (
                                <>
                                    <Mic className="mr-3" />
                                    <span>녹음 시작 / Start Recording</span>
                                </>
                            )}
                        </button>
                        {isRecording && (
                            <div className="flex items-center justify-center text-red-400 animate-pulse font-semibold mt-4">
                                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                                REC
                            </div>
                        )}
                    </div>
                )}

                {recordedUrl && (
                    <div className="space-y-6">
                        <h2 className="text-xl font-semibold text-gray-200">녹음 완료! / Recording Complete!</h2>
                        <audio controls src={recordedUrl} className="w-full">
                            Your browser does not support the audio element.
                        </audio>
                        <div className="flex gap-4">
                            <button
                                onClick={handleReset}
                                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                            >
                                <RotateCcw className="mr-2" size={18} />
                                새 녹음 / New Recording
                            </button>
                            <a
                                href={recordedUrl}
                                download={`recording-${new Date().toISOString()}.webm`}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                            >
                                <Download className="mr-2" size={18} />
                                다운로드 / Download
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecordingStudio;

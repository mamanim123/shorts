
import React from 'react';
import Sidebar from './Sidebar';
import ImageStudio from './studios/ImageStudio';
import VideoStudio from './studios/VideoStudio';
import PromptLab from './studios/PromptLab';
import AudioStudio from './studios/AudioStudio';
import RecordingStudio from './studios/RecordingStudio';
import ImageReverseStudio from './studios/ImageReverseStudio';
import ThumbnailStudio from './studios/ThumbnailStudio';
import { Studio } from './types';
import useLocalStorage from './hooks/useLocalStorage';
import { initGeminiService } from './services/geminiService';

interface MasterStudioContainerProps {
    onClose?: () => void;
}

const MasterStudioContainer: React.FC<MasterStudioContainerProps> = ({ onClose }) => {
    const [activeStudio, setActiveStudio] = useLocalStorage<Studio>('activeStudio', Studio.Image);

    React.useEffect(() => {
        initGeminiService();
    }, []);

    const renderStudio = () => {
        switch (activeStudio) {
            case Studio.Image:
                return <ImageStudio />;
            case Studio.Video:
                return <VideoStudio />;
            case Studio.PromptLab:
                return <PromptLab />;
            case Studio.Audio:
                return <AudioStudio />;
            case Studio.Recording:
                return <RecordingStudio />;
            case Studio.ImageReverse:
                return <ImageReverseStudio />;
            case Studio.Thumbnail:
                return <ThumbnailStudio />;
            default:
                return <ImageStudio />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-900/80 text-white font-sans backdrop-blur-sm">
            <div className="absolute inset-0 bg-black/30 z-[-1]"></div>
            <Sidebar activeStudio={activeStudio} setActiveStudio={setActiveStudio} onClose={onClose} />
            <main className="flex-1 overflow-hidden relative">
                {renderStudio()}
            </main>
        </div>
    );
};

export default MasterStudioContainer;

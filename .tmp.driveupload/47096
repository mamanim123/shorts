
import React from 'react';
import { Layout, Image, Video, Mic, MessageSquare, Music } from 'lucide-react';
import { Studio } from './types';
import UsageWidget from './UsageWidget';

interface SidebarProps {
    activeStudio: Studio;
    setActiveStudio: (studio: Studio) => void;
    onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeStudio, setActiveStudio, onClose }) => {
    const menuItems = [
        { id: Studio.Image, icon: Image, label: '이미지 스튜디오' },
        { id: Studio.Video, icon: Video, label: '비디오 스튜디오' },
        { id: Studio.PromptLab, icon: MessageSquare, label: '프롬프트 연구소' },
        { id: Studio.Audio, icon: Music, label: '오디오 스튜디오' },
        { id: Studio.Recording, icon: Mic, label: '녹음실' },
        { id: Studio.ImageReverse, icon: Layout, label: '이미지 리버스' },
        { id: Studio.Thumbnail, icon: Layout, label: '썸네일 스튜디오' },
    ];

    return (
        <div className="w-64 bg-black/40 backdrop-blur-md border-r border-white/10 flex flex-col p-4">
            <div className="flex items-center mb-8 px-2">
                <Layout className="w-8 h-8 text-purple-500 mr-3" />
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                        Master Studio
                    </h1>
                    <p className="text-xs text-gray-400">Creator's Workspace</p>
                </div>
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="mb-6 w-full py-2 text-xs font-semibold rounded-lg bg-red-600/80 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 transition-all"
                >
                    EXIT STUDIO
                </button>
            )}

            <nav className="space-y-2">
                {menuItems.map((item) => (
                    <React.Fragment key={item.id}>
                        <button
                            onClick={() => setActiveStudio(item.id)}
                            className={`w-full flex items-center p-3 rounded-xl transition-all duration-300 ${activeStudio === item.id
                                ? 'bg-purple-600 shadow-lg shadow-purple-900/50 text-white translate-x-1'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <item.icon className={`w-5 h-5 mr-3 ${activeStudio === item.id ? 'animate-pulse' : ''}`} />
                            <span className="font-medium">{item.label}</span>
                        </button>
                        {item.id === Studio.Thumbnail && (
                            <div className="pt-2">
                                <UsageWidget />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/10">
                <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-white mb-1">Pro Status: Active</h3>
                    <p className="text-xs text-gray-300">Unlimited generations available</p>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;

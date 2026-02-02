import React from 'react';
import { X } from 'lucide-react';

interface LightboxAction {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    tone?: 'danger' | 'primary';
}

interface LightboxProps {
    imageUrl: string | null;
    onClose: () => void;
    actions?: LightboxAction[];
}

const Lightbox: React.FC<LightboxProps> = ({ imageUrl, onClose, actions }) => {
    if (!imageUrl) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div className="relative max-w-full max-h-full">
                <img
                    src={imageUrl}
                    alt="Lightbox view"
                    className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl shadow-purple-500/20"
                    onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image itself
                />
                <button
                    onClick={onClose}
                    className="absolute -top-5 -right-5 p-2 bg-gray-800/80 rounded-full text-white hover:bg-purple-600 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
                    aria-label="Close image view"
                >
                    <X size={24} />
                </button>

                {Array.isArray(actions) && actions.length > 0 && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-sm rounded-b-lg px-4 py-3 flex items-center justify-center gap-3"
                    >
                        {actions.map((action, idx) => (
                            <button
                                key={`${action.label}-${idx}`}
                                onClick={action.onClick}
                                className={`w-11 h-11 flex items-center justify-center rounded-full border transition-colors shadow-sm ${
                                    action.tone === 'danger'
                                        ? 'bg-red-600/80 text-white border-red-400 hover:bg-red-500'
                                        : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                                }`}
                                title={action.label}
                                aria-label={action.label}
                            >
                                {action.icon}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Lightbox;

import React, { useState } from 'react';
import { ImageHistoryItem } from './types';
import ShortsImageHistorySidebar from '../ShortsImageHistorySidebar';

interface ImageHistorySidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    historyItems: ImageHistoryItem[];
    historyImages: Record<string, string>;
    onSelect: (item: ImageHistoryItem) => void;
    onDelete: (id: string, e?: React.MouseEvent) => void;
    onSaveToDisk?: (id: string, e: React.MouseEvent) => void; // legacy props (unused)
    onSaveCharacter?: (item: ImageHistoryItem, e: React.MouseEvent) => void; // legacy props (unused)
    onToggleFavorite?: (id: string, e?: React.MouseEvent) => void;
    onEdit?: (item: ImageHistoryItem, e: React.MouseEvent) => void; // legacy props (unused)
}

const ImageHistorySidebar: React.FC<ImageHistorySidebarProps> = ({
    isOpen,
    setIsOpen,
    historyItems,
    historyImages,
    onSelect,
    onDelete,
    onToggleFavorite
}) => {
    const [favoritesOnly, setFavoritesOnly] = useState(false);

    const handleCopyPrompt = async (prompt: string = '', e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await navigator.clipboard.writeText(prompt);
        } catch (err) {
            console.error('Prompt copy failed', err);
        }
    };

    return (
        <ShortsImageHistorySidebar
            show={isOpen}
            favoritesOnly={favoritesOnly}
            setFavoritesOnly={setFavoritesOnly}
            onClose={() => setIsOpen(!isOpen)}
            imageHistory={Array.isArray(historyItems) ? historyItems : []}
            historyUrls={historyImages || {}}
            onToggleFavorite={(id, e) => onToggleFavorite?.(id, e)}
            onCopyPrompt={handleCopyPrompt}
            onDelete={onDelete}
            onSelectImage={(_, item) => onSelect(item)}
            enableDrag
        />
    );
};

export default ImageHistorySidebar;

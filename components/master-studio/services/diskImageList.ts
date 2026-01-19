/**
 * Fetch list of saved image filenames from server (generated_scripts/images).
 */
export const fetchDiskImageList = async (): Promise<string[]> => {
    try {
        const candidates = [
            'http://localhost:3002/api/images/list',
            'http://127.0.0.1:3002/api/images/list'
        ];
        for (const url of candidates) {
            try {
                // Add timestamp to prevent caching
                const noCacheUrl = `${url}?t=${Date.now()}`;
                const resp = await fetch(noCacheUrl);
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data)) return data;
                }
            } catch (e) {
                console.error(`Failed to fetch disk image list via ${url}`, e);
            }
        }
    } catch (e) {
        console.error('Failed to fetch disk image list', e);
    }
    return [];
};

export interface StoryFolderInfo {
    folderName: string;
    imageCount: number;
}

export const fetchImageStoryFolders = async (): Promise<StoryFolderInfo[]> => {
    try {
        const candidates = [
            'http://localhost:3002/api/images/story-folders',
            'http://127.0.0.1:3002/api/images/story-folders'
        ];
        for (const url of candidates) {
            try {
                const resp = await fetch(`${url}?t=${Date.now()}`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data)) {
                        return data.map((entry) => ({
                            folderName: entry?.folderName || '',
                            imageCount: Number(entry?.imageCount || 0)
                        })).filter(folder => folder.folderName);
                    }
                }
            } catch (err) {
                console.error(`Failed to fetch story folders via ${url}`, err);
            }
        }
    } catch (e) {
        console.error('Failed to fetch story folders', e);
    }
    return [];
};

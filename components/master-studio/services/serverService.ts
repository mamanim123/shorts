export interface SaveImageResult {
    filename: string;
    url?: string;
    storyId?: string;
    sceneNumber?: number;
}

export const saveImageToDisk = async (
    imageData: string,
    prompt: string,
    storyId?: string,
    sceneNumber?: number,
    storyTitle?: string
): Promise<SaveImageResult> => {
    try {
        const response = await fetch('http://localhost:3002/api/save-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageData,
                prompt,
                storyId,
                sceneNumber,
                storyTitle
            })
        });

        if (!response.ok) {
            throw new Error(`Save image request failed (${response.status})`);
        }

        const data = await response.json();
        if (data?.success && data?.filename) {
            return {
                filename: data.filename,
                url: data.url,
                storyId: data.storyId,
                sceneNumber: data.sceneNumber
            };
        }
        throw new Error(data?.error || 'Failed to save image');
    } catch (e) {
        console.error("Failed to save image to disk", e);
        throw e instanceof Error ? e : new Error('Failed to save image to disk');
    }
};

export interface SaveVideoResult {
    filename: string;
    url: string;
    storyId?: string;
}

export const saveVideoToDisk = async (videoData: string, prompt: string, storyId?: string, storyTitle?: string): Promise<SaveVideoResult> => {
    try {
        const response = await fetch('http://localhost:3002/api/save-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoData, prompt, storyId, storyTitle })
        });
        const data = await response.json();
        if (data.success) {
            return {
                filename: data.filename,
                url: data.url,
                storyId: data.storyId
            };
        }
        throw new Error(data.error || 'Failed to save video');
    } catch (e) {
        console.error("Failed to save video to disk", e);
        throw e instanceof Error ? e : new Error('Failed to save video');
    }
};

export const deleteFileFromDisk = async (filename: string, fileType: 'image' | 'video'): Promise<boolean> => {
    if (!filename) return false;
    try {
        const response = await fetch('http://localhost:3002/api/delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, fileType })
        });
        const data = await response.json();
        return data.success;
    } catch (e) {
        console.error("Failed to delete file from disk", e);
        return false;
    }
};

export const mergeVideoAndAudio = async (payload: { storyId?: string; storyTitle?: string; videoFilename: string; audioFilename: string; outputName?: string; }): Promise<{ filename: string; url: string; storyId?: string; }> => {
    try {
        const response = await fetch('http://localhost:3002/api/merge-video-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            return {
                filename: data.filename,
                url: data.url,
                storyId: data.storyId
            };
        }
        throw new Error(data.error || 'Failed to merge assets');
    } catch (error) {
        console.error("Failed to merge video/audio", error);
        throw error instanceof Error ? error : new Error('Failed to merge video and audio');
    }
};

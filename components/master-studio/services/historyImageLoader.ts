import { getBlob } from './dbService';
import { ImageHistoryItem } from '../types';

type HistoryLike = Partial<ImageHistoryItem> & {
    id: string;
    generatedImageId?: string;
    localFilename?: string;
    url?: string;
};

/**
 * Resolve image history items into object URLs with multiple fallbacks.
 * Priority: IndexedDB (generatedImageId) -> saved file (localFilename) -> legacy base64/url field.
 */
export const resolveImageHistoryUrls = async (
    items: HistoryLike[] | undefined,
    existing: Record<string, string> = {}
): Promise<Record<string, string>> => {
    if (!Array.isArray(items)) return {};

    const pending = items
        .filter((item): item is HistoryLike => Boolean(item?.id) && !existing[item.id!])
        .map(async (item) => {
            if (!item.id) return null;

            // 1) IndexedDB blob
            if (item.generatedImageId) {
                try {
                    const blob = await getBlob(item.generatedImageId);
                    if (blob) {
                        return { id: item.id, url: URL.createObjectURL(blob) };
                    }
                } catch (e) {
                    console.error(`IndexedDB load failed for ${item.generatedImageId}`, e);
                }
            }

            // 2) Saved local filename (served statically)
            if (item.localFilename) {
                const candidates = [
                    `/generated_scripts/images/${item.localFilename}`,
                    `http://localhost:3002/generated_scripts/images/${item.localFilename}`,
                    `http://127.0.0.1:3002/generated_scripts/images/${item.localFilename}`
                ];
                for (const url of candidates) {
                    try {
                        const resp = await fetch(url);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            return { id: item.id, url: URL.createObjectURL(blob) };
                        }
                    } catch (e) {
                        console.error(`Local file fetch failed for ${item.localFilename} via ${url}`, e);
                    }
                }
            }

            // 3) Legacy inline/base64 url
            if ((item as any).url) {
                return { id: item.id, url: (item as any).url as string };
            }

            return null;
        });

    const results = await Promise.all(pending);
    const urls: Record<string, string> = {};
    results.forEach((res) => {
        if (res?.id && res.url) {
            urls[res.id] = res.url;
        }
    });
    return urls;
};

const DB_NAME = 'creator-studio-db';
const BLOB_STORE_NAME = 'blob-store';
const DB_VERSION = 1;

function getDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(new Error(`IndexedDB error: ${request.error?.message}`));
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) {
                db.createObjectStore(BLOB_STORE_NAME);
            }
        };
    });
}

export async function setBlob(id: string, blob: Blob): Promise<void> {
    const db = await getDb();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(BLOB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(BLOB_STORE_NAME);
        const request = store.put(blob, id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error(`Transaction error: ${transaction.error?.message}`));
        request.onerror = () => reject(new Error(`Request error: ${request.error?.message}`));
    });
}

export async function getBlob(id: string): Promise<Blob | null> {
    const db = await getDb();
    return new Promise<Blob | null>((resolve, reject) => {
        const transaction = db.transaction(BLOB_STORE_NAME, 'readonly');
        const store = transaction.objectStore(BLOB_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ? (request.result as Blob) : null);
        request.onerror = () => reject(new Error(`Request error: ${request.error?.message}`));
    });
}

export async function deleteBlob(id: string): Promise<void> {
    const db = await getDb();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(BLOB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(BLOB_STORE_NAME);
        const request = store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error(`Transaction error: ${transaction.error?.message}`));
        request.onerror = () => reject(new Error(`Request error: ${request.error?.message}`));
    });
}

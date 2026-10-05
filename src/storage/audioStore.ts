/**
 * Audio files (mp3 etc.) live in IndexedDB on this device, keyed by song id.
 * They're too big for localStorage and aren't synced; the song only syncs the
 * track's settings (name, where bar 1 starts, volume).
 */
const DB = 'gp-audio';
const STORE = 'tracks';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const putAudio = (songId: string, file: Blob) => run('readwrite', (s) => s.put(file, songId)).then(() => undefined);
export const getAudio = (songId: string) => run<Blob | undefined>('readonly', (s) => s.get(songId) as IDBRequest<Blob | undefined>).catch(() => undefined);
export const deleteAudio = (songId: string) => run('readwrite', (s) => s.delete(songId)).then(() => undefined).catch(() => undefined);

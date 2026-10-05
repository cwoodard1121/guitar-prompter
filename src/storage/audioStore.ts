/**
 * Audio files (mp3 etc.) live in IndexedDB on this device, keyed by song id.
 * They're too big for localStorage. When signed in they're also uploaded to
 * Supabase Storage (see audioSync.ts); `rev` tells which version a copy is.
 */
const DB = 'gp-audio';
const STORE = 'tracks';

export interface LocalAudio {
  blob: Blob;
  /** Matches song.audio.rev when this is the current file (undefined for files saved before sync existed). */
  rev?: string;
}

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

export const putAudio = (songId: string, blob: Blob, rev?: string) =>
  run('readwrite', (s) => s.put({ blob, rev } satisfies LocalAudio, songId)).then(() => undefined);

export const getAudio = (songId: string): Promise<LocalAudio | undefined> =>
  run<unknown>('readonly', (s) => s.get(songId))
    .then((v) => (v instanceof Blob ? { blob: v } : (v as LocalAudio | undefined))) // older saves stored the bare Blob
    .catch(() => undefined);

export const deleteAudio = (songId: string) => run('readwrite', (s) => s.delete(songId)).then(() => undefined).catch(() => undefined);

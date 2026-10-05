import type { Song } from '../model/types';
import { repairSong } from '../model/song';

/**
 * Persistence = an always-on local cache (localStorage) plus an optional remote.
 * The remote is an interface so the claude.ai artifact store can later be swapped
 * for Supabase (or anything else) without touching the editor.
 */
export interface RemoteStore {
  readonly name: string;
  list(): Promise<Song[]>;
  put(song: Song): Promise<void>;
  remove(id: string): Promise<void>;
}

const KEY = 'gp:songs:v1';

function readLocal(): Record<string, Song> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLocal(all: Record<string, Song>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked or full — the remote (if any) still has it */
  }
}

export function loadLocalSongs(): Song[] {
  return Object.values(readLocal()).map(repairSong).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveLocal(song: Song) {
  const all = readLocal();
  all[song.id] = song;
  writeLocal(all);
}

export function deleteLocal(id: string) {
  const all = readLocal();
  delete all[id];
  writeLocal(all);
}

/* ------------------------------------------------------------- remote sync */

let remote: RemoteStore | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<void>>();
const pending = new Map<string, Song>();
type Listener = (s: SyncState) => void;
export type SyncState = 'local' | 'syncing' | 'synced' | 'error';
let syncState: SyncState = 'local';
const listeners = new Set<Listener>();
const setSync = (s: SyncState) => {
  syncState = s;
  listeners.forEach((l) => l(s));
};
export const onSync = (l: Listener) => (listeners.add(l), l(syncState), () => void listeners.delete(l));

/** Connects a remote, merges both sides (newest wins) and returns the merged list. */
export async function connectRemote(r: RemoteStore): Promise<Song[] | null> {
  try {
    setSync('syncing');
    const remoteSongs = await r.list();
    remote = r;
    const local = readLocal();
    const merged: Record<string, Song> = { ...local };
    const pushUp: Song[] = [];
    for (const s of remoteSongs) {
      const l = local[s.id];
      if (!l || s.updatedAt > l.updatedAt) merged[s.id] = repairSong(s);
    }
    for (const l of Object.values(local)) {
      const s = remoteSongs.find((x) => x.id === l.id);
      if (!s || l.updatedAt > s.updatedAt) pushUp.push(l);
    }
    writeLocal(merged);
    for (const s of pushUp) await r.put(s);
    setSync('synced');
    return Object.values(merged).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    setSync('error');
    return null;
  }
}

/** Debounced, one-write-at-a-time-per-song remote save. */
export function queueRemoteSave(song: Song) {
  if (!remote) return;
  pending.set(song.id, song);
  clearTimeout(timers.get(song.id));
  timers.set(song.id, setTimeout(() => flush(song.id), 1200));
}

async function flush(id: string) {
  if (!remote) return;
  if (inflight.has(id)) {
    await inflight.get(id);
    return flush(id);
  }
  const song = pending.get(id);
  if (!song) return;
  pending.delete(id);
  setSync('syncing');
  const p = remote
    .put(song)
    .then(() => setSync(pending.size ? 'syncing' : 'synced'))
    .catch(() => setSync('error'))
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  await p;
}

export async function remoteDelete(id: string) {
  pending.delete(id);
  clearTimeout(timers.get(id));
  try {
    await remote?.remove(id);
  } catch {
    setSync('error');
  }
}

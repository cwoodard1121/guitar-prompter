import type { Song } from '../model/types';
import { repairSong } from '../model/song';
import { planSync, type RemoteMeta } from './sync';

/**
 * Persistence = an always-on local copy (localStorage) plus an optional remote.
 * The remote is an interface so the editor never knows (or cares) where songs sync to.
 */
export interface RemoteStore {
  /** id / updatedAt / deletedAt for every song the remote knows. */
  meta(): Promise<RemoteMeta[]>;
  fetch(ids: string[]): Promise<Song[]>;
  put(song: Song): Promise<void>;
  markDeleted(id: string, at: number): Promise<void>;
}

const KEY = 'gp:songs:v1';
const TOMBSTONES = 'gp:deleted:v1';

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full — the remote (if any) still has it */
  }
}

const readLocal = () => read<Record<string, Song>>(KEY, {});
const readTombstones = () => read<Record<string, number>>(TOMBSTONES, {});

export function loadLocalSongs(): Song[] {
  return Object.values(readLocal()).map(repairSong).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveLocal(song: Song) {
  const all = readLocal();
  all[song.id] = song;
  write(KEY, all);
}

/** Removes a song here and remembers the delete so the next sync sends it on. */
export function deleteLocal(id: string, at = Date.now()) {
  const all = readLocal();
  delete all[id];
  write(KEY, all);
  const t = readTombstones();
  t[id] = at;
  write(TOMBSTONES, t);
}

/* ------------------------------------------------------------- remote sync */

let remote: RemoteStore | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inflight = new Map<string, Promise<void>>();
const pending = new Map<string, Song>();

export type SyncState = 'off' | 'syncing' | 'synced' | 'error';
type Listener = (s: SyncState) => void;
let syncState: SyncState = 'off';
const listeners = new Set<Listener>();
const setSync = (s: SyncState) => {
  syncState = s;
  listeners.forEach((l) => l(s));
};
export const onSync = (l: Listener) => (listeners.add(l), l(syncState), () => void listeners.delete(l));

export function setRemote(r: RemoteStore | null) {
  remote = r;
  setSync(r ? 'syncing' : 'off');
}

let running: Promise<Song[] | null> | null = null;

/**
 * Two-way sync with the remote. Returns the merged library (newest first),
 * or null when there is no remote or the sync failed (local copy untouched).
 */
export function syncNow(): Promise<Song[] | null> {
  if (!remote) return Promise.resolve(null);
  running ??= (async () => {
    const r = remote!;
    try {
      setSync('syncing');
      const plan = planSync(Object.values(readLocal()), readTombstones(), await r.meta());
      const all = readLocal();
      const tomb = readTombstones();
      if (plan.pull.length) for (const s of await r.fetch(plan.pull)) all[s.id] = repairSong(s);
      for (const d of plan.dropLocal) delete all[d.id];
      for (const id of plan.clearTombstones) delete tomb[id];
      for (const s of plan.push) await r.put(s);
      for (const d of plan.pushDelete) {
        await r.markDeleted(d.id, d.at);
        delete tomb[d.id];
      }
      write(KEY, all);
      write(TOMBSTONES, tomb);
      setSync(pending.size ? 'syncing' : 'synced');
      return Object.values(all).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      console.warn('sync failed', e);
      setSync('error');
      return null;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Debounced, one-write-at-a-time-per-song remote save. */
export function queueRemoteSave(song: Song) {
  if (!remote) return;
  pending.set(song.id, song);
  clearTimeout(timers.get(song.id));
  timers.set(song.id, setTimeout(() => void flush(song.id), 1200));
}

async function flush(id: string): Promise<void> {
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
    .catch((e) => {
      console.warn('save failed', e);
      setSync('error'); // the local copy is newer, so the next syncNow() pushes it
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  await p;
}

export async function remoteDelete(id: string, at: number) {
  pending.delete(id);
  clearTimeout(timers.get(id));
  if (!remote) return;
  try {
    await remote.markDeleted(id, at);
    const t = readTombstones();
    delete t[id];
    write(TOMBSTONES, t);
  } catch {
    setSync('error'); // tombstone stays; the next sync retries it
  }
}

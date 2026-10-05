import type { Setlist, Song } from '../model/types';
import { repairSong } from '../model/song';
import { planSync, type RemoteMeta, type Synced } from './sync';

/**
 * Persistence = an always-on local copy (localStorage) plus an optional remote.
 * The remote is an interface so the editor never knows (or cares) where things sync to.
 * Songs and setlists are two collections run by the same code.
 */
export interface RemoteStore<T extends Synced> {
  /** id / updatedAt / deletedAt for every item the remote knows. */
  meta(): Promise<RemoteMeta[]>;
  fetch(ids: string[]): Promise<T[]>;
  put(item: T): Promise<void>;
  markDeleted(id: string, at: number): Promise<void>;
}

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
    /* storage blocked or full; the remote (if any) still has it */
  }
}

/* -------------------------------------------------------- sync status (all collections) */

export type SyncState = 'off' | 'syncing' | 'synced' | 'error';
type Listener = (s: SyncState) => void;
let syncState: SyncState = 'off';
const listeners = new Set<Listener>();
const setSync = (s: SyncState) => {
  syncState = s;
  listeners.forEach((l) => l(s));
};
export const onSync = (l: Listener) => (listeners.add(l), l(syncState), () => void listeners.delete(l));

const all: Collection<Synced>[] = [];
const busy = () => all.some((c) => c.busy());

/* ------------------------------------------------------------------ collection */

export interface Collection<T extends Synced> {
  loadLocal(): T[];
  /** Saves an item unless storage already holds a newer copy (e.g. written by another tab). */
  saveLocal(item: T): void;
  /** Removes an item here and remembers the delete so the next sync sends it on. */
  deleteLocal(id: string, at?: number): void;
  /** Brings a deleted item back (Undo): forgets its tombstone so sync sends it again. */
  restoreLocal(item: T): void;
  /** Calls back when another tab changes this collection. */
  onOtherTabChange(cb: () => void): () => void;
  setRemote(r: RemoteStore<T> | null): void;
  /** Two-way sync. Returns the merged list (newest first), or null with no remote / on failure. */
  syncNow(): Promise<T[] | null>;
  /** Debounced, one-write-at-a-time-per-item remote save. */
  queueRemoteSave(item: T): void;
  remoteDelete(id: string, at: number): Promise<void>;
  busy(): boolean;
}

export function collection<T extends Synced>(key: string, tombKey: string, repair: (x: T) => T = (x) => x): Collection<T> {
  const readLocal = () => read<Record<string, T>>(key, {});
  const readTombstones = () => read<Record<string, number>>(tombKey, {});
  let remote: RemoteStore<T> | null = null;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const inflight = new Map<string, Promise<void>>();
  const pending = new Map<string, T>();
  let running: Promise<T[] | null> | null = null;
  const done = () => setSync(busy() ? 'syncing' : 'synced');

  async function flush(id: string): Promise<void> {
    if (!remote) return;
    if (inflight.has(id)) {
      await inflight.get(id);
      return flush(id);
    }
    const item = pending.get(id);
    if (!item) return;
    pending.delete(id);
    setSync('syncing');
    const p = remote
      .put(item)
      .then(done)
      .catch((e) => {
        console.warn('save failed', e);
        setSync('error'); // the local copy is newer, so the next syncNow() pushes it
      })
      .finally(() => inflight.delete(id));
    inflight.set(id, p);
    await p;
  }

  const c: Collection<T> = {
    loadLocal: () => Object.values(readLocal()).map(repair).sort((a, b) => b.updatedAt - a.updatedAt),

    saveLocal(item) {
      const items = readLocal();
      const there = items[item.id];
      if (there && there.updatedAt > item.updatedAt) return;
      items[item.id] = item;
      write(key, items);
    },

    deleteLocal(id, at = Date.now()) {
      const items = readLocal();
      delete items[id];
      write(key, items);
      const t = readTombstones();
      t[id] = at;
      write(tombKey, t);
    },

    restoreLocal(item) {
      const t = readTombstones();
      delete t[item.id];
      write(tombKey, t);
      c.saveLocal(item);
    },

    onOtherTabChange(cb) {
      const h = (e: StorageEvent) => e.key === key && cb();
      window.addEventListener('storage', h);
      return () => window.removeEventListener('storage', h);
    },

    setRemote(r) {
      remote = r;
      setSync(r ? 'syncing' : 'off');
    },

    syncNow() {
      if (!remote) return Promise.resolve(null);
      running ??= (async () => {
        const r = remote!;
        try {
          setSync('syncing');
          const plan = planSync(Object.values(readLocal()), readTombstones(), await r.meta());
          const items = readLocal();
          const tomb = readTombstones();
          if (plan.pull.length) for (const s of await r.fetch(plan.pull)) items[s.id] = repair(s);
          for (const d of plan.dropLocal) delete items[d.id];
          for (const id of plan.clearTombstones) delete tomb[id];
          for (const s of plan.push) await r.put(s);
          for (const d of plan.pushDelete) {
            await r.markDeleted(d.id, d.at);
            delete tomb[d.id];
          }
          write(key, items);
          write(tombKey, tomb);
          running = null;
          done();
          return Object.values(items).sort((a, b) => b.updatedAt - a.updatedAt);
        } catch (e) {
          console.warn('sync failed', e);
          setSync('error');
          return null;
        } finally {
          running = null;
        }
      })();
      return running;
    },

    queueRemoteSave(item) {
      if (!remote) return;
      pending.set(item.id, item);
      clearTimeout(timers.get(item.id));
      timers.set(item.id, setTimeout(() => void flush(item.id), 1200));
    },

    async remoteDelete(id, at) {
      pending.delete(id);
      clearTimeout(timers.get(id));
      if (!remote) return;
      try {
        await remote.markDeleted(id, at);
        const t = readTombstones();
        delete t[id];
        write(tombKey, t);
      } catch {
        setSync('error'); // tombstone stays; the next sync retries it
      }
    },

    busy: () => !!running || pending.size > 0 || inflight.size > 0,
  };
  all.push(c as unknown as Collection<Synced>);
  return c;
}

/* ------------------------------------------------------------------ the two collections */

export const songs = collection<Song>('gp:songs:v1', 'gp:deleted:v1', repairSong);
export const setlists = collection<Setlist>('gp:setlists:v1', 'gp:setlists-deleted:v1', (s) => ({ ...s, songIds: s.songIds ?? [] }));

// song shorthands used across the app
export const loadLocalSongs = songs.loadLocal;
export const saveLocal = songs.saveLocal;
export const deleteLocal = songs.deleteLocal;
export const restoreLocal = songs.restoreLocal;
export const onOtherTabChange = songs.onOtherTabChange;
export const queueRemoteSave = songs.queueRemoteSave;
export const remoteDelete = songs.remoteDelete;
export const syncNow = songs.syncNow;

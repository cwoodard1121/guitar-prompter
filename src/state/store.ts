import { create } from 'zustand';
import type { Cursor, Dur, Song } from '../model/types';
import { newSong, normalizeCursor, repairSong, type ChordStep } from '../model/song';
import { deleteLocal, loadLocalSongs, queueRemoteSave, remoteDelete, saveLocal } from '../storage/storage';

export type CapoView = 'shapes' | 'concert';

interface State {
  library: Song[];
  song: Song;
  cursor: Cursor;
  dur: Dur;
  dotted: boolean;
  stack: boolean;
  chordStep: ChordStep;
  /** `shapes` = what you finger with the capo on; `concert` = the real chords/frets with no capo. */
  capoView: CapoView;
  focusOnly: boolean;
  past: Song[];
  future: Song[];
  /** Beat index per part currently sounding during playback (null = stopped). */
  playhead: Record<string, { bar: number; beat: number }> | null;

  edit: (fn: (draft: Song, cursor: Cursor) => Cursor | void) => void;
  setCursor: (c: Partial<Cursor>) => void;
  undo: () => void;
  redo: () => void;
  set: (p: Partial<Pick<State, 'dur' | 'dotted' | 'stack' | 'chordStep' | 'capoView' | 'focusOnly' | 'playhead'>>) => void;
  openSong: (id: string) => void;
  createSong: () => void;
  importSong: (song: Song) => void;
  deleteSong: (id: string) => void;
  replaceLibrary: (songs: Song[]) => void;
}

const LAST = 'gp:last-song';
const clone = <T,>(x: T): T => structuredClone(x);
const firstCursor = (song: Song): Cursor => ({
  partId: song.parts.find((p) => p.kind === 'tab')?.id ?? song.parts[0].id,
  bar: 0,
  beat: 0,
  string: 0,
});

function persist(song: Song) {
  saveLocal(song);
  queueRemoteSave(song);
}

function initial() {
  const library = loadLocalSongs();
  let lastId: string | null = null;
  try {
    lastId = localStorage.getItem(LAST);
  } catch {
    /* ignore */
  }
  let song = library.find((s) => s.id === lastId) ?? library[0];
  if (!song) {
    song = newSong('My first song');
    library.push(song);
    persist(song);
  }
  return { library, song, cursor: firstCursor(song) };
}

const rememberLast = (id: string) => {
  try {
    localStorage.setItem(LAST, id);
  } catch {
    /* ignore */
  }
};

export const useStore = create<State>((set, get) => ({
  ...initial(),
  dur: 8,
  dotted: false,
  stack: false,
  chordStep: 'bar',
  capoView: 'shapes',
  focusOnly: false,
  past: [],
  future: [],
  playhead: null,

  edit(fn) {
    const { song, cursor, past, library } = get();
    const draft = clone(song);
    const next = fn(draft, cursor) ?? cursor;
    draft.updatedAt = Date.now();
    const cur = normalizeCursor(draft, next);
    persist(draft);
    set({
      song: draft,
      cursor: cur,
      past: [...past.slice(-199), song],
      future: [],
      library: library.map((s) => (s.id === draft.id ? draft : s)),
    });
  },

  setCursor(c) {
    const { song, cursor } = get();
    set({ cursor: normalizeCursor(song, { ...cursor, ...c }) });
  },

  undo() {
    const { past, song, future, cursor, library } = get();
    const prev = past[past.length - 1];
    if (!prev) return;
    const restored = { ...prev, updatedAt: Date.now() };
    persist(restored);
    set({
      song: restored,
      past: past.slice(0, -1),
      future: [song, ...future],
      cursor: normalizeCursor(clone(restored), cursor),
      library: library.map((s) => (s.id === restored.id ? restored : s)),
    });
  },

  redo() {
    const { past, song, future, cursor, library } = get();
    const nxt = future[0];
    if (!nxt) return;
    const restored = { ...nxt, updatedAt: Date.now() };
    persist(restored);
    set({
      song: restored,
      past: [...past, song],
      future: future.slice(1),
      cursor: normalizeCursor(clone(restored), cursor),
      library: library.map((s) => (s.id === restored.id ? restored : s)),
    });
  },

  set: (p) => set(p),

  openSong(id) {
    const s = get().library.find((x) => x.id === id);
    if (!s) return;
    rememberLast(id);
    set({ song: s, cursor: firstCursor(s), past: [], future: [], playhead: null });
  },

  createSong() {
    const s = newSong();
    persist(s);
    rememberLast(s.id);
    set({ library: [s, ...get().library], song: s, cursor: firstCursor(s), past: [], future: [] });
  },

  importSong(raw) {
    const s = repairSong({ ...raw, updatedAt: Date.now() });
    persist(s);
    rememberLast(s.id);
    set({
      library: [s, ...get().library.filter((x) => x.id !== s.id)],
      song: s,
      cursor: firstCursor(s),
      past: [],
      future: [],
    });
  },

  deleteSong(id) {
    deleteLocal(id);
    void remoteDelete(id);
    const library = get().library.filter((s) => s.id !== id);
    if (!library.length) library.push(newSong());
    const song = get().song.id === id ? library[0] : get().song;
    persist(song);
    rememberLast(song.id);
    set({ library, song, cursor: firstCursor(song), past: [], future: [] });
  },

  replaceLibrary(songs) {
    const current = songs.find((s) => s.id === get().song.id);
    const lastId = (() => {
      try {
        return localStorage.getItem(LAST);
      } catch {
        return null;
      }
    })();
    const song = current ?? songs.find((s) => s.id === lastId) ?? get().song;
    set({
      library: songs.length ? songs : [song],
      song,
      cursor: song === get().song ? get().cursor : firstCursor(song),
    });
  },
}));

export const focusedPart = (s: Pick<State, 'song' | 'cursor'>) =>
  s.song.parts.find((p) => p.id === s.cursor.partId) ?? s.song.parts[0];

import { create } from 'zustand';
import type { Cursor, Dur, Song } from '../model/types';
import { cursorNeedsBar, newSong, normalizeCursor, repairSong, type ChordStep } from '../model/song';
import { deleteLocal, loadLocalSongs, queueRemoteSave, remoteDelete, restoreLocal, saveLocal } from '../storage/storage';
import { copySong, copyTitle } from '../model/library';

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
  /** Tap-rhythm panel open (its keys take over the keyboard). */
  tapping: boolean;
  tapOpen: boolean;
  /** Playback speed (1 = song tempo). The recording keeps its pitch. */
  speed: number;
  /** Loop this many bars from the cursor while playing (0 = off). */
  loopBars: number;
  /** Hear the synth playing the tab/chords (off = just the recording + metronome). */
  synthOn: boolean;

  edit: (fn: (draft: Song, cursor: Cursor) => Cursor | void) => void;
  setCursor: (c: Partial<Cursor>) => void;
  undo: () => void;
  redo: () => void;
  set: (p: Partial<Pick<State, 'dur' | 'dotted' | 'stack' | 'chordStep' | 'capoView' | 'focusOnly' | 'playhead' | 'tapping' | 'tapOpen' | 'speed' | 'loopBars' | 'synthOn'>>) => void;
  openSong: (id: string) => void;
  /** Makes a new song and opens it; returns its id. */
  createSong: () => string;
  importSong: (song: Song) => void;
  /** Adds songs to the library without opening them (multi-file import). */
  addSongs: (songs: Song[]) => void;
  /** Copies a song (fresh ids) next to the original; returns the copy's id. */
  duplicateSong: (id: string) => string | null;
  /** Deletes a song; returns it so the caller can offer Undo via restoreSong. */
  deleteSong: (id: string) => Song | null;
  restoreSong: (song: Song) => void;
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
  tapping: false,
  tapOpen: false,
  speed: 1,
  loopBars: 0,
  synthOn: true,

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
      // an unsaved blank joins the library on its first edit
      library: library.some((s) => s.id === draft.id) ? library.map((s) => (s.id === draft.id ? draft : s)) : [draft, ...library],
    });
  },

  setCursor(c) {
    const { song, cursor } = get();
    const next = { ...cursor, ...c };
    // Walking past the last full bar adds a bar â€” that's an edit, so it goes through history.
    if (cursorNeedsBar(song, next)) return get().edit(() => next);
    set({ cursor: normalizeCursor(song, next, false) });
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
      cursor: normalizeCursor(restored, cursor, false),
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
      cursor: normalizeCursor(restored, cursor, false),
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
    return s.id;
  },

  addSongs(raw) {
    const now = Date.now();
    const added = raw.map((r, i) => repairSong({ ...r, updatedAt: now + i }));
    added.forEach(persist);
    const ids = new Set(added.map((s) => s.id));
    set({ library: [...added.reverse(), ...get().library.filter((x) => !ids.has(x.id))] });
  },

  duplicateSong(id) {
    const { library } = get();
    const src = id === get().song.id ? get().song : library.find((s) => s.id === id);
    if (!src) return null;
    const copy = copySong(src, copyTitle(src.title, library.map((s) => s.title)));
    persist(copy);
    set({ library: [copy, ...library] });
    return copy.id;
  },

  restoreSong(song) {
    const s = { ...song, updatedAt: Date.now() };
    restoreLocal(s);
    queueRemoteSave(s);
    set({ library: [s, ...get().library.filter((x) => x.id !== s.id)] });
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
    const gone = get().library.find((s) => s.id === id) ?? null;
    const at = Date.now();
    deleteLocal(id, at);
    void remoteDelete(id, at);
    const library = get().library.filter((s) => s.id !== id);
    if (get().song.id !== id) {
      set({ library });
      return gone;
    }
    // The open song went away. Fall back to the next one, or an unsaved blank that
    // only reaches storage if it's edited (the library stays empty until then).
    const song = library[0] ?? newSong();
    rememberLast(song.id);
    set({ library, song, cursor: firstCursor(song), past: [], future: [], playhead: null });
    return gone;
  },

  /** Applies a synced library: keeps the open song (taking the remote copy if it's newer), or moves on if it was deleted elsewhere. */
  replaceLibrary(songs) {
    const open = get().song;
    const synced = songs.find((s) => s.id === open.id);
    if (synced) {
      // newest wins: never let an older copy (another tab, a slow sync) replace newer work
      const song = synced.updatedAt > open.updatedAt ? synced : open;
      if (song === open && synced.updatedAt < open.updatedAt) persist(open);
      set({ library: songs.map((s) => (s.id === song.id ? song : s)), song, cursor: normalizeCursor(song, get().cursor, false) });
      return;
    }
    const next = songs[0] ?? newSong(); // unsaved blank when everything was deleted elsewhere
    rememberLast(next.id);
    set({ library: songs, song: next, cursor: firstCursor(next), past: [], future: [] });
  },
}));

export const focusedPart = (s: Pick<State, 'song' | 'cursor'>) =>
  s.song.parts.find((p) => p.id === s.cursor.partId) ?? s.song.parts[0];

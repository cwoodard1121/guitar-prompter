import { create } from 'zustand';
import type { Setlist } from '../model/types';
import { moveItem, newSetlist } from '../model/setlist';
import { setlists as store } from '../storage/storage';

interface State {
  sets: Setlist[];
  /** Makes a setlist and returns its id. */
  create: (name?: string, songIds?: string[]) => string;
  rename: (id: string, name: string) => void;
  addSongs: (id: string, songIds: string[]) => void;
  removeAt: (id: string, index: number) => void;
  move: (id: string, from: number, to: number) => void;
  /** Deletes a setlist; returns it for Undo via restore. */
  remove: (id: string) => Setlist | null;
  restore: (set: Setlist) => void;
  /** Applies a synced (or other-tab) list. */
  replace: (sets: Setlist[]) => void;
}

const save = (s: Setlist) => {
  store.saveLocal(s);
  store.queueRemoteSave(s);
};

export const useSetlists = create<State>((set, get) => {
  /** Changes one setlist and saves it. */
  const change = (id: string, fn: (s: Setlist) => Setlist) => {
    const cur = get().sets.find((s) => s.id === id);
    if (!cur) return;
    const next = { ...fn(cur), updatedAt: Date.now() };
    save(next);
    set({ sets: get().sets.map((s) => (s.id === id ? next : s)) });
  };

  return {
    sets: store.loadLocal(),

    create(name, songIds) {
      const s = newSetlist(name, songIds);
      save(s);
      set({ sets: [s, ...get().sets] });
      return s.id;
    },
    rename: (id, name) => change(id, (s) => ({ ...s, name })),
    addSongs: (id, songIds) => change(id, (s) => ({ ...s, songIds: [...s.songIds, ...songIds] })),
    removeAt: (id, index) => change(id, (s) => ({ ...s, songIds: s.songIds.filter((_, i) => i !== index) })),
    move: (id, from, to) => change(id, (s) => ({ ...s, songIds: moveItem(s.songIds, from, to) })),

    remove(id) {
      const gone = get().sets.find((s) => s.id === id) ?? null;
      const at = Date.now();
      store.deleteLocal(id, at);
      void store.remoteDelete(id, at);
      set({ sets: get().sets.filter((s) => s.id !== id) });
      return gone;
    },
    restore(s) {
      const back = { ...s, updatedAt: Date.now() };
      store.restoreLocal(back);
      store.queueRemoteSave(back);
      set({ sets: [back, ...get().sets.filter((x) => x.id !== s.id)] });
    },
    replace: (sets) => set({ sets }),
  };
});

import type { Setlist, Song } from './types';
import { uid } from './song';

export function newSetlist(name = 'New setlist', songIds: string[] = []): Setlist {
  const now = Date.now();
  return { id: uid(), name, songIds, createdAt: now, updatedAt: now };
}

/** Moves one item to a new index (drag-and-drop / move up-down). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x);
  return out;
}

export interface SetEntry {
  index: number;
  songId: string;
  /** Null when the song was deleted (or hasn't synced to this device yet). */
  song: Song | null;
}

export function setEntries(set: Setlist, library: Song[]): SetEntry[] {
  const byId = new Map(library.map((s) => [s.id, s]));
  return set.songIds.map((songId, index) => ({ index, songId, song: byId.get(songId) ?? null }));
}

/**
 * The playable songs around position `index` in a set (missing songs are skipped),
 * and where `index` sits among the playable ones.
 */
export function setNeighbours(set: Setlist, library: Song[], index: number) {
  const entries = setEntries(set, library);
  const playable = entries.filter((e) => e.song);
  const prev = [...entries.slice(0, index)].reverse().find((e) => e.song) ?? null;
  const next = entries.slice(index + 1).find((e) => e.song) ?? null;
  const position = playable.findIndex((e) => e.index === index);
  return { prev, next, position: position + 1, total: playable.length };
}

/** "3 songs · 14 min"–style summary; minutes estimated from bars × tempo. */
export function setSummary(set: Setlist, library: Song[]): string {
  const entries = setEntries(set, library);
  const songs = entries.filter((e) => e.song).map((e) => e.song!);
  const missing = entries.length - songs.length;
  const secs = songs.reduce((t, s) => {
    const bars = s.parts[0]?.bars.length ?? 0;
    const beatsPerBar = s.timeSig[0] * (4 / s.timeSig[1]);
    const plays = bars + (s.repeats ?? []).reduce((n, r) => n + (r.end - r.start + 1) * (r.times - 1), 0);
    return t + (plays * beatsPerBar * 60) / s.tempo;
  }, 0);
  const parts = [`${songs.length} song${songs.length === 1 ? '' : 's'}`];
  if (secs >= 60) parts.push(`~${Math.round(secs / 60)} min`);
  if (missing) parts.push(`${missing} missing`);
  return parts.join(' · ');
}

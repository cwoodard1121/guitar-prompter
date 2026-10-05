import type { Song } from './types';
import { repairSong, uid } from './song';

export type SongSort = 'recent' | 'title' | 'artist';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Songs whose title or artist contain every word of the query (accents and case ignored). */
export function searchSongs(songs: Song[], query: string): Song[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return songs;
  return songs.filter((s) => {
    const hay = fold(`${s.title} ${s.artist}`);
    return words.every((w) => hay.includes(w));
  });
}

export function sortSongs(songs: Song[], by: SongSort): Song[] {
  const name = (s: string) => fold(s.trim()) || '￿'; // blanks sort last
  const out = [...songs];
  if (by === 'recent') out.sort((a, b) => b.updatedAt - a.updatedAt);
  else if (by === 'title') out.sort((a, b) => name(a.title).localeCompare(name(b.title)) || b.updatedAt - a.updatedAt);
  else out.sort((a, b) => name(a.artist).localeCompare(name(b.artist)) || name(a.title).localeCompare(name(b.title)));
  return out;
}

/**
 * A full, independent copy: new song, part and beat ids, so editing (or syncing)
 * one never touches the other. Recordings stay with the original.
 */
export function copySong(song: Song, title = song.title): Song {
  const now = Date.now();
  const copy: Song = structuredClone(song);
  copy.id = uid();
  copy.title = title;
  copy.createdAt = now;
  copy.updatedAt = now;
  delete copy.audio;
  for (const p of copy.parts) {
    p.id = uid();
    for (const bar of p.bars) for (const b of bar.beats) b.id = uid();
  }
  return repairSong(copy);
}

/** "Wonderwall (copy)", then "(copy 2)"… */
export function copyTitle(title: string, taken: string[]): string {
  const base = title.replace(/ \(copy(?: \d+)?\)$/, '') || 'Untitled';
  let t = `${base} (copy)`;
  for (let n = 2; taken.includes(t); n++) t = `${base} (copy ${n})`;
  return t;
}

/** Short relative time for the library ("just now", "5m", "3h", "2d", then a date). */
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: s > 86400 * 300 ? 'numeric' : undefined });
}

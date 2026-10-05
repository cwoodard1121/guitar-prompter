import type { Song } from '../model/types';
import { repairSong } from '../model/song';
import { saveFile } from './download';

const slug = (s: string) => s.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'song';

export function exportSong(song: Song) {
  saveFile(`${slug(song.title)}.json`, JSON.stringify({ app: 'guitarprompter', version: 1, song }, null, 2));
}

/** Reads a song from an exported file (or a bare Song object). Throws when it isn't one. */
export function parseSongFile(text: string): Song {
  const raw = JSON.parse(text);
  const s: Song = raw?.song ?? raw;
  if (!s || typeof s.id !== 'string' || !Array.isArray(s.parts) || !s.parts.length) throw new Error('not a song');
  return repairSong(s);
}

/** Lets the user pick one or more files; resolves with their names and text (empty if cancelled). */
export function pickTextFiles(accept = '.json,application/json'): Promise<{ name: string; text: string }[]> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept, multiple: true });
    input.onchange = async () => resolve(await Promise.all([...(input.files ?? [])].map(async (f) => ({ name: f.name, text: await f.text() }))));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

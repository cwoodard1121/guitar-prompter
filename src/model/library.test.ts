import { describe, expect, it } from 'vitest';
import { ago, copySong, copyTitle, searchSongs, sortSongs } from './library';
import { newSong, placeNote } from './song';
import { parseRoute, routeHref, type Route } from '../ui/router';

const song = (title: string, artist: string, updatedAt: number) => ({ ...newSong(title), artist, updatedAt });

describe('library', () => {
  const songs = [song('Wonderwall', 'Oasis', 1), song('Blackbird', 'The Beatles', 3), song('Señorita', '', 2)];

  it('searches title and artist, every word, ignoring case and accents', () => {
    expect(searchSongs(songs, 'beatles bird').map((s) => s.title)).toEqual(['Blackbird']);
    expect(searchSongs(songs, 'senor').map((s) => s.title)).toEqual(['Señorita']);
    expect(searchSongs(songs, '  ')).toHaveLength(3);
  });

  it('sorts by recent, title and artist (blank artists last)', () => {
    expect(sortSongs(songs, 'recent').map((s) => s.title)).toEqual(['Blackbird', 'Señorita', 'Wonderwall']);
    expect(sortSongs(songs, 'title').map((s) => s.title)).toEqual(['Blackbird', 'Señorita', 'Wonderwall']);
    expect(sortSongs(songs, 'artist').map((s) => s.artist)).toEqual(['Oasis', 'The Beatles', '']);
  });

  it('copies a song with fresh ids and the same music', () => {
    const a = newSong('Riff');
    const tab = a.parts.find((p) => p.kind === 'tab')!;
    placeNote(a, { partId: tab.id, bar: 0, beat: 0, string: 0 }, 1, 3, { dur: 8, dotted: false, stack: false });
    a.audio = { name: 'take.mp3', offset: 1, volume: 1 };
    const b = copySong(a, 'Riff (copy)');
    expect(b.id).not.toBe(a.id);
    expect(b.title).toBe('Riff (copy)');
    expect(b.audio).toBeUndefined();
    expect(b.parts.map((p) => p.id)).not.toEqual(a.parts.map((p) => p.id));
    const bt = b.parts.find((p) => p.kind === 'tab')!;
    expect(bt.bars[0].beats[0].notes).toEqual([{ string: 1, fret: 3 }]);
    expect(bt.bars[0].beats[0].id).not.toBe(tab.bars[0].beats[0].id);
    b.parts[0].name = 'changed';
    expect(a.parts[0].name).not.toBe('changed');
  });

  it('numbers copy titles', () => {
    expect(copyTitle('Riff', [])).toBe('Riff (copy)');
    expect(copyTitle('Riff (copy)', ['Riff (copy)'])).toBe('Riff (copy 2)');
  });

  it('formats relative times', () => {
    expect(ago(1000, 2000)).toBe('just now');
    expect(ago(0, 5 * 60_000)).toBe('5m ago');
    expect(ago(0, 3 * 3_600_000)).toBe('3h ago');
  });
});

describe('router', () => {
  const routes: Route[] = [
    { name: 'library', tab: 'songs' },
    { name: 'library', tab: 'sets' },
    { name: 'song', id: 'abc-1' },
    { name: 'play', id: 'abc' },
    { name: 'play', id: 'abc', set: 's1' },
    { name: 'set', id: 's1' },
    { name: 'share', token: 'Tok_en-123' },
  ];
  it('round-trips every route', () => {
    for (const r of routes) expect(parseRoute(routeHref(r))).toEqual(r);
  });
  it('falls back to the library for anything else', () => {
    expect(parseRoute('')).toEqual({ name: 'library', tab: 'songs' });
    expect(parseRoute('#error=access_denied&x=1')).toEqual({ name: 'library', tab: 'songs' });
    expect(parseRoute('#/song/')).toEqual({ name: 'library', tab: 'songs' });
  });
});

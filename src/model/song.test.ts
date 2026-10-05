import { describe, expect, it } from 'vitest';
import { barCount, cursorNeedsBar, newSong, normalizeCursor, placeNote } from './song';
import { onsetsToBars } from './rhythm';
import type { Cursor, Song } from './types';

const tabCursor = (s: Song): Cursor => ({ partId: s.parts.find((p) => p.kind === 'tab')!.id, bar: 0, beat: 0, string: 0 });
const eighths = { dur: 8 as const, dotted: false, stack: false };

describe('note entry', () => {
  it('eight taps in a row fill one 4/4 bar with eighths and move to the next bar', () => {
    const s = newSong();
    let c = tabCursor(s);
    for (let i = 0; i < 8; i++) c = normalizeCursor(s, placeNote(s, c, i % 6, i, eighths));
    const tab = s.parts.find((p) => p.kind === 'tab')!;
    expect(tab.bars[0].beats.map((b) => b.dur)).toEqual([8, 8, 8, 8, 8, 8, 8, 8]);
    expect(tab.bars[0].beats.map((b) => b.notes[0].fret)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(c.bar).toBe(1);
    expect(c.beat).toBe(0);
  });

  it('keeps going past the last bar, adding bars to every part', () => {
    const s = newSong();
    let c = tabCursor(s);
    const start = barCount(s);
    for (let i = 0; i < 8 * start + 3; i++) c = normalizeCursor(s, placeNote(s, c, 0, 3, eighths));
    expect(barCount(s)).toBeGreaterThan(start);
    expect(new Set(s.parts.map((p) => p.bars.length)).size).toBe(1); // parts stay registered
  });

  it('moving the cursor never changes the song by itself', () => {
    const s = newSong();
    const tab = s.parts.find((p) => p.kind === 'tab')!;
    let c = tabCursor(s);
    const fill = 8 * barCount(s);
    for (let i = 0; i < fill; i++) c = normalizeCursor(s, placeNote(s, c, 0, 0, eighths));
    const last = barCount(s) - 1;
    const before = JSON.stringify(s);
    const probe = { ...c, bar: last, beat: tab.bars[last].beats.length };
    expect(cursorNeedsBar(s, probe)).toBe(tab.bars[last].beats.length > 0);
    normalizeCursor(s, probe, false);
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('tap rhythm then fill', () => {
  it('fret taps fill tapped slots in order, skipping rests', () => {
    const s = newSong();
    const tab = s.parts.find((p) => p.kind === 'tab')!;
    // rest, then three onsets: r4 4. 8 4
    tab.bars[0] = onsetsToBars([16, 40, 48], 64, 1)[0];
    let c: Cursor = { ...tabCursor(s), beat: 1 }; // first slot
    for (const fret of [5, 7, 8]) c = normalizeCursor(s, placeNote(s, c, 1, fret, eighths));
    const b = tab.bars[0].beats;
    expect(b[0].rest).toBe(true);
    expect(b.slice(1).map((x) => x.notes[0]?.fret)).toEqual([5, 7, 8]);
    expect(b.slice(1).map((x) => x.dur)).toEqual([4, 8, 4]); // tapped rhythm kept
  });
});

import { describe, expect, it } from 'vitest';
import { notesToBars, onsetsToBars, quantize, quantizeTaps, splitTicks } from './rhythm';
import { beatTicks } from './song';

const BAR = 64; // 4/4
const sig = (bar: { beats: { dur: number; dotted: boolean; rest: boolean }[] }) =>
  bar.beats.map((b) => `${b.rest ? 'r' : ''}${b.dur}${b.dotted ? '.' : ''}`).join(' ');

describe('rhythm tapping', () => {
  it('splits spans into writable lengths', () => {
    expect(splitTicks(24)).toEqual([{ dur: 4, dotted: true }]);
    expect(splitTicks(40).map((s) => s.dur)).toEqual([2, 8]);
  });

  it('eight even taps make eight eighth notes', () => {
    const spt = 60 / 120 / 16; // 120 bpm
    const taps = Array.from({ length: 8 }, (_, i) => i * 0.25 + (i % 2 ? 0.02 : -0.015)); // sloppy human timing
    const onsets = quantize(taps, spt, 4);
    expect(onsets).toEqual([0, 8, 16, 24, 32, 40, 48, 56]);
    const [bar] = onsetsToBars(onsets, BAR, 1);
    expect(sig(bar)).toBe('8 8 8 8 8 8 8 8');
  });

  it('dotted rhythms and a late start', () => {
    // rest for a quarter, then dotted-quarter, eighth, half... fills exactly one bar
    const [bar] = onsetsToBars([16, 40, 48], BAR, 1);
    expect(sig(bar)).toBe('r4 4. 8 4');
    expect(bar.beats.reduce((t, b) => t + beatTicks(b), 0)).toBe(BAR);
  });

  it('holding sets the length and the gap after release becomes a rest', () => {
    const spt = 60 / 120 / 16; // 120 bpm: quarter = 0.5 s
    // hold a quarter on beat 1, let go for beat 2, quick taps on beats 3 and 4
    const notes = quantizeTaps(
      [
        { down: 0, up: 0.48 },
        { down: 1.0, up: 1.05 },
        { down: 1.5, up: null },
      ],
      spt,
      4,
    );
    const [bar] = notesToBars(notes, BAR, 1);
    expect(sig(bar)).toBe('4 r4 4 4');
  });

  it('quick taps still make plain eighths', () => {
    const spt = 60 / 120 / 16;
    const taps = Array.from({ length: 8 }, (_, i) => ({ down: i * 0.25, up: i * 0.25 + 0.06 }));
    const [bar] = notesToBars(quantizeTaps(taps, spt, 4), BAR, 1);
    expect(sig(bar)).toBe('8 8 8 8 8 8 8 8');
  });

  it('spreads taps over several bars and leaves silent bars empty', () => {
    const bars = onsetsToBars([0, 32, 128], BAR, 3);
    expect(sig(bars[0])).toBe('2 2');
    expect(bars[1].beats).toHaveLength(0);
    expect(sig(bars[2])).toBe('1');
  });
});

import { describe, expect, it } from 'vitest';
import { chartBars, defaultStagePart, sectionOf, sectionStarts, stepSection } from './stage';
import { addBarsAtEnd, newSong, placeChordName, setMarker, setRepeat } from './song';

function song() {
  const s = newSong('Stage');
  addBarsAtEnd(s, 4); // 12 bars
  setMarker(s, 0, 'Intro');
  setMarker(s, 4, 'Verse');
  setMarker(s, 8, 'Chorus');
  return s;
}

describe('stage sections', () => {
  it('lists section starts, always including the top', () => {
    const s = newSong();
    setMarker(s, 3, 'Verse');
    expect(sectionStarts(s)).toEqual([0, 3]);
  });

  it('finds the section a bar is in', () => {
    const s = song();
    expect(sectionOf(s, 0)).toBe(0);
    expect(sectionOf(s, 6)).toBe(4);
    expect(sectionOf(s, 11)).toBe(8);
  });

  it('pages forward to the next section and stops at the end', () => {
    const s = song();
    expect(stepSection(s, 0, 1)).toBe(4);
    expect(stepSection(s, 5, 1)).toBe(8);
    expect(stepSection(s, 9, 1)).toBeNull();
  });

  it('pages back to the previous section', () => {
    const s = song();
    expect(stepSection(s, 9, -1)).toBe(4);
    expect(stepSection(s, 8, -1)).toBe(4);
    expect(stepSection(s, 5, -1)).toBe(0);
    expect(stepSection(s, 0, -1)).toBeNull();
  });
});

describe('chartBars', () => {
  it('places chords by beat, carries ringing chords and marks repeats', () => {
    const s = song();
    const chords = s.parts.find((p) => p.kind === 'chords')!;
    const at = (bar: number, beat: number) => ({ partId: chords.id, bar, beat, string: 0 });
    const opts = { dur: 4 as const, dotted: false, stack: false };
    placeChordName(s, at(0, 0), 'G', 'beat', opts);
    placeChordName(s, at(0, 2), 'C', 'beat', opts);
    placeChordName(s, at(2, 0), 'D', 'beat', opts);
    setRepeat(s, 4, 7, 2);
    const bars = chartBars(s, chords);
    expect(bars[0].chords).toEqual([
      { name: 'G', at: 0 },
      { name: 'C', at: 0.5 },
    ]);
    expect(bars[0].label).toBe('Intro');
    expect(bars[1]).toMatchObject({ chords: [], carry: 'C' });
    expect(bars[2].carry).toBeUndefined();
    expect(bars[4].repeatStart).toBe(true);
    expect(bars[7].repeatEnd).toBe(2);
  });

  it('starts on the chord chart when there is one', () => {
    const s = newSong();
    expect(defaultStagePart(s).kind).toBe('chords');
    s.parts = s.parts.filter((p) => p.kind === 'tab');
    expect(defaultStagePart(s).kind).toBe('tab');
  });
});

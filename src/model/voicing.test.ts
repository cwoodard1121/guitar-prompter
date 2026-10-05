import { describe, expect, it } from 'vitest';
import { findVoicings } from './voicing';
import { TUNINGS, identifyChord, parseChord, transposeChord } from './music';

const STD = TUNINGS[0].notes;
// Voicings are high-string-first; this flips to the familiar low-E-first "x32010" form.
const shape = (v: number[]) => [...v].reverse().map((f) => (f < 0 ? 'x' : f > 9 ? `(${f})` : String(f))).join('');
const top = (name: string, n = 3) => findVoicings(name, STD).slice(0, n).map(shape);

describe('findVoicings (standard tuning)', () => {
  it.each([
    ['C', 'x32010'],
    ['A', 'x02220'],
    ['Am', 'x02210'],
    ['D', 'xx0232'],
    ['Dm', 'xx0231'],
    ['E', '022100'],
    ['Em', '022000'],
    ['E7', '020100'],
    ['A7', 'x02020'],
  ])('%s offers the open shape %s first', (name, expected) => {
    expect(top(name, 1)[0]).toBe(expected);
  });

  it('G offers a familiar open shape near the top', () => {
    expect(top('G', 3).some((s) => s === '320003' || s === '320033')).toBe(true);
  });

  it('F gives a playable shape (barre or xx3211)', () => {
    expect(top('F', 4).some((s) => s === '133211' || s === 'xx3211')).toBe(true);
  });

  it('slash chords put the bass note lowest', () => {
    const [v] = findVoicings('G/B', STD);
    const lowest = [...v].reverse().findIndex((f) => f >= 0);
    const strIdx = v.length - 1 - lowest;
    expect((STD[strIdx] + v[strIdx]) % 12).toBe(11); // B
  });

  it('handles every chord the palette offers on every root', () => {
    for (const root of ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'])
      for (const s of ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', '5', 'add9', '6', 'dim', 'aug', 'm7b5', '9'])
        expect(findVoicings(root + s, STD).length, root + s).toBeGreaterThan(0);
  });

  it('works on bass tuning', () => {
    expect(findVoicings('E5', TUNINGS.find((t) => t.id === 'bass4')!.notes).length).toBeGreaterThan(0);
  });
});

describe('identifyChord', () => {
  // low-E-first shape string → MIDI on standard tuning
  const midis = (shape: string) =>
    [...shape].flatMap((ch, i) => (ch === 'x' ? [] : [[40, 45, 50, 55, 59, 64][i] + Number(ch)]));
  it.each([
    ['x02210', 'Am'],
    ['x32010', 'C'],
    ['320003', 'G'],
    ['xx0232', 'D'],
    ['022000', 'Em'],
    ['020100', 'E7'],
    ['x02020', 'A7'],
    ['133211', 'F'],
    ['x32000', 'Cmaj7'],
    ['355xxx', 'G5'],
    ['x21202', 'B7'],
    ['x20232', 'Bm7'],
    ['xx0212', 'D7'],
    ['x02200', 'Asus2'],
  ])('%s → %s', (shape, name) => {
    expect(identifyChord(midis(shape))).toBe(name);
  });
  it('names a slash chord when the bass is not the root', () => {
    expect(identifyChord(midis('x20033'))).toBe('G/B');
  });
});

describe('chords', () => {
  it('parses symbols the old app could not', () => {
    for (const s of ['Bm7b5', 'C+', 'B°', 'Dadd9', 'D(add9)', 'G/B', 'F#m7', 'Bbmaj7', 'Em9'])
      expect(parseChord(s), s).not.toBeNull();
    expect(parseChord('Chorus')).toBeNull();
    expect(parseChord('N.C.')).toBeNull();
  });

  it('transposes any chord, keeping its suffix and spelling', () => {
    expect(transposeChord('Em9', 2)).toBe('F#m9');
    expect(transposeChord('Bb7', 2)).toBe('C7');
    expect(transposeChord('Bb7', 1)).toBe('B7');
    expect(transposeChord('Eb', 2)).toBe('F');
    expect(transposeChord('C', 3)).toBe('Eb');
    expect(transposeChord('G/B', 2)).toBe('A/C#');
    expect(transposeChord('A#m', 1)).toBe('Bm');
  });
});

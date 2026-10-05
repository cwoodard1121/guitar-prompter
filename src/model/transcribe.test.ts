import { describe, expect, it } from 'vitest';
import { barCount, barTicks, newSong, playOrder, setRepeat, setMarker } from './song';
import { chordForKey, clearChord, heardBar, heardSlot, loopRange, setChordAt, snapTicks } from './transcribe';

const song44 = () => newSong('t'); // 8 bars, chord part first (four quarter slashes per bar)
const chords = (s: ReturnType<typeof newSong>) => s.parts.find((p) => p.kind === 'chords')!;
const names = (s: ReturnType<typeof newSong>, bar: number) => chords(s).bars[bar].beats.map((b) => `${b.dur}${b.dotted ? '.' : ''}${b.chord ? ':' + b.chord : ''}`);

describe('snapTicks', () => {
  it('beat, half bar, bar in 4/4', () => {
    const s = song44();
    expect([snapTicks(s, 'beat'), snapTicks(s, 'half'), snapTicks(s, 'bar')]).toEqual([16, 32, 64]);
  });
  it('half bar falls back to the beat in 3/4', () => {
    const s = song44();
    s.timeSig = [3, 4];
    expect(snapTicks(s, 'half')).toBe(16);
  });
});

describe('heardSlot', () => {
  const s = song44();
  const order = playOrder(s, 0);
  it('snaps to the nearest beat', () => {
    expect(heardSlot(s, order, 64 * 2 + 16 + 5, 16)).toEqual({ bar: 2, tick: 16 });
    expect(heardSlot(s, order, 64 * 2 + 16 + 9, 16)).toEqual({ bar: 2, tick: 32 });
  });
  it('a tap just before a bar line belongs to the next bar', () => {
    expect(heardSlot(s, order, 64 * 3 - 3, 16)).toEqual({ bar: 3, tick: 0 });
    expect(heardSlot(s, order, 64 * 3 - 20, 64)).toEqual({ bar: 3, tick: 0 });
  });
  it('ignores the count-in but forgives a slightly early first tap', () => {
    expect(heardSlot(s, order, -40, 16)).toBeNull();
    expect(heardSlot(s, order, -4, 16)).toEqual({ bar: 0, tick: 0 });
  });
  it('follows repeats', () => {
    const r = song44();
    setRepeat(r, 1, 2, 2); // plays 0 1 2 1 2 3 …
    const o = playOrder(r, 0);
    expect(heardSlot(r, o, 64 * 3 + 16, 16)).toEqual({ bar: 1, tick: 16 });
    expect(heardSlot(r, o, 64 * 5, 16)).toEqual({ bar: 3, tick: 0 });
  });
  it('starts from where playback started', () => {
    expect(heardSlot(s, playOrder(s, 5), 64 + 32, 16)).toEqual({ bar: 6, tick: 32 });
  });
  it('keeps counting past the written end', () => {
    expect(heardSlot(s, order, 64 * 10 + 16, 16)).toEqual({ bar: 10, tick: 16 });
  });
  it('wraps around a loop', () => {
    const loop = playOrder(s, 4).slice(0, 2); // bars 4-5
    expect(heardSlot(s, loop, 64 * 2 + 16, 16, true)).toEqual({ bar: 4, tick: 16 });
    expect(heardSlot(s, loop, 64 * 2 - 2, 64, true)).toEqual({ bar: 4, tick: 0 }); // just before the loop restarts
  });
  it('heardBar gives the bar and beat without snapping', () => {
    expect(heardBar(s, order, 64 * 2 + 47)).toEqual({ bar: 2, beat: 2 });
    expect(heardBar(s, order, -1)).toBeNull();
  });
});

describe('setChordAt', () => {
  it('names the beat that starts there (and replaces a chord already on it)', () => {
    const s = song44();
    const p = chords(s);
    setChordAt(s, p.id, 1, 32, 'G');
    expect(names(s, 1)).toEqual(['4', '4', '4:G', '4']);
    setChordAt(s, p.id, 1, 32, 'D');
    expect(names(s, 1)).toEqual(['4', '4', '4:D', '4']);
  });
  it('splits a beat to start the chord mid-beat', () => {
    const s = song44();
    const p = chords(s);
    setChordAt(s, p.id, 0, 0, 'C');
    p.bars[0].beats = [p.bars[0].beats[0]];
    p.bars[0].beats[0].dur = 1; // one whole-note slash with C
    setChordAt(s, p.id, 0, 32, 'G');
    expect(names(s, 0)).toEqual(['2:C', '2:G']);
    setChordAt(s, p.id, 0, 8, 'Am');
    expect(names(s, 0)).toEqual(['8:C', '4.:Am', '2:G']);
    expect(barTicks(p.bars[0])).toBe(64);
  });
  it('fills an unwritten bar with slashes up to the chord', () => {
    const s = song44();
    const p = chords(s);
    p.bars[2].beats = [];
    setChordAt(s, p.id, 2, 40, 'Em');
    expect(names(s, 2)).toEqual(['2', '8', '8:Em']);
  });
  it('adds bars when the tap is past the end', () => {
    const s = song44();
    const id = setChordAt(s, chords(s).id, 9, 0, 'A');
    expect(barCount(s)).toBe(10);
    expect(s.parts.every((p) => p.bars.length === 10)).toBe(true);
    expect(chords(s).bars[9].beats[0]).toMatchObject({ id, chord: 'A' });
  });
  it('clearChord takes a tapped chord back off', () => {
    const s = song44();
    const id = setChordAt(s, chords(s).id, 0, 16, 'F');
    expect(clearChord(s, chords(s).id, id)).toBe(true);
    expect(names(s, 0)).toEqual(['4', '4', '4', '4']);
    expect(clearChord(s, chords(s).id, id)).toBe(false);
  });
});

describe('chordForKey', () => {
  it('maps 1–9 to the song chords in order', () => {
    const used = ['G', 'D', 'Em', 'C'];
    expect(chordForKey(used, '1')).toBe('G');
    expect(chordForKey(used, '4')).toBe('C');
    expect(chordForKey(used, '5')).toBeNull();
    expect(chordForKey(used, '0')).toBeNull();
    expect(chordForKey(used, 'a')).toBeNull();
  });
});

describe('loopRange', () => {
  it('n bars from the bar, or no limit', () => {
    const s = song44();
    expect(loopRange(s, 3, 2)).toEqual({ from: 3, bars: 2 });
    expect(loopRange(s, 3, 0)).toEqual({ from: 3 });
  });
  it('the section the bar is in, counting repeats', () => {
    const s = song44();
    setMarker(s, 2, 'Verse');
    setMarker(s, 6, 'Chorus');
    expect(loopRange(s, 4, -1)).toEqual({ from: 2, bars: 4 });
    setRepeat(s, 2, 3, 2);
    expect(loopRange(s, 4, -1)).toEqual({ from: 2, bars: 6 });
    expect(loopRange(s, 7, -1)).toEqual({ from: 6, bars: 2 });
    expect(loopRange(s, 1, -1)).toEqual({ from: 0, bars: 2 });
  });
});

import type { Song } from './types';
import { addBarsAtEnd, barCapacity, barCount, beatTicks, newBeat, playOrder, type ChordStep } from './song';
import { splitTicks } from './rhythm';
import { sectionOf, sectionStarts } from './stage';

/**
 * Transcribing along with playback: turning "the moment you tapped" into a bar
 * and beat, and dropping a chord there. Pure, so it's unit tested.
 */

/** Seconds between hearing a change and tapping it. Taken off every live tap. */
export const REACTION = 0.08;

/** Snap size in ticks for a chord step. Half bar falls back to the beat in odd meters (3/4 has no beat at the middle). */
export function snapTicks(song: Song, step: ChordStep): number {
  const beat = 64 / song.timeSig[1];
  const cap = barCapacity(song);
  if (step === 'bar') return cap;
  if (step === 'half') return (cap / 2) % beat === 0 ? cap / 2 : beat;
  return beat;
}

/**
 * The bar and tick you were hearing `ticks` after playback started, snapped to
 * `grid`. `order` is the bars playback runs through (repeats expanded). Past the
 * written end it keeps counting bars, so you can transcribe the whole recording.
 * A tap just before a bar line lands on that bar line (it's the nearest grid point).
 * Null during the count-in.
 */
export function heardSlot(song: Song, order: number[], ticks: number, grid: number, loop = false): { bar: number; tick: number } | null {
  if (!order.length) return null;
  const snapped = Math.round(ticks / grid) * grid;
  if (snapped < 0) return null;
  const cap = barCapacity(song);
  let k = Math.floor(snapped / cap);
  const tick = snapped - k * cap;
  if (loop) k %= order.length;
  const bar = k < order.length ? order[k] : order[order.length - 1] + (k - order.length + 1);
  return { bar, tick };
}

/** The bar being heard right now (no snapping, for the readout and pause/resume). */
export function heardBar(song: Song, order: number[], ticks: number, loop = false): { bar: number; beat: number } | null {
  if (!order.length || ticks < 0) return null;
  const cap = barCapacity(song);
  let k = Math.floor(ticks / cap);
  const beat = Math.floor((ticks - k * cap) / (64 / song.timeSig[1]));
  if (loop) k %= order.length;
  return { bar: k < order.length ? order[k] : order[order.length - 1] + (k - order.length + 1), beat };
}

/**
 * Names the chord at `tick` of `bar` on a chord part. A chord on the beat that
 * starts there is replaced; landing inside a beat splits it so the chord starts
 * exactly there; an unwritten stretch is filled with slashes. Adds bars past the
 * end as needed. Returns the id of the beat that now carries the chord.
 */
export function setChordAt(song: Song, partId: string, bar: number, tick: number, name: string): string {
  if (bar >= barCount(song)) addBarsAtEnd(song, bar - barCount(song) + 1);
  const part = song.parts.find((p) => p.id === partId)!;
  const beats = part.bars[bar].beats;
  const cap = barCapacity(song);
  const den = 64 / song.timeSig[1];
  const mark = (b: (typeof beats)[number]) => {
    b.chord = name;
    b.chordAuto = undefined;
    b.rest = false;
    return b.id;
  };
  let t = 0;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const len = beatTicks(b);
    if (t === tick) return mark(b);
    if (tick < t + len) {
      // split: the start keeps the old beat (and its chord), the rest starts the new chord
      const before = splitTicks(tick - t);
      const after = splitTicks(t + len - tick);
      const head = [{ ...b, ...before[0] }, ...before.slice(1).map((d) => newBeat(d.dur, { dotted: d.dotted, rest: b.rest }))];
      const tail = after.map((d) => newBeat(d.dur, { dotted: d.dotted }));
      beats.splice(i, 1, ...head, ...tail);
      return mark(tail[0]);
    }
    t += len;
  }
  // past what's written: slashes up to the tap, then a beat for the chord
  for (const d of splitTicks(tick - t)) beats.push(newBeat(d.dur, { dotted: d.dotted }));
  const [d] = splitTicks(Math.min(den - (tick % den), cap - tick)); // up to the next beat
  const beat = newBeat(d.dur, { dotted: d.dotted });
  beats.push(beat);
  return mark(beat);
}

/** Takes the chord off a beat (Backspace after a live tap). */
export function clearChord(song: Song, partId: string, beatId: string): boolean {
  const part = song.parts.find((p) => p.id === partId);
  for (const bar of part?.bars ?? []) {
    const b = bar.beats.find((x) => x.id === beatId);
    if (b) {
      if (!b.chord) return false;
      delete b.chord;
      delete b.chordAuto;
      return true;
    }
  }
  return false;
}

/** Keys 1–9 pick the song's chords in the order they first appear. */
export function chordForKey(used: string[], key: string): string | null {
  if (!/^[1-9]$/.test(key)) return null;
  return used[Number(key) - 1] ?? null;
}

/**
 * What to play: the start bar and how many bars (in play order).
 * `loop` 0 = no loop, n = n bars from `bar`, -1 = the section `bar` is in.
 */
export function loopRange(song: Song, bar: number, loop: number): { from: number; bars?: number } {
  if (loop > 0) return { from: bar, bars: loop };
  if (loop < 0) {
    const from = sectionOf(song, bar);
    const end = sectionStarts(song).find((s) => s > from) ?? barCount(song);
    const order = playOrder(song, from);
    let n = 0;
    while (n < order.length && order[n] >= from && order[n] < end) n++;
    return { from, bars: Math.max(1, n) };
  }
  return { from: bar };
}

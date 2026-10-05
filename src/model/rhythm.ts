import type { Bar, Beat, Dur } from './types';
import { WHOLE, beatTicks, newBeat } from './song';

/** Every length we can write as one beat (ticks → dur/dotted), longest first. */
const SHAPES: { ticks: number; dur: Dur; dotted: boolean }[] = (
  [
    [1, false],
    [2, true],
    [2, false],
    [4, true],
    [4, false],
    [8, true],
    [8, false],
    [16, true],
    [16, false],
    [32, false],
  ] as [Dur, boolean][]
)
  .map(([dur, dotted]) => ({ ticks: (WHOLE / dur) * (dotted ? 1.5 : 1), dur, dotted }))
  .sort((a, b) => b.ticks - a.ticks);

/** Splits a span of ticks into the fewest writable lengths (largest first). */
export function splitTicks(ticks: number): { dur: Dur; dotted: boolean }[] {
  const out: { dur: Dur; dotted: boolean }[] = [];
  let left = ticks;
  while (left > 0) {
    const s = SHAPES.find((x) => x.ticks <= left);
    if (!s) break;
    out.push({ dur: s.dur, dotted: s.dotted });
    left -= s.ticks;
  }
  return out;
}

/** Snaps tap times (seconds from the first downbeat) to a grid, in ticks. Duplicates collapse. */
export function quantize(taps: number[], secPerTick: number, grid: number): number[] {
  const seen = new Set<number>();
  for (const t of taps) {
    if (t < -grid * secPerTick * 0.5) continue; // early taps during the count-in
    const tick = Math.max(0, Math.round(t / secPerTick / grid) * grid);
    seen.add(tick);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Turns note onsets (ticks from the first recorded bar) into bars of beats.
 * Each onset starts an empty "rhythm slot" (no notes yet, not a rest) that lasts
 * until the next onset; leftovers become rests. Notes never cross bar lines.
 */
export function onsetsToBars(onsets: number[], barTicks: number, bars: number): Bar[] {
  const out: Bar[] = [];
  for (let b = 0; b < bars; b++) {
    const start = b * barTicks;
    const end = start + barTicks;
    const inBar = onsets.filter((o) => o >= start && o < end).map((o) => o - start);
    const beats: Beat[] = [];
    let t = 0;
    const pushSpan = (ticks: number, first: 'slot' | 'rest') => {
      splitTicks(ticks).forEach((s, i) => beats.push(newBeat(s.dur, { dotted: s.dotted, rest: i > 0 || first === 'rest' })));
    };
    if (!inBar.length) {
      out.push({ beats: [] });
      continue;
    }
    if (inBar[0] > 0) pushSpan(inBar[0], 'rest');
    inBar.forEach((o, i) => {
      const next = inBar[i + 1] ?? barTicks;
      pushSpan(next - o, 'slot');
      t = next;
    });
    void t;
    out.push({ beats });
  }
  return out;
}

/** Keeps chord names from the old bar on whichever new beat now covers their position. */
export function carryChords(oldBar: Bar, newBar: Bar) {
  const at = (bar: Bar) => {
    let t = 0;
    return bar.beats.map((b) => {
      const s = t;
      t += beatTicks(b);
      return { b, s, e: t };
    });
  };
  const nw = at(newBar);
  for (const { b, s } of at(oldBar)) {
    if (!b.chord) continue;
    const target = nw.find((x) => s >= x.s && s < x.e && !x.b.rest) ?? nw.find((x) => x.s >= s && !x.b.rest);
    if (target && !target.b.chord) {
      target.b.chord = b.chord;
      target.b.chordAuto = b.chordAuto;
    }
  }
}

/** A beat waiting for notes: tapped in rhythm mode, not yet filled. */
export const isSlot = (b: Beat) => !b.rest && b.notes.length === 0;

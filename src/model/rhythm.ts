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

/** A tapped note in ticks; `end` null = a quick tap that lasts until the next note. */
export interface TapNote {
  onset: number;
  end: number | null;
}

/** A raw tap in seconds from the first downbeat; `up` null = still held / never released. */
export interface RawTap {
  down: number;
  up: number | null;
}

/**
 * Snaps presses to the grid. Holding a press (longer than `holdSec`) sets the
 * note's length; a quick tap lets the note ring until the next one, so tapping
 * even eighths still gives plain eighths. Duplicates on one grid point collapse.
 */
export function quantizeTaps(taps: RawTap[], secPerTick: number, grid: number, holdSec = 0.18): TapNote[] {
  const snap = (sec: number) => Math.round(sec / secPerTick / grid) * grid;
  const byOnset = new Map<number, TapNote>();
  for (const t of taps) {
    if (t.down < -grid * secPerTick * 0.5) continue; // early taps during the count-in
    const onset = Math.max(0, snap(t.down));
    const held = t.up === null ? null : t.up - t.down;
    const end = held !== null && held >= holdSec ? Math.max(onset + grid, snap(t.up!)) : null;
    if (!byOnset.has(onset)) byOnset.set(onset, { onset, end });
  }
  return [...byOnset.values()].sort((a, b) => a.onset - b.onset);
}

/**
 * Turns tapped notes into bars: each note becomes an empty "rhythm slot"
 * (no frets yet, not a rest) for its held length, and gaps become rests.
 * Notes never cross bar lines.
 */
export function notesToBars(notes: TapNote[], barTicks: number, bars: number): Bar[] {
  const out: Bar[] = [];
  for (let b = 0; b < bars; b++) {
    const start = b * barTicks;
    const inBar = notes.filter((n) => n.onset >= start && n.onset < start + barTicks).map((n) => ({
      onset: n.onset - start,
      end: n.end === null ? null : n.end - start,
    }));
    if (!inBar.length) {
      out.push({ beats: [] });
      continue;
    }
    const beats: Beat[] = [];
    const span = (ticks: number, kind: 'slot' | 'rest') =>
      splitTicks(ticks).forEach((s, i) => beats.push(newBeat(s.dur, { dotted: s.dotted, rest: kind === 'rest' || i > 0 })));
    if (inBar[0].onset > 0) span(inBar[0].onset, 'rest');
    inBar.forEach((n, i) => {
      const next = inBar[i + 1]?.onset ?? barTicks;
      const len = n.end === null ? next - n.onset : Math.max(1, Math.min(n.end, next) - n.onset);
      span(len, 'slot');
      if (n.onset + len < next) span(next - n.onset - len, 'rest');
    });
    out.push({ beats });
  }
  return out;
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

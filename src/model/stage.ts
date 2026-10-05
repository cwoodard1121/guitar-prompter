import type { Part, Song } from './types';
import { barCapacity, beatTicks, repeatAt } from './song';

/** Bars where a named section starts, in order (0 is always a start so "back" can reach the top). */
export function sectionStarts(song: Song): number[] {
  const starts = new Set([0, ...song.markers.map((m) => m.bar)]);
  return [...starts].sort((a, b) => a - b);
}

/** The section a bar belongs to (its start bar). */
export function sectionOf(song: Song, bar: number): number {
  let at = 0;
  for (const s of sectionStarts(song)) if (s <= bar) at = s;
  return at;
}

/**
 * Where a page-turn lands. Forward: the next section start. Back: the start of the
 * section before this one (like a music stand: back means "previous section").
 * Null at either end.
 */
export function stepSection(song: Song, bar: number, dir: 1 | -1): number | null {
  const starts = sectionStarts(song);
  if (dir === 1) return starts.find((s) => s > bar) ?? null;
  const cur = sectionOf(song, bar);
  const prev = [...starts].reverse().find((s) => s < cur);
  return prev ?? (bar > 0 ? 0 : null);
}

export interface ChartChord {
  name: string;
  /** Where in the bar it lands, 0..1. */
  at: number;
}

export interface ChartBar {
  bar: number;
  chords: ChartChord[];
  /** Chord still ringing from earlier (shown faintly at the start of the bar). */
  carry?: string;
  /** Section label starting here. */
  label?: string;
  repeatStart?: boolean;
  /** Total plays when a repeat ends on this bar. */
  repeatEnd?: number;
}

/** A chord part as rows of bars for the stage chart. */
export function chartBars(song: Song, part: Part): ChartBar[] {
  const cap = barCapacity(song);
  let ringing: string | undefined;
  return part.bars.map((bar, i) => {
    const chords: ChartChord[] = [];
    let t = 0;
    for (const b of bar.beats) {
      if (b.chord) chords.push({ name: b.chord, at: Math.min(1, t / cap) });
      t += beatTicks(b);
    }
    const out: ChartBar = { bar: i, chords };
    if (ringing && !(chords[0]?.at === 0)) out.carry = ringing;
    if (chords.length) ringing = chords[chords.length - 1].name;
    const label = song.markers.find((m) => m.bar === i)?.label;
    if (label) out.label = label;
    const r = repeatAt(song, i);
    if (r && r.times > 1) {
      if (r.start === i) out.repeatStart = true;
      if (r.end === i) out.repeatEnd = r.times;
    }
    return out;
  });
}

/** Which part the stage shows first: the chord chart if there is one (easiest to read live), else the first tab. */
export const defaultStagePart = (song: Song): Part => song.parts.find((p) => p.kind === 'chords') ?? song.parts[0];

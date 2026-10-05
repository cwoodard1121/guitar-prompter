import type { Bar, Beat, Cursor, Dur, Note, Part, PartKind, Song } from './types';
import { TUNINGS, identifyChord } from './music';
import { findVoicings } from './voicing';

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Ticks per whole note. A quarter is 16, a 32nd is 2. */
export const WHOLE = 64;
export const beatTicks = (b: Pick<Beat, 'dur' | 'dotted'>) => (WHOLE / b.dur) * (b.dotted ? 1.5 : 1);
export const barCapacity = (song: Song) => song.timeSig[0] * (WHOLE / song.timeSig[1]);
export const barTicks = (bar: Bar) => bar.beats.reduce((t, b) => t + beatTicks(b), 0);
export const barCount = (song: Song) => song.parts[0]?.bars.length ?? 0;

export const PART_COLORS = ['#8fd3c7', '#e9b872', '#e58f8f', '#a9b8f0', '#b8e08a', '#d6a6e6'];

export const newBeat = (dur: Dur, init: Partial<Beat> = {}): Beat => ({
  id: uid(),
  dur,
  dotted: false,
  rest: false,
  notes: [],
  ...init,
});

/** A chord part bar is pre-filled with slash beats you can tap chords onto. */
export function emptyBar(song: Pick<Song, 'timeSig'>, kind: PartKind): Bar {
  if (kind === 'tab') return { beats: [] };
  const [num, den] = song.timeSig;
  return { beats: Array.from({ length: num }, () => newBeat(den as Dur)) };
}

export function newPart(song: Pick<Song, 'timeSig' | 'parts'>, kind: PartKind, bars: number): Part {
  const n = song.parts.filter((p) => p.kind === kind).length;
  return {
    id: uid(),
    name: kind === 'tab' ? (n ? `Guitar ${n + 1}` : 'Guitar') : n ? `Chords ${n + 1}` : 'Chords',
    kind,
    tuning: [...TUNINGS[0].notes],
    capo: 0,
    color: PART_COLORS[song.parts.length % PART_COLORS.length],
    muted: false,
    bars: Array.from({ length: bars }, () => emptyBar(song, kind)),
  };
}

export function newSong(title = 'Untitled'): Song {
  const now = Date.now();
  const base: Song = {
    id: uid(),
    title,
    artist: '',
    tempo: 100,
    timeSig: [4, 4],
    parts: [],
    markers: [],
    createdAt: now,
    updatedAt: now,
  };
  base.parts.push(newPart(base, 'chords', 8));
  base.parts.push(newPart(base, 'tab', 8));
  return base;
}

/* ------------------------------------------------------------------ edits
 * Every edit takes a draft (already cloned by the store) and mutates it.
 * They return the cursor the edit leaves behind.
 */

const partOf = (song: Song, id: string) => song.parts.find((p) => p.id === id)!;

export function addBarsAtEnd(song: Song, count = 1) {
  for (const p of song.parts) for (let i = 0; i < count; i++) p.bars.push(emptyBar(song, p.kind));
}

export function insertBar(song: Song, at: number) {
  for (const p of song.parts) p.bars.splice(at, 0, emptyBar(song, p.kind));
  for (const m of song.markers) if (m.bar >= at) m.bar++;
}

export function duplicateBar(song: Song, at: number) {
  for (const p of song.parts) p.bars.splice(at + 1, 0, cloneBar(p.bars[at]));
  for (const m of song.markers) if (m.bar > at) m.bar++;
}

export function deleteBar(song: Song, at: number) {
  if (barCount(song) <= 1) {
    for (const p of song.parts) p.bars[0] = emptyBar(song, p.kind);
    return;
  }
  for (const p of song.parts) p.bars.splice(at, 1);
  song.markers = song.markers.filter((m) => m.bar !== at).map((m) => (m.bar > at ? { ...m, bar: m.bar - 1 } : m));
}

export const cloneBar = (bar: Bar): Bar => ({
  beats: bar.beats.map((b) => ({ ...b, id: uid(), notes: b.notes.map((n) => ({ ...n })) })),
});

export function isBarFull(song: Song, bar: Bar) {
  return barTicks(bar) >= barCapacity(song);
}

/** Keeps the cursor on a real position, growing the song when it walks off the end. */
export function normalizeCursor(song: Song, c: Cursor): Cursor {
  const part = partOf(song, c.partId) ?? song.parts[0];
  let { bar, beat } = c;
  bar = Math.max(0, Math.min(bar, barCount(song) - 1));
  const b = part.bars[bar];
  if (beat >= b.beats.length && isBarFull(song, b) && b.beats.length > 0) {
    if (bar === barCount(song) - 1) addBarsAtEnd(song);
    bar += 1;
    beat = 0;
  }
  beat = Math.max(0, Math.min(beat, part.bars[bar].beats.length));
  const string = Math.max(0, Math.min(c.string, part.tuning.length - 1));
  return { partId: part.id, bar, beat, string };
}

export interface EntryOpts {
  dur: Dur;
  dotted: boolean;
  /** Keep the cursor on this beat (build chords note by note). */
  stack: boolean;
}

/** Returns the beat at the cursor, appending one (or spilling into the next bar) when on the append slot. */
function beatAtCursor(song: Song, c: Cursor, opts: EntryOpts): { beat: Beat; cursor: Cursor } {
  const part = partOf(song, c.partId);
  let bar = part.bars[c.bar];
  if (c.beat < bar.beats.length) return { beat: bar.beats[c.beat], cursor: c };
  const ticks = beatTicks(opts);
  if (bar.beats.length > 0 && barTicks(bar) + ticks > barCapacity(song)) {
    if (c.bar === barCount(song) - 1) addBarsAtEnd(song);
    const next = { ...c, bar: c.bar + 1, beat: 0 };
    return beatAtCursor(song, next, opts);
  }
  const beat = newBeat(opts.dur, { dotted: opts.dotted });
  bar.beats.push(beat);
  return { beat, cursor: { ...c, beat: bar.beats.length - 1 } };
}

const advance = (song: Song, c: Cursor) => normalizeCursor(song, { ...c, beat: c.beat + 1 });

/** Names a tab beat from its notes when it is a chord (3+ notes, or a power chord), unless the user named it. */
export function autoName(part: Part, beat: Beat) {
  if (beat.chord && !beat.chordAuto) return;
  const midis = beat.notes.map((n) => part.tuning[n.string] + n.fret); // capo-relative = shape name
  const name = beat.notes.length >= 2 ? identifyChord(midis) : null;
  const isChordish = beat.notes.length >= 3 || (name !== null && name.endsWith('5'));
  if (name && isChordish) {
    beat.chord = name;
    beat.chordAuto = true;
  } else if (beat.chordAuto) {
    beat.chord = undefined;
    beat.chordAuto = undefined;
  }
}

/** Puts a note on a string at the cursor. Tapping the same fret again removes it. */
export function placeNote(song: Song, c: Cursor, string: number, fret: number, opts: EntryOpts): Cursor {
  const { beat, cursor } = beatAtCursor(song, c, opts);
  const part = partOf(song, c.partId);
  const existing = beat.notes.find((n) => n.string === string);
  if (existing && existing.fret === fret && opts.stack) {
    beat.notes = beat.notes.filter((n) => n !== existing);
    autoName(part, beat);
    return { ...cursor, string };
  }
  beat.rest = false;
  beat.notes = beat.notes.filter((n) => n.string !== string);
  beat.notes.push({ string, fret });
  beat.notes.sort((a, b) => a.string - b.string);
  autoName(part, beat);
  const at = { ...cursor, string };
  return opts.stack ? at : advance(song, at);
}

/** Writes a whole chord shape onto the cursor beat (tab parts) and names it. */
export function placeChordShape(song: Song, c: Cursor, name: string, frets: number[], opts: EntryOpts): Cursor {
  const { beat, cursor } = beatAtCursor(song, c, opts);
  const notes: Note[] = [];
  frets.forEach((f, s) => f >= 0 && notes.push({ string: s, fret: f }));
  beat.notes = notes;
  beat.rest = false;
  beat.chord = name;
  beat.chordAuto = undefined;
  return opts.stack ? cursor : advance(song, cursor);
}

export type ChordStep = 'beat' | 'half' | 'bar';

/** Names the chord at the cursor (chord parts) and steps forward. */
export function placeChordName(song: Song, c: Cursor, name: string, step: ChordStep, opts: EntryOpts): Cursor {
  const { beat, cursor } = beatAtCursor(song, c, opts);
  beat.chord = name;
  beat.chordAuto = undefined;
  beat.rest = false;
  return stepCursor(song, cursor, step);
}

export function stepCursor(song: Song, c: Cursor, step: ChordStep): Cursor {
  const part = partOf(song, c.partId);
  if (step === 'beat') return advance(song, c);
  if (step === 'bar') {
    if (c.bar === barCount(song) - 1) addBarsAtEnd(song);
    return normalizeCursor(song, { ...c, bar: c.bar + 1, beat: 0 });
  }
  // half bar: jump to the first beat at or after the bar's midpoint, else next bar
  const bar = part.bars[c.bar];
  const half = barCapacity(song) / 2;
  let t = 0;
  for (let i = 0; i < bar.beats.length; i++) {
    if (t >= half && i > c.beat) return { ...c, beat: i };
    t += beatTicks(bar.beats[i]);
  }
  return stepCursor(song, c, 'bar');
}

export function setRest(song: Song, c: Cursor, opts: EntryOpts): Cursor {
  const { beat, cursor } = beatAtCursor(song, c, opts);
  beat.rest = true;
  beat.notes = [];
  beat.chord = undefined;
  return advance(song, cursor);
}

export function setBeatDuration(song: Song, c: Cursor, dur: Dur, dotted: boolean) {
  const beat = partOf(song, c.partId).bars[c.bar].beats[c.beat];
  if (!beat) return;
  beat.dur = dur;
  beat.dotted = dotted;
}

/** Delete: note on the cursor string → chord name → the beat itself. */
export function deleteAtCursor(song: Song, c: Cursor): Cursor {
  const part = partOf(song, c.partId);
  const bar = part.bars[c.bar];
  const beat = bar.beats[c.beat];
  if (!beat) {
    if (c.beat > 0) return { ...c, beat: c.beat - 1 };
    return c;
  }
  if (part.kind === 'tab') {
    const n = beat.notes.find((x) => x.string === c.string);
    if (n) {
      beat.notes = beat.notes.filter((x) => x !== n);
      autoName(part, beat);
      return c;
    }
    if (beat.chord) {
      beat.chord = undefined;
      return c;
    }
    bar.beats.splice(c.beat, 1);
    return normalizeCursor(song, c);
  }
  // chord part: clear the name first, then remove the slash
  if (beat.chord) {
    beat.chord = undefined;
    return c;
  }
  bar.beats.splice(c.beat, 1);
  return normalizeCursor(song, c);
}

export function insertBeatBefore(song: Song, c: Cursor, opts: EntryOpts): Cursor {
  const bar = partOf(song, c.partId).bars[c.bar];
  bar.beats.splice(Math.min(c.beat, bar.beats.length), 0, newBeat(opts.dur, { dotted: opts.dotted, rest: true }));
  return c;
}

export function setMarker(song: Song, bar: number, label: string) {
  song.markers = song.markers.filter((m) => m.bar !== bar);
  if (label.trim()) song.markers.push({ bar, label: label.trim() });
  song.markers.sort((a, b) => a.bar - b.bar);
}

/** Chords used in the song, in first-appearance order (for the quick-tap row). */
export function usedChords(song: Song): string[] {
  const seen = new Set<string>();
  for (const p of song.parts) for (const bar of p.bars) for (const b of bar.beats) if (b.chord) seen.add(b.chord);
  return [...seen];
}

/** Best voicing for a chord on a part, or null when the name isn't a known chord. */
export function voicingFor(part: Part, name: string, index = 0): number[] | null {
  const vs = findVoicings(name, part.tuning);
  return vs.length ? vs[Math.min(index, vs.length - 1)] : null;
}

/** Keeps every part the same length (repairs imported or hand-edited songs). */
export function repairSong(song: Song): Song {
  const n = Math.max(1, ...song.parts.map((p) => p.bars.length));
  for (const p of song.parts) while (p.bars.length < n) p.bars.push(emptyBar(song, p.kind));
  song.markers ??= [];
  return song;
}

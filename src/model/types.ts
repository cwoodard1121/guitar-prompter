/** Note length as a fraction of a whole note: 1 = whole, 4 = quarter, 16 = sixteenth. */
export type Dur = 1 | 2 | 4 | 8 | 16 | 32;

/** One fretted string. `string` 0 is the highest-pitched string (top line of the tab). */
export interface Note {
  string: number;
  /** Fret relative to the capo (0 = open/capo). */
  fret: number;
  /** Bend in semitones: 1 = ½, 2 = full, 3 = 1½. */
  bend?: number;
  /** Hammer-on / pull-off into the next note on this string. */
  legato?: 'h' | 'p';
  /** Slide into the next note on this string. */
  slide?: 'up' | 'down';
  vibrato?: boolean;
}

export type Technique = 'bend1' | 'bend2' | 'bend3' | 'h' | 'p' | 'slideUp' | 'slideDown' | 'vibrato';

export interface Beat {
  id: string;
  dur: Dur;
  dotted: boolean;
  rest: boolean;
  notes: Note[];
  /** Chord name shown above this beat, written as the shape you play (capo-relative). */
  chord?: string;
  /** True when `chord` was worked out from the notes, so it updates as notes change. */
  chordAuto?: boolean;
}

export interface Bar {
  beats: Beat[];
}

/** `tab` = notation + tablature. `chords` = slash rhythm chart with chord names. */
export type PartKind = 'tab' | 'chords';

export interface Part {
  id: string;
  name: string;
  kind: PartKind;
  /** MIDI note per open string, index 0 = highest string. */
  tuning: number[];
  capo: number;
  color: string;
  muted: boolean;
  /** Chord parts: write each chord's fingering as tab under the chart (default on). */
  chordTab?: boolean;
  /** Every part has exactly `song.barCount` bars, so parts stay registered bar for bar. */
  bars: Bar[];
}

export interface Marker {
  bar: number;
  label: string;
}

/** Bars `start`..`end` (inclusive) play `times` times in total. Applies to every part. */
export interface Repeat {
  start: number;
  end: number;
  times: number;
}

/**
 * An imported recording to tab along with. The file lives in IndexedDB on each
 * device and, when signed in, in Supabase Storage so other devices can fetch it.
 */
export interface AudioTrack {
  name: string;
  /** Which file this is; changes when the recording is replaced, so stale copies get refetched. */
  rev?: string;
  size?: number;
  /** A copy is in Supabase Storage. */
  uploaded?: boolean;
  /** Seconds into the recording where bar 1 starts. */
  offset: number;
  volume: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  timeSig: [number, number];
  parts: Part[];
  markers: Marker[];
  repeats?: Repeat[];
  audio?: AudioTrack;
  createdAt: number;
  updatedAt: number;
}

export interface Cursor {
  partId: string;
  bar: number;
  /** Index into the bar's beats; may equal beats.length (the "append" slot). */
  beat: number;
  string: number;
}

/** An ordered set of songs to play through (a gig, a rehearsal). */
export interface Setlist {
  id: string;
  name: string;
  /** Song ids in play order. A deleted song stays listed (shown as missing) until removed. */
  songIds: string[];
  createdAt: number;
  updatedAt: number;
}

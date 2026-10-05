/** Note length as a fraction of a whole note: 1 = whole, 4 = quarter, 16 = sixteenth. */
export type Dur = 1 | 2 | 4 | 8 | 16 | 32;

/** One fretted string. `string` 0 is the highest-pitched string (top line of the tab). */
export interface Note {
  string: number;
  /** Fret relative to the capo (0 = open/capo). */
  fret: number;
}

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
  /** Every part has exactly `song.barCount` bars, so parts stay registered bar for bar. */
  bars: Bar[];
}

export interface Marker {
  bar: number;
  label: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  tempo: number;
  timeSig: [number, number];
  parts: Part[];
  markers: Marker[];
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

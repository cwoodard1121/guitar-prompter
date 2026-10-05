export const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** How guitarists usually spell roots when nothing else decides it. */
export const COMMON = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Pitch class of a note name like "Bb", "C#", "Fb". */
export function pcOf(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)$/.exec(name.trim());
  if (!m) return null;
  let pc = LETTER_PC[m[1].toUpperCase()];
  for (const ch of m[2]) pc += ch === '#' || ch === '♯' ? 1 : -1;
  return mod12(pc);
}

export function midiToName(midi: number, flats = false): string {
  return (flats ? FLATS : SHARPS)[mod12(midi)] + (Math.floor(midi / 12) - 1);
}

export function pcName(pc: number, spelling: 'sharp' | 'flat' | 'common' = 'common'): string {
  return (spelling === 'sharp' ? SHARPS : spelling === 'flat' ? FLATS : COMMON)[mod12(pc)];
}

export interface Quality {
  id: string;
  /** Canonical suffix appended to the root. */
  suffix: string;
  /** Semitones above the root. Values ≥ 12 are extensions (9 = 14). */
  intervals: number[];
  /** Tones that may be left out of a guitar voicing (usually the fifth). */
  optional?: number[];
  aliases?: string[];
}

export const QUALITIES: Quality[] = [
  { id: 'maj', suffix: '', intervals: [0, 4, 7], aliases: ['M', 'maj', 'major'] },
  { id: 'm', suffix: 'm', intervals: [0, 3, 7], aliases: ['min', '-', 'mi'] },
  { id: '7', suffix: '7', intervals: [0, 4, 7, 10], optional: [7], aliases: ['dom7'] },
  { id: 'maj7', suffix: 'maj7', intervals: [0, 4, 7, 11], optional: [7], aliases: ['M7', 'Δ', 'Δ7', 'ma7'] },
  { id: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10], optional: [7], aliases: ['min7', '-7', 'mi7'] },
  { id: 'sus2', suffix: 'sus2', intervals: [0, 2, 7], aliases: ['2'] },
  { id: 'sus4', suffix: 'sus4', intervals: [0, 5, 7], aliases: ['sus', '4'] },
  { id: '5', suffix: '5', intervals: [0, 7] },
  { id: 'add9', suffix: 'add9', intervals: [0, 4, 7, 14], optional: [7], aliases: ['(add9)', 'add2'] },
  { id: 'madd9', suffix: 'madd9', intervals: [0, 3, 7, 14], optional: [7], aliases: ['m(add9)', 'madd2'] },
  { id: '6', suffix: '6', intervals: [0, 4, 7, 9], optional: [7], aliases: ['maj6'] },
  { id: 'm6', suffix: 'm6', intervals: [0, 3, 7, 9], optional: [7], aliases: ['min6'] },
  { id: '9', suffix: '9', intervals: [0, 4, 7, 10, 14], optional: [7] },
  { id: 'm9', suffix: 'm9', intervals: [0, 3, 7, 10, 14], optional: [7] },
  { id: 'maj9', suffix: 'maj9', intervals: [0, 4, 7, 11, 14], optional: [7] },
  { id: '7sus4', suffix: '7sus4', intervals: [0, 5, 7, 10], optional: [7], aliases: ['7sus'] },
  { id: 'dim', suffix: 'dim', intervals: [0, 3, 6], aliases: ['°', 'o'] },
  { id: 'dim7', suffix: 'dim7', intervals: [0, 3, 6, 9], aliases: ['°7', 'o7'] },
  { id: 'm7b5', suffix: 'm7b5', intervals: [0, 3, 6, 10], aliases: ['ø', 'ø7', '-7b5', 'min7b5'] },
  { id: 'aug', suffix: 'aug', intervals: [0, 4, 8], aliases: ['+', '#5'] },
  { id: 'mmaj7', suffix: 'm(maj7)', intervals: [0, 3, 7, 11], optional: [7], aliases: ['mM7', 'mmaj7', 'm/maj7'] },
  { id: '7#9', suffix: '7#9', intervals: [0, 4, 10, 15] },
  { id: '11', suffix: '11', intervals: [0, 7, 10, 14, 17], optional: [7, 14] },
  { id: '13', suffix: '13', intervals: [0, 4, 10, 21], optional: [] },
];

/** Qualities offered as one-tap buttons in the palette, in order. */
export const PALETTE_QUALITIES = ['maj', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', '5', 'add9', '6', 'dim', 'aug', 'm7b5', '9'];

const SUFFIX_INDEX = new Map<string, Quality>();
for (const q of QUALITIES) {
  SUFFIX_INDEX.set(q.suffix, q);
  for (const a of q.aliases ?? []) if (!SUFFIX_INDEX.has(a)) SUFFIX_INDEX.set(a, q);
}

export const qualityById = (id: string) => QUALITIES.find((q) => q.id === id)!;

export interface ChordParts {
  rootName: string;
  root: number;
  /** Suffix exactly as written ("m7", "maj7", "sus4", or something we don't know). */
  suffix: string;
  /** Known quality for the suffix, if any. Transposition never needs it. */
  quality: Quality | null;
  bassName?: string;
  bass?: number;
}

const CHORD_RE = /^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/;
/** Chord suffixes are built from these tokens only; anything else ("Chorus") is not a chord. */
const SUFFIX_RE = /^(?:maj|min|mi|ma|m|M|dim|aug|sus|add|dom|no|alt|[0-9]|[#b♯♭+\-°øoΔ(),])*$/;

/** Parses "F#m7b5", "Bb/D", "Cadd9", "N.C." (returns null for N.C. and non-chords). */
export function parseChord(name: string): ChordParts | null {
  const m = CHORD_RE.exec(name.trim());
  if (!m) return null;
  const root = pcOf(m[1]);
  if (root === null) return null;
  const suffix = m[2];
  if (!SUFFIX_RE.test(suffix)) return null;
  const quality = SUFFIX_INDEX.get(suffix) ?? SUFFIX_INDEX.get(suffix.replace(/[()]/g, '')) ?? null;
  const out: ChordParts = { rootName: m[1], root, suffix, quality };
  if (m[3]) {
    const bass = pcOf(m[3]);
    if (bass === null) return null;
    out.bassName = m[3];
    out.bass = bass;
  }
  return out;
}

export function isChord(name: string): boolean {
  return parseChord(name) !== null;
}

function spellingFor(original: string): 'sharp' | 'flat' | 'common' {
  if (/[b♭]/.test(original.slice(1))) return 'flat';
  if (/[#♯]/.test(original)) return 'sharp';
  return 'common';
}

/**
 * Transposes any chord symbol by semitones, keeping its suffix untouched, so
 * extensions we have never heard of ("Em9(no3)") still move with the song.
 */
export function transposeChord(name: string, semis: number): string {
  const c = parseChord(name);
  if (!c || mod12(semis) === 0) return name;
  const sp = spellingFor(c.rootName);
  const root = pcName(c.root + semis, sp === 'common' ? 'common' : sp);
  const bass = c.bass !== undefined ? '/' + pcName(c.bass + semis, sp === 'common' ? 'common' : sp) : '';
  return root + c.suffix + bass;
}

export function chordName(root: number, qualityId: string, bass?: number): string {
  const q = qualityById(qualityId);
  return pcName(root) + q.suffix + (bass !== undefined && mod12(bass) !== mod12(root) ? '/' + pcName(bass) : '');
}

/** How "normal" each quality is when several spellings fit the same notes. */
const QUALITY_RANK = ['maj', 'm', '5', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', '6', 'm6', 'madd9', '7sus4', '9', 'm9', 'maj9', 'dim', 'm7b5', 'dim7', 'aug', 'mmaj7', '7#9', '11', '13'];

/**
 * Names a set of sounding pitches ("what chord is x02210?" → "Am").
 * Lowest pitch is the bass; if it isn't the root the result is a slash chord.
 */
export function identifyChord(midis: number[]): string | null {
  if (midis.length < 2) return null;
  const sorted = [...midis].sort((a, b) => a - b);
  const bass = mod12(sorted[0]);
  const pcs = [...new Set(sorted.map(mod12))];
  if (pcs.length < 2) return null;
  let best: { name: string; score: number } | null = null;
  for (const root of pcs) {
    for (const q of QUALITIES) {
      const tones = new Set(q.intervals.map((i) => mod12(root + i)));
      const optional = new Set((q.optional ?? []).map((i) => mod12(root + i)));
      if (!pcs.every((pc) => tones.has(pc))) continue; // extra notes → not this chord
      const missing = [...tones].filter((t) => !pcs.includes(t));
      if (missing.some((t) => !optional.has(t))) continue;
      const rank = QUALITY_RANK.indexOf(q.id);
      const score = (root === bass ? 0 : 6) + missing.length * 2 + (rank < 0 ? 30 : rank) * 0.5;
      if (!best || score < best.score) best = { name: chordName(root, q.id, root === bass ? undefined : bass), score };
    }
  }
  return best?.name ?? null;
}

export interface Tuning {
  id: string;
  name: string;
  /** MIDI per string, index 0 = highest string. */
  notes: number[];
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Standard', notes: [64, 59, 55, 50, 45, 40] },
  { id: 'dropd', name: 'Drop D', notes: [64, 59, 55, 50, 45, 38] },
  { id: 'halfdown', name: 'Half step down', notes: [63, 58, 54, 49, 44, 39] },
  { id: 'wholedown', name: 'Whole step down', notes: [62, 57, 53, 48, 43, 38] },
  { id: 'dropc', name: 'Drop C', notes: [62, 57, 53, 48, 43, 36] },
  { id: 'dadgad', name: 'DADGAD', notes: [62, 57, 55, 50, 45, 38] },
  { id: 'openg', name: 'Open G', notes: [62, 59, 55, 50, 43, 38] },
  { id: 'opend', name: 'Open D', notes: [62, 57, 54, 50, 45, 38] },
  { id: 'opene', name: 'Open E', notes: [64, 59, 56, 52, 47, 40] },
  { id: 'seven', name: '7-string', notes: [64, 59, 55, 50, 45, 40, 35] },
  { id: 'bass4', name: 'Bass (4)', notes: [43, 38, 33, 28] },
  { id: 'bass5', name: 'Bass (5)', notes: [43, 38, 33, 28, 23] },
];

export function tuningLabel(notes: number[]): string {
  const t = TUNINGS.find((t) => t.notes.length === notes.length && t.notes.every((n, i) => n === notes[i]));
  return t ? t.name : [...notes].reverse().map((n) => SHARPS[mod12(n)]).join('');
}

export const stringLabel = (midi: number) => SHARPS[mod12(midi)];

// Chord fingerings database
// Format: { fingers: [string positions], barres: [...] }
// String positions: -1 = muted, 0 = open, 1-5 = fret
// fingers array: [6th string, 5th, 4th, 3rd, 2nd, 1st] (low E to high E)

export const CHORDS = {
  // Major chords
  'C':  { fingers: [-1, 3, 2, 0, 1, 0], barres: [] },
  'D':  { fingers: [-1, -1, 0, 2, 3, 2], barres: [] },
  'E':  { fingers: [0, 2, 2, 1, 0, 0], barres: [] },
  'F':  { fingers: [1, 3, 3, 2, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }] },
  'G':  { fingers: [3, 2, 0, 0, 0, 3], barres: [] },
  'A':  { fingers: [-1, 0, 2, 2, 2, 0], barres: [] },
  'B':  { fingers: [-1, 2, 4, 4, 4, 2], barres: [{ fromString: 5, toString: 1, fret: 2 }] },

  // Minor chords
  'Am':  { fingers: [-1, 0, 2, 2, 1, 0], barres: [] },
  'Bm':  { fingers: [-1, 2, 4, 4, 3, 2], barres: [{ fromString: 5, toString: 1, fret: 2 }] },
  'Cm':  { fingers: [-1, 3, 5, 5, 4, 3], barres: [{ fromString: 5, toString: 1, fret: 3 }] },
  'Dm':  { fingers: [-1, -1, 0, 2, 3, 1], barres: [] },
  'Em':  { fingers: [0, 2, 2, 0, 0, 0], barres: [] },
  'Fm':  { fingers: [1, 3, 3, 1, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }] },
  'Gm':  { fingers: [3, 5, 5, 3, 3, 3], barres: [{ fromString: 6, toString: 1, fret: 3 }] },

  // 7th chords
  'A7':  { fingers: [-1, 0, 2, 0, 2, 0], barres: [] },
  'B7':  { fingers: [-1, 2, 1, 2, 0, 2], barres: [] },
  'C7':  { fingers: [-1, 3, 2, 3, 1, 0], barres: [] },
  'D7':  { fingers: [-1, -1, 0, 2, 1, 2], barres: [] },
  'E7':  { fingers: [0, 2, 0, 1, 0, 0], barres: [] },
  'F7':  { fingers: [1, 3, 1, 2, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }] },
  'G7':  { fingers: [3, 2, 0, 0, 0, 1], barres: [] },

  // Minor 7th chords
  'Am7':  { fingers: [-1, 0, 2, 0, 1, 0], barres: [] },
  'Bm7':  { fingers: [-1, 2, 4, 2, 3, 2], barres: [{ fromString: 5, toString: 1, fret: 2 }] },
  'Dm7':  { fingers: [-1, -1, 0, 2, 1, 1], barres: [] },
  'Em7':  { fingers: [0, 2, 0, 0, 0, 0], barres: [] },
  'Fm7':  { fingers: [1, 3, 1, 1, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }] },
  'Gm7':  { fingers: [3, 5, 3, 3, 3, 3], barres: [{ fromString: 6, toString: 1, fret: 3 }] },

  // Major 7th chords
  'Amaj7':  { fingers: [-1, 0, 2, 1, 2, 0], barres: [] },
  'Cmaj7':  { fingers: [-1, 3, 2, 0, 0, 0], barres: [] },
  'Dmaj7':  { fingers: [-1, -1, 0, 2, 2, 2], barres: [] },
  'Fmaj7':  { fingers: [-1, -1, 3, 2, 1, 0], barres: [] },
  'Gmaj7':  { fingers: [3, 2, 0, 0, 0, 2], barres: [] },

  // Sus chords
  'Asus2':  { fingers: [-1, 0, 2, 2, 0, 0], barres: [] },
  'Asus4':  { fingers: [-1, 0, 2, 2, 3, 0], barres: [] },
  'Dsus2':  { fingers: [-1, -1, 0, 2, 3, 0], barres: [] },
  'Dsus4':  { fingers: [-1, -1, 0, 2, 3, 3], barres: [] },
  'Esus4':  { fingers: [0, 2, 2, 2, 0, 0], barres: [] },

  // Add9 chords
  'Cadd9':  { fingers: [-1, 3, 2, 0, 3, 0], barres: [] },
  'Dadd9':  { fingers: [-1, -1, 0, 2, 3, 0], barres: [] },
  'Gadd9':  { fingers: [3, 2, 0, 0, 0, 5], barres: [] },

  // Flat major chords
  'Ab':  { fingers: [4, 6, 6, 5, 4, 4], barres: [{ fromString: 6, toString: 1, fret: 4 }] },
  'Bb':  { fingers: [-1, 1, 3, 3, 3, 1], barres: [{ fromString: 5, toString: 1, fret: 1 }] },
  'Db':  { fingers: [-1, -1, 0, 1, 2, 1], barres: [] },
  'Eb':  { fingers: [-1, -1, 1, 3, 4, 3], barres: [] },
  'Gb':  { fingers: [2, 4, 4, 3, 2, 2], barres: [{ fromString: 6, toString: 1, fret: 2 }] },

  // Flat minor chords
  'Abm':  { fingers: [4, 6, 6, 4, 4, 4], barres: [{ fromString: 6, toString: 1, fret: 4 }] },
  'Bbm':  { fingers: [-1, 1, 3, 3, 2, 1], barres: [{ fromString: 5, toString: 1, fret: 1 }] },
  'Dbm':  { fingers: [-1, -1, 0, 1, 2, 1], barres: [] },
  'Ebm':  { fingers: [-1, -1, 1, 3, 4, 2], barres: [] },
  'Gbm':  { fingers: [2, 4, 4, 2, 2, 2], barres: [{ fromString: 6, toString: 1, fret: 2 }] },

  // Sharp major chords
  'C#':  { fingers: [-1, -1, 3, 1, 2, 1], barres: [] },
  'D#':  { fingers: [-1, -1, 1, 3, 4, 3], barres: [] },
  'F#':  { fingers: [2, 4, 4, 3, 2, 2], barres: [{ fromString: 6, toString: 1, fret: 2 }] },
  'G#':  { fingers: [4, 6, 6, 5, 4, 4], barres: [{ fromString: 6, toString: 1, fret: 4 }] },

  // Sharp minor chords
  'C#m':  { fingers: [-1, -1, 3, 1, 2, 1], barres: [] },
  'D#m':  { fingers: [-1, -1, 1, 3, 4, 2], barres: [] },
  'F#m':  { fingers: [2, 4, 4, 2, 2, 2], barres: [{ fromString: 6, toString: 1, fret: 2 }] },
  'G#m':  { fingers: [4, 6, 6, 4, 4, 4], barres: [{ fromString: 6, toString: 1, fret: 4 }] },

  // Power chords (5 chords)
  'A5':  { fingers: [-1, 0, 2, 2, -1, -1], barres: [] },
  'B5':  { fingers: [-1, 2, 4, 4, -1, -1], barres: [] },
  'C5':  { fingers: [-1, 3, 5, 5, -1, -1], barres: [] },
  'D5':  { fingers: [-1, -1, 0, 2, 3, -1], barres: [] },
  'E5':  { fingers: [0, 2, 2, -1, -1, -1], barres: [] },
  'F5':  { fingers: [1, 3, 3, -1, -1, -1], barres: [] },
  'G5':  { fingers: [3, 5, 5, -1, -1, -1], barres: [] },
}

// Barre chord alternatives for common open chords
// These are moveable shapes that don't require a capo
export const BARRE_CHORDS = {
  // E-shape barre chords (root on 6th string)
  'F':  { fingers: [1, 3, 3, 2, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }], label: 'E shape, 1st fret' },
  'Fm': { fingers: [1, 3, 3, 1, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }], label: 'Em shape, 1st fret' },
  'F7': { fingers: [1, 3, 1, 2, 1, 1], barres: [{ fromString: 6, toString: 1, fret: 1 }], label: 'E7 shape, 1st fret' },

  'G':  { fingers: [3, 5, 5, 5, 4, 3], barres: [{ fromString: 6, toString: 1, fret: 3 }], label: 'E shape, 3rd fret' },
  'Gm': { fingers: [3, 5, 5, 3, 3, 3], barres: [{ fromString: 6, toString: 1, fret: 3 }], label: 'Em shape, 3rd fret' },

  'Ab': { fingers: [4, 6, 6, 5, 4, 4], barres: [{ fromString: 6, toString: 1, fret: 4 }], label: 'E shape, 4th fret' },

  // A-shape barre chords (root on 5th string)
  'Bb': { fingers: [-1, 1, 3, 3, 3, 1], barres: [{ fromString: 5, toString: 1, fret: 1 }], label: 'A shape, 1st fret' },
  'Bbm':{ fingers: [-1, 1, 3, 3, 2, 1], barres: [{ fromString: 5, toString: 1, fret: 1 }], label: 'Am shape, 1st fret' },

  'B':  { fingers: [-1, 2, 4, 4, 4, 2], barres: [{ fromString: 5, toString: 1, fret: 2 }], label: 'A shape, 2nd fret' },
  'Bm': { fingers: [-1, 2, 4, 4, 3, 2], barres: [{ fromString: 5, toString: 1, fret: 2 }], label: 'Am shape, 2nd fret' },

  'C':  { fingers: [-1, 3, 5, 5, 5, 3], barres: [{ fromString: 5, toString: 1, fret: 3 }], label: 'A shape, 3rd fret' },
  'Cm': { fingers: [-1, 3, 5, 5, 4, 3], barres: [{ fromString: 5, toString: 1, fret: 3 }], label: 'Am shape, 3rd fret' },

  'C#': { fingers: [-1, 4, 6, 6, 6, 4], barres: [{ fromString: 5, toString: 1, fret: 4 }], label: 'A shape, 4th fret' },
  'C#m':{ fingers: [-1, 4, 6, 6, 5, 4], barres: [{ fromString: 5, toString: 1, fret: 4 }], label: 'Am shape, 4th fret' },

  'D':  { fingers: [-1, 5, 7, 7, 7, 5], barres: [{ fromString: 5, toString: 1, fret: 5 }], label: 'A shape, 5th fret' },
  'Dm': { fingers: [-1, 5, 7, 7, 6, 5], barres: [{ fromString: 5, toString: 1, fret: 5 }], label: 'Am shape, 5th fret' },

  // Other barre chords
  'Eb': { fingers: [-1, -1, 1, 3, 4, 3], barres: [], label: 'D shape, 1st fret' },
  'Abm':{ fingers: [4, 6, 6, 4, 4, 4], barres: [{ fromString: 6, toString: 1, fret: 4 }], label: 'Em shape, 4th fret' },
}

// Alternate tunings: how each string differs from standard EADGBE
// Positive = higher semitones, negative = lower
export const TUNINGS = {
  'Standard':      { name: 'Standard',  strings: ['E', 'A', 'D', 'G', 'B', 'E'], offsets: [0, 0, 0, 0, 0, 0] },
  'Drop D':        { name: 'Drop D',    strings: ['D', 'A', 'D', 'G', 'B', 'E'], offsets: [-2, 0, 0, 0, 0, 0] },
  'Drop C#':       { name: 'Drop C#',   strings: ['C#','A', 'D', 'G', 'B', 'E'], offsets: [-3, 0, 0, 0, 0, 0] },
  'Drop C':        { name: 'Drop C',    strings: ['C', 'A', 'D', 'G', 'B', 'E'], offsets: [-4, 0, 0, 0, 0, 0] },
  'Open G':        { name: 'Open G',    strings: ['D', 'G', 'D', 'G', 'B', 'D'], offsets: [-2, 0, 0, 0, 0, -2] },
  'Open D':        { name: 'Open D',    strings: ['D', 'A', 'D', 'F#','A', 'D'], offsets: [-2, 0, 0, -1, 0, -2] },
  'Open E':        { name: 'Open E',    strings: ['E', 'B', 'E', 'G#','B', 'E'], offsets: [0, -2, 0, 1, 0, 0] },
  'Open C':        { name: 'Open C',    strings: ['C', 'G', 'C', 'G', 'C', 'E'], offsets: [-4, -2, 0, 0, 0, 0] },
  'DADGAD':        { name: 'DADGAD',    strings: ['D', 'A', 'D', 'G', 'A', 'D'], offsets: [-2, 0, 0, 0, -2, -2] },
  'Half Step Down':{ name: 'Half Step Down', strings: ['Eb','Ab','Db','Gb','Bb','Eb'], offsets: [-1, -1, -1, -1, -1, -1] },
  'Whole Step Down':{ name: 'Whole Step Down', strings: ['D', 'G', 'C', 'F', 'A', 'D'], offsets: [-2, -2, -2, -2, -2, -2] },
}

// Extract unique chord names from chord chart text
export function extractChordNames(text) {
  const matches = text.match(/\[([^\]]+)\]/g) || []
  const unique = new Set(matches.map(m => m.slice(1, -1)))
  return [...unique]
}

// Get chord data — returns open shape or barre shape based on preference
export function getChord(name, useBarre = false) {
  if (useBarre && BARRE_CHORDS[name]) {
    return BARRE_CHORDS[name]
  }
  return CHORDS[name] || null
}

// Check if a chord has a barre alternative
export function hasBarreShape(name) {
  return !!BARRE_CHORDS[name]
}

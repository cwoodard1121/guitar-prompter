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
  'Gsus2':  { fingers: [3, 0, 0, 0, 3, 3], barres: [] },
  'Gsus4':  { fingers: [3, 3, 0, 0, 1, 3], barres: [] },
  'Csus2':  { fingers: [-1, 3, 0, 0, 1, 0], barres: [] },

  // Add9 chords
  'Cadd9':  { fingers: [-1, 3, 2, 0, 3, 0], barres: [] },
  'Dadd9':  { fingers: [-1, -1, 0, 2, 3, 0], barres: [] },
  'Gadd9':  { fingers: [3, 2, 0, 0, 0, 5], barres: [] },

  // Slash chords (chord/bass note)
  'D/F#':   { fingers: [2, -1, 0, 2, 3, 2], barres: [] },
  'G/B':    { fingers: [-1, 2, 0, 0, 0, 3], barres: [] },
  'C/G':    { fingers: [3, 3, 2, 0, 1, 0], barres: [] },
  'A/G':    { fingers: [3, 0, 2, 2, 2, 0], barres: [] },
  'F/C':    { fingers: [-1, 3, 3, 2, 1, 1], barres: [] },
  'Em/B':   { fingers: [-1, 2, 2, 0, 0, 0], barres: [] },
  'Am/G':   { fingers: [3, 0, 2, 2, 1, 0], barres: [] },
  'E/B':    { fingers: [-1, 2, 2, 1, 0, 0], barres: [] },

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

// Chromatic scale for transposition (enharmonic pairs handled by preference)
const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' }

// Regex to validate a chord name (supports slash chords like D/F#, A/G)
const CHORD_PATTERN = /^[A-G][#b]?(?:m(?:aj7|7)?|7|sus2|sus4|add9|5)?(?:\/[A-G][#b]?)?$/

// Check if a string is a valid chord name
export function isValidChord(name) {
  return CHORD_PATTERN.test(name) && (name in CHORDS)
}

// Extract unique valid chord names from chord chart text
export function extractChordNames(text) {
  const matches = text.match(/\[([^\]]+)\]/g) || []
  const names = matches.map(m => m.slice(1, -1))
  // Only keep names that match the chord pattern AND exist in our database
  const unique = new Set(names.filter(n => isValidChord(n)))
  return [...unique]
}

// Get chord data
export function getChord(name) {
  return CHORDS[name] || null
}

// Transpose a single chord name by N semitones
// e.g. transposeChord('C', 1) => 'C#', transposeChord('Am', 1) => 'A#m'
// Handles slash chords: transposeChord('D/F#', 1) => 'D#/G'
export function transposeChord(name, semitones) {
  if (!semitones) return name

  // Handle slash chords — transpose both root and bass
  if (name.includes('/')) {
    const [main, bass] = name.split('/')
    return transposeChord(main, semitones) + '/' + transposeChord(bass, semitones)
  }

  const match = name.match(/^([A-G][#b]?)(.*)$/)
  if (!match) return name

  let [, root, modifier] = match

  // Normalize flats to sharps for indexing
  let normalized = root
  if (root.length === 2 && root[1] === 'b') {
    const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' }
    normalized = flatToSharp[root] || root
  }

  let idx = CHROMATIC.indexOf(normalized)
  if (idx === -1) return name

  idx = ((idx + semitones) % 12 + 12) % 12
  let newRoot = CHROMATIC[idx]

  // Use flat names for certain roots to keep it readable
  if (FLAT_NAMES[newRoot] && (root.includes('b') || ['Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(root))) {
    newRoot = FLAT_NAMES[newRoot]
  }

  return newRoot + modifier
}

// Transpose all chords in a chord chart text
export function transposeContent(text, semitones) {
  if (!semitones) return text
  return text.replace(/\[([^\]]+)\]/g, (match, chord) => {
    if (isValidChord(chord)) {
      return `[${transposeChord(chord, semitones)}]`
    }
    return match
  })
}

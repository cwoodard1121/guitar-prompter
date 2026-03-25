// Parse Ultimate Guitar style tab text into our bracket format
// Handles:
//   1. Chord-over-lyric format (chords on line above lyrics)
//   2. Inline [Chord] format
//   3. Section labels like [Verse 1], [Chorus], etc.
//   4. Chord-only sections (intros, outros)

// Regex to detect a chord token: starts with A-G, optional #/b, optional modifier
const CHORD_TOKEN = /^[A-G][#b]?(?:m(?:aj7|7)?|7|sus2|sus4|add9|dim|aug|5)?(?:\/[A-G][#b]?)?$/

// Check if a line contains only chord tokens and whitespace
function isChordOnlyLine(line) {
  if (!line.trim()) return false
  const tokens = line.trim().split(/\s+/)
  return tokens.length > 0 && tokens.every(t => CHORD_TOKEN.test(t))
}

// Check if a line is a section label like [Verse 1], [Chorus], etc.
function isSectionLabel(line) {
  return /^\s*\[.*\]\s*$/.test(line.trim()) && !isChordOnlyLine(line)
}

// Extract chords and their column positions from a chord-only line
function parseChordLine(line) {
  const chords = []
  const re = /([A-G][#b]?(?:m(?:aj7|7)?|7|sus2|sus4|add9|dim|aug|5)?(?:\/[A-G][#b]?)?)/g
  let m
  while ((m = re.exec(line)) !== null) {
    chords.push({ chord: m[1], col: m.index })
  }
  return chords
}

// Convert a chord+lyric pair into our bracket format
// Chord at col X aligns with lyric character at col X
function alignChordToLyric(chords, lyric) {
  if (!chords.length) return lyric
  if (!lyric.trim()) {
    // No lyric — just show chords
    return chords.map(c => `[${c.chord}]`).join('  ')
  }

  // Build a character array for the lyric
  const lyricChars = lyric.split('')
  const chordMap = new Map() // position -> chord name

  for (const { chord, col } of chords) {
    // Find the nearest non-space character at or after this column
    let pos = col
    while (pos < lyricChars.length && lyricChars[pos] === ' ') {
      pos++
    }
    if (pos >= lyricChars.length) {
      pos = lyricChars.length // past end of lyric
    }
    chordMap.set(pos, chord)
  }

  // Build the bracket format: [Chord]lyric text
  let result = ''
  for (let i = 0; i < lyricChars.length; i++) {
    if (chordMap.has(i)) {
      result += `[${chordMap.get(i)}]`
    }
    result += lyricChars[i]
  }
  // Any chords past the lyric go at the end
  for (const [pos, chord] of chordMap) {
    if (pos >= lyricChars.length) {
      result += ` [${chord}]`
    }
  }

  return result.trimEnd()
}

// Main parser: convert raw tab text to our bracket format
export function parseTabText(raw) {
  if (!raw || !raw.trim()) return ''

  const lines = raw.split('\n')
  const output = []
  let pendingChords = null
  let currentSection = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip empty lines — preserve them as spacing
    if (!line.trim()) {
      if (pendingChords) {
        // Chord line with no lyric below — output as chord-only
        output.push(pendingChords.map(c => `[${c.chord}]`).join('  '))
        pendingChords = null
      }
      output.push('')
      continue
    }

    // Section labels like [Verse 1] — skip, we don't need them in our format
    if (isSectionLabel(line)) {
      if (pendingChords) {
        output.push(pendingChords.map(c => `[${c.chord}]`).join('  '))
        pendingChords = null
      }
      continue
    }

    // Chord-only line — store it to pair with the next lyric line
    if (isChordOnlyLine(line)) {
      if (pendingChords) {
        // Two chord lines in a row — output the first one as chord-only
        output.push(pendingChords.map(c => `[${c.chord}]`).join('  '))
      }
      pendingChords = parseChordLine(line)
      continue
    }

    // Lyric line
    if (pendingChords) {
      // Pair the pending chords with this lyric
      output.push(alignChordToLyric(pendingChords, line))
      pendingChords = null
    } else {
      // No pending chords — check for inline [Chord] format
      if (line.includes('[') && /\[[A-G]/.test(line)) {
        // Already has inline chords — keep as-is
        output.push(line)
      } else {
        // Plain lyric line with no chords
        output.push(line)
      }
    }
  }

  // Handle any remaining chord line at the end
  if (pendingChords) {
    output.push(pendingChords.map(c => `[${c.chord}]`).join('  '))
  }

  return output.join('\n')
}

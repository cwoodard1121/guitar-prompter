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

// Check if a line is already in bracket chord format like [E] [Am] [G7]
function isBracketChordLine(line) {
  if (!line.trim()) return false
  const tokens = line.trim().split(/\s+/)
  return tokens.length > 0 && tokens.every(t =>
    /^\[/.test(t) && /\]$/.test(t) && CHORD_TOKEN.test(t.slice(1, -1))
  )
}

// Check if a line is a section label like [Verse 1], [Chorus], etc.
function isSectionLabel(line) {
  return /^\s*\[[^\]]*\]\s*$/.test(line.trim()) && !isChordOnlyLine(line) && !isBracketChordLine(line)
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

// Convert inline [Chord] format to our bracket format
// Input: "[G]long, [D/F#]long tim[Em]e ago"
// Output: "[G]  [D/F#]        [Em]\nlong, long time ago"
function convertInlineChords(line) {
  const chordPattern = /\[([A-G][#b]?(?:m(?:aj7|7)?|7|sus2|sus4|add9|dim|aug|5)?(?:\/[A-G][#b]?)?)\]/g

  const chords = []
  const textParts = []
  let lastEnd = 0
  let lyricsPos = 0
  let m

  // Extract chords and track their positions in the pure lyric text
  while ((m = chordPattern.exec(line)) !== null) {
    // Text before this chord
    const textBefore = line.substring(lastEnd, m.index)
    textParts.push(textBefore)
    lyricsPos += textBefore.length

    // Record chord position
    chords.push({ chord: m[1], col: lyricsPos })

    lastEnd = m.index + m[0].length
  }

  // Text after last chord
  textParts.push(line.substring(lastEnd))

  // Build pure lyric
  const lyric = textParts.join('')

  // If no chords found, return as-is
  if (chords.length === 0) {
    return line
  }

  // Use alignChordToLyric to create the two-line format
  return alignChordToLyric(chords, lyric)
}

// Convert a chord+lyric pair into two-line format for the teleprompter
// Builds a chord line where bracket positions match lyric character positions
function alignChordToLyric(chords, lyric) {
  if (!chords.length) return lyric
  if (!lyric.trim()) {
    // No lyric — just show chords
    return chords.map(c => `[${c.chord}]`).join('  ')
  }

  // Sort chords by column position
  const sortedChords = [...chords].sort((a, b) => a.col - b.col)

  // Build chord line character by character
  // Create a buffer as long as the lyric plus space for trailing chords
  const buffer = []
  let bufferPos = 0

  for (const { chord, col } of sortedChords) {
    // Pad with spaces up to this chord's position in the lyric
    while (bufferPos < col) {
      buffer.push(' ')
      bufferPos++
    }

    // Add the chord bracket
    const chordStr = `[${chord}]`
    buffer.push(chordStr)
    bufferPos += chordStr.length
  }

  const chordLine = buffer.join('')
  return chordLine + '\n' + lyric
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

    // Already-formatted bracket chord line like [E] [Am] [G7] — treat as pending chords
    if (isBracketChordLine(line)) {
      if (pendingChords) {
        output.push(pendingChords.map(c => `[${c.chord}]`).join('  '))
      }
      const re = /\[([^\]]+)\]/g
      let m
      pendingChords = []
      while ((m = re.exec(line)) !== null) {
        pendingChords.push({ chord: m[1], col: m.index })
      }
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
        // Convert inline chords to bracket format
        output.push(convertInlineChords(line))
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

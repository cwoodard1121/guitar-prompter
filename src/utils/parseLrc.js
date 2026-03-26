/**
 * Parse an LRC string into an array of timed lyric lines.
 * Returns [{time: seconds, text: string}] sorted by time.
 */
export function parseLrc(lrc) {
  const lines = []
  const re = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g
  let m
  while ((m = re.exec(lrc)) !== null) {
    const ms = m[3].padEnd(3, '0')
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(ms) / 1000
    const text = m[4].trim()
    if (text) lines.push({ time, text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

/**
 * Match LRC timed lines to parsedLines indices.
 * Returns number[] — one entry per parsedLines index, value is start time in seconds or null.
 * Blank and chord-only lines always get null.
 */
export function matchLrcToLines(lrcLines, parsedLines) {
  const timings = new Array(parsedLines.length).fill(null)

  // Build candidates: non-blank, non-chord-only lines with lyric text
  const candidates = parsedLines
    .map((line, i) => {
      if (line.type === 'blank' || line.type === 'chord-only') return null
      const text =
        line.type === 'chord-lyric'
          ? line.segments.map(s => s.lyric).join('')
          : line.text ?? ''
      return { i, normalized: normalizeText(text) }
    })
    .filter(Boolean)

  // Greedy forward match: for each chord-chart candidate, find best LRC line
  let lrcIdx = 0
  let totalMatched = 0
  for (const { i, normalized } of candidates) {
    if (lrcIdx >= lrcLines.length) break
    let bestScore = -1
    let bestJ = lrcIdx
    const window = Math.min(lrcIdx + 8, lrcLines.length)
    for (let j = lrcIdx; j < window; j++) {
      const score = wordOverlap(normalized, lrcLines[j].text.toLowerCase())
      if (score > bestScore) { bestScore = score; bestJ = j }
    }
    if (bestScore > 0) {
      timings[i] = lrcLines[bestJ].time
      lrcIdx = bestJ + 1
      totalMatched++
    }
  }

  // Positional fallback: if word-overlap matched nothing (e.g. AI-generated placeholder
  // lyrics like "da da da"), distribute LRC timestamps across lyric lines by index order
  if (totalMatched === 0 && candidates.length > 0 && lrcLines.length > 0) {
    for (let k = 0; k < candidates.length; k++) {
      const lrcK = Math.round((k / candidates.length) * lrcLines.length)
      timings[candidates[k].i] = lrcLines[Math.min(lrcK, lrcLines.length - 1)].time
    }
  }

  // Forward-fill: carry last known time to unmatched lyric lines
  let carry = null
  for (let i = 0; i < timings.length; i++) {
    if (timings[i] !== null) {
      carry = timings[i]
    } else if (parsedLines[i].type !== 'blank' && parsedLines[i].type !== 'chord-only') {
      timings[i] = carry
    }
  }

  return timings
}

function normalizeText(s) {
  return s.replace(/\[[\w#b/]+\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function wordOverlap(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2))
  const wb = b.split(' ').filter(w => w.length > 2)
  return wb.filter(w => wa.has(w)).length
}

import { ref, computed } from 'vue'

// How long each audio chunk covers (ms). Shorter = more responsive but more API calls.
const CHUNK_MS        = 5000
// Rolling transcript window: how many recent chunks to keep joined for matching
const TRANSCRIPT_KEEP = 3
// How far (seconds) from current position we search for a lyric match
// Keep tight: too wide and repeated chorus lines match the wrong occurrence
const SEARCH_WINDOW   = 20
// Minimum score to show a match in the UI (low — just for display)
const DISPLAY_THRESHOLD = 0.20
// Minimum score to trigger an auto-seek correction (high — must be very confident)
const SEEK_THRESHOLD    = 0.65
// Don't auto-seek unless matched line is at least this far from current position
const MIN_SEEK_DELTA    = 4.0
// Don't fire corrections faster than this (seconds)
const CORRECTION_COOLDOWN = 15
// Require this many consecutive chunks agreeing on the same line before seeking
const SEEK_CONFIRM_COUNT  = 2

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

// ── Phonetic encoding (simplified Metaphone) ─────────────────────────────────
// Collapses similar-sounding consonants so mishearings still match.
// e.g. "gonna" → "KN", "going" → "KNK", "love" → "LF", "luv" → "LF"
function phonetic(word) {
  let s = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!s) return ''

  // Common contractions / reductions
  s = s.replace(/gonna/g, 'going')
       .replace(/wanna/g, 'want')
       .replace(/gotta/g, 'got')
       .replace(/kinda/g, 'kind')
       .replace(/lotta/g, 'lot')
       .replace(/outta/g, 'out')
       .replace(/tryna/g, 'trying')

  // Drop silent initial combos
  s = s.replace(/^kn/, 'n')
       .replace(/^wr/, 'r')
       .replace(/^ae/, 'e')
       .replace(/^gn/, 'n')

  // Normalise common vowel clusters before encoding
  s = s.replace(/igh/g, 'i')
       .replace(/ough/g, 'o')
       .replace(/augh/g, 'af')
       .replace(/ph/g, 'f')
       .replace(/ck/g, 'k')
       .replace(/qu/g, 'k')
       .replace(/th/g, '0') // placeholder for th sound
       .replace(/sh/g, '6')
       .replace(/ch/g, '6')

  // Map consonants to phonetic class codes
  s = s.replace(/[bfpv]/g, '1')   // labial
       .replace(/[cgjkqsxyz]/g, '2') // velar/sibilant
       .replace(/[dt0]/g, '3')    // dental (incl. th)
       .replace(/[l]/g, '4')
       .replace(/[mn]/g, '5')
       .replace(/[r]/g, '6')
       .replace(/[6]/g, '7')      // sh/ch group
       .replace(/[aeiou]/g, '')   // drop all vowels
       .replace(/h/g, '')         // drop H

  // Collapse runs of same code
  s = s.replace(/(.)\1+/g, '$1')

  return s
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// Jaccard on phonetic codes (set overlap, order-independent)
function phoneticJaccard(aCodes, bCodes) {
  if (!aCodes.length || !bCodes.length) return 0
  const setA = new Set(aCodes)
  const setB = new Set(bCodes)
  let inter = 0
  for (const c of setA) if (setB.has(c)) inter++
  return inter / (setA.size + setB.size - inter)
}

// LCS length (dynamic programming) — respects word order
function lcsLength(a, b) {
  const m = a.length, n = b.length
  const dp = new Array(m + 1).fill(null).map(() => new Int16Array(n + 1))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  return dp[m][n]
}

// Combined score: 40% phonetic Jaccard + 60% LCS coverage of the lyric line
function matchScore(transcriptWords, lineWords) {
  if (!transcriptWords.length || !lineWords.length) return 0
  const tCodes = transcriptWords.map(phonetic).filter(Boolean)
  const lCodes = lineWords.map(phonetic).filter(Boolean)
  if (!tCodes.length || !lCodes.length) return 0

  const jaccard = phoneticJaccard(tCodes, lCodes)
  // LCS coverage: how much of the lyric line is covered by the transcript (in order)
  const lcs     = lcsLength(tCodes, lCodes)
  const coverage = lcs / lCodes.length

  return jaccard * 0.4 + coverage * 0.6
}

export function useLyricSync(lrcLines, currentElapsed) {
  const lyricActive    = ref(false)
  const lastTranscript = ref('')          // most recent chunk text from Whisper
  const matchedLine    = ref(null)        // { idx, text, time, score } or null
  const suggestedSeek  = ref(null)        // seconds to seek to (drift correction), or null
  const initialSeek    = ref(null)        // first-lock seek: starts the clock from here
  const lyricLocked    = ref(false)       // true once initial lock has fired
  const debugInfo      = ref({ chunksSent: 0, lastScore: 0, lastDelta: 0, error: '' })

  let stream          = null
  let recorder        = null
  let chunkTimer      = null
  let transcriptBuf    = []              // rolling array of recent transcript strings
  let lastCorrectionAt = -Infinity
  let confirmIdx       = -1             // line idx that is building confirmation streak
  let confirmCount     = 0              // how many consecutive chunks matched confirmIdx
  let initialLocked    = false          // true once we've fired the first-lock seek

  // ── Transcription ──────────────────────────────────────────────────────────
  async function sendChunk(blob, chunkStartedAt) {
    debugInfo.value.chunksSent++
    const fetchStart = performance.now()
    try {
      const base64 = await blobToBase64(blob)
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: blob.type || 'audio/webm' })
      })
      if (!res.ok) { debugInfo.value.error = `HTTP ${res.status}`; return }
      const { text } = await res.json()
      if (!text?.trim()) return

      // Latency: how long since the middle of the chunk was recorded
      // midpoint of chunk = chunkStartedAt + CHUNK_MS/2
      // round-trip API delay = performance.now() - fetchStart
      const audioMidpointAge = (performance.now() - chunkStartedAt - CHUNK_MS / 2) / 1000
      const apiDelay         = (performance.now() - fetchStart) / 1000
      const totalLatency     = audioMidpointAge  // seconds of audio age at time of match

      lastTranscript.value = text.trim()
      transcriptBuf.push(text)
      if (transcriptBuf.length > TRANSCRIPT_KEEP) transcriptBuf.shift()

      matchAgainstLyrics(totalLatency)
    } catch (err) {
      debugInfo.value.error = err.message
    }
  }

  // ── Matching ───────────────────────────────────────────────────────────────
  function matchAgainstLyrics(audioAge = 0) {
    const lines = typeof lrcLines?.value !== 'undefined' ? lrcLines.value : lrcLines
    if (!lines?.length) return

    // currentElapsed is where the scroll is RIGHT NOW, but the audio we transcribed
    // was from ~audioAge seconds ago — so we search around where we were then
    const nowElapsed = typeof currentElapsed?.value !== 'undefined'
      ? currentElapsed.value : currentElapsed
    const elapsed = nowElapsed - audioAge

    // Combine rolling transcript buffer into one normalized word list
    const transcriptWords = normalize(transcriptBuf.join(' '))
    if (!transcriptWords.length) return

    let bestScore = 0
    let bestIdx   = -1

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Skip lines outside the search window
      if (Math.abs(line.time - elapsed) > SEARCH_WINDOW) continue
      // Skip blank or chord-only lines
      const lineText = line.text?.replace(/\[.*?\]/g, '').trim()
      if (!lineText) continue

      const lineWords = normalize(lineText)
      if (!lineWords.length) continue

      let score = matchScore(transcriptWords, lineWords)

      // Boost score for lines close to current position (smooth falloff)
      const proximity = Math.max(0, 1 - Math.abs(line.time - elapsed) / SEARCH_WINDOW)
      score = score * 0.7 + score * proximity * 0.3

      if (score > bestScore) {
        bestScore = score
        bestIdx   = i
      }
    }

    debugInfo.value.lastScore = +bestScore.toFixed(3)

    if (bestScore >= DISPLAY_THRESHOLD && bestIdx !== -1) {
      const line = lines[bestIdx]
      // Seek target: matched line time + audio latency = where we should be right now
      const seekTarget = line.time + audioAge
      matchedLine.value = { idx: bestIdx, text: line.text, time: line.time, score: bestScore }

      // delta vs current position (after latency correction)
      const delta = seekTarget - nowElapsed
      debugInfo.value.lastDelta = +delta.toFixed(1)

      // Confirmation streak: only seek if the same line wins SEEK_CONFIRM_COUNT times in a row
      if (bestIdx === confirmIdx) {
        confirmCount++
      } else {
        confirmIdx   = bestIdx
        confirmCount = 1
      }

      const now = Date.now() / 1000
      if (bestScore >= SEEK_THRESHOLD && confirmCount >= SEEK_CONFIRM_COUNT) {
        if (!initialLocked) {
          // First confident lock — start the clock from this position
          initialSeek.value  = seekTarget
          initialLocked      = true
          lyricLocked.value  = true
          lastCorrectionAt  = now
          confirmCount      = 0
        } else if (
          Math.abs(delta) >= MIN_SEEK_DELTA &&
          now - lastCorrectionAt > CORRECTION_COOLDOWN
        ) {
          // Subsequent drift correction — only nudge if meaningfully off
          suggestedSeek.value = seekTarget
          lastCorrectionAt    = now
          confirmCount        = 0
        }
      }
    } else {
      matchedLine.value = null
      confirmIdx   = -1
      confirmCount = 0
    }
  }

  // ── Recording loop ─────────────────────────────────────────────────────────
  function startChunk() {
    if (!stream || !lyricActive.value) return

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

    recorder = new MediaRecorder(stream, { mimeType })
    const chunks = []
    const chunkStartedAt = performance.now()   // wall-clock when recording began
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      if (chunks.length) sendChunk(new Blob(chunks, { type: mimeType }), chunkStartedAt)
    }
    recorder.start()
    chunkTimer = setTimeout(() => {
      if (recorder?.state === 'recording') recorder.stop()
      if (lyricActive.value) startChunk()
    }, CHUNK_MS)
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  function _activate(mediaStream) {
    stream = mediaStream
    transcriptBuf = []
    lastCorrectionAt = -Infinity
    confirmIdx    = -1
    confirmCount  = 0
    initialLocked      = false
    lyricLocked.value  = false
    matchedLine.value   = null
    suggestedSeek.value = null
    initialSeek.value   = null
    debugInfo.value = { chunksSent: 0, lastScore: 0, lastDelta: 0, error: '' }
    lyricActive.value = true
    startChunk()
  }

  async function startLyricSync() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      _activate(s)
    } catch (err) {
      console.warn('Lyric sync mic failed:', err)
    }
  }

  async function startWithFile(file) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const audio = new Audio(URL.createObjectURL(file))
    audio.crossOrigin = 'anonymous'
    const src  = audioCtx.createMediaElementSource(audio)
    const dest = audioCtx.createMediaStreamDestination()
    src.connect(dest)
    src.connect(audioCtx.destination)   // also play out loud
    audio.play()
    _activate(dest.stream)
  }

  function stopLyricSync() {
    lyricActive.value = false
    clearTimeout(chunkTimer)
    if (recorder?.state === 'recording') recorder.stop()
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
    recorder = null
    matchedLine.value   = null
    suggestedSeek.value = null
    initialSeek.value   = null
    lastTranscript.value = ''
    transcriptBuf = []
    initialLocked     = false
    lyricLocked.value = false
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Confidence 0–100 based on latest match score
  const matchConfidence = computed(() => {
    const s = matchedLine.value?.score ?? 0
    return Math.round(s * 100)
  })

  return {
    startLyricSync,
    startWithFile,
    stopLyricSync,
    lyricActive,
    lyricLocked,
    lastTranscript,
    matchedLine,
    matchConfidence,
    suggestedSeek,
    initialSeek,
    debugInfo,
  }
}

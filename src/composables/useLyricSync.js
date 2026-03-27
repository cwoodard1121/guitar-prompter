import { ref, computed } from 'vue'

// How long each audio chunk covers (ms). Shorter = more responsive but more API calls.
const CHUNK_MS        = 5000
// Rolling transcript window: how many recent chunks to keep joined for matching
const TRANSCRIPT_KEEP = 3
// How far (seconds) from current position we search for a lyric match
const SEARCH_WINDOW   = 90
// Minimum Jaccard-like score to consider a match valid
const MATCH_THRESHOLD = 0.25
// Don't auto-seek unless matched line is at least this far from current position
const MIN_SEEK_DELTA  = 3.0
// Don't fire corrections faster than this (seconds)
const CORRECTION_COOLDOWN = 10

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

// Jaccard-like word overlap: intersection / union of word sets
function wordScore(aWords, bWords) {
  if (!aWords.length || !bWords.length) return 0
  const setA = new Set(aWords)
  const setB = new Set(bWords)
  let intersection = 0
  for (const w of setA) if (setB.has(w)) intersection++
  return intersection / (setA.size + setB.size - intersection)
}

export function useLyricSync(lrcLines, currentElapsed) {
  const lyricActive    = ref(false)
  const lastTranscript = ref('')          // most recent chunk text from Whisper
  const matchedLine    = ref(null)        // { idx, text, time, score } or null
  const suggestedSeek  = ref(null)        // seconds to seek to, or null
  const debugInfo      = ref({ chunksSent: 0, lastScore: 0, lastDelta: 0, error: '' })

  let stream          = null
  let recorder        = null
  let chunkTimer      = null
  let transcriptBuf   = []              // rolling array of recent transcript strings
  let lastCorrectionAt = -Infinity

  // ── Transcription ──────────────────────────────────────────────────────────
  async function sendChunk(blob) {
    debugInfo.value.chunksSent++
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

      lastTranscript.value = text.trim()
      transcriptBuf.push(text)
      if (transcriptBuf.length > TRANSCRIPT_KEEP) transcriptBuf.shift()

      matchAgainstLyrics()
    } catch (err) {
      debugInfo.value.error = err.message
    }
  }

  // ── Matching ───────────────────────────────────────────────────────────────
  function matchAgainstLyrics() {
    const lines = typeof lrcLines?.value !== 'undefined' ? lrcLines.value : lrcLines
    if (!lines?.length) return

    const elapsed = typeof currentElapsed?.value !== 'undefined'
      ? currentElapsed.value : currentElapsed

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

      let score = wordScore(transcriptWords, lineWords)

      // Boost score for lines close to current position (smooth falloff)
      const proximity = Math.max(0, 1 - Math.abs(line.time - elapsed) / SEARCH_WINDOW)
      score = score * 0.7 + score * proximity * 0.3

      if (score > bestScore) {
        bestScore = score
        bestIdx   = i
      }
    }

    debugInfo.value.lastScore = +bestScore.toFixed(3)

    if (bestScore >= MATCH_THRESHOLD && bestIdx !== -1) {
      const line = lines[bestIdx]
      matchedLine.value = { idx: bestIdx, text: line.text, time: line.time, score: bestScore }

      const delta = line.time - elapsed
      debugInfo.value.lastDelta = +delta.toFixed(1)

      const now = Date.now() / 1000
      if (
        Math.abs(delta) >= MIN_SEEK_DELTA &&
        now - lastCorrectionAt > CORRECTION_COOLDOWN
      ) {
        suggestedSeek.value = line.time
        lastCorrectionAt = now
      }
    } else {
      matchedLine.value = null
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
    recorder.ondataavailable = e => { if (e.data?.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      if (chunks.length) sendChunk(new Blob(chunks, { type: mimeType }))
    }
    recorder.start()
    chunkTimer = setTimeout(() => {
      if (recorder?.state === 'recording') recorder.stop()
      if (lyricActive.value) startChunk()
    }, CHUNK_MS)
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  async function startLyricSync() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      transcriptBuf = []
      lastCorrectionAt = -Infinity
      matchedLine.value = null
      suggestedSeek.value = null
      debugInfo.value = { chunksSent: 0, lastScore: 0, lastDelta: 0, error: '' }
      lyricActive.value = true
      startChunk()
    } catch (err) {
      console.warn('Lyric sync mic failed:', err)
    }
  }

  function stopLyricSync() {
    lyricActive.value = false
    clearTimeout(chunkTimer)
    if (recorder?.state === 'recording') recorder.stop()
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
    recorder = null
    matchedLine.value = null
    suggestedSeek.value = null
    lastTranscript.value = ''
    transcriptBuf = []
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
    stopLyricSync,
    lyricActive,
    lastTranscript,
    matchedLine,
    matchConfidence,
    suggestedSeek,
    debugInfo,
  }
}

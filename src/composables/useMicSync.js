import { ref, computed } from 'vue'

// Beat/tempo detection using spectral flux on drum frequency bands.
// Spectral flux = energy INCREASE between consecutive frames.
// This works in a live band mix because beats cause sudden energy jumps
// regardless of the background level — no rolling average needed.

const MIN_ONSET_INTERVAL = 0.25  // 240 BPM max — filters hi-hats
const FLUX_THRESHOLD     = 8     // flux spike (0–255 scale) needed to register a beat
const ONSET_WINDOW       = 10    // onsets kept for BPM interval calculation
const BPM_OUTPUT_HISTORY = 8     // median of last N BPM estimates for stable display
const GRAPH_SIZE         = 300   // frames of scrolling graph history
const WARMUP_FRAMES      = 5     // skip first few frames (prev buffer starts empty)

export function useMicSync(songBpm) {
  const micActive   = ref(false)
  const detectedBPM = ref(null)
  const debugEnergy = ref({ kick: 0, snare: 0, flux: 0 }) // dev only

  let audioCtx = null
  let analyser = null
  let stream   = null
  let rafId    = null

  // Previous frame's frequency data (for flux calculation)
  let prevFreq = null
  let frameCount = 0

  // Onset + BPM state
  const onsetTimes   = []
  const bpmEstimates = []
  let lastOnsetTime  = -Infinity

  // Graph history
  const graphLog = Array.from({ length: GRAPH_SIZE }, () => ({ kick: 0, snare: 0, flux: 0, beat: false }))
  let graphIdx = 0

  // Bin ranges computed once after AudioContext is ready
  let kickStart = 1, kickEnd = 3, snareStart = 3, snareEnd = 11

  function computeBinRanges() {
    const binWidth = audioCtx.sampleRate / analyser.fftSize
    kickStart  = Math.max(1, Math.round(50  / binWidth))
    kickEnd    = Math.round(200 / binWidth)
    snareStart = kickEnd + 1
    snareEnd   = Math.round(400 / binWidth)
  }

  function processAudio() {
    if (!analyser || !audioCtx) return

    const bufLen  = analyser.frequencyBinCount
    const freqBuf = new Uint8Array(bufLen)
    analyser.getByteFrequencyData(freqBuf)

    frameCount++
    if (frameCount < WARMUP_FRAMES) {
      prevFreq = freqBuf.slice()
      rafId = requestAnimationFrame(processAudio)
      return
    }

    // Spectral flux: sum of positive energy increases per band
    // Values are 0–255 per bin, normalized by bin count → flux range ~0–255
    let kickFlux = 0, snareFlux = 0
    for (let i = kickStart; i <= kickEnd; i++) {
      const diff = freqBuf[i] - prevFreq[i]
      if (diff > 0) kickFlux += diff
    }
    for (let i = snareStart; i <= snareEnd; i++) {
      const diff = freqBuf[i] - prevFreq[i]
      if (diff > 0) snareFlux += diff
    }
    kickFlux  /= (kickEnd  - kickStart  + 1)
    snareFlux /= (snareEnd - snareStart + 1)

    // Combined flux: kick weighted higher
    const flux = kickFlux * 0.7 + snareFlux * 0.3

    prevFreq = freqBuf.slice()

    debugEnergy.value = {
      kick:  +kickFlux.toFixed(2),
      snare: +snareFlux.toFixed(2),
      flux:  +flux.toFixed(2),
    }

    const now  = audioCtx.currentTime
    const gap  = now - lastOnsetTime
    const beat = flux > FLUX_THRESHOLD && gap > MIN_ONSET_INTERVAL

    graphLog[graphIdx % GRAPH_SIZE] = { kick: kickFlux, snare: snareFlux, flux, beat }
    graphIdx++

    if (beat) {
      lastOnsetTime = now
      onsetTimes.push(now)
      if (onsetTimes.length > ONSET_WINDOW) onsetTimes.shift()

      if (onsetTimes.length >= 4) {
        const intervals = []
        for (let i = 1; i < onsetTimes.length; i++) {
          const iv = onsetTimes[i] - onsetTimes[i - 1]
          if (iv >= 0.25 && iv <= 2.0) intervals.push(iv)
        }
        if (intervals.length >= 2) {
          const sorted = [...intervals].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          let candidate = Math.round(60 / median)

          // Octave correction using song BPM as reference
          const ref = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
          if (ref) {
            const options = [candidate]
            const doubled = candidate * 2
            const halved  = Math.round(candidate / 2)
            if (doubled >= 30 && doubled <= 240) options.push(doubled)
            if (halved  >= 30 && halved  <= 240) options.push(halved)
            candidate = options.reduce((a, b) =>
              Math.abs(a - ref) < Math.abs(b - ref) ? a : b
            )
          }

          bpmEstimates.push(candidate)
          if (bpmEstimates.length > BPM_OUTPUT_HISTORY) bpmEstimates.shift()
          const outSorted = [...bpmEstimates].sort((a, b) => a - b)
          detectedBPM.value = outSorted[Math.floor(outSorted.length / 2)]
        }
      }
    }

    rafId = requestAnimationFrame(processAudio)
  }

  function _initAnalyser() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.2
    computeBinRanges()
    prevFreq       = new Uint8Array(analyser.frequencyBinCount).fill(0)
    frameCount     = 0
    onsetTimes.length   = 0
    bpmEstimates.length = 0
    lastOnsetTime  = -Infinity
    graphIdx = 0
    graphLog.forEach(g => { g.kick = 0; g.snare = 0; g.flux = 0; g.beat = false })
    micActive.value = true
    audioCtx.resume()
    rafId = requestAnimationFrame(processAudio)
  }

  async function startMicSync() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      _initAnalyser()
      audioCtx.createMediaStreamSource(stream).connect(analyser)
    } catch (err) {
      console.warn('Mic access failed:', err)
    }
  }

  async function startWithFile(file) {
    const audio = new Audio(URL.createObjectURL(file))
    audio.crossOrigin = 'anonymous'
    _initAnalyser()
    const source = audioCtx.createMediaElementSource(audio)
    source.connect(analyser)
    source.connect(audioCtx.destination)
    audio.play()
  }

  function stopMicSync() {
    if (rafId)    { cancelAnimationFrame(rafId); rafId = null }
    if (stream)   { stream.getTracks().forEach(t => t.stop()); stream = null }
    if (audioCtx) { audioCtx.close(); audioCtx = null }
    analyser          = null
    micActive.value   = false
    detectedBPM.value = null
  }

  function drawGraph(canvas) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const MID = Math.floor(H / 2)

    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, W, H)

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, MID); ctx.lineTo(W, MID); ctx.stroke()

    // Beat flashes (full height)
    ctx.fillStyle = 'rgba(255,80,80,0.2)'
    for (let i = 0; i < GRAPH_SIZE; i++) {
      if (graphLog[(graphIdx + i) % GRAPH_SIZE].beat) {
        ctx.fillRect((i / GRAPH_SIZE) * W - 1, 0, 3, H)
      }
    }

    const drawLine = (color, getter, top, height, maxVal) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < GRAPH_SIZE; i++) {
        const val = getter(graphLog[(graphIdx + i) % GRAPH_SIZE])
        const x = (i / GRAPH_SIZE) * W
        const y = top + height - Math.min(1, val / maxVal) * height
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    // ── Top half: combined flux + threshold ──────────────────
    const maxFlux = Math.max(FLUX_THRESHOLD * 3, ...graphLog.map(g => g.flux))
    const threshY = MID - (FLUX_THRESHOLD / maxFlux) * MID
    ctx.strokeStyle = 'rgba(255,220,0,0.7)'
    ctx.setLineDash([5, 5])
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(0, threshY); ctx.lineTo(W, threshY); ctx.stroke()
    ctx.setLineDash([])

    drawLine('rgba(255,255,255,0.9)', e => e.flux, 0, MID, maxFlux)

    // ── Bottom half: kick + snare flux, auto-scaled ──────────
    const maxDrum = Math.max(1, ...graphLog.map(g => Math.max(g.kick, g.snare))) * 1.1
    drawLine('rgba(0,200,255,0.9)', e => e.kick,  MID, MID, maxDrum)
    drawLine('rgba(255,140,0,0.9)', e => e.snare, MID, MID, maxDrum)

    // Labels
    ctx.font = '10px monospace'
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('flux',   4, 12)
    ctx.fillStyle = 'rgba(255,220,0,0.8)';   ctx.fillText('thresh', 4, 24)
    ctx.fillStyle = 'rgba(0,200,255,0.9)';   ctx.fillText('kick',   4, MID + 14)
    ctx.fillStyle = 'rgba(255,140,0,0.9)';   ctx.fillText('snare',  4, MID + 26)
  }

  const bpmConfidence = computed(() => {
    const detected = detectedBPM.value
    const ref_ = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
    if (!detected || !ref_) return 0
    const diff = Math.abs(detected - ref_)
    return Math.max(0, Math.round(100 - diff * 10))
  })

  return {
    startMicSync,
    startWithFile,
    stopMicSync,
    micActive,
    detectedBPM,
    bpmConfidence,
    debugEnergy,
    drawGraph,
  }
}

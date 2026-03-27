import { ref, computed } from 'vue'

const ONSET_WINDOW       = 10
const BPM_OUTPUT_HISTORY = 8
const GRAPH_SIZE         = 300
const STATS_WINDOW       = 90
const WARMUP_FRAMES      = STATS_WINDOW

export function useMicSync(songBpm) {
  const micActive   = ref(false)
  const detectedBPM = ref(null)
  const debugEnergy = ref({ flux: 0, z: 0 })

  // ── Tunable params (exposed for UI sliders) ──────────────
  const freqLow     = ref(8000)  // Hz
  const freqHigh    = ref(11000) // Hz
  const zThresh     = ref(2.0)   // std devs above mean to trigger
  const minInterval = ref(0.15)  // seconds between detections

  let audioCtx = null
  let analyser = null
  let stream   = null
  let rafId    = null

  let prevFreq   = null
  let frameCount = 0

  const statsBuf = new Array(STATS_WINDOW).fill(0)
  let statsIdx = 0

  const onsetTimes   = []
  const bpmEstimates = []
  let lastOnsetTime  = -Infinity

  const graphLog = Array.from({ length: GRAPH_SIZE }, () => ({ z: 0, beat: false }))
  let graphIdx = 0

  let bandStart = 1, bandEnd = 10

  function recomputeBins() {
    if (!audioCtx || !analyser) return
    const bw = audioCtx.sampleRate / analyser.fftSize
    bandStart = Math.max(1, Math.round(freqLow.value  / bw))
    bandEnd   = Math.max(bandStart + 1, Math.round(freqHigh.value / bw))
  }

  function processAudio() {
    if (!analyser || !audioCtx) return

    const freqBuf = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(freqBuf)

    frameCount++
    if (frameCount < WARMUP_FRAMES) {
      prevFreq = freqBuf.slice()
      rafId = requestAnimationFrame(processAudio)
      return
    }

    // Spectral flux in selected band
    let flux = 0
    for (let i = bandStart; i <= Math.min(bandEnd, freqBuf.length - 1); i++) {
      const d = freqBuf[i] - prevFreq[i]
      if (d > 0) flux += d
    }
    flux /= (bandEnd - bandStart + 1)

    statsBuf[statsIdx % STATS_WINDOW] = flux
    statsIdx++

    const mean = statsBuf.reduce((a, b) => a + b, 0) / STATS_WINDOW
    const std  = Math.sqrt(statsBuf.reduce((a, b) => a + (b - mean) ** 2, 0) / STATS_WINDOW)
    const z    = std < 0.01 ? 0 : (flux - mean) / std

    prevFreq = freqBuf.slice()
    debugEnergy.value = { flux: +flux.toFixed(1), z: +z.toFixed(2) }

    const now  = audioCtx.currentTime
    const beat = z > zThresh.value && (now - lastOnsetTime) > minInterval.value

    graphLog[graphIdx % GRAPH_SIZE] = { z, beat }
    graphIdx++

    if (beat) {
      lastOnsetTime = now
      onsetTimes.push(now)
      if (onsetTimes.length > ONSET_WINDOW) onsetTimes.shift()

      if (onsetTimes.length >= 4) {
        const intervals = []
        for (let i = 1; i < onsetTimes.length; i++) {
          const iv = onsetTimes[i] - onsetTimes[i - 1]
          if (iv >= 0.1 && iv <= 2.0) intervals.push(iv)
        }
        if (intervals.length >= 2) {
          const sorted = [...intervals].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          let candidate = Math.round(60 / median)

          const ref = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
          if (ref) {
            const options = [candidate, candidate * 2, Math.round(candidate / 2)]
              .filter(v => v >= 30 && v <= 300)
            candidate = options.reduce((a, b) => Math.abs(a - ref) < Math.abs(b - ref) ? a : b)
          }

          bpmEstimates.push(candidate)
          if (bpmEstimates.length > BPM_OUTPUT_HISTORY) bpmEstimates.shift()
          const s = [...bpmEstimates].sort((a, b) => a - b)
          detectedBPM.value = s[Math.floor(s.length / 2)]
        }
      }
    }

    rafId = requestAnimationFrame(processAudio)
  }

  function _initAnalyser() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.2
    recomputeBins()
    prevFreq = new Uint8Array(analyser.frequencyBinCount).fill(0)
    frameCount = 0; statsIdx = 0
    statsBuf.fill(0)
    onsetTimes.length = 0; bpmEstimates.length = 0
    lastOnsetTime = -Infinity
    graphIdx = 0
    graphLog.forEach(g => { g.z = 0; g.beat = false })
    micActive.value = true
    audioCtx.resume()
    rafId = requestAnimationFrame(processAudio)
  }

  async function startMicSync() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      _initAnalyser()
      audioCtx.createMediaStreamSource(stream).connect(analyser)
    } catch (err) { console.warn('Mic access failed:', err) }
  }

  async function startWithFile(file) {
    const audio = new Audio(URL.createObjectURL(file))
    audio.crossOrigin = 'anonymous'
    _initAnalyser()
    const src = audioCtx.createMediaElementSource(audio)
    src.connect(analyser); src.connect(audioCtx.destination)
    audio.play()
  }

  function stopMicSync() {
    if (rafId)    { cancelAnimationFrame(rafId); rafId = null }
    if (stream)   { stream.getTracks().forEach(t => t.stop()); stream = null }
    if (audioCtx) { audioCtx.close(); audioCtx = null }
    analyser = null; micActive.value = false; detectedBPM.value = null
  }

  function drawGraph(canvas) {
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H)

    // Beat flashes
    for (let i = 0; i < GRAPH_SIZE; i++) {
      if (graphLog[(graphIdx + i) % GRAPH_SIZE].beat) {
        const x = (i / GRAPH_SIZE) * W
        ctx.fillStyle = 'rgba(255,60,60,0.55)'; ctx.fillRect(x - 1, 0, 3, H)
        ctx.fillStyle = '#fff';                  ctx.fillRect(x - 2, 0, 5, 4)
      }
    }

    const maxZ = Math.max(zThresh.value * 2.5, ...graphLog.map(g => g.z), 0.1)
    const threshY = H - (zThresh.value / maxZ) * H
    ctx.strokeStyle = 'rgba(255,220,0,0.7)'; ctx.setLineDash([5,4]); ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(0, threshY); ctx.lineTo(W, threshY); ctx.stroke()
    ctx.setLineDash([])

    ctx.strokeStyle = 'rgba(180,100,255,0.95)'; ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i < GRAPH_SIZE; i++) {
      const val = graphLog[(graphIdx + i) % GRAPH_SIZE].z
      const x = (i / GRAPH_SIZE) * W
      const y = H - Math.min(1, Math.max(0, val) / maxZ) * H
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()

    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = 'rgba(180,100,255,0.9)'; ctx.fillText(`z-score  thresh:${zThresh.value}`, 4, 12)
    ctx.fillStyle = 'rgba(255,220,0,0.8)';   ctx.fillText(`${freqLow.value}–${freqHigh.value} Hz`, 4, H - 4)
  }

  const bpmConfidence = computed(() => {
    const detected = detectedBPM.value
    const ref_ = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
    if (!detected || !ref_) return 0
    return Math.max(0, Math.round(100 - Math.abs(detected - ref_) * 5))
  })

  return {
    startMicSync, startWithFile, stopMicSync,
    micActive, detectedBPM, bpmConfidence, debugEnergy, drawGraph,
    // tunable
    freqLow, freqHigh, zThresh, minInterval,
    recomputeBins,
  }
}

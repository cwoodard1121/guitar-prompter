import { ref, computed } from 'vue'

// Multi-band drum detection with z-score adaptive thresholds.
// Beat = kick fires AND (snare OR hi-hat) is also elevated.
// This cross-band filter kills most false positives:
//   guitar strum → hits kick band, misses hi-hat
//   talking       → hits snare-ish range, misses kick
//   real drum hit → kick + snare/hihat fire together

const MIN_ONSET_INTERVAL = 0.25   // 240 BPM max
const STATS_WINDOW       = 90     // frames for rolling mean/std (~1.5s at 60fps)
const KICK_Z_THRESH      = 2.0    // kick must be this many std devs above its mean
const CORR_Z_THRESH      = 1.2    // snare or hihat must also be elevated
const ONSET_WINDOW       = 10
const BPM_OUTPUT_HISTORY = 8
const GRAPH_SIZE         = 300
const WARMUP_FRAMES      = STATS_WINDOW

export function useMicSync(songBpm) {
  const micActive   = ref(false)
  const detectedBPM = ref(null)
  const debugEnergy = ref({ kick: 0, snare: 0, hihat: 0, kickZ: 0 })

  let audioCtx = null
  let analyser = null
  let stream   = null
  let rafId    = null

  let prevFreq   = null
  let frameCount = 0

  // Rolling stats buffers (circular)
  const kickBuf  = new Array(STATS_WINDOW).fill(0)
  const snareBuf = new Array(STATS_WINDOW).fill(0)
  const hihatBuf = new Array(STATS_WINDOW).fill(0)
  let statsIdx = 0

  const onsetTimes   = []
  const bpmEstimates = []
  let lastOnsetTime  = -Infinity

  const graphLog = Array.from({ length: GRAPH_SIZE }, () => ({ kickZ: 0, snareZ: 0, hihatZ: 0, beat: false }))
  let graphIdx = 0

  let kickStart = 1, kickEnd = 2
  let snareStart = 3, snareEnd = 8
  let hihatStart = 50, hihatEnd = 100

  function computeBinRanges() {
    const bw = audioCtx.sampleRate / analyser.fftSize
    kickStart  = Math.max(1, Math.round(50  / bw));  kickEnd  = Math.round(90   / bw)
    snareStart = Math.round(180 / bw);                snareEnd = Math.round(350  / bw)
    hihatStart = Math.round(7000 / bw);               hihatEnd = Math.round(12000 / bw)
  }

  function bandFlux(freqBuf, start, end) {
    let f = 0
    for (let i = start; i <= end; i++) {
      const d = freqBuf[i] - prevFreq[i]
      if (d > 0) f += d
    }
    return f / (end - start + 1)
  }

  function stats(buf) {
    const n = buf.length
    const mean = buf.reduce((a, b) => a + b, 0) / n
    const variance = buf.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    return { mean, std: Math.sqrt(variance) }
  }

  function zScore(buf, val) {
    const { mean, std } = stats(buf)
    return std < 0.01 ? 0 : (val - mean) / std
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

    const kickFlux  = bandFlux(freqBuf, kickStart,  kickEnd)
    const snareFlux = bandFlux(freqBuf, snareStart, snareEnd)
    const hihatFlux = bandFlux(freqBuf, hihatStart, hihatEnd)

    // Update rolling stats
    kickBuf [statsIdx % STATS_WINDOW] = kickFlux
    snareBuf[statsIdx % STATS_WINDOW] = snareFlux
    hihatBuf[statsIdx % STATS_WINDOW] = hihatFlux
    statsIdx++

    const kickZ  = zScore(kickBuf,  kickFlux)
    const snareZ = zScore(snareBuf, snareFlux)
    const hihatZ = zScore(hihatBuf, hihatFlux)

    prevFreq = freqBuf.slice()

    debugEnergy.value = {
      kick: +kickFlux.toFixed(1), snare: +snareFlux.toFixed(1),
      hihat: +hihatFlux.toFixed(1), kickZ: +kickZ.toFixed(2),
    }

    const now  = audioCtx.currentTime
    const gap  = now - lastOnsetTime
    // Kick must spike AND snare or hihat must be elevated
    const beat = kickZ > KICK_Z_THRESH &&
                 (snareZ > CORR_Z_THRESH || hihatZ > CORR_Z_THRESH) &&
                 gap > MIN_ONSET_INTERVAL

    graphLog[graphIdx % GRAPH_SIZE] = { kickZ, snareZ, hihatZ, beat }
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

          const ref = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
          if (ref) {
            const options = [candidate, candidate * 2, Math.round(candidate / 2)]
              .filter(v => v >= 30 && v <= 240)
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
    computeBinRanges()
    prevFreq = new Uint8Array(analyser.frequencyBinCount).fill(0)
    frameCount = 0; statsIdx = 0
    kickBuf.fill(0); snareBuf.fill(0); hihatBuf.fill(0)
    onsetTimes.length = 0; bpmEstimates.length = 0
    lastOnsetTime = -Infinity
    graphIdx = 0
    graphLog.forEach(g => { g.kickZ = 0; g.snareZ = 0; g.hihatZ = 0; g.beat = false })
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
    const source = audioCtx.createMediaElementSource(audio)
    source.connect(analyser)
    source.connect(audioCtx.destination)
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
    const T = Math.floor(H / 3)  // top third: kick z
    const M = T * 2               // bottom two-thirds split for snare/hihat

    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, W, H)

    // Dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1
    ;[T, M].forEach(y => { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() })

    // Beat flashes
    for (let i = 0; i < GRAPH_SIZE; i++) {
      if (graphLog[(graphIdx + i) % GRAPH_SIZE].beat) {
        const x = (i / GRAPH_SIZE) * W
        ctx.fillStyle = 'rgba(255,60,60,0.55)'
        ctx.fillRect(x - 1, 0, 3, H)
        ctx.fillStyle = '#fff'
        ctx.fillRect(x - 2, 0, 5, 4)
      }
    }

    const maxZ = 5
    const drawZLine = (color, getter, top, height, thresh) => {
      // Threshold line
      const ty = top + height - Math.min(1, thresh / maxZ) * height
      ctx.strokeStyle = 'rgba(255,220,0,0.6)'; ctx.setLineDash([4,4]); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke()
      ctx.setLineDash([])
      // Signal
      ctx.strokeStyle = color; ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < GRAPH_SIZE; i++) {
        const val = getter(graphLog[(graphIdx + i) % GRAPH_SIZE])
        const x = (i / GRAPH_SIZE) * W
        const y = top + height - Math.min(1, Math.max(0, val) / maxZ) * height
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    drawZLine('rgba(100,180,255,0.9)', e => e.kickZ,  0, T,   KICK_Z_THRESH)
    drawZLine('rgba(255,140,0,0.9)',   e => e.snareZ, T, T,   CORR_Z_THRESH)
    drawZLine('rgba(180,100,255,0.9)', e => e.hihatZ, M, H-M, CORR_Z_THRESH)

    ctx.font = 'bold 9px monospace'
    ctx.fillStyle = 'rgba(100,180,255,0.9)'; ctx.fillText(`kick z>${KICK_Z_THRESH}`,  4, T  - 3)
    ctx.fillStyle = 'rgba(255,140,0,0.9)';   ctx.fillText(`snare z>${CORR_Z_THRESH}`, 4, M  - 3)
    ctx.fillStyle = 'rgba(180,100,255,0.9)'; ctx.fillText(`hihat z>${CORR_Z_THRESH}`, 4, H  - 4)
  }

  const bpmConfidence = computed(() => {
    const detected = detectedBPM.value
    const ref_ = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
    if (!detected || !ref_) return 0
    return Math.max(0, Math.round(100 - Math.abs(detected - ref_) * 5))
  })

  return { startMicSync, startWithFile, stopMicSync, micActive, detectedBPM, bpmConfidence, debugEnergy, drawGraph }
}

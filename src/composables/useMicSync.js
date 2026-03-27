import { ref, computed } from 'vue'

// Beat/tempo detection focused on drum frequencies.
// Kick drum (50–150 Hz) and snare (150–500 Hz) are the primary signals.
// Full-band is ignored — too noisy in a live band mix.

const ENERGY_HISTORY    = 43    // ~700ms rolling average at 60fps
const MIN_ONSET_INTERVAL = 0.25 // 240 BPM max — filters hi-hats and sub-beat noise
const ONSET_THRESHOLD   = 0.9   // spike must be 0.9x rolling average
const NOISE_FLOOR       = 0.003 // ignore near-silence
const ONSET_WINDOW      = 10    // onsets kept for interval calculation
const WARMUP_FRAMES     = ENERGY_HISTORY
const BPM_OUTPUT_HISTORY = 8    // median of last N estimates for stable display

export function useMicSync(songBpm) {
  const micActive   = ref(false)
  const detectedBPM = ref(null)
  const debugEnergy = ref({ kick: 0, snare: 0, ratio: 0 }) // dev only

  let audioCtx = null
  let analyser = null
  let stream   = null
  let rafId    = null

  // Per-band rolling energy (circular buffers)
  const kickHistory  = new Array(ENERGY_HISTORY).fill(0)
  const snareHistory = new Array(ENERGY_HISTORY).fill(0)
  let histIdx    = 0
  let frameCount = 0

  // Onset + BPM state
  const onsetTimes  = []
  const bpmEstimates = [] // output smoothing buffer
  let lastOnsetTime = -Infinity

  // Bin ranges computed once after AudioContext is ready
  let kickStart = 1, kickEnd = 3, snareStart = 3, snareEnd = 11

  function computeBinRanges() {
    const binWidth = audioCtx.sampleRate / analyser.fftSize
    kickStart  = Math.max(1, Math.round(50  / binWidth))
    kickEnd    = Math.round(200 / binWidth)
    snareStart = kickEnd + 1
    snareEnd   = Math.round(600 / binWidth)
  }

  function processAudio() {
    if (!analyser || !audioCtx) return

    const freqBuf = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(freqBuf)

    // Kick energy (50–150 Hz)
    let kickSum = 0
    for (let i = kickStart; i <= kickEnd; i++) kickSum += (freqBuf[i] / 255) ** 2
    const kickEnergy = Math.sqrt(kickSum / (kickEnd - kickStart + 1))

    // Snare energy (150–500 Hz)
    let snareSum = 0
    for (let i = snareStart; i <= snareEnd; i++) snareSum += (freqBuf[i] / 255) ** 2
    const snareEnergy = Math.sqrt(snareSum / (snareEnd - snareStart + 1))

    kickHistory [histIdx % ENERGY_HISTORY] = kickEnergy
    snareHistory[histIdx % ENERGY_HISTORY] = snareEnergy
    histIdx++
    frameCount++

    if (frameCount < WARMUP_FRAMES) { rafId = requestAnimationFrame(processAudio); return }

    const avgKick  = kickHistory .reduce((a, b) => a + b, 0) / ENERGY_HISTORY
    const avgSnare = snareHistory.reduce((a, b) => a + b, 0) / ENERGY_HISTORY

    const kickRatio  = avgKick  > NOISE_FLOOR ? kickEnergy  / avgKick  : 0
    const snareRatio = avgSnare > NOISE_FLOOR ? snareEnergy / avgSnare : 0

    // Kick weighted higher — it's the more reliable beat marker
    const ratio = kickRatio * 0.7 + snareRatio * 0.3

    debugEnergy.value = {
      kick:  +kickEnergy.toFixed(4),
      snare: +snareEnergy.toFixed(4),
      ratio: +ratio.toFixed(3),
    }

    const now = audioCtx.currentTime
    const gap = now - lastOnsetTime

    if (ratio > ONSET_THRESHOLD && gap > MIN_ONSET_INTERVAL) {
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

          // Output smoothing: median of last BPM_OUTPUT_HISTORY estimates
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
    analyser.smoothingTimeConstant = 0.2 // default 0.8 kills transients — need sharp hits
    computeBinRanges()
    frameCount = 0
    histIdx    = 0
    kickHistory .fill(0)
    snareHistory.fill(0)
    onsetTimes.length   = 0
    bpmEstimates.length = 0
    lastOnsetTime = -Infinity
    micActive.value = true
    audioCtx.resume()
    rafId = requestAnimationFrame(processAudio)
  }

  async function startMicSync() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      _initAnalyser()
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
    } catch (err) {
      console.warn('Mic access failed:', err)
    }
  }

  async function startWithFile(file) {
    const url   = URL.createObjectURL(file)
    const audio = new Audio(url)
    audio.crossOrigin = 'anonymous'
    _initAnalyser()
    const source = audioCtx.createMediaElementSource(audio)
    source.connect(analyser)
    source.connect(audioCtx.destination)
    audio.play()
  }

  function stopMicSync() {
    if (rafId)   { cancelAnimationFrame(rafId); rafId = null }
    if (stream)  { stream.getTracks().forEach(t => t.stop()); stream = null }
    if (audioCtx){ audioCtx.close(); audioCtx = null }
    analyser        = null
    micActive.value = false
    detectedBPM.value = null
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
  }
}

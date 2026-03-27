import { ref, computed } from 'vue'

// General-purpose beat/tempo detection from ambient audio.
// Works with guitar strums, drums, bass, or full band — anything rhythmic.
// Uses onset detection across both the low-frequency sub-band (kick/bass)
// and full-band energy, then picks the stronger signal.

const ENERGY_HISTORY = 43       // ~700ms of history at 60fps
const MIN_ONSET_INTERVAL = 0.18 // 333 BPM max (enough for any real tempo)
const ONSET_THRESHOLD = 1.35    // spike must be 1.35x rolling average
const NOISE_FLOOR = 0.008       // ignore near-silence
const ONSET_WINDOW = 10         // keep last N onsets for BPM calc
const WARMUP_FRAMES = ENERGY_HISTORY // skip detection during initial fill

export function useMicSync(songBpm) {
  const micActive = ref(false)
  const detectedBPM = ref(null)

  let audioCtx = null
  let analyser = null
  let stream = null
  let rafId = null

  // Rolling energy history (circular buffer)
  const fullHistory = new Array(ENERGY_HISTORY).fill(0)
  const bassHistory = new Array(ENERGY_HISTORY).fill(0)
  let histIdx = 0
  let frameCount = 0

  // Onset state
  const onsetTimes = []
  let lastOnsetTime = -Infinity

  function processAudio() {
    if (!analyser || !audioCtx) return

    const bufLen = analyser.frequencyBinCount // fftSize / 2
    const timeBuf = new Float32Array(bufLen)
    const freqBuf = new Uint8Array(bufLen)
    analyser.getFloatTimeDomainData(timeBuf)
    analyser.getByteFrequencyData(freqBuf)

    // Full-band RMS
    let sum = 0
    for (let i = 0; i < bufLen; i++) sum += timeBuf[i] * timeBuf[i]
    const fullEnergy = Math.sqrt(sum / bufLen)

    // Low-frequency energy (kick/bass range ~20–250 Hz)
    // At 44100 Hz, fftSize 1024 → bin width ≈ 43 Hz → bins 0–5 cover ~250 Hz
    const bassEnd = Math.floor(250 / (audioCtx.sampleRate / analyser.fftSize))
    let bassSum = 0
    for (let i = 0; i <= bassEnd; i++) bassSum += (freqBuf[i] / 255) ** 2
    const bassEnergy = Math.sqrt(bassSum / (bassEnd + 1))

    // Update circular history
    fullHistory[histIdx % ENERGY_HISTORY] = fullEnergy
    bassHistory[histIdx % ENERGY_HISTORY] = bassEnergy
    histIdx++
    frameCount++

    // Skip until history is warm
    if (frameCount < WARMUP_FRAMES) { rafId = requestAnimationFrame(processAudio); return }

    const avgFull = fullHistory.reduce((a, b) => a + b, 0) / ENERGY_HISTORY
    const avgBass = bassHistory.reduce((a, b) => a + b, 0) / ENERGY_HISTORY

    // Pick whichever sub-band has a stronger relative spike
    const fullRatio = avgFull > NOISE_FLOOR ? fullEnergy / avgFull : 0
    const bassRatio = avgBass > NOISE_FLOOR ? bassEnergy / avgBass : 0
    const ratio = Math.max(fullRatio, bassRatio)

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
          if (iv >= 0.25 && iv <= 2.0) intervals.push(iv) // 30–240 BPM
        }
        if (intervals.length >= 2) {
          const sorted = [...intervals].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          detectedBPM.value = Math.round(60 / median)
        }
      }
    }

    rafId = requestAnimationFrame(processAudio)
  }

  async function startMicSync() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioCtx.createMediaStreamSource(stream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      micActive.value = true
      frameCount = 0
      histIdx = 0
      fullHistory.fill(0)
      bassHistory.fill(0)
      onsetTimes.length = 0
      lastOnsetTime = -Infinity
      rafId = requestAnimationFrame(processAudio)
    } catch (err) {
      console.warn('Mic access failed:', err)
    }
  }

  function stopMicSync() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
    if (audioCtx) { audioCtx.close(); audioCtx = null }
    analyser = null
    micActive.value = false
    detectedBPM.value = null
  }

  // Confidence: how closely detected BPM matches the song's stored BPM
  const bpmConfidence = computed(() => {
    const detected = detectedBPM.value
    const ref_ = typeof songBpm?.value !== 'undefined' ? songBpm.value : songBpm
    if (!detected || !ref_) return 0
    const diff = Math.abs(detected - ref_)
    return Math.max(0, Math.round(100 - diff * 10))
  })

  return {
    startMicSync,
    stopMicSync,
    micActive,
    detectedBPM,
    bpmConfidence,
  }
}

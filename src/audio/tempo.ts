/**
 * Tempo and bar-1 detection from a recording. Pure (samples in, numbers out) so
 * it runs in a worker and is unit tested against synthetic click tracks.
 *
 * 1. onset strength: spectral flux of a Hann-windowed STFT (log magnitudes)
 * 2. tempo: autocorrelation of the onset curve scored as a comb, with a soft prior
 *    toward common tempos, then refined against the whole track's beat grid
 * 3. phase: where that beat grid lines up best; the strongest beat of the bar is
 *    the downbeat, and bar 1 is the first downbeat once the music has started
 */

export interface TempoResult {
  bpm: number;
  /** 0..1, how clearly one tempo stood out. Below ~0.25 there's no steady beat to trust. */
  confidence: number;
  /** Half and double time, for when the guess is an octave off. */
  alternatives: number[];
  /** Seconds to the first beat of the grid. */
  firstBeat: number;
  /** Seconds where bar 1 most likely starts. */
  barOne: number;
}

const TARGET_SR = 11025;
const N = 512; // frame
const HOP = 128; // ~11.6 ms at 11 kHz
const MIN_BPM = 50;
const MAX_BPM = 220;

/** Mono, downsampled (box filter: plenty for rhythm). */
function downsample(x: Float32Array, sr: number): { y: Float32Array; sr: number } {
  const k = Math.max(1, Math.round(sr / TARGET_SR));
  const y = new Float32Array(Math.floor(x.length / k));
  for (let i = 0; i < y.length; i++) {
    let s = 0;
    for (let j = 0; j < k; j++) s += x[i * k + j];
    y[i] = s / k;
  }
  return { y, sr: sr / k };
}

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Spectral-flux onset strength, one value per hop, normalized and with the local mean removed. */
export function onsetEnvelope(samples: Float32Array, sampleRate: number): { env: Float32Array; fps: number } {
  const { y, sr } = downsample(samples, sampleRate);
  const frames = Math.max(0, Math.floor((y.length - N) / HOP) + 1);
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  let prev = new Float64Array(N / 2);
  let cur = new Float64Array(N / 2);
  const raw = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) {
      re[i] = y[o + i] * win[i];
      im[i] = 0;
    }
    fft(re, im);
    let flux = 0;
    for (let k = 1; k < N / 2; k++) {
      cur[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      const d = cur[k] - prev[k];
      if (d > 0) flux += d;
    }
    raw[f] = f === 0 ? 0 : flux;
    [prev, cur] = [cur, prev];
  }
  const fps = sr / HOP;
  // remove the local mean (~0.4 s) so sustained loud passages don't dominate, keep the peaks
  const w = Math.max(1, Math.round(fps * 0.2));
  const env = new Float32Array(frames);
  const pre = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) pre[i + 1] = pre[i] + raw[i];
  let max = 0;
  for (let i = 0; i < frames; i++) {
    const a = Math.max(0, i - w);
    const b = Math.min(frames, i + w + 1);
    const v = raw[i] - (pre[b] - pre[a]) / (b - a);
    env[i] = v > 0 ? v : 0;
    if (env[i] > max) max = env[i];
  }
  if (max > 0) for (let i = 0; i < frames; i++) env[i] /= max;
  return { env, fps };
}

/** Linear interpolation into the envelope (0 outside). */
const at = (env: Float32Array, t: number) => {
  const i = Math.floor(t);
  if (i < 0 || i + 1 >= env.length) return 0;
  const f = t - i;
  return env[i] * (1 - f) + env[i + 1] * f;
};

/** Best phase (frames) for a beat period and how well the grid fits. */
function bestPhase(env: Float32Array, period: number): { phase: number; score: number } {
  let best = { phase: 0, score: -1 };
  for (let ph = 0; ph < period; ph += 0.5) {
    let s = 0;
    let n = 0;
    for (let t = ph; t < env.length; t += period, n++) s += at(env, t);
    const score = n ? s / n : 0;
    if (score > best.score) best = { phase: ph, score };
  }
  return best;
}

export function detectTempo(samples: Float32Array, sampleRate: number, beatsPerBar = 4): TempoResult | null {
  const { env, fps } = onsetEnvelope(samples, sampleRate);
  if (env.length < fps * 4) return null; // need a few seconds

  // autocorrelation over the lag range we care about (and 2× for the comb)
  const minLag = Math.floor((60 * fps) / MAX_BPM);
  const maxLag = Math.ceil((60 * fps) / MIN_BPM) * 2 + 2;
  const ac = new Float64Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    ac[lag] = s / (env.length - lag);
  }
  const acAt = (lag: number) => {
    const i = Math.floor(lag);
    if (i + 1 > maxLag) return 0;
    return ac[i] * (1 - (lag - i)) + ac[i + 1] * (lag - i);
  };

  // comb score per candidate tempo, with a soft log-normal prior around 110 bpm
  const scores: { bpm: number; s: number }[] = [];
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.5) {
    const lag = (60 * fps) / bpm;
    const comb = acAt(lag) + 0.5 * acAt(2 * lag) + 0.5 * acAt(lag / 2) * (lag / 2 >= minLag ? 1 : 0);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2);
    scores.push({ bpm, s: comb * prior });
  }
  const top = scores.reduce((a, b) => (b.s > a.s ? b : a));
  if (top.s <= 0) return null;

  // refine against the whole track: fine steps, the grid that lines up best wins
  let fine = { bpm: top.bpm, score: -1, phase: 0 };
  for (let bpm = top.bpm - 2; bpm <= top.bpm + 2; bpm += 0.05) {
    const { phase, score } = bestPhase(env, (60 * fps) / bpm);
    if (score > fine.score) fine = { bpm, score, phase };
  }
  const period = (60 * fps) / fine.bpm;

  // downbeat: the beat of the bar with the most onset energy across the song
  const acc = new Float64Array(beatsPerBar);
  let k = 0;
  for (let t = fine.phase; t < env.length; t += period, k++) acc[k % beatsPerBar] += at(env, t);
  const strongest = Math.max(...acc);
  const others = (acc.reduce((x, y) => x + y, 0) - strongest) / Math.max(1, beatsPerBar - 1);
  // no clear accent: assume the music starts on bar 1 (down = -1 means "first beat heard")
  const down = strongest > others * 1.1 ? acc.indexOf(strongest) : -1;

  // where the music starts: first onset above a fraction of the strong ones
  const start = env.findIndex((v) => v > 0.25);
  let barOneFrame: number;
  if (down < 0) {
    barOneFrame = fine.phase;
    while (barOneFrame < start - period * 0.5) barOneFrame += period;
  } else {
    barOneFrame = fine.phase + down * period;
    while (barOneFrame - beatsPerBar * period >= start - period * 0.5) barOneFrame -= beatsPerBar * period;
    while (barOneFrame < start - period * 0.5) barOneFrame += beatsPerBar * period;
  }

  const bpm = Math.round(fine.bpm * 10) / 10;
  // how much better the beat grid lands on onsets than an average moment does:
  // ~2 for noise, well above that for music with a pulse
  let envMean = 0;
  for (let i = 0; i < env.length; i++) envMean += env[i];
  envMean /= env.length;
  const fit = fine.score / (envMean + 1e-9);
  const confidence = Math.max(0, Math.min(1, (fit - 2.2) / 4));
  const centre = N / 2 / (fps * HOP); // a frame's onset is heard at its centre
  const toSec = (f: number) => f / fps + centre;
  return {
    bpm,
    confidence,
    alternatives: [bpm / 2, bpm * 2].filter((b) => b >= 40 && b <= 260).map((b) => Math.round(b * 10) / 10),
    firstBeat: toSec(fine.phase),
    barOne: toSec(barOneFrame),
  };
}

import { describe, expect, it } from 'vitest';
import { detectTempo } from './tempo';

/** Strummed-guitar-ish click track: noisy decaying bursts, accented downbeats, a bit of hiss. */
function clicks(bpm: number, start: number, seconds = 30, sr = 44100, beatsPerBar = 4, opts: { jitter?: number; drone?: number; hit?: number } = {}) {
  const x = new Float32Array(sr * seconds);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < x.length; i++) x[i] = rnd() * 0.01 + (opts.drone ?? 0) * Math.sin((2 * Math.PI * 110 * i) / sr) * (0.7 + 0.3 * Math.sin(i / sr));
  const beat = 60 / bpm;
  for (let k = 0, t = start; t < seconds - 0.2; k++, t += beat) {
    const amp = (k % beatsPerBar === 0 ? 0.9 : 0.45) * (opts.hit ?? 1);
    const s0 = Math.round((t + rnd() * (opts.jitter ?? 0)) * sr);
    for (let i = 0; i < sr * 0.12 && s0 + i < x.length; i++) {
      const env = Math.exp(-i / (sr * 0.025));
      x[s0 + i] += amp * env * (0.6 * rnd() + 0.4 * Math.sin((2 * Math.PI * 196 * i) / sr));
    }
  }
  return { x, sr };
}

const near = (got: number, want: number) => [want, want / 2, want * 2].some((w) => Math.abs(got - w) <= 1);

describe('detectTempo', () => {
  for (const [bpm, start] of [
    [72, 1.24],
    [96, 0.5],
    [128, 2.0],
    [150, 0.8],
  ] as const) {
    it(`finds ${bpm} bpm and bar 1 at ${start}s`, () => {
      const { x, sr } = clicks(bpm, start);
      const r = detectTempo(x, sr)!;
      expect(r).not.toBeNull();
      expect(near(r.bpm, bpm), `got ${r.bpm}`).toBe(true);
      expect(Math.abs(r.barOne - start), `bar one ${r.barOne}`).toBeLessThan(0.04);
      expect(r.confidence).toBeGreaterThan(0.25);
    });
  }

  it('copes with a human player over a loud sustained chord', () => {
    const { x, sr } = clicks(112, 0.9, 30, 44100, 4, { jitter: 0.015, drone: 0.5, hit: 0.35 });
    const r = detectTempo(x, sr)!;
    expect(near(r.bpm, 112), `got ${r.bpm}`).toBe(true);
    expect(Math.abs(r.barOne - 0.9), `bar one ${r.barOne}`).toBeLessThan(0.06);
    expect(r.confidence).toBeGreaterThan(0.25);
  });

  it('without accents, bar 1 is where the music starts', () => {
    const sr = 44100;
    const x = new Float32Array(sr * 20);
    for (let t = 0.7; t < 19.5; t += 0.5) for (let i = 0; i < 2000; i++) x[Math.round(t * sr) + i] += Math.exp(-i / 800) * Math.sin(i);
    const r = detectTempo(x, sr)!;
    expect(near(r.bpm, 120)).toBe(true);
    expect(Math.abs(r.barOne - 0.7)).toBeLessThan(0.04);
  });

  it('offers half and double time', () => {
    const { x, sr } = clicks(100, 0.3, 20);
    const r = detectTempo(x, sr)!;
    expect(r.alternatives.length).toBe(2);
  });

  it("doesn't trust noise", () => {
    const sr = 44100;
    let seed = 3;
    const x = new Float32Array(sr * 12).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.3);
    const r = detectTempo(x, sr);
    expect(r === null || r.confidence < 0.25).toBe(true);
  });

  it('needs a few seconds of audio', () => {
    expect(detectTempo(new Float32Array(44100), 44100)).toBeNull();
  });
});

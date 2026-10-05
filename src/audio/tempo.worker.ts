import { detectTempo } from './tempo';

/** Runs tempo detection off the main thread. */
self.onmessage = (e: MessageEvent<{ samples: Float32Array; sampleRate: number; beatsPerBar: number }>) => {
  const { samples, sampleRate, beatsPerBar } = e.data;
  try {
    self.postMessage({ ok: true, result: detectTempo(samples, sampleRate, beatsPerBar) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
